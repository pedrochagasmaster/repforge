// Shared planning/test helpers for the executable recovery policy contract.
// This module is intentionally tool-only. It is not loaded by production code.

const ROUNDERS = Object.freeze({
  ceil: Math.ceil,
  floor: Math.floor,
});

export function normalizePolicyText(text) {
  return text.replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
}

export function parseExecutablePolicy(markdown) {
  const section = markdown.split("## Executable policy contract")[1] || "";
  const matches = [...section.matchAll(/```json\s*\n([\s\S]*?)\n```/g)];
  if (matches.length !== 1) throw new Error(`policy: expected one executable JSON contract, found ${matches.length}`);
  try {
    return JSON.parse(matches[0][1]);
  } catch (error) {
    throw new Error(`policy: executable JSON contract is invalid (${error.message})`);
  }
}

export function parseFixtureEvidence(markdown) {
  const evidence = new Map();
  for (const line of markdown.split("\n")) {
    const match = line.match(/^\|\s*`?([a-z]+_\d+_v\d+)`?\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
    if (!match || evidence.has(match[1])) continue;
    evidence.set(match[1], {
      base: Number(match[2]),
      effective: Number(match[3]),
      ratio: match[4].trim(),
      inBand: /^yes$/i.test(match[5].trim()),
    });
  }
  return evidence;
}

function list(values, conjunction, wrap) {
  const rendered = values.map((value) => (wrap ? `\`${value}\`` : value));
  if (rendered.length === 0) return "";
  if (conjunction === ",") return rendered.join(", ");
  if (rendered.length === 1) return rendered[0];
  if (rendered.length === 2) return rendered.join(` ${conjunction} `);
  return `${rendered.slice(0, -1).join(", ")}, ${conjunction} ${rendered.at(-1)}`;
}

export function codeList(values, conjunction = "or") {
  return list(values, conjunction, true);
}

export function plainList(values, conjunction = "or") {
  return list(values, conjunction, false);
}

export function primaryPatternForTemplate(slotContracts, templateId, policy) {
  const patterns = slotContracts[templateId]?.patterns || [];
  return policy.patternMapping?.[patterns[0]] || null;
}

function rounded(value, operation) {
  const rounder = ROUNDERS[operation];
  if (!rounder) throw new Error(`rule: unsupported rounding operation ${String(operation)}`);
  return rounder(value);
}

export function applyRuleB(slots, policy) {
  const rules = policy.ruleB || {};
  const effective = slots.map((slot) => {
    const rule = rules[slot.status];
    if (!rule) throw new Error(`rule: unsupported slot status ${String(slot.status)}`);
    if (Object.hasOwn(rule, "effectiveWorkingSets")) return rule.effectiveWorkingSets;
    return rounded(slot.sets / rule.divisor, rule.rounding);
  });

  const rescued = [];
  const rescue = rules.coverageRescue;
  if (!rescue || rescue.selection !== "first-eligible-stable-order") {
    throw new Error(`rule: unsupported coverage-rescue selection ${String(rescue?.selection)}`);
  }
  for (const pattern of policy.primaryPatterns || []) {
    const total = slots.reduce(
      (sum, slot, index) =>
        sum + (primaryPatternForTemplate(policy.slotContracts || {}, slot.templateId, policy) === pattern ? effective[index] : 0),
      0,
    );
    if (total !== 0) continue;
    const index = slots.findIndex(
      (slot) =>
        primaryPatternForTemplate(policy.slotContracts || {}, slot.templateId, policy) === pattern &&
        slot.sets >= 1,
    );
    if (index < 0) continue;
    effective[index] = Math.max(effective[index], rescue.minimumWorkingSets);
    rescued.push(`${pattern}:${slots[index].templateId}`);
  }
  return { effective, rescued };
}

export function eligible({ patternOutcomes, checkpointAnswer }, policy) {
  const eligibility = policy.eligibility || {};
  if (checkpointAnswer !== eligibility.qualifyingCheckpointAnswer) return false;
  return (policy.primaryPatterns || []).filter((pattern) =>
    (eligibility.qualifyingOutcomes || []).includes(patternOutcomes[pattern]),
  ).length >= eligibility.minimumPatterns;
}

function objectEntries(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.entries(value) : [];
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function clonePolicy(policy) {
  return clone(policy);
}

export function validatePolicyAgreement({ policyText, fixture, policy }) {
  const failures = [];
  const fail = (condition, message) => {
    if (!condition) failures.push(message);
  };
  const normalized = normalizePolicyText(policyText);
  const eligibility = policy.eligibility || {};
  const ruleB = policy.ruleB || {};
  const reassessment = policy.reassessment || {};

  fail(policy?.kind === "taurifer-recovery-policy", "policy contract: kind is not taurifer-recovery-policy");
  fail(policy?.policyVersion === 2, "policy contract: approved version 2 is missing");
  fail(policy?.status === "Approved", "policy contract: approved status is missing");
  fail(Array.isArray(policy?.primaryPatterns) && policy.primaryPatterns.length === 3, "policy contract: three canonical primary patterns are required");
  fail(policy?.patternMapping && typeof policy.patternMapping === "object", "policy contract: canonical first-token mapping is missing");
  fail(
    objectEntries(policy.patternMapping).every(([, pattern]) => (policy.primaryPatterns || []).includes(pattern)),
    "policy contract: first-token mapping points outside the canonical primary-pattern enum",
  );
  fail(Array.isArray(eligibility.qualifyingOutcomes), "policy contract: qualifying outcome enum is missing");
  fail(Array.isArray(eligibility.checkpointAnswers), "policy contract: checkpoint answer enum is missing");
  fail(typeof eligibility.minimumPatterns === "number", "policy contract: minimum qualifying pattern count is missing");
  fail(ruleB.optional && ruleB.protected && ruleB.reducible && ruleB.coverageRescue, "policy contract: Rule B stages are incomplete");
  fail(policy.acceptanceBand && typeof policy.acceptanceBand.minimum === "number" && typeof policy.acceptanceBand.maximum === "number", "policy contract: acceptance band is missing");
  fail(policy.allowlistedMisses && typeof policy.allowlistedMisses === "object", "policy contract: version allowlist is missing");
  fail(Array.isArray(reassessment.outcomes), "policy contract: reassessment outcome enum is missing");
  fail(reassessment.unset === null, "policy contract: reassessment unset value must be null");
  fail(Array.isArray(reassessment.ordinaryReviewOutcomes), "policy contract: ordinary-review reassessment outcomes are missing");
  fail(
    (reassessment.ordinaryReviewOutcomes || []).every((outcome) => (reassessment.outcomes || []).includes(outcome)),
    "policy contract: ordinary-review reassessment values are outside the closed enum",
  );

  const patternOrder = codeList(policy.primaryPatterns || [], ",");
  fail(
    normalized.includes(`fixed pattern order ${patternOrder}`),
    `pattern order: policy prose disagrees with executable order (${patternOrder})`,
  );
  for (const [token, pattern] of objectEntries(policy.patternMapping)) {
    fail(
      normalized.includes(`\`${token}\` maps to \`${pattern}\``),
      `pattern mapping: policy prose omits \`${token}\` → \`${pattern}\``,
    );
  }

  fail(
    normalized.includes("Remove every `optional`-status slot entirely (0 working sets)"),
    "optional allocation: policy prose disagrees with executable zero-set rule",
  );
  for (const status of ["protected", "reducible"]) {
    const rule = ruleB[status] || {};
    const phrase = `\`${status}\` slots keep \`${rule.rounding}(baseWorkingSets / ${rule.divisor})\``;
    fail(normalized.includes(phrase), `${status} rounding: policy prose disagrees with executable ${phrase}`);
  }
  const rescue = ruleB.coverageRescue || {};
  const rescueAmount = rescue.minimumWorkingSets === 1 ? "one" : String(rescue.minimumWorkingSets);
  const rescueUnit = rescue.minimumWorkingSets === 1 ? "set" : "sets";
  fail(
    normalized.includes(`restore ${rescueAmount} ${rescueUnit} to the first eligible slot in stable program order`),
    `coverage rescue: policy prose disagrees with executable minimum ${String(rescue.minimumWorkingSets)}`,
  );

  const qualifyingOutcomes = codeList(eligibility.qualifyingOutcomes || [], "or");
  fail(
    normalized.includes(`sufficient observed ${qualifyingOutcomes} evidence`),
    `eligibility outcomes: policy prose disagrees with executable enum (${qualifyingOutcomes})`,
  );
  const answers = codeList(eligibility.checkpointAnswers || [], "and");
  fail(
    normalized.includes(`The closed answers are ${answers}; only \`${eligibility.qualifyingCheckpointAnswer}\` qualifies.`),
    `checkpoint answers: policy prose disagrees with executable enum (${answers})`,
  );
  const outcomes = codeList(reassessment.outcomes || [], "or");
  fail(
    normalized.includes(`record one closed result: ${outcomes}.`),
    `reassessment outcomes: policy prose disagrees with executable enum (${outcomes})`,
  );
  const ordinary = codeList(reassessment.ordinaryReviewOutcomes || [], "and");
  fail(
    normalized.includes(`${ordinary} route to ordinary Review with no automatic mutation`),
    `reassessment routing: policy prose disagrees with executable ordinary-review outcomes (${ordinary})`,
  );
  fail(
    reassessment.sameBlockRepeat === false && normalized.includes("never extends or repeats recovery in the same block"),
    "reassessment repeat: policy prose or executable contract permits a same-block repeat",
  );
  fail(
    reassessment.weekTwoCanonical === true && normalized.includes("Week two always renders the canonical prescription"),
    "week-two restoration: policy prose or executable contract does not restore canonical work",
  );

  const band = policy.acceptanceBand || {};
  fail(
    normalized.includes(`${percent(band.minimum).replace("%", "")}–${percent(band.maximum)}`),
    `acceptance band: policy prose disagrees with executable ${percent(band.minimum).replace("%", "")}–${percent(band.maximum)} band`,
  );

  const evidence = parseFixtureEvidence(policyText);
  fail(evidence.size === fixture.reviewCompilations.length, `fixture evidence: expected ${fixture.reviewCompilations.length} rows, found ${evidence.size}`);
  const documentedMisses = new Set([...evidence].filter(([, row]) => !row.inBand).map(([id]) => id));
  const executableMisses = new Set(Object.keys(policy.allowlistedMisses || {}));
  fail(
    JSON.stringify([...documentedMisses].sort()) === JSON.stringify([...executableMisses].sort()),
    `allowlist: executable misses ${[...executableMisses].sort().join(", ")} disagree with accepted evidence ${[...documentedMisses].sort().join(", ")}`,
  );
  for (const [blueprintId, expected] of objectEntries(policy.allowlistedMisses)) {
    const row = evidence.get(blueprintId);
    fail(!!row, `allowlist: missing accepted evidence row for ${blueprintId}`);
    if (row) {
      fail(row.base === expected.base && row.effective === expected.effective, `allowlist: ${blueprintId} expected ${expected.base}→${expected.effective} but evidence records ${row.base}→${row.effective}`);
    }
  }

  const templates = fixture.slotContracts;
  for (const compilation of fixture.reviewCompilations) {
    const slots = compilation.days.flatMap((day) =>
      day.slots.map((slot) => ({ templateId: slot.templateId, status: slot.status, sets: slot.sets })),
    );
    const expected = evidence.get(compilation.blueprintId);
    if (!expected) continue;
    let result;
    try {
      result = applyRuleB(slots, { ...policy, slotContracts: templates });
    } catch (error) {
      failures.push(`${compilation.blueprintId}: executable Rule B failed (${error.message})`);
      continue;
    }
    const base = slots.reduce((sum, slot) => sum + slot.sets, 0);
    const effective = result.effective.reduce((sum, value) => sum + value, 0);
    fail(base === expected.base && effective === expected.effective, `fixture ${compilation.blueprintId}: executable Rule B gives ${base}→${effective}, accepted evidence is ${expected.base}→${expected.effective}`);
    const ratio = effective / base;
    const inBand = ratio >= band.minimum && ratio <= band.maximum;
    fail(inBand === expected.inBand, `fixture ${compilation.blueprintId}: executable band result ${inBand ? "in band" : "outside band"} disagrees with accepted evidence (${expected.ratio})`);
    const optionalsKept = slots.some((slot, index) => slot.status === "optional" && result.effective[index] > 0);
    fail(!optionalsKept, `fixture ${compilation.blueprintId}: optional slot retains working sets`);
    for (const pattern of policy.primaryPatterns || []) {
      const total = slots.reduce(
        (sum, slot, index) => sum + (primaryPatternForTemplate(templates, slot.templateId, policy) === pattern ? result.effective[index] : 0),
        0,
      );
      fail(total >= 1, `fixture ${compilation.blueprintId}: canonical pattern ${pattern} left empty`);
    }
  }

  fail(
    !["BLOCKED", "Candidate Rule B (proposed for owner selection, not decided)", "## ⛔ Open constants (owner gate)", "await owner selection", "until the owner selects the rule"].some((stale) => policyText.includes(stale)),
    "policy prose: stale open-decision wording remains",
  );

  return failures;
}

export function validateOverlayDocumentation({ provenanceText, planText, policy }) {
  const failures = [];
  const fail = (condition, message) => {
    if (!condition) failures.push(message);
  };
  const outcomes = policy.reassessment?.outcomes || [];
  const patterns = policy.primaryPatterns || [];
  const section = (provenanceText.split("## Recovery-week overlay")[1] || "").split(/^## /m)[0];
  const movementLine = section.split("\n").find((line) => line.includes("| `entries` |")) || "";
  fail(movementLine.includes("canonical primary pattern class"), "overlay schema: movementPattern is not a canonical primary class");
  fail(movementLine.includes("or `null` for a non-primary slot"), "overlay schema: non-primary movementPattern null semantics are missing");
  fail(movementLine.includes("raw first-listed compiler template token") && movementLine.includes("not persisted"), "overlay schema: raw template-token persistence is ambiguous");
  const outcomeLine = section.split("\n").find((line) => line.includes("| `reassessmentOutcome` |")) || "";
  fail(outcomeLine.includes("`null` or enum"), "overlay schema: reassessmentOutcome is not a nullable closed enum");
  fail(outcomeLine.includes("Persisted as `null` until week one ends"), "overlay schema: reassessmentOutcome unset-before-reassessment semantics are missing");
  for (const outcome of outcomes) fail(outcomeLine.includes(`\`${outcome}\``), `overlay schema: reassessment outcome ${outcome} is missing`);
  const exampleMatch = section.match(/```json\s*\n([\s\S]*?)\n```/);
  let example = null;
  try {
    example = exampleMatch ? JSON.parse(exampleMatch[1]) : null;
  } catch (error) {
    failures.push(`overlay example: invalid JSON (${error.message})`);
  }
  fail(!!example, "overlay example: shape-exact JSON example is missing");
  if (example) {
    fail(example.reassessmentOutcome === policy.reassessment?.unset, "overlay example: reassessmentOutcome is not unset before reassessment");
    for (const [index, entry] of (example.entries || []).entries()) {
      fail(entry.movementPattern === null || patterns.includes(entry.movementPattern), `overlay example: entry ${index} uses a non-canonical movementPattern`);
    }
  }

  const shapeLine = planText.split("\n").find((line) => line.includes("reassessmentOutcome: null")) || "";
  fail(shapeLine.includes('"Better"') && shapeLine.includes('"About the same"') && shapeLine.includes('"Worse"'), "Plan 052: overlay shape omits a reassessment enum value");
  fail(planText.includes("`reassessmentOutcome` is persisted as `null` until week one ends"), "Plan 052: unset-before-reassessment semantics are missing");
  fail(planText.includes("`movementPattern` stores the canonical primary pattern class") && planText.includes("raw\nfirst-listed compiler template token") && planText.includes("not persisted"), "Plan 052: movementPattern representation is ambiguous");
  for (const outcome of outcomes) fail(planText.includes(`\`${outcome}\``), `Plan 052: reassessment outcome ${outcome} is missing`);
  fail(planText.includes("no recovery extension or repeat is\nallowed in the same block"), "Plan 052: same-block recovery repeat rule is missing");
  return failures;
}
