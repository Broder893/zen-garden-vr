import { AudioContext as SharedAudioContext } from '@iwsdk/core';

/**
 * All garden sounds are synthesised live with WebAudio: no audio files, so
 * nothing to license and nothing to download. Uses the same AudioContext as
 * Three/IWSDK so only one context exists on the headset.
 *
 * Every method is a no-op while the context is suspended or missing, so no
 * sounds queue up and burst out together when audio resumes.
 */
/** A looping filtered-noise sound (water, sand) and its current level. */
interface NoiseLoop {
  level: number;
  src: AudioBufferSourceNode | null;
  gain: GainNode | null;
}

export class SoundEngine {
  readonly ctx: AudioContext | null;
  /** Everything ends here; fades in on first unlock. */
  readonly master: GainNode | null = null;
  /** Wet send into a soft synthetic room reverb. */
  readonly reverb: GainNode | null = null;
  readonly music: GainNode | null = null;
  readonly sfx: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  /** Loop nodes exist only while sounding, so silence costs nothing. */
  private pour: NoiseLoop = { level: 0, src: null, gain: null };
  private rake: NoiseLoop = { level: 0, src: null, gain: null };
  private rain: NoiseLoop = { level: 0, src: null, gain: null };
  private wind: NoiseLoop = { level: 0, src: null, gain: null };

  constructor() {
    let ctx: AudioContext | null = null;
    try {
      // Three's typings declare their own AudioContext shape; it is the browser one at runtime.
      ctx = SharedAudioContext.getContext() as unknown as AudioContext;
    } catch {
      ctx = null;
    }
    this.ctx = ctx;
    if (!ctx) return;

    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(ctx.destination);

    const convolver = ctx.createConvolver();
    convolver.buffer = this.makeImpulse(ctx, 2.4);
    this.reverb = ctx.createGain();
    this.reverb.gain.value = 0.55;
    this.reverb.connect(convolver).connect(this.master);

    this.music = ctx.createGain();
    this.music.gain.value = 0.32;
    this.music.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.7;
    this.sfx.connect(this.master);

    this.noise = this.makeNoise(ctx, 2);
  }

  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  /** Call from a user gesture or XR session start; browsers block audio before that. */
  unlock(): void {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  /** A quiet chime on the music bus (background wind chimes, breath cues). */
  musicChime(freq: number, gain: number, delay = 0): void {
    this.chime(freq, delay, gain, 3.5, this.music);
  }

  /** A soft struck tone (sine plus a quiet octave) that rings out through the reverb. */
  chime(freq: number, delay = 0, gain = 0.18, decay = 2.2, out: GainNode | null = this.sfx): void {
    const ctx = this.live;
    if (!ctx || !out || !this.reverb) return;
    const t = ctx.currentTime + delay;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    env.connect(out);
    env.connect(this.reverb);
    for (const [mult, level] of [[1, 1], [2, 0.18], [3.01, 0.06]] as const) {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq * mult;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g).connect(env);
      osc.start(t);
      osc.stop(t + decay + 0.05);
    }
  }

  /** Singing bowl: slow inharmonic partials with a long gentle decay. */
  bowl(freq: number, gain = 0.22): void {
    const ctx = this.live;
    if (!ctx || !this.sfx || !this.reverb) return;
    const t = ctx.currentTime;
    for (const [mult, level, decay] of [[1, 1, 7], [2.71, 0.45, 5], [5.15, 0.18, 3]] as const) {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq * mult;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(gain * level, t + 0.04);
      env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      osc.connect(env);
      env.connect(this.sfx);
      env.connect(this.reverb);
      osc.start(t);
      osc.stop(t + decay + 0.05);
    }
  }

  /** Rising pentatonic notes for planting and growth moments. */
  arpeggio(freqs: readonly number[], step = 0.14, gain = 0.15): void {
    freqs.forEach((f, i) => this.chime(f, i * step, gain, 2.4));
  }

  /** Shears: two short metallic clicks a blink apart. */
  snip(): void {
    const ctx = this.live;
    if (!ctx || !this.sfx || !this.noise) return;
    for (const [delay, freq] of [[0, 4200], [0.07, 3400]] as const) {
      const t = ctx.currentTime + delay;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = freq;
      hp.Q.value = 6;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.9, t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      src.connect(hp).connect(env).connect(this.sfx);
      src.start(t, Math.random());
      src.stop(t + 0.08);
    }
  }

  /** One water drop landing on soil or leaves. */
  drip(): void {
    const ctx = this.live;
    if (!ctx || !this.sfx || !this.reverb) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const start = 900 + Math.random() * 700;
    osc.frequency.setValueAtTime(start, t);
    osc.frequency.exponentialRampToValueAtTime(start * 0.45, t + 0.09);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.12, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(env);
    env.connect(this.sfx);
    env.connect(this.reverb);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  /** Water pouring from the can: a bright, airy noise loop (0 = off). Cheap every frame: acts on change. */
  setPour(level: number): void {
    this.setLoop(this.pour, level, 'bandpass', 1500, 0.9, 0.22);
  }

  /** Fingers drawing in the sand: a soft, low hiss (0 = off). */
  setRake(level: number): void {
    this.setLoop(this.rake, level, 'lowpass', 700, 0.7, 0.1);
  }

  /** Rain on leaves and sand: a soft, wide hiss (0 = off). */
  setRain(level: number): void {
    this.setLoop(this.rain, level, 'lowpass', 2600, 0.5, 0.14);
  }

  /** A breeze through the bamboo: a low, breathy rush (0 = off). */
  setWind(level: number): void {
    this.setLoop(this.wind, level, 'bandpass', 420, 0.45, 0.16);
  }

  /** Starts, adjusts or fades out one filtered-noise loop. */
  private setLoop(loop: NoiseLoop, level: number, type: BiquadFilterType, freq: number, q: number, gainMax: number): void {
    const ctx = this.live;
    if (level === loop.level) return;
    loop.level = level;
    if (!ctx || !this.noise || !this.sfx) return;
    const t = ctx.currentTime;
    if (level > 0 && !loop.src) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.setTargetAtTime(level * gainMax, t, 0.12);
      src.connect(filter).connect(gain).connect(this.sfx);
      src.start(t, Math.random());
      loop.src = src;
      loop.gain = gain;
    } else if (level > 0 && loop.gain) {
      loop.gain.gain.setTargetAtTime(level * gainMax, t, 0.12);
    } else if (level === 0 && loop.src && loop.gain) {
      loop.gain.gain.setTargetAtTime(0, t, 0.12);
      loop.src.stop(t + 0.6);
      loop.src = null;
      loop.gain = null;
    }
  }

  /** The context when it is running, else null (sounds would only queue up). */
  private get live(): AudioContext | null {
    return this.ctx && this.ctx.state === 'running' ? this.ctx : null;
  }

  private makeNoise(ctx: AudioContext, seconds: number): AudioBuffer {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private makeImpulse(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      }
    }
    return buf;
  }
}
