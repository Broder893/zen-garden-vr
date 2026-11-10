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

### Rules for this video
- **No voice-over of your own.** The app's music, sounds and recorded guide voice carry
  the video; the captions below explain. It keeps the pace calm and the English simple.
- **Hook in the first 5 seconds**: dark, then the eyelids open onto the garden. No logos
  or long titles first.
- Captions: white, large, at most 8 words each, on screen for 2.5-3.5 seconds.
- Keep it **2:30-2:50**. Judges see many videos: cut anything slow (speed up growth 2×).
- Only real footage of the app. Do not add AI-generated clips or images.

### Shot list and captions (about 2:45)

| Time | Shot (clip / how to get it) | Caption |
| --- | --- | --- |
| 0:00–0:06 | Black, then the eyelids open on the sunset garden (`?time=sunset`, start of `01-arrive-and-plant`) | *Bloom Break* |
| 0:06–0:25 | The firefly flies to the seed; the ghost pinch; the seed is planted (`01`) | *Hands only. No controllers.* / *The firefly shows each gesture in light.* |
| 0:25–0:55 | Water, sprout, trim the glowing shoots, bloom (`02`, `03`, `04`; speed 2×) | *Tilt to pour. Trim to shape.* / *Your bonsai grows with your care.* |
| 0:55–1:25 | Breathing break: the invitation, eyelids close, the light orb, "Open your eyes", something has changed (`09`) | *Every few minutes, a short break.* / *Close your eyes. Breathe.* / *The garden changes while you rest.* |
| 1:25–1:45 | Four quick shots, 3 s each, of the same bonsai and forest: `?season=spring`, `summer`, `autumn`, `winter`; then night with `?weather=rain` | *A forest and a garden that follow the seasons.* |
| 1:45–2:10 | `08-comfort-hold-to-select`: Comfort panel, high contrast, hold to select (ring filling), can pouring by itself; then a quick shot in one-hand mode and the subtitles | *No pinch? Hold to select.* / *One hand. High contrast. Subtitles always on.* |
| 2:10–2:20 | A wilted tree (overwater or a wrong cut) recovering during a breath | *Mistakes show. The tree never dies.* |
| 2:20–2:38 | `07-return-new-flower`: the new flower, the daily gift, the level badge; 3 seconds of the shared tree (`?` clip with the basin) | *Come back: care earns levels.* / *One tree, shared by every visitor.* |
| 2:38–2:48 | Last frame held, slow fade | *Hands only · Seated · 5-10 minutes* + `broder893.github.io/zen-garden-vr` |

If it runs over 3:00, cut in this order: the wilted tree, the shared tree, the second
half of the seasons shots, then the pruning detail.

### Order of work on 15 November
1. Wait for the feature freeze (14 November); `npm run check:budget` and `npm test`.
2. `npx @iwsdk/cli dev restart --allow-browser-automation`, then `npm run demo:record`
   (all clips are stale after the Blender bonsai, the forest and the new voices).
3. Record the extra shots by hand with the URL options above (`?season=`, `?time=`,
   `?weather=`), and the wilted-tree recovery.
4. Cut to the table above; add the captions; export 1080p MP4.
5. Watch it once with sound off (captions must carry it) and once with sound on.

## 3. Publish

- YouTube: visibility **Public**, English title, e.g.
  *Bloom Break — hands-only VR bonsai & breathing (Meta VR Start 2026)*.
- In the description: the app link and the tagline.
- Paste the video link into `DEVPOST.md` and the Devpost form.

## If you get access to a Quest later

Recording on the headset (Meta button → Camera → Record video) shows real hands. `QUEST-TEST.md` has the checklist for that session.
