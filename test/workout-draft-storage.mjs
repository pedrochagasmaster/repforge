#!/usr/bin/env node
import { exerciseAction, finishEarly, sessionField } from "./fixtures/focus-workout.mjs";
/**
 * Production storage/DOM gate for Plan 051's first DraftV2 vertical slice.
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const STATE = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const CHECKPOINT = `${DRAFT}:v2-checkpoint`;
const RECOVERY = `${DRAFT}:recovery`;
const OLD_APP_SHA = "3fbae92fcee58c0d72539b9f4e2c270a9d60dbd4";
// An installed older version runs its own shell with every module it loads from
// its own release (its cache holds them), so the legacy writer is served that
// commit's files: the current modules are not API-compatible with its app.js.
const OLD_FILES = new Map();
function oldFile(path) {
  if (!OLD_FILES.has(path)) {
    let bytes = null;
    try { bytes = execFileSync("git", ["show", `${OLD_APP_SHA}:${path}`], { maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] }); }
    catch {}
    OLD_FILES.set(path, bytes);
  }
  return OLD_FILES.get(path);
}
// The released app logs against the legacy flat program it shipped with (its own
// seed fixture, no canonical ProgramDefinition). The current app still binds
// DraftV2 to such a program, so cross-version writer races share one program.
const LEGACY = await import(`data:text/javascript;base64,${oldFile("test/fixtures/seed-program.mjs").toString("base64")}`);
const OLD_TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };
// The seed program's movements record catalog metrics: Weight (kg) and Reps.
const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";
const METRIC_OF = { load: WEIGHT, reps: REPS };
const KEY_SUFFIX = { load: `_metric_${WEIGHT}`, reps: `_metric_${REPS}`, rir: "_rir" };
const SHELF_FIELD = { load: `metric_${WEIGHT}`, reps: `metric_${REPS}`, rir: "rir" };
// A generated program carries adaptive recommendations once it has history;
// the untouched-suggestion refresh only has work to do for such a program.
const PLAN_DATA = new URL("../plans/067/data/", import.meta.url);
const gym = JSON.parse(readFileSync(new URL("gym.json", PLAN_DATA), "utf8"));
const observations = JSON.parse(readFileSync(new URL("programs.json", PLAN_DATA), "utf8"));
const rawCatalog = JSON.parse(readFileSync(new URL("app_file.json", PLAN_DATA), "utf8"));
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
    [id, [...rawCatalog.exercises.find((entry) => entry.id === id).preconditions]])),
  emphasisMuscleIds: [], deprioritizedMuscleIds: [], excludedExerciseIds: [], excludedMuscleIds: [],
  preferredExerciseIds: [], split: "auto", periodization: "static", cycles: 4, deloadCycles: [],
};
const failures = [];
let passed = 0;

function check(condition, message, detail) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failures.push(message);
    console.error(`  ✗ ${message}`);
    if (detail !== undefined) console.error(`    ${JSON.stringify(detail)}`);
  }
}

/**
 * The edited value of a set field. A catalog-metric set keeps load and reps in
 * its metric map; a legacy flat set (the released app's program) keeps them as
 * flat fields.
 */
function editedOf(set, field) {
  return METRIC_OF[field] && Array.isArray(set?.programmed?.metrics)
    ? set?.edited?.metrics?.[METRIC_OF[field]] : set?.edited?.[field];
}

/** Edit the selected exercise's first-set load through the production draft command. */
function editLoad(page, value) {
  return page.evaluate(({ value, weight }) => {
    const hook = window.__repforgeWorkoutDraft, draft = hook.current();
    const exerciseInstanceId = draft.session.selectedExerciseId;
    const exercise = draft.exercises[exerciseInstanceId];
    const setId = exercise.setOrder.find((id) => exercise.sets[id].ordinal === 1);
    return Array.isArray(exercise.sets[setId].programmed.metrics)
      ? hook.dispatch("editMetricValue", { exerciseInstanceId, setId, metricId: weight, value })
      : hook.dispatch("editSetField", { exerciseInstanceId, setId, field: "load", value });
  }, { value: String(value), weight: WEIGHT });
}

/** A History row's recorded metric value. */
function metricValue(row, field) {
  return row?.metricValues?.find((entry) => entry.metricId === METRIC_OF[field])?.value;
}

async function waitForBoot(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(() => {
    window.closeFirstRun?.();
    if (document.querySelector("#onboarding")?.classList.contains("active")) window.closeOnboarding?.();
    if (!document.querySelector("#tour")?.classList.contains("hidden")) window.closeTour?.();
    window.stopRest?.();
  });
}

async function openApp(context) {
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForBoot(page);
  return page;
}

async function openOldApp(context) {
  const page = await context.newPage();
  const origin = new URL(BASE).origin;
  await page.route((url) => url.origin === origin, (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const path = pathname === "/" ? "index.html" : pathname.slice(1);
    const bytes = oldFile(path);
    if (!bytes) return route.fulfill({ status: 404, body: "Not found" });
    const extension = path.match(/\.[a-z0-9]+$/i)?.[0] || "";
    return route.fulfill({ status: 200, contentType: OLD_TYPES[extension] || "application/octet-stream", body: bytes });
  });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForBoot(page);
  return page;
}

async function oldAppWriteSet(page, exerciseId, { load, reps, rir }, day = "Day 1") {
  await page.evaluate((label) => window.__repforgeEnterWorkout({day: label }), day);
  await page.waitForSelector(`#workout:not(.is-focus) .exercise[data-ex="${exerciseId}"]`);
  await page.locator(`[data-k="${exerciseId}_1_load"]`).fill(String(load));
  await page.locator(`[data-k="${exerciseId}_1_reps"]`).fill(String(reps));
  await page.locator(`[data-k="${exerciseId}_1_rir"]`).fill(String(rir));
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem("repforge_draft_v1") || "{}")[key] != null,
    `${exerciseId}_1_load`);
}

async function writeState(page, state) {
  await page.evaluate(async ({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { key: STATE, value: state });
}

async function reset(page, options = {}) {
  const current = JSON.parse(await page.evaluate((key) => localStorage.getItem(key) || "{}", STATE));
  const next = {
    ...current,
    program: options.legacy ? LEGACY.seedProgram() : seedProgram(),
    programMeta: options.legacy ? LEGACY.seedProgramMeta() : seedProgramMeta(),
    log: [],
    programHistory: [],
    settings: { ...current.settings, lang: options.lang || "en", unit: options.unit || "kg", rirMode: "numeric", restSec: 0 },
  };
  await writeState(page, next);
  if (options.legacy) {
    // The released app normalizes and persists its program when it boots. Let it
    // do so once, as an installed copy would have, so a later legacy tab and the
    // current tab bind their drafts to the same durable program.
    const settle = await openOldApp(page.context());
    await settle.close();
  }
  await page.evaluate(({ draft, checkpoint, recovery }) => {
    for (const key of [...Array(localStorage.length)].map((_, index) => localStorage.key(index))) {
      if (key === draft || key === checkpoint || key === recovery || key?.startsWith(`${draft}:pending:`)) {
        localStorage.removeItem(key);
      }
    }
  }, { draft: DRAFT, checkpoint: CHECKPOINT, recovery: RECOVERY });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForBoot(page);
}

async function enter(page, day = "Day 1") {
  await page.evaluate((label) => window.__repforgeEnterWorkout({day: label }), day);
  await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 5000 });
}

// Plan 055's normal finish only accepts a complete workout. These scenarios are
// about *when* Finish captures its revision, not about partial workouts, so every
// set except the visible one under test is completed up front and the storage
// hazard is still exercised on that last visible completion.
async function completeAllButCurrent(page) {
  await page.evaluate(async ({ weight, reps }) => {
    const hook = window.__repforgeWorkoutDraft;
    const draft = hook.current();
    const heldExercise = draft.session.selectedExerciseId;
    const heldSet = draft.exercises[heldExercise].setOrder[0];
    for (const exerciseInstanceId of draft.exerciseOrder) {
      for (const setId of draft.exercises[exerciseInstanceId].setOrder) {
        if (exerciseInstanceId === heldExercise && setId === heldSet) continue;
        for (const [metricId, value] of [[weight, "60"], [reps, "8"]]) {
          await hook.dispatch("editMetricValue", { exerciseInstanceId, setId, metricId, value });
        }
        await hook.dispatch("editSetField", { exerciseInstanceId, setId, field: "rir", value: "2" });
        await hook.dispatch("completeSet", { exerciseInstanceId, setId, completedAt: new Date().toISOString() });
      }
    }
    await hook.flush();
  }, { weight: WEIGHT, reps: REPS });
  await page.evaluate(() => window.__repforgeFocus.to(0));
  await page.waitForSelector("#workout.is-focus .exercise.is-current .focus-shelf .saveset", { timeout: 5000 });
}

/** The live shelf input for a field of the current exercise's set. */
async function shelfInput(page, field, root = "#workout .exercise.is-current .focus-shelf") {
  const input = page.locator(`${root} input[data-k$="${KEY_SUFFIX[field]}"]`);
  await input.waitFor({ state: "attached", timeout: 5000 });
  if (await input.getAttribute("aria-hidden") === "true") {
    await page.locator(`${root} [data-shelf-field="${SHELF_FIELD[field]}"]`).click();
  }
  return input;
}

async function fillCurrent(page, field, value) {
  const input = await shelfInput(page, field);
  const key = await input.getAttribute("data-k");
  await input.fill(String(value));
  await page.waitForFunction(({ key, metricId, field, value }) => {
    const draft = window.__repforgeWorkoutDraft.current();
    const target = window.__repforgeWorkoutDraft.target(key);
    const set = draft.exercises[target.exerciseInstanceId].sets[target.setId];
    return (metricId ? set.edited.metrics?.[metricId] : set.edited[field]) === value;
  }, { key, metricId: METRIC_OF[field] || null, field, value: String(value) });
}

async function commandFixture(page, field, value, operationId) {
  return page.evaluate(({ field, metricId, value, operationId }) => {
    const draft = window.RepForgeWorkoutDraft.parse(window.__repforgeWorkoutDraft.read().raw).draft;
    const exerciseInstanceId = draft.session.selectedExerciseId;
    const setId = draft.exercises[exerciseInstanceId].setOrder[0];
    const updatedAt = new Date(Date.parse(draft.session.updatedAt) + 1000).toISOString();
    const command = {
      ...(metricId ? { type: "editMetricValue", metricId } : { type: "editSetField", field }),
      exerciseInstanceId,
      setId,
      value,
      operationId,
      expectedRevision: draft.revision,
      updatedAt,
      writer: { installationId: draft.writer.installationId, tabId: "storage-proof", operationId },
    };
    const next = window.RepForgeWorkoutDraft.reduce(draft, command);
    return {
      expectedDraftId: draft.draftId,
      expectedRevision: draft.revision,
      nextRaw: JSON.stringify(window.RepForgeWorkoutDraft.serialize(next)),
      operationId,
    };
  }, { field, metricId: METRIC_OF[field] || null, value: String(value), operationId });
}

async function rawState(page) {
  return page.evaluate(({ state, draft, checkpoint, recovery }) => {
    const parse = (key) => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return "invalid"; } };
    return { state: parse(state), raw: localStorage.getItem(draft), checkpoint: parse(checkpoint), recovery: parse(recovery) };
  }, { state: STATE, draft: DRAFT, checkpoint: CHECKPOINT, recovery: RECOVERY });
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
  let page = await openApp(context);
  const errors = [];
  const watch = (candidate) => {
    candidate.on("pageerror", (error) => errors.push(error.message));
    candidate.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
  };
  watch(page);

  try {
    console.log("\n1. A visible programmed set owns DraftV2 through correction, reload, and save");
    await reset(page);
    const first = seedProgram()[0];
    await enter(page);
    check(await page.locator("#workout .focus-inputs").count() === 0,
      "Focus renders no hidden List-input carriers before editing");
    await fillCurrent(page, "load", "60");
    await fillCurrent(page, "reps", "8");
    await fillCurrent(page, "rir", "2");
    await page.locator("#workout .exercise.is-current .focus-shelf .saveset").click();
    await page.waitForFunction(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      const exercise = draft.exercises[draft.session.selectedExerciseId];
      return exercise.sets[exercise.setOrder[0]].completion !== "pending";
    });

    await page.locator(`#workout .exercise.is-current [data-editn="1"]`).click();
    await page.waitForFunction(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      const exercise = draft.exercises["seed-ex-1"];
      return exercise.sets[exercise.setOrder[0]].completion === "pending";
    });

    await page.waitForSelector("#workout.is-focus .exercise.is-current");
    await page.evaluate(() => document.querySelectorAll("#workout .focus-inputs").forEach((node) => node.remove()));
    await fillCurrent(page, "load", "62.5");
    await page.locator("#workout .exercise.is-current .focus-shelf .saveset").click();
    await page.waitForFunction(({ weight }) => {
      const draft = window.__repforgeWorkoutDraft.current();
      const exercise = draft.exercises[draft.session.selectedExerciseId];
      const set = exercise.sets[exercise.setOrder[0]];
      return set.completion !== "pending" && set.edited.metrics?.[weight] === "62.5";
    }, { weight: WEIGHT });
    const beforeReload = await rawState(page);
    check(beforeReload.checkpoint?.kind === "committed" && beforeReload.checkpoint.raw === beforeReload.raw,
      "the corrected completion is acknowledged in canonical and checkpoint storage");
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    await enter(page);
    const restored = await page.evaluate((weight) => {
      const draft = window.__repforgeWorkoutDraft.current();
      const exercise = draft.exercises[draft.session.selectedExerciseId];
      const set = exercise.sets[exercise.setOrder[0]];
      return { load: set.edited.metrics?.[weight], completion: set.completion, revision: draft.revision };
    }, WEIGHT);
    const afterReloadRaw = (await rawState(page)).raw;
    check(restored.load === "62.5" && restored.completion !== "pending" && afterReloadRaw === beforeReload.raw,
      "reload restores the complete DraftV2 identity, values, and completion byte-for-byte", {
        ...restored,
        exactRaw: afterReloadRaw === beforeReload.raw,
      });
    const hiddenBeforeSave = await page.locator("#workout .focus-inputs").count();
    check(hiddenBeforeSave === 0,
      "reload and rerender create no hidden List-input carriers before save", { hiddenBeforeSave });
    const save = await finishEarly(page);
    await page.evaluate(() => window.__repforgeStorage.flush());
    const saved = await rawState(page);
    const row = saved.state.log.find((candidate) => candidate.exerciseId === first.id && metricValue(candidate, "load") === 62.5);
    check((save?.localOk || save?.idbOk) && metricValue(row, "reps") === 8 && row?.rir === 2,
      "production save compiles the corrected DraftV2 set into the existing History row", row);
    check(saved.raw === null && saved.checkpoint?.kind === "tombstone",
      "save removes canonical draft bytes and commits a removal tombstone", saved.checkpoint);

    console.log("\n1a. Canonical unit conversion keeps numeric truth through DraftV2 and History");
    await reset(page, { unit: "lb" });
    await enter(page, "Day 1");

    const precisionExercise = seedProgram()[0];
    const precisionLoad = 12.5 / 2.2046226218;
    await (await shelfInput(page, "load")).fill("12.5");
    await (await shelfInput(page, "reps")).fill("8");
    await (await shelfInput(page, "rir")).fill("2");
    await sessionField(page, "#sessionBodyweight", "12.5");
    await page.waitForFunction(({ draft, id, expected, weight }) => {
      const value = JSON.parse(localStorage.getItem(draft) || "null");
      const exercise = value?.exercises?.[id];
      const set = exercise?.sets?.[exercise?.setOrder?.[0]];
      return Math.abs(Number(set?.edited?.metrics?.[weight]) - expected) < Number.EPSILON &&
        Math.abs(Number(value?.session?.bodyweight) - expected) < Number.EPSILON;
    }, { draft: DRAFT, id: precisionExercise.id, expected: precisionLoad, weight: WEIGHT });
    const preciseDraft = await page.evaluate(({ id, weight }) => {
      const value = window.__repforgeWorkoutDraft.current();
      const exercise = value.exercises[id];
      const set = exercise.sets[exercise.setOrder[0]];
      return { load: set.edited.metrics?.[weight], bodyweight: value.session.bodyweight };
    }, { id: precisionExercise.id, weight: WEIGHT });
    check(preciseDraft.load === String(precisionLoad) && preciseDraft.bodyweight === String(precisionLoad),
      "12.5 lb load and bodyweight retain exact canonical kg text", { preciseDraft, expected: String(precisionLoad) });
    const preciseBeforeReload = (await rawState(page)).raw;
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    check((await rawState(page)).raw === preciseBeforeReload,
      "canonical converted load and bodyweight survive reload byte-for-byte");
    const preciseSave = await finishEarly(page);
    await page.evaluate(() => window.__repforgeStorage.flush());
    const preciseSaved = await rawState(page);
    const preciseRow = preciseSaved.state.log.find((row) => row.exerciseId === precisionExercise.id);
    check((preciseSave?.localOk || preciseSave?.idbOk) && preciseRow &&
      metricValue(preciseRow, "load") === precisionLoad && preciseRow.bodyweight === precisionLoad,
      "History preserves converted load and bodyweight numeric truth", preciseRow);
    await page.evaluate(() => window.__repforgeSessionSummary?.close());
    await enter(page, "Day 1");

    await exerciseAction(page, precisionExercise.id, "#exActionRepeatBtn");
    await page.waitForFunction(({ draft, id, expected, weight }) => {
      const value = JSON.parse(localStorage.getItem(draft) || "null");
      const exercise = value?.exercises?.[id];
      const set = exercise?.sets?.[exercise?.setOrder?.[0]];
      return set?.edited?.metrics?.[weight] === expected;
    }, { draft: DRAFT, id: precisionExercise.id, expected: String(precisionLoad), weight: WEIGHT });
    const repeatedPrecision = await page.evaluate(({ id, weight }) => {
      const value = window.__repforgeWorkoutDraft.current();
      const exercise = value.exercises[id];
      return exercise.sets[exercise.setOrder[0]].edited.metrics?.[weight];
    }, { id: precisionExercise.id, weight: WEIGHT });
    check(repeatedPrecision === String(precisionLoad),
      "repeat-last preserves the exact canonical kg value", { repeatedPrecision, expected: String(precisionLoad) });

    console.log("\n1c. Session context intent survives clearing, reload, and mode guards");
    await reset(page);
    await enter(page);

    await sessionField(page, "#sessionNotes", "typed then cleared");
    await sessionField(page, "#sessionNotes", "");
    await sessionField(page,"#sessionDate","2026-08-21");
    await sessionField(page,"#sessionDate","");
    await sessionField(page, "#sessionBodyweight", "80");
    await sessionField(page, "#sessionBodyweight", "");
    await page.waitForFunction(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      return draft?.session?.notes === "" && draft.session.bodyweight === "" && draft.program.scheduleDate === "" &&
        draft.session.contextTouched?.date === true && draft.session.contextTouched?.sessionNotes === true &&
        draft.session.contextTouched?.bodyweight === true;
    });
    const clearedContextBefore = await rawState(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    await enter(page);
    const clearedContextAfter = await rawState(page);
    const reloadedContext = JSON.parse(clearedContextAfter.raw);
    check(clearedContextAfter.raw === clearedContextBefore.raw &&
      reloadedContext.session.contextTouched.date && reloadedContext.session.contextTouched.sessionNotes &&
      reloadedContext.session.contextTouched.bodyweight && reloadedContext.session.notes === "" &&
      reloadedContext.session.bodyweight === "" && reloadedContext.program.scheduleDate === "",
    "cleared date, notes, and bodyweight intent survives reload byte-for-byte", {
      exact: clearedContextAfter.raw === clearedContextBefore.raw,
      contextTouched: reloadedContext.session.contextTouched,
    });
    await page.evaluate(() => window.__repforgeShowSettings());
    await page.waitForSelector("#settings.active");
    await page.locator("#rirModeRow").click();
    await page.locator('input[name="rirMode"][value="effort"]').click();
    await page.waitForTimeout(150);
    const refusedContext = await rawState(page);
    check(refusedContext.state.settings.rirMode === "numeric" && refusedContext.raw === clearedContextBefore.raw,
      "context intent refuses RIR mode change and preserves the exact DraftV2 bytes", {
        mode: refusedContext.state.settings.rirMode,
        exact: refusedContext.raw === clearedContextBefore.raw,
      });

    await reset(page);
    await enter(page, "Day 1");
    await page.evaluate(() => window.__repforgeEnterWorkout({day: "Day 2" }));
    await page.waitForSelector("#workout.is-focus .exercise.is-current");
    const dayIntent = await rawState(page);
    const dayDraft = JSON.parse(dayIntent.raw);
    check(dayDraft.program.dayLabel === "Day 2" && dayDraft.revision === 0 &&
      dayDraft.session.contextTouched.day === true && !dayDraft.session.contextTouched.date &&
      !dayDraft.session.contextTouched.sessionNotes && !dayDraft.session.contextTouched.bodyweight,
      "an explicit day change creates a clean DraftV2 with only day intent");
    const dayBeforeMode = dayIntent.raw;
    await page.evaluate(() => window.__repforgeShowSettings());
    await page.waitForSelector("#settings.active");
    await page.locator("#rirModeRow").click();
    await page.locator('input[name="rirMode"][value="effort"]').click();
    await page.waitForTimeout(150);
    const dayRefused = await rawState(page);
    check(dayRefused.state.settings.rirMode === "numeric" && dayRefused.raw === dayBeforeMode,
      "day-only intent refuses RIR mode change and preserves exact bytes");

    await reset(page);
    await enter(page);

    await sessionField(page, "#sessionNotes", "typed then cleared");
    await sessionField(page, "#sessionNotes", "");
    await page.waitForFunction(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      const flags = draft?.session?.contextTouched;
      return draft?.session?.notes === "" && flags?.sessionNotes === true &&
        flags.date === false && flags.bodyweight === false;
    });
    const noteOnlyBefore = await rawState(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    await enter(page);
    const noteOnlyAfter = await rawState(page);
    check(noteOnlyAfter.raw === noteOnlyBefore.raw &&
      JSON.parse(noteOnlyAfter.raw).session.contextTouched.sessionNotes === true,
      "a cleared note marker survives reload with exact DraftV2 bytes");
    await page.evaluate(() => window.__repforgeShowSettings());
    await page.waitForSelector("#settings.active");
    await page.locator("#rirModeRow").click();
    await page.locator('input[name="rirMode"][value="effort"]').click();
    await page.waitForTimeout(150);
    const noteOnlyRefused = await rawState(page);
    check(noteOnlyRefused.state.settings.rirMode === "numeric" && noteOnlyRefused.raw === noteOnlyBefore.raw,
      "a cleared-note-only draft refuses RIR mode change without changing its bytes");

    await reset(page);
    await enter(page);
    const freshContext = await page.evaluate(() => window.__repforgeWorkoutDraft.current().session.contextTouched);
    check(JSON.stringify(freshContext) === JSON.stringify({ day: false, date: false, sessionNotes: false, bodyweight: false }),
      "a fresh workout remains eligible for an RIR mode change");
    await page.evaluate(() => window.__repforgeShowSettings());
    await page.waitForSelector("#settings.active");
    await page.locator("#rirModeRow").click();
    await page.locator('input[name="rirMode"][value="effort"]').check();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("repforge_v1") || "{}").settings?.rirMode === "effort");
    check((await rawState(page)).state.settings.rirMode === "effort",
      "a fresh DraftV2 permits the RIR mode change");

    console.log("\n1a. Immediate Complete then Finish orders the acknowledged write");
    await reset(page);
    await enter(page);
    await completeAllButCurrent(page);
    await fillCurrent(page, "load", "61");
    await fillCurrent(page, "reps", "8");
    await fillCurrent(page, "rir", "2");
    await page.evaluate(() => {
      window.__repforgeBeforeSuggestionRefresh = () => new Promise((resolve) => {
        window.__releaseSuggestionRefresh = resolve;
      });
    });
    await page.locator("#workout .exercise.is-current .focus-shelf .saveset").click();
    await page.waitForFunction(() => typeof window.__releaseSuggestionRefresh === "function");
    const immediateBefore = await rawState(page);
    await page.evaluate(() => {
      window.__immediateSaveSettled = false;
      window.__immediateSavePromise = window.__repforgeSaveWorkout().then((result) => {
        window.__immediateSaveSettled = true;return result;
      });
    });
    check(await page.evaluate(() => window.__immediateSaveSettled === false),
      "Finish waits while the post-completion refresh is paused");
    await page.evaluate(() => window.__releaseSuggestionRefresh());
    const immediateSave = await page.evaluate(() => window.__immediateSavePromise);
    await page.evaluate(() => window.__repforgeStorage.flush());
    const immediateSaved = await rawState(page);
    check((immediateSave?.localOk || immediateSave?.idbOk) && immediateSaved.raw === null &&
      immediateSaved.state.log.some((candidate) => metricValue(candidate, "load") === 61 && metricValue(candidate, "reps") === 8),
      "Finish captures the completed set while its post-completion suggestion refresh is paused", {
        save: { localOk: immediateSave?.localOk, idbOk: immediateSave?.idbOk, reason: immediateSave?.reason,
          validation: immediateSave?.validation, issues: immediateSave?.issues, draftConflict: immediateSave?.draftConflict },
        draftCleared: immediateSaved.raw === null,
        before: { raw: immediateBefore.raw?.slice?.(0, 80), checkpoint: immediateBefore.checkpoint?.kind,
          revision: JSON.parse(immediateBefore.raw || "null")?.revision },
        after: { raw: immediateSaved.raw?.slice?.(0, 80), checkpoint: immediateSaved.checkpoint?.kind },
      });

    console.log("\n1b. Adaptive suggestion refresh: acknowledged writes, typed values, and failure recovery");
    // A Build/seed program is manual and has no recommendation to refresh. A
    // generated program with one recorded session does, so the refresh path
    // writes real untouched-set updates through DraftV2.
    const mainPage = page;
    const adaptiveContext = await browser.newContext({
      viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block",
    });
    page = await adaptiveContext.newPage();
    await page.clock.setFixedTime(new Date("2026-03-02T09:00:00.000Z"));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    const adaptive = await page.evaluate(async ({ request, weight, reps }) => {
      const generated = window.RepForgeProgramCompiler.generateProgram(request,
        window.RepForgeExerciseCatalog.snapshot(), "draft-storage-adaptive");
      if (!generated.ok) return { ok: false, code: "generation-failed" };
      const definition = generated.value;
      const target = definition.days.filter((day) => day.kind === "training").map((day) => ({ day, slot: day.slots[0] }))
        .find(({ slot }) => JSON.stringify(slot.metricIds) === JSON.stringify([weight, reps]) &&
          slot.prescriptionsByCycle[0].sets.length >= 2);
      if (!target) return { ok: false, code: "no-weighted-first-slot" };
      const finalized = await window.__repforgeFinalizeProgramSetup({
        programDefinition: definition, name: "Draft storage adaptive", answers: {}, destination: "log", origin: "first-run",
        draftConfirmed: true, telemetryRoute: "recommend", entrySource: { route: "recommend", fingerprint: "draft-storage-adaptive" },
      });
      await window.__repforgeStorage.flush();
      return { ok: !!(finalized?.localOk || finalized?.idbOk), day: target.day.name, slotId: target.slot.id };
    }, { request: REQUEST, weight: WEIGHT, reps: REPS });
    if (!adaptive.ok) throw new Error(`adaptive program setup failed: ${adaptive.code || "finalize"}`);
    const quiet = JSON.parse(await page.evaluate((key) => localStorage.getItem(key), STATE));
    quiet.settings = { ...quiet.settings, restSec: 0, rirMode: "numeric", unit: "kg", lang: "en" };
    await writeState(page, quiet);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    const adaptiveId = adaptive.slotId;
    const setAt = (ordinal) => page.evaluate(({ id, ordinal }) => {
      const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
      const setId = exercise?.setOrder?.find((candidate) => exercise.sets[candidate].ordinal === ordinal);
      return setId ? exercise.sets[setId] : null;
    }, { id: adaptiveId, ordinal });
    const enterAdaptive = async () => {
      if (!await page.evaluate((label) => window.__repforgeEnterWorkout({ day: label }), adaptive.day)) {
        throw new Error("could not enter the adaptive day");
      }
      await page.waitForSelector(`#workout.is-focus .exercise.is-current[data-ex="${adaptiveId}"]`, { timeout: 10000 });
    };
    const completeVisible = async (ordinal) => {
      await page.locator(`#workout .exercise.is-current [data-save="${adaptiveId}_${ordinal}"]`).click();
      await page.waitForFunction(({ id, ordinal }) => {
        const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
        const setId = exercise?.setOrder?.find((candidate) => exercise.sets[candidate].ordinal === ordinal);
        return setId && exercise.sets[setId].completion !== "pending";
      }, { id: adaptiveId, ordinal });
    };

    // Session 1 records the history that the next session adapts from.
    await enterAdaptive();
    await page.evaluate(async ({ id, weight, reps }) => {
      const hook = window.__repforgeWorkoutDraft;
      for (const setId of hook.current().exercises[id].setOrder) {
        await hook.dispatch("editMetricValue", { exerciseInstanceId: id, setId, metricId: weight, value: "100" });
        await hook.dispatch("editMetricValue", { exerciseInstanceId: id, setId, metricId: reps, value: "8" });
        await hook.dispatch("editSetField", { exerciseInstanceId: id, setId, field: "rir", value: "2" });
        await hook.dispatch("completeSet", { exerciseInstanceId: id, setId, completedAt: new Date().toISOString() });
      }
      await hook.flush();
    }, { id: adaptiveId, weight: WEIGHT, reps: REPS });
    const firstSession = await finishEarly(page);
    await page.evaluate(() => window.__repforgeStorage.flush());
    check(firstSession?.localOk || firstSession?.idbOk, "the generated program records a first session to adapt from");
    await page.clock.setFixedTime(new Date("2026-03-04T09:00:00.000Z"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    const historyRows = (await rawState(page)).state.log.length;

    // A failed refresh blocks Finish instead of capturing the earlier revision.
    await enterAdaptive();
    const recommended = await setAt(2);
    check(recommended?.completion === "pending" && recommended.edited.metrics?.[WEIGHT] != null &&
      recommended.touched.metrics?.[WEIGHT] === false,
    "the second session acknowledges an untouched recommendation in DraftV2", recommended?.edited?.metrics);
    await fillCurrent(page, "load", "101");
    await fillCurrent(page, "reps", "8");
    await fillCurrent(page, "rir", "2");
    await page.evaluate(() => {
      window.__repforgeDraftFault = "stale-suggestion-loop";
      window.__repforgeBeforeSuggestionRefresh = () => new Promise((resolve) => {
        window.__releaseSuggestionRefresh = resolve;
      });
    });
    await page.locator("#workout .exercise.is-current .focus-shelf .saveset").click();
    await page.waitForFunction(() => typeof window.__releaseSuggestionRefresh === "function");
    await page.evaluate(() => {
      window.__failedRefreshSaveSettled = false;
      window.__failedRefreshSavePromise = window.__repforgeSaveWorkout().then((result) => {
        window.__failedRefreshSaveSettled = true;return result;
      });
    });
    check(await page.evaluate(() => window.__failedRefreshSaveSettled === false),
      "Finish waits for a refresh that may fail instead of capturing its earlier revision");
    await page.evaluate(() => window.__releaseSuggestionRefresh());
    const failedRefreshSave = await page.evaluate(() => window.__failedRefreshSavePromise);
    await page.evaluate(() => { window.__repforgeDraftFault = null; });
    await page.evaluate(() => window.__repforgeStorage.flush());
    const failedRefreshState = await rawState(page);
    const failedRefreshDraft = JSON.parse(failedRefreshState.raw || "null");
    const failedRefreshSet = failedRefreshDraft?.exercises?.[adaptiveId]?.sets?.[failedRefreshDraft.exercises[adaptiveId].setOrder[0]];
    check(failedRefreshSave?.reason === "recovery-pending" && failedRefreshState.state.log.length === historyRows &&
      failedRefreshSet?.completion !== "pending" && failedRefreshSet?.edited?.metrics?.[WEIGHT] === "101",
    "a failed refresh blocks Finish while preserving the completed DraftV2 and History", {
      reason: failedRefreshSave?.reason, draftPreserved: failedRefreshState.raw != null,
      historyRows: failedRefreshState.state.log.length, expectedRows: historyRows,
    });
    await page.locator("#draftRecoveryRetry").click();
    await page.waitForSelector("#draftRecovery", { state: "hidden" });

    // An unchanged refresh writes nothing.
    const noOp = await page.evaluate(async () => {
      const before = window.__repforgeWorkoutDraft.current(), beforeRaw = window.__repforgeWorkoutDraft.raw();
      const result = await window.__repforgeWorkoutDraft.dispatch("refreshUntouchedSuggestions", {
        sourceRevision: before.revision, updates: [],
      });
      const after = window.__repforgeWorkoutDraft.current();
      return { status: result.status, noOp: result.noOp, sameRevision: after.revision === before.revision,
        sameRaw: window.__repforgeWorkoutDraft.raw() === beforeRaw };
    });
    check(noOp.status === "applied" && noOp.noOp === true && noOp.sameRevision && noOp.sameRaw,
      "an unchanged suggestion refresh returns without a revision or checkpoint write", noOp);

    // A typed value on a pending set survives the refresh a later completion runs.
    await page.evaluate(() => window.__repforgeFocus.to(0));
    await page.waitForSelector(`#workout.is-focus .exercise.is-current [data-save="${adaptiveId}_2"]`);
    await fillCurrent(page, "load", "1");
    await page.locator('#workout .exercise.is-current [data-editn="1"]').click();
    await page.waitForFunction((id) => {
      const exercise = window.__repforgeWorkoutDraft.current().exercises[id];
      return exercise.sets[exercise.setOrder[0]].completion === "pending";
    }, adaptiveId);
    await fillCurrent(page, "reps", "7");
    await completeVisible(1);
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    const offGrid = await setAt(2);
    check(offGrid?.edited?.metrics?.[WEIGHT] === "1" && offGrid?.touched?.metrics?.[WEIGHT] === true,
      "an explicit off-grid edit survives a later suggestion refresh", offGrid?.edited?.metrics);

    // Repeated stale sources surface Retry and keep Finish closed until it succeeds.
    await page.locator('#workout .exercise.is-current [data-editn="1"]').click();
    await page.waitForFunction((id) => {
      const exercise = window.__repforgeWorkoutDraft.current().exercises[id];
      return exercise.sets[exercise.setOrder[0]].completion === "pending";
    }, adaptiveId);
    await page.evaluate(() => { window.__repforgeDraftFault = "stale-suggestion-loop"; });
    await fillCurrent(page, "reps", "6");
    await page.locator(`#workout .exercise.is-current [data-save="${adaptiveId}_1"]`).click();
    await page.waitForSelector("#draftRecovery:not(.hidden)");
    check(await page.locator("#draftRecoveryRetry").isVisible(),
      "repeated stale suggestion sources expose a visible Retry action");
    const blockedFinish = await page.evaluate(() => window.__repforgeSaveWorkout());
    check(blockedFinish?.reason === "recovery-pending",
      "stale suggestion recovery blocks Finish while preserving the active draft", blockedFinish);
    await page.evaluate(() => { window.__repforgeDraftFault = null; });
    await page.locator("#draftRecoveryRetry").click();
    await page.waitForSelector("#draftRecovery", { state: "hidden" });
    check((await page.evaluate(() => window.__repforgeWorkoutDraft.recovery())) === null,
      "Retry recomputes from the latest acknowledged V2 source and clears recovery");
    await adaptiveContext.close();
    page = mainPage;

    await reset(page, { legacy: true });
    const legacyMigrationWriter = await openOldApp(context);
    await oldAppWriteSet(legacyMigrationWriter, first.id, { load: "57.5", reps: "8", rir: "2" });
    await legacyMigrationWriter.locator(`[data-save="${first.id}_1"]`).click();
    await legacyMigrationWriter.close();
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    const migrated = await rawState(page);
    const migratedDraft = JSON.parse(migrated.raw);
    const migratedSet = migratedDraft.exercises[first.id].sets[migratedDraft.exercises[first.id].setOrder[0]];
    check(migratedDraft.schemaVersion === 2 && migratedSet.edited.load === "57.5" &&
      migratedSet.completion !== "pending" && migrated.checkpoint?.kind === "committed" &&
      migrated.checkpoint.raw === migrated.raw,
    "production boot migrates an actual legacy DOM write and acknowledges the resulting V2", {
      schemaVersion: migratedDraft.schemaVersion,
      load: migratedSet.edited.load,
      checkpointKind: migrated.checkpoint?.kind,
    });
    const migratedSave = await finishEarly(page);
    await page.evaluate(() => window.__repforgeStorage.flush());
    const migratedSaved = await rawState(page);
    check((migratedSave?.localOk || migratedSave?.idbOk) &&
      migratedSaved.state.log.some((candidate) => candidate.exerciseId === first.id && candidate.load === 57.5) &&
      migratedSaved.raw === null,
    "the migrated production draft saves through the same History adapter and is removed");

    await reset(page, { unit: "lb", legacy: true });
    const legacyPounds = await openOldApp(context);
    await oldAppWriteSet(legacyPounds, first.id, { load: "12.5", reps: "8", rir: "2" });
    await legacyPounds.close();
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    const migratedPounds = await rawState(page);
    const migratedPoundsDraft = JSON.parse(migratedPounds.raw);
    const migratedPoundsSet = migratedPoundsDraft.exercises[first.id].sets[migratedPoundsDraft.exercises[first.id].setOrder[0]];
    const migratedPoundsValue = 12.5 / 2.2046226218;
    check(migratedPoundsSet.edited.load === String(migratedPoundsValue) &&
      Number(migratedPoundsSet.edited.load) === migratedPoundsValue &&
      migratedPounds.checkpoint?.raw === migratedPounds.raw,
    "actual legacy lb input migrates with exact canonical kg precision", {
      load: migratedPoundsSet.edited.load,
      expected: String(migratedPoundsValue),
      checkpoint: migratedPounds.checkpoint?.kind,
    });

    // Issue #332: migrateLegacy's allowedFields loop used to write every legacy
    // value onto `set.edited[load|reps|rir]`, even when the set is metric-backed
    // (Plan 067). Such a set keeps its typed load/reps in
    // `edited.metrics[metricId]` (see exercise-metrics.js and
    // shelfMetricFieldHtml/setSaveIssues in app.js); a flat legacy draft with no
    // __touched marker (unlike #330/#321's touched case) still migrates cleanly
    // -- validate() has no reason to reject it -- but the value used to land in
    // the unread flat field, so Focus showed an empty input and the set could
    // not be saved/logged without retyping. Reproduce directly against the
    // current metric-backed seed program (no older release needed: the value
    // is simply written to localStorage the way any pre-067 writer would).
    console.log("\n1e. Issue #332: an untouched legacy draft against a metric-backed slot keeps its typed load/reps where Focus reads them");
    await reset(page);
    const metricMigrationExercise = seedProgram()[0];
    const untouchedLegacyDraft = {
      [`${metricMigrationExercise.id}_1_load`]: "60",
      [`${metricMigrationExercise.id}_1_reps`]: "8",
      [`${metricMigrationExercise.id}_1_rir`]: "2",
      __day: "Day 1",
    };
    await page.evaluate(({ draftKey, checkpointKey, draft }) => {
      localStorage.setItem(draftKey, JSON.stringify(draft));
      localStorage.removeItem(checkpointKey);
    }, { draftKey: DRAFT, checkpointKey: CHECKPOINT, draft: untouchedLegacyDraft });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    const noNoticeVisible = await page.locator("#draftRecovery:not(.hidden)").count();
    check(noNoticeVisible === 0,
      "an untouched legacy draft against a metric-backed slot migrates without the earlier-program notice", { noNoticeVisible });
    const migratedUntouched = await rawState(page);
    const migratedUntouchedDraft = JSON.parse(migratedUntouched.raw || "null");
    const migratedUntouchedExercise = migratedUntouchedDraft?.exercises?.[metricMigrationExercise.id];
    const migratedUntouchedSet = migratedUntouchedExercise?.sets?.[migratedUntouchedExercise.setOrder[0]];
    check(migratedUntouchedDraft?.schemaVersion === 2 &&
      migratedUntouchedSet?.edited?.metrics?.[WEIGHT] === "60" &&
      migratedUntouchedSet?.edited?.metrics?.[REPS] === "8" &&
      migratedUntouchedSet?.edited?.rir === "2",
    "migration writes the typed load/reps into the set's metric map, not the unread flat fields", {
      metrics: migratedUntouchedSet?.edited?.metrics,
      flatLoad: migratedUntouchedSet?.edited?.load,
      flatReps: migratedUntouchedSet?.edited?.reps,
    });
    await enter(page, "Day 1");
    const migratedLoadInput = await shelfInput(page, "load");
    const migratedRepsInput = await shelfInput(page, "reps");
    const migratedLoadShown = await migratedLoadInput.inputValue();
    const migratedRepsShown = await migratedRepsInput.inputValue();
    check(migratedLoadShown === "60" && migratedRepsShown === "8",
      "Focus's metric inputs show the migrated typed values, not an empty field", {
        load: migratedLoadShown, reps: migratedRepsShown,
      });
    await page.locator("#workout .exercise.is-current .focus-shelf .saveset").click();
    await page.waitForFunction(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      const exercise = draft.exercises[draft.session.selectedExerciseId];
      return exercise.sets[exercise.setOrder[0]].completion !== "pending";
    }, undefined, { timeout: 5000 });
    const migratedLogSave = await finishEarly(page);
    await page.evaluate(() => window.__repforgeStorage.flush());
    const migratedLogState = await rawState(page);
    const migratedLogRow = migratedLogState.state.log.find((candidate) => candidate.exerciseId === metricMigrationExercise.id);
    check((migratedLogSave?.localOk || migratedLogSave?.idbOk) &&
      metricValue(migratedLogRow, "load") === 60 && metricValue(migratedLogRow, "reps") === 8 && migratedLogRow?.rir === 2,
    "the migrated metric-backed set logs the lifter's typed values without retyping", migratedLogRow);

    console.log("\n2. Save owns its captured revision and cannot clear a successor draft");
    await reset(page);
    await enter(page);
    await completeAllButCurrent(page);
    await fillCurrent(page, "load", "60");
    await fillCurrent(page, "reps", "8");
    await fillCurrent(page, "rir", "2");
    await page.locator("#workout .exercise.is-current .focus-shelf .saveset").click();
    const contender = await openApp(context);
    watch(contender);
    await page.evaluate(() => {
      window.__repforgeDraftBeforeSaveCommit = () => new Promise((resolve) => {
        window.__releaseDraftSave = resolve;
        window.__draftSavePaused = true;
      });
      window.__draftSavePromise = window.__repforgeSaveWorkout();
    });
    await page.waitForFunction(() => window.__draftSavePaused === true);
    await contender.reload({ waitUntil: "domcontentloaded" });
    await waitForBoot(contender);
    const contenderWrite = await contender.evaluate(async (metricId) => {
      const hook = window.__repforgeWorkoutDraft;
      const reopened = await hook.dispatch("cancelFinish");
      const draft = hook.current();
      const exerciseInstanceId = draft.session.selectedExerciseId;
      const setId = draft.exercises[exerciseInstanceId].setOrder[0];
      const edited = await hook.dispatch("editMetricValue", { exerciseInstanceId, setId, metricId, value: "66" });
      return { reopened: reopened.status, edited: edited.status };
    }, WEIGHT);
    const staleSave = await page.evaluate(async () => {
      window.__releaseDraftSave();
      const result = await window.__draftSavePromise;
      delete window.__repforgeDraftBeforeSaveCommit;
      delete window.__draftSavePromise;
      delete window.__releaseDraftSave;
      return result;
    });
    await page.evaluate(() => window.__repforgeStorage.flush());
    const afterStaleSave = await rawState(page);
    const successor = JSON.parse(afterStaleSave.raw);
    const successorExercise = successor.exercises[successor.session.selectedExerciseId];
    check(contenderWrite.reopened === "applied" && contenderWrite.edited === "applied" &&
      staleSave?.draftConflict === true && !(staleSave.localOk || staleSave.idbOk) &&
      afterStaleSave.state.log.length === 0 && editedOf(successorExercise.sets[successorExercise.setOrder[0]], "load") === "66",
    "a save with a stale captured revision rejects its rows and preserves the successor draft", {
      contenderWrite,
      staleSave: { draftConflict: staleSave?.draftConflict, localOk: staleSave?.localOk, idbOk: staleSave?.idbOk },
      load: editedOf(successorExercise.sets[successorExercise.setOrder[0]], "load"),
    });
    await contender.close();

    await reset(page);
    await enter(page);
    await completeAllButCurrent(page);
    await fillCurrent(page, "load", "64");
    await fillCurrent(page, "reps", "8");
    await fillCurrent(page, "rir", "2");
    await page.locator("#workout .exercise.is-current .focus-shelf .saveset").click();
    const savedDraftId = await page.evaluate(() => window.__repforgeWorkoutDraft.current().draftId);
    const saveWithSuccessor = await page.evaluate(async (metricId) => {
      window.__repforgeDraftAfterSaveCommit = async () => {
        delete window.__repforgeDraftAfterSaveCommit;
        await window.__repforgeWorkoutDraft.initialize();
        await window.__repforgeEnterWorkout({day: "Day 1" });
        const hook = window.__repforgeWorkoutDraft;
        const draft = hook.current();
        const exerciseInstanceId = draft.session.selectedExerciseId;
        const setId = draft.exercises[exerciseInstanceId].setOrder[0];
        await hook.dispatch("editMetricValue", { exerciseInstanceId, setId, metricId, value: "71" });
      };
      return window.__repforgeSaveWorkout();
    }, WEIGHT);
    await page.evaluate(() => window.__repforgeStorage.flush());
    const newDraftBeforeReload = await rawState(page);
    const newDraft = JSON.parse(newDraftBeforeReload.raw);
    const newExercise = newDraft.exercises[newDraft.session.selectedExerciseId];
    check((saveWithSuccessor?.localOk || saveWithSuccessor?.idbOk) && newDraft.draftId !== savedDraftId &&
      editedOf(newExercise.sets[newExercise.setOrder[0]], "load") === "71" &&
      newDraftBeforeReload.checkpoint?.kind === "committed" &&
      newDraftBeforeReload.checkpoint.raw === newDraftBeforeReload.raw,
    "a new draft created after the old save commit replaces the tombstone without an out-of-lock clobber", {
      oldDraftId: savedDraftId,
      newDraftId: newDraft.draftId,
      load: editedOf(newExercise.sets[newExercise.setOrder[0]], "load"),
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    const newDraftAfterReload = await rawState(page);
    check(newDraftAfterReload.raw === newDraftBeforeReload.raw &&
      newDraftAfterReload.state.log.some((row) => row.session === savedDraftId),
      "reload retains both the saved session and the byte-exact successor draft");

    console.log("\n3. CAS retries and crash recovery preserve the acknowledged revision");
    await reset(page);
    await enter(page);
    const beforeFault = await commandFixture(page, "load", "51", "proof-before-write");
    const beforeFirst = await page.evaluate(async (command) => {
      window.__repforgeDraftFault = "before-canonical-write";
      return window.__repforgeWorkoutDraft.cas(command);
    }, beforeFault);
    const beforeRetry = await page.evaluate((command) => window.__repforgeWorkoutDraft.cas(command), beforeFault);
    check(beforeFirst.status === "fault-before-canonical" && beforeRetry.status === "applied" && beforeRetry.idempotent,
      "an exact token retry completes a write interrupted before canonical publication", { beforeFirst, beforeRetry });
    const conflictingRetry = await page.evaluate(({ command, metricId }) => {
      const changed = JSON.parse(command.nextRaw);
      const exercise = changed.exercises[changed.session.selectedExerciseId];
      exercise.sets[exercise.setOrder[0]].edited.metrics[metricId] = "999";
      return window.__repforgeWorkoutDraft.cas({ ...command, nextRaw: JSON.stringify(changed) });
    }, { command: beforeFault, metricId: WEIGHT });
    check(conflictingRetry.status === "operation-conflict",
      "reusing an operation token with different bytes fails closed");
    const afterFault = await commandFixture(page, "load", "52", "proof-after-write");
    const afterFirst = await page.evaluate(async (command) => {
      window.__repforgeDraftFault = "after-canonical-write";
      return window.__repforgeWorkoutDraft.cas(command);
    }, afterFault);
    const afterRetry = await page.evaluate((command) => window.__repforgeWorkoutDraft.cas(command), afterFault);
    check(afterFirst.status === "fault-after-canonical" && afterRetry.status === "applied" && afterRetry.idempotent,
      "the original revision and operation token retry finalizes an after-write interruption",
      { afterFirst: afterFirst.status, afterRetry: afterRetry.status, idempotent: afterRetry.idempotent });
    const abandoned = await commandFixture(page, "load", "99", "proof-abandoned-before-write");
    const abandonedResult = await page.evaluate(async (command) => {
      window.__repforgeDraftFault = "before-canonical-write";
      return window.__repforgeWorkoutDraft.cas(command);
    }, abandoned);
    await page.close();
    page = await openApp(context);
    watch(page);
    const recovered = await page.evaluate((metricId) => {
      const draft = window.__repforgeWorkoutDraft.current();
      const exercise = draft.exercises[draft.session.selectedExerciseId];
      return { load: exercise.sets[exercise.setOrder[0]].edited.metrics?.[metricId], checkpoint: window.__repforgeWorkoutDraft.checkpoint() };
    }, WEIGHT);
    check(abandonedResult.status === "fault-before-canonical" && recovered.load === "52" &&
      recovered.checkpoint.value?.kind === "committed",
    "boot rolls an unacknowledged pre-write revision back to the previous committed V2", {
      abandoned: abandonedResult.status,
      load: recovered.load,
      checkpointKind: recovered.checkpoint.value?.kind,
    });

    console.log("\n4. Stale tabs, legacy writers, sidecars, and day recovery cannot replace V2 truth");
    await reset(page, { legacy: true });
    const oldLiveWriter = await openOldApp(context);
    await oldLiveWriter.evaluate(() => window.__repforgeEnterWorkout({day: "Day 1" }));
    await oldLiveWriter.waitForSelector("#workout:not(.is-focus)");
    await enter(page, "Day 2");
    await editLoad(page, "75");
    const stale = await openApp(context);
    watch(stale);
    const winner = await editLoad(page, "80");
    const loser = await editLoad(stale, "90");
    check(winner.status === "applied" && loser.status === "stale",
      "a stale second tab is rejected at the shared-lock CAS boundary", { winner: winner.status, loser: loser.status });
    const staleRemoval = await stale.evaluate(() => window.__repforgeWorkoutDraft.clear());
    const winnerRaw = (await rawState(page)).raw;
    const winnerAfterRemovalAttempt = JSON.parse(winnerRaw);
    const winnerExercise = winnerAfterRemovalAttempt.exercises[winnerAfterRemovalAttempt.session.selectedExerciseId];
    check(staleRemoval === false && editedOf(winnerExercise.sets[winnerExercise.setOrder[0]], "load") === "80",
      "a stale tab cannot remove the newer acknowledged draft", { staleRemoval });
    await stale.close();
    await page.close();
    await oldAppWriteSet(oldLiveWriter, first.id, { load: "20", reps: "5", rir: "4" });
    const oldWriterRaw = await oldLiveWriter.evaluate((key) => localStorage.getItem(key), DRAFT);
    const oldWriterDocument = JSON.parse(oldWriterRaw);
    check(oldWriterRaw !== winnerRaw && oldWriterDocument[`${first.id}_1_load`] === "20",
      `the actual ${OLD_APP_SHA.slice(0, 8)} app publishes its flat input fields after the V2 tab closes`);
    await oldLiveWriter.close();
    page = await openApp(context);
    watch(page);
    const oldWriterRecovery = await rawState(page);
    const recoveredDraft = JSON.parse(oldWriterRecovery.raw);
    const recoveredExercise = recoveredDraft.exercises[recoveredDraft.session.selectedExerciseId];
    check(recoveredDraft.program.dayLabel === "Day 2" &&
      editedOf(recoveredExercise.sets[recoveredExercise.setOrder[0]], "load") === "80" &&
      oldWriterRecovery.recovery?.reason === "superseded-v2-canonical",
    "boot restores the full acknowledged Day 2 draft and retains overwritten legacy bytes", {
      day: recoveredDraft.program.dayLabel,
      load: editedOf(recoveredExercise.sets[recoveredExercise.setOrder[0]], "load"),
      recovery: oldWriterRecovery.recovery?.reason,
    });
    const legacyRaw = JSON.stringify({ __day: "Day 1", __date: "2026-08-21", __done: [], __touched: [], __warm: [] });
    await page.evaluate(({ raw }) => window.__repforgeWorkoutDraft.stageLegacy("draft-write", raw), { raw: legacyRaw });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    const promotedRecovery = await rawState(page);
    check(JSON.parse(promotedRecovery.raw).program.dayLabel === "Day 2" &&
      promotedRecovery.recovery?.reason === "superseded-v2-canonical",
    "boot restores acknowledged V2 after production sidecar promotion replays legacy bytes");

    await reset(page, { legacy: true });
    const staleRenameOldApp = await openOldApp(context);
    await staleRenameOldApp.evaluate(() => window.__repforgeEnterWorkout({day: "Day 1" }));
    await staleRenameOldApp.waitForSelector(`#workout:not(.is-focus) .exercise[data-ex="${first.id}"]`);
    await enter(page);
    await editLoad(page, "70");
    const capturedRename = await page.evaluate(() => {
      const hook = window.__repforgeWorkoutDraft, proposal = hook.state();
      proposal.program = proposal.program.map((exercise) => exercise.day === "Day 1" ? { ...exercise, day: "Push Day" } : exercise);
      return { proposal, effect: hook.effect.rename("Day 1", "Push Day", proposal) };
    });
    const newerRenameWinner = await editLoad(page, "80");
    const newerRenameRaw = (await rawState(page)).raw;
    const staleExactBoundary = await page.evaluate(({ effect, winnerRaw, draftKey }) => {
      const staleRaw = effect.effect.expectedRaw;
      localStorage.setItem(draftKey, staleRaw);
      const state = window.__repforgeWorkoutDraft.inspectEffect(effect);
      localStorage.setItem(draftKey, winnerRaw);
      return state;
    }, { effect: capturedRename.effect, winnerRaw: newerRenameRaw, draftKey: DRAFT });
    check(staleExactBoundary.status === "conflict" && staleExactBoundary.currentRaw === newerRenameRaw,
      "canonical bytes equal to an old receipt cannot hide a newer acknowledged V2 checkpoint", staleExactBoundary);
    await oldAppWriteSet(staleRenameOldApp, first.id, { load: "19", reps: "6", rir: "3" });
    const staleRename = await page.evaluate(async ({ proposal, effect }) => {
      const result = await window.__repforgeWorkoutDraft.commitEffect(proposal, effect);
      await window.__repforgeStorage.flush();
      return result;
    }, capturedRename);
    await staleRenameOldApp.close();
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    const afterStaleRename = await rawState(page);
    check(newerRenameWinner.status === "applied" && staleRename?.draftConflict === true &&
      afterStaleRename.raw === newerRenameRaw,
    "a stale rename cannot accept an old canonical overwrite over a newer acknowledged V2 checkpoint", {
      winner: newerRenameWinner.status, draftConflict: staleRename?.draftConflict,
      exactWinnerRecovered: afterStaleRename.raw === newerRenameRaw,
    });

    await reset(page, { legacy: true });
    const secondDayExercise = LEGACY.seedProgram().find((exercise) => exercise.day === "Day 2");
    const absentRename = await page.evaluate(() => {
      const hook = window.__repforgeWorkoutDraft, proposal = hook.state();
      proposal.program = proposal.program.map((exercise) => exercise.day === "Day 1" ? { ...exercise, day: "Push Day" } : exercise);
      return { proposal, effect: hook.effect.rename("Day 1", "Push Day", proposal) };
    });
    const absentRenameOldApp = await openOldApp(context);
    await enter(page);
    await editLoad(page, "84");
    const createdAfterAbsentRaw = (await rawState(page)).raw;
    const absentExactBoundary = await page.evaluate(({ effect, draftKey }) => {
      localStorage.removeItem(draftKey);
      const state = window.__repforgeWorkoutDraft.inspectEffect(effect);
      return state;
    }, { effect: absentRename.effect, draftKey: DRAFT });
    check(absentExactBoundary.status === "conflict" && absentExactBoundary.currentRaw === createdAfterAbsentRaw,
      "canonical absence cannot hide a newer acknowledged V2 checkpoint from an absent receipt", absentExactBoundary);
    await oldAppWriteSet(absentRenameOldApp, secondDayExercise.id, { load: "21", reps: "7", rir: "2" }, "Day 2");
    const absentRenameBoundary = await page.evaluate((effect) => {
      const raw = window.__repforgeWorkoutDraft.read().raw;
      const checkpoint = window.__repforgeWorkoutDraft.checkpoint();
      let legacyDay = null;
      try { legacyDay = JSON.parse(raw)?.__day ?? null; } catch {}
      return {
        expectedRawIsNull: effect.effect?.expectedRaw === null,
        legacyDay,
        checkpointRaw: checkpoint.value?.raw ?? null,
        state: window.__repforgeWorkoutDraft.inspectEffect(effect),
      };
    }, absentRename.effect);
    check(absentRenameBoundary.expectedRawIsNull && absentRenameBoundary.legacyDay === "Day 2" &&
      absentRenameBoundary.checkpointRaw === createdAfterAbsentRaw && absentRenameBoundary.state?.status === "conflict" &&
      absentRenameBoundary.state?.currentRaw === createdAfterAbsentRaw,
    "the originally absent receipt judges the acknowledged V2 checkpoint before the legacy canonical day", absentRenameBoundary);
    const absentRenameResult = await page.evaluate(async ({ proposal, effect }) => {
      const result = await window.__repforgeWorkoutDraft.commitEffect(proposal, effect);
      await window.__repforgeStorage.flush();return result;
    }, absentRename);
    await absentRenameOldApp.close();
    await page.reload({ waitUntil: "domcontentloaded" });await waitForBoot(page);
    const afterAbsentRename = await rawState(page);
    check(absentRenameResult?.draftConflict === true && afterAbsentRename.raw === createdAfterAbsentRaw,
      "an absent-draft rename cannot ignore a newer acknowledged same-day V2 behind a legacy Day 2 overwrite", {
        draftConflict: absentRenameResult?.draftConflict, exactWinnerRecovered: afterAbsentRename.raw === createdAfterAbsentRaw,
      });

    console.log("\n5. Removal and replacement rollback converge without resurrection");
    const activeRaw = afterAbsentRename.raw;
    const rollback = await page.evaluate(async (raw) => {
      const hook = window.__repforgeWorkoutDraft;
      const proposal = hook.state();
      proposal.program = [];
      proposal.programMeta = { ...proposal.programMeta, id: "replacement-proof", name: "Replacement proof" };
      const originalSetItem = Storage.prototype.setItem;
      const originalPut = IDBObjectStore.prototype.put;
      let localStateWrites = 0;
      let idbFinalFailed = false;
      Storage.prototype.setItem = function (key) {
        if (key === "repforge_v1" && ++localStateWrites === 2) {
          throw new DOMException("proof final local failure", "QuotaExceededError");
        }
        return originalSetItem.apply(this, arguments);
      };
      IDBObjectStore.prototype.put = function (value, key) {
        if (key === "repforge_v1" && !value?._storageDraftTransaction && !idbFinalFailed) {
          idbFinalFailed = true;
          throw new DOMException("proof final IDB failure", "QuotaExceededError");
        }
        return originalPut.apply(this, arguments);
      };
      try {
        const result = await hook.commitEffect(proposal, hook.effect.clear(raw));
        return { result, localStateWrites, idbFinalFailed,
          raw: localStorage.getItem("repforge_draft_v1"), checkpoint: hook.checkpoint() };
      } finally {
        Storage.prototype.setItem = originalSetItem;
        IDBObjectStore.prototype.put = originalPut;
      }
    }, activeRaw);
    check(rollback.result?.draftConflict === true && !rollback.result?.localOk && !rollback.result?.idbOk &&
      rollback.result?.compensationLocalOk === true && rollback.result?.compensationIdbOk === true && rollback.raw === activeRaw &&
      rollback.checkpoint.value?.kind === "committed" && rollback.checkpoint.value.raw === activeRaw,
    "a failed destructive program replacement restores both canonical and checkpoint V2", {
      rejected: rollback.result?.rejected,
      settled: rollback.result?.settled,
      result: Object.fromEntries(Object.entries(rollback.result || {}).filter(([, value]) =>
        value == null || ["string", "number", "boolean"].includes(typeof value))),
      localStateWrites: rollback.localStateWrites,
      idbFinalFailed: rollback.idbFinalFailed,
      rawRestored: rollback.raw === activeRaw,
      checkpointKind: rollback.checkpoint.value?.kind,
      checkpointRestored: rollback.checkpoint.value?.raw === activeRaw,
    });
    const postRemovalLegacy = await openOldApp(context);
    await postRemovalLegacy.evaluate(() => window.__repforgeEnterWorkout({day: "Day 1" }));
    await postRemovalLegacy.waitForSelector(`#workout:not(.is-focus) .exercise[data-ex="${first.id}"]`);
    const replacement = await page.evaluate(async () => {
      const hook = window.__repforgeWorkoutDraft;
      const raw = hook.read().raw;
      const proposal = hook.state();
      proposal.program = [];
      proposal.programMeta = { ...proposal.programMeta, id: "replacement-success", name: "Replacement success" };
      const result = await hook.commitEffect(proposal, hook.effect.clear(raw));
      await window.__repforgeStorage.flush();
      return { result, raw: localStorage.getItem("repforge_draft_v1"), checkpoint: hook.checkpoint() };
    });
    check((replacement.result?.localOk || replacement.result?.idbOk) && replacement.raw === null &&
      replacement.checkpoint.value?.kind === "tombstone",
    "a successful program replacement commits the draft-removal tombstone", replacement);
    await postRemovalLegacy.locator(`[data-k="${first.id}_1_load"]`).fill("40");
    await postRemovalLegacy.locator(`[data-k="${first.id}_1_reps"]`).fill("5");
    await postRemovalLegacy.locator(`[data-k="${first.id}_1_rir"]`).fill("4");
    const replacementSidecar = await postRemovalLegacy.waitForFunction(({ prefix, field }) => {
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (!key?.startsWith(prefix)) continue;
        try {
          const sidecar = JSON.parse(localStorage.getItem(key));
          if (JSON.parse(sidecar.raw || "{}")[field] === "40") return key;
        } catch {}
      }
      return false;
    }, { prefix: `${DRAFT}:pending:`, field: `${first.id}_1_load` }).then((handle) => handle.jsonValue());
    check(typeof replacementSidecar === "string",
      `the actual ${OLD_APP_SHA.slice(0, 8)} app stages its post-replacement write through the production sidecar`);
    await postRemovalLegacy.close();
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    const noResurrection = await rawState(page);
    check(noResurrection.raw === null && noResurrection.checkpoint?.kind === "tombstone",
      "the committed tombstone blocks a later legacy sidecar from remigration", noResurrection);

    await reset(page);
    await enter(page);
    const preRemoveRaw = (await rawState(page)).raw;
    const removeBefore = await page.evaluate(async () => {
      window.__repforgeDraftFault = "before-canonical-remove";
      return window.__repforgeWorkoutDraft.clear();
    });
    await page.close();
    page = await openApp(context);
    watch(page);
    const removeBeforeRecovery = await rawState(page);
    check(removeBefore === false && removeBeforeRecovery.raw === preRemoveRaw &&
      removeBeforeRecovery.checkpoint?.kind === "committed",
    "a crash before canonical removal rolls the pending tombstone back to the active draft");
    const removeAfter = await page.evaluate(async () => {
      window.__repforgeDraftFault = "after-canonical-remove";
      return window.__repforgeWorkoutDraft.clear();
    });
    await page.close();
    page = await openApp(context);
    watch(page);
    const removeAfterRecovery = await rawState(page);
    check(removeAfter === false && removeAfterRecovery.raw === null && removeAfterRecovery.checkpoint?.kind === "tombstone",
      "a crash after canonical removal finalizes the tombstone on boot");

    console.log("\n6. Missing, corrupt, and unreadable storage fail closed");
    await reset(page);
    await enter(page);
    const protectedRaw = (await rawState(page)).raw;
    const missingCheckpoint = await page.evaluate(async (key) => {
      localStorage.removeItem(key);
      return window.__repforgeWorkoutDraft.reconcile();
    }, CHECKPOINT);
    const afterMissing = await rawState(page);
    check(missingCheckpoint.status === "checkpoint-missing" && afterMissing.raw === protectedRaw &&
      afterMissing.recovery?.raw === protectedRaw,
      "a V2 canonical value without its checkpoint is retained for recovery and never rendered as valid");
    await reset(page);
    await enter(page);
    const invalidCheckpoint = await page.evaluate(async (key) => {
      localStorage.setItem(key, "{corrupt");
      return window.__repforgeWorkoutDraft.reconcile();
    }, CHECKPOINT);
    const afterInvalid = await rawState(page);
    check(invalidCheckpoint.status === "checkpoint-unreadable" && afterInvalid.raw !== null &&
      afterInvalid.recovery?.reason === "v2-checkpoint-unreadable",
      "a corrupt checkpoint fails closed while retaining canonical recovery bytes");
    await reset(page);
    await enter(page);
    const checkpointReadFault = await page.evaluate(async (key) => {
      const original = Storage.prototype.getItem;
      Storage.prototype.getItem = function (candidate) {
        if (candidate === key) throw new DOMException("proof checkpoint read failure", "SecurityError");
        return original.apply(this, arguments);
      };
      try { return await window.__repforgeWorkoutDraft.reconcile(); }
      finally { Storage.prototype.getItem = original; }
    }, CHECKPOINT);
    check(checkpointReadFault.status === "checkpoint-unreadable",
      "a checkpoint read exception fails closed");

    await reset(page);
    await enter(page);
    const readFault = await page.evaluate(async () => {
      const hook = window.__repforgeWorkoutDraft;
      const raw = hook.read().raw;
      const proposal = hook.state();
      proposal.programMeta = { ...proposal.programMeta, name: "Must not commit" };
      const original = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        if (key === "repforge_draft_v1") throw new DOMException("proof read failure", "SecurityError");
        return original.apply(this, arguments);
      };
      try {
        const result = await hook.commitEffect(proposal, hook.effect.clear(raw));
        return { result, checkpoint: hook.checkpoint() };
      } finally {
        Storage.prototype.getItem = original;
      }
    });
    const afterReadFault = await rawState(page);
    check(!(readFault.result?.localOk || readFault.result?.idbOk) && afterReadFault.raw !== null &&
      afterReadFault.checkpoint?.kind === "committed",
    "a canonical read exception rejects replacement and preserves acknowledged V2", readFault);

    console.log("\n7. Recovery actions preserve pending input and reject stale destructive choices");
    await reset(page, { lang: "pt", unit: "lb" });
    await enter(page);
    let loadInput = await shelfInput(page, "load");
    let loadKey = await loadInput.getAttribute("data-k");
    await loadInput.fill("150");
    await (await shelfInput(page, "reps")).fill("8");
    await (await shelfInput(page, "rir")).fill("2");
    await page.locator("#workout .exercise.is-current .focus-shelf .saveset").click();
    await page.waitForFunction(() => {
      const draft = window.__repforgeWorkoutDraft.current(), exercise = draft.exercises[draft.session.selectedExerciseId];
      return exercise.sets[exercise.setOrder[0]].completion !== "pending";
    });
    loadInput = await shelfInput(page, "load");
    loadKey = await loadInput.getAttribute("data-k");
    const durableBeforeFailure = (await rawState(page)).raw;
    const durableLoad = await page.evaluate((key) => {
      const draft = window.__repforgeWorkoutDraft.current(), target = window.__repforgeWorkoutDraft.target(key);
      return draft.exercises[target.exerciseInstanceId].sets[target.setId].edited.metrics[target.metricId];
    }, loadKey);
    await page.evaluate((checkpointKey) => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key) {
        if (key === checkpointKey) {
          Storage.prototype.setItem = original;
          throw new DOMException("proof draft checkpoint quota", "QuotaExceededError");
        }
        return original.apply(this, arguments);
      };
    }, CHECKPOINT);
    await loadInput.fill("157,1");
    await page.waitForSelector("#draftRecovery:not(.hidden)");
    const persistRecovery = await page.evaluate(({ draftKey, loadKey }) => {
      window.__draftRecoveryCopied = null;
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        writeText(value) { window.__draftRecoveryCopied = value; return Promise.resolve(); }
      }});
      const draft = window.__repforgeWorkoutDraft.current();
      const target = window.__repforgeWorkoutDraft.target(loadKey);
      return {
        raw: localStorage.getItem(draftKey),
        savedLoad: draft.exercises[target.exerciseInstanceId].sets[target.setId].edited.metrics[target.metricId],
        title: document.querySelector("#draftRecoveryTitle")?.textContent,
        pending: document.querySelector("#draftRecoveryPending")?.textContent,
      };
    }, { draftKey: DRAFT, loadKey });
    check(persistRecovery.raw === durableBeforeFailure && persistRecovery.savedLoad === durableLoad &&
      /ainda não foi salva/i.test(persistRecovery.title) && persistRecovery.pending.includes("157,1"),
    "quota failure leaves the acknowledged revision unchanged and shows the typed PT-BR pound value beside Retry",
    persistRecovery);
    const finishWhilePending = await page.evaluate(() => window.__repforgeSaveWorkout());
    const afterBlockedFinish = await rawState(page);
    check(finishWhilePending?.reason === "recovery-pending" && afterBlockedFinish.raw === durableBeforeFailure &&
      afterBlockedFinish.state.log.length === 0 &&
      await page.locator("#draftRecoveryPending").innerText().then((text) => text.includes("157,1")),
    "Finish cannot compile the older acknowledged set while its correction awaits recovery", {
      result: finishWhilePending, draftUnchanged: afterBlockedFinish.raw === durableBeforeFailure,
      historyRows: afterBlockedFinish.state.log.length,
    });
    const repsInput = await shelfInput(page, "reps");
    await repsInput.fill("11");
    await page.waitForFunction(() => document.querySelector("#draftRecoveryPending")?.textContent.includes("157,1"));
    const blockedFollowup = await page.evaluate(({ draftKey, loadKey, repsId }) => {
      const raw = localStorage.getItem(draftKey), draft = JSON.parse(raw);
      const target = window.__repforgeWorkoutDraft.target(loadKey), set = draft.exercises[target.exerciseInstanceId].sets[target.setId];
      return { raw, load: set.edited.metrics[target.metricId], reps: set.edited.metrics[repsId],
        pending: document.querySelector("#draftRecoveryPending")?.textContent };
    }, { draftKey: DRAFT, loadKey, repsId: REPS });
    check(blockedFollowup.raw === durableBeforeFailure && blockedFollowup.load === durableLoad &&
      blockedFollowup.pending.includes("157,1") && blockedFollowup.reps !== "11",
    "later edits cannot hide or supersede the unresolved operation", blockedFollowup);
    await page.locator("#draftRecoveryCopy").click();
    await page.waitForFunction(() => window.__draftRecoveryCopied === "157,1");
    await page.locator("#draftRecoveryRetry").click();
    await page.waitForFunction(({ loadKey }) => {
      const draft = window.__repforgeWorkoutDraft.current(), target = window.__repforgeWorkoutDraft.target(loadKey);
      return draft.exercises[target.exerciseInstanceId].sets[target.setId].edited.metrics[target.metricId] != null &&
        document.querySelector("#draftRecovery")?.classList.contains("hidden");
    }, { loadKey });
    await page.waitForFunction((key) => document.activeElement?.dataset?.k === key, loadKey);
    // R7 C-01: the restored focus is the control the lifter can use (live: in the tab order, in the accessibility
    // tree), not the shelf's dormant input for that field.
    const retryFocus = await page.evaluate((key) => {
      const el = document.activeElement;
      return { key: el?.dataset?.k === key, live: !!el && el.tabIndex >= 0 && !el.closest("[aria-hidden='true']") };
    }, loadKey);
    check(retryFocus.key && retryFocus.live,
      "Retry persists the exact operation and restores its logical field focus on the live control", retryFocus);

    await reset(page);
    await enter(page);
    loadInput = await shelfInput(page, "load");
    loadKey = await loadInput.getAttribute("data-k");
    const stalePage = await openApp(context);watch(stalePage);await enter(stalePage);
    await fillCurrent(page, "load", "80");
    const winnerAfterStale = (await rawState(page)).raw;
    const staleInput = await shelfInput(stalePage, "load");
    await staleInput.fill("90");
    await stalePage.waitForSelector("#draftRecovery:not(.hidden)");
    const staleUi = await stalePage.evaluate(() => ({
      title: document.querySelector("#draftRecoveryTitle")?.textContent,
      pending: document.querySelector("#draftRecoveryPending")?.textContent,
      reloadVisible: !document.querySelector("#draftRecoveryReload")?.classList.contains("hidden"),
      retryVisible: !document.querySelector("#draftRecoveryRetry")?.classList.contains("hidden"),
    }));
    check(/newer workout/i.test(staleUi.title) && staleUi.pending.includes("90") &&
      staleUi.reloadVisible && !staleUi.retryVisible,
    "a stale tab offers Reload latest and preserves its pending field for copy", staleUi);
    await stalePage.locator("#draftRecoveryReload").click();
    await stalePage.waitForFunction(({ draftKey, winner }) => localStorage.getItem(draftKey) === winner &&
      document.querySelector("#draftRecovery")?.classList.contains("hidden"),
    { draftKey: DRAFT, winner: winnerAfterStale });
    await stalePage.waitForFunction((key) => document.activeElement?.dataset?.k === key, loadKey);
    check(await staleInput.inputValue() === "80" &&
      await stalePage.evaluate((key) => document.activeElement?.dataset?.k === key, loadKey),
    "Reload latest renders the winning revision and restores the same field focus");
    await stalePage.close();

    await reset(page);
    const lockUnavailable = await page.evaluate(async () => {
      const locks = navigator.locks, original = locks.request;
      Object.defineProperty(locks, "request", { configurable: true, value: undefined });
      try { return await window.__repforgeEnterWorkout({day: "Day 1" }); }
      finally { delete locks.request; window.__draftLockRestored = typeof navigator.locks.request === "function" && !!original; }
    });
    await page.waitForSelector("#draftRecovery:not(.hidden)");
    check(lockUnavailable === false && await page.locator("#draftRecoveryTitle").innerText() === "Workout storage is unavailable",
      "first Start fails closed with an actionable lock-unavailable message");
    await page.locator("#draftRecoveryRetry").click();
    await page.waitForSelector("#workout.is-focus .exercise.is-current");
    check(await page.evaluate(() => window.__draftLockRestored && document.querySelector("#draftRecovery")?.classList.contains("hidden")),
      "Retry repeats first-start creation and enters the workout after the lock returns");

    const staleProgramWinner = await commandFixture(page, "load", "88", "stale-program-winner");
    const persistedWinner = await page.evaluate((command) => window.__repforgeWorkoutDraft.cas({
      expectedDraftId: command.expectedDraftId, expectedRevision: command.expectedRevision,
      nextRaw: command.nextRaw, operationId: command.operationId,
    }), staleProgramWinner);
    const staleProgramRaw = (await rawState(page)).raw;
    check(persistedWinner?.status === "applied" && staleProgramRaw === staleProgramWinner.nextRaw,
      "stale proof persists typed lifter input before the program changes", { status: persistedWinner?.status });
    const changedState = JSON.parse(await page.evaluate((key) => localStorage.getItem(key), STATE));
    changedState.programMeta = { ...changedState.programMeta, name: "Changed program" };
    changedState.program = changedState.program.map((exercise) => ({ ...exercise, notes: `${exercise.notes || ""} changed` }));
    changedState._storageRevision += 1;
    await writeState(page, changedState);
    await page.reload({ waitUntil: "domcontentloaded" });await waitForBoot(page);
    await page.waitForSelector("#draftRecovery:not(.hidden)");
    const staleProgramUi = await page.evaluate((draftKey) => ({
      raw: localStorage.getItem(draftKey), title: document.querySelector("#draftRecoveryTitle")?.textContent,
      discardVisible: !document.querySelector("#draftRecoveryDiscard")?.classList.contains("hidden")
    }), DRAFT);
    check(staleProgramUi.raw === staleProgramRaw && /earlier program/i.test(staleProgramUi.title) && staleProgramUi.discardVisible,
      "a stale-program draft remains byte-exact and offers an explicit discard", staleProgramUi);
    const staleProgramRace = await commandFixture(page, "load", "89", "stale-program-winner-2");
    await page.evaluate(({ command, checkpointKey }) => {
      const next = JSON.parse(command.nextRaw);
      window.confirm = () => {
        localStorage.setItem("repforge_draft_v1", command.nextRaw);
        localStorage.setItem(checkpointKey, JSON.stringify({ version: 1, kind: "committed",
          draftId: next.draftId, revision: next.revision, operationId: command.operationId,
          programFingerprint: next.program.programFingerprint, raw: command.nextRaw }));
        return true;
      };
    }, { command: staleProgramRace, checkpointKey: CHECKPOINT });
    const discardResult = await page.evaluate(() => window.__repforgeWorkoutDraft.discardRecovery());
    const afterStaleDiscard = await rawState(page);
    await page.reload({ waitUntil: "domcontentloaded" });await waitForBoot(page);
    const reloadedStaleDiscard = await rawState(page);
    check(discardResult === false && afterStaleDiscard.raw === staleProgramRace.nextRaw &&
      afterStaleDiscard.checkpoint?.raw === staleProgramRace.nextRaw &&
      reloadedStaleDiscard.raw === staleProgramRace.nextRaw,
      "discard uses the displayed draft identity and cannot remove a newer winner created during confirmation", {
      discardResult, canonicalPreserved: afterStaleDiscard.raw === staleProgramRace.nextRaw,
      checkpointPreserved: afterStaleDiscard.checkpoint?.raw === staleProgramRace.nextRaw,
      reloadPreserved: reloadedStaleDiscard.raw === staleProgramRace.nextRaw,
    });

    await reset(page);
    await enter(page);
    const pristineStart = await rawState(page);
    const pristineDraft = JSON.parse(pristineStart.raw || "null");
    check(pristineDraft?.schemaVersion === 2,
      "pristine stale proof starts from an untouched DraftV2", { revision: pristineDraft?.revision });
    const changedPristine = JSON.parse(await page.evaluate((key) => localStorage.getItem(key), STATE));
    changedPristine.program = changedPristine.program.map((exercise) => ({ ...exercise, notes: `${exercise.notes || ""} changed` }));
    changedPristine._storageRevision += 1;
    await writeState(page, changedPristine);
    await page.reload({ waitUntil: "domcontentloaded" });await waitForBoot(page);
    const enteredPristine = await page.evaluate(() => window.__repforgeEnterWorkout({day: "Day 1" }));
    await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 5000 });
    const afterPristine = await rawState(page);
    const afterPristineDraft = JSON.parse(afterPristine.raw || "null");
    const pristineRecoveryHidden = await page.evaluate(() => document.querySelector("#draftRecovery")?.classList.contains("hidden"));
    check(enteredPristine !== false && pristineRecoveryHidden === true &&
      afterPristineDraft?.schemaVersion === 2 && afterPristineDraft?.revision === 0 &&
      afterPristineDraft?.draftId !== pristineDraft?.draftId &&
      afterPristine.checkpoint?.kind === "committed" && afterPristine.checkpoint?.raw === afterPristine.raw &&
      afterPristineDraft?.program?.programFingerprint !== pristineDraft?.program?.programFingerprint,
    "a pristine stale-program draft is replaced without recovery UI", {
      entered: enteredPristine !== false, recoveryHidden: pristineRecoveryHidden,
      replaced: afterPristineDraft?.draftId !== pristineDraft?.draftId,
      checkpointCommitted: afterPristine.checkpoint?.kind,
    });

    await page.evaluate(({ draftKey, checkpointKey }) => {
      localStorage.setItem(draftKey, "{invalid legacy");localStorage.removeItem(checkpointKey);
    }, { draftKey: DRAFT, checkpointKey: CHECKPOINT });
    await page.reload({ waitUntil: "domcontentloaded" });await waitForBoot(page);
    await page.waitForSelector("#draftRecovery:not(.hidden)");
    const invalidUi = await page.evaluate((draftKey) => ({ raw: localStorage.getItem(draftKey),
      title: document.querySelector("#draftRecoveryTitle")?.textContent,
      copyVisible: !document.querySelector("#draftRecoveryCopy")?.classList.contains("hidden"),
      discardVisible: !document.querySelector("#draftRecoveryDiscard")?.classList.contains("hidden")
    }), DRAFT);
    check(invalidUi.raw === "{invalid legacy" && /needs recovery/i.test(invalidUi.title) &&
      invalidUi.copyVisible && !invalidUi.discardVisible,
    "invalid legacy bytes remain untouched with a non-destructive copy action", invalidUi);

    // Issue 321: a well-formed legacy flat draft whose exercise still exists, but
    // whose __touched marker cannot be expressed against the current canonical
    // program's per-metric composition, must not open an empty workout screen
    // with no notice. It reuses the stale-program recovery banner and offers
    // both actions: export (copy) and clear and start fresh (discard).
    await reset(page);
    const metricExercise = seedProgram()[0];
    const unmigratableLegacyDraft = {
      [`${metricExercise.id}_1_load`]: "60",
      [`${metricExercise.id}_1_reps`]: "8",
      [`${metricExercise.id}_1_rir`]: "2",
      __touched: [`${metricExercise.id}_1`],
      __day: "Day 1",
    };
    await page.evaluate(({ draftKey, checkpointKey, draft }) => {
      localStorage.setItem(draftKey, JSON.stringify(draft));
      localStorage.removeItem(checkpointKey);
    }, { draftKey: DRAFT, checkpointKey: CHECKPOINT, draft: unmigratableLegacyDraft });
    await page.reload({ waitUntil: "domcontentloaded" });await waitForBoot(page);
    await page.waitForSelector("#draftRecovery:not(.hidden)");
    const invalidMigratedRaw = JSON.stringify(unmigratableLegacyDraft);
    const invalidMigratedUi = await page.evaluate((draftKey) => ({ raw: localStorage.getItem(draftKey),
      title: document.querySelector("#draftRecoveryTitle")?.textContent,
      body: document.querySelector("#draftRecoveryBody")?.textContent,
      copyVisible: !document.querySelector("#draftRecoveryCopy")?.classList.contains("hidden"),
      discardVisible: !document.querySelector("#draftRecoveryDiscard")?.classList.contains("hidden"),
    }), DRAFT);
    check(invalidMigratedUi.raw === invalidMigratedRaw && /earlier program/i.test(invalidMigratedUi.title) &&
      invalidMigratedUi.copyVisible && invalidMigratedUi.discardVisible,
    "a legacy draft that cannot migrate against the current metric-backed program shows the earlier-program notice with export and clear",
    invalidMigratedUi);
    await page.evaluate(() => {
      window.__draftRecoveryCopied = null;
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        writeText(value) { window.__draftRecoveryCopied = value; return Promise.resolve(); },
      } });
    });
    await page.locator("#draftRecoveryCopy").click();
    await page.waitForFunction((expected) => window.__draftRecoveryCopied === expected, invalidMigratedRaw);
    check(true, "export (keep in recovery) copies the exact unmigrated raw bytes, never a repaired or guessed draft");
    await page.evaluate(() => { window.confirm = () => true; });
    await page.locator("#draftRecoveryDiscard").click();
    await page.waitForFunction((draftKey) => localStorage.getItem(draftKey) === null &&
      document.querySelector("#draftRecovery")?.classList.contains("hidden"), DRAFT);
    const enteredAfterDiscard = await page.evaluate((label) => window.__repforgeEnterWorkout({ day: label }), "Day 1");
    await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 5000 });
    const freshAfterDiscard = JSON.parse((await rawState(page)).raw || "null");
    check(enteredAfterDiscard !== false && freshAfterDiscard?.schemaVersion === 2 &&
      freshAfterDiscard.draftId !== unmigratableLegacyDraft.draftId,
    "clear and start fresh removes the unmigratable legacy draft and opens an ordinary new DraftV2 workout",
    freshAfterDiscard);

    check(errors.length === 0, "the production storage/DOM journey emits no page or console errors", errors);
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
