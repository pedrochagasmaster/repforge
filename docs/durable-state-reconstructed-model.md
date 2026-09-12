# Reconstructed Live Durable Model and Result-State Contract

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
| **Committed** | `kind: "committed"` | `status: "committed"`, both replica flags true, `accepted: true`, `committed: true`, `settled: true` | Live state rebased and adopted; `persistHead` advanced. | Both replicas contain revision `N`. Journal cleared. |
| **Already Committed** | `kind: "already_committed"` | The durable receipt proves an idempotent predecessor; `accepted`, `committed`, and `settled` are true. | No duplicate activation, session, or archive is created. | Existing revision remains authoritative. Pending journal entry is discarded. |
| **Rejected Conflict** | `kind: "rejected_conflict"` | `status: "rejected"`; includes stale revision/block, draft conflict, setup-draft conflict, ineligibility, and transfer freeze. | State remains unmutated. The caller chooses the domain refusal or UI consequence. | Rejected proposal does not become the durable head. Its journal is discarded before the outcome settles. |
| **Deferred Pending** | `kind: "deferred_pending"` | `status: "deferred"` for explicit finalization/compensation work, or `status: "partial"` for an unaccepted one-replica write; `committed: false`, `settled: false`. | An explicitly accepted prepared snapshot may be adopted, but no caller may relabel it as fully committed. | WAL, transaction marker, or replica repair remains authoritative. |
| **Degraded Committed** | `kind: "degraded_committed"` | The workflow explicitly permits one-replica acceptance: `accepted: true`, `committed: false`, `status: "partial"`, `recoveryPending: true`. | The host may complete that workflow while displaying degraded storage health. | One replica has the accepted revision; boot or a later write heals the peer. |
| **Rejected Failure** | `kind: "rejected_failure"` | Both replica flags are false, `status: "failed"`, `accepted: false`, `committed: false`; includes journal failure and total write failure. | Live state and the actionable workflow input remain unchanged. The host presents the existing destructive persistence failure. | Rejected proposal is not retained as the durable head. |

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

## 6. Extracted Module and Compatibility Seam

- `durable-state.js` returns one `DurableOutcome` with explicit fields:
  - `status`: `"committed"` | `"already_committed"` | `"rejected"` | `"deferred"` | `"partial"` | `"failed"`
  - `kind`: `"committed"` | `"already_committed"` | `"rejected_conflict"` | `"rejected_failure"` | `"deferred_pending"` | `"degraded_committed"`
  - `accepted`: whether the workflow may acknowledge the result
  - `committed`: boolean (true ONLY when required replicas settled)
  - `settled`: whether replica, draft-effect, and journal cleanup work is complete
  - `revision`: integer
  - `localOk`: boolean
  - `idbOk`: boolean
  - `conflict`: boolean
  - `deferred`: boolean
  - `code`: string (machine-readable failure reason)
  - `error`: optional exception details
  - `recoveryPending`: whether replica repair or deferred settlement remains

- `durable-state.js` owns:
  - `storageIO`, `withStorageLock`, `writeSnapshot`, `noteWriteHealth`
  - primary-replica clearing and guarded IndexedDB access for auxiliary install-transfer markers
  - WAL journal: `writePendingJournal`, `readPendingJournal`, `clearPendingJournal`, `armPendingJournalRollback`
  - Replicas & arbitration: `readLocalStatus`, `readIdbStatus`, `chooseSnapshot`, `resolveBootReplicas`
  - DraftV2 storage: checkpoint CAS, boot reconciliation, tombstones, transaction sidecars, promotion, and compensation
  - Transaction engine: `executeDraftTransaction`, `enqueueStateChange`

- `app.js` supplies a host adapter for state rebasing, recovery-carrier validation, the pure WorkoutDraft parser, live-state access, setup-draft observation, recovery retention, and accepted-snapshot adoption. The durable module owns DraftV2 storage ordering. Toasts and other presentation effects stay in `app.js`; one module health event produces one host notification.

- Workout finish and program activation complete their presentation workflows only when the durable outcome is both `committed` and `settled`. A one-replica acceptance, deferred DraftV2 finalization, or pending journal cleanup keeps the current input/review surface available for recovery even when the accepted snapshot is already present in a durable replica.

- A lock-held rejection or failed transaction is settled only after its proposal journal is gone. If cleanup fails, the outcome remains `deferred_pending` because boot may still observe the journal. Closing-marker creation failure follows the same rule. Retry and boot settle closing markers and sidecars only when neither a WAL record nor `_storageDraftTransaction` still owns their transaction. A failed ownerless-sidecar promotion remains discoverable and is retried before boot reports settlement.

- The durable owner checks the install-transfer freeze again after each awaited refresh or preflight, immediately before transaction execution, and between the local and IndexedDB writes. If the local write lands before a freeze begins, the IndexedDB write does not start and the partial transaction remains deferred for recovery. If a freeze starts after WAL publication, the owner clears an unstarted journal only when no DraftV2 sidecar depends on that journal. A dependent journal remains deferred so boot can reject or replay the state proposal and promote the staged draft after the freeze ends.

- The compatibility facade in `app.js` retains the old internal function names for existing callers and test hooks. Each facade method delegates to `durable-state.js`; it contains no WAL, lock, replica, settlement, or boot-replay implementation. Remove a facade method only when its last existing caller moves in a separately authorized plan. A fallback release is a code revert: it reads the same keys, revisions, journals, DraftV2 records, and setup receipts because this extraction changes no durable format.
