# Plan 065: Program generation engine overhaul (compiler v3)

- **Plan number:** 065
- **Phase:** Outside the UI overhaul programme (049–059). Engine correctness
  and coaching quality of first-program generation.
- **Status:** PROPOSED — awaiting owner review of the decisions in
  *Owner decisions required*. Slices S0 and S1 need no product decision and
  may start on owner go-ahead.
- **Depends on:** Nothing in code. Sequencing: S0–S1 are standalone
  correctness PRs in the spirit of the advisor-plan rows (Q604); S2–S4 land
  before Plan 059 freezes the alpha candidate, because every alpha
  participant's first program is produced by this engine; S5 is owner-gated.
- **Blocks:** Plan 059's "program credible for a first participant" claim;
  the Gated *Advanced first-program generation* row, which cannot be built on
  a selector that is unaware of the week it is composing.
- **Governing inputs:** the two 3 October 2026 audits recorded under
  [`docs/audits/program-generation-2026-10-03/`](../docs/audits/program-generation-2026-10-03/README.md)
  (structural audit F01–F06) and its
  [coaching audit](../docs/audits/program-generation-2026-10-03/coaching/README.md)
  (Q01–Q09); the owner-approved design
  [`docs/plan-047-owner-approved-design.md`](../docs/plan-047-owner-approved-design.md),
  its [amendment](./047-owner-approved-amendment.md), the
  [science source ledger](../docs/plan-047-science-source-ledger.md), and the
  [family design](../docs/program-family-design.md).
- **Affected surfaces:** `program-compiler.js` (all stages), `tools/exercise-curation.json`
  → generated `exercises.js` and `tools/build-exercises.mjs`, `program-entry-adapter.js`
  (capability mapping, limitation/review surfacing), `program-entry.js` (known
  capabilities), `i18n-en.json` / `i18n-pt.json` (limitation, reduction and
  explanation copy), `test/fixtures/program-families-v1.json` and
  `tools/build-program-family-fixtures.mjs`, new `test/program-generation-quality.mjs`
  and corpus fixtures, `test/generative/` compiler properties, `sw.js` cache and
  protected script revisions, the UI screen catalogue frames that show a
  recommended program, `docs/program-family-design.md`, a new ADR.
- **Complexity:** High. The compiler is small (1,033 lines) but every
  generated program, fixture, setup-link preview, transition sibling and
  screen-catalogue frame depends on it.
- **Risk:** Medium–high if done as one PR; medium as the staged slices below,
  because each slice has a replayable 200-program oracle and a byte-exact
  family fixture, and because activated programs are pinned copies that the
  compiler never rewrites.

## Problem statement

Two independent audits ran the production compiler over 200 complete programs
(100 under an assumed usage prior, 100 supported-choice edge cases) and 308
generation probes at source commit `c1d6432`. The replay on the current `main`
head (`a781f83`) reproduces the audit bit-for-bit: the same semantic digest
`92f9e0be…`, the same 4 + 14 contract failures, the same 137 review-flagged
programs. Nothing about the engine changed between the audit and this plan.

The structural audit found one confirmed contract defect and five quality
patterns. The coaching audit's verdict is that "a highly competent coach could
not confidently hand every currently generated program directly to users
without manual review", while noting that several defaults (Growth 2–3,
Balanced 3, Strength 2–3 standard, dumbbell Home 2–3) are coherent and that
the authored blueprints are sound. The weakness is the completion of
blueprints into exercises and doses, not the blueprints themselves.

### Findings carried into this plan

| ID | Source | Finding | Audited prevalence | Classification |
|---|---|---|---|---|
| F01 | structural | `fitTime` trims two-set compounds to one set and still exports `minSets: 2` | 18/200 programs, 94 slot occurrences | **Contract defect** against design §6 working-set bounds |
| F02 / Q02 | both | Independent per-slot ranking collapses distinct jobs onto one exercise (triple RDL days, single-exercise "Mixed coverage" days) | within-session repeat 129/200; three-hinge day 53/200, all 38 Growth 4–6; all 10 Home 5–6 | Quality defect where jobs are meant to be complementary |
| F03 / Q01 | both | Sissy squat (quad knee-extension) fills `home_posterior` via a secondary glute label | 12/33 Home plans sissy; 7 more split-squat | **Programming defect** (false posterior coverage) |
| F04 / Q04 | both | Time fitting resets Foundation compounds to 0–2 RIR and keeps many one-set stations | 20/53 Foundation programs | Policy inconsistency with design §9 |
| F05 / Q05 | both | Muscle priorities often change nothing; no "already satisfied / no room" outcome; preferences erase unilateral/incline distinctions | 7/29 priority programs byte-identical without the priority; 26/29 no primary-set increase | Customization defect |
| F06 | structural | Defaults concentrate on 31/271 exercises; RDL machine fills 19.3 % of representative slots | top ten = 78.9 % of slots | Diagnostic, not a target |
| Q03 | coaching | Foundation Balanced/Strength heavy primaries default to barbell lunge 3×3–6 and decline bench | 25/25 Foundation Balanced/Strength | Suboptimal default |
| Q06 | coaching | No gym program ever selects knee flexion; rear-delt focus absent | 167/167 gym programs | Suboptimal coverage |
| Q07 | coaching | Returning re-entry never reduces protected dose, including 0–2 RIR dips/GHR on six days | 22/22 returning programs | Policy question (owner) |
| Q08 | coaching | `safe_pull` / `training_support` are treated as ability: unassisted chin-ups, dips, GHR become defaults; bands have no candidates | 15/33 Home; 12/12 band contexts | Capability model gap |
| Q09 | coaching | Balanced 4 "Lower volume" hinges before paired squat practice | 15/15 Balanced 4 | Authored ordering |

### Additional defects found while preparing this plan

These were not in either audit report. They are reproduced from the audit
artifacts and the current source.

| ID | Finding | Evidence |
|---|---|---|
| X01 | **Machines-only gyms cannot compile Balanced or Strength.** `practicalRange` infers `[4, 12]` for every machine, so no machine satisfies `heavy_3_6`, and `knee_anchor` / `press_anchor` return `required_slot_unresolved`. Smith entries are inferred the same way. | audit probes `R-rank-76`, `R-rank-96`; `program-compiler.js:330-336`, `:483-490` |
| X02 | **"What Taurifer adjusted" copy is false.** `entry.adjusted.reduce.*` strings say "First week: …", but `fitTime` mutates the resolved prescription, so every week of the block carries the reduction. | `i18n-en.json:1789-1791`; `fitTime` at `program-compiler.js:643-675`; `weekSchedule` copies the fitted sets into all six weeks |
| X03 | **The catalogue authors none of the fields the ranker uses.** `practicalRepRange`, `primarySuitability`, `stability`, `fatigueDemand`, `environmentRequirements`, `unilateral`, `rank` and most `beginnerFriendly` values are inferred at runtime from the equipment string and name regexes. Only 12 entries carry an explicit `beginnerFriendly`; 7 of those come from the curation file. | `normalizeCatalogue` at `program-compiler.js:338-372`; `tools/exercise-curation.json` |
| X04 | **The build heuristic for `beginnerFriendly` never fires for barbell names.** It tests lowercase `barbell` against capitalized generated names, so `Barbell lunge` and `Barbell single leg split squat` are beginner-friendly while `Barbell deadlift` is not only because the curation file says so. | `tools/build-exercises.mjs` `beginnerFriendly()`; catalogue profile |
| X05 | **One pattern token carries unrelated functions.** `hinge` covers RDL, hip thrust, back extension, reverse hyper, kettlebell swing and cable pull-through; `squat` covers back squat, leg press, split squat, lunge and sissy squat. Nothing distinguishes a knee-extension job from a hip-extension job, or a bilateral from a unilateral pattern, except a name regex. | catalogue profile; `SLOT_TEMPLATES` |
| X06 | **`abs` is not a pattern after normalization.** `token()` maps `abs` to `core`, so the `trunk` / `home_trunk` templates' `["abs", "core"]` pattern list works only through `core`. Harmless today, misleading for authors. | `program-compiler.js:27-36` |
| X07 | **Relations are re-read by authored position.** `substitute()` rebuilds relations from `BLUEPRINT_BY_ID` positions, so any future blueprint slot reorder would silently re-pair an activated v1 instance on substitution. This blocks the Balanced 4 reorder (Q09) until relations are resolved by slot id. | `relationState` at `program-compiler.js:687-710`; `substitute` at `:895-917` |
| X08 | **The family fixture pins the sissy-squat posterior pick as expected output.** `test/fixtures/program-families-v1.json` records `sqs_bw` for every Home `home_posterior` slot, so the current test gate certifies F03. | fixture `reviewCompilations`; infrastructure report |

### Root causes

The findings share six causes. The plan is organised around them rather than
around the finding list, so that a fix removes a class of defects instead of
one symptom.

1. **No authored training-function data.** The catalogue says what an
   exercise is called and which muscles it loads; it does not say what job
   it does (knee extension, hip extension, knee flexion, horizontal pull, …),
   how much skill it takes, which apparatus it needs, or which rep ranges are
   practical on it. The compiler guesses all of that from the equipment string
   and the name. Q01, Q03, Q06, Q08, X01, X03–X05 follow directly.
2. **Compatibility accepts secondary-label matches for required intent.**
   `candidateFits` passes when any candidate muscle, primary or secondary,
   intersects any contract muscle. A quad exercise with a glute secondary is
   "compatible" with a posterior job. F03/Q01 and part of F05 follow.
3. **Selection is greedy, per slot, and context-free.** `resolveSlot` ranks
   each slot's candidates with no knowledge of what the session or week
   already contains. Three compatible hinge jobs on one day pick the same
   winner three times. F02/Q02, Q06, and the Home 5–6 collapse follow.
4. **Dose fitting ignores class floors and profile.** `fitTime` reduces
   whichever reducible slot has more than one set, re-derives RIR from the
   class instead of the resolved profile, and never considers removing a
   redundant station before thinning every station. F01, F04/Q04 and X02.
5. **No post-compile assessment.** The compiler never asks whether a stated
   priority was honoured, whether a region ended up with only secondary
   exposure, or whether a day became one exercise repeated. There is no typed
   "already covered" or "no room under this constraint" outcome, so the UI
   cannot be honest about it. F05/Q05, F03's visibility.
6. **The test oracle is the implementation's own snapshot.** The family
   fixture is a byte copy of compiler output; the plan048 suite proves
   ranking mechanics, not programming sense. Nothing measured programming
   quality across realistic inputs until the audits did. X08.

## What this plan does not do

- No LLM, randomness, "try again" reroll, or non-deterministic step. Design §11:
  compilation is deterministic and equal versions plus equal inputs give equal
  output.
- No new family, no fifth profile, no public Home variants, no new progression
  strategy or arithmetic, no RIR formula, no per-user RIR target, no deload, no
  weekly rotation, no universal weekly set cap. Design §1, §7, §9, §20, §21 and
  the ledger forbid each of these.
- No change to any activated program. Activated instances stay pinned to their
  compiler/blueprint/catalogue versions; updates are offered, never applied
  (design §19).
- No change to entry answers or onboarding screens. Plan 064 owns those
  surfaces. This plan changes what the engine returns and the copy of the
  existing "What Taurifer adjusted" surface; a new capability question is an
  owner decision (OD-5) and, if approved, a Plan 064 follow-up.
- No numeric pseudo-scores. Design §11: "Do not introduce fake numerical scores
  such as `fatigueScore: 7.4`." Selection stays lexicographic over booleans
  and small authored ordinals.
- No variety objective. Repetition remains allowed and sometimes desirable
  (design §11). The targets below measure *unintended* repetition: the same
  exercise filling jobs that were authored to be complementary.

## Target architecture: compiler v3

The compiler keeps its public API (`compile`, `substitute`, `customize`,
`projectProgram`, `projectProgramForWeek`, `migrateLegacyStructure`,
`getCompatibleSplitChoices`, `validateContext`, `normalizeCatalogue`,
`estimateDaySeconds`) and its output shape. Internally it becomes a staged
pipeline where each stage is a pure function with its own tests:

```
context v2 ──▶ 1. catalogue v2 normalisation (authored functions, inference fallback + report)
            ──▶ 2. job graph: blueprint v2 slots as training jobs with function, intent, distinctness, ordering
            ──▶ 3. selection: protected/anchor jobs first across the week, then compounds, then accessories,
                   each scored lexicographically against session + week state
            ──▶ 4. dose fitting v2: optional → efficient (profile-aware) → redundancy resolution → trim to class floor → conflict
            ──▶ 5. assessment: priority satisfaction, coverage by function, dominance, per-slot decision trace
            ──▶ 6. projection (unchanged schema) + review object for the preview surface
```

### Stage 1 — catalogue v2: authored functions with inference fallback

Add an optional `compiler` block to each entry in `tools/exercise-curation.json`,
emitted verbatim by `tools/build-exercises.mjs` into `exercises.js`:

```json
"compiler": {
  "functions": ["hip_extension", "hip_hinge"],
  "skill": "moderate",
  "apparatus": [],
  "practicalRepRange": [4, 12],
  "primarySuitability": "high",
  "stability": "high",
  "fatigueDemand": "moderate",
  "foundationDefault": true,
  "unilateral": false
}
```

Closed vocabularies, validated by the build and by `validateBlueprints()`:

- `functions` (one or more): `knee_extension`, `hip_extension`, `hip_hinge`,
  `knee_flexion`, `unilateral_knee`, `horizontal_push`, `incline_push`,
  `vertical_push`, `horizontal_pull`, `vertical_pull`, `scapular_retraction`,
  `lateral_abduction`, `rear_delt`, `elbow_flexion`, `elbow_extension`,
  `plantar_flexion`, `trunk_flexion`, `anti_extension`, `anti_rotation`,
  `hip_abduction`, `hip_adduction`, `grip`. A sissy squat is
  `knee_extension` only. A split squat is `knee_extension` + `unilateral_knee`
  with `hip_extension` as a *secondary function* (a separate
  `secondaryFunctions` list, never used to satisfy a required function).
- `skill`: `low`, `moderate`, `high`, `demanding_bodyweight`. The last marks
  unassisted chin-ups, dips, glute-ham raises, pistol-type movements.
- `apparatus`: `pull_up_bar`, `suspension_anchor`, `dip_station`, `bench`,
  `hyperextension_station`, `glute_ham_bench`, `step_or_box`. These replace the
  hard-coded `training_support` id list and the inferred `safe_pull` rule.
- `foundationDefault`: whether the exercise may be a *default* under the
  Foundation profile. Replaces the `beginnerFriendly` build regex (X04). The
  existing `beginnerFriendly` field stays for the picker; the compiler reads
  `foundationDefault` and falls back to `beginnerFriendly`.
- `practicalRepRange` authored per entry for the heavy-primary candidate pool
  (hack squat, leg press, chest press machines, Smith squat/bench, trap bar,
  machine deadlift) so a machines-only gym can satisfy `heavy_3_6` where a
  coach would accept it (X01).
- Loading stays inferred from equipment and increments; it is not a coaching
  judgement.

Inference stays as the fallback for entries without a block, and the build
prints an **inference-reliance report** (`node tools/build-exercises.mjs --report`)
listing every entry whose compiler-visible fields are still inferred. The
acceptance target is that every entry reachable by a slot template in the
corpus has an authored block; the long tail may stay inferred.

Band entries: author a small vetted set (about eight: band row, band
pull-apart, band lateral raise, band curl, band pressdown, band leg curl, band
glute bridge, band good morning) only after OD-6 settles the strategy mapping
for ordinal loading. They render the deliberately empty media tile; the media
allowlist does not change.

`VERSIONS.catalogue` becomes 2. `catalogueVersion` already rides provenance.

### Stage 2 — jobs, not pattern lists: blueprint v2

`SLOT_TEMPLATES` entries become training jobs:

```js
hamstring_assistance: job({
  role: "isolation_accessory",
  requiredFunctions: ["knee_flexion", "hip_hinge"],   // any one satisfies
  preferredFunctions: ["knee_flexion"],               // ranks first when the week already has hip_hinge
  intent: { primary: ["hamstrings"], secondaryAcceptable: false },
  distinctFrom: ["hinge_growth", "hip_extension", "hinge_volume", "hinge_effort"],
  prescriptionClasses: ["isolation_8_15", "compound_8_12"],
  …
})
```

- `requiredFunctions` replaces `patterns`. The old pattern tokens remain on
  catalogue entries for the picker and for the `priorityMovements` vocabulary
  (`MOVEMENT_PATTERN_IDS` is a public context contract; keep it and map each
  pattern to the functions it implies).
- `intent.secondaryAcceptable` defaults to **false**: a candidate must be
  primary for at least one of the job's primary muscles. Only jobs that are
  genuinely broad (`home_coverage` successors, `optional_arms`) set it true,
  and the assessment stage records `secondary_only` whenever it is used.
- `distinctFrom` names the jobs this job must not duplicate within the same
  session unless an authored relation pairs them. The Balanced heavy/volume
  pairs stay exempt by construction because they are authored relations.
- `orderingClass` (`primary`, `practice`, `compound`, `assistance`) lets a
  blueprint day declare the ordering rule it wants, so the Balanced 4
  "Lower volume" day can put the paired squat practice before non-priority
  hinge assistance without a global compound-first algorithm (Q09).
- `home_posterior` requires `hip_extension` or `hip_hinge` or `knee_flexion`
  with primary hamstrings/glutes. When nothing resolves, the slot becomes the
  limitation `home.posterior_capability_unavailable`, surfaced like the pull
  limitation today, instead of a quad exercise.
- Home 4/5/6 `home_coverage` triplets become three authored jobs:
  `home_coverage_lower` (knee_extension or hip_extension, primary quads/glutes/
  hamstrings), `home_coverage_push_or_pull` (horizontal_push, vertical_pull or
  horizontal_pull), and `home_coverage_trunk_or_calf`. The coaching audit's
  "author three distinct Home coverage functions" is implemented as data, and
  the day labels do not change, so the owner-approved contract fixture stays
  byte-identical. Requires OD-1.
- Blueprint `version` becomes 2 on every blueprint whose slot table changed;
  ids stay `*_v1` because the id is the canonical structure identity pinned by
  the contract fixture, by `splitId` validation, by `program-transition.js`
  siblings and by persisted provenance. `VERSIONS.blueprint` becomes 2. The
  ADR records that "v1" in the id names the structure generation, not the
  slot table revision.
- Relations are resolved by slot id, and `substitute()` reads the relations
  carried on the instance rather than re-deriving them from authored
  positions (X07). A regression proves that substituting on a compiler-2
  instance yields the same relation set as before.

### Stage 3 — selection with session and week state

Replace `candidateOrder` with `rankCandidate(candidate, job, context, state)`
where `state` is the partially composed week: for the current session, the
exercises and functions already placed; for the week, direct set exposure per
exercise and per function so far. Resolution order is **job class first,
authored order second**: all protected heavy primaries and anchors across the
week, then protected compounds, then reducible compounds, then accessories.
Output order inside a day stays the authored slot order; only the order in
which choices are *made* changes, so accessories see what the compounds
consumed. Determinism is preserved because the fill order is a fixed function
of the blueprint.

Hard filters (unchanged in spirit, extended):

1. Not disliked; not primary for an ignored muscle.
2. Equipment owned; every `apparatus` entry present in the mapped environment.
3. Satisfies a required function; primary intent unless the job accepts
   secondary.
4. `skill: demanding_bodyweight` passes only when the user's history or
   must-have list names the exercise, or no non-demanding candidate satisfies
   the job (Q08). Under Foundation, `skill: high` and non-`foundationDefault`
   entries pass only when a must-have names them (Q03).
5. Prescription class reachable from the authored practical range.

Lexicographic keys, highest first (booleans and small ordinals only):

1. Must-have preference.
2. Movement priority (pattern → function mapping).
3. Preserves primary intent (kept for jobs that accept secondary).
4. Avoids de-emphasised muscles.
5. History continuity.
6. **Not already used in this session**, unless an authored relation or an
   explicit `repeatAllowed` on the job says otherwise. Protected heavy work is
   exempt in the sense that it is placed first and never displaced.
7. **Function complementarity**: the candidate's primary function is not yet
   present in the session for a job in the same `distinctFrom` family
   (knee flexion after a hinge, rear delt after lateral work). This is the
   key that makes Q02, Q06 and the Home collapse disappear without a
   no-duplicates rule.
8. **Weekly dominance guard**: among otherwise-equal candidates, prefer the one
   whose exercise currently carries fewer non-protected sets this week. This is
   a tie-breaker, not a cap; design §7 forbids caps.
9. Priority-muscle match (primary only; secondary labels no longer earn
   priority credit — Q05).
10. Foundation suitability (`foundationDefault`, stability).
11. Home loading clarity (bodyweight > dumbbell > band), Home only.
12. Primary suitability, stability, authored rank, id.

Everything above key 6 is today's order, so a user's explicit choices keep
their precedence. Keys 6–8 are new and sit below user intent and above
compiler preference, exactly where design §11 places "fatigue distribution"
among compiler preferences.

### Stage 4 — dose fitting v2

The owner-approved reduction order stays: remove optional → efficient two-set
→ trim reducible assistance → typed conflict (design §15). Within it:

1. **Class floors are hard.** `trim_reducible_assistance` never takes a slot
   below `RULES.prescriptionClasses[class].sets[0]`. A compound stops at two;
   isolation may reach one. When the floor is reached everywhere and the day
   still does not fit, the result is `time_ceiling_conflict`, as the design
   requires, instead of a one-set compound (F01).
2. **Efficient conversion is profile-aware.** The RIR after `efficient_two_set`
   is derived through the same `resolvePrescription` path as an authored
   efficient slot, so Foundation lands on the conservative end of the
   authored efficient range (2–2 inside 0–2), never 0 (F04/Q04). This is the
   existing owner-approved rule applied consistently, not a new target.
3. **Redundancy resolution before thinning (OD-3).** Between steps 2 and 3,
   when a session is over budget and contains two reducible non-paired slots
   whose resolved exercise and function are identical, the later slot is
   re-selected with the session-reuse filter raised to a hard filter. If that
   yields a complementary exercise, the day keeps distinct jobs at the same
   dose; if it yields nothing, the later slot is omitted with the limitation
   `redundant_assistance_omitted` before any station is trimmed to its floor.
   This is the audit's "resolve redundant work before trimming every job
   toward one set". Omitting a reducible slot is not in the approved §15
   wording, so it needs OD-3; without approval, the step only re-selects and
   never omits.
4. **Reductions are permanent and say so.** `reductions` keep their shape; the
   copy for `entry.adjusted.reduce.*` stops saying "First week" (X02).
   Re-entry week reductions keep their separate wording.
5. **Exported bounds are consistent.** `minSets` / `maxSets` on program rows
   keep coming from the class, and the invariant `minSets ≤ sets ≤ maxSets`
   is enforced at projection; a violation is a thrown compiler bug, not a
   returned program.

### Stage 5 — assessment and decision trace

`compile()` returns, alongside the existing fields, a `review` object that
the adapter forwards to the preview and that tests use as a semantic oracle:

```js
review: {
  priorities: [{ muscle: "chest", outcome: "selection_changed" | "ordering_changed" | "already_covered" | "no_room", slotIds: [...] }],
  coverage: [{ function: "hip_extension", status: "direct" | "secondary_only" | "none", weeklySets, slotIds }],
  sessions: [{ dayId, distinctExercises, repeatedExercises: [{ libraryId, slotIds, authoredRelation: bool }] }],
  foundation: { zeroRirSlots: [] },
}
```

and each resolved slot gains `selection: { decidedBy: "<key name>",
runnersUp: [{ libraryId, lostOn: "<key name>" }] }` (at most three). The
decision trace is **preview-only**: `projectProgram` and `programStructure`
do not persist it, so no durable schema changes. It gives the UI a truthful
"why this exercise" and gives the quality suite an explanation when a metric
moves.

Priority outcomes are computed *after* dose fitting, so a priority that was
honoured and then trimmed away reports `no_room` with the reduction step that
removed it (Q05).

New limitation codes (each needs EN and PT copy; `test/program-entry-browser.mjs`
already scans the compiler source for codes and fails on missing copy):
`home.posterior_capability_unavailable`, `redundant_assistance_omitted`,
`priority.already_covered`, `priority.no_room`, `coverage.secondary_only`,
`capability.demanding_bodyweight_skipped`.

### Stage 6 — the quality harness

The audit tool is committed as `tools/audit-program-generation.mjs` with this
plan. It becomes the engine's regression and quality gate:

- `test/fixtures/program-generation-corpus-v1.json`: the 200 audited
  contexts and 308 probe inputs (inputs only, about 150 KB), with their audit
  ids so findings stay traceable. No outputs are pinned here.
- `test/program-generation-quality.mjs` (fast lane): compiles the corpus,
  runs the audit's twenty-one contract dimensions as hard assertions (the
  evaluator already has a six-fault falsification record), and computes the
  quality metrics table below. Metrics are compared with
  `test/fixtures/program-generation-quality-baseline.json`; a metric may hold
  or improve, and the baseline is regenerated deliberately with a reviewed
  diff, exactly like the family fixture. Known failures are listed in the
  baseline as expected until the slice that fixes them lands, so the gate is
  green from S0 while recording the debt.
- The coaching inventory markers (`coaching-inventory.py`) are ported into the
  same suite so Q-findings have executable counts: knee-flexion presence,
  knee-dominant posterior, single-exercise day, three-hinge day, hinge before
  paired practice, demanding bodyweight default, Foundation zero RIR,
  unchanged priority counterfactual.
- `test/generative/properties/program-compiler.mjs` gains invariants under
  random valid contexts: sets within class bounds on every slot; no required
  intent satisfied by a secondary label; determinism; time ceiling respected
  or conflict returned; more minutes never yields fewer sets; longer rest
  preference never shortens rest; a muscle priority never reduces that
  muscle's direct sets; de-emphasis never increases them; re-entry changes
  sets only; `validatePrescription` accepts every envelope.
- Performance budget: median compile ≤ 10 ms and p95 ≤ 25 ms on the corpus in
  Node (today about 2 ms). Stage 3 adds a second pass; the budget leaves a
  five-fold margin and is asserted descriptively, not as a CI failure.

## Acceptance targets

All targets are measured on the 200-program corpus by
`test/program-generation-quality.mjs` and reported before/after in each PR.
"Diagnostic" rows are reported, never gated, because variety is not an
objective.

| Metric | Baseline (HEAD) | Target | Gate |
|---|---:|---:|---|
| Programs with contract failures | 18 | 0 | hard |
| Slots below the class set floor | 94 | 0 | hard |
| Compiled programs whose exported `minSets > sets` | 18 | 0 | hard |
| Knee-dominant exercise in a `home_posterior` job | 19 | 0 (limitation instead) | hard |
| Home 5–6 day with one exercise in three entries | 10/10 | 0 | hard |
| Sessions with three entries of the same hinge | 53 | 0 | hard |
| Within-session repeat without authored relation or scarce-capability flag | 129 | ≤ 10, all flagged in `review.sessions` | ratchet |
| Gym programs with a `hamstring_assistance` job, a hinge in the week and a leg curl available that select knee flexion | 0/167 | ≥ 95 % | ratchet |
| Foundation programs permitting 0 RIR anywhere | 20/53 | 0 | hard |
| Foundation Balanced/Strength defaulting to barbell lunge or decline bench | 25/25 | 0 | hard |
| Muscle-priority programs byte-identical without the priority and without an `already_covered` outcome | 7/29 | 0 | hard |
| Balanced 4 "Lower volume" with hinge before the paired squat practice | 9 | 0 | hard |
| Unassisted chin-up, dip or GHR as a default without history or must-have | 15/33 Home | 0 | hard |
| Band-only contexts selecting no band exercise when a band fills a missing function | 12/12 | 0 | hard, after OD-6 |
| Machines-only Balanced 3/4 at 60 min | conflict | compiled | hard, after catalogue v2 |
| `priority_only` slot resolving through a secondary label | n/a | 0 | hard |
| Distinct exercises used across the corpus | 43/271 | report | diagnostic |
| Top-ten exercise share of slots | 66.2 % | report | diagnostic |
| Median / p95 compile time | 2.3 ms / — | ≤ 10 / ≤ 25 ms | descriptive |

## Execution slices

Each slice is one PR with its own acceptance table per
`docs/agents/implementation-evidence.md`. Every slice regenerates
`test/fixtures/program-families-v1.json` only if its diff is reviewed slot by
slot with a coaching rationale per changed `libraryId`, and never regenerates
it to make a failing semantic assertion pass. Every slice that touches
`program-compiler.js` or `exercises.js` bumps the `sw.js` `CACHE` revision and
the protected script query revision per `AGENTS.md`, and recaptures the UI
screen frames that render a recommended program.

### S0 — Harness and baseline (no engine change)

- Commit the audit tool (done with this plan), the corpus fixture, the quality
  suite with the current metrics as baseline and the audited failures listed as
  expected, the generative invariants that already hold, and the slim audit
  record under `docs/audits/`.
- Wire the suite into `test/suites.mjs` (fast lane) and
  `tools/test-selection.mjs` (`program-compiler.js`, `exercises.js`,
  `tools/exercise-curation.json` select it).
- Proof: replay digest of the corpus equals `92f9e0be…`; the six evaluator
  falsifications still reject; CI green with the debt recorded.

### S1 — Contract repairs (compiler 3, rules 2)

- Stage 4 items 1, 2, 4, 5. `VERSIONS.compiler = 3`, `VERSIONS.rules = 2`.
- X02 copy fix in EN and PT.
- Entry draft handling: a draft saved under compiler 2 keeps its preview and
  offers "Rebuild with current rules" (Plan 048 L272; verify
  `test/program-entry-rules-recovery.mjs` covers version 2 → 3).
- Risky first proof: the F01 reproduction input (`balanced`, 3 days, 45 min,
  standard) returns either a program with every compound at ≥ 2 sets or
  `time_ceiling_conflict`; S002 (Foundation Growth 2 at 30 min) has no 0 RIR.
- Expected fixture change: a handful of review compilations at the 90-minute
  fixture budget should not change at all; assert that the fixture diff is
  empty, which proves S1 only affects time-pressured programs.
- Targets closed: rows 1–3, Foundation 0 RIR.

### S2 — Catalogue v2 (data and build only)

- Author `compiler` blocks for every entry reachable by any slot template in
  the corpus (about 90 entries), starting with the functions taxonomy, sissy
  squat, split squats and lunges, every hinge, every leg curl, every rear-delt
  movement, the demanding bodyweight set, and authored practical ranges for
  the machines-only heavy pool. Coaching review of this data is OD-2.
- Replace the `beginnerFriendly` regex with explicit curation values where the
  compiler reads them; keep the picker field untouched.
- `tools/build-exercises.mjs --check` validates vocabularies; `--report`
  lists inference reliance.
- Engine consumes nothing new yet, except that `normalizeCatalogue` reads the
  block when present. Because `candidateFits` still uses patterns, the family
  fixture must not change in S2; assert the empty diff.
- Targets closed: none directly; X01 becomes closable in S3.

### S3 — Jobs and selection v2 (blueprint 2, catalogue consumed)

Split into three PRs if the review load demands it:

- **S3a** function matching and primary-intent rule (Stage 2 without the
  blueprint edits), apparatus and skill gating, pattern → function mapping for
  `priorityMovements`, relations by slot id (X07). Closes the sissy posterior
  row, the demanding-bodyweight row, the machines-only row, the
  `priority_only` row.
- **S3b** session/week state, fill order, keys 6–8, decision trace. Closes the
  three-hinge row, the knee-flexion ratchet, most of the within-session repeat
  ratchet, and the Foundation heavy-default row together with S2 data.
- **S3c** blueprint v2 edits after OD-1: Home coverage jobs, Balanced 4
  ordering class. Closes the Home 5–6 row and the Balanced 4 row.
- Proof for each: the quality suite's before/after table; the family fixture
  diff reviewed slot by slot; `test/program-family-fixtures.mjs` hard-coded ids
  (`sq_sm` over `sq_lp`, `cd_mc` continuity in `program-entry-browser.mjs:1223`,
  the plan048 `sq_lp` de-emphasis case) re-checked rather than edited to pass;
  the install-transfer clone fixture hash unchanged (it is frozen, not
  re-derived).

### S4 — Dose fitting v2 and assessment surface

- Stage 4 item 3 (after OD-3), Stage 5 review object and limitation codes, EN
  and PT copy, adapter forwarding, "What Taurifer adjusted" rendering the
  priority outcomes and coverage limitations using the existing surface and
  its existing visual roles (no new screen; Plan 064 owns new screens).
- Proof: the priority-counterfactual row; `program-entry-browser.mjs` code-to-
  copy scan passes; screen catalogue recaptured for the review frame.

### S5 — Owner-gated dose policy (OD-4, OD-5, OD-6)

- Returning protected-dose option: a set-only reduction of protected compound
  work in returning week 1 (for example three → two sets on protected
  compounds, never on heavy primaries' identity, rest or strategy), expressed
  as `RULES.reentry.returning.protectedSetDelta` and recorded in week
  prescriptions only. Design §10 requires sets-only re-entry; the amendment
  forbids RIR modifiers; this stays inside both.
- Foundation short-session authored day variants for 30–45 minutes with fewer
  stations, as authored sibling data with the same day labels, used only when
  the normal day cannot fit after S4.
- Band candidate set and the ordinal-loading strategy mapping.
- Capability indication: if OD-5 approves a question, it is specified for
  Plan 064's onboarding; until then the engine uses history and must-haves as
  the indication.

### S6 — Closure

- Re-run both audits on the final head into
  `docs/audits/program-generation-<date>/` and `coaching/`, with the same
  200 contexts, publish the before/after table, and have an independent
  coaching review of the shortlist programs (S100, S096, S091, S095, R027,
  R068, R016, R002, S098) read the new outputs.
- ADR 0017 "Function-aware program generation" recording: catalogue
  `compiler` block ownership, blueprint version vs id, the decision trace as
  preview-only data, the quality ratchet as a gate, and the reduction-order
  interpretation (OD-3).
- Update `docs/program-family-design.md` (selection order, assessment), the
  `CLAUDE.md` ownership row for `program-compiler.js`, `tools/README.md`
  (curation `compiler` block, `--report`), and `plans/README.md`.

## Owner decisions required

| ID | Decision | Default if not decided | Needed by |
|---|---|---|---|
| OD-1 | Approve slot-table edits to Home 4/5/6 (three distinct coverage jobs) and Balanced 4 (ordering class on "Lower volume"). Day labels and the 20-structure contract do not change. Old Plan 047 L227 reserves slot tables for owner approval. | S3c does not land; the Home 5–6 single-exercise day persists as a flagged limitation | S3c |
| OD-2 | Coaching review of the authored catalogue data (functions, skill, `foundationDefault`, heavy-pool practical ranges). This is a data review, not a product decision, but it changes Foundation defaults. | S2 ships with the implementer's authoring and an "unreviewed" marker in the build report | S2 |
| OD-3 | Allow dose fitting to omit a *redundant reducible accessory* (same exercise and function already in the session) before trimming stations to their floors, recorded as a limitation. Extends §15 step 3's wording. | Fitting only re-selects; it never omits; more days reach `time_ceiling_conflict` at 30 minutes | S4 |
| OD-4 | Approve a returning-week set-only reduction of protected compound work (Q07). | Returning programs keep full protected dose, as today | S5 |
| OD-5 | Whether onboarding may ask one capability question for demanding bodyweight movements (pull-up / dip / GHR ability), owned by Plan 064 if approved. | Engine uses history and must-haves as capability evidence; demanding movements are never defaults otherwise | S5 |
| OD-6 | Approve a vetted band candidate set and the progression mapping for ordinal loading (`range@1` on band entries, or `manual@1` per the strategy contract's loading compatibility). | No band entries; band-only Home stays bodyweight-only with the posterior limitation visible | S5 |
| OD-7 | Backlog placement: S0–S1 as Now rows beside the advisor-plan data-safety fixes; S2–S4 as a pre-059 candidate item; S5 Gated. | This plan stays PROPOSED and nothing starts | S0 |

## Compatibility and migration

- **Activated programs**: untouched. They carry provenance
  `compilerVersion: 2`; `substitute()` on them uses the instance's own
  relations (X07) and the current catalogue, which may now reject a
  substitution that v2 accepted (for example a sissy squat into a posterior
  slot). That is correct behaviour and is covered by a regression.
- **Entry drafts**: Plan 048's version-mismatch rule applies; a draft under
  compiler 2 shows "Rebuild with current rules".
- **Setup links**: the v3 payload carries slot ids and progression envelopes,
  not blueprint internals; a link made from a compiler-2 program keeps
  decoding. `splitId` validation keeps `*_v1`.
- **Transitions**: `program-transition.js` sibling proposals compile with the
  current compiler by design (updates offered, never applied); its tests run
  in the `state` lane on every slice.
- **Install-transfer clone fixture**: frozen growth_3 compile, hash-checked,
  not regenerated.
- **UI screen catalogue**: frames that render a recommended program change
  whenever defaults change; recapture with `--affected --accept-visual-change`
  and review the PNGs.
- **Service worker**: bump `CACHE` and the protected query revisions for
  `program-compiler.js` and `exercises.js` per `transitionAssets`.

## Verification

Per `docs/ci.md`: owning suites during development (`node tools/run-tests.mjs edit`),
then push for the complete remote inventory. The owning suites for this plan:

```sh
node test/program-generation-quality.mjs          # new, S0
node tools/build-program-family-fixtures.mjs --check
node test/program-family-fixtures.mjs
node test/program-compiler-plan048-preferences.mjs
node test/program-entry-production-adapter.mjs
node test/generative/run.mjs --filter program-compiler
node tools/build-exercises.mjs --check             # S2 onward
node tools/audit-program-generation.mjs /tmp/program-generation-audit-replay
```

Browser evidence per slice: `program-entry-browser`, `program-compiler-runtime`,
`program-compiler-persistence`, `shared-setup-flow`, `journeys-in` /
`journeys-out`, and the `visual` shards. Completion evidence is a green `ci`
check on the final head plus the slice's acceptance table and the quality
before/after table.

Test-authoring policy (AGENTS.md): the corpus suite and generative invariants
are legitimate isolation targets ("algorithms with combinatorial boundaries")
and must be written failure-first; S0 lands them red-with-recorded-debt before
S1 turns the first rows green.

## Why "orders of magnitude better" is the right framing, and what it is not

The audits show that the engine's authored layer (families, structures,
prescription classes, progression contracts, re-entry) is sound and that its
failures cluster in the one layer that was never authored: how a job becomes
an exercise and a dose in the context of a whole week. Giving that layer
authored data, week-awareness, floors, and a self-assessment changes the
engine from "picks the top-ranked compatible exercise per slot" to "composes
a week that honours each job, each stated priority, each capability, and each
limit, and can say why". Measured on the audited corpus, that is the
difference between 18 contract failures and 137 review flags today and zero
contract failures with every remaining flag being an explicitly surfaced,
honest limitation.

It is not a different product. Nothing here adds a family, a strategy, a
cap, a reroll, or a model. The compiler remains an authored-blueprint
resolver; it just resolves well.
