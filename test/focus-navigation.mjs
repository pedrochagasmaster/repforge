/**
 * 055-P5 Verification Suite: Focus Navigation, Session Map Reorder, Safe Leave.
 *
 * Requirements:
 * 1. Arbitrary navigation: card bounds, next/prev controls, session map jump.
 * 2. Session-scoped reorder: reordering exercises in Session map dispatches
 *    reorderExercises in DraftV2, updates live Focus deck order, and STOPS if
 *    it touches state.program template order or set ordinals.
 * 3. Safe Leave / Resume: leaving mid-session flushes pending field edits,
 *    verifies persistence, safely navigates to Today, and resuming returns
 *    to the exact exercise and set with data intact.
 * 4. Leave persistence fault safety: leaving cannot drop unpersisted work.
 */

import { chromium } from "playwright";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE_URL = process.env.REPFORGE_URL || "http://localhost:8807/";
const STATE_KEY = "repforge_v1";

function assert(condition, message, detail = "") {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}${detail ? ` — detail: ${detail}` : ""}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(`[PAGE ERROR] ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        pageErrors.push(`[CONSOLE ERROR] ${msg.text()}`);
      }
    });

    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__repforgeBooted === true);

    await installSeedProgram(page, {
      key: STATE_KEY,
      waitFor: async (p) => p.waitForFunction(() => window.__repforgeBooted === true),
    });

    // Start workout
    await page.locator("#startWorkout").click();
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });

    /* ======================================================================
     * 1. Arbitrary navigation: Next / Prev and bounds
     * ====================================================================== */
    console.log("\nNavigation: bounds and next/previous controls");
    const prevBtn = page.locator("#woPrev");
    const nextBtn = page.locator("#woNext");

    // At first exercise: prev is disabled
    assert(await prevBtn.isDisabled(), "previous button is disabled on first exercise");
    assert(!await nextBtn.isDisabled(), "next button is enabled when next exercise exists");

    // Advance to second exercise
    await nextBtn.click();
    await page.waitForTimeout(350);

    const posText = await page.locator("#woProgress .wo-progress__lab").first().textContent();
    assert(posText.includes("2 of") || posText.includes("2 /") || posText.includes("2 de"), "position indicator reflects exercise 2", posText);
    assert(!await prevBtn.isDisabled(), "previous button is now enabled on exercise 2");

    /* ======================================================================
     * 2. Session map direct jump
     * ====================================================================== */
    console.log("\nSession map: arbitrary direct jump");
    await page.locator("#sessionSheetBtn").click();
    await page.waitForSelector("#sessionSheet.is-open", { timeout: 5000 });

    // Jump to exercise index 4 (5th exercise: Machine lateral raise)
    const ex4Row = page.locator("#sessionMap [data-session-map-jump]").nth(4);
    assert(await ex4Row.count() > 0, "session map provides jump targets for exercises");
    await ex4Row.click();
    await page.waitForTimeout(350);

    const atIndex = await page.evaluate(() => window.__repforgeFocus.at());
    assert(atIndex === 4, "jumping via session map lands at exercise index 4", String(atIndex));

    /* ======================================================================
     * 3. Session-scoped exercise reordering
     * ====================================================================== */
    console.log("\nReorder: session-scoped reordering in Session map");
    await page.locator("#sessionSheetBtn").click();
    await page.waitForSelector("#sessionSheet.is-open", { timeout: 5000 });

    // Reorder controls exist
    const reorderDownBtn = page.locator('#sessionMap [data-session-reorder-down]').first();
    assert(await reorderDownBtn.count() > 0, "session map provides reorder-down controls");

    // Capture initial order in DraftV2 and in Program template
    const beforeOrder = await page.evaluate((key) => {
      const draft = window.__repforgeWorkoutDraft.current();
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      return {
        draftOrder: draft.exerciseOrder.slice(),
        programOrder: (state.program || []).map((e) => ({ id: e.id, order: e.order, name: e.name })),
        setOrdinalsEx0: draft.exercises[draft.exerciseOrder[0]].setOrder.map(sid => draft.exercises[draft.exerciseOrder[0]].sets[sid].ordinal),
      };
    }, STATE_KEY);

    const selectedBefore=await page.locator("#workout .exercise.is-current").getAttribute("data-ex");

    // Operate the Move Down control through the keyboard path. The row rerender
    // must restore focus by exercise identity, not by the old DOM node.
    const movingExerciseId = beforeOrder.draftOrder[0];
    const firstMove = await page.evaluate(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      const moving = draft.exerciseOrder[0];
      return { revision: draft.revision, exerciseId: moving, expectedIndex: 1, count: draft.exerciseOrder.length };
    });
    await reorderDownBtn.focus();
    await reorderDownBtn.press("Enter");
    await page.waitForFunction(({ revision, exerciseId, expectedIndex, count }) => {
      const draft = window.__repforgeWorkoutDraft.current();
      const active = document.activeElement;
      const activeId = active?.dataset?.sessionReorderDown || active?.dataset?.sessionReorderUp;
      const announcement = document.querySelector("#toast")?.textContent || "";
      return draft && draft.revision > revision && draft.exerciseOrder.indexOf(exerciseId) === expectedIndex &&
        activeId === exerciseId && active?.tagName === "BUTTON" && !active.disabled &&
        announcement.includes(String(expectedIndex + 1)) && announcement.includes(String(count));
    }, firstMove, { timeout: 5000 });

    const reorderFocus = await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      exerciseId: document.activeElement?.dataset?.sessionReorderDown || null,
      announcement: document.querySelector("#toast")?.textContent || "",
    }));
    assert(reorderFocus.tag === "BUTTON" && reorderFocus.exerciseId === beforeOrder.draftOrder[0],
      "keyboard reorder keeps focus on the same logical Move down control",
      JSON.stringify(reorderFocus));
    assert(reorderFocus.announcement.includes("2") && reorderFocus.announcement.includes(String(beforeOrder.draftOrder.length)),
      "keyboard reorder announces the resulting position",
      JSON.stringify(reorderFocus));

    const afterOrder = await page.evaluate((key) => {
      const draft = window.__repforgeWorkoutDraft.current();
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      return {
        draftOrder: draft.exerciseOrder.slice(),
        programOrder: (state.program || []).map((e) => ({ id: e.id, order: e.order, name: e.name })),
        setOrdinalsEx0: draft.exercises[draft.exerciseOrder[0]].setOrder.map(sid => draft.exercises[draft.exerciseOrder[0]].sets[sid].ordinal),
      };
    }, STATE_KEY);

    assert(await page.locator("#workout .exercise.is-current").getAttribute("data-ex")===selectedBefore,
      "session reordering preserves the selected exercise identity");

    // Verify draftOrder was swapped
    assert(
      afterOrder.draftOrder[0] === beforeOrder.draftOrder[1] &&
      afterOrder.draftOrder[1] === beforeOrder.draftOrder[0],
      "first two exercises swapped order in DraftV2 exerciseOrder",
      JSON.stringify({ before: beforeOrder.draftOrder, after: afterOrder.draftOrder })
    );

    // STOP INVARIANT: program template order MUST be unchanged
    assert(
      JSON.stringify(afterOrder.programOrder) === JSON.stringify(beforeOrder.programOrder),
      "STOP guard: reorder in Session map NEVER mutates state.program template order",
      JSON.stringify({ before: beforeOrder.programOrder, after: afterOrder.programOrder })
    );

    // STOP INVARIANT: set ordinals MUST be unchanged
    assert(
      JSON.stringify(afterOrder.setOrdinalsEx0) === JSON.stringify(beforeOrder.setOrdinalsEx0),
      "STOP guard: reorder in Session map NEVER mutates set ordinals",
      JSON.stringify({ before: beforeOrder.setOrdinalsEx0, after: afterOrder.setOrdinalsEx0 })
    );

    // Continue using the same keyboard path until the moved exercise reaches
    // the end. The requested Move down control is then disabled; focus must
    // move to the stable exercise identity's other live reorder control so
    // keyboard reordering remains operable at the boundary.
    for (let step = 1; step < beforeOrder.draftOrder.length - 1; step++) {
      const beforeMove = await page.evaluate((exerciseId) => {
        const draft = window.__repforgeWorkoutDraft.current();
        const currentIndex = draft.exerciseOrder.indexOf(exerciseId);
        return { revision: draft.revision, exerciseId, expectedIndex: currentIndex + 1, count: draft.exerciseOrder.length };
      }, movingExerciseId);
      await page.keyboard.press("Enter");
      await page.waitForFunction(({ revision, exerciseId, expectedIndex, count }) => {
        const draft = window.__repforgeWorkoutDraft.current();
        const active = document.activeElement;
        const activeId = active?.dataset?.sessionReorderDown || active?.dataset?.sessionReorderUp;
        const announcement = document.querySelector("#toast")?.textContent || "";
        return draft && draft.revision > revision && draft.exerciseOrder.indexOf(exerciseId) === expectedIndex &&
          activeId === exerciseId && active?.tagName === "BUTTON" && !active.disabled &&
          announcement.includes(String(expectedIndex + 1)) && announcement.includes(String(count));
      }, beforeMove, { timeout: 5000 });
    }
    const boundaryFocus = await page.evaluate(() => ({
      exerciseId: document.activeElement?.dataset?.sessionReorderUp || null,
      disabled: document.activeElement?.disabled || false,
      announcement: document.querySelector("#toast")?.textContent || "",
    }));
    assert(boundaryFocus.exerciseId === beforeOrder.draftOrder[0] && !boundaryFocus.disabled,
      "keyboard reorder restores focus to a live control at the list boundary",
      JSON.stringify(boundaryFocus));
    assert(boundaryFocus.announcement.includes(String(beforeOrder.draftOrder.length)),
      "boundary reorder announces the final position",
      JSON.stringify(boundaryFocus));

    // Close session sheet: verify Focus deck reflects the new first exercise
    await page.locator("#sessionSheetClose").click();
    await page.waitForTimeout(250);

    // Jump to index 0: card name must match new first exercise
    await page.evaluate(() => window.__repforgeFocus.to(0));
    await page.waitForTimeout(250);

    const focusCardName = await page.locator("#workout.is-focus .exercise.is-current .ex__namebtn").textContent();
    const expectedName = await page.evaluate(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      return draft.exercises[draft.exerciseOrder[0]].displayName;
    });
    assert(focusCardName.trim() === expectedName.trim(),
      "live Focus deck card matches new first exercise from session reorder",
      JSON.stringify({ focusCardName, expectedName }));

    /* ======================================================================
     * 4. Safe Leave and Resume
     * ====================================================================== */
    console.log("\nSafe Leave/Resume: flushes pending edits, verifies persistence, resumes exactly");
    // Type an uncommitted load into the active set field
    const loadInput = page.locator('#workout.is-focus .exercise.is-current input[data-k$="_load"]').first();
    await loadInput.click();
    await loadInput.fill("137.5");

    // Click leave workout button in header
    const leaveBtn = page.locator("#leaveWorkout");
    await leaveBtn.click();
    await page.waitForTimeout(400);

    // Verify we navigated safely back to Today
    assert(await page.locator("#workoutShell").isHidden(), "workout shell is hidden after leave");
    assert(await page.locator("#todayView").isVisible() || await page.locator("#startWorkout").isVisible(),
      "Today view is visible after leaving workout");

    // Verify Today CTA shows resume / continue
    const startCtaText = await page.locator("#startWorkout").textContent();
    assert(startCtaText.toLowerCase().includes("resume") || startCtaText.toLowerCase().includes("continue"),
      "Today CTA offers Resume/Continue workout", startCtaText);

    // Click resume
    await page.locator("#startWorkout").click();
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });

    // Verify we resumed at the exact same exercise and set with the value intact
    const resumedCardName = await page.locator("#workout.is-focus .exercise.is-current .ex__namebtn").textContent();
    assert(resumedCardName.trim() === expectedName.trim(), "resumed at the exact same exercise", resumedCardName);

    const resumedLoadVal = await page.locator('#workout.is-focus .exercise.is-current input[data-k$="_load"]').first().inputValue();
    assert(resumedLoadVal.includes("137.5"), "uncommitted typed value was preserved across safe leave and resume", resumedLoadVal);

    /* ======================================================================
     * 5. Leave with persistence failure / recovery safety
     * ====================================================================== */
    console.log("\nSafe Leave: unpersisted draft fault protection");
    // Inject persistence failure fault
    await page.evaluate(() => {
      window.__repforgeDraftFault = "persist-failure";
    });

    const repsInput = page.locator('#workout.is-focus .exercise.is-current input[data-k$="_reps"]').first();
    await repsInput.click();
    await repsInput.fill("9");

    // Trigger leave: with in-flight failure, leave must not lose work silently
    await leaveBtn.click();
    await page.waitForTimeout(400);

    // If fault blocked persistence, either recovery UI appears or workout stays active
    const stillActive = !await page.locator("#workoutShell").isHidden();
    const recoveryVisible = await page.locator(".draft-recovery, [data-draft-recovery], .toast").count() > 0;
    assert(stillActive || recoveryVisible, "STOP guard: leave with unpersisted failure cannot silently exit without recovery");

    assert(pageErrors.length === 0, "focus navigation journey emits no errors", pageErrors.join("\n"));
    console.log("\nAll Focus navigation assertions passed successfully!");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("\nFocus navigation proof failed:", err);
  process.exit(1);
});
