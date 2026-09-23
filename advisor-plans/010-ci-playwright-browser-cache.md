# Plan 010: Measure, then cache only if it pays, the Chromium download repeated across five CI jobs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat ff9991cf..HEAD -- .github/workflows/simulation.yml docs/ci.md`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW–MED (CI configuration)
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: not in `docs/backlog.md`. CI changes are shared infrastructure, so the owner must approve before merging.

## Why this matters

`.github/workflows/simulation.yml` runs `npx playwright install --with-deps --only-shell chromium` independently in `browser` (a 3-lane matrix), `telemetry-privacy`, and, when selected, `visual-evidence`. There is no `actions/cache` for the browser binary. **But** the advisor measured the latest green run (35790638237, 2026-09-22): the whole install step, `npm ci` plus the browser plus apt deps, took **19–26 s per job**, and the jobs run in parallel. The avoidable part is therefore at most a few seconds of wall time per job. `tools/AGENTS.md` says: "Performance changes need measured evidence. Do not claim lower wall time or runner-minutes from architecture alone." This plan measures the browser-download share first and implements the cache only if it clears a threshold. Otherwise it records a REJECTED verdict with numbers.

## Current state

`.github/workflows/simulation.yml` (at `ff9991cf`), `browser` job:

```yaml
      - uses: actions/setup-node@v5
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: test/package-lock.json
      - name: Install the pinned headless browser only
        working-directory: test
        run: |
          npm ci
          npx playwright install --with-deps --only-shell chromium
```

The same step appears in `telemetry-privacy`. In `visual-evidence` it is "Install capture dependencies only when needed" and is guarded by `if: steps.scope.outputs.mode != 'none'`. `docs/ci.md` (the "Jobs and compatibility" paragraph) says: "Headless-only Chromium avoids downloading the unused headed browser; npm's lockfile cache remains in use."

Playwright stores browsers in `~/.cache/ms-playwright` on Linux runners. `npx playwright install-deps chromium` installs only OS packages; `npx playwright install --only-shell chromium` downloads only the browser.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Step timings | `gh run view <run-id> --json jobs -q '.jobs[] \| {name, steps:[.steps[] \| select(.name\|test("Install")) \| {name,s:.startedAt,e:.completedAt}]}'` | JSON with timestamps |
| Workflow lint | `node --input-type=module -e "import('node:fs').then(f=>console.log(f.readFileSync('.github/workflows/simulation.yml','utf8').length))"` (sanity) and, if available, `actionlint` | exit 0 |
| CI unit tests | `node --test test/ci.mjs` | pass |

## Scope

**In scope:** `.github/workflows/simulation.yml` (install steps only); `docs/ci.md` (one sentence).
**Out of scope:** job structure, lanes, timeouts, `visual-evidence` scope selection, and `install-transfer-service.yml`.

## Git workflow

Branch `advisor/010-ci-browser-cache`. Commit `ci: cache the pinned Chromium shell across browser jobs` (only if Step 2 says go). Pushing is needed to measure. **Ask the operator before pushing**, because CI runs are shared and visible.

## Steps

### Step 1: Split the measurement (on a throwaway branch, with operator approval)

Temporarily split the `browser` job's install step into three steps: `npm ci`, `npx playwright install-deps chromium` (OS packages), and `npx playwright install --only-shell chromium` (the browser download). Push to a throwaway branch and let CI run once.

**Verify**: with the `gh run view` command, record the duration of the `--only-shell` step for each of the three `browser` lanes.

### Step 2: Go / no-go

- **Go** if the median browser-download step is **≥ 8 s**, because across five jobs that is roughly ≥ 40 runner-seconds per run.
- **No-go** otherwise. Set this plan's row in `advisor-plans/README.md` to `REJECTED — browser download median <N>s (run <id>)`, delete the throwaway branch (with operator approval), and stop.

**Verify**: a written decision with the measured numbers.

### Step 3 (Go only): Add the cache

In each job that installs Chromium, keep the setup-node npm cache and add before the install:

```yaml
      - name: Restore the pinned Chromium shell
        id: pw-cache
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: ${{ runner.os }}-pw-shell-${{ hashFiles('test/package-lock.json') }}
```

and change the install step to:

```yaml
        run: |
          npm ci
          npx playwright install-deps chromium
          if [ "${{ steps.pw-cache.outputs.cache-hit }}" != "true" ]; then npx playwright install --only-shell chromium; fi
```

Apply this to `browser`, `telemetry-privacy`, and `visual-evidence`. In `visual-evidence`, add the same `if: steps.scope.outputs.mode != 'none'` guard to the cache step. Add to the `docs/ci.md` paragraph: "The Chromium shell is cached by lockfile hash; OS packages are installed every run."

**Verify**: `node --test test/ci.mjs` → pass. Push (with approval) and run CI twice. The second run shows cache hits and a green `simulation` aggregate. Report before/after step durations.

## Test plan

CI itself is the test: two consecutive green runs, the second with `cache-hit == true` on every browser job.

## Done criteria

- [ ] Either a REJECTED row with measured numbers, or: the workflow has 3 cache steps keyed on `test/package-lock.json`, two green runs are linked in the report, and before/after durations are recorded
- [ ] `node --test test/ci.mjs` passes
- [ ] The `advisor-plans/README.md` row is updated

## STOP conditions

- The operator declines to push. Record it as BLOCKED.
- A cache-hit run fails to launch Chromium. The OS deps/binary split is wrong; revert and report.

## Maintenance notes

- The cache key follows `test/package-lock.json`, so a Playwright bump invalidates it automatically.
