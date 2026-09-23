# Plan 016: `durable-state.js` receives its draft fault-injection hook through `configureHost` instead of an `app.js` global

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat ff9991cf..HEAD -- durable-state.js app.js test/durable-outcome-contract.mjs`
> Run `grep -n "workoutDraftFault" durable-state.js app.js`; the call sites must match "Current state".

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (same file region as plan 009's harness; if 009 landed first, delete its `globalThis.workoutDraftFault` shim in Step 4)
- **Category**: tech-debt
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: aligned with the owner-ratified architecture disposition (`docs/taurifer-architecture-refactoring-plan.md`, "Owner-ratified disposition after Plan 053", R5: "Bridge establishes interface/facade"). Still needs owner acceptance as a standalone PR.

**Scope note (read first):** the audit also flagged "`app.js` keeps growing and `durable-state.js` is a host-adapter shell". That broad finding is **already governed** by the repo's architecture plan and its owner-ratified disposition (candidates A–H into the bridge and Plans 055–059, with obsolete delegates removed in 058 and "no dual authorities" verified in 059). It is **rejected as a separate plan** here. This plan fixes only the concrete leak the audit exposed.

## Why this matters

`durable-state.js` is the extracted durable-write owner. It declares its dependencies on `app.js` through an explicit host adapter (`configureHost({...})`). One dependency escapes that contract: three calls to `workoutDraftFault(point)` refer to a function that exists only as a global in `app.js`. In the browser it works by accident of script load order. In Node, any test that drives `DraftStore.compareAndSwapV2` or `removeV2` down those paths throws `ReferenceError: workoutDraftFault is not defined`, and a reader of `durable-state.js` cannot see the dependency at all. The architecture plan names this exact pattern as the problem ("Correctness depends on another file's global names").

## Current state

`durable-state.js` (at `ff9991cf`):

```js
  // :78-81
  function configureHost(next) {
    if (!next || typeof next !== "object") throw new TypeError("durable host adapter required");
    host = next;
  }
  // :177-181
  function hostFunction(name) {
    const fn = host?.[name];
    if (typeof fn !== "function") throw new Error(`durable host adapter missing ${name}`);
    return fn;
  }
  // :390   if(workoutDraftFault("before-canonical-write"))return{status:"fault-before-canonical"};
  // :397   if(workoutDraftFault("after-canonical-write"))return{status:"fault-after-canonical",raw:verify.raw,draft:parsed.draft};
  // :418   if(workoutDraftFault("before-canonical-remove"))return{status:"fault-before-canonical"};
```

`workoutDraftFault` is **not declared** anywhere in `durable-state.js`. `app.js:640-642`:

```js
function workoutDraftFault(point){
  if(window.__repforgeDraftFault!==point)return false;
  window.__repforgeDraftFault=null;return true}
```

`app.js` also calls it for its own points (for example `"persist-failure"` and `"stale-suggestion-loop"`, used by `test/focus-navigation.mjs:272` and `test/workout-draft-storage.mjs:472`). The host registration is at `app.js:16156-16174` (`DurableState.configureHost({ workoutDraft:WorkoutDraft, getLiveState:()=>state, storeDraftRecovery, … })`). Browser tests set `window.__repforgeDraftFault = "before-canonical-write"` (`test/adversarial-draft-transactions.mjs:750`, `:798`). Node harness: `test/durable-outcome-contract.mjs:25-43` calls `configureHost` with stubs.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Syntax | `node tools/check-production-syntax.mjs` | exit 0 |
| Contract | `node test/durable-outcome-contract.mjs` | `PASS` |
| Adversarial (browser) | `node tools/run-tests.mjs state --suite adversarial-draft-transactions` | exit 0 |
| Lanes | `node tools/run-tests.mjs fast` and `node tools/run-tests.mjs state` | exit 0 |
| Cache lockstep | `node test/exercise-library.mjs` | exit 0 |

## Scope

**In scope:** `durable-state.js` (one local helper, three call sites unchanged); `app.js` (one property in the `configureHost` call); `test/durable-outcome-contract.mjs` (one test block); the cache ritual files `sw.js`, `index.html`, and `test/exercise-library.mjs`.
**Out of scope:** `app.js`'s own `workoutDraftFault` function and its other call sites; any broader extraction.

## Git workflow

Branch `advisor/016-fault-hook-host`; commits `refactor(durable): take the draft fault hook from the host adapter`, `test(durable): inject draft faults through configureHost`, and `chore(cache): advance cached shell revision`. Do not push.

## Steps

### Step 1: Failing Node test

In `test/durable-outcome-contract.mjs`, add a block that:
- reconfigures the host (spread the existing config object into a new one) with `workoutDraftFault: point => point === "before-canonical-write"`;
- creates a draft raw via the file's `freezeDraftRaw()`;
- stubs `navigator.locks`, as the other blocks do;
- calls `await DurableState.DraftStore.compareAndSwapV2({ expectedRaw: null, nextRaw: raw, operationId: "fault-op" })` on empty storage;
- checks `result.status === "fault-before-canonical"` and that `localStorage.getItem(DurableState.DRAFT)` is `null`.

Restore everything in `finally`. The existing file defines its host config inline, so extract it into a `const baseHost = {...}` first and reuse it.

**Verify**: `node test/durable-outcome-contract.mjs` → fails with a `ReferenceError: workoutDraftFault is not defined`, or the check fails.

### Step 2: Declare the hook in `durable-state.js`

Directly below `hostFunction`, add:

```js
  // Optional test hook; production hosts may omit it.
  function workoutDraftFault(point) {
    const fn = host?.workoutDraftFault;
    return typeof fn === "function" && fn(point) === true;
  }
```

This local declaration shadows the global at the three existing call sites, so no call-site edit is needed.

**Verify**: `node test/durable-outcome-contract.mjs` → `PASS`.

### Step 3: Register it from `app.js`

In the `DurableState.configureHost({...})` call, add `workoutDraftFault,` after `workoutDraft:WorkoutDraft,`.

**Verify**: `node tools/check-production-syntax.mjs` → exit 0. `node tools/run-tests.mjs state --suite adversarial-draft-transactions` → exit 0. It proves the browser fault path still fires through `window.__repforgeDraftFault`.

### Step 4: Cache ritual and lanes

If plan 009's harness exists (`test/generative/model/workout-draft-store.mjs`), switch its `globalThis.workoutDraftFault` shim to the host property. Then bump NN → NN+1 (read NN via `grep -o 'repforge-v[0-9]*' sw.js`) in `sw.js` (`CACHE` and every `?v=NN`), `index.html`, and `expectedRevision` in `test/exercise-library.mjs`.

**Verify**: `node test/exercise-library.mjs`, `node tools/run-tests.mjs fast`, and `node tools/run-tests.mjs state` → exit 0.

## Test plan

The new Node block proves injection through the host and that the fault short-circuits before the canonical write. The browser adversarial suite proves the production wiring.

## Done criteria

- [ ] `grep -c "function workoutDraftFault" durable-state.js` → `1`
- [ ] `grep -c "workoutDraftFault," app.js` → at least `1`, inside the `configureHost` call
- [ ] `node tools/run-tests.mjs fast` and `state` exit 0
- [ ] Only in-scope files changed; the `advisor-plans/README.md` row is updated

## STOP conditions

- `durable-state.js` has gained other undeclared `app.js` globals since planning. Run the crude check below; if it prints more than `workoutDraftFault`, report the list.

```sh
node -e 'const s=require("fs").readFileSync("durable-state.js","utf8");const c=new Set([...s.matchAll(/(?<![\w.$])([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]));const d=new Set([...s.matchAll(/(?:function\s+|const\s+|let\s+|var\s+)([A-Za-z_$][\w$]*)/g)].map(m=>m[1]));console.log([...c].filter(x=>!d.has(x)).join(" "))'
```

  Expect method names such as `readRaw` or `stage` as false positives; look for plain function globals.
- The adversarial suite fails after Step 3.

## Maintenance notes

- Any new cross-file dependency of `durable-state.js` belongs in the host adapter, not as a free identifier.
