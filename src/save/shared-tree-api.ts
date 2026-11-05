/**
 * The shared tree's online service (server/shared-tree) and what this device
 * keeps of it. Pure module: no ECS, no Three. Every call can fail (offline,
 * service down, storage blocked): failures return null or defaults and never
 * throw, so the garden carries on offline.
 *
 * Privacy: the only thing sent is a random garden id made here (not linked to
 * a person) and how many cares to add.
 */
export interface TreeState {
  /** UTC day the counts are for, YYYY-MM-DD. */
  day: string;
  today: number;
  gardens: number;
  total: number;
}

export interface SharedLocal {
  /** Random id of this garden, made once on this device. */
  garden: string;
  /** The firefly has introduced the shared tree. */
  introShown: boolean;
  /** Cares made while offline (or still on their way), sent on the next sync. */
  pending: number;
  /** Last counts heard from the service, shown while offline. */
  cache: TreeState | null;
}

/** The published service (server/shared-tree/README.md); empty until it is deployed. */
const SHARED_TREE_DEFAULT_URL = '';
/** Where the service lives (VITE_SHARED_TREE_URL overrides). Empty: the shared tree stays offline. */
export const SHARED_TREE_URL: string = (import.meta.env.VITE_SHARED_TREE_URL ?? SHARED_TREE_DEFAULT_URL).replace(/\/+$/, '');
const TIMEOUT_MS = 5000;
/** The service accepts at most this many cares per request. */
export const MAX_PER_REQUEST = 5;
const KEY = 'zen-garden-vr/shared';
const VERSION = 1;
const GARDEN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Today's date as the service counts it (UTC). */
export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Reads the counts from untrusted JSON; null if anything is off. */
export function parseState(data: unknown): TreeState | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  const ok = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < 1e9;
  if (typeof d.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.day)) return null;
  if (!ok(d.today) || !ok(d.gardens) || !ok(d.total)) return null;
  return { day: d.day, today: d.today as number, gardens: d.gardens as number, total: d.total as number };
}

async function call(path: string, init?: RequestInit): Promise<unknown> {
  if (!SHARED_TREE_URL) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(SHARED_TREE_URL + path, { ...init, signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Today's counts, or null when the service cannot be reached. */
export async function fetchTree(): Promise<TreeState | null> {
  return parseState(await call('/tree'));
}

/** Adds `count` cares; the new counts and how many were accepted, or null when offline. */
export async function sendCare(garden: string, count: number): Promise<{ state: TreeState; accepted: number } | null> {
  const data = await call('/tree/care', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ garden, count: Math.max(1, Math.min(MAX_PER_REQUEST, Math.round(count))) }),
  });
  const state = parseState(data);
  if (!state) return null;
  const accepted = (data as { accepted?: unknown }).accepted;
  return { state, accepted: typeof accepted === 'number' && accepted >= 0 ? accepted : 0 };
}

function newGardenId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Fallback (old browsers): a version 4 id from Math.random, good enough for counting.
  const h = () => Math.floor(Math.random() * 16).toString(16);
  const part = (n: number) => Array.from({ length: n }, h).join('');
  return `${part(8)}-${part(4)}-4${part(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${part(3)}-${part(12)}`;
}

/** What this device keeps; defaults (and a new garden id) when missing, unreadable or blocked. */
export function loadShared(): SharedLocal {
  const fresh: SharedLocal = { garden: newGardenId(), introShown: false, pending: 0, cache: null };
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return fresh;
  }
  if (!raw) return fresh;
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (d.v !== VERSION) return fresh;
    return {
      garden: typeof d.garden === 'string' && GARDEN_ID.test(d.garden) ? d.garden : fresh.garden,
      introShown: d.introShown === true,
      pending: typeof d.pending === 'number' && d.pending > 0 ? Math.min(MAX_PER_REQUEST * 4, Math.floor(d.pending)) : 0,
      cache: parseState(d.cache),
    };
  } catch {
    return fresh;
  }
}

/** Keeps it; false (and nothing kept) if storage refuses. */
export function storeShared(s: SharedLocal): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ v: VERSION, ...s }));
    return true;
  } catch {
    return false;
  }
}
