// Dev-only QA helper: from now on, every load of this page collects the errors the
// app lets escape (window.__errs: uncaught errors, unhandled rejections, console.error)
// and the warnings (window.__warns), then navigates to GOTO_QS.
//   GOTO_QS='?fresh' npx @iwsdk/cli browser run .iwsdk-scripts/goto-watch.mjs
export default async function run({ page, frame }) {
  if (!page.__zenWatching) {
    page.__zenWatching = true;
    await page.addInitScript(() => {
      if (window.__errs) return;
      window.__errs = [];
      window.__warns = [];
      addEventListener('error', (e) => window.__errs.push(String(e.error?.stack ?? e.message)));
      addEventListener('unhandledrejection', (e) => window.__errs.push('unhandled: ' + String(e.reason?.stack ?? e.reason)));
      const err = console.error.bind(console);
      console.error = (...a) => {
        window.__errs.push(a.map(String).join(' '));
        err(...a);
      };
      const warn = console.warn.bind(console);
      console.warn = (...a) => {
        window.__warns.push(a.map(String).join(' '));
        warn(...a);
      };
    });
  }
  const target = frame ?? page;
  const url = new URL(target.url());
  url.search = process.env.GOTO_QS ?? '';
  await target.goto(url.toString());
  return { url: target.url() };
}
