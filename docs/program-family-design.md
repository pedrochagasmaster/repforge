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

The ledger classifies each source before a blueprint uses it. Broad concepts and research findings can constrain Taurifer's choices. Neither category supplies a program table to copy. For implementation, Taurifer's plan, decision register, strategy contracts, and reviewed fixtures are the only authority.

| Source | Source class | Permitted use | Prohibited use | Taurifer result |
|---|---|---|---|---|
| Supplied copyrighted "Powerbuilding System" PDFs described in Plan 047 | Planning inspiration only; not an implementation source, validation material, or acceptance evidence. | No direct implementation use. The already-abstracted structural ideas are expressed authoritatively in Taurifer's plan and reviewed design: explicit primary/assistance roles; supported anchor/back-off work; separate heavy/volume exposures; effort, rest, and session-time constraints; and hypertrophy assistance around strength-priority work. | Deriving schedules, prescriptions, exercise order, progression rules, fixtures, tests, or review claims; copying names, prose, tables, percentages, alternating weeks, or scheduled deloads. | Original Taurifer structures cover 2–6 days, repeat the same weekly structure for the six-week default block, use no scheduled deload, share one progression engine without family branches, and compile deterministically within bounded time and volume. |
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

Review this boundary again before a fixture changes and before a blueprint becomes executable. PDF availability is irrelevant: implementation and acceptance must be justified entirely from the authoritative Taurifer sources.

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

## Proposed allocation rule `allocation@1`

All numbers in this section need owner review. They exist so fixtures and later compiler work can discuss one exact proposal instead of hidden constants.

The rule first finds a per-session cap from structured-program maturity and the session ceiling.

| Maturity | 30 min | 45 min | 60 min | 75 min | 90+ min |
|---|---:|---:|---:|---:|---:|
| `new` | 8 | 11 | 14 | 16 | 18 |
| `some` | 9 | 12 | 16 | 19 | 22 |
| `established` | 10 | 14 | 18 | 22 | 26 |

The rule then limits the total planned working sets for the week. The weekly budget is the smaller of the per-session cap multiplied by frequency and the value below.

| Maturity | 2 days | 3 days | 4 days | 5 days | 6 days |
|---|---:|---:|---:|---:|---:|
| `new` | 16 | 24 | 28 | 32 | 36 |
| `some` | 18 | 27 | 36 | 42 | 48 |
| `established` | 20 | 30 | 40 | 50 | 60 |

These are whole-program working-set limits, not direct sets per muscle and not goals to fill. A blueprint can use fewer sets. The compiler cannot add filler work to reach a cap.

Slot bounds preserve the role hierarchy:

| Slot role | `new` | `some` | `established` |
|---|---|---|---|
| Primary | 2 to 3 | 3 to 4 | 3 to 5 |
| Volume counterpart | 2 to 3 | 2 to 4 | 3 to 4 |
| Compound assistance | 1 to 3 | 2 to 3 | 2 to 4 |
| Isolation assistance | 1 to 2 | 2 to 3 | 2 to 4 |

The allocation order is fixed:

1. Allocate each protected family-defining primary slot at its minimum.
2. Allocate minimum whole-program movement and muscle coverage.
3. Allocate volume-counterpart minima where the blueprint declares a relation.
4. Distribute remaining sets to normal assistance in blueprint order.
5. Reallocate eligible assistance toward no more than two primary muscles.
6. Trim in reverse priority order if the time model exceeds the ceiling.

A priority can move sets only among steps 4 and 5. It cannot raise the weekly budget, remove protected work, or reduce a muscle below the blueprint's minimum coverage. `ignored` removes eligible direct isolation work, while indirect compound work remains. Pain and discomfort do not use this rule.

The allocation input contains no volume-tolerance value, recent-consistency score, family-name branch, entitlement, or performed-history inference. Recent consistency can apply only the temporary re-entry rule below.

### Allocation examples

- `new`, 3 days, and 45 minutes produces a maximum of 24 weekly working sets. The raw session product is 33, so the weekly cap controls.
- `some`, 4 days, and 60 minutes produces a maximum of 36 weekly working sets. The raw session product is 64, so the weekly cap controls.
- `established`, 2 days, and 30 minutes produces a maximum of 20 weekly working sets. Both the session product and weekly cap equal 20.

## Proposed time model `time@1`

The estimator works in seconds and rounds the final result up to a whole minute. The selected session duration is a ceiling.

| Component | Proposed constant |
|---|---:|
| Working-set execution | 45 seconds per set |
| First primary-pattern warm-up | 300 seconds |
| Later primary-pattern warm-up | 180 seconds |
| Compound-assistance warm-up | 120 seconds |
| Isolation-assistance warm-up | 60 seconds |
| New commercial or full-home station | 90 seconds |
| New limited-home equipment state | 45 seconds |
| Same-station transition | 20 seconds |
| Uncertainty buffer | Greater of 300 seconds or 10% of the subtotal |

The estimator clamps preferred rest by slot role:

| Slot role | Minimum rest | Maximum rest |
|---|---:|---:|
| Primary | 120 seconds | 240 seconds |
| Volume counterpart | 90 seconds | 180 seconds |
| Compound assistance | 90 seconds | 180 seconds |
| Isolation assistance | 60 seconds | 120 seconds |

For each slot, working time is `sets * 45`. Working-set rest is `(sets - 1) * clamped preferred rest`. The first slot has no transition cost. Every later slot uses either the same-station cost or the environment's new-station cost. The warm-up allowance comes from the slot's declared class. A slot may declare `warmupClass: none` only when the preceding slot prepares the same movement pattern and the fixture says so.

The estimator sums working time, working-set rest, warm-ups, transitions, and the uncertainty buffer. It never subtracts the last rest period because the formula does not add one after a slot's last working set.

### Time examples

An established commercial-gym day has four slots with 3, 3, 2, and 2 working sets. The slots are primary, compound assistance, compound assistance, and isolation assistance. Preferred rest is 120 seconds, and every slot uses a new station.

- Working time is 450 seconds.
- Working-set rest is 720 seconds.
- Warm-up time is 600 seconds: 300, 120, 120, and 60.
- Transitions total 270 seconds.
- The subtotal is 2,040 seconds. The 300-second minimum buffer applies.
- The estimate is 39 minutes after rounding up.

The day fits a 45-minute ceiling. It does not fit a 30-minute ceiling. The compiler must use the declared trim order or return a typed compromise. It cannot report 30 minutes for the unchanged day.

A limited-home day with the same slots and sets saves 135 seconds across three equipment changes. It still uses the same rest and buffer rules.

## Foundation profile `simple_start@1`

Foundation is an internal profile for `new` maturity or an explicit request for the simplest start. It does not replace the selected family or desired result.

The proposed transformation is:

- retain every protected primary pattern and minimum whole-program coverage;
- select only candidates marked stable and low-coordination for their slot;
- use `range@1` for every slot until another Plan 046 strategy receives owner-approved fixtures;
- omit paired exposures and block-profile modifiers;
- cap each slot at two working sets;
- keep at most five slots in one session by trimming optional assistance in declared order;
- retain the blueprint's day count and the six-week block length;
- never add a scheduled deload.

Foundation is not selected from recent inconsistency alone. An established returner keeps the selected family's movement and progression complexity.

## Re-entry profile `reentry@1`

Re-entry changes only the first one or two weeks of an otherwise unchanged family instance. It does not rotate exercises, change days, remove relations, lower maturity, or alter weeks 3 through 6.

| Recent consistency | Week 1 | Week 2 | Weeks 3 to 6 |
|---|---|---|---|
| `consistent` | Normal prescription | Normal prescription | Normal prescription |
| `interrupted` | Remove one set from each reducible slot, with a minimum of one set. Keep protected primary minima. | Normal prescription | Normal prescription |
| `returning` | Remove one set from each slot, with a minimum of one set. A protected primary may fall below its normal minimum only in this week. | Restore protected primary minima. Remove one set from each reducible assistance slot, with a minimum of one set. | Normal prescription |

The proposed effort change raises target RIR by 1 in every affected re-entry week. Plan 046 must approve and encode that change as a versioned modifier before production use. If Plan 046 does not support it, the compiler must omit the effort change rather than invent a family-specific formula.

The re-entry rule never interprets performance history, schedules a deload, or permanently changes the normal allocation. `interrupted` and `returning` are broad recent-state inputs chosen in Plan 048. They are not diagnoses.

## Generated recipes for 2, 4, and 6 days

Recommend and Custom can use these recipes. They are not Browse cards by default. Each recipe owns its day roles and slot order, and all recipes use the same allocation and time models as the authored siblings.

The notation below lists ordered slot roles. A semicolon separates slots.

### `growth` recipes

| Recipe | Day | Ordered slot roles |
|---|---|---|
| `growth_2_v1` | `growth_2_d1` | knee primary; horizontal press; horizontal pull; hinge assistance; lateral deltoid; arms |
| `growth_2_v1` | `growth_2_d2` | hinge primary; vertical pull; vertical press; unilateral knee; chest assistance; hamstrings; calves |
| `growth_4_v1` | `growth_4_d1` | horizontal press; vertical pull; incline press; supported pull; lateral deltoid; triceps |
| `growth_4_v1` | `growth_4_d2` | knee primary; hinge assistance; unilateral knee; leg curl; calves |
| `growth_4_v1` | `growth_4_d3` | horizontal pull; vertical press; vertical pull; chest assistance; rear deltoid; biceps |
| `growth_4_v1` | `growth_4_d4` | hinge primary; knee assistance; hip extension; leg curl; calves |
| `growth_6_v1` | `growth_6_d1` | horizontal press; vertical pull; incline press; lateral deltoid; triceps |
| `growth_6_v1` | `growth_6_d2` | knee primary; hinge assistance; unilateral knee; calves |
| `growth_6_v1` | `growth_6_d3` | horizontal pull; vertical press; vertical pull; rear deltoid; biceps |
| `growth_6_v1` | `growth_6_d4` | stable press; supported pull; chest assistance; lateral deltoid; triceps |
| `growth_6_v1` | `growth_6_d5` | hinge primary; knee assistance; hip extension; leg curl; calves |
| `growth_6_v1` | `growth_6_d6` | supported pull; stable press; vertical pull; rear deltoid; biceps |

The 2-day form uses dense whole-body sessions. The 4-day form separates upper and lower work. The 6-day form uses shorter push-pull-lower exposures and repeats those roles with different emphasis. None is a truncated or repeated authored sibling.

### `balanced` recipes

| Recipe | Day | Ordered slot roles |
|---|---|---|
| `balanced_2_v1` | `balanced_2_d1` | knee primary; horizontal-press primary; vertical pull; hinge assistance; lateral deltoid; arms |
| `balanced_2_v1` | `balanced_2_d2` | hinge primary; horizontal-press volume; supported pull; unilateral knee; chest or back assistance; calves |
| `balanced_4_v1` | `balanced_4_d1` | knee primary; hinge assistance; unilateral knee; calves |
| `balanced_4_v1` | `balanced_4_d2` | horizontal-press primary; vertical-pull primary; supported pull; triceps |
| `balanced_4_v1` | `balanced_4_d3` | hinge primary; knee-volume exposure; leg curl; calves |
| `balanced_4_v1` | `balanced_4_d4` | horizontal-press volume; horizontal pull; vertical press; lateral and rear deltoid; biceps |
| `balanced_6_v1` | `balanced_6_d1` | knee primary; hinge assistance; unilateral knee |
| `balanced_6_v1` | `balanced_6_d2` | horizontal-press primary; vertical pull; triceps |
| `balanced_6_v1` | `balanced_6_d3` | supported pull; chest assistance; lateral and rear deltoid; biceps |
| `balanced_6_v1` | `balanced_6_d4` | hinge primary; knee-volume exposure; leg curl; calves |
| `balanced_6_v1` | `balanced_6_d5` | horizontal-press volume; horizontal pull; vertical press; triceps |
| `balanced_6_v1` | `balanced_6_d6` | unilateral knee; hip extension; vertical pull; arm assistance |

The 2-day form pairs primary work with whole-body coverage. The 4-day form gives each lower and upper primary a separate volume counterpart. The 6-day form separates assistance from primary practice to keep sessions bounded.

### `strength` recipes

| Recipe | Day | Ordered slot roles |
|---|---|---|
| `strength_2_v1` | `strength_2_d1` | knee primary; horizontal-press primary; supported pull; hinge assistance; trunk assistance |
| `strength_2_v1` | `strength_2_d2` | hinge primary; horizontal-press volume; vertical pull; knee-volume exposure; arm assistance |
| `strength_4_v1` | `strength_4_d1` | knee primary; hinge assistance; unilateral knee; trunk assistance |
| `strength_4_v1` | `strength_4_d2` | horizontal-press primary; vertical pull; supported pull; triceps |
| `strength_4_v1` | `strength_4_d3` | hinge primary; knee-volume exposure; leg curl; calves |
| `strength_4_v1` | `strength_4_d4` | horizontal-press volume; horizontal pull; vertical press; biceps |
| `strength_6_v1` | `strength_6_d1` | knee primary; hinge assistance; trunk assistance |
| `strength_6_v1` | `strength_6_d2` | horizontal-press primary; vertical pull; triceps |
| `strength_6_v1` | `strength_6_d3` | hinge volume; unilateral knee; leg curl; calves |
| `strength_6_v1` | `strength_6_d4` | horizontal-press volume; supported pull; biceps |
| `strength_6_v1` | `strength_6_d5` | hinge primary; knee-volume exposure; trunk assistance |
| `strength_6_v1` | `strength_6_d6` | vertical press; horizontal pull; chest assistance; rear deltoid; arms |

The 2-day form alternates dense primary sessions. The 4-day form separates lower and upper primary and volume work. The 6-day form limits each primary day to one main stressor and reserves the final day for the hypertrophy base.

### `home` recipes

| Recipe | Day | Ordered slot roles |
|---|---|---|
| `home_2_v1` | `home_2_d1` | front-loaded knee; supported press; one-arm pull; dumbbell hinge; arm assistance |
| `home_2_v1` | `home_2_d2` | split squat; floor press or push-up; band vertical pull; hip extension; lateral deltoid; calves |
| `home_4_v1` | `home_4_d1` | front-loaded knee; supported press; unilateral knee; triceps |
| `home_4_v1` | `home_4_d2` | one-arm pull; dumbbell hinge; band vertical pull; biceps |
| `home_4_v1` | `home_4_d3` | split squat; floor press or push-up; lateral deltoid; calves |
| `home_4_v1` | `home_4_d4` | hip extension; supported row; leg curl pattern; arm assistance |
| `home_6_v1` | `home_6_d1` | front-loaded knee; supported press; triceps |
| `home_6_v1` | `home_6_d2` | one-arm pull; dumbbell hinge; biceps |
| `home_6_v1` | `home_6_d3` | split squat; floor press or push-up; lateral deltoid |
| `home_6_v1` | `home_6_d4` | hip extension; supported row; leg curl pattern |
| `home_6_v1` | `home_6_d5` | squat pattern; incline or floor press; calves |
| `home_6_v1` | `home_6_d6` | band vertical pull; band row; arm assistance |

The 2-day form minimizes total weekly setup events. The 4-day form pairs upper and lower patterns by equipment state. The 6-day form uses short sessions with no more than one equipment change per day.

### Coverage and fixed-week rules

Every family now has one structure for each frequency from 2 through 6 days. The compiler repeats the selected weekly structure for all six default weeks. Recipes cannot contain week-specific day, slot, exercise, or deload fields.

The 2-day, 4-day, and 6-day recipes require the same owner review as the 3-day and 5-day siblings. Frequency coverage does not make a recipe public or eligible for Browse.

## Fixture contract

[`test/fixtures/program-families-v1.json`](../test/fixtures/program-families-v1.json) is the machine-readable Wave 1 design. [`test/program-family-fixtures.mjs`](../test/program-family-fixtures.mjs) validates it without a browser or application state.

The compact fixture derives stable IDs as follows:

- A day ID removes `_v1` from the blueprint ID and adds `_dN`, where `N` is the one-based day position.
- A slot ID adds `_sN` to the day ID, where `N` is the one-based slot position.
- Each slot token resolves through `slotContracts` to one role, movement-pattern set, muscle set, substitution class, proposed strategy, priority behavior, warm-up class, transition class, and `libraryId` requirement.
- Each role and strategy pair resolves through `rules.prescriptions.byRoleAndStrategy` to one proposed prescription profile.
- Paired relations refer to zero-based day and slot positions in one immutable blueprint version. The validator resolves those positions to the derived stable slot IDs.

The compact form is a Wave 1 authoring fixture, not the production `program-blueprints.js` schema. Production compiler work may change the encoding only with a versioned migration and equivalent invariant coverage.

## Synthetic fixed-structure outputs

These examples prove schedule semantics, not training outcomes. A future compiler must add selected exercises, exact time estimates, allocation summaries, and deterministic fingerprints.

| Example | Pinned input | Expected structural output |
|---|---|---|
| `balanced_3_six_week` | `balanced_3_v1`, one six-week block | Three derived day IDs repeat in the same order for 6 weeks. The schedule contains 18 planned sessions. No week rotates a slot or schedules a deload. |
| `home_5_fifty_two_week` | `home_5_v1`, 52 weeks of pinned blocks | Five derived day IDs repeat inside each block. The span contains 8 complete six-week blocks and 4 trailing weeks, or 260 planned sessions if no session is skipped. No block update silently changes a pinned structure. |

The 52-week example does not prescribe uninterrupted training or eight automatic renewals. It tests the arithmetic and fixed-structure rule across a long horizon.

## Known compromises

| Decision | Accepted compromise | Rejected alternative |
|---|---|---|
| Four initial families | The set covers the three desired results plus limited-home consistency. It does not add a public high-volume family. | A larger catalogue would add names before Taurifer can support and test distinct promises. |
| Complete frequency coverage | Recommend and Custom have 2-day through 6-day recipes, while Browse remains disabled in the fixtures. | Showing incomplete Browse cards would represent work that does not yet execute. |
| Strength scope | Strength uses general primary patterns and retains hypertrophy work. | Competition-lift percentages, peaking, tapering, and attempt selection exceed the product scope. |
| Home equipment | Home assumes adjustable dumbbells, bands, bodyweight options, and optional stable support. | Treating every home location as limited equipment would misroute full-home gyms. |
| Foundation | Foundation reduces coordination and prescription variety while retaining the selected family's coverage. | Sending every inconsistent or returning athlete to a beginner program would discard relevant maturity. |
| Re-entry | The proposed rule changes only one or two weeks and restores the normal prescription by week 3. | A scheduled deload or permanent volume downgrade would confuse current consistency with training maturity. |
| Progression references | Fixtures name the proposed Plan 046 contracts so incompatibility is visible now. All families remain `browse: false`. | A family-specific engine or silent fallback would hide an unresolved dependency. |

## Owner review inventory

No item in this section is approved merely because the fixture validator passes.

### Public names and copy

The owner must approve or replace all four English and PT-BR name pairs: Build Muscle and Ganhar massa, Muscle + Strength and Massa + força, Strength Priority and Prioridade em força, and Home Momentum and Ritmo em casa. The owner must also approve the promise and non-goal copy before Plan 048 exposes it.

### Numeric fixtures

The owner must approve or amend:

- all per-session and weekly working-set caps in `allocation@1`;
- every slot-role set bound by maturity;
- the working-set, warm-up, transition, rest-bound, and buffer constants in `time@1`;
- every set count, rep range, total-rep goal, and target-RIR range in `rules.prescriptions`;
- the two-set and five-slot Foundation caps;
- every re-entry set delta, target-RIR delta, and restoration week;
- all slot orders and every paired-relation member in the 20 blueprints.

### Science and product implementation decisions

The owner must confirm:

- whether the proposed family structures and coverage maps express each promise;
- whether the proposed whole-program volume caps are conservative enough for alpha;
- whether each family uses the right primary, volume-counterpart, compound-assistance, and isolation-assistance mix;
- whether Home's equipment assumptions and loading-granularity behavior are credible;
- whether Foundation preserves enough work while reducing coordination burden;
- whether the one-week `interrupted` and two-week `returning` treatments are appropriate;
- whether strength and balanced blueprints use anchor and paired exposures in the right slots;
- whether the six-week and 52-week structural examples are sufficient for the compiler handoff.

### Plan 046 interface status

Plan 046 PR #193 published `docs/progression-strategy-contract.md`, locked executable range parity fixtures, pure capacity primitives, and a deterministic `range@1` engine through commit `1dac9ab`. That branch has not merged to `main`.

Only the locked `range@1` behavior is implemented. The Plan 046 contract marks `rep_goal@1`, `anchor_backoff@1`, the first `paired_exposure@1` combination, and all numeric block modifiers as pending owner review. Plan 047's `reentry@1` modifier proposal is not an approved Plan 046 modifier.

Therefore all 20 family fixtures remain `browse: false`, and production compiler work is blocked. Before Slice 2 or later compiler work begins:

1. Merge the stable Plan 046 contract to `main`.
2. Merge current `origin/main` into this branch with an explicit merge commit.
3. Replace each unapproved strategy or relation with an owner-approved contract, or use an honest compatible `range@1` or `manual@1` prescription.
4. Update the fixture's interface-status metadata and validator in the same commit.
5. Re-run the fixture validator and Plan 046 compatibility tests.

## Production compiler handoff

Wave 2 starts with the explicit program-day and provenance model, not compiler code. Follow this order:

1. Add stable day containers and legacy day-string migration after Plan 046's persistence shape stabilizes.
2. Preserve family, blueprint, compiler, allocation, time, catalogue, context-schema, and strategy versions through state, archive, backup, import, and shared setup.
3. Define a production schema that expands each compact fixture slot into a frozen record with the derived ID and all selection and prescription fields.
4. Build the dependency-free compiler against injected catalogue and rule snapshots.
5. Require every selected exercise to retain its current `libraryId`. Never fuzzy-match a display name or repoint an old library ID.
6. Compile the fixture coverage matrix before enabling one family for Browse.
7. Add deterministic six-week and 52-week simulations with real engine results.

Do not modify `app.js`, onboarding, or the production catalogue as part of this handoff step. Plan 048 can consume fixture services until the real compiler and persistence model land.

## Version and approval state

Stable internal family IDs are `growth`, `balanced`, `strength`, and `home`. Public names remain proposals and do not control those IDs.

Wave 1 may reference Plan 046 IDs `range@1`, `rep_goal@1`, `anchor_backoff@1`, `manual@1`, and `paired_exposure@1`, but their approval states differ. `range@1` is locked, executable, and backed by stable fixtures in PR #193. Other strategies, relations, and modifiers remain proposed and owner-gated. The production compiler must not execute an owner-gated reference, silently fall back to another strategy, or derive the missing behavior from external material. Cross-branch production integration still waits for a compatible Plan 046 contract on `main`.

The owner must approve these items before production compiler work uses them:

- the public English and PT-BR names and copy;
- every day and slot table;
- allocation and time-model constants;
- Foundation and re-entry parameters;
- every non-range strategy, relation, and modifier numeric fixture.
