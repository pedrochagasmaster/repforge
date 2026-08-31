import { createRequire } from "node:module";
import fc from "fast-check";

const require = createRequire(import.meta.url);
const Compiler = require("../../../program-compiler.js");
const { EXERCISE_LIBRARY } = require("../../../exercises.js");

const family = fc.constantFrom(...Compiler.FAMILY_IDS);
const frequency = fc.constantFrom(...Compiler.FREQUENCIES);
const minutes = fc.integer({ min: 10, max: 120 });
const recentConsistency = fc.constantFrom("consistent", "interrupted", "returning");
const intersects = (left, right) => left.some((value) => right.includes(value));

function resolvedSlotContractIssues(slot, normalizedContext) {
  const exercise = slot.exercise;
  const contract = slot.contract;
  const capabilities = new Set(normalizedContext.environment);
  if (normalizedContext.equipment.some((item) => item !== "bodyweight")) capabilities.add("external_resistance");
  const issues = [];
  if (!intersects(exercise.patterns, contract.patterns)) issues.push("movement pattern");
  if (!intersects(
    [...exercise.primaryMuscles, ...exercise.secondaryMuscles],
    [...contract.primaryMuscles, ...contract.secondaryMuscles],
  )) issues.push("authored muscle intent");
  if (!normalizedContext.equipment.includes(exercise.equipment)) issues.push("equipment");
  if (!exercise.environmentRequirements.every((requirement) => normalizedContext.environment.includes(requirement))) {
    issues.push("environment");
  }
  if (!contract.requiredCapabilities.every((capability) => capabilities.has(capability))) {
    issues.push("required capability");
  }
  for (const [key, values] of Object.entries(contract.requiredCharacteristics || {})) {
    if (!values.includes(exercise[key])) issues.push(`required characteristic: ${key}`);
  }
  return issues;
}

function context(familyId, days, sessionMinutes, consistency) {
  const home = familyId === "home";
  return {
    schemaVersion: 1,
    familyId,
    frequency: days,
    sessionMinutes,
    profile: "standard",
    recentConsistency: consistency,
    reentryEnabled: true,
    equipment: home ? [] : ["barbell", "dumbbell", "machine", "cable", "smith"],
    environment: home ? [] : ["safe_pull", "training_support"],
    loadIncrements: home ? {} : { barbell: 2.5, dumbbell: 2, machine: 5, cable: 5, smith: 2.5 },
  };
}

export function buildSuites() {
  return [
    {
      name: "program compiler: generated valid contexts are deterministic and never drift frequency",
      property: fc.property(family, frequency, minutes, recentConsistency, (familyId, days, sessionMinutes, consistency) => {
        const input = context(familyId, days, sessionMinutes, consistency);
        const first = Compiler.compile(input, EXERCISE_LIBRARY);
        const second = Compiler.compile(structuredClone(input), EXERCISE_LIBRARY);
        if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error("equal semantic inputs drifted");
        if (first.familyId !== familyId || first.frequency !== days) throw new Error("family or frequency changed");
        if (first.kind === "compiled") {
          if (first.days.length !== days) throw new Error("compiled day count changed");
          if (JSON.stringify(first).toLowerCase().includes("deload")) throw new Error("compiler scheduled a deload");
          const normalized = Compiler.validateContext(input).value;
          for (const slot of first.days.flatMap((day) => day.slots)) {
            if (slot.prescription.sets < 1 || slot.prescription.sets > 3) throw new Error("set bounds escaped");
            if (slot.role === "isolation_accessory" && slot.prescription.repMax > 15) throw new Error("isolation ceiling escaped");
            const issues = resolvedSlotContractIssues(slot, normalized);
            if (issues.length) throw new Error(`${slot.slotId}: ${issues.join(", ")} escaped candidate contract`);
          }
          for (const day of first.days) {
            if (Compiler.estimateDaySeconds(day) > normalized.sessionMinutes * 60) {
              throw new Error(`${day.dayId}: estimate escaped session ceiling`);
            }
          }
        } else if (first.kind !== "conflict") throw new Error(`valid context returned ${first.kind}`);
      }),
    },
    {
      name: "program compiler: hostile bounded context values fail typed rather than throw",
      property: fc.property(fc.jsonValue({ maxDepth: 5 }), (value) => {
        let result;
        try { result = Compiler.compile(value, EXERCISE_LIBRARY); }
        catch (error) { throw new Error(`compiler threw: ${error.message}`); }
        if (!result || !["invalid", "conflict", "compiled"].includes(result.kind)) throw new Error("compiler returned an untyped result");
      }),
    },
  ];
}
