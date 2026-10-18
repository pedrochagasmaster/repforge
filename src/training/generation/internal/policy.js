/** Shared 073.4 policy validation. Scoped metadata is immutable; construction performs no I/O. */
export function createEnginePolicy() {
"use strict";
const REP_CLASSES = ["first_push_lower", "first_pull", "secondary_push_lower", "secondary_pull", "assistance"];
const GOALS = ["hypertrophy", "strength", "hybrid"];
const TABLES = {
  secondaryStrengthPush: [5, 6, 7, 7, 8, 9, 10],
  low: [3, 4, 5, 5, 6, 7, 8], mid: [6, 8, 8, 9, 10, 11, 12],
  high: [8, 10, 10, 11, 13, 13, 15], accessory: [10, 13, 13, 15, 17, 18, 20],
};
const staticCenters = {
  hypertrophy: [8, 10, 10, 12, 15], strength: [5, 8, 8, 10, 10], hybrid: [5, 8, 10, 12, 15],
};
const tableKeys = {
  hypertrophy: ["mid", "high", "high", "high", "accessory"],
  strength: ["low", "mid", "secondaryStrengthPush", "high", "high"],
  hybrid: ["low", "mid", "high", "high", "accessory"],
};
const freeze = (value) => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const defaults = freeze({
  kind: "taurifer-engine-policy", schemaVersion: 1,
  volume: { setsByType: { primary: 0, secondary: 0, accessory: 0 }, beginnerSetReduction: 0 },
  allocation: { budgetMinutesByCeiling: { 20: 18, 40: 30, 60: 50, 90: 75, 120: 105, 150: 125 },
    compoundFraction: { strength: 0.6, other: 0.5 } },
  prescription: {
    staticRepCenters: Object.fromEntries(GOALS.map(goal => [goal, Object.fromEntries(REP_CLASSES.map((key, i) => [key, staticCenters[goal][i]]))])),
    periodizedRepCenters: Object.fromEntries(GOALS.map(goal => [goal, Object.fromEntries(REP_CLASSES.map((key, i) => [key, [...TABLES[tableKeys[goal][i]]]]))])),
    baseRirByClass: { first_push_lower: 2, first_pull: 1, secondary_push_lower: 2, secondary_pull: 1, assistance: 0 },
    rirAdjustmentsBySetCount: { 1: [0], 2: [0, -1], 3: [1, 0, -1], 4: [1, 0, 0, -1], 5: [1, 0, 0, -1, -1], 6: [1, 1, 0, 0, -1, -1] },
    beginnerRirBonus: 0, restSeconds: { compound: null, accessory: null },
  },
  periodization: { indices: { linear: [6, 6, 4, 3, 2, 0, 0], reverse_linear: [0, 0, 2, 3, 4, 6, 6], undulating: [6, 3, 0, 6, 2, 4, 0] } },
  deload: { setRetention: 0.8, repRetention: 0.8, rirBonus: 3 },
  timeModel: { perExerciseOverheadSeconds: 120, isolationFixedSeconds: 90, compoundFixedSeconds: 180,
    secondsPerSet: 30, coreRestSeconds: 60, isolationRestSeconds: 90, upperRestSeconds: 120, lowerRestSeconds: 180 },
});
const fields = [];
function rule(path, value) {
  if (path.startsWith("volume.setsByType.")) return { min: 0, max: 6, integer: true, unit: "sets", dependency: "0 preserves recovered allocation; override applies before distribution." };
  if (path === "volume.beginnerSetReduction") return { min: 0, max: 2, integer: true, unit: "sets", dependency: "Subtract after allocation/override, retaining at least one set." };
  if (path.startsWith("allocation.budget")) return { min: 1, max: 180, integer: true, unit: "minutes", dependency: "Allocation budget, not a final duration ceiling." };
  if (path.startsWith("allocation.compoundFraction")) return { min: 0.1, max: 0.9, integer: false, unit: "fraction" };
  if (path.includes("RepCenters")) return { min: 3, max: 29, integer: true, unit: "reps", dependency: "Normal rep range is center minus/plus one; deload scales each bound." };
  if (path.startsWith("periodization.indices.")) return { min: 0, max: 6, integer: true, unit: "table index" };
  if (path.includes("rirAdjustments")) return { min: -6, max: 6, integer: true, unit: "RIR", dependency: "Added to role base; zero floor, then beginner and deload bonuses. Final RIR must not exceed 6." };
  if (path.includes("Rir") || path.endsWith("rirBonus")) return { min: 0, max: 6, integer: true, unit: "RIR", dependency: "All base + adjustment + beginner/deload combinations must fit RIR 0–6." };
  if (path.startsWith("deload.")) return { min: 0.1, max: 1, integer: false, unit: "fraction", dependency: "Floor retained count, minimum one; round rep bounds after multiplying." };
  return { min: 0, max: 900, integer: true, nullable: value === null, unit: "seconds", dependency: value === null ? "Null preserves recovered rest and its regional duration fallback." : "Recovered per-template duration model; includes explicit between-set rest." };
}
function describe(value, path = "") {
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => describe(child, path ? `${path}.${key}` : key));
  } else if (path !== "kind" && path !== "schemaVersion") fields.push({ path, label: path.split(".").at(-1).replace(/([a-z])([A-Z])/g, "$1 $2"), default: value, ...rule(path, value) });
}
describe(defaults);
const metadata = freeze({ kind: "taurifer-engine-policy-metadata", schemaVersion: 1, engineVersion: "073.4", repClasses: REP_CLASSES, fields });
const fieldMap = new Map(fields.map(field => [field.path, field]));
const plain = value => !!value && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function normalizeEnginePolicy(input) {
  if (input === undefined) return { ok: true, value: cloneFrozenDefault(), isDefault: true };
  const issues = [];
  const issue = (path, code, message) => issues.push({ path, code, message });
  function visit(value, expected, path) {
    if (expected && typeof expected === "object") {
      const array = Array.isArray(expected);
      if (array ? !Array.isArray(value) : !plain(value) || Array.isArray(value)) {
        issue(path, "invalid_type", array ? "Expected a dense array." : "Expected a plain data object."); return;
      }
      const allowed = new Set(Reflect.ownKeys(expected).filter(key => key !== "length"));
      for (const key of Reflect.ownKeys(value)) {
        if (array && key === "length") continue;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (typeof key !== "string" || ["__proto__", "constructor", "prototype"].includes(key) || !allowed.has(key)) issue(path ? `${path}.${String(key)}` : String(key), "unknown_field", "Unsupported policy field.");
        else if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) issue(`${path}.${String(key)}`, "invalid_data", "Expected enumerable data properties, without accessors.");
      }
      if (array && value.length !== expected.length) issue(path, "invalid_length", `Expected exactly ${expected.length} entries.`);
      const output = array ? [] : {};
      for (const key of allowed) {
        const next = path ? `${path}.${key}` : key;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor) { issue(next, "missing_field", "A complete policy snapshot is required."); continue; }
        if (!("value" in descriptor)) continue;
        output[key] = visit(descriptor.value, expected[key], next);
      }
      return output;
    }
    if (path === "kind" || path === "schemaVersion") {
      if (value !== expected) issue(path, "unsupported_policy", `Expected ${expected}.`);
      return value;
    }
    const field = fieldMap.get(path);
    if (value === null && field.nullable) return null;
    if (typeof value !== "number" || !Number.isFinite(value) || field.integer && !Number.isInteger(value)
      || value < field.min || value > field.max) issue(path, "invalid_number", `Expected ${field.integer ? "an integer" : "a number"} from ${field.min} to ${field.max}${field.nullable ? ", or null" : ""}.`);
    return Object.is(value, -0) ? 0 : value;
  }
  let value;
  try { value = visit(input, defaults, ""); }
  catch { issue("", "invalid_data", "Expected a plain policy data snapshot."); }
  if (!issues.length) {
    for (const repClass of REP_CLASSES) {
      const base = value.prescription.baseRirByClass[repClass];
      const bonus = value.prescription.beginnerRirBonus + value.deload.rirBonus;
      if (Object.values(value.prescription.rirAdjustmentsBySetCount).some(adjustments => adjustments.some(delta => Math.max(0, base + delta) + bonus > 6))) {
        issue(`prescription.baseRirByClass.${repClass}`, "rir_overflow", "Base RIR plus set adjustment, beginnerRirBonus and deload.rirBonus must not exceed 6; lower one of these fields.");
      }
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, value: freeze(value), isDefault: JSON.stringify(value) === JSON.stringify(defaults) };
}
function cloneFrozenDefault() { return freeze(clone(defaults)); }
return Object.freeze({ normalizeEnginePolicy, getDefaultEnginePolicy: cloneFrozenDefault, getEnginePolicyMetadata: () => metadata });
}
export const getDefaultEnginePolicy=()=>createEnginePolicy().getDefaultEnginePolicy();
export const normalizeEnginePolicy=(input)=>createEnginePolicy().normalizeEnginePolicy(input);
export const getEnginePolicyMetadata=()=>createEnginePolicy().getEnginePolicyMetadata();
