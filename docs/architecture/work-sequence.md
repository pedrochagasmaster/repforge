# Taurifer work sequence

> Updated owner direction, 18 October 2026 at 20:20 UTC: **“Test both and choose the best one.”** The assistant is authorized to compare full-background dimming with a bright but inert explained control and select using evidence. Earlier requests below for a new preference decision are superseded; the historical provenance conflict remains recorded. Follow [the comparison protocol](guide-variant-comparison.md). Neither guide variant has been comparatively tested, and no winner is selected. Implementation browser validation now runs through GitHub CI; the guide comparison remains pending. Feature-intake scope, final acceptance, merge and deployment remain separate.

Snapshot: 18 October 2026 UTC. This sequences work; it does not authorize a merge, deployment, PR closure, infrastructure change or additional feature. [Migration status](migration-status.md) owns implementation acceptance and tested revisions. [Issue425](https://github.com/pedrochagasmaster/repforge/issues/425) owns phone checks and launch decisions. Refresh exact heads and CI before each intake; a green predecessor does not certify an adapted successor.

## Current pause and completed preparation

The original cloud coding task paused after usage exhaustion. Implementation resumed in the assistant workspace at 20:56 UTC on this same branch. The stopped task's interrupted local state remains unverified. Five of twenty slices are formally accepted; no completion ETA is currently active. See the [migration ledger](migration-status.md) for actual takeover fixes, the native Entry activation cutover and exact-head CI results. Documentation preparation below is historical input, not the current implementation status.

Completed review packets, prepared without application execution:

- [Exact-head CI repair plan](ci-repair-plan.md): eleven failing contracts, proven stale consumers separated from unresolved behavior, ordered repair batches and preserved independent oracles.
- [PR intake reconciliation](pr-intake-reconciliation.md): all nineteen PRs, unique semantics, native target owners, failing evidence and explicit intake decisions. In particular, current S2 diverges from S1; do not apply its full stack blindly.
- [Phone acceptance worksheet](phone-acceptance-checklist.md): twelve physical cases, exact-build evidence, historical results, launch gates and owner decisions. All new test results are NOT RUN.

Sequential preparation completed after the initial packets:

1. #448 failures: [offline/redirect lifecycle](offline-upgrade-diagnosis.md), [DraftV2 recovery presentation](draft-recovery-diagnosis.md), and [all six critical UI cells](critical-ui-diagnosis.md) now have source/artifact diagnoses and bounded repair proposals. They are not implemented or validated fixes.
2. Priority incoming bugs: [#383 parser, #443 keyboard and #384 test-only proposals](priority-bug-patch-proposals.md) specify native destinations and independent acceptance tests. The remaining scope/destination decisions are unchanged.
3. Editor S1 → S2 and guides retain the concrete intake packets in [PR reconciliation](pr-intake-reconciliation.md). S2 must be rebased semantically on the completed native S1; guide highlight authorization remains unresolved until original evidence or a new owner decision is recorded.
4. Integrated execution/acceptance, PR disposition, phone results and launch evidence remain blocked or pending as described below. Documentation progress must never be counted as migration acceptance.

If the original cloud coding task resumes, reconcile it with the active integration branch. First preserve and inspect any interrupted local edits; fetch/reconcile these documentation commits without overwriting that work. Then execute the repair plan and remaining migration gates. Do not reopen a competing architecture branch.

## 1. Finish the authorized integration

Complete the approved twenty migration slices on [#448](https://github.com/pedrochagasmaster/repforge/pull/448), using [#447's specification](agent-first-spec.md). Do not create separate competing application ports. Commit and push coherent checkpoints promptly, label intermediate heads untested where appropriate, and validate completed slices and the final head.

Dependency order within the active integration:

1. Finish actual Entry activation/landing/import, installed editor/text sharing, Focus card/render/navigation, remaining Progress projections and deep transfer orchestration. These may proceed in separate owned modules; shared contracts and the composition root reconcile through the integration owner.
2. Resolve substantive review findings, including activation custom-ID remapping, orphan transfer freezes and pending-work disposal. Integrate the independent nine-finding test audit and preserve its literal/mutation oracles while updating obsolete runtime consumers. The audit corrections are integrated as `7365489b` and `58ffa739`; all six affected owners passed together on clean integration revision `817b9858346c1992f209af89921a4edc746b7a34`. Preserve that narrower evidence and rerun the packet on the eventual repaired final head; later full CI at `959c037b` failed.
3. Cut over the composition root and release graph, remove the bridge/classic owners/forwarders, finish strict and dependency enforcement, and prove representative agent change walkthroughs. Keep historical data decoders and immutable release fixtures; remove temporary execution architectures.
4. Independent architecture and data review, redesigned risk-suite checks, assembled/offline upgrade and rollback proofs, then exact-final-head CI. Only then close the remaining migration acceptance boxes. Owner review of this concrete result precedes any merge or deployment.

#446's accepted redesign and #445's focused-name Back fix are already integration inputs. The #434 canonical-removal fix and #439 DPR sampler arrived through #446 exactly once. The **entire #435 guide redesign has not been adopted**. Current-main #440 behavior is part of the base. No incoming feature below is silently included by this plan.

## 2. Reconcile the incoming work without duplicating it

Recommended default: finish #448's stable native boundaries first; adapt separately owned changes onto those boundaries next. Their owners can prepare semantic diffs and evidence in parallel. If the owner wants an incoming change folded into #448 before acceptance, record that scope decision explicitly and rerun the affected migration gates. Do not cherry-pick obsolete giant-host files over the native owners.

| Recommended order | Incoming work | Reconciliation and release condition |
| --- | --- | --- |
| First bug intake | #443, Focus keyboard | Exact head `2767d3464e5e`; CI run39099988545 is successful. Not explicitly adopted into #448. Compare its measured visual-viewport pan, deck floor and scroll restoration changes with native Focus geometry/lifetime plus styles. Preserve red-first iOS-band and Android-resize proofs. Owner authorizes intake scope; physical iPhone/Android checks remain #425. |
| First bug intake, independently | #383, clipboard/JSON diagnosis | Exact head `0800b40b201c`; CI run38463339366 failed. Diagnose that failure before reuse. Adapt fenced-JSON prompt and strict syntax-versus-row diagnostics to native freeform/interchange and Entry UI; preserve exact escaped-bracket, truncation and seventeen-exercise cases. Do not strip escapes or alter valid prescriptions. Intake needs explicit inclusion approval. It can proceed independently of editor S1. |
| Next editor delivery | #437, candidate A S1 | Exact head `1b3de1b8ea8b`. Design A and wording have owner approval, but implementation has its own owner and is not automatically part of the architecture port. Compare every capability against native editor/installed rules; retain focused-name Back and canonical-removal fixes already present. Port semantic UI changes and their tests, preserving private document/Apply/Back/draft-impact ownership. Revalidate actual workout creation after Apply. |
| After S1 | #442, reorder days S2 | Exact head `6087b4dd2196`; base is `feat/program-editor-a-s1`, not main. Depends on #437. Reconcile `day_move` through shared authoring intent, installed rebase and UI; keep rest days in place, all day/slot identities, contiguous order, stale-before refusal, Undo, drag-versus-dismiss and setup-link round trip. Do not land S2 independently of its S1 contract. |
| Parallel UI intake after evidence reconciliation | #435, modal guides | Exact head `7c0c438c8f65`. Only its #439 sampler was explicitly adopted. Native Settings guides/registry and Shell are the new owners. Verify the actual dated owner/coordinator evidence behind the later Q1 anchor cut-out decision against #425's older “no highlight” wording **before changing behavior**. Record which decision controls; ask the owner only if the evidence leaves it unresolved. Preserve held first-tap replay, one guide per Focus visit, focus/inertness, eligibility persistence and dedicated catalog states. Reconcile #441's measured contrast exception with its owner; do not silently approve a visual change or a permanent exception. |

Two valid owner choices are: accept #448 first, then bring these through focused native follow-ups (recommended for reviewability); or explicitly extend #448's scope to selected ready bug/feature inputs and repeat its affected gates. This document chooses neither a merge order nor an automatic feature intake on the owner's behalf. #443 and #383 are the first recommended bug priorities; #437→#442 is an actual dependency; #435 can be prepared in parallel once the design record is reconciled.

## 3. Keep Program Lab isolated

#432 is the combined delivery of #429 UI/package, #430 domain/store/archive and #431 shared policy/worker seams. #426 is specification context, not another implementation stream. Pinned combined head remains `ce0b4403341ee9dbdd34dc6994a1244172189fb8` at this snapshot.

#448 already carries the reviewed shared native engine policy and a pinned Lab adaptation/verifier. Reconcile the latest #432 head at slice18, then rerun both default-preserving application corpus/worker proofs and actual Lab build/store/archive/replay. Lab retains its own composition, database, worker/package and historical read-only artifacts. It must not mount in the production app, share production preferences/history, enter its precache, or create a second compiler authority. Do not promise #432's merge or overwrite its owner's UI/domain work. A later separate Lab merge/deployment remains an owner action.

## 4. Review overlapping fixes and reference PRs

All nineteen listed PRs were verified open/unmerged through the GitHub connector for this snapshot (the #448 integration status is maintained directly). Head prefixes identify inputs, not merge authorization.

| PR | Head | Role and disposition |
| --- | --- | --- |
| #448 | moving integration branch | Authorized twenty-slice implementation; sole architecture integration stream. |
| #447 | `a99c35dbae91` | Approved architecture specification/reference; imported into #448, not a second runtime stream. |
| #446 | `5754a0482871` | Frozen redesigned-suite input already adopted; new audit corrections live in #448. |
| #445 | `39581e85ca98` | Focused-name Back fix already adopted; do not duplicate its patch. |
| #444 | `306f4dbb70b7` | Superseded by #446; retain provenance, recommend later administrative closure only after owner review. |
| #443 | `2767d3464e5e` | Keyboard bug intake candidate; green exact-head CI, not yet adopted. |
| #442 | `6087b4dd2196` | Editor S2 stacked on #437. |
| #437 | `1b3de1b8ea8b` | Separately owned editor S1 implementing the approved design. |
| #435 | `7c0c438c8f65` | Separately owned guide feature; sampler-only adoption must not be confused with feature adoption. |
| #432 | `ce0b4403341e` | Combined isolated Lab delivery; slice18 reconciliation input. |
| #431 | `48b72f91eb50` | Shared engine-policy slice combined into #432. |
| #430 | `8700480ec1de` | Lab domain/persistence/archive slice combined into #432. |
| #429 | `e22844ae7ddb` | Lab UI/package slice combined into #432. |
| #428 | `32512c352896` | Editor design/reference; decision A already recorded, not another implementation stream. |
| #426 | `5494f91ecb17` | Lab specification/context; current 073.4 adaptation is #432's delivery. |
| #384 | `b9697d4bb006` | Core #344 canonical-row/CAS bug was already fixed by merged #389. Compare its additional real GodMode import/reload/archive coverage against retained native tests before recommending closure. Do not reapply the old runtime fix or discard distinct coverage. |
| #383 | `0800b40b201c` | Open clipboard/diagnostic fix with failing exact-head CI; repair/reconcile before intake. |
| #296 | `6ed1da480bde` | Illustration-style proposal parked after launch. |
| #282 | `5f57e2de2ff2` | Marketing strategy parked after launch. |

No PR is closed or merged by this sequence. #389 is verified merged; that proves #384's central fix is redundant, not that every proposed GodMode assertion is redundant.

## 5. Phone and launch gates

After the candidate release and selected incoming changes stabilize, complete #425's real-device checks against a recorded exact build: setup link from private Safari into the installed app, Android icon launch (#304), actual keyboard visibility (#300), #427/#436/#440 workout behavior, and new-engine generation. Keep the owner's 17 October iPhone transfer confirmation and screenshot checks as historical completed evidence; repeat changed transfer/offline boundaries on the final candidate rather than treating that earlier build as certification of #448. Finish the separately owned Portuguese-name review (#315) and its reviewed catalog PR.

Before public launch, record ADR0013/RUNBOOK transfer evidence (EU placement, independent monitoring, minute60/75 deletion and physical handoff) or obtain the owner's explicit launch override. This task makes no placement, credential, monitoring or service deployment changes. #425 remains the owner-facing evidence tracker.

Only then refresh [Plan059](../../plans/059-public-launch-ui-validation.md) against the exact current application, open decisions and validation tooling, and obtain the owner's authorization to start it; its existing hold is not lifted here. #314 compaction remains an optional timing/schema decision, not a hidden prerequisite or an architecture migration. If chosen before launch, it needs a separate compatibility plan and new validation before refreshing Plan059. Optional landing screenshots (#438), copy and hidden-today-bar changes likewise need their own owner decisions. #296 and #282 remain postlaunch.

## Reconciliation checklist

For each intake: record exact base/head and owner scope; compare semantic differences against current native owners; identify already-adopted hunks; preserve independent fixtures and mutation assertions; map old tests to actual public producers; review saved identities/archive/import/DraftV2 and offline implications; commit/push atomic changes; run owning contracts and relevant real browser/phone checks; update this table and the migration ledger; obtain the final owner decision without assuming merge/deployment permission. Recheck statuses and CI at that time because these inputs are moving.
