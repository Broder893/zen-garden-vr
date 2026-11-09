// Dev-only helper: removes a stale Vite error overlay from the page and every frame.
export default async function run({ page }) {
  let removed = 0;
  for (const f of page.frames()) {
    removed += await f.evaluate(() => {
      const els = document.querySelectorAll('vite-error-overlay');
      els.forEach((e) => e.remove());
      return els.length;
    }).catch(() => 0);
  }
  return { removed };
}
