# Taurifer implementation plans

This directory contains bounded implementation/audit plans. It is not a
roadmap. The ordered product and engineering queue lives only in
[`docs/backlog.md`](../docs/backlog.md).

Most numbered plans are already implemented and remain here as design and
regression history. Their file/line anchors describe the commit at which they
were written; never execute an old plan against current code without checking
drift and current governing decisions.

## Current planning state

| Plan | State | Meaning |
|---|---|---|
| [044](./044-posthog-measurement-experiments-paywall.md) | **ACTIVE CONTRACT** | Governs measurement, rolling alpha, working-Pro commercialization, and later AI Preview sequencing. It explicitly requires smaller successor implementation plans; do not implement it as one change. |
| [041](./041-prelaunch-all-findings-remediation.md) | **IMPLEMENTED; EVIDENCE PENDING** | PR #114 shipped the retained findings. Remaining work is the exact physical iOS/VoiceOver and Android/TalkBack release-evidence matrix recorded in the plan and canonical backlog. |
| [038](./038-ai-coach.md) | **SUPERSEDED** | Historical BYOK design only. ADR 0011 governs any future managed Taurifer AI plan after paid-beta economics. |
| [040](./040-launch-readiness-ui-ux-audit.md) | **HISTORICAL AUDIT** | Provenance for Plan 041, not an open remediation queue. |
| [029](./029-phased-roadmap-pr-breakdown.md) | **HISTORICAL META-PLAN** | Its old four-phase roadmap shipped or was superseded. It is not current sequencing. |

Approved work that does not yet have a numbered execution plan includes the
shared multi-strategy engine, Taurifer program families, new entry/onboarding
architecture, lifecycle/transitions, equipment contexts, and the three-job Pro
MVP. Create a focused plan only when the canonical backlog gate for that slice
is satisfied.

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

- Core training stays local-first, serverless, owned, and exportable.
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
