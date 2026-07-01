# Plan 018: Warmup vs working set flag

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
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `ff67850`, 2026-07-01
- **Source**: Power user persona §67; persona report §5 "Next 6 months"

## Why this matters

Ramp sets logged at working-set weight pollute hard-set volume, progression
recommendations, and CSV `is_hard_set`. The power user persona: "my 7/28d numbers
are lying when I log ramp sets the same as work sets." A per-set **Working /
Warmup** toggle (default Working) lets users log honestly without breaking the
Log tab speed.

## Current state

All sets with `load > 0` are treated as working sets in progression:

```163:170:app.js
// One entry per past session for this lift, oldest→newest, working sets only (load>0).
function sessionsFor(ex){const match=matchLift(ex),m=new Map();
  for(const x of state.log){if(!match(x)||!(+x.load>0))continue;
```

Hard-set volume counts every qualifying set:

```418:423:app.js
function renderCompleted(){const el=$("#completedVolume");if(!el)return;const cutoff=daysAgo(volWindow-1),hr=+state.settings.hardRir,m=new Map();
  for(const x of state.log){if(String(x.date)<cutoff)continue;if(!(+x.load>0&&+x.reps>0&&+x.rir<=hr))continue;
```

CSV already exports `is_hard_set` — extend semantics, don't duplicate:

```627:627:app.js
    ["is_hard_set",r=>(+r.load>0&&+r.reps>0&&+r.rir<=hr)?1:0],
```

Set row UI has five columns (Set, load, reps, RIR, Save) — no kind flag:

```246:252:app.js
      return `<div class="setrow ${cls}" data-set="${esc(key)}"><span class="setrow__n">${n}</span>`+
        ...
        `<button type="button" class="saveset" data-save="${esc(key)}" ...>${committed.has(key)?"✓":"Save"}</button></div>`;
```

Draft autosave stores input values by `data-k` keys — warmup state can use
`draft.__warmup` array of set keys (mirror `__done` / `__touched` pattern at
`app.js:227-228`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope**:

- `app.js` — log row field `kind: "working" | "warmup"` (default `"working"`);
  filter warmups out of `sessionsFor`, `recommendation`, `renderCompleted`,
  fatigue watch; include in save/export; toggle on set row
- `styles.css` — muted styling for warmup rows (`.setrow.is-warmup`)
- `test/simulation.mjs` — warmup excluded from recommendation + volume checks

**Out of scope**:

- Changing program template set counts (warmups are extra logged sets, not
  prescribed template slots — v1)
- Auto-detecting warmups from load % (future)
- Stats chart changes (top load chart may still include warmups unless filtered —
  **filter warmups from `summaries()` top load** in this plan)

## Git workflow

- Branch: `cursor/warmup-working-set-fb30`
- Commit per step; do NOT push unless instructed

## Steps

### Step 1: Log schema + migration

Add optional `kind` on saved log rows. In `migrateLog()`, default missing `kind`
to `"working"`. Helper `isWorkingSet(row)` → `row.kind !== "warmup"`.

**Verify**: `node --check app.js` → exit 0; existing backups load unchanged.

### Step 2: Set-row toggle in Log UI

Add a compact control per set row — recommended: tap on set number cycles
Working ↔ Warmup, or a single "W" chip button to avoid widening columns.
Persist in draft as `__warmup: string[]` of set keys (same pattern as `__done`).

Visual: `.setrow.is-warmup` — dimmed, label "Warmup" on set number.

**Verify**: Toggle warmup on set 1, refresh page → draft restores warmup state.

### Step 3: Save + export

In `saveWorkout`, set `row.kind = draftWarmup.has(key) ? "warmup" : "working"`.

Update `exportCsv` `is_hard_set` column:
`(isWorkingSet(r) && load>0 && reps>0 && rir<=hr) ? 1 : 0`

Add CSV column `kind` with value `working` or `warmup`.

**Verify**: Export CSV after mixed session → warmup row has `kind=warmup`,
`is_hard_set=0`.

### Step 4: Filter warmups from progression + volume

Update these call sites to skip `!isWorkingSet(x)`:

- `sessionsFor` loop
- `renderCompleted` loop
- `summaries()` / top load for charts (use working sets only for `top`)
- `renderFatigue` / `renderAttention` inputs (recommendation already uses `sessionsFor`)

**Verify**: Log 3 warmup sets + 2 working sets at top range → recommendation
still based on working sets only; completed hard-set volume counts 2 sets not 5.

### Step 5: Simulation

Add check: log exercise with set 1 warmup (light load) and sets 2–3 working at
top range → status should be `add`/`hold` based on working sets, not blocked by
warmup reps.

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`

## Test plan

- Warmup sets excluded from `sessionsFor` / recommendations
- Warmup sets excluded from completed hard-set volume bars
- Warmup sets still appear in History "Every set" table
- Import/export round-trip preserves `kind`
- Per-set commit (plan 016) still works on warmup rows

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`
- [ ] CSV has `kind` column; `is_hard_set` respects warmups
- [ ] No layout regression: set row still usable one-handed on 375px viewport
- [ ] `plans/README.md` row 018 updated

## STOP conditions

Stop if:

- Warmup toggle requires a sixth column that breaks mobile layout — propose
  set-number tap cycle instead and report
- Filtering warmups breaks >10 existing simulation checks — report before
  rewriting recommendation tests

## Maintenance notes

- PR ledger (plan 019) should ignore warmup sets for PR detection
- Substitution (plan 017) rows carry `kind` independently
- Reviewers: confirm `migrateLog` handles old rows without `kind`
