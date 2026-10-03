# Plan 065: Program generation engine overhaul (compiler 3)

- **Plan number:** 065
- **Phase:** Outside the UI overhaul programme (049–059). Engine correctness
  and coaching quality of first-program generation.
- **Status:** READY FOR EXECUTION. Every product decision is settled (owner
  interview, 3 October 2026; see *Decision log*). The implementation exists as
  a verified prototype, shipped here as `plans/065/implementation.patch`.
- **Sequencing (owner decision D18):** lands before Plan 059 freezes the alpha
  candidate, in parallel with Plan 064. It touches the engine, the exercise
  catalogue, copy strings, the app's code-to-copy table, tests, fixtures and
  docs only. Merges serialize with Plan 064 under the cache discipline in
  `docs/post-058-open-pr-clearance-sequence.md` (*Merge/cache discipline*).
- **Depends on:** nothing. **Blocks:** Plan 059's credible-first-program claim;
  the Gated *Advanced first-program generation* row.
- **Audits acted on:** [structural audit F01–F06](../docs/audits/program-generation-2026-10-03/README.md)
  and [coaching audit Q01–Q09](../docs/audits/program-generation-2026-10-03/coaching/README.md).
- **Executor profile:** written for low-cost models. Do not re-decide anything
  in this file. If reality differs from what this plan predicts, stop and
  report (see *Stop conditions*) instead of improvising.

## Contents

1. [What changes, in one paragraph](#what-changes-in-one-paragraph)
2. [Results the prototype already achieves](#results-the-prototype-already-achieves)
3. [Decision log](#decision-log)
4. [Finding disposition](#finding-disposition)
5. [Engine specification (normative)](#engine-specification-normative)
6. [Execution: PR 1, implementation](#execution-pr-1-implementation)
7. [Execution: PR 2, documentation and closure](#execution-pr-2-documentation-and-closure)
8. [Stop conditions](#stop-conditions)
9. [Known residuals and deferred items](#known-residuals-and-deferred-items)
10. [Files in `plans/065/`](#files-in-plans065)

## What changes, in one paragraph

Every built-in exercise gets an authored coaching block (the training
functions it performs, skill demand, apparatus needs, practical rep range,
Foundation suitability, heavy-anchor eligibility), so the compiler stops
guessing from equipment strings and names. Slot templates become training
jobs that require a candidate to perform one of the job's functions *as a
primary function* and to be *primary* for one of the job's muscles. Selection
fills heavy work first and then ranks every later choice knowing what the
session and week already contain. Time fitting gains floors, disclosed
accessory removal and a disclosed single-set minimum dose instead of silent
one-set compounds. Priorities add one bounded set and always report the
outcome. Returning lifters get a lighter first week on protected compounds.
Home gets three distinct coverage jobs, honest posterior work and eleven new
catalogue entries (bodyweight squat, two glute bridges, eight band exercises).

## Results the prototype already achieves

Measured on the 200 audited inputs (`test/fixtures/program-generation-corpus-v1.json`)
with `main` at `a781f83` (compiler 2) and the prototype (compiler 3).

| Metric (200 audited programs) | Compiler 2 | Compiler 3 |
|---|---:|---:|
| Programs that compile | 200 | 200 |
| One-set compound slots with exported `minSets: 2` (F01) | 94 | 0 |
| Knee-dominant exercise in a Home posterior slot (Q01) | 51 slots | 0 |
| Home 5–6 day with one exercise repeated three times (Q02) | 10 / 10 | 0 / 10 |
| Sessions with three hinge entries (Q02) | 53 | 0 |
| Programs repeating an exercise within a session, excluding must-haves | 129 | 0 |
| Gym hamstring-assistance jobs that pick knee flexion (Q06) | 0 / 241 | 229 / 229 |
| Gym programs with no knee flexion at all | 167 / 167 | 14 / 167 |
| Gym programs with a rear-delt exercise | 14 | 76 |
| Foundation programs permitting 0 RIR (F04/Q04) | 20 / 53 | 0 / 53 |
| Foundation Balanced/Strength with lunge or decline heavy default (Q03) | 25 / 25 | 0 / 25 |
| Muscle priority changes nothing *and* says nothing (F05/Q05) | 7 / 29 | 0 / 29 |
| Demanding bodyweight default without evidence (Q08) | 69 slots | 0 |
| Band-only contexts that use a band exercise | 0 / 2 | 2 / 2 |
| Machines-only Balanced/Strength 3–4 days at 60 min (X01) | conflict | compiles |
| Maximum weekly sets on the RDL machine in one program | 18 | 6 |
| Distinct exercises used across the corpus | 43 | 51 |
| Top-ten exercise share of all slots | 66.2 % | 57.5 % |
| Median / p95 compile time (ms, this machine) | 2.7 / 5.9 | 2.9 / 5.2 |

Feasibility never got worse. Across 80 family × frequency × profile × rest
combinations, the shortest session that compiles is unchanged in 60 and
*shorter* in 20 (for example Balanced 4–5 and Strength 4–5 now fit 30 minutes).
Balanced and Strength at 2–3 days still cannot fit 30 minutes; that remains a
typed time conflict.

Test evidence for the prototype: every pure-Node fast-lane suite passes except
four that also fail on untouched `main` in this environment
(`privacy-contract`, `direction-d-fixture`, `workout-draft`, `manual-matrix --self-test`);
the generative suite passes 36/36; the full `entry` browser lane passes 44/44;
every `tools/*--check` checker passes. In the `state` lane, 35 of 37 suites
pass. The two failures, `program-transition-r7-boundary` and
`install-transfer-client-browser`, fail identically on untouched `main` in
this environment. `thermonuclear-races` failed once under parallel load and
passed on rerun, as it does on `main`.

Read [`plans/065/prototype-programs.md`](./065/prototype-programs.md) for the
audited shortlist (S100, S096, S091, S095, R027, R068, R016, R002, S098 and
the strong examples) before and after.

## Decision log

Decisions D1–D12 came from the owner interview on 3 October 2026. D13–D20
were made while building the prototype, inside the owner-approved design. Do
not change any of them during execution.

| ID | Question | Decision | Source |
|---|---|---|---|
| D1 | Home 4/5/6 "Mixed coverage" slots | Three distinct jobs: `home_coverage_lower`, `home_coverage_upper`, `home_coverage_trunk_calf`. Each picks the function the week has trained least. Day labels unchanged. | Owner |
| D2 | Session over budget with a repeated accessory | First swap it for a complementary exercise (`reselect_redundant`); if none exists, remove it (`omit_redundant`). Both are disclosed reductions. | Owner |
| D3 | Returning lifters | Returning week 1 removes one set from protected compound and volume-counterpart slots, never below the class minimum (2), never from heavy primaries. Weeks 2+ unchanged. | Owner |
| D4 | Muscle priority behaviour | Rank priority-primary exercises higher and add +1 set to one eligible slot per session per priority muscle, never above the class maximum of 3. Always disclose when nothing could be added. | Owner |
| D5 | Unassisted chin-ups, dips, glute-ham raises, inverse leg curls, hanging leg raises | Default only when the lifter logged or requested the exercise; otherwise only as last resort, and then with the `capability.demanding_exercise_selected` limitation. | Owner |
| D6 | Bands | Add eight anchor-free band exercises. They progress with `range@1` (reps within range; no kilograms). | Owner |
| D7 | Machines as heavy anchors | Leg press, hack squat machine, Smith squat, Smith bench and chest press machine are heavy anchors with an authored 3–12 practical range. D19 adds two hinge anchors. | Owner |
| D8 | Bodyweight-only posterior work | Add bodyweight glute bridge and single-leg glute bridge. If nothing genuine fits, leave the slot empty with `home.posterior_capability_unavailable`. Never a quad exercise. | Owner |
| D9 | Foundation heavy anchors with a full gym | Barbell back squat and barbell bench press remain Foundation's heavy knee and press anchors. Trap bar deadlift is the Foundation hinge anchor. Lunges and decline presses are never Foundation defaults. | Owner |
| D10 | Balanced 4 "Lower volume" ordering (Q09) | Keep hinge first. Q09 is closed as intentional. | Owner |
| D11 | Who authors the coaching data | This plan authors all of it (`tools/exercise-compiler-data.json`, reviewed through `plans/065/exercise-compiler-data.md`). Executors copy it; they never edit values. | Owner |
| D12 | Time pressure | One-set work is acceptable under time pressure; proximity to failure compensates for lost volume. Order: trim to class floor → remove whole accessories → reduce reducible compounds to one set at the efficient RIR. Every step is disclosed; exported bounds stay consistent. | Owner |
| D13 | Set ceiling for priorities | Stays at 3. When every eligible slot is already at 3 sets, report `priority.at_set_ceiling`. | Owner |
| D14 | Execution shape | One implementation PR from a verified patch, then one documentation/closure PR. No intermediate slices, because test literals are only valid for the final engine. | Plan |
| D15 | Bonus set on an efficient (2-set, 0–2 RIR) slot | Becomes the normal prescription: 3 sets at the normal RIR (1–3, Foundation 2–3). Removing the bonus restores the efficient RIR. Sets and RIR stay a reviewed pair (design §6). | Plan |
| D16 | Any slot reduced to one set | Takes the class's efficient RIR range (0–2; Foundation 2–2). | Plan, from D12 |
| D17 | Inverse leg curl | Classified `demanding` (same treatment as the glute-ham raise). | Plan |
| D18 | Sequencing | All of this lands before Plan 059, in parallel with Plan 064. | Owner |
| D19 | Machines-only Strength hinge anchor | Machine deadlift (`dld_mc`) and Smith machine deadlift (`hg_sm`) are hinge anchors with a 3–12 range, so machines-only Strength compiles. | Plan, extends D7 |
| D20 | Relation alignment on Balanced 6 | Keep compiler-2 behaviour: a volume slot aligned to its heavy partner takes the non-efficient prescription even when authored efficient. Fixing it changes transition relation semantics; deferred as X09. | Plan |
| D21 | Rule B recovery allowlist | Re-pin the two existing allowlisted misses to compiler-3 totals: `growth_2_v1` 31/12 (38.7 %) and `growth_3_v1` 47/17 (36.2 %). The same two blueprints remain the only misses and every other blueprint stays in band. | Plan |
| D22 | Blueprint version | `VERSIONS.blueprint` becomes 2 for all 20 structures; blueprint ids keep their `_v1` suffix because the id names the canonical structure. | Plan |

## Finding disposition

| Finding | Disposition |
|---|---|
| F01 one-set compounds with `minSets: 2` | **Fixed.** Class floors in trimming; a disclosed `minimum_dose_single_set` step exports `minSets: 1` consistently (D12). |
| F02 / Q02 job collapse | **Fixed.** Session-aware selection keys, distinct Home coverage jobs (D1), redundancy step (D2). |
| F03 / Q01 sissy squat as posterior work | **Fixed.** Functions plus primary intent; glute bridges added; honest limitation (D8). |
| F04 / Q04 Foundation effort after time reduction | **Fixed.** Efficient conversion uses the profile-aware RIR (`rirFor`). |
| F05 / Q05 no-op priorities | **Fixed.** +1 bounded set and typed outcomes (D4, D13). Preferences no longer flatten incline jobs (preferred function ranks above history). |
| F06 concentration | **Improved** (66.2 % → 57.5 %). Diagnostic only; variety is not an objective. |
| Q03 Foundation lunge/decline defaults | **Fixed** (D9). |
| Q06 knee flexion and rear delt coverage | **Fixed.** Preferred function on hamstring jobs; `delt_mixed` balances functions. |
| Q07 returning protected dose | **Fixed** (D3). |
| Q08 capability vs permission; no bands | **Fixed** (D5, D6, D17). |
| Q09 Balanced 4 order | **Closed as intended** (D10). |
| X01 machines-only Balanced/Strength conflict | **Fixed** (D7, D19). |
| X02 "First week" reduction copy | **Fixed.** Reduction copy now says "To fit your time". |
| X03 inferred ranking data | **Fixed.** Authored compiler block for all 282 entries. |
| X04 `beginnerFriendly` regex | **Bypassed for the compiler** (`foundationDefault`). The picker field is unchanged. |
| X05 conflated patterns | **Fixed** by functions. Patterns remain as the public `priorityMovements` vocabulary. |
| X06 `abs` normalizes to `core` | No change needed; functions use `trunk`. |
| X07 relations re-read by position | Not needed: no relation-bearing blueprint changes order. |
| X08 fixture certified the sissy pick | **Fixed** by regenerating the fixture and the new quality gate. |
| X09 aligned volume slot drops `efficient` | **Deferred** (D20). |

## Engine specification (normative)

`implementation.patch` is the reference implementation of this section. If
the patch cannot be applied, implement exactly what this section says, then
reproduce the verification outputs in *Execution*.

### Versions (`program-compiler.js` `VERSIONS`)

`schema 1, blueprint 2, compiler 3, catalogue 2, rules 2, context 2,
recentConsistency 1, simpleStart 1`. `blueprint()` uses `VERSIONS.blueprint`;
`compile()` provenance uses `blueprintVersion: VERSIONS.blueprint`.

### Catalogue block

`tools/exercise-compiler-data.json` holds `{ schemaVersion: 1, source, entries: { <libraryId>: block } }`.
Every block has exactly these keys:

| Key | Type / vocabulary |
|---|---|
| `functions` | non-empty array of functions (below); the exercise's primary training functions |
| `secondaryFunctions` | array of functions; informational, never satisfies a job |
| `skill` | `low`, `moderate`, `high`, `demanding` |
| `environment` | subset of `safe_pull`, `training_support` |
| `practicalRepRange` | `[min, max]` integers |
| `stability` | `high`, `moderate`, `free` |
| `primarySuitability` | `high`, `moderate` |
| `unilateral`, `foundationDefault`, `anchor` | booleans |

Functions: `knee_extension, unilateral_knee, hip_hinge, hip_extension,
knee_flexion, horizontal_push, incline_push, vertical_push, horizontal_pull,
vertical_pull, shoulder_extension, chest_fly, lateral_raise, front_raise,
rear_delt, elbow_flexion, elbow_extension, plantar_flexion, trunk,
hip_abduction, hip_adduction, shrug, grip`.

`tools/build-exercises.mjs` reads the file, rejects any library id without a
block, any block for an unknown id, any extra/missing key and any out-of-
vocabulary value, and emits `compiler:{...}` on every `exercises.js` line after
`beginnerFriendly`. `normalizeCatalogue` uses the block when present; entries
without a block (custom and synthetic entries) keep compiler-2 inference, and
their `functions` come from `PATTERN_FUNCTIONS[patterns]` (first match only).

New entries (native, no upstream `src`), all `rank` 50, no media:

| id | name | namePt | equipment | primary | secondary | patterns |
|---|---|---|---|---|---|---|
| `sq_bw` | Bodyweight squat | Agachamento livre sem carga | bodyweight | Quads | Glutes | squat |
| `gb_bw` | Glute bridge | Ponte de glúteos | bodyweight | Glutes | Hamstrings | hinge |
| `sgb_bw` | Single-leg glute bridge | Ponte de glúteos unilateral | bodyweight | Glutes | Hamstrings | hinge |
| `rws_bd` | Seated band row | Remada sentada com elástico | band | Mid/upper back | Biceps,Rear delts | row |
| `pa_bd` | Band pull-apart | Abertura com elástico | band | Rear delts | Mid/upper back,Traps | rear_delt |
| `lr_bd` | Band lateral raise | Elevação lateral com elástico | band | Side delts | – | lateral_raise, delts |
| `cu_bd` | Band curl | Rosca com elástico | band | Biceps | Forearms | curl, arms |
| `te_bd` | Band overhead triceps extension | Extensão de tríceps acima da cabeça com elástico | band | Triceps | – | triceps |
| `cp_bd` | Band chest press | Supino com elástico | band | Chest | Triceps,Front delts | press |
| `gb_bd` | Banded glute bridge | Ponte de glúteos com elástico | band | Glutes | Hamstrings | hinge |
| `gm_bd` | Band good morning | Good morning com elástico | band | Hamstrings,Glutes | Spinal erectors | hinge |

The band set replaces the interview's "band leg curl" with a band chest press
because a band leg curl needs an anchor point no capability describes. All
eight band entries need no anchor.

### Jobs (slot templates)

Every template gains `functions`, `preferredFunctions`, `secondaryAcceptable`
(default `false`) and `balanceAcrossFunctions` (default `false`). `patterns`
stays on every template so `MOVEMENT_PATTERN_IDS` and `MUSCLE_IDS` are
byte-identical to compiler 2 (the context vocabulary must not change). The
heavy templates (`knee_anchor`, `press_anchor`, `knee_effort`, `press_effort`,
`hinge_effort`) require `{ loading: ["known_grid"], anchor: [true] }` and
prefer `{ equipment: ["barbell"] }`.

| Template | functions | preferredFunctions | balance |
|---|---|---|---|
| knee_growth, knee_anchor, knee_effort, knee_volume, quad_assistance | knee_extension | – | – |
| hinge_growth | hip_hinge, hip_extension | hip_hinge | – |
| hinge_effort, hinge_volume | hip_hinge | – | – |
| press_anchor, press_effort, press_volume, horizontal_press | horizontal_push | – | – |
| incline_press | incline_push, horizontal_push | incline_push | – |
| vertical_press | vertical_push | – | – |
| horizontal_pull, supported_pull | horizontal_pull | – | – |
| vertical_pull | vertical_pull | – | – |
| pull_mixed | horizontal_pull, vertical_pull | – | – |
| vertical_press_or_pull | vertical_push, vertical_pull | – | – |
| unilateral_knee | unilateral_knee | – | – |
| hamstring_assistance | knee_flexion, hip_hinge | knee_flexion | – |
| hip_extension | hip_extension, hip_hinge | hip_extension | – |
| chest | chest_fly, horizontal_push, incline_push | chest_fly | – |
| back | horizontal_pull, vertical_pull, shoulder_extension | – | – |
| lateral_delt, home_lateral | lateral_raise | – | – |
| rear_delt | rear_delt | – | – |
| delt_mixed | lateral_raise, rear_delt | – | yes |
| biceps / triceps | elbow_flexion / elbow_extension | – | – |
| arms | elbow_flexion, elbow_extension | – | yes |
| calf, home_calf | plantar_flexion | – | – |
| trunk, home_trunk | trunk | – | – |
| priority | knee_extension, knee_flexion, chest_fly, horizontal_pull, vertical_pull, lateral_raise, rear_delt, elbow_flexion, elbow_extension, plantar_flexion | – | – |
| optional_arms | elbow_flexion, elbow_extension, plantar_flexion, lateral_raise | – | yes |
| home_knee | knee_extension, unilateral_knee | knee_extension | – |
| home_push | horizontal_push, incline_push, elbow_extension | horizontal_push | – |
| home_posterior | hip_hinge, hip_extension, knee_flexion | – | – |
| home_pull | horizontal_pull, vertical_pull | – | – |
| home_coverage_lower (new) | knee_extension, unilateral_knee, hip_hinge, hip_extension, knee_flexion | – | yes |
| home_coverage_upper (new) | horizontal_push, incline_push, vertical_push, horizontal_pull, vertical_pull | – | yes |
| home_coverage_trunk_calf (new) | trunk, plantar_flexion | – | yes |

`home_coverage` is deleted. Blueprint edits (labels unchanged):

- `home_4` day 4 "Mixed": `home_coverage_upper, home_pull, home_posterior, home_coverage_lower`.
- `home_5` day 5 "Mixed coverage": `home_coverage_lower, home_coverage_upper, home_coverage_trunk_calf`.
- `home_6` days 2 and 4: third slot `home_coverage_upper`; day 5 first slot `home_coverage_lower`; day 6: `home_coverage_lower, home_coverage_upper, home_coverage_trunk_calf` (all `efficient: true` as before).

### Fit (hard filters, in order)

Not disliked; not primary for an ignored muscle; equipment owned; every
`environment` entry present; the candidate's `functions` intersect the job's
`functions`; the candidate is *primary* for one of the job's primary muscles
(or, only when `secondaryAcceptable`, primary-or-secondary for any job
muscle); `priority_only` jobs need a priority muscle as primary; required
capabilities; required characteristics; a reachable prescription class.

### Fill order

Choices are made by tier, then authored day, then authored slot; days keep
authored slot order in the output. Tier 0 heavy primary; tier 1 protected
(including `protect_when_capable`); tier 2 other hypertrophy compound and
volume counterpart; tier 3 other accessories; tier 4 optional. A volume slot
in an authored relation (non-Foundation) first tries its heavy partner's
exercise and, when it fits, takes it with the *non-efficient* prescription (D20).

### Rank keys (higher wins; final key is the exercise id ascending)

Exported as `RANK_KEYS`; the order is the contract:

1. `must_have` (in `preferences`)
2. `capability`: 0 only for `skill: "demanding"` without history or must-have (D5)
3. `foundation`: under Foundation, 0 for `foundationDefault: false` without evidence
4. `movement_priority`
5. `primary_intent`
6. `preferred_function`
7. `avoids_de_emphasis`
8. `history`
9. `not_in_session`
10. `new_function_in_session`
11. `week_balance`: balance jobs prefer the function with the fewest weekly sets so far; other jobs score 0 for an exercise already carrying ≥ 6 sets this week (`WEEKLY_EXERCISE_SET_LIMIT`), else 1
12. `priority_muscle` (primary muscles only)
13. `preferred_characteristics` (count)
14. `foundation_stability`
15. `home_equipment` (Home only: bodyweight 3, dumbbell 2, band 1)
16. `skill` (low 3, moderate 2, high 1, demanding 0)
17. `primary_suitability`
18. `stability`
19. `catalogue_rank` (lower rank wins)

### Priority bonus (after selection, before fitting)

For each priority muscle and each day, the first slot in authored order that
is not a heavy primary, has the muscle as primary, has no bonus yet and has
fewer than the class maximum sets gets +1 set (`bonusSets: 1`). An efficient
slot that receives the bonus switches to the normal RIR and remembers the
efficient range in `bonusRestoredRir` (D15).

### Dose fitting (`fitTime`), in this exact order

Each step runs only while the day is over `sessionMinutes`; candidates are
ordered de-emphasized first, then later authored position first.

1. `remove_priority_bonus`: drop bonus sets; restore `bonusRestoredRir`.
2. `remove_optional`.
3. `efficient_two_set`: `efficientEligible` slots above 2 sets → 2 sets with `rirFor(rule, true, context)`.
4. `reselect_redundant` / `omit_redundant`: a reducible, non-heavy, non-relation slot whose exercise already appears earlier that day is re-selected excluding that day's exercises; if nothing fits it is removed (D2).
5. `trim_reducible_assistance`: reducible non-heavy slots lose one set, never below the class minimum; a slot reaching 1 set takes the efficient RIR (D16).
6. `omit_accessory`: remove reducible, non-conditional `isolation_accessory` slots.
7. `minimum_dose_single_set`: reducible non-heavy slots whose class has `minimumDoseSets` (compound classes: 1) go to 1 set, efficient RIR, `minimumDose: true`.
8. `time_ceiling_conflict`.

`RULES.reductionOrder` lists these eight steps then `conflict`. Exported
`minSets` is the class minimum, or `minimumDoseSets` for a minimum-dose slot.
`compile()` throws if any resolved slot ends outside its bounds.

### Re-entry (`weekSchedule`)

Reduced weeks first subtract `bonusSets`. Returning week 1 then reduces
protected `hypertrophy_compound` and `volume_counterpart` slots by one set, not
below the class minimum (D3). All other rules are unchanged from compiler 2.

### Limitation and reduction codes

New limitations: `home.posterior_capability_unavailable`,
`capability.demanding_exercise_selected`, `priority.no_room`,
`priority.at_set_ceiling`, `priority.no_eligible_slot` (priority entries carry
`dayId: null, slotId: null, muscle`). New reductions: `remove_priority_bonus`,
`reselect_redundant`, `omit_redundant`, `omit_accessory`,
`minimum_dose_single_set`. Priority outcome precedence: a surviving bonus
reports nothing; a bonus removed by fitting → `no_room`; else a selection the
priority key decided reports nothing; else eligible slots at ceiling →
`at_set_ceiling`; else `no_eligible_slot`.

Copy (EN / PT) and the app table keys are in the patch (`i18n-en.json`,
`i18n-pt.json`, `ENTRY_CODE_COPY` in `app.js`). The three existing reduction
strings change from "First week: …" to "To fit your time: …" (X02).

## Execution: PR 1, implementation

Work on a branch from current `main`. Run every command from the repository
root. Commit only when a step's expected result matches.

### Step 1: check for drift

```sh
git log -1 --format=%H
sha256sum program-compiler.js program-transition.js app.js i18n-en.json i18n-pt.json exercises.js tools/build-exercises.mjs tools/exercise-curation.json
```

The patch was generated against these inputs (first 16 hex characters):

| File | sha256 prefix at plan time |
|---|---|
| program-compiler.js | 48753c3be14cb91f |
| program-transition.js | 02ce416749d2552d |
| app.js | a5ad06234e7760c3 |
| i18n-en.json | 90191d1b11de66c3 |
| i18n-pt.json | 9fcb598da9df36e6 |
| exercises.js | 84dae6f133d1b0c5 |
| tools/build-exercises.mjs | 483feb170825abdb |
| tools/exercise-curation.json | 3e5ad2748d76a2b4 |

A different hash is not a failure by itself; Step 2 decides.

### Step 2: apply the patch

```sh
git apply --3way --index plans/065/implementation.patch
```

- If it applies cleanly, go to Step 3.
- If only `app.js`, `i18n-en.json`, `i18n-pt.json` or `i18n.js` conflict
  (Plan 064 touches them), resolve by keeping both sides: every key and table
  entry `main` added stays, and every key and entry the patch adds or changes
  is applied exactly. Then run `node tools/build-i18n.mjs` to regenerate
  `i18n.js` instead of hand-merging it.
- If `program-compiler.js`, `program-transition.js` or any test conflicts,
  stop (see *Stop conditions*).

### Step 3: regenerate generated files and prove they match

```sh
git clone --depth 1 https://github.com/hasaneyldrm/exercises-dataset /tmp/exdb
git -C /tmp/exdb fetch --depth 1 origin 7455efae41b330c265e7cd4b78dfa848e7ce5ebd && git -C /tmp/exdb checkout 7455efae41b330c265e7cd4b78dfa848e7ce5ebd
node tools/build-exercises.mjs --src /tmp/exdb
node tools/build-i18n.mjs
node tools/build-program-family-fixtures.mjs
node tools/build-transition-fixture.mjs
git status --short
```

Expected: `exercises.js — 282 movements`; `git status` shows no change beyond
what Step 2 staged (the generators reproduce the patch byte for byte). If a
generated file differs, stop.

### Step 4: revisions (derive from live `main` at merge time)

Immediately before merge, read the live values from `main`:

- `sw.js`: `CACHE = "repforge-vN"` becomes `repforge-v(N+1)`.
- `index.html` and the matching `sw.js` precache URL: bump the `?v=` query of
  `program-compiler.js`, `program-transition.js` and `app.js` to (live value + 1).
  Keep each `index.html` URL, its exact `sw.js` precache URL and the
  `transitionAssets` contract in `test/exercise-library.mjs` aligned
  (`AGENTS.md`, service-worker section).
- `exercises.js` is not query-versioned; the `CACHE` bump covers it.

### Step 5: verify

Use the installed Chromium for browser suites when the pinned one is missing:
`export REPFORGE_CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
(only if that file exists). Install test-only dependencies once with
`(cd test && npm ci)`.

```sh
node test/program-generation-quality.mjs
node tools/build-program-family-fixtures.mjs --check
node test/program-family-fixtures.mjs
node test/program-compiler-plan048-preferences.mjs
node test/program-entry-production-adapter.mjs
node test/program-transition.mjs
node test/program-transition-recovery.mjs
node test/program-transition-siblings.mjs
node test/program-transition-volume.mjs
node test/exercise-library.mjs
node tools/check-recovery-invariants.mjs --check
node tools/canonical-proposal-hash.mjs --check
node tools/check-canonical-contradictions.mjs --check
node tools/check-transition-mapping-negative-controls.mjs
node tools/build-i18n.mjs --check
node test/generative/run.mjs --profile ci
node tools/run-tests.mjs entry --keep-going
node tools/run-tests.mjs state --keep-going
```

Expected first line of the quality gate:

```
program generation quality: 200/200 compiled; 229/229 hamstring jobs use knee flexion; 51 distinct exercises; top ten = 57.5% of slots
```

Every other command exits 0. Browser runs may leave a
`posthog-config.js?v=local` script tag in `index.html`; discard it with
`git checkout -- index.html` before committing (keep your Step 4 edits by
re-applying them if you made them first; doing Step 4 last avoids this).

### Step 6: screen catalogue

Default selections change, so every frame that shows a recommended program
changes. Run `node tools/capture-ui-screens.mjs --affected --accept-visual-change`,
review the PNGs (exercise names and set counts change; layout must not), and
commit them.

### Step 7: PR

One commit for the patch plus generated files, one for revisions, one for
screens. Push, open a draft PR titled "Plan 065: compiler 3 program
generation", and put the *Results* table and the Step 5 outputs in the body.
Completion evidence is a green `ci` check on the final head (`docs/ci.md`).

## Execution: PR 2, documentation and closure

After PR 1 merges:

1. `docs/program-family-design.md`: replace the candidate-order paragraph with
   the rank-key list above; add the fill order, the dose-fitting order and the
   new limitation codes.
2. `CLAUDE.md` ownership table: the `program-compiler.js` row adds "authored
   catalogue functions, week-aware selection, dose fitting"; add
   `tools/exercise-compiler-data.json` to the translation/source-data row.
3. `tools/README.md`, `build-exercises.mjs` section: one paragraph on
   `exercise-compiler-data.json` (strict, one block per id, vocabularies above).
4. New `docs/adr/0017-function-aware-program-generation.md` recording D1–D22
   as decisions, with status Accepted, date 3 October 2026.
5. Re-run both audits into `docs/audits/program-generation-<date>/` with
   `node tools/audit-program-generation.mjs docs/audits/program-generation-<date>`.
   The structural audit's slot-intent checks assume compiler-2 patterns; record
   any check that no longer applies instead of editing the evaluator to pass.
6. `plans/README.md`: Plan 065 → IMPLEMENTED with the PR number;
   `docs/backlog.md`: add a Completed row.

## Stop conditions

Stop and report, without improvising, when:

- `program-compiler.js`, `program-transition.js` or a test file conflicts in Step 2.
- A regenerated file differs from the patch in Step 3.
- Any Step 5 command fails, *including* a test you think is "obviously" stale.
  The only expected-value edits allowed are the ones already in the patch.
- A screen-catalogue frame changes layout rather than content.
- Anyone asks to change a value in `tools/exercise-compiler-data.json`. That
  is a new owner decision.

## Known residuals and deferred items

- **Priorities often hit the ceiling.** In standard plans most priority
  muscles are already at 3 sets per compound, so 20/29 priority programs end
  with `priority.at_set_ceiling` or `priority.no_room`. Allowing more requires
  raising the owner-approved three-set ceiling (D13 kept it).
- **Bodyweight-only Home 5 without pulling** has a "Hip + available pull" day
  with one exercise (glute bridge) because its pull slot is honestly empty.
  Fixing it needs an authored blueprint variant.
- **X09** relation alignment drops the authored `efficient` flag on Balanced 6
  volume slots (D20).
- **`beginnerFriendly`** in the picker still uses the build regex (X04).
- **Activated programs** keep compiler 2 provenance and are never rewritten.
  Version-pinned transitions and recovery treat them as "rules changed", the
  designed path for any compiler bump.

## Files in `plans/065/`

| File | Purpose |
|---|---|
| `implementation.patch` | Complete PR 1 change set, including generated files, against `main` at plan time. |
| `exercise-compiler-data.md` | Review table of all 282 authored blocks; bold marks a change from compiler-2 inference or a new entry. |
| `prototype-programs.md` | Audited shortlist before and after. |
