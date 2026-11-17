# Tools used to make Bloom Break's assets

Scripts that generated the project's own assets. They are not part of the web app.

- `blender/` — Blender (bpy) scripts for the low-poly models in `public/models/`:
  `gen_variants.py` + `shoots_mod.py` + `export_glb.py` build the five bonsai stages
  (with seasonal pruning shoots and cut points `cut_NN`); `gen_forest2.py` builds `forest.glb`
  (`gen_forest.py` and `gen_bonsai.py` are the first drafts). Run with Python 3 and `pip install bpy`.
- `voice/` — generation of the guide's voice lines in `public/voices/` and of the video narration,
  with Kokoro TTS (Apache 2.0, model kokoro-v1.0, voices `af_nicole` and `am_puck`) and ffmpeg.
- `video/` — the demo video edit (ffmpeg + Pillow): `mkseg3.py` writes the shot list,
  `edit3.py` assembles clips, captions, narration and dissolves; `gallery.py` makes the Devpost images.
  Fonts: Shippori Mincho and Quicksand (SIL Open Font License), Inter.

Paths inside the scripts point to the machine where they were run; adjust them before reuse.
