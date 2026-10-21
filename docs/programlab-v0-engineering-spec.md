# Taurifer Program Lab v0

## Engineering specification

**Status:** Proposed implementation contract. No implementation, deployment, or production-policy change is implied by this document.

**Revision:** 1.0 · 17 October 2026

**Repository:** `pedrochagasmaster/repforge`

**Inspected engine:** commit `44c8f3c3a28ec66036563fc12f3f75d39f0bed7c`; generator `067.2`; program schema `2`.

**Primary user:** Taurifer's owner, tuning the program-generation engine.

All APIs, module names, policy field names, limits, and acceptance IDs introduced below are proposals. Statements about existing behavior are tied to the inspected commit. Recheck that baseline before implementation. The document is suitable as the body or attachment of an engineering issue; it does not allocate a numbered plan or change the repository's ordered backlog. [S1], [S8]

## 1. Decision and intended outcome

Build **Program Lab**, an isolated browser workbench that runs the real Taurifer generator with explicit, immutable policy configurations. The owner can change engine parameters, hold athlete inputs and seeds constant, compare generated prescriptions, and save a reproducible experiment.

The primary workflow is:

1. Open the bundled production policy as the baseline.
2. Select a scenario or a fixed scenario set.
3. Clone the baseline into a candidate and adjust parameters.
4. Run both configurations against identical scenario/seed pairs.
5. Inspect the actual programs, differences, constraints, and estimates.
6. Save the configuration and execution snapshots; export them for review or later replay.

**Required first experiment:** favor two working sets per exercise with most prescribed RIR values at zero, while retaining explicit beginner, deload, emphasis, and time-fitting behavior. RIR means repetitions in reserve. The tool measures prescribed output; it does not infer training outcomes from those prescriptions.

The v0 is complete when the owner can explain both **what changed** and **which engine rules caused the change**, reproduce that result on the same engine/catalog, and verify that the production default path remains unchanged.

## 2. Scope

| Included in v0 | Deferred |
| --- | --- |
| Generation-policy editing: sets, rep ranges, RIR, rest, periodization offsets, deload, emphasis allocation, and duration assumptions | Progression-policy tuning, workout-history replay, and adaptive block-transition experiments |
| Single baseline/candidate comparison | Automatic parameter optimization and multidimensional grid searches |
| Fixed scenario batches and one-scalar-parameter sweeps | Learned rankings, generic stimulus/fatigue scores, and recommendations for a “best” policy |
| Actual program inspection, deterministic diffs, typed conflicts, and minimal allocation diagnostics | Full search-tree/backtracking visualization |
| Named configurations, immutable run snapshots, local persistence, JSON export/import | Accounts, collaboration, cloud sync, trainer CRM, billing, and analytics dashboards |
| An isolated static portal using the shared engine modules | Activating candidate programs, changing production defaults from the portal, and publishing tuned setup links |

Exercise eligibility, competency requirements, exclusions, catalog role tiers, seed ranking, and the search bound remain fixed. The current selector is an ordered policy; it does not expose a generic set of stimulus, fatigue, or variety weights. Do not introduce such sliders as part of this work. [S2]

## 3. Verified starting point

| Existing contract | Consequence for Program Lab |
| --- | --- |
| `generateProgram(request, catalogSnapshot, seed)` has no policy argument. | Add a per-call policy argument to the shared compiler; avoid mutable global settings. |
| Standard and compact set tables, rep ranges, RIR logic, rest, and duration constants live in `program-compiler.js`. | Extract one authoritative policy definition and validate complete snapshots. |
| A 40-minute-or-shorter request selects the compact purpose template. | Keep the scenario time ceiling distinct from the policy's compact-template threshold. |
| `program-engine.js` runs the same compiler in a worker or on the main thread. | Forward the policy and diagnostic option identically through both paths. |
| Time fitting occurs before final per-cycle prescriptions are populated. | Preserve that order; expose the fitting estimate and materialized-cycle estimates separately. |
| `ProgramDefinition` has a closed schema. | Store lab policy, fingerprints, diagnostics, and metrics outside the program definition. |
| Raw catalog loading checks the SHA-256 of the actual source text. | Use the same verified catalog and pin; arbitrary catalog uploads are outside v0. |
| The existing corpus contains 180 scenario/seed cases. | Reuse its case factory for baseline regression and a built-in lab batch. |

Sources: compiler constants and generation flow [S1], [S3]; worker boundary [S4]; catalog integrity [S5]; current corpus [S6]. The 180 cases are the factory's 150 goal/day/equipment/time combinations plus 30 experience/constraint variants, not a claim that all cases produce valid programs.

The phrase **production baseline** means the default policy bundled with the inspected engine build. The UI must display that build's identity. It must not label it “currently deployed” unless a deployment manifest actually establishes that fact.

## 4. Architecture and ownership

Keep the existing static, vanilla-JavaScript architecture. No root application package manager, runtime UI framework, separate implementation of the generator, or simulation service is required. Repository module and test conventions remain applicable. [S8]

| Module or boundary | Responsibility |
| --- | --- |
| Proposed `engine-policy.js` | Default policy, exact schema, metadata for controls, validation, detached immutable snapshots. Follow the existing browser-global/CommonJS pattern. |
| Existing `program-compiler.js` | Consume the explicit policy throughout the existing algorithm; emit optional typed diagnostics; retain the shared duration estimator. |
| Existing `program-engine.js` | Carry policy/diagnostic options through the worker protocol; add an opt-out from main-thread fallback. |
| Existing `program-entry-adapter.js` | Map ordinary scenario answers through the same production input adapter. |
| Proposed `programlab/domain.js` | Experiment planning, canonical identities, sequential orchestration, semantic comparisons, and metric definitions. No DOM or database ownership. |
| Proposed `programlab/store.js` | Versioned lab-only IndexedDB records, atomic save/import, export and reload. |
| Proposed `programlab/app.js`, `index.html`, `styles.css` | Scenario and policy editors, run controls, results, accessibility, and local persistence status. |
| Proposed packaging command | Assemble a standalone static lab artifact from the same checkout, with source hashes and the exact catalog asset. No hand-maintained engine copy. |

The lab uses one dedicated executor and submits at most one active compiler job. The browser owns draft state and scheduling; the shared compiler owns generation decisions. The renderer receives immutable result records and derived comparisons.

The deployed lab has a separate origin and storage from the workout app. It does not load `app.js`, initialize the workout application's storage, register its service worker, or send experiment payloads to telemetry. Shared compiler changes still require the production script order, worker imports, service-worker asset inventory/cache version, and existing consumers to be kept consistent. [S4], [S8], [S9]

## 5. Engine policy contract

### 5.1 Complete default snapshot

Use `kind: "taurifer-engine-policy"` and `schemaVersion: 1`. Metadata such as names, notes, timestamps, presets, source commits, and hashes belongs to the experiment envelope.

The following is the **complete proposed policy representation of current defaults**. The implementation must mechanically compare its defaults to the inspected constants; this example must not become a second manually maintained runtime source. Rep classes are the compiler's existing authored classes. [S1], [S3]

```json
{
  "kind": "taurifer-engine-policy",
  "schemaVersion": 1,
  "volume": {
    "compactMaxMinutes": 40,
    "standardSetsByPurpose": {
      "upper_a_horizontal_push": 2,
      "upper_a_horizontal_pull": 2,
      "upper_a_lateral_delts": 3,
      "upper_a_triceps": 3,
      "upper_a_rear_delts": 3,
      "upper_a_lat_isolation": 3,
      "lower_a_squat": 3,
      "lower_a_secondary_hip_extension": 3,
      "lower_a_calves": 3,
      "lower_a_quadriceps_isolation": 3,
      "lower_a_hip_abduction": 3,
      "upper_b_incline_or_overhead_push": 3,
      "upper_b_vertical_pull": 3,
      "upper_b_additional_horizontal_push": 2,
      "upper_b_additional_horizontal_pull": 2,
      "upper_b_biceps": 3,
      "upper_b_chest_isolation": 3,
      "lower_b_hip_hinge": 3,
      "lower_b_secondary_squat": 3,
      "lower_b_knee_flexion": 3,
      "lower_b_abs": 3,
      "lower_b_obliques": 3
    },
    "compactSetsByPurpose": {
      "upper_a_horizontal_push": 3,
      "upper_a_horizontal_pull": 2,
      "upper_a_lateral_delts": 2,
      "upper_a_triceps": 2,
      "lower_a_squat": 3,
      "lower_a_calves": 3,
      "lower_a_quadriceps_isolation": 3,
      "upper_b_incline_or_overhead_push": 2,
      "upper_b_vertical_pull": 2,
      "upper_b_biceps": 2,
      "upper_b_chest_isolation": 2,
      "upper_b_rear_delts": 2,
      "lower_b_hip_hinge": 3,
      "lower_b_knee_flexion": 3,
      "lower_b_abs": 3
    },
    "beginnerSetReduction": 1
  },
  "prescription": {
    "repRanges": {
      "hypertrophy": {
        "first_push_lower": [7, 9],
        "first_pull": [9, 11],
        "secondary_push_lower": [9, 11],
        "secondary_pull": [11, 13],
        "assistance": [14, 16]
      },
      "strength": {
        "first_push_lower": [3, 5],
        "first_pull": [5, 7],
        "secondary_push_lower": [5, 7],
        "secondary_pull": [7, 9],
        "assistance": [8, 12]
      }
    },
    "finalRirByClass": {
      "first_push_lower": 1,
      "first_pull": 0,
      "secondary_push_lower": 1,
      "secondary_pull": 0,
      "assistance": 0
    },
    "rirPerRemainingSet": 1,
    "assistanceRirDiscount": 1,
    "beginnerRirBonus": 1,
    "restSeconds": { "compound": 120, "accessory": 90 }
  },
  "periodization": {
    "linearEndpointOffset": 2,
    "undulatingOffset": 2
  },
  "deload": { "setRetention": 0.5, "rirBonus": 2 },
  "emphasis": {
    "existingSlotSetCap": 3,
    "donorMinRemainingSets": 1,
    "newExerciseSets": 1
  },
  "timeModel": {
    "secondsPerRep": 4,
    "perExerciseOverheadSeconds": 60,
    "perSessionOverheadSeconds": 180
  }
}
```

### 5.2 Admissible values

These are v0 engineering limits, not training recommendations. Use numeric inputs and enumerated selectors with visible units; never coerce string numbers or silently round.

| Field, relative to the policy root | Admissible values |
| --- | --- |
| `volume.compactMaxMinutes` | One of `20, 40, 60, 90, 120, 150` |
| Both purpose-to-set maps | Exact required keys shown above; integer counts `1–4` |
| `volume.beginnerSetReduction` | Integer `0–2`; normal minimum remains one set |
| `prescription.repRanges` | Both goals and all five classes required; integer `[min,max]`, `3 ≤ min ≤ max ≤ 30` |
| `prescription.finalRirByClass` | Integers `0–4`, subject to the cross-field check below |
| `prescription.rirPerRemainingSet` | `0` or `1` |
| `prescription.assistanceRirDiscount` | `0` or `1` |
| `prescription.beginnerRirBonus` | Integer `0–3` |
| `prescription.restSeconds.*` | Integer seconds `0–600` |
| Both `periodization` offsets | Integer reps `0–4` |
| `deload.setRetention` | One of `0.25, 0.5, 0.75, 1` |
| `deload.rirBonus` | Integer `0–4` |
| `emphasis.existingSlotSetCap`, `emphasis.newExerciseSets` | Integer `1–4` |
| `emphasis.donorMinRemainingSets` | Integer `1–3` |
| `timeModel.secondsPerRep` | Finite number `1–10` |
| `timeModel.perExerciseOverheadSeconds` | Integer seconds `0–300` |
| `timeModel.perSessionOverheadSeconds` | Integer seconds `0–900` |

**Cross-field RIR validation:** the existing program schema allows only RIR `0–4`. For each rep class, calculate `maxSets` from both purpose maps. For assistance, also include the emphasis cap and new-emphasis set count. Define `discount = assistanceRirDiscount` for assistance and `0` for every compound class. Reject a policy if `max(0, (maxSets − 1) × rirPerRemainingSet + finalRirByClass[repClass] − discount)` exceeds `4`. Identify the involved fields and explain how to resolve the combination. This permits, for example, two sets with a final target of 3 RIR and a one-RIR step; it rejects four such sets. Two compound sets with final RIR 4 and step 1 must be rejected even when the assistance discount is 1. Do not add an ordinary-set RIR clamp to hide an invalid policy. [S3]

Keep these semantics fixed in v0: authored purposes and compact membership; the hybrid goal's strength-compound/hypertrophy-assistance mapping; the rep clamp `3–30`; the beginner/deload adjustment ceiling of `4`; minimum one beginner/deload set; one-set transfers into existing emphasized slots; eligibility/ranking; and the existing time-fit stages.

### 5.3 Normalization

```ts
normalizeEnginePolicy(input?: unknown):
  | { ok: true; value: EnginePolicyV1; isDefault: boolean }
  | { ok: false; issues: Array<{ path: string; code: string; message: string }> };

getDefaultEnginePolicy(): EnginePolicyV1;
```

Only omitted/`undefined` input chooses defaults. A supplied policy is a complete snapshot: `null`, empty or partial objects, unknown versions, missing map entries, unknown fields, nonfinite numbers, invalid tuples, and unsafe object keys are errors. Accept only plain data objects, dense arrays, strings, booleans, and valid numbers as allowed by the schema. Normalize negative zero to zero. Return a detached, deeply frozen snapshot.

`isDefault` means equality to the normalized default, including explicitly supplied defaults. The UI may edit a mutable draft, but all generation, hashing, saving, and export use resolved snapshots. The UI derives field paths, labels, units, ranges, defaults, and dependency descriptions from the shared policy metadata; it must not maintain a separate default table.

## 6. Algorithm integration and modifier precedence

### 6.1 Shared APIs

```ts
Compiler.generateProgram(request, catalogSnapshot, seed, {
  enginePolicy,
  diagnostics: "lineage-timefit@1"
} = {});

Compiler.estimateDaySeconds(day, cycleIndex, { enginePolicy } = {});
Compiler.normalizeProgramRequest(rawRequest, catalogSnapshot);

ProgramEngine.generate(request, seed, {
  signal,
  enginePolicy,
  diagnostics: "lineage-timefit@1"
} = {});

ProgramEngine.create({ /* existing options */, allowMainThreadFallback: false });
```

These signatures describe optional properties; production callers can continue supplying the existing arguments. `normalizeProgramRequest` is a thin public wrapper around the existing compiler request validator, retaining its current normalization. The laboratory must not create another request-validation implementation.

With diagnostics omitted, the return contract remains the current `GenerationResult`. Opting in adds a `diagnostics` sibling at the result root, outside `value`. The lab separates that sibling when storing the complete original result. Unknown diagnostic versions are rejected explicitly.

Normalize the policy before generation and pass it through every relevant helper, including template selection, slot creation, rep/RIR construction, emphasis day placement, optional-slot movement, time-fit checks, and post-generation duration estimates. The worker and main paths must receive identical snapshots. No source rewriting, duplicated compiler, or global “current policy” variable is permitted.

### 6.2 Exact order

1. Validate catalog, request and seed through the existing boundaries; validate explicit policy before doing candidate generation.
2. Select the compact or standard authored template using the policy threshold and the request's time ceiling. Apply the candidate set map in `finalizedJobs()` before day distribution: the existing distributor uses `entry.sets` when balancing jobs across days. [S2]
3. Select eligible exercises with the existing ranking/search policy.
4. Create slots from those prepared job counts. For beginners, use `max(1, baseSets − beginnerSetReduction)`.
5. Apply the existing emphasis procedure using its policy values.
6. Fit time using existing stages: move eligible assistance, remove bonus sets, reduce assistance to two then one set, remove optional assistance, then return a typed conflict if protected work still exceeds the ceiling.
7. Populate each cycle's prescriptions, including periodization and deload effects.
8. Remove internal helper fields and validate the resulting program definition.

Do not opportunistically fix or reorder the current algorithm during this extraction. In particular, the assistance reduction stages operate as they do today; v0 does not turn them into an optimizer that stops after each individual reduction. [S3]

For one-based set number `i` and **normal count after emphasis and time fitting, before deload retention** `N`, use:

```text
rir = max(0,
  (N - i) * rirPerRemainingSet
  + finalRirByClass[repClass]
  - (repClass == assistance ? assistanceRirDiscount : 0))

if beginner: rir = min(4, rir + beginnerRirBonus)
if deload:   rir = min(4, rir + deload.rirBonus)

retainedCount = deload ? ceil(N * deload.setRetention) : N
retain the first retainedCount prescriptions
```

Extract a shared helper for deload set-count rounding. RIR must still use `N`, not the shortened deload count. Preserve the existing halves-away-from-zero rounding and arithmetic order for linear offsets: for amplitude `A`, the linear expression is `A + (cycle − 1) × (−2A / (cycles − 1))`, rounded by the existing helper. Reverse linear negates that result; undulating uses positive amplitude on odd cycles and negative on even cycles. Static or one-cycle requests retain zero offset. [S3]

For emphasis, `existingSlotSetCap` only limits sets gained through emphasis; it is not a universal set cap. A donor is eligible when its count is greater than `donorMinRemainingSets`. Preserve donor ordering and the current no-donor/self-donor behavior. New emphasis slots use `newExerciseSets` for both their count and their removable bonus count, with base count zero. A cap or missing eligible purpose must remain visible as unapplied focus. [S3]

### 6.3 Default preservation and experimental provenance

Omitted policy and an explicit complete default policy must preserve the **entire existing serialized result**, including property order, IDs, request normalization, prescriptions, explanations, conflicts, confirmation offers, and provenance. Compare diagnostic-off results; enabling diagnostics must leave the result identical after removing the diagnostic sibling. Do not update frozen digests to accommodate a drift.

Keep generator version `067.2` for a behavior-preserving extraction. The build fingerprint identifies the changed implementation. Any intentional default behavior change requires a separate engine-version and product decision; it is outside this specification.

For a nondefault policy, use the existing string fields to label root and set provenance as `source: "experimental_policy"`, `policyVersion: "engine-policy@1"`, add `experimental-engine-policy` to root approximations, and make explanations truthful about customized prescriptions. Preserve `generatorVersion` as the implementation version. Do not add policy data or trace fields to `ProgramDefinition`. Default provenance remains byte-identical. [S3], [S7]

Malformed explicit policies return `invalid_engine_policy` with field paths. The UI blocks an invalid draft and never runs its baseline as a silent substitute. Keep policy-validation failures distinct from valid scenario conflicts in the run model.

## 7. Required experiments

### 7.1 Primary preset: `two_sets_low_rir@1`

Clone the complete default policy, then apply exactly these changes:

- Set every entry in both set maps to `2`.
- Set every `prescription.finalRirByClass` value to `0`.

Keep rep ranges, rest, periodization offsets, beginner/deload modifiers, emphasis, and duration assumptions at default values. This isolates the requested change in baseline volume and proximity to failure. It favors two sets while preserving explicit emphasis exceptions.

For unchanged, ordinary two-set slots, the expected RIR sequence is:

| Rep class | Default with three sets | Default with two sets | Primary preset with two sets |
| --- | --- | --- | --- |
| Push/lower compound classes | `3, 2, 1` | `2, 1` | `1, 0` |
| Pull compound classes | `2, 1, 0` | `1, 0` | `1, 0` |
| Assistance | `1, 0, 0` | `0, 0` | `0, 0` |

The current full standard template contains ten compound jobs and twelve assistance jobs. For an intermediate/advanced, ordinary cycle that retains all 22 jobs without focus changes, this candidate gives **44 sets: 34 at RIR 0 and 10 at RIR 1**. That is approximately **77.3% at RIR 0**. This is a specified fixture expectation, not a promise for every request. [S1], [S3]

### 7.2 Explicit variants

| Preset | Additional change relative to the primary preset | Intended observation |
| --- | --- | --- |
| `two_sets_low_rir_capped@1` | `emphasis.existingSlotSetCap = 2` | Existing emphasized slots cannot gain a third set; unapplied focus is reported. Both base maps are already two and new-emphasis slots remain one. |
| `two_sets_zero_rir@1` | `prescription.rirPerRemainingSet = 0` | Every ordinary set has RIR 0: a two-set slot has `0,0`, and a three-set emphasized slot has `0,0,0`. Beginner and deload bonuses still apply. |

These are named, versioned policy transformations, resolved into complete snapshots when selected. They are not separate engine branches. Bulk “set all to two” and “set all final RIR to zero” controls should produce the same resolved policy as the preset.

### 7.3 Modifier cases the UI must make visible

For the primary preset, with no emphasis or time-fit changes to the slot:

| Scenario modifier | Retained compound RIR | Retained assistance RIR |
| --- | --- | --- |
| Intermediate/advanced ordinary cycle | `1,0` | `0,0` |
| Beginner: base two becomes one | `1` | `1` |
| Deload: normal two retains its first set | `3` | `2` |
| Beginner and deload | `3` | `3` |

The deload compound result is `3`, because RIR is computed from normal count two before retaining one set. Recomputing from the shorter count would be a regression. Under the primary preset, emphasis may yield a three-set assistance slot, a one-set donor, or a newly added one-set slot. Time fitting may reduce or remove assistance. The capped variant changes the emphasis exception explicitly; none of these cases should be hidden behind a “two sets” label.

### 7.4 Fixture scenarios

Provide a small named starter set and the existing regression corpus:

| Fixture | Purpose |
| --- | --- |
| `anchor-4day` | Hypertrophy, intermediate, four days, 150-minute ceiling, all catalog equipment, seven static cycles, no deload/focus/exclusions/preferences, fixed seed `programlab-anchor-v1`. Use the corpus's explicit all-true competency-answer variant. Verify all 22 authored jobs are retained. |
| `anchor-beginner` | Same inputs with beginner experience; prove the modifier order. |
| `anchor-deload` | Same anchor with cycle seven marked as deload; compare cycles one and seven. |
| `anchor-focus` | Add side-delt/back focus and calf de-emphasis using the existing adapter's tokens. Exercise side-delt cap/donation and the current unapplied Upper Back focus, which lacks a reviewed assistance purpose. |
| `compact-40` | Forty-minute request; exercise the compact set map and time fitting. |
| `compact-added-focus` | Compact template with `primaryMuscles: ["lats"]`. Exercise creation of a new emphasis slot because the compact template omits lat isolation; trace its creation even if time fitting later removes it. |
| `restricted-home` | Limited home equipment with a fixed seed; retain genuine conflicts and removed work. |
| `compiler-corpus@<fingerprint>` | All cases generated by the current `corpusCases({Adapter,Catalog})` factory. |

Construct IDs from the verified catalog and reuse existing adapter/fixture conventions. The all-equipment anchor uses all actual catalog equipment IDs, following the corpus factory; do not invent an unsupported UI environment token. Freeze and save the resulting normalized requests and string seeds. Fixtures with expected conflicts remain useful tests; do not repair their inputs silently. [S6], [S10]

## 8. Scenario, experiment, and identity contracts

Keep **scenario** and **policy** separate. The scenario contains goal, experience, days, time ceiling, equipment, competency answers, movement confirmations, split, emphasis/de-emphasis, exclusions/preferences, execution contexts, cycles, periodization choice, and deload cycles. Policy contains the algorithm parameters in section 5.

Ordinary scenario editing uses `programRequestFromAnswers`; show its mapped request in an advanced inspector. In particular, the current adapter maps time to supported buckets and has its own block-input rules. Advanced canonical-request editing may expose existing compiler-supported inputs, but must use the shared validator and be labelled as bypassing the answer adapter. Preserve the input mode and original answers when present. Avoid collecting date of birth, height, weight, or other profile data that generation does not consume. [S10]

Normalize every execution seed to a string before planning. The explicit seed is authoritative; the effective request includes the same string in `request.seed`. Reject contradictory imported effective-request/seed pairs. Do not hash one seed while executing another. The current compiler converts its explicit seed argument to a string and writes it into the effective request. [S3]

| Identity | Meaning |
| --- | --- |
| `experimentId`, `revision` | A named configuration and an immutable input revision. Edits change a draft; Save or Run freezes a new revision, reusing the current revision only when the complete inputs are identical. Persistence status is separate from revision identity. |
| `runId` | One execution attempt, including partial or failed attempts. |
| `policyHash` | SHA-256 of the complete normalized policy. |
| `cellKey` | Content identity of one generation computation. |
| `comparisonKey` | Identity of one ordered baseline/candidate comparison and the metric/reference-model versions. |

Calculate `cellKey` from canonical JSON containing the lab cell-schema version, compiler runtime fingerprint, catalog SHA-256, effective normalized request, explicit string seed, resolved policy, and diagnostic version. Exclude labels, timestamps, worker IDs, elapsed time, and UI state.

Canonical JSON uses recursively sorted object keys, preserved array order, normalized finite JSON numbers, UTF-8, and no insignificant whitespace. Use a single implementation for save/import/hash paths. Arrays remain ordered unless the production request normalizer itself changes them. `comparisonKey` additionally includes both cell keys, `metricsVersion`, and the complete frozen reference policy used for common-model time evaluation.

The runtime manifest records the source commit when available, dirty-build status, generator/program/policy/diagnostic versions, and SHA-256 hashes of the actual relevant runtime files. Include the compiler, policy module, metrics module, worker boundary, catalog loader, adapter, and generated catalog pin; separately fingerprint lab normalization/comparison code. Generate this manifest from the packaged bytes. A version string or Git commit alone is insufficient for a modified local build.

## 9. Execution modes and lifecycle

### 9.1 Modes

| Mode | Contract |
| --- | --- |
| Single | One scenario/seed; bundled-default baseline versus one candidate. |
| Batch | One frozen ordered list of scenario/seed pairs; both policies receive every pair unchanged. |
| Sweep | Replace one numeric scalar policy leaf with each explicit value; keep the rest of the candidate and every scenario/seed fixed. Include one baseline computation per pair. |

Sweep paths must come from the schema's allowlist, including individual set-map entries and rep-range endpoints. No expression evaluation, arbitrary object paths, whole-map sweeps, or Cartesian product expansion. Validate each complete policy and reject duplicate normalized values. Show the exact parameter path, resolved values, expected cells, and baseline reuse before Run.

Initial product limits: **200 scenario/seed pairs, 20 sweep values, and 1,000 distinct compiler cells per run**. The total cell limit takes precedence, so a full 180-case corpus is valid for a two-policy batch but not for a 20-value sweep. Baseline cells may be reused inside the same run only when their full `cellKey` matches. Do not reuse archived results as freshly executed cells in v0.

### 9.2 Lifecycle and cancellation

The run state is `validating → running → completed | canceled | interrupted | failed`. `idle` and `dirty` describe the editor, not an execution result. A completed run means all planned cells have outcomes; individual cells can still contain a typed conflict or execution error.

- Run validates and snapshots all inputs before submitting work. Save the exact dirty draft as a new immutable revision, rather than attributing it to the last saved inputs. Every run also embeds its own complete configuration snapshot, including scenario grouping, sweep definition, and frozen reference-time policy. Subsequent edits mark the displayed run “Inputs changed” and cannot alter it.
- Use a lab-owned executor with `allowMainThreadFallback: false`. That option defaults to `true` for existing production callers. Worker initialization failure is visible; do not silently execute a lab batch on the main thread.
- Submit cells in stable scenario order, baseline first and candidate/sweep values in declared order. Display completed/total cells and the current case.
- Cancel terminates the active executor via `dispose()`, stops scheduling, and preserves completed cells as a partial run. It does not merely abort a promise while leaving computation active.
- Use a run token plus cell ID to reject late messages. A new run gets a fresh executor after cancellation, failure, or timeout.
- Proposed initialization timeout: 15 seconds. Proposed per-cell execution timeout: 10 seconds, excluding worker initialization. Record timeouts as execution errors, terminate the worker, and permit later independent cells with a fresh executor; mark unscheduled cells if initialization cannot recover.
- Attempt to persist the input revision and frozen run plan in one transaction before execution. If this fails, show the storage failure and an explicit “Run without saving” action; do not start silently. The in-memory option retains the same immutable snapshot and export capability with visible unsaved status.
- Checkpoint each accepted cell and its completeness counters atomically. Serialize finalization after outstanding checkpoints; cancellation must preserve already accepted cells and cannot count a cell twice. Reloading an unfinished persisted run marks it `interrupted`; it never relabels it complete or resumes implicitly.

These lifecycle changes are necessary because the current abort path rejects the caller while active worker computation continues, and the current fallback can drain queued work synchronously. Preserve that existing default behavior for the workout app; strengthen the lab through its explicit options and executor ownership. [S4]

## 10. Diagnostics, comparisons, and metrics

### 10.1 Minimal generation diagnostics

Use diagnostic kind `taurifer-generation-diagnostics`, schema `1`, requested by `lineage-timefit@1`. Include a terminal stage (`validation`, `selection`, `emphasis`, `time_fit`, `definition_validation`, or `complete`), per-slot records, and an optional time-fit record.

Per-slot records contain lineage, origin, source/effective purpose IDs, slot/exercise IDs, rep class, initial/final day IDs, base count, count after experience adjustment, before/after time-fit counts, and whether the slot was retained. Retain removed slots in diagnostics even though they disappear from `ProgramDefinition`. A selection failure can have no slots; unsuccessful search branches are outside scope.

Time-fit diagnostics contain the ceiling, pre-/post-fit estimates by day ID, and ordered typed actions: `move`, `remove_bonus`, `reduce_sets` with stage `2` or `1`, and `remove_slot`. Record before/after counts or day IDs as applicable. Add a small emphasis-action record for each actual donation/addition/unapplied request, with muscle ID, recipient/donor lineage where present, before/after counts, and reason. This makes volume changes before time fitting explainable without parsing English explanation strings.

Use lineage `job:<original authored purposeId>` for normal jobs and `emphasis:<muscle UUID>` for added emphasis jobs. The compact rear-delt alias retains `job:upper_a_rear_delts`, even though its effective purpose is `upper_b_rear_delts`. Generated slot IDs include ordinals and can change when other jobs are added or removed, so they are not the comparison join key. If future authored repetition makes lineage nonunique, increment the diagnostic schema and define occurrence identity; do not guess matches. [S1], [S3]

Diagnostics observe decisions and never feed selection, seed consumption, fitting, or prescription construction. No timestamps, full catalog copies, or wall-clock measurements appear in deterministic diagnostics.

### 10.2 Semantic diff

Match slots by lineage, cycles by cycle index, and sets by set ordinal. Distinguish slot addition/removal, exercise replacement, day/position movement, effective-purpose change, set-count change, rep/RIR/rest changes, and metric/execution-mode changes. Keep provenance-only changes in a separate expandable section.

Do not count seed-derived IDs or provenance strings as prescription changes. Exact-result equality remains a separate check over the complete generation result. Baseline equal to candidate requires both exact equality and zero semantic differences.

### 10.3 Required metric definitions

Use `metricsVersion: "programlab-metrics@1"`. All metrics derive from realized `prescriptionsByCycle`, not policy inputs.

| Metric | Definition and presentation |
| --- | --- |
| Outcome | Success, domain conflict, invalid input/policy, or execution error; preserve structured details. |
| Working sets | Count actual generated prescription objects per day/cycle. Report ordinary and deload cycles separately; do not infer warm-ups. |
| Sets per exercise occurrence | Histogram over retained slot/cycle pairs: one, two, three, four sets. Show numerator/denominator for the two-set share. An exercise used twice is two occurrences. |
| RIR distribution | Counts and percentages of actual sets at each RIR, plus shares at `0` and `0–1`. Null RIR remains “unspecified” and outside numeric percentages with its count shown. |
| Rep targets | Range distributions by rep class/role; optional sum of prescribed repetition minima/maxima for compatible repetition metrics, with unilateral/per-side semantics explicit. |
| Structure | Retained/added/removed jobs, exercise replacements, moved jobs, and changes in execution mode or metric composition. |
| Purpose allocation | Set totals by authored purpose/role and declared muscle-purpose membership. If shown by muscle, label these as overlapping attributed counts; never sum them into a unique total or call them effective sets. |
| Constraint effects | Time-fit removals/reductions, protected-work conflicts, unapplied focus, manual/configuration-required prescriptions, and cycle estimates above the requested ceiling. |
| Duration | Fitting estimate and materialized estimates under own and common policies, as defined below. |

A failed generation has `programMetrics: null`, not zeros. Manual or non-repetition prescriptions remain visible; unsupported rep totals are null rather than fabricated. No effective-set weighting, load-tonnage estimate without loads, hypertrophy score, fatigue score, or predicted outcome is part of v0.

### 10.4 Time comparisons

Compute duration through the shared estimator. Its default assumptions are four seconds per rep, twice the repetition work for unilateral reps-per-side execution, between-set rest, 60 seconds per retained slot, and 180 seconds per training day. The existing estimator uses the first set's rep/rest targets to represent a slot; preserve that behavior during extraction. [S3]

Show three distinct quantities:

1. **Fitting estimate:** the compiler's pre-prescription estimate used to accept, move, trim, or reject work. Preserve the existing `provenance.estimatedSessionSeconds` values and capture matching typed diagnostics.
2. **Own-policy cycle estimate:** each generated program's actual selected-cycle targets evaluated using that variant's policy. This is the materialized estimate, not a claim that all cycles were fitted.
3. **Common-model cycle estimate:** evaluate both outputs with one frozen reference policy, initially the bundled default. Keep each output's explicit prescribed targets and rest. Freeze the estimator's assumption/fallback values to make duration deltas comparable.

Time fitting currently uses normal counts and base rep ranges before periodized/deload targets exist. Consequently the fitting estimate can differ even from the first materialized cycle. Show per-day/per-cycle differences and any later-cycle ceiling exceedance as an audit finding; do not silently move fitting after prescriptions or implement all-cycle fitting in v0. [S3]

When only duration assumptions change and prescriptions do not, show **“Prescriptions unchanged; duration model changed.”** When a changed assumption causes assistance to be retained or removed, show that work change alongside both estimates. A lower own-policy duration alone is not evidence of less work or a measured shorter workout.

### 10.5 Batch and sweep aggregation

Always show counts for success→success, success→conflict, conflict→success, conflict→conflict, invalid inputs, and execution errors. Calculate dose/duration deltas only for successful pairs, with the comparable-pair denominator visible. Report mean paired delta and range, plus per-case rows; do not silently mix failed cases into averages as zero.

For RIR and set-count shares, present the selected cohort's pooled numerator/denominator and an optional per-case view; label pooled results so larger programs' contribution is clear. Keep ordinary and deload strata distinct. A sweep table has one row per value, with conflicts, two-set share, RIR-0 share, common-model duration, and changed-work counts. Sorting must preserve the original sweep value order as the default.

The sweep's main comparative metrics use the same scenario/seed intersection that succeeds for the baseline and every sweep value. Show the included case IDs/count and excluded outcomes. If this intersection is empty, comparative metrics are null. Additional per-value successful-case summaries must be explicitly labelled as different populations. Define the main duration column as mean paired change in each case's maximum training-day minutes for the selected cycle, evaluated under the common model; a detail view also shows total cycle minutes. This prevents a variant from appearing better merely because it failed on longer programs.

## 11. User interface contract

Use the Taurifer design system's existing neutral surfaces, ink, orange accents, typography, and semantic control styles. Reuse authoritative tokens; keep lab styling out of the workout app's stylesheet. New runtime copy follows the repository's localization conventions. [S9]

**Header:** Program Lab, engine/catalog identity, experiment name, saved/unsaved state, and Single / Batch / Sweep tabs. A baseline badge always identifies the bundled-default policy and source build.

**Scenario panel:** named fixtures, editable scenario details, explicit seed, duplicate/save scenario, and the normalized-request inspector. Batch mode shows the ordered case list and expected counts. No import from ordinary workout history is required.

**Policy panel:** grouped sections for Volume, RIR, Reps, Rest, Periodization & Deload, Emphasis, and Time Model. Each field shows the baseline value, candidate value, unit, explanation, and reset action. Start with compact controls for both set maps, final RIR classes, and the remaining-set RIR step; advanced groups expand below. Bulk edits list the exact fields they change. Dependency hints distinguish a preferred base count from the final count after modifiers. Show validation errors next to the affected fields and disable Run until valid.

**Run controls:** explicit Run, Cancel while active, cell count/progress, Save experiment, Export, and Import. Changes do not launch work automatically. The previously completed result remains visible under its own snapshot identity when the editor becomes dirty.

**Results:** summary metrics, outcome/constraint counts, side-by-side day and cycle programs, semantic changes, typed explanation trace, and raw JSON. A cycle selector controls both sides together; ordinary and deload status is visible. Highlight changed values and removed/added work using text/icons as well as color. Batch rows open the same single-pair inspector.

Use a three-area layout on wide screens and stacked sections at narrower widths. Inputs and results must remain usable at 200% zoom; avoid page-wide horizontal scrolling except explicitly labelled raw JSON regions. Provide labelled keyboard-operable controls, visible focus, accessible error associations, and a polite progress live region that does not announce every set. Virtualize or paginate long case lists and render only the selected program detail.

Selecting a preset explains its scope in place: “Base counts: two. Final RIR: zero. Beginner, deload, emphasis, and time-fit rules still apply.” The strict emphasis-cap variant must display its additional changed field. Do not present a generic “high intensity” slider whose meaning combines load, reps, sets, and RIR.

## 12. Persistence and exchange format

Use a dedicated IndexedDB database, proposed name `taurifer_programlab_v1`, with separate stores for experiment revisions and run/cell snapshots. The schema migration version is independent from the exported document schema. No existing `RepForge*` production keys are renamed or reused.

Export a data-only JSON envelope with `kind: "taurifer-programlab-experiment"`, `schemaVersion: 1`. Required logical structure:

```ts
type ExperimentExportV1 = {
  kind: "taurifer-programlab-experiment";
  schemaVersion: 1;
  exportedAt: string;
  experiment: {
    experimentId: string;
    revision: number;
    name: string;
    notes: string;
    mode: "single" | "batch" | "sweep";
    scenarios: ScenarioSnapshot[];
    baselinePolicy: EnginePolicyV1;
    candidatePolicy: EnginePolicyV1;
    sweep: null | { path: string; values: number[] };
    referenceTimePolicy: EnginePolicyV1;
  };
  runs: RunSnapshot[]; // zero for configuration-only; at most one selected run
  transfer: {
    archiveId: string;
    partIndex: number; // one-based
    partCount: number;
    manifest: ArchiveManifestV1;
  };
};
```

`ScenarioSnapshot` includes its stable local key/name, input mode, optional original answers, effective normalized request, and string seed. `RunSnapshot` contains ID, source revision, a complete embedded experiment-input snapshot, status, timestamps, manifests/fingerprints, ordered planned cells, completed cell records, remaining cell IDs, metric/diagnostic versions, and completeness counts. Its embedded input snapshot includes both generation policies, every scenario, mode/sweep, and the frozen reference-time policy; it never inherits those values from the export's current experiment revision. Every planned cell resolves its full policy. Full snapshots may be deduplicated within an archive by their validated hashes, with all referenced objects present; never depend on a later default for reconstruction.

A completed cell contains its `cellKey`, normalized inputs, resolved policy/hash, execution outcome, exact generation-result JSON without the diagnostic sibling, diagnostics, result hash, and nullable derived metrics. Store observational elapsed time separately from deterministic hashes. Valid compiler conflicts preserve their original payload. Invalid input and worker/crash/timeout errors use separate outcome types and cannot masquerade as domain refusals.

The exact compiler-result JSON serialization is authoritative. Hash those UTF-8 bytes, parse them to render and compare the result, and avoid storing a conflicting second authoritative object. Recompute the policy hash, cell key, and result hash from their declared constituents on import. A successful result's effective request and seed must agree with the cell inputs. Semantic metrics/diffs derive from the parsed result; cached metrics carry a version and can be recomputed. Do not trust a file's precomputed “passed” or “validated” claims.

Save and Run use the same immutable-revision operation. Run checkpoints are append-only until their terminal status is finalized. Use transactions so a failed save or import preserves the previous good state. A persistence/quota failure during execution leaves the current result visible in memory, marks subsequent checkpoints unsaved, and offers export; it must not show “Saved.” Do not evict old runs silently.

Provide explicit **Export configuration** and **Export selected run** actions. A configuration export carries no result records. A run export carries the complete selected run, including partial execution status where applicable. Preflight its exact encoded size. Files are limited to **50 MiB** each; larger run exports are automatically divided into numbered JSON parts, each with the same archive manifest and complete shared input/run metadata, plus disjoint cell-record subsets. Never silently omit results.

`ArchiveManifestV1` declares the hash of the shared experiment/run metadata and the ordered expected cell-record hashes and part assignments. Each part contains a contiguous one-based index and total part count. Configuration-only and small run exports use a single part. A cell record cannot be split across files. Select all parts in one import operation; require matching manifests, every declared part exactly once, no duplicate/missing cells, and matching cell/metadata hashes before committing. Missing parts produce an incomplete-archive error and no writes. Do not mistake an intentionally canceled run with a complete export for a damaged archive.

Apply the same bounds during export and import: one run per archive, at most **1,000 planned cells**, **10 parts**, and **500 MiB total encoded data**, with nesting at most **40 levels**, **200 scenario/seed pairs**, and **20 sweep values**. If a run exceeds the archive or individual-cell size limit, keep it saved locally and offer configuration-only export with an explicit reason; do not claim a full-results export succeeded. Process part validation off the UI thread and stage records until the complete archive can be committed atomically. The acceptance suite must cover the largest supported archive and the oversize rejection path.

Import validates the kind/version, complete schema, hashes, bounds, counts, and references before committing. Give imported experiments new local IDs and preserve their external source IDs as provenance; do not overwrite by an imported ID alone. Reject executable content, URL/module/worker/catalog overrides, unknown fields, and malformed values. Validate computational sizes before detailed hashing or rendering.

An imported result with different engine or catalog fingerprints is accepted as an **archived result**, after validating its envelope and internal consistency. Do not reject historical exercise IDs merely because they are absent from today's catalog, or claim that the current engine has validated historical eligibility. It remains viewable using its saved data, with catalog-dependent names shown from saved labels where available or as IDs. Exact replay is available only when the required fingerprints match. “Run with this build” creates a new run/revision, explicitly recording the new identity and validating its inputs for the current catalog; it does not rewrite the old result. Imported hashes detect mismatches but do not establish authorship or authenticity.

Program Lab JSON is not a Taurifer backup or shared setup. Candidate activation, normal setup-link generation, and block transitions are absent: the current [setup-recipe path](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/shared-setup.js#L258-L293) requires exact regeneration, while the [transition baseline](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/program-transition.js#L248-L270) calls the default generator. A request-and-seed recipe alone cannot represent a custom policy. [S7]

## 13. Packaging, access, and operational bounds

The v0 deliverable is a standalone static artifact assembled from the current repository checkout. Serve the required engine files and `assets/exercise-catalog.json` at paths compatible with the existing loader, and pass the exact loaded runtime URLs to the worker. Generate the manifest during assembly; never fetch executable code from experiment input or a floating `main` URL at runtime. [S4], [S5]

Local use runs on a loopback preview origin. If hosted, the whole lab origin and preview deployments must be protected by the existing owner-access mechanism before exposure. Client-side hiding, an obscure route, and a form that checks a hardcoded password do not meet that requirement. The spec does not introduce an application account system or choose new production credentials.

No lab files are added to production navigation or precache. The lab can be rebuilt independently from the same engine checkout. Shared file additions still update production consumers/cache inventory and pass their existing gates. A lab rollback restores the previous static artifact; production defaults remain code-reviewed changes outside the portal.

Performance acceptance concerns responsiveness and bounded execution: the 180-case two-policy corpus must run without queuing hundreds of synchronous main-thread generations; Cancel must acknowledge and terminate the active worker within one second on the documented desktop test environment. Record environment, elapsed time, and failures for the full run; do not assert an unmeasured throughput target. Persist incrementally and display details on demand to avoid duplicating every program in the DOM.

## 14. Acceptance and verification

These are **required tests to implement**, not claims of tests already passing. Register new suites in `test/suites.mjs` and ownership in `tools/test-selection.mjs`. Use the repository's current edit/packet/candidate workflow and evidence protocol rather than copying an obsolete exhaustive command list into this feature. [S8], [S11]

| ID | Required result | Proof boundary / deliberate failure |
| --- | --- | --- |
| PL-01 | Omitted and explicit-default policy reproduce the existing complete results and frozen corpus digests. | Capture pre-refactor outputs; run existing corpus plus full-result/confirmation-offer checks. A changed default or explanation must fail. |
| PL-02 | Direct compiler, worker, and existing main fallback produce identical results for the same candidate. | Execute default and both low-RIR variants through all three paths. A dropped policy option must fail. |
| PL-03 | Policy snapshots are validated and isolated. | Reject missing/unknown fields, bad ranges, nonfinite values, and excessive RIR combinations, including the compound-discount counterexample; mutate the caller's draft after enqueue and prove the result is unchanged. |
| PL-04 | The primary preset changes actual prescriptions as specified. | Anchor fixture retains 22 jobs/44 sets, 34 at RIR 0 and 10 at RIR 1; surviving rep ranges/rest remain unchanged. |
| PL-05 | Beginner and deload precedence matches section 7.3. | Inspect actual sets in each selected cycle; recomputing deload RIR from retained count must fail. |
| PL-06 | Emphasis exceptions are explicit and capped variant never gains a third set. | Compare standard and compact focus fixtures under both presets; check donor/new-slot counts and unapplied-focus reasons. |
| PL-07 | Candidate time/rest/dose values reach fitting and materialized estimates. | Change rest and duration assumptions; capture trace and actual set targets. A default-only estimator must fail. |
| PL-08 | Own-model and common-model metrics remain distinguishable. | One fixture changes assumptions without prescriptions; another changes retained assistance. Verify correct labels and deltas. |
| PL-09 | Diagnostics cannot change generation. | Diagnostic on/off result parity; stable compact rear-delt lineage; every removal/move/count change accounted for, including failed time-fit. |
| PL-10 | Semantic diff matches actual changes. | A template change alters ordinal IDs without inflating unchanged prescriptions; equal policies yield zero differences. |
| PL-11 | Single, batch, and sweep agree for the same cell. | Compare exact results and keys, verify complete sweep planning, shared successful-population metrics, and baseline reuse only for matching identities. |
| PL-12 | Conflicts and errors are represented honestly. | Include success→conflict, conflict→success, worker error, and invalid policy; failed programs have null metrics and correct aggregation denominators. |
| PL-13 | Cancel, timeout, and stale-response handling preserve partial runs. | Cancel during a real worker job and pending checkpoint; ensure termination/no further scheduling/no duplicate counts; inject late replies and reload an interrupted run. |
| PL-14 | A saved/exported/imported run is reproducible on compatible fingerprints. | Run a dirty revision, save/reload/export/import, and replay its own full snapshot. Verify exact hashes; round-trip single and multipart archives, and reject incomplete/oversized archives. |
| PL-15 | Invalid imports and persistence failures are atomic; valid historical archives remain viewable. | Corrupt hashes, inconsistent input/result seeds, unknown fields, and initial/checkpoint transaction failures preserve old records. Fingerprint mismatch is accepted as an archive with exact replay disabled; running on this build creates a new record. |
| PL-16 | UI consumes the real engine end to end. | Edit a set/RIR field → run → inspect changed prescriptions → save → reload. A decorative slider disconnected from the worker must fail. |
| PL-17 | Lab isolation and production compatibility hold. | Run a candidate and cancel/reload the lab; production storage/default outputs remain intact. Worker URLs/catalog pin/cache inventory are consistent. Include a non-four-day fixture proving candidate counts reach day distribution before slot creation. |
| PL-18 | The shipped workbench is usable and bounded. | Keyboard/zoom/narrow layout checks, accessible validation/progress, full corpus run, cell-limit rejection, and measured cancellation acknowledgment. |

Existing tests to extend or retain include `test/program-compiler-search.mjs`, `test/program-engine-worker.mjs`, and the production input-adapter tests. Add focused policy, normalization/hash/diff, runner/store fault, and browser journey tests where the behavior is best proven. The browser journey must use the actual packaged compiler/worker and verified catalog; unit mocks alone cannot establish integration. [S6], [S11]

Do not wrap the historical `tools/audit-program-generation.mjs` unchanged: it references the retired compiler API. Likewise, long-running workout UI simulation does not validate physiological results of a policy. Base this lab on the current generator and current corpus, and record any new test evidence against the exact implementation commit.

## 15. Implementation sequence

| Slice | Deliverable and completion evidence |
| --- | --- |
| 1. Default-preserving policy seam | Shared policy module, full validation, explicit compiler option, unchanged default corpus/full results. Resolve module-loading and time-fit ordering risks first. |
| 2. First usable vertical slice | Thread policy and diagnostics through the real worker; one anchor scenario, baseline/candidate inspector, primary preset, and save/reload. Demonstrate PL-04 and PL-16 through the browser before expanding controls. |
| 3. Reproducible experiments | Full identities, semantic diff, own/common time metrics, immutable revisions/runs, import/export, and persistence fault handling. |
| 4. Coverage and exploration | Starter cases, generated 180-case corpus, bounded batch/sweep, progress, cancellation, timeout, and partial-run recovery. |
| 5. Delivery verification | Complete control groups, accessibility/responsive review, static packaging/access isolation, source manifest, and the relevant repository gates. |

For each slice, record acceptance IDs, producer/consumer boundaries, exact command or browser assertion, a deliberate-failure check, and evidence at the implementation SHA. Complete the first real UI/engine/storage proof early. Use the repository's existing independent-review and merge requirements; this spec neither replaces them nor schedules work ahead of the canonical backlog. [S8], [S11]

## 16. Key decisions and remaining limits

| Decision | Reason / consequence |
| --- | --- |
| Explicit per-run full policy | Experiments remain isolated and replayable when defaults change. |
| Fixed bundled-default baseline in v0 | Makes comparisons interpretable; arbitrary historical baseline selection can follow later. Archived runs remain viewable. |
| Primary two-set preset preserves emphasis | Matches a preference for two sets while showing current exceptions; a separate capped variant exposes the stronger constraint. |
| Higher final RIR values allowed with cross-field validation | Supports the opposite experiment without generating out-of-schema prescriptions. |
| No all-cycle time-fit rewrite | Protects existing behavior; per-cycle audits make the limitation visible. |
| Prescriptions and constraints are the evidence | A generation experiment cannot establish equivalence of two near-failure sets and three farther-from-failure sets, or prove training superiority. |
| Separate static origin and data envelope | Avoids candidate programs entering production activation, recipe, or transition flows. |
| No runtime promotion button | An experiment can inform a future reviewed default change; applying that decision is a separate implementation task. |

The current engine's policy is partly coupled: set count affects RIR, time assumptions affect retained work, and emphasis can redistribute or add sets. Program Lab must expose those relationships rather than imply each control changes only one output. The defining v0 outcome is a saved, inspectable comparison of actual programs under two explicit configurations.

## Sources at the inspected commit

All repository links below are pinned to `44c8f3c3a28ec66036563fc12f3f75d39f0bed7c`. Source links establish existing contracts; proposed product decisions and limits are owned by this specification.

- **S1 — Authored purposes, templates, and default set tables:** [program-compiler.js, lines 90–167](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/program-compiler.js#L90-L167).
- **S2 — Candidate ranking, template preparation, and distribution:** [program-compiler.js, lines 454–600](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/program-compiler.js#L454-L600).
- **S3 — Slot creation, prescriptions, generation, emphasis, time fitting, and estimates:** [program-compiler.js, lines 789–1175](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/program-compiler.js#L789-L1175); [closed keys](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/program-compiler.js#L1234-L1250); [prescription validation](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/program-compiler.js#L1497-L1531).
- **S4 — Shared worker/main runner and cancellation:** [program-engine.js](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/program-engine.js).
- **S5 — Raw catalog integrity/loading:** [exercise-catalog.js](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/exercise-catalog.js).
- **S6 — Current corpus and frozen output checks:** [program-compiler-corpus-cases.mjs](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/test/fixtures/program-compiler-corpus-cases.mjs); [program-compiler-search.mjs](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/test/program-compiler-search.mjs).
- **S7 — Program boundary and regeneration semantics:** [closed ProgramDefinition schema](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/program-compiler.js#L1234-L1250); [ADR 0007](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/docs/adr/0007-shared-setup-links.md); [shared-setup.js, lines 258–293](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/shared-setup.js#L258-L293); [program-transition.js, lines 248–270](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/program-transition.js#L248-L270).
- **S8 — Repository conventions, planning, and issue ownership:** [AGENTS.md](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/AGENTS.md); [issue tracker](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/docs/agents/issue-tracker.md); [plans/README.md](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/plans/README.md); [canonical backlog](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/docs/backlog.md).
- **S9 — Brand, design, and cache inventory:** [brand guide](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/docs/brand-guide.md); [sw.js](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/sw.js).
- **S10 — Production scenario mapping:** [program-entry-adapter.js, lines 260–334](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/program-entry-adapter.js#L260-L334).
- **S11 — Worker parity, test inventory, and implementation evidence:** [program-engine-worker.mjs](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/test/program-engine-worker.mjs); [test/suites.mjs](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/test/suites.mjs); [test selection](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/tools/test-selection.mjs); [docs/ci.md](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/docs/ci.md); [implementation evidence](https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/docs/agents/implementation-evidence.md).

[S1]: https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/program-compiler.js#L90-L167
[S2]: https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/program-compiler.js#L454-L600
[S3]: https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/program-compiler.js#L789-L1531
[S4]: https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/program-engine.js
[S5]: https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/exercise-catalog.js
[S6]: https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/test/fixtures/program-compiler-corpus-cases.mjs
[S7]: https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/docs/adr/0007-shared-setup-links.md
[S8]: https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/AGENTS.md
[S9]: https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/docs/brand-guide.md
[S10]: https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/program-entry-adapter.js#L260-L334
[S11]: https://github.com/pedrochagasmaster/repforge/blob/44c8f3c3a28ec66036563fc12f3f75d39f0bed7c/docs/agents/implementation-evidence.md
