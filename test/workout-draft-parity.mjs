#!/usr/bin/env node
import { selectExercise, openActions, exerciseAction, sessionField, finishEarly } from "./fixtures/focus-workout.mjs";
/**
 * Production-backed characterization for Plan 051's workout-draft boundary.
 *
 * The journey uses only controls visible in Focus, Session, or Exercise actions.
 * It records the current saved-row meaning while exercising the
 * same draft through repeat-last, completion, correction/uncommit, warm-up,
 * skip/restore, substitution, notes, metadata, reload, and save.
 *
 * Run: node test/workout-draft-parity.mjs
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const STATE_KEY = "repforge_v1";
const DRAFT_KEY = "repforge_draft_v1";
const SESSION_DATE = "2026-08-15";
const PREVIOUS_DATE = "2026-08-08";
const SESSION_NOTE = "Plan 051 parity session";
const EXERCISE_NOTE = "Rack 7, shoulder blades down.";

const results = { passed: 0, failed: 0 };
function assert(condition, name, detail = "") {
  if (condition) {
    results.passed++;
    console.log(`  ✓ ${name}`);
    return;
  }
  results.failed++;
  console.log(`  ✗ ${name}`);
  if (detail) console.log(`    ${detail}`);
}

async function waitForBoot(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(() => {
    window.closeFirstRun?.();
    const onboarding = document.querySelector("#onboarding");
    if (onboarding?.classList.contains("active")) window.closeOnboarding?.();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden")) window.closeTour?.();
    window.stopRest?.();
  });
}

async function writeState(page, state) {
  await page.evaluate(
    async ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("repforge", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("kv");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const transaction = db.transaction("kv", "readwrite");
        transaction.objectStore("kv").put(value, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
    },
    { key: STATE_KEY, value: state },
  );
}

async function reload(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForBoot(page);
}

const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";
const SUBSTITUTE = "Pin-loaded machine chest press";
const SUBSTITUTE_PRIMARY = "Chest";
const SUBSTITUTE_SECONDARY = "Triceps,Front delts";

/** The set's own values as the draft holds them: weight, reps (metric-backed), then RIR. */
async function setValues(page, exerciseId, ordinal) {
  return page.evaluate(({ exerciseId, ordinal, weight, reps }) => {
    const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[exerciseId];
    const setId = exercise?.setOrder?.find((id) => exercise.sets[id].ordinal === ordinal);
    const set = setId ? exercise.sets[setId] : null;
    return [set?.edited?.metrics?.[weight], set?.edited?.metrics?.[reps], set?.edited?.rir].map((value) => String(value ?? ""));
  }, { exerciseId, ordinal, weight: WEIGHT, reps: REPS });
}

/** The shelf's active fields on the current card: weight, reps, RIR. */
async function shelfValues(page) {
  return page.evaluate(({ weight, reps }) => {
    const shelf = document.querySelector("#workout .exercise.is-current .focus-shelf");
    return [
      shelf?.querySelector(`input[data-metric-id="${weight}"]`)?.value,
      shelf?.querySelector(`input[data-metric-id="${reps}"]`)?.value,
      shelf?.querySelector("input[data-k$='_rir']")?.value,
    ];
  }, { weight: WEIGHT, reps: REPS });
}

/** Type into the current card's shelf field the way a lifter does: tap the field, then type. */
async function fillShelf(page, field, value) {
  const metricId = field === "load" ? WEIGHT : field === "reps" ? REPS : null;
  const input = page.locator(metricId
    ? `#workout .exercise.is-current .focus-shelf input[data-metric-id="${metricId}"]`
    : "#workout .exercise.is-current .focus-shelf input[data-k$='_rir']");
  if (await input.getAttribute("aria-hidden") === "true") {
    await page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field="${metricId ? `metric_${metricId}` : "rir"}"]`).click();
  }
  await input.fill(String(value));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

async function logPreviousSession(page, exerciseId, sets) {
  await page.evaluate(() => window.__repforgeEnterWorkout({ day: "Day 1" }));
  await page.waitForSelector("#workoutShell:not(.hidden) #workout.is-focus", { timeout: 5000 });
  for (const [index, values] of sets.entries()) {
    await fillShelf(page, "load", values.load);
    await fillShelf(page, "reps", values.reps);
    await fillShelf(page, "rir", values.rir);
    await page.locator(`#workout .exercise.is-current [data-save="${exerciseId}_${index + 1}"]`).click();
    await page.waitForFunction(({ exerciseId, ordinal }) => {
      const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[exerciseId];
      const setId = exercise?.setOrder?.find((id) => exercise.sets[id].ordinal === ordinal);
      return exercise?.sets?.[setId]?.completion !== "pending";
    }, { exerciseId, ordinal: index + 1 });
  }
  const result = await finishEarly(page);
  await page.evaluate(() => window.__repforgeStorage.flush());
  await page.evaluate(() => window.closeSessionSummary?.());
  return result;
}

async function pickExactRow(page, name) {
  await page.fill("#exPickSearch", name);
  await page.waitForFunction((expected) => [...document.querySelectorAll("#exPickList .pickrow__name")]
    .some((candidate) => candidate.textContent?.trim() === expected), name, { timeout: 5000 });
  const picked = await page.evaluate((expected) => {
    const row = [...document.querySelectorAll("#exPickList .pickrow")].find(
      (candidate) => candidate.querySelector(".pickrow__name")?.textContent?.trim() === expected,
    );
    row?.click();
    return Boolean(row);
  }, name);
  await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
  return picked;
}

async function chooseSubstitute(page, exerciseId, name) {
  await exerciseAction(page, exerciseId, "#exActionSubstBtn");
  await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
  assert(await pickExactRow(page, name), "the visible substitution picker selects the exact library movement", name);
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

/** What a saved row means: the slot, the set, its values, and who performed it. Session ids, timestamps and loading provenance vary per run. */
const MEANING_KEYS = ["date", "day", "name", "exerciseId", "set", "load", "reps", "rir", "notes", "primary", "secondary",
  "performedName", "performedPrimary", "performedSecondary", "performedLibraryId", "performedMovementId", "exNote", "warmup", "bodyweight"];
function rowMeaning(rows) {
  return rows.map((row) => {
    const out = {};
    for (const key of MEANING_KEYS) if (row[key] !== undefined) out[key] = row[key];
    out.metricValues = Array.isArray(row.metricValues?.[0]) ? row.metricValues
      : (row.metricValues || []).map((value) => [value.metricId, value.value]);
    return out;
  });
}

async function main() {
  const browser = await launchChromium();
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  try {
    await page.clock.setFixedTime(new Date(`${PREVIOUS_DATE}T12:00:00.000Z`));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForBoot(page);

    const program = seedProgram();
    const [first, second, third, fourth] = program;
    const baseState = JSON.parse(await page.evaluate((key) => localStorage.getItem(key) || "{}", STATE_KEY));
    await writeState(page, {
      ...baseState,
      program,
      programMeta: seedProgramMeta(),
      log: [],
      settings: { ...baseState.settings, lang: "en", unit: "kg", rirMode: "numeric", restSec: 0 },
    });
    await page.evaluate((key) => localStorage.removeItem(key), DRAFT_KEY);
    await reload(page);

    // The previous session is logged through the product, so its history rows
    // carry the canonical metric values a later Repeat last reads back.
    const previous = await logPreviousSession(page, first.id, [
      { load: 50, reps: 10, rir: 2 },
      { load: 52.5, reps: 8, rir: 1 },
    ]);
    assert(previous?.committed === true, "the previous session is saved through the production finish", JSON.stringify(previous));
    await page.clock.setFixedTime(new Date(`${SESSION_DATE}T12:00:00.000Z`));
    await reload(page);

    console.log("\nFocus session: previous values, metadata, skip/restore, substitution, warm-up");
    await page.evaluate(() => window.__repforgeEnterWorkout({ day: "Day 1" }));
    await page.waitForSelector("#workoutShell:not(.hidden) #workout.is-focus", { timeout: 5000 });
    await exerciseAction(page, first.id, "#exActionRepeatBtn");

    const repeated = { first: await setValues(page, first.id, 1), second: await setValues(page, first.id, 2) };
    assert(
      JSON.stringify(repeated) === JSON.stringify({ first: ["50", "10", "2"], second: ["52.5", "8", "1"] }),
      "repeat-last copies the previous session's ordered set values",
      JSON.stringify(repeated),
    );

    // Pending sets the lifter has already filled keep the slot's prescription:
    // a substitution that would replace them is refused, and says so.
    await exerciseAction(page, first.id, "#exActionSubstBtn");
    await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
    await pickExactRow(page, SUBSTITUTE);
    await page.waitForFunction(() => /remaining sets/i.test(document.querySelector("#toast")?.textContent || ""));
    const refused = await page.evaluate((id) => window.__repforgeWorkoutDraft.current().exercises[id].substitution, first.id);
    assert(refused === null, "a substitution over filled pending sets is refused", JSON.stringify(refused));
    assert(JSON.stringify(await setValues(page, first.id, 1)) === JSON.stringify(["50", "10", "2"]),
      "a refused substitution leaves the copied values in place");

    await selectExercise(page, second.id);
    await fillShelf(page, "load", 35);
    await fillShelf(page, "reps", 12);
    await fillShelf(page, "rir", 2);
    await sessionField(page, "#sessionDate", SESSION_DATE);
    await sessionField(page, "#sessionBodyweight", 82.5);
    await sessionField(page, "#sessionNotes", SESSION_NOTE);
    await selectExercise(page, first.id);
    await page.locator("#woOverflowBtn").click();
    await page.locator("#exActionNotesBtn").click();
    await page.locator("#exNoteText").fill(EXERCISE_NOTE);
    await page.locator("#exNoteSave").click();
    await page.locator("#exNoteSheet").waitFor({state: "hidden"});
    await openActions(page, first.id);
    await page.locator("#exActionsWarmupList [data-warm-toggle-set]").nth(1).click();
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    await page.locator("#exActionsClose").click();
    await exerciseAction(page, second.id, "#exActionSkipBtn");
    await exerciseAction(page, second.id, "#exActionSkipBtn");
    const restoredSecond = await setValues(page, second.id, 1);
    assert(
      JSON.stringify(restoredSecond) === JSON.stringify(["35", "12", "2"]),
      "skip and restore retain the exercise subtree's edited values",
      JSON.stringify(restoredSecond),
    );

    await chooseSubstitute(page, third.id, SUBSTITUTE);
    await selectExercise(page, third.id);
    const substituted = await page.evaluate(() =>
      document.querySelector("#workout .exercise.is-current .focus-ex__name")?.textContent?.trim());
    assert(substituted?.includes(SUBSTITUTE), "Focus projects the substitution on its card", substituted);
    await fillShelf(page, "load", 40);
    await fillShelf(page, "reps", 9);
    await fillShelf(page, "rir", 3);
    await page.locator(`.exercise[data-ex="${third.id}"] [data-save="${third.id}_1"]`).click();
    await page.waitForFunction(({ id }) => {
      const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
      return exercise && exercise.sets[exercise.setOrder[0]].completion !== "pending";
    }, { id: third.id });
    await exerciseAction(page, fourth.id, "#exActionSkipBtn");
    await selectExercise(page, first.id);
    await page.locator(`.exercise[data-ex="${first.id}"] [data-save="${first.id}_1"]`).click();
    await page.waitForFunction(({ id }) => {
      const draft = window.__repforgeWorkoutDraft.current();
      const exercise = draft?.exercises?.[id];
      return exercise && exercise.sets[exercise.setOrder[0]].completion !== "pending";
    }, { id: first.id });
    assert(
      await page.locator(`#workout .exercise.is-current [data-editn="1"]`).count() === 1,
      "Focus completion commits the programmed set",
    );

    console.log("\nFocus projection: correction, uncommit, recommit, ordered next set");

    await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 5000 });
    const focusFirst = await page.evaluate(() => {
      const card = document.querySelector("#workout .exercise.is-current");
      return {
        name: card?.querySelector(".focus-ex__name")?.textContent?.trim(),
        completed: card?.querySelectorAll(".ledgerline[data-editn]").length,
      };
    });
    const focusFirstActive = await shelfValues(page);
    assert(
      focusFirst.name?.includes(first.name) && focusFirst.completed === 1 &&
        JSON.stringify(focusFirstActive) === JSON.stringify(["52.5", "8", "1"]),
      "Focus projects the committed row and the next ordered copied set",
      JSON.stringify({ ...focusFirst, active: focusFirstActive }),
    );
    const committedRow = await page.locator("#workout .exercise.is-current .ledgerline[data-editn] .ledgerline__vals").innerText();
    assert(committedRow.replace(/\s+/g, " ").trim() === "50 10 2",
      "the committed ledger row reads back the set's logged weight, reps and RIR", committedRow);

    await page.locator("#workout .exercise.is-current .ledgerline[data-editn]").click();
    await page.waitForFunction(({ id }) => {
      const draft = window.__repforgeWorkoutDraft.current();
      const exercise = draft?.exercises?.[id];
      return window.__repforgeFocus.editing()?.exId === id &&
        exercise?.sets?.[exercise.setOrder[0]]?.completion === "pending";
    }, { id: first.id });
    await fillShelf(page, "load", 55);
    await page.waitForFunction(({ id, weight }) => {
      const draft = window.__repforgeWorkoutDraft.current();
      const exercise = draft?.exercises?.[id];
      return exercise?.sets?.[exercise.setOrder[0]]?.edited?.metrics?.[weight] === "55";
    }, { id: first.id, weight: WEIGHT });
    await page.locator("#workout .exercise.is-current .focus-shelf .saveset").click();
    await page.waitForFunction(({ id }) => {
      const draft = window.__repforgeWorkoutDraft.current();
      const exercise = draft?.exercises?.[id];
      return window.__repforgeFocus.editing() === null &&
        exercise?.sets?.[exercise.setOrder[0]]?.completion !== "pending";
    }, { id: first.id });
    const corrected = await page.locator("#workout .exercise.is-current .ledgerline[data-editn] .ledgerline__vals > .fx-col:first-child").textContent();
    assert(corrected?.trim() === "55", "Focus correction updates the committed set in place", corrected || "missing row");

    await page.waitForSelector("#workout.is-focus", { timeout: 5000 });
    await page.locator(`#workout .exercise.is-current [data-editn="1"]`).click();
    await page.waitForFunction(({ id }) => {
      const draft = window.__repforgeWorkoutDraft.current();
      const exercise = draft?.exercises?.[id];
      return exercise && exercise.sets[exercise.setOrder[0]].completion === "pending";
    }, { id: first.id });
    const pendingAgain = {
      completed: await page.locator("#workout .exercise.is-current .ledgerline[data-editn]").count(),
      active: await shelfValues(page),
    };
    assert(
      pendingAgain.completed === 0 && JSON.stringify(pendingAgain.active) === JSON.stringify(["55", "10", "2"]),
      "Focus uncommit retains the corrected values and projects the set as the next ordered set",
      JSON.stringify(pendingAgain),
    );
    await page.locator("#workout .exercise.is-current .focus-shelf .saveset").click();
    await page.waitForFunction(({ id }) => {
      const draft = window.__repforgeWorkoutDraft.current();
      const exercise = draft?.exercises?.[id];
      return exercise && exercise.sets[exercise.setOrder[0]].completion !== "pending";
    }, { id: first.id });

    console.log("\nPersistence: reload the same aggregate and save its current history meaning");
    const rawBeforeReload = await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY);
    assert(typeof rawBeforeReload === "string" && rawBeforeReload.length > 0, "the active workout is persisted before reload");
    await reload(page);
    await page.evaluate(() => window.__repforgeEnterWorkout({}));
    await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 5000 });
    const cardState = async (id) => {
      await page.evaluate((id) => window.__repforgeFocus.to(window.__repforgeFocus.list().findIndex((exercise) => exercise.id === id)), id);
      await page.waitForSelector(`#workout .exercise.is-current[data-ex="${id}"]`, { timeout: 5000 });
      return {
        name: await page.locator("#workout .exercise.is-current .focus-ex__name").textContent(),
        completed: await page.locator("#workout .exercise.is-current .ledgerline[data-editn]").count(),
        active: await shelfValues(page),
      };
    };
    const firstState = await cardState(first.id);
    const thirdState = await cardState(third.id);
    const secondState = await cardState(second.id);
    const afterReload = await page.evaluate(() => ({
      visibleIds: window.__repforgeFocus.list().map((exercise) => exercise.id),
      date: document.querySelector("#sessionDate")?.value,
      bodyweight: document.querySelector("#sessionBodyweight")?.value,
      sessionNotes: document.querySelector("#sessionNotes")?.value,
    }));
    assert(
      firstState.completed === 1 && firstState.active[0] === "52.5" &&
        thirdState.name?.includes(SUBSTITUTE) && thirdState.completed === 1,
      "reload restores completion, substitution, correction, and warm-up ordering",
      JSON.stringify({ firstState, thirdState }),
    );
    assert(
      JSON.stringify(secondState.active) === JSON.stringify(["35", "12", "2"]) &&
        !afterReload.visibleIds.includes(fourth.id),
      "reload restores touched values and keeps the skipped exercise out of Focus",
      JSON.stringify({ secondState, afterReload }),
    );
    assert(
      afterReload.date === SESSION_DATE && afterReload.bodyweight === "82.5" && afterReload.sessionNotes === SESSION_NOTE,
      "reload restores session date, bodyweight, and notes",
      JSON.stringify(afterReload),
    );

    const beforeRows = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).log, STATE_KEY);
    const sessionsBefore = new Set(beforeRows.map((row) => row.session));
    // The fixture intentionally preserves skipped/incomplete exercises; save
    // it through the product's explicit early-finish confirmation UI.
    const saveResult = await finishEarly(page);
    await page.evaluate(() => window.__repforgeStorage.flush());
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STATE_KEY);
    const sessionId = [...new Set(saved.log.map((row) => row.session))].find((id) => !sessionsBefore.has(id));
    const actualRows = rowMeaning(saved.log.filter((row) => row.session === sessionId));
    const substitute = await page.evaluate((name) => {
      const entry = window.RepForgeExerciseCatalog.snapshot().exercises.find((exercise) => exercise.name === name);
      return entry ? { id: entry.id } : null;
    }, SUBSTITUTE);
    const slot = (exercise) => ({ date: SESSION_DATE, day: exercise.day, name: exercise.name, exerciseId: exercise.id });
    const performedAsProgrammed = (exercise) => ({
      performedName: exercise.name, performedPrimary: exercise.primary, performedSecondary: exercise.secondary,
      performedLibraryId: exercise.libraryId,
    });
    const values = (load, reps) => [[WEIGHT, load], [REPS, reps]];
    const expectedRows = [
      { ...slot(first), set: 1, load: 55, reps: 10, rir: 2, notes: SESSION_NOTE, primary: first.primary, secondary: first.secondary,
        ...performedAsProgrammed(first), exNote: EXERCISE_NOTE, bodyweight: 82.5, metricValues: values(55, 10) },
      { ...slot(first), set: 2, load: 52.5, reps: 8, rir: 1, notes: SESSION_NOTE, primary: first.primary, secondary: first.secondary,
        ...performedAsProgrammed(first), exNote: EXERCISE_NOTE, warmup: true, bodyweight: 82.5, metricValues: values(52.5, 8) },
      { ...slot(second), set: 1, load: 35, reps: 12, rir: 2, notes: SESSION_NOTE, primary: second.primary, secondary: second.secondary,
        ...performedAsProgrammed(second), bodyweight: 82.5, metricValues: values(35, 12) },
      { ...slot(third), set: 1, load: 40, reps: 9, rir: 3, notes: SESSION_NOTE, primary: third.primary, secondary: third.secondary,
        performedName: SUBSTITUTE, performedPrimary: SUBSTITUTE_PRIMARY, performedSecondary: SUBSTITUTE_SECONDARY,
        performedLibraryId: substitute?.id, bodyweight: 82.5, metricValues: values(40, 9) },
    ];
    assert(saveResult?.localOk || saveResult?.idbOk, "the production save transaction accepts the characterized draft", JSON.stringify(saveResult));
    assert(
      JSON.stringify(actualRows) === JSON.stringify(rowMeaning(expectedRows)),
      "history rows preserve exact current completion/touch/warm-up and substitution provenance semantics",
      `actual=${JSON.stringify(actualRows)} expected=${JSON.stringify(rowMeaning(expectedRows))}`,
    );
    assert(
      actualRows.some((row) => row.exerciseId === second.id) &&
        !actualRows.some((row) => row.exerciseId === fourth.id) &&
        (await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY)) === null,
      "touched incomplete work is saved, skipped work is omitted, and the committed draft is removed",
      JSON.stringify(actualRows),
    );
    assert(
      await page.locator("#sessionSummary:not(.hidden)").count(),
      "the characterized save still opens the production session summary",
    );

    console.log("\nAd hoc substitution: performed identity changes without losing slot muscle provenance");
    await page.evaluate(() => window.closeSessionSummary?.());
    await page.evaluate(() => window.__repforgeEnterWorkout({day: "Day 1" }));
    await page.waitForSelector("#workoutShell:not(.hidden) #workout.is-focus", { timeout: 5000 });
    const adHocResult = await page.evaluate(async ({ exerciseId, primary, secondary }) => {
      return window.__repforgeWorkoutDraft.dispatch("substituteExercise", {
        exerciseInstanceId: exerciseId,
        replacement: {
          exerciseInstanceId: `replacement:${exerciseId}`,
          sourceExerciseId: "adhoc:tempo-pause-press",
          movementId: "adhoc:tempo-pause-press",
          displayName: "Tempo pause press",
          primary,
          secondary,
        },
        selectedAt: new Date().toISOString(),
      });
    }, { exerciseId: first.id, primary: first.primary, secondary: first.secondary });
    assert(adHocResult?.status === "applied", "the production draft adapter accepts an ad hoc substitution", JSON.stringify(adHocResult));
    await selectExercise(page, first.id);
    await fillShelf(page, "load", 61);
    await fillShelf(page, "reps", 6);
    await fillShelf(page, "rir", 1);
    await page.locator(`.exercise[data-ex="${first.id}"] [data-save="${first.id}_1"]`).click();
    const sessionsBeforeAdHoc = new Set((await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).log, STATE_KEY))
      .map((row) => row.session));
    const adHocSave = await finishEarly(page);
    await page.evaluate(() => window.__repforgeStorage.flush());
    const adHocRows = await page.evaluate(({ key, knownSessions }) => {
      const log = JSON.parse(localStorage.getItem(key)).log;
      const session = [...new Set(log.map((row) => row.session))].find((id) => !knownSessions.includes(id));
      return log.filter((row) => row.session === session);
    }, { key: STATE_KEY, knownSessions: [...sessionsBeforeAdHoc] });
    const adHocRow = adHocRows[0];
    assert(adHocSave?.localOk || adHocSave?.idbOk, "the ad hoc workout saves through the production transaction", JSON.stringify(adHocSave));
    assert(adHocRows.length === 1 && adHocRow.exerciseId === first.id && adHocRow.name === first.name &&
      adHocRow.primary === first.primary && adHocRow.secondary === first.secondary &&
      adHocRow.performedName === "Tempo pause press" && adHocRow.performedMovementId === "adhoc:tempo-pause-press" &&
      adHocRow.performedPrimary === first.primary && adHocRow.performedSecondary === first.secondary &&
      adHocRow.load === 61 && adHocRow.reps === 6,
    "ad hoc History preserves the programmed slot and original muscle meaning while recording performed identity",
    JSON.stringify(adHocRows));
    assert(errors.length === 0, "the parity journey emits no page or console errors", errors.join(" | "));
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(`\n${results.passed} passed, ${results.failed} failed`);
  if (results.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
