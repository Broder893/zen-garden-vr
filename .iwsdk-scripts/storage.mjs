// Dev-only helper: print the saved garden from localStorage.
export default async function run({ page, frame }) {
  const target = frame ?? page;
  return { save: await target.evaluate(() => localStorage.getItem('zen-garden-vr/save')), url: target.url() };
}
