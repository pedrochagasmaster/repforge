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
import { readFileSync } from "node:fs";
import { pathToFileURL } from "url";
import { isDeepStrictEqual } from "node:util";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import {
  BUILT_IN_IDS,
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
const UIKEY = "repforge_ui_v1";

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

async function readUiPrefsRaw(page) {
  return page.evaluate((k) => localStorage.getItem(k), UIKEY);
}

async function observeEntryLandingWrites(page) {
  await page.addInitScript(({ uiKey }) => {
    const original = Storage.prototype.setItem;
    window.__entryLandingWrites = [];
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && key === uiKey) {
        let parsed = null;
        try { parsed = JSON.parse(value); } catch {}
        if (parsed?.entryLandingSeen === true) {
          const landing = document.querySelector("#firstRun");
          window.__entryLandingWrites.push({
            visible: !!landing && !landing.classList.contains("hidden"),
            route: landing?.dataset.entryLanding || null,
          });
        }
      }
      return original.call(this, key, value);
    };
  }, { uiKey: UIKEY });
}

async function decodeSharedPayload(page, encodedValue) {
  return page.evaluate(
    async ({ value, ids }) => {
      const api = window.RepForgeSharedSetup;
      if (!api || typeof api.decode !== "function") return { ok: false, code: "missing-module", missing: true };
      const result = await api.decode(value, { builtInIds: new Set(ids) });
      return result && typeof result === "object" ? result : { ok: false, code: "invalid-result" };
    },
    { value: encodedValue, ids: [...BUILT_IN_IDS] }
  );
}

/**
 * Recursively walks a plain JSON value and returns every path where a key
 * literally named `keyName` occurs, at any depth — proving semantic scope
 * (a nested leak) rather than only checking the top-level shape.
 */
function findKeyPaths(value, keyName, path = "$") {
  const hits = [];
  if (value === null || typeof value !== "object") return hits;
  if (Array.isArray(value)) {
    value.forEach((item, i) => hits.push(...findKeyPaths(item, keyName, `${path}[${i}]`)));
    return hits;
  }
  for (const [k, v] of Object.entries(value)) {
    const nextPath = `${path}.${k}`;
    if (k === keyName) hits.push(nextPath);
    hits.push(...findKeyPaths(v, keyName, nextPath));
  }
  return hits;
}

/**
 * Proof-first fault injection for requirement 5 (054-P3): simulates, purely
 * test-side on an already-captured export/decoded-proposal object, the kind
 * of regression a future change could introduce (the device-local landing
 * preference leaking into a durable/shared payload). This never touches
 * production code or adds a production fault hook — it mutates the object
 * the real export/decode routes already produced, immediately before the
 * isolation oracle inspects it, so the same oracle either catches it or not.
 */
function injectEntryLandingPref(obj) {
  const clone = JSON.parse(JSON.stringify(obj ?? {}));
  if (clone && typeof clone === "object") {
    if (clone.settings && typeof clone.settings === "object") clone.settings.entryLandingSeen = true;
    else clone.entryLandingSeen = true;
  }
  return clone;
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
    await page.evaluate(() => window.openFirstRun?.());
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

  phase("Phase 4b: Invalid shared proposal gets a complete fail-closed landing (054-P3)");
  {
    const { context, page } = await openAppPage(browser);
    await clearSite(page);
    await page.goto(`${APP_INDEX}#setup=v1.not+base64`, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await waitForFirstRun(page);

    const invalid = await page.evaluate((uiKey) => {
      let prefs = {};
      try { prefs = JSON.parse(localStorage.getItem(uiKey) || "{}"); } catch {}
      const shown = (selector) => {
        const element = document.querySelector(selector);
        return !!element && !element.classList.contains("hidden");
      };
      return {
        route: document.querySelector("#firstRun")?.dataset.entryLanding || null,
        headline: document.querySelector("#firstRunHeadline")?.textContent.trim() || "",
        body: document.querySelector("#firstRunLede")?.textContent.trim() || "",
        error: document.querySelector("#firstRunSharedError")?.textContent.trim() || "",
        create: shown("#firstRunCreate"),
        import: shown("#firstRunImport"),
        entryLandingSeen: prefs.entryLandingSeen,
      };
    }, UIKEY);

    assert(invalid.route === "shared-invalid", "invalid setup uses the explicit shared-invalid landing route", JSON.stringify(invalid));
    assert(invalid.headline === "This program link cannot be used.", "invalid setup gives a complete fail-closed heading", invalid.headline);
    assert(invalid.body === "Nothing from the link was saved. You can still build or import a program.", "invalid setup states that nothing was saved and offers a safe next step", invalid.body);
    assert(invalid.error.length > 0, "invalid setup retains the specific live-region reason", invalid.error);
    assert(invalid.create && invalid.import, "invalid setup keeps safe Build and Track actions available", JSON.stringify(invalid));
    assert(invalid.entryLandingSeen !== true, "invalid shared setup does not consume the generic one-time landing preference", JSON.stringify(invalid));

    const scope = await inspectStorageScope(page);
    assert(scope.programCountLocal === 0 && scope.programCountIdb === 0, "invalid shared setup writes no durable program rows");
    assert(scope.setupDraft === null, "invalid shared setup creates no candidate draft");

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
  // Requirement 7: P7 install timing and the still-current tour baseline
  // ------------------------------------------------------------------------
  phase("Phase 7: Install value gate and global-tour baseline recorded");
  {
    // 7A: Chromium captures capability but withholds promotion before value
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
          continueShown: shown("#firstRunContinue"),
          continueLabel: document.querySelector("#firstRunContinueLabel")?.textContent?.trim() || null,
        };
      });

      assert(!installState.actionBtn, "pre-value Chromium exposes no install card action");
      assert(!installState.installShown, "pre-value Chromium withholds the automatic install card");
      assert(installState.continuePresent, "first-run continue affordance is present in DOM");
      assert(!installState.continueShown, "pre-value Chromium shows no install-specific escape hatch");
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

    // 7C: Contextual-guide replacement baseline (054-P8)
    {
      const { context, page } = await openAppPage(browser);
      await clearSite(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(page, { base: BASE });

      const guideState = await page.evaluate(() => ({
        modalAbsent: !document.querySelector("#tour"),
        globalsAbsent: typeof window.startTour !== "function" && typeof window.closeTour !== "function",
        guideHook: typeof window.__repforgeUi?.guideState === "function",
        cueAnchored: !!document.querySelector("[data-guide-cue='entry'][data-anchor-target]"),
      }));
      assert(guideState.modalAbsent, "obsolete global tour markup is absent");
      assert(guideState.globalsAbsent, "obsolete global tour hooks are absent");
      assert(guideState.guideHook, "contextual guide state hook is present");
      assert(guideState.cueAnchored, "entry guidance is attached to its action");

      const uiPrefs = await page.evaluate(() => window.__repforgeUi?.loadUiPrefs?.());
      assert(typeof uiPrefs === "object" && uiPrefs != null, "window.__repforgeUi.loadUiPrefs returns prefs object");

      await context.close();
    }
  }

  // ------------------------------------------------------------------------
  // Packet 054-P3, requirement 1: the one-time generic landing writes
  // entryLandingSeen only after it has rendered successfully.
  // ------------------------------------------------------------------------
  phase("Phase 8: Generic landing renders, then and only then records entryLandingSeen (054-P3)");
  {
    const { context, page } = await openAppPage(browser);
    await clearSite(page);
    const prefsBeforeLanding = await readUiPrefsRaw(page);
    assert(prefsBeforeLanding === null, "entryLandingSeen is absent before the empty first visit begins");
    await observeEntryLandingWrites(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });

    // On an empty, no-program, no-shared-proposal first visit, #firstRun is the
    // generic landing and its successful render triggers the one-time pref.
    await waitForFirstRun(page);
    const landingVisible = await page.evaluate(() => {
      const el = document.querySelector("#firstRun");
      return !!el && !el.classList.contains("hidden");
    });
    assert(landingVisible, "the generic landing (#firstRun, no shared proposal) renders on an empty first visit");

    const prefsAfterRaw = await readUiPrefsRaw(page);
    const parsedAfter = prefsAfterRaw ? JSON.parse(prefsAfterRaw) : {};
    assert(
      parsedAfter.entryLandingSeen === true,
      "repforge_ui_v1 records entryLandingSeen === true only after the generic landing has rendered successfully",
      JSON.stringify(parsedAfter)
    );
    const writes = await page.evaluate(() => window.__entryLandingWrites || []);
    assert(
      writes.length >= 1 && writes.every((write) => write.visible && write.route === "generic"),
      "every entryLandingSeen-bearing write occurs after the generic landing is visible",
      JSON.stringify(writes)
    );

    await context.close();
  }

  // ------------------------------------------------------------------------
  // Packet 054-P3, requirement 2: a second empty/no-program visit does not
  // show the landing again; it boots ordinary Today/Program no-program states.
  // ------------------------------------------------------------------------
  phase("Phase 9: A second empty/no-program visit boots ordinary Today/Program, not the landing (054-P3)");
  {
    const { context, page } = await openAppPage(browser);
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await waitForFirstRun(page);

    // Mark the landing as already seen directly, independent of whether
    // Phase 8's write behavior is implemented yet, so this phase isolates
    // requirement 2 on its own.
    await page.evaluate((k) => {
      localStorage.setItem(k, JSON.stringify({ entryLandingSeen: true }));
    }, UIKEY);
    await dismissGates(page);

    // Second visit: reload with entryLandingSeen already true and still zero
    // program/log/history.
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });

    const secondVisit = await page.evaluate(() => {
      const shown = (sel) => {
        const el = document.querySelector(sel);
        return !!el && !el.classList.contains("hidden");
      };
      return {
        firstRunShown: shown("#firstRun"),
        todayNoProgram: shown("#todayNoProgram"),
        todaySetupBtn: shown("#todaySetupProgram"),
      };
    });

    assert(
      !secondVisit.firstRunShown,
      "a second no-program visit with entryLandingSeen already true does not reopen the generic landing",
      JSON.stringify(secondVisit)
    );
    assert(secondVisit.todayNoProgram, "second visit boots directly into Today's no-program state");
    assert(secondVisit.todaySetupBtn, "second visit's Today no-program state still offers its setup action");

    // The already-recorded assertion above is the proof; dismiss the
    // (incorrectly reopened) landing so the nav bar is reachable to check
    // Program's no-program state too, rather than hanging on production's
    // current defect.
    await dismissGates(page);
    await page.click('nav [data-view="program"]');
    await page.waitForFunction(() => document.querySelector("#program")?.classList.contains("active"));
    const progNoProgram = await page.evaluate(() => {
      const el = document.querySelector("#programNoProgram");
      return !!el && !el.classList.contains("hidden");
    });
    assert(progNoProgram, "second visit's Program tab shows its own no-program setup state");

    await context.close();
  }

  {
    const sentinelPayload = makeSentinelPayload();
    const { context, page } = await openAppPage(browser);
    await clearSite(page);
    const encoded = await encodeSharedPayload(page, sentinelPayload);
    assert(encoded?.ok, "sentinel payload encoded for the fresh shared-route preference check", JSON.stringify(encoded));

    await page.goto(`${APP_INDEX}#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    const prefsAtFreshSharedGate = await page.evaluate((k) => {
      try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch { return {}; }
    }, UIKEY);
    assert(
      !Object.prototype.hasOwnProperty.call(prefsAtFreshSharedGate, "entryLandingSeen"),
      "a fresh shared landing does not create entryLandingSeen",
      JSON.stringify(prefsAtFreshSharedGate)
    );

    await context.close();
  }

  // ------------------------------------------------------------------------
  // Packet 054-P3, requirement 3: a valid shared proposal reaches the
  // adaptive shared landing even when entryLandingSeen is already true, and
  // the shared route writes neither entryLandingSeen nor a proposal field
  // into repforge_ui_v1 before explicit Start.
  // ------------------------------------------------------------------------
  phase("Phase 10: Valid shared proposal bypasses entryLandingSeen and stays storage-silent before Start (054-P3)");
  {
    const sentinelPayload = makeSentinelPayload();
    const { context, page } = await openAppPage(browser);
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });

    // Seed entryLandingSeen === true, simulating a device that already
    // abandoned an earlier empty visit past the generic landing.
    await page.evaluate((k) => {
      localStorage.setItem(k, JSON.stringify({ entryLandingSeen: true }));
    }, UIKEY);
    const prefsBeforeShared = await readUiPrefsRaw(page);

    const encoded = await encodeSharedPayload(page, sentinelPayload);
    assert(encoded?.ok, "sentinel payload encoded for the already-seen-landing check", JSON.stringify(encoded));

    await page.goto(`${APP_INDEX}#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);

    const gate = await page.evaluate(sharedGateSnapshot);
    assert(
      gate.gate && gate.sharedPresent && !gate.sharedHidden,
      "the adaptive shared landing still opens even though entryLandingSeen is already true",
      JSON.stringify(gate)
    );
    assert(
      gate.startVisible && gate.startName.includes(SENTINELS.name),
      "Start this program is the primary action, naming the shared program",
      gate.startName
    );

    const prefsAtGate = await readUiPrefsRaw(page);
    assert(
      prefsAtGate === prefsBeforeShared,
      "reaching the shared gate leaves repforge_ui_v1 byte-identical (no write)",
      `${prefsBeforeShared} -> ${prefsAtGate}`
    );

    // Now explicitly Start, but stop short of activation.
    await page.click("#firstRunSharedStart");
    await page.waitForSelector("#entryActivate", { timeout: 15000 });

    const prefsAfterStart = await readUiPrefsRaw(page);
    assert(
      prefsAfterStart === prefsBeforeShared,
      "Start still leaves repforge_ui_v1 byte-identical before explicit activation",
      `${prefsBeforeShared} -> ${prefsAfterStart}`
    );

    await context.close();
  }

  // ------------------------------------------------------------------------
  // Packet 054-P3, requirements 4 & 5: entryLandingSeen is absent from an
  // ordinary backup/export and from every decoded shared setup-link
  // proposal, recursively at any depth; a narrow test-side fault proves the
  // oracle actually catches a leak.
  // ------------------------------------------------------------------------
  phase("Phase 11: entryLandingSeen absent from export and setup-link proposal, with proof-first fault switch (054-P3)");
  {
    const { context, page } = await openAppPage(browser);
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await waitForFirstRun(page);

    // Seed entryLandingSeen in device-local prefs so a real leak would have
    // something concrete to carry across, then dismiss into the ordinary app.
    await page.evaluate((k) => {
      localStorage.setItem(k, JSON.stringify({ entryLandingSeen: true }));
    }, UIKEY);
    await dismissGates(page);

    // 11a. Ordinary backup/export (current production hook: Settings ->
    // Backup & export -> Export backup JSON).
    await page.evaluate(() => document.querySelector("#openSettings")?.click());
    await page.waitForSelector("#settings.active", { timeout: 5000 });
    await page.locator("#dataBackupRow").click();
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 10000 }),
      page.locator("#exportJson").click(),
    ]);
    let exported = JSON.parse(readFileSync(await download.path(), "utf8"));
    if (FAULT === "export-entry-pref") {
      console.log("  [FAULT INJECTION] simulating an entryLandingSeen leak into the exported backup");
      exported = injectEntryLandingPref(exported);
    }
    const exportHits = findKeyPaths(exported, "entryLandingSeen");
    assert(
      exportHits.length === 0,
      "ordinary backup/export never contains entryLandingSeen at any depth",
      JSON.stringify(exportHits)
    );

    // 11b. Build through the production allowlist, then encode and decode the
    // exact payload that the share route would send.
    const activeState = await page.evaluate((payload) =>
      window.__repforgeSharedSetup.buildProposal(payload), cloneFixture(REPRESENTATIVE_PAYLOAD));
    await persistState(page, activeState);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const builtPayload = await page.evaluate(() => window.__repforgeSharedSetup.build());
    const encoded = await encodeSharedPayload(page, builtPayload);
    assert(encoded?.ok, "representative payload encoded for the proposal isolation check", JSON.stringify(encoded));
    const decoded = await decodeSharedPayload(page, encoded.value);
    assert(decoded?.ok, "encoded proposal decodes cleanly for inspection", JSON.stringify(decoded));
    let proposal = decoded.value;
    if (FAULT === "export-entry-pref") {
      console.log("  [FAULT INJECTION] simulating an entryLandingSeen leak into the decoded shared proposal");
      proposal = injectEntryLandingPref(proposal);
    }
    const proposalHits = findKeyPaths(proposal, "entryLandingSeen");
    assert(
      proposalHits.length === 0,
      "decoded shared setup-link proposal never contains entryLandingSeen at any depth",
      JSON.stringify(proposalHits)
    );

    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\nEntry landing characterization: ${results.passed} passed, ${results.failed} failed`);
const isMain = !process.argv[1] || pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  process.exit(results.failed > 0 ? 1 : 0);
}
