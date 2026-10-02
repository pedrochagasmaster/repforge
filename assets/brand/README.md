# Brand art

Owner-licensed brand art only — nothing here ships without a
licence covering distribution. Like `icons/icon.svg`, files here are
generated output: a new version replaces the file wholesale, never an edit.

## `mark.png`

The Taurifer yoke with no paper under it, 192×192 (48 CSS px at 4×), drawn by
the landing header so the mark stands on the page instead of on a plate. It is
derived from `icons/icon.svg` — the source of truth — by dropping
that file's single full-bleed ground rect and rasterising the rest:

```
(cd test && npm ci && npx playwright install chromium)   # once
node tools/build-brand-mark.mjs
```

Re-run it when a new mark lands. Never hand-edit or hand-crop the output, and
never point the gate at `icons/icon.svg` instead: the app icon paints its own
warm ground, which reads as a tile against the app's paper.

## Sectioned landing renders (retired)

The Plan 054 landing used 32 renders named `{shot}-{en,pt}-{light,dark}.webp`
(`today-ready`, `entry-hub`, `recommend-result`, `program-overview`, `focus`,
`why-this-weight`, `session-summary`, `exercise-chart`). The final landing page
(Plan 064 R2) shows none of them, and Plan 064 R6d deleted them (see "Removed
renders"). The tools that made them (`tools/landing-prototype/capture.mjs`,
`render.sh`) targeted that retired composition and were removed too;
`tools/landing-prototype/fixture.mjs` stays because the landing's chart figures
(92.5 to 100 kg over 4 sessions, owner decision L-2) are derived from it. The
original reproduction notes live in
[`docs/design/plan-054-landing-prototype`](../../docs/design/plan-054-landing-prototype/README.md).
The name `exercise-chart-*` lives on as a live capture (below), not a studio render.

## Landing proof images

The final landing's walkthrough and the paste-way disclosure use real-app
captures, regenerated with repo tooling and never copied from the #276
prototype. `tools/capture-landing-proof.mjs` owns them:

```
node tools/capture-landing-proof.mjs --proof <scratch-dir>   # capture 16 WebP files + the spots JSON
node tools/capture-landing-proof.mjs --check                 # recapture nothing; fail on a stale lens
```

`--proof` rebuilds the bench "add" state from `test/fixtures/landing-proof.json`
(last session 3 x 60 kg x 10 at RIR 2), asserts the real Focus inputs are
62.5 kg x 8, and writes to the directory you name, never into this one. Copy the
files here deliberately. `REPFORGE_URL` names the served worktree and
`REPFORGE_CHROME` the pinned Chromium. `landing-proof-spots.json` holds the lens
hotspots (percentages of the 390x844 frame, measured from the live DOM, stored
once per scene because EN and PT must agree) and the paste-review counts. Commit
it with the images, and keep the `LANDING_SPOTS` table in `app.js` equal to it
(`test/landing-variants.mjs` compares them). `--check` re-measures and fails when
it drifts. Every scene refuses a retired selector on screen (the rest sheet, the
import review's old head): a screenshot of retired UI never ships.

| Files | Frame | Shows |
| --- | --- | --- |
| `wt-focus-{en,pt}-dark.webp` | 390x844 @2x, dark only | Focus, set 1 of 3: the cue (up to 62.5 kg, aim for 8 reps), the ledger with last session, the shelf |
| `wt-rest-{en,pt}-dark.webp` | same | Focus after Log set: the inline rest clock and drain bar in the card, set 2 cued |
| `wt-actions-{en,pt}-dark.webp` | same | The redrawn exercise-actions sheet |
| `wt-note-{en,pt}-dark.webp` | same | The exercise-note sheet over Focus with a typed note |
| `paste-review-{en,pt}-{light,dark}.webp` | 390 CSS px wide @2x (780x1242), cropped from the import-review head through the first row | The review screen for the landing's sample coach message |
| `exercise-chart-{en,pt}-{light,dark}.webp` | 390 CSS px wide at 2x, cropped from the back link through the last table row (780x1646 en, 780x1708 pt) | The exercise page opened from Progress for the landing's squat, best e1RM selected: the plot and the session table, from `tools/landing-prototype/fixture.mjs` (the history behind the caption's 92.5 to 100 kg over 4 sessions) |

The paste-review counts are read off the captured DOM and can differ by
language (the library's Portuguese names match the sample less exactly), so the
landing's alt text uses each language's own count, as `--proof` prints them.
`--source <dir>` captures the 430x932 @3x source PNGs of the same Focus state and
checks the upcoming sets' targets; `--matrix <dir>` runs the generic landing
geometry checks.

## Removed renders

Plan 064 R6d deleted the renders that no markup, service-worker entry, test or tool
referenced any more. They live in git history only:

- `landing-workout-{en,pt}-{light,dark}.webp`: four Form iPhone Studio renders of the
  Focus screen (iphone15, Soft Studio, near-frontal, 759x1566, WebP quality 88) from the
  Plan 054 landing. Their sources came from `tools/capture-landing-proof.mjs --source`
  and `render/scene.json` (see `docs/pr-proof/premium-landing`).
- the 28 sectioned renders `{today-ready,entry-hub,recommend-result,program-overview,
  focus,why-this-weight,session-summary}-{en,pt}-{light,dark}.webp`, retired with the
  Plan 054 landing (see above).
- `landing-device.webp` (541x1058 with alpha) and `landing-hero.webp` (941x1672, the
  only photograph in the app), the hero art of the Plan 054 landing, removed from the
  landing and precache on 2026-09-15.

The studio renders rested on [polyman's iPhone 15 Pro Max model](https://sketchfab.com/3d-models/apple-iphone-15-pro-max-black-df17520841214c1792fb8a44c6783ee7),
licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); no file in this
directory is a studio render any more. `milo-hero.webp` stays below as owner-licensed
archival art that the brand guide and ADR 0006 still cite.

## `milo-hero.webp`

The retired first-run illustration from ADR 0006: the calf-carrier grown into
the bull-carrier, 960×894. Owner-supplied art, landed 2026-08 from a 1242×1266
PNG the product owner provided. Plan 054 keeps this file only as historical
design provenance; production markup and the service worker no longer refer to
or precache it.

In the superseded composition it was shown whole at every width — never cropped, never running off an edge —
set into the poem's own block, with the poem flowing around it (`float`). The
copy is what accommodates the picture: lines stay short while they pass it and
run their full length below it. Do not solve a layout problem here by cropping
this file or letting it bleed; re-break the copy instead
(`docs/brand-guide.md`, "Ethos").

Its former size was not a number: the CSS derived it from the poem, taking
whichever is smaller of the column left over once a 27-character line has its
room and the eight short lines it may pass (ADR 0006, amended 2026-08). So a
new export at this ratio needs no measurement, and one at a different ratio
needs only `aspect-ratio` changed.

Two things were done to that original, and both matter if it is ever replaced:

1. **Trimmed to the ink**, with about 16 px of the original's margin left on
   each side (`x 130, y 171, w 1072, h 998`) — margin, not artwork: nothing of
   either carrier is cut. The hero draws the file about 143 CSS px wide on a
   390 px phone, so every pixel of empty margin in it is a pixel the figures do
   not get.
2. **White-balanced onto the app's paper.** The drawing's own cream ground is
   `#FBF4EA`; each channel was scaled so that cream lands exactly on `--bg`
   (`#F4F2EF`), which moves the graphite and the burnt orange by under 3% and
   makes the file's rectangle invisible on the page. This is the alternative to
   what the exercise detail page does — there the artwork keeps its own paper
   and the page draws a matching field around it (`mediaBg`,
   `tools/sample-media-bg.mjs`), because those 96 files disagree about their
   paper and are shown large. One file shown small is cheaper to re-balance
   than to surround.

Then it was encoded as WebP at quality 0.9 (~100 kB). Node has no image codec
here, so the crop, the balance, and the encode were all done in the same
borrowed Chromium the tools use — a canvas draw, a per-channel multiply over
`ImageData`, and `canvas.toDataURL("image/webp", 0.9)`.

Do not replace or reconnect it without a new owner decision. The current
`test/install-modes.mjs` instead checks the live product-loop landing selected
for Plan 054.

The retired hero painted it with `background-image` rather than an `<img>`: it was
decorative, the copy beside it says everything, and a missing export leaves
paper behind the copy rather than a broken-image glyph — the same line the
exercise tiles hold. No placeholder art ever stands in for it.
