#!/usr/bin/env node
/**
 * A manual set's load follows the set logged above it (owner decision, 2026-10-18).
 *
 * A manual set (no adaptive load, no programmed load target) with no load of its own shows, as a prefill, the load of
 * the nearest set logged above it on the same exercise in this session. The prefill is soft and editable, nothing is
 * stored until the set is logged, and Log set logs what the field shows. Driven through Focus on a fresh device that
 * sets up the seed Build program (every slot manual), in metric-backed DraftV2:
 *
 * 1. Set 1 logged at 30 → set 2's Load reads 30 (soft) in the shelf and the ledger, and nothing is stored for it.
 * 2. A reload mid-exercise derives the prefill again, still storing nothing.
 * 3. Log set stores the 30 that was shown.
 * 4. An edit logs the edited load; a cleared field never brings the carried load back (a set with a blank load is
 *    refused, as every set is).
 * 5. An exercise with nothing logged yet shows "—".
 * 6. A per-side composition carries the per-side value unchanged.
 */
import { launchChromium } from "./browser.mjs";
import { openCatalogState } from "./fixtures/catalog-state.mjs";
import { seedProgramMeta } from "./fixtures/seed-program.mjs";

const failures = [];
let passed = 0;
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 2500)}`);
}

/** Set up `definition` on a fresh device and open Focus on its first day. */
async function startWorkout(browser, definition) {
  const opened = await openCatalogState(browser, "today/no-program", 390, "en", "normal");
  const { page } = opened;
  await page.evaluate(async (programDefinition) => {
    await window.__repforgeFinalizeProgramSetup({
      programDefinition, name: "Manual loads", answers: {}, destination: "log", origin: "first-run",
      draftConfirmed: true, telemetryRoute: "recommend", entrySource: { route: "recommend", fingerprint: "manual-load-carry" },
    });
    await window.__repforgeStorage.flush();
  }, definition);
  await enterFocus(page);
  return opened;
}

async function enterFocus(page) {
  await page.evaluate(() => window.__repforgeEnterWorkout({}));
  await page.waitForSelector("#workout .exercise.is-current .focus-shelf .saveset", { timeout: 20000 });
}

/** What the live card shows for its load and what the draft holds for every set of its exercise. */
const reading = (page) => page.evaluate(() => {
  const art = document.querySelector("#workout .exercise.is-current");
  const id = art.dataset.ex;
  const stored = window.__repforgeWorkoutDraft.current().exercises[id];
  const sets = [...stored.setOrder].map((setId) => stored.sets[setId]).sort((a, b) => a.ordinal - b.ordinal);
  const loadMetric = (set) => (set.programmed.metrics || []).find((metric) => /load/i.test(metric.semantic));
  const field = [...art.querySelectorAll(".focus-shelf .shelf__field[data-field='metric']")]
    .find((node) => loadMetric(sets[0])?.id === node.dataset.metric);
  return {
    id,
    semantic: loadMetric(sets[0])?.semantic,
    shelf: field?.querySelector(".shelf__val")?.textContent.trim() ?? null,
    soft: !!field?.classList.contains("is-untouched"),
    input: field?.querySelector(".shelf__input")?.value ?? null,
    ledger: art.querySelector(".ledgerline--open [data-lv='load']")?.textContent.trim() ?? null,
    stored: sets.map((set) => ({ n: set.ordinal, done: set.completion !== "pending", load: set.edited.metrics?.[loadMetric(set)?.id] ?? null })),
  };
});

/** Type into the live shelf's fields by meaning: `load` and `reps` as display text. */
async function fill(page, values) {
  await page.evaluate((input) => {
    const art = document.querySelector("#workout .exercise.is-current");
    const id = art.dataset.ex, stored = window.__repforgeWorkoutDraft.current().exercises[id];
    const set = Object.values(stored.sets).find((item) => item.completion === "pending");
    const semantics = Object.fromEntries(set.programmed.metrics.map((metric) => [metric.id, metric.semantic]));
    for (const el of art.querySelectorAll(".focus-shelf .shelf__input[data-metric-id]")) {
      const semantic = semantics[el.dataset.metricId] || "";
      const value = /load/i.test(semantic) ? input.load : /reps/i.test(semantic) ? input.reps : undefined;
      if (value === undefined) continue;
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, values);
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

/** Log the live set, with the reps the lifter did, and wait until the draft records it. */
async function logSet(page, reps = "8") {
  await fill(page, { reps });
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
}

/** Move Focus to exercise `index` of the day through the session map. */
async function jumpTo(page, index) {
  await page.locator("#sessionSheetBtn").click();
  const jump = page.locator("[data-session-map-jump]").nth(index);
  const id = await jump.getAttribute("data-session-map-jump");
  await jump.click();
  await page.waitForFunction((target) => document.querySelector("#workout .exercise.is-current")?.dataset.ex === target, id, { timeout: 20000 });
  await page.waitForSelector("#sessionSheet:not(.is-open)", { state: "attached", timeout: 20000 });
}

const browser = await launchChromium();
try {
  console.log("\n1–5. The seed Build program: every slot manual, load and reps");
  {
    const { context, page } = await startWorkout(browser, seedProgramMeta({}).programDefinition);
    try {
      let r = await reading(page);
      check(r.shelf === "—" && r.stored.every((set) => set.load == null), "with nothing logged, the first set's Load reads —", r);

      await fill(page, { load: "30", reps: "8" });
      await logSet(page);
      r = await reading(page);
      check(r.shelf === "30" && r.soft && r.ledger === "30", "set 1 logged at 30: set 2's Load reads 30, soft, in the shelf and the ledger", r);
      check(r.stored[1].load == null, "the prefill stores nothing for set 2", r.stored);

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
      await enterFocus(page);
      r = await reading(page);
      check(r.shelf === "30" && r.soft && r.stored[1].load == null, "after a reload the prefill is derived again and still stores nothing", r);

      await logSet(page);
      r = await reading(page);
      const first = r.id;
      const logged = await page.evaluate((id) => {
        const stored = window.__repforgeWorkoutDraft.current().exercises[id];
        const sets = [...stored.setOrder].map((setId) => stored.sets[setId]).sort((a, b) => a.ordinal - b.ordinal);
        const metric = sets[1].programmed.metrics.find((item) => item.semantic === "loadKg");
        return { done: sets[1].completion !== "pending", load: sets[1].edited.metrics[metric.id] };
      }, first);
      check(logged.done && Number(logged.load) === 30, "Log set stores the 30 that was shown", logged);

      // The next exercise: set 1 at 40, set 2 edited to 42.5.
      await jumpTo(page, 1);
      r = await reading(page);
      check(r.shelf === "—", "an exercise with nothing logged in this session shows —", r);
      await fill(page, { load: "40", reps: "8" });
      await logSet(page);
      r = await reading(page);
      check(r.shelf === "40", "set 1 at 40 prefills set 2 with 40", r);
      await fill(page, { load: "42.5" });
      r = await reading(page);
      check(r.shelf === "42.5" && !r.soft, "editing the prefill to 42.5 makes it the lifter's own value", r);
      await logSet(page);
      r = await reading(page);
      check(Number(r.stored[1].load) === 42.5 && r.stored[1].done, "the edited 42.5 is what gets logged", r.stored);

      // The third exercise: set 1 at 50, set 2 cleared.
      await jumpTo(page, 2);
      await fill(page, { load: "50", reps: "8" });
      await logSet(page);
      await fill(page, { load: "" });
      r = await reading(page);
      check(r.shelf === "—" && r.input === "", "clearing the prefilled Load leaves it blank", r);
      // A set logs every metric it measures, so a blank Load is refused as it is on any set; what matters is that the
      // carried 50 does not come back under the lifter's clear.
      await fill(page, { reps: "8" });
      await page.locator("#workout .exercise.is-current .focus-shelf .saveset").evaluate((button) => button.click());
      await page.waitForSelector("#workout .exercise.is-current .focus-shelf .shelf__input[aria-invalid='true']", { state: "attached", timeout: 20000 });
      r = await reading(page);
      check(!r.stored[1].done && (r.stored[1].load == null || r.stored[1].load === "") && r.shelf === "—",
        "Log set with the Load cleared refuses the blank load and never logs the carried 50", r);
    } finally { await context.close(); }
  }

  console.log("\n6. A per-side composition carries the per-side value");
  {
    const definition = seedProgramMeta({}).programDefinition;
    const { context, page } = await openCatalogState(browser, "today/no-program", 390, "en", "normal");
    try {
      const swapped = await page.evaluate(async (programDefinition) => {
        const catalog = window.RepForgeExerciseCatalog.snapshot();
        const metrics = window.RepForgeExerciseMetrics;
        const source = catalog.exercises.find((entry) => {
          const defs = metrics.definitionsForIds(entry.exerciseMetrics || []);
          return defs?.ok && defs.value.length === 2 && defs.value.some((m) => m.semantic === "loadPerSideKg")
            && defs.value.some((m) => m.semantic === "repsPerSide") && (entry.laterality || []).length === 1;
        });
        if (!source) return { error: "no unambiguous per-side catalog movement" };
        const defs = metrics.definitionsForIds(source.exerciseMetrics).value;
        const slot = programDefinition.days[0].slots[0];
        Object.assign(slot, {
          exerciseId: source.id, sourceExerciseIds: [source.id], exerciseTypeId: source.exerciseType, displayName: source.name,
          musclePurposeIds: [...source.primaryFeatureMuscle], movementPatternIds: [...source.movementPattern],
          metricIds: [...source.exerciseMetrics], metricDefinitions: defs, lateralityIds: [...source.laterality],
          loadingModel: { ...slot.loadingModel, bodyweightCoefficient: source.bodyweight },
        });
        for (const cycle of slot.prescriptionsByCycle) for (const set of cycle.sets) set.targets = { repsPerSide: { min: 6, max: 10 } };
        const valid = window.RepForgeProgramCompiler.validateProgramDefinition(programDefinition, catalog, []);
        if (!valid.ok) return { error: `invalid per-side program: ${JSON.stringify(valid.issues).slice(0, 400)}` };
        await window.__repforgeFinalizeProgramSetup({
          programDefinition, name: "Per-side loads", answers: {}, destination: "log", origin: "first-run",
          draftConfirmed: true, telemetryRoute: "recommend", entrySource: { route: "recommend", fingerprint: "manual-load-carry-side" },
        });
        await window.__repforgeStorage.flush();
        return { name: source.name };
      }, definition);
      if (swapped.error) check(false, swapped.error);
      else {
        await enterFocus(page);
        let r = await reading(page);
        check(r.semantic === "loadPerSideKg" && r.shelf === "—", `${swapped.name}: the per-side Load starts at —`, r);
        await fill(page, { load: "12.5", reps: "8" });
        await logSet(page);
        r = await reading(page);
        check(r.shelf === "12.5" && r.soft && r.stored[1].load == null, "set 1 at 12.5 per side prefills set 2 with 12.5 per side, storing nothing", r);
        await logSet(page);
        r = await reading(page);
        check(Number(r.stored[1].load) === 12.5 && r.stored[1].done, "Log set stores the per-side 12.5 unchanged", r.stored);
      }
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
