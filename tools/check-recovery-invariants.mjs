// Verifies the approved recovery policy (version 2) against the 20 Plan 047
// review compilations in test/fixtures/program-families-v1.json.
//
// The executable inputs come from the JSON contract in
// docs/recovery-week-policy.md. The accepted fixture table is an independent
// expected-output oracle. Deliberate mutation controls prove that changing
// each critical rule dimension is rejected with a semantic message.
//
// Usage:
//   node tools/check-recovery-invariants.mjs [--check]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRuleB,
  clonePolicy,
  eligible,
  parseExecutablePolicy,
  POLICY_LEAF_COVERAGE,
  validateOverlayDocumentation,
  validatePolicyAgreement,
} from "./recovery-policy-contract.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = join(ROOT, "test", "fixtures", "program-families-v1.json");
const POLICY_PATH = join(ROOT, "docs", "recovery-week-policy.md");
const PROVENANCE_PATH = join(ROOT, "docs", "block-transition-provenance.md");
const PLAN_PATH = join(ROOT, "plans", "052-block-transition-provenance-foundation.md");
const POLICY_TEXT = readFileSync(POLICY_PATH, "utf8");
const fixture = JSON.parse(readFileSync(FIXTURE, "utf8"));
const policy = parseExecutablePolicy(POLICY_TEXT);
const provenanceText = readFileSync(PROVENANCE_PATH, "utf8");
const planText = readFileSync(PLAN_PATH, "utf8");
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

failures.push(...validatePolicyAgreement({ policyText: POLICY_TEXT, fixture, policy }));
failures.push(...validateOverlayDocumentation({ provenanceText, planText, policy }));

// Eligibility is a closed local contract. This is intentionally exercised
// separately from the Rule B fixture loop because it is a proposal gate, not a
// volume-allocation rule.
const qualifyingPatterns = Object.fromEntries(
  policy.primaryPatterns.map((pattern, index) => [pattern, index < policy.eligibility.minimumPatterns ? "maintained" : "improved"]),
);
check(
  eligible({ patternOutcomes: qualifyingPatterns, checkpointAnswer: policy.eligibility.qualifyingCheckpointAnswer }, policy),
  "eligibility: configured qualifying outcomes plus the configured checkpoint answer must qualify",
);
for (const answer of policy.eligibility.checkpointAnswers.filter((answer) => answer !== policy.eligibility.qualifyingCheckpointAnswer)) {
  check(
    !eligible({ patternOutcomes: qualifyingPatterns, checkpointAnswer: answer }, policy),
    `eligibility: ${answer} must not qualify`,
  );
}
const insufficient = Object.fromEntries(policy.primaryPatterns.map((pattern) => [pattern, "untested"]));
check(
  !eligible({ patternOutcomes: insufficient, checkpointAnswer: policy.eligibility.qualifyingCheckpointAnswer }, policy),
  "eligibility: fewer than the configured qualifying patterns must not qualify",
);

// Determinism and synthetic rescue proof. The real fixtures do not trigger a
// rescue, so the isolated case keeps that branch from becoming untested.
const templates = fixture.slotContracts;
for (const compilation of fixture.reviewCompilations) {
  const slots = compilation.days.flatMap((day) =>
    day.slots.map((slot) => ({ templateId: slot.templateId, status: slot.status, sets: slot.sets })),
  );
  const executablePolicy = { ...policy, slotContracts: templates };
  let first;
  let second;
  try {
    first = applyRuleB(slots, executablePolicy);
    second = applyRuleB(slots, executablePolicy);
  } catch (error) {
    failures.push(`${compilation.blueprintId}: deterministic Rule B execution failed (${error.message})`);
    continue;
  }
  check(JSON.stringify(first) === JSON.stringify(second), `${compilation.blueprintId}: Rule B is not deterministic`);
}

const synthetic = [
  { templateId: "optional_arms", status: "optional", sets: 2 },
  { templateId: "vertical_pull", status: "reducible", sets: 2 },
];
const syntheticPolicy = { ...policy, slotContracts: templates };
const optionalResult = applyRuleB(synthetic, syntheticPolicy);
check(optionalResult.effective[0] === 0, `synthetic: optional slot must be removed, got ${optionalResult.effective[0]}`);
const pressOnly = [
  { templateId: "optional_arms", status: "optional", sets: 2 },
  { templateId: "incline_press", status: "optional", sets: 2 },
  { templateId: "horizontal_press", status: "reducible", sets: 1 },
];
const rescued = applyRuleB(pressOnly, syntheticPolicy);
check(
  rescued.effective[1] === policy.ruleB.coverageRescue.minimumWorkingSets &&
    rescued.rescued.includes("horizontal press:incline_press"),
  `synthetic: pattern rescue must retain the first press slot at ${policy.ruleB.coverageRescue.minimumWorkingSets} (flagged exception), got ${JSON.stringify(rescued)}`,
);

// Each mutation is applied only to an isolated copy of the parsed policy.
// validatePolicyAgreement still consumes the unchanged fixture table and prose,
// so a mutated executable rule cannot make the gate green by changing its own
// expected values.
const negativeControls = [
  ["protected rounding", (candidate) => { candidate.ruleB.protected.rounding = "floor"; }, "protected rounding"],
  ["reducible rounding", (candidate) => { candidate.ruleB.reducible.rounding = "ceil"; }, "reducible rounding"],
  ["primary pattern order", (candidate) => { candidate.primaryPatterns.reverse(); }, "pattern order"],
  ["primary pattern set", (candidate) => { candidate.primaryPatterns[2] = "vertical pull"; }, "primary pattern set/order"],
  ["primary pattern mapping", (candidate) => { candidate.patternMapping.squat = "hip/hinge"; }, "pattern mapping"],
  ["version allowlist", (candidate) => { delete candidate.allowlistedMisses.growth_2_v1; }, "allowlist"],
  ["checkpoint answers", (candidate) => { candidate.eligibility.checkpointAnswers = ["Yes", "No"]; }, "checkpoint answers"],
  ["minimumPatterns", (candidate) => { candidate.eligibility.minimumPatterns = 1; }, "minimumPatterns"],
  ["reassessment outcomes", (candidate) => { candidate.reassessment.outcomes = ["Better", "About the same"]; }, "reassessment outcomes"],
];
const negativeControlMessages = [];
for (const [label, mutate, expectedNeedle] of negativeControls) {
  const mutated = clonePolicy(policy);
  mutate(mutated);
  const issues = [
    ...validatePolicyAgreement({ policyText: POLICY_TEXT, fixture, policy: mutated }),
    ...validateOverlayDocumentation({ provenanceText, planText, policy: mutated }),
  ];
  const semantic = issues.find((message) => message.toLowerCase().includes(expectedNeedle.toLowerCase()));
  check(!!semantic, `negative control ${label}: mutation was not rejected with a semantic ${expectedNeedle} message`);
  if (semantic) negativeControlMessages.push(`${label}: ${semantic}`);
}

function firstEvidenceRow(text, id) {
  const marker = `| ${id} |`;
  const row = text.split("\n").find((line) => line.startsWith(marker));
  if (!row) throw new Error(`negative-control fixture row missing: ${id}`);
  return row;
}

function removeEvidenceRow(text, id) {
  const row = firstEvidenceRow(text, id);
  return text.replace(`${row}\n`, "");
}

function insertEvidenceRow(text, id, replacement) {
  const row = firstEvidenceRow(text, id);
  return text.replace(`${row}\n`, `${row}\n${replacement}\n`);
}

const firstFixtureId = fixture.reviewCompilations[0].blueprintId;
const secondFixtureId = fixture.reviewCompilations[1].blueprintId;
const renamedFixtureId = firstFixtureId.replace(/_v\d+$/, "_v9");
const extraFixtureId = "growth_99_v1";
const evidenceNegativeControls = [
  ["missing evidence ID", (text) => removeEvidenceRow(text, firstFixtureId), "fixture evidence ID set"],
  [
    "extra evidence ID",
    (text) => insertEvidenceRow(text, secondFixtureId, firstEvidenceRow(text, secondFixtureId).replace(secondFixtureId, extraFixtureId)),
    "fixture evidence ID set",
  ],
  [
    "renamed evidence ID",
    (text) => text.replace(firstEvidenceRow(text, firstFixtureId), firstEvidenceRow(text, firstFixtureId).replace(firstFixtureId, renamedFixtureId)),
    "fixture evidence ID set",
  ],
  [
    "duplicate evidence ID",
    (text) => insertEvidenceRow(text, firstFixtureId, firstEvidenceRow(text, firstFixtureId)),
    "duplicate policy evidence IDs",
  ],
];
for (const [label, mutate, expectedNeedle] of evidenceNegativeControls) {
  const issues = validatePolicyAgreement({ policyText: mutate(POLICY_TEXT), fixture, policy });
  const semantic = issues.find((message) => message.toLowerCase().includes(expectedNeedle.toLowerCase()));
  check(!!semantic, `negative control ${label}: mutation was not rejected with a semantic ${expectedNeedle} message`);
  if (semantic) negativeControlMessages.push(`${label}: ${semantic}`);
}

const duplicateFixture = clonePolicy(fixture);
duplicateFixture.reviewCompilations[1].blueprintId = duplicateFixture.reviewCompilations[0].blueprintId;
const missingFixture = clonePolicy(fixture);
missingFixture.reviewCompilations.pop();
const newFixture = clonePolicy(fixture);
newFixture.reviewCompilations[0].blueprintId = extraFixtureId;
const renamedFixture = clonePolicy(fixture);
renamedFixture.reviewCompilations[0].blueprintId = renamedFixtureId;
const fixtureIdNegativeControls = [
  ["duplicate fixture ID", duplicateFixture, "duplicate fixture IDs"],
  ["missing fixture ID", missingFixture, "fixture evidence ID set"],
  ["new fixture ID", newFixture, "fixture evidence ID set"],
  ["renamed fixture ID", renamedFixture, "fixture evidence ID set"],
];
for (const [label, mutatedFixture, expectedNeedle] of fixtureIdNegativeControls) {
  const issues = validatePolicyAgreement({ policyText: POLICY_TEXT, fixture: mutatedFixture, policy });
  const semantic = issues.find((message) => message.toLowerCase().includes(expectedNeedle.toLowerCase()));
  check(!!semantic, `negative control ${label}: mutation was not rejected with a semantic ${expectedNeedle} message`);
  if (semantic) negativeControlMessages.push(`${label}: ${semantic}`);
}

function policyValueAtPath(candidate, path) {
  return path.split(".").reduce((value, segment) => value?.[segment], candidate);
}

function mutatePolicyPath(candidate, path, mutate) {
  const segments = path.split(".");
  const leaf = segments.pop();
  const parent = segments.reduce((value, segment) => value[segment], candidate);
  parent[leaf] = mutate(parent[leaf]);
}

function scalarMutation(value) {
  if (value === null) return "__set__";
  if (typeof value === "boolean") return !value;
  if (typeof value === "number") return Number.isInteger(value) ? value + 1 : value + 0.1;
  if (typeof value === "string") return `${value}-mutated`;
  throw new Error(`unsupported policy leaf mutation value ${String(value)}`);
}

function fixtureDerivedNeedle(path) {
  return path.split(".")[1];
}

const policyLeafMutationControls = [];
for (const entry of POLICY_LEAF_COVERAGE) {
  if (entry.mode === "informational") continue;
  const value = policyValueAtPath(policy, entry.path);
  const expectedNeedle = entry.mode === "fixture-derived" ? fixtureDerivedNeedle(entry.path) : entry.path;
  if (Array.isArray(value)) {
    policyLeafMutationControls.push({
      label: `${entry.path} order`,
      path: entry.path,
      mutate: (candidate) => mutatePolicyPath(candidate, entry.path, (current) => [...current].reverse()),
      expectedNeedle,
      kind: "order",
    });
    policyLeafMutationControls.push({
      label: `${entry.path} member`,
      path: entry.path,
      mutate: (candidate) => mutatePolicyPath(candidate, entry.path, (current) => current.map((item, index) => (index === 0 ? "__mutated__" : item))),
      expectedNeedle,
      kind: "member",
    });
  } else {
    policyLeafMutationControls.push({
      label: entry.path,
      path: entry.path,
      mutate: (candidate) => mutatePolicyPath(candidate, entry.path, scalarMutation),
      expectedNeedle,
      kind: "value",
    });
  }
}

const policyShapeMutationControls = [
  {
    label: "patternMapping missing key",
    paths: ["patternMapping.hinge"],
    mutate: (candidate) => { delete candidate.patternMapping.hinge; },
    expectedNeedle: "patternMapping.hinge",
  },
  {
    label: "patternMapping extra key",
    paths: ["patternMapping.vertical_pull"],
    mutate: (candidate) => { candidate.patternMapping.vertical_pull = "hip/hinge"; },
    expectedNeedle: "unclassified parsed policy leaves",
  },
  {
    label: "allowlist missing entry",
    paths: ["allowlistedMisses.growth_2_v1.base", "allowlistedMisses.growth_2_v1.effective"],
    mutate: (candidate) => { delete candidate.allowlistedMisses.growth_2_v1; },
    expectedNeedle: "allowlistedMisses.growth_2_v1",
  },
  {
    label: "allowlist extra entry",
    paths: ["allowlistedMisses.home_2_v1.base", "allowlistedMisses.home_2_v1.effective"],
    mutate: (candidate) => { candidate.allowlistedMisses.home_2_v1 = { base: 27, effective: 15 }; },
    expectedNeedle: "unclassified parsed policy leaves",
  },
];

const policyMutationControls = [...policyLeafMutationControls, ...policyShapeMutationControls];
const declaredBindingLeaves = new Set(POLICY_LEAF_COVERAGE.filter((entry) => entry.mode !== "informational").map((entry) => entry.path));
const mutatedBindingLeaves = new Set(policyLeafMutationControls.map((control) => control.path));
const missingMutationCoverage = [...declaredBindingLeaves].filter((path) => !mutatedBindingLeaves.has(path));
check(
  missingMutationCoverage.length === 0,
  `policy mutation coverage: binding leaves lack an isolated mutation control: ${missingMutationCoverage.join(", ")}`,
);
for (const entry of POLICY_LEAF_COVERAGE.filter((candidate) => candidate.mode !== "informational" && Array.isArray(policyValueAtPath(policy, candidate.path)))) {
  const arrayControls = policyLeafMutationControls.filter((control) => control.path === entry.path);
  check(
    arrayControls.some((control) => control.kind === "order") && arrayControls.some((control) => control.kind === "member"),
    `policy mutation coverage: ${entry.path} needs both order and member controls`,
  );
}

const policyMutationMessages = [];
for (const control of policyMutationControls) {
  const mutated = clonePolicy(policy);
  control.mutate(mutated);
  const issues = [
    ...validatePolicyAgreement({ policyText: POLICY_TEXT, fixture, policy: mutated }),
    ...validateOverlayDocumentation({ provenanceText, planText, policy: mutated }),
  ];
  const semantic = issues.find((message) => message.toLowerCase().includes(control.expectedNeedle.toLowerCase()));
  check(!!semantic, `policy mutation ${control.label}: mutation was not rejected with a semantic ${control.expectedNeedle} message`);
  if (semantic) policyMutationMessages.push(`${control.label}: ${semantic}`);
}

const passCount = fixture.reviewCompilations.length;
const missCount = Object.keys(policy.allowlistedMisses).length;
if (process.argv.includes("--check")) {
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL: ${failure}`);
    process.exit(1);
  }
  console.log(`pass: executable Rule B over ${passCount} fixtures, ${missCount} allowlisted misses, rescue and eligibility paths covered`);
  console.log(`pass: ${negativeControlMessages.length}/${negativeControls.length + evidenceNegativeControls.length + fixtureIdNegativeControls.length} existing critical-rule and fixture-ID negative controls rejected semantically`);
  console.log(`pass: ${policyMutationMessages.length}/${policyMutationControls.length} parsed-policy leaf and shape mutation controls rejected semantically`);
} else {
  console.log(`policy version ${policy.policyVersion}: ${passCount} fixture rows, ${missCount} allowlisted misses`);
  for (const message of negativeControlMessages) console.log(`negative control rejected: ${message}`);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL: ${failure}`);
    process.exit(1);
  }
}
