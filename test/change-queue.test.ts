import { describe, expect, it } from 'vitest';
import { ChangeQueue, MAX_WAIT } from '../src/change-queue';

const open = (clock: number) => ({ clock, closedOrOff: false, closing: false });
const closing = (clock: number) => ({ clock, closedOrOff: false, closing: true });
const closed = (clock: number) => ({ clock, closedOrOff: true, closing: true });

describe('change queue (changes wait for closed eyes)', () => {
  it('holds a new season while the eyes are open, then lands it when they close', () => {
    const q = new ChangeQueue();
    expect(q.mayApply('season', open(0))).toBe(false);
    expect(q.pending.has('season')).toBe(true);
    expect(q.mayApply('season', open(100))).toBe(false);
    expect(q.mayApply('season', closed(101))).toBe(true);
    expect(q.pending.has('season')).toBe(false);
  });

  it('lets a season through after waiting long enough with no closed eyes coming', () => {
    const q = new ChangeQueue();
    q.mayApply('season', open(10));
    expect(q.mayApply('season', open(10 + MAX_WAIT.season - 1))).toBe(false);
    expect(q.mayApply('season', open(10 + MAX_WAIT.season))).toBe(true);
    expect(q.pending.size).toBe(0);
  });

  it('never times out while a closure is under way: the change waits for it', () => {
    const q = new ChangeQueue();
    q.mayApply('weather', open(0));
    expect(q.mayApply('weather', closing(1000))).toBe(false);
    expect(q.mayApply('weather', closed(1001))).toBe(true);
  });

  it('applies a stage change at once with open eyes, but waits during a closure', () => {
    const q = new ChangeQueue();
    expect(q.mayApply('stage', open(0))).toBe(true);
    expect(q.mayApply('stage', closing(1))).toBe(false);
    expect(q.mayApply('stage', closed(3))).toBe(true);
  });

  it('keeps each kind of change apart', () => {
    const q = new ChangeQueue();
    q.mayApply('time', open(0));
    q.mayApply('unlock', open(50));
    expect(q.mayApply('time', open(MAX_WAIT.time))).toBe(true);
    expect(q.mayApply('unlock', open(MAX_WAIT.time))).toBe(false);
    expect([...q.pending.keys()]).toEqual(['unlock']);
  });

  it('applies everything at once with the eyelids off', () => {
    const q = new ChangeQueue();
    for (const kind of ['stage', 'season', 'time', 'weather', 'unlock'] as const) {
      expect(q.mayApply(kind, { clock: 0, closedOrOff: true, closing: false })).toBe(true);
    }
  });
});
