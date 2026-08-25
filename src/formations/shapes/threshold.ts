import { bestCandidate2D, makeRng } from '../sampling';

/**
 * Eine Schwelle: dichter Vorhang quer zum Flug, mit einem pfeilfoermigen LOCH.
 *
 * FIGUR UND GRUND VERTAUSCHT. Bisher wurde immer Dichte hinzugefuegt, und das
 * scheiterte zweimal an derselben Wand: eine Form aus Punkten muss gegen den
 * ambienten Staub anlesen, und je mehr Staub da ist, desto schwerer faellt das.
 * Ein LOCH dagegen wird umso lesbarer, je dichter die Umgebung ist - und es
 * passt zum Grundgedanken des Stuecks: die Welt fuegt kein Zeichen hinzu, sie
 * haelt sich in einer Form zurueck.
 *
 * Der Vorhang ist bewusst klein (etwa 18 x 13 m). Eine bildfuellende Flaeche
 * kaeme auf wenige Punkte je Quadratmeter und waere unsichtbar; erst die
 * Beschraenkung macht ihn dicht genug, dass das Loch als Loch liest.
 *
 * DIE FORTSCHRITTSACHSE: s = normierte Koordinate entlang der Zeigerichtung.
 * Mit dissolveDir +1 frisst sich der Vorhang in die Richtung auf, in die der
 * Pfeil zeigt - die Oeffnung waechst also zur Zielseite hin, bis dort nichts
 * mehr im Weg steht.
 */
export function makeThreshold(
  slotCount: number,
  width: number,
  height: number,
  arrowLen: number,
): Float32Array {
  const rng = makeRng(0x5c8e);

  // Pfeil-Silhouette, kanonisch nach +X, um den Ursprung zentriert.
  const L = arrowLen;
  const schaftHalb = L * 0.1;
  const kopfLang = L * 0.34;
  const kopfHalb = L * 0.26;
  const schaftEnde = L - kopfLang;

  const imPfeil = (x: number, y: number) => {
    const lx = x + L / 2; // zurueck in die kanonische 0..L-Lage
    if (lx < 0 || lx > L) return false;
    if (lx <= schaftEnde) return Math.abs(y) <= schaftHalb;
    const t = (lx - schaftEnde) / kopfLang;
    return Math.abs(y) <= kopfHalb * (1 - t);
  };

  const pts = bestCandidate2D(
    slotCount,
    { x0: -width / 2, y0: -height / 2, x1: width / 2, y1: height / 2 },
    (x, y) => !imPfeil(x, y),
    rng,
  );

  const out = new Float32Array(slotCount * 4);
  for (let i = 0; i < slotCount; i++) {
    const x = pts[i * 2];
    const y = pts[i * 2 + 1];
    out[i * 4] = x;
    out[i * 4 + 1] = y;
    // Duenne Platte: die Schwelle ist eine Flaeche, kein Volumen.
    out[i * 4 + 2] = (rng() - 0.5) * 0.5;
    out[i * 4 + 3] = (x + width / 2) / width; // s entlang der Zeigerichtung
  }
  return out;
}
