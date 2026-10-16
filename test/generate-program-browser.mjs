#!/usr/bin/env node
/**
 * Plan 067 slice 2: Generate through the production entry UI.
 *
 * A fresh device answers the Generate questions, reviews the generated
 * program, and activates it; the stored ProgramDefinition is exactly the
 * canonical generator output for the mapped request, and
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
 *
 * #353: both journeys generate through the program engine's worker.
 *
 * Plan 072 S2: onboarding B's screens. The hub chooses Recommend, then the
 * section map, the six Basics, gym and equipment, and the program screens lead
 * to the review. Every answer reaches the request, every optional screen's
 * Skip or default reproduces the request without it, the Basics never reach
 * the request, a setup link or telemetry, and activation keeps them on the
 * device as the profile: weight stands in for bodyweight and its unit becomes
 * the app's. A draft saved on a retired screen resumes on the screen that now
 * asks its question.
 */
import { createRequire } from "node:module";
import { answerRecommend, launchChromium, waitForAppBoot } from "./browser.mjs";

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

async function fresh(browser, { uuid, hasTouch = false, reducedMotion, withoutMotion = false, withoutWorker = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch,
    ...(reducedMotion ? { reducedMotion } : {}) });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  if (withoutMotion) await page.route("**/motion-layer.js*", (route) => route.abort());
  if (withoutWorker) await page.addInitScript(() => { window.Worker = undefined; });
  // Fix draft identity where a scenario needs a reproducible setup fixture.
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

/** Observe a real entry action until its pushed page has settled. The outgoing
 *  heading remains in the static, hidden copy while the new page is moving. */
async function entryPageTransition(page, control) {
  return page.evaluate((selector) => {
    const body = document.querySelector("#onbBody");
    const beforeHeading = body?.querySelector("#entryHeading");
    const beforeText = beforeHeading?.textContent.trim() || "";
    const beforeStep = window.__repforgeEntryState?.()?.step;
    const samples = [];
    return new Promise((resolve) => {
      const sample = () => {
        const live = body?.querySelector("#entryHeading");
        const headings = [...(body?.querySelectorAll("h1,h2") || [])];
        const outgoing = headings.find((heading) => heading !== live && heading.textContent.trim() === beforeText);
        const pages = [...(body?.querySelectorAll(".entry-motion-page") || [])];
        const state = window.__repforgeEntryState?.();
        const moving = pages.some((node) => node.classList.contains("is-push-over") || node.classList.contains("is-edge-swiping"));
        const exposed = (node) => !node.closest("[aria-hidden='true'],[inert]");
        const exposedHeadings = headings.filter(exposed).length;
        const ids = [body, ...(body?.querySelectorAll("[id]") || [])].filter(exposed).map((node) => node.id).filter(Boolean);
        samples.push({
          t: performance.now(), step: state?.step, currentText: live?.textContent.trim() || "",
          currentX: live?.getBoundingClientRect().x ?? null, outgoingX: outgoing?.getBoundingClientRect().x ?? null,
          outgoingHidden: !!outgoing?.closest("[aria-hidden='true']"), outgoingInert: !!outgoing?.closest("[inert]"),
          outgoingVisible: !!outgoing && getComputedStyle(outgoing).display !== "none" && getComputedStyle(outgoing).visibility !== "hidden",
          exposedHeadings, idsUnique: new Set(ids).size === ids.length, moving,
        });
        if (state?.step !== beforeStep && !moving && samples.length > 1) {
          resolve({ beforeText, beforeStep, samples, finalTransform: pages.some((node) => !!node.style.transform),
            leftover: pages.filter((node) => node.classList.contains("is-push-over") || node.classList.contains("is-edge-swiping")).length });
          return;
        }
        requestAnimationFrame(sample);
      };
      document.querySelector(selector)?.click();
      requestAnimationFrame(sample);
    });
  }, control);
}

function checkEntryPagePush(run, direction, label) {
  const layered = run.samples.filter((sample) => sample.outgoingX != null && sample.currentX != null);
  const start = direction === "in" ? layered[0]?.currentX : layered[0]?.outgoingX;
  const end = direction === "in" ? layered.at(-1)?.currentX : layered.at(-1)?.outgoingX;
  const xs = layered.map((sample) => direction === "in" ? sample.currentX : sample.outgoingX);
  const monotone = xs.every((value, index) => index === 0 ||
    (direction === "in" ? value <= xs[index - 1] + 0.6 : value >= xs[index - 1] - 0.6));
  check(layered.length >= 5 && start != null && end != null &&
    (direction === "in" ? start > end + 120 : end > start + 120) && monotone,
    `${label}: B's page uses navPush ${direction === "in" ? "into" : "back to"} the next screen`,
    { frames: layered.length, start, end, xs: xs.slice(0, 8), steps: [run.beforeStep, run.samples.at(-1)?.step] });
  check(layered.some((sample) => sample.outgoingHidden && sample.outgoingInert && sample.outgoingVisible) &&
    layered.every((sample) => sample.exposedHeadings === 1 && sample.idsUnique),
    `${label}: the outgoing copy stays visible but inert, with one live heading and no duplicate live IDs`,
    layered.map(({ outgoingHidden, outgoingInert, exposedHeadings, idsUnique }) =>
      ({ outgoingHidden, outgoingInert, exposedHeadings, idsUnique })));
  check(run.leftover === 0 && !run.finalTransform,
    `${label}: the pushed screen settles without a transform or gesture layer`,
    { leftover: run.leftover, finalTransform: run.finalTransform });
}

async function pick(page, key, value) {
  await page.locator(`[data-entry-pick="${key}"][data-entry-val="${value}"]`).first().click();
}

async function answerGenerate(page, { days = 4, minutes = 60, environment = "commercial_gym", abilities = null, ...rest } = {}) {
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await answerRecommend(page, { days, minutes, environment, abilities, skipBasics: true, ...rest });
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

  // #353: after the reload the recommendation was regenerated off the main thread.
  const engineRuns = await page.evaluate(() => window.__repforgeProgramEngine?.stats());
  check(engineRuns?.mode === "worker" && engineRuns.worker >= 1 && engineRuns.main === 0,
    "review: the resumed review's recommendation is regenerated in the worker", engineRuns);

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
  // An answer that rebuilds the program asks first; keeping the adjustments
  // leaves them and the answer as they were.
  await page.click('[data-entry-chip="days"]');
  await page.waitForSelector("#entryEditor", { timeout: 10000 });
  await page.locator('#entryEditor [data-entry-pick="daysPerWeek"][data-entry-val="3"]').click();
  await page.click("#entryChipApply");
  const asked = await page.waitForSelector("#reviewConfirmKeep", { timeout: 5000 }).then(() => true, () => false);
  check(asked, "review: a rebuild asks before discarding adjustments");
  if (asked) await page.click("#reviewConfirmKeep");
  check(JSON.stringify(await reviewed(page)) === JSON.stringify(run.expected) &&
    (await entry(page)).answers.daysPerWeek === 4, "review: keeping the adjustments leaves the program and the answer");
  if (await page.locator("#entryChipKeep").count()) await page.click("#entryChipKeep");
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
  check(text.includes("These answers don't make a program. Adjust the equipment or the schedule.")
    && !await run.page.locator("#entryActivate").count(),
    "two full-body days in up to 20 minutes show the time conflict and offer no program", text);
  check(!(await state(run.page)).programMeta.programDefinition, "a conflicting request writes no program");
  await run.context.close();
  return run.errors;
}

// Plan 072 S2: onboarding B -------------------------------------------------
const BASICS_ANSWERS = {
  sex: "female", birth: { yearIndex: 1990 - 1920, monthIndex: 2, dayIndex: 9 }, heightCm: 180, weightSteps: 25,
  lifting: "over_24m", cardio: "1_to_4y", environment: "limited_home", equipment: ["bench", "kettlebells"], goal: "strength",
  days: 3, minutes: 90, priorities: { glutes: "prioritize", calves: "reduce" }, deload: true, abilities: { benchPress10: "yes", pullups10: "yes" },
};

async function onboardingB(browser) {
  const run = await fresh(browser);
  const { page } = run;
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  check(await page.locator("[data-entry-hub]").count() === 3 && await page.locator("#onbNext").isDisabled(),
    "B's hub offers Recommend, Build and Import, and Continue waits for a choice");
  await answerRecommend(page, { until: "sex" });
  const header = await page.evaluate(() => ({ eyebrow: document.querySelector("#onbEyebrow")?.textContent,
    step: document.querySelector("#onbStepLabel")?.textContent, segments: document.querySelectorAll("#onbSegbar .segbar__seg").length,
    skip: !document.querySelector("#onbSkip")?.hidden, blocked: document.querySelector("#onbNext")?.disabled }));
  check(header.eyebrow === "Basics" && header.step === "Section 1 of 3" && header.segments === 3 && header.skip && header.blocked,
    "a Basics screen names its section, counts three sections, offers Skip and holds Continue until a choice", header);
  await answerRecommend(page, BASICS_ANSWERS);
  await page.locator("#entryActivate").waitFor({ state: "visible", timeout: 20000 });
  const staged = await entry(page);
  check(JSON.stringify(staged.answers.basics) === JSON.stringify({
    sex: "female", birthDate: "1990-03-10", heightCm: 180, heightUnit: "cm", weightKg: 83, weightUnit: "kg", cardioExperience: "1_to_4y",
  }), "every Basics screen stores what the lifter set, and only that", staged.answers.basics);
  const request = staged.result?.preview?.programDefinition?.request;
  const mapped = Adapter.programRequestFromAnswers(staged.answers, Catalog);
  check(mapped.ok && JSON.stringify(request?.gymProfile) === JSON.stringify(mapped.value.gymProfile),
    "the equipment the lifter adjusted is the request's equipment");
  const groups = Adapter.EQUIPMENT_GROUPS;
  check(groups.bench.every((id) => request.gymProfile.equipmentIds.includes(id)) &&
    groups.kettlebells.every((id) => !request.gymProfile.equipmentIds.includes(id)),
    "ticking the bench adds it and unticking the kettlebells removes them from Home");
  check(request.goal === "strength" && request.daysPerWeek === 3 && request.timeCeilingMinutes === 90 &&
    request.experience === "advanced" && request.cycles === 8 && JSON.stringify(request.deloadCycles) === "[8]" && request.competencyAnswers.benchPress10 === true &&
    request.emphasisMuscleIds.length === 1 && request.deprioritizedMuscleIds.length === 1,
  "goal, days, session length, experience, deload, abilities and both muscle priorities reach the request", request);
  check(staged.answers.competencyAnswers?.pullups10 === true && staged.answers.competencyAnswers?.pullups5 === true &&
    request.competencyAnswers.pullups5 === true, "a yes to ten strict pull-ups also answers five", staged.answers.competencyAnswers);
  const definitionText = JSON.stringify(staged.result.preview.programDefinition);
  check(!/1990-03-10|"female"|1_to_4y|basics|birthDate|heightCm|weightKg/.test(definitionText),
    "no Basics answer reaches the program definition a setup link carries");
  await page.click("#entryActivate");
  await page.waitForFunction(() => window.__repforgeWorkoutDraft.state()?.programMeta?.onboarded === true, undefined, { timeout: 20000 });
  await page.evaluate(() => window.__repforgeStorage?.flush?.());
  const active = await state(page);
  check(JSON.stringify(active.profile) === JSON.stringify({
    sex: "female", birthDate: "1990-03-10", heightCm: 180, heightUnit: "cm", weightKg: 83, cardioExperience: "1_to_4y",
  }) && active.settings.unit === "kg", "activation keeps the Basics on this device as the profile", active.profile);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  check(JSON.stringify((await state(page)).profile?.birthDate) === '"1990-03-10"', "the profile survives a reload");
  await page.evaluate(() => window.__repforgeShowSettings?.());
  await page.waitForSelector("#profileRow:not([hidden])", { timeout: 10000 });
  await page.click("#profileRow");
  const listed = await page.locator("#profileList .settings-profile__row").count();
  check(listed === 5, "Settings lists the five answers kept about the lifter", listed);
  page.once("dialog", (dialog) => dialog.accept());
  await page.click("#profileClear");
  await page.waitForFunction(() => !window.__repforgeWorkoutDraft.state()?.profile, undefined, { timeout: 10000 });
  check(await page.locator("#profileRow").isHidden(), "deleting the answers removes them and the Settings row");
  await run.context.close();
  return run.errors;
}

async function onboardingBNavigation(browser) {
  const run = await fresh(browser, { hasTouch: true });
  const { page } = run;
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await page.click('[data-entry-hub="recommend"]');
  const forward = await entryPageTransition(page, "#onbNext");
  check(forward.samples.at(-1)?.step === "intro", "the Recommend choice reaches the first B screen");
  checkEntryPagePush(forward, "in", "the hub Continue action");

  const back = await entryPageTransition(page, "#onbBack");
  check(back.samples.at(-1)?.step === "entry", "Back from the first B screen returns to the hub");
  checkEntryPagePush(back, "out", "the first screen's Back action");

  await page.evaluate(() => {
    const nativeMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => /display-mode:\s*standalone/.test(query)
      ? { matches: true, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
      : nativeMatchMedia(query);
  });
  await page.click('[data-entry-hub="recommend"]');
  const toIntro = await entryPageTransition(page, "#onbNext");
  checkEntryPagePush(toIntro, "in", "the hub Continue action before edge-swipe Back");
  const introText = toIntro.samples.at(-1)?.currentText || "";
  const toSex = await entryPageTransition(page, "#onbNext");
  check(toSex.samples.at(-1)?.step === "sex", "Continue from the B intro reaches the first Basics screen");
  checkEntryPagePush(toSex, "in", "Continue from the B intro");
  const livePage = page.locator("#onbBody > .entry-motion-page:not([aria-hidden='true'])");
  const liveBox = await livePage.boundingBox();
  const edgeTouchAction = await page.locator("#onboarding").evaluate((element) => getComputedStyle(element).touchAction);
  const cdp = await run.context.newCDPSession(page);
  const edgeY = Math.round(liveBox.y + 40);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 4, y: edgeY }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 244, y: edgeY }] });
  await page.waitForFunction(() => !!document.querySelector("#onbBody .entry-motion-page.is-edge-swiping"), undefined,
    { timeout: 5000 });
  const swipe = await page.evaluate((expectedUnderText) => {
    const body = document.querySelector("#onbBody");
    const current = body?.querySelector(".entry-motion-page:not([aria-hidden='true'])");
    const rect = current?.getBoundingClientRect();
    if (!current || !rect) return { registeredPage: false };
    const outgoing = [...(body?.querySelectorAll("h1,h2") || [])]
      .find((heading) => heading !== body.querySelector("#entryHeading") && heading.textContent.trim() === expectedUnderText);
    const exposed = (node) => !node.closest("[aria-hidden='true'],[inert]");
    const exposedHeadings = [...(body?.querySelectorAll("h1,h2") || [])].filter(exposed).length;
    const ids = [body, ...(body?.querySelectorAll("[id]") || [])].filter(exposed).map((node) => node.id).filter(Boolean);
    const transform = new DOMMatrixReadOnly(getComputedStyle(current).transform).m41;
    const live = current.classList.contains("is-edge-swiping");
    const underEvidence = outgoing && {
      text: outgoing.textContent.trim(), hidden: !!outgoing.closest("[aria-hidden='true']"),
      inert: !!outgoing.closest("[inert]"), display: getComputedStyle(outgoing).display,
      visible: getComputedStyle(outgoing).visibility, expectedUnderText,
    };
    const under = !!underEvidence && underEvidence.hidden && underEvidence.inert &&
      underEvidence.display !== "none" && underEvidence.text === expectedUnderText;
    return { registeredPage: true, live, transform, under, underEvidence, headingTexts: [...(body?.querySelectorAll("h1,h2") || [])].map((heading) => heading.textContent.trim()),
      snapshots: [...(body?.querySelectorAll(".entry-motion-page") || [])].map((node) => ({ id: node.id, key: node.dataset.entryMotionKey, copy: node.dataset.entryMotionCopy, classes: node.className })),
      previousStep: window.__repforgeEntryState?.()?.step, exposedHeadings, idsUnique: new Set(ids).size === ids.length };
  }, introText);
  swipe.shellTouchAction = edgeTouchAction;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const swipedBack = await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "intro", undefined,
    { timeout: 5000 }).then(() => true, () => false);
  check(swipe.registeredPage && swipe.live && swipe.transform >= 120 && swipe.under &&
    swipe.exposedHeadings === 1 && swipe.idsUnique && swipe.shellTouchAction.includes("pan-y"),
    "standalone edge swipe reveals the inert previous screen without exposing duplicate live controls", swipe);
  check(swipedBack, "the committed edge swipe uses Back and returns to the prior question");
  const settled = await page.evaluate(() => ({
    state: window.__repforgeEntryState?.()?.step,
    layers: document.querySelectorAll("#onbBody .is-push-over,#onbBody .is-edge-swiping").length,
    transformed: [...document.querySelectorAll("#onbBody .entry-motion-page")].some((node) => !!node.style.transform),
    exposedHeadings: [...document.querySelectorAll("#onbBody h1,#onbBody h2")]
      .filter((heading) => !heading.closest("[aria-hidden='true'],[inert]")).length,
  }));
  check(settled.state === "intro" && settled.layers === 0 && !settled.transformed && settled.exposedHeadings === 1,
    "the edge-swipe Back path settles the prior question cleanly", settled);
  await answerRecommend(page, { skipBasics: true, until: "weight" });
  await page.waitForFunction(() => !document.querySelector("#onbBody .is-push-over"), undefined, { timeout: 5000 });
  const ruler = page.locator("#entryWeightRuler");
  const rulerBox = await ruler.boundingBox();
  const rulerBefore = await ruler.evaluate((element) => element.scrollLeft);
  const rulerX = Math.round(rulerBox.x + 200), rulerY = Math.round(rulerBox.y + 35);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: rulerX, y: rulerY }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: rulerX - 70, y: rulerY }] });
  await page.waitForFunction((before) => document.querySelector("#entryWeightRuler")?.scrollLeft !== before,
    rulerBefore, { timeout: 5000 });
  const rulerAfter = await ruler.evaluate((element) => element.scrollLeft);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  check(rulerAfter !== rulerBefore,
    "the standalone edge-swipe pan policy preserves native horizontal weight-ruler scrolling",
    { before: rulerBefore, after: rulerAfter });
  await cdp.detach();
  check(run.errors.length === 0, "no page errors in B's push and edge-swipe run", run.errors);
  await run.context.close();

  const reduced = await fresh(browser, { reducedMotion: "reduce" });
  await reduced.page.click("#firstRunCreate");
  await reduced.page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await reduced.page.click('[data-entry-hub="recommend"]');
  const reducedPush = await entryPageTransition(reduced.page, "#onbNext");
  check(reducedPush.samples.at(-1)?.step === "intro" && reducedPush.leftover === 0 && !reducedPush.finalTransform &&
    reducedPush.samples.every((sample) => !sample.moving),
    "reduced motion advances to B's screen at rest without a push layer", reducedPush);
  await reduced.page.click("#onbBack");
  await reduced.page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "entry", undefined, { timeout: 5000 });
  check(await reduced.page.locator("#entryHeading").isVisible(), "reduced-motion Back remains available at the hub");
  check(reduced.errors.length === 0, "no page errors in B's reduced-motion navigation", reduced.errors);
  await reduced.context.close();

  const fallback = await fresh(browser, { withoutMotion: true });
  await fallback.page.click("#firstRunCreate");
  await fallback.page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await fallback.page.click('[data-entry-hub="recommend"]');
  const fallbackPush = await entryPageTransition(fallback.page, "#onbNext");
  check(fallbackPush.samples.at(-1)?.step === "intro" && fallbackPush.leftover === 0 && !fallbackPush.finalTransform &&
    fallbackPush.samples.every((sample) => !sample.moving),
    "without the optional Motion layer, B still reaches its question screen cleanly", fallbackPush);
  await fallback.page.click("#onbBack");
  await fallback.page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "entry", undefined, { timeout: 5000 });
  check(await fallback.page.locator("#entryHeading").isVisible(), "the no-Motion fallback keeps Back usable");
  check(fallback.errors.length === 0, "no page errors in B's no-Motion navigation", fallback.errors);
  await fallback.context.close();
  return [...reduced.errors, ...fallback.errors];
}

async function onboardingPounds(browser) {
  const run = await fresh(browser);
  const { page } = run;
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await answerRecommend(page, { skipBasics: true, until: "weight" });
  await page.click('[data-entry-pick="basicsWeightUnit"][data-entry-val="lb"]');
  await page.focus("#entryWeightRuler");
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  const shown = await page.locator("#entryWeightRuler").getAttribute("aria-valuenow");
  await page.click("#onbNext");
  await answerRecommend(page, { skipBasics: true });
  await page.locator("#entryActivate").waitFor({ state: "visible", timeout: 20000 });
  await page.click("#entryActivate");
  await page.waitForFunction(() => window.__repforgeWorkoutDraft.state()?.programMeta?.onboarded === true, undefined, { timeout: 20000 });
  const active = await state(page);
  check(active.settings.unit === "lb" && Math.abs(active.profile.weightKg - Number(shown) * 0.45359237) < 0.06 && !active.profile.weightUnit,
    "a weight set in pounds becomes the app's unit and is kept in kilograms", { unit: active.settings.unit, shown, profile: active.profile });
  await run.context.close();
  return run.errors;
}

async function onboardingResume(browser) {
  const run = await fresh(browser);
  const { page } = run;
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await answerRecommend(page, { skipBasics: true, until: "session_length" });
  // A draft saved by the release before B, on the screen that asked days and
  // minutes together.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("repforge_program_setup_draft_v1"));
    raw.state.step = "schedule";
    localStorage.setItem("repforge_program_setup_draft_v1", JSON.stringify(raw));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  const onboarding = page.locator("#onboarding.active");
  if (!await onboarding.count()) await page.click("#firstRunCreate").catch(() => {});
  const resume = page.locator("#entryResumeContinue");
  if (await resume.count()) await resume.click();
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "days_per_week", undefined, { timeout: 10000 });
  check((await entry(page)).answers.environment?.kind === "commercial_gym",
    "a draft saved on the retired schedule screen resumes on the days screen with its answers");
  await run.context.close();

  const everyScreen = await fresh(browser);
  const resumePage = everyScreen.page;
  await resumePage.click("#firstRunCreate");
  await resumePage.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  const routeSteps = await resumePage.evaluate(() => window.RepForgeProgramEntry.ROUTE_STEPS.recommend);
  await answerRecommend(resumePage, { skipBasics: true, until: routeSteps[0] });
  for (let index = 0; index < routeSteps.length; index++) {
    const expected = routeSteps[index];
    check((await entry(resumePage)).step === expected, `resume journey reaches ${expected} before reload`);
    await resumePage.waitForFunction((step) => {
      const saved = JSON.parse(localStorage.getItem("repforge_program_setup_draft_v1") || "null")?.state;
      return saved?.step === step && (step !== "result" || !!saved.result?.preview?.programDefinition);
    }, expected, { timeout: 10000 });
    if (expected === "result") await resumePage.waitForSelector("#entryReview [data-review-slot]", { timeout: 15000 });
    await resumePage.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(resumePage, { base: BASE });
    if (!await resumePage.locator("#onboarding.active").count()) await resumePage.click("#firstRunCreate");
    await resumePage.waitForSelector("#onboarding.active #entryResumeContinue", { timeout: 10000 });
    await resumePage.click("#entryResumeContinue");
    const restored = await resumePage.waitForFunction((step) => window.__repforgeEntryState?.()?.step === step &&
      !document.querySelector("#entryResumeContinue") && (step === "result"
        ? !!document.querySelector("#entryReview [data-review-slot]")
        : !!document.querySelector("#onbBody #entryHeading")), expected, { timeout: 15000 }).then(() => true, () => false);
    check(restored, `reloading on ${expected} resumes that B screen`);
    if (index + 1 < routeSteps.length) {
      await answerRecommend(resumePage, { skipBasics: true, until: routeSteps[index + 1] });
      await resumePage.waitForFunction(() => !document.querySelector("#onbBody .is-push-over"), undefined,
        { timeout: 5000 });
    }
  }
  check(await resumePage.locator("#entryReview [data-review-slot]").count() > 0,
    "reloading on result resumes the generated review");
  await everyScreen.context.close();
  return [...run.errors, ...everyScreen.errors];
}

// Plan 072 S3: the building moment and the conflict ------------------------
/** Hold real program-worker Generate messages until the page releases them. */
async function holdGeneration(page) {
  await page.evaluate(() => {
    const NativeWorker = window.Worker;
    window.__heldGenerations = [];
    window.Worker = class extends NativeWorker {
      postMessage(message, ...args) {
        if (message?.type === "generate") {
          window.__heldGenerations.push(() => super.postMessage(message, ...args));
          return;
        }
        return super.postMessage(message, ...args);
      }
    };
  });
}
const releaseGeneration = (page) => page.evaluate(() => { const run = window.__heldGenerations.shift(); run?.(); return !!run; });

async function onboardingBuilding(browser) {
  const run = await fresh(browser);
  const { page } = run;
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await answerRecommend(page, { skipBasics: true, until: "abilities" });
  await holdGeneration(page);
  await page.click("#onbNext");
  await page.waitForSelector("#entryBuilding", { timeout: 10000 });
  check((await entry(page)).step === "building" && await page.locator("#entryBuilding .entry-building__steps li").count() === 4,
    "Continue on the last question opens the building moment with its four lines");
  await page.waitForSelector("#entryBuilding.is-done", { timeout: 10000 });
  const waiting = await page.evaluate(() => {
    const wait = document.querySelector("#entryBuildingWait");
    return { hidden: wait?.hidden, pending: wait?.classList.contains("is-pending") };
  });
  check((await entry(page)).step === "building" && waiting.hidden === false && waiting.pending,
    "with the checklist done and the program still generating, the step stays and the hairline says so");
  await page.waitForFunction(() => window.__heldGenerations?.length > 0);
  const pending = await page.evaluate(() => {
    const wait = document.querySelector("#entryBuildingWait");
    return { mode: window.__repforgeProgramEngine?.stats().mode,
      pendingClass: wait?.classList.contains("is-pending"),
      labelClass: !!wait?.querySelector(".motion-hairline__label"),
      animation: getComputedStyle(wait, "::after").animationName };
  });
  check(pending.mode === "worker", "the held generation is an actual program-worker request", pending);
  check(pending.pendingClass && pending.labelClass && pending.animation !== "none",
    "a pending generation owns the shared hairline motion and its reduced-motion label", pending);
  await releaseGeneration(page);
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "result", undefined, { timeout: 15000 });
  await page.locator("#entryActivate").waitFor({ state: "visible", timeout: 15000 });
  check(true, "the result opens once the held program lands");

  // Skip ends the checklist at once but still waits for the program.
  await page.click("#onbBack");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "abilities");
  await page.click("#onbNext");
  await page.waitForSelector("#entryBuildingSkip", { timeout: 10000 });
  await page.click("#entryBuildingSkip");
  const skippedWait = await page.evaluate(() => {
    const wait = document.querySelector("#entryBuildingWait");
    return { hidden: wait?.hidden, pending: wait?.classList.contains("is-pending") };
  });
  check((await entry(page)).step === "building" && skippedWait.hidden === false && skippedWait.pending,
    "skipping the checklist does not skip a program that has not landed");
  await page.waitForFunction(() => window.__heldGenerations?.length > 0);
  await releaseGeneration(page);
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "result", undefined, { timeout: 15000 });
  check(true, "after skipping, the result opens when the program lands");

  // Back from building supersedes the job: its program, when it lands, is dropped.
  await page.click("#onbBack");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "abilities");
  await page.click("#onbNext");
  await page.waitForSelector("#entryBuilding", { timeout: 10000 });
  await page.waitForFunction(() => window.__heldGenerations?.length > 0);
  await page.click("#onbBack");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "abilities");
  const workerBefore = await page.evaluate(() => window.__repforgeProgramEngine?.stats().worker || 0);
  await page.locator('[data-entry-pick="competencyAnswer"][data-entry-val="benchPress10|yes"]').click();
  await page.click("#onbNext");
  await page.waitForSelector("#entryBuilding", { timeout: 10000 });
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "building"
    && window.__repforgeEntryState?.()?.answers?.competencyAnswers?.benchPress10 === true);
  const replacementBusy = await page.locator("#onbNext").getAttribute("aria-busy");
  const changed = await entry(page);
  check(changed.step === "building" && changed.answers.competencyAnswers?.benchPress10 === true && replacementBusy === "true",
    "after Back, changed answers start a replacement generation while the older worker reply is held", { answers: changed.answers.competencyAnswers, replacementBusy });
  await releaseGeneration(page);
  await page.waitForFunction(() => window.__heldGenerations?.length > 0, undefined, { timeout: 15000 });
  await page.waitForFunction((before) => (window.__repforgeProgramEngine?.stats().worker || 0) > before, workerBefore, { timeout: 15000 });
  const afterStale = await entry(page);
  check(afterStale.step === "building" && afterStale.answers.competencyAnswers?.benchPress10 === true,
    "the older worker reply lands after the replacement is underway and cannot leave Building", afterStale.answers.competencyAnswers);
  await releaseGeneration(page);
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "result", undefined, { timeout: 15000 });
  const request = await page.evaluate(() => window.__repforgeEntryState?.()?.result?.preview?.programDefinition?.request);
  check(request?.competencyAnswers?.benchPress10 === true,
    "the stale worker reply cannot replace the result built from changed answers", request?.competencyAnswers);
  await run.context.close();
  return run.errors;
}

async function onboardingBuildingReduced(browser) {
  const run = await fresh(browser);
  const { page } = run;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await answerRecommend(page, { skipBasics: true, until: "abilities" });
  await holdGeneration(page);
  await page.click("#onbNext");
  await page.waitForSelector("#entryBuilding", { timeout: 10000 });
  const drawn = await page.evaluate(() => [...document.querySelectorAll("#entryBuilding .entry-building__steps li")].every((li) => li.classList.contains("is-done")));
  await page.waitForFunction(() => window.__heldGenerations?.length > 0);
  const pending = await page.evaluate(() => {
    const wait = document.querySelector("#entryBuildingWait");
    return { drawn: [...document.querySelectorAll("#entryBuilding .entry-building__steps li")].every((li) => li.classList.contains("is-done")),
      visible: !wait?.hidden, pendingClass: wait?.classList.contains("is-pending"),
      labelClass: !!wait?.querySelector(".motion-hairline__label"),
      animation: getComputedStyle(wait, "::after").animationName,
      labelDisplay: wait?.querySelector(".motion-hairline__label")
        ? getComputedStyle(wait.querySelector(".motion-hairline__label")).display : null };
  });
  check(drawn && pending.visible && pending.pendingClass && pending.labelClass && pending.animation === "none" && pending.labelDisplay !== "none",
    "reduced motion draws all lines at rest and exposes the pending label without a hairline sweep", pending);
  await page.waitForFunction(() => window.__heldGenerations?.length > 0);
  await releaseGeneration(page);
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "result", undefined, { timeout: 15000 });
  await run.context.close();
  return run.errors;
}

async function onboardingBuildingMainFallback(browser) {
  const run = await fresh(browser, { withoutWorker: true });
  const { page } = run;
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await answerRecommend(page, { skipBasics: true, until: "abilities" });
  const started = await page.evaluate(() => performance.now());
  await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "result", undefined, { timeout: 15000 });
  const outcome = await page.evaluate((before) => ({ elapsed: performance.now() - before,
    stats: window.__repforgeProgramEngine?.stats() }), started);
  check(outcome.stats?.mode === "main" && outcome.stats.main > 0,
    "without Worker, generation settles through the production main-thread fallback", outcome.stats);
  check(outcome.elapsed >= 980, "the main-thread fallback still waits for the building checklist", String(Math.round(outcome.elapsed)));
  await run.context.close();
  return run.errors;
}

async function onboardingConflict(browser) {
  const run = await fresh(browser);
  const { page } = run;
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await answerRecommend(page, { skipBasics: true, environment: "limited_home", equipment: ["pullup_bar", "bands"], until: "abilities" });
  await page.click("#onbNext");
  const notice = page.locator("#onbBody .entry__notice[role=alert]");
  await notice.waitFor({ state: "visible", timeout: 15000 });
  const text = await notice.innerText();
  check(/Without this equipment, nothing in the catalog can train: .*vertical pull/i.test(text) && /Nothing was saved/.test(text),
    "Home without the pull-up bar and bands names the vertical pull it cannot train", text);
  check(!(await state(page)).programMeta.onboarded && !(await page.locator("#entryActivate").count()), "a conflict activates nothing");
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  if (await page.locator("#firstRunCreate").isVisible().catch(() => false)) await page.click("#firstRunCreate");
  if (await page.locator("#entryResumeContinue").count()) await page.click("#entryResumeContinue");
  await notice.waitFor({ state: "visible", timeout: 15000 });
  check(/nothing in the catalog can train/i.test(await notice.innerText()), "a reload on the conflict shows it again");
  await page.click("[data-entry-action='conflict-back']");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "equipment");
  const env = (await entry(page)).answers.environment;
  check(env.kind === "limited_home" && JSON.stringify(env.adjust?.remove || []) === JSON.stringify(["pullup_bar", "bands"]),
    "Back to equipment keeps the adjustment the lifter made", JSON.stringify(env));
  await run.context.close();
  return run.errors;
}

async function onboardingTimeConflict(browser) {
  const run = await fresh(browser, { uuid: "cause-map" });
  const { page } = run;
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await answerRecommend(page, { skipBasics: true, environment: "everything", days: 2, minutes: 20, until: "abilities" });
  await page.click("#onbNext");
  const notice = page.locator("#onbBody .entry__notice[role=alert]");
  await notice.waitFor({ state: "visible", timeout: 15000 });
  const text = await notice.innerText();
  check(text.includes("These answers don't make a program. Adjust the equipment or the schedule."),
    "a time conflict uses B's approved generic copy", text);
  const back = page.locator("[data-entry-action='conflict-back']");
  check(await back.getAttribute("data-entry-step") === "session_length" && (await back.innerText()).trim() === "Back",
    "a time conflict returns through the existing Back control to session length", {
      step: await back.getAttribute("data-entry-step"), label: (await back.innerText()).trim(),
    });
  await back.click();
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "session_length");
  check((await entry(page)).answers.sessionMinutes === 20,
    "returning from the time conflict preserves the selected session length", (await entry(page)).answers.sessionMinutes);
  await run.context.close();
  return run.errors;
}

/** #275 decision 3: the result's answer editor asks Recommend's questions with
 *  Recommend's options, and the chips read the same labels. A draft from before
 *  the six places can still hold the retired "other" place; it keeps a label. */
async function answerEditorMatchesRecommend(browser) {
  const run = await fresh(browser);
  const { page } = run;
  await answerGenerate(page, { environment: "everything", minutes: 150 });
  await page.waitForSelector("#entryReview [data-review-slot]", { timeout: 15000 });
  const chipText = (chip) => page.locator(`[data-entry-chip="${chip}"] .entry-chip__text`).innerText().then((text) => text.trim());
  check(await chipText("env") === "Gym with everything", "editor: the place chip reads Recommend's label", await chipText("env"));
  check(await chipText("minutes") === "Up to 150 min a session", "editor: 150 minutes reads as Recommend's top value", await chipText("minutes"));
  check(await chipText("exp") === "6 months to 2 years", "editor: the experience chip reads Recommend's option", await chipText("exp"));
  const editor = async (chip) => {
    await page.click(`[data-entry-chip="${chip}"]`);
    await page.waitForSelector("#entryEditor", { timeout: 10000 });
    const read = await page.evaluate(() => ({
      question: document.querySelector("#entryEditor .entry__question")?.textContent.trim() ||
        document.querySelector("#entryEditor [role=radiogroup]")?.getAttribute("aria-label") || "",
      options: [...document.querySelectorAll("#entryEditor .radio-card__title")].map((node) => node.textContent.trim()),
      selected: [...document.querySelectorAll("#entryEditor .radio-card[aria-checked=true] .radio-card__title")].map((node) => node.textContent.trim()) }));
    await page.click("#entryChipKeep");
    await page.waitForSelector("#entryEditor", { state: "detached", timeout: 10000 });
    return read;
  };
  const places = await editor("env");
  check(JSON.stringify(places.options) === JSON.stringify(["Gym with everything", "Commercial gym", "Strength gym", "Local gym", "Home gym", "Home, basic kit"]) &&
    JSON.stringify(places.selected) === JSON.stringify(["Gym with everything"]), "editor: the six places are Recommend's, with the answer selected", places);
  const experience = await editor("exp");
  check(experience.question === "How long have you been lifting?" &&
    JSON.stringify(experience.options) === JSON.stringify(["Not yet", "Less than 6 months", "6 months to 2 years", "More than 2 years"]),
  "editor: the experience question and options are Recommend's", experience);
  const goal = await editor("goal");
  check(goal.question === "What is your goal?" && JSON.stringify(goal.options) === JSON.stringify(["Muscle growth", "Strength", "Muscle and strength"]),
    "editor: the goal question and options are Recommend's", goal);
  const minutes = await editor("minutes");
  check(minutes.options.includes("150") && !minutes.options.includes("120+"), "editor: the top session length is 150, as in Recommend", minutes);

  // A draft saved with the retired "other" place still reads and edits.
  await page.evaluate(() => {
    const key = "repforge_program_setup_draft_v1";
    const raw = JSON.parse(localStorage.getItem(key));
    raw.state.answers.environment = { ...raw.state.answers.environment, kind: "other" };
    // The stored result stays bound to the answers it was built from, as an
    // older release would have written it.
    raw.state.result.answersFingerprint = window.RepForgeProgramEntry.setResult({ ...raw.state, result: null },
      { fingerprint: "probe" }).result.answersFingerprint;
    localStorage.setItem(key, JSON.stringify(raw));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await resumeReview(page);
  check((await entry(page)).answers.environment?.kind === "other", "editor: the old draft keeps its stored place");
  check(await chipText("env") === "Another setup", "editor: the old draft's place chip keeps its label", await chipText("env"));
  const oldPlaces = await editor("env");
  check(oldPlaces.options.length === 6 && oldPlaces.selected.length === 0 && oldPlaces.options.every((label) => !label.startsWith("entry.")),
    "editor: the old draft opens the six places with none selected", oldPlaces);
  await run.context.close();
  return run.errors;
}

/** Plan 073: the recovered domain crosses the real form, worker, activation,
 * Focus and durable reload. Eight reductions deliberately exceed the retired
 * five-muscle cap. Worker unavailability must produce the same definition. */
async function recoveredGenerationJourney(browser) {
  const reductions = ["forearms", "lower_back", "abductors", "adductors", "neck", "upper_traps", "tibs", "obliques"];
  const priorities = Object.fromEntries(reductions.map((muscle) => [muscle, "reduce"]));
  let workerDefinition;
  const errors = [];
  for (const { withoutWorker, minutes, goal, expectedGoal, lifting = "over_24m", expectedExperience = "advanced" } of [
    { withoutWorker: false, minutes: 60, goal: "balanced", expectedGoal: "hybrid" },
    { withoutWorker: true, minutes: 60, goal: "balanced", expectedGoal: "hybrid" },
    { withoutWorker: false, minutes: 20, goal: "balanced", expectedGoal: "hybrid" },
    { withoutWorker: false, minutes: 40, goal: "balanced", expectedGoal: "hybrid" },
    { withoutWorker: false, minutes: 60, goal: "muscle_growth", expectedGoal: "hypertrophy" },
    { withoutWorker: false, minutes: 60, goal: "strength", expectedGoal: "strength" },
    { withoutWorker: false, minutes: 60, goal: "balanced", expectedGoal: "hybrid", lifting: "under_6m", expectedExperience: "beginner" },
    { withoutWorker: false, minutes: 60, goal: "balanced", expectedGoal: "hybrid", lifting: "6_to_24m", expectedExperience: "intermediate" },
  ]) {
    const run = await fresh(browser, { withoutWorker });
    const { page } = run;
    const mode = `${withoutWorker ? "fallback" : "worker"} ${expectedGoal}/${expectedExperience}/${minutes}`;
    const supportsPeriodized = expectedGoal === "hybrid" && expectedExperience === "advanced" && minutes === 60;
    await page.click("#firstRunCreate");
    await answerRecommend(page, { skipBasics: true, days: 3, minutes,
      goal, lifting, deload: false, priorities,
      until: "muscle_priorities" });
    check(await page.locator('#onbBody > .entry-motion-page:not([aria-hidden="true"]) [data-entry-pick="musclePriorityB"][data-entry-val$="|reduce"]').count() === 22,
      `P073 ${mode}: the form exposes all 22 independent muscle reductions`);
    await answerRecommend(page, { priorities, until: "deload" });
    check(JSON.stringify((await entry(page)).answers.deEmphasizedMuscles?.slice().sort()) === JSON.stringify(reductions.slice().sort()),
      `P073 ${mode}: all eight reductions survive the production form`, (await entry(page)).answers.deEmphasizedMuscles);
    await answerRecommend(page, { skipBasics: true, deload: false });
    await page.locator("#entryActivate").waitFor({ state: "visible", timeout: 20000 });
    const staged = await entry(page);
    const mapped = Adapter.programRequestFromAnswers(staged.answers, Catalog);
    check(mapped.ok && mapped.value.deprioritizedMuscleIds.length === 8,
      `P073 ${mode}: the compiler request carries all eight muscle UUIDs`, mapped);
    let definition = staged.result?.preview?.programDefinition;
    const expected = mapped.ok ? Compiler.generateProgram(mapped.value, Catalog) : null;
    check(expected?.ok && JSON.stringify(definition) === JSON.stringify(expected.value),
      `P073 ${mode}: review contains the canonical seedless compiler definition`, expected?.conflicts);
    check(definition?.request?.goal === expectedGoal && definition.request.experience === expectedExperience &&
      definition.request.daysPerWeek === 3 && definition.request.timeCeilingMinutes === minutes &&
      definition.provenance.generationBudgetMinutes === (minutes === 20 ? 18 : minutes === 40 ? 30 : 50) &&
      definition.request.periodization === "static" && definition.cycles === 7 &&
      definition.request.deloadCycles.length === 0 && definition.request.deprioritizedMuscleIds.length === 8,
      `P073 ${mode}: requested goal, option and recovered budget reach Static seven-cycle review`, definition?.request);
    check(trainingDays(definition).length === 3 && definition.provenance?.split === "upper_lower_full",
      `P073 ${mode}: the recovered definition is Upper/Lower/Full`, { split: definition.provenance?.split, days: trainingDays(definition).map((day) => day.name) });
    const stats = await page.evaluate(() => window.__repforgeProgramEngine?.stats());
    check(withoutWorker ? stats?.mode === "main" && stats.main > 0 : stats?.mode === "worker" && stats.worker > 0 && stats.main === 0,
      `P073 ${mode}: the production engine uses the expected execution path`, stats);
    if (withoutWorker) check(JSON.stringify(definition) === JSON.stringify(workerDefinition),
      "P073: worker and fallback produce identical definitions across fresh drafts");
    else if (supportsPeriodized) workerDefinition = definition;
    check(!(await state(page)).programMeta.onboarded && (await state(page)).program.length === 0,
      `P073 ${mode}: review has not activated training state`);
    if (!withoutWorker) {
      await page.evaluate(() => {
        const key = "repforge_program_setup_draft_v1";
        const saved = JSON.parse(localStorage.getItem(key));
        saved.state.versions.compiler = "previous-generator-policy";
        localStorage.setItem(key, JSON.stringify(saved));
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(page, { base: BASE });
      if (!await page.locator("#entryRebuildRules").count()) {
        if (await page.locator("#firstRunCreate").isVisible().catch(() => false)) await page.click("#firstRunCreate");
        if (await page.locator("#entryResumeContinue").count()) await page.click("#entryResumeContinue");
      }
      await page.locator("#entryRebuildRules").waitFor({ state: "visible", timeout: 10000 });
      const pinnedStats = await page.evaluate(() => window.__repforgeProgramEngine?.stats());
      check(JSON.stringify(await reviewed(page)) === JSON.stringify(definition) &&
        !(pinnedStats?.worker > 0) && !(pinnedStats?.main > 0),
        "P073: opening an older-policy result preserves its preview without implicit regeneration", pinnedStats);
      await page.click("#entryRebuildRules");
      await page.waitForSelector("#entryRebuildRules", { state: "detached", timeout: 20000 });
      await page.waitForSelector("#entryReview [data-review-slot]", { timeout: 20000 });
      const rebuiltStats = await page.evaluate(() => window.__repforgeProgramEngine?.stats());
      check(rebuiltStats?.worker > 0 && JSON.stringify(await reviewed(page)) === JSON.stringify(definition),
        "P073: explicit Rebuild generates the current deterministic recommendation", rebuiltStats);
      await page.locator("#entryReview [data-review-block-edit]").click();
      check(await page.locator("#reviewSheet [data-review-block-step]").count() === 0 &&
        /7/.test(await page.locator("#reviewSheet [data-review-block-weeks]").innerText()),
        "P073: the generated block exposes seven regular weeks without unsupported length controls");
      await page.locator("#reviewSheet [data-review-block-deload]").click();
      await page.locator("#reviewSheet [data-review-block-apply]").click();
      await page.waitForFunction(() => {
        const definition = window.__repforgeEntryState()?.result?.preview?.programDefinition;
        return definition?.cycles === 8 && JSON.stringify(definition.deloadCycles) === "[8]"
          && !document.querySelector("#entryReview[aria-busy]");
      }, undefined, { timeout: 20000 });
      const withDeload = await entry(page);
      const deloadRequest = Adapter.programRequestFromAnswers(withDeload.answers, Catalog);
      const deloadExpected = deloadRequest.ok ? Compiler.generateProgram(deloadRequest.value, Catalog) : null;
      check(withDeload.answers.block.cycles === 7 && deloadExpected?.ok &&
        JSON.stringify(withDeload.result.preview.programDefinition) === JSON.stringify(deloadExpected.value),
        "P073: adding a lighter week retains seven regular weeks and rebuilds the canonical eight-week program");
      check((await page.locator("#entryReview .review__facts .entry__strip-value").last().innerText()).trim() === "8" &&
        /7/.test(await page.locator("#entryReview .review__block").innerText()) &&
        /8/.test(await page.locator("#entryReview .review__block").innerText()),
        "P073: total facts show eight weeks while block copy distinguishes seven regular weeks and recovery week eight");
      await page.locator("#entryReview [data-review-block-edit]").click();
      await page.locator("#reviewSheet [data-review-block-deload]").click();
      await page.locator("#reviewSheet [data-review-block-apply]").click();
      await page.waitForFunction(() => {
        const definition = window.__repforgeEntryState()?.result?.preview?.programDefinition;
        return definition?.cycles === 7 && definition.deloadCycles.length === 0
          && !document.querySelector("#entryReview[aria-busy]");
      }, undefined, { timeout: 20000 });
      check(JSON.stringify(await reviewed(page)) === JSON.stringify(definition),
        "P073: removing the additional recovery week restores the identical regular program");
      const beforeEdit = await entry(page);
      const stored = await page.evaluate(() => localStorage.getItem("repforge_program_setup_draft_v1"));
      await page.evaluate(() => {
        const base = window.RepForgeProgramEntryAdapter.createProductionServices({
          Compiler: window.RepForgeProgramCompiler, catalog: window.RepForgeExerciseCatalog.snapshot(),
        });
        window.__repforgeProgramEntryServicesOverride = { ...base, generateProgram: () => ({
          ok: false, conflicts: [{ code: "unsupported_generation_domain" }],
        }) };
      });
      await page.locator("#entryReview [data-review-block-edit]").click();
      await page.locator('#reviewSheet [data-review-block-pattern="linear"]').click();
      await page.locator("#reviewSheet [data-review-block-apply]").click();
      await page.waitForFunction(() => {
        const notice = document.querySelector("#toast");
        return notice && !notice.classList.contains("hidden") && /could not build/i.test(notice.textContent)
          && !document.querySelector("#entryReview[aria-busy]");
      }, undefined, { timeout: 10000 });
      const afterEdit = await entry(page);
      check(JSON.stringify(afterEdit.answers) === JSON.stringify(beforeEdit.answers) &&
        JSON.stringify(afterEdit.result) === JSON.stringify(beforeEdit.result) &&
        await page.evaluate(() => localStorage.getItem("repforge_program_setup_draft_v1")) === stored,
        "P073: a refused rebuild preserves the reviewed program, answers and exact persisted draft");
      await page.evaluate(() => { delete window.__repforgeProgramEntryServicesOverride; });
      await page.waitForSelector("#toast.hidden", { state: "attached", timeout: 10000 });
      if (supportsPeriodized) {
      const sourceCenters = {
        linear: { primary: [[8,8,6,5,5,3,3],[12,12,10,9,8,6,6]], secondary: [15,15,13,11,10,8,8], accessory: [20,20,17,15,13,10,10] },
        reverse_linear: { primary: [[3,3,5,5,6,8,8],[6,6,8,9,10,12,12]], secondary: [8,8,10,11,13,15,15], accessory: [10,10,13,15,17,20,20] },
        undulating: { primary: [[8,5,3,8,5,6,3],[12,9,6,12,8,10,6]], secondary: [15,11,8,15,10,13,8], accessory: [20,15,10,20,13,17,10] },
      };
      const assembly = value => value.days.map(day => day.slots.map(slot => [slot.exerciseId, slot.role, slot.prescriptionsByCycle.map(cycle => cycle.sets.length)]));
      const staticAssembly = assembly(definition);
      for (const periodization of ["reverse_linear", "undulating", "linear"]) {
        await page.locator("#entryReview [data-review-block-edit]").click();
        await page.locator(`#reviewSheet [data-review-block-pattern="${periodization}"]`).click();
        await page.locator("#reviewSheet [data-review-block-apply]").click();
        await page.waitForFunction(pattern => window.__repforgeEntryState()?.result?.preview?.programDefinition?.request?.periodization === pattern
          && !document.querySelector("#entryReview[aria-busy]"), periodization, { timeout: 20000 });
        definition = (await entry(page)).result.preview.programDefinition;
        check(JSON.stringify(assembly(definition)) === JSON.stringify(staticAssembly) && definition.cycles === 7 && definition.deloadCycles.length === 0,
          `P073 ${periodization}: block edit preserves exercises and sets by position across seven normal cycles`);
        const pullIds = new Set(["19e5c6f170d88009ba40c03d2f6271df", "19e5c6f170d8808fbc7ffe35bc0bf0ca"]);
        check(definition.days.every(day => day.slots.every(slot => {
          const role = slot.role.endsWith("Accessory") ? "accessory" : slot.role.endsWith("PrimaryCompound") ? "primary" : "secondary";
          const raw = Catalog.exercises.find(exercise => exercise.id === slot.exerciseId);
          const key = raw.exerciseMetrics.includes("2555c6f170d88072bbf6d9ad3f16ea86") ? "reps"
            : raw.exerciseMetrics.includes("25a5c6f170d880baaa2dc8c7b67d4b65") ? "repsPerSide" : null;
          const pull = Number(raw.movementPattern.some(id => pullIds.has(id)));
          const centers = role === "primary" ? sourceCenters[periodization][role][pull] : sourceCenters[periodization][role];
          return slot.prescriptionsByCycle.every((cycle, index) => cycle.sets.every(set => {
            const range = key ? set.targets[key] : null;
            return set.provenance.periodization === periodization && set.restSeconds === null
              && (key ? Object.keys(set.targets).length === 1 && range?.min === centers[index] - 1 && range?.max === centers[index] + 1
                : Object.keys(set.targets).length === 0 && set.rir === null);
          }));
        })), `P073 ${periodization}: review carries the seven recovered source centers and null metric targets`);
      }
      }
    }
    await page.click("#entryActivate");
    await page.waitForFunction(() => window.__repforgeWorkoutDraft.state()?.programMeta?.onboarded === true, undefined, { timeout: 20000 });
    await page.evaluate(() => window.__repforgeStorage?.flush?.());
    check(JSON.stringify((await state(page)).programMeta.programDefinition) === JSON.stringify(definition),
      `P073 ${mode}: activation preserves the reviewed definition`);
    await page.click("#startWorkout");
    await page.waitForSelector("#workout .exercise", { timeout: 10000 });
    const focus = await page.evaluate(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      return Object.values(draft?.exercises || {}).map((exercise) => ({
        slot: exercise.sourceExerciseId || exercise.exerciseInstanceId,
        sets: exercise.setOrder.map((id) => exercise.sets[id]).filter((set) => set.role === "working")
          .map((set) => ({ targets: set.programmed.targets, rir: set.programmed.targetRir, restSeconds: set.programmed.restSeconds })),
      }));
    });
    const day = trainingDays(definition).find((candidate) => candidate.slots.some((slot) => focus.some((exercise) => exercise.slot === slot.id)));
    check(!!day && day.slots.every((slot) => JSON.stringify(focus.find((exercise) => exercise.slot === slot.id)?.sets) ===
      JSON.stringify(slot.prescriptionsByCycle[0].sets.map((set) => ({ targets: set.targets, rir: set.rir, restSeconds: set.restSeconds })))),
      `P073 ${mode}: Focus consumes the activated prescriptions`, focus);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    check(JSON.stringify((await state(page)).programMeta.programDefinition) === JSON.stringify(definition),
      `P073 ${mode}: the activated definition survives reload`);
    check(!!await page.evaluate(() => window.__repforgeWorkoutDraft.current()),
      `P073 ${mode}: the Focus draft survives reload`);
    errors.push(...run.errors);
    await run.context.close();
  }
  return errors;
}

async function resumeSavedReview(page) {
  await page.waitForSelector("#entryReview [data-review-slot], #entryResumeContinue, #firstRunCreate", { timeout: 15000 });
  if (!await page.locator("#entryReview [data-review-slot]").count()) {
    if (!await page.locator("#entryResumeContinue").count()) await page.click("#firstRunCreate");
    await page.click("#entryResumeContinue");
  }
  await page.locator("#entryReview [data-review-slot]").first().waitFor({ state: "visible", timeout: 15000 });
}

async function sourceSplitChoicesJourney(browser) {
  const domains = [
    [2, "full_body", ["full_body", "upper_lower", "push_pull"]],
    [3, "upper_lower_full", ["full_body", "upper_lower_full", "push_pull_legs"]],
    [4, "upper_lower_upper_lower", ["full_body", "upper_lower_upper_lower", "push_pull_hinge_squat", "push_pull_legs_accessories"]],
    [5, "push_pull_legs_upper_lower", ["full_body", "upper_lower_upper_lower_upper", "push_pull_hinge_squat_accessories", "push_pull_legs_upper_lower"]],
    [6, "push_pull_legs_push_pull_legs", ["full_body", "push_pull_hinge_squat_upper_lower", "push_pull_legs_push_pull_legs"]],
  ];
  let visited = 0;
  const errors = [];
  for (const [daysPerWeek, automatic, expected] of domains) {
    const run = await fresh(browser);
    const { page } = run;
    const persisted = await page.evaluate(async (daysPerWeek) => {
      window.startOnboarding("first-run", { userInitiated: true, forceFresh: true });
      const Entry = window.RepForgeProgramEntry;
      const active = window.__repforgeEntryState();
      let draft = Entry.selectRoute(Entry.createState({ draftId: `source-custom-${daysPerWeek}`,
        activeProgramRevisionAtStart: active.activeProgramRevisionAtStart, now: new Date().toISOString(),
        versions: window.RepForgeProgramEntryAdapter.currentVersions(window.RepForgeProgramCompiler) }), "custom");
      draft = Entry.setAnswers(draft, { desiredResult: "balanced", structuredExperience: "over_24m", daysPerWeek,
        sessionMinutes: 60, environment: { kind: "everything" }, primaryMuscles: [], deEmphasizedMuscles: [],
        ignoredMuscles: [], mustHaveExercises: [], exerciseConstraints: [], block: { cycles: 7, periodization: "static" }, deload: true });
      return window.__repforgePersistSetupDraft({ ...draft, step: "exercise_preferences" });
    }, daysPerWeek);
    check(persisted?.ok === true, `source choices: the saved ${daysPerWeek}-day Custom route uses the production draft writer`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await page.click("#firstRunCreate");
    await page.click("#entryResumeContinue");
    await page.waitForFunction(() => window.__repforgeEntryState()?.step === "exercise_preferences");
    await page.click("#onbNext");
    const choices = page.locator('#onbBody > .entry-motion-page:not([aria-hidden="true"]) [data-entry-pick="splitPreference"]');
    await choices.first().waitFor({ state: "visible", timeout: 10000 });
    const visible = await choices.evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.entryVal,
      selected: node.getAttribute("aria-checked") === "true", text: node.textContent })));
    check(JSON.stringify(visible.map(choice => choice.id)) === JSON.stringify(expected) &&
      JSON.stringify(visible.filter(choice => choice.selected).map(choice => choice.id)) === JSON.stringify([automatic]) &&
      visible.every(choice => !choice.text.includes("split.")),
      `source choices: ${daysPerWeek} days exposes every compatible translated split and the canonical default`, visible);
    for (const id of expected) {
      await page.locator(`#onbBody > .entry-motion-page:not([aria-hidden="true"]) [data-entry-pick="splitPreference"][data-entry-val="${id}"]`).click();
      await page.waitForFunction(id => JSON.parse(localStorage.getItem("repforge_program_setup_draft_v1"))?.state?.answers?.splitPreference === id,
        id, { timeout: 10000 });
      const selected = await entry(page);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("repforge_program_setup_draft_v1")));
      check(selected.answers.splitPreference === id && saved?.state?.answers?.splitPreference === id,
        `source choices: ${daysPerWeek}/${id} survives the production answer and draft writers`);
      visited++;
    }
    await page.click("#onbNext");
    await page.locator("#entryReview [data-review-slot]").first().waitFor({ state: "visible", timeout: 20000 });
    const candidate = await entry(page);
    const mapped = Adapter.programRequestFromAnswers(candidate.answers, Catalog);
    const reference = mapped.ok ? Compiler.generateProgram(mapped.value, Catalog) : null;
    check(reference?.ok && JSON.stringify(candidate.result.preview.programDefinition) === JSON.stringify(reference.value),
      `source choices: the selected ${daysPerWeek}-day split generates the exact canonical definition`);
    errors.push(...run.errors);
    await run.context.close();
  }
  check(visited === 17, "all seventeen authored split/frequency choices were rendered and selected");
  return errors;
}

async function maximumSourcePreviewPersistence(browser) {
  const { context, page, errors } = await fresh(browser);
  await page.click("#firstRunCreate");
  await answerRecommend(page, { skipBasics: true, goal: "muscle_growth", lifting: "over_24m",
    days: 6, minutes: 150, environment: "everything", deload: true });
  await page.locator("#entryReview [data-review-slot]").first().waitFor({ state: "visible", timeout: 20000 });
  const before = await entry(page);
  check(before.answers.daysPerWeek === 6 && before.answers.sessionMinutes === 150 &&
    before.answers.environment.kind === "everything" && before.result.preview.programDefinition.cycles === 8,
    "the maximum source preview reaches Review with six days, every equipment item and the extra recovery week");
  await page.waitForFunction(() => {
    const stored = JSON.parse(localStorage.getItem("repforge_program_setup_draft_v1"));
    return stored?.state?.result?.fingerprint === window.__repforgeEntryState()?.result?.fingerprint;
  }, undefined, { timeout: 15000 });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("repforge_program_setup_draft_v1")));
  check(JSON.stringify(stored.state.result) === JSON.stringify(before.result),
    "the maximum complete result, including flat preview rows, is durably acknowledged before reload");
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await resumeSavedReview(page);
  const after = await entry(page);
  check(JSON.stringify(after.result) === JSON.stringify(before.result) && JSON.stringify(after.answers) === JSON.stringify(before.answers),
    "the maximum source preview and all answers survive ordinary production reload without regeneration");
  check((await state(page)).program.length === 0, "resuming the maximum preview does not activate it");
  await context.close();
  return errors;
}

async function main() {
  console.log("P067 slice 2: Generate → review → activate through the production entry UI");
  const browser = await launchChromium();
  const allErrors = [];
  try {
    allErrors.push(await recoveredGenerationJourney(browser));
    allErrors.push(await sourceSplitChoicesJourney(browser));
    allErrors.push(await maximumSourcePreviewPersistence(browser));
    // Generate and activate ------------------------------------------------
    const { context, page, errors } = await fresh(browser);
    allErrors.push(errors);
    await answerGenerate(page);
    await page.locator("#entryActivate").waitFor({ state: "visible", timeout: 15000 });
    const staged = await entry(page);
    const definition = staged.result?.preview?.programDefinition;
    const mapped = Adapter.programRequestFromAnswers(staged.answers, Catalog);
    const expected = Compiler.generateProgram(mapped.value, Catalog);
    check(expected.ok && JSON.stringify(definition) === JSON.stringify(expected.value),
      "the reviewed program is exactly the canonical generator output for the answers");
    const engineRuns = await page.evaluate(() => window.__repforgeProgramEngine?.stats());
    check(engineRuns?.mode === "worker" && engineRuns.worker >= 1 && engineRuns.main === 0,
      "the program is generated in the worker, not on the main thread", engineRuns);
    check(definition?.request?.goal === "hypertrophy" && definition.request.daysPerWeek === 4 &&
      definition.request.timeCeilingMinutes === 60, "the answers reach the generator as goal, days and time ceiling");
    const weekText = await page.locator("#entryCandidateReview").innerText();
    const firstSlot = definition.days.find((day) => day.kind === "training").slots[0];
    const firstName = Catalog.exercises.find((item) => item.id === firstSlot.exerciseId).name;
    check(weekText.includes(firstName), "the review lists the generated movements", firstName);
    check(await state(page).then((value) => !value.programMeta.onboarded && value.program.length === 0),
      "reviewing a generated program writes nothing to the training state");
    check(definition.request.deloadCycles?.length === 1 && definition.request.deloadCycles[0] === definition.cycles,
      "deload is on by default: the block ends with a deload week");

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
    check(!(await state(page)).profile, "skipping every Basics screen keeps no profile");
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
    const withAnswer = abilityYesStaged.result?.preview?.programDefinition;
    if (!slotsOf(withAnswer).some((slot) => slot.exerciseId === benchId)) {
      const eligible = slotsOf(withAnswer).map((slot) => ({ slot,
        candidate: Compiler.findSubstitutions(withAnswer, slot.id, {}, Catalog).find((item) => item.exerciseId === benchId) }))
        .find((item) => item.candidate);
      check(!!eligible, "answering yes exposes barbell bench press as an engine substitution");
      if (eligible) {
        const dayIndex = withAnswer.days.findIndex((day) => (day.slots || []).some((slot) => slot.id === eligible.slot.id));
        await abilityYes.page.locator(`#entryReview [data-review-tab="${dayIndex}"]`).click();
        await openSlot(abilityYes.page, eligible.slot.id);
        if (!await abilityYes.page.locator(`#reviewSheet [data-review-swap="${benchId}"]`).count()) {
          await abilityYes.page.locator("#reviewSheet [data-review-more-subs]").click();
        }
        await abilityYes.page.locator(`#reviewSheet [data-review-swap="${benchId}"]`).click();
        await closeSheet(abilityYes.page);
      }
    }
    const withoutAnswerRequest = abilityYesMapped.ok
      ? { ...abilityYesMapped.value, competencyAnswers: { ...abilityYesMapped.value.competencyAnswers, benchPress10: null } }
      : null;
    const withoutAnswer = withoutAnswerRequest ? Compiler.generateProgram(withoutAnswerRequest, Catalog) : { ok: false };
    const idsWith = slotsOf(await reviewed(abilityYes.page)).map((slot) => slot.exerciseId);
    const idsWithout = withoutAnswer.ok ? slotsOf(withoutAnswer.value).map((slot) => slot.exerciseId) : null;
    const benchAvailableWithout = withoutAnswer.ok && slotsOf(withoutAnswer.value).some((slot) =>
      Compiler.findSubstitutions(withoutAnswer.value, slot.id, {}, Catalog).some((item) => item.exerciseId === benchId));
    check(idsWith.includes(benchId) && idsWithout && !idsWithout.includes(benchId) && !benchAvailableWithout,
      "answering yes permits the chosen barbell bench press in review; without the answer it is neither generated nor offered",
      { idsWith, idsWithout, benchAvailableWithout });
    await abilityYes.context.close();

    // #340: answering yes to 10 strict pull-ups permits a weighted vertical
    // pull chosen through the production review ------------------------------
    const pullYes = await fresh(browser, { uuid: "0" });
    allErrors.push(pullYes.errors);
    await answerGenerate(pullYes.page, { abilities: { pullups10: "yes" } });
    await pullYes.page.locator("#entryActivate").waitFor({ state: "visible", timeout: 15000 });
    const pullStaged = await entry(pullYes.page);
    check(pullStaged.answers.competencyAnswers?.pullups10 === true,
      "answering yes to 10 strict pull-ups records a true competency answer", pullStaged.answers.competencyAnswers);
    const weightedPullPrerequisite = Object.entries(Catalog.uuidIndex)
      .find(([, item]) => item.type === "preconditions" && item.name === "Weighted vertical pulls preconditions")[0];
    const weightedPulls = new Set(Catalog.exercises.filter((item) => (item.preconditions || []).includes(weightedPullPrerequisite)).map((item) => item.id));
    const pullDefinition = pullStaged.result?.preview?.programDefinition;
    // Eligibility does not promise automatic selection. Make the lifter's
    // preference explicit through the production review's engine candidates.
    if (!slotsOf(pullDefinition).some((slot) => weightedPulls.has(slot.exerciseId))) {
      const eligible = slotsOf(pullDefinition).map((slot) => ({ slot,
        candidate: Compiler.findSubstitutions(pullDefinition, slot.id, {}, Catalog).find((item) => weightedPulls.has(item.exerciseId)) }))
        .find((item) => item.candidate);
      check(!!eligible, "answering yes exposes a weighted vertical pull as an engine substitution");
      if (eligible) {
        const dayIndex = pullDefinition.days.findIndex((day) => (day.slots || []).some((slot) => slot.id === eligible.slot.id));
        await pullYes.page.locator(`#entryReview [data-review-tab="${dayIndex}"]`).click();
        await openSlot(pullYes.page, eligible.slot.id);
        if (!await pullYes.page.locator(`#reviewSheet [data-review-swap="${eligible.candidate.exerciseId}"]`).count()) {
          await pullYes.page.locator("#reviewSheet [data-review-more-subs]").click();
        }
        await pullYes.page.locator(`#reviewSheet [data-review-swap="${eligible.candidate.exerciseId}"]`).click();
        await closeSheet(pullYes.page);
      }
    }
    const pullBuilt = slotsOf(await reviewed(pullYes.page)).map((slot) => slot.exerciseId);
    const pullMapped = Adapter.programRequestFromAnswers(pullStaged.answers, Catalog);
    const pullWithout = pullMapped.ok ? Compiler.generateProgram({ ...pullMapped.value,
      competencyAnswers: { ...pullMapped.value.competencyAnswers, pullups10: null } }, Catalog) : { ok: false };
    const pullIdsWithout = pullWithout.ok ? pullWithout.value.days.flatMap((day) => (day.slots || []).map((slot) => slot.exerciseId)) : null;
    check(pullBuilt.some((id) => weightedPulls.has(id)) && pullIdsWithout && !pullIdsWithout.some((id) => weightedPulls.has(id)),
      "answering yes permits the chosen weighted vertical pull in review, where the request without the answer generates none",
      { pullBuilt, pullIdsWithout });
    await pullYes.context.close();

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

    // The canonical request stays stable across a resumed setup draft --------
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
    allErrors.push(await answerEditorMatchesRecommend(browser));
    allErrors.push(await impossible(browser));
    allErrors.push(await onboardingB(browser));
    allErrors.push(await onboardingBNavigation(browser));
    allErrors.push(await onboardingPounds(browser));
    allErrors.push(await onboardingResume(browser));
    allErrors.push(await onboardingBuilding(browser));
    allErrors.push(await onboardingBuildingReduced(browser));
    allErrors.push(await onboardingBuildingMainFallback(browser));
    allErrors.push(await onboardingConflict(browser));
    allErrors.push(await onboardingTimeConflict(browser));
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
