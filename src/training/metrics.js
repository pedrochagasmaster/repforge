/** @typedef {{id:string,sourceName:string,semantic:string,unit:string}} MetricDefinition */
/** @typedef {{ok:true,value:MetricDefinition,issues:string[]}|{ok:false,value:null,issues:string[]}} DefinitionResult */
/** @typedef {{ok:true,value:number|null}|{ok:false,value:null,issues:string[]}} MetricValueResult */
"use strict";

/** @type {readonly Readonly<MetricDefinition>[]} */
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
/** @type {Map<string,Readonly<MetricDefinition>>} */
const BY_ID = new Map(DEFINITIONS.map((entry) => [entry.id, entry]));
/** @type {Map<string,Readonly<MetricDefinition>>} */
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
/** @param {unknown} value @returns {value is Record<string,unknown>} */
const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
/** @param {unknown} value @returns {value is number} */
const finite = (value) => typeof value === "number" && Number.isFinite(value);

/** @param {unknown} metricIds @returns {{ok:boolean,value:MetricDefinition[],issues:string[]}} */
function definitionsForIds(metricIds) {
  if (!Array.isArray(metricIds)) return { ok: false, value: [], issues: ["metricIds: expected an array"] };
  const issues = [];
  const seen = new Set();
  /** @type {MetricDefinition[]} */
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

/** @param {unknown} definition @returns {DefinitionResult} */
function validateMetricDefinition(definition) {
  if (!isPlainObject(definition)) return { ok: false, value: null, issues: ["metricDefinition: expected an object"] };
  const canonical = typeof definition.id === "string" ? BY_ID.get(definition.id) : undefined;
  const issues = [];
  if (!canonical) issues.push("metricDefinition.id: unknown source metric ID");
  else for (const key of /** @type {(keyof MetricDefinition)[]} */ (["sourceName", "semantic", "unit"])) {
    if (definition[key] !== canonical[key]) issues.push(`metricDefinition.${key}: does not match the canonical source metric`);
  }
  if (Object.keys(definition).some((key) => !["id", "sourceName", "semantic", "unit"].includes(key))) {
    issues.push("metricDefinition: unsupported field");
  }
  return issues.length ? { ok: false, value: null, issues } : { ok: true, value: { .../** @type {MetricDefinition} */ (canonical) }, issues: [] };
}

/** @param {unknown} definition @param {unknown} value @returns {MetricValueResult} */
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

/** @param {unknown} metricIds @param {unknown} definitions @param {{allowEmpty?:boolean}} [options] */
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
    for (const key of /** @type {(keyof MetricDefinition)[]} */ (["id", "sourceName", "semantic", "unit"])) {
      if (actual[key] !== canonical[key]) issues.push(`metricDefinitions[${index}].${key}: does not match the canonical source metric`);
    }
    if (Object.keys(actual).some((key) => !["id", "sourceName", "semantic", "unit"].includes(key))) {
      issues.push(`metricDefinitions[${index}]: unsupported field`);
    }
  }
  return { ok: issues.length === 0, issues };
}

/** @param {unknown} metricIds @param {unknown} uuidIndex @param {{allowEmpty?:boolean}} [options] */
function validateRawIds(metricIds, uuidIndex, options = {}) {
  const base = definitionsForIds(metricIds);
  const issues = [...base.issues];
  if (!isPlainObject(uuidIndex)) return { ok: false, issues: [...issues, "uuidIndex: expected an object"] };
  for (const definition of base.value) {
    const raw = uuidIndex[definition.id];
    if (!isPlainObject(raw) || raw.type !== "exerciseMetric" || raw.name !== definition.sourceName) {
      issues.push(`metricIds.${definition.id}: source UUID does not match the canonical exerciseMetric`);
    }
  }
  if (options.allowEmpty !== true && Array.isArray(metricIds) && metricIds.length === 0) issues.push("metricIds: at least one metric is required");
  return { ok: issues.length === 0, issues };
}

/** @param {unknown} metricIds @param {unknown} targets @param {{requireTargets?:boolean}} [options] */
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

/** @param {unknown} metricIds @param {unknown} metricValues @param {{allowEmpty?:boolean}} [options] */
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

/** @param {{metricOrigin?:unknown,metricIds?:unknown,metricDefinitions?:unknown,sourceId?:unknown,sourceExercise?:Record<string,unknown>|null,bodyweightCoefficient?:unknown}} [input] */
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

export const POUNDS_PER_KG=2.2046226218;
const LB=POUNDS_PER_KG;
const LOAD_RAW=/^\d+(?:[.,]\d+)?$/,MAX_LOAD_KG=1000,MAX_LOAD_LB=MAX_LOAD_KG*LB;
/** @param {unknown} raw @param {string} [unit] */
function parseLoadInput(raw,unit="kg"){
const s=String(raw??"").trim();
if(!s)return{kind:"empty"};
if(!LOAD_RAW.test(s))return{kind:"invalid"};
const display=+s.replace(",",".");
if(!Number.isFinite(display)||!(display>0))return{kind:"invalid"};
if(unit==="lb"){
  if(display>MAX_LOAD_LB)return{kind:"invalid"};
  if(display===MAX_LOAD_LB)return{kind:"valid",kg:MAX_LOAD_KG};
  const kg=display/LB;
  if(kg>MAX_LOAD_KG)return{kind:"invalid"};
  return{kind:"valid",kg}}
if(display>MAX_LOAD_KG)return{kind:"invalid"};
return{kind:"valid",kg:display}}

/** @param {string} semantic @param {unknown} value */
function validTargetForSemantic(semantic, value) {
  const positiveInteger = semantic === "reps" || semantic === "repsPerSide";
  const positive = semantic.startsWith("duration") || semantic.startsWith("distance");
  /** @param {unknown} candidate @returns {candidate is number} */
  const validNumber = (candidate) => finite(candidate)
    && (positiveInteger ? Number.isSafeInteger(candidate) && candidate > 0 : positive ? candidate > 0 : candidate >= 0)
    && (!(["loadKg", "loadPerSideKg", "persistentLoadPerSideKg", "assistanceKg"].includes(semantic)) || candidate <= 1000)
    && (!positive || candidate <= 10000000);
  if (validNumber(value)) return true;
  return isPlainObject(value) && Object.keys(value).length === 2
    && Object.hasOwn(value, "min") && Object.hasOwn(value, "max")
    && validNumber(value.min) && validNumber(value.max) && value.max >= value.min;
}

/** @param {string} sourceName */
function byName(sourceName) {
  const value = BY_NAME.get(sourceName);
  return value ? { ...value } : null;
}

/** Decimal keyboard parsing shared by input canonicalizers. @param {unknown} value */
export function parseDecimalInput(value) {
  if(typeof value==="number")return Number.isFinite(value)?value:NaN;
  if(value==null||value==="")return NaN;
  const n=Number(String(value).trim().replace(/(\d),(\d)/g,"$1.$2"));
  return Number.isFinite(n)?n:NaN;
}
/** Preserve full precision while expanding the exponent notation DraftV2 rejects.
 * @param {unknown} value */
export function canonicalNumberText(value) {
  const n=Number(value);if(!Number.isFinite(n))return "";
  const raw=String(n);if(!/[eE]/.test(raw))return raw;
  const sign=raw.startsWith("-")?"-":"",unsigned=raw.replace(/^[+-]/,"");
  const [coefficient,exponentText]=unsigned.toLowerCase().split("e"),exponent=Number(exponentText);
  const [whole,fraction=""]=coefficient.split("."),digits=whole+fraction,point=whole.length+exponent;
  if(point<=0)return `${sign}0.${"0".repeat(-point)}${digits}`;
  if(point>=digits.length)return `${sign}${digits}${"0".repeat(point-digits.length)}`;
  return `${sign}${digits.slice(0,point)}.${digits.slice(point)}`;
}
/** @param {number} value @param {string} [unit] */
export function metricKgFromDisplay(value,unit="kg") {
  const kg=unit==="lb"?value/LB:value;
  return kg>1000&&kg-1000<1e-9?1000:kg;
}
/** Invalid input stays text for field feedback; only valid values become storage text.
 * @param {string} field @param {unknown} value @param {string} [unit] */
export function canonicalDraftField(field,value,unit="kg") {
  const raw=String(value??"");
  if(field==="load"){const parsed=parseLoadInput(raw,unit);return parsed.kind==="valid"?canonicalNumberText(parsed.kg):raw;}
  const n=parseDecimalInput(raw);
  if(field==="reps")return Number.isFinite(n)&&n>0&&Number.isInteger(n)?String(n):raw;
  if(field==="rir")return Number.isFinite(n)&&n>=0?canonicalNumberText(n):raw;
  return raw;
}
/** @param {{semantic:string}} metric @param {unknown} raw @param {string} [unit] */
export function canonicalMetricInput(metric,raw,unit="kg") {
  const text=String(raw??"");if(text.trim()==="")return "";
  const parsed=parseDecimalInput(text);if(!Number.isFinite(parsed))return text;
  const value=["loadKg","assistanceKg","loadPerSideKg","persistentLoadPerSideKg"].includes(metric.semantic)
    ?metricKgFromDisplay(parsed,unit):parsed;
  return canonicalNumberText(value);
}

const api = Object.freeze({
  VERSION: 1,
  parseDecimalInput,canonicalNumberText,metricKgFromDisplay,canonicalDraftField,canonicalMetricInput,
  DEFINITIONS,
  SOURCE_COMPOSITIONS,
  TARGET_KEYS,
  definitionsForIds,
  validateMetricDefinition,
  parseMetricValue,
  parseLoadInput,
  validateDefinitions,
  validateRawIds,
  validateTargets,
  validateMetricValues,
  validateExerciseSourceBinding,
  byName,
});
const VERSION = api.VERSION;

export { VERSION, DEFINITIONS, SOURCE_COMPOSITIONS, TARGET_KEYS, definitionsForIds, validateMetricDefinition, parseMetricValue, parseLoadInput, validateDefinitions, validateRawIds, validateTargets, validateMetricValues, validateExerciseSourceBinding, byName };
export default api;

/** Shipped Epley estimate; nonpositive load/reps have no strength estimate.
 * @param {number} load @param {number} reps
 */
export function estimateOneRepMax(load,reps){return load>0&&reps>0?load*(1+reps/30):0}
