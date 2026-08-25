import type { Uniforms } from '../core/Uniforms';
import type { Director } from '../tutorial/Director';
import { MODE_ORDER, MODE_LABELS, ARROW_VARIANTS } from '../guidance/registry';

/**
 * Entwicklungsanzeige. Im fertigen Stueck gibt es KEINE Einblendung - der
 * Raum spricht allein. Das hier existiert nur, um ihn stimmen zu koennen.
 *
 * dissolveWidth und dissolveJitter liegen bewusst ab Tag eins auf Reglern: ob
 * die Aufloesung als "verbraucht" oder nur als "verblasst" liest, entscheidet
 * ueber das ganze Konzept, und das laesst sich nur mit dem Auge finden.
 */
export class DevPanel {
  private el: HTMLDivElement;
  private info: HTMLDivElement;

  constructor(private readonly u: Uniforms, private readonly director: Director) {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:fixed', 'left:12px', 'top:12px', 'z-index:10',
      'font:11px/1.5 ui-monospace,Consolas,monospace', 'color:#111',
      'background:rgba(255,255,255,.82)', 'border:1px solid rgba(0,0,0,.14)',
      'padding:10px 12px', 'border-radius:6px', 'min-width:245px',
      'backdrop-filter:blur(6px)', 'user-select:none',
    ].join(';');

    this.info = document.createElement('div');
    this.el.appendChild(this.info);

    this.slider('dissolveWidth', 0.01, 0.35, 0.005);
    this.slider('dissolveJitter', 0, 0.3, 0.005);
    this.slider('recruitDensity', 0.02, 1, 0.02);
    this.slider('recruitFar', 3, 30, 0.5);
    this.slider('dotSize', 0.01, 0.2, 0.005);
    this.slider('bowStrength', 0, 10, 0.1);
    this.slider('fieldDensity', 0, 1, 0.02);

    const hint = document.createElement('div');
    hint.style.cssText = 'margin-top:8px;opacity:.65;line-height:1.6';
    hint.innerHTML =
      '<b>1</b> Fern &nbsp; <b>2</b> Begleiter<br>' +
      'WASD fliegen &middot; <b>P</b> Fortschritt einfrieren';
    this.el.appendChild(hint);

    document.body.appendChild(this.el);
  }

  private slider(key: keyof Uniforms, min: number, max: number, step: number) {
    const uni = this.u[key] as unknown as { value: number };
    if (typeof uni?.value !== 'number') return;

    const row = document.createElement('label');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:3px';
    const name = document.createElement('span');
    name.style.cssText = 'flex:0 0 108px;opacity:.75';
    name.textContent = key;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min); input.max = String(max); input.step = String(step);
    input.value = String(uni.value);
    input.style.cssText = 'flex:1;min-width:0';
    const out = document.createElement('span');
    out.style.cssText = 'flex:0 0 40px;text-align:right;font-variant-numeric:tabular-nums';
    out.textContent = uni.value.toFixed(3);
    input.addEventListener('input', () => {
      uni.value = Number(input.value);
      out.textContent = uni.value.toFixed(3);
    });
    // Sonst behaelt der Regler den Fokus und schluckt danach die Pfeiltasten,
    // mit denen geflogen wird.
    input.addEventListener('change', () => input.blur());
    input.addEventListener('pointerup', () => input.blur());
    row.append(name, input, out);
    this.el.appendChild(row);
  }

  update(fps: number) {
    const b = this.director.currentBeat;
    const label = MODE_LABELS[this.director.currentModeId];
    const nr = MODE_ORDER.indexOf(this.director.currentModeId) + 1;

    // Ob gerade eine Form im Raum steht, muss ablesbar sein. Sonst wirkt ein
    // Sprachwechsel waehrend einer Atempause wie ein kaputter Schalter.
    const form = this.director.hasTask
      ? '<b>steht</b>'
      : '<span style="color:#a33">keine (Atempause)</span>';

    this.info.innerHTML = [
      '<b>Becoming Many Tutorial</b> &nbsp; ' + fps.toFixed(0) + ' fps',
      'Variante &nbsp; <b>' + label + '</b> <span style="opacity:.5">' + nr +
        (nr <= ARROW_VARIANTS ? '/' + ARROW_VARIANTS : '') + '</span>',
      'Beat &nbsp; <b>' + (b?.id ?? '—') + '</b> &nbsp; Form ' + form,
      'progress ' + this.u.progress.value.toFixed(2) +
        ' &nbsp; intensity ' + this.director.intensity.toFixed(2),
    ].join('<br>');
  }
}
