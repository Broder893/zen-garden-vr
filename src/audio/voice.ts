/**
 * Spoken guide using the device's own speech synthesis (Web Speech API).
 * No recorded files; subtitles always carry the same words, so the
 * experience still works on a device without voices.
 */
export class GuideVoice {
  readonly available: boolean;
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.available = typeof window !== 'undefined' && 'speechSynthesis' in window;
    if (!this.available) return;
    this.pickVoice();
    window.speechSynthesis.addEventListener('voiceschanged', this.pickVoice);
  }

  /** Speaks `text`, cutting off whatever was being said. */
  say(text: string): void {
    if (!this.available) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = this.voice?.lang ?? 'en-US';
    if (this.voice) u.voice = this.voice;
    u.rate = 0.88;
    u.pitch = 1.05;
    u.volume = 0.9;
    synth.speak(u);
  }

  /** Stops speech now (pause, session end). */
  stop(): void {
    if (this.available) window.speechSynthesis.cancel();
  }

  dispose(): void {
    if (!this.available) return;
    this.stop();
    window.speechSynthesis.removeEventListener('voiceschanged', this.pickVoice);
  }

  /** Prefer a calm English voice; fall back to any English one. */
  private pickVoice = (): void => {
    const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
    const preferred = ['Samantha', 'Google UK English Female', 'Karen', 'Moira', 'Serena'];
    this.voice =
      preferred.map((n) => voices.find((v) => v.name.includes(n))).find(Boolean) ??
      voices.find((v) => v.localService) ??
      voices[0] ??
      null;
  };
}
