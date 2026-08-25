import * as THREE from 'three/webgpu';
import { CONFIG } from '../config';
import type { Uniforms } from '../core/Uniforms';
import { createBuffers, type Buffers } from './buffers';
import { buildInitKernel } from './kernelInit';
import { buildAssignKernel } from './kernelAssign';
import { buildUpdateKernel } from './kernelUpdate';
import { buildReleaseKernel } from './kernelBurst';
import { buildShiftKernel } from './kernelShift';
import { createDotMaterial } from './material';
import { uploadSlots, type Formation } from '../formations/Formation';

/**
 * Das Partikelfeld: ein Buffer-Satz, vier Kernel, ein Sprite.
 *
 * Die Partikelzahl ist konstant (Grundgesetz 1). Nichts wird gespawnt, nichts
 * geloescht. Eine Formation rekrutiert vorhandenen Staub und entlaesst ihn wieder.
 */
export class ParticleField {
  readonly buffers: Buffers;
  readonly object: THREE.Sprite;
  private readonly initKernel;
  private readonly assignKernel;
  private readonly updateKernel;
  private readonly releaseKernel;
  private readonly shiftKernel;
  private seed = 1;

  constructor(
    private readonly renderer: THREE.WebGPURenderer,
    private readonly u: Uniforms,
    readonly count: number = CONFIG.particles.count,
    readonly maxSlots: number = CONFIG.particles.maxSlots,
  ) {
    this.buffers = createBuffers(count, maxSlots);
    this.initKernel = buildInitKernel(this.buffers, u, count);
    this.assignKernel = buildAssignKernel(this.buffers, u, count);
    this.updateKernel = buildUpdateKernel(this.buffers, u, count);
    this.releaseKernel = buildReleaseKernel(this.buffers, u, count);
    this.shiftKernel = buildShiftKernel(this.buffers, u, count);
    this.object = createDotMaterial(this.buffers, u, count);
  }

  /** Einmalig nach renderer.init(). */
  async init() {
    await this.renderer.computeAsync(this.initKernel);
  }

  /** Pro Frame. */
  update() {
    this.renderer.compute(this.updateKernel);
  }

  /**
   * Eine Formation beginnen: Slots hochladen, Platzierung setzen, rekrutieren.
   * Der Assign-Pass laeuft genau einmal und ist O(N) ohne CPU-Roundtrip.
   */
  beginFormation(formation: Formation, matrix: THREE.Matrix4) {
    uploadSlots(this.buffers, formation);
    // Nur so viele Slots benutzen, wie diese Form deklariert - der Buffer ist
    // fuer die groesste Form dimensioniert, nicht fuer jede.
    const slotCount = Math.min(formation.slotCount, this.maxSlots);
    this.u.slotCount.value = slotCount;
    this.u.slotsPerCopy.value = formation.slotsPerCopy;
    this.u.formationMatrix.value.copy(matrix);
    this.u.formationOrigin.value.copy(formation.origin).applyMatrix4(matrix);
    this.u.dissolveDir.value = formation.dissolveDir;
    this.u.formationSeed.value = this.seed;
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    this.u.formationAge.value = 0;
    this.u.progress.value = 0;
    this.u.formationOn.value = 1;

    // Alte Bindungen loesen, damit jedes Partikel frisch geworben wird und
    // seine Erscheinungszeit neu bekommt.
    this.renderer.compute(this.releaseKernel);
    this.u.formationOn.value = 1;
    this.u.assignLo.value = 0;
    this.u.assignHi.value = slotCount;
    this.u.assignOnlyFree.value = 0;
    this.renderer.compute(this.assignKernel);
  }

  /**
   * Kette eine Rasterweite weiterruecken.
   *
   * Zwei Schritte, und die Reihenfolge ist entscheidend:
   *  1. kernelShift verringert den Slot-Index jedes gebundenen Partikels um
   *     eine Kopie. Weil die Matrix zugleich um genau eine Rasterweite wandert,
   *     bleibt das Partikel dabei buchstaeblich an seinem Weltplatz stehen.
   *  2. Der Assign-Kernel wirbt nur noch fuer die vorne neu hinzugekommene
   *     Kopie, und nur unter freien Partikeln.
   *
   * Frueher lief hier schlicht der Assign-Kernel fuer alle - der wuerfelt die
   * Slots neu aus, und die ganze Allee setzte sich etwa einmal pro Sekunde neu
   * zusammen. Sie pulsierte und zersprang staendig.
   *
   * Fortschritt, Alter und Saat bleiben erhalten: es ist dieselbe Formation.
   */
  advanceChain(matrix: THREE.Matrix4, origin: THREE.Vector3) {
    this.renderer.compute(this.shiftKernel);

    this.u.formationMatrix.value.copy(matrix);
    this.u.formationOrigin.value.copy(origin).applyMatrix4(matrix);

    const perCopy = this.u.slotsPerCopy.value;
    this.u.assignLo.value = Math.max(0, this.u.slotCount.value - perCopy);
    this.u.assignHi.value = this.u.slotCount.value;
    this.u.assignOnlyFree.value = 1;
    this.renderer.compute(this.assignKernel);
  }

  /**
   * Zwei-Bank-Betrieb: zwei Pfeile, die voellig unabhaengig im Raum stehen.
   *
   * Eine Kette ist an ihr Raster gebunden, und weil eine Kopie nur dort
   * entstehen kann, wo Staub liegt, war der Abstand nach oben begrenzt. Zwei
   * freie Baenke loesen das: waehrend man auf die eine zufliegt, wird die
   * andere weit voraus neu gesetzt und geworben. Der Abstand ist damit frei
   * waehlbar, und es entsteht nie eine Luecke.
   *
   * Die Slots enthalten dieselbe Form zweimal; die Baenke unterscheiden sich
   * nur in ihrer Platzierung.
   */
  beginBanks(formation: Formation, matrixA: THREE.Matrix4, matrixB: THREE.Matrix4) {
    uploadSlots(this.buffers, formation);
    const proBank = formation.slotsPerCopy;
    this.u.slotCount.value = Math.min(formation.slotCount, this.maxSlots);
    this.u.slotsPerCopy.value = proBank;
    this.u.bankSplit.value = proBank;
    this.u.dissolveDir.value = formation.dissolveDir;
    this.u.formationSeed.value = this.seed;
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    this.u.formationAge.value = 0;
    this.u.progress.value = 0;
    this.u.formationOn.value = 1;
    this.u.formationMatrix.value.copy(matrixA);
    this.u.formationMatrixB.value.copy(matrixB);

    // Alles loesen, dann beide Baenke der Reihe nach werben.
    this.u.assignLo.value = 0;
    this.u.assignHi.value = 1e9;
    this.renderer.compute(this.releaseKernel);
    this.recruitRange(0, proBank, false);
    this.recruitRange(proBank, this.u.slotCount.value, true);
  }

  /**
   * Eine Bank an einen neuen Ort setzen und dort neu werben.
   * Die andere Bank bleibt unangetastet - deshalb gibt es keine Luecke.
   */
  recycleBank(bank: 0 | 1, matrix: THREE.Matrix4) {
    // NEUE SAAT FUER JEDE BANK.
    //
    // Die Dichte-Lotterie im Assign-Kernel ist hash(index + saat) < dichte -
    // bei gleicher Saat also jedes Mal DIESELBEN Partikel. Innerhalb eines
    // Beats wurde damit ein und dieselbe Teilmenge des Staubs immer wieder
    // eingezogen, waehrend der Rest nie an die Reihe kam: der neue Pfeil
    // bestand buchstaeblich aus den Partikeln des vorigen. Jede Bank bekommt
    // jetzt ihre eigene Ziehung.
    this.u.formationSeed.value = this.seed;
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;

    const proBank = this.u.slotsPerCopy.value;
    const lo = bank === 0 ? 0 : proBank;
    const hi = bank === 0 ? proBank : this.u.slotCount.value;

    this.u.assignLo.value = lo;
    this.u.assignHi.value = hi;
    this.renderer.compute(this.releaseKernel);

    if (bank === 0) this.u.formationMatrix.value.copy(matrix);
    else this.u.formationMatrixB.value.copy(matrix);

    this.recruitRange(lo, hi, true);
  }

  private recruitRange(lo: number, hi: number, nurFreie: boolean) {
    this.u.assignLo.value = lo;
    this.u.assignHi.value = hi;
    this.u.assignOnlyFree.value = nurFreie ? 1 : 0;
    this.renderer.compute(this.assignKernel);
  }

  /** Bindung loesen. Der Staub bleibt, wo er ist, und driftet zurueck. */
  releaseFormation() {
    this.u.assignLo.value = 0;
    this.u.assignHi.value = 1e9;
    this.renderer.compute(this.releaseKernel);
    this.u.formationOn.value = 0;
    this.u.bankSplit.value = 1e9;
    this.u.releaseScatter.value = CONFIG.formation.releaseScatter;
    this.u.dissolveJitter.value = CONFIG.formation.dissolveJitter;
    this.u.drawHead.value = 1;
  }

  /**
   * Erfolgs-Druckwelle an einem Ort IM RAUM (Grundgesetz 6 - kein Vollbild-Blitz).
   * Die Staerke klingt auf der CPU ab, damit der Impuls ueber mehrere Frames wirkt.
   */
  burst(at: THREE.Vector3, strength = 26) {
    this.u.burstOrigin.value.copy(at);
    this.u.burstStrength.value = strength;
  }

  /** Muss jeden Frame laufen, damit die Druckwelle ausklingt. */
  decayBurst(dt: number) {
    if (this.u.burstStrength.value > 0) {
      this.u.burstStrength.value = Math.max(0, this.u.burstStrength.value - dt * 90);
    }
  }
}
