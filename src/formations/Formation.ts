import * as THREE from 'three/webgpu';
import type { Buffers } from '../particles/buffers';

/**
 * Eine Formation ist reine Daten: M Slots als [x, y, z, s].
 *
 * Die Positionen liegen in FORMATIONSLOKALEN Koordinaten und werden per
 * mat4-Uniform in die Welt gesetzt. Dadurch ist ein Linkspfeil derselbe
 * Punktwolken-Cache wie ein Rechtspfeil, nur um 180 Grad gedreht.
 *
 * `s` ist die Fortschrittsachse: die normierte Koordinate, entlang derer die
 * Form sich aufzehrt oder aufbaut. Sie ist der einzige Unterschied zwischen den
 * beiden Fuehrungssprachen.
 */
export interface Formation {
  /** slotCount*4 Floats: [x, y, z, s] je Slot, formationslokal */
  slots: Float32Array;
  /** Muss zum vorhandenen Staub der Umgebung passen, nicht zur Buffergroesse. */
  slotCount: number;
  /** Slots je Kettenkopie - um so viel wandern die Indizes beim Nachruecken. */
  slotsPerCopy: number;
  /** +1 = aufzehren, -1 = aufbauen */
  dissolveDir: 1 | -1;
  /** Schwerpunkt, fuer die Richtung des Zerstaeubungsimpulses */
  origin: THREE.Vector3;
}

/**
 * Slots hochladen. Das ist der EINZIGE CPU->GPU-Transfer nach der
 * Initialisierung: 40k * 4 Floats = 640 KB, deutlich unter einer Millisekunde.
 * Partikelzustand selbst wird nie wieder hochgeladen.
 */
export function uploadSlots(buffers: Buffers, formation: Formation) {
  const attr = (buffers.slots as unknown as { value: THREE.BufferAttribute }).value;
  const dst = attr.array as Float32Array;
  dst.set(formation.slots.subarray(0, Math.min(formation.slots.length, dst.length)));
  attr.needsUpdate = true;
}

/** Formationen wiederholen sich ueber die Beats hinweg - also cachen. */
const cache = new Map<string, Float32Array>();
export function cached(key: string, make: () => Float32Array): Float32Array {
  let v = cache.get(key);
  if (!v) {
    v = make();
    cache.set(key, v);
  }
  return v;
}
