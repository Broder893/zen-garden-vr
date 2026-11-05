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

We take our breaks on the screen we work on, and come back more tired. We wanted a real break: hands busy with something small and alive, and a moment to breathe.

Zen Garden is that ritual in a headset. A little garden sits on a table in front of you: plant a seed, water it, trim it, and watch a bonsai grow through four stages until it blossoms. It fits in a five to ten minute break, sitting down.

### What it does

- **A first five minutes that teaches itself.** A firefly guide flies to whatever matters next and says it in one short sentence, spoken and subtitled. Beside the object, a ghost gesture drawn in light acts the motion out (a pinch, a tilt). The seed sprouts within seconds and the tree first grows within a minute.
- **A tree that needs you.** It grows only when watered and trimmed; each stage arrives with sparkles and music.
- **Time to breathe.** Pinch the glowing stone for a guided session: an orb of light grows as you breathe in and shrinks as you breathe out, while the music breathes with you.
- **Little breaks that find you.** Every few minutes of care (never while you hold a tool) the firefly invites a short pause. Show an open hand to say "not now". Otherwise the garden dims, a light in front of your eyes guides three or four breaths with a card that names each step, and the tree gets a drink of water as a thank-you.
- **Comfortable for more bodies.** A Comfort panel offers **hold to select** (no pinch: keep a hand still by an object, or look at it), **one hand**, **high contrast**, **large text** and **breathing pace**. Subtitles are always on.
- **A garden to sit in.** Around the table lies a raked sand garden at sunset. Rake the table's sand with your fingertips; your patterns stay for next time.
- **A reason to come back.** Every bit of care earns experience, and the garden levels up: the tree's stages first, then a glazed pot, a stone lantern, a little stream and a new deep breath. Each return the soil has dried and new shoots wait to be trimmed, the first visit of the day brings a gift, and a new flower grows in the sand.

### How we built it

Zen Garden is a WebXR app built with Meta's Immersive Web SDK (IWSDK) and Three.js: it opens from a link in the Quest browser, nothing to install. The logic is a set of small ECS systems, each with one job.

Everything is original and made in code. Models are procedural and merged per material: about 75 draw calls per eye. All sound is synthesised live with the Web Audio API, so the app ships no audio files; the guide speaks through the device's speech synthesis. Progress is saved in localStorage with validation, so a blocked or corrupted save simply starts a fresh garden.

We had no headset, so everything was built and tested in IWER, IWSDK's WebXR emulator, with scripted hands playing every step.

### What's next

Tuning on real Quest hardware, more plants, unlocks as the tree levels up, a day and night cycle, and more languages.

---

## How the hand interactions work

The experience is completable from start to finish with hands only; controllers are never required. Everything you touch sits on the table within about 60 cm of a seated player.

- **Pinch to pick up.** Seed, watering can, shears and meditation stone respond to a hand pinch (IWSDK's `OneHandGrabbable` with hand-pinch grabbing). Each has a large invisible grab volume (6 to 10 cm), so a loose pinch near the object is enough.
- **Tilt to pour.** The can pours only when its spout actually points down (about 20 degrees below level), so you never spill by accident. Water counts when the spout is anywhere within 22 cm of the tree.
- **Touch to trim.** Holding the shears, bring the blades within 7 cm of a glowing shoot and it is cut, with a snip animation and sound. No second gesture or precise aim is needed.
- **Pinch as a button.** Pinching the seed plants it; pinching the stone starts, pauses or resumes the breathing session. These objects are released straight away, so they act like buttons you can find with your hand.
- **Poke to set.** The Comfort panel's buttons react to a fingertip poke (IWSDK's `PokeInteractable`), as well as a pointing ray or a mouse click, and act on touch rather than on release, so a shaky poke still counts.
- **Forgiving by design.** Released tools glide back to their place on the table, so nothing is ever lost or dropped out of reach.
- **Shown, not told.** Each pinch task gets a ghost pinch drawn in light beside the object; holding the can level shows a turning arc to say "tilt".
- **Hands that cannot pinch.** With "Hold to select" on, a hand held still beside an object (about 13 to 16 cm from its centre, measured from the palm) for 1.2 seconds acts as a pinch, and a steady look at the seed or stone does the same in 2 seconds. A ring of 18 light dots fills as the selection builds, so you can move away to cancel. A picked-up tool follows the hand; the can tips itself over the tree; lowering the hand to the table puts the tool down. All lines change to match ("Hold your hand by the can to pick it up.").
- **One hand is enough.** In one-hand mode the tools rest on that hand's side and the firefly ignores the other hand.
- **Open hand for "not now".** A breathing break can be declined by holding an open hand up in front of you, palm out. The app reads the WebXR hand joints: the hand must be raised and pushed forward, the palm facing away (from the knuckle triangle), and the index, middle and ring fingers straight (tip-to-knuckle distance at least 90% of the finger's length), held for 0.4 seconds. A relaxed or resting hand does not trigger it.
- **Fingers as a rake.** The index, middle and ring fingertips (WebXR hand joints) draw grooves wherever they touch the table's sand, within 1.5 cm of its surface. A hand holding a tool does not rake. The grooves are drawn into a 512-pixel canvas texture, uploaded at most 15 times a second, and saved between visits.
- **The guide follows you.** The firefly never strays more than 35 degrees from where you are looking, leading your eye to the next task, and once the tree is in bloom it follows your hand.

## Built with

IWSDK (Immersive Web SDK), WebXR, Three.js, TypeScript, Vite, Web Audio API, Web Speech API, localStorage, GitHub Pages.
