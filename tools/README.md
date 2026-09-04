# tools

Offline generators. Nothing here runs in the browser, at install time, or as
part of serving the app — Taurifer stays build-free. These scripts produce
committed files, the same way `i18n.js` is produced from `i18n-en.json` and
`i18n-pt.json`.

## build-program-family-fixtures.mjs

Generates the reviewed Plan 047 resolution fixture from `program-compiler.js`.
The independent identity contract in
`test/fixtures/program-family-contract-v1.json` pins the released families,
frequencies, blueprint IDs, and day labels first; `--check` rejects compiler
drift against that contract before checking the generated resolution snapshot.
The source contains twenty separately authored 2–6 day blueprints; this command
does not derive sibling frequencies from recipes.

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

## extract-ui-audit-findings.mjs

Prints the headings and first-column table labels from the four source UI
audits that [`docs/ui-audit.md`](../docs/ui-audit.md) consolidates.

```bash
node tools/extract-ui-audit-findings.mjs
node tools/extract-ui-audit-findings.mjs --check
```

`--check` verifies that all four source reports still exist, the consolidated
report cites each source, is marked final and owner-approved, and contains all
32 finding IDs and all 88 grilling-decision IDs without duplicates. It also
prints the current screen and frame counts so the report baseline can be
checked after the catalog changes.

## check-ui-overhaul-disposition.mjs

Verifies [`docs/ui-overhaul-disposition-register.md`](../docs/ui-overhaul-disposition-register.md):
every G-01–G-88 decision and UI-01–UI-32 finding appears exactly once with a
valid disposition, a plan-number contract owner, and named consumers on `split`
rows. Also checks the 11 rejected-claim guardrails.

```bash
node tools/check-ui-overhaul-disposition.mjs
node tools/check-ui-overhaul-disposition.mjs --check
```

## check-ui-semantic-roles.mjs

Verifies the semantic role inventory and release matrix in
[`docs/adr/0012-ui-overhaul-canonical-reconciliation.md`](../docs/adr/0012-ui-overhaul-canonical-reconciliation.md):
all six role families present with at least the Plan 049 minimum counts,
globally unique role names each with a meaning and a consuming plan, and a
demanding-surfaces matrix whose entries name existing manifest flow/screens
and only known variant sets.

```bash
node tools/check-ui-semantic-roles.mjs
node tools/check-ui-semantic-roles.mjs --check
```

## check-recovery-invariants.mjs

Recomputes Candidate Rule B from [`docs/recovery-week-policy.md`](../docs/recovery-week-policy.md)
against the 20 Plan 047 review compilations in
`test/fixtures/program-families-v1.json`: determinism, optional removal,
primary-pattern coverage with rescue, and the 40–60% band with the two
allowlisted known misses pinned (any other miss, or drift in a listed miss,
fails). Includes a synthetic unit case for the pattern-rescue path, which the
fixtures never trigger.

```bash
node tools/check-recovery-invariants.mjs
node tools/check-recovery-invariants.mjs --check
```

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

Rewrites `docs/ui-screens/screens/` — the phone-frame catalog UI and Brand
Designers use as the visual source of truth. Agents must re-run it whenever a
user-visible surface changes (see `AGENTS.md` and `docs/ui-screens/README.md`).

```bash
python3 -m http.server 8000
(cd test && npm ci && npx playwright install chromium --with-deps)   # once
node tools/capture-ui-screens.mjs
```

The screen list, the variant matrix and every output path come from
`docs/ui-screens/manifest.json`. Each screen names a scenario in
`tools/ui-screens/screens-app.mjs` or `tools/ui-screens/screens-onboarding.mjs`
that drives the real controls; nothing renders a fixture. Every capture gets an
isolated context with service workers blocked, a pinned clock, locale and
timezone, so a previously installed shell can never serve stale code into the
evidence.

The catalog is **mobile only** — the manifest rejects a non-phone viewport.
Onboarding is covered state by state across every route in `ROUTE_STEPS`, not
just each route's entrance, and onboarding frames also record a normalized
semantic snapshot (`docs/ui-screens/entry-semantics.json`) so a copy or role
change is caught without depending on glyph pixels.

Options:

```bash
node tools/capture-ui-screens.mjs --flow onboarding-build   # one flow
node tools/capture-ui-screens.mjs --screen today/day-picker # one screen
node tools/capture-ui-screens.mjs --canonical               # one frame each
node tools/capture-ui-screens.mjs --keep-going              # report, don't abort
```

A filtered run merges into a copy of the committed catalog, so the folder on
disk stays complete. Nothing replaces committed evidence until every requested
capture succeeds. Do not hand-edit the PNGs.

## check-ui-screens.mjs

The registration gate. Fails when a registered frame is missing, an
unregistered PNG is sitting in the tree, a screen has no capture scenario, a
scenario is not in the manifest, or a frame was captured at the wrong pixel
size.

```bash
node tools/check-ui-screens.mjs           # release gate
node tools/check-ui-screens.mjs --report  # list gaps, exit 0
```

## compare-ui-screens.mjs

Compares a regenerated catalog with an immutable copy of the committed one. CI
makes that copy, captures, runs the registration gate, then runs this. The
comparator walks **every** manifest-declared PNG — not one favoured subtree —
requires dimensions to match the manifest exactly, and compares a fixed 96×128
sample grid using colour, luminance-edge, and luminance-histogram features. It
also compares the normalized semantic snapshots exactly.

PNG bytes are intentionally not compared: Chromium font rasterisation and
anti-aliasing can differ between hosted runners while the rendered UI remains
the same. A cell counts as changed only above an 8% colour delta; the default
gate rejects broad changes (more than 4.5% of cells or a 3.5% mean colour
delta), coordinated edge changes, and a 16% luminance-histogram delta. The
thresholds are covered by the self-test, which proves small deterministic pixel
noise passes while a broad panel/content change, a layout shift and any
dimension drift fail.

```bash
baseline="$(mktemp -d)"
cp -a docs/ui-screens/screens "$baseline/"
cp -a docs/ui-screens/entry-semantics.json "$baseline/"
chmod -R a-w "$baseline"
cleanup() {
  chmod -R u+w -- "$baseline" 2>/dev/null || true
  rm -rf -- "$baseline"
}
trap cleanup EXIT
node tools/capture-ui-screens.mjs
node tools/check-ui-screens.mjs
node tools/compare-ui-screens.mjs \
  --baseline "$baseline/screens" \
  --baseline-semantic "$baseline/entry-semantics.json"
```

The manifest, gate and comparator self-test runs with:

```bash
node test/ui-screens.mjs
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
