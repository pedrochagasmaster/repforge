#!/usr/bin/env node
/**
 * Plan 067: Progress planned volume follows the per-cycle ProgramDefinition
 * across a recovery week.
 *
 * A generated program reaches the end of its block and the lifter answers Yes
 * to a recovery week. The committed successor inserts a deload cycle at the
 * start of the new block. The workout schedule and every Progress denominator
 * must read the same cycle: week one plans the halved deload prescription,
 * week two returns to the full prescription, and block-to-date totals keep the
 * deload week's own sets instead of re-projecting the current week backwards.
 * The predecessor block's planned volume never leaks into the successor.
 */
import { readFileSync } from "node:fs";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const DATA = new URL("../plans/067/data/", import.meta.url);
const gym = JSON.parse(readFileSync(new URL("gym.json", DATA), "utf8"));
const observations = JSON.parse(readFileSync(new URL("programs.json", DATA), "utf8"));
const catalog = JSON.parse(readFileSync(new URL("app_file.json", DATA), "utf8"));
const observedIds = [...new Set(Object.values(observations).flatMap((program) =>
  program.days.flatMap((day) => day.exercises.map((entry) => entry.exerciseId))))];
const REQUEST = {
  goal: "hypertrophy", experience: "intermediate", daysPerWeek: 4, timeCeilingMinutes: 90,
  gymProfile: { equipmentIds: gym.equipment.map((entry) => entry.equipmentId) },
  competencyAnswers: {
    pullups10: null, pullups5: null, pushups15: null, inclineBarbell10: null,
    overheadPress10: null, bodyweightDips10: null, benchPress10: null,
  },
  movementConfirmations: Object.fromEntries(observedIds.map((id) =>
    [id, [...catalog.exercises.find((entry) => entry.id === id).preconditions]])),
  emphasisMuscleIds: [], deprioritizedMuscleIds: [], excludedExerciseIds: [], excludedMuscleIds: [],
  preferredExerciseIds: [], split: "auto", periodization: "static", cycles: 4, deloadCycles: [],
};
const DAY = 86400000;

const failures = [];
let passed = 0;
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 2000)}`);
}

const training = (definition) => definition.days.filter((day) => day.kind === "training");
/** Working sets one numbered week (cycle) of the definition prescribes. */
const cycleSets = (definition, cycle) => training(definition).flatMap((day) => day.slots)
  .reduce((total, slot) => total + (slot.prescriptionsByCycle.find((entry) => entry.cycleIndex === cycle)?.sets.length ?? 0), 0);
const state = (page) => page.evaluate(() => window.__repforgeWorkoutDraft.state());

async function at(page, time) {
  await page.clock.setFixedTime(new Date(time));
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
}

async function readWeek(page) {
  return page.evaluate(() => ({
    scheduled: window.__repforgeProgressReview.scheduledProgram().reduce((total, row) => total + row.sets, 0),
    week: window.__repforgeProgressEvidence.volume("this-week"),
    block: window.__repforgeProgressEvidence.volume("block-to-date"),
  }));
}

async function main() {
  console.log("P067 Progress volume across a recovery week");
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  try {
    const start = Date.parse("2026-03-02T09:00:00.000Z");
    await page.clock.setFixedTime(new Date(start));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const seeded = await page.evaluate(async (request) => {
      const generated = window.RepForgeProgramCompiler.generateProgram(request, window.RepForgeExerciseCatalog.snapshot(), "progress-recovery-067");
      if (!generated.ok) return { ok: false, generated };
      const finalized = await window.__repforgeFinalizeProgramSetup({
        programDefinition: generated.value, name: "Recovery volume", answers: {}, destination: "log", origin: "first-run",
        draftConfirmed: true, telemetryRoute: "recommend", entrySource: { route: "recommend", fingerprint: "progress-recovery-067" },
      });
      await window.__repforgeStorage.flush();
      return { ok: !!(finalized?.localOk || finalized?.idbOk) };
    }, REQUEST);
    if (!seeded.ok) throw new Error(`seeding failed: ${JSON.stringify(seeded).slice(0, 1500)}`);

    const source = await state(page);
    const full = cycleSets(source.programMeta.programDefinition, 1);
    const firstWeek = await readWeek(page);
    check(firstWeek.week.plannedWorkingSets === full && firstWeek.scheduled === full,
      "before the transition, this week's planned volume is the definition's first cycle", { full, firstWeek });

    // The block ends; the lifter schedules a recovery week through Review.
    const end = Date.parse(`${source.programMeta.started}T09:00:00.000Z`) + (source.programMeta.mesocycleLengthWeeks * 7 + 1) * DAY;
    await at(page, end);
    await page.locator('nav button[data-view="stats"]').click();
    await page.locator('#statsSeg [data-seg="review"]').click();
    await page.locator('[data-review-action="recovery-week"]').click();
    await page.locator('[data-recovery-answer="Yes"]').click();
    await page.locator("[data-preview-confirm]").waitFor({ state: "visible", timeout: 15000 });
    await page.locator("[data-preview-confirm]").click();
    await page.waitForFunction((id) => window.__repforgeWorkoutDraft.state()?.programMeta?.id !== id ||
      document.querySelector("#reviewPanel .review__error"), source.programMeta.id, { timeout: 30000 });
    check(!await page.locator("#reviewPanel .review__error").count(), "the recovery week commits",
      await page.evaluate(() => JSON.stringify(window.__repforgeProgressReview.flow())));
    await page.evaluate(() => window.__repforgeStorage.flush());

    const recovered = await state(page);
    const definition = recovered.programMeta.programDefinition;
    const deload = cycleSets(definition, 1), normal = cycleSets(definition, 2);
    check(definition.deloadCycles?.[0] === 1 && deload < normal && normal === full,
      "the successor's first cycle is a deload and its second returns to the full prescription", { deload, normal, full });
    check(!recovered.programMeta.plannedVolumeHistory,
      "the successor block starts with no planned-volume history of its own", recovered.programMeta.plannedVolumeHistory);

    // Week one: the deload is what the workout schedules and what Progress plans.
    await at(page, Date.parse(`${recovered.programMeta.started}T12:00:00.000Z`));
    const weekOne = await readWeek(page);
    check(weekOne.scheduled === deload, "week one schedules the deload prescription", weekOne.scheduled);
    check(weekOne.week.plannedWorkingSets === deload,
      "week one's this-week planned volume is the deload prescription", weekOne.week.plannedWorkingSets);
    check(weekOne.block.period.elapsedNumberedWeeks === 1 && weekOne.block.plannedWorkingSets === deload,
      "week one's block-to-date planned volume is the deload week alone, not the predecessor total", weekOne.block);

    // Week two: back to the full cycle; block-to-date keeps the deload week.
    await at(page, Date.parse(`${recovered.programMeta.started}T12:00:00.000Z`) + 7 * DAY);
    const weekTwo = await readWeek(page);
    check(weekTwo.scheduled === normal, "week two schedules the full prescription again", weekTwo.scheduled);
    check(weekTwo.week.plannedWorkingSets === normal,
      "week two's this-week planned volume is the full prescription", weekTwo.week.plannedWorkingSets);
    check(weekTwo.block.plannedWorkingSets === deload + normal,
      "week two's block-to-date keeps the deload week and adds the full week", { expected: deload + normal, got: weekTwo.block.plannedWorkingSets });

    // Later in the block the deload week is still counted once, at its own size.
    await at(page, Date.parse(`${recovered.programMeta.started}T12:00:00.000Z`) + 21 * DAY);
    const weekFour = await readWeek(page);
    const expected = [1, 2, 3, 4].reduce((total, cycle) => total + cycleSets(definition, cycle), 0);
    check(weekFour.block.period.elapsedNumberedWeeks === 4 && weekFour.block.plannedWorkingSets === expected,
      "week four's block-to-date sums each cycle's own prescription", { expected, got: weekFour.block });

    check(errors.length === 0, "no page errors during the recovery-volume journey", errors);
  } catch (error) {
    failures.push(String(error?.stack || error));
    console.error(error?.stack || error);
    if (errors.length) console.error(errors.join("\n"));
  } finally {
    await browser.close();
  }
  console.log(`\nP067 recovery volume result: ${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

await main();
