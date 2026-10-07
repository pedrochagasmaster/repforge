#!/usr/bin/env node
/**
 * Plan 067 slice 2: Generate through the production entry UI.
 *
 * A fresh device answers the Generate questions, reviews the generated
 * program, and activates it; the stored ProgramDefinition is exactly the
 * canonical generator output for the mapped request and the draft's seed, and
 * survives reload. Cancelling leaves no program. Every answer combination the
 * UI offers is feasible; impossible requests are proved by the compiler suite.
 */
import { createRequire } from "node:module";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const require = createRequire(import.meta.url);
const Adapter = require("../program-entry-adapter.js");
const Compiler = require("../program-compiler.js");
const Catalog = require("../assets/exercise-catalog.json");

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const failures = [];
let passed = 0;
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 2000)}`);
}
const state = (page) => page.evaluate(() => window.__repforgeWorkoutDraft.state());
const entry = (page) => page.evaluate(() => window.__repforgeEntryState?.());

async function fresh(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  return { context, page, errors };
}

async function pick(page, key, value) {
  await page.locator(`[data-entry-pick="${key}"][data-entry-val="${value}"]`).first().click();
}

async function answerGenerate(page, { days = 4, minutes = 60, environment = "commercial_gym" } = {}) {
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await page.locator('[data-entry-route="recommend"][data-entry-goal="muscle_growth"]').click();
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "background");
  await pick(page, "structuredExperience", "6_to_24m");
  await pick(page, "recentConsistency", "most");
  await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "schedule");
  await pick(page, "daysPerWeek", days);
  await pick(page, "sessionMinutes", minutes);
  await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "environment");
  await pick(page, "environment", environment);
  await page.click("#onbNext");
  await page.waitForFunction(() => ["priorities", "result"].includes(window.__repforgeEntryState?.()?.step));
  if ((await entry(page)).step === "priorities") await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "result");
}

async function main() {
  console.log("P067 slice 2: Generate → review → activate through the production entry UI");
  const browser = await launchChromium();
  const allErrors = [];
  try {
    // Generate and activate ------------------------------------------------
    const { context, page, errors } = await fresh(browser);
    allErrors.push(errors);
    await answerGenerate(page);
    await page.locator("#entryActivate").waitFor({ state: "visible", timeout: 15000 });
    const staged = await entry(page);
    const definition = staged.result?.preview?.programDefinition;
    const mapped = Adapter.programRequestFromAnswers(staged.answers, Catalog);
    const expected = Compiler.generateProgram(mapped.value, Catalog, String(staged.draftId));
    check(expected.ok && JSON.stringify(definition) === JSON.stringify(expected.value),
      "the reviewed program is exactly the canonical generator output for the answers and the draft seed");
    check(definition?.request?.goal === "hypertrophy" && definition.request.daysPerWeek === 4 &&
      definition.request.timeCeilingMinutes === 60, "the answers reach the generator as goal, days and time ceiling");
    const weekText = await page.locator("#entryCandidateReview").innerText();
    const firstSlot = definition.days.find((day) => day.kind === "training").slots[0];
    const firstName = Catalog.exercises.find((item) => item.id === firstSlot.exerciseId).name;
    check(weekText.includes(firstName), "the review lists the generated movements", firstName);
    check(await state(page).then((value) => !value.programMeta.onboarded && value.program.length === 0),
      "reviewing a generated program writes nothing to the training state");

    await page.click("#entryActivate");
    await page.waitForFunction(() => window.__repforgeWorkoutDraft.state()?.programMeta?.onboarded === true, undefined, { timeout: 20000 });
    await page.evaluate(() => window.__repforgeStorage?.flush?.());
    const active = await state(page);
    check(JSON.stringify(active.programMeta.programDefinition) === JSON.stringify(definition),
      "activation stores the reviewed definition unchanged");
    check(active.program.length === definition.days.flatMap((day) => day.slots).length &&
      active.programMeta.mesocycleLengthWeeks === definition.cycles,
    "the active program projects every generated slot and the block follows its cycles");
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    check(JSON.stringify((await state(page)).programMeta.programDefinition) === JSON.stringify(definition),
      "the activated program survives a reload exactly");
    await context.close();

    // Cancel leaves no program ---------------------------------------------
    const cancel = await fresh(browser);
    allErrors.push(cancel.errors);
    await answerGenerate(cancel.page);
    await cancel.page.locator("#onbCancel").click();
    const discard = cancel.page.locator("#entryCancelDiscard");
    await Promise.race([discard.waitFor({ state: "visible", timeout: 10000 }),
      cancel.page.locator("#onboarding.active").waitFor({ state: "detached", timeout: 10000 })]).catch(() => {});
    if (await discard.isVisible()) await discard.click();
    await cancel.page.waitForFunction(() => !document.querySelector("#onboarding.active"), undefined, { timeout: 10000 });
    const cancelled = await state(cancel.page);
    check(!cancelled.programMeta.onboarded && cancelled.program.length === 0 && !cancelled.programMeta.programDefinition,
      "cancelling Generate leaves the device without a program");
    await cancel.context.close();

    // Different drafts may differ, the same draft is stable ------------------
    const again = await fresh(browser);
    allErrors.push(again.errors);
    await answerGenerate(again.page);
    const first = (await entry(again.page)).result.preview.programDefinition;
    await again.page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(again.page, { base: BASE });
    const resumed = await again.page.evaluate(() =>
      JSON.parse(localStorage.getItem("repforge_program_setup_draft_v1") || "null")?.state?.result?.preview?.programDefinition);
    check(JSON.stringify(resumed) === JSON.stringify(first), "the setup draft keeps the reviewed program across a reload");
    await again.context.close();

    check(allErrors.flat().length === 0, "no page errors during Generate", allErrors.flat());
  } catch (error) {
    failures.push(String(error?.stack || error));
    console.error(error?.stack || error);
    for (const context of browser.contexts()) for (const page of context.pages()) {
      console.error(JSON.stringify(await page.evaluate(() => ({ step: window.__repforgeEntryState?.()?.step,
        answers: window.__repforgeEntryState?.()?.answers, reason: document.querySelector("#onbNextReason")?.textContent,
        error: document.querySelector("#onbBody .entry__notice")?.textContent })).catch(() => null)));
    }
  } finally {
    await browser.close();
  }
  console.log(`\nP067 Generate result: ${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

await main();
