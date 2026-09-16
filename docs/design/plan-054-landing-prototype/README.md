# Plan 054 — sectioned landing prototype

A standalone, owner-reviewed prototype of the first-run landing. It is **not
wired into `#firstRun`**: nothing in `index.html`, `app.js`, `styles.css`,
`sw.js` or the i18n catalogs is touched by this directory. Integration is a
separate change.

Serve the repository root over HTTP and open
`docs/design/plan-054-landing-prototype/`. The header carries two
prototype-only toggles, **PT/EN** and **Dark/Light**, so all four
language/theme combinations are reviewable in one page. In the app these come
from `settings.lang` and `repforge_ui_v1`.

## The design

One idea per section, one whole uncropped render per section, and a device
framed differently in every one. The scroll runs hero → six beats → close:

| Beat | Screen | Stage |
| --- | --- | --- |
| 01 Getting started | entry hub + recommended program | paired, both whole |
| 02 The program | program overview | portrait, cropped at the foot |
| 03 The prescription | focused set | landscape band, closes on the foot |
| 04 The reasoning | "why this weight" sheet | square, cropped at the head |
| 05 The record | saved session summary | landscape band, opens on the head |
| 06 Over time | strength trend | portrait, whole |

The variety comes from the shape of the plate, not from sliding a device
sideways inside it — an off-centre phone in a wide plate reads as bad centring.
The two band crops letterbox into one region of a screen, which makes the UI
larger while the section gets shorter. Beat 01 is the only stage that does not
crop, and beat 06 the only single device shown entire.

`--stage` is `color-mix(in srgb, var(--ink) 5%, var(--bg))`, so the plate
darkens on paper and lightens on near-black from one declaration. That is what
keeps the device separated from the page in dark mode.

## Reproducing the renders

Three steps, all offline.

```bash
# 1. serve the app itself (the capture reads the real product, not a mock)
python3 -m http.server 8111

# 2. capture 32 source screenshots: 8 scenes x EN/PT x light/dark
REPFORGE_URL=http://127.0.0.1:8111/ node tools/landing-prototype/capture.mjs

# 3. render each through Form iPhone Studio (three at a time, ~30 min)
tools/landing-prototype/render.sh
```

### Why the sources are captured, not padded

The UI-screen catalog's PNGs are captured without safe-area insets, so content
starts at y=0 and the dynamic island lands on top of it. Padding them to fake an
inset does not work: a 780x1688 catalog shot already matches the screen's
aspect, so any inset has to come from scaling the content down, which leaves
~43px of dead paper on each side *inside* the screen — the visible gap between
the UI and the bezel.

`capture.mjs` instead intercepts `styles.css` and rewrites
`env(safe-area-inset-top/bottom)` to a real device's 59/34px, so **the app draws
its own insets** and the shot is full-bleed. Sources are 1290x2796, aspect
0.4614 against the iPhone 15's 0.4613, rendered with `--fit fill`. No
letterboxing.

### Why the fixture is its own

`tools/ui-screens/fixtures.mjs` exists to stress layout, and
`screens-app.mjs` logs `80 + i*5` kg into every exercise — which is how a
machine lateral raise ends up at 100 kg with "+87.5 kg over your best". Correct
for catching layout bugs, wrong for a landing page.

`fixture.mjs` is one intermediate lifter: fifteen exercises across three
full-body days, twelve logged sessions over four weeks, per-exercise load
ladders. Every exercise is a real `exercises.js` entry, so its Portuguese name
is the shipped catalog's translation rather than something invented here.

### Render configuration

All 32 renders share `render/scene.json` — the configuration already accepted
for `landing-workout-*.webp` (iphone15, Soft Studio, transparent, 9:16, 2160,
no ground). Only the device's own orientation varies, so the set reads as one
photo session:

| Scene | rotate-y | rotate-x | rotate-z | fov |
| --- | --- | --- | --- | --- |
| entry-hub | -8 | 2 | -1 | 35 |
| recommend-result | 12 | -1 | 1.5 | 34 |
| today-ready | 7 | -1 | 0 | 33 |
| program-overview | -14 | 3 | -2 | 36 |
| focus | -4 | 1 | 0.5 | 30 |
| why-this-weight | 15 | -2 | 2 | 36 |
| session-summary | -10 | 4 | -1 | 34 |
| exercise-chart | 11 | 2 | 1.5 | 35 |

The two band crops (`focus`, `session-summary`) sit closest to frontal on
purpose: a strongly yawed device inside a tight letterbox converges too hard and
its dials stop being readable, which is the whole point of those sections.

Renders are cropped to one shared 903x1832 frame — the union of every angle's
bounding box — so a more-rotated device does not end up smaller than the others.

## Verification

```bash
node tools/landing-prototype/audit.mjs   # 200% text, forced-colors, keyboard, headings
node tools/landing-prototype/pair.mjs    # beat 01: per-edge clipping and overlap
```

At the reviewed state: no horizontal overflow at 320/360/390/430/768/1280, no
clipping at 200% text, every control keyboard-reachable with a visible ring, one
`h1`, no image without an `alt`, and beat 01's two devices whole at every width
with a steady 24% overlap.

## Known, not fixed here

- **`"Prioritizes Prioritize muscle growth."`** on the recommendation result —
  the label and the value are concatenated without grammar agreement, for every
  `desiredResult`. Visible in the beat 01 render. An app bug, not a prototype one.
- **`assets/brand/mark.png` halos on dark.** 1,489 of its pixels are
  semi-transparent and 86% of those are tinted `#EFE5DF`, the exact `GROUND`
  colour `tools/build-brand-mark.mjs` strips at SVG level but cannot un-blend
  from the rasterised edge.
- **U+2192 is not in the shipped Plex subset.** `styles.css` documents this and
  solves it with the `--arrow` mask, which this prototype reuses. Note that
  `i18n-en.json` and `i18n-pt.json` each still contain two literal `→`.
- Assets total ~2.4 MB across 32 files. If this ships, only the hero pair
  belongs in the `sw.js` precache; the rest should stay lazy.
