# Plan 042: Add licensed artwork to exercise detail

> **Executor instructions:** implement the approved treatment in
> `docs/design/exercise-detail-illustration.md`. Preserve the supplied exercise
> assets byte-for-byte. Run each verification before moving on. If a STOP
> condition occurs, stop and report it rather than widening scope or guessing.
>
> **Drift check (run first):**
> `git diff --stat 66b427c..HEAD -- app.js styles.css sw.js test/simulation.mjs test/accessibility.mjs test/exercise-library.mjs docs/design/ui-overhaul-spec.md docs/design/exercise-detail-illustration.md`
>
> If `renderExerciseView()`, `exerciseMedia()`, the exercise-detail styles, or
> mapped-media behavior changed after `66b427c`, reconcile those changes with
> this plan before editing. Stop and re-plan if the documented anchors no longer
> exist.

## Status

- **Priority:** P1
- **Effort:** S
- **Risk:** LOW (localized rendering and CSS; no data-model change)
- **Depends on:** `docs/design/exercise-detail-illustration.md`
- **Category:** UX / accessibility / visual design
- **Planned at:** commit `66b427c`, 2026-08-16
- **Implementation status:** BUILT, BLOCKED ON A DESIGN DECISION. Steps 1, 2, 3
  and 5 are implemented and every gate passes. Step 4 reached a STOP condition:
  one fixed warm-field token cannot serve the shipped library. See
  [Findings](#findings-2026-08-17) before merging.

## Outcome

The exercise detail page displays the existing licensed movement illustration
as a full-width editorial field between the prescription and recommendation.
Its cream background transitions into the unchanged page background. The
recommendation rail remains, while neutral rules disappear from the upper
detail summary. Exercises without mapped media keep the current compact layout
and never request a placeholder.

## Scope

### In scope

- `app.js`: conditional media markup inside `renderExerciseView()`
- `styles.css`: full-bleed field, background transition, image sizing, and
  exercise-detail-only stat-rule removal
- `test/simulation.mjs`: rendered and absent-media browser coverage
- `test/accessibility.mjs`: alt text, overflow, and mobile layout coverage
- `sw.js`: one cache-key bump after runtime edits
- `plans/README.md`: mark this plan DONE after all checks pass

### Out of scope

- editing or adding files under `assets/exercises/`
- changing the exercise media allowlist, mapping, import format, or schema
- changing list/picker/preview thumbnails
- changing recommendation, progression, record, or history logic
- adding new localized copy when `preview.art_alt` already expresses the need
- changing global `.statrow`, `.metrics`, `.recblock`, or history rules
- implementing decorative gradients anywhere else

## Current implementation anchors

- `app.js:5266` (`renderExerciseView`) already resolves `tmpl`, `latest`,
  `name`, and `exRef`, then writes title, metadata, recommendation, stat row,
  chart, records, and sessions into `#exDetail`.
- `app.js:6013` (`exerciseMedia`) returns a mapped `media` URL or `null`.
- `app.js:6747` demonstrates the correct descriptive-alt pattern with
  `t("preview.art_alt", { name })`, `decoding="async"`, and 768 × 768 intrinsic
  dimensions.
- `styles.css:341-371` gives all shared stat rows top, bottom, and internal
  rules. The implementation must override these only through an
  exercise-detail modifier.
- `styles.css:376-388` owns the orange recommendation rail. Preserve it.
- `main` uses independent safe-area-aware horizontal padding and a 560 px
  maximum width; the media field must bleed only through that padding.
- All 96 mapped exercise media assets are already part of the existing
  service-worker asset list. This feature should not add an asset URL.

## Step 1 — render conditional media

In `renderExerciseView()`, after `name` and `exRef` are available:

1. Resolve `const artSrc = exerciseMedia(exRef)`.
2. Build an empty string when `artSrc` is null.
3. Otherwise build one inert wrapper and one image, for example:

   ```html
   <div class="exdet-art">
     <div class="exdet-art__figure">
       <img class="exdet-art__img" ...>
     </div>
   </div>
   ```

4. Escape the URL and localized alt value.
5. Use `alt="${t("preview.art_alt", { name })}"`, `decoding="async"`, and
   `width="768" height="768"`. Do not use `loading="lazy"` because the media is
   above the fold.
6. Insert the block after `.exdet__meta` and before `recHtml`.
7. Add an `exdet__stats` modifier to the existing four-column stat row. Do not
   change its values, labels, or shared base classes.

**Verify:** a mapped exercise produces one `.exdet-art__img`; an unmapped or
custom exercise produces no `.exdet-art`, no `<img src="">`, and no gap.

## Step 2 — implement the approved visual treatment

Add exercise-detail-scoped CSS matching the design specification:

1. Define `--exercise-art-bg: #F4ECE1` on the local media field or exercise
   view—not on `:root` unless another approved consumer exists.
2. Bleed `.exdet-art` through `main`'s left and right padding with independent
   safe-area calculations. Keep it inside the 560 px app shell.
3. Use the approved vertical `var(--bg)` → warm cream → `var(--bg)` transition.
4. Center the uncropped 1:1 image at `min(80%, 450px)` with intrinsic height.
5. If the opaque square's top/bottom edges remain perceptible, add restrained
   edge veils inside the source's empty background. Do not mask any illustration
   pixels and do not use blend modes, filters, blur, or asset edits.
6. Give the field only vertical spacing. Add no border, radius, shadow,
   caption, overlay control, or hover state.
7. On `.exdet__stats`, remove the inherited top and bottom borders and suppress
   `.statrow__cell::after` separators. Do not alter shared stat rows elsewhere.
8. Preserve the 3 px orange `.recblock` rail. Use margin/spacing, not a neutral
   rule, between art, recommendation, and metrics.

**Verify at 320, 360, 390, 430, and 560 px:** no crop, no horizontal overflow,
no hard cream rectangle, no neutral divider in the upper cluster, and no change
to the page background outside the field.

## Step 3 — add regression coverage

Extend the browser suites without coupling them to translated visible copy.

### `test/simulation.mjs`

- Seed/open a known mapped exercise such as library ID `sqk_mc`.
- Assert one detail image, expected mapped URL
  `assets/exercises/sqk_mc.webp`, 768 × 768 intrinsic hints, and a non-empty
  localized alt.
- Assert the image is between `.exdet__meta` and `.recblock` in DOM order.
- Exercise both no-history and populated-history states; existing
  recommendation, stats, and chart output must remain present.
- Open an unmapped/custom exercise and assert there is no media wrapper, image,
  placeholder, or broken media request.
- Assert another shared stat row outside `#exercise` still has its rules.

### `test/accessibility.mjs`

- Assert the detail image is not focusable and has meaningful localized alt.
- At the mobile viewports, assert the media rectangle fits the viewport and the
  document does not gain horizontal overflow.
- Check computed styles: `.exdet__stats` has no top/bottom border and its cell
  separator pseudo-elements are suppressed; the recommendation retains its
  orange left border.

Keep the existing test selectors and data setup intact. Prefer a focused helper
over duplicating setup across suites.

## Step 4 — visual QA against the approved mock

Serve the repository over HTTP and capture:

1. Portuguese, 430 px, mapped hack squat, no history (primary comparison);
2. English, 390 px, mapped exercise with history and populated metrics;
3. Portuguese, 320 px, mapped exercise with a long two-line name;
4. unmapped/custom exercise at 390 px; and
5. centered 560 px shell on a desktop-width viewport.

Compare the primary capture with
`docs/design/mocks/10-exercise-detail-illustration.png`. Check hierarchy,
uncropped art, gradient softness, unchanged page background, orange rail, and
the complete absence of neutral rules in the upper cluster. Differences in
live system chrome, dates, and data values are not design defects.

## Step 5 — integration and cache

After implementation and tests are final:

1. Increment the service-worker `CACHE` key exactly once because `app.js` and
   `styles.css` changed.
2. Do not add a new exercise-media URL; mapped assets are already precached.
3. Mark plan 042 DONE in `plans/README.md`.
4. Run the complete verification set:

   ```sh
   node --check app.js
   node tools/build-i18n.mjs --check
   node test/exercise-library.mjs
   node test/simulation.mjs
   node test/accessibility.mjs
   git diff --check
   ```

If the browser dependencies are absent, install only the repository's pinned
test dependencies according to `AGENTS.md`; do not add application dependencies.

## STOP conditions

Stop and report rather than improvise if:

- the exercise detail can no longer resolve `exRef` or mapped media reliably;
- the known mapped asset is absent from the current service-worker list;
- shipped artwork backgrounds vary enough that one local warm-field token
  creates obvious rectangles across the library;
- matching the mock appears to require cropping, editing all artwork, blend
  modes, or fading instructional pixels;
- divider removal requires changing global stat or history styles;
- the change requires new schema, storage, recommendation, or localization
  behavior; or
- a mobile viewport gains horizontal overflow from the safe-area bleed.

## Findings (2026-08-17)

### STOP: one warm-field token cannot serve the shipped library

The design samples `--exercise-art-bg: #F4ECE1` from the approved mock's source
artwork, the hack squat (`sqk_mc`). Measuring the empty outer ring of all 96
shipped illustrations shows that value is not representative of the set:

| | value |
|---|---|
| library median background | `#ECE0CF` |
| `sqk_mc` background (the token's source) | `#F4EDE1` |
| max-channel distance from `#F4ECE1`, median asset | 19 |
| max-channel distance from `#F4ECE1`, worst asset (`sp_mc`) | 35 |
| assets within 5 of the token | 5 of 96 |
| assets at 13 or more | 69 of 96 |

Because the field bleeds full-width while the picture is `min(80%, 450px)`, that
distance is drawn as a hard vertical edge down both sides of every square. The
hack squat dissolves exactly as the mock shows; the other 91 movements read as
the pasted tile the treatment exists to avoid, which fails the design's own
acceptance criterion that the artwork's background dissolve "without a visible
hard rectangle".

Re-sampling the token from the library median instead only moves the problem: it
would put the hero exercise 18 off its own field and break the primary mock
comparison. **No single constant satisfies both.**

Edge veils do not rescue this. They are specified to hide the top and bottom
boundary of a *matched* square, and they cannot bridge a 35-level mismatch
without fading instructional pixels, which the design forbids.

### What shipped

Everything that does not depend on the token: the conditional markup, the
full-bleed geometry and safe-area handling, the length-based gradient, the
scoped divider removal, the browser coverage, and the cache bump. The treatment
is correct and complete the moment the field colour matches the asset.

### One deviation from the letter of the spec

The gradient uses length stops pinned to the figure's padding rather than the
spec's `10%` / `88%` percentages. Percentage stops scale with the field's
height, so at the 560 px shell the fade climbed roughly 30 px back over the
artwork and redrew the top and bottom edge it exists to dissolve. Lengths keep
the hold behind the illustration at every width, which is what the spec asks
for in prose ("hold the warm field behind the useful illustration area").

### Recommended resolution (needs design sign-off — out of this plan's scope)

Carry the field colour per movement instead of as one constant: have
`tools/build-exercises.mjs` sample each asset's border ring and emit it beside
`media`, then set `--exercise-art-bg` on the field from that value. This keeps
the approved treatment verbatim, keeps the artwork untouched, and makes every
one of the 96 illustrations dissolve the way the mock does. It is a generated
library schema addition, which this plan lists as out of scope, so it needs a
decision rather than an executor.

## Done when

- all design acceptance criteria pass for mapped and unmapped exercises;
- runtime, accessibility, library, and browser tests pass;
- the 430 px no-history screenshot matches the approved treatment;
- the cache key is bumped once and no asset list entry is added;
- only scoped runtime/test/plan files changed; and
- plan 042 is marked DONE.
