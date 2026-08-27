import assert from "node:assert/strict";

const FIXTURE_SERVICE_VERSION = "program-entry-fixture-1";

const FAMILY_BY_RESULT = Object.freeze({
  muscle_growth: "growth",
  balanced: "balanced",
  strength: "strength",
});

const SPLITS_BY_FREQUENCY = Object.freeze({
  2: Object.freeze(["full_body", "upper_lower"]),
  3: Object.freeze(["full_body", "push_pull_legs"]),
  4: Object.freeze(["upper_lower", "full_body"]),
  5: Object.freeze(["upper_lower", "push_pull_legs"]),
  6: Object.freeze(["push_pull_legs", "upper_lower"]),
});

const CATALOGUE = Object.freeze([
  Object.freeze({
    id: "growth-3-v1",
    family: "growth",
    version: "1",
    daysPerWeek: 3,
    minutes: Object.freeze([45, 75]),
    maturity: Object.freeze(["first", "under_6m", "6_to_24m", "over_24m"]),
    environments: Object.freeze(["commercial_gym", "basic_gym", "full_home"]),
    browse: true,
    complete: true,
    executable: true,
    tested: true,
  }),
  Object.freeze({
    id: "strength-5-v1",
    family: "strength",
    version: "1",
    daysPerWeek: 5,
    minutes: Object.freeze([60, 90]),
    maturity: Object.freeze(["6_to_24m", "over_24m"]),
    environments: Object.freeze(["commercial_gym", "full_home"]),
    browse: true,
    complete: true,
    executable: true,
    tested: true,
  }),
  Object.freeze({
    id: "future-disabled-v2",
    family: "future",
    version: "2",
    daysPerWeek: 4,
    minutes: Object.freeze([60, 75]),
    maturity: Object.freeze(["over_24m"]),
    environments: Object.freeze(["commercial_gym"]),
    browse: false,
    complete: false,
    executable: false,
    tested: false,
  }),
]);

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value) {
  const text = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fixture-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function splitChoices(answers) {
  const choices = SPLITS_BY_FREQUENCY[answers.daysPerWeek] || [];
  return {
    version: FIXTURE_SERVICE_VERSION,
    choices: choices.map((id, index) => ({ id, default: index === 0 })),
  };
}

function compile({ mode, answers, versions }) {
  assert.ok(mode === "recommend" || mode === "custom", "fixture compiler mode");
  assert.ok(answers && typeof answers === "object", "fixture compiler answers");
  assert.equal(Object.hasOwn(answers, "volumeTolerance"), false, "volume tolerance is not an input");
  assert.ok(Number.isInteger(answers.daysPerWeek) && answers.daysPerWeek >= 2 && answers.daysPerWeek <= 6);
  const family = FAMILY_BY_RESULT[answers.desiredResult];
  assert.ok(family, "closed desired result");
  const complexity = answers.structuredExperience === "first" ? "foundation" : "standard";
  const reentry = ["few", "none"].includes(answers.recentConsistency) ? "weeks_1_2" : "none";
  const splits = splitChoices(answers).choices;
  if (mode === "custom") {
    assert.ok(splits.some((choice) => choice.id === answers.splitPreference), "compatible split required");
  }
  const source = {
    serviceVersion: FIXTURE_SERVICE_VERSION,
    mode,
    answers,
    versions,
    family,
    complexity,
    reentry,
  };
  const primary = {
    id: `${family}-${answers.daysPerWeek}-fixture`,
    family,
    daysPerWeek: answers.daysPerWeek,
    split: mode === "custom" ? answers.splitPreference : splits[0].id,
    complexity,
    reentry,
  };
  const candidates = [primary];
  if (mode === "recommend" && answers.desiredResult === "balanced") {
    candidates.push({ ...primary, id: `balanced-alternative-${answers.daysPerWeek}-fixture`, split: splits[1].id });
  }
  return {
    serviceVersion: FIXTURE_SERVICE_VERSION,
    fingerprint: fingerprint(source),
    candidates,
    diagnostics: {
      desiredResult: answers.desiredResult,
      structuredExperience: answers.structuredExperience,
      recentConsistency: answers.recentConsistency,
      daysPerWeek: answers.daysPerWeek,
      mainConstraint: answers.environment.kind,
    },
    preview: {
      source: "fixture",
      family,
      days: Array.from({ length: answers.daysPerWeek }, (_, index) => ({
        id: `day-${index + 1}`,
        exercises: [],
      })),
      primaryMuscles: answers.primaryMuscles || [],
    },
  };
}

function browseCatalogue(context) {
  const entries = CATALOGUE.filter((entry) => entry.browse && entry.complete && entry.executable && entry.tested);
  return entries.map((entry) => ({
    ...entry,
    mismatch: context && context.daysPerWeek !== entry.daysPerWeek ? "frequency" : null,
  }));
}

export function createFixtureServices() {
  return Object.freeze({
    version: FIXTURE_SERVICE_VERSION,
    splitChoices,
    compile,
    browseCatalogue,
  });
}

export { CATALOGUE, FIXTURE_SERVICE_VERSION, SPLITS_BY_FREQUENCY };
