# Quest test checklist

For a single test session on a real Meta Quest (about 20–30 minutes). The app was
built and tested only in the emulator, so this is the first check of what the
emulator cannot show: real hands, frame rate, voice, comfort.

Write down what goes wrong next to each item (a few words are enough: "pinch on
the can doesn't grab", "subtitle too high"). A phone photo of the notes is fine.

## Short test (10 minutes)

If there is little time, do only this; the full list follows. These are the points
the emulator could not prove (QA-REPORT.md).

- [ ] **Start:** `https://broder893.github.io/zen-garden-vr/?fresh` loads within about 15 s on the headset's Wi-Fi, and **Enter VR** appears.
- [ ] **Eyes and voice:** the visit opens with closed eyes, then the lids open; a calm recorded voice reads the first line (not the headset's robotic one).
- [ ] **Hands:** pinch the seed, lift the can and pour, pick up the shears and touch a glowing shoot: each works within two or three tries.
- [ ] **Frame rate:** smooth all along; no stutter when the tree grows or the rain starts.
- [ ] **Breathing break:** "Close your eyes…", the lids close; the music softens, the voice stays clear; it ends with "Open your eyes."
- [ ] **Open hand:** at the next break invitation, show an open hand: "Of course. We will breathe later."
- [ ] **Pause:** press the Meta button during a meditation: sound stops, the lids open, "Paused". Back in: quiet until you pinch the stone.
- [ ] **Headset off for a minute, back on:** the garden carries on with no jump or error.
- [ ] **No hands:** put the controllers in your hands, then down: "I cannot see your hands…", then "There are your hands again."
- [ ] **Comfort:** poke Comfort, switch High contrast on and off, and Gentle fades on: the next session fades instead of the lids.
- [ ] **Return:** close the browser, open the link **without** `?fresh` and with `?nextvisit`: a new flower grows, and the tree is as you left it.

## 0. Before you start

- [ ] Quest updated, **hand tracking on**: Settings → Movement tracking → Hand and body tracking. Put the controllers down, out of reach.
- [ ] Sit on a chair, with some free space in front of you (the table is virtual, you only need room for your arms).
- [ ] Volume up (the app has music, sounds and a voice).
- [ ] Open the **Browser** on the Quest and go to:
      `https://broder893.github.io/zen-garden-vr/?fresh`
      (`?fresh` starts with a new garden; it disappears from the address by itself.)

## 1. Entering

- [ ] The page shows the table and the "Bloom Break" card.
- [ ] There is an **Enter VR** button (top). Press it.
- [ ] The table is **in front of you**, at a comfortable height for someone seated. If it's turned or off-center: hold the **Meta button** on your right hand to recenter.
- [ ] The visit starts with **closed eyes**: about a second of dark, then two eyelids open over about 2 seconds while the light **warms up** and the firefly arrives from the distance. Comfortable, or unsettling?
- [ ] You hear the **music** (soft drone + chimes) and the **voice** reading the first subtitle: a calm recorded voice, not the headset's robotic one. *(If there's no voice but the subtitles are there, or the robotic voice: note it, it's an important point.)*

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
- [ ] At the start the firefly says "Close your eyes. Let us breathe together." and two **eyelids** close over about 2 seconds; the music softens. The breathing light, its words and the subtitles stay visible through them. Any discomfort with the lids fixed to your view?
- [ ] At the end, with the eyes still closed, a deeper bell, "Open your eyes.", the lids open in about 2 seconds, then "Well done…".
- [ ] While the narrator speaks the music **dips** a little; with the eyes closed the music is muffled but her voice stays **clear**. Does every spoken line match its subtitle?
- [ ] During a closed-eye session, hold up an **open hand** (palm out): the eyes open at once and the session goes on. Next session: **look up** at the small ring of light above (2 seconds): same.
- [ ] If the tree was about to grow (or a level was reached) during the session, the change is simply there when the eyes open.
- [ ] Press the **Meta button** with the eyes closed: back in the garden, the eyes are open (or open within a second).

## 4a. Careful care (the tree wilts, never dies)

- [ ] After the first growth, keep pouring on the tree once it is full: "That is plenty of water. Let it rest a moment.", a puddle spreads over the soil in the pot; keep going and the tree sinks, leans and its leaves fade, with a soft low tone.
- [ ] Put the can down and wait: "Too much water. Let the soil drain a little." In a minute or two the tree is well again ("Your tree is feeling better.", a light rising tone).
- [ ] With the shears, touch one of the dark green, **not glowing** branches: a stump of light, fresh wood stays (visible from the seat?), "That branch was healthy. Trim only the glowing shoots." Was it ever cut by accident while trimming the glowing ones?
- [ ] Wilt the tree, then pinch the stone (or accept the firefly's "Your tree is tense. Let us breathe together."): during the breaths it recovers, and at the end it is well.
- [ ] A first-time player who makes no mistakes never sees anything negative.
- [ ] Old save: on a device that ran the app before this version, the garden loads with the same level and flowers and a healthy tree.

## 4b. Breathing breaks

The first break comes after 2 to 4 minutes of care (watering, cutting). To see one sooner, just keep caring for the tree.

- [ ] The firefly comes close, a soft chime, and "Let us pause a moment to breathe together." It never happens while you hold the can or shears.
- [ ] Do nothing: the garden dims, a light appears **in front of your eyes**, with a card *Breathe in / Hold / Breathe out* and "Breath 1 of 3". Comfortable distance? Readable?
- [ ] At the end: "Lovely. Your tree grew a little with you.", the light comes back, sparkles on the tree.
- [ ] Next break: hold an **open hand up in front of you, palm out** ("stop") for half a second: "Of course. We will breathe later." Does it recognise the gesture on the first try? Does it ever trigger by accident while caring for the tree?

## 4d. Atmosphere

- [ ] The sky matches the time of day (day 8-17, sunset 6-8 and 17-20, night otherwise); at night fireflies drift around the garden. Comfortable brightness by day?
- [ ] The tree's colours match the season (in November: red autumn leaves, and a few fallen leaves on the soil). Open `...?season=winter` with a grown tree: snow on the canopy. The forest beyond the fence changes too (spring pink, summer green, autumn rust, winter snow: white, not grey), and so does the ground under it (green, brown in autumn, snow in winter).
- [ ] Look all around, up and down: the trees and hills always stand on ground, with no gap or edge below them.
- [ ] Each stage is its own model (sprout, young, mature, in bloom): does every growth step read clearly as the same tree getting bigger? Before planting, a warm glow in the empty pot.
- [ ] Open `...?weather=rain`: after a few seconds rain falls, you hear it, the firefly says "A gentle rain. It is watering your tree." and the soil darkens.
- [ ] Open `...?weather=breeze`: the tree sways gently, wind in the bamboo. No discomfort?
- [ ] **Ambience** (listen 30 s each, guide quiet): `...?season=spring&time=day` light wind and far birds; `...?season=summer&time=night` crickets and, now and then, a distant owl; `...?season=autumn` rustling leaves; `...?season=winter` almost silent, a thin cold wind. Always under the music, never covering the voice; quieter with the eyes closed.
- [ ] Frame rate at night with rain (the busiest moment): smooth?

## 4e. Shared tree

- [ ] A big tree stands at the back right of the garden; a stone basin with a bamboo pipe stands beside the table on the right, with a small "Shared tree" sign.
- [ ] Once your tree is mature, after a quiet moment the firefly flies to the basin: "Every visitor shares that big tree. Water it at the basin."
- [ ] Pour the can into the basin for about a second: drips, a bowl sound, a light flies in an arc to the big tree, which sparkles and glows; the sign counts one more care. Easy to reach without leaning?
- [ ] With **Hold to select**, hold the can over the basin: it pours by itself and the care counts.
- [ ] With **Hands Left**, the basin and sign move to the left side.
- [ ] Turn Wi-Fi off (or block the site) and pour: the sign says "Offline - your care will be sent later"; turn it back on and wait a minute: the count catches up. No errors, nothing else changes.

## 4c. Garden and sand rake

- [ ] Look around: raked sand garden at sunset, three mossy rocks, a bamboo fence behind, a large stone lantern. Pleasant, not too dark or too bright?
- [ ] Touch the table's sand with your fingertips and drag: grooves appear (three lines), with a soft sand sound. Does it start when your fingers touch, not before? Does it ever draw when you did not mean to (e.g. while reaching for the can)?
- [ ] Close and reopen the app: your grooves are still there.

## 5. Comfort panel (accessibility)

- [ ] At the front-left corner of the table there is a small **Comfort** button. Poke it with a fingertip: the settings open; poke **Done** to close.
- [ ] **High contrast On**: subtitles black and white, the can, shears, seed and stone glow yellow. Off restores.
- [ ] **Text size Large**: the subtitles and panel grow; still readable and not covering the tree?
- [ ] **Breathing pace Slow / Fast**: start a session with the stone and check the rhythm changes.
- [ ] **Gentle fades On**: start a session: instead of eyelids, the view fades slowly to dark (about 3 s). More comfortable than the lids?
- [ ] **Hands Right** (then **Left**): both tools move to that side and can be picked up with that hand alone. **Both** puts them back.
- [ ] **Hold to select On**, without pinching at all:
  - [ ] Start fresh (`?fresh`) and look at the seed for 2 seconds: a ring of light fills and it is planted.
  - [ ] Hold your open hand still beside the can for about a second: it follows your hand. Hold it over the tree: it tips and pours by itself.
  - [ ] Lower your hand to the table: the can is let go and glides back.
  - [ ] Same with the shears, and cut a glowing shoot.
  - [ ] Note how easy it is to trigger by accident (is 1.2 s right?).
- [ ] **Visual quality Low**: fewer fireflies at night, fewer raindrops, the rocks and the far lantern disappear. **Med** is in between; **High** brings everything back; **Auto** is the default: it starts at Medium and steps down by itself if the frame rate drops (with `?debug` the readout shows e.g. `medium (auto)`). If everything is smooth at Medium, try **High** and note the fps.
- [ ] Reload the page: the settings are kept.

## 5b. Without hands (hand tracking off, or controllers)

- [ ] Turn hand tracking off in the Quest settings (or just pick up the controllers). Within about 3 seconds the firefly says "I cannot see your hands. Look at things to use them." (or, with controllers, "Put the controllers down for your hands, or look at things.").
- [ ] Look at the seed for 2 seconds: a ring fills and it is planted.
- [ ] Look at the can: it flies over the tree, tips and pours, then glides home.
- [ ] Look at the shears when shoots glow: they come down onto a shoot and trim it.
- [ ] Look at the stone basin: the can pours into it and a light flies to the shared tree.
- [ ] Look at the stone: the breathing session starts.
- [ ] Put the controllers down / turn hand tracking back on: "There are your hands again." and the pinch lines return.
- [ ] In the emulator the same can be tried with `...?input=none` or `...?input=controllers`.

## 6. Comfort and fluidity

- [ ] Everything you need to touch is **within reach** without getting up or leaning forward a lot.
- [ ] The subtitles are **readable** and don't cover the tree.
- [ ] Movement is **smooth** throughout (no stutters, especially in bloom with many flowers and during the meditation).
  *For a quick number open `...?debug`: a readout behind the table, on the left, shows fps, the worst frame, draw calls per eye and triangles. Note the fps at night with rain (`...?debug&time=night&weather=rain`). If Auto lowered the quality, the readout says `low (auto)` and the console logs why.*
  *For a precise number: with the [OVR Metrics Tool](https://developers.meta.com/horizon/documentation/native/android/ts-ovrmetricstool/) the FPS must stay at **72 or more** (60 is the minimum).*
- [ ] No nausea or eye strain after 10 minutes.

## 7. Saving and returning

- [ ] Exit VR, **close the browser tab**, reopen the address **without** `?fresh`:
      `https://broder893.github.io/zen-garden-vr/`
- [ ] Enter VR: the tree is **as you left it**, the firefly says "Welcome back…".
- [ ] To see the gift without waiting 3 hours, open:
      `https://broder893.github.io/zen-garden-vr/?nextvisit`
      → entering VR, once the light comes up, a **new flower** grows in the sand and the firefly announces it, then "A daily gift: your tree grew stronger overnight." (+20 XP).
- [ ] On that return the soil is dry and glowing shoots have grown back: trim and water them. The **level badge** (front-right corner) flashes "+5 XP", "+10 XP" and its bar fills.
- [ ] Keep coming back (or keep caring): at level 6 the pot turns to a celadon glaze, at 7 a stone lantern appears behind the can, at 8 a stream runs behind the tree, at 9 the breathing breaks gain a deep 4-7-8 breath. Each is announced and appears with sparkles.

## 8. When you're done

Send me the notes (or a photo). The points that matter most:

1. Does the voice work?
2. How many tries to grab the can and the shears?
3. Is pouring and cutting too strict or too loose?
4. Frame rate (smooth? any number?).
5. Table height and position: comfortable?

If something doesn't load at all, take a photo of the screen, including the address bar.
