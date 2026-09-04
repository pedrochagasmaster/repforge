# Block-transition provenance contract

- **Schema version:** 1
- **Contract owner:** Plan 052 (derivation and storage); rendering consumer Plan 056
- **Specified by:** Plan 049 (this document); later changes require a versioned
  Phase 0 amendment, never ad hoc renderer fields
- **Companion contracts:** [`docs/program-entry-flow.md`](program-entry-flow.md)
  (activation boundary), `docs/recovery-week-policy.md` (recovery-week kind;
  owner-gated), [ADR 0012](adr/0012-ui-overhaul-canonical-reconciliation.md)
  (workout-truth and ownership rules)

Every program replacement — compiler-derived, guided manual repair, permanent
volume reduction, or recovery week — writes one immutable transition record
atomically with the outgoing archive and the successor activation. Preview and
commit carry the same immutable proposal hash; a stale proposal is rejected
and regenerated, never silently rebased.

## Transition record v1

Required fields. Unknown required fields stop the commit; unknown optional
fields are ignored only if this schema explicitly permits round-tripping them.

| Field | Type | Meaning |
|---|---|---|
| `transitionId` | string, unique | Stable identity for this transition |
| `schemaVersion` | `1` | This contract's version |
| `kind` | enum | `compiler-derived`, `guided-manual-repair`, `permanent-volume-reduction`, or `recovery-week` |
| `createdAt` | timestamp | Proposal creation time |
| `confirmedAt` | timestamp | Explicit user-confirmation time |
| `predecessor.programId` | string | Outgoing program identity |
| `predecessor.fingerprint` | string | Stable fingerprint of the outgoing program |
| `predecessor.revision` | integer | Durable revision the proposal was built against |
| `predecessor.provenance` | object | Source provenance: route, compiler/family versions, or import identity |
| `diagnosis.constraint` | string | Diagnosed constraint that motivated the transition |
| `diagnosis.evidence` | object | Evidence snapshot used for eligibility (never untested or insufficient evidence for recovery) |
| `compiler` | object, optional | Present when `kind` is `compiler-derived`: request, context, family, blueprint, compiler, rules, and catalogue versions |
| `successor.programId` | string | Incoming program identity (fresh local id) |
| `successor.fingerprint` | string | Stable fingerprint of the incoming program |
| `successor.provenance` | object | Source provenance of the incoming program |
| `diff` | object | Exact stable-identity diff for days, exercises, order, sets, and prescriptions |
| `progression.relation` | string | How the successor relates to the predecessor's progression state |
| `progression.strategyPreservation` | string | Strategy-contract preservation decisions; never an implicit target mutation |
| `archive.outgoingArchiveId` | string | Linked outgoing archive record |
| `archive.recoveryPolicy` | string | Recovery policy for the archived program |
| `proposalHash` | string | Immutable hash of the proposal; preview and commit must match |

### Example record (illustrative values, schema-exact shape)

```json
{
  "transitionId": "tr_01J9Z8X7C6V5B4N3M2",
  "schemaVersion": 1,
  "kind": "compiler-derived",
  "createdAt": "2026-10-01T09:00:00.000Z",
  "confirmedAt": "2026-10-01T09:12:00.000Z",
  "predecessor": {
    "programId": "prog_local_a1",
    "fingerprint": "fp9f2c41",
    "revision": 18,
    "provenance": { "route": "Recommend", "familyVersion": "growth-v3", "compilerVersion": "2.4.0" }
  },
  "diagnosis": {
    "constraint": "fewer-available-days",
    "evidence": { "sessionsLast14Days": 3, "plannedLast14Days": 6 }
  },
  "compiler": {
    "request": "lower-frequency-sibling",
    "context": { "daysPerWeek": 3 },
    "familyVersion": "growth-v3",
    "blueprintVersion": "growth-3d-v1",
    "compilerVersion": "2.4.0",
    "rulesVersion": "rules-v7",
    "catalogueVersion": "catalogue-v12"
  },
  "successor": {
    "programId": "prog_local_b7",
    "fingerprint": "fp51ad0e",
    "provenance": { "route": "Recommend", "familyVersion": "growth-v3", "compilerVersion": "2.4.0" }
  },
  "diff": {
    "days": { "removed": ["day_4"], "added": [], "renamed": [] },
    "exercises": { "removed": 4, "added": 0, "substituted": 1 },
    "orderChanged": false,
    "sets": { "removed": 12, "added": 0 },
    "prescriptionsChanged": 3
  },
  "progression": {
    "relation": "continues",
    "strategyPreservation": "strategies and anchors preserved; no implicit target mutation"
  },
  "archive": {
    "outgoingArchiveId": "arc_01J9Z8X7C6V5B4N3M1",
    "recoveryPolicy": "retain-until-user-deletes"
  },
  "proposalHash": "ph_9f2c4151ad0e77c3"
}
```

## Proposal lifecycle

1. A proposal is drafted from a fixed predecessor revision and hashed. The
   hash is immutable: any edit produces a new proposal with a new hash.
2. Preview renders the proposal and its hash. The user inspects the exact
   diff, the evidence, and the provenance before acting.
3. Confirmation commits only if the live predecessor revision still equals
   the proposal's revision and the hashes match. Otherwise the proposal is
   stale: it is rejected and regenerated, never silently rebased onto the
   newer program.
4. The commit writes the transition record, the outgoing archive, and the
   successor activation through the existing compare-and-swap and program-
   draft transaction boundary (`commitProgramReplacement()` with the
   `_storageDraftTransaction` protocol). Boot observes all three or none.

## Kind-specific rules

- `compiler-derived`: the `compiler` section is required; sibling
  recompilation must stay within the same family and preserve
  compiler/program/progression/exercise/archive/version identity.
- `guided-manual-repair`: used when safe recompilation is impossible. The
  exact program is preserved, a transition editor opens with the diagnosed
  constraint highlighted, and explicit user changes are required.
- `permanent-volume-reduction`: the separately named `Reduce training
  volume` action. Respects protected and minimum work; previewed, confirmed,
  versioned.
- `recovery-week`: governed by `docs/recovery-week-policy.md`. Until the
  owner approves the exact allocation rule, no `recovery-week` record may be
  written; Plans 052/056 stop at that gate.

## Failure tabletop

| Scenario | Required behavior |
|---|---|
| Preview open while another tab replaces the program | Commit rejects the stale proposal hash; user reviews a regenerated proposal |
| Crash between archive write and successor activation | Boot completes the atomic transaction or restores the pre-commit state; partial visibility is prohibited |
| Unknown `schemaVersion` on read | Fail closed; existing program and history untouched |
| `kind` is `recovery-week` without an approved allocation rule | Refuse the proposal; record the gate, do not invent constants |
| Confirmation hash differs from preview hash | Reject; preview and commit must be the same immutable proposal |
