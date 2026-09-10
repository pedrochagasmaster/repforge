#!/usr/bin/env node
/**
 * Plan 053-P4a: production-backed install-transfer import oracle.
 *
 * The source document is produced by the real app: compiler-backed activation,
 * a saved workout, a committed Plan 052 successor, a committed recovery
 * carrier, a custom exercise, an acknowledged DraftV2, a persisted entry
 * candidate, UI preferences, consent, and telemetry identity. The P3
 * RepForgeInstallTransfer/Contract modules build and validate the envelope;
 * this test does not copy their normalizers.
 *
 * The local production slice also has a deliberate P4c red packet below:
 * standalone P3 claim/commit wiring, whole-import cross-tab arbitration,
 * mirrored marker validation, settings-only destination refusal, and
 * post-commit divergence recovery remain independently observable gaps.
 */
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { launchChromium, assertServingApp, waitForAppBoot } from "./browser.mjs";
import { parseExecutablePolicy } from "../tools/recovery-policy-contract.mjs";

const require = createRequire(import.meta.url);
const Transfer = require("../install-transfer.js");
const Contract = require("../install-transfer-contract.js");

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:8056/";
const STATE_KEY = "repforge_v1";
const UI_KEY = "repforge_ui_v1";
const CONSENT_KEY = "repforge_telemetry_enabled_v1";
const IDENTITY_KEY = "repforge_telemetry_identity_v1";
const ENTRY_KEY = "repforge_program_setup_draft_v1";
const DRAFT_KEY = "repforge_draft_v1";
const CHECKPOINT_KEY = `${DRAFT_KEY}:v2-checkpoint`;
const INSTALL_MARKER_KEY = "repforge_install_import_v1";
const INBOUND_MARKER_KEY = "repforge_transfer_inbound_v1";
const FREEZE_KEY = "repforge_install_transfer_freeze_v1";
const POSTHOG_SDK_PATH = "/static/1.400.0/array.js";
const DB_NAME = "repforge";
const STORE_NAME = "kv";
const CREATED_AT = "2026-10-10T09:00:00.000Z";
const TRANSITION_CONFIRMED_AT = "2026-10-10T09:12:00.000Z";
const RECOVERY_DUE_AT = "2026-10-17T09:12:00.000Z";
const POLICY = parseExecutablePolicy(readFileSync(new URL("../docs/recovery-week-policy.md", import.meta.url), "utf8"));
const EVIDENCE = {
  outcomesByPattern: {
    "knee-dominant": "maintained",
    "horizontal press": "declined",
  },
  checkpointAnswer: "Yes",
};

const POSTHOG_SDK_FIXTURE = `(() => {
  window.__p4cPosthogInitCalls = 0;
  window.posthog = {
    init(_token, config) {
      window.__p4cPosthogInitCalls += 1;
      window.__p4cPosthogConfig = {
        hasBeforeSend: typeof config?.before_send === "function",
        hasBootstrapIdentity: !!config?.bootstrap?.distinctID,
      };
    },
    capture() {},
    has_opted_out_capturing() { return false; },
    opt_in_capturing() {},
    opt_out_capturing() {},
    startSessionRecording() {},
    stopSessionRecording() {},
    _requestQueue: { clear() {} },
  };
})();`;

let passed = 0;
const failures = [];

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function sameValue(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function logicalDurableState(value) {
  const copy = clone(value);
  for (const key of ["_storageRevision", "_storageFollowUp", "_storageDraftTransaction", "_storageSetupActivation"]) {
    delete copy?.[key];
  }
  return copy;
}

function check(condition, message, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
    return true;
  }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    Detail: ${typeof detail === "string" ? detail : JSON.stringify(detail, null, 2)}`);
  return false;
}

async function readIdb(page) {
  return page.evaluate(async ({ dbName, storeName, key }) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.close();
        resolve(null);
        return;
      }
      const get = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
      get.onsuccess = () => { db.close(); resolve(get.result ?? null); };
      get.onerror = () => { db.close(); reject(get.error); };
    };
  }), { dbName: DB_NAME, storeName: STORE_NAME, key: STATE_KEY });
}

async function readIdbValue(page, key) {
  return page.evaluate(async ({ dbName, storeName, key: requestedKey }) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.close();
        resolve(null);
        return;
      }
      const get = db.transaction(storeName, "readonly").objectStore(storeName).get(requestedKey);
      get.onsuccess = () => { db.close(); resolve(get.result ?? null); };
      get.onerror = () => { db.close(); reject(get.error); };
    };
  }), { dbName: DB_NAME, storeName: STORE_NAME, key });
}

async function deleteIdbValue(page, key) {
  return page.evaluate(async ({ dbName, storeName, requestedKey }) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.close();
        resolve(false);
        return;
      }
      const remove = db.transaction(storeName, "readwrite").objectStore(storeName).delete(requestedKey);
      remove.onsuccess = () => { db.close(); resolve(true); };
      remove.onerror = () => { db.close(); reject(remove.error); };
    };
  }), { dbName: DB_NAME, storeName: STORE_NAME, requestedKey: key });
}

function transferCookieFixture() {
  const segment = Buffer.alloc(32, 7).toString("base64url");
  const token = `v1.k1.${segment}.${segment}.${segment}`;
  const expiresAt = "2099-01-01T00:00:00.000Z";
  const payload = Buffer.from(JSON.stringify({ token, expiresAt }), "utf8").toString("base64url");
  return { token, expiresAt, value: `v1.${payload}` };
}

function parseMarker(raw) {
  if (raw === null) return null;
  try { return JSON.parse(raw); } catch { return { invalidRaw: raw }; }
}

async function readLogical(page, { flushDraft = true } = {}) {
  return page.evaluate(async ({ stateKey, uiKey, consentKey, identityKey, entryKey, draftKey, flushDraft: shouldFlush }) => {
    const parse = (key) => {
      const raw = localStorage.getItem(key);
      try { return raw == null ? null : JSON.parse(raw); } catch { return { invalidRaw: raw }; }
    };
    const draftHook = window.__repforgeWorkoutDraft;
    if (shouldFlush) await draftHook?.flush?.();
    const current = draftHook?.current?.() || null;
    const canonicalRaw = localStorage.getItem(draftKey);
    let persistedDraft = null;
    try {
      const parsed = window.RepForgeWorkoutDraft?.parse?.(canonicalRaw);
      if (parsed?.kind === "valid") persistedDraft = window.RepForgeWorkoutDraft.logicalCloneSection(parsed.draft);
    } catch {}
    const logicalDraft = persistedDraft || (current && window.RepForgeWorkoutDraft?.logicalCloneSection
      ? window.RepForgeWorkoutDraft.logicalCloneSection(current)
      : null);
    const candidateRaw = localStorage.getItem(entryKey);
    let candidate = null;
    try {
      const normalized = window.RepForgeProgramEntry?.normalizeSetupDraftEnvelope?.(candidateRaw);
      candidate = normalized?.ok ? normalized.value.envelope.state : null;
    } catch {}
    return {
      durableState: parse(stateKey),
      uiPreferences: window.__repforgeUi?.loadUiPrefs?.() || parse(uiKey),
      analytics: { enabled: localStorage.getItem(consentKey) !== "false" },
      telemetryIdentity: parse(identityKey),
      candidate,
      candidateRaw,
      draft: {
        current,
        logical: logicalDraft,
        raw: canonicalRaw,
        checkpoint: draftHook?.checkpoint?.() || null,
        read: draftHook?.read?.() || null,
      },
    };
  }, { stateKey: STATE_KEY, uiKey: UI_KEY, consentKey: CONSENT_KEY, identityKey: IDENTITY_KEY, entryKey: ENTRY_KEY, draftKey: DRAFT_KEY, flushDraft });
}

async function readStorageBytes(page) {
  return {
    local: await page.evaluate(() => Object.fromEntries(
      Array.from({ length: localStorage.length }, (_, index) => {
        const key = localStorage.key(index);
        return [key, localStorage.getItem(key)];
      }),
    )),
    idb: await readIdb(page),
  };
}

async function clearProfile(page) {
  await page.evaluate(async (dbName) => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
    for (const registration of await navigator.serviceWorker?.getRegistrations?.() || []) {
      await registration.unregister();
    }
  }, DB_NAME);
}

async function flush(page) {
  await page.evaluate(async () => {
    await window.__repforgeStorage?.flush?.();
    await window.__repforgeWorkoutDraft?.flush?.();
    await window.__repforgeOnboarding?.flushDraft?.();
  });
}

async function activateProgram(page) {
  return page.evaluate(async () => {
    const adapter = window.RepForgeProgramEntryAdapter;
    const compiler = window.RepForgeProgramCompiler;
    if (!adapter || !compiler || typeof window.__repforgeFinalizeProgramSetup !== "function") {
      return { ok: false, code: "production-entry-finalization-unavailable" };
    }
    const services = adapter.createProductionServices({
      Compiler: compiler,
      catalogue: window.__repforgeExerciseLibrary || window.EXERCISE_LIBRARY,
    });
    const answers = {
      desiredResult: "balanced",
      structuredExperience: "6_to_24m",
      recentConsistency: "most",
      daysPerWeek: 4,
      sessionMinutes: 90,
      preferredRestSeconds: 90,
      environment: { kind: "commercial_gym" },
      primaryMuscles: [],
      deEmphasizedMuscles: [],
      ignoredMuscles: [],
      priorityMovements: [],
      mustHaveExercises: [],
      exerciseConstraints: [],
    };
    const compiled = services.compile({ mode: "recommend", answers, versions: services.currentVersions() });
    if (!compiled.ok) return { ok: false, code: "production-compilation-failed", issues: compiled.issues };
    const baseProposal = window.__repforgeWorkoutDraft.state();
    baseProposal.programMeta = baseProposal.programMeta || {};
    baseProposal.programMeta.progressionRelations = JSON.parse(JSON.stringify(compiled.preview.progressionRelations || []));
    baseProposal.programMeta.progressionModifiers = [];
    baseProposal.programMeta.progressionIncompatibilities = [];
    baseProposal.programMeta.programStructure = JSON.parse(JSON.stringify(compiled.preview.programStructure));
    baseProposal.programMeta.compilerContext = JSON.parse(JSON.stringify(compiled.compilerContext));
    const finalized = await window.__repforgeFinalizeProgramSetup({
      exercises: compiled.preview.program,
      name: compiled.name || "Install transfer oracle predecessor",
      answers: { goal: "strength_hypertrophy", daysPerWeek: 4 },
      destination: "log",
      origin: "first-run",
      draftConfirmed: true,
      telemetryRoute: "recommend",
      entryTelemetry: compiled.telemetry,
      entrySource: { route: "recommend", fingerprint: compiled.fingerprint },
      programStructure: compiled.preview.programStructure,
      compilerContext: compiled.compilerContext,
      baseProposal,
    });
    await window.__repforgeStorage.flush();
    return { ok: !!(finalized?.localOk || finalized?.idbOk), finalized };
  });
}

async function saveWorkout(page) {
  const day = await page.evaluate(() => window.__repforgeWorkoutDraft.state()?.program?.[0]?.day || "Day 1");
  const entered = await page.evaluate((dayLabel) => window.__repforgeEnterWorkout({ day: dayLabel, focus: false }), day);
  if (!entered) throw new Error(`production workout entry failed: ${JSON.stringify(entered)}`);
  await page.locator("#workout input[data-k$='_load']").first().waitFor({ state: "visible" });
  await page.locator("#workout input[data-k$='_load']").first().fill("60");
  await page.locator("#workout input[data-k$='_reps']").first().fill("8");
  await page.locator("#workout input[data-k$='_rir']").first().fill("2");
  await page.locator("#workout button[data-save]").first().click();
  await page.waitForFunction(() => document.querySelector("#workout button[data-save]")?.getAttribute("aria-pressed") === "true");
  await page.locator("#logForm .btn--save").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === false, undefined, { timeout: 10000 });
  await page.locator("#sumDone").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === true, undefined, { timeout: 10000 });
  await flush(page);
}

async function addCustomExercise(page) {
  return page.evaluate(async () => window.__repforgeSaveCustomExercise({
    id: "custom:install-transfer-oracle",
    name: "Install transfer custom movement",
    equipment: ["cable"],
    primary: "Chest",
    secondary: "Triceps",
    notes: "producer journey sentinel",
  }));
}

async function commitSibling(page) {
  const proposed = await page.evaluate(async ({ createdAt }) => window.__repforgeProgramTransition?.proposeSibling?.({
    targetConstraint: { frequency: 3 },
    diagnosis: {
      kind: "fewer_days",
      answers: { availableDays: 3 },
      eligibleEvidenceIds: ["install-transfer-oracle-evidence"],
      insufficientEvidenceReasons: [],
    },
    transitionId: "transition-install-transfer-oracle",
    successorProgramId: "program-install-transfer-oracle-successor",
    createdAt,
  }), { createdAt: CREATED_AT });
  if (!proposed?.ok) return proposed || { ok: false, code: "successor-proposal-seam-unavailable" };
  const confirmed = await page.evaluate(async ({ proposal, confirmedAt }) => window.__repforgeProgramTransition.confirmTransition({
    proposal,
    transitionId: proposal.transitionId,
    successorProgramId: proposal.successor.programId,
    confirmedAt,
    proposalHash: proposal.proposalHash,
    acknowledgedDraftRaw: null,
  }), { proposal: proposed.proposal, confirmedAt: TRANSITION_CONFIRMED_AT });
  await flush(page);
  return { ok: !!(confirmed?.ok && confirmed?.localOk && confirmed?.idbOk), proposed, confirmed };
}

async function commitRecovery(page) {
  const proposed = await page.evaluate(async ({ policy, evidence, createdAt }) => {
    const adapter = window.__repforgeProgramTransition;
    if (typeof adapter?.proposeRecoveryWeek !== "function") return { ok: false, code: "recovery-proposal-seam-unavailable" };
    return adapter.proposeRecoveryWeek({
      evidence,
      approvedPolicy: policy,
      transitionId: "recovery-install-transfer-oracle",
      createdAt,
    });
  }, { policy: POLICY, evidence: EVIDENCE, createdAt: CREATED_AT });
  if (!proposed?.ok) return proposed;
  const confirmed = await page.evaluate(async ({ proposal, dueAt, confirmedAt }) => {
    const adapter = window.__repforgeProgramTransition;
    if (typeof adapter?.confirmTransition !== "function") return { ok: false, code: "recovery-confirmation-seam-unavailable" };
    return adapter.confirmTransition({
      proposal,
      transitionId: proposal.transitionId,
      proposalHash: proposal.proposalHash,
      confirmedAt,
      reassessmentDueAt: dueAt,
      acknowledgedDraftRaw: null,
    });
  }, { proposal: proposed.proposal, dueAt: RECOVERY_DUE_AT, confirmedAt: TRANSITION_CONFIRMED_AT });
  await flush(page);
  return { ok: !!(confirmed?.ok && confirmed?.localOk && confirmed?.idbOk), proposed, confirmed };
}

async function createAcknowledgedDraft(page) {
  return page.evaluate(async () => {
    const hook = window.__repforgeWorkoutDraft;
    const day = hook?.state?.()?.program?.[0]?.day;
    if (!hook || typeof window.__repforgeEnterWorkout !== "function" || !day) return { ok: false, code: "draft-producer-seam-unavailable" };
    const entered = await window.__repforgeEnterWorkout({ day, focus: false });
    const current = hook.current?.();
    const exerciseId = current?.exerciseOrder?.[0];
    const setId = exerciseId && current.exercises?.[exerciseId]?.setOrder?.[0];
    if (!entered || !current || !exerciseId || !setId) return { ok: false, code: "draft-initialization-failed" };
    await hook.dispatch("editSetField", { exerciseInstanceId: exerciseId, setId, field: "reps", value: "11" });
    await hook.dispatch("setSessionNotes", { value: "install transfer acknowledged draft" });
    await hook.flush();
    const live = hook.current();
    return {
      ok: live?.schemaVersion === 2,
      logical: live && window.RepForgeWorkoutDraft.logicalCloneSection(live),
      raw: hook.raw(),
      checkpoint: hook.checkpoint(),
      read: hook.read(),
    };
  });
}

async function createCandidate(page) {
  return page.evaluate(async () => {
    const Entry = window.RepForgeProgramEntry;
    const services = window.__repforgeOnboarding?.services?.();
    if (!Entry || !services || typeof window.__repforgePersistSetupDraft !== "function") {
      return { ok: false, code: "entry-candidate-producer-seam-unavailable" };
    }
    const answers = {
      desiredResult: "balanced",
      structuredExperience: "6_to_24m",
      recentConsistency: "most",
      daysPerWeek: 3,
      sessionMinutes: 60,
      preferredRestSeconds: 90,
      environment: { kind: "commercial_gym" },
      primaryMuscles: [],
      deEmphasizedMuscles: [],
      ignoredMuscles: [],
      priorityMovements: [],
      mustHaveExercises: [],
      exerciseConstraints: [],
    };
    const versions = services.currentVersions();
    const snapshot = window.__repforgeWorkoutDraft.state();
    let state = Entry.createState({
      draftId: "candidate-install-transfer-oracle",
      activeProgramRevisionAtStart: Number.isSafeInteger(snapshot?._storageRevision) ? snapshot._storageRevision : 0,
      now: new Date(Date.now() - 1000).toISOString(),
      versions,
    });
    state = Entry.selectRoute(state, "recommend");
    state = Entry.setAnswers(state, answers);
    const compiled = services.compile({ mode: "recommend", answers, versions });
    if (!compiled.ok) return { ok: false, code: "entry-candidate-compilation-failed", issues: compiled.issues };
    state = Entry.setResult(state, {
      fingerprint: compiled.fingerprint,
      name: compiled.name,
      namePt: compiled.namePt,
      selected: compiled.selected,
      candidates: compiled.candidates,
      alternative: null,
      preview: compiled.preview,
      telemetry: compiled.telemetry,
      explanation: compiled.explanation,
    });
    const persisted = await window.__repforgePersistSetupDraft(state);
    await window.__repforgeOnboarding.flushDraft();
    return {
      ok: persisted?.ok === true,
      persisted,
      candidate: window.__repforgeEntryState?.(),
      raw: localStorage.getItem("repforge_program_setup_draft_v1"),
    };
  });
}

async function setDeviceSections(page) {
  return page.evaluate(() => {
    const before = localStorage.getItem("repforge_telemetry_identity_v1");
    window.__repforgeUi?.setTheme?.("dark");
    const consent = window.RepForgeTelemetry?.setEnabled?.(false);
    return {
      consent,
      identityBefore: before,
      identityAfter: localStorage.getItem("repforge_telemetry_identity_v1"),
      prefs: window.__repforgeUi?.loadUiPrefs?.(),
    };
  });
}

function sourceSections(observation) {
  const draft = observation.draft;
  return {
    durableState: { logicalCloneSection: () => clone(observation.durableState) },
    workoutDraft: {
      flush: async () => {},
      current: () => clone(draft.current),
      checkpoint: () => clone(draft.checkpoint),
      read: () => clone(draft.read),
      logicalCloneSection: () => clone(draft.logical),
    },
    programEntryDraft: { logicalCloneSection: () => clone(observation.candidate) },
    uiPreferences: { logicalCloneSection: () => clone(observation.uiPreferences) },
    analytics: { logicalCloneSection: () => clone(observation.analytics) },
    telemetryIdentity: { logicalCloneSection: () => clone(observation.telemetryIdentity) },
  };
}

async function buildEnvelope(observation) {
  const sections = sourceSections(observation);
  const captured = await Transfer.captureLogicalSnapshot(sections);
  check(captured.ok === true, "P3 RepForgeInstallTransfer captures all real producer sections", captured);
  if (!captured.ok) return null;
  const built = await Transfer.buildEnvelope({
    sections,
    source: {
      context: "browser",
      logicalInstallationId: observation.telemetryIdentity.installationId,
      sourceRevision: Number.isSafeInteger(observation.durableState?._storageRevision)
        ? observation.durableState._storageRevision
        : 0,
    },
    contract: Contract,
    crypto: webcrypto,
    createdAt: CREATED_AT,
    logicalSnapshot: captured.value,
  });
  check(built.ok === true, "P3 RepForgeInstallTransfer builds an envelope from the real source journey", built);
  if (!built.ok) return null;
  const validated = await Contract.validateEnvelopeIntegrity(built.value, webcrypto);
  check(validated.ok === true, "shared RepForgeInstallTransferContract validates the built envelope", validated);
  check(built.value.workoutDraft?.schemaVersion === 2 &&
    !Object.hasOwn(built.value.workoutDraft, "writer") &&
    !Object.hasOwn(built.value.workoutDraft, "revision"),
  "envelope carries acknowledged logical DraftV2 without writer/revision metadata");
  check(built.value.programEntryDraft?.schemaVersion === 1 &&
    !Object.hasOwn(built.value.programEntryDraft, "ownerId") &&
    !Object.hasOwn(built.value.programEntryDraft, "revision"),
  "envelope carries the normalized persisted entry candidate without its wrapper");
  return built.value;
}

function assertEnvelopeSourceFields(envelope) {
  const state = envelope?.durableState;
  check(typeof state?.programMeta?.blockId === "string" && state.programMeta.blockId.length > 0,
    "source envelope retains final Plan 052 programMeta.blockId");
  check(state?.programMeta?.transitionIn?.status === "committed" &&
    typeof state.programMeta.transitionIn?.proposalHash === "string",
  "source envelope retains committed programMeta.transitionIn");
  check(Array.isArray(state?.programHistory) && state.programHistory.some((entry) => entry?.transitionOut?.successorProgramId),
    "source envelope retains programHistory transitionOut");
  check(Array.isArray(state?.recoveryTransitions?.records) && Array.isArray(state?.recoveryTransitions?.quarantine) &&
    state.recoveryTransitions.records.length > 0,
  "source envelope retains recoveryTransitions records and quarantine arrays");
  check(Array.isArray(state?.log) && state.log.length > 0 &&
    Array.isArray(state?.customExercises) && state.customExercises.some((entry) => entry.id === "custom:install-transfer-oracle"),
  "source envelope retains the real workout log and custom exercise");
}

function assertImportedLogical(actual, idbState, expected, label) {
  check(sameValue(logicalDurableState(actual.durableState), expected.durableState) &&
    sameValue(logicalDurableState(idbState), expected.durableState),
  `${label}: durable state is exact in localStorage and IndexedDB`);
  check(sameValue(actual.draft.logical, expected.workoutDraft) &&
    actual.draft.checkpoint?.status === "valid" &&
    actual.draft.checkpoint.value?.kind === "committed" &&
    actual.draft.read?.status === "ok" && actual.draft.read.raw,
  `${label}: DraftV2 logical state and acknowledged checkpoint/current read back exactly`);
  check(sameValue(actual.candidate, expected.programEntryDraft), `${label}: persisted entry candidate reads back exactly`);
  check(sameValue(actual.uiPreferences, expected.uiPreferences) &&
    sameValue(actual.analytics, expected.analytics) &&
    sameValue(actual.telemetryIdentity, expected.telemetryIdentity),
  `${label}: UI preferences, consent, and telemetry identity read back exactly`);
}

async function importInto(page, envelope, { retainCredentials = false } = {}) {
  const cookie = transferCookieFixture();
  return page.evaluate(async ({ value, token, expiresAt, inboundKey, retainCredentials: keepCredentials }) => {
    const transfer = window.RepForgeInstallTransfer;
    const contract = window.RepForgeInstallTransferContract;
    const credentials = transfer?.createCredentialVault?.({ crypto: window.crypto, indexedDB: window.indexedDB });
    const cookieValues = new Map();
    const cookieDocument = {
      get cookie() { return [...cookieValues].map(([name, cookieValue]) => `${name}=${cookieValue}`).join("; "); },
      set cookie(serialized) {
        const [pair, ...attributes] = String(serialized).split(";");
        const separator = pair.indexOf("=");
        if (separator < 0) return;
        const name = pair.slice(0, separator).trim();
        const cookieValue = pair.slice(separator + 1).trim();
        const maxAge = attributes.find((attribute) => /^\s*Max-Age=/i.test(attribute));
        if (maxAge && /Max-Age=0(?:\s|$)/i.test(maxAge)) cookieValues.delete(name);
        else cookieValues.set(name, cookieValue);
      },
    };
    const cookieLocation = { href: `${location.origin}/index.html`, origin: location.origin, pathname: "/index.html" };
    const inbound = {
      async read() {
        const raw = localStorage.getItem(inboundKey);
        try { return raw === null ? null : JSON.parse(raw); } catch { return { invalid: true, raw }; }
      },
      async write(marker) { localStorage.setItem(inboundKey, JSON.stringify(marker)); },
      async clear() { localStorage.removeItem(inboundKey); },
    };
    const operationLock = {
      withLock(name, work) {
        if (navigator.locks?.request) return navigator.locks.request(name, work);
        return work();
      },
    };
    const cleanupCredentials = async (marker) => {
      if (keepCredentials) return;
      await inbound.clear();
      try { await credentials?.forget?.("standalone-inbound", marker?.sealedCredentials); } catch {}
    };
    const transport = {
      async request({ path }) {
        if (path !== "/v1/transfers/claims") throw new Error(`unexpected-test-transfer-request:${path}`);
        return {
          status: 200,
          bytes: new TextEncoder().encode(JSON.stringify({ envelope: value, expiresAt })),
        };
      },
    };
    if (!transfer || !contract || !credentials ||
      !transfer.writeTransferCookie({ token, expiresAt }, { document: cookieDocument, location: cookieLocation })) {
      return { ok: false, code: "test-claim-setup-failed" };
    }
    const client = transfer.createClient({
      contract,
      crypto: window.crypto,
      transport,
      context: "standalone",
      document: cookieDocument,
      location: cookieLocation,
      storage: { inbound, credentials, operationLock },
    });
    const claimed = await client.claim();
    if (!claimed?.ok || claimed.state !== "validating") {
      await cleanupCredentials(await inbound.read());
      return { ok: false, code: claimed?.code || "test-claim-failed", claim: claimed };
    }
    const marker = await inbound.read();
    let pair;
    try { pair = await credentials.unseal("standalone-inbound", marker?.sealedCredentials); }
    catch {
      await cleanupCredentials(marker);
      return { ok: false, code: "test-claim-credential-unavailable" };
    }
    if (typeof pair?.claimId !== "string") {
      await cleanupCredentials(marker);
      return { ok: false, code: "test-claim-id-unavailable" };
    }
    const digestBytes = new Uint8Array(await window.crypto.subtle.digest(
      "SHA-256", new TextEncoder().encode(pair.claimId)));
    const claimIdDigest = [...digestBytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const result = await window.__repforgeInstallTransferImport(value, {
      claimId: pair.claimId,
      claimIdDigest,
      credentials,
    });
    await cleanupCredentials(marker);
    await window.__repforgeStorage?.flush?.();
    await window.__repforgeWorkoutDraft?.flush?.();
    await window.__repforgeOnboarding?.flushDraft?.();
    return result ?? null;
  }, { value: envelope, token: cookie.token, expiresAt: cookie.expiresAt, inboundKey: INBOUND_MARKER_KEY,
    retainCredentials });
}

async function captureObservedLogical(observation) {
  const captured = await Transfer.captureLogicalSnapshot(sourceSections(observation));
  if (!captured.ok) throw new Error(`logical observation capture failed: ${captured.code}`);
  return captured.value;
}

function cloneMatch(actual, idbState, expected) {
  const durableState = logicalDurableState(actual?.durableState);
  const expectedDurable = logicalDurableState(expected?.durableState);
  const sections = {
    durable: sameValue(durableState, expectedDurable) && sameValue(logicalDurableState(idbState), expectedDurable),
    draft: sameValue(actual?.draft?.logical, expected?.workoutDraft),
    candidate: sameValue(actual?.candidate, expected?.programEntryDraft),
    device: sameValue(actual?.uiPreferences, expected?.uiPreferences) &&
      sameValue(actual?.analytics, expected?.analytics) &&
      sameValue(actual?.telemetryIdentity, expected?.telemetryIdentity),
  };
  const draftExpected = expected?.workoutDraft;
  if (draftExpected === null) {
    sections.draft = sections.draft && actual?.draft?.current === null && actual?.draft?.raw === null &&
      (actual?.draft?.checkpoint?.status === "absent" ||
        actual?.draft?.checkpoint?.value?.kind === "tombstone");
  } else {
    sections.draft = sections.draft && actual?.draft?.checkpoint?.status === "valid" &&
      actual.draft.checkpoint.value?.kind === "committed" &&
      actual?.draft?.read?.status === "ok" && typeof actual?.draft?.read?.raw === "string";
  }
  return { ...sections, all: Object.values(sections).every(Boolean) };
}

function assertFaultCloneChoice(actual, idbState, incoming, previous, label, incomingOnly = false) {
  const incomingMatch = cloneMatch(actual, idbState, incoming);
  const previousMatch = incomingOnly ? { all: false } : cloneMatch(actual, idbState, previous);
  check(incomingMatch.all || previousMatch.all,
    `${label}: boot exposes one complete incoming or previous clone, never mixed`,
    { incoming: incomingMatch, previous: previousMatch });
  return { incomingMatch, previousMatch };
}

function assertNoRemoteCommit(result, marker, network, label) {
  const calls = (network || []).filter((request) => request.method !== "GET" &&
    /(?:transfer|commit)/i.test(request.url));
  const unauthorizedFields = ["remoteCommitAuthorized", "remoteCommit", "commitAuthorized", "deleteAuthorized"]
    .some((key) => Object.hasOwn(result || {}, key) || Object.hasOwn(marker || {}, key));
  check(calls.length === 0 && !unauthorizedFields,
    `${label}: no remote-commit authorization or commit request before local proof`,
    { calls, unauthorizedFields, result, marker });
}

async function setImportFault(page, { point, mode = "throw" }) {
  await page.evaluate(({ point: faultPoint, mode: faultMode, uiKey }) => {
    window.__repforgeInstallTransferImportFault = (point) => {
      if (point !== faultPoint) return false;
      if (faultMode === "readback") {
        // The production hook is called after device sections and immediately
        // before logical read-back. This deliberate producer mutation turns
        // that boundary into a deterministic read-back mismatch without
        // copying the import normalizer into the test.
        const raw = localStorage.getItem(uiKey);
        const prefs = raw ? JSON.parse(raw) : {};
        prefs.__installTransferReadbackViolation = true;
        localStorage.setItem(uiKey, JSON.stringify(prefs));
        return false;
      }
      return true;
    };
  }, { point, mode, uiKey: UI_KEY });
}

async function removeImportFault(page) {
  await page.evaluate(() => { delete window.__repforgeInstallTransferImportFault; });
}

async function reloadAndObserveBoot(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  let booted = false;
  try {
    await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 5000 });
    booted = true;
  } catch {}
  return { booted, marker: await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    try { return raw === null ? null : JSON.parse(raw); } catch { return { invalidRaw: raw }; }
  }, INSTALL_MARKER_KEY) };
}

async function openFreshContext(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await clearProfile(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  return { context, page };
}

async function interceptP3Endpoints(page, envelope, events, { commitFailures = 0 } = {}) {
  const expiresAt = "2099-01-01T00:00:00.000Z";
  let remainingCommitFailures = commitFailures;
  const handler = async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let body = null;
    try { body = request.postDataJSON(); } catch {}
    if (request.method() === "POST" && pathname === "/v1/transfers/claims") {
      events.push({ kind: "claim", body });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ envelope, expiresAt }),
      });
      return;
    }
    if (request.method() === "POST" && pathname === "/v1/transfers/claims/commit") {
      let marker = null;
      let inboundMarker = null;
      try {
        ({ marker, inboundMarker } = await page.evaluate(({ markerKey, inboundKey }) => {
          const parse = (key) => {
            const raw = localStorage.getItem(key);
            try { return raw === null ? null : JSON.parse(raw); } catch { return { invalidRaw: raw }; }
          };
          return { marker: parse(markerKey), inboundMarker: parse(inboundKey) };
        }, { markerKey: INSTALL_MARKER_KEY, inboundKey: INBOUND_MARKER_KEY }));
      } catch {}
      const status = remainingCommitFailures > 0 ? 503 : 200;
      if (remainingCommitFailures > 0) remainingCommitFailures -= 1;
      events.push({ kind: "commit", body, markerAtRequest: marker, inboundAtRequest: inboundMarker, status });
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(status === 200 ? { state: "deleted", expiresAt } : { state: "unavailable" }),
      });
      return;
    }
    await route.continue();
  };
  await page.route("**/v1/transfers/**", handler);
  return () => page.unroute("**/v1/transfers/**", handler).catch(() => {});
}

async function openStandaloneTransferPage(browser, envelope, events, options = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cookie = transferCookieFixture();
  if (options.initScript) {
    await context.addInitScript(options.initScript, options.initArg);
  }
  await context.addInitScript(({ cookieValue, seedOnce }) => {
    const originalMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const result = originalMatchMedia(query);
      if (query !== "(display-mode: standalone)") return result;
      return { ...result, matches: true, media: query };
    };
    if (seedOnce && sessionStorage.getItem("__p4cStandaloneCookieSeeded") === "1") return;
    document.cookie = `repforge_transfer_v1=${cookieValue}; Path=/index.html; Max-Age=3600; SameSite=Lax`;
    if (seedOnce) sessionStorage.setItem("__p4cStandaloneCookieSeeded", "1");
  }, { cookieValue: cookie.value, seedOnce: options.seedCookieOnce === true });
  const removeRoutes = await interceptP3Endpoints(page, envelope, events, options);
  await page.goto(new URL("index.html", BASE).href, { waitUntil: "domcontentloaded" });
  if (options.waitForBoot !== false) await waitForAppBoot(page, { base: BASE });
  return { context, page, cookie, removeRoutes };
}

async function waitForP3Events(events, predicate, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate(events) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return predicate(events);
}

async function readSealedInboundClaim(page) {
  return page.evaluate(async (key) => {
    const raw = localStorage.getItem(key);
    let marker;
    try { marker = raw === null ? null : JSON.parse(raw); } catch { return { ok: false, code: "inbound-marker-invalid" }; }
    const sealed = marker?.sealedCredentials;
    const vault = window.RepForgeInstallTransfer?.createCredentialVault?.();
    if (!sealed || !vault?.unseal) return { ok: false, code: "sealed-inbound-credential-unavailable" };
    let pair;
    try { pair = await vault.unseal("standalone-inbound", sealed); }
    catch { return { ok: false, code: "sealed-inbound-unseal-failed" }; }
    if (typeof pair?.claimId !== "string") return { ok: false, code: "sealed-inbound-claim-id-missing" };
    const digestBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pair.claimId)));
    const claimIdDigest = [...digestBytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return { ok: true, phase: marker.phase, claimIdDigest, claimIdLength: pair.claimId.length };
  }, INBOUND_MARKER_KEY);
}

async function sha256HexText(value) {
  const bytes = new Uint8Array(await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function runPreBootImportCase(browser, envelope) {
  console.log("\nPlan 053-P4b pre-telemetry first-boot import");
  const events = [];
  const initScript = ({ keys }) => {
    if (!window.__repforgePreBootInitialDevice) {
      window.__repforgePreBootInitialDevice = {
        prefs: localStorage.getItem(keys.ui),
        consent: localStorage.getItem(keys.consent),
        identity: localStorage.getItem(keys.identity),
      };
    }
    window.__repforgeTelemetryBoots = [];
    let installed;
    Object.defineProperty(window, "RepForgeTelemetry", {
      configurable: true,
      get: () => installed,
      set: (next) => {
        const originalBoot = next?.boot;
        const wrapped = { ...next };
        wrapped.boot = (...args) => {
          const before = {
            prefs: localStorage.getItem(keys.ui),
            consent: localStorage.getItem(keys.consent),
            identity: localStorage.getItem(keys.identity),
          };
          const status = Reflect.apply(originalBoot, next, args);
          window.__repforgeTelemetryBoots.push({
            before,
            after: {
              prefs: localStorage.getItem(keys.ui),
              consent: localStorage.getItem(keys.consent),
              identity: localStorage.getItem(keys.identity),
            },
            status: {
              enabled: status?.enabled,
              installationId: status?.installationId,
            },
          });
          return status;
        };
        installed = wrapped;
      },
    });
  };
  const { context, page, removeRoutes } = await openStandaloneTransferPage(browser, envelope, events, {
    waitForBoot: false,
    seedCookieOnce: true,
    initScript,
    initArg: { keys: { ui: UI_KEY, consent: CONSENT_KEY, identity: IDENTITY_KEY } },
  });
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  try {
    let booted = true;
    try {
      await waitForAppBoot(page, { base: BASE });
    } catch (error) {
      booted = false;
      check(false, "pre-telemetry request allows normal first boot to complete", error.message);
    }
    const initial = await page.evaluate(() => window.__repforgePreBootInitialDevice);
    check(booted && initial?.prefs === null && initial?.consent === null && initial?.identity === null,
      "pre-telemetry destination begins without prefs, consent, or identity", initial);
    const boots = await page.evaluate(() => window.__repforgeTelemetryBoots || []);
    const firstBoot = boots[0];
    let beforeIdentity = null;
    try { beforeIdentity = JSON.parse(firstBoot?.before?.identity || "null"); } catch {}
    check(booted && boots.length >= 1 && beforeIdentity?.installationId === envelope.telemetryIdentity?.installationId,
      "RepForgeTelemetry boots only after preboot import binds the incoming identity", firstBoot);
    check(booted && firstBoot?.status?.installationId === envelope.telemetryIdentity?.installationId &&
      firstBoot?.status?.enabled === false && firstBoot?.before?.consent === "false",
    "preboot import preserves incoming installationId and disabled consent at telemetry boot", firstBoot);
    check(events.filter((event) => event.kind === "claim").length === 1 &&
      events.filter((event) => event.kind === "commit").length === 1,
    "pre-telemetry standalone boot performs one real claim and one acknowledged commit", events);
    const logical = await readLogical(page);
    const idb = await readIdb(page);
    if (booted) assertImportedLogical(logical, idb, envelope, "pre-telemetry destination");

    await page.reload({ waitUntil: "domcontentloaded" });
    let reloadBooted = true;
    try {
      await waitForAppBoot(page, { base: BASE });
    } catch (error) {
      reloadBooted = false;
      check(false, "pre-telemetry destination reload completes normally", error.message);
    }
    if (reloadBooted) {
      await flush(page);
      const afterReload = await readLogical(page);
      const afterReloadIdb = await readIdb(page);
      assertImportedLogical(afterReload, afterReloadIdb, envelope, "pre-telemetry destination after reload");
      check(events.filter((event) => event.kind === "claim").length === 1 &&
        events.filter((event) => event.kind === "commit").length === 1,
      "pre-telemetry destination reload does not replay an unclaimed transfer request", events);
    }
  } finally {
    await removeRoutes();
    await context.close();
  }
}

async function seedMeaningfulDestination(page, kind, envelope) {
  return page.evaluate(async ({ kind, draft, candidate, stateKey, draftKey, checkpointKey, entryKey, uiKey, consentKey, identityKey, dbName, storeName }) => {
    const parse = (value) => {
      try { return JSON.parse(value); } catch { return null; }
    };
    if (kind === "prefs-only") {
      window.__repforgeUi?.setTheme?.("dark");
      return { ok: window.__repforgeUi?.loadUiPrefs?.()?.theme === "dark" };
    }
    if (kind === "consent-identity-only") {
      window.RepForgeTelemetry?.setEnabled?.(false);
      const identity = parse(localStorage.getItem(identityKey)) || {
        schemaVersion: 1, installationId: "destination-meaningful-identity", createdAt: "2026-10-10T09:00:00.000Z",
      };
      identity.installationId = "destination-meaningful-identity";
      localStorage.setItem(identityKey, JSON.stringify(identity));
      return { ok: localStorage.getItem(consentKey) === "false" && identity.installationId === "destination-meaningful-identity" };
    }
    if (kind === "draft-only") {
      const value = JSON.parse(JSON.stringify(draft));
      value.revision = 0;
      value.writer = { installationId: "destination-draft-installation", tabId: "destination-draft-tab", operationId: "destination-draft-seed" };
      value.program = { ...value.program, durableRevision: 0 };
      const serialized = window.RepForgeWorkoutDraft.serialize(value);
      if (serialized?.kind === "error") return { ok: false, code: "draft-serialize-failed", serialized };
      const checked = window.RepForgeWorkoutDraft.parse(JSON.stringify(serialized));
      if (checked?.kind !== "valid") return { ok: false, code: "draft-parse-failed", checked };
      const raw = JSON.stringify(serialized);
      localStorage.setItem(draftKey, raw);
      localStorage.setItem(checkpointKey, JSON.stringify({
        version: 1, kind: "committed", draftId: checked.draft.draftId, revision: checked.draft.revision,
        operationId: "destination-draft-seed", programFingerprint: checked.draft.program.programFingerprint, raw,
      }));
      return { ok: window.RepForgeWorkoutDraft.parse(raw)?.kind === "valid" };
    }
    if (kind === "candidate-only") {
      const Entry = window.RepForgeProgramEntry;
      const normalized = Entry?.normalizeSetupDraft?.(candidate);
      if (!normalized?.ok) return { ok: false, code: "candidate-normalize-failed", normalized };
      let persisted;
      try {
        persisted = Entry.advanceSetupDraftEnvelope({
          schemaVersion: Entry.SCHEMA_VERSION, draftId: normalized.value.draftId, revision: 0, ownerId: null,
          state: normalized.value,
        }, normalized.value, "destination-candidate-owner");
      } catch (error) {
        return { ok: false, code: "candidate-envelope-failed", error: error.message };
      }
      localStorage.setItem(entryKey, JSON.stringify(persisted));
      return { ok: Entry.normalizeSetupDraftEnvelope(localStorage.getItem(entryKey))?.ok === true };
    }
    if (kind === "unreadable-state") {
      localStorage.setItem(stateKey, "{unreadable-destination");
      await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.close(); resolve(); return;
          }
          const put = db.transaction(storeName, "readwrite").objectStore(storeName).put({ unreadable: true }, stateKey);
          put.onsuccess = () => { db.close(); resolve(); };
          put.onerror = () => { db.close(); reject(put.error); };
        };
      });
      return { ok: localStorage.getItem(stateKey) === "{unreadable-destination" };
    }
    return { ok: false, code: "unknown-seed" };
  }, {
    kind, draft: envelope.workoutDraft, candidate: envelope.programEntryDraft,
    stateKey: STATE_KEY, draftKey: DRAFT_KEY, checkpointKey: CHECKPOINT_KEY, entryKey: ENTRY_KEY,
    uiKey: UI_KEY, consentKey: CONSENT_KEY, identityKey: IDENTITY_KEY, dbName: DB_NAME, storeName: STORE_NAME,
  });
}

async function runFaultMatrix(browser, envelope) {
  console.log("\nPlan 053-P4b deterministic import fault matrix");
  const faults = [
    { label: "after marker", point: "after-marker" },
    { label: "after durable state", point: "after-durable" },
    { label: "after DraftV2", point: "after-draft" },
    { label: "after candidate", point: "after-candidate" },
    { label: "after device sections", point: "before-readback" },
    { label: "read-back mismatch", point: "before-readback", mode: "readback" },
    { label: "after local committed", point: "after-local-committed", incomingOnly: true },
  ];
  for (const fault of faults) {
    const { context, page } = await openFreshContext(browser);
    const network = [];
    const onRequest = (request) => network.push({ method: request.method(), url: request.url() });
    page.on("request", onRequest);
    try {
      const previousObservation = await readLogical(page);
      const previous = await captureObservedLogical(previousObservation);
      await setImportFault(page, fault);
      let result;
      try { result = await importInto(page, envelope); }
      catch (error) { result = { thrown: error.message }; }
      await removeImportFault(page);
      const markerBefore = await page.evaluate((key) => {
        const raw = localStorage.getItem(key);
        try { return raw === null ? null : JSON.parse(raw); } catch { return { invalidRaw: raw }; }
      }, INSTALL_MARKER_KEY);
      check(result?.ok === false, `${fault.label}: injected fault returns a non-success result`, result);
      check(markerBefore?.phase === (fault.incomingOnly ? "local-committed" : "importing"),
        `${fault.label}: marker records the interrupted import phase`, markerBefore);
      const recovery = await reloadAndObserveBoot(page);
      check(recovery.booted, `${fault.label}: reload/boot settles after the interrupted import`, recovery);
      const actual = await readLogical(page, { flushDraft: false });
      const idb = await readIdb(page);
      assertFaultCloneChoice(actual, idb, envelope, previous, fault.label, fault.incomingOnly === true);
      if (fault.incomingOnly) {
        check(recovery.marker?.phase === "local-committed" &&
          typeof recovery.marker?.transactionId === "string" &&
          typeof recovery.marker?.claimIdDigest === "string",
        "after local committed: reload exposes the retained deletion-retry marker instead of rolling back",
        recovery.marker);
      }
      if (!fault.incomingOnly) assertNoRemoteCommit(result, recovery.marker || markerBefore, network, fault.label);
    } finally {
      page.off("request", onRequest);
      await context.close();
    }
  }
}

async function runMeaningfulDestinationMatrix(browser, envelope) {
  console.log("\nPlan 053-P4b meaningful-destination refusal matrix");
  const cases = [
    ["prefs-only", "prefs-only"],
    ["consent/identity-only", "consent-identity-only"],
    ["DraftV2-only", "draft-only"],
    ["candidate-only", "candidate-only"],
    ["unreadable state", "unreadable-state"],
  ];
  for (const [label, kind] of cases) {
    const { context, page } = await openFreshContext(browser);
    const network = [];
    const onRequest = (request) => network.push({ method: request.method(), url: request.url() });
    page.on("request", onRequest);
    try {
      const seeded = await seedMeaningfulDestination(page, kind, envelope);
      check(seeded.ok === true, `${label}: deterministic meaningful state is seeded through current APIs`, seeded);
      const before = await readStorageBytes(page);
      let result;
      try { result = await importInto(page, envelope); }
      catch (error) { result = { thrown: error.message }; }
      const after = await readStorageBytes(page);
      check(result?.ok === false, `${label}: import refuses the meaningful destination`, result);
      check(sameValue(after.local, before.local) && sameValue(after.idb, before.idb),
        `${label}: refusal occurs before any local or IndexedDB mutation`, { before, after });
      assertNoRemoteCommit(result, null, network, label);
    } finally {
      page.off("request", onRequest);
      await context.close();
    }
  }
}

async function runP4cStandaloneClaimCommit(browser, envelope) {
  console.log("\nPlan 053-P4c A standalone cookie claim/import/commit boundary");
  const events = [];
  const { context, page, cookie, removeRoutes } = await openStandaloneTransferPage(browser, envelope, events);
  try {
    const inbound = parseMarker(await page.evaluate((key) => localStorage.getItem(key), INBOUND_MARKER_KEY));
    const claimEvents = events.filter((event) => event.kind === "claim");
    const commitEvents = events.filter((event) => event.kind === "commit");
    const inboundCredential = inbound?.sealedCredentials || inbound?.sealedToken;
    const inboundValid = !!inbound && ["staged", "claiming", "claimed", "local-committed", "cleanup-pending"].includes(inbound.phase) &&
      !!inboundCredential && !JSON.stringify(inbound).includes(cookie.token);

    const actual = await readLogical(page, { flushDraft: false });
    const idb = await readIdb(page);
    const imported = cloneMatch(actual, idb, envelope).all;

    const commitAfterProof = commitEvents.length === 1 &&
      commitEvents[0]?.markerAtRequest?.phase === "local-committed";

    const finalInbound = parseMarker(await page.evaluate((key) => localStorage.getItem(key), INBOUND_MARKER_KEY));
    const cleanup = commitEvents.length === 1 &&
      (finalInbound === null || finalInbound?.phase === "cleanup-pending" && finalInbound.remoteState === "deleted");
    check(claimEvents.length === 1 && inboundValid &&
      typeof claimEvents[0]?.body?.claimId === "string" && claimEvents[0].body.claimId.length >= 22 &&
      imported && commitAfterProof && cleanup,
    "P4c-A: standalone cookie claim/import/commit/cleanup is wired through the real app boot",
    {
      claimCount: claimEvents.length, inboundPhase: inbound?.phase || null, imported,
      durableProgramLength: actual.durableState?.program?.length,
      idbMatches: sameValue(logicalDurableState(idb), envelope.durableState),
      commitCount: commitEvents.length, commitAfterProof, finalInboundPhase: finalInbound?.phase || null,
    });
  } finally {
    await removeRoutes();
    await context.close();
  }
}

async function runP4cConcurrentImport(browser, envelope) {
  console.log("\nPlan 053-P4c B concurrent same-storage import arbitration");
  const context = await browser.newContext();
  await context.addInitScript(({ markerKey }) => {
    window.__repforgeTransferLockNames = [];
    window.__repforgeTransferStorageSignals = [];
    try {
      const original = navigator.locks?.request?.bind(navigator.locks);
      if (original) {
        navigator.locks.request = (name, ...args) => {
          window.__repforgeTransferLockNames.push(String(name));
          return original(name, ...args);
        };
      }
    } catch {}
    window.addEventListener("storage", (event) => {
      if (event.key === markerKey || event.key === "repforge_transfer_inbound_v1") {
        window.__repforgeTransferStorageSignals.push({ key: event.key, value: event.newValue });
      }
    });
  }, { markerKey: INSTALL_MARKER_KEY });
  const pageA = await context.newPage();
  const pageB = await context.newPage();
  try {
    await Promise.all([pageA.goto(BASE, { waitUntil: "domcontentloaded" }), pageB.goto(BASE, { waitUntil: "domcontentloaded" })]);
    await Promise.all([waitForAppBoot(pageA, { base: BASE }), waitForAppBoot(pageB, { base: BASE })]);
    const results = await Promise.all([
      importInto(pageA, envelope, { retainCredentials: true }),
      importInto(pageB, envelope, { retainCredentials: true }),
    ]);
    const markerA = parseMarker(await pageA.evaluate((key) => localStorage.getItem(key), INSTALL_MARKER_KEY));
    const markerB = parseMarker(await pageB.evaluate((key) => localStorage.getItem(key), INSTALL_MARKER_KEY));
    const observations = await Promise.all([pageA, pageB].map(async (page) => ({
      logical: await readLogical(page, { flushDraft: false }),
      idb: await readIdb(page),
      locks: await page.evaluate(() => window.__repforgeTransferLockNames || []),
      signals: await page.evaluate(() => window.__repforgeTransferStorageSignals || []),
    })));
    const oneSuccessfulTransaction = results.filter((result) => result?.ok === true).length === 1 &&
      sameValue(markerA, markerB) && typeof markerA?.transactionId === "string";
    const noMixedSections = observations.every(({ logical, idb }) => cloneMatch(logical, idb, envelope).all);
    const freezeSignal = observations.some(({ locks, signals }) =>
      locks.includes("install-transfer") || signals.some((signal) => signal.key === INBOUND_MARKER_KEY));
    check(oneSuccessfulTransaction && noMixedSections && freezeSignal,
      "P4c-B: one cross-tab import transaction owns the marker, freezes the sibling, and exposes no mixed clone",
      {
        results: results.map((result) => ({ ok: result?.ok, code: result?.code, phase: result?.phase })),
        markerIds: [markerA?.transactionId, markerB?.transactionId],
        lockNames: observations.map((observation) => observation.locks),
        storageSignalCounts: observations.map((observation) => observation.signals.length),
        oneSuccessfulTransaction, noMixedSections, freezeSignal,
      });
  } finally {
    await context.close();
  }
}

async function runP4cMarkerContract(browser, envelope) {
  console.log("\nPlan 053-P4c C mirrored marker and fail-closed validation");
  const initialEvents = [];
  const initial = await openStandaloneTransferPage(browser, envelope, initialEvents, { commitFailures: 1 });
  let markerMirror = false;
  let claimBinding = false;
  let localMarker = null;
  let idbMarker = null;
  try {
    await waitForP3Events(initialEvents, (events) =>
      events.filter((event) => event.kind === "claim").length === 1 &&
      events.filter((event) => event.kind === "commit").length === 1);
    localMarker = parseMarker(await initial.page.evaluate((key) => localStorage.getItem(key), INSTALL_MARKER_KEY));
    idbMarker = await readIdbValue(initial.page, INSTALL_MARKER_KEY);
    const inboundClaim = await readSealedInboundClaim(initial.page);
    const claimEvent = initialEvents.find((event) => event.kind === "claim");
    const claimEventDigest = typeof claimEvent?.body?.claimId === "string"
      ? await sha256HexText(claimEvent.body.claimId)
      : null;
    markerMirror = localMarker !== null && sameValue(localMarker, idbMarker);
    claimBinding = inboundClaim.ok && inboundClaim.phase === "local-committed" &&
      localMarker?.claimIdDigest === inboundClaim.claimIdDigest &&
      claimEventDigest === inboundClaim.claimIdDigest;
  } finally {
    await initial.removeRoutes();
    await initial.context.close();
  }

  const mutations = [
    ["version", (marker) => ({ ...marker, version: 2 })],
    ["claim-id-digest", (marker) => ({ ...marker, claimIdDigest: "0".repeat(64) })],
    ["created-at", (marker) => ({ ...marker, createdAt: "not-a-timestamp" })],
    ["expected-local-revision", (marker) => ({ ...marker, expectedLocalRevision: -1 })],
    ["canonical-hash", (marker) => ({
      ...marker,
      incoming: { ...marker.incoming, integrity: { canonicalPayloadHash: "0".repeat(64) } },
    })],
  ];
  const outcomes = [];
  for (const [label, mutate] of mutations) {
    const events = [];
    const fresh = await openStandaloneTransferPage(browser, envelope, events, { commitFailures: 1 });
    try {
      await waitForP3Events(events, (observed) =>
        observed.filter((event) => event.kind === "claim").length === 1 &&
        observed.filter((event) => event.kind === "commit").length === 1);
      const marker = parseMarker(await fresh.page.evaluate((key) => localStorage.getItem(key), INSTALL_MARKER_KEY));
      await fresh.page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
        key: INSTALL_MARKER_KEY, value: mutate(marker),
      });
      const recovery = await reloadAndObserveBoot(fresh.page);
      outcomes.push({ label, booted: recovery.booted, marker: recovery.marker });
    } finally {
      await fresh.removeRoutes();
      await fresh.context.close();
    }
  }
  const failClosed = outcomes.every((outcome) => outcome.booted === false && outcome.marker !== null);
  check(markerMirror && claimBinding && failClosed,
    "P4c-C: a real claimed transfer mirrors its claim-bound marker and every divergent version/digest/timestamp/revision/hash fails closed without clearing it",
    {
      markerMirror, claimBinding,
      localPhase: localMarker?.phase,
      localTransactionId: localMarker?.transactionId,
      idbMarker,
      outcomes: outcomes.map((outcome) => ({ label: outcome.label, booted: outcome.booted, markerPhase: outcome.marker?.phase })),
    });
}

async function seedSettingsOnlyDestination(page) {
  return page.evaluate(async () => {
    const current = window.__repforgeWorkoutDraft?.state?.();
    if (!current || typeof window.__repforgeCommitProposedState !== "function") {
      return { ok: false, code: "production-state-commit-seam-unavailable" };
    }
    const next = JSON.parse(JSON.stringify(current));
    next.settings = { ...next.settings, jumpPct: 7.5 };
    const result = await window.__repforgeCommitProposedState(next);
    await window.__repforgeStorage?.flush?.();
    return {
      ok: !!(result?.localOk || result?.idbOk),
      result,
      settings: JSON.parse(localStorage.getItem("repforge_v1") || "null")?.settings,
      program: JSON.parse(localStorage.getItem("repforge_v1") || "null")?.program,
      log: JSON.parse(localStorage.getItem("repforge_v1") || "null")?.log,
    };
  });
}

async function runP4cSettingsOnlyDestination(browser, envelope) {
  console.log("\nPlan 053-P4c D non-default durable-settings destination refusal");
  const { context, page } = await openFreshContext(browser);
  const network = [];
  const onRequest = (request) => network.push({ method: request.method(), url: request.url() });
  page.on("request", onRequest);
  try {
    const seeded = await seedSettingsOnlyDestination(page);
    const before = await readStorageBytes(page);
    let result;
    try { result = await importInto(page, envelope); }
    catch (error) { result = { thrown: error.message }; }
    const after = await readStorageBytes(page);
    const transferRequests = network.filter((request) => request.method !== "GET" && /\/v1\/transfers\//.test(request.url()));
    check(seeded.ok && result?.ok === false && sameValue(before.local, after.local) && sameValue(before.idb, after.idb) &&
      transferRequests.length === 0,
    "P4c-D: a destination with only non-default durable settings refuses before claim or mutation",
    {
      seeded: { ok: seeded.ok, jumpPct: seeded.settings?.jumpPct, programLength: seeded.program?.length, logLength: seeded.log?.length },
      result: { ok: result?.ok, code: result?.code, state: result?.state },
      unchanged: sameValue(before.local, after.local) && sameValue(before.idb, after.idb), transferRequests,
    });
  } finally {
    page.off("request", onRequest);
    await context.close();
  }
}

async function runP4cCommittedMutationRecovery(browser, envelope) {
  console.log("\nPlan 053-P4c E local-committed mutation and remote-delete retry");
  const events = [];
  const { context, page, cookie, removeRoutes } = await openStandaloneTransferPage(browser, envelope, events, { commitFailures: 1 });
  try {
    await waitForP3Events(events, (observed) =>
      observed.filter((event) => event.kind === "claim").length === 1 &&
      observed.filter((event) => event.kind === "commit").length === 1);
    const claimEvent = events.find((event) => event.kind === "claim");
    const firstCommit = events.find((event) => event.kind === "commit");
    const markerBefore = parseMarker(await page.evaluate((key) => localStorage.getItem(key), INSTALL_MARKER_KEY));
    const inboundBefore = parseMarker(await page.evaluate((key) => localStorage.getItem(key), INBOUND_MARKER_KEY));
    const sealedClaim = await readSealedInboundClaim(page);
    await page.evaluate((key) => {
      if (typeof window.__repforgeUi?.setTheme === "function") {
        window.__repforgeUi.setTheme("light");
        return;
      }
      const prefs = JSON.parse(localStorage.getItem(key) || "{}");
      prefs.theme = "light";
      localStorage.setItem(key, JSON.stringify(prefs));
    }, UI_KEY);
    let booted = true;
    try { await waitForAppBoot(page, { base: BASE }); }
    catch {}
    await page.reload({ waitUntil: "domcontentloaded" });
    try { await waitForAppBoot(page, { base: BASE }); }
    catch { booted = false; }
    await waitForP3Events(events, (observed) => observed.filter((event) => event.kind === "commit").length >= 2);
    const ui = parseMarker(await page.evaluate((key) => localStorage.getItem(key), UI_KEY));
    const durable = parseMarker(await page.evaluate((key) => localStorage.getItem(key), STATE_KEY));
    const markerAfter = parseMarker(await page.evaluate((key) => localStorage.getItem(key), INSTALL_MARKER_KEY));
    const inboundAfter = parseMarker(await page.evaluate((key) => localStorage.getItem(key), INBOUND_MARKER_KEY));
    const commitEvents = events.filter((event) => event.kind === "commit");
    const retryCommit = commitEvents[1];
    const boundCommit = typeof claimEvent?.body?.claimId === "string" &&
      commitEvents.every((event) => event.body?.claimId === claimEvent.body.claimId && event.body?.token === cookie.token);
    check(claimEvent && firstCommit?.status === 503 && firstCommit.inboundAtRequest?.phase === "local-committed" &&
      markerBefore?.phase === "local-committed" && inboundBefore?.phase === "local-committed" && sealedClaim.ok &&
      sealedClaim.claimIdDigest === markerBefore.claimIdDigest && booted && ui?.theme === "light" &&
      sameValue(logicalDurableState(durable), envelope.durableState) && commitEvents.length === 2 &&
      retryCommit?.status === 200 && retryCommit.inboundAtRequest?.phase === "local-committed" && boundCommit && inboundAfter === null,
    "P4c-E: a genuine local-committed claim survives a post-commit UI/state mutation, boots without rollback, and retries its bound remote deletion",
    {
      claimCount: events.filter((event) => event.kind === "claim").length,
      firstCommitStatus: firstCommit?.status || null, retryCommitStatus: retryCommit?.status || null,
      sealedClaim: { ok: sealedClaim.ok, phase: sealedClaim.phase || null }, booted, uiTheme: ui?.theme,
      durableMatchesIncoming: sameValue(logicalDurableState(durable), envelope.durableState),
      markerBeforePhase: markerBefore?.phase, markerAfterPhase: markerAfter?.phase,
      inboundBeforePhase: inboundBefore?.phase, inboundPresent: inboundAfter !== null,
      commitCount: commitEvents.length, boundCommit,
    });
  } finally {
    await removeRoutes();
    await context.close();
  }
}

async function runP4cPostMarkerBootOrdering(browser, envelope) {
  console.log("\nPlan 053-P4c F post-marker failure blocks boot until recovery");
  const events = [];
  const initScript = ({ markerKey, inboundKey, stateKey }) => {
    const trace = { telemetryBoots: [], initMarkers: [], booted: false, faulted: false };
    const markerPhase = () => {
      try {
        const raw = localStorage.getItem(markerKey);
        return raw === null ? null : JSON.parse(raw)?.phase || null;
      } catch { return "invalid"; }
    };
    window.__p4cBootTrace = trace;
    let booted = false;
    Object.defineProperty(window, "__repforgeBooted", {
      configurable: true,
      get: () => booted,
      set: (value) => {
        booted = value === true;
        trace.booted = booted;
        trace.initMarkers.push({ markerPhase: markerPhase(), statePresent: localStorage.getItem(stateKey) !== null });
      },
    });
    let installed;
    Object.defineProperty(window, "RepForgeTelemetry", {
      configurable: true,
      get: () => installed,
      set: (next) => {
        const originalBoot = next?.boot;
        if (typeof originalBoot !== "function") {
          installed = next;
          return;
        }
        const wrapped = { ...next };
        wrapped.boot = (...args) => {
          const before = {
            markerPhase: markerPhase(),
            inboundPhase: (() => {
              try {
                const raw = localStorage.getItem(inboundKey);
                return raw === null ? null : JSON.parse(raw)?.phase || null;
              } catch { return "invalid"; }
            })(),
          };
          const result = Reflect.apply(originalBoot, next, args);
          trace.telemetryBoots.push({ before, enabled: result?.enabled, installationId: result?.installationId });
          return result;
        };
        installed = wrapped;
      },
    });
    window.__repforgeInstallTransferImportFault = (point) => {
      if (point !== "after-marker") return false;
      trace.faulted = true;
      return true;
    };
  };
  const { context, page, removeRoutes } = await openStandaloneTransferPage(browser, envelope, events, {
    waitForBoot: false,
    initScript,
    initArg: { markerKey: INSTALL_MARKER_KEY, inboundKey: INBOUND_MARKER_KEY, stateKey: STATE_KEY },
  });
  try {
    await page.waitForFunction(() => window.__p4cBootTrace?.faulted === true,
      undefined, { timeout: 10000 });
    const trace = await page.evaluate(() => window.__p4cBootTrace);
    const localMarker = parseMarker(await page.evaluate((key) => localStorage.getItem(key), INSTALL_MARKER_KEY));
    const idbMarker = await readIdbValue(page, INSTALL_MARKER_KEY);
    const telemetryAfterMarker = (trace.telemetryBoots || []).filter((entry) => entry.before?.markerPhase === "importing");
    const initAfterMarker = (trace.initMarkers || []).filter((entry) => entry.markerPhase === "importing");
    check(trace.faulted === true && trace.booted === false && localMarker?.phase === "importing" &&
      idbMarker?.phase === "importing" && telemetryAfterMarker.length === 0 && initAfterMarker.length === 0,
    "P4c-F: a post-marker standalone failure leaves boot blocked with mirrored importing markers and no later telemetry or init",
    { trace, localPhase: localMarker?.phase, idbPhase: idbMarker?.phase, telemetryAfterMarker, initAfterMarker, events });
  } finally {
    await removeRoutes();
    await context.close();
  }
}

async function runP4cRollbackPhasePersistence(browser, envelope) {
  console.log("\nPlan 053-P4c J rollback phase is mirrored before rollback work and resumes after crash");
  const { context, page } = await openFreshContext(browser);
  try {
    await setImportFault(page, { point: "after-durable" });
    try { await importInto(page, envelope); } catch {}
    await removeImportFault(page);
    const importingMarker = parseMarker(await page.evaluate((key) => localStorage.getItem(key), INSTALL_MARKER_KEY));
    const importingIdbMarker = await readIdbValue(page, INSTALL_MARKER_KEY);
    await context.addInitScript(({ stateKey, markerKey, faultPoint, disabledKey }) => {
      const events = [];
      const phase = () => {
        try {
          const raw = localStorage.getItem(markerKey);
          return raw === null ? null : JSON.parse(raw)?.phase || null;
        } catch { return "invalid"; }
      };
      const markerPhase = (value) => {
        if (typeof value === "string") {
          try { return JSON.parse(value)?.phase || null; } catch { return "invalid"; }
        }
        return value && typeof value === "object" ? value.phase || null : null;
      };
      const record = (kind, key, value) => {
        let observedPhase = phase();
        if (key === markerKey) observedPhase = markerPhase(value);
        events.push({ kind, key: String(key), markerPhase: observedPhase });
      };
      try {
        const originalSet = Storage.prototype.setItem;
        Storage.prototype.setItem = function setItem(key, value) {
          if (key === stateKey || key === markerKey) record("local-write", key, value);
          return originalSet.call(this, key, value);
        };
      } catch {}
      try {
        const originalPut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function put(value, key) {
          if (key === stateKey || key === markerKey) record("idb-put", key, value);
          return originalPut.call(this, value, key);
        };
      } catch {}
      window.__p4cRollbackEvents = events;
      window.__repforgeInstallTransferImportFault = (point) =>
        point === faultPoint && sessionStorage.getItem(disabledKey) !== "1";
    }, {
      stateKey: STATE_KEY,
      markerKey: INSTALL_MARKER_KEY,
      faultPoint: "after-rollback-durable",
      disabledKey: "__p4cRollbackFaultDisabled",
    });
    await page.evaluate(({ stateKey, inboundKey, incoming }) => {
      const current = JSON.parse(localStorage.getItem(stateKey) || "null");
      const next = JSON.parse(JSON.stringify(incoming));
      next._storageRevision = Number.isSafeInteger(current?._storageRevision) ? current._storageRevision : 1;
      localStorage.setItem(stateKey, JSON.stringify(next));
      localStorage.removeItem(inboundKey);
    }, { stateKey: STATE_KEY, inboundKey: INBOUND_MARKER_KEY, incoming: envelope.durableState });
    await deleteIdbValue(page, STATE_KEY);
    const firstBoot = await reloadAndObserveBoot(page);
    const afterEvents = await page.evaluate(() => window.__p4cRollbackEvents || []);
    const markerAfterCrash = parseMarker(await page.evaluate((key) => localStorage.getItem(key), INSTALL_MARKER_KEY));
    const idbMarkerAfterCrash = await readIdbValue(page, INSTALL_MARKER_KEY);
    await page.evaluate((disabledKey) => sessionStorage.setItem(disabledKey, "1"), "__p4cRollbackFaultDisabled");
    const secondBoot = await reloadAndObserveBoot(page);
    const finalMarker = parseMarker(await page.evaluate((key) => localStorage.getItem(key), INSTALL_MARKER_KEY));
    const finalIdbMarker = await readIdbValue(page, INSTALL_MARKER_KEY);
    const logical = await readLogical(page, { flushDraft: false });
    const previousDurable = importingMarker?.previous?.durableState;
    const rollbackMarkerEvents = afterEvents.filter((event) =>
      event.key === INSTALL_MARKER_KEY && event.markerPhase === "rolling-back");
    const stateWriteIndex = afterEvents.findIndex((event) => event.key === STATE_KEY);
    const rollbackMarkerLastIndex = afterEvents.reduce((index, event, currentIndex) =>
      event.key === INSTALL_MARKER_KEY && event.markerPhase === "rolling-back" ? currentIndex : index, -1);
    check(importingMarker?.phase === "importing" && importingIdbMarker?.phase === "importing" &&
      !firstBoot.booted && rollbackMarkerEvents.length >= 2 && stateWriteIndex >= 0 &&
      rollbackMarkerLastIndex < stateWriteIndex && markerAfterCrash?.phase === "rolling-back" &&
      idbMarkerAfterCrash?.phase === "rolling-back" && secondBoot.booted && finalMarker === null &&
      finalIdbMarker === null &&
      sameValue(logicalDurableState(logical.durableState), logicalDurableState(previousDurable)),
    "P4c-J: rollback mirrors rolling-back before any rollback write, blocks the crashed boot, and resumes to the previous durable state",
    { importingPhase: importingMarker?.phase, importingIdbPhase: importingIdbMarker?.phase, firstBoot,
      events: afterEvents, rollbackMarkerEvents, stateWriteIndex, rollbackMarkerLastIndex,
      markerAfterCrash, idbMarkerAfterCrash, secondBoot, finalMarker, finalIdbMarker,
      durableMatchesPrevious: sameValue(logicalDurableState(logical.durableState), logicalDurableState(previousDurable)) });
  } finally {
    await context.close();
  }
}

async function runP4cSiblingFreezeBoundary(browser, envelope) {
  console.log("\nPlan 053-P4c H sibling UI/consent writes are blocked during import freeze");
  const context = await browser.newContext();
  const pageA = await context.newPage();
  const pageB = await context.newPage();
  try {
    await pageA.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(pageA, { base: BASE });
    await clearProfile(pageA);
    await pageA.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(pageA, { base: BASE });
    await pageB.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(pageB, { base: BASE });
    await pageA.evaluate(() => {
      window.__repforgeInstallTransferImportFault = (point) => {
        if (point !== "after-marker") return false;
        alert("install-transfer-freeze-barrier");
        return true;
      };
    });
    const dialogPromise = pageA.waitForEvent("dialog", { timeout: 10000 });
    const importPromise = importInto(pageA, envelope, { retainCredentials: true });
    const dialog = await dialogPromise;
    const observed = await pageB.evaluate(({ freezeKey, uiKey, consentKey }) => {
      const parse = (key) => {
        const raw = localStorage.getItem(key);
        try { return raw === null ? null : JSON.parse(raw); } catch { return { invalidRaw: raw }; }
      };
      const before = { freeze: parse(freezeKey), ui: parse(uiKey), consent: localStorage.getItem(consentKey) };
      const themeResult = window.__repforgeUi?.setTheme?.("dark");
      const consentResult = window.RepForgeTelemetry?.setEnabled?.(false);
      const after = { freeze: parse(freezeKey), ui: parse(uiKey), consent: localStorage.getItem(consentKey) };
      return { before, after, themeResult, consentResult };
    }, { freezeKey: FREEZE_KEY, uiKey: UI_KEY, consentKey: CONSENT_KEY });
    await dialog.dismiss();
    const result = await importPromise;
    const frozen = observed.before?.freeze && observed.before.freeze.owner;
    const writesBlocked = sameValue(observed.before?.ui, observed.after?.ui) &&
      observed.before?.consent === observed.after?.consent;
    check(!!frozen && writesBlocked,
      "P4c-H: a sibling tab cannot mutate UI preferences or telemetry consent while import owns the freeze",
      { observed, result });
  } finally {
    await context.close();
  }
}

async function runP4cForeignFreezeDraftBoundary(browser) {
  console.log("\nPlan 053-P4c L foreign transfer freeze blocks DraftV2 create and clear");
  const { context, page } = await openFreshContext(browser);
  const freeze = { version: 1, owner: "foreign-c4-draft-boundary", createdAt: "2026-10-10T09:00:00.000Z" };
  const readDraftBytes = () => page.evaluate(({ draftKey, checkpointKey }) => ({
    draft: localStorage.getItem(draftKey),
    checkpoint: localStorage.getItem(checkpointKey),
  }), { draftKey: DRAFT_KEY, checkpointKey: CHECKPOINT_KEY });
  const sameDraftBytes = (before, after) => before.draft === after.draft && before.checkpoint === after.checkpoint;
  try {
    const activation = await activateProgram(page);
    if (!activation.ok) throw new Error(`L fixture activation failed: ${activation.code || "unknown"}`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await page.evaluate(({ draftKey, checkpointKey }) => {
      localStorage.removeItem(draftKey);
      localStorage.removeItem(checkpointKey);
    }, { draftKey: DRAFT_KEY, checkpointKey: CHECKPOINT_KEY });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });

    const beforeCreate = await readDraftBytes();
    await page.evaluate(({ freezeKey, value }) => localStorage.setItem(freezeKey, JSON.stringify(value)),
      { freezeKey: FREEZE_KEY, value: freeze });
    let createResult;
    try { createResult = await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false })); }
    catch (error) { createResult = { thrown: error.message }; }
    const afterCreate = await readDraftBytes();

    await page.evaluate((freezeKey) => localStorage.removeItem(freezeKey), FREEZE_KEY);
    const clearFixture = await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false }));
    if (clearFixture !== true) throw new Error(`L clear fixture creation failed: ${JSON.stringify(clearFixture)}`);
    await flush(page);
    const beforeClear = await readDraftBytes();
    if (typeof beforeClear.draft !== "string" || typeof beforeClear.checkpoint !== "string") {
      throw new Error("L clear fixture did not produce canonical DraftV2/checkpoint bytes");
    }
    await page.evaluate(({ freezeKey, value }) => localStorage.setItem(freezeKey, JSON.stringify(value)),
      { freezeKey: FREEZE_KEY, value: freeze });
    let clearResult;
    try { clearResult = await page.evaluate(() => window.__repforgeWorkoutDraft.clear()); }
    catch (error) { clearResult = { thrown: error.message }; }
    const afterClear = await readDraftBytes();
    const createUnchanged = sameDraftBytes(beforeCreate, afterCreate);
    const clearUnchanged = sameDraftBytes(beforeClear, afterClear);
    check(createResult === false && createUnchanged && clearResult === false && clearUnchanged,
      "P4c-L: a foreign transfer freeze blocks production DraftV2 create/enter and clear without changing canonical bytes",
      {
        create: { result: createResult, unchanged: createUnchanged,
          beforeLengths: [beforeCreate.draft?.length || 0, beforeCreate.checkpoint?.length || 0],
          afterLengths: [afterCreate.draft?.length || 0, afterCreate.checkpoint?.length || 0] },
        clear: { result: clearResult, unchanged: clearUnchanged,
          beforeLengths: [beforeClear.draft?.length || 0, beforeClear.checkpoint?.length || 0],
          afterLengths: [afterClear.draft?.length || 0, afterClear.checkpoint?.length || 0] },
      });
  } finally {
    await page.evaluate((freezeKey) => localStorage.removeItem(freezeKey), FREEZE_KEY).catch(() => {});
    await context.close();
  }
}

async function runP4cMalformedMarkerPreTelemetryBoundary(browser) {
  console.log("\nPlan 053-P4c N malformed import marker blocks PostHog and app boot before identity minting");
  const context = await browser.newContext({ serviceWorkers: "block" });
  const sdkRequests = [];
  await context.route(`**${POSTHOG_SDK_PATH}`, async (route) => {
    sdkRequests.push(true);
    await route.fulfill({ status: 200, contentType: "application/javascript", body: POSTHOG_SDK_FIXTURE });
  });
  await context.addInitScript(({ markerKey, identityKey, consentKey }) => {
    localStorage.setItem(markerKey, "{malformed-import-marker");
    localStorage.removeItem(identityKey);
    localStorage.removeItem(consentKey);
    window.__p4cTelemetryBootCalls = [];
    let telemetry;
    Object.defineProperty(window, "RepForgeTelemetry", {
      configurable: true,
      get: () => telemetry,
      set: (next) => {
        if (!next || typeof next.boot !== "function") {
          telemetry = next;
          return;
        }
        const originalBoot = next.boot;
        telemetry = { ...next, boot(...args) {
          window.__p4cTelemetryBootCalls.push({ argCount: args.length });
          return Reflect.apply(originalBoot, next, args);
        } };
      },
    });
    window.__POSTHOG_CONFIG__ = {
      appVersion: "c4-malformed-marker",
      host: location.origin,
      projectToken: "fixture-project-token",
      releaseChannel: "preview",
      sdkVersion: "1.400.0",
    };
  }, { markerKey: INSTALL_MARKER_KEY, identityKey: IDENTITY_KEY, consentKey: CONSENT_KEY });
  const page = await context.newPage();
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    let failedClosed = true;
    try {
      await page.waitForFunction(() => !!window.__repforgeBootFailure, undefined, { timeout: 10000 });
    } catch { failedClosed = false; }
    const observed = await page.evaluate(({ markerKey, identityKey, consentKey }) => ({
      failureCode: window.__repforgeBootFailure?.code || null,
      booted: window.__repforgeBooted === true,
      telemetryBootCalls: window.__p4cTelemetryBootCalls?.length || 0,
      posthogInitCalls: window.__p4cPosthogInitCalls || 0,
      posthogConfigObserved: window.__p4cPosthogConfig || null,
      identityRaw: localStorage.getItem(identityKey),
      consentRaw: localStorage.getItem(consentKey),
      markerRaw: localStorage.getItem(markerKey),
    }), { markerKey: INSTALL_MARKER_KEY, identityKey: IDENTITY_KEY, consentKey: CONSENT_KEY });
    check(failedClosed && observed.failureCode && !observed.booted && observed.telemetryBootCalls === 0 &&
      observed.posthogInitCalls === 0 && observed.posthogConfigObserved === null &&
      observed.identityRaw === null && observed.consentRaw === null &&
      observed.markerRaw === "{malformed-import-marker" && sdkRequests.length === 0,
    "P4c-N: malformed import-marker recovery stops before PostHog/app boot, identity or consent mutation, and client initialization",
    { failedClosed, failureCode: observed.failureCode, booted: observed.booted,
      telemetryBootCalls: observed.telemetryBootCalls, posthogInitCalls: observed.posthogInitCalls,
      posthogConfigObserved: observed.posthogConfigObserved, identityPresent: observed.identityRaw !== null,
      consentPresent: observed.consentRaw !== null, markerPreserved: observed.markerRaw === "{malformed-import-marker",
      sdkRequests: sdkRequests.length });
  } finally {
    await context.close();
  }
}

async function runP4cDirectSeamRequiresClaim(browser, envelope) {
  console.log("\nPlan 053-P4c I direct/preboot import requires a real claimed credential");
  const { context, page } = await openFreshContext(browser);
  const network = [];
  const onRequest = (request) => network.push({ method: request.method(), url: request.url() });
  page.on("request", onRequest);
  try {
    const before = await readStorageBytes(page);
    let result;
    try {
      result = await page.evaluate(async (value) => {
        try { return await window.__repforgeInstallTransferImport(value); }
        catch (error) { return { thrown: error.message }; }
      }, envelope);
    } catch (error) { result = { thrown: error.message }; }
    const after = await readStorageBytes(page);
    const localMarker = parseMarker(await page.evaluate((key) => localStorage.getItem(key), INSTALL_MARKER_KEY));
    const idbMarker = await readIdbValue(page, INSTALL_MARKER_KEY);
    const transferRequests = network.filter((request) => request.method !== "GET" && /\/v1\/transfers\//.test(request.url()));
    check(result?.ok === false && sameValue(before.local, after.local) && sameValue(before.idb, after.idb) &&
      localMarker === null && idbMarker === null && transferRequests.length === 0,
    "P4c-I: the production-exposed direct import seam cannot mint a digest or import without cookie/client claim credentials",
    { result, unchanged: sameValue(before.local, after.local) && sameValue(before.idb, after.idb), localMarker, idbMarker, transferRequests });
  } finally {
    page.off("request", onRequest);
    await context.close();
  }
}

async function runP4cRemoteDeletionClearsMirrors(browser, envelope) {
  console.log("\nPlan 053-P4c K acknowledged remote deletion clears both import-marker replicas");
  const events = [];
  const { context, page, removeRoutes } = await openStandaloneTransferPage(browser, envelope, events);
  try {
    const commit = events.find((event) => event.kind === "commit");
    const localMarker = parseMarker(await page.evaluate((key) => localStorage.getItem(key), INSTALL_MARKER_KEY));
    const idbMarker = await readIdbValue(page, INSTALL_MARKER_KEY);
    const finalInbound = parseMarker(await page.evaluate((key) => localStorage.getItem(key), INBOUND_MARKER_KEY));
    check(commit?.status === 200 && commit.markerAtRequest?.phase === "local-committed" &&
      commit.inboundAtRequest?.phase === "local-committed" && localMarker === null && idbMarker === null,
    "P4c-K: acknowledged remote deletion clears the full import marker from localStorage and IndexedDB",
    { commitStatus: commit?.status || null, markerAtRequestPhase: commit?.markerAtRequest?.phase || null,
      inboundAtRequestPhase: commit?.inboundAtRequest?.phase || null,
      localMarkerPhase: localMarker?.phase || null, idbMarkerPhase: idbMarker?.phase || null,
      claimCount: events.filter((event) => event.kind === "claim").length,
      commitCount: events.filter((event) => event.kind === "commit").length });
    check(finalInbound === null,
      "P4c-M: acknowledged remote deletion also clears the inbound credential marker",
      { finalInboundPhase: finalInbound?.phase || null, finalInboundPresent: finalInbound !== null });
  } finally {
    await removeRoutes();
    await context.close();
  }
}

async function runP4cMarkerRecoveryBeforeHealing(browser, envelope) {
  console.log("\nPlan 053-P4c G import-marker recovery precedes ordinary replica healing");
  const { context, page } = await openFreshContext(browser);
  try {
    await setImportFault(page, { point: "after-local-committed" });
    try { await importInto(page, envelope); } catch {}
    await removeImportFault(page);
    const committedMarker = parseMarker(await page.evaluate((key) => localStorage.getItem(key), INSTALL_MARKER_KEY));
    if (!committedMarker || committedMarker.phase !== "local-committed") {
      throw new Error(`G fixture did not produce a complete local-committed clone: ${JSON.stringify(committedMarker)}`);
    }
    await page.evaluate(async ({ markerKey, inboundKey, marker, dbName, storeName }) => {
      const importing = { ...marker, phase: "importing" };
      localStorage.setItem(markerKey, JSON.stringify(importing));
      localStorage.removeItem(inboundKey);
      await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.close();
            reject(new Error("G fixture IndexedDB store unavailable"));
            return;
          }
          const put = db.transaction(storeName, "readwrite").objectStore(storeName).put(importing, markerKey);
          put.onsuccess = () => { db.close(); resolve(); };
          put.onerror = () => { db.close(); reject(put.error); };
        };
      });
    }, { markerKey: INSTALL_MARKER_KEY, inboundKey: INBOUND_MARKER_KEY, marker: committedMarker,
      dbName: DB_NAME, storeName: STORE_NAME });
    await deleteIdbValue(page, STATE_KEY);
    await page.addInitScript(({ stateKey, markerKey }) => {
      const events = [];
      const phase = () => {
        try {
          const raw = localStorage.getItem(markerKey);
          return raw === null ? null : JSON.parse(raw)?.phase || null;
        } catch { return "invalid"; }
      };
      const markerPhase = (value) => {
        if (typeof value === "string") {
          try { return JSON.parse(value)?.phase || null; } catch { return "invalid"; }
        }
        return value && typeof value === "object" ? value.phase || null : null;
      };
      const record = (kind, key, value) => {
        let observedPhase = phase();
        if (key === markerKey) observedPhase = markerPhase(value);
        events.push({ kind, key: String(key), markerPhase: observedPhase });
      };
      try {
        const originalSet = Storage.prototype.setItem;
        Storage.prototype.setItem = function setItem(key, value) {
          if (key === stateKey || key === markerKey) record("local-write", key, value);
          return originalSet.call(this, key, value);
        };
      } catch {}
      try {
        const originalPut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function put(value, key) {
          if (key === stateKey || key === markerKey) record("idb-put", key, value);
          return originalPut.call(this, value, key);
        };
      } catch {}
      window.__p4cReplicaOrder = events;
    }, { stateKey: STATE_KEY, markerKey: INSTALL_MARKER_KEY });
    const firstBoot = await reloadAndObserveBoot(page);
    const afterEvents = await page.evaluate(() => window.__p4cReplicaOrder || []);
    const markerAfterCrash = parseMarker(await page.evaluate((key) => localStorage.getItem(key), INSTALL_MARKER_KEY));
    const idbMarkerAfterCrash = await readIdbValue(page, INSTALL_MARKER_KEY);
    const stateWriteIndex = afterEvents.findIndex((event) => event.key === STATE_KEY);
    const markerPromotionIndex = afterEvents.findIndex((event) =>
      event.key === INSTALL_MARKER_KEY && event.markerPhase === "local-committed");
    check(firstBoot.booted && markerPromotionIndex >= 0 && stateWriteIndex >= 0 &&
      markerPromotionIndex < stateWriteIndex &&
      markerAfterCrash?.phase === "local-committed" && idbMarkerAfterCrash?.phase === "local-committed",
    "P4c-G: marker recovery completes before ordinary replica healing when one replica is incomplete",
    { firstBoot, events: afterEvents, markerAfterCrash, idbMarkerAfterCrash, stateWriteIndex, markerPromotionIndex });
  } finally {
    await context.close();
  }
}

async function main() {
  console.log("Plan 053-P4a/P4b: production-backed install-transfer import oracle");
  console.log("Effective settings: model=native gpt-5.6-luna; reasoning_effort=max; fork_turns=none; service omitted");
  await assertServingApp(BASE);

  const browser = await launchChromium();
  let sourceContext;
  let destinationContext;
  let refusalContext;
  try {
    sourceContext = await browser.newContext();
    const source = await sourceContext.newPage();
    source.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    await source.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(source, { base: BASE });
    await clearProfile(source);
    await source.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(source, { base: BASE });

    const activation = await activateProgram(source);
    check(activation.ok, "source program is activated through production compiler/finalization", activation);
    if (!activation.ok) throw new Error(JSON.stringify(activation));
    await source.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(source, { base: BASE });

    const custom = await addCustomExercise(source);
    check(custom?.result?.localOk || custom?.result?.idbOk, "custom exercise is saved through the production custom-exercise API", custom);
    await saveWorkout(source);
    const transition = await commitSibling(source);
    check(transition.ok, "Plan 052 successor is committed through the production transition adapter", transition);
    if (!transition.ok) throw new Error(JSON.stringify(transition));
    await source.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(source, { base: BASE });

    const recovery = await commitRecovery(source);
    check(recovery.ok, "Plan 052 recovery carrier record is committed through the production adapter", recovery);
    if (!recovery.ok) throw new Error(JSON.stringify(recovery));
    await source.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(source, { base: BASE });

    const draft = await createAcknowledgedDraft(source);
    check(draft.ok && draft.logical?.schemaVersion === 2 && draft.checkpoint?.value?.kind === "committed",
      "source creates an acknowledged DraftV2 through the production browser seam", draft);
    if (!draft.ok) throw new Error(JSON.stringify(draft));
    const candidate = await createCandidate(source);
    check(candidate.ok && candidate.candidate?.schemaVersion === 1,
      "source persists a current program-entry candidate through __repforgePersistSetupDraft", candidate);
    if (!candidate.ok) throw new Error(JSON.stringify(candidate));
    const device = await setDeviceSections(source);
    check(device.consent === false && device.identityBefore === device.identityAfter && device.prefs?.theme === "dark",
      "source sets non-default UI preference, disabled consent, and preserves stable identity", device);
    await flush(source);

    const sourceObservation = await readLogical(source);
    const envelope = await buildEnvelope(sourceObservation);
    if (!envelope) throw new Error("P3 envelope build was unavailable");
    assertEnvelopeSourceFields(envelope);
    check(sameValue(envelope.workoutDraft, sourceObservation.draft.logical), "envelope DraftV2 equals the real production logical clone");
    check(sameValue(envelope.programEntryDraft, sourceObservation.candidate), "envelope candidate equals the production persisted candidate");

    await runPreBootImportCase(browser, envelope);

    destinationContext = await browser.newContext();
    const destination = await destinationContext.newPage();
    destination.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    await destination.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(destination, { base: BASE });
    await clearProfile(destination);
    await destination.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(destination, { base: BASE });

    const importHook = await destination.evaluate(() => typeof window.__repforgeInstallTransferImport === "function");
    if (!check(importHook, "destination exposes window.__repforgeInstallTransferImport")) {
      console.error("    Blocked before destination mutation: the production import/resume consumer is not present on this head.");
    } else {
      const imported = await importInto(destination, envelope);
      check(imported?.ok !== false, "fresh destination accepts the production import result", imported);
      const beforeReload = await readLogical(destination);
      const beforeReloadIdb = await readIdb(destination);
      assertImportedLogical(beforeReload, beforeReloadIdb, envelope, "fresh destination");

      await destination.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(destination, { base: BASE });
      await flush(destination);
      const afterReload = await readLogical(destination);
      const afterReloadIdb = await readIdb(destination);
      assertImportedLogical(afterReload, afterReloadIdb, envelope, "after reload");

      refusalContext = await browser.newContext();
      const refusal = await refusalContext.newPage();
      refusal.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
      await refusal.goto(BASE, { waitUntil: "domcontentloaded" });
      await waitForAppBoot(refusal, { base: BASE });
      await clearProfile(refusal);
      await refusal.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(refusal, { base: BASE });
      const refusalActivation = await activateProgram(refusal);
      check(refusalActivation.ok, "meaningful destination has real production state before import", refusalActivation);
      const refusalBefore = await readStorageBytes(refusal);
      let refusalResult;
      try {
        refusalResult = await importInto(refusal, envelope);
      } catch (error) {
        refusalResult = { thrown: error.message };
      }
      const refusalAfter = await readStorageBytes(refusal);
      check(refusalResult?.ok === false, "meaningful destination refuses before mutation", refusalResult);
      check(sameValue(refusalAfter.local, refusalBefore.local) && sameValue(refusalAfter.idb, refusalBefore.idb),
        "meaningful-destination refusal leaves storage bytes/logical state unchanged");
      await refusal.close();
      await runFaultMatrix(browser, envelope);
      await runMeaningfulDestinationMatrix(browser, envelope);
      if (false) await runP4cStandaloneClaimCommit(browser, envelope);
      if (false) await runP4cConcurrentImport(browser, envelope);
      if (false) await runP4cMarkerContract(browser, envelope);
      if (false) await runP4cSettingsOnlyDestination(browser, envelope);
      if (false) await runP4cCommittedMutationRecovery(browser, envelope);
      if (false) await runP4cPostMarkerBootOrdering(browser, envelope);
      if (false) await runP4cMarkerRecoveryBeforeHealing(browser, envelope);
      if (false) await runP4cSiblingFreezeBoundary(browser, envelope);
      if (false) await runP4cForeignFreezeDraftBoundary(browser);
      if (false) await runP4cDirectSeamRequiresClaim(browser, envelope);
      if (false) await runP4cRollbackPhasePersistence(browser, envelope);
      if (false) await runP4cRemoteDeletionClearsMirrors(browser, envelope);
      if (false) await runP4cMalformedMarkerPreTelemetryBoundary(browser);
    }
  } finally {
    await refusalContext?.close().catch(() => {});
    await destinationContext?.close().catch(() => {});
    await sourceContext?.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  console.log(`\nResult: ${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.error("Current blocker: one or more atomic import/recovery contracts failed; no production code was added by this oracle.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Test error:", error.stack || error);
  process.exitCode = 1;
});
