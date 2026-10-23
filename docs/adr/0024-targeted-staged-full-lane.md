# ADR 0024: A targeted full lane, staged behind the PR lane, on every pull request

- **Status:** Accepted, 2026-10-23 (owner)
- **Decision owner:** Product owner
- **Amends:** [ADR 0022](0022-fast-pr-full-main-verification.md), decision 2 ("it never runs on pull requests")
- **Affects:** `.github/workflows/ci.yml`, `tools/ci-plan.mjs`, `tools/test-selection.mjs`,
  `tools/visual-domains.mjs`, `test/suites.mjs`, `tools/run-tests.mjs`, the catalog tools,
  [`docs/ci.md`](../ci.md)

## Context

Under ADR 0022 the full lane guarded `main` only, so agents dispatched it by hand on
their branches to avoid red `main` runs. A typical UI pull request then took two to
three hours from push to merge-ready, almost all of it CI: a 50-minute full run on
every UI change, both lanes starting together (about 30 jobs against a 20-job
account limit), re-runs after flakes, and screenshot recapture on a two-CPU devbox.
The owner asked for the build, not CI, to be the bottleneck, with no loss of
protection and no paid runners.

## Decision

1. **Every pull request runs a targeted full lane.** The plan selects only the
   full-lane commands and catalog states its changed files can affect, through
   reviewed ownership (`@ci-domain` regions in `app.js` and `styles.css`, the source
   mappings, the test dependency graph and explicit inputs). Shared foundations
   (tokens and other unannotated CSS, the motion layer, the service worker beyond a
   revision bump, `index.html` beyond a revision bump, i18n, the CI and catalog
   tooling) and any unknown file run the complete lane.
2. **The full lane is staged.** Its jobs wait for the PR lane; on a pull request they
   start only when `ci` passed. The merge gate is `ci` and `ci-full` green on the
   head. Nobody dispatches `ci-full` by hand.
3. **`main`, the nightly schedule and manual runs keep the complete full lane**, and
   the gate refuses a narrowed selection on those events.
4. **CI publishes changed frames.** When a catalog comparison fails, the run uploads
   the frames it rendered; `tools/fetch-ci-captures.mjs` places them for review.
   Comparison stays exact.
5. **Shard counts follow measured durations**: five PR-lane browser runners and
   twelve for the complete full lane; a targeted full lane packs about eight
   minutes per runner.

## Consequences

- A stale frame or a full-lane regression in the affected area fails the pull
  request instead of `main`.
- A wrong or missing annotation can narrow a pull request's full lane too far; the
  complete run on `main` still catches it, and its fix widens the mapping.
- A pull request waits for the PR lane before its full lane starts, which costs a
  few minutes of latency but avoids queueing and wasted full runs.
- Pushes to `main` now run the full lane after the PR lane instead of beside it.
