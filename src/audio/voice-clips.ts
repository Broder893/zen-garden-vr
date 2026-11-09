/** One recorded line from public/voices/manifest.json. */
interface Clip {
  /** Who says it: 'narrator' or 'firefly'. */
  voice: string;
  url: string;
  state: 'queued' | 'loading' | 'ready' | 'missing';
  buffer: AudioBuffer | null;
  /** Resolves once the clip is ready or known to be missing. */
  settled: Promise<void>;
  settle: () => void;
}

const VOICES_URL = `${import.meta.env.BASE_URL}voices/`;
/** Files fetched at once: enough to keep the network busy, few enough that a line asked for now is next. */
const PARALLEL = 3;
/**
 * The files' own rate (Kokoro writes 24 kHz). Decoding at it rather than the
 * context's 48 kHz halves the cache (about 13 MB for all lines); playback resamples.
 */
const DECODE_RATE = 24000;

const log = import.meta.env.DEV ? (msg: string) => console.info(`[voice] ${msg}`) : () => {};

/**
 * The guide's recorded lines (public/voices/). Nothing is fetched until
 * load() (the first gesture); then the manifest, then every file, the
 * first-five-minutes lines first. Each file is decoded once and kept in
 * memory. A file that fails is "missing", never an error: the guide then
 * reads that line with the device voice.
 */
export class VoiceClips {
  private clips = new Map<string, Clip>();
  private queue: string[] = [];
  private active = 0;
  private manifest: Promise<void> | null = null;
  private manifestRead = false;
  private broken = false;
  private startedAt = 0;
  private loadedCount = 0;
  private decoder: BaseAudioContext | null;

  constructor(private readonly ctx: AudioContext | null) {
    this.decoder = ctx;
    try {
      if (ctx) this.decoder = new OfflineAudioContext(1, 1, DECODE_RATE);
    } catch {
      /* no offline context: decode at the context's rate */
    }
  }

  /** Starts loading, once: the manifest, then every file, `first` ones first. Never blocks. */
  load(first: readonly string[]): void {
    if (this.manifest || !this.ctx) return;
    this.startedAt = performance.now();
    this.manifest = this.readManifest(first);
  }

  /** The decoded recording of `id`, or null while it loads (or if it is missing). */
  buffer(id: string): AudioBuffer | null {
    return this.clips.get(id)?.buffer ?? null;
  }

  /** Who says `id` ('narrator', 'firefly'), or '' when unknown. */
  voiceOf(id: string): string {
    return this.clips.get(id)?.voice ?? '';
  }

  /** False when no recording can come for `id`: no Web Audio, not loading, no manifest, no entry or a failed file. */
  mayHave(id: string): boolean {
    if (!this.ctx || !this.manifest || this.broken) return false;
    if (!this.manifestRead) return true;
    const clip = this.clips.get(id);
    return !!clip && clip.state !== 'missing';
  }

  /** Resolves when `id` is ready or known missing; a queued file is fetched next. */
  async settle(id: string): Promise<void> {
    if (this.manifest) await this.manifest;
    const clip = this.clips.get(id);
    if (!clip) return;
    if (clip.state === 'queued') {
      const i = this.queue.indexOf(id);
      if (i > 0) {
        this.queue.splice(i, 1);
        this.queue.unshift(id);
      }
      this.pump();
    }
    await clip.settled;
  }

  /** Files decoded so far, and in the manifest (dev checks). */
  get progress(): { loaded: number; total: number } {
    return { loaded: this.loadedCount, total: this.clips.size };
  }

  private async readManifest(first: readonly string[]): Promise<void> {
    try {
      const res = await fetch(`${VOICES_URL}manifest.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      if (!data || typeof data !== 'object') throw new Error('not an object');
      for (const [id, raw] of Object.entries(data as Record<string, unknown>)) {
        const entry = raw as { voice?: unknown; file?: unknown } | null;
        if (typeof entry?.file !== 'string') continue;
        let settle!: () => void;
        const settled = new Promise<void>((resolve) => (settle = resolve));
        const voice = typeof entry.voice === 'string' ? entry.voice : '';
        this.clips.set(id, { voice, url: VOICES_URL + entry.file, state: 'queued', buffer: null, settled, settle });
      }
      const early = first.filter((id) => this.clips.has(id));
      this.queue.push(...early, ...[...this.clips.keys()].filter((id) => !early.includes(id)));
      this.manifestRead = true;
      log(`manifest: ${this.clips.size} lines`);
      this.pump();
    } catch (err) {
      // No manifest: every line uses the device voice.
      this.broken = true;
      log(`manifest unavailable (${String(err)}): device voice`);
    }
  }

  private pump(): void {
    while (this.active < PARALLEL && this.queue.length > 0) {
      const clip = this.clips.get(this.queue.shift()!);
      if (!clip || clip.state !== 'queued') continue;
      this.active++;
      void this.fetchClip(clip).finally(() => {
        this.active--;
        this.pump();
      });
    }
  }

  private async fetchClip(clip: Clip): Promise<void> {
    clip.state = 'loading';
    try {
      const res = await fetch(clip.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      clip.buffer = await this.decoder!.decodeAudioData(await res.arrayBuffer());
      clip.state = 'ready';
      if (++this.loadedCount === this.clips.size) {
        log(`all ${this.loadedCount} lines loaded in ${((performance.now() - this.startedAt) / 1000).toFixed(1)} s`);
      }
    } catch (err) {
      clip.state = 'missing';
      log(`missing ${clip.url} (${String(err)}): device voice for it`);
    }
    clip.settle();
  }
}
