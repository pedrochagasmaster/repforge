# Plan 017: Exercise substitution flow (approved alternates per slot)

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

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: none (plan 006 stable exercise IDs is DONE)
- **Category**: direction
- **Planned at**: commit `ff67850`, 2026-07-01
- **Source**: Parent persona §200, coach persona §273, persona report §5 "Next 2 months"

## Why this matters

Skip and trim (plan 005) hide exercises but do not solve "the hack squat is taken —
use leg press instead." Users either log under the wrong exercise name (forking
history via `matchLift`) or edit the program mid-session. Substitution with
memory turns adaptation into a first-class path: the **slot** (stable `exerciseId`)
stays the same for recommendations and volume roll-up; the **performed name**
is recorded on each log row.

## Current state

Relevant files:

- `app.js` — all logic (~692 lines at planning commit)
- `index.html` — Log tab markup; no substitute UI today
- `styles.css` — exercise card styles (`.exercise`, `.ex__skip`, etc.)
- `test/simulation.mjs` — Playwright harness (~80 `assert` checks)

Skip is in-memory only; no substitute model exists:

```305:308:app.js
  $$("#workout .ex__skip").forEach(b=>b.onclick=()=>{const id=b.dataset.skip;
    skipped.has(id)?skipped.delete(id):skipped.add(id);
    if(logMode==="focus"){const fl=focusList();focusIndex=Math.min(focusIndex,Math.max(0,fl.length-1))}
    renderWorkout()});
```

History matching keys off `exerciseId` first, then name — substituting without
schema support breaks recommendations:

```158:162:app.js
function matchLift(ex){const id=ex?.id,name=ex?.name;return x=>id&&x.exerciseId?x.exerciseId===id:x.name===name}
function last(ex){const match=matchLift(ex);
  const hits=state.log.filter(match);if(!hits.length)return[];
  const sid=[...hits].sort((a,b)=>String(b.created).localeCompare(String(a.created)))[0].session;
  return hits.filter(x=>x.session===sid).sort((a,b)=>a.set-b.set)}
```

Program editor has `notes` for setup hints but no alternates field:

```540:555:app.js
function exCard(e,i,n){
  ...
    `<label class="pex__mus">Setup notes<input data-id="${esc(e.id)}" data-field="notes" value="${esc(e.notes)}" placeholder="e.g. Seat 4, feet high, 2s stretch"></label>`+
```

Save schema today (no `performedName` or `substitutedFrom`):

```353:355:app.js
    const row={session,date,day,name:ex.name,exerciseId:ex.id,set:n,load,reps,rir,notes,created,primary:ex.primary,secondary:ex.secondary};
    if(bw>0)row.bodyweight=bw;
    rows.push(row)}}
```

**Product guardrails** (from `plans/README.md`): no sixth tab; protect Log speed;
no accounts/cloud/social. Substitute UI must live on the exercise card, not a
new nav section.

**Conventions to match**:

- In-memory session state: mirror `skipped` / `collapsed` Sets (`app.js:138-139`)
- Persist program fields via `Program.update` + `persistProgram()` (`app.js:115-119`, `593`)
- Toast feedback via `toast()` (`app.js:28`)
- Escaping via `esc()` in templates
- Tests: add Playwright checks to `test/simulation.mjs` following existing
  `fillExerciseSets` / `saveWorkout` helpers

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0 |
| Serve app | `python3 -m http.server 8000` (repo root) | serving on :8000 |
| Simulation | `cd test && npm install && npx playwright install chromium && node simulation.mjs` | `FAILED: 0`, exit 0 |

There is no linter, type-checker, or bundler in this repo.

## Scope

**In scope**:

- `app.js` — `Exercise.alternates` field (string array or comma-separated storage),
  in-session substitute picker on Log cards, session-scoped substitute map,
  save rows with optional `performedName`, display performed name in History/Stats
  when it differs from program name
- `index.html` — only if a shared modal/sheet is needed (prefer inline on card)
- `styles.css` — substitute chip / picker styles
- `test/simulation.mjs` — substitute + history roll-up checks

**Out of scope**:

- Flexible schedule / missed-day queue (backlog)
- Short workout builder (backlog; reuse hide mechanic only)
- Photos or exercise GIF library (rejected in guardrails)
- Persisting today's substitute choice across days automatically (remember per
  slot in program alternates only; session substitute is in-memory + saved on
  log row, not a global default until user edits program)

## Git workflow

- Branch: `cursor/substitution-flow-fb30` (or operator-specified)
- Commit per step; conventional short messages (`feat: add exercise alternates field`)
- Do NOT push or open a PR unless the operator instructed it

## Steps

### Step 1: Extend program model with alternates

Add `alternates` to `Exercise` — store as trimmed string array in JSON
(forward-compatible: missing field → `[]`). Expose in `exCard` as a single
input: "Approved alternates (comma-separated)" bound to `data-field="alternates"`.
Parse/split on comma in `Program.update`.

Default program (`app.js:78-82`): add 1–2 sensible alternates on 3–4 default
exercises as examples (e.g. hack squat → "Leg press, Pendulum squat").

**Verify**: `node --check app.js` → exit 0. Reload app → Program tab shows
alternates field; edit persists after refresh.

### Step 2: Session substitute map (in-memory)

Add `const substituted=new Map()` keyed by `exerciseId` → performed name string.
On Log card, when `ex.alternates.length` or user picks "Other…", show a compact
control: **Use:** [program name ▾] opening a menu of `[ex.name, ...alternates, Other…]`.
Choosing sets `substituted.set(ex.id, choice)` and updates card heading to show
both: `Leg press (for Hack squat)` or similar.

Clear `substituted` on successful `saveWorkout` (like `skipped`).

**Verify**: Manual — pick alternate on Log, card label updates; refresh mid-session
(draft persists inputs but substitute map may reset — document that substitute
re-select is acceptable for v1).

### Step 3: Save performed name on log rows

In `saveWorkout`, when `substituted.has(ex.id)`, set
`row.performedName = substituted.get(ex.id)` while keeping `row.name = ex.name`
(program slot name) and `row.exerciseId = ex.id`.

Add helper `displayName(row)` → `row.performedName || row.name` for History tables
and Stats exercise labels where the *performed* lift should show.

Do **not** change `matchLift` — recommendations stay tied to the slot id.

**Verify**: Log a session with a substitute → export CSV includes both
`name` (slot) and new column `performed_name` (add to `exportCsv` cols array).

### Step 4: History and Stats display

Use `displayName(row)` in History session cards and `#historyTable` Exercise column
when `performedName` is set. Stats `#statExercise` options should list unique
display names OR group by exerciseId — **pick one** and document in code comment;
recommended: option labels show performed name, value stays exerciseId-backed summary
via `liftKey`.

**Verify**: Simulation check — substitute once, save, History shows performed name,
Stats chart still aggregates under same exerciseId.

### Step 5: Simulation coverage

Add to `test/simulation.mjs`:

1. Set alternates on first Day 1 exercise via program editor
2. On Log, select alternate, fill one set, save
3. Assert exported state log row has `exerciseId` of slot and `performedName` matching alternate

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`

## Test plan

- Happy path: alternate from approved list, save, history + CSV correct
- Regression: exercise without alternates saves unchanged (no `performedName`)
- Regression: skip + substitute on different exercises same session
- Edge: "Other…" free-text alternate (max 80 chars, trimmed)

Model new checks after existing skip/trim tests in `simulation.mjs`.

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` exits 0 with new substitute checks passing
- [ ] `Exercise` JSON round-trips `alternates` through export/import backup
- [ ] Recommendations for a slot still use `matchLift(exerciseId)` after substituted sessions
- [ ] CSV export includes `performed_name` column
- [ ] No sixth nav tab; substitute controls fit existing exercise card
- [ ] `plans/README.md` status row for 017 updated

## STOP conditions

Stop and report if:

- Current-state excerpts don't match live code (drift)
- Implementing alternates requires a new top-level tab
- `matchLift` behavior change breaks existing simulation checks and root cause
  isn't substitute-specific
- IndexedDB persist shape rejects new program fields (shouldn't — JSON blob)

## Maintenance notes

- Import merge (plan 020) must preserve `performedName` on log rows
- Mesocycle blocks (backlog) should key off `exerciseId`, not display name
- Coach opt-in snapshot (backlog) should show both slot and performed name
- Reviewers: confirm Log card didn't grow taller than one extra line on mobile
