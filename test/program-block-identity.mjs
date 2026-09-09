#!/usr/bin/env node
/**
 * Plan 052 R5 prerequisite: production-backed block identity oracle.
 *
 * This suite is intentionally independent of the transition producer. It
 * drives existing activation, block-start, workout, and backup boundaries and
 * observes IndexedDB only as a second durable replica. The expected values are
 * the block-identity relationships in the Plan 052 contracts, not values
 * copied from a producer output.
 *
 * This file is an isolated red oracle for the clean contract head. It is not
 * registered in the shared suite inventory until the production consumers land.
 */
import { readFileSync } from "node:fs";
import { launchChromium, waitForAppBoot, assertServingApp } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:18652/";
const KEY = "repforge_v1";
const DRAFT_KEY = "repforge_draft_v1";
const DRAFT_CHECKPOINT_KEY = "repforge_draft_v1:v2-checkpoint";
const DB_NAME = "repforge";
const STORE_NAME = "kv";

const MODERN_BLOCK_ID = "block-oracle-modern-01";
const MERGE_SOURCE_BLOCK_ID = "block-oracle-merge-source-01";
const MERGE_HISTORY_BLOCK_ID = "block-oracle-history-01";
const LEGACY_PROGRAM_ID = "legacy-block-oracle-program";

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
  if (detail !== undefined) {
    console.error(`    Detail: ${typeof detail === "object" ? JSON.stringify(detail, null, 2) : detail}`);
  }
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

function sameValue(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function isOpaqueBlockId(value, programId) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 240 && value !== programId;
}

function hasKey(value, wanted, path = "$") {
  if (Array.isArray(value)) return value.some((item, index) => hasKey(item, wanted, `${path}[${index}]`));
  if (!value || typeof value !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(value, wanted)) return true;
  return Object.entries(value).some(([key, child]) => hasKey(child, wanted, `${path}.${key}`));
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
      const transaction = db.transaction(storeName, "readonly");
      const get = transaction.objectStore(storeName).get(key);
      get.onsuccess = () => {
        db.close();
        resolve(get.result ?? null);
      };
      get.onerror = () => {
        db.close();
        reject(get.error);
      };
    };
  }), { dbName: DB_NAME, storeName: STORE_NAME, key: KEY });
}

async function readReplicas(page) {
  const localRaw = await page.evaluate((key) => localStorage.getItem(key), KEY);
  const idb = await readIdb(page);
  const local = localRaw == null ? null : JSON.parse(localRaw);
  return {
    local,
    idb,
    localRaw,
    idbRaw: idb == null ? null : JSON.stringify(idb),
  };
}

async function readDraftBytes(page) {
  return page.evaluate(({ draft, checkpoint }) => ({
    raw: localStorage.getItem(draft),
    checkpoint: localStorage.getItem(checkpoint),
    artifacts: Object.fromEntries(Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter((key) => key?.startsWith(`${draft}:`))
      .sort()
      .map((key) => [key, localStorage.getItem(key)])),
  }), { draft: DRAFT_KEY, checkpoint: DRAFT_CHECKPOINT_KEY });
}

async function openFresh(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(() => {
    window.closeFirstRun?.();
    window.closeTour?.();
  });
  return { context, page };
}

async function flush(page) {
  await page.evaluate(() => window.__repforgeStorage.flush());
}

async function activateRealProgram(page, name = "Block identity oracle") {
  const result = await page.evaluate(async (programName) => {
    const adapter = window.RepForgeProgramEntryAdapter;
    const compiler = window.RepForgeProgramCompiler;
    if (!adapter || !compiler || typeof window.__repforgeFinalizeProgramSetup !== "function") {
      return { ok: false, error: "production program-entry activation seam unavailable" };
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
    baseProposal.programMeta.progressionRelations = JSON.parse(JSON.stringify(compiled.preview.progressionRelations || []));
    baseProposal.programMeta.progressionModifiers = [];
    baseProposal.programMeta.progressionIncompatibilities = [];
    baseProposal.programMeta.programStructure = JSON.parse(JSON.stringify(compiled.preview.programStructure));
    baseProposal.programMeta.compilerContext = JSON.parse(JSON.stringify(compiled.compilerContext));
    const finalized = await window.__repforgeFinalizeProgramSetup({
      exercises: compiled.preview.program,
      name: programName,
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
  }, name);
  if (!result.ok) throw new Error(`first-run activation failed: ${JSON.stringify(result)}`);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("repforge_v1") || "null")?.programMeta?.onboarded === true,
    undefined, { timeout: 10000 });
  await flush(page);
  return result;
}

async function startWorkout(page) {
  const day = await page.evaluate(() => window.__repforgeWorkoutDraft.state()?.program?.[0]?.day || "Day 1");
  const entered = await page.evaluate((dayLabel) => window.__repforgeEnterWorkout({ day: dayLabel, focus: false }), day);
  if (!entered || (entered.status && entered.status !== "ready")) {
    throw new Error(`production workout entry failed: ${JSON.stringify(entered)}`);
  }
  await page.locator("#workout input[data-k$='_load']").first().waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__repforgeWorkoutDraft.current()?.schemaVersion === 2, undefined, { timeout: 10000 });
}

async function setDraftDate(page, value) {
  return page.evaluate(async (date) => {
    const result = await window.__repforgeWorkoutDraft.dispatch("setSessionDate", { value: date });
    await window.__repforgeWorkoutDraft.flush();
    return result;
  }, value);
}

function draftPrescription(draft) {
  if (!draft?.program || !draft?.exercises) return null;
  return {
    program: {
      programId: draft.program.programId,
      programFingerprint: draft.program.programFingerprint,
      dayId: draft.program.dayId,
      dayLabel: draft.program.dayLabel,
      unit: draft.program.unit,
      rirMode: draft.program.rirMode,
    },
    exercises: draft.exerciseOrder.map((exerciseId) => {
      const exercise = draft.exercises[exerciseId];
      return {
        exerciseId,
        programmed: clone(exercise.programmed),
        sets: exercise.setOrder.map((setId) => {
          const set = exercise.sets[setId];
          return {
            setId: set.setId,
            ordinal: set.ordinal,
            role: set.role,
            programmed: clone(set.programmed),
          };
        }),
      };
    }),
  };
}

async function fillAndSaveOneSet(page) {
  await page.locator("#workout input[data-k$='_load']").first().fill("60");
  await page.locator("#workout input[data-k$='_reps']").first().fill("8");
  await page.locator("#workout input[data-k$='_rir']").first().fill("2");
  await page.locator("#workout button[data-save]").first().click();
  await page.waitForFunction(() => document.querySelector("#workout button[data-save]")?.getAttribute("aria-pressed") === "true",
    undefined, { timeout: 10000 });
  await page.locator("#logForm .btn--save").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === false, undefined, { timeout: 10000 });
  await page.locator("#sumDone").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === true, undefined, { timeout: 10000 });
  await flush(page);
}

async function openSettings(page) {
  await page.evaluate(() => {
    window.closeFirstRun?.();
    window.closeTour?.();
    window.__repforgeShowSettings?.();
  });
  await page.waitForFunction(() => document.querySelector("#settings")?.classList.contains("active"), undefined, { timeout: 10000 });
}

async function importBackupThroughUi(page, backup, choice) {
  await openSettings(page);
  await page.locator("#dataImportRow").click();
  await page.locator("#importJson").setInputFiles({
    name: "block-identity-oracle-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.locator("#importChoice").waitFor({ state: "visible" });
  const selector = choice === "merge" ? "#importMerge" : "#importReplace";
  await page.locator(selector).click();
  await page.waitForFunction(() => document.querySelector("#importChoice")?.open === false, undefined, { timeout: 10000 });
  await flush(page);
}

async function exportBackup(page) {
  await openSettings(page);
  await page.locator("#dataBackupRow").click();
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 10000 }),
    page.locator("#exportJson").click(),
  ]);
  return JSON.parse(readFileSync(await download.path(), "utf8"));
}

async function exportProgramJson(page) {
  await page.evaluate(() => document.querySelector('nav button[data-view="program"]')?.click());
  await page.waitForFunction(() => document.querySelector("#program")?.classList.contains("active"), undefined, { timeout: 10000 });
  if (await page.locator("#programEditorWrap").evaluate((element) => element.classList.contains("is-hidden"))) {
    await page.locator("#programEditToggle").click();
  }
  await page.waitForSelector('#programEditor [data-role="exercise"]', { timeout: 10000 });
  const advanced = page.locator("#program details.advanced");
  if (!(await advanced.getAttribute("open"))) await advanced.locator("summary").click();
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 10000 }),
    page.locator("#exportProgram").click(),
  ]);
  return JSON.parse(readFileSync(await download.path(), "utf8"));
}

function backupFixture({ blockId, programId, log = [], started = null } = {}) {
  return {
    settings: {},
    programMeta: {
      ...seedProgramMeta({ id: programId || "oracle-program", started }),
      ...(blockId === undefined ? {} : { blockId }),
    },
    program: seedProgram(),
    log,
    programHistory: [],
    customExercises: [],
  };
}

function legacyLogRow() {
  return {
    session: "legacy-session-01",
    date: "2026-09-01",
    day: "Day 1",
    name: "Hack squat",
    exerciseId: "seed-ex-1",
    set: 1,
    load: 60,
    reps: 8,
    rir: 2,
    created: "2026-09-01T09:00:00.000Z",
  };
}

function historicalLogRow() {
  return {
    ...legacyLogRow(),
    session: "merge-session-01",
    date: "2026-09-02",
    blockId: MERGE_HISTORY_BLOCK_ID,
  };
}

async function runActivationAndRepeat(browser) {
  console.log("\n1. First-run activation and ordinary repeat block");
  const { context, page } = await openFresh(browser);
  try {
    await activateRealProgram(page);
    const activated = await readReplicas(page);
    const localMeta = activated.local?.programMeta;
    const idbMeta = activated.idb?.programMeta;
    const activationRevision = activated.local?._storageRevision;
    check(isOpaqueBlockId(localMeta?.blockId, localMeta?.id),
      "first-run activation mints one non-empty opaque programMeta.blockId", localMeta?.blockId);
    check(isOpaqueBlockId(localMeta?.blockId, localMeta?.id) && localMeta?.blockId === idbMeta?.blockId,
      "activation writes the same blockId to localStorage and IndexedDB",
      { local: localMeta?.blockId, idb: idbMeta?.blockId });
    check(activated.local?._storageRevision === activated.idb?._storageRevision,
      "activation mirrors one durable revision", { local: activated.local?._storageRevision, idb: activated.idb?._storageRevision });

    const blockId = localMeta?.blockId;
    const programId = localMeta?.id;
    const beforeReloadRaw = activated.localRaw;
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await flush(page);
    const reloaded = await readReplicas(page);
    check(isOpaqueBlockId(blockId, reloaded.local?.programMeta?.id) &&
      reloaded.local?.programMeta?.blockId === blockId && reloaded.idb?.programMeta?.blockId === blockId,
      "reload preserves the activated blockId", { before: blockId, after: reloaded.local?.programMeta?.blockId });
    check(reloaded.local?._storageRevision === activationRevision && reloaded.idb?._storageRevision === activationRevision,
      "second boot does not churn the activation revision", {
        before: activationRevision,
        local: reloaded.local?._storageRevision,
        idb: reloaded.idb?._storageRevision,
      });
    check(reloaded.localRaw === beforeReloadRaw,
      "second boot leaves the activation localStorage bytes unchanged");

    const before = await readReplicas(page);
    const oldRevision = before.local?._storageRevision;
    const oldProgramId = before.local?.programMeta?.id;
    const repeatResults = await page.evaluate(() => Promise.all([
      window.__repforgeCommitNextBlock("repeat"),
      window.__repforgeCommitNextBlock("repeat"),
    ]));
    await flush(page);
    await page.waitForFunction((revision) => JSON.parse(localStorage.getItem("repforge_v1") || "null")?._storageRevision === revision + 1,
      oldRevision, { timeout: 10000 });
    const after = await readReplicas(page);
    const nextMeta = after.local?.programMeta;
    check(repeatResults.every((result) => result?.committed === true),
      "ordinary repeat/continue block completes through the production block-start seam", repeatResults);
    check(nextMeta?.id === oldProgramId,
      "ordinary repeat keeps the program identity", { before: oldProgramId, after: nextMeta?.id });
    check(isOpaqueBlockId(blockId, programId) && isOpaqueBlockId(nextMeta?.blockId, nextMeta?.id) &&
      nextMeta?.blockId !== blockId,
      "ordinary repeat mints a distinct blockId", { before: blockId, after: nextMeta?.blockId });
    check(after.local?._storageRevision === oldRevision + 1 && after.idb?._storageRevision === oldRevision + 1,
      "repeat changes both durable replicas in exactly one revision", {
        before: oldRevision,
        local: after.local?._storageRevision,
        idb: after.idb?._storageRevision,
      });

    const afterRepeatRaw = after.localRaw;
    const afterRepeatBlockId = after.local?.programMeta?.blockId;
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await flush(page);
    const secondBoot = await readReplicas(page);
    check(isOpaqueBlockId(afterRepeatBlockId, secondBoot.local?.programMeta?.id) &&
      secondBoot.local?.programMeta?.blockId === afterRepeatBlockId,
      "duplicate/retry and second boot do not mint a third blockId", {
        first: blockId,
        repeat: afterRepeatBlockId,
        boot: secondBoot.local?.programMeta?.blockId,
      });
    check(secondBoot.local?._storageRevision === after.local?._storageRevision &&
      secondBoot.idb?._storageRevision === after.idb?._storageRevision,
    "duplicate/retry and second boot do not add a revision", {
      repeat: after.local?._storageRevision,
      bootLocal: secondBoot.local?._storageRevision,
      bootIdb: secondBoot.idb?._storageRevision,
    });
    check(secondBoot.localRaw === afterRepeatRaw,
      "second boot leaves the successful repeat state bytes unchanged");
  } finally {
    await context.close();
  }
}

async function runDraftAndSave(browser) {
  console.log("\n2. DraftV2 identity, week-boundary capture, and saved rows");
  const { context, page } = await openFresh(browser);
  try {
    await activateRealProgram(page, "Draft identity oracle");
    const active = await readReplicas(page);
    const expectedBlockId = active.local?.programMeta?.blockId;

    // Use the visible program-start field to make the date transition a real
    // week-one → week-two boundary. The app has no public clock-install seam;
    // the draft's existing date command is the production boundary stimulus.
    const dates = await page.evaluate(() => {
      const started = new Date();
      started.setDate(started.getDate() - 8);
      const beforeBoundary = new Date(started);
      beforeBoundary.setDate(beforeBoundary.getDate() + 6);
      const afterBoundary = new Date(started);
      afterBoundary.setDate(afterBoundary.getDate() + 8);
      const format = (value) => value.toISOString().slice(0, 10);
      return {
        started: format(started),
        beforeBoundary: format(beforeBoundary),
        afterBoundary: format(afterBoundary),
      };
    });
    await page.evaluate(() => {
      window.closeTour?.();
      window.closeFirstRun?.();
      document.querySelector('nav button[data-view="program"]')?.click();
    });
    await page.waitForFunction(() => document.querySelector("#program")?.classList.contains("active"), undefined, { timeout: 10000 });
    if (await page.locator("#programEditorWrap").evaluate((element) => element.classList.contains("is-hidden"))) {
      await page.locator("#programEditToggle").click();
    }
    await page.locator("#programStarted").fill(dates.started);
    await page.locator("#programStarted").dispatchEvent("change");
    await page.waitForFunction((value) => JSON.parse(localStorage.getItem("repforge_v1") || "null")?.programMeta?.started === value,
      dates.started, { timeout: 10000 });

    await page.evaluate(() => document.querySelector('nav button[data-view="log"]')?.click());
    await page.waitForFunction(() => document.querySelector("#log")?.classList.contains("active"), undefined, { timeout: 10000 });
    await startWorkout(page);
    const lifecycle = await page.evaluate(() => window.__repforgeMesocycleWeek?.());
    check(lifecycle?.elapsedWeek >= 2 && lifecycle?.current >= 2,
      "the production lifecycle reports week two after the visible start-date edit", lifecycle);
    const beforeDateChange = await setDraftDate(page, dates.beforeBoundary);
    check(beforeDateChange?.status === "applied", "a DraftV2 can be placed in week one through its public date command", beforeDateChange);

    // Read the public DraftV2 seam directly and return only an ordinary JSON
    // value; the test never calls a producer-side normalizer.
    const before = await page.evaluate(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      return draft ? JSON.parse(JSON.stringify(draft)) : null;
    });
    check(isOpaqueBlockId(before?.program?.blockId, active.local?.programMeta?.id),
      "a newly created DraftV2 carries the active blockId", before?.program?.blockId);
    check(isOpaqueBlockId(expectedBlockId, active.local?.programMeta?.id) &&
      before?.program?.blockId === expectedBlockId,
      "DraftV2 blockId equals the active programMeta.blockId", {
        draft: before?.program?.blockId,
        active: expectedBlockId,
      });

    const beforePrescription = draftPrescription(before);
    const dateChange = await setDraftDate(page, dates.afterBoundary);
    check(dateChange?.status === "applied", "a real DraftV2 date edit crosses the simulated week boundary", dateChange);
    const afterBoundary = await page.evaluate(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      return draft ? JSON.parse(JSON.stringify(draft)) : null;
    });
    check(isOpaqueBlockId(before?.program?.blockId, active.local?.programMeta?.id) &&
      afterBoundary?.program?.blockId === before?.program?.blockId,
      "a draft crossing the simulated week boundary keeps its captured blockId", {
        before: before?.program?.blockId,
        after: afterBoundary?.program?.blockId,
      });
    check(sameValue(draftPrescription(afterBoundary), beforePrescription),
      "a draft crossing the simulated week boundary keeps its captured prescription");

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await flush(page);
    const reloadedDraft = await page.evaluate(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      return draft ? JSON.parse(JSON.stringify(draft)) : null;
    });
    check(isOpaqueBlockId(before?.program?.blockId, active.local?.programMeta?.id) &&
      reloadedDraft?.program?.blockId === before?.program?.blockId,
      "reload preserves the DraftV2 block identity after the boundary");
    check(sameValue(draftPrescription(reloadedDraft), beforePrescription),
      "reload preserves the DraftV2 prescription after the boundary");

    await fillAndSaveOneSet(page);
    const saved = await readReplicas(page);
    const rows = saved.local?.log?.filter((row) => row?.session === before?.draftId) || [];
    check(rows.length > 0, "the real workout UI writes at least one saved row", rows.length);
    check(rows.length > 0 && rows.every((row) => row.blockId === before?.program?.blockId && isOpaqueBlockId(row.blockId, saved.local?.programMeta?.id)),
      "every row in the saved session carries the exact DraftV2 blockId", rows.map((row) => row.blockId));
    const idbRows = saved.idb?.log?.filter((row) => row?.session === before?.draftId) || [];
    check(idbRows.length > 0 && idbRows.every((row) => row.blockId === before?.program?.blockId &&
      isOpaqueBlockId(row.blockId, saved.idb?.programMeta?.id)),
      "IndexedDB carries the same immutable blockId on every saved row");
  } finally {
    await context.close();
  }
}

async function runLegacyBoot(browser) {
  console.log("\n3. Legacy state and rows stay without inferred block identity");
  const { context, page } = await openFresh(browser);
  try {
    const legacy = backupFixture({ programId: LEGACY_PROGRAM_ID, log: [legacyLogRow()] });
    await importBackupThroughUi(page, legacy, "replace");
    const imported = await readReplicas(page);
    const beforeRevision = imported.local?._storageRevision;
    const beforeRaw = imported.localRaw;
    check(!Object.prototype.hasOwnProperty.call(imported.local?.programMeta || {}, "blockId"),
      "a legacy backup has no blockId before reboot");
    check((imported.local?.log || []).every((row) => !Object.prototype.hasOwnProperty.call(row, "blockId")),
      "legacy workout rows remain without blockId and are not inferred");

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await flush(page);
    const reloaded = await readReplicas(page);
    check(!Object.prototype.hasOwnProperty.call(reloaded.local?.programMeta || {}, "blockId") &&
      !Object.prototype.hasOwnProperty.call(reloaded.idb?.programMeta || {}, "blockId"),
    "legacy state boots without minting a blockId");
    check(reloaded.local?._storageRevision === beforeRevision && reloaded.idb?._storageRevision === beforeRevision,
      "legacy boot does not churn the durable revision", {
        before: beforeRevision,
        local: reloaded.local?._storageRevision,
        idb: reloaded.idb?._storageRevision,
      });
    check(reloaded.localRaw === beforeRaw, "legacy boot preserves the exact state bytes");
    check((reloaded.local?.log || []).every((row) => !Object.prototype.hasOwnProperty.call(row, "blockId")),
      "legacy boot never backfills blockId onto historical rows");
  } finally {
    await context.close();
  }
}

async function runBackupBoundaries(browser) {
  console.log("\n4. Program export and full-backup/merge block boundaries");
  const source = await openFresh(browser);
  const target = await openFresh(browser);
  try {
    const modern = backupFixture({
      blockId: MODERN_BLOCK_ID,
      programId: "backup-source-program",
      log: [historicalLogRow()],
    });
    await importBackupThroughUi(source.page, modern, "replace");
    const sourceState = await readReplicas(source.page);
    check(sourceState.local?.programMeta?.blockId === MODERN_BLOCK_ID,
      "full-backup replace activates the supplied modern block identity", sourceState.local?.programMeta?.blockId);
    check(sourceState.local?.programMeta?.blockId === MODERN_BLOCK_ID &&
      sourceState.local?.programMeta?.blockId === sourceState.idb?.programMeta?.blockId,
      "full-backup replace mirrors block identity in both replicas");

    const programExport = await exportProgramJson(source.page);
    check(!hasKey(programExport, "blockId"), "program JSON export omits blockId", programExport);

    const backupExport = await exportBackup(source.page);
    check(backupExport.programMeta?.blockId === MODERN_BLOCK_ID,
      "full backup export carries the active block identity", backupExport.programMeta?.blockId);
    check(backupExport.log?.[0]?.blockId === MERGE_HISTORY_BLOCK_ID,
      "full backup export preserves historical row blockId", backupExport.log?.[0]?.blockId);

    await importBackupThroughUi(target.page, backupExport, "replace");
    const replaced = await readReplicas(target.page);
    check(replaced.local?.programMeta?.blockId === MODERN_BLOCK_ID &&
      replaced.idb?.programMeta?.blockId === MODERN_BLOCK_ID,
    "full backup replace round-trips the exact active blockId", {
      local: replaced.local?.programMeta?.blockId,
      idb: replaced.idb?.programMeta?.blockId,
    });

    const destinationBlockBeforeMerge = replaced.local?.programMeta?.blockId;
    const mergeSource = backupFixture({
      blockId: MERGE_SOURCE_BLOCK_ID,
      programId: "merge-source-program",
      log: [historicalLogRow()],
    });
    await importBackupThroughUi(target.page, mergeSource, "merge");
    const merged = await readReplicas(target.page);
    const mergedRow = merged.local?.log?.find((row) => row.session === "merge-session-01");
    check(destinationBlockBeforeMerge === MODERN_BLOCK_ID &&
      merged.local?.programMeta?.blockId === destinationBlockBeforeMerge &&
      merged.idb?.programMeta?.blockId === destinationBlockBeforeMerge,
    "backup Merge leaves the destination current blockId unchanged", {
      before: destinationBlockBeforeMerge,
      local: merged.local?.programMeta?.blockId,
      idb: merged.idb?.programMeta?.blockId,
    });
    check(mergedRow?.blockId === MERGE_HISTORY_BLOCK_ID &&
      merged.idb?.log?.find((row) => row.session === "merge-session-01")?.blockId === MERGE_HISTORY_BLOCK_ID,
    "backup Merge imports the new workout row with its historical blockId", mergedRow?.blockId);
  } finally {
    await source.context.close();
    await target.context.close();
  }
}

async function runLiveDraftGuard(browser) {
  console.log("\n5. Live DraftV2 blocks the next ordinary block start");
  const { context, page } = await openFresh(browser);
  try {
    await activateRealProgram(page, "Live draft guard oracle");
    await startWorkout(page);
    await page.locator("#workout input[data-k$='_load']").first().fill("72.5");
    await page.locator("#workout input[data-k$='_reps']").first().fill("9");
    // The existing public DraftV2 adapter is the production write boundary;
    // use it after the real input interaction so the guard observes an
    // acknowledged, non-pristine draft rather than a pending DOM event.
    const editResult = await page.evaluate(async () => {
      const draft = window.__repforgeWorkoutDraft.current();
      const exerciseId = draft?.exerciseOrder?.[0];
      const setId = draft?.exercises?.[exerciseId]?.setOrder?.[0];
      if (!exerciseId || !setId) return { status: "missing-set" };
      const result = await window.__repforgeWorkoutDraft.dispatch("editSetField", {
        exerciseInstanceId: exerciseId,
        setId,
        field: "load",
        value: "72.5",
      });
      await window.__repforgeWorkoutDraft.flush();
      return result;
    });
    if (editResult?.status !== "applied") throw new Error(`live DraftV2 edit failed: ${JSON.stringify(editResult)}`);
    await page.waitForFunction(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      return draft?.exerciseOrder?.some((exerciseId) =>
        Object.values(draft.exercises?.[exerciseId]?.sets || {}).some((set) => set.edited?.load === "72.5"));
    }, undefined, { timeout: 10000 });
    await flush(page);
    const beforeState = await readReplicas(page);
    const beforeDraft = await readDraftBytes(page);
    const result = await page.evaluate(() => window.__repforgeCommitNextBlock("repeat"));
    await flush(page);
    const afterState = await readReplicas(page);
    const afterDraft = await readDraftBytes(page);
    check(result?.committed !== true && result?.localOk === false && result?.idbOk === false,
      "a live DraftV2 makes the next-block start fail without a commit", result);
    check(afterState.localRaw === beforeState.localRaw && afterState.idbRaw === beforeState.idbRaw,
      "live-draft refusal performs zero durable state writes");
    check(afterState.local?._storageRevision === beforeState.local?._storageRevision &&
      afterState.idb?._storageRevision === beforeState.idb?._storageRevision,
    "live-draft refusal preserves both durable revisions");
    check(afterDraft.raw === beforeDraft.raw && afterDraft.checkpoint === beforeDraft.checkpoint,
      "live-draft refusal preserves exact DraftV2 and checkpoint bytes", {
        raw: afterDraft.raw === beforeDraft.raw,
        checkpoint: afterDraft.checkpoint === beforeDraft.checkpoint,
      });
  } finally {
    await context.close();
  }
}

async function runDeferredOnboardingGuard(browser, edited) {
  console.log(`\n6${edited ? "b" : "a"}. Deferred onboarding refuses a newly present ${edited ? "edited" : "pristine"} DraftV2`);
  const { context, page } = await openFresh(browser);
  try {
    await activateRealProgram(page, `Deferred ${edited ? "edited" : "pristine"} guard oracle`);
    const deferred = await page.evaluate(() => window.__repforgeCommitNextBlock("onboarding"));
    check(deferred?.deferred === true && deferred?.committed !== true,
      "an onboarding block start with no draft defers to the entry flow", deferred);
    // The deferred entry surface is not the draft boundary. Hide it while
    // creating the exact V2 value that must be refused at final activation.
    await page.evaluate(() => window.closeOnboarding?.());
    await startWorkout(page);
    if (edited) {
      const edit = await page.evaluate(async () => {
        const draft = window.__repforgeWorkoutDraft.current();
        const exerciseId = draft?.exerciseOrder?.[0];
        const setId = draft?.exercises?.[exerciseId]?.setOrder?.[0];
        if (!exerciseId || !setId) return { status: "missing-set" };
        const result = await window.__repforgeWorkoutDraft.dispatch("editSetField", {
          exerciseInstanceId: exerciseId,
          setId,
          field: "load",
          value: "72.5",
        });
        await window.__repforgeWorkoutDraft.flush();
        return result;
      });
      check(edit?.status === "applied", "the deferred edited case has an acknowledged V2 edit", edit);
    }
    await flush(page);
    const beforeState = await readReplicas(page);
    const beforeDraft = await readDraftBytes(page);
    const beforeCheckpointKind = JSON.parse(beforeDraft.checkpoint || "null")?.kind;
    const result = await page.evaluate(async () => {
      const current = window.__repforgeWorkoutDraft.state();
      return window.__repforgeFinalizeProgramSetup({
        exercises: current.program,
        name: current.programMeta?.name || "Deferred guard",
        answers: { goal: "strength_hypertrophy", daysPerWeek: 4 },
        destination: "log",
        origin: "block",
        draftConfirmed: true,
        telemetryRoute: "custom",
        entrySource: { route: "custom" },
        baseProposal: current,
        programStructure: current.programMeta?.programStructure || null,
      });
    });
    await flush(page);
    const afterState = await readReplicas(page);
    const afterDraft = await readDraftBytes(page);
    check(result?.committed !== true && result?.localOk === false && result?.idbOk === false &&
      result?.code === "live_draft_blocks_next_block",
      "deferred onboarding refuses at the later activation boundary before a commit", result);
    check(afterState.localRaw === beforeState.localRaw && afterState.idbRaw === beforeState.idbRaw,
      "deferred onboarding refusal performs zero durable state writes");
    check(afterState.local?._storageRevision === beforeState.local?._storageRevision &&
      afterState.idb?._storageRevision === beforeState.idb?._storageRevision &&
      afterState.local?.programMeta?.id === beforeState.local?.programMeta?.id &&
      afterState.local?.programMeta?.blockId === beforeState.local?.programMeta?.blockId,
      "deferred onboarding refusal preserves program identity, block identity, and revision");
    check(afterDraft.raw === beforeDraft.raw && afterDraft.checkpoint === beforeDraft.checkpoint &&
      sameValue(afterDraft.artifacts, beforeDraft.artifacts),
      "deferred onboarding refusal preserves exact canonical, pending, and checkpoint bytes", {
        raw: afterDraft.raw === beforeDraft.raw,
        checkpoint: afterDraft.checkpoint === beforeDraft.checkpoint,
        artifacts: sameValue(afterDraft.artifacts, beforeDraft.artifacts),
      });
    check(beforeCheckpointKind !== "tombstone" && JSON.parse(afterDraft.checkpoint || "null")?.kind !== "tombstone",
      "deferred onboarding refusal never creates a DraftV2 tombstone", {
        before: beforeCheckpointKind,
        after: JSON.parse(afterDraft.checkpoint || "null")?.kind,
      });
  } finally {
    await context.close();
  }
}

async function runCheckpointAuthorityGuard(browser) {
  console.log("\n7. A committed checkpoint remains authoritative after a legacy canonical overwrite");
  const { context, page } = await openFresh(browser);
  try {
    await activateRealProgram(page, "Checkpoint authority guard oracle");
    await startWorkout(page);
    await flush(page);
    const acknowledged = await readDraftBytes(page);
    const acknowledgedCheckpoint = JSON.parse(acknowledged.checkpoint || "null");
    check(acknowledgedCheckpoint?.kind === "committed" && typeof acknowledgedCheckpoint?.raw === "string",
      "the authority case starts from a committed DraftV2 checkpoint", acknowledgedCheckpoint?.kind);
    const legacyRaw = JSON.stringify({ __day: "Day 1", __touched: [] });
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: DRAFT_KEY, raw: legacyRaw });
    const beforeState = await readReplicas(page);
    const beforeDraft = await readDraftBytes(page);
    check(beforeDraft.raw === legacyRaw && beforeDraft.checkpoint === acknowledged.checkpoint,
      "a legacy writer can be represented without changing the acknowledged checkpoint bytes");
    const result = await page.evaluate(() => window.__repforgeCommitNextBlock("repeat"));
    await flush(page);
    const afterState = await readReplicas(page);
    const afterDraft = await readDraftBytes(page);
    check(result?.committed !== true && result?.localOk === false && result?.idbOk === false &&
      result?.code === "live_draft_blocks_next_block",
      "a checkpoint-acknowledged DraftV2 blocks repeat after canonical legacy overwrite", result);
    check(afterState.localRaw === beforeState.localRaw && afterState.idbRaw === beforeState.idbRaw &&
      afterState.local?._storageRevision === beforeState.local?._storageRevision &&
      afterState.idb?._storageRevision === beforeState.idb?._storageRevision,
      "checkpoint-authority refusal preserves both replicas and their revision");
    check(afterDraft.raw === beforeDraft.raw && afterDraft.raw === legacyRaw &&
      afterDraft.checkpoint === beforeDraft.checkpoint &&
      afterDraft.checkpoint === acknowledged.checkpoint &&
      sameValue(afterDraft.artifacts, beforeDraft.artifacts),
      "checkpoint-authority refusal preserves legacy canonical and acknowledged V2 checkpoint bytes", {
        canonical: afterDraft.raw === legacyRaw,
        checkpoint: afterDraft.checkpoint === acknowledged.checkpoint,
        artifacts: sameValue(afterDraft.artifacts, beforeDraft.artifacts),
      });
    check(JSON.parse(afterDraft.checkpoint || "null")?.kind !== "tombstone",
      "checkpoint-authority refusal does not create a tombstone");
  } finally {
    await context.close();
  }
}

async function runBlockGuardNegativeControls(browser) {
  console.log("\n8. No-V2, legacy-only, and tombstone controls still permit ordinary starts");
  const cases = [
    { label: "no V2", prepare: async () => {} },
    { label: "legacy-only", prepare: async (page) => {
      await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ __day: "Day 1" })), DRAFT_KEY);
    } },
    { label: "tombstone", prepare: async (page) => {
      await startWorkout(page);
      const cleared = await page.evaluate(() => window.__repforgeWorkoutDraft.clear());
      if (!cleared) throw new Error("failed to create the tombstone control");
      await flush(page);
      const checkpoint = await page.evaluate(() => window.__repforgeWorkoutDraft.checkpoint());
      check(checkpoint?.status === "valid" && checkpoint.value?.kind === "tombstone",
        "tombstone control has an acknowledged removal marker", checkpoint);
    } },
  ];
  for (const control of cases) {
    const { context, page } = await openFresh(browser);
    try {
      await activateRealProgram(page, `${control.label} control`);
      await control.prepare(page);
      await flush(page);
      const before = await readReplicas(page);
      const result = await page.evaluate(() => window.__repforgeCommitNextBlock("repeat"));
      await page.waitForFunction((revision) =>
        JSON.parse(localStorage.getItem("repforge_v1") || "null")?._storageRevision === revision + 1,
      before.local?._storageRevision, { timeout: 10000 });
      await flush(page);
      const after = await readReplicas(page);
      check(result?.committed === true,
        `${control.label} does not trigger the live DraftV2 block-start guard`, result);
      check(after.local?._storageRevision === before.local?._storageRevision + 1 &&
        after.idb?._storageRevision === before.idb?._storageRevision + 1,
        `${control.label} ordinary start advances both replicas exactly once`);
    } finally {
      await context.close();
    }
  }
}

async function main() {
  console.log(`052 R5 block identity oracle against ${BASE}`);
  await assertServingApp(BASE);
  const browser = await launchChromium();
  try {
    await runActivationAndRepeat(browser);
    await runDraftAndSave(browser);
    await runLegacyBoot(browser);
    await runBackupBoundaries(browser);
    await runLiveDraftGuard(browser);
    await runDeferredOnboardingGuard(browser, false);
    await runDeferredOnboardingGuard(browser, true);
    await runCheckpointAuthorityGuard(browser);
    await runBlockGuardNegativeControls(browser);
  } finally {
    await browser.close();
  }

  console.log(`\nAssertions: ${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.error("Intended red-oracle failures:");
    for (const failure of failures) console.error(` - ${failure}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
