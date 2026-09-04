# Plan 047: Taurifer program families and deterministic compiler

> **Status note (UI overhaul, Plan 049):** this plan is implemented history;
> the shipped compiler and catalogue are the implementation record. Current-
> tense guidance here stands except where G-01–G-88 supersede it (see the
> disposition register); Plans 052/056 own transition and recovery derivation
> from compiler output. Do not execute this plan against current code.

> **Superseded where amended.** The implementation authority is
> `plans/047-owner-approved-amendment.md`, with behavior defined by
> `docs/plan-047-owner-approved-design.md` and effort progression by
> `docs/progression-effort-target-v1.md`. In particular, this older plan's
> allocation matrix, recipe-derived sibling frequencies, Home positioning,
> Foundation caps, and re-entry RIR modifier are retired.

## Status

- **State:** IMPLEMENTED (see status note above); do not execute
- **Priority:** P0 — third item in the canonical alpha queue
- **Effort:** XL
- **Risk:** HIGH — this is Taurifer's authored training product, not sample data
- **Depends on:**
  [Plan 046](./046-multi-strategy-progression-engine.md),
  the family contract in the
  [business/product thesis](../docs/business-product-thesis.md), and the
  consolidated family decisions in the
  [decision register](../docs/product-grilling-decision-register.md)
- **Blocks:** Recommend/Custom/Browse in Plan 048, the rolling program-based
  alpha, advanced Pro generation, and history-aware next-program selection
- **Phase gate satisfied:** initial family/compiler prerequisite in Plan 044
  Phase A

## Outcome

Taurifer owns a small set of original, versioned hypertrophy and general-
strength program families. Every family compiles through one deterministic,
dependency-free compiler into the same editable program and progression model
used by built, imported, and shared programs.

The initial catalogue contains:

- three principal intent families, internally identified as muscle-growth,
  balanced muscle-and-strength, and strength-priority until final public names
  are approved;
- genuine three-day and five-day sibling blueprints for every principal
  family;
- a separate limited-equipment, consistency-first Home family with genuine
  three-day and five-day forms;
- reviewed two-day, four-day, and six-day generated recipes for Recommend and Custom,
  without requiring every recipe to appear as a Browse card;
- an internal Foundation/simple-start profile and a separate short re-entry
  treatment, neither presented as a goal alongside hypertrophy and strength.

All program weeks have the same day/slot structure. Six weeks is the default
block. Progression changes prescriptions; it does not rotate exercises or
schedule a deload.

## Why this is a separate plan

Plan 046 builds reusable training methods. This plan authors programs with
those methods. Keeping them separate prevents program-specific engine branches
and lets the family design be reviewed on its own merits.

Plan 048 owns the questions and presentation that select a family. This plan
accepts a validated context and returns deterministic candidates/drafts. It
does not decide the onboarding UI.

## Current-state audit

Re-check these findings against `HEAD`:

- The current generator is embedded in `app.js` through `DAY_TYPES`,
  `SESSION_BOUNDS`, `resolveSplit`, catalogue ranking, rep-scheme selection,
  priority-muscle application, session-length trimming, and
  `generateProgramFromOnboarding`.
- Current generation chooses exercises for generic day slots but has no public
  family, blueprint, slot, compiler, rules-version, time-model, or provenance
  contract.
- Goal, maturity, frequency, split, equipment, priorities, and vague session
  length are stored directly in `programMeta`; unknown source/version fields
  are currently normalized away.
- Program days are inferred from exercise `day` strings. A truly empty authored
  day cannot exist; `Program.addDay()` creates a placeholder exercise.
- The program editor, backup, shared setup, import, history/archive, and block
  transition all assume the flat exercise list.
- The current generator covers two through six days. The replacement may not
  regress that coverage merely because the public Browse catalogue is smaller.

## Locked decisions

1. Taurifer does not copy named programs from Boostcamp, Reddit, books, PDFs,
   forums, coaches, or other apps.
2. A family is a durable training promise and structure, not a marketing name
   for every frequency/equipment variant.
3. Principal families have genuinely authored three-day and five-day sibling
   blueprints. One schedule may not be mechanically stretched into the other.
4. Recommend and Custom continue to serve every schedule from two through six
   days. Three and five use the principal authored siblings; two, four, and six
   use reviewed, versioned recipes.
5. Home is a separate consistency-first family only for genuinely limited
   home equipment. A full home gym uses ordinary families.
6. Foundation is an internal simple-start profile. Recent inconsistency is a
   separate input; experienced returners keep appropriate program complexity
   and may receive a one- or two-week re-entry treatment.
7. The later high-volume family is not required for alpha.
8. Initial volume depends only on training maturity, weekly frequency, and
   available session minutes. Never ask or infer a known “volume tolerance.”
9. Preferred rest interval helps estimate available training time. Time is a
   ceiling, not an aspiration to fill every minute.
10. Muscle priority redistributes a bounded program budget; it does not create
    unlimited extra volume. At most two muscles may be primary.
11. The initial product covers hypertrophy and general strength. Squat, bench,
    and deadlift may appear, but Taurifer makes no powerlifting/meet-prep claim.
12. Browse shows only complete, executable, tested programs. No disabled cards,
    “coming soon,” or “unvalidated program” badge.
13. Activated instances are pinned to blueprint/compiler/rule versions. Updates
    are offered, never silently applied.
14. Once activated, the program belongs to the athlete: they may edit, rename,
    or change to another supported progression strategy. Provenance remains;
    substantial structural edits become “Customized from …”.
15. The engine never reads family ID, public program name, provenance, or
    entitlement.
16. Every programmed week has the same structural schedule. No blueprint or
    compiler rule schedules a deload.

## Reference and copyright boundary

The supplied “Powerbuilding System” PDFs were planning inspiration only. They
are not implementation sources, validation material, or acceptance evidence.
Implementation agents must not inspect or derive schedules, prescriptions,
exercise order, progression rules, fixtures, tests, or review claims from
them. Whether those files are available in a particular workspace is
irrelevant to implementation.

The only implementation authority is Taurifer's own plan, decision register,
strategy contracts, and reviewed fixtures. Those sources preserve structural
ideas already abstracted during planning:

- primary versus assistance slot roles;
- an anchor set followed by back-off work where the selected strategy supports
  it;
- separate heavy and volume exposures for a comparable movement;
- effort targets and practical rest/time constraints;
- distributing hypertrophy assistance around strength-priority work;
- one unchanged weekly structure throughout the block;
- six weeks as the default block length;
- evidence-triggered deloads only after observed performance stagnation or
  degradation, never scheduled deloads;
- original Taurifer structures at every frequency from two through six days;
- one shared progression engine with no family-specific algorithm branch; and
- deterministic compilation under bounded time and volume rules.

Do not copy or closely paraphrase the PDFs' names, explanations, tables,
exercise order, exact set/rep/load prescriptions, percentage progressions,
week alternation, or schedule. Do not use them to fill a gap in an incomplete
Taurifer contract. An incomplete or owner-gated Taurifer rule remains blocked
until its authoritative contract and reviewed fixture exist.

The family design document must keep a source ledger separating:

- broad uncopyrightable programming concepts;
- supporting published training evidence;
- Taurifer's own design choice;
- the exact original blueprint that results.

A design that can be recognized as a copied table with renamed labels fails
this plan.

## Scope

### In scope

- family and blueprint schemas;
- explicit day/slot program-instance structure;
- deterministic compiler and rule versions;
- initial family design, scientific rationale, and executable fixtures;
- volume/time/equipment/priority allocation;
- exercise selection and substitution constraints;
- complete two-through-six-day coverage described above;
- Foundation/simple-start and re-entry profiles;
- provenance, version pinning, ownership/customization semantics;
- persistence, backup, program export/import, shared setup, archive, and
  migration changes required by the new instance model;
- catalogue data consumed later by Browse;
- generative/model-based/compiler/browser/simulation tests.

### Out of scope

- onboarding or Browse screens (Plan 048);
- Pro advanced specialization, history-aware selection, or interventions;
- multi-gym sibling instances and contextual machine mappings;
- one-off sessions;
- external named-program licensing or creator publishing;
- powerlifting/meet preparation;
- a public high-volume family;
- cloud delivery or remote blueprint updates;
- individual alpha-participant program audits.

## First deliverable: program-family design specification

Before compiler code, create `docs/program-family-design.md` plus executable
blueprint fixtures. The document must be reviewed as a complete system, not as
isolated exercise lists.

For each principal and Home sibling, include:

- stable internal family/blueprint ID and version;
- proposed PT-BR and English public name/copy for owner approval;
- one-sentence promise and explicit non-goals;
- suitable goal, structured-program experience, recent-consistency treatment,
  equipment assumptions, and session-time range;
- actual weekly day structure and why the 3-day and 5-day versions are genuine
  siblings;
- movement-pattern, muscle, and primary-lift exposure map;
- working-set allocation by slot/muscle role and maturity band;
- selected Plan 046 strategy/version for every slot;
- paired-exposure relations and anchor/back-off roles;
- effort/RIR targets and rest assumptions;
- warm-up, transition, and buffer assumptions used by the time estimate;
- equipment fallback and substitution class per slot;
- two-/four-/six-day generated-recipe relationship where applicable;
- Foundation and re-entry changes, with exact affected weeks/parameters;
- known compromises and why alternatives were rejected;
- research sources and original-design declaration;
- synthetic six-week and 52-week example outputs.

The owner must approve the actual slot tables and public names/copy before
they become user-visible. Stable internal IDs must not depend on the final
marketing names.

## Family set and design constraints

### Principal family A — muscle-growth priority

Training promise: allocate the available week primarily toward balanced
hypertrophy while retaining enough repeatable compound work to measure and
progress performance.

Design constraints:

- no implicit strength peaking;
- most assistance slots use range or rep-goal progression;
- anchor/back-off may be used where a stable primary movement improves session
  organization, but is not required merely to look advanced;
- all major muscle groups receive deliberate coverage inside the time budget;
- priority muscles reallocate assistance volume and slot order without
  violating minimum whole-program coverage;
- three- and five-day structures each distribute fatigue and muscle frequency
  credibly rather than splitting the same total exercise list mechanically.

### Principal family B — balanced muscle and strength

Training promise: make measurable progress on selected primary movement
patterns while retaining substantial hypertrophy work.

Design constraints:

- explicit primary and assistance roles;
- suitable use of anchor/back-off and paired heavy/volume exposures where
  Plan 046 declares compatibility;
- no requirement that a user supply named competition lifts;
- enough exercise variety for hypertrophy without undermining repeated primary
  movement practice;
- three-/five-day siblings share the balance, not necessarily the same split.

### Principal family C — strength priority

Training promise: prioritize progress on general-strength primary movements
while maintaining a coherent hypertrophy base.

Design constraints:

- repeated practice of selected primary patterns with clear heavy/volume or
  anchor/back-off roles;
- bounded assistance volume chosen from maturity/frequency/minutes;
- no powerlifting label, meet date, peaking, taper, attempt selection, or
  competition-percentage dependency;
- compatible alternatives for users who do not select squat/bench/deadlift;
- five days must not imply five maximal primary sessions; three days must not
  pack every stressor into each session.

### Home family

Training promise: minimize setup and equipment friction so a limited-equipment
user can build a consistent resistance-training habit with a real progressive
program.

Design constraints:

- genuine 3-day and 5-day forms;
- only limited, explicitly declared equipment assumptions;
- simple exercise transitions and small equipment-change cost;
- no claim that it is the best choice for a full home gym;
- progression remains compatible with the available loading granularity;
- it stays a family, not just the ordinary family with machine exercises
  filtered out.

### Foundation and re-entry

Foundation is an internal profile, not another public desired result.

- `simple_start`: for genuinely new structured-program users or someone who
  explicitly asks for the simplest start; reduces decision/coordination burden
  while preserving a complete program.
- `reentry`: for a previously experienced user with low recent consistency;
  keeps goal-appropriate movement/program complexity but applies a conservative
  one- or two-week modifier settled in the design fixtures.

Neither profile can introduce a scheduled deload or permanently label the user
as a beginner.

## Declarative blueprint model

### 1. Add pure data and compiler modules

Add:

- `program-blueprints.js`: frozen, declarative, versioned family and blueprint
  records; no algorithm or DOM access;
- `program-compiler.js`: dependency-free UMD compiler usable in browser and
  Node; no app state, i18n, storage, or network access.

`program-blueprints.js` contains i18n keys, never rendered copy. The compiler
receives an exercise-catalogue snapshot and explicit rule tables as inputs so
tests can supply small hostile/synthetic catalogues.

### 2. Family schema

Minimum family record:

```json
{
  "schemaVersion": 1,
  "id": "growth",
  "version": 1,
  "public": true,
  "browse": true,
  "nameKey": "program.family.growth.name",
  "purposeKey": "program.family.growth.purpose",
  "goalFit": ["muscle_growth"],
  "maturityFit": ["new", "some", "established"],
  "equipmentFit": ["commercial", "full_home"],
  "blueprints": { "3": "growth_3_v1", "5": "growth_5_v1" },
  "generatedRecipes": {
    "2": "growth_2_v1",
    "4": "growth_4_v1",
    "6": "growth_6_v1"
  }
}
```

Use stable machine IDs such as `growth`, `balanced`, `strength`, and `home`
unless the design review exposes a genuine domain conflict. Do not rename IDs
when public copy changes.

### 3. Blueprint schema

Minimum blueprint record:

```json
{
  "schemaVersion": 1,
  "id": "balanced_3_v1",
  "version": 1,
  "familyId": "balanced",
  "daysPerWeek": 3,
  "defaultBlockWeeks": 6,
  "timeModelVersion": 1,
  "allocationRuleVersion": 1,
  "days": [
    {
      "id": "d1",
      "nameKey": "program.day.full_body_a",
      "slots": []
    }
  ]
}
```

Every slot declares at least:

```json
{
  "id": "d1_primary_press",
  "order": 1,
  "role": "primary",
  "movementPatterns": ["horizontal_press"],
  "primaryMuscles": ["chest"],
  "secondaryMuscles": ["triceps", "front_delts"],
  "exerciseSelection": {
    "requiredCapabilities": [],
    "equipmentClasses": [],
    "substitutionClass": "horizontal_press_stable"
  },
  "prescription": {
    "setsByMaturity": {},
    "repTarget": {},
    "targetRir": {},
    "progression": {}
  },
  "time": {
    "warmupClass": "primary",
    "transitionClass": "new_station"
  },
  "priorityBehavior": "eligible | protect | reduce_first | none",
  "optional": false
}
```

Paired exposure records refer to slot IDs and Plan 046 relation versions. No
slot contains executable JavaScript or family-specific formula text.

### 4. Add explicit program-day structure

The compiled program instance needs durable empty day containers for Plan 048
Build and stable provenance. Add a versioned structure under `programMeta`:

```json
{
  "structure": {
    "schemaVersion": 1,
    "days": [
      { "id": "stable day id", "order": 1, "name": "Day 1" }
    ]
  }
}
```

Exercises gain `dayId`; the current `day` string remains a compatibility
projection during migration. `Program.days()` reads explicit structure plus
exercises, so an empty day is real. Rename changes the day record/name and its
exercise projections without changing `dayId`.

Legacy migration:

1. derive ordered unique `day` strings;
2. assign deterministic IDs from program ID plus original order;
3. attach matching `dayId` to exercises;
4. persist on the next normal write/export;
5. preserve day IDs through rename, reorder, archive, share, and import.

All call sites constructing `Program` must either supply structure or use a
single normalizer that derives it. Do not let different screens infer different
day order.

## Deterministic compiler contract

### Input

```js
compileProgram({
  compilerVersion: 1,
  blueprint: { id, version },
  context: {
    goal,
    structuredExperience,
    recentConsistency,
    daysPerWeek,
    sessionMinutes,
    preferredRestSeconds,
    environment,
    equipmentCapabilities,
    primaryMuscles,
    deEmphasizedMuscles,
    ignoredMuscles,
    priorityMovements,
    mustHaveExercises,
    avoidedExercises
  },
  catalogue,
  ruleVersions
})
```

The compiler receives normalized closed IDs only. It does not receive free
text, entitlement, telemetry identity, participant status, public acquisition
source, or an arbitrary random seed.

### Determinism

- Canonicalize inputs and all rule/catalogue/blueprint versions.
- Sort candidates by explicit rank and stable exercise ID.
- Resolve ties deterministically.
- Same inputs and versions produce the same semantic output.
- “Try again” cannot be a random reroll. A user changes a material preference
  or edits the resulting draft.
- Return a deterministic fingerprint/hash of inputs and versions for local
  provenance, never telemetry.

### Output

```js
{
  "kind": "compiled | incompatible | invalid",
  "program": { "structure": {}, "exercises": [] },
  "programMeta": {
    "source": {
      "type": "recommend | custom | browse",
      "familyId": "balanced",
      "familyVersion": 1,
      "blueprintId": "balanced_3_v1",
      "blueprintVersion": 1,
      "compilerVersion": 1,
      "allocationRuleVersion": 1,
      "timeModelVersion": 1,
      "catalogueVersion": 1,
      "contextSchemaVersion": 1,
      "fingerprint": "local deterministic hash"
    }
  },
  "summary": {
    "estimatedMinutesByDay": [],
    "muscleAllocation": [],
    "progressionCategories": [],
    "compromiseCodes": []
  },
  "diagnostics": []
}
```

Compiler diagnostics and summaries contain codes/numbers/IDs for local UI;
none are analytics properties by default. Output contains no translated text.

## Allocation rules

### 1. Volume budget

Base working-set allocation may depend only on:

- structured-program experience/maturity;
- weekly frequency;
- chosen session-minute ceiling.

Do not ask for, store, or infer a precise personal volume tolerance. Recent
consistency may apply the reviewed temporary re-entry modifier but may not
permanently redefine maturity.

Version the allocation table. It must specify minimum/normal/maximum sets per
session and per role, and must be covered by design fixtures. Do not scatter
volume constants across blueprints and compiler branches.

### 2. Time model

Version one time estimator using:

- working-set execution allowance;
- preferred rest interval, bounded where a slot genuinely needs more/less;
- warm-up sets/time by slot class;
- exercise-station transition cost;
- setup changes/equipment friction;
- a fixed uncertainty buffer.

For each day, calculate the estimate from selected exercises/prescriptions,
then treat `sessionMinutes` as a ceiling. If a blueprint cannot fit:

1. remove optional/lowest-priority assistance under its declared trim order;
2. reduce only sets whose slot declares a bounded range;
3. select a lower-transition compatible exercise where allowed;
4. return a typed compromise or incompatibility.

Never silently remove protected primary work or claim an estimate below the
model. Exact constants and worked examples belong in the reviewed family
design document and test fixtures.

### 3. Muscle priorities

- maximum two primary muscles;
- de-emphasized and ignored are distinct closed intents;
- redistribute inside the same time/volume budget;
- protect family-defining primary work and minimum whole-program coverage;
- use slot priority behavior, not ad-hoc exercise-name tests;
- if two priorities cannot fit, return a compromise requiring the UI to narrow
  or accept the stated trade-off;
- ignored does not mean injury-safe; pain/discomfort is a separate constraint
  and safety path.

### 4. Exercise selection

Filter/rank using structured catalogue facts:

- movement pattern and muscle role;
- equipment capability and environment;
- slot stability/coordination needs;
- required loading/progression capability;
- must-have/avoid preference and reason;
- duplication/interference rules;
- declared substitution class;
- stable deterministic ranking.

Never match by display-name substring. Never merge histories because two
machines have similar names. A must-have that is incompatible with the family
or available equipment produces a plain compromise/alternative.

### 5. Fixed-week structure

Compilation creates one weekly day/slot structure reused for all six default
weeks. Week-specific progression lives in Plan 046 modifiers/prescriptions.
The compiler must not emit alternating A/B weeks, rotating exercise schedules,
or a week-6 deload.

## Provenance, ownership, and updates

### Activation

Activation copies the compiled output into a normal user-owned program
instance and pins all source versions. The active instance does not refer to a
mutable global “latest blueprint.”

### Editing

- Rename or small compatible edits retain “From [family/program]” provenance.
- A structural change beyond a versioned threshold changes the public source
  label to “Customized from [family/program]” while retaining original
  versions internally.
- The exact substantial-edit rule must be deterministic and documented. It may
  consider day count, day structure, protected slot removal/replacement, and
  relation removal; it must not consider cosmetic rename alone.
- Engine behavior follows the active prescription, not the source label.

### Blueprint updates

- New blueprint release gets a new immutable version.
- Existing programs remain unchanged.
- A later migration UI compares the user's instance with the new blueprint and
  offers an explicit operation; silently changing active/archived programs is
  prohibited.
- Alpha may ship version 1 without a migration UI, provided it never mutates
  pinned instances and Browse uses only current versions.

## Integration with current state and sharing

Update:

- `normalizeProgramMeta` to validate/preserve source, structure, compiler/rule
  versions, context snapshot version, and progression relations;
- `Exercise`/`Program` to support `dayId`, empty day containers, and Plan 046
  prescriptions;
- archive/block transition snapshots so provenance/structure remain with the
  correct program;
- backup and program JSON schemas;
- shared setup verbose/compact schemas while preserving every released
  decoder;
- import review to show unknown/new family provenance as provenance only, not
  authority;
- text export to name the program/source/version without exposing internal
  hashes unnecessarily.

Do not put reusable onboarding context in a shared program payload. A shared
program shares the compiled prescription and safe author/source metadata, not
the originator's personal answers.

## Implementation sequence

### Slice 1 — design and fixtures

1. Write the original family design document and source ledger.
2. Finalize internal IDs, slot tables, allocation/time constants, 3-/5-day
   sibling designs, 2-/4-/6-day recipes, and Home/Foundation/re-entry behavior.
3. Review public names/copy separately from internal IDs.
4. Encode fixtures and synthetic expected summaries.
5. Reject any design that copies supplied/reference program tables.

### Slice 2 — program-instance/day/provenance model

1. Add explicit day structure and legacy migration.
2. Extend program metadata/source/version normalization.
3. Round-trip state, archive, backup, program JSON, and shared setup.
4. Add empty-day and provenance tests before compiler integration.

### Slice 3 — pure blueprint schema/compiler skeleton

1. Add frozen blueprint data and schema validation.
2. Implement canonical deterministic input/output and diagnostics.
3. Implement exercise-catalogue constraint filtering/ranking.
4. Prove no DOM/state/i18n/family-specific engine dependency.

### Slice 4 — time, volume, priority, equipment rules

1. Implement reviewed allocation table.
2. Implement reviewed time estimator and trim/compromise order.
3. Implement muscle reallocation and constraints.
4. Implement equipment and substitution-class selection.
5. Test hostile/insufficient catalogues and every boundary.

### Slice 5 — initial blueprints and recipes

1. Add each 3-/5-day principal sibling pair.
2. Add Home 3/5.
3. Add reviewed 2-/4-/6-day generated recipes.
4. Add Foundation/simple-start and re-entry profiles.
5. Compile every maturity/time/equipment/goal combination the product claims.

### Slice 6 — app adapter and ownership

1. Replace current generator internals with compiler calls behind a temporary
   adapter so existing UI can exercise output before Plan 048.
2. Activate through the existing transaction/draft conflict protocol.
3. Add source/version/customized provenance in Program UI.
4. Verify editing never mutates blueprints and engine output ignores source.

### Slice 7 — hardening and catalogue release gate

1. Run generative compiler and 52-week engine simulations.
2. Review every public Browse candidate as executable output, not an individual
   participant audit.
3. Validate PT-BR/English names/copy, time estimates, accessibility, and
   screenshots once surfaced by Plan 048.
4. Mark only fully tested blueprint versions `browse: true`.

## File-change map

| File | Required change |
|---|---|
| `program-blueprints.js` | New frozen family/blueprint/profile data and schema. |
| `program-compiler.js` | New pure deterministic compiler, allocation/time/selection rules. |
| `app.js` | Program/day/provenance model, compiler adapter, activation, editing ownership. |
| `shared-setup.js` | Structure/source/prescription round trip and bounds; preserve released decoders. |
| `index.html` | Load new modules before `app.js`. |
| `service-worker.js` | Cache new runtime modules and bump revisions. |
| `i18n/en.json`, `i18n/pt-BR.json` | Approved family/day/purpose/compromise/source copy. |
| `i18n.js` | Regenerate. |
| `docs/program-family-design.md` | Reviewed family tables, source ledger, time/volume models, examples. |
| `test/fixtures/program-families-v1.json` | Deterministic expected outputs/summaries. |
| `test/program-compiler.mjs` | Schema, deterministic, allocation, time, exercise, provenance tests. |
| persistence/import/share tests | Day structure, versions, migration, bounds, round trips. |
| `test/generative/` | Compiler commands/model/invariants and engine integration journeys. |
| browser tests | Existing UI adapter initially; full entry/catalogue tests in Plan 048. |

## Test requirements

### Blueprint/schema tests

- unique stable family, blueprint, day, and slot IDs;
- exact family/version references and no mutable records;
- every principal family has genuine 3/5 siblings;
- Home has 3/5 siblings;
- every claimed 2/4/6 recipe compiles;
- six-week default and identical weekly structure;
- no scheduled-deload field or week-specific exercise rotation;
- every slot strategy/modifier/relation exists and is compatible in Plan 046;
- every public string is an i18n key with PT-BR/English values;
- no external program/trademark/reference names or copied explanatory text.

### Compiler invariants

- deterministic byte-equivalent semantic output for identical inputs/versions;
- no input, catalogue, or blueprint mutation;
- no random reroll path;
- every compiled program has stable day/slot/exercise IDs and valid order;
- all exercises meet equipment/movement/strategy constraints;
- no invalid duplication or name-based identity merge;
- volume comes only from maturity/frequency/minutes plus declared temporary
  re-entry modifier;
- priority reallocation does not increase the total time/volume budget;
- maximum two primary muscles;
- estimated session time does not exceed the chosen ceiling unless the result
  is explicitly incompatible/compromised;
- every compromise has a closed reason and actionable alternative;
- no family/source/entitlement input reaches the progression engine.

### Coverage matrix

For every claimed combination, compile at least:

- goal/family fit;
- every frequency from 2 through 6 days where promised;
- every structured-experience band;
- every recent-consistency band and re-entry behavior;
- 30/45/60/75/90+ minute ceilings and rest choices;
- commercial/full-home/limited-home equipment assumptions;
- zero, one, and two priorities;
- compatible/incompatible must-have and avoidance reasons;
- insufficient equipment and undersized time-budget failure paths.

### Program-instance and ownership tests

- migrate legacy day strings into stable structure once;
- preserve truly empty days;
- rename/reorder/archive/share/import without losing day IDs;
- activate a draft without mutating prior active/archived program until commit;
- edit/rename compiled instance without mutating frozen blueprint;
- substantial-edit provenance transition is deterministic;
- old instance stays pinned after adding a newer blueprint version;
- engine output is identical when provenance/public name changes.

### Generated/model-based journeys

Generate compiler contexts and then execute:

- preview → edit → activate → six-week workouts → archive/transition;
- reload/export/import/share at arbitrary steps;
- strategy edits and relation repair;
- exercise-library version changes and missing candidates;
- 52-week representative sequences per family/frequency/maturity band.

Minimized failures become permanent named regressions.

### Human review gate

This is not an individual participant program audit. Before release, review:

- the underlying family design/rules;
- representative synthetic outputs across the coverage matrix;
- compiler/property/simulation failures;
- the final executable Browse versions.

The founder does not approve or repair every alpha enrollee's program.

## Acceptance checklist

- [ ] Original family design/source ledger and exact slot fixtures are reviewed.
- [ ] Supplied/reference programs are used only for broad concepts; no copied
      name, copy, table, exact schedule, or prescription ships.
- [ ] Principal growth/balanced/strength intents each have real 3-/5-day
      siblings; Home has 3/5.
- [ ] Recommend/Custom compiler preserves complete 2-through-6-day coverage,
      using authored 3/5 siblings and reviewed 2/4/6 recipes.
- [ ] Foundation/simple-start and experienced-user re-entry are distinct and
      not public goals.
- [ ] Compiler is pure, deterministic, versioned, and Node-testable.
- [ ] Initial volume uses only maturity, frequency, and minutes; rest feeds the
      versioned time model; no volume-tolerance question/inference exists.
- [ ] Fixed weekly structure and six-week default hold; no scheduled deload.
- [ ] Every slot uses Plan 046 primitives without family/program engine branches.
- [ ] Explicit day containers support empty days and migrate legacy programs.
- [ ] Program/source/compiler/rule versions round-trip through every durable
      and shared format.
- [ ] Activated programs are pinned, editable, owned, and never silently
      updated.
- [ ] Only fully executable/tested versions are eligible for Browse.
- [ ] Generated/model-based and 52-week simulations pass.

## STOP conditions

- STOP if a blueprint copies or closely tracks a copyrighted/named program
  table, wording, schedule, or exact prescription.
- STOP if family/public name appears in progression-engine control flow.
- STOP if a 5-day form is produced by mechanically slicing/stretching a 3-day
  exercise list, or vice versa.
- STOP if any current two-through-six-day coverage is dropped without a new
  owner decision.
- STOP if volume depends on a self-estimated tolerance or hidden user score.
- STOP if the compiler uses uncontrolled randomness or a reroll button.
- STOP if a time estimate ignores rest, warm-up, transitions, or buffer.
- STOP if a week rotates exercises or schedules a deload.
- STOP if a compiled program can be written before its structure/provenance/
  strategy data round-trips through backup/import/share/archive.
- STOP if blueprint updates mutate an activated program.
- STOP if Home is selected merely because the location is a house despite
  full-gym equipment.
- STOP if an incomplete/unreviewed family appears as a disabled or future
  catalogue card.
