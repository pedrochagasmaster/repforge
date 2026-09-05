// Shared planning/test helpers for the executable recovery policy contract.
// This module is intentionally tool-only. It is not loaded by production code.

const ROUNDERS = Object.freeze({
  ceil: Math.ceil,
  floor: Math.floor,
});

const APPROVED_PRIMARY_PATTERNS = Object.freeze([
  "knee-dominant",
  "horizontal press",
  "hip/hinge",
]);

const APPROVED_PATTERN_MAPPING = Object.freeze({
  squat: "knee-dominant",
  press: "horizontal press",
  incline_press: "horizontal press",
  hinge: "hip/hinge",
});

const APPROVED_EVIDENCE_STATUSES = Object.freeze(["Yes", "Miss (low)"]);

// Every parsed contract leaf must have an explicit proof classification. Exact
// leaves are owner-approved constants. Allowlist totals are derived from the
// independent compiler fixture oracle below. An informational leaf would be
// named here with mode "informational"; the current policy has none.
export const POLICY_LEAF_COVERAGE = Object.freeze([
  { path: "kind", mode: "exact", expected: "taurifer-recovery-policy" },
  { path: "policyVersion", mode: "exact", expected: 2 },
  { path: "status", mode: "exact", expected: "Approved" },
  { path: "primaryPatterns", mode: "exact", expected: APPROVED_PRIMARY_PATTERNS },
  { path: "patternMapping.squat", mode: "exact", expected: "knee-dominant" },
  { path: "patternMapping.press", mode: "exact", expected: "horizontal press" },
  { path: "patternMapping.incline_press", mode: "exact", expected: "horizontal press" },
  { path: "patternMapping.hinge", mode: "exact", expected: "hip/hinge" },
  { path: "eligibility.qualifyingOutcomes", mode: "exact", expected: ["maintained", "declined"] },
  { path: "eligibility.minimumPatterns", mode: "exact", expected: 2 },
  { path: "eligibility.checkpointAnswers", mode: "exact", expected: ["Yes", "No", "Not sure"] },
  { path: "eligibility.qualifyingCheckpointAnswer", mode: "exact", expected: "Yes" },
  { path: "ruleB.optional.effectiveWorkingSets", mode: "exact", expected: 0 },
  { path: "ruleB.optional.reason", mode: "exact", expected: "optional-removed" },
  { path: "ruleB.protected.rounding", mode: "exact", expected: "ceil" },
  { path: "ruleB.protected.divisor", mode: "exact", expected: 2 },
  { path: "ruleB.protected.reason", mode: "exact", expected: "protected-ceil" },
  { path: "ruleB.reducible.rounding", mode: "exact", expected: "floor" },
  { path: "ruleB.reducible.divisor", mode: "exact", expected: 2 },
  { path: "ruleB.reducible.reason", mode: "exact", expected: "reducible-floor" },
  { path: "ruleB.coverageRescue.minimumWorkingSets", mode: "exact", expected: 1 },
  { path: "ruleB.coverageRescue.selection", mode: "exact", expected: "first-eligible-stable-order" },
  { path: "ruleB.coverageRescue.reason", mode: "exact", expected: "pattern-rescue" },
  { path: "acceptanceBand.minimum", mode: "exact", expected: 0.4 },
  { path: "acceptanceBand.maximum", mode: "exact", expected: 0.6 },
  { path: "allowlistedMisses.growth_2_v1.base", mode: "fixture-derived" },
  { path: "allowlistedMisses.growth_2_v1.effective", mode: "fixture-derived" },
  { path: "allowlistedMisses.growth_3_v1.base", mode: "fixture-derived" },
  { path: "allowlistedMisses.growth_3_v1.effective", mode: "fixture-derived" },
  { path: "reassessment.outcomes", mode: "exact", expected: ["Better", "About the same", "Worse"] },
  { path: "reassessment.unset", mode: "exact", expected: null },
  { path: "reassessment.ordinaryReviewOutcomes", mode: "exact", expected: ["About the same", "Worse"] },
  { path: "reassessment.sameBlockRepeat", mode: "exact", expected: false },
  { path: "reassessment.weekTwoCanonical", mode: "exact", expected: true },
]);

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
  const rows = [];
  let inEvidenceTable = false;
  for (const line of markdown.split("\n")) {
    if (/^\|\s*Blueprint\s*\|\s*Base\s*\|\s*Effective\s*\|\s*Ratio\s*\|\s*In 40[–-]60%\s*\|/.test(line)) {
      inEvidenceTable = true;
      continue;
    }
    if (!inEvidenceTable) continue;
    if (/^\|\s*:?-+/.test(line)) continue;
    const match = line.match(/^\|\s*`?([a-z]+_\d+_v\d+)`?\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
    if (!match) {
      inEvidenceTable = false;
      continue;
    }
    rows.push({
      id: match[1],
      base: Number(match[2]),
      effective: Number(match[3]),
      ratio: match[4].trim(),
      status: match[5].trim(),
    });
  }
  const byId = new Map();
  const duplicates = [];
  for (const row of rows) {
    if (byId.has(row.id)) duplicates.push(row.id);
    else byId.set(row.id, row);
  }
  return { rows, byId, duplicates };
}

export function formatEvidenceRatio(base, effective) {
  if (!Number.isFinite(base) || !Number.isFinite(effective) || base <= 0) return null;
  return `${((effective / base) * 100).toFixed(1)}%`;
}

function derivedEvidenceStatus(base, effective, band, allowlisted) {
  if (!Number.isFinite(base) || !Number.isFinite(effective) || base <= 0) return null;
  const ratio = effective / base;
  if (ratio >= band.minimum && ratio <= band.maximum) return "Yes";
  if (ratio < band.minimum && allowlisted) return "Miss (low)";
  return null;
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

function policyValueAtPath(policy, path) {
  return path.split(".").reduce((value, segment) => value?.[segment], policy);
}

function policyLeafPaths(value, prefix = "") {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => policyLeafPaths(child, prefix ? `${prefix}.${key}` : key));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validatePolicyLeafCoverage(policy) {
  const failures = [];
  const fail = (condition, message) => {
    if (!condition) failures.push(message);
  };
  const declarations = POLICY_LEAF_COVERAGE.map((entry) => entry.path);
  const declared = new Set(declarations);
  const actual = new Set(policyLeafPaths(policy));
  const duplicateDeclarations = declarations.filter((path, index) => declarations.indexOf(path) !== index);
  const missingDeclarations = [...actual].filter((path) => !declared.has(path));
  const absentLeaves = [...declared].filter((path) => !actual.has(path));
  fail(
    duplicateDeclarations.length === 0,
    `policy contract: duplicate leaf coverage declarations ${[...new Set(duplicateDeclarations)].join(", ")}`,
  );
  fail(
    missingDeclarations.length === 0,
    `policy contract: unclassified parsed policy leaves ${missingDeclarations.join(", ")}`,
  );
  fail(
    absentLeaves.length === 0,
    `policy contract: leaf coverage names absent from parsed policy ${absentLeaves.join(", ")}`,
  );
  for (const entry of POLICY_LEAF_COVERAGE) {
    fail(
      ["exact", "fixture-derived", "informational"].includes(entry.mode),
      `policy contract: unsupported leaf coverage mode ${String(entry.mode)} for ${entry.path}`,
    );
    if (entry.mode === "exact") {
      fail(
        sameJson(policyValueAtPath(policy, entry.path), entry.expected),
        `policy contract: ${entry.path} must equal ${JSON.stringify(entry.expected)}`,
      );
    }
  }
  return failures;
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

  failures.push(...validatePolicyLeafCoverage(policy));

  fail(policy?.kind === "taurifer-recovery-policy", "policy contract: kind is not taurifer-recovery-policy");
  fail(policy?.policyVersion === 2, "policy contract: approved version 2 is missing");
  fail(policy?.status === "Approved", "policy contract: approved status is missing");
  fail(Array.isArray(policy?.primaryPatterns) && policy.primaryPatterns.length === APPROVED_PRIMARY_PATTERNS.length, "policy contract: three canonical primary patterns are required");
  fail(
    JSON.stringify(policy?.primaryPatterns) === JSON.stringify(APPROVED_PRIMARY_PATTERNS),
    `policy contract: primary pattern set/order must be ${JSON.stringify(APPROVED_PRIMARY_PATTERNS)}`,
  );
  fail(policy?.patternMapping && typeof policy.patternMapping === "object", "policy contract: canonical first-token mapping is missing");
  fail(
    JSON.stringify(policy?.patternMapping) === JSON.stringify(APPROVED_PATTERN_MAPPING),
    `policy contract: first-token mapping must be ${JSON.stringify(APPROVED_PATTERN_MAPPING)}`,
  );
  fail(Array.isArray(eligibility.qualifyingOutcomes), "policy contract: qualifying outcome enum is missing");
  fail(Array.isArray(eligibility.checkpointAnswers), "policy contract: checkpoint answer enum is missing");
  fail(eligibility.minimumPatterns === 2, "policy contract: minimumPatterns must be exactly the owner-approved integer 2");
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
  const compilations = Array.isArray(fixture?.reviewCompilations) ? fixture.reviewCompilations : [];
  const fixtureIds = compilations.map((compilation) => String(compilation?.blueprintId ?? "<missing-blueprint-id>"));
  const fixtureIdSet = new Set(fixtureIds);
  const evidenceIdSet = new Set(evidence.rows.map((row) => row.id));
  const missingEvidenceIds = [...fixtureIdSet].filter((id) => !evidenceIdSet.has(id));
  const extraEvidenceIds = [...evidenceIdSet].filter((id) => !fixtureIdSet.has(id));
  const duplicateFixtureIds = fixtureIds.filter((id, index) => fixtureIds.indexOf(id) !== index);
  fail(
    evidence.duplicates.length === 0,
    `fixture evidence ID set: duplicate policy evidence IDs ${[...new Set(evidence.duplicates)].join(", ")}`,
  );
  fail(
    duplicateFixtureIds.length === 0,
    `fixture reviewCompilation ID set: duplicate fixture IDs ${[...new Set(duplicateFixtureIds)].join(", ")}`,
  );
  fail(
    missingEvidenceIds.length === 0 && extraEvidenceIds.length === 0,
    `fixture evidence ID set: missing rows ${missingEvidenceIds.join(", ") || "none"}; extra rows ${extraEvidenceIds.join(", ") || "none"}`,
  );
  fail(
    evidence.rows.length === fixtureIds.length,
    `fixture evidence row count: expected ${fixtureIds.length}, found ${evidence.rows.length}`,
  );
  const executableMisses = new Set(Object.keys(policy.allowlistedMisses || {}));
  for (const row of evidence.rows) {
    const canonicalRatio = formatEvidenceRatio(row.base, row.effective);
    fail(
      row.ratio === canonicalRatio,
      `fixture evidence ${row.id}: documented ratio ${row.ratio} disagrees with canonical ${canonicalRatio || "invalid"} ratio from ${row.base}→${row.effective}`,
    );
    fail(
      APPROVED_EVIDENCE_STATUSES.includes(row.status),
      `fixture evidence ${row.id}: status ${JSON.stringify(row.status)} is outside the closed vocabulary ${APPROVED_EVIDENCE_STATUSES.join(" / ")}`,
    );
    const expectedStatus = derivedEvidenceStatus(row.base, row.effective, band, executableMisses.has(row.id));
    fail(
      expectedStatus !== null,
      `fixture evidence ${row.id}: ratio ${row.ratio} has no supported disposition; only in-band Yes or an approved low miss may be documented`,
    );
    if (expectedStatus !== null) {
      fail(
        row.status === expectedStatus,
        `fixture evidence ${row.id}: status ${JSON.stringify(row.status)} disagrees with derived ${expectedStatus} disposition for ${row.ratio}`,
      );
    }
  }
  const documentedMisses = new Set(evidence.rows.filter((row) => row.status === "Miss (low)").map((row) => row.id));
  fail(
    JSON.stringify([...documentedMisses].sort()) === JSON.stringify([...executableMisses].sort()),
    `allowlist: executable misses ${[...executableMisses].sort().join(", ")} disagree with accepted evidence ${[...documentedMisses].sort().join(", ")}`,
  );
  for (const [blueprintId, expected] of objectEntries(policy.allowlistedMisses)) {
    const row = evidence.byId.get(blueprintId);
    fail(!!row, `allowlist: missing accepted evidence row for ${blueprintId}`);
    if (row) {
      fail(row.base === expected.base && row.effective === expected.effective, `allowlist: ${blueprintId} expected ${expected.base}→${expected.effective} but evidence records ${row.base}→${row.effective}`);
    }
  }

  const templates = fixture.slotContracts;
  for (const compilation of compilations) {
    const compilationId = String(compilation?.blueprintId ?? "<missing-blueprint-id>");
    const slots = compilation.days.flatMap((day) =>
      day.slots.map((slot) => ({ templateId: slot.templateId, status: slot.status, sets: slot.sets })),
    );
    const expected = evidence.byId.get(compilationId);
    if (!expected) {
      failures.push(`fixture ${compilationId}: no policy evidence row for this reviewCompilation ID`);
      continue;
    }
    let result;
    try {
      result = applyRuleB(slots, { ...policy, slotContracts: templates });
    } catch (error) {
      failures.push(`${compilationId}: executable Rule B failed (${error.message})`);
      continue;
    }
    const base = slots.reduce((sum, slot) => sum + slot.sets, 0);
    const effective = result.effective.reduce((sum, value) => sum + value, 0);
    fail(base === expected.base && effective === expected.effective, `fixture ${compilationId}: executable Rule B gives ${base}→${effective}, accepted evidence is ${expected.base}→${expected.effective}`);
    const canonicalRatio = formatEvidenceRatio(base, effective);
    fail(canonicalRatio === expected.ratio, `fixture ${compilationId}: executable ratio ${canonicalRatio || "invalid"} disagrees with accepted evidence ${expected.ratio}`);
    const derivedStatus = derivedEvidenceStatus(base, effective, band, executableMisses.has(compilationId));
    fail(
      derivedStatus !== null,
      `fixture ${compilationId}: executable ratio ${canonicalRatio || "invalid"} has no supported evidence disposition`,
    );
    if (derivedStatus !== null) {
      fail(expected.status === derivedStatus, `fixture ${compilationId}: accepted status ${JSON.stringify(expected.status)} disagrees with executable ${derivedStatus} disposition`);
    }
    const optionalsKept = slots.some((slot, index) => slot.status === "optional" && result.effective[index] > 0);
    fail(!optionalsKept, `fixture ${compilationId}: optional slot retains working sets`);
    for (const pattern of policy.primaryPatterns || []) {
      const total = slots.reduce(
        (sum, slot, index) => sum + (primaryPatternForTemplate(templates, slot.templateId, policy) === pattern ? result.effective[index] : 0),
        0,
      );
      fail(total >= 1, `fixture ${compilationId}: canonical pattern ${pattern} left empty`);
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
