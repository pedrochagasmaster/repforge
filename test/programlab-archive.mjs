#!/usr/bin/env node
// Isolation covers hostile envelopes, hash/reference corruption and resource
// preflight without rendering or writing untrusted records (PL-14/15).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const D = require("../programlab/domain.js"), A = require("../programlab/archive.js");
const build = { runtimeFingerprint: "a".repeat(64), catalogSha256: "b".repeat(64), diagnostics: "allocation-lineage@1" };
const validatePolicy = value => ({ ok: !!value && Object.keys(value).length === 1 && typeof value.dose === "number", value });
const domain = D.create({ normalizePolicy: validatePolicy, normalizeRequest: value => ({ ok: true, value }), sweepPaths: ["dose"] });
const configuration = { experimentId: "source", revision: 1, name: "Archive", notes: "", mode: "batch", scenarios: Array.from({ length: 8 }, (_, index) => ({ id: String(index), name: "Case", request: { index } })), baselinePolicy: { dose: 3 }, candidatePolicy: { dose: 2 }, referenceTimePolicy: { dose: 3 }, sweep: null };
const plan = domain.plan(configuration, build);
const run = { kind: "taurifer-programlab-run", schemaVersion: 1, runId: "source-run", plan, status: "canceled", records: plan.cells.slice(0, 6).map(cell => ({ cellKey: cell.cellKey, outcome: "conflict", result: { ok: false, value: null, conflicts: [{ code: "fixture", message: "saved detail ".repeat(500) }], explanations: [] }, error: null })), completed: 6, total: plan.cellCount, saved: true, error: null };
for (const record of run.records) record.resultJSON = JSON.stringify(record.result);
const archive = A.create({ validatePolicy, validateRequest: value => ({ ok: true, value }), validateProgram: () => ({ ok: true }), build });
test("multipart archives retain canceled completeness and require every exact part", async () => {
  const parts = await archive.exportArchive(plan.experiment, run, { partBytes: 30000 });
  assert.ok(parts.length > 1 && parts.length <= 10);
  const restored = await archive.importArchive(parts.map(part => part.text));
  assert.equal(restored.run.status, "canceled"); assert.equal(restored.run.completed, 6); assert.equal(restored.archived, false);
  assert.deepEqual(restored.run.records, run.records);
  await assert.rejects(archive.importArchive(parts.slice(1).map(part => part.text)), error => error.code === "incomplete_archive");
  await assert.rejects(archive.importArchive([parts[0].text, parts[0].text]), error => error.code === "incomplete_archive");
  const corrupted = parts.map(part => JSON.parse(part.text)); corrupted[0].runs[0].records[0].outcome = "success";
  await assert.rejects(archive.importArchive(corrupted.map(JSON.stringify)), /hash|outcome/i);
  const unknown = JSON.parse(parts[0].text); unknown.workerURL = "https://example.test/code.js";
  await assert.rejects(archive.importArchive([JSON.stringify(unknown)]), /unknown|schema/i);
  await assert.rejects(archive.importArchive([{ size: D.LIMITS.partBytes + 1, text: () => { throw Error("must not read"); } }]), error => error.code === "archive_too_large");
  await assert.rejects(archive.exportArchive(plan.experiment, run, { partBytes: 300 }), error => error.code === "archive_too_large");
});
test("fingerprint mismatch is a readable archive, configuration-only exchange has no records", async () => {
  const parts = await archive.exportArchive(plan.experiment, run);
  const historical = A.create({ validatePolicy, validateRequest: () => { throw Error("historical input must not be revalidated against current catalog"); }, validateProgram: (program, options) => ({ ok: options.archived }), build: { ...build, catalogSha256: "c".repeat(64) } });
  assert.equal((await historical.importArchive(parts.map(part => part.text))).archived, true);
  const config = await archive.importArchive((await archive.exportArchive(plan.experiment, null)).map(part => part.text));
  assert.equal(config.run, null); assert.equal(config.experiment.name, "Archive");
});

function nativeArchiveFixture() {
  const Compiler = require("../program-compiler.js"), Policy = require("../engine-policy.js");
  const Adapter = require("../program-entry-adapter.js"), Catalog = require("../assets/exercise-catalog.json");
  require("../generation-identity.js").prepareCatalog(Catalog);
  const normalizeRequest = value => Compiler.normalizeProgramRequest(value, Catalog);
  const native = D.create({ normalizePolicy: Policy.normalizeEnginePolicy, normalizeRequest });
  const request = Adapter.programRequestFromAnswers({ desiredResult: "muscle_growth", structuredExperience: "6_to_24m",
    daysPerWeek: 4, sessionMinutes: 90, environment: { kind: "commercial_gym" } }, Catalog).value;
  const policy = Policy.getDefaultEnginePolicy();
  const nativePlan = native.plan({ name: "Native archive", notes: "", mode: "single",
    scenarios: [{ id: "case", name: "Case", request }], baselinePolicy: policy,
    candidatePolicy: policy, referenceTimePolicy: policy, sweep: null }, build);
  const result = Compiler.generateProgram(nativePlan.cells[0].request, Catalog, { diagnostics: build.diagnostics });
  assert.equal(result.ok, true);
  const original = { kind: "taurifer-programlab-run", schemaVersion: 1, runId: "native", plan: nativePlan,
    status: "completed", records: [{ cellKey: nativePlan.cells[0].cellKey, outcome: "success",
      result, resultJSON: JSON.stringify(result), error: null }], completed: 1, total: 1, saved: true, error: null };
  const checked = A.create({ validatePolicy: Policy.normalizeEnginePolicy, validateRequest: normalizeRequest,
    validateProgram: program => Compiler.validateProgramDefinition(program, Catalog), build });
  return { Compiler, Policy, Catalog, nativePlan, original, checked, policy };
}

test("successful native archives require complete, typed diagnostic references", () => {
  // These corruptions can carry self-consistent hashes but must be refused
  // before persistence; otherwise the real semantic inspector cannot join slots.
  const { nativePlan, original, checked } = nativeArchiveFixture();
  assert.equal(checked.validateSnapshot(nativePlan.experiment, original), false);
  for (const mutate of [
    result => { delete result.diagnostics; },
    result => { result.diagnostics.slots.pop(); },
    result => { result.diagnostics.slots[0].finalSetCount = "two"; },
    result => { result.diagnostics.slots[0].slotId = "missing-slot"; },
    result => { result.diagnostics.slots[0].exerciseId = "another-exercise"; },
    result => { result.diagnostics.slots[0].finalDayId = "missing-day"; },
    result => { result.diagnostics.slots[0].finalSetCount++; },
    result => { result.diagnostics.terminalStage = "validation"; },
    result => { result.diagnostics.allocation.requestedMinutes = "ninety"; },
    result => { result.diagnostics.allocation.selected.upper.compound[0] = -1; },
    result => { result.diagnostics.allocation.estimatedSecondsByDay[result.diagnostics.slots[0].finalDayId]++; },
  ]) {
    const broken = structuredClone(original);
    mutate(broken.records[0].result);
    broken.records[0].resultJSON = JSON.stringify(broken.records[0].result);
    assert.throws(() => checked.validateSnapshot(nativePlan.experiment, broken), /diagnostic/i);
  }
});

test("real historical programs retain unknown catalog identities without current eligibility or duration claims", async () => {
  const { Compiler, Policy, original, policy } = nativeArchiveFixture();
  const historical = structuredClone(original);
  const historicalId = "historical:exercise-not-in-this-catalog";
  const record = historical.records[0];
  const slot = record.result.value.days.flatMap(day => day.slots)[0];
  slot.exerciseId = historicalId; slot.sourceExerciseIds = [historicalId];
  slot.displayName = "Saved historical exercise label";
  record.result.diagnostics.slots.find(entry => entry.slotId === slot.id).exerciseId = historicalId;
  const request = { ...record.result.value.request, executionContexts: { [historicalId]: "bilateral" } };
  record.result.value.request = request;
  historical.plan.experiment.scenarios[0].request = request;
  historical.plan.build.runtimeFingerprint = "c".repeat(64);
  const cell = historical.plan.cells[0]; cell.request = request;
  cell.cellKey = D.digest({ cellSchemaVersion: 1, runtimeFingerprint: historical.plan.build.runtimeFingerprint,
    catalogSha256: historical.plan.build.catalogSha256, request, policy: cell.policy, diagnostics: cell.diagnostics });
  record.cellKey = cell.cellKey; record.resultJSON = JSON.stringify(record.result);
  for (const comparison of historical.plan.comparisons) {
    comparison.baselineKey = cell.cellKey; comparison.candidateKey = cell.cellKey;
    comparison.comparisonKey = D.digest({ baselineKey: cell.cellKey, candidateKey: cell.cellKey,
      metricsVersion: D.METRICS_VERSION, referenceTimePolicy: policy });
  }
  const reader = A.create({ build, validatePolicy: Policy.normalizeEnginePolicy,
    validateRequest: () => { throw Error("Historical inputs must not be certified against today's catalog"); },
    validateProgram: (program, options) => options.archived ? Compiler.validateProgramDefinitionStructure(program) : { ok: false } });
  const parts = await reader.exportArchive(historical.plan.experiment, historical);
  const restored = await reader.importArchive(parts.map(part => part.text));
  assert.equal(restored.archived, true); assert.equal(restored.exactReplayAvailable, false);
  assert.equal(restored.run.records[0].resultJSON, record.resultJSON);
  assert.equal(restored.run.records[0].result.value.days.flatMap(day => day.slots)[0].displayName, slot.displayName);
  const metricsDomain = D.create({ estimateDaySeconds: () => { throw Error("Historical duration must not use today's catalog"); } });
  const metrics = metricsDomain.metrics(record.result, policy, policy, { archived: true });
  assert.ok(metrics.cycles[0].workingSets > 0);
  assert.equal(metrics.cycles[0].duration.own, null); assert.equal(metrics.cycles[0].duration.common, null);
  assert.equal(metrics.durationUnavailableReason, "archive_fingerprint_mismatch");
  const malformed = structuredClone(historical);
  malformed.records[0].result.value.days.flatMap(day => day.slots)[0].prescriptionsByCycle[0].sets[0].rir = 7;
  malformed.records[0].resultJSON = JSON.stringify(malformed.records[0].result);
  await assert.rejects(reader.exportArchive(malformed.plan.experiment, malformed), /program envelope/);
});
