// ---------------------------------------------------------------------------
// TSL-MERKZETTEL (gilt fuer alle Dateien in diesem Ordner):
//   mix(a, b, t)          ===  t.mix(a, b)        <- Empfaenger ist der FAKTOR
//   smoothstep(lo, hi, x) ===  x.smoothstep(lo, hi)
//   .mod() ist WGSL '%' (truncated), NICHT GLSL mod (floored)
// Bei drei Argumenten immer die Funktionsform benutzen. Zuweisung per .assign().
// ---------------------------------------------------------------------------
import { Fn } from 'three/tsl';

/**
 * Echtes gefloortes Modulo — Ergebnis liegt immer in [0, m).
 *
 * NICHT .mod() zum Wrappen benutzen: WGSL '%' folgt dem Vorzeichen des
 * Dividenden. Der Flieger hat negative Koordinaten, sobald er losfliegt, und
 * das Feld klappt damit nach innen um.
 */
export const floorMod = Fn(([x, m]: [any, any]) => {
  return x.sub(m.mul(x.div(m).floor()));
});
