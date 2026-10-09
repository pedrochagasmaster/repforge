#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Compiler = require("../program-compiler.js");
const Entry = require("../program-entry.js");
const Catalog = require("../assets/exercise-catalog.json");
const workerFixture = JSON.parse(fs.readFileSync(new URL(
  "../services/install-transfer/test/fixtures/program-definition-plan067-worker.json",
  import.meta.url,
), "utf8"));

const request = structuredClone(workerFixture.request);
const seed = request.seed;
delete request.seed;
Object.assign(request, {
  daysPerWeek: 4,
  timeCeilingMinutes: 150,
  cycles: 1,
  deloadCycles: [],
  split: "auto",
});
request.gymProfile.equipmentIds = Object.keys(Catalog.uuidIndex)
  .filter((id) => Catalog.uuidIndex[id]?.type === "equipment");

const generated = Compiler.generateProgram(request, Catalog, seed);
assert.equal(generated.ok, true, generated.conflicts?.map((item) => item.message).join("; "));
const original = generated.value;
const renamedDay = original.days.find((day) => day.kind === "training");
assert.ok(renamedDay?.slots.length, "the generated fixture includes authored slots");
const dayId = renamedDay.id;
const slotIds = renamedDay.slots.map((slot) => slot.id);
const customName = "Lower day, easy to recognize";
const edited = structuredClone(original);
edited.days.find((day) => day.id === dayId).name = customName;

const rows = [];
for (const day of edited.days.filter((item) => item.kind === "training")) {
  for (const slot of day.slots) {
    const firstCycle = slot.prescriptionsByCycle.find((cycle) => cycle.cycleIndex === 1);
    const repetition = slot.metricDefinitions.find((metric) =>
      metric.semantic === "reps" || metric.semantic === "repsPerSide");
    const target = repetition ? firstCycle.sets[0].targets[repetition.semantic] : null;
    const min = typeof target === "number" ? target : target?.min;
    const max = typeof target === "number" ? target : target?.max;
    rows.push({
      id: slot.id,
      slotId: slot.id,
      dayId: day.id,
      day: day.name,
      order: slot.order,
      name: Catalog.uuidIndex[slot.exerciseId]?.name || slot.exerciseId,
      libraryId: slot.exerciseId,
      sets: firstCycle.sets.length,
      hasRepTarget: !!repetition,
      ...(min !== undefined ? { min, max } : {}),
    });
  }
}
const trainingDays = edited.days.filter((day) => day.kind === "training");
const preview = {
  source: "compiler",
  frequency: request.daysPerWeek,
  program: rows,
  programDefinition: edited,
  programStructure: {
    schemaVersion: 1,
    days: trainingDays.map((day) => ({ dayId: day.id, label: day.name, order: day.order })),
  },
  days: trainingDays.map((day) => ({
    dayId: day.id,
    label: day.name,
    order: day.order,
    exercises: rows.filter((row) => row.dayId === day.id).map((row) => structuredClone(row)),
  })),
  customExercises: [],
};
let draft = Entry.selectRoute(Entry.createState({
  draftId: "canonical-day-name-draft",
  activeProgramRevisionAtStart: 0,
  now: "2026-09-02T00:00:00.000Z",
  versions: {
    compiler: "067.1", family: "retired", blueprint: "1", catalogue: "raw-uuid@1",
    rules: "source-metrics@1", context: "program-definition@1", progression: "067.1",
    recentConsistency: "retired", simpleStart: "retired",
  },
}), "recommend");
draft = Entry.setAnswers(draft, { programRequest: request });
draft = Entry.setResult(draft, {
  fingerprint: "canonical-day-name-fixture",
  selected: { id: "canonical-program", source: "recommend" },
  preview,
});

const normalized = Entry.normalizeSetupDraft(draft);
assert.equal(normalized.ok, true, normalized.issues?.join(", "));
const saved = normalized.value.result.preview.programDefinition;
const savedDay = saved.days.find((day) => day.id === dayId);
assert.equal(savedDay.name, customName, "an authored day name survives setup draft normalization");
assert.deepEqual(saved.days.map((day) => day.id), original.days.map((day) => day.id),
  "renaming a day does not mint or replace stable day identities");
assert.deepEqual(savedDay.slots.map((slot) => slot.id), slotIds,
  "renaming a day preserves every slot identity in that day");
assert.equal(normalized.value.result.preview.program.find((row) => row.dayId === dayId).day, customName,
  "the flat display projection follows the canonical day name");
assert.equal(normalized.value.result.preview.programStructure.days.find((day) => day.dayId === dayId).label, customName);
assert.equal(Compiler.validateProgramDefinition(saved, Catalog).ok, true);

console.log("PASS program day names: authored names retain canonical day and slot identities");
