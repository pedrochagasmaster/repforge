#!/usr/bin/env bash
# Renders the round-2 captures through Form iPhone Studio with the same scene
# as the shipped landing renders (docs/design/plan-054-landing-prototype/render/scene.json:
# iphone15, Soft Studio, transparent, 2160). Band scenes sit near frontal so
# the rows the page crops to stay readable; yaw alternates so neighbours differ.
#
#   R2_SRC=/tmp/r2-src R2_RENDER=/tmp/r2-render bash render.sh [scene ...]
set -u
STUDIO=${FORM_STUDIO:-/home/ubuntu/projects/form-iphone-studio}
HERE=$(cd "$(dirname "$0")" && pwd)
CFG=${R2_SCENE:-$HERE/../../../plan-054-landing-prototype/render/scene.json}
SRC=${R2_SRC:-/tmp/r2-src}
OUT=${R2_RENDER:-/tmp/r2-render}
mkdir -p "$OUT"

#  output          source         ry   rx   rz   fov  extra flags
SCENES="
focus-add        focus-add      -4   1   0.5  30
focus-hold       focus-hold      4   1  -0.5  30
focus-reduce     focus-reduce   -4   1   0.5  30
exchart-six      exchart-six     3   1   0    30
paste-send       paste-send     -3   1   0.5  30
paste-review     paste-review    3   1  -0.5  30
hub-own          hub-own        -3   1   0.5  30
hero-hold-a      focus-hold    -16   4  -2    34   --camera-y 0.6
hero-hold-b      focus-hold     14  -3   2    38   --lighting Warm
"
WANT=" ${*:-} "
jobs_file=$(mktemp)
while read -r out src ry rx rz fov extra; do
  [ -z "${out:-}" ] && continue
  [ "$WANT" != "  " ] && [[ "$WANT" != *" $out "* ]] && continue
  for lang in ${LANGS:-pt en}; do for theme in ${THEMES:-light dark}; do
    echo "$out-$lang-$theme|$src-$lang-$theme|$ry|$rx|$rz|$fov|$extra" >> "$jobs_file"
  done; done
done <<< "$SCENES"

run_one () {
  IFS='|' read -r out src ry rx rz fov extra <<< "$1"
  [ -f "$SRC/$src.png" ] || { echo "missing source $src"; return; }
  # shellcheck disable=SC2086
  node "$STUDIO/bin/form-studio.mjs" render "$SRC/$src.png" --config "$CFG" --no-build \
    --rotate-y "$ry" --rotate-x "$rx" --rotate-z "$rz" --fov "$fov" $extra \
    --fit fill --resolution 2160 --transparent --timeout 300000 \
    -o "$OUT/$out.png" > "$OUT/$out.log" 2>&1 && echo "ok $out" || echo "FAIL $out"
}
export -f run_one; export STUDIO CFG SRC OUT
cd "$STUDIO"
xargs -a "$jobs_file" -d '\n' -P "${PARALLEL:-3}" -I{} bash -c 'run_one "{}"'
rm -f "$jobs_file"
echo RENDERDONE
