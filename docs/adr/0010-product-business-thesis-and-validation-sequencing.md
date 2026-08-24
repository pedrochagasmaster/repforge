# Product/business thesis and validation sequencing

**Status:** Accepted; amended August 23, 2026

**Strategic source of truth:**
[`docs/business-product-thesis.md`](../business-product-thesis.md)

**Capability detail:** [`docs/pro-backlog.md`](../pro-backlog.md)

**Measurement/commercialization plan:**
[`plans/044-posthog-measurement-experiments-paywall.md`](../../plans/044-posthog-measurement-experiments-paywall.md)

## Context

The original ADR established Taurifer as a progression-first B2C freemium
product, committed a capable Free generator, authorized Phase 1 telemetry and
an experimental paywall, and deferred native/platform hardening behind
evidence gates.

A subsequent owner grilling session materially changed the product wedge,
training architecture, Pro MVP, validation sequence, research ethics, and
commercial gate. This amendment records those decisions so the earlier fake
door, annual-only pricing, BYOP-first cohort, universal double-progression, and
"advanced controls first" assumptions are not implemented by accident.

## Decisions

### Product and user

- **Taurifer remains a progression-first strength-training system.** It owns
  program creation, execution, interpretation, and the transition to what
  comes next.
- **Generator-first acquisition is primary.** Entry hierarchy is: generate
  for me → choose a Taurifer template → bring my own program. BYOP remains a
  first-class migration/expert path, not the primary acquisition thesis.
- **The primary initial customer is a self-directed intermediate lifter** who
  wants Taurifer to create and adapt a coherent program. Ambitious beginners
  and advanced external-program users remain supported without defining the
  first cohort.
- **Initial programming scope is hypertrophy and general strength.** Taurifer
  may program squat, bench press, and deadlift within general strength but
  makes no powerlifting, meet-preparation, peaking, tapering, or attempt-
  selection claim.

### Templates and progression engine

- **Templates are Taurifer-owned program families.** Taurifer does not copy
  named programs from Boostcamp, Reddit, books, forums, or coaches. A named
  external program requires explicit permission or a compatible licence.
- **All families compile through one shared declarative engine.** Blueprints
  are versioned; program instances and interventions are versioned; no
  `if (programId === ...)` progression branches are allowed.
- **Capacity is shared evidence, not a universal prescription rule.** The
  engine dispatches through explicit range, rep-goal, anchor-plus-back-off,
  paired-exposure, block-profile, and manual strategies.
- **Supported progression mathematics are Free.** Free users may manually
  select supported strategies and basic parameters. Pro pays for intelligent
  selection, personalization, pattern detection, and adaptation.
- **Manual progression is legitimate.** An imported or authored exercise may
  declare that Taurifer should show history and preserve the prescription
  without inventing a target.

### Free and Pro

- **B2C freemium remains the primary business model.** Taurifer Pro, not coach
  SaaS, white-label deployment, or gym software, is the intended revenue
  engine.
- **The no-clawback clock still begins at commercial launch.** Prototype and
  noncommercial alpha entitlements may change; record ownership and Free
  export do not.
- **Free remains complete for the current program.** It includes a capable
  baseline generator, basic muscle emphasis, Taurifer templates, BYOP,
  complete execution, normal progression, manual strategies, substitutions,
  block review, another basic generation/template after transition, and a
  free retrospective/recommended direction.
- **Safety is never paywalled.** Pain/discomfort capture and a conservative
  stop-or-substitute path are Free.
- **The first commercial Pro product contains three complete jobs:**
  advanced first-program generation, history-aware next-program generation,
  and bounded within-block adaptation.
- **Advanced generation is an outcome with supporting controls.** It
  specializes within time, equipment, program-intent, and recovery constraints
  and explains trade-offs; it is not merely a longer questionnaire.
- **Specialization uses primary / maintenance / de-emphasized allocation
  intents.** A specializing athlete chooses one or two primary muscle groups;
  two is the v1 maximum. Other groups default to maintenance unless explicitly
  de-emphasized. These labels do not claim known volume tolerance, and direct
  set targets are not a v1 onboarding input.
- **Do not ask users to estimate volume tolerance during onboarding.** Start
  from conservative family defaults and infer response cautiously from logged
  exposure, effort, completion, session friction, structured reports, and
  checkpoint reviews. Performance alone is insufficient.
- **Incomplete programs remain evidence.** History-aware transition first
  decides resume, repair, rebase, or switch and exposes confidence; a new
  program is generated only when switching is justified.
- **Within-block changes are bounded and approved.** Taurifer detects patterns,
  asks why, proposes a cause-matched change, versions it, and evaluates it.
  It never silently rewrites the program.
- **A lapsed subscription never claws back an accepted program or change.**
  The program remains editable and executable and Free set progression
  continues; future program-level optimization and next-program generation
  stop.

### Intervention policy

- **No universal plateau-intervention ladder exists.** Validate the signal,
  interpret it through the declared strategy, diagnose the likely cause, and
  normally change one main variable. Load granularity is a conditional branch,
  not the default explanation.
- **Initial Pro issue catalogue:** repeated exercise skipping, exercise
  plateau, recurring recommendation override, recurring session overrun,
  persistent schedule mismatch/missed sessions, and unfinished-program
  transition.
- **Repeated skip trigger:** twice within the last three eligible exposures.
  Missed workouts, early terminations, substitutions, equipment problems, and
  explicit skips remain distinct events.
- **Related signals are clustered.** For example, session overruns and late
  exercise skipping may represent one issue rather than two alerts.
- **Interventions surface after the workout or at checkpoints.** Reported pain
  receives an immediate conservative path.
- **Users may accept, modify, snooze, or dismiss.** Dismissal creates a
  cooldown, not permanent suppression if evidence materially worsens.

### Validation and monetization

- **Validation before platform hardening remains constitutional.** Phase 1
  continues on the existing web core; native remains an evidence-triggered
  wrap-not-rewrite destination.
- **A noncommercial assisted-program alpha precedes Pro.** Recruit 8–12
  target lifters, provision generated/template-based programs with human
  review, and test the gym-floor execution loop for approximately six weeks.
- **The metric hierarchy is:** logging speed/reliability guardrail →
  progression trust mechanism → spreadsheet abandonment switching behavior →
  repeated workout completion/retention outcome.
- **No fake doors.** Future-feature research is limited to interviews and
  explicit external prototypes. Taurifer itself presents only working
  capabilities.
- **Payment waits for a working Pro MVP.** The three Pro jobs must work before
  the separate commercial beta accepts money.
- **The first price pair is fixed:** R$24.90/month and R$179.90/year. Do not
  run a three-annual-price experiment in the small beta.
- **Commercial beta entitlements require real lifecycle semantics:** term,
  expiry, restoration, refund handling, and purchase reconciliation. A
  timeless device-local boolean or manual code is insufficient.

### Data and telemetry

- **Local-first remains constitutional; "no backend" does not.** Core training
  works without a Taurifer server; the record remains owned and exportable;
  optional sync stays additive.
- **PostHog is authorized only after leakage paths are mechanically closed.**
  Schema-defined events are the measurement source of truth. Autocapture,
  replay, heatmaps, surveys, error capture, and related PostHog capabilities
  may support research but may not reconstruct the workout database or expose
  setup fragments, inputs, notes, names, values, URLs, console content, or
  uncontrolled `$` properties.
- **Describe analytics as pseudonymous, not anonymous.** Pilot analytics may
  default on with plain-language disclosure and a working off switch.
- **Free-text transition feedback may be shared centrally only by explicit
  per-submission consent.** It uses a purpose-specific feedback path, is not a
  normal PostHog property, is never captured by replay/autocapture/console/URL,
  is deleted within 90 days, and never solely triggers an automated
  intervention.

### Distribution and platform

- **Creators remain acquisition infrastructure, not the customer.** A
  creator-delivered program remains executable without a second consumer
  paywall; publisher attribution is provenance, never steering.
- **Wrap, not rewrite.** When native evidence gates are met, preserve the
  shared deterministic core and add native-backed capabilities through a
  Capacitor-class boundary. A greenfield rewrite requires evidence.
- **Gyms remain exploratory.** No major gym-specific build without paid-pilot
  evidence.

## Superseded assumptions

- Generator and BYOP as equally prominent acquisition paths.
- A BYOP-first external cohort.
- Powerlifting as an initial generated-program domain.
- Named classic-program reproduction or program-specific progression engines.
- Capacity/double progression as Taurifer's universal prescription policy.
- A self-reported onboarding input for volume tolerance.
- Fake-door-first Pro demand validation.
- An annual-only three-price experiment.
- Payment before a working Pro capability and complete entitlement lifecycle.
- History-informed generation and next-block intelligence as distant later
  layers rather than Pro MVP jobs.
- Pro Generator v1 as muscle priorities/preferences/volume controls only.
- A fixed plateau-escalation order.
- Raw exit-note text as a normal analytics property or session-replay input.

## Consequences

- [`docs/business-product-thesis.md`](../business-product-thesis.md),
  [`docs/pro-backlog.md`](../pro-backlog.md), and
  [`Plan 044`](../../plans/044-posthog-measurement-experiments-paywall.md)
  must express this amendment; older fake-door, price-test, cohort, and
  progression language is non-authoritative.
- The initial engine/family work and program lifecycle are prerequisites for
  both the assisted alpha and Pro MVP. They are core product infrastructure,
  not paid capabilities.
- Pro implementation must be decomposed into separately reviewable science,
  domain-model, UX, engine, intervention, and commerce plans. This ADR does not
  authorize implementing those systems from labels alone.
- `AGENTS.md` continues to govern how the repository works today. The static
  PWA architecture remains until the evidence gates justify native/platform
  work; task-specific validation infrastructure remains allowed.
- The priority labels and two-primary maximum are product constraints. The
  later allocation specification must still define maintenance floors,
  direct/indirect set accounting, and what compromise is offered when the
  athlete's time budget cannot support both primary targets.
