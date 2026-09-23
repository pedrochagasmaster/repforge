# Plan 019: Thirteen unreferenced top-level functions are removed from `app.js`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: re-run Step 1. Any name whose reference count
> is now above 1 is no longer dead: drop it from this plan and say so in your report.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (textual neighbour of 007, 008, 012, and 013 in `app.js`; land it separately)
- **Category**: tech-debt
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: **Folded into Plan 058** (obsolete-path removal) by owner decision Q613. Execute only as part of Plan 058, or with the owner's explicit go-ahead.

## Why this matters

These functions have **no caller anywhere**: not in `app.js`, other modules, tests, tools, or `index.html`, including string references. Several are thin forwarding wrappers with plausible names (`mergeLog`, `applyState`, `persistProgram`). A reader searching for "where is imported state applied" finds the wrapper and not the real function, which misleads every future change in a file that is already ~16k lines.

## Current state

Definitions in `app.js` at `ff9991cf` (the line of the `function` keyword):

| Name | Line | Shape |
|---|---:|---|
| `applyPriorityMuscles` | 1626 | multi-line generator helper |
| `applySessionLength` | 1650 | multi-line generator helper |
| `applyState` | 2566 | `function applyState(s){return replaceImportedState(s)}` |
| `programWeek` | 2664 | `function programWeek(){return mesocycleLifecycle(state.programMeta).elapsedWeek}` |
| `disposeProgramEditors` | 9335 | 4 lines |
| `closeEntryDraftEditor` | 9505 | 3 lines |
| `persistProgram` | 10102 | 3 lines |
| `freeformAppHref` | 12095 | 4 lines |
| `mergeLog` | 12589 | `function mergeLog(s){return mergeImportedLog(s)}` |
| `renderMustHaveSection` | 13119 | multi-line template renderer |
| `telemetryGeneratedProgram` | 14536 | multi-line mapping |
| `saveOnboardingProgram` | 14627 | 2 lines |
| `editOnboardingProgram` | 14629 | 2 lines |

Evidence method: `git grep -w -c <name> HEAD -- '*.js' '*.mjs' '*.html' ':!.worktrees'`, summed. Each total was exactly **1** (the definition). Because `git grep -w` also matches inside strings, `window[...]`-style string dispatch would have been counted.

`AGENTS.md` warns: "Before removing or renaming boot-bound shell IDs or globals, inspect retained historical-app fixtures; start with `rg "OLD_APP_SHA" test`." Top-level functions in this classic script are globals, so Step 2 applies that check.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Ref count | `for n in applyPriorityMuscles applySessionLength applyState programWeek disposeProgramEditors closeEntryDraftEditor persistProgram freeformAppHref mergeLog renderMustHaveSection telemetryGeneratedProgram saveOnboardingProgram editOnboardingProgram; do echo "$n $(git grep -w -c $n -- '*.js' '*.mjs' '*.html' ':!.worktrees' \| awk -F: '{s+=$NF} END {print s+0}')"; done` | every count `1` before, `0` after |
| Syntax | `node tools/check-production-syntax.mjs` | exit 0 |
| Lanes | `node tools/run-tests.mjs fast`, `state`, `entry`, `workout` | exit 0 |
| Cache lockstep | `node test/exercise-library.mjs` | exit 0 |

## Scope

**In scope:** `app.js` (delete the 13 declarations only); the cache ritual files `sw.js`, `index.html`, and `test/exercise-library.mjs`.
**Out of scope:** helpers that become unused *because of* these deletions (for example constants used only by `applySessionLength`). List them in your report; do not chase them. Also out of scope: any other suspected dead code.

## Git workflow

Branch `advisor/019-dead-functions`; commits `refactor(app): remove unreferenced top-level functions` and `chore(cache): advance cached shell revision`. Do not push.

## Steps

### Step 1: Re-verify each name

Run the ref-count command. Remove from the list any name whose count is not `1`.

**Verify**: the list of names still at `1`.

### Step 2: Historical-fixture check

Run `grep -rln "OLD_APP_SHA" test`. Then, for each name, `grep -rn "<name>" test/fixtures`.

**Verify**: no fixture references any listed name. If one does, drop that name.

### Step 3: Delete

For each remaining name, delete the whole declaration, from `function <name>(` through its matching closing `}`, and nothing else. For the multi-line ones, use `node --check app.js` after each deletion to catch a brace mistake immediately.

**Verify**: `node tools/check-production-syntax.mjs` → exit 0. The ref-count command prints `0` for every deleted name.

### Step 4: Newly orphaned helpers (report only)

For identifiers used inside the deleted bodies (for example `SESSION_BOUNDS`, `muscleHit`, `freeformAppUrl`, `entryMustMatches`), run the same ref-count. List any that dropped to `1`.

**Verify**: a list in your report (it may be empty).

### Step 5: Cache ritual and lanes

Bump NN → NN+1 (read NN via `grep -o 'repforge-v[0-9]*' sw.js`) in `sw.js` (`CACHE` and every `?v=NN`), `index.html`, and `expectedRevision` in `test/exercise-library.mjs`.

**Verify**: `node test/exercise-library.mjs` and all four lanes → exit 0.

## Test plan

No new tests. Removing unreachable code cannot change behavior, and the full lanes confirm that.

## Done criteria

- [ ] The ref count is `0` for every deleted name
- [ ] `fast`, `state`, `entry`, and `workout` lanes exit 0
- [ ] `git diff --stat` shows only in-scope files; the report lists any newly orphaned helpers
- [ ] The `advisor-plans/README.md` row is updated

## STOP conditions

- Any lane fails after deletion. Restore that function and report which one and why.
- The owner asks to fold this into Plan 058. Mark it REJECTED here with a pointer.

## Maintenance notes

- A cheap guard for the future is a fast-lane script that fails on `app.js` top-level functions with a single repo-wide reference. That is intentionally not part of this plan.
