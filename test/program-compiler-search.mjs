#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const Compiler = require(path.join(root, "program-compiler.js"));
const Adapter = require(path.join(root, "program-entry-adapter.js"));
const Catalog = require(path.join(root, "assets/exercise-catalog.json"));
const fixturePath = path.join(root, "test/fixtures/program-compiler-corpus.json");

// The selection search is an algorithmic boundary that the browser journey
// cannot enumerate: an unsatisfiable job must fail quickly instead of
// exhausting the backtracking budget on the main thread (#349), and every
// satisfiable request must regenerate byte-identically, because generated
// setup links rebuild the program from its request and seed. The fixture
// digests were recorded from main before the search changed; regenerate them
// with `--update` only together with a GENERATOR_VERSION change.

const allEquipment = Object.keys(Catalog.uuidIndex).filter((id) => Catalog.uuidIndex[id]?.type === "equipment").sort();
const exerciseId = (name) => Catalog.exercises.find((entry) => entry.name === name).id;

function requestFor(answers) {
  const mapped = Adapter.programRequestFromAnswers({
    desiredResult: "muscle_growth", structuredExperience: "6_to_24m", daysPerWeek: 4, sessionMinutes: 60,
    environment: { kind: "limited_home" }, ...answers,
  }, Catalog);
  assert.equal(mapped.ok, true, JSON.stringify(mapped.conflicts));
  return mapped.value;
}

function withEquipment(request, equipmentIds) {
  return { ...request, gymProfile: { equipmentIds } };
}

// Byte-identical regeneration across goals, experience, day counts, gym
// templates, session lengths, muscle and exercise answers, and seeds.
const variants = {
  plain: {},
  focus: { primaryMuscles: ["side_delts", "back"], deEmphasizedMuscles: ["calves"] },
  avoid: { ignoredMuscles: ["glutes"], exerciseConstraints: [{ exerciseId: exerciseId("Pec deck fly"), reason: "dislike" }] },
  prefer: { mustHaveExercises: [exerciseId("Leg extension")] },
  competent: { competencyAnswers: Object.fromEntries(["pullups10", "pullups5", "pushups15", "inclineBarbell10",
    "overheadPress10", "bodyweightDips10", "benchPress10"].map((key) => [key, true])) },
};
const cases = [];
for (const goal of ["muscle_growth", "balanced", "strength"]) {
  for (const days of [2, 3, 4, 5, 6]) {
    for (const environment of ["limited_home", "full_home", "basic_gym", "commercial_gym", "everything"]) {
      for (const minutes of [40, 90]) {
        cases.push({ goal, experience: "6_to_24m", days, environment, minutes, variant: "plain", seed: days % 2 ? "1" : "corpus-b" });
      }
    }
  }
}
for (const variant of Object.keys(variants)) {
  for (const experience of ["first", "over_24m"]) {
    for (const environment of ["limited_home", "basic_gym", "commercial_gym"]) {
      cases.push({ goal: experience === "first" ? "muscle_growth" : "strength", experience, days: experience === "first" ? 3 : 5,
        environment, minutes: 60, variant, seed: "variant" });
    }
  }
}

const digests = {};
for (const item of cases) {
  const key = [item.goal, item.experience, item.days, item.environment, item.minutes, item.variant, item.seed].join("|");
  const request = requestFor({
    desiredResult: item.goal, structuredExperience: item.experience, daysPerWeek: item.days, sessionMinutes: item.minutes,
    environment: { kind: item.environment === "everything" ? "commercial_gym" : item.environment }, ...variants[item.variant],
  });
  const generated = Compiler.generateProgram(item.environment === "everything" ? withEquipment(request, allEquipment) : request, Catalog, item.seed);
  digests[key] = `${generated.ok ? "ok" : "conflict"}:${crypto.createHash("sha256").update(JSON.stringify(generated)).digest("hex")}`;
}

if (process.argv.includes("--update")) {
  fs.writeFileSync(fixturePath, `${JSON.stringify({ generatorVersion: Compiler.GENERATOR_VERSION, digests }, null, 2)}\n`);
  console.log(`wrote ${Object.keys(digests).length} digests`);
  process.exit(0);
}

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
assert.equal(Compiler.GENERATOR_VERSION, fixture.generatorVersion,
  "a generator version change re-records the corpus; the same version must regenerate identically");
assert.deepEqual(Object.keys(digests), Object.keys(fixture.digests), "the corpus enumerates the recorded cases");
for (const [key, digest] of Object.entries(fixture.digests)) {
  assert.equal(digests[key], digest, `${key} regenerates byte-identically`);
}
assert.ok(Object.values(digests).filter((digest) => digest.startsWith("ok:")).length >= 150, "the corpus is mostly satisfiable programs");

// The #349 reproduction: the Home preset without a pull-up bar or bands has no
// exercise that can fill the second upper day's vertical pull.
const home = requestFor({});
const noVerticalPull = withEquipment(home, home.gymProfile.equipmentIds.filter((id) =>
  !/pull-up bar|resistance band/i.test(Catalog.uuidIndex[id].name)));
const started = performance.now();
const unsatisfiable = Compiler.generateProgram(noVerticalPull, Catalog, "1");
const elapsed = performance.now() - started;
assert.equal(unsatisfiable.ok, false);
assert.deepEqual(unsatisfiable.conflicts, [{
  code: "no_eligible_exercise",
  purposeId: "upper_b_vertical_pull",
  role: "hypertrophyPrimaryCompound",
  reasons: { purpose_mismatch: 1289, equipment_unavailable: 18, prerequisite_confirmation_required: 6, role_tier_unavailable: 32 },
  message: "No eligible catalog exercise can fill upper_b_vertical_pull under the current constraints.",
}], "the conflict names the job, its role and why every catalog exercise was rejected");
assert.ok(elapsed < 1000, `a job with no eligible exercise fails without exhausting the search (took ${Math.round(elapsed)} ms)`);
