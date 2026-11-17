#!/usr/bin/env bash
# Dev tool (not part of the app): records the demo video clips v01-v17 into
# artifacts/video/ as 1920x1080 .webm with the game's audio (music, sounds,
# ambience, recorded voices), on the emulator's Meta Quest 3 profile.
#
#   npx @iwsdk/cli dev up --allow-browser-automation
#   bash scripts/record-extra.sh            # every clip
#   bash scripts/record-extra.sh v03 v07    # some clips
#
# Each clip loads the app and enters XR through .iwsdk-scripts/open-xr.mjs,
# which holds the page at 1920x1080 meanwhile: the XR view keeps that size for
# the whole take even when the window is smaller. Recording uses record.mjs
# (as npm run demo:record), XR input the CLI with the scripted hands of
# .iwsdk-scripts/demo/. Raw takes land in artifacts/video-raw/ with a
# cut list ("take start duration" per line); ffmpeg trims and joins them into
# the clip. Console errors of each take are saved next to it. The developer's
# saved garden is backed up first and restored at the end.
set -euo pipefail
cd "$(dirname "$0")/.."
RAW=artifacts/video-raw
OUT=artifacts/video
ALL="v01 v02 v03 v04 v05 v06 v07 v08 v09 v10 v11 v12 v13 v14 v15 v16 v17"

mkdir -p "$RAW" "$OUT"
cli() {
  local out
  out=$(npx --no-install @iwsdk/cli "$@" 2>&1) || { echo "$out" >&2; return 1; }
  if grep -q '"ok": false' <<<"$out"; then echo "$out" >&2; return 1; fi
  printf '%s\n' "$out"
}
# A JS expression in the app; prints its JSON value.
js() { EVAL="$1" cli browser run .iwsdk-scripts/eval.mjs | python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin)["data"]["result"]["value"]))'; }
now() { python3 -c 'import time; print(time.time())'; }
since() { python3 -c "print(round($(now) - $T0, 2))"; }
calc() { python3 -c "print(round($1, 2))"; }
# open QS [BEFORE]: reload the app with QS (after running BEFORE in it) and enter XR at 1920x1355
# (the Quest 3 view's own shape); record.mjs crops 1920x1080 from it, as in npm run demo:record.
open() { OPEN_VIEWPORT=1920x1355 OPEN_QS="$1" OPEN_BEFORE="${2:-}" cli browser run .iwsdk-scripts/open-xr.mjs --timeout 110000 >/dev/null; sleep 1; js "$HELPER" >/dev/null; }
seat() {
  cli xr set-input-mode --input-json '{"mode":"hand"}' >/dev/null
  cli xr set-transform --input-json '{"device":"headset","position":{"x":0,"y":1.2,"z":0}}' >/dev/null
  cli xr look-at --input-json '{"device":"headset","target":{"x":0,"y":0.95,"z":-0.6}}' >/dev/null
}
# The demo hands, with the head kept still (no quick turns to each target); a failed gesture ends the take.
play() { cli xr run-sequence --input-json "$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); d.update(gaze="fixed"); print(json.dumps(d))' ".iwsdk-scripts/demo/$1.json")" --timeout 90000 >/dev/null || { echo "gesture $1 failed" >&2; exit 1; }; }
poke() { cli xr run-sequence --input-json "{\"device\":\"hand-left\",\"body\":\"auto\",\"gaze\":\"fixed\",\"steps\":[{\"target\":\"$1\",\"press\":{}}]}" --timeout 45000 >/dev/null; }
poke_until() { for _ in 1 2 3; do [ "$(js "$2")" = true ] && return 0; poke "$1"; sleep 0.6; done; [ "$(js "$2")" = true ]; }
rest_left() { cli xr run-sequence --input-json '{"device":"hand-left","steps":[{"position":{"x":-0.25,"y":0.72,"z":0.08},"anchor":"wrist","duration":0.8}]}' --timeout 30000 >/dev/null; }
# Smooth head turns (eased, from where the head looks now) toward a point [x, y, z] over s seconds.
HELPER='(window.__rec = { turn(t, s) { const d = IWER_DEVICE, p = d.position, q = d.quaternion; const dx = t[0] - p.x, dy = t[1] - p.y, dz = t[2] - p.z; const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz)); const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2), cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2); const to = [cy * sp, sy * cp, -sy * sp, cy * cp]; const from = [q.x, q.y, q.z, q.w]; if (from[0] * to[0] + from[1] * to[1] + from[2] * to[2] + from[3] * to[3] < 0) for (let i = 0; i < 4; i++) to[i] = -to[i]; const t0 = performance.now(); const step = () => { const k = Math.min(1, (performance.now() - t0) / (s * 1000)); const e = k * k * (3 - 2 * k); const v = from.map((f, i) => f + (to[i] - f) * e); const n = Math.hypot(...v); if (q.set) q.set(v[0] / n, v[1] / n, v[2] / n, v[3] / n); else { q.x = v[0] / n; q.y = v[1] / n; q.z = v[2] / n; q.w = v[3] / n; } if (k < 1) setTimeout(step, 11); else if (done) done(); }; let done = null; step(); return new Promise((r) => (done = r)); }, async path(list) { for (const [t, s] of list) await this.turn(t, s); } }, true)'
# turn TARGET SECONDS: starts the turn and waits for it.
turn() { js "(__rec.turn($1, $2), true)" >/dev/null; sleep "$2"; }
# path '[[TARGET, SECONDS], ...]' TOTAL: several turns in a row, in the page (no pauses between them).
path() { js "(__rec.path($1), true)" >/dev/null; sleep "$2"; }
SAVE_GROWN="(localStorage.removeItem('zen-garden-vr/comfort'), localStorage.setItem('zen-garden-vr/shared', JSON.stringify({v:1, garden: crypto.randomUUID(), introShown: true, pending: 0, cache: {day: new Date().toISOString().slice(0,10), today: 40, gardens: 9, total: 400}})), localStorage.setItem('zen-garden-vr/save', JSON.stringify({v: 2, planted: true, stage: 4, xp: 400, water: WATER, prunedMask: 255, visits: 8, meditations: 1, breaks: 1, lastGiftDay: (d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate())(new Date()), stress: 0, overwater: 0, stumpMask: 0, lastVisitAt: Date.now(), savedAt: Date.now()})), true)"
grown() {  # a garden in bloom with every unlock and seven visit flowers
  open "$1&quality=high" "${SAVE_GROWN/WATER/${WATER:-1}}"; seat; sleep 6
}
# Errors the app logs during a take are collected in the page and saved with it.
ERRS='(window.__recErrs = [], window.__recHooked || (window.__recHooked = true, addEventListener("error", (e) => window.__recErrs.push(String(e.message))), addEventListener("unhandledrejection", (e) => window.__recErrs.push(String(e.reason))), ((orig) => { console.error = (...a) => { window.__recErrs.push(a.map(String).join(" ").slice(0, 300)); orig.apply(console, a); }; })(console.error)), true)'
rec_start() { js "$ERRS" >/dev/null; REC=start cli browser run .iwsdk-scripts/record.mjs >/dev/null; T0=$(now); }
# rec_stop TAKE OUTFILE "start dur" ["start dur"...]: the take, the clip file, its cut list.
rec_stop() {
  local take=$1 out=$2; shift 2
  REC=stop REC_NAME="video-raw/$take" cli browser run .iwsdk-scripts/record.mjs --timeout 110000 >/dev/null
  : > "$RAW/$take.cut"
  for seg in "$@"; do echo "$take $seg" >> "$RAW/$take.cut"; done
  echo "$out" > "$RAW/$take.out"
  js "window.__recErrs" > "$RAW/$take.errors.json"
}
fresh_lines() { js "(__zen.guide.eventLeft = 0, __zen.guide.restShown = 0, true)" >/dev/null; }
wait_for() { for _ in $(seq 1 "${2:-60}"); do [ "$(js "$1")" = true ] && return 0; sleep 0.3; done; return 0; }
# Trims the takes of a clip to its cut list and joins them (one file per clip).
cut() {
  local clip=$1 i=0 parts=() take s d
  while read -r take s d; do
    [ -z "$take" ] && continue
    ffmpeg -loglevel error -y -ss "$s" -i "$RAW/$take.webm" -t "$d" -r 30 \
      -c:v libvpx-vp9 -b:v 8M -deadline good -cpu-used 4 -row-mt 1 -c:a libopus -b:a 160k -ar 48000 \
      "$RAW/$clip.part$i.webm"
    parts+=("$RAW/$clip.part$i.webm"); i=$((i + 1))
  done < "$RAW/$clip.cut"
  local final; final=$(cat "$RAW/$clip.out")
  if [ ${#parts[@]} -eq 1 ]; then
    mv "${parts[0]}" "$OUT/$final"
  else
    : > "$RAW/$clip.list"
    for p in "${parts[@]}"; do echo "file '$(basename "$p")'" >> "$RAW/$clip.list"; done
    ffmpeg -loglevel error -y -f concat -safe 0 -i "$RAW/$clip.list" -c copy "$OUT/$final"
  fi
  echo "[record] $OUT/$final"
}

clip() {
case $1 in
  v01)  # dark, then the lids open on the garden at sunset, tree in bloom
    grown "?season=spring&time=sunset&weather=clear"
    js "(__zen.lids.hold('test', 0), __zen.lids.setNow(1), __zen.guide.restShown = 99, true)" >/dev/null; sleep 2
    rec_start; sleep 2
    js "(__zen.lids.release('test'), true)" >/dev/null; S=$(calc "$(since) - 1.6"); sleep 7.5
    rec_stop v01 v01-open.webm "$S 8" ;;

  v02)  # a slow look around from the seat
    grown "?season=spring&time=sunset&weather=clear"; js "(__zen.guide.restShown = 99, true)" >/dev/null; sleep 3
    rec_start; sleep 1
    path '[[[-2.2,0.6,-1.4],3.6],[[2.2,0.8,-1.6],5],[[0,0.95,-0.6],3.4]]' 0; S=$(calc "$(since) - 0.6"); sleep 12.5
    rec_stop v02 v02-look-around.webm "$S 12" ;;

  v03)  # from an empty save: the firefly, the ghost gesture, planting
    open '?fresh&season=spring&quality=high'; seat
    rec_start; sleep 1; S=$(since); sleep 7; play 1-seed; sleep 7
    rec_stop v03 v03-plant.webm "$S 20" ;;

  v04)  # lift the can, pour, the sprout grows
    open '?fresh&season=spring&quality=high'; seat; sleep 5; play 1-seed; sleep 4
    rec_start; sleep 0.5; S=$(since); play 2-water; sleep 9
    rec_stop v04 v04-water-grow.webm "$S 20" ;;

  v05)  # the shears cut the glowing shoots, the tree grows again
    open '?fresh&season=spring&quality=high'; seat; sleep 5; play 1-seed; sleep 3; play 2-water; sleep 5
    rec_start; sleep 0.5; S=$(since); play 3-prune-young; sleep 0.5; play 2-water; sleep 4
    rec_stop v05 v05-prune.webm "$S 20" ;;

  v06)  # the bloom
    open '?fresh&season=spring&quality=high'; seat; sleep 5; play 1-seed; sleep 3; play 2-water; sleep 5
    play 3-prune-young; sleep 0.5; play 2-water; sleep 5
    rec_start; sleep 0.5; play 4-prune-mature; S=$(since); play 2-water; sleep 6
    rec_stop v06 v06-bloom.webm "$(calc "$S - 1") 15" ;;

  v07)  # a breathing break: invitation, lids close, two breaths, open eyes, evening became night
    grown "?season=spring&time=sunset&weather=clear"; fresh_lines; sleep 1
    rec_start; sleep 0.5; S=$(since)
    js "(__zen.breaks.inviteNow(), true)" >/dev/null
    wait_for "__zen.meditation.active" 60
    # Two simple breaths (4 s in, 6 s out) for the video; the garden's level would choose 4-7-8.
    js "(__zen.meditation.pattern = {...__zen.meditation.pattern, inhale: 4, holdIn: 0, exhale: 6, holdOut: 0, breaths: 2}, true)" >/dev/null
    # A change queued for closed eyes: the evening turns to night, unseen.
    wait_for "__zen.lids.amount > 0.95" 40
    js "(__zen.dayNight.forced = 'night', __zen.dayNight.sinceCheck = 999, true)" >/dev/null
    wait_for "!__zen.meditation.active" 120
    sleep 4; E=$(since)
    rec_stop v07 v07-breath-break.webm "$S $(calc "$E - $S")" ;;

  v08|v09|v10|v11)  # the same tree in bloom and the same framing, one season each
    season=$(python3 -c "print({'v08':'spring','v09':'summer','v10':'autumn','v11':'winter'}['$1'])")
    grown "?season=$season&time=day&weather=clear"
    cli xr set-transform --input-json '{"device":"headset","position":{"x":-0.05,"y":1.05,"z":-0.12}}' >/dev/null
    cli xr look-at --input-json '{"device":"headset","target":{"x":-0.04,"y":0.92,"z":-1.3}}' >/dev/null
    sleep 9   # the resting line has faded
    rec_start; sleep 0.5; S=$(since); sleep 8.5
    rec_stop "$1" "$1-season-$season.webm" "$S 8" ;;

  v12)  # night, rain, fireflies
    grown "?season=summer&time=night&weather=rain"; sleep 10
    rec_start; sleep 0.5; S=$(since); sleep 8.5
    rec_stop v12 v12-night-rain.webm "$S 8" ;;

  v13)  # Comfort: high contrast, hold to select, the can pours by itself
    WATER=0.2 grown "?season=spring&time=day&weather=clear"
    cli xr look-at --input-json '{"device":"headset","target":{"x":-0.25,"y":0.95,"z":-0.4}}' >/dev/null
    rec_start; sleep 0.5; S=$(since); sleep 1
    poke_until comfort-open '__zen.comfort.open'; sleep 1
    poke_until contrast-on '__zen.comfort.settings.highContrast'; sleep 1.2
    poke_until dwell-on '__zen.comfort.settings.dwell'; sleep 1.2
    poke_until comfort-open '!__zen.comfort.open'; sleep 0.4
    rest_left
    turn '[0.1,0.9,-0.5]' 1.2
    play 7-dwell-can; sleep 2; E=$(since)
    rec_stop v13 v13-comfort.webm "$S $(calc "min(25, $E - $S)")" ;;

  v14)  # one hand (left), then gaze care (no hands: looking at a thing uses it)
    grown "?season=spring&time=day&weather=clear"
    cli xr look-at --input-json '{"device":"headset","target":{"x":-0.25,"y":0.95,"z":-0.4}}' >/dev/null
    rec_start; sleep 0.5; S=$(since)
    poke_until comfort-open '__zen.comfort.open'; sleep 0.6
    poke_until hands-left '__zen.comfort.settings.hands === "left"'; sleep 0.6
    poke_until comfort-open '!__zen.comfort.open'
    rest_left; turn '[-0.1,0.85,-0.5]' 1.2; sleep 2.5; E=$(since)
    rec_stop v14a v14-onehand-gaze.webm "$(calc "max($S, $E - 6)") $(calc "min(6, $E - $S)")"
    WATER=0.2 grown "?season=spring&time=day&weather=clear&input=none"
    cli xr look-at --input-json '{"device":"headset","target":{"x":0,"y":0.95,"z":-0.6}}' >/dev/null
    sleep 2; fresh_lines
    rec_start; sleep 0.5; S=$(since); turn '[0.27,0.82,-0.45]' 1.2; sleep 5.5; E=$(since)
    rec_stop v14b v14-onehand-gaze.webm "$S $(calc "min(6, $E - $S)")"
    cat "$RAW/v14a.cut" "$RAW/v14b.cut" > "$RAW/v14.cut"; echo v14-onehand-gaze.webm > "$RAW/v14.out" ;;

  v15)  # too much water: the tree droops; a breathing break brings it back
    grown "?season=spring&time=day&weather=clear"; fresh_lines
    rec_start; sleep 0.5; S=$(since)
    play 2-water; play 2-water; sleep 3; A=$(since)
    js "(__zen.breaks.inviteNow(), true)" >/dev/null
    wait_for "__zen.meditation.active" 60
    js "(__zen.meditation.pattern = {...__zen.meditation.pattern, inhale: 4, holdIn: 0, exhale: 6, holdOut: 0, breaths: 1}, true)" >/dev/null
    wait_for "__zen.lids.amount > 0.95" 40; C=$(since)
    wait_for "__zen.lids.amount < 0.9 && !__zen.lids.reasons.has('session') && !__zen.meditation.active" 180; O=$(since); sleep 6
    rec_stop v15 v15-wilted-recovery.webm "$(calc "max($S, $A - 10)") $(calc "min(10, $A - $S)")" "$(calc "$C - 4") 4" "$(calc "$O - 0.5") 6" ;;

  v16)  # coming back: a new flower, the daily gift, the level badge
    open '?nextvisit&season=spring&time=day&weather=clear&quality=high' "(localStorage.removeItem('zen-garden-vr/comfort'), localStorage.setItem('zen-garden-vr/save', JSON.stringify({v: 2, planted: true, stage: 4, xp: 395, water: 1, prunedMask: 255, visits: 4, meditations: 1, breaks: 1, lastGiftDay: 20200101, stress: 0, overwater: 0, stumpMask: 0, lastVisitAt: Date.now() - 86400000, savedAt: Date.now() - 86400000})), true)"
    rec_start; seat; S=$(since)
    sleep 6; turn '[-0.3,0.78,-0.75]' 1.6; sleep 4; turn '[0.44,0.9,-0.25]' 1.8; sleep 3; turn '[0,0.95,-0.6]' 1.6; sleep 1; E=$(since)
    rec_stop v16 v16-return.webm "$S $(calc "min(20, $E - $S)")" ;;

  v17)  # pour into the stone basin: the light flies to the shared tree, the count goes up
    grown "?season=spring&time=day&weather=clear"
    cli xr look-at --input-json '{"device":"headset","target":{"x":0.6,"y":0.9,"z":-0.6}}' >/dev/null; sleep 1
    rec_start; sleep 0.5; S=$(since); play 8-shared-water; turn '[1.5,1.6,-3.6]' 1.8; sleep 3; turn '[0.7,1.07,-0.52]' 1.5; sleep 2; E=$(since)
    rec_stop v17 v17-shared-tree.webm "$S $(calc "min(12, $E - $S)")" ;;
esac
}

js "JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('zen-garden-vr/') && k !== 'zen-garden-vr/sand').map(k => [k, localStorage.getItem(k)])))" > "$RAW/dev-garden.json"
clips=("$@"); [ ${#clips[@]} -eq 0 ] && read -r -a clips <<< "$ALL"
for c in "${clips[@]}"; do
  echo "[record] $c"
  if ( set -e; clip "$c" ); then cut "$c"; else echo "[record] $c FAILED"; fi
done
# Put the developer's garden back; garden writes are then ignored until the reload.
js "(Object.keys(localStorage).filter(k => k.startsWith('zen-garden-vr/') && k !== 'zen-garden-vr/sand').forEach(k => localStorage.removeItem(k)), Object.entries(JSON.parse($(cat "$RAW/dev-garden.json"))).forEach(([k, v]) => localStorage.setItem(k, v)), (() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (!String(k).startsWith('zen-garden-vr/')) set.call(this, k, v); }; })(), true)" >/dev/null
GOTO_QS='' cli browser run .iwsdk-scripts/goto.mjs >/dev/null
