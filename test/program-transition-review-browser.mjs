#!/usr/bin/env node
/**
 * Plan 067 block-end Review transitions through the production UI.
 *
 * A generated program reaches the end of its block; each Review change
 * (reduce volume, fewer days, recovery week) is previewed, confirmed by its
 * proposal hash, and committed as a new block whose ProgramDefinition is the
 * derived successor. A set-count edit made in the installed program editor
 * leaves every later change confirmable (#344), and survives a fewer-days
 * regeneration, named in the preview and present in the committed
 * successor. Each successor's program structure names its own training
 * days, so the installed editor lists them and saves an edit after a
 * fewer-days or shorter-sessions regeneration; an install whose successor
 * already kept a stale day list heals on load (#388). An install whose
 * durable rows already carry the editor's
 * leaked prescription copy still confirms a change without a reset. A
 * proposal made stale by another tab is refused with the
 * program unchanged, and a Build program's schedule repair stages guided
 * editing instead of regenerating. The fewer-days regeneration runs in the
 * program engine's worker (#353).
 */
import { readFileSync } from "node:fs";
import { SHEET, applyInstalledEditor, cancelInstalledEditor, closeEditorSheet, editorSettled, openExerciseSheet, openInstalledEditor, sheetTap, showEditorDay } from "./fixtures/installed-editor.mjs";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const DATA = new URL("../plans/067/data/", import.meta.url);
const gym = JSON.parse(readFileSync(new URL("gym.json", DATA), "utf8"));
const observations = JSON.parse(readFileSync(new URL("programs.json", DATA), "utf8"));
const catalog = JSON.parse(readFileSync(new URL("app_file.json", DATA), "utf8"));
const EN = JSON.parse(readFileSync(new URL("../i18n-en.json", import.meta.url), "utf8"));
const PT = JSON.parse(readFileSync(new URL("../i18n-pt.json", import.meta.url), "utf8"));
const ptDayName = (name) => PT[Object.keys(EN).find((key) => key.startsWith("program.split_day.") && EN[key] === name)];
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
  preferredExerciseIds: [], split: "auto", periodization: "static", cycles: 7, deloadCycles: [],
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

// Program → Edit → the first exercise's sheet → Weeks → the current week's
// `+` → Apply, through the production editor (Plan 074). Returns the slot and
// its set count for the week the edit was made in.
async function addSetInEditor(page) {
  if (await page.locator("#settings.view.active").count()) await page.locator("#settingsBack").click();
  await page.locator('nav button[data-view="program"]').click();
  await page.locator("#program.view.active").waitFor({ state: "visible" });
  await openInstalledEditor(page);
  // A regenerated week can list empty days first: use the first day with a row.
  let rowId = null;
  for (const tab of await page.locator('#programEditor [data-role="day-tab"]').all()) {
    await tab.click();
    rowId = await page.locator('#programEditor [data-role="exercise-row"]').first().getAttribute("data-id").catch(() => null);
    if (rowId) break;
  }
  if (!rowId) throw new Error("the installed editor shows no exercise");
  const cycleIndex = await page.evaluate(() => window.__repforgeMesocycleWeek?.()?.current || 1);
  const before = await page.evaluate(({ id, cycle }) => {
    const definition = window.__repforgeWorkoutDraft.state().programMeta.programDefinition;
    const row = window.__repforgeWorkoutDraft.state().program.find((entry) => entry.id === id);
    const slot = definition.days.flatMap((day) => day.slots || []).find((candidate) => candidate.id === (row?.slotId || id));
    return slot?.prescriptionsByCycle.find((entry) => entry.cycleIndex === cycle)?.sets.length;
  }, { id: rowId, cycle: cycleIndex });
  await openExerciseSheet(page, rowId);
  await page.locator(`${SHEET} [data-role="weeks-open"]`).click();
  await page.locator(`${SHEET} [data-role="week-row"][data-cycle-index="${cycleIndex}"]`).click();
  await sheetTap(page, `[data-role="week-sets"][data-cycle-index="${cycleIndex}"][data-delta="1"]`);
  await closeEditorSheet(page);
  await page.locator("#programEditDone").click();
  // Apply either saves and closes the editor or keeps it open with an error.
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden") ||
    /Fix the highlighted values/.test(document.querySelector("#programEditorWrap")?.innerText || ""));
  if (!await page.evaluate(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden")))
    throw new Error("the installed editor refused Apply: Fix the highlighted values before continuing.");
  await flush(page);
  const row = (await state(page)).program.find((entry) => entry.id === rowId);
  return { slotId: row.slotId || row.id, movement: row.name, cycleIndex, sets: before + 1 };
}

// Program → Edit lists exactly the active definition's training days, in
// order, each with its exercises (#388).
async function checkEditorDays(page, label) {
  if (await page.locator("#settings.view.active").count()) await page.locator("#settingsBack").click();
  await page.locator('nav button[data-view="program"]').click();
  await page.locator("#program.view.active").waitFor({ state: "visible" });
  await openInstalledEditor(page);
  const shown = [];
  for (const tab of await page.locator('#programEditor [data-role="day-tab"]').all()) {
    await tab.click();
    shown.push({ day: await tab.getAttribute("data-day"), exercises: await page.locator('#programEditor [data-role="exercise-row"]').count() });
  }
  const want = training((await state(page)).programMeta.programDefinition).map((day) => day.name);
  check(JSON.stringify(shown.map((entry) => entry.day)) === JSON.stringify(want) && shown.every((entry) => entry.exercises > 0),
    `${label}: the installed editor shows the new block's days, each with its exercises`, { want, shown });
  await cancelInstalledEditor(page);
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"));
}

// A programStructure, where present, names the definition's training days.
function checkStructure(snapshots, label) {
  const mismatched = snapshots.map((snapshot) => {
    const days = snapshot?.programMeta?.programStructure?.days;
    const want = training(snapshot.programMeta.programDefinition).map((day) => day.name);
    const have = Array.isArray(days) ? days.map((entry) => entry.label || entry.dayId) : want;
    return JSON.stringify(have) === JSON.stringify(want) ? null : { want, have };
  }).filter(Boolean);
  check(mismatched.length === 0, `${label}: the program structure names the definition's training days`, mismatched);
}

// The edit is in the activated definition and in both durable replicas.
async function checkEditorEdit(page, { slotId, cycleIndex, sets }, label) {
  const live = await state(page), durable = await replicas(page);
  const setsIn = (snapshot) => slots(snapshot.programMeta.programDefinition).find((slot) => slot.id === slotId)
    ?.prescriptionsByCycle.find((cycle) => cycle.cycleIndex === cycleIndex)?.sets.length;
  check(setsIn(live) === sets && setsIn(durable.local) === sets && setsIn(durable.idb) === sets,
    `${label}: the editor's extra set is in the active definition and both durable replicas`,
    { want: sets, live: setsIn(live), local: setsIn(durable.local), idb: setsIn(durable.idb) });
  check([durable.local, durable.idb].every((snapshot) => snapshot.program.every((row) => !("prescriptionsByCycle" in row))),
    `${label}: the durable program rows keep the canonical row shape`);
}

async function freshPage(browser, errors, { locale } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...(locale ? { locale } : {}) });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  now = Date.parse("2026-03-02T09:00:00.000Z");
  await page.clock.setFixedTime(new Date(now));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  return { context, page };
}

async function seed(page, { manual = false, request = REQUEST } = {}) {
  const result = await page.evaluate(async ({ request, manual }) => {
    const catalogSnapshot = window.RepForgeExerciseCatalog.snapshot();
    const generated = window.RepForgeProgramCompiler.generateProgram(request, catalogSnapshot);
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
  }, { request, manual });
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
  checkStructure([after, durable.local, durable.idb], label);
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

    // Reduce volume after an installed-editor set edit (#344) --------------
    await checkEditorEdit(page, await addSetInEditor(page), "reduce volume");

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
    // Through the installed editor, which must leave the later Review
    // confirmation current (#344).
    const daysEdit = await addSetInEditor(page);
    await checkEditorEdit(page, daysEdit, "fewer days");
    const { movement, cycleIndex: editedWeek } = daysEdit;
    const setsBeforeEdit = daysEdit.sets - 1;
    const editedSlot = slots(afterVolume.programMeta.programDefinition).find((slot) => slot.id === daysEdit.slotId);

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
    // #353: the regeneration behind the preview ran in the worker.
    const engineRuns = await page.evaluate(() => window.__repforgeProgramEngine?.stats());
    check(engineRuns?.mode === "worker" && engineRuns.worker >= 2 && engineRuns.main === 0,
      "the fewer-days regeneration runs in the worker, not on the main thread", engineRuns);
    const beforeDays = await confirmPreview(page, { title: "Proposed plan" });
    const afterDays = await state(page);
    checkCommitted(beforeDays, afterDays, await replicas(page), "fewer days");
    check(training(afterDays.programMeta.programDefinition).length === 3 &&
      afterDays.programMeta.programDefinition.request.daysPerWeek === 3 && afterDays.programMeta.daysPerWeek === 3,
    "the regenerated successor trains three days a week");
    const carriedSlot = slots(afterDays.programMeta.programDefinition).find((slot) => slot.exerciseId === editedSlot.exerciseId);
    check(carriedSlot?.prescriptionsByCycle[editedWeek - 1].sets.length === setsBeforeEdit + 1,
      "the committed successor holds the set count the preview showed",
      carriedSlot?.prescriptionsByCycle.map((cycle) => cycle.sets.length));
    // The regenerated successor stays editable (#388).
    await checkEditorDays(page, "fewer days successor");
    await checkEditorEdit(page, await addSetInEditor(page), "fewer days successor");

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
    await other.locator('#unitSegments [data-value="lb"]').click();
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

    // Recovery week after an installed-editor set edit (#344) -------------
    // A fresh block: a regenerated successor's editor is out of this proof.
    const { context: recoveryContext, page: recoveryPage } = await freshPage(browser, errors);
    await seed(recoveryPage);
    await checkEditorEdit(recoveryPage, await addSetInEditor(recoveryPage), "recovery week");
    await finishBlock(recoveryPage);
    await openReview(recoveryPage);
    await recoveryPage.locator('[data-review-action="recovery-week"]').click();
    await recoveryPage.locator('[data-recovery-answer="Yes"]').click();
    const beforeEditedRecovery = await confirmPreview(recoveryPage, { title: "Recovery week preview" });
    checkCommitted(beforeEditedRecovery, await state(recoveryPage), await replicas(recoveryPage), "recovery week after an edit");
    await recoveryContext.close();

    // Shorter sessions after an installed-editor set edit (#388) ---------
    const { context: shorterContext, page: shorter } = await freshPage(browser, errors);
    await seed(shorter);
    await checkEditorEdit(shorter, await addSetInEditor(shorter), "shorter sessions");
    await finishBlock(shorter);
    await openReview(shorter);
    await shorter.locator('[data-review-action="schedule-repair"]').click();
    await shorter.locator('[data-diag="sessions_too_long"]').click();
    await shorter.locator("[data-diag-target]").fill("45");
    await shorter.locator("[data-diag-continue]").click();
    const beforeShorter = await confirmPreview(shorter, { title: "Proposed plan" });
    const afterShorter = await state(shorter);
    checkCommitted(beforeShorter, afterShorter, await replicas(shorter), "shorter sessions");
    check(afterShorter.programMeta.programDefinition.request.timeCeilingMinutes <= 45,
      "the regenerated successor fits 45-minute sessions", afterShorter.programMeta.programDefinition.request);
    await checkEditorDays(shorter, "shorter sessions successor");
    await checkEditorEdit(shorter, await addSetInEditor(shorter), "shorter sessions successor");
    await shorterContext.close();

    // An install whose successor already kept a stale structure (#388) ----
    // Before the fix a fewer-days successor kept the predecessor's
    // four-day programStructure beside its three-day definition. Loading
    // heals it, and the next edit saves the healed structure.
    const { context: staleContext, page: stale } = await freshPage(browser, errors);
    await seed(stale, { request: { ...REQUEST, daysPerWeek: 3 } });
    const planted = await stale.evaluate(async () => {
      const plant = (snapshot) => {
        snapshot.programMeta.programStructure = { ...(snapshot.programMeta.programStructure || {}), schemaVersion: 1,
          days: ["Upper A", "Lower A", "Upper B", "Lower B"].map((label, index) =>
            ({ dayId: `manual_d${index + 1}`, label, order: index + 1 })) };
        return snapshot;
      };
      localStorage.setItem("repforge_v1", JSON.stringify(plant(JSON.parse(localStorage.getItem("repforge_v1")))));
      return new Promise((resolve) => {
        const open = indexedDB.open("repforge");
        open.onerror = () => resolve(false);
        open.onsuccess = () => {
          const store = open.result.transaction("kv", "readwrite").objectStore("kv");
          const read = store.get("repforge_v1");
          read.onsuccess = () => {
            const raw = read.result, parsed = plant(typeof raw === "string" ? JSON.parse(raw) : raw);
            const write = store.put(typeof raw === "string" ? JSON.stringify(parsed) : parsed, "repforge_v1");
            write.onsuccess = () => { open.result.close(); resolve(true); };
            write.onerror = () => { open.result.close(); resolve(false); };
          };
          read.onerror = () => { open.result.close(); resolve(false); };
        };
      });
    });
    const staleDurable = await replicas(stale);
    check(planted && [staleDurable.local, staleDurable.idb].every((snapshot) =>
      snapshot.programMeta.programStructure.days.length === 4 && training(snapshot.programMeta.programDefinition).length === 3),
    "stale install: both durable replicas hold a four-day structure beside a three-day definition");
    await stale.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(stale, { base: BASE });
    checkStructure([await state(stale)], "stale install after loading");
    await checkEditorDays(stale, "stale install");
    await checkEditorEdit(stale, await addSetInEditor(stale), "stale install");
    const healed = await replicas(stale);
    checkStructure([healed.local, healed.idb], "stale install after the next edit");
    await staleContext.close();

    // Durable rows that already carry the editor's leaked copy (#344) -----
    // An older build persisted the editor's per-row prescriptionsByCycle;
    // such an install must confirm a Review change without a reset.
    const { context: legacyContext, page: legacy } = await freshPage(browser, errors);
    await seed(legacy);
    const leaked = await legacy.evaluate(async () => {
      const leak = (snapshot) => {
        const byId = new Map(snapshot.programMeta.programDefinition.days.flatMap((day) => day.slots || [])
          .map((slot) => [slot.id, slot]));
        for (const row of snapshot.program)
          row.prescriptionsByCycle = structuredClone(byId.get(row.slotId || row.id)?.prescriptionsByCycle || []);
        return snapshot;
      };
      const local = leak(JSON.parse(localStorage.getItem("repforge_v1")));
      localStorage.setItem("repforge_v1", JSON.stringify(local));
      return new Promise((resolve) => {
        const open = indexedDB.open("repforge");
        open.onerror = () => resolve(false);
        open.onsuccess = () => {
          const store = open.result.transaction("kv", "readwrite").objectStore("kv");
          const read = store.get("repforge_v1");
          read.onsuccess = () => {
            const raw = read.result, parsed = leak(typeof raw === "string" ? JSON.parse(raw) : raw);
            const write = store.put(typeof raw === "string" ? JSON.stringify(parsed) : parsed, "repforge_v1");
            write.onsuccess = () => { open.result.close(); resolve(true); };
            write.onerror = () => { open.result.close(); resolve(false); };
          };
          read.onerror = () => { open.result.close(); resolve(false); };
        };
      });
    });
    await finishBlock(legacy);
    const seededLegacy = await replicas(legacy);
    check(leaked && [seededLegacy.local, seededLegacy.idb].every((snapshot) =>
      snapshot.program.length > 0 && snapshot.program.every((row) => Array.isArray(row.prescriptionsByCycle))),
    "legacy install: both durable replicas carry the leaked per-row prescriptions");
    await openReview(legacy);
    await legacy.locator('[data-review-action="reduce-volume"]').click();
    await legacy.locator("[data-volume-confirm]").click();
    const beforeLegacy = await confirmPreview(legacy, { title: "Proposed plan" });
    const afterLegacy = await state(legacy);
    const legacyDurable = await replicas(legacy);
    checkCommitted(beforeLegacy, afterLegacy, legacyDurable, "legacy install");
    check([legacyDurable.local, legacyDurable.idb].every((snapshot) => snapshot.program.every((row) => !("prescriptionsByCycle" in row))),
      "legacy install: the successor's durable rows keep the canonical row shape");
    await legacyContext.close();

    // Generated day names in the app language (#401) -----------------------
    // A Portuguese device reads the generated day names in Portuguese in the
    // preview, a day the lifter renamed reads exactly as typed, and storage
    // and the confirmed proposal keep the language-independent names.
    const { context: ptContext, page: pt } = await freshPage(browser, errors, { locale: "pt-BR" });
    await seed(pt);
    await pt.locator('nav button[data-view="program"]').click();
    await pt.locator("#program.view.active").waitFor({ state: "visible" });
    await openInstalledEditor(pt);
    const RENAMED = "Meu dia de puxar";
    const secondDay = await pt.locator('#programEditor [data-role="day-tab"]').nth(1).getAttribute("data-day");
    await showEditorDay(pt, secondDay);
    await pt.locator(`#programEditor [data-role="day-name-edit"][data-day="${secondDay}"]`).click();
    const renamedField = pt.locator(`${SHEET}.is-open [data-role="rename-input"]`);
    await renamedField.fill(RENAMED);
    await renamedField.press("Enter");
    await pt.waitForSelector(SHEET, { state: "hidden", timeout: 5000 });
    await editorSettled(pt);
    await applyInstalledEditor(pt);
    await flush(pt);
    const ptBefore = training((await state(pt)).programMeta.programDefinition);
    check(ptBefore[1]?.name === RENAMED && ptBefore.filter((_, index) => index !== 1).every((day) => ptDayName(day.name)),
      "Portuguese install: the renamed day stores the typed name and the other days keep the generated names",
      ptBefore.map((day) => day.name));
    await finishBlock(pt);
    await openReview(pt);
    await pt.locator('[data-review-action="schedule-repair"]').click();
    await pt.locator('[data-diag="fewer_days"]').click();
    await pt.locator("[data-diag-target]").fill("3");
    await pt.locator("[data-diag-continue]").click();
    await pt.locator("[data-preview-confirm]").waitFor({ state: "visible", timeout: 15000 });
    const ptProposal = (await pt.evaluate(() => window.__repforgeProgressReview.flow())).proposal;
    const ptAfter = training(ptProposal.successor.programDefinition);
    check(ptAfter.every((day) => ptDayName(day.name)), "the proposed successor stores the generated English day names",
      ptAfter.map((day) => day.name));
    const shownName = (day) => ptDayName(day.name) || day.name;
    const wantDayLines = [];
    for (let index = 0; index < Math.max(ptBefore.length, ptAfter.length); index++) {
      const was = ptBefore[index], now = ptAfter[index];
      if (was && now && was.name === now.name && was.slots.length === now.slots.length) continue;
      wantDayLines.push(PT["review.preview.day_change"]
        .replace("{before}", was ? `${shownName(was)} · ${was.slots.length}` : "—")
        .replace("{after}", now ? `${shownName(now)} · ${now.slots.length}` : "—"));
    }
    const dayPrefix = PT["review.preview.day_change"].split("{before}")[0];
    const shownDayLines = (await pt.locator("#reviewPanel .review__diff li").allInnerTexts())
      .map((line) => line.trim()).filter((line) => line.startsWith(dayPrefix));
    check(JSON.stringify(shownDayLines) === JSON.stringify(wantDayLines),
      "the Portuguese preview names generated days in Portuguese and the renamed day exactly as typed",
      { want: wantDayLines, shown: shownDayLines });
    check(shownDayLines.some((line) => line.includes(`${RENAMED} · `)) &&
      !shownDayLines.some((line) => ptBefore.concat(ptAfter).some((day) => day.name !== RENAMED && line.includes(day.name))),
    "no preview day line shows a stored English generated name", shownDayLines);
    const ptConfirmed = await confirmPreview(pt, { title: PT["review.preview.title"] });
    const ptCommitted = await state(pt);
    const ptRecord = ptCommitted.programMeta.transitionIn;
    check(ptRecord?.proposalHash === ptProposal.proposalHash &&
      ptRecord?.successor?.definitionFingerprint === ptProposal.successor.definitionFingerprint &&
      ptRecord?.predecessor?.definitionFingerprint === ptProposal.predecessor.definitionFingerprint,
    "the confirmed transition carries the previewed proposal hash and fingerprints unchanged",
    { record: ptRecord, proposal: { hash: ptProposal.proposalHash, successor: ptProposal.successor.definitionFingerprint } });
    check(JSON.stringify(ptCommitted.programMeta.programDefinition) === JSON.stringify(ptProposal.successor.programDefinition) &&
      JSON.stringify(training(ptConfirmed.programMeta.programDefinition).map((day) => day.name)) ===
        JSON.stringify(ptBefore.map((day) => day.name)),
    "the stored day names are the language-independent names the proposal carried");
    await ptContext.close();

    // A Build program's schedule repair stages guided editing -------------
    const { context: manualContext, page: manual } = await freshPage(browser, errors);
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
