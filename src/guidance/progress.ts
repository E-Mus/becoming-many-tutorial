import { CONFIG } from '../config';
import type { FlightInput } from '../input/InputSource';
import type { GuidanceTask } from './GuidanceMode';

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function axisInput(input: FlightInput, task: GuidanceTask) {
  return task.axis === 'x' ? input.lateral : input.vertical;
}

/**
 * Fortschritt einer einzelnen Tutorial-Aufgabe.
 *
 * Eine Aufgabe zaehlt ausschliesslich eine neue Eingabe auf ihrer Steuerachse:
 * Weltposition, Blickrichtung und geerbte Flugtraegheit koennen sie nicht
 * erfuellen. Ist die Achse beim Erscheinen schon ausgelenkt, wird sie erst nach
 * einer kurzen neutralen Phase scharf. So kann keine gehaltene Eingabe aus dem
 * vorigen oder aus einem noch nicht begonnenen Schritt mitgenommen werden.
 */
export class TaskProgress {
  private task!: GuidanceTask;
  private presentationRemaining = 0;
  private presented = false;
  private armed = false;
  private neutralTime = 0;
  private value = 0;

  get progress() { return this.value; }
  get isPresented() { return this.presented; }
  get isArmed() { return this.armed; }

  begin(task: GuidanceTask, input: FlightInput, presentationDelay: number) {
    this.task = task;
    this.presentationRemaining = Math.max(0, presentationDelay);
    this.presented = false;
    this.armed = false;
    this.neutralTime = 0;
    this.value = 0;

    if (this.presentationRemaining === 0) this.present(input);
  }

  step(input: FlightInput, dt: number) {
    if (!this.presented) {
      this.presentationRemaining -= dt;
      if (this.presentationRemaining > 0) return this.value;
      this.present(input);
      return this.value;
    }

    const control = axisInput(input, this.task);
    if (!this.armed) {
      if (Math.abs(control) <= CONFIG.tutorial.inputNeutral) {
        this.neutralTime += dt;
        if (this.neutralTime >= CONFIG.tutorial.neutralHold) this.armed = true;
      } else {
        this.neutralTime = 0;
      }
      return this.value;
    }

    const directed = control * this.task.sign;
    const threshold = CONFIG.tutorial.inputActuation;
    const strength = clamp01((directed - threshold) / (1 - threshold));
    this.value = clamp01(this.value + (strength * dt) / this.task.controlEffort);
    return this.value;
  }

  private present(input: FlightInput) {
    this.presented = true;
    this.armed = Math.abs(axisInput(input, this.task)) <= CONFIG.tutorial.inputNeutral;
    this.neutralTime = 0;
  }
}
