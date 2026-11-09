// Dev-only test helper: navigates the app to GOTO_QS (which must contain "texmeter")
// with a meter on WebGL texture uploads, so scripts/check-budget.sh can report the
// real GPU texture memory (font atlases, environment maps and render targets included).
// window.__zenTex.bytes() = estimated bytes of all live textures (mipmaps included).
// The init script lives only as long as this script's browser connection, so the
// navigation happens here, in the same run.
export default async function run({ page, frame }) {
  await page.addInitScript(() => {
    if (!new URLSearchParams(location.search).has('texmeter') || window.__zenTex) return;
    const BPP = {
      0x8058: 4, 0x8c43: 4, 0x1908: 4, 0x8051: 4, 0x1907: 4, 0x881a: 8, 0x8814: 16, 0x8815: 16,
      0x881b: 8, 0x8229: 1, 0x822b: 2, 0x1903: 1, 0x822d: 2, 0x822e: 4, 0x8230: 8, 0x88f0: 4,
      0x81a6: 3, 0x8cac: 4, 0x1902: 4, 0x8d48: 1,
    };
    const sizes = new Map(); // WebGLTexture -> { base, mips }
    const bound = new Map(); // gl -> Map(target -> texture)
    const current = (gl, target) => {
      const t = target >= 0x8515 && target <= 0x851a ? 0x8513 : target; // cube faces -> cube map
      return bound.get(gl)?.get(t);
    };
    const add = (tex, bytes, level) => {
      if (!tex) return;
      const s = sizes.get(tex) ?? { base: 0, mips: false };
      if (level === 0) s.base += bytes;
      sizes.set(tex, s);
    };
    for (const Ctx of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
      if (!Ctx) continue;
      const p = Ctx.prototype;
      const bind = p.bindTexture;
      p.bindTexture = function (target, tex) {
        let m = bound.get(this);
        if (!m) bound.set(this, (m = new Map()));
        m.set(target, tex);
        return bind.call(this, target, tex);
      };
      const del = p.deleteTexture;
      p.deleteTexture = function (tex) {
        sizes.delete(tex);
        return del.call(this, tex);
      };
      const image = p.texImage2D;
      p.texImage2D = function (target, level, internal, ...rest) {
        let w = 0;
        let h = 0;
        if (typeof rest[0] === 'number') [w, h] = rest;
        else {
          const src = rest[rest.length - 1];
          w = src?.width ?? src?.videoWidth ?? 0;
          h = src?.height ?? src?.videoHeight ?? 0;
        }
        const tex = current(this, target);
        if (level === 0 && tex) {
          // A re-upload of the same face replaces it: count each face once.
          const key = `${target}`;
          tex.__faces ??= {};
          const prev = tex.__faces[key] ?? 0;
          const bytes = w * h * (BPP[internal] ?? 4);
          tex.__faces[key] = bytes;
          add(tex, bytes - prev, 0);
          sizes.get(tex).desc = `image ${w}x${h} fmt ${internal.toString(16)} target ${target.toString(16)}`;
          sizes.get(tex).px = w * h;
        }
        return image.call(this, target, level, internal, ...rest);
      };
      if (p.texStorage2D) {
        const storage = p.texStorage2D;
        p.texStorage2D = function (target, levels, internal, w, h) {
          const faces = target === 0x8513 ? 6 : 1;
          const tex = current(this, target);
          if (tex) sizes.set(tex, { base: w * h * (BPP[internal] ?? 4) * faces, px: w * h, mips: levels > 1, desc: `storage ${w}x${h}x${faces} fmt ${internal.toString(16)} levels ${levels}` });
          return storage.call(this, target, levels, internal, w, h);
        };
      }
      if (p.texStorage3D) {
        const storage3 = p.texStorage3D;
        p.texStorage3D = function (target, levels, internal, w, h, d) {
          const tex = current(this, target);
          if (tex) sizes.set(tex, { base: w * h * d * (BPP[internal] ?? 4), mips: levels > 1 });
          return storage3.call(this, target, levels, internal, w, h, d);
        };
      }
      const mip = p.generateMipmap;
      p.generateMipmap = function (target) {
        const tex = current(this, target);
        const s = tex && sizes.get(tex);
        if (s) s.mips = true;
        return mip.call(this, target);
      };
    }
    window.__zenTex = {
      count: () => sizes.size,
      list: () => [...sizes.values()].map((s) => `${Math.round((s.base * (s.mips ? 4 / 3 : 1)) / 10485.76) / 100} MB ${s.desc ?? ''}${s.mips ? ' +mips' : ''}`).sort((a, b) => parseFloat(b) - parseFloat(a)),
      /**
       * Bytes of 2048-pixel (or larger) textures: in this app only the emulator's
       * controller models (the garden's own textures are 512 px or less).
       */
      bigBytes: () => {
        let total = 0;
        for (const s of sizes.values()) if ((s.px ?? 0) >= 2048 * 2048) total += s.base * (s.mips ? 4 / 3 : 1);
        return total;
      },
      bytes: () => {
        let total = 0;
        for (const s of sizes.values()) total += s.base * (s.mips ? 4 / 3 : 1);
        return total;
      },
    };
  });
  const target = frame ?? page;
  const url = new URL(target.url());
  url.search = process.env.GOTO_QS ?? '?texmeter';
  await target.goto(url.toString());
  const installed = await target.evaluate(() => typeof window.__zenTex === 'object');
  return { installed, url: target.url() };
}
