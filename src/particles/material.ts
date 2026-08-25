import * as THREE from 'three/webgpu';
import { cameraPosition, length, max, shapeCircle, varying, vec3 } from 'three/tsl';
import type { Buffers } from './buffers';
import type { Uniforms } from '../core/Uniforms';

/**
 * Schwarze Punkte. Sonst nichts.
 *
 * GRUNDGESETZ 4: Dieses Material kennt `blend` nicht. Farbe ist konstant
 * schwarz, die Groesse haengt nur an der Entfernung, und die Deckkraft kommt
 * ausschliesslich aus pos.w (Randblende x Nahblende x Korridor-Peripherie x
 * globale Dichte). Kein Term weiss, ob ein Partikel gerade Teil einer Form ist.
 * Lesbarkeit entsteht aus Dichte und Ordnung, nicht aus Kontrast.
 *
 * Warum Sprite und nicht Points: unter WebGPU sind Point-Primitives hart auf
 * 1 Pixel festgenagelt (siehe PointsNodeMaterial-Doku). Auf Weiss wuerde das
 * flimmern und im Headset verschwinden.
 */
export function createDotMaterial(b: Buffers, u: Uniforms, count: number) {
  // .toAttribute() bindet den Storage-Buffer als instanziertes VERTEX-Attribut.
  // Das braucht - anders als .element(instanceIndex) im Vertex-Stage - kein
  // requiredLimits.maxStorageBuffersInVertexStage und bleibt damit portabel.
  // Genau deshalb liegt das Alpha in pos.w statt in einem eigenen Buffer.
  const p = b.pos.toAttribute();

  const material = new THREE.SpriteNodeMaterial();
  material.positionNode = p.xyz;
  material.colorNode = vec3(0.0); // reines Schwarz, niemals Beleuchtung
  const circle: any = shapeCircle();
  material.opacityNode = circle.mul(varying(p.w));

  // Weltgroesse (perspektivische Verkleinerung = der Tiefenhinweis), aber nach
  // unten geklemmt: unter ~1.5 px faengt ein schwarzer Punkt auf Weiss an zu
  // flimmern wie Bildrauschen.
  const viewDist: any = length(p.xyz.sub(cameraPosition));
  material.scaleNode = max(u.dotSize, viewDist.mul(u.minAngularSize));

  material.transparent = true;
  material.depthWrite = false;
  material.depthTest = false; // es gibt keine Geometrie, die verdecken koennte
  material.blending = THREE.NormalBlending;

  const sprite = new THREE.Sprite(material);
  sprite.count = count;
  sprite.frustumCulled = false;
  return sprite;
}
