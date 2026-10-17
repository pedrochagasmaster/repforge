#!/usr/bin/env node
// Isolation is needed for malformed JSON, exact identity preimages, bounded
// combinatorics and injected executor/checkpoint races (PL-10 through PL-15).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const Domain = require("../programlab/domain.js");

test("lab snapshots share canonical identity and reject hostile/non-data inputs", () => {
  const source = { z: [-0, "é😀"], a: { b: 2, a: 1 } };
  const text = '{"a":{"a":1,"b":2},"z":[0,"é😀"]}';
  assert.equal(Domain.canonicalJSON(source), text);
  assert.equal(Domain.digest(source), createHash("sha256").update(text).digest("hex"));
  const copy = Domain.snapshot(source);
  source.a.a = 5;
  assert.equal(copy.a.a, 1);
  assert.ok(Object.isFrozen(copy.a));
  assert.throws(() => Domain.snapshot(JSON.parse('{"__proto__":{}}')));
  assert.throws(() => Domain.snapshot({ x: Infinity }));
  let nested = null; for (let i = 0; i < 41; i++) nested = [nested];
  assert.throws(() => Domain.snapshot(nested), /depth/);
  const getter = {}; Object.defineProperty(getter, "x", { enumerable: true, get() { throw Error("executed"); } });
  assert.throws(() => Domain.snapshot(getter), /data|accessor/);
});

const domain = Domain.create({
  normalizePolicy: value => value && Object.keys(value).length === 1 && Number.isInteger(value.dose) && value.dose > 0 && value.dose < 5
    ? { ok: true, value } : { ok: false, issues: [{ path: "dose" }] },
  normalizeRequest: value => ({ ok: true, value }),
  estimateDaySeconds: (day, cycle, policy) => day.slots.length * policy.dose,
  sweepPaths: ["dose"],
});
const configuration = () => ({ experimentId: "experiment", revision: 1, name: "Test", notes: "", mode: "single",
  scenarios: [{ id: "case", name: "Case", request: { goal: "test" }, inputMode: "canonical", answers: null }],
  baselinePolicy: { dose: 3 }, candidatePolicy: { dose: 2 }, referenceTimePolicy: { dose: 3 }, sweep: null });
const build = { runtimeFingerprint: "a".repeat(64), catalogSha256: "b".repeat(64), diagnostics: "lineage-timefit@1" };

test("single/batch/sweep cells share complete identities and immutable inputs", () => {
  const source = configuration(), single = domain.plan(source, build);
  source.candidatePolicy.dose = 4;
  assert.equal(single.cells[1].policy.dose, 2);
  const batch = domain.plan({ ...configuration(), mode: "batch" }, build);
  assert.deepEqual(batch.cells, single.cells);
  const sweep = domain.plan({ ...configuration(), mode: "sweep", sweep: { path: "dose", values: [2, 3, 4] } }, build);
  assert.equal(sweep.cellCount, 3);
  assert.equal(sweep.comparisons.length, 3);
  assert.equal(sweep.cells[1].cellKey, single.cells[1].cellKey);
  assert.notEqual(domain.plan(configuration(), { ...build, runtimeFingerprint: "c".repeat(64) }).cells[0].cellKey, single.cells[0].cellKey);
  assert.throws(() => domain.plan({ ...configuration(), mode: "sweep", sweep: { path: "dose", values: [2, 2] } }, build), /duplicate/i);
  assert.throws(() => domain.plan({ ...configuration(), mode: "sweep", sweep: { path: "__proto__.dose", values: [2] } }, build));
  assert.throws(() => domain.plan({ ...configuration(), mode: "batch", scenarios: Array.from({ length: 201 }, (_, i) => ({ ...configuration().scenarios[0], id: String(i) })) }, build));
  assert.throws(() => domain.plan({ ...configuration(), candidatePolicy: { dose: 8 } }, build));
});

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
test("cancel terminates executor, waits for accepted checkpoint and rejects late outcomes", async () => {
  const checkpoint = deferred(), accepted = deferred(); let disposed = false, calls = 0;
  const runner = Domain.createRunner({ createExecutor: () => ({ generate: async () => { calls++; return { ok: false, value: null, conflicts: [{ code: "fixture" }], explanations: [] }; }, dispose() { disposed = true; } }),
    store: { begin: async () => {}, checkpoint: async () => { accepted.resolve(); await checkpoint.promise; }, finalize: async run => { assert.equal(run.records.length, 1); } } });
  const result = runner.run(domain.plan(configuration(), build), { runId: "run" });
  await accepted.promise;
  const canceled = runner.cancel(); assert.ok(disposed);
  checkpoint.resolve(); await canceled;
  const run = await result;
  assert.equal(run.status, "canceled"); assert.equal(run.completed, 1); assert.equal(calls, 1);
  const late = deferred(), started = deferred();
  const second = Domain.createRunner({ createExecutor: () => ({ generate: () => { started.resolve(); return late.promise; }, dispose() {} }) });
  const pending = second.run(domain.plan(configuration(), build), { runId: "late", allowUnsaved: true });
  await started.promise; await second.cancel();
  late.resolve({ ok: true, value: { days: [] } });
  assert.equal((await pending).completed, 0);
});

test("timeout is an execution error with a fresh executor; initial storage failure never runs silently", async () => {
  let executors = 0;
  const runner = Domain.createRunner({ createExecutor: () => { executors++; return { generate: () => executors === 1 ? new Promise(() => {}) : Promise.resolve({ ok: false, value: null, conflicts: [], explanations: [] }), dispose() {} }; }, cellTimeoutMs: 5 });
  const run = await runner.run(domain.plan(configuration(), build), { runId: "timeout", allowUnsaved: true });
  assert.equal(run.status, "completed"); assert.equal(run.records[0].outcome, "execution_error");
  assert.equal(run.records[0].error.code, "cell_timeout"); assert.equal(executors, 2);
  const broken = Domain.createRunner({ createExecutor: () => { throw Error("must not run"); }, store: { begin: async () => { throw Error("quota"); } } });
  await assert.rejects(broken.run(domain.plan(configuration(), build), { runId: "broken" }), error => error.code === "storage_initialization_failed");
});
