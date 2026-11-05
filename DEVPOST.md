# Devpost submission: Zen Garden

Text ready to paste into the Devpost form. Fields in the order the form asks for them.

---

## Name

Zen Garden

## Tagline (max 140 characters)

A pocket zen garden for your work breaks: grow a bonsai with your bare hands, breathe with a firefly, and come back to watch it bloom.

## Category / Division

- **Category:** Productivity
- **Division:** New Experience

## Links

- **Try it:** https://broder893.github.io/zen-garden-vr/
- **Demo video:** _(add the YouTube/Vimeo link)_
- **Source:** https://github.com/Broder893/zen-garden-vr

---

## Description

### Inspiration

Most of us take our breaks on the same screen we work on, and come back more tired than we left. We wanted a break that actually feels like one: a few minutes away from the desk, with your hands busy on something small and alive, and a moment to breathe before going back to work.

Zen Garden is that ritual in a headset. A small garden sits on a table in front of you. You plant a seed, water it, trim it, and watch a bonsai grow through four stages until it blossoms. When you need to slow down, a glowing meditation stone starts a short guided breathing session. The whole thing fits in a five to ten minute break, and you can do it sitting down.

### What it does

- **A first five minutes that teaches itself.** A firefly guide floats to whatever matters next and explains it in one short sentence, spoken aloud and shown as an English subtitle: pinch the seed, lift the watering can, tilt it over the tree, trim the glowing shoots. Beside the object, a tiny ghost gesture drawn in light acts the motion out (two fingertips pinching, a spout turning down), so you see what to do before you read it. If you seem stuck for 15 seconds, the line becomes a clearer one, and after a pause the firefly welcomes you back to where you left off. The seed sprouts in the first seconds; in a scripted run in the emulator the tree first grew at 21 seconds and bloomed at 76 (a first-time player is slower, but the first reward still comes within the first minute). Still not planted after 30 seconds? The firefly flies to the Comfort button and offers the no-pinch mode.
- **A tree that needs you.** The bonsai only grows when it has had its water and every overgrown shoot has been cut. Each stage arrives with sparkles and a little rising melody.
- **A minute and a half to breathe.** Pinch the stone and an orb of light grows as you breathe in, holds, and shrinks as you breathe out, six times, while the music opens and closes with your breath. Pinch again to pause.
- **Little breaks that find you.** Every few minutes of care (never while you hold a tool, never twice without care in between), the firefly comes close and asks: "Let us pause a moment to breathe together." Show an open hand to say "not now", with no penalty. Otherwise the garden dims, a light floats in front of your eyes with a card that says *Breathe in / Hold / Breathe out* and counts the breaths, and after three or four breaths your tree gets a drink of water as a thank-you. The rhythm grows with the tree: a simple 4-in 6-out for a young tree, box breathing (4-4-4-4) for a mature one, long and slow once it blooms.
- **Comfortable for more bodies.** A small Comfort panel on the table (poke it, point at it, or click it) changes the experience at any time, and remembers your choice:
  - **Hold to select:** no pinch needed. Keep a hand still beside an object for about a second, or look at the seed or stone for two, and a ring of light fills up and selects it. Tools then follow your hand, the can pours by itself when held over the tree, and lowering a tool to the table lets it go.
  - **One hand:** choose left or right and both tools move to that side of the table; the firefly follows only that hand.
  - **High contrast:** solid black and white subtitles, yellow outlines, and the things you can pick up glow.
  - **Large text** for subtitles and the panel.
  - **Breathing pace:** slow, medium or fast.
  Subtitles are always on, and every spoken line is also written.
- **A reason to come back.** Your garden is saved on the device. Every return visit (after a few hours away) a new flower opens in the sand, up to seven, and the firefly welcomes you back.

### How we built it

Zen Garden is a WebXR app built with Meta's Immersive Web SDK (IWSDK) and Three.js, so it opens straight from a link in the Quest browser with nothing to install. Game logic is written as ECS systems: watering, pruning, growth, the guide, meditation, audio and saving each own one job and read each other's state.

Everything is original and made in code. The table, bonsai, tools and flowers are procedural models; the bonsai's parts are merged per material to keep the whole scene around 80 draw calls and 14,000 triangles, well inside a Quest budget. All sound is synthesised live with the Web Audio API, from the pentatonic wind chimes to the water and the snip of the shears, so the app ships no audio files. The guide speaks through the device's own speech synthesis, and every line is also a subtitle. Progress is stored in localStorage with validation and error handling, so a blocked or corrupted save simply starts a fresh garden.

We had no headset during development, so the whole experience was built and tested in IWER, IWSDK's WebXR emulator, driving simulated hands from scripts: every tutorial step, growth stage and breathing session was played through that way.

### What's next

Tuning gesture tolerances and pacing on real Quest hardware, more plants to choose from, a day and night cycle that follows the real clock, longer or shorter breathing sessions, and recorded voice lines in more languages.

---

## How the hand interactions work

The experience is completable from start to finish with hands only; controllers are never required. Everything you touch sits on the table within about 60 cm of a seated player.

- **Pinch to pick up.** Seed, watering can, shears and meditation stone respond to a hand pinch (IWSDK's `OneHandGrabbable` with hand-pinch grabbing). Each has a large invisible grab volume (6 to 10 cm), so a loose pinch near the object is enough.
- **Tilt to pour.** The can pours only when its spout actually points down (about 20 degrees below level), so you never spill by accident. Water counts when the spout is anywhere within 22 cm of the tree.
- **Touch to trim.** Holding the shears, bring the blades within 7 cm of a glowing shoot and it is cut, with a snip animation and sound. No second gesture or precise aim is needed.
- **Pinch as a button.** Pinching the seed plants it; pinching the stone starts, pauses or resumes the breathing session. These objects are released straight away, so they act like buttons you can find with your hand.
- **Forgiving by design.** Released tools glide back to their place on the table, so nothing is ever lost or dropped out of reach.
- **Shown, not told.** Each pinch task gets a ghost pinch drawn in light beside the object; holding the can level shows a turning arc to say "tilt".
- **Hands that cannot pinch.** With "Hold to select" on, a hand held still beside an object (about 13 to 16 cm from its centre, measured from the palm) for 1.2 seconds acts as a pinch, and a steady look at the seed or stone does the same in 2 seconds. A ring of 18 light dots fills as the selection builds, so you can move away to cancel. A picked-up tool follows the hand; the can tips itself over the tree; lowering the hand to the table puts the tool down. All lines change to match ("Hold your hand by the can to pick it up.").
- **One hand is enough.** In one-hand mode the tools rest on that hand's side and the firefly ignores the other hand.
- **Open hand for "not now".** A breathing break can be declined by holding an open hand up in front of you, palm out. The app reads the WebXR hand joints: the hand must be raised and pushed forward, the palm facing away (from the knuckle triangle), and the index, middle and ring fingers straight (tip-to-knuckle distance at least 90% of the finger's length), held for 0.4 seconds. A relaxed or resting hand does not trigger it.
- **The guide follows you.** The firefly never strays more than 35 degrees from where you are looking, leading your eye to the next task, and once the tree is in bloom it follows your hand.

## Built with

IWSDK (Immersive Web SDK), WebXR, Three.js, TypeScript, Vite, Web Audio API, Web Speech API, localStorage, GitHub Pages.
