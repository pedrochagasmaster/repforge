# Plan 014: The vendored-runtime build tool uses a current esbuild, with bundle output proven equivalent

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat ff9991cf..HEAD -- tools/vendor-runtimes vendor tools/build-vendor-runtimes.mjs`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW–MED (regenerates bundles that every lifter downloads)
- **Depends on**: none
- **Category**: migration
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: not in `docs/backlog.md`. The owner must accept it there, or approve it directly, before execution.

## Why this matters

`tools/vendor-runtimes/package.json` pins `esbuild` to `0.25.10` (September 2025). The audit found `0.28.x` current in August 2026. esbuild never ships to users: it only produces the committed, hash-pinned `vendor/motion/motion.js` and `vendor/dnd-kit/*.js`. There is no known vulnerability (`npm audit` is clean). The cost of lagging is a bigger, riskier jump later. The benefit of doing it now is small, which is why this plan is P3 and includes an explicit "no-op if output changes behavior" escape.

## Current state

- `tools/vendor-runtimes/package.json`: `"dependencies": { "@dnd-kit/dom": "0.5.0", "esbuild": "0.25.10", "motion": "13.2.0" }`, with `package-lock.json` beside it.
- `tools/build-vendor-runtimes.mjs`: regenerates `vendor/motion/motion.js`, `vendor/dnd-kit/dnd-kit.runtime.js`, and the bootstrap `vendor/dnd-kit/dnd-kit.js`. It writes `*.pin.json` files recording `package`, `version`, `esbuild`, `bytes`, and `sha256`. `--check` (network-free) validates the pins against `package.json` and the bundle bytes.
- `test/runtime-budget.mjs` enforces the size budgets (bootstrap ≤ 2 KiB raw; launch runtime ≤ 30 KiB gzip; dnd runtime ≤ 45 KiB gzip; total ≤ 70 KiB gzip) and pin-byte equality. `test/vendor-runtimes.mjs` checks the offline and precache contracts. `test/motion-integration.mjs` and `test/focus-geometry.mjs` exercise the runtimes in a browser.
- The vendored files are precached by `sw.js` **without** a `?v=` revision. When their bytes change, the `CACHE` name in `sw.js` must be bumped so that installed clients fetch them (`AGENTS.md`: "Bump `CACHE` when a cached file changes").
- `docs/design/interaction-runtime-audit.md` records runtime decisions. Read it for any mention of the esbuild version or sizes.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build deps | `(cd tools/vendor-runtimes && npm ci)` | exit 0 |
| Latest version | `npm view esbuild version` | e.g. `0.28.x` |
| Regenerate | `node tools/build-vendor-runtimes.mjs` | writes the bundles and pins |
| Check | `node tools/build-vendor-runtimes.mjs --check` | `vendored runtimes match their pins (...)` |
| Budgets | `node test/runtime-budget.mjs` and `node test/vendor-runtimes.mjs` | exit 0 |
| Browser | `(cd test && npm ci && npx playwright install --with-deps --only-shell chromium)`, then `node tools/run-tests.mjs workout --suite motion-integration` and `node tools/run-tests.mjs entry --suite program-editor-sorting` | exit 0 |
| Cache lockstep | `node test/exercise-library.mjs` | exit 0 |

## Scope

**In scope:** `tools/vendor-runtimes/package.json` and `package-lock.json`; the regenerated `vendor/**` bundles and pins; `sw.js` / `index.html` / `test/exercise-library.mjs` (cache ritual); `docs/design/interaction-runtime-audit.md` (only if it states the esbuild version or sizes).
**Out of scope:** the `motion` / `@dnd-kit/dom` versions; the entry files `*.entry.mjs` (widening them grows payload); `test/package.json`.

## Git workflow

Branch `advisor/014-esbuild-bump`; commits `build(vendor): bump esbuild to <version>` and `chore(cache): advance cached shell revision`. Do not push.

## Steps

### Step 1: Baseline

Run `(cd tools/vendor-runtimes && npm ci)`, then `node tools/build-vendor-runtimes.mjs --check` → it must pass on the clean tree. Record the three `bytes` values from the pins and the output of `node test/runtime-budget.mjs`.

**Verify**: `--check` passes; you have the numbers recorded.

### Step 2: Bump

Set `"esbuild"` to the exact latest `0.x` version from `npm view esbuild version` (an exact pin, not a range, matching the file's style). Then `(cd tools/vendor-runtimes && npm install)` to refresh the lockfile, then `node tools/build-vendor-runtimes.mjs`.

**Verify**: `node tools/build-vendor-runtimes.mjs --check` → pass. `git diff --stat vendor` shows the bundles and pins changed.

### Step 3: Equivalence evidence

`node test/runtime-budget.mjs` and `node test/vendor-runtimes.mjs` → exit 0. Compare new against baseline sizes. Then run the browser suites from the commands table.

**Verify**: all exit 0, and every size delta is ≤ +2% gzip. Report the deltas.

### Step 4: Cache ritual

Bump NN → NN+1 (read NN via `grep -o 'repforge-v[0-9]*' sw.js`) in `sw.js` (`CACHE` and every `?v=NN`), `index.html`, and `expectedRevision` in `test/exercise-library.mjs`.

**Verify**: `node test/exercise-library.mjs` → exit 0. `node tools/run-tests.mjs fast` → exit 0.

## Test plan

No new tests. The runtime budget, vendor contract, motion integration, and editor sorting suites are the equivalence oracle.

## Done criteria

- [ ] `grep -c '"esbuild": "0.25.10"' tools/vendor-runtimes/package.json` → `0`
- [ ] `node tools/build-vendor-runtimes.mjs --check` passes
- [ ] The listed suites pass, and the size deltas are reported
- [ ] Only in-scope files changed; the `advisor-plans/README.md` row is updated

## STOP conditions

- A size budget fails, or any delta exceeds +2% gzip.
- A browser suite fails after regeneration. Revert everything; this plan is optional hygiene.
- esbuild's latest release is `1.x` or otherwise flags breaking changes in its changelog for the options `build-vendor-runtimes.mjs` uses. Report and stop.

## Maintenance notes

- Consider bumping esbuild whenever `motion` or `@dnd-kit/dom` is next updated, so the bundles are regenerated only once.
