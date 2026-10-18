#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const Compiler = require(path.join(root, "src/training/generation.js"));
const Adapter = require(path.join(root, "program-entry-adapter.js"));
const Catalog = require(path.join(root, "assets/exercise-catalog.json"));
// Pure search proofs cover impossible-slot latency, canonical replay and catalog
// order independence across the retained product request families. Historical
// Plan 067 digests remain evidence for that retired generator, not this version.
require(path.join(root, "src/training/identity.js")).prepareCatalog(Catalog);

function requestFor(answers) {
  const mapped = Adapter.programRequestFromAnswers({
    desiredResult: "muscle_growth", structuredExperience: "6_to_24m", daysPerWeek: 4, sessionMinutes: 60,
    environment: { kind: "limited_home" }, ...answers,
  }, Catalog);
  assert.equal(mapped.ok, true, JSON.stringify(mapped.conflicts));
  return mapped.value;
}

const reversedCatalog = { ...Catalog, exercises: [...Catalog.exercises].reverse() };
require(path.join(root, "src/training/identity.js")).prepareCatalog(reversedCatalog);
// The same replay/order boundary is retained as a bounded current-domain sample.
// Historical corpus cardinality and old search-job counts are not contracts.
for (const answers of [
  { desiredResult: "balanced", daysPerWeek: 3, environment: { kind: "commercial_gym" } },
  { desiredResult: "muscle_growth", daysPerWeek: 4, environment: { kind: "commercial_gym" } },
  { desiredResult: "strength", daysPerWeek: 6, environment: { kind: "commercial_gym" } },
]) {
  const request = requestFor(answers);
  const generated = Compiler.generateProgram(request, Catalog);
  assert.deepEqual(Compiler.generateProgram(request, Catalog), generated, "same current request replays identically");
  assert.deepEqual(Compiler.generateProgram(request, reversedCatalog), generated,
    "current generation is independent of catalog array order");
  if (generated.ok) {
    assert.deepEqual(Compiler.validateProgramDefinition(generated.value, Catalog), { ok: true, issues: [] });
    assert.equal(generated.value.seed, undefined);
    assert.equal(generated.value.provenance.source, "recovered_generation_rules");
  } else {
    assert.equal(generated.value, null, "refusal never returns a partial program");
    assert.ok(generated.conflicts.length > 0, "refusal is explained");
  }
}

// #349: without a pull-up bar or bands the Home fixture cannot fill its
// mandatory vertical pull. The diagnostic no longer names a retired job.
const home = requestFor({});
const noVerticalPull = { ...home, gymProfile: { equipmentIds: home.gymProfile.equipmentIds.filter(id =>
  !/pull-up bar|resistance band/i.test(Catalog.uuidIndex[id].name)) } };
const started = performance.now();
const unsatisfiable = Compiler.generateProgram(noVerticalPull, Catalog);
const elapsed = performance.now() - started;
assert.equal(unsatisfiable.ok, false);
assert.equal(unsatisfiable.value, null);
assert.ok(unsatisfiable.conflicts.some(conflict => conflict.code === "insufficient_candidates"),
  "a missing mandatory candidate is refused instead of replacing the movement or returning a partial program");
assert.deepEqual(Compiler.generateProgram(noVerticalPull, Catalog), unsatisfiable);
assert.ok(elapsed < 1000, `a missing mandatory candidate fails without search exhaustion (took ${Math.round(elapsed)} ms)`);
