#!/usr/bin/env node
/**
 * Plan 055 / 055-P2: Today's read-only session preview.
 *
 * The Preview control opens a planned-session map built purely from the
 * program and its programmed facts. Opening and closing it must change
 * nothing on this device: no draft, no log, no durable revision, no
 * timestamp, no rest timer, and no workout-start telemetry. Starting the
 * session from inside the preview is the one boundary that may create
 * DraftV2 — that journey is exercised separately from the zero-write proof.
 *
 * Run: node test/today-preview.mjs
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";

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

    /* ---- The distinct boundary ---- */
    phase("A distinct observational control beside the start CTA");
    const previewBtn = page.locator("#previewSession");
    assert(await previewBtn.count() === 1 && await previewBtn.isVisible(),
      "Today's ready state offers a Preview session control");
    assert(await previewBtn.getAttribute("id") !== "startWorkout",
      "the preview control is distinct from the start CTA");

    /* ---- Opening it ---- */
    phase("The preview reads the planned session without touching storage");
    const before = await snapshotStorage(page);
    await previewBtn.click();
    await page.waitForSelector("#previewSessionSheet.is-open", { timeout: 5000 });
    const view = await page.evaluate(() => {
      const sheet = document.querySelector("#previewSessionSheet");
      return {
        day: sheet.querySelector("[data-preview-day]")?.textContent?.trim(),
        rows: [...sheet.querySelectorAll("[data-preview-exercise]")].map((r) => r.textContent.trim()),
        editableFields: sheet.querySelectorAll("input:not([type=hidden]), textarea, select").length,
        inert: sheet.inert === false,
      };
    });
    assert(view.rows.length === dayOne.length && view.rows.every((t) => t.includes("×")),
      "the preview lists every programmed exercise of the day with set counts", JSON.stringify(view));
    assert(view.editableFields === 0,
      "the preview exposes no editable field");

    /* ---- Zero-write proof ---- */
    phase("Closing it leaves the device exactly as it was");
    await page.locator("#previewSessionClose").click();
    await page.waitForSelector("#previewSessionSheet", { state: "hidden", timeout: 5000 });
    const after = await snapshotStorage(page);
    assert(JSON.stringify(after.local) === JSON.stringify(before.local) &&
      JSON.stringify(after.idb) === JSON.stringify(before.idb),
      "opening and closing Preview changes no local or IndexedDB record",
      JSON.stringify({ beforeKeys: Object.keys(before.local), afterKeys: Object.keys(after.local) }));
    const telemetry = await page.evaluate(() => window.__telemetryLog || []);
    assert(telemetry.length === 0,
      "Preview emits no telemetry, so it cannot announce a workout start",
      JSON.stringify(telemetry));
    assert(after.restRunning === false && before.restRunning === false,
      "Preview starts no rest timer");

    /* ---- The one boundary that creates state ---- */
    phase("Starting from inside the preview enters the immersive shell");
    await previewBtn.click();
    await page.waitForSelector("#previewSessionSheet.is-open", { timeout: 5000 });
    await page.locator("[data-preview-start]").click();
    await page.waitForSelector("#workoutShell:not(.hidden) #workout.is-focus .exercise.is-current", { timeout: 8000 });
    const started = await page.evaluate((d) => ({
      draft: localStorage.getItem(d),
      shell: !document.querySelector("#workoutShell")?.classList.contains("hidden"),
    }), DRAFT);
    assert(started.shell && typeof started.draft === "string" && started.draft.length > 0,
      "Start workout creates DraftV2 through the production entry path");
    // Touch a field so the draft counts as in-progress and Today will show "Continue".
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    const loadInput = page.locator("#workout .exercise.is-current .focus-well input[data-k$='_load']");
    if (await loadInput.count()) {
      await loadInput.first().fill("40");
      await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    } else {
      const anyLoad = page.locator("#workout input[data-k$='_load']").first();
      if (await anyLoad.count()) {
        await anyLoad.fill("40");
        await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
      }
    }
    await page.locator("#leaveWorkout").click();
    await page.waitForTimeout(150);

    /* --- A matching draft relabels the CTA but the preview stays silent --- */
    phase("A matching draft changes Start to Resume without waking the preview");
    const draftBefore = await page.evaluate((d) => localStorage.getItem(d), DRAFT);
    const cta = await page.evaluate(() => document.querySelector("#startWorkout span")?.textContent?.trim());
    assert(/continue/i.test(cta || ""), "the start CTA offers to continue the open session", cta);
    await page.locator("#previewSession").click();
    await page.waitForSelector("#previewSessionSheet.is-open", { timeout: 5000 });
    await page.locator("#previewSessionClose").click();
    await page.waitForSelector("#previewSessionSheet", { state: "hidden", timeout: 5000 });
    const draftAfter = await page.evaluate((d) => localStorage.getItem(d), DRAFT);
    assert(draftAfter === draftBefore,
      "the preview leaves the resumable draft untouched");

    assert(errors.length === 0, "the preview journey emits no page errors", errors.join(" | "));
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
