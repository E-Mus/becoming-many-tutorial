export type VoiceCue = 'anfangundrechts' | 'links' | 'oben' | 'unten' | 'ende';

export interface VoicePlayback {
  onEnded?: () => void;
  onBeforeEnd?: () => void;
  secondsBeforeEnd?: number;
}

const VOICE_URLS: Record<VoiceCue, string> = {
  anfangundrechts: `${import.meta.env.BASE_URL}audio/anfangundrechts.wav`,
  links: `${import.meta.env.BASE_URL}audio/links.wav`,
  oben: `${import.meta.env.BASE_URL}audio/oben.wav`,
  unten: `${import.meta.env.BASE_URL}audio/unten.wav`,
  ende: `${import.meta.env.BASE_URL}audio/ende.wav`,
};

/**
 * Ein einziger Player fuer alle Sprachdateien.
 *
 * Jede neue Ansage stoppt die laufende sofort. Falls der Browser den ersten
 * Start wegen seiner Autoplay-Regeln blockiert, wird genau diese Ansage bei
 * der naechsten Tastatur-, Touch- oder Zeigeraktion erneut gestartet.
 */
export class VoicePlayer {
  private readonly audio = new Audio();
  private request = 0;
  private waitingForGesture = false;
  private endedHandler: (() => void) | null = null;
  private errorHandler: (() => void) | null = null;
  private timeHandler: (() => void) | null = null;
  private cue: VoiceCue | null = null;

  constructor() {
    this.audio.preload = 'auto';
    this.audio.setAttribute('playsinline', '');

    window.addEventListener('pointerdown', this.retryOnGesture);
    window.addEventListener('keydown', this.retryOnGesture);
    window.addEventListener('touchend', this.retryOnGesture);
  }

  get currentCue() { return this.cue; }
  get isWaitingForGesture() { return this.waitingForGesture; }

  play(cue: VoiceCue, playback: VoicePlayback = {}) {
    this.stop();

    const request = ++this.request;
    this.cue = cue;
    this.audio.src = VOICE_URLS[cue];
    this.audio.currentTime = 0;

    let beforeEndFired = false;
    const fireBeforeEnd = (force = false) => {
      if (beforeEndFired || !playback.onBeforeEnd) return;

      const remaining = this.audio.duration - this.audio.currentTime;
      if (!force && (!Number.isFinite(remaining) || remaining > (playback.secondsBeforeEnd ?? 0))) return;

      beforeEndFired = true;
      playback.onBeforeEnd();
    };
    const complete = () => {
      if (request !== this.request) return;
      fireBeforeEnd(true);
      this.removeMediaHandlers();
      this.waitingForGesture = false;
      this.cue = null;
      playback.onEnded?.();
    };

    this.endedHandler = complete;
    this.timeHandler = () => fireBeforeEnd();
    this.errorHandler = () => {
      console.error(`[Becoming Many Tutorial] Audiodatei konnte nicht geladen werden: ${cue}`);
      complete();
    };
    this.audio.addEventListener('ended', this.endedHandler);
    this.audio.addEventListener('timeupdate', this.timeHandler);
    this.audio.addEventListener('error', this.errorHandler);

    this.tryStart(request);
  }

  stop() {
    this.request++;
    this.waitingForGesture = false;
    this.cue = null;
    this.removeMediaHandlers();
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  private tryStart(request: number) {
    if (request !== this.request || !this.cue) return;
    this.waitingForGesture = false;

    void this.audio.play().catch((error: unknown) => {
      if (request !== this.request) return;

      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.waitingForGesture = true;
        return;
      }
      if (error instanceof DOMException && error.name === 'AbortError') return;

      console.error('[Becoming Many Tutorial] Audio konnte nicht gestartet werden.', error);
      this.errorHandler?.();
    });
  }

  private retryOnGesture = () => {
    if (this.waitingForGesture) this.tryStart(this.request);
  };

  private removeMediaHandlers() {
    if (this.endedHandler) this.audio.removeEventListener('ended', this.endedHandler);
    if (this.timeHandler) this.audio.removeEventListener('timeupdate', this.timeHandler);
    if (this.errorHandler) this.audio.removeEventListener('error', this.errorHandler);
    this.endedHandler = null;
    this.timeHandler = null;
    this.errorHandler = null;
  }
}
