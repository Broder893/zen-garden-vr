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
- **A guide, not a manual.** A firefly flies to whatever matters next and says it in
  one short sentence, spoken and subtitled in English. It stays within your view and,
  once the tree blooms, follows your hand.
- **Come back.** The garden is saved on the device. Every return visit (after a few
  hours away) grows a new flower in the sand, up to seven.

## Hand interactions

| Gesture | What it does |
| --- | --- |
| Pinch near an object | Picks up the watering can or shears (large invisible grab zones, 6–10 cm) |
| Tilt the can spout-down | Pours water; it counts when the spout is over the tree |
| Touch a glowing shoot with the blades | Cuts it (within 7 cm) |
| Pinch the seed / the stone | Plants the seed / starts, pauses, resumes breathing |
| Open the hand | Releases a tool; it glides back to its place on the table |

Everything sits on a table within about 60 cm of a seated player. Controllers are
never required.

## How it is built

- [IWSDK](https://iwsdk.dev) (Immersive Web SDK) on WebXR and Three.js, TypeScript, Vite.
- **ECS systems**, one job each: watering, pruning, growth, guide, meditation, audio,
  saving, entrance, visit flowers (`src/*.ts`, registered in `src/index.ts`).
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

Address options for demos: `?fresh` starts a new garden, `?nextvisit` counts the
next VR entry as a return visit without waiting. Both are removed from the address
right after use.

## Credits

All models, sounds and code are original to this project. See [CREDITS.md](CREDITS.md).
