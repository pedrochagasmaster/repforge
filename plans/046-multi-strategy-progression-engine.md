# Plan 046: versioned multi-strategy progression engine

## Status

- **State:** READY FOR IMPLEMENTATION after Plan 045's runtime boundary is
  merged; strategy science fixtures are the first deliverable of this plan
- **Priority:** P0 — second item in the canonical alpha queue
- **Effort:** XL
- **Risk:** HIGH — changes the recommendation source used during every workout
- **Depends on:**
  [Plan 039](./039-capacity-driven-suggestions.md),
  [ADR 0003](../docs/adr/0003-capacity-as-progression-currency.md),
  [Plan 043](./043-why-this-weight-inspector.md),
  [Plan 045](./045-posthog-measurement-foundation.md), and the locked engine
  decisions in the [decision register](../docs/product-grilling-decision-register.md)
- **Blocks:** Taurifer program families, revised onboarding, program-level
  interventions, history-aware generation, and paid Pro
- **Phase gate satisfied:** shared Free engine prerequisite in Plan 044 Phase A

## Outcome

Taurifer can execute and explain six explicit progression capabilities through
one shared, dependency-free engine:

1. range progression (the compatible successor to today's double progression);
2. total-rep / rep-goal progression;
3. anchor set plus back-off sets;
4. paired heavy and volume exposures of the same movement;
5. fixed-block profile modifiers such as step loading or rep-range emphasis;
6. manual progression, where Taurifer deliberately does not invent targets.

Capacity remains a shared measurement and anchor. It is no longer the name of
one universal prescription policy. RIR/effort remains evidence and an effort
target, not a separate progression strategy.

Every strategy is versioned, deterministic, explainable, editable through
bounded parameters, safe to import/export, and testable without a browser.
Legacy programs continue to produce today's range-progression behavior.

## Why this is a separate plan

The current engine, history aggregation, set suggestion logic, translation,
DOM rendering, settings, and persistence are interwoven in `app.js`. Adding
more `if (progressionType === ...)` branches there would create an untestable
family-specific engine. This plan first establishes the shared contract. Plan
047 then compiles program families into that contract; Plan 048 lets users
choose supported methods without exposing Taurifer's internal math during
generation.

## Current-state audit

Re-check these findings against `HEAD`:

- `Exercise` already persists `progressionType`, `targetRirStart`,
  `targetRirEnd`, `minSets`, `maxSets`, and `priority`, but the recommendation
  engine does not read `progressionType`.
- `Exercise.sets`, `min`, and `max` are the only executable prescription shape.
- `recommendation`, `baseSetReps`, `setSuggestion`, Capacity helpers, session
  history aggregation, and explanation assembly live inside `app.js` and read
  global state, settings, i18n, and DOM-adjacent helpers.
- `shared-setup.js` preserves the dormant fields in both verbose and compact
  payloads. Backup/import and text export have different fidelity.
- Plan 039 and current tests lock valuable behavior: capacity can extend but
  not retract a performed-rep jump; RIR credit is capped; set suggestions can
  temper from current-session evidence; block trend is weak; load is snapped
  to an actionable increment.
- The generative test README already calls for extracting progression into a
  dependency-free Node-reachable module.

## Locked product and science boundaries

1. All supported progression math and basic manual parameters are Free.
2. Pro later pays for history-aware selection and adaptation, not access to a
   mathematical formula.
3. No strategy branches on program ID, family ID, public name, or entitlement.
4. Capacity is shared evidence. A strategy decides how to turn evidence into a
   prescription.
5. Paired exposures relate two program slots; they do not merge the histories
   of different movements or incomparable machines.
6. A block has the same weekly day/slot structure every week. Progression may
   change targets, not silently replace the schedule.
7. Six weeks remains the default block length. A strategy must not manufacture
   a scheduled deload.
8. Deload is a later cause-routed intervention and may be proposed only after
   actual performance stagnation/degradation plus corroborating evidence.
9. There is no universal plateau escalation order. Diagnosis is case by case,
   and later interventions change the smallest cause-matched variable.
10. Manual means “show the authored prescription and relevant prior
    performance; do not invent a Taurifer target.” It is not an error state.
11. Unsupported or incompatible combinations produce a typed result and an
    explanation path. They never silently fall back to an unrelated strategy.
12. The user may change a selected program's strategy later, but only among
    methods Taurifer implements and validates.

## Scope

### In scope

- a pure engine and explicit evidence/prescription contracts;
- strategy registry and versioning;
- range, rep-goal, anchor/back-off, paired-exposure, block-modifier, and manual
  behavior;
- migration from current exercise fields;
- full persistence, backup, program export/import, shared setup, and editor
  support;
- recommendation and per-set suggestion UI for each strategy;
- explanation/provenance output for “Why this weight?”;
- deterministic, property-based, model-based, browser, and simulation tests;
- updated mechanics documentation.

### Out of scope

- detecting plateaus, recurring skips, or other Pro issues;
- selecting a strategy from history on the user's behalf;
- changing split, exercise selection, or program structure;
- arbitrary user formulas or a visual rule builder;
- powerlifting, meet preparation, tapering, or attempt selection;
- automatic deload scheduling;
- percentage-of-1RM peaking prescriptions;
- program family blueprints, onboarding, paywalls, or checkout.

## First deliverable: reviewed strategy fixtures

Do not start the UI or persistence migration by inventing formulas in code.
Create `docs/progression-strategy-contract.md` and a matching machine-readable
`test/fixtures/progression-strategies-v1.json` first.

For every strategy, the document and fixtures must state:

- user job and suitable exercise types;
- required prescription fields and valid ranges;
- minimum usable evidence;
- exact next-session and next-set calculation examples;
- behavior with no history, partial history, missed/extra sets, different
  loads, effort/RIR mode, load rounding, bodyweight movements, and invalid data;
- reason codes and explanation facts;
- incompatible combinations and the offered compatible/manual alternative;
- properties that must remain invariant;
- version number and what would require a new version.

The owner must review the numeric examples before implementation uses them as
truth. This is not an open-ended science phase: the contracts below define the
allowed shape, and fixtures settle the remaining numeric thresholds.

## Pure engine architecture

### 1. Extract a build-free module

Add `progression-engine.js` as a UMD module that is usable through both
`window.RepForgeProgression` and `require()`/dynamic import in Node. It must
have no DOM, local storage, i18n, date-global, mutable application state, or
network dependency.

Move or wrap the following pure responsibilities into it:

- Capacity and Epley helpers;
- finite-number validation and clamping;
- load-grid rounding;
- evidence summarization from normalized sessions;
- strategy dispatch;
- next-session recommendation;
- per-set/current-session recommendation;
- result/provenance construction;
- compatibility checks.

History selection remains outside the core initially. `app.js` converts its
stored log into the engine's normalized evidence. This prevents the engine
from learning Taurifer's persistence format.

### 2. Use explicit inputs

The engine entry point should accept one immutable object:

```js
evaluateProgression({
  engineVersion: 1,
  prescription,
  relation,
  modifiers,
  settings,
  history,
  currentSession,
  context
})
```

Minimum meanings:

- `prescription`: validated strategy/version/parameters for one program slot;
- `relation`: optional paired-exposure information supplied by the program;
- `modifiers`: validated fixed-block modifier list for the current week;
- `settings`: unit-independent load increment, jump percentage, effort/RIR
  bounds, and only other reviewed user settings;
- `history`: chronological normalized evidence for the same movement identity;
- `currentSession`: committed earlier working sets for this slot;
- `context`: week number, block length, exposure role, and relevant shared
  Capacity anchor. It contains no family or entitlement.

The function must not mutate any input. Same inputs and versions must produce
byte-equivalent semantic output.

### 3. Return facts and codes, never translated prose

Use one result union:

```js
{
  kind: "recommendation" | "manual" | "insufficient_evidence" |
        "incompatible" | "invalid",
  engineVersion: 1,
  strategy: { id: "range", version: 1 },
  target: {
    sets: [{ role, load, reps, repMin, repMax, targetRir }]
  },
  status: "new" | "advance" | "hold" | "reduce" | "recalibrate" |
          "manual",
  reasonCodes: ["..."],
  facts: { /* finite, typed facts used by explanation UI */ },
  provenance: { evidenceWindow, modifierVersions, relationVersion }
}
```

Exact fields may be normalized while implementing the fixture document, but
all strategies must use one discriminated result contract. `app.js` maps
reason codes/facts to PT-BR/English copy. Do not put rendered strings into the
engine or re-derive the rule in the explanation layer.

### 4. Persist one versioned prescription shape

Add to each exercise:

```json
{
  "progression": {
    "schemaVersion": 1,
    "strategy": {
      "id": "range",
      "version": 1,
      "params": {}
    },
    "modifiers": []
  }
}
```

Rules:

- stable IDs are `range`, `rep_goal`, `anchor_backoff`, and `manual`;
- paired exposure is a versioned relation between slot IDs, not a fifth
  mutually exclusive per-exercise strategy;
- block profiles are versioned modifiers, not family-name branches;
- strategy and modifier parameters have closed schemas and numeric bounds;
- unknown keys are rejected on shared setup and normalized/preserved safely on
  full backup according to the existing forward-compatibility policy;
- current `sets`, `min`, and `max` remain a compatibility projection for old
  screens/exporters during this plan, but the progression object is
  authoritative for recognized new prescriptions.

### 5. Store paired relationships at program level

Add a versioned collection under `programMeta`, for example:

```json
{
  "progressionRelations": [
    {
      "schemaVersion": 1,
      "id": "random stable relation id",
      "type": "paired_exposure",
      "version": 1,
      "movementId": "shared movement identity",
      "members": [
        { "exerciseId": "slot id A", "role": "heavy" },
        { "exerciseId": "slot id B", "role": "volume" }
      ]
    }
  ]
}
```

Validation must prove:

- exactly two distinct live slot IDs;
- both resolve to the same comparable movement identity;
- one heavy and one volume role;
- no slot belongs to two conflicting paired relations;
- replacing/detaching a movement either updates the relation through an
  explicit user action or marks it incompatible; it never shares history by
  name alone;
- machine aliases with the same `libraryId` may remain comparable; sibling
  machines with separate identities do not.

## Strategy contracts

### A. Range progression (`range@1`)

This is the compatibility strategy for today's RIR-aware double progression.
Its first version must preserve Plan 039 behavior exactly unless a fixture
explicitly records an approved correction.

Required parameters:

- working-set count;
- minimum and maximum reps;
- target effort/RIR window;
- load-grid minimum increment;
- ordinary percentage jump;
- optional target-RIR start/end carried from authored programs.

Required behavior:

- no history returns a conservative in-range target with no invented load;
- performed-rep top-of-range rule still advances load;
- trusted Capacity may extend a jump but never retract one earned by performed
  reps;
- Capacity below the lower range may reduce load;
- within-range evidence holds load and pursues reps;
- current-session set evidence may adjust later sets;
- block trend is at most a weak tempering modifier;
- every load is actionable on the configured grid;
- exact legacy fixtures from Plan 039 and Plan 043 remain green.

Today's generic “three same-load sessions” stall branch must not grow into a
universal plateau system. Preserve it only if the range fixture retains it as
a local conservative status; structural plateau diagnosis belongs to a later
intervention plan.

### B. Rep-goal progression (`rep_goal@1`)

This strategy owns a total working-rep target across a declared number of
sets. It is not implemented as “range progression but look at the sum.”

Required parameters:

- number of working sets;
- total-rep goal or closed rule for deriving it from a per-set range;
- allowed per-set floor and ceiling;
- target effort/RIR window;
- load increment/jump rule;
- distribution policy for the next set.

Required behavior:

- use completed comparable working sets only;
- hold load while the total target is not earned at the required effort;
- advance load only when the goal and effort condition are met;
- after a load change, redistribute a feasible total across sets rather than
  blindly assigning identical reps;
- with partial current-session evidence, recommend the next set from remaining
  target reps and expected set drop without demanding impossible catch-up;
- distinguish “total goal met,” “progress toward goal,” “effort too high,” and
  “insufficient comparable evidence” reason codes;
- extra unplanned sets are recorded but do not retroactively redefine the
  authored goal.

The fixture review must settle the exact distribution and advancement edge
cases before code.

### C. Anchor plus back-off (`anchor_backoff@1`)

One slot contains one anchor working set and one or more back-off sets. The
anchor supplies the session's strongest controlled evidence; back-offs are
derived from the authored relationship.

Required parameters:

- anchor target rep range and effort/RIR target;
- back-off set count;
- back-off derivation as a bounded percentage reduction or target-effort
  relationship approved in fixtures;
- back-off rep range/goal;
- load grid and permitted adjustment bounds.

Required behavior:

- previous anchor evidence sets the opening target;
- once the current anchor is completed, recompute still-untouched back-offs
  from that actual evidence;
- user-edited/touched sets are never overwritten;
- if the anchor is missing or invalid, fall back to a typed prior-session or
  insufficient-evidence result, not fabricated arithmetic;
- a failed anchor can reduce or recalibrate back-offs only according to the
  reviewed fixture;
- back-off loads/reps remain individually visible and editable;
- explanation distinguishes prior evidence, today's anchor, grid rounding,
  and authored back-off rule.

This is general strength/hypertrophy programming. Do not add peaking,
competition percentages, or attempt-selection semantics.

### D. Paired exposure relation (`paired_exposure@1`)

The same movement appears in two weekly slots with explicit heavy and volume
roles. Each slot still uses a supported per-exercise strategy; the relation
shares only compatible movement evidence and the declared anchor.

Required behavior:

- heavy and volume slots keep separate performed histories, exercise-slot IDs,
  and authored prescriptions;
- movement Capacity may inform both through an explicit relation input;
- the volume exposure cannot erase or copy the heavy prescription, and vice
  versa;
- session ordering within the week is evidence, not a hidden schedule rewrite;
- skipped/missed counterpart exposure lowers confidence rather than inventing
  a replacement session;
- different machines/equipment identities are incompatible even if their
  display names match;
- changing either movement prompts relation repair/removal in the editor;
- explanation states which paired exposure supplied evidence and how it was
  bounded, without exposing internal IDs.

The first supported combination should be deliberately narrow and fixed by
fixtures—for example anchor/back-off heavy plus range/rep-goal volume. Reject
other combinations with a compatible alternative instead of guessing.

### E. Block-profile modifiers

Modifiers adjust a strategy's declared target through the fixed six-week block
without changing days or exercises. Initial allowed modifier families may
cover step loading, volume emphasis, or rep-range emphasis only if their
week-by-week numeric fixtures are approved.

Each modifier has:

- stable ID/version;
- compatible strategies;
- week-number input and six-week default table/rule;
- exact parameter it may adjust;
- bounded output;
- reason code and explanation fact.

Rules:

- modifier order is fixed and explicit; non-commutative combinations are
  rejected unless a fixture covers them;
- a modifier cannot schedule a deload, add/remove a day, change movement
  identity, or switch strategy;
- every week retains the same program-day/slot structure;
- manual progression ignores target-changing modifiers.

### F. Manual progression (`manual@1`)

Required behavior:

- preserve authored sets/reps/load/effort text in supported structured fields;
- show comparable prior performance where available;
- return `kind: "manual"`, `status: "manual"`, and no invented load/reps;
- never populate ghost suggestions as though Taurifer prescribed them;
- let the user log, override, and edit normally;
- explanation clearly says the program/user owns the target;
- no Pro entitlement is required.

## Legacy and migration contract

### Exercise normalization

1. Exercise without `progression` and without a meaningful legacy
   `progressionType` receives an in-memory `range@1` projection from
   `sets/min/max` and today's settings. Its serialized form may remain legacy
   until the exercise is edited or the full state is next migrated; choose one
   deterministic policy and lock it in fixtures.
2. Recognized legacy aliases may map only through a documented table.
3. Unknown non-empty `progressionType` is preserved for full backup recovery
   but executes as `manual@1` with an “unsupported imported rule” explanation.
   Do not silently reinterpret it as range.
4. `targetRirStart/End`, `minSets/maxSets`, and priority fields map only where
   their semantics are unambiguous. Otherwise preserve them as provenance and
   request an explicit edit.
5. New strategy fields round-trip through app storage, backup JSON, program
   JSON, verbose shared setup, compact shared setup, and clipboard/file import.
6. Compact shared setup needs a new payload version/bit allocation. All
   released v1/v2 formats remain decodable forever under ADR 0007.
7. Plain-text export is allowed to be lossy only if it visibly names the
   strategy and prints the structured prescription clearly enough for a human.

### History compatibility

Historical log rows remain immutable. Strategy changes affect future
recommendations only. The engine reads history by performed movement identity,
not by current display name or current strategy.

Store the active strategy/version in new recommendation provenance and, where
needed to interpret later outcomes, in newly committed log/session metadata.
Do not rewrite old rows to pretend they used a strategy that did not yet
exist.

## Application integration

### Recommendation adapter

Replace direct global-state reads with an adapter that:

1. resolves the performed movement identity;
2. gathers chronological comparable working-set evidence;
3. validates the exercise prescription and program relation;
4. converts kg-stored settings/evidence into engine inputs;
5. calls the pure engine;
6. formats results into current workout ghost values and labels;
7. maps reason codes to i18n for cards and “Why this weight?”.

Keep unit conversion outside the engine; engine loads are canonical kg.

### Program editor

Add one “Progression” editor surface per exercise. It must:

- show the current supported strategy in plain language;
- offer only compatible strategies;
- reveal only the selected strategy's bounded basic parameters;
- preview what changes and what history remains;
- warn before breaking a paired relation;
- allow Manual explicitly;
- never ask for arbitrary formulas;
- save through the existing transaction protocol;
- never change completed history.

The generator/onboarding must not expose these controls; that is Plan 048's
authorship boundary.

### Workout and explanation UI

Reuse the current card/set workflow. Each strategy must provide:

- a concise recommendation/status line;
- actionable set targets or an honest manual state;
- strategy-appropriate current-session updates without overwriting touched or
  committed fields;
- a “Why?” explanation built only from engine facts/reason codes;
- accessible announcement only when a still-untouched future suggestion
  materially changes;
- no strategy jargon on the primary workout surface unless necessary.

Anchor/back-off roles must be visually distinguishable without rearranging the
set order. Paired-exposure context belongs in the explanation/program surface,
not as workout clutter.

## Implementation sequence

### Slice 1 — contract, parity harness, and pure extraction

1. Write the reviewed strategy contract and machine fixtures.
2. Capture current range outputs from Plan 039/043 cases before extraction.
3. Add `progression-engine.js` and move pure Capacity/range calculations.
4. Build the app adapter while preserving current UI/output.
5. Pass range parity, performance, simulation, and browser regressions before
   adding another strategy.

### Slice 2 — versioned model and round trips

1. Add progression/relation validators and normalizers.
2. Extend `Exercise`, `Program`, `programMeta`, backup, program export/import,
   shared setup verbose/compact encoders, and text export.
3. Add legacy migration fixtures and malicious-payload bounds.
4. Do not expose new choices yet.

### Slice 3 — rep-goal and manual

1. Implement from approved fixtures.
2. Add editor controls and workout/explanation mapping.
3. Run all deterministic/property/model/browser tests.

### Slice 4 — anchor/back-off

1. Implement one narrow approved contract.
2. Integrate current-anchor recomputation without touching edited fields.
3. Add role UI, explanation, persistence, and tests.

### Slice 5 — paired exposure and modifiers

1. Add program-level relation validation and editor repair behavior.
2. Implement the first approved paired combination.
3. Implement only approved block modifiers.
4. Test fixed weekly structure, identity separation, and incompatibility paths.

### Slice 6 — hardening and documentation

1. Expand generated/model-based long journeys across every strategy and
   strategy change.
2. Run 52-week representative simulations.
3. Update mechanics, import/share docs, screenshots, and service-worker cache.
4. Remove obsolete embedded calculation paths after parity is proven; retain
   only the adapter/UI formatting in `app.js`.

Each slice may be its own PR. Do not merge a slice that writes a new strategy
shape but cannot read/export/share it safely.

## File-change map

| File | Required change |
|---|---|
| `progression-engine.js` | New pure engine, registry, validators, strategies, result codes. |
| `app.js` | Evidence adapter, model persistence, editor, workout mapping, explanation mapping; remove embedded engine. |
| `shared-setup.js` | New bounded progression/relation schema and compact version while retaining all released decoders. |
| `index.html`, `styles.css` | Load module; editor/workout/explanation controls. |
| `i18n/en.json`, `i18n/pt-BR.json` | Plain-language strategy, validation, and reason copy. |
| `i18n.js` | Regenerate. |
| `service-worker.js` | Cache module and bump runtime revisions. |
| `docs/progression-strategy-contract.md` | Human-readable versioned science/behavior contract. |
| `docs/progressive-overload-mechanics.md` | Replace double-progression-only description with shared engine model. |
| `test/fixtures/progression-strategies-v1.json` | Reviewed examples and edge cases. |
| `test/progression-engine.mjs` | Deterministic unit/parity/property tests. |
| `test/shared-setup.mjs`, import/export tests | Round-trip, bounds, migration, released-format regression. |
| `test/generative/` | Strategy-aware commands/model/invariants and long journeys. |
| browser test files | Editor, workout, explanation, reload, migration, accessibility. |

## Test requirements

### Engine invariants

- deterministic output and no input mutation;
- all numeric outputs finite, non-negative, and inside declared bounds;
- no unsupported strategy/modifier silently falls back;
- no family/program/entitlement value changes output;
- user-touched and committed sets are never overwritten;
- load-grid rounding never falsifies history;
- Capacity/RIR caps hold under extreme generated input;
- no scheduled deload result exists;
- manual produces no invented target;
- strategy/version/provenance is present on every non-invalid result.

### Range parity

- every Plan 039/043 fixture;
- top range, near-top majority, capacity extensions, lower-bound reduction,
  hold/push reps, RIR cap, load rounding, block tempering, re-entry reps,
  historical/current set drop, and session freshness;
- current DOM text and ghost values for representative existing histories;
- old backups and shared links before/after migration.

### Strategy-specific cases

- rep-goal total/distribution, partial current session, extra/missed sets, and
  effort condition;
- anchor completion changing only untouched back-offs, invalid/missing anchor,
  rounding, and role explanation;
- paired heavy/volume order, missed counterpart, strategy compatibility,
  movement replacement, machine identity separation, and relation repair;
- every modifier week and incompatible modifier order;
- manual prior-history display and fully empty/no-history behavior.

### Property and model-based tests

Generate:

- valid/invalid prescriptions and relations;
- arbitrary finite histories with outliers, missing RIR, warmups, different
  loads, interrupted sessions, and strategy changes;
- 52-week journeys with reload/export/import/share at random points;
- workout edits, set commits, overrides, exercise replacement/detachment,
  relation breaks, and recovery from corrupt/unknown strategy data.

Minimized failures become named permanent fixtures, as required by Q143.

### Browser and accessibility tests

- every strategy in List and Focus modes;
- numeric RIR and simple effort modes;
- kg/lb display with kg canonical storage;
- keyboard, screen reader name/state, focus restoration, and live announcements;
- 320 px, large text, light/dark catalogue screenshots;
- no visible regression in save/refresh latency;
- offline boot and cached-module update.

## Performance budgets

- Evaluating one exercise and its still-uncommitted sets must stay within the
  current Plan 039 render budget on representative mobile hardware.
- History aggregation remains memoized and invalidates only on relevant log,
  program, setting, or current-session changes.
- Do not scan the entire program/log separately for every set.
- Paired relation lookup must be indexed once per program render.
- Long-simulation tests must catch unbounded provenance or state growth.

## Acceptance checklist

- [ ] Strategy contract and numeric fixtures are reviewed before implementation.
- [ ] Pure engine runs in Node with no DOM/i18n/storage dependency.
- [ ] Range v1 is output-compatible with today's released behavior.
- [ ] Rep-goal, anchor/back-off, paired exposure, approved modifiers, and manual
      have explicit versioned contracts and executable tests.
- [ ] Capacity is shared evidence and no family/entitlement branch exists.
- [ ] One typed result/provenance shape feeds both workout and explanation UI.
- [ ] Progression/relation data round-trips through state, backup, program JSON,
      every released shared format, and text export with documented fidelity.
- [ ] Old programs migrate deterministically; unknown rules do not masquerade
      as supported range progression.
- [ ] Users can select supported strategies/basic parameters Free in the editor.
- [ ] Weekly program structure stays fixed; no strategy schedules a deload.
- [ ] Generated/model-based and 52-week simulations cover every strategy.
- [ ] Physical workout speed and accessibility gates pass.

## STOP conditions

- STOP if a strategy formula is coded before its numeric fixtures are approved.
- STOP if `app.js` gains family/program-specific recommendation branches.
- STOP if `progressionType` is trusted as an arbitrary formula or silently
  treated as supported.
- STOP if a new format can be written before backup/import/shared setup can
  round-trip it.
- STOP if migrating a strategy rewrites completed history.
- STOP if paired exposures merge different movement or machine identities.
- STOP if any strategy automatically schedules a deload or changes the weekly
  day/slot structure.
- STOP if recommendation and “Why?” recompute different rules.
- STOP if a manual prescription receives invented Taurifer targets.
- STOP if Pro entitlement changes engine output or access to the basic math.
- STOP if the new engine regresses workout save/render latency on the release
  device matrix.
