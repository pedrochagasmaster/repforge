#!/usr/bin/env node
/**
 * What the running app actually emits.
 *
 * test/telemetry-call-sites.mjs reads source text; it can only prove which
 * event names appear in app.js. It cannot tell whether an event fires when a
 * screen merely appears, whether a whole cohort is silently dropped, or
 * whether one user action produces two events. This drives the real app in a
 * real browser and reads the events that reach the boundary's adapter.
 *
 * Every assertion here is about behavior:
 *   - opening the app is not choosing a program route;
 *   - onboarding the user did not ask for stays silent until they answer;
 *   - "beginner consistency" reports the program it actually built;
 *   - a setup flow reports its once_per_setup_flow events once, including
 *     across Start over;
 *   - nothing carries a workout value, an identifier, or free text.
 *
 * Run: node test/telemetry-runtime.mjs
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { EVENT_DUPLICATE_POLICIES, FORBIDDEN_PROPERTY_NAMES } from "./fixtures/telemetry.mjs";

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

async function openApp(browser, { seed, telemetryEnabled } = {}) {
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
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  return { context, page };
}

const captured = (page) => page.evaluate(() => window.__captured.map(([n, p]) => [n, p]));
const namesOf = (events) => events.map(([name]) => name);
const countOf = (events, name) => events.filter(([n]) => n === name).length;
const propsOf = (events, name) => events.find(([n]) => n === name)?.[1] || null;

/** A two-lift day, already onboarded, so the log screen has sets to save. */
function loggableProgram() {
  return {
    settings: {
      jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 0, lastExport: "",
      unit: "kg", lang: "en", rirMode: "numeric", voiceInputEnabled: false,
      notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
    },
    programMeta: {
      id: "prog-telemetry", name: "Telemetry fixture", started: "2026-08-13",
      created: "2026-07-01T00:00:00.000Z", updated: "2026-07-01T00:00:00.000Z",
      onboarded: true, mesocycleStatus: "active", mesocycleLengthWeeks: 6,
      goal: null, experience: null, daysPerWeek: 1, splitType: "full_body",
      equipment: ["barbell"], priorityMuscles: [], sessionLength: "60", completedAt: null,
    },
    program: [
      { id: "ex0", day: "Day 1", order: 1, name: "Bench press", sets: 2, min: 6, max: 10, primary: "Chest", secondary: "Triceps", notes: "", alternates: [] },
      { id: "ex1", day: "Day 1", order: 2, name: "Barbell row", sets: 2, min: 6, max: 10, primary: "Mid/upper back", secondary: "Biceps", notes: "", alternates: [] },
    ],
    log: [],
    programHistory: [],
  };
}

/** Click one answer per step, then Next, until the review step offers Save. */
async function driveOnboarding(page, { goal }) {
  await page.click(`[data-onb-pick="goal"][data-onb-val="${goal}"]`);
  for (let guard = 0; guard < 20; guard++) {
    if (await page.locator("#onbSave").isVisible().catch(() => false)) return true;
    const next = page.locator("#onbNext");
    if (await next.isDisabled()) {
      const pick = page.locator("[data-onb-pick]").first();
      if (!(await pick.count())) return false;
      await pick.click();
      continue;
    }
    await next.click();
  }
  return false;
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

  phase("Onboarding nobody asked for stays silent until it is answered");
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
    await page.click('[data-onb-pick="goal"][data-onb-val="hypertrophy"]');
    events = await captured(page);
    assert(countOf(events, "program_path_selected") === 1, "the first answer selects the route once");
    assert(countOf(events, "generator_started") === 1, "the first answer starts the generator once");
    assert(propsOf(events, "program_path_selected")?.route === "custom", "the route is custom");
    await page.click('[data-onb-pick="goal"][data-onb-val="strength_hypertrophy"]');
    events = await captured(page);
    assert(
      countOf(events, "program_path_selected") === 1 && countOf(events, "generator_started") === 1,
      "changing the answer does not restart the flow",
      `${countOf(events, "program_path_selected")}/${countOf(events, "generator_started")}`,
    );
    await context.close();
  }

  phase("Asking for onboarding reports the route immediately");
  {
    const { context, page } = await openApp(browser);
    await page.click("#firstRunCreate");
    const events = await captured(page);
    assert(countOf(events, "program_path_selected") === 1, "Create program selects the route once");
    assert(countOf(events, "generator_started") === 1, "Create program starts the generator once");
    await context.close();
  }

  phase("Beginner consistency reports the program it actually built");
  {
    const { context, page } = await openApp(browser);
    await page.click("#firstRunCreate");
    const drove = await driveOnboarding(page, { goal: "beginner_consistency" });
    assert(drove, "the beginner flow reaches its review step");
    await page.click("#onbSave");
    await page.waitForFunction(() => window.__captured.some(([n]) => n === "program_activated"), undefined, {
      timeout: 10000,
    });
    const events = await captured(page);
    const completed = propsOf(events, "generator_completed");
    assert(
      countOf(events, "generator_completed") === 1,
      "beginner consistency is not dropped from the funnel",
      `saw ${countOf(events, "generator_completed")}: ${namesOf(events).join(",")}`,
    );
    assert(completed?.goal === "muscle_growth", "it reports the muscle-growth program it compiles to", JSON.stringify(completed));
    assert(completed?.family === "foundation", "it reports the Foundation treatment", JSON.stringify(completed));
    assert(
      ["2", "3", "4", "5", "6"].includes(completed?.frequency),
      "it reports a reviewed frequency",
      JSON.stringify(completed),
    );
    assert(countOf(events, "program_activated") === 1, "activation reports once");
    assert(propsOf(events, "program_activated")?.route === "custom", "activation reports the custom route");
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
    const reached = await driveOnboarding(page, { goal: "hypertrophy" });
    assert(reached, "the flow reaches the step that offers Start over");
    await page.click("#onbRestart");
    await page.click('[data-onb-pick="goal"][data-onb-val="strength_hypertrophy"]');
    const events = await captured(page);
    assert(
      countOf(events, "program_path_selected") === 1 && countOf(events, "generator_started") === 1,
      "Start over does not open a second flow",
      `${countOf(events, "program_path_selected")}/${countOf(events, "generator_started")}`,
    );
    await context.close();
  }

  phase("A logged session reports the session, not its contents");
  {
    const { context, page } = await openApp(browser, { seed: loggableProgram() });
    await page.evaluate(() => {
      window.closeFirstRun?.();
      window.__repforgeEnterWorkout({ focus: false });
    });
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 8000 });
    for (const [exerciseId, set, load, reps] of [
      ["ex0", 1, 60, 8],
      ["ex0", 2, 60, 7],
      ["ex1", 1, 50, 10],
    ]) {
      await page.evaluate(
        ({ exerciseId, set, load, reps }) => {
          for (const [suffix, value] of [["load", load], ["reps", reps], ["rir", 1]]) {
            const cell = document.querySelector(`[data-k="${exerciseId}_${set}_${suffix}"]`);
            if (!cell) continue;
            cell.value = String(value);
            cell.dispatchEvent(new Event("input", { bubbles: true }));
          }
          document.querySelector(`.saveset[data-save="${exerciseId}_${set}"]`)?.click();
        },
        { exerciseId, set, load, reps },
      );
      await page.waitForTimeout(90);
    }
    await page.evaluate(() => document.querySelector("#logForm")?.requestSubmit());
    await page.waitForFunction(() => window.__captured.some(([n]) => n === "session_completed"), undefined, {
      timeout: 10000,
    });
    const events = await captured(page);
    const session = propsOf(events, "session_completed");
    assert(countOf(events, "session_completed") === 1, "a saved session reports once", namesOf(events).join(","));
    assert(
      ["0", "1_5", "6_10", "11_20", "21_plus"].includes(session?.set_count),
      "the set count is a bucket, never a number",
      JSON.stringify(session),
    );
    assert(
      ["0", "1_3", "4_6", "7_plus"].includes(session?.exercise_count),
      "the exercise count is a bucket",
      JSON.stringify(session),
    );
    assert(
      ["0_15", "16_30", "31_60", "61_90", "90_plus"].includes(session?.duration),
      "the duration is a bucket",
      JSON.stringify(session),
    );
    assert(countOf(events, "first_set_logged") === 1, "the first working set is a milestone, reported once");
    assert(
      countOf(events, "session_summary_viewed") <= 1,
      "the summary is reported once per session",
      String(countOf(events, "session_summary_viewed")),
    );
    await context.close();
  }

  phase("Persistent opt-out blocks telemetry without blocking a workout");
  {
    const { context, page } = await openApp(browser, { seed: loggableProgram(), telemetryEnabled: false });
    assert((await captured(page)).length === 0, "opted-out boot reaches no adapter event");
    await page.evaluate(() => {
      window.closeFirstRun?.();
      window.__repforgeEnterWorkout({ focus: false });
    });
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 8000 });
    await page.evaluate(() => {
      for (const [suffix, value] of [["load", 60], ["reps", 8], ["rir", 1]]) {
        const cell = document.querySelector(`[data-k="ex0_1_${suffix}"]`);
        cell.value = String(value);
        cell.dispatchEvent(new Event("input", { bubbles: true }));
      }
      document.querySelector('.saveset[data-save="ex0_1"]')?.click();
    });
    await page.waitForTimeout(120);
    await page.evaluate(() => document.querySelector("#logForm")?.requestSubmit());
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
    await page.waitForSelector("#sessionSummary.hidden", { timeout: 8000 });
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
    await driveOnboarding(page, { goal: "hypertrophy" });
    await page.click("#onbSave").catch(() => {});
    await page.waitForTimeout(500);
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
