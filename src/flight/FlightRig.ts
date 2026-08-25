import * as THREE from 'three/webgpu';
import type { FlightState } from './Flight';

/**
 * Komfortprofil.
 *
 * Der entscheidende Zug fuer VR: die Kamera NICHT rollen, sondern das
 * Partikelfeld. Kamerarollen ist der groesste Einzeltreiber von VR-Uebelkeit,
 * und dieses Stueck kann ihm ausweichen, weil die Welt aus dem Staub BESTEHT -
 * gerollter Staub um einen ruhigen Kopf liest sich als Neigung, ohne den
 * vestibulaeren Konflikt zu erzeugen.
 */
export interface ComfortProfile {
  cameraRoll: number;
  cameraPitch: number;
  peripheryDensity: number;
}

export const DESKTOP_COMFORT: ComfortProfile = { cameraRoll: 1, cameraPitch: 1, peripheryDensity: 1 };
/**
 * In VR wird nur das ROLLEN unterdrueckt - der groesste Einzeltreiber von
 * Uebelkeit. Das Nicken gehoert seit dem freien Flug zur Flugrichtung selbst
 * und muss mitgehen, sonst floege man woandershin, als man blickt.
 */
export const VR_COMFORT: ComfortProfile = { cameraRoll: 0, cameraPitch: 1, peripheryDensity: 0.35 };

export class FlightRig {
  readonly camera: THREE.PerspectiveCamera;

  constructor(public profile: ComfortProfile = DESKTOP_COMFORT) {
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 400);
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Die Kamera blickt entlang der Flugrichtung.
   *
   * Gier und Nicken sind jetzt die Flugrichtung selbst und gehoeren voll in die
   * Kamera - anders als frueher, wo sie reine Darstellung waren. Nur die
   * Neigung bleibt Zierde und laesst sich fuer VR abschalten (Kamerarollen ist
   * der groesste Einzeltreiber von Uebelkeit; das Feld zu rollen ist dort der
   * bessere Weg).
   *
   * Reihenfolge YXZ: erst gieren, dann nicken, dann neigen. Damit bleibt der
   * Horizont beim Gieren waagerecht.
   */
  sync(s: FlightState) {
    this.camera.position.copy(s.position);
    this.camera.rotation.set(
      s.pitch * this.profile.cameraPitch,
      s.yaw,
      s.bank * this.profile.cameraRoll,
      'YXZ',
    );
  }
}
