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

### Shot list and captions (about 2:45), updated 16 November

What exists today (all recorded in the emulator; see "Clips" below):
- **Up to date:** `artifacts/first-minutes/first-minutes.webm` (116 s, 14 November evening,
  with audio: arrival, title, silhouette, planting, growth, first breath with the sprout,
  pruning, bloom with petals) and `artifacts/animations/after-*.webm` (10 s each: wind,
  clouds, particles, birds).
- **Stale** (before the new forest, the karesansui garden and the features of the 14th):
  `artifacts/video/v01-v07` and `artifacts/01-09` (the last have no sound). Record again
  with `bash scripts/record-extra.sh` (v01-v17) before cutting.

Add a small fixed caption on every care shot: *Recorded in the WebXR emulator: hands are
scripted.* The emulator draws hands only as thin outlines, so the tools seem to move by
themselves; the ghost gesture in light should stay in frame. If you can borrow a Quest,
30 seconds recorded on the headset with real hands is worth more than any other shot.

| Time | Shot (clip / how to get it) | Caption |
| --- | --- | --- |
| 0:00–0:12 | The eyes open; the firefly flies in from the forest, circles the table, lands on the seed; "Bloom Break" glows and fades; the silhouette of the tree in bloom (`first-minutes.webm` 0:00–0:12) | *Bloom Break* / *A breathing break with a bonsai.* |
| 0:12–0:40 | The seed pinched (the sprout springs up), the can tilted, the first growth (the canopy opens), the first breath with the sprout (`first-minutes.webm`) | *Hands only. Seated.* / *Breathe in with your sprout.* |
| 0:40–1:00 | Trim the glowing shoots (they tumble away), water, bloom with the petal shower (`first-minutes.webm`, speed 2×) | *Tilt to pour. Trim to shape.* |
| 1:00–1:25 | A breathing break: the invitation, the eyelids close, the light orb and the card through them, "Open your eyes", something has changed (`v07`, recorded again) | *Close your eyes. Breathe.* / *The garden changes while you rest.* |
| 1:25–1:50 | **One continuous shot with no pinch at all**: Comfort, Hold to select on, the ring filling, the can following the hand and pouring by itself; then high contrast, one hand, and the table moved higher and nearer (`v08`-`v10`, or by hand with `?fresh`) | *No pinch? Hold to select.* / *One hand. High contrast. Your table, your height.* |
| 1:50–2:00 | A wilted tree recovering during a breath | *Mistakes show. The tree never dies.* |
| 2:00–2:25 | `?nextvisit`: a new flower, the daily gift, "Another day in a row!", the badge with its dots, the question "How long is your break?", then the summary at the end (`v16`, and `artifacts/features/3-break-length.png`, `5-break-summary.png` as stills) | *Come back: one more day in a row.* / *Choose your break. See what it gave you.* |
| 2:25–2:38 | Four seasons, 3 s each (`artifacts/animations/after-*.webm`, or `?season=`) and 3 s of the shared tree | *A garden that follows your seasons.* |
| 2:38–2:45 | Last frame held, slow fade | *Hands only · Seated · 5-10 minutes* + `broder893.github.io/zen-garden-vr` |

If it runs over 3:00, cut in this order: the wilted tree, the shared tree, two of the
four seasons, then the pruning detail.

### Recording mode (`?rec`, dev server only)

The clips of 16 November afternoon (`artifacts/video-final2/`, same names as
`artifacts/video-final/`) were recorded with `?rec`: the guide remembers, in the tab's
sessionStorage, the lines it already said in earlier clips and neither shows nor speaks
them again; the resting line ("Rest, rake the sand...") never shows; the break-length
panel shows only in `v13-comfort` (`?rec=breakpanel`). It does not exist in the published
app. In every build the guide stays quiet while the entrance's eyelids are closed or
opening, so `v01-open` opens on a garden with no text.

### Order of work (16 November)
1. `npx @iwsdk/cli dev restart --allow-browser-automation`, then
   `bash scripts/record-extra.sh` (all clips v01-v17, about 40 minutes).
2. Cut to the table above; add the captions; export 1080p MP4.
3. Watch it once with sound off (captions must carry it) and once with sound on.

## 3. Publish

- YouTube: visibility **Public**, English title, e.g.
  *Bloom Break — hands-only VR bonsai & breathing (Meta VR Start 2026)*.
- In the description: the app link and the tagline.
- Paste the video link into `DEVPOST.md` and the Devpost form.

## If you get access to a Quest later

Recording on the headset (Meta button → Camera → Record video) shows real hands. `QUEST-TEST.md` has the checklist for that session.
