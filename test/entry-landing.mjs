#!/usr/bin/env node
/**
 * Characterization of entry jobs, activation, and first-run boundaries (Plan 054 packet 054-P1).
 *
 * Proves:
 * (1) Recommend, Custom, Browse, Build, and Import are each reachable through current production controls
 *     and route to their current semantic first step;
 * (2) Before candidate activation, route staging does not mutate active durable program/settings/log/history
 *     in either replica (localStorage repforge_v1 and IndexedDB repforge/kv), while the owned ordinary setup
 *     draft (repforge_program_setup_draft_v1) may persist;
 * (3) A valid shared setup reaches the shared gate with the correct Start action; before that action,
 *     there is no shared payload field in any durable program/settings/log/history or candidate record;
 * (4) After Start but before separate preview activation, the owned setup draft may hold the reviewed
 *     shared candidate while active durable state stays unchanged;
 * (5) Onboarded and history-bearing devices refuse the shared setup without mutation;
 * (6) Abandoning first run returns to ordinary Today and Program no-program states without minting a program;
 * (7) Current install and global-tour behavior is recorded as baseline, not redesigned;
 * (8) repforge_setup_v1 cookie may contain the exact encoded proposal as approved transport and must
 *     not make the semantic durable-state oracle fail.
 *
 * Proof-first fault switch:
 * REPFORGE_ENTRY_LANDING_FAULT=persist-shared injects a payload-derived candidate or durable field
 * before the pre-Start oracle to verify that the isolation assertion fails as intended.
 *
 * Run: node test/entry-landing.mjs
 */
import { pathToFileURL } from "url";
import { isDeepStrictEqual } from "node:util";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import {
  CURRENT_SETTINGS_DEFAULTS,
  REPRESENTATIVE_PAYLOAD,
  cloneFixture,
} from "./fixtures/shared-setup.mjs";
import {
  APP_INDEX,
  SHARED_COPY,
  encodeSharedPayload,
  openAppPage,
  sharedGateSnapshot,
  waitForFirstRun,
} from "./shared-setup-flow.mjs";

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:8054/";
const FAULT = process.env.REPFORGE_ENTRY_LANDING_FAULT;

const KEY = "repforge_v1";
const SETUP_DRAFT = "repforge_program_setup_draft_v1";
const COOKIE = "repforge_setup_v1";

const SENTINELS = Object.freeze({
  name: "Sentinel Shared Characterization Program",
  customId: "custom:sentinel-shared-exercise",
  customName: "Sentinel Shared Incline Row",
});

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

const phase = (title) => console.log(`\n${title}`);

async function clearSite(page) {
  await page.evaluate(
    async ({ cookieName }) => {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie = `${cookieName}=; Max-Age=0; Path=/; SameSite=Lax`;
      await new Promise((res) => {
        const req = indexedDB.deleteDatabase("repforge");
        req.onsuccess = req.onerror = req.onblocked = () => res();
      });
    },
    { cookieName: COOKIE }
  );
}

async function persistState(page, state) {
  await page.evaluate(
    async ({ k, blob }) => {
      localStorage.setItem(k, JSON.stringify(blob));
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("repforge", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(blob, k);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { k: KEY, blob: state }
  );
}

async function dismissGates(page) {
  await page.evaluate(() => {
    window.closeFirstRun?.();
    const el = document.querySelector("#onboarding");
    if (el?.classList.contains("active") && typeof window.closeOnboarding === "function") {
      window.closeOnboarding();
    }
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function") {
      window.closeTour();
    }
  });
}

function makeSentinelPayload() {
  const p = cloneFixture(REPRESENTATIVE_PAYLOAD);
  p.program.meta.name = SENTINELS.name;
  if (p.program.customExercises?.[0]) {
    p.program.customExercises[0].id = SENTINELS.customId;
    p.program.customExercises[0].name = SENTINELS.customName;
    p.program.customExercises[0].namePt = SENTINELS.customName;
  }
  for (const ex of p.program.exercises || []) {
    if (ex.libraryId === "custom:coach-row") {
      ex.libraryId = SENTINELS.customId;
      ex.displayName = SENTINELS.customName;
    }
  }
  return p;
}

/**
 * Inspects both localStorage and IndexedDB replicas and any candidate records
 * for sentinel values, separating allowed transport cookies.
 */
async function inspectStorageScope(page) {
  return page.evaluate(
    async ({ sentinels, key, setupDraftKey, cookieName }) => {
      // 1. Read localStorage repforge_v1
      let localDurable = null;
      try {
        const raw = localStorage.getItem(key);
        localDurable = raw ? JSON.parse(raw) : null;
      } catch {}

      // 2. Read IndexedDB repforge/kv repforge_v1 and all keys
      let idbDurable = null;
      const allIdbKeys = [];
      const idbRecords = {};
      try {
        const db = await new Promise((res, rej) => {
          const r = indexedDB.open("repforge", 1);
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
        const tx = db.transaction("kv", "readonly");
        const store = tx.objectStore("kv");
        const keysReq = store.getAllKeys();
        await new Promise((res, rej) => {
          keysReq.onsuccess = () => res();
          keysReq.onerror = () => rej(keysReq.error);
        });
        for (const k of keysReq.result || []) {
          allIdbKeys.push(String(k));
          const getReq = store.get(k);
          await new Promise((res, rej) => {
            getReq.onsuccess = () => {
              idbRecords[String(k)] = getReq.result;
              res();
            };
            getReq.onerror = () => rej(getReq.error);
          });
        }
        idbDurable = idbRecords[key] || null;
        db.close();
      } catch {}

      // 3. Read localStorage keys
      const localKeys = Object.keys(localStorage);
      const localRecords = {};
      for (const k of localKeys) {
        localRecords[k] = localStorage.getItem(k);
      }
      const sessionRecords = {};
      for (const k of Object.keys(sessionStorage)) {
        sessionRecords[k] = sessionStorage.getItem(k);
      }
      const setupDraftRaw = localStorage.getItem(setupDraftKey);
      let setupDraft = null;
      try {
        setupDraft = setupDraftRaw ? JSON.parse(setupDraftRaw) : null;
      } catch {}

      // 4. Read cookies
      const cookies = document.cookie || "";
      const cookieMatch = cookies.match(new RegExp(`(?:^|; )${cookieName}=([^;]*)`));
      const setupCookie = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;

      const containsSentinel = (obj, sentinel) => {
        if (obj == null) return false;
        const str = typeof obj === "string" ? obj : JSON.stringify(obj);
        return str.includes(String(sentinel));
      };

      const activeLocalViolations = [];
      const activeIdbViolations = [];
      const candidateViolations = [];
      const otherStorageViolations = [];

      for (const [sentinelLabel, sentinelVal] of Object.entries(sentinels)) {
        if (containsSentinel(localDurable, sentinelVal)) {
          activeLocalViolations.push({
            sentinel: sentinelLabel,
            value: sentinelVal,
            target: "localStorage." + key,
          });
        }
        if (containsSentinel(idbDurable, sentinelVal)) {
          activeIdbViolations.push({
            sentinel: sentinelLabel,
            value: sentinelVal,
            target: "indexedDB.kv." + key,
          });
        }
        if (containsSentinel(setupDraft, sentinelVal)) {
          candidateViolations.push({
            sentinel: sentinelLabel,
            value: sentinelVal,
            target: "localStorage." + setupDraftKey,
          });
        }
        for (const [k, val] of Object.entries(localRecords)) {
          if (k !== key && k !== setupDraftKey && containsSentinel(val, sentinelVal)) {
            otherStorageViolations.push({
              sentinel: sentinelLabel,
              value: sentinelVal,
              target: "localStorage." + k,
            });
          }
        }
        for (const [k, val] of Object.entries(idbRecords)) {
          if (k !== key && containsSentinel(val, sentinelVal)) {
            otherStorageViolations.push({
              sentinel: sentinelLabel,
              value: sentinelVal,
              target: "indexedDB.kv." + k,
            });
          }
        }
      }

      return {
        localDurable,
        idbDurable,
        setupDraft,
        setupCookie,
        allLocalKeys: localKeys,
        allIdbKeys,
        localRecords,
        idbRecords,
        sessionRecords,
        activeLocalViolations,
        activeIdbViolations,
        candidateViolations,
        otherStorageViolations,
        onboardedLocal: localDurable?.programMeta?.onboarded === true,
        onboardedIdb: idbDurable?.programMeta?.onboarded === true,
        programCountLocal: (localDurable?.program || []).length,
        programCountIdb: (idbDurable?.program || []).length,
        logCountLocal: (localDurable?.log || []).length,
        logCountIdb: (idbDurable?.log || []).length,
        historyCountLocal: (localDurable?.programHistory || []).length,
        historyCountIdb: (idbDurable?.programHistory || []).length,
      };
    },
    {
      sentinels: SENTINELS,
      key: KEY,
      setupDraftKey: SETUP_DRAFT,
      cookieName: COOKIE,
    }
  );
}

function durableSemantics(state) {
  if (!state) return null;
  return {
    settings: state.settings ?? null,
    programMeta: state.programMeta ?? null,
    program: state.program ?? null,
    log: state.log ?? null,
    programHistory: state.programHistory ?? null,
    customExercises: state.customExercises ?? null,
  };
}

function assertSameDurableSemantics(actual, expected, label) {
  assert(
    isDeepStrictEqual(durableSemantics(actual.localDurable), durableSemantics(expected.localDurable)),
    `${label}: localStorage durable program/settings/log/history unchanged`
  );
  assert(
    isDeepStrictEqual(durableSemantics(actual.idbDurable), durableSemantics(expected.idbDurable)),
    `${label}: IndexedDB durable program/settings/log/history unchanged`
  );
}

// --------------------------------------------------------------------------
// Main suite execution
// --------------------------------------------------------------------------

const browser = await launchChromium();

try {
  // ------------------------------------------------------------------------
  // Requirement 1 & 2: Five entry routes reachability and route staging safety
  // ------------------------------------------------------------------------
  phase("Phase 1: Five entry routes reachable through production controls to semantic first step");
  {
    const { context, page } = await openAppPage(browser);
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await waitForFirstRun(page);

    // Click #firstRunCreate to open onboarding hub
    await page.click("#firstRunCreate");
    await page.waitForSelector("#onboarding.active", { timeout: 10000 });

    const getEntryState = async () =>
      page.evaluate(() => {
        const hook = window.__repforgeOnboarding;
        return hook ? hook.entry() : null;
      });

    // 1. Recommend route
    await page.click('[data-entry-route="recommend"]');
    await page.waitForSelector('[data-entry-pick="desiredResult"]', { timeout: 10000 });
    let entry = await getEntryState();
    assert(entry?.route === "recommend", "Recommend route selected");
    assert(entry?.step === "desired_result", "Recommend reaches semantic first step desired_result");
    let heading = await page.textContent("#entryHeading");
    assert(heading && heading.length > 0, "Recommend displays step title", heading);

    // Return to entry hub
    await page.click("#onbBack");
    await page.waitForSelector('[data-entry-route="recommend"]', { timeout: 10000 });

    // 2. Custom route
    await page.click('[data-entry-route="custom"]');
    await page.waitForSelector('[data-entry-pick="desiredResult"]', { timeout: 10000 });
    entry = await getEntryState();
    assert(entry?.route === "custom", "Custom route selected");
    assert(entry?.step === "desired_result", "Custom reaches semantic first step desired_result");

    // Return to entry hub
    await page.click("#onbBack");
    await page.waitForSelector('[data-entry-route="custom"]', { timeout: 10000 });

    // 3. Browse route
    await page.click('[data-entry-route="browse"]');
    await page.waitForSelector('[data-entry-pick="daysPerWeek"]', { timeout: 10000 });
    entry = await getEntryState();
    assert(entry?.route === "browse", "Browse route selected");
    assert(entry?.step === "schedule", "Browse reaches semantic first step schedule");

    // Return to entry hub
    await page.click("#onbBack");
    await page.waitForSelector("#entryOwnToggle", { timeout: 10000 });

    // 4. Build route (behind #entryOwnToggle)
    await page.click("#entryOwnToggle");
    await page.waitForSelector('[data-entry-route="build"]', { timeout: 10000 });
    await page.click('[data-entry-route="build"]');
    await page.waitForSelector("#entryProgramName", { timeout: 10000 });
    entry = await getEntryState();
    assert(entry?.route === "build", "Build route selected");
    assert(entry?.step === "build_setup", "Build reaches semantic first step build_setup");

    // Return to entry hub
    await page.click("#onbBack");
    await page.waitForSelector("#entryOwnToggle", { timeout: 10000 });

    // 5. Import route (behind #entryOwnToggle)
    await page.click("#entryOwnToggle");
    await page.waitForSelector('[data-entry-route="import"]', { timeout: 10000 });
    await page.click('[data-entry-route="import"]');
    await page.waitForSelector("#entryImportPick, #entryFreeformIn", { timeout: 10000 });
    entry = await getEntryState();
    assert(entry?.route === "import", "Import route selected");
    assert(entry?.step === "import_source", "Import reaches semantic first step import_source");

    // Return to entry hub
    await page.click("#onbBack");
    await page.waitForSelector('[data-entry-route="recommend"]', { timeout: 10000 });

    // 5b. Direct first-run Import control (#firstRunImport from first-run screen)
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await waitForFirstRun(page);
    await page.waitForSelector("#firstRunImport", { timeout: 10000 });
    await page.click("#firstRunImport");
    await page.waitForSelector("#entryImportPick, #entryFreeformIn", { timeout: 10000 });
    entry = await getEntryState();
    assert(entry?.route === "import" && entry?.step === "import_source", "Direct #firstRunImport opens import_source");

    // Check durable state was never mutated across route explorations
    const scope = await inspectStorageScope(page);
    assert(!scope.onboardedLocal && !scope.onboardedIdb, "active state remains not onboarded in both replicas");
    assert(scope.programCountLocal === 0 && scope.programCountIdb === 0, "active state has 0 program rows in both replicas");
    assert(scope.logCountLocal === 0 && scope.logCountIdb === 0, "active state has 0 log entries in both replicas");

    await context.close();
  }

  phase("Phase 2: Route staging preserves active durable state while owned setup draft persists");
  {
    const { context, page } = await openAppPage(browser);
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await waitForFirstRun(page);

    await page.click("#firstRunCreate");
    await page.waitForSelector('[data-entry-route="recommend"]', { timeout: 10000 });

    // Advance Recommend through steps
    await page.click('[data-entry-route="recommend"]');
    await page.click('[data-entry-pick="desiredResult"][data-entry-val="muscle_growth"]');
    await page.click("#onbNext");
    await page.waitForSelector('[data-entry-pick="structuredExperience"]', { timeout: 10000 });
    await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
    await page.click('[data-entry-pick="recentConsistency"][data-entry-val="most"]');
    await page.click("#onbNext");
    await page.waitForSelector('[data-entry-pick="daysPerWeek"]', { timeout: 10000 });

    const scope = await inspectStorageScope(page);
    assert(scope.onboardedLocal === false && scope.onboardedIdb === false, "staging does not mark onboarded");
    assert(scope.programCountLocal === 0 && scope.programCountIdb === 0, "staging mints 0 durable program rows");
    assert(scope.setupDraft != null, "owned setup draft (repforge_program_setup_draft_v1) is persisted");
    const draftAnswers = scope.setupDraft?.state?.answers || scope.setupDraft?.answers;
    assert(draftAnswers?.desiredResult === "muscle_growth", "setup draft holds in-progress staged answers");

    await context.close();
  }

  // ------------------------------------------------------------------------
  // Requirement 3 & 8: Valid shared setup pre-Start isolation and transport cookie
  // ------------------------------------------------------------------------
  phase("Phase 3: Valid shared setup pre-Start isolation (with proof-first fault switch)");
  {
    const sentinelPayload = makeSentinelPayload();
    const { context, page } = await openAppPage(browser);
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });

    const encoded = await encodeSharedPayload(page, sentinelPayload);
    assert(encoded?.ok && typeof encoded.value === "string", "sentinel payload encoded successfully", JSON.stringify(encoded));
    const scopeBeforeSetup = await inspectStorageScope(page);

    // Open setup link with hash #setup=<encoded>
    await page.goto(`${APP_INDEX}#setup=${encoded.value}`);
    await page.waitForSelector("#firstRun", { timeout: 10000 });
    await page.waitForSelector("#firstRunSharedProgram:not(.hidden)", { timeout: 10000 });

    const gate = await page.evaluate(sharedGateSnapshot);
    assert(gate.gate, "shared gate opens over setup link");
    assert(gate.sharedPresent && !gate.sharedHidden, "shared program row is visible");
    assert(gate.standardHidden, "standard program row is hidden");
    assert(gate.startVisible, "Start action is visible");
    assert(gate.startName.includes(SENTINELS.name), "Start button displays sentinel program name", gate.startName);

    // Hash should be cleared from URL
    const hash = await page.evaluate(() => location.hash);
    assert(hash === "", "proposal hash stripped from location.hash upon handoff");

    // Transport cookie repforge_setup_v1 is populated
    const scopePre = await inspectStorageScope(page);
    assert(scopePre.setupCookie === encoded.value, "repforge_setup_v1 transport cookie holds exact proposal");

    // Deterministic isolated fault injection point
    if (FAULT === "persist-shared") {
      console.log("  [FAULT INJECTION] Injecting a non-sentinel shared setting before Start action");
      await page.evaluate(
        ({ draftKey }) => {
          localStorage.setItem(
            draftKey,
            JSON.stringify({
              schemaVersion: 1,
              draftId: "fault-draft-id",
              revision: 1,
              ownerId: "fault-owner",
              state: {
                route: "shared",
                result: { candidate: { settings: { restSec: 165 } } },
              },
            })
          );
        },
        { draftKey: SETUP_DRAFT }
      );
    }

    // Oracle verification BEFORE Start action
    const scope = await inspectStorageScope(page);
    assertSameDurableSemantics(scope, scopeBeforeSetup, "before Start");
    assert(
      scope.setupDraft === null,
      "candidate record repforge_program_setup_draft_v1 is absent before Start",
      JSON.stringify(scope.setupDraft)
    );
    assert(
      isDeepStrictEqual(scope.localRecords, scopeBeforeSetup.localRecords),
      "no localStorage record changes before Start"
    );
    assert(
      isDeepStrictEqual(scope.idbRecords, scopeBeforeSetup.idbRecords),
      "no IndexedDB record changes before Start"
    );
    assert(
      isDeepStrictEqual(scope.sessionRecords, scopeBeforeSetup.sessionRecords),
      "no session candidate record changes before Start"
    );
    assert(scope.onboardedLocal === false && scope.onboardedIdb === false, "device remains not onboarded in both replicas");
    assert(scope.programCountLocal === 0 && scope.programCountIdb === 0, "active program remains empty in both replicas");

    // ----------------------------------------------------------------------
    // Requirement 4: After Start but before preview activation
    // ----------------------------------------------------------------------
    phase("Phase 4: Post-Start staging holds candidate while active durable state stays unchanged");
    await page.click("#firstRunSharedStart");
    await page.waitForSelector("#entryActivate", { timeout: 15000 });

    const scopePostStart = await inspectStorageScope(page);
    assert(
      scopePostStart.candidateViolations.length > 0,
      "owned setup draft now holds reviewed shared candidate",
      JSON.stringify(scopePostStart.candidateViolations)
    );
    assert(
      scopePostStart.activeLocalViolations.length === 0,
      "active localStorage repforge_v1 still unmutated before explicit activation",
      JSON.stringify(scopePostStart.activeLocalViolations)
    );
    assert(
      scopePostStart.activeIdbViolations.length === 0,
      "active IndexedDB kv.repforge_v1 still unmutated before explicit activation",
      JSON.stringify(scopePostStart.activeIdbViolations)
    );
    assert(
      scopePostStart.onboardedLocal === false && scopePostStart.onboardedIdb === false,
      "active state still marked un-onboarded in both replicas"
    );
    assertSameDurableSemantics(scopePostStart, scopeBeforeSetup, "after Start and before activation");

    // Now explicitly activate
    await page.click("#entryActivate");
    await page.waitForFunction(
      () =>
        !document.querySelector("#onboarding")?.classList.contains("active") &&
        document.querySelector("#log")?.classList.contains("active"),
      undefined,
      { timeout: 15000 }
    );

    const scopeActivated = await inspectStorageScope(page);
    assert(scopeActivated.onboardedLocal === true && scopeActivated.onboardedIdb === true, "active state now onboarded in both replicas");
    assert(
      scopeActivated.localDurable?.programMeta?.name === SENTINELS.name &&
        scopeActivated.idbDurable?.programMeta?.name === SENTINELS.name,
      "active programMeta.name matches activated shared proposal in both replicas"
    );
    assert(
      scopeActivated.logCountLocal === 0 && scopeActivated.logCountIdb === 0,
      "shared payload logs were NOT imported into durable log"
    );
    assert(
      scopeActivated.historyCountLocal === 0 && scopeActivated.historyCountIdb === 0,
      "shared payload history was NOT imported into durable programHistory"
    );
    assert(
      scopeActivated.allLocalKeys.every((key) => !key.startsWith("repforge_pending_v1:")),
      "activation settles without residual durable WAL entries"
    );

    await context.close();
  }

  // ------------------------------------------------------------------------
  // Requirement 5: Onboarded and history-bearing devices refuse shared setup
  // ------------------------------------------------------------------------
  phase("Phase 5: Onboarded and history-bearing devices refuse shared setup without mutation");
  {
    const sentinelPayload = makeSentinelPayload();

    // 5A: Onboarded device
    {
      const { context, page } = await openAppPage(browser, { locale: "en-US" });
      await clearSite(page);

      const existingState = {
        settings: { ...CURRENT_SETTINGS_DEFAULTS, lang: "en" },
        programMeta: {
          id: "existing-prog-id",
          name: "Established Personal Program",
          started: "2026-01-01",
          onboarded: true,
          created: "2026-01-01T00:00:00.000Z",
          updated: "2026-01-01T00:00:00.000Z",
          mesocycleStatus: "active",
          mesocycleLengthWeeks: 6,
          goal: "hypertrophy",
          experience: "intermediate",
          daysPerWeek: 3,
          splitType: "full_body",
          equipment: ["machines"],
          priorityMuscles: [],
          sessionLength: "normal",
        },
        program: [
          {
            id: "ex-1",
            name: "Bench Press",
            day: "Day 1",
            order: 1,
            sets: 3,
            min: 8,
            max: 12,
            libraryId: "pr_mc",
          },
        ],
        log: [],
        programHistory: [],
        customExercises: [],
        _storageRevision: 4,
      };

      await persistState(page, existingState);
      await page.reload({ waitUntil: "domcontentloaded" });
      await dismissGates(page);

      const encoded = await encodeSharedPayload(page, sentinelPayload);
      assert(encoded.ok, "sentinel payload encoded for onboarded device check");
      const scopeBeforeRefusal = await inspectStorageScope(page);

      await page.goto(`${APP_INDEX}#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        (expected) => {
          const toast = document.querySelector("#toast");
          return !!toast && !toast.classList.contains("hidden") && toast.textContent === expected;
        },
        SHARED_COPY.en.existing
      );

      const gate = await page.evaluate(sharedGateSnapshot);
      assert(!gate.gate, "onboarded device does not open first-run shared gate");

      const toast = await page.evaluate(() => {
        const el = document.querySelector("#toast");
        return el && !el.classList.contains("hidden") ? el.textContent : null;
      });
      assert(toast === SHARED_COPY.en.existing, "refusal notice presented for onboarded device", toast);

      const scope = await inspectStorageScope(page);
      assert(
        scope.localDurable?.programMeta?.name === "Established Personal Program" &&
          scope.idbDurable?.programMeta?.name === "Established Personal Program",
        "existing program name preserved without mutation in both replicas"
      );
      assert(
        scope.activeLocalViolations.length === 0 && scope.activeIdbViolations.length === 0,
        "zero sentinels admitted into durable state on onboarded device"
      );
      assert(scope.setupDraft === null, "onboarded refusal creates no setup candidate");
      assertSameDurableSemantics(scope, scopeBeforeRefusal, "onboarded refusal");

      await context.close();
    }

    // 5B: History-bearing device (archived program history)
    {
      const { context, page } = await openAppPage(browser, { locale: "en-US" });
      await clearSite(page);

      const historyState = {
        settings: { ...CURRENT_SETTINGS_DEFAULTS, lang: "en" },
        programMeta: {
          id: "history-device-id",
          name: "History Device Program",
          onboarded: false,
          created: "2026-01-01T00:00:00.000Z",
          updated: "2026-01-01T00:00:00.000Z",
        },
        program: [],
        log: [],
        programHistory: [
          {
            id: "old-prog-1",
            name: "Archived Past Program",
            program: [],
            completedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        customExercises: [],
        _storageRevision: 4,
      };

      await persistState(page, historyState);
      await page.reload({ waitUntil: "domcontentloaded" });
      await dismissGates(page);

      const encoded = await encodeSharedPayload(page, sentinelPayload);
      assert(encoded.ok, "sentinel payload encoded for history-bearing device check");
      const scopeBeforeRefusal = await inspectStorageScope(page);

      await page.goto(`${APP_INDEX}#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        (expected) => {
          const toast = document.querySelector("#toast");
          return !!toast && !toast.classList.contains("hidden") && toast.textContent === expected;
        },
        SHARED_COPY.en.existing
      );

      const gate = await page.evaluate(sharedGateSnapshot);
      assert(!gate.gate, "history-bearing device does not open first-run shared gate");

      const toast = await page.evaluate(() => {
        const el = document.querySelector("#toast");
        return el && !el.classList.contains("hidden") ? el.textContent : null;
      });
      assert(toast === SHARED_COPY.en.existing, "refusal notice presented for history-bearing device", toast);

      const scope = await inspectStorageScope(page);
      assert(
        scope.historyCountLocal === 1 && scope.historyCountIdb === 1,
        "existing program history preserved without mutation in both replicas"
      );
      assert(
        scope.activeLocalViolations.length === 0 && scope.activeIdbViolations.length === 0,
        "zero sentinels admitted into durable state on history-bearing device"
      );
      assert(scope.setupDraft === null, "history-bearing refusal creates no setup candidate");
      assertSameDurableSemantics(scope, scopeBeforeRefusal, "history-bearing refusal");

      await context.close();
    }
  }

  // ------------------------------------------------------------------------
  // Requirement 6: Abandoning first run returns to ordinary Today/Program no-program states
  // ------------------------------------------------------------------------
  phase("Phase 6: Abandoning first run returns to ordinary Today and Program no-program states");
  {
    const { context, page } = await openAppPage(browser);
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await waitForFirstRun(page);

    await page.click("#firstRunCreate");
    await page.waitForSelector("#onboarding.active", { timeout: 10000 });

    // Back out / cancel
    await page.click("#onbCancel");
    await page.waitForSelector("#entryCancelDiscard", { timeout: 10000 });
    await page.click("#entryCancelDiscard");
    await page.waitForFunction(() => !document.querySelector("#onboarding")?.classList.contains("active"));

    // Verify Today view
    const today = await page.evaluate(() => {
      const shown = (sel) => {
        const el = document.querySelector(sel);
        return !!el && !el.classList.contains("hidden");
      };
      return {
        noProgram: shown("#todayNoProgram"),
        setupBtn: shown("#todaySetupProgram"),
        session: shown("#todaySession"),
        startWorkout: shown("#startWorkout"),
        week: shown("#todayWeek"),
        dayTabs: document.querySelectorAll("#dayTabs button").length,
      };
    });

    assert(today.noProgram, "Today shows #todayNoProgram empty state");
    assert(today.setupBtn, "Today offers #todaySetupProgram CTA");
    assert(!today.session && !today.startWorkout && !today.week, "Today offers no session, start, or week strip");
    assert(today.dayTabs === 0, "Today has 0 training day tabs");

    // Verify Program view
    await page.click('nav [data-view="program"]');
    await page.waitForFunction(() => document.querySelector("#program")?.classList.contains("active"));

    const prog = await page.evaluate(() => {
      const shown = (sel) => {
        const el = document.querySelector(sel);
        return !!el && !el.classList.contains("hidden");
      };
      return {
        noProgram: shown("#programNoProgram"),
        overview: shown("#programOverview"),
        text: (document.querySelector("#program")?.innerText || "").replace(/\s+/g, " ").trim(),
      };
    });

    assert(prog.noProgram, "Program tab shows #programNoProgram empty state");
    assert(!prog.overview, "Program tab has no active overview");
    assert(!/Untitled program/i.test(prog.text), "Program tab never mentions an untitled program");

    const scope = await inspectStorageScope(page);
    assert(scope.programCountLocal === 0 && scope.programCountIdb === 0, "zero durable program rows in both replicas");
    assert(!scope.onboardedLocal && !scope.onboardedIdb, "device remains not onboarded in both replicas");

    await context.close();
  }

  // ------------------------------------------------------------------------
  // Requirement 7: Current install and global-tour behavior recorded as baseline
  // ------------------------------------------------------------------------
  phase("Phase 7: Baseline install and tour behavior recorded");
  {
    // 7A: Install baseline in standard browser with beforeinstallprompt
    {
      const { context, page } = await openAppPage(browser);
      await clearSite(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(page, { base: BASE });
      await waitForFirstRun(page);

      // Fire install prompt event
      await page.evaluate(() => {
        if (typeof window.__fireInstall === "function") {
          window.__fireInstall();
        } else {
          const evt = new Event("beforeinstallprompt");
          evt.prompt = () => {};
          evt.userChoice = Promise.resolve({ outcome: "dismissed" });
          window.dispatchEvent(evt);
        }
      });

      const installState = await page.evaluate(() => {
        const shown = (sel) => {
          const el = document.querySelector(sel);
          return !!el && !el.classList.contains("hidden") && getComputedStyle(el).display !== "none";
        };
        return {
          installShown: shown("#firstRunInstall"),
          actionBtn: !!document.querySelector("#firstRunInstallAction"),
          continuePresent: !!document.querySelector("#firstRunContinue"),
          continueLabel: document.querySelector("#firstRunContinueLabel")?.textContent?.trim() || null,
        };
      });

      assert(installState.actionBtn, "first-run install card action button exists in DOM");
      assert(installState.installShown, "first-run install card is shown after beforeinstallprompt");
      assert(installState.continuePresent, "first-run continue affordance is present in DOM");
      assert(installState.continueLabel != null, "first-run continue label is rendered", installState.continueLabel);
      await context.close();
    }

    // 7B: Standalone mode hides install card
    {
      const { context, page } = await openAppPage(browser, { standalone: true });
      await clearSite(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(page, { base: BASE });
      await waitForFirstRun(page);

      const standaloneState = await page.evaluate(() => {
        const shown = (sel) => {
          const el = document.querySelector(sel);
          return !!el && !el.classList.contains("hidden") && getComputedStyle(el).display !== "none";
        };
        return {
          installShown: shown("#firstRunInstall"),
          heroPresent: !!document.querySelector(".firstrun-hero"),
        };
      });

      assert(!standaloneState.installShown, "standalone mode hides first-run install card");
      assert(standaloneState.heroPresent, "standalone mode presents first-run hero");
      await context.close();
    }

    // 7C: Global tour baseline
    {
      const { context, page } = await openAppPage(browser);
      await clearSite(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(page, { base: BASE });

      const tourHook = await page.evaluate(() => typeof window.startTour === "function");
      assert(tourHook, "window.startTour global tour hook is present");

      await page.evaluate(() => window.startTour("first-run"));
      await page.waitForFunction(
        () => !document.querySelector("#tour")?.classList.contains("hidden")
      );

      const tourState = await page.evaluate(() => {
        const overlay = document.querySelector("#tour");
        const shown = !!overlay && !overlay.classList.contains("hidden");
        const title = document.querySelector("#tourTitle")?.textContent?.trim() || "";
        const dots = document.querySelectorAll("#tourDots .tour__dot").length;
        const next = document.querySelector("#tourNext")?.textContent?.trim() || "";
        return { shown, title, dots, next };
      });

      assert(tourState.shown, "#tour displayed on startTour");
      assert(tourState.title.length > 0, "tour displays title", tourState.title);
      assert(tourState.dots > 0, "tour displays step dots", String(tourState.dots));
      assert(tourState.next.length > 0, "tour displays next control", tourState.next);

      await page.evaluate(() => window.closeTour?.());
      await page.waitForFunction(
        () => document.querySelector("#tour")?.classList.contains("hidden")
      );
      const closed = await page.evaluate(() => document.querySelector("#tour")?.classList.contains("hidden"));
      assert(closed, "window.closeTour closes tour overlay");

      const uiPrefs = await page.evaluate(() => window.__repforgeUi?.loadUiPrefs?.());
      assert(typeof uiPrefs === "object" && uiPrefs != null, "window.__repforgeUi.loadUiPrefs returns prefs object");

      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log(`\nEntry landing characterization: ${results.passed} passed, ${results.failed} failed`);
const isMain = !process.argv[1] || pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  process.exit(results.failed > 0 ? 1 : 0);
}
