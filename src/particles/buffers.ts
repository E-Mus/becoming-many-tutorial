import { instancedArray } from 'three/tsl';

/**
 * ARCHITEKTURREGEL: jeder Storage-Buffer ist vec4, nie vec3.
 *
 * WGSL kann vec3<f32> nicht in einem Storage-Array packen (Stride 16, nicht 12).
 * three.js paddet das Attribut deshalb beim ersten Upload in-place um und
 * rechnet bei einem spaeteren Upload mit dem alten Stride weiter. itemSize 1, 2
 * und 4 umgehen diesen Pfad komplett. Die freien w-Kanaele tragen darum jeweils
 * etwas Nuetzliches.
 *
 *   pos    xyz = Weltposition          w = alpha
 *   vel    xyz = Geschwindigkeit       w = blend (Bindungsstaerke 0..1)
 *   home   xyz = Heimatslot in [0,1)   w = seed
 *   meta   x = recruit  y = slotIndex  z = Bewegungsversatz   w = frei
 *   slots  xyz = Ziel (formationslokal) w = s (Fortschrittsachse)
 *
 * Nach der Initialisierung wird nie wieder Partikelzustand von der CPU
 * hochgeladen — nur `slots`, einmal pro Formation.
 */
export function createBuffers(particleCount: number, slotCount: number) {
  return {
    pos: instancedArray(particleCount, 'vec4'),
    vel: instancedArray(particleCount, 'vec4'),
    home: instancedArray(particleCount, 'vec4'),
    meta: instancedArray(particleCount, 'vec4'),
    slots: instancedArray(slotCount, 'vec4'),
  };
}

export type Buffers = ReturnType<typeof createBuffers>;
