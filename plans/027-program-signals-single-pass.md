# Plan 027: One hard-set aggregation and single-pass program signals

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f9da669..HEAD -- app.js`
> If `app.js` changed since this plan was written (plan 025 intentionally
> does), compare the "Current state" excerpts against the live code before
> proceeding; on a real mismatch beyond plan 025's documented edits, treat it
> as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/025-program-meta-chip-refresh.md (touches the same render function; land 025 first)
- **Category**: tech-debt
- **Planned at**: commit `f9da669` (PR #19 branch `cursor/program-abstraction-df5f`), 2026-07-02

## Why this matters

PR #19 introduced the program-signal functions, and two forms of duplication
came with them. First, `programVolumeCompliance` re-implements the
"completed hard sets per muscle over a rolling window" aggregation that
already exists in `renderCompleted` — same filter (`load>0`, `reps>0`,
`rir<=hardRir`, working sets only), same muscle attribution via
`rowMuscles`/`addVol`, same 0.5 secondary weighting. The design note
(`docs/design/program-abstraction.md`) even says volume compliance reuses
"`renderCompleted` logic" — it copies it instead. When the hard-set definition
next changes (it already evolved once, when the warmup flag landed), one copy
will drift and the Program tab will silently disagree with the Stats tab.

Second, `renderProgramHeader` computes every signal, and `programStatusLabel`
*recomputes* adherence and progression health internally — so each Program-tab
render runs adherence twice and progression health twice. Progression health
is the expensive one: `recommendation(ex)` per exercise, each doing a full
`state.log` scan via `sessionsFor`. `render()` runs on every tab switch and
every workout save, so an 18-exercise program with a year of logs pays four
full-log-times-exercises scans where one suffices. This is a correctness-
preserving restructure that makes the abstraction honest: compute the signals
once, derive the label from them.

## Current state

All in `app.js` (single-file vanilla JS, no build step, dense
statement-per-line style — match it).

`app.js:205-226` — the signal functions added by PR #19:

```javascript
function programAdherence(){const totalDays=prog.days().length;if(!totalDays)return{logged:0,total:0,ratio:0};
  const cutoff=daysAgo(6),programDaySet=new Set(prog.days()),loggedDays=new Set();
  for(const x of state.log){if(String(x.date)<cutoff)continue;if(programDaySet.has(x.day))loggedDays.add(x.day)}
  const logged=loggedDays.size;return{logged,total:totalDays,ratio:totalDays?logged/totalDays:0}}
function programWeek(){const s=state.programMeta?.started;if(!s)return null;
  const start=new Date(`${s}T12:00:00`),now=new Date(`${today()}T12:00:00`);
  const days=Math.floor((now-start)/86400000);return days<0?1:Math.floor(days/7)+1}
function programProgressionHealth(){const withHistory=prog.exercises.filter(ex=>sessionsFor(ex).length>0);
  if(!withHistory.length)return null;
  const hot=withHistory.filter(ex=>{const st=recommendation(ex).status;return st==="add"||st==="add2"}).length;
  return{hot,total:withHistory.length,ratio:hot/withHistory.length}}
function programVolumeCompliance(){const planned=prog.volume();let plannedTotal=0;
  for(const [,v] of planned)plannedTotal+=v.d+v.p;if(!plannedTotal)return null;
  const cutoff=daysAgo(6),hr=+state.settings.hardRir,m=new Map();
  for(const x of state.log){if(String(x.date)<cutoff)continue;if(!(+x.load>0&&+x.reps>0&&+x.rir<=hr)||!isWork(x))continue;
    const mus=rowMuscles(x);for(const p of muscles(mus.primary))addVol(m,p,1,0);for(const s of muscles(mus.secondary))addVol(m,s,0,.5)}
  let completed=0;for(const [,v] of m)completed+=v.d+v.p;
  return{planned:plannedTotal,completed,ratio:Math.min(completed/plannedTotal,1)}}
function programStatusLabel(){const adherence=programAdherence(),health=programProgressionHealth();
  const hasLog=state.log.some(isWork);if(!hasLog)return"Getting started";
  const adRatio=adherence.ratio,hRatio=health?.ratio??0;
  if(adRatio>=1&&hRatio>=0.4)return"On track";if(adRatio>=0.5)return"Partial week";return"Rebuilding"}
```

`app.js:580-590` — the pre-existing Stats-tab aggregation that
`programVolumeCompliance` duplicates (note the only difference: it takes the
window from the `volWindow` UI state and renders bars):

```javascript
// Completed hard sets per muscle over a rolling window (load>0, reps>0, RIR within hardRir).
function renderCompleted(){const el=$("#completedVolume");if(!el)return;const cutoff=daysAgo(volWindow-1),hr=+state.settings.hardRir,m=new Map();
  for(const x of state.log){if(String(x.date)<cutoff)continue;if(!(+x.load>0&&+x.reps>0&&+x.rir<=hr)||!isWork(x))continue;
    const mus=rowMuscles(x);
    for(const p of muscles(mus.primary))addVol(m,p,1,0);
    for(const s of muscles(mus.secondary))addVol(m,s,0,.5)}
  const arr=[...m.entries()].map(([name,v])=>({name,eff:v.d+v.p})).sort((a,b)=>b.eff-a.eff),max=Math.max(...arr.map(x=>x.eff),1);
  ...
```

The consumer, `renderProgramHeader` (`app.js:677-698`), calls
`programAdherence()`, `programWeek()`, `programStatusLabel()`,
`programProgressionHealth()`, and `programVolumeCompliance()`. **If plan 025
has landed**, these calls live in `renderProgramChips()` instead — same
change applies there.

Convention note: helpers in this file take explicit inputs where cheap
(`earliestLogDate(log)`, `detectPRs(log)`) and read module-level `state`/`prog`
otherwise. The status label becoming a pure function of its two inputs is the
direction the repo already leans (`detectPRs` at `app.js:535` is the exemplar:
pure over `log`, exported on `window` for testability).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0, no output |
| Static server (terminal 1, repo root) | `python3 -m http.server 8000` | serves on :8000 |
| Simulation (terminal 2) | `cd test && node simulation.mjs` | `FAILED: 0`, exit 0 |
| Test deps (once, if missing) | `cd test && npm install && npx playwright install chromium` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `app.js` — `completedHardSets` (new), `renderCompleted`,
  `programVolumeCompliance`, `programStatusLabel`, and the call sites in
  `renderProgramHeader`/`renderProgramChips`.

**Out of scope** (do NOT touch, even though they look related):
- `test/simulation.mjs` — this is a behavior-preserving refactor; the existing
  111+ checks are the characterization suite. Add no checks, change no checks.
- `exportCsv`'s inline `is_hard_set` computation (`app.js:817`) — it is
  per-row, not an aggregation; unifying it is not worth the churn.
- The volume-planning side (`Program.volume()`, `renderVolume`) — planned
  volume is a different concept from completed volume.
- The thresholds inside `programStatusLabel` (1, 0.4, 0.5) — they are the
  documented design decision, not up for adjustment here.

## Git workflow

- Branch off the PR #19 branch (or off plan 025's branch if reviewing them as
  a stack): `git checkout <base> && git checkout -b <your-branch>`.
- Commit style from `git log`: single-line imperative summaries.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract `completedHardSets(windowDays)`

In `app.js`, directly above `renderCompleted`, add the shared aggregation
(keep the existing comment, moving it up):

```javascript
// Completed hard sets per muscle over a rolling window (load>0, reps>0, RIR within hardRir).
function completedHardSets(windowDays){const cutoff=daysAgo(windowDays-1),hr=+state.settings.hardRir,m=new Map();
  for(const x of state.log){if(String(x.date)<cutoff)continue;if(!(+x.load>0&&+x.reps>0&&+x.rir<=hr)||!isWork(x))continue;
    const mus=rowMuscles(x);
    for(const p of muscles(mus.primary))addVol(m,p,1,0);
    for(const s of muscles(mus.secondary))addVol(m,s,0,.5)}
  return m}
```

Rewrite `renderCompleted` to start with
`const el=$("#completedVolume");if(!el)return;const m=completedHardSets(volWindow);`
and delete its inline aggregation. Rewrite `programVolumeCompliance` to use
`const m=completedHardSets(7);` and delete its inline copy (note its old
cutoff `daysAgo(6)` equals `daysAgo(7-1)` — identical window, no behavior
change).

**Verify**: `node --check app.js` → exit 0, and
`grep -c "rir<=hr" app.js` → 2 (one in `completedHardSets`, one in `exportCsv`'s
`is_hard_set`).

### Step 2: Make the status label a pure function of its signals

Change `programStatusLabel` to accept the signals instead of recomputing them:

```javascript
function programStatusLabel(adherence,health){
  const hasLog=state.log.some(isWork);if(!hasLog)return"Getting started";
  const adRatio=adherence.ratio,hRatio=health?.ratio??0;
  if(adRatio>=1&&hRatio>=0.4)return"On track";if(adRatio>=0.5)return"Partial week";return"Rebuilding"}
```

In the consumer (`renderProgramChips` if plan 025 landed, otherwise
`renderProgramHeader`), reorder so the signals are computed once and passed:

```javascript
  const ad=programAdherence(),week=programWeek(),health=programProgressionHealth(),vol=programVolumeCompliance();
  const status=programStatusLabel(ad,health);
```

Confirm with `grep -n "programStatusLabel(" app.js` that the definition and
exactly one call site remain, and the call site passes two arguments.

**Verify**: `node --check app.js` → exit 0.

### Step 3: Full regression run

**Verify**: with the static server running, `cd test && node simulation.mjs`
→ `FAILED: 0` with the same PASSED count as your pre-change baseline run
(run the suite once before starting if you have not). Pay attention to the
"Program tab shows adherence chip" and export/import checks and, on the Stats
side, the completed-volume checks — those exercise both consumers of the
extracted helper.

## Test plan

- No new tests: the simulation suite is the characterization harness and the
  refactor must be invisible to it. The relevant existing coverage:
  Stats-tab completed hard-set checks (7- and 28-day windows), the Program-tab
  meta card checks, and the v2 export/import round-trip.
- Manual spot-check (optional): Program tab volume chip percentage equals
  what Stats → Completed hard sets implies over 7 days.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` exits 0 with `FAILED: 0`, PASSED count unchanged from baseline
- [ ] `grep -c "rir<=hr" app.js` returns 2
- [ ] `grep -c "completedHardSets" app.js` returns 3 (definition + two call sites)
- [ ] `programStatusLabel` takes `(adherence,health)` and no longer calls `programAdherence`/`programProgressionHealth` internally
- [ ] Only `app.js` is modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The aggregation loops in `renderCompleted` and `programVolumeCompliance`
  are no longer byte-for-byte the same filter (someone changed one copy —
  the drift this plan exists to prevent has already happened; the divergence
  needs a human decision, not silent unification).
- The simulation PASSED count drops or any check fails twice in a row.
- You find a third copy of the hard-set aggregation beyond the two named here
  (other than `exportCsv`'s per-row flag) — report it; the helper may need a
  different shape.

## Maintenance notes

- Any future change to the hard-set definition (e.g. RIR ceiling semantics,
  warmup handling) now lands in `completedHardSets` once and feeds Stats,
  the Program chip, and status consistently. `exportCsv:is_hard_set` remains
  a deliberate second site — keep them in sync or unify in a later pass.
- If a "program health" score ever grows more inputs, keep
  `programStatusLabel` pure (signals in, label out) — that is what makes the
  thresholds unit-testable if a node-side test harness is ever added.
- Reviewer should scrutinize: the `daysAgo(6)` → `completedHardSets(7)`
  window equivalence, and that `renderCompleted` still honors the 28-day
  toggle via `volWindow`.
