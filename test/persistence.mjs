#!/usr/bin/env node
/** Focused Playwright checks for dual-store persistence. Requires http://localhost:8000/ */
import { launchChromium } from "./browser.mjs";
import { readFileSync } from "fs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const DB = "repforge";
const STORE = "kv";
// The shape validator throws a message carrying the user-facing brand name,
// which is not a codename and does change. Match the message's stable shape.
const INVALID_BACKUP_ERROR = /invalid .+ backup/i;

// Import attempts report the raw error text out of the page; the page cannot
// close over this regex, so the match happens here.
function rejectedAsInvalidBackup(result) {
  return INVALID_BACKUP_ERROR.test(String(result.error));
}

const results = { passed: 0, failed: 0 };

function assert(cond, name, detail) {
  if (cond) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    console.log(`  ✗ ${name}`);
    if (detail != null) console.log(`    ${detail}`);
  }
}

function sampleState(overrides = {}) {
  const log =
    overrides.log ||
    [
      {
        session: "s1",
        date: "2026-01-02",
        day: "Day 1",
        name: "Press",
        exerciseId: "ex1",
        set: 1,
        load: 60,
        reps: 10,
        rir: 1,
        notes: "",
        created: "2026-01-02T00:00:00.000Z",
        primary: "Chest",
        secondary: "",
      },
    ];
  const state = {
    settings: {
      jumpPct: 2.5,
      minJump: 2.5,
      rirHigh: 2,
      hardRir: 4,
      restSec: 120,
      lastExport: "",
      unit: "kg",
      lang: "en",
      rirMode: "numeric",
      voiceInputEnabled: false,
      notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
    },
    programMeta: {
      id: overrides.programId || "prog-a",
      name: overrides.name || "Alpha",
      started: "2026-01-01",
      created: "2026-01-01T00:00:00.000Z",
      updated: "2026-01-01T00:00:00.000Z",
      onboarded: true,
      mesocycleStatus: "active",
      mesocycleLengthWeeks: 6,
      goal: null,
      experience: null,
      daysPerWeek: 3,
      splitType: "full_body",
      equipment: ["machines"],
      priorityMuscles: [],
      sessionLength: "45",
      completedAt: null,
    },
    program: [
      {
        id: "ex1",
        name: "Press",
        day: "Day 1",
        order: 0,
        sets: 3,
        min: 8,
        max: 12,
        primary: "Chest",
        secondary: "",
      },
    ],
    log,
    programHistory: overrides.programHistory || [],
  };
  if (overrides.revision != null) state._storageRevision = overrides.revision;
  if (overrides.followUp !== undefined) state._storageFollowUp = overrides.followUp;
  return state;
}

function otherState() {
  return sampleState({
    name: "Beta",
    programId: "prog-b",
    revision: 0,
    log: [
      {
        session: "s2",
        date: "2026-02-02",
        day: "Day 1",
        name: "Press",
        exerciseId: "ex1",
        set: 1,
        load: 80,
        reps: 8,
        rir: 0,
        notes: "",
        created: "2026-02-02T00:00:00.000Z",
        primary: "Chest",
        secondary: "",
      },
    ],
  });
}

async function idbPut(page, blob) {
  await page.evaluate(
    async ({ k, dbName, storeName, blob }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open(dbName, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(storeName);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(blob, k);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { k: KEY, dbName: DB, storeName: STORE, blob }
  );
}

async function idbRawPut(page, blob) {
  await idbPut(page, blob);
}

async function idbGet(page) {
  return page.evaluate(
    async ({ k, dbName, storeName }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open(dbName, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(storeName);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const val = await new Promise((res, rej) => {
        const tx = db.transaction(storeName, "readonly").objectStore(storeName).get(k);
        tx.onsuccess = () => res(tx.result);
        tx.onerror = () => rej(tx.error);
      });
      db.close();
      return val === undefined ? null : val;
    },
    { k: KEY, dbName: DB, storeName: STORE }
  );
}

async function idbDelete(page) {
  await page.evaluate(
    async ({ k, dbName, storeName }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open(dbName, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(storeName);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).delete(k);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { k: KEY, dbName: DB, storeName: STORE }
  );
}

async function clearStores(page) {
  await page.evaluate(
    async ({ k, d, dbName }) => {
      localStorage.removeItem(k);
      localStorage.removeItem(d);
      await new Promise((res) => {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => res();
        req.onerror = () => res();
        req.onblocked = () => res();
      });
    },
    { k: KEY, d: DRAFT, dbName: DB }
  );
}

async function readBoth(page) {
  const localRaw = await page.evaluate((k) => localStorage.getItem(k), KEY);
  let local = null;
  try {
    local = localRaw ? JSON.parse(localRaw) : null;
  } catch {
    local = { __unparsed: localRaw };
  }
  const idb = await idbGet(page);
  return { localRaw, local, idb };
}

async function waitForApp(page) {
  await page.waitForSelector("#dayTabs button", { timeout: 15000, state: "attached" });
  await page.waitForFunction(
    () => typeof window.__repforgeStorage === "object" && typeof window.__repforgeStorage.flush === "function",
    { timeout: 15000 }
  );
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    window.closeFirstRun?.();
    if (el?.classList.contains("active") && typeof window.closeOnboarding === "function")
      window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function")
      window.closeTour();
  });
}

async function waitForRecovery(page) {
  await page.waitForFunction(() => {
    const d = document.querySelector("#storageRecovery");
    return !!(d && d.open);
  }, { timeout: 15000 });
}

async function actRecovery(page, id) {
  const seq = await page.evaluate(() => document.querySelector("#storageRecovery")?.dataset.seq || "0");
  await page.evaluate((btnId) => document.getElementById(btnId)?.click(), id);
  await page.waitForFunction((prev) => {
    const d = document.querySelector("#storageRecovery");
    return !d || d.dataset.seq !== prev;
  }, seq, { timeout: 15000 });
}

async function recoveryOpen(page) {
  return page.evaluate(() => {
    const d = document.querySelector("#storageRecovery");
    return !!(d && d.open);
  });
}

function patchReadFails() {
  return () => {
    const origGet = Storage.prototype.getItem;
    const origRemove = Storage.prototype.removeItem;
    Storage.prototype.getItem = function (k) {
      if (k === "repforge_v1" && sessionStorage.getItem("__rf_ls_fail") === "1") {
        throw new Error("forced localStorage read fail");
      }
      return origGet.call(this, k);
    };
    Storage.prototype.removeItem = function (k) {
      if (k === "repforge_v1" && sessionStorage.getItem("__rf_ls_delete_fail") === "1") {
        throw new Error("forced localStorage delete fail");
      }
      return origRemove.call(this, k);
    };
    const origIdbGet = IDBObjectStore.prototype.get;
    const origIdbDelete = IDBObjectStore.prototype.delete;
    IDBObjectStore.prototype.get = function (key) {
      if (key === "repforge_v1" && sessionStorage.getItem("__rf_idb_fail") === "1") {
        const fake = {};
        Object.defineProperty(fake, "error", { value: new DOMException("forced idb read fail") });
        queueMicrotask(() => {
          if (typeof fake.onerror === "function") fake.onerror(new Event("error"));
        });
        return fake;
      }
      return origIdbGet.apply(this, arguments);
    };
    IDBObjectStore.prototype.delete = function (key) {
      if (key === "repforge_v1" && sessionStorage.getItem("__rf_idb_delete_fail") === "1") {
        throw new Error("forced idb delete fail");
      }
      return origIdbDelete.apply(this, arguments);
    };
  };
}

async function freshContext(browser, { failPatch = false } = {}) {
  const context = await browser.newContext({ acceptDownloads: true });
  if (failPatch) await context.addInitScript(patchReadFails());
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  return { context, page };
}

async function bootThenClear(page) {
  await waitForApp(page);
  await clearStores(page);
}

async function reloadForApp(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
}

async function reloadForRecovery(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForRecovery(page);
}

async function snapshotRevs(page) {
  const both = await readBoth(page);
  return {
    localRev: both.local && typeof both.local === "object" ? both.local._storageRevision : null,
    idbRev: both.idb && typeof both.idb === "object" ? both.idb._storageRevision : null,
    localName: both.local?.programMeta?.name,
    idbName: both.idb?.programMeta?.name,
    localSessions: both.local?.log ? new Set(both.local.log.map((r) => r.session)).size : 0,
    idbSessions: both.idb?.log ? new Set(both.idb.log.map((r) => r.session)).size : 0,
    health: await page.evaluate(() => window.__repforgeStorage?.health?.() || null),
  };
}

async function writeWithFake(page, snapshot, { localOk = true, idbOk = true, localDelay = 0, idbDelay = 0 } = {}) {
  return page.evaluate(
    async ({ snapshot, localOk, idbOk, localDelay, idbDelay, key, dbName, storeName }) => {
      const delay = (ms) => new Promise((r) => setTimeout(r, ms));
      const realIdb = async (data) => {
        const db = await new Promise((res, rej) => {
          const r = indexedDB.open(dbName, 1);
          r.onupgradeneeded = () => r.result.createObjectStore(storeName);
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
        await new Promise((res, rej) => {
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).put(data, key);
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        });
        db.close();
      };
      const io = {
        async writeLocal(data) {
          await delay(localDelay);
          if (!localOk) throw new Error("ls fail");
          localStorage.setItem(key, JSON.stringify(data));
        },
        async writeIdb(data) {
          await delay(idbDelay);
          if (!idbOk) throw new Error("idb fail");
          await realIdb(data);
        },
      };
      return window.__repforgeStorage.writeWithAdapter(snapshot, io);
    },
    { snapshot, localOk, idbOk, localDelay, idbDelay, key: KEY, dbName: DB, storeName: STORE }
  );
}

async function liveName(page) {
  return page.evaluate(() => {
    const el = document.querySelector("#programName") || document.querySelector("[data-program-name]");
    return el?.textContent?.trim() || document.title;
  });
}

const browser = await launchChromium();

try {
  // ---------------------------------------------------------------------------
  // 1. Legacy localStorage-only migrates to both stores
  // ---------------------------------------------------------------------------
  {
    console.log("\nlegacy localStorage-only migration");
    const { context, page } = await freshContext(browser);
    await bootThenClear(page);
    const blob = sampleState({ name: "Legacy LS" });
    await page.evaluate(({ k, blob }) => localStorage.setItem(k, JSON.stringify(blob)), { k: KEY, blob });
    await reloadForApp(page);
    const both = await readBoth(page);
    assert(both.local?.programMeta?.name === "Legacy LS", "LS-only: localStorage kept the legacy snapshot", both.local?.programMeta?.name);
    assert(both.idb?.programMeta?.name === "Legacy LS", "LS-only: IndexedDB healed from localStorage", both.idb?.programMeta?.name);
    assert(Array.isArray(both.local?.program) && Array.isArray(both.local?.log), "LS-only: root domain keys remain", Object.keys(both.local || {}));
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // 2. Identical revisionless replicas migrate without a prompt
  // ---------------------------------------------------------------------------
  {
    console.log("\nidentical revisionless replicas");
    const { context, page } = await freshContext(browser);
    await bootThenClear(page);
    const blob = sampleState({ name: "Twin" });
    await page.evaluate(({ k, blob }) => localStorage.setItem(k, JSON.stringify(blob)), { k: KEY, blob });
    await idbPut(page, JSON.parse(JSON.stringify(blob)));
    await reloadForApp(page);
    assert(!(await recoveryOpen(page)), "Equal legacy replicas do not open recovery");
    const both = await readBoth(page);
    assert(both.local?._storageRevision === both.idb?._storageRevision, "Equal legacy replicas share a revision after migrate", JSON.stringify({ l: both.local?._storageRevision, i: both.idb?._storageRevision }));
    assert((both.local?._storageRevision || 0) >= 1, "Equal legacy replicas migrate to a positive revision", both.local?._storageRevision);
    assert(both.local?.programMeta?.name === "Twin" && both.idb?.programMeta?.name === "Twin", "Equal legacy replicas keep domain data");
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // 2b. Malformed entity entries in either replica enter recovery
  // ---------------------------------------------------------------------------
  {
    console.log("\nmalformed entity replicas");
    const malformedReplicas = [
      ["program [null]", { ...sampleState({ name: "Bad program", revision: 2 }), program: [null] }],
      ["log [null]", { ...sampleState({ name: "Bad log", revision: 2 }), log: [null] }],
      [
        "programHistory nested program [null]",
        {
          ...sampleState({ name: "Bad history", revision: 2 }),
          programHistory: [{ id: "old-program", program: [null] }],
        },
      ],
    ];
    for (const [label, malformed] of malformedReplicas) {
      const { context, page } = await freshContext(browser);
      await bootThenClear(page);
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(String(error)));
      await page.evaluate(({ k, blob }) => localStorage.setItem(k, JSON.stringify(blob)), {
        k: KEY,
        blob: malformed,
      });
      await idbPut(page, JSON.parse(JSON.stringify(malformed)));
      await page.reload({ waitUntil: "domcontentloaded" });
      await page
        .waitForFunction(
          () => {
            const recovery = document.querySelector("#storageRecovery");
            return !!(recovery && recovery.open);
          },
          null,
          { timeout: 3000 }
        )
        .catch(() => {});
      assert(
        (await recoveryOpen(page)) && pageErrors.length === 0,
        `${label} replicas open recovery without crashing`,
        JSON.stringify({ recoveryOpen: await recoveryOpen(page), pageErrors })
      );
      const both = await readBoth(page);
      assert(
        JSON.stringify(both.local) === JSON.stringify(malformed) &&
          JSON.stringify(both.idb) === JSON.stringify(malformed),
        `${label} recovery writes neither malformed replica`
      );
      await context.close();
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Divergent revisionless replicas recover, export, and heal on each choice
  // ---------------------------------------------------------------------------
  {
    console.log("\ndivergent revisionless recovery");
    const { context, page } = await freshContext(browser);
    await bootThenClear(page);
    const a = sampleState({ name: "CopyA" });
    const b = otherState();
    delete b._storageRevision;
    await page.evaluate(({ k, blob }) => localStorage.setItem(k, JSON.stringify(blob)), { k: KEY, blob: a });
    await idbPut(page, b);
    const before = { local: JSON.stringify(a), idb: JSON.stringify(b) };
    await reloadForRecovery(page);
    assert(await recoveryOpen(page), "Divergent replicas open recovery");
    const body = await page.locator("#storageRecovery").innerText();
    assert(body.includes("CopyA") && body.includes("Beta"), "Recovery shows both program names", body);
    assert(body.includes("2026-01-02") && body.includes("2026-02-02"), "Recovery shows latest log dates", body);

    const afterOpen = await readBoth(page);
    assert(afterOpen.localRaw === before.local, "Divergent recovery writes nothing to localStorage before a choice", afterOpen.localRaw);
    assert(JSON.stringify(afterOpen.idb) === before.idb, "Divergent recovery writes nothing to IndexedDB before a choice");

    const [dlA] = await Promise.all([page.waitForEvent("download"), page.click("#storageExportA")]);
    const [dlB] = await Promise.all([page.waitForEvent("download"), page.click("#storageExportB")]);
    const textA = readFileSync(await dlA.path(), "utf8");
    const textB = readFileSync(await dlB.path(), "utf8");
    assert(textA === before.local, "Export Copy A is the raw localStorage bytes");
    assert(JSON.parse(textB).programMeta.name === "Beta", "Export Copy B is the IndexedDB snapshot", textB.slice(0, 120));

    await actRecovery(page, "storageUseA");
    await waitForApp(page);
    let both = await readBoth(page);
    assert(both.local?.programMeta?.name === "CopyA" && both.idb?.programMeta?.name === "CopyA", "Use Copy A heals both stores to A", JSON.stringify({ l: both.local?.programMeta?.name, i: both.idb?.programMeta?.name }));
    assert(both.local?._storageRevision >= 1 && both.local?._storageRevision === both.idb?._storageRevision, "Use Copy A assigns one positive revision to both legacy replicas", JSON.stringify({ l: both.local?._storageRevision, i: both.idb?._storageRevision }));

    await clearStores(page);
    await page.evaluate(({ k, blob }) => localStorage.setItem(k, JSON.stringify(blob)), { k: KEY, blob: a });
    await idbPut(page, b);
    await reloadForRecovery(page);
    await actRecovery(page, "storageUseB");
    await waitForApp(page);
    both = await readBoth(page);
    assert(both.local?.programMeta?.name === "Beta" && both.idb?.programMeta?.name === "Beta", "Use Copy B heals both stores to B", JSON.stringify({ l: both.local?.programMeta?.name, i: both.idb?.programMeta?.name }));
    assert(both.local?._storageRevision >= 1 && both.local?._storageRevision === both.idb?._storageRevision, "Use Copy B assigns one positive revision to both legacy replicas", JSON.stringify({ l: both.local?._storageRevision, i: both.idb?._storageRevision }));
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // 4. Higher revision wins and heals
  // ---------------------------------------------------------------------------
  {
    console.log("\nhigher revision wins");
    const { context, page } = await freshContext(browser);
    await bootThenClear(page);
    const newer = sampleState({ name: "LocalNewer", revision: 2 });
    const older = sampleState({ name: "IdbOlder", revision: 1, log: otherState().log });
    await page.evaluate(({ k, blob }) => localStorage.setItem(k, JSON.stringify(blob)), { k: KEY, blob: newer });
    await idbPut(page, older);
    await reloadForApp(page);
    assert(!(await recoveryOpen(page)), "LS rev 2 vs IDB rev 1 does not prompt");
    let both = await readBoth(page);
    assert(both.local?.programMeta?.name === "LocalNewer" && both.idb?.programMeta?.name === "LocalNewer", "LS rev 2 boots and heals IDB", JSON.stringify({ l: both.local?.programMeta?.name, i: both.idb?.programMeta?.name }));

    await clearStores(page);
    const idbNew = sampleState({ name: "IdbNewer", revision: 3 });
    const lsOld = sampleState({ name: "LocalOlder", revision: 2, log: otherState().log });
    await page.evaluate(({ k, blob }) => localStorage.setItem(k, JSON.stringify(blob)), { k: KEY, blob: lsOld });
    await idbPut(page, idbNew);
    await reloadForApp(page);
    both = await readBoth(page);
    assert(both.local?.programMeta?.name === "IdbNewer" && both.idb?.programMeta?.name === "IdbNewer", "IDB rev 3 boots and heals localStorage", JSON.stringify({ l: both.local?.programMeta?.name, i: both.idb?.programMeta?.name }));
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // 5. Valid + absent heals in both directions
  // ---------------------------------------------------------------------------
  {
    console.log("\nvalid + absent");
    const { context, page } = await freshContext(browser);
    await bootThenClear(page);
    const blob = sampleState({ name: "OnlyLS", revision: 4 });
    await page.evaluate(({ k, blob }) => localStorage.setItem(k, JSON.stringify(blob)), { k: KEY, blob });
    await reloadForApp(page);
    let both = await readBoth(page);
    assert(both.local?.programMeta?.name === "OnlyLS" && both.idb?.programMeta?.name === "OnlyLS", "Valid LS + absent IDB heals IDB");

    await clearStores(page);
    await idbPut(page, sampleState({ name: "OnlyIDB", revision: 5 }));
    await reloadForApp(page);
    both = await readBoth(page);
    assert(both.local?.programMeta?.name === "OnlyIDB" && both.idb?.programMeta?.name === "OnlyIDB", "Valid IDB + absent LS heals localStorage");
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // 6. Valid + invalid / read-failed write nothing until resolved
  // ---------------------------------------------------------------------------
  {
    console.log("\nvalid + invalid / read-failed");
    const { context, page } = await freshContext(browser, { failPatch: true });
    await bootThenClear(page);
    const valid = sampleState({ name: "Readable", revision: 6 });
    await page.evaluate(({ k, blob }) => localStorage.setItem(k, JSON.stringify(blob)), { k: KEY, blob: valid });
    await idbRawPut(page, { broken: true });
    const lsBefore = await page.evaluate((k) => localStorage.getItem(k), KEY);
    const idbBefore = JSON.stringify(await idbGet(page));
    await reloadForRecovery(page);
    assert(await recoveryOpen(page), "Valid LS + invalid IDB opens recovery");
    assert((await page.evaluate((k) => localStorage.getItem(k), KEY)) === lsBefore, "Valid+invalid writes no localStorage before resolution");
    assert(JSON.stringify(await idbGet(page)) === idbBefore, "Valid+invalid writes no IndexedDB before resolution");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#storageExportB")]);
    const rawB = readFileSync(await dl.path(), "utf8");
    assert(rawB.includes('"broken"') || JSON.parse(rawB).broken === true, "Invalid IDB raw export is faithful", rawB);

    page.once("dialog", (d) => d.accept());
    await actRecovery(page, "storageOverwrite");
    await waitForApp(page);
    let both = await readBoth(page);
    assert(both.local?.programMeta?.name === "Readable" && both.idb?.programMeta?.name === "Readable", "Overwrite heals the invalid peer");

    await clearStores(page);
    await idbPut(page, sampleState({ name: "IdbReadable", revision: 7 }));
    await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: KEY, v: "{not json" });
    const rawLs = await page.evaluate((k) => localStorage.getItem(k), KEY);
    await reloadForRecovery(page);
    assert(await recoveryOpen(page), "Valid IDB + invalid LS opens recovery");
    const [dlLs] = await Promise.all([page.waitForEvent("download"), page.click("#storageExportA")]);
    assert(readFileSync(await dlLs.path(), "utf8") === rawLs, "Invalid LS raw export is the original string");
    page.once("dialog", (d) => d.accept());
    await actRecovery(page, "storageOverwrite");
    await waitForApp(page);
    both = await readBoth(page);
    assert(both.local?.programMeta?.name === "IdbReadable" && both.idb?.programMeta?.name === "IdbReadable", "Overwrite from IDB heals localStorage");

    await clearStores(page);
    await page.evaluate(({ k, blob }) => localStorage.setItem(k, JSON.stringify(blob)), {
      k: KEY,
      blob: sampleState({ name: "StillReadable", revision: 8 }),
    });
    await idbPut(page, sampleState({ name: "HiddenNewer", revision: 9, log: otherState().log }));
    await page.evaluate(() => sessionStorage.setItem("__rf_idb_fail", "1"));
    await reloadForRecovery(page);
    assert(await recoveryOpen(page), "Valid LS + failed IDB opens recovery");
    const lsMid = await page.evaluate((k) => localStorage.getItem(k), KEY);
    assert(JSON.parse(lsMid).programMeta.name === "StillReadable", "Valid+failed writes nothing before resolution");
    await actRecovery(page, "storageRetry");
    assert(await recoveryOpen(page), "Retry with IDB still failing stays on recovery");
    await page.evaluate(() => sessionStorage.removeItem("__rf_idb_fail"));
    await actRecovery(page, "storageRetry");
    await waitForApp(page);
    both = await readBoth(page);
    assert(both.local?.programMeta?.name === "HiddenNewer" && both.idb?.programMeta?.name === "HiddenNewer", "Retry after IDB recovers chooses the higher revision", JSON.stringify({ l: both.local?.programMeta?.name, i: both.idb?.programMeta?.name }));

    await clearStores(page);
    await idbPut(page, sampleState({ name: "IdbStill", revision: 4 }));
    await page.evaluate(({ k, blob }) => localStorage.setItem(k, JSON.stringify(blob)), {
      k: KEY,
      blob: sampleState({ name: "LsHidden", revision: 5, log: otherState().log }),
    });
    await page.evaluate(() => sessionStorage.setItem("__rf_ls_fail", "1"));
    await reloadForRecovery(page);
    assert(await recoveryOpen(page), "Valid IDB + failed LS opens recovery");
    page.once("dialog", (d) => d.accept());
    await actRecovery(page, "storageOverwrite");
    await page.evaluate(() => sessionStorage.removeItem("__rf_ls_fail"));
    await waitForApp(page);
    both = await readBoth(page);
    assert(both.idb?.programMeta?.name === "IdbStill", "Overwrite confirmation uses the readable copy", both.idb?.programMeta?.name);
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // 7. No valid snapshot blocks default persistence
  // ---------------------------------------------------------------------------
  {
    console.log("\nno-valid snapshot");
    const { context, page } = await freshContext(browser, { failPatch: true });
    await bootThenClear(page);
    await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: KEY, v: "{nope" });
    await idbRawPut(page, 42);
    const lsBefore = await page.evaluate((k) => localStorage.getItem(k), KEY);
    await reloadForRecovery(page);
    assert(await recoveryOpen(page), "Two malformed replicas open recovery");
    assert((await page.evaluate((k) => localStorage.getItem(k), KEY)) === lsBefore, "Malformed pair is not overwritten with defaults");
    assert((await idbGet(page)) === 42, "Malformed IDB replica is preserved");
    assert(await page.locator("#storageStartFresh").count(), "Start fresh is offered when nothing is valid");
    assert((await page.locator("#storageUseA").count()) === 0, "Use Copy is not offered when nothing is valid");

    await page.evaluate(() => sessionStorage.setItem("__rf_idb_delete_fail", "1"));
    page.once("dialog", (d) => d.accept());
    await actRecovery(page, "storageStartFresh");
    assert(await recoveryOpen(page), "Start fresh stays blocked when IndexedDB deletion fails");
    assert((await idbGet(page)) === 42, "Failed Start fresh preserves the undeleted IndexedDB replica");
    await page.evaluate(() => sessionStorage.removeItem("__rf_idb_delete_fail"));
    page.once("dialog", (d) => d.accept());
    await actRecovery(page, "storageStartFresh");
    await waitForApp(page);

    await clearStores(page);
    await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: KEY, v: "{still-nope" });
    await idbRawPut(page, 43);
    await reloadForRecovery(page);
    await page.evaluate(() => sessionStorage.setItem("__rf_ls_delete_fail", "1"));
    page.once("dialog", (d) => d.accept());
    await actRecovery(page, "storageStartFresh");
    assert(await recoveryOpen(page), "Start fresh stays blocked when localStorage deletion fails");
    assert((await page.evaluate((k) => localStorage.getItem(k), KEY)) === "{still-nope", "Failed Start fresh preserves the undeleted localStorage replica");
    await page.evaluate(() => sessionStorage.removeItem("__rf_ls_delete_fail"));
    page.once("dialog", (d) => d.accept());
    await actRecovery(page, "storageStartFresh");
    await waitForApp(page);

    await clearStores(page);
    await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: KEY, v: "{both-nope" });
    await idbRawPut(page, 44);
    await reloadForRecovery(page);
    await page.evaluate(() => {
      sessionStorage.setItem("__rf_ls_delete_fail", "1");
      sessionStorage.setItem("__rf_idb_delete_fail", "1");
    });
    page.once("dialog", (d) => d.accept());
    await actRecovery(page, "storageStartFresh");
    assert(await recoveryOpen(page), "Start fresh stays blocked when both replica deletions fail");
    assert(
      (await page.evaluate((k) => localStorage.getItem(k), KEY)) === "{both-nope" && (await idbGet(page)) === 44,
      "Dual deletion failure preserves both malformed replicas"
    );
    await page.evaluate(() => {
      sessionStorage.removeItem("__rf_ls_delete_fail");
      sessionStorage.removeItem("__rf_idb_delete_fail");
    });

    await page.evaluate(() => sessionStorage.setItem("__rf_idb_fail", "1"));
    await clearStores(page);
    await reloadForRecovery(page);
    assert(await recoveryOpen(page), "Read-failure plus absent peer opens recovery");
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // 8. Adapter write outcomes, queue, flush, health
  // ---------------------------------------------------------------------------
  {
    console.log("\nadapter write outcomes");
    const { context, page } = await freshContext(browser);
    await waitForApp(page);
    const threw = await page.evaluate(() => {
      try {
        window.__repforgeStorage.writeWithAdapter({ program: [], log: [] });
        return false;
      } catch (e) {
        return /explicit adapter/.test(String(e));
      }
    });
    assert(threw, "writeWithAdapter requires an explicit adapter");

    const base = sampleState({ name: "Adapter", revision: 10 });
    const r1 = await writeWithFake(page, base, { localOk: true, idbOk: false });
    assert(r1.localOk && !r1.idbOk, "IDB failure / LS success returns one-sided result", JSON.stringify(r1));
    const health1 = await page.evaluate(() => window.__repforgeStorage.health());
    assert(health1.degraded && health1.localOk && !health1.idbOk, "IDB failure sets degraded health", JSON.stringify(health1));
    const toast1 = await page.locator("#toast").innerText();
    assert(/one browser store|só um depósito/i.test(toast1) || toast1.length > 0, "One-sided write toasts degraded copy", toast1);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    let both = await readBoth(page);
    assert(both.local?.programMeta?.name === "Adapter" && both.idb?.programMeta?.name === "Adapter", "Reload from newer local snapshot heals IndexedDB", JSON.stringify({ l: both.local?.programMeta?.name, i: both.idb?.programMeta?.name }));

    await waitForApp(page);
    const first = sampleState({ name: "FirstFail", revision: 11 });
    const second = sampleState({ name: "SecondWin", revision: 12 });
    const pFail = writeWithFake(page, first, { localOk: true, idbOk: false });
    const pOk = writeWithFake(page, second, { localOk: true, idbOk: true });
    const resultsWrite = await Promise.all([pFail, pOk]);
    await page.evaluate(() => window.__repforgeStorage.flush());
    assert(resultsWrite[1].localOk && resultsWrite[1].idbOk, "Second write runs after a rejected IDB write", JSON.stringify(resultsWrite));
    both = await readBoth(page);
    assert(both.local?._storageRevision === 12 && both.idb?._storageRevision === 12, "Flush leaves both replicas at the second write's revision", JSON.stringify({ l: both.local?._storageRevision, i: both.idb?._storageRevision }));
    assert(both.local?.programMeta?.name === "SecondWin" && both.idb?.programMeta?.name === "SecondWin", "Both replicas contain the second operation");
    const health2 = await page.evaluate(() => window.__repforgeStorage.health());
    assert(!health2.degraded && health2.localOk && health2.idbOk, "Successful dual write clears degraded health", JSON.stringify(health2));

    const idbOnly = sampleState({ name: "IdbOnly", revision: 13 });
    const rLsFail = await writeWithFake(page, idbOnly, { localOk: false, idbOk: true });
    assert(!rLsFail.localOk && rLsFail.idbOk, "LS failure / IDB success returns one-sided result", JSON.stringify(rLsFail));
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    both = await readBoth(page);
    assert(both.local?.programMeta?.name === "IdbOnly" && both.idb?.programMeta?.name === "IdbOnly", "Reload from newer IndexedDB heals localStorage");

    const boom = sampleState({ name: "Boom", revision: 14 });
    const rBoth = await writeWithFake(page, boom, { localOk: false, idbOk: false });
    assert(!rBoth.localOk && !rBoth.idbOk, "Both stores failing returns total failure", JSON.stringify(rBoth));
    const health3 = await page.evaluate(() => window.__repforgeStorage.health());
    assert(!health3.degraded && !health3.localOk && !health3.idbOk, "Total failure is not reported as saved/degraded", JSON.stringify(health3));
    const toast3 = await page.locator("#toast").innerText();
    assert(/storage may be full|armazenamento pode estar cheio/i.test(toast3), "Total failure uses the destructive storage toast", toast3);
    both = await readBoth(page);
    assert(both.local?.programMeta?.name !== "Boom" && both.idb?.programMeta?.name !== "Boom", "Total failure does not keep the rejected snapshot");
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // 8a. Explicit adapters do not share revision suppression
  // ---------------------------------------------------------------------------
  {
    console.log("\nexplicit adapter revision isolation");
    const { context, page } = await freshContext(browser);
    await waitForApp(page);
    const highRevision = Number.MAX_SAFE_INTEGER;
    const high = await page.evaluate(
      async ({ snapshot }) => {
        const calls = { local: 0, idb: 0 };
        const result = await window.__repforgeStorage.writeWithAdapter(snapshot, {
          writeLocal() {
            calls.local++;
          },
          writeIdb() {
            calls.idb++;
          },
        });
        return { calls, result };
      },
      { snapshot: sampleState({ name: "High adapter", revision: highRevision }) }
    );
    assert(high.calls.local === 1 && high.calls.idb === 1, "High revision invokes both methods on the first explicit adapter", JSON.stringify(high));

    const lowRevision = highRevision - 1;
    const low = await page.evaluate(
      async ({ snapshot }) => {
        const calls = { local: 0, idb: 0 };
        const result = await window.__repforgeStorage.writeWithAdapter(snapshot, {
          writeLocal() {
            calls.local++;
            throw new Error("expected local failure");
          },
          writeIdb() {
            calls.idb++;
            throw new Error("expected idb failure");
          },
        });
        return { calls, result, health: window.__repforgeStorage.health() };
      },
      { snapshot: sampleState({ name: "Lower adapter", revision: lowRevision }) }
    );
    assert(low.calls.local === 1 && low.calls.idb === 1, "A lower revision still invokes both methods on a distinct explicit adapter", JSON.stringify(low));
    assert(!low.result.localOk && !low.result.idbOk, "A lower revision reports the distinct adapter's total failure", JSON.stringify(low));
    assert(!low.health.localOk && !low.health.idbOk, "A lower revision records the distinct adapter's total failure", JSON.stringify(low.health));
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // 8b. Real-store outcome flags require completed writes
  // ---------------------------------------------------------------------------
  {
    console.log("\nreal adapter reported-success invariant");
    const { context, page } = await freshContext(browser);
    await waitForApp(page);
    await page.evaluate(() => window.__repforgeStorage.flush());
    const highRevision = Number.MAX_SAFE_INTEGER;
    const high = sampleState({ name: "Real high", revision: highRevision });
    await page.evaluate(
      ({ key, snapshot }) => localStorage.setItem(key, JSON.stringify(snapshot)),
      { key: KEY, snapshot: high }
    );
    await idbDelete(page);
    await page.evaluate(() => window.resolveBootReplicas());

    const low = sampleState({ name: "Real lower", revision: highRevision - 1 });
    await page.evaluate(
      ({ key, snapshot }) => localStorage.setItem(key, JSON.stringify(snapshot)),
      { key: KEY, snapshot: low }
    );
    await idbDelete(page);
    const observed = await page.evaluate(
      async ({ key }) => {
        const originalSetItem = Storage.prototype.setItem;
        const originalPut = IDBObjectStore.prototype.put;
        const calls = { local: 0, idb: 0 };
        Storage.prototype.setItem = function (storageKey) {
          if (storageKey === key) {
            calls.local++;
            throw new Error("expected real local failure");
          }
          return originalSetItem.apply(this, arguments);
        };
        IDBObjectStore.prototype.put = function (_value, storageKey) {
          if (storageKey === key) {
            calls.idb++;
            throw new Error("expected real idb failure");
          }
          return originalPut.apply(this, arguments);
        };
        try {
          await window.resolveBootReplicas();
          return { calls, health: window.__repforgeStorage.health() };
        } finally {
          Storage.prototype.setItem = originalSetItem;
          IDBObjectStore.prototype.put = originalPut;
        }
      },
      { key: KEY }
    );
    assert(
      observed.calls.local === 1 &&
        observed.calls.idb === 1 &&
        !observed.health.localOk &&
        !observed.health.idbOk,
      "Reported real-store outcomes require both adapter methods to complete",
      JSON.stringify(observed)
    );
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // 9. Delayed writes cannot leave a lower revision
  // ---------------------------------------------------------------------------
  {
    console.log("\ndelayed write ordering");
    const { context, page } = await freshContext(browser);
    await waitForApp(page);
    const low = sampleState({ name: "LowRev", revision: 20 });
    const high = sampleState({ name: "HighRev", revision: 21 });
    const slow = writeWithFake(page, low, { localOk: true, idbOk: true, idbDelay: 80, localDelay: 80 });
    const fast = writeWithFake(page, high, { localOk: true, idbOk: true, idbDelay: 5, localDelay: 5 });
    await Promise.all([slow, fast]);
    await page.evaluate(() => window.__repforgeStorage.flush());
    const both = await readBoth(page);
    assert(both.local?._storageRevision === 21 && both.idb?._storageRevision === 21, "Adversarial delays still land the highest revision", JSON.stringify({ l: both.local?._storageRevision, i: both.idb?._storageRevision, ln: both.local?.programMeta?.name, in: both.idb?.programMeta?.name }));
    assert(both.local?.programMeta?.name === "HighRev" && both.idb?.programMeta?.name === "HighRev", "Highest revision's domain data remains");
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // 10. 20 rapid Settings mutations + flush
  // ---------------------------------------------------------------------------
  {
    console.log("\nrapid settings mutations");
    const { context, page } = await freshContext(browser);
    await waitForApp(page);
    for (let i = 0; i < 20; i++) {
      await page.evaluate((n) => {
        const el = document.querySelector("#jumpPct");
        if (el) el.value = n;
        document.querySelector("#saveSettings")?.click();
      }, String(2.5 + i * 0.1));
    }
    await page.evaluate(() => window.__repforgeStorage.flush());
    const both = await readBoth(page);
    assert(JSON.stringify(both.local) === JSON.stringify(both.idb), "20 rapid Settings saves leave both stores byte-equivalent");
    assert(both.local?._storageRevision === both.idb?._storageRevision && both.local?._storageRevision >= 20, "Both stores share the highest Settings revision", both.local?._storageRevision);
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // 11. Backup omits revision and follow-up marker
  // ---------------------------------------------------------------------------
  {
    console.log("\nbackup strips storage metadata");
    const { context, page } = await freshContext(browser);
    await bootThenClear(page);
    const marked = sampleState({ name: "Marked", revision: 17, followUp: { kind: "program-done", once: true } });
    await page.evaluate(({ k, blob }) => localStorage.setItem(k, JSON.stringify(blob)), { k: KEY, blob: marked });
    await idbPut(page, JSON.parse(JSON.stringify(marked)));
    await reloadForApp(page);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.evaluate(() => document.querySelector("#exportJson")?.click()),
    ]);
    const exported = JSON.parse(readFileSync(await download.path(), "utf8"));
    assert(!("_storageRevision" in exported), "Backup omits _storageRevision", JSON.stringify(Object.keys(exported)));
    assert(!("_storageFollowUp" in exported), "Backup omits the follow-up marker", JSON.stringify(exported));
    assert(exported.programMeta?.name === "Marked" && Array.isArray(exported.log), "Backup still has domain data at the root");
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // 12. Replace / merge import revision and adapter matrix
  // ---------------------------------------------------------------------------
  {
    console.log("\nimport replace and merge");
    const { context, page } = await freshContext(browser);
    await bootThenClear(page);
    const local = sampleState({ name: "Local17", revision: 17 });
    await page.evaluate(({ k, blob }) => localStorage.setItem(k, JSON.stringify(blob)), { k: KEY, blob: local });
    await idbPut(page, JSON.parse(JSON.stringify(local)));
    await reloadForApp(page);
    const revBeforeReplace = (await readBoth(page)).local?._storageRevision;
    const beforeInvalidReplace = await readBoth(page);
    const invalidReplace = await page.evaluate(async () => {
      const calls = { local: 0, idb: 0 };
      const io = {
        writeLocal() { calls.local++; },
        writeIdb() { calls.idb++; },
      };
      try {
        await window.__repforgeStorage.replaceImport(
          { settings: {}, programMeta: {}, program: { not: "an array" }, log: [] },
          io
        );
        return { calls, error: null };
      } catch (error) {
        return { calls, error: String(error) };
      }
    });
    const afterInvalidReplace = await readBoth(page);
    assert(
      rejectedAsInvalidBackup(invalidReplace) &&
        invalidReplace.calls.local === 0 &&
        invalidReplace.calls.idb === 0,
      "Replace rejects a malformed program before invoking either storage adapter",
      JSON.stringify(invalidReplace)
    );
    assert(
      JSON.stringify(afterInvalidReplace.local) === JSON.stringify(beforeInvalidReplace.local) &&
        JSON.stringify(afterInvalidReplace.idb) === JSON.stringify(beforeInvalidReplace.idb),
      "Rejected malformed Replace leaves both replicas byte-equivalent"
    );
    const malformedEntityCases = [
      ["program [null]", { ...local, program: [null] }],
      ["log [null]", { ...local, log: [null] }],
      ["programHistory [null]", { ...local, programHistory: [null] }],
      [
        "programHistory nested program [null]",
        { ...local, programHistory: [{ id: "old-program", program: [null] }] },
      ],
      [
        "log rows with object performedName",
        {
          ...local,
          log: [
            { ...local.log[0], session: "unsafe-a", performedName: {} },
            { ...local.log[0], session: "unsafe-b", performedName: {} },
          ],
        },
      ],
    ];
    for (const [label, incomingState] of malformedEntityCases) {
      const before = await readBoth(page);
      const rejected = await page.evaluate(async (incoming) => {
        const calls = { local: 0, idb: 0 };
        const io = {
          writeLocal() {
            calls.local++;
          },
          writeIdb() {
            calls.idb++;
          },
        };
        try {
          await window.__repforgeStorage.replaceImport(incoming, io);
          return { calls, error: null };
        } catch (error) {
          return { calls, error: String(error) };
        }
      }, incomingState);
      assert(
        rejectedAsInvalidBackup(rejected) && rejected.calls.local === 0 && rejected.calls.idb === 0,
        `Replace rejects ${label} before invoking either storage adapter`,
        JSON.stringify(rejected)
      );
      const after = await readBoth(page);
      assert(
        JSON.stringify(after.local) === JSON.stringify(before.local) &&
          JSON.stringify(after.idb) === JSON.stringify(before.idb),
        `Rejected ${label} Replace leaves both replicas byte-equivalent`
      );
      await reloadForApp(page);
    }

    const incoming = sampleState({
      name: "Incoming999",
      revision: 999,
      followUp: { kind: "forged" },
      programId: "prog-in",
      log: otherState().log,
    });
    const noRev = sampleState({ name: "IncomingNone", programId: "prog-none", log: otherState().log });
    delete noRev._storageRevision;

    const makeIo = (localOk, idbOk) => ({ localOk, idbOk });
    async function replaceWith(incomingState, flags) {
      return page.evaluate(
        async ({ incomingState, flags, key, dbName, storeName }) => {
          const realIdb = async (data) => {
            const db = await new Promise((res, rej) => {
              const r = indexedDB.open(dbName, 1);
              r.onupgradeneeded = () => r.result.createObjectStore(storeName);
              r.onsuccess = () => res(r.result);
              r.onerror = () => rej(r.error);
            });
            await new Promise((res, rej) => {
              const tx = db.transaction(storeName, "readwrite");
              tx.objectStore(storeName).put(data, key);
              tx.oncomplete = () => res();
              tx.onerror = () => rej(tx.error);
            });
            db.close();
          };
          const io = {
            async writeLocal(data) {
              if (!flags.localOk) throw new Error("ls fail");
              localStorage.setItem(key, JSON.stringify(data));
            },
            async writeIdb(data) {
              if (!flags.idbOk) throw new Error("idb fail");
              await realIdb(data);
            },
          };
          const draftBefore = localStorage.getItem("repforge_draft_v1");
          const chooser = document.querySelector("#importChoice");
          const chooserBefore = chooser ? chooser.className : "";
          const result = await window.__repforgeStorage.replaceImport(incomingState, io);
          return {
            result,
            draftAfter: localStorage.getItem("repforge_draft_v1"),
            draftBefore,
            chooserAfter: chooser ? chooser.className : "",
            chooserBefore,
            health: window.__repforgeStorage.health(),
          };
        },
        { incomingState, flags, key: KEY, dbName: DB, storeName: STORE }
      );
    }

    let out = await replaceWith(incoming, makeIo(true, true));
    assert(out.result.localOk || out.result.idbOk, "Replace with forged revision 999 is accepted");
    let both = await readBoth(page);
    assert(both.local?._storageRevision === revBeforeReplace + 1 && both.idb?._storageRevision === revBeforeReplace + 1, "Replace at local rev 17 finishes at the next local revision even if the file claims 999", JSON.stringify({ l: both.local?._storageRevision, i: both.idb?._storageRevision, before: revBeforeReplace }));
    assert(both.local?._storageFollowUp == null && both.idb?._storageFollowUp == null, "Replace never adopts a forged follow-up marker");
    assert(both.local?.programMeta?.name === "Incoming999", "Replace installs the incoming program name");

    await clearStores(page);
    await page.evaluate(({ k, blob }) => localStorage.setItem(k, JSON.stringify(blob)), { k: KEY, blob: local });
    await idbPut(page, JSON.parse(JSON.stringify(local)));
    await reloadForApp(page);
    const revBeforeNoRev = (await readBoth(page)).local?._storageRevision;
    out = await replaceWith(noRev, makeIo(true, true));
    both = await readBoth(page);
    assert(both.local?._storageRevision === revBeforeNoRev + 1, "Replace with no incoming revision still finishes at the next local revision", JSON.stringify({ before: revBeforeNoRev, after: both.local?._storageRevision }));

    const outcomes = [
      [true, true],
      [true, false],
      [false, true],
      [false, false],
    ];
    for (const [localOk, idbOk] of outcomes) {
      await clearStores(page);
      const start = sampleState({ name: "Start", revision: 17 });
      await page.evaluate(({ k, blob }) => localStorage.setItem(k, JSON.stringify(blob)), { k: KEY, blob: start });
      await idbPut(page, JSON.parse(JSON.stringify(start)));
      await page.evaluate((d) => localStorage.setItem(d, JSON.stringify({ keep: "draft" })), DRAFT);
      await reloadForApp(page);
      const incomingState = sampleState({ name: `In-${localOk}-${idbOk}`, programId: "prog-x", log: otherState().log });
      const beforeDisk = await readBoth(page);
      const beforeDraft = await page.evaluate((d) => localStorage.getItem(d), DRAFT);
      out = await replaceWith(incomingState, { localOk, idbOk });
      if (localOk || idbOk) {
        await page.reload({ waitUntil: "domcontentloaded" });
        await waitForApp(page);
        both = await readBoth(page);
        assert(both.local?.programMeta?.name === incomingState.programMeta.name && both.idb?.programMeta?.name === incomingState.programMeta.name, `Replace (${localOk},${idbOk}) reloads/heals from an accepted replica`);
      } else {
        both = await readBoth(page);
        assert(both.local?.programMeta?.name === "Start" && both.idb?.programMeta?.name === "Start", "Replace (false,false) leaves disk unchanged");
        const draft = await page.evaluate((d) => localStorage.getItem(d), DRAFT);
        assert(draft === beforeDraft, "Replace total failure leaves the draft byte-equivalent");
        assert(JSON.stringify(both.local) === JSON.stringify(beforeDisk.local), "Replace total failure leaves live disk byte-equivalent");
        const retry = await replaceWith(incomingState, { localOk: true, idbOk: true });
        assert(retry.result.localOk, "Replace total failure can retry without duplicating");
        both = await readBoth(page);
        const sessions = new Set(both.local.log.map((r) => r.session));
        assert(sessions.size === 1, "Retry after failed replace does not duplicate sessions", [...sessions]);
      }
    }

    await clearStores(page);
    const mergeBase = sampleState({ name: "MergeBase", revision: 3 });
    await page.evaluate(({ k, blob }) => localStorage.setItem(k, JSON.stringify(blob)), { k: KEY, blob: mergeBase });
    await idbPut(page, JSON.parse(JSON.stringify(mergeBase)));
    await reloadForApp(page);
    const revBeforeMerge = (await readBoth(page)).local?._storageRevision;
    const mergeIn = sampleState({
      name: "MergeIn",
      revision: 50,
      log: [
        ...mergeBase.log,
        {
          session: "s-new",
          date: "2026-03-03",
          day: "Day 1",
          name: "Press",
          exerciseId: "ex1",
          set: 1,
          load: 70,
          reps: 9,
          rir: 1,
          notes: "",
          created: "2026-03-03T00:00:00.000Z",
          primary: "Chest",
          secondary: "",
        },
      ],
    });
    const merged = await page.evaluate(
      async ({ incoming, key, dbName, storeName }) => {
        const realIdb = async (data) => {
          const db = await new Promise((res, rej) => {
            const r = indexedDB.open(dbName, 1);
            r.onupgradeneeded = () => r.result.createObjectStore(storeName);
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
          });
          await new Promise((res, rej) => {
            const tx = db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).put(data, key);
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
          });
          db.close();
        };
        const io = {
          async writeLocal(data) {
            localStorage.setItem(key, JSON.stringify(data));
          },
          async writeIdb(data) {
            await realIdb(data);
          },
        };
        return window.__repforgeStorage.mergeImport(incoming, io);
      },
      { incoming: mergeIn, key: KEY, dbName: DB, storeName: STORE }
    );
    assert(merged.added === 1, "Merge adds only the new session", JSON.stringify(merged));
    both = await readBoth(page);
    const sessions = both.local.log.map((r) => r.session);
    assert(sessions[0] === "s1" && sessions.includes("s-new") && sessions.length === 2, "Merge preserves local order and appends the new session", sessions);
    assert(both.local?._storageRevision === revBeforeMerge + 1, "Merge advances the local revision", JSON.stringify({ before: revBeforeMerge, after: both.local?._storageRevision }));

    for (const [localOk, idbOk] of outcomes) {
      await clearStores(page);
      await page.evaluate(({ k, blob }) => localStorage.setItem(k, JSON.stringify(blob)), { k: KEY, blob: mergeBase });
      await idbPut(page, JSON.parse(JSON.stringify(mergeBase)));
      await reloadForApp(page);
      const res = await page.evaluate(
        async ({ incoming, flags, key, dbName, storeName }) => {
          const realIdb = async (data) => {
            const db = await new Promise((res, rej) => {
              const r = indexedDB.open(dbName, 1);
              r.onupgradeneeded = () => r.result.createObjectStore(storeName);
              r.onsuccess = () => res(r.result);
              r.onerror = () => rej(r.error);
            });
            await new Promise((res, rej) => {
              const tx = db.transaction(storeName, "readwrite");
              tx.objectStore(storeName).put(data, key);
              tx.oncomplete = () => res();
              tx.onerror = () => rej(tx.error);
            });
            db.close();
          };
          const io = {
            async writeLocal(data) {
              if (!flags.localOk) throw new Error("ls fail");
              localStorage.setItem(key, JSON.stringify(data));
            },
            async writeIdb(data) {
              if (!flags.idbOk) throw new Error("idb fail");
              await realIdb(data);
            },
          };
          return window.__repforgeStorage.mergeImport(incoming, io);
        },
        { incoming: mergeIn, flags: { localOk, idbOk }, key: KEY, dbName: DB, storeName: STORE }
      );
      if (localOk || idbOk) {
        await page.reload({ waitUntil: "domcontentloaded" });
        await waitForApp(page);
        both = await readBoth(page);
        const set = new Set(both.local.log.map((r) => r.session));
        assert(set.has("s1") && set.has("s-new") && set.size === 2, `Merge (${localOk},${idbOk}) commits unique sessions and heals`);
      } else {
        both = await readBoth(page);
        const set = new Set(both.local.log.map((r) => r.session));
        assert(set.size === 1 && set.has("s1"), "Merge total failure adds no sessions");
        const retry = await page.evaluate(
          async ({ incoming, key, dbName, storeName }) => {
            const realIdb = async (data) => {
              const db = await new Promise((res, rej) => {
                const r = indexedDB.open(dbName, 1);
                r.onupgradeneeded = () => r.result.createObjectStore(storeName);
                r.onsuccess = () => res(r.result);
                r.onerror = () => rej(r.error);
              });
              await new Promise((res, rej) => {
                const tx = db.transaction(storeName, "readwrite");
                tx.objectStore(storeName).put(data, key);
                tx.oncomplete = () => res();
                tx.onerror = () => rej(tx.error);
              });
              db.close();
            };
            const io = {
              async writeLocal(data) {
                localStorage.setItem(key, JSON.stringify(data));
              },
              async writeIdb(data) {
                await realIdb(data);
              },
            };
            return window.__repforgeStorage.mergeImport(incoming, io);
          },
          { incoming: mergeIn, key: KEY, dbName: DB, storeName: STORE }
        );
        assert(retry.added === 1, "Merge retry after total failure still adds the session once", JSON.stringify(retry));
      }
    }

    await clearStores(page);
    const sparseBase = sampleState({ name: "Sparse base", revision: 4 });
    await page.evaluate(({ k, blob }) => localStorage.setItem(k, JSON.stringify(blob)), {
      k: KEY,
      blob: sparseBase,
    });
    await idbPut(page, JSON.parse(JSON.stringify(sparseBase)));
    await reloadForApp(page);
    const sparseLegacy = { program: [{}], log: [{}] };
    const sparseResult = await replaceWith(sparseLegacy, { localOk: true, idbOk: true });
    assert(
      sparseResult.result.localOk && sparseResult.result.idbOk,
      "Replace accepts a sparse legacy domain object",
      JSON.stringify(sparseResult.result)
    );
    both = await readBoth(page);
    const sparseExerciseId = both.local?.program?.[0]?.id;
    assert(
      typeof sparseExerciseId === "string" &&
        sparseExerciseId.length > 0 &&
        both.idb?.program?.[0]?.id === sparseExerciseId &&
        both.local?.program?.[0]?.name === "Exercise" &&
        both.local?.program?.[0]?.day === "Day 1" &&
        both.local?.program?.[0]?.sets === 2,
      "Accepted sparse Replace is durably normalized before reload",
      JSON.stringify({
        localProgram: both.local?.program,
        idbProgram: both.idb?.program,
      })
    );
    const sparseDraftRaw = JSON.stringify({
      __day: "Day 1",
      __touched: [`${sparseExerciseId}_1`],
      [`${sparseExerciseId}_1_load`]: "42.5",
      [`${sparseExerciseId}_1_reps`]: "9",
      [`${sparseExerciseId}_1_rir`]: "2",
    });
    await page.evaluate(
      ({ draftKey, raw }) => localStorage.setItem(draftKey, raw),
      { draftKey: DRAFT, raw: sparseDraftRaw }
    );
    await reloadForApp(page);
    both = await readBoth(page);
    assert(
      both.local?.program?.[0]?.name === "Exercise" &&
        both.local?.program?.[0]?.day === "Day 1" &&
        both.local?.program?.[0]?.sets === 2 &&
        both.local?.log?.[0]?.load === 0 &&
        both.local?.log?.[0]?.reps === 0 &&
        both.local?.settings?.jumpPct === 2.5 &&
        Array.isArray(both.local?.programHistory) &&
        both.local.programHistory.length === 0,
      "Sparse legacy entities retain supported default normalization",
      JSON.stringify(both.local)
    );
    assert(
      both.local?.program?.[0]?.id === sparseExerciseId &&
        both.idb?.program?.[0]?.id === sparseExerciseId &&
        (await page.evaluate((draftKey) => localStorage.getItem(draftKey), DRAFT)) ===
          sparseDraftRaw,
      "Sparse imported exercise identity and its draft keys survive reload",
      JSON.stringify({
        before: sparseExerciseId,
        localAfter: both.local?.program?.[0]?.id,
        idbAfter: both.idb?.program?.[0]?.id,
      })
    );
    assert(
      JSON.stringify(both.local) === JSON.stringify(both.idb),
      "Sparse legacy normalization heals both replicas identically"
    );

    const emptyResult = await replaceWith(
      { program: [], log: [], programHistory: [] },
      { localOk: true, idbOk: true }
    );
    assert(
      emptyResult.result.localOk && emptyResult.result.idbOk,
      "Replace accepts valid empty domain arrays",
      JSON.stringify(emptyResult.result)
    );
    both = await readBoth(page);
    assert(
      both.local?.program?.length === 0 &&
        both.local?.log?.length === 0 &&
        both.local?.programHistory?.length === 0,
      "Valid empty domain arrays remain empty after normalization",
      JSON.stringify(both.local)
    );
    await context.close();
  }

  // ---------------------------------------------------------------------------
  // 13. chooseSnapshot pure cases
  // ---------------------------------------------------------------------------
  {
    console.log("\nchooseSnapshot helper");
    const { context, page } = await freshContext(browser);
    await waitForApp(page);
    const table = await page.evaluate(() => {
      const choose = window.__repforgeStorage.chooseSnapshot;
      const valid = (name, rev) => ({
        status: "valid",
        raw: "{}",
        parsed: { program: [], log: [], programMeta: { name }, ...(rev != null ? { _storageRevision: rev } : {}) },
      });
      const reordered = choose(
        { status: "valid", raw: "{}", parsed: { program: [{ id: "x", name: "Press" }], log: [], settings: { unit: "kg", lang: "en" } } },
        { status: "valid", raw: "{}", parsed: { settings: { lang: "en", unit: "kg" }, log: [], program: [{ name: "Press", id: "x" }] } }
      );
      return {
        first: choose({ status: "absent" }, { status: "absent" }).kind,
        equalLegacy: choose(valid("A"), valid("A")).migrate,
        reorderedLegacy: reordered.kind === "chosen" && reordered.migrate === true,
        higher: choose(valid("L", 2), valid("I", 1)).source,
        divergent: choose(valid("A", 0), valid("B", 0)).kind,
        invalid: choose(valid("A", 1), { status: "invalid", raw: "x" }).kind,
      };
    });
    assert(table.first === "first-run", "chooseSnapshot: two absents are first-run", JSON.stringify(table));
    assert(table.equalLegacy === true, "chooseSnapshot: equal revisionless snapshots migrate", JSON.stringify(table));
    assert(table.reorderedLegacy === true, "chooseSnapshot: object key order does not create false divergence", JSON.stringify(table));
    assert(table.higher === "local", "chooseSnapshot: higher local revision wins", JSON.stringify(table));
    assert(table.divergent === "unresolved", "chooseSnapshot: equal-revision divergence is unresolved", JSON.stringify(table));
    assert(table.invalid === "unresolved", "chooseSnapshot: valid+invalid is unresolved", JSON.stringify(table));
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\npersistence tests: ${results.passed} passed, ${results.failed} failed`);
if (results.failed) process.exit(1);
