// Dev-only still capture: copies the app's 3D view (no DOM overlays, so no
// emulator badge or panels) right after an XR frame is drawn, like record.mjs,
// and saves it as a PNG.
//   SNAP_NAME=a-young SNAP_DIR=artifacts/bonsai-check npx @iwsdk/cli browser run .iwsdk-scripts/snap.mjs
// SNAP_WHEN (optional) is a JS expression: the still is taken in the first frame
// where it is true (checked every frame, up to SNAP_TIMEOUT seconds, default 60).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export default async function run({ frame, page, workspaceRoot }) {
  const app = frame ?? page;
  const data = await app.evaluate(
    ({ when, timeout }) =>
      new Promise((resolve, reject) => {
        const dev = window.__zenDev;
        if (!dev?.renderer) return reject(new Error('dev hook missing (run the dev server)'));
        const src = dev.renderer.domElement;
        const session = dev.renderer.xr.getSession();
        const grab = () => {
          const out = document.createElement('canvas');
          out.width = src.width;
          out.height = src.height;
          out.getContext('2d').drawImage(src, 0, 0);
          resolve({ url: out.toDataURL('image/png'), size: [out.width, out.height] });
        };
        // eslint-disable-next-line no-new-func
        const ready = when ? new Function(`return (${when});`) : () => true;
        const start = performance.now();
        // The XR picture can only be copied inside the frame that drew it.
        const tick = () => {
          if (performance.now() - start > timeout * 1000) return reject(new Error(`SNAP_WHEN never true: ${when}`));
          if (ready()) return queueMicrotask(grab);
          if (session) session.requestAnimationFrame(tick);
          else requestAnimationFrame(tick);
        };
        if (session) session.requestAnimationFrame(tick);
        else requestAnimationFrame(tick);
      }),
    { when: process.env.SNAP_WHEN ?? '', timeout: Number(process.env.SNAP_TIMEOUT ?? 60) },
  );
  const dir = join(workspaceRoot, process.env.SNAP_DIR ?? 'artifacts');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${process.env.SNAP_NAME ?? 'snap'}.png`);
  writeFileSync(file, Buffer.from(data.url.split(',')[1], 'base64'));
  return { file, size: data.size };
}
