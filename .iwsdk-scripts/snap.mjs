// Dev-only still capture: copies the app's 3D view (no DOM overlays, so no
// emulator badge or panels) right after an XR frame is drawn, like record.mjs,
// and saves it as a PNG.
//   SNAP_NAME=a-young SNAP_DIR=artifacts/bonsai-check npx @iwsdk/cli browser run .iwsdk-scripts/snap.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export default async function run({ frame, page, workspaceRoot }) {
  const app = frame ?? page;
  const data = await app.evaluate(
    () =>
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
        // The XR picture can only be copied inside the frame that drew it.
        if (session) session.requestAnimationFrame(() => queueMicrotask(grab));
        else requestAnimationFrame(grab);
      }),
  );
  const dir = join(workspaceRoot, process.env.SNAP_DIR ?? 'artifacts');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${process.env.SNAP_NAME ?? 'snap'}.png`);
  writeFileSync(file, Buffer.from(data.url.split(',')[1], 'base64'));
  return { file, size: data.size };
}
