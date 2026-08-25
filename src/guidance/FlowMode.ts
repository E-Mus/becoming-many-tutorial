import { CONFIG } from '../config';
import type { GuidanceContext, GuidanceMode, GuidanceReport, GuidanceTask } from './GuidanceMode';
import { axisProgress, Bezugsbahn, Ratchet } from './progress';

/**
 * Der Sog. Kein Symbol, nur der Raum selbst.
 *
 * Laedt keine Slots: die Stroemung steckt als Term im Update-Kernel und benutzt
 * DIESELBE Dissolve-Funktion wie alle anderen Modi - sie beruhigt sich stromauf
 * nach stromab, waehrend man ihr folgt. Die eleganteste der vier Sprachen und
 * zugleich die leiseste; manche folgen ihr nicht von allein.
 */
export class FlowMode implements GuidanceMode {
  readonly id = 'flow' as const;
  readonly label = 'Sog';
  private task!: GuidanceTask;
  private origin = new Bezugsbahn();
  private ratchet = new Ratchet();

  begin(task: GuidanceTask, ctx: GuidanceContext) {
    this.task = task;
    this.origin.beginne(ctx.flight);
    this.ratchet.reset();

    const dx = task.axis === 'y' ? 0 : task.sign;
    const dy = task.axis === 'x' ? 0 : task.sign;
    const len = Math.hypot(dx, dy) || 1;
    ctx.uniforms.flowDir.value.set(dx / len, dy / len, 0);
    ctx.uniforms.flowAxisOrigin.value = -task.distanceAhead;
    ctx.uniforms.flowAxisLength.value = 90;
    ctx.uniforms.progress.value = 0;
    ctx.uniforms.dissolveDir.value = 1;
    // Keine Formation - der Staub bleibt Staub und lehnt sich nur.
    ctx.uniforms.formationOn.value = 0;
  }

  update(ctx: GuidanceContext): GuidanceReport {
    this.origin.schritt(ctx.dt, ctx.flight);
    const raw = axisProgress(ctx.flight, this.task, this.origin);
    const p = this.ratchet.step(raw, ctx.dt);
    ctx.uniforms.progress.value = p;
    // Beschleunigung in m/s². Gegen die Daempfung (~1.8/s) stellt sich daraus
    // eine seitliche Drift von rund flowStrength/1.8 m/s ein - bei 6 also gut
    // 3 m/s, deutlich sichtbar als ziehender Staub.
    ctx.uniforms.flowStrength.value = 6 + this.task.intensity * 6;
    return { progress: p, completed: p >= 0.985, event: null };
  }

  end(_reason: 'success' | 'timeout' | 'skip', ctx: GuidanceContext) {
    ctx.uniforms.flowStrength.value = 0;
    ctx.uniforms.recruitDensity.value = CONFIG.formation.recruitDensity;
  }
}
