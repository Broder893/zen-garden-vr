// Dev-only: loads the app with OPEN_QS (a query string) while the managed page is
// held at OPEN_VIEWPORT (default 1920x1080), then enters XR, so the XR view keeps
// that size afterwards even if the window is smaller (the emulator's framebuffer
// is set when the session starts). OPEN_BEFORE (optional): a JS expression run in
// the app before the reload (e.g. writing a save). Used by scripts/record-extra.sh.
import { execFileSync } from 'node:child_process';

export default async function run({ page, frame, workspaceRoot }) {
  const [width, height] = (process.env.OPEN_VIEWPORT ?? '1920x1080').split('x').map(Number);
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(500);
  const app = frame ?? page;
  if (process.env.OPEN_BEFORE) {
    // eslint-disable-next-line no-new-func
    await app.evaluate((src) => new Function(`return (${src});`)(), process.env.OPEN_BEFORE);
  }
  const url = new URL(app.url());
  url.search = process.env.OPEN_QS ?? '';
  await app.goto(url.toString());
  await app.waitForFunction(() => !!(window.__zen && window.__zenDev && window.__zen.guide), null, { timeout: 40000 });
  await page.waitForTimeout(2500);
  let entered = false;
  for (let i = 0; i < 5 && !entered; i++) {
    try {
      const out = execFileSync('npx', ['--no-install', '@iwsdk/cli', 'xr', 'enter', '--input-json', '{}'], {
        cwd: workspaceRoot,
        timeout: 20000,
      }).toString();
      entered = out.includes('"success": true');
    } catch {
      /* retried */
    }
    if (!entered) await page.waitForTimeout(1500);
  }
  const size = await app.evaluate(() => {
    const l = window.__zenDev.renderer.xr.getSession()?.renderState.baseLayer;
    return l ? [l.framebufferWidth, l.framebufferHeight] : null;
  });
  if (!entered || !size) throw new Error('could not enter XR');
  return { framebuffer: size };
}
