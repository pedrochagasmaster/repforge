#!/usr/bin/env node
/**
 * A set the engine has no suggestion for prefills from the set logged above it (owner decision, 2026-10-29).
 *
 * Whenever the engine does not recommend a set (manual, waiting on its setup, no history, no fitting load, …), the set
 * shows the load, reps and RIR (or effort) of the nearest working set logged above it on the same exercise this session,
 * grey like a suggestion. Nothing is stored until the set is logged, and Log set logs what it shows. Set 1 falls back to
 * the previous session's set; warm-ups neither give nor take; a value the lifter typed wins; a set the engine does
 * recommend keeps the engine's values. Driven through Focus in metric-backed DraftV2:
 *
 * 1. An adaptive set the engine declines (no load in the lifter's steps fits) takes load, reps and RIR from set 1.
 * 2. A set the engine recommends keeps the engine's values.
 * 3. A manual set carries reps and RIR as well as load; the ledger's open row matches the shelf; a reload derives the
 *    same prefill; Log set stores what was shown.
 * 4. A typed value wins over the carry, field by field.
 * 5. Warm-ups neither give nor take.
 * 6. Set 1 of the next session falls back to the previous session's set.
 * 7. Portuguese, and effort mode.
 *
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { readFileSync } from "node:fs";
import { launchChromium } from "./browser.mjs";
import { openCatalogState } from "./fixtures/catalog-state.mjs";
import { finishEarly } from "./fixtures/focus-workout.mjs";
import { seedProgramMeta } from "./fixtures/seed-program.mjs";

// The seed and generated programs' movements record catalog metrics: Weight (kg) and Reps.
const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";
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
  preferredExerciseIds: [], split: "auto", periodization: "static", cycles: 7, deloadCycles: [],
};

const failures = [];
let passed = 0;
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 2500)}`);
}

/** Set up `definition` on a fresh device in `lang`, optionally in effort mode, and open Focus on `day` (or the first). */
async function start(browser, definition, { lang = "en", effort = false, day } = {}) {
  const opened = await openCatalogState(browser, "today/no-program", 390, lang, "normal");
  const { page } = opened;
  await page.evaluate(async ({ programDefinition, effort }) => {
    await window.__repforgeFinalizeProgramSetup({
      programDefinition, name: "Prefill", answers: {}, destination: "log", origin: "first-run",
      draftConfirmed: true, telemetryRoute: "recommend", entrySource: { route: "recommend", fingerprint: "prefill-last-set" },
    });
    await window.__repforgeStorage.flush();
    if (effort) {
      const raw = JSON.parse(localStorage.getItem("repforge_v1"));
      raw.settings = { ...raw.settings, rirMode: "effort" };
      localStorage.setItem("repforge_v1", JSON.stringify(raw));
      await new Promise((resolve, reject) => {
        const open = indexedDB.open("repforge", 1);
        open.onsuccess = () => {
          const tx = open.result.transaction("kv", "readwrite");
          tx.objectStore("kv").put(raw, "repforge_v1");
          tx.oncomplete = () => { open.result.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      });
    }
  }, { programDefinition: definition, effort });
  if (effort) await reboot(page);
  await enterFocus(page, day);
  return opened;
}

async function reboot(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
}

async function enterFocus(page, day) {
  await page.evaluate((label) => window.__repforgeEnterWorkout(label ? { day: label } : {}), day);
  await page.waitForSelector("#workout .exercise.is-current .focus-shelf .saveset", { timeout: 20000 });
}

/** The generated program and the first training day whose first slot weighs and counts at least four sets. */
async function generated(page) {
  return page.evaluate(({ request, weight, reps }) => {
    const result = window.RepForgeProgramCompiler.generateProgram(request, window.RepForgeExerciseCatalog.snapshot());
    if (!result.ok) return { error: "generation failed" };
    const target = result.value.days.filter((day) => day.kind === "training").map((day) => ({ day, slot: day.slots[0] }))
      .find(({ slot }) => JSON.stringify(slot.metricIds) === JSON.stringify([weight, reps]) && slot.prescriptionsByCycle[0].sets.length >= 3);
    return target ? { definition: result.value, day: target.day.name, slotId: target.slot.id } : { error: "no weighted first slot" };
  }, { request: REQUEST, weight: WEIGHT, reps: REPS });
}

/** What the live shelf, its spinner and the ledger's open row show, and what the draft holds for set `n`. */
const reading = (page, n) => page.evaluate(({ n, weight, reps }) => {
  const art = document.querySelector("#workout .exercise.is-current");
  const id = art.dataset.ex;
  const stored = window.__repforgeWorkoutDraft.current().exercises[id];
  const set = Object.values(stored.sets).find((item) => item.ordinal === n);
  const field = (selector) => art.querySelector(`.focus-shelf ${selector}`);
  const face = (node) => node ? { value: node.querySelector(".shelf__val")?.textContent.trim(), grey: node.classList.contains("is-untouched") } : null;
  const effortButton = art.querySelector(".focus-shelf [data-effspin]");
  const rirField = [...art.querySelectorAll(".focus-shelf .shelf__field")].find((node) => node.querySelector("[data-shelf-field='rir']"));
  const row = art.querySelector(".ledgerline--open");
  const cell = (lv) => row ? { value: row.querySelector(`[data-lv='${lv}']`)?.textContent.trim(), soft: !!row.querySelector(`[data-lv='${lv}']`)?.classList.contains("is-soft") } : null;
  return {
    id,
    active: art.querySelector(".focus-shelf .saveset")?.dataset.save?.split("_").at(-1),
    load: face(field(`.shelf__field[data-metric='${weight}']`)),
    reps: face(field(`.shelf__field[data-metric='${reps}']`)),
    rir: face(rirField),
    effort: effortButton?.dataset.e ?? null,
    ledger: { load: cell("load"), reps: cell("reps"), rir: cell("rir") },
    stored: set ? {
      done: set.completion !== "pending", role: set.role,
      load: set.edited.metrics?.[weight] ?? null, reps: set.edited.metrics?.[reps] ?? null, rir: set.edited.rir, effort: set.edited.effort,
      touched: set.touched,
    } : null,
  };
}, { n, weight: WEIGHT, reps: REPS });

/** Type the lifter's own values into the live shelf's inputs; an effort word is set through the draft and repainted. */
async function enter(page, values) {
  await page.evaluate(({ values, weight, reps }) => {
    const shelf = document.querySelector("#workout .exercise.is-current .focus-shelf");
    const inputs = { load: shelf.querySelector(`.shelf__input[data-metric-id='${weight}']`),
      reps: shelf.querySelector(`.shelf__input[data-metric-id='${reps}']`), rir: shelf.querySelector(".shelf__input[data-k$='_rir']") };
    for (const field of ["load", "reps", "rir"]) {
      if (values[field] == null) continue;
      inputs[field].value = values[field];
      inputs[field].dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, { values, weight: WEIGHT, reps: REPS });
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  if (values.effort == null) return;
  await page.evaluate(async (effort) => {
    const art = document.querySelector("#workout .exercise.is-current");
    const id = art.dataset.ex, hook = window.__repforgeWorkoutDraft;
    const ordinal = +art.querySelector(".focus-shelf .saveset").dataset.save.split("_").at(-1);
    const setId = hook.current().exercises[id].setOrder.find((candidate) => hook.current().exercises[id].sets[candidate].ordinal === ordinal);
    await hook.dispatch("editSetField", { exerciseInstanceId: id, setId, field: "effort", value: effort });
    await hook.flush();
  }, values.effort);
  await reboot(page);
  await enterFocus(page);
}

/** Log the live set exactly as shown, and wait until the draft records it. */
async function logShown(page) {
  const before = await page.evaluate(() => {
    const art = document.querySelector("#workout .exercise.is-current");
    const stored = window.__repforgeWorkoutDraft.current().exercises[art.dataset.ex];
    return { id: art.dataset.ex, done: Object.values(stored.sets).filter((set) => set.completion !== "pending").length };
  });
  await page.locator("#workout .exercise.is-current .focus-shelf .saveset").evaluate((button) => button.click());
  await page.waitForFunction(({ id, done }) => {
    const stored = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
    return !!stored && Object.values(stored.sets).filter((set) => set.completion !== "pending").length > done;
  }, before, { timeout: 20000 });
  // The suggestion refresh that follows a logged set settles before anything reads or finishes the session.
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

/** Move Focus to the exercise the session map lists at `index`, or to the exercise with id `id`. */
async function jumpTo(page, { index, id }) {
  await page.locator("#sessionSheetBtn").click();
  const jump = id ? page.locator(`[data-session-map-jump="${id}"]`) : page.locator("[data-session-map-jump]").nth(index);
  const target = await jump.getAttribute("data-session-map-jump");
  await jump.click();
  await page.waitForFunction((wanted) => document.querySelector("#workout .exercise.is-current")?.dataset.ex === wanted, target, { timeout: 20000 });
  await page.waitForSelector("#sessionSheet:not(.is-open)", { state: "attached", timeout: 20000 });
}

/** Mark set `n` of the live exercise a warm-up, then come back to it. */
async function markWarmup(page, n) {
  const id = await page.evaluate(async (n) => {
    const id = document.querySelector("#workout .exercise.is-current").dataset.ex, hook = window.__repforgeWorkoutDraft;
    const setId = hook.current().exercises[id].setOrder.find((candidate) => hook.current().exercises[id].sets[candidate].ordinal === n);
    await hook.dispatch("markWarmup", { exerciseInstanceId: id, setId });
    await hook.flush();
    return id;
  }, n);
  await reboot(page);
  await enterFocus(page);
  if (await page.evaluate(() => document.querySelector("#workout .exercise.is-current")?.dataset.ex) !== id) await jumpTo(page, { id });
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const untouched = (stored) => stored && !stored.touched.effort && !Object.values(stored.touched.metrics || {}).some(Boolean);

const browser = await launchChromium();
try {
  console.log("\n1–2. An adaptive slot: a set the engine declines takes set 1's values; one it recommends keeps the engine's");
  {
    const { context, page } = await openCatalogState(browser, "today/no-program", 390, "en", "normal");
    let program;
    try { program = await generated(page); } finally { await context.close(); }
    if (program.error) check(false, program.error);
    else {
      // No load in the lifter's steps fits 1.3 kg for the range, so the engine declines set 2.
      let opened = await start(browser, program.definition, { day: program.day });
      try {
        const { page } = opened;
        await enter(page, { load: "1.3", reps: "15", rir: "2" });
        await logShown(page);
        let r = await reading(page, 2);
        check(r.active === "2" && same([r.load, r.reps, r.rir], [{ value: "1.3", grey: true }, { value: "15", grey: true }, { value: "2", grey: true }]),
          "a declined adaptive set 2 shows set 1's 1.3 / 15 / 2, grey", r);
        check(r.stored.load == null && r.stored.reps == null && untouched(r.stored), "the prefill stores nothing for set 2", r.stored);
        check(same([r.ledger.load, r.ledger.reps, r.ledger.rir], [{ value: "1.3", soft: true }, { value: "15", soft: true }, { value: "2", soft: true }]),
          "the ledger's open row shows the same 1.3 / 15 / 2, soft", r.ledger);
        await logShown(page);
        r = await reading(page, 2);
        check(r.stored.done && Number(r.stored.load) === 1.3 && Number(r.stored.reps) === 15 && Number(r.stored.rir) === 2,
          "logging set 2 untouched stores 1.3 / 15 / 2", r.stored);
      } finally { await opened.context.close(); }

      // 82.5 × 15 at RIR 2 gives the engine an anchor: set 2 is recommended and keeps its values.
      opened = await start(browser, program.definition, { day: program.day });
      try {
        const { page } = opened;
        await enter(page, { load: "82.5", reps: "15", rir: "2" });
        await logShown(page);
        const r = await reading(page, 2);
        check(r.load.value !== "82.5" && Number(r.load.value) === Number(r.stored.load) && Number(r.reps.value) === Number(r.stored.reps) &&
          r.load.grey && r.reps.grey && r.rir.value !== "2",
        "a recommended set 2 shows the engine's acknowledged load and reps, not set 1's", r);
      } finally { await opened.context.close(); }
    }
  }

  console.log("\n3–6. A manual slot: reps and RIR carry with the load, typed values win, warm-ups sit out, set 1 falls back");
  {
    const { context, page } = await start(browser, seedProgramMeta({}).programDefinition);
    try {
      let r = await reading(page, 1);
      check(r.load.value === "—" && r.rir.value === "1", "with nothing logged and no history, set 1 reads — and RIR 1", r);
      await enter(page, { load: "32.5", reps: "8", rir: "3" });
      await logShown(page);
      r = await reading(page, 2);
      check(same([r.load, r.reps, r.rir], [{ value: "32.5", grey: true }, { value: "8", grey: true }, { value: "3", grey: true }]),
        "manual set 2 carries reps and RIR as well as load: 32.5 / 8 / 3, grey", r);
      check(same([r.ledger.load.value, r.ledger.reps.value, r.ledger.rir.value], ["32.5", "8", "3"]) &&
        r.ledger.load.soft && r.ledger.reps.soft && r.ledger.rir.soft, "the ledger's open row matches the shelf", r.ledger);
      check(r.stored.load == null && untouched(r.stored), "nothing is stored for set 2 before it is logged", r.stored);

      await reboot(page);
      await enterFocus(page);
      r = await reading(page, 2);
      check(same([r.load, r.reps, r.rir], [{ value: "32.5", grey: true }, { value: "8", grey: true }, { value: "3", grey: true }]) &&
        r.stored.load == null && untouched(r.stored), "after a reload the same prefill is derived, still storing nothing", r);

      // The lifter types reps 10: the reps are theirs, the load and RIR still carry.
      await enter(page, { reps: "10" });
      r = await reading(page, 2);
      check(same([r.load, r.reps, r.rir], [{ value: "32.5", grey: true }, { value: "10", grey: false }, { value: "3", grey: true }]),
        "a typed reps 10 wins and is the lifter's own; load and RIR still carry", r);
      await logShown(page);
      r = await reading(page, 2);
      check(r.stored.done && Number(r.stored.load) === 32.5 && Number(r.stored.reps) === 10 && Number(r.stored.rir) === 3,
        "Log set stores the carried 32.5 and RIR 3 with the typed 10", r.stored);

      // The second exercise: set 1 is a warm-up logged at 20 × 12, RIR 4, and gives set 2 nothing.
      await jumpTo(page, { index: 1 });
      await markWarmup(page, 1);
      await enter(page, { load: "20", reps: "12", rir: "4" });
      await logShown(page);
      r = await reading(page, 2);
      check(r.active === "2" && r.load.value === "—" && r.reps.value !== "12" && r.rir.value !== "4",
        "a logged warm-up gives the working set after it nothing", r);
      // The third exercise: set 1 at 30 × 8, RIR 2; set 2 marked a warm-up takes nothing.
      await jumpTo(page, { index: 2 });
      await enter(page, { load: "30", reps: "8", rir: "2" });
      await logShown(page);
      await markWarmup(page, 2);
      r = await reading(page, 2);
      check(r.active === "2" && r.stored.role === "warmup" && r.load.value === "—" && r.reps.value !== "8",
        "a pending warm-up takes nothing from the set logged above it", r);
      // A set marked a warm-up is the lifter's change, so finishing would check it; it goes back to a working set first.
      await page.evaluate(async () => {
        const hook = window.__repforgeWorkoutDraft, id = document.querySelector("#workout .exercise.is-current").dataset.ex;
        const setId = hook.current().exercises[id].setOrder.find((candidate) => hook.current().exercises[id].sets[candidate].ordinal === 2);
        await hook.dispatch("markWorking", { exerciseInstanceId: id, setId });
        await hook.flush();
      });
      const finished = await finishEarly(page);
      check(finished?.localOk || finished?.idbOk, "the session is saved", finished);

      // The next session: set 1 has nothing above it and falls back to the previous session's set 1.
      await enterFocus(page);
      r = await reading(page, 1);
      check(same([r.load.value, r.reps.value, r.rir.value], ["32.5", "8", "3"]),
        "set 1 of the next session falls back to the previous session's 32.5 / 8 / 3", r);
    } finally { await context.close(); }
  }

  console.log("\n7. Portuguese, and effort mode");
  {
    let opened = await start(browser, seedProgramMeta({}).programDefinition, { lang: "pt" });
    try {
      const { page } = opened;
      await enter(page, { load: "32.5", reps: "8", rir: "2" });
      await logShown(page);
      const r = await reading(page, 2);
      check(same([r.load, r.reps, r.rir], [{ value: "32,5", grey: true }, { value: "8", grey: true }, { value: "2", grey: true }]) &&
        r.ledger.load.value === "32,5", "in Portuguese set 2 shows 32,5 / 8 / 2, grey, and the ledger agrees", r);
    } finally { await opened.context.close(); }

    opened = await start(browser, seedProgramMeta({}).programDefinition, { effort: true });
    try {
      const { page } = opened;
      await enter(page, { load: "30", reps: "8", effort: "easy" });
      await logShown(page);
      let r = await reading(page, 2);
      check(r.effort === "easy" && r.load.value === "30" && r.reps.value === "8", "in effort mode set 2 carries the effort Easy with 30 × 8", r);
      await logShown(page);
      r = await reading(page, 2);
      check(r.stored.done && r.stored.effort === "easy" && Number(r.stored.load) === 30, "logging it untouched stores effort easy", r.stored);
    } finally { await opened.context.close(); }
  }
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
