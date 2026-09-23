# Plan 007: One Today render computes each exercise's recommendation once and stops rescanning history per trained lift

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat ff9991cf..HEAD -- app.js`
> `app.js` changes almost daily. Re-locate every function below by name
> (`grep -n "^function recommendation(" app.js`, etc.) and compare its body with
> the excerpt. A body mismatch is a STOP; shifted line numbers alone are fine.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (feeds recommendation, status, and fatigue copy)
- **Depends on**: none (conflicts textually with plans 008, 012, 013, and 019 in `app.js`; land them one at a time)
- **Category**: perf
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: **Later**: the "Render and search history scans" row in §6; after the UI overhaul (Q611).

## Why this matters

Today is the app's most-visited screen, and it re-renders after every saved set. Each render recomputes every exercise's progression `recommendation()` several times: in `weeklySnapshot()` (once for every exercise in the whole program, plus once more per lift trained this week), in `updateGauge()`, and in `fatigueFlagged()`. Each `recommendation()` call does a full linear scan of the workout history (`progressionHistory` iterates `state.log`). `weeklySnapshot()` also runs `state.log.filter(...)` once for every lift trained this week. The backlog records that history is tested at 5,000 sessions / 20,000 rows. At that size one render walks the log many dozens of times on a phone's main thread. Memoizing `recommendation()` for the duration of one synchronous render, and replacing the per-lift filter with one grouping pass, cuts that without changing any output.

## Current state

All in `app.js` (the main script; `state`, `prog`, and every top-level `function` are global lexical bindings visible to tests via `page.evaluate`).

`recommendation` (`app.js:4884` at `ff9991cf`) is pure with respect to `(ex, state, settings)`. It calls `progressionInput(ex)` → `progressionHistory(ex)` and has many `return` statements:

```js
function recommendation(ex){
  const strategy=strategyIdFor(ex);
  const result=RepForgeProgression.evaluateProgression(progressionInput(ex));
  ...
```

`progressionHistory` (`app.js:4745`):

```js
function progressionHistory(ex){
  const match=matchLift(ex),m=new Map();
  for(const x of state.log){if(!match(x)||!(+x.load>0)||!isWork(x))continue;
  ...
```

`weeklySnapshot` (`app.js:2630-2654`) — the relevant lines:

```js
  const trained=new Map();for(const x of state.log){if(String(x.date)<start||String(x.date)>end)continue;if(!isWork(x)||!(+x.load>0))continue;
    const k=liftKey(x),cur=trained.get(k);if(!cur||compareLogChronology(cur,x)<0)trained.set(k,{session:x.session,date:x.date,created:x.created})}
  let improvedLifts=0,flatLifts=0,regressedLifts=0,fatigueFlags=0;
  for(const[k,sess]of trained){
    const rows=state.log.filter(r=>r.session===sess.session&&liftKey(r)===k);if(!rows.length)continue;
    ...
    if(current){const r=recommendation(current);if(r.status==="reduce"||r.stalled)fatigueFlags++}}
  let readyToAdd=0;for(const ex of prog.exercises){const st=recommendation(ex).status;if(st==="add"||st==="add2")readyToAdd++}
```

Other per-render callers:
- `app.js:2250`: `function fatigueFlagged(){return exercises().filter(e=>{const r=recommendation(sessionExercise(e));…})}` (note that `sessionExercise(e)` may create a new object, so it will miss an identity-keyed memo; that is acceptable)
- `app.js:6813`: `function updateGauge(){…exs.filter(e=>{const s=recommendation(e).status;…})`
- `app.js:5941`: `renderToday()` calls `weeklySnapshot()`
- `app.js:6330`: `function render(){applyI18n(); …` (the top-level synchronous render)

Precedent for identity caching: `history-ui.js:24` `const historyIndexCache=new WeakMap();` (`historyIndexFor`).

Measurement precedent: `test/history.mjs:76-104` `makeCountingLog(rows)` wraps the log in a `Proxy` that counts iterator visits, and `test/history.mjs:108` builds a 5,000-session fixture. Browser-test skeleton and seeding: `test/today-week-line.mjs` (imports `installSeedProgram` from `test/fixtures/seed-program.mjs`, waits on `window.__repforgeBooted`).

Style: `app.js` is dense, semicolon-light, no spaces around operators, with one-line functions where short. Match it.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Setup | `(cd test && npm ci && npx playwright install --with-deps --only-shell chromium)` | exit 0 |
| Syntax | `node tools/check-production-syntax.mjs` | exit 0 |
| Inventory | `node tools/run-tests.mjs --check` | exit 0 |
| New test | `node tools/run-tests.mjs workout --suite today-render-scans --verbose` | exit 0 |
| Neighbours | `node tools/run-tests.mjs workout --suite today-week-line`, `--suite today-done`, `--suite simulation` | exit 0 |
| Cache lockstep | `node test/exercise-library.mjs` | exit 0 |
| Lane | `node tools/run-tests.mjs workout` | exit 0 |

## Scope

**In scope:** `app.js` (`recommendation`, `render`, `weeklySnapshot` only); `test/today-render-scans.mjs` (create); `test/suites.mjs` (register under `workout:` after `test/today-week-line.mjs`); `docs/ci.md` (command counts); the cache ritual files `sw.js`, `index.html`, and `test/exercise-library.mjs`.

**Out of scope:** `progression-engine.js`; `progressionHistory` itself (a per-lift log index is a follow-up; see maintenance notes); `history-ui.js`; any change to what a recommendation returns.

## Git workflow

- Branch: `advisor/007-today-render-scans`
- Commits: `test(today): measure history visits per render`, `perf(today): memoize recommendations within one render`, `perf(today): group week rows once in weeklySnapshot`, `chore(cache): advance cached shell revision`
- Do not push.

## Steps

### Step 1: Baseline test (characterization + measurement)

Create `test/today-render-scans.mjs`, modelled on `test/today-week-line.mjs` (same boot, seed with `installSeedProgram`, `timezoneId: "UTC"`). In one `page.evaluate`:

1. Take `const ids=prog.exercises.slice(0,3)`. Build 5,000 sessions of rows that reuse those exercises' `id`/`name` as `exerciseId`/`name`, in the shape `buildFixture()` uses in `test/history.mjs`. Put the last ~3 sessions inside the current week (`today()` minus 0–2 days) so that `weeklySnapshot` has trained lifts.
2. Copy `makeCountingLog` from `test/history.mjs` (it may be inlined), and set `state.log = counted.proxy`.
3. Record `snapshot = JSON.stringify(weeklySnapshot())` and `todayText = document.querySelector("#today")?.innerText` after calling `render()`.
4. Reset the counter, call `render()` once, and read `visits`.
5. Restore `state.log`.

Assert `snapshot` and `todayText` are non-empty, and print `console.log("BASELINE", JSON.stringify({visits, snapshot}))`. Register the test in `test/suites.mjs` and update the counts in `docs/ci.md`.

**Verify**: `node tools/run-tests.mjs --check` → exit 0. The new test passes and prints `BASELINE`. **Paste the `snapshot` string into the test as `const EXPECTED_SNAPSHOT = …`**, add `assert.equal(snapshot, EXPECTED_SNAPSHOT)`, and record `visits` as `BASELINE_VISITS` in a comment. Commit.

### Step 2: Memoize `recommendation` within one render

1. Rename the existing `function recommendation(ex){` to `function computeRecommendation(ex){` (body unchanged).
2. Directly above it, add:

```js
let recommendationMemo=null;
function recommendation(ex){
  if(!recommendationMemo||!ex||typeof ex!=="object")return computeRecommendation(ex);
  let rec=recommendationMemo.get(ex);if(!rec){rec=computeRecommendation(ex);recommendationMemo.set(ex,rec)}
  return rec}
function withRecommendationMemo(fn){
  if(recommendationMemo)return fn();
  recommendationMemo=new Map();try{return fn()}finally{recommendationMemo=null}}
```

3. Rename the existing `function render(){` to `function renderPass(){` and add `function render(){return withRecommendationMemo(renderPass)}`. Before doing this, run `grep -n "renderPass\|recommendationMemo" app.js` to confirm the names are free.
4. **Shared-object safety check**: run `grep -n "recommendation(" app.js` and inspect every call site. If any caller *mutates* the returned object (`rec.x=`, `Object.assign(rec,…)`, `delete rec.`), STOP.

**Verify**: `node tools/check-production-syntax.mjs` → exit 0. The new test still passes with the same `EXPECTED_SNAPSHOT`, and prints a lower `visits`.

### Step 3: Group week rows once in `weeklySnapshot`

In the existing `trained` loop, also collect the week's rows by `session|liftKey`. Because the later filter matches *all* rows of that session and lift (including warm-ups), collect before the `isWork`/load filter:

```js
  const trained=new Map(),weekRows=new Map();for(const x of state.log){if(String(x.date)<start||String(x.date)>end)continue;
    const gk=`${x.session}\u0000${liftKey(x)}`;(weekRows.get(gk)||weekRows.set(gk,[]).get(gk)).push(x);
    if(!isWork(x)||!(+x.load>0))continue;
    const k=liftKey(x),cur=trained.get(k);if(!cur||compareLogChronology(cur,x)<0)trained.set(k,{session:x.session,date:x.date,created:x.created})}
```

Then replace `const rows=state.log.filter(r=>r.session===sess.session&&liftKey(r)===k);` with `const rows=weekRows.get(\`${sess.session}\u0000${k}\`)||[];`.

**Order caveat**: `filter` returned rows in log order, and so does this grouping. If `compareExerciseSession` depends on order, it is preserved.

**Correctness caveat**: the old filter could match rows from the same session **outside** the week window (a session whose rows carry different dates). If `EXPECTED_SNAPSHOT` still matches, and `test/simulation.mjs` (52-week) passes, accept. Otherwise STOP.

**Verify**: the new test passes with an identical `EXPECTED_SNAPSHOT` and even lower `visits`.

### Step 4: Assert the reduction and run the cache ritual

Add `assert(visits <= Math.floor(BASELINE_VISITS*0.6), …)` to the test, using the Step 1 number. Cache ritual: read NN from `grep -o 'repforge-v[0-9]*' sw.js`, bump to NN+1 in `sw.js` (`CACHE` and every `?v=NN`) and in `index.html` (every `?v=NN`), and set `expectedRevision` in `test/exercise-library.mjs`.

**Verify**: `node test/exercise-library.mjs` → exit 0. `node tools/run-tests.mjs workout` → exit 0 (includes `today-*` and the 52-week `simulation`).

## Test plan

- `test/today-render-scans.mjs`: a golden `weeklySnapshot()` equality check on a 5,000-session fixture, plus a row-visit budget of ≤ 60% of the recorded baseline. This is deterministic, with no wall-clock thresholds.
- Existing `today-week-line`, `today-done`, `today-preview`, and `simulation` stay green.

## Done criteria

- [ ] `grep -c "^function computeRecommendation(ex)" app.js` → `1`; `grep -c "withRecommendationMemo(renderPass)" app.js` → `1`
- [ ] `grep -c "state.log.filter(r=>r.session===sess.session" app.js` → `0`
- [ ] `node tools/run-tests.mjs workout` exits 0; `node tools/run-tests.mjs --check` exits 0
- [ ] The report states the baseline and final `visits`
- [ ] Only in-scope files changed; the `advisor-plans/README.md` row is updated

## STOP conditions

- Any caller mutates a returned recommendation object (Step 2.4).
- `EXPECTED_SNAPSHOT` or any Today/simulation assertion changes after Step 2 or 3.
- The reduction is < 40% after Step 3. Report the numbers, since the remaining cost may be elsewhere (for example `detectPRs(state.log)`), and do not widen scope.
- `render` is reassigned or wrapped elsewhere (`grep -n "render=" app.js` shows a reassignment of the function).

## Maintenance notes

- The memo is valid only because `render()` is synchronous. If any part of render ever `await`s before reading recommendations, the memo must not span the await.
- Follow-up (not in this plan): build one `Map<liftKey, sessions[]>` per log identity, so that `progressionHistory` becomes O(sessions of that lift) instead of O(log).
- Reviewers should check that no recommendation object escapes into long-lived state where later mutation could leak across callers.
