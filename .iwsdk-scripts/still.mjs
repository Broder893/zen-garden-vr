// Dev-only full-size still (Devpost images): renders the left eye's view of the running
// XR frame again, offscreen, at STILL_SIZE (default 1800x1200), with the same vertical
// field of view, tone mapping and colour space as the headset view (checked against
// snap.mjs: same colours). The emulator's own
// canvas (snap.mjs) is only as big as the window; this is not. Rendered at twice the size
// and scaled down (smooth edges: the headset target takes no MSAA here). 3D only: no DOM overlays.
//   STILL_NAME=a STILL_DIR=artifacts/devpost npx @iwsdk/cli browser run .iwsdk-scripts/still.mjs
// STILL_FOV (optional): vertical field of view in degrees from the same eye (default: the
// eye's own, about 90 in the emulator; a narrower one bends the edges less in a photo).
// STILL_WHEN (optional): a JS expression; the still is taken in the first frame where it
// is true (checked every frame, up to STILL_TIMEOUT seconds, default 60).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export default async function run({ frame, page, workspaceRoot }) {
  const app = frame ?? page;
  const [w, h] = (process.env.STILL_SIZE ?? '1800x1200').split('x').map(Number);
  const data = await app.evaluate(
    async ({ w, h, when, timeout, fovWanted }) => {
      const r = window.__zenDev?.renderer;
      const scene = window.__zen?.guide?.world?.scene;
      const session = r?.xr.getSession();
      if (!r || !scene || !session) throw new Error('needs a dev build in XR');
      // The app's own Three (the same pre-bundled module, so the same classes).
      const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/deps\/three\.js\?v=/.test(n));
      if (!url) throw new Error('three module not found');
      const THREE = await import(url);
      // eslint-disable-next-line no-new-func
      const SS = 2;
      const ready = when ? new Function(`return (${when});`) : () => true;
      const start = performance.now();
      return await new Promise((resolve, reject) => {
        const tick = () => {
          if (performance.now() - start > timeout * 1000) return reject(new Error(`STILL_WHEN never true: ${when}`));
          if (!ready()) return session.requestAnimationFrame(tick);
          // Right after this frame's render: the eye cameras hold this frame's pose.
          queueMicrotask(() => {
            const eye = r.xr.getCamera().cameras[0];
            const fov = fovWanted || (2 * Math.atan(1 / eye.projectionMatrix.elements[5]) * 180) / Math.PI;
            const cam = new THREE.PerspectiveCamera(fov, w / h, eye.near || 0.01, eye.far || 1000);
            const W = w * SS;
            const H = h * SS;
            eye.matrixWorld.decompose(cam.position, cam.quaternion, cam.scale);
            cam.updateMatrixWorld(true);
            // Treated as the headset's target: the renderer's tone mapping and sRGB encoding
            // run in the shaders, and transparent layers blend on encoded colours, as in the
            // headset's framebuffer. Float storage, so the hardware adds no second encoding.
            const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType });
            rt.texture.colorSpace = THREE.SRGBColorSpace;
            rt.isXRRenderTarget = true;
            const before = r.getRenderTarget();
            r.xr.enabled = false;
            try {
              r.setRenderTarget(rt);
              r.clear();
              r.render(scene, cam);
              const enc = new Float32Array(W * H * 4);
              r.readRenderTargetPixels(rt, 0, 0, W, H, enc);
              const px = new Uint8ClampedArray(W * H * 4);
              for (let i = 0; i < enc.length; i += 4) {
                px[i] = enc[i] * 255 + 0.5;
                px[i + 1] = enc[i + 1] * 255 + 0.5;
                px[i + 2] = enc[i + 2] * 255 + 0.5;
                px[i + 3] = 255;
              }
              const big = document.createElement('canvas');
              big.width = W;
              big.height = H;
              const img = big.getContext('2d').createImageData(W, H);
              // WebGL rows run bottom-up.
              for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
              big.getContext('2d').putImageData(img, 0, 0);
              const out = document.createElement('canvas');
              out.width = w;
              out.height = h;
              const g = out.getContext('2d');
              g.imageSmoothingQuality = 'high';
              g.drawImage(big, 0, 0, w, h);
              resolve({ url: out.toDataURL('image/png'), fov });
            } catch (e) {
              reject(e);
            } finally {
              r.setRenderTarget(before);
              r.xr.enabled = true;
              rt.dispose();
            }
          });
        };
        session.requestAnimationFrame(tick);
      });
    },
    { w, h, when: process.env.STILL_WHEN ?? '', timeout: Number(process.env.STILL_TIMEOUT ?? 60), fovWanted: Number(process.env.STILL_FOV ?? 0) },
  );
  const dir = join(workspaceRoot, process.env.STILL_DIR ?? 'artifacts');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${process.env.STILL_NAME ?? 'still'}.png`);
  writeFileSync(file, Buffer.from(data.url.split(',')[1], 'base64'));
  return { file, size: [w, h], fov: data.fov };
}
