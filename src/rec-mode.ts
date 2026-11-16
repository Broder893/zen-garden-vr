/**
 * Recording mode for the demo video, dev server only (`?rec`; never in the
 * published build: import.meta.env.DEV is false there, so all of this is
 * dropped). Each clip reloads the page, and the guide would greet and explain
 * again; with ?rec it remembers, in sessionStorage, the lines it already said
 * in earlier loads of the tab and neither shows nor speaks them again. It also
 * leaves out the resting line ("Rest, rake the sand...") and the break-length
 * panel, which shows only with `?rec=breakpanel`. The normal game is unchanged.
 */
const params = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);

/** True in recording mode (dev server only). */
export const REC = import.meta.env.DEV && !!params?.has('rec');
/** Recording mode that still asks for the break's length (the Comfort clip). */
export const REC_BREAK_PANEL = REC && params?.get('rec') === 'breakpanel';

const KEY = 'zen-rec-said';

function read(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

/** Lines said in earlier loads of this tab (fixed for this load). */
const before: ReadonlySet<string> = REC ? read() : new Set();
/** Every line said so far, this load included. */
const said = REC ? new Set(before) : new Set<string>();

/** True when `line` was already said in an earlier load: it stays silent and hidden. */
export function recAlreadySaid(line: string): boolean {
  return REC && before.has(line);
}

/** Notes that `line` was shown and spoken (saved for the next loads). */
export function recRemember(line: string): void {
  if (!REC || said.has(line)) return;
  said.add(line);
  try {
    sessionStorage.setItem(KEY, JSON.stringify([...said]));
  } catch {
    /* no storage: this load still remembers */
  }
}
