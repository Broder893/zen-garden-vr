#!/usr/bin/env bash
# Rendering budget check on the Quest 3 profile of the XR emulator (IWER device
# "Meta Quest 3", set in iwsdk.config.json). Plays the heaviest moments of the
# garden and fails if any goes over the budget:
#   draw calls per eye  <= MAX_CALLS     (80)
#   triangles per eye   <= MAX_TRIS      (100000)
#   texture memory (MB) <= MAX_TEX_MB    (64: every live GPU texture, measured at the
#                                         WebGL uploads: fonts, environment maps, and the
#                                         emulator's controller models, about 43 MB, which a
#                                         Quest used with hands never loads; shown as "ctrl")
# These are this project's own conservative budgets for WebXR in the Quest
# browser (Meta's native guidance is higher). Measured at quality High (the
# worst case) and at Medium (where Auto starts on a device it has not measured).
# The framebuffer column is the emulator's, not the headset's: resolution does not
# change draw calls or triangles, and the texture total excludes the XR framebuffer.
#
# Needs the dev server with browser automation:
#   npx @iwsdk/cli dev up --allow-browser-automation
# Then:  npm run check:budget
set -euo pipefail
cd "$(dirname "$0")/.."

MAX_CALLS=${MAX_CALLS:-80}
MAX_TRIS=${MAX_TRIS:-100000}
MAX_TEX_MB=${MAX_TEX_MB:-64}

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

# The check rewrites the dev garden (level, shared tree counts): keep the developer's
# own saved state (every zen-garden-vr/ key but the large sand image, which the check
# never touches) and put it back at the end.
goto ""
SAVED=$(value "btoa(unescape(encodeURIComponent(JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('zen-garden-vr/') && k !== 'zen-garden-vr/sand').map(k => [k, localStorage.getItem(k)]))))))")
device=$(cli xr status | grep -o '"deviceName": "[^"]*"' | head -1 | cut -d'"' -f4)
echo "[budget] emulated device: ${device:-unknown}"
RESULTS=$(mktemp)

# The heaviest garden: every unlock, the tree in bloom, the shared tree in full
# blossom (counts seeded on this device), at night in the rain.
worst_garden() {
  js "localStorage.setItem('zen-garden-vr/shared', JSON.stringify({v:1, garden: crypto.randomUUID(), introShown: true, pending: 0, cache: {day: new Date().toISOString().slice(0,10), today: 40, gardens: 9, total: 400}}))"
  goto_metered "$1"; enter; seat; sleep 3
  B=$(entity Bonsai)
  set_bonsai planted true; set_bonsai xp 400; set_bonsai prunedMask 255; set_bonsai water 1
  # New unlocks wait for closed eyes (src/eyelids.ts): close them a moment so they land.
  js "__zen.lids.holdFor('test', 1)"
  sleep 5
}

for quality in high medium; do
  # High is the worst case; Medium is where Auto starts on a new device.
  qs="time=night&weather=rain&debug&texmeter"
  if [ "$quality" = high ]; then qs="$qs&quality=high"; else qs="$qs&quality=medium"; fi
  worst_garden "?$qs"
  for view in seated tree basin closed; do
    case $view in
      seated) seat ;;
      tree) look '{"x":1.0,"y":1.5,"z":-2.6}' ;;
      basin) look '{"x":0.6,"y":0.9,"z":-0.5}' ;;
      # Seated with the eyes closed: the eyelid quad is drawn over everything.
      closed) seat; js "__zen.lids.hold('test', 0)" ;;
    esac
    sleep 2
    echo "{\"quality\":\"$quality\",\"view\":\"$view\",\"s\":$(sample)}" >> "$RESULTS"
    if [ "$view" = closed ]; then js "__zen.lids.release('test')"; fi
  done
done
# Put the developer's garden back. Writes to garden keys are then ignored in this page,
# so its save on leaving cannot overwrite what was restored; the reload starts clean.
js "(Object.keys(localStorage).filter(k => k.startsWith('zen-garden-vr/') && k !== 'zen-garden-vr/sand').forEach(k => localStorage.removeItem(k)), Object.entries(JSON.parse(decodeURIComponent(escape(atob('$SAVED'))))).forEach(([k, v]) => localStorage.setItem(k, v)), (() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (!String(k).startsWith('zen-garden-vr/')) set.call(this, k, v); }; })())"
goto ""

python3 - "$RESULTS" "$MAX_CALLS" "$MAX_TRIS" "$MAX_TEX_MB" <<'PY'
import json, sys
path, max_calls, max_tris, max_tex = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), float(sys.argv[4])
rows = [json.loads(l) for l in open(path) if l.strip()]
over = []
print(f"\n{'quality':8} {'view':7} {'level':7} {'calls':>6} {'tris':>8} {'tex':>4} {'texMB':>6} {'ctrl':>5} {'progs':>5}  framebuffer")
for r in rows:
    s = r['s']
    if 'error' in s:
        print(r['quality'], r['view'], s['error']); over.append('error'); continue
    fb = 'x'.join(map(str, s['framebuffer'])) if s.get('framebuffer') else '-'
    print(f"{r['quality']:8} {r['view']:7} {s['quality']:7} {s['calls']:>6} {s['triangles']:>8} {s['textures']:>4} {s['textureMB']:>6} {s.get('controllerMB', 0):>5} {s['programs']:>5}  {fb}")
    if not s.get('inVR'): over.append(f"{r['quality']}/{r['view']}: not in XR")
    if s['calls'] > max_calls: over.append(f"{r['quality']}/{r['view']}: {s['calls']} draw calls > {max_calls}")
    if s['triangles'] > max_tris: over.append(f"{r['quality']}/{r['view']}: {s['triangles']} triangles > {max_tris}")
    if not s.get('metered'): over.append(f"{r['quality']}/{r['view']}: texture meter missing")
    if s['textureMB'] > max_tex: over.append(f"{r['quality']}/{r['view']}: {s['textureMB']} MB textures > {max_tex}")
print(f"\nbudget per eye: <= {max_calls} draw calls, <= {max_tris} triangles; textures <= {max_tex} MB")
print("ctrl = the emulator's controller models, inside texMB (not loaded on a Quest used with hands)")
if over:
    print("OVER BUDGET:\n  " + "\n  ".join(over)); sys.exit(1)
print("all within budget")
PY
