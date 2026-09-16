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

## Sectioned landing renders

The current landing uses 32 renders named
`{shot}-{en,pt}-{light,dark}.webp`: eight real Taurifer states in both
languages and both appearances. The shots are `today-ready`, `entry-hub`,
`recommend-result`, `program-overview`, `focus`, `why-this-weight`,
`session-summary`, and `exercise-chart`.

`tools/landing-prototype/capture.mjs` reconstructs one intermediate lifter
with three full-body days and twelve sessions, then captures the shipped UI at
1290×2796. Form iPhone Studio renders each source with
`docs/design/plan-054-landing-prototype/render/scene.json`; the per-shot device
angles are recorded in `tools/landing-prototype/render.sh`. All outputs are
cropped to the same 903×1832 frame so a more rotated phone does not render
smaller than the others. No app content is redrawn or generated.

The service worker precaches only the four `today-ready` hero variants. The
other 28 renders load on demand. The complete design and reproduction notes
live in [`docs/design/plan-054-landing-prototype`](../../docs/design/plan-054-landing-prototype/README.md).

## `landing-workout-{en,pt}-{light,dark}.webp` (historical)

The previous landing used four renders of the actual Taurifer Focus screen.
Each shows a bench-press program, three recorded sets at 60 kg for 10 reps at
RIR 2, and the app-derived 62.5 kg for 8 reps. These are authored example
records, not a person's workout history. The range engine and real UI produce
the shown result. No pixels or training values are invented by an image model.

Source captures and configuration live in
[`docs/pr-proof/premium-landing`](../../docs/pr-proof/premium-landing/README.md).
`tools/capture-landing-proof.mjs --source <directory>` reconstructs the state
from `test/fixtures/landing-proof.json`, verifies the real Focus inputs and
history rows, and captures EN/PT in light/dark at 430×932 CSS pixels and 3× DPR,
producing 1290×2796 PNGs. The capture resolves existing safe-area expressions
to 59px top and 34px bottom because pinned Chromium cannot emulate those
insets through CDP. This is a documented browser-layout emulation, not physical
iPhone evidence. No application content or component layout is replaced.

Form iPhone Studio at `/home/ubuntu/projects/form-iphone-studio` renders each
source with the committed `render/scene.json`:

- device preset `iphone15`;
- camera `Front`, device rotation x=0°, y=-8°, z=0°;
- lighting `Soft Studio`;
- screen fit `fit`, zoom 1, x=0, y=0;
- ratio 9:16, longest edge 2160;
- transparent export, ground disabled.

The resulting 1215×2160 PNG is trimmed to its alpha bounds, 759×1566, and
encoded as WebP at quality 88, method 6. There is no perspective, color,
content or hardware edit after rendering. CSS supplies the surrounding paper,
type, rules, overlap and responsive layout.

The near-frontal view preserves the ledger's column alignment. The recorded
Three Quarter / Bright Product alternative adds reflection and compresses the
text. The chosen render's software follows the page language and theme. Live
HTML beside it carries every numerical claim and reflows with enlarged text.
The localized image alt describes the same example.

Model attribution: the studio derives its hardware from
[polyman's iPhone 15 Pro Max model](https://sketchfab.com/3d-models/apple-iphone-15-pro-max-black-df17520841214c1792fb8a44c6783ee7),
licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
The renderer resizes that model to the selected iPhone 15 proportions, retaining
the model's Pro hardware details. The rendered screen and framing are modified
compositions. This is a product mockup, not a device-specification illustration.

## `landing-device.webp`

Historical asset, removed from the landing and precache on 2026-09-15.
The former phone in the landing hero was 541×1058 with alpha. Owner-supplied, landed
2026-09-14 as a rendered iPhone holding a real Taurifer screen: a Push session
in week 4, the incline converging chest press at 4–8 reps and RIR 0–2, last
session's 152.5 kg for 7 reps, and the set derived from it.

Two things were done to the original, and both matter if it is ever replaced:

1. **Trimmed to its own alpha** (`Image.getbbox()`), from 1152×1440 to
   541×1058. The transparent margin was a third of the file and every pixel of
   it is a pixel the device does not get when the image is sized from a grid
   column.
2. **Encoded as WebP at quality 88 (~33 kB) with alpha preserved.** The drop
   shadow lives in that alpha, so the render needs no CSS shadow and sits on
   the photograph without a box.

In the superseded composition it was an `<img>`, not a `background-image`, and the brand image
that is *not* decorative: it is the only place the landing shows the product,
so it carries a real, localized `alt` naming the loop it displays — the
target, the work logged last session, and the set derived from them. That
string is `landing.preview.alt`, and `data-i18n-alt` keeps it translated.
`test/install-modes.mjs` asserts those facts from the accessible name in both
languages.

The screen inside it is a raster, so it does not reflow, restyle for dark, or
translate. That is the accepted cost of the owner's direction, recorded in
`docs/design/plan-054-landing-directions.md`; a pt-BR reader sees an English
screen with a Portuguese description of it. Replacing this file means
re-checking that the alt still describes what the new render actually shows —
a stale description here is worse than no image.

## `landing-hero.webp`

Historical asset, removed from the landing and precache on 2026-09-15.
The following processing notes describe the superseded composition.

The photograph behind the Plan 054 landing hero, 941×1672. Owner-supplied,
landed 2026-09-14 as the background for the selected landing target recorded in
`docs/design/plan-054-landing-directions.md`. It is the only photograph in the
app; the 96 exercise illustrations remain a separate closed set, and this file
is not one of them.

One thing was done to the original, and it matters if it is ever replaced:
**white-balanced onto the app's paper**, the same per-channel multiply
`milo-hero.webp` describes below. The photographed wall reads about
`#F7F2E8`; each channel was scaled so that wall lands on `--bg` (`#F4F2EF`).
The point is the seam: the hero fades out onto solid paper just above the
benefit strip, and an unbalanced file would draw a warm-to-neutral line exactly
there. The plates and the bottle are near-black and move imperceptibly; the
towel's burnt-orange stripe stays inside the accent family.

It is **not** cropped. The composition is the owner's — lit wall in the upper
two thirds where the proposition sits, plates and bottle along the bottom.
Compact widths draw it `center bottom`, so the phone gets that whole
composition; from 640px the crop moves to `center top`, because covering a
landscape hero with a portrait file would otherwise put the plates behind the
headline. Re-crop in CSS, never in this file.

Encoded as WebP at quality 78 (~88 kB) with Pillow — `Image.point()` for the
balance, then `save(…, quality=78, method=6)`. Unlike `milo-hero.webp` this
needed no Chromium detour.

It is painted with `background-image` on `.firstrun-hero::before`, decorative
and never in the accessibility tree: it carries no product fact, so a missing
export leaves paper behind the copy rather than a broken-image glyph — the
line the exercise tiles and the retired Milo hero both hold. Dark withholds it
rather than filtering it, because there is no honest dark treatment of a
photographed warm wall; `forced-colors` withholds it too.

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
