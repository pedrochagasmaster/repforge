#!/usr/bin/env node
/**
 * #379: a finished session's completion summary lists the per-side lifts it
 * performed. Valid per-side rows keep their performed values in metricValues,
 * so the summary must read them through the same projection History and
 * Progress use, while a plain Weight × Reps lift reads exactly as before.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const CATALOG = JSON.parse(readFileSync(new URL("../assets/exercise-catalog.json", import.meta.url), "utf8"));
const ROW_ID = "1a55c6f170d88031b658c6e278a82a88"; // Single arm dumbbell row: Weight (total), Reps per side
const PRESS_ID = "1a05c6f170d8803ba48ec1443eab5978"; // Dumbbell bench press: Weight per side, Reps per side
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
