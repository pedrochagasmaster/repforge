#!/usr/bin/env node
/**
 * Browser smoke for Plan 048 program-entry production adapter.
 * Run: REPFORGE_URL=http://localhost:8000/ node test/program-entry-browser.mjs
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Adapter = require("../program-entry-adapter.js");
const Compiler = require("../program-compiler.js");
const { EXERCISE_LIBRARY } = require("../exercises.js");
const entryServices = Adapter.createProductionServices({ Compiler, catalogue: EXERCISE_LIBRARY });

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_program_setup_draft_v1";
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

async function openFresh(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  return { context, page };
}

async function seedActiveProgram(page) {
  await page.evaluate(async (key) => {
    localStorage.removeItem("repforge_program_setup_draft_v1");
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = () => res();
      req.onerror = () => res();
      req.onblocked = () => res();
    });
    const now = new Date().toISOString();
    const state = {
      settings: {
        jumpPct: 2.5, minJump: 2.5, rirHigh: 3, hardRir: 1, restSec: 120, unit: "kg", lang: "en", rirMode: "numeric",
        voiceInputEnabled: false, notifyEnabled: false, notifyTimer: true, notifySession: true,
        notifyUnfinished: false, notifyMissed: false,
      },
      programMeta: {
        id: "active-prog", name: "Active block", started: "2026-08-01", created: now, updated: now,
        goal: "hypertrophy", experience: "intermediate", daysPerWeek: 3, splitType: "full_body",
        equipment: ["machines"], priorityMuscles: [], sessionLength: "normal",
        mesocycleLengthWeeks: 6, mesocycleStatus: "active", onboarded: true,
        progressionRelations: [], progressionModifiers: [], progressionIncompatibilities: [],
        programStructure: null,
      },
      program: [{
        id: "ex1", day: "Day 1", order: 1, name: "Cable Row", sets: 3, min: 8, max: 12,
        primary: "Back", secondary: "Biceps", notes: "", libraryId: "row_cable",
      }],
      log: [],
      programHistory: [],
      customExercises: [],
      _storageRevision: 3,
    };
    localStorage.setItem(key, JSON.stringify(state));
    localStorage.setItem("repforge_ui_v1", JSON.stringify({ tourDone: true, installDismissedAt: Date.now() }));
  }, KEY);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(() => {
    window.closeFirstRun?.();
    window.closeOnboarding?.();
    window.closeTour?.();
  });
  const active = await page.evaluate(() => ({
    onboarded: !!window.state?.programMeta?.onboarded || (() => {
      try { return !!JSON.parse(localStorage.getItem("repforge_v1") || "{}").programMeta?.onboarded; } catch { return false; }
    })(),
    name: (() => {
      try { return JSON.parse(localStorage.getItem("repforge_v1") || "{}").programMeta?.name; } catch { return null; }
    })(),
    len: (() => {
      try { return (JSON.parse(localStorage.getItem("repforge_v1") || "{}").program || []).length; } catch { return 0; }
    })(),
  }));
  if (!active.onboarded || active.name !== "Active block") {
    throw new Error(`seedActiveProgram failed: ${JSON.stringify(active)}`);
  }
}

const browser = await launchChromium();
try {
  console.log("\nEntry hub and recommend activation");
  {
    const { context, page } = await openFresh(browser);
    await page.click("#firstRunCreate");
    assert(await page.locator('[data-entry-route="recommend"]').isVisible(), "hub shows recommend");
    assert(await page.locator('[data-entry-route="custom"]').isVisible(), "hub shows custom");
    assert(await page.locator("#entryOwnToggle").isVisible(), "hub shows bring/build");
    await page.click('[data-entry-route="recommend"]');
    const headingTab = await page.locator("#entryHeading").getAttribute("tabindex");
    assert(headingTab === "-1", "entry heading is focusable via tabindex", headingTab);
    await page.click('[data-entry-pick="desiredResult"][data-entry-val="muscle_growth"]');
    const pressed = await page.locator('[data-entry-pick="desiredResult"][data-entry-val="muscle_growth"]').getAttribute("aria-pressed");
    assert(pressed === "true", "selected desired-result card sets aria-pressed", pressed);
    await page.click("#onbNext");
    await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
    await page.click('[data-entry-pick="recentConsistency"][data-entry-val="most"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="3"]');
    await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
    await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="auto"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
    assert(await page.locator(".entry__correct").isVisible(), "environment correction UI appears after shortcut");
    assert(await page.locator('[data-entry-pick="environmentEquipment"][data-entry-val="barbell"]').isVisible(), "equipment correction includes barbell");
    assert(await page.locator('[data-entry-pick="environmentCapabilities"][data-entry-val="safe_pull"]').isVisible(), "capability correction includes safe_pull");
    assert(await page.locator('[data-entry-pick="environmentCapabilities"][data-entry-val="external_resistance"]').count() === 0, "hard external_resistance is not a user toggle");
    await page.click("#onbNext");
    assert(await page.locator("#entryAvoidSearch").isVisible(), "avoidance search is present on priorities");
    await page.fill("#entryAvoidSearch", "bench");
    await page.waitForTimeout(50);
    const avoidAdd = page.locator("[data-entry-avoid-add]").first();
    if (await avoidAdd.count()) {
      await avoidAdd.click();
      await page.click('[data-entry-pick="avoidReason"][data-entry-val$="|pain"]');
      const pain = await page.locator(".entry__pain").innerText();
      assert(/safety|substitut|hurt|segurança|substitui/i.test(pain), "pain reason shows conservative safety copy", pain);
    } else {
      assert(false, "avoidance search returned at least one exercise for 'bench'");
    }
    await page.click("#onbNext");
    await page.waitForSelector("[data-entry-select-candidate]");
    const candidateCount = await page.locator("[data-entry-select-candidate]").count();
    assert(candidateCount === 1, "recommend shows only the primary result", String(candidateCount));
    const draftBefore = await page.evaluate((key) => localStorage.getItem(key), DRAFT);
    assert(!!draftBefore, "setup draft persisted during recommend");
    await page.locator("[data-entry-select-candidate]").first().click();
    await page.waitForSelector("#entryActivate");
    await page.click("#entryActivate");
    await page.waitForFunction((key) => {
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      return state.programMeta?.onboarded === true && (state.program || []).length > 0;
    }, KEY, { timeout: 10000 });
    const after = await page.evaluate((key) => {
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      return {
        onboarded: state.programMeta?.onboarded,
        programLen: (state.program || []).length,
        hasContext: !!state.programmingContext,
        constraints: state.programmingContext?.exerciseConstraints || [],
        draft: localStorage.getItem("repforge_program_setup_draft_v1"),
      };
    }, KEY);
    assert(after.onboarded === true, "activation onboarded the program");
    assert(after.programLen > 0, "activation wrote exercises", String(after.programLen));
    assert(after.hasContext === true, "reusable programmingContext saved with activation");
    assert(after.constraints.some((item) => item.reason === "pain"), "pain constraint persisted in programmingContext");
    assert(after.draft == null, "setup draft cleared after activation");

    const exportShapes = await page.evaluate(() => {
      const full = window.__repforgeStorage
        ? null
        : null;
      const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      const backup = JSON.parse(JSON.stringify(state));
      delete backup._rev;
      const programOnly = {
        version: 3,
        meta: state.programMeta,
        exercises: state.program,
        customExercises: [],
      };
      const shared = window.RepForgeSharedSetup
        ? { hasProgrammingContext: false }
        : { hasProgrammingContext: false };
      return {
        backupHasContext: !!backup.programmingContext,
        programHasContext: Object.prototype.hasOwnProperty.call(programOnly, "programmingContext"),
        sharedHasContext: shared.hasProgrammingContext,
        backupConstraintReasons: (backup.programmingContext?.exerciseConstraints || []).map((item) => item.reason),
      };
    });
    assert(exportShapes.backupHasContext === true, "full durable state includes programmingContext");
    assert(exportShapes.programHasContext === false, "program-only export shape excludes programmingContext");
    assert(exportShapes.sharedHasContext === false, "shared-setup shape excludes programmingContext by construction");
    await context.close();
  }

  console.log("\nBuild creates visible empty day cards and supports add-exercise");
  {
    const { context, page } = await openFresh(browser);
    page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
    await page.click("#firstRunCreate");
    await page.click("#entryOwnToggle");
    await page.click('[data-entry-route="build"]');
    await page.locator("#entryProgramName").pressSequentially("Manual block", { delay: 10 });
    assert(await page.inputValue("#entryProgramName") === "Manual block", "manual program name keeps focus across real keystrokes");
    await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="4"]');
    await page.waitForFunction(() => !document.querySelector("#onbNext")?.disabled, undefined, { timeout: 5000 });
    await page.click("#onbNext");
    await page.waitForSelector("#programEditor .pday", { timeout: 10000 });
    const built = await page.evaluate((key) => {
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      const cards = [...document.querySelectorAll("#programEditor .pday")].map((card) => ({
        day: card.getAttribute("data-day"),
        empty: !!card.querySelector(".pday__empty"),
        exercises: card.querySelectorAll(".pex").length,
      }));
      return {
        name: state.programMeta?.name,
        programLen: (state.program || []).length,
        days: state.programMeta?.programStructure?.days?.length || 0,
        onboarded: state.programMeta?.onboarded,
        cards,
      };
    }, KEY);
    assert(built.onboarded === true, "build activation onboarded");
    assert(built.programLen === 0, "build has no placeholder exercises before add", String(built.programLen));
    assert(built.days === 4, "build created four empty days", String(built.days));
    assert(built.cards.length === 4, "editor shows four day cards", String(built.cards.length));
    assert(built.cards.every((card) => card.empty && card.exercises === 0), "all four day cards are empty containers");
    assert(built.name === "Manual block", "build kept the program name", built.name);

    await page.locator('#programEditor [data-act="addEx"]').first().click();
    await page.waitForSelector("#exPickSheet.is-open, #exPickList .pickrow", { timeout: 5000 });
    await page.locator("#exPickList .pickrow").first().click();
    await page.waitForFunction(() => (JSON.parse(localStorage.getItem("repforge_v1") || "{}").program || []).length > 0, undefined, { timeout: 8000 });
    const afterAdd = await page.evaluate((key) => {
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      return {
        programLen: (state.program || []).length,
        structureDays: state.programMeta?.programStructure?.days?.length || 0,
        cards: document.querySelectorAll("#programEditor .pday").length,
        placeholdersBeforeAddGone: (state.program || []).every((ex) => ex.name !== "Exercise"),
      };
    }, KEY);
    assert(afterAdd.programLen >= 1, "exercise can be added into an empty day", String(afterAdd.programLen));
    assert(afterAdd.structureDays === 4, "structure days remain four after adding one exercise", String(afterAdd.structureDays));
    assert(afterAdd.cards === 4, "four day cards remain visible after add", String(afterAdd.cards));
    await context.close();
  }

  console.log("\nBuild with active program requires replacement confirmation");
  {
    const { context, page } = await openFresh(browser);
    await seedActiveProgram(page);
    let dialogs = [];
    page.removeAllListeners("dialog");
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    await page.evaluate(() => window.startOnboarding?.("settings"));
    await page.waitForSelector("#entryOwnToggle", { timeout: 5000 });
    await page.click("#entryOwnToggle");
    await page.click('[data-entry-route="build"]');
    await page.fill("#entryProgramName", "Replacement");
    await page.locator("#entryProgramName").dispatchEvent("input");
    await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="3"]');
    await page.waitForFunction(() => !document.querySelector("#onbNext")?.disabled, undefined, { timeout: 5000 });
    await page.click("#onbNext");
    await page.waitForTimeout(300);
    assert(dialogs.length >= 1, "cancel path shows replacement confirmation", JSON.stringify(dialogs));
    assert(/replace|substitu/i.test(dialogs[0] || ""), "confirmation uses replace wording", dialogs[0]);
    const cancelled = await page.evaluate((key) => {
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      return { name: state.programMeta?.name, id: state.programMeta?.id, programLen: (state.program || []).length };
    }, KEY);
    assert(cancelled.name === "Active block", "cancel keeps the active program", cancelled.name);
    assert(cancelled.programLen === 1, "cancel does not wipe exercises", String(cancelled.programLen));

    dialogs = [];
    page.removeAllListeners("dialog");
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });
    await page.waitForSelector("#onbNext:not([disabled])", { timeout: 5000 });
    await page.click("#onbNext");
    await page.waitForFunction((key) => {
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      return state.programMeta?.name === "Replacement";
    }, KEY, { timeout: 10000 });
    const replaced = await page.evaluate((key) => {
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      return {
        name: state.programMeta?.name,
        programLen: (state.program || []).length,
        days: state.programMeta?.programStructure?.days?.length || 0,
      };
    }, KEY);
    assert(dialogs.length >= 1, "confirm path shows replacement confirmation");
    assert(replaced.name === "Replacement", "accept replaces the active program", replaced.name);
    assert(replaced.programLen === 0 && replaced.days === 3, "replacement is empty 3-day build", JSON.stringify(replaced));
    await context.close();
  }

  console.log("\nCorrupt draft fails closed");
  {
    const { context, page } = await openFresh(browser);
    await page.evaluate((key) => localStorage.setItem(key, "{"), DRAFT);
    await page.click("#firstRunCreate");
    const notice = await page.locator(".entry__notice").innerText().catch(() => "");
    assert(/could not be opened|não foi possível/i.test(notice), "corrupt draft shows restart notice", notice);
    await context.close();
  }

  console.log("\nInterrupted treatment executes reduced week one and restores week two");
  {
    const compiled = entryServices.compile({
      mode: "recommend",
      answers: {
        desiredResult: "muscle_growth",
        structuredExperience: "6_to_24m",
        recentConsistency: "about_half",
        daysPerWeek: 3,
        sessionMinutes: 60,
        preferredRestSeconds: 120,
        environment: { kind: "commercial_gym" },
        primaryMuscles: [],
        priorityMovements: [],
        exerciseConstraints: [],
      },
      versions: entryServices.currentVersions(),
    });
    if (!compiled.ok) throw new Error(`interrupted compile failed: ${compiled.code}`);
    const weekOnePrescription = compiled.preview.programStructure.weekPrescriptions
      .find((entry) => entry.week === 1);
    const byDay = new Map(compiled.preview.programStructure.days.map((entry) => {
      const targets = weekOnePrescription.days.find((day) => day.dayId === entry.dayId).slots;
      return [entry.label, {
        authored: compiled.preview.program.filter((exercise) => exercise.day === entry.label),
        targets,
      }];
    }));
    const reduced = [...byDay.entries()].find(([, programs]) =>
      programs.targets.filter((target) => target.sets > 0).length < programs.authored.length ||
      programs.targets.reduce((sum, target) => sum + target.sets, 0) <
        programs.authored.reduce((sum, exercise) => sum + exercise.sets, 0));
    if (!reduced) throw new Error("interrupted compile produced no reduced day");
    const [reducedDay, programs] = reduced;
    const expectedWeekOneExercises = programs.targets.filter((target) => target.sets > 0).length;
    const expectedWeekOneSets = programs.targets.reduce((sum, target) => sum + target.sets, 0);
    const expectedNormalExercises = programs.authored.length;
    const expectedNormalSets = programs.authored.reduce((sum, exercise) => sum + exercise.sets, 0);
    const today = new Date().toISOString().slice(0, 10);
    const state = {
      settings: {
        jumpPct: 2.5, minJump: 2.5, rirHigh: 3, hardRir: 1, restSec: 120, unit: "kg", lang: "en", rirMode: "numeric",
        voiceInputEnabled: false, notifyEnabled: false, notifyTimer: true, notifySession: true,
        notifyUnfinished: false, notifyMissed: false,
      },
      programMeta: {
        id: "interrupted-program", name: "Interrupted program", started: today,
        created: `${today}T00:00:00.000Z`, updated: `${today}T00:00:00.000Z`,
        goal: "hypertrophy", experience: "intermediate", daysPerWeek: 3, splitType: "full_body",
        equipment: ["barbell", "dumbbell", "machine", "cable", "smith"], priorityMuscles: [], sessionLength: "60",
        mesocycleLengthWeeks: 6, mesocycleStatus: "active", onboarded: true,
        progressionRelations: [], progressionModifiers: [], progressionIncompatibilities: [],
        programStructure: compiled.preview.programStructure,
      },
      program: compiled.preview.program,
      log: [], programHistory: [], customExercises: [], _storageRevision: 1,
    };
    const { context, page } = await openFresh(browser);
    await page.evaluate(async ({ key, state }) => {
      await new Promise((resolve) => {
        const request = indexedDB.deleteDatabase("repforge");
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      });
      localStorage.setItem(key, JSON.stringify(state));
      localStorage.setItem("repforge_ui_v1", JSON.stringify({ tourDone: true, installDismissedAt: Date.now() }));
    }, { key: KEY, state });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const durableBeforeWeekOne = await page.evaluate((key) => localStorage.getItem(key), KEY);
    await page.evaluate(({ day }) => window.__repforgeEnterWorkout({ focus: false, day }), { day: reducedDay });
    const weekOneDom = await page.evaluate(() => ({
      exercises: document.querySelectorAll("#workout > .exercise").length,
      sets: document.querySelectorAll("#workout .setrow").length,
      durableBytes: localStorage.getItem("repforge_v1"),
    }));
    assert(weekOneDom.exercises === expectedWeekOneExercises,
      "week one omits only compiler-scheduled zero-set exercises",
      `${weekOneDom.exercises} !== ${expectedWeekOneExercises}`);
    assert(weekOneDom.sets === expectedWeekOneSets,
      "week one renders the compiler-scheduled reduced sets",
      `${weekOneDom.sets} !== ${expectedWeekOneSets}`);
    assert(weekOneDom.durableBytes === durableBeforeWeekOne,
      "week-one execution leaves authored durable program bytes unchanged");

    const weekTwoStart = new Date();
    weekTwoStart.setUTCDate(weekTwoStart.getUTCDate() - 8);
    await page.evaluate(async ({ key, started }) => {
      const next = JSON.parse(localStorage.getItem(key));
      next.programMeta.started = started;
      next._storageRevision += 1;
      localStorage.setItem(key, JSON.stringify(next));
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("repforge", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("kv");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const transaction = db.transaction("kv", "readwrite");
        transaction.objectStore("kv").put(next, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
    }, { key: KEY, started: weekTwoStart.toISOString().slice(0, 10) });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await page.evaluate(({ day }) => window.__repforgeEnterWorkout({ focus: false, day }), { day: reducedDay });
    const weekTwoDom = await page.evaluate(() => ({
      exercises: document.querySelectorAll("#workout > .exercise").length,
      sets: document.querySelectorAll("#workout .setrow").length,
    }));
    assert(weekTwoDom.exercises === expectedNormalExercises,
      "interrupted treatment restores all exercises in week two",
      `${weekTwoDom.exercises} !== ${expectedNormalExercises}`);
    assert(weekTwoDom.sets === expectedNormalSets,
      "interrupted treatment restores authored sets in week two",
      `${weekTwoDom.sets} !== ${expectedNormalSets}`);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
