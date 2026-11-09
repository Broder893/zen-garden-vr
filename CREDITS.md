# Bloom Break: credits and licenses

## Audio

All sound is original and **synthesised live in the browser** with the Web Audio API
(`src/audio/`). The project ships no audio files.

| Sound | Source | License |
| --- | --- | --- |
| Background music (drone + wind chimes, D major pentatonic) | Generated at runtime, `src/audio/garden-music.ts` | Original, part of this project |
| Water pouring and drops | Generated at runtime (filtered noise, sine drops), `src/audio/sound-engine.ts` | Original, part of this project |
| Shears snip | Generated at runtime (band-passed noise clicks) | Original, part of this project |
| Planting / growth / bloom chimes, singing bowl | Generated at runtime (sine partials + synthetic reverb) | Original, part of this project |

## Voice guide

The firefly's voice uses the **speech synthesis built into the viewer's device** through the
Web Speech API (`src/audio/voice.ts`). No voice recordings are distributed with the app.
Every spoken line is also shown as an English subtitle, so the guide works on devices
without speech voices.

## 3D models and UI

The bonsai (one model per stage: seed pot, sprout, young, mature, in bloom, with
snow, fallen leaves and a puddle) is original, modelled in Blender for this project
(`public/models/bonsai_*.glb`, low poly, under 5,000 triangles each). So is the forest
around the garden (`public/models/forest.glb`, about 2,400 triangles, vertex colours,
no textures). Every other model
is procedural geometry written for this project (`src/scene-assets/`), as are the
bonsai's glowing shoots and healthy branches. UI uses the IWSDK UIKitML toolkit. No
third-party logos or trademarks are used.

## Libraries

- [Immersive Web SDK (IWSDK)](https://iwsdk.dev) and Three.js, under their own open-source licenses.
