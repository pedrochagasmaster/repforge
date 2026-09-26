# Round-2 renders

New app renders for the round-2 candidates, made the way the shipped landing
renders are (see `assets/brand/README.md`): the real app draws every pixel from
a saved state, and Form iPhone Studio frames it with the Plan 054 scene
(`docs/design/plan-054-landing-prototype/render/scene.json`). Nothing is redrawn.

| Band | App state | Used by |
| --- | --- | --- |
| `focus-add` / `-hold` / `-reduce` | S's three engine cases (`engine-cases.mjs`), one session logged a week ago | S ledger (swaps with the segment), V worked example |
| `exchart-six` | U's six-week block (`six-weeks.mjs`) | U, after the last week |
| `paste-send` | First run → Track my current program, the round-1 coach message pasted | U, V hand-off |
| `paste-review` | The same, with an assistant reply pasted (authored, in the prompt's shape) | S, U, V hand-off |
| `hub-own` | First run → Build my program → Bring or build your own opened | U, V hand-off |

The landing shows bands, not whole phones, for two reasons:

- **The dynamic island.** Every band starts below it, so no content is clipped under it.
- **The PT load dial prints `62.5`.** `app.js` writes the Focus dial's value with `String(value)`, so
  Portuguese shows a dot there while the cue line says `62,5`. The focus bands stop at the cue line.

## Rebuild

```bash
python3 -m http.server 8000 &                         # repo root
(cd test && REPFORGE_URL=http://localhost:8000/ node ../docs/design/landing-candidates/round-2/render/capture.mjs)
R2_SRC=/tmp/r2-src R2_RENDER=/tmp/r2-render bash docs/design/landing-candidates/round-2/render/render.sh
python3 docs/design/landing-candidates/round-2/render/bands.py
```

`capture.mjs` writes each screenshot with a sidecar JSON of the rows its band keeps, found by the
text the app renders. `render.sh` renders through Form Studio (about 80 s each on this machine).
`bands.py` renders a red-line calibration screen once per device angle, maps the recorded rows
through it, writes `../assets/*.webp` (720 px wide, alpha) and updates `ASSETS` in `../index.html`.
Pillow is the only non-repo dependency, and only for this step.
