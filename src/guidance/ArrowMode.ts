import * as THREE from 'three/webgpu';
import { CONFIG } from '../config';
import { cached, type Formation } from '../formations/Formation';
import { makeArrow } from '../formations/shapes/arrow';
import { chainAnchorZ, repeatAlongZ } from '../formations/chain';
import type { GuidanceContext, GuidanceMode, GuidanceReport, GuidanceTask } from './GuidanceMode';
import { axisProgress, Bezugsbahn, Ratchet } from './progress';

const SPEC = CONFIG.formation.chain.arrow;

/**
 * Der Pfeil, der sich selbst auffrisst.
 *
 * s ist die Koordinate entlang der Zeigerichtung, dissolveDir = +1. Fliegt man
 * nach rechts, wandert die Wellenfront von links nach rechts durch den Pfeil -
 * das Zeichen verbraucht sich genau in die Richtung, in die es zeigt.
 *
 * Als Kette (siehe formations/chain.ts): mehrere Pfeile stehen hintereinander
 * im Raum wie Schilder an einer Strasse. Alle zeigen denselben Fortschritt und
 * zehren sich gemeinsam auf.
 */
export class ArrowMode implements GuidanceMode {
  readonly id = 'arrow' as const;
  readonly label = 'Pfeil';
  private task!: GuidanceTask;
  private origin = new Bezugsbahn();
  private ratchet = new Ratchet();
  private matrix = new THREE.Matrix4();
  private anchorZ = 0;
  private offX = 0;
  private offY = 0;

  begin(task: GuidanceTask, ctx: GuidanceContext) {
    this.task = task;
    this.origin.beginne(ctx.flight);
    this.ratchet.reset();

    const len = 9 + task.intensity * 3;
    const slots = cached(`arrow:${len.toFixed(1)}`, () =>
      repeatAlongZ(makeArrow(SPEC.slotsPerCopy, len), SPEC.copies, SPEC.spacing));

    // Leicht zur Zielrichtung versetzt, damit die Kette im peripheren Blickfeld
    // des Flugwegs steht statt genau auf der Nase.
    const winkel = this.angleFor(task);
    this.offX = Math.cos(winkel) * 2.5;
    this.offY = Math.sin(winkel) * 2.5;
    this.matrix.makeRotationZ(winkel);

    const formation: Formation = {
      slots,
      slotCount: SPEC.copies * SPEC.slotsPerCopy,
      slotsPerCopy: SPEC.slotsPerCopy,
      dissolveDir: 1,
      origin: new THREE.Vector3(0, 0, 0),
    };

    this.anchorZ = chainAnchorZ(ctx.flight.position.z, SPEC);
    this.matrix.setPosition(this.offX, this.offY, this.anchorZ);
    ctx.field.beginFormation(formation, this.matrix);
  }

  private angleFor(task: GuidanceTask) {
    if (task.axis === 'x') return task.sign > 0 ? 0 : Math.PI;
    if (task.axis === 'y') return task.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    return task.sign > 0 ? Math.PI / 4 : (-3 * Math.PI) / 4;
  }

  update(ctx: GuidanceContext): GuidanceReport {
    // Kette nachruecken, sobald der Flieger eine Rasterweite weiter ist.
    const anchor = chainAnchorZ(ctx.flight.position.z, SPEC);
    if (anchor !== this.anchorZ) {
      this.anchorZ = anchor;
      this.matrix.setPosition(this.offX, this.offY, anchor);
      ctx.field.advanceChain(this.matrix, new THREE.Vector3(0, 0, 0));
    }

    this.origin.schritt(ctx.dt, ctx.flight);
    const raw = axisProgress(ctx.flight, this.task, this.origin);
    const p = this.ratchet.step(raw, ctx.dt);
    ctx.uniforms.progress.value = p;
    ctx.uniforms.recruitDensity.value = 0.35 + this.task.intensity * 0.55;
    return { progress: p, completed: p >= 0.985, event: null };
  }

  end(_reason: 'success' | 'timeout' | 'skip', ctx: GuidanceContext) {
    ctx.field.releaseFormation();
    ctx.uniforms.recruitDensity.value = CONFIG.formation.recruitDensity;
  }
}
