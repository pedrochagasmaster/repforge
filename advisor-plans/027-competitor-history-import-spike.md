# Plan 027 (spike): Specify importing training history from Hevy/Strong CSV exports so a switching lifter gets real recommendations on day one

> **Executor instructions**: This is a **specification spike**. It produces a
> mapping spec, fixture samples, and a feasibility prototype that runs outside
> the app. No production code changes. Stop after the report. Update this
> plan's row in `advisor-plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 76a31602..HEAD -- app.js docs/backlog.md`
> Then confirm the anchors below still exist:
> `grep -n "function mergeImportedLog\|function rankImportCandidates\|function classifyImportRow\|function matchLift" app.js`

## Status

- **Priority**: P3 (direction; migration path for switchers)
- **Effort**: M (spike); the eventual build is L
- **Risk**: LOW (no production change)
- **Depends on**: none
- **Category**: direction (acquisition / migration)
- **Planned at**: commit `76a31602`, 2026-09-23 (on `origin/ui-overhaul/057-management-surfaces`)
- **Backlog**: **Next (post-overhaul)**: the history-import specification that §2 item 1 "Historical migration foundation — Hevy, Strong, generic CSV" requires before code (PR #249; Q615). That queue activates only after the overhaul's launch-validation boundary clears.

## Why this matters

The thesis names Hevy as the dominant Portuguese-language competitor in Brazil (`docs/business-product-thesis.md:121-129`, `624-652`) and treats bringing your own program as the migration path for switchers. A switcher arrives with months of logs, but Taurifer starts every lift at "New lift — No history yet. Pick a load you can hold…" (`i18n-en.json:640-641`). The engine's capacity baselines ("median over its last few sessions", `CONTEXT.md`) take weeks to form. The app already *exports* its log as CSV (`app.js:10341`), but it imports only its own JSON (`index.html:312,520`). Importing history converts "start over" into "continue", and that is the moment a switcher decides whether the product is better.

## Current state

- `mergeImportedLog(incoming,io)` (`app.js:2552-2565`) validates a full state shape, adds only sessions whose `session` id is not already present, runs `migrateLogSnapshot(proposal)`, and commits through `commitProposedState`:

```js
  const rows=(incoming.log||[]).filter(r=>r&&r.session);
  const have=new Set(state.log.map(r=>r.session));
  const add=rows.filter(r=>!have.has(r.session));
```

- Log-row shape (from `test/history.mjs` `buildFixture` and `CONTEXT.md` "Log row" / "Performed snapshot"): `{session, date, day, name, exerciseId, set, load, reps, rir, notes, created, primary, secondary}`, plus optional performed snapshot fields `performedLibraryId`, `performedName`, and so on.
- **History feeds recommendations by movement identity.** `matchLift(ex)` (`app.js:4528-4535`): when a row has `performedLibraryId`/`performedMovementId`, it matches by `liftKey(row)===exerciseLiftKey(ex)`. So imported rows stamped with the right library id inform the matching program slot's `recommendation()`.
- Name → library matching (Plan 061): `rankImportCandidates(name,candidates,limit)` (`app.js:~11283`) and `classifyImportRow(row,candidates)` (`app.js:~11252`), with curated aliases in `tools/exercise-curation.json`. The import review UI already resolves likely/unknown names (`CONTEXT.md` "Import review").
- Capacity needs RIR. Foreign exports typically carry RPE or nothing. `CONTEXT.md` "Capacity": RIR is credited only up to `hardRir`, so rows without trusted RIR yield weaker (reps-only) evidence.
- Units: `settings.unit` is `kg` or `lb`. Brazil is kg-first. The lb contract is itself a deferred backlog item (`docs/backlog.md` §5 "Pound display and actionable increments").

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Prototype | `node /tmp/history-import/prototype.mjs <sample.csv>` (you write it; outside the repo) | prints a mapping report |
| Library access in Node | load `exercises.js` via `createRequire` (UMD; exports the library; see how `test/generative/adapters/domain-adapter.mjs` loads it) | array of 270 entries |

## Scope

**In scope:** `docs/design/history-import.md` (create); anonymized sample fixtures under `test/fixtures/history-import/` (create; **only synthetic or explicitly consented data**, no real personal logs); a scratch prototype in `/tmp` (not committed).
**Out of scope:** any app change, parser in `app.js`, UI, or catalog.

## Steps

### Step 1: Collect real format evidence

Obtain the current CSV export formats of Hevy and Strong from their own documentation or a real export made with a test account. Record the header row and 3 synthetic rows for each in `test/fixtures/history-import/{hevy,strong}.sample.csv`. **Do not guess column names**: if you cannot obtain an authoritative sample, record that in the note and STOP for that app.

**Verify**: each fixture's header line is cited to its source (URL or "exported from a test account on <date>").

### Step 2: Mapping spec

In `docs/design/history-import.md`, define per source:
- column → log-row field (date/time → `date`/`created`; workout title → `day`; exercise name → `name` + library resolution; set order → `set`; weight/reps → `load`/`reps`; RPE → `rir` as `10 − RPE` **only** when RPE ≥ 6, otherwise `null`, with the trust rule stated)
- session grouping (what makes one Taurifer `session`) and deterministic `session` ids, so re-importing the same file is idempotent under `mergeImportedLog`'s id dedupe
- warm-up and drop-set handling
- unit conversion rules (never falsify history; see the backlog item "Pound display and actionable increments")
- which rows are rejected, and how partial failure is reported

**Verify**: every field of the log-row shape above appears in the spec with a rule or "not set".

### Step 3: Identity reconciliation feasibility

Write `/tmp/history-import/prototype.mjs`. It loads `exercises.js`, reimplements (copies) the ranking logic from `rankImportCandidates` for measurement only, parses the fixtures, and reports how many distinct exercise names map exactly, map as "likely", or stay unknown. Also run it on a larger synthetic list of 60 common gym exercise names in EN and PT.

**Verify**: the note contains the match-rate table and states whether the existing import-review UI can resolve the unknowns without a new screen.

### Step 4: UX and value sketch, then stop

In the note: where the entry point lives (the import route already has two doors, file and paste; this would be a history import, **not** a program import, so recommend placing it under Settings → Data, beside backup import), the review step, and what the lifter sees afterwards (the first recommendation for a matched lift uses imported sessions). Estimate the build effort, and report.

**Verify**: the note has sections for format evidence, mapping, identity, UX, effort, and open questions.

## Done criteria

- [ ] `docs/design/history-import.md` covers all Step 2–4 items with cited format evidence
- [ ] Fixtures exist (synthetic or consented only); no production change (`git diff --stat -- '*.js' ':!test/**'` is empty)
- [ ] The `advisor-plans/README.md` row is updated, and the owner is asked to schedule the build

## STOP conditions

- An authoritative format sample cannot be obtained for either source.
- The matching prototype resolves fewer than half of the common exercise names. Report the numbers; the build may need an alias pass first (backlog §6 "Systematic exercise alias pass").
- The only available sample contains real personal data without consent. Discard it.

## Maintenance notes

- Imported rows must carry the performed snapshot (`performedLibraryId`), so History and volume credit the right movement (`CONTEXT.md` "Performed snapshot").
- A future build must keep imports inside the durable-state transaction path (`commitProposedState`), never writing storage directly.
