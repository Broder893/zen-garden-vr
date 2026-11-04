// Dev-only recorder for the demo video. Captures the app's 3D view (no DOM
// overlays, so no emulator badge) plus its Web Audio output into a .webm file.
//   REC=start npx @iwsdk/cli browser run .iwsdk-scripts/record.mjs
//   REC=stop  REC_NAME=clip1 npx @iwsdk/cli browser run .iwsdk-scripts/record.mjs
// The file lands in artifacts/<REC_NAME>.webm. The device voice (speech
// synthesis) is not part of Web Audio, so it is not recorded; subtitles are.
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

export default async function run({ frame, page, workspaceRoot }) {
  const app = frame ?? page;
  const action = process.env.REC ?? 'start';
  if (action === 'start') {
    return app.evaluate(() => {
      const dev = window.__zenDev;
      if (!dev?.renderer) throw new Error('dev hook missing (run the dev server)');
      const src = dev.renderer.domElement;
      // Copy every frame onto our own canvas right after the app draws it. In the
      // emulated XR session the app canvas cannot be captured directly (frames
      // come out empty), but a copy taken in the same XR frame is complete.
      const out = document.createElement('canvas');
      // 1920x1080 (16:9, YouTube's native size), cropped from the view.
      out.width = 1920;
      out.height = 1080;
      const g = out.getContext('2d');
      let running = true;
      const copy = () => {
        if (!running) return;
        const cropH = Math.min(src.height, Math.round((src.width * 9) / 16));
        const cropW = Math.round((cropH * 16) / 9);
        // Keep more of the top, where the subtitles float; trim more of the table's front edge.
        g.drawImage(src, (src.width - cropW) / 2, (src.height - cropH) * 0.2, cropW, cropH, 0, 0, 1920, 1080);
        const session = dev.renderer.xr.getSession();
        if (session) session.requestAnimationFrame(copy);
        else requestAnimationFrame(copy);
      };
      copy();
      const stream = out.captureStream(30);
      if (dev.ctx && dev.master) {
        const dest = dev.ctx.createMediaStreamDestination();
        dev.master.connect(dest);
        for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
      }
      const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) =>
        MediaRecorder.isTypeSupported(m),
      );
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.start(1000);
      window.__zenRec = { rec, chunks, mime, stop: () => (running = false) };
      return { started: true, mime, size: [out.width, out.height], audio: stream.getAudioTracks().length };
    });
  }

  const info = await app.evaluate(async () => {
    const r = window.__zenRec;
    if (!r) throw new Error('not recording');
    await new Promise((res) => {
      r.rec.onstop = res;
      r.rec.stop();
    });
    r.stop();
    window.__zenRecBlob = new Blob(r.chunks, { type: r.mime });
    window.__zenRec = null;
    return { bytes: window.__zenRecBlob.size, mime: r.mime };
  });
  const dir = join(workspaceRoot, 'artifacts');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${process.env.REC_NAME ?? 'demo'}.webm`);
  writeFileSync(file, Buffer.alloc(0));
  const SLICE = 2 * 1024 * 1024;
  for (let o = 0; o < info.bytes; o += SLICE) {
    const b64 = await app.evaluate(
      async ({ o, n }) => {
        const u = new Uint8Array(await window.__zenRecBlob.slice(o, o + n).arrayBuffer());
        let s = '';
        for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
        return btoa(s);
      },
      { o, n: SLICE },
    );
    appendFileSync(file, Buffer.from(b64, 'base64'));
  }
  await app.evaluate(() => (window.__zenRecBlob = null));
  return { file, ...info };
}
