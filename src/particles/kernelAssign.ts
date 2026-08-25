import { Fn, If, float, hash, instanceIndex, time, uint, vec4 } from 'three/tsl';
import type { Buffers } from './buffers';
import type { Uniforms } from '../core/Uniforms';
import { ambientHome } from './tsl/ambient';

/** Wie viele Slots ein Partikel probiert, bevor es den naechsten nimmt. */
const TRIES = 6;

/**
 * Wer schliesst sich der Form an?
 *
 * Jedes Partikel probiert TRIES zufaellige Slots aus dem freigegebenen Bereich
 * und behaelt den naechsten. Liegt der innerhalb von recruitFar, schliesst es
 * sich an.
 *
 * Zwei Betriebsarten, gesteuert ueber assignLo/assignHi/assignOnlyFree:
 *  - Neue Formation: der ganze Slotbereich, alle Partikel werden neu verteilt.
 *  - Kette rueckt nach: nur der Slotbereich der neu hinzugekommenen Kopie, und
 *    nur freie Partikel. Wer schon in der Kette steht, wird nicht angetastet -
 *    sonst setzt sich die ganze Allee jedes Mal neu zusammen. Den Indexversatz
 *    der Bestandspartikel erledigt vorher kernelShift.
 *
 * WARUM NICHT `instanceIndex % slotCount`: das war der erste Entwurf und er
 * war falsch. Er koppelt jeden Slot an genau N/M bestimmte Partikel - und die
 * liegen zufaellig in der ganzen Box verteilt. Bei 0.23 Partikeln/m³ und einem
 * Suchradius von 9 m trifft das in 1.75 % der Faelle. Gemessen haben sich
 * daraufhin 89 von 200 000 Partikeln einer Form angeschlossen; sichtbar war
 * nichts. Dabei liegen rund 700 Partikel in Reichweite jedes Slots - es fehlte
 * nie an Staub, nur an der Erlaubnis, den nahen zu nehmen.
 *
 * GRUNDGESETZ 2 (Lokalitaet) bleibt gewahrt: recruitFar liegt in der
 * Groessenordnung der Form selbst. Ein Partikel, das 12 m weit zu einem 10 m
 * langen Pfeil wandert, kommt aus dessen eigener Nachbarschaft. Daraus folgt
 * weiterhin Grundgesetz 3: die Leere ringsum duennt sichtbar aus.
 */
export function buildAssignKernel(b: Buffers, u: Uniforms, count: number) {
  return Fn(() => {
    const i = instanceIndex;
    const meta = b.meta.element(i);
    const home = b.home.element(i);
    const pos = b.pos.element(i);

    // Rueckt die Kette nach, duerfen nur freie Partikel geworben werden.
    const istFrei = meta.x.lessThanEqual(float(0.5));
    const darfWerben = u.assignOnlyFree.lessThan(float(0.5)).or(istFrei);

    If(darfWerben, () => {
      const ambient = ambientHome(
        home.xyz, u.flyerPos, u.boxSize, time,
        u.noiseScale, u.noiseSpeed, u.driftAmp,
      );

      // Naechsten aus mehreren Versuchen behalten.
      const bestD = float(1e9).toVar();
      const bestJ = float(0).toVar();
      const spanne = u.assignHi.sub(u.assignLo);

      // Auch hier ohne Multiplikation des Index - siehe kernelInit: hash(i*k+c)
      // ist auf der GPU nicht gleichverteilt, hash(i+c) schon. Bei der
      // Slot-Ziehung hiess das, dass die sechs Versuche eines Partikels
      // systematisch in denselben Ecken der Slotliste landeten.
      for (let k = 0; k < TRIES; k++) {
        const j = u.assignLo.add(
          hash(i.add(uint(k * 40_960_001 + 7)).add(u.formationSeed)).mul(spanne),
        ).floor();
        const slot = b.slots.element(uint(j));
        const target = u.formationMatrix.mul(vec4(slot.xyz, 1.0)).xyz;
        const d = ambient.distance(target);
        If(d.lessThan(bestD), () => {
          bestD.assign(d);
          bestJ.assign(j);
        });
      }

      // Zugehoerigkeit ist BINAER. Ein weicher Uebergang klingt vernuenftig
      // ("wie stark gehoert es dazu"), ergibt aber Partikel, die zu 30 %
      // gebunden auf halbem Weg zwischen Heimat und Slot haengen bleiben - und
      // damit einen Schleier statt einer Silhouette. Entweder ein Partikel
      // wird Teil der Form, oder es bleibt Staub.
      const near = bestD.lessThan(u.recruitFar).select(float(1), float(0));

      // Dichte-Lotterie: die Form soll die Leere nicht restlos verschlucken.
      const lot = hash(i.add(u.formationSeed).add(1013))
        .lessThan(u.recruitDensity).select(float(1), float(0));

      // Nur RUHENDER Staub. Wer noch weit von seiner Heimat weg steht, ist eben
      // erst entlassen worden und gehoert noch zur vorigen Form - wuerde er
      // sofort wieder geworben, floege er quer durchs Bild von der alten zur
      // neuen. Geworben wird, was im Umfeld liegt, nicht was gerade frei wurde.
      const daheim = pos.xyz.distance(ambient).lessThan(u.heimSchwelle)
        .select(float(1), float(0));

      // Und nur Staub AUSSERHALB DER SICHTWEITE (werbeFernAb; 0 hebt die Regel
      // auf, der Begleiter braucht sie nicht).
      //
      // Eine Bank entsteht 68 m voraus und wirbt im Umkreis von 45 m - das
      // reicht bis 23 m vor den Flieger zurueck. Gemessen flogen dadurch 1400
      // Partikel je Neuplatzierung 30 bis 45 m weit heran, mitten durchs Bild.
      // Genau das sah man als "die Pfeile werden komisch generiert".
      //
      // Nebenwirkung, und die ist der eigentliche Gewinn: der vorige Pfeil und
      // alles, was er entlassen hat, liegt naeher als die Sichtweite und ist
      // damit automatisch ausgeschlossen. Ein neuer Pfeil kann gar nicht mehr
      // aus den Partikeln des alten bestehen.
      const draussen = pos.xyz.distance(u.flyerPos).greaterThan(u.werbeFernAb)
        .select(float(1), float(0));

      meta.assign(vec4(
        near.mul(lot).mul(daheim).mul(draussen),
        bestJ,
        hash(i.add(u.formationSeed).add(31)), // Versatz des BEWEGUNGSBEGINNS
        u.formationAge,                       // eigene Erscheinungszeit
      ));
    });
  })().compute(count);
}
