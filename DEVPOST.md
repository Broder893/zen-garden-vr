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

Zen Garden is that ritual in a headset: a little garden on a table in front of you, where a bonsai grows from a seed to bloom. It fits in a five to ten minute break, sitting down.

### What it does

- **A first five minutes that teaches itself.** A firefly flies to whatever matters next and says it in one short sentence, spoken and subtitled, while a ghost gesture in light acts the motion out. The tree first grows within a minute.
- **A tree that needs you, and forgives.** Too much water or a cut healthy branch makes it droop, fade and lean. It never dies and you lose nothing: breathing with your tree brings it back fastest.
- **Time to breathe.** Pinch the glowing stone: an orb of light grows as you breathe in and shrinks as you breathe out.
- **Little breaks that find you.** Every few minutes of care the firefly invites a short pause; an open hand says "not now". Otherwise the garden dims and a light guides a few breaths.
- **Comfortable for more bodies.** A Comfort panel offers **hold to select** (no pinch: keep a hand still by an object, or look at it), **one hand**, **high contrast**, **large text** and **breathing pace**. No hand tracking? Everything also works by looking. Subtitles are always on.
- **A garden that lives with your day.** The garden follows the real clock and season: day, sunset, a night of fireflies, red autumn leaves, winter snow, a passing rain. Rake the sand with your fingertips.
- **A reason to come back.** Care earns experience and levels: a glazed pot, a stone lantern, a stream, a new deep breath. Each return brings new shoots to trim, a daily gift and a flower in the sand.
- **A tree we share.** One big tree in the garden belongs to everyone who visits. Pour water into the stone basin and a light carries it over; the tree blossoms with the day's care from every garden. No accounts, nothing personal sent.

### How we built it

Zen Garden is a WebXR app built with Meta's Immersive Web SDK (IWSDK) and Three.js: it opens from a link in the Quest browser, nothing to install. The logic is a set of small ECS systems, each with one job.

Everything is original. The bonsai is five low-poly Blender models, one per stage, tinted by code; the rest is procedural, merged per material: at most about 75 draw calls and 33k triangles per eye, checked by a script on the emulator's Quest 3 profile. Quality starts conservative and lowers itself if the headset struggles. All sound is synthesised live with the Web Audio API, so the app ships no audio files; the guide speaks through the device's speech synthesis. Progress is saved locally with a versioned, validated format. The shared tree talks to a tiny Cloudflare Worker that only counts anonymous cares; if it is unreachable, the garden carries on offline.

We had no headset, so everything was built and tested in IWER, IWSDK's WebXR emulator, with scripted hands playing every step.

### What's next

Tuning on real Quest hardware, more plants, more ways to tend the shared tree together, and more languages.

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
- **No hands at all.** If hand tracking is off or controllers are picked up (the app checks the WebXR input sources every quarter second and waits 2.5 seconds before switching, 6 with no input at all, so hands resting out of view do not count), the firefly says so and every care works by gaze: a steady two-second look at the can, shears or basin sends that tool to work by itself (it flies over the tree and pours, or trims the next glowing shoot), and a look plants the seed or starts the breathing session. After each use the look must move away before the same thing can start again.
- **One hand is enough.** In one-hand mode the tools rest on that hand's side and the firefly ignores the other hand.
- **Open hand for "not now".** A breathing break can be declined by holding an open hand up in front of you, palm out. The app reads the WebXR hand joints: the hand must be raised and pushed forward, the palm facing away (from the knuckle triangle), and the index, middle and ring fingers straight (tip-to-knuckle distance at least 90% of the finger's length), held for 0.4 seconds. A relaxed or resting hand does not trigger it.
- **Fingers as a rake.** The index, middle and ring fingertips (WebXR hand joints) draw grooves wherever they touch the table's sand, within 1.5 cm of its surface. A hand holding a tool does not rake. The grooves are drawn into a 512-pixel canvas texture, uploaded at most 15 times a second, and saved between visits.
- **Pour to share.** Tipping the can over the stone basin beside the table (spout within 17 cm of its centre) for 1.2 seconds sends one care to the shared tree; hands-free, holding the can over the basin is enough.
- **The guide follows you.** The firefly never strays more than 35 degrees from where you are looking, leading your eye to the next task, and once the tree is in bloom it follows your hand.

## Built with

IWSDK (Immersive Web SDK), WebXR, Three.js, TypeScript, Vite, Web Audio API, Web Speech API, localStorage, GitHub Pages.
