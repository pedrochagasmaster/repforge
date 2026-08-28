# `effort_target@1` progression contract amendment

**Status:** owner-approved strategy graduation, 2026-08-28  
**Applies to:** Plan 046 progression engine before Plan 047 family/compiler implementation consumes the strategy.  
**Relationship to existing contract:** this document adds `effort_target@1` to the supported strategy set. It does not change `range@1`, `rep_goal@1`, `anchor_backoff@1`, `paired_exposure@1`, `manual@1`, or the block-modifier policy.

## 1. Job

`effort_target@1` expresses a fixed/selected rep target whose next-session load is autoregulated against an authored effort target represented by RIR.

It is intended mainly for suitable heavy-primary/general-strength work where the programming intent is more naturally expressed as:

> perform the authored reps around the authored RIR target; adjust the next load according to whether the observed effort was easier, on target, or harder than intended.

It is not a universal replacement for `range@1` and is not required for hypertrophy work.

## 2. Scientific/product classification

The use of RIR/RPE-style autoregulation for strength programming is **evidence-supported at the method level**. The exact Taurifer transition rules below are an **evidence-informed implementation choice**, not a claim that these exact thresholds or transitions are uniquely validated by exercise science.

RIR estimates are noisy. The strategy therefore uses authored ranges and conservative one-grid-step changes rather than pretending RIR is a precise laboratory measurement.

## 3. Engine boundary

The strategy obeys every Plan 046 invariant:

- deterministic;
- dependency-free;
- canonical kilograms;
- plain-data input/output;
- no DOM, storage, i18n, network, dates, family IDs, program names, provenance, or entitlements;
- immutable inputs;
- typed invalid/incompatible/insufficient-evidence results;
- no silent fallback to `range@1`;
- no adding/removing sets, slots, days, movements, or scheduled deloads;
- caller-owned touched/committed future sets are never overwritten.

Capacity remains shared evidence but is not the primary decision rule for this strategy.

## 4. Required prescription parameters

```json
{
  "strategy": { "id": "effort_target", "version": 1 },
  "workingSets": 2,
  "targetReps": 5,
  "targetRirMin": 2,
  "targetRirMax": 3,
  "minLoadIncrement": 2.5
}
```

Contract:

- `workingSets`: integer 1–20;
- `targetReps`: integer 1–100;
- `targetRirMin`: finite number 0–10;
- `targetRirMax`: finite number from `targetRirMin` through 10;
- `minLoadIncrement`: positive finite kilograms, at most 1,000;
- optional engine-wide loading-grid metadata may provide a more specific valid increment; when absent, use `minLoadIncrement`.

The strategy does not author its own set count, reps, RIR target, or load increment. Those come from the program prescription and exercise loading capability.

## 5. Comparable evidence

Only comparable completed working sets for the same performed movement identity are eligible.

Each eligible set must contain positive finite load and reps. RIR must be finite to count as direct effort evidence. Missing RIR does **not** receive a fabricated effort value for this strategy.

Machine identities remain exact. Evidence from a different machine identity is not comparable merely because the movement pattern or muscles are similar.

## 6. No-history / insufficient-effort behavior

If there is no comparable load history:

- return `kind: "recommendation"`, `status: "new"`;
- target the authored `workingSets`, `targetReps`, and RIR range;
- do not invent an external load;
- target load is `null` unless the caller supplied an explicit current/starting load through an already-approved Plan 046 input path.

If comparable load/repetition evidence exists but there is no finite RIR evidence sufficient to judge effort:

- hold the latest actionable load when one exists;
- target the authored reps/RIR range;
- report an insufficient-effort-evidence reason;
- do not increase or reduce load based on guessed RIR.

This conservative behavior is intentional.

## 7. Next-session decision rule

Use the latest comparable completed session that contains finite RIR evidence at an actionable load.

For that session compute:

- representative load: median eligible working-set load;
- representative reps: median eligible working-set reps;
- representative RIR: median finite working-set RIR.

The authored rep target remains fixed. Determine whether the evidence was easier, on target, or harder than the authored prescription.

### Advance

Advance by **one valid load-grid increment** when:

- representative reps are at least `targetReps`; and
- representative RIR is **greater than `targetRirMax`**.

This means the athlete completed the required work with more reserve than intended.

Reason code: `effort_target.too_easy`.

### Hold

Hold the current valid load when:

- representative reps are at least `targetReps`; and
- representative RIR is inside `[targetRirMin, targetRirMax]`.

Reason code: `effort_target.on_target`.

Also hold when the evidence is mixed or insufficient to justify a change without violating the reduction rule below.

### Reduce

Reduce by **one valid load-grid increment** when either:

- representative reps are below `targetReps`; or
- representative RIR is **below `targetRirMin`**.

Reason code is respectively `effort_target.rep_miss` or `effort_target.too_hard`.

A reduction never goes below one valid increment when an actionable positive load exists.

### No double jumps

`effort_target@1` v1 does not use double jumps, percentage jumps, block-trend acceleration, or capacity-derived extra advancement. One evidence step produces at most one grid increment of change.

This is a deliberate conservative policy because RIR is noisy.

## 8. Rep and RIR target after a load decision

After advance, hold, or reduce:

- preserve the authored `workingSets`;
- preserve `targetReps` exactly;
- preserve the authored `[targetRirMin, targetRirMax]` exactly.

The strategy changes the recommended load, not the authored rep/RIR prescription.

## 9. Current-session behavior

When the current slot contains completed working sets, current evidence takes precedence over prior-session recommendation state.

For the next untouched/uncommitted set:

- if the latest completed set reached `targetReps` with RIR above `targetRirMax`, the engine may recommend one grid increment higher for the next set;
- if the latest completed set missed `targetReps` or reported RIR below `targetRirMin`, the engine may recommend one grid increment lower for the next set;
- otherwise hold the load;
- preserve `targetReps` and the authored RIR range;
- never rewrite touched/committed future sets.

Reason codes:

- `effort_target.current_advance`;
- `effort_target.current_hold`;
- `effort_target.current_reduce`.

This current-set behavior is intentionally simple and does not attempt to infer a hidden fatigue model.

## 10. Re-entry, session freshness, block modifiers, and relations

`effort_target@1` does not add its own re-entry arithmetic. Plan 047 re-entry changes program set volume structurally and does not alter the strategy's RIR target.

Session-freshness logic, if applied by the shared engine, may only temper a recommendation under the same conservative Plan 046 rules. Positive freshness evidence must not make `effort_target@1` more aggressive.

Target-changing block modifiers remain unapproved.

`paired_exposure@1` may be attached only if the existing Plan 046 relation contract explicitly declares `effort_target@1` compatible. Graduation of `effort_target@1` by itself does **not** expand the approved relation-pair matrix. Until a relation fixture explicitly locks such a pair, treat the combination as incompatible.

## 11. Result shape and facts

Use the standard Plan 046 discriminated result shape.

When applicable, `facts` should expose stable machine-readable values including:

- representative load;
- representative reps;
- representative RIR;
- authored target reps;
- authored RIR min/max;
- raw recommended load movement;
- rounded/snapped target load;
- evidence set/session counts.

No rendered prose belongs in the engine.

## 12. Reason codes

Required v1 reason codes:

- `effort_target.no_history`;
- `effort_target.no_rir_evidence`;
- `effort_target.too_easy`;
- `effort_target.on_target`;
- `effort_target.rep_miss`;
- `effort_target.too_hard`;
- `effort_target.grid_rounded`;
- `effort_target.current_advance`;
- `effort_target.current_hold`;
- `effort_target.current_reduce`.

Any future semantic change to these transition rules, required evidence, or reason-code meaning requires `effort_target@2` or an engine-version change where the existing versioning contract allows it.

## 13. Required fixture examples

Before Plan 047 may reference the strategy, add locked executable examples for at least:

1. no history → new, load `null`, authored reps/RIR;
2. target reps achieved above RIR ceiling → one-increment advance;
3. target reps achieved inside RIR range → hold;
4. target reps achieved below RIR floor → one-increment reduce;
5. rep target missed regardless of reported easy RIR → reduce;
6. missing RIR with actionable previous load → conservative hold/no-RIR-evidence;
7. off-grid load → valid grid snap without history mutation;
8. different machine identity → excluded evidence;
9. current-set too easy → next untouched set may advance one increment;
10. current-set on target → hold;
11. current-set too hard/rep miss → reduce one increment;
12. touched/committed future set → never overwritten;
13. unknown/invalid parameters → typed invalid;
14. bodyweight-only/no actionable load semantics → typed incompatible unless the exercise explicitly supplies a valid load mechanism;
15. unsupported paired relation → typed incompatible, not silent relation expansion.

## 14. Plan 047 authoring guidance

`effort_target@1` is most appropriate for deliberately authored heavy-primary/general-strength slots where fixed reps and effort-regulated load express the program intent better than rep-range progression.

It should be considered alongside `range@1` and `anchor_backoff@1`, not automatically chosen because a family is `strength`.

The strategy remains selective. `range@1` is still Taurifer's global default.

## 15. Explicit non-goals

`effort_target@1` v1 does not implement:

- APRE/DAPRE;
- velocity-based training;
- percentage-of-1RM waves;
- daily readiness scoring;
- automatic set-count changes;
- automatic exercise changes;
- target-changing block profiles;
- scheduled deloads;
- family-specific formulas;
- history-aware structural interventions;
- claims that exact RIR thresholds are physiological truths.
