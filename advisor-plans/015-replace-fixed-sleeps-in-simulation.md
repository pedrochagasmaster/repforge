# Plan 015: The 52-week simulation waits on observable conditions instead of fixed sleeps (first slice of the suite-wide sleep cleanup)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat ff9991cf..HEAD -- test/simulation.mjs`
> Re-count the sleeps (Step 1). Line numbers below are from `ff9991cf`.

## Status

- **Priority**: P3
- **Effort**: M (this file only; the other ~270 sleeps in 39 files are follow-ups)
- **Risk**: MED (a wrong condition can itself flake)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: `docs/backlog.md` §6 "Centralize browser-test helpers" (Later) is the nearest item. The owner must schedule this plan.

## Why this matters

The Playwright suites contain ~399 `page.waitForTimeout(<ms>)` calls. `test/AGENTS.md` says: "Never use arbitrary sleeps or repeated reruns to manufacture a pass." Fixed sleeps fail in both directions: too short and a slow CI runner flakes, too long and every run pays for it. `test/simulation.mjs` alone has **127** sleeps summing to **≥ 20.8 s** of pure waiting per run (more where they sit inside loops), in the `workout` CI lane. It is the largest single concentration, so it goes first. The aim is to replace each sleep with a wait on the thing the next line actually needs.

## Current state

- `test/simulation.mjs` (11,483 lines): the 52-week engine simulation, lane `workout`. It launches via `launchChromium()` from `test/browser.mjs` (line 1222), and uses plain Playwright `page.*` calls.
- Sleep profile at `ff9991cf` (`waitForTimeout(<ms>)` counts): 80 ms ×41, 120 ×23, 200 ×17, 150 ×10, 100 ×7, 450 ×5, 350 ×4, 300 ×4, 60 ×3, 260 ×3, and a long tail.
- Typical shapes:

```js
// line ~1152: action whose result is a view change
  await page.waitForSelector("#entryActivate", { timeout: 10000 });
  await page.click("#entryActivate");
  await page.waitForTimeout(500);
// line ~1810: typing into the picker, which re-renders synchronously on `input`
  await page.fill("#exPickSearch", "pec deck");
  await page.waitForTimeout(120);
// line ~2138: settings save, then durable write
  await page.fill("#rirHigh", "3");
  await page.click("#saveSettings");
  await page.waitForTimeout(100);
// line ~2417: dialog choice, then import commit
  await page.click("#importReplace");
  await page.waitForTimeout(200);
```

- Observable conditions available in the app:
  - DOM state (`#<view>.view.active`, `[open]` on dialogs, `.is-open` on sheets, `.hidden` toggles, `#toast` text)
  - `window.__repforgeBooted`
  - durable state via `localStorage.getItem("repforge_v1")` (parse and compare `_storageRevision`)
  - `window.__repforgeWeeklySnapshot()`
- `motion-layer.js` honors `prefers-reduced-motion` (`reducedMotion()`); many sleeps may be animation settles.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Setup | `(cd test && npm ci && npx playwright install --with-deps --only-shell chromium)` | exit 0 |
| Count | `grep -c "waitForTimeout" test/simulation.mjs` | 127 at start |
| Total ms | `grep -o "waitForTimeout([0-9]*)" test/simulation.mjs \| grep -o "[0-9]*" \| awk '{s+=$1} END {print s}'` | 20756 at start |
| Suite | `node tools/run-tests.mjs workout --suite simulation` | exit 0; the timing line is written to `.ci-results/` |
| Quick variant | `REPFORGE_SIM_WEEKS=12` with the same command (see `test/package.json` `simulate:quick`) | exit 0 |

## Scope

**In scope:** `test/simulation.mjs` only.
**Out of scope:** every other test file; `test/browser.mjs`; any application file; changing simulated weeks or assertions; enabling `reducedMotion` for the whole context (that changes what is tested).

## Git workflow

Branch `advisor/015-simulation-sleeps`. Commit in batches of ≤ 20 replaced sleeps (`test(simulation): wait on observable state instead of sleeps (batch N)`), so that a regression bisects quickly. Do not push.

## Steps

### Step 1: Baseline

Run the suite **3 times** and record the wall time of each from the runner's timing line. Record the count and total ms.

**Verify**: 3/3 green, and the numbers are written down.

### Step 2: Classify each sleep

For each call, decide:
- **A — gate on a DOM or state consequence.** Replace with `page.waitForSelector(...)`, `page.waitForFunction(...)`, or a `locator.waitFor()` that asserts exactly what the next statements read. Examples: the view that should become active, the dialog that should close (`:not([open])`), the durable revision that should increase.
- **B — synchronous re-render after `fill`/`input`.** Playwright's `fill` dispatches `input`, and the picker renders synchronously, so the sleep can usually just be deleted. If the next line reads the list, wait for the expected row with `waitForSelector`.
- **C — genuinely time-based** (rest timer countdown, debounce, animation that the next assertion measures). Keep it, and add a trailing comment `// time-based: <why>`.

**Verify**: none (analysis). Keep a scratch list, not committed.

### Step 3: Replace in batches

Work top-down in batches of ≤ 20. After each batch, run the quick variant (`REPFORGE_SIM_WEEKS=12 …`), then the full suite. Every replacement condition must carry a timeout no larger than the surrounding code already uses (≤ 10 000 ms).

**Verify** per batch: the quick variant and the full suite are green. If a batch fails, fix the condition (not by re-adding a sleep) or revert that batch.

### Step 4: Evidence

Run the full suite 3 more times. Report before and after for the count, the total literal ms, and the median wall time.

**Verify**: 3/3 green. `grep -c "waitForTimeout" test/simulation.mjs` ≤ 60, and every remaining call has a `// time-based:` comment (`grep -n "waitForTimeout" test/simulation.mjs | grep -vc "time-based"` → `0`).

## Test plan

The suite is its own oracle. Evidence is the 3+3 runs, the counts, and the medians. No assertion may be removed or weakened; check with `git diff test/simulation.mjs | grep "^-.*assert"`, which should only show lines you moved, not deleted.

## Done criteria

- [ ] ≤ 60 `waitForTimeout` calls remain in `test/simulation.mjs`, all annotated `// time-based:`
- [ ] 3 consecutive green full runs after the change
- [ ] The report includes before/after count, total ms, and median wall time
- [ ] Only `test/simulation.mjs` changed; the `advisor-plans/README.md` row is updated

## STOP conditions

- A replacement fails intermittently (green then red with no code change) and no stable condition can be found. Leave that sleep with a `// time-based: unresolved flake` comment and report its line.
- The median wall time *increases* by more than 5%.
- Any assertion needs changing to make a batch pass.

## Maintenance notes

- Follow-up slices, in order of count: `motion-integration` (32, mostly animation, expect many class C), `focus-mode` (27), `shared-setup-flow` (25), `sheet-swipe-dismiss` (20), `program-editor-sorting` (20). A shared helper such as `waitForDurableRevision(page, > n)` would belong to backlog item "Centralize browser-test helpers".
