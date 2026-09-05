#!/usr/bin/env node
/**
 * Production-backed characterization for Plan 051's workout-draft boundary.
 *
 * The journey uses only controls that are visible in the selected List or
 * Focus mode. It records the current saved-row meaning while exercising the
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

async function fillVisible(page, selector, value) {
  const candidates = page.locator(selector);
  for (let index = 0; index < await candidates.count(); index++) {
    const candidate = candidates.nth(index);
    if (await candidate.isVisible()) {
      await candidate.fill(String(value));
      return;
    }
  }
  throw new Error(`no visible field for ${selector}`);
}

async function chooseSubstitute(page, exerciseId, name) {
  await page.locator(`.exercise[data-ex="${exerciseId}"] .subst__pick`).click();
  await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
  await page.fill("#exPickSearch", name);
  await page.waitForTimeout(100);
  const picked = await page.evaluate((expected) => {
    const row = [...document.querySelectorAll("#exPickList .pickrow")].find(
      (candidate) => candidate.querySelector(".pickrow__name")?.textContent?.trim() === expected,
    );
    row?.click();
    return Boolean(row);
  }, name);
  await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
  assert(picked, "the visible substitution picker selects the exact library movement", name);
}

async function switchMode(page, buttonId) {
  await page.locator("#woOverflowBtn").click();
  await page.locator(buttonId).click();
}

function normalizeRows(rows) {
  return rows.map((row) => {
    const copy = { ...row };
    delete copy.session;
    delete copy.created;
    return copy;
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
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForBoot(page);

    const program = seedProgram();
    const first = program[0];
    const second = program[1];
    const third = program[2];
    const previousDate = "2026-08-08";
    const previousSession = `${previousDate}_Day 1_previous`;
    const previousRows = [
      { set: 1, load: 50, reps: 10, rir: 2 },
      { set: 2, load: 52.5, reps: 8, rir: 1 },
    ].map((set) => ({
      session: previousSession,
      date: previousDate,
      day: first.day,
      name: first.name,
      exerciseId: first.id,
      ...set,
      notes: "",
      created: `${previousDate}T12:00:00.000Z`,
      primary: first.primary,
      secondary: first.secondary,
      performedName: first.name,
      performedPrimary: first.primary,
      performedSecondary: first.secondary,
    }));
    const baseState = JSON.parse(await page.evaluate((key) => localStorage.getItem(key) || "{}", STATE_KEY));
    await writeState(page, {
      ...baseState,
      program,
      programMeta: seedProgramMeta(),
      log: previousRows,
      settings: { ...baseState.settings, lang: "en", unit: "kg", rirMode: "numeric", restSec: 0 },
    });
    await page.evaluate((key) => localStorage.removeItem(key), DRAFT_KEY);
    await reload(page);

    console.log("\nList projection: previous values, metadata, skip/restore, substitution, warm-up");
    await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false, day: "Day 1" }));
    await page.waitForSelector("#workoutShell:not(.hidden) #workout:not(.is-focus)", { timeout: 5000 });
    await page.locator(`.exercise[data-ex="${first.id}"] .copylast`).click();
    await page.waitForTimeout(100);

    const repeated = await page.evaluate((id) => ({
      first: ["load", "reps", "rir"].map(
        (field) => document.querySelector(`.exercise[data-ex="${id}"] [data-k="${id}_1_${field}"]`)?.value,
      ),
      second: ["load", "reps", "rir"].map(
        (field) => document.querySelector(`.exercise[data-ex="${id}"] [data-k="${id}_2_${field}"]`)?.value,
      ),
    }), first.id);
    assert(
      JSON.stringify(repeated) === JSON.stringify({ first: ["50", "10", "2"], second: ["52.5", "8", "1"] }),
      "repeat-last copies the previous session's ordered set values",
      JSON.stringify(repeated),
    );

    await fillVisible(page, `#workout [data-k="${second.id}_1_load"]`, 35);
    await fillVisible(page, `#workout [data-k="${second.id}_1_reps"]`, 12);
    await fillVisible(page, `#workout [data-k="${second.id}_1_rir"]`, 2);
    await page.locator("#woOverflowBtn").click();
    await fillVisible(page, "#date", SESSION_DATE);
    await fillVisible(page, "#bodyweight", 82.5);
    await fillVisible(page, "#notes", SESSION_NOTE);
    await page.locator(`.exercise[data-ex="${first.id}"] [data-exnote-toggle="${first.id}"]`).click();
    await fillVisible(page, `.exercise[data-ex="${first.id}"] [data-exnote="${first.id}"]`, EXERCISE_NOTE);
    await page.locator(`.exercise[data-ex="${first.id}"] [data-warm="${first.id}_2"]`).click();

    await page.locator(`.exercise[data-ex="${second.id}"] [data-skip="${second.id}"]`).click();
    await page.locator(`.exercise[data-ex="${second.id}"] [data-skip="${second.id}"]`).click();
    const restoredSecond = await page.evaluate((id) => ["load", "reps", "rir"].map(
      (field) => document.querySelector(`.exercise[data-ex="${id}"] [data-k="${id}_1_${field}"]`)?.value,
    ), second.id);
    assert(
      JSON.stringify(restoredSecond) === JSON.stringify(["35", "12", "2"]),
      "skip and restore retain the exercise subtree's edited values",
      JSON.stringify(restoredSecond),
    );

    await chooseSubstitute(page, first.id, "Lat pulldown");
    await page.locator(`.exercise[data-ex="${third.id}"] [data-skip="${third.id}"]`).click();
    await page.locator(`.exercise[data-ex="${first.id}"] [data-save="${first.id}_1"]`).click();
    assert(
      (await page.locator(`.exercise[data-ex="${first.id}"] [data-save="${first.id}_1"]`).getAttribute("aria-pressed")) === "true",
      "List completion commits the programmed set",
    );

    console.log("\nFocus projection: correction, uncommit, recommit, ordered next set");
    await switchMode(page, "#modeFocus");
    await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 5000 });
    const focusFirst = await page.evaluate(() => {
      const card = document.querySelector("#workout .exercise.is-current");
      return {
        name: card?.querySelector(".focus-ex__name")?.textContent?.trim(),
        completed: card?.querySelectorAll(".ledger__row[data-editn]").length,
        active: ["load", "reps", "rir"].map(
          (field) => card?.querySelector(`.focus-well [data-k$="_${field}"]`)?.value,
        ),
      };
    });
    assert(
      focusFirst.name?.includes("Lat pulldown") && focusFirst.completed === 1 &&
        JSON.stringify(focusFirst.active) === JSON.stringify(["52.5", "8", "1"]),
      "Focus projects the substitution, committed row, and next ordered copied set",
      JSON.stringify(focusFirst),
    );

    await page.locator("#workout .exercise.is-current .ledger__row[data-editn]").click();
    await fillVisible(page, "#workout .exercise.is-current .focus-well [data-k$='_load']", 55);
    await page.locator("#workout .exercise.is-current .focus-well .saveset").click();
    const corrected = await page.locator("#workout .exercise.is-current .ledger__row[data-editn] .ledger__load").textContent();
    assert(corrected?.trim() === "55", "Focus correction updates the committed set in place", corrected || "missing row");

    await switchMode(page, "#modeFull");
    await page.waitForSelector("#workout:not(.is-focus)", { timeout: 5000 });
    await page.locator(`.exercise[data-ex="${first.id}"] [data-save="${first.id}_1"]`).click();
    assert(
      (await page.locator(`.exercise[data-ex="${first.id}"] [data-save="${first.id}_1"]`).getAttribute("aria-pressed")) === "false",
      "List uncommit retains corrected values while returning the set to pending",
    );
    await switchMode(page, "#modeFocus");
    const pendingAgain = await page.evaluate(() => {
      const card = document.querySelector("#workout .exercise.is-current");
      return {
        completed: card?.querySelectorAll(".ledger__row[data-editn]").length,
        active: ["load", "reps", "rir"].map(
          (field) => card?.querySelector(`.focus-well [data-k$="_${field}"]`)?.value,
        ),
      };
    });
    assert(
      pendingAgain.completed === 0 && JSON.stringify(pendingAgain.active) === JSON.stringify(["55", "10", "2"]),
      "Focus projects the corrected uncommitted set as the next ordered set",
      JSON.stringify(pendingAgain),
    );
    await page.locator("#workout .exercise.is-current .focus-well .saveset").click();

    console.log("\nPersistence: reload the same aggregate and save its current history meaning");
    const rawBeforeReload = await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY);
    assert(typeof rawBeforeReload === "string" && rawBeforeReload.length > 0, "the active workout is persisted before reload");
    await reload(page);
    await page.evaluate(() => window.__repforgeEnterWorkout({ focus: true }));
    await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 5000 });
    const afterReload = await page.evaluate(({ firstId, secondId, thirdId }) => {
      const list = window.__repforgeFocus.list();
      const firstIndex = list.findIndex((exercise) => exercise.id === firstId);
      window.__repforgeFocus.to(firstIndex);
      const firstCard = document.querySelector("#workout .exercise.is-current");
      const firstState = {
        name: firstCard?.querySelector(".focus-ex__name")?.textContent?.trim(),
        completed: firstCard?.querySelectorAll(".ledger__row[data-editn]").length,
        activeLoad: firstCard?.querySelector(".focus-well [data-k$='_load']")?.value,
      };
      const secondIndex = window.__repforgeFocus.list().findIndex((exercise) => exercise.id === secondId);
      window.__repforgeFocus.to(secondIndex);
      const secondCard = document.querySelector("#workout .exercise.is-current");
      return {
        firstState,
        secondValues: ["load", "reps", "rir"].map(
          (field) => secondCard?.querySelector(`.focus-well [data-k$="_${field}"]`)?.value,
        ),
        visibleIds: window.__repforgeFocus.list().map((exercise) => exercise.id),
        thirdId,
        date: document.querySelector("#date")?.value,
        bodyweight: document.querySelector("#bodyweight")?.value,
        sessionNotes: document.querySelector("#notes")?.value,
      };
    }, { firstId: first.id, secondId: second.id, thirdId: third.id });
    assert(
      afterReload.firstState.name?.includes("Lat pulldown") && afterReload.firstState.completed === 1 &&
        afterReload.firstState.activeLoad === "52.5",
      "reload restores completion, substitution, correction, and warm-up ordering",
      JSON.stringify(afterReload.firstState),
    );
    assert(
      JSON.stringify(afterReload.secondValues) === JSON.stringify(["35", "12", "2"]) &&
        !afterReload.visibleIds.includes(third.id),
      "reload restores touched values and keeps the skipped exercise out of Focus",
      JSON.stringify(afterReload),
    );
    assert(
      afterReload.date === SESSION_DATE && afterReload.bodyweight === "82.5" && afterReload.sessionNotes === SESSION_NOTE,
      "reload restores session date, bodyweight, and notes",
      JSON.stringify(afterReload),
    );

    const beforeRows = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).log, STATE_KEY);
    const sessionsBefore = new Set(beforeRows.map((row) => row.session));
    const saveResult = await page.evaluate(async () => {
      const result = await window.__repforgeSaveWorkout();
      await window.__repforgeStorage.flush();
      return result;
    });
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STATE_KEY);
    const sessionId = [...new Set(saved.log.map((row) => row.session))].find((id) => !sessionsBefore.has(id));
    const actualRows = normalizeRows(saved.log.filter((row) => row.session === sessionId));
    const expectedRows = [
      {
        date: SESSION_DATE,
        day: first.day,
        name: first.name,
        exerciseId: first.id,
        set: 1,
        load: 55,
        reps: 10,
        rir: 2,
        notes: SESSION_NOTE,
        primary: first.primary,
        secondary: first.secondary,
        performedName: "Lat pulldown",
        performedPrimary: "Lats",
        performedSecondary: "Biceps,Forearms",
        performedLibraryId: "pd_mc",
        exNote: EXERCISE_NOTE,
        bodyweight: 82.5,
      },
      {
        date: SESSION_DATE,
        day: first.day,
        name: first.name,
        exerciseId: first.id,
        set: 2,
        load: 52.5,
        reps: 8,
        rir: 1,
        notes: SESSION_NOTE,
        primary: first.primary,
        secondary: first.secondary,
        performedName: "Lat pulldown",
        performedPrimary: "Lats",
        performedSecondary: "Biceps,Forearms",
        performedLibraryId: "pd_mc",
        exNote: EXERCISE_NOTE,
        warmup: true,
        bodyweight: 82.5,
      },
      {
        date: SESSION_DATE,
        day: second.day,
        name: second.name,
        exerciseId: second.id,
        set: 1,
        load: 35,
        reps: 12,
        rir: 2,
        notes: SESSION_NOTE,
        primary: second.primary,
        secondary: second.secondary,
        performedName: second.name,
        performedPrimary: second.primary,
        performedSecondary: second.secondary,
        performedMovementId: `slot:${second.id}`,
        bodyweight: 82.5,
      },
    ];
    assert(saveResult?.localOk || saveResult?.idbOk, "the production save transaction accepts the characterized draft", JSON.stringify(saveResult));
    assert(
      JSON.stringify(actualRows) === JSON.stringify(expectedRows),
      "history rows preserve exact current completion/touch/warm-up and substitution provenance semantics",
      `actual=${JSON.stringify(actualRows)} expected=${JSON.stringify(expectedRows)}`,
    );
    assert(
      actualRows.some((row) => row.exerciseId === second.id) &&
        !actualRows.some((row) => row.exerciseId === third.id) &&
        (await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY)) === null,
      "touched incomplete work is saved, skipped work is omitted, and the committed draft is removed",
      JSON.stringify(actualRows),
    );
    assert(
      await page.locator("#sessionSummary:not(.hidden)").count(),
      "the characterized save still opens the production session summary",
    );
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
