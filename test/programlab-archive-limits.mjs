#!/usr/bin/env node
// Acceptance resource stress, kept separate from the fast correction loop.
// Exercises 200 cases/1000 planned cells and all ten approximately-50-MiB parts.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const D = require("../programlab/domain.js"), A = require("../programlab/archive.js");
const validate = value => ({ ok: true, value });
const build = { runtimeFingerprint: "a".repeat(64), catalogSha256: "b".repeat(64), diagnostics: "allocation-lineage@1" };
const domain = D.create({ normalizePolicy: validate, normalizeRequest: validate, sweepPaths: ["dose"] });
const configuration = { experimentId: "limits", revision: 1, name: "Archive limits", notes: "", mode: "sweep",
  scenarios: Array.from({ length: 200 }, (_, index) => ({ id: String(index), name: "Case", request: { index } })),
  baselinePolicy: { dose: 3 }, candidatePolicy: { dose: 2 }, referenceTimePolicy: { dose: 3 }, sweep: { path: "dose", values: [1, 2, 4, 5] } };
const plan = domain.plan(configuration, build);
assert.equal(plan.cellCount, 1000); assert.equal(plan.caseCount, 200);
const twenty = domain.plan({ ...configuration, scenarios: configuration.scenarios.slice(0, 50), sweep: { path: "dose", values: Array.from({ length: 20 }, (_, index) => index + 1) } }, build);
assert.equal(twenty.cellCount, 1000);
assert.throws(() => domain.plan({ ...configuration, scenarios: configuration.scenarios.slice(0, 51), sweep: { path: "dose", values: Array.from({ length: 20 }, (_, index) => index + 1) } }, build), error => error.code === "cell_limit");
const archive = A.create({ validatePolicy: validate, validateRequest: validate, validateProgram: validate, build, sweepPaths: ["dose"] });
function makeRun(message) {
  const result = { ok: false, value: null, conflicts: [{ code: "retained-detail", message }], explanations: [] };
  const resultJSON = JSON.stringify(result);
  return { kind: "taurifer-programlab-run", schemaVersion: 1, runId: "limits-run", plan,
    status: "canceled", completed: 10, total: 1000, saved: true, error: null,
    records: plan.cells.slice(0, 10).map(cell => ({ cellKey: cell.cellKey, outcome: "conflict", result, resultJSON, error: null })) };
}
const size = value => Buffer.byteLength(D.canonicalJSON(value));
const emptyRun = makeRun("");
const envelope = JSON.parse((await archive.exportArchive(plan.experiment, emptyRun))[0].text);
envelope.transfer.partIndex = 10; envelope.transfer.partCount = 10; envelope.transfer.manifest.partCount = 10;
envelope.transfer.manifest.records.forEach(record => { record.partIndex = 10; });
envelope.runs[0].records = [];
const length = Math.floor((D.LIMITS.partBytes - size(envelope) - size(emptyRun.records[0]) - 2) / 2);
const run = makeRun("x".repeat(length));
const started = performance.now();
const parts = await archive.exportArchive(plan.experiment, run);
assert.equal(parts.length, 10);
const totalBytes = parts.reduce((sum, part) => sum + part.size, 0);
assert.ok(totalBytes > 499 * 1024 * 1024 && totalBytes <= D.LIMITS.totalBytes);
assert.ok(parts.every(part => part.size <= D.LIMITS.partBytes));
const imported = await archive.importArchive(parts.map(part => part.text));
assert.equal(imported.run.records.length, 10); assert.equal(imported.run.total, 1000);
assert.equal(imported.run.status, "canceled");
assert.equal(imported.run.records[0].resultJSON, run.records[0].resultJSON);
await assert.rejects(archive.importArchive(parts.slice(1).map(part => part.text)), error => error.code === "incomplete_archive");
await assert.rejects(archive.exportArchive(plan.experiment, makeRun("x".repeat(D.LIMITS.partBytes))), error => error.code === "archive_too_large");
console.log(JSON.stringify({ plannedCells: 1000, scenarios: 200, sweepValueBoundary: 20, parts: parts.length,
  totalBytes, maxPartBytes: Math.max(...parts.map(part => part.size)), elapsedMs: Math.round(performance.now() - started),
  missingPartRejected: true, oversizedCellRejected: true, rawResultBytesPreserved: true }));
