#!/usr/bin/env node
import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Transition = require("../program-transition.js");

const { evaluateRecoveryEligibility } = Transition;

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
