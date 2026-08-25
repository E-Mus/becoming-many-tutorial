import { makeRng } from '../sampling';

/**
 * Ein Torus in der XY-Ebene, zu durchfliegen entlang Z.
 *
 * DIE FORTSCHRITTSACHSE: s = theta/2pi. Mit dissolveDir -1 zeichnet sich der
 * Ring zu, je zentrierter man ihn anfliegt - wie eine Fortschrittsanzeige, die
 * niemand als Anzeige erkennt.
 */
export function makeRing(slotCount: number, radius: number, tube: number): Float32Array {
  const rng = makeRng(0x21c0);
  const out = new Float32Array(slotCount * 4);
  for (let i = 0; i < slotCount; i++) {
    // Gleichverteilung ueber den Umfang: stratifiziert statt rein zufaellig,
    // sonst klumpt der Ring sichtbar.
    const theta = ((i + rng()) / slotCount) * Math.PI * 2;
    const phi = rng() * Math.PI * 2;
    // Wurzel fuer flaechentreue Verteilung im Roehrenquerschnitt.
    const r = tube * Math.sqrt(rng());
    const cx = Math.cos(theta), cy = Math.sin(theta);
    out[i * 4] = cx * (radius + r * Math.cos(phi));
    out[i * 4 + 1] = cy * (radius + r * Math.cos(phi));
    out[i * 4 + 2] = r * Math.sin(phi);
    out[i * 4 + 3] = theta / (Math.PI * 2); // s
  }
  return out;
}
