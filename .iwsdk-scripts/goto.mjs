// Dev-only helper: navigate the managed app frame to a query string given in GOTO_QS.
export default async function run({ page, frame }) {
  const target = frame ?? page;
  const url = new URL(target.url());
  url.search = process.env.GOTO_QS ?? '';
  await target.goto(url.toString());
  return { url: target.url() };
}
