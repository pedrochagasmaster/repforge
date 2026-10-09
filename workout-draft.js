(function (root) {
  "use strict";

  const SCHEMA_VERSION = 2;
  const STATUS = new Set(["active", "finishing"]);
  const SET_ROLES = new Set(["working", "warmup"]);
  const RIR_MODES = new Set(["numeric", "effort"]);
  const UNITS = new Set(["kg", "lb"]);
  const EDIT_FIELDS = new Set(["load", "reps", "rir", "effort"]);
  // migrateLegacy's only unambiguous flat-field -> metric-map mapping: see the
  // allowedFields loop below (issue #332). rir/effort are intentionally
  // absent; those stay on the flat edited fields for every slot.
  const LEGACY_METRIC_SEMANTIC = Object.freeze({ load: "loadKg", reps: "reps" });
  const EFFORT_RIR = Object.freeze({ easy: 3, hard: 1, max: 0 });
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
  const MAX_TARGET_RIR = 4;
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
    const allowed = new Set(["bodyweightKg", "bodyweightContributionEnabled", "externalLoadMultiplier", "bodyweightCoefficient", "availableLoadsKg", "loadingConvention"]);
    for (const key of Object.keys(value)) if (!allowed.has(key)) issues.push(`${path}.${key}:unknown`);
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

  function validateSet(value, setId, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return;
    }
    if (value.setId !== setId || !isText(value.setId, { max: MAX_ID })) issues.push(`${path}.setId`);
    if (!isSafeInteger(value.ordinal, 1)) issues.push(`${path}.ordinal`);
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
      }
    }
    if (hasOwn(value, "performed")) validateMovementSnapshot(value.performed, `${path}.performed`, issues);
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
        validateMovementSnapshot(value.substitution.original, `${path}.substitution.original`, issues);
        validateMovementSnapshot(value.substitution.replacement, `${path}.substitution.replacement`, issues);
        if (Object.keys(value.substitution).some(key => !["original", "replacement", "selectedAt", "originalPendingSets"].includes(key))) {
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
    if (value.programmed?.sets !== value.setOrder.length) issues.push(`${path}.programmed.sets:coverage`);
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
        const targetRir = spec.targetRir ?? source.targetRir ?? old.rir ?? null;
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
  // RIR above the current 0-4 ceiling (see clampLegacyTargetRir). Clamp it
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
    const draft = deepFreeze(jsonClone(value));
    const mismatch = contextMismatch(draft, currentProgramContext);
    return mismatch
      ? deepFreeze({ kind: "stale", reason: mismatch, draft })
      : deepFreeze({ kind: "valid", draft });
  }

  function serialize(draft) {
    const checked = validate(draft);
    return checked.ok ? jsonClone(draft) : error("invalid-draft", { issues: checked.issues });
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
        if (draft.program.rirMode === "effort") {
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
    if (draft.program.rirMode === "effort") {
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
        if (set.completion !== "pending" || hasTouchedValue(set.touched)) return false;
      }
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
        const set = exercise.sets[setId];
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
      case "editSetField": {
        item = targetSet(next, command);
        if (isDomainError(item)) return item;
        if (!EDIT_FIELDS.has(command.field)) return error("unknown-set-field", { field: command.field });
        const value = editableText(command.value);
        if (value === undefined) return error("invalid-set-field-value", { field: command.field });
        item.set.edited[command.field] = value;
        item.set.touched[command.field === "rir" || command.field === "effort" ? "effort" : command.field] = true;
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
        const issues = [...sessionSaveIssues(next), ...setSaveIssues(next, item.exercise, item.set)];
        if (issues.length) return error("set-not-saveable", { issues });
        item.set.completion = { completedAt: command.completedAt };
        item.set.performed = jsonClone(item.exercise.substitution?.replacement || snapshotFromExercise(item.exercise));
        item.set.touched = { ...item.set.touched, load: true, reps: true, effort: true,
          ...(item.set.touched.metrics ? { metrics: Object.fromEntries(Object.keys(item.set.touched.metrics).map(id => [id, true])) } : {}) };
        break;
      }
      case "uncommitSet": {
        item = targetSet(next, command);
        if (isDomainError(item)) return item;
        item.set.completion = "pending";
        break;
      }
      case "markWarmup":
      case "markWorking": {
        item = targetSet(next, command);
        if (isDomainError(item)) return item;
        item.set.role = command.type === "markWarmup" ? "warmup" : "working";
        break;
      }
      case "skipExercise":
      case "restoreExercise": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        item.exercise.status = command.type === "skipExercise" ? "skipped" : "active";
        if (command.type === "skipExercise" && next.session.selectedExerciseId === item.exercise.exerciseInstanceId) {
          next.session.selectedExerciseId = next.exerciseOrder.find((id) => next.exercises[id].status === "active") ?? null;
        }
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
          replacement: jsonClone(command.replacement),
          selectedAt: command.selectedAt,
        };
        if (command.replacementProgram != null) {
          const program = validateReplacementProgram(command.replacementProgram, command.replacement, exercise.setOrder.length);
          if (!program.ok) return error("invalid-substitution-program", { issues: program.issues });
          // Completed sets keep the composition they were performed under; only
          // untouched pending sets take the replacement's prescriptions.
          const pendingIds = exercise.setOrder.filter(setId => exercise.sets[setId].completion === "pending");
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
            set.programmed = programmedSetFromReplacement(program.value, spec);
            set.edited = { load: editableText(spec.suggestedLoad), reps: editableText(spec.suggestedReps),
              rir: null, effort: null, metrics };
            set.touched = { load: false, reps: false, effort: false,
              metrics: Object.fromEntries(Object.keys(metrics).map(id => [id, false])) };
          }
          substitution.originalPendingSets = originalPendingSets;
        }
        exercise.substitution = substitution;
        exercise.status = "active";
        break;
      }
      case "restoreOriginalExercise": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        const originals = item.exercise.substitution?.originalPendingSets;
        for (const [setId, original] of Object.entries(originals || {})) {
          if (item.exercise.sets[setId]?.completion === "pending") item.exercise.sets[setId] = jsonClone(original);
        }
        item.exercise.substitution = null;
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
    const rir = draft.program.rirMode === "effort"
      ? EFFORT_RIR[effectiveText(set, "effort")]
      : validDecimal(effectiveText(set, "rir"));
    return { load, reps, rir };
  }

  function toHistoryRows(draft, completedAt) {
    const issues = validateForSave(draft);
    if (issues.length) return error("draft-not-saveable", { issues });
    if (!isText(completedAt, { max: 100 })) return error("invalid-completed-at");
    const rows = [];
    for (const exerciseId of draft.exerciseOrder) {
      const exercise = draft.exercises[exerciseId];
      if (exercise.status === "skipped") continue;
      const original = snapshotFromExercise(exercise);
      const current = exercise.substitution?.replacement || original;
      for (const setId of exercise.setOrder) {
        const set = exercise.sets[setId];
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
          setIndex: set.ordinal - 1,
          load: metricBySemantic.has("loadKg") ? metricBySemantic.get("loadKg") : metricDefinitions ? null : values.load,
          reps: metricBySemantic.has("reps") ? metricBySemantic.get("reps") : metricDefinitions ? null : values.reps,
          rir: metricDefinitions
            ? draft.program.rirMode === "effort"
              ? hasOwn(EFFORT_RIR, set.edited.effort) ? EFFORT_RIR[set.edited.effort] : null
              : set.edited.rir == null ? null : validDecimal(set.edited.rir)
            : values.rir,
          notes: draft.session.notes.trim(),
          created: completedAt,
          ...(hasOwn(draft.program, "blockId") ? { blockId: draft.program.blockId } : {}),
          primary: original.primary,
          secondary: original.secondary,
          performedName: performed.displayName,
          performedPrimary: performed.primary,
          performedSecondary: performed.secondary,
        };
        if (metricDefinitions) {
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
          row.metricType = set.programmed.metricType;
          row.restSeconds = Number.isSafeInteger(set.programmed.restSeconds) ? set.programmed.restSeconds : null;
        }
        if (performed.libraryId) row.performedLibraryId = performed.libraryId;
        else if (performed.movementId) row.performedMovementId = performed.movementId;
        if (exercise.setupNotes.trim()) row.exNote = exercise.setupNotes.trim();
        if (set.role === "warmup") row.warmup = true;
        const bodyweight = draft.session.bodyweight;
        if (bodyweight != null && bodyweight !== "") row.bodyweight = Number(bodyweight);
        rows.push(row);
      }
    }
    return rows;
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
    create,
    parse,
    migrateLegacy,
    reduce,
    toHistoryRows,
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
