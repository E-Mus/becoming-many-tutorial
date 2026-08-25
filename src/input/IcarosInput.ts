import type { FlightInput, InputSource } from './InputSource';

/**
 * Platzhalter fuer das echte Icaros.
 *
 * OFFEN: meldet sich das Geraet in navigator.getGamepads()? Wenn ja, ist diese
 * Klasse dreissig Zeilen (Achsenzuordnung + Kalibrierung der Ruhelage). Wenn
 * nicht, braucht es eine native Bruecke - das waere ein eigenes Projekt.
 *
 * Die Achsen sind Roll (seitlich) und Pitch (vertikal), also genau
 * {lateral, vertical}. Oberhalb dieser Datei aendert sich deshalb nichts.
 */
export class IcarosInput implements InputSource {
  readonly id = 'icaros';
  readonly active = false;
  connect() {}
  disconnect() {}
  read(): FlightInput {
    return { lateral: 0, vertical: 0 };
  }
}
