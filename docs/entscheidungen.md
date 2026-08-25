# Becoming Many Tutorial — Entscheidungen und Messungen

Diese Datei ist das Werkstattbuch: warum die Zahlen so sind, was vorher
gescheitert ist, und welche Fallen three.js unter WebGPU stellt. Die README
daneben sagt nur, was das Stück ist und wie man es startet.

## Das Grundgesetz

Die visuelle Sprache benutzt **keine eigenen Partikel**. Ein Pfeil ist kein
Zeichen *vor* der Welt, sondern eine vorübergehende Ordnung *in* ihr. Sechs
Regeln binden den gesamten Code:

1. **Erhaltung** — die Partikelzahl ist konstant. Nichts wird gespawnt, nichts
   gelöscht. Eine Formation *rekrutiert* vorhandenen Staub und *entlässt* ihn.
2. **Lokalität** — rekrutiert wird nur, was schon nah ist (`recruitFar`).
   Lieber ein leerer Slot als ein Partikel, das durch den halben Raum anfliegt.
3. **Dichte-Erhaltung** — weil lokal rekrutiert wird, **dünnt die Leere rings um
   eine entstehende Form sichtbar aus**. Kein gebauter Effekt, sondern eine
   automatische Folge von Regel 2 — und der stärkste Beleg, dass die Form *von
   hier* kommt.
4. **Alpha markiert nie Zugehörigkeit** — alle Partikel sind dasselbe Schwarz,
   dieselbe Deckkraft, dieselbe Größe. Der einzige Unterschied ist, *wo* sie
   stehen. Lesbarkeit entsteht aus Dichte und Ordnung, nicht aus Kontrast.
5. **Erscheinen und Verschwinden sind Bewegung, nie Blende** — der Zeitversatz
   staffelt den *Bewegungsbeginn*, nicht die Deckkraft.
6. **Nichts ist an die Kamera geheftet** — jede Formation hat eine feste
   Weltposition. Fliegt man vorbei, zieht sie hinter einem weg wie ein Baum am
   Straßenrand.

Verboten: Screen-Space-Formen · kamerafeste Zeichen · Alpha-Einblendung ·
Spawnen/Löschen · Farb- oder Größenunterschied zwischen „Zeichen" und „Welt" ·
Vollbild-Feedback.

Die drei einzigen Ausnahmen sind optische bzw. räumliche Tatsachen, keine
Ebenenmarkierung: Randblende der Box, Nahblende, Mindest-Winkelgröße. Die
Peripherie-Ausdünnung für VR-Komfort rechnet um die **Korridorachse**, nicht um
die Blickachse.

## Die zentrale Mechanik

Ein Pfeil nach rechts löst sich von links nach rechts auf, während man nach
rechts fliegt: **die Führungsform verbraucht sich selbst, während man ihr
folgt.** Die beiden verbleibenden Modi benutzen dieselbe Funktion
([`src/particles/tsl/dissolve.ts`](src/particles/tsl/dissolve.ts)) und
unterscheiden sich nur darin, welche Achse als `s` eingebacken wurde:

| Modus | `s` = | `dir` | Liest sich als |
|---|---|---|---|
| **Pfeil** | Position entlang der Zeigerichtung | `+1` | frisst sich in die Richtung auf, in die es zeigt |
| **Tor** | Polarwinkel θ/2π | `−1` | der Ring zeichnet sich zu, je zentrierter man ist |
| **Vorhang** | Abstand vom Öffnungsrand nach außen | `+1` | die Öffnung weitet sich |
| **Sog** | Koordinate entlang der Strömung | `+1` | die Strömung beruhigt sich stromauf → stromab |

`npm run check` verifiziert genau diese Achse für jede Form — ein Pfeil, dessen
`s` nicht mit der Zeigerichtung korreliert, frisst sich falsch herum auf, und
das fällt am Bildschirm erst spät auf.

## Warum die Zahlen so sind (gemessen, nicht geraten)

Der erste Entwurf war unsichtbar: von 200 000 Partikeln schlossen sich **89**
einer Form an. Drei Fehler, alle erst durch Zurücklesen der GPU-Buffer gefunden:

1. **Die Zuweisung koppelte über den Index**, nicht über die Nähe
   (`instanceIndex % slotCount`). Damit durften nur 5 bestimmte Partikel je Slot
   antreten — und die lagen zufällig in 864 000 m³ verteilt. Trefferquote 1,75 %.
   Dabei liegen rund 700 Partikel in Reichweite jedes Slots; es fehlte nie an
   Staub, nur an der Erlaubnis, den nahen zu nehmen. Jetzt probiert jedes
   Partikel sechs zufällige Slots und behält den nächsten.
2. **Zugehörigkeit war weich.** Ein Partikel bei halbem Abstand band zu 50 % und
   hing auf halbem Weg zwischen Heimat und Slot — ein Schleier statt einer
   Silhouette. Jetzt binär: entweder Teil der Form, oder Staub.
3. **40 000 Slots** für eine Form, in deren Umgebung nur einige tausend Partikel
   existieren. Slotzahlen sind jetzt je Form an den vorhandenen Staub angepasst.

Die wichtigste Einsicht betrifft aber die **Boxtiefe**. Naheliegend wäre, die
ambiente Dichte zu senken, damit Formen besser lesen — das hilft **nicht**:
Formpunkte und Staubpunkte skalieren beide mit der Dichte, das Verhältnis bleibt
gleich. Entscheidend ist Rekrutierungsvolumen gegen *Sichtlinien-Volumen*, und
letzteres wächst mit der Tiefe **hoch drei**. Bei 160 m Tiefe standen 11 019
Staubpunkte im Bildbereich des Pfeils gegen 8 798 Formpunkte — Verhältnis 0,8:1,
die Form war in der Unterzahl. Mit 110 m Tiefe, 60 000 Partikeln und der Form
30 m statt 46 m voraus: **11,35 : 1**.

| | vorher | jetzt |
|---|---|---|
| Partikel, die die Form bilden | 89 | 5 572 |
| Form zu Staub im Bildbereich | 0,8 : 1 | 11,35 : 1 |

Nachmessen lässt sich das jederzeit: `?dev=1` setzt `window.__becomingManyTutorial` mit
Zugriff auf `field.buffers`, und `renderer.getArrayBufferAsync()` liest die
GPU-Buffer zurück.

## Die zwei Pfeil-Varianten (Tasten 1–2)

| Taste | Variante | Prinzip |
|---|---|---|
| **1** | Fern | Große flache Pfeile in weitem Abstand. Man fliegt einfach hindurch — sie lösen sich **nicht** vor den Augen auf. Zwei unabhängige Bänke wechseln sich ab, die passierte springt jenseits der Sichtweite nach vorn. |
| **2** | Begleiter | Der Pfeil fliegt die ganze Zeit vor einem her. Löst er sich auf, **verwurzeln sich seine Partikel dort, wo sie gerade stehen** — er bleibt als Spur im Raum zurück, während man weiterzieht. |

Gemessen über 15 s Flug ohne Eingabe:

| | Formpunkte | Minimum | sichtbar neu entstanden |
|---|---|---|---|
| Fern | 2 394 | 176 | 320 |
| Begleiter | **7 319** | **7 314** | **0** |

Der Begleiter ist vollkommen konstant und lässt nichts entstehen — er ist ja
immer derselbe Pfeil. Das Minimum bei Fern ist kein Aussetzer, sondern der
Moment des Durchfliegens: eine flache Form wächst dabei über den Bildrand hinaus.

### Die zwei Einsichten dahinter

**Sichtweite und Staubtiefe sind zwei verschiedene Dinge.** Vorher hing beides
an der Boxgröße, und deshalb musste jede Form innerhalb der Sichtweite
entstehen — das Aufploppen war unvermeidlich. Jetzt ist die Box mit 160 m
viel tiefer als die Sichtweite von 45 m: Formen entstehen weit außerhalb der
Sicht und blenden beim Näherkommen ein. Man sieht kein Entstehen mehr, nur
Näherkommen. Das ist der Regler, an dem alles hängt.

**Eine Form muss flach und quer zur Blickrichtung stehen.** Der frühere
Pfeil-„Tunnel" (die Silhouette entlang der Flugachse ausgezogen) war
unbrauchbar, weil man entlang der Extrusionsachse blickt — ein ausgezogener
Körper hat aus dieser Richtung keine Silhouette, nur radiale Schlieren.
Projektionsgeometrie zu spät bedacht.

### Echtes Fliegen statt Strafen

Der erste Entwurf hielt die Blickrichtung fest und verschob den Flieger nur
seitlich. Das blieb ein Tunnel, auch nachdem die Wände von 22 × 15 m auf
160 × 130 m gewichen waren — man bewegte sich weiterhin **immer in dieselbe
Richtung** und rutschte nur zur Seite. Wände waren nie das Problem.

Jetzt drehen die Tasten die **Flugrichtung**: A/D giert, W/S nickt, und man
bewegt sich stets entlang der eigenen Vorwärtsachse. Vorwärts geht es
ununterbrochen weiter — nur ist „vorwärts" keine feste Weltachse mehr.

Drei Dinge mussten dafür mitziehen:

**Die Vorzeichen.** `forwardOf` und die Kamera müssen exakt dieselbe Konvention
benutzen (THREE blickt bei Rotation null entlang −Z, positives Gieren dreht nach
links). Nachgemessen: Skalarprodukt zwischen Flugrichtung und Kamerablick
1,0000 an jedem Messpunkt, über eine volle Drehung von −257°.

**Die Staubbox musste würfelförmig werden.** Sie war 70 × 50 × 160 — nur in
*einer* Richtung tief. Nach der ersten Kurve wäre man gegen eine Wand aus Nichts
geflogen. Jetzt 130³. Das ist rund viermal so viel Raum, also braucht es für
dieselbe Dichte auch entsprechend mehr Partikel (110 000); sichtbar sind
unverändert nur die innerhalb der Sichtweite.

**Die Formen brauchen den echten Flugpfad.** Sie werden entlang der Flugachse
gesetzt und quer dazu ausgerichtet. Eine Gerade als Vorhersage genügt dabei
nicht: wer mit voller Rate kurvt, fliegt einen Kreis von rund 14 m Radius, und
ein Punkt „30 m geradeaus" liegt außerhalb dieses Kreises — unerreichbar.
Gemessen kam bei Vollkurve **kein einziger Formpunkt** mehr ins Bild. Der Pfad
wird jetzt in acht Schritten integriert, und eine Bank, die mehr als 48° aus der
Blickachse gelaufen ist, wird vorzeitig erneuert.

| | Formpunkte im Bild |
|---|---|
| geradeaus | 4 163 – 10 577 |
| sanfte Kurve | 1 037 – 13 323 |
| Vollkurve rechts | 142 – 9 167 *(vorher 0)* |
| Vollkurve rechts + hoch | 482 – 7 016 |

### Ein Pfeil bleibt stehen, bis man ihm gefolgt ist

Eine Bank wurde erneuert, sobald sie 48° aus der Bildmitte gewandert war — also
genau in dem Moment, in dem man anfing, ihr zu folgen. Die Reihe wechselte
ständig, obwohl noch nichts erreicht war. Die Schwelle liegt jetzt bei 80° und
greift nur noch als Notbremse.

Dazu eine **Sperrfrist von 1,6 s**: bei voller Drehrate dreht sich die
Blickachse so schnell, dass eine eben gesetzte Bank im nächsten Bild schon
wieder als „passiert" galt. Gemessen waren das **545 Neuplatzierungen in zehn
Sekunden** — praktisch jedes Bild.

| | Wechsel in 10 s | Formpunkte |
|---|---|---|
| geradeaus | 4 | 2 347 – 6 700 |
| sanfte Kurve | 4 | 360 – 6 852 |
| Vollkurve | **6** *(vorher 545)* | 650 – 6 700 |

### Die Welt darf nicht leergeräumt werden

Bei einem Einfangradius von 34 m blieb rings um eine Form sichtbar nichts mehr
übrig. Die Aushöhlung ist erwünscht (Grundgesetz 3), aber sie darf die Welt
nicht leeren. Jetzt 28 m, dazu mehr Staub insgesamt (170 000 Partikel in einer
140³-Box) und eine größere Sichtweite (52 m statt 45).

Gemessen in Kugelschalen um den Pfeil, Partikel je 1000 m³:

| 0–15 m | 15–25 m | 25–35 m | 35–50 m | 50–70 m |
|---|---|---|---|---|
| 135 | **29** | 51 | 47 | 53 |

Eine Delle bei 15–25 m statt einer Leere. Sichtbarer Staub im Bild: 4 954 gegen
vorher rund 1 500.

### Losgelassener Staub bleibt liegen

Der auffälligste Fehler des Stücks, und einer mit einer unangenehm eleganten
Ursache: die ambiente Heimat eines Partikels ist die Gitterkopie, die dem
**Flieger** am nächsten liegt — nicht dem Partikel. Wer eine Form verließ und
hinter dem Flieger zurückblieb, bekam dadurch ein Ziel *vor* ihm und schoss
durch die Kamera davon. Gemessen: 17 m Sprung im Moment des Lösens, danach 35 m
Wanderung, und 3 998 von 4 000 Partikeln flogen durch die Kamera.

Jetzt verwurzelt sich ein Partikel, das eine Form verlässt, dort wo es steht.
Gemessen danach: **0 Kamera-Durchflüge**, größte Restwanderung 1,1 m.

Dazu kam ein zweiter Effekt: Pfeile, durch die man geflogen war, **explodierten**
hinter dem Rücken. Zwei Ursachen. Der `dissolveKick` sollte ursprünglich Formen
„zerkrümeln" lassen statt zurückschnappen — bei einem passierten Pfeil liest sich
das als Sprengung; er ist jetzt praktisch aus (0,15 statt 3,2). Und eine
Obergrenze für den Abstand beim Neuverwurzeln ließ Partikel mit weit entfernter
Heimat durchs Raster fallen: die bekamen den vollen Federruck und schossen mit
**44,8 m/s** davon. Die Grenze war überflüssig, weil ruhender Staub schon durch
die Blend-Bedingung ausgeschlossen ist. Höchsttempo danach: **3,6 m/s**.

Die Bedingung dafür ist bewusst eng, und das musste sie werden — zwei
Zwischenfassungen sind daran gescheitert, zu viel zu erfassen:

- „jedes ungebundene Partikel weit von seiner Heimat" pinnte im ersten Frame
  das **gesamte Feld** im Ursprung fest (weil `kernelInit` alle Positionen auf
  null setzte und die Wrap-Sicherung das bis dahin stillschweigend
  zurechtgerückt hatte). Seither startet jedes Partikel an seiner Heimat.
- dieselbe Regel ohne Blend-Fenster strandete Partikel, die gerade toroidal
  umlaufen wollten — dort ist der Abstand zur Heimat eine ganze Boxlänge.

### Der Staub driftete im Gleichtakt

Bei der Fehlersuche aufgefallen: `driftField` tastete das Rauschen bei
`home * 0.9` ab, und `home` liegt in [0,1). Alle Partikel trafen damit
praktisch denselben Rauschwert und drifteten **gemeinsam** — ein globales
Schwanken des ganzen Feldes statt lebendigem Staub. Das Rauschen wird jetzt im
Weltmaßstab abgetastet. Die Schwankung der sichtbaren Punktzahl fiel von 138 %
auf 46 %, und der Rest ist die normale Streuung beim toroidalen Umlauf.

### Gefüllt, nicht als Kontur

Zwischenzeitlich waren die Pfeile Konturen — rechnerisch weit dichter (2 226 %
Deckung gegen 12 %), aber als Bild schlechter: aus einer Form wird ein
Drahtgestell. Die Rechnung war richtig und hat die falsche Frage beantwortet.
Die Pfeile sind wieder gefüllt und beziehen ihre Dichte aus **Größe und
Nachschub**: kurz (13 m statt 22 m) und mit großzügigem Einfangradius. Die
Kontur-Form liegt als `arrowContour.ts` weiter bei und wird mitgeprüft.

### Warum das Feld dünner wurde

Bei 110 000 Partikeln standen **31 000 sichtbare Punkte** auf dem Schirm, davon
28 800 unter einem Pixel groß. Das liest sich als Bildrauschen, und in Rauschen
kann das Auge keine Figur vom Grund trennen — egal wie gut das Zahlenverhältnis
ist. Jetzt: 44 000 Partikel, davon rund **2 300 sichtbar**, jeder als klarer
Punkt. Wenige, deutliche Punkte schlagen viele verwaschene.

Dazu ein zweiter, kostenloser Griff: `minAngularSize` von 0,0028 auf 0,0020.
Die Klemmung bläht jeden Punkt jenseits von rund 27 m auf dieselbe Winkelgröße
auf — und dort liegen drei Viertel aller Bildpunkte. Der Grund las deshalb als
Halbton, nicht weil zu viele Punkte da waren, sondern weil die fernen künstlich
fett waren. Gemessen deckt der Staub jetzt **0,57 % der Bildfläche** statt 2,4 %,
während die Kontur bei über 100 % Deckung satt bleibt.

## Warum die Formen Ketten sind

Zwei Regeln des Stücks bissen sich. Grundgesetz 6 sagt: Formen stehen fest im
Raum, nichts ist an die Kamera geheftet. Der Flug läuft aber auf Schiene mit
konstanter Vorwärtsfahrt. Zusammen heißt das — eine einzelne Form 30 m voraus
ist nach gut **zwei Sekunden** durchflogen und hinter einem. Die Eskalation
rampt derweil über 18 Sekunden hoch und findet längst nichts mehr vor, was sie
lauter machen könnte. Das war strukturell kaputt, nicht nur zu kurz.

Die Auflösung liegt im Bild selbst: man passiert nicht *einen* Baum am
Straßenrand, sondern eine Allee. Jede Kopie steht unbeweglich im Raum, aber es
steht immer eine vor einem — Grundgesetz 6 bleibt unangetastet.

Die Kopien sitzen auf einem **festen Weltraster** (Vielfache von `spacing`).
Fährt der Flieger eine Rasterweite weiter, rückt die Kette um genau eine
Position nach, und die verbleibenden Kopien landen auf exakt denselben
Weltkoordinaten wie vorher. Kein Sprung — vorn kommt eine Kopie hinzu, hinten
wird eine entlassen. `npm run check` verifiziert genau das.

Gemessen, 18 Sekunden geradeaus ohne jede Eingabe:

| | vorher | jetzt |
|---|---|---|
| Form im Bild | ~2,3 s, dann nichts | durchgehend |
| Formpunkte im Bild | — | 4 100–5 600 |
| nächste Kopie | — | immer 5–11 m voraus |

Alle Kopien zeigen denselben Fortschritt und zehren sich gemeinsam auf
(10 035 → 5 668 → 108 gebundene Partikel bei progress 0 → 0,5 → 1). Die Welt
wiederholt ihre Aussage, bis man ihr folgt — und wenn man folgt, verschwindet
sie überall zugleich.


## Fallen (verifiziert gegen three.js r185)

```
mix(a, b, t)          ===  t.mix(a, b)        <- Empfänger ist der FAKTOR
smoothstep(lo, hi, x) ===  x.smoothstep(lo, hi)
.mod() ist WGSL '%' (truncated), NICHT GLSL mod (floored)
```

- **Nie `vec3` für einen Storage-Buffer.** WGSL kann `vec3<f32>` nicht in einem
  Storage-Array packen; three.js paddet in-place um und rechnet später mit dem
  alten Stride weiter. Alles hier ist `vec4`.
- **`THREE.Points` ist unter WebGPU auf 1 Pixel festgenagelt** (steht wörtlich
  in der `PointsNodeMaterial`-Doku). Deshalb `THREE.Sprite` mit `sprite.count`.
- Im Material `pos.toAttribute()` statt `.element(instanceIndex)` — letzteres
  bräuchte `requiredLimits.maxStorageBuffersInVertexStage`. Darum liegt Alpha in
  `pos.w`.
- Transparenz ist hier **gratis sortierungsfrei**: jedes Fragment ist dasselbe
  Schwarz, `src·α + dst·(1−α)` kommutiert bei konstantem `src`. Kein Depth-Sort,
  kein OIT.


## Warum das Projekt lokal liegt und nicht auf dem Netzlaufwerk

Z: ist eine TrueNAS-SMB-Freigabe, von der Windows **keine Programme ausführen
darf** (`Zugriff verweigert`, auch mit Administratorrechten). `node_modules`
enthält native Binaries — esbuild, Rollup —, die beim Entwickeln laufen müssen.
Es liegt nicht an Windows: es gibt keine ASR-Regel, kein AppLocker, und
`UNCAsIntranet` ist gesetzt. Die Dateien auf der ZFS-Seite haben schlicht kein
Execute-Bit, und Samba verweigert daraufhin die Ausführung.

Zusätzlich verstümmeln Vite und Rollup den Netzlaufwerkspfad (`Z:` wird zu
`/truenas/Sputnik/…` aufgelöst und passt danach nicht mehr zu sich selbst) —
auch der UNC-Pfad hilft nicht.

Deshalb: entwickelt wird hier, `npm run sync` legt den Quellcode zusätzlich nach
`Becoming Many Tutorial`. Erlaubt die Freigabe irgendwann Execute, kann der Umweg komplett weg.
