/**
 * The shared tree's tiny service (PROGETTO.md, point 8): anonymous, asynchronous
 * care counts that every visitor of the Zen Garden adds to.
 *
 *   GET  /tree       -> { day, today, gardens, total }
 *   POST /tree/care  { garden, count? } -> { day, today, gardens, total, accepted }
 *
 * No personal data: no names, no chat, no IP stored. `garden` is a random id
 * the app makes, used only to count distinct gardens per day and to cap how
 * much one garden can add (so nobody can inflate the tree by looping). A
 * rate limit per connection (Cloudflare's limiter, in memory only) stops one
 * client from minting garden ids to fill the daily total.
 */
export interface Env {
  DB: D1Database;
  /** Cloudflare's in-memory rate limiter (wrangler.toml): keyed by IP, nothing stored. */
  CARE_LIMITER?: RateLimit;
}

/** One garden adds at most this many cares a day. */
const PER_GARDEN_DAILY = 40;
/** And the tree takes at most this many a day in all (keeps the free tier safe). */
const GLOBAL_DAILY = 20000;
/** Cares one request may carry (the app queues a few while offline). */
const MAX_PER_REQUEST = 5;
const MAX_BODY = 512;
const GARDEN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** The published app, and local development (https on localhost or the LAN). */
const ALLOWED_ORIGIN = /^https:\/\/(broder893\.github\.io|localhost(:\d+)?|127\.0\.0\.1(:\d+)?|192\.168\.\d{1,3}\.\d{1,3}(:\d+)?)$/;

interface TreeState {
  day: string;
  today: number;
  gardens: number;
  total: number;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    const cors = corsHeaders(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    try {
      if (path === '/tree' && request.method === 'GET') {
        return json(await state(env, utcDay()), 200, cors);
      }
      if (path === '/tree/care' && request.method === 'POST') {
        return await care(request, env, cors);
      }
      if (path === '/tree' || path === '/tree/care') return json({ error: 'method' }, 405, cors);
      return json({ error: 'not found' }, 404, cors);
    } catch (err) {
      console.error(err);
      return json({ error: 'unavailable' }, 503, cors);
    }
  },
};

async function care(request: Request, env: Env, cors: Headers): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  if (env.CARE_LIMITER && !(await env.CARE_LIMITER.limit({ key: ip })).success) {
    return json({ error: 'slow down' }, 429, cors);
  }
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: 'too large' }, 413, cors);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'bad json' }, 400, cors);
  }
  if (typeof body !== 'object' || body === null) return json({ error: 'bad body' }, 400, cors);
  const { garden, count } = body as { garden?: unknown; count?: unknown };
  if (typeof garden !== 'string' || !GARDEN_ID.test(garden)) return json({ error: 'bad garden' }, 400, cors);
  const asked = count === undefined ? 1 : Number(count);
  if (!Number.isInteger(asked) || asked < 1 || asked > MAX_PER_REQUEST) return json({ error: 'bad count' }, 400, cors);

  const day = utcDay();
  const row = await env.DB.prepare(
    'SELECT (SELECT cares FROM gardens WHERE day = ?1 AND garden = ?2) AS mine, (SELECT cares FROM days WHERE day = ?1) AS today',
  )
    .bind(day, garden)
    .first<{ mine: number | null; today: number | null }>();
  const accepted = Math.max(
    0,
    Math.min(asked, PER_GARDEN_DAILY - (row?.mine ?? 0), GLOBAL_DAILY - (row?.today ?? 0)),
  );
  if (accepted > 0) {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO gardens (day, garden, cares) VALUES (?1, ?2, ?3) ON CONFLICT (day, garden) DO UPDATE SET cares = cares + ?3',
      ).bind(day, garden, accepted),
      env.DB.prepare(
        'INSERT INTO days (day, cares) VALUES (?1, ?2) ON CONFLICT (day) DO UPDATE SET cares = cares + ?2',
      ).bind(day, accepted),
    ]);
  }
  return json({ ...(await state(env, day)), accepted }, 200, cors);
}

async function state(env: Env, day: string): Promise<TreeState> {
  const row = await env.DB.prepare(
    `SELECT
       (SELECT cares FROM days WHERE day = ?1) AS today,
       (SELECT COUNT(*) FROM gardens WHERE day = ?1) AS gardens,
       (SELECT SUM(cares) FROM days) AS total`,
  )
    .bind(day)
    .first<{ today: number | null; gardens: number | null; total: number | null }>();
  return { day, today: row?.today ?? 0, gardens: row?.gardens ?? 0, total: row?.total ?? 0 };
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function corsHeaders(origin: string): Headers {
  const h = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  });
  if (ALLOWED_ORIGIN.test(origin)) h.set('Access-Control-Allow-Origin', origin);
  return h;
}

function json(data: unknown, status: number, headers: Headers): Response {
  const h = new Headers(headers);
  h.set('Content-Type', 'application/json');
  h.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(data), { status, headers: h });
}
