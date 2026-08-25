import { createFlightState, stepFlight, type FlightState } from '../flight/Flight';
import type { GuidanceTask } from './GuidanceMode';

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Der Bezug, gegen den Fortschritt gemessen wird: DIE BAHN, AUF DER MAN SCHON WAR.
 *
 * Frueher war das ein fester Weltpunkt - die Position beim Beat-Beginn. Das
 * bevorzugt eine Richtung und benachteiligt die Gegenrichtung, und zwar
 * massiv, weil der Flug frei ist und man Seitenfahrt mitbringt. Gemessen im
 * laufenden Stueck, Aufgabe "links" direkt nach "rechts":
 *
 *   t=2.4  Beat beginnt      x=14.0   vx=+9.9 m/s
 *   t=2.9  steuert links     x=18.9   progress 0
 *   t=4.4  steuert links     x=27.9   progress 0
 *   t=6.4  steuert links     x=14.5   progress 0
 *   t=7.4  steuert links     x= 6.8   progress 0.03
 *
 * Fuenf Sekunden lang macht man alles richtig, und das Zeichen reagiert nicht:
 * erst muss die geerbte Seitenfahrt abgebaut und die 14 m zurueckgeholt werden.
 * "Rechts" dagegen startet aus der Ruhe und zaehlt sofort. Dasselbe bei
 * hoch/runter.
 *
 * Der Bezug ist deshalb die Bahn, die man geflogen WAERE, haette man in dem
 * Moment einfach losgelassen. Gemessen wird die Abweichung davon - also genau
 * das, was die eigene Eingabe bewirkt hat, und nichts sonst.
 *
 * ES GENUEGT NICHT, NUR DIE SEITENFAHRT MITZUZIEHEN. Ein erster Anlauf liess
 * den Bezugspunkt mit der Geschwindigkeit vom Beat-Beginn weiterlaufen. Das
 * behob den groessten Teil, aber nicht die geerbte DREHRATE: wer aus "rechts"
 * kommt, dreht beim Beginn von "links" noch mit voller Rate nach rechts und
 * muss die erst zurueckholen. Solange traegt es ihn weiter nach rechts, also
 * in die falsche Richtung, und der Fortschritt bleibt bei null. Aus identischem
 * Startzustand waren alle vier Richtungen gleich schnell (gemessen: 0, 0.04,
 * 0.12, 0.27, 0.50, 0.78 in 250-ms-Schritten, in jeder Richtung dieselbe
 * Kurve) - im Ablauf hinkten links und runter trotzdem hinterher.
 *
 * Deshalb wird die Bahn mit DEMSELBEN Flugmodell integriert wie der Flieger,
 * nur ohne Eingabe: stepFlight mit Ausschlag null. Damit wickelt sie dieselbe
 * Kurve ab, aus der man gerade kommt, und was man dagegen steuert, zaehlt vom
 * ersten Bild an.
 */
export class Bezugsbahn {
  private readonly bahn = createFlightState();

  get x() { return this.bahn.position.x; }
  get y() { return this.bahn.position.y; }

  beginne(flight: FlightState) {
    this.bahn.position.copy(flight.position);
    this.bahn.velocity.copy(flight.velocity);
    this.bahn.yaw = flight.yaw;
    this.bahn.pitch = flight.pitch;
    this.bahn.yawRate = flight.yawRate;
    this.bahn.pitchRate = flight.pitchRate;
    this.bahn.forwardSpeed = flight.forwardSpeed;
    this.bahn.bank = flight.bank;
  }

  /** Das Tempo kommt weiter vom echten Flug - Atempausen fahren es hoch. */
  schritt(dt: number, flight: FlightState) {
    this.bahn.forwardSpeed = flight.forwardSpeed;
    stepFlight(this.bahn, LOSGELASSEN, dt);
  }
}

/** Kein Ausschlag - die Bahn fliegt, als haette man die Hand weggenommen. */
const LOSGELASSEN = { lateral: 0, vertical: 0 };

/** Verschiebungsbasiert: ehrlich - man muss wirklich hinueber. */
export function axisProgress(flight: FlightState, task: GuidanceTask, origin: { x: number; y: number }) {
  const cur = task.axis === 'y' ? flight.position.y : flight.position.x;
  const org = task.axis === 'y' ? origin.y : origin.x;
  return clamp01(((cur - org) * task.sign) / task.amount);
}

/** Zentrierungsbasiert, fuer Tore und Vorhaenge: 1, wenn man auf der Achse liegt. */
export function centringProgress(flight: FlightState, cx: number, cy: number, radius: number) {
  return clamp01(1 - Math.hypot(flight.position.x - cx, flight.position.y - cy) / radius);
}

/**
 * Ratsche mit Tiefpass: sofort steigen, langsam fallen.
 *
 * Flackernder Fortschritt ist unlesbar. Fortschritt, der nie faellt, ist
 * gelogen. Das hier ist der Kompromiss, den das Auge als fair empfindet.
 */
export class Ratchet {
  private v = 0;
  reset() { this.v = 0; }
  step(target: number, dt: number, decayPerSec = 0.25) {
    this.v = target > this.v ? target : Math.max(target, this.v - decayPerSec * dt);
    return this.v;
  }
}
