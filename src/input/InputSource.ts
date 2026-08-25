/**
 * Die einzige Schnittstelle, die das Flugmodell kennt.
 *
 * Der echte Icaros steuert ueber Roll (seitlich) und Pitch (vertikal) - das
 * mappt 1:1 auf {lateral, vertical}. Deshalb kostet der Wechsel von der
 * Tastatur auf das Geraet oberhalb dieser Schicht keine einzige Zeile.
 */
export interface FlightInput {
  /** -1 = links, +1 = rechts */
  lateral: number;
  /** -1 = runter, +1 = hoch */
  vertical: number;
}

export interface InputSource {
  readonly id: string;
  /** true, solange diese Quelle Signal ueber ihrer Totzone liefert */
  readonly active: boolean;
  connect(): void;
  read(dt: number): FlightInput;
  disconnect(): void;
}
