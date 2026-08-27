# Taurifer Business & Product Thesis

**Version:** 1.3

**Date:** August 26, 2026

**Status:** Strategic source of truth. v1.3 incorporates the completed owner
grilling session through Q602, recorded in the
[decision register](product-grilling-decision-register.md) and governed by
[ADR 0010](adr/0010-product-business-thesis-and-validation-sequencing.md).

**Primary beachhead:** Brazil

**Business model:** B2C freemium subscription, with creator-led B2B2C distribution

**Core category:** Progression-first strength-training software

**v1.2 amendments (see ADR 0010 for rationale):** generator-first acquisition becomes primary, followed by Taurifer-owned templates and BYOP as a migration/expert path; initial programming scope is hypertrophy and general strength rather than powerlifting; original versioned program families compile through one shared multi-strategy engine; Capacity becomes shared evidence rather than a universal prescription rule; supported progression primitives remain Free; Pro MVP becomes advanced first-program generation, history-aware next-program generation, and bounded within-block adaptation; incomplete programs remain usable evidence; a noncommercial program-based alpha precedes Pro; payment waits for working value and a real entitlement lifecycle; fake doors are prohibited; the first price pair is fixed at R$24.90/month and R$179.90/year; optional free-text research sharing receives a separate consented path rather than ordinary analytics.

**v1.3 amendments:** principal program families receive genuine three- and
five-day siblings while generated coverage preserves two- and six-day users;
Home becomes a separate consistency-first limited-equipment family and
Foundation an internal simple-start profile; selected programs are fully owned
and editable; multi-gym sibling instances preserve equipment-specific history;
one-off sessions become an explicit execution mode; the rolling organic alpha
and paid-beta evidence rules are finalized; and the old BYOK coach is replaced
by a managed, adult-only, PT-BR-first Taurifer AI design sequenced after paid-
beta economics, with product-owned providers, explicit proposals, inspectable
evidence, strict research separation, and no transcript data in PostHog.

---

## Executive summary

Taurifer should be built and launched as a **progression-first strength-training system for people who want to train from a structured program and progressively improve their performance over time**.

The company should own the complete programming lifecycle:

1. **Program creation:** Taurifer can build a structured program around the athlete's goals, experience, schedule, equipment, preferences, and constraints.
2. **Program execution and progression:** Taurifer interprets actual performance through the program's declared strategy and clarifies what to do next.
3. **Program adaptation and transition:** Taurifer notices recurring mismatch, helps repair the current block, and uses complete or partial history to decide what should follow it.

The strategic proposition is therefore broader than "bring your own program" and narrower than "AI personal trainer":

> **Give me the right program—and make every session tell me what comes next.**

The product's behavioral loop is:

> **Generate or choose → execute → observe → interpret → adapt → transition → repeat.**

Taurifer's daily value should come from deterministic training logic, not from a chatbot. The athlete logs what actually happened—load, reps, effort/RIR, substitutions, session context—and Taurifer turns that into clear next targets while preserving the structure and intent of the active program.

The initial business should be **B2C freemium**. The primary intended revenue engine is **Taurifer Pro**, not coach SaaS, gym-management software, or white-label deployments.

The free product should remain genuinely useful and complete:

> **Free gets you training and keeps you progressing. Pro personalizes the bigger picture.**

(Internal framing, not final marketing copy.)

Everything needed to execute the current program—from creation/import/receipt through logging, progression guidance, substitutions, history relevant to that program, and end-of-block review—is part of the permanent free floor from commercial launch onward. The launched Free floor also includes a **capable baseline program generator** (§8.2–§8.3): the Free product must be able to take somebody from "I want to start training properly" to "here is my structured program; let's train" without payment.

Taurifer Pro should provide immediate, recurring, and transition value beyond the normal current-program loop:

> **Pro can build a program around you—and understand your training across programs, time, and devices.**

The first commercial Pro product includes:

- advanced first-program generation that specializes within time, equipment, goal, and recovery constraints;
- history-aware next-program generation, including resume/repair/rebase/switch decisions from incomplete programs;
- bounded within-block adaptation for recurring skip, plateau, override, session-length, and schedule problems.

Later Pro may add full cross-program dashboards, multi-block planning, optional
synchronization, and managed Taurifer AI. AI has a complete product/privacy
constitution in §16 but remains sequenced after the deterministic paid beta;
it is not part of the minimum paid product.

Taurifer initially programs **hypertrophy and general strength**. It may include squat, bench press, and deadlift inside Strength, but it does not claim powerlifting, peaking, tapering, meet preparation, or attempt selection.

The entry hierarchy is:

1. generate a program;
2. choose an original Taurifer template;
3. bring an existing program as a migration/expert path.

Templates are Taurifer-owned, versioned blueprints rather than copied named classics. Every generated, template, manual, imported, or shared program converges on the same progression and execution engine when it declares the required semantics.

The no-clawback rule is constitutional, and it binds from the commercial-launch boundary:

> **From commercial launch onward, anything Taurifer releases as part of Free remains part of the free floor. Pro evolves by addition, never by subtraction from that floor.**

The no-clawback floor becomes binding when Taurifer publicly launches its production Free/Pro offering and represents those capabilities to users as the stable product contract. Pre-commercial prototypes, betas, development builds, and preview deployments—including today's GitHub Pages PWA—do not define the permanent free floor. User ownership of existing records and free export are protected regardless of launch status (§15.2).

Three sequencing principles are also constitutional (§22, §29):

> **Validation before platform hardening.** Native Android/iOS is the intended commercial destination, not a prerequisite for proving product-market fit. Phase 1 validates the market and business model on the existing web core.

> **Analytical independence.** Taurifer's deterministic training outputs are never altered by commercial interests (§16.3, §29).

> **Working value before payment.** A rolling noncommercial program-based alpha may begin once the core engine and initial families work; the paid beta waits until the complete Pro MVP and entitlement lifecycle work. Taurifer does not use fake doors.

Raw data ownership is also constitutional:

- manual export stays free;
- core training works without a Taurifer backend;
- local-first remains the default architecture;
- optional cloud synchronization may be a paid convenience;
- telemetry may exist, but must be intentional and schema-driven rather than an accidental shadow copy of the workout database.

The initial market should be **Brazil-first in learning, global in product availability**.

Brazil is attractive because:

- it has a very large strength-training population;
- Portuguese is materially important to adoption;
- English proficiency remains relatively low nationally;
- Android is the dominant mobile platform;
- locally rational pricing can undercut international premium products;
- creator/coach distribution through Instagram, WhatsApp, Hotmart/Kiwify, and similar channels provides a potentially low-CAC acquisition wedge.

However, Brazil is **not uncontested**. Hevy, Gravl, and Alpha Progression already support Portuguese, and Hevy now offers personalized program generation. Taurifer therefore cannot win merely by translating a foreign category.

The Brazilian wedge must instead be:

> **A Portuguese-first progression product with excellent local product copy, locally rational pricing, strong program generation, unusually good support for externally authored programs, transparent progression logic, and best-in-class execution.**

The primary competitive set is:

- **Hevy** — dominant polished logger/social product, now expanding into personalized program generation;
- **Gravl** — Portuguese-localized program generation and automatic progressive overload at a strong Brazilian price point;
- **Alpha Progression** — sophisticated program generation, per-set progression recommendations, analytics, and periodization, now localized to Portuguese at a premium price;
- **MacroFactor Workouts** — sophisticated generated/custom programming, RIR-aware Smart Progression, periodization, and deep training tooling, priced in USD and not currently a Portuguese-first Brazilian product.

Taurifer should not pretend that any one feature is a moat. Program generation can be copied. Progression equations can be copied. Local-first can be copied. Shared links can be copied.

The near-term competitive strategy is:

> **Win through focus, product quality, local execution, transparent training logic, and cheaper distribution.**

The longer-term defensibility thesis is the combination of:

- accumulated longitudinal training history;
- trusted interpretation of that history;
- program continuity across blocks;
- switching familiarity and user habit;
- externally distributed Taurifer programs;
- creator relationships;
- a portable Taurifer program format;
- eventually, a norm where someone can say: **"Send me the Taurifer version."**

The creator strategy remains important, but principally as **growth infrastructure**, not the primary business model.

A creator should be able to publish or share a program into Taurifer with minimal friction. Their buyer should be able to run the purchased program without encountering a second paywall. Taurifer acquires the athlete; some athletes remain after the original program ends and later become Taurifer Pro subscribers.

This creates a potential acquisition flywheel:

> **Creator program → Taurifer activation → repeated training → post-program retention → Taurifer Pro conversion.**

Gym chains should remain an exploratory enterprise hypothesis, not the initial business. The regional-gym idea has clearer B2B buyers but introduces substantial product and organizational complexity: integrations, instructor workflows, permissions, shared records, second-app friction, incumbent gym-management software, and enterprise support. Taurifer should build nothing substantial for gyms without strong paid-pilot evidence.

The quantitative thesis should be evaluated with explicit assumptions rather than false precision.

A reasonable current market-sizing frame is:

- **Broad Brazilian gym/strength population:** approximately **10–19 million** people, depending on definition and data source.
- **Behavioral SAM assumption:** approximately **20–35%** of that population may fit Taurifer's structured, progression-oriented behavior over time.
- **Initial SAM hypothesis:** roughly **2.0–6.5 million users**.
- **Initial Pro price pair:** **R$24.90/month** and **R$179.90/year**.
- **Illustrative 50k paid subscribers:** approximately **R$9.0M gross ARR**.
- **Illustrative 100k paid subscribers:** approximately **R$18.0M gross ARR**.
- At a 15% app-store commission and an illustrative R$10/year variable service reserve, a R$179.90 annual subscription yields roughly **R$142.92 annual contribution** before taxes, refunds, fixed payroll, and marketing.
- At 40%, 50%, and 60% annual renewal, simple steady-state contribution LTVs are approximately **R$238, R$286, and R$357**, respectively.
- A 3× LTV:CAC discipline would therefore imply maximum paid-subscriber CAC of approximately **R$79, R$95, and R$119**, respectively.

These are management-model assumptions, not forecasts.

The launch should validate six core hypotheses:

1. **Acquisition:** the right Brazilian lifter can be acquired economically.
2. **Activation:** users reach a meaningful program and complete a first session quickly.
3. **Retention:** Taurifer's progression/execution loop is sticky.
4. **Program creation:** owning smart program generation materially improves activation and/or paid conversion.
5. **Monetization:** users will pay for constrained advanced generation,
   bounded within-program adaptation, and history-aware transition.
6. **Creator distribution:** externally authored programs produce lower effective CAC and meaningful post-program retention.

If those hypotheses validate, Taurifer can become a meaningful Brazilian consumer subscription company before international expansion is required.

---

# 1. Strategic thesis

## 1.1 What Taurifer is

Taurifer is a **progression-first strength-training system**.

It is not merely:

- a workout notebook;
- a program generator;
- an AI trainer;
- a social fitness network;
- a coach CRM;
- a gym-management platform;
- a marketplace.

Its core responsibility is to connect **programming intent** with **actual performance**.

A program says what should be trained.

A workout log says what happened.

Taurifer's differentiation should live in the layer between those two:

> **What does what just happened mean for what I should do next?**

That is the product's most important question.

The current Taurifer codebase already contains much of the conceptual foundation required for this position:

- structured multi-day programs;
- load, reps, and RIR logging;
- rest timing;
- previous-session context;
- substitutions;
- warmup/working-set distinctions;
- personal records;
- block/mesocycle concepts;
- capacity-based progression logic;
- local-first persistence;
- portable program setup links;
- English and Portuguese support;
- data export;
- an intentionally quiet, non-gamified brand voice.

Internal product sources:

- [Taurifer README](https://github.com/pedrochagasmaster/repforge/blob/main/README.md)
- [Taurifer domain context](https://github.com/pedrochagasmaster/repforge/blob/main/CONTEXT.md)
- [Taurifer brand guide](https://github.com/pedrochagasmaster/repforge/blob/main/docs/brand-guide.md)
- [Implementation-plan index](https://github.com/pedrochagasmaster/repforge/blob/main/plans/README.md)

## 1.2 Four jobs in three entry groups

Taurifer should explicitly own four authorship jobs within three deliberately
weighted groups.

### Group A — "Create a Taurifer program"

The athlete knows they want to train seriously but does not have a complete program they trust.

Taurifer asks for relevant inputs such as:

- primary goal;
- training experience;
- days available per week;
- approximate session duration;
- equipment access;
- movement exclusions;
- preferred exercises;
- disliked exercises;
- muscle-group priorities;
- injury/constraint information where appropriate and safely handled;
- training structure preference, if any.

The UI offers two choices:

- **Recommend a program:** Taurifer makes the consequential choices from the
  minimum inputs that change the result.
- **Generate a custom program:** the user makes bounded program-specific
  choices such as split and optional exercise preferences; Taurifer still
  authors the executable prescription.

Taurifer then produces a structured, editable draft.

The key design principle is:

> **Generation creates a proposal, not a prison.**

The user should be able to inspect and edit the generated program.

Taurifer should not require the user to surrender agency in order to benefit from progression intelligence.

### Group B — "Browse Taurifer programs"

The athlete wants a trusted structure without completing a detailed generator.
They choose from a small set of original, versioned Taurifer families covering
distinct schedules and jobs.

These are not copied implementations of named programs from Boostcamp,
Reddit, books, forums, or coaches. Familiar programming archetypes may inform
the product, but Taurifer owns the blueprint, progression semantics, copy, and
identity. A named external program requires explicit permission or a clearly
compatible licence.

### Group C — "Bring or build my own"

The athlete already has a program from:

- themselves;
- a coach;
- an online creator;
- a PDF;
- a spreadsheet;
- a book;
- a community program;
- another app.

The two distinct jobs are:

- **Build a program:** name the program, create empty training days, and author
  exercises, order, sets, targets, and a supported progression strategy.
- **Import a program:** preserve an externally authored prescription and map it
  into supported Taurifer semantics.

They may also:

- accept a shared Taurifer setup;
- eventually migrate it from another platform.

Once activated, the same execution/progression engine applies.

### Why all groups matter

Owning all three paths increases the addressable market, but they are not
equally important for acquisition.

A "bring your own program" product primarily targets users already sophisticated enough to arrive with programming.

A generation-only product primarily targets users willing to delegate programming.

The primary market proposition is generator-first. Browse reduces decision and
onboarding burden. Build/Import remains first-class migration infrastructure
and expert control. The authorship test is decisive: choosing preferences—even
a split—is Custom; manually selecting the executable prescription is Build.

Taurifer can still say:

> **If you need a program, Taurifer can build one. If you already trust a program, Taurifer respects it.**

This is strategically important because users can move between the modes over their training careers.

A beginner may begin with a generated program.

An intermediate user may later customize it.

An advanced user may eventually import a coach's program.

Taurifer should remain useful through that progression rather than forcing the user into a single philosophy.

---

# 2. Core user and persona

## 2.1 Behavioral ICP

The strongest primary user definition is behavioral rather than demographic:

> **A self-directed intermediate lifter who wants Taurifer to create and adapt
> a coherent hypertrophy or general-strength program, and cares whether actual
> performance changes what happens next.**

This is better than simply saying "intermediate lifter."

This is the initial acquisition profile, not an exclusion rule. The product may
also serve:

- an ambitious beginner;
- a recreational bodybuilder;
- a serious hypertrophy trainee;
- a self-programming intermediate;
- a person following an online coach;
- a purchaser of a creator's program;
- a strength-focused general gym user.

What matters is that training is **programmatic**, not random. Advanced
lifters and power users should influence architecture without forcing the
acquisition experience to look like a program-design tool.

Their mental model is:

> "I want a real training plan. I want to know what I am doing today. I want to know whether I am improving. I want the next session to reflect what I actually did."

## 2.2 Primary aspiration

The primary user is not necessarily an expert.

They are someone trying to train **seriously and progressively**.

This distinction matters for onboarding.

Taurifer should not require the user to already understand:

- RIR;
- volume landmarks;
- periodization;
- progression methods;
- exercise taxonomy;
- deload logic.

But it should support those concepts deeply once the user is ready.

The product therefore needs progressive disclosure:

- simple language at the surface;
- sophisticated mechanics underneath;
- deeper controls for users who want them.

## 2.3 Core jobs to be done

### Functional jobs

1. **Give me a good program if I do not already have one.**
2. **Let me use a program I already trust.**
3. **Tell me exactly what I should attempt today.**
4. **Make logging fast enough that it does not interfere with training.**
5. **Remember what I did last time.**
6. **Interpret my actual performance rather than blindly following a static spreadsheet.**
7. **Tell me what to target next.**
8. **Help me adapt when the gym is messy—equipment busy, exercise substituted, session shortened.**
9. **Show me whether the current block worked.**
10. **Over time, help me understand my training career rather than isolated workouts.**

### Emotional jobs

1. Reduce uncertainty.
2. Reduce the cognitive burden of remembering loads and progression.
3. Build trust in the next target.
4. Preserve the athlete's sense of control.
5. Make serious training feel calm rather than gamified or performative.

### Social/status jobs

Taurifer should not be designed around social validation.

The user does not need:

- streak flames;
- leaderboards;
- public PR celebration;
- follower counts;
- achievement badges.

The status value is internal:

> **I train with intention, and I can see that it is working.**

---

# 3. Positioning

## 3.1 Category

Recommended category:

> **Progression-first strength-training app**

Alternative descriptive category:

> **Strength-training program and progression system**

Avoid making the category:

- AI fitness coach;
- workout tracker;
- gym social network;
- personal trainer app;
- hypertrophy calculator.

Those labels either undersell Taurifer or put it into a category where its differentiation disappears.

## 3.2 Core proposition

The strongest simple proposition remains:

> **Follow your program. Know what to do next.**

Once Taurifer owns program creation, an expanded strategic proposition becomes:

> **Get the right program. Know what to do next.**

A more complete explanatory proposition:

> **Taurifer builds or runs your strength program, tracks what you actually do, and turns each session into clear targets for the next one.**

## 3.3 Product belief

The product thesis:

> **A training log should not merely remember what you did. It should make the next session clearer.**

## 3.4 Brand belief

The existing Taurifer ethos remains valuable:

> Strength is built gradually, challenge after challenge, day after day.

The Milo of Croton narrative is a strong symbolic backbone for progressive overload.

However:

> **The ethos should make the product memorable; it should not be responsible for explaining what the product does.**

The brand guide's "quiet training partner" posture is strategically coherent:

- record;
- compute;
- suggest;
- do not celebrate;
- do not motivate;
- do not entertain;
- do not gamify.

The marketing layer must remain more concrete than the brand mythology.

## 3.5 What Taurifer should not claim

Avoid claims such as:

- "the only smart training app in Portuguese";
- "the only progressive-overload app in Brazil";
- "AI that automatically builds the perfect workout";
- "science proves this is the optimal program";
- "the definitive strength app."

Competitors already occupy much of the functional territory.

The differentiation must come from the **whole system**.

---

# 4. Why Brazil first

## 4.1 Brazil is the learning beachhead, not the permanent geographic ceiling

Recommended posture:

> **Global product; Brazil-first validation.**

The native app can be available internationally from launch.

However, Brazil should be the first high-touch market for:

- user research;
- copy iteration;
- creator acquisition;
- pricing experiments;
- onboarding experiments;
- direct support;
- retention studies.

## 4.2 Population

IBGE estimates Brazil's 2025 population at **213,421,037**.

Source: [IBGE — Brazilian population estimate](https://www.ibge.gov.br/a-populacao-brasileira)

This gives Taurifer one of the world's largest single-country consumer markets.

## 4.3 Language is a real barrier, but not a moat by itself

The 2025 EF English Proficiency Index ranks Brazil **75th of 123 countries/regions**, with a score of **482**, categorized as low proficiency.

Source: [EF English Proficiency Index — Brazil](https://www.ef.com/saen/epi/regions/latin-america/brazil/)

This supports the thesis that an English-first sophisticated training app excludes a meaningful segment of Brazilian consumers.

However, language alone is no longer defensible:

- Hevy supports Portuguese;
- Gravl supports Portuguese;
- Alpha Progression supports Portuguese.

Therefore the localization wedge must be broader:

- PT-BR written as primary-market copy;
- Brazilian exercise terminology;
- Brazilian equipment conventions;
- locally rational subscription price;
- Brazilian support/community touchpoints;
- creator distribution through channels Brazilians already use;
- native treatment of kg and common Brazilian gym increments;
- product decisions made with Brazilian users rather than merely translated after the fact.

## 4.4 Android matters

Statcounter reported approximately **77.6% Android** and **22.4% iOS** mobile OS share in Brazil in July 2026.

Source: [Statcounter — Mobile OS market share, Brazil](https://gs.statcounter.com/os-market-share/mobile/brazil)

Implication:

> **Android cannot be treated as a secondary implementation target in Brazil.**

When native commercialization begins (Phase 2, §22), native launch quality should be first-class on:

- Android;
- iOS.

Historically, PWA installation work may have over-indexed on iOS handoff complexity. That work remains useful, but a Brazil-first strategy must put Android on equal or greater operational footing—during Phase 1 this means the Android-browser experience, and at Phase 2 the native app.

---

# 5. Market landscape

## 5.1 The market is validated

Taurifer does not need to prove that people pay for serious strength-training software.

The category already contains meaningful paid products:

- Hevy;
- Alpha Progression;
- Gravl;
- MacroFactor Workouts;
- other workout loggers and generated-program apps.

The strategic challenge is not category creation.

It is:

> **Finding a sufficiently differentiated product position and acquiring the right users at an economically attractive CAC.**

## 5.2 Hevy

Hevy says it is used by **15+ million athletes** and reports more than 545,000 ratings across app stores.

Source: [Hevy](https://www.hevyapp.com/)

Hevy's historical strengths:

- fast logging;
- polished UX;
- routines;
- progress analytics;
- social/community;
- large exercise library;
- Apple Watch;
- desktop/web;
- offline workout support.

Brazilian App Store pricing currently includes:

- **R$12.90/month** on one monthly tier;
- **R$99.90/year**;
- **R$429.90 lifetime**.

Source: [Hevy — Brazil App Store](https://apps.apple.com/br/app/hevy-treino-de-academia-gym/id1458862350)

Hevy also now markets a personalized program generator ("Trainer") that accounts for experience, goals, training frequency, workout length, equipment, and more.

Source: [Hevy — Personalized Program App](https://www.hevyapp.com/use-cases/personalized-program-app/)

Hevy also supports external sharing of routines/folders through links that non-users can open on hevy.com and save.

Source: [Hevy — Share Folders & Workout Routines](https://www.hevyapp.com/features/share-folders-routines/)

**Implication:** Taurifer cannot differentiate on logging, routine sharing, Portuguese localization, or program generation alone.

## 5.3 Gravl

Gravl is a particularly relevant Brazilian competitive anchor because its App Store listing is already localized in Portuguese and explicitly positions around:

- plan generation;
- automatic progressive overload;
- telling users what weight to lift next;
- 1RM-informed progression;
- equipment-aware recommendations;
- exercise videos;
- Apple Watch;
- integration with Health/Garmin/Strava.

Brazilian App Store pricing includes:

- **R$34.90/month**;
- **R$179.90/year**;
- some lower promotional/alternative annual SKUs.

Source: [Gravl — Brazil App Store](https://apps.apple.com/br/app/gravl-personal-trainer-com-ia/id6450921637)

**Implication:** R$179.90/year is a real, market-observed Brazilian price anchor for a premium smart strength-training product.

## 5.4 Alpha Progression

Alpha Progression's Brazilian listing now presents:

- science-based program generation;
- exact weight/repetition targets per set;
- RIR logging;
- exercise videos;
- strength/volume analytics;
- periodization;
- deloads;
- plan sharing;
- CSV export.

Brazilian pricing currently includes:

- **R$59.90/month**;
- **R$399.90/year**.

Source: [Alpha Progression — Brazil App Store](https://apps.apple.com/br/app/muscula%C3%A7%C3%A3o-alpha-progression/id1462277793)

**Implication:** Alpha establishes a very high premium anchor in Brazil. Taurifer does not need to price near R$400 to be perceived as serious.

## 5.5 MacroFactor Workouts

MacroFactor Workouts is strategically important because it undermines a simplistic "bring your own program + smart progression" differentiation.

MacroFactor Workouts currently charges:

- **US$11.99/month**;
- **US$47.99/half-year**;
- **US$71.99/year**.

Source: [MacroFactor — Subscription pricing](https://help.macrofactorapp.com/en/articles/393-how-macrofactor-subscriptions-and-bundles-work)

Its Smart Progression:

- adjusts weights/reps based on performance;
- uses RIR targets and rep ranges;
- works on generated programs;
- also works on programs built from scratch.

Sources:

- [Understanding Smart Progressions](https://help.macrofactorapp.com/en/articles/305-understanding-and-using-smart-progressions)
- [Smart Progression with customized programs](https://help.macrofactorapp.com/en/articles/387-will-smart-progression-work-with-altered-or-customized-programs)

Its Smart Generation uses:

- primary goal;
- experience;
- schedule;
- session duration;
- available equipment;
- exercise exclusions;
- structure/focus choices.

Source: [MacroFactor — Smart Generation inputs](https://help.macrofactorapp.com/en/articles/370-what-information-does-macrofactor-workouts-use-to-generate-my-program)

MacroFactor also supports detailed custom periodization across cycles.

Source: [MacroFactor — Periodization](https://help.macrofactorapp.com/en/articles/389-how-can-i-customize-periodization-rir-reps-and-sets-for-the-exercises-in-my-program)

**Implication:** Taurifer must win on the whole product—local fit, clarity, execution, price, distribution, transparency—not on the mere existence of progression intelligence.

---

# 6. Competitive positioning

## 6.1 Positioning map

A useful conceptual map has two axes:

### Axis 1 — Who owns the program?

- athlete/coach/external source;
- app-generated/prescriptive.

### Axis 2 — How intelligent is execution?

- mostly logging/history;
- progression-aware/adaptive.

Taurifer should occupy:

> **High execution intelligence + flexible program ownership**

while also offering first-party program generation.

This is intentionally hybrid.

The program can come from Taurifer, but Taurifer does not require that.

## 6.2 Why this hybrid matters

The strategic promise is not:

> "We will always know better than your coach."

It is:

> **"Taurifer can give you a strong program when you need one, but its execution intelligence remains useful even when the program comes from somewhere else."**

This creates durable product utility across changes in programming source.

## 6.3 Where Taurifer should beat competitors

Taurifer should aim to be meaningfully better in:

1. **Progression clarity**  
   The user should know what to attempt and why.

2. **Program portability**  
   Programs should move into Taurifer with low friction.

3. **Externally authored program support**  
   A creator/coach program should feel first-class, not imported second-class data.

4. **PT-BR product quality**  
   Native language quality, not translation residue.

5. **Real-world session execution**  
   Substitutions, interruptions, shortened sessions, equipment constraints.

6. **Data ownership**  
   Exportability and local-first use without turning privacy into the headline.

7. **Calm product design**  
   No social feed or gamification pressure.

8. **Price/value in Brazil**  
   Premium enough to signal quality, materially more accessible than Alpha.

---

# 7. Product architecture and strategic capabilities

## 7.1 The execution loop

The canonical loop should be:

1. select/start current training day;
2. see clear exercise/set target;
3. log actual performance;
4. rest;
5. receive contextual next-set/next-session guidance;
6. adapt if needed;
7. finish session;
8. receive session summary;
9. continue program;
10. complete block;
11. receive block review;
12. decide/prepare next block.

## 7.2 Progression should be deterministic first

Taurifer's everyday recommendation engine should not require a conversation.

Its differentiating logic should remain deterministic and inspectable.

The internal concept of **Capacity** is strategically useful: the app can interpret performance using load, performed reps, and trusted RIR rather than treating a rep-range threshold as the entire training model.

Capacity is a shared measurement signal and anchor, not the one prescription
equation. The engine must dispatch through explicit strategies, initially:

- range progression;
- rep-goal progression;
- anchor plus back-off;
- paired heavy/volume exposures;
- versioned block-profile modifiers;
- manual progression when Taurifer lacks authority to invent a target.

All supported strategies and their basic parameters belong to the shared Free
engine. Pro may choose and adapt them around the athlete; subscription state
may not determine whether the mathematics exists.

The user should be able to answer:

> "Why did Taurifer give me this target?"

with a concise deterministic explanation.

AI can later help synthesize long-horizon patterns, but should not be necessary for normal progression.

## 7.3 Program generation

Program generation should be a core strategic capability.

It should be:

- structured;
- editable;
- evidence-informed;
- deterministic where possible;
- transparent;
- constrained by available equipment and schedule.

It should not be marketed primarily as "AI."

Potential generator inputs:

- hypertrophy vs strength emphasis;
- experience;
- training frequency;
- session duration;
- equipment/gym profile;
- preferred rest interval for honest duration estimation;
- preferred movements;
- excluded movements;
- muscle-group priorities;
- split preference;

Recommend asks only questions that materially change the program. Custom may
add bounded program-specific choices such as split, but it does not ask users
to choose set volume, RIR targets, rep ranges, progression algorithms, or
deload timing. Taurifer owns those programming decisions. Deload is never an
onboarding preference: a whole-program deload requires observed performance
stagnation or degradation plus relevant corroboration.

Do not ask users to estimate a stable volume tolerance during onboarding.
Most have not isolated volume from effort, load, frequency, exercise selection,
and recovery well enough to answer. Start with conservative family defaults
and infer response slowly from logged exposure, effort, completion, session
friction, structured reports, and checkpoint reviews. Performance alone is not
enough to identify a volume problem.

### Generator design principle

> **Generate a complete good default, then expose exactly the controls the user needs to customize it.**

Avoid an onboarding questionnaire so long that it becomes a programming course.

The Pro generator's defining job is constrained specialization: reallocate the
available training budget around priorities without violating safety,
equipment, schedule, duration, primary goal, or recoverability, and explain
the resulting trade-offs. Bounded advanced controls support that outcome; they
are not the proposition by themselves.

The v1 priority model is **primary / maintenance / de-emphasized**. When the
athlete requests specialization, they may choose one or two primary muscle
groups, never more than two. Other groups default to maintenance unless
deliberately de-emphasized. These are allocation intents, not self-reported
volume-tolerance claims. If schedule, session duration, or recoverability
cannot support both primary targets, Taurifer asks the athlete to narrow them
or explains the bounded compromise. Direct set-volume targets are not an
onboarding control in v1.

### The Free/Pro generation boundary is capability-based

A capable baseline generator is part of the launched Free floor (§8.2). The boundary between Free and Pro generation is drawn by capability, not by artificial scarcity. Avoid restrictions such as one generated program ever, N generations per month, only one regeneration, or intentionally worse exercise selection: those create artificial scarcity around a computationally cheap feature and make Free feel crippled.

The distinction is:

> **Free can build you a good program. Pro can build a program around you and what Taurifer has learned about your training.**

See §8.3 for the concrete capability split and §8.4 for validation of the
working boundary.

### Taurifer-owned program families

A family is a durable training promise and programming structure, not a public
name for every frequency or equipment variation.

- Principal families require genuine three- and five-day sibling blueprints.
  They share intent and progression vocabulary but own their real weekly
  structures; Taurifer does not mechanically stretch one schedule.
- Recommend and Custom preserve the current generator's two- and six-day
  schedule coverage through generated variants. Every public Browse family is
  not required to expose every frequency.
- **Home** is a separate consistency-first family for limited equipment. A
  full home gym uses the ordinary families.
- **Foundation** is an internal simple-start/re-entry profile for genuinely
  new users or an explicitly simpler start, not a goal alongside hypertrophy
  and strength.
- A later high-volume family is valid only when its training promise is truly
  distinct. It is not required for the alpha.

Browse shows only complete executable programs. Cards state purpose,
frequency, session-time range, maturity fit, equipment assumptions, structure,
and progression style. An activated instance stays pinned to its blueprint
version; future family updates are offered as migrations, never silently
applied.

Families are declarative, versioned blueprints compiled into program instances,
blocks, days, slots, prescriptions, and declared progression strategies. The
engine may not branch on a family/program id. Generated, Browse, manual,
imported, and shared programs use the same supported primitives. Once selected,
the instance belongs to the athlete: it can be edited or renamed while
provenance remains available.

## 7.4 Generated and external programs must converge

After activation, Taurifer should not create a permanent hierarchy:

- "smart Taurifer program";
- "dumb imported program."

All programs should be able to use the same progression and execution engine when they contain the required semantics.

This is critical to the positioning.

## 7.5 Structural adaptation is diagnostic and user-approved

Normal exercise-level progression remains part of the shared Free engine. Pro
may add recurring-pattern interpretation and bounded structural adaptation.

The policy is:

> **Observe → interpret through the declared strategy → detect a pattern → ask
> why → propose a cause-matched intervention → obtain approval → version the
> change → observe its effect.**

There is no universal plateau-escalation order. Taurifer confirms comparable
adherent exposure, distinguishes observed facts and user reports from its own
inferences, and normally changes one main variable. Load granularity is
considered only when equipment increments actually obstruct the prescription.

Initial issues are repeated exercise skipping, exercise plateau, recurring
recommendation override, recurring session overrun, persistent schedule
mismatch/missed sessions, and unfinished-program transition. Related signals
may form one issue; a missed workout is not an exercise skip. Patterns surface
after the workout or at checkpoints, except reported pain/discomfort, which
receives an immediate Free conservative path.

Users may accept, modify, snooze, or dismiss a proposal. Every accepted change
belongs to the program instance rather than mutating the Taurifer family.

## 7.6 Multi-gym equipment contexts

Many athletes use two or three gyms whose equipment is similar but not
mechanically identical. Taurifer should let the athlete curate sibling versions
of the active program and choose the current gym before training.

- Comparable free-weight movements may share identity and performance history.
- Different machine models may remain separate when the same displayed load
  does not imply comparable effort—for example, Technogym versus Cybex versions
  of an incline converging press.
- Crowded-gym substitutions are normal. A substitution may be temporary,
  context-specific, or explicitly promoted into a program edit.
- Name equality never silently merges histories; equivalence is declared and
  user-reviewable.

This is athlete-owned execution infrastructure. It is not a gym-enterprise
product and does not justify a partner platform before the paid-beta gates.

## 7.7 One-off sessions

Travel, a disrupted week, a crowded gym, or training with a friend can make the
scheduled program inappropriate for one day. Taurifer therefore supports an
explicit one-off session from **Choose another day** on Today.

Free can build a manual/classic one-off around focus, selected muscles, time,
and available equipment. Pro may recommend the best use of today by considering
the active program and recent work, but the athlete can override it. The one-off
is saved to History and informs honest exposure/adherence evidence; it does not
silently rewrite the active program or complete a scheduled day.

The authoritative UX/domain specification is
[`docs/superpowers/specs/2026-08-25-one-off-session-design.md`](superpowers/specs/2026-08-25-one-off-session-design.md).

---

# 8. Free/Pro constitution

## 8.0 The commercial-launch boundary

> **The permanent Free floor is established when Taurifer publicly launches its production Free/Pro offering and represents those capabilities to users as the stable product contract. Pre-commercial prototypes, beta builds, preview deployments, and development releases may change feature entitlements before that point. User ownership of existing records and free export are protected regardless of launch status.**

Today's GitHub Pages PWA is explicitly a pre-commercial prototype for purposes of this rule. Features may still move between Free and Pro before the commercial contract is established.

This does not mean prototype users' data can be treated casually. Regardless of tier changes:

- existing workout records remain accessible;
- export remains available;
- program data is not held hostage;
- migrations into the launched product must preserve user data where technically possible.

What is not guaranteed before launch is the feature entitlement, not ownership of the user's record.

The boundary is behavioral, not tied to native availability: if Taurifer begins commercially marketing the PWA as the launched product before an app-store release, the clock has started. Conversely, small controlled validation experiments do not constitutionalize accidental prototype entitlements (§8.4).

## 8.1 Rule 1 — No clawbacks

> **From commercial launch onward, anything released as part of Taurifer Free remains part of the Free floor. Pro evolves by addition, never by subtraction from that floor.**

This is both a trust rule and a distribution rule.

A creator should be able to tell a buyer:

> "You can run my program in Taurifer."

without worrying that Taurifer will later remove core execution behind a subscription.

## 8.2 Rule 2 — The current-program execution boundary

The free product includes everything necessary to execute a program end-to-end.

That includes, at minimum:

- a capable baseline program generator (see §8.3 — committed to the launched Free floor);
- basic muscle emphasis;
- the Taurifer-owned template library;
- manual program creation;
- program import;
- shared-program acceptance;
- active workout logging;
- load/reps/RIR or effort logging;
- previous-session context;
- progression recommendations already part of the free product;
- every supported progression strategy and its basic manual parameters;
- rest timers;
- substitutions;
- warmup/working-set behavior already shipped;
- history needed to understand the current program;
- session summaries;
- current block/mesocycle review;
- structured skip, override, exit, pain/discomfort, and constraint capture;
- a free transition retrospective containing observed facts, detected issues,
  confidence, and a recommended direction/family;
- the ability to repeat, edit, choose another Free template, or generate
  another baseline program after transition;
- free manual export.

The block review stays free permanently because it is the natural completion of the program the user is executing.

Baseline generation launches Free for a strategic reason, not merely as a concession to the existing prototype: the ICP includes people who want to train seriously but do not arrive with a program. If their first experience is "you need Pro before Taurifer can even get you to your first workout," the strongest argument for owning program creation is weakened.

## 8.3 What Pro means

The strategic formulation:

> **Free gets you training and keeps you progressing. Pro personalizes the bigger picture.**

(Internal framing, not final marketing copy.)

Structurally:

### Taurifer Free — capable baseline generator plus complete execution

Free can generate a genuinely good structured program from:

- primary training goal;
- experience level;
- number of training days;
- approximate session duration;
- available equipment;
- basic movement exclusions where sensible;
- basic muscle emphasis;

with a sensible default split, sensible exercise selection, sets/reps/RIR
structure, and normal Taurifer progression logic. The result should be good
enough that the Taurifer name belongs on it. Free also selects Taurifer
templates, creates/imports/receives programs, executes them completely, gives
progression guidance, permits manual strategy control, completes the block,
reviews what happened, and exposes the recommended transition direction.

Safety-critical behavior is always Free. Pain/discomfort capture and a
conservative stop-or-substitute path cannot become subscription leverage.

### Taurifer Pro — advanced programming intelligence and continuity

The first commercial Pro product contains three complete jobs:

1. **Advanced first-program generation:** constrained specialization around
   priorities, preferences, movement constraints, schedule, equipment,
   program structure, and bounded block profiles, with trade-off explanations.
2. **History-aware next-program generation:** use complete or partial program
   history and structured exit reasons to choose resume, repair, rebase, or
   switch; rank one recommendation and up to two credible alternatives; then
   personalize the accepted Taurifer family.
3. **Bounded within-block adaptation:** detect recurring skip, plateau,
   recommendation-override, session-overrun, schedule-mismatch, and unfinished-
   program patterns; ask why; propose a cause-matched versioned change; obtain
   approval; and evaluate it.

Free records individual events and permits manual changes. Pro detects
recurring patterns and personalizes structural decisions. A generated program
and previously accepted adaptations remain executable and editable after Pro
lapses; Free set progression continues, while future program-level
optimization and next-program generation stop.

Later Pro territory includes full cross-program dashboards, multi-block
planning, longer-horizon career analysis, optional synchronization, and
managed Taurifer AI after paid-beta economics and the §16 gates. These are not
part of the initial paid gate.

The distinction:

> **Free can build you a good program. Pro can build a program around you and what Taurifer has learned about your training.**

The ordered implementation and capability queue lives in the
[`canonical backlog`](backlog.md).

## 8.4 Validating the generation boundary

Baseline generation is Free (§8.2), so the launch experiment is **not** whether Free users can generate at all. The former Variant A ("generation requires Pro") is removed from the viable experiment set.

The boundary is:

> **Free produces a good executable program and exposes the shared engine.
> Pro specializes and adapts programming around the athlete and their
> history.**

Research should still test which working Pro outcome creates value — advanced
first-program specialization, history-aware transition, or within-block
adaptation — while keeping Free genuinely good. Do not use fake doors to test
the boundary. Future concepts are researched through interviews and explicit
external prototypes; Taurifer itself presents only implemented capabilities.

### Alpha and beta do not accidentally start the launch clock

The noncommercial rolling alpha has no payment or paywall. A separate
commercial beta begins only after the complete Pro MVP works and subscription
terms, expiry, restoration, refunds, and purchase reconciliation are defined.
Beta packaging may remain explicitly mutable before commercial launch. What
starts the no-clawback clock is Taurifer publicly representing a stable
production tiering contract as the launched product.

This distinction must not be exploited dishonestly: if Taurifer is effectively launching to the public, calling it a beta does not avoid the constitution. But small controlled validation experiments do not constitutionalize accidental prototype entitlements.

---

# 9. Pricing strategy

## 9.1 Market anchors in Brazil

Current observed anchors:

| Product | Annual | Monthly | Position |
|---|---:|---:|---|
| Hevy Pro | R$99.90 | R$12.90 on one current SKU | Logger + analytics + social |
| Gravl Premium | R$179.90 | R$34.90 | Generated programs + progressive overload |
| Alpha Progression Pro | R$399.90 | R$59.90 | Generated programs + progression + analytics |
| Taurifer beta hypothesis | **R$179.90** | **R$24.90** | Progression-first system |

Sources:

- [Hevy Brazil App Store](https://apps.apple.com/br/app/hevy-treino-de-academia-gym/id1458862350)
- [Gravl Brazil App Store](https://apps.apple.com/br/app/gravl-personal-trainer-com-ia/id6450921637)
- [Alpha Progression Brazil App Store](https://apps.apple.com/br/app/muscula%C3%A7%C3%A3o-alpha-progression/id1462277793)

## 9.2 Base-case hypothesis

Recommended initial anchor:

> **R$24.90/month**  
> **R$179.90/year**

This should be treated as a testable hypothesis.

Why R$179.90 is attractive:

- materially above Hevy, signalling that Taurifer is not merely a logger;
- equal to a real local Gravl annual price anchor;
- less than half Alpha Progression's R$399.90 annual price;
- plausible for a serious hobby/fitness subscription in Brazil;
- sufficient to produce attractive software economics if retention is strong.

## 9.3 Initial beta and later price testing

The first small commercial beta uses one fixed pair: R$24.90/month and
R$179.90/year. Do not run a three-annual-price experiment while product value,
commitment cadence, and cohort quality are still confounded.

Measure monthly versus annual selection, conversion, cancellation, refunds,
retention, renewal, and support burden. Revisit price optimization only with a
larger denominator and a stable product bundle.

Measure:

> **price × conversion × renewal × support burden**

The highest conversion price is not necessarily the best business.

## 9.4 Avoid lifetime as a default

A lifetime plan is strategically unattractive if Pro eventually includes:

- cloud synchronization;
- long-term storage;
- AI inference;
- recurring infrastructure costs.

Lifetime pricing may be used tactically for an early founding cohort, but should not define the normal business model.

---

# 10. Market sizing

## 10.1 Why market sizing must be range-based

Brazilian gym and strength-training statistics vary significantly based on:

- whether the dataset counts gym memberships or people;
- whether it includes studios;
- whether it measures active memberships or registrations;
- whether it measures weight training outside traditional gyms;
- source year;
- industry vs government methodology.

Therefore Taurifer should not present a single precise TAM number as fact.

Use ranges and label confidence.

## 10.2 Broad population anchors

### Anchor A — gym members

Secondary reporting citing IHRSA's 2024 global data places Brazil at approximately **10.1 million gym members**, around 5% of the population.

Secondary source: [LiftCodex — gym membership statistics](https://liftcodex.com/statistics/gym-membership-statistics/)

This should be treated as a useful lower/conservative anchor rather than an audited Taurifer market figure.

### Anchor B — regular musculação participation

A 2025 Brazilian federal legislative proposal states that approximately **19 million Brazilians** regularly practice musculação, citing IBGE's Household Budget Survey (POF).

Source: [Brazil Chamber of Deputies — PL 21/2025](https://www.camara.leg.br/proposicoesWeb/prop_mostrarintegra?codteor=2924221&filename=Avulso+PL+21%2F2025)

This is a government-hosted legislative document, but the underlying derivation should be independently verified before being used in investor-facing external materials.

### Working broad TAM user range

> **~10–19 million Brazilian gym/strength participants**

This is deliberately wide.

## 10.3 Theoretical revenue TAM

At R$179.90/year:

- 10M people × R$179.90 = **R$1.799B/year**
- 19M people × R$179.90 = **R$3.418B/year**

This is **not** a forecast or serviceable market.

It is only a theoretical ceiling at the chosen price.

## 10.4 Behavioral SAM

Not every person who lifts is a Taurifer user.

The relevant behavioral population is narrower:

- uses or wants a structured multi-week program;
- wants progressive training;
- uses a smartphone during/around training;
- values guidance/history enough to use a dedicated app;
- is not satisfied by a simple paper workout or generic gym app.

Until direct data exists, use an explicit management assumption:

> **20–35% of the broad gym/strength population may fit Taurifer's serviceable behavior over time.**

Applying this assumption to the 10–19M broad range:

- low: 10M × 20% = **2.0M**
- high: 19M × 35% = **6.65M**

### Working SAM hypothesis

> **~2.0–6.5 million Brazilian users**

Again: assumption, not measured fact.

## 10.5 Five-year SOM

A realistic initial business does not need millions of paid subscribers.

Working outcome ranges:

### 25,000 paid annual equivalents

Gross subscription ARR at R$179.90:

> **R$4.50M**

### 50,000

> **R$9.00M**

### 100,000

> **R$17.99M**

These correspond to small percentages of the behavioral SAM.

This is enough to support a meaningful software business even before international expansion.

---

# 11. Unit economics

## 11.1 App-store fee assumptions

Apple's Small Business Program offers qualifying developers a **15% commission rate** on paid apps and in-app purchases up to the program's US$1M proceeds threshold.

Source: [Apple App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/)

For Brazil and other markets where Google's updated regional fee system has not yet superseded the global subscription treatment, Google states that auto-renewing subscriptions are subject to a **15% service fee**.

Source: [Google Play service fees](https://support.google.com/googleplay/android-developer/answer/112622?hl=pt-BR)

For early Taurifer modeling, 15% is therefore a reasonable simplified store-fee assumption.

## 11.2 Base annual subscription economics

Retail annual price:

> **R$179.90**

After 15% store commission:

> R$179.90 × 85% = **R$152.92**

Illustrative annual variable-service reserve:

> **R$10.00**

This reserve is not a forecast. It is a planning placeholder for:

- analytics;
- sync/storage;
- transactional backend;
- support-variable burden;
- miscellaneous per-user infrastructure.

Illustrative annual contribution:

> **R$142.92**

Contribution as percentage of retail price:

> **~79.4%**

This excludes:

- Brazilian corporate/service taxes;
- refunds;
- chargebacks;
- payroll;
- customer support fixed costs;
- development;
- design;
- marketing;
- payment variations outside store billing.

## 11.3 Price-sensitivity contribution table

Assuming 15% store commission and R$10 annual variable cost:

| Annual price | After store fee | Contribution | Contribution / retail |
|---|---:|---:|---:|
| R$149.90 | R$127.42 | R$117.42 | 78.3% |
| R$179.90 | R$152.92 | R$142.92 | 79.4% |
| R$199.90 | R$169.92 | R$159.92 | 80.0% |

This illustrates why pricing matters far more than small differences in local-first infrastructure cost.

## 11.4 Simple renewal-based LTV model

For rough planning, assume:

- annual contribution = R$142.92;
- constant annual renewal probability;
- no discount rate;
- no expansion revenue;
- no price increase.

Then:

> **LTV = annual contribution / (1 − renewal rate)**

### 40% annual renewal

LTV:

> **~R$238**

### 50% annual renewal

LTV:

> **~R$286**

### 60% annual renewal

LTV:

> **~R$357**

These are deliberately simple models.

A mature financial model should include:

- monthly plans;
- checkout and paid-conversion behavior;
- refunds;
- taxes;
- platform mix;
- churn timing;
- discount rate;
- win-back;
- annual price increases;
- cohort differences;
- creator affiliate payouts.

## 11.5 CAC ceilings

If Taurifer targets at least **3× LTV:CAC** on contribution LTV:

| Annual renewal | LTV | Approx. max CAC for 3× |
|---|---:|---:|
| 40% | R$238 | R$79 |
| 50% | R$286 | R$95 |
| 60% | R$357 | R$119 |

This is **paid-subscriber CAC**, not install CAC.

## 11.6 Why creators can improve unit economics

Suppose a creator receives an affiliate payout equal to 20% of first-year gross annual revenue:

> R$179.90 × 20% = **R$35.98**

Even if additional attribution/fulfillment costs push effective acquisition cost to R$45–60 per paid subscriber, this remains below the modeled 3× CAC ceiling under reasonable renewal assumptions.

This is why creator distribution remains strategically important even if creators never become the main paying customer.

---

# 12. Revenue scale scenarios

At R$179.90 gross annual price:

| Paying subscribers | Gross ARR | After illustrative 15% store commission |
|---:|---:|---:|
| 10,000 | R$1.799M | R$1.529M |
| 25,000 | R$4.498M | R$3.823M |
| 50,000 | R$8.995M | R$7.646M |
| 100,000 | R$17.990M | R$15.292M |

These numbers are before:

- taxes;
- variable service costs;
- payroll;
- support;
- marketing;
- refunds.

The key conclusion is strategic:

> **Taurifer does not need millions of Brazilian paying subscribers to become a meaningful company.**

---

# 13. Go-to-market strategy

## 13.1 Primary business model: B2C

The user and payer should usually be the same person.

This avoids misaligned models where:

- a coach pays but athlete receives the value;
- a gym pays, trainer operates, athlete receives the value.

The direct B2C model is structurally clean:

> **Athlete experiences value → athlete buys Pro.**

## 13.2 Direct consumer acquisition

Potential channels:

- App Store / Google Play organic search;
- Brazilian fitness YouTube;
- Instagram/TikTok creators;
- Reddit/fitness communities;
- Brazilian bodybuilding communities;
- content around progressive overload;
- SEO around treino de academia / ficha de treino / sobrecarga progressiva;
- referral loops;
- program-sharing links.

Paid acquisition should be introduced only after:

- activation is understood;
- D30/D60 retention is credible;
- free-to-paid conversion has signal;
- CAC ceiling is known.

## 13.3 Creator-led B2B2C distribution

Creators remain a particularly attractive acquisition strategy.

The initial proposition to creators should not be:

> "Pay Taurifer a monthly SaaS fee."

It should be:

> **"Turn the program you already sell into something your clients can actually train with."**

A creator's buyer should be able to:

1. purchase the program through the creator's existing commerce channel;
2. receive/open a Taurifer program link;
3. see clear publisher/program attribution;
4. install/open Taurifer;
5. start the program;
6. train without another paywall.

### Why creator execution should be free

A buyer who already paid R$X for a program should not encounter:

> "Subscribe to Taurifer Pro to use the program you purchased."

That would damage:

- Taurifer;
- creator conversion;
- creator trust;
- the distribution loop.

## 13.4 Creator as acquisition partner

The desired loop:

> **Creator distributes → athlete activates → athlete trains → program ends → athlete continues → athlete buys Pro**

Possible affiliate economics:

- creator receives a share of first-year Pro revenue;
- Taurifer gets performance-based acquisition;
- no creator SaaS sale required.

## 13.5 Creator publishing surface

The current self-contained fragment architecture can support a lightweight pilot publisher layer.

Recommended optional program metadata:

- publisher display name;
- publisher handle;
- short program description.

The initial experience can remain text-first.

Publisher attribution is an approved Phase 1 extension to shared programs, **not yet implemented**. Its implementation must respect ADR 0007's immutable existing payload contracts — the semantic `taurifer-shared-setup` version-1 document and both released envelopes are locked — so it requires an explicit compatible versioning path rather than mutating a locked schema. This thesis does not prescribe the exact codec version; that is an implementation design decision.

Do not build:

- separate white-label native apps;
- custom themes per creator;
- custom fonts;
- custom app-store listings;
- bespoke forks.

The strategic model is:

> **One Taurifer, many publishers.**

Later backend-hosted publishing may support:

- creator profile;
- logo/avatar;
- branded program page;
- short URL;
- custom domain;
- versioning;
- revocation;
- activation analytics;
- commerce entitlements.

This is optional future infrastructure, not a prerequisite for validating consumer PMF.

## 13.6 Possible future creator monetization

Creator monetization is secondary.

Potential later revenue:

1. **Program fulfillment fee**  
   Fixed fee per paid program activation.

2. **Creator Business subscription**  
   Branding, analytics, domains, collaborators, integrations.

3. **Marketplace take rate**  
   Larger commission when Taurifer generates the customer.

The key rule:

> **Do not tax the behavior that is efficiently acquiring Taurifer users unless the paid creator feature creates incremental economic value.**

---

# 14. Gym/enterprise strategy

## 14.1 Why gyms were considered

Regional gym chains initially appear attractive because:

- one sale can reach thousands of users;
- many gyms still use paper/basic workout workflows;
- the gym has a recurring economic relationship with the member;
- training quality could support retention and perceived service value.

## 14.2 Why gyms are not the primary strategy

The adversarial review identified substantial risks:

- incumbents such as Tecnofit/Next Fit/EVO already bundle workouts;
- Taurifer may become a second app;
- gyms may want centralized member/trainer visibility;
- local-first creates a payer/data-owner mismatch;
- instructor accounts and permissions are required;
- integrations may become the actual product;
- regional chains may demand enterprise support with SMB budgets;
- equipment mapping can become a services business;
- management may ask for CRM, billing, scheduling, attendance, access control;
- incumbent platforms can copy workout/progression features.

The nightmare outcome:

> **Taurifer becomes custom gym middleware instead of a focused consumer product.**

## 14.3 Enterprise boundary

Explore gyms opportunistically.

Build nothing major unless a credible customer says:

> "We will pay R$X for a pilot if you add Y."

If Taurifer eventually enters gyms, maintain the boundary:

> **Taurifer runs training. It does not run the gym.**

No default expansion into:

- billing;
- access control;
- CRM;
- class scheduling;
- membership management;
- nutrition;
- payroll.

---

# 15. Data architecture and privacy constitution

## 15.1 Local-first

Local-first remains a strategic asset.

Definition:

> **Core training does not require Taurifer servers.**

The athlete should be able to:

- open the app;
- access the active program;
- log training;
- see relevant history;
- get normal deterministic recommendations;
- finish a session;

without a live backend connection.

## 15.2 Ownership

The training record remains user-owned.

Permanent principles:

- free manual export;
- no data-hostage monetization;
- no requirement to maintain a subscription to retrieve raw history;
- local state remains useful even without Pro.

These protections apply regardless of launch status: the commercial-launch boundary (§8.0) frees Taurifer to change feature entitlements before launch, but never to treat prototype users' records casually. Existing workout records remain accessible, export remains available, and migrations into the launched product must preserve user data where technically possible.

## 15.3 Sync

"No backend" is not a constitutional principle.

"Local-first" is.

Future Pro synchronization can be:

- optional;
- encrypted where technically appropriate;
- cross-device;
- additive.

A durable customer-facing idea:

> **Your training record is yours. Taurifer works local-first. Cloud sync is optional.**

## 15.4 Telemetry

Taurifer should not blind itself in the name of privacy.

Product telemetry is allowed.

The permanent rules:

1. telemetry is intentional;
2. schema-driven events are the measurement source of truth;
3. pseudonymous longitudinal IDs are acceptable when genuinely useful;
4. analytics should never quietly reconstruct the workout database;
5. analytics are described as pseudonymous, not anonymous;
6. autocapture, replay, console/error capture, URLs, and network capture are
   mechanically prevented from carrying uncontrolled user or training data.

Reasonable events may include:

- install/open;
- acquisition/referral source;
- program creation route;
- shared program activated;
- session started/completed;
- workout duration;
- coarse set/exercise counts;
- recommendation viewed/accepted/overridden;
- substitution used;
- block completed;
- block review viewed;
- retention milestone;
- paywall/checkout/subscription events;
- app version/platform/language.

Avoid transmitting into normal analytics:

- full workout history;
- exact program payloads;
- workout notes;
- custom free-text exercise names;
- detailed longitudinal set records;
- raw setup payloads.

PostHog autocapture, replay, heatmaps, surveys, web analytics, and error tools
may support product research only after default-deny masking, property
allowlists, setup-fragment scrubbing, URL/console/network controls, and the
global opt-out have been verified. Full-tool authorization is not permission
to collect arbitrary content.

Structured transition and exit reasons may be normal schema-defined events.
Optional free text is different: the full note remains local unless the user
separately chooses to share that specific submission for product research.
Shared notes use a purpose-specific feedback path rather than PostHog, are
never duplicated through replay/autocapture/console/URL capture, and are
deleted after review/coding and no later than 90 days. Free text is supporting
context and may never solely trigger an automated program intervention.

Managed AI follows an even stricter split. PostHog receives only allowlisted,
text-free lifecycle events such as proposal shown/opened/accepted/rejected/
edited/reverted and outcome recorded. Conversations, proposals, feedback
comments, remembered text, support reports, and research cases never enter
PostHog and are never joined to it at person level.

The business question should determine the event.

Do not collect data merely because a tool makes it easy.

## 15.5 LGPD

Brazil's LGPD defines personal data broadly and considers health-related data sensitive when linked to an individual.

Source: [Brazil — Lei Geral de Proteção de Dados, Law 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)

This means telemetry, sync, and managed AI require deliberate legal/product
design. Before AI Preview, Taurifer obtains Brazilian privacy-counsel review,
documents international-transfer safeguards, stores Taurifer account,
conversation, and research data in the EU, and uses any US inference provider
only when evaluation value and contractual zero-retention/no-training controls
justify the disclosed transfer. Live deletion is prompt; backups expire within
thirty days.

This document is not legal advice.

---

# 16. AI position

## 16.1 AI is not the headline

Do not sell Taurifer as:

> "your AI personal trainer."

AI is increasingly commoditized in fitness positioning.

The everyday value should be:

> **log → deterministic interpretation → next target**

without requiring a conversation.

## 16.2 Managed Taurifer AI

The old BYOK/browser-provider design is superseded. After the deterministic
paid beta proves Taurifer's economics, Pro may add **Taurifer AI** as a managed,
adult-only, PT-BR-first capability.

It answers grounded hypertrophy/general-strength questions and helps interpret
program-level decisions. It is not a nutrition, medical, injury-diagnosis, or
general life coach. It has no fictional name, face, human relationship, or
permanent Chat tab.

The primary output is a structured proposal with:

1. the conclusion and main reason;
2. exact local evidence links;
3. clear separation of observations, user reports, and inference;
4. the proposed program differences and material warnings;
5. expandable scientific and Taurifer-rule support;
6. Accept, edit/recheck, snooze/dismiss, and rollback controls.

AI may propose any edit the supported Taurifer editor can express. It cannot
apply unsupported programming, violate hard deterministic rules, rewrite
workout history, or silently mutate the program. The user approves every
change, and major structural changes receive a second confirmation. Only one
program-level proposal can be active at a time; stale proposals freeze against
their original evidence/version.

AI appears at meaningful contexts—Program, Progress, a checkpoint, or a strong
detected problem—never during an active workout. Suggested actions and free
text coexist. A provider failure is stated plainly and may offer a separately
labeled deterministic alternative; AI is never silently imitated.

## 16.3 Evidence, memory, and conversation

- Each task/proposal receives its own conversation. Confirmed stable
  preferences and accepted decisions carry forward; one endless transcript
  does not.
- Taurifer asks before remembering a likely stable preference. Temporary
  circumstances have visible expiry, contradictions ask whether they are
  temporary or permanent, and a memory page supports correction/deletion.
- The current program is primary evidence; family/version and prior versions
  are retrieved when relevant. Only request-relevant context leaves the device.
- Conversations are discoverable in their original context and a secondary AI
  history page. Cloud conversation history expires on a rolling twelve-month
  schedule.
- A master switch stops new processing, prompts, and notifications while
  preserving read/export/delete controls. Subscription lapse behaves the same:
  accepted programs remain owned; pending proposals remain reviewable; no new
  generation/revision occurs.

## 16.4 Provider, knowledge, and evaluation constitution

- Taurifer chooses primary and backup providers using Taurifer-specific cases.
  Safety/correctness are hard gates before quality, latency, and cost.
- Provider retention must be zero. Provider/model routing is product-owned and
  risk-based; users do not choose models. Provider, region, and retention are
  disclosed in settings/privacy, not marketed as product identity.
- Prompt, model, provider, knowledge, and rule changes are versioned, evaluated,
  staged, monitored, and reversible.
- Scientific authority is peer-reviewed primary research plus high-quality
  reviews, consensus, and position documents. Community/coaching content is not
  scientific authority. Conflicting evidence is explained rather than hidden.
- Evaluation combines deterministic checks, protected/generated cases, blind
  founder review, and a separate judge model. Generated/model-based testing
  also exercises long program journeys and promotes minimized failures into
  permanent regressions.

## 16.5 Preview, privacy, and research

PT-BR Preview begins only after the paid beta, provider/legal gates, and
predeclared numeric safety, privacy, program, quality, latency, cost, outcome,
and support thresholds. Eligible adult PT-BR Pro users self-select in controlled
waves; English AI remains hidden until independently evaluated. PT-BR may
graduate and expand progressively without waiting for English.

During Preview, AI is a separate research capability—not part of the generally
available Pro purchase promise. A person who reaches a real paywall and shows
purchase intent may receive complementary access through the next major program
decision, capped at twelve weeks. Payments, attempts, grants, and Preview use
remain separate measures.

Required processing is explained at setup. Optional product-improvement sharing
is invited only after a successful answer. One global switch, selective one-
time sharing, and a Shared conversations inventory govern it. Research receives
only explicitly consented redacted copies in separately credentialed storage;
uncertain redaction means no copy. Research subject identifiers are
pseudonymous, not anonymous, and retain a separate deletion mapping.

Raw research copies live at most twelve months. Conversation deletion removes
service and research copies; backups expire within thirty days. Support receives
raw conversation only through an explicit Report a problem action, with logged
temporary access and a 180-day absolute retention cap. PostHog receives no AI
text and is never person-level joined to research.

## 16.6 Allowance and notification contract

Ordinary questions and consequential program reviews have separate published
allowances. One completed task includes necessary clarification and reasonable
revision. Technical failures, safety refusals, and unsupported requests do not
consume the allowance. Questions reset monthly; unused reviews may accumulate
only to a small published cap. There are no top-ups initially.

Preview uses intended commercial limits. Exact counts are derived before
Preview from provider cost and representative journeys and change only
prospectively with notice.

AI prompts remain inside Taurifer by default. Users may opt into push for a
major checkpoint or waiting proposal. Lock-screen text is generic by default,
one unresolved event receives at most one push, and a material state change is
required before another.

## 16.7 Analytical independence

Constitutional principle (§29):

> **Analytical independence. Taurifer's deterministic training outputs are derived exclusively from the athlete's program, training record, and declared training rules. Commercial relationships, subscription state, creator economics, marketplace incentives, advertising, and Taurifer's own revenue interests may never alter those outputs or their presentation. Commercial options may appear only as clearly separate, subordinate choices.**

Commercial considerations must never alter:

- the computed recommendation;
- strategy ordering;
- recommendation wording;
- confidence/importance presentation;
- session-freshness logic;
- progression targets;
- capacity interpretation;
- block-review conclusions.

The engine answers only: *given this athlete's program, training record, and deterministic training rules, what does the evidence support doing next?* If the correct recommendation is to repeat the block, deload, progress the same program, change strategy, or eventually move to a different program, that is what Taurifer says.

The rule generalizes across every commercial temptation:

- if the engine recommends continuing the current free program while Taurifer would profit from a Pro-generated program, the commercial system yields to the engine;
- if the engine recommends repeating the current block while a creator wants to sell Block 2, the engine's conclusion stands — commerce may coexist as a clearly separate, subordinate surface, but never inside or above the recommendation (§23);
- if a future marketplace or gym/partner would profit from moving the athlete to a new program, the engine wins.

Taurifer must never manufacture a conclusion such as "this block has run its course — generate your next program with Pro" when the deterministic evidence actually supports "repeat this block."

The summary rule:

> **Taurifer may monetize capabilities around the engine. It may never monetize control over the engine's conclusions.**

This is especially important under the B2C thesis because the central retention asset is trust in "know what to do next." If users begin to suspect that today's recommendation is actually an upsell mechanism, the core product proposition is compromised.

---

# 17. Defensibility

## 17.1 What is not a moat

Do not claim these as durable moats:

- program generator;
- RIR;
- capacity equation;
- progressive-overload recommendations;
- local-first;
- shared setup links;
- exercise library;
- attractive visual identity.

Competitors can reproduce all of these.

## 17.2 Near-term advantage

The near-term advantage is a **focused system**:

- program generation when needed;
- respect for external programs;
- strong execution;
- clear progression;
- PT-BR quality;
- rational Brazilian price;
- creator distribution;
- calm product design.

## 17.3 Potential long-term moat

The plausible long-term moat is cumulative:

1. **Personal longitudinal dataset**  
   The user's multi-year training history.

2. **Interpretation layer**  
   Taurifer understands blocks, exercise continuity, substitutions, progression, capacity, and program transitions.

3. **User habit**  
   Logging and decision workflows become familiar.

4. **Program portability**  
   Taurifer becomes an easy standard target for programs.

5. **Creator distribution network**  
   Creators publish into Taurifer because athletes already use it.

6. **Format/network effect**  
   Athletes ask for "the Taurifer version."

This is not present-day defensibility.

It is the defensibility roadmap.

---

# 18. Product priorities

## 18.1 Tier 0 — must be excellent before broad growth

- logging speed;
- active-session reliability;
- product quality in Android/iOS browsers during Phase 1 (native app quality becomes Tier 0 when Phase 2 begins, §22);
- deterministic recommendations;
- clear recommendation explanation;
- robust local persistence;
- workout completion flow;
- rest timer;
- substitutions;
- current-program history;
- import/export;
- onboarding activation;
- shared multi-strategy progression engine;
- declarative Taurifer program families;
- program-instance lifecycle and history-preserving transitions.

## 18.2 Tier 1 — monetization

Monetization work splits by phase; optional synchronization is **not** a prerequisite for Phase 1 monetization.

### Phase 1 Pro product and validation

- noncommercial rolling program-based alpha on the web core;
- advanced first-program generation;
- history-aware next-program generation;
- bounded within-block adaptation;
- a narrow billing-agnostic capability abstraction;
- a paid beta only after all three Pro jobs work;
- fixed monthly/annual pricing and full purchase-lifecycle measurement.

### Phase 2 commercial infrastructure (deferred until the evidence gates, §22)

- production subscription management;
- StoreKit / Google Play Billing;
- robust cross-device entitlement;
- production synchronization architecture;
- the long-horizon analysis foundation grows after the Pro MVP.

## 18.3 Tier 1 — acquisition

- shared program handoff;
- publisher attribution;
- creator-friendly program export/share;
- migration from competing apps/formats;
- referral attribution.

## 18.4 Tier 2 — retention

- cross-program exercise continuity;
- multi-block comparison;
- long-term progression analysis;
- multi-block planning;
- richer periodization tools beyond bounded family profiles;
- optional synchronization;
- managed Taurifer AI after paid-beta economics and the §16 gates.

## 18.5 Later

- Apple Watch/Wear OS if usage justifies it;
- HealthKit/Health Connect integration;
- marketplace;
- creator business dashboard;
- enterprise/API;
- gym integrations.

---

# 19. Explicit non-goals

Unless market evidence forces reconsideration, Taurifer should not become:

- social feed;
- leaderboards;
- streak/gamification system;
- coach CRM;
- in-app coach-client messaging;
- billing/scheduling software for trainers;
- gym access-control system;
- nutrition coaching suite;
- content marketplace at launch;
- form-check video empire;
- generic wellness/readiness platform;
- wearable-first product;
- white-label app factory.

The product should resist horizontal expansion.

---

# 20. Quantitative validation framework

The thesis must be treated as falsifiable.

## 20.1 H1 — Acquisition

**Claim:** Taurifer can acquire the right Brazilian strength trainee economically.

Track:

- install CAC;
- qualified-install rate;
- referral/creator source;
- organic vs paid split;
- paid-subscriber CAC.

Initial management target:

> **Creator/organic activated-user CAC < R$10–15**

This is not an industry benchmark.

## 20.2 H2 — Program activation

**Claim:** New users reach a meaningful active program quickly.

Program entry routes:

- generated;
- Taurifer template;
- manually created;
- imported;
- creator/shared.

Targets:

> **>60% of qualified new users establish an active program**

and

> **>50% complete first workout within 72 hours**

Measure by entry route.

## 20.3 H3 — Training retention

**Claim:** Taurifer's execution/progression loop is sticky.

Initial management thresholds:

> **>50% of activated users complete at least six workouts in first 30 days**

> **>30% remain genuinely active at day 60**

Define "active" before looking at the data.

Example:

> at least two completed sessions in a rolling 14-day period.

Do not change definitions to make results look better.

Interpret the product mechanism in order:

1. logging speed and no lost workouts are guardrails;
2. progression understanding/trust is the product mechanism;
3. stopping consultation of spreadsheets/notes for progression decisions is
   the switching behavior;
4. repeated planned-workout completion is the lagging retention outcome.

Telemetry can measure parts of this sequence, but trust and spreadsheet
abandonment require direct user research.

## 20.4 H4 — Program generation creates value

**Claim:** Owning program creation increases activation and/or monetization.

Compare primary cohorts:

### Recommend / Generate custom users

vs

### Browse users

Track Build/Import users as a smaller secondary migration cohort rather
than treating them as the primary acquisition comparison.

Measure:

- generator completion;
- program activation;
- first workout;
- workouts in first 30 days;
- D30/D60 retention;
- paywall exposure;
- checkout start;
- paid conversion;
- renewal.

Possible outcomes:

### Outcome A
Generated users convert better and retain similarly.

**Interpretation:** generator is a strong monetization/acquisition wedge.

### Outcome B
Generated users convert better but retain worse.

**Interpretation:** generation attracts lower-intent users; execution PMF may remain stronger among sophisticated users.

### Outcome C
Template users retain much better.

**Interpretation:** a trusted low-input family may be a stronger entry product
than full generation even if advanced generation monetizes.

### Outcome D
Generation does not improve conversion.

**Interpretation:** do not over-invest in direct Alpha/Gravl competition.

## 20.5 H5 — Pro willingness to pay

**Claim:** advanced first-program generation, bounded within-block adaptation,
and history-aware transition produce enough paid conversion and recurring
value.

Initial target:

> **5–10% of retained activated users convert to paid Pro**

This should be measured only after the three Pro jobs work and purchase,
expiry, restoration, refund, and reconciliation behavior is complete. Fake
doors and payment for undefined future capability are not valid evidence.

If sustainably below ~5% after credible iteration, the monetization thesis deserves serious reassessment.

## 20.6 H6 — Renewal

Renewal and continued paid use must be read separately by commitment cadence.
Monthly retention reveals whether Pro has value between program transitions;
annual renewal remains the strongest long-horizon signal.

Target:

> **≥50% annual renewal**

Freeze monthly churn/retention thresholds only after the beta establishes a
credible cohort denominator. A 50%+ annual renewal level materially improves
LTV and supports scalable paid acquisition.

## 20.7 H7 — Creator distribution

**Claim:** creator programs acquire users more cheaply than direct consumer marketing and some remain after the purchased program ends.

Track:

- shared link opens;
- installs;
- activation;
- first workout;
- D30 retention;
- end-of-program completion;
- activity after program end;
- Pro conversion;
- creator-attributed subscriber CAC.

The crucial metric:

> **post-program retained users / creator-acquired activated users**

If creator-acquired users disappear immediately when the program ends, creators are a fulfillment channel but not a strong B2C acquisition engine.

---

# 21. Funnel model

The canonical funnel should become measurable:

1. impression/referral;
2. store/product page;
3. install;
4. onboarding started;
5. program path selected;
6. program activated;
7. first workout started;
8. first workout completed;
9. third workout completed;
10. sixth workout completed;
11. D30 active;
12. block completed;
13. program ends;
14. post-program active;
15. paywall/checkout;
16. paid Pro activation;
17. first renewal;
18. second renewal.

Each major drop-off should map to a product question.

Do not hide poor retention behind download growth.

---

# 22. Experiment roadmap

Two sequencing principles govern this roadmap (constitutional, §29):

> **Validation before platform hardening.** Taurifer should not incur major native-platform complexity until external usage demonstrates that the product, retention loop, monetization thesis, or platform limitations justify it. Native is the intended production destination, not a prerequisite for proving product-market fit.

> **Progressive native enhancement.** Once native commercialization is justified, Taurifer preserves its shared, tested training core and introduces native-backed implementations where platform-native semantics materially improve reliability, durability, distribution, monetization, or user experience. A greenfield rewrite requires evidence that this architecture cannot satisfy product requirements.

## Phase 1 — Market and business-model validation on the existing web core

The largest unresolved risks in this thesis are market and behavioral, not platform risks. The current PWA is already capable of testing most of the existential hypotheses, and for the creator-distribution hypothesis it is arguably the cleaner experimental environment: the loop to test is Instagram/WhatsApp/checkout → shared program → Taurifer → first workout, and inserting a store install before validation adds funnel loss that makes the experiment harder to interpret.

Phase 1 is therefore:

> **Market and business-model validation using the existing Taurifer web product, with engineering focused only on capabilities that materially improve or measure acquisition, activation, retention, or monetization.**

Validate the funnel in two separated stages: noncommercial rolling program-based
alpha for execution evidence, then a paid beta for working Pro value.

Priorities:

- baseline generator and Taurifer-family quality;
- onboarding;
- workout/session UX;
- deterministic progression clarity;
- telemetry and funnel instrumentation;
- creator/publisher attribution;
- shared-program handoff;
- advanced generation, within-block adaptation, and next-program quality;
- fixed monthly/annual offer after the Pro MVP works;
- historical import where useful for activation;
- recruiting real Brazilian users;
- creator pilots;
- D7/D30/D60 measurement;
- Recommend/Custom versus Browse path analysis, with Build/Import as secondary
  migration/expert groups;
- post-program retention.

The objective is not to maximize technical polish. It is to eliminate the largest business uncertainties as cheaply and quickly as possible. During Phase 1, the PWA is the primary validation product, not a preview channel.

### Canonical Phase 1 backlog

The ordered implementation queue lives in
[`docs/backlog.md`](backlog.md). This thesis defines the strategy and gates; it
does not maintain a second list of work.

In summary, alpha readiness requires trustworthy release evidence,
leakage-safe measurement, the shared multi-strategy engine, credible Taurifer
families and entry flows, lifecycle/friction capture, generated regression
coverage, and honest browser-persistence mitigations. Publisher attribution is
required before creator pilots. Non-destructive existing-user program handoff
and next-program transition must work before participants reach those cases.

Do not add a paywall, locked future capability, waitlist CTA, or price
experiment during the noncommercial alpha.

### Rolling program-based alpha

Recruit organically, one person at a time, through the solo founder's direct
network and social posts. Eight to twelve participants is a useful evidence
milestone, not a synchronized cohort or enrollment gate. Participants
self-select and use the normal onboarding, random installation identifier, and
available Recommend, Custom, or Browse path. Churn and incomplete programs are
expected evidence.

Review family designs, rules, representative synthetic outputs, and generated
regressions before alpha. Do **not** inspect, approve, or repair every
participant's individual program. Each participant owns an approximately six-
week clock, and evidence is read when the relevant denominator exists rather
than at a cohort-wide date.

The alpha has no payment, paywall, public launch claim, or stable entitlement
promise. It validates logging/reliability, progression trust, spreadsheet
abandonment, repeated workout completion, autonomous generator/family behavior,
and the intervention vocabulary. It does not validate willingness to pay.

### Working Pro before monetization

Build the three-job Pro MVP while alpha users accumulate history:

1. advanced first-program generation;
2. history-aware next-program generation;
3. bounded within-block adaptation.

Only then begin a separate commercial beta. Use the fixed R$24.90/month and
R$179.90/year pair. The beta may use lightweight web commerce rather than
native IAP, but payment must reconcile to an entitlement with real term,
expiry, restoration, cancellation/refund behavior, and capability state.

No fake door or manual timeless activation code is an acceptable substitute.
Future concepts are tested only through interviews and explicit external
prototypes.

### Accepted Phase 1 risk — browser-backed persistence

Real pilot users will temporarily use browser-backed persistence before Phase 2. This is a conscious validation tradeoff, not the desired production architecture; browser storage is evictable (worst on iOS Safari for non-installed usage).

Low-cost mitigations:

- request persistent browser storage where supported;
- encourage installation where useful;
- automatic or prominent export/backup nudges for pilot users;
- clearly communicate prototype/beta status;
- avoid claims that prototype storage has native-grade durability.

Do not turn this mitigation work into a major PWA infrastructure project. If durability becomes a meaningful user problem, that is itself evidence for triggering Phase 2.

## Phase 2 — Native commercial foundation

Native begins once there is evidence that it is solving an actual problem rather than an anticipated one.

Possible triggers (not all are required):

- a meaningful cohort of external users is repeatedly training and accumulating valuable history;
- D30/D60 retention is strong enough that persistence durability becomes a genuine user responsibility;
- the working Pro beta demonstrates credible paid conversion and acceptable
  refund/cancellation behavior;
- PWA installation/re-entry friction is measurably hurting acquisition or retention;
- background timers, notifications, HealthKit/Health Connect, or other native capabilities become meaningful constraints;
- App Store / Google Play discovery becomes a channel Taurifer actually wants to exploit.

When the threshold is crossed, the architecture is **wrap, not rewrite**: evolve the existing repository with a Capacitor-class/native-shell architecture. The deterministic engine is an asset; there is no strategic reason to rewrite capacity/progression logic, program semantics, generator behavior, import/export, session flows, localization, or existing tested behavior just to get into the stores.

The shared web core is preserved, with a thin platform boundary for:

- durable native-backed persistence;
- StoreKit / Google Play Billing;
- entitlements;
- notifications;
- deep/universal links;
- app lifecycle;
- secure preferences;
- future HealthKit / Health Connect;
- future push where justified.

No big-bang Swift/Kotlin/Flutter/React Native rewrite unless later evidence shows the web-core architecture cannot meet product requirements.

After a native commercial launch, installed iOS and Android become the canonical consumer applications. The existing GitHub Pages deployment can then become a preview/development environment, while Taurifer retains a production web surface for creator/program landing pages, shared-program preview, publisher attribution, open-in-app/install handoff, portability, and account/commerce surfaces where appropriate. Production surfaces must share the same entitlement semantics — there must be no accidental legacy product with every Pro capability competing against the subscription.

Phase 2 objectives, once triggered:

- native Android/iOS launch quality;
- production subscription plumbing;
- retain the free floor;
- maintain data integrity through migration;
- establish the commercial-launch Free/Pro contract (§8.0).

## Phase 3 — Expanded longitudinal Pro

Once users have enough history, add:

- full cross-program dashboards;
- multi-block comparisons and planning;
- long-horizon analysis beyond the MVP intervention catalogue;
- optional synchronization when platform evidence justifies it;
- managed Taurifer AI only after deterministic paid-beta economics and the
  §16 safety/privacy/evaluation gates are proven.

This tests whether "training career intelligence" becomes a durable renewal reason.

## Phase 4 — Scalable acquisition

Only after retention + monetization signal:

- paid social;
- app-store ads;
- broader affiliate program;
- SEO/content investment;
- larger creators.

---

# 23. Creator handoff design thesis

A buyer arriving from a creator should not see a generic anonymous import.

The handoff should make clear:

- who authored/published the program;
- what the program is;
- what they are about to start;
- that Taurifer is the execution environment.

Pilot-level attribution can be text-only:

> **Program by Rafael Silva**  
> `@rafaelsilva`  
>
> **Upper/Lower Hypertrophy — 8 weeks**  
> Short description  
>
> **Start this program**

Do not initially build:

- remote logos in fragment payloads;
- arbitrary colors;
- white-label fonts;
- creator-specific app skins.

Later hosted publishing can support richer visual brand assets.

## Attribution at block end: provenance, not steering

For a publisher-attributed program, the block review close may carry a visually subordinate provenance line — for example:

> Program by Rafael Silva · @rafaelsilva

after the actual block-review content. It preserves continuity between the program the athlete received and the person who authored it. It must never be inserted into the recommendation itself and must never visually compete with the recommended strategy.

In the fragment/self-contained era, stop there. No "Buy block 2", no "Continue with Rafael", no promotional banner, no highlighted creator CTA, no affiliate offer, no next-program recommendation.

Once hosted publishing exists, a separate, optional, creator-authored next-program surface may be added, but the hierarchy must remain explicit — training guidance first, commerce/discovery clearly separate and subordinate:

> **Taurifer's assessment**  
> Repeat this block. You completed 67% of planned sessions and progression was still positive where adherence was consistent.  
> [Repeat block]

then, separately:

> **Program publisher**  
> Rafael Silva · @rafaelsilva  
> Rafael also offers: Upper/Lower II  
> [View program]

The first object is training guidance. The second is commerce/discovery. They must remain semantically and visually distinct. If Taurifer recommends repeating the current block while the creator wants to sell Block 2, both can coexist without pretending they agree — Taurifer does not need to protect the creator from that tension. The creator is an acquisition partner; the athlete is the long-term customer, so preserving athlete trust is economically aligned with Taurifer's actual business model (§16.3).

---

# 24. Monetization extensions — not the core model

## 24.1 Program fulfillment

Future creator commerce integration:

> Hotmart/Kiwify purchase → entitlement → Taurifer activation

Potential pricing:

- fixed activation fee;
- low percentage;
- volume bundle.

Do not charge a large take rate merely for delivery unless Taurifer demonstrably drives conversion or revenue.

## 24.2 Marketplace

Long-term possibility:

- creators sell programs inside Taurifer;
- Taurifer takes a higher rate when Taurifer generates the customer;
- lower fee when creator brings buyer.

Do not launch a marketplace before there is meaningful demand on at least one side.

## 24.3 Creator Business

Optional future plan:

- hosted profile;
- custom domain;
- visual branding;
- analytics;
- collaborators;
- version management;
- commerce integrations.

Secondary revenue only.

## 24.4 API/engine licensing

Long-term option:

- progression engine;
- program schema;
- recommendation API;
- exercise mapping;
- execution logic.

Potential buyers:

- gyms;
- equipment manufacturers;
- coaching platforms;
- fitness apps.

Do not pivot to infrastructure before the consumer product proves the engine.

---

# 25. Risks

## 25.1 Feature parity

**Risk:** competitors copy Taurifer's visible features.

Mitigation:

- focus on whole-system quality;
- move quickly;
- strengthen distribution;
- accumulate longitudinal value.

## 25.2 Brazilian localization is not enough

**Risk:** Hevy, Gravl, Alpha already support Portuguese.

Mitigation:

- PT-BR primary-market copy;
- better local price/value;
- creator distribution;
- superior program/execution integration.

## 25.3 Free product is too good

**Risk:** users never need Pro.

This is intentionally accepted to some degree.

Progression is the reason Taurifer exists and should not be crippled merely to manufacture conversion.

Mitigation:

- create immediate Pro value through constrained specialization;
- create recurring value through bounded within-block adaptation;
- create transition value through history-aware next-program generation.

## 25.4 Pro value arrives too late

Mitigation:

- advanced first-program generation for users with no Taurifer history;
- rolling-alpha history ready when next-program generation is tested;
- use partial and unfinished-program history with explicit confidence;
- do not require two completed blocks before Pro becomes useful.

## 25.5 Generator commoditization

Mitigation:

- generator is not the company;
- original Taurifer families and the shared engine create coherent structure;
- externally authored programs remain first-class;
- within-program adaptation and history-aware transition differentiate beyond
  a one-time generated plan.

## 25.6 Poor logging UX

A brilliant generator cannot compensate for a bad gym-floor experience.

This remains existential.

## 25.7 Creator channel does not retain users

If users only use Taurifer because a creator told them to, creator distribution may not produce B2C LTV.

Measure post-program retention explicitly.

## 25.8 App-store dependence

Mitigation:

- model 15% fees;
- build strong direct brand;
- maintain portable data;
- eventually consider web commerce only where policies/economics justify it.

## 25.9 Privacy/legal complexity

Telemetry, sync, AI, and sensitive fitness data require disciplined LGPD compliance.

Do not let the brand's local-first posture substitute for actual legal compliance.

## 25.10 Founder/product sprawl

The biggest internal strategic risk is chasing every plausible adjacent model:

- creators;
- gyms;
- AI;
- marketplace;
- enterprise;
- watches;
- nutrition.

The constitution exists to prevent that.

---

# 26. Kill criteria / falsification

Taurifer should be willing to change strategy if evidence contradicts the thesis.

## Kill or materially revise the B2C subscription thesis if:

- D60 active retention remains materially below ~20–25% despite a polished execution loop;
- retained users repeatedly say they would return to Hevy/Gravl/Alpha if Taurifer disappeared;
- paid conversion remains below ~3–5% despite meaningful Pro value;
- annual renewal is substantially below 40%;
- paid subscriber CAC consistently exceeds modeled LTV capacity.

## Reduce generator investment if:

- generated-program users activate but do not retain;
- users overwhelmingly prefer external/manual programs;
- generator use does not improve Pro conversion;
- quality requires operational content/science complexity disproportionate to revenue.

## Reduce creator investment if:

- creators refuse to distribute even when free;
- shared-program activation is poor;
- post-program retention is negligible;
- creator-attributed CAC is not better than direct acquisition.

## Revisit gym/enterprise if:

- multiple credible gyms independently request Taurifer;
- at least one offers paid pilot economics strong enough to justify integration;
- the request fits training execution rather than gym-management sprawl.

---

# 27. Metrics dashboard

The CEO/product dashboard should prioritize:

## Acquisition

- installs;
- source;
- creator-attributed installs;
- install CAC;
- qualified-user CAC.

## Activation

- program activated;
- path: recommend/custom/browse/build/import/shared;
- time to program;
- first workout start;
- first workout completion;
- time to first workout.

## Engagement

- sessions/week;
- sets/session;
- recommendation interaction;
- substitution rate;
- active-program week.

## Retention

- D7;
- D30;
- D60;
- D90;
- block completion;
- post-program retention.

## Monetization

- paywall view;
- checkout start;
- checkout-to-paid;
- free-to-paid;
- annual vs monthly selection;
- ARPPU;
- refund rate;
- first renewal.

## Unit economics

- CAC by channel;
- LTV by cohort;
- LTV:CAC;
- contribution margin;
- affiliate acquisition cost.

## Creator

- links opened;
- program activations;
- first workout;
- D30;
- program completion;
- post-program active;
- Pro conversion.

---

# 28. Product copy consequences

Once the business thesis is locked, copy should be audited against it.

## Store page

Must immediately answer:

- what Taurifer does;
- who it is for;
- why it is better than a logger;
- whether it can build a program;
- whether it supports an existing program.

## First-run onboarding

Should support an explicit hierarchy:

> **Build a program for me**

> **Choose a Taurifer program**

> **I already have a program**

with import/shared paths available contextually.

## Recommendation copy

Every recommendation should:

- state the next target;
- give a concise reason;
- avoid hype;
- avoid opaque scores.

## Pro copy

Do not sell Pro as:

> "unlock more features."

Sell the actual outcomes:

- specialize a program around priorities without exceeding real constraints;
- notice when the current program no longer fits and propose a bounded repair;
- use completed or unfinished history to build what should come next.

Later, sell cross-program dashboards, multi-block planning, sync, and AI only
when those capabilities exist.

## Portuguese

PT-BR should be authored as first-class copy.

Do not ship literal translations of English training jargon when Brazilian lifters use different natural terms.

---

# 29. Strategic constitution

The following should govern final product alignment.

## Market

1. Taurifer is initially optimized for Brazilian/Portuguese-speaking strength trainees.
2. The product remains globally available where practical.
3. Brazil is a learning and pricing beachhead, not a permanent ceiling.

## User

4. The primary user wants structured, progressive resistance training.
5. The primary acquisition user is a self-directed intermediate; ambitious
   beginners and advanced external-program users remain supported.
6. The common denominator is intent to follow and progress a real hypertrophy
   or general-strength program.

## Product

7. Entry hierarchy is generator first, Taurifer templates second, and BYOP as
   a first-class migration/expert path.
8. Original Taurifer families and external programs converge on the same
   shared engine.
9. Progression logic is deterministic first.
10. Training execution speed and reliability outrank feature breadth.
11. AI is subordinate to the deterministic product.

## Engine

12. **Analytical independence.** Taurifer's deterministic training outputs are derived exclusively from the athlete's program, training record, and declared training rules. Commercial relationships, subscription state, creator economics, marketplace incentives, advertising, and Taurifer's own revenue interests may never alter those outputs or their presentation. Commercial options may appear only as clearly separate, subordinate choices.
13. Taurifer may monetize capabilities around the engine. It may never monetize control over the engine's conclusions.
14. Capacity is shared evidence, not a universal prescription policy; the
    engine dispatches through explicit versioned strategies.
15. Supported progression strategies and basic manual parameters remain Free.

## Free

16. **Commercial-launch boundary.** The permanent Free floor is established when Taurifer publicly launches its production Free/Pro offering. Pre-commercial prototypes, beta builds, preview deployments, and development releases may change feature entitlements before that point. User ownership of existing records and free export are protected regardless of launch status.
17. From commercial launch onward, anything released as part of Taurifer Free remains part of the Free floor.
18. Taurifer Free includes a capable baseline generator, basic muscle emphasis,
    and Taurifer templates.
19. Current-program execution and normal progression remain Free end-to-end.
20. Current block review and the factual transition retrospective remain Free.
21. Safety-critical pain/discomfort and stop-or-substitute behavior remains Free.
22. Manual data export remains Free.

## Pro

23. Pro MVP provides advanced first-program generation, history-aware next-
    program generation, and bounded within-block adaptation.
24. Pro may use partial and unfinished-program history with explicit confidence.
25. Pro interventions are cause-routed, versioned, user-approved, and normally
    change one main variable at a time; no universal plateau ladder exists.
26. Pro may later analyze across programs/blocks/time, synchronize optionally,
    and offer managed Taurifer AI under §16 after the paid beta.
27. Pro lapse never removes a program or accepted adaptation; it stops future
    program-level decisions.
28. Pro must add value rather than degrade Free.

## Data

29. Core training works serverless.
30. The training record remains owned and exportable.
31. Cloud sync is optional.
32. Telemetry is allowed and described accurately as pseudonymous where
    applicable.
33. Schema-defined events are the measurement source of truth.
34. Analytics must never become a shadow workout database.
35. Centrally shared free text requires per-submission consent, a purpose-
    specific non-PostHog path, and deletion within 90 days.

## Distribution

36. B2C subscription is the primary business model.
37. Creators are initially an acquisition channel.
38. A creator-delivered program must be executable without a second consumer paywall.
39. One Taurifer, many publishers; no default white-label forks.
40. Marketplace/fulfillment are future options, not launch dependencies.
41. Publisher presence in training surfaces is provenance, not steering; commerce/discovery stays separate and subordinate.

## Platform

42. **Validation before platform hardening.** Taurifer should not incur major native-platform complexity until external usage demonstrates that the product, retention loop, monetization thesis, or platform limitations justify it. Native is the intended production destination, not a prerequisite for proving product-market fit.
43. **Progressive native enhancement.** Once native commercialization is justified, Taurifer preserves its shared, tested training core and introduces native-backed implementations where platform-native semantics materially improve reliability, durability, distribution, monetization, or user experience. A greenfield rewrite requires evidence that this architecture cannot satisfy product requirements.

## Enterprise

44. Gyms are exploratory.
45. No major gym-specific build without paid-pilot evidence.
46. Taurifer does not become generic gym-management software.

## Brand

47. Calm, precise, non-gamified.
48. The ethos supports memorability; utility explains the product.
49. Privacy supports trust but is not the headline.
50. The product should never need theatrics to make progression feel valuable.

## Families and execution contexts

51. Principal program families have genuine three- and five-day siblings;
    generated paths preserve two- and six-day users without forcing every
    Browse family to expose every frequency.
52. Home is a separate limited-equipment consistency family; Foundation is an
    internal simple-start profile.
53. A selected program is owned and editable; source/family/version provenance
    informs, never restricts.
54. Multi-gym sibling instances preserve equipment-specific identity and
    history. Name equality never silently merges non-comparable machines.
55. One-off sessions are honest History entries and never silently rewrite or
    complete the active program.

## Managed AI

56. BYOK is superseded by managed Taurifer AI after paid-beta economics.
57. AI output is labeled, evidence-linked, user-approved, and subordinate to
    deterministic rules; it never mutates history or diagnoses injury.
58. PT-BR adult Preview earns release before English; Preview is not a general
    Pro purchase promise.
59. Provider retention is zero; providers/models/knowledge are evaluated,
    versioned, staged, disclosed, and reversible.
60. AI text never enters PostHog. Improvement/research use is separately
    consented, redacted, access-separated, pseudonymous, and deletable.

---

# 30. Recommended north-star statements

## Company-level thesis

> **Taurifer is a progression-first hypertrophy and strength-training system
> built initially for Brazil. It turns an athlete's goals and constraints into
> a structured program, progresses it transparently, and uses what actually
> happened to adapt the block and decide what should come next.**

## Consumer proposition

> **Get the right program. Know what to do next.**

Alternative:

> **Follow your program. Know what to do next.**

The first better communicates owned generation.

The second better communicates program respect.

Final copy testing should determine which converts better.

## Product thesis

> **A training log should not merely remember what you did. It should make the next session clearer.**

## Free/Pro thesis

> **Free gets you training and keeps you progressing. Pro personalizes the bigger picture.**

Internal framing, not final marketing copy. Structurally: Free generates or
selects a solid Taurifer program, or creates/imports/receives another one,
executes it completely, exposes supported progression strategies, completes
the block, and reviews what happened. Pro specializes the first program,
detects recurring structural mismatch during it, and uses complete or partial
history to personalize what should happen next. Later Pro expands into
cross-program dashboards, multi-block planning, sync, and managed Taurifer AI
after the paid beta and its release gates.

## Creator proposition

> **Turn the program you sell into a product your clients actually train with.**

## Data principle

> **Your training record is yours. Taurifer works local-first. Cloud sync is optional.**

---

# 31. Current quantitative scorecard

These are **hypotheses to validate**, not promises.

| Variable | Working hypothesis |
|---|---:|
| Brazil population | 213.4M |
| Broad gym/strength population | ~10–19M |
| Behavioral SAM share | 20–35% assumption |
| Behavioral SAM | ~2.0–6.5M |
| Annual price | R$179.90 base |
| Monthly price | R$24.90 |
| Store fee model | 15% |
| Variable service reserve | R$10/year illustrative |
| Annual contribution at R$179.90 | ~R$142.92 |
| Contribution LTV @ 40% renewal | ~R$238 |
| Contribution LTV @ 50% renewal | ~R$286 |
| Contribution LTV @ 60% renewal | ~R$357 |
| 3× CAC ceiling @ 40% renewal | ~R$79 |
| 3× CAC ceiling @ 50% renewal | ~R$95 |
| 3× CAC ceiling @ 60% renewal | ~R$119 |
| Activation target | >60% establish program |
| First workout target | >50% within 72h |
| 30-day training target | >50% complete ≥6 workouts |
| D60 active target | >30% |
| Retained free→paid target | 5–10% |
| Annual renewal target | ≥50% |
| 50k subscribers gross ARR | ~R$9.0M |
| 100k subscribers gross ARR | ~R$18.0M |

---

# 32. What must be learned before scaling

The next phase should not be "build everything in this document."

It should answer the highest-risk questions.

## Question 1

> **Do users materially prefer Taurifer's progression/execution loop to existing alternatives?**

## Question 2

> **Does generator-first onboarding outperform Taurifer templates for
> acquisition/activation while retaining equally well?**

## Question 3

> **Will users pay R$24.90/month or R$179.90/year for working advanced
> generation, bounded adaptation, and history-aware transition?**

## Question 4

> **Do creator-shared programs produce lower-CAC users who remain after the original program ends?**

## Question 5

> **Does within-block adaptation create recurring value between program
> transitions, rather than encouraging subscribe-generate-cancel behavior?**

If those answers are positive, the company thesis is strong.

If they are negative, feature expansion should stop until the underlying problem is understood.

---

# 33. Final investment view

The strongest version of Taurifer is not:

- a Brazilian copy of Alpha Progression;
- a prettier Hevy;
- an AI personal trainer;
- a privacy-first workout notebook;
- software for Instagram coaches;
- software for local gyms.

It is:

> **A consumer strength-training system that owns the entire loop from program creation to progressive execution, while remaining equally capable of running a program the athlete already trusts.**

Brazil creates a credible beachhead because of:

- scale;
- language;
- mobile penetration;
- local pricing opportunity;
- creator distribution;
- lack of an obviously entrenched Portuguese-first category leader with Taurifer's exact product philosophy.

But the category is already competitive.

Taurifer therefore has to win on execution.

The venture-scale path is not based on one secret algorithm.

It is based on compounding:

> **better product → retention → history → trust → creator distribution → cheaper acquisition → more users → more programs → stronger brand/format → international expansion.**

The first milestone is not venture scale.

It is much simpler:

> **Can Taurifer become indispensable to a few thousand Brazilian lifters?**

If yes, 50,000–100,000 paying subscribers is not an absurd outcome.

If no, no TAM slide will save the product.

---

# Appendix A — Source register

## Internal Taurifer sources

1. [README — current product capabilities and local-first model](https://github.com/pedrochagasmaster/repforge/blob/main/README.md)
2. [CONTEXT — domain model including Capacity, programs, blocks, Coach concepts](https://github.com/pedrochagasmaster/repforge/blob/main/CONTEXT.md)
3. [Brand guide — identity, ethos, voice, local-first posture](https://github.com/pedrochagasmaster/repforge/blob/main/docs/brand-guide.md)
4. [Plans index — implemented and planned product work](https://github.com/pedrochagasmaster/repforge/blob/main/plans/README.md)

## Market/demographic sources

5. [IBGE — 2025 Brazilian population estimate](https://www.ibge.gov.br/a-populacao-brasileira)
6. [EF English Proficiency Index — Brazil, 2025](https://www.ef.com/saen/epi/regions/latin-america/brazil/)
7. [Statcounter — Brazil mobile OS share](https://gs.statcounter.com/os-market-share/mobile/brazil)
8. [Brazil Chamber of Deputies — PL 21/2025, ~19M musculação claim](https://www.camara.leg.br/proposicoesWeb/prop_mostrarintegra?codteor=2924221&filename=Avulso+PL+21%2F2025)
9. [LiftCodex secondary IHRSA-based membership compilation](https://liftcodex.com/statistics/gym-membership-statistics/)

## Competitors

10. [Hevy — homepage / 15M+ athletes](https://www.hevyapp.com/)
11. [Hevy — Brazil App Store pricing/localization](https://apps.apple.com/br/app/hevy-treino-de-academia-gym/id1458862350)
12. [Hevy — personalized program generator](https://www.hevyapp.com/use-cases/personalized-program-app/)
13. [Hevy — routine/folder sharing](https://www.hevyapp.com/features/share-folders-routines/)
14. [Gravl — Brazil App Store pricing/features](https://apps.apple.com/br/app/gravl-personal-trainer-com-ia/id6450921637)
15. [Alpha Progression — Brazil App Store pricing/features](https://apps.apple.com/br/app/muscula%C3%A7%C3%A3o-alpha-progression/id1462277793)
16. [MacroFactor — subscription pricing](https://help.macrofactorapp.com/en/articles/393-how-macrofactor-subscriptions-and-bundles-work)
17. [MacroFactor — Smart Progression](https://help.macrofactorapp.com/en/articles/305-understanding-and-using-smart-progressions)
18. [MacroFactor — Smart Progression with custom programs](https://help.macrofactorapp.com/en/articles/387-will-smart-progression-work-with-altered-or-customized-programs)
19. [MacroFactor — Smart Generation inputs](https://help.macrofactorapp.com/en/articles/370-what-information-does-macrofactor-workouts-use-to-generate-my-program)
20. [MacroFactor — custom periodization](https://help.macrofactorapp.com/en/articles/389-how-can-i-customize-periodization-rir-reps-and-sets-for-the-exercises-in-my-program)

## Platform economics

21. [Apple — App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/)
22. [Google — Play service fees](https://support.google.com/googleplay/android-developer/answer/112622?hl=pt-BR)

## Legal/data

23. [Brazil — Lei Geral de Proteção de Dados (LGPD)](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)

## Training-science sources for the v1.2 engine/product decisions

24. [Scarpelli et al. — individualizing weekly volume from prior training exposure](https://pubmed.ncbi.nlm.nih.gov/32108724/)
25. [Baz-Valle et al. — limits of set count as a volume measure when other variables are not controlled](https://pubmed.ncbi.nlm.nih.gov/30063555/)
26. [Plotkin et al. — load and repetition progression as viable overload strategies](https://pubmed.ncbi.nlm.nih.gov/36199287/)
27. [Kassiano et al. — systematic versus excessive/random exercise variation](https://pubmed.ncbi.nlm.nih.gov/35438660/)
28. [Bell et al. — individualized deloading and the absence of one standardized approach](https://pmc.ncbi.nlm.nih.gov/articles/PMC10511399/)
29. [ACSM 2025 position stand — goal-specific resistance-training prescription](https://pubmed.ncbi.nlm.nih.gov/41843416/)

---

# Appendix B — Fact vs assumption ledger

## High-confidence sourced facts

- Brazil's 2025 population estimate is ~213.4M.
- Brazil ranks 75/123 on EF EPI 2025 with score 482.
- Android represents roughly 78% of Brazilian mobile OS share in July 2026 according to Statcounter.
- Hevy, Gravl, and Alpha Progression currently list Portuguese support.
- Current Brazilian App Store prices include roughly:
  - Hevy R$99.90/year;
  - Gravl R$179.90/year;
  - Alpha Progression R$399.90/year.
- MacroFactor Workouts lists US$71.99/year.
- Apple's qualifying Small Business commission is 15%.
- Google's current Brazilian auto-renewing subscription fee model is 15%.

## Medium-confidence market anchors

- ~10.1M Brazilian gym members based on secondary IHRSA-based reporting.
- ~19M regular musculação practitioners in PL 21/2025, which cites IBGE POF but requires independent source-chain verification before external investor use.

## Explicit management assumptions

- 20–35% behavioral SAM factor.
- 2.0–6.5M working serviceable-user range.
- R$179.90 base annual price.
- R$10 annual variable service reserve.
- 5–10% retained-user Pro conversion target.
- 50%+ annual renewal target.
- activation/retention thresholds in the experiment plan.
- CAC ceilings derived from simplified renewal LTV model.

These should never be presented as externally validated facts.

---

# Appendix C — Financial formulas

## Net subscription revenue after store fee

`Net = Retail Price × (1 − Store Fee)`

At R$179.90 and 15%:

`R$179.90 × 0.85 = R$152.915`

## Contribution

`Contribution = Net Revenue − Variable Cost Reserve`

`R$152.915 − R$10 = R$142.915`

## Simplified renewal LTV

`LTV = Annual Contribution / (1 − Annual Renewal Probability)`

Example at 50% renewal:

`R$142.915 / 0.50 = R$285.83`

## 3× LTV:CAC ceiling

`Max CAC = LTV / 3`

Example:

`R$285.83 / 3 = R$95.28`

This is intentionally simplified and should be replaced by cohort cash-flow modeling once real data exists.

---

# Appendix D — Strategic questions intentionally left open

1. What evidence threshold should later justify revisiting the fixed
   R$24.90/month and R$179.90/year price pair?
2. Which within-block interventions produce enough recurring value to drive
   renewal?
3. How should historical imports from Hevy/Strong/CSV work?
4. Does creator acquisition outperform organic/direct paid acquisition?
5. Should creator attribution remain text-only until hosted program aliases exist?
6. When does optional sync become necessary for trust rather than merely convenience?
7. How should Brazil-first PT-BR copy diverge from English rather than mirror it?
8. Which bounded block profiles should each hypertrophy/general-strength
   Taurifer family support?
9. What exact definition of "active user" will be frozen before launch measurement?
10. Which versioned detector thresholds and observation windows are credible
   for each progression strategy?
11. At what scale does Taurifer introduce a real backend for publishing, attribution, sync, and commerce?
12. What proof threshold would justify any gym/enterprise pivot?
13. What evidence would justify a marketplace?
14. What is the minimum product quality required before paid acquisition begins?
15. What numeric provider, safety, privacy, quality, latency, cost, and support
    thresholds will be frozen before Taurifer AI Preview?
16. What published ordinary-question and program-review allowances follow from
    the measured provider bake-off and representative user journeys?

Questions 15–16 are evaluation outputs under the fixed §16 constitution, not
permission to revisit managed service, PT-BR-first release, zero provider
retention, or the research/telemetry separation.

---

# Appendix E — One-page thesis

**Who:** Primarily self-directed Brazilian intermediate lifters who want a
coherent hypertrophy or general-strength program and expect performance to
change what happens next; Taurifer also supports ambitious beginners and
advanced external-program users.

**Problem:** Existing loggers remember what happened; generated-program apps often require users to accept the app's programming philosophy; static programs do not interpret actual performance.

**Solution:** Taurifer generates a structured program, offers original
Taurifer templates, or executes one the athlete already trusts; it then uses
real logged performance to clarify the next target, repair recurring mismatch,
and decide what should follow the program.

**Free:** A capable baseline generator, basic muscle emphasis, Taurifer
templates, supported manual progression strategies, and complete current-
program execution including safety handling, block review, factual transition
retrospective, and Free export.

**Pro:** Advanced first-program specialization, bounded within-block
adaptation, and history-aware next-program generation from complete or partial
history. Later: cross-program dashboards, multi-block planning, optional sync,
and managed Taurifer AI after paid-beta economics and independent release
gates. Never control over the engine's conclusions.

**Sequencing:** A noncommercial rolling program-based alpha validates the execution
loop on the web core. Payment waits for the working three-job Pro MVP and a
real entitlement lifecycle. Native Android/iOS remains an evidence-triggered
wrap of the tested core, not a greenfield rewrite.

**Price hypothesis:** R$24.90/month or R$179.90/year.

**Brazilian SAM hypothesis:** 2.0–6.5M behavioral users.

**GTM:** Direct B2C + creator-led B2B2C acquisition.

**Creator role:** Distribution, not core SaaS buyer.

**Enterprise:** Explore, do not build without paid evidence.

**Moat today:** None that should be overstated.

**Potential moat later:** history + interpretation + habit + portable programs + creator distribution.

**Primary KPI:** retained active trainees, not downloads.

**Primary business test:** Can Taurifer convert and retain enough serious Brazilian lifters to support 50k–100k paid users with healthy LTV:CAC?

**North-star proposition:**

> **Get the right program. Know what to do next.**
