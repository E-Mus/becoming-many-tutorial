import type { FlightInput, InputSource } from './InputSource';

/**
 * Fragt alle Quellen ab und nimmt die, die gerade Signal liefert.
 * Ein Gamepad mitten in der Sitzung einzustecken funktioniert damit einfach.
 */
export class CompositeInput implements InputSource {
  readonly id = 'composite';
  private lastActive: string = 'none';

  constructor(private readonly sources: InputSource[]) {}

  connect() { for (const s of this.sources) s.connect(); }
  disconnect() { for (const s of this.sources) s.disconnect(); }

  get active() { return this.sources.some((s) => s.active); }
  get activeId() { return this.lastActive; }

  read(dt: number): FlightInput {
    let out: FlightInput = { lateral: 0, vertical: 0 };
    let best = 0;
    for (const s of this.sources) {
      const v = s.read(dt);
      const mag = Math.abs(v.lateral) + Math.abs(v.vertical);
      if (mag > best) {
        best = mag;
        out = v;
        this.lastActive = s.id;
      }
    }
    if (best === 0) this.lastActive = 'none';
    return out;
  }
}
