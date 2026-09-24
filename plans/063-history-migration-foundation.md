# Plan 063: historical migration foundation

- **Plan number:** 063
- **Phase:** Post-overhaul adoption; additive foundation may proceed before the overhaul closes
- **Status:** Foundation implementation in progress; plan committed before production code
- **Base inspected:** `origin/main` at `78492da2`
- **Depends on:** Plan 061; current performed-identity and durable-state contracts
- **Blocks:** Final History import UI and durable commit integration until Plans 058 and 059 settle their public-surface and release contracts
- **Objective:** Parse Hevy, Strong, and generic CSV workout histories into an immutable, validated import proposal without adding parsing or identity rules to the History UI
- **Product behavior in this plan:** No production UI and no durable History writes
- **Risk:** High for identity, date, unit, and duplicate mistakes; low durable-data risk while the plan stops before commit

## Why this foundation can proceed now

Historical migration is first in the backlog's post-overhaul queue. Plan 057 has
merged in PR #248, but Plans 058 and 059 still own system-wide presentation and
release validation. The importer can define and prove source semantics without
depending on either unfinished surface.

This plan builds the source-to-proposal pipeline. It does not add an import
button, a temporary production flow, or a second History store. The final
History handoff and the durable commit adapter wait until the overhaul's
History and release contracts have settled.

## Source evidence and supported files

Official Hevy and Strong help pages confirm workout CSV export but do not
publish complete headers. The [Hevy export guide](https://help.hevyapp.com/hc/en-us/articles/43708290987415-Exporting-Your-Data-from-Hevy)
documents export availability. The [Strong export guide](https://help.strongapp.io/article/235-export-workout-data)
documents CSV export. The Hevy set-level header below is corroborated by a
[July 2026 export-format report](https://thetaperapp.com/articles/how-to-export-hevy-data/)
and a [user-posted sample](https://www.reddit.com/r/Hevy/comments/1nximdf/follow_up_on_asking_for_random_users_hevy_export/).
Strong's supported field families are corroborated by a [reported Strong 6.2.4
export](https://kinoku.app/compare/kinoku-vs-strong) and [older export
samples](https://www.reddit.com/r/strongapp/comments/mww3xm). Fixtures in this
repository are constructed and contain no private workout data.

The implementation accepts only the schemas below and their named header
aliases. It does not infer a schema from a filename. Unknown or ambiguous
headers fail before a proposal is created. The source and fixture evidence is
recorded here so a future export change can add a reviewed schema version.

The parser accepts files up to 25 MiB, at most 200,000 non-empty data rows, and
at most 16,384 characters in one cell. Crossing any limit rejects the whole
file before reconciliation. It never truncates a field.

### Hevy CSV

Accept the current set-level header family:

```text
title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_lbs,reps,distance_miles,duration_seconds,rpe
```

Accept `weight_kg` in place of `weight_lbs` and `distance_km` in place of
`distance_miles` only when those exact unit-bearing headers appear. The adapter
does not accept an unlabelled `weight` column as Hevy data. The source marker is
the `start_time`, `exercise_title`, `set_index`, and `set_type` header family.

### Strong CSV

Accept the set-level family identified by `Date`, `Workout Name`,
`Exercise Name`, and `Set Order`. Recognize `Workout #` or `Workout Number`,
`Duration` or `Duration (sec)`, `Weight`, `Weight (kg)`, `Weight (lbs)`,
`Weight Unit`, `Reps`, `RPE`, `Distance`, `Distance Unit`, `Seconds`, `Notes`,
and `Workout Notes` when present. Recognize comma, semicolon, and tab-delimited
files.

An explicit unit-bearing weight header or a valid per-row `Weight Unit` sets
the source unit. A plain `Weight` column without either remains blocked until
the import caller supplies an explicit source unit. Never infer it from the
device's display setting.

### Generic CSV

Accept a set-level CSV only when the caller selects the generic source. Require
a date, an exercise name, and repetitions. Accept an optional session ID,
session title, start time, set index, weight, weight unit, RIR, RPE, set type,
exercise note, and session note. Use this bounded header-alias table:

| Field | Accepted headers |
|---|---|
| Date | `date`, `workout_date`, `session_date` |
| Session ID | `session`, `session_id`, `workout_id` |
| Session title | `day`, `title`, `workout_name`, `session_name` |
| Start time | `start_time`, `start_at`, `created` |
| End time | `end_time` |
| Exercise | `name`, `exercise`, `exercise_name`, `exercise_title`, `movement` |
| Source exercise ID | `exercise_id`, `source_exercise_id`, `movement_id` |
| Set index | `set`, `set_index`, `set_order`, `set_number` |
| Session duration | `duration`, `duration_seconds`, `workout_duration` |
| Load | `load`, `weight`, `weight_kg`, `weight_lbs`, `weight (kg)`, `weight (lbs)` |
| Unit | `unit`, `weight_unit`, `load_unit` |
| Repetitions | `reps`, `repetitions`, `rep_count` |
| Effort | `rir`, `rpe` |
| Set type | `set_type`, `type`, `is_warmup` |
| Exercise note | `exercise_note`, `exercise_notes`, `set_notes` |
| Session note | `notes`, `workout_notes`, `session_notes` |

Aliases are case-insensitive, trim surrounding whitespace, and fold accents.
Two source headers that map to the same field make the file ambiguous and
reject it. Generic column remapping belongs to the final review UI and is not
part of this foundation.

The exact Taurifer log CSV is rejected with a typed result and points the user
to the full JSON backup. That CSV is an analysis export and omits performed
library identity and importer metadata. The existing JSON backup remains the
full-fidelity Taurifer restore or merge path.

## Identity and provenance contracts

### Normalized session and set model

The adapter produces source records, then normalized session candidates, then
reconciled rows. A candidate row carries:

- the source exercise label exactly as exported;
- the raw source row number and a deterministic row key;
- source date and source timestamp facts;
- normalized load in canonical kilograms, repetitions, and nullable RIR;
- warm-up and source set-type information;
- session and exercise notes;
- an explicit identity state and any Plan 061 candidates;
- parse and eligibility issues without discarding the source row.

The Taurifer row shape is prepared only after identity reconciliation. It keeps
the source label in both `name` and `performedName`, stores the matched target
in `performedLibraryId`, and snapshots canonical target muscle attribution in
`performedPrimary` and `performedSecondary`. It does not manufacture a program
slot, current program day, block ID, or workout bodyweight.

An unresolved or custom source movement receives a stable, import-source-scoped
`performedMovementId` and keeps the original label. It has no
`performedLibraryId`, so `matchLift()` cannot fall back to its display name and
join it to a current program movement. This ID keeps repeated sets of that
source movement together across sessions and repeated imports. Use the
provider's source exercise ID when present. Otherwise hash the exact normalized
source label within its source family. It is not a Taurifer library match. A
later explicit choice can link the row to a built-in or existing custom
definition. Set empty `performedPrimary` and `performedSecondary` snapshots on
unresolved rows so readers cannot infer muscle attribution from a current
program exercise that happens to share the source label. Creating a new custom
definition and persisting it are final-integration work.

### Reconciliation

Use the existing Plan 061 `classifyImportRow()` matcher through an injected
host callback. Do not copy `rankImportCandidates()`, its scoring, or its
equipment rules into the importer.

- Exact and curated alias results may preselect the target because Plan 061
  defines both as reviewed identity. Preserve the exported label regardless.
- Probable candidates remain unresolved. Importing one requires an explicit
  target choice or an explicit keep-as-imported choice.
- No-candidate rows remain unresolved until the lifter keeps the source
  identity or links it explicitly.
- Never replace a previously stored `libraryId` while processing a source
  record. Reconciliation only creates a new performed identity for the
  candidate being imported.
- Machine-brand or machine-model wording stays in the source name. A fuzzy
  candidate does not merge it with a generic machine entry. If the source gives
  no evidence that two machines are the same, they remain separate until a
  person explicitly chooses a shared target.
- The importer never creates a new alias from one match. Alias changes require
  a fixture row that records the source wording and an exact expected ID.

The importer returns candidate IDs and status from the injected matcher, not
its own scores. Tests exercise that callback against the real shipped matcher
and keep both Plan 061 fixture tiers green.

### Imported-session provenance

The eventual durable row stores a versioned `historyImport` record on every
set row because History is a flat `log` array and has no session aggregate:

```json
{
  "schemaVersion": 1,
  "source": "hevy",
  "sourceSchema": "hevy-set-v1",
  "sourceSessionKey": "sha256:<digest>",
  "sourceSessionFingerprint": "sha256:<digest>",
  "sourceRowKey": "<stable-row-key>",
  "sessionStatus": "complete",
  "identity": "exact",
  "sourceSetType": "drop_set",
  "sourceSupersetId": "1"
}
```

`source` is `hevy`, `strong`, or `generic-csv`. `identity` is `exact`, `alias`,
`explicit-link`, or `kept-source`. `sessionStatus` is `complete` or `partial`.
`sourceSetType` is present only when the source set is not a normal working set;
`sourceSupersetId` is present only when Hevy supplies a superset marker.
Store digests and stable keys, not a filename, account name, raw payload, or
imported source URL. Preserve source labels and notes only in the History row
fields that already display or export workout data.

This metadata is constructed in the proposal but is not persisted in this plan.
The final durable adapter must prove that `normalizeLoaded()` preserves the
metadata, that JSON backups export and restore it, and that repeated commits
can find it. If the current general log-row compatibility path does not
preserve it, the durable integration plan must add a versioned validator and
round-trip proof before enabling import.

## Date and unit rules

### Dates and times

- Store `date` as the calendar date written by the source. Do not convert it
  through the importing device's time zone.
- Parse ISO timestamps with an explicit `Z` or numeric offset as instants.
  Keep their original source timestamp in provenance and use the parsed instant
  for `created`.
- Parse timezone-free timestamps as local wall time. Store a timezone-free
  `created` value and do not claim an absolute instant.
- Parse `YYYY-MM-DD` and English or Portuguese month-name dates directly. For
  slash dates with day and month both at most 12, require an explicit `DMY` or
  `MDY` option.
- Use the source start timestamp for `date`. If the source has only an end
  timestamp, use its stated calendar date. If the source has only a date, do
  not invent a time.
- A malformed or ambiguous date blocks that row and reports its source row
  number. It does not shift a session to another day.

### Loads and effort

- Taurifer stores every load in kilograms. Convert pounds with the existing
  `2.2046226218` factor in the correct direction and do not round the stored
  value.
- Use a unit-bearing header or a valid row unit when available. Otherwise
  require an explicit import option. Do not read the current `settings.unit` as
  a source-unit guess.
- Reject a converted load above the existing 1,000 kg stored-input limit.
- A blank load with valid repetitions is retained as a bodyweight or unknown
  external-load set with `load: 0`. Do not copy today's bodyweight into the
  imported row. Such a row is not load-progression evidence.
- Convert RPE from 6 through 10 to `rir = 10 - rpe`. Store RPE from 0 through
  5 as unknown RIR (`null`), as Plan 027 specifies. Reject an RPE outside 0
  through 10. Preserve an explicit valid RIR without converting it. When both
  RIR and RPE exist, preserve RIR and do not infer or compare effort values.
- Import a valid reps-based drop set as work and record its source set type.
  Mark warm-ups with the existing `warmup: true` field. Skip Strong rest-timer
  rows as unsupported non-set rows and report their count.
- Do not reinterpret duration-only or distance-only activity as a strength set.
  Report and exclude those rows.

## Session grouping and duplicate behavior

Build the source session key in this order:

1. A source-provided workout/session ID, when present.
2. Otherwise, the exact source start timestamp plus source title.
3. Otherwise, source date plus source title plus duration, when duration exists.
4. Otherwise, source date plus source title.

If one key contains rows that cannot be distinguished as one or more sessions,
mark the group `session-identity-ambiguous`. Do not split by a guessed time or
merge a visibly repeated group. The final review must let the lifter split or
keep the group before validation.

Use a stable SHA-256 of the source key for `session` IDs. Compute
`sourceSessionFingerprint` from the normalized source facts before identity
choices, so a changed review decision cannot make an unchanged file look new.
Compute a separate semantic fingerprint after reconciliation. It uses the
canonical target ID for resolved rows and the source-scoped movement ID for
unresolved rows. The semantic fingerprint can find cross-source duplicate
candidates, but it never auto-skips one.

- Repeating an unchanged source session produces the same session ID and
  fingerprint. The future commit adapter skips a previously committed match.
- A source key seen before with a changed fingerprint is a conflict. Never
  replace or merge the existing session. The lifter can skip it or keep the
  changed export as a separate session with a content-specific ID.
- An exact semantic match from a different source is a possible duplicate,
  not proof of identity. Show it for an explicit skip or keep-separate choice.
- Similar date, title, set count, or exercise names alone never establish a
  duplicate.
- A repeated row with the same explicit source set key and identical values is
  reported once only when the session has a reliable source session ID. A
  conflicting row with the same key blocks that session. Without a reliable
  session ID, repeated set keys make the group ambiguous because they may be a
  second real session. When the source has no set key, preserve each input row
  as a separate set, even when its values match another set.
- Keep session rows in source exercise and set order. Reordering a generic file
  without a set index changes its meaning.

These rules preserve deterministic retries without collapsing two real
sessions that happen to use the same name or loads.

## Partial failure and import eligibility

The pipeline has five boundaries:

```text
raw text → parsed source records → normalized candidates → identity reconciliation → validated proposal
```

The durable commit is a later sixth boundary owned by the existing
`commitProposedState()` path.

- A file-level CSV quoting error, unknown schema, duplicate header mapping, or
  size/count limit rejects the file and produces no proposal.
- A bad row records a typed issue and source row number. Valid rows from other
  sessions remain reviewable.
- A session with rejected source rows remains visible as partial, but is not
  eligible for progression evidence. Store `sessionStatus: "partial"` on every
  row in that session so the final History and progression adapters can enforce
  that rule without reconstructing the import report.
- Unresolved identity, ambiguous session grouping, ambiguous units, and
  ambiguous dates block validation until an explicit decision resolves each
  blocker.
- A complete session with resolved movement identities may inform progression
  only through supported performed identity. Warm-ups stay excluded by the
  existing `isWork()` rule. Missing RIR yields weaker reps-only evidence, as
  Plan 027 describes. Rows with `load: 0` do not qualify as load evidence.
- Existing sessions and the active program are never edited or reattributed by
  reconciliation. An imported proposal appends new session rows only.
- Cancellation before commit discards the in-memory proposal. It writes no
  browser storage, does not create custom exercises, and needs no rollback.
- The final commit must revalidate against the lock-held durable head and
  source-session metadata, then append the selected batch in one canonical
  durable transaction. A rejected or deferred durable outcome is not success.
  The UI must keep the proposal available or let the lifter cancel it; it must
  not manually compensate with a second write.

The proposal is a deep-frozen value with copied rows and explicit diagnostics.
Mutating the caller's original input after proposal creation cannot change it.
No function in this plan writes the proposal to `localStorage` or IndexedDB.

## Compatibility and ownership

- Keep program-file import, free-form program handoff, full Taurifer JSON
  backup replacement, and backup log merge behavior unchanged.
- Keep the current Taurifer CSV as an analysis export. Detect it and refuse it
  as a migration source because it omits performed identity and migration
  provenance. Use the JSON backup for Taurifer-to-Taurifer transfer.
- Do not call `mergeImportedLog()` from the proposal builder. Its current
  session-ID de-duplication is not sufficient for source keys, changed exports,
  partial sessions, or lock-held duplicate revalidation.
- Do not modify `history-ui.js`, `app.js`, `durable-state.js`, `index.html`,
  `styles.css`, `i18n.js`, or the service-worker cache in the foundation slice.
- Keep parsing, normalization, unit/date policy, reconciliation, duplicate
  classification, and proposal validation in a new `history-import.js` module.
  The later History surface passes the shipped Plan 061 matcher through the
  module boundary.
- Plan 057 has merged and owns the current History route and read/edit/delete
  behavior. After Plan 058 settles system roles, the final import UI can use
  those contracts and the new importer interface. Plan 059 still owns the
  release evidence; its gate does not block this non-UI foundation.
- Durable integration is deferred. Before a later plan enables writes, it must
  preserve imported metadata through backup/restore and run the acceptance
  proofs below against real durable state, reload, concurrent writes, retries,
  and transaction failure.

## Implementation slices

| Slice | Outcome | Required proof |
|---|---|---|
| 1 | Add synthetic Hevy, Strong, and generic CSV fixtures with units, date/time variants, missing optional fields, renamed names, custom movements, repeated exports, repeated sessions, duplicate set keys, machine-specific labels, partial sessions, malformed rows, and empty files | Fixture headers match the documented schemas; no private data appears in the repository |
| 2 | Add bounded CSV parsing, source detection, adapters, normalized session/set candidates, dates, units, and source provenance | Parser tests cover BOM, CRLF, commas inside quotes, escaped quotes, delimiter choice, malformed quoting, unsupported headers, empty files, and limits |
| 3 | Add identity reconciliation through the injected Plan 061 matcher and stable source-scoped identity for unresolved movements | Real matcher exact, alias, probable, unmatched, ambiguous, custom, and machine-specific cases; Plan 061 strict and loose gates remain green |
| 4 | Add session/set duplicate classification, partial-failure results, explicit decisions, and immutable validated proposals | Identical retries are deterministic; duplicate and changed sessions follow the rules above; unresolved or malformed data cannot become a validated proposal |
| 5 | Add only corpus-supported aliases to `tools/exercise-curation.json` and regenerate `exercises.js` | Plan 061 fixture suite, exercise-library suite, and historical identity-preservation tests |

Do not start slice 2 until this plan has its own commit. Do not add a durable
commit function or production UI to any slice in this plan.

## Acceptance evidence

The foundation is complete when automated tests prove:

- Hevy, Strong, and generic adapters parse every supported header family and
  reject unsupported or ambiguous headers.
- Source, schema version, source-row facts, stable IDs, and source fingerprints
  are deterministic and contain no filename or raw-file payload.
- Date parsing preserves source calendar dates across process time zones and
  requires explicit day/month order when slash dates are ambiguous.
- kg and lb inputs normalize to canonical kg with no display-setting guess or
  rounding.
- Duplicate sessions, duplicate rows, changed source sessions, cross-source
  candidates, and repeated imports follow the rules in this plan.
- Exact, alias, probable, unmatched, custom, and machine-specific identities
  preserve Plan 061 status and never turn a fuzzy candidate into a library ID.
- Mixed valid and invalid rows retain actionable issues; an unvalidated or
  unresolved candidate cannot be returned as commit-ready.
- Proposal output is deeply immutable and detached from caller input.
- Existing backup, program-import, and History behavior remains untouched.

Use the focused history-import tests and Plan 061 matcher fixtures during the
edit loop. Run the affected regression after a coherent implementation packet
and the current repository candidate gate before requesting review. Do not
claim durable import, rollback after a storage write, final UI integration,
physical-device validation, or a full end-to-end import until a later plan
proves those paths.

## Adversarial review checklist

Before requesting review, try to falsify each point:

- Could an alias or fuzzy candidate repoint a source or pre-existing
  `libraryId`?
- Could an imported label join history by name after reconciliation failed?
- Could two machine variants acquire the same performed identity without an
  explicit choice?
- Could lb become kg twice, or could missing units inherit device settings?
- Could a UTC conversion move a local workout to another calendar day?
- Could a repeated export overwrite a corrected session or duplicate an
  unchanged one?
- Could duplicate set values cause a legitimate repeated set to disappear?
- Could a malformed row disappear without a source-row issue?
- Could a partial session qualify for progression?
- Could cancelling a proposal leave any durable marker or row behind?
- Does the implementation depend on Plan 057's History DOM or selectors?

## Deferred work

| Work | Status |
|---|---|
| Source parsing, normalization, provenance, candidate generation, reconciliation, duplicate detection, validation, and immutable proposals | Implement in this plan |
| Fixture-driven alias additions supported by the import vocabulary corpus | Implement only where the real Plan 061 matcher corpus proves a gap |
| Final History entry point and reconciliation/preview UI | Deferred until Plan 058 settles the design-system contracts; build on Plan 057's merged History behavior and meet Plan 059's release gate |
| Durable History commit, imported metadata validator/backup round-trip, atomic retry, rollback/recovery evidence, and progression eligibility integration | Deferred until the post-overhaul History contract is final |
| Additional vendor formats, arbitrary column mapping, measurements, bodyweight history, and duration/distance-only activities | Out of scope |
