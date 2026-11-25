(function (root) {
  "use strict";

  const SCHEMA_VERSION = 2;
  const SWAP_REASONS = Object.freeze(["equipment", "preference", "pain", "crowded", "other"]);
  const SKIP_REASONS = Object.freeze(["time", "recovery", "pain", "equipment", "schedule", "trim", "other"]);
  const STATUS = new Set(["active", "finishing"]);
  const SET_ROLES = new Set(["working", "warmup"]);
  const RIR_MODES = new Set(["numeric", "effort"]);
  const UNITS = new Set(["kg", "lb"]);
  const EDIT_FIELDS = new Set(["load", "reps", "rir", "effort"]);
  // migrateLegacy's only unambiguous flat-field -> metric-map mapping: see the
  // allowedFields loop below (issue #332). rir/effort are intentionally
  // absent; those stay on the flat edited fields for every slot.
  const LEGACY_METRIC_SEMANTIC = Object.freeze({ load: "loadKg", reps: "reps" });
  /* The effort vocabulary (Plan 077, OD-2 to OD-4): the words of stage A, the reps-left chips of stage B ("3+" is
     credited as 3, a floor) and "Not sure", the one token that saves with no RIR. */
  const EFFORT_RIR = Object.freeze({ easy: 3, hard: 1, max: 0, r0: 0, r1: 1, r2: 2, r3p: 3, unsure: null });
  const EFFORT_TOKEN_SOURCE = Object.freeze({ easy: "effort", hard: "effort", max: "effort",
    r0: "reps_left", r1: "reps_left", r2: "reps_left", r3p: "reps_left_3plus", unsure: "unsure" });
  /* How a set's effort value was entered (Plan 077, OD-1): recorded at completion, carried to History as the row's
     effortSource. Absent means unknown (drafts and rows from before it existed); it is never inferred afterwards. */
  const EFFORT_SOURCES = Object.freeze(["rir", "effort", "reps_left", "reps_left_3plus", "reps_left_5plus", "unsure", "prefilled", "failure"]);
  /* A max set's guess (Plan 077, OD-17): what the lifter expected to do at the set's load, whether they changed the
     prefill, and what the prefill came from. Held on the set while it is pending and carried to its History row. */
  const CALIBRATION_KEYS = Object.freeze(["v", "predictedReps", "predictionEdited", "prefillBasis"]);
  const PREFILL_BASES = Object.freeze(["reps_rir", "reps"]);
  const DECIMAL = /^\d+(?:\.\d+)?$/;
  const INTEGER = /^\d+$/;
  const MAX_TEXT = 10000;
  const MAX_ID = 240;
  const CONTEXT_TOUCHED_FIELDS = ["day", "date", "sessionNotes", "bodyweight"];
  // The engine/compiler ceiling for a programmed target RIR, added with the
  // Plan 067 engine replacement. Before that release, validation only
  // rejected a negative, non-finite, or non-numeric target, so a draft
  // written earlier (or a fresh draft whose target falls back to a lifter's
  // own unbounded historical logged RIR; see `old.rir` in create() below)
  // can legitimately carry a value above this. clampLegacyTargetRir widens
  // tolerance to exactly the range the prior validator accepted, so a
  // genuinely corrupt value (negative, NaN, non-finite, or a magnitude no
  // lifter would ever log) still fails validation instead of being silently
  // accepted.
  const MAX_TARGET_RIR = 6;
  const LEGACY_TARGET_RIR_CLAMP_CEILING = 20;
  const MuscleDomain = root?.RepForgeProgramEntry ||
    (typeof require === "function" ? require("./program-entry.js") : null);
  const MAX_MUSCLE_ATTRIBUTION = MuscleDomain?.MUSCLE_ATTRIBUTION_MAX_LENGTH || 500;
  const LOAD_SEMANTICS = new Set(["loadKg", "assistanceKg", "loadPerSideKg", "persistentLoadPerSideKg"]);
  const LOADING_CONVENTIONS = new Set(["external", "assistance", "per_side", "bodyweight"]);
  const MetricDomain = root?.RepForgeExerciseMetrics ||
    (typeof require === "function" ? require("./exercise-metrics.js") : null);
  if (!MetricDomain) throw new Error("RepForgeExerciseMetrics unavailable");

  function isCanonicalMuscleAttribution(value) {
    return MuscleDomain?.isCanonicalMuscleAttribution?.(value) === true;
  }

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function isSafeInteger(value, min = 0) {
    return Number.isSafeInteger(value) && value >= min;
  }

  function isText(value, { empty = false, max = MAX_TEXT } = {}) {
    return typeof value === "string" && value.length <= max && (empty || value.length > 0);
  }

  function isMuscleText(value, { empty = false } = {}) {
    return typeof value === "string" && [...value].length <= MAX_MUSCLE_ATTRIBUTION &&
      (empty || value.length > 0);
  }

  function isOptionalText(value, max = MAX_TEXT) {
    return value == null || isText(value, { empty: true, max });
  }

  function isBlockId(value, programId) {
    return isText(value, { max: MAX_ID }) && value.trim().length > 0 &&
      (programId == null || value !== programId);
  }

  function jsonClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
    return value;
  }

  function error(code, details) {
    return deepFreeze({ kind: "domain-error", code, ...(details || {}) });
  }

  function migrationError(code, details) {
    return deepFreeze({ kind: "migration-error", code, ...(details || {}) });
  }

  function isDomainError(value) {
    return value?.kind === "domain-error";
  }

  function editableText(value) {
    if (value == null) return null;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && value.length <= 64) return value;
    return undefined;
  }

  function snapshotFromExercise(exercise) {
    const programmed = exercise.programmed;
    const snapshot = {
      exerciseInstanceId: exercise.exerciseInstanceId,
      sourceExerciseId: exercise.sourceExerciseId,
      displayName: exercise.displayName,
      primary: programmed.primary,
      secondary: programmed.secondary,
    };
    if (exercise.libraryId) snapshot.libraryId = exercise.libraryId;
    if (programmed.movementId) snapshot.movementId = programmed.movementId;
    return snapshot;
  }

  function activeMovement(exercise) {
    return exercise.substitution?.replacement || snapshotFromExercise(exercise);
  }

  function eventMovement(movement) {
    return {exerciseId:movement.libraryId || movement.movementId || movement.sourceExerciseId,
      name:movement.displayName};
  }

  function validObservation(value) {
    return isPlainObject(value) && Object.keys(value).every(key => ["exerciseId","name","kind","swapped","replacementId"].includes(key)) &&
      isText(value.exerciseId,{max:MAX_ID}) && isText(value.name) &&
      ["pain","discomfort"].includes(value.kind) && typeof value.swapped === "boolean" &&
      (!hasOwn(value,"replacementId") || isText(value.replacementId,{max:MAX_ID}));
  }

  function observe(exercise,movement,kind,replacementId=null) {
    const identity=eventMovement(movement),observations=exercise.discomfort || [];
    const existing=observations.find(item => item.exerciseId===identity.exerciseId);
    if(existing){
      if(kind==="pain")existing.kind="pain";
      if(replacementId){existing.replacementId=replacementId;existing.swapped=true;}
    }else observations.push({...identity,kind,swapped:!!replacementId,...(replacementId?{replacementId}:{})});
    exercise.discomfort=observations;
  }

  function syncObservationSwaps(exercise) {
    for(const observation of exercise.discomfort || [])
      observation.swapped=!!observation.replacementId && observation.replacementId===exercise.substitution?.replacement.exerciseInstanceId;
  }

  function movementSnapshotMatches(left, right) {
    const fields = [
      "exerciseInstanceId",
      "sourceExerciseId",
      "libraryId",
      "movementId",
      "displayName",
      "primary",
      "secondary",
    ];
    return fields.every((field) => (left[field] ?? null) === (right[field] ?? null));
  }

  function validateMovementSnapshot(value, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return;
    }
    for (const field of ["exerciseInstanceId", "sourceExerciseId", "displayName"]) {
      if (!isText(value[field], { max: field.includes("Id") ? MAX_ID : 500 })) {
        issues.push(`${path}.${field}`);
      }
    }
    for (const field of ["primary", "secondary"]) {
      if (isMuscleText(value[field], { empty: true }) && !isCanonicalMuscleAttribution(value[field])) {
        issues.push(`${path}.${field}:invalid-muscle-domain`);
      } else if (!isMuscleText(value[field], { empty: true })) {
        issues.push(`${path}.${field}`);
      }
    }
    for (const field of ["libraryId", "movementId"]) {
      if (hasOwn(value, field) && !isText(value[field], { max: MAX_ID })) issues.push(`${path}.${field}`);
    }
  }

  function validateWriter(value, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return;
    }
    for (const field of ["installationId", "tabId", "operationId"]) {
      if (!isText(value[field], { max: MAX_ID })) issues.push(`${path}.${field}`);
    }
  }

  function emptyContextTouched() {
    return { day: false, date: false, sessionNotes: false, bodyweight: false };
  }

  function validateContextTouched(value, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return;
    }
    for (const field of CONTEXT_TOUCHED_FIELDS) {
      if (typeof value[field] !== "boolean") issues.push(`${path}.${field}`);
    }
    for (const field of Object.keys(value)) {
      if (!CONTEXT_TOUCHED_FIELDS.includes(field)) issues.push(`${path}.${field}:unknown`);
    }
  }

  function contextTouchedForCreate(value) {
    if (value == null) return emptyContextTouched();
    if (!isPlainObject(value) || Object.keys(value).some((field) => !CONTEXT_TOUCHED_FIELDS.includes(field)) ||
      CONTEXT_TOUCHED_FIELDS.some((field) => typeof value[field] !== "boolean")) return null;
    return Object.fromEntries(CONTEXT_TOUCHED_FIELDS.map((field) => [field, value[field]]));
  }

  function validateTouched(value, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return;
    }
    for (const field of ["load", "reps", "effort"]) {
      if (typeof value[field] !== "boolean") issues.push(`${path}.${field}`);
    }
  }

  function validateMetricRecords(metrics, path, issues, { allowEmpty = true } = {}) {
    if (!Array.isArray(metrics) || metrics.length > 16) {
      issues.push(`${path}:array`);
      return [];
    }
    const ids = metrics.map(metric => metric?.id);
    const checked = MetricDomain.validateDefinitions(ids, metrics, { allowEmpty });
    for (const issue of checked.issues) issues.push(`${path}:${issue}`);
    return ids;
  }

  function validateMetricMap(value, ids, path, issues, { booleanValues = false } = {}) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return;
    }
    const allowed = new Set(ids);
    for (const [id, entry] of Object.entries(value)) {
      if (!allowed.has(id)) issues.push(`${path}.${id}:unknown-metric`);
      if (booleanValues ? typeof entry !== "boolean" : !isOptionalText(entry, 64)) {
        issues.push(`${path}.${id}:value`);
      }
    }
    if (Object.keys(value).length !== ids.length || ids.some(id => !hasOwn(value, id))) {
      issues.push(`${path}:coverage`);
    }
  }

  function validateLoadingContext(value, path, issues, fallbackConvention = null) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return;
    }
    const allowed = new Set(["bodyweightKg", "bodyweightContributionEnabled", "externalLoadMultiplier", "bodyweightCoefficient", "availableLoadsKg", "loadingConvention", "executionMode"]);
    for (const key of Object.keys(value)) if (!allowed.has(key)) issues.push(`${path}.${key}:unknown`);
    // Optional: the lifter's explicit mode for an ambiguous per-side movement (#382).
    if (hasOwn(value, "executionMode") && value.executionMode !== "bilateral" && value.executionMode !== "unilateral") {
      issues.push(`${path}.executionMode`);
    }
    if (hasOwn(value, "loadingConvention") && !LOADING_CONVENTIONS.has(value.loadingConvention)) {
      issues.push(`${path}.loadingConvention`);
    }
    const convention = value.loadingConvention ?? fallbackConvention;
    if (hasOwn(value, "bodyweightKg") && value.bodyweightKg != null &&
      (typeof value.bodyweightKg !== "number" || !Number.isFinite(value.bodyweightKg) || value.bodyweightKg <= 0)) {
      issues.push(`${path}.bodyweightKg`);
    }
    if (hasOwn(value, "bodyweightContributionEnabled") && value.bodyweightContributionEnabled !== null && typeof value.bodyweightContributionEnabled !== "boolean") {
      issues.push(`${path}.bodyweightContributionEnabled`);
    }
    if (convention != null && !hasOwn(value, "externalLoadMultiplier")) {
      issues.push(`${path}.externalLoadMultiplier`);
    }
    if (hasOwn(value, "externalLoadMultiplier") && value.externalLoadMultiplier !== null &&
      (typeof value.externalLoadMultiplier !== "number" || !Number.isFinite(value.externalLoadMultiplier) ||
        value.externalLoadMultiplier < (convention === "bodyweight" ? 0 : Number.MIN_VALUE) || value.externalLoadMultiplier > 10)) {
      issues.push(`${path}.externalLoadMultiplier`);
    }
    if (convention === "external" || convention === "assistance") {
      if (value.externalLoadMultiplier !== 1) issues.push(`${path}.externalLoadMultiplier:convention`);
    } else if (convention === "bodyweight") {
      if (value.externalLoadMultiplier !== 0) issues.push(`${path}.externalLoadMultiplier:convention`);
    }
    if (hasOwn(value, "bodyweightCoefficient") &&
      value.bodyweightCoefficient !== null &&
      (typeof value.bodyweightCoefficient !== "number" || !Number.isFinite(value.bodyweightCoefficient) || value.bodyweightCoefficient < 0 || value.bodyweightCoefficient > 1)) {
      issues.push(`${path}.bodyweightCoefficient`);
    }
    if (hasOwn(value, "availableLoadsKg") && (!Array.isArray(value.availableLoadsKg) || value.availableLoadsKg.length > 500 ||
      value.availableLoadsKg.some(load => typeof load !== "number" || !Number.isFinite(load) || load < 0 || load > 1000) ||
      new Set(value.availableLoadsKg).size !== value.availableLoadsKg.length)) {
      issues.push(`${path}.availableLoadsKg`);
    }
  }

  function rawCatalogExercise(libraryId) {
    if (!isText(libraryId, { max: MAX_ID })) return null;
    try {
      const catalog = root?.RepForgeExerciseCatalog?.snapshot?.() || bundledCatalog();
      return catalog?.exercises?.find(exercise => exercise?.id === libraryId) || null;
    } catch {
      return null;
    }
  }

  // Module consumers without the page loader (the install-transfer Worker and
  // its contract) validate against the same raw catalog the page loads.
  function bundledCatalog() {
    if (typeof require !== "function") return null;
    try { return require("./assets/exercise-catalog.json"); } catch { return null; }
  }

  function expectedLoadingConvention(metricDefinitions) {
    const semantics = new Set((metricDefinitions || []).map(metric => metric?.semantic));
    return semantics.has("assistanceKg") ? "assistance"
      : semantics.has("loadPerSideKg") || semantics.has("persistentLoadPerSideKg") ? "per_side"
        : metricDefinitions?.length === 1 && (semantics.has("reps") || semantics.has("repsPerSide")) ? "bodyweight" : "external";
  }

  function loadingContextForProgram(source, spec, convention, loadingModel) {
    const input = isPlainObject(spec?.loadingContext) ? spec.loadingContext
      : isPlainObject(source?.loadingContext) ? source.loadingContext : null;
    if (!input) return null;
    const context = jsonClone(input);
    if (context.loadingConvention != null && context.loadingConvention !== convention) return null;
    context.loadingConvention = convention;
    if (!hasOwn(context, "externalLoadMultiplier")) {
      context.externalLoadMultiplier = convention === "per_side" ? null : convention === "bodyweight" ? 0 : 1;
    }
    if (!hasOwn(context, "bodyweightCoefficient") && hasOwn(loadingModel || {}, "bodyweightCoefficient")) {
      context.bodyweightCoefficient = loadingModel.bodyweightCoefficient;
    }
    return context;
  }

  function metricProgramBinding({
    metricOrigin,
    metricIds,
    metricDefinitions,
    sourceLibraryId,
    loadingModel,
    loadingConvention,
    loadingContext,
  }, path, issues) {
    if (!Array.isArray(metricIds) || !Array.isArray(metricDefinitions)) return;
    if (!isText(sourceLibraryId, { max: MAX_ID })) issues.push(`${path}.sourceLibraryId`);
    if (! ["source_catalog", "user_defined"].includes(metricOrigin)) issues.push(`${path}.metricOrigin`);
    if (!isPlainObject(loadingModel)) issues.push(`${path}.loadingModel`);
    if (!LOADING_CONVENTIONS.has(loadingConvention)) issues.push(`${path}.loadingConvention`);
    if (!isPlainObject(loadingContext)) issues.push(`${path}.loadingContext`);
    else {
      validateLoadingContext(loadingContext, `${path}.loadingContext`, issues, loadingConvention);
      if (loadingContext.loadingConvention !== loadingConvention) issues.push(`${path}.loadingContext.loadingConvention`);
      if (!hasOwn(loadingContext, "bodyweightCoefficient")) issues.push(`${path}.loadingContext.bodyweightCoefficient`);
    }
    const coefficient = loadingModel?.bodyweightCoefficient ?? null;
    if ((loadingContext?.bodyweightCoefficient ?? null) !== coefficient) issues.push(`${path}.loadingCoefficientMismatch`);
    const definitions = MetricDomain.validateDefinitions(metricIds, metricDefinitions, { allowEmpty: true });
    issues.push(...definitions.issues.map(issue => `${path}.${issue}`));
    const expectedConvention = expectedLoadingConvention(metricDefinitions);
    if (loadingConvention !== expectedConvention) issues.push(`${path}.loadingConvention:metric-composition`);
    const binding = MetricDomain.validateExerciseSourceBinding({
      metricOrigin,
      metricIds,
      metricDefinitions,
      sourceId: sourceLibraryId,
      sourceExercise: rawCatalogExercise(sourceLibraryId),
      bodyweightCoefficient: coefficient,
    });
    issues.push(...binding.issues.map(issue => `${path}.${issue}`));
  }

  function validateProgrammedSet(value, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return;
    }
    for (const field of ["suggestedLoad", "minReps", "maxReps", "targetRir"]) {
      if (hasOwn(value, field) && value[field] != null &&
        (typeof value[field] !== "number" || !Number.isFinite(value[field]) || value[field] < 0 ||
          (field === "targetRir" && value[field] > MAX_TARGET_RIR))) {
        issues.push(`${path}.${field}`);
      }
    }
    if (hasOwn(value, "metrics")) {
      const ids = validateMetricRecords(value.metrics, `${path}.metrics`, issues);
      if (value.metricType !== "source_metrics@1") issues.push(`${path}.metricType`);
      if (!Array.isArray(value.metricIds) || value.metricIds.length !== ids.length ||
        value.metricIds.some((id, index) => id !== ids[index])) issues.push(`${path}.metricIds`);
      const targets = value.targets ?? {};
      const checkedTargets = MetricDomain.validateTargets(ids, targets);
      for (const issue of checkedTargets.issues) issues.push(`${path}.targets:${issue}`);
    } else if (["targets", "metricIds", "metricType"].some(field => hasOwn(value, field))) {
      issues.push(`${path}.metrics:without-definitions`);
    }
    if (hasOwn(value, "restSeconds") && value.restSeconds != null &&
      (!isSafeInteger(value.restSeconds) || value.restSeconds > 86400)) {
      issues.push(`${path}.restSeconds`);
    }
    if (hasOwn(value, "sourceLibraryId") && !isText(value.sourceLibraryId, { max: MAX_ID })) {
      issues.push(`${path}.sourceLibraryId`);
    }
    if (hasOwn(value, "metricOrigin") && !["source_catalog", "user_defined"].includes(value.metricOrigin)) {
      issues.push(`${path}.metricOrigin`);
    }
    if (hasOwn(value, "loadingModel") && (!isPlainObject(value.loadingModel) ||
      Object.keys(value.loadingModel).some(key => !["bodyweightCoefficient", "assistanceDirection"].includes(key)) ||
      (hasOwn(value.loadingModel, "bodyweightCoefficient") && value.loadingModel.bodyweightCoefficient !== null &&
        (typeof value.loadingModel.bodyweightCoefficient !== "number" || !Number.isFinite(value.loadingModel.bodyweightCoefficient) ||
          value.loadingModel.bodyweightCoefficient < 0 || value.loadingModel.bodyweightCoefficient > 1)) ||
      (hasOwn(value.loadingModel, "assistanceDirection") && !["subtract", null].includes(value.loadingModel.assistanceDirection)))) {
      issues.push(`${path}.loadingModel`);
    }
    if (hasOwn(value, "loadingConvention") && !LOADING_CONVENTIONS.has(value.loadingConvention)) {
      issues.push(`${path}.loadingConvention`);
    }
    if (hasOwn(value, "loadingContext")) {
      validateLoadingContext(value.loadingContext, `${path}.loadingContext`, issues, value.loadingConvention ?? null);
      if (value.loadingContext?.loadingConvention !== value.loadingConvention) {
        issues.push(`${path}.loadingContext.loadingConvention`);
      }
    }
    if (hasOwn(value, "equipmentId") && value.equipmentId != null && !isText(value.equipmentId, { max: MAX_ID })) {
      issues.push(`${path}.equipmentId`);
    }
  }

  function ordinaryReps(set) {
    const metrics = set.programmed?.metrics;
    if (!Array.isArray(metrics)) return validInteger(set.edited?.reps ?? editableText(set.programmed?.minReps), { positive: true });
    const reps = metrics.find(metric => metric?.semantic === "reps");
    return reps && !metrics.some(metric => metric?.semantic === "repsPerSide")
      ? metricValue(set.edited?.metrics?.[reps.id], reps) : null;
  }

  const explicitNumericEffort = (source) => source === "rir" || source === "reps_left";
  const validPartialCount = (count) => Number.isInteger(count) && count >= 0 && count <= 5;

  function canRecordPartials(set) {
    return !!set && set.role === "working" && !set.origin && !set.calibration && ordinaryReps(set) > 0;
  }

  function hasExplicitZero(set) {
    return set.touched?.effort === true && set.edited?.effort == null && validDecimal(set.edited?.rir) === 0 &&
      (set.completion === "pending" || explicitNumericEffort(set.completion?.effortSource));
  }

  function validHistoryPartials(row) {
    return !hasOwn(row, "partialReps") || validPartialCount(row.partialReps) && (row.partialReps === 0 ||
      !row.warmup && row.work !== false && !row.origin && !row.calibration &&
      row.rir === 0 && explicitNumericEffort(row.effortSource) && Number.isSafeInteger(row.reps) && row.reps > 0 &&
      (!Array.isArray(row.metricDefinitions) || row.metricDefinitions.some(metric => metric?.semantic === "reps") &&
        !row.metricDefinitions.some(metric => metric?.semantic === "repsPerSide")));
  }

  /** A Prelude History row is a warm-up beside the sets: numbered by its own ordinal, with no effort, count or opening. */
  function validSuggestedWarmupRow(row) {
    const suggested = row?.origin === "suggested-warmup", numbered = hasOwn(row ?? {}, "warmupOrdinal");
    if (!suggested && !numbered) return true;
    return suggested && numbered && row.warmup === true && Number.isSafeInteger(row.warmupOrdinal) &&
      row.warmupOrdinal >= 1 && row.warmupOrdinal <= PRELUDE_MAX_STEPS && row.set === 0 && row.setIndex === 0 &&
      (row.rir === null || row.rir === undefined) &&
      ["partialReps", "effortSource", "calibration", "startingLoad", "lastRepSlow"].every(key => !hasOwn(row, key));
  }

  function validateSet(value, setId, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return;
    }
    if (value.setId !== setId || !isText(value.setId, { max: MAX_ID })) issues.push(`${path}.setId`);
    if (!isSafeInteger(value.ordinal, 1)) issues.push(`${path}.ordinal`);
    if (hasOwn(value, "origin") && value.origin !== "ramp") issues.push(`${path}.origin`);
    if (hasOwn(value, "startingLoad") && !validStartingLoad(value.startingLoad)) issues.push(`${path}.startingLoad`);
    if (!SET_ROLES.has(value.role)) issues.push(`${path}.role`);
    validateProgrammedSet(value.programmed, `${path}.programmed`, issues);
    if (!isPlainObject(value.edited)) issues.push(`${path}.edited:object`);
    else {
      for (const field of ["load", "reps", "rir", "effort"]) {
        if (hasOwn(value.edited, field) && !isOptionalText(value.edited[field], 64)) issues.push(`${path}.edited.${field}`);
      }
    }
    validateTouched(value.touched, `${path}.touched`, issues);
    if (Array.isArray(value.programmed?.metrics)) {
      const ids = value.programmed.metrics.map(metric => metric?.id);
      validateMetricMap(value.edited?.metrics, ids, `${path}.edited.metrics`, issues);
      validateMetricMap(value.touched?.metrics, ids, `${path}.touched.metrics`, issues, { booleanValues: true });
    } else if (hasOwn(value.edited || {}, "metrics") || hasOwn(value.touched || {}, "metrics")) {
      issues.push(`${path}.metrics:without-definitions`);
    }
    if (value.completion !== "pending") {
      if (!isPlainObject(value.completion) || !isText(value.completion.completedAt, { max: 100 })) {
        issues.push(`${path}.completion`);
      } else if (hasOwn(value.completion, "effortSource") && !EFFORT_SOURCES.includes(value.completion.effortSource)) {
        issues.push(`${path}.completion.effortSource`);
      } else if (hasOwn(value.completion, "lastRepSlow") && typeof value.completion.lastRepSlow !== "boolean") {
        issues.push(`${path}.completion.lastRepSlow`);
      }
    }
    if (hasOwn(value, "partialReps") && (!validPartialCount(value.partialReps) ||
      value.partialReps > 0 && (!canRecordPartials(value) || !hasExplicitZero(value)))) issues.push(`${path}.partialReps`);
    if (hasOwn(value, "correction")) {
      const original = value.correction;
      if (value.completion !== "pending" || !isPlainObject(original) || !isPlainObject(original.completion) ||
        hasOwn(original, "correction") || original.ordinal !== value.ordinal ||
        JSON.stringify(original.programmed) !== JSON.stringify(value.programmed)) issues.push(`${path}.correction`);
      else validateSet(original, setId, `${path}.correction`, issues);
    }
    if (hasOwn(value, "performed")) validateMovementSnapshot(value.performed, `${path}.performed`, issues);
    if (hasOwn(value, "calibration") && !validCalibration(value.calibration)) issues.push(`${path}.calibration`);
  }

  function validStartingLoad(value) {
    const keys = ["v", "openingKg", "basis", "ramps", "version"];
    return isPlainObject(value) && Object.keys(value).length === keys.length && keys.every(key => hasOwn(value, key)) &&
      value.v === 1 && typeof value.openingKg === "number" && Number.isFinite(value.openingKg) && value.openingKg > 0 && value.openingKg <= 1000 &&
      ["prior", "ratio", "floor", "typed"].includes(value.basis) && Number.isSafeInteger(value.ramps) && value.ramps >= 0 && value.ramps <= 3 &&
      isText(value.version, { max: 80 });
  }

  function validCalibration(value) {
    return isPlainObject(value) && Object.keys(value).length === CALIBRATION_KEYS.length &&
      CALIBRATION_KEYS.every(key => hasOwn(value, key)) && value.v === 1 &&
      Number.isSafeInteger(value.predictedReps) && value.predictedReps >= 1 && value.predictedReps <= 30 &&
      typeof value.predictionEdited === "boolean" && PREFILL_BASES.includes(value.prefillBasis);
  }

  function validateProgrammedExercise(value, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return;
    }
    if (!isSafeInteger(value.order)) issues.push(`${path}.order`);
    if (!isSafeInteger(value.sets, 1)) issues.push(`${path}.sets`);
    // Metric-backed movements without a repetition metric have no flat range.
    const noRepRange = value.metricOrigin != null && value.minReps == null && value.maxReps == null;
    if (!noRepRange) {
      for (const field of ["minReps", "maxReps"]) {
        if (!isSafeInteger(value[field], 1)) issues.push(`${path}.${field}`);
      }
    }
    if (isSafeInteger(value.minReps, 1) && isSafeInteger(value.maxReps, 1) && value.minReps > value.maxReps) {
      issues.push(`${path}.repRange`);
    }
    if (hasOwn(value, "targetRir") && value.targetRir != null &&
      (typeof value.targetRir !== "number" || !Number.isFinite(value.targetRir) || value.targetRir < 0 ||
        value.targetRir > MAX_TARGET_RIR)) {
      issues.push(`${path}.targetRir`);
    }
    if (!isText(value.notes, { empty: true })) issues.push(`${path}.notes`);
    for (const field of ["primary", "secondary"]) {
      if (!isMuscleText(value[field], { empty: true })) issues.push(`${path}.${field}`);
      else if (!isCanonicalMuscleAttribution(value[field])) issues.push(`${path}.${field}:invalid-muscle-domain`);
    }
    if (!isOptionalText(value.progressionStrategy, 240)) issues.push(`${path}.progressionStrategy`);
    if (!isOptionalText(value.movementPattern, 240)) issues.push(`${path}.movementPattern`);
    if (hasOwn(value, "loadingModel") && (!isPlainObject(value.loadingModel) ||
      Object.keys(value.loadingModel).some(key => !["bodyweightCoefficient", "assistanceDirection"].includes(key)) ||
      (hasOwn(value.loadingModel, "bodyweightCoefficient") &&
        value.loadingModel.bodyweightCoefficient !== null &&
        (typeof value.loadingModel.bodyweightCoefficient !== "number" || !Number.isFinite(value.loadingModel.bodyweightCoefficient) || value.loadingModel.bodyweightCoefficient < 0 || value.loadingModel.bodyweightCoefficient > 1)) ||
      (hasOwn(value.loadingModel, "assistanceDirection") && !["subtract", null].includes(value.loadingModel.assistanceDirection)))) {
      issues.push(`${path}.loadingModel`);
    }
    if (hasOwn(value, "metricOrigin") && !["source_catalog", "user_defined"].includes(value.metricOrigin)) {
      issues.push(`${path}.metricOrigin`);
    }
    if (hasOwn(value, "equipmentId") && value.equipmentId != null && !isText(value.equipmentId, { max: MAX_ID })) issues.push(`${path}.equipmentId`);
    if (hasOwn(value, "loadingConvention") && !LOADING_CONVENTIONS.has(value.loadingConvention)) issues.push(`${path}.loadingConvention`);
    if (hasOwn(value, "loadingContext")) {
      validateLoadingContext(value.loadingContext, `${path}.loadingContext`, issues, value.loadingConvention ?? null);
      if (value.loadingContext?.loadingConvention != null && value.loadingContext.loadingConvention !== value.loadingConvention) {
        issues.push(`${path}.loadingContext.loadingConvention`);
      }
    }
    const modelCoefficient = value.loadingModel?.bodyweightCoefficient ?? null;
    const contextCoefficient = value.loadingContext?.bodyweightCoefficient ?? null;
    if (modelCoefficient !== contextCoefficient) issues.push(`${path}.loadingCoefficientMismatch`);
    if (hasOwn(value, "restSeconds") && value.restSeconds != null &&
      (!isSafeInteger(value.restSeconds) || value.restSeconds > 86400)) issues.push(`${path}.restSeconds`);
    if (!isText(value.sourceFingerprint, { max: 1000 })) issues.push(`${path}.sourceFingerprint`);
    for (const field of ["libraryId", "movementId"]) {
      if (hasOwn(value, field) && value[field] != null && !isText(value[field], { max: MAX_ID })) issues.push(`${path}.${field}`);
    }
  }

  function validateExercise(value, exerciseId, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return;
    }
    if (value.exerciseInstanceId !== exerciseId || !isText(value.exerciseInstanceId, { max: MAX_ID })) issues.push(`${path}.exerciseInstanceId`);
    if (!isText(value.sourceExerciseId, { max: MAX_ID })) issues.push(`${path}.sourceExerciseId`);
    if (!isOptionalText(value.libraryId, MAX_ID)) issues.push(`${path}.libraryId`);
    if (!isText(value.displayName, { max: 500 })) issues.push(`${path}.displayName`);
    validateProgrammedExercise(value.programmed, `${path}.programmed`, issues);
    if (value.substitution != null) {
      if (!isPlainObject(value.substitution)) issues.push(`${path}.substitution:object`);
      else {
        if(hasOwn(value.substitution,"reportedFrom"))validateMovementSnapshot(value.substitution.reportedFrom,`${path}.substitution.reportedFrom`,issues);
        validateMovementSnapshot(value.substitution.original, `${path}.substitution.original`, issues);
        validateMovementSnapshot(value.substitution.replacement, `${path}.substitution.replacement`, issues);
        if (Object.keys(value.substitution).some(key => !["original", "replacement", "selectedAt", "originalPendingSets", "reportedFrom"].includes(key))) {
          issues.push(`${path}.substitution:unknown-field`);
        }
        if (isPlainObject(value.substitution.original) && isPlainObject(value.programmed) &&
          !movementSnapshotMatches(value.substitution.original, snapshotFromExercise(value))) {
          issues.push(`${path}.substitution.original:provenance`);
        }
        if (!isText(value.substitution.selectedAt, { max: 100 })) issues.push(`${path}.substitution.selectedAt`);
        if (hasOwn(value.substitution, "originalPendingSets") && !isPlainObject(value.substitution.originalPendingSets)) {
          issues.push(`${path}.substitution.originalPendingSets:object`);
        }
      }
    }
    if (value.status !== "active" && value.status !== "skipped") issues.push(`${path}.status`);
    if (hasOwn(value, "skipReason") && (!SKIP_REASONS.includes(value.skipReason) || value.status !== "skipped")) issues.push(`${path}.skipReason`);
    if (hasOwn(value, "swapReason") && !SWAP_REASONS.includes(value.swapReason)) issues.push(`${path}.swapReason`);
    if (hasOwn(value,"discomfort") && (!Array.isArray(value.discomfort) || value.discomfort.length>2000 ||
      !value.discomfort.every(validObservation) ||
      value.discomfort.some(item=>item.swapped!==(!!item.replacementId && item.replacementId===value.substitution?.replacement.exerciseInstanceId)) ||
      new Set(value.discomfort.map(item=>item.exerciseId)).size!==value.discomfort.length)) {
      issues.push(`${path}.discomfort`);
    }
    if (!isText(value.setupNotes, { empty: true })) issues.push(`${path}.setupNotes`);
    if (!Array.isArray(value.setOrder)) issues.push(`${path}.setOrder`);
    if (!isPlainObject(value.sets)) issues.push(`${path}.sets`);
    if (!Array.isArray(value.setOrder) || !isPlainObject(value.sets)) return;
    const unique = new Set(value.setOrder);
    if (unique.size !== value.setOrder.length || value.setOrder.some((id) => !isText(id, { max: MAX_ID }))) issues.push(`${path}.setOrder:identity`);
    const keys = Object.keys(value.sets);
    if (keys.length !== value.setOrder.length || keys.some((id) => !unique.has(id))) issues.push(`${path}.sets:coverage`);
    value.setOrder.forEach((setId, index) => {
      const set = value.sets[setId];
      validateSet(set, setId, `${path}.sets.${setId}`, issues);
      if (set?.ordinal !== index + 1) issues.push(`${path}.sets.${setId}.ordinalOrder`);
      if (Array.isArray(set?.programmed?.metrics)) {
        const source = value.programmed || {};
        const sourceLibraryId = set.programmed.sourceLibraryId ?? source.sourceLibraryId ?? value.libraryId;
        const metricOrigin = set.programmed.metricOrigin ?? source.metricOrigin;
        const loadingModel = set.programmed.loadingModel ?? source.loadingModel;
        const loadingConvention = set.programmed.loadingConvention ?? source.loadingConvention;
        const loadingContext = set.programmed.loadingContext ?? source.loadingContext;
        metricProgramBinding({
          metricOrigin,
          metricIds: set.programmed.metricIds,
          metricDefinitions: set.programmed.metrics,
          sourceLibraryId,
          loadingModel,
          loadingConvention,
          loadingContext,
        }, `${path}.sets.${setId}.programmed`, issues);
      }
    });
    const originalPendingSets = value.substitution?.originalPendingSets;
    if (isPlainObject(originalPendingSets)) {
      if (Object.keys(originalPendingSets).some(setId => !unique.has(setId)) ||
        Object.values(originalPendingSets).some(set => !isPlainObject(set))) {
        issues.push(`${path}.substitution.originalPendingSets:coverage`);
      }
      for (const [setId, set] of Object.entries(originalPendingSets)) {
        validateSet(set, setId, `${path}.substitution.originalPendingSets.${setId}`, issues);
      }
    }
    if (value.setOrder.some(setId => Array.isArray(value.sets[setId]?.programmed?.metrics)) &&
      !["source_catalog", "user_defined"].includes(value.programmed?.metricOrigin)) {
      issues.push(`${path}.programmed.metricOrigin:required-for-metric-composition`);
    }
    const ramps = value.setOrder.filter(id => value.sets[id]?.origin === "ramp").length;
    if (ramps > 3) issues.push(`${path}.ramp-limit`);
    // Keep the authored count. Earlier readers require exact coverage and route
    // this expanded aggregate to their existing recovery surface, retaining it.
    if (value.programmed?.sets + ramps !== value.setOrder.length) issues.push(`${path}.programmed.sets:coverage`);
    if (hasOwn(value, "warmupPrelude")) validatePrelude(value.warmupPrelude, `${path}.warmupPrelude`, issues);
  }

  /* Plan 085 slice 3: Prelude. A versioned record on the exercise holds suggested warm-ups outside setOrder and sets,
     so they never take a working ordinal, count toward completion, or reach the progression inputs. Completed steps
     carry the movement and metric composition they were done under, so a swap cannot rewrite them. */
  const PRELUDE_VERSION = 1;
  const PRELUDE_MAX_STEPS = 6;
  const PRELUDE_REASONS = Object.freeze(["baseline", "baseline-fallback", "learned", "already-warm", "suppressed", "none-with-reason"]);
  const PRELUDE_EQUIPMENT = Object.freeze(["barbell", "machine", "dumbbell"]);
  const PRELUDE_KEYS = Object.freeze(["v", "plan", "composition", "skipped", "nextOrdinal", "steps"]);
  const PRELUDE_PLAN_KEYS = Object.freeze(["reason", "suggestions", "manualAllowed", "equipmentKind", "workLoadKg", "capturedAt", "evidence"]);
  const PRELUDE_EVIDENCE_KEYS = Object.freeze(["liftKey", "workLoadKg", "barKg", "resetGeneration", "earlierLift", "sessions", "skipStreak", "unavailableReason", "lowestLighterLoadKg"]);
  const PRELUDE_LIFT_KEYS = Object.freeze(["liftKey", "movementId", "primaryMuscle", "sessionId", "completedAt", "elapsedMs"]);
  const PRELUDE_COMPOSITION_KEYS = Object.freeze(["metricType", "metricIds", "metrics", "metricOrigin", "sourceLibraryId", "equipmentId", "loadingConvention", "loadingModel", "loadingContext", "restSeconds"]);
  const PRELUDE_OPTIONAL_COMPOSITION = new Set(["equipmentId", "restSeconds"]);
  const PRELUDE_MAX_PLAN_CHARS = 8000;

  const exactKeys = (value, keys) => isPlainObject(value) && Object.keys(value).every(key => keys.includes(key));
  const finiteNumber = value => typeof value === "number" && Number.isFinite(value);
  const positiveLoad = value => finiteNumber(value) && value > 0 && value <= 1000;

  function preludeMetrics(composition) {
    const metrics = Array.isArray(composition?.metrics) ? composition.metrics : [];
    const load = metrics.filter(metric => LOAD_SEMANTICS.has(metric?.semantic));
    const reps = metrics.filter(metric => metric?.semantic === "reps" || metric?.semantic === "repsPerSide");
    if (!metrics.length || metrics.length > 2 || load.length > 1 || reps.length !== 1 || load.length + reps.length !== metrics.length) return null;
    return { load: load[0] ?? null, reps: reps[0] };
  }

  /** The metric composition a warm-up is logged under: the exercise's first ordinary working set. */
  function preludeComposition(exercise) {
    const setId = exercise.setOrder.find(id => exercise.sets[id].role === "working" && !exercise.sets[id].origin);
    const set = setId ? exercise.sets[setId] : null;
    if (!set || !Array.isArray(set.programmed?.metrics)) return null;
    const programmed = { ...exercise.programmed, ...set.programmed };
    const composition = {
      metricType: programmed.metricType, metricIds: jsonClone(programmed.metricIds), metrics: jsonClone(programmed.metrics),
      metricOrigin: programmed.metricOrigin, sourceLibraryId: programmed.sourceLibraryId ?? exercise.libraryId ?? null,
      loadingConvention: programmed.loadingConvention, loadingModel: jsonClone(programmed.loadingModel ?? {}),
      loadingContext: jsonClone(programmed.loadingContext ?? {}),
    };
    if (programmed.equipmentId != null) composition.equipmentId = programmed.equipmentId;
    if (Number.isSafeInteger(programmed.restSeconds)) composition.restSeconds = programmed.restSeconds;
    return preludeMetrics(composition) ? composition : null;
  }

  function validatePreludeComposition(value, path, issues) {
    if (!exactKeys(value, PRELUDE_COMPOSITION_KEYS)) {
      issues.push(`${path}:object`);
      return;
    }
    for (const key of PRELUDE_COMPOSITION_KEYS) {
      if (!hasOwn(value, key) && !PRELUDE_OPTIONAL_COMPOSITION.has(key)) issues.push(`${path}.${key}`);
    }
    if (hasOwn(value, "equipmentId") && !isText(value.equipmentId, { max: MAX_ID })) issues.push(`${path}.equipmentId`);
    if (hasOwn(value, "restSeconds") && (!isSafeInteger(value.restSeconds) || value.restSeconds > 86400)) issues.push(`${path}.restSeconds`);
    if (value.metricType !== "source_metrics@1") issues.push(`${path}.metricType`);
    const ids = validateMetricRecords(value.metrics, `${path}.metrics`, issues, { allowEmpty: false });
    if (!Array.isArray(value.metricIds) || value.metricIds.length !== ids.length || value.metricIds.some((id, index) => id !== ids[index])) {
      issues.push(`${path}.metricIds`);
    }
    if (!preludeMetrics(value)) issues.push(`${path}.metrics:unsupported-warmup-shape`);
    metricProgramBinding({ metricOrigin: value.metricOrigin, metricIds: value.metricIds, metricDefinitions: value.metrics,
      sourceLibraryId: value.sourceLibraryId, loadingModel: value.loadingModel, loadingConvention: value.loadingConvention,
      loadingContext: value.loadingContext }, path, issues);
  }

  function validatePreludePlan(value, path, issues) {
    if (!exactKeys(value, PRELUDE_PLAN_KEYS) || PRELUDE_PLAN_KEYS.some(key => !hasOwn(value, key))) {
      issues.push(`${path}:object`);
      return;
    }
    if (!PRELUDE_REASONS.includes(value.reason)) issues.push(`${path}.reason`);
    if (typeof value.manualAllowed !== "boolean") issues.push(`${path}.manualAllowed`);
    if (value.equipmentKind !== null && !PRELUDE_EQUIPMENT.includes(value.equipmentKind)) issues.push(`${path}.equipmentKind`);
    if (value.workLoadKg !== null && !positiveLoad(value.workLoadKg)) issues.push(`${path}.workLoadKg`);
    if (!isText(value.capturedAt, { max: 100 })) issues.push(`${path}.capturedAt`);
    if (!Array.isArray(value.suggestions) || value.suggestions.length > PRELUDE_MAX_STEPS ||
      value.suggestions.some(step => !exactKeys(step, ["loadKg", "reps", "platesPerSideKg"]) || !positiveLoad(step.loadKg) ||
        !Number.isSafeInteger(step.reps) || step.reps < 1 || step.reps > 100 ||
        (step.platesPerSideKg !== null && step.platesPerSideKg !== undefined &&
          (!Array.isArray(step.platesPerSideKg) || step.platesPerSideKg.length > 24 || step.platesPerSideKg.some(plate => !positiveLoad(plate)))))) {
      issues.push(`${path}.suggestions`);
    }
    const evidence = value.evidence;
    if (!exactKeys(evidence, PRELUDE_EVIDENCE_KEYS) || PRELUDE_EVIDENCE_KEYS.some(key => !hasOwn(evidence, key))) {
      issues.push(`${path}.evidence`);
      return;
    }
    if (evidence.liftKey !== null && !isText(evidence.liftKey, { max: 1000 })) issues.push(`${path}.evidence.liftKey`);
    for (const key of ["workLoadKg", "barKg", "lowestLighterLoadKg"]) {
      if (evidence[key] !== null && !positiveLoad(evidence[key])) issues.push(`${path}.evidence.${key}`);
    }
    if (evidence.resetGeneration !== null && !isText(evidence.resetGeneration, { max: MAX_ID })) issues.push(`${path}.evidence.resetGeneration`);
    if (evidence.unavailableReason !== null && !isText(evidence.unavailableReason, { max: 80 })) issues.push(`${path}.evidence.unavailableReason`);
    if (!isSafeInteger(evidence.skipStreak) || evidence.skipStreak > 1000) issues.push(`${path}.evidence.skipStreak`);
    if (!Array.isArray(evidence.sessions) || evidence.sessions.length > PRELUDE_MAX_STEPS ||
      evidence.sessions.some(entry => !exactKeys(entry, ["sessionId", "savedAt"]) || !isText(entry.sessionId, { max: MAX_ID }) || !finiteNumber(entry.savedAt))) {
      issues.push(`${path}.evidence.sessions`);
    }
    const lift = evidence.earlierLift;
    if (lift !== null && (!exactKeys(lift, PRELUDE_LIFT_KEYS) || PRELUDE_LIFT_KEYS.some(key => !hasOwn(lift, key)) ||
      ["liftKey", "movementId", "primaryMuscle", "sessionId"].some(key => !isText(lift[key], { max: 1000 })) ||
      !finiteNumber(lift.completedAt) || !finiteNumber(lift.elapsedMs))) issues.push(`${path}.evidence.earlierLift`);
    if (JSON.stringify(value).length > PRELUDE_MAX_PLAN_CHARS) issues.push(`${path}:size`);
  }

  function preludeStepValues(step, composition) {
    const metrics = preludeMetrics(composition);
    if (!metrics || !isPlainObject(step.values)) return null;
    const load = metrics.load ? metricValue(step.values[metrics.load.id], metrics.load) : null;
    const reps = metricValue(step.values[metrics.reps.id], metrics.reps);
    return { load, reps, valid: (!metrics.load || load > 0) && reps > 0 };
  }

  function validatePreludeStep(step, record, path, issues) {
    if (!exactKeys(step, ["stepId", "source", "values", "touched", "completion"]) ||
      ["stepId", "source", "values", "touched", "completion"].some(key => !hasOwn(step, key))) {
      issues.push(`${path}:object`);
      return;
    }
    if (!isText(step.stepId, { max: MAX_ID })) issues.push(`${path}.stepId`);
    if (step.source !== "suggested" && step.source !== "manual") issues.push(`${path}.source`);
    if (typeof step.touched !== "boolean") issues.push(`${path}.touched`);
    const pending = step.completion === "pending";
    const composition = pending ? record.composition : step.completion?.composition;
    if (pending && composition === null) {
      issues.push(`${path}.completion:no-composition`);
      return;
    }
    if (!pending) {
      const completion = step.completion;
      if (!exactKeys(completion, ["completedAt", "ordinal", "performed", "composition"]) ||
        ["completedAt", "ordinal", "performed", "composition"].some(key => !hasOwn(completion, key)) ||
        !isText(completion.completedAt, { max: 100 }) || !Number.isSafeInteger(completion.ordinal) ||
        completion.ordinal < 1 || completion.ordinal > PRELUDE_MAX_STEPS) {
        issues.push(`${path}.completion`);
        return;
      }
      validateMovementSnapshot(completion.performed, `${path}.completion.performed`, issues);
      validatePreludeComposition(completion.composition, `${path}.completion.composition`, issues);
    }
    const metrics = preludeMetrics(composition);
    if (!metrics || !isPlainObject(step.values)) {
      issues.push(`${path}.values`);
      return;
    }
    const ids = composition.metrics.map(metric => metric.id);
    validateMetricMap(step.values, ids, `${path}.values`, issues);
    if (!pending && !preludeStepValues(step, composition)?.valid) issues.push(`${path}.values:not-loggable`);
  }

  function validatePrelude(value, path, issues) {
    if (!exactKeys(value, PRELUDE_KEYS) || PRELUDE_KEYS.some(key => !hasOwn(value, key))) {
      issues.push(`${path}:object`);
      return;
    }
    if (value.v !== PRELUDE_VERSION) issues.push(`${path}.v`);
    if (typeof value.skipped !== "boolean") issues.push(`${path}.skipped`);
    if (!isSafeInteger(value.nextOrdinal, 1) || value.nextOrdinal > PRELUDE_MAX_STEPS + 1) issues.push(`${path}.nextOrdinal`);
    if (value.plan !== null) validatePreludePlan(value.plan, `${path}.plan`, issues);
    if (value.composition !== null) validatePreludeComposition(value.composition, `${path}.composition`, issues);
    if ((value.plan === null) !== (value.composition === null)) issues.push(`${path}:plan-composition`);
    if (!Array.isArray(value.steps) || value.steps.length > PRELUDE_MAX_STEPS) {
      issues.push(`${path}.steps`);
      return;
    }
    value.steps.forEach((step, index) => validatePreludeStep(step, value, `${path}.steps.${index}`, issues));
    const ids = value.steps.map(step => step?.stepId);
    if (new Set(ids).size !== ids.length) issues.push(`${path}.steps:identity`);
    let seenPending = false, lastOrdinal = 0, pendingManual = 0;
    for (const step of value.steps) {
      if (step?.completion === "pending") {
        seenPending = true;
        if (step.source === "manual") pendingManual++;
      } else if (isPlainObject(step?.completion)) {
        if (seenPending) issues.push(`${path}.steps:order`);
        if (!(step.completion.ordinal > lastOrdinal)) issues.push(`${path}.steps:ordinal`);
        lastOrdinal = Math.max(lastOrdinal, step.completion.ordinal ?? 0);
      }
    }
    if (value.nextOrdinal <= lastOrdinal) issues.push(`${path}.nextOrdinal:stale`);
    if (pendingManual > 1) issues.push(`${path}.steps:manual-limit`);
    if (value.skipped && seenPending) issues.push(`${path}.skipped:pending-steps`);
    if (value.composition === null && (seenPending || value.skipped)) issues.push(`${path}:retired-with-pending-state`);
  }

  const preludeIsPristine = record => !record.skipped && record.nextOrdinal === 1 &&
    record.steps.every(step => step.source === "suggested" && step.completion === "pending" && !step.touched);

  function preludeText(value) {
    return typeof value === "number" && Number.isFinite(value) ? String(Math.round(value * 1000) / 1000) : editableText(value);
  }

  /** The working sets have started: the exercise's suggestions are history, not a plan. */
  const workHasStarted = exercise => exercise.setOrder.some(id => exercise.sets[id].role === "working" &&
    !exercise.sets[id].origin && (exercise.sets[id].completion !== "pending" || exercise.sets[id].performed));

  /** A swap changes the movement the pending steps were suggested for: drop them, keep what was logged. */
  function retirePrelude(exercise) {
    const record = exercise.warmupPrelude;
    if (!record) return;
    record.steps = record.steps.filter(step => step.completion !== "pending");
    if (!record.steps.length) {
      delete exercise.warmupPrelude;
      return;
    }
    record.plan = null;
    record.composition = null;
    record.skipped = false;
  }

  function structuralIssues(value) {
    const issues = [];
    if (!isPlainObject(value)) return ["draft:object"];
    if (value.schemaVersion !== SCHEMA_VERSION) issues.push("schemaVersion");
    if (!isText(value.draftId, { max: MAX_ID })) issues.push("draftId");
    if (!isSafeInteger(value.revision)) issues.push("revision");
    validateWriter(value.writer, "writer", issues);
    if (!isPlainObject(value.program)) issues.push("program:object");
    else {
      for (const field of ["programId", "programFingerprint", "dayId", "dayLabel", "scheduleDate"]) {
        if (!isText(value.program[field], {
          empty: field === "scheduleDate",
          max: field === "programFingerprint" ? 2000 : 500,
        })) issues.push(`program.${field}`);
      }
      if (hasOwn(value.program, "blockId") && !isBlockId(value.program.blockId, value.program.programId)) {
        issues.push("program.blockId");
      }
      if (!isSafeInteger(value.program.durableRevision)) issues.push("program.durableRevision");
      if (!UNITS.has(value.program.unit)) issues.push("program.unit");
      if (!RIR_MODES.has(value.program.rirMode)) issues.push("program.rirMode");
    }
    if (!isPlainObject(value.session)) issues.push("session:object");
    else {
      for (const field of ["startedAt", "updatedAt"]) {
        if (!isText(value.session[field], { max: 100 })) issues.push(`session.${field}`);
      }
      if (!isOptionalText(value.session.bodyweight, 64)) issues.push("session.bodyweight");
      if (!isText(value.session.notes, { empty: true })) issues.push("session.notes");
      if (!isOptionalText(value.session.selectedExerciseId, MAX_ID)) issues.push("session.selectedExerciseId");
      if (!STATUS.has(value.session.status)) issues.push("session.status");
      validateContextTouched(value.session.contextTouched, "session.contextTouched", issues);
    }
    if (!Array.isArray(value.exerciseOrder)) issues.push("exerciseOrder");
    if (!isPlainObject(value.exercises)) issues.push("exercises");
    if (!Array.isArray(value.exerciseOrder) || !isPlainObject(value.exercises)) return issues;
    const unique = new Set(value.exerciseOrder);
    if (unique.size !== value.exerciseOrder.length || value.exerciseOrder.some((id) => !isText(id, { max: MAX_ID }))) issues.push("exerciseOrder:identity");
    const keys = Object.keys(value.exercises);
    if (keys.length !== value.exerciseOrder.length || keys.some((id) => !unique.has(id))) issues.push("exercises:coverage");
    value.exerciseOrder.forEach((exerciseId) => {
      validateExercise(value.exercises[exerciseId], exerciseId, `exercises.${exerciseId}`, issues);
    });
    if (value.session?.selectedExerciseId != null && !unique.has(value.session.selectedExerciseId)) issues.push("session.selectedExerciseId:unknown");
    return issues;
  }

  function validate(value) {
    const issues = structuralIssues(value);
    return issues.length ? { ok: false, issues } : { ok: true };
  }

  function previousByExercise(previousSessionFacts) {
    if (Array.isArray(previousSessionFacts)) {
      return new Map(previousSessionFacts.map((item) => [item?.exerciseInstanceId, item]));
    }
    if (isPlainObject(previousSessionFacts)) return new Map(Object.entries(previousSessionFacts));
    return new Map();
  }

  function clampLegacyTargetRir(value) {
    if (typeof value !== "number" || !Number.isFinite(value) ||
      value <= MAX_TARGET_RIR || value > LEGACY_TARGET_RIR_CLAMP_CEILING) {
      return { value, clamped: false };
    }
    return { value: MAX_TARGET_RIR, clamped: true };
  }

  function create(programContext, sessionSelection, previousSessionFacts) {
    if (!isPlainObject(programContext) || !isPlainObject(sessionSelection) || !Array.isArray(programContext.exercises)) {
      return error("invalid-create-input");
    }
    const contextTouched = contextTouchedForCreate(sessionSelection.contextTouched);
    if (!contextTouched) return error("invalid-create-context-touched");
    const prior = previousByExercise(previousSessionFacts);
    const exerciseOrder = [];
    const exercises = Object.create(null);
    for (let index = 0; index < programContext.exercises.length; index++) {
      const source = programContext.exercises[index];
      if (!isPlainObject(source)) return error("invalid-create-exercise", { index });
      const exerciseInstanceId = source.exerciseInstanceId;
      const sourceExerciseId = source.sourceExerciseId;
      const setCount = Number(source.sets);
      if (!isText(exerciseInstanceId, { max: MAX_ID }) || !isText(sourceExerciseId, { max: MAX_ID }) ||
        !isSafeInteger(setCount, 1) || !Array.isArray(source.setIds) || source.setIds.length !== setCount) {
        return error("invalid-create-exercise", { index });
      }
      if (hasOwn(exercises, exerciseInstanceId)) return error("duplicate-exercise-id", { exerciseInstanceId });
      const previous = prior.get(exerciseInstanceId);
      const previousSets = Array.isArray(previous?.sets) ? previous.sets : [];
      const specifications = Array.isArray(source.programmedSets) ? source.programmedSets : [];
      const hasMetricDefinitions = Array.isArray(source.metricDefinitions) ||
        specifications.some(spec => Array.isArray(spec?.metricDefinitions));
      if (source.metricOrigin != null && !["source_catalog", "user_defined"].includes(source.metricOrigin)) {
        return error("invalid-create-metric-origin", { exerciseInstanceId });
      }
      if (hasMetricDefinitions && !["source_catalog", "user_defined"].includes(source.metricOrigin)) {
        return error("missing-create-metric-origin", { exerciseInstanceId });
      }
      const setOrder = [];
      const sets = Object.create(null);
      for (let ordinal = 1; ordinal <= setCount; ordinal++) {
        const setId = source.setIds[ordinal - 1];
        if (!isText(setId, { max: MAX_ID }) || hasOwn(sets, setId)) return error("invalid-create-set-id", { exerciseInstanceId, ordinal });
        const spec = specifications[ordinal - 1] || {};
        const old = previousSets.find((item) => item?.ordinal === ordinal || item?.set === ordinal) || previousSets[ordinal - 1] || {};
        const suggestedLoad = spec.suggestedLoad ?? source.suggestedLoad ?? old.load ?? null;
        const suggestedReps = spec.suggestedReps ?? source.suggestedReps ?? old.reps ?? source.minReps;
        // `old.rir` is the lifter's own previously logged RIR for this set,
        // which has never had an upper bound (see setSaveIssues/validateSet);
        // falling back to it when the program specifies no target can still
        // produce a value above the engine's 0-4 ceiling, so clamp it the
        // same way a pre-Plan-067 stored draft is clamped on parse.
        const targetRir = hasOwn(spec, "targetRir") ? spec.targetRir : source.targetRir ?? old.rir ?? null;
        const targetRirNumber = targetRir == null ? null : Number(targetRir);
        const targetRirClamp = clampLegacyTargetRir(targetRirNumber);
        const effort = spec.suggestedEffort ?? source.suggestedEffort ?? null;
        const metricDefinitions = Array.isArray(spec.metricDefinitions)
          ? spec.metricDefinitions
          : Array.isArray(source.metricDefinitions) ? source.metricDefinitions : null;
        const targets = isPlainObject(spec.targets) ? spec.targets : isPlainObject(source.targets) ? source.targets : {};
        const metricIds = metricDefinitions ? metricDefinitions.map(metric => metric?.id) : null;
        if (metricDefinitions) {
          const checkedDefinitions = MetricDomain.validateDefinitions(metricIds, metricDefinitions, { allowEmpty: true });
          if (!checkedDefinitions.ok) return error("invalid-create-metric", { exerciseInstanceId, ordinal, issues: checkedDefinitions.issues });
          const checkedTargets = MetricDomain.validateTargets(metricIds, targets);
          if (!checkedTargets.ok) return error("invalid-create-metric-targets", { exerciseInstanceId, ordinal, issues: checkedTargets.issues });
        }
        const editedMetrics = Object.create(null);
        const programmedMetrics = [];
        for (const metric of metricDefinitions || []) {
          const checkedMetric = MetricDomain.validateMetricDefinition(metric);
          if (!checkedMetric.ok) return error("invalid-create-metric", { exerciseInstanceId, ordinal, issues: checkedMetric.issues });
          programmedMetrics.push(checkedMetric.value);
          const oldMetric = (old.metricValues || []).find(item => item?.metricId === metric.id) ||
            (old.metrics || []).find(item => item?.id === metric.id);
          editedMetrics[metric.id] = editableText(oldMetric?.value) ?? null;
        }
        const programmedSet = {
          suggestedLoad: suggestedLoad == null ? null : Number(suggestedLoad),
          minReps: spec.minReps ?? source.minReps,
          maxReps: spec.maxReps ?? source.maxReps,
          targetRir: targetRirClamp.value,
          ...(targetRirClamp.clamped ? { targetRirClamped: true } : {}),
          ...(metricDefinitions ? { metricType: "source_metrics@1", metricIds: [...metricIds], metrics: programmedMetrics,
            targets: jsonClone(targets) } : {}),
          restSeconds: spec.restSeconds ?? source.restSeconds ?? null,
        };
        if (metricDefinitions) {
          const metricOrigin = spec.metricOrigin ?? source.metricOrigin;
          const sourceLibraryId = spec.sourceLibraryId ?? source.sourceLibraryId ?? source.libraryId;
          const loadingModel = spec.loadingModel ?? source.loadingModel;
          const loadingConvention = spec.loadingConvention ?? source.loadingConvention ?? expectedLoadingConvention(programmedMetrics);
          const loadingContext = loadingContextForProgram(source, spec, loadingConvention, loadingModel);
          if (metricOrigin != null) programmedSet.metricOrigin = metricOrigin;
          if (sourceLibraryId != null) programmedSet.sourceLibraryId = sourceLibraryId;
          if (loadingModel != null) programmedSet.loadingModel = jsonClone(loadingModel);
          if (loadingConvention != null) programmedSet.loadingConvention = loadingConvention;
          if (loadingContext != null) programmedSet.loadingContext = loadingContext;
          const equipmentId = spec.equipmentId ?? source.equipmentId;
          if (equipmentId != null) programmedSet.equipmentId = equipmentId;
        }
        sets[setId] = {
          setId,
          ordinal,
          role: spec.role === "warmup" ? "warmup" : "working",
          programmed: programmedSet,
          edited: {
            load: editableText(suggestedLoad),
            reps: editableText(suggestedReps),
            rir: metricDefinitions ? null : editableText(targetRirClamp.clamped ? targetRirClamp.value : targetRir),
            effort: metricDefinitions ? null : editableText(effort),
            ...(metricDefinitions ? { metrics: editedMetrics } : {}),
          },
          touched: { load: false, reps: false, effort: false,
            ...(metricDefinitions ? { metrics: Object.fromEntries(programmedMetrics.map(metric => [metric.id, false])) } : {}) },
          completion: "pending",
        };
        setOrder.push(setId);
      }
      const exerciseTargetRirClamp = clampLegacyTargetRir(source.targetRir ?? null);
      const programmed = {
        order: index,
        sets: setCount,
        minReps: source.minReps,
        maxReps: source.maxReps,
        targetRir: exerciseTargetRirClamp.value,
        ...(exerciseTargetRirClamp.clamped ? { targetRirClamped: true } : {}),
        notes: source.notes || "",
        progressionStrategy: source.progressionStrategy ?? null,
        movementPattern: source.movementPattern ?? null,
        sourceFingerprint: source.sourceFingerprint,
        primary: source.primary || "",
        secondary: source.secondary || "",
      };
      if (source.loadingModel != null) programmed.loadingModel = jsonClone(source.loadingModel);
      if (source.metricOrigin != null) programmed.metricOrigin = source.metricOrigin;
      if (source.equipmentId != null) programmed.equipmentId = source.equipmentId;
      if (source.loadingConvention != null) programmed.loadingConvention = source.loadingConvention;
      if (isPlainObject(source.loadingContext)) programmed.loadingContext = jsonClone(source.loadingContext);
      if (source.libraryId) programmed.libraryId = source.libraryId;
      if (source.movementId) programmed.movementId = source.movementId;
      const exercise = {
        exerciseInstanceId,
        sourceExerciseId,
        libraryId: source.libraryId ?? null,
        displayName: source.displayName,
        programmed,
        substitution: null,
        status: "active",
        setupNotes: source.setupNotes ?? previous?.setupNotes ?? "",
        setOrder,
        sets,
      };
      exerciseOrder.push(exerciseInstanceId);
      exercises[exerciseInstanceId] = exercise;
    }
    const writer = sessionSelection.writer;
    const draft = {
      schemaVersion: SCHEMA_VERSION,
      draftId: sessionSelection.draftId,
      revision: 0,
      writer: writer && {
        installationId: writer.installationId,
        tabId: writer.tabId,
        operationId: writer.operationId,
      },
      program: {
        programId: programContext.programId,
        programFingerprint: programContext.programFingerprint,
        durableRevision: programContext.durableRevision,
        dayId: programContext.dayId,
        dayLabel: programContext.dayLabel,
        scheduleDate: sessionSelection.scheduleDate ?? programContext.scheduleDate,
        unit: programContext.unit,
        rirMode: programContext.rirMode,
      },
      session: {
        startedAt: sessionSelection.startedAt,
        updatedAt: sessionSelection.updatedAt ?? sessionSelection.startedAt,
        bodyweight: editableText(sessionSelection.bodyweight) ?? null,
        notes: sessionSelection.notes ?? "",
        selectedExerciseId: sessionSelection.selectedExerciseId ?? exerciseOrder[0] ?? null,
        status: "active",
        contextTouched,
      },
      exerciseOrder,
      exercises,
    };
    if (hasOwn(programContext, "blockId")) draft.program.blockId = programContext.blockId;
    const checked = validate(draft);
    return checked.ok ? deepFreeze(draft) : error("invalid-created-draft", { issues: checked.issues });
  }

  function looksLegacy(value) {
    if (!isPlainObject(value) || hasOwn(value, "schemaVersion")) return false;
    const keys = Object.keys(value);
    return keys.some((key) => key.startsWith("__") || /_(?:load|reps|rir|effort)$/.test(key));
  }

  function contextMismatch(draft, context) {
    if (!isPlainObject(context)) return null;
    const fields = ["programId", "programFingerprint", "durableRevision", "dayId", "blockId"];
    for (const field of fields) {
      if (hasOwn(context, field) && context[field] !== draft.program[field]) return field;
    }
    if (Array.isArray(context.dayIds) && !context.dayIds.includes(draft.program.dayId)) return "dayId";
    return null;
  }

  // A stored V2 draft written before Plan 067 can carry a programmed target
  // RIR above the current 0-6 ceiling (see clampLegacyTargetRir). Clamp it
  // on read so the draft resumes instead of failing validation into
  // recovery; this only ever touches `programmed.targetRir`, never the
  // lifter's own edited/logged value for the set, which has no upper bound
  // today and had none before Plan 067 either.
  function normalizeLegacyTargetRir(value) {
    if (!isPlainObject(value?.exercises)) return value;
    let changed = false;
    const exercises = {};
    for (const [exerciseInstanceId, exercise] of Object.entries(value.exercises)) {
      let nextExercise = exercise;
      if (isPlainObject(exercise) && isPlainObject(exercise.programmed)) {
        const clamp = clampLegacyTargetRir(exercise.programmed.targetRir);
        if (clamp.clamped) {
          nextExercise = { ...exercise, programmed: { ...exercise.programmed, targetRir: clamp.value, targetRirClamped: true } };
          changed = true;
        }
      }
      if (isPlainObject(nextExercise?.sets)) {
        let setsChanged = false;
        const sets = {};
        for (const [setId, set] of Object.entries(nextExercise.sets)) {
          let nextSet = set;
          if (isPlainObject(set) && isPlainObject(set.programmed)) {
            const clamp = clampLegacyTargetRir(set.programmed.targetRir);
            if (clamp.clamped) {
              nextSet = { ...set, programmed: { ...set.programmed, targetRir: clamp.value, targetRirClamped: true } };
              setsChanged = true;
            }
          }
          sets[setId] = nextSet;
        }
        if (setsChanged) {
          nextExercise = { ...nextExercise, sets };
          changed = true;
        }
      }
      exercises[exerciseInstanceId] = nextExercise;
    }
    return changed ? { ...value, exercises } : value;
  }

  function parse(raw, currentProgramContext) {
    if (raw == null || raw === "") return deepFreeze({ kind: "absent" });
    let value = raw;
    if (typeof raw === "string") {
      try {
        value = JSON.parse(raw);
      } catch {
        return deepFreeze({ kind: "invalid", code: "invalid-json" });
      }
    }
    if (looksLegacy(value)) return deepFreeze({ kind: "legacy", raw: jsonClone(value) });
    // DraftV2 documents written before context intent was durable have no
    // session.contextTouched. They remain readable with an explicit all-false
    // compatibility default; newly created and reduced documents always carry
    // the complete validated shape.
    if (value?.schemaVersion === SCHEMA_VERSION && isPlainObject(value.session) &&
      !hasOwn(value.session, "contextTouched")) {
      value = jsonClone(value);
      value.session.contextTouched = emptyContextTouched();
    }
    value = normalizeLegacyTargetRir(value);
    const checked = validate(value);
    if (!checked.ok) return deepFreeze({ kind: "invalid", code: "invalid-schema", issues: checked.issues });
    const draft = deepFreeze(serialize(value));
    const mismatch = contextMismatch(draft, currentProgramContext);
    return mismatch
      ? deepFreeze({ kind: "stale", reason: mismatch, draft })
      : deepFreeze({ kind: "valid", draft });
  }

  function serialize(draft) {
    const checked = validate(draft);
    if (!checked.ok) return error("invalid-draft", { issues: checked.issues });
    const copy = jsonClone(draft);
    for (const exercise of Object.values(copy.exercises)) {
      for (const set of [...Object.values(exercise.sets), ...Object.values(exercise.substitution?.originalPendingSets || {})]) {
        if (set.partialReps === 0) delete set.partialReps;
        if (set.correction?.partialReps === 0) delete set.correction.partialReps;
      }
    }
    return copy;
  }

  function logicalCloneSection(draft) {
    const section = serialize(draft);
    if (isDomainError(section)) return section;
    delete section.writer;
    delete section.revision;
    delete section.program.durableRevision;
    return section;
  }

  function targetExercise(draft, command) {
    const exercise = hasOwn(draft.exercises, command.exerciseInstanceId)
      ? draft.exercises[command.exerciseInstanceId]
      : null;
    if (!exercise) return error("unknown-exercise", { exerciseInstanceId: command.exerciseInstanceId });
    return { exercise };
  }

  function targetSet(draft, command) {
    const found = targetExercise(draft, command);
    if (isDomainError(found)) return found;
    const exercise = found.exercise;
    const set = hasOwn(exercise.sets, command.setId) ? exercise.sets[command.setId] : null;
    if (!set) return error("unknown-set", { exerciseInstanceId: command.exerciseInstanceId, setId: command.setId });
    return { exercise, set };
  }

  function writerFromCommand(command) {
    const writer = command.writer;
    if (!isPlainObject(writer) || !isText(writer.installationId, { max: MAX_ID }) || !isText(writer.tabId, { max: MAX_ID })) return null;
    return { installationId: writer.installationId, tabId: writer.tabId, operationId: command.operationId };
  }

  /** Which field holds a set's effort: the one the lifter last edited (an edit clears the other), else the
   *  workout's mode. A set keeps its own vocabulary when the mode changes mid-workout (OD-5). */
  function effortFieldOf(draft, set) {
    if (set.touched.effort) {
      if (set.edited.effort != null) return "effort";
      if (set.edited.rir != null) return "rir";
    }
    return draft.program.rirMode === "effort" ? "effort" : "rir";
  }

  /** A set's RIR from its own field: an effort token maps (null for "Not sure"), a number parses. */
  function effortRir(draft, set) {
    return effortFieldOf(draft, set) === "effort"
      ? hasOwn(EFFORT_RIR, effectiveText(set, "effort")) ? EFFORT_RIR[effectiveText(set, "effort")] : undefined
      : validDecimal(effectiveText(set, "rir"));
  }

  function effectiveText(set, field) {
    const edited = set.edited[field];
    if (edited != null) return edited;
    if (field === "load") return editableText(set.programmed.suggestedLoad);
    if (field === "reps") return editableText(set.programmed.minReps);
    if (field === "rir") return editableText(set.programmed.targetRir);
    return null;
  }

  function validDecimal(raw, { positive = false, max = Infinity } = {}) {
    if (typeof raw !== "string" || !DECIMAL.test(raw)) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || (positive ? value <= 0 : value < 0) || value > max) return null;
    return value;
  }

  function validInteger(raw, { positive = false } = {}) {
    if (typeof raw !== "string" || !INTEGER.test(raw)) return null;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || (positive ? value <= 0 : value < 0)) return null;
    return value;
  }

  function metricValue(raw, definition) {
    const parsed = MetricDomain.parseMetricValue(definition, raw);
    return parsed.ok ? parsed.value : null;
  }

  function validDate(raw) {
    if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(5, 7));
    const day = Number(raw.slice(8, 10));
    const value = new Date(Date.UTC(year, month - 1, day));
    return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day;
  }

  function setSaveIssues(draft, exercise, set) {
    const issues = [];
    if (Array.isArray(set.programmed.metrics)) {
      if (!set.programmed.metrics.length) {
        issues.push({ code: "exercise-metrics-required", exerciseInstanceId: exercise.exerciseInstanceId, setId: set.setId });
        return issues;
      }
      for (const metric of set.programmed.metrics) {
        if (metricValue(set.edited.metrics?.[metric.id], metric) == null) {
          issues.push({ code: "invalid-metric", exerciseInstanceId: exercise.exerciseInstanceId, setId: set.setId,
            field: metric.id, metric: metric.semantic });
        }
      }
      if (set.edited.rir != null || set.edited.effort != null) {
        if (effortFieldOf(draft, set) === "effort") {
          if (set.edited.effort != null && !hasOwn(EFFORT_RIR, set.edited.effort)) issues.push({ code: "invalid-effort", exerciseInstanceId: exercise.exerciseInstanceId, setId: set.setId, field: "effort" });
        } else if (set.edited.rir != null && validDecimal(set.edited.rir) == null) {
          issues.push({ code: "invalid-rir", exerciseInstanceId: exercise.exerciseInstanceId, setId: set.setId, field: "rir" });
        }
      }
      return issues;
    }
    const load = validDecimal(effectiveText(set, "load"), { positive: true, max: 1000 });
    const reps = validInteger(effectiveText(set, "reps"), { positive: true });
    if (load == null) issues.push({ code: "invalid-load", exerciseInstanceId: exercise.exerciseInstanceId, setId: set.setId, field: "load" });
    if (reps == null) issues.push({ code: "invalid-reps", exerciseInstanceId: exercise.exerciseInstanceId, setId: set.setId, field: "reps" });
    if (effortFieldOf(draft, set) === "effort") {
      const effort = effectiveText(set, "effort");
      if (!hasOwn(EFFORT_RIR, effort)) issues.push({ code: "invalid-effort", exerciseInstanceId: exercise.exerciseInstanceId, setId: set.setId, field: "effort" });
    } else if (validDecimal(effectiveText(set, "rir")) == null) {
      issues.push({ code: "invalid-rir", exerciseInstanceId: exercise.exerciseInstanceId, setId: set.setId, field: "rir" });
    }
    return issues;
  }

  function sessionSaveIssues(draft) {
    const issues = [];
    if (!validDate(draft.program.scheduleDate)) issues.push({ code: "invalid-date", field: "scheduleDate" });
    const bodyweight = draft.session.bodyweight;
    if (bodyweight != null && bodyweight !== "" && validDecimal(bodyweight, { positive: true }) == null) {
      issues.push({ code: "invalid-bodyweight", field: "bodyweight" });
    }
    return issues;
  }

  function isCandidate(set) {
    const touched = Object.values(set.touched || {}).some(value =>
      isPlainObject(value) ? Object.values(value).some(Boolean) : value === true);
    return set.completion !== "pending" || set.role === "warmup" || touched;
  }
  function hasTouchedValue(touched) {
    return Object.values(touched || {}).some(value =>
      isPlainObject(value) ? Object.values(value).some(Boolean) : value === true);
  }

  // A pristine draft holds no lifter input: untouched suggestions, navigation
  // state, and derived values recompute, so replacing it loses nothing.
  // Programmed warmup structure alone is not input; completing or editing any
  // set, skipping, substituting, annotating, or starting the finish flow is.
  // History-derived exercise notes and the schedule date need caller seeds to
  // judge, so the adapter refines this predicate before disposing a draft.
  function isPristine(draft) {
    if (!isPlainObject(draft) || !isPlainObject(draft.session)) return false;
    if (draft.session.status !== "active") return false;
    if (Object.values(draft.session.contextTouched || {}).some(Boolean)) return false;
    if (draft.session.bodyweight != null && draft.session.bodyweight !== "") return false;
    if (typeof draft.session.notes === "string" && draft.session.notes.trim() !== "") return false;
    if (!Array.isArray(draft.exerciseOrder) || !isPlainObject(draft.exercises)) return false;
    for (const exerciseId of draft.exerciseOrder) {
      const exercise = draft.exercises[exerciseId];
      if (!isPlainObject(exercise)) return false;
      if (exercise.status === "skipped" || exercise.substitution != null) return false;
      if (!Array.isArray(exercise.setOrder) || !isPlainObject(exercise.sets)) return false;
      for (const setId of exercise.setOrder) {
        const set = exercise.sets[setId];
        if (!isPlainObject(set)) return false;
        if (set.startingLoad || set.origin === "ramp" || set.completion !== "pending" || hasTouchedValue(set.touched)) return false;
      }
      if (hasOwn(exercise, "warmupPrelude") && !preludeIsPristine(exercise.warmupPrelude)) return false;
    }
    return true;
  }

  function validateForSave(draft) {
    const checked = validate(draft);
    if (!checked.ok) return [{ code: "invalid-draft", issues: checked.issues }];
    const issues = sessionSaveIssues(draft);
    if (draft.session.status !== "finishing") issues.push({ code: "finish-required" });
    let candidates = 0;
    for (const exerciseId of draft.exerciseOrder) {
      const exercise = draft.exercises[exerciseId];
      if (exercise.status === "skipped") continue;
      for (const setId of exercise.setOrder) {
        const stored = exercise.sets[setId];
        const set = stored.correction || stored;
        if (!isCandidate(set)) continue;
        candidates++;
        issues.push(...setSaveIssues(draft, exercise, set));
      }
    }
    if (!candidates) issues.push({ code: "no-work" });
    return issues;
  }

  function validateReplacementProgram(value, replacement, setCount) {
    const issues = [];
    if (!isPlainObject(value)) return { ok: false, issues: ["replacementProgram:object"] };
    const allowed = new Set([
      "sourceLibraryId", "metricOrigin", "metricIds", "metricDefinitions", "loadingModel",
      "loadingConvention", "loadingContext", "equipmentId", "programmedSets",
    ]);
    if (Object.keys(value).some(key => !allowed.has(key))) issues.push("replacementProgram:unknown-field");
    if (!isText(value.sourceLibraryId, { max: MAX_ID }) ||
      (replacement.libraryId != null && value.sourceLibraryId !== replacement.libraryId)) {
      issues.push("replacementProgram.sourceLibraryId");
    }
    if (!Array.isArray(value.metricIds) || !Array.isArray(value.metricDefinitions)) {
      issues.push("replacementProgram.metricDefinitions");
    } else {
      const definitions = MetricDomain.validateDefinitions(value.metricIds, value.metricDefinitions, { allowEmpty: true });
      issues.push(...definitions.issues.map(issue => `replacementProgram.${issue}`));
    }
    if (!isPlainObject(value.loadingModel) || Object.keys(value.loadingModel).some(key =>
      !["bodyweightCoefficient", "assistanceDirection"].includes(key)) ||
      (hasOwn(value.loadingModel || {}, "bodyweightCoefficient") && value.loadingModel.bodyweightCoefficient !== null &&
        (typeof value.loadingModel.bodyweightCoefficient !== "number" || !Number.isFinite(value.loadingModel.bodyweightCoefficient) ||
          value.loadingModel.bodyweightCoefficient < 0 || value.loadingModel.bodyweightCoefficient > 1)) ||
      (hasOwn(value.loadingModel || {}, "assistanceDirection") && !["subtract", null].includes(value.loadingModel.assistanceDirection))) {
      issues.push("replacementProgram.loadingModel");
    }
    if (value.equipmentId !== null && !isText(value.equipmentId, { max: MAX_ID })) {
      issues.push("replacementProgram.equipmentId");
    }
    const bindingIssues = [];
    metricProgramBinding({
      metricOrigin: value.metricOrigin,
      metricIds: value.metricIds,
      metricDefinitions: value.metricDefinitions,
      sourceLibraryId: value.sourceLibraryId,
      loadingModel: value.loadingModel,
      loadingConvention: value.loadingConvention,
      loadingContext: value.loadingContext,
    }, "replacementProgram", bindingIssues);
    issues.push(...bindingIssues);
    if (!Array.isArray(value.programmedSets) || value.programmedSets.length !== setCount) {
      issues.push("replacementProgram.programmedSets:coverage");
      return { ok: false, issues };
    }
    const programmedSets = [];
    for (let index = 0; index < value.programmedSets.length; index += 1) {
      const spec = value.programmedSets[index];
      const path = `replacementProgram.programmedSets[${index}]`;
      if (!isPlainObject(spec)) {
        issues.push(`${path}:object`);
        continue;
      }
      const specAllowed = new Set([
        "metricDefinitions", "targets", "restSeconds", "minReps", "maxReps", "suggestedLoad",
        "suggestedReps", "targetRir", "suggestedEffort", "previousMetrics",
      ]);
      if (Object.keys(spec).some(key => !specAllowed.has(key))) issues.push(`${path}:unknown-field`);
      const definitions = spec.metricDefinitions ?? value.metricDefinitions;
      if (!Array.isArray(definitions) || !Array.isArray(value.metricIds)) {
        issues.push(`${path}.metricDefinitions`);
      } else {
        const checked = MetricDomain.validateDefinitions(value.metricIds, definitions, { allowEmpty: true });
        issues.push(...checked.issues.map(issue => `${path}.${issue}`));
      }
      const targets = spec.targets ?? {};
      const checkedTargets = MetricDomain.validateTargets(value.metricIds || [], targets);
      issues.push(...checkedTargets.issues.map(issue => `${path}.targets:${issue}`));
      for (const field of ["minReps", "maxReps"]) {
        if (hasOwn(spec, field) && !isSafeInteger(spec[field], 1)) issues.push(`${path}.${field}`);
      }
      if (isSafeInteger(spec.minReps, 1) && isSafeInteger(spec.maxReps, 1) && spec.minReps > spec.maxReps) {
        issues.push(`${path}.repRange`);
      }
      for (const field of ["suggestedLoad", "suggestedReps", "targetRir"]) {
        if (hasOwn(spec, field) && spec[field] != null &&
          (typeof spec[field] !== "number" || !Number.isFinite(spec[field]) || spec[field] < 0 ||
            (field === "suggestedReps" && !Number.isSafeInteger(spec[field])) ||
            (field === "targetRir" && spec[field] > 4))) issues.push(`${path}.${field}`);
      }
      if (hasOwn(spec, "restSeconds") && spec.restSeconds != null &&
        (!isSafeInteger(spec.restSeconds) || spec.restSeconds > 86400)) issues.push(`${path}.restSeconds`);
      const previousMetrics = spec.previousMetrics ?? [];
      if (!Array.isArray(previousMetrics)) issues.push(`${path}.previousMetrics`);
      else if (previousMetrics.length) {
        const checked = MetricDomain.validateMetricValues(value.metricIds || [], previousMetrics);
        issues.push(...checked.issues.map(issue => `${path}.previousMetrics:${issue}`));
      }
      programmedSets.push({
        suggestedLoad: spec.suggestedLoad ?? null,
        suggestedReps: spec.suggestedReps ?? null,
        targetRir: spec.targetRir ?? null,
        minReps: spec.minReps ?? null,
        maxReps: spec.maxReps ?? null,
        restSeconds: spec.restSeconds ?? null,
        metricDefinitions: jsonClone(definitions || []),
        targets: jsonClone(targets),
        previousMetrics: jsonClone(previousMetrics),
      });
    }
    return issues.length ? { ok: false, issues } : {
      ok: true,
      value: {
        sourceLibraryId: value.sourceLibraryId,
        metricOrigin: value.metricOrigin,
        metricIds: [...value.metricIds],
        metricDefinitions: jsonClone(value.metricDefinitions),
        loadingModel: jsonClone(value.loadingModel),
        loadingConvention: value.loadingConvention,
        loadingContext: jsonClone(value.loadingContext),
        equipmentId: value.equipmentId,
        programmedSets,
      },
    };
  }

  function programmedSetFromReplacement(program, spec) {
    return {
      suggestedLoad: spec.suggestedLoad,
      minReps: spec.minReps,
      maxReps: spec.maxReps,
      targetRir: spec.targetRir,
      metricType: "source_metrics@1",
      metricIds: [...program.metricIds],
      metrics: jsonClone(spec.metricDefinitions),
      targets: jsonClone(spec.targets),
      restSeconds: spec.restSeconds,
      sourceLibraryId: program.sourceLibraryId,
      metricOrigin: program.metricOrigin,
      loadingModel: jsonClone(program.loadingModel),
      loadingConvention: program.loadingConvention,
      loadingContext: jsonClone(program.loadingContext),
      equipmentId: program.equipmentId,
    };
  }

  function editedMetricsFromPrevious(program, spec) {
    const previous = new Map(spec.previousMetrics.map(item => [item.metricId, item.value]));
    return Object.fromEntries(spec.metricDefinitions.map(metric => {
      const value = editableText(previous.get(metric.id));
      return [metric.id, value !== undefined && metricValue(value, metric) != null ? value : null];
    }));
  }

  function clearOpening(set) {
    if (!set.startingLoad) return;
    delete set.startingLoad;
    set.edited.load = null;
    set.touched.load = false;
    for (const metric of set.programmed.metrics || []) if (LOAD_SEMANTICS.has(metric.semantic)) {
      set.edited.metrics[metric.id] = null;
      set.touched.metrics[metric.id] = false;
    }
  }

  function reduce(draft, command) {
    const checked = validate(draft);
    if (!checked.ok) return error("invalid-draft", { issues: checked.issues });
    if (!isPlainObject(command) || !isText(command.type, { max: 80 }) ||
      !isText(command.operationId, { max: MAX_ID }) || !isSafeInteger(command.expectedRevision) ||
      !isText(command.updatedAt, { max: 100 })) return error("invalid-command");
    if (draft.writer.operationId === command.operationId) return draft;
    if (command.expectedRevision !== draft.revision) return error("stale-revision", { expected: command.expectedRevision, actual: draft.revision });
    const nextWriter = writerFromCommand(command);
    if (!nextWriter) return error("invalid-command-writer");
    if (draft.session.status === "finishing" && command.type !== "cancelFinish") return error("finish-in-progress");
    const next = jsonClone(draft);
    let item;
    switch (command.type) {
      case "insertSet": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        const exercise = item.exercise;
        if (exercise.setOrder.some(id => exercise.sets[id].role === "working" && (exercise.sets[id].completion !== "pending" || exercise.sets[id].performed))) return error("ramp-after-working-set");
        if (exercise.setOrder.filter(id => exercise.sets[id].origin === "ramp").length >= 3) return error("ramp-limit");
        const before = exercise.setOrder.indexOf(command.beforeSetId);
        if (before < 0 || !isText(command.setId, { max: MAX_ID }) || hasOwn(exercise.sets, command.setId) ||
          command.role !== "warmup" || command.origin !== "ramp") return error("invalid-insert-set");
        const set = { setId: command.setId, ordinal: before + 1, role: "warmup", origin: "ramp",
          programmed: jsonClone(command.programmed ?? {}), edited: jsonClone(command.edited ?? {}),
          touched: { load: true, reps: true, effort: true,
            ...(command.programmed?.metrics ? { metrics: Object.fromEntries(command.programmed.metrics.map(metric => [metric.id, true])) } : {}) },
          completion: "pending" };
        const issues = [];
        validateSet(set, command.setId, "insertSet", issues);
        if (issues.length) return error("invalid-insert-set", { issues });
        if (hasOwn(command, "startingLoad")) {
          if (!validStartingLoad(command.startingLoad) || command.startingLoad.ramps !==
            exercise.setOrder.filter(id => exercise.sets[id].origin === "ramp" &&
              (exercise.sets[id].programmed.sourceLibraryId ?? exercise.libraryId) ===
              (set.programmed.sourceLibraryId ?? exercise.libraryId)).length + 1) return error("invalid-starting-load");
          exercise.sets[command.beforeSetId].startingLoad = jsonClone(command.startingLoad);
        }
        if (hasOwn(command, "nextLoadKg")) {
          if (typeof command.nextLoadKg !== "number" || !Number.isFinite(command.nextLoadKg) || command.nextLoadKg <= 0 || command.nextLoadKg > 1000) return error("invalid-ramp-load");
          const pending = exercise.sets[command.beforeSetId];
          if (pending.role !== "working" || pending.completion !== "pending") return error("invalid-ramp-target");
          pending.edited.load = String(command.nextLoadKg);
          pending.edited.reps = editableText(pending.programmed.minReps);
          pending.edited.rir = null;
          pending.edited.effort = null;
          delete pending.partialReps;
          pending.touched = { load: false, reps: false, effort: false };
          if (pending.programmed.metrics) {
            pending.edited.metrics = Object.fromEntries(pending.programmed.metrics.map(metric => [metric.id,
              LOAD_SEMANTICS.has(metric.semantic) ? String(command.nextLoadKg)
                : ["reps", "repsPerSide"].includes(metric.semantic) ? editableText(pending.programmed.minReps) : null]));
            pending.touched.metrics = Object.fromEntries(pending.programmed.metrics.map(metric => [metric.id, false]));
          }
        }
        exercise.sets[command.setId] = set;
        exercise.setOrder.splice(before, 0, command.setId);
        exercise.setOrder.forEach((id, index) => {
          const set = exercise.sets[id];
          set.ordinal = index + 1;
          if (set.correction) set.correction.ordinal = set.ordinal;
        });
        break;
      }
      case "setNumericEffort": {
        item = targetSet(next, command);
        if (isDomainError(item)) return item;
        const value = editableText(command.value);
        // The numeric chips offer 0 to 5 reps left.
        const rir = validDecimal(value, { max: 5 });
        const count = command.partialReps;
        if (rir == null || !validPartialCount(count) || item.set.completion !== "pending" ||
          count > 0 && (rir !== 0 || !hasExplicitZero(item.set) || !canRecordPartials(item.set))) {
          return error("invalid-partial-effort");
        }
        item.set.edited.rir = value;
        item.set.edited.effort = null;
        item.set.touched.effort = true;
        if (count) item.set.partialReps = count;
        else delete item.set.partialReps;
        if (rir !== 0) delete item.set.calibration;
        break;
      }
      case "editSetField": {
        item = targetSet(next, command);
        if (isDomainError(item)) return item;
        if (!EDIT_FIELDS.has(command.field)) return error("unknown-set-field", { field: command.field });
        const value = editableText(command.value);
        if (value === undefined) return error("invalid-set-field-value", { field: command.field });
        item.set.edited[command.field] = value;
        // One effort value per set: a number clears the word and a word clears the number (Plan 077, OD-5).
        if (command.field === "rir") item.set.edited.effort = null;
        if (command.field === "effort") item.set.edited.rir = null;
        item.set.touched[command.field === "rir" || command.field === "effort" ? "effort" : command.field] = true;
        if (command.field === "effort" || command.field === "rir" && validDecimal(value) !== 0 ||
          command.field === "reps" && !canRecordPartials(item.set)) delete item.set.partialReps;
        // A max set is at 0 reps left; any other effort makes it a normal set again (Plan 077, OD-17).
        if (item.set.calibration && (command.field === "rir" || command.field === "effort") && !failureEffort(command.field, value)) {
          delete item.set.calibration;
        }
        break;
      }
      case "startMaxSet": {
        item = targetSet(next, command);
        if (isDomainError(item)) return item;
        if (item.set.completion !== "pending" || item.set.role !== "working") return error("max-set-not-pending");
        if (!validCalibration(command.calibration)) return error("invalid-calibration");
        if (command.copyLoadFromSetId != null) {
          if (typeof command.copyLoadFromSetId !== "string") return error("invalid-max-set-load-source");
          const source = hasOwn(item.exercise.sets, command.copyLoadFromSetId)
            ? item.exercise.sets[command.copyLoadFromSetId] : null;
          if (!source || source.ordinal !== item.set.ordinal - 1) return error("invalid-max-set-load-source");
          if (item.set.programmed.metrics?.length) {
            for (const metric of item.set.programmed.metrics) {
              if (!LOAD_SEMANTICS.has(metric.semantic)) continue;
              const value = source.edited.metrics?.[metric.id];
              if (value == null || value === item.set.edited.metrics?.[metric.id]) continue;
              item.set.edited.metrics[metric.id] = value;
              item.set.touched.metrics[metric.id] = true;
            }
          } else if (source.edited.load != null && source.edited.load !== item.set.edited.load) {
            item.set.edited.load = source.edited.load;
            item.set.touched.load = true;
          }
        }
        delete item.set.partialReps;
        item.set.calibration = jsonClone(command.calibration);
        break;
      }
      case "setLastRepSlow": {
        // "Was the last rep slow?" (Plan 077, OD-25): an optional answer on a completed set; null takes it back.
        item = targetSet(next, command);
        if (isDomainError(item)) return item;
        if (item.set.completion === "pending") return error("set-not-completed");
        if (command.value !== null && typeof command.value !== "boolean") return error("invalid-last-rep-slow");
        if (command.value === null) {
          if (!hasOwn(item.set.completion, "lastRepSlow")) return draft;
          delete item.set.completion.lastRepSlow;
        } else {
          if (item.set.completion.lastRepSlow === command.value) return draft;
          item.set.completion.lastRepSlow = command.value;
        }
        break;
      }
      case "cancelMaxSet": {
        item = targetSet(next, command);
        if (isDomainError(item)) return item;
        if (!item.set.calibration) return draft;
        if (item.set.completion !== "pending") return error("max-set-not-pending");
        delete item.set.calibration;
        break;
      }
      case "editMetricValue": {
        item = targetSet(next, command);
        if (isDomainError(item)) return item;
        const definition = item.set.programmed.metrics?.find(metric => metric.id === command.metricId);
        if (!definition) return error("unknown-set-metric", { metricId: command.metricId });
        const value = editableText(command.value);
        if (value === undefined) return error("invalid-metric-value", { metricId: command.metricId });
        item.set.edited.metrics[definition.id] = value;
        item.set.touched.metrics[definition.id] = true;
        if (definition.semantic === "reps" && !canRecordPartials(item.set)) delete item.set.partialReps;
        break;
      }
      case "refreshUntouchedSuggestions": {
        if (!isSafeInteger(command.sourceRevision) || command.sourceRevision !== draft.revision) {
          return error("stale-suggestion", {
            sourceRevision: command.sourceRevision,
            actualRevision: draft.revision,
          });
        }
        if (!Array.isArray(command.updates)) return error("invalid-suggestion-updates");
        const seen = new Set();
        for (const update of command.updates) {
          if (!isPlainObject(update) || !isText(update.exerciseInstanceId, { max: MAX_ID }) ||
            !isText(update.setId, { max: MAX_ID }) || !isPlainObject(update.fields)) {
            return error("invalid-suggestion-update");
          }
          if (hasOwn(update, "startingLoad") && !validStartingLoad(update.startingLoad)) return error("invalid-starting-load");
          const identity = `${update.exerciseInstanceId}\u0000${update.setId}`;
          if (seen.has(identity)) return error("duplicate-suggestion-update", {
            exerciseInstanceId: update.exerciseInstanceId,
            setId: update.setId,
          });
          seen.add(identity);
          if (!Object.keys(update.fields).some((field) => EDIT_FIELDS.has(field) || field === "metrics")) {
            return error("empty-suggestion-update", {
              exerciseInstanceId: update.exerciseInstanceId,
              setId: update.setId,
            });
          }
          for (const [field, value] of Object.entries(update.fields)) {
            if (field === "metrics") {
              const metricValues = value;
              const set = draft.exercises[update.exerciseInstanceId]?.sets?.[update.setId];
              if (!isPlainObject(metricValues) || Object.entries(metricValues).some(([metricId, text]) => {
                const definition = set?.programmed.metrics?.find(metric => metric.id === metricId);
                const editable = editableText(text);
              return !definition || editable == null || metricValue(editable, definition) == null;
              })) return error("invalid-suggestion-value", { field: "metrics" });
              continue;
            }
            const text = editableText(value);
            const valid = field === "load"
              ? validDecimal(text, { positive: true, max: 1000 }) != null
              : field === "reps"
                ? validInteger(text, { positive: true }) != null
                : field === "rir"
                  ? validDecimal(text, { max: 4 }) != null
                  : field === "effort" && hasOwn(EFFORT_RIR, text);
            if (!EDIT_FIELDS.has(field) || !valid) {
              return error("invalid-suggestion-value", { field });
            }
          }
          const found = targetSet(next, update);
          if (isDomainError(found)) return found;
        }
        let changed = false;
        for (const update of command.updates) {
          const found = targetSet(next, update);
          if (isDomainError(found)) return found;
          const { exercise, set } = found;
          if (exercise.status === "skipped" || set.role === "warmup" || set.completion !== "pending") continue;
          if (hasOwn(update, "startingLoad")) {
            set.startingLoad = jsonClone(update.startingLoad);
            changed = true;
          }
          for (const [field, rawValue] of Object.entries(update.fields)) {
            if (field === "metrics") {
              for (const [metricId, rawMetricValue] of Object.entries(rawValue)) {
                if (set.touched.metrics?.[metricId]) continue;
                const value = editableText(rawMetricValue);
                if (set.edited.metrics[metricId] === value) continue;
                set.edited.metrics[metricId] = value;
                changed = true;
              }
              continue;
            }
            const owner = field === "rir" || field === "effort" ? "effort" : field;
            if (set.touched[owner]) continue;
            const value = editableText(rawValue);
            if (set.edited[field] === value) continue;
            set.edited[field] = value;
            changed = true;
          }
        }
        if (!changed) return draft;
        break;
      }
      case "completeSet": {
        item = targetSet(next, command);
        if (isDomainError(item)) return item;
        if (command.expectedPending === true && item.set.completion !== "pending") return error("set-already-completed");
        if (hasOwn(command, "startingLoad")) {
          if (!validStartingLoad(command.startingLoad)) return error("invalid-starting-load");
          item.set.startingLoad = jsonClone(command.startingLoad);
        }
        // Effort the lifter never touched logs what its field shows (the caller's `prefill`, else the programmed
        // target), written into the set so the live session and History read the same value (Plan 077, A5), and
        // recorded as a prefill rather than an entry.
        const effortField = next.program.rirMode === "effort" ? "effort" : "rir";
        // A max set logs 0 reps left, at the load of the set before; at another load it is a normal set (Plan 077).
        if (item.set.calibration && !sameLoadAsSetBefore(next, item.exercise, item.set)) delete item.set.calibration;
        const maxSet = !!item.set.calibration;
        if (maxSet) {
          // Failure goes in the set's own effort field (Plan 077 PR 2's per-set rule), and its sibling clears.
          const maxField = effortFieldOf(next, item.set);
          item.set.edited[maxField] = maxField === "effort" ? "max" : "0";
          item.set.edited[maxField === "effort" ? "rir" : "effort"] = null;
          item.set.touched.effort = true;
        }
        const enteredEffort = !!item.set.touched.effort;
        if (!enteredEffort) {
          const offered = isPlainObject(command.prefill) && command.prefill.field === effortField ? command.prefill.value : null;
          const shown = typeof offered === "string" ? offered
            : item.set.edited[effortField] ?? (effortField === "effort" ? item.set.programmed.suggestedEffort ?? null : effectiveText(item.set, "rir"));
          const valid = effortField === "effort" ? hasOwn(EFFORT_RIR, shown) : validDecimal(shown) != null;
          if (valid) item.set.edited[effortField] = shown;
        }
        const issues = [...sessionSaveIssues(next), ...setSaveIssues(next, item.exercise, item.set)];
        if (issues.length) return error("set-not-saveable", { issues });
        const entered = effortFieldOf(next, item.set) === "effort"
          ? EFFORT_TOKEN_SOURCE[item.set.edited.effort] || "effort"
          : item.set.edited.rir === "5" ? "reps_left_5plus" : "reps_left";
        item.set.completion = { completedAt: command.completedAt, effortSource: maxSet ? "failure" : enteredEffort ? entered : "prefilled" };
        item.set.performed = jsonClone(item.set.correction?.performed || item.exercise.substitution?.replacement || snapshotFromExercise(item.exercise));
        delete item.set.correction;
        item.set.touched = { ...item.set.touched, load: true, reps: true, effort: true,
          ...(item.set.touched.metrics ? { metrics: Object.fromEntries(Object.keys(item.set.touched.metrics).map(id => [id, true])) } : {}) };
        break;
      }
      case "uncommitSet": {
        item = targetSet(next, command);
        if (isDomainError(item)) return item;
        if (command.correct === true) {
          if (item.set.completion === "pending" || Object.values(next.exercises).some(exercise =>
            Object.values(exercise.sets).some(set => set.correction))) return error("set-correction-in-progress");
          item.set.correction = jsonClone(item.set);
        }
        // A prefilled effort goes back to untouched, so logging the set again is still a prefill.
        if (item.set.completion?.effortSource === "prefilled") item.set.touched = { ...item.set.touched, effort: false };
        item.set.completion = "pending";
        break;
      }
      case "cancelSetCorrection": {
        item = targetSet(next, command);
        if (isDomainError(item)) return item;
        if (!item.set.correction) return error("no-set-correction");
        item.exercise.sets[item.set.setId] = item.set.correction;
        break;
      }
      case "markWarmup":
      case "markWorking": {
        item = targetSet(next, command);
        if (isDomainError(item)) return item;
        item.set.role = command.type === "markWarmup" ? "warmup" : "working";
        if (item.set.role === "warmup") delete item.set.partialReps;
        break;
      }
      case "initWarmupPrelude": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        const exercise = item.exercise;
        if (exercise.status === "skipped") return error("exercise-skipped", { exerciseInstanceId: command.exerciseInstanceId });
        const existing = exercise.warmupPrelude;
        // Only a plan nothing was done with, or one a swap retired, can be replaced.
        if (existing && !(command.replace === true && (preludeIsPristine(existing) || existing.plan === null))) return error("warmup-prelude-exists");
        const composition = preludeComposition(exercise);
        if (!composition) return error("warmup-unsupported-exercise");
        if (!Array.isArray(command.steps) || (command.steps.length && workHasStarted(exercise))) return error("invalid-warmup-steps");
        const kept = existing ? existing.steps.filter(step => step.completion !== "pending") : [];
        if (kept.length + command.steps.length > PRELUDE_MAX_STEPS) return error("warmup-step-cap");
        const metrics = preludeMetrics(composition);
        const steps = [];
        for (const input of command.steps) {
          if (!isPlainObject(input) || !isText(input.stepId, { max: MAX_ID })) return error("invalid-warmup-steps");
          const values = { [metrics.reps.id]: preludeText(input.reps) };
          if (metrics.load) values[metrics.load.id] = preludeText(input.loadKg);
          else if (input.loadKg != null) return error("invalid-warmup-steps");
          steps.push({ stepId: input.stepId, source: "suggested", values, touched: false, completion: "pending" });
        }
        const record = { v: PRELUDE_VERSION, plan: jsonClone(command.plan ?? null), composition, skipped: false,
          nextOrdinal: existing?.nextOrdinal ?? 1, steps: [...kept, ...steps] };
        if (record.plan === null) return error("invalid-warmup-plan");
        exercise.warmupPrelude = record;
        break;
      }
      case "editWarmupStep": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        const record = item.exercise.warmupPrelude;
        const step = record?.steps.find(entry => entry.stepId === command.stepId);
        if (!step) return error("unknown-warmup-step", { stepId: command.stepId });
        if (step.completion !== "pending") return error("warmup-step-not-pending", { stepId: command.stepId });
        if (!record.composition.metrics.some(metric => metric.id === command.metricId)) return error("unknown-warmup-metric", { metricId: command.metricId });
        const value = editableText(command.value);
        if (value === undefined || !isOptionalText(value, 64)) return error("invalid-warmup-values");
        step.values[command.metricId] = value;
        step.touched = true;
        break;
      }
      case "completeWarmupStep": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        const exercise = item.exercise;
        const record = exercise.warmupPrelude;
        const step = record?.steps.find(entry => entry.stepId === command.stepId);
        if (!step) return error("unknown-warmup-step", { stepId: command.stepId });
        if (step.completion !== "pending") return error("warmup-step-not-pending", { stepId: command.stepId });
        if (record.steps.find(entry => entry.completion === "pending") !== step) return error("warmup-step-not-current", { stepId: command.stepId });
        if (!isText(command.completedAt, { max: 100 })) return error("invalid-completed-at");
        if (record.nextOrdinal > PRELUDE_MAX_STEPS) return error("warmup-ordinal-cap");
        if (!preludeStepValues(step, record.composition)?.valid) return error("invalid-warmup-values", { stepId: command.stepId });
        step.completion = { completedAt: command.completedAt, ordinal: record.nextOrdinal,
          performed: jsonClone(exercise.substitution?.replacement || snapshotFromExercise(exercise)), composition: jsonClone(record.composition) };
        step.touched = true;
        record.nextOrdinal++;
        break;
      }
      case "skipWarmupSteps": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        const record = item.exercise.warmupPrelude;
        if (!record || record.composition === null) return error("no-warmup-prelude");
        record.steps = record.steps.filter(step => step.completion !== "pending");
        record.skipped = true;
        break;
      }
      case "addWarmupStep": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        const exercise = item.exercise;
        if (exercise.status === "skipped") return error("exercise-skipped", { exerciseInstanceId: command.exerciseInstanceId });
        if (!isText(command.stepId, { max: MAX_ID }) || !isPlainObject(command.values)) return error("invalid-warmup-values");
        let record = exercise.warmupPrelude;
        if (!record || record.composition === null) {
          const composition = preludeComposition(exercise);
          if (!composition) return error("warmup-unsupported-exercise");
          record = { v: PRELUDE_VERSION, plan: jsonClone(command.plan ?? null), composition, skipped: false,
            nextOrdinal: record?.nextOrdinal ?? 1, steps: record?.steps ?? [] };
          if (record.plan === null) return error("invalid-warmup-plan");
          exercise.warmupPrelude = record;
        }
        if (record.steps.some(step => step.completion === "pending" && step.source === "manual")) return error("warmup-manual-pending");
        if (record.steps.some(step => step.completion === "pending")) return error("warmup-step-pending");
        if (record.steps.length >= PRELUDE_MAX_STEPS || record.nextOrdinal > PRELUDE_MAX_STEPS) return error("warmup-step-cap");
        if (record.steps.some(step => step.stepId === command.stepId)) return error("duplicate-warmup-step");
        const ids = record.composition.metrics.map(metric => metric.id);
        if (Object.keys(command.values).some(id => !ids.includes(id))) return error("unknown-warmup-metric");
        const values = Object.fromEntries(ids.map(id => [id, preludeText(command.values[id] ?? null)]));
        record.steps.push({ stepId: command.stepId, source: "manual", values, touched: true, completion: "pending" });
        record.skipped = false;
        break;
      }
      case "correctWarmupStep":
      case "removeWarmupStep": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        const exercise = item.exercise;
        const record = exercise.warmupPrelude;
        const step = record?.steps.find(entry => entry.stepId === command.stepId);
        if (!step) return error("unknown-warmup-step", { stepId: command.stepId });
        if (step.completion === "pending") return error("warmup-step-not-completed", { stepId: command.stepId });
        if (command.type === "removeWarmupStep") {
          record.steps = record.steps.filter(entry => entry !== step);
          if (!record.steps.length && record.plan === null) delete exercise.warmupPrelude;
          break;
        }
        if (!isPlainObject(command.values)) return error("invalid-warmup-values");
        const ids = step.completion.composition.metrics.map(metric => metric.id);
        if (Object.keys(command.values).some(id => !ids.includes(id))) return error("unknown-warmup-metric");
        const candidate = { ...step, values: { ...step.values } };
        for (const [id, value] of Object.entries(command.values)) candidate.values[id] = preludeText(value);
        if (!preludeStepValues(candidate, step.completion.composition)?.valid) return error("invalid-warmup-values", { stepId: command.stepId });
        step.values = candidate.values;
        break;
      }
      case "skipExercise":
      case "restoreExercise": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        item.exercise.status = command.type === "skipExercise" ? "skipped" : "active";
        if (command.type === "skipExercise" && hasOwn(command, "reason")) {
          if (!SKIP_REASONS.includes(command.reason)) return error("invalid-skip-reason");
          item.exercise.skipReason = command.reason;
          if (command.reason === "pain") observe(item.exercise,activeMovement(item.exercise),"pain");
        } else delete item.exercise.skipReason;
        if (command.type === "skipExercise" && next.session.selectedExerciseId === item.exercise.exerciseInstanceId) {
          next.session.selectedExerciseId = next.exerciseOrder.find((id) => next.exercises[id].status === "active") ?? null;
        }
        break;
      }
      case "recordSubstitutionReason": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        const substitution = item.exercise.substitution;
        if (command.draftId !== draft.draftId || !substitution ||
          substitution.selectedAt !== command.selectedAt ||
          substitution.replacement.exerciseInstanceId !== command.replacementId) return error("stale-substitution");
        if (!SWAP_REASONS.includes(command.reason)) return error("invalid-swap-reason");
        item.exercise.swapReason = command.reason;
        if (command.reason === "pain") observe(item.exercise,substitution.reportedFrom || substitution.original,"pain",substitution.replacement.exerciseInstanceId);
        break;
      }
      case "markDiscomfort": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        if (!["pain", "discomfort"].includes(command.kind)) return error("invalid-discomfort");
        observe(item.exercise,activeMovement(item.exercise),command.kind);
        break;
      }
      case "clearDiscomfort": {
        item=targetExercise(next,command);
        if(isDomainError(item))return item;
        const identity=eventMovement(activeMovement(item.exercise));
        item.exercise.discomfort=(item.exercise.discomfort || []).filter(observation=>observation.exerciseId!==identity.exerciseId);
        if(!item.exercise.discomfort.length)delete item.exercise.discomfort;
        break;
      }
      case "substituteExercise": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        const issues = [];
        validateMovementSnapshot(command.replacement, "replacement", issues);
        if (issues.length) return error("invalid-substitution", { issues });
        if (command.replacement.exerciseInstanceId !== item.exercise.exerciseInstanceId &&
          hasOwn(next.exercises, command.replacement.exerciseInstanceId)) {
          return error("substitution-identity-in-use", {
            exerciseInstanceId: command.replacement.exerciseInstanceId,
          });
        }
        const exercise = item.exercise;
        const substitution = {
          original: exercise.substitution?.original || snapshotFromExercise(exercise),
          reportedFrom: jsonClone(activeMovement(exercise)),
          replacement: jsonClone(command.replacement),
          selectedAt: command.selectedAt,
        };
        const movementChanged = eventMovement(activeMovement(exercise)).exerciseId !== eventMovement(command.replacement).exerciseId;
        if (!movementChanged && exercise.substitution?.originalPendingSets) {
          substitution.originalPendingSets = jsonClone(exercise.substitution.originalPendingSets);
        }
        if (movementChanged && command.replacementProgram != null) {
          const program = validateReplacementProgram(command.replacementProgram, command.replacement, exercise.setOrder.length);
          if (!program.ok) return error("invalid-substitution-program", { issues: program.issues });
          // Completed sets keep the composition they were performed under; only
          // untouched pending sets take the replacement's prescriptions.
          const pendingIds = exercise.setOrder.filter(setId => exercise.sets[setId].completion === "pending" && !exercise.sets[setId].correction);
          const touched = pendingIds.filter(setId => {
            const set = exercise.sets[setId];
            return set.touched.load || set.touched.reps || set.touched.effort ||
              Object.values(set.touched.metrics || {}).some(Boolean);
          });
          if (touched.length) return error("substitution-touched-pending-set", { setIds: touched });
          const originalPendingSets = exercise.substitution?.originalPendingSets ||
            Object.fromEntries(pendingIds.map(setId => [setId, jsonClone(exercise.sets[setId])]));
          for (const setId of pendingIds) {
            const set = exercise.sets[setId];
            const spec = program.value.programmedSets[set.ordinal - 1];
            const metrics = editedMetricsFromPrevious(program.value, spec);
            clearOpening(set);
            set.programmed = programmedSetFromReplacement(program.value, spec);
            set.edited = { load: editableText(spec.suggestedLoad), reps: editableText(spec.suggestedReps),
              rir: null, effort: null, metrics };
            set.touched = { load: false, reps: false, effort: false,
              metrics: Object.fromEntries(Object.keys(metrics).map(id => [id, false])) };
          }
          substitution.originalPendingSets = originalPendingSets;
        }
        if (movementChanged) for (const setId of exercise.setOrder) if (exercise.sets[setId].completion === "pending") clearOpening(exercise.sets[setId]);
        exercise.substitution = substitution;
        if (movementChanged) retirePrelude(exercise);
        syncObservationSwaps(exercise);
        exercise.status = "active";
        break;
      }
      case "restoreOriginalExercise": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        const substitution = item.exercise.substitution;
        if (!substitution) break;
        const movementChanged = eventMovement(activeMovement(item.exercise)).exerciseId !== eventMovement(substitution.original).exerciseId;
        const originals = movementChanged ? substitution.originalPendingSets : null;
        for (const [setId, original] of Object.entries(originals || {})) {
          const set = item.exercise.sets[setId];
          if (set?.completion === "pending" && !set.correction) item.exercise.sets[setId] = { ...jsonClone(original), ordinal: set.ordinal };
        }
        if (movementChanged) for (const setId of item.exercise.setOrder) if (item.exercise.sets[setId].completion === "pending") clearOpening(item.exercise.sets[setId]);
        item.exercise.substitution = null;
        if (movementChanged) retirePrelude(item.exercise);
        syncObservationSwaps(item.exercise);
        break;
      }
      case "repeatPreviousSetValues": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        if (!Array.isArray(command.values)) return error("invalid-repeat-values");
        for (const previous of command.values) {
          if (!isPlainObject(previous)) return error("invalid-repeat-values");
          if (previous.setId && !hasOwn(item.exercise.sets, previous.setId)) {
            return error("unknown-set", {
              exerciseInstanceId: command.exerciseInstanceId,
              setId: previous.setId,
            });
          }
          const set = previous.setId
            ? item.exercise.sets[previous.setId]
            : item.exercise.setOrder.find((setId) => item.exercise.sets[setId].ordinal === previous.ordinal);
          const targetSet = typeof set === "string" && hasOwn(item.exercise.sets, set)
            ? item.exercise.sets[set]
            : isPlainObject(set) ? set : null;
          if (!targetSet) continue;
          delete targetSet.partialReps;
          for (const field of EDIT_FIELDS) {
            if (!hasOwn(previous, field)) continue;
            const value = editableText(previous[field]);
            if (value === undefined) return error("invalid-repeat-values", { field });
            targetSet.edited[field] = value;
            targetSet.touched[field === "rir" || field === "effort" ? "effort" : field] = true;
          }
          if (hasOwn(previous, "metrics")) {
            if (!isPlainObject(previous.metrics)) return error("invalid-repeat-values", { field: "metrics" });
            for (const [metricId, rawValue] of Object.entries(previous.metrics)) {
              const definition = targetSet.programmed.metrics?.find(metric => metric.id === metricId);
              const value = editableText(rawValue);
              if (!definition || value === undefined || metricValue(value, definition) == null) {
                return error("invalid-repeat-values", { field: metricId });
              }
              targetSet.edited.metrics[metricId] = value;
              targetSet.touched.metrics[metricId] = true;
            }
          }
        }
        break;
      }
      case "setExerciseNotes": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        if (!isText(command.value, { empty: true })) return error("invalid-exercise-notes");
        item.exercise.setupNotes = command.value;
        break;
      }
      case "setRirMode": {
        // The workout's effort vocabulary changes from the next set on (Plan 077, OD-5): completed sets and any set
        // the lifter already edited keep their own value; untouched sets take the new mode's control and prefill.
        if (!RIR_MODES.has(command.value)) return error("invalid-rir-mode", { value: command.value });
        if (next.program.rirMode === command.value) return draft;
        next.program.rirMode = command.value;
        break;
      }
      case "setSessionNotes":
        if (!isText(command.value, { empty: true })) return error("invalid-session-notes");
        next.session.notes = command.value;
        next.session.contextTouched.sessionNotes = true;
        break;
      case "setBodyweight": {
        const value = editableText(command.value);
        if (value === undefined) return error("invalid-bodyweight-text");
        next.session.bodyweight = value;
        next.session.contextTouched.bodyweight = true;
        break;
      }
      case "setSessionDate":
        if (!isText(command.value, { empty: true, max: 64 })) return error("invalid-session-date-text");
        next.program.scheduleDate = command.value;
        next.session.contextTouched.date = true;
        break;
      case "selectExercise":
        if (!hasOwn(next.exercises, command.exerciseInstanceId)) return error("unknown-exercise", { exerciseInstanceId: command.exerciseInstanceId });
        if (next.exercises[command.exerciseInstanceId].status !== "active") return error("exercise-skipped", { exerciseInstanceId: command.exerciseInstanceId });
        next.session.selectedExerciseId = command.exerciseInstanceId;
        break;
      case "reorderExercises": {
        if (!Array.isArray(command.exerciseOrder) || command.exerciseOrder.length !== next.exerciseOrder.length ||
          new Set(command.exerciseOrder).size !== command.exerciseOrder.length ||
          command.exerciseOrder.some((id) => !hasOwn(next.exercises, id))) return error("invalid-exercise-order");
        next.exerciseOrder = command.exerciseOrder.slice();
        break;
      }
      case "beginFinish":
        next.session.status = "finishing";
        break;
      case "cancelFinish":
        next.session.status = "active";
        break;
      default:
        return error("unknown-command", { type: command.type });
    }
    next.revision++;
    next.writer = nextWriter;
    next.session.updatedAt = command.updatedAt;
    const result = validate(next);
    return result.ok ? deepFreeze(next) : error("command-produced-invalid-draft", { issues: result.issues });
  }

  function numericSetValues(draft, set) {
    const load = validDecimal(effectiveText(set, "load"), { positive: true, max: 1000 });
    const reps = validInteger(effectiveText(set, "reps"), { positive: true });
    const rir = effortRir(draft, set);
    return { load, reps, rir: rir === undefined ? null : rir };
  }

  /** A row's effortSource is what completion recorded. A set saved without completing, or completed before Plan 077,
   *  has none: its touched flags can come from a legacy migration, so nothing is inferred from them. */
  function failureEffort(field, value) {
    // "r0" is stage B's "0 left" (Plan 077 PR 2); "max" is stage A's.
    return field === "effort" ? value === "max" || value === "r0" : validDecimal(value) === 0;
  }

  /** The set's load as a comparable value: the flat load, or its load metrics' values; "" for a set without load. */
  function loadSignature(set) {
    if (Array.isArray(set.programmed.metrics)) {
      return JSON.stringify(set.programmed.metrics.filter(metric => LOAD_SEMANTICS.has(metric.semantic))
        .map(metric => [metric.semantic, metricValue(set.edited.metrics?.[metric.id], metric)]));
    }
    return JSON.stringify(validDecimal(effectiveText(set, "load"), { positive: true, max: 1000 }));
  }

  function sameLoadAsSetBefore(draft, exercise, set) {
    const before = exercise.setOrder.map(id => exercise.sets[id])
      .find(other => other.ordinal === set.ordinal - 1 && other.role === "working" && other.completion !== "pending");
    return !!before && loadSignature(before) === loadSignature(set);
  }

  function effortSourceOf(set) {
    return set.completion !== "pending" && EFFORT_SOURCES.includes(set.completion?.effortSource)
      ? { effortSource: set.completion.effortSource } : {};
  }

  function validateSessionEvents(value) {
    if (!isPlainObject(value)) return false;
    const exact = (record, keys) => isPlainObject(record) && Object.keys(record).length === keys.length && keys.every(key => hasOwn(record,key));
    return Object.entries(value).every(([id, record]) => isText(id,{max:MAX_ID}) &&
      exact(record,["v","skips","pain"]) && record.v === 1 &&
      ["skips","pain"].every(field => Array.isArray(record[field]) && record[field].length <= 2000 &&
        record[field].every(event => exact(event,field === "skips" ? ["exerciseId","slotId","name",...(hasOwn(event,"reason")?["reason"]:[])] : ["exerciseId","slotId","name","kind","swapped"]) &&
          isText(event.exerciseId,{max:MAX_ID}) && isText(event.slotId,{max:MAX_ID}) && isText(event.name) &&
          (field === "skips" ? (!hasOwn(event,"reason") || SKIP_REASONS.includes(event.reason)) : ["pain","discomfort"].includes(event.kind) && typeof event.swapped === "boolean"))));
  }

  /* Plan 085 slice 3: durable warm-up learning state. `warmupObservations` is keyed by saved session id; each record
     names, with natural selectors (the exercise slot, the working ordinal, the warm-up ordinals and the performed
     identity), the rows it was learned from, so no row carries an id and the rows stay the one source of load and reps.
     `warmupPreferences` keeps one reset token per comparable lift. */
  const WARMUP_STATE_VERSION = 1;
  const WARMUP_DECISIONS = Object.freeze(["completed", "edited", "skipped"]);
  const WARMUP_OBSERVATION_KEYS = Object.freeze(["v", "liftKey", "exerciseId", "performedKey", "workingOrdinal", "warmupOrdinals",
    "savedAt", "resetGeneration", "decision", "workLoadKg", "barKg", "earlierLift", "stepGrid"]);
  const WARMUP_MAX_OBSERVATIONS_PER_SESSION = 64;

  function validWarmupObservation(value) {
    if (!isPlainObject(value) || WARMUP_OBSERVATION_KEYS.some(key => !hasOwn(value, key)) ||
      Object.keys(value).some(key => !WARMUP_OBSERVATION_KEYS.includes(key))) return false;
    if (value.v !== WARMUP_STATE_VERSION || !isText(value.liftKey, { max: 1000 }) || !isText(value.exerciseId, { max: MAX_ID }) ||
      !isText(value.performedKey, { max: MAX_ID }) || !isSafeInteger(value.workingOrdinal, 1) || !finiteNumber(value.savedAt) || value.savedAt < 0 ||
      !WARMUP_DECISIONS.includes(value.decision) || !positiveLoad(value.workLoadKg) || (value.barKg !== null && !positiveLoad(value.barKg)) ||
      (value.resetGeneration !== null && !isText(value.resetGeneration, { max: MAX_ID }))) return false;
    const ordinals = value.warmupOrdinals;
    if (!Array.isArray(ordinals) || ordinals.length > PRELUDE_MAX_STEPS || !Array.isArray(value.stepGrid) || value.stepGrid.length !== ordinals.length ||
      ordinals.some((ordinal, index) => !Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > PRELUDE_MAX_STEPS || (index > 0 && ordinal <= ordinals[index - 1]))) return false;
    if ((value.decision === "skipped") !== (ordinals.length === 0)) return false;
    const lift = value.earlierLift;
    if (lift !== null && (!exactKeys(lift, PRELUDE_LIFT_KEYS) || PRELUDE_LIFT_KEYS.some(key => !hasOwn(lift, key)) ||
      ["liftKey", "movementId", "primaryMuscle", "sessionId"].some(key => !isText(lift[key], { max: 1000 })) ||
      !finiteNumber(lift.completedAt) || !finiteNumber(lift.elapsedMs))) return false;
    return value.stepGrid.every(rung => exactKeys(rung, ["rungKg", "belowKg", "aboveKg"]) && positiveLoad(rung.rungKg) &&
      (rung.belowKg === null || (positiveLoad(rung.belowKg) && rung.rungKg - rung.belowKg > 0)) &&
      (rung.aboveKg === null || (positiveLoad(rung.aboveKg) && rung.rungKg + rung.aboveKg <= 1000 + 1e-6)));
  }

  const performedKeyOf = row => String(row?.performedLibraryId || row?.performedMovementId || "");

  /** A row's canonical load and reps, read from its metric values: the one source warm-up learning reads. */
  function warmupRowFacts(row) {
    const definitions = Array.isArray(row?.metricDefinitions) ? row.metricDefinitions : null;
    if (!definitions || !Array.isArray(row.metricValues)) return null;
    const read = predicate => {
      const metric = definitions.find(predicate);
      const entry = metric ? row.metricValues.find(item => item?.metricId === metric.id) : null;
      return typeof entry?.value === "number" && Number.isFinite(entry.value) ? entry.value : null;
    };
    const loadKg = read(metric => LOAD_SEMANTICS.has(metric?.semantic));
    const reps = read(metric => metric?.semantic === "reps" || metric?.semantic === "repsPerSide");
    return loadKg > 0 && Number.isSafeInteger(reps) && reps > 0 ? { loadKg, reps } : null;
  }

  function warmupTag(kind, exerciseId, ordinal) {
    return JSON.stringify([kind, exerciseId, ordinal]);
  }

  /** The rows one observation names, or null when any selector fails to match exactly one row. */
  function resolveObservationRows(sessionRows, observation) {
    const one = predicate => {
      const found = sessionRows.filter(predicate);
      return found.length === 1 ? found[0] : null;
    };
    const work = one(row => row?.exerciseId === observation.exerciseId && !row.warmup && row.origin !== "ramp" && row.set === observation.workingOrdinal);
    if (!work || performedKeyOf(work) !== observation.performedKey) return null;
    const steps = [];
    for (const ordinal of observation.warmupOrdinals) {
      const row = one(candidate => candidate?.exerciseId === observation.exerciseId && candidate.warmup === true &&
        candidate.origin === "suggested-warmup" && candidate.warmupOrdinal === ordinal);
      const facts = row && performedKeyOf(row) === observation.performedKey ? warmupRowFacts(row) : null;
      if (!facts) return null;
      steps.push({ setId: warmupTag("u", observation.exerciseId, ordinal), ...facts });
    }
    return { work, steps };
  }

  function groupRowsBySession(log) {
    const bySession = new Map();
    for (const row of Array.isArray(log) ? log : []) {
      const id = String(row?.session ?? "");
      if (!bySession.has(id)) bySession.set(id, []);
      bySession.get(id).push(row);
    }
    return bySession;
  }

  /** Structure always; with `log`, ownership and every selector too (the transfer contract's strict form). */
  function validateWarmupObservations(value, log = null) {
    if (!isPlainObject(value)) return false;
    const bySession = log === null ? null : groupRowsBySession(log);
    if (bySession && Object.keys(value).length > bySession.size) return false;
    return Object.entries(value).every(([sessionId, record]) => {
      if (!isText(sessionId, { max: MAX_ID }) || !exactKeys(record, ["v", "observations"]) || record.v !== WARMUP_STATE_VERSION ||
        !Array.isArray(record.observations) || record.observations.length === 0 || record.observations.length > WARMUP_MAX_OBSERVATIONS_PER_SESSION ||
        !record.observations.every(validWarmupObservation) ||
        new Set(record.observations.map(item => item.liftKey)).size !== record.observations.length) return false;
      if (!bySession) return true;
      const rows = bySession.get(sessionId);
      return !!rows && record.observations.every(observation => resolveObservationRows(rows, observation) !== null);
    });
  }

  function validateWarmupPreferences(value) {
    return isPlainObject(value) && Object.keys(value).length <= 5000 && Object.entries(value).every(([liftKey, entry]) =>
      isText(liftKey, { max: 1000 }) && exactKeys(entry, ["v", "resetGeneration", "resetAt"]) && entry.v === WARMUP_STATE_VERSION &&
      isText(entry.resetGeneration, { max: MAX_ID }) && isText(entry.resetAt, { max: 100 }));
  }

  /** The saved observations the policy may read: each resolved against the live rows, the unresolvable dropped. */
  function resolveWarmupObservations(value, log) {
    if (!isPlainObject(value)) return [];
    const bySession = groupRowsBySession(log);
    const out = [];
    for (const [sessionId, record] of Object.entries(value)) {
      const rows = bySession.get(sessionId);
      if (!rows || !Array.isArray(record?.observations)) continue;
      for (const observation of record.observations) {
        if (!validWarmupObservation(observation)) continue;
        const resolved = resolveObservationRows(rows, observation);
        if (!resolved) continue;
        out.push({
          version: observation.v, liftKey: observation.liftKey, sessionId,
          workingSetId: warmupTag("w", observation.exerciseId, observation.workingOrdinal),
          warmupSetIds: resolved.steps.map(step => step.setId), steps: resolved.steps, stepGrid: jsonClone(observation.stepGrid),
          savedAt: observation.savedAt, resetGeneration: observation.resetGeneration, decision: observation.decision,
          workLoadKg: observation.workLoadKg, barKg: observation.barKg, earlierLift: jsonClone(observation.earlierLift),
        });
      }
    }
    return out;
  }

  /** The map with every stale reference dropped; null when nothing is left. */
  function pruneWarmupObservations(value, log) {
    if (!isPlainObject(value)) return null;
    const bySession = groupRowsBySession(log);
    const out = {};
    for (const [sessionId, record] of Object.entries(value)) {
      const rows = bySession.get(sessionId);
      if (!rows || !exactKeys(record, ["v", "observations"]) || !Array.isArray(record.observations)) continue;
      const kept = record.observations.filter(observation => validWarmupObservation(observation) && resolveObservationRows(rows, observation));
      if (kept.length) out[sessionId] = { v: WARMUP_STATE_VERSION, observations: jsonClone(kept) };
    }
    return Object.keys(out).length ? out : null;
  }

  function sessionEventsOf(draft) {
    const events = {v:1,skips:[],pain:[]};
    for (const id of draft.exerciseOrder) {
      const exercise = draft.exercises[id];
      const identity = {...eventMovement(activeMovement(exercise)),slotId:exercise.sourceExerciseId};
      if (exercise.status === "skipped") events.skips.push({...identity,...(exercise.skipReason?{reason:exercise.skipReason}:{})});
      for(const observation of exercise.discomfort || []) {
        const {replacementId,...fact}=observation;
        events.pain.push({...fact,slotId:exercise.sourceExerciseId});
      }
    }
    return events;
  }

  /** The canonical metric attribution a history row carries, from the composition the set or warm-up was logged under. */
  function metricRowFields(row, draft, programmed, metricDefinitions, metricValues, original, setProgrammed) {
    row.metricIds = metricDefinitions.map(metric => metric.id);
    row.metricDefinitions = jsonClone(metricDefinitions);
    row.metricOrigin = programmed.metricOrigin;
    row.sourceLibraryId = programmed.sourceLibraryId ?? original.libraryId ?? null;
    row.metricValues = metricValues;
    row.equipmentId = programmed.equipmentId ?? null;
    const metricSemantics = new Set(metricDefinitions.map(metric => metric.semantic));
    const loadingConvention = programmed.loadingConvention ||
      (metricSemantics.has("assistanceKg") ? "assistance"
        : metricSemantics.has("loadPerSideKg") || metricSemantics.has("persistentLoadPerSideKg") ? "per_side"
          : metricDefinitions.length === 1 && (metricSemantics.has("reps") || metricSemantics.has("repsPerSide")) ? "bodyweight" : "external");
    row.loadingConvention = loadingConvention;
    if (isPlainObject(programmed.loadingModel)) row.loadingModel = jsonClone(programmed.loadingModel);
    const capturedLoadingContext = isPlainObject(programmed.loadingContext)
      ? jsonClone(programmed.loadingContext) : {};
    capturedLoadingContext.loadingConvention = loadingConvention;
    capturedLoadingContext.bodyweightKg = draft.session.bodyweight == null || draft.session.bodyweight === ""
      ? null : Number(draft.session.bodyweight);

    if (!hasOwn(capturedLoadingContext, "externalLoadMultiplier")) {
      capturedLoadingContext.externalLoadMultiplier = loadingConvention === "per_side" ? null
        : loadingConvention === "bodyweight" ? 0 : 1;
    }
    if (!hasOwn(capturedLoadingContext, "bodyweightCoefficient") &&
      hasOwn(programmed.loadingModel || {}, "bodyweightCoefficient")) {
      capturedLoadingContext.bodyweightCoefficient = programmed.loadingModel.bodyweightCoefficient;
    }
    // Whether bodyweight counted toward this set's load is a fact of the set,
    // so progression can compare it; it needs a coefficient and a bodyweight.
    if (typeof capturedLoadingContext.bodyweightContributionEnabled !== "boolean") {
      capturedLoadingContext.bodyweightContributionEnabled = (capturedLoadingContext.bodyweightCoefficient ?? 0) > 0 &&
        capturedLoadingContext.bodyweightKg > 0;
    }
    row.loadingContext = capturedLoadingContext;
    row.metricType = setProgrammed.metricType;
    row.restSeconds = Number.isSafeInteger(setProgrammed.restSeconds) ? setProgrammed.restSeconds : null;
  }

  /** A completed Prelude step as a History row: a warm-up beside the sets, numbered by its own ordinal. */
  function preludeRow(draft, exercise, step, original, completedAt) {
    const { composition, performed, ordinal } = step.completion;
    const definitions = composition.metrics;
    const metricValues = definitions.map(metric => ({ metricId: metric.id, value: metricValue(step.values[metric.id], metric), unit: metric.unit }));
    const bySemantic = new Map(metricValues.map((metric, index) => [definitions[index].semantic, metric.value]));
    const row = {
      session: draft.draftId,
      date: draft.program.scheduleDate,
      day: draft.program.dayLabel,
      name: original.displayName,
      exerciseId: exercise.exerciseInstanceId,
      set: 0,
      setIndex: 0,
      load: bySemantic.has("loadKg") ? bySemantic.get("loadKg") : null,
      reps: bySemantic.has("reps") ? bySemantic.get("reps") : null,
      rir: null,
      notes: draft.session.notes.trim(),
      created: completedAt,
      ...(hasOwn(draft.program, "blockId") ? { blockId: draft.program.blockId } : {}),
      primary: original.primary,
      secondary: original.secondary,
      performedName: performed.displayName,
      performedPrimary: performed.primary,
      performedSecondary: performed.secondary,
    };
    metricRowFields(row, draft, composition, definitions, metricValues, original, composition);
    if (performed.libraryId) row.performedLibraryId = performed.libraryId;
    else if (performed.movementId) row.performedMovementId = performed.movementId;
    if (exercise.setupNotes.trim()) row.exNote = exercise.setupNotes.trim();
    row.warmup = true;
    row.origin = "suggested-warmup";
    row.warmupOrdinal = ordinal;
    const bodyweight = draft.session.bodyweight;
    if (bodyweight != null && bodyweight !== "") row.bodyweight = Number(bodyweight);
    return row;
  }

  // Legacy row-only callers retain their array; the session commit requests both projections.
  function toHistoryRows(draft, completedAt, {includeSessionEvents = false} = {}) {
    const issues = validateForSave(draft);
    if (issues.length) return error("draft-not-saveable", { issues });
    if (!isText(completedAt, { max: 100 })) return error("invalid-completed-at");
    const rows = [];
    for (const exerciseId of draft.exerciseOrder) {
      const exercise = draft.exercises[exerciseId];
      if (exercise.status === "skipped") continue;
      const original = snapshotFromExercise(exercise);
      const current = exercise.substitution?.replacement || original;
      for (const step of exercise.warmupPrelude?.steps ?? []) {
        if (step.completion !== "pending") rows.push(preludeRow(draft, exercise, step, original, completedAt));
      }
      let rampCount = 0;
      for (const setId of exercise.setOrder) {
        const stored = exercise.sets[setId];
        const set = stored.correction || stored;
        const precedingRamps = rampCount;
        if (set.origin === "ramp") rampCount++;
        if (!isCandidate(set)) continue;
        // A set completed before a substitution keeps the movement it was performed as.
        const performed = isPlainObject(set.performed) ? set.performed : current;
        const programmed = { ...exercise.programmed, ...set.programmed };
        const values = numericSetValues(draft, set);
        const metricDefinitions = Array.isArray(set.programmed.metrics) ? set.programmed.metrics : null;
        const metricValues = metricDefinitions ? metricDefinitions.map(metric => ({
          metricId: metric.id,
          value: metricValue(set.edited.metrics?.[metric.id], metric),
          unit: metric.unit,
        })) : null;
        const metricBySemantic = new Map((metricValues || []).map(metric => [
          metricDefinitions.find(definition => definition.id === metric.metricId)?.semantic,
          metric.value,
        ]));
        const row = {
          session: draft.draftId,
          date: draft.program.scheduleDate,
          day: draft.program.dayLabel,
          name: original.displayName,
          exerciseId: exercise.exerciseInstanceId,
          set: set.ordinal,
          // Only inserted trials shift the engine index. Manual warm-ups and
          // missing observations keep the historical indexing contract.
          setIndex: set.ordinal - 1 - precedingRamps,
          load: metricBySemantic.has("loadKg") ? metricBySemantic.get("loadKg") : metricDefinitions ? null : values.load,
          reps: metricBySemantic.has("reps") ? metricBySemantic.get("reps") : metricDefinitions ? null : values.reps,
          rir: metricDefinitions
            ? effortFieldOf(draft, set) === "effort"
              ? hasOwn(EFFORT_RIR, set.edited.effort) ? EFFORT_RIR[set.edited.effort] : null
              : set.edited.rir == null ? null : validDecimal(set.edited.rir)
            : values.rir,
          notes: draft.session.notes.trim(),
          created: completedAt,
          ...effortSourceOf(set),
          ...(set.partialReps > 0 ? { partialReps: set.partialReps, effortSource: "reps_left" } : {}),
          ...(set.completion !== "pending" && typeof set.completion?.lastRepSlow === "boolean" ? { lastRepSlow: set.completion.lastRepSlow } : {}),
          ...(set.completion !== "pending" && set.completion?.effortSource === "failure" && validCalibration(set.calibration)
            ? { calibration: jsonClone(set.calibration) } : {}),
          ...(hasOwn(draft.program, "blockId") ? { blockId: draft.program.blockId } : {}),
          primary: original.primary,
          secondary: original.secondary,
          performedName: performed.displayName,
          performedPrimary: performed.primary,
          performedSecondary: performed.secondary,
        };
        if (metricDefinitions) metricRowFields(row, draft, programmed, metricDefinitions, metricValues, original, set.programmed);
        if (performed.libraryId) row.performedLibraryId = performed.libraryId;
        else if (performed.movementId) row.performedMovementId = performed.movementId;
        if (exercise.setupNotes.trim()) row.exNote = exercise.setupNotes.trim();
        if (set.role === "warmup") row.warmup = true;
        if (set.origin === "ramp") row.origin = "ramp";
        if (set.role === "working" && validStartingLoad(set.startingLoad) &&
          !rows.some(prior => prior.exerciseId === exercise.exerciseInstanceId && !prior.warmup)) row.startingLoad = jsonClone(set.startingLoad);
        const bodyweight = draft.session.bodyweight;
        if (bodyweight != null && bodyweight !== "") row.bodyweight = Number(bodyweight);
        rows.push(row);
      }
    }
    return includeSessionEvents ? {rows,sessionEvents:sessionEventsOf(draft)} : rows;
  }

  const LEGACY_META_FIELDS = new Set([
    "__done",
    "__touched",
    "__warm",
    "__skipped",
    "__substituted",
    "__substitutedRef",
    "__exnotes",
    "__day",
    "__date",
    "__sessionNotes",
    "__bodyweight",
    "__contextTouched",
    "__startedAt",
    "__lastCommitAt",
    "__selectedExercise",
    "__selectedExerciseId",
  ]);

  function legacyObject(raw) {
    if (typeof raw !== "string") return isPlainObject(raw) ? raw : migrationError("invalid-legacy-object");
    try {
      const parsed = JSON.parse(raw);
      return isPlainObject(parsed) ? parsed : migrationError("invalid-legacy-object");
    } catch {
      return migrationError("invalid-legacy-json");
    }
  }

  function legacyCollection(legacy, field, kind) {
    if (!hasOwn(legacy, field)) return kind === "array" ? [] : Object.create(null);
    const value = legacy[field];
    if (kind === "array") {
      if (!Array.isArray(value) || value.some((item) => !isText(item, { max: MAX_ID }))) {
        return migrationError("invalid-legacy-marker", { field });
      }
      return value;
    }
    if (!isPlainObject(value)) return migrationError("invalid-legacy-marker", { field });
    return value;
  }

  function legacyTimestamp(value, field) {
    const number = typeof value === "number" ? value : /^\d+$/.test(String(value ?? "")) ? Number(value) : NaN;
    if (!Number.isFinite(number) || number <= 0) return migrationError("invalid-legacy-timestamp", { field });
    const date = new Date(number);
    return Number.isNaN(date.getTime()) ? migrationError("invalid-legacy-timestamp", { field }) : date.toISOString();
  }

  function migrateLegacy(raw, renderedProgramSnapshot) {
    const legacy = legacyObject(raw);
    if (legacy?.kind === "migration-error") return legacy;
    if (!looksLegacy(legacy)) return migrationError("not-legacy-draft");
    if (!isPlainObject(renderedProgramSnapshot) ||
      !isPlainObject(renderedProgramSnapshot.programContext) ||
      !isPlainObject(renderedProgramSnapshot.sessionSelection) ||
      !isPlainObject(renderedProgramSnapshot.valueResolutions)) {
      return migrationError("invalid-migration-snapshot");
    }

    const programContext = renderedProgramSnapshot.programContext;
    const sessionSelection = renderedProgramSnapshot.sessionSelection;
    const valueResolutions = renderedProgramSnapshot.valueResolutions;
    const substitutionResolutions = renderedProgramSnapshot.substitutionResolutions ?? Object.create(null);
    if (!isPlainObject(substitutionResolutions)) return migrationError("invalid-substitution-resolutions");
    if (!Array.isArray(programContext.exercises)) return migrationError("invalid-migration-snapshot");

    const legacyExercises = Object.create(null);
    const allowedFields = Object.create(null);
    for (const source of programContext.exercises) {
      if (!isPlainObject(source) || !isText(source.legacyExerciseId, { max: MAX_ID }) ||
        !isSafeInteger(source.sets, 1) || !Array.isArray(source.setIds) || source.setIds.length !== source.sets ||
        source.setIds.some((setId) => !isText(setId, { max: MAX_ID })) ||
        hasOwn(legacyExercises, source.legacyExerciseId)) {
        return migrationError("invalid-legacy-exercise-map");
      }
      if (source.legacyExerciseId !== source.exerciseInstanceId) {
        return migrationError("legacy-exercise-identity-mismatch", { exerciseId: source.legacyExerciseId });
      }
      legacyExercises[source.legacyExerciseId] = source;
      for (let ordinal = 1; ordinal <= source.setIds?.length; ordinal++) {
        const setId = source.setIds[ordinal - 1];
        for (const field of EDIT_FIELDS) {
          const key = `${source.legacyExerciseId}_${ordinal}_${field}`;
          allowedFields[key] = { exerciseInstanceId: source.exerciseInstanceId, setId, field };
        }
      }
    }

    for (const key of Object.keys(legacy)) {
      if (!LEGACY_META_FIELDS.has(key) && !hasOwn(allowedFields, key)) {
        return migrationError("unknown-legacy-field", { field: key });
      }
    }
    const resolvedKeys = new Set(Object.keys(valueResolutions));
    for (const key of Object.keys(legacy)) {
      if (!hasOwn(allowedFields, key) && key !== "__bodyweight") continue;
      if (editableText(legacy[key]) === undefined) return migrationError("invalid-legacy-value", { field: key });
      if (!hasOwn(valueResolutions, key)) return migrationError("missing-value-resolution", { field: key });
      if (editableText(valueResolutions[key]) === undefined) return migrationError("invalid-value-resolution", { field: key });
      resolvedKeys.delete(key);
    }
    if (resolvedKeys.size) return migrationError("unused-value-resolution", { field: [...resolvedKeys][0] });

    const done = legacyCollection(legacy, "__done", "array");
    const touched = legacyCollection(legacy, "__touched", "array");
    const warm = legacyCollection(legacy, "__warm", "array");
    const skipped = legacyCollection(legacy, "__skipped", "array");
    const substituted = legacyCollection(legacy, "__substituted", "object");
    const substitutedRefs = legacyCollection(legacy, "__substitutedRef", "object");
    const exerciseNotes = legacyCollection(legacy, "__exnotes", "object");
    const collections = [done, touched, warm, skipped, substituted, substitutedRefs, exerciseNotes];
    const invalidCollection = collections.find((value) => value?.kind === "migration-error");
    if (invalidCollection) return invalidCollection;

    const contextTouched = legacyCollection(legacy, "__contextTouched", "object");
    if (contextTouched?.kind === "migration-error") return contextTouched;
    for (const key of Object.keys(contextTouched)) {
      if (!["day", "date", "sessionNotes", "bodyweight"].includes(key) || typeof contextTouched[key] !== "boolean") {
        return migrationError("invalid-legacy-context-marker", { field: key });
      }
    }
    const contextFields = {
      day: "__day",
      date: "__date",
      sessionNotes: "__sessionNotes",
      bodyweight: "__bodyweight",
    };
    for (const [contextField, legacyField] of Object.entries(contextFields)) {
      if (contextTouched[contextField] && !hasOwn(legacy, legacyField)) {
        return migrationError("missing-legacy-context-value", { field: legacyField });
      }
    }

    const legacySetKeys = Object.create(null);
    for (const [legacyExerciseId, source] of Object.entries(legacyExercises)) {
      for (let ordinal = 1; ordinal <= source.setIds.length; ordinal++) {
        legacySetKeys[`${legacyExerciseId}_${ordinal}`] = {
          exerciseInstanceId: source.exerciseInstanceId,
          setId: source.setIds[ordinal - 1],
        };
      }
    }
    for (const [field, values] of [["__done", done], ["__touched", touched], ["__warm", warm]]) {
      const unknown = values.find((key) => !hasOwn(legacySetKeys, key));
      if (unknown) return migrationError("unmapped-legacy-set", { field, setKey: unknown });
    }
    const exerciseMarkerMaps = [
      ["__skipped", skipped],
      ["__substituted", Object.keys(substituted)],
      ["__substitutedRef", Object.keys(substitutedRefs)],
      ["__exnotes", Object.keys(exerciseNotes)],
    ];
    for (const [field, ids] of exerciseMarkerMaps) {
      const unknown = ids.find((id) => !hasOwn(legacyExercises, id));
      if (unknown) return migrationError("unmapped-legacy-exercise", { field, exerciseId: unknown });
    }

    if (hasOwn(legacy, "__day")) {
      if (!isText(legacy.__day, { max: 500 }) || legacy.__day !== programContext.dayLabel) {
        return migrationError("legacy-day-mismatch");
      }
    }
    for (const field of ["__date", "__sessionNotes"]) {
      if (hasOwn(legacy, field) && !isText(legacy[field], { empty: true })) {
        return migrationError("invalid-legacy-metadata", { field });
      }
    }

    let startedAt = sessionSelection.startedAt;
    if (hasOwn(legacy, "__startedAt")) {
      startedAt = legacyTimestamp(legacy.__startedAt, "__startedAt");
      if (startedAt?.kind === "migration-error") return startedAt;
    }
    let completedAt = renderedProgramSnapshot.completedAt ?? sessionSelection.updatedAt ?? sessionSelection.startedAt;
    if (hasOwn(legacy, "__lastCommitAt")) {
      if (!done.length) return migrationError("orphan-legacy-last-commit");
      completedAt = legacyTimestamp(legacy.__lastCommitAt, "__lastCommitAt");
      if (completedAt?.kind === "migration-error") return completedAt;
    }
    if (done.length && !isText(completedAt, { max: 100 })) return migrationError("missing-completion-timestamp");

    const selectedFields = ["__selectedExercise", "__selectedExerciseId"].filter((field) => hasOwn(legacy, field));
    if (selectedFields.length > 1) return migrationError("ambiguous-legacy-selection");
    let selectedExerciseId = sessionSelection.selectedExerciseId;
    if (selectedFields.length) {
      const legacySelected = legacy[selectedFields[0]];
      if (!isText(legacySelected, { max: MAX_ID }) || !hasOwn(legacyExercises, legacySelected)) {
        return migrationError("unmapped-legacy-selection");
      }
      selectedExerciseId = legacyExercises[legacySelected].exerciseInstanceId;
    }

    const migratedSelection = {
      ...sessionSelection,
      scheduleDate: hasOwn(legacy, "__date") ? legacy.__date : sessionSelection.scheduleDate,
      bodyweight: hasOwn(legacy, "__bodyweight") ? valueResolutions.__bodyweight : sessionSelection.bodyweight,
      notes: hasOwn(legacy, "__sessionNotes") ? legacy.__sessionNotes : sessionSelection.notes,
      contextTouched: Object.fromEntries(CONTEXT_TOUCHED_FIELDS.map((field) => [field, !!contextTouched[field]])),
      selectedExerciseId,
      startedAt,
      updatedAt: renderedProgramSnapshot.migratedAt ?? completedAt ?? sessionSelection.updatedAt ?? startedAt,
    };
    const base = create(programContext, migratedSelection, renderedProgramSnapshot.previousSessionFacts);
    if (isDomainError(base)) return migrationError("invalid-migration-snapshot", { issues: base.issues ?? [base.code] });
    const next = jsonClone(base);
    const doneSet = new Set(done);
    const touchedSet = new Set(touched);
    const warmSet = new Set(warm);
    const skippedSet = new Set(skipped);

    for (const [legacyKey, target] of Object.entries(allowedFields)) {
      if (!hasOwn(legacy, legacyKey)) continue;
      const value = editableText(valueResolutions[legacyKey]);
      if (value === undefined) return migrationError("invalid-value-resolution", { field: legacyKey });
      const set = next.exercises[target.exerciseInstanceId].sets[target.setId];
      const metrics = Array.isArray(set.programmed.metrics) ? set.programmed.metrics : null;
      const legacySemantic = LEGACY_METRIC_SEMANTIC[target.field];
      // Since Plan 067 a metric-backed slot keeps its typed load/reps in
      // `edited.metrics[metricId]`, not the flat `edited.load`/`edited.reps`
      // Focus no longer reads for that slot (see shelfMetricFieldHtml and
      // setSaveIssues). Map a legacy load/reps value only onto the single
      // metric whose semantic is exactly that quantity: `loadKg` for load,
      // `reps` for reps. A per-side load, an assistance load, a per-side rep
      // count, a duplicated metric, or a missing one is not the same physical
      // quantity as the flat field, so migration fails outright rather than
      // guess and silently drop the lifter's value (issue #332). RIR (and
      // effort) have no metric-map equivalent for any slot; they stay flat.
      if (metrics && legacySemantic) {
        const matches = metrics.filter((metric) => metric?.semantic === legacySemantic);
        if (matches.length !== 1) return migrationError("unmapped-legacy-metric", { field: legacyKey });
        set.edited.metrics[matches[0].id] = value;
        continue;
      }
      set.edited[target.field] = value;
    }
    for (const [legacySetKey, target] of Object.entries(legacySetKeys)) {
      const set = next.exercises[target.exerciseInstanceId].sets[target.setId];
      if (touchedSet.has(legacySetKey)) set.touched = { load: true, reps: true, effort: true };
      if (doneSet.has(legacySetKey)) set.completion = { completedAt };
      if (warmSet.has(legacySetKey)) set.role = "warmup";
    }
    for (const [legacyExerciseId, source] of Object.entries(legacyExercises)) {
      const exercise = next.exercises[source.exerciseInstanceId];
      if (skippedSet.has(legacyExerciseId)) exercise.status = "skipped";
      if (hasOwn(exerciseNotes, legacyExerciseId)) {
        if (!isText(exerciseNotes[legacyExerciseId], { empty: true })) {
          return migrationError("invalid-legacy-exercise-note", { exerciseId: legacyExerciseId });
        }
        exercise.setupNotes = exerciseNotes[legacyExerciseId];
      }
      if (!hasOwn(substituted, legacyExerciseId)) continue;
      const legacyName = substituted[legacyExerciseId];
      const legacyRef = hasOwn(substitutedRefs, legacyExerciseId) ? substitutedRefs[legacyExerciseId] : null;
      if (!isText(legacyName, { max: 500 }) || (legacyRef != null && !isText(legacyRef, { max: MAX_ID }))) {
        return migrationError("invalid-legacy-substitution", { exerciseId: legacyExerciseId });
      }
      const resolution = substitutionResolutions[legacyExerciseId];
      if (!isPlainObject(resolution) || resolution.legacyName !== legacyName ||
        (resolution.legacyRef ?? null) !== legacyRef) {
        return migrationError("unresolved-legacy-substitution", { exerciseId: legacyExerciseId });
      }
      const issues = [];
      validateMovementSnapshot(resolution.replacement, "replacement", issues);
      if (issues.length) return migrationError("invalid-substitution-resolution", { exerciseId: legacyExerciseId, issues });
      exercise.substitution = {
        original: snapshotFromExercise(exercise),
        replacement: jsonClone(resolution.replacement),
        selectedAt: resolution.selectedAt ?? renderedProgramSnapshot.migratedAt,
      };
      if (!isText(exercise.substitution.selectedAt, { max: 100 })) {
        return migrationError("missing-substitution-timestamp", { exerciseId: legacyExerciseId });
      }
    }
    for (const legacyExerciseId of Object.keys(substitutedRefs)) {
      if (!hasOwn(substituted, legacyExerciseId)) {
        return migrationError("orphan-legacy-substitution-ref", { exerciseId: legacyExerciseId });
      }
    }
    const unusedSubstitution = Object.keys(substitutionResolutions).find((legacyExerciseId) => !hasOwn(substituted, legacyExerciseId));
    if (unusedSubstitution) {
      return migrationError("unused-substitution-resolution", { exerciseId: unusedSubstitution });
    }
    if (next.session.selectedExerciseId && next.exercises[next.session.selectedExerciseId].status === "skipped") {
      return migrationError("selected-legacy-exercise-skipped");
    }

    const checked = validate(next);
    return checked.ok
      ? deepFreeze(next)
      : migrationError("invalid-migrated-draft", { issues: checked.issues });
  }

  const api = Object.freeze({
    SCHEMA_VERSION,
    SKIP_REASONS,
    EFFORT_SOURCES,
    canRecordPartials,
    hasExplicitZero,
    validHistoryPartials,
    validSuggestedWarmupRow,
    preludeIsPristine,
    validCalibration,
    validStartingLoad,
    create,
    parse,
    migrateLegacy,
    reduce,
    toHistoryRows,
    validateSessionEvents,
    validateWarmupObservations,
    validateWarmupPreferences,
    resolveWarmupObservations,
    pruneWarmupObservations,
    warmupRowFacts,
    validateLoadingContext(value) {
      const issues = [];
      validateLoadingContext(value, "loadingContext", issues);
      return issues.length ? { ok: false, issues } : { ok: true, value: jsonClone(value), issues: [] };
    },
    validate,
    validateForSave,
    isPristine,
    serialize,
    logicalCloneSection,
    isDomainError,
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeWorkoutDraft = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
