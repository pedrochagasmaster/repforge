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
