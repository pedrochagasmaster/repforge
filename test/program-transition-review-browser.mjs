#!/usr/bin/env node
/**
 * Plan 067 block-end Review transitions through the production UI.
 *
 * A generated program reaches the end of its block; each Review change
 * (reduce volume, fewer days, recovery week) is previewed, confirmed by its
 * proposal hash, and committed as a new block whose ProgramDefinition is the
 * derived successor. A set-count edit made during the block survives a
 * fewer-days regeneration, named in the preview and present in the committed
 * successor. A proposal made stale by another tab is refused with the
 * program unchanged, and a Build program's schedule repair stages guided
 * editing instead of regenerating.
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
let now = Date.parse("2026-03-02T09:00:00.000Z");

const failures = [];
let passed = 0;
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 2000)}`);
}

const state = (page) => page.evaluate(() => window.__repforgeWorkoutDraft.state());
const flush = (page) => page.evaluate(() => window.__repforgeStorage?.flush?.());
const training = (definition) => definition.days.filter((day) => day.kind === "training");
const slots = (definition) => training(definition).flatMap((day) => day.slots);
const firstCycleSets = (definition) => new Map(slots(definition).map((slot) =>
  [slot.id, { role: slot.role, sets: slot.prescriptionsByCycle[0].sets.length }]));

async function replicas(page) {
  return page.evaluate(async () => {
    const local = JSON.parse(localStorage.getItem("repforge_v1") || "null");
    const idb = await new Promise((resolve) => {
      const open = indexedDB.open("repforge");
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        const read = open.result.transaction("kv").objectStore("kv").get("repforge_v1");
        read.onsuccess = () => { open.result.close(); resolve(read.result ?? null); };
        read.onerror = () => { open.result.close(); resolve(null); };
      };
    });
    return { local, idb: typeof idb === "string" ? JSON.parse(idb) : idb };
  });
}

async function advanceTo(page, time) {
  now = time;
  await page.clock.setFixedTime(new Date(now));
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
}

async function finishBlock(page) {
  const { programMeta } = await state(page);
  await advanceTo(page, Date.parse(`${programMeta.started}T09:00:00.000Z`) + (programMeta.mesocycleLengthWeeks * 7 + 1) * DAY);
}

async function openReview(page) {
  if (await page.locator("#settings.view.active").count()) await page.locator("#settingsBack").click();
  await page.locator('nav button[data-view="stats"]').click();
  await page.locator('#statsSeg [data-seg="review"]').click();
  await page.locator("#reviewPanel").waitFor({ state: "visible" });
}

async function seed(page, { manual = false } = {}) {
  const result = await page.evaluate(async ({ request, manual }) => {
    const catalogSnapshot = window.RepForgeExerciseCatalog.snapshot();
    const generated = window.RepForgeProgramCompiler.generateProgram(request, catalogSnapshot, "review-browser-067");
    if (!generated.ok) return { ok: false, generated };
    const definition = generated.value;
    if (manual) {
      // A Build program records no generator request to regenerate from.
      definition.generatorVersion = "manual@1";
      definition.seed = "manual";
      definition.request = {};
      definition.provenance = { source: "manual", policyVersion: "manual@1" };
    }
    const finalized = await window.__repforgeFinalizeProgramSetup({
      programDefinition: definition, name: manual ? "Review build program" : "Review generated program",
      answers: {}, destination: "log", origin: "first-run", draftConfirmed: true,
      telemetryRoute: manual ? "build" : "recommend",
      entrySource: { route: manual ? "build" : "recommend", fingerprint: "review-browser-067" },
    });
    await window.__repforgeStorage.flush();
    return { ok: !!(finalized?.localOk || finalized?.idbOk), finalized };
  }, { request: REQUEST, manual });
  if (!result.ok) throw new Error(`seeding failed: ${JSON.stringify(result).slice(0, 1500)}`);
}

async function confirmPreview(page, { title }) {
  await page.locator("[data-preview-confirm]").waitFor({ state: "visible", timeout: 15000 });
  const text = await page.locator("#reviewPanel").innerText();
  check(text.toLowerCase().includes(title.toLowerCase()), `the preview is titled "${title}"`, text);
  const before = await state(page);
  await page.locator("[data-preview-confirm]").click();
  await page.waitForFunction((id) => window.__repforgeWorkoutDraft.state()?.programMeta?.id !== id ||
    document.querySelector("#reviewPanel .review__error"), before.programMeta.id, { timeout: 30000 });
  const failed = await page.locator("#reviewPanel .review__error").count();
  if (failed) throw new Error(`confirmation failed: ${await page.evaluate(() =>
    JSON.stringify(window.__repforgeProgressReview?.flow?.()))}`);
  await flush(page);
  return before;
}

function checkCommitted(before, after, durable, label) {
  const record = after.programMeta.transitionIn;
  check(record?.status === "committed" && record.predecessor?.programId === before.programMeta.id &&
    record.successor?.programId === after.programMeta.id,
  `${label}: the successor carries its committed transition record`, record);
  const archive = (after.programHistory || []).find((entry) => entry.id === before.programMeta.id);
  check(archive?.transitionOut?.transitionId === record?.transitionId,
    `${label}: the predecessor is archived with the matching transition-out link`, archive?.transitionOut);
  check(after.programMeta.blockId !== before.programMeta.blockId && after.programMeta.mesocycleStatus === "active",
    `${label}: the change starts a new active block`);
  check(after.programMeta.mesocycleLengthWeeks === after.programMeta.programDefinition.cycles,
    `${label}: the block length follows the successor's cycles`);
  check(JSON.stringify(durable.local?.programMeta?.programDefinition) === JSON.stringify(after.programMeta.programDefinition) &&
    JSON.stringify(durable.idb?.programMeta?.programDefinition) === JSON.stringify(after.programMeta.programDefinition),
  `${label}: both durable replicas hold the successor definition`);
}

async function main() {
  console.log("P067 Review transitions: preview, confirm, and refuse through the production UI");
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  try {
    await page.clock.setFixedTime(new Date(now));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await seed(page);
    const seeded = await state(page);
    check(training(seeded.programMeta.programDefinition).length === 4, "a generated four-day program is active");

    // Reduce volume: an open workout's typed value in a removed set blocks it
    await finishBlock(page);
    const accessory = training((await state(page)).programMeta.programDefinition)
      .map((day) => ({ day, slot: day.slots.find((slot) => /Accessory$/.test(slot.role) && slot.prescriptionsByCycle[0].sets.length >= 2) }))
      .find((item) => item.slot);
    if (!await page.evaluate((day) => window.__repforgeEnterWorkout({ day }), accessory.day.name)) throw new Error("could not enter workout");
    const lastSet = accessory.slot.prescriptionsByCycle[0].sets.length;
    const typed = await page.evaluate(async ({ slotId, ordinal }) => {
      const exercise = window.__repforgeWorkoutDraft.current().exercises[slotId];
      const setId = exercise.setOrder.find((id) => exercise.sets[id].ordinal === ordinal);
      const metric = exercise.sets[setId].programmed.metrics[0];
      const result = await window.__repforgeWorkoutDraft.dispatch("editMetricValue",
        { exerciseInstanceId: slotId, setId, metricId: metric.id, value: "12" });
      await window.__repforgeWorkoutDraft.flush();
      return result.status;
    }, { slotId: accessory.slot.id, ordinal: lastSet });
    check(typed === "applied", "the open workout holds a typed value in a set the reduction removes", typed);
    await page.evaluate(() => window.__repforgeLeaveWorkout?.());
    await openReview(page);
    await page.locator('[data-review-action="reduce-volume"]').click();
    await page.locator("[data-volume-confirm]").click();
    const guarded = await replicas(page);
    await page.locator("[data-preview-confirm]").click();
    await page.locator("#reviewPanel .review__error").waitFor({ state: "visible", timeout: 15000 });
    const afterGuard = await replicas(page);
    check(afterGuard.local.programMeta.id === guarded.local.programMeta.id &&
      JSON.stringify(afterGuard.local.programMeta.programDefinition) === JSON.stringify(guarded.local.programMeta.programDefinition),
    "volume reduction refuses to strand the workout's typed value and changes nothing");
    // Discarding the workout through the production clear releases the guard.
    check(await page.evaluate(() => clearDraft()) !== false, "the lifter can discard the open workout");
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await openReview(page);
    await page.locator('[data-review-action="reduce-volume"]').click();
    await page.locator("[data-volume-confirm]").click();
    const beforeVolume = await confirmPreview(page, { title: "Proposed plan" });
    const afterVolume = await state(page);
    checkCommitted(beforeVolume, afterVolume, await replicas(page), "reduce volume");
    const was = firstCycleSets(beforeVolume.programMeta.programDefinition);
    const reducedOk = [...firstCycleSets(afterVolume.programMeta.programDefinition)].every(([id, { role, sets }]) =>
      /Compound$/.test(role) ? sets === was.get(id).sets : sets === Math.max(1, was.get(id).sets - 1));
    check(reducedOk, "accessory slots lose one set and compound slots keep theirs");
    check(afterVolume.program.every((row) => row.sets === firstCycleSets(afterVolume.programMeta.programDefinition).get(row.slotId || row.id)?.sets),
      "the program rows are the successor's first-cycle projection");

    // A set-count edit the lifter made during the block -------------------
    // Shaped exactly as the installed editor writes one (the last set
    // duplicated as a manual set). It is committed through the production
    // state seam because an installed-editor apply currently strands every
    // later Review confirmation as out of date (#344).
    const compound = slots(afterVolume.programMeta.programDefinition).find((slot) => /PrimaryCompound$/.test(slot.role));
    const movement = afterVolume.program.find((row) => (row.slotId || row.id) === compound.id).name;
    const editedWeek = 2;
    const setsBeforeEdit = compound.prescriptionsByCycle[editedWeek - 1].sets.length;
    const edited = await page.evaluate(async ({ slotId, week }) => {
      const head = window.__repforgeWorkoutDraft.state();
      const slot = head.programMeta.programDefinition.days.flatMap((day) => day.slots).find((item) => item.id === slotId);
      const cycle = slot.prescriptionsByCycle.find((item) => item.cycleIndex === week);
      cycle.sets.push({ ...structuredClone(cycle.sets.at(-1)), id: "review-browser-added-set", setIndex: cycle.sets.length + 1,
        rir: null, status: "manual", provenance: { source: "manual", policyVersion: "manual@1" } });
      const committed = await window.__repforgeCommitProposedState(head);
      await window.__repforgeStorage.flush();
      return !!(committed?.localOk && committed?.idbOk);
    }, { slotId: compound.id, week: editedWeek });
    check(edited, `the block holds an extra ${movement} set in week ${editedWeek}`);

    // Fewer days ----------------------------------------------------------
    await finishBlock(page);
    await openReview(page);
    await page.locator('[data-review-action="schedule-repair"]').click();
    await page.locator('[data-diag="fewer_days"]').click();
    await page.locator("[data-diag-target]").fill("3");
    await page.locator("[data-diag-continue]").click();
    await page.locator("[data-preview-confirm]").waitFor({ state: "visible", timeout: 15000 });
    const daysPreview = await page.locator("#reviewPanel").innerText();
    check(daysPreview.includes("Training days: 4 → 3"), "the preview states the training-day change");
    const keptLine = `Kept your edits to ${movement}: week ${editedWeek}: ${setsBeforeEdit + 1} sets`;
    check(daysPreview.split("\n").some((line) => line.trim() === keptLine),
      "the preview names the set-count edit that survives the regeneration", { keptLine, daysPreview });
    check(!/could not be identified/.test(daysPreview), "the block's edits are identified");
    const beforeDays = await confirmPreview(page, { title: "Proposed plan" });
    const afterDays = await state(page);
    checkCommitted(beforeDays, afterDays, await replicas(page), "fewer days");
    check(training(afterDays.programMeta.programDefinition).length === 3 &&
      afterDays.programMeta.programDefinition.request.daysPerWeek === 3 && afterDays.programMeta.daysPerWeek === 3,
    "the regenerated successor trains three days a week");
    const carriedSlot = slots(afterDays.programMeta.programDefinition).find((slot) => slot.exerciseId === compound.exerciseId);
    check(carriedSlot?.prescriptionsByCycle[editedWeek - 1].sets.length === setsBeforeEdit + 1,
      "the committed successor holds the set count the preview showed",
      carriedSlot?.prescriptionsByCycle.map((cycle) => cycle.sets.length));

    // Recovery week -------------------------------------------------------
    await finishBlock(page);
    await openReview(page);
    await page.locator('[data-review-action="recovery-week"]').click();
    await page.locator('[data-recovery-answer="No"]').click();
    check((await page.locator("#reviewPanel").innerText()).includes("Nothing changed"),
      "answering No schedules nothing");
    await page.locator('[data-recovery-answer="Yes"]').click();
    const beforeRecovery = await confirmPreview(page, { title: "Recovery week preview" });
    const afterRecovery = await state(page);
    checkCommitted(beforeRecovery, afterRecovery, await replicas(page), "recovery week");
    const recovered = afterRecovery.programMeta.programDefinition;
    check(recovered.cycles === beforeRecovery.programMeta.programDefinition.cycles + 1 && recovered.deloadCycles[0] === 1,
      "the recovery week is a deload cycle inserted at the start of the block");
    const scheduled = await page.evaluate(() => window.__repforgeProgressReview.scheduledProgram());
    const previousSets = firstCycleSets(beforeRecovery.programMeta.programDefinition);
    check(scheduled.length > 0 && scheduled.every((row) => row.sets === Math.ceil(previousSets.get(row.slotId || row.id).sets / 2)),
      "this week's scheduled sessions are the halved recovery prescription", scheduled.map((row) => [row.slotId, row.sets]));

    // A proposal made stale by another tab is refused ---------------------
    await finishBlock(page);
    await openReview(page);
    await page.locator('[data-review-action="reduce-volume"]').click();
    await page.locator("[data-volume-confirm]").click();
    await page.locator("[data-preview-confirm]").waitFor({ state: "visible", timeout: 15000 });
    const other = await context.newPage();
    await other.clock.setFixedTime(new Date(now));
    await other.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(other, { base: BASE });
    const beforeStale = await replicas(page);
    if (!await other.locator("#log.view.active").count()) await other.locator('nav button[data-view="log"]').click();
    await other.locator("#openSettings").click();
    await other.locator("#unit").selectOption("lb");
    await other.waitForFunction(() => window.__repforgeWorkoutDraft.state()?.settings?.unit === "lb");
    await flush(other);
    await other.close();
    const otherRevision = await replicas(page);
    check(JSON.stringify(otherRevision.local.settings) !== JSON.stringify(beforeStale.local.settings),
      "the other tab committed a durable change while the preview was open");
    await page.locator("[data-preview-confirm]").click();
    await page.locator("#reviewPanel .review__error").waitFor({ state: "visible", timeout: 15000 });
    const afterStale = await replicas(page);
    check(afterStale.local.programMeta.id === beforeStale.local.programMeta.id &&
      JSON.stringify(afterStale.local.programMeta.programDefinition) === JSON.stringify(beforeStale.local.programMeta.programDefinition),
    "the stale proposal leaves the active program unchanged");
    check(/changed|newer|again/i.test(await page.locator("#reviewPanel .review__error").innerText()),
      "the lifter is told the plan changed and can retry");

    // A Build program's schedule repair stages guided editing -------------
    const manualContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const manual = await manualContext.newPage();
    manual.on("pageerror", (error) => errors.push(String(error?.stack || error)));
    now = Date.parse("2026-03-02T09:00:00.000Z");
    await manual.clock.setFixedTime(new Date(now));
    await manual.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(manual, { base: BASE });
    await seed(manual, { manual: true });
    await finishBlock(manual);
    const beforeGuided = await replicas(manual);
    await openReview(manual);
    await manual.locator('[data-review-action="schedule-repair"]').click();
    await manual.locator('[data-diag="fewer_days"]').click();
    await manual.locator("[data-diag-target]").fill("3");
    await manual.locator("[data-diag-continue]").click();
    await manual.locator("[data-flow-editor]").waitFor({ state: "visible", timeout: 15000 });
    const staged = await manual.evaluate(() => JSON.parse(localStorage.getItem("repforge_program_setup_draft_v1") || "null"));
    check(staged?.state?.route === "build" &&
      JSON.stringify(staged.state.result?.preview?.programDefinition) === JSON.stringify(beforeGuided.local.programMeta.programDefinition),
    "a Build program's fewer-days repair stages the live definition for guided editing");
    const afterGuided = await replicas(manual);
    check(JSON.stringify(afterGuided.local.programMeta) === JSON.stringify(beforeGuided.local.programMeta),
      "staging guided editing archives and replaces nothing");
    await manual.locator("[data-flow-editor]").click();
    await manual.locator("#onbProgramEditor").waitFor({ state: "visible", timeout: 15000 });
    check(true, "the staged draft opens in the program editor");
    await manualContext.close();

    check(errors.length === 0, "no page errors during the Review journeys", errors);
  } catch (error) {
    failures.push(String(error?.stack || error));
    console.error(error?.stack || error);
    if (errors.length) console.error(errors.join("\n"));
  } finally {
    await browser.close();
  }
  console.log(`\nP067 Review result: ${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

await main();
