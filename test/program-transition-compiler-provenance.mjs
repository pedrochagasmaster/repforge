#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Adapter = require("../program-entry-adapter.js");
const Compiler = require("../program-compiler.js");
const Progression = require("../progression-engine.js");
const { EXERCISE_LIBRARY } = require("../exercises.js");

const services = Adapter.createProductionServices({ Compiler, catalogue: EXERCISE_LIBRARY });

function answers(daysPerWeek) {
  return {
    desiredResult: "balanced",
    structuredExperience: "6_to_24m",
    recentConsistency: "most",
    daysPerWeek,
    sessionMinutes: 90,
    preferredRestSeconds: 90,
    environment: { kind: "commercial_gym" },
    primaryMuscles: [],
    deEmphasizedMuscles: [],
    ignoredMuscles: [],
    priorityMovements: [],
    mustHaveExercises: [],
    exerciseConstraints: [],
  };
}

function compile(daysPerWeek) {
  const result = services.compile({
    mode: "recommend",
    answers: answers(daysPerWeek),
    versions: services.currentVersions(),
  });
  assert.equal(result.ok, true, result.code);
  return result;
}

function withoutFrequency(context) {
  const copy = structuredClone(context);
  delete copy.frequency;
  return copy;
}

function relationSemantics(instance) {
  const slots = new Map(instance.days.flatMap((day) => day.slots).map((slot) => [slot.slotId, slot]));
  return instance.relations.map((relation) => ({
    type: relation.type,
    version: relation.version,
    movementId: relation.movementId,
    state: relation.state,
    reason: relation.reason,
    heavy: structuredClone(slots.get(relation.heavySlotId).prescription.progression),
    volume: structuredClone(slots.get(relation.volumeSlotId).prescription.progression),
  }));
}

test("the production adapter compiles a reconstructable same-family sibling pair", () => {
  const predecessor = compile(4);
  const successor = compile(3);

  assert.equal(predecessor.instance.blueprintId, "balanced_4_v1");
  assert.equal(successor.instance.blueprintId, "balanced_3_v1");
  assert.equal(predecessor.instance.familyId, successor.instance.familyId);
  assert.equal(predecessor.instance.frequency, 4);
  assert.equal(successor.instance.frequency, 3);
  assert.deepEqual(withoutFrequency(predecessor.compilerContext), withoutFrequency(successor.compilerContext));

  assert.deepEqual(predecessor.instance.programStructure.provenance, predecessor.instance.provenance);
  assert.deepEqual(successor.instance.programStructure.provenance, successor.instance.provenance);
  assert.deepEqual(
    { ...predecessor.instance.provenance, blueprintId: successor.instance.provenance.blueprintId },
    successor.instance.provenance,
    "the blueprint identity is the only provenance change",
  );

  for (const result of [predecessor, successor]) {
    const slotIds = result.instance.days.flatMap((day) => day.slots.map((slot) => slot.slotId));
    assert.equal(new Set(slotIds).size, slotIds.length, "compiler slot identities are unique");
    assert(result.instance.program.every((exercise) => exercise.movementId === `library:${exercise.libraryId}`));
    for (const exercise of result.instance.program) {
      assert.equal(Progression.validatePrescription(exercise.progression).ok, true,
        `${exercise.slotId} carries a complete executable progression prescription`);
      assert.deepEqual(
        exercise.progression,
        result.instance.days.flatMap((day) => day.slots)
          .find((slot) => slot.slotId === exercise.slotId).prescription.progression,
        `${exercise.slotId} preserves every progression parameter from compiler slot to program row`,
      );
    }
    assert.deepEqual(
      Progression.validateRelations(result.preview.progressionRelations, { slots: result.preview.program }),
      { ok: true, value: result.preview.progressionRelations },
      "entry preview carries executable relation members",
    );
  }

  assert.deepEqual(
    relationSemantics(successor.instance),
    relationSemantics(predecessor.instance),
    "the lower-frequency sibling preserves complete anchor/back-off and rep-goal parameters plus relation semantics",
  );
});

test("persisted compiler provenance alone is insufficient reconstruction input", () => {
  const compiled = compile(4);

  assert.equal(Object.hasOwn(compiled.preview, "compilerContext"), false,
    "the current persisted preview does not carry the legal raw compiler context");
  assert.equal(Compiler.validateContext(compiled.instance.programStructure.provenance).ok, false,
    "version pins and blueprint identity cannot be treated as compiler answers");

  const unsupportedContext = { ...compiled.compilerContext, schemaVersion: 99 };
  assert.equal(Compiler.validateContext(unsupportedContext).ok, false,
    "an unsupported historical context version fails closed");

  const customized = Compiler.customize(
    compiled.instance,
    compiled.instance.days[0].slots[0].slotId,
    { id: "custom:transition-proof", name: "Custom transition proof" },
  );
  assert.equal(customized.customizedFrom, compiled.instance.blueprintId);
  assert.equal(customized.program[0].progression.strategy.id, "manual",
    "customized compiler output cannot masquerade as a reconstructable authored sibling");
});
