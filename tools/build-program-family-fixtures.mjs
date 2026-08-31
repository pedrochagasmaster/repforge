#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const Compiler = require(path.join(root, "program-compiler.js"));
const { EXERCISE_LIBRARY } = require(path.join(root, "exercises.js"));
const fixturePath = path.join(root, "test/fixtures/program-families-v1.json");
const contractPath = path.join(root, "test/fixtures/program-family-contract-v1.json");
const checking = process.argv.includes("--check");

/* The generated fixture is an executable resolution snapshot. Its family and
   day identity must come from the separately authored Plan 047 contract, so a
   compiler/fixture generator change cannot move both the implementation and
   its oracle together. */
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
assert.equal(contract.contract, "taurifer-program-family-contract");
assert.equal(contract.status, "owner_approved");
assert.deepEqual(Compiler.FAMILY_IDS, contract.families);
const contractById = new Map(contract.blueprints.map((blueprint) => [blueprint.blueprintId, blueprint]));
assert.equal(contractById.size, contract.blueprints.length);
assert.equal(contractById.size, Compiler.BLUEPRINTS.length);
for (const blueprint of Compiler.BLUEPRINTS) {
  const expected = contractById.get(blueprint.id);
  assert.ok(expected, `${blueprint.id} is present in the independent Plan 047 contract`);
  assert.equal(expected.familyId, blueprint.familyId, `${blueprint.id} family contract`);
  assert.equal(expected.frequency, blueprint.frequency, `${blueprint.id} frequency contract`);
  assert.deepEqual(expected.dayLabels, blueprint.days.map((day) => day.label), `${blueprint.id} day-label contract`);
}

assert.deepEqual(Compiler.validateBlueprints(), { ok: true, count: 20 });

const gymContext = (familyId, frequency) => ({
  schemaVersion: 1,
  familyId,
  frequency,
  sessionMinutes: 90,
  equipment: ["barbell", "dumbbell", "machine", "cable", "smith"],
  environment: ["safe_pull", "training_support"],
  loadIncrements: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 5, smith: 2.5 },
});
const homeContext = (frequency) => ({
  schemaVersion: 1,
  familyId: "home",
  frequency,
  sessionMinutes: 90,
  equipment: [],
  environment: [],
  loadIncrements: {},
});

const compiled = Compiler.BLUEPRINTS.map((blueprint) => {
  const context = blueprint.familyId === "home" ? homeContext(blueprint.frequency) : gymContext(blueprint.familyId, blueprint.frequency);
  const result = Compiler.compile(context, EXERCISE_LIBRARY);
  assert.equal(result.kind, "compiled", `${blueprint.id} must compile in its review context`);
  return {
    blueprintId: blueprint.id,
    daySlotCounts: result.days.map((day) => day.slots.length),
    limitations: result.limitations,
    reductions: result.reductions,
    relations: result.relations,
    directIndirectExposure: result.directIndirectExposure,
    days: result.days.map((day) => ({
      dayId: day.dayId,
      label: day.label,
      slots: day.slots.map((slot) => ({
        slotId: slot.slotId,
        templateId: slot.templateId,
        role: slot.role,
        status: slot.status,
        libraryId: slot.exercise.id,
        prescriptionClass: slot.prescription.classId,
        sets: slot.prescription.sets,
        reps: [slot.prescription.repMin, slot.prescription.repMax],
        rir: [slot.prescription.targetRirMin, slot.prescription.targetRirMax],
        restSeconds: slot.prescription.restSeconds,
        strategy: `${slot.prescription.progression.strategy.id}@${slot.prescription.progression.strategy.version}`,
      })),
    })),
  };
});

const fixture = {
  schemaVersion: 1,
  contractStatus: "owner_approved_executable",
  contract: "test/fixtures/program-family-contract-v1.json",
  source: ["docs/plan-047-owner-approved-design.md", "docs/progression-effort-target-v1.md"],
  versions: Compiler.VERSIONS,
  defaultBlockWeeks: 6,
  publicGoals: [
    { id: "build_muscle", en: "Build Muscle", pt: "Ganhar massa", familyId: "growth" },
    { id: "muscle_strength", en: "Muscle + Strength", pt: "Massa + força", familyId: "balanced" },
    { id: "strength_priority", en: "Strength Priority", pt: "Prioridade em força", familyId: "strength" },
  ],
  limitedEquipmentPromise: { en: "Train Anywhere", pt: "Treine em qualquer lugar", internalFamilyId: "home" },
  engineContract: {
    sourcePlan: 46,
    status: "locked_supported",
    strategies: Compiler.STRATEGIES,
    relations: ["paired_exposure@1"],
    modifiers: ["identity_block@1"],
  },
  families: Compiler.FAMILIES,
  slotContracts: Compiler.SLOT_TEMPLATES,
  blueprints: Compiler.BLUEPRINTS.map((blueprint) => ({
    id: blueprint.id,
    familyId: blueprint.familyId,
    frequency: blueprint.frequency,
    version: blueprint.version,
    kind: blueprint.kind,
    days: blueprint.days.map((day, dayIndex) => ({
      dayId: `${blueprint.id.replace(/_v1$/, "")}_d${dayIndex + 1}`,
      label: day.label,
      slots: day.slots.map((slot, slotIndex) => ({ slotId: `${blueprint.id.replace(/_v1$/, "")}_d${dayIndex + 1}_s${slotIndex + 1}`, ...slot })),
    })),
    relations: blueprint.relations,
  })),
  rules: Compiler.RULES,
  reviewCompilations: compiled,
  syntheticExamples: [
    { id: "balanced_3_six_week", blueprintId: "balanced_3_v1", weeks: 6, expectedSameStructureEveryWeek: true, scheduledDeload: false },
    { id: "home_5_fifty_two_week", blueprintId: "home_5_v1", weeks: 52, expectedCompleteBlocks: 8, expectedTrailingWeeks: 4, expectedSameStructureWithinEachPinnedBlock: true, scheduledDeload: false },
  ],
};

const output = `${JSON.stringify(fixture, null, 2)}\n`;
if (checking) {
  const current = fs.readFileSync(fixturePath, "utf8");
  if (current !== output) {
    console.error("program family fixture is stale; run node tools/build-program-family-fixtures.mjs");
    process.exit(1);
  }
  console.log("program family fixture matches program-compiler.js");
} else {
  fs.writeFileSync(fixturePath, output);
  console.log(`wrote ${path.relative(root, fixturePath)}`);
}
