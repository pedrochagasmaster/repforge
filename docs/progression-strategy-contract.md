# Progression strategy contract

Status: proposed contract version 1 for owner review. Only the `range@1`
numbers marked **locked** come from released, owner-approved behavior in
[Plan 039](../plans/039-capacity-driven-suggestions.md),
[Plan 043](../plans/043-why-this-weight-inspector.md), and
[ADR 0003](adr/0003-capacity-as-progression-currency.md). All other numeric
decisions remain review gates. Code must not implement them until this document
and the matching fixture mark them approved.

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
  target: { sets: [{ role, load, reps, repMin, repMax, targetRir }] },
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

Status: numeric review pending. Do not implement in Wave 1.

The strategy owns a total working-rep goal across authored sets. Suitable
movements need comparable externally loaded working sets. Its closed schema
will include working-set count, total-rep goal, per-set floor and ceiling,
target RIR window, load grid and jump rule, and one named distribution policy.

Minimum usable evidence is one completed comparable working set for a partial
current-session result and one completed comparable session for a next-session
result. Extra sets remain evidence but do not redefine the goal. Different
loads split comparability rather than being summed blindly. Missing RIR lowers
confidence under the shared conservative default.

The owner must approve exact examples for goal completion at the effort limit,
goal completion at excessive effort, one missed set, one extra set, load
advancement redistribution, partial-session remaining reps, expected set drop,
bodyweight handling, and rounding. Until then, the only safe executable
alternative is `manual@1`; `range@1` may be offered only after the user chooses
to change the authored prescription.

Planned reason families are total goal met, progress toward goal, effort too
high, insufficient comparable evidence, partial distribution, and invalid
distribution. Their final IDs and fact fields require the same numeric review.
A new distribution policy or advancement rule requires a new strategy version.

## `anchor_backoff@1`

Status: numeric review pending. Do not implement in Wave 1.

This strategy has one anchor working set followed by authored back-off sets.
Its schema will include the anchor rep and effort target, back-off count, one
bounded derivation method, back-off rep target, load grid, and permitted
adjustment bounds. It suits externally loaded general-strength and hypertrophy
work. It does not model peaking or attempt selection.

Previous anchor evidence is the minimum next-session evidence. A completed
current anchor may update only untouched future back-offs. Without a valid
current anchor, the result must name prior evidence or insufficient evidence.

The owner must approve exact anchor advancement, percentage or effort
derivation, failure recalibration, rounding, missing-anchor, partial back-off,
and bodyweight examples. Until then, `manual@1` is the compatible execution
alternative. Planned reason families distinguish prior anchor, current anchor,
authored back-off rule, grid rounding, failed anchor, and insufficient
evidence. Changing the derivation math or failure rule requires a new version.

## `paired_exposure@1`

Status: compatible strategy pair and numeric bounds pending. Do not implement
in Wave 1.

Paired exposure is a program-level relation, not an exercise strategy. It has
exactly two distinct live slot IDs for one performed movement identity, with
one `heavy` and one `volume` role. Each slot retains its own prescription and
history. The relation may pass a declared Capacity anchor. It cannot copy one
slot's targets into the other.

The minimum evidence is one comparable set from the declared counterpart.
Missing or skipped counterpart exposure lowers confidence. It never creates a
replacement session. Matching display names do not prove identity. Shared
library identity may prove compatible aliases; distinct machine identities do
not.

The owner must approve the first allowed heavy and volume strategy pair, the
evidence window, confidence reduction, and bounding examples. All other pairs
return `incompatible` with either a supported relation repair or removal. A new
allowed pair, identity rule, or bounding rule requires a new relation version.

## Block-profile modifiers

Status: no numeric modifier approved. Do not implement in Wave 1.

A modifier declares a stable ID and version, compatible strategy versions,
week number, the one target field it may adjust, bounded output, reason code,
and facts. The default block has six weeks. Modifier order is fixed. The engine
rejects uncovered non-commutative combinations.

The owner must approve all six week values for each proposed step-loading,
volume-emphasis, or rep-range-emphasis modifier. No modifier may add or remove a
day or slot, change movement identity or strategy, or encode a scheduled
deload. Manual progression ignores target-changing modifiers. Any table,
ordering, or compatibility change requires a new modifier version.

## `manual@1`

Status: behavioral contract locked; structured-field bounds remain part of the
future persistence review. Do not implement persistence in Wave 1.

Manual means the program or user owns the target. It is suitable for an
unsupported imported rule, bodyweight or external prescriptions whose load
semantics Taurifer cannot execute, and deliberate manual authorship. It
preserves supported structured authored fields and may report comparable prior
performance.

It always returns `kind: "manual"`, `status: "manual"`, an empty prescribed
target, and `manual.authored_target` or `manual.unsupported_import` reason. It
never invents load, reps, RIR, set count, or a ghost suggestion. No history is
required. Invalid structured data is reported without discarding recoverable
backup provenance. Changing this no-invention rule requires a new version.

## Legacy and future persistence policy

Wave 1 does not write a new progression shape. A legacy exercise with no
meaningful `progressionType` receives an in-memory `range@1` projection. An
unknown non-empty legacy type must later execute as manual with an unsupported
import reason while full backup preserves the original value. Historical rows
remain immutable.

Future persistence work must round-trip recognized prescriptions, modifiers,
relations, and provenance through durable state, full backup, program JSON,
verbose and compact setup links, and human-readable export before any new
format can be written. Released setup `v1` and `v2` decoders remain permanent.

## Review checklist

- Confirm every locked `range@1` example matches released Plan 039 and Plan 043
  behavior.
- Approve or amend the closed parameter bounds for `range@1`.
- Settle every numeric question listed for `rep_goal@1`.
- Settle every numeric question listed for `anchor_backoff@1`.
- Choose the first supported `paired_exposure@1` combination and bounds.
- Approve complete six-week tables before naming a modifier executable.
- Confirm manual remains a no-invented-target state.
- Reject any strategy branch keyed by family, program, public name, or
  entitlement.

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

- **Commit 5 (blocked).** The `app.js` evidence adapter calls
  `evaluateProgression` with normalized evidence and renders the pure result
  back into the current UI strings **without changing any displayed value**.
  When Plan 045 (PR #195) reaches `main`, run `git merge origin/main` into this
  branch with an explicit merge commit — never rebase — then land commit 5.
- **New strategies and modifiers.** None executes until its numeric contract is
  owner-approved and captured as executable fixtures. Until then
  `evaluateProgression` returns `incompatible` for it by design.
- **Slice order** (Plan 046): versioned model and round-trips → `rep_goal@1`
  plus `manual@1` persistence → `anchor_backoff@1` → `paired_exposure@1` and
  block modifiers → hardening. Do not merge a slice that writes a progression,
  relation, or modifier shape it cannot also read, back up, export to program
  JSON, encode in verbose and compact setup links, and render in text export.
- **Compatibility.** Released setup `v1` and `v2` decoders remain permanent and
  logged rows stay immutable. A legacy exercise with no meaningful
  `progressionType` gets an in-memory `range@1` projection; an unknown
  non-empty legacy type must execute as `manual@1` with an unsupported-import
  reason while full backup preserves the original value.
- **API stability.** `kind`, `status`, and every reason code are an API
  surface. Add new codes; never repurpose an existing one. Each new strategy
  adds its own `<strategyId>.*` reason namespace.
