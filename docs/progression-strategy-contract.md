# Progression strategy contract

Status: contract version 1, **owner-approved on 2026-08-28**. The `range@1`
numbers come from released behavior in
[Plan 039](../plans/039-capacity-driven-suggestions.md),
[Plan 043](../plans/043-why-this-weight-inspector.md), and
[ADR 0003](adr/0003-capacity-as-progression-currency.md). `rep_goal@1`,
`anchor_backoff@1`, `paired_exposure@1`, `manual@1`, and the modifier
infrastructure decision were approved in the Wave 2 Plan 046 numeric gate and
are locked in `test/fixtures/progression-strategies-v1.json`.
`effort_target@1` was approved on 2026-08-28 as the Plan 047 prerequisite and
is locked in the same fixture.

Two things remain deliberately unapproved and must not be implemented: any
**target-changing** block profile (step loading, volume emphasis, rep-range
emphasis, scheduled deload), and any strategy pair other than the single
approved `paired_exposure@1` combination. Adding either needs a separate owner
approval recorded here and in the fixture first.

## Contract boundary

The progression engine converts normalized evidence into a prescription. It
does not select exercises, program families, or paid features. Capacity is
shared evidence. Each strategy decides how to use it.

The engine must be deterministic and dependency-free. It receives canonical
kilograms, plain data, and explicit versions. It does not read the DOM,
translations, storage, dates, program names, family IDs, or entitlements. The
caller chooses comparable history and supplies it in chronological order.

```js
evaluateProgression({
  engineVersion: 1,
  prescription,
  relation: null,
  modifiers: [],
  settings,
  history,
  currentSession,
  context
})
```

Every result uses this discriminated shape:

```js
{
  kind: "recommendation" | "manual" | "insufficient_evidence" |
        "incompatible" | "invalid",
  engineVersion: 1,
  strategy: { id, version },
  target: { sets: [{ role, load, reps, repMin, repMax, targetRir,
                     targetRirMin, targetRirMax }] },
  status: "new" | "advance" | "hold" | "reduce" | "recalibrate" |
          "manual",
  reasonCodes: [],
  facts: {},
  provenance: {
    evidenceWindow: { sessionCount, currentSetCount },
    modifierVersions: [],
    relationVersion: null
  }
}
```

The result contains facts and stable codes, never rendered prose. Numeric facts
and targets must be finite and non-negative. A result must name its engine and
strategy versions unless malformed input prevents strategy identification.
Unknown strategies, versions, modifiers, and incompatible relations return a
typed result. They never run `range@1` as a fallback.

Inputs are immutable. Equal semantic inputs and versions produce equal semantic
outputs. `familyId`, `programId`, public names, and entitlement fields are not
accepted engine inputs. A strategy cannot add a day, remove a slot, change a
movement, or schedule a deload.

## Shared evidence

A completed working set has `{ load, reps, rir }` in canonical kilograms. A
normalized historical session also has a stable session key, chronological
position, and only comparable sets for one performed movement identity. Warmups,
sets without a positive load or rep count, and evidence from a different
movement stay outside this input.

Capacity uses the released rule:

```text
trusted RIR = clamp(finite RIR, 0, hardRir), blank or missing RIR = 1
capacity reps = performed reps + trusted RIR
capacity e1RM = load * (1 + capacity reps / 30)
reps at load = 30 * (capacity e1RM / load - 1)
```

`hardRir` defaults to 4. The engine rounds the inverse Epley result to six
decimal places before threshold comparisons. Capacity may extend a range load
jump. It must never cancel a jump earned by performed reps at the top of the
range.

## Versioning and approval

A strategy version changes when arithmetic, thresholds, required evidence,
reason-code meaning, or parameter interpretation changes. New optional facts
that do not change a result may use the same strategy version with an engine
version change. Removing or renaming a reason code requires a new strategy
version.

The machine fixture at `test/fixtures/progression-strategies-v1.json` is the
executable review record. Each strategy and relation has an approval state.
Tests may execute only examples whose state is `locked`. `pending` entries
document missing decisions and must not supply an expected numeric target.

## `range@1`

### Job and fit

Range progression advances a load after the lifter fills a per-set rep range at
the authored effort. It suits ordinary externally loaded movements whose load
can be snapped to a known increment. Bodyweight-only and manually worded
prescriptions are incompatible until their load semantics are explicit.

Required parameters are:

| Field | Contract |
| --- | --- |
| `workingSets` | Integer from 1 through 20. |
| `repMin` | Integer from 1 through 100. |
| `repMax` | Integer from `repMin` through 100. |
| `targetRirMin` | Optional finite number from 0 through 10. |
| `targetRirMax` | Optional finite number from `targetRirMin` through 10. |
| `minLoadIncrement` | Positive finite kilograms, at most 1,000. |
| `jumpPercent` | Finite percentage from 0 through 100. |
| `hardRir` | Finite RIR credit cap from 1 through 10. |

The current legacy projection maps `Exercise.sets`, `min`, and `max` to
`workingSets`, `repMin`, and `repMax`. Current settings supply
`minLoadIncrement`, `jumpPercent`, and `hardRir`. Projection remains in memory
during Wave 1 and does not mutate stored exercises.

### Minimum evidence

No history returns `status: "new"`, no invented load, and an in-range rep
target beginning at `repMin`. One comparable session is enough for the ordinary
range decision. Stall needs three sessions. Recovery needs two. Block trend
needs three sessions inside the supplied block window.

### Locked next-session rules

The latest session uses median load, median capacity e1RM, median performed
reps, minimum performed reps, and the lifter's median capped RIR over the latest
three sessions. Let `cr` be capacity reps predicted at the latest median load.
Rules run in this order:

1. If `cr >= repMax + 3`, advance with a double jump.
2. Otherwise, advance with one jump when all sets reached `repMax`, or when at
   least all but one of three or more sets reached `repMax` and the remaining
   set reached `repMax - 1`, or when `cr >= repMax + 1`.
3. If `cr < repMin`, reduce by one jump.
4. Preserve the released three-session same-load stall rule.
5. Preserve the released two-session recovery rule.
6. Otherwise hold. `cr - median performed reps >= 2` reports the
   `range.capacity_room` reason while `cr <= repMax`; other holds report
   `range.room_in_range`.

A jump is the greater of `load * jumpPercent * multiplier / 100` and
`minLoadIncrement`. The new load rounds to the nearest load-grid increment. A
reduction never falls below one increment. A hold also snaps an off-grid
historical median to the grid and uses the same floor.

A falling block trend may temper only a double jump into a single jump. It does
not turn an advance into a hold or reduction. No branch schedules a deload.

After any load change or off-grid snap, next-session reps equal predicted
capacity reps at the target load minus recent typical RIR, rounded and clamped
to `[repMin, repMax]`. An exact-load hold chases one rep when the result permits
rep chasing. Recovery holds the prior target.

### Locked examples

These examples assume a 6-8 range, 2.5 kg minimum increment, 2.5% ordinary
jump, and `hardRir: 4` unless stated otherwise.

| Evidence | Expected decision | Reason |
| --- | --- | --- |
| No comparable history | New, load `null`, 6 reps | `range.no_history` |
| 2 sets at 100 kg x 6, RIR 3 | Advance to 102.5 kg | `range.capacity_top` |
| 2 sets at 100 kg x 6, RIR 6 | Advance to 102.5 kg, not a double jump | RIR credit caps at 4. |
| 3 sets at 100 kg x 8, RIR 0 | Advance to 102.5 kg | Performed top-of-range floor. |
| 2 sets at 100 kg x 5, RIR 0 | Reduce to 97.5 kg | `range.below_floor` |
| 2 sets at 100 kg x 5, RIR 2 | Hold 100 kg | Capacity reaches the range. |
| 2 sets at 100 kg x 6, RIR 0 | Hold 100 kg | `range.room_in_range` |
| 2 sets at 100 kg x 6, RIR 2 | Hold and chase reps | `range.capacity_room` |

The executable fixture also locks near-top majority, double advancement,
load-grid dominance, falling-block tempering, recovery, stall, and re-entry.

### Current-session rule

Completed working sets in the current slot take precedence over prior-session
targets. The engine estimates capacity drop from consecutive current sets when
at least two exist, otherwise from the median consecutive drop across the latest
three comparable sessions, otherwise zero. It clamps the drop to 0-5%.

It predicts the next set from the last set's capacity after that drop. A
prediction at least one rep above `repMax` advances load. A prediction below
`repMin` reduces load. Otherwise it holds and gives an in-range rep target.
Caller-owned touched or committed future sets never enter the replacement list.

Session freshness is a separate, temper-only evidence fact for a slot with no
completed current set. It requires at least three completed working sets in
other slots and at least one other movement with two historical sessions. The
weighted deficit uses a 0.3 systemic floor, 1.0 primary-to-primary overlap, 0.5
primary-to-secondary overlap, and 0.25 secondary-to-secondary overlap. It
applies half the weighted negative deficit and caps the reduction at 5%.
Positive evidence never boosts a target.

### Edge behavior

- Partial historical sessions remain usable if they contain a comparable
  positive working set. Missing and extra sets do not redefine `workingSets`.
- Different loads within a session remain separate set evidence. The
  next-session reference load is their median.
- Blank RIR receives the conservative value 1. Negative RIR floors at 0. High
  RIR caps at `hardRir`.
- Non-finite numbers, inverted ranges, empty sessions, unsupported modifiers,
  bodyweight-only load semantics, and unknown keys return typed invalid or
  incompatible results.
- Grid rounding changes the prescribed target, never the recorded history.

Reason codes are `range.no_history`, `range.capacity_top_double`,
`range.performed_top`, `range.capacity_top`, `range.below_floor`,
`range.stalled`, `range.recovery`, `range.capacity_room`,
`range.room_in_range`, `range.block_tempered`, `range.grid_rounded`,
`range.reentry`, `range.current_advance`, `range.current_reduce`,
`range.current_hold`, `range.current_drop`, and `range.freshness_temper`.

Required facts include the latest median load, median capacity e1RM, capacity
reps at that load, latest median performed reps, typical RIR, raw and rounded
load movement, re-entry reps, block trend, expected set drop, and freshness
factor when each fact applies.
## `rep_goal@1`

Status: **approved 2026-08-27**. Locked in the fixture under
`strategies["rep_goal@1"]`.

### Job and fit

Rep-goal progression owns a total working-rep goal across a fixed authored set
count, the distribution of those reps, and the load advance earned once the
goal is met. It never changes the authored set count and never rewrites the
authored goal. It suits externally loaded movements whose load snaps to a
known increment.

### Parameters

| Field | Contract |
| --- | --- |
| `workingSets` | Integer from 1 through 20. |
| `repGoal` | Integer from 1 through 200. |
| `repFloor` | Integer from 1 through 100. |
| `repCeiling` | Integer from `repFloor` through 100. |
| `targetRirMin` | Finite number from 0 through 10. |
| `targetRirMax` | Finite number from `targetRirMin` through 10. |
| `minLoadIncrement` | Positive finite kilograms, at most 1,000. |
| `jumpPercent` | Finite percentage from 0 through 100. |
| `distributionPolicy` | Exactly `"balanced_frontload_v1"`. |
| `loadMode` | Optional. `"external"` (default) or `"bodyweight"`. |

A prescription is only satisfiable when

```text
workingSets * repFloor <= repGoal <= workingSets * repCeiling
```

A structurally valid prescription that fails this inequality returns
`kind: "invalid"` with `rep_goal.invalid_distribution`. Malformed shapes and
types keep the generic `engine.invalid_input`.

`minLoadIncrement` and `jumpPercent` are authored here and size the jump.
The **load grid** the result snaps to is the device's `settings.minLoadIncrement`,
exactly as `range@1` uses it. Blueprints may commonly author 3 sets, a goal of
30, and a 6–12 per-set window, but the engine assumes none of those numbers.

### `balanced_frontload_v1`

For a total `T` across `N` untouched sets: split evenly, give the remainder to
the earlier sets, then clamp every set to `[repFloor, repCeiling]`.

| Total / sets | Distribution |
| --- | --- |
| 30 / 3 | 10, 10, 10 |
| 31 / 3 | 11, 10, 10 |
| 32 / 3 | 11, 11, 10 |
| 25 / 3 | 9, 8, 8 |

The clamp is what keeps a catch-up set from exceeding the ceiling and a small
remainder from falling under the floor. No other distribution policy exists in
v1.

### Locked next-session rules

The latest comparable session decides. Only the **first `workingSets` sets** of
that session are authored evidence: extra sets are recorded evidence that never
earn the goal and never redefine `workingSets` or `repGoal`. The reference load
is their median load, capacity is their median capacity e1RM, and effort is
their median trusted RIR.

Rules run in this order:

1. No history: `status: "new"`, no invented load, the authored distribution.
2. The goal is earned when the session holds at least `workingSets` sets and
   their reps total at least `repGoal`. A session with fewer sets cannot earn
   it.
   - Earned and median trusted RIR is at least `targetRirMin`: advance one load
     step. `targetRirMax` describes acceptable room, not a second hurdle.
     Exceeding the goal never produces a double jump; v1 has exactly one
     advancement magnitude.
   - Earned but median trusted RIR is below `targetRirMin`: hold.
3. Capacity reps at the reference load below `repFloor`: reduce one grid step.
   This is a conservative capacity-floor condition, not a plateau algorithm.
4. Otherwise hold and keep pursuing the goal. Missing the total once never
   reduces load.

A jump is `max(load * jumpPercent / 100, minLoadIncrement)`, then snapped to the
grid. A reduction never falls below one increment.

**After an advance**, the same authored `repGoal` is redistributed at the new
load, bounded by capacity: per-set capacity is
`clamp(floor(repsAtLoad(capacity, newLoad)), repFloor, repCeiling)`. If the goal
exceeds `workingSets` times that value, the closest bounded feasible total is
prescribed and `rep_goal.rebuild_after_advance` reports that the target is
rebuilding toward the goal. The authored `repGoal` itself is never lowered.
This capacity clamp applies only on the advance path; a hold or a reduction
prescribes the authored distribution at its load.

### Locked current-session rule

Completed sets in the current slot take precedence. Remaining goal is
`repGoal` minus the reps of the completed authored sets; it is distributed
across the untouched authored sets, and the engine returns the next one.

The bounded observed drop is the shared mechanism `range@1` already uses:
consecutive current sets first, otherwise the recent comparable historical
median, otherwise zero, clamped to 0–5%. It predicts the next set's capacity
from the last completed set, which caps the prescribed reps. It shapes
distribution; it never changes the authored total.

The exact remaining share is raised to `repFloor` when it falls below it and
lowered to the per-set cap when capacity cannot support it; either adjustment
reports `rep_goal.partial_distribution`. With every authored set complete the
strategy prescribes no further set.

### Locked examples

Defaults are 3 sets, goal 30, floor 6, ceiling 12, `targetRirMin` 1,
2.5 kg increment, 2.5% jump, `hardRir` 4.

| Evidence | Expected decision |
| --- | --- |
| No history | New, load `null`, 10/10/10 |
| 3 × 100 kg × 10, RIR 2 | Advance to 102.5 kg, 10/10/10 |
| 3 × 100 kg × 10, RIR 0 | Hold, `rep_goal.effort_too_high` |
| 2 × 100 kg × 10, RIR 2 | Hold; fewer than the authored sets cannot earn |
| 3 × 100 kg × 10 plus a fourth set | Advance on the first three only |
| 3 × 101 kg × 10, RIR 2 | Advance and snap to 102.5 kg |
| 3 × 100 kg × 8, RIR 2 | Hold, `rep_goal.progress` |
| 3 × 100 kg × 5, RIR 0 | Reduce to 97.5 kg, `rep_goal.capacity_below_floor` |
| 3 × 100 kg × 10, RIR 1, 10% jump | Advance to 110 kg, rebuild to 7/7/7 |
| Current 11, 10 | Next set 9 |
| Current 11, 9 | Next set 8 after the capped drop |
| Current 12, 12 | Next set 6, the authored floor |
| Current 12, 13 | Next set 6; the remainder never goes under the floor |
| Current 10, 10, 10 | No further set |
| `loadMode: "bodyweight"` | Incompatible; `manual@1` is the alternative |
| `repGoal` outside the bounds | Invalid distribution |

### Edge behavior

Bodyweight-only prescriptions are incompatible in v1 and return
`rep_goal.bodyweight_incompatible`; body mass is never treated as hidden
external load. Rep distributions are integers. All load changes use the
actionable grid.

Reason codes are `rep_goal.no_history`, `rep_goal.progress`,
`rep_goal.goal_met`, `rep_goal.effort_too_high`, `rep_goal.advance`,
`rep_goal.rebuild_after_advance`, `rep_goal.partial_distribution`,
`rep_goal.capacity_below_floor`, `rep_goal.grid_rounded`,
`rep_goal.invalid_distribution`, `rep_goal.bodyweight_incompatible`,
`rep_goal.current_progress`, and `rep_goal.current_drop`.

## `effort_target@1`

Status: **approved 2026-08-28**. Locked in the fixture under
`strategies["effort_target@1"]`.

### Job and fit

Effort-target progression keeps fixed authored reps and changes only the next
load. It compares completed work with an authored RIR range. This strategy is
selective and suits externally loaded heavy-primary or general-strength work.
`range@1` remains the default strategy.

RIR autoregulation has support at the method level. The exact thresholds and
one-grid-step rule are evidence-informed Taurifer choices. They are not
physiological boundaries.

### Parameters

| Field | Contract |
| --- | --- |
| `workingSets` | Integer from 1 through 20. |
| `targetReps` | Integer from 1 through 100. |
| `targetRirMin` | Finite number from 0 through 10. |
| `targetRirMax` | Finite number from `targetRirMin` through 10. |
| `minLoadIncrement` | Positive finite kilograms, at most 1,000. |
| `loadMode` | Optional. `"external"` is the default. `"bodyweight"` is incompatible. |

The device loading grid takes precedence when the caller supplies a more
specific increment. The authored increment remains the exercise loading
capability fallback.

### Comparable evidence

The caller supplies completed working sets for one exact performed movement
identity. Each set has a positive finite load and reps. A finite RIR value is
direct effort evidence. Missing RIR remains missing.

The strategy uses the latest comparable session with finite RIR evidence. The
representative load and reps are the medians of the eligible sets. The
representative RIR is the median of the finite RIR values.

### Next-session rules

1. With no comparable history, return `status: "new"`. Preserve the authored
   sets, reps, and RIR range, and return a `null` load.
2. With actionable load history but no finite RIR evidence, hold the latest
   actionable load. Return `effort_target.no_rir_evidence`.
3. If representative reps are below `targetReps`, reduce one grid step. Return
   `effort_target.rep_miss`.
4. If representative reps reach the target but RIR is below `targetRirMin`,
   reduce one grid step. Return `effort_target.too_hard`.
5. If representative reps reach the target and RIR is above `targetRirMax`,
   advance one grid step. Return `effort_target.too_easy`.
6. Otherwise hold. Return `effort_target.on_target`.

The strategy first snaps off-grid evidence to the actionable grid. One evidence
step then changes at most one grid increment. A reduction stops at one positive
increment. The strategy has no double jump, percentage wave, capacity-derived
extra jump, or scheduled deload.

Every recommendation preserves `workingSets`, `targetReps`, `targetRirMin`, and
`targetRirMax`.

### Current-session rules

The latest completed set decides the next untouched set. More reserve than the
authored ceiling advances one grid step. A rep miss or an RIR value below the
authored floor reduces one grid step. Every other result holds. Missing RIR
does not become an invented effort value.

The engine returns at most the next target. After all authored sets are
complete, it returns no target. The app does not replace touched, committed, or
completed future sets.

### Incompatible combinations

Bodyweight without an actionable external-load mechanism returns
`effort_target.bodyweight_incompatible`. `effort_target@1` is not in the
approved `paired_exposure@1` pair matrix. A paired relation therefore returns
`paired_exposure.incompatible_strategy_pair`.

Reason codes are `effort_target.no_history`,
`effort_target.no_rir_evidence`, `effort_target.too_easy`,
`effort_target.on_target`, `effort_target.rep_miss`,
`effort_target.too_hard`, `effort_target.grid_rounded`,
`effort_target.current_advance`, `effort_target.current_hold`, and
`effort_target.current_reduce`.

Required facts include the representative load, reps, and RIR, the authored
rep and RIR targets, the raw load movement, the snapped target load, and the
evidence set and session counts.

## `anchor_backoff@1`

Status: **approved 2026-08-27**. Deliberately narrow. Locked in the fixture
under `strategies["anchor_backoff@1"]`.

### Job and fit

Exactly one anchor working set followed by one or more authored back-off
working sets. It suits externally loaded general-strength and hypertrophy work.
It models no peaking and no attempt selection.

### Parameters

`anchorRepMin`, `anchorRepMax`, `anchorTargetRirMin`, `anchorTargetRirMax`,
`backoffSets`, `backoffRepMin`, `backoffRepMax`, `backoffPercent`,
`minLoadIncrement`, `jumpPercent`, and the optional `loadMode`.

### Derivation: `percentage_of_anchor_load_v1`

Back-off load is `anchorLoad * backoffPercent`, snapped to the actionable grid.
`backoffPercent` is authored and must fall between 0.70 and 0.95 inclusive. No
effort-derived percentage exists in v1, and the percentage is never inferred
from a family, program name, movement, or training goal.

### Locked anchor progression

Using the latest session's anchor set:

1. Capacity reps at the anchor load below `anchorRepMin`: reduce one grid step.
2. Anchor reps at `anchorRepMax` with trusted RIR at least
   `anchorTargetRirMin`: advance one grid step.
3. Otherwise hold.

No double jump, no automatic deload, no peaking, no attempt selection. The jump
is `max(anchorLoad * jumpPercent / 100, minLoadIncrement)`, then grid-rounded.

The anchor rep target is
`clamp(floor(repsAtLoad(anchorCapacity, targetAnchorLoad)), anchorRepMin, anchorRepMax)`,
and the back-off rep target is the same expression at the derived back-off load
clamped to `[backoffRepMin, backoffRepMax]`. Both use shared Capacity only, and
`backoffSets` never changes.

### Locked current-session rule

The current session's anchor is its first completed set. Once that anchor is
complete, back-off targets are derived from the **actual completed anchor
load and evidence**, and only **untouched future back-off sets** are updated.
Committed sets, completed sets, and manually touched future sets are never
replaced. A partial back-off session never redefines `backoffSets`; with every
authored back-off complete the strategy prescribes no further set.

A **failed anchor** is one whose capacity at the performed load falls below
`anchorRepMin`. It reports `status: "recalibrate"`, derives untouched back-offs
from the actual current anchor, schedules no deload, changes no program
structure, and lets the next session's anchor reduce by one normal grid step.
No larger emergency reduction exists in v1.

If today's anchor is absent, valid prior anchor evidence is used. With neither,
the result is `kind: "insufficient_evidence"` with
`anchor_backoff.insufficient_anchor`. Back-offs are never derived from a
missing anchor.

### Locked examples

Defaults are an anchor of 3–5 reps at `anchorTargetRirMin` 1, three back-offs
of 6–10 reps, `backoffPercent` 0.8, 2.5 kg increment, 2.5% jump.

| Evidence | Expected decision |
| --- | --- |
| No history | New; authored structure, load `null` |
| Anchor 100 kg × 5, RIR 2 | Anchor advances to 102.5 kg; back-offs 82.5 kg × 10 |
| Anchor 100 kg × 4, RIR 2 | Anchor holds at 100 kg; back-offs 80 kg × 10 |
| Anchor 100 kg × 2, RIR 0 | Anchor reduces to 97.5 kg; back-offs 77.5 kg |
| `backoffPercent` 0.82 from 100 kg | Back-off snaps to 82.5 kg |
| Current anchor 100 kg × 5 | Untouched back-offs become 80 kg × 10 |
| Current anchor plus one back-off | Authored back-off count preserved |
| Current anchor 100 kg × 2, RIR 0 | Recalibrate; untouched back-offs re-derived |
| Anchor plus every back-off complete | No further set |
| Back-off logged with no anchor anywhere | Insufficient anchor evidence |
| Back-off logged today with a prior anchor | Prior-anchor path |
| `loadMode: "bodyweight"` | Incompatible; `manual@1` is the alternative |

Reason codes are `anchor_backoff.no_history`, `anchor_backoff.prior_anchor`,
`anchor_backoff.current_anchor`, `anchor_backoff.anchor_advance`,
`anchor_backoff.anchor_hold`, `anchor_backoff.anchor_below_floor`,
`anchor_backoff.backoff_percent`, `anchor_backoff.backoff_recalculated`,
`anchor_backoff.grid_rounded`, `anchor_backoff.insufficient_anchor`, and
`anchor_backoff.bodyweight_incompatible`.

Working sets carry an optional `role` of `"working"`, `"anchor"`, or
`"backoff"`. It is additive and optional: absent roles behave exactly as
before, and `range@1` ignores it entirely. It is what lets the engine tell a
logged back-off apart from a missing anchor.

## `paired_exposure@1`

Status: **approved 2026-08-27** for one narrow pair. Locked in the fixture
under `relations["paired_exposure@1"]`.

Paired exposure is a program-level relation, not an exercise strategy. It has
exactly two distinct live slot IDs for one performed movement identity, one
`heavy` and one `volume`. Each slot keeps its own prescription and history.

### The one approved pair

| Role | Strategy |
| --- | --- |
| `heavy` | `anchor_backoff@1` |
| `volume` | `rep_goal@1` |

Every other combination — including the same two strategies with their roles
swapped — returns `kind: "incompatible"` with
`paired_exposure.incompatible_strategy_pair`. The relation never alters either
strategy's authored prescription.

### Evidence and confidence

At most the three most recent comparable completed sessions of each exposure
participate. Nothing older enters paired confidence in v1; each slot still
keeps its full ordinary history for its own strategy.

| Confidence | Condition |
| --- | --- |
| `full` | The counterpart completed a comparable exposure at its most recent expected occurrence. |
| `reduced` | Counterpart evidence exists in the window but the most recent expected exposure was skipped or missing. |
| `none` | No comparable counterpart evidence in the window. |

The relation exposes the counterpart's Capacity evidence as context. It never
copies a load target, rep target, set count, or progression status from one
exposure into the other.

### The bounding rule

Paired evidence is **temper-only**. For every target-changing dimension the
paired result is no more aggressive than the independent strategy result: no
larger load increase, no extra sets, no extra reps, no double jump, no
scheduled session replacement. Materially contradicting evidence may reduce an
advance to a hold. It may never turn a hold into a reduction — an actual
reduction still requires the strategy's own evidence — and it never increases
aggressiveness.

Pairing requires explicit compatible movement identity. Matching display text
is not enough, and distinct machine identities are never paired.

Reason codes are `paired_exposure.full_confidence`,
`paired_exposure.reduced_confidence`,
`paired_exposure.no_counterpart_evidence`, `paired_exposure.tempered`,
`paired_exposure.incompatible_strategy_pair`, and
`paired_exposure.incompatible_movement`.

## Block-profile modifiers

Status: **infrastructure approved 2026-08-27; no periodization approved.**

Wave 2 implements the modifier registry, schema validation, persistence,
compatibility checking, deterministic ordering, typed rejection of unknown or
incompatible modifiers, reason and provenance handling, and the composition
machinery — and nothing else.

Exactly one modifier is approved, and it is fixture-only:

| Modifier | Week values | Effect |
| --- | --- | --- |
| `identity_block@1` | `[1, 1, 1, 1, 1, 1]` | Changes no target field. |

It exists to prove plumbing, versioning, ordering, serialization, and
determinism without introducing unapproved training periodization. It is not a
user-facing program feature and must never appear in Browse or in editing UI.

**No step-loading, volume-emphasis, rep-range-emphasis, scheduled-deload, or
other target-changing modifier is approved.** This is intentional scope
control, not an implementation omission. Plan 047 may author a target-changing
modifier only after a separate explicit owner approval. A modifier may never
add or remove a day or slot, change movement identity or strategy, or encode a
scheduled deload; manual progression ignores target-changing modifiers.

Modifier application order is the serialized prescription order after
validation. Because only the identity modifier is approved, no non-commutative
target-changing combination exists in Wave 2. Unknown modifiers return
incompatible or invalid under the existing contract; they never silently
disappear and never fall back.

## `manual@1`

Status: **approved 2026-08-27**. Locked in the fixture under
`strategies["manual@1"]`.

Manual means the program or user owns the target. It is suitable for an
unsupported imported rule, bodyweight or external prescriptions whose load
semantics Taurifer cannot execute, and deliberate manual authorship. It
preserves supported structured authored fields and may report comparable prior
performance.

It always returns `kind: "manual"`, `status: "manual"`, an empty prescribed
target, and `manual.authored_target` or `manual.unsupported_import`. It never
invents load, reps, RIR, set count, or a ghost suggestion, and comparable
history never turns it into a prescribed target. No history is required.
Invalid structured data is reported without discarding recoverable backup
provenance. Changing this no-invention rule requires a new version.

## Legacy and future persistence policy

Wave 1 does not write a new progression shape. A legacy exercise with no
meaningful `progressionType` receives an in-memory `range@1` projection. An
unknown non-empty legacy type must later execute as manual with an unsupported
import reason while full backup preserves the original value. Historical rows
remain immutable.

The recognized legacy aliases are deliberately closed. The value is trimmed
before lookup; matching is otherwise case-sensitive, and no value outside this
table is recognized:

| Legacy `progressionType` | In-memory envelope |
| --- | --- |
| `double_progression` | `range@1` |

Future persistence work must round-trip recognized prescriptions, modifiers,
relations, and provenance through durable state, full backup, program JSON,
verbose and compact setup links, and human-readable export before any new
format can be written. Released setup `v1` and `v2` decoders remain permanent;
the v3 compact envelope is the only place for new progression fields.

## Review record

Settled in the Wave 2 Plan 046 numeric gate, 2026-08-27:

- `range@1` parameter bounds and every locked example stand as released.
- `rep_goal@1`: parameters, the `balanced_frontload_v1` policy, advancement,
  rebuild-after-advance, the capacity floor, extra and missing sets, the
  current-session rule, bodyweight, and rounding.
- `effort_target@1`: fixed reps, authored RIR ranges, direct effort evidence,
  conservative missing-RIR holds, one-grid-step changes, current-session
  behavior, bodyweight incompatibility, and no new paired relation.
- `anchor_backoff@1`: parameters, `percentage_of_anchor_load_v1` with a
  0.70–0.95 authored band, anchor progression, back-off derivation, the
  untouched-only recalculation rule, failed and missing anchors, and bodyweight.
- `paired_exposure@1`: `anchor_backoff@1` heavy with `rep_goal@1` volume as the
  only pair, a three-session window, categorical confidence, and the temper-only
  bounding rule.
- Modifiers: infrastructure plus `identity_block@1` only.
- `manual@1` remains a no-invented-target state.

Still open, and blocking any code that would depend on them:

- Any **target-changing** block profile — step loading, volume emphasis,
  rep-range emphasis, or a scheduled deload — with complete six-week tables.
- Any `paired_exposure@1` combination beyond the one approved pair.

Standing rejections: no strategy branch keyed by family, program, public name,
or entitlement; no automatic deload; no plateau intervention; no exercise-
specific formula; no inferred volume tolerance; no randomization or reroll; no
formula imported from an external template.

## Extracted engine reference

`progression-engine.js` is the pure artifact produced by Wave 1. It is a UMD
module: `module.exports` in Node, `window.RepForgeProgression` in the browser.
It reads no DOM, storage, `i18n`, network, clock, or randomness, and depends on
no other application file.

### Public surface

`ENGINE_VERSION`, `STRATEGY_IDS`, `CAPACITY`, `LIMITS`, the entry point
`evaluateProgression(input)`, and the pure helpers `isFiniteNumber`, `clamp`,
`median`, `capRir`, `capReps`, `repsAtLoad`, `roundToGrid`, `jumpAmount`,
`validateSettings`, `validateRangePrescription`, `normalizeHistory`,
`normalizeCurrentSession`, `summarizeSession`, `summarizeHistory`,
`typicalRir`, and `expectedSetDrop`.

### `evaluateProgression(input)`

`input` must contain exactly these keys:
`engineVersion`, `prescription` (`{ schemaVersion, strategy: { id, version,
params }, modifiers }`), `relation`, `modifiers`, `settings`, `history`,
`currentSession`, `context`. Any other top-level key makes the call invalid.
`engineVersion` must equal `ENGINE_VERSION`. No time, entitlement, family,
program, or public-name field may appear; supplying one is an invalid input,
not a branch.

The result is always the same shape:

```
{ kind, engineVersion, strategy: { id, version },
  target: { sets: [...] }, status, reasonCodes, facts, provenance }
```

- `kind`:
  - `recommendation` — a strategy executed against evidence.
  - `invalid` — malformed input; `status: "manual"`,
    `reasonCodes: ["engine.invalid_input"]`, `facts.issues` lists the reasons.
  - `incompatible` — well-formed but unsupported; `reasonCodes` is one of
    `engine.unsupported_strategy`, `engine.unsupported_relation`,
    `engine.unsupported_modifier`. At `range@1` any strategy other than
    `range` v1, any non-null `relation`, and any non-empty `modifiers` land
    here. That is intended until the contract is approved and fixtured.
  - `manual` — `manual@1` no-invention state.
- `status`: `advance`, `hold`, `reduce`, or `manual`.
- `target.sets[]`: `{ role: "working", load, reps, repMin, repMax, targetRir }`.
  `load` is `null` when it cannot be known. With a non-empty `currentSession`
  exactly one set is returned; otherwise `params.workingSets` sets.
- `provenance.evidenceWindow`: `{ sessionCount, currentSetCount }`;
  `modifierVersions: []` and `relationVersion: null` at `range@1`.
- `reasonCodes`: stable dot-namespaced strings, never localized. The UI maps
  each code to copy. `range@1` emits `range.performed_top`,
  `range.capacity_top`, `range.capacity_top_double`, `range.room_in_range`,
  `range.capacity_room`, `range.stalled`, `range.recovery`,
  `range.below_floor`, `range.no_history`, `range.block_tempered`,
  `range.grid_rounded`, `range.reentry`, `range.freshness_temper`, and the
  `range.current_advance` / `range.current_reduce` / `range.current_hold` /
  `range.current_drop` set for the current-session path.

### Guarantees

Deep-equal input produces deep-equal output. Input is never mutated. There is
no fallback: an unsupported prescription never silently becomes `range@1`.

## Wave 2 contract

- **The `app.js` adapter is landed.** It calls `evaluateProgression` with
  normalized evidence and renders the pure result back into the existing UI
  strings without changing any displayed value; `test/recommendation-parity.mjs`
  is the gate.
- **New strategies and modifiers.** None executes until its numeric contract is
  owner-approved and captured as executable fixtures. `rep_goal@1`,
  `anchor_backoff@1`, `paired_exposure@1`, `manual@1`, and `identity_block@1`
  cleared that gate on 2026-08-27. Everything still `pending` —
  every target-changing block profile, every other strategy pair — keeps
  returning `incompatible` by design.
- **Slice order** (Plan 046): versioned model and round-trips → `rep_goal@1`
  plus `manual@1` persistence → `anchor_backoff@1` → `paired_exposure@1` and
  block modifiers → hardening. Do not merge a slice that writes a progression,
  relation, or modifier shape it cannot also read, back up, export to program
  JSON, encode in verbose and compact setup links, and render in text export.
- **Compatibility.** Released setup `v1` and `v2` decoders remain permanent;
  v3 carries the progression extension. Logged rows stay immutable. A legacy exercise with no meaningful
  `progressionType` gets an in-memory `range@1` projection; an unknown
  non-empty legacy type must execute as `manual@1` with an unsupported-import
  reason while full backup preserves the original value.
- **API stability.** `kind`, `status`, and every reason code are an API
  surface. Add new codes; never repurpose an existing one. Each new strategy
  adds its own `<strategyId>.*` reason namespace.

## Recovery-week overlay (schedule policy, not strategy math)

Recovery is a confirmed, versioned week-one schedule policy governed by
[`docs/recovery-week-policy.md`](recovery-week-policy.md), not a progression
strategy, modifier, or block profile. The engines above are unchanged: no
strategy branch, no target mutation, no automatic deload. A confirmed recovery
writes a `recovery-week` transition record under
[`docs/block-transition-provenance.md`](block-transition-provenance.md) with
its evidence snapshot and policy version. The exact allocation constants are
owner-gated in that policy; until selected, no recovery-week record may be
written.
