# Taurifer implementation plans

This directory contains bounded implementation/audit plans. It is not a
roadmap. The ordered product and engineering queue lives only in
[`docs/backlog.md`](../docs/backlog.md).

Most numbered plans are already implemented and remain here as design and
regression history. Their file/line anchors describe the commit at which they
were written; never execute an old plan against current code without checking
drift and current governing decisions.

## Current planning state

The owner-approved UI/UX overhaul is the next planned implementation program.
It is split into Plans 049–059. Read the
[cross-plan implementation sequence](../docs/ui-overhaul-implementation-sequence.md)
before starting any child plan; it owns the dependency DAG, serialization of
shared files, finding/decision disposition, owner gates, and public-launch
boundary.

Do not start an implementation branch until the planning PR is owner-approved.
That approval is merged. Plan 049 implementation is in owner review (PR #222);
Plans 050–059 start after 049 merges, in the sequence DAG's order. The
post-Wave-3 product roadmap remains deferred; none of its unrelated features
may be pulled into these plans.

### Owner-approved UI overhaul

| Plan | Phase | State | Outcome |
|---|---:|---|---|
| [049](./049-ui-overhaul-canonical-reconciliation.md) | 0 | **IMPLEMENTATION COMPLETE — OWNER REVIEW** | Reconcile canonical contracts and specify semantic roles, transition/recovery provenance, and the bounded transfer exception. Dispositions: [`docs/ui-overhaul-disposition-register.md`](../docs/ui-overhaul-disposition-register.md). |
| [050](./050-ui-correctness-and-catalog-leverage.md) | 1 | **PLANNED — DEPENDS ON 049** | Fix verified UI-01–UI-07 defects and UI-29's fixture; add copy/overflow/risk-matrix leverage. |
| [051](./051-workout-draft-state-foundation.md) | 2A | **PLANNED — DEPENDS ON 049** | Replace hidden DOM ownership with versioned, crash-safe DraftV2 state. |
| [052](./052-block-transition-provenance-foundation.md) | 2B | **PLANNED — DEPENDS ON 049** | Make block transitions reconstructable, preview-hashed, provenance-preserving, and atomic. |
| [053](./053-ios-install-transfer-foundation.md) | 2C | **PLANNED — DEPENDS ON 049/051** | Build the narrowly scoped one-hour encrypted iOS install transfer and recovery snapshot. |
| [054](./054-landing-and-program-entry.md) | 3 | **PLANNED — OWNER VISUAL GATE** | Deliver the selected product-led landing, adaptive shared entry, five-job hierarchy, install policy, guides, and Privacy page. |
| [055](./055-focus-only-workout.md) | 4 | **PLANNED — DEPENDS ON 051** | Reach capability parity in Focus, add read-only Preview/scope layers, then delete List. |
| [056](./056-progress-and-block-lifecycle.md) | 5 | **PLANNED — DEPENDS ON 052** | Correct Progress scope/evidence and expose only exact, confirmed block transitions. |
| [057](./057-management-surfaces.md) | 6 | **PLANNED — DEPENDS ON 054–056** | Make History read-first, Share repairable/fail-closed, and converge management hierarchy. |
| [058](./058-design-system-convergence.md) | 7 | **PLANNED — PRINCIPAL SURFACES FIRST** | Inventory and migrate every public surface to bounded semantic roles and rendered-role AA. |
| [059](./059-public-launch-ui-validation.md) | 8 | **PLANNED — FINAL OWNER GATE** | Bind catalog, automated, physical-device, accessibility, privacy, and telemetry evidence to one candidate SHA. |

Phase 2 has three independently mergeable plans because workout data loss,
program-transition provenance, and temporary backend security have distinct
failure and rollback boundaries. Their combined completion gate closes the
phase.

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
