# Plan 020: PR ledger per exercise (load / rep / e1RM)

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

## Consolidation notes

Merged from PR #15 plan 019 and PR #16 plan 018.

| Disagreement | Choice |
|--------------|--------|
| PR detection model (`detectPRs` chronological events vs `prsFor` from summaries) | **PR #15 `detectPRs`** — chronological ledger with load/rep/e1RM kinds and deltas; richer audit trail |
| UI placement (after `#tops` table vs below `#trend`) | **PR #16 below `#trend`** — stays with selected-exercise chart context |
| Save-time PR toast callout | **PR #16** — one-line PR announcement in save toast |
| Ledger UI shape (full table vs three compact rows) | **PR #15 table in `#statsDeep`** — Date, Kind, Load, Reps, RIR, e1RM, Δ vs prev |
| Warmup exclusion | **Mandatory via plan 019 `isWork`** — PR #15's per-row skip; plan depends on 019 |

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: **plan 019** (warmup flag) — PR detection must exclude
  warmup sets via `isWork` before this plan executes.
- **Category**: direction
- **Planned at**: commit `ff67850`, 2026-07-01
- **Source**: Spreadsheet maximalist §429, minimalist §496; report §5 "Next 6 months"

## Why this matters

`#tops` shows a single best load per exercise with no history or date context.
The spreadsheet persona wants "date, load, reps, RIR, delta from previous PR" —
motivation and auditability without social features. A factual save-time PR
callout (PR #16) closes the feedback loop the moment a lifter earns a record.
This is pure derivation from `state.log` plus a small read-only UI inside
existing Stats "Dig deeper".

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

Stats deep section is collapsible (`#statsDeep`); `#trend` is at
`index.html:74`, directly above the `#chart` canvas.

`saveWorkout` (`app.js:345-359`) builds `rows`, pushes them into
`state.log`, and toasts:

```356:359:app.js
  if(!rows.length){toast("Enter weight on at least one set before saving.");return}
  state.log.push(...rows);save();clearDraft();committed.clear();touched.clear();$("#notes").value="";
  const btn=$(".btn--save");btn.classList.remove("is-stamped");void btn.offsetWidth;btn.classList.add("is-stamped");
  toast(`Workout forged — ${rows.length} sets logged.`);render()}finally{saving=false}}
```

Lift identity: `liftKey(x)=x.exerciseId||x.name` (`app.js:71`);
`exerciseLabel(row)` (`app.js:72`) resolves display names. `matchLift(ex)`
(`app.js:158`) matches log rows to an exercise.

After plan 019 lands, `isWork(r)=>!r.warmup` (`app.js:71` area) filters
warmup sets — use it everywhere this plan reads performance data.

Product guardrails: no gamification (streaks, badges, XP). A factual "PR" line
with a date is in-bounds; anything celebratory-persistent (confetti, badge
cabinets) is not.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0 |
| Serve app | `python3 -m http.server 8000` (repo root, keep running) | serving on :8000 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` (85 checks at baseline; executors add checks for new behavior) |

There is no linter, type-checker, or bundler in this repo — do not look for one.
Test dependencies are already installed.

## Scope

**In scope**:

- `app.js` — `detectPRs(log, opts)` pure function; `renderPRs()`; save-time
  PR callout in toast
- `index.html` — `<div id="prLedger">` below `#trend` inside `#statsDeep`
- `styles.css` — compact PR list (`.pr-row`, badge for kind: Load / Reps / e1RM)
- `test/simulation.mjs` — PR detection, ledger render, and toast checks
- `plans/README.md` — status row update

**Out of scope**:

- Manual PR override / delete (v2)
- Social sharing of PRs (rejected)
- Push notifications ("New PR!")
- Persistent PR store — PRs are derived from `state.log` on render, never
  written to state (no schema change beyond what 019 adds)
- The "Top loads by exercise" table (`app.js:396-400`) — stays as overview
- Optional "Export PRs CSV" button — skip unless time; table UI is sufficient for v1

## Git workflow

- Branch: `cursor/pr-ledger-fb30` (or operator-specified)
- Do NOT push unless instructed

## Steps

### Step 1: PR detection pure function

Add `detectPRs(log, opts)` in `app.js` (no DOM):

- Filter with `isWork` — **requires plan 019**; if `isWork` is missing, STOP.
- Iterate log rows sorted by `date`, then `created`
- Track per `liftKey(row)` (exerciseId preferred): best load, best reps at max
  load, best e1RM
- Emit event when strictly exceeded: `{ kind: "load"|"reps"|"e1rm", date, load,
  reps, rir, exerciseName, exerciseId, deltaLoad?, deltaE1rm? }`
- Skip rows with `load<=0`

Unit-test via simulation, not a new test framework.

**Verify**: `node --check app.js` → exit 0

### Step 2: Stats UI (Dig deeper only)

In `index.html` inside `#statsDeep`, below `#trend` (`index.html:74`):

```html
<div id="prLedger" class="prledger"></div>
```

Implement `renderPRs()` called from `renderStats()`:

- Show PRs for **selected** exercise only (matches `#statExercise` / chart context)
- Table columns: Date, Kind, Load, Reps, RIR, e1RM, Δ vs prev
- Empty state: "Log working sets to track PRs."

**Verify**: Manual — log ascending loads on one exercise → ledger shows load PRs
with positive deltas. PR ledger visible only when `#statsDeep` is open (default closed).

### Step 3: PR callout in the save toast

In `saveWorkout`, before `state.log.push(...rows)` (`app.js:357`), compute
which lifts just set a top-load PR among **working sets only**, then fold
into the existing toast:

```js
const prLifts=[];
for(const ex of exercises()){if(skipped.has(ex.id))continue;
  const mine=rows.filter(r=>r.exerciseId===ex.id&&!r.warmup);if(!mine.length)continue;
  const newTop=Math.max(...mine.map(r=>+r.load));
  const prevTop=Math.max(0,...state.log.filter(x=>matchLift(ex)&&isWork(x)).map(r=>+r.load));
  if(newTop>prevTop&&prevTop>0)prLifts.push(`${ex.name} ${fmtLoad(newTop)} ${unitLabel()}`)}
```

Then replace the toast line:

```js
toast(prLifts.length?`Workout forged — ${rows.length} sets logged. PR: ${prLifts.join(", ")}!`:`Workout forged — ${rows.length} sets logged.`);
```

Note `prevTop>0` guards the first-ever session for a lift — logging a lift for
the first time is not a PR.

**Verify**: `node --check app.js` → exit 0. Manually: log a session, then log
the same lift heavier → toast includes `PR: <name> <load> kg!`; logging the
same or lower load toasts the plain message.

### Step 4: Simulation

Add to `test/simulation.mjs` after an existing save-flow phase:

```js
console.log("\nPhase: PR ledger");
await nav(page, "log");
const prMeta = await getExerciseMeta(page, "Day 1");
await fillExerciseSets(page, prMeta[0].id, prMeta[0].sets, 200, 6, 2);
await saveWorkout(page);
const prToast = await page.textContent("#toast");
assert(/PR:/.test(prToast),
  "Save toast announces a top-load PR",
  `Toast: ${prToast}`,
  "Log a heavier top set than any prior session → Save");
await nav(page, "stats");
await page.evaluate(() => { document.querySelector("#statsDeep").open = true; });
await page.waitForTimeout(100);
const ledger = await page.textContent("#prLedger");
assert(/load/i.test(ledger) && /e1RM/i.test(ledger),
  "PR ledger renders load and e1RM PRs",
  `Ledger: ${ledger}`,
  "Stats → Dig deeper → PR ledger under the trend");
```

Also assert via `page.evaluate` that `detectPRs` returns at least one
`kind:"load"` event with `deltaLoad > 0` after staged loads (80×8 then 85×8).

Pick a load (200) higher than anything earlier phases logged for that exercise;
adjust if earlier phases changed.

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`

## Test plan

- First logged working set is a PR (all kinds)
- Tie on load but higher reps → rep PR at same load
- Higher e1RM at lower load (high rep PR) → e1RM PR event
- Warmup sets at high load do **not** trigger PR events or toast
- Different exercises don't cross-contaminate
- Rename exercise (same exerciseId) — PRs stay keyed by id
- Tie a PR (same top load) → no PR toast
- First-ever session for a new exercise → no PR toast

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`
- [ ] PR ledger renders inside `#statsDeep` only; default Stats view unchanged
- [ ] Save toast announces genuine top-load PRs
- [ ] Warmup sets excluded from PR detection and toast (`isWork`)
- [ ] `grep -n "localStorage.setItem" app.js` shows no new persistence key
- [ ] No new nav tab
- [ ] `plans/README.md` status row for 020 updated

## STOP conditions

Stop if:

- Plan 019 (`isWork`) is not landed — do not proceed without warmup exclusion
- PR detection requires storing new state in `repforge_v1` (must be derived-only)
- Product owner rejects three PR kinds — report and await decision
- `summaries()` or `saveWorkout` no longer match the "Current state" excerpts

## Maintenance notes

- Mesocycle filters (plan 023 spike → 024 build) can filter `detectPRs` output by date range
- Substitution (plan 021): PRs keyed by `exerciseId`, display `performedName` if set
- Rep-PRs at a given load need per-set granularity — revisit only if users ask
