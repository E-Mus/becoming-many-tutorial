import type * as THREE from 'three/webgpu';
import type { ParticleField } from '../particles/ParticleField';
import type { Uniforms } from '../core/Uniforms';
import type { FlightState } from '../flight/Flight';

/**
 * Nur die vier Himmelsrichtungen des Bildes: rechts, links, hoch, runter.
 *
 * Eine Diagonale gab es einmal ('xy'). Sie ist raus, und zwar nicht als
 * Vereinfachung, sondern weil ein diagonaler Pfeil zwei Anweisungen gleichzeitig
 * gibt und in einem wortlosen Tutorial keine davon eindeutig ist.
 */
export type Axis = 'x' | 'y';
export type ModeId =
  // die vier Pfeil-Varianten
  | 'far' | 'escort' | 'threshold' | 'drawn'
  // geparkt, ueber Tasten 5-8 erreichbar
  | 'arrow' | 'gate' | 'flow' | 'curtain';

export interface GuidanceTask {
  axis: Axis;
  /** Richtung entlang der Achse */
  sign: 1 | -1;
  /** Meter seitlicher/vertikaler Versatz bis progress = 1 */
  amount: number;
  /**
   * Nur noch vom Sog benutzt: wo die Stroemung einsetzt.
   *
   * Die drei Formen-Modi platzieren sich nicht mehr hierueber, sondern als
   * Kette auf einem Weltraster (formations/chain.ts) - eine einzelne Form waere
   * bei konstanter Vorwaertsfahrt nach gut zwei Sekunden durchflogen.
   */
  distanceAhead: number;
  /** 0 = Fluestern, 1 = unuebersehbar. Kommt aus der Eskalationskurve. */
  intensity: number;
}

export interface GuidanceContext {
  field: ParticleField;
  uniforms: Uniforms;
  flight: FlightState;
  dt: number;
}

export interface GuidanceReport {
  /** 0..1 - das, was man in der Form aufgezehrt sieht */
  progress: number;
  completed: boolean;
  event: 'gate-passed' | null;
}

/**
 * Alle vier Sprachen fuer dieselbe Anweisung.
 *
 * begin() setzt in jedem Modus eine FESTE WELTPOSITION auf der Schiene, nie
 * eine Position relativ zur Kamera (Grundgesetz 6). Fliegt man an der Form
 * vorbei, zieht sie hinter einem weg wie ein Baum am Strassenrand.
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
