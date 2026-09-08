#!/usr/bin/env node
/**
 * Plan 053 P1a characterization gate.
 *
 * This file deliberately consumes the live app through its browser seams. It
 * does not scrape app.js or recreate the app's state/draft normalizers. The
 * future transfer producer can use the recorded observations as its contract;
 * this test does not pretend that producer exists yet.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { clonePayloadHashOf } from "../tools/canonical-clone-hash.mjs";
import { launchChromium, assertServingApp, waitForAppBoot } from "./browser.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.REPFORGE_URL || "http://localhost:8053/";
const ARTIFACT_DIR = process.env.REPFORGE_ARTIFACT_DIR || "/tmp/plan053-p1a";
const REPORT_PATH = join(ARTIFACT_DIR, "install-transfer-clone-report.json");
const STATE_KEY = "repforge_v1";
const UI_KEY = "repforge_ui_v1";
const TELEMETRY_ENABLED_KEY = "repforge_telemetry_enabled_v1";
const TELEMETRY_IDENTITY_KEY = "repforge_telemetry_identity_v1";
const DRAFT_KEY = "repforge_draft_v1";
const CHECKPOINT_KEY = `${DRAFT_KEY}:v2-checkpoint`;
const EXPECTATIONS = JSON.parse(readFileSync(join(ROOT, "test/fixtures/install-transfer-characterization/expectations.json"), "utf8"));
const CANONICAL_FIXTURE = JSON.parse(readFileSync(join(ROOT, "test/fixtures/install-transfer-clone-v1.json"), "utf8"));

const results = { passed: 0, failed: 0, assertions: [] };
let failure = null;

function assert(condition, name, detail = "") {
  const row = { name, ok: Boolean(condition) };
  if (detail) row.detail = String(detail).slice(0, 500);
  results.assertions.push(row);
  if (condition) {
    results.passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed += 1;
    console.log(`  ✗ ${name}`);
    if (detail) console.log(`    ${String(detail).slice(0, 500)}`);
  }
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

// Independent oracle. This serializer is intentionally separate from the
// production canonical-hash-core implementation and from the hash helper.
function oracleCanonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(oracleCanonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${oracleCanonicalJson(value[key])}`).join(",")}}`;
}

function independentCloneHash(envelope) {
  const preimage = clone(envelope);
  if (preimage.integrity) delete preimage.integrity.canonicalPayloadHash;
  return createHash("sha256").update(oracleCanonicalJson(preimage), "utf8").digest("hex");
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function validateCanonicalHashContract() {
  const expected = CANONICAL_FIXTURE.integrity.canonicalPayloadHash;
  const independent = independentCloneHash(CANONICAL_FIXTURE);
  assert(independent === expected, "canonical fixture matches independent sorted-key SHA-256", `${independent} != ${expected}`);
  assert(clonePayloadHashOf(CANONICAL_FIXTURE) === independent, "existing canonical hash helper agrees with independent oracle");

  const scalar = clone(CANONICAL_FIXTURE);
  scalar.sourceRevision += 1;
  assert(independentCloneHash(scalar) !== expected, "canonical hash changes when a scalar logical field changes");

  const ordered = clone(CANONICAL_FIXTURE);
  ordered.durableState.program.reverse();
  assert(independentCloneHash(ordered) !== expected, "canonical hash changes when array order changes");

  const selfField = clone(CANONICAL_FIXTURE);
  selfField.integrity.canonicalPayloadHash = "0".repeat(64);
  assert(independentCloneHash(selfField) === expected, "canonical hash excludes only its integrity self-field");

  const frozen = clone(CANONICAL_FIXTURE);
  const snapshot = JSON.stringify(frozen);
  clonePayloadHashOf(deepFreeze(frozen));
  assert(JSON.stringify(frozen) === snapshot, "canonical hash helper accepts frozen input without mutation");
}

function characterizationState() {
  const state = clone(CANONICAL_FIXTURE.durableState);
  // The fixture itself has no archived program. Add one through the seed path
  // so the real app producer exercises history and its structure migration.
  state.programHistory = [{
    id: "history-seed-01",
    archivedAt: "2026-09-01T08:00:00.000Z",
    programMeta: { ...clone(state.programMeta), id: "pm_history01", name: "Archived Muscle" },
    program: [clone(state.program[0])],
  }];
  state._storageRevision = 17;
  state._storageFollowUp = { kind: "characterization-follow-up", once: true };
  state._storageSetupActivation = {
    version: 1,
    programId: state.programMeta.id,
    raw: "characterization-setup-proposal",
  };
  return state;
}

async function idbWrite(page, value) {
  await page.evaluate(async ({ key, value }) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("kv")) request.result.createObjectStore("kv");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { key: STATE_KEY, value });
}

async function clearAllStorage(page) {
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase("repforge");
      request.onsuccess = request.onerror = request.onblocked = resolve;
    });
    for (const registration of await navigator.serviceWorker?.getRegistrations?.() || []) await registration.unregister();
  });
}

async function seed(page, state) {
  await page.evaluate(({ state, ui, identity }) => {
    localStorage.setItem("repforge_v1", JSON.stringify(state));
    localStorage.setItem("repforge_ui_v1", JSON.stringify(ui));
    localStorage.setItem("repforge_telemetry_enabled_v1", "true");
    localStorage.setItem("repforge_telemetry_identity_v1", JSON.stringify(identity));
    // These keys are deliberately outside the semantic state and must not be
    // mistaken for clone input by a future producer.
    localStorage.setItem("repforge_pending_v1:characterization", "journal-only");
    localStorage.setItem("repforge_draft_v1:recovery", "recovery-only");
  }, {
    state,
    ui: { theme: EXPECTATIONS.uiPreferences.theme, installBannerDismissedAt: "2026-09-08T18:00:00.000Z" },
    identity: EXPECTATIONS.telemetryIdentity,
  });
  await idbWrite(page, state);
}

async function appState(page) {
  return page.evaluate(() => window.__repforgeWorkoutDraft?.state?.() || null);
}

async function draftObservation(page) {
  return page.evaluate(async () => {
    const hook = window.__repforgeWorkoutDraft;
    await hook.flush();
    const current = hook.current();
    return {
      current,
      logical: current && window.RepForgeWorkoutDraft?.logicalCloneSection?.(current),
      raw: hook.raw(),
      checkpoint: hook.checkpoint(),
      read: hook.read(),
    };
  });
}

async function downloadBackup(page) {
  await page.evaluate(() => document.querySelector("#openSettings")?.click());
  await page.waitForSelector("#settings.active", { timeout: 5000 });
  await page.locator("#dataBackupRow").click();
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 10000 }),
    page.locator("#exportJson").click(),
  ]);
  return JSON.parse(readFileSync(await download.path(), "utf8"));
}

async function enterAndEditDraft(page) {
  // The backup flow leaves the Settings view open. Return through the real
  // bottom navigation before entering the workout; enterWorkout is a log
  // surface action and deliberately does not mutate Settings view state.
  await page.evaluate(() => document.querySelector('nav button[data-view="log"]')?.click());
  await page.waitForTimeout(40);
  const entered = await page.evaluate(async () => window.__repforgeEnterWorkout({ focus: false }));
  if (!entered) {
    const diagnostic = await page.evaluate(() => ({
      body: document.body.className,
      shell: document.querySelector("#workoutShell")?.className || null,
      current: window.__repforgeWorkoutDraft?.current?.() || null,
      read: window.__repforgeWorkoutDraft?.read?.() || null,
      checkpoint: window.__repforgeWorkoutDraft?.checkpoint?.() || null,
      recovery: window.__repforgeWorkoutDraft?.recovery?.() || null,
    }));
    throw new Error(`real enterWorkout failed: ${JSON.stringify(diagnostic).slice(0, 3000)}`);
  }
  // setWorkoutActive adds a short enter animation whose first frame is
  // intentionally hidden to the browser. The state change is the contract;
  // wait for attachment, then let Playwright wait for the fields to become
  // actionable below.
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 8000 });
  const load = page.locator("#workout [data-k$='_load']").first();
  const reps = page.locator("#workout [data-k$='_reps']").first();
  const rir = page.locator("#workout [data-k$='_rir']").first();
  await load.fill("123");
  if (await reps.count()) await reps.fill("10");
  if (await rir.count()) await rir.fill("2");
  await page.locator("#workout .saveset").first().click();
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

async function saveWorkoutAndReload(page) {
  await page.locator("#logForm").evaluate((form) => form.requestSubmit());
  await page.waitForSelector("#sessionSummary:not(.hidden)", { timeout: 10000 });
  await page.locator("#sumDone").click();
  await page.waitForSelector("#workoutShell.hidden", { state: "attached", timeout: 8000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
}

async function removeDraftArtifacts(page) {
  await page.evaluate(({ draftKey, checkpointKey }) => {
    for (const key of Object.keys(localStorage)) {
      if (key === draftKey || key.startsWith(`${draftKey}:`)) localStorage.removeItem(key);
    }
    localStorage.removeItem(checkpointKey);
  }, { draftKey: DRAFT_KEY, checkpointKey: CHECKPOINT_KEY });
}

async function runBrowserCharacterization() {
  await assertServingApp(BASE);
  const browser = await launchChromium();
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await clearAllStorage(page);

    const rawState = characterizationState();
    await seed(page, rawState);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });

    const normalized = await appState(page);
    assert(normalized?.programMeta?.id === EXPECTATIONS.durableState.programMetaId, "live app producer exposes normalized durable program state", normalized?.programMeta?.id);
    assert(normalized?.programMeta?.name === EXPECTATIONS.durableState.programMetaName, "live normalized producer retains the program identity");
    assert(Array.isArray(normalized?.log) && normalized.log.some((row) => row.session === EXPECTATIONS.durableState.logSession), "live normalized producer retains workout log rows");
    assert(Array.isArray(normalized?.programHistory) && normalized.programHistory.length >= EXPECTATIONS.durableState.minimumHistoryEntries, "live normalized producer retains program history");
    assert(Array.isArray(normalized?.customExercises) && normalized.customExercises.some((entry) => entry.id === EXPECTATIONS.durableState.customExerciseId), "live normalized producer retains custom definitions");

    const backup = await downloadBackup(page);
    assert(EXPECTATIONS.volatileDurableKeys.every((key) => !(key in backup)), "production backup producer excludes volatile durable metadata", JSON.stringify(Object.keys(backup)));
    assert(!("workoutDraft" in backup) && !JSON.stringify(backup).includes("journal-only") && !JSON.stringify(backup).includes("recovery-only"), "production backup excludes active draft and volatile sidecars");
    assert(backup.programMeta?.id === EXPECTATIONS.durableState.programMetaId && backup.programMeta?.name === EXPECTATIONS.durableState.programMetaName, "normalized backup retains program metadata");
    assert(backup.log?.some((row) => row.session === EXPECTATIONS.durableState.logSession), "normalized backup retains log data");
    assert(backup.programHistory?.length >= EXPECTATIONS.durableState.minimumHistoryEntries, "normalized backup retains history data");
    assert(backup.customExercises?.some((entry) => entry.id === EXPECTATIONS.durableState.customExerciseId), "normalized backup retains custom exercise data");

    const uiPreferences = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null"), UI_KEY);
    const analyticsEnabled = await page.evaluate((key) => localStorage.getItem(key) === "true", TELEMETRY_ENABLED_KEY);
    const telemetryIdentity = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null"), TELEMETRY_IDENTITY_KEY);
    assert(uiPreferences?.theme === EXPECTATIONS.uiPreferences.theme, "device UI preference remains available as a separate clone section");
    assert(analyticsEnabled === EXPECTATIONS.analytics.enabled, "analytics consent remains available as a separate clone section");
    assert(same(telemetryIdentity, EXPECTATIONS.telemetryIdentity), "stable telemetry identity remains available without regeneration");

    await enterAndEditDraft(page);
    const beforeReload = await draftObservation(page);
    assert(beforeReload.current?.schemaVersion === 2, "real app creates an active DraftV2 through the browser path");
    assert(beforeReload.checkpoint.status === "valid" && beforeReload.checkpoint.value.kind === "committed", "draft checkpoint acknowledges the active aggregate");
    assert(beforeReload.read.status === "ok" && beforeReload.read.raw === beforeReload.raw && beforeReload.raw != null, "draft read agrees with the acknowledged canonical raw value");
    assert(beforeReload.logical && EXPECTATIONS.draftLogicalKeys.every((key) => key in beforeReload.logical), "DraftV2 logical clone section contains all required logical fields");
    assert(!("writer" in beforeReload.logical) && !("revision" in beforeReload.logical) && !("durableRevision" in (beforeReload.logical.program || {})), "DraftV2 logical producer strips operational identity and revision fields");

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const afterReload = await draftObservation(page);
    assert(afterReload.current?.schemaVersion === 2, "real DraftV2 loads after a page reload");
    assert(same(afterReload.logical, beforeReload.logical), "real DraftV2 logical value survives save/load/reload byte-equivalently");
    assert(afterReload.checkpoint.status === "valid" && afterReload.checkpoint.value.kind === "committed" && afterReload.checkpoint.value.raw === afterReload.read.raw, "reloaded draft remains acknowledged by checkpoint and read APIs");

    const logBeforeSave = (await appState(page))?.log?.length || 0;
    await saveWorkoutAndReload(page);
    const afterWorkoutSave = await appState(page);
    const savedRow = afterWorkoutSave?.log?.find((row) => Number(row.load) === 123 && Number(row.reps) === 10);
    assert((afterWorkoutSave?.log?.length || 0) > logBeforeSave, "real Finish workout persists a new log row");
    assert(!!savedRow, "real saved workout retains edited load and reps");
    const afterWorkoutSaveDraft = await draftObservation(page);
    assert(afterWorkoutSaveDraft.current === null && afterWorkoutSaveDraft.read.status === "ok" && afterWorkoutSaveDraft.read.raw === null, "real saved workout removes the active draft from the live read path");

    await removeDraftArtifacts(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const absent = await draftObservation(page);
    assert(absent.current === null, "confirmed draft absence returns current() === null");
    assert(absent.read.status === "ok" && absent.read.raw === null, "confirmed draft absence is an acknowledged empty canonical read");
    assert(absent.checkpoint.status === "absent", "confirmed draft absence has no V2 checkpoint");

    await enterAndEditDraft(page);
    const trusted = await draftObservation(page);
    assert(trusted.current?.schemaVersion === 2 && trusted.raw != null, "untrustworthy-draft case starts from a real acknowledged DraftV2");
    await page.evaluate((key) => localStorage.setItem(key, "{malformed-checkpoint"), CHECKPOINT_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const untrustworthy = await draftObservation(page);
    assert(untrustworthy.current === null, "untrustworthy active draft is not exposed as current state");
    assert(untrustworthy.read.status === "ok" && untrustworthy.read.raw != null, "untrustworthy active draft retains a non-null raw signal for recovery");
    assert(untrustworthy.checkpoint.status === "read-failed" || untrustworthy.checkpoint.status === "invalid", "untrustworthy active draft reports checkpoint failure");
    assert(!(untrustworthy.read.raw === null && untrustworthy.checkpoint.status === "absent"), "untrustworthy active draft is not silently classified as confirmed absence");

    // Construct a characterization-only envelope from real producers. This is
    // deliberately not exported as the canonical fixture: install-transfer.js
    // does not exist yet, and the future module owns that API boundary.
    const sourceRevision = Number(normalized?._storageRevision) || 0;
    const observedEnvelope = {
      kind: "taurifer-install-transfer",
      schemaVersion: 1,
      createdAt: "2026-09-08T19:00:00.000Z",
      source: { context: "browser", logicalInstallationId: telemetryIdentity.installationId },
      sourceRevision,
      durableState: backup,
      workoutDraft: beforeReload.logical,
      programEntryDraft: null,
      uiPreferences,
      analytics: { enabled: analyticsEnabled },
      telemetryIdentity,
      integrity: { canonicalPayloadHash: "" },
    };
    observedEnvelope.integrity.canonicalPayloadHash = independentCloneHash(observedEnvelope);
    assert(clonePayloadHashOf(observedEnvelope) === observedEnvelope.integrity.canonicalPayloadHash, "characterized envelope hash agrees with existing helper and independent oracle");
    assert(observedEnvelope.workoutDraft && observedEnvelope.uiPreferences && observedEnvelope.analytics && observedEnvelope.telemetryIdentity, "characterized envelope has acknowledged draft and separate device/consent/identity sections");
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  console.log(`Plan 053 P1a install-transfer characterization (${BASE})`);
  validateCanonicalHashContract();
  await runBrowserCharacterization();
}

try {
  await main();
} catch (error) {
  failure = String(error?.stack || error);
  console.error(`FAIL: ${failure}`);
} finally {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  let head = "unknown";
  try { head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(); } catch {}
  writeFileSync(REPORT_PATH, JSON.stringify({
    pid: process.pid,
    serverPid: process.env.REPFORGE_SERVER_PID ? Number(process.env.REPFORGE_SERVER_PID) : null,
    base: BASE,
    head,
    startedAt: new Date(Date.now() - 1).toISOString(),
    finishedAt: new Date().toISOString(),
    passed: results.passed,
    failed: results.failed,
    failure,
    assertions: results.assertions,
  }, null, 2));
  console.log(`report: ${REPORT_PATH} (pid ${process.pid})`);
  if (failure || results.failed) process.exitCode = 1;
}
