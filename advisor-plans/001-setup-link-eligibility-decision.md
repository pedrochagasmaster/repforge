# Plan 001: Activating a new program on an un-onboarded device archives the program already there instead of discarding it

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 76a31602..HEAD -- app.js test/shared-setup-flow.mjs`
> Then re-locate `function hasArchivableProgram(` in `app.js` and compare it with
> the excerpt below. A changed body is a STOP; a shifted line number is fine.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (touches the archive boundary every entry route passes through)
- **Depends on**: none. Backlog order: after advisor plan 003, before 002.
- **Category**: bug (data integrity)
- **Planned at**: commit `76a31602`, 2026-09-23 (originally `ff9991cf`; rewritten after owner decision Q607)
- **Backlog**: **Now**, the "Alpha data-safety fixes" row, item (2). Owner decisions Q604 (standalone PR allowed during the overhaul), Q607 (archive, don't refuse), Q609 (order), and Q619 (no special marking).

## Why this matters

A program can exist on a device whose `programMeta.onboarded` flag is unset. `AGENTS.md:13` says so explicitly: "a restored backup or migrated legacy snapshot can carry a real program with the flag unset". If that device has no log rows and no archived history, activating a new program **replaces the old one without archiving it**. That happens through a setup link or through any other entry route (Recommend, Custom, Import, and so on). The lifter's program is gone.

The cause is the archive guard. It treats a program as worth archiving only when it is onboarded, has log rows, or has history. The owner decided (Q607) that **any program content is archivable**. Fix it at that one boundary so every route is covered. ADR 0007's setup-link eligibility stays unchanged. The rescued program is archived like any other, with no special marking (Q619).

## Current state

`app.js` at `76a31602`:

```js
// app.js:3121-3126
function hasArchivableProgram(snapshot){
  const meta=snapshot?.programMeta;
  const hasDefinition=(Array.isArray(snapshot?.program)&&snapshot.program.length>0)||structureDayLabels(meta);
  if(!meta||!hasDefinition)return false;
  return meta.onboarded===true||Array.isArray(snapshot?.log)&&snapshot.log.length>0||
    Array.isArray(snapshot?.programHistory)&&snapshot.programHistory.length>0}
```

Its only callers are the replacement-capture helpers:
- `captureProgramReplacementIntent` (`app.js:3127-3132`): `if(!hasArchivableProgram(snapshot))return null;`
- `materializeProgramReplacementCapture` (`app.js:3133-…`): `if(!intent?.oldProgramId||!hasArchivableProgram(snapshot))return null;`

Those feed `captureProgramReplacement(state)`, which entry activation uses (`app.js:8014`, `14555`), and `archiveCapturedProgram(proposal,cap)` (`app.js:3146-3150`), which appends the old program to `programHistory`.

Related, and **not** to be changed:
- `app.js:12628` `hasActiveProgram()` (requires `onboarded`) chooses the activation label ("Archive current program and use this one" vs first-program wording). Q607 does not change the labels.
- `app.js:12632` `hasProgramContent()` (program length or structure) is the Today/Program empty-state check.
- The setup-link gate `sharedSetupEligible=()=>firstRunPending()&&!(state.programHistory?.length)` (around `app.js:14901`). ADR 0007 is unchanged.

Test conventions (`test/shared-setup-flow.mjs`, lane `entry`):
- `configuredState(overrides)` (line 205) includes a default program `prog-existing` / "Existing split".
- `firstRunEligibleState(customs, settings)` (line 445) is that same state with `onboarded:false`, empty log, and empty history. **This is exactly the at-risk shape.**
- The case `"Configured state and archived history refuse replacement"` (near line 1920) is the pattern to copy: `clearSite`, `persistState`, `reload`, `dismissGates`, `encodeSharedPayload`, navigate to `#setup=…`, then `readDurableState` before and after.
- `clickSharedStart(page, { activate: true })` (line 427) drives Start and activation.
- `runCase(name, fn)` (line 632); `node test/shared-setup-flow.mjs "<substring>"` runs matching cases (`ONLY`, line 30).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| One-time setup | `(cd test && npm ci && npx playwright install --with-deps --only-shell chromium)` | exit 0 |
| Syntax | `node tools/check-production-syntax.mjs` | exit 0 |
| Focused case | `node tools/run-tests.mjs entry --suite shared-setup-flow --verbose` | new case PASS |
| Entry lane | `node tools/run-tests.mjs entry` | exit 0 |
| State lane | `node tools/run-tests.mjs state` | exit 0 |
| Cache lockstep | `node test/exercise-library.mjs` | exit 0 |

## Scope

**In scope:** `app.js` (`hasArchivableProgram` only); `test/shared-setup-flow.mjs` (one new case); the cache ritual files `sw.js`, `index.html`, and `test/exercise-library.mjs`.

**Out of scope:** `sharedSetupEligible`, `firstRunPending`, `hasActiveProgram`, `hasProgramContent`, activation labels and copy, `archiveCapturedProgram`, ADR 0007, and `shared-setup.js`.

## Git workflow

Branch `advisor/001-archive-unonboarded-program`. Commits: `test(entry): prove an un-onboarded program is archived on activation`, `fix(entry): archive any existing program content on activation`, and `chore(cache): advance cached shell revision`. Standalone PR (Q604); never inside an overhaul PR. Do not push unless told to.

## Steps

### Step 1: Failing test

In `test/shared-setup-flow.mjs`, add `runCase("Un-onboarded device with a program archives it on setup-link activation", …)` next to the "refuse replacement" case:
1. Seed `firstRunEligibleState([])` (program "Existing split", `onboarded:false`, no log or history).
2. Open the link for `REPRESENTATIVE_PAYLOAD` the same way the neighbouring case does, then call `clickSharedStart(page, { activate: true })`.
3. Read `readDurableState`. Assert that the active program is the shared one, **and** that `state.programHistory` contains an entry whose name is "Existing split" or whose program contains the original exercise (`ex-existing`).

**Verify**: the case **fails** on the history assertion. Reading the code, `hasArchivableProgram` returns `false` for this shape. If it passes, STOP: the bug is already fixed.

### Step 2: Widen the guard

Replace the final `return` of `hasArchivableProgram` so that any program content counts:

```js
function hasArchivableProgram(snapshot){
  const meta=snapshot?.programMeta;
  const hasDefinition=(Array.isArray(snapshot?.program)&&snapshot.program.length>0)||structureDayLabels(meta);
  return !!meta&&!!hasDefinition}
```

Keep the `app.js` style (dense, no spaces around operators).

**Verify**: `node tools/check-production-syntax.mjs` → exit 0. The Step 1 case passes.

### Step 3: Regression sweep

Other entry routes share this boundary, so run both lanes.

**Verify**: `node tools/run-tests.mjs entry` → exit 0. `node tools/run-tests.mjs state` → exit 0. If a case fails because it expected **no** archive for an un-onboarded program (search it with `grep -rn "programHistory" test/*.mjs` around the failing assertion), STOP and report it. That case encodes the old behavior, and the owner must confirm updating it.

### Step 4: Cache ritual

Read NN via `grep -o 'repforge-v[0-9]*' sw.js`, bump every `repforge-vNN`/`?v=NN` in `sw.js` and `index.html` to NN+1, and set `expectedRevision` in `test/exercise-library.mjs`.

**Verify**: `node test/exercise-library.mjs` → exit 0.

## Test plan

One new `shared-setup-flow` case, failing first, proves the rescued program lands in `programHistory`. The full entry and state lanes prove that other routes and transactions are unaffected.

## Done criteria

- [ ] `hasArchivableProgram` no longer references `onboarded`, `log`, or `programHistory` (`grep -A5 "function hasArchivableProgram" app.js`)
- [ ] The new case passes; `node tools/run-tests.mjs entry` and `state` exit 0
- [ ] Only in-scope files changed; the `advisor-plans/README.md` row is updated

## STOP conditions

- The Step 1 case passes before the fix.
- A regression case asserts the old no-archive behavior (Step 3).
- Archiving requires `programMeta.id` and the rescued snapshot has none (`captureProgramReplacementIntent` uses `meta.id` as `oldProgramId`). Report how often that shape can occur. Do not invent an id.

## Maintenance notes

- Any future entry route must go through `captureProgramReplacement`/`archiveCapturedProgram` to inherit this guarantee.
- Advisor plan 025 (existing-user setup-link handoff) builds on this archive-and-replace path.
