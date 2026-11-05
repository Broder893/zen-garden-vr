// Dev-only test helper: from now on, any app URL containing "nostore" loads
// with storage refusing every garden key and audio that never starts and no speech, as on a locked
// down browser. Then navigates to GOTO_QS (which should contain "nostore").
export default async function run({ page, frame }) {
  await page.addInitScript(() => {
    // Exact parameter, once per page: init scripts stay registered for the page's lifetime.
    if (!new URLSearchParams(location.search).has('nostore') || window.__zenHostile) return;
    window.__zenHostile = true;
    // Collected for the test to read: any error the app lets escape.
    window.__errs = [];
    addEventListener('error', (e) => window.__errs.push(String(e.error?.stack ?? e.message)));
    addEventListener('unhandledrejection', (e) => window.__errs.push(String(e.reason?.stack ?? e.reason)));
    // Storage refuses every garden key (the dev bridge keeps its own keys working).
    for (const name of ['getItem', 'setItem', 'removeItem']) {
      const original = Storage.prototype[name];
      Storage.prototype[name] = function (key, ...rest) {
        if (String(key).startsWith('zen-garden-vr/')) throw new DOMException('Storage is disabled', 'SecurityError');
        return original.call(this, key, ...rest);
      };
    }
    // Audio that never starts (blocked autoplay, busy audio device): resume always fails.
    AudioContext.prototype.resume = () => Promise.reject(new DOMException('Audio is blocked', 'NotAllowedError'));
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: undefined });
  });
  const target = frame ?? page;
  const url = new URL(target.url());
  url.search = process.env.GOTO_QS ?? '?nostore';
  await target.goto(url.toString());
  return { url: target.url() };
}
