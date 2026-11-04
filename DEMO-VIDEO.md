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
| `05-breathe.webm` | Pinching the stone: a two-breath session with the light orb |
| `06-firefly-follows-hand.webm` | The firefly following the hand |
| `07-return-new-flower.webm` | Coming back: "A new flower grew while you were away" |

What is in the clips:
- the 3D view only, in 1920×1080, with **no emulator badges or panels**;
- the app's **music and sounds** (chimes, water, shears, singing bowls);
- the **English subtitles**, which are part of the scene.

What is not in them: the spoken voice. On a Mac it is Apple's system voice,
which is probably licensed for personal use only, so leaving it out of a public
video is the safe choice; the subtitles carry every line. If you want a voice,
record your own English narration over the video.

The recorder only exists in the dev server (`npm run dev`), not in the published app.

## 2. Edit (any free editor: CapCut, DaVinci Resolve, Clipchamp online)

YouTube accepts `.webm` directly; editors that refuse it can import a copy
converted by an online converter or by VLC (Media → Convert).

Suggested cut, about 2:50:

| Time | From | Add as text on screen |
| --- | --- | --- |
| 0:00–0:08 | start of `demo-main` (lights warming up) | *Zen Garden — a pocket garden for your work breaks* |
| 0:08–0:30 | planting | *Hands only. Pinch the glowing seed.* |
| 0:30–1:00 | first watering, growth | *Tilt to pour. The tree grows when it's cared for.* |
| 1:00–1:40 | pruning, watering, bloom (speed up 1.5–2× if long) | *Trim the wild shoots to shape your bonsai.* |
| 1:40–2:15 | breathing session | *When you need a pause, breathe with the light.* |
| 2:15–2:25 | firefly following the hand | |
| 2:25–2:40 | `demo-return` | *Come back tomorrow: your garden keeps growing.* |
| 2:40–2:50 | last frame held | *Hands only · Seated · 5–10 minutes · Built with IWSDK* + `broder893.github.io/zen-garden-vr` |

## 3. Publish

- YouTube: visibility **Public**, English title, e.g.
  *Zen Garden — hands-only VR bonsai & breathing (Meta VR Start 2026)*.
- In the description: the app link and the tagline.
- Paste the video link into `DEVPOST.md` and the Devpost form.

## If you get access to a Quest later

Recording on the headset (Meta button → Camera → Record video) shows real hands
and the headset's own voice. `QUEST-TEST.md` has the checklist for that session.
