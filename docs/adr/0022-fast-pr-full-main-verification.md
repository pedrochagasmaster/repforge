# ADR 0022: Fast pull-request verification, full verification on main

- **Status:** Accepted, 2026-10-21 (owner); amended by [ADR 0024](0024-targeted-staged-full-lane.md), 2026-10-23: pull requests now run a targeted full lane
- **Decision owner:** Product owner
- **Reference:** PR #446 (`codex/test-suite-redesign`) and its adoption on current main
- **Affects:** `test/suites.mjs`, `tools/run-tests.mjs`, `tools/ci-plan.mjs`,
  `.github/workflows/ci.yml`, [`docs/ci.md`](../ci.md),
  [`docs/test-suite-redesign.md`](../test-suite-redesign.md)

## Context

Before this decision every pull request ran the complete inventory: 213 commands at
`651d5a92`, including the screen-catalog verify over every frame, the role/contrast
audit over every state × theme × locale, the Direction-D and rules-only audits, and
the year-long emergent simulation. PR #446 redesigned the suite around production
contracts and critical browser risks. Its contract retired those exhaustive checks
outright and said that no slow suite would move into an optional lane.

## Decision

1. **Pull requests run the redesigned inventory** (`SUITES`): module contracts and
   properties, the retained browser protocol journeys, and the 21-frame critical UI
   matrix. The `ci` check is the merge evidence.
2. **The exhaustive checks are kept, not deleted.** They make up `FULL_SUITES` and
   run on every push to `main`, on a nightly schedule and on manual dispatch, behind
   a separate `ci-full` check. That lane covers the full catalog verify, the
   `check-ui-system` sweep over every rendered state, the Direction-D and rules-only
   audits, the year-long simulation and the retired dedicated permutations. It never
   runs on pull requests.
3. **The full lane is not optional.** A `ci-full` failure is a red check on `main`
   and is triaged as a main breakage (`docs/ci.md`, "When `ci-full` is red on main").
   This overrides #446's rule that no slow suite moves into another lane: the lane
   is mandatory for `main`. It only stops gating pull requests.
4. A command lives in exactly one lane. `docs/test-retirement-ledger.json` records,
   for every command main ran at the baseline, whether it stays in the PR lane, was
   consolidated into a named owner or moved to the full lane.

## Consequences

- PR CI time drops by the cost of the exhaustive sweeps and the retired permutations.
- A regression that only the full lane catches lands on `main` and is found within
  one push (or one night). Its fix adds a failing-first proof, and where the PR lane
  should have caught it, a PR-lane owner too.
- A stale catalog frame no longer blocks a PR; it turns `ci-full` red after merge.
  Authors still recapture affected screens before merging.
- Pushes to `main` run both lanes, so they need more concurrent jobs. The account's
  20-job limit queues some shards.
