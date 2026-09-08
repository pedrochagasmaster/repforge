#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Adapter = require("../program-entry-adapter.js");
const Compiler = require("../program-compiler.js");
const Transition = require("../program-transition.js");
const { EXERCISE_LIBRARY } = require("../exercises.js");

const services = Adapter.createProductionServices({ Compiler, catalogue: EXERCISE_LIBRARY });

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

function answers(daysPerWeek, sessionMinutes = 90) {
  return {
    desiredResult: "balanced",
    structuredExperience: "6_to_24m",
    recentConsistency: "most",
    daysPerWeek,
    sessionMinutes,
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

function compilePredecessor(daysPerWeek = 4, sessionMinutes = 90) {
  const result = services.compile({
    mode: "recommend",
    answers: answers(daysPerWeek, sessionMinutes),
    versions: services.currentVersions(),
  });
  assert.equal(result.ok, true, result.code);
  return result;
}

test("proposeSibling resolves lower-frequency sibling for balanced 4 to 3 against independent oracle", async () => {
  const predecessor = compilePredecessor(4, 90);

  // Sibling metadata read directly from Compiler.BLUEPRINTS authored data, never by string matching
  const targetFrequency = 3;
  const targetBlueprint = Compiler.BLUEPRINTS.find(
    (bp) => bp.familyId === "balanced" && bp.frequency === targetFrequency,
  );
  assert(targetBlueprint, "authored balanced 3 blueprint must exist in compiler");
  assert.equal(targetBlueprint.id, "balanced_3_v1");

  const validDiagnosis = {
    kind: "fewer_days",
    answers: { availableDays: 3 },
    eligibleEvidenceIds: ["sessions-14d-6-of-3", "sessions-14d-3-of-6"],
    insufficientEvidenceReasons: [],
  };

  const result = await Transition.proposeSibling({
    kind: "lower_frequency_sibling",
    predecessor: {
      programId: "prog_balanced_4",
      durableRevision: 12,
      source: "Recommend",
      compilerProvenance: predecessor.instance.provenance,
    },
    successorProgramId: "prog_balanced_3",
    predecessorInstance: predecessor.instance,
    compilerContext: predecessor.compilerContext,
    targetConstraint: { frequency: 3 },
    diagnosis: validDiagnosis,
    transitionId: "tr_p3a_balanced_4_to_3",
    createdAt: "2026-10-02T10:00:00.000Z",
    services: { Compiler, catalogue: EXERCISE_LIBRARY },
  });

  assert.equal(result.ok, true, result.code);
  assert.equal(result.status, "preview");
  assert(result.proposal, "returns immutable proposal");
  assert(Object.isFrozen(result.proposal));
  assert.equal(result.proposal.kind, "lower_frequency_sibling");
  assert.equal(result.proposal.diagnosis.kind, "fewer_days");
  assert.equal(result.proposal.diagnosis.answers.availableDays, 3);
  assert.deepEqual(result.proposal.diagnosis.eligibleEvidenceIds, ["sessions-14d-6-of-3", "sessions-14d-3-of-6"]);
  assert.deepEqual(result.proposal.diagnosis.insufficientEvidenceReasons, []);
  assert.equal(result.proposal.successor.programId, "prog_balanced_3");
  assert.equal(result.successorInstance.blueprintId, "balanced_3_v1");
  assert.equal(result.successorInstance.frequency, 3);
  assert.equal(result.successorCompilerContext.frequency, 3);
  assert.equal(result.successorCompilerContext.sessionMinutes, 90);

  // Exact 24-row slot pairing oracle preserved
  const mappingSlots = result.proposal.derivation.slotMapping.slots.map(
    (entry) => [entry.predecessorSlot, entry.successorSlot],
  );
  assert.deepEqual(mappingSlots, EXPECTED_SLOT_PAIRS);

  // Progression relations preserved/reset match the known contract
  assert.deepEqual(result.proposal.progressionContract, {
    preservedRelations: [
      "paired_exposure@1:balanced_4_knee->balanced_3_knee",
    ],
    resetRelations: [
      "paired_exposure@1:balanced_4_press->balanced_3_press:endpoints_rebound",
    ],
    incompatibilities: [],
  });

  // Validates with validateProposal
  const validation = await Transition.validateProposal(result.proposal, {
    predecessor: {
      programId: "prog_balanced_4",
      durableRevision: 12,
      source: "Recommend",
    },
    predecessorInstance: predecessor.instance,
    successorInstance: result.successorInstance,
    predecessorCompilerContext: predecessor.compilerContext,
    successorCompilerContext: result.successorCompilerContext,
  });
  assert.deepEqual(validation, { ok: true, status: "preview" });
});

test("proposeSibling resolves shorter-session sibling preserving frequency and respecting day ceiling", async () => {
  const predecessor = compilePredecessor(4, 90);

  const validDiagnosis = {
    kind: "sessions_too_long",
    answers: { sessionMinutes: 60 },
    eligibleEvidenceIds: ["session-duration-90-to-60-d1", "session-duration-90-to-60-d2"],
    insufficientEvidenceReasons: [],
  };

  const result = await Transition.proposeSibling({
    kind: "shorter_session_sibling",
    predecessor: {
      programId: "prog_balanced_4_90m",
      durableRevision: 5,
      source: "Recommend",
      compilerProvenance: predecessor.instance.provenance,
    },
    successorProgramId: "prog_balanced_4_60m",
    predecessorInstance: predecessor.instance,
    compilerContext: predecessor.compilerContext,
    targetConstraint: { sessionMinutes: 60 },
    diagnosis: validDiagnosis,
    transitionId: "tr_p3a_balanced_4_shorter",
    createdAt: "2026-10-02T11:00:00.000Z",
    services: { Compiler, catalogue: EXERCISE_LIBRARY },
  });

  assert.equal(result.ok, true, result.code);
  assert.equal(result.status, "preview");
  assert(result.proposal, "must return proposal");
  assert(Object.isFrozen(result.proposal));
  assert.equal(result.proposal.kind, "shorter_session_sibling");
  assert.equal(result.proposal.diagnosis.kind, "sessions_too_long");
  assert.equal(result.proposal.diagnosis.answers.sessionMinutes, 60);
  assert.deepEqual(result.proposal.diagnosis.eligibleEvidenceIds, ["session-duration-90-to-60-d1", "session-duration-90-to-60-d2"]);
  assert.deepEqual(result.proposal.diagnosis.insufficientEvidenceReasons, []);
  assert.equal(result.proposal.successor.programId, "prog_balanced_4_60m");

  // Frequency and blueprint must remain unchanged
  assert.equal(result.successorInstance.frequency, 4);
  assert.equal(result.successorInstance.blueprintId, "balanced_4_v1");
  assert.equal(result.successorCompilerContext.frequency, 4);
  assert.equal(result.successorCompilerContext.sessionMinutes, 60);

  // Every day estimate must satisfy requested ceiling (<= 60 mins)
  for (const day of result.successorInstance.days) {
    const daySecs = Compiler.estimateDaySeconds(day, EXERCISE_LIBRARY);
    assert(daySecs <= 60 * 60, `day ${day.dayId} estimate (${daySecs}s) exceeds ceiling (3600s)`);
  }

  // Validates with validateProposal
  const validation = await Transition.validateProposal(result.proposal, {
    predecessor: {
      programId: "prog_balanced_4_90m",
      durableRevision: 5,
      source: "Recommend",
    },
    predecessorInstance: predecessor.instance,
    successorInstance: result.successorInstance,
    predecessorCompilerContext: predecessor.compilerContext,
    successorCompilerContext: result.successorCompilerContext,
  });
  assert.deepEqual(validation, { ok: true, status: "preview" });
});

test("proposeSibling returns typed Unavailable when session duration cannot fit at same frequency without reducing frequency", async () => {
  const predecessor = compilePredecessor(4, 90);

  // 30 minutes cannot fit 4-day balanced (compiler rejects with time ceiling conflict)
  // Resolver must NOT reduce frequency to 3 or 2 to force fit; it must return Unavailable.
  const result = await Transition.proposeSibling({
    kind: "shorter_session_sibling",
    predecessor: {
      programId: "prog_balanced_4_90m",
      durableRevision: 5,
      source: "Recommend",
      compilerProvenance: predecessor.instance.provenance,
    },
    successorProgramId: "prog_balanced_4_30m",
    predecessorInstance: predecessor.instance,
    compilerContext: predecessor.compilerContext,
    targetConstraint: { sessionMinutes: 30 },
    diagnosis: {
      kind: "sessions_too_long",
      answers: { sessionMinutes: 30 },
      eligibleEvidenceIds: ["session-duration-90-to-30-d1"],
      insufficientEvidenceReasons: [],
    },
    transitionId: "tr_p3a_impossible_duration",
    createdAt: "2026-10-02T11:00:00.000Z",
    services: { Compiler, catalogue: EXERCISE_LIBRARY },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "unavailable");
  assert.equal(result.unavailable, true);
  assert.equal(result.code, "sessions_too_long_unavailable");
});

test("proposeSibling returns typed Unavailable when diagnosis evidence is missing, insufficient, wrong kind, or inconsistent", async () => {
  const predecessor = compilePredecessor(4, 90);

  const baseOpts = {
    kind: "lower_frequency_sibling",
    predecessor: {
      programId: "prog_balanced_4",
      durableRevision: 12,
      source: "Recommend",
      compilerProvenance: predecessor.instance.provenance,
    },
    successorProgramId: "prog_balanced_3",
    predecessorInstance: predecessor.instance,
    compilerContext: predecessor.compilerContext,
    targetConstraint: { frequency: 3 },
    transitionId: "tr_p3a_diag_test",
    createdAt: "2026-10-02T10:00:00.000Z",
    services: { Compiler, catalogue: EXERCISE_LIBRARY },
  };

  // 1. Missing diagnosis (caller provides no diagnosis object)
  const missingDiag = await Transition.proposeSibling({
    ...baseOpts,
    diagnosis: null,
  });
  assert.equal(missingDiag.ok, false);
  assert.equal(missingDiag.status, "unavailable");
  assert.equal(missingDiag.code, "insufficient_transition_evidence");
  assert.equal(missingDiag.unavailable, true);

  // 2. Empty eligibleEvidenceIds (insufficient evidence)
  const emptyEvidence = await Transition.proposeSibling({
    ...baseOpts,
    diagnosis: {
      kind: "fewer_days",
      answers: { availableDays: 3 },
      eligibleEvidenceIds: [],
      insufficientEvidenceReasons: [],
    },
  });
  assert.equal(emptyEvidence.ok, false);
  assert.equal(emptyEvidence.status, "unavailable");
  assert.equal(emptyEvidence.code, "insufficient_transition_evidence");

  // 3. Nonempty insufficientEvidenceReasons
  const nonZeroReasons = await Transition.proposeSibling({
    ...baseOpts,
    diagnosis: {
      kind: "fewer_days",
      answers: { availableDays: 3 },
      eligibleEvidenceIds: ["sessions-14d-6-of-3"],
      insufficientEvidenceReasons: ["attendance_gap_unexplained"],
    },
  });
  assert.equal(nonZeroReasons.ok, false);
  assert.equal(nonZeroReasons.status, "unavailable");
  assert.equal(nonZeroReasons.code, "insufficient_transition_evidence");

  // 4. Wrong diagnosis kind for lower-frequency proposal
  const wrongKindLower = await Transition.proposeSibling({
    ...baseOpts,
    diagnosis: {
      kind: "sessions_too_long",
      answers: { availableDays: 3 },
      eligibleEvidenceIds: ["sessions-14d-6-of-3"],
      insufficientEvidenceReasons: [],
    },
  });
  assert.equal(wrongKindLower.ok, false);
  assert.equal(wrongKindLower.status, "unavailable");
  assert.equal(wrongKindLower.code, "insufficient_transition_evidence");

  // 5. Answer inconsistent with target constraint for lower-frequency proposal
  const inconsistentAnswerLower = await Transition.proposeSibling({
    ...baseOpts,
    targetConstraint: { frequency: 3 },
    diagnosis: {
      kind: "fewer_days",
      answers: { availableDays: 2 },
      eligibleEvidenceIds: ["sessions-14d-6-of-2"],
      insufficientEvidenceReasons: [],
    },
  });
  assert.equal(inconsistentAnswerLower.ok, false);
  assert.equal(inconsistentAnswerLower.status, "unavailable");
  assert.equal(inconsistentAnswerLower.code, "insufficient_transition_evidence");

  // 6. Wrong diagnosis kind for shorter-session proposal
  const wrongKindShorter = await Transition.proposeSibling({
    ...baseOpts,
    kind: "shorter_session_sibling",
    targetConstraint: { sessionMinutes: 60 },
    successorProgramId: "prog_balanced_4_60m",
    diagnosis: {
      kind: "fewer_days",
      answers: { sessionMinutes: 60 },
      eligibleEvidenceIds: ["session-duration-90-to-60-d1"],
      insufficientEvidenceReasons: [],
    },
  });
  assert.equal(wrongKindShorter.ok, false);
  assert.equal(wrongKindShorter.status, "unavailable");
  assert.equal(wrongKindShorter.code, "insufficient_transition_evidence");

  // 7. Answer inconsistent with target constraint for shorter-session proposal
  const inconsistentAnswerShorter = await Transition.proposeSibling({
    ...baseOpts,
    kind: "shorter_session_sibling",
    targetConstraint: { sessionMinutes: 60 },
    successorProgramId: "prog_balanced_4_60m",
    diagnosis: {
      kind: "sessions_too_long",
      answers: { sessionMinutes: 45 },
      eligibleEvidenceIds: ["session-duration-90-to-45-d1"],
      insufficientEvidenceReasons: [],
    },
  });
  assert.equal(inconsistentAnswerShorter.ok, false);
  assert.equal(inconsistentAnswerShorter.status, "unavailable");
  assert.equal(inconsistentAnswerShorter.code, "insufficient_transition_evidence");
});

test("proposeSibling returns typed Unavailable when successor identity is omitted or reused", async () => {
  const predecessor = compilePredecessor(4, 90);

  const baseOpts = {
    kind: "lower_frequency_sibling",
    predecessor: {
      programId: "prog_balanced_4",
      durableRevision: 12,
      source: "Recommend",
      compilerProvenance: predecessor.instance.provenance,
    },
    predecessorInstance: predecessor.instance,
    compilerContext: predecessor.compilerContext,
    targetConstraint: { frequency: 3 },
    diagnosis: {
      kind: "fewer_days",
      answers: { availableDays: 3 },
      eligibleEvidenceIds: ["sessions-14d-6-of-3"],
      insufficientEvidenceReasons: [],
    },
    transitionId: "tr_p3a_identity_test",
    createdAt: "2026-10-02T10:00:00.000Z",
    services: { Compiler, catalogue: EXERCISE_LIBRARY },
  };

  // 1. Missing successorProgramId and missing successor.programId
  const omittedIdentity = await Transition.proposeSibling({
    ...baseOpts,
  });
  assert.equal(omittedIdentity.ok, false);
  assert.equal(omittedIdentity.status, "unavailable");
  assert.equal(omittedIdentity.code, "successor_identity_invalid");
  assert.equal(omittedIdentity.unavailable, true);

  // 2. Reused predecessor programId
  const reusedIdentity = await Transition.proposeSibling({
    ...baseOpts,
    successorProgramId: "prog_balanced_4",
  });
  assert.equal(reusedIdentity.ok, false);
  assert.equal(reusedIdentity.status, "unavailable");
  assert.equal(reusedIdentity.code, "successor_identity_invalid");
});

test("proposeSibling returns typed Unavailable for missing context, customized snapshot, unsupported version, or unsupported source", async () => {
  const predecessor = compilePredecessor(4, 90);

  const validDiagnosis = {
    kind: "fewer_days",
    answers: { availableDays: 3 },
    eligibleEvidenceIds: ["sessions-14d-6-of-3"],
    insufficientEvidenceReasons: [],
  };

  // 1. Missing compiler context
  const missingCtx = await Transition.proposeSibling({
    kind: "lower_frequency_sibling",
    predecessor: {
      programId: "prog_balanced_4",
      durableRevision: 1,
      source: "Recommend",
      compilerProvenance: predecessor.instance.provenance,
    },
    successorProgramId: "prog_balanced_3",
    predecessorInstance: predecessor.instance,
    compilerContext: null,
    targetConstraint: { frequency: 3 },
    diagnosis: validDiagnosis,
    transitionId: "tr_p3a_test_fail",
    createdAt: "2026-10-02T10:00:00.000Z",
    services: { Compiler, catalogue: EXERCISE_LIBRARY },
  });
  assert.equal(missingCtx.ok, false);
  assert.equal(missingCtx.status, "unavailable");
  assert.equal(missingCtx.code, "missing_compiler_context");

  // 2. Customized snapshot
  const customizedInstance = structuredClone(predecessor.instance);
  customizedInstance.customizedFrom = { blueprintId: "balanced_4_v1" };
  const customized = await Transition.proposeSibling({
    kind: "lower_frequency_sibling",
    predecessor: {
      programId: "prog_balanced_4",
      durableRevision: 1,
      source: "Recommend",
      compilerProvenance: predecessor.instance.provenance,
    },
    successorProgramId: "prog_balanced_3",
    predecessorInstance: customizedInstance,
    compilerContext: predecessor.compilerContext,
    targetConstraint: { frequency: 3 },
    diagnosis: validDiagnosis,
    transitionId: "tr_p3a_test_fail",
    createdAt: "2026-10-02T10:00:00.000Z",
    services: { Compiler, catalogue: EXERCISE_LIBRARY },
  });
  assert.equal(customized.ok, false);
  assert.equal(customized.status, "unavailable");
  assert.equal(customized.code, "customized_compiler_snapshot");

  // 3. Unsupported version / version drift
  const driftedProv = structuredClone(predecessor.instance.provenance);
  driftedProv.compilerVersion = 999;
  const drifted = await Transition.proposeSibling({
    kind: "lower_frequency_sibling",
    predecessor: {
      programId: "prog_balanced_4",
      durableRevision: 1,
      source: "Recommend",
      compilerProvenance: driftedProv,
    },
    successorProgramId: "prog_balanced_3",
    predecessorInstance: predecessor.instance,
    compilerContext: predecessor.compilerContext,
    targetConstraint: { frequency: 3 },
    diagnosis: validDiagnosis,
    transitionId: "tr_p3a_test_fail",
    createdAt: "2026-10-02T10:00:00.000Z",
    services: { Compiler, catalogue: EXERCISE_LIBRARY },
  });
  assert.equal(drifted.ok, false);
  assert.equal(drifted.status, "unavailable");
  assert.equal(drifted.code, "unsupported_version");

  // 4. Unsupported source: Import
  const imported = await Transition.proposeSibling({
    kind: "lower_frequency_sibling",
    predecessor: {
      programId: "prog_balanced_4",
      durableRevision: 1,
      source: "Import",
      compilerProvenance: predecessor.instance.provenance,
    },
    successorProgramId: "prog_balanced_3",
    predecessorInstance: predecessor.instance,
    compilerContext: predecessor.compilerContext,
    targetConstraint: { frequency: 3 },
    diagnosis: validDiagnosis,
    transitionId: "tr_p3a_test_fail",
    createdAt: "2026-10-02T10:00:00.000Z",
    services: { Compiler, catalogue: EXERCISE_LIBRARY },
  });
  assert.equal(imported.ok, false);
  assert.equal(imported.status, "unavailable");
  assert.equal(imported.code, "unsupported_source");

  // 5. Unsupported source: Build
  const built = await Transition.proposeSibling({
    kind: "lower_frequency_sibling",
    predecessor: {
      programId: "prog_balanced_4",
      durableRevision: 1,
      source: "Build",
      compilerProvenance: predecessor.instance.provenance,
    },
    successorProgramId: "prog_balanced_3",
    predecessorInstance: predecessor.instance,
    compilerContext: predecessor.compilerContext,
    targetConstraint: { frequency: 3 },
    diagnosis: validDiagnosis,
    transitionId: "tr_p3a_test_fail",
    createdAt: "2026-10-02T10:00:00.000Z",
    services: { Compiler, catalogue: EXERCISE_LIBRARY },
  });
  assert.equal(built.ok, false);
  assert.equal(built.status, "unavailable");
  assert.equal(built.code, "unsupported_source");

  // 6. Arbitrary source string rejected (strict positive allowlist of reconstructable sources)
  const arbitrarySource = await Transition.proposeSibling({
    kind: "lower_frequency_sibling",
    predecessor: {
      programId: "prog_balanced_4",
      durableRevision: 1,
      source: "ArbitraryCustomRoute",
      compilerProvenance: predecessor.instance.provenance,
    },
    successorProgramId: "prog_balanced_3",
    predecessorInstance: predecessor.instance,
    compilerContext: predecessor.compilerContext,
    targetConstraint: { frequency: 3 },
    diagnosis: validDiagnosis,
    transitionId: "tr_p3a_test_fail",
    createdAt: "2026-10-02T10:00:00.000Z",
    services: { Compiler, catalogue: EXERCISE_LIBRARY },
  });
  assert.equal(arbitrarySource.ok, false);
  assert.equal(arbitrarySource.status, "unavailable");
  assert.equal(arbitrarySource.code, "unsupported_source");
});

test("freshly rehashed tampered shorter_session proposals are semantically rejected by validateProposal", async () => {
  const predecessor = compilePredecessor(4, 90);

  const baseResult = await Transition.proposeSibling({
    kind: "shorter_session_sibling",
    predecessor: {
      programId: "prog_balanced_4_90m",
      durableRevision: 5,
      source: "Recommend",
      compilerProvenance: predecessor.instance.provenance,
    },
    successorProgramId: "prog_balanced_4_60m",
    predecessorInstance: predecessor.instance,
    compilerContext: predecessor.compilerContext,
    targetConstraint: { sessionMinutes: 60 },
    diagnosis: {
      kind: "sessions_too_long",
      answers: { sessionMinutes: 60 },
      eligibleEvidenceIds: ["session-duration-90-to-60-d1"],
      insufficientEvidenceReasons: [],
    },
    transitionId: "tr_p3a_rehash_tamper",
    createdAt: "2026-10-02T11:00:00.000Z",
    services: { Compiler, catalogue: EXERCISE_LIBRARY },
  });
  assert.equal(baseResult.ok, true);

  const baseValidationContext = {
    predecessor: {
      programId: "prog_balanced_4_90m",
      durableRevision: 5,
      source: "Recommend",
    },
    predecessorInstance: predecessor.instance,
    successorInstance: baseResult.successorInstance,
    predecessorCompilerContext: predecessor.compilerContext,
    successorCompilerContext: baseResult.successorCompilerContext,
  };

  // 1. Tamper: kind changed to wrong_kind and freshly rehashed
  const wrongKind = structuredClone(baseResult.proposal);
  wrongKind.kind = "unsupported_kind";
  wrongKind.proposalHash = await Transition.hashProposal(wrongKind);
  const v1 = await Transition.validateProposal(wrongKind, baseValidationContext);
  assert.equal(v1.ok, false);
  assert.equal(v1.status, "invalid");

  // 2. Tamper: shorter_session_sibling paired with fewer_days diagnosis and freshly rehashed
  const wrongDiag = structuredClone(baseResult.proposal);
  wrongDiag.diagnosis.kind = "fewer_days";
  wrongDiag.diagnosis.answers = { availableDays: 3 };
  wrongDiag.proposalHash = await Transition.hashProposal(wrongDiag);
  const v2 = await Transition.validateProposal(wrongDiag, baseValidationContext);
  assert.equal(v2.ok, false);
  assert.equal(v2.status, "invalid");
  assert.equal(v2.code, "insufficient_transition_evidence");

  // 2b. Tamper: empty eligibleEvidenceIds and freshly rehashed
  const emptyEvidenceProposal = structuredClone(baseResult.proposal);
  emptyEvidenceProposal.diagnosis.eligibleEvidenceIds = [];
  emptyEvidenceProposal.proposalHash = await Transition.hashProposal(emptyEvidenceProposal);
  const v2b = await Transition.validateProposal(emptyEvidenceProposal, baseValidationContext);
  assert.equal(v2b.ok, false);
  assert.equal(v2b.status, "invalid");
  assert.equal(v2b.code, "insufficient_transition_evidence");

  // 2c. Tamper: nonempty insufficientEvidenceReasons and freshly rehashed
  const nonZeroReasonsProposal = structuredClone(baseResult.proposal);
  nonZeroReasonsProposal.diagnosis.insufficientEvidenceReasons = ["reason_unexplained"];
  nonZeroReasonsProposal.proposalHash = await Transition.hashProposal(nonZeroReasonsProposal);
  const v2c = await Transition.validateProposal(nonZeroReasonsProposal, baseValidationContext);
  assert.equal(v2c.ok, false);
  assert.equal(v2c.status, "invalid");
  assert.equal(v2c.code, "insufficient_transition_evidence");

  // 2d. Tamper: diagnosis answers inconsistent with successor context (sessionMinutes mismatch) and freshly rehashed
  const inconsistentAnswerProposal = structuredClone(baseResult.proposal);
  inconsistentAnswerProposal.diagnosis.answers.sessionMinutes = 45;
  inconsistentAnswerProposal.proposalHash = await Transition.hashProposal(inconsistentAnswerProposal);
  const v2d = await Transition.validateProposal(inconsistentAnswerProposal, baseValidationContext);
  assert.equal(v2d.ok, false);
  assert.equal(v2d.status, "invalid");
  assert.equal(v2d.code, "insufficient_transition_evidence");

  // 3. Tamper: shorter_session_sibling where frequency was reduced and freshly rehashed
  const wrongFreqContext = structuredClone(baseValidationContext);
  const threeDayComp = compilePredecessor(3, 60);
  wrongFreqContext.successorInstance = threeDayComp.instance;
  wrongFreqContext.successorCompilerContext = threeDayComp.compilerContext;
  const tamperedFreqProposal = structuredClone(baseResult.proposal);
  tamperedFreqProposal.derivation.slotMapping = Transition.buildSlotMapping(predecessor.instance, threeDayComp.instance);
  tamperedFreqProposal.diff = Transition.buildExactDiff(predecessor.instance, threeDayComp.instance, tamperedFreqProposal.derivation.slotMapping);
  tamperedFreqProposal.proposalHash = await Transition.hashProposal(tamperedFreqProposal);
  const v3 = await Transition.validateProposal(tamperedFreqProposal, wrongFreqContext);
  assert.equal(v3.ok, false);
  assert.equal(v3.status, "invalid");
  assert.equal(v3.code, "invalid_sibling_derivation");

  // 4. Tamper: shorter_session_sibling where duration was not shortened (e.g. 90m -> 90m) and freshly rehashed
  const wrongDuration = structuredClone(baseResult.proposal);
  wrongDuration.diagnosis.answers.sessionMinutes = 90;
  wrongDuration.proposalHash = await Transition.hashProposal(wrongDuration);
  const v4 = await Transition.validateProposal(wrongDuration, baseValidationContext);
  assert.equal(v4.ok, false);
  assert.equal(v4.status, "invalid");
  // Since sessionMinutes (90) != successorCompilerContext (60), it's rejected as inconsistent evidence
  assert.equal(v4.code, "insufficient_transition_evidence");

  // 5. Tamper: forbidden lifecycle field (confirmedAt) injected and freshly rehashed
  const forbiddenLifecycle = structuredClone(baseResult.proposal);
  forbiddenLifecycle.confirmedAt = "2026-10-02T12:00:00.000Z";
  // proposalHash excludes confirmedAt by contract, but presence in proposal must fail validation
  const v5 = await Transition.validateProposal(forbiddenLifecycle, baseValidationContext);
  assert.equal(v5.ok, false);
  assert.equal(v5.status, "invalid");
  assert.equal(v5.code, "forbidden_lifecycle_field");

  // 6. Tamper: forbidden recovery overlay injected and freshly rehashed
  const forbiddenRecovery = structuredClone(baseResult.proposal);
  forbiddenRecovery.diff.recoveryWeek = { activePeriod: "nextBlockWeek1" };
  forbiddenRecovery.proposalHash = await Transition.hashProposal(forbiddenRecovery);
  const v6 = await Transition.validateProposal(forbiddenRecovery, baseValidationContext);
  assert.equal(v6.ok, false);
  assert.equal(v6.status, "invalid");
  assert.equal(v6.code, "forbidden_recovery_week");
});

test("sibling source provenance is strictly preserved at producer and consumer boundaries", async () => {
  const predecessor = compilePredecessor(4, 90);

  // 1. Valid lower-frequency proposal baseline with source: "Recommend"
  const validLower = await Transition.proposeSibling({
    kind: "lower_frequency_sibling",
    predecessor: {
      programId: "prog_balanced_4",
      durableRevision: 12,
      source: "Recommend",
      compilerProvenance: predecessor.instance.provenance,
    },
    successorProgramId: "prog_balanced_3",
    predecessorInstance: predecessor.instance,
    compilerContext: predecessor.compilerContext,
    targetConstraint: { frequency: 3 },
    diagnosis: {
      kind: "fewer_days",
      answers: { availableDays: 3 },
      eligibleEvidenceIds: ["sessions-14d-6-of-3"],
      insufficientEvidenceReasons: [],
    },
    transitionId: "tr_p3a_source_prov_lower",
    createdAt: "2026-10-02T10:00:00.000Z",
    services: { Compiler, catalogue: EXERCISE_LIBRARY },
  });
  assert.equal(validLower.ok, true);

  const lowerValidationContext = {
    predecessor: {
      programId: "prog_balanced_4",
      durableRevision: 12,
      source: "Recommend",
    },
    predecessorInstance: predecessor.instance,
    successorInstance: validLower.successorInstance,
    predecessorCompilerContext: predecessor.compilerContext,
    successorCompilerContext: validLower.successorCompilerContext,
  };

  // Confirm baseline validates
  const baselineValidation = await Transition.validateProposal(validLower.proposal, lowerValidationContext);
  assert.deepEqual(baselineValidation, { ok: true, status: "preview" });

  // 2. Consumer boundary: freshly rehashed successor source mutations rejected by validateProposal
  // 2a. Successor source changed from "Recommend" to "Import" and freshly rehashed (Finding J52-07 reproduction)
  const tamperedImport = structuredClone(validLower.proposal);
  tamperedImport.successor.source = "Import";
  tamperedImport.proposalHash = await Transition.hashProposal(tamperedImport);
  const vImport = await Transition.validateProposal(tamperedImport, lowerValidationContext);
  assert.equal(vImport.ok, false);
  assert.equal(vImport.status, "invalid");
  assert.equal(vImport.code, "source_provenance_mismatch");

  // 2b. Successor source changed from "Recommend" to allowlisted "Browse" (allowlisted source drift) and freshly rehashed
  const tamperedBrowse = structuredClone(validLower.proposal);
  tamperedBrowse.successor.source = "Browse";
  tamperedBrowse.proposalHash = await Transition.hashProposal(tamperedBrowse);
  const vBrowse = await Transition.validateProposal(tamperedBrowse, lowerValidationContext);
  assert.equal(vBrowse.ok, false);
  assert.equal(vBrowse.status, "invalid");
  assert.equal(vBrowse.code, "source_provenance_mismatch");

  // 2c. Successor source changed from "Recommend" to lowercase "recommend" (case drift) and freshly rehashed
  const tamperedLowerRecommend = structuredClone(validLower.proposal);
  tamperedLowerRecommend.successor.source = "recommend";
  tamperedLowerRecommend.proposalHash = await Transition.hashProposal(tamperedLowerRecommend);
  const vLowerRec = await Transition.validateProposal(tamperedLowerRecommend, lowerValidationContext);
  assert.equal(vLowerRec.ok, false);
  assert.equal(vLowerRec.status, "invalid");
  assert.equal(vLowerRec.code, "source_provenance_mismatch");

  // 2d. Successor source changed from "Recommend" to arbitrary string and freshly rehashed
  const tamperedArbitrary = structuredClone(validLower.proposal);
  tamperedArbitrary.successor.source = "ArbitraryRoute";
  tamperedArbitrary.proposalHash = await Transition.hashProposal(tamperedArbitrary);
  const vArbitrary = await Transition.validateProposal(tamperedArbitrary, lowerValidationContext);
  assert.equal(vArbitrary.ok, false);
  assert.equal(vArbitrary.status, "invalid");
  assert.equal(vArbitrary.code, "source_provenance_mismatch");

  // 3. Consumer boundary with different allowlisted predecessor source: "Browse"
  const validBrowseLower = await Transition.proposeSibling({
    kind: "lower_frequency_sibling",
    predecessor: {
      programId: "prog_balanced_4_browse",
      durableRevision: 8,
      source: "Browse",
      compilerProvenance: predecessor.instance.provenance,
    },
    successorProgramId: "prog_balanced_3_browse",
    predecessorInstance: predecessor.instance,
    compilerContext: predecessor.compilerContext,
    targetConstraint: { frequency: 3 },
    diagnosis: {
      kind: "fewer_days",
      answers: { availableDays: 3 },
      eligibleEvidenceIds: ["sessions-14d-6-of-3"],
      insufficientEvidenceReasons: [],
    },
    transitionId: "tr_p3a_source_browse_lower",
    createdAt: "2026-10-02T10:00:00.000Z",
    services: { Compiler, catalogue: EXERCISE_LIBRARY },
  });
  assert.equal(validBrowseLower.ok, true);

  const browseValidationContext = {
    predecessor: {
      programId: "prog_balanced_4_browse",
      durableRevision: 8,
      source: "Browse",
    },
    predecessorInstance: predecessor.instance,
    successorInstance: validBrowseLower.successorInstance,
    predecessorCompilerContext: predecessor.compilerContext,
    successorCompilerContext: validBrowseLower.successorCompilerContext,
  };

  const browseBaselineValidation = await Transition.validateProposal(validBrowseLower.proposal, browseValidationContext);
  assert.deepEqual(browseBaselineValidation, { ok: true, status: "preview" });

  // 3a. Successor source changed from "Browse" to allowlisted "Recommend" and freshly rehashed
  const browseTamperedRecommend = structuredClone(validBrowseLower.proposal);
  browseTamperedRecommend.successor.source = "Recommend";
  browseTamperedRecommend.proposalHash = await Transition.hashProposal(browseTamperedRecommend);
  const vBrowseTamperedRec = await Transition.validateProposal(browseTamperedRecommend, browseValidationContext);
  assert.equal(vBrowseTamperedRec.ok, false);
  assert.equal(vBrowseTamperedRec.status, "invalid");
  assert.equal(vBrowseTamperedRec.code, "source_provenance_mismatch");

  // 3b. Successor source changed from "Browse" to "Import" and freshly rehashed
  const browseTamperedImport = structuredClone(validBrowseLower.proposal);
  browseTamperedImport.successor.source = "Import";
  browseTamperedImport.proposalHash = await Transition.hashProposal(browseTamperedImport);
  const vBrowseTamperedImport = await Transition.validateProposal(browseTamperedImport, browseValidationContext);
  assert.equal(vBrowseTamperedImport.ok, false);
  assert.equal(vBrowseTamperedImport.status, "invalid");
  assert.equal(vBrowseTamperedImport.code, "source_provenance_mismatch");

  // 4. Producer boundary: direct createSiblingProposal input checks
  const targetContext = { ...structuredClone(predecessor.compilerContext), frequency: 3 };
  delete targetContext.splitId;
  const successorInstance = Compiler.compile(targetContext, EXERCISE_LIBRARY);

  function baseDirectInput(predecessorSource, successorSource) {
    return {
      transitionId: "tr_direct_source_test",
      createdAt: "2026-10-02T10:00:00.000Z",
      kind: "lower_frequency_sibling",
      request: "lower-frequency-sibling",
      predecessor: {
        programId: "prog_balanced_4",
        durableRevision: 12,
        source: predecessorSource,
        compilerProvenance: predecessor.instance.provenance,
      },
      successor: {
        programId: "prog_balanced_3",
        source: successorSource,
        compilerProvenance: successorInstance.provenance,
      },
      predecessorInstance: predecessor.instance,
      successorInstance,
      predecessorCompilerContext: predecessor.compilerContext,
      successorCompilerContext: targetContext,
      supportedVersions: Compiler.VERSIONS,
      diagnosis: {
        kind: "fewer_days",
        answers: { availableDays: 3 },
        eligibleEvidenceIds: ["sessions-14d-6-of-3"],
        insufficientEvidenceReasons: [],
      },
    };
  }

  // 4a. Direct input with predecessor "Recommend" and successor "Import"
  const directImport = await Transition.createSiblingProposal(baseDirectInput("Recommend", "Import"));
  assert.equal(directImport.ok, false);
  assert.equal(directImport.code, "source_provenance_mismatch");

  // 4b. Direct input with predecessor "Recommend" and successor "Browse"
  const directBrowse = await Transition.createSiblingProposal(baseDirectInput("Recommend", "Browse"));
  assert.equal(directBrowse.ok, false);
  assert.equal(directBrowse.code, "source_provenance_mismatch");

  // 4c. Direct input with predecessor "Recommend" and successor "recommend"
  const directLowerRec = await Transition.createSiblingProposal(baseDirectInput("Recommend", "recommend"));
  assert.equal(directLowerRec.ok, false);
  assert.equal(directLowerRec.code, "source_provenance_mismatch");

  // 4d. Direct input with predecessor "Recommend" and successor arbitrary
  const directArbitrary = await Transition.createSiblingProposal(baseDirectInput("Recommend", "ArbitraryRoute"));
  assert.equal(directArbitrary.ok, false);
  assert.equal(directArbitrary.code, "source_provenance_mismatch");

  // 4e. Direct input with predecessor "Browse" and successor "Recommend"
  const directBrowseToRec = await Transition.createSiblingProposal(baseDirectInput("Browse", "Recommend"));
  assert.equal(directBrowseToRec.ok, false);
  assert.equal(directBrowseToRec.code, "source_provenance_mismatch");

  // 4f. Direct input with predecessor "Browse" and successor "Import"
  const directBrowseToImport = await Transition.createSiblingProposal(baseDirectInput("Browse", "Import"));
  assert.equal(directBrowseToImport.ok, false);
  assert.equal(directBrowseToImport.code, "source_provenance_mismatch");
});

const FAMILIES_FIXTURE_ORDER = ["growth", "balanced", "strength", "home"];
const SHORTER_SESSION_TARGETS = [75, 60, 45, 30];

function stableFamilyContext(familyId, frequency, sessionMinutes = 90) {
  const base = familyId === "home"
    ? {
        equipment: [],
        environment: [],
        loadIncrements: {},
      }
    : {
        equipment: ["barbell", "dumbbell", "machine", "cable", "smith"],
        environment: ["safe_pull", "training_support"],
        loadIncrements: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 5, smith: 2.5 },
      };
  return {
    schemaVersion: Compiler.VERSIONS.context,
    familyId,
    frequency,
    sessionMinutes,
    preferredRestSeconds: 90,
    primaryMuscles: [],
    deEmphasizedMuscles: [],
    ignoredMuscles: [],
    priorityMovements: [],
    ...base,
  };
}

const isShorterSessionSupported = (familyId, frequency, targetMinutes) => {
  if (targetMinutes >= 45) return true;
  if (targetMinutes === 30) {
    if (familyId === "growth" || familyId === "home") return true;
    if ((familyId === "balanced" || familyId === "strength") && frequency === 6) return true;
    return false;
  }
  return false;
};

test("all-family lower-frequency sibling matrix proves 40 supported pairs and 4 target-1 rejections", async () => {
  let supportedPairsCount = 0;
  let target1RejectionsCount = 0;
  const testedFamilies = new Set();
  const testedPairsByFamily = new Map();

  for (const familyId of FAMILIES_FIXTURE_ORDER) {
    testedFamilies.add(familyId);
    testedPairsByFamily.set(familyId, []);

    // 1. All same-family authored targets below each source, target ascending
    for (let sourceFreq = 3; sourceFreq <= 6; sourceFreq++) {
      for (let targetFreq = 2; targetFreq < sourceFreq; targetFreq++) {
        supportedPairsCount++;
        testedPairsByFamily.get(familyId).push(`${sourceFreq}->${targetFreq}`);

        const sourceCtx = stableFamilyContext(familyId, sourceFreq, 90);
        const sourceInst = Compiler.compile(sourceCtx, EXERCISE_LIBRARY);
        assert.equal(sourceInst.kind, "compiled");

        const targetBlueprint = Compiler.BLUEPRINTS.find(
          (bp) => bp.familyId === familyId && bp.frequency === targetFreq,
        );
        assert(targetBlueprint, `authored blueprint for ${familyId} ${targetFreq} must exist`);

        const transitionId = `tr_${familyId}_${sourceFreq}_to_${targetFreq}`;
        const input = {
          compiler: Compiler,
          catalogue: EXERCISE_LIBRARY,
          transitionId,
          createdAt: "2026-10-02T10:00:00.000Z",
          kind: "lower_frequency_sibling",
          predecessor: {
            programId: `prog_${familyId}_${sourceFreq}`,
            durableRevision: 1,
            source: "Recommend",
            compilerProvenance: sourceInst.provenance,
          },
          predecessorInstance: sourceInst,
          predecessorCompilerContext: sourceCtx,
          targetConstraint: { availableDays: targetFreq },
          successorProgramId: `prog_${familyId}_${targetFreq}`,
          diagnosis: {
            kind: "fewer_days",
            answers: { availableDays: targetFreq },
            eligibleEvidenceIds: [`ev-${familyId}-${sourceFreq}-${targetFreq}`],
            insufficientEvidenceReasons: [],
          },
        };

        const result = await Transition.proposeSibling(input);
        assert.equal(result.ok, true, `proposeSibling failed for ${familyId} ${sourceFreq}->${targetFreq}: ${result.code}`);
        assert.equal(result.status, "preview");
        assert(result.proposal, "returns immutable proposal");
        assert(Object.isFrozen(result.proposal));

        // Exact family & target frequency
        assert.equal(result.proposal.kind, "lower_frequency_sibling");
        assert.equal(result.successorInstance.familyId, familyId);
        assert.equal(result.successorInstance.frequency, targetFreq);
        assert.equal(result.successorInstance.blueprintId, targetBlueprint.id);
        assert.equal(result.successorCompilerContext.frequency, targetFreq);

        // Current versions and provenance
        assert.equal(result.proposal.successor.compilerProvenance.familyVersion, targetBlueprint.familyVersion);
        assert.equal(result.proposal.successor.compilerProvenance.compilerVersion, Compiler.VERSIONS.compiler);
        assert.equal(result.proposal.successor.compilerProvenance.rulesVersion, Compiler.VERSIONS.rules);
        assert.equal(result.proposal.successor.compilerProvenance.catalogueVersion, Compiler.VERSIONS.catalogue);

        // Full real compiler result
        assert.equal(result.successorInstance.kind, "compiled");
        assert(Array.isArray(result.successorInstance.days) && result.successorInstance.days.length === targetFreq);

        // Canonical complete mapping & diff
        assert(Array.isArray(result.proposal.derivation.slotMapping.slots));
        assert(result.proposal.derivation.slotMapping.slots.length > 0);
        assert(Array.isArray(result.proposal.diff.days));
        assert(Array.isArray(result.proposal.diff.exercises));
        assert(Array.isArray(result.proposal.diff.prescriptions));

        // Source equality
        assert.equal(result.proposal.predecessor.source, "Recommend");
        assert.equal(result.proposal.successor.source, "Recommend");

        // Relation contract
        assert(Array.isArray(result.proposal.progressionContract.preservedRelations));
        assert(Array.isArray(result.proposal.progressionContract.resetRelations));
        assert(Array.isArray(result.proposal.progressionContract.incompatibilities));

        // Fresh IDs and hash
        assert.equal(result.proposal.predecessor.programId, `prog_${familyId}_${sourceFreq}`);
        assert.equal(result.proposal.successor.programId, `prog_${familyId}_${targetFreq}`);
        assert.notEqual(result.proposal.successor.programId, result.proposal.predecessor.programId);
        const computedHash = await Transition.hashProposal(result.proposal);
        assert.equal(result.proposal.proposalHash, computedHash);

        // validateProposal success
        const validation = await Transition.validateProposal(result.proposal, {
          predecessor: {
            programId: `prog_${familyId}_${sourceFreq}`,
            durableRevision: 1,
            source: "Recommend",
          },
          predecessorInstance: sourceInst,
          successorInstance: result.successorInstance,
          predecessorCompilerContext: sourceCtx,
          successorCompilerContext: result.successorCompilerContext,
        });
        assert.deepEqual(validation, { ok: true, status: "preview" });
      }
    }

    // 2. Source-frequency-2 request to target 1 proves no fallback family/blueprint and typed Unavailable
    target1RejectionsCount++;
    const source2Ctx = stableFamilyContext(familyId, 2, 90);
    const source2Inst = Compiler.compile(source2Ctx, EXERCISE_LIBRARY);
    const unavailResult = await Transition.proposeSibling({
      compiler: Compiler,
      catalogue: EXERCISE_LIBRARY,
      transitionId: `tr_${familyId}_2_to_1`,
      createdAt: "2026-10-02T10:00:00.000Z",
      kind: "lower_frequency_sibling",
      predecessor: {
        programId: `prog_${familyId}_2`,
        durableRevision: 1,
        source: "Recommend",
        compilerProvenance: source2Inst.provenance,
      },
      predecessorInstance: source2Inst,
      predecessorCompilerContext: source2Ctx,
      targetConstraint: { availableDays: 1 },
      successorProgramId: `prog_${familyId}_1`,
      diagnosis: {
        kind: "fewer_days",
        answers: { availableDays: 1 },
        eligibleEvidenceIds: [`ev-${familyId}-2-1`],
        insufficientEvidenceReasons: [],
      },
    });
    assert.equal(unavailResult.ok, false);
    assert.equal(unavailResult.status, "unavailable");
    assert.equal(unavailResult.unavailable, true);
    assert.equal(unavailResult.code, "sibling_blueprint_not_found");
    assert.equal(unavailResult.proposal, undefined);
    assert.equal(unavailResult.successorInstance, undefined);
  }

  // Exact counts
  assert.equal(testedFamilies.size, 4);
  assert.equal(supportedPairsCount, 40);
  assert.equal(target1RejectionsCount, 4);
  for (const familyId of FAMILIES_FIXTURE_ORDER) {
    assert.equal(testedPairsByFamily.get(familyId).length, 10);
  }
});

test("all-family shorter-session sibling matrix proves 72 supported rows and 8 unavailable rows", async () => {
  let supportedCount = 0;
  let unavailableCount = 0;
  const testedFamilies = new Set();
  const resultsByFamily = new Map();

  for (const familyId of FAMILIES_FIXTURE_ORDER) {
    testedFamilies.add(familyId);
    resultsByFamily.set(familyId, { supported: 0, unavailable: 0 });

    for (let freq = 2; freq <= 6; freq++) {
      for (const targetMins of SHORTER_SESSION_TARGETS) {
        const sourceCtx = stableFamilyContext(familyId, freq, 90);
        const sourceInst = Compiler.compile(sourceCtx, EXERCISE_LIBRARY);
        assert.equal(sourceInst.kind, "compiled");

        const isSupported = isShorterSessionSupported(familyId, freq, targetMins);
        const transitionId = `tr_${familyId}_${freq}_${targetMins}m`;

        const result = await Transition.proposeSibling({
          compiler: Compiler,
          catalogue: EXERCISE_LIBRARY,
          transitionId,
          createdAt: "2026-10-02T11:00:00.000Z",
          kind: "shorter_session_sibling",
          predecessor: {
            programId: `prog_${familyId}_${freq}_90m`,
            durableRevision: 1,
            source: "Recommend",
            compilerProvenance: sourceInst.provenance,
          },
          predecessorInstance: sourceInst,
          predecessorCompilerContext: sourceCtx,
          targetConstraint: { sessionMinutes: targetMins },
          successorProgramId: `prog_${familyId}_${freq}_${targetMins}m`,
          diagnosis: {
            kind: "sessions_too_long",
            answers: { sessionMinutes: targetMins },
            eligibleEvidenceIds: [`ev-${familyId}-${freq}-${targetMins}`],
            insufficientEvidenceReasons: [],
          },
        });

        if (isSupported) {
          supportedCount++;
          resultsByFamily.get(familyId).supported++;

          assert.equal(result.ok, true, `expected supported for ${familyId} ${freq}d @ ${targetMins}m, got ${result.code}`);
          assert.equal(result.status, "preview");
          assert(result.proposal, "returns immutable proposal");
          assert(Object.isFrozen(result.proposal));

          // Retains exact family and frequency
          assert.equal(result.proposal.kind, "shorter_session_sibling");
          assert.equal(result.successorInstance.familyId, familyId);
          assert.equal(result.successorInstance.frequency, freq);
          assert.equal(result.successorCompilerContext.frequency, freq);
          assert.equal(result.successorCompilerContext.sessionMinutes, targetMins);

          // Every real day fits the requested ceiling
          for (const day of result.successorInstance.days) {
            const daySecs = Compiler.estimateDaySeconds(day, EXERCISE_LIBRARY);
            assert(
              daySecs <= targetMins * 60,
              `${familyId} ${freq}d @ ${targetMins}m: day ${day.dayId} duration ${daySecs}s exceeds ceiling ${targetMins * 60}s`,
            );
          }

          // Fresh IDs and hash
          assert.notEqual(result.proposal.successor.programId, result.proposal.predecessor.programId);
          const computedHash = await Transition.hashProposal(result.proposal);
          assert.equal(result.proposal.proposalHash, computedHash);

          // validateProposal succeeds
          const validation = await Transition.validateProposal(result.proposal, {
            predecessor: {
              programId: `prog_${familyId}_${freq}_90m`,
              durableRevision: 1,
              source: "Recommend",
            },
            predecessorInstance: sourceInst,
            successorInstance: result.successorInstance,
            predecessorCompilerContext: sourceCtx,
            successorCompilerContext: result.successorCompilerContext,
          });
          assert.deepEqual(validation, { ok: true, status: "preview" });
        } else {
          unavailableCount++;
          resultsByFamily.get(familyId).unavailable++;

          assert.equal(result.ok, false, `expected unavailable for ${familyId} ${freq}d @ ${targetMins}m`);
          assert.equal(result.status, "unavailable");
          assert.equal(result.unavailable, true);
          assert.equal(result.code, "sessions_too_long_unavailable");
          assert.equal(result.proposal, undefined, "must not return successor proposal");
          assert.equal(result.successorInstance, undefined, "must not return successor instance");
        }
      }
    }
  }

  // Exact counts
  assert.equal(testedFamilies.size, 4);
  assert.equal(supportedCount, 72);
  assert.equal(unavailableCount, 8);
  assert.deepEqual(resultsByFamily.get("growth"), { supported: 20, unavailable: 0 });
  assert.deepEqual(resultsByFamily.get("home"), { supported: 20, unavailable: 0 });
  assert.deepEqual(resultsByFamily.get("balanced"), { supported: 16, unavailable: 4 });
  assert.deepEqual(resultsByFamily.get("strength"), { supported: 16, unavailable: 4 });
});

test("compact matrix negatives reject Build, Import, Shared, arbitrary source, customization, and version drift while accepting Custom", async () => {
  const baseCtx = stableFamilyContext("balanced", 4, 90);
  const baseInst = Compiler.compile(baseCtx, EXERCISE_LIBRARY);

  const makeInput = (overrides = {}) => ({
    compiler: Compiler,
    catalogue: EXERCISE_LIBRARY,
    transitionId: "tr_matrix_negative_test",
    createdAt: "2026-10-02T10:00:00.000Z",
    kind: "lower_frequency_sibling",
    predecessor: {
      programId: "prog_balanced_4",
      durableRevision: 1,
      source: "Recommend",
      compilerProvenance: baseInst.provenance,
      ...(overrides.predecessor || {}),
    },
    predecessorInstance: overrides.predecessorInstance !== undefined ? overrides.predecessorInstance : baseInst,
    predecessorCompilerContext: overrides.predecessorCompilerContext !== undefined ? overrides.predecessorCompilerContext : baseCtx,
    targetConstraint: { availableDays: 3 },
    successorProgramId: "prog_balanced_3",
    diagnosis: {
      kind: "fewer_days",
      answers: { availableDays: 3 },
      eligibleEvidenceIds: ["ev-diag-test"],
      insufficientEvidenceReasons: [],
    },
    ...(overrides.top || {}),
  });

  // 1. Custom source is reconstructable and MUST be supported
  const customResult = await Transition.proposeSibling(makeInput({
    predecessor: { source: "Custom" },
  }));
  assert.equal(customResult.ok, true, "Custom source must be reconstructable");
  assert.equal(customResult.proposal.predecessor.source, "Custom");
  assert.equal(customResult.proposal.successor.source, "Custom");
  const customValidation = await Transition.validateProposal(customResult.proposal, {
    predecessor: { programId: "prog_balanced_4", durableRevision: 1, source: "Custom" },
    predecessorInstance: baseInst,
    successorInstance: customResult.successorInstance,
    predecessorCompilerContext: baseCtx,
    successorCompilerContext: customResult.successorCompilerContext,
  });
  assert.deepEqual(customValidation, { ok: true, status: "preview" });

  // 2. Build source rejected with typed unsupported_source
  const buildResult = await Transition.proposeSibling(makeInput({
    predecessor: { source: "Build" },
  }));
  assert.equal(buildResult.ok, false);
  assert.equal(buildResult.status, "unavailable");
  assert.equal(buildResult.code, "unsupported_source");

  // 3. Import source rejected with typed unsupported_source
  const importResult = await Transition.proposeSibling(makeInput({
    predecessor: { source: "Import" },
  }));
  assert.equal(importResult.ok, false);
  assert.equal(importResult.status, "unavailable");
  assert.equal(importResult.code, "unsupported_source");

  // 4. Shared source rejected with typed unsupported_source
  const sharedResult = await Transition.proposeSibling(makeInput({
    predecessor: { source: "Shared" },
  }));
  assert.equal(sharedResult.ok, false);
  assert.equal(sharedResult.status, "unavailable");
  assert.equal(sharedResult.code, "unsupported_source");

  // 5. Arbitrary source rejected with typed unsupported_source
  const arbitraryResult = await Transition.proposeSibling(makeInput({
    predecessor: { source: "ExternalSyncRoute" },
  }));
  assert.equal(arbitraryResult.ok, false);
  assert.equal(arbitraryResult.status, "unavailable");
  assert.equal(arbitraryResult.code, "unsupported_source");

  // 6. Customized snapshot rejected with typed customized_compiler_snapshot
  const customizedInst = structuredClone(baseInst);
  customizedInst.customizedFrom = { blueprintId: "balanced_4_v1" };
  const customizedResult = await Transition.proposeSibling(makeInput({
    predecessorInstance: customizedInst,
  }));
  assert.equal(customizedResult.ok, false);
  assert.equal(customizedResult.status, "unavailable");
  assert.equal(customizedResult.code, "customized_compiler_snapshot");

  // 7. Rules version drift rejected with typed unsupported_version
  const rulesDriftProv = { ...baseInst.provenance, rulesVersion: "rules-v999" };
  const rulesDriftResult = await Transition.proposeSibling(makeInput({
    predecessor: { compilerProvenance: rulesDriftProv },
  }));
  assert.equal(rulesDriftResult.ok, false);
  assert.equal(rulesDriftResult.status, "unavailable");
  assert.equal(rulesDriftResult.code, "unsupported_version");

  // 8. Unsupported historical compiler version rejected with typed unsupported_version
  const histCompilerProv = { ...baseInst.provenance, compilerVersion: 1 };
  const histCompilerResult = await Transition.proposeSibling(makeInput({
    predecessor: { compilerProvenance: histCompilerProv },
  }));
  assert.equal(histCompilerResult.ok, false);
  assert.equal(histCompilerResult.status, "unavailable");
  assert.equal(histCompilerResult.code, "unsupported_version");

  // 9. Context schema version drift (schemaVersion: 1 with legacy keys) rejected with typed unsupported_version
  const histContext = {
    schemaVersion: 1,
    familyId: "balanced",
    frequency: 4,
    sessionMinutes: 90,
    equipment: ["barbell", "dumbbell", "machine", "cable", "smith"],
    environment: ["safe_pull", "training_support"],
    loadIncrements: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 5, smith: 2.5 },
  };
  const histContextResult = await Transition.proposeSibling(makeInput({
    predecessorCompilerContext: histContext,
  }));
  assert.equal(histContextResult.ok, false);
  assert.equal(histContextResult.status, "unavailable");
  assert.equal(histContextResult.code, "unsupported_version");
});

test("deliberate mutation and omission controls fail on skipped family or frequency drift", async () => {
  // Control 1: Omission control - an incomplete family list fails an assertion
  const incompleteFamilies = ["growth", "balanced", "strength"]; // omitted home
  assert.throws(
    () => {
      assert.equal(incompleteFamilies.length, 4, "matrix must include all 4 families");
    },
    /matrix must include all 4 families/,
  );
  assert.throws(
    () => {
      for (const fam of FAMILIES_FIXTURE_ORDER) {
        assert(incompleteFamilies.includes(fam), `missing family ${fam}`);
      }
    },
    /missing family home/,
  );

  // Control 2: Duration fallback frequency mutation - a shorter-session proposal that
  // attempts to lower frequency to force a duration fit is rejected by validateProposal
  const sourceCtx = stableFamilyContext("balanced", 4, 90);
  const sourceInst = Compiler.compile(sourceCtx, EXERCISE_LIBRARY);

  // Proposal for 60m balanced 4
  const valid60m = await Transition.proposeSibling({
    compiler: Compiler,
    catalogue: EXERCISE_LIBRARY,
    transitionId: "tr_control_mutation",
    createdAt: "2026-10-02T11:00:00.000Z",
    kind: "shorter_session_sibling",
    predecessor: {
      programId: "prog_balanced_4",
      durableRevision: 1,
      source: "Recommend",
      compilerProvenance: sourceInst.provenance,
    },
    predecessorInstance: sourceInst,
    predecessorCompilerContext: sourceCtx,
    targetConstraint: { sessionMinutes: 60 },
    successorProgramId: "prog_balanced_4_60m",
    diagnosis: {
      kind: "sessions_too_long",
      answers: { sessionMinutes: 60 },
      eligibleEvidenceIds: ["ev-ctrl-1"],
      insufficientEvidenceReasons: [],
    },
  });
  assert.equal(valid60m.ok, true);

  // Mutate successor to 3-day (mimicking a resolver that silently reduced frequency)
  const threeDayCtx = stableFamilyContext("balanced", 3, 60);
  const threeDayInst = Compiler.compile(threeDayCtx, EXERCISE_LIBRARY);

  const tamperedProposal = structuredClone(valid60m.proposal);
  tamperedProposal.derivation.slotMapping = Transition.buildSlotMapping(sourceInst, threeDayInst);
  tamperedProposal.diff = Transition.buildExactDiff(sourceInst, threeDayInst, tamperedProposal.derivation.slotMapping);
  tamperedProposal.proposalHash = await Transition.hashProposal(tamperedProposal);

  const tamperedValidation = await Transition.validateProposal(tamperedProposal, {
    predecessor: {
      programId: "prog_balanced_4",
      durableRevision: 1,
      source: "Recommend",
    },
    predecessorInstance: sourceInst,
    successorInstance: threeDayInst,
    predecessorCompilerContext: sourceCtx,
    successorCompilerContext: threeDayCtx,
  });
  assert.equal(tamperedValidation.ok, false);
  assert.equal(tamperedValidation.status, "invalid");
  assert.equal(tamperedValidation.code, "invalid_sibling_derivation");

  // Control 3: Lower-frequency target mutation - successor frequency >= predecessor frequency rejected
  const equalFreqCtx = stableFamilyContext("balanced", 4, 90);
  const equalFreqInst = Compiler.compile(equalFreqCtx, EXERCISE_LIBRARY);
  const tamperedLowerProposal = structuredClone(valid60m.proposal);
  tamperedLowerProposal.kind = "lower_frequency_sibling";
  tamperedLowerProposal.diagnosis = {
    kind: "fewer_days",
    answers: { availableDays: 4 },
    eligibleEvidenceIds: ["ev-ctrl-2"],
    insufficientEvidenceReasons: [],
  };
  tamperedLowerProposal.derivation.slotMapping = Transition.buildSlotMapping(sourceInst, equalFreqInst);
  tamperedLowerProposal.diff = Transition.buildExactDiff(sourceInst, equalFreqInst, tamperedLowerProposal.derivation.slotMapping);
  tamperedLowerProposal.proposalHash = await Transition.hashProposal(tamperedLowerProposal);

  const tamperedLowerValidation = await Transition.validateProposal(tamperedLowerProposal, {
    predecessor: {
      programId: "prog_balanced_4",
      durableRevision: 1,
      source: "Recommend",
    },
    predecessorInstance: sourceInst,
    successorInstance: equalFreqInst,
    predecessorCompilerContext: sourceCtx,
    successorCompilerContext: equalFreqCtx,
  });
  assert.equal(tamperedLowerValidation.ok, false);
  assert.equal(tamperedLowerValidation.status, "invalid");
  assert.equal(tamperedLowerValidation.code, "invalid_sibling_derivation");
});

test("balanced 6->5 records exact authored RIR/set changes yet keeps only truly unchanged relations preserved", async () => {
  const sourceCtx = stableFamilyContext("balanced", 6, 90);
  const sourceInst = Compiler.compile(sourceCtx, EXERCISE_LIBRARY);
  assert.equal(sourceInst.kind, "compiled");

  const result = await Transition.proposeSibling({
    compiler: Compiler,
    catalogue: EXERCISE_LIBRARY,
    transitionId: "tr_balanced_6_to_5_p3b",
    createdAt: "2026-10-02T10:00:00.000Z",
    kind: "lower_frequency_sibling",
    predecessor: {
      programId: "prog_balanced_6",
      durableRevision: 1,
      source: "Recommend",
      compilerProvenance: sourceInst.provenance,
    },
    predecessorInstance: sourceInst,
    predecessorCompilerContext: sourceCtx,
    targetConstraint: { availableDays: 5 },
    successorProgramId: "prog_balanced_5",
    diagnosis: {
      kind: "fewer_days",
      answers: { availableDays: 5 },
      eligibleEvidenceIds: ["ev-balanced-6-5"],
      insufficientEvidenceReasons: [],
    },
  });
  assert.equal(result.ok, true, result.code);

  // The authored sibling change is exact in diff.prescriptions: 11 mapped rows
  // move target RIR [0,2] -> [1,3]; seven of them also move sets 2 -> 3, four
  // stay at 2 sets. Nothing is silently relabelled invariant.
  const changed = result.proposal.diff.prescriptions.filter(
    (row) => row.before && row.after && JSON.stringify(row.before) !== JSON.stringify(row.after),
  );
  assert.equal(changed.length, 11);
  assert(
    changed.every((row) =>
      JSON.stringify(row.before.rir) === "[0,2]" && JSON.stringify(row.after.rir) === "[1,3]"),
    "every changed mapped prescription moves target RIR [0,2] -> [1,3]",
  );
  assert.equal(changed.filter((row) => row.before.sets === 2 && row.after.sets === 3).length, 7);
  assert.equal(changed.filter((row) => row.before.sets === 2 && row.after.sets === 2).length, 4);
  assert(changed.every((row) => row.reason === "prescription changed"));

  // The paired-exposure relation endpoints are carried over byte-for-byte in
  // this pair, so both relations are preserved and nothing is reset. A changed
  // authored prescription on a non-relational slot never resets a relation.
  assert.deepEqual(result.proposal.progressionContract, {
    preservedRelations: [
      "paired_exposure@1:balanced_6_knee->balanced_5_knee",
      "paired_exposure@1:balanced_6_press->balanced_5_press",
    ],
    resetRelations: [],
    incompatibilities: [],
  });

  // One truly unchanged preserved relation, proven at the endpoint progression
  // objects themselves rather than through a filtered comparison.
  const predSlots = new Map(sourceInst.days.flatMap((d) => d.slots).map((s) => [s.slotId, s]));
  const succSlots = new Map(result.successorInstance.days.flatMap((d) => d.slots).map((s) => [s.slotId, s]));
  const predKnee = sourceInst.relations.find((r) => r.id === "balanced_6_knee");
  const succKnee = result.successorInstance.relations.find((r) => r.id === "balanced_5_knee");
  assert.deepEqual(
    predSlots.get(predKnee.heavySlotId).prescription.progression,
    succSlots.get(succKnee.heavySlotId).prescription.progression,
  );
  assert.deepEqual(
    predSlots.get(predKnee.volumeSlotId).prescription.progression,
    succSlots.get(succKnee.volumeSlotId).prescription.progression,
  );

  assert.deepEqual(
    await Transition.validateProposal(result.proposal, {
      predecessor: { programId: "prog_balanced_6", durableRevision: 1, source: "Recommend" },
      predecessorInstance: sourceInst,
      successorInstance: result.successorInstance,
      predecessorCompilerContext: sourceCtx,
      successorCompilerContext: result.successorCompilerContext,
    }),
    { ok: true, status: "preview" },
  );
});

test("shorter-session balanced 6d @ 30m resets relations whose endpoint progression the compiler re-derived", async () => {
  const sourceCtx = stableFamilyContext("balanced", 6, 90);
  const sourceInst = Compiler.compile(sourceCtx, EXERCISE_LIBRARY);

  const result = await Transition.proposeSibling({
    compiler: Compiler,
    catalogue: EXERCISE_LIBRARY,
    transitionId: "tr_balanced_6_30m_p3b",
    createdAt: "2026-10-02T11:00:00.000Z",
    kind: "shorter_session_sibling",
    predecessor: {
      programId: "prog_balanced_6_90m",
      durableRevision: 1,
      source: "Recommend",
      compilerProvenance: sourceInst.provenance,
    },
    predecessorInstance: sourceInst,
    predecessorCompilerContext: sourceCtx,
    targetConstraint: { sessionMinutes: 30 },
    successorProgramId: "prog_balanced_6_30m",
    diagnosis: {
      kind: "sessions_too_long",
      answers: { sessionMinutes: 30 },
      eligibleEvidenceIds: ["ev-balanced-6-30"],
      insufficientEvidenceReasons: [],
    },
  });
  assert.equal(result.ok, true, result.code);

  // Both paired-exposure relations map uniquely onto the exact same endpoint
  // slots, but the compiler re-derived the volume endpoint target parameters to
  // fit 30 minutes. That is an explicit reset with a stable parameter-change
  // reason, never a preserved relation.
  assert.deepEqual(result.proposal.progressionContract, {
    preservedRelations: [],
    resetRelations: [
      "paired_exposure@1:balanced_6_knee->balanced_6_knee:endpoint_progression_changed",
      "paired_exposure@1:balanced_6_press->balanced_6_press:endpoint_progression_changed",
    ],
    incompatibilities: [],
  });

  // The reset is real and specific: the volume endpoint progression object
  // changed while its strategy identity did not, so the sibling stays supported.
  const predSlots = new Map(sourceInst.days.flatMap((d) => d.slots).map((s) => [s.slotId, s]));
  const succSlots = new Map(result.successorInstance.days.flatMap((d) => d.slots).map((s) => [s.slotId, s]));
  const predKnee = sourceInst.relations.find((r) => r.id === "balanced_6_knee");
  const succKnee = result.successorInstance.relations.find((r) => r.id === "balanced_6_knee");
  assert.notDeepEqual(
    predSlots.get(predKnee.volumeSlotId).prescription.progression,
    succSlots.get(succKnee.volumeSlotId).prescription.progression,
  );
  assert.equal(
    predSlots.get(predKnee.volumeSlotId).prescription.progression.strategy.id,
    succSlots.get(succKnee.volumeSlotId).prescription.progression.strategy.id,
  );
  assert.deepEqual(
    predSlots.get(predKnee.heavySlotId).prescription.progression,
    succSlots.get(succKnee.heavySlotId).prescription.progression,
  );

  const validationContext = {
    predecessor: { programId: "prog_balanced_6_90m", durableRevision: 1, source: "Recommend" },
    predecessorInstance: sourceInst,
    successorInstance: result.successorInstance,
    predecessorCompilerContext: sourceCtx,
    successorCompilerContext: result.successorCompilerContext,
  };
  assert.deepEqual(
    await Transition.validateProposal(result.proposal, validationContext),
    { ok: true, status: "preview" },
  );

  // Failure injection: freshly rehash a proposal that relabels a changed
  // relation as preserved. validateProposal recomputes the relation contract
  // from the live compiler instances and rejects it semantically, ahead of the
  // proposal-hash check.
  const tampered = structuredClone(result.proposal);
  tampered.progressionContract = {
    preservedRelations: ["paired_exposure@1:balanced_6_knee->balanced_6_knee"],
    resetRelations: ["paired_exposure@1:balanced_6_press->balanced_6_press:endpoint_progression_changed"],
    incompatibilities: [],
  };
  tampered.proposalHash = await Transition.hashProposal(tampered);
  assert.equal(await Transition.hashProposal(tampered), tampered.proposalHash,
    "the tampered proposal is internally hash-consistent");
  const rejected = await Transition.validateProposal(tampered, validationContext);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.status, "invalid");
  assert.equal(rejected.code, "progression_contract_mismatch");
});

test("pure transition API creates guided manual repair only from typed unavailable, valid diagnosis, and valid active program", async () => {
  // 1. Real resolver Unavailable: balanced 4d @ 30m (shorter session cannot fit)
  const pred = compilePredecessor(4, 90);
  const diag30m = {
    kind: "sessions_too_long",
    answers: { sessionMinutes: 30 },
    eligibleEvidenceIds: ["ev-session-30"],
    insufficientEvidenceReasons: [],
  };
  const unavailResult = await Transition.proposeSibling({
    kind: "shorter_session_sibling",
    predecessor: {
      programId: "prog_balanced_4",
      durableRevision: 3,
      source: "Recommend",
      compilerProvenance: pred.instance.provenance,
    },
    predecessorInstance: pred.instance,
    compilerContext: pred.compilerContext,
    targetConstraint: { sessionMinutes: 30 },
    successorProgramId: "prog_balanced_4_30m",
    diagnosis: diag30m,
    transitionId: "tr_unavailable_30m",
    createdAt: "2026-10-02T12:00:00.000Z",
    services: { Compiler, catalogue: EXERCISE_LIBRARY },
  });
  assert.equal(unavailResult.ok, false);
  assert.equal(unavailResult.status, "unavailable");
  assert.equal(unavailResult.unavailable, true);

  // Build a valid active program snapshot
  const activeSnapshot = {
    _storageRevision: 3,
    revision: 3,
    program: pred.instance.program.map((p) => ({ ...p })),
    programMeta: {
      id: "prog_balanced_4",
      name: "Balanced 4-Day",
      programStructure: pred.instance.programStructure,
      progressionRelations: pred.instance.relations,
      progressionModifiers: [],
      progressionIncompatibilities: [],
    },
    customExercises: [],
  };

  // 2. Pure guided result production
  const guided = Transition.createGuidedManualRepair({
    unavailable: unavailResult,
    diagnosis: diag30m,
    activeProgram: activeSnapshot,
    durableRevision: 3,
  });

  assert.equal(guided.ok, true);
  assert.equal(guided.kind, "guided_manual_repair");
  assert.equal(Object.isFrozen(guided), true);
  assert.equal(Object.isFrozen(guided.program), true);
  assert.equal(Object.isFrozen(guided.programStructure), true);
  assert.equal(Object.isFrozen(guided.diagnosis), true);

  // Exact diagnosis preserved
  assert.deepEqual(guided.diagnosis, diag30m);

  // Byte-equivalent copied program and relations
  assert.deepEqual(guided.program, activeSnapshot.program);
  assert.deepEqual(guided.programStructure, activeSnapshot.programMeta.programStructure);
  assert.deepEqual(guided.progressionRelations, activeSnapshot.programMeta.progressionRelations);
  assert.deepEqual(guided.progressionModifiers, []);
  assert.deepEqual(guided.progressionIncompatibilities, []);
  assert.deepEqual(guided.customExercises, []);

  // No successor identity, archive ID, confirmation lifecycle, or transition record
  assert.equal(guided.successorProgramId, undefined);
  assert.equal(guided.successor, undefined);
  assert.equal(guided.archiveId, undefined);
  assert.equal(guided.confirmedAt, undefined);
  assert.equal(guided.status, undefined);
  assert.equal(guided.transitionIn, undefined);
  assert.equal(guided.transitionOut, undefined);
  assert.equal(guided.proposalHash, undefined);

  // 3. Pure negatives
  // A. Missing / not an object diagnosis
  const noDiag = Transition.createGuidedManualRepair({
    unavailable: unavailResult,
    diagnosis: null,
    activeProgram: activeSnapshot,
    durableRevision: 3,
  });
  assert.equal(noDiag.ok, false);
  assert.equal(noDiag.status, "unavailable");
  assert.equal(noDiag.unavailable, true);
  assert.equal(noDiag.invalid, true);

  // B. 3rd diagnosis kind (e.g. reduce_training_volume, recovery_week)
  for (const thirdKind of ["reduce_training_volume", "recovery_week", "unknown_kind"]) {
    const thirdDiag = Transition.createGuidedManualRepair({
      unavailable: unavailResult,
      diagnosis: { kind: thirdKind, answers: { availableDays: 3 } },
      activeProgram: activeSnapshot,
      durableRevision: 3,
    });
    assert.equal(thirdDiag.ok, false);
    assert.equal(thirdDiag.status, "unavailable");
    assert.equal(thirdDiag.unavailable, true);
    assert.equal(thirdDiag.invalid, true);
    assert.equal(thirdDiag.code, "unsupported_diagnosis_kind");
  }

  // C. Missing active program
  const noActive = Transition.createGuidedManualRepair({
    unavailable: unavailResult,
    diagnosis: diag30m,
    activeProgram: null,
    durableRevision: 3,
  });
  assert.equal(noActive.ok, false);
  assert.equal(noActive.status, "unavailable");
  assert.equal(noActive.invalid, true);

  // D. Malformed active program (empty array)
  const emptyProg = Transition.createGuidedManualRepair({
    unavailable: unavailResult,
    diagnosis: diag30m,
    activeProgram: { ...activeSnapshot, program: [] },
    durableRevision: 3,
  });
  assert.equal(emptyProg.ok, false);
  assert.equal(emptyProg.status, "unavailable");
  assert.equal(emptyProg.code, "malformed_active_program");

  // E. Mismatched active revision
  const revMismatch = Transition.createGuidedManualRepair({
    unavailable: unavailResult,
    diagnosis: diag30m,
    activeProgram: activeSnapshot,
    durableRevision: 99,
  });
  assert.equal(revMismatch.ok, false);
  assert.equal(revMismatch.status, "unavailable");
  assert.equal(revMismatch.code, "active_revision_mismatch");

  // F. Non-unavailable input rejected
  const notUnavail = Transition.createGuidedManualRepair({
    unavailable: { ok: true, status: "preview" },
    diagnosis: diag30m,
    activeProgram: activeSnapshot,
    durableRevision: 3,
  });
  assert.equal(notUnavail.ok, false);
  assert.equal(notUnavail.status, "unavailable");
  assert.equal(notUnavail.code, "sibling_unavailable_required");
});

test("guided manual repair copies referenced custom definitions and rejects a missing definition", async () => {
  const pred = compilePredecessor(4, 90);
  const diag30m = {
    kind: "sessions_too_long",
    answers: { sessionMinutes: 30 },
    eligibleEvidenceIds: ["ev-session-30"],
    insufficientEvidenceReasons: [],
  };
  const unavailResult = await Transition.proposeSibling({
    kind: "shorter_session_sibling",
    predecessor: {
      programId: "prog_balanced_4",
      durableRevision: 3,
      source: "Recommend",
      compilerProvenance: pred.instance.provenance,
    },
    predecessorInstance: pred.instance,
    compilerContext: pred.compilerContext,
    targetConstraint: { sessionMinutes: 30 },
    successorProgramId: "prog_balanced_4_30m",
    diagnosis: diag30m,
    transitionId: "tr_unavailable_30m_custom",
    createdAt: "2026-10-02T12:00:00.000Z",
    services: { Compiler, catalogue: EXERCISE_LIBRARY },
  });
  assert.equal(unavailResult.ok, false);
  assert.equal(unavailResult.unavailable, true);

  // Active snapshot whose first slot references a custom movement.
  const customId = "custom:iso-row-1";
  const customDef = {
    id: customId,
    name: "Bench-supported DB row",
    equipment: "dumbbell",
    primary: ["upper-back"],
    secondary: ["biceps"],
    custom: true,
    created: "2026-09-01T00:00:00.000Z",
  };
  const programRows = pred.instance.program.map((p, idx) =>
    idx === 0 ? { ...p, libraryId: customId } : { ...p });
  const baseSnapshot = {
    _storageRevision: 3,
    revision: 3,
    program: programRows,
    programMeta: {
      id: "prog_balanced_4",
      name: "Balanced 4-Day",
      programStructure: pred.instance.programStructure,
      progressionRelations: pred.instance.relations,
      progressionModifiers: [],
      progressionIncompatibilities: [],
    },
    customExercises: [customDef],
  };

  // Definition present -> candidate carries a byte-equal copy, filtered to the
  // referenced id only.
  const withCustom = Transition.createGuidedManualRepair({
    unavailable: unavailResult,
    diagnosis: diag30m,
    activeProgram: baseSnapshot,
    durableRevision: 3,
  });
  assert.equal(withCustom.ok, true);
  assert.deepEqual(withCustom.program, programRows);
  assert.deepEqual(withCustom.customExercises, [customDef]);
  assert.equal(Object.isFrozen(withCustom.customExercises), true);
  assert.equal(Object.isFrozen(withCustom.customExercises[0]), true);

  // An unrelated extra definition in the pool is filtered out.
  const withExtra = Transition.createGuidedManualRepair({
    unavailable: unavailResult,
    diagnosis: diag30m,
    activeProgram: {
      ...baseSnapshot,
      customExercises: [customDef, { ...customDef, id: "custom:unused-1", name: "Unused" }],
    },
    durableRevision: 3,
  });
  assert.equal(withExtra.ok, true);
  assert.deepEqual(withExtra.customExercises, [customDef]);

  // Definition missing -> typed rejection, no broken candidate produced.
  const missing = Transition.createGuidedManualRepair({
    unavailable: unavailResult,
    diagnosis: diag30m,
    activeProgram: { ...baseSnapshot, customExercises: [] },
    durableRevision: 3,
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.status, "unavailable");
  assert.equal(missing.code, "missing_referenced_custom_definition");
  assert.equal(missing.program, undefined);
  assert.equal(missing.candidate, undefined);
});
