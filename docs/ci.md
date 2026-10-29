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
| Take CI's frames | `node tools/fetch-ci-captures.mjs <run-id>` | Place the catalog frames a CI run rendered differently, for review and commit. |

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
main" decision of 2026-10-21 ([ADR 0022](adr/0022-fast-pr-full-main-verification.md)),
amended on 2026-10-23 by a targeted full lane staged behind the PR lane on every
pull request ([ADR 0024](adr/0024-targeted-staged-full-lane.md)).

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
(03:23 UTC) and every manual dispatch run all of `FULL_SUITES`. A pull request
runs the **targeted** full lane: only the full-lane commands and catalog states
its changed files can affect (below). On every event the full jobs wait for the
PR lane; on a pull request they start only if `ci` passed, so a red PR lane never
spends a full run and the two lanes never compete for runners. On `main` they run
whatever the PR lane's result.

| Job | What |
| --- | --- |
| `full-fast` | The full lane's selected pure-Node commands (DESIGN.md token equality, runtime budget, manual-matrix self-test, Program Lab). |
| `full-browser` × the planned count | The exhaustive catalog verify (every frame), the role/contrast audit over every state × theme × locale, the Direction-D and rules-only audits, the year-long simulation, and the retired dedicated browser permutations; on a pull request, the selected subset. |
| `ci-full` | The aggregate check: every selected full job passed (after a passing PR lane, on a pull request), and the UI-system shard reports merge: under the catalog-wide never-rendered rule for the complete lane, against exactly the selected states for a targeted one. |

Each job writes its per-command timings to the run's job summary.

The only shortcut is in `plan`: a pull request whose changed files are all
prose (`*.md`, `*.txt`, `.gitignore`, `LICENSE`) or standalone design gallery
inputs (`docs/design/native-fidelity-mocks/`) skips the test jobs and `ci`
passes on the plan alone. The gallery is a manual HTML/CSS/JS mock-and-image
comparison, not shipped PWA code, production test data or a scheduled test
dependency; `docs/ui-screens/` evidence and other unknown files remain gated. `README.md`, `NOTICE.md`, `docs/recovery-week-policy.md`
and `tools/README.md` are verification inputs, so changes to them run CI despite
their Markdown extension. Files in `fixture`, `fixtures` or `__fixtures__` paths
also run CI even when their extension is allowlisted. Any other file, an unknown
file, a change list the compare API cannot deliver, a push to `main`, the nightly
schedule or a manual dispatch runs the PR lane. There is no draft/ready distinction and no separate
remote candidate mode. **The merge gate is `ci` and `ci-full` both green on the
PR head.** Nobody dispatches `ci-full` by hand: the push runs it. Pull requests
test their head commit, so a red run reproduces with `git checkout <sha>` and
the printed rerun command.
This workflow emits an aggregate status check named `ci`. At the time this CI
change was refreshed, `main` had branch protection disabled and no required
status contexts. This PR does not change branch protection. If it is enabled in
a separate change, requiring `ci` is a separate repository configuration step.

A newer push to the same pull request (or a newer manual run on the same branch)
cancels the run in progress, both lanes at once; runs on `main` never cancel each
other. Both aggregate jobs use `always()` to evaluate their upstream results even
when a run is cancelled: an unexpected cancellation or skip is never accepted as
successful verification. The replacement run for the current PR head supplies
the merge evidence.

### The targeted full lane on pull requests

`selectFullLane` in `tools/test-selection.mjs` decides it in the `plan` job from
the compare API's changed files and their patches, and publishes the selection
(`full_selection`), the runner list (`full_shards`) and whether each full job
runs. Every runner and the `ci-full` gate derive the same commands from that
selection with `fullLaneEntries`, so nothing is decided twice. The mapping is:

| Changed file | Full lane |
| --- | --- |
| Prose (`*.md`, `*.txt`, …) | Nothing, except the full-lane inputs `DESIGN.md` (`check-design-md`), `docs/design/plan-064-reconciliation.md` (`direction-d-gate`) and `README.md` (simulation). |
| A full-lane suite | That command. A PR-lane suite already ran in `ci`: nothing. |
| A test/tool helper | The full-lane commands that import it (the same dependency graph local selection uses). One that reaches a catalog sweep, or nothing scheduled at all, runs everything. |
| `app.js`, `styles.css` | The domains of the reviewed `@ci-domain` regions its hunks touch (`// @ci-domain a,b` in app.js, `/* @ci-domain a,b */` in styles.css; `tools/visual-domains.mjs`). A hunk outside a region, in a `global` region, or that moves a marker runs everything; so does a patch GitHub does not show. |
| Other source owners | The domains in `tools/visual-domains.mjs` (`program-editor.js`, `program-entry*.js`, `progress-model.js`, `progression-engine.js`, `history-ui.js`, `guide-registry.js`, `install-*.js`, `notify.js`). Anything unmapped runs everything. |
| A committed catalog frame | That state's verify and role audit. |
| Program Lab (`programlab/`, `engine-policy.js`, its build tool and fixtures) | The Program Lab commands and the `programlab` states. |
| `sw.js`, `index.html` whose hunks only move `?v=` revisions and the `CACHE` token | Nothing for that file (the PR lane's revision contracts own it). |
| Shared foundations: the `styles.css` tokens and every other unannotated line, `motion-layer.js`, `motion-polish.css`, any other `sw.js`/`index.html` change, `i18n*`, `exercises.js`, `vendor/`, `fonts/`, `icons/`, `assets/`, the workflow, the CI and catalog tooling (`tools/ui-screens/`, the capture/verify/role tools, the manifest, the role inventory, `test/browser.mjs`, `test/suites.mjs`), and any unknown file | The complete full lane. |

**Reviewed boundaries added October 27:** the block-review flow's render and
action controls in app.js are scoped to progress/history/entry/program; the
Program and embedded editor rules in styles.css are scoped to
program/entry/library; and the onboarding entry-card/choice styles are scoped
to entry/program. Nearby code is explicitly returned to global: schedule
commit operations, the exercise-picker/search helpers, the navigation dock,
generic radio states, and exercise-detail header styles. Changing one of
those remains a complete full-lane run. See
[the source-ownership audit](audits/ci-source-ownership-2026-10-27.md)
for the measured selector impact, historical counterexamples and guard tests.

A domain selects the catalog states of the flows with that name (an onboarding
flow counts as `entry`; `session` is the Session summary) and every full-lane
command whose `domains` in `test/suites.mjs` share it (`session` counts as
`workout`). Commands whose domains are `global` (motion integration,
accessibility, i18n, appearance, guide eligibility, sheet swipe, the catalog
contract, CI self-tests) run whenever any source domain is selected. The two
catalog sweeps are re-striped over the selected states only (`check-ui-system
--shard k/K`, `capture-ui-screens --verify --shard k/K` with
`REPFORGE_CATALOG_SCREENS`), never more stripes than the complete lane. The plan
packs the selected browser commands into about eight minutes per runner
(`FULL_TARGET_SHARD_SECONDS`), at most `FULL_SHARDS`. `test/ci.mjs` proves the
mapping: a Focus-only change selects the Workout and Session flows and their
journeys and nothing unrelated, a token change selects everything, and the
staged trigger, the gate and the targeted merge behave as described.

The reviewed regions today: in `app.js`, Today (its prescription, recap and
resume), the Focus workout and its sheets, the Session summary, History,
Progress (overview, Strength, PR timeline, volume, the exercise chart), the
Program overview and the installed editor's sheet, Settings (notifications,
profile, the settings page), the exercise library and custom-exercise editor,
the import review and free-form import, onboarding (routes, generation, review)
and the first-run landing; in `styles.css`, Settings, Today, the Focus block,
the library and import review, Progress, History, the Program ledger, the
landing and the entry route blocks. Shared helpers inside those areas
(`render`, `setFieldVals`, `summaries`, `detectPRs`, the program, settings,
setup-draft and import commits, activation, shared setup, the transition
adapter) stay `global`. `test/ci.mjs` proves each area selects its own flows and
that those shared lines still run everything.

Annotate a region only when everything it renders is drawn inside the flows it
names, and widen the list when a class is shared (the Focus block in
`styles.css` names `today` for the rest bar and `history` for the ledger rows it
shares with History). When unsure, leave it `global`. A wrong annotation can
narrow a PR's full lane, and the complete run on `main` then turns red; fix it
forward and widen the annotation.

Change-detection safety: the GitHub compare API provides changed files only
on the first commit page, with a limit of 300 files. The planner reads that
page once; an absent, empty, malformed or possibly truncated file list runs
the complete full lane. Renames inspect both the old and new paths. Deletions
just before a reviewed annotation boundary conservatively select both
neighboring domains: diff context can place the new-file pointer on the
following region, even when the removed code belonged to the previous one.

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
   the PR lane (a new or strengthened owner in `SUITES`) as well. If the PR's
   targeted full lane skipped the failing command or state, widen the mapping
   (an annotation, a suite's `domains`, a foundation) in the same fix. A stale catalog
   frame (`capture-ui-screens --verify`) is fixed by reviewed recapture
   (`--accept-visual-change`), never by relaxing the comparison.
4. Do not re-run the workflow to get green. The rules for diagnostic replays are
   the same as for `ci`.

### Shards

`CI_SHARDS` (PR lane) and `FULL_SHARDS` (complete full lane) in `test/suites.mjs` are
the runner counts. `shardSuites` packs the
browser inventory longest-first into that many bins using each command's
`seconds` (measured on `ubuntu-latest`; a missing value falls back on `cost`).
The split is a pure function of the committed inventory, so every runner and
every local `shard k/n` computes the same plan. Adding a command to an existing
inventory lane needs no workflow edit; give a command that runs longer than
about twenty seconds a `seconds` value so packing stays balanced. An unknown
lane fails `--check` instead of being silently omitted.
`node tools/run-tests.mjs shard 1/5 --explain`
prints the estimate for that shard and the heaviest one. The account allows 20
concurrent jobs, so a run that overlaps another one queues a few shards for
about one shard's duration; that is why the count is not simply "as many as
possible".

The counts come from measured data (2026-10-23, runs 40029356354 and
39951173955; every browser command's `seconds` is the larger of the two). The
PR lane's browser commands add up to about 1,950 s; five runners hold about
394 s each, which with roughly a minute of checkout and setup keeps the PR lane
near eight minutes, against fourteen runners before that started together with
the full lane and queued. The complete full lane adds up to about 12,550 s;
twelve runners hold about 1,090 s each, so the PR lane (8 jobs) plus a complete
full lane stays under the 20-job limit. Both browser matrices retain full history (fetch-depth: 0) for migration
tests that read old commit files, but apply filter: blob:none to avoid
downloading every historical screenshot and other blob on every runner.
Git fetches missing old blobs on demand; the repository is public and
persist-credentials: false remains enabled. The planner, service and fast
jobs stay on shallow checkouts. This changes transfer/setup, not coverage.
See [the October 27 efficiency audit](audits/ci-runner-efficiency-2026-10-27.md).

PR-browser weights were refreshed from complete per-suite timings
of three successful October 27 CI runs (40489481892, 40491459346,
40536611865); run 40613851336 is an independent holdout sample.
The eight largest positive timing mismatches were updated to their
observed maxima, rounded up. The native gesture gate was underbudgeted:
188s expected versus 236–290s observed. All 45 browser commands still
run exactly once, and the five recalibrated shards each budget 431–434s.
A fixed-duration four-run replay predicts 17–63s less PR-browser
makespan, including 56s on the holdout. These are simulations, **not
observed GitHub wall-clock savings**. See the
[packing audit](audits/ci-pr-browser-packing-2026-10-27.md).

The PR lane keeps five runners within the account's concurrency limit.
The complete full lane still uses twelve runners with approximately
1,090s of estimated browser work per runner and remains staged after
the PR lane.

The browser jobs cache the Chromium
shell and its apt packages: the mirror sometimes served the fonts at about
30 kB/s, which made a few shards spend 10–12 minutes installing.

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

- `tools/check-ui-system.mjs --shard k/8` renders one stripe of the
  screen × theme × locale matrix and writes `ui-system-shard.json` beside its
  evidence. `test/ci.mjs` keeps each stripe's renders × `UI_SYSTEM_STATE_SECONDS`
  (the slowest measured per-state cost) under 85% of its timeout; when the
  catalog outgrows that, raise `UI_SYSTEM_SHARDS` (#456). The rule "every inventory selector rendered somewhere" needs the
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

After a user-visible change, update the catalog frames it affects. Either recapture locally (`node tools/capture-ui-screens.mjs --affected --accept-visual-change`; `--list-affected` shows the plan), or push and take the frames CI rendered:

1. When the critical matrix (`test/ui-system.mjs`) or a catalog verify stripe finds a frame that differs from the committed one, the run publishes the frame it rendered as a `ci-captures-<job>-<index>-<attempt>` artifact, with a `changes-<producer>.json` manifest naming each path, state and reason. The verdict stays red. When a pull request's PR lane is red **only** because critical frames differ (`ci-plan.mjs visual-only`: every failed command is a `test/ui-system.mjs` run marked deterministic, and `fast` and `service` passed), the `full-capture` job runs the targeted verify stripes anyway (`run-tests.mjs full-verify k/n`), so the same run publishes every affected frame and one fetch takes them all. `ci` and `ci-full` stay red until the frames are committed. Where both producers rendered a frame, the verify render is the one placed.
2. `node tools/fetch-ci-captures.mjs <run-id>` downloads those artifacts, refuses frames rendered from a commit other than your `HEAD` (`--allow-source-mismatch` overrides) and any path that is not a registered catalog frame, and writes them under `docs/ui-screens/screens/`. `--dry-run` lists them.
3. Review the frames and commit them. Verification stays exactly as strict: the committed frames must match what CI renders on the next run. If entry semantics changed too, recapture those onboarding states locally to refresh `docs/ui-screens/entry-semantics.json`.

The local selector (`tools/ci-selection.mjs`, `tools/visual-domains.mjs`) decides what you recapture; PR CI verifies the critical matrix and the targeted full lane verifies the affected states, so a stale frame fails the PR. `sw.js` is ignored by the local selector only when the canonical `CACHE` declaration is its sole change.

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
rather than retried away. Timed-out or cancelled scripts are not replayed, and
neither is a failure the suite marks deterministic: a catalog verify whose frames,
registration or entry semantics differ, a critical matrix whose only problems are
frame or semantic differences, or a UI-system shard whose only problems are
rendered-role findings. Those commands write `deterministic-failure.json` into
their evidence directory (`markDeterministicFailure` in `tools/ci-captures.mjs`),
and replaying them would only render the same frames again. A scenario error, a
live role finding in the critical matrix, a protocol assertion or any other
browser failure keeps its replay, so flakes are still labelled.
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
