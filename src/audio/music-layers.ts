/**
 * The music grows with the tree: which notes the next phrase plays, by depth.
 * Pure (no audio, no engine), so the tests run in Node.
 *
 *   0  before planting: the drone alone
 *   1  sprout: single notes
 *   2  young: notes, and now and then a small rising arpeggio
 *   3  mature: notes, arpeggios, and short stepwise melodies
 *   4  in bloom: the same, melodies more often (and a warmer drone)
 */
export type MusicDepth = 0 | 1 | 2 | 3 | 4;

export interface PhraseNote {
  /** Index into the scale (0 = lowest). */
  note: number;
  /** Seconds after the phrase starts. */
  delay: number;
  gain: number;
}

/** Always soft: no note louder than this on the music bus. */
export const MAX_NOTE_GAIN = 0.09;
const ARPEGGIO_STEP = 0.28;
const MELODY_STEP = 0.46;

/** The music's depth for a tree: 0 before planting, then one more per stage (sprout 1 .. bloom 4). */
export function depthFor(planted: boolean, stage: number): MusicDepth {
  if (!planted) return 0;
  return Math.min(4, Math.max(1, Math.round(stage) + 1)) as MusicDepth;
}

/**
 * The next phrase. `calm` (a breathing session) keeps to single notes.
 * `rand` returns 0..1 (Math.random in play, a fixed sequence in tests).
 */
export function nextPhrase(depth: MusicDepth, calm: boolean, scaleSize: number, rand: () => number): PhraseNote[] {
  if (depth === 0) return [];
  const pick = () => Math.floor(rand() * scaleSize);
  const kind = rand();
  const melodyOdds = calm ? 0 : depth >= 4 ? 0.4 : depth >= 3 ? 0.28 : 0;
  const arpeggioOdds = calm || depth < 2 ? 0 : 0.3;
  if (kind < melodyOdds) {
    // A short walk up and down the scale, one step (sometimes two) at a time.
    const notes: PhraseNote[] = [];
    let n = 1 + Math.floor(rand() * (scaleSize - 2));
    const length = 4 + Math.floor(rand() * 2);
    for (let i = 0; i < length; i++) {
      notes.push({ note: n, delay: i * MELODY_STEP, gain: 0.045 + 0.02 * rand() });
      const step = (rand() < 0.5 ? -1 : 1) * (rand() < 0.25 ? 2 : 1);
      n = Math.min(scaleSize - 1, Math.max(0, n + step));
    }
    return notes;
  }
  if (kind < melodyOdds + arpeggioOdds) {
    // Three notes rising, every other step of the scale.
    const base = Math.floor(rand() * Math.max(1, scaleSize - 4));
    return [0, 2, 4].map((up, i) => ({ note: base + up, delay: i * ARPEGGIO_STEP, gain: 0.05 - 0.008 * i }));
  }
  // The wind chime: one note, sometimes answered by a second.
  const notes: PhraseNote[] = [{ note: pick(), delay: 0, gain: 0.05 + rand() * 0.04 }];
  if (rand() < 0.35) notes.push({ note: pick(), delay: 0.3 + rand() * 0.4, gain: 0.035 });
  return notes;
}

/** Seconds until the next phrase: unhurried, a little sooner as the music deepens. */
export function phraseGap(depth: MusicDepth, calm: boolean, rand: () => number): number {
  return (calm ? 7 : depth >= 3 ? 3 : 3.5) + rand() * 5;
}
