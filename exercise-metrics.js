(function (root) {
  "use strict";

  const DEFINITIONS = Object.freeze([
    Object.freeze({ id: "2555c6f170d8805cafa6d16d3fdddbaa", sourceName: "Weight", semantic: "loadKg", unit: "kg" }),
    Object.freeze({ id: "2555c6f170d880e6b760f2286b2b2d76", sourceName: "Assistance weight", semantic: "assistanceKg", unit: "kg" }),
    Object.freeze({ id: "2555c6f170d88072bbf6d9ad3f16ea86", sourceName: "Reps", semantic: "reps", unit: "reps" }),
    Object.freeze({ id: "2555c6f170d88063941ef7c8956d760c", sourceName: "Duration", semantic: "durationSeconds", unit: "seconds" }),
    Object.freeze({ id: "25a5c6f170d88022b3b4ef4ae5fe7571", sourceName: "Distance short", semantic: "distanceShortMeters", unit: "metres" }),
    Object.freeze({ id: "25a5c6f170d880aa9232e07fc8128d85", sourceName: "Distance long", semantic: "distanceLongMeters", unit: "metres" }),
    Object.freeze({ id: "25a5c6f170d880e2990fc88146f7de56", sourceName: "Weight per side", semantic: "loadPerSideKg", unit: "kg" }),
    Object.freeze({ id: "25a5c6f170d880baaa2dc8c7b67d4b65", sourceName: "Reps per side", semantic: "repsPerSide", unit: "reps" }),
    Object.freeze({ id: "25a5c6f170d880229a4ed6ee87958e18", sourceName: "Duration per side", semantic: "durationPerSideSeconds", unit: "seconds" }),
    Object.freeze({ id: "25a5c6f170d8803aa6fdc6f2535f9c5c", sourceName: "Weight per side persistent", semantic: "persistentLoadPerSideKg", unit: "kg" }),
    Object.freeze({ id: "25a5c6f170d88092bcead56f9fe8247e", sourceName: "Distance short per side", semantic: "distanceShortPerSideMeters", unit: "metres" }),
  ]);
  const BY_ID = new Map(DEFINITIONS.map((entry) => [entry.id, entry]));
  const BY_NAME = new Map(DEFINITIONS.map((entry) => [entry.sourceName, entry]));
  const SOURCE_COMPOSITIONS = Object.freeze([
    ["25a5c6f170d880baaa2dc8c7b67d4b65", "25a5c6f170d880e2990fc88146f7de56"],
    ["2555c6f170d8805cafa6d16d3fdddbaa", "2555c6f170d88072bbf6d9ad3f16ea86"],
    ["2555c6f170d8805cafa6d16d3fdddbaa", "25a5c6f170d880baaa2dc8c7b67d4b65"],
    ["2555c6f170d88072bbf6d9ad3f16ea86"],
    ["2555c6f170d88063941ef7c8956d760c", "25a5c6f170d880aa9232e07fc8128d85"],
    ["2555c6f170d8805cafa6d16d3fdddbaa", "25a5c6f170d88092bcead56f9fe8247e"],
    [],
    ["25a5c6f170d880baaa2dc8c7b67d4b65"],
    ["2555c6f170d8805cafa6d16d3fdddbaa", "2555c6f170d88063941ef7c8956d760c"],
    ["25a5c6f170d8803aa6fdc6f2535f9c5c", "25a5c6f170d880baaa2dc8c7b67d4b65"],
    ["2555c6f170d8805cafa6d16d3fdddbaa", "25a5c6f170d88022b3b4ef4ae5fe7571"],
    ["2555c6f170d88072bbf6d9ad3f16ea86", "2555c6f170d880e6b760f2286b2b2d76"],
    ["2555c6f170d88063941ef7c8956d760c"],
    ["25a5c6f170d880229a4ed6ee87958e18"],
    ["2555c6f170d88072bbf6d9ad3f16ea86", "25a5c6f170d880e2990fc88146f7de56"],
    ["2555c6f170d8805cafa6d16d3fdddbaa", "25a5c6f170d880229a4ed6ee87958e18"],
    ["25a5c6f170d88022b3b4ef4ae5fe7571", "25a5c6f170d880e2990fc88146f7de56"],
    ["25a5c6f170d880229a4ed6ee87958e18", "25a5c6f170d8803aa6fdc6f2535f9c5c"],
  ].map((ids) => Object.freeze(ids)));
  const COMPOSITION_KEYS = new Set(SOURCE_COMPOSITIONS.map((ids) => JSON.stringify(ids)));
  const TARGET_KEYS = Object.freeze(DEFINITIONS.map((entry) => entry.semantic));
  const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  const finite = (value) => typeof value === "number" && Number.isFinite(value);

  function definitionsForIds(metricIds) {
    if (!Array.isArray(metricIds)) return { ok: false, value: [], issues: ["metricIds: expected an array"] };
    const issues = [];
    const seen = new Set();
    const value = [];
    metricIds.forEach((id, index) => {
      const definition = BY_ID.get(id);
      if (!definition) {
        issues.push(`metricIds[${index}]: unknown source metric ID`);
        return;
      }
      if (seen.has(id)) issues.push(`metricIds[${index}]: repeated source metric ID`);
      seen.add(id);
      value.push({ ...definition });
    });
    if (!issues.length && !COMPOSITION_KEYS.has(JSON.stringify(metricIds))) {
      issues.push("metricIds: unsupported source composition");
    }
    return { ok: issues.length === 0, value, issues };
  }

  function validateMetricDefinition(definition) {
    if (!isPlainObject(definition)) return { ok: false, value: null, issues: ["metricDefinition: expected an object"] };
    const canonical = BY_ID.get(definition.id);
    const issues = [];
    if (!canonical) issues.push("metricDefinition.id: unknown source metric ID");
    else for (const key of ["sourceName", "semantic", "unit"]) {
      if (definition[key] !== canonical[key]) issues.push(`metricDefinition.${key}: does not match the canonical source metric`);
    }
    if (Object.keys(definition).some((key) => !["id", "sourceName", "semantic", "unit"].includes(key))) {
      issues.push("metricDefinition: unsupported field");
    }
    return issues.length ? { ok: false, value: null, issues } : { ok: true, value: { ...canonical }, issues: [] };
  }

  function parseMetricValue(definition, value) {
    const checked = validateMetricDefinition(definition);
    if (!checked.ok) return { ok: false, value: null, issues: checked.issues };
    if (value == null || value === "") return { ok: true, value: null };
    const numeric = typeof value === "number" ? value
      : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
    if (!finite(numeric) || numeric < 0) return { ok: false, value: null, issues: ["metricValue: expected a finite nonnegative number"] };
    const semantic = checked.value.semantic;
    if (semantic === "reps" || semantic === "repsPerSide") {
      if (!Number.isSafeInteger(numeric) || numeric <= 0) return { ok: false, value: null, issues: ["metricValue: repetitions must be a positive integer"] };
    } else if (semantic.startsWith("duration") || semantic.startsWith("distance")) {
      if (numeric <= 0 || numeric > 10000000) return { ok: false, value: null, issues: ["metricValue: duration and distance must be positive and bounded"] };
    } else if (numeric > 1000) return { ok: false, value: null, issues: ["metricValue: load must not exceed 1000 kg"] };
    return { ok: true, value: numeric };
  }

  function validateDefinitions(metricIds, definitions, options = {}) {
    const allowEmpty = options.allowEmpty === true;
    const expected = definitionsForIds(metricIds);
    const issues = [...expected.issues];
    if (!allowEmpty && Array.isArray(metricIds) && metricIds.length === 0) issues.push("metricIds: at least one metric is required");
    if (!Array.isArray(definitions)) return { ok: false, issues: [...issues, "metricDefinitions: expected an array"] };
    if (definitions.length !== expected.value.length) issues.push("metricDefinitions: count differs from metricIds");
    for (let index = 0; index < Math.min(definitions.length, expected.value.length); index += 1) {
      const actual = definitions[index];
      const canonical = expected.value[index];
      if (!isPlainObject(actual)) {
        issues.push(`metricDefinitions[${index}]: expected a definition object`);
        continue;
      }
      for (const key of ["id", "sourceName", "semantic", "unit"]) {
        if (actual[key] !== canonical[key]) issues.push(`metricDefinitions[${index}].${key}: does not match the canonical source metric`);
      }
      if (Object.keys(actual).some((key) => !["id", "sourceName", "semantic", "unit"].includes(key))) {
        issues.push(`metricDefinitions[${index}]: unsupported field`);
      }
    }
    return { ok: issues.length === 0, issues };
  }

  function validateRawIds(metricIds, uuidIndex, options = {}) {
    const base = definitionsForIds(metricIds);
    const issues = [...base.issues];
    if (!isPlainObject(uuidIndex)) return { ok: false, issues: [...issues, "uuidIndex: expected an object"] };
    for (const definition of base.value) {
      const raw = uuidIndex[definition.id];
      if (!raw || raw.type !== "exerciseMetric" || raw.name !== definition.sourceName) {
        issues.push(`metricIds.${definition.id}: source UUID does not match the canonical exerciseMetric`);
      }
    }
    if (options.allowEmpty !== true && Array.isArray(metricIds) && metricIds.length === 0) issues.push("metricIds: at least one metric is required");
    return { ok: issues.length === 0, issues };
  }

  function validateTargets(metricIds, targets, options = {}) {
    const expected = definitionsForIds(metricIds);
    const issues = [...expected.issues];
    if (!isPlainObject(targets)) return { ok: false, issues: [...issues, "targets: expected a record"] };
    const allowed = new Set(expected.value.map((entry) => entry.semantic));
    for (const [key, value] of Object.entries(targets)) {
      if (!allowed.has(key)) issues.push(`targets.${key}: target has no matching source metric`);
      else if (!validTargetForSemantic(key, value)) issues.push(`targets.${key}: invalid canonical target`);
    }
    if (options.requireTargets === true && expected.value.some((entry) => !Object.prototype.hasOwnProperty.call(targets, entry.semantic))) {
      issues.push("targets: every source metric needs an explicit authored target");
    }
    return { ok: issues.length === 0, issues };
  }

  function validateMetricValues(metricIds, metricValues, options = {}) {
    const expected = definitionsForIds(metricIds);
    const issues = [...expected.issues];
    if (!Array.isArray(metricValues)) return { ok: false, issues: [...issues, "metricValues: expected an array"] };
    if (metricValues.length !== expected.value.length) issues.push("metricValues: count differs from the source metric composition");
    for (let index = 0; index < Math.min(metricValues.length, expected.value.length); index += 1) {
      const actual = metricValues[index];
      const definition = expected.value[index];
      if (!isPlainObject(actual)) {
        issues.push(`metricValues[${index}]: expected a value record`);
        continue;
      }
      if (actual.metricId !== definition.id) issues.push(`metricValues[${index}].metricId: source order differs`);
      if (actual.unit !== definition.unit) issues.push(`metricValues[${index}].unit: does not match canonical unit`);
      if (typeof actual.value !== "number" || !finite(actual.value)) issues.push(`metricValues[${index}].value: performed values must be finite numbers`);
      const parsed = parseMetricValue(definition, actual.value);
      if (!parsed.ok) issues.push(`metricValues[${index}].value: ${parsed.issues.join("; ")}`);
      if (Object.keys(actual).some((key) => !["metricId", "value", "unit"].includes(key))) issues.push(`metricValues[${index}]: unsupported field`);
    }
    if (options.allowEmpty !== true && expected.value.length === 0) issues.push("metricValues: no metric definitions are available");
    return { ok: issues.length === 0, issues };
  }

  function validateExerciseSourceBinding({
    metricOrigin,
    metricIds,
    metricDefinitions,
    sourceId,
    sourceExercise,
    bodyweightCoefficient,
  } = {}) {
    const issues = [];
    const definitions = validateDefinitions(metricIds, metricDefinitions, { allowEmpty: true });
    issues.push(...definitions.issues);
    if (!Array.isArray(metricIds) || !Array.isArray(metricDefinitions)) {
      return { ok: false, issues };
    }
    const hasComposition = metricIds.length > 0 || metricDefinitions.length > 0;
    if (!hasComposition && metricOrigin == null) return { ok: issues.length === 0, issues };
    if (metricOrigin !== "source_catalog" && metricOrigin !== "user_defined") {
      issues.push("metricOrigin: expected source_catalog or user_defined");
      return { ok: false, issues };
    }
    if (typeof sourceId !== "string" || sourceId.length === 0) {
      issues.push("sourceId: expected an exact library identity");
      return { ok: false, issues };
    }
    if (sourceExercise != null && (!isPlainObject(sourceExercise) || sourceExercise.id !== sourceId)) {
      issues.push("sourceExercise: identity differs from sourceId");
      return { ok: false, issues };
    }
    const coefficient = bodyweightCoefficient === undefined ? null : bodyweightCoefficient;
    if (coefficient !== null && (typeof coefficient !== "number" || !finite(coefficient) || coefficient < 0 || coefficient > 1)) {
      issues.push("bodyweightCoefficient: expected null or a number from 0 through 1");
    }
    if (sourceExercise) {
      const sourceCoefficient = typeof sourceExercise.bodyweight === "number" && finite(sourceExercise.bodyweight)
        ? sourceExercise.bodyweight : null;
      if (coefficient !== sourceCoefficient) {
        issues.push("bodyweightCoefficient: differs from the raw catalog exercise");
      }
    }

    if (metricOrigin === "source_catalog") {
      if (!sourceExercise || !Array.isArray(sourceExercise.exerciseMetrics) || sourceExercise.exerciseMetrics.length === 0) {
        issues.push("source_catalog: expected a metric-bearing raw catalog exercise");
      } else if (JSON.stringify(metricIds) !== JSON.stringify(sourceExercise.exerciseMetrics)) {
        issues.push("metricIds: differ from the raw catalog exercise composition");
      }
    } else {
      const customIdentity = sourceId.startsWith("custom:");
      const metriclessCatalogExercise = sourceExercise && Array.isArray(sourceExercise.exerciseMetrics) &&
        sourceExercise.exerciseMetrics.length === 0;
      if (!customIdentity && !metriclessCatalogExercise) {
        issues.push("user_defined: allowed only for custom or metricless catalog exercises");
      }
    }
    return { ok: issues.length === 0, issues };
  }

  function validTargetForSemantic(semantic, value) {
    const positiveInteger = semantic === "reps" || semantic === "repsPerSide";
    const positive = semantic.startsWith("duration") || semantic.startsWith("distance");
    const validNumber = (candidate) => finite(candidate)
      && (positiveInteger ? Number.isSafeInteger(candidate) && candidate > 0 : positive ? candidate > 0 : candidate >= 0)
      && (!(["loadKg", "loadPerSideKg", "persistentLoadPerSideKg", "assistanceKg"].includes(semantic)) || candidate <= 1000)
      && (!positive || candidate <= 10000000);
    if (validNumber(value)) return true;
    return isPlainObject(value) && Object.keys(value).length === 2
      && Object.hasOwn(value, "min") && Object.hasOwn(value, "max")
      && validNumber(value.min) && validNumber(value.max) && value.max >= value.min;
  }

  function byName(sourceName) {
    const value = BY_NAME.get(sourceName);
    return value ? { ...value } : null;
  }

  const api = Object.freeze({
    VERSION: 1,
    DEFINITIONS,
    SOURCE_COMPOSITIONS,
    TARGET_KEYS,
    definitionsForIds,
    validateMetricDefinition,
    parseMetricValue,
    validateDefinitions,
    validateRawIds,
    validateTargets,
    validateMetricValues,
    validateExerciseSourceBinding,
    byName,
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.RepForgeExerciseMetrics = api;
})(typeof window !== "undefined" ? window : globalThis);
