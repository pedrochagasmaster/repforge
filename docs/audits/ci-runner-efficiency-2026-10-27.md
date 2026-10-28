# CI runner efficiency audit — 2026-10-27

This audit uses GitHub Actions API job timings and PR changed-file history
for the 28 days ending October 27, 2026.

## High-cost areas and decisions

- **679 PR workflow runs** (646 CI, 33 preceding Simulation) across 173
  branch names incurred **approximately 1,355 aggregate runner-hours**;
  this is the sum of elapsed executing jobs, not wall-clock time or billing.
  206 CI runs were cancelled after consuming approximately **251 runner-hours**.
  Only 44 cancelled runs were superseded within 60s of run creation
  (2.35 runner-hours). At 120s the counts were 77 runs and 8.84 runner-hours.
  A global 60–120s debounce slows every passing PR and can prevent only a
  small fraction of historical cancellation waste. Do not add a blanket sleep.
- Browser execution itself is the major cost. Representative successful
  October 24–27 browser jobs spent ~28–67s checking out Git history,
  ~11–24s setting up Playwright and its dependencies, and ~330–1,139s
  executing browser tests. The apt/Chromium shell cache already exists.
  Do not remove browser tests or their shard-level critical UI evidence.
- Full-history checkout is duplicated in five PR browser shards and
  up to twelve full-browser shards on every complete change. The devbox
  Git database occupies ~2GB (~1.91GiB packed), and GitHub reports
  a repository size of about 1.9GB. A full-history blob-filtered clone
  of main fetched **2.71 MiB** of graph/tree metadata in **2.21s**
  before checkout, then added about **181.5 MiB** of current working
  tree blobs in **12.74s**, with 2,135 reachable commits.
  Historical git show HEAD~80:app.js passed. Four pinned old blobs used by
  migration and direction-D fixtures fetched successfully (~0.4–1.0s
  each on the devbox). After those reads, .git occupied ~187MiB.
  The CI contract tests passed 55/55 on the partial clone before this change.
- Scope: add filter: blob:none to actions/checkout@v5 in browser
  and full-browser, retaining fetch-depth: 0, persist-credentials: false
  and the explicit reviewed PR head. The repo is public so lazy old
  blob fetching needs no persisted credential. Other jobs stay shallow.

## Validation and caveats

This clone experiment used the Oracle devbox, **not an Actions runner**.
The existing devbox Git database includes remote branches, so 2GB vs
187MB is a *local storage comparison*, not a measured GitHub download or
billable-time reduction. The exact reachable commit count changes by head.
Lazy historical blob requests may trade initial transfer time for later test
time. If Actions reveal regressions on historical git show, revert this
filter without weakening coverage.

Compare the new PR run's checkout step median/range across five PR and
twelve full browser shards against full-selection successful runs #530–#532;
confirm both aggregate checks pass. Report runner time and workflow wall
time separately. A full-lane change to CI itself will correctly run all.
Long-term optimization should target browser suite duration or measured
resource waste, not globally delay PR feedback or drop tests.
