#!/usr/bin/env node
/**
 * Plan 055 / 055-P3: Session sheet for workout metadata, map, and early finish.
 *
 * The Session sheet relocated date, bodyweight, and session notes from List and
 * header overflow into a dedicated Focus sheet, backed by DraftV2 commands.
 * Every field round-trips through reload, the session map reflects exercise
 * completion and allows direct jump, and Early finish requires an explicit
 * confirmation from a fresh draft revision, rejecting stale revisions.
 *
 * Run: node test/focus-session-sheet.mjs
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
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await installSeedProgram(page, { key: KEY, waitFor: waitForApp });
  return { context, page, errors };
}

const flushDraft = (page) => page.evaluate(() => window.__repforgeWorkoutDraft.flush());

async function main() {
  const browser = await launchChromium();
  const { context, page, errors } = await freshPage(browser);
  try {
    /* ---- Enter workout in Focus mode ---- */
    phase("Session sheet: visible control in Focus header");
    await page.evaluate(async () => {
      await window.__repforgeEnterWorkout({ focus: true });
    });
    await page.waitForSelector("#workout.is-focus .exercise.is-current", { state: "attached", timeout: 5000 });

    const sheetBtn = page.locator("#sessionSheetBtn");
    assert(await sheetBtn.count() === 1 && await sheetBtn.isVisible(),
      "the workout header provides a visible Session sheet button");

    await sheetBtn.click({ timeout: 5000 });
    await page.waitForSelector("#sessionSheet.is-open", { timeout: 5000 });
    assert(true, "clicking the session button opens the Session sheet");

    /* ---- Date, bodyweight, session notes field bindings ---- */
    phase("Session fields: date, bodyweight, notes dispatch DraftV2 commands");
    const dateInput = page.locator("#sessionDate");
    const bwInput = page.locator("#sessionBodyweight");
    const notesInput = page.locator("#sessionNotes");

    assert(await dateInput.count() === 1 && await bwInput.count() === 1 && await notesInput.count() === 1,
      "the session sheet exposes date, bodyweight, and notes fields");

    // Edit session date
    await dateInput.fill("2026-10-15");
    await page.evaluate(() => document.querySelector("#sessionDate").dispatchEvent(new Event("change")));
    await flushDraft(page);

    // Edit bodyweight
    await bwInput.fill("82.5");
    await page.evaluate(() => document.querySelector("#sessionBodyweight").dispatchEvent(new Event("input")));
    await flushDraft(page);

    // Edit notes
    await notesInput.fill("Feeling strong today. Bench setup feels rock solid.");
    await page.evaluate(() => document.querySelector("#sessionNotes").dispatchEvent(new Event("input")));
    await flushDraft(page);

    const draftValues = await page.evaluate(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      return {
        date: draft.program.scheduleDate,
        bodyweight: draft.session.bodyweight,
        notes: draft.session.notes,
      };
    });

    assert(draftValues.date === "2026-10-15",
      "session date updates draft scheduleDate via DraftV2 command", draftValues.date);
    assert(draftValues.bodyweight === "82.5",
      "session bodyweight updates draft bodyweight via DraftV2 command", draftValues.bodyweight);
    assert(draftValues.notes === "Feeling strong today. Bench setup feels rock solid.",
      "session notes update draft notes via DraftV2 command", draftValues.notes);

    /* ---- Reload survival ---- */
    phase("Reload survival: session fields survive reload byte-for-byte");
    await page.locator("#sessionSheetClose").click();
    await page.waitForSelector("#sessionSheet", { state: "hidden", timeout: 5000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.evaluate(async () => {
      await window.__repforgeEnterWorkout({ focus: true });
    });
    await page.waitForSelector("#workout.is-focus .exercise.is-current", { state: "attached", timeout: 5000 });

    await page.locator("#sessionSheetBtn").click();
    await page.waitForSelector("#sessionSheet.is-open", { timeout: 5000 });

    const restoredFields = await page.evaluate(() => ({
      date: document.querySelector("#sessionDate")?.value,
      bodyweight: document.querySelector("#sessionBodyweight")?.value,
      notes: document.querySelector("#sessionNotes")?.value,
    }));

    assert(restoredFields.date === "2026-10-15" &&
           restoredFields.bodyweight === "82.5" &&
           restoredFields.notes === "Feeling strong today. Bench setup feels rock solid.",
      "session fields restore their exact values after page reload", JSON.stringify(restoredFields));

    /* ---- Session map navigation ---- */
    phase("Session map: exercises listed, direct jump to target exercise");
    const mapRows = await page.locator("#sessionMap [data-session-map-ex]");
    const rowCount = await mapRows.count();
    assert(rowCount >= 2, "the session map lists every programmed exercise", `found ${rowCount}`);

    // Jump to the second exercise via session map
    const secondExId = await mapRows.nth(1).getAttribute("data-session-map-ex");
    await mapRows.nth(1).click();
    await page.waitForSelector("#sessionSheet", { state: "hidden", timeout: 5000 });

    const currentExId = await page.evaluate(() =>
      document.querySelector("#workout .exercise.is-current:not(.is-peek)")?.dataset.ex);
    assert(currentExId === secondExId,
      "tapping an exercise row in the session map jumps directly to that exercise in Focus",
      `target: ${secondExId}, actual: ${currentExId}`);

    /* ---- Commit one set so we have work for early finish ---- */
    phase("Commit work and test Early finish");
    // Enter focus on first exercise and commit a set
    await page.evaluate(() => window.__repforgeFocus.to(0));
    await page.waitForTimeout(150);
    const loadInput = page.locator("#workout .exercise.is-current:not(.is-peek) [data-k$='_load']").first();
    const repsInput = page.locator("#workout .exercise.is-current:not(.is-peek) [data-k$='_reps']").first();
    const rirInput = page.locator("#workout .exercise.is-current:not(.is-peek) [data-k$='_rir']").first();
    await loadInput.fill("60");
    await repsInput.fill("10");
    await rirInput.fill("2");
    await flushDraft(page);
    await page.locator("#workout .exercise.is-current:not(.is-peek) .focus-well .saveset").first().click();
    await flushDraft(page);

    /* ---- Early finish: stale revision rejection ---- */
    phase("Early finish: stale revision rejection and fresh confirmation");
    await page.locator("#sessionSheetBtn").click();
    await page.waitForSelector("#sessionSheet.is-open", { timeout: 5000 });

    const earlyBtn = page.locator("#sessionEarlyFinish");
    assert(await earlyBtn.count() === 1 && await earlyBtn.isVisible(),
      "early finish button is visible in the session sheet");

    await earlyBtn.click();
    await page.waitForSelector("#sessionEarlyPrompt:not(.hidden)", { timeout: 5000 });
    assert(await page.locator("#sessionEarlyConfirm").isVisible(),
      "tapping early finish reveals the confirmation prompt");

    // Intentionally mutate the draft behind the prompt to make the captured revision stale!
    await page.evaluate(async () => {
      await window.__repforgeWorkoutDraft.dispatch("setSessionNotes", {
        value: "Mutated behind the prompt to bump revision",
      });
      await window.__repforgeWorkoutDraft.flush();
    });

    // Attempt to confirm on the stale revision
    await page.locator("#sessionEarlyConfirm").click();
    await page.waitForTimeout(200);

    // Assert that the early finish was REJECTED: summary did not open, draft still exists
    const staleCheck = await page.evaluate(() => {
      const summaryOpen = !document.querySelector("#sessionSummary")?.classList.contains("hidden");
      const draftActive = !!window.__repforgeWorkoutDraft.current();
      const hasError = !!document.querySelector("#sessionEarlyMsg.is-error, #toast");
      return { summaryOpen, draftActive, hasError };
    });

    assert(!staleCheck.summaryOpen && staleCheck.draftActive,
      "early finish on a stale revision is rejected without saving", JSON.stringify(staleCheck));

    // Fresh early finish: confirm with the refreshed revision
    await page.locator("#sessionEarlyConfirm").click();

    await page.waitForSelector("#sessionSummary:not(.hidden)", { timeout: 8000 });
    await page.evaluate(() => window.__repforgeStorage.flush());

    const savedState = await page.evaluate((key) => {
      const saved = JSON.parse(localStorage.getItem(key) || "{}");
      return {
        draft: localStorage.getItem("repforge_draft_v1"),
        historyCount: (saved.log || []).length,
        summaryVisible: !document.querySelector("#sessionSummary")?.classList.contains("hidden"),
      };
    }, KEY);

    assert(savedState.draft === null && savedState.historyCount > 0 && savedState.summaryVisible,
      "confirming early finish with a fresh revision saves history, clears draft, and opens summary",
      JSON.stringify(savedState));

    assert(errors.length === 0, "the session sheet journey emits no page or console errors", errors.join(" | "));
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(`\n${results.passed} passed, ${results.failed} failed`);
  if (results.failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
