#!/usr/bin/env node
/** Packet 1.3 production journey: review deload edit → activation → Today/Focus. */
import assert from "node:assert/strict";
import { answerRecommend, launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const START = new Date("2026-09-01T12:00:00.000Z");
const state = (page) => page.evaluate(() => window.__repforgeWorkoutDraft.state());
const entry = (page) => page.evaluate(() => window.__repforgeEntryState?.());

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
  await page.locator(`#entryReview [data-review-slot="${firstSlot.id}"]`).click();
  await page.locator("#reviewSheet.is-open [data-review-sets]").first().waitFor({ state: "visible", timeout: 5000 });

  for (;;) {
    const count = await page.evaluate((id) => window.__repforgeEntryState().result.preview.programDefinition.days
      .flatMap((day) => day.slots).find((slot) => slot.id === id).prescriptionsByCycle[0].sets.length, firstSlot.id);
    if (count >= 6) break;
    await page.locator('#reviewSheet [data-review-sets="1"]').click();
    await page.waitForFunction(({ id, want }) => window.__repforgeEntryState()?.result?.preview?.programDefinition.days
      .flatMap((day) => day.slots).find((slot) => slot.id === id)?.prescriptionsByCycle[0]?.sets.length === want,
    { id: firstSlot.id, want: count + 1 }, { timeout: 10000 });
  }
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
  assert.deepEqual(active.programMeta.programDefinition.deloadCycles, [7], "the generated program has its last-week deload");

  await page.clock.setFixedTime(new Date(START.getTime() + 42 * 24 * 60 * 60 * 1000));
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  const reloaded = await state(page);
  const reloadedSlot = reloaded.programMeta.programDefinition.days.flatMap((day) => day.slots).find((slot) => slot.id === firstSlot.id);
  assert.equal(reloadedSlot.prescriptionsByCycle.at(-1).sets.length, 3,
    "the activated six-set edit survives the ordinary reload");
  assert.deepEqual(reloaded.programMeta.programDefinition.deloadCycles, [7],
    "the active program keeps its final deload cycle after reload");
  const today = await page.evaluate(() => ({
    block: window.__repforgeMesocycleWeek(),
    deload: [...document.querySelectorAll("#todayDash *")].some((node) =>
      node.children.length === 0 && node.textContent.trim() === window.RepForgeI18n.t("today.deload_week")),
    text: document.querySelector("#todayDash")?.innerText || "",
  }));
  assert.equal(today.block.current, 7, "Today is in the active program's seventh week");
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

console.log("PASS P072-S4-DELOAD: review, activation, Today and Focus");
