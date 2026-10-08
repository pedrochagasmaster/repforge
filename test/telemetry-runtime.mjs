#!/usr/bin/env node
/**
 * What the running app actually emits.
 *
 * tools/check-production-syntax.mjs guards the closed telemetry producer
 * boundary and declared event names. It cannot tell whether an event fires
 * when a screen merely appears, whether a whole cohort is silently dropped,
 * or whether one user action produces two events. This drives the real app in
 * a real browser and reads the events that reach the boundary's adapter.
 *
 * Every assertion here is about behavior:
 *   - opening the app is not choosing a program route;
 *   - onboarding the user did not ask for stays silent until they answer;
 *   - Generate reports the program it actually built;
 *   - a setup flow reports its once_per_setup_flow events once, including
 *     across Start over;
 *   - nothing carries a workout value, an identifier, or free text.
 *
 * Run: node test/telemetry-runtime.mjs
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { EVENT_DUPLICATE_POLICIES, FORBIDDEN_PROPERTY_NAMES } from "./fixtures/telemetry.mjs";
import { exerciseAction, finishEarly, selectExercise } from "./fixtures/focus-workout.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const PREFERENCE_KEY = "repforge_telemetry_enabled_v1";

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    console.log(`  ✗ ${name}`);
    if (detail != null) console.log(`    ${detail}`);
  }
}
const phase = (n) => console.log(`\n${n}`);

/** Boot the boundary with a recording adapter the moment telemetry.js
 *  installs it, so app.js emits into this test instead of into nothing. */
const RECORDER = () => {
  window.__captured = [];
  let installed;
  Object.defineProperty(window, "RepForgeTelemetry", {
    configurable: true,
    get: () => installed,
    set(next) {
      installed = next;
      try {
        next.boot({
          adapter: {
            capture: (name, properties) => window.__captured.push([name, { ...properties }]),
            setEnabled() {},
          },
          appVersion: "test",
          crypto: window.crypto,
          location: window.location,
          now: () => new Date(),
          releaseChannel: "preview",
          storage: window.localStorage,
        });
      } catch (error) {
        window.__telemetryBootError = String(error);
      }
    },
  });
};

async function openApp(browser, { seed, telemetryEnabled, at } = {}) {
  const context = await browser.newContext();
  await context.addInitScript(RECORDER);
  if (seed) {
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [KEY, JSON.stringify(seed)],
    );
  }
  if (telemetryEnabled !== undefined) {
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [PREFERENCE_KEY, String(telemetryEnabled)],
    );
  }
  const page = await context.newPage();
  if (at) await page.clock.setFixedTime(new Date(at));
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  return { context, page };
}

const captured = (page) => page.evaluate(() => window.__captured.map(([n, p]) => [n, p]));
const namesOf = (events) => events.map(([name]) => name);
const countOf = (events, name) => events.filter(([n]) => n === name).length;
const propsOf = (events, name) => events.find(([n]) => n === name)?.[1] || null;

const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";

/** The 18-slot seed program (a Build definition: manual, no suggested loads),
 *  already onboarded, so the log screen has sets to save. */
function loggableProgram(metaOverrides = {}) {
  return {
    settings: {
      jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 0, lastExport: "",
      unit: "kg", lang: "en", rirMode: "numeric", voiceInputEnabled: false,
      notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
    },
    programMeta: seedProgramMeta(metaOverrides),
    program: seedProgram(),
    log: [],
    programHistory: [],
  };
}
const SEED_A = "seed-ex-1";
const SEED_B = "seed-ex-2";

const dayIso = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function enterWorkout(page, day) {
  const entered = await page.evaluate((label) => {
    window.closeFirstRun?.();
    return window.__repforgeEnterWorkout(label ? { day: label } : {});
  }, day);
  if (entered === false) throw new Error(`could not enter workout ${day || ""}`);
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 8000 });
}

const draftSet = (page, exerciseId, ordinal) => page.evaluate(([id, n]) => {
  const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
  return Object.values(exercise?.sets || {}).find((row) => row.ordinal === n) || null;
}, [exerciseId, ordinal]);

/** The load the app recommends for a pending set: the adaptive engine's value
 *  prefilled into the untouched weight metric. */
async function suggestedLoad(page, exerciseId, ordinal) {
  const set = await draftSet(page, exerciseId, ordinal);
  if (!set || set.touched?.metrics?.[WEIGHT]) return null;
  const value = set.edited?.metrics?.[WEIGHT];
  return value == null || value === "" ? null : Number(value);
}

const setIsDone = (page, exerciseId, ordinal, done = true) => page.waitForFunction(([id, n, want]) => {
  const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
  const row = Object.values(exercise?.sets || {}).find((item) => item.ordinal === n);
  return !!row && (row.completion !== "pending") === want;
}, [exerciseId, ordinal, done], { timeout: 5000 });

/** Type into the Focus shelf the way a lifter does. */
async function fillShelf(page, metricId, value) {
  const input = page.locator(`#workout .exercise.is-current .focus-shelf input[data-metric-id="${metricId}"]`);
  await input.waitFor({ state: "attached", timeout: 5000 });
  if (await input.getAttribute("aria-hidden") === "true")
    await page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field="metric_${metricId}"]`).click();
  await input.fill(String(value));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}
async function fillRir(page, exerciseId, ordinal, value) {
  const input = page.locator(`#workout .exercise.is-current .focus-shelf input[data-k="${exerciseId}_${ordinal}_rir"]`);
  if (await input.getAttribute("aria-hidden") === "true")
    await page.locator('#workout .exercise.is-current .focus-shelf [data-shelf-field="rir"]').click();
  await input.fill(String(value));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

/** Type a load, reps and RIR and save the set. */
async function saveSetByHand(page, exerciseId, ordinal, load, { reps = 8, rir = 1 } = {}) {
  await selectExercise(page, exerciseId);
  await fillShelf(page, WEIGHT, load);
  await fillShelf(page, REPS, reps);
  await fillRir(page, exerciseId, ordinal, rir);
  await page.locator(`#workout .exercise.is-current [data-save="${exerciseId}_${ordinal}"]`).click();
  await setIsDone(page, exerciseId, ordinal);
}

/*
 * A generated program with one logged session behind it, so its weighted
 * movements carry adaptive recommendations. Built once through the production
 * workout and reused as the seed of every trust phase.
 */
const TRUST_SESSION_1 = "2026-03-02T09:00:00.000Z";
const TRUST_SESSION_2 = "2026-03-04T09:00:00.000Z";
let trustFixture = null;
async function trustProgram(browser) {
  if (trustFixture) return structuredClone(trustFixture);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(TRUST_SESSION_1));
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  const target = await page.evaluate(async ([weight, reps]) => {
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const request = window.RepForgeProgramEntryAdapter.programRequestFromAnswers({
      desiredResult: "muscle_growth", structuredExperience: "6_to_24m", daysPerWeek: 4, sessionMinutes: 60,
      environment: { kind: "commercial_gym" },
    }, catalog).value;
    const definition = window.RepForgeProgramCompiler.generateProgram(request, catalog, "telemetry").value;
    const weighted = (slot) => JSON.stringify(slot.metricIds) === JSON.stringify([weight, reps]) &&
      slot.prescriptionsByCycle[0].sets.length >= 3;
    const day = definition.days.find((item) => item.kind === "training" &&
      item.slots.length >= 2 && weighted(item.slots[0]) && weighted(item.slots[1]));
    await window.__repforgeFinalizeProgramSetup({
      programDefinition: definition, name: "Telemetry trust", answers: {}, destination: "log", origin: "first-run",
      draftConfirmed: true, telemetryRoute: "recommend", entrySource: { route: "recommend", fingerprint: "telemetry" },
    });
    await window.__repforgeStorage.flush();
    return day ? { day: day.name, a: day.slots[0].id, b: day.slots[1].id } : null;
  }, [WEIGHT, REPS]);
  if (!target) throw new Error("the generated program has no day with two weighted three-set slots");
  await enterWorkout(page, target.day);
  for (const [slot, load, reps] of [[target.a, 100, 8], [target.b, 80, 10]]) {
    for (const ordinal of [1, 2, 3]) await saveSetByHand(page, slot, ordinal, load, { reps, rir: 2 });
  }
  await finishEarly(page);
  await page.evaluate(() => window.__repforgeStorage?.flush?.());
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
  await context.close();
  trustFixture = { state, target };
  return structuredClone(trustFixture);
}

/** Open the second session of the trust program on its day. */
async function openTrustWorkout(browser, options = {}) {
  const { state, target } = await trustProgram(browser);
  const opened = await openApp(browser, { seed: state, at: TRUST_SESSION_2, ...options });
  await enterWorkout(opened.page, target.day);
  return { ...opened, target };
}

const ENVELOPE = ["telemetry_schema_version", "app_version", "release_channel"];
/** The event-specific properties of every capture of `name`, envelope removed. */
const eventsNamed = async (page, name) => (await captured(page))
  .filter(([n]) => n === name)
  .map(([, p]) => Object.fromEntries(Object.entries(p).filter(([key]) => !ENVELOPE.includes(key))));

const entryStep = (page) => page.evaluate(() => window.__repforgeEntryState?.()?.step);

/** Drive Generate from the entry hub through to its reviewable result. */
async function driveOnboarding(page, { experience = "6_to_24m", days = 4 } = {}) {
  // Generate's goal is asked on the hub: the tap answers it and opens the background step.
  await page.click('[data-entry-route="recommend"][data-entry-goal="muscle_growth"]');
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "background");
  await page.click(`[data-entry-pick="structuredExperience"][data-entry-val="${experience}"]`);
  await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "schedule");
  await page.click(`[data-entry-pick="daysPerWeek"][data-entry-val="${days}"]`);
  await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
  await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "environment");
  await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
  await page.click("#onbNext");
  await page.waitForFunction(() => ["priorities", "result"].includes(window.__repforgeEntryState?.()?.step));
  if (await entryStep(page) === "priorities") await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "result");
  await page.waitForSelector("#entryActivate", { timeout: 15000 });
  return true;
}

const browser = await launchChromium();

try {
  phase("Opening the app is not choosing a program route");
  {
    const { context, page } = await openApp(browser);
    const events = await captured(page);
    assert(
      (await page.evaluate(() => window.__telemetryBootError)) === undefined,
      "the boundary booted",
      await page.evaluate(() => window.__telemetryBootError),
    );
    assert(countOf(events, "app_boot") === 1, "app_boot fires exactly once", `saw ${countOf(events, "app_boot")}`);
    const boot = propsOf(events, "app_boot");
    assert(boot?.first_run === true, "app_boot reports a first run", JSON.stringify(boot));
    assert(["en", "pt"].includes(boot?.language), "app_boot reports a known language", JSON.stringify(boot));
    assert(
      ["ios", "android", "desktop", "other"].includes(boot?.platform_class),
      "app_boot reports a platform class",
      JSON.stringify(boot),
    );
    assert(
      countOf(events, "program_path_selected") === 0 && countOf(events, "generator_started") === 0,
      "the first-run gate appearing selects no route",
      namesOf(events).join(","),
    );
    await context.close();
  }

  phase("Onboarding nobody asked for stays silent until a route is chosen");
  {
    const { context, page } = await openApp(browser);
    // Stand the gate down and let onboarding open the way maybeShowOnboarding
    // opens it: by itself, with nothing chosen.
    await page.evaluate(() => {
      window.closeFirstRun();
      window.startOnboarding("first-run", { userInitiated: false });
    });
    let events = await captured(page);
    assert(
      countOf(events, "program_path_selected") === 0 && countOf(events, "generator_started") === 0,
      "an automatic open reports nothing",
      namesOf(events).join(","),
    );
    await page.click('[data-entry-route="recommend"][data-entry-goal="balanced"]');
    events = await captured(page);
    assert(countOf(events, "program_path_selected") === 1, "choosing a route selects it once");
    assert(countOf(events, "generator_started") === 1, "recommend starts the generator once");
    assert(propsOf(events, "program_path_selected")?.route === "recommend", "the route is recommend");
    await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
    events = await captured(page);
    assert(
      countOf(events, "program_path_selected") === 1 && countOf(events, "generator_started") === 1,
      "changing an answer does not restart the flow",
      `${countOf(events, "program_path_selected")}/${countOf(events, "generator_started")}`,
    );
    await context.close();
  }

  phase("Opening Create program shows the hub without selecting a route");
  {
    const { context, page } = await openApp(browser);
    await page.click("#firstRunCreate");
    const events = await captured(page);
    assert(countOf(events, "program_path_selected") === 0, "Create program alone selects no route");
    assert(countOf(events, "generator_started") === 0, "Create program alone starts no generator");
    assert(await page.locator('[data-entry-route="recommend"]').count(), "the entry hub is visible");
    await context.close();
  }

  phase("A first-time lifter's Generate reports the program it actually built");
  {
    const { context, page } = await openApp(browser);
    await page.click("#firstRunCreate");
    const drove = await driveOnboarding(page, { experience: "first", days: 3 });
    assert(drove, "the Generate flow reaches its result step");
    let events = await captured(page);
    assert(
      countOf(events, "generator_completed") === 1,
      "generator completion reports when the reviewable result is produced",
      `saw ${countOf(events, "generator_completed")} before activation: ${namesOf(events).join(",")}`,
    );
    assert(countOf(events, "program_activated") === 0,
      "reviewing a generated result does not imply activation", namesOf(events).join(","));
    await page.click("#entryActivate");
    await page.waitForFunction(() => window.__captured.some(([n]) => n === "program_activated"), undefined, {
      timeout: 10000,
    });
    events = await captured(page);
    const completed = propsOf(events, "generator_completed");
    assert(
      countOf(events, "generator_completed") === 1,
      "foundation recommend is not dropped from the funnel",
      `saw ${countOf(events, "generator_completed")}: ${namesOf(events).join(",")}`,
    );
    assert(completed?.goal === "muscle_growth", "it reports the muscle-growth goal it was generated for", JSON.stringify(completed));
    assert(completed?.family === "generated", "it reports the generated program family", JSON.stringify(completed));
    const activeDays = await page.evaluate(() => window.__repforgeWorkoutDraft.state().programMeta.programDefinition
      .days.filter((day) => day.kind === "training").length);
    assert(completed?.frequency === "3" && activeDays === 3,
      "it reports the frequency of the program it activated", JSON.stringify({ completed, activeDays }));
    assert(countOf(events, "program_activated") === 1, "activation reports once");
    assert(propsOf(events, "program_activated")?.route === "recommend", "activation reports the recommend route");
    assert(
      countOf(events, "program_path_selected") === 1 && countOf(events, "generator_started") === 1,
      "the whole flow reports its once_per_setup_flow events once",
      namesOf(events).join(","),
    );
    await context.close();
  }

  phase("Start over continues the same setup attempt");
  {
    const { context, page } = await openApp(browser);
    await page.click("#firstRunCreate");
    const reached = await driveOnboarding(page);
    assert(reached, "the flow reaches the step that offers Start over");
    await page.click("#entryRestart");
    await page.click("#entryRestartConfirm");
    await page.click('[data-entry-route="recommend"]');
    const events = await captured(page);
    assert(
      countOf(events, "program_path_selected") === 1 && countOf(events, "generator_started") === 1,
      "Start over does not open a second flow",
      `${countOf(events, "program_path_selected")}/${countOf(events, "generator_started")}`,
    );
    await context.close();
  }

  phase("Import selects its route once and activates only after common review");
  {
    const { context, page } = await openApp(browser);
    await page.click("#firstRunCreate");
    await page.click("#entryOwnToggle");
    await page.click('[data-entry-route="import"]');
    await page.setInputFiles("#importProgram", {
      name: "reviewed-program.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({
        version: 3,
        meta: { name: "Reviewed import" },
        exercises: [{
          id: "import-row", day: "Day 1", order: 1, name: "Assisted pull-up",
          sets: 3, min: 8, max: 12,
        }],
        customExercises: [],
      })),
    });
    await page.waitForSelector("#importReview.active", { timeout: 10000 });
    // The lifter settles the open row on its proposed movement.
    const proposal = page.locator('#importRows .improw.is-open [data-imp-act="pick"][data-imp-idx="0"], #importRows .improw.is-open [data-imp-act="link"]').first();
    assert(await proposal.count() === 1, "the free-named row opens for review with a proposed movement");
    await proposal.click();
    await page.waitForSelector("#importCommit:not([disabled])", { timeout: 10000 });
    let events = await captured(page);
    assert(
      JSON.stringify(await eventsNamed(page, "program_import_row_resolved")) === JSON.stringify([{ method: "top_candidate", source: "file" }]),
      "settling the row on its proposal reports one top-candidate file resolution",
      JSON.stringify(await eventsNamed(page, "program_import_row_resolved")),
    );
    assert(countOf(events, "program_path_selected") === 1,
      "opening Import review does not select the route twice", namesOf(events).join(","));
    assert(countOf(events, "program_activated") === 0,
      "mapping review does not activate a program", namesOf(events).join(","));
    await page.click("#importCommit");
    await page.waitForSelector("#entryActivate", { timeout: 10000 });
    events = await captured(page);
    assert(countOf(events, "program_path_selected") === 1,
      "staging the reviewed import keeps one route event", namesOf(events).join(","));
    assert(countOf(events, "program_activated") === 0,
      "staging the reviewed import leaves activation telemetry silent", namesOf(events).join(","));
    await page.click("#entryActivate");
    await page.waitForFunction(() => window.__captured.some(([name]) => name === "program_activated"), undefined, {
      timeout: 10000,
    });
    events = await captured(page);
    assert(countOf(events, "program_path_selected") === 1,
      "the complete Import setup flow emits one route event", namesOf(events).join(","));
    assert(countOf(events, "program_activated") === 1 && propsOf(events, "program_activated")?.route === "import",
      "explicit Import activation emits once with the import route", namesOf(events).join(","));
    await context.close();
  }

  phase("A logged session reports the session, not its contents");
  {
    const { context, page } = await openApp(browser, { seed: loggableProgram() });
    await enterWorkout(page, "Day 1");
    for (const [exerciseId, set, load, reps] of [
      [SEED_A, 1, 60, 8],
      [SEED_A, 2, 60, 7],
      [SEED_B, 1, 50, 10],
      [SEED_B, 2, 50, 9],
    ]) {
      await saveSetByHand(page, exerciseId, set, load, { reps });
    }
    await finishEarly(page);
    await page.waitForFunction(() => window.__captured.some(([n]) => n === "session_completed"), undefined, {
      timeout: 10000,
    });
    const events = await captured(page);
    const session = propsOf(events, "session_completed");
    assert(countOf(events, "session_completed") === 1, "a saved session reports once", namesOf(events).join(","));
    assert(session?.set_count === "1_5", "the set count is a bucket, never a number", JSON.stringify(session));
    assert(session?.exercise_count === "1_3", "the exercise count is a bucket", JSON.stringify(session));
    assert(
      ["0_15", "16_30", "31_60", "61_90", "90_plus"].includes(session?.duration),
      "the duration is a bucket",
      JSON.stringify(session),
    );
    assert(countOf(events, "first_set_logged") === 1, "the first working set is a milestone, reported once");
    assert(
      JSON.stringify(await eventsNamed(page, "set_saved")) === JSON.stringify(Array(4).fill({ vs_suggestion: "no_suggestion" })),
      "a manual program's saved sets report that no load was suggested",
      JSON.stringify(await eventsNamed(page, "set_saved")),
    );
    assert(
      countOf(events, "session_summary_viewed") <= 1,
      "the summary is reported once per session",
      String(countOf(events, "session_summary_viewed")),
    );
    await context.close();
  }

  phase("A committed working set reports how it compared with its suggestion, once");
  {
    const { context, page, target } = await openTrustWorkout(browser);
    const { a, b } = target;
    const suggested = await suggestedLoad(page, a, 1);
    assert(typeof suggested === "number" && suggested > 0,
      "the logged session gives the first set a recommended load", String(suggested));
    await saveSetByHand(page, a, 1, suggested);
    assert(
      JSON.stringify(await eventsNamed(page, "set_saved")) === JSON.stringify([{ vs_suggestion: "matched" }]),
      "saving the recommended load reports matched", JSON.stringify(await eventsNamed(page, "set_saved")),
    );
    await saveSetByHand(page, a, 2, (await suggestedLoad(page, a, 2)) + 2.5);
    await saveSetByHand(page, a, 3, (await suggestedLoad(page, a, 3)) + 1);
    await selectExercise(page, b);
    await page.evaluate((id) => {
      const draft = window.__repforgeWorkoutDraft.current();
      const set = Object.values(draft.exercises[id].sets).find((row) => row.ordinal === 1);
      return window.__repforgeWorkoutDraft.dispatch("markWarmup", { exerciseInstanceId: id, setId: set.setId });
    }, b);
    await saveSetByHand(page, b, 1, 40);
    assert((await eventsNamed(page, "set_saved")).length === 3, "a warm-up set reports nothing",
      JSON.stringify(await eventsNamed(page, "set_saved")));
    await saveSetByHand(page, b, 2, (await suggestedLoad(page, b, 2)) - 2.5);
    assert(
      JSON.stringify(await eventsNamed(page, "set_saved")) === JSON.stringify([
        { vs_suggestion: "matched" }, { vs_suggestion: "raised" }, { vs_suggestion: "matched" }, { vs_suggestion: "lowered" },
      ]),
      "a load within half a minJump matches; a full step up raises; a full step down lowers",
      JSON.stringify(await eventsNamed(page, "set_saved")),
    );
    // Re-saving an edited set is not a second saved set.
    await selectExercise(page, a);
    await page.locator(`#workout .exercise.is-current [data-editex="${a}"][data-editn="1"]`).click();
    await setIsDone(page, a, 1, false);
    await fillShelf(page, WEIGHT, suggested + 5);
    await page.locator(`#workout .exercise.is-current [data-save="${a}_1"]`).click();
    await setIsDone(page, a, 1);
    assert((await eventsNamed(page, "set_saved")).length === 4, "re-saving an edited set does not count again",
      JSON.stringify(await eventsNamed(page, "set_saved")));
    await context.close();
  }

  phase("The saved-set report belongs to the draft commit, not to a control");
  {
    const { context, page, target } = await openTrustWorkout(browser);
    const result = await page.evaluate(async (id) => {
      const api = window.__repforgeWorkoutDraft;
      const set = Object.values(api.current().exercises[id].sets).find((row) => row.ordinal === 1);
      const target = { exerciseInstanceId: id, setId: set.setId };
      const statuses = [];
      statuses.push((await api.dispatch("completeSet", target)).status);
      statuses.push((await api.dispatch("uncommitSet", target)).status);
      statuses.push((await api.dispatch("completeSet", target)).status);
      return statuses;
    }, target.a);
    const events = await eventsNamed(page, "set_saved");
    assert(result.every((status) => status === "applied"), "the lifecycle interface applied all three commands", result.join(","));
    assert(events.length === 1 && events[0].vs_suggestion === "matched",
      "completing, uncommitting and recompleting the recommended set reports one matched set",
      JSON.stringify(events));
    await context.close();
  }

  phase("A set restored from the stored draft is not counted again when it is edited");
  {
    const { context, page, target } = await openTrustWorkout(browser);
    await saveSetByHand(page, target.a, 1, await suggestedLoad(page, target.a, 1));
    assert((await eventsNamed(page, "set_saved")).length === 1, "the set was counted when it was first saved");
    await page.reload();
    await waitForAppBoot(page, { base: BASE });
    await page.waitForFunction(() => window.__repforgeWorkoutDraft?.current(), undefined, { timeout: 8000 });
    const outcome = await page.evaluate(async (id) => {
      const api = window.__repforgeWorkoutDraft;
      const set = Object.values(api.current().exercises[id].sets).find((row) => row.ordinal === 1);
      const target = { exerciseInstanceId: id, setId: set.setId };
      const statuses = [(await api.dispatch("uncommitSet", target)).status, (await api.dispatch("completeSet", target)).status];
      return { statuses, saved: window.__captured.filter(([name]) => name === "set_saved").length };
    }, target.a);
    assert(outcome.statuses.every((status) => status === "applied") && outcome.saved === 0,
      "the reloaded app reports no second set for an edited, re-saved set", JSON.stringify(outcome));
    await context.close();
  }

  phase("Opening the explanation reports the surface it was opened from");
  {
    const { context, page, target } = await openTrustWorkout(browser);
    await selectExercise(page, target.a);
    assert((await eventsNamed(page, "recommendation_explained")).length === 0, "showing a card does not explain anything");
    await page.locator("#workout .exercise.is-current [data-why]").first().click();
    await page.waitForSelector("#whySheet.is-open", { timeout: 5000 });
    assert(
      JSON.stringify(await eventsNamed(page, "recommendation_explained")) === JSON.stringify([{ surface: "focus" }]),
      "the Focus card reports the focus surface", JSON.stringify(await eventsNamed(page, "recommendation_explained")),
    );
    await page.locator("#whyClose").click();
    await page.evaluate((id) => window.openExerciseView(id, "log"), target.a);
    await page.waitForSelector("#exercise.view.active", { timeout: 5000 });
    await page.locator("#exDetail [data-why]").first().click();
    assert(
      JSON.stringify(await eventsNamed(page, "recommendation_explained")) === JSON.stringify([{ surface: "focus" }, { surface: "exercise" }]),
      "the exercise page reports the exercise surface", JSON.stringify(await eventsNamed(page, "recommendation_explained")),
    );
    await context.close();
  }

  phase("Skipping an exercise is reported once; restoring it is not a skip");
  {
    const { context, page } = await openApp(browser, { seed: loggableProgram() });
    await enterWorkout(page, "Day 1");
    await exerciseAction(page, SEED_B, "#exActionSkipBtn");
    assert(
      JSON.stringify(await eventsNamed(page, "exercise_skipped")) === JSON.stringify([{ context: "planned_session" }]),
      "an individual skip reports a planned-session skip", JSON.stringify(await eventsNamed(page, "exercise_skipped")),
    );
    await exerciseAction(page, SEED_B, "#exActionSkipBtn");
    assert((await eventsNamed(page, "exercise_skipped")).length === 1, "restoring the exercise reports nothing more",
      JSON.stringify(await eventsNamed(page, "exercise_skipped")));
    await context.close();
  }

  phase("Opening the block review reports its completion; background renders do not");
  {
    // The seed block runs seven weeks: week 4 is halfway, week 7 is the last.
    for (const [startedDaysAgo, completion] of [[3, "early"], [24, "partial"], [45, "complete"], [52, "extended"]]) {
      const { context, page } = await openApp(browser, { seed: loggableProgram({ started: dayIso(startedDaysAgo) }) });
      await page.evaluate(() => window.closeFirstRun?.());
      await page.click('nav button[data-view="stats"]');
      await page.waitForSelector("#stats.view.active", { timeout: 5000 });
      assert((await eventsNamed(page, "block_review_viewed")).length === 0,
        `${completion}: opening Progress on the overview reports no review`);
      await page.click('#statsSeg button[data-seg="review"]');
      await page.waitForSelector("#segReview.active", { timeout: 5000 });
      assert(
        JSON.stringify(await eventsNamed(page, "block_review_viewed")) === JSON.stringify([{ completion }]),
        `a block ${startedDaysAgo} days in reports ${completion}`, JSON.stringify(await eventsNamed(page, "block_review_viewed")),
      );
      if (completion === "early") {
        await page.click('#statsSeg button[data-seg="review"]');
        assert((await eventsNamed(page, "block_review_viewed")).length === 1,
          "tapping the segment that is already open reports nothing more");
        await page.click('nav button[data-view="history"]');
        await page.click('nav button[data-view="stats"]');
        assert((await eventsNamed(page, "block_review_viewed")).length === 2,
          "returning to Progress where the review is showing opens it again");
      }
      await context.close();
    }
  }

  phase("Persistent opt-out blocks telemetry without blocking a workout");
  {
    const { context, page } = await openApp(browser, { seed: loggableProgram(), telemetryEnabled: false });
    assert((await captured(page)).length === 0, "opted-out boot reaches no adapter event");
    await enterWorkout(page, "Day 1");
    await saveSetByHand(page, SEED_A, 1, 60);
    await finishEarly(page);
    await page.waitForFunction(
      key => JSON.parse(window.localStorage.getItem(key) || "{}").log?.length > 0,
      KEY,
      { timeout: 10000 },
    );
    assert((await captured(page)).length === 0, "an opted-out saved workout reaches no adapter event");
    assert(
      await page.evaluate(key => JSON.parse(window.localStorage.getItem(key) || "{}").log?.length > 0, KEY),
      "the workout still commits while telemetry is off",
    );
    await page.click("#sumDone");
    await page.waitForSelector("#sessionSummary", { state: "hidden", timeout: 8000 });
    await page.evaluate(() => window.__repforgeShowSettings());
    assert(await page.locator("#telemetryToggle").getAttribute("aria-pressed") === "false", "Settings shows the persisted opt-out");
    await page.click("#telemetryToggle");
    assert(await page.locator("#telemetryToggle").getAttribute("aria-pressed") === "true", "Settings can opt back in");
    assert(
      await page.evaluate(key => window.localStorage.getItem(key) === "true", PREFERENCE_KEY),
      "opt-in persists",
    );
    assert(await page.evaluate(() => window.RepForgeTelemetry.capture("first_set_logged", {})) === true, "future approved events resume after opt-in");
    assert(countOf(await captured(page), "first_set_logged") === 1, "the re-enabled adapter receives the approved event");
    await page.click("#telemetryToggle");
    assert(await page.evaluate(() => window.RepForgeTelemetry.capture("first_set_logged", {})) === false, "future events stop immediately after opt-out");
    assert(
      await page.evaluate(key => window.localStorage.getItem(key) === "false", PREFERENCE_KEY),
      "the renewed opt-out persists",
    );
    await context.close();
  }

  phase("Nothing carries a value, an identifier, or free text");
  {
    const { context, page } = await openApp(browser);
    await page.click("#firstRunCreate");
    await driveOnboarding(page);
    await page.click("#entryActivate");
    await page.waitForFunction(() => window.__captured.some(([n]) => n === "program_activated"), undefined, {
      timeout: 10000,
    });
    const events = await captured(page);
    const offenders = [];
    for (const [name, properties] of events) {
      for (const key of Object.keys(properties)) {
        if (FORBIDDEN_PROPERTY_NAMES.includes(key) || key.startsWith("$")) offenders.push(`${name}.${key}`);
      }
      for (const [key, value] of Object.entries(properties)) {
        if (key === "telemetry_schema_version") continue;
        if (typeof value === "number") offenders.push(`${name}.${key} is a raw number`);
      }
    }
    assert(offenders.length === 0, "no forbidden property reaches the adapter", offenders.join(", "));
    assert(
      events.every(([name]) => Object.hasOwn(EVENT_DUPLICATE_POLICIES, name)),
      "every emitted event is a declared alpha event",
      namesOf(events).filter((n) => !Object.hasOwn(EVENT_DUPLICATE_POLICIES, n)).join(","),
    );
    const flowEvents = events.filter(([name]) => EVENT_DUPLICATE_POLICIES[name] === "once_per_setup_flow");
    const flowCounts = new Map();
    for (const [name] of flowEvents) flowCounts.set(name, (flowCounts.get(name) || 0) + 1);
    assert(
      [...flowCounts.values()].every((count) => count === 1),
      "each once_per_setup_flow event appears once in one flow",
      [...flowCounts].map(([n, c]) => `${n}=${c}`).join(","),
    );
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
