# Plan 023: The alpha's recommendation-trust events are actually emitted, and a guard fails CI when a declared event has no producer

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 76a31602..HEAD -- telemetry.js app.js test/telemetry-call-sites.mjs test/telemetry-runtime.mjs test/fixtures/telemetry.mjs docs/measurement`
> Then run the producer census in Step 1. If an event listed below as unwired
> now has a producer, drop it from this plan.

## Status

- **Priority**: P1 (direction; the alpha cannot measure its central hypothesis without it)
- **Effort**: M
- **Risk**: MED (privacy-sensitive surface; must stay enum-only)
- **Depends on**: an owner sign-off on two definitions (Step 2). Sequence with Plan 059, whose final gate binds telemetry evidence.
- **Category**: direction (measurement)
- **Planned at**: commit `76a31602`, 2026-09-23 (on `origin/ui-overhaul/057-management-surfaces`)
- **Backlog**: `docs/backlog.md` §5 says only the Phase-049-approved telemetry allowlist is scheduled. These events **are** in that allowlist (`telemetry.js` `EVENTS`, phase `"alpha"`). This plan wires already-approved events; it adds no new event or property. The owner must still schedule it.

## Why this matters

The business thesis says Taurifer wins on deterministic progression that lifters trust. `docs/measurement/alpha-scorecard.md` operationalizes that as a "Recommendation understanding" funnel (`set_saved` → `recommendation_explained` → later `set_saved`, broken down by `vs_suggestion`) and a "progression trust mechanism" tier (explanation views, match/raise/lower buckets, overrides). Plan 045 declared those events and wrote the scorecard and dashboard recipes, but **the producers were never wired**. `git log -S'"set_saved"' -- app.js` on `main` is empty. Today the alpha can count activations and completed sessions, but it cannot tell whether anyone follows or understands a recommendation. The ops runbook (`docs/measurement/measurement-operations.md:91`) even tells the operator to "verify `set_saved`", which currently can never pass.

## Current state

**Registry** (`telemetry.js:62-92` at `76a31602`). Each event is `event(properties, metric, duplicatePolicy)`, and properties are closed enums only:

```js
    set_saved: event({ vs_suggestion: values("matched", "raised", "lowered", "no_suggestion") }, "Working set committed relative to its suggestion", "repeatable"),
    recommendation_explained: event({ surface: values("workout", "focus", "exercise") }, "Recommendation explanation opened", "repeatable"),
    recommendation_overridden: event({ reason: optional(values("adjustment", "preference", "equipment", "pain", "other")) }, "Recommendation deliberately overridden", "repeatable"),
    exercise_skipped: event({ context: values("planned_session", "one_off") }, "Exercise explicitly skipped", "repeatable"),
    substitution_used: event({ reason: values("equipment", "preference", "pain", "crowded", "other") }, "Exercise substitution committed", "repeatable"),
    session_abandoned: event({ stage: values("before_set", "working", "review"), reason: values("time", "recovery", "pain", "equipment", "schedule", "other") }, "Session explicitly abandoned", "once_per_session"),
    block_review_viewed: event({ completion: values("early", "partial", "complete", "extended") }, "Block review opened", "repeatable"),
```

**Producer census at `76a31602`.** These 11 declared events have no `captureEvent("<name>"` call in production code: `set_saved`, `recommendation_explained`, `recommendation_overridden`, `exercise_skipped`, `substitution_used`, `equipment_context_selected`, `one_off_started`, `one_off_completed`, `session_abandoned`, `block_review_viewed`, `program_transition_selected`.

**Emission helper** (`app.js:784`): `const captureEvent=(event,properties)=>{try{return window.RepForgeTelemetry?.capture(event,properties)===true}catch{return false}};`. Existing producers include `captureEvent("first_set_logged",{})` and `captureEvent("session_completed",{…})` at `app.js:7033-7037`, which use `window.RepForgeTelemetry?.bucketCount(...)`.

**Where each wireable event happens** (`app.js` at `76a31602`):
- *Set commit*: the `.saveset` click handler (`app.js:6715-6733`) dispatches `WorkoutSession.dispatch("completeSet"|"uncommitSet", …)`. After success, `nowDone&&!editing` marks a fresh commit (editing re-commits an already-counted set). The draft set holds `programmed.suggestedLoad` (a number or `null`), `edited.load` (text), and `role` (`"warmup"|"working"`) (`workout-draft.js:376-396`).
- *Explanation*: `openWhySheet(exId,opener)` (`app.js:15112`) is called from workout cards via `[data-why]` (`app.js:6714`). `openWhySheetFor(ex,opener)` (`app.js:15116`) is also called from the exercise page (`app.js:8979`, `#exDetail [data-why]`). Focus is now the only workout-logging surface (Plan 055, G-22).
- *Skip*: `WorkoutSession.dispatch("skipExercise",…)` at `app.js:2204` (toggle) and `app.js:15703`. `app.js:2255` skips fatigue-flagged exercises in bulk (a system-suggested action, not a lifter's individual choice; see Step 2).
- *Block review*: `renderReview()` (`app.js:2816`) renders `#reviewPanel`. `mesocycleLifecycle(meta)` (`app.js:~2655-2663`) returns `{elapsedWeek,current,total,overrunWeeks,isFinalWeek,isComplete}`.

**Guards and tests:**
- `test/telemetry-call-sites.mjs` (fast lane) scans `app.js` and `history-ui.js` for `captureEvent("…"` and asserts that each name is in the allowlist `VALID_ALPHA_EVENTS` (`test/fixtures/telemetry.mjs`).
- `test/telemetry-runtime.mjs` (privacy lane) drives the real app and reads emitted events. It imports `finishEarly`/`selectExercise` from `test/fixtures/focus-workout.mjs`.
- `test/telemetry-leakage.mjs` (privacy lane) checks for hostile sentinels and forbidden properties.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Setup | `(cd test && npm ci && npx playwright install --with-deps --only-shell chromium)` | exit 0 |
| Census | `for e in $(grep -oE '^    [a-z_]+: event\(' telemetry.js \| grep -oE '[a-z_]+'); do n=$(grep -c "captureEvent(\"$e\"" app.js history-ui.js \| awk -F: '{s+=$NF} END {print s}'); echo "$e $n"; done` | per-event producer counts |
| Call-site guard | `node test/telemetry-call-sites.mjs` | exit 0 |
| Unit | `node test/telemetry-unit.mjs` and `node test/telemetry-fixtures.mjs` | exit 0 |
| Privacy lane | `node tools/run-tests.mjs privacy` | exit 0 |
| Cache lockstep | `node test/exercise-library.mjs` | exit 0 |

## Scope

**In scope:** `app.js` (producer calls only); `test/telemetry-call-sites.mjs` (producer-coverage guard); `test/telemetry-runtime.mjs` (behavior cases); `docs/measurement/alpha-scorecard.md` (record the two definitions from Step 2); the cache ritual files `sw.js`, `index.html`, and `test/exercise-library.mjs`.

**Out of scope:**
- Any new event or property, and any change to `telemetry.js` `EVENTS`. Changing the allowlist is an owner decision under ADR 0010.
- `session_abandoned` and `substitution_used`: their required `reason` enums need a UI question that does not exist. **Never send a fabricated reason.**
- `recommendation_overridden`: it needs a product definition of "deliberate". A `raised`/`lowered` `set_saved` is not automatically an override.
- `one_off_*`, `equipment_context_selected`, `program_transition_selected`: their features do not exist yet.

These go in the guard's explicit `RESERVED` list with a one-line reason each.

## Git workflow

Branch `advisor/023-alpha-trust-telemetry`; commits: `test(telemetry): require a producer or a reserved reason for every alpha event`, `feat(telemetry): emit set_saved and recommendation_explained`, `feat(telemetry): emit exercise_skipped and block_review_viewed`, `chore(cache): advance cached shell revision`. Do not push.

## Steps

### Step 1: Producer-coverage guard (fails first)

In `test/telemetry-call-sites.mjs`, after the existing assertions, add:

```js
const RESERVED = new Map([
  ["recommendation_overridden", "needs a product definition of a deliberate override"],
  ["session_abandoned", "needs an explicit abandon action with stage/reason UI"],
  ["substitution_used", "needs a substitution reason question; never fabricate"],
  ["equipment_context_selected", "equipment contexts are deferred (backlog §5)"],
  ["one_off_started", "one-off sessions are deferred (backlog §5)"],
  ["one_off_completed", "one-off sessions are deferred (backlog §5)"],
  ["program_transition_selected", "next-program transition UI not built (see plan 025)"],
]);
const declared = [...telemetry.matchAll(/^\s{4}([a-z_]+): event\(/gm)].map(m => m[1]);
const produced = new Set(captured);
const orphaned = declared.filter(e => !produced.has(e) && !RESERVED.has(e));
assert.deepEqual(orphaned, [], `declared alpha events without a producer or reserved reason: ${orphaned.join(", ")}`);
const staleReserved = [...RESERVED.keys()].filter(e => produced.has(e));
assert.deepEqual(staleReserved, [], "an event is both produced and reserved; drop it from RESERVED");
```

Keep the regex consistent with `telemetry.js` formatting (4-space indent, `name: event(`). Also check that phase-`install_transfer` events either match the pattern and are produced, or are excluded explicitly.

**Verify**: `node test/telemetry-call-sites.mjs` → **fails**, listing exactly `set_saved, recommendation_explained, exercise_skipped, block_review_viewed`.

### Step 2: Owner sign-off on two definitions (STOP until confirmed)

Propose these to the owner and record them in `docs/measurement/alpha-scorecard.md` under a new "Event definitions" subsection:
- **`vs_suggestion`** (per working set at fresh commit): `no_suggestion` if `programmed.suggestedLoad==null`. Otherwise compare the parsed `edited.load` with `suggestedLoad` in the lifter's unit. `matched` if `|Δ| < settings.minJump/2`; `raised` if Δ > 0; `lowered` if Δ < 0. Loads only; reps and effort are ignored. Warm-up sets emit nothing.
- **`block_review_viewed.completion`**, from `mesocycleLifecycle(state.programMeta)`: `extended` if `overrunWeeks>0`; `complete` if `isComplete || current>=total`; `partial` if `current>=Math.ceil(total/2)`; otherwise `early`. Emit at most once per `renderReview()` call that the lifter navigated to (not on background re-renders; see Step 4).
- **`exercise_skipped`**: emitted for the lifter's individual skip toggles (`app.js:2204`, `15703`) when the result is `skipExercise` applied, with `context:"planned_session"`. The bulk fatigue skip at `2255` does **not** emit.

**Verify**: owner approval is recorded in the report (quote it). Without approval, STOP.

### Step 3: Wire `set_saved` and `recommendation_explained`

- In the `.saveset` handler, right after `if(nowDone&&!editing){lastCommitAt=…}`, add (for a working set only):

```js
if(nowDone&&!editing){const s=activeWorkoutDraft.exercises[target.exerciseInstanceId].sets[target.setId];
  if(s.role!=="warmup")captureEvent("set_saved",{vs_suggestion:setVsSuggestion(s)})}
```

  Add a small pure helper `setVsSuggestion(set)` next to the handler that implements the Step 2 definition. Use the file's existing decimal parser (`parseDec`, used in settings) for `edited.load`.
- In `openWhySheetFor(ex,opener)`, after the early return, add `captureEvent("recommendation_explained",{surface:opener?.closest?.("#exDetail")?"exercise":"focus"})`. Use `"focus"` because Focus is the only workout surface (G-22). Do not emit `"workout"` unless a non-Focus workout surface exists.

**Verify**: `node tools/check-production-syntax.mjs` → exit 0. `node test/telemetry-call-sites.mjs` → the orphan list shrinks to `exercise_skipped, block_review_viewed`.

### Step 4: Wire `exercise_skipped` and `block_review_viewed`

- At the two individual skip dispatch sites, after `result.status==="applied"` and only when the dispatched type was `"skipExercise"`, add `captureEvent("exercise_skipped",{context:"planned_session"})`.
- For `block_review_viewed`: find the navigation that makes the review panel visible (the Stats segment `[data-seg="review"]` handler; locate it with `grep -n 'data-seg' app.js`). Emit there, not inside `renderReview()`, because render is also called on unrelated refreshes. Compute `completion` with a pure helper `blockCompletionBucket(life)` implementing the Step 2 definition.

**Verify**: `node test/telemetry-call-sites.mjs` → exit 0 (no orphans). `node test/telemetry-unit.mjs` → exit 0.

### Step 5: Behavior tests

In `test/telemetry-runtime.mjs`, add cases in its existing style:
1. Commit a working set at the suggested load → exactly one `set_saved` with `{vs_suggestion:"matched"}`. Commit another after raising the load by `minJump` → `"raised"`. Commit a warm-up → no event. Uncommit and re-commit the same set in edit mode → no second event.
2. Open the Why sheet from a Focus card → `recommendation_explained` with `{surface:"focus"}`. Open it from the exercise page → `{surface:"exercise"}`.
3. Skip then restore an exercise → exactly one `exercise_skipped`.
4. Open the Progress review segment → one `block_review_viewed` with a valid enum.

Every emitted property must be in the enum. `test/telemetry-leakage.mjs` must stay green unchanged.

**Verify**: `node tools/run-tests.mjs privacy` → exit 0.

### Step 6: Cache ritual

Bump NN → NN+1 (read NN via `grep -o 'repforge-v[0-9]*' sw.js`) in `sw.js` (`CACHE` and every `?v=NN`), `index.html`, and `expectedRevision` in `test/exercise-library.mjs`.

**Verify**: `node test/exercise-library.mjs` → exit 0. `node tools/run-tests.mjs fast` → exit 0.

## Test plan

- A producer-coverage guard in `test/telemetry-call-sites.mjs`. It is permanent: a future declared-but-unwired event fails CI unless it is reserved with a reason.
- Four behavior cases in `test/telemetry-runtime.mjs` (privacy lane), covering exact counts and enum values, including no double count on edit and no warm-up events.

## Done criteria

- [ ] The census shows ≥1 producer for `set_saved`, `recommendation_explained`, `exercise_skipped`, `block_review_viewed`
- [ ] `node test/telemetry-call-sites.mjs` passes with the `RESERVED` map
- [ ] `node tools/run-tests.mjs privacy` and `fast` exit 0
- [ ] The Step 2 definitions are in `docs/measurement/alpha-scorecard.md`, with owner approval quoted in the report
- [ ] `telemetry.js` is unchanged (`git diff --stat telemetry.js` is empty); the `advisor-plans/README.md` row is updated

## STOP conditions

- The owner does not approve the Step 2 definitions.
- Any emission would need a property value not in the enum.
- `test/telemetry-leakage.mjs` fails.
- The review panel has no distinct navigation event, so `block_review_viewed` would fire on background renders. Wire the other three and leave this one reserved, with the reason stated.

## Maintenance notes

- When the one-off, equipment-context, or transition features ship, their plans must remove the matching `RESERVED` entry and add producers. The guard enforces that.
- `set_saved` is `repeatable` and can be high-volume. Confirm PostHog event quotas before the alpha grows.
