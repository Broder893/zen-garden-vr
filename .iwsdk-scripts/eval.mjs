// Dev-only helper: evaluates the JavaScript expression in EVAL inside the app frame.
// Example: EVAL='__zen.guide.line' npx @iwsdk/cli browser run .iwsdk-scripts/eval.mjs
export default async function run({ page, frame }) {
  const target = frame ?? page;
  const value = await target.evaluate((src) => {
    // eslint-disable-next-line no-new-func
    const v = new Function(`return (${src});`)();
    return JSON.parse(JSON.stringify(v ?? null));
  }, process.env.EVAL ?? 'null');
  return { value };
}
