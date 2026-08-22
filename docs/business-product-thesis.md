# Taurifer Business & Product Thesis

**Version:** 1.1  
**Date:** August 22, 2026  
**Status:** Strategic source of truth. v1.1 incorporates the decisions ratified in the 2026-08 strategy session, recorded in [ADR 0010](adr/0010-product-business-thesis-and-validation-sequencing.md)  
**Primary beachhead:** Brazil  
**Business model:** B2C freemium subscription, with creator-led B2B2C distribution  
**Core category:** Progression-first strength-training software

**v1.1 amendments (see ADR 0010 for rationale):** the no-clawback clock starts at the commercial-launch boundary and today's PWA is a pre-commercial prototype; a capable baseline program generator is committed to the launched Free floor and §8.4 Variant A is removed; the Free/Pro generator boundary is capability-based; analytical independence is a constitutional principle; native Android/iOS moves from Phase 1 to Phase 2 behind evidence triggers, and Phase 1 is market validation on the existing web core; the eventual native architecture is wrap-not-rewrite (progressive native enhancement); pilot monetization experiments must not accidentally start the launch clock; browser-backed persistence is an accepted, mitigated Phase 1 risk. From the validation-backlog review: an experimental paywall (behind a billing-agnostic capability abstraction) is P0 Phase 1 work — production subscription infrastructure, not the paywall, is what Phase 2 defers; §22 carries the explicit P0/P1 validation backlog and §18.2 splits Phase 1 validation monetization from Phase 2 commercial infrastructure; publisher attribution is approved but unimplemented, and its implementation must respect ADR 0007's immutable payload contracts via an explicit compatible versioning path.

---

## Executive summary

Taurifer should be built and launched as a **progression-first strength-training system for people who want to train from a structured program and progressively improve their performance over time**.

The company should own both sides of that experience:

1. **Program creation:** Taurifer can build a structured program around the athlete's goals, experience, schedule, equipment, preferences, and constraints.
2. **Program execution and progression:** Taurifer can also execute a program the athlete already trusts—self-authored, imported, received from a coach or creator, or eventually purchased elsewhere—and use actual logged performance to clarify what to do next.

The strategic proposition is therefore broader than "bring your own program" and narrower than "AI personal trainer":

> **Give me the right program—and make every session tell me what comes next.**

The product's behavioral loop is:

> **Program → execute → observe → interpret → next target → repeat.**

Taurifer's daily value should come from deterministic training logic, not from a chatbot. The athlete logs what actually happened—load, reps, effort/RIR, substitutions, session context—and Taurifer turns that into clear next targets while preserving the structure and intent of the active program.

The initial business should be **B2C freemium**. The primary intended revenue engine is **Taurifer Pro**, not coach SaaS, gym-management software, or white-label deployments.

The free product should remain genuinely useful and complete:

> **Free gets you training and keeps you progressing. Pro personalizes the bigger picture.**

(Internal framing, not final marketing copy.)

Everything needed to execute the current program—from creation/import/receipt through logging, progression guidance, substitutions, history relevant to that program, and end-of-block review—is part of the permanent free floor from commercial launch onward. The launched Free floor also includes a **capable baseline program generator** (§8.2–§8.3): the Free product must be able to take somebody from "I want to start training properly" to "here is my structured program; let's train" without payment.

Taurifer Pro should provide immediate and compounding intelligence beyond the normal current-program loop:

> **Pro can build a program around you—and understand your training across programs, time, and devices.**

The initial Pro thesis includes:

- advanced, history-informed program generation (the baseline generator is Free);
- advanced generation controls and future next-block generation;
- cross-program and multi-block analysis;
- long-horizon progression intelligence;
- pattern/stagnation detection across months or years;
- optional cross-device synchronization;
- future higher-order AI analysis grounded in the athlete's history.

The no-clawback rule is constitutional, and it binds from the commercial-launch boundary:

> **From commercial launch onward, anything Taurifer releases as part of Free remains part of the free floor. Pro evolves by addition, never by subtraction from that floor.**

The no-clawback floor becomes binding when Taurifer publicly launches its production Free/Pro offering and represents those capabilities to users as the stable product contract. Pre-commercial prototypes, betas, development builds, and preview deployments—including today's GitHub Pages PWA—do not define the permanent free floor. User ownership of existing records and free export are protected regardless of launch status (§15.2).

Two sequencing principles are also constitutional (§22, §29):

> **Validation before platform hardening.** Native Android/iOS is the intended commercial destination, not a prerequisite for proving product-market fit. Phase 1 validates the market and business model on the existing web core.

> **Analytical independence.** Taurifer's deterministic training outputs are never altered by commercial interests (§16.3, §29).

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
- **Initial annual Pro price hypothesis:** **R$179.90/year**, with testing around R$149.90–R$199.90.
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
5. **Monetization:** retained users will pay for generation, cross-program intelligence, and premium continuity.
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

## 1.2 The two valid entry paths

Taurifer should explicitly own two entry paths.

### Path A — "Build my program"

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

Taurifer then produces a structured, editable program.

The key design principle is:

> **Generation creates a proposal, not a prison.**

The user should be able to inspect and edit the generated program.

Taurifer should not require the user to surrender agency in order to benefit from progression intelligence.

### Path B — "I already have a program"

The athlete already has a program from:

- themselves;
- a coach;
- an online creator;
- a PDF;
- a spreadsheet;
- a book;
- a community program;
- another app.

They can:

- build it manually;
- import it;
- accept a shared Taurifer setup;
- eventually migrate it from another platform.

Once activated, the same execution/progression engine applies.

### Why both paths matter

Owning both paths increases the addressable market.

A "bring your own program" product primarily targets users already sophisticated enough to arrive with programming.

A generation-only product primarily targets users willing to delegate programming.

Taurifer can serve both:

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

> **A person who wants to train from a structured multi-week resistance-training program and cares whether their performance is progressing.**

This is better than simply saying "intermediate lifter."

The user may be:

- an ambitious beginner;
- a recreational bodybuilder;
- a serious hypertrophy trainee;
- a self-programming intermediate;
- a person following an online coach;
- a purchaser of a creator's program;
- a strength-focused general gym user.

What matters is that training is **programmatic**, not random.

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

The current internal concept of **Capacity** is strategically useful: the app can interpret performance using load, performed reps, and trusted RIR rather than treating a rep-range threshold as the entire training model.

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
- preferred movements;
- excluded movements;
- muscle-group priorities;
- set-volume tolerance/preferences;
- split preference;
- progression style where appropriate;
- deload/block-length preferences.

### Generator design principle

> **Generate a complete good default, then expose exactly the controls the user needs to customize it.**

Avoid an onboarding questionnaire so long that it becomes a programming course.

### The Free/Pro generation boundary is capability-based

A capable baseline generator is part of the launched Free floor (§8.2). The boundary between Free and Pro generation is drawn by capability, not by artificial scarcity. Avoid restrictions such as one generated program ever, N generations per month, only one regeneration, or intentionally worse exercise selection: those create artificial scarcity around a computationally cheap feature and make Free feel crippled.

The distinction is:

> **Free can build you a good program. Pro can build a program around you and what Taurifer has learned about your training.**

See §8.3 for the concrete capability split and §8.4 for the experiment that locates the exact line.

## 7.4 Generated and external programs must converge

After activation, Taurifer should not create a permanent hierarchy:

- "smart Taurifer program";
- "dumb imported program."

All programs should be able to use the same progression and execution engine when they contain the required semantics.

This is critical to the positioning.

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
- manual program creation;
- program import;
- shared-program acceptance;
- active workout logging;
- load/reps/RIR or effort logging;
- previous-session context;
- progression recommendations already part of the free product;
- rest timers;
- substitutions;
- warmup/working-set behavior already shipped;
- history needed to understand the current program;
- session summaries;
- current block/mesocycle review;
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

with a sensible default split, sensible exercise selection, sets/reps/RIR structure, and normal Taurifer progression logic. The result should be good enough that the Taurifer name belongs on it. Free also creates/imports/receives programs, executes them completely, gives progression guidance, completes the block, and reviews what happened.

### Taurifer Pro — advanced programming intelligence and continuity

Capabilities where personalization or longitudinal intelligence materially changes the answer:

- muscle-group priorities;
- detailed exercise preferences;
- volume tolerance/preferences;
- more sophisticated movement constraints;
- advanced split/structure controls;
- advanced periodization controls;
- specialization blocks;
- detailed exercise-volume allocation;
- history-informed program generation;
- automatic next-block generation;
- using previous blocks to determine what should change;
- multi-block planning;
- cross-program lift analysis;
- multi-block trends and program-to-program comparisons;
- long-horizon capacity/performance trends;
- recurring stagnation detection;
- optional synchronization/cross-device continuity;
- eventually higher-order AI-assisted analysis of the training career.

The distinction:

> **Free can build you a good program. Pro can build a program around you and what Taurifer has learned about your training.**

## 8.4 The generation-boundary experiment

Baseline generation is Free (§8.2), so the launch experiment is **not** whether Free users can generate at all. The former Variant A ("generation requires Pro") is removed from the viable experiment set.

The experiment is:

> **How much personalization and intelligence can Free generation provide before the marginal value properly belongs to Pro?**

Test where the baseline/advanced line sits — which generator inputs, controls, and history-informed behaviors convert best as Pro while keeping Free generation genuinely good.

The thesis does not require deciding this by intuition. Test it.

### Pilot monetization must not accidentally start the launch clock

Phase 1 pricing/paywall tests must explicitly be described as pilot, beta, experimental, founding-user, or early-access offers whose feature boundaries may change before commercial launch. Experimenting with willingness to pay does not establish the permanent Free/Pro contract merely because money changes hands. What starts the clock is Taurifer publicly representing a stable production tiering contract as the launched product.

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
| Taurifer hypothesis | **R$149.90–R$199.90** | **~R$24.90** initial hypothesis | Progression-first system |

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

## 9.3 Price testing

Test annual pricing at minimum around:

- R$149.90;
- R$179.90;
- R$199.90.

Do not optimize only for conversion.

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
- trial conversion;
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
2. schema-driven events are preferred to indiscriminate autocapture;
3. pseudonymous longitudinal IDs are acceptable when genuinely useful;
4. analytics should never quietly reconstruct the workout database.

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
- trial/paywall/subscription events;
- app version/platform/language.

Avoid transmitting into normal analytics:

- full workout history;
- exact program payloads;
- workout notes;
- custom free-text exercise names;
- detailed longitudinal set records;
- raw setup payloads.

The business question should determine the event.

Do not collect data merely because a tool makes it easy.

## 15.5 LGPD

Brazil's LGPD defines personal data broadly and considers health-related data sensitive when linked to an individual.

Source: [Brazil — Lei Geral de Proteção de Dados, Law 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)

This means telemetry, sync, and future AI features require deliberate legal/product design.

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

## 16.2 Appropriate future AI role

AI is better suited to Pro questions that cross long histories:

- "Compare my last three blocks."
- "Why does my incline press keep stalling?"
- "Which exercises have produced the most sustained progress?"
- "What changed after I moved from four to five days per week?"
- "Suggest the next block based on my last year."

The AI layer should be:

- grounded in deterministic context;
- inspectable;
- advisory;
- never silently mutating history;
- explicit when proposing program changes.

## 16.3 Analytical independence

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
- onboarding activation.

## 18.2 Tier 1 — monetization

Monetization work splits by phase; optional synchronization is **not** a prerequisite for Phase 1 monetization.

### Phase 1 validation monetization (P0 in the validation backlog, §22)

- experimental Free/Pro capability layer — a narrow capability/entitlement abstraction, not coupled to any billing vendor;
- a real Taurifer Pro paywall surface in the PWA, explicitly pilot/early-access framed;
- pricing experiments;
- checkout/purchase-intent measurement;
- lightweight/manual entitlement where useful;
- the advanced-generation boundary experiment (§8.4).

### Phase 2 commercial infrastructure (deferred until the evidence gates, §22)

- production subscription management;
- StoreKit / Google Play Billing;
- robust cross-device entitlement;
- production synchronization architecture;
- the long-horizon analysis foundation grows with Phase 3 retention work.

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
- next-block intelligence;
- richer periodization tools.

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

## 20.4 H4 — Program generation creates value

**Claim:** Owning program creation increases activation and/or monetization.

Compare cohorts:

### Generated-program users

vs

### Bring-your-own users

Measure:

- generator completion;
- program activation;
- first workout;
- workouts in first 30 days;
- D30/D60 retention;
- paywall exposure;
- trial start;
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
Bring-your-own users retain much better.

**Interpretation:** externally authored program execution may remain the core wedge even if generation monetizes.

### Outcome D
Generation does not improve conversion.

**Interpretation:** do not over-invest in direct Alpha/Gravl competition.

## 20.5 H5 — Pro willingness to pay

**Claim:** generation + long-horizon intelligence + continuity produce enough paid conversion.

Initial target:

> **5–10% of retained activated users convert to paid Pro**

This should be measured after sufficient paywall/product iteration.

If sustainably below ~5% after credible iteration, the monetization thesis deserves serious reassessment.

## 20.6 H6 — Renewal

Annual renewal is the strongest long-term PMF signal.

Target:

> **≥50% annual renewal**

A 50%+ renewal level materially improves LTV and supports scalable paid acquisition.

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
15. paywall/trial;
16. paid Pro;
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

Validate the funnel: acquisition → program activation → first workout → repeated training → retention → monetization intent.

Priorities:

- the baseline vs advanced generator boundary (§8.4);
- generator quality;
- onboarding;
- workout/session UX;
- deterministic progression clarity;
- telemetry and funnel instrumentation;
- creator/publisher attribution;
- shared-program handoff;
- pricing/paywall experiments (as pilot offers — see below);
- historical import where useful for activation;
- recruiting real Brazilian users;
- creator pilots;
- D7/D30/D60 measurement;
- generated vs external-program cohort analysis;
- post-program retention.

The objective is not to maximize technical polish. It is to eliminate the largest business uncertainties as cheaply and quickly as possible. During Phase 1, the PWA is the primary validation product, not a preview channel.

### Phase 1 validation backlog

The concrete implementation backlog, in priority order.

#### P0 — before meaningful quantitative external testing

**A. Telemetry and cohort attribution**

- pseudonymous installation identifier;
- acquisition/referral source;
- explicit schema-driven funnel events;
- generated/manual/import/shared cohort;
- activation and workout milestones;
- D7/D30/D60 definitions frozen before reading results.

**B. Pilot data-safety mitigations**

The browser-persistence mitigations listed under "Accepted Phase 1 risk" below: persistent-storage request, backup/export prominence, explicit beta/pilot durability language — and no major PWA-storage infrastructure project.

**C. Free/Pro capability abstraction and an experimental paywall**

This is P0 validation work, not a later production feature. The thing deferred to Phase 2 is production subscription infrastructure, **not the paywall**:

> **Validate the commercial proposition before building the commercial infrastructure. A real paywall is part of validating the commercial proposition.**

Build a narrow capability/entitlement abstraction so product code asks conceptually — `hasCapability("advanced_generation")`, `hasCapability("history_informed_generation")` — and is never coupled directly to StoreKit, Google Play, or a future billing vendor.

Then implement a real Taurifer Pro paywall surface in the PWA, supporting:

- explicit pilot/early-access framing;
- a real price hypothesis (test R$149.90 / R$179.90 / R$199.90 annual);
- paywall-view measurement;
- the trigger/capability that opened the paywall;
- CTA measurement;
- stable experiment assignment for price/variant;
- generated-vs-BYO cohort comparison.

The first iteration may use a fake-door/end-of-flow intent result if necessary, but move toward real payment evidence quickly. At small pilot scale, acceptable payment implementations include a simple web checkout, manual/lightweight entitlement after purchase, and founding-user activation. Not needed yet: StoreKit, Play Billing, automated subscription lifecycle, production receipt validation, a sophisticated billing backend, or cross-device entitlement architecture.

Some advanced Pro capabilities do not need to be fully implemented before their demand is tested: a locked advanced generator control (for example, muscle priorities) can legitimately open the experimental Pro paywall and measure demand before the optimizer behind it is deeply built. But the baseline generator remains genuinely capable and Free — do not manufacture scarcity (§8.3).

#### P0 — before creator pilots

**D. Publisher/referral attribution**

- publisher name;
- handle;
- program description;
- stable attribution/referral identifier;
- creator-specific acquisition events.

Required to test creator CAC and retention cleanly. Implementation must respect ADR 0007's immutable payload contracts (§13.5).

#### P1 — before the first real cohorts approach program completion

**E. Program lifecycle / next-program transition**

Users need: current program → complete/archive → start another generated/manual/imported/shared program → preserve training history. Without this, H7's post-program retention cannot actually be measured.

**F. Shared-program application for existing users**

The current first-run-only setup-link rule is sufficient for initial acquisition but not for Block II / the next creator program. Ship the reviewed, non-destructive replacement/transition flow (archive the old program, never touch logs) before cohorts need it.

### Monetization validation without native IAP

"Will people pay for Taurifer Pro?" is not the same question as "have we implemented the final StoreKit and Play Billing architecture?" The experimental paywall (P0-C above) tests willingness to pay with real paywall exposure, pricing tests, trial/fake-door experiments, checkout intent, a simple web payment flow where useful, and manual or lightweight Pro entitlement for a small early cohort.

> **Do not build production-grade commerce infrastructure before validating the product being sold.**

All Phase 1 pricing/paywall tests are pilot/early-access offers with mutable pre-launch packaging and must not accidentally start the no-clawback clock (§8.0, §8.4). A small paid experiment does not itself establish the permanent Free/Pro contract — and, as documented, a broad public commercial launch cannot evade the clock by being called a beta.

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
- users demonstrate credible Pro purchase intent;
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

## Phase 3 — Retention and longitudinal Pro

Once users have enough history, add:

- cross-program insights;
- multi-block comparisons;
- long-horizon analysis.

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

- create immediate Pro value via generation;
- create compounding Pro value via cross-program intelligence and sync.

## 25.4 Pro value arrives too late

Mitigation:

- generator;
- optional sync;
- import historical data;
- faster cross-program value for migrating users.

## 25.5 Generator commoditization

Mitigation:

- generator is not the company;
- externally authored programs remain first-class;
- progression/execution loop differentiates.

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
- path: generated/manual/import/shared;
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
- trial start;
- trial-to-paid;
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

Should support explicit branching:

> **Build a program for me**

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

- build a program around your constraints;
- compare blocks;
- understand long-term progression;
- carry history across devices.

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
5. Current expertise may range from ambitious beginner to advanced lifter.
6. The common denominator is intent to follow and progress a real program.

## Product

7. Taurifer owns program generation and program execution.
8. External programs remain first-class.
9. Progression logic is deterministic first.
10. Training execution speed and reliability outrank feature breadth.
11. AI is subordinate to the deterministic product.

## Engine

12. **Analytical independence.** Taurifer's deterministic training outputs are derived exclusively from the athlete's program, training record, and declared training rules. Commercial relationships, subscription state, creator economics, marketplace incentives, advertising, and Taurifer's own revenue interests may never alter those outputs or their presentation. Commercial options may appear only as clearly separate, subordinate choices.
13. Taurifer may monetize capabilities around the engine. It may never monetize control over the engine's conclusions.

## Free

14. **Commercial-launch boundary.** The permanent Free floor is established when Taurifer publicly launches its production Free/Pro offering. Pre-commercial prototypes, beta builds, preview deployments, and development releases may change feature entitlements before that point. User ownership of existing records and free export are protected regardless of launch status.
15. From commercial launch onward, anything released as part of Taurifer Free remains part of the Free floor.
16. Taurifer Free includes a capable baseline program generator.
17. Current-program execution remains Free end-to-end.
18. Current block review remains Free.
19. Manual data export remains Free.

## Pro

20. Pro may provide advanced and history-informed program generation and advanced generation controls.
21. Pro may analyze across programs/blocks/time.
22. Pro may provide optional synchronization and cross-device continuity.
23. Pro may offer future history-grounded AI analysis.
24. Pro must add value rather than degrade Free.

## Data

25. Core training works serverless.
26. The training record remains owned and exportable.
27. Cloud sync is optional.
28. Telemetry is allowed.
29. Telemetry is intentional and schema-driven.
30. Analytics must never become a shadow workout database.

## Distribution

31. B2C subscription is the primary business model.
32. Creators are initially an acquisition channel.
33. A creator-delivered program must be executable without a second consumer paywall.
34. One Taurifer, many publishers; no default white-label forks.
35. Marketplace/fulfillment are future options, not launch dependencies.
36. Publisher presence in training surfaces is provenance, not steering; commerce/discovery stays separate and subordinate.

## Platform

37. **Validation before platform hardening.** Taurifer should not incur major native-platform complexity until external usage demonstrates that the product, retention loop, monetization thesis, or platform limitations justify it. Native is the intended production destination, not a prerequisite for proving product-market fit.
38. **Progressive native enhancement.** Once native commercialization is justified, Taurifer preserves its shared, tested training core and introduces native-backed implementations where platform-native semantics materially improve reliability, durability, distribution, monetization, or user experience. A greenfield rewrite requires evidence that this architecture cannot satisfy product requirements.

## Enterprise

39. Gyms are exploratory.
40. No major gym-specific build without paid-pilot evidence.
41. Taurifer does not become generic gym-management software.

## Brand

42. Calm, precise, non-gamified.
43. The ethos supports memorability; utility explains the product.
44. Privacy supports trust but is not the headline.
45. The product should never need theatrics to make progression feel valuable.

---

# 30. Recommended north-star statements

## Company-level thesis

> **Taurifer is a progression-first strength-training system built initially for Brazil. It can build a structured program around the athlete or execute one they already trust, then use actual training performance to make every next session clearer.**

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

Internal framing, not final marketing copy. Structurally: Free generates a solid program, or creates/imports/receives another one, executes it completely, gives progression guidance, completes the block, and reviews what happened. Pro personalizes programming more deeply, connects decisions across blocks, uses long-term history, synchronizes across devices, and understands and plans the training career.

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
| Annual price test | R$149.90 / R$179.90 / R$199.90 |
| Monthly hypothesis | R$24.90 |
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

> **Does program generation increase acquisition/activation enough to justify competing directly with Gravl/Alpha/MacroFactor?**

## Question 3

> **Will retained users pay around R$150–200/year for Taurifer Pro?**

## Question 4

> **Do creator-shared programs produce lower-CAC users who remain after the original program ends?**

## Question 5

> **Does the free product create enough habit and longitudinal data to support annual renewal rather than temporary program use?**

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

1. Where exactly does baseline Free generation end and advanced Pro generation begin? (Resolved in principle — baseline generation is Free, the boundary is capability-based, §8.3–§8.4 — but the exact line is a launch experiment.)
2. What exact annual price maximizes contribution LTV rather than first purchase conversion?
3. What level of cross-program intelligence is compelling enough to drive renewal?
4. How should historical imports from Hevy/Strong/CSV work?
5. Does creator acquisition outperform organic/direct paid acquisition?
6. Should creator attribution remain text-only until hosted program aliases exist?
7. When does optional sync become necessary for trust rather than merely convenience?
8. How should Brazil-first PT-BR copy diverge from English rather than mirror it?
9. Which training segments should generation support first: hypertrophy only, strength + hypertrophy, or broader resistance training?
10. What exact definition of "active user" will be frozen before launch measurement?
11. Which telemetry events are necessary for the first six hypotheses, and which are merely curiosity?
12. At what scale does Taurifer introduce a real backend for publishing, attribution, sync, and commerce?
13. What proof threshold would justify any gym/enterprise pivot?
14. What evidence would justify a marketplace?
15. What is the minimum product quality required before paid acquisition begins?

---

# Appendix E — One-page thesis

**Who:** Brazilian strength trainees who want structured, progressive training—whether or not they already know how to program for themselves.

**Problem:** Existing loggers remember what happened; generated-program apps often require users to accept the app's programming philosophy; static programs do not interpret actual performance.

**Solution:** Taurifer can build a structured program or execute one the athlete already trusts, then use real logged performance to make the next set/session clearer.

**Free:** A capable baseline program generator plus complete current-program execution, including progression guidance and block review. No clawbacks from commercial launch onward. Free export.

**Pro:** Advanced and history-informed generation, cross-program/long-horizon intelligence, optional sync, future history-grounded AI. Never control over the engine's conclusions.

**Sequencing:** Phase 1 validates the market on the existing web core; native Android/iOS is the commercial destination, entered on evidence (wrap the tested core, no greenfield rewrite).

**Price hypothesis:** R$179.90/year.

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
