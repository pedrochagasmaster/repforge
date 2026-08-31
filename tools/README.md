# tools

Offline generators. Nothing here runs in the browser, at install time, or as
part of serving the app — Taurifer stays build-free. These scripts produce
committed files, the same way `i18n.js` is produced from `i18n-en.json` and
`i18n-pt.json`.

## build-program-family-fixtures.mjs

Generates the reviewed Plan 047 fixture from `program-compiler.js`. The source
contains twenty separately authored 2–6 day blueprints; this command does not
derive sibling frequencies from recipes.

```bash
node tools/build-program-family-fixtures.mjs
node tools/build-program-family-fixtures.mjs --check
```

## build-i18n.mjs

Rewrites the EN and PT dictionaries inside `i18n.js` from `i18n-en.json` and
`i18n-pt.json`, leaving the runtime below them untouched.

```bash
node tools/build-i18n.mjs           # regenerate
node tools/build-i18n.mjs --check   # fail if i18n.js has drifted
```

Edit the two JSON catalogs, then regenerate. `test/i18n.mjs` checks key parity,
placeholders and catalog/runtime agreement; this does the mechanical half.

## build-exercises.mjs

Generates `exercises.js` — the exercise library the picker and the program
generator read — from `exercise-curation.json` plus the upstream dataset.

```bash
git clone --depth 1 https://github.com/hasaneyldrm/exercises-dataset /tmp/exdb
node tools/build-exercises.mjs --src /tmp/exdb
```

`--report` prints the movement names whose Portuguese still contains English
words instead of writing the file. A clean run reports zero: every name either
composes from the phrase tables or carries a `namePt` override in the curation
file.

The upstream clone is only needed to regenerate. `exercises.js` is committed,
so contributors and CI never fetch the dataset.

### What the script decides, and what the curation file decides

`exercise-curation.json` is the reviewed part. Each record names an upstream
row and the movement patterns it belongs to:

```json
{ "id": "pr_bb", "src": "exdb:0025", "patterns": ["press"],
  "name": "Barbell bench press", "beginnerFriendly": false }
```

- `id` — Taurifer's stable library id, stored on program templates as
  `libraryId`. **Never repoint an existing id at a different movement**: the
  ids of movements Taurifer shipped before the library are still sitting in
  people's saved programs. Merged duplicates are handled by
  `LEGACY_LIBRARY_IDS` in the generated file, not by reusing an id.
- `src` — upstream row. Omit it for a native entry, which then has to carry
  `name`, `equipment` and `primary` itself; `hg_mc` is one, because Taurifer
  shipped a Romanian deadlift machine and the dataset has no such row.
- `patterns` — Taurifer's movement slots. The **first** pattern decides the
  primary muscle, because the upstream `target` field is unreliable in exactly
  the places that matter (it calls every squat and Romanian deadlift
  glute-primary). See `PATTERN_MUSCLES`.
- `name`, `namePt`, `primary`, `secondary`, `notes`, `beginnerFriendly` —
  optional overrides, each one winning over the mechanical mapping.
- `_srcName` — the upstream name, carried along so a reviewer can see what a
  record was built from. Unused by the app.

Everything else is mechanical and re-runnable: equipment mapping, muscle
synonym collapsing, deltoid-head splitting by movement name, display-name
repair, and Portuguese composition.

### Muscle tokens are a contract

`test/exercise-library.mjs` pins the vocabulary. The volume audit groups hard
sets by exact muscle string, and `i18n-en.json` / `i18n-pt.json` carry a
`muscle.<token>` key per token — so a new token needs a deliberate addition in
all three places, and a typo'd one silently splits a muscle into two rows.

### Artwork

`MEDIA_IDS` in the build script is the closed list of movements with licensed
illustrations, and the files live in `assets/exercises/<libraryId>.webp`. The
build fails if a mapped file is missing or a mapped id is not in the library.
Everything not on that list renders an empty tile and issues no image request —
`test/exercise-library.mjs` and `test/library-flow.mjs` enforce both halves.

Each mapped entry also carries `mediaBg`, the paper colour that illustration is
drawn on, which the exercise detail page uses as the field behind the artwork so
the opaque square dissolves instead of reading as a pasted tile. The shipped set
spans `#E3D4BE` to `#F4EDE1`, so this cannot be one constant — see
`docs/design/exercise-detail-illustration.md`.

## sample-media-bg.mjs

Rewrites `exercise-media-bg.json`, the `libraryId → #rrggbb` map that
`build-exercises.mjs` reads for `mediaBg`. It samples the empty border ring of
each file and takes the median.

```bash
(cd test && npm ci && npx playwright install chromium)   # once
node tools/sample-media-bg.mjs           # rewrite the JSON
node tools/sample-media-bg.mjs --check   # fail if it has drifted from the files
```

The illustrations are lossy VP8, Node ships no image decoder, and Taurifer has
no application dependencies — so this borrows the Chromium the browser suites
already pin, as `build-brand-mark.mjs` does. The artwork set is
closed, so it is a maintenance script rather than a build step: run it only when
the files change. Its output is committed and may be hand-corrected; the build
reads the file and never re-derives it. `build-exercises.mjs` fails if any
mapped id has no colour or an id has a colour but no artwork, and
`test/simulation.mjs` decodes every file to confirm each recorded colour really
is that drawing's paper.

## capture-ui-screens.mjs

Rewrites `docs/ui-screens/{light,dark}/` — the exhaustive phone-frame catalog
UI and Brand Designers use as the visual source of truth for both Appearance
themes. Agents must re-run it whenever a user-visible surface changes (see
`AGENTS.md` and `docs/ui-screens/README.md`).

```bash
python3 -m http.server 8000
(cd test && npm ci && npx playwright install chromium --with-deps)   # once
node tools/capture-ui-screens.mjs
```

Seeds a stable three-day program with history, walks every primary surface in
Light and Dark, and refreshes the folder README. Appearance must be present in
the running app. Do not hand-edit the PNGs.

## check-ui-screen-catalogue.mjs

Checks the Plan 048 program-entry screenshot matrix declared in
`docs/ui-screens/program-entry-manifest.json`. The manifest covers every
required entry decision state in English and Brazilian Portuguese, both
Appearance themes, 320 px and normal phone widths, desktop, large text, and
reduced motion. Paths use the generated-art convention under
`docs/ui-screens/program-entry/`.

```bash
node tools/check-ui-screen-catalogue.mjs --report  # list capture gaps
node tools/check-ui-screen-catalogue.mjs          # release gate
node tools/check-ui-screen-catalogue.mjs --json   # machine-readable report
```

The checker validates PNG dimensions against the manifest's 2× capture scale,
paired locale/theme coverage, and unexpected files. `--report` is for an
in-progress capture and keeps the process successful; the default fails on any
gap.

The manifest self-test runs with:

```bash
node test/ui-screen-catalogue.mjs
```

## build-brand-mark.mjs

Renders `assets/brand/mark.png`: the Taurifer yoke with no paper under it, at
192×192 (the 48 CSS px the first-run gate draws, at 4×).

```bash
(cd test && npm ci && npx playwright install chromium)   # once
node tools/build-brand-mark.mjs
```

`icons/icon.svg` paints its own warm ground (`#EFE5DF`) as one full-bleed rect,
which is right for an app icon and wrong inside the app: on the gate's paper
(`#F4F2EF`) it reads as a plate around the mark. CSS cannot reach inside an
`<img>` to hide that rect, so the ground comes off in the render instead — this
removes exactly that one path and rasterises everything else, borrowing the
same pinned Chromium as `sample-media-bg.mjs`. It refuses to run if the source
no longer paints exactly one ground of that colour, because that means the mark
itself changed. Re-run it when a new mark lands; the output is generated art,
replaced wholesale and never hand-edited (`docs/brand-guide.md`, "The mark").
