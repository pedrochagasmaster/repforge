#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Entry = require("../program-entry.js");
const Compiler = require("../program-compiler.js");
const Catalog = require("../assets/exercise-catalog.json");
const workerFixture = JSON.parse(fs.readFileSync(new URL(
  "../services/install-transfer/test/fixtures/program-definition-plan067-worker.json",
  import.meta.url,
), "utf8"));

const VERSIONS = {
  compiler: "067.1", family: "retired", blueprint: "1", catalogue: "raw-uuid@1",
  rules: "source-metrics@1", context: "program-definition@1", progression: "067.1",
  recentConsistency: "retired", simpleStart: "retired",
};

function canonicalCandidate() {
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

  const rows = [];
  for (const day of generated.value.days.filter((item) => item.kind === "training")) {
    for (const slot of day.slots) {
      const cycle = slot.prescriptionsByCycle.find((item) => item.cycleIndex === 1);
      const repetition = slot.metricDefinitions.find((item) =>
        item.semantic === "reps" || item.semantic === "repsPerSide");
      const target = repetition ? cycle.sets[0].targets[repetition.semantic] : null;
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
        sets: cycle.sets.length,
        hasRepTarget: !!repetition,
        ...(min !== undefined ? { min, max } : {}),
      });
    }
  }
  const trainingDays = generated.value.days.filter((day) => day.kind === "training");
  const preview = {
    source: "compiler",
    frequency: request.daysPerWeek,
    program: rows,
    programDefinition: generated.value,
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
  let state = Entry.selectRoute(Entry.createState({
    draftId: "entry-contract-canonical-draft",
    activeProgramRevisionAtStart: 7,
    now: "2026-08-30T00:00:00.000Z",
    versions: VERSIONS,
  }), "recommend");
  state = Entry.setAnswers(state, { programRequest: request });
  state = Entry.setResult(state, {
    fingerprint: "canonical-contract-fixture",
    selected: { id: "generated-program", source: "recommend" },
    preview,
  });
  return { state, request, preview };
}

test("persisted compiler previews are canonical, closed, and bound to typed answers", () => {
  const { state } = canonicalCandidate();
  const accepted = Entry.normalizeSetupDraft(state);
  assert.equal(accepted.ok, true, accepted.issues?.join(", "));
  assert.deepEqual(accepted.value.result.preview.programDefinition.days
    .flatMap((day) => day.slots).map((slot) => slot.id),
  state.result.preview.programDefinition.days.flatMap((day) => day.slots).map((slot) => slot.id));

  const unknownResultField = structuredClone(state);
  unknownResultField.result.extra = true;
  assert.equal(Entry.normalizeSetupDraft(unknownResultField).ok, false);

  const mismatchedAnswers = structuredClone(state);
  mismatchedAnswers.answers.programRequest.daysPerWeek = 5;
  assert.equal(Entry.normalizeSetupDraft(mismatchedAnswers).ok, false,
    "a stored preview cannot be reused after changing its request");

  const mismatchedRoute = structuredClone(state);
  mismatchedRoute.route = "custom";
  assert.equal(Entry.normalizeSetupDraft(mismatchedRoute).ok, false);

  const unknownPreviewField = structuredClone(state);
  unknownPreviewField.result.preview.futureField = true;
  assert.equal(Entry.normalizeSetupDraft(unknownPreviewField).ok, false);

  const missingDefinition = structuredClone(state);
  delete missingDefinition.result.preview.programDefinition;
  const missing = Entry.normalizeSetupDraft(missingDefinition);
  assert.equal(missing.ok, false);
  assert.ok(missing.issues.some((issue) => issue.includes("programDefinition:required")));

  const mismatchedProjection = structuredClone(state);
  mismatchedProjection.result.preview.program[0].libraryId = "unknown.exercise";
  const projection = Entry.normalizeSetupDraft(mismatchedProjection);
  assert.equal(projection.ok, false);
  assert.ok(projection.issues.some((issue) => issue.includes("program[0]:definition_mismatch")));
});

test("typed generation answers keep unknown prerequisites unconfirmed and reject legacy aliases", () => {
  const { state, request } = canonicalCandidate();
  assert.deepEqual(Object.values(request.competencyAnswers), Array(7).fill(null),
    "an unanswered competency stays unknown rather than granting a prerequisite");
  assert.deepEqual(Entry.normalizeSetupDraft(state).value.answers.programRequest, request);

  assert.throws(() => Entry.setAnswers(state, {
    programRequest: { ...request, familyId: "balanced" },
  }), /unknown_key/);
  assert.throws(() => Entry.setAnswers(state, {
    programRequest: {
      ...request,
      competencyAnswers: { ...request.competencyAnswers, pullups10: "confirmed" },
    },
  }), /competencyAnswers\.pullups10:invalid/);
});
