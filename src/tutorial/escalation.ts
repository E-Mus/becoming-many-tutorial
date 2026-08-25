import { CONFIG } from '../config';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Wie laut das Stueck wird, wenn nichts passiert.
 *
 * "Laut" heisst ausschliesslich: das ZEICHEN wird deutlicher - dichter, groesser,
 * bestimmter. Der Raum selbst tut nichts. Es gab hier einmal zwei weitere
 * Stufen, die ueber das Zeichen hinausgingen: ab intensity 0.6 lehnte sich das
 * Feld in die geforderte Richtung (Sog), ab 0.9 steuerte eine Assistenz mit.
 * Beide sind raus. Was passiert, passiert, weil die Fliegende es tut.
 *
 * @param stalled Sekunden ohne Fortschritt
 * @returns 0 = Fluestern, 1 = unuebersehbar
 *
 * Die ersten Sekunden bleiben absichtlich still: wer gerade erst angekommen
 * ist, soll selbst bemerken duerfen. Das Nichtstun ist Inhalt.
 */
export function intensityFor(stalled: number): number {
  const s = CONFIG.tutorial.silence;
  if (stalled < s) return 0;
  if (stalled < s + 4) return lerp(0.0, 0.4, (stalled - s) / 4);
  if (stalled < s + 9) return lerp(0.4, 0.75, (stalled - s - 4) / 5);
  if (stalled < s + 15) return lerp(0.75, 1.0, (stalled - s - 9) / 6);
  return 1;
}

