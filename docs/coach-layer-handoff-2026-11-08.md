# Taurifer Plans 078–083: stopped-work handoff

Snapshot: 2026-11-08, approximately 22:56–22:59 UTC. Repository: `pedrochagasmaster/repforge`.

## Stop boundary and meaning of this document

**Development is stopped by the owner.** The sole authorized follow-up was to inspect state and commit this handoff on `integration/coach-layer`. Do not resume implementation, restart sessions, merge any PR, deploy a Worker, or change main on the strength of this document. The future-work sections are a resumption checklist, conditional on fresh owner authorization.

No packet has merged. Nothing in Plans 078–083 is claimed shipped to main. This document does not grant acceptance to a packet, even where CI is green. It records repository/Actions observations separately from implementation-session reports. PR descriptions include older checkpoints; their “pending” or “not implemented” prose is not always current. Prefer exact SHA/run evidence below and independently inspect the diff before acceptance.

The handoff itself adds one Markdown file. Its parent integration head is `99266e6d13173400cbb0ce2844c5446d6bf57369`; this document necessarily advances integration by one documentation commit. Packet CI below applies to packet heads, not to that new integration commit. No application tests were run for authoring this prose. Remote commit, file content and single-file diff must be verified after publication; any resulting handoff CI has its own run and is not covered by packet results.

## Authoritative reading and precedence

The orchestration brief supplied by the owner is the packet assignment and handoff protocol. It explicitly makes AGENTS.md prevail over other documents. Read the following at the actual working head before any resumed work; the links here pin the prerequisite snapshot so this handoff remains auditable.

1. [AGENTS.md](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/AGENTS.md), then [CLAUDE.md](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/CLAUDE.md), [CONTEXT.md](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/CONTEXT.md), [PRODUCT.md](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/PRODUCT.md). AGENTS links [hard rules](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/docs/agents/hard-rules.md) and [implementation evidence](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/docs/agents/implementation-evidence.md). CONTEXT vocabulary and PRODUCT's scores ban bind implementation.
2. [Strategy, 2026-11-08](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/docs/coach-layer-strategy-2026-11-08.md): §2 copy limits, §10 decisions D-1–D-16, §11 sequencing; §6 is proposed funnel reasoning, not authorization to ship a funnel.
3. The specifications: [078 effort ladder](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/plans/078-effort-ladder.md), [079 session zero](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/plans/079-session-zero.md), [080 estimator](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/plans/080-estimator.md), [081 profile/findings](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/plans/081-profile-and-findings.md), [082 weekly review](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/plans/082-weekly-review.md), [083 landing/test set](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/plans/083-landing-test-set.md). Each packet is exactly one PR-split row. Check each row against its owner-module changes, tests and catalog states; this summary cannot replace them. Plans were written against main `0fbae7b`; verify drift.
4. [077 amendments](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/plans/077-calibration-free-layer.md), [CI contract](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/docs/ci.md), [suite inventory](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/test/suites.mjs), [test runner](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/tools/run-tests.mjs), [Worker RUNBOOK](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/services/install-transfer/RUNBOOK.md), [catalog contract](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/docs/ui-screens/README.md), [brand guide](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/docs/brand-guide.md).
5. Skills: [CI watch/flakes](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/.claude/skills/ci-watch-and-flakes/SKILL.md), [fidelity gate](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/.claude/skills/taurifer-fidelity-gate/SKILL.md), and [code review](https://github.com/pedrochagasmaster/repforge/blob/99266e6d13173400cbb0ce2844c5446d6bf57369/.agents/skills/code-review/SKILL.md). The code-review skill is under `.agents`, not `.claude`. Apply CI watch after every push, fidelity before calling visible work done, and independent medium-effort code review before handoff.

The engineering effort's internal name is not product copy. “Coach” is never the product's name or selling point. Keep historical internal `repforge` identifiers intact.

## Branch and PR snapshot

Sources: [prerequisite #667](https://github.com/pedrochagasmaster/repforge/pull/667), [integration #687](https://github.com/pedrochagasmaster/repforge/pull/687), and the three packet PRs linked below; Git refs and Actions were read directly for this handoff.

- #667 is open, draft, unmerged: `ccr-2ed25390-vjeo4m` at `99266e6d13173400cbb0ce2844c5446d6bf57369`.
- #687 is open, draft, unmerged: `integration/coach-layer` against main. Before this handoff it is at the same prerequisite head. It contains the prerequisite documentation, not merged packet implementations.
- The live main ref read during the snapshot was `bef0beea8781f218fc13c6f474884cc083a9c9ac`. PR API base-SHA snapshots differed from that live ref; do not treat an old PR base SHA as current main.
- The remote `packet/` ref inventory returned only the three branches below. In particular, no `packet/080*` remote branch was present. No additional packet PR is claimed.
- The original branch plan calls for integration to rebase onto main when #667 merges. **Do not perform that now:** work is stopped and this handoff must preserve history. Reconcile the original rebase instruction with any future owner instructions when resuming.
- Packet branches were based on integration `99266e6d...`. After this documentation commit, they will no longer be based on the latest integration head. Revalidation/rebase is a future task, not an excuse to restart them now.

| Packet | Draft PR / branch | Verified remote head | State |
| --- | --- | --- | --- |
| 078-pr1 | [#690](https://github.com/pedrochagasmaster/repforge/pull/690), `packet/078-pr1-effort-ladder` | `b3df9567f20d6d09c48dff6d5f6e7fabfbacca95` | Incomplete; migration checkpoint published; UI incomplete |
| 079-pr1 | [#689](https://github.com/pedrochagasmaster/repforge/pull/689), `packet/079-pr1-starting-loads` | `f8a6456be760a8fff75a732af972c451ad47426d` | Implemented; ci and ci-full passed; full handoff/independent orchestrator acceptance outstanding |
| 082-pr1 | [#688](https://github.com/pedrochagasmaster/repforge/pull/688), `packet/082-pr1-session-events` | `e74d4cffebc8fd16757840d18d00ab95ecef39bc` | Incomplete; persistence checkpoint published; UI incomplete |

Local cleanliness is **session-reported, not freshly inspected by this handoff session**: #690 and #689 reported clean local and remote state at their heads; #688 reported clean local `af15aaeaf21b078cd8ba93adafe3ba2ed8d0b130` with the same tree as its remote head. The remote #688 tree was independently verified as `62c5cd1ea13ad9a8c1fc6292c9a30d8132dd7f8f`; local tree equality remains a stop-report claim. 080-pr1 reported no edits and last local baseline `99266e6d...`; its environment was unavailable for a fresh local check. Do not infer unsaved-work absence beyond those reports.

## All 17 packets and dependencies

All rows are stopped. “Waiting” means not started, not permission to start. There are no merge SHAs. 080-pr1's added dependency is an orchestrator sequencing decision because of the shared `reps_left_5plus` gauge value/half-weight handling; the original brief listed no dependency for that row.

| Packet | Scope | Dependencies | State | Packet head | Merge SHA | Worker requirement |
| --- | --- | --- | --- | --- | --- | --- |
| 078-pr1 | Two-stage effort ladder | — | [#690](https://github.com/pedrochagasmaster/repforge/pull/690): migration checkpoint published; CI queued; UI incomplete | `b3df9567f20d6d09c48dff6d5f6e7fabfbacca95` | — | Required; not deployed |
| 079-pr1 | Starting-load priors | — | [#689](https://github.com/pedrochagasmaster/repforge/pull/689): ci and ci-full passed; pending full handoff and orchestrator acceptance | `f8a6456be760a8fff75a732af972c451ad47426d` | — | None specified |
| 080-pr1 | Engine standing | 078-pr1 (orchestrator sequencing) | Parked pending shared gauge value from 078-pr1; no remote packet branch verified | — | — | None specified |
| 082-pr1 | Session events and weekly facts | — | [#688](https://github.com/pedrochagasmaster/repforge/pull/688): persistence checkpoint published; CI queued; UI incomplete | `e74d4cffebc8fd16757840d18d00ab95ecef39bc` | — | Required; not deployed |
| 078-pr2 | Words default and activation sheet | 078-pr1 | Waiting; not started | — | — | None specified |
| 078-pr3 | Working-surface vocabulary | 078-pr1 | Waiting; not started | — | — | None specified |
| 079-pr2 | Ramp command and flow | 079-pr1, 078-pr1 | Waiting; not started | — | — | Required; not deployed |
| 080-pr2 | Standing surfaces | 080-pr1 | Waiting; not started | — | — | None specified |
| 080-pr3 | Test-set eligibility and re-check | 080-pr1 | Waiting; not started | — | — | None specified |
| 083-pr1 | Proof chapter and telemetry range | 078-pr1 | Waiting; not started | — | — | None specified |
| 082-pr2 | Patterns and approved adaptations | 082-pr1 | Waiting; not started | — | — | None specified |
| 079-pr3 | Substitution and new-lift ratios | 079-pr2 | Waiting; not started | — | — | None specified |
| 081-pr1 | Profile replaces gauge | 080-pr2, 079-pr2 | Waiting; not started | — | — | None specified |
| 083-pr2 | Check band and FAQ | 083-pr1 | Waiting; not started | — | — | None specified |
| 082-pr3 | Immediate pain path | 082-pr2 | Waiting; not started | — | — | None specified |
| 081-pr2 | Seven findings | 081-pr1 | Waiting; not started | — | — | None specified |
| 081-pr3 | Finish finding and streak removal | 081-pr2 | Waiting; not started | — | — | None specified |

The table's queued labels are snapshot labels. The job-level detail below is more precise for #690. Worker “not deployed” refers to this effort; it is not a statement about whether a production service already exists.

## CI and red/green evidence

Latest runs were queried by exact head. All latest run attempts are 1; no rerun-to-green is claimed. A successful aggregate does not by itself prove there were no diagnostic replays inside job logs; acceptance must inspect retained evidence for that condition.

| Packet / current head | Run | Verified state at snapshot |
| --- | --- | --- |
| 079-pr1 / `f8a6456` | [42519842160](https://github.com/pedrochagasmaster/repforge/actions/runs/42519842160) | Completed success; ci and ci-full both success. Fast, service, all 5 PR browser shards, full-fast and all 12 full-browser shards passed. Full-capture skipped; packet declares no visible change. |
| 078-pr1 / `b3df956` | [42531095103](https://github.com/pedrochagasmaster/repforge/actions/runs/42531095103) | Run queued. Plan, fast, service and all 5 PR browser shards completed success; ci aggregate queued. No completed ci-full result was available. Do not call the packet green or complete. |
| 082-pr1 / `e74d4cf` | [42531651732](https://github.com/pedrochagasmaster/repforge/actions/runs/42531651732) | Run queued; plan job queued. No completed current-head test or aggregate result available. |

Historical failure evidence:

- **078-pr1:** [42507835422](https://github.com/pedrochagasmaster/repforge/actions/runs/42507835422), head `6b2c1a3c01d57aacd5bbb38c918696fcf56d5b39`: migration assertion at `test/effort-ladder-migration.mjs:79`, “legacy-reps: stored settings migrate”, actual `effort`, expected `numeric`. Diagnostic replay failed too. This was behavioral RED before boot migration. The packet later identified the separate `test/ci.mjs` failure as the unchanged PR budget/ledger mismatch, 106 versus 107. The fix composes the unchanged migration assertions through `test/workout-draft-storage.mjs` with SUPPORT classification and workout/settings/persistence domains.
- **079-pr1:** [42507647355](https://github.com/pedrochagasmaster/repforge/actions/runs/42507647355), head `718623cefcbbc93b547241b1f73cfbd74e36cc7f`: fast 60/61 commands passed, sole failure in `test/ci.mjs`; packet artifact report identifies line 156, ledger 106 versus 107. Starting-load proof and all PR browser/service jobs passed; full lane was blocked. Intermediate `5780521...` moved the new proof into full-fast and changed ledger totals; this was superseded after review required a retained PR behavioral owner. Final `f8a6456...` imports the complete proof from the existing PR progression-engine command, keeps all assertions and budget, and has no final ledger diff.
- **082-pr1:** [42508728161](https://github.com/pedrochagasmaster/repforge/actions/runs/42508728161), head `9807ae745d423cb7f0c2ec006c6371b223b4d105`: inventory failure, not persistence behavioral red; full-browser skipped. Correction `365915e4e75350faa38898ad860bdc2b499b93aa` imports the weekly proof under `test/progress-model.mjs`, preserves assertions and both progress/today domains, and retains the 106-command PR budget.
- **082-pr1 persistence RED:** [42519538950](https://github.com/pedrochagasmaster/repforge/actions/runs/42519538950), head `365915e...`: independently verified ci success and ci-full failure, with full-browser 5/12 failed. The packet's retained-evidence report specifies `test-session-duration-browser-mjs`, 20 passed / 5 failed: events missing at commit, reload, backup Replace, install transfer and backup Merge; diagnostic replay failed too. The current persistence checkpoint follows this red. Its green is still pending.

Local results below are transcribed from packet reports, not rerun for this document. Browser launch failures are infrastructure failures before assertions, never behavioral RED or GREEN.

## Packet implementation details and remaining work

### 078-pr1 — effort ladder (#690)

Reported implemented: numeric reports use `reps_left`, 5 uses `reps_left_5plus`, prefilled provenance remains distinct; draft and transfer enum accept the source; gauge weights the floor source one half; boot migration now handles the legacy settings path. Keep `rirMode`'s two values and retire `effortScale` per the proposed default. Words-default/onboarding belongs to PR2; copy sweep to PR3.

Verified changed-file inventory: `app.js`, `calibration-gauge.js`, `index.html`, `install-transfer-contract.js`, `sw.js`, `test/calibration-gauge.mjs`, `test/effort-ladder-migration.mjs`, `test/effort-stages.mjs`, `test/suites.mjs`, `test/workout-draft-storage.mjs`, `test/workout-draft.mjs`, `workout-draft.js`.

Reported local commands/results:

- `node tools/run-tests.mjs fast --suite workout-draft`: 188 passed.
- `node tools/run-tests.mjs full-fast --suite calibration-gauge`: 25 passed.
- `node tools/run-tests.mjs fast --suite install-transfer-plan067-contract`: passed.
- At the migration checkpoint: `node --test test/ci.mjs`: 70/70; `node tools/run-tests.mjs --check`: 106 PR / 148 full commands; `node tools/run-tests.mjs fast --suite exercise-library`: 1/1; `node --check app.js`: passed.

Remaining: complete two-stage chips/menu, held-set behavior, Settings, tip and all PR1 owner-module requirements; establish remaining behavior proofs before changes; finish EN/PT strings, revisions and catalog; commit final CI captures; fidelity matrix; medium independent review; full handoff and acceptance. `test/effort-stages.mjs` expectations were drafted, with local browser launch blocked. Migration's current PR shard passed, but no complete final packet proof is claimed. Provisional v693 was reported above then-current main v679 and open claims through v692; it is not a reserved final revision. Worker requirement remains outstanding.

### 079-pr1 — starting-load priors (#689)

Reported implemented: pure `starting-loads.js`, exact first-draft priors version `priors@079.1`, mechanics section marked pending professional review, and complete Node proof. No runtime or UI wiring; PR2 owns that. Caller supplies catalog lookup and load grid; machine metadata classification, free-bar 20 kg floor, unsupported-prior floor fallback, destination-grid ratio and excluded conventions follow the packet's decisions.

Verified changed-file inventory: `docs/progressive-overload-mechanics.md`, `starting-loads.js`, `test/progression-engine-plan067.mjs`, `test/starting-loads.mjs`, `test/suites.mjs`, `tools/check-production-syntax.mjs`.

Reported RED: initial owning suite failed MODULE_NOT_FOUND; review regressions failed before fixes for machine classification, unnecessary source-grid requirement, exact floating-point boundary and excluded source convention.

Reported GREEN: `node tools/run-tests.mjs fast --suite-id test-progression-engine-plan067-mjs` (1/1; original engine assertions plus entire new proof and four regressions); `--suite-id test-ci-mjs` (1/1, 70 subtests); prior syntax suite `--suite-id tools-check-production-syntax-mjs` (1/1). Current remote ci and ci-full independently verified green above.

Reported independent review: initial Standards clear; Spec S1–S3 corrected with red-first proofs; correction review clear; C1 required retaining a PR behavioral owner, then confirmed resolved at `f8a6456`. These are packet reports; orchestrator acceptance still requires inspecting the diff, test evidence, final integration ancestry and scope. No visible change, frames/fidelity n/a, no cached/generated assets changed, no revision needed for this row, no Worker redeploy specified.

Remaining: obtain/validate the complete READY handoff, independent acceptance, review final code against Plan 079 §8 row 1 and owner-module lists. Do not merge while stopped. Any later rebase changes the tested head and requires fresh final-head evidence.

### 082-pr1 — weekly facts/session events (#688)

Reported implemented domain slices: closed skip reasons, structured discomfort marks, guarded post-swap reason command, optional event projection, strict transfer validation and pure calendar-week facts. The new persistence checkpoint saves events atomically alongside session rows, validates/preserves through load/import, merges only newly imported session IDs and deletes events with session/history removal.

Design choices already reported: retain picker order; bind a later reason to exact draft/slot/selection time/replacement ID and reject stale answers. `toHistoryRows` keeps the legacy row-array return by default; `includeSessionEvents:true` returns `{rows,sessionEvents}`. `meta.weekFacts` receives authoritative app-derived outcome/stall/fatigue facts rather than duplicating progression calculations. Generic durable-state clone/rebase remains the existing mechanism.

Verified changed-file inventory: `app.js`, `history-ui.js`, `index.html`, `install-transfer-contract.js`, `progress-model.js`, `sw.js`, `test/install-transfer-plan067-contract.mjs`, `test/progress-model.mjs`, `test/session-duration-browser.mjs`, `test/suites.mjs`, `test/week-review.mjs`, `test/workout-draft.mjs`, `workout-draft.js`.

Additional owners need explicit scope acceptance: `test/progress-model.mjs` imports the proof to keep the PR budget; `history-ui.js` owns session deletion cleanup. Neither is an excuse to widen into unrelated refactoring.

Reported proofs: draft RED 187 pass/8 fail → GREEN 197/0; stale guarded-reason cases red then green; event projection RED 207/3 → GREEN 215/0; transfer rejection red then green; calendar-week model red missing function then green. Commands: `node tools/run-tests.mjs fast --suite workout-draft` (215 assertions), `--suite install-transfer-plan067-contract`, `--suite week-review`, `--suite exercise-library`; correction `--suite-id test-ci-mjs` and `--suite-id test-progress-model-mjs` passed. The persistence checkpoint reports syntax checks for app/history and focused draft, transfer and exercise-library suites green. Browser green is pending.

Remaining: picker capture/binding; remote persistence/replica verification; authoritative app facts adapter; skip/discomfort UI; Review and Today card; EN/PT copy; final CI frames/fidelity; medium independent code review; final revision/rebase; complete handoff. No proposals/adaptation/second-mark path or extra telemetry in this row. Provisional revisions must be reallocated at final integration rebase. Worker requirement remains outstanding.

### 080-pr1 — parked

No remote branch or edits reported. It is parked pending 078-pr1's shared gauge value, even though originally unblocked. Do not start from a speculative dependency head. When resumed after dependency merge, read Plan 080 in full and inspect current engine/quality/pair helpers; the engine's load-selection behavior must remain unchanged unless the specification explicitly says otherwise.

## Decisions, copy and product limits to preserve

From strategy §10 and the plan defaults:

- D-1: engineering frame only; subtle marketing, no product “coach” claim; CREF-registered professional required before commercialization.
- D-2/D-5: skippable session zero for unknown loads, declared/versioned priors; use exactly Plan 079 §3.3 first-draft values, pending professional review. Do not invent replacements.
- D-3/D-15: new installs default to words; one question at durable activation, not before first Start workout; numeric chips 0–4 and 5+ (stored 5). RIR remains only where Plan 078 §3.6 permits.
- D-4: estimator/standing, six weighted sets over two sessions, 0.6 agreement over four pairs, 60-day re-check; safety ceilings remain. Plan 080 §3.1 does not authorize changing load selection.
- D-6: dissolve percentage gauge into profile, counts/standing; remove streak tile in the specified finish-screen packet.
- D-7–D-12: all features available to all alpha participants, no payment; calibration lever, profile split, weekly facts/proposal split, day-zero presentation and first-program trial remain undecided after alpha.
- D-13: entitlement lifecycle ADR before funnel work. D-14: small additive landing change now; no coach comparison in copy.
- D-16: only authorized telemetry schema change is `landing_action.chapter` closed integer range 1–4 → 1–5. Update `telemetry.js`, `test/telemetry-unit.mjs`, `test/fixtures/telemetry.mjs` (5 valid, 6 invalid), `test/telemetry-runtime.mjs`, `plans/071-telemetry-coverage.md`, `docs/measurement/posthog-dashboard-recipes.md`. No new event/property.
- Plan 082 §5 default: proposals in `program-transition.js`, not a new module.
- Portuguese first, EN parity, CONTEXT terms only. No new product “coach”, “routine”, “plan” as a program noun, “e1RM”, “score” or “streak”; no new percentages/bars/badges/celebrations under PRODUCT's ban. No new Settings dial (ADR 0003). No figures hard-coded into landing markup. Owner-approved strings in both languages remain a merge gate.

Escalate any change to a D-decision, thesis rule, Free floor, scores ban or telemetry beyond D-16. If a referenced function/contract has drifted, stop that packet, name the specific conflict and choose only the smallest faithful adaptation or owner escalation with document citations.

## Unresolved process conflicts and environmental limits

These were recorded in #687 and remain unresolved; this handoff does not silently decide them.

1. **Merge actor:** original effort brief makes orchestrator read-only and implementation sessions merge after MERGE. Hard rule 17 says fronts never merge; coordinator merges under standing authority after final ci/ci-full, CLEAN state, correct stack base, scope/revisions and ACCEPT. The brief explicitly says AGENTS wins. Resolve who may execute the merge before any packet merge; do not infer permission from green CI.
2. **Worker timing:** effort brief defers deployment until integration reaches main; hard rule 18 requires exact green affected-PR head deployed before that PR merges, including validator/draft/profile/service changes. Known affected packets: 078-pr1, 079-pr2, 082-pr1. Resolve timing before any affected merge. No deployment was performed for this effort. Do not deploy WIP. Follow the RUNBOOK's authenticated preflight, health, and one-at-a-time deploy in the first 30 seconds of an odd UTC minute; finish before next even minute, check fresh health and any incident generation. Record exact SHA and evidence, never credentials. A dry-run/local suite does not prove provider facts.
3. **Local test breadth:** brief requests edit/full/packet runs, hard rule 11 restricts shared-devbox local execution to owning suites. Use a suitable authorized environment or resolve the constraint. The runner's bare invocation is invalid; `all` is PR inventory. Closing full inventory uses explicit `full-fast` and `full-browser` lanes; packet is supplemental, not merge evidence.
4. **Browser environment:** sessions reported pinned dependency installation required unavailable root password, browser-only archive validation failure, and system Chromium failing Unix socket creation with Operation not permitted, even after attempted elevation. The fallback command used `REPFORGE_CHROME=/usr/bin/chromium flock /tmp/taurifer-browser.lock node tools/run-tests.mjs full-browser --suite <owning-suite>`. No local browser assertion evidence resulted. Explicitly authorized checkpoint publication enabled remote behavioral RED; this exception is not general permission to push known-red/incomplete work.
5. **CLI authentication:** sessions published through the authenticated GitHub connector because git/gh credentials were unavailable; connector commits can have different SHAs while retaining identical trees. The prescribed `gh run watch` could not authenticate. Connector run/job reads provided snapshots, not a persistent background watcher. No manual ci-full dispatch or rerun was requested.
6. **Acceptance gaps:** no visible-change packet has final captured frames, fidelity matrix and independent review accepted; no Worker evidence; #689 has green CI but no orchestrator acceptance. Final-head diagnostic replay evidence still needs review. Current queues must not be represented as passes.

## Conditional resumption and closing checklist

Only after the owner explicitly resumes work:

1. Re-read rules and plans from current refs; inspect local worktrees without reset/clean/stash-over-work, verify exact remote heads and all queued run outcomes. Preserve the reported clean commits and any newly discovered work. Resolve merge actor, Worker timing and test-environment conflicts first.
2. Verify #667 state and arrange the originally required integration/main reconciliation under then-current owner instructions. Preserve this handoff commit. Recheck main drift and all module owners.
3. Review #689's full handoff/diff/evidence. Complete #690 and #688 within their PR1 rows; do not start dependents until dependencies actually merge. 080-pr1 stays parked until 078-pr1 merges. Start at most the explicitly approved number of unblocked sessions; one mechanical/exploratory subagent level only, no subagent design/push.
4. Develop each packet on `packet/<plan>-pr<n>-<slug>` from current integration, draft PR against integration, tests red before behavior then green. Push coherent focused-green commits promptly and use CI-watch; fix flakes rather than retry-to-green. Keep one concern per scoped imperative commit and no model names in repository artifacts.
5. Final rebase/revalidation is serialized. Allocate revisions from current integration while using `tools/next-revision.mjs` above main/open claims; provisional numbers are not reservations. Align changed query-versioned URLs with sw precache/cache requirements. Never hand-edit generated i18n/exercise/vendor outputs; regenerate translations after every rebase, EN/PT keys/placeholders parity.
6. Visible states need catalog scenarios, manifest and role inventory; fetch CI captures with `node tools/fetch-ci-captures.mjs <run-id>`, commit reviewed PNGs, recapture after final rebase. Review light/dark, 390/320, normal/200% text, EN/PT, top/scrolled against approved reference; attach fidelity report.
7. READY handoff must name branch/head/base, plan row, decisions/deviations, exact commands and counts, current-head ci/ci-full links, frame IDs/run provenance, fidelity report, independent review/dispositions, Worker requirement and open questions. Orchestrator reads full diff against owner-module scope and independently verifies all claims.
8. Verdict is MERGE, REVISE with file/clause/passing condition, or ESCALATE with parked question. No optional suggestion may masquerade as required correction. Merge only into integration, one at a time, merge commit (no squash), and only with resolved actor authority plus explicit verdict; record merge SHA. Never merge main in an implementation session.
9. When all 17 are accepted/merged, run required full inventory in an authorized environment, packet supplemental feedback, ci-full on final integration head; verify exact-head Worker RUNBOOK evidence under resolved timing rule. Update integration PR table/decisions/escalations/three Worker packets/fidelity evidence; mark ready for owner review, then stop. Owner merges main.

The eventual owner report must distinguish shipped work from open escalations and describe alpha questions from strategy §6/D-7–D-11: calibration value, current-program versus across-program profile, facts versus proposals, onboarding presentation, and first-program versus calendar trial. Retention/funnel evidence decides these; no paywall, pricing implementation or entitlement architecture is authorized by this handoff.
