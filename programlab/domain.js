(function (root) {
  "use strict";
  const Identity = typeof module !== "undefined" && module.exports
    ? require("../generation-identity.js") : root.RepForgeGenerationIdentity;
  const LIMITS = Object.freeze({ pairs: 200, sweepValues: 20, cells: 1000,
    depth: 40, parts: 10, partBytes: 50 * 1024 * 1024, totalBytes: 500 * 1024 * 1024 });
  const METRICS_VERSION = "programlab-metrics@1";
  const unsafe = new Set(["__proto__", "prototype", "constructor"]);

  function guard(value, depth = 0, active = new Set()) {
    if (depth > LIMITS.depth) throw new TypeError("Lab data exceeds maximum depth");
    if (value === null || typeof value !== "object") return;
    if (active.has(value)) throw new TypeError("Lab data must be acyclic");
    active.add(value);
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (unsafe.has(key)) throw new TypeError("Unsafe lab data key");
      if (!Object.hasOwn(descriptor, "value")) throw new TypeError("Lab properties must be data, not accessors");
      guard(descriptor.value, depth + 1, active);
    }
    active.delete(value);
  }
  function canonicalJSON(value) { guard(value); return Identity.canonicalJSON(value); }
  function digest(value) { guard(value); return Identity.digestCanonical(value); }
  function freeze(value) {
    if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  function snapshot(value) { return freeze(JSON.parse(canonicalJSON(value))); }
  function fail(code, message) { const error = new TypeError(message); error.code = code; throw error; }
  function keys(value, required, optional = []) {
    if (!value || Array.isArray(value) || typeof value !== "object"
      || required.some(key => !Object.hasOwn(value, key))
      || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) {
      fail("invalid_schema", "Missing or unknown lab fields");
    }
  }
  function text(value, field) {
    if (typeof value !== "string" || !value || value.length > 4096) fail("invalid_schema", `Invalid ${field}`);
    return value;
  }
  function create({ normalizePolicy, normalizeRequest, estimateDaySeconds, sweepPaths = [], allowSeedLabels = false }) {
    function normalized(normalize, value, code) {
      const checked = normalize(snapshot(value));
      if (!checked?.ok) { const error = new TypeError(code); error.code = code; error.issues = checked?.issues || []; throw error; }
      return snapshot(checked.value);
    }
    function plan(configuration, build) {
      const input = snapshot(configuration);
      keys(input, ["name", "notes", "mode", "scenarios", "baselinePolicy", "candidatePolicy", "referenceTimePolicy", "sweep"], ["experimentId", "revision", "provenance"]);
      keys(build, ["runtimeFingerprint", "catalogSha256", "diagnostics"]);
      for (const field of ["runtimeFingerprint", "catalogSha256"]) {
        if (!/^[a-f0-9]{64}$/.test(build[field])) fail("invalid_build", `Invalid ${field}`);
      }
      if (!["single", "batch", "sweep"].includes(input.mode)) fail("invalid_mode", "Unknown execution mode");
      if (!Array.isArray(input.scenarios) || !input.scenarios.length || input.scenarios.length > LIMITS.pairs
        || input.mode === "single" && input.scenarios.length !== 1) fail("pair_limit", "Invalid scenario count");
      if (typeof input.name !== "string" || typeof input.notes !== "string") fail("invalid_schema", "Name and notes must be strings");
      if (normalizePolicy(snapshot(input.baselinePolicy))?.isDefault === false) fail("invalid_baseline", "New runs require this build's bundled default baseline");
      const baselinePolicy = normalized(normalizePolicy, input.baselinePolicy, "invalid_engine_policy");
      const candidatePolicy = normalized(normalizePolicy, input.candidatePolicy, "invalid_engine_policy");
      const referenceTimePolicy = normalized(normalizePolicy, input.referenceTimePolicy, "invalid_engine_policy");
      const ids = new Set();
      const scenarios = input.scenarios.map(scenario => {
        keys(scenario, ["id", "name", "request"], ["inputMode", "answers", "seed"]);
        text(scenario.id, "scenario ID");
        text(scenario.name, "scenario name");
        if (ids.has(scenario.id)) fail("duplicate_scenario", "Duplicate scenario ID");
        ids.add(scenario.id);
        if (scenario.seed !== undefined && !allowSeedLabels) fail("unsupported_seed", "073.4 derives identity from canonical inputs; variable seeds are unsupported");
        if (scenario.seed !== undefined && typeof scenario.seed !== "string") fail("invalid_schema", "Historical seed labels must be strings");
        if (scenario.inputMode !== undefined && !["canonical", "answers"].includes(scenario.inputMode)) fail("invalid_schema", "Unknown scenario input mode");
        return { ...scenario, request: normalized(normalizeRequest, scenario.request, "invalid_request") };
      });
      let variants = [{ value: null, policy: candidatePolicy }];
      if (input.mode === "sweep") {
        keys(input.sweep, ["path", "values"]);
        if (!sweepPaths.includes(input.sweep.path)) fail("invalid_sweep", "Sweep path is not in the policy allowlist");
        const values = input.sweep.values;
        if (!Array.isArray(values) || !values.length || values.length > LIMITS.sweepValues
          || values.some(value => typeof value !== "number" || !Number.isFinite(value))) fail("invalid_sweep", "Invalid sweep values");
        if (new Set(values).size !== values.length) fail("invalid_sweep", "Duplicate sweep values");
        variants = values.map(value => {
          const policy = JSON.parse(canonicalJSON(candidatePolicy));
          const path = input.sweep.path.split(".");
          if (path.some(key => unsafe.has(key))) fail("invalid_sweep", "Unsafe sweep path");
          let parent = policy;
          for (const key of path.slice(0, -1)) parent = parent?.[key];
          const leaf = path[path.length - 1];
          if (!parent || typeof parent[leaf] !== "number") fail("invalid_sweep", "Sweep requires a numeric scalar leaf");
          parent[leaf] = value;
          return { value: Object.is(value, -0) ? 0 : value, policy: normalized(normalizePolicy, policy, "invalid_engine_policy") };
        });
      } else if (input.sweep !== null) fail("invalid_sweep", "Only sweep mode accepts sweep values");
      const experiment = { ...input, experimentId: input.experimentId || root.crypto.randomUUID(), revision: input.revision || 1,
        scenarios, baselinePolicy, candidatePolicy, referenceTimePolicy };
      text(experiment.experimentId, "experiment ID");
      if (!Number.isSafeInteger(experiment.revision) || experiment.revision < 1) fail("invalid_revision", "Invalid revision");
      const cells = [], byKey = new Map(), comparisons = [];
      function add(request, policy) {
        const preimage = { cellSchemaVersion: 1, runtimeFingerprint: build.runtimeFingerprint,
          catalogSha256: build.catalogSha256, request, policy, diagnostics: build.diagnostics };
        const cellKey = digest(preimage);
        if (!byKey.has(cellKey)) {
          const cell = { cellKey, request, policy, policyHash: digest(policy), diagnostics: build.diagnostics };
          byKey.set(cellKey, cell); cells.push(cell);
          if (cells.length > LIMITS.cells) fail("cell_limit", "Run exceeds 1000 distinct compiler cells");
        }
        return cellKey;
      }
      for (const scenario of scenarios) {
        const baselineKey = add(scenario.request, baselinePolicy);
        for (const variant of variants) {
          const candidateKey = add(scenario.request, variant.policy);
          comparisons.push({ scenarioId: scenario.id, value: variant.value, baselineKey, candidateKey,
            comparisonKey: digest({ baselineKey, candidateKey, metricsVersion: METRICS_VERSION, referenceTimePolicy }) });
        }
      }
      return snapshot({ kind: "taurifer-programlab-plan", schemaVersion: 1, experiment, build,
        cells, comparisons, caseCount: scenarios.length, cellCount: cells.length,
        baselineReuse: scenarios.length * (1 + variants.length) - cells.length, metricsVersion: METRICS_VERSION });
    }
    function metrics(result, ownPolicy, referencePolicy, { archived = false } = {}) {
      if (classify(result) !== "success") return null;
      const program = result.value;
      const cycles = Array.from({ length: program.cycles }, (_, index) => {
        const cycleIndex = index + 1, counts = {}, histogram = {}, purposeSets = {}, muscleAttributedSets = {}, repRanges = {}, statuses = {};
        let workingSets = 0, occurrences = 0, unspecified = 0, repMin = 0, repMax = 0, unsupportedReps = 0;
        const days = program.days.filter(day => day.kind === "training").map(day => {
          let daySets = 0;
          for (const slot of day.slots) {
            const cycle = slot.prescriptionsByCycle.find(entry => entry.cycleIndex === cycleIndex);
            const sets = cycle?.sets || [];
            occurrences++; histogram[sets.length] = (histogram[sets.length] || 0) + 1;
            purposeSets[slot.purposeId] = (purposeSets[slot.purposeId] || 0) + sets.length;
            for (const muscle of slot.musclePurposeIds || []) muscleAttributedSets[muscle] = (muscleAttributedSets[muscle] || 0) + sets.length;
            for (const set of sets) {
              workingSets++; daySets++;
              if (typeof set.rir === "number" && Number.isFinite(set.rir)) counts[set.rir] = (counts[set.rir] || 0) + 1;
              else unspecified++;
              statuses[set.status] = (statuses[set.status] || 0) + 1;
              const reps = Object.entries(set.targets || {}).filter(([semantic]) => semantic === "reps" || semantic === "repsPerSide");
              if (reps.length !== 1 || !reps[0][1] || typeof reps[0][1].min !== "number" || typeof reps[0][1].max !== "number") unsupportedReps++;
              else {
                const [semantic, target] = reps[0];
                const key = canonicalJSON({ role: slot.role, semantic, target }); repRanges[key] = (repRanges[key] || 0) + 1;
                // Per-side repetitions remain their own semantic; totals are not doubled.
                if (semantic === "repsPerSide") unsupportedReps++;
                else { repMin += target.min; repMax += target.max; }
              }
            }
          }
          const estimate = policy => {
            if (archived) return null;
            try { const value = estimateDaySeconds(day, cycleIndex, policy); return Number.isFinite(value) && value >= 0 ? value : null; }
            catch { return null; }
          };
          return { dayId: day.id, workingSets: daySets, ownSeconds: estimate(ownPolicy), commonSeconds: estimate(referencePolicy) };
        });
        const summarize = field => days.some(day => day[field] === null) ? null
          : { totalSeconds: days.reduce((sum, day) => sum + day[field], 0), maxDaySeconds: Math.max(0, ...days.map(day => day[field])) };
        const numeric = workingSets - unspecified;
        const share = (numerator, denominator) => ({ numerator, denominator, fraction: denominator ? numerator / denominator : null });
        return { cycleIndex, deload: (program.deloadCycles || []).includes(cycleIndex), workingSets, occurrences,
          setCountHistogram: histogram, twoSetShare: share(histogram[2] || 0, occurrences),
          rir: { counts, unspecified, zero: share(counts[0] || 0, numeric), low: share((counts[0] || 0) + (counts[1] || 0), numeric) },
          repRanges, repetitionTotals: unsupportedReps ? null : { min: repMin, max: repMax, semantic: "reps" },
          unsupportedRepetitionSets: unsupportedReps, purposeSets, muscleAttributedSets, muscleCountsOverlap: true, statuses, days,
          duration: { own: summarize("ownSeconds"), common: summarize("commonSeconds") },
          aboveRequestedMinutes: days.filter(day => day.ownSeconds !== null && day.ownSeconds > program.request.timeCeilingMinutes * 60).map(day => day.dayId) };
      });
      return snapshot({ metricsVersion: METRICS_VERSION, cycles, fittingEstimate: program.provenance?.estimatedSessionSeconds || null,
        durationUnavailableReason: archived ? "archive_fingerprint_mismatch" : null,
        constraints: { focusNotApplied: program.provenance?.focusNotApplied || [], diagnostics: result.diagnostics || null } });
    }
    return Object.freeze({ plan, metrics, compare, aggregate });
  }
  function semanticSlots(result) {
    const slots = new Map(), lineage = new Map();
    for (const entry of result.diagnostics?.slots || []) {
      if (!entry.retained) continue;
      if (lineage.has(entry.slotId)) fail("duplicate_lineage", "Duplicate diagnostic slot identity");
      lineage.set(entry.slotId, entry.lineage);
    }
    for (const day of result.value.days) for (const [position, slot] of day.slots.entries()) {
      const id = lineage.get(slot.id);
      if (typeof id !== "string" || !id || slots.has(id)) fail("missing_lineage", "Unique compiler lineage is required for semantic comparison");
      slots.set(id, { slot, dayOrder: day.order, position });
    }
    return slots;
  }
  function compare(baseline, candidate) {
    const left = baseline.result, right = candidate.result;
    const baselineOutcome = baseline.error ? "execution_error" : classify(left);
    const candidateOutcome = candidate.error ? "execution_error" : classify(right);
    const changes = [], provenanceChanges = [];
    if (baselineOutcome === "success" && candidateOutcome === "success") {
      const a = semanticSlots(left), b = semanticSlots(right);
      const change = (type, lineage, before, after, extra = {}) => {
        if (canonicalJSON(before) !== canonicalJSON(after)) changes.push({ type, lineage, before, after, ...extra });
      };
      for (const [lineage, item] of a) {
        const next = b.get(lineage);
        if (!next) { changes.push({ type: "slot_removed", lineage, before: item.slot, after: null }); continue; }
        change("exercise_replacement", lineage, item.slot.exerciseId, next.slot.exerciseId);
        change("movement", lineage, { dayOrder: item.dayOrder, position: item.position }, { dayOrder: next.dayOrder, position: next.position });
        change("effective_purpose", lineage, { role: item.slot.role, muscles: item.slot.musclePurposeIds || [], patterns: item.slot.movementPatternIds || [] },
          { role: next.slot.role, muscles: next.slot.musclePurposeIds || [], patterns: next.slot.movementPatternIds || [] });
        for (const [field, type] of [["executionMode", "execution_mode"], ["metricIds", "metric_composition"], ["role", "role"]]) {
          change(type, lineage, item.slot[field] ?? null, next.slot[field] ?? null);
        }
        const cyclesA = new Map(item.slot.prescriptionsByCycle.map(cycle => [cycle.cycleIndex, cycle]));
        const cyclesB = new Map(next.slot.prescriptionsByCycle.map(cycle => [cycle.cycleIndex, cycle]));
        for (const cycleIndex of new Set([...cyclesA.keys(), ...cyclesB.keys()])) {
          const setsA = cyclesA.get(cycleIndex)?.sets || [], setsB = cyclesB.get(cycleIndex)?.sets || [];
          change("set_count", lineage, setsA.length, setsB.length, { cycleIndex });
          for (let i = 0; i < Math.min(setsA.length, setsB.length); i++) {
            for (const [field, type] of [["targets", "targets"], ["rir", "rir"], ["restSeconds", "rest"], ["status", "status"]]) {
              change(type, lineage, setsA[i][field] ?? null, setsB[i][field] ?? null, { cycleIndex, setOrdinal: i + 1 });
            }
            if (canonicalJSON(setsA[i].provenance || null) !== canonicalJSON(setsB[i].provenance || null)) provenanceChanges.push({ lineage, cycleIndex, setOrdinal: i + 1 });
          }
        }
      }
      for (const [lineage, item] of b) if (!a.has(lineage)) changes.push({ type: "slot_added", lineage, before: null, after: item.slot });
      if (canonicalJSON(left.value.provenance || null) !== canonicalJSON(right.value.provenance || null)) provenanceChanges.push({ root: true });
    }
    return snapshot({ baselineOutcome, candidateOutcome, exactEqual: (baseline.resultJSON ?? JSON.stringify(left)) === (candidate.resultJSON ?? JSON.stringify(right)), changes, provenanceChanges });
  }
  function aggregate(rows, { cycleIndex = 1, commonPopulation = false } = {}) {
    // Each row is one declared variant; cases carry {id, baseline, candidate,
    // baselineMetrics,candidateMetrics}. An all-variant success intersection is explicit.
    let included = null;
    if (commonPopulation) for (const row of rows) {
      const successes = new Set(row.cases.filter(pair => classify(pair.baseline.result) === "success" && classify(pair.candidate.result) === "success").map(pair => pair.id));
      included = included === null ? successes : new Set([...included].filter(id => successes.has(id)));
    }
    return snapshot(rows.map(row => {
      const outcomes = {}, pairs = [], excluded = [];
      for (const pair of row.cases) {
        const a = pair.baseline.error ? "execution_error" : classify(pair.baseline.result), b = pair.candidate.error ? "execution_error" : classify(pair.candidate.result);
        const key = `${a}→${b}`; outcomes[key] = (outcomes[key] || 0) + 1;
        if (a !== "success" || b !== "success" || included && !included.has(pair.id)) { excluded.push({ id: pair.id, baselineOutcome: a, candidateOutcome: b }); continue; }
        const baseline = pair.baselineMetrics?.cycles.find(cycle => cycle.cycleIndex === cycleIndex), candidate = pair.candidateMetrics?.cycles.find(cycle => cycle.cycleIndex === cycleIndex);
        if (baseline && candidate) pairs.push({ id: pair.id, baseline, candidate });
      }
      function summarize(population) {
        const deltas = population.map(pair => pair.baseline.duration.common && pair.candidate.duration.common
          ? (pair.candidate.duration.common.maxDaySeconds - pair.baseline.duration.common.maxDaySeconds) / 60 : null);
        const duration = deltas.length && deltas.every(value => value !== null) ? { mean: deltas.reduce((a, b) => a + b, 0) / deltas.length, min: Math.min(...deltas), max: Math.max(...deltas) } : null;
        const pooled = field => { const numerator = population.reduce((sum, pair) => sum + field(pair.candidate).numerator, 0), denominator = population.reduce((sum, pair) => sum + field(pair.candidate).denominator, 0); return { numerator, denominator, fraction: denominator ? numerator / denominator : null }; };
        return { comparablePairs: population.length, durationMeanPairedMaxDayMinutesDelta: duration,
          pooledTwoSetShare: pooled(cycle => cycle.twoSetShare), pooledRirZeroShare: pooled(cycle => cycle.rir.zero),
          meanWorkingSetDelta: population.length ? population.reduce((sum, pair) => sum + pair.candidate.workingSets - pair.baseline.workingSets, 0) / population.length : null };
      }
      const ordinary = pairs.filter(pair => !pair.baseline.deload && !pair.candidate.deload), deload = pairs.filter(pair => pair.baseline.deload && pair.candidate.deload);
      const mixedStrata = ordinary.length > 0 && deload.length > 0 || ordinary.length + deload.length !== pairs.length;
      return { value: row.value, outcomes, includedCaseIds: pairs.map(pair => pair.id), excluded, comparablePairs: pairs.length,
        commonPopulation, ...summarize(mixedStrata ? [] : pairs), comparablePairs: pairs.length, mixedStrata,
        strata: { ordinary: summarize(ordinary), deload: summarize(deload) } };
    }));
  }
  function classify(result) {
    if (result?.ok === true && result.value) return "success";
    if (result?.ok === false) {
      const codes = (result.conflicts || result.issues || []).map(item => item.code);
      return codes.some(code => /invalid.*policy|invalid.*request|invalid_input/.test(code)) ? "invalid_input" : "conflict";
    }
    return "execution_error";
  }
  function createRunner({ createExecutor, store = null, onProgress = () => {},
    initializationTimeoutMs = 15000, cellTimeoutMs = 10000 }) {
    let active = null;
    function dispose(state) {
      try { state.executor?.dispose(); } finally { state.executor = null; }
    }
    function deadline(promise, milliseconds, code, state) {
      let timer;
      return Promise.race([Promise.resolve(promise), state.stop,
        new Promise((_, reject) => { timer = setTimeout(() => { const error = new Error(code); error.code = code; reject(error); }, milliseconds); })])
        .finally(() => clearTimeout(timer));
    }
    async function run(plan, { runId = root.crypto.randomUUID(), allowUnsaved = false, onProgress: progress = onProgress } = {}) {
      if (active) fail("run_active", "A run is already active");
      const frozenPlan = snapshot(plan);
      if (frozenPlan.cells.length > LIMITS.cells || frozenPlan.cellCount !== frozenPlan.cells.length) fail("invalid_plan", "Invalid run plan");
      const identity = text(runId, "run ID");
      let stop;
      const state = { executor: null, canceled: false, stop: new Promise(resolve => { stop = resolve; }), stopNow: () => stop(null), done: null };
      active = state;
      let current = { kind: "taurifer-programlab-run", schemaVersion: 1, runId: identity,
        plan: frozenPlan, status: "validating", records: [], completed: 0, total: frozenPlan.cellCount,
        saved: !allowUnsaved, error: null, startedAt: new Date().toISOString(), finishedAt: null };
      const publish = () => { try { progress(snapshot(current)); } catch { /* Rendering cannot change the run. */ } };
      const task = (async () => {
        try {
          if (!allowUnsaved) {
            if (!store) { const error = new Error("Saving is unavailable; explicitly choose Run without saving"); error.code = "storage_initialization_failed"; throw error; }
            try { await store.begin(frozenPlan.experiment, snapshot({ ...current, status: "running" })); }
            catch (cause) { const error = new Error("Could not save the run plan. Choose Run without saving to continue.", { cause }); error.code = "storage_initialization_failed"; throw error; }
          }
          current.status = "running"; publish();
          let initializationFailures = 0;
          for (const cell of frozenPlan.cells) {
            if (state.canceled) break;
            let result = null, resultJSON = null, error = null, initialized = !!state.executor;
            try {
              if (!state.executor) {
                const executor = createExecutor({ allowMainThreadFallback: false });
                if (state.canceled) { executor?.dispose(); break; }
                state.executor = executor;
                if (!executor || typeof executor.generate !== "function" || typeof executor.dispose !== "function") throw new Error("Invalid lab executor");
                if (executor.ready) {
                  const mode = await deadline(executor.ready(), initializationTimeoutMs, "initialization_timeout", state);
                  if (mode && mode !== "worker") { const unavailable = new Error("Lab requires a dedicated worker"); unavailable.code = "worker_unavailable"; throw unavailable; }
                }
              }
              if (state.canceled) break;
              initialized = true; initializationFailures = 0;
              // The adapter owns the current engine signature; no request or policy rule lives here.
              result = await deadline(state.executor.generate(cell.request, {
                enginePolicy: cell.policy, diagnostics: cell.diagnostics }), cellTimeoutMs, "cell_timeout", state);
              if (state.canceled) break;
              canonicalJSON(result); // Validate data before capturing the compiler's original key order.
              resultJSON = JSON.stringify(result);
              result = snapshot(result);
              if (classify(result) === "execution_error") { const malformed = new Error("Malformed generation result"); malformed.code = "invalid_engine_result"; throw malformed; }
            } catch (cause) {
              if (state.canceled) break;
              error = { code: typeof cause.code === "string" ? cause.code : "worker_error", message: String(cause.message || cause) };
              if (!initialized) initializationFailures++;
              dispose(state);
            }
            const record = snapshot({ cellKey: cell.cellKey, outcome: error ? "execution_error" : classify(result), result: error ? null : result,
              resultJSON: error ? null : resultJSON, error });
            current.records.push(record); current.completed = current.records.length;
            if (!allowUnsaved) {
              try { await store.checkpoint(runId, record); }
              catch (cause) { current.saved = false; current.error = { code: "checkpoint_failed", message: String(cause.message || cause) }; current.status = "failed"; dispose(state); break; }
            }
            publish();
            if (initializationFailures >= 2 && current.completed < current.total) {
              current.status = "failed";
              current.error = { code: "worker_initialization_failed", message: "Worker initialization could not recover; remaining cells were not scheduled" };
              break;
            }
          }
          if (current.status !== "failed") current.status = state.canceled ? "canceled" : "completed";
          current.finishedAt = new Date().toISOString();
          dispose(state);
          if (!allowUnsaved && current.saved) {
            try { await store.finalize(snapshot(current)); }
            catch (cause) { current.saved = false; current.status = "failed"; current.error = { code: "finalization_failed", message: String(cause.message || cause) }; }
          }
          publish(); return snapshot(current);
        } finally { dispose(state); if (active === state) active = null; }
      })();
      state.done = task;
      return task;
    }
    function cancel() {
      if (!active) return Promise.resolve();
      const state = active;
      state.canceled = true; dispose(state); state.stopNow();
      // Acknowledge worker termination immediately. run() still waits for any
      // accepted checkpoint before finalization, without blocking the Cancel UI.
      return Promise.resolve();
    }
    return Object.freeze({ run, cancel });
  }
  const api = { LIMITS, METRICS_VERSION, canonicalJSON, digest, snapshot, keys, fail, text, create, classify, createRunner };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ProgramLabDomain = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
