#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { corpusCases } from "./fixtures/program-compiler-corpus-cases.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const Compiler = require(path.join(root, "program-compiler.js"));
const Adapter = require(path.join(root, "program-entry-adapter.js"));
const Catalog = require(path.join(root, "assets/exercise-catalog.json"));
// Pure search proofs cover impossible-slot latency, canonical replay and catalog
// order independence across the retained product request families. Historical
// Plan 067 digests remain evidence for that retired generator, not this version.
require(path.join(root, "generation-identity.js")).prepareCatalog(Catalog);

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

let successful = 0;
const reversedCatalog = { ...Catalog, exercises: [...Catalog.exercises].reverse() };
require(path.join(root, "generation-identity.js")).prepareCatalog(reversedCatalog);
for (const { key, request } of corpusCases({ Adapter, Catalog })) {
  const generated = Compiler.generateProgram(request, Catalog);
  assert.deepEqual(Compiler.generateProgram(request, Catalog), generated, `${key} replays identically`);
  assert.deepEqual(Compiler.generateProgram(request, reversedCatalog), generated,
    `${key} is independent of catalog array order`);
  if (generated.ok) {
    successful++;
    assert.deepEqual(Compiler.validateProgramDefinition(generated.value, Catalog), { ok: true, issues: [] }, key);
    assert.equal(generated.value.seed, undefined, `${key} carries no caller seed`);
  } else {
    assert.equal(generated.value, null, `${key} never returns a partial program`);
    assert.ok(generated.conflicts.length > 0, `${key} explains refusal`);
  }
}
assert.ok(successful >= 150, "the retained request corpus is mostly satisfiable");

// The #349 reproduction: the Home preset without a pull-up bar or bands has no
// exercise that can fill the second upper day's vertical pull.
const home = requestFor({});
const noVerticalPull = withEquipment(home, home.gymProfile.equipmentIds.filter((id) =>
  !/pull-up bar|resistance band/i.test(Catalog.uuidIndex[id].name)));
const started = performance.now();
const unsatisfiable = Compiler.generateProgram(noVerticalPull, Catalog);
const elapsed = performance.now() - started;
assert.equal(unsatisfiable.ok, false);
assert.equal(unsatisfiable.value, null);
assert.ok(unsatisfiable.conflicts.some((conflict) => conflict.code === "no_eligible_exercise" &&
  conflict.purposeId === "upper_b_vertical_pull" && conflict.role === "hypertrophyPrimaryCompound" &&
  conflict.reasons.equipment_unavailable > 0),
  "the conflict identifies the unfillable job, role and equipment refusal");
assert.ok(elapsed < 1000, `a job with no eligible exercise fails without exhausting the search (took ${Math.round(elapsed)} ms)`);
