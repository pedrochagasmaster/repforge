#!/usr/bin/env node
// Real IndexedDB at the public store seam. Deterministic transaction aborts,
// duplicate checkpoints and reload recovery require isolation from the app UI.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { launchChromium } from "./browser.mjs";
const browser = await launchChromium();
const context = await browser.newContext();
const page = await context.newPage();
const base = process.env.REPFORGE_URL || "http://localhost:8000/";
try {
  await page.route(new URL("programlab-storage-test.html", base).href, route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Program Lab persistence proof</title>" }));
  await page.goto(new URL("programlab-storage-test.html", base).href);
  for (const file of ["generation-identity.js", "programlab/domain.js", "programlab/store.js", "programlab/archive-worker.js"]) {
    await page.addScriptTag({ content: readFileSync(new URL(`../${file}`, import.meta.url), "utf8") });
  }
  const evidence = await page.evaluate(async () => {
    const D = ProgramLabDomain, S = ProgramLabStore;
    const assert = (condition, message) => { if (!condition) throw Error(message); };
    localStorage.setItem("repforge_v1", "production-sentinel");
    const store = await S.open();
    const experiment = { experimentId: "test", revision: 1, name: "Saved", marker: "immutable" };
    const plan = { experiment, cells: [{ cellKey: "a" }, { cellKey: "b" }], cellCount: 2 };
    const run = { kind: "taurifer-programlab-run", schemaVersion: 1, runId: "first", plan, status: "running", records: [], total: 2, completed: 0, saved: true, error: null };
    await store.begin(experiment, run);
    const cell = { cellKey: "a", outcome: "conflict", result: { ok: false, value: null, conflicts: [], explanations: [] }, error: null };
    await store.checkpoint("first", cell); await store.checkpoint("first", cell);
    assert((await store.loadRun("first")).completed === 1, "duplicate checkpoint cannot double count");
    await store.close();
    const reloaded = await S.open(); await reloaded.recoverInterrupted();
    const savedRuns = await reloaded.listRuns("test", 1);
    assert(savedRuns.length === 1 && savedRuns[0].runId === "first", "saved runs are discoverable after reload without transient UI state");
    const restored = await reloaded.loadRun("first");
    assert(restored.status === "interrupted" && restored.records.length === 1, "reload preserves partial run honestly");
    const unchanged = await reloaded.resolveRevision(experiment);
    assert(unchanged.revision === 1, "identical complete inputs reuse the revision");
    const edited = await reloaded.resolveRevision({ ...experiment, marker: "new immutable input" });
    assert(edited.revision === 2, "dirty inputs receive a new revision");
    await reloaded.saveExperiment(edited);
    assert((await reloaded.loadExperiment("test", 1)).marker === "immutable", "new revisions cannot rewrite previous inputs");
    let failed = false;
    try { await reloaded.begin({ ...experiment, marker: "replacement" }, { ...run, runId: "wrong" }); } catch { failed = true; }
    assert(failed && await reloaded.loadRun("wrong") === null, "revision mismatch aborts initial transaction");
    // Abort after a cell put was enqueued: the actual IDB transaction must roll back
    // both cell record and counter, rather than compensating writes afterwards.
    const live = { ...run, runId: "fault" }; await reloaded.begin(experiment, live);
    const transaction = IDBDatabase.prototype.transaction;
    let inject = true;
    IDBDatabase.prototype.transaction = function (...args) {
      const tx = transaction.apply(this, args);
      if (inject && args[1] === "readwrite" && args[0].includes("cells")) {
        inject = false;
        const objectStore = tx.objectStore.bind(tx);
        tx.objectStore = name => {
          const result = objectStore(name);
          if (name === "cells") { const add = result.add.bind(result); result.add = (...values) => { const request = add(...values); request.addEventListener("success", () => tx.abort()); return request; }; }
          return result;
        };
      }
      return tx;
    };
    failed = false; try { await reloaded.checkpoint("fault", cell); } catch { failed = true; }
    IDBDatabase.prototype.transaction = transaction;
    const untouched = await reloaded.loadRun("fault");
    assert(failed && untouched.completed === 0 && untouched.records.length === 0, "checkpoint failure is atomic");
    assert(localStorage.getItem("repforge_v1") === "production-sentinel", "production storage stays isolated");
    await reloaded.close();
    return { duplicateCheckpoint: true, interruptionRecovery: true, initialAtomicity: true, checkpointAtomicity: true, productionIsolation: true };
  });
  assert.ok(Object.values(evidence).every(Boolean));
  console.log(JSON.stringify(evidence));
  const workerSource = ["generation-identity.js", "programlab/domain.js", "programlab/archive.js", "programlab/archive-worker.js"]
    .map(file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8")).join("\n");
  const workerProof = await page.evaluate(async source => {
    const workerURL = URL.createObjectURL(new Blob([source, `\nProgramLabArchiveWorker.install(context => ProgramLabArchive.create({
      build: context.build, validatePolicy: value => ({ok:true,value}), validateRequest: value => ({ok:true,value}), validateProgram: () => ({ok:true})
    }));`], { type: "text/javascript" }));
    const client = ProgramLabArchiveWorker.createClient({ workerURL });
    const experiment = { experimentId: "worker-source", revision: 1, name: "Worker", notes: "", mode: "single",
      scenarios: [{id:"case", name:"Case", request:{}}], baselinePolicy:{dose:1}, candidatePolicy:{dose:2}, referenceTimePolicy:{dose:1}, sweep:null };
    const context = { build: { runtimeFingerprint: "a".repeat(64), catalogSha256: "b".repeat(64), diagnostics: "allocation-lineage@1" } };
    const parts = await client.exportArchive(experiment, null, context);
    const staged = await client.importArchive(parts.map(part => new File([part.text], part.name)), context);
    const store = await ProgramLabStore.open();
    const imported = await store.importArchive(staged);
    if (imported.experiment.experimentId === experiment.experimentId || imported.experiment.provenance.externalExperimentId !== experiment.experimentId) throw Error("import must mint new local IDs and preserve source provenance");
    const before = await store.listExperiments();
    let rejected = false;
    try { const malformed = JSON.parse(parts[0].text); malformed.experiment.name = "corrupt"; await client.importArchive([JSON.stringify(malformed)], context); }
    catch { rejected = true; }
    if (!rejected || JSON.stringify(before) !== JSON.stringify(await store.listExperiments())) throw Error("corrupted worker validation must not write storage");
    client.dispose(); await store.close(); URL.revokeObjectURL(workerURL);
    return { offThreadValidation: true, importedNewIdentity: true, rejectedWithoutWrites: true };
  }, workerSource);
  console.log(JSON.stringify(workerProof));
} finally { await context.close(); await browser.close(); }
