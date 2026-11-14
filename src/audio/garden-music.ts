import { MusicDepth, nextPhrase, phraseGap } from './music-layers.js';
import type { SoundEngine } from './sound-engine.js';

/** D major pentatonic, so any two notes sound calm together. */
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const CHIME_NOTES = [74, 76, 78, 81, 83, 86, 88, 90].map(midi); // D5..F#6
const PAD_NOTES = [50, 57, 64].map(midi); // D3, A3, E4: an open, unresolved drone
/** F#4: the third that warms the drone once the tree is mature, a little more in bloom. */
const WARM_NOTE = midi(66);
const WARM_GAIN: Record<MusicDepth, number> = { 0: 0, 1: 0, 2: 0, 3: 0.012, 4: 0.024 };

/**
 * Generative background music: a warm drone plus sparse wind-chime notes.
 * It grows with the tree (src/audio/music-layers.ts): the drone alone before
 * planting, then single notes, small arpeggios, short melodies, and a warmer
 * drone in bloom. Never loops, never repeats exactly, costs a handful of oscillators.
 * During breathing the drone opens and closes with the breath.
 */
export class GardenMusic {
  /** Pentatonic notes, low to high, for growth arpeggios. */
  static readonly scale = CHIME_NOTES;
  private filter: BiquadFilterNode | null = null;
  private padGain: GainNode | null = null;
  private nextChime = 2;
  private started = false;
  private filterTarget = 0;
  private warm: GainNode | null = null;
  private warmDepth: MusicDepth = 0;

  constructor(private readonly engine: SoundEngine) {}

  /** Builds the drone once the context runs (oscillators made earlier would be wasted). */
  start(): void {
    const ctx = this.engine.ctx;
    const out = this.engine.music;
    if (this.started || !ctx || !out) return;
    this.started = true;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 520;
    this.filter.Q.value = 0.7;
    this.padGain = ctx.createGain();
    this.padGain.gain.setValueAtTime(0, ctx.currentTime);
    this.padGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 6);
    this.filter.connect(this.padGain).connect(out);
    // The warm voice: silent until the tree is mature (see WARM_GAIN).
    this.warm = ctx.createGain();
    this.warm.gain.value = 0;
    this.warm.connect(this.filter);
    for (const detune of [-4, 4]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = WARM_NOTE;
      osc.detune.value = detune;
      osc.connect(this.warm);
      osc.start();
    }
    PAD_NOTES.forEach((f, i) => {
      for (const detune of [-5, 5]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = f;
        osc.detune.value = detune + i;
        const g = ctx.createGain();
        g.gain.value = 0.09 / (i + 1);
        osc.connect(g).connect(this.filter!);
        osc.start();
      }
    });
  }

  /**
   * @param calm true during a breathing session: fewer chimes.
   * @param breath 0..1 breath fullness, opens the drone's filter.
   * @param depth how far the music has grown with the tree (0 drone only .. 4 in bloom).
   */
  tick(delta: number, calm: boolean, breath: number, depth: MusicDepth = 1): void {
    const ctx = this.engine.ctx;
    if (!this.started || !ctx || !this.filter) return;
    // Re-aim the filter only on a real change, not 72+ times a second.
    const target = Math.round(calm ? 420 + breath * 900 : 520);
    if (Math.abs(target - this.filterTarget) >= 15) {
      this.filterTarget = target;
      this.filter.frequency.setTargetAtTime(target, ctx.currentTime, 0.4);
    }

    if (depth !== this.warmDepth && this.warm) {
      this.warmDepth = depth;
      this.warm.gain.setTargetAtTime(WARM_GAIN[depth], ctx.currentTime, 2.5);
    }

    this.nextChime -= delta;
    if (this.nextChime > 0) return;
    this.nextChime = phraseGap(depth, calm, Math.random);
    for (const n of nextPhrase(depth, calm, CHIME_NOTES.length, Math.random)) {
      this.engine.musicChime(CHIME_NOTES[n.note], n.gain, n.delay);
    }
  }
}
