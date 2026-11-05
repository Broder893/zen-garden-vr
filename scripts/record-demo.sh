#!/usr/bin/env bash
# Plays the whole experience in the XR emulator with scripted hands and records
# one clip per scene into artifacts/ (01-arrive-and-plant.webm ... 07-return-new-flower.webm).
#
# Needs the dev server with browser automation:
#   npx @iwsdk/cli dev up --allow-browser-automation   (or: dev restart --allow-browser-automation)
# Then:  npm run demo:record
#
# The device voice is not recorded (it is system speech, not Web Audio);
# music, sounds and the in-scene subtitles are.
set -euo pipefail
cd "$(dirname "$0")/.."

# The CLI reports failures in its JSON, not always in its exit code: stop on them.
cli() {
  local out
  out=$(npx --no-install @iwsdk/cli "$@" 2>&1) || { echo "$out" >&2; exit 1; }
  if grep -q '"ok": false' <<<"$out"; then echo "$out" >&2; exit 1; fi
  printf '%s\n' "$out"
}
say() { printf '\n[demo] %s\n' "$*"; }
play() { cli xr run-sequence --input-json "$(cat ".iwsdk-scripts/demo/$1.json")" --timeout 90000 >/dev/null; }
pause() { sleep "$1"; }
# After a navigation the command bridge reconnects: wait until it is ready again.
ready() {
  for _ in $(seq 1 40); do
    npx --no-install @iwsdk/cli dev status 2>/dev/null | grep -q '"browserCommandReady": true' && return 0
    sleep 1.5
  done
  echo "browser bridge not ready" >&2; exit 1
}
goto() { GOTO_QS="$1" cli browser run .iwsdk-scripts/goto.mjs >/dev/null; sleep 4; ready; sleep 4; }
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
rec_start() { REC=start cli browser run .iwsdk-scripts/record.mjs >/dev/null; }
rec_stop() { REC=stop REC_NAME="$1" cli browser run .iwsdk-scripts/record.mjs | grep -o '"file": "[^"]*"' || true; }
# Poke a Comfort panel button with the left fingertip (element id from public/ui/comfort.uikitml).
poke() { cli xr run-sequence --input-json "{\"device\":\"hand-left\",\"body\":\"auto\",\"steps\":[{\"target\":\"$1\",\"press\":{}}]}" --timeout 45000 >/dev/null; }
# Reads a value from the running app (dev builds expose window.__zen).
js() { EVAL="$1" cli browser run .iwsdk-scripts/eval.mjs | python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin)["data"]["result"]["value"]))'; }
# Pokes a button until the app state matches (a passing hand can toggle the panel).
poke_until() { for _ in 1 2 3; do [ "$(js "$2")" = true ] && return 0; poke "$1"; pause 0.6; done; [ "$(js "$2")" = true ]; }
rest_left() { cli xr run-sequence --input-json '{"device":"hand-left","steps":[{"position":{"x":-0.25,"y":0.72,"z":0.08},"anchor":"wrist","duration":0.8}]}' --timeout 30000 >/dev/null; }
entity() { cli ecs find --input-json "{\"withComponents\":[\"$1\"]}" | grep -o '"entityIndex": [0-9]*' | head -1 | grep -o '[0-9]*'; }

# Accessibility clip: Comfort panel, high contrast, then picking up and pouring
# with "hold to select" (no pinch). Settings are put back to default at the end.
comfort_clip() {
  say "Comfort settings and hold to select"
  look '{"x":-0.25,"y":0.95,"z":-0.4}'
  rec_start
  pause 2
  poke_until comfort-open '__zen.comfort.open'; pause 1
  poke_until contrast-on '__zen.comfort.settings.highContrast'; pause 1.5
  poke_until dwell-on '__zen.comfort.settings.dwell'; pause 1.5
  poke_until comfort-open '!__zen.comfort.open'; pause 0.5
  rest_left
  look '{"x":0.1,"y":0.9,"z":-0.5}'
  play 7-dwell-can; pause 2
  rec_stop 08-comfort-hold-to-select
  poke_until comfort-open '__zen.comfort.open'
  poke_until contrast-off '!__zen.comfort.settings.highContrast'
  poke_until dwell-off '!__zen.comfort.settings.dwell'
  poke_until comfort-open '!__zen.comfort.open'
  rest_left
}

# A breathing break, offered at once (dev builds expose __zen.breaks.inviteNow).
# With a young tree the rhythm is the simple one: about 45 s in all.
break_clip() {
  say "A breathing break"
  look '{"x":0,"y":0.95,"z":-0.6}'
  rec_start
  js '__zen.breaks.inviteNow()' >/dev/null
  pause 46
  rec_stop 09-breathing-break
}

if [ "${1:-}" = "break" ]; then
  # Only the breathing break clip: npm run demo:record -- break
  goto ''
  enter
  seat
  break_clip
  exit 0
fi

if [ "${1:-}" = "comfort" ]; then
  # Only the accessibility clip: npm run demo:record -- comfort
  goto ''
  enter
  seat
  comfort_clip
  exit 0
fi

# One short clip per scene: easier to edit, and each recording is released
# from memory when it stops (one long take can exhaust the page's memory).
say "First visit"
goto '?fresh'
enter
seat
rec_start; pause 5; play 1-seed; pause 3; rec_stop 01-arrive-and-plant
rec_start; play 2-water; pause 5; rec_stop 02-water-and-grow
break_clip
rec_start; play 3-prune-young; pause 1; play 2-water; pause 4; rec_stop 03-prune-and-grow
rec_start; play 4-prune-mature; pause 1; play 2-water; pause 5; rec_stop 04-prune-and-bloom

say "Short breathing session (2 breaths for the video)"
STONE=$(entity MeditationStone)
cli ecs set-component --input-json "{\"entityIndex\":$STONE,\"componentId\":\"MeditationStone\",\"field\":\"breaths\",\"value\":2}" >/dev/null
rec_start; play 5-stone; look '{"x":0,"y":1.0,"z":-0.5}'; pause 33; rec_stop 05-breathe

say "The firefly follows the hand"
rec_start; play 6-hand-play; pause 2; rec_stop 06-firefly-follows-hand

comfort_clip

say "Coming back (a new flower)"
goto '?nextvisit'
enter
seat
rec_start
pause 6
look '{"x":-0.25,"y":0.8,"z":-0.65}'   # towards the back-left, where the first flower grows
pause 5
look '{"x":0,"y":0.95,"z":-0.6}'
pause 3
rec_stop 07-return-new-flower

say "Done. Clips are in artifacts/ (01- to 09-*.webm)."
