# PR browser shard rebalancing — 2026-10-27

## Evidence and methodology

Retrieved all five browser job logs in each of four successful recent
runs using the GitHub Actions job-log API. Every sample executed the
same 45 PR browser commands, with measured per-command durations.

Training:
- Run 40489481892 (PR #530)
- Run 40491459346 (PR #531)
- Run 40536611865 (PR #532)

Independent holdout: run 40613851336 (PR #535).

The prior estimates produced five near-identical 393–394 second
shards, but native-feel was budgeted at 188s and actually took
236, 241, 290 and 273 seconds. Other underestimated large suites:
program-transition-crash-replay (218s estimated, 186/230/250/191s
observed), install-transfer-import (162s estimated,
188/200/167/136s observed). The old packing placed native feel with
two other 50–70s suites.

## Change

Only update eight per-suite scheduling seconds estimates in
test/suites.mjs, using ceil(maximum of the three training observations).
No test, assertion, fixture, selection, domain, runner count, timeout,
gate, or full-lane job changes.

| Suite | Before | After | Observed training max |
| --- | ---: | ---: | ---: |
| native-feel | 188s | 291s | 290.2s |
| install-transfer-import | 162s | 201s | 200.2s |
| program-transition-crash-replay | 218s | 250s | 249.9s |
| program-transition-commit | 53s | 62s | 62.0s |
| program-freeform-import | 126s | 130s | 129.3s |
| program-entry-s4 | 40s | 43s | 42.4s |
| custom-mutation-recovery | 92s | 95s | 94.1s |
| install-transfer-ui | 25s | 27s | 26.0s |

The revised shard estimates are 433, 434, 433, 431, 433 seconds.
All original 45 command identities occur exactly once.

## Counterfactual replay

Both packings are evaluated with the identical 45 measured suite
durations from each run. We sum durations per assigned shard and
take the maximum as the makespan. This isolates scheduling alone.

| Run | Before | After | Projected saving |
| --- | ---: | ---: | ---: |
| 40489481892 (training) | 405.8s | 389.2s | 16.6s |
| 40491459346 (training) | 421.6s | 402.9s | 18.7s |
| 40536611865 (training) | 491.4s | 428.8s | 62.6s |
| 40613851336 (holdout) | 458.8s | 402.9s | 55.9s |

These are **projected PR-browser wall-time reductions**, not observed
workflow times or GitHub runner-hours saved. The same work executes
and total suite-seconds are unchanged. Queue contention, the fast/
service critical path, test duration variability and full-lane size
may change the real outcome.

The existing test/ci.mjs shard contract proves no coverage loss,
and a regression check additionally prevents putting another
60s+ suite beside the variable-duration native-gesture gate.

## After merge

Compare real five-shard job completion times and aggregate checks on
the PR with runs #530–#532. If suite runtimes shift, recalibrate
using current job-log timings; do not shorten gesture waits, remove
recovery assertions or merge suites merely to manipulate benchmarks.
