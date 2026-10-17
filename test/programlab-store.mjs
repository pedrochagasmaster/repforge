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
  for (const file of ["generation-identity.js", "programlab/domain.js", "programlab/store.js"]) {
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
    const restored = await reloaded.loadRun("first");
    assert(restored.status === "interrupted" && restored.records.length === 1, "reload preserves partial run honestly");
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
} finally { await context.close(); await browser.close(); }
