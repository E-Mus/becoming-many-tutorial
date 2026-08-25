import { Fn, float, hash, instanceIndex, smoothstep } from 'three/tsl';

/**
 * DAS HERZ DES KONZEPTS.
 *
 * Ein Pfeil nach rechts loest sich von links nach rechts auf, waehrend man nach
 * rechts fliegt: die Fuehrungsform verbraucht sich selbst, waehrend man ihr
 * folgt. Alle vier Fuehrungsmodi benutzen diese eine Funktion; sie unterscheiden
 * sich nur darin, WELCHE Achse als `s` in die Slots eingebacken wurde.
 *
 *   Pfeil    s = Position entlang der Zeigerichtung   dir +1  frisst sich selbst
 *   Tor      s = Polarwinkel theta/2pi                dir -1  zeichnet sich zu
 *   Vorhang  s = Abstand nach aussen vom Oeffnungsrand dir +1  Oeffnung weitet sich
 *   Sog      s = Koordinate entlang der Stroemung     dir +1  beruhigt sich
 *
 * @param s        Koordinate des Partikels auf der Fortschrittsachse, 0..1 (slots.w)
 * @param progress Uniform 0..1, vom Fuehrungsmodus aus dem Flugzustand berechnet
 * @param dir      +1 = aufzehren, -1 = aufbauen
 * @param width    Weichheit der Wellenfront (~0.085)
 * @param jitter   Zufaellige Streuung von s, damit die Kante Staub ist und kein Rasiermesser
 * @returns        1 = noch an die Form gebunden, 0 = zurueck in die Welt entlassen
 */
export const bindFactor = Fn(([s, progress, dir, width, jitter]: [any, any, any, any, any]) => {
  const sj = s.add(hash(instanceIndex.add(9173)).sub(0.5).mul(jitter));
  // d > 0 heisst: die Wellenfront ist an mir vorbei.
  const d = progress.sub(sj).mul(dir);
  return float(1).sub(smoothstep(float(0), width, d));
});
