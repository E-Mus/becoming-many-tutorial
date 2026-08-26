import type * as THREE from 'three/webgpu';
import type { ParticleField } from '../particles/ParticleField';
import type { Uniforms } from '../core/Uniforms';
import type { FlightState } from '../flight/Flight';
import type { FlightInput } from '../input/InputSource';

/**
 * Nur die vier Himmelsrichtungen des Bildes: rechts, links, hoch, runter.
 *
 * Eine Diagonale gab es einmal ('xy'). Sie ist raus, und zwar nicht als
 * Vereinfachung, sondern weil ein diagonaler Pfeil zwei Anweisungen gleichzeitig
 * gibt und in einem wortlosen Tutorial keine davon eindeutig ist.
 */
export type Axis = 'x' | 'y';
export type ModeId = 'far' | 'escort';

export interface GuidanceTask {
  axis: Axis;
  /** Richtung entlang der Achse */
  sign: 1 | -1;
  /** Sekunden Vollauslenkung nach dem sichtbaren Pfeil bis progress = 1. */
  controlEffort: number;
  /**
   * Legacy-Wert aus frueheren Modi. Die aktiven Varianten platzieren ihre
   * Formen entlang der aktuellen Flugachse.
   */
  distanceAhead: number;
  /** 0 = Fluestern, 1 = unuebersehbar. Kommt aus der Eskalationskurve. */
  intensity: number;
}

export interface GuidanceContext {
  field: ParticleField;
  uniforms: Uniforms;
  flight: FlightState;
  /** Aktuelle, bereits zusammengefuehrte Tastatur-/Gamepad-Eingabe. */
  input: FlightInput;
  dt: number;
}

export interface GuidanceReport {
  /** 0..1 - das, was man in der Form aufgezehrt sieht */
  progress: number;
  completed: boolean;
  event: 'gate-passed' | null;
}

/**
 * Die beiden Sprachen fuer dieselbe Anweisung.
 *
 * begin() setzt die Form in der Welt, nie als Screen-Space-Zeichen.
 */
export interface GuidanceMode {
  readonly id: ModeId;
  readonly label: string;
  begin(task: GuidanceTask, ctx: GuidanceContext): void;
  update(ctx: GuidanceContext): GuidanceReport;
  end(reason: 'success' | 'timeout' | 'skip', ctx: GuidanceContext): void;
}

/** Wo die Form steht: `distanceAhead` Meter voraus, auf Hoehe der Schiene. */
export function placeAhead(target: THREE.Vector3, flight: FlightState, distanceAhead: number) {
  target.set(0, 0, flight.position.z - distanceAhead);
  return target;
}
