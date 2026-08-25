import { Fn, If, float, instanceIndex } from 'three/tsl';
import type { Buffers } from './buffers';
import type { Uniforms } from '../core/Uniforms';

/**
 * Kette um eine Position nachruecken, OHNE die Partikel neu zu verteilen.
 *
 * WARUM ES DIESEN KERNEL GIBT. Zuerst lief beim Nachruecken einfach der
 * Assign-Kernel erneut. Der wuerfelt aber fuer jedes Partikel neue Slots aus -
 * und weil die Formationsmatrix sich zugleich verschoben hatte, landete jedes
 * Partikel woanders. Die ganze Allee setzte sich damit etwa einmal pro Sekunde
 * komplett neu zusammen: sie pulsierte und zersprang staendig.
 *
 * Die Loesung folgt aus der Geometrie der Kette. Kopie c liegt lokal bei
 * z = -c*spacing, die Matrix steht beim Anker A. Ein Partikel in Kopie c steht
 * also bei A - c*spacing. Rueckt der Anker auf A - spacing, dann liegt genau
 * diese Weltposition jetzt bei Kopie c-1. Es genuegt also, den Slot-Index um
 * eine Kopie zu verringern - das Partikel bleibt dabei buchstaeblich stehen.
 *
 * Wer dabei unter Kopie 0 faellt, ist hinten aus der Kette herausgefallen und
 * wird entlassen. Fuer die vorne neu hinzugekommene Kopie wirbt anschliessend
 * der Assign-Kernel, beschraenkt auf deren Slotbereich und auf freie Partikel.
 */
export function buildShiftKernel(b: Buffers, u: Uniforms, count: number) {
  return Fn(() => {
    const meta = b.meta.element(instanceIndex);
    If(meta.x.greaterThan(0.5), () => {
      const neu = meta.y.sub(u.slotsPerCopy);
      If(neu.lessThan(float(0)), () => {
        meta.x.assign(float(0)); // hinten herausgefallen - zurueck in die Welt
      }).Else(() => {
        meta.y.assign(neu); // steht weiter an derselben Weltposition
      });
    });
  })().compute(count);
}
