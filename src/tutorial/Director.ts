import { CONFIG } from '../config';
import type { Uniforms } from '../core/Uniforms';
import type { ParticleField } from '../particles/ParticleField';
import type { FlightState } from '../flight/Flight';
import type { GuidanceContext, GuidanceMode, ModeId } from '../guidance/GuidanceMode';
import { GUIDANCE_MODES } from '../guidance/registry';
import { BEATS, type Beat } from './beats';
import { intensityFor } from './escalation';
import { VoicePlayer } from './VoicePlayer';

/** Zustand, den eine Atempause am Ende erreicht haben soll. */
interface InterludeTarget {
  density?: number;
  speed?: number;
  /** Zeitkonstante der Annaeherung in Sekunden */
  tau?: number;
}

function interludeTarget(beat: Beat): InterludeTarget {
  switch (beat.id) {
    case 'ankommen': return { density: 1, speed: 0, tau: 4 };
    case 'bemerken': return { speed: CONFIG.flight.cruiseSpeed, tau: 3.5 };
    case 'entlassen': return { density: 0.55, speed: CONFIG.flight.cruiseSpeed * 1.45, tau: 8 };
    default: return {};
  }
}

/**
 * Die Regie: welcher Beat laeuft, wie laut, und wann geht es weiter.
 *
 * Zwei Regeln, die diese Klasse einloest:
 *  - NICHTS geschieht ohne die Fliegende. Eine Aufgabe endet, wenn sie geloest
 *    ist, und sonst nie: kein Zeitablauf schaltet weiter, keine Assistenz
 *    steuert mit, und der Raum lehnt sich nicht von selbst. Die Eskalation
 *    macht nur noch das ZEICHEN deutlicher, nie die Welt schief. Der Preis:
 *    wer die Aufgabe nicht loest, bleibt in ihr.
 *  - Alle vier Richtungen kommen dran. Es gibt kein Ueberspringen mehr; die
 *    Partitur in beats.ts ist die Partitur.
 */
export class Director {
  private index = -1;
  private beatTime = 0;
  private stalled = 0;
  private readonly mode: GuidanceMode;
  private readonly modeId: ModeId;
  private readonly voice = new VoicePlayer();
  finished = false;

  constructor(
    private readonly field: ParticleField,
    private readonly uniforms: Uniforms,
    private readonly flight: FlightState,
    modeId: ModeId = 'far',
  ) {
    this.modeId = modeId;
    this.mode = GUIDANCE_MODES[modeId]();
  }

  get currentBeat(): Beat | null {
    return this.index >= 0 && this.index < BEATS.length ? BEATS[this.index] : null;
  }
  get currentModeId() { return this.modeId; }
  get intensity() { return intensityFor(this.stalled); }
  get currentVoiceCue() { return this.voice.currentCue; }
  get voiceWaitingForGesture() { return this.voice.isWaitingForGesture; }
  /** Laeuft gerade eine Aufgabe, oder ist Atempause? Fuer die Dev-Anzeige. */
  get hasTask() { return this.currentBeat?.task != null; }

  private ctx(dt: number): GuidanceContext {
    return { field: this.field, uniforms: this.uniforms, flight: this.flight, dt };
  }

  start() { this.advance(false); }

  private advance(completedWell: boolean) {
    const prev = this.currentBeat;
    if (prev?.task) this.mode.end(completedWell ? 'success' : 'timeout', this.ctx(0));

    this.index++;
    this.beatTime = 0;
    this.stalled = 0;

    const beat = this.currentBeat;
    if (!beat) {
      this.voice.stop();
      this.finished = true;
      return;
    }
    if (beat.task) {
      beat.task.intensity = 0;
      this.mode.begin(beat.task, this.ctx(0));
    }
    if (beat.voice) {
      this.voice.play(beat.voice, {
        onEnded: beat.waitForVoice ? () => this.advanceAfterVoice(beat) : undefined,
        onBeforeEnd: beat.advanceBeforeVoiceEnd !== undefined
          ? () => this.advanceAfterVoice(beat)
          : undefined,
        secondsBeforeEnd: beat.advanceBeforeVoiceEnd,
      });
    }
    this.onBeat?.(beat);
  }

  private advanceAfterVoice(beat: Beat) {
    if (!this.finished && this.currentBeat === beat) this.advance(true);
  }

  /** Haken fuer die Dev-Anzeige. */
  onBeat?: (beat: Beat) => void;

  update(dt: number) {
    if (this.finished) return;
    const beat = this.currentBeat;
    if (!beat) return;
    this.beatTime += dt;

    // Atempausen: Feld und Tempo fahren, keine Aufgabe.
    if (!beat.task) {
      this.driveInterlude(beat, dt);
      if (beat.voice && (beat.waitForVoice || beat.advanceBeforeVoiceEnd !== undefined)) return;
      if (this.beatTime >= beat.minDuration) this.advance(true);
      return;
    }

    const intensity = intensityFor(this.stalled);
    beat.task.intensity = intensity;

    const report = this.mode.update(this.ctx(dt));

    if (report.progress < 0.05) this.stalled += dt;
    else this.stalled = 0;

    if (report.completed) {
      // Die Druckwelle hing frueher am Zeitablauf - sie war also ausgerechnet
      // die Belohnung dafuer, NICHTS getan zu haben. Jetzt quittiert sie das
      // Loesen.
      this.field.burst(this.flight.position.clone().setZ(this.flight.position.z - 12), 16);
      this.advance(true);
      return;
    }
  }

  /** Atempause laufen lassen: sanfte Annaeherung an ihren Endzustand. */
  private driveInterlude(beat: Beat, dt: number) {
    const t = interludeTarget(beat);
    if (t.density !== undefined) {
      const u = this.uniforms.fieldDensity;
      const rate = dt / (t.tau ?? 4);
      u.value += Math.sign(t.density - u.value) * Math.min(rate, Math.abs(t.density - u.value));
    }
    if (t.speed !== undefined) {
      const k = 1 - Math.exp(-dt / (t.tau ?? 4));
      this.flight.forwardSpeed += (t.speed - this.flight.forwardSpeed) * k;
    }
  }
}
