import { Fn, hash, instanceIndex, time, vec3, vec4 } from 'three/tsl';
import type { Buffers } from './buffers';
import type { Uniforms } from '../core/Uniforms';
import { ambientHome } from './tsl/ambient';

/**
 * Einmalig beim Start: Heimatslots wuerfeln und die Partikel gleich DORT
 * absetzen.
 *
 * Die Slots sind gleichverteilte Punkte in [0,1)^3 - kein Gitter. Genau deshalb
 * darf ein entlassener Partikel spaeter an seinem Platz neu verwurzeln, ohne
 * die Verteilung zu verzerren.
 *
 * DIE SEEDS DUERFEN DEN INDEX NICHT MULTIPLIZIEREN.
 *
 * Hier stand einmal hash(i*3+11), hash(i*3+12), hash(i*3+13). Auf der CPU
 * ergibt derselbe PCG-Hash mit denselben Seeds eine saubere Gleichverteilung
 * (groesste Abweichung 3 %), auf der GPU aber nicht - nachgemessen im
 * laufenden Stueck:
 *
 *   Kanal w, hash(i+7717)      groesstes Zwanzigstel  1.02 x Erwartung
 *   Kanal x, hash(i*3+11)                             1.79 x
 *   Kanal z, hash(i*3+13)                             1.64 x
 *   Kanal y, hash(i*3+12)                             7.95 x
 *
 * Bei y lagen 36 % aller Partikel im untersten Zwanzigstel und 24 % im
 * obersten, die Mitte war leer. Und die Einzelwerte stimmten nicht mit der
 * CPU ueberein: Seed 11 ergab 0.1972 statt 0.2726, Seed 12 ergab 0.0255 statt
 * 0.2882 - waehrend Seed 7717 auf beiden Seiten exakt 0.1248 ergab.
 *
 * Der Staub war damit nie ein gleichmaessiges Feld, sondern hatte dichte
 * Schlieren und Knoten. Man flog hindurch und sah Ballungen, die aussahen wie
 * uebrig gebliebene Formen - es waren aber gar keine.
 *
 * Alle vier Kanaele benutzen deshalb jetzt dieselbe Form, die nachweislich
 * traegt: hash(i + K) mit weit auseinander liegenden Konstanten.
 *
 * Frueher startete alles im Ursprung, und die Wrap-Sicherung im Frame-Kernel
 * hat das stillschweigend zurechtgerueckt. Seit ein ungebundenes Partikel sich
 * an seinem Platz verwurzelt, statt weit gezogen zu werden, war das fatal: die
 * Regel hielt im ersten Frame das GESAMTE Feld im Ursprung fest, und der Staub
 * blieb als Klumpen am Startpunkt liegen, waehrend der Flieger davonflog.
 * Gemessen: 8834 sichtbare Partikel, davon null im Bild.
 */
export function buildInitKernel(b: Buffers, u: Uniforms, count: number) {
  return Fn(() => {
    const i = instanceIndex;
    const hx = hash(i.add(1_013_904_223)).toVar();
    const hy = hash(i.add(1_900_000_007)).toVar();
    const hz = hash(i.add(700_000_001)).toVar();
    const h = vec3(hx, hy, hz);
    b.home.element(i).assign(vec4(h, hash(i.add(7717))));

    const start = ambientHome(
      h, u.flyerPos, u.boxSize, time,
      u.noiseScale, u.noiseSpeed, u.driftAmp,
    );
    b.pos.element(i).assign(vec4(start, 0));
    b.vel.element(i).assign(vec4(0, 0, 0, 0));
    b.meta.element(i).assign(vec4(0, 0, 0, 0));
  })().compute(count);
}
