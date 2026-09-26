# Plan 004: The plan index and backlog tell the truth about which overhaul plans are merged and in progress

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat ff9991cf..HEAD -- plans/README.md plans/055-focus-only-workout.md plans/056-progress-and-block-lifecycle.md plans/057-management-surfaces.md docs/backlog.md docs/taurifer-architecture-refactoring-plan.md`
> If any of these changed, someone may already have reconciled them. Re-read
> them, and only correct what is still wrong.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (documentation only)
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: **Now**: the "CI and documentation drift" row. Run only **after PR #248 merges**, as one small docs change that also records Plan 057's state (Q614, Q621).
- **Execution:** IN PROGRESS — draft branch `advisor/004-plan-index-status`, seeded from `main` at `29fc1c36180abec3ff1839e4889f6d44a39fa6dc`. Re-run every drift check against the live branch before implementing; this line records execution kickoff only and does not override repository source-of-truth documents.

## Why this matters

`plans/README.md` is the file this repo tells every agent to read before starting work, alongside `docs/backlog.md`. It currently says Plan 054 is the active implementation and that Plans 055–057 are merely "PLANNED". In fact 055 and 056 were **merged** (PRs #243 and #244, 2026-09-20), and 057 is in progress on open draft PR #248. An agent following the index would believe the wrong plan is active, and might start work that duplicates or conflicts with it. The repo's own rule says each completing PR updates the index. PRs #243/#244 didn't, so this plan closes that gap.

## Current state

Verified at `ff9991cf`:

- `plans/README.md:22-26`:
  > That approval is merged, and so are Plans 049 (PR #222), 050 (PR #227), 051 (PR #226), 052 (PR #228), owner-approved 053 (PR #235), and the post-053 durable-state bridge (PR #240). Current main is `3710f34bb677c59674a3677c03d2fc1427e07cef`. Plan 054 is the active implementation.
- `plans/README.md` table rows (around lines 42-44):
  > `| [055](./055-focus-only-workout.md) | 4 | **PLANNED — DEPENDS ON 051** | …`
  > `| [056](./056-progress-and-block-lifecycle.md) | 5 | **PLANNED — DEPENDS ON 052** | …`
  > `| [057](./057-management-surfaces.md) | 6 | **PLANNED — DEPENDS ON 054–056** | …`
- `plans/055-focus-only-workout.md:10`: `- **Status:** Implementation started; 055-P1 capability baseline in progress. …`
- `plans/056-progress-and-block-lifecycle.md:10`: `- **Status:** In implementation; 056-P1 baseline and evidence characterization`
- `plans/057-management-surfaces.md:10`: `- **Status:** Planned; implementation has not started`
- `docs/backlog.md:154-158` (the "Completed or absorbed" bullet): "…merged at `3710f34b…`. … Plan 054 is the active overhaul implementation."
- `docs/taurifer-architecture-refactoring-plan.md:294`: "…at `3710f34b…`; Plan 054 is the active consumer."
- Git facts (from `git log --merges` and `gh pr view`):
  - `87833ded` Merge PR #241 (054)
  - `52c0cea2` Merge PR #244 "Plan 056", merged 2026-09-20T21:06Z
  - `41250484` Merge PR #243 "Focus-only workout (Plan 055)", merged 2026-09-20T22:11Z
  - PR #248 "Plan 057: management surfaces" — OPEN, draft

Row wording convention to match (existing rows): `**IMPLEMENTED — PR #241**`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Confirm merges | `gh pr view 243 --json state,mergedAt,title` / `gh pr view 244 …` / `gh pr view 248 --json state,isDraft` | 243/244 `MERGED`; 248 as found |
| Main SHA | `git fetch origin main && git rev-parse origin/main` | a SHA |
| Doc contradiction checker | `node tools/check-canonical-contradictions.mjs` | exit 0 |
| Disposition checker | `node tools/check-ui-overhaul-disposition.mjs` | exit 0 |
| Whitespace | `git diff --check` | no output |
| Fast lane | `node tools/run-tests.mjs fast` | exit 0 |

## Scope

**In scope:**
- `plans/README.md` (the "Current planning state" paragraph and rows 055/056/057)
- `plans/055-focus-only-workout.md` line 10, `plans/056-progress-and-block-lifecycle.md` line 10 (status line only)
- `docs/backlog.md` (the one "Plan 054 is the active" sentence)
- `docs/taurifer-architecture-refactoring-plan.md:294` (the one "Plan 054 is the active consumer" clause)

**Out of scope:**
- `plans/057-management-surfaces.md`. PR #248 owns it while it is open; editing it on another branch will conflict. Change it only if PR #248 is already merged or closed when you start.
- Rows 058/059, and any plan body text other than the status line.
- Any product decision or reordering in `docs/backlog.md`.

## Git workflow

- Branch: `advisor/004-plan-index-status`
- Commit: `docs(plans): record merged 055/056 and in-progress 057`
- Do not push.

## Steps

### Step 1: Confirm facts

Run the `gh pr view` commands and `git rev-parse origin/main`. Read PR #243's and #244's descriptions (`gh pr view 243 --json body -q .body`), and check whether each says the plan is **complete** or only a first packet.

**Verify**: you can state for each of 055 and 056 either "complete" or "partial (what remains)", quoting the PR body. If it is ambiguous, see the STOP conditions.

### Step 2: Edit `plans/README.md`

- Replace "Current main is `3710f34…`. Plan 054 is the active implementation." with "Current main is `<origin/main SHA>`. Plans 054 (PR #241), 055 (PR #243), and 056 (PR #244) are merged; Plan 057 is the active implementation (draft PR #248)." Adjust this to the facts from Step 1.
- Row 055 → `**IMPLEMENTED — PR #243**`, or `**PARTIAL — PR #243; <remaining>**` if Step 1 found it partial. Row 056 → the same with #244. Row 057 → `**IN PROGRESS — DRAFT PR #248**` (or its final state if already merged).

**Verify**: `grep -n "Plan 054 is the active" plans/README.md` → no output. `grep -c "PR #243\|PR #244\|#248" plans/README.md` → at least 3.

### Step 3: Edit plan status lines, backlog, and refactoring plan

- `plans/055-…md:10` and `plans/056-…md:10` → `- **Status:** Implemented — PR #243 (merged 2026-09-20)` / `… PR #244 …`, or the partial wording from Step 1.
- `docs/backlog.md`: change "Plan 054 is the active overhaul implementation." to match Step 2's sentence.
- `docs/taurifer-architecture-refactoring-plan.md:294`: change "Plan 054 is the active consumer" to "Plans 054–056 have since merged; Plan 057 is the active consumer". Keep the historical SHA, because that sentence records when the bridge merged.

**Verify**: `grep -rn "Plan 054 is the active" plans docs` → no output.

### Step 4: Checks

**Verify**: `node tools/check-canonical-contradictions.mjs` → exit 0. `node tools/check-ui-overhaul-disposition.mjs` → exit 0. `git diff --check` → empty. `node tools/run-tests.mjs fast` → exit 0.

## Test plan

No code changes. The repo's canonical-document checkers (`check-canonical-contradictions`, `check-ui-overhaul-disposition`) run in the fast lane and must stay green.

## Done criteria

- [ ] `grep -rn "Plan 054 is the active" plans docs` returns nothing
- [ ] `plans/README.md` rows 055/056/057 name PRs #243/#244/#248
- [ ] `node tools/run-tests.mjs fast` exits 0
- [ ] `git diff --stat` touches only the in-scope files
- [ ] The `advisor-plans/README.md` row is updated

## STOP conditions

- A PR body says the plan is incomplete, but the remaining work cannot be summarized in one clause. Report it and let the owner word the status.
- `check-canonical-contradictions.mjs` fails on text you did not touch, or requires editing an out-of-scope document.
- PR #248 has merged or closed, which changes what row 057 and `plans/057-…md` should say. Re-read it and include `plans/057-…md:10` only then.

## Maintenance notes

- Root cause: completion PRs merge without the index update that `plans/README.md` step 5 requires. A reviewer checklist item ("did this PR update `plans/README.md` and `docs/backlog.md`?") would prevent recurrence. That is the owner's call.
- Prefer "see `git log`" over hardcoding "current main" SHAs, since a hardcoded SHA goes stale on the next merge.
