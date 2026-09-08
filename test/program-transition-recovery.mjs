#!/usr/bin/env node
import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Transition = require("../program-transition.js");
const Compiler = require("../program-compiler.js");
const { EXERCISE_LIBRARY } = require("../exercises.js");

const { evaluateRecoveryEligibility, proposeRecoveryWeek } = Transition;

// Canonical approved policy version 2 literal, defined independently of implementation exports.
const APPROVED_POLICY_V2 = Object.freeze({
  kind: "taurifer-recovery-policy",
  policyVersion: 2,
  status: "Approved",
  primaryPatterns: Object.freeze(["knee-dominant", "horizontal press", "hip/hinge"]),
  patternMapping: Object.freeze({
    squat: "knee-dominant",
    press: "horizontal press",
    incline_press: "horizontal press",
    hinge: "hip/hinge",
  }),
  eligibility: Object.freeze({
    qualifyingOutcomes: Object.freeze(["maintained", "declined"]),
    minimumPatterns: 2,
    checkpointAnswers: Object.freeze(["Yes", "No", "Not sure"]),
    qualifyingCheckpointAnswer: "Yes",
    question: "During this block, did recovery feel worse than usual often enough to affect your training?",
  }),
  ruleB: Object.freeze({
    optional: Object.freeze({ effectiveWorkingSets: 0, reason: "optional-removed" }),
    protected: Object.freeze({ rounding: "ceil", divisor: 2, reason: "protected-ceil" }),
    reducible: Object.freeze({ rounding: "floor", divisor: 2, reason: "reducible-floor" }),
    coverageRescue: Object.freeze({
      minimumWorkingSets: 1,
      selection: "first-eligible-stable-order",
      reason: "pattern-rescue",
    }),
  }),
  acceptanceBand: Object.freeze({ minimum: 0.4, maximum: 0.6 }),
  allowlistedMisses: Object.freeze({
    growth_2_v1: Object.freeze({ base: 32, effective: 12 }),
    growth_3_v1: Object.freeze({ base: 49, effective: 17 }),
  }),
  reassessment: Object.freeze({
    outcomes: Object.freeze(["Better", "About the same", "Worse"]),
    unset: null,
    ordinaryReviewOutcomes: Object.freeze(["About the same", "Worse"]),
    sameBlockRepeat: false,
    weekTwoCanonical: true,
  }),
});

const clone = (value) => JSON.parse(JSON.stringify(value));

const deepFreeze = (value) => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

test("seam presence: evaluateRecoveryEligibility is exported as function", () => {
  assert.equal(typeof evaluateRecoveryEligibility, "function", "evaluateRecoveryEligibility must be exported");
  assert.equal(typeof Transition.evaluateRecoveryEligibility, "function", "Transition.evaluateRecoveryEligibility must be exported");
});

test("truth table: all 2-of-3 maintained/declined combinations qualify with canonical policy order", () => {
  const primaryPatterns = ["knee-dominant", "horizontal press", "hip/hinge"];
  const outcomes = ["maintained", "declined"];
  const pairs = [
    [primaryPatterns[0], primaryPatterns[1]], // knee-dominant, horizontal press
    [primaryPatterns[0], primaryPatterns[2]], // knee-dominant, hip/hinge
    [primaryPatterns[1], primaryPatterns[2]], // horizontal press, hip/hinge
  ];

  let tested = 0;
  for (const [p1, p2] of pairs) {
    for (const o1 of outcomes) {
      for (const o2 of outcomes) {
        tested++;
        const evidence = {
          outcomesByPattern: { [p1]: o1, [p2]: o2 },
          checkpointAnswer: "Yes",
        };
        const result = evaluateRecoveryEligibility(evidence, APPROVED_POLICY_V2);
        assert.equal(result.ok, true, `combination ${p1}:${o1}, ${p2}:${o2} must qualify`);
        assert.equal(result.status, "eligible");
        assert.equal(result.eligible, true);
        assert.equal(result.policyVersion, 2);
        assert.equal(result.eligibilityEvidence.checkpointAnswer, "Yes");
        assert.deepEqual(result.eligibilityEvidence.qualifyingPatterns, [p1, p2]);
        assert.deepEqual(result.eligibilityEvidence.outcomesByPattern, { [p1]: o1, [p2]: o2 });
      }
    }
  }
  assert.equal(tested, 12, "must cover all 12 2-of-3 pairwise combinations");
});

test("truth table: all 8 3-of-3 maintained/declined combinations qualify with 3 policy-ordered patterns", () => {
  const primaryPatterns = ["knee-dominant", "horizontal press", "hip/hinge"];
  const outcomes = ["maintained", "declined"];

  let tested = 0;
  for (const o1 of outcomes) {
    for (const o2 of outcomes) {
      for (const o3 of outcomes) {
        tested++;
        const evidence = {
          outcomesByPattern: {
            [primaryPatterns[0]]: o1,
            [primaryPatterns[1]]: o2,
            [primaryPatterns[2]]: o3,
          },
          checkpointAnswer: "Yes",
        };
        const result = evaluateRecoveryEligibility(evidence, APPROVED_POLICY_V2);
        assert.equal(result.ok, true);
        assert.equal(result.status, "eligible");
        assert.equal(result.eligible, true);
        assert.equal(result.policyVersion, 2);
        assert.equal(result.eligibilityEvidence.checkpointAnswer, "Yes");
        assert.deepEqual(result.eligibilityEvidence.qualifyingPatterns, primaryPatterns);
        assert.deepEqual(result.eligibilityEvidence.outcomesByPattern, {
          [primaryPatterns[0]]: o1,
          [primaryPatterns[1]]: o2,
          [primaryPatterns[2]]: o3,
        });
      }
    }
  }
  assert.equal(tested, 8, "must cover all 8 3-of-3 combinations");
});

test("mixed qualifying outcomes: a non-qualifying third pattern is gated but omitted from returned evidence", () => {
  // docs/recovery-week-policy.md: "The evidence snapshot names the qualifying
  // patterns and the maintained or declined observations that support each one."
  // A third known primary pattern whose outcome is improved/insufficient/untested
  // may be considered for the two-pattern gate, but it enabled nothing and must
  // never be persisted into eligibilityEvidence.outcomesByPattern.
  const nonQualifying = ["improved", "insufficient", "untested"];

  // The non-qualifying outcome is placed at each of the three policy patterns in
  // turn, so the omission holds regardless of position and the returned keys
  // stay in fixed policy order (knee-dominant, horizontal press, hip/hinge).
  const placements = [
    {
      label: "trailing pattern hip/hinge is non-qualifying",
      qualifying: { "knee-dominant": "maintained", "horizontal press": "declined" },
      nonQualifyingPattern: "hip/hinge",
      expectedQualifyingPatterns: ["knee-dominant", "horizontal press"],
    },
    {
      label: "middle pattern horizontal press is non-qualifying",
      qualifying: { "knee-dominant": "maintained", "hip/hinge": "declined" },
      nonQualifyingPattern: "horizontal press",
      expectedQualifyingPatterns: ["knee-dominant", "hip/hinge"],
    },
    {
      label: "leading pattern knee-dominant is non-qualifying",
      qualifying: { "horizontal press": "maintained", "hip/hinge": "declined" },
      nonQualifyingPattern: "knee-dominant",
      expectedQualifyingPatterns: ["horizontal press", "hip/hinge"],
    },
  ];

  for (const placement of placements) {
    for (const nq of nonQualifying) {
      const evidence = {
        outcomesByPattern: {
          ...placement.qualifying,
          [placement.nonQualifyingPattern]: nq,
        },
        checkpointAnswer: "Yes",
      };
      const result = evaluateRecoveryEligibility(evidence, APPROVED_POLICY_V2);
      assert.equal(result.ok, true, `${placement.label} with ${nq} must still qualify`);
      assert.equal(result.status, "eligible");
      assert.equal(result.eligible, true);

      const { outcomesByPattern, qualifyingPatterns } = result.eligibilityEvidence;

      // The non-qualifying outcome is omitted from returned evidence.
      assert.equal(
        Object.prototype.hasOwnProperty.call(outcomesByPattern, placement.nonQualifyingPattern),
        false,
        `${placement.label}: ${nq} must not be persisted as eligibility evidence`,
      );

      // outcomesByPattern is exactly the qualifying patterns with their
      // supporting maintained/declined observations, in fixed policy order.
      assert.deepEqual(outcomesByPattern, placement.qualifying);
      assert.deepEqual(qualifyingPatterns, placement.expectedQualifyingPatterns);

      // Its key list is exactly equal to qualifyingPatterns (members and order).
      assert.deepEqual(Object.keys(outcomesByPattern), qualifyingPatterns);
    }
  }
});

test("mixed qualifying outcomes: improved/insufficient/untested are individually omitted from evidence", () => {
  for (const nq of ["improved", "insufficient", "untested"]) {
    const evidence = {
      outcomesByPattern: {
        "knee-dominant": "maintained",
        "horizontal press": "declined",
        "hip/hinge": nq,
      },
      checkpointAnswer: "Yes",
    };
    const result = evaluateRecoveryEligibility(evidence, APPROVED_POLICY_V2);
    assert.equal(result.ok, true, `mixed with ${nq} must qualify on the two supporting patterns`);
    assert.equal(result.status, "eligible");
    assert.equal(
      "hip/hinge" in result.eligibilityEvidence.outcomesByPattern,
      false,
      `${nq} outcome for hip/hinge must be absent from returned evidence`,
    );
    assert.deepEqual(result.eligibilityEvidence.outcomesByPattern, {
      "knee-dominant": "maintained",
      "horizontal press": "declined",
    });
    assert.deepEqual(result.eligibilityEvidence.qualifyingPatterns, [
      "knee-dominant",
      "horizontal press",
    ]);
    assert.deepEqual(
      Object.keys(result.eligibilityEvidence.outcomesByPattern),
      result.eligibilityEvidence.qualifyingPatterns,
    );
  }
});

test("policy-order normalization: out-of-order input keys are normalized to canonical policy order", () => {
  const reverseEvidence = {
    outcomesByPattern: {
      "hip/hinge": "declined",
      "horizontal press": "maintained",
      "knee-dominant": "maintained",
    },
    checkpointAnswer: "Yes",
  };
  const result = evaluateRecoveryEligibility(reverseEvidence, APPROVED_POLICY_V2);
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.eligibilityEvidence.outcomesByPattern), [
    "knee-dominant",
    "horizontal press",
    "hip/hinge",
  ]);
  assert.deepEqual(result.eligibilityEvidence.qualifyingPatterns, [
    "knee-dominant",
    "horizontal press",
    "hip/hinge",
  ]);

  const pairReverse = {
    outcomesByPattern: {
      "hip/hinge": "declined",
      "knee-dominant": "maintained",
    },
    checkpointAnswer: "Yes",
  };
  const pairResult = evaluateRecoveryEligibility(pairReverse, APPROVED_POLICY_V2);
  assert.equal(pairResult.ok, true);
  assert.deepEqual(Object.keys(pairResult.eligibilityEvidence.outcomesByPattern), [
    "knee-dominant",
    "hip/hinge",
  ]);
  assert.deepEqual(pairResult.eligibilityEvidence.qualifyingPatterns, [
    "knee-dominant",
    "hip/hinge",
  ]);
});

test("immutability and input non-mutation: result is deeply frozen and inputs remain unmodified", () => {
  const evidence = {
    outcomesByPattern: {
      "knee-dominant": "maintained",
      "horizontal press": "declined",
    },
    checkpointAnswer: "Yes",
  };
  const policy = clone(APPROVED_POLICY_V2);
  const evidenceSnapshot = clone(evidence);
  const policySnapshot = clone(policy);

  const result = evaluateRecoveryEligibility(evidence, policy);
  assert.equal(result.ok, true);
  assert.ok(Object.isFrozen(result), "result must be frozen");
  assert.ok(Object.isFrozen(result.eligibilityEvidence), "eligibilityEvidence must be frozen");
  assert.ok(Object.isFrozen(result.eligibilityEvidence.outcomesByPattern), "outcomesByPattern must be frozen");
  assert.ok(Object.isFrozen(result.eligibilityEvidence.qualifyingPatterns), "qualifyingPatterns must be frozen");

  assert.deepEqual(evidence, evidenceSnapshot, "evidence input must not be mutated");
  assert.deepEqual(policy, policySnapshot, "policy input must not be mutated");

  // Also verify that passing already deeply-frozen inputs executes cleanly without attempting mutations
  const frozenEvidence = deepFreeze(clone(evidence));
  const frozenPolicy = deepFreeze(clone(APPROVED_POLICY_V2));
  const frozenResult = evaluateRecoveryEligibility(frozenEvidence, frozenPolicy);
  assert.equal(frozenResult.ok, true);
});

test("negative injections: single qualifying pattern yields insufficient_qualifying_patterns", () => {
  for (const pattern of ["knee-dominant", "horizontal press", "hip/hinge"]) {
    const evidence = {
      outcomesByPattern: { [pattern]: "maintained" },
      checkpointAnswer: "Yes",
    };
    const result = evaluateRecoveryEligibility(evidence, APPROVED_POLICY_V2);
    assert.deepEqual(result, {
      ok: false,
      status: "ineligible",
      ineligible: true,
      code: "insufficient_qualifying_patterns",
    });
    assert.ok(Object.isFrozen(result));
  }
});

test("negative injections: empty outcomesByPattern yields insufficient_qualifying_patterns", () => {
  const evidence = {
    outcomesByPattern: {},
    checkpointAnswer: "Yes",
  };
  const result = evaluateRecoveryEligibility(evidence, APPROVED_POLICY_V2);
  assert.deepEqual(result, {
    ok: false,
    status: "ineligible",
    ineligible: true,
    code: "insufficient_qualifying_patterns",
  });
});

test("negative injections: one qualifying pattern plus improved yields insufficient_qualifying_patterns", () => {
  const evidence = {
    outcomesByPattern: {
      "knee-dominant": "maintained",
      "horizontal press": "improved",
    },
    checkpointAnswer: "Yes",
  };
  const result = evaluateRecoveryEligibility(evidence, APPROVED_POLICY_V2);
  assert.deepEqual(result, {
    ok: false,
    status: "ineligible",
    ineligible: true,
    code: "insufficient_qualifying_patterns",
  });
});

test("negative injections: checkpoint answers No, Not sure, missing, or invalid yield checkpoint_not_yes", () => {
  const baseOutcomes = {
    "knee-dominant": "maintained",
    "horizontal press": "declined",
  };

  const nonYesAnswers = ["No", "Not sure", undefined, null, "", "Maybe"];
  for (const answer of nonYesAnswers) {
    const evidence = {
      outcomesByPattern: baseOutcomes,
      ...(answer !== undefined ? { checkpointAnswer: answer } : {}),
    };
    const result = evaluateRecoveryEligibility(evidence, APPROVED_POLICY_V2);
    assert.deepEqual(result, {
      ok: false,
      status: "ineligible",
      ineligible: true,
      code: "checkpoint_not_yes",
    }, `checkpointAnswer ${JSON.stringify(answer)} must reject with checkpoint_not_yes`);
    assert.ok(Object.isFrozen(result));
  }
});

test("negative injections: insufficient, untested, or unknown outcomes yield insufficient_qualifying_patterns", () => {
  const insufficientCases = [
    { "knee-dominant": "insufficient", "horizontal press": "untested" },
    { "knee-dominant": "maintained", "horizontal press": "insufficient" },
    { "knee-dominant": "maintained", "horizontal press": "untested" },
    { "knee-dominant": "maintained", "horizontal press": "unknown" },
    { "knee-dominant": "unknown", "horizontal press": "unknown" },
  ];

  for (const outcomes of insufficientCases) {
    const evidence = { outcomesByPattern: outcomes, checkpointAnswer: "Yes" };
    const result = evaluateRecoveryEligibility(evidence, APPROVED_POLICY_V2);
    assert.deepEqual(result, {
      ok: false,
      status: "ineligible",
      ineligible: true,
      code: "insufficient_qualifying_patterns",
    });
  }
});

test("negative injections: unknown or extra patterns yield invalid_evidence", () => {
  const extraPatternCases = [
    { "knee-dominant": "maintained", "horizontal press": "declined", "vertical pull": "maintained" },
    { "biceps": "maintained", "triceps": "declined" },
    { "knee-dominant": "maintained", "unknown-pattern": "declined" },
  ];

  for (const outcomes of extraPatternCases) {
    const evidence = { outcomesByPattern: outcomes, checkpointAnswer: "Yes" };
    const result = evaluateRecoveryEligibility(evidence, APPROVED_POLICY_V2);
    assert.deepEqual(result, {
      ok: false,
      status: "ineligible",
      ineligible: true,
      code: "invalid_evidence",
    });
  }
});

test("negative injections: inherited/prototype properties on outcomes do not qualify", () => {
  const proto = { "knee-dominant": "maintained" };
  const outcomes = Object.create(proto);
  outcomes["horizontal press"] = "declined";

  const evidence = { outcomesByPattern: outcomes, checkpointAnswer: "Yes" };
  const result = evaluateRecoveryEligibility(evidence, APPROVED_POLICY_V2);
  assert.deepEqual(result, {
    ok: false,
    status: "ineligible",
    ineligible: true,
    code: "insufficient_qualifying_patterns",
  });
});

test("negative injections: malformed evidence yields invalid_evidence", () => {
  const malformedEvidence = [
    null,
    undefined,
    "string",
    123,
    [],
    { checkpointAnswer: "Yes" }, // missing outcomesByPattern
    { outcomesByPattern: null, checkpointAnswer: "Yes" },
    { outcomesByPattern: "not an object", checkpointAnswer: "Yes" },
    { outcomesByPattern: [], checkpointAnswer: "Yes" },
    { outcomesByPattern: { "knee-dominant": 123 }, checkpointAnswer: "Yes" },
    { outcomesByPattern: { "knee-dominant": null }, checkpointAnswer: "Yes" },
    { outcomesByPattern: JSON.parse('{"__proto__": "bad"}'), checkpointAnswer: "Yes" },
  ];

  for (const evidence of malformedEvidence) {
    const result = evaluateRecoveryEligibility(evidence, APPROVED_POLICY_V2);
    assert.deepEqual(result, {
      ok: false,
      status: "ineligible",
      ineligible: true,
      code: "invalid_evidence",
    });
  }
});

test("negative injections: missing, wrong, or drifted policy version yields policy_invalid", () => {
  const validEvidence = {
    outcomesByPattern: {
      "knee-dominant": "maintained",
      "horizontal press": "declined",
    },
    checkpointAnswer: "Yes",
  };

  const badPolicies = [
    null,
    undefined,
    "policy",
    123,
    {},
    { ...APPROVED_POLICY_V2, policyVersion: 1 },
    { ...APPROVED_POLICY_V2, policyVersion: 3 },
    { ...APPROVED_POLICY_V2, policyVersion: "2" },
    { ...APPROVED_POLICY_V2, kind: "wrong-kind" },
  ];

  for (const badPolicy of badPolicies) {
    const result = evaluateRecoveryEligibility(validEvidence, badPolicy);
    assert.deepEqual(result, {
      ok: false,
      status: "ineligible",
      ineligible: true,
      code: "policy_invalid",
    });
  }
});

test("negative injections: drifted question/answers/patterns/qualifying outcomes yield policy_invalid or invalid_evidence", () => {
  const validEvidence = {
    outcomesByPattern: {
      "knee-dominant": "maintained",
      "horizontal press": "declined",
    },
    checkpointAnswer: "Yes",
  };

  // Drifted patterns in policy
  const driftedPatterns = [
    { ...APPROVED_POLICY_V2, primaryPatterns: ["horizontal press", "knee-dominant", "hip/hinge"] }, // wrong order
    { ...APPROVED_POLICY_V2, primaryPatterns: ["knee-dominant", "horizontal press"] }, // missing one
    { ...APPROVED_POLICY_V2, primaryPatterns: ["squat", "press", "hinge"] }, // wrong names
  ];
  for (const p of driftedPatterns) {
    const result = evaluateRecoveryEligibility(validEvidence, p);
    assert.deepEqual(result, { ok: false, status: "ineligible", ineligible: true, code: "policy_invalid" });
  }

  // Drifted eligibility in policy
  const driftedEligibility = [
    { ...APPROVED_POLICY_V2, eligibility: null },
    { ...APPROVED_POLICY_V2, eligibility: { ...APPROVED_POLICY_V2.eligibility, minimumPatterns: 1 } },
    { ...APPROVED_POLICY_V2, eligibility: { ...APPROVED_POLICY_V2.eligibility, minimumPatterns: 3 } },
    { ...APPROVED_POLICY_V2, eligibility: { ...APPROVED_POLICY_V2.eligibility, qualifyingOutcomes: ["maintained"] } },
    { ...APPROVED_POLICY_V2, eligibility: { ...APPROVED_POLICY_V2.eligibility, qualifyingOutcomes: ["maintained", "declined", "improved"] } },
    { ...APPROVED_POLICY_V2, eligibility: { ...APPROVED_POLICY_V2.eligibility, checkpointAnswers: ["Yes", "No"] } },
    { ...APPROVED_POLICY_V2, eligibility: { ...APPROVED_POLICY_V2.eligibility, qualifyingCheckpointAnswer: "Sure" } },
    { ...APPROVED_POLICY_V2, eligibility: { ...APPROVED_POLICY_V2.eligibility, question: "Drifted question?" } },
  ];
  for (const p of driftedEligibility) {
    const result = evaluateRecoveryEligibility(validEvidence, p);
    assert.deepEqual(result, { ok: false, status: "ineligible", ineligible: true, code: "policy_invalid" });
  }

  // Drifted question in evidence
  const driftedEvidenceQuestion = {
    ...validEvidence,
    question: "Wrong question text?",
  };
  const result = evaluateRecoveryEligibility(driftedEvidenceQuestion, APPROVED_POLICY_V2);
  assert.deepEqual(result, { ok: false, status: "ineligible", ineligible: true, code: "invalid_evidence" });
});

// ============================================================================
// Packet 052-P5b: Rule B recovery preview implementation tests
// ============================================================================

const FIXTURE_EVIDENCE_TABLE = {
  growth_2_v1: { base: 32, effective: 12, ratio: "37.5%", status: "Miss (low)" },
  growth_3_v1: { base: 49, effective: 17, ratio: "34.7%", status: "Miss (low)" },
  growth_4_v1: { base: 60, effective: 26, ratio: "43.3%", status: "Yes" },
  growth_5_v1: { base: 74, effective: 30, ratio: "40.5%", status: "Yes" },
  growth_6_v1: { base: 46, effective: 23, ratio: "50.0%", status: "Yes" },
  balanced_2_v1: { base: 29, effective: 13, ratio: "44.8%", status: "Yes" },
  balanced_3_v1: { base: 43, effective: 20, ratio: "46.5%", status: "Yes" },
  balanced_4_v1: { base: 45, effective: 22, ratio: "48.9%", status: "Yes" },
  balanced_5_v1: { base: 60, effective: 28, ratio: "46.7%", status: "Yes" },
  balanced_6_v1: { base: 50, effective: 27, ratio: "54.0%", status: "Yes" },
  strength_2_v1: { base: 28, effective: 13, ratio: "46.4%", status: "Yes" },
  strength_3_v1: { base: 42, effective: 18, ratio: "42.9%", status: "Yes" },
  strength_4_v1: { base: 45, effective: 21, ratio: "46.7%", status: "Yes" },
  strength_5_v1: { base: 61, effective: 26, ratio: "42.6%", status: "Yes" },
  strength_6_v1: { base: 53, effective: 27, ratio: "50.9%", status: "Yes" },
  home_2_v1: { base: 27, effective: 15, ratio: "55.6%", status: "Yes" },
  home_3_v1: { base: 34, effective: 20, ratio: "58.8%", status: "Yes" },
  home_4_v1: { base: 39, effective: 20, ratio: "51.3%", status: "Yes" },
  home_5_v1: { base: 31, effective: 16, ratio: "51.6%", status: "Yes" },
  home_6_v1: { base: 32, effective: 16, ratio: "50.0%", status: "Yes" },
};

const gymContext = (familyId, frequency, extra = {}) => ({
  schemaVersion: 1,
  familyId,
  frequency,
  sessionMinutes: 90,
  equipment: ["barbell", "dumbbell", "machine", "cable", "smith"],
  environment: ["safe_pull", "training_support"],
  loadIncrements: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 5, smith: 2.5 },
  ...extra,
});

const homeContext = (frequency, extra = {}) => ({
  schemaVersion: 1,
  familyId: "home",
  frequency,
  sessionMinutes: 90,
  equipment: [],
  environment: [],
  loadIncrements: {},
  ...extra,
});

function independentRuleB(instance) {
  const patternMapping = {
    squat: "knee-dominant",
    press: "horizontal press",
    incline_press: "horizontal press",
    hinge: "hip/hinge",
  };
  const primaryPatterns = ["knee-dominant", "horizontal press", "hip/hinge"];
  const slots = instance.days.flatMap((d) => d.slots);
  const entries = slots.map((slot) => {
    const rawPattern = slot.contract?.patterns?.[0];
    const movementPattern = patternMapping[rawPattern] || null;
    const baseWorkingSets = slot.prescription.sets;
    let effectiveWorkingSets = 0;
    let reason = "";
    const isOptional = slot.status === "optional";
    if (isOptional) {
      effectiveWorkingSets = 0;
      reason = "optional-removed";
    } else if (slot.status === "protected") {
      effectiveWorkingSets = Math.ceil(baseWorkingSets / 2);
      reason = "protected-ceil";
    } else if (slot.status === "reducible") {
      effectiveWorkingSets = Math.floor(baseWorkingSets / 2);
      reason = "reducible-floor";
    }
    const movement = slot.exercise.id.startsWith("custom:") || slot.exercise.id.startsWith("library:")
      ? slot.exercise.id
      : "library:" + slot.exercise.id;
    return {
      slot: slot.slotId,
      movement,
      movementPattern,
      baseWorkingSets,
      effectiveWorkingSets,
      removedOptionalFirst: isOptional,
      reason,
    };
  });

  for (const pattern of primaryPatterns) {
    const patternTotal = entries.reduce(
      (sum, e) => sum + (e.movementPattern === pattern ? e.effectiveWorkingSets : 0),
      0
    );
    if (patternTotal === 0) {
      const target = entries.find((e) => e.movementPattern === pattern && e.baseWorkingSets >= 1);
      if (target) {
        target.effectiveWorkingSets = 1;
        target.reason = "pattern-rescue";
      }
    }
  }

  const baseTotal = entries.reduce((sum, e) => sum + e.baseWorkingSets, 0);
  const effectiveTotal = entries.reduce((sum, e) => sum + e.effectiveWorkingSets, 0);
  const ratio = effectiveTotal / baseTotal;
  return { entries, baseTotal, effectiveTotal, ratio };
}

function validRecoveryInput(overrides = {}) {
  const predecessorInstance = overrides.predecessorInstance || Compiler.compile(gymContext("growth", 4), EXERCISE_LIBRARY);
  return {
    predecessorInstance,
    predecessor: {
      programId: "prog_recovery_test_4",
      durableRevision: 1,
      source: "Recommend",
    },
    approvedPolicy: clone(APPROVED_POLICY_V2),
    evidence: {
      outcomesByPattern: {
        "knee-dominant": "maintained",
        "horizontal press": "declined",
      },
      checkpointAnswer: "Yes",
    },
    transitionId: "tr_recov_001",
    blockId: "block_local_b1",
    createdAt: "2026-10-01T09:00:00.000Z",
    supportedVersions: Compiler.VERSIONS,
    ...overrides,
  };
}

test("seam presence: proposeRecoveryWeek is exported as function", () => {
  assert.equal(typeof proposeRecoveryWeek, "function", "proposeRecoveryWeek must be exported");
  assert.equal(typeof Transition.proposeRecoveryWeek, "function", "Transition.proposeRecoveryWeek must be exported");
});

test("Rule B independent oracle across all 20 real compilations", async () => {
  let checkedCompilations = 0;
  for (const familyId of Compiler.FAMILY_IDS) {
    for (const frequency of Compiler.FREQUENCIES) {
      checkedCompilations++;
      const context = familyId === "home" ? homeContext(frequency) : gymContext(familyId, frequency);
      const instance = Compiler.compile(context, EXERCISE_LIBRARY);
      assert.equal(instance.kind, "compiled");
      const blueprintId = `${familyId}_${frequency}_v1`;
      const expectedFixture = FIXTURE_EVIDENCE_TABLE[blueprintId];
      assert.ok(expectedFixture, `missing fixture table entry for ${blueprintId}`);

      const oracle = independentRuleB(instance);
      assert.equal(oracle.baseTotal, expectedFixture.base, `${blueprintId} oracle base total matches fixture`);
      assert.equal(oracle.effectiveTotal, expectedFixture.effective, `${blueprintId} oracle effective total matches fixture`);

      const input = validRecoveryInput({
        predecessorInstance: instance,
        predecessor: {
          programId: `prog_${blueprintId}`,
          durableRevision: 1,
          source: "Recommend",
        },
        transitionId: `tr_${blueprintId}`,
      });

      const result = await proposeRecoveryWeek(input);
      assert.equal(result.ok, true, `proposeRecoveryWeek failed for ${blueprintId}: ${result.code}`);
      assert.equal(result.status, "preview");
      const proposal = result.proposal;
      assert.ok(proposal);

      // Schema and field presence rules
      assert.equal(proposal.schemaVersion, 1);
      assert.equal(proposal.transitionId, `tr_${blueprintId}`);
      assert.equal(proposal.kind, "recovery_week");
      assert.equal(proposal.status, "preview");
      assert.equal(proposal.createdAt, input.createdAt);
      assert.equal(proposal.successor, undefined, "successor must be absent for recovery_week");
      assert.equal(proposal.confirmedAt, undefined, "confirmedAt must be absent in preview");
      assert.equal(proposal.archiveId, undefined, "archiveId must be absent in preview");

      // Predecessor fields
      assert.equal(proposal.predecessor.programId, input.predecessor.programId);
      assert.equal(proposal.predecessor.durableRevision, 1);
      assert.equal(proposal.predecessor.source, "Recommend");
      assert.deepEqual(proposal.predecessor.compilerProvenance, instance.provenance);
      assert.equal(typeof proposal.predecessor.fingerprint, "string");

      // Diagnosis fields
      assert.deepEqual(proposal.diagnosis, {
        kind: "recovery_week",
        answers: { checkpointAnswer: "Yes" },
        eligibleEvidenceIds: ["knee-dominant", "horizontal press"],
        insufficientEvidenceReasons: [],
      });

      // Derivation fields
      assert.equal(proposal.derivation.mode, "overlay");
      assert.equal(proposal.derivation.request, "recovery-week");
      assert.deepEqual(proposal.derivation.compilerContextVersions, instance.provenance);
      assert.deepEqual(proposal.derivation.policyVersions, { recoveryWeek: 2 });
      assert.ok(proposal.derivation.slotMapping, "slot mapping required");
      assert.equal(proposal.derivation.slotMapping.contract, "taurifer-transition-slot-mapping");
      for (const pair of proposal.derivation.slotMapping.slots) {
        assert.equal(pair.predecessorSlot, pair.successorSlot);
        assert.equal(pair.predecessorMovement, pair.successorMovement);
      }

      // Diff fields
      assert.ok(proposal.diff, "diff required");
      assert.deepEqual(proposal.diff.days, []);
      assert.deepEqual(proposal.diff.exercises, []);
      assert.deepEqual(proposal.diff.prescriptions, []);
      assert.ok(proposal.diff.recoveryWeek, "diff.recoveryWeek required");

      // Overlay fields
      const overlay = proposal.diff.recoveryWeek;
      assert.equal(overlay.schemaVersion, 1);
      assert.equal(overlay.policyVersion, 2);
      assert.equal(overlay.transitionId, proposal.transitionId);
      assert.equal(overlay.blockId, input.blockId);
      assert.equal(overlay.activePeriod, "nextBlockWeek1");
      assert.deepEqual(overlay.eligibilityEvidence, {
        outcomesByPattern: {
          "knee-dominant": "maintained",
          "horizontal press": "declined",
        },
        qualifyingPatterns: ["knee-dominant", "horizontal press"],
        checkpointAnswer: "Yes",
      });
      assert.equal(overlay.baseProgramFingerprint, proposal.predecessor.fingerprint);
      assert.equal(overlay.createdAt, input.createdAt);
      assert.equal(overlay.reassessmentOutcome, null);
      assert.equal(overlay.confirmedAt, undefined, "overlay confirmedAt must be absent in preview");
      assert.equal(overlay.reassessmentDueAt, undefined, "overlay reassessmentDueAt must be absent in preview");

      // Entries comparison against independent Rule B oracle
      assert.equal(overlay.entries.length, oracle.entries.length, `${blueprintId} entry count`);
      for (let i = 0; i < oracle.entries.length; i++) {
        const actual = overlay.entries[i];
        const expected = oracle.entries[i];
        assert.equal(actual.slot, expected.slot, `${blueprintId} entry ${i} slotId`);
        assert.equal(actual.movement, expected.movement, `${blueprintId} entry ${i} movement`);
        assert.equal(actual.movementPattern, expected.movementPattern, `${blueprintId} entry ${i} movementPattern`);
        assert.equal(actual.baseWorkingSets, expected.baseWorkingSets, `${blueprintId} entry ${i} baseWorkingSets`);
        assert.equal(actual.effectiveWorkingSets, expected.effectiveWorkingSets, `${blueprintId} entry ${i} effectiveWorkingSets`);
        assert.equal(actual.removedOptionalFirst, expected.removedOptionalFirst, `${blueprintId} entry ${i} removedOptionalFirst`);
        assert.equal(actual.reason, expected.reason, `${blueprintId} entry ${i} reason`);
      }

      // Band & Allowlist check
      const totalBase = overlay.entries.reduce((sum, e) => sum + e.baseWorkingSets, 0);
      const totalEffective = overlay.entries.reduce((sum, e) => sum + e.effectiveWorkingSets, 0);
      assert.equal(totalBase, expectedFixture.base, `${blueprintId} base sets`);
      assert.equal(totalEffective, expectedFixture.effective, `${blueprintId} effective sets`);
      const ratio = totalEffective / totalBase;
      if (blueprintId === "growth_2_v1") {
        assert.equal(totalBase, 32);
        assert.equal(totalEffective, 12);
        assert.ok(ratio < 0.4, "growth_2_v1 must be below 40%");
      } else if (blueprintId === "growth_3_v1") {
        assert.equal(totalBase, 49);
        assert.equal(totalEffective, 17);
        assert.ok(ratio < 0.4, "growth_3_v1 must be below 40%");
      } else {
        assert.ok(ratio >= 0.4 && ratio <= 0.6, `${blueprintId} ratio ${ratio} must be within 40-60% band`);
      }

      // Proposal validation
      const validation = await Transition.validateProposal(proposal, {
        predecessor: input.predecessor,
        predecessorInstance: instance,
        approvedPolicy: APPROVED_POLICY_V2,
        supportedVersions: Compiler.VERSIONS,
      });
      assert.equal(validation.ok, true, `${blueprintId} validateProposal failed: ${validation.code}`);
      assert.equal(validation.status, "preview");
    }
  }
  assert.equal(checkedCompilations, 20, "must check all 20 compilations");
});

test("repeated library:sq_lp has distinct protected/reducible slot entries in growth_2_v1", async () => {
  const instance = Compiler.compile(gymContext("growth", 2), EXERCISE_LIBRARY);
  const input = validRecoveryInput({ predecessorInstance: instance });
  const result = await proposeRecoveryWeek(input);
  assert.equal(result.ok, true);

  const legPressEntries = result.proposal.diff.recoveryWeek.entries.filter(
    (e) => e.movement === "library:sq_lp"
  );
  assert.equal(legPressEntries.length, 2, "must have exactly 2 entries for repeated library:sq_lp");

  const [entry1, entry2] = legPressEntries;
  assert.notEqual(entry1.slot, entry2.slot, "slot identities must be distinct");
  assert.equal(entry1.slot, "growth_2_d1_s1");
  assert.equal(entry1.baseWorkingSets, 3);
  assert.equal(entry1.effectiveWorkingSets, 2);
  assert.equal(entry1.removedOptionalFirst, false);
  assert.equal(entry1.reason, "protected-ceil");
  assert.equal(entry1.movementPattern, "knee-dominant");

  assert.equal(entry2.slot, "growth_2_d2_s4");
  assert.equal(entry2.baseWorkingSets, 3);
  assert.equal(entry2.effectiveWorkingSets, 1);
  assert.equal(entry2.removedOptionalFirst, false);
  assert.equal(entry2.reason, "reducible-floor");
  assert.equal(entry2.movementPattern, null);
});

test("synthetic compiler instance for coverage rescue restores first eligible optional primary slot to 1 set", async () => {
  const base = Compiler.compile(gymContext("growth", 6), EXERCISE_LIBRARY);
  const synthetic = JSON.parse(JSON.stringify(base));
  let modified = 0;
  for (const day of synthetic.days) {
    for (const slot of day.slots) {
      if (slot.contract?.patterns?.[0] === "squat") {
        slot.status = "optional";
        slot.protected = false;
        slot.reducible = false;
        const p = synthetic.program.find((e) => e.slotId === slot.slotId);
        if (p) p.priority = "optional";
        modified++;
      }
    }
  }
  assert.ok(modified >= 2, "modified at least 2 knee-dominant slots");

  const input = validRecoveryInput({ predecessorInstance: synthetic });
  const result = await proposeRecoveryWeek(input);
  assert.equal(result.ok, true);

  const kneeEntries = result.proposal.diff.recoveryWeek.entries.filter(
    (e) => e.movementPattern === "knee-dominant"
  );
  assert.ok(kneeEntries.length >= 2);
  const rescuedEntry = kneeEntries[0];
  assert.equal(rescuedEntry.effectiveWorkingSets, 1, "rescued slot must have 1 working set");
  assert.equal(rescuedEntry.removedOptionalFirst, true, "removedOptionalFirst must be true since it was optional");
  assert.equal(rescuedEntry.reason, "pattern-rescue", "reason must be pattern-rescue");

  for (let i = 1; i < kneeEntries.length; i++) {
    assert.equal(kneeEntries[i].effectiveWorkingSets, 0);
    assert.equal(kneeEntries[i].removedOptionalFirst, true);
    assert.equal(kneeEntries[i].reason, "optional-removed");
  }
});

test("immutability and deep freeze on proposal and overlay", async () => {
  const instance = Compiler.compile(gymContext("growth", 4), EXERCISE_LIBRARY);
  const input = validRecoveryInput({ predecessorInstance: instance });
  const inputSnapshot = JSON.parse(JSON.stringify(input));

  const result = await proposeRecoveryWeek(input);
  assert.equal(result.ok, true);
  assert.ok(Object.isFrozen(result), "result must be frozen");
  assert.ok(Object.isFrozen(result.proposal), "proposal must be frozen");
  assert.ok(Object.isFrozen(result.proposal.diff.recoveryWeek), "overlay must be frozen");
  assert.ok(Object.isFrozen(result.proposal.diff.recoveryWeek.entries), "entries must be frozen");
  for (const entry of result.proposal.diff.recoveryWeek.entries) {
    assert.ok(Object.isFrozen(entry), "entry must be frozen");
  }
  assert.deepEqual(input, inputSnapshot, "input must not be mutated");

  const frozenInput = deepFreeze(JSON.parse(JSON.stringify(input)));
  const frozenResult = await proposeRecoveryWeek(frozenInput);
  assert.equal(frozenResult.ok, true);
});

// --- Semantic negative tests with freshly recomputed hash ---

async function createBaseRecoveryFixture() {
  const instance = Compiler.compile(gymContext("growth", 4), EXERCISE_LIBRARY);
  const input = validRecoveryInput({ predecessorInstance: instance });
  const result = await proposeRecoveryWeek(input);
  assert.equal(result.ok, true);
  return {
    proposal: JSON.parse(JSON.stringify(result.proposal)),
    input,
    instance,
    validationContext: {
      predecessor: input.predecessor,
      predecessorInstance: instance,
      approvedPolicy: APPROVED_POLICY_V2,
      supportedVersions: Compiler.VERSIONS,
    },
  };
}

test("semantic rejection before hash check: wrong policy version", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const tampered = JSON.parse(JSON.stringify(proposal));
  tampered.diff.recoveryWeek.policyVersion = 1;
  tampered.proposalHash = await Transition.hashProposal(tampered);

  const val = await Transition.validateProposal(tampered, validationContext);
  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "unsupported_policy_version");
});

test("semantic rejection before hash check: forged or ineligible evidence", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const tampered = JSON.parse(JSON.stringify(proposal));
  tampered.diff.recoveryWeek.eligibilityEvidence.checkpointAnswer = "No";
  tampered.proposalHash = await Transition.hashProposal(tampered);

  const val = await Transition.validateProposal(tampered, validationContext);
  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "ineligible_recovery_evidence");
});

test("semantic rejection before hash check: missing entry", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const tampered = JSON.parse(JSON.stringify(proposal));
  tampered.diff.recoveryWeek.entries.pop();
  tampered.proposalHash = await Transition.hashProposal(tampered);

  const val = await Transition.validateProposal(tampered, validationContext);
  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "missing_recovery_slot");
});

test("semantic rejection before hash check: extra entry", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const tampered = JSON.parse(JSON.stringify(proposal));
  tampered.diff.recoveryWeek.entries.push(JSON.parse(JSON.stringify(tampered.diff.recoveryWeek.entries[0])));
  tampered.proposalHash = await Transition.hashProposal(tampered);

  const val = await Transition.validateProposal(tampered, validationContext);
  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "extra_recovery_slot");
});

test("semantic rejection before hash check: duplicate entry", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const tampered = JSON.parse(JSON.stringify(proposal));
  tampered.diff.recoveryWeek.entries[1] = JSON.parse(JSON.stringify(tampered.diff.recoveryWeek.entries[0]));
  tampered.proposalHash = await Transition.hashProposal(tampered);

  const val = await Transition.validateProposal(tampered, validationContext);
  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "duplicate_recovery_slot");
});

test("semantic rejection before hash check: reordered entry", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const tampered = JSON.parse(JSON.stringify(proposal));
  const temp = tampered.diff.recoveryWeek.entries[0];
  tampered.diff.recoveryWeek.entries[0] = tampered.diff.recoveryWeek.entries[1];
  tampered.diff.recoveryWeek.entries[1] = temp;
  tampered.proposalHash = await Transition.hashProposal(tampered);

  const val = await Transition.validateProposal(tampered, validationContext);
  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "recovery_slot_order");
});

test("semantic rejection before hash check: changed effective sets", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const tampered = JSON.parse(JSON.stringify(proposal));
  tampered.diff.recoveryWeek.entries[0].effectiveWorkingSets += 1;
  tampered.proposalHash = await Transition.hashProposal(tampered);

  const val = await Transition.validateProposal(tampered, validationContext);
  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "recovery_effective_sets_mismatch");
});

test("semantic rejection before hash check: wrong reason", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const tampered = JSON.parse(JSON.stringify(proposal));
  tampered.diff.recoveryWeek.entries[0].reason = "pattern-rescue";
  tampered.proposalHash = await Transition.hashProposal(tampered);

  const val = await Transition.validateProposal(tampered, validationContext);
  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "recovery_reason_mismatch");
});

test("semantic rejection before hash check: wrong optional flag", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const tampered = JSON.parse(JSON.stringify(proposal));
  tampered.diff.recoveryWeek.entries[0].removedOptionalFirst = !tampered.diff.recoveryWeek.entries[0].removedOptionalFirst;
  tampered.proposalHash = await Transition.hashProposal(tampered);

  const val = await Transition.validateProposal(tampered, validationContext);
  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "recovery_optional_flag_mismatch");
});

test("semantic rejection before hash check: raw or unknown movementPattern", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const tamperedRaw = JSON.parse(JSON.stringify(proposal));
  tamperedRaw.diff.recoveryWeek.entries[0].movementPattern = "squat";
  tamperedRaw.proposalHash = await Transition.hashProposal(tamperedRaw);
  const valRaw = await Transition.validateProposal(tamperedRaw, validationContext);
  assert.equal(valRaw.ok, false);
  assert.equal(valRaw.status, "invalid");
  assert.equal(valRaw.code, "recovery_pattern_mismatch");

  const tamperedUnknown = JSON.parse(JSON.stringify(proposal));
  tamperedUnknown.diff.recoveryWeek.entries[0].movementPattern = "unknown_pattern";
  tamperedUnknown.proposalHash = await Transition.hashProposal(tamperedUnknown);
  const valUnknown = await Transition.validateProposal(tamperedUnknown, validationContext);
  assert.equal(valUnknown.ok, false);
  assert.equal(valUnknown.status, "invalid");
  assert.equal(valUnknown.code, "recovery_pattern_mismatch");
});

test("semantic rejection before hash check: movement mismatch", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const tampered = JSON.parse(JSON.stringify(proposal));
  tampered.diff.recoveryWeek.entries[0].movement = "library:wrong_movement";
  tampered.proposalHash = await Transition.hashProposal(tampered);

  const val = await Transition.validateProposal(tampered, validationContext);
  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "recovery_movement_mismatch");
});

test("semantic rejection before hash check: slot mismatch", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const tampered = JSON.parse(JSON.stringify(proposal));
  tampered.diff.recoveryWeek.entries[0].slot = "wrong_slot_id";
  tampered.proposalHash = await Transition.hashProposal(tampered);

  const val = await Transition.validateProposal(tampered, validationContext);
  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "recovery_slot_mismatch");
});

test("semantic rejection before hash check: base fingerprint mismatch", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const tampered = JSON.parse(JSON.stringify(proposal));
  tampered.diff.recoveryWeek.baseProgramFingerprint = "program-sha256:0000000000000000000000000000000000000000000000000000000000000000";
  tampered.proposalHash = await Transition.hashProposal(tampered);

  const val = await Transition.validateProposal(tampered, validationContext);
  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "base_fingerprint_mismatch");
});

test("semantic rejection before hash check: non-allowlisted out-of-band version", async () => {
  const g2Context = gymContext("growth", 2);
  const g2Instance = Compiler.compile(g2Context, EXERCISE_LIBRARY);
  const { proposal } = await proposeRecoveryWeek(validRecoveryInput({ predecessorInstance: g2Instance }));

  const nonAllowlistedInstance = JSON.parse(JSON.stringify(g2Instance));
  nonAllowlistedInstance.blueprintId = "growth_2_custom_v1";
  nonAllowlistedInstance.provenance.blueprintId = "growth_2_custom_v1";
  nonAllowlistedInstance.programStructure.provenance.blueprintId = "growth_2_custom_v1";

  const tampered = JSON.parse(JSON.stringify(proposal));
  tampered.predecessor.compilerProvenance.blueprintId = "growth_2_custom_v1";
  tampered.derivation.compilerContextVersions.blueprintId = "growth_2_custom_v1";
  const newFp = await Transition.fingerprintCompilerInstance(nonAllowlistedInstance);
  tampered.predecessor.fingerprint = newFp;
  tampered.diff.recoveryWeek.baseProgramFingerprint = newFp;
  tampered.proposalHash = await Transition.hashProposal(tampered);

  const val = await Transition.validateProposal(tampered, {
    predecessor: {
      programId: "prog_recovery_test_4",
      durableRevision: 1,
      source: "Recommend",
    },
    predecessorInstance: nonAllowlistedInstance,
    approvedPolicy: APPROVED_POLICY_V2,
    supportedVersions: Compiler.VERSIONS,
  });
  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "recovery_volume_out_of_band");
});

test("semantic rejection before hash check: clamped output", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const tampered = JSON.parse(JSON.stringify(proposal));
  tampered.diff.recoveryWeek.entries[0].effectiveWorkingSets = 99;
  tampered.proposalHash = await Transition.hashProposal(tampered);

  const val = await Transition.validateProposal(tampered, validationContext);
  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "recovery_effective_sets_mismatch");
});

test("semantic rejection before hash check: forbidden successor", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const tampered = JSON.parse(JSON.stringify(proposal));
  tampered.successor = {
    programId: "prog_forbidden_succ",
    source: "Recommend",
  };
  tampered.proposalHash = await Transition.hashProposal(tampered);

  const val = await Transition.validateProposal(tampered, validationContext);
  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "forbidden_successor");
});

test("semantic rejection before hash check: forbidden parent confirmedAt or archiveId", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const tamperedConfirmed = JSON.parse(JSON.stringify(proposal));
  tamperedConfirmed.confirmedAt = "2026-10-01T10:00:00.000Z";
  tamperedConfirmed.proposalHash = await Transition.hashProposal(tamperedConfirmed);
  const valConfirmed = await Transition.validateProposal(tamperedConfirmed, validationContext);
  assert.equal(valConfirmed.ok, false);
  assert.equal(valConfirmed.status, "invalid");
  assert.equal(valConfirmed.code, "forbidden_lifecycle_field");

  const tamperedArchive = JSON.parse(JSON.stringify(proposal));
  tamperedArchive.archiveId = "arc_forbidden_01";
  tamperedArchive.proposalHash = await Transition.hashProposal(tamperedArchive);
  const valArchive = await Transition.validateProposal(tamperedArchive, validationContext);
  assert.equal(valArchive.ok, false);
  assert.equal(valArchive.status, "invalid");
  assert.equal(valArchive.code, "forbidden_lifecycle_field");
});

test("semantic rejection before hash check: forbidden overlay confirmedAt or reassessmentDueAt", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const tamperedConfirmed = JSON.parse(JSON.stringify(proposal));
  tamperedConfirmed.diff.recoveryWeek.confirmedAt = "2026-10-01T10:00:00.000Z";
  tamperedConfirmed.proposalHash = await Transition.hashProposal(tamperedConfirmed);
  const valConfirmed = await Transition.validateProposal(tamperedConfirmed, validationContext);
  assert.equal(valConfirmed.ok, false);
  assert.equal(valConfirmed.status, "invalid");
  assert.equal(valConfirmed.code, "forbidden_lifecycle_field");

  const tamperedDue = JSON.parse(JSON.stringify(proposal));
  tamperedDue.diff.recoveryWeek.reassessmentDueAt = "2026-10-08T10:00:00.000Z";
  tamperedDue.proposalHash = await Transition.hashProposal(tamperedDue);
  const valDue = await Transition.validateProposal(tamperedDue, validationContext);
  assert.equal(valDue.ok, false);
  assert.equal(valDue.status, "invalid");
  assert.equal(valDue.code, "forbidden_lifecycle_field");
});

test("stale predecessor proof: durableRevision or fingerprint change yields predecessor_changed", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const staleContext = {
    ...validationContext,
    predecessor: {
      ...validationContext.predecessor,
      durableRevision: 2,
    },
  };
  const val = await Transition.validateProposal(proposal, staleContext);
  assert.equal(val.ok, false);
  assert.equal(val.status, "stale");
  assert.equal(val.code, "predecessor_changed");
});

test("unhashed tamper proof: unhashed mutation yields proposal_hash_mismatch", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const tampered = JSON.parse(JSON.stringify(proposal));
  tampered.diff.recoveryWeek.entries[0].effectiveWorkingSets += 1;

  const val = await Transition.validateProposal(tampered, validationContext);
  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "proposal_hash_mismatch");
});
