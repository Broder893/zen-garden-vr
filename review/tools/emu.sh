# Emulator helpers for the review agents (dev only). Usage:  source review/tools/emu.sh
# One emulator: only the agent that was told "the emulator is yours now" may use these.
cd /Users/flaviomarin/Documents/zen-garden-vr
S=/Users/flaviomarin/Documents/zen-garden-vr/artifacts/review/.state; mkdir -p "$S"
cli() {
  local out
  out=$(npx --no-install @iwsdk/cli "$@" 2>&1) || { echo "$out" >&2; exit 1; }
  if grep -q '"ok": false' <<<"$out"; then echo "$out" >&2; exit 1; fi
  printf '%s\n' "$out"
}
ready() {
  for _ in $(seq 1 40); do
    npx --no-install @iwsdk/cli dev status 2>/dev/null | grep -q '"browserCommandReady": true' && return 0
    sleep 1.5
  done
  echo "browser bridge not ready" >&2; exit 1
}
goto() { GOTO_QS="$1" cli browser run .iwsdk-scripts/goto.mjs >/dev/null; sleep 4; ready; sleep 4; }
# Same, with the WebGL texture meter installed for that page load.
goto_metered() { GOTO_QS="$1" cli browser run .iwsdk-scripts/texture-meter.mjs | grep -q '"installed": true' || { echo "texture meter not installed" >&2; exit 1; }; sleep 4; ready; sleep 4; }
enter() {
  for _ in 1 2 3 4 5; do
    npx --no-install @iwsdk/cli xr enter --input-json '{}' 2>/dev/null | grep -q '"success": true' && return 0
    sleep 2; ready
  done
  echo "could not enter XR" >&2; exit 1
}
seat() {
  cli xr set-input-mode --input-json '{"mode":"hand"}' >/dev/null
  cli xr set-transform --input-json '{"device":"headset","position":{"x":0,"y":1.2,"z":0}}' >/dev/null
  cli xr look-at --input-json '{"device":"headset","target":{"x":0,"y":0.95,"z":-0.6}}' >/dev/null
}
look() { cli xr look-at --input-json "{\"device\":\"headset\",\"target\":$1}" >/dev/null; }
js() { EVAL="$1" cli browser run .iwsdk-scripts/eval.mjs >/dev/null; }
value() { EVAL="$1" cli browser run .iwsdk-scripts/eval.mjs | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["result"]["value"])'; }
entity() { cli ecs find --input-json "{\"withComponents\":[\"$1\"]}" | grep -o '"entityIndex": [0-9]*' | head -1 | grep -o '[0-9]*'; }
set_bonsai() { cli ecs set-component --input-json "{\"entityIndex\":$B,\"componentId\":\"Bonsai\",\"field\":\"$1\",\"value\":$2}" >/dev/null; }
sample() { cli browser run .iwsdk-scripts/budget-sample.mjs | python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin)["data"]["result"]))'; }
worst_garden() {
  js "localStorage.setItem('zen-garden-vr/shared', JSON.stringify({v:1, garden: crypto.randomUUID(), introShown: true, pending: 0, cache: {day: new Date().toISOString().slice(0,10), today: 40, gardens: 9, total: 400}}))"
  js "localStorage.setItem('zen-garden-vr/save', JSON.stringify({v: 2, planted: true, stage: 4, xp: 400, water: 1, prunedMask: 255, visits: 8, meditations: 0, breaks: 0, lastGiftDay: (d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate())(new Date()), stress: 0, overwater: 0, stumpMask: 0, lastVisitAt: Date.now(), savedAt: Date.now()}))"
  goto_metered "$1"; enter; seat; sleep 3
  B=$(entity Bonsai)
  set_bonsai prunedMask 255; set_bonsai water 1
  # New unlocks wait for closed eyes (src/eyelids.ts): close them a moment so they land.
  js "__zen.lids.holdFor('test', 1)"
  sleep 5
}
save_dev() { goto ""; SAVED=$(value "btoa(unescape(encodeURIComponent(JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('zen-garden-vr/') && k !== 'zen-garden-vr/sand').map(k => [k, localStorage.getItem(k)]))))))"); echo "$SAVED" > "$S/saved.b64"; }
restore_dev() { SAVED=$(cat "$S/saved.b64"); js "(Object.keys(localStorage).filter(k => k.startsWith('zen-garden-vr/') && k !== 'zen-garden-vr/sand').forEach(k => localStorage.removeItem(k)), Object.entries(JSON.parse(decodeURIComponent(escape(atob('$SAVED'))))).forEach(([k, v]) => localStorage.setItem(k, v)), (() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (!String(k).startsWith('zen-garden-vr/')) set.call(this, k, v); }; })())"; goto ""; }
# A demo gesture from .iwsdk-scripts/demo/<name>.json (1-seed, 2-water, 3-prune-young, 4-prune-mature, 5-stone, ...), head kept still.
play() { cli xr run-sequence --input-json "$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); d.update(gaze="fixed"); print(json.dumps(d))' ".iwsdk-scripts/demo/$1.json")" --timeout 90000 >/dev/null; }
# until_js 'JS expression' [tries]: waits (0.4 s steps) until it is true.
until_js() { for _ in $(seq 1 ${2:-150}); do [ "$(value "$1")" = True ] && return 0; sleep 0.4; done; echo "timeout: $1" >&2; return 1; }
# shot NAME DIR [FOV]: a 3D-only still of the left eye (1800x1200) into DIR (relative to the repo), e.g. shot a artifacts/review/x 70
shot() { STILL_NAME="$1" STILL_DIR="$2" STILL_FOV="${3:-70}" STILL_SIZE=1800x1200 cli browser run .iwsdk-scripts/still.mjs >/dev/null; echo "shot $2/$1.png"; }
# small PNG JPG [WIDTH]: a downscaled copy to look at (read the JPG, never the full PNG).
small() { python3 -c "from PIL import Image; import sys; im=Image.open(sys.argv[1]).convert('RGB'); w=int(sys.argv[3]); im.resize((w, int(im.height*w/im.width))).save(sys.argv[2], quality=82)" "$1" "$2" "${3:-900}"; }
pose() { cli xr set-transform --input-json "{\"device\":\"headset\",\"position\":$1}" >/dev/null; look "$2"; }
