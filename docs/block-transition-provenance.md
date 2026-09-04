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
| `diff.days` | array | Entries of `{predecessorDay, successorDay, before, after, reason}`. Day and slot identities are blueprint-qualified compiler IDs and are never shared across blueprints, so every entry names both sides explicitly: both IDs for mapped days, `predecessorDay` only for removals, `successorDay` only for additions. Array order is the successor order; every non-null snapshot carries its 0-based `index` |
| `diff.exercises` | array | Entries of `{predecessorSlot, successorSlot, movement, before, after, reason}`: slot identities are blueprint-qualified compiler IDs (e.g. `growth_4_d2_s1`) and are never shared across blueprints, so every entry names both sides explicitly — both slots for moved/retained work (a same-slot movement replacement reads as `before.movement ≠ after.movement` under one slot pair), `predecessorSlot` only for removals, `successorSlot` only for additions. `movement` is the successor movement ID in `library:` form. `before`/`after` are complete slot snapshots carrying their own `movement` and 0-based `index`. The fixture `test/fixtures/transition-proposal-v1.json` and the example below carry the exact shapes |
| `diff.prescriptions` | array | Entries of `{predecessorSlot, successorSlot, movement, before, after, reason}` keyed the same way as `exercises` |
| `diff.recoveryWeek` | object, optional | Present only for `recovery_week`: the overlay below |
| `progressionContract.preservedRelations` | string[] | Relations and strategies carried over unchanged |
| `progressionContract.resetRelations` | string[] | Explicitly reset relations with reasons |
| `progressionContract.incompatibilities` | string[] | Declared incompatibilities; never silent |
| `archiveId` | string \| null | Outgoing archive entry carrying the transition-out link; null wherever nothing is archived (see presence matrix) |
| `proposalHash` | string | Immutable hash of the proposal; preview and commit must match |

### Field presence by kind and status

One schema, explicit presence — no separate proposal type, no silent
defaults:

| Field | `preview` / `stale` (any kind) | `confirmed` / `committed` / `failed-before-commit`, replacement kinds | `recovery_week` | `repeat` / `continue` |
|---|---|---|---|---|
| `confirmedAt` | Absent | Required | Required on confirmation | Required on confirmation |
| `archiveId` | Absent | Required (committed) | Null — overlays archive nothing; evidence lives in `diagnosis` and the overlay | Null — nothing is replaced |
| `successor.*` | Present as proposal | Required | Absent — no successor program exists | `successor.programId` equals predecessor; no new program is minted |
| `diff.recoveryWeek` | Absent unless proposed | Absent | Required | Absent |
| `diff` arrays | Proposed entries | Committed entries | Overlay-only changes live in the overlay; arrays may be empty | Empty arrays |

`failed-before-commit` carries the `confirmed`-stage fields plus its terminal
status; no failure-reason field is invented. A `stale` proposal is never
edited in place — regeneration mints a new proposal with a new hash.

Store transition-in on successor metadata and the transition-out link in the
outgoing archive entry. History and log rows stay immutable and keep pointing
at their original program/session identities. Backup round-trips both records.

### Canonical array order and proposal hashing

Two implementations must produce the same proposal hash for the same
transition. Array order is therefore total, not incidental:

- `days[]`: present days in successor order first, then removed days sorted
  by day ID ascending.
- `exercises[]` and `prescriptions[]`: retained entries in successor
  (day, slot) order first, then added entries in successor order, then
  removed entries sorted by slot ID ascending.
- `index` inside `before` snapshots is the 0-based predecessor position;
  inside `after` snapshots it is the 0-based successor position. Validators
  reject a non-null snapshot without `index` (see below).
- Placement is reconstructable: every non-null `before` object carries
  `index` (its 0-based predecessor position) and every non-null `after`
  object carries `index` (its 0-based successor position). An entry with a
  `before` and no `after` therefore still names where it used to live, and
  an added entry names exactly where it landed. Validators reject a
  non-null snapshot without `index`.
- `proposalHash` is the lowercase hex encoding of SHA-256 over the
  proposal's canonical preimage: the proposal object with `proposalHash`,
  `status`, `confirmedAt`, and `archiveId` removed (lifecycle fields do not
  perturb identity), the remaining fields serialized as canonical JSON —
  recursively sorted object keys, UTF-8 encoding, no insignificant
  whitespace — and the array order defined above. Set-like evidence and
  progression arrays (`diagnosis.eligibleEvidenceIds`,
  `diagnosis.insufficientEvidenceReasons`,
  `progressionContract.preservedRelations`,
  `progressionContract.resetRelations`,
  `progressionContract.incompatibilities`) are deduplicated and sorted
  ascending as strings before serialization. Any change to any preimage
  field, however cosmetic, changes the hash and therefore the proposal
  identity.
- Executable fixture: `test/fixtures/transition-proposal-v1.json` holds the
  preimage proposal (it deliberately contains a duplicate evidence ID and
  unsorted evidence to exercise the set rules); hashing it with the
  documented rule yields
  `proposalHash: d9dca768503f79ba01d914ff7cc2bb7914c32fffb607b6b83f4605f3b94c19c1`.
  `node tools/canonical-proposal-hash.mjs` recomputes and verifies it; the
  example record below embeds the same fixture with its lifecycle fields and
  this digest filled in.

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
    "compilerProvenance": { "familyVersion": "growth-v3", "blueprintVersion": 1, "compilerVersion": 2, "rulesVersion": 1, "catalogueVersion": 1 }
  },
  "diagnosis": {
    "kind": "fewer_days",
    "answers": { "availableDays": 3 },
    "eligibleEvidenceIds": ["sessions-14d-6-of-3", "sessions-14d-3-of-6", "sessions-14d-3-of-6"],
    "insufficientEvidenceReasons": []
  },
  "derivation": {
    "mode": "recompilation",
    "request": "lower-frequency-sibling",
    "compilerContextVersions": { "compilerVersion": 2, "rulesVersion": 1, "catalogueVersion": 1 },
    "policyVersions": {}
  },
  "successor": {
    "programId": "prog_local_b7",
    "fingerprint": "fp51ad0e",
    "source": "Recommend",
    "compilerProvenance": { "familyVersion": "growth-v3", "blueprintVersion": 1, "compilerVersion": 2, "rulesVersion": 1, "catalogueVersion": 1 }
  },
  "diff": {
    "days": [
      { "predecessorDay": "growth_4_d4", "successorDay": null, "before": { "label": "Day 4", "index": 3, "slots": 5 }, "after": null, "reason": "fewer_days: 4-day blueprint has no 3-day successor day; coverage preserved by mapped days" }
    ],
    "exercises": [
      { "predecessorSlot": "growth_4_d2_s1", "successorSlot": "growth_3_d1_s1", "movement": "library:sq_lp", "before": { "movement": "library:sq_lp", "index": 0, "sets": 3 }, "after": { "movement": "library:sq_lp", "index": 0, "sets": 3 }, "reason": "protected primary retained across sibling days" },
      { "predecessorSlot": "growth_4_d1_s1", "successorSlot": "growth_3_d1_s2", "movement": "library:pr_mc", "before": { "movement": "library:pr_mc", "index": 0, "sets": 3 }, "after": { "movement": "library:pr_mc", "index": 1, "sets": 3 }, "reason": "retained; day order differs between siblings" },
      { "predecessorSlot": "growth_4_d2_s3", "successorSlot": "growth_3_d2_s4", "movement": "library:sq_lp", "before": { "movement": "library:lg_bb", "index": 2, "sets": 3 }, "after": { "movement": "library:sq_lp", "index": 3, "sets": 3 }, "reason": "same-slot movement replacement: unilateral knee slot resolves to a different movement in the 3-day blueprint" },
      { "predecessorSlot": "growth_4_d3_s2", "successorSlot": "growth_3_d3_s2", "movement": "library:ip_mc", "before": { "movement": "library:rw_mc", "index": 1, "sets": 3 }, "after": { "movement": "library:ip_mc", "index": 1, "sets": 3 }, "reason": "same-slot movement replacement with identical prescription" },
      { "predecessorSlot": "growth_4_d1_s4", "successorSlot": null, "movement": null, "before": { "movement": "library:ip_mc", "index": 3, "sets": 3 }, "after": null, "reason": "slot removed with its day; coverage preserved by growth_3_d2_s5" },
      { "predecessorSlot": "growth_4_d4_s1", "successorSlot": null, "movement": null, "before": { "movement": "library:hg_mc", "index": 0, "sets": 3 }, "after": null, "reason": "day removed; hinge coverage preserved by growth_3_d2_s1" }
    ],
    "prescriptions": [
      { "predecessorSlot": "growth_4_d1_s5", "successorSlot": "growth_3_d1_s5", "movement": "library:dl_cb", "before": { "sets": 2, "index": 4 }, "after": { "sets": 2, "index": 4 }, "reason": "protected-prescription parity on the mapped lateral-delt slot" }
    ]
  },
  "progressionContract": {
    "preservedRelations": ["range@1 anchors", "rep_goal@1 volume pairing"],
    "resetRelations": [],
    "incompatibilities": []
  },
  "archiveId": "arc_01J9Z8X7C6V5B4N3M1",
  "proposalHash": "d9dca768503f79ba01d914ff7cc2bb7914c32fffb607b6b83f4605f3b94c19c1"
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
| `entries` | array | Per-slot `{slot, movement, movementPattern, baseWorkingSets, effectiveWorkingSets, removedOptionalFirst, reason}`: `slot` is the stable program slot identity (compiler `slotId`), `movement` the library/custom movement ID, `movementPattern` the first-listed template pattern token (coverage is evaluated over the canonical knee-dominant, hip/hinge, and horizontal-press classes). Repeated movements in different slots — e.g. a protected and a reducible leg-press slot — must never share an entry |
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
    { "slot": "growth_2_d1_s1", "movement": "library:sq_lp", "movementPattern": "squat", "baseWorkingSets": 3, "effectiveWorkingSets": 2, "removedOptionalFirst": false, "reason": "protected-ceil" },
    { "slot": "growth_2_d2_s4", "movement": "library:sq_lp", "movementPattern": "leg_extension", "baseWorkingSets": 3, "effectiveWorkingSets": 1, "removedOptionalFirst": false, "reason": "reducible-floor" },
    { "slot": "growth_2_d1_s6", "movement": "library:cu_cb", "movementPattern": "curl", "baseWorkingSets": 2, "effectiveWorkingSets": 0, "removedOptionalFirst": true, "reason": "optional-removed" }
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
