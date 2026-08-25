import * as THREE from 'three/webgpu';
import { CONFIG } from '../config';
import type { FlightInput } from '../input/InputSource';

/**
 * Echtes Fliegen statt Strafen.
 *
 * Der erste Entwurf hielt die Blickrichtung fest und verschob den Flieger nur
 * seitlich - ein Schienenflug in einer Roehre. Selbst mit sehr weiten Waenden
 * blieb es ein Tunnel, denn man bewegte sich immer in dieselbe Richtung und
 * rutschte dabei nur zur Seite.
 *
 * Jetzt drehen die Tasten die FLUGRICHTUNG: A/D giert, W/S nickt, und der
 * Flieger bewegt sich stets entlang seiner eigenen Vorwaertsachse. Vorwaerts
 * geht es weiterhin ununterbrochen - nur ist "vorwaerts" nicht mehr eine feste
 * Weltachse, sondern die eigene.
 */
export interface FlightState {
  position: THREE.Vector3;
  /** Gier in Radiant. 0 blickt entlang -Z. */
  yaw: number;
  /** Nicken in Radiant, nach oben positiv. Begrenzt, damit es nie ueberschlaegt. */
  pitch: number;
  forwardSpeed: number;
  /** Weltgeschwindigkeit - abgeleitet, aber praktisch fuer Vorhalt-Rechnungen. */
  velocity: THREE.Vector3;
  /** Nur fuer die Darstellung: die Neigung hinkt der Drehung nach. */
  bank: number;
  /** Geglaettete Dreh- und Nickraten. */
  yawRate: number;
  pitchRate: number;
}

export function createFlightState(): FlightState {
  return {
    position: new THREE.Vector3(0, 0, 0),
    yaw: 0,
    pitch: 0,
    forwardSpeed: 0,
    velocity: new THREE.Vector3(0, 0, 0),
    bank: 0,
    yawRate: 0,
    pitchRate: 0,
  };
}

/**
 * Vorwaertsachse aus Gier und Nicken. Bei yaw = pitch = 0 ergibt das -Z.
 *
 * Die Vorzeichen sind exakt die von THREE.Camera mit Rotationsreihenfolge YXZ:
 * dort blickt eine Kamera bei Rotation null entlang -Z, und positives Gieren
 * dreht nach LINKS. Waeren die beiden nicht deckungsgleich, floege man
 * woandershin, als man blickt.
 */
export function forwardOf(s: FlightState, out = new THREE.Vector3()) {
  const cp = Math.cos(s.pitch);
  return out.set(
    -Math.sin(s.yaw) * cp,
    Math.sin(s.pitch),
    -Math.cos(s.yaw) * cp,
  );
}

/** Rechts-Achse, immer waagerecht - damit die Welt beim Gieren nicht kippt. */
export function rightOf(s: FlightState, out = new THREE.Vector3()) {
  return out.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
}

/** Oben-Achse des Fliegers. */
export function upOf(s: FlightState, out = new THREE.Vector3()) {
  const f = forwardOf(s, new THREE.Vector3());
  const r = rightOf(s, new THREE.Vector3());
  return out.crossVectors(r, f).normalize();
}

/**
 * Ein Schritt Flug.
 *
 * Alle Glaettungen benutzen 1 - exp(-dt/tau) statt dt*k, damit sich 60 Hz und
 * 90 Hz identisch anfuehlen (im Headset ist das kein Detail).
 *
 * bankTau > turnTau ist der ganze Unterschied zwischen "fliegen" und "einen
 * Cursor bewegen": die Neigung HINKT der Drehung nach, und genau diese
 * Verzoegerung liest das Auge als Koerper.
 */
export function stepFlight(
  s: FlightState,
  input: FlightInput,
  dt: number,
) {
  const c = CONFIG.flight;

  const lat = clamp(input.lateral, -1, 1);
  const ver = clamp(input.vertical, -1, 1);

  const k = 1 - Math.exp(-dt / c.turnTau);
  // Nach rechts steuern heisst kleineres Gier - siehe forwardOf.
  s.yawRate += (-lat * c.maxYawRate - s.yawRate) * k;
  s.pitchRate += (ver * c.maxPitchRate - s.pitchRate) * k;

  s.yaw += s.yawRate * dt;
  // Nie ueberschlagen: knapp unter senkrecht abfangen.
  s.pitch = clamp(s.pitch + s.pitchRate * dt, -c.maxPitch, c.maxPitch);

  const f = forwardOf(s, _f);
  s.velocity.copy(f).multiplyScalar(s.forwardSpeed);
  s.position.addScaledVector(f, s.forwardSpeed * dt);

  // Die Neigung folgt der Drehrate, nicht der Position.
  const kb = 1 - Math.exp(-dt / c.bankTau);
  s.bank += ((s.yawRate / c.maxYawRate) * c.bankAmount - s.bank) * kb;
}

const _f = new THREE.Vector3();
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
