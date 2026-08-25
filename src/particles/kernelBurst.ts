import { Fn, If, float, instanceIndex, vec4 } from 'three/tsl';
import type { Buffers } from './buffers';
import type { Uniforms } from '../core/Uniforms';

/**
 * Bindung loesen - wahlweise nur fuer einen Slotbereich.
 *
 * Der Bereich kommt aus assignLo/assignHi. Fuer "alles loesen" setzt man ihn
 * auf den ganzen Buffer. Der Bereich wird gebraucht, seit zwei Baenke
 * unabhaengig voneinander im Raum stehen: wer eine Bank erneuert, darf die
 * andere nicht mit anfassen.
 *
 * Der eigentliche Impuls der Erfolgs-Druckwelle sitzt im Update-Kernel und
 * wirkt ueber burstOrigin/burstStrength, damit er ueber mehrere Frames traegt.
 */
export function buildReleaseKernel(b: Buffers, u: Uniforms, count: number) {
  return Fn(() => {
    const meta = b.meta.element(instanceIndex);
    If(meta.y.greaterThanEqual(u.assignLo).and(meta.y.lessThan(u.assignHi)), () => {
      meta.assign(vec4(float(0), meta.y, meta.z, meta.w));
    });
  })().compute(count);
}
