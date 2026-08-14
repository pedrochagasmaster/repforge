#!/usr/bin/env node
/**
 * Deterministic production-path repros for seven cross-tab persistence races.
 * Requires the repository root at REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const PENDING = "repforge_pending_v1";
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

function fixture(revision) {
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
      id: "audit-old-program",
      name: "Audit fixture",
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
        id: "audit-press",
        name: "Audit press",
        day: "Day 1",
        order: 1,
        sets: 2,
        min: 8,
        max: 12,
        minSets: 1,
        maxSets: 6,
        primary: "Chest",
        secondary: "",
        notes: "",
        alternates: ["Audit incline press"],
      },
    ],
    log: [],
    programHistory: [],
    _storageRevision: revision,
  };
}

async function waitForApp(page) {
  await page.waitForFunction(
    () =>
      typeof window.__repforgeStorage?.flush === "function" &&
      typeof window.__repforgeSaveWorkout === "function" &&
      typeof window.__repforgeCommitNextBlock === "function",
    { timeout: 15000 }
  );
  await page.waitForSelector("#dayTabs button", { state: "attached", timeout: 15000 });
  await page.evaluate(() => {
    const onboarding = document.querySelector("#onboarding");
    if (onboarding?.classList.contains("active")) window.closeOnboarding?.();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden")) window.closeTour?.();
  });
}

async function openApp(context) {
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  return page;
}

async function reloadApp(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
}

async function writeReplicas(page, { local, idb, clearDraft = true }) {
  await page.evaluate(
    async ({ key, draftKey, pendingKey, dbName, storeName, local, idb, clearDraft }) => {
      if (local == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(local));
      if (clearDraft) {
        localStorage.removeItem(draftKey);
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const storageKey = localStorage.key(i);
          if (storageKey === pendingKey || storageKey?.startsWith(`${pendingKey}:`)) {
            localStorage.removeItem(storageKey);
          }
        }
      }
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        if (idb == null) store.delete(key);
        else store.put(idb, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { key: KEY, draftKey: DRAFT, pendingKey: PENDING, dbName: DB, storeName: STORE, local, idb, clearDraft }
  );
}

async function writeIdb(page, value) {
  await page.evaluate(
    async ({ key, dbName, storeName, value }) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        if (value == null) store.delete(key);
        else store.put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { key: KEY, dbName: DB, storeName: STORE, value }
  );
}

async function readBoth(page) {
  return page.evaluate(
    async ({ key, draftKey, pendingKey, dbName, storeName }) => {
      const localRaw = localStorage.getItem(key);
      const local = localRaw == null ? null : JSON.parse(localRaw);
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const idb = await new Promise((resolve, reject) => {
        const request = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
      db.close();
      const draftRaw = localStorage.getItem(draftKey);
      let draft = null;
      try {
        draft = draftRaw == null ? null : JSON.parse(draftRaw);
      } catch {
        draft = { __invalid: true };
      }
      const pendingItems = [];
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (storageKey === pendingKey || storageKey?.startsWith(`${pendingKey}:`)) {
          pendingItems.push({ key: storageKey, raw: localStorage.getItem(storageKey) });
        }
      }
      pendingItems.sort((a, b) => a.key.localeCompare(b.key));
      const pendingRaw = pendingItems.length ? pendingItems.map((item) => item.raw).join("\n") : null;
      const parsedPending = pendingItems.map((item) => {
        try {
          return { key: item.key, value: JSON.parse(item.raw) };
        } catch {
          return { key: item.key, value: { __invalid: true } };
        }
      });
      const pending = parsedPending.length === 1 ? parsedPending[0].value : parsedPending;
      return { local, idb, draftRaw, draft, pendingRaw, pending };
    },
    { key: KEY, draftKey: DRAFT, pendingKey: PENDING, dbName: DB, storeName: STORE }
  );
}

function summary(both) {
  const one = (snapshot) => ({
    revision: snapshot?._storageRevision ?? null,
    rows: snapshot?.log?.length ?? null,
    sets: snapshot?.program?.map((exercise) => exercise.sets) ?? null,
    jumpPct: snapshot?.settings?.jumpPct ?? null,
    minJump: snapshot?.settings?.minJump ?? null,
    programId: snapshot?.programMeta?.id ?? null,
    historyIds: snapshot?.programHistory?.map((entry) => entry.id) ?? null,
  });
  return {
    local: one(both.local),
    idb: one(both.idb),
    draftPresent: both.draftRaw !== null,
    pendingPresent: both.pendingRaw !== null,
  };
}

async function enterWorkout(page) {
  await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false }));
}

async function fillSet(page, set, { load, reps, rir }) {
  await page.locator(`[data-k="audit-press_${set}_load"]`).fill(String(load));
  await page.locator(`[data-k="audit-press_${set}_reps"]`).fill(String(reps));
  await page.locator(`[data-k="audit-press_${set}_rir"]`).fill(String(rir));
}

async function holdStorageLock(page) {
  await page.evaluate((lockName) => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    window.__auditReleaseStorageLock = release;
    window.__auditStorageLockHeld = false;
    window.__auditStorageLockDone = navigator.locks.request(lockName, async () => {
      window.__auditStorageLockHeld = true;
      await gate;
    });
  }, STORAGE_LOCK);
  await page.waitForFunction(() => window.__auditStorageLockHeld === true, { timeout: 10000 });
}

async function waitForPendingStorageLocks(page, count) {
  await page.waitForFunction(
    async ({ lockName, count }) => {
      const state = await navigator.locks.query();
      return state.pending.filter((lock) => lock.name === lockName).length >= count;
    },
    { lockName: STORAGE_LOCK, count },
    { timeout: 10000 }
  );
}

async function releaseStorageLock(page) {
  await page.evaluate(async () => {
    window.__auditReleaseStorageLock();
    await window.__auditStorageLockDone;
  });
}

async function scenarioUnloadWithTwoPendingIntents(browser) {
  console.log("\n1. Unload with Finish and Settings queued behind the real lock");
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const page = await openApp(context);
    const rev60 = fixture(60);
    await writeReplicas(page, { local: rev60, idb: rev60 });
    await reloadApp(page);
    const locker = await openApp(context);

    await enterWorkout(page);
    await fillSet(page, 1, { load: 72.5, reps: 9, rir: 1 });
    await page.waitForFunction((draftKey) => localStorage.getItem(draftKey) !== null, DRAFT);
    await holdStorageLock(locker);

    await page.evaluate(() => {
      window.__auditPendingFinish = window.__repforgeSaveWorkout();
    });
    await waitForPendingStorageLocks(locker, 1);
    await page.evaluate(() => {
      window.__repforgeShowSettings();
      document.querySelector("#jumpPct").value = "3.75";
      document.querySelector("#saveSettings").click();
    });

    const whileBlocked = await readBoth(page);
    check(
      whileBlocked.pendingRaw !== null &&
        !whileBlocked.pendingRaw.includes("_storageRevision") &&
        whileBlocked.draftRaw !== null,
      "precondition: synchronous pending data and the workout draft exist before either write gets the lock",
      { replicas: summary(whileBlocked), pending: whileBlocked.pending }
    );

    await page.close();
    await releaseStorageLock(locker);

    const recovered = await openApp(context);
    await recovered.evaluate(() => window.__repforgeStorage.flush());
    const final = await readBoth(recovered);
    const workoutSurvived =
      final.local?.log?.some((row) => row.exerciseId === "audit-press" && row.load === 72.5 && row.reps === 9) &&
      final.idb?.log?.some((row) => row.exerciseId === "audit-press" && row.load === 72.5 && row.reps === 9);
    const settingsSurvived =
      final.local?.settings?.jumpPct === 3.75 && final.idb?.settings?.jumpPct === 3.75;

    check(
      settingsSurvived,
      "later queued Settings intent replays after the writer unloads",
      { replicas: summary(final) }
    );
    check(
      workoutSurvived,
      "earlier accepted Finish intent also replays after the writer unloads",
      { replicas: summary(final), draft: final.draft }
    );
    check(
      final.pendingRaw === null,
      "successful boot replay drains the pending intents",
      { replicas: summary(final), pending: final.pending }
    );
  } finally {
    await context.close();
  }
}

async function scenarioIdbOnlyThenStaleSettings(browser) {
  console.log("\n2. IDB-only workout followed by two stale Settings saves");
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const writer = await openApp(context);
    const rev50 = fixture(50);
    await writeReplicas(writer, { local: rev50, idb: rev50 });
    await reloadApp(writer);
    const stale = await openApp(context);
    const beforeWorkout = await readBoth(writer);
    const beforeRevision = Math.max(
      beforeWorkout.local?._storageRevision ?? 0,
      beforeWorkout.idb?._storageRevision ?? 0
    );

    await enterWorkout(writer);
    await fillSet(writer, 1, { load: 60, reps: 10, rir: 1 });
    const accepted = await writer.evaluate(async (key) => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (candidate, value) {
        if (candidate === key) throw new Error("audit: forced local replica failure");
        return originalSetItem.call(this, candidate, value);
      };
      try {
        return await window.__repforgeSaveWorkout();
      } finally {
        Storage.prototype.setItem = originalSetItem;
      }
    }, KEY);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const oneSided = await readBoth(writer);

    check(
      accepted?.revision === beforeRevision + 1 &&
        accepted.localOk === false &&
        accepted.idbOk === true &&
        oneSided.local?._storageRevision === beforeRevision &&
        oneSided.local?.log?.length === 0 &&
        oneSided.idb?._storageRevision === accepted.revision &&
        oneSided.idb?.log?.length === 1,
      "precondition: the next workout revision is accepted only by IDB while local remains at the prior head",
      { beforeRevision, accepted, replicas: summary(oneSided) }
    );

    await holdStorageLock(writer);
    await stale.evaluate(() => {
      window.__repforgeShowSettings();
      document.querySelector("#jumpPct").value = "3.75";
      document.querySelector("#saveSettings").click();
    });
    await waitForPendingStorageLocks(writer, 1);
    const whileBlocked = await readBoth(stale);
    check(
      whileBlocked.local?._storageRevision === beforeRevision &&
        whileBlocked.idb?._storageRevision === accepted.revision &&
        whileBlocked.pendingRaw !== null &&
        !whileBlocked.pendingRaw.includes("_storageRevision") &&
        whileBlocked.pendingRaw.includes('"jumpPct":3.75'),
      "pre-lock unload safety journals the mutation without publishing an authoritative revision",
      { beforeRevision, accepted, replicas: summary(whileBlocked), pending: whileBlocked.pending }
    );
    await releaseStorageLock(writer);
    await stale.evaluate(() => window.__repforgeStorage.flush());
    const afterFirst = await readBoth(stale);

    await stale.evaluate(async () => {
      document.querySelector("#minJump").value = "1.25";
      document.querySelector("#saveSettings").click();
      await window.__repforgeStorage.flush();
    });
    const afterSecond = await readBoth(stale);

    const session = oneSided.idb.log[0].session;
    check(
      afterSecond.local?.log?.some((row) => row.session === session) &&
        afterSecond.idb?.log?.some((row) => row.session === session) &&
        afterSecond.local?.settings?.jumpPct === 3.75 &&
        afterSecond.idb?.settings?.jumpPct === 3.75 &&
        afterSecond.local?.settings?.minJump === 1.25 &&
        afterSecond.idb?.settings?.minJump === 1.25,
      "accepted IDB-only workout survives repeated Settings saves from a stale tab",
      { afterFirst: summary(afterFirst), afterSecond: summary(afterSecond), session }
    );

    await holdStorageLock(writer);
    await stale.evaluate(() => {
      document.querySelector("#hardRir").value = "5";
      document.querySelector("#saveSettings").click();
    });
    await waitForPendingStorageLocks(writer, 1);
    await stale.close();
    await releaseStorageLock(writer);
    const recovered = await openApp(context);
    const afterRecovery = await readBoth(recovered);
    check(
      afterRecovery.local?.settings?.hardRir === 5 &&
        afterRecovery.idb?.settings?.hardRir === 5 &&
        afterRecovery.local?.log?.some((row) => row.session === session) &&
        afterRecovery.idb?.log?.some((row) => row.session === session) &&
        afterRecovery.pendingRaw === null,
      "boot replays and clears the unversioned journal left by an unloaded writer",
      { replicas: summary(afterRecovery), session }
    );
  } finally {
    await context.close();
  }
}

async function scenarioBootHealRollback(browser) {
  console.log("\n3. Boot repair re-reads the durable head after waiting on the real lock");
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const setup = await openApp(context);
    const rev10 = fixture(10);
    await writeReplicas(setup, { local: rev10, idb: rev10 });
    await reloadApp(setup);
    const locker = await openApp(context);
    const baseline = await readBoth(setup);
    const baselineRevision = Math.max(
      baseline.local?._storageRevision ?? 0,
      baseline.idb?._storageRevision ?? 0
    );
    await writeIdb(setup, null);
    await holdStorageLock(locker);

    const booting = await context.newPage();
    await booting.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForPendingStorageLocks(locker, 1);

    const markerSession = "audit-boot-newer-session";
    const newer = JSON.parse(JSON.stringify(baseline.local));
    newer._storageRevision = baselineRevision + 1;
    newer.settings.jumpPct = 4.75;
    newer.log = [{
      session: markerSession,
      date: "2026-08-13",
      day: "Day 1",
      name: "Audit press",
      exerciseId: "audit-press",
      set: 1,
      load: 65,
      reps: 9,
      rir: 1,
      notes: "",
      created: "2026-08-13T12:00:00.000Z",
      primary: "Chest",
      secondary: "",
    }];
    await writeReplicas(locker, { local: newer, idb: newer });
    const beforeRelease = await readBoth(locker);

    await releaseStorageLock(locker);
    await waitForApp(booting);
    await booting.evaluate(() => window.__repforgeStorage.flush());
    const final = await readBoth(booting);

    check(
      beforeRelease.local?._storageRevision === newer._storageRevision &&
        beforeRelease.idb?._storageRevision === newer._storageRevision &&
        beforeRelease.local?.log?.some((row) => row.session === markerSession) &&
        beforeRelease.idb?.log?.some((row) => row.session === markerSession),
      "precondition: a newer semantic head is installed while boot repair is queued",
      { baselineRevision, installedRevision: newer._storageRevision, replicas: summary(beforeRelease) }
    );
    check(
      (final.local?._storageRevision ?? -1) >= newer._storageRevision &&
        (final.idb?._storageRevision ?? -1) >= newer._storageRevision &&
        final.local?.log?.some((row) => row.session === markerSession) &&
        final.idb?.log?.some((row) => row.session === markerSession) &&
        final.local?.settings?.jumpPct === 4.75 &&
        final.idb?.settings?.jumpPct === 4.75,
      "delayed boot repair preserves the relatively newer locked content",
      { installedRevision: newer._storageRevision, replicas: summary(final) }
    );
  } finally {
    await context.close();
  }
}

async function scenarioFinishClearsNewerSet(browser) {
  console.log("\n4. Set 2 entered while Finish waits on the real Web Lock");
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const page = await openApp(context);
    const rev20 = fixture(20);
    await writeReplicas(page, { local: rev20, idb: rev20 });
    await reloadApp(page);
    const locker = await openApp(context);

    await enterWorkout(page);
    await fillSet(page, 1, { load: 70, reps: 8, rir: 1 });
    await holdStorageLock(locker);
    await page.evaluate(() => {
      window.__auditFinishSet1 = window.__repforgeSaveWorkout();
    });
    await waitForPendingStorageLocks(locker, 1);

    const formState = await page.evaluate(() => {
      const form = document.querySelector("#logForm");
      const input = document.querySelector('[data-k="audit-press_2_load"]');
      return {
        inert: !!form?.inert,
        ariaBusy: form?.getAttribute("aria-busy") ?? null,
        inputEditable: !!input && !input.disabled && !input.readOnly,
      };
    });
    const formBlocked = formState.inert && formState.ariaBusy === "true";
    const editable = !formBlocked && formState.inputEditable;
    if (editable) await fillSet(page, 2, { load: 123.5, reps: 7, rir: 2 });
    const mid = await readBoth(page);
    const midDom = await page.evaluate(() => ({
      load: document.querySelector('[data-k="audit-press_2_load"]')?.value ?? null,
      reps: document.querySelector('[data-k="audit-press_2_reps"]')?.value ?? null,
      rir: document.querySelector('[data-k="audit-press_2_rir"]')?.value ?? null,
    }));
    const acceptedMid =
      editable &&
      midDom.load === "123.5" &&
      midDom.reps === "7" &&
      midDom.rir === "2" &&
      mid.draft?.["audit-press_2_load"] === "123.5" &&
      mid.draft?.["audit-press_2_reps"] === "7" &&
      mid.draft?.["audit-press_2_rir"] === "2";

    await releaseStorageLock(locker);
    const finishResult = await page.evaluate(() => window.__auditFinishSet1);
    await page.evaluate(() => window.__repforgeStorage.flush());
    const final = await readBoth(page);
    const finalDom = await page.evaluate(() => ({
      load: document.querySelector('[data-k="audit-press_2_load"]')?.value ?? null,
      reps: document.querySelector('[data-k="audit-press_2_reps"]')?.value ?? null,
      rir: document.querySelector('[data-k="audit-press_2_rir"]')?.value ?? null,
    }));
    const set2Persisted = final.idb?.log?.some(
      (row) => row.exerciseId === "audit-press" && row.set === 2 && row.load === 123.5 && row.reps === 7
    );
    const set2Drafted =
      final.draft?.["audit-press_2_load"] === "123.5" &&
      final.draft?.["audit-press_2_reps"] === "7" &&
      final.draft?.["audit-press_2_rir"] === "2";
    const formRestored = await page.evaluate(() => {
      const form = document.querySelector("#logForm");
      return !!form && !form.inert && form.getAttribute("aria-busy") === null;
    });

    check(
      finishResult?.localOk || finishResult?.idbOk,
      "precondition: Finish accepts the set 1 snapshot",
      finishResult
    );
    check(
      formRestored && (formBlocked || !acceptedMid || set2Persisted || set2Drafted),
      "Finish blocks the form before capture or preserves edits accepted while it waits",
      { formState, acceptedMid, set2Persisted, set2Drafted, formRestored, finalDom, replicas: summary(final) }
    );
  } finally {
    await context.close();
  }
}

async function scenarioDoubleBlockCompletion(browser) {
  console.log("\n5. Two tabs complete the same old block with different strategies");
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const first = await openApp(context);
    const rev30 = fixture(30);
    await writeReplicas(first, { local: rev30, idb: rev30 });
    await reloadApp(first);
    const second = await openApp(context);
    const locker = await openApp(context);
    const survivors = await locker.evaluate(
      ({ pendingKey, snapshot }) => {
        const clean = JSON.parse(JSON.stringify(snapshot));
        delete clean._storageRevision;
        const legacy = {
          id: "audit-legacy-survivor",
          base: clean,
          liveBase: clean,
          proposal: clean,
          replace: false,
          expectedProgramId: null,
        };
        const v2 = {
          version: 2,
          id: "audit-v2-survivor",
          order: { at: 1, writer: "audit-survivor", seq: 1 },
          base: clean,
          liveBase: clean,
          proposal: clean,
          replace: false,
          expectedProgramId: null,
        };
        const legacyRaw = JSON.stringify(legacy);
        const v2Key = `${pendingKey}:${v2.id}`;
        const v2Raw = JSON.stringify(v2);
        localStorage.setItem(pendingKey, legacyRaw);
        localStorage.setItem(v2Key, v2Raw);
        return { legacyRaw, v2Key, v2Raw };
      },
      { pendingKey: PENDING, snapshot: rev30 }
    );

    await holdStorageLock(locker);
    await first.evaluate((oldId) => {
      window.__auditFirstBlock = window.__repforgeCommitNextBlock("increase_volume", undefined, oldId);
    }, rev30.programMeta.id);
    await waitForPendingStorageLocks(locker, 1);
    await second.evaluate((oldId) => {
      window.__auditSecondBlock = window.__repforgeCommitNextBlock("reduce_volume", undefined, oldId);
    }, rev30.programMeta.id);
    await waitForPendingStorageLocks(locker, 2);

    await releaseStorageLock(locker);
    const [firstResult, secondResult] = await Promise.all([
      first.evaluate(() => window.__auditFirstBlock),
      second.evaluate(() => window.__auditSecondBlock),
    ]);
    await Promise.all([
      first.evaluate(() => window.__repforgeStorage.flush()),
      second.evaluate(() => window.__repforgeStorage.flush()),
    ]);
    const final = await readBoth(locker);
    const acceptedCount = [firstResult, secondResult].filter(
      (result) => result?.localOk || result?.idbOk
    ).length;
    const pendingAfter = await locker.evaluate(
      ({ pendingKey, v2Key }) => {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key === pendingKey || key?.startsWith(`${pendingKey}:`)) keys.push(key);
        }
        return {
          legacyRaw: localStorage.getItem(pendingKey),
          v2Raw: localStorage.getItem(v2Key),
          keys: keys.sort(),
        };
      },
      { pendingKey: PENDING, v2Key: survivors.v2Key }
    );

    check(
      firstResult?.localOk || firstResult?.idbOk,
      "precondition: the first block completion is accepted",
      firstResult
    );
    check(
      acceptedCount === 1 &&
        !(secondResult?.localOk || secondResult?.idbOk) &&
        final.local?.program?.[0]?.sets === 3 &&
        final.idb?.program?.[0]?.sets === 3 &&
        final.local?.programHistory?.filter((entry) => entry.id === rev30.programMeta.id).length === 1 &&
        final.idb?.programHistory?.filter((entry) => entry.id === rev30.programMeta.id).length === 1,
      "only one strategy can complete a captured old program ID",
      { firstResult, secondResult, acceptedCount, replicas: summary(final) }
    );
    check(
      pendingAfter.legacyRaw === survivors.legacyRaw &&
        pendingAfter.v2Raw === survivors.v2Raw &&
        pendingAfter.keys.length === 2 &&
        pendingAfter.keys.includes(PENDING) &&
        pendingAfter.keys.includes(survivors.v2Key),
      "accepted and duplicate cleanup remove only their exact records beside legacy and v2 journals",
      { survivors, pendingAfter }
    );
  } finally {
    await context.close();
  }
}

async function scenarioAcceptedCleanupOverlappingBoot(browser) {
  console.log("\n6. Accepted writer releases its lock while another tab boots");
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const writer = await openApp(context);
    const rev70 = fixture(70);
    await writeReplicas(writer, { local: rev70, idb: rev70 });
    await reloadApp(writer);
    const locker = await openApp(context);
    const before = await readBoth(writer);
    const beforeRevision = Math.max(
      before.local?._storageRevision ?? 0,
      before.idb?._storageRevision ?? 0
    );
    await writer.evaluate((lockName) => {
      const originalRequest = LockManager.prototype.request;
      let releaseReturnedPromise;
      const returnedPromiseGate = new Promise((resolve) => {
        releaseReturnedPromise = resolve;
      });
      window.__auditReleaseReturnedLockPromise = releaseReturnedPromise;
      window.__auditNativeLockReleased = false;
      window.__auditDelayedStorageRequest = false;
      LockManager.prototype.request = function (name, ...args) {
        const released = originalRequest.call(this, name, ...args);
        if (name !== lockName || window.__auditDelayedStorageRequest) return released;
        window.__auditDelayedStorageRequest = true;
        return released.then(async (value) => {
          window.__auditNativeLockReleased = true;
          await returnedPromiseGate;
          return value;
        });
      };
    }, STORAGE_LOCK);

    await holdStorageLock(locker);
    await writer.evaluate(() => {
      window.__repforgeShowSettings();
      document.querySelector("#jumpPct").value = "3.75";
      document.querySelector("#saveSettings").click();
    });
    await waitForPendingStorageLocks(locker, 1);
    const pending = await readBoth(writer);

    const booting = await context.newPage();
    await booting.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForPendingStorageLocks(locker, 2);

    await releaseStorageLock(locker);
    await writer.waitForFunction(() => window.__auditNativeLockReleased === true);
    await waitForApp(booting);
    const overlap = await readBoth(booting);
    await writer.evaluate(() => window.__auditReleaseReturnedLockPromise());
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readBoth(booting);

    check(
      pending.pendingRaw !== null && pending.pendingRaw.includes('"jumpPct":3.75'),
      "precondition: the accepted writer has a durable pending intent before it receives the lock",
      { replicas: summary(pending), pending: pending.pending }
    );
    check(
      overlap.local?._storageRevision === beforeRevision + 1 &&
        overlap.idb?._storageRevision === beforeRevision + 1 &&
        final.local?._storageRevision === beforeRevision + 1 &&
        final.idb?._storageRevision === beforeRevision + 1 &&
        final.local?.settings?.jumpPct === 3.75 &&
        final.idb?.settings?.jumpPct === 3.75 &&
        final.pendingRaw === null,
      "a boot queued behind an accepted writer cannot replay that writer's intent",
      {
        beforeRevision,
        expectedRevision: beforeRevision + 1,
        overlap: summary(overlap),
        final: summary(final),
        pending: final.pending,
      }
    );
  } finally {
    await context.close();
  }
}

async function scenarioReplayReturnsAcceptedHeadBeforeFailedTail(browser) {
  console.log("\n7. Ordered boot replay accepts its head before the tail totally fails");
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const setup = await openApp(context);
    const rev80 = fixture(80);
    await writeReplicas(setup, { local: rev80, idb: rev80 });
    await reloadApp(setup);
    await setup.evaluate(() => window.__repforgeStorage.flush());
    const seeded = await readBoth(setup);
    const base = seeded.local;
    const baseRevision = base?._storageRevision ?? 0;
    const journals = await setup.evaluate(
      ({ pendingKey, base }) => {
        const clean = JSON.parse(JSON.stringify(base));
        delete clean._storageRevision;
        const firstProposal = JSON.parse(JSON.stringify(clean));
        firstProposal.settings.jumpPct = 3.75;
        const secondProposal = JSON.parse(JSON.stringify(firstProposal));
        secondProposal.settings.minJump = 1.25;
        const first = {
          version: 2,
          id: "audit-replay-head",
          order: { at: 100, writer: "audit-replay", seq: 1 },
          base: clean,
          liveBase: clean,
          proposal: firstProposal,
          replace: false,
          expectedProgramId: null,
        };
        const second = {
          version: 2,
          id: "audit-replay-tail",
          order: { at: 101, writer: "audit-replay", seq: 2 },
          base: clean,
          liveBase: clean,
          proposal: secondProposal,
          replace: false,
          expectedProgramId: null,
        };
        const firstKey = `${pendingKey}:${first.id}`;
        const secondKey = `${pendingKey}:${second.id}`;
        localStorage.setItem(firstKey, JSON.stringify(first));
        localStorage.setItem(secondKey, JSON.stringify(second));
        return { firstKey, secondKey };
      },
      { pendingKey: PENDING, base }
    );

    const booting = await context.newPage();
    await booting.addInitScript(
      ({ key, failRevision }) => {
        const originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (candidate, value) {
          if (candidate === key) {
            try {
              if (JSON.parse(value)?._storageRevision === failRevision) {
                throw new Error("audit: reject replay tail in localStorage");
              }
            } catch (error) {
              if (String(error).includes("audit:")) throw error;
            }
          }
          return originalSetItem.call(this, candidate, value);
        };
        const originalPut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (value, candidate) {
          if (candidate === key && value?._storageRevision === failRevision) {
            throw new Error("audit: reject replay tail in IndexedDB");
          }
          return originalPut.apply(this, arguments);
        };
      },
      { key: KEY, failRevision: baseRevision + 2 }
    );
    await booting.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(booting);
    const final = await readBoth(booting);
    const live = await booting.evaluate(() => {
      window.__repforgeShowSettings();
      return {
        jumpPct: Number(document.querySelector("#jumpPct")?.value),
        minJump: Number(document.querySelector("#minJump")?.value),
      };
    });
    const pendingAfter = await booting.evaluate(
      ({ firstKey, secondKey }) => ({
        first: localStorage.getItem(firstKey),
        second: localStorage.getItem(secondKey),
      }),
      journals
    );

    check(
      final.local?._storageRevision === baseRevision + 1 &&
        final.idb?._storageRevision === baseRevision + 1 &&
        final.local?.settings?.jumpPct === 3.75 &&
        final.idb?.settings?.jumpPct === 3.75 &&
        final.local?.settings?.minJump === base.settings.minJump &&
        final.idb?.settings?.minJump === base.settings.minJump &&
        live.jumpPct === 3.75 &&
        live.minJump === base.settings.minJump &&
        pendingAfter.first === null &&
        pendingAfter.second !== null,
      "ordered replay returns the accepted head and retains the totally failed tail",
      {
        baseRevision,
        replicas: summary(final),
        live,
        pendingAfter: {
          firstPresent: pendingAfter.first !== null,
          secondPresent: pendingAfter.second !== null,
        },
      }
    );
  } finally {
    await context.close();
  }
}

async function runScenario(name, fn) {
  try {
    await fn();
  } catch (error) {
    failures.push(`${name}: harness error`);
    console.error(`  ✗ ${name}: harness error`);
    console.error(error?.stack || error);
  }
}

const browser = await launchChromium();
try {
  await runScenario("unload with two pending intents", () => scenarioUnloadWithTwoPendingIntents(browser));
  await runScenario("IDB-only then stale Settings", () => scenarioIdbOnlyThenStaleSettings(browser));
  await runScenario("boot heal rollback", () => scenarioBootHealRollback(browser));
  await runScenario("Finish clears newer set", () => scenarioFinishClearsNewerSet(browser));
  await runScenario("double block completion", () => scenarioDoubleBlockCompletion(browser));
  await runScenario("accepted cleanup overlapping boot", () => scenarioAcceptedCleanupOverlappingBoot(browser));
  await runScenario("accepted replay head before failed tail", () =>
    scenarioReplayReturnsAcceptedHeadBeforeFailedTail(browser)
  );
} finally {
  await browser.close();
}

if (failures.length) {
  throw new Error(`thermonuclear persistence repros: ${failures.length} failed`);
}
console.log("\nPASS: thermonuclear persistence repros");
