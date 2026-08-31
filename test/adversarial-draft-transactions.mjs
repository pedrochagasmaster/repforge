#!/usr/bin/env node
/**
 * Red-capable regressions for adversarial draft/state transaction overlaps.
 * Requires the repository root at REPFORGE_URL (default http://127.0.0.1:8000/).
 *
 * These assertions lock down the safe invariants at the transaction boundary.
 */
import { launchChromium } from "./browser.mjs";
import {
  clearPersistenceArtifacts,
  inventoryPersistenceArtifacts,
} from "./persistence-artifacts.mjs";

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const PENDING = "repforge_pending_v1";
const PENDING_PREFIX = `${PENDING}:`;
const DRAFT_PENDING_PREFIX = `${DRAFT}:pending:`;
const DRAFT_CLOSE_PREFIX = `${DRAFT}:closing:`;
const DB = "repforge";
const STORE = "kv";
const STORAGE_LOCK = "repforge:state-write";
const EXERCISE_ID = "adversarial-press";
const OTHER_EXERCISE_ID = "adversarial-row";
const SET_KEY = `${EXERCISE_ID}_1`;
const FOCUSED_SCENARIO = process.argv.includes("--stored-close-marker-failure")
  ? "stored-close-marker-failure"
  : process.argv.includes("--settings-unit-draft-failure")
    ? "settings-unit-draft-failure"
    : process.argv.includes("--settings-unit-draft-conflict")
      ? "settings-unit-draft-conflict"
    : null;

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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixture({
  revision = 10,
  programId = "adversarial-program",
  programName = "Adversarial transaction fixture",
} = {}) {
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
      id: programId,
      name: programName,
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
        id: EXERCISE_ID,
        name: "Adversarial press",
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
        id: OTHER_EXERCISE_ID,
        name: "Adversarial row",
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
    _storageRevision: revision,
  };
}

function workoutDraft(marker, load = "90") {
  return {
    __day: "Day 1",
    __date: "2026-08-14",
    __sessionNotes: marker,
    __contextTouched: { day: true, date: true, sessionNotes: true, bodyweight: false },
    __done: [],
    __touched: [SET_KEY],
    __warm: [],
    __skipped: [],
    __substituted: {},
    __exnotes: {},
    [`${SET_KEY}_load`]: String(load),
    [`${SET_KEY}_reps`]: "8",
    [`${SET_KEY}_rir`]: "1",
  };
}

function oversizedDraftRaw(marker) {
  const value = workoutDraft(marker, "92.5");
  value.__auditPadding = "x".repeat(1_000_001);
  return JSON.stringify(value);
}

function unversioned(snapshot) {
  const value = clone(snapshot);
  delete value._storageRevision;
  delete value._storageDraftTransaction;
  return value;
}

function replacementState(base, {
  revision = (base?._storageRevision ?? 0) + 1,
  programId = "replacement-program",
  programName = "Replacement program",
} = {}) {
  const value = clone(base);
  value._storageRevision = revision;
  value.programMeta = {
    ...value.programMeta,
    id: programId,
    name: programName,
    created: "2026-08-14T08:00:00.000Z",
    updated: "2026-08-14T08:00:00.000Z",
  };
  value.program = [
    {
      id: `${programId}-exercise`,
      name: `${programName} exercise`,
      day: "Replacement Day",
      order: 1,
      sets: 1,
      min: 6,
      max: 10,
      primary: "Chest",
      secondary: "",
      notes: "",
      alternates: [],
    },
  ];
  return value;
}

function rawDraftLoad(raw) {
  try {
    return JSON.parse(raw || "null")?.[`${SET_KEY}_load`] ?? null;
  } catch {
    return null;
  }
}

function programSummary(snapshot) {
  return {
    id: snapshot?.programMeta?.id ?? null,
    name: snapshot?.programMeta?.name ?? null,
    revision: snapshot?._storageRevision ?? null,
    marker: snapshot?._storageDraftTransaction?.version ?? null,
  };
}

function latestDraftPendingRaw(runtime) {
  const entry = runtime.draftPendingEntries
    .filter((candidate) => candidate.value?.raw != null)
    .sort((a, b) => {
      const ao = a.value?.order || {};
      const bo = b.value?.order || {};
      return (ao.at ?? 0) - (bo.at ?? 0) || (ao.seq ?? 0) - (bo.seq ?? 0);
    })
    .at(-1);
  return entry?.value?.raw ?? null;
}

async function waitForDraftPendingValue(page, loadKey, expected, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const artifacts = await inventoryPersistenceArtifacts(page);
    const found = artifacts.draftSidecarEntries.some((entry) => {
      try {
        return JSON.parse(entry.value?.raw || "null")?.[loadKey] === expected;
      } catch {
        return false;
      }
    });
    if (found) return;
    await page.waitForTimeout(25);
  }
  throw new Error(`timed out waiting for draft sidecar ${loadKey}=${expected}`);
}

async function waitForApp(page) {
  await page.waitForFunction(
    () =>
      typeof window.__repforgeStorage?.flush === "function" &&
      typeof window.__repforgeFinalizeProgramSetup === "function" &&
      typeof window.__repforgeCommitNextBlock === "function" &&
      typeof window.__repforgeEnterWorkout === "function" &&
      typeof window.__repforgeSaveWorkout === "function",
    { timeout: 15000 }
  );
  await page.waitForSelector("#dayTabs button", { state: "attached", timeout: 15000 });
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

async function waitForBootOrRecovery(page) {
  await page.waitForFunction(
    () =>
      typeof window.__repforgeStorage?.flush === "function" &&
      (!!document.querySelector("#dayTabs button") || !!document.querySelector("#storageRecovery")?.open),
    { timeout: 15000 }
  );
}

async function openApp(context) {
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  return page;
}

async function openPopup(context, owner, name) {
  const opened = context.waitForEvent("page");
  await owner.evaluate(
    ({ url, name }) => {
      window.__adversarialStaleTab = window.open(url, name);
    },
    { url: BASE, name }
  );
  const page = await opened;
  await waitForApp(page);
  return page;
}

async function writeReplicas(page, state) {
  await page.evaluate(
    async ({ key, dbName, storeName, state }) => {
      localStorage.setItem(key, JSON.stringify(state));
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(storeName)) {
            request.result.createObjectStore(storeName);
          }
        };
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
    { key: KEY, dbName: DB, storeName: STORE, state }
  );
}

async function seedScenario(page, { state = fixture(), draftRaw = null } = {}) {
  await page.evaluate(() => window.__repforgeStorage.flush());
  await clearPersistenceArtifacts(page);
  await page.evaluate(
    async ({ key, draftKey, dbName, storeName, state, draftRaw }) => {
      localStorage.setItem(key, JSON.stringify(state));
      if (draftRaw == null) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, draftRaw);
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(storeName)) {
            request.result.createObjectStore(storeName);
          }
        };
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
      const parse = (raw) => {
        if (raw == null) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return { __invalid: true };
        }
      };
      const localRaw = localStorage.getItem(key);
      const draftRaw = localStorage.getItem(draftKey);
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(storeName)) {
            request.result.createObjectStore(storeName);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const idb = await new Promise((resolve, reject) => {
        const request = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return {
        localRaw,
        local: parse(localRaw),
        idb,
        draftRaw,
        draft: parse(draftRaw),
        recoveryOpen: !!document.querySelector("#storageRecovery")?.open,
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
    window.__adversarialReleaseLock = release;
    window.__adversarialLockHeld = false;
    window.__adversarialLockDone = navigator.locks.request(lockName, async () => {
      window.__adversarialLockHeld = true;
      await gate;
    });
  }, STORAGE_LOCK);
  await page.waitForFunction(() => window.__adversarialLockHeld === true, { timeout: 10000 });
}

async function releaseStorageLock(page) {
  await page.evaluate(async () => {
    window.__adversarialReleaseLock?.();
    await window.__adversarialLockDone;
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

async function runFinalCheckOrphan(browser) {
  console.log("\n1a. Queued stale-tab draft lands after final settlement check");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const writer = await openApp(context);
    const originalDraftRaw = JSON.stringify(workoutDraft("final-check-original", "90"));
    await seedScenario(writer, { draftRaw: originalDraftRaw });
    const before = await readRuntime(writer);
    const stale = await openPopup(context, writer, "adversarial-final-check-stale");
    await stale.evaluate((draftPendingPrefix) => {
      const originalSetItem = Storage.prototype.setItem;
      window.__adversarialStagedRaw = null;
      window.__adversarialRestoreSidecarCapture = () => {
        Storage.prototype.setItem = originalSetItem;
        delete window.__adversarialRestoreSidecarCapture;
      };
      Storage.prototype.setItem = function (candidate, value) {
        if (typeof candidate === "string" && candidate.startsWith(draftPendingPrefix)) {
          try {
            window.__adversarialStagedRaw = JSON.parse(value)?.raw ?? null;
          } catch {}
        }
        return originalSetItem.apply(this, arguments);
      };
    }, DRAFT_PENDING_PREFIX);

    const observed = await writer.evaluate(
      async ({ key, draftKey, pendingPrefix, loadKey, newerLoad }) => {
        const originalRemoveItem = Storage.prototype.removeItem;
        let injected = false;
        let stateJournalPresent = false;
        let stagedRaw = null;
        Storage.prototype.removeItem = function (candidate) {
          if (!injected && typeof candidate === "string" && candidate.startsWith(pendingPrefix)) {
            const staleTab = window.__adversarialStaleTab;
            const input = staleTab?.document.querySelector(`[data-k="${loadKey}"]`);
            if (input) {
              injected = true;
              stateJournalPresent = localStorage.getItem(candidate) != null;
              input.value = newerLoad;
              input.dispatchEvent(new staleTab.Event("input", { bubbles: true }));
              stagedRaw = staleTab.__adversarialStagedRaw;
            }
          }
          return originalRemoveItem.apply(this, arguments);
        };
        try {
          const result = await window.__testFinalizeCurrentProgram();
          return {
            result,
            injected,
            stateJournalPresent,
            stagedRaw,
            canonicalDraftRaw: localStorage.getItem(draftKey),
            durableProgram: JSON.parse(localStorage.getItem(key) || "null")?.programMeta?.name ?? null,
          };
        } finally {
          Storage.prototype.removeItem = originalRemoveItem;
          window.__adversarialStaleTab?.__adversarialRestoreSidecarCapture?.();
        }
      },
      {
        key: KEY,
        draftKey: DRAFT,
        pendingPrefix: PENDING_PREFIX,
        loadKey: `${SET_KEY}_load`,
        newerLoad: "131.25",
      }
    );
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);
    await writer.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(writer);
    const reloaded = await readRuntime(writer);
    const sidecarRaw = latestDraftPendingRaw(final);

    check(
      observed.injected &&
        observed.stateJournalPresent,
      "race injection publishes from the stale tab at journal deletion",
      {
        injected: observed.injected,
        stateJournalPresent: observed.stateJournalPresent,
      }
    );
    check(
      rawDraftLoad(observed.stagedRaw) === "131.25",
      "the close protocol observes the exact stale-tab bytes before terminal cleanup",
      {
        stagedLoad: rawDraftLoad(observed.stagedRaw),
      }
    );

    check(
      observed.result?.draftConflict === true &&
        final.local?.programMeta?.id === before.local?.programMeta?.id &&
        final.idb?.programMeta?.id === before.idb?.programMeta?.id &&
        final.draftRaw === observed.stagedRaw &&
        final.persistenceArtifacts.length === 0,
      "final settlement rejects the program change and republishes a draft queued before journal deletion",
      {
        result: observed.result,
        expectedProgramId: before.local?.programMeta?.id,
        localProgramId: final.local?.programMeta?.id,
        idbProgramId: final.idb?.programMeta?.id,
        canonicalMatchesStaged: final.draftRaw === observed.stagedRaw,
        stateJournals: final.pendingEntries.length,
        sidecars: final.draftPendingEntries.length,
        artifacts: final.persistenceArtifacts,
      }
    );

    await stale.close();
  } finally {
    await context.close();
  }
}

async function runPostGuardReleaseDraft(browser) {
  console.log("\n1c. A stale app draft cannot land after the closing guard is released");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const writer = await openApp(context);
    const originalDraftRaw = JSON.stringify(workoutDraft("post-guard-original", "91.25"));
    await seedScenario(writer, { draftRaw: originalDraftRaw });
    const before = await readRuntime(writer);
    const stale = await openPopup(context, writer, "adversarial-post-guard-stale");
    await stale.evaluate((draftPendingPrefix) => {
      const originalSetItem = Storage.prototype.setItem;
      window.__adversarialStagedRaw = null;
      window.__adversarialRestoreSidecarCapture = () => {
        Storage.prototype.setItem = originalSetItem;
        delete window.__adversarialRestoreSidecarCapture;
      };
      Storage.prototype.setItem = function (candidate, value) {
        if (typeof candidate === "string" && candidate.startsWith(draftPendingPrefix)) {
          try {
            window.__adversarialStagedRaw = JSON.parse(value)?.raw ?? null;
          } catch {}
        }
        return originalSetItem.apply(this, arguments);
      };
    }, DRAFT_PENDING_PREFIX);

    const observed = await writer.evaluate(
      async ({ key, draftKey, pendingPrefix, closePrefix, loadKey, newerLoad }) => {
        const originalGetItem = Storage.prototype.getItem;
        let injected = false;
        let guardAbsent = false;
        let stateFinalized = false;
        let publishedRaw = null;
        let stagedRaw = null;
        Storage.prototype.getItem = function (candidate) {
          const current = originalGetItem.apply(this, arguments);
          if (!injected && candidate === draftKey && current === null) {
            const storageKeys = [];
            for (let index = 0; index < localStorage.length; index++) {
              storageKeys.push(localStorage.key(index));
            }
            const durable = JSON.parse(originalGetItem.call(this, key) || "null");
            guardAbsent =
              !storageKeys.some(
                (storageKey) =>
                  storageKey === pendingPrefix ||
                  storageKey?.startsWith(`${pendingPrefix}:`) ||
                  storageKey?.startsWith(closePrefix)
              ) && !durable?._storageDraftTransaction;
            stateFinalized = durable?.programMeta?.name === "Beginner program";
            if (guardAbsent && stateFinalized) {
              const staleTab = window.__adversarialStaleTab;
              const input = staleTab?.document.querySelector(`[data-k="${loadKey}"]`);
              if (input) {
                injected = true;
                input.value = newerLoad;
                input.dispatchEvent(new staleTab.Event("input", { bubbles: true }));
                publishedRaw = staleTab.localStorage.getItem(draftKey);
                stagedRaw = staleTab.__adversarialStagedRaw;
              }
            }
          }
          return current;
        };
        try {
          const result = await window.__testFinalizeCurrentProgram();
          return { result, injected, guardAbsent, stateFinalized, publishedRaw, stagedRaw };
        } finally {
          Storage.prototype.getItem = originalGetItem;
          window.__adversarialStaleTab?.__adversarialRestoreSidecarCapture?.();
        }
      },
      {
        key: KEY,
        draftKey: DRAFT,
        pendingPrefix: PENDING,
        closePrefix: DRAFT_CLOSE_PREFIX,
        loadKey: `${SET_KEY}_load`,
        newerLoad: "132.5",
      }
    );
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      observed.injected && observed.guardAbsent && observed.stateFinalized,
      "precondition: stale save runs after journal, marker, and closing guard are absent",
      observed
    );
    check(
      observed.result?.draftConflict === true &&
        final.local?.programMeta?.id === before.local?.programMeta?.id &&
        final.idb?.programMeta?.id === before.idb?.programMeta?.id &&
        observed.publishedRaw === null &&
        final.draftRaw === observed.stagedRaw &&
        rawDraftLoad(final.draftRaw) === "132.5" &&
        final.persistenceArtifacts.length === 0,
      "post-guard stale save rejects the replacement and preserves its exact draft",
      {
        result: observed.result,
        expectedProgramId: before.local?.programMeta?.id,
        localProgramId: final.local?.programMeta?.id,
        idbProgramId: final.idb?.programMeta?.id,
        stagedLoad: rawDraftLoad(observed.stagedRaw),
        staleCanonicalDraft: observed.publishedRaw,
        finalLoad: rawDraftLoad(final.draftRaw),
        artifacts: final.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function runUnloadSafeDraftWal(browser) {
  console.log("\n1d. App draft writes recover from interruption after their WAL sidecar");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const page = await openApp(context);
    await seedScenario(page, { draftRaw: null });
    await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false }));
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });

    const observed = await page.evaluate(
      ({ draftKey, draftPendingPrefix, loadKey, load }) => {
        const originalSetItem = Storage.prototype.setItem;
        let canonicalAttempts = 0;
        let stagedRaw = null;
        Storage.prototype.setItem = function (candidate, value) {
          if (candidate === draftKey) {
            canonicalAttempts++;
            throw new DOMException("audit: interrupt canonical draft publication", "QuotaExceededError");
          }
          const written = originalSetItem.apply(this, arguments);
          if (typeof candidate === "string" && candidate.startsWith(draftPendingPrefix)) {
            stagedRaw = JSON.parse(value)?.raw ?? null;
          }
          return written;
        };
        try {
          const input = document.querySelector(`[data-k="${loadKey}"]`);
          input.value = load;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          return {
            canonicalAttempts,
            stagedRaw,
            canonicalRaw: localStorage.getItem(draftKey),
          };
        } finally {
          Storage.prototype.setItem = originalSetItem;
        }
      },
      {
        draftKey: DRAFT,
        draftPendingPrefix: DRAFT_PENDING_PREFIX,
        loadKey: `${SET_KEY}_load`,
        load: "134.75",
      }
    );
    const interrupted = await readRuntime(page);

    check(
      observed.canonicalAttempts > 0 &&
        observed.canonicalRaw === null &&
        rawDraftLoad(observed.stagedRaw) === "134.75" &&
        interrupted.draftPendingEntries.length === 1,
      "precondition: interrupted write leaves exact draft bytes in the synchronous WAL",
      {
        canonicalAttempts: observed.canonicalAttempts,
        canonicalRaw: observed.canonicalRaw,
        stagedLoad: rawDraftLoad(observed.stagedRaw),
        sidecars: interrupted.draftPendingEntries.length,
      }
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    const recovered = await readRuntime(page);
    check(
      recovered.draftRaw === observed.stagedRaw &&
        rawDraftLoad(recovered.draftRaw) === "134.75" &&
        recovered.persistenceArtifacts.length === 0,
      "boot promotes the exact WAL draft and drains its sidecar",
      {
        recoveredLoad: rawDraftLoad(recovered.draftRaw),
        exact: recovered.draftRaw === observed.stagedRaw,
        artifacts: recovered.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function runSameRawDraftWalAcceptance(browser) {
  console.log("\n1e. A same-raw draft WAL does not reject its owning destructive receipt");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const page = await openApp(context);
    await seedScenario(page, { draftRaw: null });
    await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false }));
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });

    const staged = await page.evaluate(
      ({ draftKey, draftPendingPrefix, loadKey, load }) => {
        const originalSetItem = Storage.prototype.setItem;
        let canonicalAttempts = 0;
        let stagedRaw = null;
        Storage.prototype.setItem = function (candidate, value) {
          if (candidate === draftKey) {
            canonicalAttempts++;
            throw new DOMException("audit: retain same-raw draft WAL", "QuotaExceededError");
          }
          const written = originalSetItem.apply(this, arguments);
          if (typeof candidate === "string" && candidate.startsWith(draftPendingPrefix)) {
            stagedRaw = JSON.parse(value)?.raw ?? null;
          }
          return written;
        };
        try {
          const input = document.querySelector(`[data-k="${loadKey}"]`);
          input.value = load;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          return { canonicalAttempts, stagedRaw, canonicalRaw: localStorage.getItem(draftKey) };
        } finally {
          Storage.prototype.setItem = originalSetItem;
        }
      },
      {
        draftKey: DRAFT,
        draftPendingPrefix: DRAFT_PENDING_PREFIX,
        loadKey: `${SET_KEY}_load`,
        load: "136.25",
      }
    );
    const before = await readRuntime(page);
    const result = await page.evaluate(() => window.__testFinalizeCurrentProgram());
    await page.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(page);

    check(
      staged.canonicalAttempts > 0 &&
        staged.canonicalRaw === null &&
        rawDraftLoad(staged.stagedRaw) === "136.25" &&
        latestDraftPendingRaw(before) === staged.stagedRaw,
      "precondition: expectedRaw exists only in one same-context draft-write WAL",
      {
        canonicalAttempts: staged.canonicalAttempts,
        canonicalRaw: staged.canonicalRaw,
        stagedLoad: rawDraftLoad(staged.stagedRaw),
        sidecars: before.draftPendingEntries.length,
      }
    );
    check(
      (result?.localOk || result?.idbOk) &&
        result?.draftConflict !== true &&
        final.local?.programMeta?.name === "Beginner program" &&
        final.idb?.programMeta?.name === "Beginner program" &&
        final.draftRaw === null &&
        final.persistenceArtifacts.length === 0,
      "same-raw WAL is consumed by the accepted receipt without a false conflict",
      {
        result,
        local: programSummary(final.local),
        idb: programSummary(final.idb),
        draftRaw: final.draftRaw,
        artifacts: final.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function runDuplicateCleanupOrphan(browser) {
  console.log("\n1b. Duplicate expectedProgramId cleanup owns a queued draft");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const writer = await openApp(context);
    const originalState = fixture({ revision: 30 });
    const originalDraftRaw = JSON.stringify(workoutDraft("duplicate-cleanup-original", "93.75"));
    await seedScenario(writer, { state: originalState, draftRaw: originalDraftRaw });
    const seeded = await readRuntime(writer);
    const stale = await openApp(context);
    const locker = await openApp(context);
    await holdStorageLock(locker);
    await writer.evaluate((oldProgramId) => {
      window.__adversarialDuplicateResult = window.__repforgeCommitNextBlock(
        "reduce_volume",
        undefined,
        oldProgramId
      );
    }, seeded.local.programMeta.id);
    await waitForPendingStorageLock(locker);

    await stale.locator(`[data-k="${SET_KEY}_load"]`).fill("141.25");
    await waitForDraftPendingValue(stale, `${SET_KEY}_load`, "141.25");
    const staged = await readRuntime(stale);
    const stagedRaw = latestDraftPendingRaw(staged);
    const advanced = replacementState(seeded.local, {
      revision: seeded.local._storageRevision + 1,
      programId: "already-advanced-program",
      programName: "Already advanced elsewhere",
    });
    await writeReplicas(locker, advanced);
    await releaseStorageLock(locker);
    const result = await writer.evaluate(() => window.__adversarialDuplicateResult);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);
    await writer.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(writer);
    const reloaded = await readRuntime(writer);

    check(
      result?.duplicate === true &&
        result?.kind === "duplicate" &&
        final.local?.programMeta?.id === advanced.programMeta.id &&
        final.idb?.programMeta?.id === advanced.programMeta.id,
      "precondition: expectedProgramId mismatch takes the duplicate cleanup branch",
      {
        result,
        local: programSummary(final.local),
        idb: programSummary(final.idb),
      }
    );
    check(
      rawDraftLoad(stagedRaw) === "141.25" &&
        final.draftRaw === stagedRaw &&
        final.persistenceArtifacts.length === 0 &&
        reloaded.draftRaw === stagedRaw &&
        reloaded.persistenceArtifacts.length === 0,
      "duplicate cleanup promotes the queued draft and leaves no sidecar across reload",
      {
        stagedLoad: rawDraftLoad(stagedRaw),
        canonicalLoad: rawDraftLoad(final.draftRaw),
        stateJournals: final.pendingEntries.length,
        sidecars: final.draftPendingEntries.length,
        artifacts: final.persistenceArtifacts,
        reloadCanonicalLoad: rawDraftLoad(reloaded.draftRaw),
        reloadSidecars: reloaded.draftPendingEntries.length,
        reloadArtifacts: reloaded.persistenceArtifacts,
      }
    );

    check(
      result?.duplicate === true &&
        final.draftRaw === stagedRaw &&
        final.persistenceArtifacts.length === 0,
      "duplicate expectedProgramId cleanup restores its staged writes before deleting the owning journal",
      {
        result,
        canonicalMatchesStaged: final.draftRaw === stagedRaw,
        canonicalLoad: rawDraftLoad(final.draftRaw),
        stagedLoad: rawDraftLoad(stagedRaw),
        stateJournals: final.pendingEntries.length,
        sidecars: final.draftPendingEntries.length,
        artifacts: final.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function runFinalMarkerFailure(browser) {
  console.log("\n2. Both final marker-removal writes fail");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const page = await openApp(context);
    const originalState = fixture({ revision: 50 });
    const draftRaw = JSON.stringify(workoutDraft("marker-removal-total-failure", "96.25"));
    await seedScenario(page, { state: originalState, draftRaw });
    const before = await readRuntime(page);

    const observed = await page.evaluate(
      async ({ key }) => {
        const originalSetItem = Storage.prototype.setItem;
        const originalPut = IDBObjectStore.prototype.put;
        let localStateWrites = 0;
        let idbStateWrites = 0;
        Storage.prototype.setItem = function (candidate) {
          if (candidate === key && ++localStateWrites === 2) {
            throw new Error("audit: reject final local marker removal");
          }
          return originalSetItem.apply(this, arguments);
        };
        IDBObjectStore.prototype.put = function (_value, candidate) {
          if (candidate === key && ++idbStateWrites === 2) {
            throw new Error("audit: reject final IDB marker removal");
          }
          return originalPut.apply(this, arguments);
        };
        try {
          const result = await window.__testFinalizeCurrentProgram();
          return { result, localStateWrites, idbStateWrites };
        } finally {
          Storage.prototype.setItem = originalSetItem;
          IDBObjectStore.prototype.put = originalPut;
        }
      },
      { key: KEY }
    );
    const interrupted = await readRuntime(page);

    check(
      observed.localStateWrites === 3 &&
        observed.idbStateWrites === 3 &&
        observed.result?.localOk === false &&
        observed.result?.idbOk === false &&
        observed.result?.compensationPending === false &&
        observed.result?.compensationLocalOk === true &&
        observed.result?.compensationIdbOk === true,
      "failed marker removal triggers a durable third-write compensation before rejection",
      observed
    );
    check(
      interrupted.local?.programMeta?.id === before.local?.programMeta?.id &&
        interrupted.idb?.programMeta?.id === before.idb?.programMeta?.id &&
        !interrupted.local?._storageDraftTransaction &&
        !interrupted.idb?._storageDraftTransaction &&
        interrupted.draftRaw === draftRaw &&
        interrupted.persistenceArtifacts.length === 0,
      "compensation restores the prior program and exact draft before returning",
      {
        local: programSummary(interrupted.local),
        idb: programSummary(interrupted.idb),
        canonicalDraft: interrupted.draftRaw,
        stateJournals: interrupted.pendingEntries.length,
        sidecars: interrupted.draftPendingEntries.length,
        artifacts: interrupted.persistenceArtifacts,
      }
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    const reloaded = await readRuntime(page);
    check(
      reloaded.local?.programMeta?.id === before.local?.programMeta?.id &&
        reloaded.idb?.programMeta?.id === before.idb?.programMeta?.id &&
        !reloaded.local?._storageDraftTransaction &&
        !reloaded.idb?._storageDraftTransaction &&
        reloaded.draftRaw === draftRaw &&
        reloaded.persistenceArtifacts.length === 0,
      "reload cannot resurrect a replacement reported as rejected",
      {
        local: programSummary(reloaded.local),
        idb: programSummary(reloaded.idb),
        canonicalDraft: reloaded.draftRaw,
        stateJournals: reloaded.pendingEntries.length,
        artifacts: reloaded.persistenceArtifacts,
      }
    );

    check(
      observed.result?.localOk ||
        observed.result?.idbOk ||
        (reloaded.local?.programMeta?.id === before.local?.programMeta?.id &&
          reloaded.idb?.programMeta?.id === before.idb?.programMeta?.id),
      "a reported both-store failure cannot reload as the permanently committed replacement",
      {
        result: observed.result,
        beforeProgramId: before.local?.programMeta?.id,
        reloadedLocalProgramId: reloaded.local?.programMeta?.id,
        reloadedIdbProgramId: reloaded.idb?.programMeta?.id,
      }
    );
  } finally {
    await context.close();
  }
}

async function runLateSidecarFailedCompensation(browser) {
  console.log("\n2a. Failed late-sidecar compensation retains a boot rollback witness");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const writer = await openApp(context);
    const originalDraftRaw = JSON.stringify(workoutDraft("late-sidecar-original", "96.75"));
    await seedScenario(writer, { state: fixture({ revision: 55 }), draftRaw: originalDraftRaw });
    const before = await readRuntime(writer);
    const stale = await openPopup(context, writer, "adversarial-late-sidecar-stale");
    await stale.evaluate((draftPendingPrefix) => {
      const originalSetItem = Storage.prototype.setItem;
      window.__adversarialStagedRaw = null;
      window.__adversarialRestoreSidecarCapture = () => {
        Storage.prototype.setItem = originalSetItem;
        delete window.__adversarialRestoreSidecarCapture;
      };
      Storage.prototype.setItem = function (candidate, value) {
        if (typeof candidate === "string" && candidate.startsWith(draftPendingPrefix)) {
          try {
            window.__adversarialStagedRaw = JSON.parse(value)?.raw ?? null;
          } catch {}
        }
        return originalSetItem.apply(this, arguments);
      };
    }, DRAFT_PENDING_PREFIX);

    const observed = await writer.evaluate(
      async ({ key, pendingPrefix, loadKey, newerLoad }) => {
        const originalSetItem = Storage.prototype.setItem;
        const originalRemoveItem = Storage.prototype.removeItem;
        const originalPut = IDBObjectStore.prototype.put;
        let localStateWrites = 0;
        let idbStateWrites = 0;
        let injected = false;
        let journalPresentAtInjection = false;
        let stagedRaw = null;
        Storage.prototype.setItem = function (candidate) {
          if (candidate === key && ++localStateWrites > 2) {
            throw new Error("audit: reject late-sidecar local compensation");
          }
          return originalSetItem.apply(this, arguments);
        };
        IDBObjectStore.prototype.put = function (_value, candidate) {
          if (candidate === key && ++idbStateWrites > 2) {
            throw new Error("audit: reject late-sidecar IDB compensation");
          }
          return originalPut.apply(this, arguments);
        };
        Storage.prototype.removeItem = function (candidate) {
          if (!injected && typeof candidate === "string" && candidate.startsWith(pendingPrefix)) {
            const staleTab = window.__adversarialStaleTab;
            const input = staleTab?.document.querySelector(`[data-k="${loadKey}"]`);
            if (input) {
              injected = true;
              journalPresentAtInjection = localStorage.getItem(candidate) != null;
              input.value = newerLoad;
              input.dispatchEvent(new staleTab.Event("input", { bubbles: true }));
              stagedRaw = staleTab.__adversarialStagedRaw;
            }
          }
          return originalRemoveItem.apply(this, arguments);
        };
        try {
          const result = await window.__testFinalizeCurrentProgram();
          return {
            result,
            localStateWrites,
            idbStateWrites,
            injected,
            journalPresentAtInjection,
            stagedRaw,
          };
        } finally {
          Storage.prototype.setItem = originalSetItem;
          Storage.prototype.removeItem = originalRemoveItem;
          IDBObjectStore.prototype.put = originalPut;
          window.__adversarialStaleTab?.__adversarialRestoreSidecarCapture?.();
        }
      },
      {
        key: KEY,
        pendingPrefix: PENDING_PREFIX,
        loadKey: `${SET_KEY}_load`,
        newerLoad: "146.25",
      }
    );
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const interrupted = await readRuntime(writer);

    check(
      observed.injected &&
        observed.journalPresentAtInjection &&
        rawDraftLoad(observed.stagedRaw) === "146.25" &&
        observed.localStateWrites >= 3 &&
        observed.idbStateWrites >= 3,
      "precondition: different-raw related sidecar lands during close after both successor writes",
      observed
    );
    check(
      observed.result?.draftConflict === true &&
        observed.result?.localOk === false &&
        observed.result?.idbOk === false &&
        observed.result?.compensationPending === true &&
        interrupted.draftRaw === observed.stagedRaw &&
        interrupted.pendingEntries.length === 1,
      "failed compensation is reported as pending and retains its rollback journal",
      {
        result: observed.result,
        local: programSummary(interrupted.local),
        idb: programSummary(interrupted.idb),
        draftMatches: interrupted.draftRaw === observed.stagedRaw,
        pendingCount: interrupted.pendingEntries.length,
        artifacts: interrupted.persistenceArtifacts,
      }
    );

    await stale.close();
    await writer.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(writer);
    const recovered = await readRuntime(writer);
    const toastText = await writer.locator("#toast").innerText();
    check(
      recovered.local?.programMeta?.id === before.local?.programMeta?.id &&
        recovered.idb?.programMeta?.id === before.idb?.programMeta?.id &&
        recovered.draftRaw === observed.stagedRaw &&
        recovered.persistenceArtifacts.length === 0 &&
        /retry|try again/i.test(toastText),
      "boot accepts the retained rollback, heals both replicas, and drains cleanup artifacts",
      {
        beforeProgramId: before.local?.programMeta?.id,
        local: programSummary(recovered.local),
        idb: programSummary(recovered.idb),
        draftMatches: recovered.draftRaw === observed.stagedRaw,
        artifacts: recovered.persistenceArtifacts,
        toastText,
      }
    );
  } finally {
    await context.close();
  }
}

async function runDeferredBlockFinalization(browser) {
  console.log("\n2b. Block finalization failure remains explicitly deferred");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const page = await openApp(context);
    const originalState = fixture({ revision: 60 });
    const draftRaw = JSON.stringify(workoutDraft("deferred-block-finalization", "97.5"));
    await seedScenario(page, { state: originalState, draftRaw });

    const observed = await page.evaluate(
      async ({ key, expectedProgramId }) => {
        const originalSetItem = Storage.prototype.setItem;
        const originalPut = IDBObjectStore.prototype.put;
        let localStateWrites = 0;
        let idbStateWrites = 0;
        Storage.prototype.setItem = function (candidate) {
          if (candidate === key && ++localStateWrites > 1) {
            throw new Error("audit: defer local block finalization and compensation");
          }
          return originalSetItem.apply(this, arguments);
        };
        IDBObjectStore.prototype.put = function (_value, candidate) {
          if (candidate === key && ++idbStateWrites > 1) {
            throw new Error("audit: defer IDB block finalization and compensation");
          }
          return originalPut.apply(this, arguments);
        };
        try {
          const result = await window.__repforgeCommitNextBlock("reduce_volume", undefined, expectedProgramId);
          return { result, localStateWrites, idbStateWrites };
        } finally {
          Storage.prototype.setItem = originalSetItem;
          IDBObjectStore.prototype.put = originalPut;
        }
      },
      { key: KEY, expectedProgramId: originalState.programMeta.id }
    );
    const interrupted = await readRuntime(page);
    check(
      observed.localStateWrites === 3 &&
        observed.idbStateWrites === 3 &&
        observed.result?.accepted === true &&
        observed.result?.deferred === true &&
        observed.result?.finalizationPending === true &&
        observed.result?.committed === false &&
        observed.result?.kind === "deferred" &&
        observed.result?.localOk === true &&
        observed.result?.idbOk === true,
      "a provisional block accepted by both replicas reports deferred instead of committed",
      observed
    );
    check(
      interrupted.local?.programMeta?.id !== originalState.programMeta.id &&
        interrupted.idb?.programMeta?.id !== originalState.programMeta.id &&
        interrupted.local?._storageDraftTransaction?.version === 1 &&
        interrupted.idb?._storageDraftTransaction?.version === 1 &&
        interrupted.draftRaw === draftRaw &&
        interrupted.pendingEntries.length === 1,
      "deferred block state retains its finalization marker, journal, and exact draft",
      {
        local: programSummary(interrupted.local),
        idb: programSummary(interrupted.idb),
        draftMatches: interrupted.draftRaw === draftRaw,
        pendingCount: interrupted.pendingEntries.length,
      }
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    const finalized = await readRuntime(page);
    check(
      finalized.local?.programMeta?.id === interrupted.local?.programMeta?.id &&
        finalized.idb?.programMeta?.id === interrupted.idb?.programMeta?.id &&
        !finalized.local?._storageDraftTransaction &&
        !finalized.idb?._storageDraftTransaction &&
        finalized.draftRaw === draftRaw &&
        finalized.persistenceArtifacts.length === 0,
      "boot finalizes the explicitly deferred block without losing its draft",
      {
        local: programSummary(finalized.local),
        idb: programSummary(finalized.idb),
        draftMatches: finalized.draftRaw === draftRaw,
        pendingCount: finalized.pendingEntries.length,
        artifacts: finalized.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function runOversizedRequiredEffects(browser) {
  console.log("\n3a. Oversized required draft effects fail closed in-page");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const page = await openApp(context);
    const originalState = fixture({ revision: 70 });
    const draftRaw = oversizedDraftRaw("oversized-required-effect");
    await seedScenario(page, { state: originalState, draftRaw });
    await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false }));
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });

    const finishResult = await page.evaluate(() => window.__repforgeSaveWorkout());
    await page.evaluate(() => window.__repforgeStorage.flush());
    const afterFinish = await readRuntime(page);
    check(
      draftRaw.length > 1_000_000 &&
        finishResult?.effectInvalid === true &&
        !finishResult.localOk &&
        !finishResult.idbOk &&
        afterFinish.local?.log?.length === 0 &&
        afterFinish.idb?.log?.length === 0 &&
        afterFinish.draftRaw === draftRaw &&
        afterFinish.persistenceArtifacts.length === 0,
      "Finish fails closed before writing state when its required draft effect is oversized",
      {
        draftLength: draftRaw.length,
        finishResult,
        localRows: afterFinish.local?.log?.length,
        idbRows: afterFinish.idb?.log?.length,
        draftUnchanged: afterFinish.draftRaw === draftRaw,
        stateJournals: afterFinish.pendingEntries.length,
        artifacts: afterFinish.persistenceArtifacts,
      }
    );

    check(
      !(finishResult?.localOk || finishResult?.idbOk) || afterFinish.draftRaw === null,
      "an accepted Finish cannot silently omit its required exact draft clear",
      {
        draftLength: draftRaw.length,
        finishResult,
        acceptedRows: afterFinish.local?.log?.length,
        canonicalDraftPresent: afterFinish.draftRaw != null,
      }
    );

    const replaceResult = await page.evaluate(() => window.__testFinalizeCurrentProgram());
    await page.evaluate(() => window.__repforgeStorage.flush());
    const afterReplace = await readRuntime(page);
    const draftExerciseStillInProgram = afterReplace.local?.program?.some(
      (exercise) => exercise.id === EXERCISE_ID
    );
    check(
      replaceResult?.effectInvalid === true &&
        !replaceResult.localOk &&
        !replaceResult.idbOk &&
        afterReplace.local?.programMeta?.id === originalState.programMeta.id &&
        afterReplace.idb?.programMeta?.id === originalState.programMeta.id &&
        afterReplace.draftRaw === draftRaw &&
        draftExerciseStillInProgram === true,
      "destructive replacement fails closed before changing an oversized draft's program",
      {
        replaceResult,
        local: programSummary(afterReplace.local),
        idb: programSummary(afterReplace.idb),
        draftLength: afterReplace.draftRaw?.length ?? 0,
        draftExerciseStillInProgram,
      }
    );

    check(
      !(replaceResult?.localOk || replaceResult?.idbOk) || afterReplace.draftRaw === null,
      "an accepted destructive program replacement cannot silently omit its required draft guard",
      {
        draftLength: draftRaw.length,
        replaceResult,
        replacementProgramId: afterReplace.local?.programMeta?.id,
        canonicalDraftPresent: afterReplace.draftRaw != null,
        draftExerciseStillInProgram,
      }
    );
  } finally {
    await context.close();
  }
}

async function runMalformedBootEffect(browser) {
  console.log("\n3b. Malformed required v2 effect fails closed during boot replay");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const page = await openApp(context);
    const originalState = fixture({ revision: 80 });
    const draftRaw = JSON.stringify(workoutDraft("malformed-boot-required-effect", "102.5"));
    await seedScenario(page, { state: originalState, draftRaw });
    const proposal = replacementState(originalState, {
      revision: 80,
      programId: "malformed-effect-proposal",
      programName: "Malformed effect proposal",
    });
    const journalId = "audit-malformed-required-effect";
    const journal = {
      version: 2,
      id: journalId,
      order: { at: 1, writer: "audit-malformed-effect", seq: 1 },
      base: unversioned(originalState),
      liveBase: unversioned(originalState),
      proposal: unversioned(proposal),
      replace: false,
      expectedProgramId: null,
      effect: {
        required: true,
        kind: "clear-draft",
        expectedRaw: draftRaw,
        precondition: "malformed-required-precondition",
      },
    };
    await page.evaluate(
      ({ key, raw }) => localStorage.setItem(key, raw),
      { key: `${PENDING_PREFIX}${journalId}`, raw: JSON.stringify(journal) }
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForBootOrRecovery(page);
    const replayed = await readRuntime(page);

    check(
      replayed.local?.programMeta?.id === originalState.programMeta.id &&
        replayed.idb?.programMeta?.id === originalState.programMeta.id &&
        replayed.draftRaw === draftRaw &&
        replayed.persistenceArtifacts.length === 0 &&
        replayed.recoveryOpen === false,
      "boot drains a malformed v2 effect without applying its proposal",
      {
        local: programSummary(replayed.local),
        idb: programSummary(replayed.idb),
        canonicalDraftLoad: rawDraftLoad(replayed.draftRaw),
        stateJournals: replayed.pendingEntries.length,
        artifacts: replayed.persistenceArtifacts,
        recoveryOpen: replayed.recoveryOpen,
      }
    );

    check(
      replayed.local?.programMeta?.id === originalState.programMeta.id &&
        replayed.idb?.programMeta?.id === originalState.programMeta.id &&
        replayed.draftRaw === draftRaw,
      "boot replay refuses a v2 proposal whose declared required draft effect is malformed",
      {
        expectedProgramId: originalState.programMeta.id,
        localProgramId: replayed.local?.programMeta?.id,
        idbProgramId: replayed.idb?.programMeta?.id,
        canonicalDraftPreserved: replayed.draftRaw === draftRaw,
        recoveryOpen: replayed.recoveryOpen,
      }
    );
  } finally {
    await context.close();
  }
}

async function runDirectDraftOwnerRace(browser) {
  console.log("\n4. requestWorkoutDay refusal preserves transaction-owned queued progress");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const writer = await openApp(context);
    const originalState = fixture({ revision: 90 });
    const canonicalDraftRaw = JSON.stringify(workoutDraft("direct-owner-canonical", "106.25"));
    await seedScenario(writer, { state: originalState, draftRaw: canonicalDraftRaw });
    const stale = await openApp(context);
    const locker = await openApp(context);
    await holdStorageLock(locker);
    await writer.evaluate(() => {
      window.__adversarialOwnerResult = window.__testFinalizeCurrentProgram();
    });
    await waitForPendingStorageLock(locker);

    await stale.locator(`[data-k="${SET_KEY}_load"]`).fill("157.5");
    await waitForDraftPendingValue(stale, `${SET_KEY}_load`, "157.5");
    const staged = await readRuntime(stale);
    const stagedRaw = latestDraftPendingRaw(staged);
    const dialogs = [];
    stale.on("dialog", async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.dismiss();
    });
    const dayChangeAccepted = await stale.evaluate(() =>
      window.__repforgeEnterWorkout({ day: "Day 2", focus: false })
    );
    const afterRefusal = await readRuntime(stale);
    const afterRefusalRaw = latestDraftPendingRaw(afterRefusal);

    check(
      staged.draftRaw === canonicalDraftRaw &&
        rawDraftLoad(stagedRaw) === "157.5" &&
        staged.draftPendingEntries.length === 1,
      "precondition: destructive owner holds a queued newer draft beside older canonical bytes",
      {
        canonicalLoad: rawDraftLoad(staged.draftRaw),
        stagedLoad: rawDraftLoad(stagedRaw),
        sidecars: staged.draftPendingEntries.length,
      }
    );
    check(
      dayChangeAccepted === false &&
        dialogs.length === 1 &&
        afterRefusal.draftRaw === canonicalDraftRaw &&
        afterRefusalRaw === stagedRaw,
      "day-change refusal leaves transaction-owned staged bytes untouched",
      {
        dayChangeAccepted,
        dialogs,
        canonicalLoad: rawDraftLoad(afterRefusal.draftRaw),
        stagedLoadBefore: rawDraftLoad(stagedRaw),
        stagedLoadAfter: rawDraftLoad(afterRefusalRaw),
        sidecarsAfter: afterRefusal.draftPendingEntries.length,
      }
    );

    check(
      dayChangeAccepted === false &&
        afterRefusal.draftRaw === canonicalDraftRaw &&
        afterRefusalRaw === stagedRaw,
      "requestWorkoutDay refusal preserves the exact transaction-owned draft returned by DraftStore",
      {
        dayChangeAccepted,
        canonicalLoad: rawDraftLoad(afterRefusal.draftRaw),
        stagedLoadBefore: rawDraftLoad(stagedRaw),
        stagedLoadAfter: rawDraftLoad(afterRefusalRaw),
        exactStagedBytesPreserved: afterRefusalRaw === stagedRaw,
      }
    );

    await releaseStorageLock(locker);
    const transactionResult = await writer.evaluate(() => window.__adversarialOwnerResult);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);
    check(
      transactionResult?.draftConflict === true &&
        final.local?.programMeta?.id === originalState.programMeta.id &&
        final.idb?.programMeta?.id === originalState.programMeta.id &&
        final.draftRaw === stagedRaw &&
        final.persistenceArtifacts.length === 0,
      "transaction rejection promotes the newer staged draft while retaining the old program",
      {
        transactionResult,
        local: programSummary(final.local),
        idb: programSummary(final.idb),
        finalCanonicalLoad: rawDraftLoad(final.draftRaw),
        lostLoad: rawDraftLoad(stagedRaw),
        stateJournals: final.pendingEntries.length,
        sidecars: final.draftPendingEntries.length,
        artifacts: final.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function runStoredCloseMarkerFailure(browser) {
  console.log("\n5. Stored recovery fails closed when close-marker creation fails");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const page = await openApp(context);
    const previous = fixture({ revision: 100 });
    const expectedDraftRaw = JSON.stringify(workoutDraft("stored-close-marker-expected", "108.75"));
    const concurrentDraftRaw = JSON.stringify(workoutDraft("stored-close-marker-concurrent", "166.25"));
    await seedScenario(page, { state: previous, draftRaw: expectedDraftRaw });

    const transactionId = "audit-stored-close-marker-failure";
    const prepared = replacementState(previous, {
      revision: previous._storageRevision + 1,
      programId: "stored-close-marker-replacement",
      programName: "Stored close-marker replacement",
    });
    prepared._storageDraftTransaction = {
      version: 1,
      id: transactionId,
      previous: clone(previous),
      effect: {
        required: true,
        kind: "clear-draft",
        expectedRaw: expectedDraftRaw,
        precondition: "abort-changed",
      },
    };
    await writeReplicas(page, prepared);
    const seeded = await readRuntime(page);

    const observed = await page.evaluate(
      async ({ draftKey, closeKey, concurrentRaw }) => {
        const originalSetItem = Storage.prototype.setItem;
        const originalRemoveItem = Storage.prototype.removeItem;
        let closeMarkerFailures = 0;
        let otherStorageFailures = 0;
        let concurrentWriteInjected = false;
        let injectionPhase = null;

        Storage.prototype.setItem = function (candidate) {
          if (candidate === closeKey) {
            closeMarkerFailures++;
            throw new DOMException("audit: reject close-marker creation", "QuotaExceededError");
          }
          try {
            return originalSetItem.apply(this, arguments);
          } catch (error) {
            otherStorageFailures++;
            throw error;
          }
        };
        Storage.prototype.removeItem = function (candidate) {
          if (candidate === draftKey && closeMarkerFailures > 0 && !concurrentWriteInjected) {
            originalSetItem.call(this, draftKey, concurrentRaw);
            concurrentWriteInjected = true;
            injectionPhase = "before-canonical-effect";
          }
          return originalRemoveItem.apply(this, arguments);
        };

        try {
          const decision = await window.resolveBootReplicas();
          if (!concurrentWriteInjected) {
            originalSetItem.call(localStorage, draftKey, concurrentRaw);
            concurrentWriteInjected = true;
            injectionPhase = "after-fail-closed-return";
          }
          return {
            decision: { kind: decision.kind, reason: decision.reason ?? null },
            closeMarkerFailures,
            otherStorageFailures,
            concurrentWriteInjected,
            injectionPhase,
            canonicalDraftRaw: localStorage.getItem(draftKey),
            closeMarkerRaw: localStorage.getItem(closeKey),
          };
        } finally {
          Storage.prototype.setItem = originalSetItem;
          Storage.prototype.removeItem = originalRemoveItem;
        }
      },
      {
        draftKey: DRAFT,
        closeKey: `${DRAFT_CLOSE_PREFIX}${transactionId}`,
        concurrentRaw: concurrentDraftRaw,
      }
    );

    const after = await readRuntime(page);
    const failClosed =
      observed.decision.kind === "unresolved" &&
      observed.decision.reason === "pending-transaction" &&
      after.local?._storageDraftTransaction?.id === transactionId &&
      after.idb?._storageDraftTransaction?.id === transactionId;
    const canonicalPreserved =
      observed.canonicalDraftRaw === concurrentDraftRaw && after.draftRaw === concurrentDraftRaw;

    check(
      seeded.draftRaw === expectedDraftRaw &&
        seeded.local?._storageDraftTransaction?.id === transactionId &&
        seeded.idb?._storageDraftTransaction?.id === transactionId &&
        observed.closeMarkerFailures > 0 &&
        observed.otherStorageFailures === 0 &&
        observed.concurrentWriteInjected &&
        observed.closeMarkerRaw === null,
      "precondition: only close-marker creation fails during stored recovery",
      {
        seededCanonicalLoad: rawDraftLoad(seeded.draftRaw),
        closeMarkerFailures: observed.closeMarkerFailures,
        otherStorageFailures: observed.otherStorageFailures,
        concurrentWriteInjected: observed.concurrentWriteInjected,
        injectionPhase: observed.injectionPhase,
        closeMarkerPresent: observed.closeMarkerRaw != null,
      }
    );
    check(
      canonicalPreserved && failClosed,
      "stored recovery preserves a concurrent canonical draft and remains durably fail closed",
      {
        decision: observed.decision,
        injectionPhase: observed.injectionPhase,
        expectedConcurrentLoad: rawDraftLoad(concurrentDraftRaw),
        observedCanonicalLoad: rawDraftLoad(after.draftRaw),
        canonicalPreserved,
        local: programSummary(after.local),
        idb: programSummary(after.idb),
        localTransactionId: after.local?._storageDraftTransaction?.id ?? null,
        idbTransactionId: after.idb?._storageDraftTransaction?.id ?? null,
        failClosed,
      }
    );
  } finally {
    await context.close();
  }
}

async function runSettingsUnitDraftFailure(browser) {
  console.log("\n6. Settings unit conversion fails atomically when draft publication fails");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const page = await openApp(context);
    const originalState = fixture({ revision: 110 });
    const originalDraftRaw = JSON.stringify(workoutDraft("settings-unit-publication-failure", "100"));
    await seedScenario(page, { state: originalState, draftRaw: originalDraftRaw });
    const before = await readRuntime(page);

    const observed = await page.evaluate(
      async ({ draftKey }) => {
        const originalSetItem = Storage.prototype.setItem;
        let draftPublicationAttempts = 0;
        let otherStorageFailures = 0;
        Storage.prototype.setItem = function (candidate) {
          if (candidate === draftKey) {
            draftPublicationAttempts++;
            throw new DOMException("audit: reject converted draft publication", "QuotaExceededError");
          }
          try {
            return originalSetItem.apply(this, arguments);
          } catch (error) {
            otherStorageFailures++;
            throw error;
          }
        };
        try {
          window.__repforgeShowSettings();
          const unit = document.querySelector("#unit");
          unit.value = "lb";
          unit.dispatchEvent(new Event("input", { bubbles: true }));
          const result = await document.querySelector("#saveSettings").onclick();
          await window.__repforgeStorage.flush();
          return { result, draftPublicationAttempts, otherStorageFailures };
        } finally {
          Storage.prototype.setItem = originalSetItem;
        }
      },
      { draftKey: DRAFT }
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    const reloaded = await readRuntime(page);
    const resultRejected = !(observed.result?.localOk || observed.result?.idbOk);
    const settingsCompensated =
      reloaded.local?.settings?.unit === "kg" && reloaded.idb?.settings?.unit === "kg";
    const exactDraftPreserved = reloaded.draftRaw === originalDraftRaw;

    check(
      before.local?.settings?.unit === "kg" &&
        before.idb?.settings?.unit === "kg" &&
        before.draftRaw === originalDraftRaw &&
        observed.draftPublicationAttempts > 0 &&
        observed.otherStorageFailures === 0,
      "precondition: only canonical draft publication fails during a real kg-to-lb Settings save",
      {
        beforeLocalUnit: before.local?.settings?.unit,
        beforeIdbUnit: before.idb?.settings?.unit,
        beforeDraftLoad: rawDraftLoad(before.draftRaw),
        draftPublicationAttempts: observed.draftPublicationAttempts,
        otherStorageFailures: observed.otherStorageFailures,
      }
    );
    check(
      resultRejected &&
        settingsCompensated &&
        exactDraftPreserved &&
        reloaded.persistenceArtifacts.length === 0 &&
        !reloaded.local?._storageDraftTransaction &&
        !reloaded.idb?._storageDraftTransaction,
      "failed unit conversion rejects the Settings commit and preserves the exact kg draft",
      {
        result: observed.result,
        localUnit: reloaded.local?.settings?.unit,
        idbUnit: reloaded.idb?.settings?.unit,
        retainedDraftLoad: rawDraftLoad(reloaded.draftRaw),
        exactDraftPreserved,
        stateJournals: reloaded.pendingEntries.length,
        sidecars: reloaded.draftPendingEntries.length,
        artifacts: reloaded.persistenceArtifacts,
        localTransaction: reloaded.local?._storageDraftTransaction?.version ?? null,
        idbTransaction: reloaded.idb?._storageDraftTransaction?.version ?? null,
      }
    );
  } finally {
    await context.close();
  }
}

async function runSettingsUnitDraftConflict(browser) {
  console.log("\n7. Settings unit conversion rejects a newer draft");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const writer = await openApp(context);
    const originalState = fixture({ revision: 120 });
    const originalDraftRaw = JSON.stringify(workoutDraft("settings-unit-conflict-original", "100"));
    const newerDraftRaw = JSON.stringify(workoutDraft("settings-unit-conflict-newer", "145"));
    await seedScenario(writer, { state: originalState, draftRaw: originalDraftRaw });
    const locker = await openApp(context);
    await holdStorageLock(locker);

    await writer.evaluate(() => {
      window.__repforgeShowSettings();
      const unit = document.querySelector("#unit");
      unit.value = "lb";
      window.__settingsUnitConflictResult = unit.onchange();
    });
    await waitForPendingStorageLock(locker);
    await locker.evaluate(
      ({ draftKey, raw }) => localStorage.setItem(draftKey, raw),
      { draftKey: DRAFT, raw: newerDraftRaw }
    );
    await releaseStorageLock(locker);
    const result = await writer.evaluate(() => window.__settingsUnitConflictResult);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      result?.draftConflict === true &&
        !result.localOk &&
        !result.idbOk &&
        final.local?.settings?.unit === "kg" &&
        final.idb?.settings?.unit === "kg" &&
        final.draftRaw === newerDraftRaw &&
        final.persistenceArtifacts.length === 0,
      "a newer draft rejects unit conversion without changing its bytes or persisted unit",
      {
        result,
        localUnit: final.local?.settings?.unit,
        idbUnit: final.idb?.settings?.unit,
        expectedDraftLoad: rawDraftLoad(newerDraftRaw),
        retainedDraftLoad: rawDraftLoad(final.draftRaw),
        exactDraftPreserved: final.draftRaw === newerDraftRaw,
        stateJournals: final.pendingEntries.length,
        sidecars: final.draftPendingEntries.length,
        artifacts: final.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function runScenario(name, scenario) {
  try {
    await scenario();
  } catch (error) {
    failures.push(`${name}: harness error`);
    console.error(`  ✗ ${name}: harness error`);
    console.error(error?.stack || error);
  }
}

async function main() {
  console.log("Adversarial draft-transaction regressions");
  console.log(`Target: ${BASE}`);
  const browser = await launchChromium();
  try {
    if (!FOCUSED_SCENARIO) {
      await runScenario("post-final-check orphan", () => runFinalCheckOrphan(browser));
      await runScenario("post-guard stale draft", () => runPostGuardReleaseDraft(browser));
      await runScenario("unload-safe draft WAL", () => runUnloadSafeDraftWal(browser));
      await runScenario("same-raw draft WAL acceptance", () => runSameRawDraftWalAcceptance(browser));
      await runScenario("expectedProgramId duplicate cleanup", () => runDuplicateCleanupOrphan(browser));
      await runScenario("final marker-removal total failure", () => runFinalMarkerFailure(browser));
      await runScenario("late-sidecar failed compensation", () => runLateSidecarFailedCompensation(browser));
      await runScenario("deferred block finalization", () => runDeferredBlockFinalization(browser));
      await runScenario("oversized in-page required effects", () => runOversizedRequiredEffects(browser));
      await runScenario("malformed boot required effect", () => runMalformedBootEffect(browser));
      await runScenario("direct draft owner race", () => runDirectDraftOwnerRace(browser));
    }
    if (!FOCUSED_SCENARIO || FOCUSED_SCENARIO === "stored-close-marker-failure") {
      await runScenario("stored recovery close-marker failure", () => runStoredCloseMarkerFailure(browser));
    }
    if (!FOCUSED_SCENARIO || FOCUSED_SCENARIO === "settings-unit-draft-failure") {
      await runScenario("Settings unit draft publication failure", () => runSettingsUnitDraftFailure(browser));
    }
    if (!FOCUSED_SCENARIO || FOCUSED_SCENARIO === "settings-unit-draft-conflict") {
      await runScenario("Settings unit newer-draft conflict", () => runSettingsUnitDraftConflict(browser));
    }
  } finally {
    await browser.close();
  }

  console.log(`\nPASSED: ${passed}`);
  console.log(`FAILED: ${failures.length}`);
  if (failures.length) {
    console.error("\nObserved failing assertions:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Regression crashed:", error);
  process.exit(2);
});
