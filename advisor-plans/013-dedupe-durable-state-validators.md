# Plan 013: `app.js` stops carrying its own copies of `canonicalize` and the setup-activation marker validator, and the one intentional divergence is pinned by a test

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat ff9991cf..HEAD -- app.js durable-state.js test/durable-outcome-contract.mjs`
> Re-locate the functions by name; shifted line numbers are fine, changed bodies are a STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (textual neighbour of 003 in `durable-state.js`, and of 007, 008, 012, and 019 in `app.js`)
- **Category**: tech-debt
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: not in `docs/backlog.md`. The owner must accept it there, or approve it directly, before execution.

## Why this matters

`durable-state.js` was extracted from `app.js` to own durable writes, but three small helpers still exist in both files:

- `canonicalize`: same semantics, written twice.
- `isValidSetupActivationMarker`: textually identical, but each copy calls its own file's `isPlainStateObject`.
- `isPlainStateObject`: **already diverged**. `app.js` also requires a plain prototype (`Object.prototype` or `null`). `durable-state.js` accepts any non-array object (a `Date`, a class instance, a cross-realm object).

Two copies of a validator drift, and the divergence is invisible: which copy runs depends on which file the caller lives in. This plan deletes the two genuinely identical duplicates. It does **not** silently change `isPlainStateObject` semantics in either file, because the loose version may be deliberate (Node tests build objects in `vm` contexts, whose prototypes differ). Instead it pins both behaviors with a test and a one-line comment.

## Current state

`app.js` (at `ff9991cf`):

```js
// app.js:89-92
function isPlainStateObject(value){
  if(!value||typeof value!=="object"||Array.isArray(value))return false;
  const proto=Object.getPrototypeOf(value);
  return proto===Object.prototype||proto===null}
// app.js:417-422
function isValidSetupActivationMarker(marker){
  return isPlainStateObject(marker)&&marker.version===1&&
    typeof marker.programId==="string"&&marker.programId.length>0&&marker.programId.length<=128&&
    typeof marker.raw==="string"&&marker.raw.length>0&&marker.raw.length<=70000&&
    (!Object.prototype.hasOwnProperty.call(marker,"revision")||
      (Number.isInteger(marker.revision)&&marker.revision>=1))}
// app.js:454-460
function canonicalize(value){
  if(Array.isArray(value))return value.map(canonicalize);
  if(value&&typeof value==="object"){
    const out={};
    for(const key of Object.keys(value).sort())out[key]=canonicalize(value[key]);
    return out}
  return value}
// app.js:472
const DurableState = (typeof window !== "undefined" && window.RepForgeDurableState) || (typeof RepForgeDurableState !== "undefined" ? RepForgeDurableState : null);
```

`durable-state.js`:

```js
  // :97-99
  function isPlainStateObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }
  // :129-137
  function canonicalize(value) {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(canonicalize);
    const sorted = {};
    for (const key of Object.keys(value).sort()) sorted[key] = canonicalize(value[key]);
    return sorted;
  }
  // :2076-2081  isValidSetupActivationMarker — identical body to app.js
```

`durable-state.js`'s exported `api` (starting around line 2483) already includes `isPlainStateObject` and `canonicalize`, but **not** `isValidSetupActivationMarker`. `app.js` already delegates to `DurableState.*` in the same region (`app.js:461-462`: `function canonicalPayload(s){return DurableState.canonicalPayload(s)}`), so that is the pattern to match. `durable-state.js` loads before `app.js` (`index.html` script order), but the `DurableState` const in `app.js` is declared at line 472, so a delegating function must not run at top level before that line.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Syntax | `node tools/check-production-syntax.mjs` | exit 0 |
| Contract | `node test/durable-outcome-contract.mjs` | `PASS` |
| Lanes | `node tools/run-tests.mjs fast`, `node tools/run-tests.mjs state`, `node tools/run-tests.mjs entry` | exit 0 |
| Cache lockstep | `node test/exercise-library.mjs` | exit 0 |

## Scope

**In scope:** `app.js` (the `canonicalize` and `isValidSetupActivationMarker` bodies, plus one comment on `isPlainStateObject`); `durable-state.js` (export `isValidSetupActivationMarker`, plus one comment); `test/durable-outcome-contract.mjs` (one new block); the cache ritual files `sw.js`, `index.html`, and `test/exercise-library.mjs`.
**Out of scope:** changing either `isPlainStateObject` implementation, its 55 `app.js` call sites, and any other duplicated helper.

## Git workflow

Branch `advisor/013-dedupe-validators`; commits `refactor(durable): delegate canonicalize and activation marker to durable-state`, `test(durable): pin the plain-object divergence`, and `chore(cache): advance cached shell revision`. Do not push.

## Steps

### Step 1: Top-level-call safety check

`grep -n "canonicalize(\|isValidSetupActivationMarker(" app.js`. Confirm every call is inside a function body, not at top level before line 472.

**Verify**: a written list of call sites, all inside functions. If any is top level, STOP.

### Step 2: Export and delegate

- In `durable-state.js`'s `api` object, add `isValidSetupActivationMarker,` next to the other setup-related exports.
- In `app.js`, replace the two bodies:

```js
function isValidSetupActivationMarker(marker){return DurableState.isValidSetupActivationMarker(marker)}
function canonicalize(value){return DurableState.canonicalize(value)}
```

**Verify**: `node tools/check-production-syntax.mjs` → exit 0. `node test/durable-outcome-contract.mjs` → `PASS`.

### Step 3: Pin the divergence

Above each `isPlainStateObject`, add exactly one comment line:
- `app.js`: `// Stricter than DurableState.isPlainStateObject: also rejects non-plain prototypes. test/durable-outcome-contract.mjs pins both.`
- `durable-state.js`: `// Looser than app.js's copy: accepts any non-array object. test/durable-outcome-contract.mjs pins both.`

In `test/durable-outcome-contract.mjs`, add a block (using its `check` helper):

```js
// Fault Test G: the two isPlainStateObject copies intentionally differ; changing either must be deliberate.
check(DurableState.isPlainStateObject(new Date())===true,"DurableState.isPlainStateObject accepts non-plain prototypes");
check(DurableState.isPlainStateObject({})===true&&DurableState.isPlainStateObject([])===false,"DurableState.isPlainStateObject rejects arrays");
check(DurableState.isValidSetupActivationMarker({version:1,programId:"p",raw:"r"})===true,"activation marker validator is exported");
```

**Verify**: `node test/durable-outcome-contract.mjs` → `PASS`.

### Step 4: Cache ritual and lanes

Bump NN → NN+1 (read NN via `grep -o 'repforge-v[0-9]*' sw.js`) in `sw.js` (`CACHE` and every `?v=NN`), `index.html`, and `expectedRevision` in `test/exercise-library.mjs`.

**Verify**: `node test/exercise-library.mjs` → exit 0. `node tools/run-tests.mjs fast`, `state`, and `entry` → exit 0.

## Test plan

Fault Test G is added to the contract suite. The existing state and entry lanes (setup-link activation and persistence) prove behavior is unchanged.

## Done criteria

- [ ] `grep -c "return DurableState.canonicalize(value)" app.js` → `1`; `grep -c "return DurableState.isValidSetupActivationMarker(marker)" app.js` → `1`
- [ ] `node tools/run-tests.mjs fast`, `state`, and `entry` exit 0
- [ ] Only in-scope files changed; the `advisor-plans/README.md` row is updated

## STOP conditions

- A top-level call before `app.js:472` (Step 1).
- Any lane failure that points at setup activation or canonical hashing (`tools/check-canonical-hash-semantics.mjs` runs in fast).
- The owner asks to *unify* `isPlainStateObject` semantics. That is a separate decision with a different blast radius (55 call sites plus cross-realm Node tests).

## Maintenance notes

- Other `app.js` helpers still shadow `durable-state.js` exports (for example `snapshotsEqual`, which already delegates). When touching one, delegate rather than copy.
