# Mesocycle blocks — design spike

> **Status**: Design spike output from Plan 023 (commit `ff67850`, 2026-07-01).
> **Build plan**: `plans/024-mesocycle-blocks.md` (DRAFT — do not execute until
> a human reviews this document).
>
> **Evidence base**: Read against live `app.js`, `index.html`, and
> `test/simulation.mjs` at workspace HEAD. Line citations below match that tree;
> concurrent edits to `app.js` may drift line numbers slightly — re-grep before
> implementing Plan 024.

## Problem

Serious lifters organize training into mesocycle blocks (accumulation,
intensification, deload). Today they fake block structure with session notes or
an external spreadsheet. RepForge needs session-level block tagging, stats
filtering by block, retroactive reassignment, and CSV export — without a sixth
nav tab, without slowing the Log set-row loop, and without breaking the
local-first flat backup model.

## Product guardrails (constraints)

From `plans/README.md`:

| Guardrail | Implication for blocks |
|-----------|------------------------|
| No sixth nav tab | Block UI lives on Log (current block), Stats (filter), History (retroactive edit), Settings (optional registry) — never a new nav item. |
| Protect Log-tab speed | Block is **not** a per-set field; no extra tap in the default set-row flow. One optional field near the date picker, prefilled from settings. |
| New depth hidden/collapsed | Block **filtering** for charts/tables ships inside `#statsDeep` (Plan 015 pattern). Top-line metrics stay all-time by default. |
| No accounts/cloud | Block names and tags are local strings; export travels in JSON/CSV only. |
| Flat, forward-compatible backups | New fields must be optional on old rows; `normalizeLoaded` must tolerate missing keys. |

## Current state (verified)

### Sessions are implicit

There is **no session entity**. A session is all log rows sharing a `session`
id, created in `saveWorkout`:

```345:359:app.js
function saveWorkout(e){e.preventDefault();if(saving)return;saving=true;
  try{const date=$("#date").value||today(),session=`${date}_${day}_${uid()}`,notes=$("#notes").value.trim(),created=new Date().toISOString(),rows=[];
  const bwRaw=$("#bodyweight").value,bw=bwRaw===""||bwRaw==null?0:posNum(fromDisplay(bwRaw));
  for(const ex of exercises()){if(skipped.has(ex.id))continue;for(let n=1;n<=ex.sets;n++){
    // ...
    const row={session,date,day,name:ex.name,exerciseId:ex.id,set:n,load,reps,rir,notes,created,primary:ex.primary,secondary:ex.secondary};
    if(bw>0)row.bodyweight=bw;
    rows.push(row)}}
  // ...
```

Per-session metadata (`notes`, `bodyweight`) is **denormalized onto every row**
in the session — the same pattern Plan 009 used for bodyweight.

### No existing block or session-metadata store

STOP-condition check (Plan 023): grep for `block`, `sessionMeta`, and mesocycle
concepts in application source at spike time found **none**. The spike premise
holds.

### Settings normalization

`state.settings` is normalized by `normalizeSettings` (`app.js:49`). Adding
`currentBlock` (active block name for new saves) fits the existing settings
object without a new top-level key.

### Stats depth pattern

Charts and volume audit live behind `<details id="statsDeep">`
(`index.html:70-86`). Top-line tiles and the attention board render outside
that collapse — Plan 015's "actionable default."

### Retroactive session editing

`sessionEditor` / `saveSessionEdit` (`app.js:488-511`) already rewrite every
row in a session (date, load, reps, RIR). Block assignment can follow the
same loop.

---

## Affected surfaces — `state.log` consumers

Every `state.log` reference in `app.js`, classified for mesocycle block work.
**Block-relevant** sites need a filter helper or a write path when blocks ship;
**block-irrelevant** sites intentionally use full history.

| Site | `file:line` | Role | Block relevance | Notes for Plan 024 |
|------|-------------|------|-----------------|-------------------|
| Row migration | `app.js:144-148` | `migrateLog` — backfill `exerciseId`, coerce numerics | Irrelevant | No block migration on old rows; absent `block` = unassigned. |
| Last session for lift | `app.js:159-162` | `last()` — most recent session's sets for copy-last | Irrelevant | Recommendations should use full history, not current block only. |
| Session history per lift | `app.js:164-170` | `sessionsFor()` — progression input to `recommendation()` | Irrelevant | Double-progression spans blocks; filtering would break stall detection. |
| Bodyweight prefill | `app.js:176-178` | `lastBodyweight()` | Irrelevant | Independent of block. |
| Save workout | `app.js:345-359` | `saveWorkout` — push new rows | **Relevant (write)** | Stamp `block` from `#currentBlock` / `settings.currentBlock` on each new row. |
| Per-(session,lift) summaries | `app.js:361-367` | `summaries()` | **Relevant (read)** | Feed chart/trend/recent when block filter active in Stats deep section. |
| Stats tiles | `app.js:369-378` | `renderStats` — sessions, sets, volume, best e1RM | **Relevant (read, optional)** | v1: keep tiles all-time (actionable default). Optional vou: respect filter when `#statsDeep` block filter is active and user expands scope — defer to open question. |
| Exercise picker + chart data | `app.js:369-386` | `renderStats` — names, `sums`, `draw(rows)` | **Relevant (read)** | Filter `sums` / underlying log before `summaries()` when block scope ≠ all. |
| Trend + recent table | `app.js:388-395` | `renderStats` | **Relevant (read)** | Same filtered `rows` as chart. |
| Top loads by exercise | `app.js:396-400` | `renderStats` — scan all log rows | **Relevant (read)** | Apply block filter to the `state.log` scan. |
| Attention board | `app.js:405-416` | `renderAttention()` — uses `recommendation()` | Irrelevant | Action board is forward-looking; not block-scoped. |
| Completed hard sets | `app.js:418-428` | `renderCompleted()` — rolling `volWindow` | **Relevant (read)** | Block is an alternative window to 7/28-day cutoff; extend scope control. |
| Chart draw | `app.js:430-462` | `draw()` | **Relevant (read)** | Consumes pre-filtered rows from `renderStats`; no direct `state.log` access. |
| Chart redraw | `app.js:464-465` | `redrawChart()` | **Relevant (read)** | Must re-filter when block scope changes. |
| History session list | `app.js:467-479` | `renderHistory()` — group by session | **Relevant (read/display)** | Show block label on session card; open editor for retroactive assign. |
| Session delete | `app.js:480` | filter out session rows | Irrelevant | Block field deleted with rows. |
| History every-set table | `app.js:484-485` | flat table of all rows | **Relevant (display)** | Optional `Block` column when any row has `block`. |
| Session edit save | `app.js:502-511` | `saveSessionEdit()` — rewrite session rows | **Relevant (write)** | Stamp or clear `block` on all rows in session. |
| Day rename | `app.js:568-571` | `bindEditor` — rename `row.day` | Irrelevant | Orthogonal to block. |
| CSV export | `app.js:618-635` | `exportCsv()` | **Relevant (read)** | Add `block` column (spreadsheet persona requirement). |
| Import preview counts | `app.js:641-642` | `importJson()` session/set counts | **Relevant (read)** | Display only; merge path must preserve `block` on imported rows. |
| Delete log | `app.js:674` | `#reset` clears log | Irrelevant | Clears blocks with log. |

**Simulation** (`test/simulation.mjs`): no direct `state.log` aggregation today;
Plan 024 adds Playwright checks for save, filter, export, and merge round-trip.

**Out of scope for block filtering**: `recommendation()`, `sessionsFor()`,
`last()`, `renderAttention()`, `renderVolume()` (program template), program
editor volume audit.

---

## Data model candidates

### Comparison

| Criterion | A. Denormalized `block` on each row | B. `state.blocks` date ranges | C. `state.sessionMeta` map |
|-----------|-------------------------------------|------------------------------|------------------------------|
| Matches flat-log / backup philosophy | **Strong** — row self-describes; JSON backup is a single `log` array | Medium — new top-level array; sessions inferred by date | Medium — new top-level map; log rows unchanged |
| Retroactive re-assignment | Update all rows in session (same as date edit today) | Change range boundaries; ambiguous for edge sessions | **Strong** — one map entry per session id |
| Plan 018 merge (union by session id) | **Strong** — imported rows carry `block`; no merge logic | Weak — date ranges from two devices may conflict | Needs `sessionMeta` merge keyed by session id |
| CSV export | **Trivial** — column on row | Must join session date to range | Must join session id to map |
| Forward compat of old backups | **Strong** — missing field = unassigned | Old backups have no ranges | Old backups have no map |
| Code churn | **Low** — mirrors `notes` / `bodyweight` | Medium — new filter predicate by date | High — new normalize path, editor, export join |
| Integrity if rows disagree within session | Weak (same as `notes` today) | N/A | **Strong** |
| Future home for `notes` / `bodyweight` | No | No | **Yes** (out of scope for v1) |

### Recommendation: **Candidate A** — denormalized `block` string on each log row

**Rationale.** Plan 009 established denormalized session fields on rows as the
accepted pattern. Plan 019's per-row `warmup` boolean composes independently.
Plan 018's merge pushes foreign rows wholesale — a `block` field on each row
merges without new merge rules. Retroactive assignment reuses the existing
`saveSessionEdit` "touch every row in session" loop. CSV gets a column for free.

Supplement with **`settings.currentBlock`** (string, default `""`): the Log form
prefills from settings; `saveWorkout` copies it onto each new row. Changing the
Log field updates settings on save so the next session inherits the active block.

**Not recommended for v1:** Candidate B (date ranges) fails retroactive edits
and import merge ambiguity when two devices define overlapping ranges.
Candidate C is the right long-term normalization for session metadata but is
L-effort on its own; blocks should not wait for a session-meta refactor.

**Field shape:**

```js
// On log row (optional — absent = unassigned)
{ /* existing fields */, block: "Hypertrophy W3" }

// In settings (via normalizeSettings)
{ /* existing */, currentBlock: "Hypertrophy W3" }
```

Block value is a **freeform string** (user-typed or chosen from a datalist of
distinct values already in the log). No block type enum in v1.

### Composition with recent schema precedents

| Plan | Interaction |
|------|-------------|
| **018 Import merge** | Merged rows retain their `block` string. No change to `mergeLog` beyond rows already carrying the field. Replace-all import replaces entire state including blocks. |
| **019 Warmup flag** | Independent per-row boolean. Block filter predicates should not exclude warmups differently from today — warmup exclusion stays in `isWork` (Plan 019). Block column exports for all rows. |
| **009 Bodyweight / notes** | Same denormalization contract: one session-level value copied to every row at save; session editor can rewrite all rows. |

### Proposed ADR (draft — maintainer adopts or edits)

> **Mesocycle blocks are modeled as an optional `block` string denormalized
> onto each log row, with `settings.currentBlock` recording the active block for
> new sessions.** Sessions remain implicit (rows sharing a `session` id); there
> is no separate blocks table or date-range registry in v1. Stats filtering
> and CSV export read `row.block` directly. Retroactive assignment updates every
> row in the session, consistent with how `date` and `notes` are already
> handled. Old backups without `block` are valid and appear as "Unassigned" in
> filters. This follows the flat-log persistence rule: plain objects in JSON,
> forward-compatible optional fields, no server schema.

---

## UI design

All insertion points reference `index.html` / `app.js` at spike time. Each
decision names the guardrail it satisfies.

### 1. Current block (Log tab)

**Where:** `index.html:40-43` — inside `.sectionhead__row`, after the date
picker label.

```html
<label class="blockpick">Block
  <input id="currentBlock" type="text" list="blockSuggestions"
         placeholder="Optional" autocomplete="off">
</label>
<datalist id="blockSuggestions"></datalist>
```

**Behavior (`app.js`):**

- `init` / `renderWorkout`: set `#currentBlock` from
  `state.settings.currentBlock`; populate `#blockSuggestions` from
  `[...new Set(state.log.map(r=>r.block).filter(Boolean))]`.
- `saveWorkout` (`app.js:345-359`): read `#currentBlock`, trim; if non-empty
  set `row.block` on each pushed row; always persist
  `state.settings.currentBlock` in `normalizeSettings`.
- Do **not** clear `#currentBlock` after save (same as bodyweight — consecutive
  sessions stay in the same block).

**Guardrails:** Not in set-row flow (Log speed). No new nav tab. Optional field
— empty is valid.

**Why not Settings-only?** Settings is five taps away on mobile; block changes
at the start of a mesocycle happen on the Log tab the same day as the date
picker. Settings may later host a "Manage block labels" cleanup list (out of
scope v1).

### 2. Block filter (Stats tab)

**Where:** `index.html:77-83` — extend the completed-volume scope control and
generalize it to a **stats scope** bar inside `#statsDeep` only.

Replace the volume-only segment with a two-row control:

```html
<div id="statsScope" class="seg seg--scope" role="tablist" aria-label="Stats scope">
  <button type="button" data-scope="all" class="active">All time</button>
  <button type="button" data-scope="7" role="tab">7 days</button>
  <button type="button" data-scope="28" role="tab">28 days</button>
</div>
<label class="field field--inline">Block
  <select id="blockFilter">
    <option value="">Any block</option>
    <!-- distinct blocks from log + "Unassigned" -->
  </select>
</label>
```

**Behavior:**

- Module state: `statsScope` (`"all"|"7"|"28"`) replaces `volWindow` for the
  deep section; `blockFilter` (`""` = any, `"__none__"` = unassigned, else
  string match).
- `renderStats` deep section (`app.js:369-401`, `418-428`): helper
  `logForStats()` applies date cutoff when scope is 7/28, then block filter.
  Top metrics (`#metrics`) and `#attention` stay **unfiltered** (Plan 015
  actionable default).
- `renderCompleted` (`app.js:418-428`): when `blockFilter` is set, ignore
  rolling window and filter by block only; when block is "Any", keep today's
  7/28-day behavior.
- Wire `$("#blockFilter").onchange` and scope buttons in `init` (`app.js:672`
  area).

**Guardrails:** Filter UI inside collapsed `#statsDeep`. No sixth tab.

**Why extend volWindow?** A block is semantically a training window — the same
user mental model as 7/28 days. One scope bar avoids two competing "window"
controls.

### 3. Retroactive block assignment (History tab)

**Where:** `sessionEditor` (`app.js:488-500`) — add a block field in
`.edhead` next to the date input:

```html
<label class="edblock">Block
  <input data-ed="block" type="text" list="blockSuggestions"
         value="…" placeholder="Unassigned">
</label>
```

**Save:** `saveSessionEdit` (`app.js:502-511`) — after date rewrite, set
`r.block` to trimmed value or delete key if empty for every row in session.

**Display:** Session list card (`app.js:475-476`) — append block name to
`.session__sub` when present: `· Block: Hypertrophy W3`.

**Guardrails:** History tab, not Log set-row flow. Edit mode only.

### 4. CSV export

**Where:** `exportCsv` cols array (`app.js:620-630`) — insert after `day`:

```js
["block", r => r.block ?? ""],
```

**Guardrails:** Spreadsheet persona; export-shaped, no cloud.

### 5. Explicit non-goals (UI)

- **No sixth nav tab** for block management.
- **No block field on set rows** — not in `renderWorkout` set template
  (`app.js:246-252`).
- **No block filter on recommendations** — Log tab stays progression-focused
  across full history.

---

## Open questions

Each question has a recommended answer. **Blocks build** = must be decided
before Plan 024 execution.

| # | Question | Recommendation | Blocks build? |
|---|----------|----------------|---------------|
| 1 | Can two blocks overlap in time (same calendar dates, different tags)? | **Yes implicitly** — v1 is session tags, not date ranges. Two sessions on the same day can have different blocks if the user assigns them. No validation. | No |
| 2 | Is "Unassigned" / "no block" a first-class filter value? | **Yes** — `#blockFilter` includes "Unassigned" (`__none__`) alongside named blocks and "Any block". | **Yes** |
| 3 | Should top-line Stats metrics respect the block filter? | **No for v1** — keep `#metrics` all-time; only `#statsDeep` respects filter. Avoids an empty-looking Stats tab when a narrow block is selected. | No |
| 4 | Do deload weeks get a block *type* (accumulation/intensification/deload enum)? | **Defer** — freeform string only in v1. Revisit when volume-audit intelligence needs phase-aware rules. | No |
| 5 | Block registry / rename (rename "Block A" everywhere)? | **Defer** — datalist from distinct strings is enough for v1. Bulk rename is a follow-up. | No |
| 6 | Should `notes` / `bodyweight` migrate to `sessionMeta` when blocks ship? | **No** — out of scope; denormalized block matches existing pattern. Candidate C remains a future refactor. | No |
| 7 | Import merge when the same `session` id exists on both devices? | **Keep Plan 018 rule** — skip duplicate session ids; block conflicts on duplicate ids are impossible today. Document that changing session id format would be a separate decision. | No |
| 8 | Filter warmups when computing block-scoped volume? | **Same rules as today** — `renderCompleted` already applies hard-set RIR ceiling; Plan 019 adds warmup exclusion via `isWork`. Block filter does not change warmup semantics. | No |

### Kill criteria (do not build if…)

- Maintainer rejects denormalized row fields and demands Candidate C first —
  re-scope Plan 024 to a session-meta refactor (L effort).
- Maintainer requires date-range blocks (Candidate B) with automatic assignment
  by calendar — design does not fit implicit sessions; new spike needed.
- Product insists block filter must apply to recommendations — conflicts with
  progression-across-blocks behavior; needs explicit product decision.

---

## Assumptions and drift notes

- Line numbers cite the tree at Plan 023's `ff67850` baseline; executor for
  Plan 024 should re-verify after Plans 018–019 land.
- Plan 019 (`warmup`) and Plan 018 (merge chooser) are **planned** but not
  assumed landed; composition notes above still apply when they do.
- `volWindow` module variable (`app.js:136`) becomes `statsScope` in the build;
  documented here as a rename, not a second parallel control.

---

## References

- Plan 023 spike brief: `plans/023-mesocycle-blocks-design-spike.md`
- Draft build plan: `plans/024-mesocycle-blocks.md`
- Persona source: `docs/persona-product-feedback-report.md` (spreadsheet
  maximalist — mesocycle block ID in export)
- Program persistence philosophy: `app.js:84-90`
