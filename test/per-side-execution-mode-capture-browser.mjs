#!/usr/bin/env node
/**
 * #382: a new row for an ambiguous per-side movement records the lifter's
 * explicit execution mode, so the next session has comparable history.
 *
 * Production journey: Recommend → Review catalog pick of B-stance dumbbell
 * Romanian deadlift (ambiguous laterality, persistent per-side load) → explicit
 * "One side at a time" → activate → log and save in Focus → next session.
 * Then the slot's mode changes to "Both sides together" in the program editor;
 * the saved row keeps its own mode and is not reinterpreted.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { answerRecommend, launchChromium, waitForAppBoot } from "./browser.mjs";
import { openInstalledEditor } from "./adaptive-build-fixture.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const TARGET_ID = "2ee5c6f170d880c899dcdd917b32d865"; // B-stance dumbbell Romanian deadlift
const TARGET_NAME = "B-stance dumbbell Romanian deadlift";
const LOAD_ID = "25a5c6f170d8803aa6fdc6f2535f9c5c"; // persistentLoadPerSideKg
const REPS_ID = "25a5c6f170d880baaa2dc8c7b67d4b65"; // repsPerSide
const failures = [];
const observations = {};
function check(ok, label, detail) {
  console.log(`${ok ? "  ✓" : "  ✗"} ${label}`);
  if (!ok) {
    failures.push(label);
    if (detail !== undefined) console.log(`    ${JSON.stringify(detail)}`);
  }
}

async function readHistorySession(page, sessionId) {
  await page.locator('nav button[data-view="history"]').click();
  await page.waitForSelector("#history.view.active", { timeout: 10000 });
  await page.locator(`#sessions .hist-row[data-sess="${sessionId}"] .session__open`).click();
  const reading = page.locator(`.session--read[data-reading="${sessionId}"]`);
  await reading.waitFor({ state: "visible", timeout: 10000 });
  const totals = await reading.evaluate(root => [...root.querySelectorAll(".histpage__totals > div")].map(cell => ({
    value: cell.querySelector("b")?.textContent.trim() || "",
    label: cell.querySelector("span")?.textContent.trim() || "",
  })));
  await page.locator("#history [data-history-back]").click();
  return { totals, moved: Number(totals.find(item => /moved/i.test(item.label))?.value.replaceAll(",", "")) };
}

function nextRecommendation(page, rowId) {
  return page.evaluate((id) => {
    const slot = window.__repforgeProgression.programSlot(id);
    const rec = window.__repforgeProgression.recommendation(slot);
    const canonical = window.__repforgeWorkoutDraft.state().programMeta.programDefinition.days
      .flatMap(day => day.slots || []).find(item => item.id === (slot?.slotId || id));
    return { slotMode: canonical?.executionMode ?? null, status: rec?.status, engineStatus: rec?.engineStatus,
      reasonCodes: rec?.reasonCodes, historyAnchor: rec?.historyAnchor ?? null, load: rec?.load ?? null };
  }, rowId);
}

const browser = await launchChromium();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US", timezoneId: "UTC" });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error?.stack || error)));
try {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00.000Z"));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });

  // Recommend → Review: pick the ambiguous movement and answer its mode.
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await answerRecommend(page, { days: 2, minutes: 90, skipBasics: true, deload: false });
  await page.waitForSelector("#entryReview [data-review-slot]", { timeout: 15000 });
  const source = await page.evaluate(() => {
    const definition = window.__repforgeEntryState?.()?.result?.preview?.programDefinition;
    const hinge = "19e5c6f170d88068951fd7fffc03ed0d"; // Catalog Hip Hinge movement pattern
    const isHinge = slot => (slot.movementPatternIds || []).includes(hinge);
    const day = definition?.days?.find(item => item.kind === "training" &&
      (item.slots || []).some(isHinge));
    const slot = day?.slots?.find(isHinge);
    return slot ? { id: slot.id, dayIndex: definition.days.indexOf(day) } : null;
  });
  if (!source) throw new Error("Recommend produced no lower hip-extension slot to edit in Review");
  await page.locator(`#entryReview [data-review-tab="${source.dayIndex}"]`).click();
  await page.locator(`#entryReview [data-review-slot="${source.id}"]`).click();
  await page.waitForSelector("#reviewSheet.is-open [data-review-search]", { timeout: 5000 });
  await page.locator("#reviewSheet [data-review-search]").click();
  await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
  await page.fill("#exPickSearch", TARGET_NAME);
  const target = page.locator(`#exPickList [data-pick="${TARGET_ID}"]`).first();
  await target.waitFor({ timeout: 5000 });
  await target.click();
  await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
  await page.waitForFunction(({ slotId, exerciseId }) => window.__repforgeEntryState?.()?.result?.preview?.programDefinition?.days
    ?.flatMap(day => day.slots || []).some(item => item.id === slotId && item.exerciseId === exerciseId && item.executionMode == null),
  { slotId: source.id, exerciseId: TARGET_ID }, { timeout: 10000 });
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
  const rowId = await page.evaluate((slotId) => window.__repforgeWorkoutDraft.state().program
    .find(item => item.slotId === slotId || item.id === slotId)?.id ?? null, source.id);
  if (!rowId) throw new Error("The reviewed movement was not activated into the program");

  // Focus: log 25 kg per side × 8 reps per side at RIR 2, bodyweight 80; save; finish.
  await page.evaluate((id) => window.__repforgeGoToLogExercise(id), rowId);
  await page.waitForFunction((id) => document.querySelector("#workout.is-focus .exercise.is-current")?.dataset.ex === id,
    rowId, { timeout: 15000 });
  await page.locator("#sessionSheetBtn").click();
  await page.waitForSelector("#sessionSheet.is-open", { timeout: 5000 });
  await page.locator("#sessionBodyweight").fill("80");
  await page.locator("#sessionBodyweight").dispatchEvent("input");
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.locator("#sessionSheetClose").click();
  await page.waitForSelector("#sessionSheet", { state: "hidden", timeout: 5000 });
  for (const [id, value] of [[LOAD_ID, "25"], [REPS_ID, "8"]]) {
    const input = page.locator(`#workout .exercise.is-current .focus-shelf input[data-metric-id="${id}"]`);
    await input.waitFor({ state: "attached", timeout: 10000 });
    if (await input.getAttribute("aria-hidden") === "true")
      await page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field="metric_${id}"]`).click();
    await input.fill(value);
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  }
  const rir = page.locator(`#workout .exercise.is-current .focus-shelf input[data-k="${rowId}_1_rir"]`);
  if (await rir.getAttribute("aria-hidden") === "true")
    await page.locator('#workout .exercise.is-current .focus-shelf [data-shelf-field="rir"]').click();
  await rir.fill("2");
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.locator(`#workout .exercise.is-current [data-save="${rowId}_1"]`).click();
  await page.waitForFunction((id) => {
    const draft = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
    const setId = draft?.setOrder?.find(key => draft.sets[key].ordinal === 1);
    return !!draft?.sets?.[setId]?.completion;
  }, rowId, { timeout: 15000 });
  await page.locator("#sessionSheetBtn").click();
  await page.locator("#sessionEarlyFinish").click();
  await page.locator("#sessionEarlyConfirm").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === false, undefined, { timeout: 15000 });
  await page.locator("#sumDone").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === true, undefined, { timeout: 10000 });
  await page.evaluate(() => window.__repforgeStorage.flush());

  const saved = await page.evaluate((id) => {
    const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const row = (state.log || []).filter(item => item.performedLibraryId === id).at(-1);
    return row ? { session: String(row.session), loadingContext: row.loadingContext, metricValues: row.metricValues } : null;
  }, TARGET_ID);
  observations.saved = saved;
  check(saved?.loadingContext?.executionMode === "unilateral" && saved.loadingContext.externalLoadMultiplier === 2,
    "the saved row records the lifter's explicit one-side-at-a-time mode beside its per-side multiplier", saved);
  check(saved?.metricValues?.some(item => item.metricId === LOAD_ID && item.value === 25) &&
    saved?.metricValues?.some(item => item.metricId === REPS_ID && item.value === 8),
  "the saved row keeps the raw per-side load and reps", saved);

  // The next session reads the saved row as comparable history.
  await page.clock.setFixedTime(new Date("2026-10-07T12:00:00.000Z"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  const next = await nextRecommendation(page, rowId);
  observations.nextSession = next;
  check(next.slotMode === "unilateral" && next.engineStatus === "recommended" && next.historyAnchor != null &&
    !(next.reasonCodes || []).includes("no_comparable_history"),
  "the next-session recommendation uses the session-1 row as its comparable anchor", next);
  // 25 kg per side × 2 sides held × (8 reps per side × 2 sides) = 800 kg.
  const historyBefore = await readHistorySession(page, saved?.session);
  observations.historyBefore = historyBefore;
  check(historyBefore.moved === 800, "History counts the captured unilateral row's tonnage (800 kg)", historyBefore);

  // The slot's mode changes later; the old row keeps its own captured mode.
  const editorRow = await openInstalledEditor(page, TARGET_NAME);
  await editorRow.locator('[data-role="execution-mode"][data-mode="bilateral"]').click();
  await page.waitForSelector('#programEditor [data-role="editor"]:not([aria-busy="true"])', { timeout: 10000 });
  await page.locator('#reviewSheet [data-role="sheet-done"]').click();
  await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 5000 });
  await page.locator('#programEditor [data-role="apply"]').click();
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"),
    undefined, { timeout: 10000 });
  await page.evaluate(() => window.__repforgeStorage.flush());
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  const changed = await nextRecommendation(page, rowId);
  observations.afterModeChange = changed;
  check(changed.slotMode === "bilateral" && changed.historyAnchor == null &&
    (changed.reasonCodes || []).includes("no_comparable_history"),
  "after the slot changes to both sides together, the unilateral row is not reused as bilateral history", changed);
  const rowAfter = await page.evaluate((id) => (JSON.parse(localStorage.getItem("repforge_v1") || "{}").log || [])
    .filter(item => item.performedLibraryId === id).at(-1)?.loadingContext ?? null, TARGET_ID);
  check(JSON.stringify(rowAfter) === JSON.stringify(saved?.loadingContext),
    "changing the slot's mode does not rewrite the saved row", { before: saved?.loadingContext, after: rowAfter });
  const historyAfter = await readHistorySession(page, saved?.session);
  observations.historyAfter = historyAfter;
  check(historyAfter.moved === 800,
    "History still reads the old row as one side at a time after the slot changes (800 kg, not 400 kg)", historyAfter);
  check(pageErrors.length === 0, "the production journey has no page errors", pageErrors);
} catch (error) {
  failures.push(String(error?.stack || error));
  console.error(error?.stack || error);
  if (pageErrors.length) console.error(pageErrors.join("\n"));
} finally {
  const outputRoot = process.env.REPFORGE_ARTIFACT_DIR || ".ci-results/per-side-execution-mode-capture";
  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(join(outputRoot, "report.json"), `${JSON.stringify({ observations, failures, pageErrors }, null, 2)}\n`);
  await browser.close();
}
console.log(`\n#382 execution-mode capture: ${failures.length ? `${failures.length} failed` : "all passed"}`);
if (failures.length) process.exitCode = 1;
