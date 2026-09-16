#!/usr/bin/env bash
# Per-scene device angles, rendered for every language/theme combination.
#
# One lighting preset and one camera preset hold the set together; the device
# itself is turned differently in every scene so the page does not read as the
# same photograph eight times. The two band crops (focus, session-summary) sit
# closest to frontal on purpose: a strongly yawed device inside a tight
# letterbox converges too hard and its dials stop being readable.
#
# Renders run three at a time — serially this is about ninety minutes.
set -u
STUDIO=${FORM_STUDIO:-/home/ubuntu/projects/form-iphone-studio}
CFG=${LANDING_SCENE:-$(cd "$(dirname "$0")/../../docs/design/plan-054-landing-prototype/render" && pwd)/scene.json}
SRC=${LANDING_SRC:-/tmp/landing-src}
OUT=${LANDING_OUT:-/tmp/landing-render}
mkdir -p "$OUT"

#     scene               ry    rx   rz   fov
ANGLES="
entry-hub         -8   2  -1   35
recommend-result  12  -1   1.5 34
today-ready        7  -1   0   33
program-overview -14   3  -2   36
focus             -4   1   0.5 30
why-this-weight   15  -2   2   36
session-summary  -10   4  -1   34
exercise-chart    11   2   1.5 35
"

jobs_file=$(mktemp)
while read -r name ry rx rz fov; do
  [ -z "${name:-}" ] && continue
  for lang in en pt; do for theme in light dark; do
    echo "$name-$lang-$theme $ry $rx $rz $fov" >> "$jobs_file"
  done; done
done <<< "$ANGLES"

run_one () {
  set -- $1
  local file=$1 ry=$2 rx=$3 rz=$4 fov=$5
  [ -f "$SRC/$file.png" ] || { echo "missing source $file"; return; }
  node "$STUDIO/bin/form-studio.mjs" render "$SRC/$file.png" \
    --config "$CFG" \
    --rotate-y "$ry" --rotate-x "$rx" --rotate-z "$rz" --fov "$fov" \
    --fit fill --resolution 2160 --transparent --timeout 240000 \
    -o "$OUT/$file.png" >"$OUT/$file.log" 2>&1 \
    && echo "ok $file" || echo "FAIL $file"
}
export -f run_one; export STUDIO CFG SRC OUT

cd "$STUDIO"
xargs -a "$jobs_file" -d '\n' -P 3 -I{} bash -c 'run_one "{}"'
rm -f "$jobs_file"
echo RENDERDONE
