# Quest test checklist

For a single test session on a real Meta Quest (about 20–30 minutes). The app was
built and tested only in the emulator, so this is the first check of what the
emulator cannot show: real hands, frame rate, voice, comfort.

Write down what goes wrong next to each item (a few words are enough: "pinch on
the can doesn't grab", "subtitle too high"). A phone photo of the notes is fine.

## 0. Before you start

- [ ] Quest updated, **hand tracking on**: Settings → Movement tracking → Hand and body tracking. Put the controllers down, out of reach.
- [ ] Sit on a chair, with some free space in front of you (the table is virtual, you only need room for your arms).
- [ ] Volume up (the app has music, sounds and a voice).
- [ ] Open the **Browser** on the Quest and go to:
      `https://broder893.github.io/zen-garden-vr/?fresh`
      (`?fresh` starts with a new garden; it disappears from the address by itself.)

## 1. Entering

- [ ] The page shows the table and the "Zen Garden" card.
- [ ] There is an **Enter VR** button (top). Press it.
- [ ] The table is **in front of you**, at a comfortable height for someone seated. If it's turned or off-center: hold the **Meta button** on your right hand to recenter.
- [ ] The light **warms up** gently (a few seconds), the firefly arrives from the distance.
- [ ] You hear the **music** (soft drone + chimes) and the **voice** reading the first subtitle. *(If there's no voice but the subtitles are there: note it, it's an important point.)*

## 2. Tutorial: seed and water

- [ ] Subtitle "Welcome. Pinch the glowing seed to plant it." readable without effort.
- [ ] Next to the seed a small **ghost pinch** in light (two dots closing, a ring flashing) shows the gesture. Visible without effort?
- [ ] Wait 15 seconds without doing anything: the subtitle becomes a clearer one ("Reach out to the seed, then touch thumb to finger.").
- [ ] **Pinch the seed** (thumb + index near the glowing seed): it disappears, chime, sparkles, a sprout appears.
- [ ] **Pinch the watering can**: it grabs on the first or second try, not after many attempts. *(Note how many tries.)*
- [ ] While you hold the can level, a small **arc of light** next to it suggests turning it.
- [ ] **Tilt** the can over the tree: water comes out only when you really tilt it, the sound of water starts and stops.
- [ ] The soil darkens; after about 3 seconds of pouring the tree **grows** (sparkles, melody).
- [ ] **Release** the can (open your hand): it slides back to its place on the table.

## 3. Tutorial: pruning

- [ ] **Pinch the shears** and lift them.
- [ ] Touch a **glowing shoot** with the blades: snip, sound, the shoot disappears. *(Note whether it's too easy, i.e. accidental cuts, or too hard.)*
- [ ] Cut every shoot, water again: the tree reaches **Mature**, then repeat until it **flowers**.
- [ ] The firefly always points to the right thing to do; if you look elsewhere it stays at the edge of your view.
- [ ] Once in bloom, the firefly **follows your hand**.

## 4. Meditation

- [ ] After the first growth the firefly suggests the stone ("Any time, pinch the glowing stone to breathe.").
- [ ] **Pinch the stone**: bell, the orb appears above the tree and breathes (grows 4 s, holds 2 s, shrinks 6 s).
- [ ] The voice says "Breathe in... / Hold... / And breathe out..." **in time** with the orb.
- [ ] **Pinch the stone again**: "Paused". Again: it resumes.
- [ ] Press the **Meta button** while caring for the tree, then come back: the firefly says "Welcome back. Let us carry on." and the task continues.
- [ ] Press the **Meta button** (system menu) during the meditation: **sound stops** and the session pauses. Come back: everything is quiet until you pinch the stone.
- [ ] At the end "Well done…" and a deeper bell.

## 4b. Breathing breaks

The first break comes after 2 to 4 minutes of care (watering, cutting). To see one sooner, just keep caring for the tree.

- [ ] The firefly comes close, a soft chime, and "Let us pause a moment to breathe together." It never happens while you hold the can or shears.
- [ ] Do nothing: the garden dims, a light appears **in front of your eyes**, with a card *Breathe in / Hold / Breathe out* and "Breath 1 of 3". Comfortable distance? Readable?
- [ ] At the end: "Lovely. Your tree grew a little with you.", the light comes back, sparkles on the tree.
- [ ] Next break: hold an **open hand up in front of you, palm out** ("stop") for half a second: "Of course. We will breathe later." Does it recognise the gesture on the first try? Does it ever trigger by accident while caring for the tree?

## 5. Comfort panel (accessibility)

- [ ] At the front-left corner of the table there is a small **Comfort** button. Poke it with a fingertip: the settings open; poke **Done** to close.
- [ ] **High contrast On**: subtitles black and white, the can, shears, seed and stone glow yellow. Off restores.
- [ ] **Text size Large**: the subtitles and panel grow; still readable and not covering the tree?
- [ ] **Breathing pace Slow / Fast**: start a session with the stone and check the rhythm changes.
- [ ] **Hands Right** (then **Left**): both tools move to that side and can be picked up with that hand alone. **Both** puts them back.
- [ ] **Hold to select On**, without pinching at all:
  - [ ] Start fresh (`?fresh`) and look at the seed for 2 seconds: a ring of light fills and it is planted.
  - [ ] Hold your open hand still beside the can for about a second: it follows your hand. Hold it over the tree: it tips and pours by itself.
  - [ ] Lower your hand to the table: the can is let go and glides back.
  - [ ] Same with the shears, and cut a glowing shoot.
  - [ ] Note how easy it is to trigger by accident (is 1.2 s right?).
- [ ] Reload the page: the settings are kept.

## 6. Comfort and fluidity

- [ ] Everything you need to touch is **within reach** without getting up or leaning forward a lot.
- [ ] The subtitles are **readable** and don't cover the tree.
- [ ] Movement is **smooth** throughout (no stutters, especially in bloom with many flowers and during the meditation).
  *For a number: with the [OVR Metrics Tool](https://developers.meta.com/horizon/documentation/native/android/ts-ovrmetricstool/) the FPS must stay at **72 or more** (60 is the minimum).*
- [ ] No nausea or eye strain after 10 minutes.

## 7. Saving and returning

- [ ] Exit VR, **close the browser tab**, reopen the address **without** `?fresh`:
      `https://broder893.github.io/zen-garden-vr/`
- [ ] Enter VR: the tree is **as you left it**, the firefly says "Welcome back…".
- [ ] To see the gift without waiting 3 hours, open:
      `https://broder893.github.io/zen-garden-vr/?nextvisit`
      → entering VR, once the light comes up, a **new flower** grows in the sand and the firefly announces it.

## 8. When you're done

Send me the notes (or a photo). The points that matter most:

1. Does the voice work?
2. How many tries to grab the can and the shears?
3. Is pouring and cutting too strict or too loose?
4. Frame rate (smooth? any number?).
5. Table height and position: comfortable?

If something doesn't load at all, take a photo of the screen, including the address bar.
