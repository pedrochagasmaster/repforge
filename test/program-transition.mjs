#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { proposalHashOf as plan049ProposalHashOf } from "../tools/canonical-proposal-hash.mjs";

const require = createRequire(import.meta.url);
const Adapter = require("../program-entry-adapter.js");
const Compiler = require("../program-compiler.js");
const Transition = require("../program-transition.js");
const { EXERCISE_LIBRARY } = require("../exercises.js");

const fixture = JSON.parse(readFileSync(
  new URL("./fixtures/transition-proposal-v1.json", import.meta.url),
  "utf8",
));
const FIXTURE_HASH = "c7a4c90322522d6d990fdd7e7e51c7da0de7b349f2d3e959619b9c1d9e9feadc";
const EXPECTED_SLOT_PAIRS = [
  ["balanced_4_d1_s1", "balanced_3_d1_s1"],
  ["balanced_4_d1_s2", "balanced_3_d2_s1"],
  ["balanced_4_d2_s2", "balanced_3_d2_s2"],
  ["balanced_4_d1_s3", "balanced_3_d2_s4"],
  ["balanced_4_d3_s2", "balanced_3_d3_s1"],
  ["balanced_4_d2_s3", "balanced_3_d3_s3"],
  ["balanced_4_d3_s4", "balanced_3_d3_s4"],
  [null, "balanced_3_d1_s2"],
  [null, "balanced_3_d1_s3"],
  [null, "balanced_3_d1_s4"],
  [null, "balanced_3_d1_s5"],
  [null, "balanced_3_d2_s3"],
  [null, "balanced_3_d2_s5"],
  [null, "balanced_3_d3_s2"],
  [null, "balanced_3_d3_s5"],
  ["balanced_4_d1_s4", null],
  ["balanced_4_d2_s1", null],
  ["balanced_4_d2_s4", null],
  ["balanced_4_d3_s1", null],
  ["balanced_4_d3_s3", null],
  ["balanced_4_d4_s1", null],
  ["balanced_4_d4_s2", null],
  ["balanced_4_d4_s3", null],
  ["balanced_4_d4_s4", null],
];
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

function proposalInput() {
  const predecessor = compile(4);
  const successor = compile(3);
  return {
    predecessor,
    successor,
    input: {
      transitionId: "tr_balanced_4_to_3_contract",
      createdAt: "2026-09-05T12:00:00.000Z",
      kind: "lower_frequency_sibling",
      request: "lower-frequency-sibling",
      predecessor: {
        programId: "program-balanced-4",
        fingerprint: predecessor.fingerprint,
        durableRevision: 18,
        source: "Recommend",
        compilerProvenance: predecessor.instance.provenance,
      },
      successor: {
        programId: "program-balanced-3",
        fingerprint: successor.fingerprint,
        source: "Recommend",
        compilerProvenance: successor.instance.provenance,
      },
      predecessorInstance: predecessor.instance,
      successorInstance: successor.instance,
      predecessorCompilerContext: predecessor.compilerContext,
      successorCompilerContext: successor.compilerContext,
      supportedVersions: Compiler.VERSIONS,
      diagnosis: {
        kind: "fewer_days",
        answers: { availableDays: 3 },
        eligibleEvidenceIds: ["schedule-4-to-3", "schedule-4-to-3"],
        insufficientEvidenceReasons: [],
      },
    },
  };
}

function slotsById(instance) {
  return new Map(instance.days.flatMap((day) => day.slots).map((slot) => [slot.slotId, slot]));
}

test("canonical hashing reproduces the independent Plan 049 oracle", async () => {
  assert.equal(
    await Transition.hashProposal(fixture.proposal),
    FIXTURE_HASH,
  );

  const nodeDigest = createHash("sha256")
    .update(Transition.canonicalProposalJson(fixture.proposal), "utf8")
    .digest("hex");
  assert.equal(nodeDigest, FIXTURE_HASH,
    "the browser-capable digest uses the same bytes as independent Node crypto");

  const numericKeys = {
    schemaVersion: 1,
    diagnosis: { answers: { 10: "ten", 2: "two" } },
  };
  assert.equal(
    await Transition.hashProposal(numericKeys),
    plan049ProposalHashOf(numericKeys),
    "canonical serialization keeps lexicographic ordering for numeric-looking object keys",
  );
});

test("day mapping leaves a successor-only day explicit", () => {
  const slot = (slotId, templateId, exerciseId) => ({
    slotId,
    templateId,
    exercise: { id: exerciseId },
  });
  const predecessor = {
    days: [{ dayId: "old_d1", slots: [slot("old_s1", "shared", "one")] }],
  };
  const successor = {
    days: [
      { dayId: "new_d1", slots: [slot("new_s1", "shared", "one")] },
      { dayId: "new_d2", slots: [slot("new_s2", "added", "two")] },
    ],
  };
  assert.deepEqual(Transition.buildSlotMapping(predecessor, successor).days, [
    { predecessorDay: "old_d1", successorDay: "new_d1" },
    { predecessorDay: null, successorDay: "new_d2" },
  ]);
});

test("a real sibling pair produces one immutable exact proposal", async () => {
  const { predecessor, successor, input } = proposalInput();
  const first = await Transition.createSiblingProposal(input);
  const second = await Transition.createSiblingProposal(structuredClone(input));
  assert.equal(first.ok, true, first.code);
  assert.equal(second.ok, true, second.code);
  assert.deepEqual(second.proposal, first.proposal, "equal compiler inputs are deterministic");
  assert(Object.isFrozen(first.proposal));
  assert(Object.isFrozen(first.proposal.derivation.slotMapping.slots));

  const changedContextInput = structuredClone(input);
  changedContextInput.predecessorCompilerContext.sessionMinutes = 100;
  changedContextInput.successorCompilerContext.sessionMinutes = 100;
  const changedContext = await Transition.createSiblingProposal(changedContextInput);
  assert.equal(changedContext.ok, true, changedContext.code);
  assert.notEqual(changedContext.proposal.proposalHash, first.proposal.proposalHash,
    "the proposal hash binds the complete compiler context even when compilation output stays equal");

  const proposal = first.proposal;
  const mapping = proposal.derivation.slotMapping;
  const predecessorSlots = predecessor.instance.days.flatMap((day) => day.slots);
  const successorSlots = successor.instance.days.flatMap((day) => day.slots);
  assert.equal(mapping.slots.filter((entry) => entry.predecessorSlot).length, predecessorSlots.length);
  assert.equal(mapping.slots.filter((entry) => entry.successorSlot).length, successorSlots.length);
  assert.equal(new Set(mapping.slots.map((entry) => entry.predecessorSlot).filter(Boolean)).size, predecessorSlots.length);
  assert.equal(new Set(mapping.slots.map((entry) => entry.successorSlot).filter(Boolean)).size, successorSlots.length);
  assert.deepEqual(
    mapping.days.map((entry) => [entry.predecessorDay, entry.successorDay]),
    [
      ["balanced_4_d1", "balanced_3_d1"],
      ["balanced_4_d2", "balanced_3_d2"],
      ["balanced_4_d3", "balanced_3_d3"],
      ["balanced_4_d4", null],
    ],
  );
  assert.deepEqual(
    mapping.slots.map((entry) => [entry.predecessorSlot, entry.successorSlot]),
    EXPECTED_SLOT_PAIRS,
    "the complete reviewed pairing is independent of the implementation's counts and template checks",
  );

  assert.equal(proposal.diff.exercises.length, mapping.slots.length);
  assert.equal(proposal.diff.prescriptions.length, mapping.slots.length);
  assert.deepEqual(
    proposal.diff.exercises.map(({ predecessorSlot, successorSlot }) => ({ predecessorSlot, successorSlot })),
    mapping.slots.map(({ predecessorSlot, successorSlot }) => ({ predecessorSlot, successorSlot })),
    "exact exercise diff follows canonical pair, addition, removal order",
  );
  assert.deepEqual(
    proposal.diff.prescriptions.map(({ predecessorSlot, successorSlot }) => ({ predecessorSlot, successorSlot })),
    mapping.slots.map(({ predecessorSlot, successorSlot }) => ({ predecessorSlot, successorSlot })),
    "exact prescription diff follows canonical pair, addition, removal order",
  );

  const predecessorById = slotsById(predecessor.instance);
  const successorById = slotsById(successor.instance);
  for (const pair of mapping.slots.filter((entry) => entry.predecessorSlot && entry.successorSlot)) {
    assert.equal(
      predecessorById.get(pair.predecessorSlot).templateId,
      successorById.get(pair.successorSlot).templateId,
      `${pair.predecessorSlot} maps only to the same authored template`,
    );
    assert.deepEqual(
      predecessorById.get(pair.predecessorSlot).prescription.progression,
      successorById.get(pair.successorSlot).prescription.progression,
      `${pair.predecessorSlot} preserves the complete progression parameter object`,
    );
  }
  assert.deepEqual(proposal.progressionContract, {
    preservedRelations: [
      "paired_exposure@1:balanced_4_knee->balanced_3_knee",
    ],
    resetRelations: [
      "paired_exposure@1:balanced_4_press->balanced_3_press:endpoints_rebound",
    ],
    incompatibilities: [],
  }, "relation classification follows exact mapped endpoints and keeps distinct relation identities");

  assert.deepEqual(
    await Transition.validateProposal(proposal, {
      predecessor: input.predecessor,
      predecessorInstance: predecessor.instance,
      successorInstance: successor.instance,
      predecessorCompilerContext: input.predecessorCompilerContext,
      successorCompilerContext: input.successorCompilerContext,
    }),
    { ok: true, status: "preview" },
  );
});

test("hash identity excludes only declared lifecycle and mapping prose fields", async () => {
  const { input } = proposalInput();
  const result = await Transition.createSiblingProposal(input);
  assert.equal(result.ok, true, result.code);
  const proposal = structuredClone(result.proposal);

  const lifecycle = structuredClone(proposal);
  lifecycle.status = "committed";
  lifecycle.confirmedAt = "2026-09-05T12:05:00.000Z";
  lifecycle.archiveId = "archive-balanced-4";
  lifecycle.derivation.slotMapping.source = "new explanation";
  lifecycle.derivation.slotMapping.rule = "new prose";
  lifecycle.diagnosis.eligibleEvidenceIds.reverse();
  lifecycle.diagnosis.eligibleEvidenceIds.push("schedule-4-to-3");
  assert.equal(await Transition.hashProposal(lifecycle), proposal.proposalHash);

  const semanticChange = structuredClone(proposal);
  semanticChange.diff.prescriptions[0].after.sets += 1;
  assert.notEqual(await Transition.hashProposal(semanticChange), proposal.proposalHash);

  const nestedLifecycle = structuredClone(proposal);
  nestedLifecycle.diff.recoveryWeek = {
    confirmedAt: "2026-09-05T12:05:00.000Z",
    reassessmentOutcome: null,
  };
  const nestedHash = await Transition.hashProposal(nestedLifecycle);
  nestedLifecycle.diff.recoveryWeek.reassessmentOutcome = "Better";
  assert.notEqual(await Transition.hashProposal(nestedLifecycle), nestedHash,
    "only top-level lifecycle fields are excluded from the proposal preimage");
});

test("validation rejects stale, duplicate, reordered, and unsupported reconstruction", async () => {
  const { predecessor, successor, input } = proposalInput();
  const result = await Transition.createSiblingProposal(input);
  assert.equal(result.ok, true, result.code);

  assert.deepEqual(
    await Transition.validateProposal(result.proposal, {
      predecessor: { ...input.predecessor, durableRevision: 19 },
      predecessorInstance: predecessor.instance,
      successorInstance: successor.instance,
      predecessorCompilerContext: input.predecessorCompilerContext,
      successorCompilerContext: input.successorCompilerContext,
    }),
    { ok: false, status: "stale", code: "predecessor_changed" },
  );

  const duplicate = structuredClone(result.proposal);
  duplicate.derivation.slotMapping.slots[1].successorSlot =
    duplicate.derivation.slotMapping.slots[0].successorSlot;
  duplicate.proposalHash = await Transition.hashProposal(duplicate);
  assert.deepEqual(
    await Transition.validateProposal(duplicate, {
      predecessor: input.predecessor,
      predecessorInstance: predecessor.instance,
      successorInstance: successor.instance,
      predecessorCompilerContext: input.predecessorCompilerContext,
      successorCompilerContext: input.successorCompilerContext,
    }),
    { ok: false, status: "invalid", code: "duplicate_successor_slot" },
  );

  const reordered = structuredClone(result.proposal);
  [reordered.diff.exercises[0], reordered.diff.exercises[1]] =
    [reordered.diff.exercises[1], reordered.diff.exercises[0]];
  reordered.proposalHash = await Transition.hashProposal(reordered);
  assert.deepEqual(
    await Transition.validateProposal(reordered, {
      predecessor: input.predecessor,
      predecessorInstance: predecessor.instance,
      successorInstance: successor.instance,
      predecessorCompilerContext: input.predecessorCompilerContext,
      successorCompilerContext: input.successorCompilerContext,
    }),
    { ok: false, status: "invalid", code: "diff_exercise_order" },
  );

  const historical = structuredClone(input);
  historical.predecessor.compilerProvenance.compilerVersion = 1;
  historical.successor.compilerProvenance.compilerVersion = 1;
  historical.predecessorInstance.provenance.compilerVersion = 1;
  historical.successorInstance.provenance.compilerVersion = 1;
  historical.predecessorInstance.programStructure.provenance.compilerVersion = 1;
  historical.successorInstance.programStructure.provenance.compilerVersion = 1;
  const unsupported = await Transition.createSiblingProposal(historical);
  assert.deepEqual(unsupported, { ok: false, code: "unsupported_reconstruction" });

  const unchangedCallerFingerprint = structuredClone(predecessor.instance);
  unchangedCallerFingerprint.program[0].name = "Mutated after preview";
  assert.deepEqual(
    await Transition.validateProposal(result.proposal, {
      predecessor: input.predecessor,
      predecessorInstance: unchangedCallerFingerprint,
      successorInstance: successor.instance,
      predecessorCompilerContext: input.predecessorCompilerContext,
      successorCompilerContext: input.successorCompilerContext,
    }),
    { ok: false, status: "stale", code: "predecessor_changed" },
    "the full compiler snapshot fingerprint catches mutation hidden by the adapter context fingerprint",
  );

  const contextDrift = structuredClone(input.successorCompilerContext);
  contextDrift.sessionMinutes = 100;
  assert.deepEqual(
    await Transition.validateProposal(result.proposal, {
      predecessor: input.predecessor,
      predecessorInstance: predecessor.instance,
      successorInstance: successor.instance,
      predecessorCompilerContext: input.predecessorCompilerContext,
      successorCompilerContext: contextDrift,
    }),
    { ok: false, status: "stale", code: "compiler_context_changed" },
    "confirmation binds the exact compiler context used for the preview",
  );

  const forgedVersions = structuredClone(result.proposal);
  forgedVersions.derivation.compilerContextVersions.compilerVersion = 99;
  forgedVersions.proposalHash = await Transition.hashProposal(forgedVersions);
  assert.deepEqual(
    await Transition.validateProposal(forgedVersions, {
      predecessor: input.predecessor,
      predecessorInstance: predecessor.instance,
      successorInstance: successor.instance,
      predecessorCompilerContext: input.predecessorCompilerContext,
      successorCompilerContext: input.successorCompilerContext,
    }),
    { ok: false, status: "stale", code: "compiler_context_changed" },
  );

  const parameterDrift = structuredClone(input);
  const driftSlot = parameterDrift.successorInstance.days[0].slots[0];
  driftSlot.prescription.progression.strategy.params.anchorRepMax += 1;
  const driftProgram = parameterDrift.successorInstance.program.find((entry) => entry.slotId === driftSlot.slotId);
  driftProgram.progression.strategy.params.anchorRepMax += 1;
  const drifted = await Transition.createSiblingProposal(parameterDrift);
  assert.deepEqual(drifted, { ok: false, code: "progression_parameters_changed" },
    "matching strategy IDs cannot hide changed relation parameters");

  const ordinaryParameterDrift = structuredClone(input);
  const ordinarySlot = ordinaryParameterDrift.successorInstance.days[1].slots[0];
  ordinarySlot.prescription.progression.strategy.params.repMax += 1;
  const ordinaryProgram = ordinaryParameterDrift.successorInstance.program
    .find((entry) => entry.slotId === ordinarySlot.slotId);
  ordinaryProgram.progression.strategy.params.repMax += 1;
  assert.deepEqual(
    await Transition.createSiblingProposal(ordinaryParameterDrift),
    { ok: false, code: "progression_parameters_changed" },
    "a full parameter drift on an ordinary mapped strategy also fails closed",
  );

  const semanticCases = [
    {
      name: "insufficient evidence",
      code: "insufficient_transition_evidence",
      mutateInput(value) {
        value.diagnosis.eligibleEvidenceIds = [];
        value.diagnosis.insufficientEvidenceReasons = ["schedule_constraint_unconfirmed"];
      },
      mutateProposal(value) {
        value.diagnosis.eligibleEvidenceIds = [];
        value.diagnosis.insufficientEvidenceReasons = ["schedule_constraint_unconfirmed"];
      },
    },
    {
      name: "reused successor program identity",
      code: "successor_identity_invalid",
      mutateInput(value) { value.successor.programId = value.predecessor.programId; },
      mutateProposal(value) { value.successor.programId = value.predecessor.programId; },
    },
    {
      name: "wrong derivation request",
      code: "invalid_sibling_derivation",
      mutateInput(value) { value.request = "increase-frequency-sibling"; },
      mutateProposal(value) { value.derivation.request = "increase-frequency-sibling"; },
    },
    {
      name: "diagnosed day count does not match successor",
      code: "insufficient_transition_evidence",
      mutateInput(value) { value.diagnosis.answers.availableDays = 2; },
      mutateProposal(value) { value.diagnosis.answers.availableDays = 2; },
    },
  ];
  for (const semanticCase of semanticCases) {
    const producerInput = structuredClone(input);
    semanticCase.mutateInput(producerInput);
    assert.deepEqual(
      await Transition.createSiblingProposal(producerInput),
      { ok: false, code: semanticCase.code },
      `${semanticCase.name} is rejected by the producer`,
    );

    const consumerProposal = structuredClone(result.proposal);
    semanticCase.mutateProposal(consumerProposal);
    consumerProposal.proposalHash = await Transition.hashProposal(consumerProposal);
    assert.deepEqual(
      await Transition.validateProposal(consumerProposal, {
        predecessor: input.predecessor,
        predecessorInstance: predecessor.instance,
        successorInstance: successor.instance,
        predecessorCompilerContext: input.predecessorCompilerContext,
        successorCompilerContext: input.successorCompilerContext,
      }),
      { ok: false, status: "invalid", code: semanticCase.code },
      `${semanticCase.name} is rejected by the consumer after a fresh hash`,
    );
  }

  const customized = structuredClone(input);
  customized.predecessorInstance.customizedFrom = "balanced_4_v1";
  customized.predecessorInstance.programStructure.customizedFrom = "balanced_4_v1";
  assert.deepEqual(
    await Transition.createSiblingProposal(customized),
    { ok: false, code: "unsupported_reconstruction" },
  );

  const incoherentProgram = structuredClone(input);
  incoherentProgram.predecessorInstance.program[0].targetRirStart = 9;
  assert.deepEqual(
    await Transition.createSiblingProposal(incoherentProgram),
    { ok: false, code: "program_compiler_mismatch" },
  );
});
