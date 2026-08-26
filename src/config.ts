/**
 * Becoming Many Tutorial — alle Regelwerte an einem Ort.
 *
 * Diese Datei und `tutorial/beats.ts` tragen die kuenstlerische Absicht.
 * Hier wird gestimmt, nicht in der Engine.
 */

export const CONFIG = {
  /** Off-Weiss statt #ffffff: ohne Referenz immer noch absolutes Weiss, aber
   *  deutlich augenfreundlicher, und die Punktkanten werden weicher. */
  voidColor: 0xfafaf8,

  particles: {
    /**
     * Gemessen, nicht geschaetzt: bei 200 000 Partikeln in einer 160 m tiefen
     * Box standen ~110 000 Punkte gleichzeitig auf dem Schirm. Das ist kein
     * Nichts mit Staub darin, das ist Nebel - und jede Form ging darin unter.
     */
    /**
     * Gemessen: bei 110 000 Partikeln standen 31 000 sichtbare Punkte auf dem
     * Schirm, davon 28 800 UNTER einem Pixel gross. Das liest sich als
     * Bildrauschen, und in Rauschen kann das Auge keine Figur vom Grund
     * trennen - egal wie gut das Zahlenverhaeltnis ist. Wenige, klar sichtbare
     * Punkte schlagen viele verwaschene.
     */
    /**
     * Die wuerfelfoermige Box fasst rund viermal so viel Raum wie die frueher
     * abgeflachte. Fuer dieselbe Dichte - und damit dasselbe Bild - braucht es
     * entsprechend mehr Partikel; sichtbar sind ohnehin nur die innerhalb der
     * Sichtweite, also unveraendert rund dreitausend.
     */
    count: 170_000,
    /** Groesse des Slot-Buffers. Jede Formation nutzt davon nur so viele, wie
     *  in ihrer Umgebung ueberhaupt Staub liegt - siehe formation.slots. */
    maxSlots: 20_000,

    /**
     * Ambiente Box, die dem Flieger folgt.
     *
     * WÜRFELFOERMIG, und das ist seit dem freien Flug zwingend: eine Box, die
     * nur in einer Richtung tief ist, laesst einen nach der ersten Kurve gegen
     * eine Wand aus Nichts fliegen. Man muss in JEDE Richtung gleich weit sehen.
     *
     * Und sie ist deutlich groesser als die Sichtweite. Wo Staub existiert und
     * wie weit man ihn sieht, sind zwei verschiedene Dinge - diese Trennung
     * loest das Kernproblem des Stuecks: Formen koennen weit ausserhalb der
     * Sichtweite entstehen und beim Naeherkommen einblenden, und dann gibt es
     * ueberhaupt kein sichtbares Erscheinen mehr.
     */
    boxSize: [140, 140, 140] as const,

    /** Punktgroesse in Metern. */
    /** Sichtweite in Metern. Die Box ist absichtlich viel tiefer. */
    viewFar: 52,

    dotSize: 0.075,
    /** Mindest-Winkelgroesse: haelt ferne Punkte bei ~1.5 px, sonst flimmern sie.
     *  size = max(dotSize, viewDist * minAngularSize) */
    /**
     * Die Klemmung blaeht JEDEN Punkt jenseits von rund 27 m auf dieselbe
     * Winkelgroesse auf - und dort liegen etwa drei Viertel aller Bildpunkte.
     * Der Grund liest deshalb als Halbton, nicht weil zu viele Punkte da sind,
     * sondern weil die fernen kuenstlich fett sind. Von 0.0028 auf 0.0020
     * halbiert ihre Tintenflaeche; eine Kontur mit weit ueber 100 % Deckung
     * bleibt davon unberuehrt satt. Unter 0.0018 faengt es an zu flimmern.
     */
    minAngularSize: 0.0020,

    /** Ambiente Drift (Rauschfeld). */
    /** Wird auf WELTKOORDINATEN angewandt, daher klein: 1/noiseScale ist die
     *  Wellenlaenge der Drift in Metern. */
    noiseScale: 0.045,
    noiseSpeed: 0.035,
    driftAmp: 1.6,

    /** Federn. Weich im Ambiente (Rueckkehr ueber ~4 s), straff in der Formation. */
    ambientStiff: 0.8,
    formStiff: 22,

    /** Bugwelle: der Staub teilt sich vor dir. */
    bowRadius: 6.5,
    bowStrength: 3.2,

    /** Blenden — die einzigen erlaubten Alpha-Terme (optische/raeumliche Fakten). */
    nearFadeIn: 0.6,
    nearFadeOut: 3.2,
    /** VR-Komfort: Ausduennung um die KORRIDORACHSE, nicht um die Blickachse. */
    peripheryDensity: 1.0,
  },

  formation: {
    /**
     * Ketten statt Einzelformen - siehe formations/chain.ts.
     *
     * lead + (copies-1)*spacing muss unter der halben Boxtiefe (55 m) bleiben:
     * weiter vorne existiert kein Staub, aus dem sich eine Kopie bilden koennte.
     *
     * slotsPerCopy muss zu dem Staub passen, der rings um EINE Kopie liegt. Bei
     * 0.156 Partikeln/m³ und 20 m Reichweite sind das einige tausend. Mehr
     * Slots ergeben nur leere Slots und eine lueckenhafte Silhouette.
     */
    chain: {
      arrow: { copies: 4, spacing: 10, lead: 11, slotsPerCopy: 3_200 },
      ring: { copies: 4, spacing: 10, lead: 10, slotsPerCopy: 2_400 },
      aperture: { copies: 3, spacing: 13, lead: 12, slotsPerCopy: 5_200 },
    },

    /** Grundgesetz 2 — Lokalitaet. Rekrutiert wird nur, was schon nah ist.
     *  Die Reichweite liegt in der Groessenordnung der Form selbst: ein
     *  Partikel, das 12 m zu einem 10-m-Pfeil wandert, kommt aus dessen
     *  eigener Nachbarschaft. */
    /**
     * Kleiner als zuvor (34 m). Der Einfangradius bestimmt, wie gross das Loch
     * ist, das eine Form in ihre Umgebung reisst - bei 34 m blieb rundherum
     * sichtbar nichts mehr uebrig. Die Aushoehlung ist erwuenscht (Grundgesetz
     * 3), aber sie darf die Welt nicht leerraeumen.
     */
    recruitFar: 28.0,
    /** Anteil der in Frage kommenden Partikel, der sich anschliesst. */
    /**
     * Bei duennem ambientem Feld muss die Form nahezu allen erreichbaren Staub
     * einsammeln - sonst bleibt sie blass. Die Aushoehlung der Umgebung ist
     * dabei kein Nebeneffekt, sondern Grundgesetz 3.
     */
    recruitDensity: 0.95,

    /**
     * Wie weit ein Partikel von seiner ambienten Heimat entfernt sein darf,
     * um ueberhaupt geworben zu werden.
     *
     * Ein eben entlassenes Partikel steht noch dort, wo die alte Form stand,
     * waehrend seine Heimat laengst woanders liegt. Wird es sofort wieder
     * geworben, fliegt es quer durchs Bild von der alten Form zur neuen. Wer
     * weiter weg ist als das hier, ist noch unterwegs und bleibt aussen vor -
     * geworben wird nur ruhender Staub. Die Rueckkehr dauert ein paar Sekunden,
     * das ist die eingebaute Sperrfrist.
     */
    heimSchwelle: 6,


    /** Wie schnell ein Partikel seiner Bindung folgt. */
    bindRate: 2.6,
    /** Staffelung des Bewegungsbeginns in Sekunden (nicht der Deckkraft!). */
    appearSpread: 1.1,
    appearWidth: 0.22,

    /** Dissolve-Wellenfront. Zu weich liest sich als Verblassen, zu hart als Wisch. */
    dissolveWidth: 0.085,
    dissolveJitter: 0.07,
    /**
     * Impuls beim Entlassen. Bewusst sehr klein.
     *
     * Ursprünglich sollte er Formen "zerkrümeln" statt zurückschnappen lassen.
     * Bei einem Pfeil, durch den man gerade geflogen ist, liest sich das aber
     * als Explosion hinter dem Ruecken - der Staub soll dort einfach liegen
     * bleiben, nicht auseinanderfliegen.
     */
    dissolveKick: 0.15,
    /** Streuung beim Loslassen in Metern - laesst die alte Form zerfallen. */
    releaseScatter: 1.0,
  },

  flight: {
    /** Von 13 auf 10 heruntergenommen. Der Takt der Pfeilreihe haengt daran:
     *  bei 34 m Abstand sind das jetzt 3.4 s statt 2.6 s je Zeichen. */
    cruiseSpeed: 10,
    /**
     * Drehraten statt Seitwaertstempo - der Flug ist jetzt echtes Fliegen.
     * 0.9 rad/s sind gut 50 Grad je Sekunde: zuegig, aber nicht hektisch.
     */
    maxYawRate: 0.9,
    maxPitchRate: 0.7,
    /** Knapp unter senkrecht abfangen, damit es nie ueberschlaegt. */
    maxPitch: 1.15,
    /** Zeitkonstante der Steuerglaettung. */
    turnTau: 0.30,
    /** Traegheit. bankTau > velocityTau ist der Unterschied zwischen
     *  "fliegen" und "einen Cursor bewegen". */
    bankTau: 0.55,
    bankAmount: 0.55,
    /**
     * Keine Grenzen mehr. Der Flug ist frei in alle Richtungen; die Staubbox
     * folgt ohnehin mit, und weil sie jetzt wuerfelfoermig ist, sieht man in
     * jede Richtung gleich weit.
     */
  },

  tutorial: {
    /** Sekunden ohne Fortschritt, bevor die Eskalation ueberhaupt einsetzt.
     *  Das Nichtstun ist Inhalt. */
    silence: 3,
    /** Unter diesem Ausschlag gilt eine Steuerachse als losgelassen. */
    inputNeutral: 0.08,
    /** So lange muss eine vorab gehaltene Achse neutral sein, bevor sie zaehlt. */
    neutralHold: 0.12,
    /** Erst oberhalb dieses Ausschlags entsteht Aufgabenfortschritt. */
    inputActuation: 0.12,
  },
  /**
   * Die beiden Pfeil-Varianten.
   *
   * spawnWeite liegt bei beiden JENSEITS der Sichtweite (~53 m bei 130 m
   * Boxtiefe). Dadurch sieht man nie, wie etwas entsteht - nur, wie es aus der
   * Ferne einblendet. Das war der eigentliche Fehler aller frueheren Anlaeufe.
   */
  /**
   * WERBEWEITE UND WERBEDICHTE - warum jede Variante ihre eigenen hat.
   *
   * Gemessen im laufenden Stueck (Pfeil "fern", 2 x 9000 gefuellte Slots,
   * recruitFar 28, recruitDichte 0.67):
   *
   *   frei je m³, Schale 10-20 m um den Pfeil   0.0060
   *   frei je m³, Schale 20-28 m                0.0104
   *   frei je m³, ungestoerte Referenz          0.0490
   *
   * Also acht Mal leerer als die Welt ringsum - kein ausgeduennter Hof mehr
   * (Grundgesetz 3), sondern Vakuum. Der Grund ist Arithmetik und war nie eine
   * Frage der Reichweite: bei 0.062 Partikeln/m³ braucht EINE Bank mit 9000
   * Slots den gesamten Staub aus einer Kugel von 33 m Radius. Sie MUSS die
   * Umgebung leerraeumen, weil sie sonst leer bliebe.
   *
   * Der Hebel ist NICHT die Zahl der Partikel im Pfeil - die macht seine
   * Gestalt, und die soll bleiben, wie sie ist. Der Hebel ist, AUS WIE WEIT
   * dieselbe Zahl zusammengetragen wird. Beide Knoepfe wirken zusammen:
   *
   *   werbeWeite 28, werbeDichte 0.67  ->  frei je m³ im Umkreis 10-20 m:
   *                                        0.0060 gegen 0.048 ringsum. Loch.
   *   werbeWeite 45, werbeDichte 0.35  ->  0.0341 gegen 0.0335 ringsum, also
   *                                        nicht mehr messbar - bei 4 800 bzw.
   *                                        7 900 gebundenen Partikeln je Bank.
   *
   * Gleich viele Partikel im Pfeil, gleiche Gestalt - nur kommen sie jetzt aus
   * einem weiten, duennen Umkreis statt aus einer leergeraeumten Blase.
   * "npm run check" rechnet das nach.
   *
   * spawnWeite liegt bei allen JENSEITS der Sichtweite (~52 m). Dadurch sieht
   * man nie, wie etwas entsteht - nur, wie es aus der Ferne einblendet. Das war
   * der eigentliche Fehler aller frueheren Anlaeufe.
   */
  varianten: {
    fern: { laenge: 15, slots: 9_000, spawnWeite: 34, werbeWeite: 45, werbeDichte: 0.42 },
    /** Der Begleiter baut sich IN SICHT auf - seine Werbeweite bleibt kleiner,
     *  sonst sieht man Partikel aus der Ferne herbeischiessen. */
    begleiter: { laenge: 11, slots: 9_000, abstand: 22, werbeWeite: 33, werbeDichte: 0.4 },
  },
} as const;

export type Config = typeof CONFIG;
