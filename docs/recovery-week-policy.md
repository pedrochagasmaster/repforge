# Recovery-week experiment contract

- **Policy version:** 1 (candidate constants; see the gate below)
- **Status:** ⛔ BLOCKED — the decided bounds below are binding, but the exact
  rounding, allocation, tiebreak, and primary-pattern constants await owner
  selection. Plans 052/056 must not implement recovery until the selection is
  recorded here. All other Phase 2 work continues.
- **Contract owner:** Plan 049 (this policy); implementers Plans 052/056
- **Governing decisions:** G-55, G-56, G-70; outcomes vocabulary G-24

Recovery is a distinct, versioned schedule policy for week one of the next
normal block. It does not mutate progression-engine arithmetic, the canonical
compiled program, loads, RIR, frequency, or exercise identities. Week two
automatically renders the canonical prescription.

This is not the Plan 047 interrupted-treatment re-entry week (a reduced week
after 2–4 disrupted weeks for returning lifters). Recovery here is an
evidence-triggered experiment inside normal training, and the two must never
share a code path or a transition kind.

## Decided bounds (binding)

- **Eligibility requires both:** observed `maintained` or `declined` evidence
  under the G-24 outcome model, and corroborating recovery/readiness input
  captured in the block checkpoint. Untested or insufficient evidence never
  qualifies.
- **Preview before action:** the proposal shows base versus effective working
  sets per exercise plus the evidence and provenance that enabled it. The user
  explicitly confirms.
- **Volume-only:** optional work is removed first; ordinary `minSets` may be
  crossed under this separately named policy; at least one working set remains
  for each primary movement pattern; the target direction is approximately
  half the normal working-set volume.
- **Reassessment:** performance is reassessed after the recovery week. No
  automatic repeat is allowed.
- **Provenance:** every confirmed recovery writes a `recovery-week` transition
  record under `docs/block-transition-provenance.md` with the evidence
  snapshot and the policy version. No agent may invent load, RIR, frequency,
  or duration formulas to fill the open constants.

## Candidate Rule A (proposed for owner selection, not decided)

Grounded in the Plan 047 slot vocabulary (`optional` / `reducible` /
`protected` statuses), its constraint-reduction order (optional first, then
reducible assistance, protected primary preserved), and its three canonical
primary patterns (knee-dominant, horizontal press, hip/hinge):

1. Remove every `optional`-status slot entirely (0 working sets).
2. Remaining slots keep `ceil(baseWorkingSets / 2)` working sets.
3. Every retained slot keeps at least one working set (follows from step 2
   for any positive base; stated as an invariant so no future rounding change
   can violate it silently).
4. Primary-pattern coverage check: if steps 1–2 would leave a canonical
   primary pattern with zero week-one working sets, retain the first such
   slot in stable program order at one set instead of removing it.
5. Loads, RIR targets, strategies, exercises, frequency, schedule, and rest
   are byte-identical to the canonical prescription.

### Worked example (illustrative three-day week, not a compiled family)

| Day | Exercise (status, pattern) | Base sets | Effective sets |
|---|---|---|---|
| 1 | Squat (protected, knee) | 4 | 2 |
| 1 | Bench press (protected, horizontal press) | 4 | 2 |
| 1 | Barbell row (reducible, pull) | 3 | 2 |
| 1 | Romanian deadlift (reducible, hinge) | 3 | 2 |
| 1 | Dumbbell curl (optional, —) | 2 | 0 |
| 1 | Lateral raise (optional, —) | 2 | 0 |
| 2 | Deadlift (protected, hinge) | 3 | 2 |
| 2 | Overhead press (reducible, vertical press) | 3 | 2 |
| 2 | Pull-up (reducible, pull) | 3 | 2 |
| 2 | Lunge (reducible, knee) | 2 | 1 |
| 2 | Standing calf raise (optional, —) | 2 | 0 |
| 3 | Bench press (protected, horizontal press) | 3 | 2 |
| 3 | Front squat (reducible, knee) | 3 | 2 |
| 3 | Cable row (reducible, pull) | 2 | 1 |
| 3 | Triceps pushdown (optional, —) | 2 | 0 |
| **Total** | | **41** | **20 (48.8%)** |

Knee retains 5, horizontal press 4, hinge 4. No retained slot is empty;
optionals are gone first; nothing but set counts changed.

## Invariant table (acceptance for the owner review)

| # | Invariant |
|---|---|
| I-1 | Effective week-one working sets fall within 40–60% of the canonical total on representative programs with at least 20 base working sets |
| I-2 | No `optional`-status slot retains working sets, except the step-4 coverage rescue, which is flagged in the preview |
| I-3 | Every retained slot keeps at least one working set |
| I-4 | Each canonical primary pattern retains at least one week-one working set |
| I-5 | Loads, RIR, exercises, frequency, schedule, and rest are identical to canonical |
| I-6 | Week two renders the canonical prescription with no carryover reduction |
| I-7 | The proposal cites `maintained`/`declined` evidence plus checkpoint recovery input; untested or insufficient evidence cannot produce a proposal |

## ⛔ Open constants (owner gate)

1. Rounding: `ceil(base/2)` (Candidate A) versus `floor(base/2)` with the
   primary-minimum rescue doing real work.
2. Optional-work ordering ties beyond slot status (candidate: stable program
   order, earliest first).
3. Primary-pattern definition (candidate: the three canonical Plan 047
   patterns above).
4. Whether the I-1 acceptance band (40–60%) is the right reading of
   "approximately half".

Record the selection with a policy version bump. Until then, `recovery-week`
transition records must not be written, and Plans 052/056 stop at this gate
without blocking unrelated DraftV2, provenance, or transfer work.
