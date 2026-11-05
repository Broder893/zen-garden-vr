# Zen Garden

A pocket zen garden for your work breaks: grow a bonsai with your bare hands,
breathe with a firefly, and come back to watch it bloom.

**Try it on Meta Quest:** open **https://broder893.github.io/zen-garden-vr/** in the
Quest Browser and press **Enter VR**. Hands only, seated, 5 to 10 minutes, sound on.

Made for the Meta VR Start Developer Competition 2026 (Productivity, New Experience).

## The experience

- **Plant and grow.** Pinch the glowing seed, water the sprout by tilting the can over
  it, and trim the glowing overgrown shoots with the shears. The bonsai grows through
  four stages (sprout, young, mature, in bloom).
- **Breathe.** Pinch the meditation stone for a guided breathing session of about
  80 seconds: an orb of light grows as you breathe in and shrinks as you breathe out.
  Pinch again to pause.
- **Breathing breaks.** Every two to four minutes of care, the firefly invites a short
  pause (never while a tool is in hand, never twice without care in between). Hold up an
  open hand, palm out, to skip it. Otherwise the garden dims and a light in front of you
  breathes with you, with a card naming each step and counting 3-4 breaths; the tree
  gets water as a reward. The rhythm follows the tree: simple (4 in, 6 out), box
  (4-4-4-4) or long and slow (5-2-8).
- **A guide, not a manual.** A firefly flies to whatever matters next and says it in
  one short sentence, spoken and subtitled in English. A ghost gesture drawn in light
  shows the motion (a pinch, a tilt); a clearer line follows if you seem stuck, and the
  firefly welcomes you back after a pause. It stays within your view and, once the tree
  blooms, follows your hand.
- **Comfort settings.** A small panel by the front-left corner of the table (poke, point
  or click "Comfort"): breathing pace (slow, medium, fast), high contrast, large text, one
  hand (left or right: both tools move to that side) and **hold to select**, which
  replaces every pinch with a hand held still beside the object (or a steady look at the
  seed or stone). Settings are saved separately from the garden.
- **A zen garden around you.** The table stands in a raked sand garden at sunset, with
  mossy rocks, a bamboo fence and a stone lantern. The table's own sand starts raked in
  lines and rings; **touch it with your fingertips and drag** to draw grooves (three
  fingers make a little rake). Your patterns are saved for the next visit.
- **Come back and level up.** Care earns experience (plant 5, full watering 10, each
  trimmed shoot 5, a breathing session 15, a breathing break 10, a daily gift 20). Levels
  1-5 are the tree's stages; then come a glazed pot (6), a stone lantern (7), a stream
  in the sand (8) and a deep 4-7-8 breath for the breaks (9). A badge by the table's
  front corner shows the level and progress. The garden is saved on the device; each
  return visit (after a few hours) the soil dries and shoots grow back, the first visit
  of the day brings a gift, and a new flower grows in the sand, up to seven.

## Hand interactions

| Gesture | What it does |
| --- | --- |
| Pinch near an object | Picks up the watering can or shears (large invisible grab zones, 6–10 cm) |
| Tilt the can spout-down | Pours water; it counts when the spout is over the tree |
| Touch a glowing shoot with the blades | Cuts it (within 7 cm) |
| Pinch the seed / the stone | Plants the seed / starts, pauses, resumes breathing |
| Open the hand | Releases a tool; it glides back to its place on the table |
| Poke a button | Changes a Comfort setting |
| Open hand up, palm out | Skips a breathing break ("not now") |
| Fingertips on the sand | Rake grooves into the table's sand |

With **hold to select** on: keep a hand still by an object for 1.2 s (a ring of light
fills) to plant, pick up or start breathing; look at the seed or stone for 2 s for the
same; hold the can over the tree and it pours by itself; lower your hand to the table
to put a tool down.

Everything sits on a table within about 60 cm of a seated player. Controllers are
never required.

## How it is built

- [IWSDK](https://iwsdk.dev) (Immersive Web SDK) on WebXR and Three.js, TypeScript, Vite.
- **ECS systems**, one job each: watering, pruning, growth, guide, meditation, audio,
  saving, entrance, visit flowers, comfort settings, hold-to-select, breathing breaks,
  levels and unlocks, the sand rake (`src/*.ts`,
  registered in `src/index.ts`).
- **Procedural models** (`src/scene-assets/`), composed in
  `public/scenes/main.iwsdk.scene.json`. The bonsai merges its parts per material: the
  scene is about 80 draw calls and 14k triangles.
- **Audio synthesised live** with the Web Audio API (`src/audio/`): generative music,
  water, shears, chimes, singing bowls. No audio files ship with the app.
- **Voice** through the device's speech synthesis (Web Speech API); every line is also
  a subtitle (`public/ui/subtitle.uikitml`).
- **Saving** to `localStorage` with validation and error handling (`src/save/`).

Developed without a headset, in IWER (IWSDK's WebXR emulator), with scripted hands.

## Run it locally

Requires Node.js 20.19+ (or 22.12+).

```sh
npm install
npm run dev        # managed dev server + browser with the XR emulator
npm run typecheck
npm run build      # production build in dist/
```

Every push to `main` is built and published to GitHub Pages by
`.github/workflows/deploy.yml`.

In development, `FirstMomentsSystem` logs the seconds from entering VR to each reward
(`[first-moments] planted at 10.2 s`). A scripted first visit: planted 10 s, first
growth 21 s, mature 49 s, bloom 76 s; a first-time player takes longer, but the
first reward (the sprout) still comes within the first minute.

Address options for demos: `?fresh` starts a new garden, `?nextvisit` counts the
next VR entry as a return visit without waiting. Both are removed from the address
right after use.

## Credits

All models, sounds and code are original to this project. See [CREDITS.md](CREDITS.md).
