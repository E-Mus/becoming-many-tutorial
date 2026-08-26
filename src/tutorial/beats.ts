import type { GuidanceTask } from '../guidance/GuidanceMode';
import type { VoiceCue } from './VoicePlayer';

/**
 * DIE PARTITUR.
 *
 * Diese Datei ist die kuenstlerische Absicht in Datenform. Hier wird das Stueck
 * gestimmt - Reihenfolge, Laenge, Groesse der Aufgaben. Wer hier etwas aendert,
 * muss die Engine nicht verstehen.
 */
export interface Beat {
  id: string;
  /** null = eine Atempause ohne Aufgabe */
  task: GuidanceTask | null;
  /**
   * Nur fuer Atempausen: wie lange sie dauert.
   *
   * Eine AUFGABE hat keine Laufzeit mehr. Sie endet, wenn sie geloest ist -
   * sonst gar nicht. Frueher stand hier ein maxDuration von 22 s, nach dem ein
   * Beat "trotzdem mit Erfolg" abschloss; gemessen wechselte der Pfeil damit
   * bei progress = 0 die Richtung, also waehrend man noch gar nichts getan
   * hatte. Ein Zeichen, das von selbst umspringt, ist keine Anweisung mehr.
   */
  minDuration: number;
  /** Sprachdatei, die beim Eintritt in diesen Beat beginnt. */
  voice?: VoiceCue;
  /** Der naechste Beat beginnt erst, wenn die Sprachdatei zu Ende ist. */
  waitForVoice?: boolean;
  /** Der naechste Beat beginnt diese Anzahl Sekunden vor dem Audioende. */
  advanceBeforeVoiceEnd?: number;
  /** Freitext fuer die Dev-Anzeige. */
  note?: string;
}

/**
 * distanceAhead wirkt nur noch auf den Sog. Die Formen-Modi stellen sich als
 * Kette auf ein Weltraster (config.formation.chain), weil eine einzelne Form
 * bei konstanter Vorwaertsfahrt nach gut zwei Sekunden durchflogen waere.
 */
const t = (
  axis: GuidanceTask['axis'],
  sign: 1 | -1,
  controlEffort: number,
  distanceAhead = 30,
): GuidanceTask => ({ axis, sign, controlEffort, distanceAhead, intensity: 0 });

/**
 * ALLE VIER RICHTUNGEN KOMMEN IMMER DRAN.
 *
 * Frueher trugen 'links' und 'runter' ein skipIfMastered: wer den Hinweg
 * schnell und ohne Eskalation geloest hatte, bekam den Rueckweg gar nicht erst
 * zu sehen. Gemessen im echten Durchlauf reichte dafuer weniger als eine
 * Sekunde - denn der Fortschritt zaehlt die Verschiebung seit Beat-Beginn, und
 * wer aus der vorigen Aufgabe noch steigt, hat die 5 m nach oben beisammen,
 * bevor er ueberhaupt etwas getan hat. 'hoch' schloss nach 1.17 s ab, 'runter'
 * entfiel, und das Stueck war nach drei statt vier Zeichen vorbei.
 */
export const BEATS: Beat[] = [
  { id: 'ankommen', task: null, minDuration: 6,
    note: 'Das Feld blendet auf. Stillstand. Nichts passiert - und das ist Inhalt.' },

  { id: 'bemerken', task: null, minDuration: 0,
    voice: 'anfangundrechts', advanceBeforeVoiceEnd: 3,
    note: 'Die Vorwaertsdrift und die Einleitung beginnen. Der erste Pfeil kommt drei Sekunden vor ihrem Ende.' },

  { id: 'rechts', task: t('x', 1, 1.3), minDuration: 0 },
  { id: 'links', task: t('x', -1, 1.3), minDuration: 0, voice: 'links' },

  { id: 'hoch', task: t('y', 1, 1.3), minDuration: 0, voice: 'oben' },
  { id: 'runter', task: t('y', -1, 1.3), minDuration: 0, voice: 'unten' },

  { id: 'entlassen', task: null, minDuration: 0,
    voice: 'ende', waitForVoice: true,
    note: 'Das Finale laeuft vollstaendig, waehrend Feld und Tempo ins Stueck uebergehen.' },
];
