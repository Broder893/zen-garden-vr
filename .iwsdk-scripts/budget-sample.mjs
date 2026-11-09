// Dev-only: one performance sample of the running app (needs a DEV build: window.__zen).
// Per eye in XR: draw calls and triangles of the last frame; GPU texture memory (from
// .iwsdk-scripts/texture-meter.mjs when the page was loaded with ?texmeter, else from the
// visible materials only); the XR framebuffer.
// Used by scripts/check-budget.sh.
export default async function run({ page, frame }) {
  const target = frame ?? page;
  return target.evaluate(async () => {
    const r = window.__zenDev?.renderer;
    const zen = window.__zen;
    if (!r || !zen) return { error: 'not a dev build (window.__zen missing)' };
    // Let a few frames render in the current state.
    await new Promise((res) => setTimeout(res, 600));
    const info = r.info;
    const eyes = r.xr.isPresenting ? 2 : 1;
    const textures = new Set();
    const addFrom = (obj) => {
      if (!obj) return;
      for (const key in obj) {
        const v = obj[key];
        if (v && v.isTexture) textures.add(v);
      }
    };
    zen.guide.world.scene.traverseVisible((o) => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        if (m.visible === false) continue;
        addFrom(m);
        if (m.uniforms) for (const k in m.uniforms) addFrom({ v: m.uniforms[k]?.value });
      }
    });
    let bytes = 0;
    for (const t of textures) {
      const img = t.image ?? t.source?.data;
      const w = img?.width ?? img?.videoWidth ?? 0;
      const h = img?.height ?? img?.videoHeight ?? 0;
      const mip = t.generateMipmaps !== false && t.minFilter !== 1006 && t.minFilter !== 1003 ? 4 / 3 : 1;
      bytes += w * h * 4 * mip;
    }
    const meter = window.__zenTex;
    if (meter) bytes = meter.bytes();
    const layer = r.xr.getSession?.()?.renderState?.baseLayer;
    return {
      calls: Math.round(info.render.calls / eyes),
      triangles: Math.round(info.render.triangles / eyes),
      textures: meter ? meter.count() : textures.size,
      metered: !!meter,
      controllerMB: meter ? Math.round((meter.bigBytes() / 1048576) * 10) / 10 : 0,
      textureMB: Math.round((bytes / 1048576) * 10) / 10,
      gpuTextures: info.memory.textures,
      geometries: info.memory.geometries,
      programs: info.programs?.length ?? 0,
      framebuffer: layer ? [layer.framebufferWidth, layer.framebufferHeight] : null,
      quality: zen.perf.level,
      inVR: eyes === 2,
    };
  });
}
