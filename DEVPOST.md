# Devpost submission: Bloom Break

Text ready to paste into the Devpost form. Fields in the order the form asks for them.

---

## Name

Bloom Break

## Tagline (max 140 characters)

Close your eyes, breathe, and open them on a garden that changed: a hands-only bonsai break that forgives.

## Category / Division

- **Category:** Productivity
- **Division:** New Experience

## Links

- **Try it:** https://broder893.github.io/zen-garden-vr/
- **Second visit (what coming back looks like):** https://broder893.github.io/zen-garden-vr/?nextvisit
- **Demo video:** _(add the YouTube/Vimeo link)_
- **Source:** https://github.com/Broder893/zen-garden-vr

---

## Description

### Inspiration

We take our breaks on the screen we work on, and come back more tired. We wanted a real break: hands busy with something small and alive, and a moment to breathe. Bloom Break is that ritual in a headset: a bonsai on a table in front of you, grown from seed to bloom in a five to ten minute break, seated.

### What it does

- **Close your eyes.** Every few minutes of care the firefly invites a short breathing break. Soft eyelids close over the view, a few breaths are guided, and when you open your eyes the garden has changed: a new growth stage, the rain, the evening.
- **A tree that needs you, and forgives.** Too much water or a wrong cut makes it droop and fade. It never dies and you lose nothing: breathing with it is the fastest way to bring it back.
- **A first five minutes that teaches itself.** The firefly lands on the seed and a silhouette of the tree in bloom shows the goal. Each step is one short sentence, spoken and subtitled, with the gesture acted out in light. The tree first grows within half a minute.
- **Comfortable for more bodies.** The Comfort panel offers hold to select (no pinch: a hand held still, or a look), one hand, high contrast, large text, breathing pace, gentle fades and a table you can move. Without hand tracking, every care also works by looking. Subtitles are always on.
- **A break that ends well.** From the second visit you choose 3, 5 or 10 minutes. A minute before the end the firefly lets you know; then a soft bell and a summary: minutes, breaths, cares, level, days in a row.
- **A reason to come back.** Care earns levels and unlocks (a glazed pot, a stone lantern, a stream, a deeper breath). Each return brings new shoots, a daily gift, a flower in the sand and one more day in a row.
- **A garden that lives with your day.** It follows the real clock and season: wind, clouds, rain, fireflies at night.
- **A tree we share.** One big tree belongs to every visitor: pour water into the stone basin and it blossoms with the day's care. No accounts, nothing personal sent.

### How we built it

Bloom Break is a WebXR app built with Meta's Immersive Web SDK (IWSDK) and Three.js: it opens from a link in the Quest browser, nothing to install. Its logic is small ECS systems, each with one job, and 59 unit tests.

Everything is original or openly licensed. The bonsai and the forest are low-poly Blender models tinted by code; the rest is procedural and merged per material. A script plays the heaviest moments against a budget of 80 draw calls per eye (the garden uses 62 to 74), and quality lowers itself if the headset struggles. Music, ambience and sounds are synthesised live with the Web Audio API; the guide's voices are generated with Kokoro TTS and fall back to the device's voice. Progress is saved locally in a versioned, validated format.

We had no headset: every step was built and replayed by scripted hands in IWSDK's WebXR emulator, on its Quest 3 profile.

### What's next

Tuning on real Quest hardware, more life in the garden (a koi pond, butterflies), more plants, and more languages.

---

## How the hand interactions work

The experience is completable from start to finish with hands only; controllers are never required. Everything you touch sits on the table within about 60 cm of a seated player.

- **Pinch to pick up.** Seed, watering can, shears and meditation stone respond to a hand pinch. Their grab zones are generous, so a loose pinch near the object is enough.
- **Tilt to pour.** The can pours only when its spout points down, so you never spill by accident, and anywhere near the tree counts.
- **Touch to trim.** Holding the shears, bring the blades to a glowing shoot and it is cut. No second gesture, no precise aim.
- **Pinch as a button.** Pinching the seed plants it; pinching the stone starts, pauses or resumes a breathing session.
- **Poke to set.** The Comfort panel reacts to a fingertip poke, on touch rather than on release, so a shaky poke still counts.
- **Nothing is lost.** Released tools glide back to their place on the table.
- **Shown, not told.** Each pinch task gets a ghost pinch drawn in light beside the object; a turning arc says "tilt".
- **Hands that cannot pinch.** With Hold to select, a hand held still beside an object for about a second acts as a pinch, and a ring of light fills meanwhile, so moving away cancels. A picked-up tool follows the hand, and the can tips itself over the tree.
- **No hands at all.** If hand tracking is off or controllers are picked up, the firefly says so and every care works by gaze: a steady two-second look plants the seed, sends the can or the shears to work, or starts a breathing session.
- **One hand is enough.** In one-hand mode the tools rest on that hand's side.
- **Open hand for "not now".** A breathing break is declined by holding an open hand up, palm out. A relaxed or resting hand does not trigger it.
- **Fingers as a rake.** Fingertips draw grooves in the table's sand, saved between visits. A hand holding a tool does not rake.
- **Pour to share.** Tipping the can over the stone basin sends one care to the shared tree.
- **The guide follows you.** The firefly stays within your view and leads your eye to the next task.

## Built with

IWSDK (Immersive Web SDK), WebXR, Three.js, TypeScript, Vite, Web Audio API, Kokoro TTS (voices), Web Speech API, localStorage, GitHub Pages.
