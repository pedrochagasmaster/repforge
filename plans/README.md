# Taurifer implementation plans

This directory contains bounded implementation/audit plans. It is not a
roadmap. The ordered product and engineering queue lives only in
[`docs/backlog.md`](../docs/backlog.md).

Most numbered plans are already implemented and remain here as design and
regression history. Their file/line anchors describe the commit at which they
were written; never execute an old plan against current code without checking
drift and current governing decisions.

## Current planning state

The owner-approved UI/UX overhaul is the active implementation program.
It is split into Plans 049–059. Read the
[cross-plan implementation sequence](../docs/ui-overhaul-implementation-sequence.md)
before starting any child plan; it owns the dependency DAG, serialization of
shared files, finding/decision disposition, owner gates, and public-launch
boundary.

The planning approval and Plans 049–058 are merged, together with the
post-053 durable-state bridge. Plans 055, 056, 057 and 058 landed through
PRs #243, #244, #248 and #256 respectively. Implementation completion does
not close the remaining audit findings or physical-device launch gates.

The current workfront is the post-058, pre-059 candidate-construction window
ratified by PR #281 and amended on 2026-09-30. Follow the canonical backlog and its
[post-058 clearance sequence](../docs/post-058-open-pr-clearance-sequence.md)
for repository-truth cleanup, stabilization, the concurrently developed
standalone alpha-readiness work, then the unified redesign
([Plan 064](./064-unified-redesign-convergence.md): landing, Direction D /
Plan 063 and onboarding in one production PR), then selected already-open
Next work. Plan 059 remains planned and validates the resulting stable
candidate last. This bounded exception does not pull unrelated Later/Gated
work forward.

Plan 063 (Direction D) is owner-selected; Plan 064's R0 slice migrated it from
PR #272's branch at `2f2fc044` onto the workfront (PR #295); it keeps its number as the main-app
specification consumed by Plan 064. No other work may use the number 063;
PR #258's branch-local plan of that number is renumbered when that work
resumes. The Opus orchestrator's starting brief is
[`docs/agents/prompts/plan-064-opus-orchestrator.md`](../docs/agents/prompts/plan-064-opus-orchestrator.md).

### Owner-approved UI overhaul

| Plan | Phase | State | Outcome |
|---|---:|---|---|
| [049](./049-ui-overhaul-canonical-reconciliation.md) | 0 | **IMPLEMENTED** | Reconcile canonical contracts and specify semantic roles, transition/recovery provenance, and the bounded transfer exception. Dispositions: [`docs/ui-overhaul-disposition-register.md`](../docs/ui-overhaul-disposition-register.md). |
| [050](./050-ui-correctness-and-catalog-leverage.md) | 1 | **IMPLEMENTED** | Fix verified UI-01–UI-07 defects and UI-29's fixture; add copy/overflow/risk-matrix leverage. |
| [051](./051-workout-draft-state-foundation.md) | 2A | **IMPLEMENTED — PR #226** | Replace hidden DOM ownership with versioned, crash-safe DraftV2 state. |
| [052](./052-block-transition-provenance-foundation.md) | 2B | **IMPLEMENTED — PR #228** | Make block transitions reconstructable, preview-hashed, provenance-preserving, and atomic. |
| [053](./053-ios-install-transfer-foundation.md) | 2C | **IMPLEMENTED — PR #235** | Build the narrowly scoped one-hour encrypted iOS install transfer and recovery snapshot. |
| [Bridge](../docs/taurifer-architecture-refactoring-plan.md#owner-ratified-disposition-after-plan-053) | 2D | **IMPLEMENTED — PR #240** | One durable outcome and one settlement/recovery owner under accepted Plans 051–053; no new numbered plan or second queue. |
| [054](./054-landing-and-program-entry.md) | 3 | **IMPLEMENTED — PR #241** | Deliver the selected product-led landing, adaptive shared entry, five-job hierarchy, install policy, guides, and Privacy page. |
| [055](./055-focus-only-workout.md) | 4 | **IMPLEMENTED — PR #243** | Reach capability parity in Focus, add read-only Preview/scope layers, then delete List. |
| [056](./056-progress-and-block-lifecycle.md) | 5 | **IMPLEMENTED — PR #244** | Correct Progress scope/evidence and expose only exact, confirmed block transitions. |
| [057](./057-management-surfaces.md) | 6 | **IMPLEMENTED — PR #248** | Make History read-first, Share repairable/fail-closed, and converge management hierarchy. |
| [058](./058-design-system-convergence.md) | 7 | **IMPLEMENTED — PR #256** | Inventory and migrate every public surface to bounded semantic roles and rendered-role AA. |
| [059](./059-public-launch-ui-validation.md) | 8 | **PLANNED — FINAL OWNER GATE** | Bind catalog, automated, physical-device, accessibility, privacy, and telemetry evidence to one candidate SHA. |

### Post-058 candidate construction

| Plan | State | Outcome |
|---|---|---|
| 063 (on PR #272, `redesign/direction-d`) | **OWNER-SELECTED SPECIFICATION — consumed by 064** | Direction D: the main-app reference for Today, Focus and rest, Why, session summary, Progress, History and Program (ADR 0016). Its P-slices are executed as Plan 064 slice R3. |
| [064](./064-unified-redesign-convergence.md) | **IN PROGRESS — PR #295** | One unified redesign production PR: shared system, landing, Direction D, owner-selected onboarding, cross-surface journeys, full convergence and adversarial review, orchestrated by Opus with Sonnet workers. Precedes #258/#257 integration and Plan 059. |

Phase 2 has three independently mergeable plans because workout data loss,
program-transition provenance, and temporary backend security have distinct
failure and rollback boundaries. Their combined completion gate closes the
phase. The owner-ratified unnumbered bridge followed 053 and merged in PR #240.
Plan 059 retains its owner gates and the post-058 candidate-construction
prerequisites linked above.

Implementation PRs stop at **OWNER REVIEW** after their engineering gates pass.
Only an explicit owner instruction authorizes merge. A merged predecessor does
not grant merge authority for the next plan.

### Outside the overhaul programme

| Plan | State | Meaning |
|---|---|---|
| [068](./068-generate-inputs.md) | **PLANNED — OWNER DECISIONS PENDING** | Issue #323 phases 2–3: equipment adjustment inside the Environment step, program length and rep pattern as a result-screen chip, and verified per-movement confirmation offers in the Generate preview. No new onboarding screen and no `GENERATOR_VERSION` bump. |
| [067](./067-engine-replacement.md) | **SPECIFICATION READY — APPLICATION IMPLEMENTATION PENDING** | Owner-directed full catalog/ontology, generation and progression replacement; reproducible sanitized evidence. Supersedes the future engine direction of Plans 046–048 and 065. |
| [066](./066-mobile-native-platform-polish.md) | **IMPLEMENTED — PR #308; DEVICE REVIEW PENDING** | Accessible zoom (ADR 0018), capability-gated hover, tap feedback, overscroll containment, visible-viewport overlays, and control-only selection/callout protection. Physical acceptance remains with the existing device matrix and Plan 059. |
| [065](./065-program-generation-engine-overhaul.md) | **IMPLEMENTED — PR #306; REPLACEMENT SPECIFIED IN 067** | Fixes every finding of the 3 October 2026 program-generation audits (F01 one-set compounds, false Home posterior work, job collapse onto one exercise, Foundation effort drift, no-op priorities, capability gaps) and overhauls the compiler into a function-aware, week-aware, self-assessing resolver with a 200-program quality gate. |
| [062](./062-ci-agent-feedback-loop.md) | **IMPLEMENTED — PR #248** | Refactors CI and local verification around explicit edit, packet and candidate loops so coding agents get fast targeted feedback while final persistence, race, privacy, offline, accessibility, generative and visual gates remain strict. |
| [061](./061-import-exercise-matching.md) | **IMPLEMENTED IN PR #230** | Fixes shared import exercise matching: stopword/equipment/containment scoring, up to three candidates per review row, curated aliases via the curation file, gated on a two-tier fixture corpus. Independent of Plan 060 and of PR #225. |
| [060](./060-free-form-import-grilling-reconciliation.md) | **IMPLEMENTED ACROSS PRS #225/#230** | Reconciles two independent grilling sessions on the PR #225 free-form import hand-off into one executable contract. Amends ADR 0014 on persistence and telemetry enumerations. Independent of Plans 049–059; do not sequence it into their DAG. |

### Prior foundation and historical plans

| Plan | State | Meaning |
|---|---|---|
| [044](./044-posthog-measurement-experiments-paywall.md) | **DEFERRED DURING UI OVERHAUL** | Historical umbrella for measurement and later commercialization sequencing. Do not resume its post-Wave-3 work through a UI-overhaul PR. |
| [045](./045-posthog-measurement-foundation.md) | **IMPLEMENTED** | Shipped PostHog boundary, pseudonymous identity, opt-out, leakage tests, and versioned alpha funnels/dashboards. |
| [046](./046-multi-strategy-progression-engine.md) | **IMPLEMENTED** | Shipped shared Free engine with reviewed versioned strategies. |
| [047](./047-taurifer-program-families-compiler.md) | **IMPLEMENTED** | Shipped compiler/catalogue are the record. Current-tense guidance stands except where G-01–G-88 supersede it (see the disposition register); Plans 052/056 own transition and recovery derivation from compiler output. |
| [048](./048-program-entry-onboarding-redesign.md) | **IMPLEMENTED** | Shipped entry flow is the record (`docs/program-entry-flow.md`). Sequential result-then-preview is superseded by G-79; landing, install timing, and guides are specified by Plans 053–054; see the disposition register. |
| [041](./041-prelaunch-all-findings-remediation.md) | **IMPLEMENTED; EVIDENCE PENDING** | PR #114 shipped the retained findings. Remaining work is the exact physical iOS/VoiceOver and Android/TalkBack release-evidence matrix recorded in the plan and canonical backlog. |
| [038](./038-ai-coach.md) | **SUPERSEDED** | Historical BYOK design only. ADR 0011 governs any future managed Taurifer AI plan after paid-beta economics. |
| [040](./040-launch-readiness-ui-ux-audit.md) | **HISTORICAL AUDIT** | Provenance for Plan 041, not an open remediation queue. |
| [029](./029-phased-roadmap-pr-breakdown.md) | **HISTORICAL META-PLAN** | Its old four-phase roadmap shipped or was superseded. It is not current sequencing. |

Plans 045–048 describe the foundation on which the overhaul is planned. Their
numbering records the dependency order: measurement boundary → shared engine →
family/compiler → entry/onboarding. Plan 049 must reconcile their current-tense
contracts where G-01–G-88 supersede them. General lifecycle work, equipment
contexts, publisher attribution, and the Pro roadmap remain deferred.

## Implemented plans

| Range | Outcome |
|---|---|
| 001–016 | Core session loop, persistence, export, units, accessibility, Focus mode, and related foundations. |
| 017–028 | Program import/export, log merge, warm-ups, PRs, substitutions, onboarding literacy, mesocycle/block implementation, and program identity. Plan 024 is implemented despite its stale historical draft text. |
| 030–037 | Copy, chart, command, effort, navigation, block confirmation, contrast, and performance-gated recovery work. |
| 039 | Capacity-driven deterministic suggestions. |
| 042 | Licensed exercise-detail artwork. |
| 043 | “Why this weight?” recommendation inspector. |

Plan numbers are intentionally not reused. There is no Plan 029 implementation
status because it is a meta-plan, and no Plan 038 implementation because its
direction was superseded.

## How to create or use a plan

For the UI overhaul, use the [implementation evidence protocol](../docs/agents/implementation-evidence.md)
and [phase proof checkpoints](../docs/agents/ui-overhaul-proof-checkpoints.md).
They govern first-slice proof and correction review; the numbered plans retain
their product scope, dependencies, atomic commits, and owner gates.

For Plans 055–059, execution mechanics are intentionally outside the canonical plan contract. Use each plan's
bounded execution slices together with the evidence protocol and proof checkpoints; they define scope, ordering, proof,
and review gates without selecting an implementation strategy. Read the
[Plan 050/051 execution lessons](../docs/agents/ui-overhaul-execution-retrospective.md)
when preparing the first acceptance contract. The historical
[Herdr procedure](../docs/agents/herdr-ui-overhaul-execution.md) and
[Plan 052 resume prompt](../docs/agents/prompts/plan-052-herdr.md) are retained only as records of earlier execution
and do not govern Plans 055–059.

New implementation plans should name the required contracts, risky first proof,
final completion evidence, and owner/environment gates. Reference the live
`docs/ci.md` edit → packet → candidate mechanics instead of copying an
exhaustive command cadence. Historical Plans 055–059 keep their original proof
claims; current agent execution follows the live CI and evidence docs. A plan
may require an earlier broad suite when it names the risk that justifies it.

1. Confirm the work is present and correctly prioritized in
   [`docs/backlog.md`](../docs/backlog.md).
2. Read the current `AGENTS.md`, governing ADRs, and relevant specification.
3. Re-check every code anchor against `HEAD`; old line numbers are evidence,
   not authority.
4. Keep one plan bounded to one reviewable outcome and its required tests.
5. On completion, update this index and the canonical backlog in the same PR.

The application remains a static, build-free PWA. Browser tests use the pinned
test-only dependencies under `test/`; do not introduce root application
dependencies or a platform rewrite through an implementation plan.

## Product guardrails

- Core training stays local-first, owned, and exportable. Plan 053's explicit,
  encrypted, one-hour install transfer is the only approved server exception in
  this initiative; it is not sync or backup.
- Minimal Phase 1 measurement/commerce infrastructure must have a direct
  approved validation purpose.
- No fake doors, future-looking in-product controls, manual timeless Pro codes,
  or payment before working Pro value.
- No sixth navigation tab, social/gamification layer, powerlifting claim, or
  full coach SaaS.
- Managed Taurifer AI is later, product-operated, and governed by ADR 0011;
  BYOK/browser-direct providers are not an implementation path.
- Protect workout speed, data integrity, accessibility, and deterministic
  analytical independence above feature breadth.

## Verification baseline

Use only the checks relevant to the change, but documentation and code must not
drift. Common gates are:

```bash
git diff --check
node --check app.js
node tools/build-i18n.mjs --check
node test/generative/run.mjs
```

Browser changes additionally require the appropriate focused Playwright suite,
full simulation when shared state changes, and refreshed light/dark UI screen
catalogue images for user-visible surfaces.
