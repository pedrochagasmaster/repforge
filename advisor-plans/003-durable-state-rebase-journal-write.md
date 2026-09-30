# Plan 003: A failed crash-journal update during a lock-held rebase aborts the write instead of being swallowed

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat ff9991cf..HEAD -- durable-state.js test/durable-outcome-contract.mjs`
> If either file changed, compare the "Current state" excerpts against the
> live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (data integrity)
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: **Now**: the "Alpha data-safety fixes" row, item (1), first in order; standalone PR (Q604, Q609).
- **Execution:** DONE — preserve the original red→green history on PR #271: D4 failed against its historical `29fc1c36180abec3ff1839e4889f6d44a39fa6dc` base, where both replicas advanced from revision 7 to 8, then passed with the bounded fix. Revalidated after #269 against `origin/main` `03f23ff91e208c8c59d3a33cfb5798f4f7d39050` and integrated by merge commit `7e1b70f2`. Current main still had the audited empty catch; `enqueueStateChange`, journal ownership, and caller ownership remain compatible. The live cache/query baseline was `repforge-v340`, `durable-state.js?v=307` (other transition URLs were independently at v307 and `app.js` at v309); the integrated branch advances once to `repforge-v341` and only `durable-state.js?v=308`.

  The first independent review of integrated head `53d865554edf17ee9d183ebd28a62d025acf73fd` found two real cleanup blockers. R271-01: a successful rebase `setItem` followed by a failed readback left the new WAL while cleanup compared only the old bytes. R271-02: `journalFailed` outranked `pendingJournalCleanup`, reporting a retained replayable WAL as a settled failure. Both were corrected in implementation commit `ae9e5304689f2ea6a5439c6106e91a5ed379bc2b`: on an unverified rewrite, remove only the exact old/attempted bytes when still owned and verified; otherwise expose recovery-pending state. A WAL cleanup failure now normalizes to `deferred_pending`, while a fully cleaned journal failure remains `rejected_failure`. New D5 exercises a one-shot readback exception through `enqueueStateChange` and boot, proving revision 7 survives; D6 injects both rewrite and cleanup failures; D7 and D8 cover successful rebase commit and ordinary preflight rejection. D4 still faults pending write attempt 2 and proves neither canonical replica advances.

  The production change remains limited to ordinary rebased WAL writes; immutable `customMutationIntent` journals stay on their separate path. The production custom-mutation recovery suite passed. At implementation commit `ae9e5304`, the durable outcome contract, production syntax, cache/query lockstep (`repforge-v341` / `durable-state.js?v=308`), selector contract, canonical contradiction checker, and whitespace checks passed. Local browser failures remain recorded without retries: `program-transition-commit` hit a Chromium target crash at 600 seconds; `program-transition-crash-replay` failed its 15-second sibling-page boot gate; `custom-delete-editor-race` reached its final boot timeout after the Delete and recovery assertions had passed. The exact final PR head, candidate result, and fresh independent review are in the live PR #271 body. This change does not address #280 A01's distinct DraftV2 staged-write race.

## Post-#269 correction review

| ID | Finding | Closing evidence at implementation commit `ae9e5304` |
|---|---|---|
| R271-01 | A readback exception after a successful rebase write could leave that unacknowledged WAL for boot replay while returning failure. | D5 failed before the correction and passes after it. It injects the readback exception after WAL set attempt 2, verifies both replicas stay at revision 7, confirms the journal is removed, and calls the production boot resolver to prove revision 7 is not replayed. If exact cleanup cannot be verified, the outcome remains recovery-pending. |
| R271-02 | `journalFailed` could override failed WAL cleanup and report a replayable record as `rejected_failure`. | D6 failed before the correction and passes after it. It injects a rebase-write failure plus WAL-removal failure, verifies both replicas remain at revision 7, and requires `deferred_pending` with `recoveryPending:true`. A fully cleaned journal failure remains `rejected_failure`. |

The final exact-head review and candidate gate are recorded in PR #271 because their head SHA is determined after this plan's evidence update.

## Why this matters

Taurifer keeps a lifter's only copy of their training data in `localStorage` and IndexedDB, and there is no server backup. Every state write first records a write-ahead journal (WAL) entry under `repforge_pending_v1:<id>`. If the tab dies mid-write, boot replays the journal's `proposal`.

Some writes pass a `preflight` callback, used for program-editor and block-transition commits. While the cross-tab lock is held, that callback may **rebase** the proposal onto a newer head. The code then rewrites the journal so that crash recovery replays the rebased proposal. That rewrite sits inside `try{…}catch{}` with an empty catch. If `localStorage.setItem` throws (for example `QuotaExceededError`, which this file already treats as a real failure elsewhere), the error is silently ignored. The write then proceeds with the rebased proposal while the on-disk journal still holds the stale one. A crash before cleanup replays the stale proposal, which is exactly what the rebase existed to prevent. Every other journal-write failure in this function aborts the transaction with `journalFailed:true`. This one should too.

## Current state

`durable-state.js`: the durable write engine (IIFE, global `RepForgeDurableState`; also loadable in Node via `import DurableState from "../durable-state.js"`).

The swallowed write (`durable-state.js:1625-1643` at `ff9991cf`):

```js
      if(typeof preflight==="function"){
        const checked=await preflight({head:cloneSnapshot(head),proposal:cloneSnapshot(workingProposal)});
        if(io===storageIO&&installTransferMutationFrozen())return cancelUnstarted();
        if(checked?.proposal){
          workingProposal=cloneSnapshot(checked.proposal);
          // Keep crash recovery pointed at the proposal that survived the
          // lock-held semantic rebase, not the stale copy written before it.
          if(pendingRecord){
            try{
              const journal=JSON.parse(pendingRecord.raw);
              journal.proposal=unversionedSnapshot(workingProposal);
              const raw=JSON.stringify(journal);
              localStorage.setItem(pendingRecord.key,raw);
              pendingRecord=decodePendingJournal(pendingRecord.key,raw)||pendingRecord;
            }catch{}
          }
        }
        if(checked?.reject){
          return discardPending(Object.assign(
            {revision:readRevision(head),localOk:false,idbOk:false},checked.result||{conflict:true}))}}
```

The established pattern for "journal write failed → abort" is in the same function (`durable-state.js:1655-1661`):

```js
      if(pendingRecord&&(draftEffectRequiresCoordination(frozenEffectOutcome)||recoveryTransaction)){
        const armed=armPendingJournalRollback(pendingRecord,head,{forceRollback:recoveryTransaction});
        if(!armed){
          return discardPending({revision:readRevision(head),localOk:false,idbOk:false,
            draftConflict:true,journalFailed:true})}
        pendingRecord=armed}
```

`armPendingJournalRollback` (`durable-state.js:1382-1395`) first confirms that storage still holds the record it expects (`if(localStorage.getItem(record.key)!==record.raw)return null;`). On any throw it runs `console.warn("pending rollback journal failed",e);return null`.

`normalizeDurableOutcome` (`durable-state.js:~820-860`) maps `journalFailed:true` to `status:"failed"`, `kind:"rejected_failure"`, `committed:false`. Boot replay reads `journal.proposal` (`durable-state.js:1314`, `1400`).

Test pattern: `test/durable-outcome-contract.mjs`, a pure Node suite in the `fast` lane. Copy "Fault Test D3" (starts at line 578). It seeds `mockLocalStorage` plus an in-memory IndexedDB, stubs `navigator.locks`, monkey-patches `mockLocalStorage.removeItem` to throw for `repforge_pending_v1:` keys, calls `DurableState.enqueueStateChange(base, proposal, DurableState.storageIO, { preflight })`, checks results with `check(cond, message, detail)`, and restores everything in `finally`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Syntax | `node --check durable-state.js && node tools/check-production-syntax.mjs` | exit 0 |
| Contract suite | `node test/durable-outcome-contract.mjs` | ends with `PASS: all durable outcome contract tests passed` |
| Cache lockstep | `node test/exercise-library.mjs` | exit 0 |
| Fast lane | `node tools/run-tests.mjs fast` | exit 0 |
| State lane (browser) | `(cd test && npm ci && npx playwright install --with-deps --only-shell chromium)` once, then `node tools/run-tests.mjs state` | exit 0 |

## Scope

**In scope:**
- `durable-state.js` (only the block quoted above)
- `test/durable-outcome-contract.mjs` (add Fault Test D4)
- Cache-revision ritual files: `sw.js`, `index.html`, `test/exercise-library.mjs` (revision numbers only)

**Out of scope:**
- Every other empty `catch{}` in `durable-state.js` (lines ~439, 480, 574, 1195, 1272, 1353). They are best-effort key enumeration and degrade safely.
- `armPendingJournalRollback`, `writePendingJournal`, boot replay.
- `app.js` callers of `preflight`.

## Git workflow

- Branch: `advisor/003-rebase-journal-write`
- Commits: `test(durable): prove a failed rebase-journal write aborts`, then `fix(durable): abort when the rebased WAL proposal cannot be persisted`, then `chore(cache): advance cached shell revision` (the repo's existing wording).
- Do not push.

## Steps

### Step 1: Add the failing test (Fault Test D4)

After Fault Test D3 in `test/durable-outcome-contract.mjs`, add a block that:

1. Uses `mockLocalStorage.clear()` and the same `base` shape as D3 with `_storageRevision:7`. Seed both replicas the way D3 does (the same `idbValues`/`database`/`indexedDB`/`navigator` stubs).
2. Defines `proposal={...base,settings:{units:"lb"}}` and `rebased={...base,settings:{units:"lb",lang:"pt"}}`.
3. Monkey-patches `mockLocalStorage.setItem` with a **one-shot** failure. It keeps `let failNextPending=false;` and when `failNextPending && key.startsWith("repforge_pending_v1:")`, it sets `failNextPending=false` and throws `Object.assign(new Error("injected quota"),{name:"QuotaExceededError"})`. Otherwise it delegates to the original.
4. Calls `enqueueStateChange(base, proposal, DurableState.storageIO, { preflight: () => { failNextPending = true; return { proposal: rebased }; } })`.
5. Checks:
   - `outcome.committed===false && outcome.kind==="rejected_failure"` — message: `"Failed rebase-journal write aborts the transaction"`
   - `JSON.parse(mockLocalStorage.getItem("repforge_v1"))._storageRevision===7 && idbValues.get("repforge_v1")._storageRevision===7` — message: `"Neither replica is written after the rebase-journal failure"`
6. Restores `setItem`, `indexedDB`, and `navigator`, and calls `DurableState.clearAllPendingJournal()` in `finally`, exactly as D3 does.

**Verify**: `node test/durable-outcome-contract.mjs` → exits 1 with `FAILED: … test(s) failed`, and the failing messages are the two D4 messages. Current code swallows the error and commits revision 8.

### Step 2: Make the failure abort

Replace the `try{…}catch{}` block with:

```js
          if(pendingRecord){
            let rebasedRecord=null;
            try{
              if(localStorage.getItem(pendingRecord.key)===pendingRecord.raw){
                const journal=JSON.parse(pendingRecord.raw);
                journal.proposal=unversionedSnapshot(workingProposal);
                const raw=JSON.stringify(journal);
                localStorage.setItem(pendingRecord.key,raw);
                if(localStorage.getItem(pendingRecord.key)===raw)
                  rebasedRecord=decodePendingJournal(pendingRecord.key,raw);
              }
            }catch(e){console.warn("pending rebase journal failed",e)}
            if(!rebasedRecord){
              return discardPending({revision:readRevision(head),localOk:false,idbOk:false,
                journalFailed:true})}
            pendingRecord=rebasedRecord;
          }
```

Keep the existing comment above it. Keep the file's compact style: no spaces around operators, `{…}` blocks on the same line where the file does so.

**Verify**: `node --check durable-state.js` → exit 0. `node test/durable-outcome-contract.mjs` → `PASS: all durable outcome contract tests passed`.

### Step 3: Cache ritual (`durable-state.js` is precached with `?v=`)

Run `grep -o 'repforge-v[0-9]*' sw.js` to get the live number NN. Replace `repforge-vNN` with `repforge-v(NN+1)` in `sw.js`, and every `?v=NN` with `?v=(NN+1)` in both `sw.js` and `index.html`. Set `const expectedRevision = "(NN+1)";` in `test/exercise-library.mjs`.

**Verify**: `node test/exercise-library.mjs` → exit 0. `grep -c "?v=NN\"" index.html sw.js` (with the old NN) → `0` for both.

### Step 4: Broader regression

**Verify**: `node tools/run-tests.mjs fast` → exit 0. `node tools/run-tests.mjs state` → exit 0 (it covers persistence, draft transactions, and program-transition crash replay).

## Test plan

- New Fault Test D4 in `test/durable-outcome-contract.mjs`: a one-shot `QuotaExceededError` on the rebase-journal write gives `rejected_failure`, and both replicas stay at the base revision.
- The existing D3 (reject path) and all browser `state` suites stay green. They exercise the success path of the same block (`test/program-transition-crash-replay.mjs`, `test/program-draft-day-rename.mjs`).

## Done criteria

- [ ] `grep -c "pending rebase journal failed" durable-state.js` → `1`, and `grep -A2 "journal.proposal=unversionedSnapshot(workingProposal)" durable-state.js | grep -c "catch{}"` → `0`
- [ ] `node test/durable-outcome-contract.mjs` prints `PASS`
- [ ] `node tools/run-tests.mjs fast` and `node tools/run-tests.mjs state` exit 0
- [ ] `node test/exercise-library.mjs` exits 0
- [ ] `git diff --stat` touches only `durable-state.js`, `test/durable-outcome-contract.mjs`, `sw.js`, `index.html`, and `test/exercise-library.mjs`
- [ ] The `advisor-plans/README.md` row is updated

## STOP conditions

- The excerpt no longer matches. For example, the block was already changed, or `discardPending` no longer exists in scope.
- A `state`-lane suite fails because a legitimate caller relies on the rebase succeeding even when the journal write fails. Report the suite and case; do not weaken the check.
- `normalizeDurableOutcome` no longer maps `journalFailed` to `rejected_failure`.

## Maintenance notes

- Callers of `preflight` in `app.js` (`app.js:3463-3470`, `7712`, `8032`) already handle `rejected_failure` outcomes from the first journal write, so no caller change is expected. A reviewer should confirm that the program editor shows its normal save-failure UI in this case.
- If journal writes are ever centralized into one helper, fold this block into it.
