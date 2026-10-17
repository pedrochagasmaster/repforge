# Program Lab engine integration contract

Base: `5a2a39284e27f7276c2b5e87bb2e11f05d67f3fa`, generator `073.4`, program schema 2.
The owner approved adapting PR #426 to 073.4, preserving production defaults.

## Partition

Engine owns `engine-policy.js`, `program-compiler.js`, `generation-layout.js`,
`program-engine.js`, focused tests, and production script/cache wiring.
Domain/persistence owns experiment snapshots, canonical hashes, run orchestration,
metrics and archives. UI/packaging owns presentation, isolated loopback artifact
and manifest. Integration owns `test/suites.mjs` and `tools/test-selection.mjs`.

## Exact shared APIs

```js
RepForgeEnginePolicy.getDefaultEnginePolicy();
RepForgeEnginePolicy.normalizeEnginePolicy(input); // {ok,value,isDefault} or {ok:false,issues:[{path,code,message}]}
RepForgeEnginePolicy.getEnginePolicyMetadata(); // {kind,schemaVersion,engineVersion,repClasses,fields}
// fields: {path,label,default,min,max,integer,nullable?,unit,dependency?}
// Scalar numeric paths include array ordinals and are the sweep allowlist.
Compiler.generateProgram(request, catalog, {enginePolicy, diagnostics} = {});
Compiler.normalizeProgramRequest(request, catalog); // current canonicalizeRequest boundary
Compiler.estimateDaySeconds(day, cycleIndex, catalog, {enginePolicy} = {});
ProgramEngine.create({...existingOptions, allowMainThreadFallback: false});
engine.generate(request, {signal, enginePolicy, diagnostics} = {});
engine.ready(); // resolves "worker", "main", "failed"; strict worker failure rejects jobs
// rejection: Error {name:"WorkerUnavailableError",code:"worker_unavailable"}
```

Policy and diagnostic options use the existing current APIs; there is no variable
seed parameter. 073.4 canonicalizes requests and derives identity from request,
engine version and catalog semantics. `request.seed` remains invalid. A saved lab
seed label can only be observational metadata, excluded from effective requests;
do not claim it changes generation.

Policy kind `taurifer-engine-policy`, schema 1 is a **complete native 073.4 snapshot**.
The module owns all actual defaults and metadata; derive forms and presets from it.
No separate runtime default table is allowed.

- `volume.setsByType.{primary,secondary,accessory}`: 0 retains allocation;
  integers 1–6 override selected template counts before distribution.
- `volume.beginnerSetReduction`: default 0. Applied after override/allocation,
  minimum one. 073.4 has no native beginner dose reduction.
- `allocation.budgetMinutesByCeiling`: the six current 18/30/50/75/105/125 budgets.
  `allocation.compoundFraction.{strength,other}`: current 0.6/0.5 shares.
- `prescription.staticRepCenters` and `periodizedRepCenters`: all three goals,
  all five rep classes; periodized arrays contain seven recovered centers.
- `prescription.baseRirByClass` and `rirAdjustmentsBySetCount`: recovered role
  bases and ordinal adjustments for counts 1–6. RIR floors at zero, then bonuses.
- `prescription.beginnerRirBonus`: default 0; `restSeconds.{compound,accessory}`
  default null, preserving recovered rest. Explicit seconds override prescriptions.
- `periodization.indices`: exact seven-entry linear/reverse/undulating table indices.
- `deload.{setRetention,repRetention,rirBonus}`: 0.8/0.8/3; floor retained
  count with minimum one, round each rep bound, then add RIR bonus. RIR domain 0–6.
- `timeModel`: recovered per-template fixed/set/rest constants, not the retired
  rep-based estimator. Explicit rests remain respected under common-model estimates.

Diagnostic request is `"allocation-lineage@1"`. Unknown versions return a typed
`invalid_diagnostics` input conflict. Diagnostics are a result-root sibling,
never part of ProgramDefinition. Diagnostic-off complete results remain identical.

Diagnostic schema 1: `{kind:"taurifer-generation-diagnostics",schemaVersion:1,
version:"allocation-lineage@1",terminalStage,slots,allocation?}`. Slots include
stable `lineage` (type/pattern-or-muscle/occurrence, independent of exercise UUID,
set count and final day), rep class, purpose/exercise/slot IDs, base/adjusted/final
counts, initial/final day IDs and retained. Allocation records requested minutes,
budget minutes, recovered selected allocations and estimated seconds by day.
There is **no time-fit action list or emphasis donation**: those algorithms were
removed in 073.4. Priorities still affect recovered selection and ordering.

## Preset adaptations

Primary two-set/low-RIR: set all three role overrides to 2, set compound bases to
1 and assistance base to 0, keep recovered two-set adjustments `[0,-1]`. This
produces ordinary compound `[1,0]`, assistance `[0,0]`. Zero-RIR variant sets
all bases and all ordinal adjustment entries to zero. Preserve default rep,
rest, periodization, allocation and deload fields. No fictitious emphasis-cap
preset: role overrides already constrain actual selected counts.

Existing seven-normal-cycle requests remain required; an optional first/last
deload creates eight cycles. No obsolete 22-job/44-set anchor or legacy RIR 4
limit. Production omitted/explicit-default complete serialized result parity
is mandatory. New definitions keep generator version 073.4. Nondefault root/set
provenance is `experimental_policy`, policyVersion `engine-policy@1`, with root
approximation `experimental-engine-policy`; default provenance is unchanged.

## Evidence captured before compiler changes

All 180 factory cases: 174 successes, 6 conflicts. Complete result JSON including
property order, explanations, confirmation offers and provenance is retained in
`/tmp/programlab-pre-refactor-full-results.json` (39,705,071 bytes), SHA-256
`6ced782b289ad74a2eedeb54904775cbd1c399b96cc92624f2afd6e2f9da0a88`.
A compact committed fixture records hashes of every complete serialized result.

## Archive structural-validation boundary

```js
Compiler.validateProgramDefinitionStructure(program, customExerciseDefinitions = []);
// -> {ok:boolean, issues:string[]}; no normalization or program mutation
```

Use this shared boundary for the archive factory's `validateProgram` callback
when `{archived:true}`. For compatible current-build results, retain
`Compiler.validateProgramDefinition(program, catalog, customDefinitions)`.
The structural method reads supported ProgramDefinition schemas 1 and 2 without
consulting a current catalog: historical exercise/equipment/muscle/pattern/type/
laterality/prerequisite IDs and nonempty retired split names are saved data.
It checks JSON data safety, closed fields, supported metric vocabulary/composition,
targets, RIR/rest bounds, order, identity uniqueness, provenance shape and optional
custom definitions. Unknown schemas or metric-definition versions are rejected.
It does not certify catalog membership, exercise eligibility, source authenticity,
exact replay or today's duration model. Current generation and existing validation
calls keep their prior behavior. Archive envelope hashes/bounds/fingerprints remain
the domain/archive owner's responsibility.
