#!/usr/bin/env node
/**
 * Focused destructive-program draft conflict regressions.
 * Requires the repository root at REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";
import {
  clearPersistenceArtifacts,
  inventoryPersistenceArtifacts,
} from "./persistence-artifacts.mjs";

/* Clear the mapping review and persist the candidate. Activation remains a
   separate transaction, which the conflict cases start while holding the
   storage lock. */
async function reviewAndStageImport(page) {
  await page.waitForSelector("#importReview.active", { timeout: 5000 });
  for (let guard = 0; guard < 40; guard++) {
    const acted = await page.evaluate(() => {
      const row = [...document.querySelectorAll("#importRows .improw")].find((r) => r.classList.contains("is-open"));
      if (!row) return false;
      (row.querySelector('[data-imp-act="link"]') || row.querySelector('[data-imp-act="raw"]'))?.click();
      return true;
    });
    if (!acted) break;
    await page.waitForTimeout(50);
  }
  await page.click("#importCommit");
  await page.waitForSelector("#entryActivate", { timeout: 10000 });
}

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const DRAFT_PENDING_PREFIX = `${DRAFT}:pending:`;
const DB = "repforge";
const STORE = "kv";
const STORAGE_LOCK = "repforge:state-write";
const failures = [];
let passed = 0;

function check(condition, message, detail) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
    return;
  }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${JSON.stringify(detail)}`);
}

function domainSnapshot(value) {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy._storageRevision;
  const canonicalize = (candidate) => {
    if (Array.isArray(candidate)) return candidate.map(canonicalize);
    if (candidate && typeof candidate === "object") {
      return Object.fromEntries(
        Object.keys(candidate)
          .sort()
          .map((key) => [key, canonicalize(candidate[key])])
      );
    }
    return candidate;
  };
  return JSON.stringify(canonicalize(copy));
}

function fixture() {
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
      id: "draft-conflict-program",
      name: "Draft conflict fixture",
      started: "2026-08-01",
      created: "2026-08-01T00:00:00.000Z",
      updated: "2026-08-01T00:00:00.000Z",
      onboarded: true,
      mesocycleStatus: "active",
      mesocycleLengthWeeks: 6,
      goal: null,
      experience: null,
      daysPerWeek: 2,
      splitType: "upper_lower",
      equipment: ["machines"],
      priorityMuscles: [],
      sessionLength: "short",
      completedAt: null,
    },
    program: [
      {
        id: "draft-conflict-press",
        name: "Draft conflict press",
        day: "Day 1",
        order: 1,
        sets: 2,
        min: 8,
        max: 12,
        primary: "Chest",
        secondary: "Triceps",
        notes: "",
        alternates: [],
      },
      {
        id: "draft-conflict-press-accessory",
        name: "Draft conflict press accessory",
        day: "Day 1",
        order: 2,
        sets: 2,
        min: 8,
        max: 12,
        primary: "Chest",
        secondary: "Triceps",
        notes: "",
        alternates: [],
      },
      {
        id: "draft-conflict-row",
        name: "Draft conflict row",
        day: "Day 2",
        order: 1,
        sets: 2,
        min: 8,
        max: 12,
        primary: "Back",
        secondary: "Biceps",
        notes: "",
        alternates: [],
      },
    ],
    log: [],
    programHistory: [],
    _storageRevision: 10,
  };
}

function draft(marker, load) {
  return {
    __day: "Day 1",
    __date: "2026-08-14",
    __sessionNotes: marker,
    __contextTouched: { day: true, date: true, sessionNotes: true, bodyweight: false },
    __done: [],
    __touched: ["draft-conflict-press_1"],
    __warm: [],
    __skipped: [],
    __substituted: {},
    __exnotes: {},
    "draft-conflict-press_1_load": load,
    "draft-conflict-press_1_reps": "8",
    "draft-conflict-press_1_rir": "1",
  };
}

async function waitForApp(page) {
  await page.waitForFunction(
    () =>
      typeof window.__repforgeStorage?.flush === "function" &&
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
      return window.__repforgeFinalizeProgramSetup({
        exercises: current.program,
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

async function seedScenario(page, draftRaw, state = fixture()) {
  await page.evaluate(() => window.__repforgeStorage.flush());
  await clearPersistenceArtifacts(page);
  await page.evaluate(
    async ({ key, draftKey, dbName, storeName, state, draftRaw }) => {
      localStorage.setItem(key, JSON.stringify(state));
      if (draftRaw == null) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, draftRaw);
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(state, key);
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
      state,
      draftRaw,
    }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
}

async function readRuntime(page) {
  const runtime = await page.evaluate(
    async ({ key, draftKey, dbName, storeName }) => {
      const localRaw = localStorage.getItem(key);
      const local = localRaw == null ? null : JSON.parse(localRaw);
      const draftRaw = localStorage.getItem(draftKey);
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
      return { localRaw, local, idb, draftRaw };
    },
    {
      key: KEY,
      draftKey: DRAFT,
      dbName: DB,
      storeName: STORE,
    }
  );
  const artifacts = await inventoryPersistenceArtifacts(page);
  return {
    ...runtime,
    pendingEntries: artifacts.pendingEntries,
    draftPendingEntries: artifacts.draftPendingEntries,
    closingMarkerEntries: artifacts.closingMarkerEntries,
    draftArtifacts: artifacts.draftArtifacts.map((entry) => entry.key),
    persistenceArtifactEntries: artifacts.entries,
    persistenceArtifacts: artifacts.keys,
  };
}

async function holdStorageLock(page) {
  await page.evaluate((lockName) => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    window.__draftConflictReleaseLock = release;
    window.__draftConflictLockHeld = false;
    window.__draftConflictLockDone = navigator.locks.request(lockName, async () => {
      window.__draftConflictLockHeld = true;
      await gate;
    });
  }, STORAGE_LOCK);
  await page.waitForFunction(() => window.__draftConflictLockHeld === true, { timeout: 10000 });
}

async function releaseStorageLock(page) {
  await page.evaluate(async () => {
    window.__draftConflictReleaseLock?.();
    await window.__draftConflictLockDone;
  });
}

async function waitForPendingStorageLock(page) {
  await page.waitForFunction(
    async (lockName) => {
      const locks = await navigator.locks.query();
      return locks.pending.some((lock) => lock.name === lockName);
    },
    STORAGE_LOCK,
    { timeout: 10000 }
  );
}

async function waitForNoPendingStorageLock(page) {
  await page.waitForFunction(
    async (lockName) => {
      const locks = await navigator.locks.query();
      return !locks.pending.some((lock) => lock.name === lockName);
    },
    STORAGE_LOCK,
    { timeout: 10000 }
  );
}

async function openProgramEditor(page) {
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#program.view.active", { timeout: 5000 });
  const hidden = await page.locator("#programEditorWrap").evaluate((element) =>
    element.classList.contains("is-hidden")
  );
  if (hidden) await page.click("#programEditToggle");
  await page.waitForSelector("#programEditorWrap:not(.is-hidden)", { timeout: 5000 });
}

async function runTemplateConflict(browser) {
  console.log("\n1. Beginner template replacement conflicts with a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = JSON.stringify(draft("confirmed-template-draft", "82.5"));
    await seedScenario(writer, confirmedDraftRaw);
    const locker = await openApp(context);
    const before = await readRuntime(writer);
    await holdStorageLock(locker);
    await writer.evaluate(() => {
      window.__draftConflictResult = window.__testFinalizeCurrentProgram();
    });
    await waitForPendingStorageLock(locker);
    const blocked = await readRuntime(writer);
    const newerDraftRaw = JSON.stringify(draft("newer-template-draft", "97.5"));
    await locker.evaluate(
      ({ draftKey, raw }) => localStorage.setItem(draftKey, raw),
      { draftKey: DRAFT, raw: newerDraftRaw }
    );
    await releaseStorageLock(locker);
    const result = await writer.evaluate(() => window.__draftConflictResult);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);
    const toastText = await writer.locator("#toast").innerText();

    check(
      blocked.pendingEntries.length === 1 &&
        blocked.pendingEntries[0].value?.effect?.kind === "clear-draft" &&
        blocked.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw &&
        blocked.pendingEntries[0].value.effect.precondition === "abort-changed",
      "template replacement journals the exact confirmed draft with abort-on-change policy",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      result?.draftConflict === true &&
        result.localOk === false &&
        result.idbOk === false,
      "template replacement returns explicit draftConflict",
      result
    );
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "template conflict preserves durable program and newer draft byte-for-byte",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "template conflict clears only its stale journal",
      final.persistenceArtifacts
    );
    check(/retry|try again/i.test(toastText), "template conflict shows retry guidance", toastText);
  } finally {
    await context.close();
  }
}

async function runFinalizeConflict(browser) {
  console.log("\n2. Program setup finalization conflicts with a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = JSON.stringify(draft("confirmed-finalize-draft", "85"));
    await seedScenario(writer, confirmedDraftRaw);
    const locker = await openApp(context);
    const before = await readRuntime(writer);
    await holdStorageLock(locker);
    await writer.evaluate(
      ({ exercises, confirmedDraftRaw }) => {
        window.__draftConflictResult = window.__repforgeFinalizeProgramSetup({
          exercises,
          name: "Conflicting finalized program",
          answers: { goal: "hypertrophy" },
          destination: "log",
          origin: "settings",
          draftConfirmed: true,
          discardDraftRaw: confirmedDraftRaw,
        });
      },
      { exercises: fixture().program, confirmedDraftRaw }
    );
    await waitForPendingStorageLock(locker);
    const blocked = await readRuntime(writer);
    const newerDraftRaw = JSON.stringify(draft("newer-finalize-draft", "100"));
    await locker.evaluate(
      ({ draftKey, raw }) => localStorage.setItem(draftKey, raw),
      { draftKey: DRAFT, raw: newerDraftRaw }
    );
    await releaseStorageLock(locker);
    const result = await writer.evaluate(() => window.__draftConflictResult);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      blocked.pendingEntries.length === 1 &&
        blocked.pendingEntries[0].value?.effect?.kind === "clear-draft" &&
        blocked.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw &&
        blocked.pendingEntries[0].value.effect.precondition === "abort-changed",
      "program finalization journals the exact confirmed draft with abort-on-change policy",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      result?.draftConflict === true &&
        result.localOk === false &&
        result.idbOk === false,
      "program finalization returns explicit draftConflict",
      result
    );
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "program finalization conflict preserves durable program and newer draft byte-for-byte",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "program finalization conflict clears only its stale journal",
      final.persistenceArtifacts
    );
  } finally {
    await context.close();
  }
}

async function runSaveProgramConflict(browser) {
  console.log("\n3. Visible program edit conflicts with a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = JSON.stringify(draft("confirmed-save-program-draft", "87.5"));
    await seedScenario(writer, confirmedDraftRaw);
    const locker = await openApp(context);
    await openProgramEditor(writer);
    // Replacing the touched exercise is the visible equivalent of replacing
    // the installed program while a workout draft exists. Done first presents
    // the workout-safe Apply changes action before the destructive transaction
    // begins.
    await writer.locator('#programEditor [data-role="replace"][data-id="draft-conflict-press"]').click();
    await writer.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
    await writer.locator("#exPickList .pickrow").first().click();
    await writer.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
    const before = await readRuntime(writer);
    await holdStorageLock(locker);
    await writer.click("#programEditToggle");
    await writer.waitForSelector("#programEditorLeave[open]", { timeout: 5000 });
    await writer.click("#programEditorApply");
    await waitForPendingStorageLock(locker);
    const blocked = await readRuntime(writer);
    const newerDraftRaw = JSON.stringify(draft("newer-save-program-draft", "102.5"));
    await locker.evaluate(
      ({ draftKey, raw }) => localStorage.setItem(draftKey, raw),
      { draftKey: DRAFT, raw: newerDraftRaw }
    );
    await releaseStorageLock(locker);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      blocked.pendingEntries.length === 1 &&
        blocked.pendingEntries[0].value?.effect?.kind === "clear-draft" &&
        blocked.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw &&
        blocked.pendingEntries[0].value.effect.precondition === "abort-changed",
      "visible program edit journals the exact confirmed draft",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "visible program edit conflict preserves durable program and newer draft",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "visible program edit conflict clears only its stale journal",
      final.persistenceArtifacts
    );
  } finally {
    await context.close();
  }
}

async function runNormalProgramImportConflict(browser) {
  console.log("\n4. Normal program import conflicts with a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = JSON.stringify(draft("confirmed-import-draft", "90"));
    await seedScenario(writer, confirmedDraftRaw);
    const locker = await openApp(context);
    await openProgramEditor(writer);
    const before = await readRuntime(writer);
    writer.on("dialog", (dialog) => dialog.accept());
    const imported = fixture().program;
    imported[0].name = "Imported replacement press";
    await writer.setInputFiles("#importProgram", {
      name: "program.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ version: 2, meta: { name: "Imported conflict" }, exercises: imported })),
    });
    await reviewAndStageImport(writer);
    await holdStorageLock(locker);
    await writer.evaluate(() => document.querySelector("#entryActivate")?.click());
    await waitForPendingStorageLock(locker);
    const blocked = await readRuntime(writer);
    const newerDraftRaw = JSON.stringify(draft("newer-import-draft", "105"));
    await locker.evaluate(
      ({ draftKey, raw }) => localStorage.setItem(draftKey, raw),
      { draftKey: DRAFT, raw: newerDraftRaw }
    );
    await releaseStorageLock(locker);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      blocked.pendingEntries.length === 1 &&
        blocked.pendingEntries[0].value?.effect?.kind === "clear-draft" &&
        blocked.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw &&
        blocked.pendingEntries[0].value.effect.precondition === "abort-changed",
      "normal program import journals the exact confirmed draft",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "normal program import conflict preserves durable program and newer draft",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "normal program import conflict clears only its stale journal",
      final.persistenceArtifacts
    );
  } finally {
    await context.close();
  }
}

async function runOnboardingProgramImportConflict(browser) {
  console.log("\n5. Onboarding program import conflicts with a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = JSON.stringify(draft("confirmed-onboarding-import-draft", "91.25"));
    await seedScenario(writer, confirmedDraftRaw);
    const locker = await openApp(context);
    await writer.evaluate(() => window.startOnboarding("settings"));
    await writer.waitForSelector("#onboarding.active", { timeout: 5000 });
    const before = await readRuntime(writer);
    writer.on("dialog", (dialog) => dialog.accept());
    const imported = fixture().program;
    imported[0].name = "Onboarding imported press";
    await writer.setInputFiles("#importProgram", {
      name: "onboarding-program.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ version: 2, meta: { name: "Onboarding import" }, exercises: imported })),
    });
    await reviewAndStageImport(writer);
    await holdStorageLock(locker);
    await writer.evaluate(() => document.querySelector("#entryActivate")?.click());
    await waitForPendingStorageLock(locker);
    const blocked = await readRuntime(writer);
    const newerDraftRaw = JSON.stringify(draft("newer-onboarding-import-draft", "106.25"));
    await locker.evaluate(
      ({ draftKey, raw }) => localStorage.setItem(draftKey, raw),
      { draftKey: DRAFT, raw: newerDraftRaw }
    );
    await releaseStorageLock(locker);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);
    const onboardingActive = await writer.locator("#onboarding").evaluate((element) =>
      element.classList.contains("active")
    );

    check(
      blocked.pendingEntries.length === 1 &&
        blocked.pendingEntries[0].value?.effect?.kind === "clear-draft" &&
        blocked.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw &&
        blocked.pendingEntries[0].value.effect.precondition === "abort-changed",
      "onboarding import journals the exact confirmed draft",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw &&
        onboardingActive,
      "onboarding import conflict preserves program, newer draft, and retry UI",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
        onboardingActive,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "onboarding import conflict clears only its stale journal",
      final.persistenceArtifacts
    );
  } finally {
    await context.close();
  }
}

async function runDeleteExerciseConflict(browser) {
  console.log("\n6. Exercise deletion conflicts with a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = JSON.stringify(draft("confirmed-delete-exercise-draft", "92.5"));
    await seedScenario(writer, confirmedDraftRaw);
    const locker = await openApp(context);
    await openProgramEditor(writer);
    const before = await readRuntime(writer);
    writer.on("dialog", (dialog) => dialog.accept());
    await holdStorageLock(locker);
    await writer.click('#programEditor [data-role="remove-exercise"][data-id="draft-conflict-press"]');
    await writer.click("#programEditToggle");
    await writer.waitForSelector("#programEditorLeave[open]", { timeout: 5000 });
    await writer.click("#programEditorApply");
    await waitForPendingStorageLock(locker);
    const blocked = await readRuntime(writer);
    const newerDraftRaw = JSON.stringify(draft("newer-delete-exercise-draft", "107.5"));
    await locker.evaluate(
      ({ draftKey, raw }) => localStorage.setItem(draftKey, raw),
      { draftKey: DRAFT, raw: newerDraftRaw }
    );
    await releaseStorageLock(locker);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      blocked.pendingEntries.length === 1 &&
        blocked.pendingEntries[0].value?.effect?.kind === "clear-draft" &&
        blocked.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw &&
        blocked.pendingEntries[0].value.effect.precondition === "abort-changed",
      "exercise deletion journals the exact confirmed draft",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "exercise deletion conflict preserves durable program and newer draft",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "exercise deletion conflict clears only its stale journal",
      final.persistenceArtifacts
    );
  } finally {
    await context.close();
  }
}

async function runDeleteDayConflict(browser) {
  console.log("\n7. Day deletion conflicts with a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = JSON.stringify(draft("confirmed-delete-day-draft", "95"));
    await seedScenario(writer, confirmedDraftRaw);
    const locker = await openApp(context);
    await openProgramEditor(writer);
    const before = await readRuntime(writer);
    writer.on("dialog", (dialog) => dialog.accept());
    await holdStorageLock(locker);
    await writer.click('#programEditor [data-role="day-menu"][data-day="Day 1"]');
    await writer.click('#programEditor [data-role="remove-day"][data-day="Day 1"]');
    await writer.click("#programEditToggle");
    await writer.waitForSelector("#programEditorLeave[open]", { timeout: 5000 });
    await writer.click("#programEditorApply");
    await waitForPendingStorageLock(locker);
    const blocked = await readRuntime(writer);
    const newerDraftRaw = JSON.stringify(draft("newer-delete-day-draft", "110"));
    await locker.evaluate(
      ({ draftKey, raw }) => localStorage.setItem(draftKey, raw),
      { draftKey: DRAFT, raw: newerDraftRaw }
    );
    await releaseStorageLock(locker);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      blocked.pendingEntries.length === 1 &&
        blocked.pendingEntries[0].value?.effect?.kind === "clear-draft" &&
        blocked.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw &&
        blocked.pendingEntries[0].value.effect.precondition === "abort-changed",
      "day deletion journals the exact confirmed draft",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "day deletion conflict preserves durable program and newer draft",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "day deletion conflict clears only its stale journal",
      final.persistenceArtifacts
    );
  } finally {
    await context.close();
  }
}

async function runBackupReplaceConflict(browser) {
  console.log("\n8. Full-backup Replace conflicts with a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = JSON.stringify(draft("confirmed-backup-replace-draft", "97.5"));
    await seedScenario(writer, confirmedDraftRaw);
    const locker = await openApp(context);
    const incoming = fixture();
    incoming.programMeta.name = "Incoming full backup";
    incoming.program[0].name = "Incoming backup press";
    await writer.setInputFiles("#importJson", {
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(incoming)),
    });
    await writer.waitForSelector("#importChoice:not(.hidden)", { timeout: 5000 });
    const before = await readRuntime(writer);
    await holdStorageLock(locker);
    await writer.click("#importReplace");
    await waitForPendingStorageLock(locker);
    const blocked = await readRuntime(writer);
    const newerDraftRaw = JSON.stringify(draft("newer-backup-replace-draft", "112.5"));
    await locker.evaluate(
      ({ draftKey, raw }) => localStorage.setItem(draftKey, raw),
      { draftKey: DRAFT, raw: newerDraftRaw }
    );
    await releaseStorageLock(locker);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      blocked.pendingEntries.length === 1 &&
        blocked.pendingEntries[0].value?.effect?.kind === "clear-draft" &&
        blocked.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw &&
        blocked.pendingEntries[0].value.effect.precondition === "abort-changed",
      "full-backup Replace journals the exact draft present at acceptance",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "full-backup Replace conflict preserves durable state and newer draft",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "full-backup Replace conflict clears only its stale journal",
      final.persistenceArtifacts
    );
    check(
      await writer.locator("#importChoice").evaluate((dialog) => !dialog.classList.contains("hidden")),
      "full-backup Replace conflict leaves the chooser open for retry"
    );
  } finally {
    await context.close();
  }
}

async function runDeleteLogConflict(browser) {
  console.log("\n9. Delete log conflicts with a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const state = fixture();
    state.log = [
      {
        session: "delete-log-session",
        date: "2026-08-13",
        day: "Day 1",
        name: "Draft conflict press",
        exerciseId: "draft-conflict-press",
        set: 1,
        load: 80,
        reps: 8,
        rir: 1,
        notes: "",
        created: "2026-08-13T12:00:00.000Z",
        primary: "Chest",
        secondary: "Triceps",
      },
    ];
    const confirmedDraftRaw = JSON.stringify(draft("confirmed-delete-log-draft", "98.75"));
    await seedScenario(writer, confirmedDraftRaw, state);
    const locker = await openApp(context);
    await writer.evaluate(() => window.__repforgeShowSettings());
    const before = await readRuntime(writer);
    writer.on("dialog", (dialog) => dialog.accept());
    await holdStorageLock(locker);
    await writer.click("#reset");
    await waitForPendingStorageLock(locker);
    const blocked = await readRuntime(writer);
    const newerDraftRaw = JSON.stringify(draft("newer-delete-log-draft", "113.75"));
    await locker.evaluate(
      ({ draftKey, raw }) => localStorage.setItem(draftKey, raw),
      { draftKey: DRAFT, raw: newerDraftRaw }
    );
    await releaseStorageLock(locker);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      blocked.pendingEntries.length === 1 &&
        blocked.pendingEntries[0].value?.effect?.kind === "clear-draft" &&
        blocked.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw &&
        blocked.pendingEntries[0].value.effect.precondition === "abort-changed",
      "Delete log journals the exact confirmed draft",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "Delete log conflict preserves durable log and newer draft",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "Delete log conflict clears only its stale journal",
      final.persistenceArtifacts
    );
  } finally {
    await context.close();
  }
}

async function runIndependentlyRemovedDraft(browser) {
  console.log("\n10. Independently removed draft permits the confirmed replacement");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = JSON.stringify(draft("independently-removed-draft", "100"));
    await seedScenario(writer, confirmedDraftRaw);
    const locker = await openApp(context);
    const before = await readRuntime(writer);
    await holdStorageLock(locker);
    await writer.evaluate(() => {
      window.__draftConflictResult = window.__testFinalizeCurrentProgram();
    });
    await waitForPendingStorageLock(locker);
    await locker.evaluate((draftKey) => localStorage.removeItem(draftKey), DRAFT);
    await releaseStorageLock(locker);
    const result = await writer.evaluate(() => window.__draftConflictResult);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      (result?.localOk || result?.idbOk) &&
        result.draftConflict !== true &&
        result.revision === before.local._storageRevision + 1,
      "an independently removed draft is a safe accepted outcome",
      { beforeRevision: before.local?._storageRevision, result }
    );
    check(
      final.local?.programMeta?.name === "Beginner program" &&
        final.idb?.programMeta?.name === "Beginner program" &&
        final.draftRaw === null &&
        final.persistenceArtifacts.length === 0,
      "safe acceptance installs the program without recreating the removed draft",
      {
        localName: final.local?.programMeta?.name,
        idbName: final.idb?.programMeta?.name,
        draftRaw: final.draftRaw,
        pendingCount: final.pendingEntries.length,
        artifacts: final.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function runBootDestructiveConflict(browser) {
  console.log("\n11. Boot replay aborts an unloaded destructive clear for a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const page = await openApp(context);
    const confirmedDraftRaw = JSON.stringify(draft("retained-destructive-draft", "101.25"));
    await seedScenario(page, confirmedDraftRaw);
    const locker = await openApp(context);
    const before = await readRuntime(page);
    await holdStorageLock(locker);
    await page.evaluate(() => {
      window.__bootDestructivePending = window.__testFinalizeCurrentProgram();
    });
    await waitForPendingStorageLock(locker);
    const retained = await readRuntime(page);
    const newerDraftRaw = JSON.stringify(draft("newer-boot-destructive-draft", "116.25"));
    await locker.evaluate(
      ({ draftKey, raw }) => localStorage.setItem(draftKey, raw),
      { draftKey: DRAFT, raw: newerDraftRaw }
    );

    check(
      retained.pendingEntries.length === 1 &&
        retained.pendingEntries[0].value?.effect?.precondition === "abort-changed" &&
        retained.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw,
      "precondition: unload leaves the exact destructive clear receipt",
      retained.pendingEntries.map((entry) => entry.value?.effect)
    );

    await page.close();
    await waitForNoPendingStorageLock(locker);
    await releaseStorageLock(locker);
    await locker.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(locker);
    const final = await readRuntime(locker);
    const toastText = await locker.locator("#toast").innerText();
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "boot destructive conflict preserves durable program and newer draft",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "boot destructive conflict clears only its stale journal",
      final.persistenceArtifacts
    );
    check(/try again/i.test(toastText), "boot destructive conflict shows retry guidance", toastText);
  } finally {
    await context.close();
  }
}

async function runDraftCreatedAfterConfirmation(browser) {
  console.log("\n12. A draft created after confirmation aborts the replacement");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    await seedScenario(writer, null);
    const locker = await openApp(context);
    const before = await readRuntime(writer);
    await holdStorageLock(locker);
    await writer.evaluate(() => {
      window.__draftConflictResult = window.__testFinalizeCurrentProgram();
    });
    await waitForPendingStorageLock(locker);
    const blocked = await readRuntime(writer);
    const newerDraftRaw = JSON.stringify(draft("created-after-confirmation", "120"));
    await locker.evaluate(
      ({ draftKey, raw }) => localStorage.setItem(draftKey, raw),
      { draftKey: DRAFT, raw: newerDraftRaw }
    );
    await releaseStorageLock(locker);
    const result = await writer.evaluate(() => window.__draftConflictResult);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      blocked.pendingEntries.length === 1 &&
        blocked.pendingEntries[0].value?.effect?.kind === "clear-draft" &&
        blocked.pendingEntries[0].value.effect.expectedRaw === null &&
        blocked.pendingEntries[0].value.effect.precondition === "abort-changed",
      "replacement journals the confirmed absence of a draft",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      result?.draftConflict === true &&
        final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "a newly created draft aborts replacement without changing either replica",
      {
        result,
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "new-draft conflict clears only the stale replacement journal",
      final.persistenceArtifacts
    );
  } finally {
    await context.close();
  }
}

async function runLocalReplicaWriteRace(browser) {
  console.log("\n13. A draft written from the local replica write path aborts template replacement");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const page = await openApp(context);
    const confirmedDraftRaw = JSON.stringify(draft("confirmed-local-write-race", "102.5"));
    const newerDraftRaw = JSON.stringify(draft("newer-local-write-race", "122.5"));
    await seedScenario(page, confirmedDraftRaw);
    const before = await readRuntime(page);
    const result = await page.evaluate(
      async ({ key, draftKey, newerDraftRaw }) => {
        const originalSetItem = Storage.prototype.setItem;
        let injected = false;
        Storage.prototype.setItem = function (candidate, value) {
          const written = originalSetItem.call(this, candidate, value);
          if (!injected && candidate === key) {
            injected = true;
            originalSetItem.call(this, draftKey, newerDraftRaw);
          }
          return written;
        };
        try {
          return await window.__testFinalizeCurrentProgram();
        } finally {
          Storage.prototype.setItem = originalSetItem;
        }
      },
      { key: KEY, draftKey: DRAFT, newerDraftRaw }
    );
    await page.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(page);

    check(result?.draftConflict === true, "local-write race is observably rejected as draftConflict", result);
    check(
      domainSnapshot(final.local) === domainSnapshot(before.local) &&
        domainSnapshot(final.idb) === domainSnapshot(before.idb),
      "local-write race preserves the prior domain head in both replicas",
      {
        beforeName: before.local?.programMeta?.name,
        localName: final.local?.programMeta?.name,
        idbName: final.idb?.programMeta?.name,
        beforeRevision: before.local?._storageRevision,
        localRevision: final.local?._storageRevision,
        idbRevision: final.idb?._storageRevision,
      }
    );
    check(final.draftRaw === newerDraftRaw, "local-write race preserves the newer draft exactly", {
      expected: newerDraftRaw,
      actual: final.draftRaw,
    });
    check(
      final.persistenceArtifacts.length === 0,
      "local-write race drains its stale journal only after rejection is durable",
      final.persistenceArtifacts
    );
  } finally {
    await context.close();
  }
}

async function runBootReplayLocalReplicaWriteRace(browser) {
  console.log("\n14. Boot replay rolls back when the local replica write path publishes a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const page = await openApp(context);
    const confirmedDraftRaw = JSON.stringify(draft("confirmed-boot-write-race", "103.75"));
    const newerDraftRaw = JSON.stringify(draft("newer-boot-write-race", "123.75"));
    await seedScenario(page, confirmedDraftRaw);
    const locker = await openApp(context);
    const before = await readRuntime(page);
    await holdStorageLock(locker);
    await page.evaluate(() => {
      window.__bootWriteRacePending = window.__testFinalizeCurrentProgram();
    });
    await waitForPendingStorageLock(locker);
    const retained = await readRuntime(page);
    check(
      retained.pendingEntries.length === 1 &&
        retained.pendingEntries[0].value?.effect?.precondition === "abort-changed",
      "precondition: boot race retains one destructive receipt",
      retained.pendingEntries.map((entry) => entry.value?.effect)
    );

    await page.close();
    await waitForNoPendingStorageLock(locker);
    await context.addInitScript(
      ({ key, draftKey, newerDraftRaw }) => {
        const originalSetItem = Storage.prototype.setItem;
        let injected = false;
        Storage.prototype.setItem = function (candidate, value) {
          const written = originalSetItem.call(this, candidate, value);
          if (!injected && candidate === key) {
            injected = true;
            originalSetItem.call(this, draftKey, newerDraftRaw);
          }
          return written;
        };
      },
      { key: KEY, draftKey: DRAFT, newerDraftRaw }
    );
    await releaseStorageLock(locker);
    const recovered = await openApp(context);
    const final = await readRuntime(recovered);
    const toastText = await recovered.locator("#toast").innerText();

    check(
      domainSnapshot(final.local) === domainSnapshot(before.local) &&
        domainSnapshot(final.idb) === domainSnapshot(before.idb),
      "boot local-write race preserves the prior domain head in both replicas",
      {
        beforeName: before.local?.programMeta?.name,
        localName: final.local?.programMeta?.name,
        idbName: final.idb?.programMeta?.name,
        beforeRevision: before.local?._storageRevision,
        localRevision: final.local?._storageRevision,
        idbRevision: final.idb?._storageRevision,
      }
    );
    check(final.draftRaw === newerDraftRaw, "boot local-write race preserves the newer draft exactly", {
      expected: newerDraftRaw,
      actual: final.draftRaw,
    });
    check(
      final.persistenceArtifacts.length === 0,
      "boot local-write race drains its stale journal only after durable rollback",
      final.persistenceArtifacts
    );
    check(/retry|try again/i.test(toastText), "boot local-write race reports a draft conflict", toastText);
  } finally {
    await context.close();
  }
}

async function runOneStoreReplicaWriteRaces(browser) {
  console.log("\n15. Post-write draft conflicts compensate every accepted one-store outcome");
  for (const outcome of [
    { label: "local-only", localOk: true, idbOk: false },
    { label: "IDB-only", localOk: false, idbOk: true },
  ]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    try {
      const page = await openApp(context);
      const confirmedDraftRaw = JSON.stringify(draft(`confirmed-${outcome.label}-race`, "105"));
      const newerDraftRaw = JSON.stringify(draft(`newer-${outcome.label}-race`, "125"));
      await seedScenario(page, confirmedDraftRaw);
      const before = await readRuntime(page);
      const result = await page.evaluate(
        async ({ key, draftKey, newerDraftRaw, localOk, idbOk }) => {
          const originalSetItem = Storage.prototype.setItem;
          const originalPut = IDBObjectStore.prototype.put;
          let injected = false;
          Storage.prototype.setItem = function (candidate, value) {
            if (candidate !== key) return originalSetItem.call(this, candidate, value);
            if (!localOk) throw new Error("audit: reject local replica");
            const written = originalSetItem.call(this, candidate, value);
            if (!injected) {
              injected = true;
              originalSetItem.call(this, draftKey, newerDraftRaw);
            }
            return written;
          };
          IDBObjectStore.prototype.put = function (value, candidate) {
            if (candidate !== key) return originalPut.apply(this, arguments);
            if (!idbOk) throw new Error("audit: reject IDB replica");
            const request = originalPut.apply(this, arguments);
            if (!injected) {
              injected = true;
              originalSetItem.call(localStorage, draftKey, newerDraftRaw);
            }
            return request;
          };
          try {
            return await window.__testFinalizeCurrentProgram();
          } finally {
            Storage.prototype.setItem = originalSetItem;
            IDBObjectStore.prototype.put = originalPut;
          }
        },
        { key: KEY, draftKey: DRAFT, newerDraftRaw, localOk: outcome.localOk, idbOk: outcome.idbOk }
      );
      await page.evaluate(() => window.__repforgeStorage.flush());
      const compensated = await readRuntime(page);

      check(
        result?.draftConflict === true &&
          result.localOk === false &&
          result.idbOk === false &&
          result.compensationLocalOk === outcome.localOk &&
          result.compensationIdbOk === outcome.idbOk,
        `${outcome.label} conflict reports rejection and its durable compensation`,
        result
      );
      check(
        domainSnapshot(compensated.local) === domainSnapshot(before.local) &&
          domainSnapshot(compensated.idb) === domainSnapshot(before.idb) &&
          compensated.draftRaw === newerDraftRaw &&
          compensated.persistenceArtifacts.length === 0,
        `${outcome.label} compensation preserves the prior domain head and newer draft`,
        {
          localName: compensated.local?.programMeta?.name,
          idbName: compensated.idb?.programMeta?.name,
          localRevision: compensated.local?._storageRevision,
          idbRevision: compensated.idb?._storageRevision,
          pendingCount: compensated.pendingEntries.length,
          artifacts: compensated.persistenceArtifacts,
        }
      );

      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForApp(page);
      const healed = await readRuntime(page);
      check(
        domainSnapshot(healed.local) === domainSnapshot(before.local) &&
          domainSnapshot(healed.idb) === domainSnapshot(before.idb) &&
          healed.local?._storageRevision === healed.idb?._storageRevision &&
          healed.draftRaw === newerDraftRaw,
        `${outcome.label} rollback wins replica selection and heals on boot`,
        {
          localName: healed.local?.programMeta?.name,
          idbName: healed.idb?.programMeta?.name,
          localRevision: healed.local?._storageRevision,
          idbRevision: healed.idb?._storageRevision,
        }
      );
    } finally {
      await context.close();
    }
  }
}

async function runCrossStoreCompensationRecovery(browser) {
  console.log("\n15b. Opposite one-store rollback outcomes deterministically win on boot");
  for (const outcome of [
    {
      label: "local provisional / IDB rollback",
      initialLocalOk: true,
      initialIdbOk: false,
      rollbackLocalOk: false,
      rollbackIdbOk: true,
    },
    {
      label: "IDB provisional / local rollback",
      initialLocalOk: false,
      initialIdbOk: true,
      rollbackLocalOk: true,
      rollbackIdbOk: false,
    },
  ]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    try {
      const page = await openApp(context);
      const confirmedDraftRaw = JSON.stringify(draft(`confirmed-${outcome.label}`, "105.5"));
      const newerDraftRaw = JSON.stringify(draft(`newer-${outcome.label}`, "125.5"));
      await seedScenario(page, confirmedDraftRaw);
      const before = await readRuntime(page);
      const result = await page.evaluate(
        async ({
          key,
          draftKey,
          newerDraftRaw,
          initialLocalOk,
          initialIdbOk,
          rollbackLocalOk,
          rollbackIdbOk,
        }) => {
          const originalSetItem = Storage.prototype.setItem;
          const originalPut = IDBObjectStore.prototype.put;
          let localWrites = 0;
          let idbWrites = 0;
          let injected = false;
          Storage.prototype.setItem = function (candidate, value) {
            if (candidate !== key) return originalSetItem.call(this, candidate, value);
            localWrites++;
            const allowed = localWrites === 1 ? initialLocalOk : rollbackLocalOk;
            if (!allowed) throw new Error(`audit: reject local state round ${localWrites}`);
            const written = originalSetItem.call(this, candidate, value);
            if (!injected && localWrites === 1) {
              injected = true;
              originalSetItem.call(this, draftKey, newerDraftRaw);
            }
            return written;
          };
          IDBObjectStore.prototype.put = function (_value, candidate) {
            if (candidate !== key) return originalPut.apply(this, arguments);
            idbWrites++;
            const allowed = idbWrites === 1 ? initialIdbOk : rollbackIdbOk;
            if (!allowed) throw new Error(`audit: reject IDB state round ${idbWrites}`);
            const request = originalPut.apply(this, arguments);
            if (!injected && idbWrites === 1) {
              injected = true;
              originalSetItem.call(localStorage, draftKey, newerDraftRaw);
            }
            return request;
          };
          try {
            const value = await window.__testFinalizeCurrentProgram();
            return { value, localWrites, idbWrites };
          } finally {
            Storage.prototype.setItem = originalSetItem;
            IDBObjectStore.prototype.put = originalPut;
          }
        },
        {
          key: KEY,
          draftKey: DRAFT,
          newerDraftRaw,
          initialLocalOk: outcome.initialLocalOk,
          initialIdbOk: outcome.initialIdbOk,
          rollbackLocalOk: outcome.rollbackLocalOk,
          rollbackIdbOk: outcome.rollbackIdbOk,
        }
      );
      await page.evaluate(() => window.__repforgeStorage.flush());
      const split = await readRuntime(page);
      const rollbackReplica = outcome.rollbackLocalOk ? split.local : split.idb;
      const provisionalReplica = outcome.initialLocalOk ? split.local : split.idb;

      check(
        result.value?.draftConflict === true &&
          result.value.localOk === false &&
          result.value.idbOk === false &&
          result.value.compensationLocalOk === outcome.rollbackLocalOk &&
          result.value.compensationIdbOk === outcome.rollbackIdbOk &&
          result.localWrites === 2 &&
          result.idbWrites === 2,
        `${outcome.label} reports rejection with the accepted rollback replica`,
        result
      );
      check(
        domainSnapshot(rollbackReplica) === domainSnapshot(before.local) &&
          rollbackReplica?._storageRevision > provisionalReplica?._storageRevision &&
          split.draftRaw === newerDraftRaw &&
          split.persistenceArtifacts.length === 0,
        `${outcome.label} leaves a higher-revision rollback head and exact newer draft`,
        {
          rollbackName: rollbackReplica?.programMeta?.name,
          provisionalName: provisionalReplica?.programMeta?.name,
          rollbackRevision: rollbackReplica?._storageRevision,
          provisionalRevision: provisionalReplica?._storageRevision,
          draftMatches: split.draftRaw === newerDraftRaw,
          artifacts: split.persistenceArtifacts,
        }
      );

      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForApp(page);
      const healed = await readRuntime(page);
      check(
        domainSnapshot(healed.local) === domainSnapshot(before.local) &&
          domainSnapshot(healed.idb) === domainSnapshot(before.idb) &&
          healed.local?._storageRevision === healed.idb?._storageRevision &&
          healed.draftRaw === newerDraftRaw &&
          healed.persistenceArtifacts.length === 0,
        `${outcome.label} heals both replicas from the rollback winner`,
        {
          localName: healed.local?.programMeta?.name,
          idbName: healed.idb?.programMeta?.name,
          localRevision: healed.local?._storageRevision,
          idbRevision: healed.idb?._storageRevision,
          draftMatches: healed.draftRaw === newerDraftRaw,
          artifacts: healed.persistenceArtifacts,
        }
      );
    } finally {
      await context.close();
    }
  }
}

async function runEffectApplicationRace(browser) {
  console.log("\n16. A draft published between post-write check and receipt application is rejected");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const page = await openApp(context);
    const confirmedDraftRaw = JSON.stringify(draft("confirmed-effect-race", "106.25"));
    const newerDraftRaw = JSON.stringify(draft("newer-effect-race", "126.25"));
    await seedScenario(page, confirmedDraftRaw);
    const before = await readRuntime(page);
    const observed = await page.evaluate(
      async ({ draftKey, newerDraftRaw }) => {
        const originalGetItem = Storage.prototype.getItem;
        const originalSetItem = Storage.prototype.setItem;
        let draftReads = 0;
        Storage.prototype.getItem = function (candidate) {
          if (candidate === draftKey) {
            draftReads++;
            if (draftReads === 4) originalSetItem.call(this, draftKey, newerDraftRaw);
          }
          return originalGetItem.apply(this, arguments);
        };
        try {
          const result = await window.__testFinalizeCurrentProgram();
          return { result, draftReads };
        } finally {
          Storage.prototype.getItem = originalGetItem;
        }
      },
      { draftKey: DRAFT, newerDraftRaw }
    );
    await page.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(page);

    check(
      observed.result?.draftConflict === true && observed.draftReads >= 4,
      "receipt-application race is observably rejected",
      observed
    );
    check(
      domainSnapshot(final.local) === domainSnapshot(before.local) &&
        domainSnapshot(final.idb) === domainSnapshot(before.idb) &&
        final.draftRaw === newerDraftRaw &&
        final.persistenceArtifacts.length === 0,
      "receipt-application race durably restores both replicas and preserves the newer draft",
      {
        localName: final.local?.programMeta?.name,
        idbName: final.idb?.programMeta?.name,
        draftMatches: final.draftRaw === newerDraftRaw,
        pendingCount: final.pendingEntries.length,
        artifacts: final.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function runPreparedTransactionUnloadRecovery(browser) {
  console.log("\n17. Boot compensates an interrupted prepared destructive transaction");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = JSON.stringify(draft("confirmed-interrupted-transaction", "107.5"));
    const newerDraftRaw = JSON.stringify(draft("newer-interrupted-transaction", "127.5"));
    await seedScenario(writer, confirmedDraftRaw);
    const before = await readRuntime(writer);
    await writer.evaluate(
      ({ key, draftKey, newerDraftRaw }) => {
        const io = {
          async writeLocal(snapshot) {
            localStorage.setItem(key, JSON.stringify(snapshot));
            localStorage.setItem(draftKey, newerDraftRaw);
          },
          async writeIdb() {
            await new Promise(() => {});
          },
        };
        window.__interruptedDraftTransaction = window.__testFinalizeCurrentProgram(io);
      },
      { key: KEY, draftKey: DRAFT, newerDraftRaw }
    );
    await writer.waitForFunction(
      ({ key, marker }) => {
        const snapshot = JSON.parse(localStorage.getItem(key) || "null");
        return snapshot?.[marker]?.version === 1;
      },
      { key: KEY, marker: "_storageDraftTransaction" },
      { timeout: 10000 }
    );
    const interrupted = await readRuntime(writer);
    check(
      interrupted.local?.programMeta?.name === "Beginner program" &&
        interrupted.local?._storageDraftTransaction?.previous?.programMeta?.name === before.local?.programMeta?.name &&
        domainSnapshot(interrupted.idb) === domainSnapshot(before.idb) &&
        interrupted.draftRaw === newerDraftRaw,
      "precondition: one provisional replica carries its exact rollback head",
      {
        localName: interrupted.local?.programMeta?.name,
        rollbackName: interrupted.local?._storageDraftTransaction?.previous?.programMeta?.name,
        idbName: interrupted.idb?.programMeta?.name,
      }
    );

    await writer.close();
    const recovered = await openApp(context);
    const final = await readRuntime(recovered);
    const toastText = await recovered.locator("#toast").innerText();
    check(
      domainSnapshot(final.local) === domainSnapshot(before.local) &&
        domainSnapshot(final.idb) === domainSnapshot(before.idb) &&
        final.local?._storageRevision === final.idb?._storageRevision &&
        !("_storageDraftTransaction" in final.local) &&
        !("_storageDraftTransaction" in final.idb),
      "boot uses the prepared marker to durably compensate and heal both replicas",
      {
        localName: final.local?.programMeta?.name,
        idbName: final.idb?.programMeta?.name,
        localRevision: final.local?._storageRevision,
        idbRevision: final.idb?._storageRevision,
      }
    );
    check(
      final.draftRaw === newerDraftRaw && /retry|try again/i.test(toastText),
      "interrupted compensation preserves the newer draft and reports rejection",
      { draftMatches: final.draftRaw === newerDraftRaw, toastText }
    );
  } finally {
    await context.close();
  }
}

async function runSuccessfulClearPublicationRace(browser) {
  console.log("\n18. A draft published immediately after successful removal is compensated");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const page = await openApp(context);
    const confirmedDraftRaw = JSON.stringify(draft("confirmed-successful-clear-race", "108.75"));
    const newerDraftRaw = JSON.stringify(draft("newer-successful-clear-race", "128.75"));
    await seedScenario(page, confirmedDraftRaw);
    const before = await readRuntime(page);
    const observed = await page.evaluate(
      async ({ key, draftKey, newerDraftRaw }) => {
        const originalRemoveItem = Storage.prototype.removeItem;
        const originalSetItem = Storage.prototype.setItem;
        let injected = false;
        let markerPresent = false;
        let draftRawAfterRemoval = null;
        Storage.prototype.removeItem = function (candidate) {
          const removed = originalRemoveItem.apply(this, arguments);
          if (!injected && candidate === draftKey) {
            injected = true;
            const provisional = JSON.parse(localStorage.getItem(key) || "null");
            markerPresent = provisional?._storageDraftTransaction?.version === 1;
            originalSetItem.call(this, draftKey, newerDraftRaw);
            draftRawAfterRemoval = localStorage.getItem(draftKey);
          }
          return removed;
        };
        try {
          const result = await window.__testFinalizeCurrentProgram();
          return { result, injected, markerPresent, draftRawAfterRemoval };
        } finally {
          Storage.prototype.removeItem = originalRemoveItem;
        }
      },
      { key: KEY, draftKey: DRAFT, newerDraftRaw }
    );
    await page.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(page);

    check(
      observed.injected && observed.markerPresent && observed.draftRawAfterRemoval === newerDraftRaw,
      "precondition: newer draft is published while the destructive transaction is provisional",
      observed
    );
    check(observed.result?.draftConflict === true, "successful-clear publication is rejected as draftConflict", observed.result);
    check(
      domainSnapshot(final.local) === domainSnapshot(before.local) &&
        domainSnapshot(final.idb) === domainSnapshot(before.idb) &&
        final.draftRaw === newerDraftRaw &&
        final.persistenceArtifacts.length === 0,
      "successful-clear publication durably restores both replicas and preserves the newer draft",
      {
        beforeName: before.local?.programMeta?.name,
        localName: final.local?.programMeta?.name,
        idbName: final.idb?.programMeta?.name,
        newerDraftPreserved: final.draftRaw === newerDraftRaw,
        pendingCount: final.pendingEntries.length,
        pendingDraftCount: final.draftPendingEntries.length,
        artifacts: final.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function runStaleTabSaveDuringSuccessfulClear(browser) {
  console.log("\n19. A stale tab saveDraft during successful removal is queued without loss");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = JSON.stringify(draft("confirmed-stale-tab-save", "110"));
    await seedScenario(writer, confirmedDraftRaw);
    const before = await readRuntime(writer);
    const popup = context.waitForEvent("page");
    await writer.evaluate((url) => {
      window.__draftConflictStaleTab = window.open(url, "draft-conflict-stale-tab");
    }, BASE);
    const stale = await popup;
    await waitForApp(stale);
    await stale.evaluate((draftPendingPrefix) => {
      const originalSetItem = Storage.prototype.setItem;
      window.__draftConflictQueuedSidecarKeys = new Set();
      window.__draftConflictRestoreSidecarCapture = () => {
        Storage.prototype.setItem = originalSetItem;
        delete window.__draftConflictRestoreSidecarCapture;
      };
      Storage.prototype.setItem = function (candidate) {
        if (typeof candidate === "string" && candidate.startsWith(draftPendingPrefix)) {
          window.__draftConflictQueuedSidecarKeys.add(candidate);
        }
        return originalSetItem.apply(this, arguments);
      };
    }, DRAFT_PENDING_PREFIX);

    const observed = await writer.evaluate(
      async ({ key, draftKey, staleLoad }) => {
        const originalRemoveItem = Storage.prototype.removeItem;
        let saveDispatched = false;
        let markerPresent = false;
        let draftRawAfterSave = null;
        let queuedWriteCount = 0;
        Storage.prototype.removeItem = function (candidate) {
          const removed = originalRemoveItem.apply(this, arguments);
          if (!saveDispatched && candidate === draftKey) {
            const provisional = JSON.parse(localStorage.getItem(key) || "null");
            markerPresent = provisional?._storageDraftTransaction?.version === 1;
            const staleTab = window.__draftConflictStaleTab;
            const input = staleTab?.document.querySelector(
              '[data-k="draft-conflict-press_1_load"]'
            );
            if (input) {
              input.value = staleLoad;
              input.dispatchEvent(new staleTab.Event("input", { bubbles: true }));
              saveDispatched = true;
              draftRawAfterSave = staleTab.localStorage.getItem(draftKey);
              queuedWriteCount = staleTab.__draftConflictQueuedSidecarKeys.size;
            }
          }
          return removed;
        };
        try {
          const result = await window.__testFinalizeCurrentProgram();
          return { result, saveDispatched, markerPresent, draftRawAfterSave, queuedWriteCount };
        } finally {
          Storage.prototype.removeItem = originalRemoveItem;
          window.__draftConflictStaleTab?.__draftConflictRestoreSidecarCapture?.();
        }
      },
      { key: KEY, draftKey: DRAFT, staleLoad: "131.25" }
    );
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);
    const finalDraft = final.draftRaw == null ? null : JSON.parse(final.draftRaw);

    check(
      observed.saveDispatched &&
        observed.markerPresent &&
        observed.draftRawAfterSave === null &&
        observed.queuedWriteCount === 1,
      "precondition: production saveDraft queues instead of publishing while the transaction is provisional",
      observed
    );
    check(
      observed.result?.draftConflict === true,
      "stale-tab save causes compensation instead of accepting an incompatible program",
      observed.result
    );
    check(
      domainSnapshot(final.local) === domainSnapshot(before.local) &&
        domainSnapshot(final.idb) === domainSnapshot(before.idb) &&
        finalDraft?.["draft-conflict-press_1_load"] === "131.25" &&
        final.persistenceArtifacts.length === 0,
      "stale-tab save is retained exactly while both durable replicas return to the old program",
      {
        beforeName: before.local?.programMeta?.name,
        localName: final.local?.programMeta?.name,
        idbName: final.idb?.programMeta?.name,
        staleLoad: finalDraft?.["draft-conflict-press_1_load"],
        pendingCount: final.pendingEntries.length,
        pendingDraftCount: final.draftPendingEntries.length,
        artifacts: final.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function runQueuedStaleTabUnloadRecovery(browser) {
  console.log("\n20. Boot recovers a queued stale-tab draft after interrupted compensation");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = JSON.stringify(draft("confirmed-queued-unload", "112.5"));
    await seedScenario(writer, confirmedDraftRaw);
    const before = await readRuntime(writer);
    const popup = context.waitForEvent("page");
    await writer.evaluate((url) => {
      window.__draftConflictStaleTab = window.open(url, "draft-conflict-unload-stale-tab");
    }, BASE);
    const stale = await popup;
    await waitForApp(stale);

    const result = await writer.evaluate(
      async ({ key, draftKey, staleLoad }) => {
        const originalRemoveItem = Storage.prototype.removeItem;
        const originalSetItem = Storage.prototype.setItem;
        const originalPut = IDBObjectStore.prototype.put;
        let stateWrites = 0;
        let idbWrites = 0;
        let saveDispatched = false;
        Storage.prototype.removeItem = function (candidate) {
          const removed = originalRemoveItem.apply(this, arguments);
          if (!saveDispatched && candidate === draftKey) {
            const staleTab = window.__draftConflictStaleTab;
            const input = staleTab?.document.querySelector(
              '[data-k="draft-conflict-press_1_load"]'
            );
            if (input) {
              input.value = staleLoad;
              input.dispatchEvent(new staleTab.Event("input", { bubbles: true }));
              saveDispatched = true;
            }
          }
          return removed;
        };
        Storage.prototype.setItem = function (candidate) {
          if (candidate === key && ++stateWrites > 1) {
            throw new Error("audit: interrupt local compensation");
          }
          return originalSetItem.apply(this, arguments);
        };
        IDBObjectStore.prototype.put = function (_value, candidate) {
          if (candidate === key && ++idbWrites > 1) {
            throw new Error("audit: interrupt IDB compensation");
          }
          return originalPut.apply(this, arguments);
        };
        try {
          return await window.__testFinalizeCurrentProgram();
        } finally {
          Storage.prototype.removeItem = originalRemoveItem;
          Storage.prototype.setItem = originalSetItem;
          IDBObjectStore.prototype.put = originalPut;
        }
      },
      { key: KEY, draftKey: DRAFT, staleLoad: "133.75" }
    );
    const interrupted = await readRuntime(writer);
    check(
      result?.draftConflict === true &&
        result.compensationPending === true &&
        interrupted.local?._storageDraftTransaction?.version === 1 &&
        interrupted.idb?._storageDraftTransaction?.version === 1 &&
        interrupted.draftRaw === null &&
        interrupted.pendingEntries.length === 1 &&
        interrupted.draftPendingEntries.length === 1,
      "precondition: failed compensation retains the provisional marker, state journal, and queued draft",
      {
        result,
        localTransaction: interrupted.local?._storageDraftTransaction?.version,
        idbTransaction: interrupted.idb?._storageDraftTransaction?.version,
        draftRaw: interrupted.draftRaw,
        pendingCount: interrupted.pendingEntries.length,
        pendingDraftCount: interrupted.draftPendingEntries.length,
      }
    );

    await stale.close();
    await writer.close();
    const recovered = await openApp(context);
    const final = await readRuntime(recovered);
    const finalDraft = final.draftRaw == null ? null : JSON.parse(final.draftRaw);
    const toastText = await recovered.locator("#toast").innerText();
    check(
      domainSnapshot(final.local) === domainSnapshot(before.local) &&
        domainSnapshot(final.idb) === domainSnapshot(before.idb) &&
        final.local?._storageRevision === final.idb?._storageRevision &&
        finalDraft?.["draft-conflict-press_1_load"] === "133.75" &&
        final.persistenceArtifacts.length === 0,
      "boot durably compensates and republishes the queued stale-tab draft without loss",
      {
        beforeName: before.local?.programMeta?.name,
        localName: final.local?.programMeta?.name,
        idbName: final.idb?.programMeta?.name,
        staleLoad: finalDraft?.["draft-conflict-press_1_load"],
        pendingCount: final.pendingEntries.length,
        pendingDraftCount: final.draftPendingEntries.length,
        artifacts: final.persistenceArtifacts,
      }
    );
    check(/retry|try again/i.test(toastText), "queued unload recovery reports the rejected replacement", toastText);
  } finally {
    await context.close();
  }
}

async function main() {
  console.log("Program destructive-draft conflict regressions");
  console.log(`Target: ${BASE}`);
  const browser = await launchChromium();
  try {
    await runTemplateConflict(browser);
    await runFinalizeConflict(browser);
    await runSaveProgramConflict(browser);
    await runNormalProgramImportConflict(browser);
    await runOnboardingProgramImportConflict(browser);
    await runDeleteExerciseConflict(browser);
    await runDeleteDayConflict(browser);
    await runBackupReplaceConflict(browser);
    await runDeleteLogConflict(browser);
    await runIndependentlyRemovedDraft(browser);
    await runBootDestructiveConflict(browser);
    await runDraftCreatedAfterConfirmation(browser);
    await runLocalReplicaWriteRace(browser);
    await runBootReplayLocalReplicaWriteRace(browser);
    await runOneStoreReplicaWriteRaces(browser);
    await runCrossStoreCompensationRecovery(browser);
    await runEffectApplicationRace(browser);
    await runPreparedTransactionUnloadRecovery(browser);
    await runSuccessfulClearPublicationRace(browser);
    await runStaleTabSaveDuringSuccessfulClear(browser);
    await runQueuedStaleTabUnloadRecovery(browser);
  } finally {
    await browser.close();
  }
  console.log(`\nPASSED: ${passed}`);
  console.log(`FAILED: ${failures.length}`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Regression crashed:", error);
  process.exit(2);
});
