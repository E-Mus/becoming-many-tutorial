// ---------------------------------------------------------------------------
// TSL-MERKZETTEL:
//   mix(a, b, t)          ===  t.mix(a, b)        <- Empfaenger ist der FAKTOR
//   smoothstep(lo, hi, x) ===  x.smoothstep(lo, hi)
//   .mod() ist WGSL '%' (truncated), NICHT GLSL mod (floored)
// Bei drei Argumenten immer die Funktionsform. Zuweisung per .assign().
// ---------------------------------------------------------------------------
import {
  Fn, If, abs, clamp, deltaTime, exp, float, hash, instanceIndex, length,
  max, min, mix, normalize, smoothstep, sqrt, time, uint, vec2, vec3, vec4,
} from 'three/tsl';
import type { Buffers } from './buffers';
import type { Uniforms } from '../core/Uniforms';
import { ambientHome } from './tsl/ambient';
import { driftField } from './tsl/drift';
import { floorMod } from './tsl/floorMod';
import { bindFactor } from './tsl/dissolve';
import { nearestOnSegment } from './tsl/stroke';

export function buildUpdateKernel(b: Buffers, u: Uniforms, count: number) {
  return Fn(() => {
    const i = instanceIndex;

    const home = b.home.element(i);
    const meta = b.meta.element(i); // x=recruit y=slotIdx z=Versatz w=Erscheinungszeit
    const pos = b.pos.element(i);
    const vel = b.vel.element(i);

    // Nie mehr als 1/30 s simulieren - ein Frame-Hänger darf die Feder nicht sprengen.
    const dt = min(deltaTime, float(1 / 30)).toVar();

    // ---- 1. ambiente Heimat, toroidal um den Flieger gewickelt ----------------
    const ambient = ambientHome(
      home.xyz, u.flyerPos, u.boxSize, time,
      u.noiseScale, u.noiseSpeed, u.driftAmp,
    ).toVar();

    // ---- 1b. Wer eine Form verlaesst, bleibt liegen -------------------------
    // Die ambiente Heimat ist die Gitterkopie, die dem FLIEGER am naechsten
    // liegt - nicht dem Partikel. Ein Partikel, das eine Form verlaesst und
    // hinter dem Flieger zurueckbleibt, bekam dadurch ein Ziel VOR ihm und
    // schoss durch die Kamera davon (gemessen: 17 m Sprung im Moment des
    // Loesens, danach 35 m Wanderung). Das ergibt physikalisch keinen Sinn.
    //
    // Die Bedingung ist bewusst ENG. Zwei weitere Fassungen sind daran
    // gescheitert, dass sie zu viel erfasst haben:
    //   - "jedes ungebundene Partikel weit von seiner Heimat" pinnte beim
    //     ersten Frame das gesamte Feld im Ursprung fest.
    //   - dieselbe Regel ohne Blend-Fenster strandete Partikel, die gerade
    //     toroidal umlaufen wollten (dort ist der Abstand eine ganze
    //     Boxlaenge). Das Feld schwankte daraufhin um 161 % und duennte vor
    //     dem Flieger aus.
    // Erfasst wird deshalb nur: Punktwolken-Modus, Bindung im Abklingen, von
    // der Formation nicht mehr gewollt. Diese drei Bedingungen genuegen -
    // ruhender Staub hat vel.w = 0 und ist damit ohnehin ausgeschlossen, egal
    // wie weit seine Heimat liegt.
    //
    // Eine Obergrenze fuer den Abstand gab es hier einmal, um Umlaeufe
    // auszunehmen. Sie war nicht noetig und richtete Schaden an: Partikel mit
    // weiter Heimat fielen durch das Raster, bekamen den vollen Federruck und
    // schossen mit bis zu 45 m/s davon - genau der Sprengeffekt hinter dem
    // Ruecken.
    const slotFrueh = b.slots.element(uint(meta.y));
    const lebtNoch = bindFactor(
      slotFrueh.w, u.progress, u.dissolveDir, u.dissolveWidth, u.dissolveJitter,
    );
    const willBinden = meta.x.mul(u.formationOn).mul(lebtNoch);
    const abstandHeimat = ambient.distance(pos.xyz);
    If(u.bindMode.lessThan(0.5)
      .and(vel.w.greaterThan(0.05))
      .and(willBinden.lessThan(0.5))
      .and(abstandHeimat.greaterThan(2)), () => {
      // EIN ENTLASSENER PARTIKEL BEHAELT SEINE HEIMAT.
      //
      // Hier stand einmal das Gegenteil: er bekam eine NEUE Heimat an seinem
      // jetzigen Ort (plus releaseScatter, ganze 1.0 m Streuung). Das sollte
      // den langen Rueckweg ersparen - der Preis war aber, dass jede abgelegte
      // Form ihre Gestalt DAUERHAFT als Dichte-Narbe in den Raum brannte,
      // waehrend die Gegend, aus der sie geworben hatte, fuer immer duenner
      // blieb. Gemessen im laufenden Stueck: 713 von 818 Partikeln der
      // dichtesten sichtbaren Zelle hatten ihre Heimat in EINER einzigen
      // Heimatzelle, bei einem Feld, das beim Start ueber alle 2744 Zellen
      // gleichverteilt war. Mit jedem Pfeil kam eine Narbe dazu, und genau das
      // sah man: ab dem fuenften Zeichen haeuften sich Partikel, und es wurde
      // von Pfeil zu Pfeil schlimmer.
      //
      // Jetzt geht er dorthin zurueck, wo er hergekommen ist. Der Raum ist
      // danach wieder genau so gefuellt wie vorher - er ist eine Konstante,
      // keine Ansammlung von Spuren. Der Rueckweg kostet ein paar Sekunden;
      // weil eine Bank erst eine Nachlaufstrecke HINTER dem Flieger entlassen
      // wird, laeuft er ausser Sicht ab.
      //
      // Nur die Geschwindigkeit wird beruhigt, damit der Weg heim aus der Ruhe
      // beginnt und nicht als Ruck.
      vel.w.assign(float(0));
      vel.xyz.assign(vel.xyz.mul(0.06));
    });

    // ---- 2a. Ziel aus der Punktwolke (Ketten) --------------------------------
    const slot = b.slots.element(uint(meta.y));
    // Zwei unabhaengig platzierte Baenke. Beide Ziele werden gerechnet und
    // ausgewaehlt - zwei Matrixmultiplikationen sind billiger als eine
    // Verzweigung, und TSL kann Matrizen ohnehin nicht auswaehlen.
    const zielA = u.formationMatrix.mul(vec4(slot.xyz, 1.0)).xyz;
    const zielB = u.formationMatrixB.mul(vec4(slot.xyz, 1.0)).xyz;
    const istB = meta.y.greaterThanEqual(u.bankSplit).select(float(1), float(0));
    const slotTarget = mix(zielA, zielB, istB);

    // GRUNDGESETZ 5: der Versatz staffelt den BEWEGUNGSBEGINN, nicht die Deckkraft.
    // Eine Form baut sich als Versammlung auf, nie als Einblendung.
    // Der Zufallsanteil war mit 0.35 s fast vierzig Prozent der Staffelung und
    // uebertoente damit die gerichtete Versammlung: man sah kein Schreiben,
    // sondern ein Auftauchen. Er bleibt drin - ganz ohne wuerde aus dem Schwarm
    // ein Rasterzeilenwisch - aber nur noch als Beimischung.
    const startAt = mix(float(0), slot.w, u.appearSpread).add(meta.z.mul(0.08));
    // Gemessen ab der EIGENEN Erscheinungszeit (meta.w), nicht ab dem Beginn
    // der Formation: eine Kette platziert sich beim Vorwaertsfliegen immer
    // wieder neu, und die frisch hinzukommende Kopie soll sich versammeln
    // duerfen, waehrend die uebrigen unbeirrt stehen bleiben.
    const eigenesAlter = u.formationAge.sub(meta.w);
    const slotAppear = smoothstep(float(0), u.appearWidth, eigenesAlter.sub(startAt));
    const slotAlive = bindFactor(slot.w, u.progress, u.dissolveDir, u.dissolveWidth, u.dissolveJitter);
    const slotBind = meta.x.mul(slotAlive).mul(slotAppear);

    // ---- 2b. Ziel aus dem Strichzug (Tunnel, Fluss) --------------------------
    // Kein Slot, keine Zuweisung, kein Erscheinen: der Strich ist ein
    // Raumbereich. Wer hineingeraet, rastet ein; wer hinten herausfaellt, wird
    // wieder Welt. Die Form kann so mitwandern, ohne dass ein Partikel mitfliegt.
    const flach = vec3(1, 1, float(1).sub(u.strokeKeepZ));
    const pf = ambient.mul(flach);

    const strokeQ = vec3(1e6, 1e6, 1e6).toVar();
    const strokeD = float(1e9).toVar();
    const paare: Array<[unknown, unknown]> = [
      [u.segA0, u.segB0], [u.segA1, u.segB1], [u.segA2, u.segB2], [u.segA3, u.segB3],
    ];
    for (const [a, b2] of paare) {
      const q = nearestOnSegment(pf, (a as any).mul(flach), (b2 as any).mul(flach));
      const d = q.distance(pf);
      If(d.lessThan(strokeD), () => {
        strokeD.assign(d);
        strokeQ.assign(q);
      });
    }

    // Der Strich braucht Koerper, sonst waere er ein mathematisch duenner Faden.
    const dicke = vec3(
      hash(i.add(4001)).sub(0.5),
      hash(i.add(4002)).sub(0.5),
      hash(i.add(4003)).sub(0.5),
    ).mul(u.strokeThickness).mul(flach);
    const strokeTarget = vec3(
      strokeQ.x.add(dicke.x),
      strokeQ.y.add(dicke.y),
      mix(strokeQ.z.add(dicke.z), ambient.z, u.strokeKeepZ),
    );

    // z-Fenster mit weichen Kanten: vorne waechst der Staub herein, hinten
    // faellt er heraus - genau das ersetzt Erscheinen und Vergehen.
    const zVoraus = u.flyerPos.z.sub(ambient.z);
    const fenster = smoothstep(u.strokeZNear.sub(float(6)), u.strokeZNear.add(float(2)), zVoraus)
      .mul(float(1).sub(smoothstep(u.strokeZFar.sub(float(8)), u.strokeZFar, zVoraus)));

    // Einfangradius darf nach hinten wachsen: dann buendelt das ferne Ende mehr
    // Staub und liest sich als eigenes, groesseres Zeichen.
    const radius = mix(u.strokeCapture, u.strokeCaptureFar,
      clamp(zVoraus.div(max(u.strokeZFar, float(1e-3))), float(0), float(1)));
    const imStrich = float(1).sub(smoothstep(radius.mul(0.75), radius, strokeD));

    // Fortschrittsachse: wie weit liegt mein Platz entlang der Zeigerichtung?
    const sStroke = clamp(
      strokeTarget.sub(u.progOrigin).dot(u.progDir).div(max(u.progLen, float(1e-3))),
      float(0), float(1),
    );
    const strokeAlive = bindFactor(sStroke, u.progress, u.dissolveDir, u.dissolveWidth, u.dissolveJitter);
    // Der Zeichenkopf laeuft die Achse entlang; was hinter ihm liegt, ist da.
    const gezeichnet = float(1).sub(smoothstep(u.drawHead, u.drawHead.add(0.06), sStroke));
    const strokeBind = imStrich.mul(fenster).mul(strokeAlive).mul(gezeichnet);

    // ---- 3. Bindung ----------------------------------------------------------
    const target = mix(slotTarget, strokeTarget, u.bindMode).toVar();
    const bindGoal = mix(slotBind, strokeBind, u.bindMode).mul(u.formationOn);

    const blendPrev = vel.w.toVar();
    const blend = blendPrev.add(bindGoal.sub(blendPrev).mul(min(dt.mul(u.bindRate), float(1)))).toVar();

    // ---- 4. gewuenschte Position --------------------------------------------
    const desired = mix(ambient, target, smoothstep(float(0), float(1), blend)).toVar();

    // ---- 5. Sog / Stroemung (FlowMode; sonst flowStrength = 0) ---------------
    // Benutzt DIESELBE Dissolve-Funktion: die Stroemung beruhigt sich stromauf
    // nach stromab, genau wie ein Pfeil sich aufzehrt.
    //
    // Ein blosser Versatz um einen Meter war unsichtbar - Staub, der ein
    // bisschen woanders steht, liest niemand als Stroemung. Es braucht zwei
    // Zutaten: einen Ausschlag, der nach VORNE hin zunimmt (der Raum beugt sich
    // in die Zielrichtung, waehrend er in Kopfnaehe ruhig bleibt), und eine
    // Welle, die hindurchlaeuft und das Ganze am Leben haelt.
    const relZ = pos.z.sub(u.flyerPos.z);
    const sFlow = clamp(relZ.sub(u.flowAxisOrigin).div(u.flowAxisLength).add(0.5), float(0), float(1));
    const flowLive = bindFactor(sFlow, u.progress, float(1), u.dissolveWidth, u.dissolveJitter);

    const vorne = clamp(relZ.negate().div(float(45)), float(0), float(1));
    const welle = pos.z.sub(time.mul(u.flowWaveSpeed)).div(u.flowWaveLength).mul(6.2831853).sin();
    const schwung = vorne.mul(float(0.75).add(welle.mul(0.25))).mul(flowLive).toVar();

    // ---- 6. Bugwelle: die Welt teilt sich vor dir ----------------------------
    const away = pos.xyz.sub(u.flyerPos).toVar();
    const dist = max(length(away), float(1e-4)).toVar();
    const bow = smoothstep(u.bowRadius, float(0), dist).mul(u.bowStrength);
    desired.addAssign(away.div(dist).mul(bow));

    // ---- 7. Integration: gedaempfte Feder auf `desired` ----------------------
    const stiff = mix(u.ambientStiff, u.formStiff, blend).toVar();
    const v = vel.xyz.add(desired.sub(pos.xyz).mul(stiff).mul(dt)).toVar();
    // Kritische Daempfung c = 2*sqrt(k), zeitschritt-unabhaengig via exp().
    v.mulAssign(exp(sqrt(stiff).mul(-2).mul(dt)));

    // ---- 7b. Sog als echte Stroemung ----------------------------------------
    // Ein Positions-Versatz war der falsche Griff: die ambiente Feder ist mit
    // Absicht weich (Zeitkonstante ~1.1 s), das Ziel wandert aber mit 13 m/s
    // davon - gemessen kamen von 5 m angepeiltem Ausschlag 0.81 m an, und das
    // sieht niemand. Stroemung ist ohnehin BEWEGUNG, nicht Anordnung: hier
    // wirkt sie als Beschleunigung, gegen die die Feder anhaelt. Es stellt sich
    // eine sichtbare seitliche Drift ein, der Staub zieht.
    //
    // Nur auf freien Staub (1 - blend), damit Formationen nicht mitgeschleift
    // werden.
    v.addAssign(u.flowDir.mul(u.flowStrength).mul(schwung).mul(dt).mul(float(1).sub(blend)));

    // ---- 8. Zerstaeubung beim Entlassen (GRUNDGESETZ 1/5) --------------------
    // Faellt die Bindung, bekommt der Partikel einen Auswaertsimpuls: er
    // kruemelt an Ort und Stelle weg, statt zu seiner Heimat zurueckzulaufen.
    // Zusammen mit der engen Rekrutierung und der weichen ambienten Feder liest
    // sich das als Aufloesen IM Raum, nicht als abziehende Schicht.
    const falling = max(blendPrev.sub(blend), float(0));
    const scatterDir = normalize(vec3(
      hash(i.add(101)).sub(0.5),
      hash(i.add(202)).sub(0.5),
      hash(i.add(303)).sub(0.5),
    ).add(pos.xyz.sub(u.formationOrigin).mul(0.15)).add(vec3(1e-4)));
    v.addAssign(scatterDir.mul(falling.mul(u.dissolveKick)));

    // ---- 9. Erfolgs-Druckwelle (auch sie ist ein Ereignis IM Raum) -----------
    const bAway = pos.xyz.sub(u.burstOrigin).toVar();
    const bDist = max(length(bAway), float(1e-4));
    const bFall = smoothstep(float(14), float(0), bDist).mul(u.burstStrength);
    v.addAssign(bAway.div(bDist).mul(bFall));

    vel.xyz.assign(v);
    vel.w.assign(blend);
    pos.xyz.assign(pos.xyz.add(v.mul(dt)));
    const rel0 = pos.xyz.sub(u.flyerPos).toVar();

    // ---- 10. Beim Wrap teleportieren, nie durch die ganze Box federn ---------
    // NUR fuer freien Staub. Ein gebundenes Partikel entfernt sich zwangslaeufig
    // von seiner ambienten Heimat - beim Begleiter, der mitfliegt, sogar
    // unbegrenzt weit. Ohne diese Bedingung riss die Sicherung genau die
    // Partikel zurueck, die gerade eine Form bilden: der Pfeil loeste sich von
    // selbst auf (gemessen verschwand er zeitweise vollstaendig).
    If(blend.lessThan(0.2).and(
      length(pos.xyz.sub(ambient)).greaterThan(u.boxSize.x.mul(0.45)),
    ), () => {
      pos.xyz.assign(ambient);
      vel.xyz.assign(vec3(0));
    });

    // ---- 10b. Ausser Sicht loest sich eine entlassene Form wirklich auf ------
    // Die ambiente Feder ist mit Absicht weich (Rueckkehr ueber mehrere
    // Sekunden). Ein eben entlassener Pfeil zieht deshalb als KLUMPEN hinter
    // einem her - dichter als der Raum ringsum und deutlich als Form lesbar.
    // Bei einem neuen Zeichen alle paar Sekunden stehen so staendig zwei, drei
    // alte Wolken herum, und man sieht mehr Pfeile, als es geben soll.
    //
    // Sobald ein freier Partikel UND seine Heimat beide jenseits der Sichtweite
    // liegen, ist er schlicht daheim. Niemand kann das sehen - jenseits
    // viewFar ist die Deckkraft null (siehe sichtFade unten) -, und der Raum
    // ist danach wieder gleichmaessig gefuellt. Es ist dieselbe Sicherung wie
    // eine Zeile weiter oben, nur an der Sichtgrenze statt an der Boxgrenze.
    If(blend.lessThan(0.2)
      .and(length(rel0).greaterThan(u.viewFar))
      .and(length(ambient.sub(u.flyerPos)).greaterThan(u.viewFar))
      .and(length(pos.xyz.sub(ambient)).greaterThan(float(2))), () => {
      pos.xyz.assign(ambient);
      vel.xyz.assign(vec3(0));
    });

    // ---- 11. Alpha -----------------------------------------------------------
    // Die EINZIGEN erlaubten Terme (Grundgesetz 4): Randblende, Nahblende,
    // Korridor-Peripherie und globale Dichte. Kein Term weiss, ob dieser
    // Partikel gerade Teil einer Form ist.
    const rel = pos.xyz.sub(u.flyerPos);
    const half = u.boxSize.mul(0.5);
    const n = max(max(abs(rel.x).div(half.x), abs(rel.y).div(half.y)), abs(rel.z).div(half.z));
    const edgeFade = float(1).sub(smoothstep(float(0.82), float(1.0), n));

    const nearFade = smoothstep(u.nearFadeIn, u.nearFadeOut, dist);
    // Sichtweite: unabhaengig davon, wie tief der Staub tatsaechlich reicht.
    const sichtFade = float(1).sub(smoothstep(u.viewFar.mul(0.72), u.viewFar, dist));

    // Peripherie um die KORRIDORACHSE (Weltachse z), nicht um die Blickachse -
    // damit ist sie eine Eigenschaft des Raums, keine der Ansicht.
    // Relativ zum Flieger, nicht zum Weltursprung - seit der Flug frei ist,
    // waere eine weltfeste Achse schlicht die falsche Bezugsgroesse.
    const radial = length(vec2(rel.x, rel.y)).div(float(30));
    const radialThin = mix(float(1), u.peripheryDensity, smoothstep(float(0), float(1), radial));

    // Globale Dichte als LOTTERIE, nicht als Blende: der Staub wird duenner,
    // nicht durchsichtiger. Jeder Partikel hat seine eigene Schwelle.
    const thr = hash(i.add(5501));
    const present = smoothstep(thr.sub(0.03), thr.add(0.03), u.fieldDensity);

    pos.w.assign(edgeFade.mul(sichtFade).mul(nearFade).mul(radialThin).mul(present));
  })().compute(count);
}
