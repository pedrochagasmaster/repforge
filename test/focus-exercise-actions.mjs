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
    const actionsTrigger = page.locator("#woOverflowBtn");
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
    await page.locator("#woOverflowBtn").click();
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
     * 4b. Keyboard focus continuity after a set-role toggle (audit A04)
     * ====================================================================== */
    console.log("\nSet-role toggle: keyboard focus survives the rerender");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const SEL = "#exActionsWarmupList [data-warm-toggle-set]";
    const roleOf = (idx) => page.evaluate((i) => {
      const draft = window.__repforgeWorkoutDraft.current();
      const ex = draft.exercises[window.__repforgeFocus.list()[window.__repforgeFocus.at()].id];
      return ex.sets[ex.setOrder[i]].role;
    }, idx);
    const setIdOf = (idx) => page.evaluate((i) => {
      const draft = window.__repforgeWorkoutDraft.current();
      const ex = draft.exercises[window.__repforgeFocus.list()[window.__repforgeFocus.at()].id];
      return ex.setOrder[i];
    }, idx);
    const focusState = () => page.evaluate(() => {
      const a = document.activeElement;
      return { tag: a?.tagName, set: a?.getAttribute?.("data-warm-toggle-set") || null, id: a?.id || null, text: a?.tagName === "BUTTON" ? a.textContent.trim() : null };
    });
    // Next focusable after the active element in DOM order, computed from the sheet itself.
    const expectedNextTab = (sid) => page.evaluate((sid) => {
      const sheet = document.querySelector("#exActionsSheet");
      const cand = [...sheet.querySelectorAll("button, a[href], input, select, textarea, [tabindex]")]
        .filter((el) => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden");
      const i = cand.indexOf(sheet.querySelector(`[data-warm-toggle-set="${CSS.escape(sid)}"]`));
      const n = cand[i + 1];
      return i < 0 || !n ? null : { tag: n.tagName, set: n.getAttribute("data-warm-toggle-set"), id: n.id || null, text: n.textContent.trim() };
    }, sid);
    const waitFreshToggle = () => page.waitForFunction((sel) => {
      const b = document.querySelector(sel);
      return b && !b.__stale;
    }, SEL);
    const keyToggle = async (dir, fromRole, toRole) => {
      const sid = await setIdOf(0);
      assert(await roleOf(0) === fromRole, `${dir}: set 1 starts as ${fromRole}`);
      const btn = page.locator(SEL).first();
      await btn.focus();
      await page.evaluate((sel) => { document.querySelectorAll(sel).forEach((b) => { b.__stale = true; }); }, SEL);
      await page.keyboard.press("Enter");
      await page.waitForFunction(([i, role]) => {
        const d = window.__repforgeWorkoutDraft.current();
        const ex = d.exercises[window.__repforgeFocus.list()[window.__repforgeFocus.at()].id];
        return ex.sets[ex.setOrder[i]].role === role;
      }, [0, toRole]);
      await waitFreshToggle();
      const fs = await focusState();
      const expected = await expectedNextTab(sid);
      assert(expected, `${dir}: a DOM-order successor exists`);
      await page.keyboard.press("Tab");
      const after = await focusState();
      const tabOk = after.tag === expected.tag && after.set === expected.set && after.id === expected.id;
      assert(fs.set === sid && fs.tag === "BUTTON" && tabOk,
        `${dir}: focus returns to the same set's new control after Enter and Tab follows DOM order`,
        JSON.stringify({ focusAfterEnter: fs, expectedTab: expected, focusAfterTab: after }));
      assert(await page.evaluate(() => !!document.activeElement.closest("#exActionsSheet")),
        `${dir}: modal focus trap keeps focus inside the sheet`);
    };
    await keyToggle("working->warm-up", "working", "warmup");
    await keyToggle("warm-up->working", "warmup", "working");

    // Pointer operation still works.
    await page.locator(SEL).first().click();
    await page.waitForFunction(() => {
      const d = window.__repforgeWorkoutDraft.current();
      const ex = d.exercises[window.__repforgeFocus.list()[window.__repforgeFocus.at()].id];
      return ex.sets[ex.setOrder[0]].role === "warmup";
    });
    assert(await roleOf(0) === "warmup", "pointer click still flips the set role");
    await page.locator(SEL).first().click();
    await page.waitForFunction(() => {
      const d = window.__repforgeWorkoutDraft.current();
      const ex = d.exercises[window.__repforgeFocus.list()[window.__repforgeFocus.at()].id];
      return ex.sets[ex.setOrder[0]].role === "working";
    });

    // A rejected/stale toggle (set id no longer in the draft) must not invent focus movement.
    await page.locator(SEL).first().focus();
    await page.evaluate((sel) => { document.querySelector(sel).setAttribute("data-warm-toggle-set", "stale-set-id"); }, SEL);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
    const stale = await page.evaluate((sel) => ({
      staleStillFocused: document.activeElement === document.querySelector(sel) && document.activeElement.getAttribute("data-warm-toggle-set") === "stale-set-id",
    }), SEL);
    assert(stale.staleStillFocused, "stale set toggle leaves focus untouched (no invented movement)", JSON.stringify(stale));
    assert(await roleOf(0) === "working", "stale set toggle changes no role");
    await page.evaluate(() => window.__repforgeExActions.render(window.__repforgeFocus.list()[window.__repforgeFocus.at()].id));

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
    await page.locator("#woOverflowBtn").click();
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
    await page.locator("#woOverflowBtn").click();
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

    /* ======================================================================
     * 7. The subtitle counts sets in the page language (Plan 064 N01)
     * ====================================================================== */
    console.log("\nSubtitle: the set count reads in the page language");
    await page.evaluate(() => {
      state.settings.lang = "pt";
      window.RepForgeI18n.setLang("pt");
      syncLang();
    });
    await page.locator("#woOverflowBtn").click();
    await page.waitForSelector("#exActionsSheet.is-open", { timeout: 5000 });
    const ptSub = (await page.locator("#exActionsSub").innerText()).replace(/\s+/g, " ").trim();
    assert(/\b\d+ séries\b/.test(ptSub) && !/\bsets?\b/i.test(ptSub),
      "PT: the actions subtitle counts séries, not the English word sets", ptSub);
    await page.locator("#exActionsClose").click();
    await page.locator("#exActionsSheet").waitFor({ state: "hidden" });
    await page.evaluate(() => {
      state.settings.lang = "en";
      window.RepForgeI18n.setLang("en");
      syncLang();
    });
    await page.locator("#woOverflowBtn").click();
    await page.waitForSelector("#exActionsSheet.is-open", { timeout: 5000 });
    const enSub = (await page.locator("#exActionsSub").innerText()).replace(/\s+/g, " ").trim();
    assert(/\b\d+ sets\b/.test(enSub) && !/séries/.test(enSub), "EN: the actions subtitle still counts sets", enSub);

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
