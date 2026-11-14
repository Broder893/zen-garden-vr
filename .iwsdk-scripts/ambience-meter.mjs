// Dev-only: how loud the seasonal ambience is next to the music and the voice, and the
// frame times meanwhile. Listens for AMB_SECONDS (default 8) with analysers on the
// music bus, the ambience bus and the voice bus (RMS and peak, dBFS), and times every
// XR frame (mean and worst, ms).
//   AMB_SECONDS=10 npx @iwsdk/cli browser run .iwsdk-scripts/ambience-meter.mjs
export default async function run({ page, frame }) {
  const target = frame ?? page;
  return target.evaluate(async (seconds) => {
    const dev = window.__zenDev;
    const ctx = dev?.ctx;
    if (!ctx || !dev.engine) return { error: 'needs a dev build with audio' };
    const taps = { music: dev.engine.music, ambience: dev.ambience?.bus, voice: dev.engine.voice };
    const meters = {};
    for (const [name, node] of Object.entries(taps)) {
      if (!node) continue;
      const a = ctx.createAnalyser();
      a.fftSize = 2048;
      node.connect(a);
      meters[name] = { a, buf: new Float32Array(a.fftSize), sum: 0, n: 0, peak: 0 };
    }
    const session = dev.renderer.xr.getSession();
    const raf = (cb) => (session ? session.requestAnimationFrame(cb) : requestAnimationFrame(cb));
    const frames = [];
    let last = 0;
    const end = performance.now() + seconds * 1000;
    await new Promise((resolve) => {
      const tick = (now) => {
        if (last) frames.push(now - last);
        last = now;
        for (const m of Object.values(meters)) {
          m.a.getFloatTimeDomainData(m.buf);
          for (const v of m.buf) {
            m.sum += v * v;
            m.n++;
            if (Math.abs(v) > m.peak) m.peak = Math.abs(v);
          }
        }
        if (performance.now() < end) raf(tick);
        else resolve();
      };
      raf(tick);
    });
    const db = (x) => (x > 0 ? Math.round(20 * Math.log10(x) * 10) / 10 : -Infinity);
    const out = { state: ctx.state, busGain: dev.ambience?.bus?.gain.value, speaking: dev.voice.speaking };
    for (const [name, m] of Object.entries(meters)) {
      taps[name].disconnect(m.a);
      out[name] = { rmsDb: db(Math.sqrt(m.sum / Math.max(1, m.n))), peakDb: db(m.peak) };
    }
    frames.sort((a, b) => a - b);
    const mean = frames.reduce((s, f) => s + f, 0) / Math.max(1, frames.length);
    out.frames = { count: frames.length, meanMs: Math.round(mean * 100) / 100, worstMs: Math.round(frames[frames.length - 1] * 100) / 100, p99Ms: Math.round(frames[Math.floor(frames.length * 0.99)] * 100) / 100 };
    return out;
  }, Number(process.env.AMB_SECONDS ?? 8));
}
