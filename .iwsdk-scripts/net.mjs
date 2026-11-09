// Dev-only QA helper: bad networks and a backgrounded tab.
// The app's requests (models, voices, the shared tree) all go through fetch, so an
// init script wraps fetch by a config kept in localStorage ('qa-net'); it lasts across
// reloads until NET_CLEAR. Throttling and freezing need the CDP session, so they only
// last for this run (the page load it measures, or the freeze).
//   NET_BLOCK=regex                  matching fetches fail, as offline (NET_ONCE=1: one page load only)
//   NET_DELAY=regex NET_DELAY_MS=n   matching fetches wait n ms (-1: never answer)
//   NET_CLEAR=1                      back to a normal network
//   NET_THROTTLE=slow                slow 4G for the page load in this run (GOTO_QS)
//   NET_FREEZE_MS=n                  freeze the page n ms, as a background tab
//   GOTO_QS=...                      navigate, and report how long until the garden runs
//   NET_WATCH_MS=n                   instead, watch n ms: page loads seen, and whether the garden is up
export default async function run({ page, frame }) {
  const env = process.env;
  const target = frame ?? page;
  if (!page.__zenNet) {
    page.__zenNet = true;
    await page.addInitScript(() => {
      let cfg = null;
      try {
        cfg = JSON.parse(localStorage.getItem('qa-net') || 'null');
      } catch {}
      if (!cfg || window.__qaNet) return;
      window.__qaNet = cfg;
      const real = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = String(input?.url ?? input);
        if (cfg.block && new RegExp(cfg.block).test(url)) {
          // Once: only this page load fails, as one dropped request.
          if (cfg.once) localStorage.removeItem('qa-net');
          return Promise.reject(new TypeError('Failed to fetch (qa: offline)'));
        }
        if (cfg.delay && new RegExp(cfg.delay).test(url)) {
          if (cfg.ms < 0) return new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
          return new Promise((r) => setTimeout(r, cfg.ms)).then(() => real(input, init));
        }
        return real(input, init);
      };
    });
  }
  const cfg = env.NET_CLEAR ? null : { block: env.NET_BLOCK, once: !!env.NET_ONCE, delay: env.NET_DELAY, ms: Number(env.NET_DELAY_MS ?? 3000) };
  await target.evaluate((c) => (c ? localStorage.setItem('qa-net', JSON.stringify(c)) : localStorage.removeItem('qa-net')), cfg);
  const cdp = await page.context().newCDPSession(page);
  if (env.NET_THROTTLE === 'slow') {
    await cdp.send('Network.enable');
    // About a slow 4G link: 400 ms round trip, 1.6 Mbit/s down, 750 kbit/s up; no cache.
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 200_000, uploadThroughput: 94_000 });
  }
  let loadMs = null;
  let readyMs = null;
  if (env.GOTO_QS !== undefined) {
    const url = new URL(target.url());
    url.search = env.GOTO_QS;
    const t0 = Date.now();
    let navigations = 0;
    const count = (f) => {
      if (f === target) navigations++;
    };
    page.on('framenavigated', count);
    await target.goto(url.toString(), { timeout: 300_000 });
    loadMs = Date.now() - t0;
    if (env.NET_WATCH_MS) {
      // Watch the page instead of waiting for the garden: how many loads, and is it up?
      await new Promise((r) => setTimeout(r, Number(env.NET_WATCH_MS)));
      page.off('framenavigated', count);
      const up = await target.evaluate(() => !!window.__zen).catch(() => false);
      await cdp.detach();
      return { loadMs, navigations, up };
    }
    page.off('framenavigated', count);
    // The garden is up once the bonsai model is in the scene.
    await target.waitForFunction(() => window.__zen?.blender && window.__zen.guide?.world?.scene?.getObjectByName('Bonsai'), null, { timeout: 300_000, polling: 250 });
    readyMs = Date.now() - t0;
  }
  if (env.NET_THROTTLE) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  if (env.NET_FREEZE_MS) {
    await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
    await new Promise((r) => setTimeout(r, Number(env.NET_FREEZE_MS)));
    await cdp.send('Page.setWebLifecycleState', { state: 'active' });
  }
  await cdp.detach();
  return { loadMs, readyMs };
}
