# Plan 023: Mesocycle blocks — design spike (no production code)

> **Executor instructions**: This is a **design spike**, not a build plan.
> The deliverable is a design document plus a follow-up build-plan draft —
> you must NOT modify `app.js`, `index.html`, `styles.css`, `sw.js`, or
> `test/simulation.mjs`. Follow the steps, answer every design question with
> evidence from the codebase, and record open questions honestly rather than
> resolving them by fiat. If anything in the "STOP conditions" section
> occurs, stop and report. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ff67850..HEAD -- app.js index.html`
> If these changed, read the diff first — your design must describe the code
> as it exists, not as excerpted here.

## Status

- **Priority**: P3
- **Effort**: M (for the spike; the build it specifies is L)
- **Risk**: LOW (spike itself changes no code)
- **Depends on**: none (Plans 006 stable IDs and 015 stats collapse are DONE,
  which is what the backlog was waiting for)
- **Category**: direction (design)
- **Planned at**: commit `ff67850`, 2026-07-01
- **Source**: Report §5 "Next 6 months" — "**Mesocycle blocks** — tag
  sessions, filter stats/volume by block | Spreadsheet killer; training
  system maturity"; `plans/README.md` backlog ("Large data-model change;
  sequence after 006 + 015 land"). Spreadsheet-maximalist persona.

## Why this matters

Serious lifters train in blocks (accumulation, intensification, deload) and
currently fake it with the session-notes field or an external spreadsheet.
Block tagging is the largest remaining data-model change on the roadmap; a
wrong first cut (e.g. block-per-row denormalization that can't represent
retroactive edits, or a sixth-tab UI that violates the guardrails) would be
expensive to unwind. This spike buys certainty: it produces a reviewed design
and an executable build plan before any schema bytes change.

## Current state (starting evidence — verify each during the spike)

- Sessions are implicit: log rows sharing a `session` id
  (`` `${date}_${day}_${uid()}` ``, `saveWorkout` at `app.js:346`). There is
  **no session entity** — per-session metadata is denormalized onto every row
  (`notes`, `bodyweight` — see `app.js:353-354`).
- Stats consumers that a block filter would touch:
  - `summaries()` (`app.js:361-367`) — per-(session, lift) aggregation.
  - `renderStats` (`app.js:369-402`) — tiles, trend, recent, top loads.
  - `renderCompleted` (`app.js:419-428`) — hard sets over a rolling window
    (7/28 days via `volWindow`, `app.js:672`) — a block is an alternative
    window.
  - `draw`/`redrawChart` (`app.js:430-465`) — chart of top load per session.
- The Stats tab collapses depth behind `<details id="statsDeep">`
  (`index.html:70-86`) — Plan 015's "actionable default" pattern any block UI
  must respect.
- Session editing exists (`sessionEditor`, `app.js:488-511`) — a natural
  place for retroactive block assignment.
- Settings storage: flat `state.settings` normalized by `normalizeSettings`
  (`app.js:49`); adding `currentBlock` there is one option to evaluate.
- CSV export (`app.js:618-635`) — the spreadsheet persona will expect a
  `block` column.
- Product guardrails (`plans/README.md`, non-negotiable): no sixth nav tab;
  new depth ships hidden/collapsed/off the Log tab; protect Log-tab speed;
  no accounts/cloud.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Serve app | `python3 -m http.server 8000` (repo root) | serving on :8000 |
| Explore state | DevTools console on `http://localhost:8000/` | — |
| Syntax check (doc snippets only) | `node --check <scratch file>` | exit 0 |

## Scope

**In scope** (the only files you may create or modify):
- `docs/design/mesocycle-blocks.md` (create — the design doc)
- `plans/024-mesocycle-blocks.md` (create — the draft build plan)
- `plans/README.md` (status row + register plan 024 as DRAFT)

**Out of scope** (do NOT touch):
- ALL application and test source files. This plan writes documents only.
- Any ADR under `docs/adr/` — propose ADR text inside the design doc; the
  maintainer decides whether to adopt it.

## Git workflow

- Branch: `advisor/023-mesocycle-spike` (or the operator's requested branch).
- One commit per document is fine. Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Verify the evidence base

Read the "Current state" sites above in the live code and correct any drift.
List every consumer of `state.log` that aggregates across sessions (grep for
`state.log` — there are ~20 references) and classify each as
block-relevant / block-irrelevant in a table that goes in the design doc.

**Verify**: the design doc's "Affected surfaces" table cites `file:line` for
every `state.log` aggregation site.

### Step 2: Decide the data model (argue it, don't assert it)

Evaluate at least these three candidates against: retroactive re-assignment,
import/merge (Plan 018) compatibility, CSV export, forward compatibility of
old backups, and code churn:

- **A. Denormalized `block` string on each log row** (like `notes` /
  `bodyweight` today). Cheap, matches the flat-log model; retroactive edits
  touch many rows.
- **B. A `state.blocks` array of `{id,name,start,end?}` date ranges**;
  sessions belong to a block by date. No row changes at all; ambiguous when
  training spans a block boundary mid-day or when history is imported.
- **C. A `state.sessionMeta` map keyed by session id** (`{block,...}`).
  Normalizes session metadata for the first time; most invasive; also the
  natural future home for `notes`/`bodyweight`.

The doc must end with a recommendation and a one-paragraph proposed ADR
("Mesocycle blocks are modeled as …") consistent with the flat-log philosophy
documented in the Program-model comment at `app.js:84-90` ("Persisted as
plain objects … so backups stay forward-compatible").

**Verify**: the doc contains the comparison table, a recommendation, and the
draft ADR paragraph.

### Step 3: Design the UI within the guardrails

Specify, with exact insertion points in today's markup:

- Where the *current block* is set (candidate: a field near the date picker
  on the Log form, `index.html:42`, or in Settings — argue which respects
  Log-tab speed better).
- Where block filtering appears in Stats (candidate: extend the `#volWindow`
  7/28-day segment control at `index.html:79-82` with block options, since a
  block is semantically "a window").
- How retroactive assignment works (candidate: a block field in
  `sessionEditor`).
- What CSV export adds (a `block` column at `app.js:620-630`).
- Explicitly: **no new nav tab**, nothing added to the default set-row flow.

**Verify**: each UI decision names the file/line it would modify and states
which guardrail constrains it.

### Step 4: Define open questions and kill criteria

Record what the maintainer must decide before building (e.g. can blocks
overlap? is "no block" a first-class filter value? do deload weeks get a
block *type* for future volume-audit intelligence?). Give a recommended
answer per question and mark which ones block the build plan.

**Verify**: the design doc's "Open questions" section exists; every question
has a recommendation.

### Step 5: Draft the build plan

Write `plans/024-mesocycle-blocks.md` using the structure of an existing
executable plan in `plans/` (e.g. `plans/009-bodyweight-per-session.md` as
the template): status header, why, current state with excerpts, scope, steps
with per-step verification, simulation checks, done criteria, STOP
conditions. Mark its status header `DRAFT — pending design review of
docs/design/mesocycle-blocks.md` and register it in `plans/README.md` as
DRAFT (not TODO).

**Verify**: `plans/024-mesocycle-blocks.md` exists and its steps are
consistent with the design doc's recommendation (no contradictions).

## Test plan

Not applicable — no code changes. The quality gate is document completeness
(the per-step Verify lines) and internal consistency between the two
documents.

## Done criteria

ALL must hold:

- [ ] `docs/design/mesocycle-blocks.md` exists with: affected-surfaces table
      (with `file:line` citations), data-model comparison + recommendation,
      draft ADR paragraph, UI design with insertion points, open questions
      with recommendations
- [ ] `plans/024-mesocycle-blocks.md` exists, marked DRAFT, structurally
      matching the repo's plan template
- [ ] `git status` shows only the three in-scope paths created/modified
- [ ] `plans/README.md` updated: 023 status + 024 registered as DRAFT

## STOP conditions

Stop and report back (do not improvise) if:

- You find an existing session-metadata store or block concept in the code
  that "Current state" doesn't mention — the codebase has moved and the spike
  premise needs re-scoping.
- The three data-model candidates all fail a hard requirement (e.g. Plan 018
  merge makes all of them unsound) — report the conflict instead of inventing
  a fourth model unreviewed.
- You are tempted to "just prototype it" in `app.js` — that is a build, not a
  spike.

## Maintenance notes

- The follow-up build (024) should be executed only after a human reviews the
  design doc — the DRAFT status encodes that.
- Whichever data model wins, Plan 018's merge (union by session id) and
  Plan 019's warmup flag (per-row boolean) are the two recent schema
  precedents; the design should name how it composes with both.
