# Plan 019: PR ledger per exercise (load / rep / e1RM)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ff67850..HEAD -- app.js index.html styles.css test/simulation.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (plan 007 rich CSV / stable IDs DONE)
- **Category**: direction
- **Planned at**: commit `ff67850`, 2026-07-01
- **Source**: Spreadsheet maximalist §429, minimalist §496; report §5 "Next 6 months"

## Why this matters

`#tops` shows a single best load per exercise with no history or date context.
The spreadsheet persona wants "date, load, reps, RIR, delta from previous PR" —
motivation and auditability without social features. This is pure derivation from
`state.log` plus a small read-only UI inside existing Stats "Dig deeper".

## Current state

Top loads table — one row per exercise, heaviest load only:

```396:400:app.js
  const topByLift=new Map();
  for(const x of state.log){const k=liftKey(x),ld=+x.load,cur=topByLift.get(k);
    if(!cur||ld>cur.load||(ld===cur.load&&+x.reps>+cur.reps))topByLift.set(k,{Exercise:exerciseLabel(x),load:ld,reps:x.reps,rir:x.rir,date:x.date})}
  const progRows=[...topByLift.values()].sort((a,b)=>b.load-a.load||b.reps-a.reps).map(r=>({Exercise:r.Exercise,[unitLabel()]:fmtLoad(r.load),Reps:r.reps,RIR:fmt(r.rir),Date:r.date}));
  $("#tops").innerHTML=table(progRows);
```

e1RM helper already exists:

```25:25:app.js
const e1rm=(load,reps)=>load>0&&reps>0?load*(1+reps/30):0;
```

CSV export includes per-set e1RM (plan 007):

```624:624:app.js
    ["e1rm",r=>+e1rm(+r.load,+r.reps).toFixed(2)],
```

Stats deep section is collapsible (`#statsDeep`) — PR ledger belongs there,
not on the default Stats surface (minimalist guardrail).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope**:

- `app.js` — pure functions `detectPRs(log, { exerciseId?, kinds })` returning
  chronological PR events; `renderPRs()` populating new `#prLedger` container
- `index.html` — `<h3>` + `<div id="prLedger">` inside `#statsDeep`, after Top loads
- `styles.css` — compact PR list (`.pr-row`, badge for kind: Load / Reps / e1RM)
- `test/simulation.mjs` — assert PR detection after staged loads

**Out of scope**:

- Manual PR override / delete (v2)
- Social sharing of PRs (rejected)
- Push notifications ("New PR!")
- Warmup sets (plan 018) — if 018 not landed, filter `load>0` only; if landed,
  use `isWorkingSet`

## Git workflow

- Branch: `cursor/pr-ledger-fb30`
- Do NOT push unless instructed

## Steps

### Step 1: PR detection pure function

Add `detectPRs(log, opts)` in `app.js` (no DOM):

- Iterate log rows sorted by `date`, then `created`
- Track per `liftKey(row)` (exerciseId preferred): best load, best reps at max
  load, best e1RM
- Emit event when strictly exceeded: `{ kind: "load"|"reps"|"e1rm", date, load,
  reps, rir, exerciseName, exerciseId, deltaLoad?, deltaE1rm? }`
- Skip rows with `load<=0` or `kind==="warmup"` if plan 018 exists

Unit-test via simulation, not a new test framework.

**Verify**: `node --check app.js` → exit 0

### Step 2: Stats UI (Dig deeper only)

In `index.html` inside `#statsDeep`, after `#tops`:

```html
<h3 class="subhead">PR history</h3>
<p class="lede">Load, rep, and e1RM records per exercise — derived from your log.</p>
<div id="prLedger" class="table"></div>
```

Implement `renderPRs()` called from `renderStats()`:

- Filter dropdown: reuse `#statExercise` value OR show all exercises' PRs grouped
  (recommended: show PRs for **selected** exercise only to match chart context)
- Table columns: Date, Kind, Load, Reps, RIR, e1RM, Δ vs prev
- Empty state: "Log working sets to track PRs."

**Verify**: Manual — log ascending loads on one exercise → ledger shows 3 load PRs
with positive deltas.

### Step 3: Export hook (optional column)

Add sheet-friendly export: extend CSV is optional; at minimum add PR summary to
backup JSON is **out of scope**. Optionally add button "Export PRs CSV" in
Stats deep — **skip unless time**; table UI is sufficient for v1.

**Verify**: PR ledger visible only when `#statsDeep` is open (default closed).

### Step 4: Simulation

Seed two sessions on same exercise: 80×8 then 85×8. Assert `detectPRs` via
`page.evaluate` returns at least one `kind:"load"` event with `deltaLoad > 0`.

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`

## Test plan

- First logged set is a PR (all kinds)
- Tie on load but higher reps → rep PR at same load
- Higher e1RM at lower load (high rep PR) → e1RM PR event
- Different exercises don't cross-contaminate
- Rename exercise (same exerciseId) — PRs stay keyed by id

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`
- [ ] PR ledger renders inside `#statsDeep` only; default Stats view unchanged
- [ ] No new nav tab
- [ ] `plans/README.md` row 019 updated

## STOP conditions

Stop if:

- PR detection requires storing new state in `repforge_v1` (must be derived-only)
- Product owner rejects three PR kinds — report and await decision

## Maintenance notes

- Mesocycle filters (backlog) can filter `detectPRs` output by date range
- Substitution (plan 017): PRs keyed by `exerciseId`, display `performedName` if set
