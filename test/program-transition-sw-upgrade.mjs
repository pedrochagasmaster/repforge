#!/usr/bin/env node
/**
 * Plan 052-P7's production-backed upgrade/recovery oracle.
 *
 * The state fixtures are written through the browser's two durable replicas,
 * then read by the released worker and by the current worker after a real
 * service-worker update. This deliberately does not call normalizeLoaded (or
 * any other app internals) directly.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATE_KEY = "repforge_v1";
const DRAFT_KEY = "repforge_draft_v1";
const OLD_WORKER = readFileSync(join(ROOT, "test/fixtures/sw-v120.js"), "utf8");
const CURRENT_WORKER = readFileSync(join(ROOT, "sw.js"), "utf8");
const cacheName = (worker) => worker.match(/const CACHE = ["']([^"']+)["']/)?.[1];
const oldCache = cacheName(OLD_WORKER);
const currentCache = cacheName(CURRENT_WORKER);
assert(oldCache && currentCache && oldCache !== currentCache, "the upgrade fixture has distinct worker generations");

const mimeType = (extension) => ({
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
}[extension] || "application/octet-stream");
const statSafe = (file) => {
  try { return statSync(file); } catch { return null; }
};

let mode = "old";
const server = createServer((request, response) => {
  const pathname = decodeURIComponent((request.url || "/").split("?", 1)[0]);
  if (pathname === "/sw.js") {
    response.writeHead(200, { "content-type": "text/javascript", "cache-control": "no-store" });
    response.end(mode === "old" ? OLD_WORKER : CURRENT_WORKER);
    return;
  }
  const file = normalize(join(ROOT, pathname === "/" ? "index.html" : pathname.slice(1)));
  if (relative(ROOT, file).startsWith("..") || !statSafe(file)?.isFile()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": mimeType(extname(file)), "cache-control": "no-store" });
  createReadStream(file).pipe(response);
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function transitionRecord({ transitionId, predecessorId, successorId, schemaVersion = 1 } = {}) {
  return {
    schemaVersion,
    transitionId,
    kind: "lower_frequency_sibling",
    status: "committed",
    createdAt: "2026-09-01T09:00:00.000Z",
    confirmedAt: "2026-09-01T09:12:00.000Z",
    predecessor: {
      programId: predecessorId,
      fingerprint: "fp-seed-predecessor",
      durableRevision: 8,
      source: "Recommend",
      compilerProvenance: { compilerVersion: 2, catalogueVersion: 1, rulesVersion: 1 },
    },
    diagnosis: {
      kind: "fewer_days",
      answers: { availableDays: 3 },
      eligibleEvidenceIds: ["upgrade-proof-evidence"],
      insufficientEvidenceReasons: [],
    },
    derivation: {
      mode: "recompilation",
      request: "lower-frequency-sibling",
      compilerContextVersions: { compilerVersion: 2, catalogueVersion: 1, rulesVersion: 1 },
      policyVersions: {},
      slotMapping: { contract: "taurifer-transition-slot-mapping", schemaVersion: 1, days: [], slots: [] },
    },
    successor: {
      programId: successorId,
      fingerprint: "fp-seed-successor",
      source: "Recommend",
      compilerProvenance: { compilerVersion: 2, catalogueVersion: 1, rulesVersion: 1 },
    },
    diff: { days: [], exercises: [], prescriptions: [] },
    progressionContract: { preservedRelations: [], resetRelations: [], incompatibilities: [] },
    archiveId: predecessorId,
    proposalHash: "a".repeat(64),
  };
}

function transitionOut(record, schemaVersion = record.schemaVersion) {
  return {
    schemaVersion,
    transitionId: record.transitionId,
    proposalHash: record.proposalHash,
    successorProgramId: record.successor.programId,
  };
}

function stateWithHistory({ transitionIn = null, transitionOut = null, legacy = true } = {}) {
  const predecessorId = "seed-program-previous";
  const program = seedProgram();
  const previousMeta = seedProgramMeta({ id: predecessorId, name: "Previous seed program" });
  const history = [];
  if (transitionOut) {
    history.push({
      id: predecessorId,
      archiveId: predecessorId,
      program: clone(program),
      meta: previousMeta,
      transitionOut: clone(transitionOut),
    });
  }
  if (legacy) {
    history.push({
      id: "legacy-program",
      program: clone(program).slice(0, 2),
      meta: seedProgramMeta({ id: "legacy-program", name: "Legacy seed program" }),
    });
  }
  return {
    settings: {
      jumpPct: 2.5,
      minJump: 2.5,
      rirHigh: 2,
      hardRir: 4,
      restSec: 0,
      lastExport: "",
      unit: "kg",
      lang: "en",
      rirMode: "numeric",
      voiceInputEnabled: false,
      notify: { enabled: false, timer: false, session: false, unfinished: false, missed: false },
    },
    programMeta: seedProgramMeta({ id: "seed-program", transitionIn: transitionIn ? clone(transitionIn) : undefined }),
    program,
    log: [],
    programHistory: history,
    _storageRevision: 8,
  };
}

function supportedState() {
  const record = transitionRecord({
    transitionId: "tr_upgrade_supported_v1",
    predecessorId: "seed-program-previous",
    successorId: "seed-program",
  });
  return {
    state: stateWithHistory({ transitionIn: record, transitionOut: transitionOut(record) }),
    record,
  };
}

function unknownState() {
  const record = transitionRecord({
    transitionId: "tr_upgrade_unknown_v2",
    predecessorId: "seed-program-previous",
    successorId: "seed-program",
    schemaVersion: 2,
  });
  // These are deliberately required-looking fields. A reader that does not
  // understand schema 2 must not turn this into a v1 record or silently drop
  // it while normalizing program metadata/history.
  record.requiredTransitionEnvelope = { schemaVersion: 2, required: true, opaque: "retain-for-recovery" };
  const state = stateWithHistory({
    transitionIn: record,
    transitionOut: transitionOut(record, 2),
  });
  return { state, record };
}

async function putDurableState(page, state) {
  await page.evaluate(async ({ key, draft, value }) => {
    const raw = JSON.stringify(value);
    localStorage.setItem(key, raw);
    localStorage.removeItem(draft);
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("kv")) request.result.createObjectStore("kv");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("kv", "readwrite");
      transaction.objectStore("kv").put(value, key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, { key: STATE_KEY, draft: DRAFT_KEY, value: state });
}

async function readDurableState(page) {
  return page.evaluate(async (key) => {
    const localRaw = localStorage.getItem(key);
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const idb = await new Promise((resolve, reject) => {
      const transaction = db.transaction("kv", "readonly");
      const request = transaction.objectStore("kv").get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return { localRaw, local: localRaw == null ? null : JSON.parse(localRaw), idb };
  }, STATE_KEY);
}

async function installReleasedWorker(page, base) {
  mode = "old";
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base });
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await page.waitForFunction((cache) => caches.has(cache), oldCache, { timeout: 10000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base });
  assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true,
    "the released worker controls the seeded page before upgrade");
}

async function upgradeToCurrent(page, base) {
  mode = "current";
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await page.waitForFunction(async ({ oldCache: oldName, currentCache: currentName }) => {
    const names = await caches.keys();
    return names.includes(currentName) && !names.includes(oldName);
  }, { oldCache, currentCache }, { timeout: 20000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true,
    "a worker controls the page after the update");
  assert.equal(await page.evaluate(() => typeof window.RepForgeProgramTransition), "object",
    "the current shell executes the transition module with the current worker");
}

async function runSupportedUpgrade(browser, base) {
  const context = await browser.newContext({ serviceWorkers: "allow", viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const { state, record } = supportedState();
  try {
    await installReleasedWorker(page, base);
    await putDurableState(page, state);
    await upgradeToCurrent(page, base);
    await waitForAppBoot(page, { base });

    const replicas = await readDurableState(page);
    assert.deepEqual(replicas.local?.programMeta?.transitionIn, record,
      "supported v1 transition-in survives normalizeLoaded and the worker upgrade in localStorage");
    assert.deepEqual(replicas.idb?.programMeta?.transitionIn, record,
      "supported v1 transition-in survives normalizeLoaded and the worker upgrade in IndexedDB");
    const localArchive = replicas.local?.programHistory?.find((entry) => entry.id === "seed-program-previous");
    const idbArchive = replicas.idb?.programHistory?.find((entry) => entry.id === "seed-program-previous");
    assert.deepEqual(localArchive?.transitionOut, transitionOut(record),
      "supported v1 transition-out survives in the outgoing archive in localStorage");
    assert.deepEqual(idbArchive?.transitionOut, transitionOut(record),
      "supported v1 transition-out survives in the outgoing archive in IndexedDB");
    assert.equal(replicas.local?.programHistory?.some((entry) => entry.id === "legacy-program" && !("transitionOut" in entry)), true,
      "legacy history without a transition record remains legacy rather than being fabricated");
    assert.equal(replicas.idb?.programHistory?.some((entry) => entry.id === "legacy-program" && !("transitionOut" in entry)), true,
      "legacy history without a transition record survives in IndexedDB");
    assert.equal(replicas.local?.programMeta?.id, "seed-program", "upgrade keeps the active program identity");
    assert.equal(replicas.idb?.programMeta?.id, "seed-program", "upgrade keeps the active program identity in IndexedDB");
    console.log("supported transition records: current v1 and legacy/no-record history survived both replicas");
  } finally {
    await context.close();
  }
}

async function runUnknownSchemaUpgrade(browser, base) {
  const context = await browser.newContext({ serviceWorkers: "allow", viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const { state } = unknownState();
  const seededRaw = JSON.stringify(state);
  try {
    await installReleasedWorker(page, base);
    await putDurableState(page, state);
    await upgradeToCurrent(page, base);

    let recoveryOpen = false;
    try {
      await page.waitForFunction(() => document.querySelector("#storageRecovery")?.open === true, undefined, { timeout: 5000 });
      recoveryOpen = true;
    } catch {
      // Keep the deliberate red assertion below focused on the missing
      // fail-closed boundary instead of leaking a Playwright timeout.
    }
    assert.equal(recoveryOpen, true,
      "unknown required transition schema opens the existing storage-recovery surface");
    assert.equal(await page.evaluate(() => window.__repforgeBooted === true), false,
      "unknown required transition schema fails closed before app boot completes");
    const replicas = await readDurableState(page);
    assert.equal(replicas.localRaw, seededRaw,
      "unknown transition schema preserves the exact localStorage bytes for recovery/export");
    assert.deepEqual(replicas.idb, state,
      "unknown transition schema preserves the exact IndexedDB object for recovery/export");
    assert.equal(replicas.local?.programMeta?.transitionIn?.schemaVersion, 2,
      "the unknown transition-in schema is not reinterpreted as v1");
    assert.equal(replicas.local?.programHistory?.find((entry) => entry.id === "seed-program-previous")?.transitionOut?.schemaVersion, 2,
      "the unknown transition-out schema is not reinterpreted as v1");
  } finally {
    await context.close();
  }
}

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await launchChromium();
try {
  await runSupportedUpgrade(browser, base);
  await runUnknownSchemaUpgrade(browser, base);
  console.log(`program transition SW upgrade: ${oldCache} -> ${currentCache}; supported v1 + legacy records survive, unknown required schema fails closed with raw recovery evidence`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
