import type { FlightInput, InputSource } from './InputSource';

/** Linker Stick. Totzone gegen Drift billiger Sticks. */
export class GamepadInput implements InputSource {
  readonly id = 'gamepad';
  private last: FlightInput = { lateral: 0, vertical: 0 };
  private readonly deadzone = 0.12;

  connect() {}
  disconnect() {}

  get active() {
    return Math.abs(this.last.lateral) > 0.01 || Math.abs(this.last.vertical) > 0.01;
  }

  read(): FlightInput {
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      if (!pad) continue;
      const dz = (v: number) => (Math.abs(v) < this.deadzone ? 0 : (v - Math.sign(v) * this.deadzone) / (1 - this.deadzone));
      this.last = { lateral: dz(pad.axes[0] ?? 0), vertical: -dz(pad.axes[1] ?? 0) };
      return this.last;
    }
    this.last = { lateral: 0, vertical: 0 };
    return this.last;
  }
}
