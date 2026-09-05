# Recovery-week experiment contract

- **Policy version:** 2
- **Status:** Approved. Rule B, its two version-allowlisted fixture misses, the
  eligibility checkpoint, and the reassessment contract below are binding.
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

- **Eligibility requires both:** sufficient observed `maintained` or `declined`
  evidence under the G-24 outcome model across at least two of the three
  canonical primary patterns (`knee-dominant`, `horizontal press`, and
  `hip/hinge`), and a checkpoint answer to **“During this block, did recovery
  feel worse than usual often enough to affect your training?”** The closed
  answers are `Yes`, `No`, and `Not sure`; only `Yes` qualifies. The answer and
  evidence stay local, with no free-text response or diagnosis. Untested,
  insufficient, `improved`, or `No`/`Not sure` evidence never qualifies.
- **Preview before action:** the proposal shows base versus effective working
  sets per exercise plus the evidence and provenance that enabled it. The user
  explicitly confirms.
- **Volume-only:** optional work is removed first; ordinary `minSets` may be
  crossed under this separately named policy; at least one working set remains
  for each primary movement pattern; the target direction is approximately
  half the normal working-set volume.
- **Reassessment:** after week one, record one closed result: `Better`, `About
  the same`, or `Worse`. Week two always renders the canonical prescription.
  The policy never extends or repeats recovery in the same block. `About the
  same` and `Worse` route to ordinary Review with no automatic mutation.
  Another recovery can be considered only at a future block boundary from
  fresh evidence and a fresh `Yes` answer.
- **Provenance:** every confirmed recovery writes a `recovery_week`
  transition record with the overlay and evidence snapshot. No agent may
  invent load, RIR, frequency, or duration formulas outside this approved
  contract.

## Approved Rule B

Rule B differentiates by the Plan 047 slot statuses, matching the compiler's
constraint-reduction order (optional first, then reducible assistance, with
protected primary work preserved):

1. Remove every `optional`-status slot entirely (0 working sets).
2. `protected` slots keep `ceil(baseWorkingSets / 2)`.
3. `reducible` slots keep `floor(baseWorkingSets / 2)` (a base-1 reducible
   slot is removed; only primary patterns carry a minimum).
4. Check coverage in the fixed pattern order `knee-dominant`, `horizontal
   press`, `hip/hinge`, using the first-listed template pattern token:
   `squat` maps to `knee-dominant`, `press` and `incline_press` map to
   `horizontal press`, and `hinge` maps to `hip/hinge`. If steps 1–3 would
   leave a pattern at zero, restore one set to the first eligible slot in
   stable program order (`pattern-rescue`). This is the only exception to
   optional removal, and the preview flags it.
5. Loads, RIR targets, strategies, exercises, frequency, schedule, and rest
   remain byte-identical to the canonical prescription.

`reason` values are rule mechanics: `optional-removed`, `protected-ceil`,
`reducible-floor`, `pattern-rescue`.

### Accepted fixture evidence (20 Plan 047 review compilations)

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

18 of 20 land in band. The two misses sit below it, and no fixture exceeds
60%. No primary pattern is left empty. The two misses are the approved,
version-specific exceptions:

| Blueprint version | Base | Effective | Ratio | Disposition |
|---|---:|---:|---:|---|
| `growth_2_v1` | 32 | 12 | 37.5% | Allowlisted exception |
| `growth_3_v1` | 49 | 17 | 34.7% | Allowlisted exception |

The checker rejects every other miss. It also rejects an unreviewed program
version outside the 40–60% band. Runtime code must not clamp percentages or
change Rule B to force a version into the band.

## Invariant table (acceptance for the owner review)

| # | Invariant |
|---|---|
| I-1 | Effective week-one working sets fall within 40–60% of the canonical total on representative programs with at least 20 base working sets (known misses: growth_2_v1, growth_3_v1) |
| I-2 | No `optional`-status slot retains working sets, except the step-4 coverage rescue, which is flagged in the preview |
| I-3 | Every retained slot keeps at least one working set, except removed base-1 reducible slots, which carry no minimum |
| I-4 | Each canonical primary pattern retains at least one week-one working set |
| I-5 | Loads, RIR, exercises, frequency, schedule, and rest are identical to canonical |
| I-6 | Week two renders the canonical prescription with no carryover reduction |
| I-7 | The proposal cites sufficient `maintained`/`declined` evidence across at least two canonical primary patterns plus a local checkpoint `Yes` answer; untested, insufficient, `improved`, `No`, and `Not sure` evidence cannot produce a proposal |

## Eligibility and reassessment details

- The evidence snapshot names the qualifying patterns and the maintained or
  declined observations that support each one. Fewer than two qualifying
  patterns is ineligible.
- The checkpoint stores only the closed answer enum. It does not store free
  text, a diagnosis, or a clinical interpretation.
- The post-week-one result is local evidence for ordinary Review. It never
  changes the canonical program and never starts another recovery overlay in
  the same block.
- A future program version that falls outside 40–60% is ineligible until an
  owner-reviewed, version-specific allowlist entry or a policy change records
  how that version is handled. The current allowlist contains only
  `growth_2_v1` and `growth_3_v1`.

Policy version 2 closes the allocation, rounding, tie, primary-pattern, and
acceptance-band decisions. Plans 052 and 056 may implement `recovery_week`
against this policy. A later policy change requires a new version and a new
owner decision; no implementation may silently reinterpret version 2.
