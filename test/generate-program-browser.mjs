#!/usr/bin/env node
/**
 * Plan 067 slice 2: Generate through the production entry UI.
 *
 * A fresh device answers the Generate questions, reviews the generated
 * program, and activates it; the stored ProgramDefinition is exactly the
 * canonical generator output for the mapped request and the draft's seed, and
 * survives reload. Cancelling leaves no program, and a request the generator
 * cannot fit shows its conflict instead of a partial program.
 *
 * Plan 070: the result screen is onboarding B's program editor. The lifter
 * adjusts sets, RIR, rest, the rep range, alternates, swaps (an engine
 * candidate and a catalog search), moves, removes and adds exercises, renames
 * and reorders a day, undoes and restores, and activates. After every step the
 * setup draft holds exactly the edit log replayed by program-review.js on the
 * recommendation; the activated program is that definition, it survives a
 * reload, and the first workout starts with the edited prescriptions.
 */
import { createRequire } from "node:module";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const require = createRequire(import.meta.url);
const Adapter = require("../program-entry-adapter.js");
const Compiler = require("../program-compiler.js");
const Catalog = require("../assets/exercise-catalog.json");
const Metrics = require("../exercise-metrics.js");
const Review = require("../program-review.js");
const REVIEW_CTX = { compiler: Compiler, catalog: Catalog, metrics: Metrics };

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

// Plan 070: review and adjust -------------------------------------------------
const reviewed = (page) => page.evaluate(() => window.__repforgeEntryState?.()?.result?.preview?.programDefinition);
const reviewLog = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("repforge_entry_review_v1") || "null"));
const slotsOf = (definition) => definition.days.flatMap((day) => day.slots || []);
const trainingDays = (definition) => definition.days.filter((day) => day.kind === "training");

/** One adjustment through the screen, mirrored as one edit in the expected log.
 *  The setup draft must then hold exactly that log replayed on the
 *  recommendation, so the screen can neither skip nor invent a change. */
async function step(page, run, edit, act, label) {
  await act();
  if (edit) run.log.push(edit);
  const expected = Review.replay(run.baseline, run.log, REVIEW_CTX);
  if (!expected.ok) throw new Error(`${label}: the expected log does not replay (${expected.code} at ${expected.failedAt})`);
  const want = JSON.stringify(expected.definition);
  const settled = await page.waitForFunction((value) =>
    JSON.stringify(window.__repforgeEntryState?.()?.result?.preview?.programDefinition) === value, want, { timeout: 10000 })
    .then(() => true, () => false);
  const painted = settled && await page.waitForFunction(() => !document.querySelector("#entryReview[aria-busy]"), undefined, { timeout: 10000 })
    .then(() => true, () => false);
  check(settled && painted, `review: ${label}`, settled ? undefined : { log: run.log });
  run.expected = expected.definition;
}

async function openSlot(page, slotId) {
  await page.locator(`#entryReview [data-review-slot="${slotId}"]`).click();
  await page.waitForSelector("#reviewSheet.is-open [data-review-sets]", { timeout: 5000 });
}
async function closeSheet(page) {
  await page.locator("#reviewSheet [data-review-done]").click();
  await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 5000 });
}
async function pickFromCatalog(page, query) {
  await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
  await page.fill("#exPickSearch", query);
  const row = page.locator("#exPickList .pickrow").first();
  await row.waitFor({ timeout: 5000 });
  const id = await row.getAttribute("data-pick");
  await row.click();
  await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
  return id;
}

/** After a reload the entry flow comes back through its resume card, or
 *  straight onto the screen it was on. */
async function resumeReview(page) {
  await page.waitForSelector("#entryReview [data-review-slot], #entryResumeContinue, #firstRunCreate", { timeout: 15000 });
  if (!await page.locator("#entryReview [data-review-slot]").count()) {
    if (!await page.locator("#entryResumeContinue").count()) await page.click("#firstRunCreate");
    await page.click("#entryResumeContinue");
  }
  await page.waitForSelector("#entryReview [data-review-slot]", { timeout: 15000 });
}

async function reviewAndAdjust(browser) {
  const run = await fresh(browser);
  const { page } = run;
  await answerGenerate(page);
  await page.waitForSelector("#entryReview [data-review-slot]", { timeout: 15000 });
  run.baseline = await reviewed(page);
  run.log = [];
  check(!await page.locator("#entryEdit").count(), "review: the Build-editor jump is gone from the result screen");
  check(await page.locator("#entryReview [data-review-tab]").count() === 7, "review: one tab per day of the week, rest days included");
  const [dayA, dayB] = trainingDays(run.baseline);
  const [slotA, slotB, slotC] = dayA.slots;

  // One sheet per exercise: sets, RIR, rest, rep range, alternates, swap.
  await openSlot(page, slotA.id);
  const sets = slotA.prescriptionsByCycle[0].sets;
  await step(page, run, { kind: "sets", slotId: slotA.id, count: sets.length + 1 },
    () => page.locator('#reviewSheet [data-review-sets="1"]').click(), "a set added in the sheet");
  const rirDir = sets[0].rir >= 4 ? -1 : 1;
  await step(page, run, { kind: "rir", slotId: slotA.id, setIndex: 1, rir: sets[0].rir + rirDir },
    () => page.locator(`#reviewSheet [data-review-rir="1:${rirDir}"]`).click(), "RIR changed on set 1");
  const rest = sets[0].restSeconds === 90 ? 150 : 90;
  await step(page, run, { kind: "rest", slotId: slotA.id, seconds: rest },
    () => page.locator(`#reviewSheet [data-review-rest="${rest}"]`).click(), "rest changed");
  const range = sets[0].targets.reps || sets[0].targets.repsPerSide;
  await step(page, run, { kind: "rep_range", slotId: slotA.id, min: range.min, max: range.max + 1 },
    () => page.locator('#reviewSheet [data-review-max="1"]').click(), "the rep range widened");
  const minutes = await page.locator("#reviewSheet [data-review-day-time]").innerText();
  check(/→/.test(minutes), "review: the sheet shows the day's time moving with the edits", minutes);
  const alternate = await page.locator("#reviewSheet [data-review-alt-add]").first().getAttribute("data-review-alt-add");
  await step(page, run, { kind: "alternates", slotId: slotA.id, alternates: [alternate] },
    () => page.locator(`#reviewSheet [data-review-alt-add="${alternate}"]`).click(), "an in-session alternate added");
  const candidate = await page.locator("#reviewSheet [data-review-swap]").first().getAttribute("data-review-swap");
  check(Compiler.findSubstitutions(run.expected, slotA.id, {}, Catalog).some((item) => item.exerciseId === candidate),
    "review: the swap list is the engine's substitutions");
  await step(page, run, { kind: "swap", slotId: slotA.id, exerciseId: candidate },
    () => page.locator(`#reviewSheet [data-review-swap="${candidate}"]`).click(), "swapped for an engine candidate");
  await closeSheet(page);
  check(await page.locator(`#entryReview [data-review-slot="${slotA.id}"] [data-review-mark]`).count() === 1,
    "review: the adjusted row carries its mark");

  // Swap through the catalog search, from the sheet.
  await openSlot(page, slotB.id);
  await page.locator("#reviewSheet [data-review-search]").click();
  const searched = await pickFromCatalog(page, "curl");
  await step(page, run, { kind: "swap", slotId: slotB.id, exerciseId: searched }, async () => {}, "swapped for a catalog search pick");

  // Move to another day; remove and undo from the toast.
  await openSlot(page, slotB.id);
  await step(page, run, { kind: "move", slotId: slotB.id, toDayId: dayB.id },
    () => page.locator(`#reviewSheet [data-review-move-to="${dayB.id}"]`).click(), "moved to another day");
  await openSlot(page, slotC.id);
  await step(page, run, { kind: "remove", slotId: slotC.id },
    () => page.locator("#reviewSheet [data-review-remove]").click(), "removed");
  await page.waitForSelector("[data-review-toast-undo]", { timeout: 5000 });
  run.log.pop();
  await step(page, run, null, () => page.locator("[data-review-toast-undo]").click(), "the toast's Desfazer brings it back");

  // Per day: add from the catalog, rename, reorder.
  await page.locator(`#entryReview [data-review-tab="${run.baseline.days.indexOf(dayA)}"]`).click();
  await page.locator("#entryReview [data-review-add]").click();
  const added = await pickFromCatalog(page, "press");
  await step(page, run, { kind: "add", dayId: dayA.id, exerciseId: added }, async () => {}, "an exercise added from the catalog");
  await page.locator("#entryReview [data-review-day-name]").click();
  await page.fill("#reviewRenameInput", "Peito e costas");
  await step(page, run, { kind: "day_name", dayId: dayA.id, name: "Peito e costas" },
    () => page.locator("#reviewSheet [data-review-rename-save]").click(), "the day renamed");
  check((await page.locator(`#entryReview [data-review-tab="${run.baseline.days.indexOf(dayA)}"]`).innerText()).includes("Peito e costas"),
    "review: the tab shows the new day name");
  await page.locator("#entryReview [data-review-day-menu]").click();
  await page.locator('#reviewSheet [data-review-day-action="reorder"]').click();
  const order = run.expected.days.find((day) => day.id === dayA.id).slots.map((slot) => slot.id);
  const reordered = [order[1], order[0], ...order.slice(2)];
  await step(page, run, { kind: "reorder", dayId: dayA.id, slotIds: reordered },
    () => page.locator(`#entryReview [data-review-reorder-move="${order[0]}:1"]`).click(), "reordered with the arrows");
  await page.locator("#entryReview [data-review-reorder-done]").click();

  // The changes bar: undo the last change, then make it again.
  const count = await page.locator("#entryReview [data-review-count]").innerText();
  check(/\d/.test(count), "review: the changes bar counts the adjustments", count);
  run.log.pop();
  await step(page, run, null, () => page.locator("#entryReview [data-review-undo]").click(), "Desfazer in the changes bar undoes the reorder");
  await page.locator("#entryReview [data-review-day-menu]").click();
  await page.locator('#reviewSheet [data-review-day-action="reorder"]').click();
  await step(page, run, { kind: "reorder", dayId: dayA.id, slotIds: reordered },
    () => page.locator(`#entryReview [data-review-reorder-move="${order[0]}:1"]`).click(), "reordered again");
  await page.locator("#entryReview [data-review-reorder-done]").click();

  // A reload keeps the edits and the undo history.
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await resumeReview(page);
  check(JSON.stringify(await reviewed(page)) === JSON.stringify(run.expected), "review: a reload keeps every adjustment");
  check(JSON.stringify((await reviewLog(page))?.edits) === JSON.stringify(run.log), "review: a reload keeps the edit log");
  run.log.pop();
  await step(page, run, null, () => page.locator("#entryReview [data-review-undo]").click(), "Desfazer still works after a reload");
  await page.locator("#entryReview [data-review-day-menu]").click();
  await page.locator('#reviewSheet [data-review-day-action="reorder"]').click();
  await step(page, run, { kind: "reorder", dayId: dayA.id, slotIds: reordered },
    () => page.locator(`#entryReview [data-review-reorder-move="${order[0]}:1"]`).click(), "reordered once more");
  await page.locator("#entryReview [data-review-reorder-done]").click();

  // Activate commits the edited definition.
  const edited = run.expected;
  await page.click("#entryActivate");
  await page.waitForFunction(() => window.__repforgeWorkoutDraft.state()?.programMeta?.onboarded === true, undefined, { timeout: 20000 });
  await page.evaluate(() => window.__repforgeStorage?.flush?.());
  check(JSON.stringify((await state(page)).programMeta.programDefinition) === JSON.stringify(edited),
    "review: activation stores the edited definition");
  check(await page.evaluate(() => sessionStorage.getItem("repforge_entry_review_v1")) === null, "review: activation clears the edit log");
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  check(JSON.stringify((await state(page)).programMeta.programDefinition) === JSON.stringify(edited),
    "review: the edited program survives a reload");

  // The first workout of the renamed day starts with the edited prescriptions.
  await page.evaluate(() => window.__repforgeEnterWorkout?.({ day: "Peito e costas" }));
  await page.waitForSelector("#workout .exercise", { timeout: 10000 });
  const editedSlot = slotsOf(edited).find((slot) => slot.id === slotA.id);
  const planned = await page.evaluate((slotId) => {
    const draft = window.__repforgeWorkoutDraft.current();
    const exercise = Object.values(draft?.exercises || {}).find((item) => item.sourceExerciseId === slotId || item.exerciseInstanceId === slotId);
    if (!exercise) return { missing: Object.values(draft?.exercises || {}).map((item) => item.sourceExerciseId) };
    const working = exercise.setOrder.map((id) => exercise.sets[id]).filter((set) => set.role === "working");
    return { sets: working.length, prescriptions: working.map((set) => ({ targets: set.programmed.targets, rir: set.programmed.targetRir, restSeconds: set.programmed.restSeconds })) };
  }, slotA.id);
  const cycle = editedSlot.prescriptionsByCycle[0];
  check(planned?.sets === cycle.sets.length, "review: the workout has the edited set count", planned);
  check(JSON.stringify(planned?.prescriptions) === JSON.stringify(cycle.sets.map((set) => ({ targets: set.targets, rir: set.rir, restSeconds: set.restSeconds }))),
    "review: the workout's sets carry the edited reps, RIR and rest", { planned, cycle: cycle.sets });
  await run.context.close();
  return run.errors;
}

/** Restore asks first and returns to the recommendation; an emptied day
 *  blocks Activate with its reason; a draft saved at the retired preview step
 *  resumes on the result screen. */
async function reviewGuards(browser) {
  const run = await fresh(browser);
  const { page } = run;
  await answerGenerate(page);
  await page.waitForSelector("#entryReview [data-review-slot]", { timeout: 15000 });
  run.baseline = await reviewed(page);
  run.log = [];
  const [dayA] = trainingDays(run.baseline);
  await openSlot(page, dayA.slots[0].id);
  await step(page, run, { kind: "sets", slotId: dayA.slots[0].id, count: dayA.slots[0].prescriptionsByCycle[0].sets.length + 1 },
    () => page.locator('#reviewSheet [data-review-sets="1"]').click(), "one adjustment before Restore");
  await closeSheet(page);
  await page.locator("#entryReview [data-review-restore]").click();
  await page.waitForSelector("#reviewConfirmGo", { timeout: 5000 });
  run.log = [];
  await step(page, run, null, () => page.locator("#reviewConfirmGo").click(), "Restaurar returns to the recommendation");
  check(!await page.locator("#entryReview [data-review-changes]").count(), "review: no changes bar once restored");

  for (const slot of dayA.slots) {
    await openSlot(page, slot.id);
    await step(page, run, { kind: "remove", slotId: slot.id }, () => page.locator("#reviewSheet [data-review-remove]").click(), "a slot removed");
  }
  check(await page.locator("#entryReview [data-review-empty]").isVisible(), "review: the emptied day says so");
  check(await page.locator("#entryActivate").isDisabled(), "review: an empty training day disables Activate");
  check((await page.locator("#entryActivationStatus").innerText()).trim().length > 0, "review: the blocked Activate says why");

  // A draft saved at the retired preview step resumes on the result screen.
  await page.evaluate(() => {
    const key = "repforge_program_setup_draft_v1";
    const raw = JSON.parse(localStorage.getItem(key));
    raw.state.step = "preview";
    localStorage.setItem(key, JSON.stringify(raw));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await resumeReview(page).catch(() => {});
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "result", undefined, { timeout: 10000 })
    .then(() => check(true, "review: a draft saved at preview resumes on the result screen"),
      () => check(false, "review: a draft saved at preview resumes on the result screen"));
  await run.context.close();
  return run.errors;
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

    allErrors.push(await reviewAndAdjust(browser));
    allErrors.push(await reviewGuards(browser));
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
