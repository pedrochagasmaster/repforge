/** Safe JSON and current ProgramDefinition boundary properties. */
import fc from "fast-check";
import { loadDomain } from "../adapters/domain-adapter.mjs";
import { payloadArbitrary } from "../arbitraries/setup-payload.mjs";
import { hostileNumber, intIn } from "../arbitraries/numbers.mjs";
import { jsonJunkArbitrary, applyMutationOp, mutationOpArbitrary } from "../arbitraries/malformed.mjs";
import { stableStringify, containsNonFiniteNumber } from "../model/canonicalize.mjs";

const domain = loadDomain();
const { Setup } = domain;
const OPTS = domain.opts();

const NUMERIC_SLOTS = Object.freeze([
  { path: ["settings", "jumpPct"], min: 0, max: 100, integer: false },
  { path: ["settings", "minJump"], min: 0.01, max: 1000, integer: false },
  { path: ["settings", "restSec"], min: 0, max: 86400, integer: true },
  { path: ["program", "definition", "cycles"], min: 1, max: 12, integer: true },
  { path: ["program", "definition", "days", 0, "order"], min: 1, max: 7, integer: true, exact: 1 },
  { path: ["program", "definition", "days", 0, "slots", 0, "order"], min: 1, max: 1000, integer: true, exact: 1 },
  { path: ["program", "definition", "days", 0, "slots", 0, "prescriptionsByCycle", 0, "cycleIndex"], min: 1, max: 12, integer: true, exact: 1 },
  { path: ["program", "definition", "days", 0, "slots", 0, "prescriptionsByCycle", 0, "sets", 0, "setIndex"], min: 1, max: 1000, integer: true, exact: 1 },
  { path: ["program", "definition", "days", 0, "slots", 0, "prescriptionsByCycle", 0, "sets", 0, "rir"], min: 0, max: 4, integer: false, nullable: true },
  { path: ["program", "definition", "days", 0, "slots", 0, "prescriptionsByCycle", 0, "sets", 0, "restSeconds"], min: 0, max: 86400, integer: true, nullable: true },
]);

function setPath(value, path, next) {
  let cursor = value;
  for (const segment of path.slice(0, -1)) cursor = cursor[segment];
  cursor[path.at(-1)] = next;
}

function getPath(value, path) {
  return path.reduce((current, segment) => current?.[segment], value);
}

export function buildSuites() {
  return [
    {
      name: "schema: hostile numeric values are rejected or remain finite and bounded at current slots",
      property: fc.property(payloadArbitrary(), fc.constantFrom(...NUMERIC_SLOTS), hostileNumber(), (payload, slot, hostile) => {
        const poisoned = structuredClone(payload);
        setPath(poisoned, slot.path, hostile);
        let result;
        try { result = Setup.validate(poisoned, OPTS); }
        catch (error) { throw new Error(`validate threw at ${slot.path.join(".")}: ${error.message}`); }
        if (!result.ok) return;
        const accepted = getPath(result.value, slot.path);
        if (slot.nullable && accepted === null) return;
        if (typeof accepted !== "number" || !Number.isFinite(accepted)) throw new Error(`${slot.path.join(".")} accepted ${String(accepted)}`);
        if (accepted < slot.min || accepted > slot.max || (slot.integer && !Number.isInteger(accepted))) {
          throw new Error(`${slot.path.join(".")} accepted out-of-range ${accepted}`);
        }
        if (slot.exact !== undefined && accepted !== slot.exact) {
          throw new Error(`${slot.path.join(".")} accepted out-of-order value ${accepted}, expected ${slot.exact}`);
        }
        if (containsNonFiniteNumber(result.value)) throw new Error("canonical proposal contains a non-finite number");
      }),
    },
    {
      name: "schema: arbitrary JSON junk returns a typed answer without mutation",
      property: fc.property(jsonJunkArbitrary(), (junk) => {
        const before = stableStringify(junk);
        let result;
        try { result = Setup.validate(junk, OPTS); }
        catch (error) { throw new Error(`validate threw on JSON junk: ${error.message}`); }
        if (typeof result?.ok !== "boolean") throw new Error("validation omitted its boolean result");
        if (!result.ok && typeof result.code !== "string") throw new Error("validation failure omitted its typed code");
        if (stableStringify(junk) !== before) throw new Error("validation mutated JSON junk");
        if (result.ok) {
          const again = Setup.validate(result.value, OPTS);
          if (!again.ok || stableStringify(again.value) !== stableStringify(result.value)) throw new Error("accepted junk was not canonical");
        }
      }),
    },
    {
      name: "schema: prototype-dangerous keys at any payload position are rejected without pollution",
      property: fc.asyncProperty(payloadArbitrary(), mutationOpArbitrary(), fc.constantFrom("__proto__", "prototype", "constructor"), async (payload, op, keyName) => {
        const topLevel = structuredClone(payload);
        const forged = JSON.parse(`{"${keyName}":{"polluted":true}}`);
        Object.defineProperty(topLevel, keyName, { value: forged[keyName], enumerable: true, writable: true, configurable: true });
        const direct = Setup.validate(topLevel, OPTS);
        if (direct.ok || direct.code !== "invalid-schema") throw new Error(`top-level ${keyName} was not refused as invalid-schema`);
        const { value: nested, applied } = applyMutationOp(payload, { ...op, op: "forbidden-key", forbiddenKey: keyName });
        if (applied) {
          const result = Setup.validate(nested, OPTS);
          if (result.ok || result.code !== "invalid-schema") throw new Error(`nested ${keyName} was not refused as invalid-schema`);
        }
        if (Object.prototype.polluted === true) throw new Error("prototype pollution escaped validation");
      }),
    },
    {
      name: "schema: document version fuzzing is typed and only version 2 is accepted",
      property: fc.property(payloadArbitrary(), jsonJunkArbitrary(), (payload, versionJunk) => {
        const candidate = structuredClone(payload);
        candidate.version = versionJunk;
        const result = Setup.validate(candidate, OPTS);
        if (versionJunk === 2) {
          if (!result.ok) throw new Error(`current semantic version rejected: ${result.code}`);
        } else if (result.ok || !["unsupported-version", "invalid-schema"].includes(result.code)) {
          throw new Error(`untyped or accepted document version ${String(versionJunk)}: ${result.code}`);
        }
      }),
    },
    {
      name: "schema: deeply nested bounded values fail safely through the v4 writer",
      property: fc.asyncProperty(intIn(2, 9), async (nesting) => {
        const deep = { kind: "taurifer-shared-setup", version: 2 };
        let cursor = deep;
        for (let index = 0; index < nesting * 12; index += 1) {
          cursor.nested = {};
          cursor = cursor.nested;
        }
        let result;
        try { result = await Setup.encode(deep, OPTS); }
        catch (error) { throw new Error(`encode threw on nested input: ${error.message}`); }
        if (result.ok || result.code !== "invalid-schema") throw new Error(`invalid nested proposal returned ${result.code}`);
      }),
    },
  ];
}
