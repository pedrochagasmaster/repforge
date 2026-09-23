# Plan 062: CI and agent feedback-loop refactor

- **Plan number:** 062
- **Phase:** Engineering infrastructure; outside the UI overhaul programme (049–059)
- **Status:** Proposed — documentation-only planning PR
- **Owner approval state:** This plan records the owner-requested direction. Merging this planning PR approves the engineering direction, not the implementation PRs or their merges.
- **Base inspected:** `origin/main` at `89c5157003719fe2cf3606f7aedd64a54b232a72`
- **Implementation prerequisite:** Reconcile against the final merged state of PR #248 / Plan 057 before starting implementation, because that branch modifies `.github/workflows/simulation.yml`, `test/suites.mjs`, visual evidence and browser synchronization.
- **Depends on:** Existing centralized runner/inventory architecture from the CI refactor already merged on main; current isolated-preview protections; current implementation-evidence protocol.
- **Blocks:** Nothing in product behavior. It should be completed before another large multi-PR implementation programme if practical, because it directly affects agent iteration cost and CI signal.
- **Primary objective:** Shorten the edit → proof → PR feedback loop for coding agents without weakening the final regression, persistence, concurrency, privacy, offline, accessibility, generative or visual evidence gates.
- **Secondary objective:** Make CI semantics legible enough that a red check answers “what failed and why was it selected?” instead of forcing an agent to reconstruct the workflow.
- **Affected engineering surfaces:** `tools/run-tests.mjs`, `tools/test-selection.mjs`, `tools/ci-selection.mjs`, `tools/capture-ui-screens.mjs`, `tools/record-verification.mjs`, a new local-preview owner, a new CI-plan selector, `test/suites.mjs`, `test/ci.mjs`, selected oversized suites, `.github/workflows/simulation.yml`, branch rules, `AGENTS.md`, `test/AGENTS.md`, `tools/AGENTS.md`, `docs/ci.md`, `docs/agents/implementation-evidence.md`, and the execution retrospective.
- **Complexity:** High
- **Risk:** High if implemented as one rewrite; medium when shipped in the staged compatibility sequence defined here.
- **Product behavior:** No intentional product behavior change.

## Executive decision

Taurifer keeps its strong test corpus.

This plan does **not** solve CI pain by deleting difficult race tests, lowering visual
thresholds, retrying flaky tests until green, shortening the 52-week simulation
without retaining an exhaustive equivalent, or treating draft PRs as exempt from
correctness.

The refactor separates three verification loops that are currently conflated:

1. **Edit loop** — answer the next engineering question in seconds or a few minutes.
2. **Packet loop** — prove one coherent implementation slice before expanding it.
3. **Candidate loop** — run the complete engineering gate on the immutable candidate
   that is actually being handed to review.

The repository already contains most of the ingredients: a single inventory,
a quiet runner, conservative affected selection, isolated browser previews,
diagnostic replay, retained artifacts and a separate visual selector. The problem
is that the current default scope is too broad for long-lived branches and the
documentation repeatedly escalates agents back to branch-wide proof during
ordinary corrections.

The target is **less repeated execution, not less evidence**.

---

## Why this plan exists

### Current CI is valuable but expensive

The current suite catches defects worth keeping:

- mirrored persistence and write-ahead-log failures;
- stale-tab and cross-tab races;
- malformed backup/import boundaries;
- setup/share idempotence and generative counterexamples;
- workout completion and DraftV2 recovery;
- Progress transition/provenance invariants;
- privacy and telemetry leakage;
- service-worker/offline/cache compatibility;
- accessibility and focus regressions;
- visual and semantic evidence drift.

The recent failure audit found no evidence of broad “rerun until green”
flakiness. The strongest recent flake signal was localized to browser
synchronization: some initial browser assertions failed and the runner's
diagnostic replay passed on the exact same SHA. The current policy correctly
keeps those runs red.

The tests are therefore not the thing to discard.

### The execution policy is the bottleneck

At the inspected main SHA, `tools/test-selection.mjs` maps `app.js` to all
non-service lanes. For the many Taurifer changes that still touch `app.js`,
this means:

```bash
node tools/run-tests.mjs affected --base origin/main
```

is effectively a full branch regression.

That command is currently the recommended normal coding-agent loop in the
repository guidance. It compares a long-lived PR against its merge-base, so the
selection grows with every prior change in the branch even when the agent is
debugging one small correction.

The resulting behavior is rational given the documentation, but inefficient.

### Evidence from Plans 055–057 agent traces

The owner requested that this plan use the actual Codex traces from Plans
055–057 rather than infer developer behavior from CI configuration alone.

The devbox Codex thread database was inspected directly. The relevant threads
include:

| Thread | Purpose |
|---|---|
| `01a0afb3-6375-7f01-8fe7-264a4fef2831` | Plans 055–056 “be fast” implementation run |
| `01a0b470-0326-7123-9e1b-d014234e7812` | Plans 055–056 audit remediation |
| `01a0c5aa-063d-7503-a2df-808b8a661e4f` | Plan 057 takeover |
| `01a0ca75-5038-7100-ad8d-d06134383b54` | Plan 057 final remediation |
| `01a0cb97-c638-7171-b8ef-379ff4b78ab4` | Plan 057 final closure |

The observed command history demonstrates both failure modes this plan must
prevent.

#### Failure mode A — defer too much proof

The Plans 055–056 speed prompt explicitly said not to test between
implementation commits and to batch verification at the end.

That did not remove validation cost. It moved defect discovery later, after
several interacting changes accumulated. The run then spent substantial time in
focused browser debugging, full simulations, visual recapture and correction
cycles.

Approximate recorded execution in that thread:

- ~134 minutes in direct test commands;
- ~173 minutes in runner lane commands;
- ~142 minutes in visual capture commands;
- one branch-wide affected run of ~57 minutes;
- repeated simulation and browser corrections after implementation had already
  expanded.

The lesson is not “test every edit exhaustively.” It is that a risky contract
still needs an early, cheap falsification point.

#### Failure mode B — repeatedly re-prove the whole branch

Later Plan 057 work moved to the opposite extreme.

Observed approximate totals:

| Run | Branch-wide `affected` | Focused/other tests | Visual work | Remote CI waiting |
|---|---:|---:|---:|---:|
| Plan 057 takeover | ~252 min across 7 affected runs | ~25 min | ~179 min | ~90 min in `gh run watch` |
| Plan 057 remediation | ~73 min across 3 affected runs | ~15 min | ~3 min | ~45 min in `gh run watch` |
| Plan 057 final closure | ~332 min across 12 affected runs | ~68 min | ~59 min | small compared with local reruns |

Those runs often did the right focused test first, then escalated immediately
to the entire branch because “affected proof” was the documented next step.
A later tiny correction invalidated the broad run and restarted the cycle.

The Plan 057 closure trace also shows repeated clean-SHA proof by executing a
focused suite once normally and then executing the same suite again through
`tools/record-verification.mjs`.

#### Failure mode C — browser preview ownership still leaks into agent work

The test runner now owns a fresh isolated preview when `REPFORGE_URL` is
unset, and it verifies the worktree identity of an explicitly supplied local
server.

That fix is good.

The traces still show manually started servers for visual work on ports such as
`8807`, `8617`, `8765`, `8772`, `8124` and `8000`. The browser runner
and the visual capture tool therefore have different ergonomics, and agents keep
falling back to port bookkeeping.

The plan must make “no manual server” the normal path for both tests and
screenshots.

#### Failure mode D — remote CI becomes idle waiting

One Plan 057 run spent roughly ninety minutes in `gh run watch`; another spent
roughly forty-five.

Waiting for the immutable final candidate is legitimate. Blocking an
implementation agent on remote CI while independent local work remains is not.

The repository should explicitly distinguish the two.

---

## Governing invariants

Every implementation PR under this plan must preserve these invariants.

### I1 — one executable inventory

`test/suites.mjs` remains the one executable inventory.

No workflow, shell script, plan document or new runner may introduce a second
hard-coded test list.

### I2 — final candidate coverage does not shrink silently

The final candidate must retain the semantic coverage that the current complete
gate provides unless an assertion is deliberately moved to a cheaper test that
proves the same contract.

Moving an assertion is allowed.
Deleting a contract because it is expensive is not.

### I3 — no retry-to-green

A failed initial browser execution remains a failed gate even if diagnostic
replay passes.

Diagnostic replay is classification evidence, not a retry policy.

### I4 — unknown change impact fails safe

Fast selection is permitted only where a direct suite relationship, static
dependency, reviewed domain mapping or explicit annotation proves the affected
consumer.

Unknown executable/runtime inputs widen coverage.

### I5 — edit selection is not completion evidence

A narrow edit loop answers “did this correction fix the contract I am working
on?”

It does not answer “is this PR ready to merge?”

The tooling and docs must not blur those claims.

### I6 — packet evidence has an explicit base

A packet is a coherent implementation unit with a known start SHA.

Its regression selection is computed from that base, not from the branch's
original merge-base.

### I7 — candidate evidence is SHA-bound

The exhaustive candidate gate is tied to one exact head SHA.

A source change creates a new candidate.

### I8 — browser servers have one owner

Normal browser tests and visual capture must allocate, identify and clean up
their own isolated preview.

No ordinary agent instruction should require choosing a port.

### I9 — visual evidence is independently selected

Test selection and visual selection remain separate.

A source file can affect tests without affecting pixels, and vice versa.

### I10 — measurement precedes claims

The implementation must record before/after selection size and elapsed time.
Do not claim the refactor is faster merely because it has more modes.

---

## Target verification model

### Loop A — edit

**Question:** Did the code I just changed satisfy the contract I am actively
working on?

Typical commands:

```bash
node tools/run-tests.mjs edit
node tools/run-tests.mjs entry --suite share-repair
node tools/run-tests.mjs workout --suite history-edit
```

Properties:

- dirty working trees are allowed;
- selection is based on the smallest current delta;
- fail-fast is the default;
- no clean-SHA evidence claim;
- no branch-wide visual sweep;
- no remote CI wait;
- expected typical wall time: seconds to roughly two minutes.

### Loop B — packet

**Question:** Does this coherent slice integrate with the consumers it can
reasonably affect?

Typical command:

```bash
node tools/run-tests.mjs packet --base <packet-start-sha>
```

Properties:

- explicit packet base;
- includes committed packet changes plus current working-tree changes;
- selection is broader than edit but narrower than branch;
- fail-fast locally by default;
- clean committed packet can emit provenance evidence in the same execution;
- expected typical wall time: roughly two to eight minutes for ordinary UI/domain
  packets; high-risk persistence packets may legitimately exceed this.

### Loop C — candidate

**Question:** Is this exact engineering candidate ready for owner/reviewer
handoff?

Typical local/remote interface:

```bash
node tools/run-tests.mjs candidate
gh workflow run simulation.yml \
  --ref <branch> \
  -f mode=candidate \
  -f expected_sha=<40-char-sha>
```

Properties:

- clean source required for recorded evidence;
- complete required lanes;
- keep-going to collect all failures;
- exhaustive long-horizon and race suites;
- exhaustive visual evidence initially;
- remote candidate run expected once per intended candidate SHA, not after every
  edit;
- source changes invalidate the candidate.

### Branch scope remains available

A branch-wide selector is still useful for diagnostics and migration.

```bash
node tools/run-tests.mjs branch
```

It keeps today's conservative merge-base semantics.

It is **not** the default inner loop.

---

# Implementation sequence

This plan is intentionally divided into four implementation PRs plus a final
configuration step. Do not combine them into one large refactor.

Each PR must remain independently reviewable and preserve the old interface
until the replacement path is proven.

## PR 062-A — Local runner and preview ergonomics

### Goal

Create the edit/packet/branch/candidate vocabulary, make local feedback
fail-fast, eliminate duplicate focused-evidence execution, and give browser
tests and screenshot capture the same isolated-preview owner.

No GitHub Actions coverage reduction belongs in this PR.

### A1. Add scope vocabulary to `tools/run-tests.mjs`

Add these top-level modes:

```text
edit
packet
branch
candidate
```

Keep existing lane and `--suite` forms.

Keep `affected` temporarily as a compatibility alias for the current
branch-wide selector. It should emit a concise deprecation note explaining that
agents should normally choose `edit` or `packet`.

Do not make `affected` silently change semantics during migration.

### A2. Define edit-base resolution exactly

`edit` uses the smallest delta that still captures the active correction.

Rules:

1. If the working tree has tracked or untracked changes:
   - compare tracked changes against `HEAD`;
   - include untracked non-ignored files;
   - do not include earlier branch commits.
2. If the working tree is clean and `HEAD` has a parent:
   - compare `HEAD^` to `HEAD`.
3. If the worktree is clean at a root commit:
   - fall back to branch selection.
4. Renames must include both source and destination where impact differs.
5. Deleted files remain inputs to dependency mapping.
6. A missing/invalid base must widen rather than silently select nothing.

This mode optimizes feedback and may use a more targeted selector than final
coverage.

### A3. Define packet-base resolution exactly

`packet` requires either:

```bash
node tools/run-tests.mjs packet --base <sha-or-ref>
```

or an explicit environment variable documented for agent orchestration.

Do not infer a packet boundary from commit-message conventions.

The effective file set is:

```text
diff(packet-base, HEAD)
+ tracked working-tree changes
+ untracked non-ignored files
```

If the requested base is not an ancestor of `HEAD`, resolve its merge-base
and print that fact.

If no safe base exists, refuse with an actionable message rather than silently
running the wrong scope.

### A4. Rename today's affected semantics to branch internally

`branch` resolves the merge-base with `origin/main` and otherwise preserves
the current conservative `selectAffected` behavior.

The old public `affected --base origin/main` invocation remains supported until
the documentation migration is merged.

### A5. Candidate semantics

`candidate` runs all locally applicable suites from the central inventory:

- fast;
- state;
- entry;
- workout;
- privacy;
- service only when its environment/dependency requirements are locally
  available and the plan says it is applicable.

Candidate mode must not hide a skipped required environment gate. It prints
`SKIPPED — external/environment gate` with the governing reason rather than
treating absence as success.

Visual evidence stays a separate operation in 062-A; integration comes in
062-C.

### A6. Add fail-fast and keep-going policy

Expose:

```text
--fail-fast
--keep-going
```

Default behavior:

| Invocation | Default |
|---|---|
| exact `--suite` | fail-fast |
| `edit` | fail-fast |
| `packet` | fail-fast |
| local `branch` | fail-fast |
| local `candidate` | keep-going |
| GitHub Actions lanes | keep-going within the intended lane unless workflow-level cancellation applies |

On local fail-fast, retain the same full log/artifact semantics as today for the
failed suite.

A fail-fast stop is not reported as “passed” for unexecuted suites. Result JSON
must distinguish:

```text
passed
failed
not-run-after-failure
skipped-not-applicable
```

### A7. Print the next repair command

Every failed runner invocation should print one concise actionable rerun command.

Example:

```text
FAILED  test/shared-setup-flow.mjs
Log: .ci-results/entry/test-shared-setup-flow-mjs/initial/output.log

Rerun only this contract:
  node tools/run-tests.mjs entry --suite shared-setup-flow
```

For argumented suites, print the exact inventory command, not a guessed filename.

### A8. Add `--list` and `--explain`

Every scope supports:

```bash
node tools/run-tests.mjs edit --list
node tools/run-tests.mjs packet --base <sha> --explain
node tools/run-tests.mjs branch --explain
```

`--list` prints the exact selected commands and exits without executing.

`--explain` prints:

- resolved base;
- changed files;
- selection mode;
- reason each domain/suite was included;
- reason for any broad fallback;
- count by lane.

Successful default execution remains quiet; this output is opt-in except for a
one-line selection summary.

### A9. Split selector responsibilities

Refactor `tools/test-selection.mjs` into explicit exported concepts:

```js
selectEdit(files, context)
selectPacket(files, context)
selectBranch(files, context) // current conservative selectAffected semantics
```

A shared mapping implementation is encouraged; three independent rule tables are
not.

The important difference is policy:

- **edit:** cheapest defensible consumers;
- **packet:** all reviewed consumers of the packet;
- **branch:** conservative complete branch impact.

### A10. Edit selector precedence

For each changed path, edit selection proceeds in this order:

1. directly scheduled changed suite;
2. reverse static dependency into scheduled suites;
3. explicit input rule;
4. reviewed runtime-domain mapping;
5. safe static syntax/build checker for the changed asset;
6. unknown input → branch selector fallback.

A direct changed browser suite should not select its entire browser lane merely
because the file lives in `test/`.

A test-support helper selects only scheduled suites reachable through the static
dependency graph where that graph is reliable.

### A11. Packet selector precedence

Packet selection starts from the edit rules but is intentionally broader.

A reviewed runtime domain selects all packet-tier suites for that domain.

High-risk ownership files retain explicit widening:

- `durable-state.js`;
- `workout-draft.js`;
- service-worker/cache contract files;
- shared setup encoding/decoding;
- compiler/transition boundaries;
- telemetry/privacy boundary files.

Do not reduce those to superficial UI smoke tests.

### A12. One-execution evidence recording

Add an option such as:

```bash
node tools/run-tests.mjs entry \
  --suite share-repair \
  --evidence /tmp/share-repair.json
```

When `--evidence` is present:

1. require a clean source worktree;
2. record exact `HEAD` and tree before execution;
3. record command, runtime, timestamps and output;
4. execute once;
5. record exact `HEAD`, tree and status afterwards;
6. fail evidence if source changed;
7. emit the same outcome vocabulary as `record-verification.mjs`.

The report must explicitly say that command success is execution provenance,
not semantic approval.

`tools/record-verification.mjs` remains available for arbitrary commands.

Do not make agents run a focused suite twice just to obtain provenance.

### A13. Extract local preview ownership

Create:

```text
tools/local-preview.mjs
```

Move/reuse the tested preview lifecycle currently embedded in
`tools/run-tests.mjs`.

It owns:

- fresh loopback port allocation;
- analytics-disabled generated preview;
- worktree identity marker;
- readiness probes with bounded per-request timeout;
- child process group;
- environment export;
- cleanup on normal exit;
- cleanup on failure;
- cleanup on SIGINT/SIGTERM;
- restoration of generated files.

The API must make ownership explicit:

```js
const preview = await startLocalPreview({ cwd, env, ... });
try {
  await work(preview.env);
} finally {
  await preview.cleanup();
}
```

### A14. Browser runner consumes shared preview module

Replace private runner preview code with `tools/local-preview.mjs`.

Preserve every current protection verified by `test/ci.mjs`:

- analytics disabled;
- no secret PostHog token;
- generated files restored;
- hanging readiness request bounded;
- isolated port;
- current-worktree identity check for supplied loopback servers;
- stale server rejection;
- cleanup after interruption.

### A15. Screenshot capture consumes shared preview module

When `REPFORGE_URL` is unset:

```bash
node tools/capture-ui-screens.mjs --screen history/edit-invalid
```

must start and clean up its own isolated preview.

When `REPFORGE_URL` is explicitly set to loopback, capture must verify the same
worktree identity marker before trusting it.

Remote/non-loopback URLs remain explicit expert inputs and must never receive a
local identity marker.

### A16. Preserve explicit server override

Manual local development may still use:

```bash
python3 -m http.server <port> --directory <worktree>
REPFORGE_URL=http://127.0.0.1:<port>/ node tools/run-tests.mjs ...
```

The runner/capture tool must verify identity.

This is an escape hatch, not the documented normal flow.

### A17. Timing telemetry for the runner itself

Retain per-suite timings and add per-invocation summary fields:

```json
{
  "scope": "packet",
  "selectionCount": 8,
  "selectionByLane": {"fast":2,"entry":4,"state":2},
  "selectionDurationMs": 17,
  "executionDurationMs": 182341,
  "failed": 0,
  "notRun": 0
}
```

This is local/CI engineering telemetry only. Do not send it to PostHog.

### A18. 062-A tests

Expand `test/ci.mjs` with at least:

- dirty edit selects only current working-tree impact;
- clean edit selects only the last commit;
- packet includes commits since explicit base plus dirty/untracked changes;
- invalid packet base refuses;
- branch preserves existing conservative behavior;
- unknown edit input widens safely;
- direct changed test does not automatically select a whole lane;
- fail-fast prevents a later fixture from executing;
- keep-going executes the later fixture;
- result JSON distinguishes not-run from skipped;
- failure output prints the exact rerun command;
- `--evidence` refuses dirty source;
- `--evidence` records one execution at an unchanged SHA;
- preview module restores files on success/failure/signal;
- capture obtains isolated preview automatically;
- explicit stale server is rejected by capture as well as tests;
- concurrent worktrees receive distinct ports and identity markers.

### A19. 062-A completion gate

Before 062-A can merge:

```bash
node --test test/ci.mjs
node tools/run-tests.mjs --check
node tools/run-tests.mjs edit --list
node tools/run-tests.mjs branch --list
git diff --check
```

Run representative browser evidence with `REPFORGE_URL` unset and prove no
server remains afterwards.

Record measured selection count and wall time for at least:

- a changed test file;
- a small domain source file;
- `app.js`;
- `durable-state.js`;
- a UI screenshot manifest change.

No GitHub Actions coverage reduction is authorized in this PR.

---
## PR 062-B — Change-proportional GitHub Actions

### Goal

Make draft-PR CI useful as a rapid remote feedback mechanism while preserving a
complete exact-SHA candidate gate before engineering handoff.

Do not start 062-B until 062-A's local selectors are merged and have been used
successfully on real PR work.

### B1. Add one CI planning tool

Create:

```text
tools/ci-plan.mjs
```

It consumes:

- event type;
- PR draft/ready state;
- base SHA;
- head SHA;
- changed files;
- central test inventory;
- test selector;
- visual selector;
- optional explicit workflow-dispatch mode.

It writes a machine-readable plan before expensive installation begins:

```json
{
  "schemaVersion": 1,
  "mode": "feedback",
  "baseSha": "...",
  "headSha": "...",
  "tests": {
    "fast": ["..."],
    "state": ["..."],
    "entry": ["..."],
    "workout": ["..."],
    "privacy": []
  },
  "service": {"required": false, "commands": []},
  "visual": {
    "mode": "screens",
    "screens": ["history/edit-invalid"]
  },
  "reasons": [
    "history-ui.js: history domain",
    "test/history-edit.mjs: direct suite"
  ]
}
```

The plan is uploaded as a CI artifact on every run.

### B2. CI modes

Support exactly two workflow meanings:

#### Feedback mode

Used automatically for draft PR synchronization.

Purpose:

- fast enough to guide implementation;
- selected from changed code;
- red means action is needed now;
- not sufficient by itself for candidate handoff.

It may run:

- universal cheap contracts if their measured cost justifies it;
- selected state suites;
- selected entry suites;
- selected workout suites;
- privacy when affected;
- service when affected;
- selected visual evidence.

#### Candidate mode

Used for the final engineering candidate.

Purpose:

- complete automated engineering proof;
- exact SHA;
- all required lanes;
- exhaustive visual evidence initially;
- artifacts retained;
- aggregate required check.

Candidate mode is triggered by:

1. ready-for-review PR events where that fits the repository workflow; or
2. explicit `workflow_dispatch` for PRs intentionally kept draft because an
   owner/device gate remains.

### B3. Do not overload PR draft state with product approval

Taurifer frequently keeps a PR draft after engineering work is complete because
the owner still owes a physical-device or product-review gate.

Therefore “ready for review” cannot be the only route to candidate CI.

Add workflow-dispatch inputs:

```yaml
mode:
  description: Verification scope
  type: choice
  required: true
  options:
    - feedback
    - candidate
expected_sha:
  description: Exact 40-character candidate SHA
  required: true
```

Candidate dispatch must verify:

```text
resolved ref SHA == expected_sha
```

before browser installation or tests.

A mismatch fails immediately with the two observed SHAs.

### B4. Preserve stable check names

Keep the externally visible aggregate check name `simulation` unless there is
a compelling migration reason.

The goal is to change how work is selected, not churn branch rules and PR
expectations unnecessarily.

Internal job names may become more precise.

### B5. Compute the plan before dependency installation

The first lightweight job should:

1. check out enough Git history to resolve the diff;
2. run `tools/ci-plan.mjs`;
3. expose outputs for matrix jobs;
4. upload the plan.

Do not install Playwright before discovering that no browser work is selected.

### B6. Dynamic browser matrix

The browser matrix should receive selected suite commands rather than an entire
lane when feedback mode is active.

Implementation must continue to derive commands from `test/suites.mjs`.

Do not serialize a duplicate command list into YAML.

A safe pattern is:

```text
plan job
  ↓
selected browser matrix [state, entry, workout as needed]
  ↓
runner receives serialized suite ids/names validated against inventory
```

If GitHub Actions expression limits make command-level dynamic matrices brittle,
select whole *domains within a lane*, not a handwritten test list.

Correctness outranks clever YAML.

### B7. Candidate mode stays exhaustive initially

Candidate mode runs the complete current automated contract:

- `interaction-runtime` / fast;
- state;
- entry;
- workout;
- telemetry/privacy;
- applicable install-transfer service gate;
- verification evidence alias if still required for compatibility;
- full visual catalog;
- aggregate `simulation`.

A later measured optimization may narrow candidate visuals under 062-C's rollout
criteria. 062-B itself does not.

### B8. Main remains exhaustive

`push: main` runs candidate-equivalent regression.

This provides:

- post-merge safety;
- selector-miss detection;
- a stable source for timing trends;
- evidence that feedback-mode selection did not hide a defect permanently.

### B9. Scheduled canary

Add a low-frequency scheduled exhaustive run only if it provides information not
already produced by normal main pushes.

Do not add a nightly workflow by reflex.

A schedule is justified if:

- main can remain unchanged for long periods;
- browser/runtime drift matters;
- hosted-runner changes or pinned browser installation need periodic proof.

If added, document what decision depends on it.

### B10. Cancel obsolete feedback, preserve candidate runs

Feedback mode:

```yaml
cancel-in-progress: true
```

A newer PR commit makes the old feedback result obsolete.

Candidate mode:

- use an exact-SHA-specific concurrency group;
- do not cancel an immutable candidate merely because another draft commit
  appears unless the candidate is explicitly superseded.

The workflow summary should clearly label a superseded candidate if source moved.

### B11. Remote waiting policy

The repository must stop teaching agents to block in `gh run watch` during
normal implementation.

Documentation should prescribe:

1. push packet;
2. take one concise check snapshot;
3. if still running and useful local work exists, continue that work;
4. inspect failed jobs immediately if/when red;
5. wait synchronously only for the immutable final candidate when no independent
   engineering work remains.

If an explicit helper is useful, add:

```bash
node tools/wait-for-ci.mjs --sha <sha> --check simulation
```

Requirements:

- polls one aggregate context;
- bounded timeout;
- compact status transitions only;
- verifies returned run belongs to requested SHA;
- on failure prints job IDs/URLs needed for log inspection;
- never retries the workflow.

### B12. CI summary

The GitHub step summary should show:

```text
Mode: feedback
Base: <sha>
Head: <sha>

Selected:
  fast       8 commands
  state      2 commands
  entry      4 commands
  workout    0 commands
  privacy    not affected
  visual     3 screens / 17 frames

Why:
  ...
```

On candidate runs:

```text
Mode: candidate — exhaustive
Candidate SHA: ...
```

No reviewer should need to read YAML to understand scope.

### B13. Feedback is not merge evidence

PR status text and docs must use distinct terms:

- `Feedback CI passed`;
- `Candidate CI passed at <SHA>`.

Never write only “CI green” when feedback mode ran.

### B14. Shadow-selection rollout

Before feedback mode is trusted as the default draft workflow:

1. calculate the new feedback plan;
2. calculate the legacy/current branch selection;
3. record differences;
4. run the new selection;
5. continue running the old selection for a bounded observation window or on a
   representative sample.

The plan comparison should identify:

- tests legacy selected but feedback omitted;
- why feedback omitted them;
- whether final/main candidate runs later found defects in omitted areas.

Do not immediately call every omission a defect: the purpose is to remove
irrelevant coverage. But every omission needs a reviewed mapping rationale.

### B15. 062-B acceptance

Tests in `test/ci.mjs` or a focused CI-plan suite must cover:

- draft PR selects feedback;
- non-draft/candidate dispatch selects candidate;
- dispatch SHA mismatch refuses;
- main push selects exhaustive;
- no browser suite → browser install job skipped;
- privacy-only change does not install unrelated browser lanes if unnecessary;
- service-only change does not execute root browser regression;
- unknown input broadens;
- plan contains exact base/head;
- command IDs all resolve to central inventory;
- obsolete feedback concurrency cancels correctly by construction;
- candidate concurrency key contains exact SHA.

Measured evidence must compare representative PR changes before/after:

- docs only;
- one test;
- one History behavior;
- one Progress behavior;
- one shared shell change;
- one durable-state change;
- one global CSS change.

---

## PR 062-C — Visual evidence economics and domain selection

### Goal

Stop spending full-catalog capture time on changes that cannot affect the full
catalog, while retaining an exhaustive visual safety net until selector recall
is demonstrated.

### C1. Fix obvious non-rendering classifications first

At the inspected main SHA, `test/ci.mjs` deliberately expects several
non-product inputs to force a full visual sweep.

Reclassify non-rendering inputs where evidence proves they cannot alter rendered
output.

Candidates include:

```text
.github/workflows/**
docs/ci.md
AGENTS.md
test/suites.mjs
tools/run-tests.mjs
tools/test-selection.mjs
tools/ci-plan.mjs
tools/wait-for-ci.mjs
```

A workflow timeout change must not trigger an 800+ frame recapture.

### C2. Keep real capture dependencies conservative

These remain full visual inputs unless a finer dependency is proven:

```text
test/browser.mjs
capture-relevant test/fixtures/**
tools/capture-ui-screens.mjs
tools/ui-screens/**
docs/ui-screens/manifest.json
global theme/token inputs
font/media changes that can alter geometry
unknown render inputs
```

### C3. Define visual domains from existing flows

Use the existing manifest flow taxonomy, not a parallel screen ontology.

Initial domains:

| Domain | Manifest flows / screen families |
|---|---|
| history | `history/*` |
| install | `install/*` |
| library | `library/*` |
| entry | onboarding-* and import/entry program states |
| program | `program/*` |
| progress | `progress/*` |
| session | `session/*` |
| settings | `settings/*` |
| today | `today/*` |
| workout | `workout/*` |
| global | every manifest screen |

Domains may overlap deliberately.

For example a workout change may require `workout`, `session` and `today`.

### C4. One reviewed source-to-visual mapping

Create one mapping consumed by both local capture selection and CI selection.

Do not encode one mapping in `ci-selection.mjs` and another in a workflow.

The mapping needs:

- exact path rules;
- domain union behavior;
- global fallbacks;
- reasons.

### C5. Handle `app.js` without pretending file-level mapping is enough

`app.js` remains a major shared file. Treating any `app.js` edit as global
makes domain selection nearly useless; pretending all edits can be inferred
from function names is unsafe.

Add explicit source annotations around stable ownership regions, for example:

```js
// @ci-domain entry
...
// @ci-domain history
...
// @ci-domain progress
...
// @ci-domain workout
...
// @ci-domain global
...
```

These comments have no runtime meaning.

The selector reads zero-context diff hunks and assigns each changed line to the
nearest enclosing declared domain.

Rules:

1. annotations use a closed vocabulary checked in CI;
2. an unannotated changed hunk in a shared file widens to global;
3. a hunk crossing boundaries unions those domains;
4. boot, storage, locale bootstrap, navigation shell and other genuinely shared
   regions may deliberately be `global`;
5. the checker must reject malformed/nested/unknown domain annotations;
6. do not annotate every helper narrowly merely to make CI fast.

The same technique may be used in other large mixed-ownership files only where
it stays legible.

### C6. CSS remains conservative

Do not attempt sophisticated CSS dependency parsing in this plan.

Classify:

- design tokens, root typography, themes, shared layout primitives → global;
- obviously domain-scoped files/selectors only if the project later has a
  stable ownership boundary that can be mapped safely.

For the current monolithic `styles.css`, global fallback is acceptable.

The plan should improve common JS/UI-local changes without gambling on CSS.

### C7. Local affected visual command

Add:

```bash
node tools/capture-ui-screens.mjs --affected
node tools/capture-ui-screens.mjs --affected --base <sha>
node tools/capture-ui-screens.mjs --list-affected --base <sha>
```

Normal semantics:

- compute changed files;
- compute visual domains/screens;
- start isolated preview automatically;
- capture only selected complete screen variants;
- never capture one isolated variant if the contract says the screen owns a
  variant matrix;
- atomically replace selected frames;
- run catalog registration;
- compare selected current frames against the preserved pre-capture baseline.

### C8. Do not overwrite the baseline before comparison

The capture command must preserve the selected committed baseline in a temporary
read-only directory before replacing catalog files.

A successful affected capture means:

1. capture completed;
2. expected files are registered;
3. semantic extraction completed where applicable;
4. perceptual comparison ran against the original baseline or an explicitly
   approved new-state workflow;
5. no unrelated catalog files changed.

Do not infer success merely from “PNG files were produced.”

### C9. Separate “expected UI changed” from accidental drift

A UI implementation intentionally changing a screen will naturally differ from
its prior baseline.

The tool must distinguish:

- **capture integrity:** can the intended scenario be rendered correctly?;
- **baseline drift:** did pixels/semantics change?;
- **approval/update:** are the new committed frames the intended evidence?

For local implementation, a selected changed screen may be updated intentionally.

For CI, committed frames are the expected baseline and recapture must match them.

Do not weaken the current CI drift contract.

### C10. Feedback visual mode

Draft feedback CI uses affected visual selection.

If selection is:

- `none`: do not install Chromium for the visual job;
- `screens`: capture those screens and all required variants;
- `full`: perform full capture.

### C11. Candidate visual mode remains full initially

For the first rollout period, candidate CI and `main` retain full visual
capture.

This is the oracle used to assess whether affected selection misses drift.

### C12. Selector-recall audit

For a bounded observation window — recommended at least two weeks **and** enough
UI-changing PRs to exercise several domains — collect:

- affected screens predicted by selector;
- full candidate/main drift;
- any changed screen outside prediction;
- root cause of each miss;
- false-positive full/domain expansions;
- elapsed time and frame count.

Only after the owner/reviewer accepts selector recall may candidate visual
capture become affected-by-default.

Even then, `main` may remain full if cost is acceptable.

### C13. Visual concurrency

Do not raise capture concurrency merely to hide selection problems.

Use measured safe concurrency for hosted runners and local devbox hardware.

The capture tool must remain deterministic with `CAPTURE_CONCURRENCY=1`.

Higher concurrency is an optimization and must not change artifacts.

### C14. 062-C tests

Expand `test/ci.mjs` and visual selector tests to prove:

- workflow YAML → no visual capture;
- runner/test inventory docs → no visual capture;
- capture tool → full;
- browser fixture used by catalog → full;
- one History annotation → only History screens;
- Progress annotation → Progress screens;
- global annotation → full;
- unknown `app.js` hunk → full;
- two domains in one diff → union;
- invalid annotation → selector/checker failure;
- baseline-only PNG change recaptures its whole screen matrix;
- global CSS → full;
- semantic baseline input selects the right semantic proof.

---

## PR 062-D — Test corpus cost decomposition

### Goal

Move assertions to the cheapest layer that can prove them so selectors have
meaningful units to choose from.

Do not turn this into a broad product refactor.

### D1. Add scheduling metadata to the suite inventory

Extend suite descriptors in `test/suites.mjs`:

```js
s("test/history-edit.mjs", [], {
  domains: ["history"],
  cost: "normal",
  tier: "feedback"
})
```

Supported metadata:

```text
domains: closed set of engineering domains
cost: tiny | normal | long
tier: feedback | packet | candidate
browser: derived where possible; explicit only when necessary
timeoutMs: existing behavior
env: existing behavior
```

Semantics:

- **feedback**: reasonable to run in ordinary targeted feedback when affected;
- **packet**: broader/high-risk regression after a coherent slice;
- **candidate**: expensive proof normally reserved for final candidate, unless
  a direct edit or governing high-risk mapping explicitly selects it.

Tier is scheduling policy, not importance.

### D2. Prevent metadata from hiding direct tests

If an agent changes `test/simulation.mjs` itself, the direct suite can run in
edit mode even if it is candidate-tier.

If an owning high-risk domain change requires a candidate-tier race suite by
explicit rule, selection may promote it.

The tier only prevents unrelated edits from pulling long tests into every packet.

### D3. Decompose the 52-week simulation

Audit every assertion in `test/simulation.mjs`.

Classify assertions as:

1. requires long chronological progression;
2. requires integration but not 52 weeks;
3. focused UI/render/copy contract;
4. duplicate of a more direct suite.

Retain long-horizon categories in a candidate-level simulation.

Move focused contracts to their owning suites.

Examples of assertions that should not require five-plus minutes of history
generation:

- exact session-summary text;
- small DOM label/count formatting;
- isolated management-summary presentation;
- selector ownership already proven by a dedicated browser suite.

Do not move an assertion unless the new test reaches the real production
producer/consumer needed by the contract.

### D4. Add a short deterministic simulation profile

If measurement supports it, expose:

```text
simulation smoke/integration profile
simulation 52-week candidate profile
```

The short profile must exercise enough real lifecycle to detect integration
breakage during packet verification.

The candidate profile preserves the full long-horizon behavior.

Do not simply reduce `REPFORGE_SIM_WEEKS` everywhere.

### D5. Split `entry-privacy.mjs` by contract

The current file combines multiple concerns. Split along behavior boundaries,
for example:

```text
test/privacy-contract.mjs
test/privacy-ui.mjs
test/privacy-offline.mjs
test/privacy-share-flow.mjs
```

Exact names may vary after inspecting the final post-057 code.

Desired ownership:

- pure enumerations/content/schema contracts → fast;
- UI opening/closing/focus → entry;
- service-worker/offline → state or dedicated offline packet;
- share privacy behavior → entry/privacy as appropriate.

### D6. Remove timer sleeps from synchronization

Replace fixed waits such as animation-delay sleeps with observable state:

- production class/state transition;
- focus target reached;
- animation/transition completion signal if meaningful;
- stable app lifecycle hook;
- exact journal/write completion for persistence tests.

Do not replace one arbitrary sleep with a longer arbitrary sleep.

### D7. Preserve diagnostic replay

Keep one diagnostic replay for failed browser suites.

Enhance retained result metadata:

```json
{
  "status": "failed",
  "initial": {"exitCode": 1},
  "diagnostic": {"exitCode": 0},
  "suspectedFlake": true
}
```

The overall suite remains failed.

GitHub summary should say:

```text
Suspected synchronization flake:
  initial failed
  diagnostic replay passed
Gate remains red.
```

### D8. Measure flake evidence

Aggregate engineering-only metrics from CI artifacts or workflow summaries:

- initial browser failures;
- diagnostic replay passes;
- diagnostic replay failures;
- timeout failures;
- infrastructure/setup failures.

Do not create a product telemetry event.

This allows future refactors to target actual flaky suites instead of relying on
anecdote.

### D9. Audit accessibility suite decomposition

`test/accessibility.mjs` is allowed to remain broad if broad integration is the
only safe way to prove the contract.

Audit whether some checks can become:

- pure static semantics;
- per-domain accessibility journeys;
- candidate-only global accessibility sweep.

The goal is selection precision, not smaller files for its own sake.

### D10. Race suites remain strict

Do not weaken:

- `persistence-race.mjs`;
- `thermonuclear-races.mjs`;
- History persistence races;
- DraftV2 stale-tab/recovery races;
- transition provenance races.

Optimization should come from selecting them only for relevant packet/candidate
work, not from deleting fault injection.

### D11. 062-D acceptance

For every moved assertion:

- identify old owner;
- identify new owner;
- show why the new test is at least as semantically strong;
- demonstrate the new test fails on a deliberate equivalent defect where
  practical;
- remove the old duplicate only after replacement proof is green.

Run complete candidate regression before merging 062-D.

---
## PR 062-E — Documentation, policy and merge-gate convergence

This documentation work may be split across 062-A–D as the underlying commands
land, but every item below must be complete before the plan itself is considered
implemented.

Do not document commands before they exist.

### E1. Root `AGENTS.md`

Replace the current default instruction:

```text
during implementation run node tools/run-tests.mjs affected --base origin/main first
```

with a maturity-based loop.

Required substance:

```text
Agent verification loop

1. During an edit:
   - run the exact owning suite when known; otherwise run:
       node tools/run-tests.mjs edit
   - fix an exact failure with the exact suite.
   - do not run branch/candidate just to discover whether more things fail.

2. After a coherent implementation packet:
   - commit the packet;
   - run:
       node tools/run-tests.mjs packet --base <packet-start-sha>
   - record focused/packet evidence when the governing plan requires it.

3. Before engineering handoff:
   - establish one clean candidate SHA;
   - run/dispatch candidate verification once for that SHA;
   - inspect remote checks against that exact SHA.

4. A source change after candidate verification creates a new candidate and
   invalidates only the evidence whose dependency intersects the change plus
   the final same-candidate gate required by the governing plan.
```

Also state explicitly:

- `edit` is not completion evidence;
- `packet` is the normal broad local proof;
- `branch` is diagnostic/migration scope, not an automatic post-edit step;
- `candidate` is expensive and belongs at the completion boundary;
- normal browser/capture commands leave `REPFORGE_URL` unset;
- do not manually choose a port for normal automated evidence;
- do not use `gh run watch` while useful independent local work remains;
- do not retry a failed Actions run merely to seek green;
- use retained diagnostic artifacts to classify failures.

### E2. `test/AGENTS.md`

Rewrite the coding-agent sequence around:

```text
RED focused proof
  ↓
fix
  ↓
same focused proof
  ↓
coherent commit
  ↓
packet proof
```

Add explicit examples for:

- changing one History behavior;
- changing one persistence owner;
- changing a test fixture;
- changing global shell/cache behavior.

Keep existing requirements:

- no arbitrary sleeps;
- no retry-to-green;
- use real browser/storage boundaries where the contract requires them;
- do not fake owner/device evidence.

### E3. `tools/AGENTS.md`

Document selector safety separately from user workflow.

Required rules:

1. one inventory;
2. edit selector optimizes latency;
3. packet selector optimizes coherent impact coverage;
4. branch/candidate remain conservative;
5. unknown executable inputs widen;
6. visual selection is independently conservative;
7. selector changes require `node --test test/ci.mjs`;
8. selector performance claims require measured before/after cases;
9. default output remains bounded;
10. a new convenience mode must compose existing inventory/owners, not create a
    second runner.

### E4. `docs/ci.md`

Reframe the document around user intent before implementation details.

Recommended structure:

1. **Which command should I run?**
2. Edit loop.
3. Packet loop.
4. Candidate loop.
5. Exact-suite debugging.
6. Browser preview ownership.
7. Visual evidence selection.
8. GitHub feedback CI.
9. GitHub candidate CI.
10. Diagnostic replay / suspected flakes.
11. Artifacts and logs.
12. Inventory architecture.
13. Service workflow.
14. Maintainer notes.

Do not retain a manually typed fixed suite count such as “135 commands.”

Either:

- generate the count from `test/suites.mjs`; or
- phrase the docs without a fixed count.

### E5. `docs/agents/implementation-evidence.md`

Preserve the proof-first philosophy but change invalidation semantics.

The current statement “After source changes, rerun affected proof” is too easy
to interpret as branch-wide proof after every correction.

Replace with the concept:

> After a source change, rerun the smallest evidence whose proven dependency
> intersects the change. During correction this is normally the exact focused
> proof. After the coherent packet, run packet regression. The final candidate
> gate is run on the candidate SHA required by the governing plan.

Add:

- evidence has a **scope** and a **candidate**;
- source changes do not retroactively make historical evidence false, but they
  may make it inapplicable to the new candidate;
- unaffected expensive evidence may be reused within an implementation session
  only when the dependency boundary is explicit;
- release/public-launch same-candidate rules override reuse where Plan 059 or
  another governing plan requires one exact candidate;
- runner-native `--evidence` should be used instead of executing a focused
  suite twice;
- a feedback CI pass is not a regression/candidate pass.

### E6. Execution retrospective

Extend
`docs/agents/ui-overhaul-execution-retrospective.md` with a new section:

```text
Execution lessons from Plans 055–057
```

Use measured trace evidence, including:

- the “defer all testing until final validation” experiment;
- repeated branch-wide affected regressions;
- visual capture cost;
- manual port/server recurrence;
- remote CI blocking waits;
- clean-SHA duplicate executions;
- browser initial-fail / diagnostic-pass evidence.

The conclusion must be precise:

> Proof-first remains correct. The missing concept was proof scope. Evidence
> should widen as a change matures from edit → coherent packet → candidate.

Do not turn the retrospective into a model-ranking document.

### E7. Future plan template guidance

Update `plans/README.md` so new implementation plans describe:

- required contracts;
- risky first proof;
- final completion evidence;
- owner/environment gates;

but normally **reference** the central edit/packet/candidate execution policy
rather than copy/paste an exhaustive command cadence into every plan.

A plan may still require a specific broad suite when its risk demands it.

### E8. Existing Plans 055–059 are historical contracts

Do not rewrite their historical implementation claims to pretend the new tooling
existed.

Where active future execution guidance points to them, add a small central note
that current agent mechanics come from the live CI/evidence docs.

### E9. PR prompt/handoff hygiene

New execution prompts for coding agents should not contain contradictory
instructions such as both:

- “run complete verification after every correction”; and
- “be fast / shorten feedback.”

Prompts should say:

```text
Use exact/edit proof while correcting.
Run packet proof at the coherent packet boundary.
Run the plan-required candidate gate only when the candidate is stable.
```

If an implementation task requires exhaustive verification earlier, name the
specific risk that justifies it.

---

# Repository ruleset / branch protection

## R1. Current mismatch

The CI audit found that `main` is currently not protected by classic branch
protection and has no repository ruleset enforcing the aggregate check.

The workflow describes `simulation` as an aggregate gate, but GitHub does not
currently make that gate mandatory.

That mismatch should be closed after the new workflow has stabilized.

## R2. Do not protect against an unstable check

Do not create the ruleset in 062-A.

Order:

1. ship runner semantics;
2. ship feedback/candidate CI;
3. observe required check names and cancellation behavior;
4. verify candidate mode on real PRs;
5. then enforce.

## R3. Required merge gate

The target repository rule for `main` should require:

- changes through a pull request;
- aggregate `simulation` candidate check;
- any separate service/security check that cannot be safely represented by the
  aggregate;
- conversation resolution if that remains the owner's desired review policy.

Do not require ephemeral internal matrix job names.

Require the stable aggregate interface.

## R4. Draft feedback is never the required merge gate

A feedback-mode run may use the same workflow, but the required merge status
must represent candidate semantics.

Implementation options:

- separate stable check contexts such as `simulation-feedback` and
  `simulation`; or
- ensure the aggregate `simulation` required context is emitted only for
  candidate mode.

Do not allow a draft feedback pass to satisfy a candidate requirement.

## R5. Administrative bypass

If a bypass is configured, document it as emergency repository administration,
not a normal agent completion path.

No agent prompt may tell an implementation agent to bypass required checks to
save time.

---

# Failure classification and debugging ergonomics

## F1. Every red run must identify a failure class

Where determinable, runner/CI summaries should classify failure origin:

```text
product/test assertion
test-harness synchronization
preview/server setup
browser installation
workflow/infrastructure
visual baseline drift
timeout
unknown
```

This classification may be heuristic in the summary; the raw exit status/log
remains authoritative.

Do not automatically relabel an assertion failure as flaky because diagnostic
replay passed.

## F2. Preserve exact failure artifacts

For every failed suite retain:

- initial stdout/stderr log;
- exit code/signal/timeout;
- runner metadata;
- diagnostic replay log if applicable;
- Playwright trace/screenshots where applicable;
- server log;
- exact selected plan;
- head SHA.

The agent should not need to rerun a 10-minute suite just to see the original
error.

## F3. Fast failure inspection command

Add or document a command such as:

```bash
node tools/run-tests.mjs --last-failure
```

only if it meaningfully reduces log hunting.

It should print:

- latest local failed suite;
- diagnostic excerpt;
- retained artifact path;
- exact rerun command.

Do not implement it if the same value is already delivered cleanly by normal
failure output.

## F4. Do not hide infrastructure failures behind test failures

If preview startup or browser installation fails, the summary should say so
before listing unexecuted tests.

A test that never ran is not “failed assertion.”

---

# Selection architecture in more detail

## S1. Closed domain vocabulary

Define a central vocabulary such as:

```text
shell
entry
program
history
today
workout
progress
settings
library
install
persistence
transition
privacy
telemetry
offline
service
global
```

The exact list may be refined during implementation.

Do not let each tool invent domain names.

## S2. Domain-to-suite relationship

Suite metadata can name more than one domain.

Example:

```js
s("test/history-persistence-race.mjs", [], {
  domains: ["history", "persistence"],
  cost: "long",
  tier: "packet"
})
```

A persistence edit can therefore select it even when a History UI edit does not.

## S3. Domain-to-visual relationship is separate

The fact that a persistence suite has domain `history` does not automatically
mean a persistence-only change needs History screenshots.

Visual mapping is explicit.

## S4. Shared shell changes

A real shell/navigation/bootstrap change should remain broad.

The goal is not to force every change into a narrow domain.

A correctly selected full run is a success when the changed ownership is truly
global.

## S5. Generated files

Map generated source according to its real producer/consumer.

Examples:

- `i18n.js` drift/build checker belongs to fast verification;
- locale catalogue content may affect multiple rendered domains;
- generated exercise library changes affect library/import consumers;
- generated vendor runtime changes affect their integration owners.

Do not treat “generated” as either automatically cheap or automatically global.

## S6. Cache revision changes

A pure revision-number bump caused by an already-selected cached source change
should not independently expand the entire test universe.

However service-worker compatibility and cache-inventory proofs must remain
selected.

The selector may recognize cache-lockstep files as a coupled group.

## S7. Changed tests and fixtures

Direct test changes run that test.

Shared fixture changes select static dependents.

A fixture explicitly used by visual capture also selects the corresponding
visual domains or full capture according to its ownership.

## S8. Tooling changes

Runner/selector changes select their own CI contract suite first.

They do not automatically select application browser regression unless the tool
changes how application tests are executed and the focused CI tests cannot prove
the behavior.

Final candidate for the tooling PR still runs complete regression.

---

# Visual evidence decision matrix

| Change | Draft feedback | Candidate initially | Main |
|---|---|---|---|
| docs/CI prose only | none | none unless candidate policy says otherwise | none |
| workflow timeout only | none | none | none |
| one History screen source | History screens | full | full |
| one Progress screen source | Progress screens | full | full |
| capture fixture | mapped/full | full | full |
| global CSS/token | full | full | full |
| font | full | full | full |
| manifest variant definition | full | full | full |
| one committed baseline PNG | complete variants for that screen | full or baseline contract as designed | full |
| unknown rendered input | full | full | full |

After selector-recall acceptance, candidate may move from full to affected for
non-global UI changes. That is a later owner-reviewed optimization.

---

# CI budget and performance targets

These are engineering targets, not correctness gates by themselves.

A slower run is not failed solely because it misses the target, but repeated
misses require investigation before calling the refactor successful.

## P1. Edit target

Typical local targeted change:

```text
≤ 2 minutes wall time
```

Many pure/static tests should finish in seconds.

## P2. Packet target

Typical coherent UI/domain packet:

```text
≤ 8 minutes wall time
```

Persistence/concurrency packets may exceed this when the relevant strict race
suite is legitimately selected.

The important property is relevance.

## P3. Draft remote feedback

Typical non-global draft PR change:

```text
≤ 8 minutes wall-clock to aggregate feedback
```

Do not meet the number by dropping a necessary high-risk suite.

## P4. Candidate frequency

Expected:

```text
one exhaustive remote candidate run per intended candidate SHA
```

A candidate failure legitimately creates a correction and a new candidate.

The anti-pattern is running candidate/full merely to discover what the next
focused problem is.

## P5. Manual preview servers

Target:

```text
0 manually managed servers for normal automated test/capture evidence
```

## P6. Duplicate evidence executions

Target:

```text
0 focused suites rerun solely because provenance recording required a second command
```

## P7. CI synchronous waiting during active work

Target:

```text
0 long gh run watch waits while independent local work remains
```

Final immutable-candidate waiting is excluded.

## P8. Correctness targets

Must remain:

```text
retry-to-green = 0
unknown selector input = conservative
candidate long-horizon coverage = retained
candidate strict race coverage = retained
privacy/leakage gate = retained
offline/service-worker gate = retained
visual drift gate = retained
```

---

# Measurement protocol

## M1. Baseline

Before changing behavior, record current selection and elapsed time for fixed
representative fixtures.

Create a script or documented harness that can reproduce examples without
mutating application behavior.

Cases:

1. docs-only change;
2. one direct test;
3. one test helper;
4. one History-local source change;
5. one Program-local source change;
6. one Progress-local source change;
7. one `app.js` local-domain hunk;
8. one global `app.js` hunk;
9. `durable-state.js`;
10. `workout-draft.js`;
11. telemetry;
12. service worker;
13. global CSS;
14. workflow YAML;
15. screenshot baseline;
16. capture tooling.

Record:

- selected command count;
- selected lane count;
- browser installation required?;
- visual frames selected;
- local elapsed time where practical.

## M2. After each implementation PR

Re-run the same fixture matrix.

Commit or attach the machine-readable results to the PR.

Do not commit ephemeral host timing as a normative source if runner variance
makes it misleading; the PR can carry the measured comparison.

## M3. Selector misses

A selector miss is:

> a candidate/main exhaustive gate finds a regression whose required proving
> suite or visual domain should have been selected in feedback/packet mode for
> the causative change.

Record the miss and fix the selector before trusting further narrowing.

## M4. False positives

Also record large irrelevant selection.

A selector that is safe only because it always returns “all” has not met this
plan's ergonomic objective.

## M5. Flake signal

Track initial-fail / diagnostic-pass separately.

The target is not a specific percentage in this plan; first establish reliable
measurement.

---

# Rollout and compatibility

## Cmp1. Existing commands keep working

During migration keep:

```text
node tools/run-tests.mjs fast
node tools/run-tests.mjs state
node tools/run-tests.mjs entry
node tools/run-tests.mjs workout
node tools/run-tests.mjs privacy
node tools/run-tests.mjs affected --base ...
node tools/run-tests.mjs <lane> --suite <name>
```

Do not force every active branch to update immediately.

## Cmp2. Deprecation period

`affected` may print:

```text
affected uses branch-wide merge-base semantics.
For ordinary implementation feedback prefer edit or packet.
```

Do not remove the alias until active plans/handoffs no longer rely on it.

## Cmp3. Old PRs

Long-lived PRs created before Plan 062 may continue using their documented final
gate.

When they merge/rebase onto the new runner, the new commands become available,
but do not rewrite historical evidence.

## Cmp4. Plan 057 reconciliation

Implementation starts from final merged Plan 057 state.

Specifically re-check:

- suite inventory count/metadata;
- `simulation.yml`;
- visual catalog size;
- entry/browser synchronization fixes;
- any timeout adjustment;
- new History/Share/Summary suites.

Do not apply this plan to the stale base anchors mechanically.

---

# Rollback strategy

Each implementation PR needs a low-risk rollback.

## RB1. 062-A

If new modes are wrong:

- existing lane commands remain;
- `affected` still has old branch semantics;
- revert docs to old default;
- no Actions coverage changed.

## RB2. 062-B

If feedback selection misses regressions:

- switch draft workflow back to branch/full selection with one workflow change;
- keep `ci-plan.mjs` in explain/shadow mode;
- candidate/main remain exhaustive.

## RB3. 062-C

If visual domain selection misses drift:

- force visual mode to `full`;
- retain domain mapping only for diagnostics;
- no baseline thresholds change.

## RB4. 062-D

If decomposition weakens a contract:

- restore the original assertion/suite;
- keep metadata/selection improvements;
- no reason to roll back the whole runner refactor.

## RB5. Branch rules

Do not enable branch rules until candidate semantics are stable.

If required-check naming breaks unexpectedly, correct the ruleset/check context;
do not bypass the check by merging unverified code.

---

# Explicit non-goals

Plan 062 does not authorize:

- deleting persistence/concurrency coverage because it is slow;
- lowering screenshot/perceptual thresholds;
- removing semantic visual checks;
- retries that convert a red test to green;
- Playwright sharding merely to hide pathological selection;
- root application dependencies;
- a Jest/Vitest migration;
- rewriting the static PWA architecture;
- product modularization of `app.js` solely for CI;
- moving the app to a framework;
- replacing GitHub Actions;
- self-hosted runners;
- paid CI optimization infrastructure;
- test-result SaaS;
- speculative distributed caching;
- browser-version changes;
- product telemetry for developer behavior;
- model-specific execution policy;
- automatic merging;
- weakening owner physical-device gates.

If later evidence shows one of these would help, it requires a separate decision.

---

# Security and privacy

The refactor operates on engineering artifacts and must preserve existing
privacy boundaries.

- Local preview generation keeps PostHog disabled.
- No production PostHog token enters local preview child environments.
- Test logs must continue to avoid setup payloads, transfer tokens, cookies and
  sensitive URLs.
- CI-plan artifacts contain paths, suite IDs and SHAs, not user state.
- Timing artifacts are engineering metadata only.
- Service/security workflows retain their current secret isolation.
- A selector optimization may skip irrelevant privacy tests, but candidate
  privacy proof remains mandatory.

---

# Detailed acceptance matrix

| ID | Required observable result | Proof |
|---|---|---|
| 062-01 | Exact-suite debugging remains supported | runner unit/integration test |
| 062-02 | `edit` ignores earlier branch commits when working tree is dirty | synthetic Git fixture |
| 062-03 | clean `edit` selects last-commit impact | synthetic Git fixture |
| 062-04 | `packet --base` includes packet + dirty + untracked files | synthetic Git fixture |
| 062-05 | invalid packet base cannot silently select nothing | negative fixture |
| 062-06 | `branch` preserves old conservative affected semantics | old/new selector equivalence fixtures |
| 062-07 | unknown executable input broadens | selector unit test |
| 062-08 | local edit/packet fail-fast | two-command fixture where second writes marker |
| 062-09 | candidate keep-going records all failures | multi-failure fixture |
| 062-10 | not-run and skipped are distinct | results JSON assertion |
| 062-11 | failure prints exact rerun command | runner output assertion |
| 062-12 | clean-SHA evidence runs command once | execution-counter fixture |
| 062-13 | evidence refuses dirty source | recorder integration |
| 062-14 | test runner gets isolated preview | preview fixture |
| 062-15 | capture tool gets isolated preview | capture fixture |
| 062-16 | stale other-worktree preview is rejected | identity fixture |
| 062-17 | preview cleans up on signal/failure | process fixture |
| 062-18 | feedback CI plan is SHA/base bound | CI-plan unit test |
| 062-19 | candidate dispatch refuses wrong expected SHA | workflow/plan test |
| 062-20 | main plan is exhaustive | CI-plan unit test |
| 062-21 | no-browser plan avoids browser installation | workflow structure test |
| 062-22 | workflow-only changes do not trigger full visuals | visual selector unit test |
| 062-23 | History-local hunk selects History visual domain | annotation fixture |
| 062-24 | unannotated shared hunk widens to full | annotation fixture |
| 062-25 | invalid domain annotation fails | checker negative fixture |
| 062-26 | global CSS remains full visual | selector unit test |
| 062-27 | candidate visuals remain full during observation window | CI-plan assertion |
| 062-28 | suite metadata has valid domains/cost/tier | inventory validation |
| 062-29 | direct changed candidate-tier suite can still run in edit | selector unit test |
| 062-30 | long simulation retains full-horizon contract | candidate run |
| 062-31 | moved summary/UI assertions fail at cheaper owner | deliberate violation proof |
| 062-32 | privacy synchronization no longer depends on fixed sleeps | source/test assertion plus browser run |
| 062-33 | diagnostic replay pass never changes red gate | CI runner fixture |
| 062-34 | suspected-flake metadata emitted | runner fixture |
| 062-35 | docs teach edit → packet → candidate consistently | docs/source checker or review |
| 062-36 | no docs claim a fixed stale suite count | grep/review |
| 062-37 | final aggregate required check represents candidate semantics | GitHub rules/check inspection |
| 062-38 | draft feedback cannot satisfy merge requirement | GitHub rules/check inspection |
| 062-39 | complete candidate passes after each implementation PR | exact-SHA Actions evidence |
| 062-40 | no product behavior changed intentionally | final diff/review |

---

# Implementation PR handoff requirements

Every 062 implementation PR must report:

1. exact base SHA;
2. exact final SHA;
3. changed selection semantics;
4. compatibility behavior;
5. focused tests;
6. complete candidate result;
7. before/after selection matrix;
8. measured elapsed time where meaningful;
9. any selector miss discovered;
10. any suspected flake discovered;
11. docs updated in the same PR;
12. rollback path;
13. remaining 062 slices.

Do not report only “CI is faster.”

---

# Final Plan 062 completion gate

Plan 062 is complete only when all of the following are true.

### Tooling

- edit/packet/branch/candidate modes exist;
- exact suites remain available;
- local fail-fast versus candidate keep-going is explicit;
- runner-native clean-SHA evidence works;
- test and capture preview ownership is unified;
- selection plans are explainable;
- unknown inputs fail safe.

### CI

- draft feedback uses change-proportional selection;
- candidate mode is exhaustive at an exact SHA;
- main is exhaustive;
- workflow plan artifacts explain scope;
- no-browser changes avoid unnecessary browser installation;
- aggregate check naming is stable.

### Visual evidence

- workflow/docs-only changes do not force catalog capture;
- affected visual domains work for proven local ownership;
- unknown/global render changes remain full;
- candidate/main full safety net has observed selector behavior;
- any move to narrower candidate visuals is separately justified by recall data.

### Test corpus

- expensive long-horizon contracts remain;
- cheap presentation assertions have moved to cheaper owners where appropriate;
- privacy/browser synchronization uses observable conditions;
- race suites remain strict;
- suspected flakes are measurable and remain red.

### Documentation

- root `AGENTS.md` teaches the three loops;
- nested test/tools instructions agree;
- `docs/ci.md` is current;
- implementation evidence uses scoped invalidation;
- retrospective records Plans 055–057 evidence;
- future plan guidance references the central execution policy.

### Repository governance

- the stable candidate aggregate is required on `main`;
- feedback cannot satisfy candidate merge requirements;
- no normal bypass path is documented for agents.

### Measured outcome

Against representative changes:

- ordinary edit selection is materially smaller than current branch-wide
  selection;
- ordinary packet selection avoids unrelated long suites;
- visual frame count is proportional to proven domains for local/draft feedback;
- no correctness regression is found solely because a required suite was
  omitted by the new selector without that miss being treated as a selector bug.

---

# Proposed implementation order

```text
PR #248 / Plan 057 final state
          ↓
      062-A
local modes + fail-fast
evidence integration
shared preview owner
          ↓
      062-B
CI planning
feedback vs candidate
exact-SHA dispatch
          ↓
      062-C
visual domains
affected capture
selector-recall observation
          ↓
      062-D
suite metadata
simulation/privacy decomposition
          ↓
      062-E
final docs/ruleset convergence
          ↓
observed stable candidate checks
          ↓
enable main ruleset
```

Documentation changes that describe an individual landed command should travel
with A–D rather than wait artificially for E. E is the reconciliation/completion
boundary.

---

# First implementation packet

The first implementation PR should be deliberately smaller than this full plan.

Recommended first packet:

1. add `edit`, `packet`, `branch` aliases/selection semantics;
2. keep `affected` compatibility;
3. add fail-fast/keep-going;
4. add `--list` / `--explain`;
5. expand `test/ci.mjs`;
6. update only the docs necessary to teach those commands.

Do **not** combine the first packet with:

- GitHub workflow restructuring;
- visual domain annotations;
- simulation decomposition;
- branch rules.

Prove the vocabulary and selector model first.

The risky first proof is:

> A tiny correction on a long-lived feature branch selects only the directly
> relevant contract during edit, selects the coherent packet at packet boundary,
> and still produces the same conservative branch selection as the current
> `affected` implementation when `branch` is requested.

A deliberate failing case must show that an unknown executable input widens
rather than disappearing from coverage.

---

# Standing principles

1. **Optimize discovery latency, not away correctness.**
   A fast wrong selector is worse than a slow correct one.

2. **Proof scope follows change maturity.**
   Edit, packet and candidate are different questions and deserve different
   evidence.

3. **One failure should tell the agent what to do next.**
   Preserve logs and print the exact rerun command.

4. **One owner per resource.**
   Tests and capture own their preview lifecycle; agents do not coordinate ports.

5. **One executable inventory.**
   Selection may change, command ownership does not fragment.

6. **A rerun is not a flake policy.**
   Diagnostic replay classifies; it never turns red green.

7. **Expensive tests justify themselves by unique contracts.**
   Keep long/race tests where only they can prove the behavior; move small
   assertions out of them.

8. **Unknown means broad.**
   Selector confidence is earned through explicit dependencies and reviewed
   ownership.

9. **The final candidate is still a real gate.**
   Faster draft loops are not permission to hand off partially verified code.

10. **Agents should spend time fixing code, not waiting for machinery.**
    Remote waits, repeated full runs, duplicate evidence execution and manual
    server bookkeeping are engineering waste when the repository can own them.

11. **Documentation is part of the runtime for agents.**
    A correct tool with stale `AGENTS.md` guidance will still produce the old
    behavior.

12. **Measure the refactor against real work.**
    Plans 055–057 provide the baseline failure pattern; later PRs must show that
    the new loop changes actual agent behavior without reducing final confidence.
