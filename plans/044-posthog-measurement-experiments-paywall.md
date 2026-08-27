# Plan 044: measurement, rolling alpha, staged Pro commercialization, and AI Preview

> **Executor warning:** This is a revised sequencing plan, not authorization
> to implement all phases in one change. Execute only the phase for which the
> listed dependencies and owner gates are satisfied. A fake door, future-
> looking in-product control, annual-price experiment, or manual timeless Pro
> code from the superseded plan is a STOP condition.

## Status

- **Priority:** P0 for Phase A measurement and alpha readiness; later phases
  are dependency-gated.
- **Effort:** XL across multiple successor implementation plans.
- **Risk:** HIGH — third-party analytics, sensitive free text, program science,
  adaptive behavior, and paid entitlement lifecycle.
- **Depends on:**
  [`ADR 0010`](../docs/adr/0010-product-business-thesis-and-validation-sequencing.md),
  [`ADR 0011`](../docs/adr/0011-managed-taurifer-ai.md),
  [`decision register`](../docs/product-grilling-decision-register.md),
  [`business-product-thesis.md`](../docs/business-product-thesis.md), and
  [`canonical backlog`](../docs/backlog.md).
- **Category:** measurement / product validation / monetization.
- **Revised:** 2026-08-26 after owner decision Q602 and session close.

## What changed

The previous Plan 044 combined PostHog installation, default-on replay,
fake-door Pro controls, a three-variant annual-price experiment, a local
entitlement boolean, manual codes, and a later owner-gated checkout.

That implementation sequence is superseded.

Locked replacements:

- no fake doors or planned-feature affordances inside Taurifer;
- rolling organic noncommercial program-based alpha before Pro, with normal
  onboarding and no individual program audit;
- working Pro MVP before payment;
- Pro MVP = advanced first-program generation + history-aware next-program
  generation + bounded within-block adaptation;
- fixed R$24.90 monthly / R$179.90 annual pair;
- real entitlement term, expiry, restoration, refunds, and purchase
  reconciliation before a paid beta;
- schema-defined events remain the measurement source of truth;
- free-text feedback uses a separately consented, purpose-specific path and
  never ordinary PostHog capture.
- managed Taurifer AI is after paid-beta economics, adult/PT-BR-first, and uses
  a separately governed Preview/research system; AI text never enters PostHog.

This plan now defines gates and contracts. Separate implementation plans must
specify the engine, family compiler, lifecycle, interventions, UI, PostHog
integration, feedback service, checkout, and entitlement service.

### First successor implementation sequence

The first four bounded plans are now explicit and must be executed in this
dependency order:

1. [Plan 045 — strict PostHog boundary and alpha measurement
   foundation](./045-posthog-measurement-foundation.md).
2. [Plan 046 — versioned multi-strategy progression
   engine](./046-multi-strategy-progression-engine.md).
3. [Plan 047 — Taurifer program families and deterministic
   compiler](./047-taurifer-program-families-compiler.md).
4. [Plan 048 — program entry and onboarding
   redesign](./048-program-entry-onboarding-redesign.md).

Plan 045 can establish the analytics boundary independently. Plan 046 consumes
that boundary and establishes the executable strategy contract. Plan 047 may
then author blueprints against real supported strategies. Plan 048 is last
because it must not offer a route, family, frequency, or preview that the
compiler cannot actually deliver.

---

## Product decisions — locked

1. **PostHog remains the analytics product.** Schema-defined events are the
   source of truth. Autocapture, replay, heatmaps, web analytics, feature
   flags, experiments, surveys, console/error tooling, and exception capture
   are authorized only after the leakage controls below pass.
2. **Analytics are pseudonymous, not anonymous.** Pilot telemetry may default
   on with plain-language disclosure and a working, persistent off switch.
3. **No shadow workout database.** Exact loads, repetitions, RIR, Capacity,
   bodyweight, exercise identities, notes, program payloads, setup fragments,
   and longitudinal per-set records never enter ordinary analytics.
4. **No fake doors.** Research on future capabilities occurs through
   interviews and explicit external prototypes. Every feature-looking control
   inside Taurifer represents working behavior.
5. **No payment before working value.** The commercial beta begins only after
   all three Pro MVP jobs work end-to-end.
6. **One fixed price pair.** R$24.90/month and R$179.90/year. Do not introduce
   three annual variants in the initial small cohort.
7. **Billing-agnostic capabilities.** Product code asks for capabilities, not
   vendors. Initial names are `advanced_generation`,
   `history_informed_generation`, and `within_block_adaptation`.
8. **Lapse preserves ownership.** Existing programs and accepted adaptations
   remain editable/executable; Free set progression continues; future
   program-level optimization stops.
9. **Analytical independence.** Subscription state never alters the content,
   order, wording, or confidence of deterministic Free analysis. Commerce is
   visibly separate and subordinate.
10. **Safety stays Free.** Pain/discomfort capture and conservative
    stop-or-substitute handling may never be a paywall trigger.
11. **Specialization stays bounded.** Pro v1 uses primary / maintenance /
    de-emphasized allocation intents, with at most two primary muscle groups.
    It does not ask the athlete to estimate volume tolerance or prescribe
    direct set targets during onboarding.
12. **Family/schedule policy is settled.** Principal families have genuine
    three-/five-day siblings; generated paths preserve two/six; Home is a
    limited-equipment family; Foundation is an internal simple-start profile.
13. **One-offs and multi-gym are explicit.** Free retains useful one-off and
    substitution behavior. Program-aware one-off planning and multi-gym sibling
    management may be sold only when working.
14. **Managed AI is later.** BYOK is superseded. AI work/Preview begins only
    after paid-beta economics and ADR 0011's provider, legal, privacy,
    evaluation, allowance, support, and language gates.

---

## Phase A — Measurement and alpha readiness

### Gate A0 — required product state

Before recruiting the rolling alpha:

- the initial shared multi-strategy engine and Taurifer-owned program
  families must work;
- program execution, per-set persistence, export/backup, and recovery gates
  must be reliable;
- program instances and strategy versions must be identifiable without
  exposing their contents to telemetry;
- program lifecycle must at least preserve active program, archived program,
  and training history semantics;
- the participant can report skip, override, session friction,
  pain/discomfort, and exit/transition reasons using structured values;
- prototype durability limitations and backup behavior are disclosed.
- the fast-check/model-based lifecycle suite covers onboarding, generation,
  workouts, progression, skips, stalls, overrides, interruption, abandonment,
  transition, one-offs, and relevant equipment-context changes; minimized
  failures become permanent regressions.

### PostHog implementation contract

Implement a wrapper such as `Telemetry`, not scattered SDK calls. The wrapper
must:

- fail open for product behavior when the SDK is absent, blocked, offline, or
  throws;
- expose only catalogued product events and typed/allowlisted properties;
- scrub URL fragments, setup payloads, cookies, query secrets, and arbitrary
  strings;
- reject unknown custom events and unexpected properties;
- prevent uncontrolled PostHog `$` properties from carrying text, URLs,
  element content, form values, console payloads, or network bodies;
- mask all inputs and app text in replay by default;
- allow replay text only for reviewed static chrome through an explicit
  allowlist;
- disable replay network body/header capture;
- mask autocapture element text;
- keep setup-link fragments out of `$current_url`, replay URLs, referrers,
  exception context, and console capture;
- keep analytics opt-out effective across product events, autocapture,
  replay, surveys, errors, and queued events.

The implementation must describe usage data as **pseudonymous**. Copy that
claims anonymity is a STOP condition.

### Phase A event catalogue

This is the measurement source of truth. Exact names may change only through
reviewed schema versioning.

| Event | Allowed product properties | Purpose |
|---|---|---|
| `app_boot` | `first_run`, `language`, `platform_class` | Reliability/entry |
| `program_path_selected` | `route` | `recommend` / `custom` / `browse` / `build` / `import` / `shared` |
| `generator_started` | `mode` | Baseline or working Pro only |
| `generator_completed` | closed goal/frequency/family enums | Activation; no program contents |
| `template_selected` | versioned family category | Template route |
| `program_activated` | `route`, version category | Activation |
| `first_set_logged` | — | First gym-floor action |
| `set_saved` | `vs_suggestion` | Matched/raised/lowered/no suggestion; never values |
| `recommendation_explained` | `surface` | Progression-understanding proxy |
| `recommendation_overridden` | closed reason if supplied | Trust/problem signal |
| `exercise_skipped` | closed context, no exercise id | Pattern vocabulary |
| `substitution_used` | closed reason | Constraint signal |
| `equipment_context_selected` | context count bucket, no name | Multi-gym behavior |
| `one_off_started` | closed kind/time/equipment buckets | Temporary-training demand |
| `one_off_completed` | closed kind/duration bucket | Honest off-program use |
| `session_completed` | coarse counts and duration bucket | Retention/reliability |
| `session_abandoned` | closed stage/reason | Friction |
| `session_summary_viewed` | — | Completion flow |
| `block_review_viewed` | completion bucket | Transition |
| `program_transition_selected` | `resume` / `repair` / `rebase` / `switch` | Transition behavior |
| `intervention_proposed` | issue/intervention category, confidence band | Pro beta only |
| `intervention_decided` | accept/modify/snooze/dismiss | Pro beta only |
| `intervention_reviewed` | retain/revise/revert | Pro beta only |
| `paywall_viewed` | working capability trigger | Commercial beta only |
| `checkout_started` | monthly/annual | Commercial beta only |
| `purchase_completed` | monthly/annual, reconciliation result | Commercial beta only |
| `entitlement_restored` | monthly/annual | Commercial beta only |
| `refund_recorded` | monthly/annual | Commercial beta only |
| `ai_preview_joined` | wave/version category | Phase E only; no text |
| `ai_proposal_shown` | risk/outcome category | Phase E only; no text |
| `ai_proposal_decided` | accept/edit/reject/snooze | Phase E only; no text |
| `ai_proposal_outcome` | retain/revise/reverse/more-evidence | Phase E only; no text |

Closed enums and coarse counts are reviewed against the shadow-database
boundary. Do not transmit library ids or stable exercise ids merely because
they are convenient.

### Measurement hierarchy

The rolling alpha scorecard is hierarchical:

1. **Guardrail — speed and reliability:** fast logging and no lost workouts.
2. **Mechanism — progression trust:** users understand and trust the next
   target.
3. **Switching behavior — replacement:** users stop consulting their previous
   spreadsheet/notes for progression decisions.
4. **Outcome — retention:** users repeatedly complete planned workouts.

Spreadsheet abandonment and nuanced trust require interviews/check-ins; do
not pretend telemetry alone measures them.

### Free-text feedback contract

The exit/transition flow contains structured reasons plus optional free text.
The full note remains local for product functionality.

Central sharing requires a distinct control at submission time, for example:

> **Share this note with Taurifer to improve the product**

If selected:

- send the text once to a purpose-specific feedback endpoint, not PostHog;
- record consent text/version, submission purpose, pseudonymous installation
  id, and deletion deadline;
- prohibit replay, autocapture, console, URL, exception, and analytics-event
  duplication;
- restrict access to the smallest research group;
- delete raw text after review/coding and no later than 90 days;
- retain only non-identifying coded themes afterward;
- provide a deletion path;
- never allow prose interpretation alone to trigger a program intervention.

If the purpose-specific path and controls do not exist, the text remains local.

---

## Phase B — Noncommercial rolling program-based alpha

### Recruitment and clocks

Recruit organically one person at a time through the solo founder's direct
network and social posts. Eight to twelve participants is a useful milestone,
not a synchronized cohort, selection quota, or launch gate. Taurifer does not
assume it can balance participants by maturity, goal, or schedule.

Participants self-select and use the normal onboarding, random installation
identifier, and available Recommend, Custom, or Browse path. BYOP may appear as
a secondary migration path. Each participant has an approximately six-week
clock; read each hypothesis when its relevant denominator exists. Churn,
interruption, and incomplete programs are expected evidence.

Before recruitment, review the underlying family designs, rules,
representative synthetic programs, and generated/model-based regressions. Do
not inspect, approve, badge, or repair each participant's individual program.

### Alpha boundaries

- no payment;
- no paywall;
- no public launch claim;
- no stable Free/Pro entitlement promise;
- no in-product future-feature concepts;
- no claim that the alpha validates willingness to pay.

### Alpha outputs

Across rolling evidence milestones, determine:

- whether logging is sufficiently fast and reliable;
- whether users understand and trust recommendations;
- whether Taurifer replaces spreadsheet/notes progression decisions;
- which programs and exercises are repeatedly skipped or overridden and why;
- where sessions exceed stated time budgets;
- which structured exit/intervention reasons are missing or ambiguous;
- whether the shared strategy primitives behave credibly across initial
  families;
- what unfinished-program transitions look like in real use.

The alpha supplies product evidence and history for later Pro transition
testing. It does not authorize payment.

---

## Phase C — Build and verify the Pro MVP

This phase is decomposed into successor plans. All three jobs must be complete:

1. **Advanced first-program generation** — constrained specialization with
   trade-off explanations and bounded advanced controls.
2. **History-aware next-program generation** — resume/repair/rebase/switch,
   family/profile ranking, partial-history confidence, and personalized
   program compilation.
3. **Bounded within-block adaptation** — recurring pattern detection,
   diagnosis, approved versioned intervention, and outcome reassessment.

Required Free prerequisites:

- shared multi-strategy engine;
- initial Taurifer families;
- program-instance and lifecycle semantics;
- archive/transition preserving logs;
- cross-program exercise continuity sufficient for deterministic inference;
- structured skip/override/exit data;
- safety path;
- fully editable generated programs.

Pro must use the same compiler and engine as Free. It may select and configure
supported strategies; it may not invent arbitrary formulas or create
program-specific engines.

### Pro acceptance gate

Before Phase D:

- each capability produces real, testable output;
- every recommendation distinguishes observations, user reports, and Taurifer
  inferences;
- confidence is exposed where history is partial;
- no program transition or within-block change is silently applied;
- user edits and accepted interventions are versioned;
- lapse behavior preserves programs and accepted changes;
- safety behavior is available without entitlement;
- all deterministic analysis is identical regardless of paywall placement.

---

## Phase D — Paid commercial beta

### Commerce prerequisites

The paid beta may start only when:

- Phase C passes;
- checkout supports R$24.90/month and R$179.90/year;
- entitlement has a start, term, expiry, current state, and capability set;
- purchase completion reconciles with activation;
- restoration works after reinstall/device migration within the chosen beta
  architecture;
- refunds revoke future Pro decisions without reverting programs or accepted
  adaptations;
- failed, pending, duplicate, and cancelled purchases have defined behavior;
- privacy notice, terms, cancellation, restoration, and refund copy are
  complete;
- paywall claims name only capabilities that work.

### Paywall contract

The paywall:

- opens only from an explicit request for a working Pro outcome;
- names the immediate, during-program, and transition value concretely;
- offers the fixed monthly and annual pair without a price experiment;
- never sits inside or above a deterministic recommendation;
- never conceals the Free retrospective or recommended direction;
- never implies that an existing program or training record will be lost;
- explains lapse behavior plainly.

No "coming soon," disabled fake functionality, waitlist CTA disguised as a
feature, or payment for an undefined future bundle is permitted.

### Paid-beta evidence

Measure separately:

- advanced first-program demand;
- history-aware next-program demand;
- intervention engagement during a program;
- monthly vs annual selection;
- checkout completion and reconciliation failures;
- early refunds/cancellations;
- continued training and program completion;
- whether Pro creates recurring value between program transitions.

Do not interpret founding-user support as ordinary repeatable conversion
without cohort qualification.

---

## Phase E — Managed Taurifer AI Preview (after paid-beta economics)

Phase E is blocked until Phase D demonstrates credible paid economics and a
successor AI implementation plan satisfies ADR 0011. AI is not a shortcut for
weak deterministic Pro value.

### Gate E0 — legal, provider, and product readiness

Before the first Preview request:

- Brazilian privacy counsel has reviewed purpose, consent, deletion,
  international transfer, provider contracts, and support/research access;
- Taurifer account, conversation, and research storage is EU-hosted;
- primary and backup providers pass Taurifer-specific safety/correctness gates,
  contractually retain/train on no data, and have disclosed processing regions;
- model, prompt, knowledge, rule, redaction, and provider versions are recorded
  and rollbackable;
- protected holdouts, generated/model-based cases, founder cases, and consented
  real cases pass predeclared numeric safety, privacy, program, quality,
  latency, cost, outcome, and support thresholds;
- emergency global disable, master user disable, outage fallback, stale-
  proposal handling, rollback, deletion, export, and lapse behavior pass;
- ordinary-question and program-review allowances are published from measured
  cost and representative journeys;
- English AI actions are absent; PT-BR copy and common English exercise-term
  handling pass review.

### Preview access and commercial interpretation

- Eligible adult PT-BR Pro users opt in through controlled waves. A full wave
  offers a free waiting list with no promised date; pause at founder support or
  evaluation capacity.
- AI is described as a separate Preview, not a generally available Pro purchase
  entitlement. Checkout sells only working stable Pro capabilities.
- A user who reaches a real paywall and shows purchase intent may receive
  complementary access through the next major program decision, capped at
  twelve weeks.
- Completed purchases, purchase attempts, complementary grants, waitlist,
  Preview activation, and AI use are distinct funnels. Only payment is
  conversion/revenue.
- Participants use normal onboarding. Brief checkpoint feedback and a closing
  interview are optional.

### AI analytics and research separation

PostHog receives only the allowlisted text-free AI events in Phase A. It never
receives prompts, answers, proposal text, comments, remembered items, reports,
local evidence, or research identifiers.

Required processing is explained at AI setup. Improvement sharing is invited
after a successful answer and uses:

- one global switch for future sharing;
- one-time sharing without changing that switch;
- selective retrospective sharing;
- contextual extra permission for sensitive conversations;
- a Shared conversations inventory with deletion/expiry status;
- redaction before separately credentialed research storage;
- no copy when safe redaction is uncertain;
- pseudonymous research subject ID with separate deletion mapping;
- raw research retention of at most twelve months and service/research deletion
  propagation;
- no person-level join to PostHog.

Serious support reports share raw conversation only by explicit choice. Access
is temporary/logged; status is Received/Investigating/Closed; deletion occurs
within thirty days after closure and no later than 180 days after submission.

### Preview graduation

PT-BR graduates only when the predeclared Gate E0 thresholds remain satisfied
under real waves, harmful/reverted proposals are rare and investigated,
cost/latency are stable, useful outcomes are demonstrated, and support is
manageable. Roll out progressively and retain emergency disable. English earns
an independent evaluation and release.

---

## Research without fake doors

Permitted:

- interviews;
- external clickable prototypes that state they are research artifacts;
- concept cards shown in moderated research outside the production app;
- surveys asking about problems, not pretending a solution is available.

Not permitted:

- locked controls for capabilities that do not work;
- "request access" CTAs inside product flows for nonexistent features;
- paywall exposure before a deliverable exists;
- purchase or annual-term language before entitlement lifecycle works.

---

## Hard STOP conditions

- STOP if any in-product surface represents an unimplemented capability.
- STOP if payment can succeed without deterministic purchase reconciliation,
  a real term/expiry, restoration, cancellation/refund behavior, and the
  promised capability.
- STOP if a capability gates a shared progression primitive, normal
  current-program execution, safety handling, current-block review, or Free
  transition facts.
- STOP if analytics can reconstruct set-by-set training history.
- STOP if input/replay/autocapture/console/network/URL masking is weakened to
  capture user-authored content.
- STOP if free text is placed in PostHog or transmitted without per-submission
  consent and deletion controls.
- STOP if subscription state influences deterministic analysis or its
  presentation.
- STOP if telemetry failure affects boot, logging, saving, export, or normal
  progression.
- STOP if advanced generation bypasses the two-primary specialization model,
  asks for self-estimated volume tolerance, or assumes unsupported plateau
  thresholds.
- STOP if Phase 2 platform architecture is introduced without satisfying ADR
  0010's evidence gates or receiving a separate owner decision.
- STOP if alpha operation introduces a research-only onboarding, handpicked
  program assignment, or individual participant program audit.
- STOP if BYOK, browser-direct provider keys, or Plan 038 is treated as the
  current AI implementation path.
- STOP if AI work begins before paid-beta economics or is represented as a
  generally available Pro purchase capability during limited Preview.
- STOP if provider retention/training is nonzero, AI text enters PostHog,
  research is joined to analytics at person level, redaction occurs after the
  research write, or English AI ships without independent evaluation.

---

## Verification expectations for successor plans

Every implementation plan derived from Plan 044 must include:

- schema/property allowlist tests and setup-fragment leakage tests;
- opt-out tests across all PostHog products used;
- replay/input/URL/console/network masking tests;
- zero-product-regression behavior when analytics is absent;
- program-version and intervention-diff persistence tests;
- entitlement expiry/restoration/refund/reconciliation tests;
- analytical-independence DOM and engine-output regression tests;
- lapse tests proving the program and accepted adaptations remain;
- safety tests proving pain/discomfort handling does not require Pro;
- PT-BR and English copy review;
- light/dark UI catalog regeneration for any changed surface;
- an explicit statement of which phase gate the change satisfies.
- model-based lifecycle journeys for any changed generator, one-off,
  equipment-context, intervention, entitlement, or AI proposal flow;
- for AI successors: provider/knowledge/version rollback, zero-retention,
  consent/redaction/deletion, support-retention, allowance, language, outage,
  stale-proposal, and emergency-disable tests.

Plan 044 is complete only when its successor plans and evidence gates have
carried Taurifer through the paid commercial beta. It is not a single PR.
