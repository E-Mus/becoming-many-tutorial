// ---------------------------------------------------------------------------
// TSL-MERKZETTEL:
//   mix(a, b, t)          ===  t.mix(a, b)        <- Empfaenger ist der FAKTOR
//   smoothstep(lo, hi, x) ===  x.smoothstep(lo, hi)
//   .mod() ist WGSL '%' (truncated), NICHT GLSL mod (floored)
// ---------------------------------------------------------------------------
import { Fn, clamp, float, max } from 'three/tsl';

/**
 * Strichzug-Anziehung: der Staub rastet seitlich auf eine Linie im Raum ein.
 *
 * WARUM DAS DIE INTERESSANTERE BINDUNG IST. Die Ketten aus Punktwolken hatten
 * einen strukturellen Nachteil: eine Form ist ein Ding an einem Ort, also muss
 * bei stetiger Vorwaertsfahrt staendig ein neues Ding entstehen. Ein Strichzug
 * dagegen ist ein Raumbereich. Er kann mitwandern, waehrend die Partikel
 * stehen bleiben - wie eine Welle durchs Wasser laeuft, ohne das Wasser
 * mitzunehmen. Jedes Partikel rueckt nur seitwaerts in die Linie und wird
 * hinten wieder in die Welt entlassen. Nichts entsteht, nichts vergeht.
 *
 * Und fuer ein Medium aus einzelnen Punkten liest sich ein STRICH ohnehin
 * besser als eine gefuellte Flaeche: die 46-x-32-m-Wand kam auf 3 Partikel je
 * Quadratmeter und war unsichtbar, waehrend ein Strich alles auf seiner Laenge
 * buendelt.
 */

/** Naechster Punkt auf der Strecke a-b zu p. */
export const nearestOnSegment = Fn(([p, a, b]: [any, any, any]) => {
  const ab = b.sub(a);
  const t = clamp(
    p.sub(a).dot(ab).div(max(ab.dot(ab), float(1e-6))),
    float(0),
    float(1),
  );
  return a.add(ab.mul(t));
});
