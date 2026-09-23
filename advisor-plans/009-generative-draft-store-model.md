# Plan 009: A fast-check model searches DraftV2 storage command sequences, with injected faults, for lost or phantom workouts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat ff9991cf..HEAD -- durable-state.js workout-draft.js test/generative test/durable-outcome-contract.mjs`
> If `DraftStore.compareAndSwapV2`, `DraftStore.removeV2`, or
> `reconcileV2Checkpoint` changed, re-read them before writing the model.

## Status

- **Priority**: P2
- **Effort**: L (first slice: the draft store only)
- **Risk**: LOW (test-only)
- **Depends on**: plan 003 is recommended first (it touches the same engine; no textual conflict)
- **Category**: tests
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: **Next**: §2 "DraftV2 store model search"; start after advisor plan 003 lands (Q612).

## Why this matters

An in-progress workout (a "DraftV2") lives in `localStorage` under `repforge_draft_v1` and is acknowledged by a checkpoint under `repforge_draft_v1:v2-checkpoint`. The protocol that keeps them consistent (compare-and-swap, pending/committed/tombstone checkpoints, and boot reconciliation) is the code most likely to lose a lifter's session if it has a hole. It has good hand-written fault tests. This repo's own history, though, shows that generated command sequences find bugs hand-written tests miss: `test/generative/regressions/program-entry-preview-invalidation.md` records one found by the `program-entry` model. `test/generative/README.md` still lists "workout draft lifecycle" as a pending seam "embedded in `app.js`". It has since been extracted, and the storage owner (`DraftStore`, in `durable-state.js`) is now loadable in Node, so the blocker is gone.

## Current state

- `durable-state.js` — exports (`api`, around line 2483): `DraftStore`, `v2CheckpointRecord`, `reconcileV2Checkpoint`, `configureHost`, `setMutationFreezeCheck`, `DRAFT`, `DRAFT_V2_CHECKPOINT`, `STORAGE_LOCK`, …
  - `DraftStore.compareAndSwapV2({expectedRaw,expectedDraftId,expectedRevision,nextRaw,operationId})` (around line 325). It returns `{status:"applied"|"stale"|"invalid-next"|"checkpoint-*"|"write-failed"|"fault-before-canonical"|"fault-after-canonical"|…}`. It writes the checkpoint `pending` → canonical → checkpoint `committed`.
  - `DraftStore.removeV2({expectedDraftId,expectedRevision,operationId})` (around line 402).
  - `DraftStore.readCanonicalStatus()` → `{status:"ok",raw}`; `DraftStore.readV2Checkpoint()` → `{status:"absent"|"valid"|"invalid"|"read-failed",…}`.
  - `reconcileV2Checkpoint(read,label)` (around line 214) is boot-time repair. It uses host callbacks such as `currentStateSnapshot()` and `retainDraftRecovery()`.
  - **Hidden global**: `durable-state.js:390,397,418` call `workoutDraftFault(point)`, which is *not defined in `durable-state.js`*. In the browser it resolves to `app.js:640` (`function workoutDraftFault(point){if(window.__repforgeDraftFault!==point)return false;window.__repforgeDraftFault=null;return true}`). In Node you must define `globalThis.workoutDraftFault`. This is also your fault-injection hook, with points `"before-canonical-write"`, `"after-canonical-write"`, and `"before-canonical-remove"`.
- `workout-draft.js` — pure reducer (`module.exports` in Node): `create(input, options, …)`, `reduce(draft, command)`, `parse(raw)` → `{kind:"valid"|"absent"|"legacy"|…, draft}`, `serialize`, `isDomainError`.
- Harness to copy:
  - `test/durable-outcome-contract.mjs:20-43`: `import DurableState from "../durable-state.js"`, `require("../workout-draft.js")`, and `DurableState.configureHost({...})` with minimal host callbacks.
  - `:319-332`: the `mockLocalStorage` Map-backed mock, installed as `globalThis.localStorage`.
  - `:494`: the stub `navigator.locks.request=async(_n,cb)=>cb()` (via `Object.defineProperty(globalThis,"navigator",…)`).
  - `:48-87`: `freezeDraftRaw()`, a complete `WorkoutDraft.create(...)` example.
  - `test/workout-draft.mjs:99-117`: `command(draft,type,values)` / `apply(...)` helpers for producing successor drafts via `Draft.reduce`.
- Generative suite: `test/generative/run.mjs:15-18` `SUITE_FILES` lists property modules. `test/generative/self-test.mjs` fails if a file in `properties/` is not listed. Each module exports `buildSuites()` → `[{ name, property }]`, and async properties are allowed (`fc.asyncProperty`, see `properties/identity.mjs:42`). The pattern to follow for a command model is `test/generative/properties/program-entry.mjs` with `test/generative/model/program-entry.mjs`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install test deps | `(cd test && npm ci)` | exit 0 |
| New property only | `node test/generative/run.mjs --filter "draft store"` | all properties pass |
| Deep run | `node test/generative/run.mjs --profile deep --filter "draft store"` | pass |
| Replay | `node test/generative/run.mjs --seed <s> --filter "draft store"` | reproduces |
| Self-test | `node --test test/generative/self-test.mjs` | pass |
| Fast lane | `node tools/run-tests.mjs fast` | exit 0 |

## Scope

**In scope (create or modify):**
- `test/generative/model/workout-draft-store.mjs` (create) — the harness and model runner
- `test/generative/properties/workout-draft-store.mjs` (create) — arbitraries and `buildSuites()`
- `test/generative/run.mjs` — append `"workout-draft-store"` to `SUITE_FILES`
- `test/generative/README.md` — move "workout draft lifecycle" from "Pending seams" to the covered list, and note the hidden `workoutDraftFault` global
- `test/generative/regressions/` — only if a counterexample is found (see Step 5)

**Out of scope:** any production file. If the model finds a bug, **report it; do not fix it here**. The WAL/state journal (`enqueueStateChange`) and `install-transfer-contract.js` get later slices.

## Git workflow

Branch `advisor/009-draft-store-model`; commits `test(generative): model DraftV2 store commands with faults`, and `docs(generative): record draft store seam`. Do not push.

## Steps

### Step 1: Harness module

In `test/generative/model/workout-draft-store.mjs`, export `createHarness()`, which:
- installs a fresh Map-backed `globalThis.localStorage` whose `setItem` consults a one-shot `failNext: {keyPrefix}|null` and throws `QuotaExceededError` when it matches;
- installs `navigator.locks.request=async(_n,cb)=>cb()`;
- defines `globalThis.workoutDraftFault=point=>{if(h.faultPoint!==point)return false;h.faultPoint=null;return true}`;
- calls `DurableState.configureHost({...})`, copying `test/durable-outcome-contract.mjs:25-43`, and adds any host callbacks `reconcileV2Checkpoint` needs, such as a `currentStateSnapshot`/live-state getter returning `{program:[],log:[]}` and a `retainDraftRecovery` stub that records calls. To find the exact names, grep `durable-state.js` for `hostFunction("`;
- returns `{DurableState, Draft, storage, reset()}`.

**Verify**: a scratch call `node -e` that imports the harness, creates a draft with `Draft.create` (copy `freezeDraftRaw`), runs `compareAndSwapV2({expectedRaw:null,nextRaw,operationId:"op1"})`, and prints `applied`. Delete the scratch afterwards.

### Step 2: Command model

In the same module, export `async function runDraftStoreJourney(h, actions)`. The model state is `{ack: raw|null, candidates: Set<raw>}`, where `ack` is the last acknowledged canonical and `candidates` holds raws of operations whose outcome is unknown because of a fault. Actions:

| action | effect | model update |
|---|---|---|
| `{type:"save"}` | build a successor of the current canonical draft with `Draft.reduce` (use the first command type `test/workout-draft.mjs` applies successfully), or `Draft.create` if absent; call `compareAndSwapV2` with the correct expectation | `applied` → `ack=raw, candidates.clear()`; any fault/failed status → `candidates.add(raw)` |
| `{type:"staleSave"}` | same, but `expectedRevision - 1` | must return `stale` (or `missing`), and canonical is unchanged |
| `{type:"remove"}` | `removeV2` with the correct expectation | `applied`/ok → `ack=null`; fault → `candidates.add(null)` |
| `{type:"fault", point}` | set `h.faultPoint` (one of the three points) | — |
| `{type:"quota", keyPrefix}` | `failNext` = `"repforge_draft_v1"` or the checkpoint key | — |
| `{type:"reboot"}` | `await DurableState.reconcileV2Checkpoint(DurableState.DraftStore.readCanonicalStatus(),"model")` | afterwards `ack` = current canonical (if allowed), `candidates.clear()` |

Invariants, checked with `assert` after **every** action:
- **I1**: the canonical raw is `null` or `Draft.parse(raw).kind==="valid"`.
- **I2**: `readV2Checkpoint().status` ∈ `{"absent","valid"}`.
- **I3** (after `reboot`): the canonical raw ∈ `{ack} ∪ candidates`. A reboot never produces a draft that was never proposed, and never drops an acknowledged one unless a removal was in flight.
- **I4**: `staleSave` never changes the canonical raw.

**Verify**: a scratch run with a fixed short action list passes.

### Step 3: Property module

Create `test/generative/properties/workout-draft-store.mjs`, modelled on `properties/program-entry.mjs`. Use a weighted `fc.oneof` over the actions (save 5, staleSave 1, remove 1, fault 2, quota 2, reboot 2) and `fc.array(action,{minLength:1,maxLength:40})`. Export `buildSuites()` → `[{ name: "workout draft store: generated saves, removals, faults and reboots never lose or invent a draft", property: fc.asyncProperty(actions, async a => { const h=createHarness(); await runDraftStoreJourney(h,a); }) }]`. Append `"workout-draft-store"` to `SUITE_FILES`.

**Verify**: `node --test test/generative/self-test.mjs` → pass. `node test/generative/run.mjs --filter "draft store"` → pass.

### Step 4: Deep run

**Verify**: `node test/generative/run.mjs --profile deep --filter "draft store"` → pass, or a counterexample (go to Step 5).

### Step 5: If a counterexample appears

Do **not** fix production code. Shrink it (fast-check prints the minimal path and seed). Add a skipped-until-fixed regression file under `test/generative/regressions/` following `regressions/README.md`, and report the seed, the path, and which invariant broke. That is a successful outcome of this plan.

**Verify**: the regression file exists, and the report contains the seed.

### Step 6: Docs and fast lane

Update `test/generative/README.md` as scoped. **Verify**: `node tools/run-tests.mjs fast` → exit 0 (unless Step 5 found a real bug, in which case the new property must be marked in the way `regressions/README.md` prescribes, so that CI stays meaningful).

## Test plan

This plan *is* the test. Negative control: temporarily change I4 to also compare against a stale raw, or temporarily make the harness's `compareAndSwapV2` wrapper skip the call, and confirm the property fails. Then revert.

## Done criteria

- [ ] Both new files exist; `SUITE_FILES` includes `"workout-draft-store"`
- [ ] `node --test test/generative/self-test.mjs` passes
- [ ] `node test/generative/run.mjs --profile ci` passes (or a documented regression exists, per Step 5)
- [ ] No production file changed (`git diff --stat -- '*.js' ':!test/**'` is empty)
- [ ] The `advisor-plans/README.md` row is updated

## STOP conditions

- `reconcileV2Checkpoint` requires a host callback that cannot be stubbed without reproducing `app.js` logic. Report which one.
- `Draft.reduce` needs inputs that cannot be derived from `test/workout-draft.mjs` examples.
- The model disagrees with documented behavior in `AGENTS.md` (the DraftV2 paragraph) in a way that looks like a spec question rather than a bug. Report it with the path.

## Maintenance notes

- The hidden `workoutDraftFault` global is a layering leak. `durable-state.js` depends on an `app.js` function. A follow-up could route it through `configureHost` (see plan 016).
- Next slices: `enqueueStateChange` WAL replay (state journal), then the `install-transfer-contract.js` claim/commit envelope.
