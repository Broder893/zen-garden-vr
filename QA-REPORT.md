# Bloom Break: quality report

9 November 2026, on commit `1e32e8f` and later. No new features: checks, tests and
fixes only. Severity: **P0** blocks the experience or the submission, **P1** is
noticeable, **P2** is minor (listed, not fixed).

## Summary

| | P0 | P1 | P2 |
|---|---|---|---|
| Found | 0 | 1 | 15 |
| Fixed | 0 | 1 (`d2a44a0`, `7df2a09`) | listed only |

P1-1 is fixed in two parts: the failed start is retried once, and if it fails again
the card says so (decided on 9 November).

## Phase 1: automatic checks

| Check | Result |
|---|---|
| `npm run typecheck` | passes |
| `npm run build` | passes (one chunk over 500 kB: Vite's usual warning for IWSDK + Three) |
| `npm run check:budget` | within budget: 77-78 draw calls seated, 79 with the eyes closed, 42k triangles, 57 MB of textures (High and Medium) |
| `npm test` (new) | 31 tests pass: see below |
| Unused code (`tsc --noUnusedLocals --noUnusedParameters`) | one unused field: P2-1 |
| `console.log` left | none; the remaining `console.info` lines are dev-only or one line per quality change |
| Unhandled promises | network calls all end in `catch`/`finally`; `World.create(...).then(...)` has no `catch`: part of P1-1 |
| Listeners | every `addEventListener` in `src/` has its `removeEventListener` in the system's cleanup |
| Audio, voices, textures, geometry | nothing grows during play (see the 15-minute session); the decoded voices (about 13 MB) are kept on purpose; what is not freed only matters to hot reload in development: P2-2 |

### Unit tests (`npm test`, vitest)

Only pure modules, in `test/`; `@iwsdk/core` is replaced by a stand-in so no engine runs.

- **Saving** (`test/garden-save.test.ts`): a current save reads back as written; a
  version 1 save (before health) loads healthy with its experience, visits and
  flowers; health fields a version 1 save should not have are ignored; a save from
  before experience starts at its stage; experience never below the stage;
  out-of-range and wrong-typed values are clamped; broken JSON and unknown versions
  are refused; one flower per return visit, at most seven.
- **Levels** (`test/growth-levels.test.ts`): rising thresholds; each level exactly at
  its threshold; levels to stages; the tutorial path reaches sprout, young, mature and
  bloom as designed; unlocks at their level only; the daily gift's calendar day.
- **Breathing** (`test/breath-patterns.test.ts`): the pattern deepens with the tree;
  the unlocked deep breath alternates with the long one; the brief's rhythms (4-6,
  4-4-4-4, 3-5 breaths); the pace stretches every phase but never the breath count.
- **Seasons** (`test/seasons.test.ts`): the calendar month by month and at the
  boundaries; times of day at their hours; every colour for every season;
  `?season=`, `?time=`, `?weather=` read valid values and ignore others.
- **Change queue** (`test/change-queue.test.ts`): a season waits for closed eyes,
  then lands; it goes through after waiting long enough; a closure under way keeps it
  waiting; a stage change applies at once with open eyes but waits during a closure;
  kinds are kept apart; everything applies with the eyelids off. To test it, the
  queue's decision moved from `EyelidSystem` to `src/change-queue.ts` (same behaviour).

## Phase 2: play in the emulator

IWER (the WebXR emulator), Meta Quest 3 profile, scripted hands. Every run collected
the errors the app let escape (`.iwsdk-scripts/goto-watch.mjs`): **none in any run**.
(In development the console also shows refused connections to `localhost:8787`, the
shared-tree service when it is not running locally: P2-3.)

### Full path from an empty save (`?fresh`)

| Step | Result |
|---|---|
| Plant the seed | planted at **8.7 s** |
| Water | first growth at **21.8 s** |
| Trim and water | mature at **57.1 s** |
| First breath | at 129 s |
| Bloom | at **177 s**: every satisfying moment within 5 minutes |
| Too much water | "Too much water…", stressed then wilted, then "Your tree looks tense. Breathe with it at the stone." |
| Wrong cut (a healthy branch) | stump stays, stress +0.25, "That branch was healthy…" |
| Meditation at the stone | "Close your eyes…", lids closed through the breaths, "Open your eyes.", lids open, "Well done…" |
| Breathing break, declined with an open hand | invitation, then "Of course. We will breathe later."; counted as postponed |
| Pause and resume | losing focus pauses the session, opens the lids at once ("Paused…") and suspends the audio; pinching the stone resumes with the eyes closing again |
| Return (`?nextvisit`) | one more visit, a new flower grows, stumps and shoots back, soil dry; closed eyes on entering, then level-up, "welcome back", daily gift lines |

### Risky combinations

| Case | Result |
|---|---|
| Meditation started while holding a tool | starts; the eyes close with the can still in hand: P2-4 |
| A new stage during closed eyes | the tree bloomed unseen during a break, as designed |
| Rain plus a breathing break | fine; the rain ends while the eyes are closed (as designed); "A gentle rain…" is cut short by the invitation: P2-5 |
| Several events together (level, gift, flower, voice, subtitle) | each line shows about 3-4 s in turn, voice and subtitle together; the level-up comes before the gift that caused it: P2-6 |
| Hands lost and back | "I cannot see your hands…", gaze care on; then "There are your hands again." |
| Gaze care (no hands) | looking at the can waters the tree; it stops when full (no overwatering); "That is plenty of water…" appears though nothing was done wrong: P2-7 |
| Hold to select | the hold-to-select watering sequence runs without errors |
| One hand (left) | tools move to that side; the other hand can still pick up a tool, which the docs do not promise to prevent (by design) |
| High contrast | switched on and off by poking the Comfort panel; black and yellow controls (`artifacts/qa/qa-contrast.png`) |
| Gentle fades | fade mode instead of lids, about 4 s to dark |
| `?season=` × `?time=` (12 combinations, breeze at night) | right season and time, forest tinted, no errors or warnings |
| Stages 0 → bloom | no console errors at any step |

### 15-minute session

Night, rain, High quality, seated; a watering or a meditation every two minutes and
two breathing breaks on their own. One sample a minute:

| | Start | 15 min |
|---|---|---|
| Frame rate | 60 fps | 60 fps (the emulator's ceiling, all along) |
| JS memory | 217 MB | 192 MB (between 173 and 233, no upward trend; development build) |
| Geometries | 86 | 99 (new things seen for the first time: rain, the breathing light; flat from minute 7) |
| GPU textures | 12 | 13 (flat from minute 2) |
| Scene objects | 420 | 420 |
| Errors | 0 | 0 |

A Quest's frame rate cannot be measured here: see the short list in QUEST-TEST.md.

## Phase 3: robustness

| Case | Result |
|---|---|
| Storage refused (private mode), no speech (`?nostore`) | plays normally, nothing saved, no errors |
| Audio blocked (suspended, every resume refused) | plays in silence to the mature tree, no errors |
| Voice files missing (all `/voices/` fail) | every line read by the device voice, no errors |
| Voice files slow (4 s each) | the first line, after 2.5 s, goes to the device voice; then the recordings: P2-8 |
| Shared-tree service never answering | the request times out; the tree shows offline; no errors |
| Network gone during play | covered by the two cases above (voices and service are the only requests after the start) |
| **A 3D model failing to load** | **the garden never starts: P1-1** |
| Slow connection | development serves hundreds of modules, so it cannot stand in; the published first load is about 2.2 MB compressed (code 1.2 MB, models 1 MB), about 14 s on slow 4G, about 1 s on Wi-Fi: P2-9 |
| Tab in the background, then back | Chromium does not freeze a visible XR page, so this was simulated: one 60-second frame through the world mid-meditation skips one breathing phase, no invalid values, no errors; on a Quest the session pauses anyway when the headset is off: P2-10 |

### Shared-tree service (Cloudflare Worker, `server/shared-tree/`)

Reviewed in code; the deployed service and GitHub Pages could not be reached from this
computer (their names do not resolve here), so nothing was sent to them.

- **Input validation:** body at most 512 characters, valid JSON object, `garden` a
  version 4 UUID, `count` an integer 1-5; anything else gets a 400.
- **Rate limits:** 12 care requests a minute per connection (Cloudflare's in-memory
  limiter), 40 cares a day per garden, 20,000 a day in all. Reading the tree (GET)
  has no limit: P2-11.
- **No personal data:** no names, no chat; the IP is used only by the limiter, in
  memory; `garden` is a random id made by the app.
- **CORS:** only the published site, localhost and 192.168.x.x; other origins get no
  `Access-Control-Allow-Origin`. The LAN origins stay allowed in production: P2-12.
- The body is read in full before its size is checked: P2-13.

## Problems

### P1-1: a model that fails to load leaves a dead page

- **Seen:** with any of the six models failing (`/models/*.glb`), the engine's start
  is rejected (`AssetLoadError`, unhandled). The page stays on its information card:
  no Enter VR button, no message, nothing to try. One dropped request on a weak
  connection is enough.
- **Why:** the models are loaded as critical assets before the world starts, and
  `World.create(...)` in `src/index.ts` has no `catch`. (The Blender bonsai's own
  fallback to the procedural tree never runs in this case.)
- **Fix:** the start is retried once, and a second failure shows a line on the card
  (see Fixes).

### P2 (listed; 4, 7, 8, 9, 10 fixed later on request)

1. `SharedTreeSystem.shown` (`src/shared-tree.ts`) is written but never read.
2. Hot reload only: `GuideVoice.dispose()` keeps the decoded voices; the sound
   engine's audio nodes are never disconnected; geometry and materials made in
   `init()` are not disposed. A Quest never hot-reloads.
3. In development, with no local shared-tree service, the console fills with refused
   connections to `localhost:8787` (`.env.development.local`). Not in the published app.
4. A meditation can start while a tool is held; the eyes close with it in hand.
   Breathing breaks already wait for empty hands; the stone is the player's own pinch.
5. A one-off line can be cut short by a more important one ("A gentle rain…" by the
   break invitation after about 3 s).
6. On a return that levels up, the level line comes before "A daily gift…", which
   is what caused it.
7. With gaze care or hold to select, the can stops by itself when the tree is full,
   yet "That is plenty of water. Let it rest a moment." appears.
    **Fixed:** a hands-free can (gaze care, hold to select) stops filling at full and never counts as too much water (`src/watering.ts`); pouring by hand past full still warns. Emulator: gaze and hold to select, no line and overwater 0; by hand, the line and overwater 0.55. Budget 78-79.
8. A slow voice file: its line is read by the device voice, the next ones by the
   recording, so one line can come in a different voice.
    **Fixed:** a line waits up to 8 s (was 2.5) for its own recording, which is fetched at once instead of queuing behind the others (`src/audio/voice.ts`, `src/audio/voice-clips.ts`); the device voice is left for a missing file or one still not there after 8 s. Emulator, every voice request 2.5 s slow: the first line is the recording, after 5 s (before: the device voice). Only past about 4 s per request (8 s in all) does the device voice step in. Budget 77-79.
9. First load about 2.2 MB compressed: about 14 s on slow 4G, with the card shown and
   no progress indicator.
    **Fixed:** the card shows "Loading your garden…" from the first moment, then the share of the garden's files loaded (models, sounds: the engine's LoadingManager), and hides it when the garden runs, or for the error line (`index.html`, `src/loading-line.ts`; commit 241a251). Emulator, files slowed: 0% → 8% … 99% over 2 s, then hidden; a failed start, hidden with the error line shown. The code download comes before the percentage can show: the line stays without a number until then. Budget 78-79.
10. The frame time is not capped: after a long pause the first frame can be minutes
    long. Nothing broke when tested; capping it (about 0.1 s) would be safer.
11. The service's GET is not rate-limited (cost only; the data is public counts).
12. The service allows 192.168.x.x origins in production (for testing on a headset).
13. The service reads the whole body before checking its size (Workers cap bodies anyway).
14. `?fresh`, `?nextvisit` and `?debug` work in the published app too (for demos);
    harmless, but a link with `?fresh` resets the visitor's own garden.
15. The emulator cannot hold the headset "off": pause and resume were checked through
    the app's own visibility signal for one frame. Worth trying on a Quest.

## Fixes

One commit per problem, each after typecheck, build, `npm test` and check:budget.

| Problem | Commit | Fix | Checked |
|---|---|---|---|
| P1-1 | `d2a44a0` | `src/index.ts` catches the failed start, logs it and reloads once, 1.5 s later; the retry time is kept for the tab, so a start that keeps failing is retried at most once every 10 minutes (no loop). No change to the look or the texts. | emulator: one failed model, the second load starts the garden (3 s); a model that always fails, two loads and then it stops; a new failure within 10 minutes, no retry. Budget 77-79, within. |
| P1-1, message | `7df2a09` | a hidden line on the card (`#load-error`), shown when the start fails with no retry left (or the retry cannot be tracked). | emulator: a model that always fails, two loads then the line; one failure, no line; a normal load, no line. Budget 77-79, within. |

Other commits of this check: `e0e9896` (unit tests, the change queue moved to a pure
module), `f488b06` (QA helpers `goto-watch.mjs` and `net.mjs`).

## Decision: a message when the garden cannot start

Decided: a line on the card, shown only when the start fails again after its retry:
"The garden could not load. Check the connection and reload the page." (`index.html`,
`src/index.ts`; `artifacts/qa/load-error.png`).

## Not verified here

- A real Quest: hands, frame rate, voice and comfort (see the short list in
  `QUEST-TEST.md`).
- The deployed shared-tree service and GitHub Pages (not reachable from this computer).
