import * as THREE from 'three/webgpu';
import { CONFIG } from '../config';
import { cached, type Formation } from '../formations/Formation';
import { makeRing } from '../formations/shapes/ring';
import { chainAnchorZ, repeatAlongZ } from '../formations/chain';
import type { GuidanceContext, GuidanceMode, GuidanceReport, GuidanceTask } from './GuidanceMode';
import { centringProgress, Ratchet } from './progress';

const SPEC = CONFIG.formation.chain.ring;

/** Anteil des Rings, der von Anfang an steht. Der Rest zeichnet sich zu. */
const GATE_BASE = 0.45;

/**
 * Das Tor, das sich zuzeichnet.
 *
 * s = theta/2pi, dissolveDir = -1: der Ring BAUT sich auf, je zentrierter man
 * ihn anfliegt. Die Kette macht daraus einen Tunnel aus Reifen, seitlich um
 * `amount` von der Schiene versetzt - man muss sich also bewegen, um
 * hindurchzukommen. Das erste Tor zu verfehlen ist kein Scheitern: es kommt
 * gleich das naechste, und genau daraus lernt man.
 */
export class GateMode implements GuidanceMode {
  readonly id = 'gate' as const;
  readonly label = 'Tor';
  private task!: GuidanceTask;
  private centreX = 0;
  private centreY = 0;
  private radius = 3.5;
  private ratchet = new Ratchet();
  private matrix = new THREE.Matrix4();
  private anchorZ = 0;
  private lastPlane = 0;

  begin(task: GuidanceTask, ctx: GuidanceContext) {
    this.task = task;
    this.ratchet.reset();
    this.radius = 3.2 + task.intensity * 1.2;

    const slots = cached(`ring:${this.radius.toFixed(1)}`, () =>
      repeatAlongZ(makeRing(SPEC.slotsPerCopy, this.radius, 0.32), SPEC.copies, SPEC.spacing));

    const dx = task.axis === 'y' ? 0 : task.sign * task.amount;
    const dy = task.axis === 'x' ? 0 : task.sign * task.amount;
    this.centreX = ctx.flight.position.x + dx;
    this.centreY = ctx.flight.position.y + dy;

    const formation: Formation = {
      slots,
      slotCount: SPEC.copies * SPEC.slotsPerCopy,
      slotsPerCopy: SPEC.slotsPerCopy,
      dissolveDir: -1,
      origin: new THREE.Vector3(0, 0, 0),
    };

    this.anchorZ = chainAnchorZ(ctx.flight.position.z, SPEC);
    this.lastPlane = Math.floor(ctx.flight.position.z / SPEC.spacing);
    this.matrix.identity().setPosition(this.centreX, this.centreY, this.anchorZ);
    ctx.field.beginFormation(formation, this.matrix);
  }

  update(ctx: GuidanceContext): GuidanceReport {
    // Kette nachruecken, sobald der Flieger eine Rasterweite weiter ist.
    const anchor = chainAnchorZ(ctx.flight.position.z, SPEC);
    if (anchor !== this.anchorZ) {
      this.anchorZ = anchor;
      this.matrix.identity().setPosition(this.centreX, this.centreY, anchor);
      ctx.field.advanceChain(this.matrix, new THREE.Vector3(0, 0, 0));
    }

    const raw = centringProgress(ctx.flight, this.centreX, this.centreY, this.radius * 1.6);
    const p = this.ratchet.step(raw, ctx.dt);
    // Der Ring baut sich auf (dissolveDir -1), waehrend man sich zentriert.
    // Ohne Sockel waeren bei Fortschritt 0 nur ~8 % des Umfangs da - man soll
    // aber auf etwas zufliegen koennen, BEVOR man richtig fliegt. Gemessen:
    // ohne Sockel 243 gebundene Partikel, das Tor war praktisch unsichtbar.
    ctx.uniforms.progress.value = GATE_BASE + (1 - GATE_BASE) * p;
    ctx.uniforms.recruitDensity.value = 0.4 + this.task.intensity * 0.5;

    // Die Tore stehen auf demselben Weltraster wie der Anker. Wechselt das
    // Vielfache, ist gerade eine Torebene passiert worden.
    const plane = Math.floor(ctx.flight.position.z / SPEC.spacing);
    if (plane !== this.lastPlane) {
      this.lastPlane = plane;
      const treffer = Math.hypot(
        ctx.flight.position.x - this.centreX,
        ctx.flight.position.y - this.centreY,
      ) <= this.radius * 1.5;
      if (treffer) {
        ctx.field.burst(
          new THREE.Vector3(this.centreX, this.centreY, (plane + 1) * SPEC.spacing),
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
