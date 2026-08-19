#!/usr/bin/env node
/** Deterministic repro for an accepted workout racing an ordinary Settings persist. */
import { launchChromium } from "./browser.mjs";
import {
  clearPersistenceArtifacts,
  inventoryPersistenceArtifacts,
} from "./persistence-artifacts.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const PENDING_PREFIX = "repforge_pending_v1:";
const DB = "repforge";
const STORE = "kv";
const STORAGE_LOCK = "repforge:state-write";
const failures = [];

function check(condition, message, detail) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    return;
  }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${JSON.stringify(detail)}`);
}

function seededState() {
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
      notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
    },
    programMeta: {
      id: "race-program",
      name: "Race fixture",
      started: "2026-08-01",
      created: "2026-08-01T00:00:00.000Z",
      updated: "2026-08-01T00:00:00.000Z",
      onboarded: true,
      mesocycleStatus: "active",
      mesocycleLengthWeeks: 6,
      goal: null,
      experience: null,
      daysPerWeek: 1,
      splitType: "full_body",
      equipment: ["machines"],
      priorityMuscles: [],
      sessionLength: "45",
      completedAt: null,
    },
    program: [
      {
        id: "race-press",
        name: "Race press",
        day: "Day 1",
        order: 0,
        sets: 1,
        min: 8,
        max: 12,
        primary: "Chest",
        secondary: "",
      },
    ],
    log: [],
    programHistory: [],
    _storageRevision: 7,
  };
}

function loggedState(revision = 30) {
  const snapshot = seededState();
  snapshot._storageRevision = revision;
  snapshot.log = [
    {
      session: "old-session",
      date: "2026-08-12",
      day: "Day 1",
      name: "Race press",
      exerciseId: "race-press",
      set: 1,
      load: 55,
      reps: 10,
      rir: 1,
      notes: "",
      created: "2026-08-12T12:00:00.000Z",
      primary: "Chest",
      secondary: "",
    },
  ];
  return snapshot;
}

async function waitForApp(page) {
  await page.waitForFunction(
    () =>
      typeof window.__repforgeStorage?.flush === "function" &&
      typeof window.__repforgeSaveWorkout === "function" &&
      typeof window.__repforgeShowSettings === "function",
    { timeout: 15000 }
  );
  await waitForWorkerToClaim(page);
}

/** The app's boot registers the service worker, and that worker claims the page
 *  it was registered from. On a context that has never seen it, Chromium serves
 *  the document again through the new controller, which throws away the
 *  execution context — including the one an evaluate is sitting in. A storage
 *  test that reads a replica right after boot was racing that, so the first
 *  evaluate after a fresh load could die as "execution context was destroyed".
 *  Waiting for the claim puts the rest of the test after that one-time
 *  re-fetch. A page with no worker to register returns at once, and a worker
 *  that never claims gives the wait up rather than hang. */
async function waitForWorkerToClaim(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const claimed = await page.evaluate(async () => {
        if (!navigator.serviceWorker) return true;
        if (navigator.serviceWorker.controller) return true;
        if (!(await navigator.serviceWorker.getRegistration())) return true;
        return await new Promise((resolve) => {
          navigator.serviceWorker.addEventListener("controllerchange", () => resolve(true), { once: true });
          setTimeout(() => resolve(true), 5000);
        });
      });
      if (claimed) return;
    } catch {
      // The re-fetch landed mid-evaluate. Wait for the document that replaced
      // the old one, then ask the page it became.
      await page.waitForFunction(() => typeof window.__repforgeStorage?.flush === "function", { timeout: 15000 });
    }
  }
}

async function flushStorage(page) {
  await page.evaluate(async () => {
    await window.__repforgeStorage.flush();
  });
}

async function putBoth(page, snapshot) {
  await flushStorage(page);
  await clearPersistenceArtifacts(page);
  await page.evaluate(
    async ({
      key,
      draftKey,
      dbName,
      storeName,
      snapshot,
    }) => {
      localStorage.setItem(key, JSON.stringify(snapshot));
      localStorage.removeItem(draftKey);
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(storeName);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(snapshot, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    {
      key: KEY,
      draftKey: DRAFT,
      dbName: DB,
      storeName: STORE,
      snapshot,
    }
  );
  const seeded = await readBoth(page);
  const artifacts = await inventoryPersistenceArtifacts(page);
  if (
    JSON.stringify(seeded.local) !== JSON.stringify(snapshot) ||
    JSON.stringify(seeded.idb) !== JSON.stringify(snapshot) ||
    seeded.draft !== null ||
    artifacts.keys.length !== 0
  ) {
    throw new Error(
      `persistence-race baseline seed failed: ${JSON.stringify({ seeded, artifacts })}`
    );
  }
}

async function readBoth(page) {
  return page.evaluate(
    async ({ key, draftKey, dbName, storeName }) => {
      const local = JSON.parse(localStorage.getItem(key) || "null");
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(storeName);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const idb = await new Promise((resolve, reject) => {
        const req = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return { local, idb, draft: localStorage.getItem(draftKey) };
    },
    { key: KEY, draftKey: DRAFT, dbName: DB, storeName: STORE }
  );
}

const browser = await launchChromium();
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await putBoth(page, seededState());
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);

  await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false }));
  await page.locator('[data-k="race-press_1_load"]').fill("60");
  await page.locator('[data-k="race-press_1_reps"]').fill("10");
  await page.locator('[data-k="race-press_1_rir"]').fill("1");
  await page.waitForFunction((draftKey) => localStorage.getItem(draftKey) !== null, DRAFT);

  await page.evaluate(
    ({ key, dbName, storeName }) => {
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      window.__raceReleaseWorkoutWrite = release;
      window.__raceWorkoutWriteEntered = false;
      const writeIdb = async (snapshot) => {
        const db = await new Promise((resolve, reject) => {
          const req = indexedDB.open(dbName, 1);
          req.onupgradeneeded = () => req.result.createObjectStore(storeName);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        await new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).put(snapshot, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        db.close();
      };
      const gatedIo = {
        async writeLocal(snapshot) {
          window.__raceWorkoutWriteEntered = true;
          window.__raceSession = snapshot.log.at(-1)?.session || null;
          await gate;
          localStorage.setItem(key, JSON.stringify(snapshot));
        },
        async writeIdb(snapshot) {
          await writeIdb(snapshot);
        },
      };
      window.__raceSaveResult = window.__repforgeSaveWorkout(gatedIo);
    },
    { key: KEY, dbName: DB, storeName: STORE }
  );
  await page.waitForFunction(() => window.__raceWorkoutWriteEntered === true);

  await page.evaluate(() => {
    window.__repforgeShowSettings();
    const jump = document.querySelector("#jumpPct");
    jump.value = "3.75";
    document.querySelector("#saveSettings").click();
  });

  await page.evaluate(() => window.__raceReleaseWorkoutWrite());
  const accepted = await page.evaluate(async () => {
    const result = await window.__raceSaveResult;
    return {
      result,
      session: window.__raceSession,
    };
  });
  await flushStorage(page);
  const beforeReload = await readBoth(page);

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const afterReload = await readBoth(page);
  const session = accepted.session;
  const summary = {
    accepted: !!(accepted.result?.localOk || accepted.result?.idbOk),
    revision: accepted.result?.revision ?? null,
    localRowsBeforeReload: beforeReload.local?.log?.length ?? null,
    idbRowsBeforeReload: beforeReload.idb?.log?.length ?? null,
    localRowsAfterReload: afterReload.local?.log?.length ?? null,
    idbRowsAfterReload: afterReload.idb?.log?.length ?? null,
    localHasSession: !!afterReload.local?.log?.some((row) => row.session === session),
    idbHasSession: !!afterReload.idb?.log?.some((row) => row.session === session),
    settingsMutationSurvived: afterReload.local?.settings?.jumpPct === 3.75 && afterReload.idb?.settings?.jumpPct === 3.75,
    draftPresent: afterReload.draft !== null,
  };
  console.log(JSON.stringify(summary, null, 2));

  check(summary.accepted, "same-page precondition: workout write was accepted", summary);
  check(
    summary.localHasSession && summary.idbHasSession,
    "same-page accepted workout survives a concurrent Settings save",
    summary
  );
  check(summary.settingsMutationSurvived, "same-page Settings mutation survives with the workout", summary);

  console.log("\ncross-tab stale-base workout + Settings");
  const crossSeed = seededState();
  crossSeed._storageRevision = 20;
  await putBoth(page, crossSeed);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const peer = await context.newPage();
  try {
    await peer.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(peer);

    await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false }));
    await page.locator('[data-k="race-press_1_load"]').fill("62.5");
    await page.locator('[data-k="race-press_1_reps"]').fill("9");
    await page.locator('[data-k="race-press_1_rir"]').fill("1");
    const crossAccepted = await page.evaluate(() => window.__repforgeSaveWorkout());
    await flushStorage(page);

    await peer.evaluate(() => {
      window.__repforgeShowSettings();
      const jump = document.querySelector("#jumpPct");
      jump.value = "4.25";
      document.querySelector("#saveSettings").click();
    });
    await flushStorage(peer);

    const cross = await readBoth(page);
    const crossSummary = {
      accepted: !!(crossAccepted?.localOk || crossAccepted?.idbOk),
      localRows: cross.local?.log?.length ?? null,
      idbRows: cross.idb?.log?.length ?? null,
      localJump: cross.local?.settings?.jumpPct ?? null,
      idbJump: cross.idb?.settings?.jumpPct ?? null,
      localRevision: cross.local?._storageRevision ?? null,
      idbRevision: cross.idb?._storageRevision ?? null,
    };
    check(crossSummary.accepted, "cross-tab precondition: workout write was accepted", crossSummary);
    check(
      crossSummary.localRows === 1 &&
        crossSummary.idbRows === 1 &&
        crossSummary.localJump === 4.25 &&
        crossSummary.idbJump === 4.25,
      "stale tab rebases its Settings mutation without overwriting the accepted workout",
      crossSummary
    );
  } finally {
    await peer.close();
  }

  console.log("\ndestructive reset rejects total write failure");
  await putBoth(page, loggedState(30));
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false }));
  await page.locator('[data-k="race-press_1_load"]').fill("65");
  await page.locator('[data-k="race-press_1_reps"]').fill("8");
  await page.locator('[data-k="race-press_1_rir"]').fill("1");
  await page.waitForFunction((draftKey) => localStorage.getItem(draftKey) !== null, DRAFT);
  const resetDraftBefore = await page.evaluate((draftKey) => localStorage.getItem(draftKey), DRAFT);
  await page.evaluate((key) => {
    const originalSet = Storage.prototype.setItem;
    const originalPut = IDBObjectStore.prototype.put;
    window.__restoreResetFailure = () => {
      Storage.prototype.setItem = originalSet;
      IDBObjectStore.prototype.put = originalPut;
      delete window.__restoreResetFailure;
    };
    Storage.prototype.setItem = function (candidate, value) {
      if (candidate === key) throw new Error("forced localStorage write failure");
      return originalSet.call(this, candidate, value);
    };
    IDBObjectStore.prototype.put = function (value, candidate) {
      if (candidate === key) throw new Error("forced IndexedDB write failure");
      return originalPut.call(this, value, candidate);
    };
    window.__repforgeShowSettings();
  }, KEY);
  page.once("dialog", (dialog) => dialog.accept());
  await page.click("#reset");
  await page.evaluate(async () => {
    await window.__repforgeStorage.flush();
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    window.__restoreResetFailure?.();
  });
  const resetFailure = await readBoth(page);
  const resetDraftAfter = await page.evaluate((draftKey) => localStorage.getItem(draftKey), DRAFT);
  await page.evaluate(() => document.querySelector('nav button[data-view="history"]')?.click());
  const resetLiveSession = await page.locator('[data-sess="old-session"]').count();
  const resetFailureSummary = {
    localRows: resetFailure.local?.log?.length ?? null,
    idbRows: resetFailure.idb?.log?.length ?? null,
    draftByteEquivalent: resetDraftAfter === resetDraftBefore,
    liveSessionPresent: resetLiveSession === 1,
  };
  check(
    resetFailureSummary.localRows === 1 &&
      resetFailureSummary.idbRows === 1 &&
      resetFailureSummary.draftByteEquivalent &&
      resetFailureSummary.liveSessionPresent,
    "Delete log changes live state and draft only after an accepted replica",
    resetFailureSummary
  );

  console.log("\ndestructive reset racing an accepted workout");
  const resetRaceSeed = loggedState(40);
  await putBoth(page, resetRaceSeed);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false }));
  await page.locator('[data-k="race-press_1_load"]').fill("67.5");
  await page.locator('[data-k="race-press_1_reps"]').fill("8");
  await page.locator('[data-k="race-press_1_rir"]').fill("1");
  await page.evaluate(
    ({ key, dbName, storeName }) => {
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      window.__resetRaceRelease = release;
      window.__resetRaceEntered = false;
      const writeIdb = async (snapshot) => {
        const db = await new Promise((resolve, reject) => {
          const req = indexedDB.open(dbName, 1);
          req.onupgradeneeded = () => req.result.createObjectStore(storeName);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        await new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).put(snapshot, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        db.close();
      };
      const gatedIo = {
        async writeLocal(snapshot) {
          window.__resetRaceEntered = true;
          window.__resetRaceSession = snapshot.log.at(-1)?.session || null;
          await gate;
          localStorage.setItem(key, JSON.stringify(snapshot));
        },
        async writeIdb(snapshot) {
          await writeIdb(snapshot);
        },
      };
      window.__resetRaceSave = window.__repforgeSaveWorkout(gatedIo);
    },
    { key: KEY, dbName: DB, storeName: STORE }
  );
  await page.waitForFunction(() => window.__resetRaceEntered === true);
  await page.evaluate(() => window.__repforgeShowSettings());
  page.once("dialog", (dialog) => dialog.accept());
  await page.click("#reset");
  await page.evaluate(() => window.__resetRaceRelease());
  const resetRaceAccepted = await page.evaluate(async () => {
    const result = await window.__resetRaceSave;
    return { result, session: window.__resetRaceSession };
  });
  await flushStorage(page);
  const resetRace = await readBoth(page);
  const resetRaceSummary = {
    accepted: !!(resetRaceAccepted.result?.localOk || resetRaceAccepted.result?.idbOk),
    localSessions: resetRace.local?.log?.map((row) => row.session) || [],
    idbSessions: resetRace.idb?.log?.map((row) => row.session) || [],
    newSession: resetRaceAccepted.session,
  };
  check(
    resetRaceSummary.accepted &&
      resetRaceSummary.localSessions.length === 1 &&
      resetRaceSummary.idbSessions.length === 1 &&
      resetRaceSummary.localSessions[0] === resetRaceSummary.newSession &&
      resetRaceSummary.idbSessions[0] === resetRaceSummary.newSession,
    "Delete log removes the seen log without erasing a concurrently accepted workout",
    resetRaceSummary
  );

  console.log("\nsynchronous journal failure");
  {
    const quotaContext = await browser.newContext();
    const writer = await quotaContext.newPage();
    try {
      await writer.goto(BASE, { waitUntil: "domcontentloaded" });
      await waitForApp(writer);
      const baseline = seededState();
      baseline._storageRevision = 60;
      await putBoth(writer, baseline);
      await writer.reload({ waitUntil: "domcontentloaded" });
      await waitForApp(writer);

      await writer.evaluate((pendingPrefix) => {
        const originalSetItem = Storage.prototype.setItem;
        window.__restoreJournalQuotaPatch = () => {
          Storage.prototype.setItem = originalSetItem;
          delete window.__restoreJournalQuotaPatch;
        };
        Storage.prototype.setItem = function (candidate) {
          if (typeof candidate === "string" && candidate.startsWith(pendingPrefix)) {
            throw new DOMException("forced journal quota failure", "QuotaExceededError");
          }
          return originalSetItem.apply(this, arguments);
        };
      }, PENDING_PREFIX);

      await writer.evaluate(async () => {
        window.__repforgeShowSettings();
        document.querySelector("#jumpPct").value = "7.75";
        document.querySelector("#saveSettings").click();
        await Promise.resolve();
        await Promise.resolve();
      });
      const ordinary = await readBoth(writer);
      const ordinaryUi = await writer.evaluate(() => ({
        jumpPct: Number(document.querySelector("#jumpPct")?.value),
        toast: document.querySelector("#toast")?.textContent || "",
        health: window.__repforgeStorage.health(),
      }));
      const ordinaryArtifacts = await inventoryPersistenceArtifacts(writer);
      check(
        ordinary.local?.settings?.jumpPct === 2.5 &&
          ordinary.idb?.settings?.jumpPct === 2.5 &&
          ordinaryUi.jumpPct === 2.5 &&
          !/settings saved/i.test(ordinaryUi.toast) &&
          ordinaryUi.health.lastResult?.journalFailed === true &&
          ordinaryArtifacts.keys.length === 0,
        "ordinary mutation fails before optimistic state when its journal cannot be written",
        { ordinaryUi, ordinaryArtifacts }
      );

      const requiredResult = await writer.evaluate(() =>
        window.__repforgeApplyProgramTemplate()
      );
      await writer.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      );
      const required = await readBoth(writer);
      // The toast copy is asked of the catalog, not spelled out here: a reword
      // should not fail a check about which of the two toasts was raised.
      const requiredUi = await writer.evaluate(() => ({
        toast: document.querySelector("#toast")?.textContent || "",
        health: window.__repforgeStorage.health(),
        storageFullCopy: window.RepForgeI18n?.t("toast.storage_full") || "",
        draftConflictCopy: window.RepForgeI18n?.t("toast.draft_conflict_retry") || "",
      }));
      const requiredArtifacts = await inventoryPersistenceArtifacts(writer);
      check(
        requiredResult?.journalFailed === true &&
          requiredResult?.localOk === false &&
          requiredResult?.idbOk === false &&
          requiredUi.health.lastResult?.journalFailed === true &&
          requiredUi.toast.trim() === requiredUi.storageFullCopy.trim() &&
          requiredUi.toast.trim() !== requiredUi.draftConflictCopy.trim() &&
          required.local?.programMeta?.id === baseline.programMeta.id &&
          required.idb?.programMeta?.id === baseline.programMeta.id &&
          requiredArtifacts.keys.length === 0,
        "required-effect mutation also fails closed without an unload journal",
        { requiredResult, requiredUi, requiredArtifacts }
      );
      await writer.evaluate(() => window.__restoreJournalQuotaPatch?.());
    } finally {
      await quotaContext.close();
    }
  }
} finally {
  await context.close();
  await browser.close();
}

if (failures.length) {
  throw new Error(`persistence race regressions: ${failures.length} failed`);
}
console.log("\nPASS: persistence race regressions");
