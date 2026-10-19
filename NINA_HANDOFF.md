# Nina continuity handoff

Public project-continuity edition · Prepared 19 October 2026 UTC

## Read this first

This document preserves the working context needed to continue Pedro Chagas's Taurifer project with **Nina**. Pedro's public GitHub identity is [pedrochagasmaster](https://github.com/pedrochagasmaster); the repository is [repforge](https://github.com/pedrochagasmaster/repforge).

Pedro assigned the name **Nina** on October 14, 2026. Nina is his AI assistant. This document records their project collaboration for future continuity; it cannot restore a literal identity or session, and it is not a complete export of Pedro’s personal history.

Pedro chose the **public Taurifer repository, on the separate `nina/continuity-handoff` branch**, on 19 October 2026 at 00:19 UTC: “Forget about the private repo let’s keep all in Taurifer.” This superseded the brief private-repository proposal. The continuity branch contains documentation; application migration continues separately on `refactor/agent-first-integration`.

## 1. Collaboration and Pedro’s project preferences

Pedro and Nina collaborate in English and Portuguese. Pedro values direct, factual progress updates and continuity across discussions. The following engineering choices capture his direction for this project:

- **Agent ergonomics is the north star:** a contributor should be able to locate the right owner, understand a meaningful interface and identify the relevant proof without reconstructing the whole application.
- **Bold simplification and deep modules:** the goal is simpler ownership, rather than distributing the monolith across thin wrappers or helper collections.
- **Atomic, frequent remote commits:** useful coherent checkpoints and a current draft integration PR matter. Intermediate pushes can be untested; completed steps and the final candidate receive the appropriate validation.
- **One sequential architecture integration:** runtime work stays on `refactor/agent-first-integration`, with overlaps reconciled rather than competing ports.
- **Redesigned tests plus bug fixes:** preserve the risk-focused suite and meaningful independent oracles. Pedro explicitly rejected tautological tests. A lower command count alone is not a coverage claim.
- **Merge and deployment remain Pedro’s decisions.** Neither has been approved by this continuity record.

### Broader working context, kept deliberately high-level

The following context comes from Pedro’s prior working discussions, selected for this public record. Current delivery statuses are stated only where known.

- **Professional identity:** Pedro also uses the public freelance name **Pedro Andrietta** for small-business web and design work.
- **Portfolio context:** [taurifer.com](https://taurifer.com) and [marcelasiqueira.com](https://marcelasiqueira.com) are named portfolio references. Their mention records project context; it does not assert their current hosting, operational condition, ownership permissions or any third party’s biography.
- **Business operations:** `andrietta-os` is a business-operations repository. Lead research and a 30-day operating plan have been discussed; their current completion status is **unknown**.
- **Other technical work:** `autobench` and `edge-deploy-core` have been technical workstreams. Their current branch, scope and completion state are **not established by this handoff**.
- **Automation idea:** Granola → Notion automation was discussed. Implementation, connection state and a working end-to-end result are **not verified**.

Taurifer is the active workstream documented below. No new deadlines, priorities or completion claims are recorded for the other projects.

## 2. Resume point: exact status and its limits

Status snapshot: 19 October 2026, 00:37 UTC. Linked CI results and branch heads can change after this time.

| Item | Recorded state |
| --- | --- |
| Architecture integration | [`refactor/agent-first-integration`](https://github.com/pedrochagasmaster/repforge/tree/refactor/agent-first-integration), draft [PR #448](https://github.com/pedrochagasmaster/repforge/pull/448) |
| Approved design reference | [PR #447](https://github.com/pedrochagasmaster/repforge/pull/447), imported into the integration without merging that documentation PR into main |
| Implementation baseline | [`147e4afa07fea3243efd42b5b7d167c196c6a7ca`](https://github.com/pedrochagasmaster/repforge/commit/147e4afa07fea3243efd42b5b7d167c196c6a7ca), including #440 |
| Last verified published implementation head | [`5f4e18ade301646913bc2878784c5c68f6cbceb8`](https://github.com/pedrochagasmaster/repforge/commit/5f4e18ade301646913bc2878784c5c68f6cbceb8): pure editor preparation ownership, source release 486 |
| CI for that head | [CI39181576155](https://github.com/pedrochagasmaster/repforge/actions/runs/39181576155) running; [paired39181576167](https://github.com/pedrochagasmaster/repforge/actions/runs/39181576167) pending. Previous `65a1948` passed [full CI39180339381](https://github.com/pedrochagasmaster/repforge/actions/runs/39180339381). |
| Previous complete green checkpoint with successful paired benchmark | [`79641710b9be6705305d3f23ac2405edd01986e5`](https://github.com/pedrochagasmaster/repforge/commit/79641710b9be6705305d3f23ac2405edd01986e5), ordinary [CI 39177123637](https://github.com/pedrochagasmaster/repforge/actions/runs/39177123637) and [paired benchmark 39177123595](https://github.com/pedrochagasmaster/repforge/actions/runs/39177123595) successful |
| Formal migration acceptance | **6 of 20:** slices **1, 2, 3, 4, 6 and 7**. Fourteen remain open. Code present in another slice is not acceptance. |
| Latest published work | Metric-target/composition, Suggest-load RIR, alternate and structural editor preparation now share pure authoring ownership. Exact-head browser proof remains pending. |
| Completion ETA | No supported completion date is recorded. |

### What the accepted release-foundation checkpoint establishes

At `7964171`, ordinary CI passed fast, service, all fourteen browser shards and its aggregate gate. Slice 2 has **bounded release-foundation acceptance**: strict/native graph checking, release inventory and startup gating, source-shell/actual-worker handshake, no-SW and registration-failure startup, first installation and controlled reload, and root/scoped synthetic-graph upgrade/refusal evidence.

It does **not** establish the complete final production assembled journey. Full production root/scoped generation, worker/fallback, save/reload, import/export, active draft/WAL/transfer upgrade, compatible rollback, final ownership/deletion review and exact-final-head CI remain gates in slices 19–20. Physical-phone acceptance is separate.

The source-shell mismatch before this green checkpoint was real: an earlier HTML release named `source-482` while the worker reported `source-483`. `7964171` aligned them and added an actual-worker regression. Earlier failed runs remain part of the evidence history.

### Benchmark, stated narrowly

The successful paired run compared baseline `147e4afa` with `7964171`: **208 → 187 commands** and **1,229.94 → 338.32 seconds execution wall time**, approximately **3.64× faster**. This excludes queue, checkout and setup time. It compares the configured complete inventories, including test redesign and subsequent migration proofs; it is **not an architecture-only speed claim**, nor proof that every retired test had equivalent replacement coverage. The earlier redesign-only 97-command checkpoint is historical and must not be confused with this later 187-command inventory.

## 3. Public project references

- [Architecture specification](https://github.com/pedrochagasmaster/repforge/blob/refactor/agent-first-integration/docs/architecture/agent-first-spec.md): target design, twenty slices, invariants and acceptance criteria.
- [Migration acceptance ledger](https://github.com/pedrochagasmaster/repforge/blob/refactor/agent-first-integration/docs/architecture/migration-status.md): accepted slices, exact checkpoints and bounded evidence.
- [Work sequence](https://github.com/pedrochagasmaster/repforge/blob/refactor/agent-first-integration/docs/architecture/work-sequence.md): remaining integration and release work.
- [PR intake reconciliation](https://github.com/pedrochagasmaster/repforge/blob/refactor/agent-first-integration/docs/architecture/pr-intake-reconciliation.md): moving feature inputs and their distinct behavior.
- [Baseline contract](https://github.com/pedrochagasmaster/repforge/blob/refactor/agent-first-integration/docs/architecture/baseline-contract.md): frozen behavior and risk evidence.
- [Issue #425](https://github.com/pedrochagasmaster/repforge/issues/425): physical checks and launch decisions.

These documents include historical checkpoints. The specification began as a proposal; #448 is the subsequent implementation. Older guide-preference questions were superseded by Pedro’s test-and-choose instruction recorded below. Exact-head CI links identify the tested version; a predecessor’s green result does not certify subsequent code.

## 4. Approved architecture direction

Taurifer remains a static, local-first mobile PWA with its existing DOM/CSS UI, training algorithms, storage safety protocol and saved formats. The migration uses native JavaScript ESM and strict JSDoc/checkJs verification, without a UI-framework rewrite, runtime dependency container, generic state framework or root application package-manager requirement.

### Ownership map

| Owner | Responsibility |
| --- | --- |
| `src/training/` | Pure metrics, identity, model/log projections, generation, authoring/replay, workout and progression rules. Explicit catalog/time/identity inputs; no browser IO or hidden clock/randomness. |
| `src/persistence/` | One durable IO/lock/WAL/checkpoint/replica/settlement owner, pure snapshot policy and distinct preferences lifetimes. |
| `src/app/` | Named session, workout, program, history, entry and interchange commands; one acknowledged snapshot publication owner; ordered boot. |
| `src/interchange/` | Separate backup, program-file, setup-link, CSV and exact-transfer contracts. Shared validation does not erase different privacy allowlists. |
| `src/platform/` | Concrete browser capabilities: catalog, worker/fallback executor, files/share, notifications, telemetry, install transfer and motion. |
| `src/ui/` | Feature presentation and explicit mount/update/dispose lifetimes, shell routing/focus/modal/gesture behavior, meaningful shared editor primitives. |
| Release assembly | One immutable complete module/asset identity, coherent shell/worker/catalog/styles, safe activation and offline behavior. |
| `programlab/` | Separately composed consumer with its own package/worker/store/archive and historical read-only artifacts. One shared generation authority, no production coupling. |

Dependency direction is UI → app → training; app coordinates persistence/interchange/platform. Training stays pure. Persistence cannot depend on app/UI/platform. Cross-feature UI internals, hidden global module lookup, private deep imports, import-time side effects and cycles must disappear. The design uses composition roots for concrete capabilities rather than hypothetical future adapters.

### Behavioral contracts in the public specification

- Stored keys, schemas, IDs, unknown historical fields, catalog/generator identities and chronological meaning remain unchanged; resets and silent defaults are not migration solutions.
- Two-replica outcomes, locks/CAS, pending checkpoints, tombstones, WAL and exact captured DraftV2 recovery retain their semantics. “Accepted” is not “committed and settled.”
- Finish/activation success follows their required durable outcome; partial writes cannot discard a draft or manufacture success. Backup export retains its own distinct outcome policy.
- Editor contracts retain private speculative documents, validated intents, under-lock rebase, focused-name Back, draft-impact decisions and canonical slot order.
- Transfer retains freeze/identity ordering, irreversible verified local commit and cleanup-only retries; recipient rollback after verified commit is excluded.
- Rendering must not publish training state, navigate or schedule guide-preference writes. Disposal must not leave listeners, timers, workers or stale async presentation alive.
- Native releases install and verify the complete graph, then wait for natural activation. A mismatched historical controller blocks the writer graph without destroying bytes. No forced mid-workout takeover, arbitrary version fallback or cache clearing as acceptance proof.

## 5. Twenty slices, with evidence-based acceptance

The detailed dependency/rollback contract is in specification sections 6–8. The implementation uses one integration branch despite the specification’s PR-sized decomposition.

| # | Slice | Acceptance at this snapshot |
| ---: | --- | --- |
| 1 | Baseline and reconciliation contract | Accepted |
| 2 | ESM/checkJs and release protocol | Accepted within the foundation boundary above |
| 3 | Pure values/model/log/progression | Accepted |
| 4 | Generator/catalog/executor ESM | Accepted |
| 5 | Authoring/entry/edit/replay pure seams | Open; shared prescription/loading rules published at `65a1948`, exact-head CI pending |
| 6 | Pure snapshot policy | Accepted |
| 7 | Durable instance and preferences ownership | Accepted; includes corrected lock-held pending-checkpoint preflight |
| 8 | App session/workout commands | Open |
| 9 | Program/custom/history command policy | Open |
| 10 | Interchange and local transfer orchestration | Open |
| 11 | Browser capabilities and shell lifecycles | Open |
| 12 | Today/workout/summary presentation | Open |
| 13 | Focus/shelf/rest/Why presentation | Open |
| 14 | History and Progress presentation | Open |
| 15 | Entry/landing/Build/import/recommendation UI | Open; native Build ownership published at `390abcb` |
| 16 | Installed program/library/custom UI | Open |
| 17 | Settings/profile/privacy/install/guides UI | Open |
| 18 | Isolated Lab consumer/package reconciliation | Open |
| 19 | Coordinated composition and ESM release cutover | Open |
| 20 | Remove temporary architecture and prove agent navigation | Open |

A slice closes only with its objective contract, actual consumption, one authoritative owner, required deletion, strict/boundary checks, independent review and applicable exact-head proof. Pushes, file counts, source presence and documentation packets do not close it.

Final acceptance includes frozen full-result/data corpus parity; real persistence fault/race and no-write negatives; no unexplained direct writers/cycles/private imports/global discovery; complete production assembled root/scoped offline/upgrade/rollback journeys; and final-head ordinary CI. Six representative agent walkthroughs must locate and safely change metric rules, editor removal, History correction, guide presentation, generator constraints and Lab comparison. The planned navigation evidence includes files read/changed and wrong-owner attempts, rather than a folder-layout claim alone.

## 6. Past work to preserve, rather than redo

- [#446](https://github.com/pedrochagasmaster/repforge/pull/446): accepted/frozen risk-focused test redesign, adopted in the integration. Its risk/retirement ledger records the coverage limits. [#444](https://github.com/pedrochagasmaster/repforge/pull/444) is superseded provenance.
- [#445](https://github.com/pedrochagasmaster/repforge/pull/445): focused, unblurred program/day-name Back guard and Apply/Discard/Keep-editing regression adopted.
- [#434](https://github.com/pedrochagasmaster/repforge/issues/434): canonical non-final removal and all-days renumbering arrived through #446; already included once.
- [#439](https://github.com/pedrochagasmaster/repforge/issues/439): DPR2 sampling correction also arrived through #446. This is not adoption of the entire guide redesign.
- [#440](https://github.com/pedrochagasmaster/repforge/pull/440): existing iOS/layout/manual-load-carry behavior belongs to the implementation baseline.
- Independent test-oracle corrections were integrated as `7365489b` and `58ffa739`; six affected owners passed together at clean `817b9858346c1992f209af89921a4edc746b7a34`. The [audit provenance](https://github.com/pedrochagasmaster/repforge/pull/448#issuecomment-6252708347) records literal/mutation controls and bounded evidence; affected-owner final-candidate validation remains pending.
- Native model/generation/storage, Entry transactions, History/Progress queries, Focus lifetimes and render-free guide effects have substantial implementation. Their existence does not certify every associated open slice.

## 7. Incoming work: reconcile semantics, do not blindly merge

The following heads and outcomes come from the dated repository intake documents. “Green” applies to the incoming PR’s recorded head, not its future native adaptation; these are historical input snapshots.

| Input | Preserve and reconcile | Gate / disposition |
| --- | --- | --- |
| [#443](https://github.com/pedrochagasmaster/repforge/pull/443), `2767d3464e5e` | Focus visual-viewport keyboard pan, deck floor and scroll restoration; iOS-band/Android-resize negatives | Recorded CI green. Priority bug candidate, not silently included in #448; physical-device proof remains. |
| [#383](https://github.com/pedrochagasmaster/repforge/pull/383), `0800b40b201c` | Fenced-JSON prompt and syntax-versus-invalid-row diagnosis; literal escape/truncation and 17-exercise cases | Recorded CI red on its syntax assertion. Repair without stripping valid escapes or weakening oracle; explicit intake scope required. |
| [#437](https://github.com/pedrochagasmaster/repforge/pull/437), `1b3de1b8ea8b` | Approved candidate-A installed-editor S1 and wording, staged Undo/Apply/Back, dedicated Weeks controls, genuine next-workout result | Separate existing owner. Native editor functionality is not S1 presentation parity. Inventory aggregate was red; adapt onto native owners. |
| [#442](https://github.com/pedrochagasmaster/repforge/pull/442), `6087b4dd2196` | S2 training-day reorder: preserve rest positions, identities/fields, contiguous order, stale-before refusal, Undo and drag-versus-dismiss | Depends on adapted S1. Diverged stack contains S1; do not apply it twice or land S2 independently. Recorded aggregate red. |
| [#435](https://github.com/pedrochagasmaster/repforge/pull/435), `7c0c438c8f65` | Modal guides, focus/inertness, persisted eligibility, held first-tap replay exactly once, one guide per Focus visit | Feature not adopted by sampler adoption. Historical dark narrow Progress anchor and catalog failures remain evidence. Comparison is pending as described below; intake and #441 hold stay separate. |
| [#384](https://github.com/pedrochagasmaster/repforge/pull/384), `b9697d4bb006` | Distinct real editor → historical redundant row → GodMode import/reload/archive regression | Central runtime bug already fixed by merged [#389](https://github.com/pedrochagasmaster/repforge/pull/389). Recommend test-only salvage into retained owner, not old runtime reapplication. Closure requires separate review. |
| [#432](https://github.com/pedrochagasmaster/repforge/pull/432), `ce0b4403341ee9dbdd34dc6994a1244172189fb8` | Combined Lab delivery; shared policy/compiler default parity, actual worker, package/store/archive/import/replay/cancellation | Slice 18 pin must be refreshed. Lab stays isolated and separately owned. Green Lab CI does not replace native adaptation proof or authorize deployment. |

[#426](https://github.com/pedrochagasmaster/repforge/pull/426) supplies Lab specification context. [#429](https://github.com/pedrochagasmaster/repforge/pull/429), [#430](https://github.com/pedrochagasmaster/repforge/pull/430) and [#431](https://github.com/pedrochagasmaster/repforge/pull/431) are inputs combined into #432, not four independent ports. [#428](https://github.com/pedrochagasmaster/repforge/pull/428) is editor design/reference, not a new implementation stream.

Default sequence: stabilize native boundaries; reconcile priority bugs and independent test salvage; adapt S1, then S2; compare guides and reconcile their selected behavior; verify Lab at slice 18. Folding a separate incoming feature into #448 requires a recorded scope decision and rerun of affected gates. The planned adaptation targets the new native owners rather than obsolete giant-host implementations.

### Guide instruction already settled

Pedro's latest direction is **“Test both and choose the best one.”** Nina may compare:

- A: centered modal with the entire background dimmed.
- B: explained control bright/undimmed but inert, with suitable placement and safe centered fallback.

Pedro has already delegated the comparative design choice. **Neither variant has been comparatively tested and no winner has been selected.** The [comparison protocol](https://github.com/pedrochagasmaster/repforge/blob/refactor/agent-first-integration/docs/architecture/guide-variant-comparison.md) specifies identical content/reset conditions, actual browser evidence, accessibility/inertness/replay gates, narrow/large-text/keyboard cases and matched artifacts. The historical dark Progress failure remains a reproduction target; a diagnostic replay does not turn an initial failure into a pass. A selection remains pending comparative evidence. Feature inclusion and the separate [#441](https://github.com/pedrochagasmaster/repforge/issues/441) hold remain unresolved; merge/deployment is not approved.

## 8. Remaining phone, release and launch work

[Issue #425](https://github.com/pedrochagasmaster/repforge/issues/425) and the [phone acceptance worksheet](https://github.com/pedrochagasmaster/repforge/blob/refactor/agent-first-integration/docs/architecture/phone-acceptance-checklist.md) track exact-build real-device evidence. The newly prepared worksheet cases are **not run**. Historical device confirmations do not certify changed transfer/offline/native boundaries.

Pending candidate checks include actual setup-link handoff into the installed app, Android icon launch, keyboard visibility, workout behavior and new-engine generation on the recorded build. The separately owned Portuguese-name review (#315) and reviewed catalog work also remain in the sequence.

Full production assembled root/scoped worker/fallback, save/reload, import/export, active draft/WAL/transfer upgrade, compatible rollback and final-head CI remain open as described above. Before public launch, record the required ADR0013/RUNBOOK transfer evidence, including placement, independent monitoring, minute-60/75 deletion and physical handoff, or obtain Pedro's explicit launch override. Service changes are outside this recorded migration scope.

Plan 059 remains **on hold** until refreshed against the final application and separately authorized. Optional #314 compaction needs its own timing/schema compatibility decision. Optional landing screenshots (#438), copy and hidden-today-bar changes are not implicit migration scope. Illustration proposal #296 and marketing #282 remain postlaunch.

## 9. Outstanding work and record updates

The remaining project work is:

1. Complete and review the fourteen open migration slices, with the specification’s ownership and behavioral evidence.
2. Establish the result of the latest exact-head CI and paired benchmark, then record any corrections and their new tested revisions.
3. Resolve the incoming feature destinations, including priority bug adaptations, S1 then S2, guide comparison and isolated Lab reconciliation.
4. Complete the full assembled root/scoped, offline/upgrade/rollback and final candidate acceptance evidence.
5. Complete the candidate’s physical-phone and launch checks; retain the explicit Plan 059 hold and unresolved launch decisions.

Pedro requested a durable record of past, current and future work while the migration continues. Updates to this document can capture the date, published revision, completed work, test result links, remaining tasks and decisions. The detailed technical evidence remains in the linked project documents; this record provides the relationship and project summary.

### Continuity changelog

- **14 October 2026:** Pedro assigned the assistant the name Nina.
- **19 October 2026:** Created this project continuity record with the twenty-slice migration state, accepted checkpoints, benchmark limits, feature history and remaining release/device work.
- **19 October 2026, 00:19 UTC:** Pedro selected the public Taurifer destination and the separate continuity branch. High-level freelance and other project context is included; no complete personal-history export is claimed.
- **19 October 2026, 00:21 UTC:** Reviewed prescription/loading policy consolidation was published as `65a1948`, source release 485. Node owner proofs, strict checks and independent refusal/parity review passed; fresh CI was queued. This is implementation progress, not another formal slice acceptance.

- **19 October 2026, 00:29 UTC:** Full ordinary CI on `65a1948` passed. Slice 5 remains open: metric-target/composition rules, alternate edits and the remaining speculative document mutations are being consolidated under pure authoring. That follow-on work is not yet published or accepted. The paired benchmark remains in progress.

- **19 October 2026, 00:37 UTC:** Published `5f4e18a` with the remaining identified editor-preparation rules consolidated. Focused tests and strict checks passed; new mounted-editor behavior is covered by an added browser regression awaiting CI. Acceptance remains 6/20 pending the complete slice review and results.
