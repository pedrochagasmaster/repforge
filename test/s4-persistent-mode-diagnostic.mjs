#!/usr/bin/env node
/** Local diagnostic: does Review's explicit mode survive an actual saved set? */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { answerRecommend, launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const TARGET_ID = "2ee5c6f170d880c899dcdd917b32d865"; // B-stance dumbbell Romanian deadlift
const LOAD_ID = "25a5c6f170d8803aa6fdc6f2535f9c5c"; // persistentLoadPerSideKg
const REPS_ID = "25a5c6f170d880baaa2dc8c7b67d4b65"; // repsPerSide
const failures = [];
const facts = { sourceSha: process.env.REPFORGE_SOURCE_SHA || null, targetId: TARGET_ID };
function check(ok, label, detail) {
  console.log(`${ok ? "  ✓" : "  ✗"} ${label}`);
  if (!ok) failures.push(label);
  if (detail !== undefined) console.log(`    ${JSON.stringify(detail)}`);
}

async function main() {
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US", timezoneId: "UTC" });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error?.stack || error)));
  try {
    await page.clock.setFixedTime(new Date("2026-10-05T12:00:00.000Z"));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });

    // Real compiler → Review picker → execution-mode answer → activation.
    await page.click("#firstRunCreate");
    await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
    await answerRecommend(page, { days: 2, minutes: 90, skipBasics: true, deload: false });
    await page.waitForSelector("#entryReview [data-review-slot]", { timeout: 15000 });
    const source = await page.evaluate((targetId) => {
      const state = window.__repforgeEntryState?.();
      const definition = state?.result?.preview?.programDefinition;
      const day = definition?.days?.find(item => item.kind === "training" &&
        (item.slots || []).some(slot => String(slot.purposeId || "").includes("hip_extension")));
      const slot = day?.slots?.find(item => String(item.purposeId || "").includes("hip_extension"));
      return { definition, sourceSlot: slot ? { ...slot, dayIndex: definition.days.indexOf(day) } : null, request: definition?.request,
        targetLaterality: window.RepForgeExerciseCatalog.snapshot().exercises.find(item => item.id === targetId)?.laterality || null };
    }, TARGET_ID);
    facts.generatedRequest = source.request;
    facts.sourceSlot = source.sourceSlot && { id: source.sourceSlot.id, purposeId: source.sourceSlot.purposeId,
      exerciseId: source.sourceSlot.exerciseId, status: source.sourceSlot.prescriptionsByCycle?.[0]?.sets?.[0]?.status };
    check(!!source.sourceSlot, "canonical generated Review has a lower hip-extension slot to edit", facts.sourceSlot);
    check(source.request?.executionContexts?.[TARGET_ID] == null,
      "the chosen movement's mode is supplied in Review, not guessed by the compiler",
      source.request?.executionContexts?.[TARGET_ID] ?? null);
    if (!source.sourceSlot) throw new Error("No generated lower hip-extension slot in Review.");

    const sourceSlotId = source.sourceSlot.id;
    await page.locator(`#entryReview [data-review-tab="${source.sourceSlot.dayIndex}"]`).click();
    await page.waitForSelector(`#entryReview [data-review-slot="${sourceSlotId}"]`, { timeout: 5000 });
    await page.locator(`#entryReview [data-review-slot="${sourceSlotId}"]`).click();
    await page.waitForSelector("#reviewSheet.is-open [data-review-search]", { timeout: 5000 });
    await page.locator("#reviewSheet [data-review-search]").click();
    await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
    await page.fill("#exPickSearch", "B-stance dumbbell Romanian deadlift");
    const target = page.locator(`#exPickList [data-pick="${TARGET_ID}"]`).first();
    await target.waitFor({ timeout: 5000 });
    await target.click();
    await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
    await page.waitForFunction(({ slotId, exerciseId }) => {
      const slot = window.__repforgeEntryState?.()?.result?.preview?.programDefinition?.days
        ?.flatMap(day => day.slots || []).find(item => item.id === slotId);
      return slot?.exerciseId === exerciseId && slot.executionMode == null;
    }, { slotId: sourceSlotId, exerciseId: TARGET_ID }, { timeout: 10000 });

    await page.locator(`#entryReview [data-review-slot="${sourceSlotId}"]`).click();
    await page.waitForSelector("#reviewSheet.is-open [data-review-execution-question]", { timeout: 5000 });
    const question = await page.locator("#reviewSheet [data-review-execution-question]").innerText();
    await page.locator('#reviewSheet [data-review-execution-mode="unilateral"]').click();
    await page.waitForFunction((slotId) => window.__repforgeEntryState?.()?.result?.preview?.programDefinition?.days
      ?.flatMap(day => day.slots || []).some(slot => slot.id === slotId && slot.executionMode === "unilateral"),
      sourceSlotId, { timeout: 10000 });
    const reviewed = await page.evaluate(({ slotId }) => {
      const definition = window.__repforgeEntryState?.()?.result?.preview?.programDefinition;
      const slot = definition?.days?.flatMap(day => day.slots || []).find(item => item.id === slotId);
      const validation = window.RepForgeProgramCompiler.validateProgramDefinition(definition,
        window.RepForgeExerciseCatalog.snapshot());
      return { slot, validation };
    }, { slotId: sourceSlotId });
    facts.review = { question, mode: reviewed.slot?.executionMode,
      metrics: reviewed.slot?.metricDefinitions?.map(metric => metric.semantic),
      statuses: reviewed.slot?.prescriptionsByCycle?.[0]?.sets?.map(set => set.status),
      rir: reviewed.slot?.prescriptionsByCycle?.[0]?.sets?.map(set => set.rir),
      validation: reviewed.validation };
    check(reviewed.slot?.executionMode === "unilateral", "Review records the explicit one-side-at-a-time answer", facts.review);
    check(reviewed.validation?.ok === true && reviewed.slot?.prescriptionsByCycle?.[0]?.sets?.every(set => set.status === "ready"),
      "the reviewed ambiguous persistent-side prescription is canonical and ready", facts.review);

    await page.locator("#reviewSheet [data-review-done]").click();
    await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 5000 });
    await page.locator("#entryActivate").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#entryActivate").click();
    await page.waitForSelector("#log.view.active", { timeout: 15000 });
    await page.evaluate(() => window.__repforgeStorage.flush());
    const active = await page.evaluate(({ slotId }) => {
      const state = window.__repforgeWorkoutDraft.state();
      const row = state.program.find(item => item.slotId === slotId || item.id === slotId);
      const canonical = state.programMeta.programDefinition.days.flatMap(day => day.slots || [])
        .find(item => item.id === slotId);
      return { row, canonical };
    }, { slotId: sourceSlotId });
    facts.activated = { rowId: active.row?.id, libraryId: active.row?.libraryId,
      slotId: active.row?.slotId, mode: active.canonical?.executionMode,
      statuses: active.canonical?.prescriptionsByCycle?.[0]?.sets?.map(set => set.status) };
    check(active.canonical?.executionMode === "unilateral" && active.row?.libraryId === TARGET_ID,
      "activation retains the selected movement and explicit slot mode", facts.activated);
    if (!active.row?.id) throw new Error("The reviewed movement was not activated into the program.");

    // Actual workout Focus and Save. The movement is persistent per-side load,
    // so m=2 by itself cannot reveal the explicit unilateral mode.
    await page.evaluate((id) => window.__repforgeGoToLogExercise(id), active.row.id);
    await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 15000 });
    await page.waitForFunction((id) => document.querySelector("#workout .exercise.is-current")?.dataset.ex === id,
      active.row.id, { timeout: 10000 });
    await page.locator("#sessionSheetBtn").click();
    await page.waitForSelector("#sessionSheet.is-open", { timeout: 5000 });
    await page.locator("#sessionBodyweight").fill("80");
    await page.locator("#sessionBodyweight").dispatchEvent("input");
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    await page.locator("#sessionSheetClose").click();
    await page.waitForSelector("#sessionSheet", { state: "hidden", timeout: 5000 });

    for (const [id, value, field] of [[LOAD_ID, "25", `metric_${LOAD_ID}`], [REPS_ID, "8", `metric_${REPS_ID}`]]) {
      const input = page.locator(`#workout .exercise.is-current .focus-shelf input[data-metric-id="${id}"]`);
      await input.waitFor({ state: "attached", timeout: 10000 });
      if (await input.getAttribute("aria-hidden") === "true")
        await page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field="${field}"]`).click();
      await input.fill(value);
      await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    }
    const rir = page.locator(`#workout .exercise.is-current .focus-shelf input[data-k="${active.row.id}_1_rir"]`);
    if (await rir.getAttribute("aria-hidden") === "true")
      await page.locator('#workout .exercise.is-current .focus-shelf [data-shelf-field="rir"]').click();
    await rir.fill("2");
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    await page.locator(`#workout .exercise.is-current [data-save="${active.row.id}_1"]`).click();
    await page.waitForFunction((id) => {
      const draft = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
      const setId = draft?.setOrder?.find(key => draft.sets[key].ordinal === 1);
      return !!draft?.sets?.[setId]?.completion;
    }, active.row.id, { timeout: 15000 });
    await page.locator("#sessionSheetBtn").click();
    await page.locator("#sessionEarlyFinish").click();
    await page.locator("#sessionEarlyConfirm").click();
    await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === false,
      undefined, { timeout: 15000 });
    await page.locator("#sumDone").click();
    await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === true,
      undefined, { timeout: 10000 });
    await page.evaluate(() => window.__repforgeStorage.flush());
    const saved = await page.evaluate((id) => {
      const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      const row = (state.log || []).filter(item => item.performedLibraryId === id).at(-1);
      const slot = state.programMeta.programDefinition.days.flatMap(day => day.slots || [])
        .find(item => item.exerciseId === id);
      return { row, slot };
    }, TARGET_ID);
    facts.saved = { session: saved.row?.session, date: saved.row?.date,
      metrics: saved.row?.metricValues, loadingConvention: saved.row?.loadingConvention,
      loadingContext: saved.row?.loadingContext, slotMode: saved.slot?.executionMode };
    check(saved.row?.loadingContext?.externalLoadMultiplier === 2,
      "the saved persistent-side row retains its per-side multiplier", facts.saved);
    check(saved.slot?.executionMode === "unilateral" &&
      !Object.prototype.hasOwnProperty.call(saved.row?.loadingContext || {}, "executionMode"),
      "the activated slot has a mode but the saved row has no captured mode", facts.saved);
    check(saved.row?.metricValues?.some(item => item.metricId === LOAD_ID && item.value === 25) &&
      saved.row?.metricValues?.some(item => item.metricId === REPS_ID && item.value === 8),
      "the saved row retains the valid raw per-side load and reps", facts.saved);
    await page.clock.setFixedTime(new Date("2026-10-07T12:00:00.000Z"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await page.evaluate((id) => window.__repforgeGoToLogExercise(id), active.row.id);
    await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 15000 });
    const next = await page.evaluate((id) => {
      const slot = window.__repforgeProgression.programSlot(id);
      const rec = window.__repforgeProgression.recommendation(slot);
      return { slotMode: slot?.executionMode, rec: {
        status: rec?.status, engineStatus: rec?.engineStatus, reason: rec?.reason,
        reasonCodes: rec?.reasonCodes, load: rec?.load, historyAnchor: rec?.historyAnchor,
        result: rec?.targetSets?.[0]?.result,
      }, currentCue: document.querySelector("#workout .exercise.is-current")?.innerText };
    }, active.row.id);
    facts.nextSession = next;
    check(next.slotMode === "unilateral", "next-session program slot still knows the explicit mode", next);
    check(next.rec?.historyAnchor != null && next.rec?.engineStatus === "recommended",
      "next-session recommendation has a comparable anchor from the saved mode", next);
    check(pageErrors.length === 0, "the production journey has no page errors", pageErrors);
  } catch (error) {
    failures.push(String(error?.stack || error));
    console.error(error?.stack || error);
    if (pageErrors.length) console.error(pageErrors.join("\n"));
  } finally {
    const outputRoot = process.env.REPFORGE_ARTIFACT_DIR || ".ci-results/packet-069-s4/persistent-mode-diagnostic";
    mkdirSync(outputRoot, { recursive: true });
    writeFileSync(join(outputRoot, "report.json"), `${JSON.stringify({ facts, failures, pageErrors }, null, 2)}\n`);
    await browser.close();
  }
  console.log(`\nS4 persistent-mode diagnosis: ${failures.length ? "symptom reproduced" : "no symptom"}; ${failures.length} failed contract checks`);
  if (failures.length) process.exitCode = 1;
}

await main();
