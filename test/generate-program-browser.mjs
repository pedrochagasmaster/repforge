#!/usr/bin/env node
/**
 * Plan 067 slice 2: Generate through the production entry UI.
 *
 * A fresh device answers the Generate questions, reviews the generated
 * program, and activates it; the stored ProgramDefinition is exactly the
 * canonical generator output for the mapped request and the draft's seed, and
 * survives reload. Cancelling leaves no program, and a request the generator
 * cannot fit shows its conflict instead of a partial program.
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

async function fresh(browser, { uuid } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  // A pinned draftId pins the generator's seed, so a scenario that needs a
  // specific candidate-selection outcome (the abilities-gated exercise proof
  // below) is deterministic rather than depending on which random id this
  // run happened to draw.
  if (uuid) {
    await page.addInitScript((fixed) => {
      try { Object.defineProperty(globalThis.crypto, "randomUUID", { value: () => fixed, configurable: true }); }
      catch { globalThis.crypto.randomUUID = () => fixed; }
    }, uuid);
  }
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  return { context, page, errors };
}

async function pick(page, key, value) {
  await page.locator(`[data-entry-pick="${key}"][data-entry-val="${value}"]`).first().click();
}

async function answerGenerate(page, { days = 4, minutes = 60, environment = "commercial_gym", abilities = null } = {}) {
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await page.locator('[data-entry-route="recommend"][data-entry-goal="muscle_growth"]').click();
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "background");
  await pick(page, "structuredExperience", "6_to_24m");
  await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "schedule");
  await pick(page, "daysPerWeek", days);
  await pick(page, "sessionMinutes", minutes);
  await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "environment");
  await pick(page, "environment", environment);
  await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "abilities");
  if (abilities === "skip") {
    await page.click("#entryAbilitiesSkip");
  } else {
    for (const [key, choice] of Object.entries(abilities || {})) await pick(page, "competencyAnswer", `${key}|${choice}`);
    await page.click("#onbNext");
  }
  await page.waitForFunction(() => ["priorities", "result"].includes(window.__repforgeEntryState?.()?.step));
  if ((await entry(page)).step === "priorities") await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "result");
}

async function impossible(browser) {
  const run = await fresh(browser);
  await answerGenerate(run.page, { days: 2, minutes: 20 });
  const notice = run.page.locator("#onbBody .entry__notice[role=alert]");
  await notice.waitFor({ state: "visible", timeout: 15000 });
  const text = await notice.innerText();
  check(/session length|more time per session/i.test(text) && !await run.page.locator("#entryActivate").count(),
    "two full-body days in up to 20 minutes show the time conflict and offer no program", text);
  check(!(await state(run.page)).programMeta.programDefinition, "a conflicting request writes no program");
  await run.context.close();
  return run.errors;
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

    // Movement abilities: answering yes unlocks a gated exercise (#323) ----
    const abilityYes = await fresh(browser, { uuid: "0" });
    allErrors.push(abilityYes.errors);
    await answerGenerate(abilityYes.page, { abilities: { benchPress10: "yes" } });
    const abilityYesStaged = await entry(abilityYes.page);
    check(abilityYesStaged.answers.competencyAnswers?.benchPress10 === true,
      "answering yes to bench press x10 records a true competency answer", abilityYesStaged.answers.competencyAnswers);
    const benchId = Catalog.exercises.find((item) => item.name === "Barbell bench press").id;
    const abilityYesMapped = Adapter.programRequestFromAnswers(abilityYesStaged.answers, Catalog);
    const seed = String(abilityYesStaged.draftId);
    const withAnswer = abilityYesMapped.ok ? Compiler.generateProgram(abilityYesMapped.value, Catalog, seed) : { ok: false };
    const withoutAnswerRequest = abilityYesMapped.ok
      ? { ...abilityYesMapped.value, competencyAnswers: { ...abilityYesMapped.value.competencyAnswers, benchPress10: null } }
      : null;
    const withoutAnswer = withoutAnswerRequest ? Compiler.generateProgram(withoutAnswerRequest, Catalog, seed) : { ok: false };
    const idsWith = withAnswer.ok ? withAnswer.value.days.flatMap((day) => (day.slots || []).map((slot) => slot.exerciseId)) : [];
    const idsWithout = withoutAnswer.ok ? withoutAnswer.value.days.flatMap((day) => (day.slots || []).map((slot) => slot.exerciseId)) : [];
    check(idsWith.includes(benchId) && !idsWithout.includes(benchId),
      "answering yes to bench press x10 makes barbell bench press eligible for a commercial-gym program, where it was not without the answer",
      { idsWith, idsWithout });
    await abilityYes.context.close();

    // Skipping movement abilities keeps every competency answer unsure -----
    const abilitySkip = await fresh(browser);
    allErrors.push(abilitySkip.errors);
    await answerGenerate(abilitySkip.page, { abilities: "skip" });
    const abilitySkipStaged = await entry(abilitySkip.page);
    const abilitySkipMapped = Adapter.programRequestFromAnswers(abilitySkipStaged.answers, Catalog);
    check(abilitySkipMapped.ok && Object.values(abilitySkipMapped.value.competencyAnswers).every((value) => value === null),
      "skipping movement abilities keeps every competency answer unsure (null)", abilitySkipMapped.value?.competencyAnswers);
    await abilitySkip.context.close();

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

    allErrors.push(await impossible(browser));
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
