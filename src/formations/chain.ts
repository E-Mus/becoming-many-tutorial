/**
 * Ketten: dieselbe Form mehrfach entlang der Flugachse.
 *
 * WARUM ES DIESE DATEI GIBT. Zwei Regeln des Stuecks bissen sich:
 * Grundgesetz 6 sagt, Formen stehen fest im Raum und sind nicht an die Kamera
 * geheftet. Der Flug laeuft aber auf Schiene mit konstanter Vorwaertsfahrt.
 * Zusammen heisst das: eine einzelne Form 30 m voraus ist nach gut zwei
 * Sekunden durchflogen und hinter einem - waehrend die Eskalation ueber 18
 * Sekunden hochrampt und laengst nichts mehr vorfindet, was sie lauter machen
 * koennte.
 *
 * Die Aufloesung liegt im Bild selbst: man passiert nicht EINEN Baum am
 * Strassenrand, sondern eine Allee. Jede Kopie steht unbeweglich im Raum, aber
 * es steht immer eine vor einem. Grundgesetz 6 bleibt unangetastet.
 *
 * Die Kopien sitzen auf einem festen Weltraster (Vielfache von `spacing`).
 * Faehrt der Flieger eine Rasterweite weiter, rueckt die Kette um genau eine
 * Position nach - die verbleibenden Kopien landen dabei auf exakt denselben
 * Weltkoordinaten wie vorher. Es gibt also keinen Sprung, nur vorne eine neue
 * Kopie und hinten eine, die entlassen wird.
 */

export interface ChainSpec {
  /** Wie viele Kopien gleichzeitig im Raum stehen. */
  copies: number;
  /** Abstand der Kopien in Metern. */
  spacing: number;
  /** Mindestabstand der vordersten Kopie zum Flieger. */
  lead: number;
  /** Slots je Kopie. copies * slotsPerCopy darf maxSlots nicht ueberschreiten. */
  slotsPerCopy: number;
}

/**
 * Eine Punktwolke entlang -Z wiederholen.
 *
 * `s` wird unveraendert uebernommen: alle Kopien zeigen denselben Fortschritt
 * und zehren sich gemeinsam auf. Die Welt wiederholt ihre Aussage, bis man ihr
 * folgt - und wenn man folgt, verschwinden alle Instanzen zugleich.
 */
export function repeatAlongZ(base: Float32Array, copies: number, spacing: number): Float32Array {
  const perCopy = base.length / 4;
  const out = new Float32Array(perCopy * copies * 4);
  for (let c = 0; c < copies; c++) {
    const dz = c * spacing;
    for (let i = 0; i < perCopy; i++) {
      const d = (c * perCopy + i) * 4;
      out[d] = base[i * 4];
      out[d + 1] = base[i * 4 + 1];
      out[d + 2] = base[i * 4 + 2] - dz; // weiter voraus = kleineres z
      out[d + 3] = base[i * 4 + 3];      // s bleibt
    }
  }
  return out;
}

/**
 * Anker der Kette auf dem Weltraster.
 *
 * Liefert das groesste Vielfache von `spacing`, das mindestens `lead` Meter vor
 * dem Flieger liegt. Weil der Wert nur in Rasterschritten springt, stehen die
 * Kopien immer an denselben Weltkoordinaten.
 */
export function chainAnchorZ(flightZ: number, spec: ChainSpec): number {
  return Math.floor((flightZ - spec.lead) / spec.spacing) * spec.spacing;
}
