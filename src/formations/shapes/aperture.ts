import { makeRng } from '../sampling';

/**
 * Eine Blende: ein breiter, koerniger Ring um eine Oeffnung.
 *
 * WARUM KEINE WAND MEHR. Der erste Entwurf war eine 46 x 32 m grosse Wand quer
 * durch den Korridor. Gemessen verteilten sich darauf 4 822 Partikel - also
 * 3,3 pro Quadratmeter, waehrend ein Pfeil auf 133 kommt. Die Wand war zwar da,
 * aber von ambientem Staub nicht zu unterscheiden. Eine bildfuellende Flaeche
 * braucht Zehntausende Punkte; die gibt der Partikelhaushalt nicht her.
 *
 * Also andersherum: alle Partikel dorthin, wo die Information sitzt - an den
 * Rand der Oeffnung. Nach aussen duennt es aus und laeuft weich ins Nichts. Das
 * liest sich als "hier geht es durch" statt als "hier ist eine Wand", und das
 * ist ohnehin die Aussage.
 *
 * DIE FORTSCHRITTSACHSE: s = normierter Abstand nach aussen vom Oeffnungsrand.
 * Mit dissolveDir +1 frisst steigender Fortschritt die Blende vom Loch nach
 * aussen weg - die Oeffnung WEITET sich, waehrend man sie anfliegt.
 *
 * Die Oeffnung liegt im lokalen Ursprung; platziert wird ueber die Matrix.
 *
 * @param holeR Radius der Oeffnung
 * @param band  Breite des Rings nach aussen
 */
export function makeAperture(slotCount: number, holeR: number, band: number): Float32Array {
  const rng = makeRng(0x3a11);
  const out = new Float32Array(slotCount * 4);

  for (let i = 0; i < slotCount; i++) {
    // Exponent > 1 zieht die Punkte zum Rand der Oeffnung hin zusammen: dort
    // entscheidet sich, wo es durchgeht.
    const t = Math.pow(rng(), 1.8);
    const r = holeR + t * band;
    const th = rng() * Math.PI * 2;

    out[i * 4] = Math.cos(th) * r;
    out[i * 4 + 1] = Math.sin(th) * r;
    // Etwas Tiefe, damit die Blende auch schraeg angeflogen Koerper hat.
    out[i * 4 + 2] = (rng() - 0.5) * 0.9;
    out[i * 4 + 3] = t; // s
  }
  return out;
}
