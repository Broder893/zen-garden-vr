// Dev-only helper: extract one frame (at FRAME_AT seconds) of artifacts/<REC_NAME>.webm as a PNG.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
export default async function run({ page, workspaceRoot }) {
  const name = process.env.REC_NAME ?? 'demo';
  const b64 = readFileSync(join(workspaceRoot, 'artifacts', `${name}.webm`)).toString('base64');
  const png = await page.evaluate(
    async ({ b64, at }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const v = document.createElement('video');
      v.muted = true;
      v.src = URL.createObjectURL(new Blob([bytes], { type: 'video/webm' }));
      await new Promise((r, j) => ((v.onloadeddata = r), (v.onerror = () => j(new Error('decode')))));
      // MediaRecorder files have no duration index, so play up to the moment instead of seeking.
      await v.play();
      await new Promise((r) => {
        const tick = () => (v.currentTime >= at || v.ended ? r() : requestAnimationFrame(tick));
        tick();
      });
      v.pause();
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = Math.round((640 * v.videoHeight) / v.videoWidth);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      return { url: c.toDataURL('image/png'), w: v.videoWidth, h: v.videoHeight, dur: v.duration };
    },
    { b64, at: Number(process.env.FRAME_AT ?? 2) },
  );
  const out = join(workspaceRoot, 'artifacts', `${name}-frame.png`);
  writeFileSync(out, Buffer.from(png.url.split(',')[1], 'base64'));
  return { out, w: png.w, h: png.h, dur: png.dur };
}
