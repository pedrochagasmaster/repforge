# tools

Offline generators. Nothing here runs in the browser, at install time, or as
part of serving the app — Taurifer stays build-free. These scripts produce
committed files, the same way `i18n.js` is produced from `i18n-en.json` and
`i18n-pt.json`.

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
