import { bestCandidate2D, makeRng } from '../sampling';

/**
 * Ein Pfeil, kanonisch nach +X zeigend (die Platzierung dreht ihn spaeter).
 *
 * DIE FORTSCHRITTSACHSE: s = normierte Koordinate entlang +X. Mit dissolveDir
 * +1 frisst sich der Pfeil damit genau in die Richtung auf, in die er zeigt -
 * das ist die Idee, aus der das ganze Stueck folgt.
 *
 * @param length Gesamtlaenge in Metern
 */
export function makeArrow(slotCount: number, length: number): Float32Array {
  const rng = makeRng(0xa77014);
  const L = length;
  const shaftHalf = L * 0.11;   // halbe Schafthoehe
  const headLen = L * 0.34;     // Laenge der Spitze
  const headHalf = L * 0.27;    // halbe Basisbreite der Spitze
  const shaftEnd = L - headLen;

  const inside = (x: number, y: number) => {
    if (x < 0 || x > L) return false;
    if (x <= shaftEnd) return Math.abs(y) <= shaftHalf;
    const t = (x - shaftEnd) / headLen;      // 0 an der Basis, 1 an der Spitze
    return Math.abs(y) <= headHalf * (1 - t);
  };

  const pts = bestCandidate2D(
    slotCount,
    { x0: 0, y0: -headHalf, x1: L, y1: headHalf },
    inside, rng,
  );

  const out = new Float32Array(slotCount * 4);
  for (let i = 0; i < slotCount; i++) {
    const x = pts[i * 2];
    const y = pts[i * 2 + 1];
    // Leichte Tiefe, damit der Pfeil auch schraeg von der Seite Koerper hat -
    // er ist ein Ding im Raum, kein Aufkleber.
    const z = (rng() - 0.5) * L * 0.06;
    out[i * 4] = x - L * 0.5;
    out[i * 4 + 1] = y;
    out[i * 4 + 2] = z;
    out[i * 4 + 3] = x / L; // s
  }
  return out;
}
