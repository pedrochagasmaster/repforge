# Recovery-week experiment contract

- **Policy version:** 2
- **Status:** Approved. Rule B, its two version-allowlisted fixture misses, the
  eligibility checkpoint, and the reassessment contract below are binding.
- **Contract owner:** Plan 049 (this policy); implementers Plans 052/056
- **Governing decisions:** G-55, G-56, G-70; outcomes vocabulary G-24

Recovery is a distinct, versioned schedule policy for week one of the next
normal block. It does not mutate progression-engine arithmetic, the canonical
compiled program, loads, RIR, frequency, or exercise identities. Week two
always renders the canonical prescription, whether reassessment has been
answered or remains `null`. In transition terms it is an overlay linked from
a `recovery_week` record (`docs/block-transition-provenance.md`), never a
successor-program replacement.

This is not the Plan 047 interrupted-treatment re-entry week (a reduced week
after 2–4 disrupted weeks for returning lifters). Recovery here is an
evidence-triggered experiment inside normal training, and the two must never
share a code path or a transition kind.

## Durable carrier and block identity

The mirrored durable aggregate carries recovery at the optional, versioned,
top-level `recoveryTransitions` section defined in
`docs/block-transition-provenance.md`. Its `records` member contains committed
`recovery_week` records and retains valid membership. Two valid records for one
target block remain in `records`; the loader applies neither and quarantines a
conflict bundle. Its `quarantine` member uses this exact v1 shape:

```text
{ schemaVersion: 1,
  digest: lowercase 64-hex SHA-256 string,
  raw: JSON.stringify(bounded parsed own-data value before normalization),
  sourceReplica: "localStorage" | "indexedDB" | "both",
  detectedAt: canonical ISO-8601 timestamp string,
  reason: "known-schema-malformed-recovery" | "duplicate-target-conflict" }
```

The digest is the lowercase 64-hex SHA-256 digest of UTF-8 `raw`. A digest
found in both replicas has one entry with `sourceReplica: "both"`.
Redetection never changes `raw`, `digest`, `reason`, or `detectedAt`, and the
first quarantine write sets `detectedAt`. The presence of an entry is the
persistent warning state. The user can explicitly export or discard
quarantine, and full workout-history deletion also deletes it. The loader
never prunes it automatically.

Committed record membership is append-only. The sole post-commit record
mutation is one reassessment transition from `reassessmentOutcome: null` to a
single closed outcome; it is not a proposal edit and does not change any other
record field.

The carrier classification is closed. An absent section is legacy/canonical.
A supported v1 carrier with valid record, overlay, policy, and quarantine
shapes is used normally. An unknown top-level, record, or overlay schema, or
an unknown required policy version, preserves both replicas untouched and
opens full storage recovery. A supported known version with a malformed but
bounded candidate omits that candidate from normalized records, renders the
canonical prescription, shows a persistent warning, and quarantines its raw
value. A malformed quarantine container, or any over-bound candidate or
aggregate, preserves both replicas untouched and opens full storage recovery.
Duplicate valid targets follow the conflict rule above.

`raw` is the JSON string of the bounded parsed own-data value before
normalization. Apply `TRANSITION_VALUE_LIMITS` to each raw candidate and to
the complete carrier. The limits are depth 32, 10,000 nodes, 128 object keys,
256 array items, and 10,000 characters per string. For a duplicate target,
sort the original records by `proposalHash`, then `transitionId`, and use
`JSON.stringify({ targetBlockId, records })` for the conflict raw bundle. Do
not truncate or prune when a bound would be exceeded.

`programMeta.id` is the program identity. `programMeta.blockId` is a separate
opaque identity for each modern block. A recovery proposal allocates its
target `blockId` in the immutable proposal and persists that ID only in the
atomic block-start confirmation. In every modern recovery proposal and record,
`predecessor.blockId` is required and equals
`diff.recoveryWeek.eligibilityEvidence.sourceBlockId`. It equals the live
`programMeta.blockId` at proposal creation and lock-held confirmation. The
target overlay `blockId` differs from the source. The same atomic revision
changes `programMeta.blockId` to the target. Recovery keeps the program,
creates no successor or archive, and cannot share a confirmation with a
replacement.

The eligibility evidence stores `sourceBlockId`. It equals the block reviewed
for every qualifying outcome and the checkpoint answer, and it differs from
the target `blockId`. It also equals `predecessor.blockId` and the live source
`programMeta.blockId` at both proposal and confirmation. A legacy current
block has no inferred ID and is recovery-ineligible. The first modern block
establishes the identity needed for a later recovery boundary.

### Proposal hash and reassessment CAS

The recovery `proposalHash` is the immutable confirmation commitment to the
null-outcome proposal. Its canonical preimage includes
`reassessmentOutcome: null`, and any edit before confirmation requires a new
proposal and hash. After commit, reassessment reconstructs and validates that
original null-outcome preimage against the stored `proposalHash`, then changes
only `reassessmentOutcome`. It never recomputes or replaces `proposalHash`.
This is the sole post-commit field exception.

The reassessment writer holds the cross-tab state/program lock and checks all
of these preconditions atomically: the expected durable revision is current;
the live `programMeta.blockId` equals the target overlay block; the supplied
`transitionId` and `proposalHash` identify exactly one validated committed
record; that record's outcome is `null`; and the record equals the acknowledged
prior value while its reconstructed null-outcome preimage validates the stored
hash. Success replaces only that record's outcome and increments the
whole-state durable revision once through the localStorage/IndexedDB journal
protocol. It does not mutate the program, block identity, archive, or draft.
A concurrent loser returns `recovery_reassessment_closed` when the outcome is
already closed or `stale` when the revision or acknowledged record no longer
matches; it never overwrites or unions records.

New DraftV2 values carry `program.blockId`, and newly saved workout rows carry
their immutable historical `blockId`. Legacy rows stay absent. A live DraftV2
blocks block-start confirmation; if that draft crosses into week two, its
captured prescription stays unchanged.

During active recovery week one, edits to the prescription fingerprint are
refused. The fingerprint includes current program-row identity, slot/day
identity and order, movement IDs, sets and rep bounds, pattern and loading
metadata, RIR targets, set bounds, priorities, load increments, progression
envelopes and incompatibilities, plus program structure, week prescriptions,
compiler context, progression relations, modifiers, and incompatibilities.
Program identity and block identity are not prescription inputs. Program and
exercise display names, day labels, and authored `notes` remain editable and
are excluded from the fingerprint.

The two local replicas reconcile by whole-state durable revision. Recovery
arrays are never unioned. Two valid records for one target block apply
neither. A bounded known-schema malformed value falls back to canonical
training, raises a persistent warning, and enters quarantine. An unknown
schema, or a carrier that exceeds the existing transition safety bounds,
leaves replicas untouched and enters full storage recovery. The bounds are
depth 32, 10,000 nodes, 128 object keys, 256 array items, and 10,000
characters per string. No value is truncated to fit.

Full backup replacement and the Plan 053 install-transfer clone preserve
program/block identity, recovery records, reassessment, and quarantine.
Program JSON, shared setup, and free-form import exclude those fields and mint
a fresh block on activation. Backup Merge imports workout sessions only and
preserves each incoming row's historical `blockId`; it never imports active
recovery or quarantine.

## Executable policy contract

The fenced object below is the single executable representation of policy
version 2. The recovery checker parses it for allocation, pattern order and
mapping, eligibility, the acceptance band, the version allowlist, and the
reassessment enum. The fixture table below remains an independent expected
output oracle: it proves that the parsed rule produces the reviewed totals.
The surrounding prose is checked against this object so a prose-only or
machine-only edit cannot silently change the contract.

```json
{
  "kind": "taurifer-recovery-policy",
  "policyVersion": 2,
  "status": "Approved",
  "primaryPatterns": ["knee-dominant", "horizontal press", "hip/hinge"],
  "patternMapping": {
    "squat": "knee-dominant",
    "press": "horizontal press",
    "incline_press": "horizontal press",
    "hinge": "hip/hinge"
  },
  "eligibility": {
    "qualifyingOutcomes": ["maintained", "declined"],
    "minimumPatterns": 2,
    "checkpointAnswers": ["Yes", "No", "Not sure"],
    "qualifyingCheckpointAnswer": "Yes"
  },
  "ruleB": {
    "optional": { "effectiveWorkingSets": 0, "reason": "optional-removed" },
    "protected": { "rounding": "ceil", "divisor": 2, "reason": "protected-ceil" },
    "reducible": { "rounding": "floor", "divisor": 2, "reason": "reducible-floor" },
    "coverageRescue": {
      "minimumWorkingSets": 1,
      "selection": "first-eligible-stable-order",
      "reason": "pattern-rescue"
    }
  },
  "acceptanceBand": { "minimum": 0.4, "maximum": 0.6 },
  "allowlistedMisses": {
    "growth_2_v1": { "base": 32, "effective": 12 },
    "growth_3_v1": { "base": 49, "effective": 17 }
  },
  "reassessment": {
    "outcomes": ["Better", "About the same", "Worse"],
    "unset": null,
    "ordinaryReviewOutcomes": ["About the same", "Worse"],
    "sameBlockRepeat": false,
    "weekTwoCanonical": true
  }
}
```

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
  The result is the sole post-commit field mutation: reassessment validates the
  original null-outcome preimage against the unchanged `proposalHash` and
  changes only `reassessmentOutcome` through the atomic CAS above.
  Another recovery can be considered only at a future block boundary from
  fresh evidence and a fresh `Yes` answer.
- **Provenance:** every confirmed recovery writes a `recovery_week`
  transition record in the mirrored `recoveryTransitions.records` carrier
  with the overlay and evidence snapshot. The evidence includes
  `sourceBlockId`, which differs from the target overlay `blockId`. No agent
  may invent load, RIR, frequency, or duration formulas outside this approved
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
   press`, `hip/hinge`, using the first-listed template pattern token only as
   compiler input to this canonical mapping: `squat` maps to
   `knee-dominant`, `press` maps to `horizontal press`, `incline_press` maps
   to `horizontal press`, and `hinge` maps to `hip/hinge`. If steps 1–3 would
   leave a pattern at zero, restore one set to the first eligible slot in
   stable program order (`pattern-rescue`). This is the only exception to
   optional removal, and the preview flags it. The overlay stores the
   canonical primary pattern class, or `null` for a non-primary slot; it does
   not persist the raw template token.
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
- The post-week-one result is local evidence for ordinary Review. If no answer
  is recorded, the persisted value remains `null`; week two is still
  canonical. The result never changes the canonical program and never starts
  another recovery overlay in the same block. At the next block boundary the
  old record is inactive, and a new record needs a new source block and fresh
  evidence.
- A future program version that falls outside 40–60% is ineligible until an
  owner-reviewed, version-specific allowlist entry or a policy change records
  how that version is handled. The current allowlist contains only
  `growth_2_v1` and `growth_3_v1`.

Policy version 2 closes the allocation, rounding, tie, primary-pattern, and
acceptance-band decisions. Plans 052 and 056 may implement `recovery_week`
against this policy. A later policy change requires a new version and a new
owner decision; no implementation may silently reinterpret version 2.
