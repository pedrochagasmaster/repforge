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
  const parts = archive.exportArchive(plan.experiment, run, { partBytes: 30000 });
  assert.ok(parts.length > 1 && parts.length <= 10);
  const restored = await archive.importArchive(parts.map(part => part.text));
  assert.equal(restored.run.status, "canceled"); assert.equal(restored.run.completed, 6); assert.equal(restored.archived, false);
  assert.deepEqual(restored.run.records, run.records);
  await assert.rejects(archive.importArchive(parts.slice(1).map(part => part.text)), error => error.code === "incomplete_archive");
  await assert.rejects(archive.importArchive([parts[0].text, parts[0].text]), /duplicate|incomplete/i);
  const corrupted = parts.map(part => JSON.parse(part.text)); corrupted[0].runs[0].records[0].outcome = "success";
  await assert.rejects(archive.importArchive(corrupted.map(JSON.stringify)), /hash|outcome/i);
  const unknown = JSON.parse(parts[0].text); unknown.workerURL = "https://example.test/code.js";
  await assert.rejects(archive.importArchive([JSON.stringify(unknown)]), /unknown|schema/i);
  await assert.rejects(archive.importArchive([{ size: D.LIMITS.partBytes + 1, text: () => { throw Error("must not read"); } }]), error => error.code === "archive_too_large");
  assert.throws(() => archive.exportArchive(plan.experiment, run, { partBytes: 300 }), error => error.code === "archive_too_large");
});
test("fingerprint mismatch is a readable archive, configuration-only exchange has no records", async () => {
  const parts = archive.exportArchive(plan.experiment, run);
  const historical = A.create({ validatePolicy, validateRequest: () => { throw Error("historical input must not be revalidated against current catalog"); }, validateProgram: (program, options) => ({ ok: options.archived }), build: { ...build, catalogSha256: "c".repeat(64) } });
  assert.equal((await historical.importArchive(parts.map(part => part.text))).archived, true);
  const config = await archive.importArchive(archive.exportArchive(plan.experiment, null).map(part => part.text));
  assert.equal(config.run, null); assert.equal(config.experiment.name, "Archive");
});
