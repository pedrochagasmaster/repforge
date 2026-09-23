# Plan 001: Decide and pin whether an un-onboarded device that already holds a program may receive a setup link

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat ff9991cf..HEAD -- app.js test/shared-setup-flow.mjs docs/adr/0007-shared-setup-links.md AGENTS.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S (Part A) + S (Part B, only if the owner chooses Option 2)
- **Risk**: LOW (Part A is test-only) / MED (Part B changes an entry gate)
- **Depends on**: none
- **Category**: bug (decision-gated)
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: not in `docs/backlog.md`. The repository treats that file as the only work queue, so the owner must accept this plan there (or approve it directly) before Part B runs.

## Why this matters

A setup link (`index.html#setup=v1.…`) is a program shared by a coach. The app must never let a link overwrite a lifter's existing program. The gate that decides this checks only three things: the `programMeta.onboarded` flag, log rows, and archived program history. It does **not** check whether a program is present. `AGENTS.md` says a program can exist with `onboarded` unset: a restored backup or a migrated legacy snapshot "can carry a real program with the flag unset". On such a device, a setup link opens the first-run gate and can replace that program once the lifter taps **Start this program**.

This is **not** a plain bug. ADR 0007 defines "configured state" as exactly those three signals, and the test suite deliberately treats "program present, `onboarded:false`, no log" as eligible (`firstRunEligibleState`). The lifter also confirms explicitly before anything is written. What nobody has decided is whether the *prior program* is archived or lost when that happens, and whether that is acceptable. Part A answers that with a test. Part B is a fix that runs only with the owner's approval.

## Current state

- `app.js` — the whole application; the gates live here.
- `test/shared-setup-flow.mjs` — the Playwright suite for setup links (lane `entry`).
- `docs/adr/0007-shared-setup-links.md` — the governing decision.

Gate definitions (`app.js` at `ff9991cf`):

```js
// app.js:14901
const sharedSetupEligible=()=>firstRunPending()&&!(state.programHistory?.length);
// app.js:15086
const firstRunPending=()=>!state.programMeta?.onboarded&&!state.log.length;
// app.js:12626
function hasActiveProgram(){return !!(state?.programMeta?.onboarded&&((state.program||[]).length||structureDayLabels(state.programMeta)))}
// app.js:12632
function hasProgramContent(){return !!((state?.program||[]).length||structureDayLabels(state?.programMeta))}
```

Where the gate is consulted:

- `app.js:14927-14931` — `commitSharedSetup()` shows the `setup.shared.existing` toast and returns `ineligible:true` when `!sharedSetupEligible()`.
- `app.js:16048-16051` — `prepareSharedSetup()` sets `sharedSetupDraft.status` to `"existing"` (fragment) or `"none"` (cookie) when `!sharedSetupEligible()`.
- `app.js:15093` — `maybeShowFirstRun()` returns early when `!firstRunPending()`.

A stronger "is there anything here worth protecting" check already exists for the install-transfer destination (`app.js:3977-3990`, `installTransferStateMeaningful`). It treats `program.length`, `structureDayLabels(programMeta)`, and `customExercises.length` as meaningful, in addition to the three signals above.

ADR 0007 (`docs/adr/0007-shared-setup-links.md:37-39`) says:

> Existing configured state — onboarded metadata, any log rows, or any
> archived program history — never opens the gate and never mutates. Replacing an
> in-use program from a link remains a later product, not this one.

and (`:84-87`):

> Silently replacing an existing program, or clearing archived
> history, is out of scope so a forwarded link cannot overwrite someone who
> already trains in Taurifer.

`AGENTS.md:13` says:

> Both surfaces gate on `hasProgramContent()` — is there a program at all — which is deliberately blind to `programMeta.onboarded`, because a restored backup or migrated legacy snapshot can carry a real program with the flag unset and must not be hidden behind "No program yet".

Test-suite conventions (`test/shared-setup-flow.mjs`):

- `configuredState(overrides)` (line 205) builds a full state. By default it includes a program `prog-existing` named "Existing split" with `onboarded:true`.
- `firstRunEligibleState(customs, settings)` (line 445) is `configuredState({onboarded:false, log:[], programHistory:[], …})`. **It keeps the default program.** Existing tests therefore already assume that a device holding a program with `onboarded:false` is eligible.
- The case `"Configured state and archived history refuse replacement"` (starting near line 1920) is the pattern to copy. It calls `clearSite`, `persistState`, `reload`, `dismissGates`, and `encodeSharedPayload`, navigates to `#setup=…`, then reads `readDurableState` before and after.
- `runCase(name, fn)` (line 632) registers a case. `node test/shared-setup-flow.mjs <substring>` runs only the cases whose names contain that substring (the `ONLY` filter at line 30 comes from `process.argv`).
- `clickSharedStart(page, { activate })` (line 427) drives the Start and activation actions.

Vocabulary (`CONTEXT.md`): "program", "setup link", "shared program", "program history". Do not write "routine", "template", or "workout plan".

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| One-time setup | `(cd test && npm ci && npx playwright install --with-deps --only-shell chromium)` | exit 0 |
| Syntax gate | `node tools/check-production-syntax.mjs` | exit 0 |
| New case only | `node tools/run-tests.mjs entry --suite shared-setup-flow --verbose` (or run the suite with a server: `python3 -m http.server 8000 --directory "$PWD" &` then `REPFORGE_URL=http://localhost:8000/ node test/shared-setup-flow.mjs "un-onboarded program"`) | the new case prints PASS lines |
| Whole suite | `node tools/run-tests.mjs entry --suite shared-setup-flow` | exit 0 |
| Affected set | `node tools/run-tests.mjs affected --base origin/main` | exit 0 |

## Scope

**In scope:**
- `test/shared-setup-flow.mjs` (add one `runCase`)
- Part B only, with owner approval: `app.js` (the two gate lines), `docs/adr/0007-shared-setup-links.md` (one clarifying sentence), plus the cache-revision ritual files `sw.js`, `index.html`, `test/exercise-library.mjs`

**Out of scope:**
- `shared-setup.js` — the codec is correct; the question is only about eligibility.
- `firstRunEligibleState` and every existing case that uses it. Do not change their meaning in Part A.
- `hasActiveProgram()` and `hasProgramContent()` — other surfaces depend on their exact semantics (see `AGENTS.md:13`).
- The install-transfer eligibility (`installTransferStateMeaningful`).

## Git workflow

- Branch: `advisor/001-setup-link-eligibility`
- Conventional commits, matching `git log` (for example `test(share): characterize un-onboarded program eligibility`).
- Do not push or open a PR unless the operator tells you to.

## Steps

### Step 1 (Part A): Characterize current behavior with a test

In `test/shared-setup-flow.mjs`, add a `runCase` named `"Un-onboarded device with a program: characterize setup-link outcome"` next to the `"Configured state and archived history refuse replacement"` case. It must:

1. Seed `firstRunEligibleState([])`. That state has program `prog-existing` / "Existing split", `onboarded:false`, and no log or history.
2. Open the setup link for `REPRESENTATIVE_PAYLOAD` the same way the neighbouring case does.
3. Record whether the first-run gate opens (`sharedGateSnapshot`).
4. If the gate opens, call `clickSharedStart(page, { activate: true })` and then read `readDurableState`.
5. Assert and log **observed facts**, not desired ones:
   - `gateOpened` (boolean)
   - `activeProgramId` after activation
   - `archivedPriorProgram`: whether `state.programHistory` now contains an entry whose program or name matches `"Existing split"` / `prog-existing`

Write the assertions so that the test passes on today's behavior, and print one summary line: `console.log("CHARACTERIZATION", JSON.stringify({gateOpened, archivedPriorProgram, activeProgramId}))`.

**Verify**: run the new case (see the commands table) → it passes, and the output contains a `CHARACTERIZATION {...}` line. Copy that line into your report.

### Step 2: Report and stop for the owner decision

Report the `CHARACTERIZATION` line and give the owner these options:

- **Option 1 — keep current behavior.** This is acceptable if `archivedPriorProgram` is `true`, because nothing is lost. The prior program moves to history, the lifter confirmed, and the ADR is satisfied as written. Only Step 1's test is committed, renamed to `"Un-onboarded device with a program archives it on setup-link activation"`, with the assertions kept as a regression guard.
- **Option 2 — tighten the gate** so that a device with `hasProgramContent()` is treated as configured. This is recommended if `archivedPriorProgram` is `false`, because the prior program would then be destroyed.

Commit Step 1 either way. **Do not start Part B without an explicit owner choice of Option 2.**

**Verify**: `git log -1 --format=%s` shows the test commit; `git status` is clean.

### Step 3 (Part B, Option 2 only): Tighten the gate

In `app.js`, change only:

```js
const sharedSetupEligible=()=>firstRunPending()&&!(state.programHistory?.length)&&!hasProgramContent();
```

Leave `firstRunPending` unchanged. It also drives the generic first-run landing (`maybeShowFirstRun`) and the `app_boot` telemetry property `first_run`, and changing it would alter those surfaces.

Then:

1. Update the Step 1 case so that it asserts the gate does **not** open and the `setup.shared.existing` toast appears. Copy those assertions from the neighbouring "refuse replacement" case.
2. Existing cases that seed `firstRunEligibleState` expect eligibility, so they will now fail. For each one, pass `program: []` through a new optional parameter. Keep the default the same, and add a new helper `firstRunEmptyState(customs, settings)` that sets `program: []` and `programMeta.structure` absent. Switch those cases to it.
3. Add this sentence to ADR 0007 after the "Existing configured state" sentence: "A device that already holds program content (`hasProgramContent()`), even with `onboarded` unset, is configured state for this gate."
4. Cache ritual (`app.js` is precached): read the live number with `grep -o 'repforge-v[0-9]*' sw.js`, call it NN, and replace every `?v=NN` and `repforge-vNN` with NN+1 in `sw.js` and `index.html`. Also set `const expectedRevision = "NN+1"` in `test/exercise-library.mjs`.

**Verify**:
- `node tools/check-production-syntax.mjs` → exit 0
- `node test/exercise-library.mjs` → exit 0
- `node tools/run-tests.mjs entry --suite shared-setup-flow` → exit 0
- `node tools/run-tests.mjs entry --suite entry-landing` → exit 0

## Test plan

- Step 1: one new characterization case in `test/shared-setup-flow.mjs`, modelled on `"Configured state and archived history refuse replacement"`.
- Part B: the same case flipped to assert refusal, plus the existing `firstRunEligibleState` cases migrated to a truly empty state. They must all still pass.

## Done criteria

- [ ] The new case exists and passes (`node tools/run-tests.mjs entry --suite shared-setup-flow` exits 0).
- [ ] Your report includes the `CHARACTERIZATION` line.
- [ ] Part B is done only if the owner approved Option 2. If it is done: `grep -n "const sharedSetupEligible" app.js` shows `hasProgramContent()`, the ADR contains the new sentence, and `node test/exercise-library.mjs` exits 0.
- [ ] `git status` shows no files outside the in-scope list.
- [ ] The `advisor-plans/README.md` row is updated.

## STOP conditions

- The gate lines no longer match the excerpts.
- The Step 1 test cannot reach activation because the gate or preview UI changed shape. Report what you observed instead.
- Part B makes any suite other than `shared-setup-flow` or `entry-landing` fail.
- The working tree holds someone else's uncommitted edits to `app.js`. Do not mix them into your commit; stop and report.

## Maintenance notes

- If "Replacing an in-use program from a link" (ADR 0007) is ever built (see plan 025), this gate is the one it will relax. The Step 1 test documents the baseline.
- Reviewers should check that `firstRunPending` was not changed and that `first_run` telemetry semantics are untouched.
