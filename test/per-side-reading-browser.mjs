#!/usr/bin/env node
/** Plan 069 S2: production per-side logging, reading, Progress and CSV. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const CATALOG = JSON.parse(readFileSync(new URL("../assets/exercise-catalog.json", import.meta.url), "utf8"));
const STATE_KEY = "repforge_v1";
const DB_NAME = "repforge";
const DB_STORE = "kv";
const DB_KEY = STATE_KEY;
const ROW_ID = "1a55c6f170d88031b658c6e278a82a88";
const PRESS_ID = "1a05c6f170d8803ba48ec1443eab5978";
const UNKNOWN_ID = "3895c6f170d88002b51fdf96c7dc50e1";
const LOAD_ID = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS_SIDE_ID = "25a5c6f170d880baaa2dc8c7b67d4b65";
const LOAD_SIDE_ID = "25a5c6f170d880e2990fc88146f7de56";
const failures = [];
let passed = 0;

function check(condition, message, detail) {
  if (condition) {
    passed++;
    console.log("  ✓ " + message);
  } else {
    failures.push(message);
    console.error("  ✗ " + message);
    if (detail !== undefined) console.error("    " + JSON.stringify(detail));
  }
}

function csvRows(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

async function readIdb(page) {
  return page.evaluate(({ dbName, storeName, key }) => new Promise((resolve, reject) => {
    const open = indexedDB.open(dbName);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).get(key);
      request.onsuccess = () => { const value = request.result ?? null; db.close(); resolve(value); };
      request.onerror = () => { const error = request.error; db.close(); reject(error); };
    };
  }), { dbName: DB_NAME, storeName: DB_STORE, key: DB_KEY });
}

async function replicas(page) {
  const localRaw = await page.evaluate((key) => localStorage.getItem(key), STATE_KEY);
  return { localRaw, local: JSON.parse(localRaw || "null"), idb: await readIdb(page) };
}

async function installProgram(page) {
  return page.evaluate(async ({ rowId, pressId }) => {
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const answers = {
      desiredResult: "muscle_growth",
      structuredExperience: "6_to_24m",
      daysPerWeek: 2,
      sessionMinutes: 90,
      environment: { kind: "commercial_gym" },
      mustHaveExercises: [rowId, pressId],
    };
    const mapped = window.RepForgeProgramEntryAdapter.programRequestFromAnswers(answers, catalog);
    if (!mapped.ok) throw new Error("Could not prepare the catalog request: " + JSON.stringify(mapped.conflicts));
    const generated = window.RepForgeProgramCompiler.generateProgram(mapped.value, catalog, "p069-s2-per-side-reading");
    if (!generated.ok) throw new Error("Could not generate the production program: " + JSON.stringify(generated.conflicts));
    const finalized = await window.__repforgeFinalizeProgramSetup({
      programDefinition: generated.value,
      name: "Per-side reading proof",
      answers: {},
      destination: "log",
      origin: "first-run",
      draftConfirmed: true,
      telemetryRoute: "recommend",
      entrySource: { route: "recommend", fingerprint: "p069-s2-per-side-reading" },
    });
    await window.__repforgeStorage.flush();
    const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const rows = state.program.filter(row => row.libraryId === rowId || row.libraryId === pressId);
    const slots = (state.programMeta?.programDefinition?.days || []).flatMap(day => day.slots || [])
      .filter(slot => slot.exerciseId === rowId || slot.exerciseId === pressId);
    return { finalized, rows, slots, program: state.program, programMeta: state.programMeta };
  }, { rowId: ROW_ID, pressId: PRESS_ID });
}

async function fillMetric(page, metricId, value) {
  const input = page.locator('#workout .exercise.is-current .focus-shelf input[data-metric-id="' + metricId + '"]');
  await input.waitFor({ state: "attached", timeout: 10000 });
  if (await input.getAttribute("aria-hidden") === "true") {
    await page.locator('#workout .exercise.is-current .focus-shelf [data-shelf-field="metric_' + metricId + '"]').click();
  }
  await input.waitFor({ state: "visible", timeout: 10000 });
  await input.fill(String(value));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

async function logSet(page, programRowId, metrics, values, rirValue = 2) {
  await page.evaluate((id) => window.__repforgeGoToLogExercise(id), programRowId);
  await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 15000 });
  await page.waitForFunction((id) => document.querySelector("#workout .exercise.is-current")?.dataset.ex === id,
    programRowId, { timeout: 15000 });
  for (const metric of metrics) await fillMetric(page, metric.id, values[metric.name]);
  const rir = page.locator('#workout .exercise.is-current .focus-shelf input[data-k="' + programRowId + '_1_rir"]');
  if (await rir.getAttribute("aria-hidden") === "true")
    await page.locator('#workout .exercise.is-current .focus-shelf [data-shelf-field="rir"]').click();
  await rir.fill(String(rirValue));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.locator('#workout .exercise.is-current [data-save="' + programRowId + '_1"]').click();
  await page.waitForFunction((id) => {
    const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
    const setId = exercise?.setOrder?.find(key => exercise.sets[key].ordinal === 1);
    return !!exercise?.sets?.[setId]?.completion;
  }, programRowId, { timeout: 15000 });
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

async function finishEarly(page) {
  await page.locator("#sessionSheetBtn").click();
  await page.locator("#sessionEarlyFinish").click();
  await page.locator("#sessionEarlyConfirm").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === false,
    undefined, { timeout: 15000 });
  await page.locator("#sumDone").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === true,
    undefined, { timeout: 10000 });
  await page.evaluate(() => window.__repforgeStorage.flush());
}

async function logSession(page, rows, { rowLoad = 20, pressLoad }) {
  const catalogRow = CATALOG.exercises.find(entry => entry.id === ROW_ID);
  const catalogPress = CATALOG.exercises.find(entry => entry.id === PRESS_ID);
  const rowProgram = rows.find(entry => entry.libraryId === ROW_ID);
  const pressProgram = rows.find(entry => entry.libraryId === PRESS_ID);
  if (!rowProgram || !pressProgram || rowProgram.day !== pressProgram.day)
    throw new Error("The selected production program did not place both catalog movements on one day");
  const rowMetrics = catalogRow.exerciseMetrics.map(id => ({ id, name: CATALOG.uuidIndex[id].name }));
  const pressMetrics = catalogPress.exerciseMetrics.map(id => ({ id, name: CATALOG.uuidIndex[id].name }));
  await logSet(page, rowProgram.id, rowMetrics, { "Weight": rowLoad, "Reps per side": 8 });
  await logSet(page, pressProgram.id, pressMetrics, { "Weight per side": pressLoad, "Reps per side": 8 });
  await finishEarly(page);
}

async function readSession(page, sessionId) {
  await page.locator('#sessions .hist-row[data-sess="' + sessionId + '"] .session__open').click();
  const reading = page.locator('.session--read[data-reading="' + sessionId + '"]');
  await reading.waitFor({ state: "visible", timeout: 10000 });
  return reading.evaluate(root => ({
    totals: [...root.querySelectorAll(".histpage__totals > div")].map(cell => ({
      value: cell.querySelector("b")?.textContent.trim() || "",
      label: cell.querySelector("span")?.textContent.trim() || "",
    })),
    lifts: [...root.querySelectorAll("section[data-history-exercise-id]")].map(section => ({
      exerciseId: section.dataset.historyExerciseId,
      headers: [...section.querySelectorAll(".histpage__cols .fx-col")].map(node => node.textContent.trim()),
      record: section.querySelector(".verdictmark--record")?.textContent.replace(/\s+/g, " ").trim() || "",
    })),
  }));
}

async function persistState(page, state) {
  await page.evaluate(async ({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(state, key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { const error = tx.error; db.close(); reject(error); };
    });
  }, { key: STATE_KEY, state });
}

async function main() {
  const browser = await launchChromium();
  const observations = {};
  try {
    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 }, locale: "en-US", timezoneId: "UTC" });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", error => { pageErrors.push(String(error?.stack || error)); });
    page.on("console", message => { if (message.type() === "error") pageErrors.push("console.error: " + message.text()); });
    await page.clock.setFixedTime(new Date("2026-10-05T12:00:00.000Z"));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const setup = await installProgram(page);
    observations.setup = { rows: setup.rows.map(row => ({ id: row.id, libraryId: row.libraryId, day: row.day })), slots: setup.slots.map(slot => ({ id: slot.id, exerciseId: slot.exerciseId, executionMode: slot.executionMode })) };
    if (setup.rows.length !== 2 || setup.slots.length !== 2) throw new Error("The selected request did not produce both target catalog slots");

    await logSession(page, setup.rows, { rowLoad: 20, pressLoad: 25 });
    const firstAfterLog = await page.evaluate(() => JSON.parse(localStorage.getItem("repforge_v1") || "{}"));
    const firstSession = firstAfterLog.log.filter(row => row.performedLibraryId === ROW_ID || row.performedLibraryId === PRESS_ID).at(-1)?.session;
    await logSession(page, setup.rows, { rowLoad: 20, pressLoad: 27.5 });
    await page.evaluate(() => window.__repforgeStorage.flush());
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await page.evaluate(() => window.__repforgeStorage.flush());
    const saved = await replicas(page);
    const savedRows = saved.local.log.filter(row => row.performedLibraryId === ROW_ID || row.performedLibraryId === PRESS_ID);
    const pressRows = savedRows.filter(row => row.performedLibraryId === PRESS_ID).sort((a, b) => String(a.created).localeCompare(String(b.created)));
    const rowSessions = [...new Set(savedRows.map(row => String(row.session)))];
    const sessionOne = String(firstSession);
    const sessionTwo = rowSessions.find(session => session !== sessionOne);
    observations.logged = {
      sessions: rowSessions,
      rows: savedRows.map(row => ({ session: row.session, exerciseId: row.exerciseId, performedLibraryId: row.performedLibraryId,
        load: row.load, reps: row.reps, metricValues: row.metricValues, loadingConvention: row.loadingConvention,
        externalLoadMultiplier: row.loadingContext?.externalLoadMultiplier ?? null })),
    };
    check(rowSessions.length === 2 && savedRows.length === 4 && pressRows.length === 2,
      "P069-S2-HISTORY logs both catalog movements in two saved production sessions", observations.logged);
    check(pressRows.every(row => row.loadingConvention === "per_side" && row.loadingContext?.externalLoadMultiplier == null),
      "the legacy rows retain null per-side multipliers for read-time resolution", pressRows.map(row => row.loadingContext));

    await page.locator('nav button[data-view="history"]').click();
    await page.waitForSelector("#history.view.active", { timeout: 10000 });
    const firstRead = await readSession(page, sessionOne);
    await page.locator("#history [data-history-back]").click();
    const secondRead = await readSession(page, sessionTwo);
    observations.history = { first: firstRead, second: secondRead };
    const total = read => Number(read.totals.find(item => /moved/i.test(item.label))?.value.replaceAll(",", ""));
    check(total(firstRead) === 720 && total(secondRead) === 760,
      "P069-S2-HISTORY shows physical per-side tonnage in both sessions (720 kg, then 760 kg)", { first: firstRead.totals, second: secondRead.totals });
    const pressSection = secondRead.lifts.find(section => section.exerciseId === PRESS_ID);
    check(!!pressSection?.record && /PR/.test(pressSection.record),
      "P069-S2-HISTORY labels the heavier per-side dumbbell press PR", pressSection);
    check(pressSection?.headers.some(label => /Load per side/i.test(label)) && pressSection?.headers.some(label => /Reps per side/i.test(label)),
      "History preserves the approved per-side labels beside the logged metric values", pressSection?.headers);

    await page.locator('nav button[data-view="stats"]').click();
    await page.waitForSelector("#stats.view.active", { timeout: 10000 });
    const progress = await page.evaluate(({ exerciseId }) => {
      const key = window.__repforgeProgressEvidence.keyForExerciseId(exerciseId);
      const strength = window.__repforgeProgressEvidence.strength(key);
      const volume = window.__repforgeProgressEvidence.volume("this-week");
      const dashboard = window.__repforgeStrengthDashboard().find(row => row.key === key);
      return { key, points: strength?.points, evidenceCount: strength?.evidenceCount, outcome: strength?.outcome,
        volume: { sessions: volume?.completedSessions, sets: volume?.completedWorkingSets }, dashboard };
    }, { exerciseId: pressRows.at(-1)?.exerciseId });
    observations.progress = progress;
    check(progress.volume.sessions === 2 && progress.volume.sets === 4,
      "P069-S2-HISTORY counts all four performed working sets in Progress", progress.volume);
    check(progress.evidenceCount === 2 && progress.points?.map(point => point.value).join(",") === "25,27.5",
      "P069-S2-HISTORY includes per-side load in Strength evidence as comparable values", progress.points);
    check(Math.abs(Number(progress.dashboard?.best) - (27.5 * (1 + 8 / 30))) < 0.001,
      "P069-S2-HISTORY calculates per-side e1RM from the same logged convention", progress.dashboard);
    const pressKey = progress.key;
    await page.evaluate(() => window.__repforgeStatsNav.setEvidenceView("strength"));
    await page.waitForSelector("#segStrength.active", { timeout: 5000 });
    const strengthRow = page.locator('#strengthDash [data-evkey="' + pressKey + '"]');
    check(/27\.5/.test(await strengthRow.locator(".evrow__val").textContent()) && /per side/i.test(await strengthRow.locator(".evrow__val").textContent()),
      "Progress labels the per-side strength value in the logged unit", await strengthRow.locator(".evrow__val").textContent());
    await strengthRow.click();
    const detail = page.locator('[data-evdetail="' + pressKey + '"]');
    check(/34\.8/.test(await detail.textContent()) && /Load per side/i.test(await detail.textContent()),
      "Progress detail displays the per-side e1RM with its established cue", await detail.textContent());

    const beforeRead = await replicas(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await page.evaluate(() => window.__repforgeStorage.flush());
    const afterRead = await replicas(page);
    check(beforeRead.localRaw === afterRead.localRaw && JSON.stringify(beforeRead.idb) === JSON.stringify(afterRead.idb),
      "P069-S2-LEGACY reads and reloads the null-multiplier rows without rewriting either durable replica",
      { localBytesStable: beforeRead.localRaw === afterRead.localRaw, idbStable: JSON.stringify(beforeRead.idb) === JSON.stringify(afterRead.idb) });

    const sourcePress = saved.local.log.find(row => row.performedLibraryId === PRESS_ID);
    const firstExplicit = structuredClone(sourcePress);
    const secondExplicit = structuredClone(pressRows.at(-1));
    firstExplicit.loadingContext = { ...firstExplicit.loadingContext, externalLoadMultiplier: 1 };
    secondExplicit.loadingContext = { ...secondExplicit.loadingContext, externalLoadMultiplier: 2 };
    const unknownRaw = CATALOG.exercises.find(entry => entry.id === UNKNOWN_ID);
    const unknownDefinitions = sourcePress.metricDefinitions.map(definition => structuredClone(definition));
    const unknownValues = unknownDefinitions.map(definition => ({ metricId: definition.id,
      value: definition.semantic === "repsPerSide" ? 8 : 20, unit: definition.unit }));
    const unknownRow = {
      ...structuredClone(sourcePress), session: "p069-s2-unknown-mode", date: "2026-10-05", day: "Unknown mode",
      created: "2026-10-05T13:00:00.000Z", exerciseId: "legacy-unknown-mode-slot",
      name: unknownRaw.name, performedName: unknownRaw.name, performedLibraryId: UNKNOWN_ID,
      load: null, reps: null, metricIds: sourcePress.metricIds.slice(), metricOrigin: sourcePress.metricOrigin,
      metricDefinitions: unknownDefinitions, metricValues: unknownValues, metricType: "source_metrics@1",
      sourceLibraryId: UNKNOWN_ID, loadingConvention: "per_side",
      loadingModel: { ...sourcePress.loadingModel, bodyweightCoefficient: unknownRaw.bodyweight },
      loadingContext: { loadingConvention: "per_side", bodyweightKg: null, bodyweightContributionEnabled: false,
        externalLoadMultiplier: null, bodyweightCoefficient: unknownRaw.bodyweight },
    };
    const boundaryState = structuredClone(saved.local);
    boundaryState.log = boundaryState.log.map(row => String(row.session) === String(firstExplicit.session) && row.performedLibraryId === PRESS_ID
      ? firstExplicit : String(row.session) === String(secondExplicit.session) && row.performedLibraryId === PRESS_ID ? secondExplicit : row);
    boundaryState.log.push(unknownRow);
    const boundaryValid = await page.evaluate(state => window.__repforgeValidateStateShape(state), boundaryState);
    if (!boundaryValid) throw new Error("The explicit/unknown legacy boundary fixture is not a valid production state shape");
    await persistState(page, boundaryState);
    await page.reload({ waitUntil: "domcontentloaded" });
    try {
      await waitForAppBoot(page, { base: BASE });
    } catch (error) {
      const persisted = await replicas(page).catch(readError => ({ readError: String(readError) }));
      throw new Error(`Boundary state boot failed: ${error.message}; page errors: ${pageErrors.join(" | ")}; ` +
        `persisted log tail: ${JSON.stringify(persisted.local?.log?.slice(-3) || persisted.readError)}`);
    }
    await page.evaluate(() => window.__repforgeStorage.flush());
    const boundarySaved = await replicas(page);
    await page.locator('nav button[data-view="history"]').click();
    await page.waitForSelector("#history.view.active", { timeout: 10000 });
    const explicitRead = await readSession(page, String(firstExplicit.session));
    observations.explicit = explicitRead;
    check(total(explicitRead) === 520,
      "an explicit multiplier overrides the current bilateral slot rule for historical tonnage", explicitRead.totals);
    await page.locator("#history [data-history-back]").click();
    const noCrossModePr = await readSession(page, String(secondExplicit.session));
    const noPressRecord = noCrossModePr.lifts.find(section => section.exerciseId === secondExplicit.exerciseId)?.record || "";
    check(!noPressRecord,
      "History does not compare explicit m=1 and m=2 rows as the same per-side PR convention", noCrossModePr.lifts);

    await page.locator('nav button[data-view="stats"]').click();
    await page.waitForSelector("#stats.view.active", { timeout: 10000 });
    const unknownProgress = await page.evaluate(() => {
      const volume = window.__repforgeProgressEvidence.volume("this-week");
      const strength = window.__repforgeProgressEvidence.strength("library:" + "3895c6f170d88002b51fdf96c7dc50e1");
      return { sessions: volume.completedSessions, sets: volume.completedWorkingSets,
        hasUnknownSeries: !!strength, unknownCount: strength?.evidenceCount ?? 0, unknownPoints: strength?.points?.length ?? 0 };
    });
    observations.unknownProgress = unknownProgress;
    check(unknownProgress.sets === 5,
      "Progress counts a performed per-side working set even when execution mode is unknown", unknownProgress);
    check(!unknownProgress.hasUnknownSeries || (unknownProgress.unknownCount === 0 && unknownProgress.unknownPoints === 0),
      "Unknown execution mode does not create tonnage or comparable strength evidence", unknownProgress);

    await page.evaluate(() => window.__repforgeShowSettings());
    await page.waitForSelector("#settings.view.active", { timeout: 10000 });
    await page.locator("#dataBackupRow").click();
    await page.locator("#exportCsv").waitFor({ state: "visible", timeout: 5000 });
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#exportCsv").click()]);
    const exported = readFileSync(await download.path(), "utf8");
    const parsed = csvRows(exported);
    const headers = parsed[0] || [];
    const index = Object.fromEntries(headers.map((header, column) => [header, column]));
    const pressExport = parsed.slice(1).find(row => row[index.exercise_id] === sourcePress.exerciseId && row[index.session] === String(firstExplicit.session));
    const unknownExport = parsed.slice(1).find(row => row[index.exercise_id] === "legacy-unknown-mode-slot");
    observations.csv = { headers, press: pressExport, unknown: unknownExport };
    check(index.load_per_side >= 0 && index.reps_per_side >= 0,
      "P069-S2-CSV adds load_per_side and reps_per_side columns", headers);
    check(pressExport?.[index.load] === "" && pressExport?.[index.reps] === "" && pressExport?.[index.load_per_side] === "25" &&
      pressExport?.[index.reps_per_side] === "8" && Number(pressExport?.[index.tonnage]) === 200 &&
      Math.abs(Number(pressExport?.[index.e1rm]) - (25 * (1 + 8 / 30))) < 0.01,
      "P069-S2-CSV preserves flat load/reps columns and derives explicit per-side tonnage/e1RM", pressExport);
    check(unknownExport?.[index.load_per_side] === "20" && unknownExport?.[index.reps_per_side] === "8" &&
      unknownExport?.[index.tonnage] === "" && unknownExport?.[index.e1rm] === "",
      "P069-S2-CSV exports unknown-mode source values without guessed tonnage/e1RM", unknownExport);
    const beforeBoundaryRead = boundarySaved;
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await page.evaluate(() => window.__repforgeStorage.flush());
    const afterBoundaryRead = await replicas(page);
    check(beforeBoundaryRead.localRaw === afterBoundaryRead.localRaw && JSON.stringify(beforeBoundaryRead.idb) === JSON.stringify(afterBoundaryRead.idb),
      "explicit and unknown per-side history remain byte-for-byte unchanged by subsequent reads",
      { localBytesStable: beforeBoundaryRead.localRaw === afterBoundaryRead.localRaw, idbStable: JSON.stringify(beforeBoundaryRead.idb) === JSON.stringify(afterBoundaryRead.idb) });

    const artifactDir = process.env.REPFORGE_ARTIFACT_DIR;
    if (artifactDir) {
      mkdirSync(artifactDir, { recursive: true });
      writeFileSync(join(artifactDir, "p069-s2-per-side-reading-observation.json"), JSON.stringify(observations, null, 2) + "\n");
    }
    await context.close();
  } finally {
    await browser.close();
  }
  console.log("\nper-side reading: " + passed + " passed, " + failures.length + " failed");
  assert.equal(failures.length, 0, failures.join("; "));
}

main().catch(error => {
  console.error("per-side-reading-browser.mjs crashed:", error?.stack || error);
  process.exitCode = 2;
});
