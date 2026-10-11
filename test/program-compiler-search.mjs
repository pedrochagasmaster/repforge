#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { corpusCases } from "./fixtures/program-compiler-corpus-cases.mjs";

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

const digests = {};
for (const { key, request, seed } of corpusCases({ Adapter, Catalog })) {
  const generated = Compiler.generateProgram(request, Catalog, seed);
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
