#!/usr/bin/env node
/**
 * Deterministic production-path repros for twelve cross-tab persistence races.
 * Requires the repository root at REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";
import {
  clearPersistenceArtifacts,
  inventoryPersistenceArtifacts,
} from "./persistence-artifacts.mjs";

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
      typeof window.__repforgeCommitNextBlock === "function" &&
      typeof window.__repforgeFinalizeProgramSetup === "function",
    { timeout: 15000 }
  );
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(() => {
    const onboarding = document.querySelector("#onboarding");
    window.closeFirstRun?.();
    if (onboarding?.classList.contains("active")) window.closeOnboarding?.();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden")) window.closeTour?.();
    window.__testFinalizeCurrentProgram = (io) => {
      const current = JSON.parse(localStorage.getItem("repforge_v1") || "null");
      const source = current.program[0];
      const exercises = Array.from({ length: 18 }, (_, index) => ({
        ...source,
        id: `beginner-exercise-${index + 1}`,
        day: `Day ${Math.floor(index / 6) + 1}`,
        order: (index % 6) + 1,
        name: `Beginner exercise ${index + 1}`,
      }));
      return window.__repforgeFinalizeProgramSetup({
        exercises,
        name: "Beginner program",
        answers: { goal: current.programMeta?.goal || "hypertrophy" },
        destination: "log",
        origin: "settings",
        draftConfirmed: true,
      }, io);
    };
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
  if (clearDraft) await clearPersistenceArtifacts(page);
  await page.evaluate(
    async ({
      key,
      draftKey,
      dbName,
      storeName,
      local,
      idb,
      clearDraft,
    }) => {
      if (local == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(local));
      if (clearDraft) localStorage.removeItem(draftKey);
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
    {
      key: KEY,
      draftKey: DRAFT,
      dbName: DB,
      storeName: STORE,
      local,
      idb,
      clearDraft,
    }
  );
  const seeded = await readBoth(page);
  if (
    JSON.stringify(seeded.local) !== JSON.stringify(local) ||
    JSON.stringify(seeded.idb) !== JSON.stringify(idb) ||
    (clearDraft &&
      (seeded.draftRaw !== null ||
        seeded.persistenceArtifacts.length !== 0))
  ) {
    throw new Error(`isolated replica seed failed: ${JSON.stringify(summary(seeded))}`);
  }
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
  const runtime = await page.evaluate(
    async ({ key, draftKey, dbName, storeName }) => {
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
      return {
        local,
        idb,
        draftRaw,
        draft,
      };
    },
    {
      key: KEY,
      draftKey: DRAFT,
      dbName: DB,
      storeName: STORE,
    }
  );
  const artifacts = await inventoryPersistenceArtifacts(page);
  const pendingRaw = artifacts.pendingEntries.length
    ? artifacts.pendingEntries.map((entry) => entry.raw).join("\n")
    : null;
  const pending =
    artifacts.pendingEntries.length === 1
      ? artifacts.pendingEntries[0].value
      : artifacts.pendingEntries;
  return {
    ...runtime,
    pendingRaw,
    pending,
    pendingEntries: artifacts.pendingEntries,
    draftPendingEntries: artifacts.draftPendingEntries,
    closingMarkerEntries: artifacts.closingMarkerEntries,
    draftArtifacts: artifacts.draftArtifacts.map((entry) => entry.key),
    persistenceArtifactEntries: artifacts.entries,
    persistenceArtifacts: artifacts.keys,
  };
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

async function openProgramEditor(page) {
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#program.view.active", { timeout: 5000 });
  if (await page.locator("#programEditorWrap").evaluate((element) =>
    element.classList.contains("is-hidden")
  )) {
    await page.click("#programEditToggle");
  }
  await page.waitForSelector("#programEditorWrap:not(.is-hidden)", { timeout: 5000 });
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
      final.persistenceArtifacts.length === 0,
      "successful boot replay drains the pending intents",
      { replicas: summary(final), pending: final.pending, artifacts: final.persistenceArtifacts }
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
    check(
      oneSided.draftRaw === null && oneSided.persistenceArtifacts.length === 0,
      "one-store Finish acceptance applies its draft receipt and clears only its record",
      { accepted, replicas: summary(oneSided), artifacts: oneSided.persistenceArtifacts }
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
        afterRecovery.persistenceArtifacts.length === 0,
      "boot replays and clears the unversioned journal left by an unloaded writer",
      { replicas: summary(afterRecovery), session, artifacts: afterRecovery.persistenceArtifacts }
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
    const artifactsAfter = await inventoryPersistenceArtifacts(locker);
    const pendingAfter = {
      legacyRaw: artifactsAfter.entries.find((entry) => entry.key === PENDING)?.raw ?? null,
      v2Raw:
        artifactsAfter.entries.find((entry) => entry.key === survivors.v2Key)?.raw ?? null,
      keys: artifactsAfter.keys,
    };

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
        final.persistenceArtifacts.length === 0,
      "a boot queued behind an accepted writer cannot replay that writer's intent",
      {
        beforeRevision,
        expectedRevision: beforeRevision + 1,
        overlap: summary(overlap),
        final: summary(final),
        pending: final.pending,
        artifacts: final.persistenceArtifacts,
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
    const artifactsAfter = await inventoryPersistenceArtifacts(booting);
    const pendingAfter = {
      first: artifactsAfter.entries.find((entry) => entry.key === journals.firstKey)?.raw ?? null,
      second:
        artifactsAfter.entries.find((entry) => entry.key === journals.secondKey)?.raw ?? null,
      keys: artifactsAfter.keys,
    };

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
        pendingAfter.second !== null &&
        pendingAfter.keys.length === 1 &&
        pendingAfter.keys[0] === journals.secondKey,
      "ordered replay returns the accepted head and retains the totally failed tail",
      {
        baseRevision,
        replicas: summary(final),
        live,
        pendingAfter: {
          firstPresent: pendingAfter.first !== null,
          secondPresent: pendingAfter.second !== null,
          keys: pendingAfter.keys,
        },
      }
    );
  } finally {
    await context.close();
  }
}

async function scenarioBootReplayFinishClearsCapturedDraft(browser) {
  console.log("\n8. Boot replay of an accepted Finish clears only its captured draft");
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const writer = await openApp(context);
    const rev90 = fixture(90);
    await writeReplicas(writer, { local: rev90, idb: rev90 });
    await reloadApp(writer);
    const locker = await openApp(context);

    await enterWorkout(writer);
    await fillSet(writer, 1, { load: 77.5, reps: 9, rir: 1 });
    await writer.waitForFunction((draftKey) => localStorage.getItem(draftKey) !== null, DRAFT);
    const capturedDraftRaw = await writer.evaluate((draftKey) => localStorage.getItem(draftKey), DRAFT);

    await holdStorageLock(locker);
    await writer.evaluate(() => {
      window.__auditInterruptedFinish = window.__repforgeSaveWorkout();
    });
    await waitForPendingStorageLocks(locker, 1);

    const blocked = await readBoth(writer);
    const finishRecord = blocked.pendingEntries[0];
    check(
      blocked.pendingEntries.length === 1 &&
        finishRecord.key !== PENDING &&
        finishRecord.key.startsWith(`${PENDING}:`) &&
        blocked.draftRaw === capturedDraftRaw,
      "precondition: Finish owns a distinct pending entry beside its exact draft",
      {
        pendingKeys: blocked.pendingEntries.map((entry) => entry.key),
        draftMatches: blocked.draftRaw === capturedDraftRaw,
      }
    );
    check(
      finishRecord.value?.effect?.kind === "clear-draft" &&
        finishRecord.value.effect.expectedRaw === capturedDraftRaw,
      "the immutable Finish intent records an exact conditional draft receipt",
      { effect: finishRecord.value?.effect, capturedDraftRaw }
    );

    await writer.close();
    await releaseStorageLock(locker);

    const recovered = await openApp(context);
    await recovered.evaluate(() => window.__repforgeStorage.flush());
    const replayed = await readBoth(recovered);
    const localSessions = new Set((replayed.local?.log || []).map((row) => row.session));
    const idbSessions = new Set((replayed.idb?.log || []).map((row) => row.session));
    const savedSession = [...localSessions][0];

    check(
      localSessions.size === 1 &&
        idbSessions.size === 1 &&
        idbSessions.has(savedSession) &&
        replayed.local.log.filter((row) => row.session === savedSession).length === 1 &&
        replayed.idb.log.filter((row) => row.session === savedSession).length === 1,
      "boot replay makes exactly one session durable in both replicas",
      { replicas: summary(replayed), localSessions: [...localSessions], idbSessions: [...idbSessions] }
    );
    check(
      replayed.draftRaw === null && replayed.persistenceArtifacts.length === 0,
      "boot replay clears the exact captured draft and its accepted record",
      {
        replicas: summary(replayed),
        artifacts: replayed.persistenceArtifacts,
        draft: replayed.draftRaw,
      }
    );

    await enterWorkout(recovered);
    await recovered.evaluate(() => window.__repforgeSaveWorkout());
    await recovered.evaluate(() => window.__repforgeStorage.flush());
    const afterNormalFinish = await readBoth(recovered);
    const localSessionsAfter = new Set((afterNormalFinish.local?.log || []).map((row) => row.session));
    const idbSessionsAfter = new Set((afterNormalFinish.idb?.log || []).map((row) => row.session));
    check(
      localSessionsAfter.size === 1 &&
        idbSessionsAfter.size === 1 &&
        localSessionsAfter.has(savedSession) &&
        idbSessionsAfter.has(savedSession) &&
        afterNormalFinish.persistenceArtifacts.length === 0,
      "the normal Finish flow cannot save the replayed session again",
      {
        replicas: summary(afterNormalFinish),
        localSessions: [...localSessionsAfter],
        idbSessions: [...idbSessionsAfter],
        artifacts: afterNormalFinish.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function scenarioInPageFinishPreservesNewerDraft(browser) {
  console.log("\n9. In-page Finish preserves a newer cross-tab draft");
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const writer = await openApp(context);
    const rev100 = fixture(100);
    await writeReplicas(writer, { local: rev100, idb: rev100 });
    await reloadApp(writer);
    const locker = await openApp(context);

    await enterWorkout(writer);
    await fillSet(writer, 1, { load: 82.5, reps: 8, rir: 1 });
    await writer.waitForFunction((draftKey) => localStorage.getItem(draftKey) !== null, DRAFT);
    const capturedDraftRaw = await writer.evaluate((draftKey) => localStorage.getItem(draftKey), DRAFT);

    await holdStorageLock(locker);
    await writer.evaluate(() => {
      window.__auditInPageFinish = window.__repforgeSaveWorkout();
    });
    await waitForPendingStorageLocks(locker, 1);

    const newerDraftRaw = await locker.evaluate(
      ({ draftKey, captured }) => {
        const draft = JSON.parse(captured);
        draft.__auditNewerDraft = "cross-tab";
        draft.__done = [];
        draft.__touched = ["audit-press_2"];
        delete draft["audit-press_1_load"];
        delete draft["audit-press_1_reps"];
        delete draft["audit-press_1_rir"];
        draft["audit-press_2_load"] = "42.5";
        draft["audit-press_2_reps"] = "11";
        draft["audit-press_2_rir"] = "2";
        const raw = JSON.stringify(draft);
        localStorage.setItem(draftKey, raw);
        return raw;
      },
      { draftKey: DRAFT, captured: capturedDraftRaw }
    );

    await releaseStorageLock(locker);
    const finishResult = await writer.evaluate(() => window.__auditInPageFinish);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readBoth(writer);
    const ui = await writer.evaluate(() => ({
      formReady:
        !document.querySelector("#logForm")?.inert &&
        document.querySelector("#logForm")?.getAttribute("aria-busy") === null,
      set1Suggested: document.querySelector('[data-set="audit-press_1"]')?.classList.contains("is-suggested"),
      set1Done: document.querySelector('[data-set="audit-press_1"]')?.classList.contains("is-done"),
      set2Suggested: document.querySelector('[data-set="audit-press_2"]')?.classList.contains("is-suggested"),
      set2Load: document.querySelector('[data-k="audit-press_2_load"]')?.value ?? null,
    }));

    check(
      (finishResult?.localOk || finishResult?.idbOk) &&
        final.local?.log?.length === 1 &&
        final.idb?.log?.length === 1 &&
        final.persistenceArtifacts.length === 0,
      "precondition: the captured Finish is accepted and only its record is cleaned",
      { finishResult, replicas: summary(final), artifacts: final.persistenceArtifacts }
    );
    check(
      final.draftRaw === newerDraftRaw,
      "accepted in-page Finish compare-and-clears without deleting newer draft bytes",
      {
        capturedMatches: final.draftRaw === capturedDraftRaw,
        newerMatches: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      ui.formReady &&
        ui.set1Suggested === true &&
        ui.set1Done === false &&
        ui.set2Suggested === false &&
        ui.set2Load === "42.5",
      "the finishing tab resets stale collections and renders the preserved newer draft",
      ui
    );

    const fresh = await openApp(context);
    const afterFreshBoot = await readBoth(fresh);
    check(
      afterFreshBoot.draftRaw === newerDraftRaw &&
        (afterFreshBoot.local?.log?.length ?? 0) === 1 &&
        (afterFreshBoot.idb?.log?.length ?? 0) === 1,
      "a fresh boot retains the newer draft beside the accepted session",
      { replicas: summary(afterFreshBoot), draftMatches: afterFreshBoot.draftRaw === newerDraftRaw }
    );
  } finally {
    await context.close();
  }
}

async function scenarioTotalFinishFailureIsDurablyRejected(browser) {
  console.log("\n10. Total Finish failure is durably rejected");
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const page = await openApp(context);
    const rev110 = fixture(110);
    await writeReplicas(page, { local: rev110, idb: rev110 });
    await reloadApp(page);

    await enterWorkout(page);
    await fillSet(page, 1, { load: 87.5, reps: 8, rir: 1 });
    await page.waitForFunction((draftKey) => localStorage.getItem(draftKey) !== null, DRAFT);
    const capturedDraftRaw = await page.evaluate((draftKey) => localStorage.getItem(draftKey), DRAFT);
    const result = await page.evaluate(
      async ({ key }) => {
        const originalSetItem = Storage.prototype.setItem;
        const originalPut = IDBObjectStore.prototype.put;
        Storage.prototype.setItem = function (candidate) {
          if (candidate === key) throw new Error("audit: reject Finish local replica");
          return originalSetItem.apply(this, arguments);
        };
        IDBObjectStore.prototype.put = function (_value, candidate) {
          if (candidate === key) throw new Error("audit: reject Finish IDB replica");
          return originalPut.apply(this, arguments);
        };
        try {
          return await window.__repforgeSaveWorkout();
        } finally {
          Storage.prototype.setItem = originalSetItem;
          IDBObjectStore.prototype.put = originalPut;
        }
      },
      { key: KEY }
    );
    const failed = await readBoth(page);

    check(
      result?.localOk === false &&
        result?.idbOk === false &&
        (failed.local?.log?.length ?? 0) === 0 &&
        (failed.idb?.log?.length ?? 0) === 0,
      "precondition: neither replica accepts the Finish state",
      { result, replicas: summary(failed) }
    );
    check(
      failed.persistenceArtifacts.length === 0 && failed.draftRaw === capturedDraftRaw,
      "total failure drains the rejected Finish intent and preserves the exact draft",
      {
        pendingCount: failed.pendingEntries.length,
        draftMatches: failed.draftRaw === capturedDraftRaw,
        artifacts: failed.persistenceArtifacts,
      }
    );
    await reloadApp(page);
    const reloaded = await readBoth(page);
    check(
      (reloaded.local?.log?.length ?? 0) === 0 &&
        (reloaded.idb?.log?.length ?? 0) === 0 &&
        reloaded.persistenceArtifacts.length === 0 &&
        reloaded.draftRaw === capturedDraftRaw,
      "a Finish reported as rejected cannot commit on boot",
      {
        replicas: summary(reloaded),
        draftMatches: reloaded.draftRaw === capturedDraftRaw,
        artifacts: reloaded.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function scenarioLegacyNoEffectAndMalformedRequiredEffect(browser) {
  console.log("\n11. Legacy no-effect replay and malformed required v2 rejection");
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const setup = await openApp(context);
    const rev120 = fixture(120);
    await writeReplicas(setup, { local: rev120, idb: rev120 });
    await reloadApp(setup);

    const seeded = await setup.evaluate(
      ({ pendingKey, draftKey, snapshot }) => {
        const base = JSON.parse(JSON.stringify(snapshot));
        delete base._storageRevision;
        const legacyProposal = JSON.parse(JSON.stringify(base));
        legacyProposal.settings.jumpPct = 3.75;
        const corruptProposal = JSON.parse(JSON.stringify(base));
        corruptProposal.settings.minJump = 1.25;
        const draftRaw = JSON.stringify({ __touched: ["audit-press_1"], marker: "must-survive" });
        const legacy = {
          id: "audit-legacy-effect",
          base,
          liveBase: base,
          proposal: legacyProposal,
          replace: false,
          expectedProgramId: null,
          effect: { kind: "clear-draft", expectedRaw: draftRaw },
        };
        const corrupt = {
          version: 2,
          id: "audit-corrupt-effect",
          order: { at: 200, writer: "audit-corrupt", seq: 1 },
          base,
          liveBase: base,
          proposal: corruptProposal,
          replace: false,
          expectedProgramId: null,
          effect: { required: true, kind: "clear-draft", expectedRaw: { not: "raw bytes" } },
        };
        const corruptKey = `${pendingKey}:${corrupt.id}`;
        localStorage.setItem(draftKey, draftRaw);
        localStorage.setItem(pendingKey, JSON.stringify(legacy));
        localStorage.setItem(corruptKey, JSON.stringify(corrupt));
        return { draftRaw, corruptKey };
      },
      { pendingKey: PENDING, draftKey: DRAFT, snapshot: rev120 }
    );
    await setup.close();

    const recovered = await openApp(context);
    const final = await readBoth(recovered);
    check(
      final.local?.settings?.jumpPct === 3.75 &&
        final.idb?.settings?.jumpPct === 3.75 &&
        final.local?.settings?.minJump === 2.5 &&
        final.idb?.settings?.minJump === 2.5 &&
        final.persistenceArtifacts.length === 0,
      "legacy no-effect state replays while malformed required v2 state fails closed",
      { replicas: summary(final), artifacts: final.persistenceArtifacts, seeded }
    );
    check(
      final.draftRaw === seeded.draftRaw,
      "legacy metadata and a malformed required effect cannot clear a draft",
      { draftMatches: final.draftRaw === seeded.draftRaw }
    );
    check(
      !Object.prototype.hasOwnProperty.call(final.local || {}, "effect") &&
        !Object.prototype.hasOwnProperty.call(final.idb || {}, "effect"),
      "journal effect metadata never becomes authoritative app state",
      { localKeys: Object.keys(final.local || {}), idbKeys: Object.keys(final.idb || {}) }
    );
  } finally {
    await context.close();
  }
}

async function scenarioDeferredOnboardingCannotSupersedeRepeat(browser) {
  console.log("\n12. Deferred onboarding loses to a committed Repeat successor");
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const onboarding = await openApp(context);
    const rev130 = fixture(130);
    await writeReplicas(onboarding, { local: rev130, idb: rev130 });
    await reloadApp(onboarding);
    const repeat = await openApp(context);
    const locker = await openApp(context);
    const baseline = await readBoth(locker);
    const baselineRevision = baseline.local?._storageRevision;

    const deferred = await onboarding.evaluate((oldId) =>
      window.__repforgeCommitNextBlock("onboarding", undefined, oldId), rev130.programMeta.id);
    const captured = await onboarding.evaluate(() => ({
      origin: window.__repforgeOnboardingOrigin(),
      oldProgramId: window.__repforgePendingBlock()?.oldProgramId ?? null,
      onboardingActive: document.querySelector("#onboarding")?.classList.contains("active") === true,
    }));

    await holdStorageLock(locker);
    await repeat.evaluate((oldId) => {
      window.__auditRepeatSuccessor = window.__repforgeCommitNextBlock("repeat", undefined, oldId);
    }, rev130.programMeta.id);
    await waitForPendingStorageLocks(locker, 1);
    await releaseStorageLock(locker);
    const repeatResult = await repeat.evaluate(() => window.__auditRepeatSuccessor);
    await repeat.evaluate(() => window.__repforgeStorage.flush());
    const afterRepeat = await readBoth(locker);
    const repeatId = afterRepeat.local?.programMeta?.id;
    const repeatRevision = afterRepeat.local?._storageRevision;

    const recovery = await onboarding.evaluate(
      ({ draftKey, pendingKey, snapshot }) => {
        const draftRaw = JSON.stringify({
          __touched: ["audit-press_1"],
          "audit-press_1_load": "91.5",
          "audit-press_1_reps": "8",
          "audit-press_1_rir": "1",
        });
        localStorage.setItem(draftKey, draftRaw);
        const clean = JSON.parse(JSON.stringify(snapshot));
        delete clean._storageRevision;
        const survivor = {
          version: 2,
          id: "audit-onboarding-survivor",
          order: { at: 300, writer: "audit-onboarding", seq: 1 },
          base: clean,
          liveBase: clean,
          proposal: clean,
          replace: false,
          expectedProgramId: null,
        };
        const survivorKey = `${pendingKey}:${survivor.id}`;
        const survivorRaw = JSON.stringify(survivor);
        localStorage.setItem(survivorKey, survivorRaw);
        return { draftRaw, survivorKey, survivorRaw };
      },
      { draftKey: DRAFT, pendingKey: PENDING, snapshot: afterRepeat.local }
    );

    const staleResult = await onboarding.evaluate(
      ({ exercises }) => window.__repforgeFinalizeProgramSetup({
        exercises,
        name: "Stale onboarding successor",
        answers: { goal: "hypertrophy" },
        destination: "log",
        origin: "block",
        draftConfirmed: true,
      }),
      { exercises: rev130.program }
    );
    await onboarding.evaluate(() => window.__repforgeStorage.flush());
    const final = await readBoth(locker);
    const staleUi = await onboarding.evaluate(() => ({
      origin: window.__repforgeOnboardingOrigin(),
      oldProgramId: window.__repforgePendingBlock()?.oldProgramId ?? null,
      onboardingActive: document.querySelector("#onboarding")?.classList.contains("active") === true,
    }));
    const artifactsAfter = await inventoryPersistenceArtifacts(locker);
    const pendingAfter = {
      survivorRaw:
        artifactsAfter.entries.find((entry) => entry.key === recovery.survivorKey)?.raw ??
        null,
      keys: artifactsAfter.keys,
    };
    const staleJournalKeys = pendingAfter.keys.filter((key) => key !== recovery.survivorKey);

    check(
      deferred?.kind === "deferred" &&
        captured.origin === "block" &&
        captured.oldProgramId === rev130.programMeta.id &&
        captured.onboardingActive,
      "precondition: Tab A defers onboarding with the old program identity captured",
      { deferred, captured }
    );
    check(
      (repeatResult?.localOk || repeatResult?.idbOk) &&
        repeatResult.kind === "committed" &&
        repeatId &&
        repeatId !== rev130.programMeta.id &&
        repeatRevision === baselineRevision + 1,
      "precondition: Tab B commits a Repeat successor through the real Web Lock",
      { baselineRevision, repeatResult, replicas: summary(afterRepeat) }
    );
    check(
      staleResult?.kind === "duplicate" &&
        staleResult.committed === false &&
        staleResult.duplicate === true &&
        staleResult.localOk === false &&
        staleResult.idbOk === false,
      "Tab A reports the stale block finalization as a standardized duplicate",
      staleResult
    );
    check(
      final.local?.programMeta?.id === repeatId &&
        final.idb?.programMeta?.id === repeatId &&
        final.local?._storageRevision === repeatRevision &&
        final.idb?._storageRevision === repeatRevision &&
        final.local?.programHistory?.filter((entry) => entry.id === rev130.programMeta.id).length === 1 &&
        final.idb?.programHistory?.filter((entry) => entry.id === rev130.programMeta.id).length === 1,
      "the stale finalizer preserves Tab B's successor, archive, and revision",
      { repeatId, repeatRevision, replicas: summary(final) }
    );
    check(
      final.draftRaw === recovery.draftRaw &&
        staleUi.origin === "block" &&
        staleUi.oldProgramId === rev130.programMeta.id &&
        staleUi.onboardingActive,
      "Tab A keeps its onboarding state and exact draft available for recovery or cancel",
      { staleUi, draftMatches: final.draftRaw === recovery.draftRaw }
    );
    check(
      pendingAfter.survivorRaw === recovery.survivorRaw &&
        staleJournalKeys.length === 0,
      "duplicate cleanup drains only Tab A's stale intent",
      { recovery, pendingAfter, staleJournalKeys }
    );
  } finally {
    await context.close();
  }
}

async function scenarioConcurrentWholeProgramReplacements(browser) {
  console.log("\n13. Concurrent whole-program replacements use one captured identity");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const first = await openApp(context);
    const baseline = fixture(140);
    await writeReplicas(first, { local: baseline, idb: baseline });
    await reloadApp(first);
    const second = await openApp(context);
    const locker = await openApp(context);

    await holdStorageLock(locker);
    await first.evaluate(() => {
      window.__auditFirstReplacement = window.__testFinalizeCurrentProgram();
    });
    await waitForPendingStorageLocks(locker, 1);
    await second.evaluate(() => {
      window.__auditSecondReplacement = window.__testFinalizeCurrentProgram();
    });
    await waitForPendingStorageLocks(locker, 2);
    await releaseStorageLock(locker);

    const [firstResult, secondResult] = await Promise.all([
      first.evaluate(() => window.__auditFirstReplacement),
      second.evaluate(() => window.__auditSecondReplacement),
    ]);
    await Promise.all([
      first.evaluate(() => window.__repforgeStorage.flush()),
      second.evaluate(() => window.__repforgeStorage.flush()),
    ]);
    const final = await readBoth(locker);
    const acceptedCount = [firstResult, secondResult].filter(
      (result) => result?.localOk || result?.idbOk
    ).length;
    const semanticSlots = (final.local?.program || []).map(
      (exercise) => `${exercise.day}\u0000${exercise.order}\u0000${exercise.name}`
    );

    check(
      acceptedCount === 1 &&
        final.local?.program?.length === 18 &&
        final.idb?.program?.length === 18 &&
        new Set(semanticSlots).size === 18 &&
        final.persistenceArtifacts.length === 0,
      "only one same-base whole-program replacement commits",
      {
        firstResult,
        secondResult,
        acceptedCount,
        localRows: final.local?.program?.length,
        idbRows: final.idb?.program?.length,
        semanticSlots: new Set(semanticSlots).size,
        artifacts: final.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function scenarioConcurrentExerciseFieldEdits(browser) {
  console.log("\n14. Concurrent same-ID exercise fields rebase independently");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const renamer = await openApp(context);
    const baseline = fixture(150);
    await writeReplicas(renamer, { local: baseline, idb: baseline });
    await reloadApp(renamer);
    const counter = await openApp(context);
    const locker = await openApp(context);
    await openProgramEditor(renamer);
    await openProgramEditor(counter);
    await holdStorageLock(locker);

    await renamer
      .locator('#programEditor input[data-id="audit-press"][data-field="name"]')
      .fill("Audit press renamed");
    await counter
      .locator('#programEditor [data-role="adjust"][data-id="audit-press"][data-field="sets"][data-delta="1"]')
      .click();
    const [renamerStage, counterStage] = await Promise.all([
      renamer.evaluate(async () => (await window.__debugProgramEditor?.())?.session),
      counter.evaluate(async () => (await window.__debugProgramEditor?.())?.session),
    ]);
    check(
      renamerStage?.document?.program?.[0]?.name === "Audit press renamed" &&
        counterStage?.document?.program?.[0]?.sets === 3,
      "precondition: each installed editor holds its distinct staged field",
      { renamerStage, counterStage }
    );
    await renamer.click("#programEditToggle");
    await waitForPendingStorageLocks(locker, 1);
    await counter.click("#programEditToggle");
    await waitForPendingStorageLocks(locker, 2);
    await releaseStorageLock(locker);
    await Promise.all([
      renamer.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden")),
      counter.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden")),
    ]);
    await Promise.all([
      renamer.evaluate(() => window.__repforgeStorage.flush()),
      counter.evaluate(() => window.__repforgeStorage.flush()),
    ]);

    const final = await readBoth(locker);
    const localExercise = final.local?.program?.find((entry) => entry.id === "audit-press");
    const idbExercise = final.idb?.program?.find((entry) => entry.id === "audit-press");
    check(
      final.local?.program?.length === 1 &&
        final.idb?.program?.length === 1 &&
        localExercise?.name === "Audit press renamed" &&
        localExercise?.sets === 3 &&
        idbExercise?.name === "Audit press renamed" &&
        idbExercise?.sets === 3,
      "distinct concurrent fields survive without duplicate exercise rows",
      { localExercise, idbExercise }
    );
  } finally {
    await context.close();
  }
}

async function scenarioUnrelatedProgramEditPreservesSessionDay(browser) {
  console.log("\n15. Unrelated program edits cannot split a historical session");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const page = await openApp(context);
    const baseline = fixture(160);
    baseline.program.push({
      ...baseline.program[0],
      id: "audit-row",
      name: "Audit row",
      order: 2,
      primary: "Back",
    });
    baseline.log = [
      {
        session: "audit-indivisible-session",
        date: "2026-08-14",
        day: "Day 1",
        name: "Audit press",
        exerciseId: "audit-press",
        set: 1,
        load: 80,
        reps: 8,
        rir: 1,
        notes: "",
        created: "2026-08-14T12:00:00.000Z",
        primary: "Chest",
        secondary: "",
      },
      {
        session: "audit-indivisible-session",
        date: "2026-08-14",
        day: "Day 1",
        name: "Audit row",
        exerciseId: "audit-row",
        set: 1,
        load: 70,
        reps: 8,
        rir: 1,
        notes: "",
        created: "2026-08-14T12:00:00.000Z",
        primary: "Back",
        secondary: "",
      },
    ];
    await writeReplicas(page, { local: baseline, idb: baseline });
    await reloadApp(page);
    await openProgramEditor(page);
    await page.locator("#programEditorWrap details.advanced").evaluate((details) => {
      details.open = true;
    });
    const moved = JSON.parse(JSON.stringify(baseline.program));
    moved.find((exercise) => exercise.id === "audit-row").day = "Day 2";
    await page.locator("#programJson").fill(JSON.stringify(moved));
    await page.click("#saveProgram");
    // Playwright's click resolves after dispatch, not after the async onclick
    // has committed and rendered. Waiting for its success toast keeps the
    // following evaluate out of the render/navigation context boundary.
    await page.locator("#toast").filter({ hasText: "Program saved" }).waitFor({
      state: "visible",
      timeout: 5000,
    });
    await page.evaluate(() => window.__repforgeStorage.flush());

    const final = await readBoth(page);
    const rows = final.local?.log?.filter(
      (row) => row.session === "audit-indivisible-session"
    ) || [];
    const weekly = await page.evaluate(() =>
      window.__repforgeWeeklySnapshot("2026-08-14")
    );
    check(
      new Set(rows.map((row) => row.day)).size === 1 &&
        rows.every((row) => row.day === "Day 1") &&
        final.idb?.log
          ?.filter((row) => row.session === "audit-indivisible-session")
          .every((row) => row.day === "Day 1") &&
        weekly.completedDays === 1 &&
        weekly.completedSessions === 1,
      "an existing session remains one historical training day",
      { rows: rows.map((row) => ({ exerciseId: row.exerciseId, day: row.day })), weekly }
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
  await runScenario("boot replay Finish receipt", () =>
    scenarioBootReplayFinishClearsCapturedDraft(browser)
  );
  await runScenario("in-page Finish preserves newer draft", () =>
    scenarioInPageFinishPreservesNewerDraft(browser)
  );
  await runScenario("total Finish failure is durably rejected", () =>
    scenarioTotalFinishFailureIsDurablyRejected(browser)
  );
  await runScenario("legacy no-effect and malformed required effect", () =>
    scenarioLegacyNoEffectAndMalformedRequiredEffect(browser)
  );
  await runScenario("deferred onboarding cannot supersede Repeat", () =>
    scenarioDeferredOnboardingCannotSupersedeRepeat(browser)
  );
  await runScenario("concurrent whole-program replacements", () =>
    scenarioConcurrentWholeProgramReplacements(browser)
  );
  await runScenario("concurrent same-ID exercise fields", () =>
    scenarioConcurrentExerciseFieldEdits(browser)
  );
  await runScenario("historical session day preservation", () =>
    scenarioUnrelatedProgramEditPreservesSessionDay(browser)
  );
} finally {
  await browser.close();
}

if (failures.length) {
  throw new Error(`thermonuclear persistence repros: ${failures.length} failed`);
}
console.log("\nPASS: thermonuclear persistence repros");
