import * as THREE from 'three/webgpu';
import { CONFIG } from '../config';
import { cached, type Formation } from '../formations/Formation';
import { makeAperture } from '../formations/shapes/aperture';
import { chainAnchorZ, repeatAlongZ } from '../formations/chain';
import type { GuidanceContext, GuidanceMode, GuidanceReport, GuidanceTask } from './GuidanceMode';
import { centringProgress, Ratchet } from './progress';

const SPEC = CONFIG.formation.chain.aperture;

/**
 * Breite des Rings nach aussen.
 *
 * Schmaler ist besser: bei 9 m verteilten sich die Punkte auf 424 m² je Kopie
 * und kamen auf 8 pro m² - zu duenn, um als Rand zu lesen. Bei 5.5 m sind es
 * rund 30 pro m², und die Blende bekommt eine Kante.
 */
const APERTURE_BAND = 5.5;

/**
 * Der Vorhang: eine Flucht von Blenden. Der Weg wird zur Architektur statt zum
 * Symbol.
 *
 * s = Abstand nach aussen vom Rand der Oeffnung, dissolveDir = +1: je besser man
 * die Oeffnung anfliegt, desto weiter frisst sich die Blende vom Loch nach
 * aussen weg - die Oeffnung weitet sich. Als Kette faedelt man sich durch
 * mehrere hintereinander.
 */
export class CurtainMode implements GuidanceMode {
  readonly id = 'curtain' as const;
  readonly label = 'Vorhang';
  private task!: GuidanceTask;
  private holeX = 0;
  private holeY = 0;
  private holeR = 3.2;
  private ratchet = new Ratchet();
  private matrix = new THREE.Matrix4();
  private anchorZ = 0;
  private lastPlane = 0;

  begin(task: GuidanceTask, ctx: GuidanceContext) {
    this.task = task;
    this.ratchet.reset();
    this.holeR = 2.8 + task.intensity * 1.4;

    // Die Oeffnung liegt im lokalen Ursprung; die Matrix setzt sie an ihren Platz.
    const slots = cached(`blende:${this.holeR.toFixed(1)}`, () =>
      repeatAlongZ(
        makeAperture(SPEC.slotsPerCopy, this.holeR, APERTURE_BAND),
        SPEC.copies, SPEC.spacing,
      ));

    const dx = task.axis === 'y' ? 0 : task.sign * task.amount;
    const dy = task.axis === 'x' ? 0 : task.sign * task.amount;
    this.holeX = ctx.flight.position.x + dx;
    this.holeY = ctx.flight.position.y + dy;

    const formation: Formation = {
      slots,
      slotCount: SPEC.copies * SPEC.slotsPerCopy,
      slotsPerCopy: SPEC.slotsPerCopy,
      dissolveDir: 1,
      origin: new THREE.Vector3(0, 0, 0),
    };

    this.anchorZ = chainAnchorZ(ctx.flight.position.z, SPEC);
    this.lastPlane = Math.floor(ctx.flight.position.z / SPEC.spacing);
    this.matrix.identity().setPosition(this.holeX, this.holeY, this.anchorZ);
    ctx.field.beginFormation(formation, this.matrix);
  }

  update(ctx: GuidanceContext): GuidanceReport {
    const anchor = chainAnchorZ(ctx.flight.position.z, SPEC);
    if (anchor !== this.anchorZ) {
      this.anchorZ = anchor;
      this.matrix.identity().setPosition(this.holeX, this.holeY, anchor);
      ctx.field.advanceChain(this.matrix, new THREE.Vector3(0, 0, 0));
    }

    const raw = centringProgress(ctx.flight, this.holeX, this.holeY, this.holeR * 2.2);
    const p = this.ratchet.step(raw, ctx.dt);
    ctx.uniforms.progress.value = p;
    ctx.uniforms.recruitDensity.value = 0.45 + this.task.intensity * 0.45;

    const plane = Math.floor(ctx.flight.position.z / SPEC.spacing);
    if (plane !== this.lastPlane) {
      this.lastPlane = plane;
      const treffer = Math.hypot(
        ctx.flight.position.x - this.holeX,
        ctx.flight.position.y - this.holeY,
      ) <= this.holeR * 1.6;
      if (treffer) {
        ctx.field.burst(
          new THREE.Vector3(this.holeX, this.holeY, (plane + 1) * SPEC.spacing),
          18,
        );
        return { progress: 1, completed: true, event: 'gate-passed' };
      }
    }
    return { progress: p, completed: false, event: null };
  }

  end(_reason: 'success' | 'timeout' | 'skip', ctx: GuidanceContext) {
    ctx.field.releaseFormation();
    ctx.uniforms.recruitDensity.value = CONFIG.formation.recruitDensity;
  }
}
