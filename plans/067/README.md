# Plan 067 evidence package

The [implementation plan](../067-engine-replacement.md) governs the future
replacement. This package supplies data and observed cases; it contains no
application implementation or competitor media.

## Files and authority

- `data/app_file.json`: exact database bytes from the base APK, including all
  1,345 exercise records and the complete 5,301-object UUID index.
- `data/ontology.json`: the same index with its 22 type counts. Use identities,
  not translated names, for joins.
- `data/recommendation-tiers.json`: 3,057 non-null assignments across six roles.
- `data/programs.json`: selected P1–P4 export observations. Generation context
  is owner-reported, not encoded in the workbook. Only cycle 1 is exported;
  `cycles: 7` does not establish seven observed cycles.
- `data/gym.json`: 82 exported equipment entries and five allowlisted engine
  settings. Weight selections are equipment configuration, not workout logs.
- `data/progression-observation.json`: transcription of the supplied screenshot.
  Set two was unperformed. No fatigue formula follows from that observation.
- `data/manifest.json`: source and output hashes, APK byte-equality provenance,
  database member path, version, counts, and evidence classifications.
- `data/supplied-reconstruction.json`, `data/supplied-unknowns.json`, and
  `data/static-evidence.tsv`: secondary analysis supplied by the owner. The TSV normalizes line endings and
  trailing whitespace; the raw database remains byte-exact.
  Preserve these as research inputs. Their strings, paths, hypotheses, and
  statements of exactness are not independently recovered executable logic.
- `unknowns.md`: current dispositions, corrections, and implementation defaults.

The original XAPK, five APKs, full workbooks, and screenshot remain outside the
public repository. The extractor reads selected worksheets and fields; it
never exports User Profile, completed workouts, log notes, account identifiers,
or cosmetic program metadata. It includes only P1–P4, not the unnamed program.
The original screenshot is referenced by checksum rather than published.

## Reproduce

Python 3.9 or newer, standard library only. Supply the original attachments:

```sh
python3 plans/067/extract.py \
  --volume1 /private/original-xapk-volume.zip \
  --volume2 /private/extracted-apks-volume.zip \
  --spec-pack /private/macrofactor_engine_mirror_spec_pack.zip \
  --baseline-workbook /private/MacroFactor-20261005063229.xlsx \
  --extended-workbook /private/MacroFactor-20261005065113.xlsx \
  --screenshot /private/1000192988.jpg \
  --out /tmp/plan067-reproduced
python3 plans/067/verify.py /tmp/plan067-reproduced --negative-controls
diff -rq plans/067/data /tmp/plan067-reproduced
```

Use an output outside the repository for review. Extraction verifies every
unpacked APK against its original XAPK member and confirms the baseline P1/P2
prescriptions are unchanged in the extended workbook. There are no network
requests. Output contains no timestamps, machine paths, or nondeterministic IDs.

To validate the published package without private originals:

```sh
python3 plans/067/verify.py --negative-controls
```

The validator checks hashes and independent expected counts, UUID coverage,
reference types, tier equality, equipment closure and program eligibility,
P1–P3 prescription equality, P4 day/set counts, and fixture field allowlists.
Its six corruptions exercise dangling references, incorrect tiers, a missing
compact-program set, missing equipment, an unexpected nested personal field, and uniformly wrong rep ranges.
These checks prove artifact integrity and selected observations. They do not
prove the future generator, progression engine, persistence, or UI.

## Application catalog artifacts

`node tools/build-exercises.mjs` generates two committed files from
`data/app_file.json` and `tools/exercise-catalog-curation.json`. The 304 KB
`exercises.js` is the synchronous picker index: canonical UUID and name,
reviewed Portuguese display/search aliases, source alternative-name search
terms, optional source search boost, and reviewed media fields. It deliberately
does not repeat equipment, metric, muscle, movement, ROM/stability, or
recommendation data. Those details stay in the 3.8 MB minified
`assets/exercise-catalog.json`, which preserves the complete source object.
`node tools/build-exercises.mjs --check` confirms both generated files match
their inputs.

`exercise-catalog.js` exposes `RepForgeExerciseCatalog`. Call `await load()`
before reading full details; concurrent calls share one fetch of the local JSON
asset (`./assets/exercise-catalog.json?v=067`) so an older worker cannot serve
an unversioned detail file. `snapshot()` returns the raw
`{exercises, uuidIndex, generatedAt}` object.
`getExercise`, `getObject`, `metricsFor`, and equipment checks resolve against
that raw snapshot. Names are lookup/search terms only: `resolveName` prefers an
exact canonical name and returns an ambiguous result when several aliases
match. `equipmentClosure` follows `pluralOf` links; each resistance or support
list is an OR of alternatives, while every member of a referenced equipment
group is required. Both resistance and support lists must pass.

Twenty existing illustrations have an explicit UUID mapping whose raw name is
guarded against the reviewed source name during generation. The other 1,325
exercises show the existing empty media tile. The repository retains the 96
licensed illustration files; 76 have no exact reviewed match and remain
unreferenced.
