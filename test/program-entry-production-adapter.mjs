#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Entry = require("../program-entry.js");
const Adapter = require("../program-entry-adapter.js");
const Compiler = require("../program-compiler.js");
const Catalog = require("../assets/exercise-catalog.json");
const workerFixture = JSON.parse(require("node:fs").readFileSync(new URL(
  "../services/install-transfer/test/fixtures/program-definition-plan067-worker.json",
  import.meta.url,
), "utf8"));

function generatedRequest(overrides = {}) {
  const request = structuredClone(workerFixture.request);
  const seed = request.seed;
  delete request.seed;
  Object.assign(request, overrides);
  request.gymProfile.equipmentIds = Object.keys(Catalog.uuidIndex)
    .filter((id) => Catalog.uuidIndex[id]?.type === "equipment");
  return { request, seed };
}

test("production services pass the typed request, raw snapshot and explicit seed to the canonical compiler", () => {
  const services = Adapter.createProductionServices({ Compiler, catalog: Catalog });
  const { request, seed } = generatedRequest({
    daysPerWeek: 4,
    timeCeilingMinutes: 150,
    cycles: 12,
    deloadCycles: [6, 12],
    split: "auto",
  });
  const originalRequest = structuredClone(request);
  const expected = Compiler.generateProgram(request, Catalog, seed);
  const actual = services.generateProgram({ request, seed });

  assert.equal(actual.ok, true, actual.conflicts?.map((item) => item.message).join("; "));
  assert.deepEqual(actual, expected, "the adapter returns the real compiler result without a family/candidate wrapper");
  assert.deepEqual(request, originalRequest, "generation does not mutate the authored request");
  assert.equal(actual.value.cycles, 12);
  assert.deepEqual(Compiler.validateProgramDefinition(actual.value, Catalog), { ok: true, issues: [] });
  assert.deepEqual(Object.keys(actual).sort(), ["conflicts", "explanations", "ok", "value"]);
});

test("production services expose no family, browse, split, or legacy compile façade", () => {
  const services = Adapter.createProductionServices({ Compiler, catalog: Catalog });
  for (const method of ["compile", "splitChoices", "browseCatalogue", "answersToCompilerContext", "resolveFamilyId", "sharedMovementId"]) {
    assert.equal(services[method], undefined, `${method} is retired from the production service surface`);
  }
  assert.equal(typeof services.generateProgram, "function");
  assert.equal(typeof services.currentVersions, "function");
});

test("invalid compiler requests stay explicit conflicts and never fall back to a starter program", () => {
  const services = Adapter.createProductionServices({ Compiler, catalog: Catalog });
  const { request, seed } = generatedRequest();
  request.gymProfile.equipmentIds = ["vague:machine"];
  const actual = services.generateProgram({ request, seed });
  const expected = Compiler.generateProgram(request, Catalog, seed);
  assert.equal(actual.ok, false);
  assert.deepEqual(actual, expected);
  assert.equal(actual.value, null);
  assert.ok(actual.conflicts.length > 0);
});

test("production services require the checked raw catalog snapshot", () => {
  assert.throws(() => Adapter.createProductionServices({ Compiler }), /raw catalog/i);
  assert.throws(() => Adapter.createProductionServices({ Compiler, catalog: [] }), /raw catalog/i);
  assert.throws(() => Adapter.createProductionServices({ Compiler, catalog: { exercises: [] } }), /raw catalog/i);
});

test("Build starts from a compiler-valid empty manual ProgramDefinition", () => {
  const services = Adapter.createProductionServices({ Compiler, catalog: Catalog });
  const built = services.buildEmptyProgram({ programName: "Manual block", daysPerWeek: 4 });
  assert.equal(built.ok, true, built.code);
  assert.deepEqual(built.preview.program, []);
  assert.equal(built.programDefinition, built.preview.programDefinition);
  assert.equal(built.programDefinition.days.length, 7);
  assert.equal(built.programDefinition.days.filter((day) => day.kind === "training").length, 4);
  assert.ok(built.programDefinition.days.filter((day) => day.kind === "training").every((day) => day.slots.length === 0));
  assert.equal(Compiler.validateProgramDefinition(built.programDefinition, Catalog).ok, true);
  assert.deepEqual(built.preview.programStructure.days.map((day) => day.dayId),
    built.programDefinition.days.filter((day) => day.kind === "training").map((day) => day.id));

  let state = Entry.selectRoute(Entry.createState({
    draftId: "manual-draft",
    activeProgramRevisionAtStart: 0,
    now: "2026-08-27T12:00:00.000Z",
    versions: services.currentVersions(),
  }), "build");
  state = Entry.setAnswers(state, { programName: "Manual block", daysPerWeek: 4 });
  state = Entry.setResult(state, {
    fingerprint: built.fingerprint,
    selected: { id: "manual-build", source: "build" },
    name: built.name,
    preview: built.preview,
  });
  const normalized = Entry.normalizeSetupDraft(state);
  assert.equal(normalized.ok, true, normalized.issues?.join(","));
  assert.deepEqual(normalized.value.result.preview.programDefinition, built.programDefinition);
});

test("adapter fingerprints are deterministic and identity diff remains presentation-only", () => {
  const services = Adapter.createProductionServices({ Compiler, catalog: Catalog });
  assert.equal(services.fingerprint({ b: 2, a: 1 }), services.fingerprint({ a: 1, b: 2 }));
  assert.deepEqual(services.identityDiff(
    [{ libraryId: "exercise.one" }, { libraryId: "exercise.two" }],
    [{ libraryId: "exercise.one" }, { libraryId: "exercise.three" }],
  ), { added: 1, removed: 1, n: 1, total: 2 });
});
