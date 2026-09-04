# Block-transition provenance contract

- **Schema version:** 1
- **Contract owner:** Plan 049 (this schema); implemented by Plan 052;
  rendering consumer Plan 056
- **Specified by:** Plan 049; later changes require a versioned Phase 0
  amendment, never ad hoc renderer fields
- **Companion contracts:** [`docs/program-entry-flow.md`](program-entry-flow.md)
  (activation boundary), `docs/recovery-week-policy.md` (recovery-week
  overlay allocation; owner-gated), [ADR 0012](adr/0012-ui-overhaul-canonical-reconciliation.md)
  (workout-truth and ownership rules)

Every structural program change writes one immutable transition record
atomically with the outgoing archive and — except for the recovery overlay,
which changes no program — the successor activation. Preview and commit carry
the same immutable proposal hash; a stale proposal is rejected and
regenerated, never silently rebased.

## Closed transition kinds

`same_family_sibling`, `lower_frequency_sibling`, `shorter_session_sibling`,
`guided_manual_repair`, `reduce_training_volume`, `recovery_week`, plus
already approved no-structure actions such as `repeat`/`continue`. UI action
words (`progress`, `repeat`, `review`) are presentation; observed outcomes
(`improved`, `maintained`, `declined`) are evidence. `insufficient` is not an
outcome and cannot satisfy eligibility.

Proposal status is `preview`, `stale`, `confirmed`, `committed`, or
`failed-before-commit`. There is no partly committed successor; duplicate
confirmation is idempotent on transition ID plus proposal hash.

## Transition record v1

Unknown required versions stop the commit; historical programs without these
fields stay valid and read as `legacy/no transition record`.

| Field | Type | Meaning |
|---|---|---|
| `schemaVersion` | `1` | This contract's version |
| `transitionId` | string, unique | Stable identity; makes commit idempotent with `proposalHash` |
| `kind` | enum | Closed vocabulary above |
| `status` | enum | `preview`, `stale`, `confirmed`, `committed`, or `failed-before-commit` |
| `createdAt` | timestamp | Proposal creation time |
| `confirmedAt` | timestamp | Explicit user-confirmation time |
| `predecessor.programId` | string | Outgoing program identity |
| `predecessor.fingerprint` | string | Stable fingerprint of the outgoing program |
| `predecessor.durableRevision` | integer | Durable revision the proposal was built against |
| `predecessor.source` | string | Source route (Recommend, Custom, Browse, Build, Import, Shared) |
| `predecessor.compilerProvenance` | object | Family, blueprint, compiler, rules, and catalogue versions |
| `diagnosis.kind` | enum | `fewer_days` or `sessions_too_long` (plus volume/recovery diagnoses owned with their kinds) |
| `diagnosis.answers` | object | The user's diagnosis answers |
| `diagnosis.eligibleEvidenceIds` | string[] | Evidence snapshot references used for eligibility |
| `diagnosis.insufficientEvidenceReasons` | string[] | Present and non-empty whenever eligibility fails |
| `derivation.mode` | string | How the successor was derived (recompilation, manual repair, reduction, overlay) |
| `derivation.request` | string | The confirmed request (e.g. `lower-frequency-sibling`) |
| `derivation.compilerContextVersions` | object | Versioned compiler context carried forward |
| `derivation.policyVersions` | object | Reduction/recovery policy versions consumed |
| `successor.programId` | string | Incoming program identity (fresh local id); absent for `recovery_week` overlays, which change no program |
| `successor.fingerprint` | string | Stable fingerprint of the incoming program; absent for overlays |
| `successor.source` | string | Source provenance of the incoming program |
| `successor.compilerProvenance` | object | Compiler provenance of the incoming program |
| `diff.days` | array | Entries of `{identity, before, after, reason}` |
| `diff.exercises` | array | Entries of `{identity, before, after, reason}`; identity is the stable library/custom ID, never a display name |
| `diff.prescriptions` | array | Entries of `{identity, before, after, reason}` |
| `diff.recoveryWeek` | object, optional | Present only for `recovery_week`: the overlay below |
| `progressionContract.preservedRelations` | string[] | Relations and strategies carried over unchanged |
| `progressionContract.resetRelations` | string[] | Explicitly reset relations with reasons |
| `progressionContract.incompatibilities` | string[] | Declared incompatibilities; never silent |
| `archiveId` | string | Outgoing archive entry carrying the transition-out link |
| `proposalHash` | string | Immutable hash of the proposal; preview and commit must match |

Store transition-in on successor metadata and the transition-out link in the
outgoing archive entry. History and log rows stay immutable and keep pointing
at their original program/session identities. Backup round-trips both records.

### Example record: `lower_frequency_sibling` (shape-exact)

```json
{
  "schemaVersion": 1,
  "transitionId": "tr_01J9Z8X7C6V5B4N3M2",
  "kind": "lower_frequency_sibling",
  "status": "committed",
  "createdAt": "2026-10-01T09:00:00.000Z",
  "confirmedAt": "2026-10-01T09:12:00.000Z",
  "predecessor": {
    "programId": "prog_local_a1",
    "fingerprint": "fp9f2c41",
    "durableRevision": 18,
    "source": "Recommend",
    "compilerProvenance": { "familyVersion": "growth-v3", "blueprintVersion": "growth-4d-v1", "compilerVersion": "2.4.0", "rulesVersion": "rules-v7", "catalogueVersion": "catalogue-v12" }
  },
  "diagnosis": {
    "kind": "fewer_days",
    "answers": { "availableDays": 3 },
    "eligibleEvidenceIds": ["sessions-14d-3-of-6"],
    "insufficientEvidenceReasons": []
  },
  "derivation": {
    "mode": "recompilation",
    "request": "lower-frequency-sibling",
    "compilerContextVersions": { "compilerVersion": "2.4.0", "rulesVersion": "rules-v7", "catalogueVersion": "catalogue-v12" },
    "policyVersions": {}
  },
  "successor": {
    "programId": "prog_local_b7",
    "fingerprint": "fp51ad0e",
    "source": "Recommend",
    "compilerProvenance": { "familyVersion": "growth-v3", "blueprintVersion": "growth-3d-v1", "compilerVersion": "2.4.0", "rulesVersion": "rules-v7", "catalogueVersion": "catalogue-v12" }
  },
  "diff": {
    "days": [
      { "identity": "growth_d4", "before": { "label": "Day 4", "slots": 6 }, "after": null, "reason": "fewer_days: day not reconstructable in 3-day sibling" }
    ],
    "exercises": [
      { "identity": "lib:seated_cable_row", "before": { "day": "growth_d2", "sets": 3 }, "after": { "day": "growth_d2", "sets": 3 }, "reason": "retained with identical prescription" },
      { "identity": "lib:leg_press", "before": { "day": "growth_d4", "sets": 4 }, "after": null, "reason": "day removed; coverage preserved by growth_d1 squat" }
    ],
    "prescriptions": [
      { "identity": "lib:back_squat", "before": { "sets": 4 }, "after": { "sets": 4 }, "reason": "protected primary unchanged" }
    ]
  },
  "progressionContract": {
    "preservedRelations": ["range@1 anchors", "rep_goal@1 volume pairing"],
    "resetRelations": [],
    "incompatibilities": []
  },
  "archiveId": "arc_01J9Z8X7C6V5B4N3M1",
  "proposalHash": "ph_9f2c4151ad0e77c3"
}
```

## Recovery-week overlay (not a successor replacement)

Recovery changes no program: there is no successor activation, only an
overlay linked from `diff.recoveryWeek` that Week two ignores. Allocation
follows `docs/recovery-week-policy.md`; until the owner selects the rule,
`proposeRecoveryWeek` stays disabled and no overlay is written.

| Field | Type | Meaning |
|---|---|---|
| `schemaVersion` | `1` | Overlay schema version |
| `policyVersion` | integer | Approved recovery-policy version consumed |
| `transitionId` | string | Parent transition record (`kind: recovery_week`) |
| `blockId` | string | Target block identity |
| `activePeriod` | `nextBlockWeek1` | Only valid period |
| `eligibilityEvidence` | object | `maintained`/`declined` evidence plus checkpoint recovery input |
| `baseProgramFingerprint` | string | Canonical program the overlay renders against |
| `entries` | array | Per-exercise `{exerciseId, movementPattern, baseWorkingSets, effectiveWorkingSets, removedOptionalFirst, reason}` |
| `createdAt` | timestamp | Proposal creation time |
| `confirmedAt` | timestamp | Explicit user-confirmation time |
| `reassessmentDueAt` | timestamp | Reassessment point after week one; no automatic repeat |

### Example overlay entry set (shape-exact)

```json
{
  "schemaVersion": 1,
  "policyVersion": 1,
  "transitionId": "tr_01J9Z8X7C6V5B4N3M9",
  "blockId": "block_local_k2",
  "activePeriod": "nextBlockWeek1",
  "eligibilityEvidence": { "outcome": "maintained", "checkpointRecoveryInput": "high-life-stress" },
  "baseProgramFingerprint": "fp9f2c41",
  "entries": [
    { "exerciseId": "lib:back_squat", "movementPattern": "knee-dominant", "baseWorkingSets": 4, "effectiveWorkingSets": 2, "removedOptionalFirst": false, "reason": "protected-ceil" },
    { "exerciseId": "lib:dumbbell_curl", "movementPattern": "elbow-flexion", "baseWorkingSets": 2, "effectiveWorkingSets": 0, "removedOptionalFirst": true, "reason": "optional-removed" }
  ],
  "createdAt": "2026-10-01T09:00:00.000Z",
  "confirmedAt": "2026-10-01T09:12:00.000Z",
  "reassessmentDueAt": "2026-10-08T09:00:00.000Z"
}
```

`reason` values are rule mechanics (`optional-removed`, `protected-ceil`,
`reducible-floor`, `pattern-rescue`); the allocation rule that produces them
is the open owner gate in the recovery policy.

## Proposal lifecycle

1. A proposal is drafted from a fixed predecessor revision and hashed. Any
   edit produces a new proposal with a new hash.
2. Preview renders the proposal and its hash: the exact diff entries, the
   evidence, and the provenance.
3. Confirmation commits only if the live predecessor revision still equals
   the proposal's revision and the hashes match. Otherwise the proposal is
   `stale`: rejected and regenerated after explicit user review, never
   silently rebased.
4. The commit writes the transition record, the outgoing archive, and (except
   overlays) the successor activation through the existing compare-and-swap
   and program-draft transaction boundary (`commitProgramReplacement()` with
   the `_storageDraftTransaction` protocol). Boot observes all or nothing.

## Kind-specific rules

- `same_family_sibling`, `lower_frequency_sibling`, `shorter_session_sibling`:
  the compiler returns the full successor with provenance; the resolver never
  edits days or sets after compilation to force a fit. Unreconstructable
  requests return unavailable, never a silently recompiled program.
- `guided_manual_repair`: an exact copy of the current program plus a
  diagnostic instruction (`fewer_days` or `sessions_too_long`). No archive or
  replacement occurs until the user makes explicit changes and activates
  through the existing candidate-draft/commit boundary.
- `reduce_training_volume`: optional work goes before protected work is
  touched; ordinary minimum/protected constraints are never crossed; every
  change is a per-exercise set diff entry; the blanket ±1-set shortcut is
  prohibited.
- `recovery_week`: the overlay above. Eligibility, preview, confirmation,
  week-two restoration, and reassessment follow the recovery policy.

## Failure tabletop

| Scenario | Required behavior |
|---|---|
| Preview open while another tab replaces the program | Commit rejects the stale proposal hash; status becomes `stale`; user reviews a regenerated proposal |
| Crash between archive write and successor activation | Boot completes the atomic transaction or restores the pre-commit state; partial visibility is prohibited |
| Unknown `schemaVersion` on read | Fail closed; existing program and history untouched |
| `kind` is `recovery_week` without an approved allocation rule | Refuse the proposal; record the gate, do not invent constants |
| Confirmation hash differs from preview hash | Reject; preview and commit must be the same immutable proposal |
| Duplicate confirmation | Idempotent on transition ID plus proposal hash; exactly one archive entry |
| Corrupt or unknown recovery overlay | Render the canonical prescription with an explicit recoverable warning; retain raw evidence |
