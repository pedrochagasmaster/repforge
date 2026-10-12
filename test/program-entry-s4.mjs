#!/usr/bin/env node
/** Packet 1.3 production journey: review deload edit → activation → Today/Focus. */
import assert from "node:assert/strict";
import { answerRecommend, launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const START = new Date("2026-09-01T12:00:00.000Z");
const state = (page) => page.evaluate(() => window.__repforgeWorkoutDraft.state());
const entry = (page) => page.evaluate(() => window.__repforgeEntryState?.());

async function editFirstSlotToSixSets(page, slotId) {
  await page.locator(`#entryReview [data-review-slot="${slotId}"]`).click();
  await page.locator("#reviewSheet.is-open [data-review-sets]").first().waitFor({ state: "visible", timeout: 5000 });
  const locale = await page.locator("html").getAttribute("lang");
  const expectedDeloadNote = locale?.toLowerCase().startsWith("pt")
    ? "Na semana de deload: cerca de metade das séries e RIR 2 acima."
    : "In the deload week: about half the sets and RIR 2 higher.";
  assert.equal((await page.locator("#reviewSheet .review-sheet__note").innerText()).trim(), expectedDeloadNote,
    "the exercise sheet explains the compiler's deload rule with approved copy");
  for (;;) {
    const count = await page.evaluate((id) => window.__repforgeEntryState().result.preview.programDefinition.days
      .flatMap((day) => day.slots).find((slot) => slot.id === id).prescriptionsByCycle[0].sets.length, slotId);
    if (count >= 6) break;
    await page.locator('#reviewSheet [data-review-sets="1"]').click();
    await page.waitForFunction(({ id, want }) => window.__repforgeEntryState()?.result?.preview?.programDefinition.days
      .flatMap((day) => day.slots).find((slot) => slot.id === id)?.prescriptionsByCycle[0]?.sets.length === want,
    { id: slotId, want: count + 1 }, { timeout: 10000 });
  }
}

const browser = await launchChromium();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "UTC" });
  const page = await context.newPage();
  await page.clock.setFixedTime(START);
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await answerRecommend(page, { skipBasics: true });
  await page.locator("#entryReview [data-review-slot]").first().waitFor({ state: "visible", timeout: 15000 });

  const initial = await entry(page);
  const firstDay = initial.result.preview.programDefinition.days.find((day) => day.kind === "training");
  const firstSlot = firstDay.slots[0];
  assert.equal(await page.locator("#entryReview [data-review-block-edit]").count(), 1,
    "the production review exposes the block row's Change action");
  await page.locator("#entryReview [data-review-block-edit]").click();
  await page.locator("#reviewSheet.is-open [data-review-block-weeks]").waitFor({ state: "visible", timeout: 5000 });
  const initialBlockSheet = await page.evaluate(() => ({
    title: document.querySelector("#reviewSheetTitle")?.textContent.trim(),
    weeks: document.querySelector("[data-review-block-weeks]")?.textContent.trim(),
    patternCount: document.querySelectorAll("#reviewSheet [data-review-block-pattern]").length,
    selectedPattern: document.querySelector("#reviewSheet [data-review-block-pattern][aria-checked='true']")?.dataset.reviewBlockPattern,
    deload: document.querySelector("#reviewSheet [data-review-block-deload]")?.getAttribute("aria-checked"),
  }));
  const expectedBlockTitle = await page.evaluate(() => window.RepForgeI18n.t("entry.review.block.sheet.title"));
  const expectedSevenWeeks = await page.evaluate(() => window.RepForgeI18n.t("entry.review.block.weeks", { n: 7 }));
  assert.equal(initialBlockSheet.title, expectedBlockTitle, "the block sheet uses the approved title");
  assert.equal(initialBlockSheet.weeks, expectedSevenWeeks, "the block sheet defaults to seven weeks");
  assert.equal(initialBlockSheet.patternCount, 4, "all four approved rep patterns are available");
  assert.equal(initialBlockSheet.selectedPattern, "static", "the default pattern is static");
  assert.equal(initialBlockSheet.deload, "true", "the recommended deload switch starts on");
  await page.locator("#reviewSheet [data-review-block-deload]").click();
  assert.equal(await page.locator("#reviewSheet [data-review-block-deload]").getAttribute("aria-checked"), "false",
    "the deload switch can be turned off");
  await page.locator("#reviewSheet [data-review-block-deload]").click();
  await page.locator("#reviewSheet [data-review-sheet-close]").click();
  await page.locator("#reviewSheet").waitFor({ state: "hidden", timeout: 5000 });

  const sameSeed = initial.result.preview.programDefinition.seed;
  await editFirstSlotToSixSets(page, firstSlot.id);
  const editedBeforeBlock = await entry(page);
  const editedBeforeSlot = editedBeforeBlock.result.preview.programDefinition.days.flatMap((day) => day.slots)
    .find((slot) => slot.id === firstSlot.id);
  assert.equal(editedBeforeSlot.prescriptionsByCycle.at(-1).sets.length, 3,
    "the production review editor's six-set edit produces three sets in the deload cycle");
  await page.locator("#reviewSheet [data-review-done]").click();
  await page.locator("#reviewSheet").waitFor({ state: "hidden", timeout: 5000 });

  await page.locator("#entryReview [data-review-block-edit]").click();
  await page.locator("#reviewSheet.is-open [data-review-block-weeks]").waitFor({ state: "visible", timeout: 5000 });
  for (let index = 0; index < 3; index++) await page.locator('#reviewSheet [data-review-block-step="1"]').click();
  await page.locator('#reviewSheet [data-review-block-pattern="undulating"]').click();
  await page.locator("#reviewSheet [data-review-block-apply]").click();
  await page.waitForFunction(() => document.querySelector("#entryDialog")?.open === true,
    undefined, { timeout: 5000 });
  const heldForConfirmation = await page.evaluate((id) => {
    const current = window.__repforgeEntryState();
    const slot = current.result.preview.programDefinition.days.flatMap((day) => day.slots).find((item) => item.id === id);
    return { cycles: current.result.preview.programDefinition.cycles, sets: slot.prescriptionsByCycle[0].sets.length };
  }, firstSlot.id);
  assert.equal(heldForConfirmation.cycles, 7, "block answers do not change before the edit-discard confirmation");
  assert.equal(heldForConfirmation.sets, 6, "the existing review edit remains while confirmation is open");
  await page.locator("#reviewConfirmGo").click();
  await page.waitForFunction(() => window.__repforgeEntryState()?.result?.preview?.programDefinition?.cycles === 10 &&
    window.__repforgeEntryState()?.answers?.block?.periodization === "undulating" &&
    window.__repforgeEntryState()?.answers?.deload === true,
  undefined, { timeout: 20000 });
  const rebuilt = await entry(page);
  assert.equal(rebuilt.result.preview.programDefinition.seed, sameSeed, "the block edit rebuilds with the same seed");
  assert.deepEqual(rebuilt.result.preview.programDefinition.deloadCycles, [10], "deload moves to the new last week");
  assert.equal(rebuilt.result.preview.programDefinition.days.flatMap((day) => day.slots)[0]
    .prescriptionsByCycle[0].sets[0].provenance.periodization, "undulating", "the new rep pattern reaches the compiler output");

  await editFirstSlotToSixSets(page, firstSlot.id);
  const edited = await entry(page);
  const editedSlot = edited.result.preview.programDefinition.days.flatMap((day) => day.slots).find((slot) => slot.id === firstSlot.id);
  assert.equal(editedSlot.prescriptionsByCycle.at(-1).sets.length, 3,
    "the production review editor's six-set edit produces three sets in the deload cycle");

  await page.locator("#reviewSheet [data-review-done]").click();
  await page.locator("#reviewSheet").waitFor({ state: "hidden", timeout: 5000 });
  await page.locator("#entryActivate").click();
  await page.waitForFunction(() => window.__repforgeWorkoutDraft.state()?.programMeta?.onboarded === true,
    undefined, { timeout: 20000 });
  await page.evaluate(() => window.__repforgeStorage?.flush?.());
  const active = await state(page);
  const activeSlot = active.programMeta.programDefinition.days.flatMap((day) => day.slots).find((slot) => slot.id === firstSlot.id);
  assert.equal(activeSlot.prescriptionsByCycle.at(-1).sets.length, 3,
    "activation retains the review editor's deload prescription");
  assert.deepEqual(active.programMeta.programDefinition.deloadCycles, [10], "the generated program has its last-week deload");
  const firstWeek = await page.evaluate(() => window.__repforgeMesocycleWeek());
  assert.deepEqual([firstWeek.current, firstWeek.total], [1, 10], "Today starts at week one of ten after activation");

  await page.clock.setFixedTime(new Date(START.getTime() + 63 * 24 * 60 * 60 * 1000));
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  const reloaded = await state(page);
  const reloadedSlot = reloaded.programMeta.programDefinition.days.flatMap((day) => day.slots).find((slot) => slot.id === firstSlot.id);
  assert.equal(reloadedSlot.prescriptionsByCycle.at(-1).sets.length, 3,
    "the activated six-set edit survives the ordinary reload");
  assert.deepEqual(reloaded.programMeta.programDefinition.deloadCycles, [10],
    "the active program keeps its final deload cycle after reload");
  const today = await page.evaluate(() => ({
    block: window.__repforgeMesocycleWeek(),
    deload: [...document.querySelectorAll("#todayDash *")].some((node) =>
      node.children.length === 0 && node.textContent.trim() === window.RepForgeI18n.t("today.deload_week")),
    text: document.querySelector("#todayDash")?.innerText || "",
  }));
  assert.equal(today.block.current, 10, "Today is in the active program's final week");
  assert.equal(today.deload, true, "Today shows the approved deload-week line");

  await page.locator("#startWorkout").click();
  await page.locator("#workoutShell").waitFor({ state: "visible", timeout: 10000 });
  const focus = await page.evaluate(() => ({
    visible: getComputedStyle(document.querySelector("#woDaySub")).display !== "none" &&
      getComputedStyle(document.querySelector("#woDaySub")).visibility !== "hidden",
    text: document.querySelector("#woDaySub")?.textContent.trim() || "",
    expected: window.RepForgeI18n.t("today.deload_week"),
  }));
  assert.equal(focus.visible && focus.text.includes(focus.expected), true,
    "Focus shows the approved deload-week line in its visible header");
  assert.deepEqual(errors, [], "the production journey has no page errors");
  await context.close();
} finally {
  await browser.close();
}

console.log("PASS P072-S4-BLOCK/DELOAD: guarded same-seed rebuild, activation, Today and Focus");
