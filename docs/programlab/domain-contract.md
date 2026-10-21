# Program Lab domain, persistence and archive interfaces

Base: `5a2a39284e27f7276c2b5e87bb2e11f05d67f3fa`. These lab-only modules
consume the current 073.4 engine; they do not define generation policy rules.
Globals are `ProgramLabDomain`, `ProgramLabStore`, `ProgramLabArchive`, and
`ProgramLabArchiveWorker`. Each also supports CommonJS.

## Domain

Load `generation-identity.js` before `programlab/domain.js`. Canonical JSON and
SHA-256 use that shared module. Lab guards reject unsafe keys, non-data values,
accessors, cycles and nesting beyond 40 levels. `snapshot(value)` produces a
detached, deeply frozen object. `digest(value)` hashes the canonical JSON.

```js
const domain = ProgramLabDomain.create({
  normalizePolicy: RepForgeEnginePolicy.normalizeEnginePolicy,
  normalizeRequest: request => Compiler.normalizeProgramRequest(request, catalog),
  estimateDaySeconds: (day, cycle, policy) =>
    Compiler.estimateDaySeconds(day, cycle, catalog, {enginePolicy: policy}),
  sweepPaths: RepForgeEnginePolicy.getEnginePolicyMetadata().fields
    .filter(field => typeof field.default === "number").map(field => field.path)
});
const plan = domain.plan(configuration, {
  runtimeFingerprint: manifest.runtimeFingerprint,
  catalogSha256: manifest.catalogSha256,
  diagnostics: "allocation-lineage@1"
});
```

Configuration fields: `name`, `notes`, `mode` (`single`, `batch`, `sweep`),
`scenarios`, complete `baselinePolicy`, `candidatePolicy`, `referenceTimePolicy`,
and `sweep` (null, or `{path,values}`). Optional `experimentId` and `revision`
default to a new UUID and 1. Optional `provenance` carries imported source IDs.
Scenarios use `{id,name,request,inputMode?,answers?}`. Input mode is `canonical`
or `answers`; the caller maps answers through the production adapter first.
Variable `seed` is rejected for new 073.4 plans. Historical archive validation
can preserve a string seed label without claiming it controls this engine.

Plans contain `experiment`, `build`, `cells`, `comparisons`, `caseCount`,
`cellCount`, `baselineReuse`, `metricsVersion`, kind and schema version.
Cells contain `{cellKey,request,policy,policyHash,diagnostics}`. Comparisons
contain `{scenarioId,value,baselineKey,candidateKey,comparisonKey}`. Limits are
200 scenarios, 20 sweep values and 1,000 distinct cells. Stable scenario order,
baseline-first execution, declared sweep order and exact-identity reuse are
preserved. Every scalar replacement validates the complete policy.

```js
const runner = ProgramLabDomain.createRunner({
  createExecutor: () => ProgramEngine.create({...workerOptions,
    allowMainThreadFallback: false}), // synchronous factory; fresh owned executor
  store,
  onProgress: run => renderProgress(run)
});
const finished = runner.run(plan, {runId, allowUnsaved: false});
await runner.cancel(); // immediately acknowledges executor disposal
const run = await finished; // waits for an accepted checkpoint and finalization
```

Initialization has a 15-second timeout and each compiler job 10 seconds.
Timeouts are execution errors; later independent cells get a new executor.
Two consecutive initialization failures stop scheduling and retain a failed
partial run. Initial storage failure rejects with
`code: "storage_initialization_failed"`; only an explicit subsequent
`allowUnsaved:true` run may execute without saving. A checkpoint/finalization
failure leaves a visible failed unsaved in-memory result. Progress callbacks
cannot change execution outcomes.

Run fields: `kind`, `schemaVersion`, `runId`, `plan`, `status`, `records`,
`completed`, `total`, `saved`, and `error` (null or `{code,message}`).
Packaged runs also retain optional `buildProvenance`: immutable source commit, dirty state, generator/schema/policy/diagnostics versions, lab fingerprint, source filename/hash map, and runtime/lab fingerprint file lists. Archives validate bounded closed data and its fingerprint relationships; these filenames never select executable modules. Older archives may omit this field. It is outside cell identity.

New runs also carry `startedAt`/`finishedAt` ISO timestamps outside computation
identity; historical records can omit them. Every cell
record contains `{cellKey,outcome,result,resultJSON,error}`. `resultJSON`
preserves the **original complete compiler-result JSON bytes/property order**;
`result` is the detached parsed data. Execution errors have both result fields
null. Diagnostics remain a result-root sibling. Archived imports may add
`archived:true` to a run.

`domain.metrics(result, ownPolicy, referencePolicy, {archived:false})` returns null for failed
generation. Successful metrics contain `cycles[]`, each with actual working
sets, occurrence/set-count histograms, pooled numerator/denominator RIR and
two-set shares, target distributions, manual status counts, attributed-purpose
counts and own/common materialized duration. `fittingEstimate` preserves the
engine's historical property name; in 073.4 it is an allocation estimate, not
time trimming. Muscle attribution explicitly overlaps. Per-side/non-repetition
prescriptions do not produce fabricated repetition totals.
Pass `{archived:true}` for fingerprint-mismatched archived results: actual saved
prescriptions remain countable and the saved allocation estimate remains visible,
but own/common materialized durations are null with an explicit reason. Today's
catalog/estimator must not certify an old build's duration model.

`domain.compare(baselineRecord,candidateRecord)` returns exact equality,
outcomes, semantic `changes[]` and separate `provenanceChanges[]`. It requires
unique compiler lineage for successful slots. Generated purpose ordinals are
not semantic identities; effective purpose is role/muscle/pattern composition.

`domain.aggregate(rows,{cycleIndex:1,commonPopulation:true})` preserves row
order. Rows have `{value,cases:[{id,baseline,candidate,baselineMetrics,
candidateMetrics}]}`. Sweep aggregation uses the shared successful-case
intersection; each row names included/excluded cases, outcome counts, pooled
shares and mean/range paired changes in maximum common-model day minutes.
`strata.ordinary` and `strata.deload` keep case populations separate. When a
selected cycle mixes ordinary/deload cases, top-level comparative values are
null and `mixedStrata:true`; consume the two explicit strata instead.

## IndexedDB

`await ProgramLabStore.open()` opens only `taurifer_programlab_v1` schema 1.
It never reads or writes workout-app databases or localStorage.

- `resolveRevision(experiment)`: read-only preparation; reuses identical latest
  inputs or returns a new immutable revision number. Replan using that returned
  experiment before Run. A concurrent conflicting revision is safely rejected.
- `saveExperiment(experiment)`: saves an explicit immutable revision.
- `begin(experiment,run)`: atomically saves the revision and initial run plan.
- `checkpoint(runId,cellRecord)`: atomically adds one immutable outcome and its
  completeness counter. Identical duplicates do not increment the counter.
- `finalize(run)`: checks committed counters/plan before storing terminal state.
- `loadRun(runId)`: rebuilds records in original plan order.
- `recoverInterrupted()`: explicitly marks persisted validating/running runs
  interrupted. Call on reload; no implicit execution resume exists.
- `listExperiments()` / `loadExperiment(experimentId,revision?)`: frozen inputs.
- `listRuns(experimentId,revision?)`: run summaries for reload discovery,
  newest timestamp first; `loadRun(runId)` loads selected result details.
- `importArchive(staged)`: one atomic commit of validated, staged input; mints
  local experiment/run UUIDs and keeps external source IDs in provenance.
  Imported unfinished runs become interrupted. `close()` releases the handle.

Archive validation precedes `importArchive`; pass only its staged return value,
never the unvalidated JSON input. Storage transaction aborts preserve prior rows.

## Exchange and worker helper

```js
const archive = ProgramLabArchive.create({
  build: plan.build,
  sweepPaths,
  validatePolicy: (policy, {archived}) => /* complete saved schema validation */,
  validateRequest: request => Compiler.normalizeProgramRequest(request, catalog),
  validateProgram: (program, {archived}) => /* shared structural validator */
});
const parts = await archive.exportArchive(experiment, selectedRun); // null: config only
const staged = await archive.importArchive(filesOrTextParts);
await store.importArchive(staged);
```

Validators return `{ok,value?,issues?}`. A historical program validator must
validate the saved definition's structure **without current catalog eligibility
checks**. The current compiler's catalog-dependent `executionContexts` check
needs the integration owner's compatible structural-validation seam; do not
silently bypass it or reject valid historical IDs as unknown current exercises.
`validateRequest` is never called against historical inputs. Historical policy
schema validation still applies. Runtime, catalog or diagnostics-mode mismatch sets `archived:true` and
`exactReplayAvailable:false`. Running on this build requires a new validated
plan/revision and does not rewrite the archive.

Parts use the spec's kind/schema envelope and a shared manifest of metadata and
ordered record hashes/part assignments. Imports require all declared parts once,
all hashes/references and completeness. Each file is at most 50 MiB, at most ten
parts and 500 MiB total. A cell is never split. Exact size is preflighted;
oversize full-result exports throw `archive_too_large` with a configuration-only
alternative. Missing parts throw `incomplete_archive`; nothing is committed.
Both archive import and export are asynchronous. Large record hashing uses native
Web Crypto SHA-256 over the shared canonical JSON format, avoiding repeated
JavaScript SHA compression on near-limit archives.

The worker entry is assembled by the packaging owner from fixed bundled URLs;
archive data never selects module/worker/catalog URLs. After loading exact shared
modules, a trusted worker entry calls
`ProgramLabArchiveWorker.install(context => ProgramLabArchive.create({...}))`.
The callback supplies the same validators above from its loaded engine/catalog.

The page calls `ProgramLabArchiveWorker.createClient({workerURL})` and then
`client.importArchive(File[],context)` or
`client.exportArchive(experiment,run,context)`. There is one outstanding operation;
the helper rejects stale messages, propagates validation errors, terminates on
its ten-minute resource-bound timeout, and `dispose()` cancels pending operations.
The long deadline permits the largest supported archive while Cancel still
terminates immediately. The context is trusted build
metadata; it is separate from imported archive contents.

## Focused proof and integration registration

`test/programlab-domain.mjs` and `test/programlab-archive.mjs` are fast Node suites.
`test/programlab-store.mjs` is a real Chromium/IndexedDB/Worker fault-injection
suite, using `REPFORGE_URL`'s origin and the repository browser launcher.
`node --max-old-space-size=8192 test/programlab-archive-limits.mjs` is the
separate resource stress: 1,000 planned cells, 200 scenarios, 20-value boundary,
ten parts within 129 bytes of 500 MiB, raw-byte round trip and oversize rejection.
Integration owns their registration in `test/suites.mjs` and ownership of
`programlab/{domain,store,archive,archive-worker}.js` in `tools/test-selection.mjs`.
The final packaged UI/engine/browser journey and full CI remain integration gates.
