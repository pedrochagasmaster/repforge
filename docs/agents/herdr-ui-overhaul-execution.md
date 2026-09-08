# Dispatch bounded UI-overhaul work through Herdr

Use this procedure for Plans 052–059. The numbered plan owns product scope,
atomic commits, dependencies, rollback, and owner gates. The
[evidence protocol](implementation-evidence.md) owns acceptance and review.
This document explains how to execute those contracts with external workers.
It does not authorize a new feature, weaker test, or additional owner gate.

Plan 053 is the owner-authorized transport/model exception: use its
[native Luna worker protocol](../../plans/053-ios-install-transfer-foundation.md#native-luna-worker-protocol)
instead of this document's Herdr dispatch and model routing. Its separate-writer
worktrees and integration ownership govern concurrency. Other plans retain
the defaults here.

## Establish one writer and an accurate starting point

1. Fetch main and inspect the plan's branch, worktree, PR, dirty files, and active
   workers. Resume published work. A changed model does not justify a new branch.
2. Merge prerequisite main changes explicitly when the worktree is safe. Preserve
   published SHAs. Record which completed plan rows still pass on the new base.
3. Give one worker write ownership of the plan worktree. The coordinator judges
   implementation read-only. Test authors and reviewers use read-only mode or a
   separate worktree. Different files in one checkout do not isolate Git state.
4. Record the owner, thread ID, base SHA, packet ID, allowed paths, server origin,
   and process ownership in the existing PR handoff. Release write ownership only
   after the thread settles and the coordinator checks the worktree.
5. Inspect unrelated open PRs for shared-file conflicts. Their unmerged product
   choices are not approved dependencies. Preserve the UI audit's scope.

Plan 052 already has PR #228. Do not create a second kickoff PR or discard its
proposal implementation. Main `c3491c5e` contains both predecessor merges.
Revalidate these dated facts before resuming.

## Prepare proof before the production change

For each numbered plan row, the coordinator first completes its acceptance
contract. Identify the real producer, consumer, stored fields, and visible result.
Specify the expected result before a worker chooses its implementation.

Use this sequence for every risky contract:

1. Characterize the existing working behavior with a passing test. For new
   behavior, write its proposed assertions and independent expected values in
   the packet before coding. Do not publish a knowingly failing commit.
2. Construct the narrow regression locally. Record the observed failure against
   the old behavior or an isolated deliberate fault. Distinguish that expected
   failure from a broken test setup.
3. Implement the smallest complete path. Keep tests and implementation in the
   same coherent commit when a test-only commit could not pass.
4. Run the passing case and the deliberate violation. A negative test passes
   only when it rejects the intended violation for the intended reason.
5. The coordinator inspects the assertion and reproduces the risky result.
   Expand only after this first-contract review. Record technical agreement in
   the PR, without asking the owner to settle ordinary engineering details.

Never generate the expected answer using the implementation being tested.
Compiler fixtures must come from the real compiler, but pairing/order/evidence
assertions need an independent oracle. A rehashed invalid proposal tests semantic
validation; an unchanged invalid digest tests only hash rejection.

For asynchronous storage, state the exact barrier: acknowledged draft revision,
journal entry, lock acquisition, replica revision, or visible route destination.
Use the actual production seam when one exists. Do not replace an assertion
with a sleep, or weaken its expected value after a failure.

Plan 051 supplies `window.__repforgeWorkoutDraft.flush()` for the draft queue
and suggestion refresh, plus `current`, `checkpoint`, `read`, and `state`
inspection. Read their implementation before use. A queue drain does not by
itself prove that a replacement archive, durable replica, or new DOM card exists.

## Fill one worker packet

Store the current packet in the PR or a linked repository document before
dispatch. Temporary prompt files are transport copies, not the handoff record.
The coordinator fills every field; a worker must not infer missing architecture.

```markdown
## Packet <plan>-<row>-<bounded-suffix>
- Objective: one observable result.
- Base/head: exact SHAs, branch, worktree, existing PR.
- Resume facts: completed work to preserve; dirty files and their owner.
- Prerequisite proof: command, SHA, assertion, result, limitations.
- Read: exact plan sections, contract sections, modules, and tests.
- Write: explicit paths and functions/regions; one writer.
- Forbidden: other paths/contracts, product decisions, deployment/merge.
- Inputs: concrete fixture, versions, identities, starting UI/storage state.
- Outputs: exact API/state/DOM result and allowed mutations.
- Cases: successful path, boundary/failure paths, unchanged fields.
- Oracle: expected values from the approved contract, independent of producer.
- Proof first: assertion locations and expected old/fault failure.
- Focused commands: exact commands, cwd, server origin, artifact locations.
- Expand after: coordinator's named contract review, if this is a first slice.
- Commit: exact plan message or bounded suffix, all required cache/catalog files.
- Broad gate: what runs now, what runs at integration, and why.
- Stop: missing prerequisite, scope drift, repeated failure, unsafe dirty state.
- Return: actual SHA, diff paths, tests/results, negative proof, limitations,
  thread ID, process ownership, clean status, and exact next action.
```

One packet usually delivers one plan commit. Split a large row into one named
contract or one UI state family per dispatch. Keep the original row as the
parent and list its subcommits in the PR. No worker receives "finish the plan"
as its assignment. Preserve a coherent, testable production boundary in each
subcommit; avoid temporary competing state models merely to make a smaller diff.

## Select and dispatch a worker

Read the installed `herdr-subagents` skill in full before transport operations.
On this environment the owner supplies
`/home/ubuntu/herdr-subagents/skill/SKILL.md`. On another environment locate the
installed skill; report a missing transport rather than silently using native
Codex subagents. Keep all provider/model choices explicit per dispatch.

Use the skill's doctor, provider/model validation, one project ensure, and
dry-run selection before dispatch. Redirect JSON to a file before parsing it.
Use `--cwd` with the exact worktree, `--checkout current`, `--open none`, and
`--permission full-access` for authorized unattended commands. Use `--mode plan`
for read-only work and `--mode build` for the sole writer.

These are routing defaults, not benchmark claims or permission to override the
owner's available quota. For Plans 052–059, prefer Gemini 3.8 Flash High for
most implementation and test packets. The coordinator records any departure
and its concrete reason in the PR packet row.

| Assignment | Starting choice | Escalation |
|---|---|---|
| Source inventory or test-result triage | Muse or GLM through opencode, model default effort | Sonnet if the report cannot resolve a concrete code question |
| Bounded tests, UI state, or implementation with fixed interfaces | Gemini 3.8 Flash High through Antigravity | Sonnet High if Gemini cannot close one bounded attempt, or if the packet requires sustained cross-module reasoning identified before dispatch |
| Storage atomicity, security, compiler identity, new checker oracle | Codex coordinator judges; external Opus high/xhigh for a bounded unresolved design question | Narrow the question before increasing effort |
| Mechanical catalog generation and full test run | Existing scripts/processes | Diagnose the failing assertion, not a new "run everything" worker |

Validate slugs against the live provider cache. Antigravity effort is part of
the model slug. T3 does not set opencode's `variant`; report default effort.
Do not dispatch a Codex worker to save Codex quota. Do not enable paid fast mode
as a default. A model's lower cost does not excuse changing an approved contract.

The expected Gemini selection is provider `antigravity`, model
`gemini-3.8-flash-high`. Treat those values as an expected live selection, not
a permanent guarantee. Run the Herdr skill's provider/model validator before
each dispatch. If the slug is unavailable or quota-blocked, record that fact
before choosing Sonnet. Do not switch models merely because a packet returns a
valid engineering finding; use the normal review/correction loop first.

T3 handover starts one thread and one turn. Its CLI cannot append correction
instructions or cancel a writer. For a correction, let the existing writer
settle, inspect its state, then dispatch a fresh self-contained packet. A user
interruption or deletion requires confirmation before redispatch. A blocked
approval needs the user's T3 action; never approve it on their behalf.

## Spend tests and context on the failing contract

Use three levels of evidence. Keep the plan's required broad suites intact.

| Level | When | Required scope |
|---|---|---|
| Focused | Every edit/packet | Named pure test or one production journey and its negative proof |
| Integration | A shared boundary changes | All affected callers, storage races, cache upgrade, locale and catalog variants |
| Candidate | Required phase gate before owner review | Full plan suites and complete catalog where required, on a clean pinned SHA |

Run the focused failing case before another expensive simulation or complete
catalog. If a test has no supported filter, create a narrowly scoped regression
using existing helpers; do not invent CLI flags or silently shorten the full
release suite. Record a missing command as planned, never passed.

For UI packets, use the actual `--screen <flow/screen>` or `--flow <id>` capture
options. Omit `--canonical` for required locale/theme/text-scaling evidence.
Filtered captures maintain the catalog and accompany visible changes in the
same commit. They do not replace final full-catalog regeneration and comparison.
Test clipping inside controls, dynamic missing translations, overlap, and
intentional-scroller boundaries with the existing Plan 050 contract first.
Do not create a second detector merely because a new plan started.

Give each active plan a verified server rooted at its own worktree and an unused
port. Set `REPFORGE_URL` explicitly. Keep browser contexts and artifacts separate.
Record PIDs and check their command/cwd before stopping a process. No `pkill`
or termination of a listener simply because it occupies a preferred port.
Serialize complete browser/catalog runs on resource-constrained environments.
One writer owns catalog files. Do not run simultaneous captures into one tree.

Run long checks as shell processes and retain their logs outside the worktree.
Use the skill's watcher for thread lifecycle; exit 2 means continue watching,
not completed. Read the final summary and the first relevant failure, not every
unchanged CI log. Reuse existing CI on the exact SHA instead of dispatching
duplicate runs. If a retry passes, record the original failure and its diagnosis.

## Converge a review or stop the packet

Review the whole affected contract once before returning the first findings.
Keep stable IDs and report the smallest closing proof. Separate blockers from
optional polish. On correction, rerun the closing proof and inspect regressions.

After one unsuccessful repair of the same contract, stop issuing symptom
patches. Reduce the task to its state table and failing test. The coordinator
or a stronger read-only worker resolves the technical ambiguity before another
implementation dispatch. This is a work-routing threshold, not a quality cap.
Never declare completion because the time or token budget is low.

Publish each coherent slice immediately with the plan's stable-history rules.
Read the full SHA from Git; never expand a short hash by guessing. Run
`tools/record-verification.mjs` after the commit on a clean tree for recorded
proof. Link durable CI/PR artifacts rather than relying only on `/tmp` paths.
Keep the current packet, findings, next exact action, and owner gates in the
existing PR. A worker report is a claim until the coordinator verifies it.

Before stopping, inspect every touched worktree and process. A known dirty
partial attempt is not a completed handoff: preserve it under explicit ownership
and close or safely undo only that worker's uncommitted slice. Never erase another
agent's files. Do not merge without separate owner authorization.
