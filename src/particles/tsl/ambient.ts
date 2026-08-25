import { Fn } from 'three/tsl';
import { floorMod } from './floorMod';
import { driftField } from './drift';

/**
 * Die ambiente Heimat eines Partikels in Weltkoordinaten.
 *
 * Der Flieger reist endlos geradeaus, also wuerden Weltkoordinaten unbegrenzt
 * wachsen und die Float-Genauigkeit verrotten. Stattdessen besitzt jeder
 * Partikel einen festen normierten Heimatslot h in [0,1)^3, und seine Position
 * ist die Gitterkopie, die dem Flieger am naechsten liegt.
 *
 * Weil das Gitter h*B + k*B weltfest ist, steht der Partikel wirklich still im
 * Raum — volle Parallaxe — und springt nur, wenn er die Box verlaesst. Diese
 * Spruenge verbirgt die Randblende in kernelUpdate.
 */
export const ambientHome = Fn(
  ([home, flyerPos, boxSize, time, noiseScale, noiseSpeed, driftAmp]: [any, any, any, any, any, any, any]) => {
    // Das Rauschen MUSS im Weltmassstab abgetastet werden, nicht im
    // normierten Heimatraum. home liegt in [0,1) - mit einem Faktor um 1
    // trafen alle Partikel praktisch denselben Rauschwert und drifteten
    // gemeinsam. Statt lebendigem Staub ergab das ein globales Schwanken des
    // ganzen Feldes.
    const drift = driftField(home.mul(boxSize), time, noiseScale, noiseSpeed).mul(driftAmp);
    const lattice = home.mul(boxSize).add(drift);
    const half = boxSize.mul(0.5);
    const rel = floorMod(lattice.sub(flyerPos).add(half), boxSize).sub(half);
    return flyerPos.add(rel);
  },
);
