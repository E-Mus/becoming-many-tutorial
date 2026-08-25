import * as THREE from 'three/webgpu';
import { CONFIG } from '../config';

/**
 * WebGPURenderer hochfahren und ehrlich melden, welches Backend wirklich laeuft.
 *
 * Das Log ist nicht kosmetisch: faellt three.js still auf WebGL2 zurueck, ist
 * jede spaeter gemessene Performance-Zahl wertlos.
 */
export async function createRenderer(parent: HTMLElement) {
  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(CONFIG.voidColor, 1);
  renderer.toneMapping = THREE.NoToneMapping; // wuerde das Weiss sonst einfaerben
  parent.appendChild(renderer.domElement);

  // Muss vor dem ersten renderer.compute() abgewartet werden, sonst leitet
  // three.js still an computeAsync() um und die Reihenfolge verrutscht.
  await renderer.init();

  const backend = renderer.backend as { isWebGPUBackend?: boolean };
  const usingWebGPU = backend.isWebGPUBackend === true;
  console.info(`[Weiss1] backend: ${usingWebGPU ? 'WebGPU' : 'WebGL2 fallback'}`);
  if (!usingWebGPU) {
    console.warn('[Weiss1] WebGPU nicht aktiv - Performance-Messungen sind ab hier nicht aussagekraeftig.');
  }

  return { renderer, usingWebGPU };
}
