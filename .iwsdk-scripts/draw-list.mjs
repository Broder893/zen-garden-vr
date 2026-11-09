// Dev-only: which objects make up the draw calls of one XR frame (per eye), by name
// and material. Pairs with budget-sample.mjs when a draw-call count needs explaining.
//   npx @iwsdk/cli browser run .iwsdk-scripts/draw-list.mjs
export default async function run({ page, frame }) {
  const target = frame ?? page;
  return target.evaluate(
    () =>
      new Promise((resolve) => {
        const r = window.__zenDev?.renderer;
        const session = r?.xr.getSession();
        if (!r || !session) return resolve({ error: 'needs a dev build in XR' });
        const orig = r.renderBufferDirect;
        const draws = [];
        // Wait one frame so the hook covers a whole render, then restore it the frame after.
        session.requestAnimationFrame(() => {
          r.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
            // The nearest named ancestor: UIKit panels and text meshes are unnamed.
            let o = object;
            const path = [];
            while (o && path.length < 3) {
              if (o.name) path.push(o.name);
              o = o.parent;
            }
            const owner = path.join(' < ') || object.type;
            draws.push(`${owner} | ${material.name || material.type}`);
            return orig.call(this, camera, scene, geometry, material, object, group);
          };
          session.requestAnimationFrame(() => {
            r.renderBufferDirect = orig;
            const counts = {};
            for (const d of draws) counts[d] = (counts[d] ?? 0) + 1;
            const eyes = r.xr.isPresenting ? 2 : 1;
            resolve({
              perEye: draws.length / eyes,
              infoPerEye: r.info.render.calls / eyes,
              items: Object.entries(counts)
                .map(([k, v]) => [k, v / eyes])
                .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)),
            });
          });
        });
      }),
  );
}
