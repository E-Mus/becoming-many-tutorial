/**
 * Prueft die Fortschrittsachse `s` jeder Form und die Geometrie der Ketten.
 *
 * Das ist die Eigenschaft, an der das ganze Konzept haengt: `s` muss so
 * eingebacken sein, dass die Aufloesung in die gemeinte Richtung laeuft. Ein
 * Pfeil, dessen s nicht mit der Zeigerichtung korreliert, frisst sich falsch
 * herum auf - und das faellt am Bildschirm erst spaet auf.
 *
 * Aufruf: npm run check
 */
import { makeArrow } from '../src/formations/shapes/arrow';
import { makeArrowContour } from '../src/formations/shapes/arrowContour';
import { makeRing } from '../src/formations/shapes/ring';
import { makeAperture } from '../src/formations/shapes/aperture';
import { makeThreshold } from '../src/formations/shapes/threshold';
import { chainAnchorZ, repeatAlongZ } from '../src/formations/chain';
import { CONFIG } from '../src/config';

let failed = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? '  OK  ' : ' FEHL '} ${name.padEnd(46)} ${detail}`);
  if (!ok) failed++;
}

/** Pearson-Korrelation zwischen zwei Achsen der Slot-Liste. */
function corr(slots: Float32Array, a: number, b: number) {
  const n = slots.length / 4;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += slots[i * 4 + a]; mb += slots[i * 4 + b]; }
  ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = slots[i * 4 + a] - ma, y = slots[i * 4 + b] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  return num / Math.sqrt(da * db);
}

function sRange(slots: Float32Array) {
  const n = slots.length / 4;
  let lo = Infinity, hi = -Infinity, filled = 0;
  for (let i = 0; i < n; i++) {
    const s = slots[i * 4 + 3];
    if (slots[i * 4] !== 0 || slots[i * 4 + 1] !== 0) filled++;
    if (s < lo) lo = s;
    if (s > hi) hi = s;
  }
  return { lo, hi, filled, n };
}

const N = 4000;

console.log('\nPfeil — s muss entlang der Zeigerichtung (+X) laufen');
const arrow = makeArrow(N, 10);
{
  const r = sRange(arrow);
  const c = corr(arrow, 0, 3); // x gegen s
  check('s liegt in [0,1]', r.lo >= -0.001 && r.hi <= 1.001, `[${r.lo.toFixed(3)}, ${r.hi.toFixed(3)}]`);
  check('s spannt fast den vollen Bereich', r.hi - r.lo > 0.9, `Spanne ${(r.hi - r.lo).toFixed(3)}`);
  check('s korreliert mit +X (Zeigerichtung)', c > 0.99, `r = ${c.toFixed(4)}`);
  check('alle Slots belegt', r.filled > N * 0.98, `${r.filled}/${r.n}`);
}

console.log('\nRing — s muss der Polarwinkel sein, gleichverteilt');
const ring = makeRing(N, 3.5, 0.32);
{
  const r = sRange(ring);
  check('s liegt in [0,1]', r.lo >= -0.001 && r.hi <= 1.001, `[${r.lo.toFixed(3)}, ${r.hi.toFixed(3)}]`);
  const bins = new Array(10).fill(0);
  for (let i = 0; i < N; i++) bins[Math.min(9, Math.floor(ring[i * 4 + 3] * 10))]++;
  const worst = Math.max(...bins.map((b) => Math.abs(b / N - 0.1)));
  check('s ist gleichverteilt ueber den Umfang', worst < 0.02, `groesste Abweichung ${(worst * 100).toFixed(2)}%`);
  let rmin = Infinity, rmax = -Infinity;
  for (let i = 0; i < N; i++) {
    const rad = Math.hypot(ring[i * 4], ring[i * 4 + 1]);
    if (rad < rmin) rmin = rad; if (rad > rmax) rmax = rad;
  }
  check('Radius bleibt in der Roehre', rmin > 3.5 - 0.35 && rmax < 3.5 + 0.35, `${rmin.toFixed(2)}..${rmax.toFixed(2)}`);
}

console.log('\nBlende — s muss vom Rand der Oeffnung nach aussen wachsen');
const holeR = 3, band = 9;
const blende = makeAperture(N, holeR, band);
{
  const r = sRange(blende);
  check('s liegt in [0,1]', r.lo >= -0.001 && r.hi <= 1.001, `[${r.lo.toFixed(3)}, ${r.hi.toFixed(3)}]`);
  let mono = true, minDist = Infinity, maxDist = 0, worst = 0, innen = 0;
  for (let i = 0; i < N; i++) {
    const d = Math.hypot(blende[i * 4], blende[i * 4 + 1]);
    if (d < minDist) minDist = d;
    if (d > maxDist) maxDist = d;
    const expect = Math.min(1, Math.max(0, (d - holeR) / band));
    const ab = Math.abs(expect - blende[i * 4 + 3]);
    if (ab > worst) worst = ab;
    if (ab > 1e-4) mono = false;
    if (d < holeR + band * 0.5) innen++;
  }
  check('kein Slot liegt in der Oeffnung', minDist >= holeR - 0.01,
    `naechster Punkt ${minDist.toFixed(2)} m (Loch r=${holeR})`);
  check('Ring endet beim Band', maxDist <= holeR + band + 0.01,
    `aeusserster Punkt ${maxDist.toFixed(2)} m (Band ${band})`);
  check('s = normierter Abstand vom Oeffnungsrand', mono,
    `groesste Abweichung ${worst.toExponential(1)}`);
  // Die Punkte sollen sich zum Rand der Oeffnung hin verdichten - dort
  // entscheidet sich, wo es durchgeht.
  check('Punkte verdichten sich zur Oeffnung hin', innen > N * 0.6,
    `${(100 * innen / N).toFixed(0)} % in der inneren Haelfte`);
}

console.log('\nPfeil-Kontur — der Deckungsgrad entscheidet, nicht die Partikelzahl');
{
  const L = 20;
  const k = makeArrowContour(N, L);
  const r = sRange(k);
  check('s liegt in [0,1]', r.lo >= -0.001 && r.hi <= 1.001, `[${r.lo.toFixed(3)}, ${r.hi.toFixed(3)}]`);
  check('s korreliert mit +X (Zeigerichtung)', corr(k, 0, 3) > 0.98, `r = ${corr(k, 0, 3).toFixed(4)}`);

  // Alle Punkte muessen dicht an einer der drei Strecken liegen.
  const A = [-0.5 * L, 0], B = [0.2167 * L, 0], S = [0.5 * L, 0];
  const HO = [0.1667 * L, 0.4 * L], HU = [0.1667 * L, -0.4 * L];
  const distSeg = (px: number, py: number, a: number[], b: number[]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t));
  };
  let maxAb = 0;
  for (let i = 0; i < N; i++) {
    const d = Math.min(
      distSeg(k[i * 4], k[i * 4 + 1], A, B),
      distSeg(k[i * 4], k[i * 4 + 1], S, HO),
      distSeg(k[i * 4], k[i * 4 + 1], S, HU));
    if (d > maxAb) maxAb = d;
  }
  check('alle Punkte liegen auf der Kontur', maxAb < 0.12, `groesster Abstand ${maxAb.toFixed(3)} m`);

  // Widerhaken-Verhaeltnis: 0.52 lag auf der Crowding-Grenze und fiel in der
  // Peripherie aus - und das ist skaleninvariant, Naeherkommen half nicht.
  const verh = (0.4 * L) / (0.5 * L);
  check('Widerhaken halten Abstand zur Crowding-Grenze', verh >= 0.7, `Verhaeltnis ${verh.toFixed(2)}`);

  // DIE eigentliche Messgroesse: Deckung auf der eigenen Fussflaeche.
  // Gerechnet mit realistischen 2400 gebundenen Partikeln aus 39 m.
  const gebunden = 2400, dist = 39, punktWinkel = CONFIG.particles.minAngularSize;
  const bogen = 0.7167 * L + 2 * Math.hypot(0.3333 * L, 0.4 * L);
  const abstand = bogen / gebunden;
  const deckung = (Math.PI / 4) * Math.pow(punktWinkel / (abstand / dist), 2);
  check('Kontur deckt satt (>100 %)', deckung > 1,
    `${(100 * deckung).toFixed(0)} % bei ${gebunden} Partikeln aus ${dist} m`);

  // Zum Vergleich dieselbe Partikelzahl gefuellt - so sah es vorher aus.
  const flaeche = 0.237 * L * L;
  const abstandF = Math.sqrt(flaeche / gebunden);
  const deckungF = (Math.PI / 4) * Math.pow(punktWinkel / (abstandF / dist), 2);
  console.log(`         (gefuellt waeren es ${(100 * deckungF).toFixed(0)} % — grauer Nebel)`);
}


console.log('\nSchwelle — der Pfeil muss ein LOCH sein, keine Figur');
{
  const B = 19, H = 13.5, AL = 9;
  const sw = makeThreshold(N, B, H, AL);
  const rs = sRange(sw);
  check('s liegt in [0,1]', rs.lo >= -0.001 && rs.hi <= 1.001, `[${rs.lo.toFixed(3)}, ${rs.hi.toFixed(3)}]`);

  // Kein Slot darf im Pfeil liegen - sonst ist das Loch kein Loch.
  const schaftHalb = AL * 0.1, kopfLang = AL * 0.34, kopfHalb = AL * 0.26;
  const schaftEnde = AL - kopfLang;
  const imPfeil = (x: number, y: number) => {
    const lx = x + AL / 2;
    if (lx < 0 || lx > AL) return false;
    if (lx <= schaftEnde) return Math.abs(y) <= schaftHalb;
    return Math.abs(y) <= kopfHalb * (1 - (lx - schaftEnde) / kopfLang);
  };
  let drin = 0, ausserhalb = 0;
  for (let i = 0; i < N; i++) {
    if (imPfeil(sw[i * 4], sw[i * 4 + 1])) drin++;
    if (Math.abs(sw[i * 4]) > B / 2 + 0.01 || Math.abs(sw[i * 4 + 1]) > H / 2 + 0.01) ausserhalb++;
  }
  check('kein Slot liegt im Pfeil (das Loch ist leer)', drin === 0, `${drin} Verstoesse`);
  check('kein Slot verlaesst den Vorhang', ausserhalb === 0, `${ausserhalb} Verstoesse`);
  const cs = corr(sw, 0, 3);
  check('s korreliert mit +X (Zeigerichtung)', cs > 0.99, `r = ${cs.toFixed(4)}`);

  // Dichte: die fruehere bildfuellende Wand kam auf 3 Punkte je m² und war
  // unsichtbar. Ein Loch liest sich nur in einem wirklich dichten Vorhang.
  const proQm = N / (B * H);
  check('Vorhang ist dicht genug fuer ein Loch', proQm > 12, `${proQm.toFixed(1)} Punkte je m²`);
}


console.log('\nKette — Kopien muessen beim Nachruecken weltfest bleiben');
{
  const spec = CONFIG.formation.chain.arrow;
  const basis = new Float32Array([0, 0, 0, 0.5]);
  const kette = repeatAlongZ(basis, spec.copies, spec.spacing);
  check('repeatAlongZ erzeugt copies Eintraege', kette.length / 4 === spec.copies,
    `${kette.length / 4} von ${spec.copies}`);
  check('Kopien liegen im Abstand spacing',
    kette[6] === -spec.spacing && kette[10] === -2 * spec.spacing,
    `z = 0, ${kette[6]}, ${kette[10]}`);
  check('s bleibt bei allen Kopien gleich',
    kette[3] === 0.5 && kette[7] === 0.5 && kette[11] === 0.5, 'alle 0.5');

  // Der eigentliche Beweis: waehrend der Flieger vorwaerts zieht, duerfen die
  // Kopien nur auf Vielfachen von spacing stehen - also auf denselben
  // Weltpositionen wie zuvor, nie dazwischen. Sonst ruckt die ganze Allee.
  const weltPositionen = new Set<number>();
  let anker = chainAnchorZ(0, spec);
  let spruengeOk = true, abstandOk = true, spruenge = 0;
  for (let schritt = 0; schritt <= 600; schritt++) {
    const flugZ = -schritt * (spec.spacing / 100);
    const a = chainAnchorZ(flugZ, spec);
    if (a !== anker) {
      if (Math.abs(a - anker) !== spec.spacing) spruengeOk = false;
      anker = a;
      spruenge++;
    }
    if (flugZ - a < spec.lead - 1e-9) abstandOk = false;
    for (let c = 0; c < spec.copies; c++) weltPositionen.add(a - c * spec.spacing);
  }
  const aufRaster = [...weltPositionen].every((z) => Math.abs(z % spec.spacing) < 1e-9);
  check('Anker springt nur um genau spacing', spruengeOk, `${spruenge} Spruenge`);
  check('alle Kopien stehen auf dem Weltraster', aufRaster,
    `${weltPositionen.size} Positionen, alle Vielfache von ${spec.spacing}`);
  check('vorderste Kopie haelt den Mindestabstand', abstandOk, `>= ${spec.lead} m`);
}

console.log('\nKetten — muessen in Staub und Buffer passen');
{
  const halbeTiefe = CONFIG.particles.boxSize[2] / 2;
  for (const [name, spec] of Object.entries(CONFIG.formation.chain)) {
    // ACHTUNG: nicht lead + (copies-1)*spacing. Der Anker selbst wandert um bis
    // zu eine Rasterweite (er ist das groesste Vielfache mindestens lead
    // voraus), also steht die hinterste Kopie im schlechtesten Fall bei
    // lead + copies*spacing. Die erste Fassung dieser Pruefung rechnete eine
    // Rasterweite zu wenig und winkte eine Kette durch, deren hintere Kopie in
    // 82 m stand - also weit jenseits des Staubs. Sie bildete sich nie.
    const reichweite = spec.lead + spec.copies * spec.spacing;
    check(`${name}: hinterste Kopie steht noch im Staub`, reichweite < halbeTiefe,
      `${reichweite} m < ${halbeTiefe} m`);
    check(`${name}: Slots passen in den Buffer`,
      spec.copies * spec.slotsPerCopy <= CONFIG.particles.maxSlots,
      `${spec.copies * spec.slotsPerCopy} <= ${CONFIG.particles.maxSlots}`);
  }
}

console.log('\nPfeil-Varianten — Gestalt behalten, Umgebung nicht leerraeumen');
{
  // Das ist die Pruefung, die gefehlt hat. Gemessen war der Hof um einen Pfeil
  // acht Mal leerer als die Welt ringsum (0.006 statt 0.048 frei je m³) - und
  // keine Zeile im Projekt haette das je bemerkt.
  //
  // Die beiden Groessen haengen an denselben drei Zahlen und ziehen
  // gegeneinander: der Pfeil braucht Partikel, der Hof soll sie behalten.
  // Entschieden wird das ueber die WEITE, aus der geworben wird - nicht ueber
  // die Zahl der Partikel im Pfeil. Die ist seine Gestalt und bleibt.
  const [bx, by, bz] = CONFIG.particles.boxSize;
  const dichte = CONFIG.particles.count / (bx * by * bz);

  const pfeile = [
    { name: 'fern', v: CONFIG.varianten.fern },
    { name: 'begleiter', v: CONFIG.varianten.begleiter },
  ];

  for (const { name, v } of pfeile) {
    // Reichweite ist eine KAPSEL um den Pfeil, keine Kugel: jeder Slot wirbt
    // im Umkreis von werbeWeite, und die Slots liegen ueber die ganze Laenge.
    const r = v.werbeWeite;
    const erreichbar = ((4 / 3) * Math.PI * r ** 3 + Math.PI * r * r * v.laenge) * dichte;
    const gebunden = Math.min(v.slots, v.werbeDichte * erreichbar);

    // 1. Bleibt genug Staub stehen? Der Hof DARF sich ausduennen (Grundgesetz
    //    3), aber er darf kein Vakuum werden.
    const bleibt = 1 - v.werbeDichte;
    check(`${name}: Hof behaelt mehr als die Haelfte seines Staubs`, bleibt > 0.5,
      `${(100 * bleibt).toFixed(0)} % bleiben frei (${Math.round(erreichbar - gebunden)} von ${Math.round(erreichbar)})`);

    // 2. Und bekommt der Pfeil trotzdem genug, um eine Figur zu sein? Die
    //    Fassung, die im Bild gut aussah, hatte rund 5300 Partikel je Bank -
    //    darunter zerfaellt die Flaeche in Einzelpunkte.
    check(`${name}: Pfeil bekommt genug Partikel fuer eine Figur`, gebunden > 4_000,
      `${Math.round(gebunden)} Partikel auf ${v.slots} Slots`);

    // 3. Locality (Grundgesetz 2): wer viel weiter wirbt, als die Form lang
    //    ist, holt Partikel sichtbar von ausserhalb heran.
    check(`${name}: Werbeweite bleibt in der Groessenordnung der Form`, r <= v.laenge * 3,
      `${r} m fuer einen ${v.laenge}-m-Pfeil`);
  }
}

console.log(failed === 0 ? '\nAlle Formen in Ordnung.\n' : `\n${failed} Pruefung(en) fehlgeschlagen.\n`);
process.exit(failed === 0 ? 0 : 1);
