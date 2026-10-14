#!/usr/bin/env node
/**
 * #379: a finished session's completion summary lists the per-side lifts it
 * performed. Valid per-side rows keep their performed values in metricValues,
 * so the summary must read them through the same projection History and
 * Progress use, while a plain Weight × Reps lift reads exactly as before.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { answerRecommend, launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const CATALOG = JSON.parse(readFileSync(new URL("../assets/exercise-catalog.json", import.meta.url), "utf8"));
const ROW_ID = "1a55c6f170d88031b658c6e278a82a88"; // Single arm dumbbell row: Weight (total), Reps per side
const PRESS_ID = "1a05c6f170d8803ba48ec1443eab5978"; // Dumbbell bench press: Weight per side, Reps per side
const RDL_ID = "2ee5c6f170d880c899dcdd917b32d865"; // B-stance dumbbell RDL: ambiguous laterality, persistent per-side load
const failures = [];
const observations = {};

function check(ok, label, detail) {
  console.log(`${ok ? "  ✓" : "  ✗"} ${label}`);
  if (!ok) {
    failures.push(label);
    if (detail !== undefined) console.log(`    ${JSON.stringify(detail)}`);
  }
}

const metricNames = id => CATALOG.exercises.find(entry => entry.id === id).exerciseMetrics
  .map(metricId => ({ id: metricId, name: CATALOG.uuidIndex[metricId].name }));

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
    await window.__repforgeFinalizeProgramSetup({
      programDefinition: generated.value,
      name: "Per-side completion summary proof",
      answers: {},
      destination: "log",
      origin: "first-run",
      draftConfirmed: true,
      telemetryRoute: "recommend",
      entrySource: { route: "recommend", fingerprint: "issue-379-per-side-summary" },
    });
    await window.__repforgeStorage.flush();
    const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    return state.program.map(row => ({ id: row.id, name: row.name, day: row.day, libraryId: row.libraryId }));
  }, { rowId: ROW_ID, pressId: PRESS_ID });
}

/** Recommend → Review: swap the B-stance RDL into the hip-extension slot,
 *  answer "One side at a time", and activate (the #382 capture journey). */
async function installAmbiguousProgram(page) {
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await answerRecommend(page, { days: 2, minutes: 90, skipBasics: true, deload: false });
  await page.waitForSelector("#entryReview [data-review-slot]", { timeout: 15000 });
  const source = await page.evaluate(() => {
    const definition = window.__repforgeEntryState?.()?.result?.preview?.programDefinition;
    const day = definition?.days?.find(item => item.kind === "training" &&
      (item.slots || []).some(slot => String(slot.purposeId || "").includes("hip_extension")));
    const slot = day?.slots?.find(item => String(item.purposeId || "").includes("hip_extension"));
    return slot ? { id: slot.id, dayIndex: definition.days.indexOf(day) } : null;
  });
  if (!source) throw new Error("Recommend produced no lower hip-extension slot to edit in Review");
  await page.locator(`#entryReview [data-review-tab="${source.dayIndex}"]`).click();
  await page.locator(`#entryReview [data-review-slot="${source.id}"]`).click();
  await page.waitForSelector("#reviewSheet.is-open [data-review-search]", { timeout: 5000 });
  await page.locator("#reviewSheet [data-review-search]").click();
  await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
  await page.fill("#exPickSearch", "B-stance dumbbell Romanian deadlift");
  const target = page.locator(`#exPickList [data-pick="${RDL_ID}"]`).first();
  await target.waitFor({ timeout: 5000 });
  await target.click();
  await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
  await page.locator(`#entryReview [data-review-slot="${source.id}"]`).click();
  await page.waitForSelector("#reviewSheet.is-open [data-review-execution-question]", { timeout: 5000 });
  await page.locator('#reviewSheet [data-review-execution-mode="unilateral"]').click();
  await page.waitForFunction((slotId) => window.__repforgeEntryState?.()?.result?.preview?.programDefinition?.days
    ?.flatMap(day => day.slots || []).some(slot => slot.id === slotId && slot.executionMode === "unilateral"),
  source.id, { timeout: 10000 });
  await page.locator("#reviewSheet [data-review-done]").click();
  await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 5000 });
  await page.locator("#entryActivate").click();
  await page.waitForSelector("#log.view.active", { timeout: 15000 });
  await page.evaluate(() => window.__repforgeStorage.flush());
  return page.evaluate((slotId) => window.__repforgeWorkoutDraft.state().program
    .find(item => item.slotId === slotId || item.id === slotId) ?? null, source.id);
}

/** Rewrites both durable replicas; the app is reloaded afterwards. */
async function rewriteState(page, edit) {
  await page.evaluate(async ({ key, source }) => {
    const state = JSON.parse(localStorage.getItem(key) || "{}");
    (0, eval)(source)(state);
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
  }, { key: "repforge_v1", source: edit.toString() });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
}

async function fillMetric(page, metricId, value) {
  const input = page.locator(`#workout .exercise.is-current .focus-shelf input[data-metric-id="${metricId}"]`);
  await input.waitFor({ state: "attached", timeout: 10000 });
  if (await input.getAttribute("aria-hidden") === "true")
    await page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field="metric_${metricId}"]`).click();
  await input.waitFor({ state: "visible", timeout: 10000 });
  await input.fill(String(value));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

async function logSet(page, programRowId, metrics, values) {
  await page.evaluate((id) => window.__repforgeGoToLogExercise(id), programRowId);
  await page.waitForFunction((id) => document.querySelector("#workout.is-focus .exercise.is-current")?.dataset.ex === id,
    programRowId, { timeout: 15000 });
  for (const metric of metrics) await fillMetric(page, metric.id, values[metric.name]);
  const rir = page.locator(`#workout .exercise.is-current .focus-shelf input[data-k="${programRowId}_1_rir"]`);
  if (await rir.getAttribute("aria-hidden") === "true")
    await page.locator('#workout .exercise.is-current .focus-shelf [data-shelf-field="rir"]').click();
  await rir.fill("2");
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.locator(`#workout .exercise.is-current [data-save="${programRowId}_1"]`).click();
  await page.waitForFunction((id) => {
    const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
    const setId = exercise?.setOrder?.find(key => exercise.sets[key].ordinal === 1);
    return !!exercise?.sets?.[setId]?.completion;
  }, programRowId, { timeout: 15000 });
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

/** Finish early, read the completion summary as rendered, then close it. */
async function finishAndReadSummary(page) {
  await page.locator("#sessionSheetBtn").click();
  await page.locator("#sessionEarlyFinish").click();
  await page.locator("#sessionEarlyConfirm").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === false, undefined, { timeout: 15000 });
  const summary = await page.locator("#sessionSummary").evaluate(root => ({
    lifts: [...root.querySelectorAll(".sum-grp")].map(group => ({
      name: group.querySelector(".sum-grp__n")?.textContent.trim() || "",
      sets: group.querySelector(".sum-grp__sets")?.textContent.replace(/\s+/g, " ").trim() || "",
      pr: !!group.querySelector(".sum-pr .verdictmark--record"),
      outcome: group.querySelector(".sum-outcome")?.dataset.outcome || null,
    })),
    liftCount: Number([...root.querySelectorAll(".sum-stats .statrow__cell")]
      .find(cell => /lift/i.test(cell.querySelector(".statrow__cap")?.textContent || ""))
      ?.querySelector(".statrow__val")?.dataset.ramp),
  }));
  await page.locator("#sumDone").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === true, undefined, { timeout: 10000 });
  await page.evaluate(() => window.__repforgeStorage.flush());
  return summary;
}

const browser = await launchChromium();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US", timezoneId: "UTC" });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(String(error?.stack || error)));
try {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00.000Z"));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  const program = await installProgram(page);
  const row = program.find(item => item.libraryId === ROW_ID);
  const press = program.find(item => item.libraryId === PRESS_ID);
  if (!row || !press || row.day !== press.day)
    throw new Error("The production program did not place both per-side movements on one day");
  // A bilateral Weight × Reps lift on the same day is the unchanged control.
  const plain = program.find(item => item.day === press.day && item.libraryId &&
    metricNames(item.libraryId).map(metric => metric.name).join("|") === "Weight|Reps");
  if (!plain) throw new Error("The production program has no Weight × Reps lift on the per-side day");
  observations.program = { row, press, plain };

  const logSession = async ({ rowLoad, pressLoad, plainLoad }) => {
    await logSet(page, row.id, metricNames(ROW_ID), { "Weight": rowLoad, "Reps per side": 8 });
    await logSet(page, press.id, metricNames(PRESS_ID), { "Weight per side": pressLoad, "Reps per side": 8 });
    await logSet(page, plain.id, metricNames(plain.libraryId), { "Weight": plainLoad, "Reps": 8 });
    return finishAndReadSummary(page);
  };
  const first = await logSession({ rowLoad: 20, pressLoad: 25, plainLoad: 60 });
  await page.clock.setFixedTime(new Date("2026-10-05T12:01:00.000Z"));
  const second = await logSession({ rowLoad: 22.5, pressLoad: 27.5, plainLoad: 62.5 });
  observations.summaries = { first, second };
  observations.saved = await page.evaluate(ids => (JSON.parse(localStorage.getItem("repforge_v1") || "{}").log || [])
    .filter(item => ids.includes(item.performedLibraryId))
    .map(item => ({ session: item.session, performedLibraryId: item.performedLibraryId, load: item.load, reps: item.reps,
      metricValues: item.metricValues })), [ROW_ID, PRESS_ID]);

  const named = (summary, item) => summary.lifts.find(lift => lift.name === item.name);
  for (const [label, summary] of [["first", first], ["second", second]]) {
    check(!!named(summary, row) && !!named(summary, press),
      `the ${label} completion summary lists both per-side lifts by name`, summary.lifts);
    check(summary.liftCount === 3 && summary.lifts.length === 3,
      `the ${label} completion summary counts the per-side lifts beside the plain lift`, summary);
  }
  check(/22\.5/.test(named(second, row)?.sets || "") && /27\.5/.test(named(second, press)?.sets || ""),
    "the summary's set lines show the performed per-side values", second.lifts);
  check(named(second, row)?.pr === true && named(second, press)?.pr === true,
    "the second completion summary records both heavier per-side lifts as PRs", second.lifts);
  check(named(first, plain)?.pr === false && named(second, plain)?.pr === true && /62\.5/.test(named(second, plain)?.sets || ""),
    "the plain Weight × Reps lift keeps its summary group, set line and PR", { first: named(first, plain), second: named(second, plain) });

  // An ambiguous per-side row with no recorded execution mode (saved before
  // #382, or under a slot with no mode) is still a performed lift, but today's
  // explicit slot mode never fills in its historical mode.
  const ambiguousContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US", timezoneId: "UTC" });
  const ambiguousPage = await ambiguousContext.newPage();
  ambiguousPage.on("pageerror", error => pageErrors.push(String(error?.stack || error)));
  await ambiguousPage.clock.setFixedTime(new Date("2026-10-06T12:00:00.000Z"));
  await ambiguousPage.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(ambiguousPage, { base: BASE });
  const rdl = await installAmbiguousProgram(ambiguousPage);
  if (!rdl) throw new Error("The B-stance RDL slot was not activated into the program");
  const rdlSession = async load => {
    await logSet(ambiguousPage, rdl.id, metricNames(RDL_ID), { "Weight per side persistent": load, "Reps per side": 8 });
    return finishAndReadSummary(ambiguousPage);
  };
  const readRdl = () => ambiguousPage.evaluate(({ id, rdlId }) => {
    const key = window.__repforgeProgressEvidence.keyForExerciseId(id);
    return { record: window.__repforgeProgressEvidence.records("current-block").find(row => row.exerciseId === key) || null,
      rows: (JSON.parse(localStorage.getItem("repforge_v1") || "{}").log || []).filter(row => row.performedLibraryId === rdlId)
        .map(row => ({ session: row.session, mode: row.loadingContext?.executionMode ?? null,
          multiplier: row.loadingContext?.externalLoadMultiplier ?? null })),
      slotMode: window.__repforgeWorkoutDraft.state().programMeta.programDefinition.days.flatMap(day => day.slots || [])
        .find(slot => slot.exerciseId === rdlId)?.executionMode ?? null };
  }, { id: rdl.id, rdlId: RDL_ID });

  // Session 1 is then stripped to the legacy shape: no recorded mode.
  await rdlSession(25);
  await rewriteState(ambiguousPage, state => {
    for (const row of state.log || []) if (row.performedLibraryId === "2ee5c6f170d880c899dcdd917b32d865") delete row.loadingContext.executionMode;
  });
  // Session 2 is heavier under today's explicit one-side-at-a-time slot.
  await ambiguousPage.clock.setFixedTime(new Date("2026-10-08T12:00:00.000Z"));
  const afterLegacy = await rdlSession(27.5);
  const afterLegacyRead = await readRdl();
  observations.unknownMode = { afterLegacy, afterLegacyRead };
  const legacyGroup = afterLegacy.lifts.find(lift => lift.name === rdl.name);
  check(afterLegacyRead.slotMode === "unilateral" && afterLegacyRead.rows.length === 2 &&
    afterLegacyRead.rows[0].mode === null && afterLegacyRead.rows[1].mode === "unilateral",
  "the earlier RDL row has no recorded mode while today's slot and new row are one side at a time", afterLegacyRead);
  check(!!legacyGroup && legacyGroup.pr === false && legacyGroup.outcome === null,
    "a heavier set sets no PR and no outcome against the unknown-mode row; the slot's mode is not borrowed", legacyGroup);
  check(afterLegacyRead.record?.evidenceState === "insufficient" && afterLegacyRead.record?.evidenceCount === 1,
    "the unknown-mode row adds no comparable evidence", afterLegacyRead.record);

  // Session 3 is logged after the slot loses its mode, so the row it saves has none.
  await rewriteState(ambiguousPage, state => {
    for (const slot of state.programMeta.programDefinition.days.flatMap(day => day.slots || []))
      if (slot.exerciseId === "2ee5c6f170d880c899dcdd917b32d865") delete slot.executionMode;
  });
  await ambiguousPage.clock.setFixedTime(new Date("2026-10-10T12:00:00.000Z"));
  const unknown = await rdlSession(30);
  const unknownRead = await readRdl();
  observations.unknownMode.unknown = { unknown, unknownRead };
  const unknownGroup = unknown.lifts.find(lift => lift.name === rdl.name);
  check(unknownRead.rows.at(-1)?.mode === null && unknownRead.rows.at(-1)?.multiplier === 2,
    "the newly saved RDL row records no execution mode", unknownRead.rows.at(-1));
  check(unknown.liftCount === 1 && !!unknownGroup && /30/.test(unknownGroup.sets),
    "the completion summary lists the unknown-mode per-side lift with its performed set", unknown);
  check(unknownGroup?.pr === false && unknownGroup?.outcome === null && unknownRead.record?.evidenceState === "insufficient",
    "the unknown-mode lift stays insufficient and sets no PR", { group: unknownGroup, record: unknownRead.record });
  await ambiguousContext.close();
  check(pageErrors.length === 0, "the production journey has no page errors", pageErrors);
} catch (error) {
  failures.push(String(error?.stack || error));
  console.error(error?.stack || error);
  if (pageErrors.length) console.error(pageErrors.join("\n"));
} finally {
  const outputRoot = process.env.REPFORGE_ARTIFACT_DIR || ".ci-results/per-side-completion-summary";
  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(join(outputRoot, "report.json"), `${JSON.stringify({ observations, failures, pageErrors }, null, 2)}\n`);
  await browser.close();
}
console.log(`\n#379 per-side completion summary: ${failures.length ? `${failures.length} failed` : "all passed"}`);
if (failures.length) process.exitCode = 1;
