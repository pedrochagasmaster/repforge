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
const AMBIGUOUS_ID = "2ee5c6f170d880c899dcdd917b32d865";
const TOTAL_AMBIGUOUS_ID = "2ee5c6f170d880d98e4fce18a6a6367e";
const PERSISTENT_LOAD_SIDE_ID = "25a5c6f170d8803aa6fdc6f2535f9c5c";
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
    const rows = state.program.filter(row => [rowId, pressId].includes(row.libraryId));
    const slots = (state.programMeta?.programDefinition?.days || []).flatMap(day => day.slots || [])
      .filter(slot => [rowId, pressId].includes(slot.exerciseId));
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
      metrics: [...section.querySelectorAll(".history-metric")].map(node => ({
        metricId: node.dataset.historyMetricId, value: node.dataset.metricValue, unit: node.dataset.metricUnit,
      })),
      outcome: section.querySelector(".histlift__tags .verdictmark:not(.verdictmark--record)")?.textContent.replace(/\s+/g, " ").trim() || "",
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
    const pressProgramRow = setup.rows.find(row => row.libraryId === PRESS_ID);
    const pressProgramSlot = setup.slots.find(slot => slot.exerciseId === PRESS_ID);
    if (setup.rows.length !== 2 || setup.slots.length !== 2 || pressProgramSlot?.executionMode !== "bilateral")
      throw new Error("The selected request did not produce both per-side slots and the known-mode bilateral press slot");

    await logSession(page, setup.rows, { rowLoad: 20, pressLoad: 25 });
    const firstAfterLog = await page.evaluate(() => JSON.parse(localStorage.getItem("repforge_v1") || "{}"));
    const firstSession = firstAfterLog.log.filter(row => row.performedLibraryId === ROW_ID || row.performedLibraryId === PRESS_ID).at(-1)?.session;
    await page.clock.setFixedTime(new Date("2026-10-05T12:01:00.000Z"));
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
    check(pressSection?.outcome === "Improved",
      "P069-S2-HISTORY classifies same-convention per-side sessions without pairing a PR with Not comparable", pressSection);
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
    check(/35/.test(await detail.textContent()) && /Load per side/i.test(await detail.textContent()),
      "Progress detail displays the per-side e1RM with its established cue", await detail.textContent());
    const totalLoadStrength = await page.evaluate(({ exerciseId }) => {
      const key = window.__repforgeProgressEvidence.keyForExerciseId(exerciseId);
      const series = window.__repforgeProgressEvidence.strength(key);
      return { key, points: series?.points, evidenceCount: series?.evidenceCount,
        dashboard: window.__repforgeStrengthDashboard().find(row => row.key === key) };
    }, { exerciseId: savedRows.find(row => row.performedLibraryId === ROW_ID)?.exerciseId });
    observations.totalLoadStrength = totalLoadStrength;
    check(totalLoadStrength.evidenceCount === 2 && totalLoadStrength.points?.map(point => point.value).every(value => value === 20),
      "Progress keeps Weight(total) as total load while resolving one-side-at-a-time repetitions", totalLoadStrength.points);
    await page.evaluate(() => window.openExerciseView("library:" + "1a05c6f170d8803ba48ec1443eab5978", "stats"));
    await page.waitForSelector("#exercise.view.active", { timeout: 10000 });
    await page.locator('#exDetail [data-metric="e1rm"]').click();
    const exerciseChartRead = await page.locator("#exDetail .exchart__readout").textContent().catch(() => "");
    const exerciseChartColumns = await page.locator("#exDetail .exchart__cols").textContent().catch(() => "");
    observations.exerciseChart = { readout: exerciseChartRead, columns: exerciseChartColumns };
    check(/34\.8/.test(exerciseChartRead) && /per side/i.test(exerciseChartRead) && /Load per side/i.test(exerciseChartColumns),
      "exercise-detail e1RM chart and table label the per-side load convention", observations.exerciseChart);
    await page.locator("#exBack").click();
    await page.waitForSelector("#stats.view.active", { timeout: 10000 });
    await page.evaluate(() => window.openExerciseView("library:" + "1a55c6f170d88031b658c6e278a82a88", "stats"));
    await page.waitForSelector("#exercise.view.active", { timeout: 10000 });
    await page.locator('#exDetail [data-metric="e1rm"]').click();
    const totalLoadChartRead = await page.locator("#exDetail .exchart__readout").textContent().catch(() => "");
    const totalLoadChartColumns = await page.locator("#exDetail .exchart__cols").textContent().catch(() => "");
    observations.totalLoadChart = { readout: totalLoadChartRead, columns: totalLoadChartColumns };
    check(/20/.test(totalLoadChartRead) && /Reps per side/i.test(totalLoadChartRead) && /Reps per side/i.test(totalLoadChartColumns) &&
      !/Load per side/i.test(totalLoadChartColumns),
      "exercise-detail keeps total Weight total while labeling the actual per-side repetitions", observations.totalLoadChart);

    const beforeRead = await replicas(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await page.evaluate(() => window.__repforgeStorage.flush());
    const afterRead = await replicas(page);
    check(beforeRead.localRaw === afterRead.localRaw && JSON.stringify(beforeRead.idb) === JSON.stringify(afterRead.idb),
      "P069-S2-LEGACY reads and reloads the null-multiplier rows without rewriting either durable replica",
      { localBytesStable: beforeRead.localRaw === afterRead.localRaw, idbStable: JSON.stringify(beforeRead.idb) === JSON.stringify(afterRead.idb) });

    const sourcePress = saved.local.log.find(row => row.performedLibraryId === PRESS_ID);
    const sourceRow = saved.local.log.find(row => row.performedLibraryId === ROW_ID);
    const ambiguousRaw = CATALOG.exercises.find(entry => entry.id === AMBIGUOUS_ID);
    const ambiguousDefinitions = await page.evaluate(ids => {
      const result = window.RepForgeExerciseMetrics.definitionsForIds(ids);
      if (!result.ok) throw new Error("The persistent B-stance metric composition is invalid: " + JSON.stringify(result.issues));
      return result.value;
    }, ambiguousRaw.exerciseMetrics);
    const ambiguousRowFor = (session, date, created, load, externalLoadMultiplier = 2) => ({
      ...structuredClone(sourcePress),
      session, date, day: "B-stance RDL", created,
      exerciseId: sourcePress.exerciseId,
      slotId: sourcePress.slotId,
      name: ambiguousRaw.name, performedName: ambiguousRaw.name, performedLibraryId: AMBIGUOUS_ID,
      load: null, reps: null, set: 1, setIndex: 0,
      metricIds: [...ambiguousRaw.exerciseMetrics], metricOrigin: "source_catalog",
      metricDefinitions: structuredClone(ambiguousDefinitions),
      metricValues: ambiguousDefinitions.map(definition => ({ metricId: definition.id,
        value: definition.id === PERSISTENT_LOAD_SIDE_ID ? load : 8, unit: definition.unit })),
      sourceLibraryId: AMBIGUOUS_ID, metricType: "source_metrics@1", loadingConvention: "per_side",
      loadingModel: { bodyweightCoefficient: ambiguousRaw.bodyweight, assistanceDirection: "subtract" },
      loadingContext: { loadingConvention: "per_side", bodyweightKg: null, bodyweightContributionEnabled: false,
        externalLoadMultiplier, bodyweightCoefficient: ambiguousRaw.bodyweight },
    });
    const ambiguousEarlier = ambiguousRowFor("p069-s2-persistent-earlier", "2026-10-04", "2026-10-04T13:00:00.000Z", 25);
    const ambiguousLatest = ambiguousRowFor("p069-s2-persistent-latest", "2026-10-05", "2026-10-05T13:01:00.000Z", 27.5);
    const persistentLegacyFallback = ambiguousRowFor("p069-s2-persistent-legacy", "2026-10-05", "2026-10-05T15:00:00.000Z", 22.5, null);
    const totalAmbiguousRaw = CATALOG.exercises.find(entry => entry.id === TOTAL_AMBIGUOUS_ID);
    const totalAmbiguousDefinitions = await page.evaluate(ids => {
      const result = window.RepForgeExerciseMetrics.definitionsForIds(ids);
      if (!result.ok) throw new Error("The total-load B-stance metric composition is invalid: " + JSON.stringify(result.issues));
      return result.value;
    }, totalAmbiguousRaw.exerciseMetrics);
    const totalAmbiguousRowFor = (session, date, created, load, externalLoadMultiplier) => ({
      ...structuredClone(sourcePress),
      session, date, day: "B-stance total-load RDL", created,
      exerciseId: sourcePress.exerciseId,
      slotId: sourcePress.slotId,
      name: totalAmbiguousRaw.name, performedName: totalAmbiguousRaw.name, performedLibraryId: TOTAL_AMBIGUOUS_ID,
      load, reps: null, set: 1, setIndex: 0,
      metricIds: [...totalAmbiguousRaw.exerciseMetrics], metricOrigin: "source_catalog",
      metricDefinitions: structuredClone(totalAmbiguousDefinitions),
      metricValues: totalAmbiguousDefinitions.map(definition => ({ metricId: definition.id,
        value: definition.semantic === "loadKg" ? load : 8, unit: definition.unit })),
      sourceLibraryId: TOTAL_AMBIGUOUS_ID, metricType: "source_metrics@1", loadingConvention: "external",
      loadingModel: { bodyweightCoefficient: totalAmbiguousRaw.bodyweight, assistanceDirection: "subtract" },
      loadingContext: { loadingConvention: "external", bodyweightKg: null, bodyweightContributionEnabled: false,
        externalLoadMultiplier, bodyweightCoefficient: totalAmbiguousRaw.bodyweight },
    });
    const totalAmbiguousEarlier = totalAmbiguousRowFor("p069-s2-total-m1-earlier", "2026-10-04", "2026-10-04T14:00:00.000Z", 25, 1);
    const totalAmbiguousLatest = totalAmbiguousRowFor("p069-s2-total-m1-latest", "2026-10-05", "2026-10-05T14:01:00.000Z", 27.5, 1);
    const unambiguousLaterality = structuredClone(sourceRow);
    Object.assign(unambiguousLaterality, { session: "p069-s2-unambiguous-total", date: "2026-10-02",
      created: "2026-10-02T14:00:00.000Z", day: "Changed current slot", exerciseId: sourcePress.exerciseId,
      slotId: sourcePress.slotId });
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
    boundaryState.log.push(unknownRow, ambiguousEarlier, ambiguousLatest, persistentLegacyFallback,
      totalAmbiguousEarlier, totalAmbiguousLatest, unambiguousLaterality);
    const currentAmbiguousSlot = boundaryState.programMeta.programDefinition.days.flatMap(day => day.slots || [])
      .find(slot => slot.id === sourcePress.slotId || slot.id === sourcePress.exerciseId);
    if (currentAmbiguousSlot?.executionMode !== "bilateral") throw new Error("The B-stance proof lost its current bilateral slot mode");
    const boundaryValid = await page.evaluate(state => window.__repforgeValidateStateShape(state), boundaryState);
    if (!boundaryValid) throw new Error("The explicit, unknown, persistent, or total-load B-stance fixture is not a valid production state shape");
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
    check(total(explicitRead) === 720,
      "an explicit unilateral per-side convention expands side repetitions despite the current bilateral slot", explicitRead.totals);
    await page.locator("#history [data-history-back]").click();
    const noCrossModePr = await readSession(page, String(secondExplicit.session));
    const noPressRecord = noCrossModePr.lifts.find(section => section.exerciseId === secondExplicit.exerciseId)?.record || "";
    check(!noPressRecord,
      "History does not compare explicit m=1 and m=2 rows as the same per-side PR convention", noCrossModePr.lifts);
    await page.locator("#history [data-history-back]").click();
    const ambiguousEarlierRead = await readSession(page, ambiguousEarlier.session);
    await page.locator("#history [data-history-back]").click();
    const ambiguousLatestRead = await readSession(page, ambiguousLatest.session);
    observations.ambiguousPersistent = { earlier: ambiguousEarlierRead, latest: ambiguousLatestRead,
      currentSlotMode: currentAmbiguousSlot.executionMode };
    const ambiguousEarlierLift = ambiguousEarlierRead.lifts.find(section => section.exerciseId === AMBIGUOUS_ID);
    const ambiguousLatestLift = ambiguousLatestRead.lifts.find(section => section.exerciseId === AMBIGUOUS_ID);
    check(Number.isNaN(total(ambiguousEarlierRead)) && Number.isNaN(total(ambiguousLatestRead)),
      "History leaves persistent B-stance tonnage unavailable when the historical execution mode was not captured",
      { earlier: ambiguousEarlierRead.totals, latest: ambiguousLatestRead.totals });
    check(ambiguousEarlierLift?.metrics.some(metric => metric.metricId === PERSISTENT_LOAD_SIDE_ID && metric.value === "25") &&
      ambiguousEarlierLift?.metrics.some(metric => metric.metricId === "25a5c6f170d880baaa2dc8c7b67d4b65" && metric.value === "8") &&
      !ambiguousLatestLift?.record && ambiguousLatestLift?.outcome === "Not comparable",
      "History keeps raw B-stance per-side values and suppresses a guessed comparable PR", observations.ambiguousPersistent);
    await page.locator("#history [data-history-back]").click();
    const persistentLegacyRead = await readSession(page, persistentLegacyFallback.session);
    await page.locator("#history [data-history-back]").click();
    const totalAmbiguousEarlierRead = await readSession(page, totalAmbiguousEarlier.session);
    await page.locator("#history [data-history-back]").click();
    const totalAmbiguousLatestRead = await readSession(page, totalAmbiguousLatest.session);
    await page.locator("#history [data-history-back]").click();
    const unambiguousLateralityRead = await readSession(page, unambiguousLaterality.session);
    observations.ambiguousTotalLoad = { earlier: totalAmbiguousEarlierRead, latest: totalAmbiguousLatestRead,
      persistentLegacyFallback: persistentLegacyRead, unambiguousLaterality: unambiguousLateralityRead,
      currentSlotMode: currentAmbiguousSlot.executionMode };
    const totalAmbiguousLatestLift = totalAmbiguousLatestRead.lifts.find(section => section.exerciseId === TOTAL_AMBIGUOUS_ID);
    const persistentLegacyLift = persistentLegacyRead.lifts.find(section => section.exerciseId === AMBIGUOUS_ID);
    check(Number.isNaN(total(totalAmbiguousEarlierRead)) && Number.isNaN(total(totalAmbiguousLatestRead)) &&
      !totalAmbiguousLatestLift?.record && totalAmbiguousLatestLift?.outcome === "Not comparable",
      "History leaves explicit total-load m=1 unavailable when B-stance historical mode is unknown despite today's bilateral slot",
      { earlier: totalAmbiguousEarlierRead, latest: totalAmbiguousLatestRead, currentSlotMode: currentAmbiguousSlot.executionMode });
    check(persistentLegacyLift?.metrics.some(metric => metric.metricId === PERSISTENT_LOAD_SIDE_ID && metric.value === "22.5") &&
      Number(persistentLegacyRead.totals.find(item => /moved/i.test(item.label))?.value.replaceAll(",", "")) === 360,
      "History retains current-slot fallback for a valid legacy null-mode persistent per-side row", persistentLegacyRead);
    check(Number(unambiguousLateralityRead.totals.find(item => /moved/i.test(item.label))?.value.replaceAll(",", "")) === 320,
      "History keeps catalog-unilateral total Weight plus per-side repetitions after its slot changes to bilateral",
      unambiguousLateralityRead);

    await page.locator('nav button[data-view="stats"]').click();
    await page.waitForSelector("#stats.view.active", { timeout: 10000 });
    const unknownProgress = await page.evaluate(() => {
      const volume = window.__repforgeProgressEvidence.volume("this-week");
      const strength = window.__repforgeProgressEvidence.strength("library:" + "3895c6f170d88002b51fdf96c7dc50e1");
      const ambiguous = window.__repforgeProgressEvidence.strength("library:" + "2ee5c6f170d880c899dcdd917b32d865");
      const ambiguousTotal = window.__repforgeProgressEvidence.strength("library:" + "2ee5c6f170d880d98e4fce18a6a6367e");
      const press = window.__repforgeProgressEvidence.strength("library:" + "1a05c6f170d8803ba48ec1443eab5978");
      const unknownSet = volume.completedRows.find(row => row.session === "p069-s2-unknown-mode");
      const persistentSet = volume.completedRows.find(row => row.session === "p069-s2-persistent-latest");
      const persistentLegacySet = volume.completedRows.find(row => row.session === "p069-s2-persistent-legacy");
      const totalUnknownSet = volume.completedRows.find(row => row.session === "p069-s2-total-m1-latest");
      return { sessions: volume.completedSessions, sets: volume.completedWorkingSets,
        hasUnknownSeries: !!strength, unknownCount: strength?.evidenceCount ?? 0, unknownPoints: strength?.points?.length ?? 0,
        ambiguousCount: ambiguous?.evidenceCount ?? 0, ambiguousPoints: ambiguous?.points?.length ?? 0,
        ambiguousValues: ambiguous?.points?.map(point => point.value) ?? [],
        ambiguousTotalCount: ambiguousTotal?.evidenceCount ?? 0, ambiguousTotalPoints: ambiguousTotal?.points?.map(point => point.value) ?? [],
        pressCount: press?.evidenceCount ?? 0, pressPoints: press?.points?.map(point => point.value) ?? [],
        unknownSet: unknownSet ? { load: unknownSet.load, reps: unknownSet.reps, rir: unknownSet.rir } : null,
        persistentSet: persistentSet ? { load: persistentSet.load, reps: persistentSet.reps, rir: persistentSet.rir } : null,
        persistentLegacySet: persistentLegacySet ? { load: persistentLegacySet.load, reps: persistentLegacySet.reps, rir: persistentLegacySet.rir } : null,
        totalUnknownSet: totalUnknownSet ? { load: totalUnknownSet.load, reps: totalUnknownSet.reps, rir: totalUnknownSet.rir } : null,
      };
    });
    observations.unknownProgress = unknownProgress;
    check(unknownProgress.sets === 8 && unknownProgress.unknownSet?.load === 20 && unknownProgress.unknownSet?.reps === 8 &&
      unknownProgress.persistentSet?.load === 27.5 && unknownProgress.persistentSet?.reps === 8,
      "Progress keeps performed working-set counts for unknown-mode and persistent B-stance rows", unknownProgress);
    check(!unknownProgress.hasUnknownSeries || (unknownProgress.unknownCount === 0 && unknownProgress.unknownPoints === 0),
      "Unknown execution mode does not create tonnage or comparable strength evidence", unknownProgress);
    check(unknownProgress.ambiguousCount === 1 && unknownProgress.ambiguousPoints === 1 &&
      unknownProgress.ambiguousValues?.join(",") === "22.5" && unknownProgress.persistentLegacySet?.load === 22.5,
      "Progress retains the valid legacy null-multiplier point while explicit persistent m=2 remains unavailable", unknownProgress);
    check(unknownProgress.totalUnknownSet?.load === 27.5 && unknownProgress.totalUnknownSet?.reps === 8,
      "Progress counts the explicit total-load m=1 working set and keeps raw Weight/reps values", unknownProgress);
    check(unknownProgress.ambiguousTotalCount === 0 && unknownProgress.ambiguousTotalPoints?.length === 0,
      "Progress excludes explicit total-load m=1 with ambiguous historical mode from strength evidence", unknownProgress);
    check(unknownProgress.pressCount === 1 && unknownProgress.pressPoints?.join(",") === "27.5",
      "Progress strength evidence compares only rows with the same explicit load multiplier", unknownProgress);

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
    const totalLoadExport = parsed.slice(1).find(row => row[index.exercise_id] === sourceRow.exerciseId && row[index.session] === String(sourceRow.session));
    const unknownExport = parsed.slice(1).find(row => row[index.exercise_id] === "legacy-unknown-mode-slot");
    const ambiguousExport = parsed.slice(1).find(row => row[index.exercise_id] === sourcePress.exerciseId
      && row[index.session] === ambiguousLatest.session);
    const totalAmbiguousExport = parsed.slice(1).find(row => row[index.exercise_id] === sourcePress.exerciseId
      && row[index.session] === totalAmbiguousLatest.session);
    const persistentLegacyExport = parsed.slice(1).find(row => row[index.exercise_id] === sourcePress.exerciseId
      && row[index.session] === persistentLegacyFallback.session);
    observations.csv = { headers, press: pressExport, totalLoad: totalLoadExport, unknown: unknownExport, ambiguous: ambiguousExport,
      ambiguousTotal: totalAmbiguousExport, persistentLegacy: persistentLegacyExport };
    check(index.load_per_side >= 0 && index.reps_per_side >= 0,
      "P069-S2-CSV adds load_per_side and reps_per_side columns", headers);
    check(pressExport?.[index.load] === "" && pressExport?.[index.reps] === "" && pressExport?.[index.load_per_side] === "25" &&
      pressExport?.[index.reps_per_side] === "8" && Number(pressExport?.[index.tonnage]) === 400 &&
      Math.abs(Number(pressExport?.[index.e1rm]) - (25 * (1 + 8 / 30))) < 0.01,
      "P069-S2-CSV preserves flat load/reps columns and derives explicit per-side tonnage/e1RM", pressExport);
    check(totalLoadExport?.[index.load] === "20" && totalLoadExport?.[index.reps] === "" &&
      totalLoadExport?.[index.load_per_side] === "" && totalLoadExport?.[index.reps_per_side] === "8" &&
      Number(totalLoadExport?.[index.tonnage]) === 320 &&
      Math.abs(Number(totalLoadExport?.[index.e1rm]) - (20 * (1 + 8 / 30))) < 0.01,
      "P069-S2-CSV preserves total Weight plus per-side repetitions without relabeling its load", totalLoadExport);
    check(unknownExport?.[index.load_per_side] === "20" && unknownExport?.[index.reps_per_side] === "8" &&
      unknownExport?.[index.tonnage] === "" && unknownExport?.[index.e1rm] === "",
      "P069-S2-CSV exports unknown-mode source values without guessed tonnage/e1RM", unknownExport);
    check(ambiguousExport?.[index.load_per_side] === "27.5" && ambiguousExport?.[index.reps_per_side] === "8" &&
      ambiguousExport?.[index.tonnage] === "" && ambiguousExport?.[index.e1rm] === "",
      "P069-S2-CSV exports persistent B-stance values without guessed tonnage/e1RM", ambiguousExport);
    check(totalAmbiguousExport?.[index.load] === "27.5" && totalAmbiguousExport?.[index.load_per_side] === "" &&
      totalAmbiguousExport?.[index.reps_per_side] === "8" && totalAmbiguousExport?.[index.tonnage] === "" &&
      totalAmbiguousExport?.[index.e1rm] === "",
      "P069-S2-CSV keeps total Weight semantics and omits derived values for unknown explicit total-load m=1 mode", totalAmbiguousExport);
    check(persistentLegacyExport?.[index.load_per_side] === "22.5" && persistentLegacyExport?.[index.reps_per_side] === "8" &&
      Number(persistentLegacyExport?.[index.tonnage]) === 360,
      "P069-S2-CSV retains the approved valid legacy null-mode slot fallback for persistent per-side load", persistentLegacyExport);
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
