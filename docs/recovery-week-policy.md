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
automatically renders the canonical prescription. In transition terms it is an
overlay linked from a `recovery_week` record (`docs/block-transition-provenance.md`),
never a successor-program replacement.

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
- **Provenance:** every confirmed recovery writes a `recovery_week`
  transition record with the overlay and evidence snapshot. No agent may
  invent load, RIR, frequency, or duration formulas to fill the open
  constants.

## Candidate Rule B (proposed for owner selection, not decided)

Candidate Rule A (`ceil` everywhere) failed representative evidence: 12 of 20
fixtures landed above 60% (e.g. growth_4_v1 60→38, balanced_3_v1 43→28,
home_5_v1 31→20). Rule B differentiates by the Plan 047 slot statuses,
matching the compiler's own constraint-reduction order (optional first, then
reducible assistance, protected primary preserved):

1. Remove every `optional`-status slot entirely (0 working sets).
2. `protected` slots keep `ceil(baseWorkingSets / 2)`.
3. `reducible` slots keep `floor(baseWorkingSets / 2)` (a base-1 reducible
   slot is removed; only primary patterns carry a minimum).
4. Primary-pattern coverage check, by first-listed template pattern token:
   `squat` → knee-dominant, `hinge` → hip/hinge, `press`/`incline_press` →
   horizontal press. If steps 1–3 would leave a pattern with zero week-one
   working sets, retain the first such slot in stable program order at one
   set instead (`pattern-rescue`, flagged in the preview).
5. Loads, RIR targets, strategies, exercises, frequency, schedule, and rest
   are byte-identical to the canonical prescription.

`reason` values are rule mechanics: `optional-removed`, `protected-ceil`,
`reducible-floor`, `pattern-rescue`.

### Fixture evidence (20 Plan 047 review compilations)

Method: `test/fixtures/program-families-v1.json` `reviewCompilations`
(base working sets per compiled slot) with template statuses and first-listed
patterns from `slotContracts`. Recompute with
`node tools/check-recovery-invariants.mjs --check`. All compiled slots carry
2–3 sets, so rounding dominates and the pattern rescue never triggers on
these fixtures (recorded as an untested-on-fixtures path with a synthetic
unit case in the checker).

| Blueprint | Base | Effective | Ratio | In 40–60% |
|---|---|---|---|---|
| growth_2_v1 | 32 | 12 | 37.5% | Miss (low) |
| growth_3_v1 | 49 | 17 | 34.7% | Miss (low) |
| growth_4_v1 | 60 | 26 | 43.3% | Yes |
| growth_5_v1 | 74 | 30 | 40.5% | Yes |
| growth_6_v1 | 46 | 23 | 50.0% | Yes |
| balanced_2_v1 | 29 | 13 | 44.8% | Yes |
| balanced_3_v1 | 43 | 20 | 46.5% | Yes |
| balanced_4_v1 | 45 | 22 | 48.9% | Yes |
| balanced_5_v1 | 60 | 28 | 46.7% | Yes |
| balanced_6_v1 | 50 | 27 | 54.0% | Yes |
| strength_2_v1 | 28 | 13 | 46.4% | Yes |
| strength_3_v1 | 42 | 18 | 42.9% | Yes |
| strength_4_v1 | 45 | 21 | 46.7% | Yes |
| strength_5_v1 | 61 | 26 | 42.6% | Yes |
| strength_6_v1 | 53 | 27 | 50.9% | Yes |
| home_2_v1 | 27 | 15 | 55.6% | Yes |
| home_3_v1 | 34 | 20 | 58.8% | Yes |
| home_4_v1 | 39 | 20 | 51.3% | Yes |
| home_5_v1 | 31 | 16 | 51.6% | Yes |
| home_6_v1 | 32 | 16 | 50.0% | Yes |

18 of 20 land in band. The two misses sit just below it; no fixture exceeds
60% and no primary pattern is left empty. The gate stays open: the owner may
accept Rule B with the two named misses, adjust the band, or select another
rule — but Plans 052/056 implement nothing until that selection is recorded
with a policy version bump.

## Invariant table (acceptance for the owner review)

| # | Invariant |
|---|---|
| I-1 | Effective week-one working sets fall within 40–60% of the canonical total on representative programs with at least 20 base working sets (known misses: growth_2_v1, growth_3_v1) |
| I-2 | No `optional`-status slot retains working sets, except the step-4 coverage rescue, which is flagged in the preview |
| I-3 | Every retained slot keeps at least one working set, except removed base-1 reducible slots, which carry no minimum |
| I-4 | Each canonical primary pattern retains at least one week-one working set |
| I-5 | Loads, RIR, exercises, frequency, schedule, and rest are identical to canonical |
| I-6 | Week two renders the canonical prescription with no carryover reduction |
| I-7 | The proposal cites `maintained`/`declined` evidence plus checkpoint recovery input; untested or insufficient evidence cannot produce a proposal |

## ⛔ Open constants (owner gate)

1. Allocation rule: Candidate Rule B above versus another deterministic rule.
2. Acceptance band: whether 40–60% with the two named misses is the right
   reading of "approximately half".
3. Optional-work ordering ties beyond slot status (candidate: stable program
   order, earliest first).
4. Primary-pattern definition (candidate: first-listed template pattern
   mapping above).

Record the selection with a policy version bump. Until then, `recovery_week`
overlays must not be written, and Plans 052/056 stop at this gate without
blocking unrelated DraftV2, provenance, or transfer work.
