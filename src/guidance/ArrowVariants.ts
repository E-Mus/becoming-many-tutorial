import * as THREE from 'three/webgpu';
import { CONFIG } from '../config';
import { cached, type Formation } from '../formations/Formation';
import { makeArrow } from '../formations/shapes/arrow';
import { repeatAlongZ } from '../formations/chain';
import { forwardOf, rightOf, upOf } from '../flight/Flight';
import type { GuidanceContext, GuidanceMode, GuidanceReport, GuidanceTask } from './GuidanceMode';
import { TaskProgress } from './progress';

/**
 * Zwei Antworten auf dieselbe Frage: wie zeigt man jemandem den Weg, der sich
 * ununterbrochen vorwaerts bewegt?
 *
 * WAS VORHER SCHEITERTE, und warum:
 *  - Enge Kette flacher Pfeile (alle 12 m): hektisch, es "spawnt" dauernd
 *    direkt vor der Nase.
 *  - Extrudierter Pfeil-"Tunnel": unbrauchbar. Man blickt entlang der
 *    Extrusionsachse, und ein ausgezogener Koerper hat aus dieser Richtung
 *    keine Silhouette. Statt eines Pfeils sieht man radiale Schlieren.
 *  - Grosse Wand mit Loch: 3 Partikel je Quadratmeter, unsichtbar.
 *
 * DIE DREI EINSICHTEN, auf denen die beiden hier stehen:
 *  1. Wo Staub EXISTIERT und wie weit man ihn SIEHT, sind zwei verschiedene
 *     Dinge. Ist die Box groesser als die Sichtweite, entstehen Formen ausser
 *     Sicht und blenden beim Naeherkommen ein - dann gibt es kein sichtbares
 *     Erscheinen mehr, und die Abstaende duerfen gross sein.
 *  2. Eine Form muss FLACH und QUER ZUR BLICKRICHTUNG stehen, sonst hat sie
 *     keine Silhouette. Alles hier ist eine Flaeche, kein Volumen.
 *  3. Seit der Flug frei ist, gibt es keine Weltachse "vorne" mehr. Alles wird
 *     entlang der aktuellen Flugachse gesetzt und quer dazu ausgerichtet.
 */

// ---------------------------------------------------------------------------
// Gemeinsames
// ---------------------------------------------------------------------------

/** Zielrichtung der Aufgabe relativ zum aktuellen Flugkoerper. */
export function taskDirection(
  task: GuidanceTask,
  flight: GuidanceContext['flight'],
  out = new THREE.Vector3(),
) {
  if (task.axis === 'x') return rightOf(flight, out).multiplyScalar(task.sign);
  return upOf(flight, out).multiplyScalar(task.sign);
}

const V = CONFIG.varianten;

const _f = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _d = new THREE.Vector3();

/**
 * Eine Form quer zur Flugachse aufstellen.
 *
 * Der Pfeil liegt lokal in der XY-Ebene. Damit er ueberhaupt eine Silhouette
 * hat, muss seine Ebene senkrecht zur Blickrichtung stehen - und seine lokale
 * +X-Achse soll moeglichst in die Zielrichtung zeigen, damit ein Pfeil "nach
 * rechts" auch im Bild nach rechts weist.
 *
 * Die Zeigerichtung liefert zeigeRichtung() - sie ist bereits normiert und
 * liegt in der Ebene.
 */
function stelleQuer(
  m: THREE.Matrix4,
  ort: THREE.Vector3,
  blick: THREE.Vector3,
  zeige: THREE.Vector3,
) {
  _z.copy(blick).negate();                        // lokales +Z zeigt zum Flieger
  _x.copy(zeige);                                 // lokales +X = Zeigerichtung
  _y.crossVectors(_z, _x).normalize();
  m.makeBasis(_x, _y, _z);
  m.setPosition(ort);
}

/**
 * Wohin der Pfeil im BILD zeigt.
 *
 * Die Zielrichtung kommt aus der Rechts-/Oben-Achse des Flugkoerpers und liegt
 * damit bereits quer zur Blickrichtung. `letzte` bleibt als Sicherung erhalten,
 * falls eine numerisch fast entartete Basis ankommt.
 */
function zeigeRichtung(
  ziel: THREE.Vector3,
  blick: THREE.Vector3,
  letzte: THREE.Vector3,
  out: THREE.Vector3,
) {
  out.copy(ziel).addScaledVector(blick, -ziel.dot(blick));
  // 0.09 = |Projektion| > 0.3, also gut 17 Grad neben der Blickachse. Darunter
  // dreht die Projektion schneller, als das Auge sie als Richtung lesen kann.
  if (out.lengthSq() > 0.09) {
    out.normalize();
    letzte.copy(out);
    return out;
  }
  if (letzte.lengthSq() > 1e-6) {
    out.copy(letzte).addScaledVector(blick, -letzte.dot(blick));
    if (out.lengthSq() > 1e-6) return out.normalize();
  }
  // Allererster Aufruf und schon ausgerichtet: irgendeine Achse quer zum Blick.
  out.set(0, 1, 0).addScaledVector(blick, -blick.y);
  if (out.lengthSq() < 1e-6) out.set(1, 0, 0).addScaledVector(blick, -blick.x);
  return out.normalize();
}

/**
 * Ort `distanz` Meter voraus - entlang des ERWARTETEN FLUGPFADS.
 *
 * Eine Gerade genuegt hier nicht. Wer mit voller Rate kurvt, fliegt einen Kreis
 * von rund 14 m Radius; ein Punkt "30 m geradeaus" liegt dann ausserhalb dieses
 * Kreises und ist gar nicht erreichbar. Gemessen kam bei Vollkurve kein
 * einziger Formpunkt mehr ins Bild.
 *
 * Deshalb wird der Pfad in wenigen Schritten integriert, so wie er bei
 * gleichbleibender Steuerung tatsaechlich verliefe. Der Daempfungsfaktor traegt
 * dem Rechnung, dass niemand sekundenlang exakt dieselbe Kurve haelt.
 *
 * Das ist kein Mitfliegen: einmal gesetzt, steht die Form unverrueckbar im Raum.
 */
function ortVoraus(ctx: GuidanceContext, distanz: number, out: THREE.Vector3) {
  const f = ctx.flight;
  const c = CONFIG.flight;
  const tempo = Math.max(f.forwardSpeed, 1);
  const SCHRITTE = 8;
  const dtP = distanz / tempo / SCHRITTE;
  const daempfung = 0.6;

  // Die Kurve darf die Platzierung NEIGEN, aber nicht herumwickeln.
  //
  // Ohne diese Grenze war die Integration bei langen Strecken sinnlos: bei
  // voller Drehrate (0.9 rad/s) und 13 m/s ist der Flugkreis nur 14 m weit,
  // 68 m Bogen sind darauf 4.7 rad - also mehr als eine Dreiviertelrunde.
  // GEMESSEN landete eine so gesetzte Bank 48 m SEITLICH und 0.5 m HINTER dem
  // Flieger. Sie galt damit sofort als passiert und wurde im naechsten
  // zulaessigen Frame wieder weggeworfen und neu gesetzt - beide Baenke, im
  // Abstand von 0.2 s. Das war das "die Pfeile aendern sich dauernd, sobald
  // ich lenke": nicht die Schwelle war zu scharf, der Zielort war es.
  //
  // 0.6 rad ueber die ganze Strecke ergeben bei 68 m einen Ort rund 64 m
  // voraus und 20 m zur Seite - er lehnt sichtbar in die Kurve und bleibt
  // trotzdem vor einem.
  const MAX_DREHUNG = 0.6;
  const zeit = distanz / tempo;
  const zaehmen = (rate: number) => {
    const gesamt = rate * zeit * daempfung;
    if (Math.abs(gesamt) <= MAX_DREHUNG) return rate * daempfung;
    return (Math.sign(gesamt) * MAX_DREHUNG) / zeit;
  };
  const gierRate = zaehmen(f.yawRate);
  const nickRate = zaehmen(f.pitchRate);

  let gier = f.yaw;
  let nick = f.pitch;
  out.copy(f.position);
  for (let k = 0; k < SCHRITTE; k++) {
    gier += gierRate * dtP;
    nick = Math.min(c.maxPitch, Math.max(-c.maxPitch, nick + nickRate * dtP));
    const cp = Math.cos(nick);
    out.x += -Math.sin(gier) * cp * tempo * dtP;
    out.y += Math.sin(nick) * tempo * dtP;
    out.z += -Math.cos(gier) * cp * tempo * dtP;
  }
  return out;
}

/**
 * Zwei Baenke im Wechsel: waehrend man auf die eine zufliegt, wird die andere
 * weit voraus neu gesetzt. Dadurch ist der Abstand frei waehlbar (eine Kette
 * war an ihr Raster gebunden) und es entsteht nie eine Luecke.
 *
 * Entscheidend fuer die Ruhe im Bild: neu gesetzt wird jenseits der Sichtweite.
 * Man sieht also nie, wie etwas entsteht - nur, wie es aus der Ferne einblendet.
 */
abstract class ZweiBankBasis implements GuidanceMode {
  abstract readonly id: GuidanceMode['id'];
  abstract readonly label: string;
  protected task!: GuidanceTask;
  protected progress = new TaskProgress();
  private matA = new THREE.Matrix4();
  private matB = new THREE.Matrix4();
  private ortA = new THREE.Vector3();
  private ortB = new THREE.Vector3();
  private ziel = new THREE.Vector3();
  /** Letzte tragfaehige Zeigerichtung - siehe zeigeRichtung(). */
  private letzteZeige = new THREE.Vector3();
  /**
   * Reststrecke bis zum Auswechseln, in Metern.
   *
   * Eine Bank wird ersetzt, wenn man die Strecke geflogen ist, auf die sie
   * gesetzt wurde - nicht, wenn sie aus dem Blick wandert. Siehe update().
   */
  private restA = 0;
  private restB = 0;

  protected abstract readonly spawnWeite: number;
  protected abstract wolke(ctx: GuidanceContext): Float32Array;
  protected abstract readonly slotsProBank: number;
  /** Aus welcher Reichweite geworben wird und wie viel davon mitkommt.
   *  Siehe CONFIG.varianten - das ist der Regler fuer die Aushoehlung. */
  protected abstract readonly werbeWeite: number;
  protected abstract readonly werbeDichte: number;
  /** Soll sich die Form vor den Augen aufloesen? */
  protected readonly zehrtSichAuf: boolean = true;

  begin(task: GuidanceTask, ctx: GuidanceContext) {
    this.task = task;
    this.progress.begin(task, ctx.input, this.presentationDelay(ctx));
    taskDirection(task, ctx.flight, this.ziel);
    this.letzteZeige.set(0, 0, 0);
    ctx.uniforms.bindMode.value = 0;

    // Beide Baenke tragen dieselbe Form; nur die Platzierung unterscheidet sie.
    // Vor beginBanks setzen: der Assign-Kernel liest beide beim Werben, und
    // frueher stand hier noch der Vorgabewert aus CONFIG (0.95) - die erste
    // Bank raeumte also auch dann leer, wenn die Variante es gar nicht wollte.
    ctx.uniforms.recruitFar.value = this.werbeWeite;
    ctx.uniforms.recruitDensity.value = this.werbeDichte;
    ctx.uniforms.werbeFernAb.value = CONFIG.particles.viewFar;

    const slots = repeatAlongZ(this.wolke(ctx), 2, 0);

    // BEIDE Baenke entstehen jenseits der Sichtweite - auch die allererste.
    //
    // Frueher stand Bank A beim Beginn 17 m voraus und Bank B 51 m, bei einer
    // Sichtweite von 52 m. Man sah also bei jedem Aufgabenwechsel zu, wie sich
    // ein Pfeil aus dem Nichts zusammensetzte, waehrend der eben entlassene
    // noch danebenstand. Genau das sollte nie passieren.
    //
    // Bank A entsteht deshalb dort, wo auch jede spaetere entsteht: 2 x
    // spawnWeite voraus, 16 m ausserhalb der Sicht. Bank B gibt es anfangs noch
    // gar nicht - sie wird erst nach einer halben Spannweite geboren, und zwar
    // ebenfalls jenseits der Sicht. Von da an ist die Reihe gleichmaessig
    // getaktet: alle spawnWeite Meter ein Zeichen, jedes davon unbeobachtet
    // entstanden.
    this.setze(this.matA, this.ortA, ctx, this.spawnWeite * 2);
    this.parke(this.matB, this.ortB, ctx);
    this.restA = this.zyklus;
    this.restB = this.zyklus * 0.5;

    const formation: Formation = {
      slots,
      slotCount: 2 * this.slotsProBank,
      slotsPerCopy: this.slotsProBank,
      dissolveDir: 1,
      origin: new THREE.Vector3(0, 0, 0),
    };
    ctx.field.beginBanks(formation, this.matA, this.matB);
  }

  private presentationDelay(ctx: GuidanceContext) {
    const bisSichtbar = Math.max(0, this.spawnWeite * 2 - CONFIG.particles.viewFar)
      / Math.max(ctx.flight.forwardSpeed, 1);
    const bisGeformt = CONFIG.formation.appearSpread + CONFIG.formation.appearWidth;
    return Math.max(bisSichtbar, bisGeformt);
  }

  private setze(m: THREE.Matrix4, ort: THREE.Vector3, ctx: GuidanceContext, distanz: number) {
    ortVoraus(ctx, distanz, ort);
    forwardOf(ctx.flight, _f);
    taskDirection(this.task, ctx.flight, this.ziel);
    stelleQuer(m, ort, _f, zeigeRichtung(this.ziel, _f, this.letzteZeige, _d));
  }

  /**
   * Eine Bank stilllegen, bis sie an der Reihe ist.
   *
   * Weit hinter dem Flieger liegt kein Staub mehr - die ambiente Box ist 140 m
   * gross und folgt ihm. Eine Bank dort wirbt niemanden und ist auch nicht zu
   * sehen. Das ist billiger und ehrlicher, als eine halbe Formation zu bauen.
   */
  private parke(m: THREE.Matrix4, ort: THREE.Vector3, ctx: GuidanceContext) {
    forwardOf(ctx.flight, _f);
    taskDirection(this.task, ctx.flight, this.ziel);
    ort.copy(ctx.flight.position).addScaledVector(_f, -200);
    stelleQuer(m, ort, _f, zeigeRichtung(this.ziel, _f, this.letzteZeige, _d));
  }

  /**
   * Wie weit man zwischen zwei Geburten derselben Bank fliegt.
   *
   * 2 x spawnWeite ist die Strecke bis zur Bank selbst. Der NACHLAUF kommt
   * dazu, damit eine Bank nicht in dem Moment entlassen wird, in dem man durch
   * sie hindurchfliegt: ihre Partikel blieben sonst als Wolke mitten im Bild
   * stehen. Nach dem Nachlauf liegt sie hinter dem Ruecken, und was dort
   * zerfaellt, sieht niemand.
   */
  private static readonly NACHLAUF = 24;
  private get zyklus() { return this.spawnWeite * 2 + ZweiBankBasis.NACHLAUF; }

  update(ctx: GuidanceContext): GuidanceReport {
    // WANN EIN PFEIL AUSGEWECHSELT WIRD: allein nach GEFLOGENER STRECKE.
    //
    // Vorher entschied das der Blickwinkel - passiert (dot < 3 m) oder mehr als
    // 80 Grad neben der Achse. Beides sind Aussagen darueber, wohin man SCHAUT,
    // und beide feuerten genau dann, wenn man anfing, dem Pfeil zu folgen.
    // Gemessen im Vollkurvenflug: 13 Neuplatzierungen in 12 Sekunden, also alle
    // 1.2 s - waehrend eine frisch gesetzte Bank aus 68 m erst nach 1.2 s
    // ueberhaupt in Sichtweite (52 m) kommt. Man sah in der Kurve deshalb
    // ueberhaupt keinen Pfeil mehr, nur ein Flackern.
    //
    // Die Strecke kennt keine Blickrichtung. Jede Bank bekommt beim Setzen die
    // Distanz mit, auf die sie gesetzt wurde, und wird erst faellig, wenn man
    // sie abgeflogen hat. Geradeaus ergibt das denselben Takt wie bisher (alle
    // 34 m eine neue, also gut 2.6 s); in der Kurve denselben - und nie mehr
    // einen Wechsel, den man selbst durch Lenken ausgeloest hat.
    //
    // Eine Bank landet bei 2 x spawnWeite voraus - deshalb muss spawnWeite
    // unter der halben Boxausdehnung bleiben, sonst entsteht sie ausserhalb des
    // Staubs und bildet sich nie.
    const geflogen = ctx.flight.forwardSpeed * ctx.dt;
    this.restA -= geflogen;
    this.restB -= geflogen;

    // Nie beide im selben Frame - sonst entsteht doch eine Luecke.
    if (this.restA <= 0) {
      this.setze(this.matA, this.ortA, ctx, this.spawnWeite * 2);
      ctx.field.recycleBank(0, this.matA);
      this.restA = this.zyklus;
    } else if (this.restB <= 0) {
      this.setze(this.matB, this.ortB, ctx, this.spawnWeite * 2);
      ctx.field.recycleBank(1, this.matB);
      this.restB = this.zyklus;
    }

    const p = this.progress.step(ctx.input, ctx.dt);
    // Zehrt sich die Form nicht auf, bleibt der Shader-Fortschritt auf 0 - man
    // fliegt einfach hindurch, und die Rueckmeldung ist, dass keine neuen mehr
    // kommen.
    ctx.uniforms.progress.value = this.zehrtSichAuf ? p : 0;
    ctx.uniforms.recruitFar.value = this.werbeWeite;
    ctx.uniforms.recruitDensity.value = this.werbeDichte + this.task.intensity * 0.15;
    ctx.uniforms.werbeFernAb.value = CONFIG.particles.viewFar;
    return { progress: p, completed: p >= 1, event: null };
  }

  end(_r: 'success' | 'timeout' | 'skip', ctx: GuidanceContext) {
    ctx.field.releaseFormation();
    ctx.uniforms.recruitFar.value = CONFIG.formation.recruitFar;
    ctx.uniforms.recruitDensity.value = CONFIG.formation.recruitDensity;
    ctx.uniforms.werbeFernAb.value = 0;
  }
}

// ---------------------------------------------------------------------------
// 1) Fern - flache Pfeile, weit auseinander, ohne Aufloesen
// ---------------------------------------------------------------------------

/**
 * Grosse flache Pfeile in weitem Abstand. Man fliegt einfach hindurch.
 *
 * Der Pfeil loest sich NICHT vor den Augen auf; die Rueckmeldung ist, dass
 * keine neuen mehr kommen, sobald die Aufgabe erledigt ist.
 */
export class FarArrowMode extends ZweiBankBasis {
  readonly id = 'far' as const;
  readonly label = 'Fern';
  protected readonly spawnWeite = V.fern.spawnWeite;
  protected readonly slotsProBank = V.fern.slots;
  protected readonly werbeWeite = V.fern.werbeWeite;
  protected readonly werbeDichte = V.fern.werbeDichte;
  protected readonly zehrtSichAuf = false;
  protected wolke(): Float32Array {
    return cached(`fern:${V.fern.laenge}`, () => makeArrow(V.fern.slots, V.fern.laenge));
  }
}

// ---------------------------------------------------------------------------
// 2) Begleiter - fliegt mit und bleibt beim Aufloesen im Raum stehen
// ---------------------------------------------------------------------------

/**
 * Der Pfeil fliegt die ganze Zeit vor einem her - und bleibt genau dann im
 * Raum stehen, wenn er sich aufloest.
 *
 * Waehrend er gebunden ist, ziehen seine Partikel mit; er ist ein Schwarm, der
 * einen begleitet. Loest er sich auf, verwurzeln sich die entlassenen Partikel
 * dort, wo sie gerade stehen - mit weniger Streuung als sonst, damit die Spur
 * erkennbar bleibt. Der Pfeil bleibt also im Raum zurueck, waehrend man
 * weiterfliegt.
 *
 * Das ist die einzige Variante, die bewusst gegen Grundgesetz 6 verstoesst -
 * sie ist an den Flieger gekoppelt. Der Bruch ist der Preis dafuer, dass gar
 * nichts mehr entstehen oder vergehen muss, und die Aufloesung macht ihn
 * wieder gut: am Ende gehoert der Pfeil wieder ganz dem Raum.
 */
export class EscortArrowMode implements GuidanceMode {
  readonly id = 'escort' as const;
  readonly label = 'Begleiter';
  private task!: GuidanceTask;
  private progress = new TaskProgress();
  private matrix = new THREE.Matrix4();
  private ziel = new THREE.Vector3();
  private letzteZeige = new THREE.Vector3();
  private ort = new THREE.Vector3();

  begin(task: GuidanceTask, ctx: GuidanceContext) {
    this.task = task;
    const presentationDelay = CONFIG.formation.appearSpread + CONFIG.formation.appearWidth;
    this.progress.begin(task, ctx.input, presentationDelay);
    taskDirection(task, ctx.flight, this.ziel);
    this.letzteZeige.set(0, 0, 0);

    const slots = cached(`begleiter:${V.begleiter.laenge}`, () =>
      makeArrow(V.begleiter.slots, V.begleiter.laenge));
    ctx.uniforms.recruitFar.value = V.begleiter.werbeWeite;
    ctx.uniforms.recruitDensity.value = V.begleiter.werbeDichte;
    const formation: Formation = {
      slots,
      slotCount: V.begleiter.slots,
      slotsPerCopy: V.begleiter.slots,
      dissolveDir: 1,
      origin: new THREE.Vector3(0, 0, 0),
    };
    ctx.uniforms.bindMode.value = 0;
    this.platziere(ctx);
    ctx.field.beginFormation(formation, this.matrix);
    // Kraeftig streuen. Mit wenig Streuung behielten die Partikel ihre
    // Anordnung bei - sie hatten sich ja alle gleich verhalten - und standen
    // hinterher als Pfeil im Raum, als haetten sie sich neu gebildet. Ein
    // Zerfall muss auch wirklich einer sein.
    ctx.uniforms.releaseScatter.value = 6;
    // Zusaetzlich zeitlich auseinanderziehen: wer gleichzeitig loslaesst,
    // bleibt in Formation.
    ctx.uniforms.dissolveJitter.value = 0.28;
  }

  private platziere(ctx: GuidanceContext) {
    forwardOf(ctx.flight, _f);
    taskDirection(this.task, ctx.flight, this.ziel);
    this.ort.copy(ctx.flight.position).addScaledVector(_f, V.begleiter.abstand);
    stelleQuer(this.matrix, this.ort, _f, zeigeRichtung(this.ziel, _f, this.letzteZeige, _d));
  }

  update(ctx: GuidanceContext): GuidanceReport {
    // Mitwandern: die Platzierung folgt dem Flieger, die Partikel folgen ihr.
    this.platziere(ctx);
    ctx.uniforms.formationMatrix.value.copy(this.matrix);

    const p = this.progress.step(ctx.input, ctx.dt);
    ctx.uniforms.progress.value = p;
    ctx.uniforms.recruitFar.value = V.begleiter.werbeWeite;
    ctx.uniforms.recruitDensity.value = V.begleiter.werbeDichte + this.task.intensity * 0.15;
    return { progress: p, completed: p >= 1, event: null };
  }

  end(_r: 'success' | 'timeout' | 'skip', ctx: GuidanceContext) {
    ctx.field.releaseFormation();
    ctx.uniforms.recruitFar.value = CONFIG.formation.recruitFar;
    ctx.uniforms.recruitDensity.value = CONFIG.formation.recruitDensity;
  }
}
