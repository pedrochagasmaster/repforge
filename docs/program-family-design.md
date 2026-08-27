# Taurifer program-family design

Status: proposed Wave 1 contract for owner review. Nothing in this document is a production prescription or a public catalogue entry.

This reference defines the original Taurifer family system that later compiler work must implement. [Plan 047](../plans/047-taurifer-program-families-compiler.md) governs scope and release gates. [Plan 046](../plans/046-multi-strategy-progression-engine.md) governs progression behavior.

## Current generator audit

The current generator lives in `app.js`. It has no family, blueprint, slot, time-model, allocation-rule, or provenance contract.

| Current component | Current behavior | Replacement constraint |
|---|---|---|
| `DAY_TYPES` and `resolveSplit` | Repeats generic day-type arrays across two through six days. | Each 3-day and 5-day family needs its own authored weekly structure. The 2-day, 4-day, and 6-day paths need reviewed recipes. |
| `SESSION_BOUNDS` and `applySessionLength` | Treat session length as an exercise-count range. | The time model must include working sets, preferred rest, warm-ups, station changes, equipment friction, and a buffer. |
| `repScheme` | Selects sets and a rep range from the old experience and goal values. | Versioned allocation may use only structured-program maturity, weekly frequency, and session minutes. |
| `applyPriorityMuscles` | Adds a set to matching exercises and may add an exercise. | A priority must redistribute a bounded program budget. It cannot create an independent volume budget. |
| `catalogForSlot` and `chooseExercise` | Filters by pattern and equipment, then rotates candidates by repeated day-type occurrence. | Selection must use structured capabilities and stable ranking. It must preserve the selected exercise's `libraryId` provenance. |
| `Program.days()` and `Program.addDay()` | Infer days from exercise strings. Adding a day creates a placeholder exercise. | A compiled program needs stable day and slot IDs. Production work must wait for the explicit day model in Plan 047 Slice 2. |
| `programMeta` | Stores generator answers but discards unknown family/compiler provenance. | Activated instances must pin family, blueprint, compiler, rule, catalogue, and context-schema versions. |

The audit rejects parity with the current generator as a design goal. The old generator proves that Taurifer covers two through six training days. It does not define the new program science.

## Source and originality ledger

The ledger classifies each source before a blueprint uses it. Broad concepts and research findings can constrain Taurifer's choices. Neither category supplies a program table to copy.

| Source | Source class | Permitted use | Prohibited use | Taurifer result |
|---|---|---|---|---|
| Supplied copyrighted "Powerbuilding System" PDFs described in Plan 047 | Copyrighted structural reference. The files are not in this repository or workspace. | Broad concepts only: primary and assistance roles, an anchor with back-off work, distinct heavy and volume exposures, effort targets, practical rest/time constraints, and assistance around strength-priority work. | Names, prose, tables, exact schedule, exercise order, prescriptions, percentages, alternating weeks, or scheduled deloads. | No blueprint may be derived row by row. Fixed weekly structures and evidence-triggered deload policy override the references. |
| [ACSM progression models position stand](https://doi.org/10.1249/MSS.0b013e3181915670) | Published position stand. | General support for progressive resistance training, load/repetition ranges, exercise order, rest, and frequency as programming variables. | Treating broad recommendations as proof of one exact Taurifer slot table or threshold. | Families declare roles and progression needs. Plan 046 owns the executable method. |
| [Weekly-set dose-response meta-analysis](https://doi.org/10.1080/02640414.2016.1210197) | Published systematic review and meta-analysis. | General support for treating weekly volume as a meaningful variable. | Inferring a person's volume tolerance or copying study-group doses into a product rule. | The proposed allocation table uses conservative maturity/frequency/time bands and remains owner-gated. |
| [Resistance-training frequency meta-analysis](https://doi.org/10.1519/JSC.0000000000002855) | Published systematic review and meta-analysis. | General support for separating frequency from weekly volume and reviewing how work is distributed. | Claiming that one split or one frequency is universally superior. | Sibling blueprints distribute a family's promise differently at 3 and 5 days. Recipes cover 2, 4, and 6 days without mechanical stretching. |
| [Rest-interval systematic review](https://doi.org/10.1080/17461391.2017.1340524) | Published systematic review. | General support for modeling rest as a real time cost and prescription input. | Deriving a universal optimal rest time or ignoring exercise role and user preference. | Preferred rest feeds the time estimate within role-specific bounds. |
| [Business/product thesis](business-product-thesis.md) and [decision register](product-grilling-decision-register.md) | Taurifer product decisions. | Family set, authorship boundary, frequency coverage, Home, Foundation, re-entry, ownership, and no-volume-tolerance rules. | Reopening settled product branches inside implementation. | These decisions define the product contract in this document and the fixtures. |
| Plan 047 design work and fixtures | Original Taurifer design. | Create internal IDs, structures, slot roles, allocation proposals, time constants, profiles, and recipes. | Presenting proposed numeric choices as validated science or approved public copy. | Every proposed number and public name stays marked for owner review until approved. |

### Copyright checks

A proposed blueprint fails review if any of these statements is true:

- Its day and slot sequence can be mapped row for row to a named external program.
- It copies or closely paraphrases external names, descriptions, cues, or table labels.
- It copies exact set, repetition, load, percentage, or week-by-week prescriptions.
- It uses alternating exercise weeks or a scheduled deload from a reference.
- Its originality argument depends only on renamed exercises or reordered rows.

The repository must not contain the supplied PDFs. Review this boundary again before a fixture changes and before a blueprint becomes executable.

## Family catalogue

The proposed public names below need owner approval. The internal IDs do not depend on them.

| Internal ID | Proposed English name | Proposed PT-BR name | Promise | Explicit non-goals |
|---|---|---|---|---|
| `growth` | Build Muscle | Ganhar massa | Allocate the available week toward balanced muscle growth while retaining repeatable compound performance markers. | Strength peaking, maximal-volume training, and a strength-sport claim. |
| `balanced` | Muscle + Strength | Massa + força | Progress selected primary movement patterns while retaining substantial hypertrophy work. | Equal emphasis on every quality, competition-lift specialization, and meet preparation. |
| `strength` | Strength Priority | Prioridade em força | Prioritize general-strength primary movements while maintaining a coherent hypertrophy base. | Powerlifting, competition percentages, peaking, tapering, and attempt selection. |
| `home` | Home Momentum | Ritmo em casa | Reduce setup and equipment friction for a progressive limited-equipment program. | Treating every home trainee as new, serving a full home gym, or filtering machines out of an ordinary family. |

### Shared fit vocabulary

The fixture contract uses these closed inputs:

- Goals: `muscle_growth`, `balanced`, and `strength_priority`.
- Structured-program maturity: `new`, `some`, and `established`.
- Recent consistency: `consistent`, `interrupted`, and `returning`.
- Environments: `commercial`, `full_home`, and `limited_home`.
- Session ceilings: 30, 45, 60, 75, and 90 minutes. A 90-minute selection means 90 minutes or more.

`growth`, `balanced`, and `strength` fit `commercial` and `full_home`. `home` fits only `limited_home`. All families accept the three maturity bands. Foundation and re-entry alter the selected blueprint without changing the desired result.

## Authored 3-day and 5-day siblings

Each day-role row states structure, not an exercise list. A slot later resolves to an exercise-library entry and retains its `libraryId`.

### `growth`

The 3-day sibling uses three whole-body exposures with different local emphasis. This structure gives every major muscle group repeated weekly work when only three sessions are available.

| Day | Day role | Ordered slot roles |
|---|---|---|
| `growth_3_d1` | Knee and horizontal emphasis | knee-dominant primary; horizontal press; horizontal pull; hamstring assistance; lateral-deltoid assistance; arm assistance |
| `growth_3_d2` | Hinge and vertical emphasis | hinge primary; vertical pull; vertical press; quadriceps assistance; chest assistance; calf assistance |
| `growth_3_d3` | Mixed hypertrophy emphasis | unilateral knee; incline or horizontal press; supported pull; hip extension; rear-deltoid assistance; arm assistance |

The 5-day sibling separates upper and lower fatigue, then uses a mixed fifth day to close coverage and host bounded priorities. It does not split the 3-day rows across more calendar days.

| Day | Day role | Ordered slot roles |
|---|---|---|
| `growth_5_d1` | Upper push emphasis | horizontal press; vertical pull; incline press; supported pull; lateral-deltoid assistance; triceps assistance |
| `growth_5_d2` | Lower knee emphasis | knee-dominant primary; hinge assistance; unilateral knee; leg curl; calf assistance |
| `growth_5_d3` | Upper pull emphasis | horizontal pull; vertical press; vertical pull; chest assistance; rear-deltoid assistance; biceps assistance |
| `growth_5_d4` | Lower hip emphasis | hinge primary; knee assistance; hip extension; leg curl; calf assistance |
| `growth_5_d5` | Mixed coverage and priority | stable press; supported pull; quadriceps assistance; hamstring assistance; one priority-eligible slot; arm assistance |

### `balanced`

The 3-day sibling pairs one repeatable primary pattern with hypertrophy work in each whole-body session. Primary patterns rotate their stress across the week.

| Day | Day role | Ordered slot roles |
|---|---|---|
| `balanced_3_d1` | Knee and horizontal press | knee-dominant primary; horizontal-press primary; supported pull; hamstring assistance; lateral-deltoid assistance |
| `balanced_3_d2` | Hinge and vertical pull | hinge primary; vertical-pull primary; vertical press; unilateral knee; arm assistance |
| `balanced_3_d3` | Volume counterparts | knee-volume exposure; horizontal-press volume exposure; horizontal pull; hip extension; chest or back assistance |

The 5-day sibling gives primary and volume exposures separate days. A middle assistance day preserves hypertrophy coverage without making all five sessions primary sessions.

| Day | Day role | Ordered slot roles |
|---|---|---|
| `balanced_5_d1` | Lower primary | knee-dominant primary; hinge assistance; unilateral knee; calf assistance |
| `balanced_5_d2` | Upper primary | horizontal-press primary; vertical-pull primary; supported pull; triceps assistance |
| `balanced_5_d3` | Hypertrophy assistance | hip extension; chest assistance; horizontal pull; lateral and rear deltoid assistance; biceps assistance |
| `balanced_5_d4` | Lower volume | hinge primary; knee-volume exposure; leg curl; calf assistance |
| `balanced_5_d5` | Upper volume | horizontal-press volume exposure; vertical pull; vertical press; supported pull; arm assistance |

### `strength`

The 3-day sibling makes one movement pattern primary on each day. It spreads secondary practice so no session contains every heavy stressor.

| Day | Day role | Ordered slot roles |
|---|---|---|
| `strength_3_d1` | Knee primary | knee-dominant primary; horizontal-press volume exposure; supported pull; hamstring assistance |
| `strength_3_d2` | Horizontal-press primary | horizontal-press primary; hinge-volume exposure; vertical pull; unilateral knee assistance |
| `strength_3_d3` | Hinge primary | hinge primary; knee-volume exposure; vertical press; horizontal pull; arm assistance |

The 5-day sibling uses two primary days, two bounded volume-practice days, and one assistance day. The volume days use lower-stress prescriptions and do not become extra maximal sessions.

| Day | Day role | Ordered slot roles |
|---|---|---|
| `strength_5_d1` | Lower primary | knee-dominant primary; hinge assistance; unilateral knee; trunk assistance |
| `strength_5_d2` | Upper primary | horizontal-press primary; vertical pull; supported pull; triceps assistance |
| `strength_5_d3` | Lower volume practice | hinge primary; knee-volume exposure; leg curl; calf assistance |
| `strength_5_d4` | Upper volume practice | horizontal-press volume exposure; horizontal pull; vertical press; biceps assistance |
| `strength_5_d5` | Hypertrophy base | unilateral knee; hip extension; stable press; supported pull; lateral-deltoid assistance; arm assistance |

### `home`

The Home siblings assume adjustable dumbbells, resistance bands, a bench or stable support, and bodyweight movements. A capability correction may remove the bench. The compiler must then choose compatible floor-supported slots or return an incompatibility.

The 3-day sibling uses total-body sessions and groups equipment states to reduce changes within a session.

| Day | Day role | Ordered slot roles |
|---|---|---|
| `home_3_d1` | Dumbbell-supported total body | goblet or front-loaded knee; supported press; one-arm pull; hip extension; arm assistance |
| `home_3_d2` | Floor and band total body | unilateral knee; floor press or push-up; band vertical pull; dumbbell hinge; lateral-deltoid assistance |
| `home_3_d3` | Bench-supported total body | split squat; incline press; supported row; leg curl pattern; calf assistance |

The 5-day sibling uses shorter, focused sessions. It is authored for more frequent practice, not made by dividing the 3-day exercise count.

| Day | Day role | Ordered slot roles |
|---|---|---|
| `home_5_d1` | Knee and push | front-loaded knee; supported press; unilateral knee; triceps assistance |
| `home_5_d2` | Pull and hinge | one-arm pull; dumbbell hinge; band vertical pull; biceps assistance |
| `home_5_d3` | Low-friction mixed | split squat; push-up or floor press; band row; lateral-deltoid assistance |
| `home_5_d4` | Hip and pull | hip extension; supported row; leg curl pattern; biceps assistance |
| `home_5_d5` | Push and coverage | incline or floor press; squat pattern; band pull; calf assistance; triceps assistance |

### Sibling review rule

A sibling pair passes structural review only when all these statements are true:

- Each sibling has its own day-role IDs and ordered slot table.
- The 3-day form distributes the family promise across three complete sessions.
- The 5-day form changes fatigue distribution and exposure placement to fit five sessions.
- Removing two days from the 5-day form does not reproduce the 3-day form.
- Repeating or splitting the 3-day slot sequence does not reproduce the 5-day form.
- Both forms retain the same promise, eligible goals, equipment boundary, progression vocabulary, and six-week default.

## Version and approval state

Stable internal family IDs are `growth`, `balanced`, `strength`, and `home`. Public names remain proposals and do not control those IDs.

Wave 1 may reference the proposed Plan 046 IDs `range@1`, `rep_goal@1`, `anchor_backoff@1`, `manual@1`, and `paired_exposure@1`. Plan 046 PR #193 has not yet published a stable strategy fixture. The production compiler must not use these references until Plan 046 merges a compatible contract to `main`.

The owner must approve these items before production compiler work uses them:

- the public English and PT-BR names and copy;
- every day and slot table;
- allocation and time-model constants;
- Foundation and re-entry parameters;
- every non-range strategy, relation, and modifier numeric fixture.
