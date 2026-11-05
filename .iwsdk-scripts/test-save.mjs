// Save-format test, run in the dev app: npx @iwsdk/cli browser run .iwsdk-scripts/test-save.mjs
// Imports the real src/save/garden-save.ts through Vite and checks parseSave.
export default async function run({ page, frame }) {
  const target = frame ?? page;
  return target.evaluate(async () => {
    const { parseSave } = await import('/src/save/garden-save.ts');
    const results = [];
    const check = (name, ok, got) => results.push({ name, ok: !!ok, got: ok ? undefined : got });
    // Version 1 (before health): loads healthy, nothing lost.
    const v1 = JSON.stringify({ v: 1, planted: true, stage: 2, water: 0.5, prunedMask: 1, visits: 4, meditations: 2,
      breaks: 1, xp: 47, lastGiftDay: 20261104, lastVisitAt: 1, savedAt: 2 });
    const a = parseSave(v1);
    check('v1 loads', a !== null, a);
    check('v1 keeps progress', a && a.stage === 2 && a.xp === 47 && a.visits === 4 && a.meditations === 2 && a.breaks === 1, a);
    check('v1 is healthy', a && a.stress === 0 && a.overwater === 0 && a.stumpMask === 0, a);
    // Version 1 from before experience: xp from its stage and in-stage care.
    const old = parseSave(JSON.stringify({ v: 1, planted: true, stage: 1, water: 1, prunedMask: 1, visits: 1 }));
    check('v1 without xp migrates', old && old.xp === 15 + 5 + 10, old);
    // Version 2 keeps health, clamped.
    const b = parseSave(JSON.stringify({ ...JSON.parse(v1), v: 2, stress: 0.8, overwater: 7, stumpMask: 3 }));
    check('v2 keeps health', b && b.stress === 0.8 && b.overwater === 1 && b.stumpMask === 3, b);
    check('unknown version rejected', parseSave(JSON.stringify({ v: 3, planted: true })) === null);
    check('garbage rejected', parseSave('{oops') === null);
    check('bad values clamped', (() => { const c = parseSave(JSON.stringify({ v: 2, planted: true, stage: 99, stress: -4 })); return c && c.stage === 3 && c.stress === 0; })());
    return { passed: results.filter((r) => r.ok).length, total: results.length, failed: results.filter((r) => !r.ok) };
  });
}
