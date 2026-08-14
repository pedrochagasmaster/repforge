#!/usr/bin/env node
/**
 * Focused destructive-program draft conflict regressions.
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
      typeof window.__repforgeApplyProgramTemplate === "function" &&
      typeof window.__repforgeFinalizeProgramSetup === "function",
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

async function seedScenario(page, draftRaw, state = fixture()) {
  await page.evaluate(
    async ({ key, draftKey, pendingKey, dbName, storeName, state, draftRaw }) => {
      localStorage.setItem(key, JSON.stringify(state));
      localStorage.setItem(draftKey, draftRaw);
      for (let index = localStorage.length - 1; index >= 0; index--) {
        const storageKey = localStorage.key(index);
        if (storageKey === pendingKey || storageKey?.startsWith(`${pendingKey}:`)) {
          localStorage.removeItem(storageKey);
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
        tx.objectStore(storeName).put(state, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { key: KEY, draftKey: DRAFT, pendingKey: PENDING, dbName: DB, storeName: STORE, state, draftRaw }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
}

async function readRuntime(page) {
  return page.evaluate(
    async ({ key, draftKey, pendingKey, dbName, storeName }) => {
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
      const pendingEntries = [];
      for (let index = 0; index < localStorage.length; index++) {
        const storageKey = localStorage.key(index);
        if (storageKey !== pendingKey && !storageKey?.startsWith(`${pendingKey}:`)) continue;
        const raw = localStorage.getItem(storageKey);
        pendingEntries.push({ key: storageKey, raw, value: JSON.parse(raw) });
      }
      pendingEntries.sort((a, b) => a.key.localeCompare(b.key));
      return { localRaw, local, idb, draftRaw, pendingEntries };
    },
    { key: KEY, draftKey: DRAFT, pendingKey: PENDING, dbName: DB, storeName: STORE }
  );
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
      window.__draftConflictResult = window.__repforgeApplyProgramTemplate();
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
    check(final.pendingEntries.length === 0, "template conflict clears only its stale journal", final.pendingEntries);
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
      final.pendingEntries.length === 0,
      "program finalization conflict clears only its stale journal",
      final.pendingEntries
    );
  } finally {
    await context.close();
  }
}

async function runSaveProgramConflict(browser) {
  console.log("\n3. Raw program save conflicts with a newer draft");
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
    await writer.locator("#programEditorWrap details.advanced").evaluate((details) => {
      details.open = true;
    });
    const edited = fixture().program;
    edited[0].name = "Edited while draft is active";
    await writer.locator("#programJson").fill(JSON.stringify(edited));
    const before = await readRuntime(writer);
    writer.on("dialog", (dialog) => dialog.accept());
    await holdStorageLock(locker);
    await writer.click("#saveProgram");
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
      "raw program save journals the exact confirmed draft",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "raw program save conflict preserves durable program and newer draft",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(final.pendingEntries.length === 0, "raw program save conflict clears only its stale journal", final.pendingEntries);
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
    await holdStorageLock(locker);
    await writer.setInputFiles("#importProgram", {
      name: "program.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ version: 2, meta: { name: "Imported conflict" }, exercises: imported })),
    });
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
    check(final.pendingEntries.length === 0, "normal program import conflict clears only its stale journal", final.pendingEntries);
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
    await holdStorageLock(locker);
    await writer.setInputFiles("#importProgram", {
      name: "onboarding-program.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ version: 2, meta: { name: "Onboarding import" }, exercises: imported })),
    });
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
    check(final.pendingEntries.length === 0, "onboarding import conflict clears only its stale journal", final.pendingEntries);
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
    await writer.click('[data-act="delEx"][data-id="draft-conflict-press"]');
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
    check(final.pendingEntries.length === 0, "exercise deletion conflict clears only its stale journal", final.pendingEntries);
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
    await writer.click('[data-act="delDay"][data-day="Day 1"]');
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
    check(final.pendingEntries.length === 0, "day deletion conflict clears only its stale journal", final.pendingEntries);
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
    check(final.pendingEntries.length === 0, "full-backup Replace conflict clears only its stale journal", final.pendingEntries);
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
    check(final.pendingEntries.length === 0, "Delete log conflict clears only its stale journal", final.pendingEntries);
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
      window.__draftConflictResult = window.__repforgeApplyProgramTemplate();
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
        final.pendingEntries.length === 0,
      "safe acceptance installs the program without recreating the removed draft",
      {
        localName: final.local?.programMeta?.name,
        idbName: final.idb?.programMeta?.name,
        draftRaw: final.draftRaw,
        pendingCount: final.pendingEntries.length,
      }
    );
  } finally {
    await context.close();
  }
}

async function runBootDestructiveConflict(browser) {
  console.log("\n11. Boot replay aborts a retained destructive clear for a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const page = await openApp(context);
    const confirmedDraftRaw = JSON.stringify(draft("retained-destructive-draft", "101.25"));
    await seedScenario(page, confirmedDraftRaw);
    const before = await readRuntime(page);
    await page.evaluate(
      async ({ key }) => {
        const originalSetItem = Storage.prototype.setItem;
        const originalPut = IDBObjectStore.prototype.put;
        Storage.prototype.setItem = function (candidate) {
          if (candidate === key) throw new Error("audit: reject destructive local replica");
          return originalSetItem.apply(this, arguments);
        };
        IDBObjectStore.prototype.put = function (_value, candidate) {
          if (candidate === key) throw new Error("audit: reject destructive IDB replica");
          return originalPut.apply(this, arguments);
        };
        try {
          return await window.__repforgeApplyProgramTemplate();
        } finally {
          Storage.prototype.setItem = originalSetItem;
          IDBObjectStore.prototype.put = originalPut;
        }
      },
      { key: KEY }
    );
    const retained = await readRuntime(page);
    const newerDraftRaw = JSON.stringify(draft("newer-boot-destructive-draft", "116.25"));
    await page.evaluate(
      ({ draftKey, raw }) => localStorage.setItem(draftKey, raw),
      { draftKey: DRAFT, raw: newerDraftRaw }
    );

    check(
      retained.pendingEntries.length === 1 &&
        retained.pendingEntries[0].value?.effect?.precondition === "abort-changed" &&
        retained.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw,
      "precondition: total failure retains the exact destructive clear receipt",
      retained.pendingEntries.map((entry) => entry.value?.effect)
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    const final = await readRuntime(page);
    const toastText = await page.locator("#toast").innerText();
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
    check(final.pendingEntries.length === 0, "boot destructive conflict clears only its stale journal", final.pendingEntries);
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
      window.__draftConflictResult = window.__repforgeApplyProgramTemplate();
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
      final.pendingEntries.length === 0,
      "new-draft conflict clears only the stale replacement journal",
      final.pendingEntries
    );
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
