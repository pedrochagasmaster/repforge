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
  // Under the resolved raw-evidence own-data model a consumed nested record
  // must use Object.prototype or null; a prototype-backed outcomes map is
  // structurally invalid evidence, not merely insufficient.
  assert.deepEqual(result, {
    ok: false,
    status: "ineligible",
    ineligible: true,
    code: "invalid_evidence",
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
    // The real, module-created proposal: it is the validated recovery-proposal
    // capability that commitRecord requires. Tests that need a mutable copy to
    // tamper with re-clone it explicitly via JSON round-trip.
    proposal: result.proposal,
    rawProposal: JSON.parse(JSON.stringify(result.proposal)),
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

test("unhashed tamper proof: semantically valid mutation still reaches the final hash gate", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const tampered = JSON.parse(JSON.stringify(proposal));
  // A consistent creation-time shift on the caller-owned identity fields is
  // semantically valid (nothing reconstructs them), so only the immutable
  // proposal hash can reject it. This proves the digest gate is still enforced
  // after every semantic, stale, and reconstruction check.
  tampered.createdAt = "2026-10-02T09:00:00.000Z";
  tampered.diff.recoveryWeek.createdAt = tampered.createdAt;

  const val = await Transition.validateProposal(tampered, validationContext);
  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "proposal_hash_mismatch");
});

test("rehashed consistent creation-time shift is a new valid proposal, not a hash bypass", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const regenerated = JSON.parse(JSON.stringify(proposal));
  regenerated.createdAt = "2026-10-02T09:00:00.000Z";
  regenerated.diff.recoveryWeek.createdAt = regenerated.createdAt;
  regenerated.proposalHash = await Transition.hashProposal(regenerated);

  const val = await Transition.validateProposal(regenerated, validationContext);
  assert.equal(val.ok, true);
  assert.equal(val.status, "preview");
});

test("semantic rejection precedes hash rejection for every freshly rehashed closed-field mutation", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();

  const mutations = [
    // Parent envelope
    ["missing schemaVersion", (p) => { delete p.schemaVersion; }, "invalid_proposal"],
    ["wrong schemaVersion", (p) => { p.schemaVersion = 2; }, "invalid_proposal"],
    ["missing transitionId", (p) => { delete p.transitionId; }, "invalid_proposal"],
    ["empty transitionId", (p) => { p.transitionId = "   "; }, "invalid_proposal"],
    ["missing createdAt", (p) => { delete p.createdAt; }, "invalid_proposal"],
    ["empty createdAt", (p) => { p.createdAt = ""; }, "invalid_proposal"],
    // Diagnosis exactly derived from normalized P5a evidence
    ["missing diagnosis", (p) => { delete p.diagnosis; }, "recovery_diagnosis_mismatch"],
    ["missing diagnosis.kind", (p) => { delete p.diagnosis.kind; }, "recovery_diagnosis_mismatch"],
    ["wrong diagnosis.kind", (p) => { p.diagnosis.kind = "reduce_training_volume"; }, "recovery_diagnosis_mismatch"],
    ["missing diagnosis.answers", (p) => { delete p.diagnosis.answers; }, "recovery_diagnosis_mismatch"],
    ["missing checkpoint answer", (p) => { delete p.diagnosis.answers.checkpointAnswer; }, "recovery_diagnosis_mismatch"],
    ["wrong checkpoint answer", (p) => { p.diagnosis.answers.checkpointAnswer = "Not sure"; }, "recovery_diagnosis_mismatch"],
    ["extra diagnosis answers key", (p) => { p.diagnosis.answers.notes = "invented"; }, "recovery_diagnosis_mismatch"],
    ["missing eligibleEvidenceIds", (p) => { delete p.diagnosis.eligibleEvidenceIds; }, "recovery_diagnosis_mismatch"],
    ["wrong eligibleEvidenceIds", (p) => { p.diagnosis.eligibleEvidenceIds = ["hip/hinge", "knee-dominant"]; }, "recovery_diagnosis_mismatch"],
    ["nonempty insufficient reasons", (p) => { p.diagnosis.insufficientEvidenceReasons = ["untested"]; }, "recovery_diagnosis_mismatch"],
    ["extra diagnosis key", (p) => { p.diagnosis.confidence = "high"; }, "recovery_diagnosis_mismatch"],
    // Derivation exactly overlay/recovery-week with live provenance and policy 2
    ["missing derivation", (p) => { delete p.derivation; }, "recovery_derivation_mismatch"],
    ["wrong derivation.mode", (p) => { p.derivation.mode = "recompilation"; }, "recovery_derivation_mismatch"],
    ["wrong derivation.request", (p) => { p.derivation.request = "reduce-training-volume"; }, "recovery_derivation_mismatch"],
    ["missing policyVersions", (p) => { delete p.derivation.policyVersions; }, "recovery_derivation_mismatch"],
    ["drifted policyVersions value", (p) => { p.derivation.policyVersions.recoveryWeek = 999; }, "recovery_derivation_mismatch"],
    ["extra policyVersions key", (p) => { p.derivation.policyVersions.volumeReduction = 1; }, "recovery_derivation_mismatch"],
    ["drifted compilerContextVersions", (p) => { p.derivation.compilerContextVersions.compilerVersion = 99; }, "recovery_derivation_mismatch"],
    ["missing slotMapping", (p) => { delete p.derivation.slotMapping; }, "recovery_derivation_mismatch"],
    ["extra derivation key", (p) => { p.derivation.note = "extra"; }, "recovery_derivation_mismatch"],
    // Diff
    ["missing diff.recoveryWeek", (p) => { delete p.diff.recoveryWeek; }, "missing_recovery_overlay"],
    ["extra diff key", (p) => { p.diff.recoveryWeekPreview = true; }, "invalid_recovery_diff"],
    ["nonempty diff.days", (p) => { p.diff.days = ["growth_4_d1"]; }, "invalid_recovery_diff"],
    ["nonempty diff.exercises", (p) => { p.diff.exercises = ["growth_4_d1_s1"]; }, "invalid_recovery_diff"],
    // Overlay envelope
    ["wrong overlay schemaVersion", (p) => { p.diff.recoveryWeek.schemaVersion = 2; }, "invalid_recovery_overlay"],
    ["wrong activePeriod", (p) => { p.diff.recoveryWeek.activePeriod = "thisBlockWeek1"; }, "invalid_recovery_overlay"],
    ["overlay transitionId mismatch", (p) => { p.diff.recoveryWeek.transitionId = "tr_other"; }, "invalid_recovery_overlay"],
    ["missing overlay blockId", (p) => { delete p.diff.recoveryWeek.blockId; }, "invalid_recovery_overlay"],
    ["empty overlay blockId", (p) => { p.diff.recoveryWeek.blockId = ""; }, "invalid_recovery_overlay"],
    ["overlay createdAt mismatch", (p) => { p.diff.recoveryWeek.createdAt = "2099-01-01T00:00:00.000Z"; }, "invalid_recovery_overlay"],
    ["preview reassessed Better", (p) => { p.diff.recoveryWeek.reassessmentOutcome = "Better"; }, "invalid_recovery_overlay"],
    ["missing reassessmentOutcome", (p) => { delete p.diff.recoveryWeek.reassessmentOutcome; }, "invalid_recovery_overlay"],
    ["extra overlay key", (p) => { p.diff.recoveryWeek.note = "extra"; }, "invalid_recovery_overlay"],
    ["wrong overlay policyVersion", (p) => { p.diff.recoveryWeek.policyVersion = 1; }, "unsupported_policy_version"],
    ["missing overlay policyVersion", (p) => { delete p.diff.recoveryWeek.policyVersion; }, "unsupported_policy_version"],
    ["wrong baseProgramFingerprint", (p) => { p.diff.recoveryWeek.baseProgramFingerprint = "program-sha256:deadbeef"; }, "base_fingerprint_mismatch"],
    ["missing baseProgramFingerprint", (p) => { delete p.diff.recoveryWeek.baseProgramFingerprint; }, "invalid_recovery_overlay"],    // Stored eligibility evidence must canonical-equal the evaluator normalization
    ["forged qualifyingPatterns", (p) => { p.diff.recoveryWeek.eligibilityEvidence.qualifyingPatterns = ["hip/hinge"]; }, "recovery_evidence_mismatch"],
    ["missing qualifyingPatterns", (p) => { delete p.diff.recoveryWeek.eligibilityEvidence.qualifyingPatterns; }, "recovery_evidence_mismatch"],
    ["extra non-qualifying outcome row", (p) => { p.diff.recoveryWeek.eligibilityEvidence.outcomesByPattern["hip/hinge"] = "improved"; }, "recovery_evidence_mismatch"],
    ["extra unknown outcomesByPattern row", (p) => { p.diff.recoveryWeek.eligibilityEvidence.outcomesByPattern["vertical pull"] = "maintained"; }, "ineligible_recovery_evidence"],
    ["free text on stored evidence", (p) => { p.diff.recoveryWeek.eligibilityEvidence.freeText = "invented"; }, "ineligible_recovery_evidence"],
    ["stored checkpoint No", (p) => { p.diff.recoveryWeek.eligibilityEvidence.checkpointAnswer = "No"; }, "ineligible_recovery_evidence"],
    ["missing stored checkpointAnswer", (p) => { delete p.diff.recoveryWeek.eligibilityEvidence.checkpointAnswer; }, "ineligible_recovery_evidence"],
    ["drifted stored outcome", (p) => { p.diff.recoveryWeek.eligibilityEvidence.outcomesByPattern["knee-dominant"] = "improved"; }, "ineligible_recovery_evidence"],
    ["extra qualifying outcome row", (p) => { p.diff.recoveryWeek.eligibilityEvidence.outcomesByPattern["hip/hinge"] = "maintained"; }, "recovery_evidence_mismatch"],
    // Entries
    ["missing entries", (p) => { delete p.diff.recoveryWeek.entries; }, "invalid_recovery_overlay"],
    ["entry missing key", (p) => { delete p.diff.recoveryWeek.entries[0].movement; }, "invalid_recovery_entries"],
    ["entry extra key", (p) => { p.diff.recoveryWeek.entries[0].note = "x"; }, "invalid_recovery_entries"],
    ["wrong base working sets", (p) => { p.diff.recoveryWeek.entries[0].baseWorkingSets += 1; }, "recovery_base_sets_mismatch"],
  ];

  let checked = 0;
  for (const [label, mutate, expectedCode] of mutations) {
    checked++;
    const tampered = JSON.parse(JSON.stringify(proposal));
    mutate(tampered);
    tampered.proposalHash = await Transition.hashProposal(tampered);

    const val = await Transition.validateProposal(tampered, validationContext);
    assert.equal(val.ok, false, `${label} must be rejected`);
    assert.equal(val.status, "invalid", `${label} must be invalid, not stale`);
    assert.equal(val.code, expectedCode, `${label} must return its stable semantic code`);
  }
  assert.equal(checked, mutations.length);
  assert.ok(checked >= 55, "mutation table must cover the whole closed recovery-preview schema");
});

test("policy closure: extra mapping keys, fake allowlist entries, and drifted enums yield policy_invalid", () => {
  const validEvidence = {
    outcomesByPattern: {
      "knee-dominant": "maintained",
      "horizontal press": "declined",
    },
    checkpointAnswer: "Yes",
  };

  const closedPolicyMutations = [
    ["extra patternMapping token", (p) => { p.patternMapping.unapproved = "knee-dominant"; }],
    ["fake allowlistedMisses entry", (p) => { p.allowlistedMisses.fake_v1 = { base: 100, effective: 1 }; }],
    ["allowlistedMisses entry extra key", (p) => { p.allowlistedMisses.growth_2_v1.note = 1; }],
    ["reordered checkpointAnswers", (p) => { p.eligibility.checkpointAnswers = ["No", "Yes", "Not sure"]; }],
    ["reordered reassessment outcomes", (p) => { p.reassessment.outcomes = ["Worse", "Better", "About the same"]; }],
    ["drifted ordinaryReviewOutcomes", (p) => { p.reassessment.ordinaryReviewOutcomes = ["Better", "Worse"]; }],
    ["ruleB optional extra key", (p) => { p.ruleB.optional.minimum = 1; }],
    ["ruleB extra branch", (p) => { p.ruleB.hidden = { effectiveWorkingSets: 0, reason: "hidden" }; }],
    ["acceptanceBand extra key", (p) => { p.acceptanceBand.target = 0.5; }],
    ["eligibility extra unknown key", (p) => { p.eligibility.freeText = "invented"; }],
    ["wrong protected divisor", (p) => { p.ruleB.protected.divisor = 3; }],
    ["wrong coverageRescue selection", (p) => { p.ruleB.coverageRescue.selection = "last-eligible"; }],
    ["allowlist totals drifted", (p) => { p.allowlistedMisses.growth_3_v1.effective = 18; }],
  ];

  for (const [label, mutate] of closedPolicyMutations) {
    const policy = clone(APPROVED_POLICY_V2);
    mutate(policy);
    const result = evaluateRecoveryEligibility(validEvidence, policy);
    assert.deepEqual(result, {
      ok: false,
      status: "ineligible",
      ineligible: true,
      code: "policy_invalid",
    }, `${label} must be rejected as policy_invalid`);
  }
});

test("raw input evidence closure: unknown keys are invalid_evidence and canonical question text stays tolerated", () => {
  const baseOutcomes = {
    "knee-dominant": "maintained",
    "horizontal press": "declined",
  };

  const withFreeText = evaluateRecoveryEligibility(
    { outcomesByPattern: baseOutcomes, checkpointAnswer: "Yes", freeText: "invented" },
    APPROVED_POLICY_V2,
  );
  assert.deepEqual(withFreeText, {
    ok: false,
    status: "ineligible",
    ineligible: true,
    code: "invalid_evidence",
  });

  const withQuestion = evaluateRecoveryEligibility(
    {
      outcomesByPattern: baseOutcomes,
      checkpointAnswer: "Yes",
      question: "During this block, did recovery feel worse than usual often enough to affect your training?",
    },
    APPROVED_POLICY_V2,
  );
  assert.equal(withQuestion.ok, true);
  assert.deepEqual(Object.keys(withQuestion.eligibilityEvidence), [
    "outcomesByPattern",
    "qualifyingPatterns",
    "checkpointAnswer",
  ]);
});

test("proposal creation requires explicit exact supported compiler versions", async () => {
  const instance = Compiler.compile(gymContext("growth", 4), EXERCISE_LIBRARY);
  const baseInput = validRecoveryInput({ predecessorInstance: instance });
  delete baseInput.supportedVersions;
  const withoutVersions = await proposeRecoveryWeek(baseInput);
  assert.deepEqual(withoutVersions, {
    ok: false,
    status: "unavailable",
    unavailable: true,
    code: "unsupported_compiler_version",
  });

  const coerced = clone(Compiler.VERSIONS);
  coerced.compiler = "2";
  const coercedResult = await proposeRecoveryWeek(
    validRecoveryInput({ predecessorInstance: instance, supportedVersions: coerced }),
  );
  assert.equal(coercedResult.ok, false);
  assert.equal(coercedResult.code, "unsupported_compiler_version");

  const drifted = clone(Compiler.VERSIONS);
  drifted.compiler = 3;
  const driftedResult = await proposeRecoveryWeek(
    validRecoveryInput({ predecessorInstance: instance, supportedVersions: drifted }),
  );
  assert.equal(driftedResult.ok, false);
  assert.equal(driftedResult.code, "unsupported_compiler_version");
});

test("allocation rejects compiler-valid snapshots with unsupported status, bad base sets, missing movement, or uncovered pattern", async () => {
  const evidence = {
    outcomesByPattern: {
      "knee-dominant": "maintained",
      "horizontal press": "declined",
    },
    checkpointAnswer: "Yes",
  };
  const propose = (synthetic) => proposeRecoveryWeek(validRecoveryInput({
    predecessorInstance: synthetic,
    evidence: clone(evidence),
  }));

  const base = Compiler.compile(gymContext("growth", 4), EXERCISE_LIBRARY);

  const badStatus = JSON.parse(JSON.stringify(base));
  for (const day of badStatus.days) {
    for (const slot of day.slots) {
      slot.status = "mystery";
      const programSlot = badStatus.program.find((e) => e.slotId === slot.slotId);
      if (programSlot) programSlot.priority = "mystery";
    }
  }
  const statusResult = await propose(badStatus);
  assert.equal(statusResult.ok, false);
  assert.equal(statusResult.code, "recovery_slot_status_invalid");

  const badSets = JSON.parse(JSON.stringify(base));
  for (const day of badSets.days) {
    for (const slot of day.slots) {
      slot.prescription.sets = 0;
      // The program row mirrors prescription.sets, so zeroing both sides
      // stays compiler-valid and reaches Rule B allocation.
      const programSlot = badSets.program.find((e) => e.slotId === slot.slotId);
      if (programSlot) programSlot.sets = 0;
    }
  }
  const setsResult = await propose(badSets);
  assert.equal(setsResult.ok, false);
  assert.equal(setsResult.code, "recovery_base_sets_invalid");

  const noMovement = JSON.parse(JSON.stringify(base));
  for (const day of noMovement.days) {
    for (const slot of day.slots) {
      if (slot.exercise) slot.exercise.id = "";
      const programSlot = noMovement.program.find((e) => e.slotId === slot.slotId);
      if (programSlot) {
        programSlot.libraryId = "";
        programSlot.movementId = null;
      }
    }
  }
  const movementResult = await propose(noMovement);
  assert.equal(movementResult.ok, false);
  assert.equal(movementResult.code, "recovery_movement_missing");

  const uncovered = JSON.parse(JSON.stringify(base));
  let flipped = 0;
  for (const day of uncovered.days) {
    for (const slot of day.slots) {
      if (slot.contract?.patterns?.[0] === "squat") {
        slot.contract.patterns[0] = "unknown_template";
        flipped++;
      }
    }
  }
  assert.ok(flipped >= 2, "at least two knee-dominant slots must be detached from their pattern");
  const uncoveredResult = await propose(uncovered);
  assert.equal(uncoveredResult.ok, false);
  assert.equal(uncoveredResult.code, "recovery_pattern_uncovered");

  // The shared allocation guard also fails validation: with the live
  // snapshot's fingerprint swapped in (so staleness passes), the validator
  // reaches deriveRecoveryWeek against the uncovered snapshot and fails on the
  // pattern guard before comparing any entry.
  const forged = JSON.parse(JSON.stringify((await proposeRecoveryWeek(validRecoveryInput({
    predecessorInstance: base,
    evidence: clone(evidence),
  }))).proposal));
  const uncoveredFingerprint = await Transition.fingerprintCompilerInstance(uncovered);
  forged.predecessor.fingerprint = uncoveredFingerprint;
  forged.diff.recoveryWeek.baseProgramFingerprint = uncoveredFingerprint;
  forged.proposalHash = await Transition.hashProposal(forged);
  const forgedValidation = await Transition.validateProposal(forged, {
    predecessor: {
      programId: "prog_recovery_test_4",
      durableRevision: 1,
      source: "Recommend",
    },
    predecessorInstance: uncovered,
    approvedPolicy: APPROVED_POLICY_V2,
    supportedVersions: Compiler.VERSIONS,
  });
  assert.equal(forgedValidation.ok, false);
  assert.equal(forgedValidation.code, "recovery_pattern_uncovered");
});

// ===================================================================
// 052-P5b own-record boundary correction (second repair cycle)
//
// Every recovery policy / evidence / proposal / predecessor / overlay /
// entry / ordered enum consumed at this boundary must be an own-data JSON
// shape. A required field or an allowlist key can never be satisfied
// through the prototype chain, a sparse or prototype-backed array can never
// line up against an ordered enum, and `createdAt` must be a canonical
// ISO-8601 UTC millisecond instant validated semantically before the
// terminal proposal-hash comparison. These tests fail on the
// pre-correction program-transition.js and pass after it.
// ===================================================================

const inherit = (protoProps, ownProps) => Object.assign(Object.create(protoProps), ownProps);

const VALID_EVIDENCE = Object.freeze({
  outcomesByPattern: Object.freeze({ "knee-dominant": "maintained", "horizontal press": "declined" }),
  checkpointAnswer: "Yes",
});
const INELIGIBLE_POLICY = { ok: false, status: "ineligible", ineligible: true, code: "policy_invalid" };
const INVALID_EVIDENCE = { ok: false, status: "ineligible", ineligible: true, code: "invalid_evidence" };

const freshEvidence = () => ({
  outcomesByPattern: { "knee-dominant": "maintained", "horizontal press": "declined" },
  checkpointAnswer: "Yes",
});

test("own-record boundary: inherited or sparse policy fields never satisfy the approved policy", () => {
  const cases = [
    ["inherited top-level kind", (p) => {
      const carrier = inherit({ kind: "taurifer-recovery-policy" }, { ...p });
      delete carrier.kind;
      return carrier;
    }],
    ["inherited top-level policyVersion", (p) => {
      const carrier = inherit({ policyVersion: 2 }, { ...p });
      delete carrier.policyVersion;
      return carrier;
    }],
    ["inherited top-level status", (p) => {
      const carrier = inherit({ status: "Approved" }, { ...p });
      delete carrier.status;
      return carrier;
    }],
    ["prototype-carrier patternMapping", (p) => {
      p.patternMapping = inherit(
        { squat: "knee-dominant" },
        { press: "horizontal press", incline_press: "horizontal press", hinge: "hip/hinge" },
      );
      return p;
    }],
    ["prototype-carrier eligibility", (p) => {
      p.eligibility = inherit({ minimumPatterns: 2 }, {
        qualifyingOutcomes: ["maintained", "declined"],
        checkpointAnswers: ["Yes", "No", "Not sure"],
        qualifyingCheckpointAnswer: "Yes",
      });
      return p;
    }],
    ["prototype-carrier ruleB", (p) => {
      p.ruleB = inherit({ optional: { effectiveWorkingSets: 0, reason: "optional-removed" } }, {
        protected: { rounding: "ceil", divisor: 2, reason: "protected-ceil" },
        reducible: { rounding: "floor", divisor: 2, reason: "reducible-floor" },
        coverageRescue: { minimumWorkingSets: 1, selection: "first-eligible-stable-order", reason: "pattern-rescue" },
      });
      return p;
    }],
    ["prototype-carrier reassessment", (p) => {
      p.reassessment = inherit({ weekTwoCanonical: true }, {
        outcomes: ["Better", "About the same", "Worse"],
        unset: null,
        ordinaryReviewOutcomes: ["About the same", "Worse"],
        sameBlockRepeat: false,
      });
      return p;
    }],
    ["inherited fake_v1 allowlist membership", (p) => {
      p.allowlistedMisses = inherit(
        { fake_v1: { base: 32, effective: 12 } },
        { growth_2_v1: { base: 32, effective: 12 }, growth_3_v1: { base: 49, effective: 17 } },
      );
      return p;
    }],
    ["sparse ordered primaryPatterns", (p) => {
      const sparse = ["knee-dominant"];
      sparse[2] = "hip/hinge";
      p.primaryPatterns = sparse;
      return p;
    }],
    ["sparse ordered checkpointAnswers", (p) => {
      const sparse = ["Yes"];
      sparse[2] = "Not sure";
      p.eligibility.checkpointAnswers = sparse;
      return p;
    }],
    ["dangerous own key on policy", (p) => {
      Object.defineProperty(p, "constructor", { enumerable: true, configurable: true, writable: true, value: 1 });
      return p;
    }],
    ["extra own top-level key", (p) => { p.injected = true; return p; }],
  ];
  for (const [label, mutate] of cases) {
    const policy = mutate(clone(APPROVED_POLICY_V2));
    assert.deepEqual(
      evaluateRecoveryEligibility(freshEvidence(), policy),
      INELIGIBLE_POLICY,
      `${label} must be rejected as policy_invalid`,
    );
  }
});

test("own-record boundary: null / array / plain-object policy controls", () => {
  assert.deepEqual(evaluateRecoveryEligibility(freshEvidence(), null), INELIGIBLE_POLICY);
  assert.deepEqual(evaluateRecoveryEligibility(freshEvidence(), []), INELIGIBLE_POLICY);
  assert.equal(evaluateRecoveryEligibility(freshEvidence(), clone(APPROVED_POLICY_V2)).ok, true);
});

test("own-record boundary: inherited evidence checkpoint or outcomesByPattern is rejected", () => {
  const outcomes = { "knee-dominant": "maintained", "horizontal press": "declined" };

  // outcomesByPattern reached only through the evidence prototype: nothing own
  // supports eligibility.
  assert.deepEqual(
    evaluateRecoveryEligibility(inherit({ outcomesByPattern: outcomes }, { checkpointAnswer: "Yes" }), APPROVED_POLICY_V2),
    INVALID_EVIDENCE,
  );

  // checkpointAnswer reached only through the evidence prototype is a custom-
  // prototype evidence carrier; the resolved own-data model rejects it
  // structurally as invalid_evidence before the "Yes" gate is reached.
  const inheritedCheckpoint = evaluateRecoveryEligibility(
    inherit({ checkpointAnswer: "Yes" }, { outcomesByPattern: { ...outcomes } }),
    APPROVED_POLICY_V2,
  );
  assert.equal(inheritedCheckpoint.ok, false);
  assert.equal(inheritedCheckpoint.code, "invalid_evidence");

  // Control: fully own evidence still qualifies; a nested inherited outcome row
  // is ignored (not a bypass), matching the existing prototype-outcomes test.
  assert.equal(evaluateRecoveryEligibility(
    { outcomesByPattern: { ...outcomes }, checkpointAnswer: "Yes" },
    APPROVED_POLICY_V2,
  ).ok, true);
});

test("raw-evidence own-data boundary: the five reproduced carriers reject as invalid_evidence with no getter execution", () => {
  const outcomes = { "knee-dominant": "maintained", "horizontal press": "declined" };
  let getterReads = 0;

  const customEvidenceProto = Object.assign(Object.create({ freeText: "inherited" }), {
    outcomesByPattern: { ...outcomes }, checkpointAnswer: "Yes",
  });
  const customOutcomesProto = {
    outcomesByPattern: Object.assign(Object.create({ "hip/hinge": "declined" }), outcomes),
    checkpointAnswer: "Yes",
  };
  const inheritedQuestion = Object.assign(Object.create({ question: "not canonical" }), {
    outcomesByPattern: { ...outcomes }, checkpointAnswer: "Yes",
  });
  const nonEnumerableCheckpoint = { outcomesByPattern: { ...outcomes } };
  Object.defineProperty(nonEnumerableCheckpoint, "checkpointAnswer", {
    enumerable: false, configurable: true, writable: true, value: "Yes",
  });
  const accessorCheckpoint = { outcomesByPattern: { ...outcomes } };
  Object.defineProperty(accessorCheckpoint, "checkpointAnswer", {
    enumerable: true, configurable: true,
    get() { getterReads += 1; return "Yes"; },
  });

  for (const [label, evidence] of [
    ["custom evidence prototype", customEvidenceProto],
    ["custom nested outcomes prototype", customOutcomesProto],
    ["inherited noncanonical question", inheritedQuestion],
    ["non-enumerable checkpointAnswer", nonEnumerableCheckpoint],
    ["accessor checkpointAnswer", accessorCheckpoint],
  ]) {
    assert.deepEqual(
      evaluateRecoveryEligibility(evidence, APPROVED_POLICY_V2),
      INVALID_EVIDENCE,
      `${label} must reject as invalid_evidence`,
    );
  }
  assert.equal(getterReads, 0, "validation must never invoke a getter while rejecting it");
});

test("raw-evidence own-data boundary: accessor, symbol, and non-enumerable fields on nested outcomes reject", () => {
  let getterReads = 0;

  const accessorOutcomes = { "knee-dominant": "maintained" };
  Object.defineProperty(accessorOutcomes, "horizontal press", {
    enumerable: true, configurable: true,
    get() { getterReads += 1; return "declined"; },
  });
  const symbolOutcomes = { "knee-dominant": "maintained", "horizontal press": "declined" };
  symbolOutcomes[Symbol("injected")] = "improved";
  const nonEnumerableOutcomes = { "knee-dominant": "maintained" };
  Object.defineProperty(nonEnumerableOutcomes, "horizontal press", {
    enumerable: false, configurable: true, writable: true, value: "declined",
  });

  for (const [label, outcomes] of [
    ["accessor nested outcome", accessorOutcomes],
    ["symbol-keyed nested outcome", symbolOutcomes],
    ["non-enumerable nested outcome", nonEnumerableOutcomes],
  ]) {
    assert.deepEqual(
      evaluateRecoveryEligibility({ outcomesByPattern: outcomes, checkpointAnswer: "Yes" }, APPROVED_POLICY_V2),
      INVALID_EVIDENCE,
      `${label} must reject as invalid_evidence`,
    );
  }
  assert.equal(getterReads, 0, "validation must never invoke a getter while rejecting it");
});

test("raw-evidence own-data boundary: extra named, accessor, symbol, and sparse ordered arrays reject", () => {
  let getterReads = 0;

  const outcomes = { "knee-dominant": "maintained", "horizontal press": "declined" };
  const extraNamed = ["knee-dominant", "horizontal press"];
  extraNamed.injected = "hip/hinge";
  const accessorIndexed = new Array(2);
  Object.defineProperty(accessorIndexed, 0, {
    enumerable: true, configurable: true,
    get() { getterReads += 1; return "knee-dominant"; },
  });
  Object.defineProperty(accessorIndexed, 1, {
    enumerable: true, configurable: true,
    get() { getterReads += 1; return "horizontal press"; },
  });
  const symbolTagged = ["knee-dominant", "horizontal press"];
  symbolTagged[Symbol("tag")] = "hip/hinge";
  const sparse = new Array(3);
  sparse[0] = "knee-dominant";
  sparse[2] = "hip/hinge";

  for (const [label, qualifyingPatterns] of [
    ["extra named property on ordered array", extraNamed],
    ["accessor index on ordered array", accessorIndexed],
    ["symbol property on ordered array", symbolTagged],
    ["sparse ordered array", sparse],
  ]) {
    assert.deepEqual(
      evaluateRecoveryEligibility(
        { outcomesByPattern: { ...outcomes }, checkpointAnswer: "Yes", qualifyingPatterns },
        APPROVED_POLICY_V2,
      ),
      INVALID_EVIDENCE,
      `${label} must reject as invalid_evidence`,
    );
  }

  const accessorPatterns = new Array(3);
  Object.defineProperty(accessorPatterns, 0, {
    enumerable: true, configurable: true,
    get() { getterReads += 1; return "knee-dominant"; },
  });
  const policyWithAccessorPatterns = clone(APPROVED_POLICY_V2);
  policyWithAccessorPatterns.primaryPatterns = accessorPatterns;
  assert.deepEqual(
    evaluateRecoveryEligibility(freshEvidence(), policyWithAccessorPatterns),
    INELIGIBLE_POLICY,
    "accessor index on a policy ordered array must reject as policy_invalid",
  );
  const symbolPatterns = clone(APPROVED_POLICY_V2);
  symbolPatterns.primaryPatterns = Object.assign(["knee-dominant", "horizontal press", "hip/hinge"]);
  symbolPatterns.primaryPatterns[Symbol("tag")] = "injected";
  assert.deepEqual(evaluateRecoveryEligibility(freshEvidence(), symbolPatterns), INELIGIBLE_POLICY);

  assert.equal(getterReads, 0, "validation must never invoke a getter while rejecting it");
});

test("raw-evidence own-data boundary: ordinary JSON and null-prototype evidence still qualify", () => {
  const outcomes = { "knee-dominant": "maintained", "horizontal press": "declined" };

  const jsonResult = evaluateRecoveryEligibility(
    { outcomesByPattern: { ...outcomes }, checkpointAnswer: "Yes" },
    APPROVED_POLICY_V2,
  );
  assert.equal(jsonResult.ok, true);
  assert.equal(jsonResult.status, "eligible");
  assert.deepEqual(jsonResult.eligibilityEvidence.qualifyingPatterns, ["knee-dominant", "horizontal press"]);

  const nullProtoEvidence = Object.assign(Object.create(null), {
    outcomesByPattern: Object.assign(Object.create(null), outcomes),
    checkpointAnswer: "Yes",
  });
  const nullProtoResult = evaluateRecoveryEligibility(nullProtoEvidence, APPROVED_POLICY_V2);
  assert.equal(nullProtoResult.ok, true);
  assert.equal(nullProtoResult.status, "eligible");
  assert.deepEqual(nullProtoResult.eligibilityEvidence.qualifyingPatterns, ["knee-dominant", "horizontal press"]);
});

test("own-record boundary: a forged fake_v1 out-of-band instance cannot mint a preview via an inherited allowlist", async () => {
  const inheritedAllow = clone(APPROVED_POLICY_V2);
  inheritedAllow.allowlistedMisses = inherit(
    { fake_v1: { base: 32, effective: 12 } },
    { growth_2_v1: { base: 32, effective: 12 }, growth_3_v1: { base: 49, effective: 17 } },
  );

  assert.deepEqual(evaluateRecoveryEligibility(freshEvidence(), inheritedAllow), INELIGIBLE_POLICY);

  const pred = Compiler.compile(gymContext("growth", 2), EXERCISE_LIBRARY);
  pred.blueprintId = "fake_v1";
  pred.provenance.blueprintId = "fake_v1";
  pred.programStructure.provenance.blueprintId = "fake_v1";

  const out = await proposeRecoveryWeek({
    predecessorInstance: pred,
    predecessor: { programId: "p", durableRevision: 1, source: "Recommend" },
    approvedPolicy: inheritedAllow,
    evidence: freshEvidence(),
    transitionId: "t",
    blockId: "b",
    createdAt: "2026-01-01T00:00:00.000Z",
    supportedVersions: Compiler.VERSIONS,
  });
  assert.equal(out.ok, false, "forged fake_v1 instance must never mint a preview");
  assert.notEqual(out.status, "preview");
  assert.ok(
    out.code === "policy_invalid" || out.code === "recovery_volume_out_of_band",
    `expected policy_invalid or recovery_volume_out_of_band, got ${out.code}`,
  );

  // Defence in depth: a plain-object allowlist that simply adds fake_v1 is still
  // rejected as policy_invalid.
  const plainExtra = clone(APPROVED_POLICY_V2);
  plainExtra.allowlistedMisses.fake_v1 = { base: 32, effective: 12 };
  assert.deepEqual(evaluateRecoveryEligibility(freshEvidence(), plainExtra), INELIGIBLE_POLICY);
});

test("validateRecoveryProposal: extra proposal or predecessor keys fail semantically before the hash gate", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const cases = [
    ["extra top-level proposal key", (p) => { p.note = "x"; }],
    ["predecessor.confirmedAt", (p) => { p.predecessor.confirmedAt = "2026-10-01T09:00:00.000Z"; }],
    ["predecessor.archiveId", (p) => { p.predecessor.archiveId = "arc_x"; }],
    ["extra predecessor key", (p) => { p.predecessor.extra = 1; }],
    ["prototype-carrier diagnosis", (p) => {
      p.diagnosis = Object.assign(Object.create({ kind: "recovery_week" }), {
        answers: { checkpointAnswer: "Yes" },
        eligibleEvidenceIds: [...p.diagnosis.eligibleEvidenceIds],
        insufficientEvidenceReasons: [],
      });
    }],
    ["sparse entries array", (p) => { p.diff.recoveryWeek.entries.length += 1; }],
  ];
  for (const [label, mutate] of cases) {
    const tampered = JSON.parse(JSON.stringify(proposal));
    mutate(tampered);
    tampered.proposalHash = await Transition.hashProposal(tampered);
    const val = await Transition.validateProposal(tampered, validationContext);
    assert.equal(val.ok, false, `${label} must be rejected`);
    assert.equal(val.status, "invalid", `${label} must be invalid, not stale`);
    assert.equal(val.code, "invalid_proposal", `${label} must return invalid_proposal before the hash gate`);
  }
});

test("validateRecoveryProposal: createdAt must be a canonical ISO-8601 UTC millisecond instant", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const bad = [
    "TBD",
    "2026-10-01",
    "2026-10-01T09:00:00Z",
    "2026-10-01T09:00:00.000+00:00",
    "2026-10-01T09:00:00.0Z",
    "2026-13-01T09:00:00.000Z",
    "2026-10-01T09:00:00.000z",
  ];
  for (const value of bad) {
    const tampered = JSON.parse(JSON.stringify(proposal));
    tampered.createdAt = value;
    tampered.diff.recoveryWeek.createdAt = value;
    tampered.proposalHash = await Transition.hashProposal(tampered);
    const val = await Transition.validateProposal(tampered, validationContext);
    assert.equal(val.ok, false, `${value} must be rejected`);
    assert.equal(val.status, "invalid");
    assert.equal(val.code, "invalid_proposal", `${value} must fail as invalid_proposal`);
  }
  // Overlay copy alone non-canonical (parent still canonical) → overlay code.
  const overlayOnly = JSON.parse(JSON.stringify(proposal));
  overlayOnly.diff.recoveryWeek.createdAt = "TBD";
  overlayOnly.proposalHash = await Transition.hashProposal(overlayOnly);
  const overlayVal = await Transition.validateProposal(overlayOnly, validationContext);
  assert.equal(overlayVal.ok, false);
  assert.equal(overlayVal.code, "invalid_recovery_overlay");

  // Canonical control: a consistent canonical shift + rehash is a new valid proposal.
  const good = JSON.parse(JSON.stringify(proposal));
  good.createdAt = "2027-03-04T05:06:07.000Z";
  good.diff.recoveryWeek.createdAt = good.createdAt;
  good.proposalHash = await Transition.hashProposal(good);
  const okVal = await Transition.validateProposal(good, validationContext);
  assert.equal(okVal.ok, true);
  assert.equal(okVal.status, "preview");
});

test("proposeRecoveryWeek rejects a non-canonical createdAt at creation", async () => {
  const instance = Compiler.compile(gymContext("growth", 4), EXERCISE_LIBRARY);
  for (const value of ["TBD", "2026-10-01", "2026-10-01T09:00:00Z", ""]) {
    const result = await proposeRecoveryWeek(validRecoveryInput({ predecessorInstance: instance, createdAt: value }));
    assert.equal(result.ok, false, `${JSON.stringify(value)} must not create a proposal`);
    assert.equal(result.code, "invalid_proposal");
  }
});

test("pattern-rescue proposal round-trips through validateProposal and rejects a forged rescue reason", async () => {
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
  assert.ok(modified >= 2);

  const input = validRecoveryInput({ predecessorInstance: synthetic });
  const made = await proposeRecoveryWeek(input);
  assert.equal(made.ok, true, `synthetic rescue proposal must be created: ${made.code}`);
  const proposal = JSON.parse(JSON.stringify(made.proposal));

  const context = {
    predecessor: input.predecessor,
    predecessorInstance: synthetic,
    approvedPolicy: APPROVED_POLICY_V2,
    supportedVersions: Compiler.VERSIONS,
  };
  const rescueIndex = proposal.diff.recoveryWeek.entries.findIndex((e) => e.reason === "pattern-rescue");
  assert.ok(rescueIndex >= 0, "synthetic fixture must exercise the rescue path");

  const okVal = await Transition.validateProposal(proposal, context);
  assert.equal(okVal.ok, true, `rescue proposal must validate: ${okVal.code}`);
  assert.equal(okVal.status, "preview");

  const forged = JSON.parse(JSON.stringify(proposal));
  forged.diff.recoveryWeek.entries[rescueIndex].reason = "optional-removed";
  forged.proposalHash = await Transition.hashProposal(forged);
  const forgedVal = await Transition.validateProposal(forged, context);
  assert.equal(forgedVal.ok, false);
  assert.equal(forgedVal.status, "invalid");
  assert.equal(forgedVal.code, "recovery_reason_mismatch");
});

test("combined stale predecessor and freshly rehashed semantic forgery resolves to stale precedence", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const tampered = JSON.parse(JSON.stringify(proposal));
  tampered.diagnosis.kind = "reduce_training_volume";
  tampered.proposalHash = await Transition.hashProposal(tampered);
  const staleContext = {
    ...validationContext,
    predecessor: { ...validationContext.predecessor, durableRevision: 99 },
  };
  const val = await Transition.validateProposal(tampered, staleContext);
  assert.equal(val.ok, false);
  assert.equal(val.status, "stale");
  assert.equal(val.code, "predecessor_changed");
});

test("consistent valid canonical createdAt rehash control still validates", async () => {
  const { proposal, validationContext } = await createBaseRecoveryFixture();
  const shifted = JSON.parse(JSON.stringify(proposal));
  shifted.createdAt = "2026-12-31T23:59:59.000Z";
  shifted.diff.recoveryWeek.createdAt = shifted.createdAt;
  shifted.proposalHash = await Transition.hashProposal(shifted);
  const val = await Transition.validateProposal(shifted, validationContext);
  assert.equal(val.ok, true);
  assert.equal(val.status, "preview");
});

// ============================================================================
// 052-P5c correction 1: validated recovery lifecycle boundary
//
// Raw / mutable recovery proposals and records are a distinct runtime state
// from the module-created / sealed / reassessed / validator-accepted values.
// Only the latter (a small module-private unforgeable capability over
// deep-frozen data) may seal, reassess, or drive an active projection.
// These tests reproduce every high/medium finding of the fixed-SHA reviews
// (Gemini S52-01..05, Sonnet P52-01..05, GLM A52-1..6) against the corrected
// API and lock the deliberate failures.
// ============================================================================

const RW_CONFIRMED_AT = "2026-10-01T10:00:00.000Z";
const RW_DUE_AT = "2026-10-08T10:00:00.000Z";

// A committed recovery record produced through the real module path.
// `proposal` and `record` are the module capability values; `storedRecord` is
// the raw JSON copy a reload parses back from durable storage (NOT a
// capability).
async function sealedRecoveryFixture(overrides = {}) {
  const familyFreq = overrides.familyFreq || ["growth", 4];
  const instance = Compiler.compile(gymContext(familyFreq[0], familyFreq[1]), EXERCISE_LIBRARY);
  const input = validRecoveryInput({
    predecessorInstance: instance,
    blockId: overrides.blockId || "block_local_b1",
    transitionId: overrides.transitionId || "tr_recov_001",
    predecessor: overrides.predecessor || { programId: "prog_recovery_test_4", durableRevision: 1, source: "Recommend" },
  });
  const proposalResult = await proposeRecoveryWeek(input);
  assert.equal(proposalResult.ok, true, `fixture propose failed: ${proposalResult.code}`);
  const proposal = proposalResult.proposal;
  const record = Transition.commitRecord(proposal, {
    confirmedAt: RW_CONFIRMED_AT,
    reassessmentDueAt: RW_DUE_AT,
    archiveId: null,
  });
  return {
    instance,
    input,
    proposal,
    rawProposal: JSON.parse(JSON.stringify(proposal)),
    record,
    storedRecord: JSON.parse(JSON.stringify(record)),
    blockId: record.diff.recoveryWeek.blockId,
    baseProgramFingerprint: record.diff.recoveryWeek.baseProgramFingerprint,
    projectionContext: {
      blockId: record.diff.recoveryWeek.blockId,
      elapsedWeek: 1,
      baseProgramFingerprint: record.diff.recoveryWeek.baseProgramFingerprint,
    },
    validationContext: {
      predecessor: input.predecessor,
      predecessorInstance: instance,
      approvedPolicy: APPROVED_POLICY_V2,
      supportedVersions: Compiler.VERSIONS,
    },
  };
}

function assertDeeplyFrozen(value, label) {
  if (value === null || typeof value !== "object") return;
  assert.ok(Object.isFrozen(value), `${label} must be frozen`);
  for (const key of Object.keys(value)) assertDeeplyFrozen(value[key], `${label}.${key}`);
}

function assertAcyclicJson(value, label) {
  // Throws on a cycle; also proves no non-enumerable metadata survives.
  const roundTrip = JSON.parse(JSON.stringify(value));
  assert.deepEqual(roundTrip, value, `${label} must be JSON-serializable with no hidden metadata`);
}

// ---------------------------------------------------------------------------
// Seam + alias surface
// ---------------------------------------------------------------------------

test("seam: single named lifecycle functions are exported; speculative P5c aliases are removed", () => {
  for (const name of [
    "validateRecoveryProposal",
    "validateRecoveryRecord",
    "commitRecord",
    "reassessRecoveryRecord",
    "projectRecoveryProgram",
  ]) {
    assert.equal(typeof Transition[name], "function", `${name} must be exported`);
  }
  for (const removed of [
    "validateCommittedRecoveryRecord",
    "validateCommittedRecord",
    "sealRecoveryRecord",
    "reassessRecoveryWeek",
    "projectRecoveryRows",
    "projectRecoveryLifecycle",
  ]) {
    assert.equal(Transition[removed], undefined, `${removed} alias must be removed`);
  }
  // Established pre-P5c aliases are untouched.
  assert.equal(typeof Transition.createRecoveryWeekProposal, "function");
  assert.equal(Transition.createRecoveryWeekProposal, Transition.proposeRecoveryWeek);
});

// ---------------------------------------------------------------------------
// Capability state model
// ---------------------------------------------------------------------------

test("capability: module-created proposal/record are deep-frozen; a JSON clone is a distinct non-capability state", async () => {
  const { proposal, record } = await sealedRecoveryFixture();
  assertDeeplyFrozen(proposal, "proposal");
  assertDeeplyFrozen(record, "record");

  // A clone is structurally identical but is NOT the capability: it cannot seal
  // or project.
  const clonedProposal = JSON.parse(JSON.stringify(proposal));
  assert.throws(
    () => Transition.commitRecord(clonedProposal, { confirmedAt: RW_CONFIRMED_AT, reassessmentDueAt: RW_DUE_AT, archiveId: null }),
    TypeError,
    "a cloned preview must not seal",
  );

  const clonedRecord = JSON.parse(JSON.stringify(record));
  const proj = Transition.projectRecoveryProgram([], clonedRecord, { blockId: "x", elapsedWeek: 1, baseProgramFingerprint: "y" });
  assert.equal(proj.ok, false);
  assert.equal(proj.code, "recovery_record_invalid");
});

test("capability: commitRecord accepts the module proposal AND a validator-returned proposal clone", async () => {
  const { rawProposal, validationContext } = await sealedRecoveryFixture({ transitionId: "tr_cap_seal", blockId: "block_cap_seal" });

  // The validator re-accepts a raw preview and returns a deep-frozen clone as
  // data in the result; that clone is itself a sealing capability.
  const val = await Transition.validateRecoveryProposal(rawProposal, validationContext);
  assert.equal(val.ok, true);
  assert.equal(val.status, "preview");
  assert.ok(val.proposal, "validator must return the accepted proposal");
  assertDeeplyFrozen(val.proposal, "val.proposal");
  assert.notEqual(val.proposal, rawProposal, "returned proposal must not be the mutable caller object");

  const record = Transition.commitRecord(val.proposal, { confirmedAt: RW_CONFIRMED_AT, reassessmentDueAt: RW_DUE_AT, archiveId: null });
  assert.equal(record.status, "committed");
  assert.equal(record.kind, "recovery_week");

  // The raw preview the validator was handed is still not a capability.
  assert.throws(
    () => Transition.commitRecord(rawProposal, { confirmedAt: RW_CONFIRMED_AT, reassessmentDueAt: RW_DUE_AT, archiveId: null }),
    TypeError,
  );
});

test("capability: mutating a validated mutable source after validation cannot affect the accepted frozen clone", async () => {
  const { storedRecord, validationContext, instance, projectionContext } = await sealedRecoveryFixture();
  const rows = instance.program;

  const val = await Transition.validateRecoveryRecord(storedRecord, validationContext);
  assert.equal(val.ok, true);
  assert.equal(val.status, "committed");
  assert.ok(val.record, "validator must return the accepted record");
  assertDeeplyFrozen(val.record, "val.record");

  // Tamper the mutable source AFTER validation.
  storedRecord.diff.recoveryWeek.entries[0].effectiveWorkingSets = 999;
  storedRecord.proposalHash = "forged_after_validation";

  // Only the returned frozen clone projects.
  const projAccepted = Transition.projectRecoveryProgram(rows, val.record, projectionContext);
  assert.equal(projAccepted.ok, true);
  assert.equal(projAccepted.active, true);

  // The mutated raw source is not a capability and fails closed.
  const projRaw = Transition.projectRecoveryProgram(rows, storedRecord, projectionContext);
  assert.equal(projRaw.ok, false);
  assert.equal(projRaw.code, "recovery_record_invalid");
  assert.deepEqual(projRaw.rows, rows);
});

test("capability: a caller-forged capability-shaped object cannot seal or project", async () => {
  const { instance, projectionContext } = await sealedRecoveryFixture();

  const forgedPreview = {
    schemaVersion: 1,
    transitionId: "tr_forged",
    kind: "recovery_week",
    createdAt: "2026-10-01T09:00:00.000Z",
    status: "preview",
    proposalHash: "forged",
    __recoveryCapability: true,
    capability: true,
    diff: { days: [], exercises: [], prescriptions: [], recoveryWeek: { entries: [] } },
  };
  assert.throws(
    () => Transition.commitRecord(forgedPreview, { confirmedAt: RW_CONFIRMED_AT, reassessmentDueAt: RW_DUE_AT, archiveId: null }),
    TypeError,
  );

  const forgedRecord = { ...JSON.parse(JSON.stringify((await sealedRecoveryFixture()).record)), __recoveryCapability: true };
  const proj = Transition.projectRecoveryProgram(instance.program, forgedRecord, projectionContext);
  assert.equal(proj.ok, false);
  assert.equal(proj.code, "recovery_record_invalid");
});

// ---------------------------------------------------------------------------
// Sealing (S52-* / A52-6); replacement sealing byte-identical
// ---------------------------------------------------------------------------

test("sealing: recovery_week seal yields a deep-frozen committed record; preview proposalHash preserved; inputs unmutated", async () => {
  const { proposal } = await sealedRecoveryFixture({ transitionId: "tr_seal_ok", blockId: "block_seal_ok" });
  const options = { confirmedAt: RW_CONFIRMED_AT, reassessmentDueAt: RW_DUE_AT, archiveId: null };
  const record = Transition.commitRecord(proposal, options);

  assert.equal(record.status, "committed");
  assert.equal(record.kind, "recovery_week");
  assert.equal(record.confirmedAt, RW_CONFIRMED_AT);
  assert.equal(record.archiveId, null);
  assert.equal(record.successor, undefined);
  assert.equal(record.proposalHash, proposal.proposalHash, "preview proposalHash is carried by the committed record");

  const overlay = record.diff.recoveryWeek;
  assert.equal(overlay.confirmedAt, RW_CONFIRMED_AT);
  assert.equal(overlay.reassessmentDueAt, RW_DUE_AT);
  assert.equal(overlay.reassessmentOutcome, null);
  assertDeeplyFrozen(record, "record");

  assert.equal(proposal.status, "preview");
  assert.equal(proposal.confirmedAt, undefined);
  assert.equal(options.archiveId, null);
});

test("sealing: replacement-kind sealing remains byte-identical", async () => {
  const replacementProposal = {
    schemaVersion: 1,
    transitionId: "tr_replace_001",
    kind: "sibling_frequency",
    status: "preview",
    proposalHash: "hash_replace_001",
  };
  const confirmedAt = "2026-10-01T10:00:00.000Z";
  const archiveId = "arc_replace_001";
  const record = Transition.commitRecord(replacementProposal, { confirmedAt, archiveId });
  assert.equal(record.status, "committed");
  assert.equal(record.confirmedAt, confirmedAt);
  assert.equal(record.archiveId, archiveId);
  assert.ok(Object.isFrozen(record));
  // Replacement seal takes no capability: a plain object still seals.
  assert.equal(replacementProposal.status, "preview");
});

test("sealing negative controls: bad archiveId / non-canonical or reversed timestamps / confirmedAt < createdAt throw TypeError", async () => {
  const { proposal } = await sealedRecoveryFixture({ transitionId: "tr_seal_neg", blockId: "block_seal_neg" });

  assert.throws(() => Transition.commitRecord(proposal, { confirmedAt: RW_CONFIRMED_AT, reassessmentDueAt: RW_DUE_AT, archiveId: "arc_forged" }), TypeError);
  assert.throws(() => Transition.commitRecord(proposal, { confirmedAt: "not-a-date", reassessmentDueAt: RW_DUE_AT, archiveId: null }), TypeError);
  assert.throws(() => Transition.commitRecord(proposal, { confirmedAt: RW_CONFIRMED_AT, reassessmentDueAt: "2026-10-08", archiveId: null }), TypeError);
  assert.throws(() => Transition.commitRecord(proposal, { confirmedAt: RW_DUE_AT, reassessmentDueAt: RW_CONFIRMED_AT, archiveId: null }), TypeError);
  assert.throws(() => Transition.commitRecord(proposal, { confirmedAt: RW_CONFIRMED_AT, reassessmentDueAt: RW_CONFIRMED_AT, archiveId: null }), TypeError);
  // confirmedAt strictly before the preview createdAt (proposal.createdAt is 2026-10-01T09:00:00.000Z)
  assert.throws(() => Transition.commitRecord(proposal, { confirmedAt: "2026-09-30T10:00:00.000Z", reassessmentDueAt: RW_DUE_AT, archiveId: null }), TypeError);
});

test("sealing negative controls: stripped overlay / forged hash / missing createdAt on an unvalidated clone throw with no committed record", async () => {
  const { proposal } = await sealedRecoveryFixture({ transitionId: "tr_seal_forge", blockId: "block_seal_forge" });

  const strippedOverlay = JSON.parse(JSON.stringify(proposal));
  strippedOverlay.diff = { days: [], exercises: [], prescriptions: [] };
  assert.throws(() => Transition.commitRecord(strippedOverlay, { confirmedAt: RW_CONFIRMED_AT, reassessmentDueAt: RW_DUE_AT, archiveId: null }), TypeError);

  const forgedHash = JSON.parse(JSON.stringify(proposal));
  forgedHash.diff.recoveryWeek.entries[0].effectiveWorkingSets = 42;
  forgedHash.proposalHash = "deadbeef_forged";
  assert.throws(() => Transition.commitRecord(forgedHash, { confirmedAt: RW_CONFIRMED_AT, reassessmentDueAt: RW_DUE_AT, archiveId: null }), TypeError);

  const noCreated = JSON.parse(JSON.stringify(proposal));
  delete noCreated.createdAt;
  delete noCreated.diff.recoveryWeek.createdAt;
  assert.throws(() => Transition.commitRecord(noCreated, { confirmedAt: RW_CONFIRMED_AT, reassessmentDueAt: RW_DUE_AT, archiveId: null }), TypeError);
});

test("sealing: proposalPreimage semantics — hashProposal(committedRecord) differs from the preview hash", async () => {
  const { proposal, record } = await sealedRecoveryFixture({ transitionId: "tr_preimage", blockId: "block_preimage" });
  const directHash = await Transition.hashProposal(record);
  assert.notEqual(directHash, proposal.proposalHash, "committed lifecycle fields perturb a direct hash");
  assert.equal(record.proposalHash, proposal.proposalHash, "the committed record still carries the preview hash");
});

// ---------------------------------------------------------------------------
// Committed-record validation (P52-01 / A52-1 / A52-5 / S52-02)
// ---------------------------------------------------------------------------

test("committed-record validation: a valid sealed record validates and returns the accepted deep-frozen record", async () => {
  const { record, storedRecord, validationContext } = await sealedRecoveryFixture({ transitionId: "tr_val_ok", blockId: "block_val_ok" });

  const val = await Transition.validateRecoveryRecord(record, validationContext);
  assert.equal(val.ok, true);
  assert.equal(val.status, "committed");
  assert.ok(val.record, "must return the accepted record as data");
  assertDeeplyFrozen(val.record, "val.record");
  assert.deepEqual(val.record, storedRecord);

  const viaDispatch = await Transition.validateProposal(record, validationContext);
  assert.equal(viaDispatch.ok, true);
  assert.equal(viaDispatch.status, "committed");
  assert.ok(viaDispatch.record);
});

test("committed-record validation: reload path — the raw stored record validates; only the validator-returned clone projects", async () => {
  const { storedRecord, validationContext, instance, projectionContext } = await sealedRecoveryFixture({ transitionId: "tr_reload", blockId: "block_reload" });
  const rows = instance.program;

  const val = await Transition.validateRecoveryRecord(storedRecord, validationContext);
  assert.equal(val.ok, true);

  const projAccepted = Transition.projectRecoveryProgram(rows, val.record, projectionContext);
  assert.equal(projAccepted.ok, true);
  assert.equal(projAccepted.active, true);

  const projRaw = Transition.projectRecoveryProgram(rows, storedRecord, projectionContext);
  assert.equal(projRaw.ok, false);
  assert.equal(projRaw.code, "recovery_record_invalid");
});

test("committed-record validation: same-record reload self-exempts; a different transition in the same block still refuses", async () => {
  const { record, storedRecord, validationContext } = await sealedRecoveryFixture({ transitionId: "tr_self", blockId: "block_self" });

  // Own stored copy present (same transitionId) -> idempotent retry succeeds.
  const selfList = await Transition.validateRecoveryRecord(record, {
    ...validationContext,
    existingRecoveryRecords: [JSON.parse(JSON.stringify(storedRecord))],
  });
  assert.equal(selfList.ok, true, `own stored copy must self-exempt (got ${selfList.code})`);
  assert.equal(selfList.status, "committed");

  // The frozen record itself in the list -> still succeeds.
  const selfFrozen = await Transition.validateRecoveryRecord(record, {
    ...validationContext,
    existingRecoveryRecords: [record],
  });
  assert.equal(selfFrozen.ok, true);

  // A different committed transition for the SAME block -> refuse.
  const other = await sealedRecoveryFixture({
    transitionId: "tr_self_other",
    blockId: "block_self",
    predecessor: { programId: "prog_other", durableRevision: 1, source: "Recommend" },
  });
  const distinct = await Transition.validateRecoveryRecord(record, {
    ...validationContext,
    existingRecoveryRecords: [JSON.parse(JSON.stringify(other.record))],
  });
  assert.equal(distinct.ok, false);
  assert.equal(distinct.status, "ineligible");
  assert.equal(distinct.ineligible, true);
  assert.equal(distinct.code, "recovery_same_block_repeat");
});

test("repeat refusal: same-block prior refuses across proposeRecoveryWeek, validateRecoveryProposal, validateRecoveryRecord", async () => {
  const { record, proposal, input, validationContext } = await sealedRecoveryFixture({ transitionId: "tr_repeat", blockId: "block_repeat" });
  const priorStored = JSON.parse(JSON.stringify(record));

  const viaPropose = await Transition.proposeRecoveryWeek({
    ...validRecoveryInput({ predecessorInstance: input.predecessorInstance, transitionId: "tr_repeat_new", blockId: "block_repeat" }),
    existingRecoveryRecords: [priorStored],
  });
  assert.equal(viaPropose.ok, false);
  assert.equal(viaPropose.code, "recovery_same_block_repeat");

  const viaProposalValidation = await Transition.validateProposal(proposal, {
    ...validationContext,
    existingRecoveryRecords: [priorStored],
  });
  assert.equal(viaProposalValidation.ok, false);
  assert.equal(viaProposalValidation.status, "ineligible");
  assert.equal(viaProposalValidation.code, "recovery_same_block_repeat");
});

test("repeat refusal control: a prior committed record for a different block does not block this transition", async () => {
  const { proposal, input, validationContext } = await sealedRecoveryFixture({ transitionId: "tr_diffblock", blockId: "block_diffblock_a" });
  const other = await sealedRecoveryFixture({ transitionId: "tr_diffblock_other", blockId: "block_diffblock_b", predecessor: { programId: "prog_o", durableRevision: 1, source: "Recommend" } });
  const priorOtherBlock = JSON.parse(JSON.stringify(other.record));

  const viaPropose = await Transition.proposeRecoveryWeek({
    ...validRecoveryInput({ predecessorInstance: input.predecessorInstance, transitionId: "tr_diffblock_new", blockId: "block_diffblock_a" }),
    existingRecoveryRecords: [priorOtherBlock],
  });
  assert.equal(viaPropose.ok, true);
  assert.equal(viaPropose.status, "preview");

  const viaValidation = await Transition.validateProposal(proposal, {
    ...validationContext,
    existingRecoveryRecords: [priorOtherBlock],
  });
  assert.equal(viaValidation.ok, true);
  assert.equal(viaValidation.status, "preview");
});

test("prior scans: a nested accessor on prior.diff.recoveryWeek executes ZERO getters in all three scans", async () => {
  const { record, proposal, input, validationContext } = await sealedRecoveryFixture({ transitionId: "tr_nested", blockId: "block_nested" });

  const makeNestedAccessorPrior = (counter) => ({
    kind: "recovery_week",
    transitionId: "tr_hostile",
    diff: Object.defineProperty({ days: [], exercises: [], prescriptions: [] }, "recoveryWeek", {
      enumerable: true,
      get() { counter.hits += 1; return { blockId: "block_nested", transitionId: "tr_hostile" }; },
    }),
  });

  const a = { hits: 0 };
  const viaPropose = await Transition.proposeRecoveryWeek({
    ...validRecoveryInput({ predecessorInstance: input.predecessorInstance, transitionId: "tr_nested_new", blockId: "block_nested" }),
    existingRecoveryRecords: [makeNestedAccessorPrior(a)],
  });
  assert.equal(viaPropose.ok, false);
  assert.equal(a.hits, 0, "proposeRecoveryWeek scan must not invoke a nested getter");

  const b = { hits: 0 };
  const viaProposalValidation = await Transition.validateRecoveryProposal(JSON.parse(JSON.stringify(proposal)), {
    ...validationContext,
    existingRecoveryRecords: [makeNestedAccessorPrior(b)],
  });
  assert.equal(viaProposalValidation.ok, false);
  assert.equal(viaProposalValidation.code, "invalid_options");
  assert.equal(b.hits, 0, "validateRecoveryProposal scan must not invoke a nested getter");

  const c = { hits: 0 };
  const viaRecordValidation = await Transition.validateRecoveryRecord(record, {
    ...validationContext,
    existingRecoveryRecords: [makeNestedAccessorPrior(c)],
  });
  assert.equal(viaRecordValidation.ok, false);
  assert.equal(viaRecordValidation.code, "invalid_options");
  assert.equal(c.hits, 0, "validateRecoveryRecord scan must not invoke a nested getter");

  // Deepest read path: accessor on prior.diff.recoveryWeek.blockId / .transitionId
  const d = { hits: 0 };
  const rw = {};
  Object.defineProperty(rw, "blockId", { enumerable: true, get() { d.hits += 1; return "block_nested"; } });
  Object.defineProperty(rw, "transitionId", { enumerable: true, get() { d.hits += 1; return "tr_hostile"; } });
  const deepPrior = { kind: "recovery_week", transitionId: "tr_hostile", diff: { days: [], exercises: [], prescriptions: [], recoveryWeek: rw } };
  const viaDeep = await Transition.validateRecoveryRecord(record, {
    ...validationContext,
    existingRecoveryRecords: [deepPrior],
  });
  assert.equal(viaDeep.ok, false);
  assert.equal(d.hits, 0, "deepest nested read path must not invoke a getter");
});

test("prior scans: a top-level accessor prior and a prior without the committed recovery path are rejected with zero getters and no top-level blockId fallback", async () => {
  const { record, validationContext } = await sealedRecoveryFixture({ transitionId: "tr_toplevel", blockId: "block_toplevel" });

  let topHits = 0;
  const topLevelAccessorPrior = Object.defineProperty({ transitionId: "tr_hostile" }, "blockId", {
    enumerable: true,
    get() { topHits += 1; return "block_toplevel"; },
  });
  const viaTop = await Transition.validateRecoveryRecord(record, {
    ...validationContext,
    existingRecoveryRecords: [topLevelAccessorPrior],
  });
  assert.equal(viaTop.ok, false);
  assert.equal(viaTop.code, "invalid_options");
  assert.equal(topHits, 0);

  // A prior that only carries a top-level blockId (no nested committed recovery
  // path) must be rejected — the unsupported top-level fallback is gone.
  for (const flatPrior of [
    { transitionId: "tr_flat", blockId: "block_toplevel" },
    { kind: "recovery_week", transitionId: "tr_flat" },
    { transitionId: "tr_flat", diff: { recoveryWeek: {} } },
    null,
    "block_toplevel",
  ]) {
    const viaFlat = await Transition.validateRecoveryRecord(record, {
      ...validationContext,
      existingRecoveryRecords: [flatPrior],
    });
    assert.equal(viaFlat.ok, false, `prior ${JSON.stringify(flatPrior)} must be rejected`);
    assert.equal(viaFlat.code, "invalid_options");
  }
});

test("prior scans: an accessor-backed existingRecoveryRecords array is rejected with zero getters", async () => {
  const { record, validationContext } = await sealedRecoveryFixture({ transitionId: "tr_arr", blockId: "block_arr" });
  let hits = 0;
  const badArray = [];
  Object.defineProperty(badArray, 0, { enumerable: true, get() { hits += 1; return {}; } });

  const res = await Transition.validateRecoveryRecord(record, {
    ...validationContext,
    existingRecoveryRecords: badArray,
  });
  assert.equal(res.ok, false);
  assert.equal(res.code, "invalid_options");
  assert.equal(hits, 0);
});

test("prior scans: a prior that is not a closed committed recovery record is structurally invalid, never recovery_same_block_repeat", async () => {
  const { record, proposal, input, validationContext } = await sealedRecoveryFixture({ transitionId: "tr_prior_gate", blockId: "block_prior_gate" });

  const malformedPriors = [
    ["other-kind", (p) => { p.kind = "same_family_sibling"; }],
    ["preview-status prior", (p) => { p.status = "preview"; }],
    ["confirmed-status prior", (p) => { p.status = "confirmed"; }],
    ["non-null archiveId", (p) => { p.archiveId = "arc_prior_gate"; }],
    ["successor present", (p) => { p.successor = { programId: "p_next" }; }],
    ["empty proposalHash", (p) => { p.proposalHash = ""; }],
    ["missing proposalHash", (p) => { delete p.proposalHash; }],
    ["non-string proposalHash", (p) => { p.proposalHash = 42; }],
    ["nested transitionId mismatch", (p) => { p.diff.recoveryWeek.transitionId = "tr_other"; }],
    ["empty nested blockId", (p) => { p.diff.recoveryWeek.blockId = ""; }],
    ["non-string nested transitionId", (p) => { p.diff.recoveryWeek.transitionId = null; }],
  ];

  for (const [label, mutate] of malformedPriors) {
    const prior = JSON.parse(JSON.stringify(record));
    mutate(prior);

    const viaPropose = await Transition.proposeRecoveryWeek({
      ...validRecoveryInput({ predecessorInstance: input.predecessorInstance, transitionId: "tr_prior_gate_new", blockId: "block_prior_gate" }),
      existingRecoveryRecords: [prior],
    });
    assert.equal(viaPropose.ok, false, `[${label}] propose must reject`);
    assert.notEqual(viaPropose.code, "recovery_same_block_repeat", `[${label}] must not report a repeat for a structurally invalid prior`);
    assert.equal(viaPropose.code, "invalid_proposal", `[${label}] propose must report structural invalid`);

    const viaProposal = await Transition.validateRecoveryProposal(JSON.parse(JSON.stringify(proposal)), {
      ...validationContext,
      existingRecoveryRecords: [prior],
    });
    assert.equal(viaProposal.ok, false, `[${label}] proposal validation must reject`);
    assert.notEqual(viaProposal.code, "recovery_same_block_repeat", `[${label}] must not report a repeat for a structurally invalid prior`);
    assert.equal(viaProposal.code, "invalid_options", `[${label}] proposal validation must report structural invalid`);

    const viaRecord = await Transition.validateRecoveryRecord(record, {
      ...validationContext,
      existingRecoveryRecords: [prior],
    });
    assert.equal(viaRecord.ok, false, `[${label}] record validation must reject`);
    assert.notEqual(viaRecord.code, "recovery_same_block_repeat", `[${label}] must not report a repeat for a structurally invalid prior`);
    assert.equal(viaRecord.code, "invalid_options", `[${label}] record validation must report structural invalid`);
  }
});

test("prior scans: accessors on the committed-record gate fields execute ZERO getters before structural rejection", async () => {
  const { record, validationContext } = await sealedRecoveryFixture({ transitionId: "tr_gate_accessor", blockId: "block_gate_accessor" });

  for (const field of ["kind", "status", "archiveId", "proposalHash"]) {
    let hits = 0;
    const prior = { transitionId: "tr_hostile", diff: { days: [], exercises: [], prescriptions: [], recoveryWeek: { blockId: "block_gate_accessor", transitionId: "tr_hostile" } } };
    Object.defineProperty(prior, field, { enumerable: true, get() { hits += 1; return field === "kind" ? "recovery_week" : field === "status" ? "committed" : field === "archiveId" ? null : "h"; } });

    const viaRecord = await Transition.validateRecoveryRecord(record, {
      ...validationContext,
      existingRecoveryRecords: [prior],
    });
    assert.equal(viaRecord.ok, false);
    assert.equal(viaRecord.code, "invalid_options");
    assert.equal(hits, 0, `gate field ${field} must never be read through a getter`);
  }

  {
    let hits = 0;
    const prior = { kind: "recovery_week", status: "committed", transitionId: "tr_hostile", proposalHash: "h", diff: {} };
    Object.defineProperty(prior.diff, "recoveryWeek", { enumerable: true, get() { hits += 1; return { blockId: "block_gate_accessor", transitionId: "tr_hostile" }; } });
    const viaRecord = await Transition.validateRecoveryRecord(record, {
      ...validationContext,
      existingRecoveryRecords: [prior],
    });
    assert.equal(viaRecord.ok, false);
    assert.equal(viaRecord.code, "invalid_options");
    assert.equal(hits, 0, "nested overlay accessor must never execute");
  }
});

test("committed-record validation: self exemption requires the exact transitionId+proposalHash pair; same id with a different hash is a structural collision", async () => {
  const { record, storedRecord, validationContext } = await sealedRecoveryFixture({ transitionId: "tr_pair", blockId: "block_pair" });
  assert.equal(storedRecord.transitionId, record.transitionId);

  // Same transitionId, different proposalHash value (the prior is otherwise a
  // closed committed recovery record; blockId and transitionId unchanged so it
  // is the same-block, same-id prior).
  const rehashedPrior = JSON.parse(JSON.stringify(record));
  rehashedPrior.proposalHash = "f".repeat(64);
  assert.notEqual(rehashedPrior.proposalHash, storedRecord.proposalHash);
  assert.equal(rehashedPrior.transitionId, record.transitionId);
  assert.equal(rehashedPrior.diff.recoveryWeek.blockId, record.diff.recoveryWeek.blockId);

  const collision = await Transition.validateRecoveryRecord(record, {
    ...validationContext,
    existingRecoveryRecords: [rehashedPrior],
  });
  assert.equal(collision.ok, false, "same id with a different hash must not idempotently succeed");
  assert.notEqual(collision.code, "recovery_same_block_repeat", "a hash collision is not a same-block repeat");
  assert.equal(collision.code, "invalid_options", "the collision must fail as structural invalid");

  // The exact pair (same id AND same hash) still self-exempts.
  const exact = await Transition.validateRecoveryRecord(record, {
    ...validationContext,
    existingRecoveryRecords: [JSON.parse(JSON.stringify(storedRecord))],
  });
  assert.equal(exact.ok, true, "the exact identity pair must self-exempt");
  assert.equal(exact.status, "committed");

  // Creation/preview validation never self-exempts: a new proposal carrying
  // the prior's own transitionId is still refused as a same-block repeat.
  const { input: freshInput } = await sealedRecoveryFixture({ transitionId: "tr_pair_seed", blockId: "block_pair_seed", predecessor: { programId: "prog_pair_b", durableRevision: 1, source: "Recommend" } });
  const viaPropose = await Transition.proposeRecoveryWeek({
    ...validRecoveryInput({ predecessorInstance: freshInput.predecessorInstance, transitionId: rehashedPrior.transitionId, blockId: rehashedPrior.diff.recoveryWeek.blockId }),
    existingRecoveryRecords: [rehashedPrior],
  });
  assert.equal(viaPropose.ok, false);
  assert.equal(viaPropose.code, "recovery_same_block_repeat");
});

test("committed-record validation: self-exempt control — the exact pair exempts even for a different-block prior collision-free list", async () => {
  const { record, storedRecord, validationContext } = await sealedRecoveryFixture({ transitionId: "tr_pair2", blockId: "block_pair2" });
  // Own copy plus an unrelated valid committed record for another block: both survive.
  const other = await sealedRecoveryFixture({ transitionId: "tr_pair2_other", blockId: "block_pair2_other", predecessor: { programId: "prog_pair2", durableRevision: 1, source: "Recommend" } });
  const val = await Transition.validateRecoveryRecord(record, {
    ...validationContext,
    existingRecoveryRecords: [JSON.parse(JSON.stringify(storedRecord)), JSON.parse(JSON.stringify(other.record))],
  });
  assert.equal(val.ok, true, `exact self pair plus an unrelated committed record must validate (got ${val.code})`);
});

test("committed-record validation: rejects tampered envelopes before the hash gate", async () => {
  const { record, validationContext } = await sealedRecoveryFixture({ transitionId: "tr_tamper", blockId: "block_tamper" });

  const tamper = (mutate) => { const t = JSON.parse(JSON.stringify(record)); mutate(t); return t; };

  {
    const res = await Transition.validateRecoveryRecord(tamper((t) => { t.archiveId = "arc_injected"; }), validationContext);
    assert.equal(res.ok, false);
    assert.equal(res.code, "invalid_archive_id");
  }
  {
    const res = await Transition.validateRecoveryRecord(tamper((t) => { t.successor = { programId: "p_next" }; }), validationContext);
    assert.equal(res.ok, false);
    assert.equal(res.code, "forbidden_successor");
  }
  {
    const res = await Transition.validateRecoveryRecord(tamper((t) => { t.diff.recoveryWeek.confirmedAt = "2026-10-01T10:05:00.000Z"; }), validationContext);
    assert.equal(res.ok, false);
    assert.equal(res.code, "lifecycle_timestamp_mismatch");
  }
  {
    const res = await Transition.validateRecoveryRecord(tamper((t) => { t.diff.recoveryWeek.reassessmentDueAt = "2026-10-01T09:00:00.000Z"; }), validationContext);
    assert.equal(res.ok, false);
    assert.equal(res.code, "lifecycle_timestamp_order");
  }
  {
    const res = await Transition.validateRecoveryRecord(tamper((t) => { t.diff.recoveryWeek.reassessmentOutcome = "CompletelyHealed"; }), validationContext);
    assert.equal(res.ok, false);
    assert.equal(res.code, "recovery_reassessment_invalid");
  }
  {
    const res = await Transition.validateRecoveryRecord(tamper((t) => { t.diff.recoveryWeek.policyVersion = 999; }), validationContext);
    assert.equal(res.ok, false);
    assert.equal(res.code, "unsupported_policy_version");
  }
  {
    const res = await Transition.validateRecoveryRecord(tamper((t) => { t.diff.recoveryWeek.entries[0].effectiveWorkingSets += 1; }), validationContext);
    assert.equal(res.ok, false);
    assert.equal(res.code, "recovery_effective_sets_mismatch");
  }
  {
    const staleContext = { ...validationContext, predecessor: { ...validationContext.predecessor, durableRevision: 99 } };
    const res = await Transition.validateRecoveryRecord(record, staleContext);
    assert.equal(res.ok, false);
    assert.equal(res.status, "stale");
    assert.equal(res.code, "predecessor_changed");
  }
});

test("committed-record validation: an accessor carrier record is rejected as invalid_record with zero getters", async () => {
  const { record, validationContext } = await sealedRecoveryFixture({ transitionId: "tr_carrier", blockId: "block_carrier" });

  let getterReads = 0;
  const carrier = Object.create(null);
  for (const [key, value] of Object.entries(record)) {
    if (key === "diff") {
      Object.defineProperty(carrier, key, { enumerable: true, get() { getterReads += 1; return record.diff; } });
    } else {
      carrier[key] = value;
    }
  }
  const val = await Transition.validateRecoveryRecord(carrier, validationContext);
  assert.equal(val.ok, false);
  assert.equal(val.code, "invalid_record");
  assert.equal(getterReads, 0);
});

// ---------------------------------------------------------------------------
// Once-only reassessment (P52-02 / A52-2)
// ---------------------------------------------------------------------------

test("reassessment: one signature (record, outcome, {blockId, elapsedWeek}) — success changes only outcome and keeps week two canonical", async () => {
  const { record, instance, projectionContext } = await sealedRecoveryFixture({ transitionId: "tr_reassess_ok", blockId: "block_reassess_ok" });
  const blockId = record.diff.recoveryWeek.blockId;

  for (const outcome of ["Better", "About the same", "Worse"]) {
    const res = Transition.reassessRecoveryRecord(record, outcome, { blockId, elapsedWeek: 2 });
    assert.equal(res.ok, true);
    assert.equal(res.status, "committed");
    assert.equal(res.record.diff.recoveryWeek.reassessmentOutcome, outcome);
    assert.equal(res.record.proposalHash, record.proposalHash);
    assertDeeplyFrozen(res.record, "res.record");

    const expected = JSON.parse(JSON.stringify(record));
    expected.diff.recoveryWeek.reassessmentOutcome = outcome;
    assert.deepEqual(res.record, expected);

    // Week two still restores canonical exactly for the reassessed record.
    const wk2 = Transition.projectRecoveryProgram(instance.program, res.record, { ...projectionContext, elapsedWeek: 2 });
    assert.equal(wk2.ok, true);
    assert.equal(wk2.active, false);
    assert.deepEqual(wk2.rows, instance.program);
  }
});

test("reassessment: the block/week context is mandatory and exact", async () => {
  const { record } = await sealedRecoveryFixture({ transitionId: "tr_reassess_ctx", blockId: "block_reassess_ctx" });
  const blockId = record.diff.recoveryWeek.blockId;

  // no context at all
  const noCtx = Transition.reassessRecoveryRecord(record, "Better");
  assert.equal(noCtx.ok, false);
  assert.equal(noCtx.code, "recovery_reassessment_invalid");

  // correct block, missing elapsedWeek
  const noWeek = Transition.reassessRecoveryRecord(record, "Better", { blockId });
  assert.equal(noWeek.ok, false);
  assert.equal(noWeek.code, "recovery_reassessment_not_due");

  // elapsedWeek present, missing block
  const noBlock = Transition.reassessRecoveryRecord(record, "Worse", { elapsedWeek: 2 });
  assert.equal(noBlock.ok, false);
  assert.equal(noBlock.code, "recovery_reassessment_invalid");

  // empty context
  const emptyCtx = Transition.reassessRecoveryRecord(record, "Worse", {});
  assert.equal(emptyCtx.ok, false);
  assert.equal(emptyCtx.code, "recovery_reassessment_invalid");

  // extra context key
  const extraKey = Transition.reassessRecoveryRecord(record, "Better", { blockId, elapsedWeek: 2, extra: 1 });
  assert.equal(extraKey.ok, false);
  assert.equal(extraKey.code, "recovery_reassessment_invalid");

  // wrong block
  const wrongBlock = Transition.reassessRecoveryRecord(record, "Better", { blockId: "other_block", elapsedWeek: 2 });
  assert.equal(wrongBlock.ok, false);
  assert.equal(wrongBlock.code, "recovery_reassessment_invalid");

  // week one / non-integer week
  const week1 = Transition.reassessRecoveryRecord(record, "Better", { blockId, elapsedWeek: 1 });
  assert.equal(week1.ok, false);
  assert.equal(week1.code, "recovery_reassessment_not_due");
  const weekFloat = Transition.reassessRecoveryRecord(record, "Better", { blockId, elapsedWeek: 2.5 });
  assert.equal(weekFloat.ok, false);
  assert.equal(weekFloat.code, "recovery_reassessment_not_due");

  // old polymorphic form: an options object as the second argument is not an outcome string
  const polymorphic = Transition.reassessRecoveryRecord(record, { outcome: "Better", blockId, elapsedWeek: 2 });
  assert.equal(polymorphic.ok, false);
  assert.equal(polymorphic.code, "recovery_reassessment_invalid");
});

test("reassessment: invalid outcome, second write, and non-capability records are refused with pinned codes", async () => {
  const { record } = await sealedRecoveryFixture({ transitionId: "tr_reassess_neg", blockId: "block_reassess_neg" });
  const blockId = record.diff.recoveryWeek.blockId;

  assert.equal(Transition.reassessRecoveryRecord(record, "CompletelyHealed", { blockId, elapsedWeek: 2 }).code, "recovery_reassessment_invalid");
  assert.equal(Transition.reassessRecoveryRecord(record, null, { blockId, elapsedWeek: 2 }).code, "recovery_reassessment_invalid");

  const first = Transition.reassessRecoveryRecord(record, "Better", { blockId, elapsedWeek: 2 });
  assert.equal(first.ok, true);
  const second = Transition.reassessRecoveryRecord(first.record, "Worse", { blockId, elapsedWeek: 2 });
  assert.equal(second.ok, false);
  assert.equal(second.code, "recovery_reassessment_closed");

  // raw clone (not a capability)
  const rawClone = JSON.parse(JSON.stringify(record));
  assert.equal(Transition.reassessRecoveryRecord(rawClone, "Better", { blockId, elapsedWeek: 2 }).code, "recovery_reassessment_invalid");

  // accessor carrier — zero getters
  let getterReads = 0;
  const carrier = Object.create(null);
  for (const [key, value] of Object.entries(record)) {
    if (key === "diff") {
      Object.defineProperty(carrier, key, { enumerable: true, get() { getterReads += 1; return record.diff; } });
    } else {
      carrier[key] = value;
    }
  }
  const resCarrier = Transition.reassessRecoveryRecord(carrier, "Better", { blockId, elapsedWeek: 2 });
  assert.equal(resCarrier.ok, false);
  assert.equal(resCarrier.code, "recovery_reassessment_invalid");
  assert.equal(getterReads, 0);
});

// ---------------------------------------------------------------------------
// Projection (P52-03 / A52-3 / A52-4)
// ---------------------------------------------------------------------------

// Independent calendar helper matching mesocycleLifecycle week derivation.
function deriveElapsedWeekFromDates(startedDateStr, currentDateStr) {
  const start = new Date(`${startedDateStr}T12:00:00`);
  const now = new Date(`${currentDateStr}T12:00:00`);
  const days = Math.floor((now - start) / 86400000);
  return days < 0 ? 1 : Math.floor(days / 7) + 1;
}

test("projection: independent calendar derives day 6 -> week 1 and day 7 -> week 2", () => {
  assert.equal(deriveElapsedWeekFromDates("2026-10-01", "2026-10-07"), 1);
  assert.equal(deriveElapsedWeekFromDates("2026-10-01", "2026-10-08"), 2);
});

test("projection: day 6 (elapsedWeek 1) applies every Rule B entry; zero-set slots removed; positive entries change only sets", async () => {
  const { record, instance, baseProgramFingerprint } = await sealedRecoveryFixture({ familyFreq: ["growth", 2], transitionId: "tr_proj_day6", blockId: "block_proj_day6" });
  const rows = instance.program;
  const blockId = record.diff.recoveryWeek.blockId;
  const elapsedWeek = deriveElapsedWeekFromDates("2026-10-01", "2026-10-07");

  const res = Transition.projectRecoveryProgram(rows, record, { blockId, elapsedWeek, baseProgramFingerprint });
  assert.equal(res.ok, true);
  assert.equal(res.status, "active");
  assert.equal(res.active, true);

  const entries = record.diff.recoveryWeek.entries;
  const effBySlot = new Map(entries.map((e) => [e.slot, e.effectiveWorkingSets]));
  const zeroSlots = new Set(entries.filter((e) => e.effectiveWorkingSets === 0).map((e) => e.slot));
  const rowBySlot = new Map(rows.map((r) => [r.slotId, r]));

  for (const row of res.rows) {
    assert.equal(zeroSlots.has(row.slotId), false, `zero-set slot ${row.slotId} must be removed`);
    assert.equal(row.sets, effBySlot.get(row.slotId), `slot ${row.slotId} sets must equal the Rule B effective sets`);
    // Only `sets` changes: every other field is byte-identical to canonical.
    const canonicalRow = { ...rowBySlot.get(row.slotId) };
    canonicalRow.sets = effBySlot.get(row.slotId);
    assert.deepEqual(row, canonicalRow);
  }
  assert.equal(res.rows.length, rows.length - zeroSlots.size);
  assert.ok(zeroSlots.size > 0, "growth_2 fixture must exercise at least one removed optional slot");

  // Inputs unmutated.
  assert.equal(rows.length, instance.program.length);
});

test("projection: day 7 / week 2 restores canonical rows exactly with no migration", async () => {
  const { record, instance, baseProgramFingerprint } = await sealedRecoveryFixture({ familyFreq: ["growth", 2], transitionId: "tr_proj_day7", blockId: "block_proj_day7" });
  const rows = instance.program;
  const blockId = record.diff.recoveryWeek.blockId;
  const elapsedWeek = deriveElapsedWeekFromDates("2026-10-01", "2026-10-08");

  const res = Transition.projectRecoveryProgram(rows, record, { blockId, elapsedWeek, baseProgramFingerprint });
  assert.equal(res.ok, true);
  assert.equal(res.status, "inactive");
  assert.equal(res.active, false);
  assert.deepEqual(res.rows, rows);
});

test("projection: result shape is a plain, deeply frozen {ok,status,active,code,rows} with an enumerable acyclic rows array", async () => {
  const { record, instance, projectionContext } = await sealedRecoveryFixture({ familyFreq: ["growth", 2], transitionId: "tr_proj_shape", blockId: "block_proj_shape" });
  const res = Transition.projectRecoveryProgram(instance.program, record, projectionContext);

  assert.deepEqual(Object.keys(res).sort(), ["active", "code", "ok", "rows", "status"]);
  assertDeeplyFrozen(res, "res");
  assert.ok(Array.isArray(res.rows));
  assert.equal(Object.getPrototypeOf(res.rows), Array.prototype);
  assert.equal(res.rows.rows, undefined, "no self-reference");
  assert.notEqual(res.rows, res, "rows is not the result object");
  assert.equal(Object.getOwnPropertySymbols(res.rows).length, 0);
  // Only intrinsic length + index keys — no metadata smuggled onto the array.
  for (const key of Object.getOwnPropertyNames(res.rows)) {
    assert.ok(key === "length" || /^(0|[1-9][0-9]*)$/.test(key), `unexpected rows key: ${key}`);
  }
  assert.ok(Object.isFrozen(res.rows));
  for (const row of res.rows) assert.ok(Object.isFrozen(row));
  assertAcyclicJson(res, "res");
  assertAcyclicJson(res.rows, "res.rows");
});

test("projection: context is exact and mandatory", async () => {
  const { record, instance, blockId, baseProgramFingerprint } = await sealedRecoveryFixture({ transitionId: "tr_proj_ctx", blockId: "block_proj_ctx" });
  const rows = instance.program;
  const bad = [
    undefined,
    null,
    {},
    { blockId, elapsedWeek: 1 },
    { blockId, elapsedWeek: 1, baseProgramFingerprint, extra: 1 },
    { blockId: 5, elapsedWeek: 1, baseProgramFingerprint },
    { blockId, elapsedWeek: 0, baseProgramFingerprint },
    { blockId, elapsedWeek: 1.5, baseProgramFingerprint },
    { blockId, elapsedWeek: 1, baseProgramFingerprint: 7 },
  ];
  for (const ctx of bad) {
    const res = Transition.projectRecoveryProgram(rows, record, ctx);
    assert.equal(res.ok, false, `context ${JSON.stringify(ctx)} must be rejected`);
    assert.equal(res.code, "invalid_context");
    assert.deepEqual(res.rows, rows);
  }
});

test("projection: raw / tampered / unvalidated records fail closed to canonical rows", async () => {
  const { record, instance, projectionContext } = await sealedRecoveryFixture({ familyFreq: ["growth", 2], transitionId: "tr_proj_fail", blockId: "block_proj_fail" });
  const rows = instance.program;

  const tamperCases = [
    ["raw clone (pristine)", (t) => t],
    ["effective sets forced to 0", (t) => { t.diff.recoveryWeek.entries[0].effectiveWorkingSets = 0; return t; }],
    ["effective sets inflated beyond base", (t) => { const e = t.diff.recoveryWeek.entries.find((x) => x.effectiveWorkingSets > 0); e.effectiveWorkingSets = e.baseWorkingSets * 10 + 7; return t; }],
    ["movement + reason tampered", (t) => { t.diff.recoveryWeek.entries[0].movement = "library:FORGED"; t.diff.recoveryWeek.entries[0].reason = "forged"; return t; }],
    ["duplicate slot appended", (t) => { const d = JSON.parse(JSON.stringify(t.diff.recoveryWeek.entries[0])); d.effectiveWorkingSets = 99; t.diff.recoveryWeek.entries.push(d); return t; }],
    ["proposalHash forged", (t) => { t.proposalHash = "deadbeef_forged"; return t; }],
    ["lifecycle timestamps tampered", (t) => { t.confirmedAt = "2030-01-01T00:00:00.000Z"; t.diff.recoveryWeek.reassessmentDueAt = "2031-01-01T00:00:00.000Z"; return t; }],
    ["entries emptied", (t) => { t.diff.recoveryWeek.entries = []; return t; }],
    ["entry slot removed", (t) => { delete t.diff.recoveryWeek.entries[0].slot; return t; }],
    ["unknown slot injected", (t) => { t.diff.recoveryWeek.entries.push({ slot: "slot_not_in_program", movement: "library:x", movementPattern: null, baseWorkingSets: 3, effectiveWorkingSets: 9, removedOptionalFirst: false, reason: "forged" }); return t; }],
    ["status flipped to preview", (t) => { t.status = "preview"; return t; }],
  ];

  for (const [label, mutate] of tamperCases) {
    const tampered = mutate(JSON.parse(JSON.stringify(record)));
    const res = Transition.projectRecoveryProgram(rows, tampered, projectionContext);
    assert.equal(res.ok, false, `${label} must not apply`);
    assert.equal(res.status, "invalid", `${label} must be invalid`);
    assert.equal(res.active, false);
    assert.deepEqual(res.rows, rows, `${label} must return canonical rows`);
  }

  // Nested accessor inside the record — zero getters.
  let getterRan = 0;
  const accessorRecord = JSON.parse(JSON.stringify(record));
  Object.defineProperty(accessorRecord.diff.recoveryWeek.entries[0], "effectiveWorkingSets", {
    enumerable: true,
    get() { getterRan += 1; return 0; },
  });
  const resAccessor = Transition.projectRecoveryProgram(rows, accessorRecord, projectionContext);
  assert.equal(resAccessor.ok, false);
  assert.equal(getterRan, 0);
  assert.deepEqual(resAccessor.rows, rows);
});

test("projection: absent / wrong-block / reassessed / week>=2 return an ok:true inactive deep-frozen canonical clone; wrong fingerprint is invalid", async () => {
  const { record, instance, blockId, baseProgramFingerprint } = await sealedRecoveryFixture({ familyFreq: ["growth", 2], transitionId: "tr_proj_states", blockId: "block_proj_states" });
  const rows = instance.program;

  for (const [label, arg, ctx] of [
    ["absent (null)", null, { blockId, elapsedWeek: 1, baseProgramFingerprint }],
    ["absent (undefined)", undefined, { blockId, elapsedWeek: 1, baseProgramFingerprint }],
    ["wrong block", record, { blockId: "other_block", elapsedWeek: 1, baseProgramFingerprint }],
    ["week 2", record, { blockId, elapsedWeek: 2, baseProgramFingerprint }],
    ["week 5", record, { blockId, elapsedWeek: 5, baseProgramFingerprint }],
  ]) {
    const res = Transition.projectRecoveryProgram(rows, arg, ctx);
    assert.equal(res.ok, true, `${label} must be ok:true`);
    assert.equal(res.status, "inactive");
    assert.equal(res.active, false);
    assert.deepEqual(res.rows, rows);
    assert.ok(Object.isFrozen(res.rows));
  }

  // Reassessed capability at week 1 -> inactive canonical.
  const reassessed = Transition.reassessRecoveryRecord(record, "Better", { blockId, elapsedWeek: 2 });
  assert.equal(reassessed.ok, true);
  const resReassessed = Transition.projectRecoveryProgram(rows, reassessed.record, { blockId, elapsedWeek: 1, baseProgramFingerprint });
  assert.equal(resReassessed.ok, true);
  assert.equal(resReassessed.active, false);
  assert.deepEqual(resReassessed.rows, rows);

  // Wrong baseProgramFingerprint -> invalid, canonical rows.
  const resWrongFp = Transition.projectRecoveryProgram(rows, record, { blockId, elapsedWeek: 1, baseProgramFingerprint: "wrong_fingerprint" });
  assert.equal(resWrongFp.ok, false);
  assert.equal(resWrongFp.code, "base_fingerprint_mismatch");
  assert.deepEqual(resWrongFp.rows, rows);
});

// ---------------------------------------------------------------------------
// Preserved invariants: Policy v2, P5b allocation, re-entry separation
// ---------------------------------------------------------------------------

test("re-entry separation and Policy v2: no weekPrescriptions; primary patterns and allowlist untouched", async () => {
  const { proposal, record } = await sealedRecoveryFixture({ transitionId: "tr_reentry", blockId: "block_reentry" });
  assert.equal(proposal.weekPrescriptions, undefined);
  assert.equal(proposal.diff.recoveryWeek.weekPrescriptions, undefined);
  assert.equal(record.weekPrescriptions, undefined);
  assert.equal(record.diff.recoveryWeek.weekPrescriptions, undefined);

  assert.deepEqual(APPROVED_POLICY_V2.primaryPatterns, ["knee-dominant", "horizontal press", "hip/hinge"]);
  assert.deepEqual(APPROVED_POLICY_V2.allowlistedMisses, {
    growth_2_v1: { base: 32, effective: 12 },
    growth_3_v1: { base: 49, effective: 17 },
  });
  assert.equal(Transition.RECOVERY_POLICY_VERSION, 2);
});

test("P5b allocation unchanged: sealed growth_2 overlay entries equal the independent Rule B oracle", async () => {
  const { record, instance } = await sealedRecoveryFixture({ familyFreq: ["growth", 2], transitionId: "tr_alloc", blockId: "block_alloc" });
  const expected = independentRuleB(instance);
  assert.deepEqual(record.diff.recoveryWeek.entries, expected.entries);
});

test("control: a freshly rehashed semantic-invalid preview is still rejected by validateProposal", async () => {
  const { rawProposal, validationContext } = await sealedRecoveryFixture({ transitionId: "tr_rehash", blockId: "block_rehash" });
  const tampered = JSON.parse(JSON.stringify(rawProposal));
  tampered.diff.recoveryWeek.entries[0].effectiveWorkingSets += 1;
  tampered.proposalHash = await Transition.hashProposal(tampered);
  const val = await Transition.validateProposal(tampered, validationContext);
  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "recovery_effective_sets_mismatch");
});
