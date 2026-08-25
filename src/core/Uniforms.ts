/**
 * Der einzige typisierte Uniform-Beutel, den CPU und GPU teilen.
 *
 * Jeder Wert wird auf der CPU gesetzt und im Compute-Kernel gelesen. Die
 * Fortschrittskopplung des ganzen Stuecks laeuft ueber genau ein Float: `progress`.
 */
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { CONFIG } from '../config';

export function createUniforms() {
  const p = CONFIG.particles;
  const f = CONFIG.formation;

  return {
    // --- Welt / Flieger ---
    flyerPos: uniform(new THREE.Vector3(0, 0, 0)),
    boxSize: uniform(new THREE.Vector3(p.boxSize[0], p.boxSize[1], p.boxSize[2])),

    // --- ambiente Drift ---
    noiseScale: uniform(p.noiseScale),
    noiseSpeed: uniform(p.noiseSpeed),
    driftAmp: uniform(p.driftAmp),

    // --- Federn ---
    ambientStiff: uniform(p.ambientStiff),
    formStiff: uniform(p.formStiff),

    // --- Bugwelle ---
    bowRadius: uniform(p.bowRadius),
    bowStrength: uniform(p.bowStrength),

    // --- Blenden (die einzigen erlaubten Alpha-Terme) ---
    nearFadeIn: uniform(p.nearFadeIn),
    nearFadeOut: uniform(p.nearFadeOut),
    peripheryDensity: uniform(p.peripheryDensity),
    /**
     * SICHTWEITE in Metern - der wichtigste Regler des Stuecks.
     *
     * Sie haengt bewusst NICHT mehr an der Boxgroesse. Weil die Box tiefer ist
     * als die Sichtweite, koennen Formen weit ausserhalb der Sicht entstehen
     * und beim Naeherkommen einblenden. Damit gibt es kein sichtbares
     * Entstehen mehr - das Problem, an dem alle frueheren Anlaeufe hingen.
     */
    viewFar: uniform(p.viewFar),
    /** Globale Dichte 0..1 — blendet das Feld beim Ankommen auf. */
    fieldDensity: uniform(1),

    // --- Formation ---
    formationOn: uniform(0),
    formationMatrix: uniform(new THREE.Matrix4()),
    /**
     * Zweite Bank mit eigener Platzierung.
     *
     * Damit koennen zwei Pfeile voellig unabhaengig im Raum stehen: waehrend
     * man auf den einen zufliegt, wird der andere weit voraus neu gesetzt und
     * geworben. So entsteht nie eine Luecke, und die Abstaende sind frei -
     * anders als bei einer Kette, die durch ihr Raster gebunden ist.
     * Slots ab bankSplit gehoeren zu Bank B.
     */
    formationMatrixB: uniform(new THREE.Matrix4()),
    bankSplit: uniform(1e9),

    /**
     * Streuung beim Loslassen, in Metern.
     *
     * Ein entlassenes Partikel verwurzelt sich dort, wo es steht - sonst wuerde
     * es zu einer Heimat zurueckfedern, die vor dem Flieger liegen kann, und
     * durch die Kamera davonfliegen. Die Streuung laesst die alte Form dabei
     * zerfallen, statt sie als Narbe stehenzulassen.
     */
    releaseScatter: uniform(f.releaseScatter),

    /**
     * Zeichenkopf 0..1 entlang der Fortschrittsachse eines Strichzugs.
     * Nur was der Kopf schon passiert hat, ist gebunden - der Pfeil zeichnet
     * sich also, statt einfach da zu sein.
     */
    drawHead: uniform(1),
    formationOrigin: uniform(new THREE.Vector3()),
    formationAge: uniform(0),
    /** Wie viele Slots die AKTUELLE Form nutzt (<= maxSlots). */
    slotCount: uniform(1),
    /** Slots je Kettenkopie - um wie viel die Indizes beim Nachruecken wandern. */
    slotsPerCopy: uniform(1),
    /** Slotbereich, aus dem der Assign-Kernel werben darf. */
    assignLo: uniform(0),
    assignHi: uniform(1),
    /** 1 = nur freie Partikel werben (Kette rueckt nach), 0 = alle neu verteilen. */
    assignOnlyFree: uniform(0),
    /** uint, weil er direkt auf instanceIndex addiert wird. */
    formationSeed: uniform(0, 'uint'),

    /** Der Fortschritt. Das eine Float, das die Form sich selbst aufzehren laesst. */
    progress: uniform(0),
    /** +1 = aufzehren, -1 = aufbauen. */
    dissolveDir: uniform(1),
    dissolveWidth: uniform(f.dissolveWidth),
    dissolveJitter: uniform(f.dissolveJitter),
    dissolveKick: uniform(f.dissolveKick),

    bindRate: uniform(f.bindRate),
    appearSpread: uniform(f.appearSpread),
    appearWidth: uniform(f.appearWidth),

    recruitFar: uniform(f.recruitFar),
    recruitDensity: uniform(f.recruitDensity),
    heimSchwelle: uniform(f.heimSchwelle),
    /** Mindestabstand zum Flieger, damit ein Partikel geworben werden darf.
     *  0 = ueberall. Die Zwei-Bank-Modi setzen die Sichtweite ein. */
    werbeFernAb: uniform(0),

    // --- Strichzug-Bindung (Tunnel, Fluss) ---
    /** 0 = Punktwolken-Slots (Ketten), 1 = Strichzug im Raum. */
    bindMode: uniform(0),
    /** Bis zu vier Strecken. Ungenutzte liegen weit weg und stoeren nicht. */
    segA0: uniform(new THREE.Vector3(1e6, 1e6, 1e6)),
    segB0: uniform(new THREE.Vector3(1e6, 1e6, 1e6)),
    segA1: uniform(new THREE.Vector3(1e6, 1e6, 1e6)),
    segB1: uniform(new THREE.Vector3(1e6, 1e6, 1e6)),
    segA2: uniform(new THREE.Vector3(1e6, 1e6, 1e6)),
    segB2: uniform(new THREE.Vector3(1e6, 1e6, 1e6)),
    segA3: uniform(new THREE.Vector3(1e6, 1e6, 1e6)),
    segB3: uniform(new THREE.Vector3(1e6, 1e6, 1e6)),
    /** Wie weit seitlich der Strich Staub einsammelt (nah / am fernen Ende). */
    strokeCapture: uniform(9),
    strokeCaptureFar: uniform(9),
    /** Dicke des Strichs - ohne die waere er ein mathematisch duenner Faden. */
    strokeThickness: uniform(0.55),
    /** z-Fenster vor dem Flieger, in dem der Strich ueberhaupt wirkt. */
    strokeZNear: uniform(10),
    strokeZFar: uniform(48),
    /** 1 = Partikel behaelt sein z (Strich ist ausgezogen), 0 = volle 3D-Naehe. */
    strokeKeepZ: uniform(1),

    /** Fortschrittsachse fuer Strichzuege: s = (p - origin) . dir / len */
    progOrigin: uniform(new THREE.Vector3()),
    progDir: uniform(new THREE.Vector3(1, 0, 0)),
    progLen: uniform(1),

    // --- Sog / Stroemung ---
    flowDir: uniform(new THREE.Vector3(0, 0, 0)),
    /** Amplitude der Stroemung in METERN. Ein Meter ist unsichtbar - der Staub
     *  muss sichtbar weit ausschlagen, damit man Stroemung als Stroemung liest. */
    flowStrength: uniform(0),
    /** Wellenlaenge und Tempo der Welle, die durch das Feld laeuft. */
    flowWaveLength: uniform(34),
    flowWaveSpeed: uniform(9),
    flowAxisOrigin: uniform(0),
    flowAxisLength: uniform(60),

    // --- Darstellung ---
    dotSize: uniform(p.dotSize),
    minAngularSize: uniform(p.minAngularSize),

    // --- Burst (Erfolgs-Druckwelle im Raum) ---
    burstOrigin: uniform(new THREE.Vector3()),
    burstStrength: uniform(0),
  };
}

export type Uniforms = ReturnType<typeof createUniforms>;
