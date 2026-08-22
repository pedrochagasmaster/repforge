# Product/business thesis and validation sequencing

Until this decision, the repository's docs taught a strategy that had drifted
from the owner's actual intent: local-first privacy as the headline pitch,
setup links as a one-shot onboarding courtesy, an AI coach written into the
domain model as if committed, and no stated business model at all. A strategy
grilling session (product owner, 2026-08, grilled decision-by-decision across
sixteen rounds) resolved the real thesis. The full document lives at
[`docs/business-product-thesis.md`](../business-product-thesis.md) (v1.1) and
is the **strategic source of truth**; this ADR records the governing
decisions, what they superseded, and what carries forward.

## Decisions

- **Taurifer is a progression-first strength-training system.** Its core
  question is "what does what just happened mean for what I should do next?"
  It owns both program generation and program execution; externally authored
  programs remain first-class and converge on the same engine.
- **B2C freemium is the primary business model.** Taurifer Pro (advanced,
  history-informed generation; cross-program/long-horizon intelligence;
  optional sync; future history-grounded AI) is the intended revenue engine —
  not coach SaaS, not white-label deployments, not gym software.
- **Brazil-first validation, globally available product.** PT-BR is
  primary-market copy, Android is a first-class target, and pricing anchors on
  the local market (R$179.90/year base hypothesis).
- **Creators are acquisition infrastructure, not the customer.** The loop:
  creator distributes a program → athlete activates free → athlete retains →
  some convert to Pro. One Taurifer, many publishers; no white-label forks.
  Publisher attribution is text-first provenance (name, handle, description
  in the fragment payload), never steering. A creator-delivered program is
  executable without a second consumer paywall.
- **The no-clawback clock starts at the commercial-launch boundary.** The
  permanent Free floor is established when Taurifer publicly launches its
  production Free/Pro offering as a stable product contract. Today's GitHub
  Pages PWA is a pre-commercial prototype and does not define that floor.
  User ownership of records and free export are protected regardless of
  launch status. Pilot pricing experiments must be labeled as such and do not
  start the clock — but effectively launching to the public while calling it
  a beta does not dodge the constitution.
- **A capable baseline program generator launches Free.** The Free/Pro
  generation boundary is capability-based (baseline inputs free; deep
  personalization and history-informed generation are Pro), never artificial
  scarcity. The former "generation requires Pro" experiment variant is
  removed; the open experiment is where the baseline/advanced line sits.
- **Analytical independence is constitutional.** Deterministic training
  outputs derive exclusively from the athlete's program, training record, and
  declared training rules. No commercial interest — Pro conversion, creator
  economics, marketplace, advertising, partners — may alter those outputs or
  their presentation. Taurifer may monetize capabilities around the engine,
  never control over its conclusions. Commerce appears only as clearly
  separate, subordinate choices.
- **Local-first is constitutional; "no backend" is not.** Core training works
  serverless; the record stays owned and exportable; cloud sync stays
  optional. Telemetry is permitted — intentional, schema-driven, pseudonymous
  where useful — but analytics must never reconstruct the workout database.
- **Validation before platform hardening.** Phase 1 validates the market and
  business model on the existing web core; the PWA is the primary validation
  product, not a preview channel. Native Android/iOS is the intended
  commercial destination, entered on evidence triggers (retention that makes
  durability a real responsibility, credible Pro purchase intent, measured
  install friction, native-capability constraints, store discovery).
- **Wrap, not rewrite.** When native is justified, evolve this repository
  with a Capacitor-class shell around the shared, tested training core
  (progressive native enhancement). A greenfield rewrite requires evidence
  this architecture cannot meet product requirements. Capacitor is the
  preferred eventual architecture, not an authorized Phase 1 task.
- **Gyms stay exploratory.** No major gym-specific build without paid-pilot
  evidence. Taurifer runs training; it does not run the gym.

## Superseded assumptions

- Privacy/local-only as the market positioning headline (privacy supports
  trust; it is not the pitch, and "Taurifer never uploads your training
  data" softens to "your training record is yours; Taurifer works
  local-first; cloud sync is optional" once optional services exist).
- Coach-client SaaS, per-coach white-label deployments, and coach-paid
  monetization as the business model.
- Native apps as a Phase 1 prerequisite for validation.
- The AI coach (plan 038, ADR 0002) as a live roadmap item — it remains a
  brainstorming artifact, unimplemented and uncommitted; any future AI layer
  is a Pro capability subordinate to the deterministic product.
- Reading "anything already shipped free stays free" as binding the
  pre-commercial prototype (it bound rule 17 of the draft constitution into
  contradiction; the launch clock resolves it).

## Carry-forward ledger

Earlier session decisions survive with changed priority; they should not be
rediscovered from scratch or silently dropped.

Still strategically active: publisher attribution fields in shared-program
payloads (`v1.` envelope carries optional fields; `v2.` is immutable; mint
`v3.` only under size pressure); the reviewed, non-destructive
program-replacement flow so a setup link can be applied to an existing
install (archive the old program, never touch logs); the shared-arrival
first-run gate recomposed around the creator/program handoff; block-end
publisher attribution as subordinate provenance; telemetry and funnel
instrumentation.

Still valid but demoted: share-with-coach surfaces (windowed plain-text +
CSV export of per-session logs); other coach conveniences.

Speculative / not part of the current thesis: a full coach workspace or
multi-client CRM, ongoing coach proposals/monitoring, in-app coach-client
messaging, gym-specific infrastructure, marketplace commerce.

## Consequences

`docs/business-product-thesis.md` governs why Taurifer is being built and
what strategic direction is authorized; `AGENTS.md` continues to govern how
this repository works today (static PWA, no build step, service-worker
discipline) and stays that way through Phase 1 — rewriting it now would
violate validation-before-hardening. The quantitative figures in the thesis
(price points, conversion/renewal/retention targets, SAM ranges) are
management hypotheses and decision thresholds to test, never product
requirements or validated facts — see its fact-vs-assumption ledger.
`CONTEXT.md` marks the coach-era domain terms as speculative and gains the
now-core strategy terms. Browser-backed persistence for Phase 1 pilot users
is an accepted, mitigated risk; if durability becomes a real user problem,
that is evidence for Phase 2, not for a PWA infrastructure project.
