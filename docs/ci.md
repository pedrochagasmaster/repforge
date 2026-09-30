# Test execution and CI

`test/suites.mjs` is the single executable command inventory; `tools/run-tests.mjs`
is the only runner, locally and in CI. The static app has no root package manager.
Browser-only dependencies live under `test/`.

## Which command should I run?

| Purpose | Command | Meaning |
| --- | --- | --- |
| Fix one contract | `node tools/run-tests.mjs <lane> --suite-id <id>` | Exact command; the failure output prints its ID. |
| Edit | `node tools/run-tests.mjs edit` | Dirty worktree, or the latest commit if clean; fail fast. Feedback only. |
| Packet | `node tools/run-tests.mjs packet --base <packet-start-sha>` | Coherent changes since an explicit base, plus dirty files; fail fast. |
| Branch diagnostic | `node tools/run-tests.mjs branch --base origin/main` | Conservative merge-base impact. `affected` remains an alias. |
| One CI shard | `node tools/run-tests.mjs shard <k>/<n>` | Exactly what CI runner `k` of `n` executes; keeps going after failures. |
| Everything | `node tools/run-tests.mjs candidate` | The complete local inventory except the external service gate. |
| Inventory | `node tools/run-tests.mjs --check` | Reconcile every scheduled/support script. |

Use `--list` for exact commands and `--explain` for files, reasons and scope.
Lanes are `fast` (pure Node), `state`, `entry`, `workout`, `privacy`, `visual`
(browser) and `service`. Local `edit`/`packet` selection is a latency tool owned
by `tools/test-selection.mjs`; unknown executable inputs widen to everything. CI
does not use it.

## What CI runs

`.github/workflows/ci.yml` is the whole configuration. Every pull request and
every push to `main` runs the same thing:

| Job | What | Typical wall time |
| --- | --- | --- |
| `plan` | Decides whether anything executable changed and publishes the shard list. | 20 s |
| `fast` | `--check` plus the complete `fast` lane (pure Node, no browser). | 1 min |
| `browser` × `CI_SHARDS` | Every browser command in the inventory, balanced across runners by measured duration. Includes the UI-system role audit and the screen-catalog recapture, each split into shard commands. | 6–7 min |
| `service` | The install-transfer Worker gate (`check`, tests, dry deploy). | 1 min |
| `ci` | The one required status check: every selected job passed, and the UI-system shard reports merge cleanly. | 20 s |

The only shortcut is in `plan`: a pull request whose changed files are all prose
(`*.md`, `*.txt`, `.gitignore`, `LICENSE`) skips the test jobs and `ci` passes
on the plan alone. Any other file, an unknown file, a change list the compare
API cannot deliver, a push to `main` or a manual dispatch runs everything. There
is no draft/ready distinction and no separate candidate mode: a green `ci` on
the PR head is the merge evidence. Pull requests test their head commit, so a
red run reproduces with `git checkout <sha>` and the printed rerun command.
Enable "require branches to be up to date" on `main` if you also want the
merge result proven against the current base.

A newer push to the same pull request cancels the run in progress; pushes to
`main` never cancel each other.

### Shards

`CI_SHARDS` in `test/suites.mjs` is the runner count. `shardSuites` packs the
browser inventory longest-first into that many bins using each command's
`seconds` (measured on `ubuntu-latest`; a missing value falls back on `cost`).
The split is a pure function of the committed inventory, so every runner and
every local `shard k/n` computes the same plan. Adding a suite needs no workflow
edit; give a command that runs longer than about twenty seconds a `seconds`
value so the packing stays balanced. `node tools/run-tests.mjs shard 1/16 --explain`
prints the estimate for that shard and the heaviest one. The account allows 20
concurrent jobs, so a run that overlaps another one queues a few shards for
about one shard's duration; that is why the count is not simply "as many as
possible".

Two catalog sweeps used to be single commands of 29 and 26 minutes. They are
now inventory commands with a `--shard k/n` argument:

- `tools/check-ui-system.mjs --shard k/6` renders one stripe of the
  screen × theme × locale matrix and writes `ui-system-shard.json` beside its
  evidence. The rule "every inventory selector rendered somewhere" needs the
  union of all stripes, so the `ci` job downloads the shard artifacts and runs
  `node tools/ci-plan.mjs merge-ui-system .ci-results/shards` (browser-free, so
  the gate installs nothing).
- `tools/capture-ui-screens.mjs --verify --shard k/6` captures one stripe of the
  915 frames into a staging tree and compares the complete staged catalog with
  the committed one (`check-ui-screens` registration plus `compare-ui-screens`
  pixels and semantics). The committed frames are the immutable baseline; the
  working tree is never rewritten. Failing frames and their baselines are
  retained under the suite's evidence directory as `visual-failures/`.

## Browser preview and visual evidence

In a fresh checkout, run `(cd test && npm ci && npx playwright install --with-deps --only-shell chromium)` once. Normal browser and screenshot commands leave `REPFORGE_URL` unset: `tools/local-preview.mjs` generates an analytics-disabled isolated current-worktree server on a fresh loopback port, verifies identity and cleans up. Explicit local URLs must serve the same worktree.

After a user-visible change, run `node tools/capture-ui-screens.mjs --affected --accept-visual-change`, review the updated PNGs and commit them; `--list-affected` shows the local recapture plan. That local selector (`tools/ci-selection.mjs`, `tools/visual-domains.mjs`) only decides what you recapture; CI always verifies the whole catalog, so a wrong local guess fails the pull request instead of merging silently. `sw.js` is ignored by the local selector only when the canonical `CACHE` declaration is its sole change.

## Failures and evidence

Every command writes its command, result, duration and complete stdout/stderr
under `.ci-results/<lane>/<suite-id>/`. Browser contracts also write
`evidence.json` with source identity, exact command, outcome, duration, rerun
command and a SHA-256 digest of the retained output; contract-specific artifacts
go in the same directory via `REPFORGE_ARTIFACT_DIR`. The terminal shows only a
bounded failure excerpt unless `--verbose` is used. Local edit/packet/exact-suite
runs fail fast; `shard`, `candidate` and CI keep going to collect every failure.
Unexecuted suites are `not-run-after-failure`, never counted as passed. Per-script
timeouts terminate the process group, including abandoned browsers. Each CI job
uploads its `.ci-results/` (seven days) and the runner writes a timing table to
the job summary. `.ci-results/` is ignored by git.

In CI, a failing browser script is replayed once with diagnostic tracing
(`REPFORGE_DIAGNOSTIC_REPLAY=1`). **The initial failure remains authoritative
even if the replay passes**; both outcomes are recorded so a flake is visible
rather than retried away. Timed-out or cancelled scripts are not replayed.
Successful runs pay no tracing cost. For a targeted local trace:

```sh
REPFORGE_TRACE=1 node tools/run-tests.mjs entry --suite program-editor-sorting
```

Fixtures are synthetic. Do not point diagnostic runs at a real user's workout
database or production telemetry configuration. The privacy fixture intercepts
`posthog-config.js` as well as its fake SDK, so a generated local preview config
cannot overwrite the fixture or redirect its requests.

Property runs shrink failures with a bounded per-property budget. CI derives the
master seed deterministically from `CI_SOURCE_SHA` (the tested commit), so the
same commit exercises the same sample on every run; an explicit `--seed` or
`REPFORGE_GENERATIVE_SEED` still overrides it. Ordinary local runs without either
value remain randomized for exploration. Output includes the master seed, suite
seed, minimized counterexample, path and exact `--property` replay command.

## Test retention and limits

Tests are retained for unique bug-detection value, not historical existence,
coverage percentage or implementation-plan provenance. New isolated tests are
failure-first: enumerate the failure space and write the failing proof before the
implementation; never add a post-hoc unit test for code already written. Product
behavior should normally be asserted through a production-backed browser journey.
Isolated tests remain appropriate when the failure space is materially cheaper or
more deterministic outside the browser: serialization/canonicalization,
migrations, algorithmic boundaries, protocol fault injection, durable-state
recovery, concurrency/races and verification-tool self-tests.

Long simulations, persistence/race suites, migration compatibility, privacy,
offline behavior and accessibility remain because they cover distinct failure
modes. Any future deletion should name the stronger retained evidence that
catches the same plausible production bug. This remains Chromium automation, not
physical-device iOS or Android validation.
