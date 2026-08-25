import { Fn, vec3, mx_noise_vec3 } from 'three/tsl';

/**
 * Ambiente Drift als Vektor-Rauschfeld.
 *
 * Bewusst kein echtes Curl-Noise: das braeuchte sechs Rauschabtastungen fuer die
 * Ableitungen. Fuer langsam treibenden Staub ist das direkte Vektorfeld visuell
 * nicht zu unterscheiden und dreimal billiger.
 */
export const driftField = Fn(([p, t, scale, speed]: [any, any, any, any]) => {
  const q = p.mul(scale).add(vec3(0, 0, t.mul(speed)));
  return mx_noise_vec3(q);
});
