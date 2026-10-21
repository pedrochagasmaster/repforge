import assert from "node:assert/strict";
import { createRequire } from "node:module";
export default async function runProof() {
const require = createRequire(import.meta.url);
const Policy = require("../../engine-policy.js");
const defaults = Policy.getDefaultEnginePolicy();
assert.equal(Policy.normalizeEnginePolicy().isDefault, true);
assert.equal(Policy.normalizeEnginePolicy(defaults).isDefault, true);
assert.ok(Object.isFrozen(defaults.prescription.baseRirByClass));
const copy = structuredClone(defaults);
const normalized = Policy.normalizeEnginePolicy(copy);
copy.volume.setsByType.primary = 2;
assert.equal(normalized.value.volume.setsByType.primary, 0);
for (const value of [null, {}, { ...defaults, unknown: 1 }, { ...defaults, schemaVersion: 99 }]) {
  assert.equal(Policy.normalizeEnginePolicy(value).ok, false);
}
for (const mutate of [
  p => { delete p.volume.setsByType.primary; },
  p => { p.volume.setsByType.primary = "2"; },
  p => { p.timeModel.secondsPerSet = Infinity; },
  p => { p.periodization.indices.linear[0] = 7; },
  p => { delete p.periodization.indices.linear[0]; },
  p => { p.prescription.rirAdjustmentsBySetCount[2].push(0); },
  p => { p.prescription.baseRirByClass.first_push_lower = 4; },
  p => { Object.defineProperty(p.volume, "evil", { get() { throw new Error("must not invoke getters"); }, enumerable: true }); },
  p => { p.volume = Object.create({ inherited: true }); },
  p => { Object.defineProperty(p.volume, "__proto__", { value: {}, enumerable: true }); },
]) {
  const policy = structuredClone(defaults); mutate(policy);
  assert.equal(Policy.normalizeEnginePolicy(policy).ok, false);
}
const negativeZero = structuredClone(defaults);
negativeZero.volume.setsByType.primary = -0;
assert.equal(Object.is(Policy.normalizeEnginePolicy(negativeZero).value.volume.setsByType.primary, -0), false);
assert.ok(Policy.getEnginePolicyMetadata().fields.every(field => typeof field.path === "string" && "default" in field));
console.log("complete native policies validate, freeze, detach, and reject unsafe or out-of-schema dose combinations");

}
