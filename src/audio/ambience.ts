import type { Season, TimeOfDay } from '../save/atmosphere.js';
import type { SoundEngine } from './sound-engine.js';

/** What the garden around the player sounds like now. */
export interface AmbienceScene {
  season: Season;
  time: TimeOfDay;
  /** The weather's own rain and breeze (0..1), already heard through the sound engine. */
  rain: number;
  breeze: number;
}

/** The whole ambience, under the music (the drone's bus is 0.32). */
const BUS_GAIN = 0.55;
/** Share kept while a voice speaks, and with the eyes fully closed. */
const UNDER_VOICE = 0.35;
const UNDER_LIDS = 0.3;
/** Echo of birds and owl through the engine's room reverb. */
const REVERB_SEND = 0.25;
/** Events are scheduled this far ahead of the audio clock (s). */
const LOOKAHEAD = 0.25;

/** The wind in the trees per season: band centre (Hz), sharpness, level. Winter is thin and cold. */
const WIND: Record<Season, { hz: number; q: number; level: number }> = {
  spring: { hz: 520, q: 0.5, level: 0.07 },
  summer: { hz: 480, q: 0.5, level: 0.06 },
  autumn: { hz: 600, q: 0.6, level: 0.08 },
  winter: { hz: 950, q: 2.2, level: 0.09 },
};

const between = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * The garden's seasonal ambience, synthesised (no files): a light wind in the
 * trees always (thin and cold in winter); far birds by day in spring and summer;
 * crickets on summer evenings and nights; leaves rustling in autumn; a distant
 * owl at night. Very quiet, on its own bus straight to the master: it dips while
 * the guide speaks and with closed eyes, and falls silent with the context
 * (headset off, menu open). It leaves the weather's rain and breeze to the sound
 * engine: the wind steps back while they blow, the birds and crickets stop in rain.
 *
 * Cost: eight lasting nodes (bus, send, the wind's noise, filter, gain and slow
 * swell, the crickets' tone and gain); birds, owl and rustles are a few short
 * notes every several seconds, scheduled on the audio clock.
 */
export class GardenAmbience {
  private bus: GainNode | null = null;
  private wind: { filter: BiquadFilterNode; gain: GainNode } | null = null;
  private cricket: { osc: OscillatorNode; gain: GainNode } | null = null;
  private started = false;
  private level = -1;
  private windKey = '';
  private nextBird = 0;
  private nextCricket = 0;
  private nextOwl = 0;
  private nextRustle = 0;

  constructor(private readonly engine: SoundEngine) {}

  /** Builds the lasting nodes once the context runs; fades in over a few seconds. */
  start(): void {
    const ctx = this.engine.ctx;
    const noise = this.engine.noiseBuffer;
    if (this.started || !ctx || !this.engine.master || !noise) return;
    this.started = true;
    const t = ctx.currentTime;
    this.bus = ctx.createGain();
    this.bus.gain.setValueAtTime(0, t);
    this.bus.gain.linearRampToValueAtTime(BUS_GAIN, t + 6);
    this.level = 1;
    this.bus.connect(this.engine.master);
    if (this.engine.reverb) {
      const send = ctx.createGain();
      send.gain.value = REVERB_SEND;
      this.bus.connect(send).connect(this.engine.reverb);
    }

    // Wind: looping noise through a soft band, swelling slowly (a 14 s breath of air).
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const swell = ctx.createOscillator();
    swell.frequency.value = 0.07;
    const depth = ctx.createGain();
    depth.gain.value = 0.3;
    swell.connect(depth).connect(filter.frequency);
    src.connect(filter).connect(gain).connect(this.bus);
    src.start(t, Math.random());
    swell.start(t);
    this.wind = { filter, gain };

    // Crickets: one high tone, gated into short trills on the audio clock.
    const osc = ctx.createOscillator();
    osc.frequency.value = 4500;
    const cg = ctx.createGain();
    cg.gain.value = 0;
    osc.connect(cg).connect(this.bus);
    osc.start(t);
    this.cricket = { osc, gain: cg };

    this.nextBird = t + between(3, 6);
    this.nextCricket = t + 1;
    this.nextOwl = t + between(8, 16);
    this.nextRustle = t + between(2, 5);
  }

  /**
   * Once a frame. It dips while `speaking` (a voice is on) and as `lids` close
   * (0 open .. 1 closed). Acts only on changes and due events.
   */
  tick(scene: AmbienceScene, speaking: boolean, lids: number): void {
    const ctx = this.engine.ctx;
    if (!this.started || !ctx || !this.bus || ctx.state !== 'running') return;
    const t = ctx.currentTime;

    const level = Math.round((speaking ? UNDER_VOICE : 1) * (1 - (1 - UNDER_LIDS) * lids) * 20) / 20;
    if (level !== this.level) {
      // Quick to dip under a voice, slow to come back.
      this.bus.gain.setTargetAtTime(BUS_GAIN * level, t, level < this.level ? 0.15 : 0.8);
      this.level = level;
    }

    // The weather's breeze and rain are heard already: the trees' wind steps back for them.
    const w = WIND[scene.season];
    const windLevel = w.level * (1 - 0.75 * scene.breeze) * (1 - 0.4 * scene.rain);
    const key = `${scene.season}:${Math.round(windLevel * 1000)}`;
    if (this.wind && key !== this.windKey) {
      this.windKey = key;
      this.wind.filter.frequency.setTargetAtTime(w.hz, t, 1.5);
      this.wind.filter.Q.setTargetAtTime(w.q, t, 1.5);
      this.wind.gain.gain.setTargetAtTime(windLevel, t, 1.5);
    }

    const dry = scene.rain < 0.3;
    const warm = scene.season === 'spring' || scene.season === 'summer';
    if (t + LOOKAHEAD >= this.nextBird) {
      if (dry && warm && scene.time === 'day') this.bird(Math.max(t, this.nextBird));
      this.nextBird = Math.max(t, this.nextBird) + between(4, 11);
    }
    if (t + LOOKAHEAD >= this.nextCricket) {
      const on = dry && scene.season === 'summer' && scene.time !== 'day';
      this.nextCricket = Math.max(t, this.nextCricket) + (on ? this.trill(Math.max(t, this.nextCricket)) : 1);
    }
    if (t + LOOKAHEAD >= this.nextOwl) {
      if (dry && scene.time === 'night') this.owl(Math.max(t, this.nextOwl));
      this.nextOwl = Math.max(t, this.nextOwl) + between(22, 45);
    }
    if (t + LOOKAHEAD >= this.nextRustle) {
      if (scene.season === 'autumn') this.rustle(Math.max(t, this.nextRustle));
      this.nextRustle = Math.max(t, this.nextRustle) + between(5, 12);
    }
  }

  /** A far bird: two to five quick falling or rising chirps, off to one side. */
  private bird(t: number): void {
    const ctx = this.engine.ctx!;
    const pan = ctx.createStereoPanner();
    pan.pan.value = between(-0.8, 0.8);
    pan.connect(this.bus!);
    const notes = 2 + Math.floor(Math.random() * 4);
    const base = between(2600, 4000);
    const fall = Math.random() < 0.6;
    let at = t;
    let last: OscillatorNode | null = null;
    for (let i = 0; i < notes; i++) {
      const len = between(0.05, 0.11);
      const osc = ctx.createOscillator();
      const f = base * between(0.92, 1.08);
      osc.frequency.setValueAtTime(f, at);
      osc.frequency.exponentialRampToValueAtTime(f * (fall ? 0.7 : 1.3), at + len);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(0.04, at + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, at + len);
      osc.connect(env).connect(pan);
      osc.start(at);
      osc.stop(at + len + 0.02);
      at += len + between(0.04, 0.12);
      last = osc;
    }
    // The panner goes with its last note (on the audio clock, so a pause does not cut it).
    if (last) last.onended = () => pan.disconnect();
  }

  /** A cricket trill of four to seven pulses; returns when the next may start (s). */
  private trill(t: number): number {
    const c = this.cricket!;
    c.osc.frequency.setValueAtTime(between(4300, 4700), t);
    const pulses = 4 + Math.floor(Math.random() * 4);
    let at = t;
    for (let i = 0; i < pulses; i++) {
      c.gain.gain.setValueAtTime(0, at);
      c.gain.gain.linearRampToValueAtTime(0.03, at + 0.008);
      c.gain.gain.linearRampToValueAtTime(0, at + 0.03);
      at += 0.055;
    }
    return at - t + between(0.5, 1.8);
  }

  /** A distant owl: "hoo ... hoo-hoo", low and soft, from one side. */
  private owl(t: number): void {
    const ctx = this.engine.ctx!;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() < 0.5 ? -0.6 : 0.6;
    pan.connect(this.bus!);
    let last: OscillatorNode | null = null;
    for (const [at, len] of [[0, 0.5], [0.95, 0.22], [1.25, 0.45]] as const) {
      const s = t + at;
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(380, s);
      osc.frequency.linearRampToValueAtTime(340, s + len);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, s);
      env.gain.linearRampToValueAtTime(0.06, s + 0.07);
      env.gain.setValueAtTime(0.06, s + len * 0.6);
      env.gain.linearRampToValueAtTime(0, s + len);
      osc.connect(env).connect(pan);
      osc.start(s);
      osc.stop(s + len + 0.02);
      last = osc;
    }
    if (last) last.onended = () => pan.disconnect();
  }

  /** Dry leaves stirring: a short gust of bright noise, crackling in small random steps. */
  private rustle(t: number): void {
    const ctx = this.engine.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.engine.noiseBuffer;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = between(2800, 4200);
    band.Q.value = 0.8;
    const env = ctx.createGain();
    const len = between(1.2, 2.4);
    env.gain.setValueAtTime(0, t);
    for (let i = 1; i <= 14; i++) {
      const k = i / 15;
      // Rises and falls once, with a random crackle on top.
      env.gain.setValueAtTime(0.05 * Math.sin(Math.PI * k) * between(0.3, 1), t + k * len);
    }
    env.gain.setValueAtTime(0, t + len);
    src.connect(band).connect(env).connect(this.bus!);
    src.start(t, Math.random());
    src.stop(t + len + 0.05);
  }
}
