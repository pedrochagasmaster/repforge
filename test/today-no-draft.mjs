#!/usr/bin/env node
/**
 * Plan 064 R3b (Plan 063 P4): Today has no Preview, and Today never makes a draft.
 *
 * Direction D retired the read-only Today Preview (decision 9, superseding
 * G-44): the prescription table is Today itself, and a tap on a row opens the
 * exercise page. That closes audit finding N02 (the Preview omitted programmed
 * RIR) by removal. This suite is the no-draft evidence the closure needs:
 *
 *   - no Preview control or sheet exists in the document;
 *   - opening Today, reading the table, opening an exercise from a row and
 *     leaving again changes no local or IndexedDB record, creates no workout
 *     draft, starts no rest timer and announces no workout start;
 *   - the Start button is the one boundary that creates DraftV2, through the
 *     production entry path.
 *
 * Run: node test/today-no-draft.mjs
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
/** The catalog Weight metric: the load field of a Weight+Reps movement. */
const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";

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

async function waitForApp(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    window.closeFirstRun?.();
    if (el?.classList.contains("active") && typeof window.closeOnboarding === "function") window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function") window.closeTour();
  });
  await page.waitForFunction(
    () => typeof window.__repforgeStorage === "object" && typeof window.__repforgeEnterWorkout === "function",
    { timeout: 15000 }
  );
}

/** Everything durable on this device, so the zero-write proof has a whole
 *  pre-open snapshot instead of a cherry-picked key list. */
const snapshotStorage = (page) =>
  page.evaluate(async () => {
    const local = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      local[k] = localStorage.getItem(k);
    }
    const idb = await new Promise((resolve) => {
      const open = indexedDB.open("repforge");
      open.onupgradeneeded = () => open.result.createObjectStore("kv");
      open.onsuccess = () => {
        const db = open.result;
        try {
          const tx = db.transaction("kv", "readonly");
          const store = tx.objectStore("kv");
          const out = {};
          const keys = store.getAllKeys();
          keys.onsuccess = () => {
            const values = store.getAll();
            values.onsuccess = () => {
              keys.result.forEach((key, i) => { out[String(key)] = values.result[i]; });
              resolve(out);
            };
            values.onerror = () => resolve({});
          };
          keys.onerror = () => resolve({});
        } catch { resolve({}); }
      };
      open.onerror = () => resolve({});
    });
    return { local, idb, restRunning: !!window.__repforgeRest && document.querySelector("#woRest.is-running") !== null };
  });

/** Record every telemetry capture so the proof can show preview never
 *  announces a workout start. */
async function recordTelemetry(page) {
  await page.evaluate(() => {
    const t = window.RepForgeTelemetry;
    if (!t || t.__recording) return;
    const original = t.capture.bind(t);
    t.capture = (event, props) => {
      (window.__telemetryLog = window.__telemetryLog || []).push(event);
      return original(event, props);
    };
    t.__recording = true;
  });
}

async function clearState(page) {
  await page.evaluate(
    async ({ k, d }) => {
      localStorage.removeItem(k);
      localStorage.removeItem(d);
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(`${d}:`)) localStorage.removeItem(key);
      }
      await new Promise((res) => {
        const req = indexedDB.deleteDatabase("repforge");
        req.onsuccess = () => res();
        req.onerror = () => res();
        req.onblocked = () => res();
      });
    },
    { k: KEY, d: DRAFT }
  );
}

async function freshPage(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await installSeedProgram(page, { key: KEY, waitFor: waitForApp });
  await recordTelemetry(page);
  return { context, page, errors };
}

async function main() {
  const browser = await launchChromium();
  const { context, page, errors } = await freshPage(browser);
  try {
    const program = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).program, KEY);
    const dayOne = program.filter((e) => e.day === "Day 1");

    /* ---- Preview is gone ---- */
    phase("Today offers no Preview");
    await page.waitForSelector("#todayExList .rxrow", { timeout: 8000 });
    const surface = await page.evaluate(() => ({
      previewControl: !!document.querySelector("#previewSession, [data-i18n='today.preview']"),
      previewSheet: !!document.querySelector("#previewSessionSheet, #previewSessionScrim, #previewSessionList, [data-preview-start]"),
      start: !!document.querySelector("#startWorkout:not(.hidden)"),
      rows: [...document.querySelectorAll("#todayExList .rxrow")].map((row) => row.querySelector(".rxrow__name")?.firstChild?.textContent?.trim()),
      nameless: [...document.querySelectorAll("#todayExList .rxrow")].filter((row) => !row.dataset.exopen).length,
    }));
    assert(!surface.previewControl && !surface.previewSheet, "no Preview control and no Preview sheet exist", JSON.stringify(surface));
    assert(surface.start, "the start control stays");
    assert(surface.rows.length === dayOne.length && surface.nameless === 0,
      "Today lists every programmed exercise of the day as a row that opens its exercise page", JSON.stringify(surface));

    /* ---- Zero-write proof ---- */
    phase("Opening Today and leaving it changes nothing on the device");
    const before = await snapshotStorage(page);
    assert(before.local[DRAFT] == null, "there is no workout draft before Today is read");
    // Read the table, open one exercise from its row and come back.
    await page.locator("#todayExList .rxrow").first().click();
    await page.waitForSelector("#exercise.view.active", { timeout: 5000 });
    await page.click("#exBack");
    await page.waitForSelector("#log.view.active", { timeout: 5000 });
    const after = await snapshotStorage(page);
    assert(JSON.stringify(after.local) === JSON.stringify(before.local) &&
      JSON.stringify(after.idb) === JSON.stringify(before.idb),
    "reading Today, opening an exercise and leaving changes no local or IndexedDB record",
    JSON.stringify({ changed: Object.keys({ ...before.local, ...after.local }).filter((key) => before.local[key] !== after.local[key]),
      idbChanged: Object.keys({ ...before.idb, ...after.idb }).filter((key) => JSON.stringify(before.idb[key]) !== JSON.stringify(after.idb[key])) }));
    const draft = await page.evaluate((d) => ({
      stored: localStorage.getItem(d),
      stateful: Object.keys(localStorage).filter((key) => key.startsWith(`${d}:`)),
      current: window.__repforgeWorkoutDraft?.current?.() ?? null,
    }), DRAFT);
    assert(draft.stored == null && draft.stateful.length === 0 && draft.current == null,
      "no workout draft exists after Today was opened and left", JSON.stringify({ stored: draft.stored, stateful: draft.stateful }));
    const telemetry = await page.evaluate(() => window.__telemetryLog || []);
    assert(!telemetry.includes("workout_started"), "Today announces no workout start", JSON.stringify(telemetry));
    assert(after.restRunning === false && before.restRunning === false, "Today starts no rest timer");

    /* ---- The one boundary that creates state ---- */
    phase("Start creates DraftV2 through the production entry path");
    await page.locator("#startWorkout").click();
    await page.waitForSelector("#workoutShell:not(.hidden) #workout.is-focus .exercise.is-current", { timeout: 8000 });
    const started = await page.evaluate((d) => ({
      draft: localStorage.getItem(d),
      shell: !document.querySelector("#workoutShell")?.classList.contains("hidden"),
    }), DRAFT);
    assert(started.shell && typeof started.draft === "string" && started.draft.length > 0,
      "Start workout creates DraftV2 through the production entry path");

    /* ---- A matching draft relabels Start without Today writing ---- */
    phase("Coming back to Today with an open draft offers Continue and writes nothing");
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    const loadInput = page.locator(`#workout .exercise.is-current .focus-shelf input[data-metric-id="${WEIGHT}"]`);
    await loadInput.waitFor({ state: "attached", timeout: 5000 });
    if (await loadInput.getAttribute("aria-hidden") === "true")
      await page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field="metric_${WEIGHT}"]`).click();
    await loadInput.fill("40");
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    await page.locator("#leaveWorkout").click();
    await page.waitForSelector("#log.view.active", { timeout: 5000 });
    const draftBefore = await page.evaluate((d) => localStorage.getItem(d), DRAFT);
    const cta = await page.evaluate(() => document.querySelector("#startWorkout span")?.textContent?.trim());
    assert(/continue/i.test(cta || ""), "the start control offers to continue the open session", cta);
    await page.locator("#todayExList .rxrow").first().click();
    await page.waitForSelector("#exercise.view.active", { timeout: 5000 });
    await page.click("#exBack");
    await page.waitForSelector("#log.view.active", { timeout: 5000 });
    const draftAfter = await page.evaluate((d) => localStorage.getItem(d), DRAFT);
    assert(draftAfter === draftBefore, "reading Today and opening an exercise leaves the resumable draft untouched");

    assert(errors.length === 0, "the Today journey emits no page errors", errors.join(" | "));
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
