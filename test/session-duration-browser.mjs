#!/usr/bin/env node
/**
 * #515: a saved session keeps its actual wall-clock duration.
 *
 * The draft's start and the explicit finish are recorded with the session,
 * once, in the same durable write as its rows. They survive reload, a backup
 * export and import, and the install transfer; delete goes with the session;
 * a refused save leaves nothing behind; a session saved without them stays
 * unknown rather than reading as zero.
 *
 * Run: node tools/run-tests.mjs edit --suite session-duration-browser
 */
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { launchChromium, openShelfField, waitForAppBoot } from "./browser.mjs";
import { finishEarly, openEarlyFinish, selectExercise } from "./fixtures/focus-workout.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const require = createRequire(import.meta.url);
const RAW_CATALOG = require("../assets/exercise-catalog.json");
globalThis.RepForgeExerciseCatalog = { snapshot: () => RAW_CATALOG };
const Transfer = require("../install-transfer.js");
const Contract = require("../install-transfer-contract.js");

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const UI_KEY = "repforge_ui_v1";
const CONSENT_KEY = "repforge_telemetry_enabled_v1";
const IDENTITY_KEY = "repforge_telemetry_identity_v1";
const INBOUND_KEY = "repforge_transfer_inbound_v1";
const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";
const SEED_A = "seed-ex-1";
const STARTED = "2026-10-05T12:00:00.000Z";
const FINISHED = "2026-10-05T12:42:10.000Z";

let passed = 0;
const failures = [];
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 3000)}`);
}
const phase = (name) => console.log(`\n${name}`);

const durable = (page) => page.evaluate(async () => {
  await window.__repforgeStorage.flush();
  return structuredClone(window.__repforgeWorkoutDraft.state());
});
const sessionIds = (state) => [...new Set((state.log || []).map((row) => String(row.session)))];

async function bootFresh(context, at) {
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
  await page.clock.setFixedTime(new Date(at));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  return page;
}

async function fillShelf(page, metricId, value) {
  const input = page.locator(`#workout .exercise.is-current .focus-shelf input[data-metric-id="${metricId}"]`);
  await input.waitFor({ state: "attached", timeout: 5000 });
  if (await input.getAttribute("aria-hidden") === "true")
    await openShelfField(page, `#workout .exercise.is-current .focus-shelf [data-shelf-field="metric_${metricId}"]`);
  await input.fill(String(value));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

async function saveFirstSet(page) {
  await selectExercise(page, SEED_A);
  await fillShelf(page, WEIGHT, 60);
  await fillShelf(page, REPS, 8);
  const rir = page.locator(`#workout .exercise.is-current .focus-shelf input[data-k="${SEED_A}_1_rir"]`);
  if (await rir.getAttribute("aria-hidden") === "true")
    await page.locator('#workout .exercise.is-current .focus-shelf [data-shelf-field="rir"]').click();
  await rir.fill("1");
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.locator(`#workout .exercise.is-current [data-save="${SEED_A}_1"]`).click();
  await page.waitForFunction((id) => {
    const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
    return Object.values(exercise?.sets || {}).some((set) => set.ordinal === 1 && set.completion !== "pending");
  }, SEED_A, { timeout: 10000 });
}

async function enterWorkout(page) {
  const entered = await page.evaluate(() => { window.closeFirstRun?.(); return window.__repforgeEnterWorkout({ day: "Day 1" }); });
  if (entered === false) throw new Error("could not enter Day 1");
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 8000 });
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

async function importBackupThroughUi(page, backup, choice = "#importReplace") {
  await page.evaluate(() => window.closeFirstRun?.());
  await page.evaluate(() => window.__repforgeShowSettings());
  await page.waitForSelector("#settings.view.active", { timeout: 10000 });
  await page.locator("#dataImportRow").click();
  await page.locator("#importJson").setInputFiles({
    name: "session-duration-backup.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.waitForFunction(() => document.querySelector("#importChoice")?.open === true ||
    !document.querySelector("#toast")?.classList.contains("hidden"), undefined, { timeout: 15000 });
  if (!await page.evaluate(() => document.querySelector("#importChoice")?.open === true))
    throw new Error(`The backup importer refused the export: ${await page.locator("#toast").innerText()}`);
  await page.locator(choice).click();
  await page.waitForFunction(() => document.querySelector("#importChoice")?.open === false, undefined, { timeout: 15000 });
  await page.evaluate(() => window.__repforgeStorage.flush());
}

async function transferEnvelope(page, { sessionTiming } = {}) {
  const observation = await page.evaluate(async ({ uiKey, consentKey, identityKey }) => {
    const draft = window.__repforgeWorkoutDraft;
    await window.__repforgeStorage.flush();
    await draft.flush();
    const current = draft.current();
    return {
      durableState: draft.state(),
      draft: { current, checkpoint: draft.checkpoint(), read: draft.read(),
        logical: current ? window.RepForgeWorkoutDraft.logicalCloneSection(current) : null },
      uiPreferences: window.__repforgeUi.loadUiPrefs() || JSON.parse(localStorage.getItem(uiKey) || "{}"),
      analytics: { enabled: localStorage.getItem(consentKey) !== "false" },
      telemetryIdentity: JSON.parse(localStorage.getItem(identityKey) || "null"),
    };
  }, { uiKey: UI_KEY, consentKey: CONSENT_KEY, identityKey: IDENTITY_KEY });
  if (sessionTiming) observation.durableState.sessionTiming = structuredClone(sessionTiming);
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
  if (!captured.ok) throw new Error(`clone capture failed: ${captured.code}`);
  const built = await Transfer.buildEnvelope({
    sections,
    source: { context: "browser", logicalInstallationId: observation.telemetryIdentity.installationId,
      sourceRevision: Number.isSafeInteger(observation.durableState._storageRevision) ? observation.durableState._storageRevision : 0 },
    contract: Contract, crypto: webcrypto, createdAt: "2026-10-06T12:00:00.000Z", logicalSnapshot: captured.value,
  });
  if (!built.ok) throw new Error(`envelope build failed: ${built.code}`);
  const valid = await Contract.validateEnvelopeIntegrity(built.value, webcrypto);
  if (!valid.ok) throw new Error(`envelope failed its contract: ${valid.code}`);
  return built.value;
}

async function importTransfer(page, envelope) {
  const segment = Buffer.alloc(32, 7).toString("base64url");
  const token = `v1.k1.${segment}.${segment}.${segment}`;
  return page.evaluate(async ({ value, token, expiresAt, inboundKey }) => {
    const transfer = window.RepForgeInstallTransfer;
    const contract = window.RepForgeInstallTransferContract;
    const credentials = transfer.createCredentialVault({ crypto: window.crypto, indexedDB: window.indexedDB });
    const cookies = new Map();
    const cookieDocument = {
      get cookie() { return [...cookies].map(([name, v]) => `${name}=${v}`).join("; "); },
      set cookie(serialized) {
        const [pair, ...attributes] = String(serialized).split(";");
        const at = pair.indexOf("=");
        if (at < 0) return;
        const name = pair.slice(0, at).trim();
        if (attributes.some((attribute) => /Max-Age=0(?:\s|$)/i.test(attribute))) cookies.delete(name);
        else cookies.set(name, pair.slice(at + 1).trim());
      },
    };
    const cookieLocation = { href: `${location.origin}/index.html`, origin: location.origin, pathname: "/index.html" };
    const inbound = {
      async read() { try { return JSON.parse(localStorage.getItem(inboundKey) || "null"); } catch { return { invalid: true }; } },
      async write(marker) { localStorage.setItem(inboundKey, JSON.stringify(marker)); },
      async clear() { localStorage.removeItem(inboundKey); },
    };
    const operationLock = { withLock(name, work) { return navigator.locks?.request ? navigator.locks.request(name, work) : work(); } };
    const transport = { async request() {
      return { status: 200, bytes: new TextEncoder().encode(JSON.stringify({ envelope: value, expiresAt })) };
    } };
    if (!transfer.writeTransferCookie({ token, expiresAt }, { document: cookieDocument, location: cookieLocation }))
      return { ok: false, code: "claim-setup-failed" };
    const client = transfer.createClient({ contract, crypto: window.crypto, transport, context: "standalone",
      document: cookieDocument, location: cookieLocation, storage: { inbound, credentials, operationLock } });
    const claim = await client.claim();
    if (!claim?.ok || claim.state !== "validating") return { ok: false, code: claim?.code || "claim-failed" };
    const marker = await inbound.read();
    const pair = await credentials.unseal("standalone-inbound", marker?.sealedCredentials);
    const digest = new Uint8Array(await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(pair.claimId)));
    const claimIdDigest = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const result = await window.__repforgeInstallTransferImport(value, { claimId: pair.claimId, claimIdDigest, credentials });
    await inbound.clear();
    await window.__repforgeStorage?.flush?.();
    return result ?? null;
  }, { value: envelope, token, expiresAt: "2099-01-01T00:00:00.000Z", inboundKey: INBOUND_KEY });
}

async function readingTotals(page, sid) {
  await page.evaluate(() => window.closeFirstRun?.());
  await page.locator('nav button[data-view="history"]').click();
  await page.waitForSelector("#history.view.active");
  await page.locator(`#sessions [data-sess="${sid}"] .session__open`).click();
  await page.waitForSelector(`[data-reading="${sid}"] .histpage__totals`);
  return page.locator(`[data-reading="${sid}"] .histpage__totals > div`).allInnerTexts();
}

async function reload(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
}

async function main() {
  console.log("#515: the actual duration of a saved session is durable");
  const browser = await launchChromium();
  const contexts = [];
  const context = async (options = {}) => {
    const created = await browser.newContext({ locale: "en-US", timezoneId: "UTC", ...options });
    contexts.push(created);
    return created;
  };
  try {
    phase("Saving a session records its start and its explicit finish with it");
    const source = await bootFresh(await context({ acceptDownloads: true }), STARTED);
    await installSeedProgram(source, { waitFor: () => waitForAppBoot(source, { base: BASE }) });
    await enterWorkout(source);
    await saveFirstSet(source);
    await source.clock.setFixedTime(new Date(FINISHED));
    const finished = await finishEarly(source);
    let state = await durable(source);
    const [sid] = sessionIds(state);
    const expected = { startedAt: STARTED, completedAt: FINISHED, durationSeconds: 2530 };
    check(finished?.localOk || finished?.idbOk, "the early finish saved the session", finished);
    check(JSON.stringify(state.sessionTiming?.[sid]) === JSON.stringify(expected),
      "the session keeps its start, its finish and 42 min 10 s of wall-clock time", state.sessionTiming);
    check(state.log.every((row) => row.created === FINISHED && !("startedAt" in row) && !("durationSeconds" in row)),
      "the timing is the session's, not copied onto its set rows", state.log.map((row) => Object.keys(row)));

    phase("It survives a reload, a backup and the install transfer");
    await reload(source);
    state = await durable(source);
    check(JSON.stringify(state.sessionTiming?.[sid]) === JSON.stringify(expected), "a reload reads the same timing", state.sessionTiming);
    const backup = await exportBackup(source);
    check(JSON.stringify(backup.sessionTiming?.[sid]) === JSON.stringify(expected), "the backup export carries it", backup.sessionTiming);
    const envelope = await transferEnvelope(source);
    check(JSON.stringify(envelope.durableState.sessionTiming?.[sid]) === JSON.stringify(expected),
      "the install-transfer envelope carries it and passes the transfer contract", envelope.durableState.sessionTiming);

    const restored = await bootFresh(await context(), FINISHED);
    await importBackupThroughUi(restored, backup);
    await reload(restored);
    state = await durable(restored);
    check(JSON.stringify(state.sessionTiming?.[sid]) === JSON.stringify(expected), "a backup Replace and reload keep it", state.sessionTiming);

    const transferred = await bootFresh(await context({ guides: "live" }), FINISHED);
    const imported = await importTransfer(transferred, envelope);
    check(imported?.ok === true, "a fresh destination accepts the transfer", imported);
    await reload(transferred);
    state = await durable(transferred);
    check(JSON.stringify(state.sessionTiming?.[sid]) === JSON.stringify(expected), "an install-transfer import and reload keep it", state.sessionTiming);

    const merged = await bootFresh(await context(), FINISHED);
    await installSeedProgram(merged, { waitFor: () => waitForAppBoot(merged, { base: BASE }) });
    await importBackupThroughUi(merged, backup, "#importMerge");
    await reload(merged);
    state = await durable(merged);
    check(JSON.stringify(state.sessionTiming?.[sid]) === JSON.stringify(expected), "a backup Merge brings the added session's timing", state.sessionTiming);

    phase("A reader takes a payload that carries timing without refusing it");
    // Built by hand, so this phase also runs against a release that writes none.
    const carried = { [sid]: expected };
    const carryingBackup = { ...structuredClone(backup), sessionTiming: carried };
    const backupReader = await bootFresh(await context(), FINISHED);
    await importBackupThroughUi(backupReader, carryingBackup);
    await reload(backupReader);
    state = await durable(backupReader);
    check(JSON.stringify(sessionIds(state)) === JSON.stringify([sid]) && state.log.length === backup.log.length,
      "a backup carrying session timing imports with every row", { sessions: sessionIds(state), rows: state.log.length });
    const carryingEnvelope = await transferEnvelope(source, { sessionTiming: carried });
    const transferReader = await bootFresh(await context({ guides: "live" }), FINISHED);
    const carriedImport = await importTransfer(transferReader, carryingEnvelope);
    await reload(transferReader);
    state = await durable(transferReader);
    check(carriedImport?.ok === true && JSON.stringify(sessionIds(state)) === JSON.stringify([sid]),
      "a transfer carrying session timing passes the contract and imports with every row", { carriedImport, sessions: sessionIds(state) });

    phase("A session saved without timing stays unknown");
    const legacy = structuredClone(backup);
    legacy.sessionTiming = { ghost: expected, [sid]: { startedAt: FINISHED, completedAt: STARTED, durationSeconds: -2530 } };
    const older = await bootFresh(await context(), FINISHED);
    await importBackupThroughUi(older, legacy);
    await reload(older);
    state = await durable(older);
    check(sessionIds(state).includes(sid) && !Object.keys(state.sessionTiming || {}).length,
      "a session whose timing is missing or impossible reads unknown, and timing without a session is dropped", state.sessionTiming);
    const unknownTotals = await readingTotals(older, sid);
    check(unknownTotals.length > 0 && !unknownTotals.some((text) => /minute/i.test(text)),
      "History shows no duration for it, not zero", unknownTotals);

    phase("A refused save leaves no timing behind");
    await source.clock.setFixedTime(new Date("2026-10-07T12:00:00.000Z"));
    await reload(source);
    await enterWorkout(source);
    await saveFirstSet(source);
    await source.evaluate(() => {
      window.__repforgeDraftBeforeSaveCommit = async () => {
        delete window.__repforgeDraftBeforeSaveCommit;
        const api = window.__repforgeWorkoutDraft, draft = api.current();
        const next = window.RepForgeWorkoutDraft.reduce(draft, { type: "setSessionNotes", value: "other tab",
          operationId: "other-tab-op", expectedRevision: draft.revision, updatedAt: new Date().toISOString(),
          writer: { installationId: "other", tabId: "other-tab", operationId: "other-tab-op" } });
        await api.cas({ expectedDraftId: draft.draftId, expectedRevision: draft.revision,
          nextRaw: JSON.stringify(window.RepForgeWorkoutDraft.serialize(next)), operationId: "other-tab-op" });
      };
    });
    await openEarlyFinish(source);
    await source.locator("#sessionEarlyConfirm").click();
    await source.waitForFunction(() => window.__repforgeLastWorkoutFinish != null, undefined, { timeout: 15000 });
    const refused = await source.evaluate(async () => await window.__repforgeLastWorkoutFinish);
    state = await durable(source);
    check(!(refused?.localOk || refused?.idbOk) && sessionIds(state).length === 1 &&
      JSON.stringify(Object.keys(state.sessionTiming || {})) === JSON.stringify([sid]),
    "a save that lost to another tab writes no rows and no timing", { refused, timing: state.sessionTiming });

    phase("Deleting the session deletes its timing");
    await reload(source);
    // The refused save left its draft open; step out of it to reach History.
    await source.evaluate(() => window.__repforgeLeaveWorkout());
    const knownTotals = await readingTotals(source, sid);
    check(knownTotals.some((text) => /^42\s+minutes$/.test(text.replace(/\s+/g, " ").trim())),
      "History reads the session's 42 minutes beside its totals", knownTotals);
    await source.locator(`[data-reading="${sid}"] [data-del="${sid}"]`).click();
    await source.locator(`[data-history-delete-confirm="${sid}"]`).click();
    await source.waitForFunction((id) => !window.__repforgeWorkoutDraft.state().log.some((row) => String(row.session) === id),
      sid, { timeout: 10000 });
    state = await durable(source);
    check(!state.sessionTiming || !(sid in state.sessionTiming), "no timing outlives its session", state.sessionTiming);
  } catch (error) {
    failures.push(String(error?.stack || error));
    console.error(error?.stack || error);
  } finally {
    for (const created of contexts) await created.close().catch(() => {});
    await browser.close().catch(() => {});
  }
  console.log(`\n#515 session duration: ${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

await main();
