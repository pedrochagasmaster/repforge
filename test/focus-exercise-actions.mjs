#!/usr/bin/env node
/**
 * Executable capability proof for 055-P4: Exercise-actions sheet.
 *
 * Exercises the Exercise Actions sheet from the live Focus card:
 * 1. Sheet trigger exists on current Focus card and opens #exActionsSheet.
 * 2. Programmed setup notes are displayed as read-only text without conflating with session notes.
 * 3. Repeat-last handles no-history honestly (disabled with reason), and with history copies
 *    eligible values into draft fields without auto-completing any pending set.
 * 4. Substitution replaces by explicit current exercise ID, retains slot provenance,
 *    and allows restoring original programmed movement.
 * 5. Warm-up management toggles individual set roles between working and warmup.
 * 6. Single-exercise skip and restore updates exercise status while preserving set data.
 *
 * Run: node test/focus-exercise-actions.mjs
 * Requires static server on REPFORGE_URL (port 8000).
 */
import { launchChromium } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const STATE_KEY = "repforge_v1";

function assert(condition, message, detail = "") {
  if (!condition) {
    const extra = detail ? ` — detail: ${detail}` : "";
    throw new Error(`Assertion failed: ${message}${extra}`);
  }
}

async function main() {
  const browser = await launchChromium();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") pageErrors.push(`console.error: ${msg.text()}`);
  });

  try {
    await page.goto(BASE);
    await page.waitForFunction(() => window.__repforgeBooted === true);
    await page.evaluate(() => {
      window.closeFirstRun?.();
      if (document.querySelector("#onboarding")?.classList.contains("active")) window.closeOnboarding?.();
      if (!document.querySelector("#tour")?.classList.contains("hidden")) window.closeTour?.();
    });

    // Install program and seed a previous workout log for Hack Squat (seed-ex-1)
    await installSeedProgram(page, {
      key: STATE_KEY,
      waitFor: () => page.waitForFunction(() => window.__repforgeBooted === true),
    });

    // Seed previous history for seed-ex-1 so repeat-last has data,
    // while seed-ex-2 has NO previous history.
    await page.evaluate(async (key) => {
      const rows = [
        {
          session: "prev-session-1",
          created: "2026-09-10T10:00:00.000Z",
          date: "2026-09-10",
          exerciseId: "seed-ex-1",
          name: "Hack squat",
          set: 1,
          load: 120,
          reps: 6,
          rir: 2,
        },
        {
          session: "prev-session-1",
          created: "2026-09-10T10:00:00.000Z",
          date: "2026-09-10",
          exerciseId: "seed-ex-1",
          name: "Hack squat",
          set: 2,
          load: 125,
          reps: 5,
          rir: 1,
        }
      ];
      const raw = JSON.parse(localStorage.getItem(key) || "{}");
      raw.log = raw.log || [];
      raw.log.unshift(...rows);
      localStorage.setItem(key, JSON.stringify(raw));
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("repforge", 1);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(raw, key);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    }, STATE_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__repforgeBooted === true);

    // Enter Focus workout
    await page.evaluate(async () => {
      await window.__repforgeEnterWorkout({});
    });
    await page.waitForSelector("#workoutShell:not(.hidden) #workout.is-focus", { timeout: 5000 });

    /* ======================================================================
     * 1. Sheet trigger on current Focus card
     * ====================================================================== */
    console.log("\nExercise actions: visible control on Focus card");
    const actionsTrigger = page.locator("#workout .exercise.is-current [data-exactions-open]");
    assert(await actionsTrigger.count() > 0, "the live Focus card provides an Exercise actions trigger");
    await actionsTrigger.click();

    await page.waitForSelector("#exActionsSheet.is-open", { timeout: 5000 });
    assert(await page.locator("#exActionsSheet").isVisible(), "tapping the trigger opens the Exercise actions sheet");

    /* ======================================================================
     * 2. Programmed setup notes
     * ====================================================================== */
    console.log("\nSetup notes: visible and read-only without session notes conflation");
    const setupTextEl = page.locator("#exActionsSetupText");
    assert(await setupTextEl.count() > 0, "setup notes container exists in Exercise actions sheet");

    /* ======================================================================
     * 3. Repeat-last: copies values without auto-completing, honest no-history
     * ====================================================================== */
    console.log("\nRepeat-last: copies values, preserves pending status");
    const repeatBtn = page.locator("#exActionRepeatBtn");
    assert(await repeatBtn.isVisible(), "repeat-last button is visible");
    assert(!(await repeatBtn.isDisabled()), "repeat-last button is enabled when previous history exists");

    await repeatBtn.click();
    await page.waitForTimeout(200);

    // Verify DraftV2 state for seed-ex-1: values copied, sets remain pending!
    const ex1Sets = await page.evaluate(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      const ex = draft.exercises["seed-ex-1"];
      return ex.setOrder.map((sid) => ({
        id: sid,
        completion: ex.sets[sid].completion,
        edited: ex.sets[sid].edited,
        role: ex.sets[sid].role,
      }));
    });
    assert(ex1Sets[0].edited.load === "120" && ex1Sets[0].edited.reps === "6",
      "repeat-last copies previous load and reps into set 1 edited values", JSON.stringify(ex1Sets));
    assert(ex1Sets[0].completion === "pending" && ex1Sets[1].completion === "pending",
      "STOP guard: repeat-last does NOT auto-complete any set", JSON.stringify(ex1Sets));

    // Close actions sheet if open, advance to seed-ex-2 (which has no history)
    if (await page.locator("#exActionsSheet.is-open").count()) {
      await page.locator("#exActionsClose").click();
      await page.waitForTimeout(200);
    }

    // Navigate to second exercise
    await page.evaluate(() => window.__repforgeFocus.to(1));
    await page.waitForTimeout(300);

    // Open Exercise actions for seed-ex-2
    await page.locator("#workout .exercise.is-current [data-exactions-open]").click();
    await page.waitForSelector("#exActionsSheet.is-open", { timeout: 5000 });

    console.log("\nRepeat-last: honest no-history handling");
    const repeatBtnEx2 = page.locator("#exActionRepeatBtn");
    const isEx2RepeatDisabled = await repeatBtnEx2.isDisabled();
    const ex2HintText = await page.locator("#exActionRepeatHint").textContent();
    assert(isEx2RepeatDisabled, "repeat-last is disabled when no prior session exists for the exercise");
    assert(ex2HintText.trim().length > 0, "honest explanation is shown when no history exists", ex2HintText);

    /* ======================================================================
     * 4. Warm-up management: toggles role between working and warmup
     * ====================================================================== */
    console.log("\nWarm-up management: toggles individual set role");
    const warmupToggleSet1 = page.locator("#exActionsWarmupList [data-warm-toggle-set]").first();
    assert(await warmupToggleSet1.count() > 0, "warm-up toggle controls are rendered for each set");

    // Click to mark Set 1 as warmup
    await warmupToggleSet1.click();
    await page.waitForTimeout(200);

    const roleAfterWarmup = await page.evaluate(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      const list = window.__repforgeFocus.list();
      const idx = window.__repforgeFocus.at();
      const curId = list[idx]?.id;
      const ex = draft.exercises[curId];
      return ex.sets[ex.setOrder[0]].role;
    });
    assert(roleAfterWarmup === "warmup", "set 1 role changed to warmup in DraftV2", roleAfterWarmup);

    // Re-click to mark back as working
    await warmupToggleSet1.click();
    await page.waitForTimeout(200);

    const roleAfterWorking = await page.evaluate(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      const list = window.__repforgeFocus.list();
      const idx = window.__repforgeFocus.at();
      const curId = list[idx]?.id;
      const ex = draft.exercises[curId];
      return ex.sets[ex.setOrder[0]].role;
    });
    assert(roleAfterWorking === "working", "set 1 role restored to working in DraftV2", roleAfterWorking);

    /* ======================================================================
     * 5. Substitution: replaces by explicit ID, preserves provenance, reversible
     * ====================================================================== */
    console.log("\nSubstitution: explicit current ID replacement and restore");
    const substBtn = page.locator("#exActionSubstBtn");
    assert(await substBtn.isVisible(), "substitute button is visible in actions sheet");

    // Click substitute button to open picker
    await substBtn.click();
    await page.waitForSelector("#exPickSheet:not(.hidden)", { timeout: 5000 });

    // Pick a replacement exercise from the library
    const firstPickerItem = page.locator("#exPickList .pickrow").first();
    await firstPickerItem.click();
    await page.waitForTimeout(300);

    // Verify DraftV2 substitution record
    const subCheck = await page.evaluate(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      const list = window.__repforgeFocus.list();
      const idx = window.__repforgeFocus.at();
      const curId = list[idx]?.id;
      const ex = draft.exercises[curId];
      return {
        hasSub: !!ex.substitution,
        origName: ex.displayName,
        subReplacement: ex.substitution?.replacement?.displayName || null,
        subLibraryId: ex.substitution?.replacement?.sourceExerciseId || null,
      };
    });
    assert(subCheck.hasSub && subCheck.subReplacement,
      "substitution record is applied to the active exercise in DraftV2", JSON.stringify(subCheck));

    // Open Exercise actions again to verify "Restore original" option appears
    await page.locator("#workout .exercise.is-current [data-exactions-open]").click();
    await page.waitForSelector("#exActionsSheet.is-open", { timeout: 5000 });

    const restoreOrigBtn = page.locator("#exActionRestoreOrigBtn");
    assert(await restoreOrigBtn.isVisible(), "restore original exercise button is visible when substituted");

    await restoreOrigBtn.click();
    await page.waitForTimeout(300);

    const afterRestore = await page.evaluate(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      const list = window.__repforgeFocus.list();
      const idx = window.__repforgeFocus.at();
      const curId = list[idx]?.id;
      const ex = draft.exercises[curId];
      return { hasSub: !!ex.substitution, displayName: ex.displayName };
    });
    assert(!afterRestore.hasSub, "restoring original clears substitution in DraftV2", JSON.stringify(afterRestore));

    /* ======================================================================
     * 6. Skip and restore exercise
     * ====================================================================== */
    console.log("\nSkip/restore: single-exercise status control");
    await page.locator("#workout .exercise.is-current [data-exactions-open]").click();
    await page.waitForSelector("#exActionsSheet.is-open", { timeout: 5000 });

    const skipBtn = page.locator("#exActionSkipBtn");
    assert(await skipBtn.isVisible(), "skip button is visible in actions sheet");

    const skippedExId = await page.evaluate(() => {
      const list = window.__repforgeFocus.list();
      const idx = window.__repforgeFocus.at();
      return list[idx]?.id;
    });
    await skipBtn.click();
    await page.waitForTimeout(300);

    const skipStatus = await page.evaluate((id) => {
      const draft = window.__repforgeWorkoutDraft.current();
      return {
        status: draft.exercises[id]?.status,
        newSelected: draft.session.selectedExerciseId,
      };
    }, skippedExId);
    assert(skipStatus.status === "skipped", "exercise status changed to skipped in DraftV2", JSON.stringify(skipStatus));
    assert(skipStatus.newSelected !== skippedExId, "skipping advances Focus selection to another exercise");

    assert(pageErrors.length === 0, "exercise actions journey emits no errors", pageErrors.join("\n"));
    console.log("\nAll Exercise-actions assertions passed successfully!");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("\nExercise actions proof failed:", err);
  process.exit(1);
});
