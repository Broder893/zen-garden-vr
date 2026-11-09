# Demo video plan (under 3 minutes)

Devpost asks for a public YouTube or Vimeo video, under 3 minutes, in English,
showing the real experience (not AI-generated). The project brief allows it to
be recorded in a simulator: the clips below are the real app, running in IWER
(IWSDK's WebXR emulator) with scripted hands.

## 1. Record the clips (automatic)

```sh
npx @iwsdk/cli dev restart --allow-browser-automation
npm run demo:record
```

The script (`scripts/record-demo.sh`) plays the experience by itself (about
5 minutes) and records one clip per scene into `artifacts/`:

| Clip | Content |
| --- | --- |
| `01-arrive-and-plant.webm` | Entering VR: lights warm up, firefly arrives, the seed is pinched |
| `02-water-and-grow.webm` | Lifting the can, pouring, the sprout grows |
| `03-prune-and-grow.webm` | Shears trim the glowing shoots, watering, the tree grows again |
| `04-prune-and-bloom.webm` | Last pruning and watering: the tree blooms |
| `05-breathe.webm` | Pinching the stone: "Close your eyes", the eyelids close, a two-breath session with the light orb, "Open your eyes" |
| `06-firefly-follows-hand.webm` | The firefly following the hand |
| `07-return-new-flower.webm` | Coming back: "A new flower grew while you were away" |
| `08-comfort-hold-to-select.webm` | Comfort panel: high contrast and hold to select, then the can picked up and pouring with no pinch |
| `09-breathing-break.webm` | A breathing break: the firefly's invitation, the eyelids closing, the light and the breath card through them, the eyes opening onto the reward |

To record only the last clip again: `npm run demo:record -- comfort`.

Record the clips again after the Blender bonsai (9 November): the pruning clips (03, 04)
follow its new cut points; older recordings show the earlier procedural tree.

What is in the clips:
- the 3D view only, in 1920×1080, with **no emulator badges or panels**;
- the app's **music and sounds** (chimes, water, shears, singing bowls);
- the guide's **voice**: recorded lines generated with Kokoro TTS (Apache 2.0, see
  `CREDITS.md`), so they are fine in a public video;
- the **English subtitles**, which are part of the scene.

Clips recorded before 9 November have no voice (the guide used the device's speech
then, which the recorder cannot capture): record them again to have it.

The recorder only exists in the dev server (`npm run dev`), not in the published app.

## 2. Edit (any free editor: CapCut, DaVinci Resolve, Clipchamp online)

YouTube accepts `.webm` directly; editors that refuse it can import a copy
converted by an online converter or by VLC (Media → Convert).

Suggested cut, about 2:50:

| Time | From | Add as text on screen |
| --- | --- | --- |
| (montage, optional) | the same garden by day, sunset and night (`?time=`), autumn leaves, the snowy tree (`?season=winter`), a shower (`?weather=rain`) | *A garden that follows your day and the seasons.* |
| (opening, optional) | look around the garden at sunset, then fingertips raking the sand | *A breathing break with a bonsai* |
| 0:00–0:08 | start of `demo-main` (lights warming up) | *Bloom Break — a breathing break with a bonsai* |
| 0:08–0:30 | planting (keep the ghost pinch next to the seed in frame) | *Hands only. The firefly shows the gesture in light.* |
| 0:30–1:00 | first watering, growth | *Tilt to pour. The tree grows when it's cared for.* |
| 1:00–1:40 | pruning, watering, bloom (speed up 1.5–2× if long) | *Trim the wild shoots to shape your bonsai.* |
| 1:40–2:05 | `09-breathing-break` (the invitation, then one or two breaths in front of the eyes) | *Every few minutes, the firefly offers a short break. Close your eyes, breathe; the garden changes while they are closed.* |
| (short, optional) | a wilted tree (overwater or a wrong cut) recovering during a breathing break | *Mistakes show, but the tree never dies. Breathing with it brings it back.* |
| 2:05–2:25 | `08-comfort-hold-to-select` (speed up the pokes, keep the can pouring by itself) | *No pinch? Hold to select. Also: one hand, high contrast, large text, breathing pace.* |
| 2:25–2:40 | `07-return-new-flower`: the new flower, the daily gift, the level badge (the firefly-follows-hand clip 06 is a spare) | *Come back tomorrow: care earns levels. A glazed pot, a lantern, a stream...* |
| (short) | `npm run demo:record`-style: pour into the stone basin, the light flies to the shared tree, the sign counts up | *One tree, shared by everyone who visits.* |
| 2:40–2:50 | last frame held | *Hands only · Seated · 5–10 minutes · Built with IWSDK* + `broder893.github.io/zen-garden-vr` |

## 3. Publish

- YouTube: visibility **Public**, English title, e.g.
  *Bloom Break — hands-only VR bonsai & breathing (Meta VR Start 2026)*.
- In the description: the app link and the tagline.
- Paste the video link into `DEVPOST.md` and the Devpost form.

## If you get access to a Quest later

Recording on the headset (Meta button → Camera → Record video) shows real hands. `QUEST-TEST.md` has the checklist for that session.
