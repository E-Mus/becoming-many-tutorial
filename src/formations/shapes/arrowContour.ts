import { makeRng } from '../sampling';

/**
 * Ein Pfeil als KONTUR - Schaft und zwei Widerhaken, ein Strichzug.
 *
 * WARUM NICHT MEHR GEFUELLT. Das ist der Fehler, an dem jeder bisherige Pfeil
 * scheiterte, und er hat nichts mit der Partikelzahl zu tun. Nachgerechnet mit
 * den GEMESSENEN Bindungszahlen (2394 Partikel, 22 m Pfeil, aus 39 m gesehen):
 *
 *   gefuellt   115 m² Flaeche   Punktabstand 21.9 cm = 0.32 Grad
 *                               Punktgroesse       0.16 Grad
 *                               -> Deckung 20 %  = grauer Nebel
 *
 *   Kontur     33 m Bogen       Punktabstand  1.4 cm = 0.02 Grad
 *                               -> Deckung weit ueber 100 %  = satte Linie
 *
 * Faktor 252, bei identischer Partikelzahl. Der Unterschied ist allein, ob die
 * Punkte auf einer Flaeche oder auf einer Linie liegen. Eine Flaeche verteilt
 * sie ins Nichts; eine Linie buendelt sie.
 *
 * Das Zahlenverhaeltnis Form zu Staub war nie die richtige Messgroesse - der
 * Deckungsgrad auf der eigenen Fussflaeche ist es.
 *
 * PROPORTIONEN: die Widerhaken reichen bis 0.4L in der Hoehe, bei 0.5L halber
 * Laenge. Das Verhaeltnis 0.8 haelt Abstand zur Crowding-Grenze; die frueheren
 * schlanken 0.52 lagen genau darauf und fielen in der Peripherie aus - und das
 * ist skaleninvariant, Naeherkommen half also nicht.
 *
 * DIE FORTSCHRITTSACHSE: s = normierte Koordinate entlang der Zeigerichtung,
 * also ueber den ganzen Pfeil hinweg, Widerhaken eingeschlossen. Die
 * Wellenfront wischt damit sauber von hinten nach vorn durch das Zeichen.
 */
export function makeArrowContour(slotCount: number, L: number): Float32Array {
  const rng = makeRng(0xc0f2);

  // Schaftende, Knick, Spitze - in Vielfachen von L, um den Ursprung zentriert.
  const schaftA = [-0.5 * L, 0];
  const schaftB = [0.2167 * L, 0];
  const spitze = [0.5 * L, 0];
  const hakenOben = [0.1667 * L, 0.4 * L];
  const hakenUnten = [0.1667 * L, -0.4 * L];

  const strecken: Array<[number[], number[]]> = [
    [schaftA, schaftB],
    [spitze, hakenOben],
    [spitze, hakenUnten],
  ];
  const laengen = strecken.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
  const gesamt = laengen.reduce((s, l) => s + l, 0);

  const out = new Float32Array(slotCount * 4);
  let i = 0;
  for (let k = 0; k < strecken.length && i < slotCount; k++) {
    const [a, b] = strecken[k];
    // Punkte proportional zur Laenge verteilen, aequidistant auf der Strecke.
    const n = k === strecken.length - 1
      ? slotCount - i
      : Math.round((laengen[k] / gesamt) * slotCount);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = laengen[k];
    // Senkrechte fuer die Strichdicke.
    const px = -dy / len, py = dx / len;

    for (let j = 0; j < n && i < slotCount; j++, i++) {
      const t = n > 1 ? j / (n - 1) : 0.5;
      // Winziger Versatz laengs, damit die Linie nicht wie ein Lineal wirkt.
      const tj = Math.min(1, Math.max(0, t + (rng() - 0.5) * (1 / Math.max(n, 1))));
      const x = a[0] + dx * tj;
      const y = a[1] + dy * tj;
      // Strichdicke: gerade so viel, dass die Linie Koerper hat.
      const d = (rng() - 0.5) * 0.1;

      out[i * 4] = x + px * d;
      out[i * 4 + 1] = y + py * d;
      out[i * 4 + 2] = (rng() - 0.5) * 0.1;
      out[i * 4 + 3] = (x + L / 2) / L; // s entlang der Zeigerichtung
    }
  }
  return out;
}
