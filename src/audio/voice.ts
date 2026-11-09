import { SoundEngine } from './sound-engine.js';
import { VoiceClips } from './voice-clips.js';

/** How long a line may wait for its recording (still loading) before the device voice reads it. */
const WAIT_FOR_CLIP_MS = 2500;
/** The manifest's narrator: the music dips while she speaks. */
const NARRATOR = 'narrator';

const log = import.meta.env.DEV ? (msg: string) => console.info(`[voice] ${msg}`) : () => {};

/** What said the last line: its recording, the device voice, or nothing (subtitle only). */
export type VoiceSource = 'clip' | 'device' | 'none';

/**
 * The spoken guide. Each line has a recording (public/voices/, generated with
 * Kokoro TTS: a narrator and the firefly) played through the sound engine's
 * voice bus, which skips the closed-eyes muffle. A line whose file is missing,
 * or every line when Web Audio is unavailable, is read by the device's speech
 * synthesis instead. The subtitles always carry the same words.
 */
export class GuideVoice<Id extends string> {
  readonly clips: VoiceClips;
  /** For dev checks: who said the last line. */
  lastSource: VoiceSource = 'none';
  private device = new DeviceVoice();
  private playing: AudioBufferSourceNode | null = null;
  /** Bumped by every say() and stop(): callbacks from an older line do nothing. */
  private line = 0;
  private waiting = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly engine: SoundEngine,
    private readonly lines: Readonly<Record<Id, string>>,
  ) {
    this.clips = new VoiceClips(engine.ctx);
  }

  get available(): boolean {
    return !!this.engine.voice || this.device.available;
  }

  /** Call from the first gesture: fetches the recordings in the background, `first` ones first. */
  load(first: readonly Id[]): void {
    this.clips.load(first);
  }

  /** Says line `id`, cutting off whatever was being said. */
  say(id: Id): void {
    this.stop();
    const buffer = this.clips.buffer(id);
    if (buffer) return this.play(id, buffer);
    if (!this.clips.mayHave(id)) return this.speakDevice(id);
    // Still loading (the first line is asked for as loading starts): wait a little for it.
    const line = this.line;
    this.waiting = true;
    this.timer = setTimeout(() => this.endWait(line, id), WAIT_FOR_CLIP_MS);
    void this.clips.settle(id).then(() => this.endWait(line, id));
  }

  /** Stops speech now (pause, session end, a new line). */
  stop(): void {
    this.line++;
    this.waiting = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (this.playing) {
      try {
        this.playing.stop();
      } catch {
        /* already ended */
      }
      this.playing = null;
    }
    this.device.stop();
    this.engine.duckMusic(false);
  }

  dispose(): void {
    this.stop();
    this.device.dispose();
  }

  /** The recording arrived, failed or took too long: play it, or let the device read the line. */
  private endWait(line: number, id: Id): void {
    if (line !== this.line || !this.waiting) return;
    this.waiting = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    const buffer = this.clips.buffer(id);
    if (buffer) this.play(id, buffer);
    else this.speakDevice(id);
  }

  private play(id: Id, buffer: AudioBuffer): void {
    const ctx = this.engine.ctx;
    const out = this.engine.voice;
    // Suspended audio (headset off, page hidden): stay silent rather than queue up.
    if (!ctx || !out || ctx.state !== 'running') return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(out);
    const narrator = this.clips.voiceOf(id) === NARRATOR;
    const line = this.line;
    src.onended = () => {
      if (line !== this.line) return;
      this.playing = null;
      this.engine.duckMusic(false);
    };
    src.start();
    this.playing = src;
    this.engine.duckMusic(narrator);
    this.lastSource = 'clip';
    log(`clip ${id}`);
  }

  private speakDevice(id: Id): void {
    const narrator = this.clips.voiceOf(id) === NARRATOR;
    const line = this.line;
    const spoken = this.device.say(this.lines[id], () => {
      if (line === this.line) this.engine.duckMusic(false);
    });
    if (spoken) this.engine.duckMusic(narrator);
    this.lastSource = spoken ? 'device' : 'none';
    log(`${spoken ? 'device voice' : 'no voice (subtitle only)'}: ${id}`);
  }
}

/** The device's own speech synthesis (Web Speech API): the fallback voice. */
class DeviceVoice {
  readonly available: boolean;
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    // Some browsers have the name but no engine (null), or no utterance class.
    this.available =
      typeof window !== 'undefined' && !!window.speechSynthesis && typeof SpeechSynthesisUtterance === 'function';
    if (!this.available) return;
    this.pickVoice();
    window.speechSynthesis.addEventListener('voiceschanged', this.pickVoice);
  }

  /** Speaks `text`, cutting off whatever was being said; false if it could not. */
  say(text: string, onEnd: () => void): boolean {
    if (!this.available) return false;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = this.voice?.lang ?? 'en-US';
    if (this.voice) u.voice = this.voice;
    u.rate = 0.88;
    u.pitch = 1.05;
    u.volume = 0.9;
    u.onend = onEnd;
    u.onerror = onEnd;
    try {
      synth.speak(u);
      return true;
    } catch {
      return false; // speech refused: the subtitle still carries the words
    }
  }

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
