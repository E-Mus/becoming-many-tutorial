import type { FlightInput, InputSource } from './InputSource';

/**
 * WASD (plus Pfeiltasten).
 *
 * Rampt intern ueber ~0.15 s hoch: ein Tastendruck ist sonst eine Sprungfunktion,
 * die das Flug-Smoothing erst absorbieren muss - das Ergebnis fuehlt sich matschig
 * an statt traege.
 */
export class KeyboardInput implements InputSource {
  readonly id = 'keyboard';
  private keys = new Set<string>();
  private lat = 0;
  private ver = 0;
  private readonly tau = 0.15;

  private onDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  };
  private onUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private onBlur = () => this.keys.clear();

  connect() {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }

  disconnect() {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
  }

  get active() {
    return Math.abs(this.lat) > 0.01 || Math.abs(this.ver) > 0.01;
  }

  read(dt: number): FlightInput {
    const k = this.keys;
    const targetLat = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const targetVer = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const a = 1 - Math.exp(-dt / this.tau);
    this.lat += (targetLat - this.lat) * a;
    this.ver += (targetVer - this.ver) * a;
    return { lateral: this.lat, vertical: this.ver };
  }
}
