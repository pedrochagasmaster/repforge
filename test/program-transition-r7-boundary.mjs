#!/usr/bin/env node
/**
 * Plan 052-P7: recovery carrier transport and upgrade boundaries.
 *
 * This file owns only the R7 boundary slice.  It deliberately uses a real
 * production replacement and recovery transition to make the source state,
 * then crosses the ordinary backup, program/setup/free-form transport doors
 * and a real old-worker -> current-worker update.  Q-C4 owns normal boot
 * corruption/quarantine projection; R5b2 owns crash/replay fault points.
 *
 * Expected values come from the storage/transport contracts, not from an app
 * normalizer: the quarantine digest is independently hashed here, the backup
 * document is compared as an exact logical document, and upgrade recovery
 * compares the original raw bytes and IndexedDB object.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { launchChromium, waitForAppBoot, assertServingApp } from "./browser.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:8052/";
const STATE_KEY = "repforge_v1";
const DB_NAME = "repforge";
const STORE_NAME = "kv";
const PRIVATE_KEYS = new Set([
  "log", "programHistory", "recoveryTransitions", "recoveryQuarantine", "recoveryLifecycle",
  "blockId", "transitionIn", "transitionOut", "archiveId",
]);
const VOLATILE_KEYS = new Set([
  "_storageRevision", "_storageFollowUp", "_storageDraftTransaction", "_storageSetupActivation",
]);
const OLD_WORKER = readFileSync(join(ROOT, "test/fixtures/sw-v120.js"), "utf8");
const CURRENT_WORKER = readFileSync(join(ROOT, "sw.js"), "utf8");
const HISTORICAL_COMMIT = "e7b6d162983a4dd2549eb58c32bf6a344936ccf7";
const HISTORICAL_PATHS = [
  "index.html", "styles.css", "manifest.webmanifest", "telemetry.js", "posthog-init.js",
  "schedule.js", "notify.js", "i18n.js", "exercises.js", "progression-engine.js",
  "program-compiler.js", "shared-setup.js", "app.js", "sw.js", "icons", "assets", "fonts",
];
const HISTORICAL_ROOT = mkdtempSync(join(tmpdir(), "repforge-r7-historical-"));
try {
  const archive = execFileSync(
    "git",
    ["archive", "--format=tar", HISTORICAL_COMMIT, "--", ...HISTORICAL_PATHS],
    { cwd: ROOT, maxBuffer: 128 * 1024 * 1024 },
  );
  execFileSync("tar", ["-x", "-C", HISTORICAL_ROOT], { input: archive, maxBuffer: 128 * 1024 * 1024 });
} catch (error) {
  rmSync(HISTORICAL_ROOT, { recursive: true, force: true });
  throw new Error(`R7 historical source artifact unavailable at ${HISTORICAL_COMMIT}`, { cause: error });
}
const HISTORICAL_INDEX = readFileSync(join(HISTORICAL_ROOT, "index.html"), "utf8");
const HISTORICAL_APP = readFileSync(join(HISTORICAL_ROOT, "app.js"), "utf8");
const HISTORICAL_WORKER = readFileSync(join(HISTORICAL_ROOT, "sw.js"), "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const HISTORICAL_INDEX_SHA = sha256(HISTORICAL_INDEX);
const HISTORICAL_APP_SHA = sha256(HISTORICAL_APP);
const HISTORICAL_WORKER_SHA = sha256(HISTORICAL_WORKER);
if (HISTORICAL_WORKER !== OLD_WORKER || HISTORICAL_WORKER_SHA !== "02639be4f2c4ae0a25cc969eb2986c5fcf85d7f64f3018404737bf502b769a81") {
  rmSync(HISTORICAL_ROOT, { recursive: true, force: true });
  throw new Error("R7 historical app/worker artifact does not match the pinned released v120 source");
}
if (HISTORICAL_INDEX_SHA !== "ac14c8c31953ec11ef1438cc8dfc24818103d4dcffdf7f8ec7a16f6aa4fa95b2" ||
    HISTORICAL_APP_SHA !== "7085e3812aee9e1972fce7b22bcbe27430549c6bae7f546292046e1e50c021d8") {
  rmSync(HISTORICAL_ROOT, { recursive: true, force: true });
  throw new Error("R7 historical app source hash changed at the pinned released v120 commit");
}
const cacheName = (worker) => worker.match(/const CACHE = ["']([^"']+)["']/)?.[1];
const OLD_CACHE = cacheName(OLD_WORKER);
const CURRENT_CACHE = cacheName(CURRENT_WORKER);
if (!OLD_CACHE || !CURRENT_CACHE || OLD_CACHE === CURRENT_CACHE) {
  throw new Error("R7 service-worker fixtures must have distinct cache generations");
}

const EVIDENCE = {
  outcomesByPattern: {
    "knee-dominant": "maintained",
    "horizontal press": "declined",
  },
  checkpointAnswer: "Yes",
};

let passed = 0;
const failures = [];

class HarnessFailure extends Error {}

function check(condition, message, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
    return true;
  }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) {
    console.error(`    Detail: ${typeof detail === "object" ? JSON.stringify(detail, null, 2) : detail}`);
  }
  return false;
}

function must(condition, message, detail) {
  if (condition) return;
  throw new HarnessFailure(`${message}${detail === undefined ? "" : `: ${JSON.stringify(detail)}`}`);
}

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

function sameValue(actual, expected) {
  return JSON.stringify(canonicalize(actual)) === JSON.stringify(canonicalize(expected));
}

function withoutVolatile(value) {
  const out = clone(value);
  for (const key of VOLATILE_KEYS) delete out?.[key];
  return out;
}

function hasForbiddenKey(value, keys = PRIVATE_KEYS) {
  if (Array.isArray(value)) return value.some((item) => hasForbiddenKey(item, keys));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => keys.has(key) || hasForbiddenKey(child, keys));
}

function hashUtf8(raw) {
  return createHash("sha256").update(raw, "utf8").digest("hex");
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
      get.onsuccess = () => {
        db.close();
        resolve(get.result ?? null);
      };
      get.onerror = () => {
        db.close();
        reject(get.error);
      };
    };
  }), { dbName: DB_NAME, storeName: STORE_NAME, key: STATE_KEY });
}

async function readReplicas(page) {
  const localRaw = await page.evaluate((key) => localStorage.getItem(key), STATE_KEY);
  const localKeys = await page.evaluate(() => Object.keys(localStorage).sort());
  return { localRaw, local: localRaw == null ? null : JSON.parse(localRaw), idb: await readIdb(page), localKeys };
}

async function flush(page) {
  await page.evaluate(async () => {
    await window.__repforgeStorage?.flush?.();
    await window.__repforgeWorkoutDraft?.flush?.();
  });
}

async function activateProductionPredecessor(page) {
  return page.evaluate(async () => {
    const adapter = window.RepForgeProgramEntryAdapter;
    const compiler = window.RepForgeProgramCompiler;
    if (!adapter || !compiler || typeof window.__repforgeFinalizeProgramSetup !== "function") {
      return { ok: false, error: "production entry seams unavailable" };
    }
    const services = adapter.createProductionServices({
      Compiler: compiler,
      catalogue: window.__repforgeExerciseLibrary || window.EXERCISE_LIBRARY,
    });
    const compiled = services.compile({
      mode: "recommend",
      answers: {
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
      },
      versions: services.currentVersions(),
    });
    if (!compiled.ok) return { ok: false, error: "production compilation failed", issues: compiled.issues };
    const baseProposal = window.__repforgeWorkoutDraft.state();
    baseProposal.programMeta = baseProposal.programMeta || {};
    baseProposal.programMeta.progressionRelations = structuredClone(compiled.preview.progressionRelations || []);
    baseProposal.programMeta.progressionModifiers = [];
    baseProposal.programMeta.progressionIncompatibilities = [];
    baseProposal.programMeta.programStructure = structuredClone(compiled.preview.programStructure);
    baseProposal.programMeta.compilerContext = structuredClone(compiled.compilerContext);
    const finalized = await window.__repforgeFinalizeProgramSetup({
      exercises: compiled.preview.program,
      name: compiled.name || "R7 boundary predecessor",
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

async function commitReplacement(page) {
  return page.evaluate(async () => {
    const adapter = window.__repforgeProgramTransition;
    if (!adapter?.proposeSibling || !adapter?.confirmTransition) {
      return { ok: false, error: "replacement transition adapter unavailable" };
    }
    const proposalResult = await adapter.proposeSibling({
      targetConstraint: { frequency: 3 },
      diagnosis: {
        kind: "fewer_days",
        answers: { availableDays: 3 },
        eligibleEvidenceIds: ["r7-boundary-evidence"],
        insufficientEvidenceReasons: [],
      },
      transitionId: "tr_r7_boundary_replacement",
      successorProgramId: "prog_r7_boundary_successor",
      createdAt: "2026-10-05T12:00:00.000Z",
    });
    if (!proposalResult?.ok) return { ok: false, error: "replacement proposal failed", proposalResult };
    const proposal = proposalResult.proposal;
    const confirmed = await adapter.confirmTransition({
      proposal,
      transitionId: proposal.transitionId,
      successorProgramId: proposal.successor.programId,
      confirmedAt: "2026-10-05T12:10:00.000Z",
      proposalHash: proposal.proposalHash,
      acknowledgedDraftRaw: null,
    });
    await window.__repforgeStorage.flush();
    return { ok: !!(confirmed?.committed && (confirmed.localOk || confirmed.idbOk)), proposal, confirmed };
  });
}

async function commitRecovery(page) {
  return page.evaluate(async (evidence) => {
    const adapter = window.__repforgeProgramTransition;
    if (!adapter?.proposeRecoveryWeek || !adapter?.confirmTransition) {
      return { ok: false, error: "recovery transition adapter unavailable" };
    }
    const proposalResult = await adapter.proposeRecoveryWeek({
      evidence,
      transitionId: "tr_r7_boundary_recovery",
      createdAt: "2026-10-06T09:00:00.000Z",
    });
    if (!proposalResult?.ok) return { ok: false, error: "recovery proposal failed", proposalResult };
    const proposal = proposalResult.proposal;
    const confirmed = await adapter.confirmTransition({
      proposal,
      transitionId: proposal.transitionId,
      proposalHash: proposal.proposalHash,
      confirmedAt: "2026-10-06T09:12:00.000Z",
      reassessmentDueAt: "2026-10-13T09:12:00.000Z",
      acknowledgedDraftRaw: null,
    });
    await window.__repforgeStorage.flush();
    return { ok: !!(confirmed?.committed && (confirmed.localOk || confirmed.idbOk)), proposal, confirmed };
  }, EVIDENCE);
}

async function addBoundedQuarantine(page, record) {
  const malformed = clone(record);
  malformed.diff.recoveryWeek.reassessmentOutcome = "not-a-contract-outcome";
  const raw = JSON.stringify(malformed);
  const entry = {
    schemaVersion: 1,
    digest: hashUtf8(raw),
    raw,
    sourceReplica: "both",
    detectedAt: "2026-10-06T09:30:00.000Z",
    reason: "known-schema-malformed-recovery",
  };
  const result = await page.evaluate(async (quarantine) => {
    const snapshot = window.__repforgeWorkoutDraft?.state?.();
    if (!snapshot) return { ok: false, error: "live state seam unavailable" };
    const carrier = snapshot.recoveryTransitions;
    snapshot.recoveryTransitions = {
      schemaVersion: 1,
      records: structuredClone(carrier?.records || []),
      quarantine: [...structuredClone(carrier?.quarantine || []), quarantine],
    };
    const committed = await window.__repforgeCommitProposedState(snapshot);
    await window.__repforgeStorage.flush();
    return { ok: !!(committed?.localOk || committed?.idbOk), committed };
  }, entry);
  must(result.ok, "production state seam accepted the bounded quarantine fixture", result);
  return entry;
}

async function exportBackup(page) {
  await page.evaluate(() => window.closeFirstRun?.());
  await page.evaluate(() => window.__repforgeShowSettings?.());
  await page.locator("#dataBackupRow").click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#exportJson").click(),
  ]);
  return JSON.parse(readFileSync(await download.path(), "utf8"));
}

async function importBackup(page, backup) {
  await page.evaluate(() => window.closeFirstRun?.());
  await page.evaluate(() => window.__repforgeShowSettings?.());
  await page.locator("#dataImportRow").click();
  await page.locator("#importJson").setInputFiles({
    name: "r7-boundary-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.locator("#importChoice").waitFor({ state: "visible" });
  await page.locator("#importReplace").click();
  await page.waitForFunction(() => document.querySelector("#importChoice")?.open === false, undefined, { timeout: 10000 });
  await flush(page);
}

async function rejectRecoveryBackupThroughReplaceDoor(browser, base, sourceState, kind) {
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  const invalid = recoveryBoundaryDocument(sourceState, kind);
  try {
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base });
    await writeReplicas(page, sourceState);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base });
    const before = await readReplicas(page);
    const beforeRaw = before.localRaw;
    await page.evaluate(() => window.__repforgeShowSettings?.());
    await page.locator("#dataImportRow").click();
    await page.locator("#importJson").setInputFiles({
      name: `r7-${kind}.json`,
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(invalid)),
    });
    await page.waitForFunction(() => {
      const toast = document.querySelector("#toast")?.textContent?.trim() || "";
      return document.querySelector("#importChoice")?.open !== true && toast.length > 0;
    }, undefined, { timeout: 10000 });
    const after = await readReplicas(page);
    check(await page.evaluate(() => document.querySelector("#importChoice")?.open !== true),
      `${kind} backup is rejected before the Replace choice opens`);
    check(after.localRaw === beforeRaw && sameValue(after.idb, before.idb),
      `${kind} backup rejection leaves both replicas byte/logically unchanged`);
    check(after.local?._storageRevision === before.local?._storageRevision &&
      after.idb?._storageRevision === before.idb?._storageRevision &&
      sameValue(after.localKeys, before.localKeys),
    `${kind} backup rejection performs zero writes and launders no recovery evidence`);
  } finally {
    await context.close();
  }
}

async function exportProgramJson(page) {
  const settingsBack = page.locator("#settingsBack");
  if (await settingsBack.isVisible().catch(() => false)) await settingsBack.click();
  await page.locator('nav button[data-view="program"]').click();
  await page.locator("#programEditToggle").click();
  const advanced = page.locator("#programEditorWrap details.advanced");
  await advanced.click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#exportProgram").click(),
  ]);
  return JSON.parse(readFileSync(await download.path(), "utf8"));
}

async function readSharedSetupPayload(page) {
  return page.evaluate(async () => {
    const hook = window.__repforgeSharedSetup;
    const api = window.RepForgeSharedSetup;
    const payload = hook?.build?.();
    if (!payload || !api?.encode || !api?.decode) return { ok: false, error: "shared setup public seam unavailable" };
    const builtIns = new Set((window.__repforgeExerciseLibrary || window.EXERCISE_LIBRARY || []).map((entry) => entry.id));
    const encoded = await api.encode(payload, { builtInIds: builtIns });
    const decoded = encoded?.ok ? await api.decode(encoded.value, { builtInIds: builtIns }) : null;
    return { ok: !!(encoded?.ok && decoded?.ok), payload, encoded, decoded };
  });
}

async function checkFreeformBoundary(page, sourceBefore) {
  await page.evaluate(() => window.startOnboarding?.("settings", { forceFresh: true }));
  await page.waitForSelector("#entryOwnToggle", { timeout: 10000 });
  await page.locator("#entryOwnToggle").click();
  await page.locator("#entryFreeformStart").click();
  await page.locator("#entryFreeformIn").fill("R7 coach program: Bench press 3x8-10");
  await page.locator("#entryFreeformContinue").click();
  await page.locator('[data-freeform-app="chatgpt"]').waitFor({ state: "visible" });
  const prompt = await page.evaluate(() => {
    const href = document.querySelector('[data-freeform-app="chatgpt"]')?.getAttribute("href") || "";
    return href ? new URL(href).searchParams.get("q") || "" : "";
  });
  check(prompt.includes("R7 coach program"), "free-form provider link carries only the text the lifter supplied");
  check(!prompt.includes("tr_r7_boundary_recovery") && !prompt.includes("programHistory") &&
    !prompt.includes("recoveryTransitions") && !prompt.includes("transitionIn") &&
    !prompt.includes("compilerContext"),
  "free-form provider prompt excludes active recovery, history, transition, and compiler-private evidence", prompt);
  const after = await readReplicas(page);
  check(after.localRaw === sourceBefore.localRaw && sameValue(after.idb, sourceBefore.idb),
    "free-form handoff leaves both durable state replicas byte/logically unchanged");
  await page.locator("#entryFreeformCopy").click();
  await page.locator("#entryFreeformOut").waitFor({ state: "visible" });
  const reply = JSON.stringify({
    version: 3,
    meta: { name: "R7 free-form candidate" },
    exercises: [
      { day: "Push A", order: 1, name: "Barbell bench press", sets: 3, min: 6, max: 8 },
      { day: "Pull A", order: 1, name: "Barbell row", sets: 3, min: 8, max: 10 },
    ],
    log: [{ sentinel: "r7-private-freeform" }],
    programHistory: [{ sentinel: "r7-private-freeform" }],
    recoveryTransitions: { sentinel: "r7-private-freeform" },
    transitionIn: "r7-private-freeform",
  });
  await page.locator("#entryFreeformOut").fill(reply);
  await page.locator("#entryFreeformReview").click();
  await page.locator("#importReview.active").waitFor({ state: "visible" });
  const reviewed = await page.evaluate(() => ({
    draft: window.__repforgeImportDraft?.(),
    session: sessionStorage.getItem("repforge_freeform_session_v1"),
    state: localStorage.getItem("repforge_v1"),
  }));
  check(reviewed.draft?.sourceType === "freeform" && reviewed.draft?.counts?.total === 2 &&
    !hasForbiddenKey(reviewed.draft) && !JSON.stringify(reviewed.draft).includes("r7-private-freeform"),
  "free-form reply validation/review carries rows only and strips private recovery/history sentinels", reviewed.draft);
  check(reviewed.session === null && reviewed.state === sourceBefore.localRaw,
    "free-form reply review clears only its session draft and leaves durable state unchanged", reviewed);
  await settleImportRows(page);
  await page.locator("#importCommit").click();
  await page.locator("#entryActivate").waitFor({ state: "visible" });
  const staged = await page.evaluate(() => ({
    setup: localStorage.getItem("repforge_program_setup_draft_v1") || "",
    state: localStorage.getItem("repforge_v1"),
  }));
  check(staged.state === sourceBefore.localRaw && !staged.setup.includes("r7-private-freeform"),
    "free-form staged candidate retains session-only boundaries and does not persist private reply fields", staged);
  await page.evaluate(() => window.closeOnboarding?.());
}

async function settleImportRows(page) {
  for (let guard = 0; guard < 128; guard += 1) {
    if (!(await page.locator("#importCommit").isDisabled())) return;
    const pick = page.locator('#importRows .improw.is-open [data-imp-act="pick"]').first();
    if (await pick.count() && await pick.isVisible().catch(() => false)) {
      await pick.click();
      continue;
    }
    const link = page.locator('#importRows .improw.is-open [data-imp-act="link"]').first();
    if (await link.count() && await link.isVisible().catch(() => false)) {
      await link.click();
      continue;
    }
    const raw = page.locator('#importRows .improw.is-open [data-imp-act="raw"]').first();
    if (await raw.count() && await raw.isVisible().catch(() => false)) {
      await raw.click();
      continue;
    }
    const more = page.locator("#importRows .improw.is-open .improw__more summary").first();
    if (await more.count() && await more.isVisible().catch(() => false)) {
      await more.click();
      continue;
    }
    throw new HarnessFailure("import review has an unresolved row without a public decision control");
  }
  throw new HarnessFailure("import review did not settle within its bounded row count");
}

function privateProgramTransportDocument(programJson) {
  const candidate = clone(programJson);
  candidate.meta = {
    ...(candidate.meta || {}),
    blockId: "r7-private-program-file",
    transitionIn: "r7-private-program-file",
  };
  candidate.log = [{ sentinel: "r7-private-program-file" }];
  candidate.programHistory = [{ sentinel: "r7-private-program-file" }];
  candidate.recoveryTransitions = { sentinel: "r7-private-program-file" };
  return candidate;
}

async function runProgramFileDoor(browser, base, programJson, expectedProvenance) {
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const privateDocument = privateProgramTransportDocument(programJson);
  try {
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base });
    const before = await readReplicas(page);
    await page.locator("#firstRunCreate").click();
    await page.locator("#entryOwnToggle").click();
    await page.locator('[data-entry-route="import"]').click();
    await page.locator("#entryImportPick").click();
    await page.locator("#importProgram").setInputFiles({
      name: "r7-private-program.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(privateDocument)),
    });
    await page.locator("#importReview.active").waitFor({ state: "visible" });
    check(await page.locator("#importReview.active").isVisible(),
      "program file crosses the receive and review boundary in a fresh context");
    await settleImportRows(page);
    await page.locator("#importCommit").click();
    await page.locator("#entryActivate").waitFor({ state: "visible" });
    const staged = await readReplicas(page);
    const setupDraft = await page.evaluate(() => localStorage.getItem("repforge_program_setup_draft_v1") || "");
    check(staged.localRaw === before.localRaw && sameValue(staged.idb, before.idb) &&
      !setupDraft.includes("r7-private-program-file"),
    "program file review stages without mutating durable state or persisting private fields");
    await page.locator("#entryActivate").click();
    await page.waitForFunction(() => !document.querySelector("#onboarding")?.classList.contains("active"), undefined, { timeout: 15000 });
    const after = await readReplicas(page);
    check(after.local?.programMeta?.programStructure?.provenance?.blueprintId === expectedProvenance?.blueprintId,
      "program file activation retains safe compiler provenance", after.local?.programMeta?.programStructure?.provenance);
    check(sameValue(after.local, after.idb) && after.local?.program?.length > 0 &&
      Array.isArray(after.local?.log) && after.local.log.length === 0 &&
      Array.isArray(after.local?.programHistory) && after.local.programHistory.length === 0 &&
      !Object.prototype.hasOwnProperty.call(after.local || {}, "recoveryTransitions") &&
      !after.local?.programMeta?.transitionIn &&
      !JSON.stringify(after.local).includes("r7-private-program-file"),
    "program file activation imports only the reviewed program and no private recovery/history evidence", after.local);
  } finally {
    await context.close();
  }
}

async function createSharedSetupLink(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.locator('nav button[data-view="program"]').click();
  await page.locator("#shareProgramSetup").click();
  await page.waitForFunction(() => {
    const value = document.querySelector("#shareSetupLink")?.textContent?.trim() || "";
    return value.includes("#setup=");
  }, undefined, { timeout: 15000 });
  const value = await page.locator("#shareSetupLink").textContent();
  const url = new URL(value.trim());
  const fragment = url.hash.replace(/^#setup=/, "");
  must(/^v\d+\./.test(fragment), "program sharing UI produced an encoded setup fragment", value);
  await page.locator("#shareSetupClose").click();
  return fragment;
}

async function runSharedSetupDoor(browser, base, fragment, expectedProvenance) {
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(`${base}#setup=${fragment}`, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base });
    await page.locator("#firstRunSharedStart").waitFor({ state: "visible" });
    const before = await readReplicas(page);
    await page.locator("#firstRunSharedStart").click();
    const stagedBoundary = await page.waitForFunction(
      () => !!document.querySelector("#entryActivate") || window.__repforgeOnboarding?.entry?.()?.step === "preview",
      undefined,
      { timeout: 10000 },
    ).then(() => true).catch(() => false);
    if (!stagedBoundary || !(await page.locator("#entryActivate").count())) {
      const diagnostic = await page.evaluate(() => ({
        firstRunClass: document.querySelector("#firstRun")?.className || null,
        onboardingClass: document.querySelector("#onboarding")?.className || null,
        entryStep: window.__repforgeOnboarding?.entry?.()?.step || null,
        setupDraft: !!localStorage.getItem("repforge_program_setup_draft_v1"),
        body: document.querySelector("#onbBody")?.innerText?.slice(0, 240) || null,
      }));
      check(false, "shared setup candidate reaches the activation boundary after receive/stage", diagnostic);
      return;
    }
    await page.locator("#entryActivate").waitFor({ state: "visible" });
    const staged = await readReplicas(page);
    const setupDraft = await page.evaluate(() => localStorage.getItem("repforge_program_setup_draft_v1") || "");
    check(staged.localRaw === before.localRaw && sameValue(staged.idb, before.idb) && setupDraft.length > 0,
      "shared setup crosses receive/stage without mutating durable state");
    await page.locator("#entryActivate").click();
    await page.waitForFunction(() => !document.querySelector("#onboarding")?.classList.contains("active"), undefined, { timeout: 15000 });
    const after = await readReplicas(page);
    check(after.local?.programMeta?.programStructure?.provenance?.blueprintId === expectedProvenance?.blueprintId,
      "shared setup activation retains safe compiler provenance", after.local?.programMeta?.programStructure?.provenance);
    check(sameValue(after.local, after.idb) && after.local?.program?.length > 0 &&
      Array.isArray(after.local?.log) && after.local.log.length === 0 &&
      Array.isArray(after.local?.programHistory) && after.local.programHistory.length === 0 &&
      !Object.prototype.hasOwnProperty.call(after.local || {}, "recoveryTransitions") &&
      !after.local?.programMeta?.transitionIn,
    "shared setup activation contains no history, recovery carrier, or transition evidence");
  } finally {
    await context.close();
  }
}

function statSafe(file) {
  try { return statSync(file); } catch { return null; }
}

function mimeType(extension) {
  return ({
    ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
    ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png",
    ".webp": "image/webp", ".woff2": "font/woff2",
  })[extension] || "application/octet-stream";
}

let workerMode = "old";
const upgradeServer = createServer((request, response) => {
  const pathname = decodeURIComponent((request.url || "/").split("?", 1)[0]);
  if (pathname === "/sw.js") {
    response.writeHead(200, { "content-type": "text/javascript", "cache-control": "no-store" });
    response.end(workerMode === "old" ? HISTORICAL_WORKER : CURRENT_WORKER);
    return;
  }
  const root = workerMode === "old" ? HISTORICAL_ROOT : ROOT;
  const file = normalize(join(root, pathname === "/" ? "index.html" : pathname.slice(1)));
  if (relative(root, file).startsWith("..") || !statSafe(file)?.isFile()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": mimeType(extname(file)), "cache-control": "no-store" });
  createReadStream(file).pipe(response);
});

async function writeReplicas(page, state) {
  await page.evaluate(async ({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
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
  }, { key: STATE_KEY, value: state });
}

async function installOldWorker(page, base) {
  workerMode = "old";
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.readyState === "complete" && typeof window.RepForgeI18n === "object" &&
      !!document.querySelector("#dayTabs"),
    undefined,
    { timeout: 15000 },
  );
  const historicalIdentity = await page.evaluate(async () => {
    const digest = async (response) => {
      const bytes = await response.arrayBuffer();
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
    };
    const [indexResponse, appResponse] = await Promise.all([
      fetch("./index.html", { cache: "no-store" }),
      fetch("./app.js?v=120", { cache: "no-store" }),
    ]);
    return {
      indexSha: await digest(indexResponse),
      appSha: await digest(appResponse),
      appResource: performance.getEntriesByType("resource").some((entry) => /\/app\.js\?v=120$/.test(entry.name)),
      cache: (await caches.keys()).find((name) => name === "repforge-v120") || null,
    };
  });
  must(historicalIdentity.indexSha === HISTORICAL_INDEX_SHA && historicalIdentity.appSha === HISTORICAL_APP_SHA,
    "pinned historical index and app bytes execute before the upgrade", historicalIdentity);
  must(historicalIdentity.appResource && historicalIdentity.cache === OLD_CACHE,
    "historical app resource and v120 cache identify the released generation", historicalIdentity);
  await page.evaluate(async () => (await navigator.serviceWorker.ready).update());
  await page.waitForFunction((cache) => caches.has(cache), OLD_CACHE, { timeout: 10000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.readyState === "complete" && typeof window.RepForgeI18n === "object" &&
      !!document.querySelector("#dayTabs"),
    undefined,
    { timeout: 15000 },
  );
  must(await page.evaluate(() => !!navigator.serviceWorker.controller), "old worker controls the seeded upgrade page");
}

async function upgradeWorker(page, base) {
  workerMode = "current";
  await page.evaluate(async () => (await navigator.serviceWorker.ready).update());
  await page.waitForFunction(async ({ oldCache, currentCache }) => {
    const names = await caches.keys();
    return names.includes(currentCache) && !names.includes(oldCache);
  }, { oldCache: OLD_CACHE, currentCache: CURRENT_CACHE }, { timeout: 20000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  must(await page.evaluate(() => !!navigator.serviceWorker.controller), "current worker controls the upgraded page");
}

async function runSupportedUpgrade(browser, base, sourceState) {
  const context = await browser.newContext({ serviceWorkers: "allow", viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await installOldWorker(page, base);
    await writeReplicas(page, sourceState);
    const seededRaw = JSON.stringify(sourceState);
    await upgradeWorker(page, base);
    await waitForAppBoot(page, { base });
    const after = await readReplicas(page);
    check(after.localRaw === seededRaw && sameValue(after.idb, sourceState),
      "supported v1 recovery carrier survives old-worker -> current-worker upgrade without byte/object mutation");
    check(sameValue(after.local?.recoveryTransitions, sourceState.recoveryTransitions) &&
      sameValue(after.idb?.recoveryTransitions, sourceState.recoveryTransitions),
    "upgrade preserves every recovery record and quarantine entry in both replicas");
    const revision = sourceState._storageRevision;
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base });
    const second = await readReplicas(page);
    check(second.localRaw === seededRaw && sameValue(second.idb, sourceState) &&
      second.local?._storageRevision === revision && second.idb?._storageRevision === revision,
    "second boot after supported upgrade adds no revision, recovery record, archive, or carrier cleanup");
  } finally {
    await context.close();
  }
}

async function runUntouchedRecovery(browser, base, sourceState, kind, mutate) {
  const context = await browser.newContext({ serviceWorkers: "allow", viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const state = mutate(clone(sourceState));
  const seededRaw = JSON.stringify(state);
  try {
    await installOldWorker(page, base);
    await writeReplicas(page, state);
    const seeded = await readReplicas(page);
    await upgradeWorker(page, base);
    if (kind === "over-bound") {
      const fixtureProof = await page.evaluate(({ validState, invalidState }) => ({
        valid: typeof window.__repforgeValidateStateShape === "function" &&
          window.__repforgeValidateStateShape(validState),
        invalid: typeof window.__repforgeValidateStateShape === "function" &&
          !window.__repforgeValidateStateShape(invalidState),
      }), {
        validState: mutate(clone(sourceState), { bounded: true }),
        invalidState: state,
      });
      check(fixtureProof.valid && fixtureProof.invalid,
        "over-bound fixture is valid at the per-entry bound and invalid only at the aggregate bound", fixtureProof);
    }
    const recoveryOpen = await page.waitForFunction(
      () => document.querySelector("#storageRecovery")?.open === true,
      undefined,
      { timeout: 10000 },
    ).then(() => true).catch(() => false);
    check(recoveryOpen, `${kind} recovery carrier enters the existing full Storage Recovery boundary`);
    check(await page.evaluate(() => window.__repforgeBooted === true) === false,
      `${kind} recovery carrier does not complete normal app boot`);
    const after = await readReplicas(page);
    check(after.localRaw === seededRaw && sameValue(after.idb, state),
      `${kind} recovery carrier leaves both replicas exactly untouched before recovery choice`);
    check(after.local?._storageRevision === state._storageRevision && after.idb?._storageRevision === state._storageRevision,
      `${kind} recovery carrier performs zero durable revision writes`);
    check(sameValue(after.localKeys, seeded.localKeys),
      `${kind} recovery carrier creates no pending, sidecar, or recovery artifact before choice`);
    await page.reload({ waitUntil: "domcontentloaded" });
    const secondRecoveryOpen = await page.waitForFunction(
      () => document.querySelector("#storageRecovery")?.open === true,
      undefined,
      { timeout: 10000 },
    ).then(() => true).catch(() => false);
    check(secondRecoveryOpen, `${kind} full recovery re-enters identically on the second boot`);
    const second = await readReplicas(page);
    check(second.localRaw === seededRaw && sameValue(second.idb, state) &&
      second.local?._storageRevision === state._storageRevision &&
      second.idb?._storageRevision === state._storageRevision,
    `${kind} second boot preserves exact bytes, carrier revision, and zero durable writes`);
    check(sameValue(second.localKeys, seeded.localKeys),
      `${kind} second boot leaves no new pending, sidecar, or recovery artifact`);
  } finally {
    await context.close();
  }
}

function unknownRecoveryState(state) {
  state.recoveryTransitions = {
    schemaVersion: 2,
    records: clone(state.recoveryTransitions?.records || []),
    quarantine: clone(state.recoveryTransitions?.quarantine || []),
    requiredFutureField: { schemaVersion: 2, opaque: "r7-required-recovery-evidence" },
  };
  return state;
}

function validQuarantineEntry(entry) {
  return entry && entry.schemaVersion === 1 &&
    typeof entry.raw === "string" && entry.raw.length <= 10000 &&
    /^[0-9a-f]{64}$/.test(entry.digest) && entry.digest === hashUtf8(entry.raw) &&
    ["localStorage", "indexedDB", "both"].includes(entry.sourceReplica) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(entry.detectedAt) &&
    ["known-schema-malformed-recovery", "duplicate-target-conflict"].includes(entry.reason) &&
    Object.keys(entry).sort().join(",") === "detectedAt,digest,raw,reason,schemaVersion,sourceReplica";
}

function overBoundRecoveryFixture(state) {
  const template = state.recoveryTransitions?.quarantine?.[0];
  must(template, "source quarantine entry exists for over-bound upgrade fixture");
  const quarantine = Array.from({ length: 257 }, (_, index) => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      marker: `r7-over-bound-${index}`,
      source: "individually-valid-v1-quarantine-entry",
    });
    return {
      schemaVersion: 1,
      digest: hashUtf8(raw),
      raw,
      sourceReplica: "both",
      detectedAt: "2026-10-06T09:30:00.000Z",
      reason: "known-schema-malformed-recovery",
    };
  });
  must(quarantine.every(validQuarantineEntry), "every over-bound quarantine entry is independently valid and SHA-256 bound");
  must(new Set(quarantine.map((entry) => entry.digest)).size === quarantine.length,
    "over-bound quarantine entries have unique raw bytes and digests");
  const boundedState = clone(state);
  boundedState.recoveryTransitions = {
    schemaVersion: 1,
    records: clone(state.recoveryTransitions?.records || []),
    quarantine: quarantine.slice(0, 256),
  };
  const overBoundState = clone(state);
  overBoundState.recoveryTransitions = {
    schemaVersion: 1,
    records: clone(state.recoveryTransitions?.records || []),
    quarantine,
  };
  return { state: overBoundState, boundedState, quarantine };
}

function overBoundRecoveryState(state, options = {}) {
  const fixture = overBoundRecoveryFixture(state);
  if (options.bounded) return fixture.boundedState;
  return fixture.state;
}

function unknownRecoveryDocument(state) {
  const out = unknownRecoveryState(clone(state));
  must(out.recoveryTransitions.schemaVersion === 2 &&
    out.recoveryTransitions.records.length === state.recoveryTransitions.records.length &&
    out.recoveryTransitions.quarantine.every(validQuarantineEntry),
  "unknown recovery document changes only the carrier schema while retaining valid records/quarantine");
  return out;
}

/* Kept as a separate helper so the backup door and the upgrade door use the
   same exact invalid bytes, rather than each inventing a normalized object. */
function recoveryBoundaryDocument(sourceState, kind) {
  if (kind === "unknown-schema") return unknownRecoveryDocument(sourceState);
  return overBoundRecoveryState(sourceState);
}

async function main() {
  console.log("052-P7 R7: recovery carrier backup/transport/upgrade boundary oracle");
  console.log("Effective settings: model=native gpt-5.6-luna; reasoning_effort=max; fork_turns=none");
  await assertServingApp(BASE);
  const browser = await launchChromium();
  let sourceContext;
  try {
    sourceContext = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
    const sourcePage = await sourceContext.newPage();
    sourcePage.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    await sourcePage.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(sourcePage, { base: BASE });
    const activation = await activateProductionPredecessor(sourcePage);
    must(activation.ok, "production predecessor activation succeeds", activation);
    await sourcePage.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(sourcePage, { base: BASE });
    const replacement = await commitReplacement(sourcePage);
    must(replacement.ok, "production replacement commit succeeds", replacement);
    await sourcePage.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(sourcePage, { base: BASE });
    const recovery = await commitRecovery(sourcePage);
    must(recovery.ok, "production recovery commit succeeds", recovery);
    const sourceBeforeQuarantine = await readReplicas(sourcePage);
    const record = sourceBeforeQuarantine.local?.recoveryTransitions?.records?.[0];
    must(record, "production recovery commit produced one carrier record", sourceBeforeQuarantine);
    const quarantine = await addBoundedQuarantine(sourcePage, record);
    const source = await readReplicas(sourcePage);
    const sourceState = source.local;
    must(sourceState && sameValue(source.local, source.idb), "source production state is mirrored before R7 boundary tests");

    console.log("\n1. Full backup retains replacement and recovery provenance");
    check(sourceState.programMeta?.transitionIn?.transitionId === replacement.proposal.transitionId,
      "source carries production transition-in for the replacement");
    check(sourceState.programHistory?.length === 1 &&
      sourceState.programHistory[0]?.transitionOut?.transitionId === replacement.proposal.transitionId,
    "source carries exactly one replacement archive transition-out");
    check(sourceState.recoveryTransitions?.records?.length === 1 &&
      sameValue(sourceState.recoveryTransitions.quarantine?.[0], quarantine) &&
      sourceState.recoveryTransitions.records[0]?.archiveId === null &&
      !Object.prototype.hasOwnProperty.call(sourceState.recoveryTransitions.records[0], "successor"),
    "source recovery carrier has one no-successor/no-archive production record plus exact quarantine");
    check(sameValue(Object.keys(quarantine).sort(),
      ["detectedAt", "digest", "raw", "reason", "schemaVersion", "sourceReplica"].sort()) &&
      quarantine.schemaVersion === 1 && quarantine.digest === hashUtf8(quarantine.raw) &&
      quarantine.sourceReplica === "both" && quarantine.detectedAt === "2026-10-06T09:30:00.000Z" &&
      quarantine.reason === "known-schema-malformed-recovery" && quarantine.raw.includes("not-a-contract-outcome"),
    "independent quarantine oracle pins the exact v1 shape, UTF-8 digest, source, timestamp, and reason", quarantine);
    const backup = await exportBackup(sourcePage);
    const afterExport = await readReplicas(sourcePage);
    check(sameValue(backup.recoveryTransitions, afterExport.local.recoveryTransitions) &&
      sameValue(backup.programMeta.transitionIn, afterExport.local.programMeta.transitionIn) &&
      sameValue(backup.programHistory, afterExport.local.programHistory),
    "ordinary backup contains the exact recovery carrier, quarantine, transition-in, and archive transition-out");
    check(!Object.prototype.hasOwnProperty.call(backup, "_storageRevision") &&
      !Object.prototype.hasOwnProperty.call(backup, "_storageDraftTransaction") &&
      !Object.prototype.hasOwnProperty.call(backup, "_storageFollowUp"),
    "ordinary backup strips only storage transaction metadata while retaining logical recovery evidence");

    const targetContext = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
    const targetPage = await targetContext.newPage();
    targetPage.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    try {
      await targetPage.goto(BASE, { waitUntil: "domcontentloaded" });
      await waitForAppBoot(targetPage, { base: BASE });
      await importBackup(targetPage, backup);
      const imported = await readReplicas(targetPage);
      check(sameValue(withoutVolatile(imported.local), withoutVolatile(backup)) &&
        sameValue(withoutVolatile(imported.idb), withoutVolatile(backup)),
      "fresh-context backup Replace round-trips the exact logical document into both replicas");
      check(sameValue(imported.local.recoveryTransitions, backup.recoveryTransitions) &&
        sameValue(imported.idb.recoveryTransitions, backup.recoveryTransitions),
      "backup Replace retains carrier records/quarantine without array union or pruning");
      const importedRevision = imported.local?._storageRevision;
      const importedHistoryLength = imported.local?.programHistory?.length;
      const importedRecordCount = imported.local?.recoveryTransitions?.records?.length;
      const importedRaw = imported.localRaw;
      await targetPage.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(targetPage, { base: BASE });
      const reloaded = await readReplicas(targetPage);
      check(reloaded.localRaw === importedRaw && sameValue(reloaded.idb, imported.idb) &&
        reloaded.local?._storageRevision === importedRevision &&
        reloaded.local?.programHistory?.length === importedHistoryLength &&
        reloaded.local?.recoveryTransitions?.records?.length === importedRecordCount,
      "second backup boot adds no revision, recovery record, archive, or cleanup artifact");

      await rejectRecoveryBackupThroughReplaceDoor(browser, BASE, sourceState, "unknown-schema");
      await rejectRecoveryBackupThroughReplaceDoor(browser, BASE, sourceState, "over-bound");

      console.log("\n2. Program/setup/free-form transport doors exclude private recovery evidence");
      const programJson = await exportProgramJson(sourcePage);
      check(!hasForbiddenKey(programJson) && !Object.prototype.hasOwnProperty.call(programJson, "programHistory") &&
        !Object.prototype.hasOwnProperty.call(programJson, "log") &&
        programJson.meta?.programStructure?.provenance?.blueprintId ===
          afterExport.local.programMeta?.programStructure?.provenance?.blueprintId,
      "program JSON excludes recovery/history/block transition fields while retaining safe compiler structure provenance", programJson);
      const shared = await readSharedSetupPayload(sourcePage);
      must(shared.ok, "shared setup encode/decode public seams are available", shared);
      check(!hasForbiddenKey(shared.payload) && !hasForbiddenKey(shared.decoded.value) &&
        shared.payload.program?.meta?.programStructure?.provenance?.blueprintId ===
          afterExport.local.programMeta?.programStructure?.provenance?.blueprintId,
      "shared setup excludes private recovery/history evidence while retaining safe active compiler provenance", shared.payload);
      await runProgramFileDoor(browser, BASE, programJson, afterExport.local.programMeta?.programStructure?.provenance);
      await sourcePage.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(sourcePage, { base: BASE });
      const sharedFragment = await createSharedSetupLink(sourcePage);
      await runSharedSetupDoor(browser, BASE, sharedFragment, afterExport.local.programMeta?.programStructure?.provenance);
      await checkFreeformBoundary(sourcePage, afterExport);
    } finally {
      await targetContext.close();
    }

    console.log("\n3. Old/new worker upgrade preserves supported carriers and fails closed on unknown/over-bound sections");
    await new Promise((resolve) => upgradeServer.listen(0, "127.0.0.1", resolve));
    const address = upgradeServer.address();
    const upgradeBase = `http://127.0.0.1:${address.port}/`;
    const upgradeBrowser = await launchChromium();
    try {
      await runSupportedUpgrade(upgradeBrowser, upgradeBase, sourceState);
      await runUntouchedRecovery(upgradeBrowser, upgradeBase, sourceState, "unknown-schema", unknownRecoveryState);
      await runUntouchedRecovery(upgradeBrowser, upgradeBase, sourceState, "over-bound", overBoundRecoveryState);
    } finally {
      await upgradeBrowser.close();
      await new Promise((resolve) => upgradeServer.close(resolve));
    }
  } finally {
    await sourceContext?.close();
    await browser.close();
    rmSync(HISTORICAL_ROOT, { recursive: true, force: true });
  }
  console.log(`\nResult: ${passed} passed, ${failures.length} intended product failures, 0 harness failures`);
  if (failures.length) {
    console.error("Intended product failures:");
    for (const failure of failures) console.error(` - ${failure}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("HARNESS FAILURE (not an intended product assertion):");
  console.error(error?.stack || error);
  process.exitCode = 2;
});
