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
  function create({ normalizePolicy, normalizeRequest, estimateDaySeconds, sweepPaths = [] }) {
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
      const baselinePolicy = normalized(normalizePolicy, input.baselinePolicy, "invalid_engine_policy");
      const candidatePolicy = normalized(normalizePolicy, input.candidatePolicy, "invalid_engine_policy");
      const referenceTimePolicy = normalized(normalizePolicy, input.referenceTimePolicy, "invalid_engine_policy");
      const ids = new Set();
      const scenarios = input.scenarios.map(scenario => {
        keys(scenario, ["id", "name", "request"], ["inputMode", "answers", "seed"]);
        text(scenario.id, "scenario ID");
        if (ids.has(scenario.id)) fail("duplicate_scenario", "Duplicate scenario ID");
        ids.add(scenario.id);
        if (scenario.seed !== undefined) fail("unsupported_seed", "073.4 derives identity from canonical inputs; variable seeds are unsupported");
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
    return Object.freeze({ plan });
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
      let stop;
      const state = { executor: null, canceled: false, stop: new Promise(resolve => { stop = resolve; }), stopNow: () => stop(null), done: null };
      active = state;
      let current = { kind: "taurifer-programlab-run", schemaVersion: 1, runId: text(runId, "run ID"),
        plan: frozenPlan, status: "validating", records: [], completed: 0, total: frozenPlan.cellCount,
        saved: !allowUnsaved, error: null };
      const publish = () => { try { progress(snapshot(current)); } catch { /* Rendering cannot change the run. */ } };
      const task = (async () => {
        try {
          if (!allowUnsaved) {
            if (!store) { const error = new Error("Saving is unavailable; explicitly choose Run without saving"); error.code = "storage_initialization_failed"; throw error; }
            try { await store.begin(frozenPlan.experiment, snapshot({ ...current, status: "running" })); }
            catch (cause) { const error = new Error("Could not save the run plan. Choose Run without saving to continue.", { cause }); error.code = "storage_initialization_failed"; throw error; }
          }
          current.status = "running"; publish();
          for (const cell of frozenPlan.cells) {
            if (state.canceled) break;
            let result = null, error = null;
            try {
              if (!state.executor) {
                const executor = await deadline(Promise.resolve().then(() => createExecutor({ allowMainThreadFallback: false })), initializationTimeoutMs, "initialization_timeout", state);
                if (state.canceled) { executor?.dispose(); break; }
                state.executor = executor;
                if (!executor || typeof executor.generate !== "function" || typeof executor.dispose !== "function") throw new Error("Invalid lab executor");
                if (executor.ready) {
                  const mode = await deadline(executor.ready(), initializationTimeoutMs, "initialization_timeout", state);
                  if (mode && mode !== "worker") { const unavailable = new Error("Lab requires a dedicated worker"); unavailable.code = "worker_unavailable"; throw unavailable; }
                }
              }
              if (state.canceled) break;
              // The adapter owns the current engine signature; no request or policy rule lives here.
              result = await deadline(state.executor.generate(cell.request, undefined, {
                enginePolicy: cell.policy, diagnostics: cell.diagnostics }), cellTimeoutMs, "cell_timeout", state);
              if (state.canceled) break;
              result = snapshot(result);
              if (classify(result) === "execution_error") { const malformed = new Error("Malformed generation result"); malformed.code = "invalid_engine_result"; throw malformed; }
            } catch (cause) {
              if (state.canceled) break;
              error = { code: typeof cause.code === "string" ? cause.code : "worker_error", message: String(cause.message || cause) };
              dispose(state);
            }
            const record = snapshot({ cellKey: cell.cellKey, outcome: error ? "execution_error" : classify(result), result, error });
            current.records.push(record); current.completed = current.records.length;
            if (!allowUnsaved) {
              try { await store.checkpoint(runId, record); }
              catch (cause) { current.saved = false; current.error = { code: "checkpoint_failed", message: String(cause.message || cause) }; current.status = "failed"; dispose(state); break; }
            }
            publish();
          }
          if (current.status !== "failed") current.status = state.canceled ? "canceled" : "completed";
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
      return state.done?.then(() => undefined);
    }
    return Object.freeze({ run, cancel });
  }
  const api = { LIMITS, METRICS_VERSION, canonicalJSON, digest, snapshot, keys, fail, text, create, classify, createRunner };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ProgramLabDomain = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
