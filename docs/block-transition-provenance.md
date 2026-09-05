# Block-transition provenance contract

- **Schema version:** 1
- **Contract owner:** Plan 049 (this schema); implemented by Plan 052;
  rendering consumer Plan 056
- **Specified by:** Plan 049; later changes require a versioned Phase 0
  amendment, never ad hoc renderer fields
- **Companion contracts:** [`docs/program-entry-flow.md`](program-entry-flow.md)
  (activation boundary), `docs/recovery-week-policy.md` (approved recovery-week
  overlay allocation), [ADR 0012](adr/0012-ui-overhaul-canonical-reconciliation.md)
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
| `diff.exercises` | array | Entries of `{predecessorSlot, successorSlot, movement, before, after, reason}`: slot identities are blueprint-qualified compiler IDs (e.g. `growth_4_d2_s1`) and are never shared across blueprints, so every entry names both sides explicitly — both slots for moved/retained work (a same-slot movement replacement reads as `before.movement ≠ after.movement` under one slot pair), `predecessorSlot` only for removals, `successorSlot` only for additions. `movement` is the successor movement ID in `library:` form. `before`/`after` are complete slot snapshots carrying their own `movement` and 0-based `index`. The array is exhaustive: one row per `slotMapping.slots` entry, in the same pair/addition/removal order. The fixture `test/fixtures/transition-proposal-v1.json` and the example below carry the exact shapes |
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
- `diff.days`, `diff.exercises`, and `diff.prescriptions` are generated from
  `derivation.slotMapping` and the real compiler snapshots. Validators reject
  a missing, extra, reordered, snapshot-inconsistent, movement-inconsistent,
  prescription-inconsistent, or reason-vocabulary-invalid row; no
  hand-selected subset can stand in for the exhaustive mapping. A day with
  only added successor slots still has a `diff.days` addition row.
- `index` inside `before` snapshots is the 0-based predecessor position;
  inside `after` snapshots it is the 0-based successor position. Validators
  reject a non-null snapshot without `index` (see below).
- Placement is reconstructable: every non-null `before` object carries
  `index` (its 0-based predecessor position) and every non-null `after`
  object carries `index` (its 0-based successor position). An entry with a
  `before` and no `after` therefore still names where it used to live, and
  an added entry names exactly where it landed. Validators reject a
  non-null snapshot without `index`.
- The slot mapping is exhaustive and deterministic, and it is part of the
  hashed proposal contract. Every predecessor slot appears exactly once
  (mapped to its successor slot, or `null` when removed) and every successor
  slot appears exactly once (mapped from its predecessor, or `null` when
  added); validators reject duplicate or missing identities. Pairing runs in
  three passes — same-`templateId` pairs first (successors in (day, slot)
  order taking the earliest unused same-template predecessor from a day at
  or before the successor's day), then additions, then removals — and the
  array order is exactly that emission order. `slotMapping.days` emits one
  row for each successor day in successor order (mapped or successor-only),
  then predecessor-only removals sorted by day ID. `slotMapping.days` and
  `slotMapping.slots` are the only stable fields: `contract` and
  `schemaVersion` identify the mapping format, and prose (`source`, `rule`)
  is excluded from the preimage so explanatory text can never perturb a
  digest. The mapping section is serialized inside the canonical preimage
  under `derivation.slotMapping`, so two implementations deriving the same
  transition cannot disagree silently.
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
  ascending as strings before serialization. Any change to the normalized
  canonical preimage — any field value, any array element or order, any
  added or removed entry — changes the hash and therefore the proposal
  identity; duplicate set-array elements are normalized away and
  deliberately do not.
- Executable fixture: `test/fixtures/transition-proposal-v1.json` holds the
  preimage proposal (it deliberately contains a duplicate evidence ID and
  unsorted evidence to exercise the set rules); hashing it with the
  documented rule yields
  `proposalHash: c7a4c90322522d6d990fdd7e7e51c7da0de7b349f2d3e959619b9c1d9e9feadc`.
  its `derivation.slotMapping` section exhaustively covers every predecessor
  and successor slot of the growth_4_v1 -> growth_3_v1 pair (verified against
  `test/fixtures/program-families-v1.json` at check time);
  `node tools/canonical-proposal-hash.mjs` recomputes and verifies it; the
  example record below embeds the same fixture with its lifecycle fields and
  this digest filled in.

### Example record: `lower_frequency_sibling` (shape-exact)

```json
{
  "schemaVersion": 1,
  "transitionId": "tr_01J9Z8X7C6V5B4N3M2",
  "kind": "lower_frequency_sibling",
  "createdAt": "2026-10-01T09:00:00.000Z",
  "predecessor": {
    "programId": "prog_local_a1",
    "fingerprint": "fp9f2c41",
    "durableRevision": 18,
    "source": "Recommend",
    "compilerProvenance": {
      "familyId": "growth",
      "blueprintId": "growth_4_v1",
      "blueprintVersion": 1,
      "compilerVersion": 2,
      "catalogueVersion": 1,
      "rulesVersion": 1,
      "contextVersion": 2,
      "profileId": "standard@1",
      "recentConsistencyVersion": 1
    }
  },
  "diagnosis": {
    "kind": "fewer_days",
    "answers": {
      "availableDays": 3
    },
    "eligibleEvidenceIds": [
      "sessions-14d-6-of-3",
      "sessions-14d-3-of-6",
      "sessions-14d-3-of-6"
    ],
    "insufficientEvidenceReasons": []
  },
  "derivation": {
    "mode": "recompilation",
    "request": "lower-frequency-sibling",
    "compilerContextVersions": {
      "familyId": "growth",
      "blueprintId": "growth_3_v1",
      "compilerVersion": 2,
      "catalogueVersion": 1,
      "rulesVersion": 1,
      "contextVersion": 2,
      "profileId": "standard@1",
      "recentConsistencyVersion": 1
    },
    "policyVersions": {},
    "slotMapping": {
      "contract": "taurifer-transition-slot-mapping",
      "schemaVersion": 1,
      "source": "test/fixtures/program-families-v1.json reviewCompilations (growth_4_v1 -> growth_3_v1, same family lower-frequency sibling)",
      "rule": "Predecessor and successor slot identities are blueprint-qualified compiler IDs and never shared across blueprints. Every diff entry names both sides explicitly: predecessorSlot/successorSlot for moved work, predecessorSlot only for removals, successorSlot only for additions. Movement identity travels inside the slot snapshots. This mapping is the executable proof that the documented slot-pairing contract compiles from real output.",
      "days": [
        {
          "predecessorDay": "growth_4_d1",
          "successorDay": "growth_3_d1"
        },
        {
          "predecessorDay": "growth_4_d2",
          "successorDay": "growth_3_d2"
        },
        {
          "predecessorDay": "growth_4_d3",
          "successorDay": "growth_3_d3"
        },
        {
          "predecessorDay": "growth_4_d4",
          "successorDay": null
        }
      ],
      "slots": [
        {
          "predecessorSlot": "growth_4_d1_s1",
          "successorSlot": "growth_3_d1_s2",
          "predecessorMovement": "library:pr_mc",
          "successorMovement": "library:pr_mc"
        },
        {
          "predecessorSlot": "growth_4_d1_s2",
          "successorSlot": "growth_3_d1_s3",
          "predecessorMovement": "library:rw_mc",
          "successorMovement": "library:rw_mc"
        },
        {
          "predecessorSlot": "growth_4_d1_s5",
          "successorSlot": "growth_3_d1_s5",
          "predecessorMovement": "library:dl_cb",
          "successorMovement": "library:dl_cb"
        },
        {
          "predecessorSlot": "growth_4_d2_s2",
          "successorSlot": "growth_3_d2_s1",
          "predecessorMovement": "library:hg_mc",
          "successorMovement": "library:hg_mc"
        },
        {
          "predecessorSlot": "growth_4_d1_s3",
          "successorSlot": "growth_3_d2_s2",
          "predecessorMovement": "library:pd_bw",
          "successorMovement": "library:pd_bw"
        },
        {
          "predecessorSlot": "growth_4_d1_s4",
          "successorSlot": "growth_3_d2_s5",
          "predecessorMovement": "library:ip_mc",
          "successorMovement": "library:ip_mc"
        },
        {
          "predecessorSlot": "growth_4_d2_s5",
          "successorSlot": "growth_3_d2_s6",
          "predecessorMovement": "library:cv_mc",
          "successorMovement": "library:cv_mc"
        },
        {
          "predecessorSlot": "growth_4_d2_s3",
          "successorSlot": "growth_3_d3_s1",
          "predecessorMovement": "library:lg_bb",
          "successorMovement": "library:lg_bb"
        },
        {
          "predecessorSlot": "growth_4_d3_s1",
          "successorSlot": "growth_3_d3_s2",
          "predecessorMovement": "library:ip_mc",
          "successorMovement": "library:ip_mc"
        },
        {
          "predecessorSlot": "growth_4_d3_s5",
          "successorSlot": "growth_3_d3_s5",
          "predecessorMovement": "library:dl_cb",
          "successorMovement": "library:dl_cb"
        },
        {
          "predecessorSlot": null,
          "successorSlot": "growth_3_d1_s1",
          "predecessorMovement": null,
          "successorMovement": "library:sq_lp"
        },
        {
          "predecessorSlot": null,
          "successorSlot": "growth_3_d1_s4",
          "predecessorMovement": null,
          "successorMovement": "library:hg_mc"
        },
        {
          "predecessorSlot": null,
          "successorSlot": "growth_3_d1_s6",
          "predecessorMovement": null,
          "successorMovement": "library:cu_cb"
        },
        {
          "predecessorSlot": null,
          "successorSlot": "growth_3_d2_s3",
          "predecessorMovement": null,
          "successorMovement": "library:sp_mc"
        },
        {
          "predecessorSlot": null,
          "successorSlot": "growth_3_d2_s4",
          "predecessorMovement": null,
          "successorMovement": "library:sq_lp"
        },
        {
          "predecessorSlot": null,
          "successorSlot": "growth_3_d3_s3",
          "predecessorMovement": null,
          "successorMovement": "library:rw_mc"
        },
        {
          "predecessorSlot": null,
          "successorSlot": "growth_3_d3_s4",
          "predecessorMovement": null,
          "successorMovement": "library:hg_mc"
        },
        {
          "predecessorSlot": null,
          "successorSlot": "growth_3_d3_s6",
          "predecessorMovement": null,
          "successorMovement": "library:cu_cb"
        },
        {
          "predecessorSlot": "growth_4_d1_s6",
          "successorSlot": null,
          "predecessorMovement": "library:tr_cb",
          "successorMovement": null
        },
        {
          "predecessorSlot": "growth_4_d2_s1",
          "successorSlot": null,
          "predecessorMovement": "library:sq_lp",
          "successorMovement": null
        },
        {
          "predecessorSlot": "growth_4_d2_s4",
          "successorSlot": null,
          "predecessorMovement": "library:hg_mc",
          "successorMovement": null
        },
        {
          "predecessorSlot": "growth_4_d3_s2",
          "successorSlot": null,
          "predecessorMovement": "library:rw_mc",
          "successorMovement": null
        },
        {
          "predecessorSlot": "growth_4_d3_s3",
          "successorSlot": null,
          "predecessorMovement": "library:sp_mc",
          "successorMovement": null
        },
        {
          "predecessorSlot": "growth_4_d3_s4",
          "successorSlot": null,
          "predecessorMovement": "library:pd_bw",
          "successorMovement": null
        },
        {
          "predecessorSlot": "growth_4_d3_s6",
          "successorSlot": null,
          "predecessorMovement": "library:cu_cb",
          "successorMovement": null
        },
        {
          "predecessorSlot": "growth_4_d4_s1",
          "successorSlot": null,
          "predecessorMovement": "library:hg_mc",
          "successorMovement": null
        },
        {
          "predecessorSlot": "growth_4_d4_s2",
          "successorSlot": null,
          "predecessorMovement": "library:sq_lp",
          "successorMovement": null
        },
        {
          "predecessorSlot": "growth_4_d4_s3",
          "successorSlot": null,
          "predecessorMovement": "library:hg_mc",
          "successorMovement": null
        },
        {
          "predecessorSlot": "growth_4_d4_s4",
          "successorSlot": null,
          "predecessorMovement": "library:hg_mc",
          "successorMovement": null
        },
        {
          "predecessorSlot": "growth_4_d4_s5",
          "successorSlot": null,
          "predecessorMovement": "library:cv_mc",
          "successorMovement": null
        }
      ]
    }
  },
  "successor": {
    "programId": "prog_local_b7",
    "fingerprint": "fp51ad0e",
    "source": "Recommend",
    "compilerProvenance": {
      "familyId": "growth",
      "blueprintId": "growth_3_v1",
      "blueprintVersion": 1,
      "compilerVersion": 2,
      "catalogueVersion": 1,
      "rulesVersion": 1,
      "contextVersion": 2,
      "profileId": "standard@1",
      "recentConsistencyVersion": 1
    }
  },
  "diff": {
    "days": [
      {
        "predecessorDay": "growth_4_d1",
        "successorDay": "growth_3_d1",
        "before": {
          "label": "Upper A",
          "index": 0,
          "slots": 6
        },
        "after": {
          "label": "Knee / horizontal",
          "index": 0,
          "slots": 6
        },
        "reason": "mapped day"
      },
      {
        "predecessorDay": "growth_4_d2",
        "successorDay": "growth_3_d2",
        "before": {
          "label": "Lower A",
          "index": 1,
          "slots": 5
        },
        "after": {
          "label": "Hip / vertical",
          "index": 1,
          "slots": 6
        },
        "reason": "mapped day"
      },
      {
        "predecessorDay": "growth_4_d3",
        "successorDay": "growth_3_d3",
        "before": {
          "label": "Upper B",
          "index": 2,
          "slots": 6
        },
        "after": {
          "label": "Mixed",
          "index": 2,
          "slots": 6
        },
        "reason": "mapped day"
      },
      {
        "predecessorDay": "growth_4_d4",
        "successorDay": null,
        "before": {
          "label": "Lower B",
          "index": 3,
          "slots": 5
        },
        "after": null,
        "reason": "fewer_days: 4-day blueprint has no 3-day successor day; coverage preserved by mapped days"
      }
    ],
    "exercises": [
      {
        "predecessorSlot": "growth_4_d1_s1",
        "successorSlot": "growth_3_d1_s2",
        "movement": "library:pr_mc",
        "before": {
          "movement": "library:pr_mc",
          "index": 0,
          "sets": 3
        },
        "after": {
          "movement": "library:pr_mc",
          "index": 1,
          "sets": 3
        },
        "reason": "retained; day order differs between siblings"
      },
      {
        "predecessorSlot": "growth_4_d1_s2",
        "successorSlot": "growth_3_d1_s3",
        "movement": "library:rw_mc",
        "before": {
          "movement": "library:rw_mc",
          "index": 1,
          "sets": 3
        },
        "after": {
          "movement": "library:rw_mc",
          "index": 2,
          "sets": 3
        },
        "reason": "mapped same-template slot changed day or order"
      },
      {
        "predecessorSlot": "growth_4_d1_s5",
        "successorSlot": "growth_3_d1_s5",
        "movement": "library:dl_cb",
        "before": {
          "movement": "library:dl_cb",
          "index": 4,
          "sets": 2
        },
        "after": {
          "movement": "library:dl_cb",
          "index": 4,
          "sets": 2
        },
        "reason": "mapped same-template slot changed day or order"
      },
      {
        "predecessorSlot": "growth_4_d2_s2",
        "successorSlot": "growth_3_d2_s1",
        "movement": "library:hg_mc",
        "before": {
          "movement": "library:hg_mc",
          "index": 1,
          "sets": 3
        },
        "after": {
          "movement": "library:hg_mc",
          "index": 0,
          "sets": 3
        },
        "reason": "mapped same-template slot changed day or order"
      },
      {
        "predecessorSlot": "growth_4_d1_s3",
        "successorSlot": "growth_3_d2_s2",
        "movement": "library:pd_bw",
        "before": {
          "movement": "library:pd_bw",
          "index": 2,
          "sets": 3
        },
        "after": {
          "movement": "library:pd_bw",
          "index": 1,
          "sets": 3
        },
        "reason": "mapped same-template slot changed day or order"
      },
      {
        "predecessorSlot": "growth_4_d1_s4",
        "successorSlot": "growth_3_d2_s5",
        "movement": "library:ip_mc",
        "before": {
          "movement": "library:ip_mc",
          "index": 3,
          "sets": 3
        },
        "after": {
          "movement": "library:ip_mc",
          "index": 4,
          "sets": 3
        },
        "reason": "mapped same-template slot changed day or order"
      },
      {
        "predecessorSlot": "growth_4_d2_s5",
        "successorSlot": "growth_3_d2_s6",
        "movement": "library:cv_mc",
        "before": {
          "movement": "library:cv_mc",
          "index": 4,
          "sets": 2
        },
        "after": {
          "movement": "library:cv_mc",
          "index": 5,
          "sets": 2
        },
        "reason": "mapped same-template slot changed day or order"
      },
      {
        "predecessorSlot": "growth_4_d2_s3",
        "successorSlot": "growth_3_d3_s1",
        "movement": "library:lg_bb",
        "before": {
          "movement": "library:lg_bb",
          "index": 2,
          "sets": 3
        },
        "after": {
          "movement": "library:lg_bb",
          "index": 0,
          "sets": 3
        },
        "reason": "mapped same-template slot changed day or order"
      },
      {
        "predecessorSlot": "growth_4_d3_s1",
        "successorSlot": "growth_3_d3_s2",
        "movement": "library:ip_mc",
        "before": {
          "movement": "library:ip_mc",
          "index": 0,
          "sets": 3
        },
        "after": {
          "movement": "library:ip_mc",
          "index": 1,
          "sets": 3
        },
        "reason": "mapped same-template slot changed day or order"
      },
      {
        "predecessorSlot": "growth_4_d3_s5",
        "successorSlot": "growth_3_d3_s5",
        "movement": "library:dl_cb",
        "before": {
          "movement": "library:dl_cb",
          "index": 4,
          "sets": 2
        },
        "after": {
          "movement": "library:dl_cb",
          "index": 4,
          "sets": 2
        },
        "reason": "mapped same-template slot changed day or order"
      },
      {
        "predecessorSlot": null,
        "successorSlot": "growth_3_d1_s1",
        "movement": "library:sq_lp",
        "before": null,
        "after": {
          "movement": "library:sq_lp",
          "index": 0,
          "sets": 3
        },
        "reason": "added successor slot"
      },
      {
        "predecessorSlot": null,
        "successorSlot": "growth_3_d1_s4",
        "movement": "library:hg_mc",
        "before": null,
        "after": {
          "movement": "library:hg_mc",
          "index": 3,
          "sets": 3
        },
        "reason": "added successor slot"
      },
      {
        "predecessorSlot": null,
        "successorSlot": "growth_3_d1_s6",
        "movement": "library:cu_cb",
        "before": null,
        "after": {
          "movement": "library:cu_cb",
          "index": 5,
          "sets": 2
        },
        "reason": "added successor slot"
      },
      {
        "predecessorSlot": null,
        "successorSlot": "growth_3_d2_s3",
        "movement": "library:sp_mc",
        "before": null,
        "after": {
          "movement": "library:sp_mc",
          "index": 2,
          "sets": 3
        },
        "reason": "added successor slot"
      },
      {
        "predecessorSlot": null,
        "successorSlot": "growth_3_d2_s4",
        "movement": "library:sq_lp",
        "before": null,
        "after": {
          "movement": "library:sq_lp",
          "index": 3,
          "sets": 3
        },
        "reason": "added successor slot"
      },
      {
        "predecessorSlot": null,
        "successorSlot": "growth_3_d3_s3",
        "movement": "library:rw_mc",
        "before": null,
        "after": {
          "movement": "library:rw_mc",
          "index": 2,
          "sets": 3
        },
        "reason": "added successor slot"
      },
      {
        "predecessorSlot": null,
        "successorSlot": "growth_3_d3_s4",
        "movement": "library:hg_mc",
        "before": null,
        "after": {
          "movement": "library:hg_mc",
          "index": 3,
          "sets": 3
        },
        "reason": "added successor slot"
      },
      {
        "predecessorSlot": null,
        "successorSlot": "growth_3_d3_s6",
        "movement": "library:cu_cb",
        "before": null,
        "after": {
          "movement": "library:cu_cb",
          "index": 5,
          "sets": 2
        },
        "reason": "added successor slot"
      },
      {
        "predecessorSlot": "growth_4_d1_s6",
        "successorSlot": null,
        "movement": null,
        "before": {
          "movement": "library:tr_cb",
          "index": 5,
          "sets": 2
        },
        "after": null,
        "reason": "removed predecessor slot"
      },
      {
        "predecessorSlot": "growth_4_d2_s1",
        "successorSlot": null,
        "movement": null,
        "before": {
          "movement": "library:sq_lp",
          "index": 0,
          "sets": 3
        },
        "after": null,
        "reason": "removed predecessor slot"
      },
      {
        "predecessorSlot": "growth_4_d2_s4",
        "successorSlot": null,
        "movement": null,
        "before": {
          "movement": "library:hg_mc",
          "index": 3,
          "sets": 3
        },
        "after": null,
        "reason": "removed predecessor slot"
      },
      {
        "predecessorSlot": "growth_4_d3_s2",
        "successorSlot": null,
        "movement": null,
        "before": {
          "movement": "library:rw_mc",
          "index": 1,
          "sets": 3
        },
        "after": null,
        "reason": "removed predecessor slot"
      },
      {
        "predecessorSlot": "growth_4_d3_s3",
        "successorSlot": null,
        "movement": null,
        "before": {
          "movement": "library:sp_mc",
          "index": 2,
          "sets": 3
        },
        "after": null,
        "reason": "removed predecessor slot"
      },
      {
        "predecessorSlot": "growth_4_d3_s4",
        "successorSlot": null,
        "movement": null,
        "before": {
          "movement": "library:pd_bw",
          "index": 3,
          "sets": 3
        },
        "after": null,
        "reason": "removed predecessor slot"
      },
      {
        "predecessorSlot": "growth_4_d3_s6",
        "successorSlot": null,
        "movement": null,
        "before": {
          "movement": "library:cu_cb",
          "index": 5,
          "sets": 2
        },
        "after": null,
        "reason": "removed predecessor slot"
      },
      {
        "predecessorSlot": "growth_4_d4_s1",
        "successorSlot": null,
        "movement": null,
        "before": {
          "movement": "library:hg_mc",
          "index": 0,
          "sets": 3
        },
        "after": null,
        "reason": "day removed; hinge coverage preserved by growth_3_d2_s1"
      },
      {
        "predecessorSlot": "growth_4_d4_s2",
        "successorSlot": null,
        "movement": null,
        "before": {
          "movement": "library:sq_lp",
          "index": 1,
          "sets": 3
        },
        "after": null,
        "reason": "removed predecessor slot"
      },
      {
        "predecessorSlot": "growth_4_d4_s3",
        "successorSlot": null,
        "movement": null,
        "before": {
          "movement": "library:hg_mc",
          "index": 2,
          "sets": 3
        },
        "after": null,
        "reason": "removed predecessor slot"
      },
      {
        "predecessorSlot": "growth_4_d4_s4",
        "successorSlot": null,
        "movement": null,
        "before": {
          "movement": "library:hg_mc",
          "index": 3,
          "sets": 3
        },
        "after": null,
        "reason": "removed predecessor slot"
      },
      {
        "predecessorSlot": "growth_4_d4_s5",
        "successorSlot": null,
        "movement": null,
        "before": {
          "movement": "library:cv_mc",
          "index": 4,
          "sets": 2
        },
        "after": null,
        "reason": "removed predecessor slot"
      }
    ],
    "prescriptions": [
      {
        "predecessorSlot": "growth_4_d1_s1",
        "successorSlot": "growth_3_d1_s2",
        "movement": "library:pr_mc",
        "before": {
          "sets": 3,
          "reps": [
            4,
            8
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_4_8",
          "index": 0
        },
        "after": {
          "sets": 3,
          "reps": [
            4,
            8
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_4_8",
          "index": 1
        },
        "reason": "prescription changed"
      },
      {
        "predecessorSlot": "growth_4_d1_s2",
        "successorSlot": "growth_3_d1_s3",
        "movement": "library:rw_mc",
        "before": {
          "sets": 3,
          "reps": [
            4,
            8
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_4_8",
          "index": 1
        },
        "after": {
          "sets": 3,
          "reps": [
            4,
            8
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_4_8",
          "index": 2
        },
        "reason": "prescription changed"
      },
      {
        "predecessorSlot": "growth_4_d1_s5",
        "successorSlot": "growth_3_d1_s5",
        "movement": "library:dl_cb",
        "before": {
          "sets": 2,
          "reps": [
            8,
            15
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 60,
          "strategy": "rep_goal@1",
          "prescriptionClass": "isolation_8_15",
          "index": 4
        },
        "after": {
          "sets": 2,
          "reps": [
            8,
            15
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 60,
          "strategy": "rep_goal@1",
          "prescriptionClass": "isolation_8_15",
          "index": 4
        },
        "reason": "protected-prescription parity on the mapped lateral-delt slot"
      },
      {
        "predecessorSlot": "growth_4_d2_s2",
        "successorSlot": "growth_3_d2_s1",
        "movement": "library:hg_mc",
        "before": {
          "sets": 3,
          "reps": [
            4,
            8
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_4_8",
          "index": 1
        },
        "after": {
          "sets": 3,
          "reps": [
            4,
            8
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_4_8",
          "index": 0
        },
        "reason": "prescription changed"
      },
      {
        "predecessorSlot": "growth_4_d1_s3",
        "successorSlot": "growth_3_d2_s2",
        "movement": "library:pd_bw",
        "before": {
          "sets": 3,
          "reps": [
            4,
            8
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_4_8",
          "index": 2
        },
        "after": {
          "sets": 3,
          "reps": [
            4,
            8
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_4_8",
          "index": 1
        },
        "reason": "prescription changed"
      },
      {
        "predecessorSlot": "growth_4_d1_s4",
        "successorSlot": "growth_3_d2_s5",
        "movement": "library:ip_mc",
        "before": {
          "sets": 3,
          "reps": [
            8,
            12
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "rep_goal@1",
          "prescriptionClass": "compound_8_12",
          "index": 3
        },
        "after": {
          "sets": 3,
          "reps": [
            8,
            12
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "rep_goal@1",
          "prescriptionClass": "compound_8_12",
          "index": 4
        },
        "reason": "prescription changed"
      },
      {
        "predecessorSlot": "growth_4_d2_s5",
        "successorSlot": "growth_3_d2_s6",
        "movement": "library:cv_mc",
        "before": {
          "sets": 2,
          "reps": [
            8,
            15
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 60,
          "strategy": "rep_goal@1",
          "prescriptionClass": "isolation_8_15",
          "index": 4
        },
        "after": {
          "sets": 2,
          "reps": [
            8,
            15
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 60,
          "strategy": "rep_goal@1",
          "prescriptionClass": "isolation_8_15",
          "index": 5
        },
        "reason": "prescription changed"
      },
      {
        "predecessorSlot": "growth_4_d2_s3",
        "successorSlot": "growth_3_d3_s1",
        "movement": "library:lg_bb",
        "before": {
          "sets": 3,
          "reps": [
            4,
            8
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_4_8",
          "index": 2
        },
        "after": {
          "sets": 3,
          "reps": [
            4,
            8
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_4_8",
          "index": 0
        },
        "reason": "prescription changed"
      },
      {
        "predecessorSlot": "growth_4_d3_s1",
        "successorSlot": "growth_3_d3_s2",
        "movement": "library:ip_mc",
        "before": {
          "sets": 3,
          "reps": [
            4,
            8
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_4_8",
          "index": 0
        },
        "after": {
          "sets": 3,
          "reps": [
            4,
            8
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_4_8",
          "index": 1
        },
        "reason": "prescription changed"
      },
      {
        "predecessorSlot": "growth_4_d3_s5",
        "successorSlot": "growth_3_d3_s5",
        "movement": "library:dl_cb",
        "before": {
          "sets": 2,
          "reps": [
            8,
            15
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 60,
          "strategy": "rep_goal@1",
          "prescriptionClass": "isolation_8_15",
          "index": 4
        },
        "after": {
          "sets": 2,
          "reps": [
            8,
            15
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 60,
          "strategy": "rep_goal@1",
          "prescriptionClass": "isolation_8_15",
          "index": 4
        },
        "reason": "prescription unchanged"
      },
      {
        "predecessorSlot": null,
        "successorSlot": "growth_3_d1_s1",
        "movement": "library:sq_lp",
        "before": null,
        "after": {
          "sets": 3,
          "reps": [
            4,
            8
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_4_8",
          "index": 0
        },
        "reason": "added successor prescription"
      },
      {
        "predecessorSlot": null,
        "successorSlot": "growth_3_d1_s4",
        "movement": "library:hg_mc",
        "before": null,
        "after": {
          "sets": 3,
          "reps": [
            8,
            12
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_8_12",
          "index": 3
        },
        "reason": "added successor prescription"
      },
      {
        "predecessorSlot": null,
        "successorSlot": "growth_3_d1_s6",
        "movement": "library:cu_cb",
        "before": null,
        "after": {
          "sets": 2,
          "reps": [
            8,
            15
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 60,
          "strategy": "range@1",
          "prescriptionClass": "isolation_8_15",
          "index": 5
        },
        "reason": "added successor prescription"
      },
      {
        "predecessorSlot": null,
        "successorSlot": "growth_3_d2_s3",
        "movement": "library:sp_mc",
        "before": null,
        "after": {
          "sets": 3,
          "reps": [
            4,
            8
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_4_8",
          "index": 2
        },
        "reason": "added successor prescription"
      },
      {
        "predecessorSlot": null,
        "successorSlot": "growth_3_d2_s4",
        "movement": "library:sq_lp",
        "before": null,
        "after": {
          "sets": 3,
          "reps": [
            8,
            12
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_8_12",
          "index": 3
        },
        "reason": "added successor prescription"
      },
      {
        "predecessorSlot": null,
        "successorSlot": "growth_3_d3_s3",
        "movement": "library:rw_mc",
        "before": null,
        "after": {
          "sets": 3,
          "reps": [
            8,
            12
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_8_12",
          "index": 2
        },
        "reason": "added successor prescription"
      },
      {
        "predecessorSlot": null,
        "successorSlot": "growth_3_d3_s4",
        "movement": "library:hg_mc",
        "before": null,
        "after": {
          "sets": 3,
          "reps": [
            8,
            12
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_8_12",
          "index": 3
        },
        "reason": "added successor prescription"
      },
      {
        "predecessorSlot": null,
        "successorSlot": "growth_3_d3_s6",
        "movement": "library:cu_cb",
        "before": null,
        "after": {
          "sets": 2,
          "reps": [
            8,
            15
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 60,
          "strategy": "range@1",
          "prescriptionClass": "isolation_8_15",
          "index": 5
        },
        "reason": "added successor prescription"
      },
      {
        "predecessorSlot": "growth_4_d1_s6",
        "successorSlot": null,
        "movement": null,
        "before": {
          "sets": 2,
          "reps": [
            8,
            15
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 60,
          "strategy": "rep_goal@1",
          "prescriptionClass": "isolation_8_15",
          "index": 5
        },
        "after": null,
        "reason": "removed predecessor prescription"
      },
      {
        "predecessorSlot": "growth_4_d2_s1",
        "successorSlot": null,
        "movement": null,
        "before": {
          "sets": 3,
          "reps": [
            4,
            8
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_4_8",
          "index": 0
        },
        "after": null,
        "reason": "removed predecessor prescription"
      },
      {
        "predecessorSlot": "growth_4_d2_s4",
        "successorSlot": null,
        "movement": null,
        "before": {
          "sets": 3,
          "reps": [
            8,
            12
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_8_12",
          "index": 3
        },
        "after": null,
        "reason": "removed predecessor prescription"
      },
      {
        "predecessorSlot": "growth_4_d3_s2",
        "successorSlot": null,
        "movement": null,
        "before": {
          "sets": 3,
          "reps": [
            4,
            8
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_4_8",
          "index": 1
        },
        "after": null,
        "reason": "removed predecessor prescription"
      },
      {
        "predecessorSlot": "growth_4_d3_s3",
        "successorSlot": null,
        "movement": null,
        "before": {
          "sets": 3,
          "reps": [
            4,
            8
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_4_8",
          "index": 2
        },
        "after": null,
        "reason": "removed predecessor prescription"
      },
      {
        "predecessorSlot": "growth_4_d3_s4",
        "successorSlot": null,
        "movement": null,
        "before": {
          "sets": 3,
          "reps": [
            4,
            8
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_4_8",
          "index": 3
        },
        "after": null,
        "reason": "removed predecessor prescription"
      },
      {
        "predecessorSlot": "growth_4_d3_s6",
        "successorSlot": null,
        "movement": null,
        "before": {
          "sets": 2,
          "reps": [
            8,
            15
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 60,
          "strategy": "rep_goal@1",
          "prescriptionClass": "isolation_8_15",
          "index": 5
        },
        "after": null,
        "reason": "removed predecessor prescription"
      },
      {
        "predecessorSlot": "growth_4_d4_s1",
        "successorSlot": null,
        "movement": null,
        "before": {
          "sets": 3,
          "reps": [
            4,
            8
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_4_8",
          "index": 0
        },
        "after": null,
        "reason": "removed predecessor prescription"
      },
      {
        "predecessorSlot": "growth_4_d4_s2",
        "successorSlot": null,
        "movement": null,
        "before": {
          "sets": 3,
          "reps": [
            4,
            8
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_4_8",
          "index": 1
        },
        "after": null,
        "reason": "removed predecessor prescription"
      },
      {
        "predecessorSlot": "growth_4_d4_s3",
        "successorSlot": null,
        "movement": null,
        "before": {
          "sets": 3,
          "reps": [
            8,
            12
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_8_12",
          "index": 2
        },
        "after": null,
        "reason": "removed predecessor prescription"
      },
      {
        "predecessorSlot": "growth_4_d4_s4",
        "successorSlot": null,
        "movement": null,
        "before": {
          "sets": 3,
          "reps": [
            8,
            12
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 90,
          "strategy": "range@1",
          "prescriptionClass": "compound_8_12",
          "index": 3
        },
        "after": null,
        "reason": "removed predecessor prescription"
      },
      {
        "predecessorSlot": "growth_4_d4_s5",
        "successorSlot": null,
        "movement": null,
        "before": {
          "sets": 2,
          "reps": [
            8,
            15
          ],
          "rir": [
            1,
            3
          ],
          "restSeconds": 60,
          "strategy": "rep_goal@1",
          "prescriptionClass": "isolation_8_15",
          "index": 4
        },
        "after": null,
        "reason": "removed predecessor prescription"
      }
    ]
  },
  "progressionContract": {
    "preservedRelations": [
      "range@1 anchors",
      "rep_goal@1 volume pairing"
    ],
    "resetRelations": [],
    "incompatibilities": []
  },
  "status": "committed",
  "confirmedAt": "2026-10-01T09:12:00.000Z",
  "archiveId": "arc_01J9Z8X7C6V5B4N3M1",
  "proposalHash": "c7a4c90322522d6d990fdd7e7e51c7da0de7b349f2d3e959619b9c1d9e9feadc"
}
```

## Recovery-week overlay (not a successor replacement)

Recovery changes no program: there is no successor activation, only an
overlay linked from `diff.recoveryWeek` that Week two ignores. Allocation
follows policy version 2 in `docs/recovery-week-policy.md`. The proposal is
disabled for ineligible evidence or an unreviewed program version outside the
40–60% band. The implementation never clamps a percentage or changes Rule B.

| Field | Type | Meaning |
|---|---|---|
| `schemaVersion` | `1` | Overlay schema version |
| `policyVersion` | integer | Approved recovery-policy version consumed |
| `transitionId` | string | Parent transition record (`kind: recovery_week`) |
| `blockId` | string | Target block identity |
| `activePeriod` | `nextBlockWeek1` | Only valid period |
| `eligibilityEvidence` | object | Sufficient `maintained`/`declined` evidence across at least two of `knee-dominant`, `horizontal press`, and `hip/hinge`, plus `checkpointAnswer: "Yes"` for the closed recovery question. The object has no free text or diagnosis |
| `baseProgramFingerprint` | string | Canonical program the overlay renders against |
| `entries` | array | Per-slot `{slot, movement, movementPattern, baseWorkingSets, effectiveWorkingSets, removedOptionalFirst, reason}`: `slot` is the stable program slot identity (compiler `slotId`), `movement` is the library/custom movement ID, and `movementPattern` is the canonical primary pattern class (`knee-dominant`, `horizontal press`, or `hip/hinge`), or `null` for a non-primary slot. The raw first-listed compiler template token is used only as policy input and is not persisted. Repeated movements in different slots — e.g. a protected and a reducible leg-press slot — must never share an entry |
| `createdAt` | timestamp | Proposal creation time |
| `confirmedAt` | timestamp | Explicit user-confirmation time |
| `reassessmentDueAt` | timestamp | Reassessment point after week one; no automatic repeat |
| `reassessmentOutcome` | `null` or enum | Persisted as `null` until week one ends, then exactly one of `Better`, `About the same`, or `Worse`; `About the same` and `Worse` route to ordinary Review without automatic mutation |

### Example overlay entry set (shape-exact)

```json
{
  "schemaVersion": 1,
  "policyVersion": 2,
  "transitionId": "tr_01J9Z8X7C6V5B4N3M9",
  "blockId": "block_local_k2",
  "activePeriod": "nextBlockWeek1",
  "eligibilityEvidence": {
    "outcomesByPattern": { "knee-dominant": "maintained", "horizontal press": "declined" },
    "qualifyingPatterns": ["horizontal press", "knee-dominant"],
    "checkpointAnswer": "Yes"
  },
  "baseProgramFingerprint": "fp9f2c41",
  "entries": [
    { "slot": "growth_2_d1_s1", "movement": "library:sq_lp", "movementPattern": "knee-dominant", "baseWorkingSets": 3, "effectiveWorkingSets": 2, "removedOptionalFirst": false, "reason": "protected-ceil" },
    { "slot": "growth_2_d2_s4", "movement": "library:sq_lp", "movementPattern": "knee-dominant", "baseWorkingSets": 3, "effectiveWorkingSets": 1, "removedOptionalFirst": false, "reason": "reducible-floor" },
    { "slot": "growth_2_d1_s6", "movement": "library:cu_cb", "movementPattern": null, "baseWorkingSets": 2, "effectiveWorkingSets": 0, "removedOptionalFirst": true, "reason": "optional-removed" }
  ],
  "createdAt": "2026-10-01T09:00:00.000Z",
  "confirmedAt": "2026-10-01T09:12:00.000Z",
  "reassessmentDueAt": "2026-10-08T09:00:00.000Z",
  "reassessmentOutcome": null
}
```

`reason` values are rule mechanics (`optional-removed`, `protected-ceil`,
`reducible-floor`, `pattern-rescue`). Policy version 2 defines the allocation
and the stable first-slot coverage rescue.

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
| `kind` is `recovery_week` without policy version 2 or with ineligible evidence | Refuse the proposal; do not invent constants |
| Confirmation hash differs from preview hash | Reject; preview and commit must be the same immutable proposal |
| Duplicate confirmation | Idempotent on transition ID plus proposal hash; exactly one archive entry |
| Corrupt or unknown recovery overlay | Render the canonical prescription with an explicit recoverable warning; retain raw evidence |
