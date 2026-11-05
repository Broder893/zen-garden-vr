// API test against a running worker: `npm run dev` in one terminal, then `npm test`.
// BASE overrides the address (e.g. the deployed worker, carefully: it adds real cares).
const BASE = process.env.BASE ?? 'http://localhost:8787';
const ORIGIN = 'https://broder893.github.io';
let passed = 0;
let failed = 0;
const check = (name, ok, extra = '') => {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ` (${extra})` : ''}`);
};
// Each request looks like a different connection, except where the rate limit is tested.
const randomIp = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const req = (path, init = {}) =>
  fetch(BASE + path, {
    ...init,
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': randomIp(), ...(init.headers ?? {}) },
  });
const garden = crypto.randomUUID();

const before = await (await req('/tree')).json();
check('GET /tree has numbers', ['today', 'gardens', 'total'].every((k) => Number.isInteger(before[k])), JSON.stringify(before));

let r = await req('/tree/care', { method: 'POST', body: JSON.stringify({ garden }) });
let after = await r.json();
check('POST care counts 1', r.status === 200 && after.accepted === 1 && after.today === before.today + 1, JSON.stringify(after));
check('a new garden is counted', after.gardens === before.gardens + 1);
check('CORS allows the app', r.headers.get('access-control-allow-origin') === ORIGIN);

r = await req('/tree/care', { method: 'POST', body: JSON.stringify({ garden, count: 3 }) });
after = await r.json();
check('POST count 3', after.accepted === 3 && after.today === before.today + 4 && after.gardens === before.gardens + 1);

for (const [name, body] of [
  ['bad garden id', { garden: 'robert"); DROP TABLE days;--' }],
  ['count too big', { garden, count: 50 }],
  ['count zero', { garden, count: 0 }],
  ['no garden', { count: 1 }],
]) {
  r = await req('/tree/care', { method: 'POST', body: JSON.stringify(body) });
  check(`rejects ${name}`, r.status === 400);
}
r = await req('/tree/care', { method: 'POST', body: '{nope' });
check('rejects bad json', r.status === 400);
r = await req('/tree/care', { method: 'POST', body: 'x'.repeat(2000) });
check('rejects a large body', r.status === 413);

let total = 4;
for (let i = 0; i < 9; i++) {
  const d = await (await req('/tree/care', { method: 'POST', body: JSON.stringify({ garden, count: 5 }) })).json();
  total += d.accepted;
}
check('one garden is capped at 40 a day', total === 40, `got ${total}`);

const ip = randomIp();
let limited = 0;
for (let i = 0; i < 14; i++) {
  const lr = await req('/tree/care', { method: 'POST', body: JSON.stringify({ garden: crypto.randomUUID() }), headers: { 'CF-Connecting-IP': ip } });
  if (lr.status === 429) limited++;
}
check('one connection is rate limited', limited >= 1, `${limited} of 14 refused`);

r = await fetch(BASE + '/tree', { headers: { Origin: 'https://evil.example' } });
check('CORS refuses other sites', !r.headers.get('access-control-allow-origin'));
r = await req('/nothing');
check('unknown path 404', r.status === 404);
r = await req('/tree', { method: 'DELETE' });
check('wrong method 405', r.status === 405);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
