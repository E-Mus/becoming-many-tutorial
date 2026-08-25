import { bestCandidate2D, makeRng } from '../sampling';

/**
 * Eine dichte Wand quer durch den Korridor, mit genau einer Oeffnung.
 *
 * Die Oeffnung liegt im lokalen URSPRUNG, die Wand ist um sie herum zentriert.
 * Platziert wird ueber die Formationsmatrix - so ist derselbe Punktwolken-Cache
 * fuer jede Lage der Oeffnung brauchbar, und eine Kette aus mehreren Waenden
 * (siehe formations/chain.ts) faedelt sich sauber auf.
 *
 * DIE FORTSCHRITTSACHSE: s = normierter Abstand nach aussen vom Rand der
 * Oeffnung. Mit dissolveDir +1 frisst steigender Fortschritt die Wand vom Loch
 * nach aussen weg - die Oeffnung WEITET sich, waehrend man sie anfliegt. Der
 * Weg wird zur Architektur statt zum Symbol.
 */
export function makeWall(
  slotCount: number,
  width: number,
  height: number,
  holeR: number,
): Float32Array {
  const rng = makeRng(0x3a11);
  const feather = Math.max(width, height) * 0.45;

  const inside = (x: number, y: number) => Math.hypot(x, y) > holeR;

  const pts = bestCandidate2D(
    slotCount,
    { x0: -width / 2, y0: -height / 2, x1: width / 2, y1: height / 2 },
    inside, rng,
  );

  const out = new Float32Array(slotCount * 4);
  for (let i = 0; i < slotCount; i++) {
    const x = pts[i * 2];
    const y = pts[i * 2 + 1];
    const d = Math.hypot(x, y) - holeR;
    out[i * 4] = x;
    out[i * 4 + 1] = y;
    out[i * 4 + 2] = (rng() - 0.5) * 0.6;
    out[i * 4 + 3] = Math.min(1, Math.max(0, d / feather)); // s
  }
  return out;
}
