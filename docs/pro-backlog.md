# Taurifer Pro — capability backlog and maturity roadmap

**Status:** Living product document, reconciled through owner decision Q602 on
August 26, 2026.

**Governed by:** [`docs/business-product-thesis.md`](business-product-thesis.md)
and
[`ADR 0010`](adr/0010-product-business-thesis-and-validation-sequencing.md),
and the
[`decision register`](product-grilling-decision-register.md). On conflict, the
later owner decision in the register wins.

**Commercialization plan:**
[`Plan 044`](../plans/044-posthog-measurement-experiments-paywall.md).

The earlier version of this backlog treated fake-door demand testing as Layer
0, advanced generation as a small bundle of extra controls, and longitudinal
intelligence as a later layer. Those assumptions are superseded.

The governing distinction is now:

> **Free gives you and progresses a good program. Pro notices when the
> program no longer fits, explains why, and reshapes what happens next.**

Pro must have immediate value for a new athlete, recurring value during a
block, and transition value when a program ends or is abandoned. The first
commercial Pro product therefore contains three complete jobs rather than a
collection of locked inputs.

---

## 1. Product hierarchy and supported domain

The primary entry hierarchy is:

1. **Create a Taurifer program** — Recommend or Generate custom.
2. **Browse Taurifer programs** — a trusted, lower-input alternative.
3. **Bring or build my own** — Build manually or Import.

The initial programming domain is **hypertrophy and general strength**.
Squat, bench press, and deadlift may appear within Strength, but Taurifer does
not claim powerlifting programming, meet preparation, peaking, tapering, or
attempt selection.

Templates are original Taurifer program families, not copied or renamed
versions of programs from Boostcamp, Reddit, books, forums, or coaches. Named
external programs require explicit permission or a compatible licence; when
rights are unclear, Taurifer uses independently written blueprints, copy, and
identity.

The settled family policy is:

- principal public families have genuine three- and five-day sibling
  blueprints;
- Recommend/Custom preserve two- and six-day generated coverage without
  requiring every Browse family to expose those frequencies;
- **Home** is a distinct limited-equipment consistency family;
- **Foundation** is an internal simple-start/re-entry profile, not a public
  goal family;
- a later high-volume family is valid only when its training promise is truly
  distinct and is not an alpha prerequisite.

Final public names remain copy work. Do not revive Base 3 / Strength 3 /
Balanced 4 / Hypertrophy 4 / Volume 6 as implementation requirements.

Every family is a declarative, versioned blueprint compiled into the same
program-instance model. No engine branch may ask whether a program id equals a
particular family. Activated instances stay pinned to their version; an update
is an offered migration. Once selected, an instance is owned, editable, and
renameable while provenance remains visible.

---

## 2. Shared engine foundation — Free, not Pro

Capacity remains a shared performance signal and anchor. It is not a universal
prescription equation.

The shared engine dispatches through explicit strategies:

- range progression;
- rep-goal progression;
- anchor plus back-off;
- paired heavy/volume exposure;
- block-profile modifiers such as step loading, rep-range cycling, and volume
  progression;
- manual progression when Taurifer has no authority to invent a target.

RIR/RPE is a cross-cutting target and observation. A program's declared
strategy determines what progress means. All supported strategies and their
basic parameters are available in Free, including for manually created or
imported programs. Pro pays for selecting and adapting strategies around the
athlete, never for access to the mathematics.

Every program family uses the same lifecycle primitives: program instance,
block, day, slot, prescription, strategy, exercise identity, Capacity anchor,
and versioned intervention. Six weeks is the default block length, and initial
fixed-week programs repeat the same weekly structure. A lifecycle may schedule
review but never a deload: a whole-program deload requires performance
stagnation or degradation plus relevant corroboration.

---

## 3. Permanent Free floor at commercial launch

Free includes:

- a capable baseline generator for hypertrophy and general strength;
- basic muscle emphasis;
- the Taurifer template library;
- manual program creation, import, receipt, and editing;
- complete program execution and normal exercise-level progression;
- manual selection of supported progression strategies and basic parameters;
- prior-performance context, explanations, substitutions, history, session
  summaries, and current-block review;
- one reusable equipment context, contextual crowded-gym substitutions, and
  manual/classic/muscle-focus one-off sessions;
- manual edits, repeats, template changes, and another basic generation after
  a program ends;
- structured skip, override, exit, pain/discomfort, and constraint capture;
- manual structural program changes;
- a free transition retrospective containing observed facts, detected issues,
  confidence, and the recommended direction/family;
- free export and continued access to the athlete's record.

Safety is not subscription leverage. Pain/discomfort capture and a
conservative stop-or-substitute path remain Free. Free records individual
events and permits manual repairs; Pro detects recurring patterns and proposes
history-aware structural interventions.

All programs remain editable and executable after a subscription lapses.

---

## 4. Minimum viable Pro — three complete jobs

The first paid product must ship all three jobs below before payment is
accepted.

### 4.1 Advanced first-program generation

The defining job is:

> **Specialize a program around the athlete's priorities without violating
> available time, equipment, program intent, or recoverability — and explain
> the trade-offs.**

Advanced controls support that job; they are not the product proposition by
themselves. Pro may expose bounded controls for muscle specialization,
exercise preferences, movement constraints, split/structure preferences, and
block profile. It must remain defaults-first and place the advanced review
after a short onboarding path.

Specialization primarily reallocates a finite training budget. It adds volume
only when available time and accumulated evidence support genuine headroom.
Constraint precedence is:

1. safety and available equipment;
2. schedule and session-duration limits;
3. primary goal;
4. muscle priorities;
5. exercise and structure preferences.

Hard constraints may not be violated. Soft preferences may be compromised,
but Taurifer explains the compromise.

The v1 specialization control uses three allocation intents:

- **primary** — receive the specialization budget;
- **maintenance** — preserve the muscle's role without pursuing additional
  emphasis;
- **de-emphasized** — reduce direct allocation while preserving safety and
  the program family's structural integrity.

When specialization is requested, the athlete selects one or two primary
muscle groups; two is the v1 maximum. Other groups default to maintenance
unless deliberately de-emphasized. These labels express programming intent,
not a claim that Taurifer already knows the athlete's volume tolerance. If the
available budget cannot support the requested priorities, Taurifer asks the
athlete to narrow them or explains the bounded compromise. Pro v1 does not ask
the athlete to prescribe direct set targets.

#### Volume inference

Do not ask users to estimate a stable "volume tolerance" during onboarding.
It is a latent, context-dependent property that most athletes have not tested
while holding effort, load, frequency, exercise selection, and recovery
conditions stable.

Start from conservative, family- and experience-appropriate defaults. Infer
volume response slowly from:

- completed prescribed exposure;
- actual sets, repetitions, load, and RIR/effort;
- progression under comparable conditions;
- recurring session overruns, skips, substitutions, and recommendation
  overrides;
- pain/discomfort and recovery-related structured reports;
- short checkpoint and transition reviews.

Inference must carry confidence. It may not conclude that tolerated work was
productive, or that a poor outcome was caused by volume, from performance
alone. When learning requires a change, vary one main programming variable at
a time unless safety or a major constraint requires otherwise.

### 4.2 History-aware next-program generation

Taurifer first decides whether the athlete should **resume, repair, rebase, or
switch**. A replacement program is generated only when switching is justified.

The mechanism is:

1. interpret the available program history, including partial history;
2. combine observed facts with structured user-reported reasons;
3. distinguish those facts and reports from Taurifer's inferences;
4. rank suitable Taurifer families and bounded block profiles;
5. present one recommended option and up to two credible alternatives, with
   reasons and trade-offs;
6. personalize the accepted family into a new versioned program instance.

No minimum completed-block requirement exists. An unfinished program is data,
not discarded evidence. Confidence falls when adherence, comparability, or
history is limited. The free retrospective may name the recommended direction
or family; Pro constructs the history-personalized program. A Free user may
still manually choose any available Free template or generate another basic
program.

### 4.3 Bounded within-block adaptation

At defined checkpoints, Pro detects recurring patterns, asks what caused them,
and proposes the smallest useful structural change. The user must approve,
modify, snooze, or dismiss every proposal. Taurifer never silently rewrites the
program.

The v1 issue catalogue is:

- repeated exercise skipping;
- exercise plateau or possible stall;
- repeated recommendation override;
- recurring session overrun;
- persistent schedule mismatch or missed sessions;
- unfinished-program transition.

The engine follows:

> **Observe → interpret through the declared strategy → detect a pattern → ask
> why → propose a cause-matched intervention → obtain approval → version the
> change → observe its effect.**

There is no universal plateau-intervention ladder. Taurifer validates the
signal, routes by likely cause, and normally changes one main variable. Load
granularity is a conditional diagnosis only when equipment increments
demonstrably obstruct the prescribed progression.

Possible interventions include:

- move an exercise earlier or to another day;
- reduce upcoming set volume;
- substitute within the same program slot;
- remove and rebalance a repeatedly skipped exercise;
- use a feasible load increment or a rep-based path;
- adjust bounded strategy parameters;
- recalibrate an anchor;
- switch progression primitive;
- trigger or move a deload;
- rebase the program after interruption;
- transition to another family when the current program no longer fits.

Program identity should not change casually mid-block. Split, primary
exercise, or strategy changes are permissible only when the diagnosed issue
requires them and the user explicitly approves them.

### 4.4 Approved contextual Pro extensions

These are real Pro capabilities when implemented, not new top-level product
paths and not fake-door material:

- **Program-aware one-off planning:** for a disrupted week, choose the best use
  of today's time/equipment from active-program priorities and recent/upcoming
  work, explain what is preserved/sacrificed, and allow override. Free retains
  manual, classic, muscle-focus, and temporary user-directed adaptation.
- **Multi-gym sibling programs:** manage two or three equipment contexts,
  curate sibling exercise mappings, choose today's gym, and preserve separate
  machine histories when loads are not comparable. Compatible free-weight
  movements may share identity/history.

These extensions may ship with or after the three-job MVP. Payment may name
them only when they work end to end. They do not delay the first paid beta
unless its offer includes them.

---

## 5. Intervention mechanics

### 5.1 Event semantics

Distinguish:

- an explicitly skipped exercise;
- a missed workout;
- a workout ended early;
- a completed substitution;
- equipment unavailability.

A missed workout does not count as a skip for every exercise it contained.
Related signals are clustered into one possible issue when they may share a
cause — for example, repeated session overruns and late-session exercise
skips.

### 5.2 Initial triggers

- **Repeated skipping:** ask after an exercise is skipped twice within its
  last three eligible exposures.
- **Possible plateau:** use conservative, versioned, strategy-specific
  evidence rules; confirm adherence and comparability before proposing a
  structural intervention.
- **Repeated override:** ask after overrides recur across comparable
  exposures; an override is evidence, not noncompliance.
- **Session overrun:** compare comparable session duration with the user's
  stated time budget, then ask whether the cause was rest, setup, logging
  friction, or excessive programming.
- **Schedule mismatch:** distinguish a temporary interruption from a lasting
  availability change before rescheduling or changing family.

Thresholds are declarative and versioned. They are not one fixed number for
every exercise, and the first release does not use a predictive model.

### 5.3 Timing, approval, and reassessment

Surface patterns after a workout or at a program checkpoint; reported pain is
handled immediately. Each accepted intervention records:

- issue and supporting evidence;
- user-reported cause;
- hypothesis;
- exact program-instance diff;
- expected success signal;
- observation window;
- result: retain, revise, or revert.

Normally test one main change across subsequent eligible exposures. The user
may abort or revert. A dismissed intervention receives a cooldown but may
resurface if the evidence materially worsens.

---

## 6. Transition and exit-reason model

Capture one primary reason, optional contributing reasons, affected exercises
where relevant, and optional free text.

Structured reasons include:

- schedule or weekly frequency;
- sessions too long;
- recovery or accumulated fatigue;
- training too demanding;
- training insufficiently challenging;
- stalled or insufficient progress;
- disliked exercises;
- exercise setup or equipment access;
- pain or discomfort;
- recommendations or progression felt inappropriate;
- program complexity or confusion;
- motivation or enjoyment;
- goal change;
- illness, travel, or another external interruption;
- other.

Do not use one ambiguous "intensity" reason. Follow up "too demanding" or
"too easy" with load, repetitions, set volume, RIR/effort target, rest/density,
or overall-session burden.

Free text is supporting context and may never be the sole trigger for an
automated structural intervention. Central product-research sharing requires
separate per-submission consent, a purpose-specific feedback path, and raw-text
deletion within 90 days. It must never enter ordinary PostHog autocapture,
session replay, URLs, console logs, or general event properties.

---

## 7. Entitlement and lapse behavior

The initial capability model is:

- `advanced_generation`;
- `history_informed_generation`;
- `within_block_adaptation`.

Capabilities describe working outcomes, not future promises. A generated
program and every previously accepted adaptation remain fully executable and
editable after Pro expires. Free exercise-level progression continues. Future
program-level re-optimization and next-program generation stop until Pro is
active again.

The paid beta uses one fixed pair:

- **R$24.90/month**;
- **R$179.90/year**.

Before money is accepted, entitlement must support a real term, expiry,
restoration, refunds, and purchase-to-activation reconciliation. A local
boolean or manually issued timeless code is not sufficient for the commercial
beta.

---

## 8. Validation sequence

1. Finish the shared multi-strategy engine and initial Taurifer families.
2. Run a **noncommercial rolling program-based alpha**. Recruit organically,
   one person at a time; eight to twelve participants is an evidence milestone,
   not a synchronized cohort. Participants self-select and use normal
   onboarding. Review designs/rules/synthetic outputs before alpha; do not audit
   each participant's individual program.
3. Use the alpha to validate logging speed and reliability, progression trust,
   spreadsheet abandonment, workout completion, and the intervention
   vocabulary while history accumulates.
4. Build all three Pro MVP jobs.
5. Begin the separate paid commercial beta only when those capabilities and
   subscription lifecycle work end-to-end.

No fake doors are permitted. Future demand research uses interviews and
explicit external prototypes, never feature-looking controls inside Taurifer.

---

## 9. Later Pro territory

Legitimate later capabilities, excluded from the Pro MVP:

- full cross-program dashboards;
- multi-block planning;
- long-horizon trend and stagnation surfaces beyond the v1 intervention
  catalogue;
- optional synchronization;
- managed Taurifer AI after paid-beta economics and its independent gates;
- advanced creator or coach conveniences;
- broader periodization tools beyond bounded family profiles.

Powerlifting-specific programming remains out of scope.

### 9.1 Managed Taurifer AI — after paid beta

AI is included in Pro once stable, but it is neither a Pro-MVP launch gate nor
a separate add-on. During PT-BR Preview it is a capacity-limited research
capability, not part of the generally available purchase promise.

Approved scope:

- contextual entry in Program, Progress, checkpoints, and strong-problem
  surfaces; no Chat tab or fictional coach persona;
- concise conversation plus structured, evidence-linked, user-approved
  program proposals; major changes receive a second confirmation;
- separate task conversations, confirmed/inspectable structured memory,
  versioned proposals, staleness detection, rollback, and outcome follow-up;
- product-owned risk routing across evaluated primary/backup providers with
  zero provider retention and disclosed processing location;
- PT-BR adult Preview first; independently evaluated English later;
- ordinary-question and program-review allowances, published before Preview;
- optional generic push for major checkpoints/proposals; no active-workout
  interruption.

Privacy/research scope:

- only request-relevant local context is sent;
- AI text never enters PostHog;
- improvement data is explicitly consented, redacted before separately
  credentialed research storage, pseudonymous, deletable, and retained raw for
  at most twelve months;
- support sees raw conversation only after explicit sharing, with temporary
  logged access and a 180-day absolute cap;
- Brazilian privacy-counsel review, transfer safeguards, protected/generated
  evaluations, numeric release gates, and emergency shutdown precede Preview.

The governing detail is §16 of the thesis, ADR 0011, and Q464–Q602 in the
decision register.

---

## 10. Status summary

| Capability | Current state | Gate to advance |
|---|---|---|
| Shared program-instance schema | Required foundation | Architecture/specification |
| Multi-strategy progression engine | Required foundation | Strategy specs and tests |
| Principal 3-/5-day family siblings | Initial family backlog | Blueprint, compiler, representative and generated validation |
| Home family | Initial family backlog | Limited-equipment blueprint and schedule siblings |
| Two-/six-day generated coverage | Free generator requirement | Generator parity and tests |
| Later high-volume family | Later family backlog | Distinct job + initial-family evidence |
| Program lifecycle and transition | Free prerequisite | Persistence and UX specification |
| Advanced first-program generation | Pro MVP | Shared engine + specialization spec |
| History-aware next program | Pro MVP | Lifecycle + history interpretation |
| Bounded within-block adaptation | Pro MVP | Issue/trigger/intervention specs |
| Capability and entitlement abstraction | Commercial prerequisite | Working Pro MVP |
| Monthly/annual purchase lifecycle | Commercial prerequisite | Expiry/restore/refund/reconciliation |
| Rolling program-based alpha | Authorized before Pro | Core engine/families, telemetry, regressions, reliability |
| Paid commercial beta | Blocked | Complete Pro MVP + commerce lifecycle |
| Cross-program dashboards | Later | Multi-block evidence |
| Multi-block planning | Later | Renewal/use evidence |
| Sync | Later / Phase 2 | Platform evidence gates |
| Program-aware one-off planning | Approved Pro extension | Working Free one-off semantics + entitlement |
| Multi-gym sibling programs | Approved Pro extension | Equipment-context identity/history specification |
| Managed Taurifer AI | After paid beta | Economics + ADR 0011 legal/provider/evaluation/Preview gates |

## 11. Required specifications and measured outputs

The owner closed the product interview through Q602. The following are
implementation/evaluation outputs, not open product branches:

1. The versioned evidence thresholds and observation windows for each
   strategy-specific plateau detector.
2. The exact bounded block profiles supported by each initial family.
3. The initial specialization allocation model, including maintenance floors
   and direct/indirect set accounting.
4. The payment provider and restoration/refund mechanics for the web beta.
5. Final public/PT-BR family names and copy under the settled family policy.
6. Multi-gym movement/equipment equivalence rules and migrations.
7. AI provider bake-off result, numeric release gates, allowance counts,
   schemas, redaction implementation, and international-transfer documents.

Do not resolve these through implementation accidents.
