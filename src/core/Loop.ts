/**
 * Animationsschleife mit geklemmtem dt.
 *
 * Das Klemmen ist wichtig: ein Tab-Wechsel erzeugt sonst ein dt von mehreren
 * Sekunden und die Feder-Integration im Compute-Kernel explodiert.
 */
export class Loop {
  private last = performance.now();
  private running = false;
  private frames = 0;
  private fpsAccum = 0;
  private elapsed = 0;
  fps = 0;

  constructor(private readonly step: (dt: number, elapsed: number) => void) {}

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();

    const tick = () => {
      if (!this.running) return;
      const now = performance.now();
      const dt = Math.min((now - this.last) / 1000, 1 / 30);
      this.last = now;
      this.elapsed += dt;

      this.fpsAccum += dt;
      this.frames++;
      if (this.fpsAccum >= 0.5) {
        this.fps = this.frames / this.fpsAccum;
        this.frames = 0;
        this.fpsAccum = 0;
      }

      this.step(dt, this.elapsed);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
  }
}
