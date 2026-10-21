# Test execution and CI

`test/suites.mjs` is the single executable command inventory; `tools/run-tests.mjs`
is the only runner, locally and in CI. The static app has no root package manager.
Browser-only dependencies live under `test/`.

## Which command should I run?

| Purpose | Command | Meaning |
| --- | --- | --- |
| Fix one contract | `node tools/run-tests.mjs <lane> --suite-id <id>` | Exact command; the failure output prints its ID. |
| Edit | `node tools/run-tests.mjs edit` | Dirty worktree, or the latest commit if clean; fail fast. Feedback only. |
| Packet | `node tools/run-tests.mjs packet --base <packet-start-sha>` | Coherent changes since an explicit base, plus dirty files; supplemental fail-fast feedback, not merge evidence. |
| Branch diagnostic | `node tools/run-tests.mjs branch --base origin/main` | Conservative merge-base impact. `affected` remains an alias. |
| One CI shard | `node tools/run-tests.mjs shard <k>/<n>` | Exactly what PR-lane runner `k` of `n` executes; keeps going after failures. |
| One full-lane shard | `node tools/run-tests.mjs full-shard <k>/<n>` | Exactly what full-lane runner `k` of `n` executes (`ci-full`). |
| Full-lane Node checks | `node tools/run-tests.mjs full-fast` | The full lane's pure-Node commands. |
| Everything on a PR | `node tools/run-tests.mjs candidate` | The complete pull-request inventory except the external service gate. |
| Inventory | `node tools/run-tests.mjs --check` | Reconcile every scheduled/support script. |

Use `--list` for exact commands and `--explain` for files, reasons and scope.
Pull-request lanes are `fast` (pure Node), `state`, `entry`, `workout`,
`privacy` (browser) and `service`. Full-lane lanes are `full-fast` (pure Node)
and `full-browser`. Local `edit`/`packet` selection is a latency tool owned by
`tools/test-selection.mjs`; unknown executable inputs widen to the whole PR
inventory. It selects a full-lane command only when that suite changed, or when
a changed test/tool input reaches no PR suite. CI does not use it. Once a coherent commit is focused-test green, push it promptly
so remote CI starts while independent review and any useful local `packet` run
in parallel. `packet` is supplemental local feedback, not required completion or
merge evidence. If the environment cannot complete it reliably or within its
limits, report that limitation and keep it off the critical path instead of
duplicating the complete remote inventory locally. Focused owning proofs,
independent review, and a green `ci` on the exact final head are the completion
evidence. Do not push half-implemented or known-red work merely to start CI early.

## What CI runs

`.github/workflows/ci.yml` is the whole configuration. It runs two lanes,
each behind its own aggregate check. This is the owner's "fast PRs, full on
main" decision of 2026-10-21 ([ADR 0022](adr/0022-fast-pr-full-main-verification.md)).

**PR lane (`ci`)**: every pull request, push to `main`, nightly run and manual
dispatch runs the pull-request inventory (`SUITES`):

| Job | What |
| --- | --- |
| `plan` | Decides whether anything executable changed and publishes both shard lists. |
| `fast` | `--check` plus the complete `fast` lane (pure Node, no browser). |
| `browser` × `CI_SHARDS` | Every PR browser command, balanced across runners by measured duration, including the 21-frame critical UI matrix. |
| `service` | The install-transfer Worker gate (`check`, tests, dry deploy). |
| `ci` | The aggregate check: every selected job passed, and the critical UI report is complete, from this source, with its frame bytes. |

**Full lane (`ci-full`)**: every push to `main`, the nightly schedule
(03:23 UTC) and every manual dispatch also run `FULL_SUITES`. Pull requests never
run it.

| Job | What |
| --- | --- |
| `full-fast` | The full lane's pure-Node commands (DESIGN.md token equality, runtime budget, manual-matrix self-test). |
| `full-browser` × `FULL_SHARDS` | The exhaustive catalog verify (every frame), the role/contrast audit over every state × theme × locale, the Direction-D and rules-only audits, the year-long simulation, and the retired dedicated browser permutations. |
| `ci-full` | The aggregate check: every full job passed, and the UI-system shard reports merge under the catalog-wide never-rendered rule. |

Each job writes its per-command timings to the run's job summary.

The only shortcut is in `plan`: a pull request whose changed files are all
prose (`*.md`, `*.txt`, `.gitignore`, `LICENSE`) skips the test jobs and `ci`
passes on the plan alone. `README.md`, `NOTICE.md`, `docs/recovery-week-policy.md`
and `tools/README.md` are verification inputs, so changes to them run CI despite
their Markdown extension. Files in `fixture`, `fixtures` or `__fixtures__` paths
also run CI even when their extension is allowlisted. Any other file, an unknown
file, a change list the compare API cannot deliver, a push to `main`, the nightly
schedule or a manual dispatch runs the PR lane. There is no draft/ready distinction and no separate
remote candidate mode: a green `ci` on
the PR head is the merge evidence. `ci-full` is not merge evidence for a PR;
it guards `main`. Pull requests test their head commit, so a
red run reproduces with `git checkout <sha>` and the printed rerun command.
This workflow emits an aggregate status check named `ci`. At the time this CI
change was refreshed, `main` had branch protection disabled and no required
status contexts. This PR does not change branch protection. If it is enabled in
a separate change, requiring `ci` is a separate repository configuration step.

A newer push to the same pull request cancels the run in progress; pushes to
`main` never cancel each other.

### When `ci-full` is red on main

A `ci-full` failure means main has a regression that the PR lane did not
catch. Treat it as a main breakage, not as a flake:

1. Open the run and find the failed command in the job summary. Each failure
   prints its log path and an exact rerun command
   (`node tools/run-tests.mjs full-browser --suite-id <id>`). Download the
   shard's `.ci-results/` artifact for logs, traces and `visual-failures/`.
2. File an issue titled `ci-full: <command>` with the failing command, the first red
   commit (a push run names it; for a nightly run, bisect with the rerun command
   over the commits since the last green `ci-full`), and the evidence.
3. The owner of the PR that introduced it fixes forward with a failing-first
   proof. If the defect is one the PR lane should have caught, add that proof to
   the PR lane (a new or strengthened owner in `SUITES`) as well. A stale catalog
   frame (`capture-ui-screens --verify`) is fixed by reviewed recapture
   (`--accept-visual-change`), never by relaxing the comparison.
4. Do not re-run the workflow to get green. The rules for diagnostic replays are
   the same as for `ci`.

### Shards

`CI_SHARDS` (PR lane) and `FULL_SHARDS` (full lane) in `test/suites.mjs` are
the runner counts. `shardSuites` packs the
browser inventory longest-first into that many bins using each command's
`seconds` (measured on `ubuntu-latest`; a missing value falls back on `cost`).
The split is a pure function of the committed inventory, so every runner and
every local `shard k/n` computes the same plan. Adding a command to an existing
inventory lane needs no workflow edit; give a command that runs longer than
about twenty seconds a `seconds` value so packing stays balanced. An unknown
lane fails `--check` instead of being silently omitted.
`node tools/run-tests.mjs shard 1/14 --explain`
prints the estimate for that shard and the heaviest one. The account allows 20
concurrent jobs, so a run that overlaps another one queues a few shards for
about one shard's duration; that is why the count is not simply "as many as
possible".

At `651d5a92` main scheduled 213 commands in 199 files on every PR. The
adoption put 102 of them in the pull-request inventory (`SUITES`) and the
other 112 in `FULL_SUITES`, the full lane (below), so nothing main verified
before is dropped. Program Lab then added 3 PR-lane and 7 full-lane commands.
`node tools/run-tests.mjs --check` prints the current counts; the ledger
records them. Scheduling shards and assertions are separate
measures. The ledger is
[test-retirement-ledger.json](test-retirement-ledger.json), and the coverage
contract is in [test-suite-redesign.md](test-suite-redesign.md).

PR lane: `test/ui-system.mjs` opens the 21 explicitly declared critical frames
once each. Each settled production frame is shared between a fresh pixel
comparison, a semantic observation and live role/contrast checks. The suite
also runs real entry accessibility and deliberate checker defects. Every cell
must pass. The `ci` job's `merge-ui-system` step rejects missing or duplicate
reports, a foreign source identity, failed observations and incomplete
comparisons. `test/ui-system-checker.mjs` keeps the checker's own self-tests
(metadata, CSS debt, rendered contrast, boundary, focus, modal-inert and
device-pixel sampling negatives).

Full lane: the two exhaustive catalog sweeps are split into shard commands.

- `tools/check-ui-system.mjs --shard k/7` renders one stripe of the
  screen × theme × locale matrix and writes `ui-system-shard.json` beside its
  evidence. The rule "every inventory selector rendered somewhere" needs the
  union of all stripes, so the `ci-full` job downloads the shard artifacts and
  runs `node tools/ci-plan.mjs merge-ui-system-full .ci-results/full-shards`
  (browser-free, so the gate installs nothing).
- `tools/capture-ui-screens.mjs --verify --shard k/6` captures one stripe of the
  catalog frames into a staging tree. It then compares the complete staged
  catalog with the committed one (`check-ui-screens` registration plus
  `compare-ui-screens` pixels and semantics). The committed frames are the
  immutable baseline; the working tree is never rewritten. Failing frames and
  their baselines are kept under the suite's evidence directory as
  `visual-failures/`.

## Browser preview and visual evidence

In a fresh checkout, run `(cd test && npm ci && npx playwright install --with-deps --only-shell chromium)` once. Normal browser and screenshot commands leave `REPFORGE_URL` unset: `tools/local-preview.mjs` generates an analytics-disabled isolated current-worktree server on a fresh loopback port, verifies identity and cleans up. Explicit local URLs must serve the same worktree.

After a user-visible change, run `node tools/capture-ui-screens.mjs --affected --accept-visual-change`, review the updated PNGs and commit them; `--list-affected` shows the local recapture plan. That local selector (`tools/ci-selection.mjs`, `tools/visual-domains.mjs`) only decides what you recapture; PR CI verifies the complete declared critical matrix, and the full lane verifies every catalog frame on each push to main and nightly. A wrong local authoring selection can therefore pass a PR and turn `ci-full` red on main; recapture the affected frames before merging. `sw.js` is ignored by the local selector only when the canonical `CACHE` declaration is its sole change.

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

Long simulations (full lane), persistence/race suites, migration compatibility,
privacy, offline behavior and accessibility remain because they cover distinct
failure modes. Any future deletion should name the stronger retained evidence that
catches the same plausible production bug. This remains Chromium automation, not
physical-device iOS or Android validation.
