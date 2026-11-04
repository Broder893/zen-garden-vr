# Demo video plan (under 3 minutes)

Devpost asks for a public YouTube or Vimeo video, under 3 minutes, in English,
showing the real experience (not AI-generated).

## Where to record

**Best: on the Quest itself, during the test session** (see `QUEST-TEST.md`).

- Meta button → **Camera** → **Record video** (the menu may differ slightly by version).
  It records what you see, including the app's sound and voice.
- Videos end up in the Quest's gallery; transfer them with the Meta Horizon app
  on your phone, or over USB.
- Shows real hands and real performance, and the voice is the headset's own.

**Alternative: the emulator on the Mac** (`npm run dev`, screen recording with
QuickTime or Cmd+Shift+5). Usable, but:
- the hands are the emulator's, less convincing;
- the voice would be the Mac's (Apple's voices are probably only licensed for
  personal use): in that case **turn the Mac voice off** while recording and
  rely on the subtitles, or add your own narration.

## Before recording

- Open `https://broder893.github.io/zen-garden-vr/?fresh` (new garden).
- Quiet room, volume up, controllers out of sight.
- Move **slowly** and keep your head steady: in the video every movement
  looks faster than it feels.
- Record several short takes, one per scene below, rather than one long take.
  Editing is then easier (iMovie, CapCut, DaVinci Resolve, all free).

## Shot list

| Time | Scene | What to show | Subtitle / narration (English) |
| --- | --- | --- | --- |
| 0:00–0:12 | Opening | Enter VR: the light warms up, the firefly arrives over the table | Title: *Zen Garden — a pocket garden for your work breaks* |
| 0:12–0:35 | First seed | Firefly's line "Pinch the glowing seed", pinch, sparkles, sprout | *Everything is done with your bare hands.* |
| 0:35–1:00 | Watering | Pinch the can, tilt it over the tree, water falls, the soil darkens, the tree grows | *Tilt to pour. The tree grows when it's cared for.* |
| 1:00–1:25 | Pruning | Shears, touch the glowing shoots, snip, next stage | *Trim the wild shoots to shape your bonsai.* |
| 1:25–1:35 | Growth (fast) | Short time-lapse to bloom (cut the repetitions) | |
| 1:35–2:10 | Breathing | Pinch the stone, the orb grows and shrinks, "Breathe in… Breathe out…" | *When you need a pause, breathe with the light.* |
| 2:10–2:30 | Bloom | Flowering tree, the firefly following your hand | |
| 2:30–2:45 | Coming back | Reopen with `?nextvisit`: "Welcome back. A new flower grew…", flower growing in the sand | *Come back tomorrow: your garden keeps growing.* |
| 2:45–2:58 | Closing | Wide shot of the garden + text | *Hands only · Seated · 5–10 minutes · Built with IWSDK* and the link `broder893.github.io/zen-garden-vr` |

Total about 2:58. If you're short on time, shorten the growth time-lapse and the bloom scene.

## Publishing

- YouTube: visibility **Public** (not "Unlisted"), English title, e.g.
  *Zen Garden — hands-only VR bonsai & breathing (Meta VR Start 2026)*.
- In the description: the app link and two lines from the tagline.
- Paste the video link into `DEVPOST.md` and the Devpost form.
