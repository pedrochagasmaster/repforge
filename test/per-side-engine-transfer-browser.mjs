#!/usr/bin/env node
/** Plan 069 S3: explicit per-side history survives backup and install transfer. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { launchChromium, openShelfField, waitForAppBoot } from "./browser.mjs";

const require = createRequire(import.meta.url);
const RAW_CATALOG = require("../assets/exercise-catalog.json");
globalThis.RepForgeExerciseCatalog = { snapshot: () => RAW_CATALOG };
const Transfer = require("../install-transfer.js");
const Contract = require("../install-transfer-contract.js");

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const STATE_KEY = "repforge_v1";
const UI_KEY = "repforge_ui_v1";
const CONSENT_KEY = "repforge_telemetry_enabled_v1";
const IDENTITY_KEY = "repforge_telemetry_identity_v1";
const INBOUND_KEY = "repforge_transfer_inbound_v1";
const DB_NAME = "repforge";
const PRESS_ID = "1a05c6f170d8806b911acf558c5af4f6";
const REPS_PER_SIDE_ID = "25a5c6f170d880baaa2dc8c7b67d4b65";
const LOAD_PER_SIDE_ID = "25a5c6f170d880e2990fc88146f7de56";
const PLAN_DATA = new URL("../plans/067/data/", import.meta.url);
const gym = JSON.parse(readFileSync(new URL("gym.json", PLAN_DATA), "utf8"));
const observations = JSON.parse(readFileSync(new URL("programs.json", PLAN_DATA), "utf8"));
const catalog = JSON.parse(readFileSync(new URL("app_file.json", PLAN_DATA), "utf8"));
const observedIds = [...new Set(Object.values(observations).flatMap((program) =>
  program.days.flatMap((day) => day.exercises.map((entry) => entry.exerciseId))))];
const REQUEST = {
  goal: "hypertrophy", experience: "intermediate", daysPerWeek: 4, timeCeilingMinutes: 90,
  gymProfile: { equipmentIds: gym.equipment.map((entry) => entry.equipmentId) },
  competencyAnswers: {
    pullups10: null, pullups5: null, pushups15: null, inclineBarbell10: null,
    overheadPress10: null, bodyweightDips10: null, benchPress10: null,
  },
  movementConfirmations: Object.fromEntries(observedIds.map((id) =>
    [id, [...catalog.exercises.find((entry) => entry.id === id).preconditions]])),
  emphasisMuscleIds: [], deprioritizedMuscleIds: [], excludedExerciseIds: [], excludedMuscleIds: [],
  preferredExerciseIds: [PRESS_ID], split: "auto", periodization: "static", cycles: 7, deloadCycles: [],
};

let passed = 0;
const failures = [];
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 3000)}`);
}

async function seedGeneratedPress(page) {
  return page.evaluate(async ({ request, exerciseId }) => {
    const generated = window.RepForgeProgramCompiler.generateProgram(
      request, window.RepForgeExerciseCatalog.snapshot());
    if (!generated.ok) throw new Error("Production compiler failed: " + JSON.stringify(generated.conflicts));
    // Explicit Review choice keeps this transfer proof independent of ranking.
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const compatible = generated.value.days.filter((day) => day.kind === "training").flatMap((day) => day.slots)
      .find((slot) => slot.metricDefinitions.some((metric) => metric.semantic === "repsPerSide") &&
        slot.metricDefinitions.some((metric) => metric.semantic === "loadPerSideKg"));
    if (!compatible) throw new Error("Generated definition has no compatible per-side slot");
    const reviewed = window.RepForgeProgramReview.applyEdit(generated.value,
      { kind: "swap", slotId: compatible.id, exerciseId },
      { compiler: window.RepForgeProgramCompiler, catalog, metrics: window.RepForgeExerciseMetrics });
    if (!reviewed.ok) throw new Error("The explicit press choice was refused: " + JSON.stringify(reviewed));
    const definition = reviewed.definition;
    const target = definition.days.filter((day) => day.kind === "training").flatMap((day) =>
      day.slots.map((slot) => ({ day, slot }))).find(({ slot }) => slot.id === compatible.id && slot.exerciseId === exerciseId);
    if (!target) throw new Error("The explicit press choice did not retain its slot");
    await window.__repforgeFinalizeProgramSetup({
      programDefinition: definition, name: "Per-side transfer proof", answers: {},
      destination: "log", origin: "first-run", draftConfirmed: true,
      telemetryRoute: "recommend", entrySource: { route: "recommend", fingerprint: "p069-s3-transfer-roundtrip" },
    });
    await window.__repforgeStorage.flush();
    const state = window.__repforgeWorkoutDraft.state();
    return { slot: target.slot, row: state.program.find((entry) => entry.slotId === target.slot.id) };
  }, { request: REQUEST, exerciseId: PRESS_ID });
}

async function selectPress(page, rowId) {
  await page.evaluate((id) => window.__repforgeGoToLogExercise(id), rowId);
  await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 15000 });
  await page.waitForFunction((id) => document.querySelector("#workout .exercise.is-current")?.dataset.ex === id,
    rowId, { timeout: 15000 });
}

async function fillShelf(page, selector, value, shelfField) {
  const input = page.locator(selector);
  await input.waitFor({ state: "attached", timeout: 10000 });
  if (await input.getAttribute("aria-hidden") === "true")
    await openShelfField(page, `#workout .exercise.is-current .focus-shelf [data-shelf-field="${shelfField}"]`);
  await input.fill(String(value));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

async function logFirstPressSet(page, rowId) {
  await page.locator("#sessionSheetBtn").click();
  await page.waitForSelector("#sessionSheet.is-open", { timeout: 5000 });
  await page.locator("#sessionBodyweight").fill("80");
  await page.locator("#sessionBodyweight").dispatchEvent("input");
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.locator("#sessionSheetClose").click();
  await page.waitForSelector("#sessionSheet", { state: "hidden", timeout: 5000 });

  await fillShelf(page,
    `#workout .exercise.is-current .focus-shelf input[data-metric-id="${LOAD_PER_SIDE_ID}"]`, 25,
    `metric_${LOAD_PER_SIDE_ID}`);
  await fillShelf(page,
    `#workout .exercise.is-current .focus-shelf input[data-metric-id="${REPS_PER_SIDE_ID}"]`, 8,
    `metric_${REPS_PER_SIDE_ID}`);
  const rir = page.locator(`#workout .exercise.is-current .focus-shelf input[data-k="${rowId}_1_rir"]`);
  if (await rir.getAttribute("aria-hidden") === "true")
    await page.locator('#workout .exercise.is-current .focus-shelf [data-shelf-field="rir"]').click();
  await rir.fill("2");
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.locator(`#workout .exercise.is-current [data-save="${rowId}_1"]`).click();
  await page.waitForFunction((id) => {
    const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
    const setId = exercise?.setOrder?.find((key) => exercise.sets[key].ordinal === 1);
    return !!exercise?.sets?.[setId]?.completion;
  }, rowId, { timeout: 15000 });
  await page.locator("#sessionSheetBtn").click();
  await page.locator("#sessionEarlyFinish").click();
  await page.locator("#sessionEarlyConfirm").click();
  await page.waitForSelector("#sessionSummary:not(.hidden)", { timeout: 15000 });
  await page.locator("#sumDone").click();
  await page.waitForSelector("#workoutShell.hidden", { state: "hidden", timeout: 10000 });
  await page.evaluate(() => window.__repforgeStorage.flush());
}

async function exportBackup(page) {
  await page.evaluate(() => window.__repforgeShowSettings());
  await page.waitForSelector("#settings.view.active", { timeout: 10000 });
  await page.locator("#dataBackupRow").click();
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 10000 }),
    page.locator("#exportJson").click(),
  ]);
  return JSON.parse(readFileSync(await download.path(), "utf8"));
}

async function observeSource(page) {
  return page.evaluate(async ({ stateKey, uiKey, consentKey, identityKey }) => {
    const draft = window.__repforgeWorkoutDraft;
    await window.__repforgeStorage.flush();
    await draft.flush();
    const current = draft.current();
    return {
      durableState: draft.state(),
      draft: {
        current,
        checkpoint: draft.checkpoint(),
        read: draft.read(),
        logical: current ? window.RepForgeWorkoutDraft.logicalCloneSection(current) : null,
      },
      uiPreferences: window.__repforgeUi.loadUiPrefs() || JSON.parse(localStorage.getItem(uiKey) || "{}"),
      analytics: { enabled: localStorage.getItem(consentKey) !== "false" },
      telemetryIdentity: JSON.parse(localStorage.getItem(identityKey) || "null"),
      stateKeyPresent: localStorage.getItem(stateKey) !== null,
    };
  }, { stateKey: STATE_KEY, uiKey: UI_KEY, consentKey: CONSENT_KEY, identityKey: IDENTITY_KEY });
}

async function buildTransferEnvelope(observation) {
  if (!observation.stateKeyPresent || !observation.telemetryIdentity?.installationId)
    throw new Error("Source durable state or telemetry identity was absent");
  const draft = observation.draft;
  const sections = {
    durableState: { logicalCloneSection: () => structuredClone(observation.durableState) },
    workoutDraft: {
      flush: async () => {}, current: () => structuredClone(draft.current),
      checkpoint: () => structuredClone(draft.checkpoint), read: () => structuredClone(draft.read),
      logicalCloneSection: () => structuredClone(draft.logical),
    },
    programEntryDraft: null,
    uiPreferences: { logicalCloneSection: () => structuredClone(observation.uiPreferences) },
    analytics: { logicalCloneSection: () => structuredClone(observation.analytics) },
    telemetryIdentity: { logicalCloneSection: () => structuredClone(observation.telemetryIdentity) },
  };
  const captured = await Transfer.captureLogicalSnapshot(sections);
  if (!captured.ok) throw new Error(`Production clone capture failed: ${captured.code}`);
  const built = await Transfer.buildEnvelope({
    sections,
    source: {
      context: "browser",
      logicalInstallationId: observation.telemetryIdentity.installationId,
      sourceRevision: Number.isSafeInteger(observation.durableState._storageRevision)
        ? observation.durableState._storageRevision : 0,
    },
    contract: Contract,
    crypto: webcrypto,
    createdAt: "2026-10-12T12:00:00.000Z",
    logicalSnapshot: captured.value,
  });
  if (!built.ok) throw new Error(`Production transfer envelope build failed: ${built.code}`);
  const valid = await Contract.validateEnvelopeIntegrity(built.value, webcrypto);
  if (!valid.ok) throw new Error(`Transfer envelope failed its production contract: ${valid.code}`);
  return built.value;
}

function transferCookieFixture() {
  const segment = Buffer.alloc(32, 7).toString("base64url");
  const token = `v1.k1.${segment}.${segment}.${segment}`;
  return { token, expiresAt: "2099-01-01T00:00:00.000Z" };
}

async function importTransferThroughProduction(page, envelope) {
  const cookie = transferCookieFixture();
  return page.evaluate(async ({ value, token, expiresAt, inboundKey }) => {
    const transfer = window.RepForgeInstallTransfer;
    const contract = window.RepForgeInstallTransferContract;
    const credentials = transfer?.createCredentialVault?.({ crypto: window.crypto, indexedDB: window.indexedDB });
    const cookies = new Map();
    const cookieDocument = {
      get cookie() { return [...cookies].map(([name, value]) => `${name}=${value}`).join("; "); },
      set cookie(serialized) {
        const [pair, ...attributes] = String(serialized).split(";");
        const separator = pair.indexOf("=");
        if (separator < 0) return;
        const name = pair.slice(0, separator).trim();
        const value = pair.slice(separator + 1).trim();
        const maxAge = attributes.find((attribute) => /^\s*Max-Age=/i.test(attribute));
        if (maxAge && /Max-Age=0(?:\s|$)/i.test(maxAge)) cookies.delete(name);
        else cookies.set(name, value);
      },
    };
    const cookieLocation = { href: `${location.origin}/index.html`, origin: location.origin, pathname: "/index.html" };
    const inbound = {
      async read() {
        try { return JSON.parse(localStorage.getItem(inboundKey) || "null"); }
        catch { return { invalid: true }; }
      },
      async write(marker) { localStorage.setItem(inboundKey, JSON.stringify(marker)); },
      async clear() { localStorage.removeItem(inboundKey); },
    };
    const operationLock = { withLock(name, work) {
      return navigator.locks?.request ? navigator.locks.request(name, work) : work();
    } };
    const transport = {
      async request({ path }) {
        if (path !== "/v1/transfers/claims") throw new Error(`unexpected-transfer-path:${path}`);
        return { status: 200, bytes: new TextEncoder().encode(JSON.stringify({ envelope: value, expiresAt })) };
      },
    };
    if (!transfer || !contract || !credentials ||
      !transfer.writeTransferCookie({ token, expiresAt }, { document: cookieDocument, location: cookieLocation }))
      return { ok: false, code: "claim-setup-failed" };
    const client = transfer.createClient({
      contract, crypto: window.crypto, transport, context: "standalone",
      document: cookieDocument, location: cookieLocation,
      storage: { inbound, credentials, operationLock },
    });
    const claim = await client.claim();
    if (!claim?.ok || claim.state !== "validating") return { ok: false, code: claim?.code || "claim-failed", claim };
    const marker = await inbound.read();
    const pair = await credentials.unseal("standalone-inbound", marker?.sealedCredentials);
    if (typeof pair?.claimId !== "string") return { ok: false, code: "claim-id-unavailable" };
    const digestBytes = new Uint8Array(await window.crypto.subtle.digest(
      "SHA-256", new TextEncoder().encode(pair.claimId)));
    const claimIdDigest = [...digestBytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const result = await window.__repforgeInstallTransferImport(value, {
      claimId: pair.claimId, claimIdDigest, credentials,
    });
    await inbound.clear();
    try { await credentials.forget?.("standalone-inbound", marker?.sealedCredentials); } catch {}
    await window.__repforgeStorage?.flush?.();
    await window.__repforgeWorkoutDraft?.flush?.();
    await window.__repforgeOnboarding?.flushDraft?.();
    return result ?? null;
  }, { value: envelope, token: cookie.token, expiresAt: cookie.expiresAt, inboundKey: INBOUND_KEY });
}

async function importBackupThroughUi(page, backup) {
  await page.evaluate(() => window.closeFirstRun?.());
  await page.evaluate(() => window.__repforgeShowSettings());
  await page.waitForSelector("#settings.view.active", { timeout: 10000 });
  await page.locator("#dataImportRow").click();
  await page.locator("#importJson").setInputFiles({
    name: "p069-per-side-backup.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.waitForFunction(() => document.querySelector("#importChoice")?.open === true ||
    !document.querySelector("#toast")?.classList.contains("hidden"), undefined, { timeout: 15000 });
  if (!await page.evaluate(() => document.querySelector("#importChoice")?.open === true))
    throw new Error(`Production backup importer rejected source export: ${await page.locator("#toast").innerText()}`);
  await page.locator("#importReplace").click();
  await page.waitForFunction(() => document.querySelector("#importChoice")?.open === false, undefined, { timeout: 15000 });
  await page.evaluate(() => window.__repforgeStorage.flush());
}

async function readImportedRow(page) {
  return page.evaluate(({ pressId, loadId, repsId }) => {
    const state = window.__repforgeWorkoutDraft.state();
    const row = state.log.find((entry) => entry.performedLibraryId === pressId);
    return row ? {
      session: row.session,
      metricValues: row.metricValues,
      loadingContext: row.loadingContext,
      bodyweight: row.bodyweight,
      load: row.metricValues.find((entry) => entry.metricId === loadId)?.value ?? null,
      reps: row.metricValues.find((entry) => entry.metricId === repsId)?.value ?? null,
      slot: state.program.find((entry) => entry.slotId === row.slotId) || null,
    } : null;
  }, { pressId: PRESS_ID, loadId: LOAD_PER_SIDE_ID, repsId: REPS_PER_SIDE_ID });
}

async function readNextSessionView(page, rowId) {
  await page.evaluate(() => document.querySelector('nav button[data-view="log"]')?.click());
  await page.waitForSelector("#log.view.active", { timeout: 10000 });
  await selectPress(page, rowId);
  const view = await page.evaluate((id) => {
    const progression = window.__repforgeProgression;
    const rec = progression.recommendation(progression.programSlot(id));
    const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
    const setId = exercise?.setOrder?.find((key) => exercise.sets[key].ordinal === 1);
    const result = rec?.targetSets?.find((entry) => entry.prescription?.setIndex === 1)?.result;
    return {
      engineStatus: rec?.engineStatus,
      reason: rec?.reason,
      load: rec?.load,
      targetLoadPerSideKg: result?.targets?.loadPerSideKg ?? null,
      targetRepsPerSide: result?.targets?.repsPerSide ?? null,
      prefillLoadPerSideKg: exercise?.sets?.[setId]?.edited?.metrics?.["25a5c6f170d880e2990fc88146f7de56"] ?? null,
      prefillRepsPerSide: exercise?.sets?.[setId]?.edited?.metrics?.["25a5c6f170d880baaa2dc8c7b67d4b65"] ?? null,
      previous: document.querySelector("#workout .exercise.is-current .ledgerline__prev")?.textContent?.trim() || "",
    };
  }, rowId);
  await page.locator("#workout .exercise.is-current [data-why]").first().click();
  await page.waitForSelector("#whySheet.is-open", { timeout: 5000 });
  view.why = await page.locator("#whyBody").innerText();
  await page.locator("#whyClose").click();
  await page.waitForSelector("#whySheet", { state: "hidden", timeout: 5000 });
  return view;
}

async function main() {
  console.log("P069-S3-TRANSFER: generated per-side actuals survive production backup and install-transfer imports");
  const browser = await launchChromium();
  let sourceContext;
  let backupContext;
  let transferContext;
  try {
    sourceContext = await browser.newContext({ acceptDownloads: true, locale: "en-US", timezoneId: "UTC" });
    const source = await sourceContext.newPage();
    source.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    await source.clock.setFixedTime(new Date("2026-10-05T12:00:00.000Z"));
    await source.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(source, { base: BASE });
    const generated = await seedGeneratedPress(source);
    const rowId = generated.row?.id;
    check(!!rowId && generated.slot.executionMode === "bilateral",
      "source program is produced by the real generator with a bilateral per-side slot", generated.slot);
    if (!rowId) throw new Error("The generated source press row is missing");
    await selectPress(source, rowId);
    await logFirstPressSet(source, rowId);
    const sourceRow = await readImportedRow(source);
    check(sourceRow?.load === 25 && sourceRow?.reps === 8 && sourceRow?.bodyweight === 80 &&
      sourceRow?.loadingContext?.externalLoadMultiplier === 2,
    "the real saved source session contains per-side actuals, bodyweight, and explicit multiplier", sourceRow);

    const backup = await exportBackup(source);
    const backupRow = backup.log?.find((entry) => entry.performedLibraryId === PRESS_ID);
    check(backupRow?.loadingContext?.externalLoadMultiplier === 2 &&
      backupRow?.metricValues?.some((entry) => entry.metricId === LOAD_PER_SIDE_ID && entry.value === 25) &&
      backupRow?.metricValues?.some((entry) => entry.metricId === REPS_PER_SIDE_ID && entry.value === 8),
    "the production backup export retains explicit multiplier and logged per-side metrics", backupRow);
    const observation = await observeSource(source);
    const envelope = await buildTransferEnvelope(observation);
    const transferRow = envelope.durableState.log.find((entry) => entry.performedLibraryId === PRESS_ID);
    check(transferRow?.loadingContext?.externalLoadMultiplier === 2 &&
      transferRow?.metricValues?.some((entry) => entry.metricId === LOAD_PER_SIDE_ID && entry.value === 25) &&
      transferRow?.metricValues?.some((entry) => entry.metricId === REPS_PER_SIDE_ID && entry.value === 8),
    "the production install-transfer envelope retains the same explicit per-side actuals", transferRow);

    await source.clock.setFixedTime(new Date("2026-10-07T12:00:00.000Z"));
    await source.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(source, { base: BASE });
    const sourceView = await readNextSessionView(source, rowId);
    check(sourceView.engineStatus === "recommended" && sourceView.targetLoadPerSideKg > 0 &&
      Number(sourceView.prefillLoadPerSideKg) === sourceView.targetLoadPerSideKg &&
      Number(sourceView.prefillRepsPerSide) === sourceView.targetRepsPerSide &&
      sourceView.previous.toLowerCase().includes("per side") && sourceView.why.includes("per side × 2"),
    "source next-session view uses per-side actuals, target, prefill, and Why assumption", sourceView);

    backupContext = await browser.newContext({ locale: "en-US", timezoneId: "UTC" });
    const backupTarget = await backupContext.newPage();
    backupTarget.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    await backupTarget.clock.setFixedTime(new Date("2026-10-07T12:00:00.000Z"));
    await backupTarget.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(backupTarget, { base: BASE });
    await importBackupThroughUi(backupTarget, backup);
    await backupTarget.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(backupTarget, { base: BASE });
    const restoredBackupRow = await readImportedRow(backupTarget);
    check(restoredBackupRow?.loadingContext?.externalLoadMultiplier === 2 && restoredBackupRow.load === 25 &&
      restoredBackupRow.reps === 8 && restoredBackupRow.bodyweight === 80,
    "backup Replace and reload preserve the actuals and explicit loading context", restoredBackupRow);
    const backupView = await readNextSessionView(backupTarget, rowId);
    check(assert.deepEqual(backupView, sourceView) === undefined,
      "backup clone reproduces the same adaptive next-session view, prefill, previous cue, and Why evidence");

    // A fresh destination: its guides are as the app leaves them, since a dismissed guide is the lifter's own state.
    transferContext = await browser.newContext({ locale: "en-US", timezoneId: "UTC", guides: "live" });
    const transferTarget = await transferContext.newPage();
    transferTarget.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    await transferTarget.clock.setFixedTime(new Date("2026-10-07T12:00:00.000Z"));
    await transferTarget.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(transferTarget, { base: BASE });
    const imported = await importTransferThroughProduction(transferTarget, envelope);
    check(imported?.ok === true, "a fresh destination accepts the production claimed install-transfer import", imported);
    await transferTarget.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(transferTarget, { base: BASE });
    const restoredTransferRow = await readImportedRow(transferTarget);
    check(restoredTransferRow?.loadingContext?.externalLoadMultiplier === 2 && restoredTransferRow.load === 25 &&
      restoredTransferRow.reps === 8 && restoredTransferRow.bodyweight === 80,
    "install-transfer import and reload preserve the actuals and explicit loading context", restoredTransferRow);
    const transferView = await readNextSessionView(transferTarget, rowId);
    check(assert.deepEqual(transferView, sourceView) === undefined,
      "install-transfer clone reproduces the same adaptive next-session view, prefill, previous cue, and Why evidence");
  } catch (error) {
    failures.push(String(error?.stack || error));
    console.error(error?.stack || error);
  } finally {
    await transferContext?.close().catch(() => {});
    await backupContext?.close().catch(() => {});
    await sourceContext?.close().catch(() => {});
    await browser.close().catch(() => {});
  }
  console.log(`\nP069-S3-TRANSFER: ${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

await main();
