# Reconstructed Live Durable Model & Result-State Contract
**Phase C0: Live Baseline Reconstruction at SHA `bad6cc9d`**

## 1. Executive Summary

This document reconstructs the live durable state architecture of RepForge following the merge of PR #235 (Plan 053) and PR #239. It defines the exact write paths, callers, invariants, and result states that govern persistence across `localStorage` and `IndexedDB`.

---

## 2. Active Invariants (Plans 051, 052, 053)

| Plan | Boundary | Invariant Requirements |
|---|---|---|
| **Plan 051** | DraftV2 & Sidecar Coordination | In-progress workout draft in `repforge_draft_v1`; atomic checkpoint in `repforge_draft_v1:v2-checkpoint`; coordination markers `repforge_draft_v1:closing:<id>` and `repforge_draft_v1:pending:<id>`. CAS on draft revision. Draft preservation during program replacement; no second draft store. |
| **Plan 052** | Program Transitions & Dual Settlement | Structural program replacement, sibling transition, and recovery week confirmation require **both** `localStorage` and `IndexedDB` replicas to settle for `committed: true`. A single replica write is `deferred`/`partial` requiring recovery. Lock-held preflight rebase, proposal sealing, idempotency check before lock and under lock. Rollback armed in WAL journal for recovery transitions. |
| **Plan 053** | Install Transfer & Mutation Freeze | During active transfer import or when transfer freeze is active (`repforge_install_transfer_freeze_v1`), all state-changing writes must reject with `conflict: true, transferFrozen: true, code: "install-transfer-frozen"`. Exact-clone import, mirrored import markers (`repforge_install_import_v1`), irreversible verified local-committed state. Transfer boot before telemetry boot. |

---

## 3. Durable Storage Inventory

| Key / Resource | Engine | Role | Schema / Invariant |
|---|---|---|---|
| `repforge_v1` | `localStorage` | Primary synchronous mirror | Canonical JSON snapshot of user state; `_storageRevision` integer. |
| `repforge` / `kv` (`repforge_v1`) | `IndexedDB` | Primary durable mirror | Canonical object snapshot; same revision as `localStorage`. |
| `repforge_pending_v1:<uuid>` | `localStorage` | Write-Ahead Log (WAL) | Pre-commit journal with base, liveBase, proposal, replace flag, preconditions, rollback snapshot, and effect. |
| `repforge:state-write` | WebLocks (`navigator.locks`) | Mutation serialization | Acquired by all state mutations (`enqueueWrite`) and boot replica resolution (`resolveBootReplicas`). |
| `repforge_draft_v1` | `localStorage` | Active DraftV2 | Workout draft session state. |
| `repforge_draft_v1:v2-checkpoint` | `localStorage` | Draft checkpoint | Atomic checkpoint for recovery. |
| `repforge_draft_v1:closing:<id>` | `localStorage` | Closing barrier | Coordinates draft promotion/discard during transaction close. |
| `repforge_draft_v1:pending:<id>` | `localStorage` | Draft sidecar | Staged draft changes linked to a journal transaction ID. |
| `_storageDraftTransaction` | Snapshot metadata | In-flight marker | Embedded in snapshot during draft-coordinated transactions; stripped upon finalization. |
| `_storageSetupActivation` | Snapshot metadata | Setup activation marker | `{ version: 1, programId, raw, revision }` embedded to guarantee activation idempotency. |

---

## 4. Reconstructed Result-State Table

| State Category | Result Code / Kind | Characteristics & Flags | In-Memory Reaction | Disk State |
|---|---|---|---|---|
| **Committed** | `committed` | `localOk: true`, `idbOk: true`, `accepted: true`, `rejected: false`, `settled: true`, `revision: N` | Live state rebased & adopted; `persistHead` advanced. | Both `localStorage` and `IndexedDB` contain identical snapshot at revision `N`. Journal cleared. |
| **Already Committed** | `committed` (idempotent) | `alreadyCommitted: true`, `localOk: true`, `idbOk: true`, `accepted: true`, `revision: N` | Verified existing head matches requested transition/activation. No duplicate write. | Already durable at revision `N`. Pending journal entry discarded. |
| **Precondition Conflict** | `conflict` | `localOk: false`, `idbOk: false`, `conflict: true`, `staleRevision: true`, `staleBlock: true`, `duplicate: true`, `ineligible: true`, or `setupDraftConflict: true` | State unmutated. Toast or domain refusal returned to caller. | Disk unchanged. Journal entry discarded. |
| **Draft Conflict** | `draftConflict` | `localOk: false`, `idbOk: false`, `draftConflict: true`, `effectInvalid: true`, or `closeFailed: true` | State unmutated. User notified via toast to retry draft sync. | Disk unchanged. Journal entry discarded. |
| **Transfer Frozen** | `transferFrozen` | `localOk: false`, `idbOk: false`, `conflict: true`, `transferFrozen: true`, `code: "install-transfer-frozen"` | Write aborted immediately before or under lock. | Disk unchanged. No journal entry written or journal discarded. |
| **Close Deferred** | `close-deferred` | `accepted: true`, `deferred: true`, `settled: false`, `finalizationPending: true`, `localOk: true/false`, `idbOk: true/false` | Snapshot is durable; live state adopts snapshot to prevent UI drift while journal cleanup settles. | Prepared or finalized snapshot durable on disk. Journal record cleanup pending. |
| **Settlement Deferred** | `settlement-deferred` | `accepted: true`, `deferred: true`, `settled: false`, `finalizationPending: true` | Prepared snapshot durable; live state adopts rebased snapshot. | Prepared snapshot on disk; finalization write pending. |
| **Compensated** | `compensated` | `accepted: false`, `rejected: true`, `settled: true`, `draftConflict: true`, `localOk: false`, `idbOk: false` | Rollback snapshot applied to live state and disk after downstream failure. | Disk restored to rollback state (revision `N+1`). Draft effect restored. |
| **Partial / Recovery Required** | `write-failed` / degraded | `localOk !== idbOk`, or compensation failed (`compensationPending: true`) | Write health marked degraded (`storageHealth.degraded = true`). Toast shown. | One replica updated, other replica stale. WAL or boot resolution will heal opposite replica. |
| **Fatal Storage Error** | `journalFailed` / `write-failed` | `localOk: false`, `idbOk: false`, `journalFailed: true` or quota exceeded | `storageHealth` marked failed. Assertive toast shown ("Storage full"). | Disk unchanged. |

---

## 5. Write Paths and Caller Taxonomy

```
[UI / User Action]
       │
       ▼
[commitProgramReplacement / commitProposedState / persist]
       │
       ▼
[enqueueStateChange] ─── (pre-lock checks, WAL journal write)
       │
       ▼
[withStorageLock("repforge:state-write")]
       │
       ├─► Check Transfer Freeze
       ├─► Refresh Persistence Head from disk
       ├─► Check Setup Draft Raw & Idempotency
       ├─► Preflight callback (lock-held rebase & validation)
       ├─► Check Preconditions (expectedStorageRevision, blockId, programId)
       ├─► Arm rollback snapshot in WAL
       ├─► stateSnapshotForHead & preparePendingDraftTransaction
       │
       ▼
[executeDraftTransaction]
       ├─► Pre-effect validation
       ├─► writeSnapshot(prepared, io) ──► localStorage + IndexedDB
       ├─► settleAppliedDraftTransaction ──► DraftStore sidecars
       ├─► writeSnapshot(finalized, io) ──► localStorage + IndexedDB
       └─► settlePendingDraftRecord ──► clear WAL, close markers
```

---

## 6. Extraction Plan (C1 & C2)

- **C1: Normalize One Durable Outcome Contract**
  Define `DurableOutcome` with explicit fields:
  - `status`: `"committed"` | `"already_committed"` | `"rejected"` | `"deferred"` | `"partial"` | `"failed"`
  - `committed`: boolean (true ONLY when required replicas settled)
  - `revision`: integer
  - `localOk`: boolean
  - `idbOk`: boolean
  - `conflict`: boolean
  - `deferred`: boolean
  - `code`: string (machine-readable failure reason)
  - `error`: optional exception details
  - Adapter maps this contract to legacy caller shapes without breaking backwards compatibility.

- **C2: Extract One Deep Module (`durable-state.js`)**
  Extract:
  - `storageIO`, `withStorageLock`, `writeSnapshot`, `noteWriteHealth`
  - WAL journal: `writePendingJournal`, `readPendingJournal`, `clearPendingJournal`, `armPendingJournalRollback`
  - Replicas & arbitration: `readLocalStatus`, `readIdbStatus`, `chooseSnapshot`, `resolveBootReplicas`
  - Transaction engine: `executeDraftTransaction`, `enqueueStateChange`, `commitProposedState`, `commitProgramReplacement`
  Keep pure domain logic (Plan 052 transition derivation, Plan 051 draft reducer, Plan 053 transfer client) outside this module.
