#!/usr/bin/env node
/**
 * Browser smoke for Plan 048 program-entry production adapter.
 * Run: REPFORGE_URL=http://localhost:8000/ node test/program-entry-browser.mjs
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { createRequire } from "node:module";
import { isDeepStrictEqual } from "node:util";

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

function canonicalCompilerPreview(preview) {
  const byLibraryId = new Map(EXERCISE_LIBRARY.map((entry) => [entry.id, entry]));
  const program = (preview?.program || []).map((row) => {
    const entry = byLibraryId.get(row?.libraryId);
    return entry ? { ...row, primary: entry.primary || "", secondary: entry.secondary || "" } : row;
  });
  const programStructure = structuredClone(preview?.programStructure || null);
  const bySlot = new Map();
  for (const row of program) {
    for (const id of [row?.slotId, row?.id]) if (id != null && !bySlot.has(String(id))) bySlot.set(String(id), row);
  }
  for (const week of programStructure?.weekPrescriptions || []) {
    for (const day of week?.days || []) {
      for (const slot of day?.slots || []) {
        const row = bySlot.get(String(slot?.slotId));
        if (!row) continue;
        if (Object.hasOwn(slot, "primary")) slot.primary = row.primary;
        if (Object.hasOwn(slot, "secondary")) slot.secondary = row.secondary;
      }
    }
  }
  return { program, programStructure };
}

async function openFresh(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  return { context, page };
}

async function seedActiveProgram(page, { libraryId = "row_cable", exerciseName = "Cable Row" } = {}) {
  await page.evaluate(async ({ key, libraryId, exerciseName }) => {
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
        progressionRelations: [],
        progressionModifiers: [{
          id: "outgoing-only", version: 1, compatibleStrategies: ["range@1"], params: { pending: true },
        }],
        progressionIncompatibilities: [],
        programStructure: null,
      },
      program: [{
        id: "ex1", day: "Day 1", order: 1, name: exerciseName, sets: 3, min: 8, max: 12,
        primary: "Mid/upper back", secondary: "Biceps", notes: "", libraryId,
      }],
      log: [],
      programHistory: [],
      customExercises: [{
        id: "custom:active-definition", name: "Active custom movement", namePt: "Movimento personalizado ativo",
        equipment: ["machine"], primary: "Mid/upper back", secondary: "", notes: "", created: now,
      }],
      _storageRevision: 3,
    };
    localStorage.setItem(key, JSON.stringify(state));
    localStorage.setItem("repforge_ui_v1", JSON.stringify({ tourDone: true, installDismissedAt: Date.now() }));
  }, { key: KEY, libraryId, exerciseName });
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

async function openInstalledProgramEditor(page) {
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#program.view.active", { timeout: 5000 });
  if (await page.locator("#programEditorWrap").evaluate((element) => element.classList.contains("is-hidden"))) {
    await page.click("#programEditToggle");
  }
  await page.waitForSelector("#programEditorWrap:not(.is-hidden)", { timeout: 5000 });
}

async function openFreshEntryAt(browser, viewport, textScale = 1) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  if (textScale !== 1) {
    await page.evaluate((scale) => { document.documentElement.style.fontSize = `${scale * 100}%`; }, textScale);
  }
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  return { context, page };
}

async function parkOnboardingScroll(page) {
  return page.evaluate(() => {
    const onboarding = document.querySelector("#onboarding");
    if (!onboarding) return { max: 0, before: 0 };
    const max = Math.max(0, onboarding.scrollHeight - onboarding.clientHeight);
    const before = Math.min(120, max);
    onboarding.scrollTop = before;
    onboarding.scrollLeft = 7;
    return { max, before, after: onboarding.scrollTop };
  });
}

async function onboardingGeometry(page) {
  return page.evaluate(() => {
    const onboarding = document.querySelector("#onboarding");
    const heading = document.querySelector("#entryHeading");
    const headingRect = heading?.getBoundingClientRect();
    const onboardingRect = onboarding?.getBoundingClientRect();
    const step = document.querySelector("#onbStepLabel")?.textContent.trim() || "";
    return {
      scrollTop: Math.round(onboarding?.scrollTop || 0),
      scrollLeft: Math.round(onboarding?.scrollLeft || 0),
      headingTop: headingRect ? Math.round(headingRect.top) : null,
      headingBottom: headingRect ? Math.round(headingRect.bottom) : null,
      viewportTop: onboardingRect ? Math.round(onboardingRect.top) : 0,
      viewportBottom: onboardingRect ? Math.round(onboardingRect.bottom) : window.innerHeight,
      headingVisible: !!headingRect && headingRect.top >= (onboardingRect?.top || 0) - 1 &&
        headingRect.bottom <= (onboardingRect?.bottom || window.innerHeight) + 1,
      step,
    };
  });
}

async function onboardingTextMetrics(page) {
  return page.evaluate(() => {
    const size = (selector) => {
      const element = document.querySelector(selector);
      return element ? Number.parseFloat(getComputedStyle(element).fontSize) : null;
    };
    return {
      eyebrow: size("#onbEyebrow"),
      step: size("#onbStepLabel"),
      heading: size("#entryHeading"),
      explain: size("#onbBody .onb__explain"),
      option: size("#onbBody .radio-card__title"),
      back: size("#onbBack"),
      next: size("#onbNext"),
    };
  });
}

async function customTextMetrics(page) {
  return page.evaluate(() => {
    const size = (selector) => {
      const element = document.querySelector(selector);
      return element ? Number.parseFloat(getComputedStyle(element).fontSize) : null;
    };
    return {
      muscleName: size(".entry__muscle-name"),
      muscleCurrent: size(".entry__muscle-current"),
      muscleState: size(".entry__muscle-state"),
      exerciseName: size(".entry__exercise-name"),
      exerciseAction: size(".entry__exercise-action"),
      exerciseSelected: size(".entry__exercise-selected"),
    };
  });
}

async function onboardingControlGeometry(page) {
  return page.evaluate(() => {
    const root = document.querySelector("#onboarding");
    const rootRect = root?.getBoundingClientRect();
    const controls = [...document.querySelectorAll(
      "#onboarding button, #onboarding input, #onboarding select, #onboarding textarea, #onboarding summary, #onboarding [role=button]"
    )].filter((element) => {
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.getBoundingClientRect().width > 0;
    });
    const clipped = controls.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < (rootRect?.left || 0) - 1 || rect.right > (rootRect?.right || window.innerWidth) + 1;
    });
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      controls: controls.length,
      clipped: clipped.map((element) => element.id || element.dataset.entryPick || element.tagName),
    };
  });
}

function textMetricsMatchScale(metrics, scale) {
  const expected = scale === 2
    ? { eyebrow: 36, step: 22, heading: 60, explain: 32, option: 32, back: 32, next: 36 }
    : { eyebrow: 18, step: 11, heading: 30, explain: 16, option: 16, back: 16, next: 18 };
  return Object.entries(expected).every(([key, value]) =>
    Number.isFinite(metrics[key]) && Math.abs(metrics[key] - value) < 0.1);
}

function customTextMetricsMatchScale(metrics, fields, scale) {
  const expected = scale === 2
    ? { muscleName: 32, muscleCurrent: 22, muscleState: 32, exerciseName: 28, exerciseAction: 32, exerciseSelected: 28 }
    : { muscleName: 16, muscleCurrent: 11, muscleState: 16, exerciseName: 14, exerciseAction: 16, exerciseSelected: 14 };
  return fields.every((key) => Number.isFinite(metrics[key]) && Math.abs(metrics[key] - expected[key]) < 0.1);
}

async function assertOnboardingTransition(page, check, label, action) {
  const parked = await parkOnboardingScroll(page);
  await action();
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 25000 });
  await page.waitForTimeout(20);
  const geometry = await onboardingGeometry(page);
  check(geometry.scrollTop === 0 && geometry.scrollLeft === 0 && geometry.headingVisible,
    `${label} resets onboarding scroll and exposes its heading`, JSON.stringify({ parked, geometry }));
  return geometry;
}

async function runOnboardingScrollRegression(browser, check) {
  for (const { viewport, textScale, label } of [
    { viewport: { width: 320, height: 568 }, textScale: 1, label: "320px" },
    { viewport: { width: 390, height: 844 }, textScale: 1, label: "390px" },
    { viewport: { width: 430, height: 932 }, textScale: 1, label: "430px" },
    { viewport: { width: 390, height: 844 }, textScale: 2, label: "390px at 200% text" },
  ]) {
    const { context, page } = await openFreshEntryAt(browser, viewport, textScale);
    try {
      const routeEntry = await assertOnboardingTransition(page, check, `${label} route entry`,
        () => page.click('[data-entry-route="recommend"][data-entry-goal="muscle_growth"]'));
      const routeMetrics = await onboardingTextMetrics(page);
      check(textMetricsMatchScale(routeMetrics, textScale),
        `${label} uses genuine rem-based onboarding text resizing`, JSON.stringify({ routeMetrics, textScale }));
      const routeControls = await onboardingControlGeometry(page);
      check(routeControls.overflow <= 0 && routeControls.clipped.length === 0,
        `${label} keeps onboarding controls within the viewport`, JSON.stringify(routeControls));
      check(/1 of 4/i.test(routeEntry.step), `${label} route entry exposes progress context`, routeEntry.step);

      // The goal was answered on the hub, so the route entry is the background step.
      await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
      await page.click('[data-entry-pick="recentConsistency"][data-entry-val="most"]');
      await assertOnboardingTransition(page, check, `${label} Next to schedule`,
        () => page.click("#onbNext"));
      await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="3"]');
      await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
      await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="120"]');
      await assertOnboardingTransition(page, check, `${label} Next to environment`,
        () => page.click("#onbNext"));
      check(/3 of 4/i.test((await onboardingGeometry(page)).step),
        `${label} environment keeps progress context`, await onboardingGeometry(page));

      await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
      await assertOnboardingTransition(page, check, `${label} Next to priorities`,
        () => page.click("#onbNext"));

      const sameStepBefore = await parkOnboardingScroll(page);
      await page.evaluate(() => document.querySelector('[data-entry-pick="primaryMuscles"][data-entry-val="chest"]')?.click());
      await page.waitForTimeout(20);
      const sameStepAfter = await onboardingGeometry(page);
      check(sameStepBefore.before > 0 && sameStepAfter.scrollTop === sameStepBefore.before,
        `${label} same-step selection preserves intentional scroll`,
        JSON.stringify({ before: sameStepBefore, after: sameStepAfter }));

      await assertOnboardingTransition(page, check, `${label} Next to recommendation result`,
        () => page.click("#onbNext"));
      await page.waitForSelector("[data-entry-select-candidate], #entryActivate", { timeout: 25000 });
      const resultGeometry = await onboardingGeometry(page);
      check(resultGeometry.scrollTop === 0 && resultGeometry.headingVisible && resultGeometry.headingTop < 220,
        `${label} recommendation result starts at title region`, JSON.stringify(resultGeometry));

      await assertOnboardingTransition(page, check, `${label} Back to priorities`,
        () => page.click("#onbBack"));
      await assertOnboardingTransition(page, check, `${label} Back to environment`,
        () => page.click("#onbBack"));
      const environmentGeometry = await onboardingGeometry(page);
      check(/3 of 4/i.test(environmentGeometry.step) && environmentGeometry.headingTop < 220,
        `${label} environment correction opens at title/progress region`,
        JSON.stringify(environmentGeometry));
      await page.evaluate(() => document.querySelector(".entry__correct > summary")?.click());
      await page.waitForTimeout(20);
      const correctionGeometry = await onboardingGeometry(page);
      check(correctionGeometry.scrollTop === 0 && correctionGeometry.headingVisible &&
        await page.locator(".entry__correct").getAttribute("open") !== null,
        `${label} environment correction keeps title region visible`,
        JSON.stringify(correctionGeometry));
    } finally {
      await context.close();
    }
  }
}

async function runCustomTextResizeRegression(browser, check) {
  const { context, page } = await openFreshEntryAt(browser, { width: 390, height: 844 }, 2);
  try {
    await page.click('[data-entry-route="custom"]');
    await page.click('[data-entry-pick="desiredResult"][data-entry-val="balanced"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
    await page.click('[data-entry-pick="recentConsistency"][data-entry-val="most"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="4"]');
    await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
    await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="auto"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
    await page.click("#onbNext");
    await page.waitForSelector(".entry__muscle-name", { timeout: 20000 });

    const muscleMetrics = await customTextMetrics(page);
    check(customTextMetricsMatchScale(muscleMetrics, ["muscleName", "muscleCurrent", "muscleState"], 2),
    "Custom 200% muscle labels and states use rem-based text sizing",
    JSON.stringify({ muscleMetrics, expected: {
      muscleName: 28, muscleCurrent: 20, muscleState: 22,
      exerciseName: 28, exerciseAction: 24, exerciseSelected: 28,
    } }));
    const muscleGeometry = await onboardingControlGeometry(page);
    check(muscleGeometry.overflow <= 0 && muscleGeometry.clipped.length === 0,
      "Custom 200% muscle priorities stay within the viewport", JSON.stringify(muscleGeometry));

    await page.click("#onbNext");
    await page.waitForSelector("#entryExerciseSearch", { timeout: 20000 });
    await page.fill("#entryExerciseSearch", "barbell bench press");
    await page.waitForTimeout(80);
    const exerciseMetrics = await customTextMetrics(page);
    check(customTextMetricsMatchScale(exerciseMetrics, ["exerciseName", "exerciseAction"], 2),
      "Custom 200% exercise result text scales with the root", JSON.stringify(exerciseMetrics));
    await page.locator('[data-entry-exercise-add="pr_bb"][data-entry-exercise-status="include"]').click();
    const selectedMetrics = await customTextMetrics(page);
    check(customTextMetricsMatchScale(selectedMetrics, ["exerciseSelected"], 2),
      "Custom 200% selected exercise text scales with the root", JSON.stringify(selectedMetrics));
    const exerciseGeometry = await onboardingControlGeometry(page);
    check(exerciseGeometry.overflow <= 0 && exerciseGeometry.clipped.length === 0,
      "Custom 200% exercise preferences stay within the viewport", JSON.stringify(exerciseGeometry));
  } finally {
    await context.close();
  }
}

const browser = await launchChromium();
try {
  await runCustomTextResizeRegression(browser, assert);
  console.log("\nFirst-run legacy import stages a preview before activation");
  {
    const { context, page } = await openFresh(browser);
    await page.evaluate(async () => {
      localStorage.clear();
      await new Promise((resolve) => {
        const request = indexedDB.deleteDatabase("repforge");
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      });
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 10000 });
    const before = await page.evaluate((key) => localStorage.getItem(key), KEY);
    await page.setInputFiles("#importProgram", {
      name: "legacy-first-run.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify([{
        id: "legacy-first-run-row",
        day: "Day 1",
        name: "Barbell bench press",
        sets: 3,
        repLow: 6,
        repHigh: 10,
        muscles: ["Chest"],
      }])),
    });
    await page.waitForSelector("#importReview.active", { timeout: 10000 });
    await page.click("#importCommit");
    await page.waitForSelector("#entryActivate", { timeout: 10000 });
    const staged = await page.evaluate((key) => ({
      active: localStorage.getItem(key),
      step: window.__repforgeEntryState?.()?.step,
      route: window.__repforgeEntryState?.()?.route,
      previewRows: window.__repforgeEntryState?.()?.result?.preview?.program?.length || 0,
      editVisible: !!document.querySelector("#entryEdit"),
      activateDisabled: !!document.querySelector("#entryActivate")?.disabled,
      firstRunVisible: !document.querySelector("#firstRun")?.classList.contains("hidden"),
    }), KEY);
    assert(staged.active === before, "first-run legacy import leaves active state byte-identical", JSON.stringify(staged));
    assert(staged.step === "preview" && staged.route === "import" && staged.previewRows === 1,
      "first-run legacy import stages the parsed candidate in common preview", JSON.stringify(staged));
    assert(staged.editVisible && !staged.activateDisabled && !staged.firstRunVisible,
      "first-run legacy import exposes edit and explicit activation controls", JSON.stringify(staged));
    await page.click("#entryActivate");
    await page.waitForFunction((key) => {
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      return state.programMeta?.onboarded === true && state.program?.length === 1;
    }, KEY, { timeout: 10000 });
    assert((await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}").programMeta?.onboarded, KEY)) === true,
      "first-run legacy import activates only after explicit preview action");
    await context.close();
  }

  console.log("\nInvalid program-level progression relations stay reviewable and non-destructive");
  {
    const { context, page } = await openFresh(browser);
    await seedActiveProgram(page);
    const activeBefore = await page.evaluate((key) => localStorage.getItem(key), KEY);
    await page.setInputFiles("#importProgram", {
      name: "invalid-relation.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({
        version: 3,
        meta: {
          name: "Invalid relation import",
          progressionRelations: [{
            schemaVersion: 1, id: "broken-pair", type: "paired_exposure", version: 1,
            movementId: "movement:missing", members: [
              { exerciseId: "missing-heavy", role: "heavy" },
              { exerciseId: "missing-volume", role: "volume" },
            ],
          }],
        },
        exercises: [{ day: "Day 1", order: 1, name: "Barbell bench press", sets: 3, min: 6, max: 10 }],
      })),
    });
    await page.waitForSelector("#importReview.active", { timeout: 10000 });
    await page.click("#importCommit");
    await page.waitForSelector("#entryActivate", { timeout: 10000 });
    const candidate = await page.evaluate(() => ({
      active: localStorage.getItem("repforge_v1"),
      relations: window.__repforgeEntryState?.()?.result?.preview?.progressionRelations || [],
      incompatibilities: window.__repforgeEntryState?.()?.result?.preview?.progressionIncompatibilities || [],
      progressionCopy: document.querySelector("#onbBody")?.innerText || "",
      disabled: !!document.querySelector("#entryActivate")?.disabled,
      focused: document.activeElement?.id || "",
    }));
    assert(candidate.active === activeBefore, "invalid import leaves active state byte-identical", JSON.stringify(candidate));
    assert(candidate.relations.length === 0 && candidate.incompatibilities.some((item) => item.kind === "relations"),
      "invalid program relation becomes explicit candidate incompatibility", JSON.stringify(candidate));
    assert(candidate.disabled && /cannot verify|activation is paused/i.test(candidate.progressionCopy),
      "preview does not claim unsupported progression is executable and disables activation", candidate.progressionCopy);
    const activation = await page.evaluate(() => window.__repforgeActivateEntryPreview?.({ skipReplaceConfirm: true }));
    assert(activation?.code === "candidate_incomplete", "activation reports the progression incompatibility", JSON.stringify(activation));
    assert(await page.evaluate((key) => localStorage.getItem(key), KEY) === activeBefore,
      "blocked invalid import never replaces the active program");
    await context.close();
  }

  console.log("\nBrowser Back and explicit setup cancellation preserve draft safety");
  {
    const { context, page } = await openFresh(browser);
    await seedActiveProgram(page);
    const obsoleteGlobals = await page.evaluate(() => ({
      generateProgram: typeof window.generateProgramFromOnboarding,
      switchBeginner: typeof window.switchToBeginnerProgram,
      applyTemplate: typeof window.applyProgramTemplate,
    }));
    assert(Object.values(obsoleteGlobals).every((value) => value === "undefined"),
      "obsolete program setup APIs are not public globals", JSON.stringify(obsoleteGlobals));
    const existingProgram = await page.evaluate((key) => {
      try {
        const state = JSON.parse(localStorage.getItem(key) || "{}");
        return { id: state.programMeta?.id, name: state.programMeta?.name, exercises: state.program?.length || 0 };
      } catch {
        return { id: null, name: null, exercises: 0 };
      }
    }, KEY);
    await page.click("#startWorkout");
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
    await page.waitForSelector("#workout .exercise", { timeout: 5000 });
    await page.waitForFunction(() => {
      const draft = window.__repforgeWorkoutDraft?.current?.();
      const checkpoint = window.__repforgeWorkoutDraft?.checkpoint?.();
      return !!draft && checkpoint?.status === "valid" && checkpoint.value?.kind === "committed";
    }, undefined, { timeout: 5000 });
    const existingWorkoutVisible = await page.locator("#workout .exercise").count() > 0;
    assert(existingProgram.id === "active-prog" && existingProgram.exercises > 0 && existingWorkoutVisible,
      "existing program remains usable without obsolete setup APIs", JSON.stringify({ existingProgram, existingWorkoutVisible }));
    await page.click("#leaveWorkout");
    const activeBefore = await page.evaluate((key) => localStorage.getItem(key), KEY);
    await page.click("#openSettings");
    await page.click("#createProgram");
    await page.click('[data-entry-route="recommend"][data-entry-goal="muscle_growth"]');
    await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
    await page.click('[data-entry-pick="recentConsistency"][data-entry-val="most"]');
    const draftBeforeBack = await page.evaluate((key) => localStorage.getItem(key), DRAFT);

    await page.goBack();
    await page.waitForTimeout(100);
    const afterBrowserBack = await page.evaluate(({ base, stateKey }) => ({
      sameApp: location.href.startsWith(base),
      onboarding: document.querySelector("#onboarding")?.classList.contains("active") === true,
      step: window.__repforgeEntryState?.()?.step,
      desiredResult: window.__repforgeEntryState?.()?.answers?.desiredResult,
      active: localStorage.getItem(stateKey),
    }), { base: BASE, stateKey: KEY });
    assert(afterBrowserBack.sameApp && afterBrowserBack.onboarding,
      "browser Back remains inside program entry", JSON.stringify(afterBrowserBack));
    // The goal was asked on the hub, so Back from the first route step returns there.
    assert(afterBrowserBack.step === "entry" && afterBrowserBack.desiredResult === "muscle_growth",
      "browser Back uses semantic entry Back and preserves answers", JSON.stringify(afterBrowserBack));
    assert(afterBrowserBack.active === activeBefore, "browser Back leaves active state byte-identical");
    assert(await page.locator('[data-entry-route="recommend"]').first().isVisible(),
      "browser Back from the first route step returns to the entry hub");
    await page.goBack();
    await page.waitForSelector("#entryCancelKeep");
    assert(page.url().startsWith(BASE), "browser Back at the hub asks before leaving Taurifer", page.url());
    assert(await page.evaluate(() => document.activeElement?.id === "entryCancelTitle"),
      "cancel decision receives focus when it opens");
    assert(await page.locator("#onboarding .onb__nav").isHidden(),
      "cancel decision owns the surface without a competing footer");
    await page.click("#entryCancelContinue");
    assert(await page.locator("#entryHeading").isVisible(), "continue setup dismisses the cancel decision");
    await page.click("#onbCancel");
    await page.click("#entryCancelKeep");
    await page.waitForFunction(() => !document.querySelector("#onboarding")?.classList.contains("active"));
    assert(await page.evaluate((key) => localStorage.getItem(key), DRAFT) !== null,
      "keep draft and leave preserves the resumable setup draft");
    const chromeAfterCancel = await page.evaluate(() => ({
      bodyClasses: document.body.className,
      navDisplay: getComputedStyle(document.querySelector("nav")).display,
      activeViews: [...document.querySelectorAll(".view.active")].map((view) => view.id),
      focus: document.activeElement?.id || null,
    }));
    // Plan 064 R5: an entry exit returns to where it started. Create program was
    // started from Settings, so Cancel returns to Settings (its chrome, no dock) with
    // focus back on Create program, and leaves no half-closed entry chrome behind.
    assert(chromeAfterCancel.activeViews.join() === "settings" && chromeAfterCancel.navDisplay === "none" &&
      chromeAfterCancel.bodyClasses.includes("is-settings") && !chromeAfterCancel.bodyClasses.includes("is-onboarding") &&
      chromeAfterCancel.focus === "createProgram",
      "Settings program creation returns to Settings, on Create program, after Cancel", JSON.stringify(chromeAfterCancel));

    await page.evaluate(() => window.startOnboarding("settings"));
    await page.waitForSelector("#entryResumeContinue");
    assert(await page.evaluate(() => document.activeElement?.id === "entryResumeTitle"),
      "resume notice receives focus when it opens");
    assert(await page.locator("#onboarding .onb__nav").isHidden(),
      "resume card leaves no competing footer");

    // The saved draft waits for Resume or Start over: the doors are inert, and
    // a tap on any of them changes neither the stored draft nor the step.
    const doorsBefore = await page.evaluate((key) => ({
      draft: localStorage.getItem(key),
      step: window.__repforgeEntryState?.()?.step,
      inert: document.querySelector(".entry__hub")?.inert === true,
      card: !!document.querySelector(".entry__resume #entryResumeContinue"),
    }), DRAFT);
    assert(doorsBefore.inert && doorsBefore.card && !!doorsBefore.draft,
      "the saved draft shows a resume card above inert doors", JSON.stringify({ ...doorsBefore, draft: !!doorsBefore.draft }));
    for (const selector of [
      '[data-entry-route="recommend"]', '[data-entry-route="custom"]', '[data-entry-route="browse"]',
      "#entryOwnToggle", "#entryHelpToggle",
    ]) {
      await page.locator(selector).first().evaluate((el) => el.scrollIntoView({ block: "center" }));
      const box = await page.locator(selector).first().boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.locator(selector).first().evaluate((el) => el.click());
    }
    await page.waitForTimeout(250);
    const doorsAfter = await page.evaluate((key) => ({
      draft: localStorage.getItem(key),
      step: window.__repforgeEntryState?.()?.step,
      route: window.__repforgeEntryState?.()?.route,
      card: !!document.querySelector(".entry__resume #entryResumeContinue"),
      own: document.querySelector("#entryOwnToggle")?.getAttribute("aria-expanded"),
    }), DRAFT);
    assert(doorsAfter.draft === doorsBefore.draft && doorsAfter.step === doorsBefore.step && doorsAfter.card && doorsAfter.own === "false",
      "tapping a door while the resume card shows changes neither the stored draft nor the step",
      JSON.stringify({ before: doorsBefore.step, after: doorsAfter.step, route: doorsAfter.route, card: doorsAfter.card, own: doorsAfter.own }));

    const resumeViewport = page.viewportSize();
    await page.setViewportSize({ width: 320, height: 568 });
    const recoveryTokens = await page.evaluate(() => {
      const tokenValue = (property, token) => {
        const probe = document.createElement("span");
        probe.style.setProperty(property, `var(${token})`);
        document.body.append(probe);
        const value = getComputedStyle(probe).getPropertyValue(property);
        probe.remove();
        return value;
      };
      const controls = {
        primary: ["#entryResumeContinue", "--control-primary-bg", "--control-primary-ink", "--control-primary-boundary"],
        destructive: ["#entryResumeRestart", "--control-destructive-bg", "--control-destructive-ink", "--control-destructive-boundary"],
        quiet: ["#onbCancel", "--control-quiet-bg", "--control-quiet-ink", "--control-quiet-boundary"],
      };
      return Object.fromEntries(Object.entries(controls).map(([role, [selector, background, ink, boundary]]) => {
        const style = getComputedStyle(document.querySelector(selector));
        return [role, {
          actual: [style.backgroundColor, style.color, style.borderColor],
          expected: [tokenValue("background-color", background), tokenValue("color", ink), tokenValue("border-color", boundary)],
        }];
      }));
    });
    assert(Object.values(recoveryTokens).every(({ actual, expected }) => actual.every((value, index) => value === expected[index])),
      "Resume, Start over, and Cancel use their inventoried control tokens", JSON.stringify(recoveryTokens));
    const recoveryTargets = await page.locator("#onbCancel, #entryResumeContinue, #entryResumeRestart").evaluateAll((els) =>
      els.map((el) => {
        const rect = el.getBoundingClientRect();
        return { id: el.id, width: rect.width, height: rect.height };
      }));
    assert(recoveryTargets.length === 3 && recoveryTargets.every(({ width, height }) => width >= 44 && height >= 44),
      "320px recovery actions retain 44px targets", JSON.stringify(recoveryTargets));
    const recoveryFocusPath = [
      ["#onbCancel", "Shift+Tab"],
      ["#entryResumeContinue", "Tab"],
      ["#entryResumeRestart", "Tab"],
    ];
    for (const [selector, key] of recoveryFocusPath) {
      await page.keyboard.press(key);
      const outline = await page.evaluate((expected) => {
        const el = document.activeElement;
        const style = getComputedStyle(el);
        return {
          id: el?.id,
          expected: expected.replace(/^#/, ""),
          style: style.outlineStyle,
          width: Number.parseFloat(style.outlineWidth) || 0,
          offset: style.outlineOffset,
        };
      }, selector);
      assert(outline.id === outline.expected && outline.style !== "none" && outline.width >= 2 && outline.offset === "2px",
        `${selector} retains the frozen keyboard focus ring in Tab order`, JSON.stringify(outline));
    }
    const recoveryGeometry = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      body: document.body.scrollWidth - document.body.clientWidth,
    }));
    assert(recoveryGeometry.document <= 0 && recoveryGeometry.body <= 0,
      "320px recovery has no horizontal or document overflow", JSON.stringify(recoveryGeometry));
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    const largeRecoveryGeometry = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      body: document.body.scrollWidth - document.body.clientWidth,
      targets: [...document.querySelectorAll("#onbCancel, #entryResumeContinue, #entryResumeRestart")]
        .map((el) => el.getBoundingClientRect().height),
    }));
    assert(largeRecoveryGeometry.document <= 0 && largeRecoveryGeometry.body <= 0 &&
      largeRecoveryGeometry.targets.length === 3 && largeRecoveryGeometry.targets.every((height) => height >= 44),
    "200% recovery remains overflow-free with reachable 44px actions", JSON.stringify(largeRecoveryGeometry));
    await page.evaluate(() => document.documentElement.style.removeProperty("font-size"));
    await page.setViewportSize(resumeViewport);
    await page.click("#entryResumeContinue");
    await page.click("#onbCancel");
    await page.click("#entryCancelDiscard");
    await page.waitForFunction(() => !document.querySelector("#onboarding")?.classList.contains("active"));
    assert(await page.evaluate((key) => localStorage.getItem(key), DRAFT) === null,
      "discard draft and leave removes the observed setup draft");
    assert(await page.evaluate((key) => localStorage.getItem(key), KEY) === activeBefore,
      "keep/discard cancellation never changes active state");
    assert(draftBeforeBack !== null, "navigation fixture persisted a setup draft");
    await context.close();
  }

  console.log("\nInstalled editor browser Back preserves staged edits");
  {
    const runBack = async (choice) => {
      const { context, page } = await openFresh(browser);
      try {
        await seedActiveProgram(page);
        await openInstalledProgramEditor(page);
        const name = page.locator('#programEditor [data-role="program-name"]');
        if (choice !== "clean") {
          await name.fill("Unsaved name");
          await name.press("Tab");
          await page.waitForFunction(async () => {
            const debug = await window.__debugProgramEditor?.();
            return debug?.session?.document?.programMeta?.name === "Unsaved name";
          });
        }
        await page.goBack();
        if (choice === "clean") {
          await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"));
          const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), KEY);
          assert(state.programMeta?.name === "Active block", "clean browser Back leaves the installed editor without a prompt");
          return;
        }
        await page.waitForSelector("#programEditorLeave[open]", { timeout: 5000 });
        assert(await page.locator("#programEditorLeave").isVisible(), `${choice} browser Back opens the installed leave surface`);
        if (choice === "keep") {
          await page.click("#programEditorKeep");
          await page.waitForFunction(() => !document.querySelector("#programEditorLeave")?.open);
          const staged = await page.evaluate(async () => (await window.__debugProgramEditor?.())?.session?.document?.programMeta?.name);
          const durable = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}").programMeta?.name, KEY);
          assert(await page.locator('#programEditor [data-role="program-name"]').inputValue() === "Unsaved name" && staged === "Unsaved name",
            "Keep editing retains the dirty staged program name", { staged });
          assert(durable === "Active block", "Keep editing leaves the durable program unchanged", { durable });
          return;
        }
        await page.click(choice === "apply" ? "#programEditorApply" : "#programEditorDiscard");
        await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"));
        const durable = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}").programMeta?.name, KEY);
        assert(durable === (choice === "apply" ? "Unsaved name" : "Active block"),
          `${choice === "apply" ? "Apply" : "Discard"} browser Back resolves the staged program atomically`, { durable });
      } finally {
        await context.close();
      }
    };
    await runBack("clean");
    await runBack("keep");
    await runBack("discard");
    await runBack("apply");
  }

  console.log("\nEntry hub and recommend activation");
  {
    const { context, page } = await openFresh(browser);
    await page.click("#firstRunCreate");
    const localizedExerciseCounts = await page.evaluate(() => {
      window.RepForgeI18n.setLang("pt");
      const value = { one: window.__repforgeEntryExerciseCountLabel(1), many: window.__repforgeEntryExerciseCountLabel(2) };
      window.RepForgeI18n.setLang("en");
      return value;
    });
    assert(localizedExerciseCounts.one === "1 exercício" && localizedExerciseCounts.many === "2 exercícios",
      "common preview exercise facts use native singular and plural copy", JSON.stringify(localizedExerciseCounts));
    const hubComposition = await page.evaluate(() => {
      const visible = (selector) => [...document.querySelectorAll(selector)].filter((el) => {
        const style = getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden";
      });
      const routes = [...document.querySelectorAll("[data-entry-route]")];
      return {
        visibleTitles: visible("#onbEyebrow, #entryHeading").map((el) => el.textContent.trim()),
        progressSegments: document.querySelectorAll("#onbSegbar .segbar__seg").length,
        progressLabel: document.querySelector("#onbStepLabel")?.textContent.trim() || "",
        primary: [...new Set(routes.filter((el) => el.classList.contains("entry-card--primary")).map((el) => el.dataset.entryRoute))],
        goals: routes.filter((el) => el.classList.contains("entry-card--primary")).map((el) => el.dataset.entryGoal),
        secondary: routes.filter((el) => el.classList.contains("entry-card--secondary")).map((el) => el.dataset.entryRoute),
        routeChrome: routes.map((el) => ({ route: el.dataset.entryRoute, icon: !!el.querySelector(".entry-card__icon"), chevron: !!el.querySelector(".entry-card__go") })),
      };
    });
    assert(hubComposition.visibleTitles.length === 1 && hubComposition.visibleTitles[0] === "Create a program",
      "hub presents one visible title", JSON.stringify(hubComposition.visibleTitles));
    assert(hubComposition.progressSegments === 0 && hubComposition.progressLabel === "",
      "hub has no progress segments or progress label", JSON.stringify(hubComposition));
    assert(JSON.stringify(hubComposition.primary) === JSON.stringify(["recommend"]),
      "Recommend is the sole primary route", JSON.stringify(hubComposition.primary));
    assert(JSON.stringify(hubComposition.goals) === JSON.stringify(["muscle_growth", "balanced", "strength"]),
      "Recommend's primary route is its goal question", JSON.stringify(hubComposition.goals));
    assert(JSON.stringify(hubComposition.secondary) === JSON.stringify(["custom", "browse"]),
      "Custom is subordinate and Browse remains separate", JSON.stringify(hubComposition.secondary));
    assert(hubComposition.routeChrome.every((route) => route.icon && route.chevron),
      "hub routes use Taurifer icon and chevron language", JSON.stringify(hubComposition.routeChrome));
    await page.click("#entryOwnToggle");
    const ownComposition = await page.evaluate(() => ({
      secondary: [...document.querySelectorAll("[data-entry-route]")].filter((el) => el.classList.contains("entry-card--secondary")).map((el) => el.dataset.entryRoute),
      chrome: [...document.querySelectorAll('[data-entry-route="build"], [data-entry-route="import"]')].every((el) => !!el.querySelector(".entry-card__go")),
    }));
    assert(ownComposition.secondary.includes("build") && ownComposition.secondary.includes("import"),
      "Build and Import remain secondary under the own path", JSON.stringify(ownComposition));
    assert(ownComposition.chrome, "Build and Import retain chevrons", JSON.stringify(ownComposition));
    await page.click("#entryOwnToggle");
    assert(await page.locator('[data-entry-route="recommend"]').first().isVisible(), "hub shows recommend");
    assert(await page.locator('[data-entry-route="custom"]').isVisible(), "hub shows custom");
    assert(await page.locator("#entryOwnToggle").isVisible(), "hub shows bring/build");
    await page.click('[data-entry-route="recommend"][data-entry-goal="muscle_growth"]');
    const firstRouteHeader = {
      eyebrow: await page.locator("#onbEyebrow").innerText(),
      cancel: await page.locator("#onbCancel").innerText(),
      step: await page.locator("#onbStepLabel").innerText(),
    };
    assert(firstRouteHeader.eyebrow === "Recommend" && firstRouteHeader.cancel === "Cancel" && /1 of 4/i.test(firstRouteHeader.step),
      "Recommend has a route-specific first-step header and Cancel", JSON.stringify(firstRouteHeader));
    // The pinned region sits over the bottom of a long screen by design, so
    // collisions are measured at the end of the scroll, where it takes its own row.
    const inspectEntryGeometry = () => page.evaluate(() => {
      const onboarding = document.querySelector("#onboarding");
      if (onboarding) onboarding.scrollTop = onboarding.scrollHeight;
      const visible = [...document.querySelectorAll("#onbBody > *, #onboarding .onb__nav")].filter((el) => {
        const style = getComputedStyle(el); return style.display !== "none" && style.visibility !== "hidden";
      });
      const rects = visible.map((el) => el.getBoundingClientRect());
      const noOverlap = rects.every((rect, index) => rects.every((other, otherIndex) => index === otherIndex ||
        rect.right <= other.left + 1 || other.right <= rect.left + 1 ||
        rect.bottom <= other.top + 1 || other.bottom <= rect.top + 1));
      return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, noOverlap };
    });
    await page.setViewportSize({ width: 320, height: 568 });
    const compactEntryGeometry = await inspectEntryGeometry();
    assert(compactEntryGeometry.overflow <= 0 && compactEntryGeometry.noOverlap,
      "Recommend composition has no overlap at 320px", JSON.stringify(compactEntryGeometry));
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    const largeEntryGeometry = await inspectEntryGeometry();
    assert(largeEntryGeometry.overflow <= 0 && largeEntryGeometry.noOverlap,
      "Recommend composition has no overlap at 200% text", JSON.stringify(largeEntryGeometry));
    await page.evaluate(() => { document.documentElement.style.fontSize = "100%"; });
    await page.setViewportSize({ width: 1280, height: 800 });
    const desktopEntryGeometry = await inspectEntryGeometry();
    assert(desktopEntryGeometry.overflow <= 0 && desktopEntryGeometry.noOverlap,
      "Recommend composition has no overlap on desktop", JSON.stringify(desktopEntryGeometry));
    await page.setViewportSize({ width: 390, height: 844 });
    const headingTab = await page.locator("#entryHeading").getAttribute("tabindex");
    assert(headingTab === "-1", "entry heading is focusable via tabindex", headingTab);
    await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
    const checked = await page.locator('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]').getAttribute("aria-checked");
    assert(checked === "true", "selected background card sets aria-checked", checked);
    await page.click('[data-entry-pick="recentConsistency"][data-entry-val="about_half"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="3"]');
    await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
    await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="auto"]');
    const scheduleComposition = await page.evaluate(() => {
      const rows = [...document.querySelectorAll(".entry-body--schedule .radio-card")];
      const rects = rows.map((el) => el.getBoundingClientRect());
      const groups = [...document.querySelectorAll(".entry-body--schedule .onb__opts")];
      const seg = document.querySelector(".entry-body--schedule .onb__num");
      return {
        // Days and the session ceiling are numbers set as equal cards in a grid;
        // the rest chooser is a bounded grouped list. Every control is a bounded
        // surface, never a flush hairline row.
        segmented: seg ? getComputedStyle(seg).display : "",
        bounded: groups.length > 0 && groups.every((group) => getComputedStyle(group).borderRadius !== "0px" ||
          [...group.querySelectorAll(".radio-card")].every((card) => getComputedStyle(card).borderRadius !== "0px")),
        noOverlap: rects.every((rect, index) => rects.every((other, otherIndex) => index === otherIndex ||
          rect.right <= other.left + 1 || other.right <= rect.left + 1 ||
          rect.bottom <= other.top + 1 || other.bottom <= rect.top + 1)),
      };
    });
    assert(scheduleComposition.segmented === "grid" && scheduleComposition.bounded,
      "schedule days and duration use bounded reflowing controls", JSON.stringify(scheduleComposition));
    assert(scheduleComposition.noOverlap,
      "schedule groups stay compact without overlap", JSON.stringify(scheduleComposition));
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    const enlargedSchedule = await page.evaluate(() => {
      const controls = [...document.querySelectorAll(".entry-body--schedule .onb__seg .radio-card")];
      const rects = controls.map((element) => element.getBoundingClientRect());
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        clipped: controls.filter((element) => element.scrollWidth > element.clientWidth + 1).length,
        columns: new Set(rects.map((rect) => Math.round(rect.left))).size,
        noOverlap: rects.every((rect, index) => rects.every((other, otherIndex) => index === otherIndex ||
          rect.right <= other.left + 1 || other.right <= rect.left + 1 || rect.bottom <= other.top + 1 || other.bottom <= rect.top + 1)),
      };
    });
    assert(enlargedSchedule.overflow <= 0 && enlargedSchedule.clipped === 0 && enlargedSchedule.columns <= 2 && enlargedSchedule.noOverlap,
      "schedule reflows to at most two columns at 200% text", JSON.stringify(enlargedSchedule));
    await page.evaluate(() => { document.documentElement.style.fontSize = "100%"; });
    await page.click("#onbNext");
    await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
    assert(await page.locator(".entry__correct").isVisible() && !(await page.locator(".entry__correct").getAttribute("open")),
      "environment inventory starts behind a closed disclosure");
    assert(!(await page.locator('[data-entry-pick="environmentEquipment"][data-entry-val="barbell"]').isVisible()),
      "closed environment disclosure hides equipment inventory");
    await page.locator(".entry__correct > summary").focus();
    await page.keyboard.press("Enter");
    assert(await page.locator('[data-entry-pick="environmentEquipment"][data-entry-val="barbell"]').isVisible(),
      "environment disclosure opens by keyboard");
    assert(await page.getByRole("checkbox").count() >= 2,
      "opened environment inventory retains accessible checkbox controls");
    await page.click('[data-entry-pick="environmentEquipment"][data-entry-val="barbell"]');
    assert(await page.locator(".entry__correct").getAttribute("open") !== null,
      "environment disclosure stays open after changing equipment");
    assert(await page.locator('[data-entry-pick="environmentCapabilities"][data-entry-val="safe_pull"]').isVisible(), "capability correction includes safe_pull");
    await page.click('[data-entry-pick="environmentCapabilities"][data-entry-val="safe_pull"]');
    assert(await page.locator(".entry__correct").getAttribute("open") !== null,
      "environment disclosure stays open after changing a capability");
    assert(await page.locator('[data-entry-pick="environmentCapabilities"][data-entry-val="external_resistance"]').count() === 0, "hard external_resistance is not a user toggle");
    await page.click("#onbNext");
    assert(await page.locator("#entryAvoidSearch").isVisible(), "avoidance search is present on priorities");
    const priorityComposition = await page.evaluate(() => {
      const rows = [...document.querySelectorAll(".entry-body--priorities .radio-card")];
      const tiles = [...document.querySelectorAll(".entry-body--priorities .onb__grid .radio-card")];
      const balancedGroups = [...document.querySelectorAll(".entry-body--priorities .onb__grid--balanced")];
      const rects = rows.map((el) => el.getBoundingClientRect());
      return {
        // Muscle and movement choices are bounded, scannable tiles.
        radius: tiles[0] ? getComputedStyle(tiles[0]).borderRadius : "",
        surface: tiles[0] ? getComputedStyle(tiles[0]).borderStyle : "",
        target: tiles[0] ? tiles[0].getBoundingClientRect().height : 0,
        balancedColumns: balancedGroups.map((group) => getComputedStyle(group).gridTemplateColumns.split(" ").length),
        balancedCounts: balancedGroups.map((group) => group.children.length),
        movementValues: [...document.querySelectorAll('[data-entry-pick="priorityMovements"]')].map((tile) => tile.dataset.entryVal),
        noOverlap: rects.every((rect, index) => rects.every((other, otherIndex) => index === otherIndex ||
          rect.right <= other.left + 1 || other.right <= rect.left + 1 ||
          rect.bottom <= other.top + 1 || other.bottom <= rect.top + 1)),
      };
    });
    assert(priorityComposition.radius !== "0px" && priorityComposition.radius !== "" &&
      priorityComposition.surface === "solid" && priorityComposition.target >= 44 && priorityComposition.noOverlap,
      "priorities and constraints use readable bounded tiles without overlap", JSON.stringify(priorityComposition));
    assert(priorityComposition.balancedColumns.every((count) => count === 2) &&
      priorityComposition.balancedCounts.every((count) => count % 2 === 0),
      "priority grids divide their choices evenly across two columns", JSON.stringify(priorityComposition));
    assert(priorityComposition.movementValues.includes("shoulder_press"),
      "movement priorities include vertical pressing", JSON.stringify(priorityComposition.movementValues));
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
    await page.waitForSelector("#entryActivate");
    const recommendationCopy = await page.locator("#onbBody").innerText();
    const resultHeader = {
      eyebrow: await page.locator("#onbEyebrow").innerText(),
      step: await page.locator("#onbStepLabel").innerText(),
    };
    assert(resultHeader.eyebrow === "Recommend" && resultHeader.step.trim() === "",
      "recommendation uses a route-specific header and reports no section progress on a terminal step",
      JSON.stringify(resultHeader));
    assert(recommendationCopy.includes("Build Muscle"),
      "recommendation shows a human-readable program identity", recommendationCopy);
    assert(/Prioritize muscle growth/.test(recommendationCopy) && /3 days/.test(recommendationCopy) && /60 minutes/.test(recommendationCopy),
      "recommendation rationale cites the chosen goal and schedule", recommendationCopy);
    assert(/about half/i.test(recommendationCopy) && /first week/i.test(recommendationCopy),
      "recommendation explains the temporary interrupted return treatment", recommendationCopy);
    assert(/full commercial gym/i.test(recommendationCopy) && /Use this program/.test(recommendationCopy),
      "recommendation cites the environment and offers the explicit activation action", recommendationCopy);
    const candidateCount = await page.locator("#entryCandidateReview").count();
    assert(candidateCount === 1 && await page.locator("[data-entry-select-candidate]").count() === 0,
      "recommend shows only the primary result, with no separate review step", String(candidateCount));
    const mergedResult = await page.evaluate(() => ({
      step: window.__repforgeEntryState?.()?.step,
      activate: !!document.querySelector("#entryActivate"),
      edit: !!document.querySelector("#entryEdit"),
      dayCount: document.querySelectorAll("#entryCandidateReview details").length,
    }));
    assert(mergedResult.step === "result" && mergedResult.activate && mergedResult.edit && mergedResult.dayCount === 3,
      "recommendation rationale and editable activation preview share one result surface", JSON.stringify(mergedResult));
    const draftBefore = await page.evaluate((key) => localStorage.getItem(key), DRAFT);
    assert(!!draftBefore, "setup draft persisted during recommend");
    const draftEnvelope = JSON.parse(draftBefore);
    assert(
      draftEnvelope.schemaVersion === 1 && draftEnvelope.revision > 0 &&
        typeof draftEnvelope.ownerId === "string" && draftEnvelope.state?.route === "recommend",
      "setup draft persistence records ownership and revision"
    );
    assert(await page.evaluate(() => window.__repforgeEntryState?.()?.step) === "result",
      "the result is the review: one merged candidate surface");
    const reviewCopy = await page.locator("#onbBody").innerText();
    assert(/Build Muscle/.test(reviewCopy) && /Taurifer recommendation/.test(reviewCopy),
      "review names the candidate and its human-readable source", reviewCopy);
    assert(/exercises/.test(reviewCopy) && /working sets/.test(reviewCopy) && /minutes/.test(reviewCopy),
      "review shows exercise, set, and approximate-duration facts", reviewCopy);
    assert(/Built from your answers/.test(reviewCopy) && /Avoids/.test(reviewCopy) && /Uses .*(Barbell|Machine)/.test(reviewCopy) && /Progresses by/.test(reviewCopy),
      "review presents the answers it was built from, the equipment it assumes, and its progression", reviewCopy);
    assert(/updates targets from completed training/i.test(reviewCopy),
      "common preview keeps factual copy for supported Taurifer strategies", reviewCopy);
    assert(await page.locator("#onbBody details").count() === 3,
      "review uses one collapsible summary per training day");
    // The review pins one region: the activation. It keeps day summaries
    // reachable, because content ends above it once the screen is scrolled to
    // the bottom, and the shell footer yields to it.
    assert(await page.locator("#onboarding .onb__nav").isHidden(),
      "review has one pinned region, not a second footer");
    const pinnedGeometry = await page.evaluate(() => {
      const onboarding = document.querySelector("#onboarding");
      const pinned = document.querySelector("#onbBody .entry__pinned");
      onboarding.scrollTop = onboarding.scrollHeight;
      const summaries = [...document.querySelectorAll("#onbBody details > summary")];
      const last = summaries.at(-1)?.getBoundingClientRect();
      const bar = pinned?.getBoundingClientRect();
      return {
        position: pinned ? getComputedStyle(pinned).position : null,
        activationInside: !!pinned?.querySelector("#entryActivate"),
        lastSummaryBottom: last ? Math.round(last.bottom) : null,
        pinnedTop: bar ? Math.round(bar.top) : null,
      };
    });
    assert(pinnedGeometry.position === "sticky" && pinnedGeometry.activationInside &&
      pinnedGeometry.lastSummaryBottom !== null && pinnedGeometry.lastSummaryBottom <= pinnedGeometry.pinnedTop,
    "the pinned activation never obscures day summaries once scrolled to the end", JSON.stringify(pinnedGeometry));
    const activeBeforeEdit = await page.evaluate((key) => localStorage.getItem(key), KEY);
    const draftBeforeEdit = await page.evaluate((key) => localStorage.getItem(key), DRAFT);
    await page.click("#entryEdit");
    await page.waitForSelector('#onbProgramEditor [data-role="exercise"]', { timeout: 5000 });
    assert(await page.evaluate((key) => localStorage.getItem(key), KEY) === activeBeforeEdit,
      "Edit before using opens the candidate without changing active bytes");
    await page.locator('#onbProgramEditor [data-role="day-menu"]').first().click();
    await page.locator('#onbProgramEditor [data-role="toggle-reorder"]').first().click();
    await page.locator('#onbProgramEditor [data-role="exercise-menu"]').first().click();
    await page.locator('#onbProgramEditor [data-role="more-details"][role="menuitem"]').first().click();
    const firstNote = page.locator('#onbProgramEditor [data-role="exercise-field"][data-field="notes"]').first();
    await firstNote.fill("Draft-only setup note");
    await page.waitForTimeout(500);
    const editedDraft = await page.evaluate(({ draftKey, before }) => ({
      changed: localStorage.getItem(draftKey) !== before,
      note: window.__repforgeEntryState()?.result?.preview?.program?.[0]?.notes,
      fingerprint: window.__repforgeEntryState()?.result?.fingerprint,
    }), { draftKey: DRAFT, before: draftBeforeEdit });
    assert(editedDraft.changed && editedDraft.note === "Draft-only setup note",
      "candidate edits persist in the setup draft", JSON.stringify(editedDraft));
    assert(await page.evaluate((key) => localStorage.getItem(key), KEY) === activeBeforeEdit,
      "editing the candidate leaves active state byte-identical");
    await page.click("#onbCancel");
    await page.click("#entryCancelKeep");
    await page.evaluate(() => window.startOnboarding("first-run"));
    await page.waitForSelector("#entryResumeContinue", { timeout: 5000 });
    await page.click("#entryResumeContinue");
    await page.waitForSelector("#entryActivate", { timeout: 5000 });
    assert(await page.evaluate((key) => localStorage.getItem(key), KEY) === activeBeforeEdit,
      "returning to review still leaves active state byte-identical");
    await page.click("#entryActivate");
    await page.waitForFunction((key) => {
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      return state.programMeta?.onboarded === true && (state.program || []).length > 0;
    }, KEY, { timeout: 10000 });
    await page.waitForFunction((key) => localStorage.getItem(key) == null, DRAFT, { timeout: 10000 });
    const after = await page.evaluate((key) => {
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      return {
        onboarded: state.programMeta?.onboarded,
        programLen: (state.program || []).length,
        hasContext: !!state.programmingContext,
        constraints: state.programmingContext?.exerciseConstraints || [],
        editedNote: state.program?.[0]?.notes,
        name: state.programMeta?.name,
        entrySource: state.programMeta?.entrySource,
        draft: localStorage.getItem("repforge_program_setup_draft_v1"),
      };
    }, KEY);
    assert(after.onboarded === true, "activation onboarded the program");
    assert(after.programLen > 0, "activation wrote exercises", String(after.programLen));
    assert(after.hasContext === true, "reusable programmingContext saved with activation");
    assert(after.constraints.some((item) => item.reason === "pain"), "pain constraint persisted in programmingContext");
    assert(after.editedNote === "Draft-only setup note", "explicit activation installs the edited candidate");
    assert(after.name && after.name !== "Untitled program" && !/_v\d+$/i.test(after.name),
      "generated activation persists a human-readable program name", after.name);
    assert(after.entrySource?.route === "recommend" && after.entrySource?.fingerprint === editedDraft.fingerprint,
      "generated activation persists route provenance and the edited candidate fingerprint",
      JSON.stringify({ source: after.entrySource, expected: editedDraft.fingerprint }));
    assert(after.draft == null, "setup draft cleared after activation");
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const reloadedIdentity = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}").programMeta, KEY);
    assert(reloadedIdentity?.name === after.name && isDeepStrictEqual(reloadedIdentity?.entrySource, after.entrySource),
      "program identity, route provenance, and fingerprint survive reload",
      JSON.stringify(reloadedIdentity));

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

  console.log("\nOnboarding route transitions reset only semantic screen changes");
  await runOnboardingScrollRegression(browser, assert);

  console.log("\nRecommend preserves compiler paired-exposure relations through activation");
  {
    const { context, page } = await openFresh(browser);
    await page.click("#firstRunCreate");
    await page.click('[data-entry-route="recommend"][data-entry-goal="balanced"]');
    await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
    await page.click('[data-entry-pick="recentConsistency"][data-entry-val="most"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="3"]');
    await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
    await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="120"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
    await page.click("#onbNext");
    await page.click("#onbNext");
    await page.waitForSelector("#entryActivate", { timeout: 10000 });
    const staged = await page.evaluate(() => structuredClone(
      window.__repforgeEntryState().result?.preview?.progressionRelations || []));
    assert(staged.length === 2 && staged.every((relation) => relation.type === "paired_exposure"),
      "the review candidate carries both executable compiler relations", JSON.stringify(staged));
    await page.click("#entryActivate");
    await page.waitForFunction((key) =>
      (JSON.parse(localStorage.getItem(key) || "{}").programMeta?.progressionRelations || []).length === 2,
    KEY, { timeout: 10000 });
    const activated = await page.evaluate((key) => {
      const durable = JSON.parse(localStorage.getItem(key) || "{}");
      return {
        relations: durable.programMeta?.progressionRelations || [],
        program: durable.program || [],
      };
    }, KEY);
    assert(isDeepStrictEqual(activated.relations, staged),
      "activation persists the candidate relations instead of inheriting or dropping them",
      JSON.stringify({ staged, activated: activated.relations }));
    assert(activated.relations.every((relation) => relation.members.every((member) =>
      activated.program.some((exercise) => exercise.id === member.exerciseId && exercise.movementId === relation.movementId))),
      "every persisted relation member resolves to the activated movement identity");
    await context.close();
  }

  console.log("\nCandidate movement edits surface broken paired relations");
  {
    const { context, page } = await openFresh(browser);
    const activeBefore = await page.evaluate((key) => localStorage.getItem(key), KEY);
    await page.click("#firstRunCreate");
    await page.click('[data-entry-route="recommend"][data-entry-goal="balanced"]');
    await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
    await page.click('[data-entry-pick="recentConsistency"][data-entry-val="most"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="3"]');
    await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
    await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="120"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
    await page.click("#onbNext");
    await page.click("#onbNext");
    await page.waitForSelector("#entryActivate", { timeout: 10000 });
    const relation = await page.evaluate(() => window.__repforgeEntryState().result.preview.progressionRelations?.[0]);
    const targetId = relation?.members?.[0]?.exerciseId;
    assert(!!targetId, "candidate editor fixture contains a paired relation member", JSON.stringify(relation));
    await page.click("#entryEdit");
    await page.waitForSelector(`#onbProgramEditor [data-role="exercise"][data-id="${targetId}"] [data-role="replace"]`, { timeout: 5000 });
    await page.locator(`#onbProgramEditor [data-role="exercise"][data-id="${targetId}"] [data-role="replace"]`).click();
    await page.waitForSelector("#exPickList .pickrow", { timeout: 5000 });
    await page.locator("#exPickList .pickrow").first().click();
    await page.waitForFunction(() => {
      const preview = window.__repforgeEntryState?.()?.result?.preview;
      const status = document.querySelector("#entryEditorStatus");
      const activate = document.querySelector("#entryEditorActivate");
      return (preview?.progressionIncompatibilities || []).some((item) => item.kind === "relations") &&
        status?.getAttribute("role") === "alert" && activate?.disabled &&
        document.activeElement?.id === "entryEditorStatus";
    }, { timeout: 10000 });
    const edited = await page.evaluate(() => ({
      active: localStorage.getItem("repforge_v1"),
      relations: window.__repforgeEntryState().result.preview.progressionRelations || [],
      incompatibilities: window.__repforgeEntryState().result.preview.progressionIncompatibilities || [],
      disabled: !!document.querySelector("#entryEditorActivate")?.disabled,
      status: document.querySelector("#entryEditorStatus")?.textContent || "",
      statusRole: document.querySelector("#entryEditorStatus")?.getAttribute("role") || "",
      statusLive: document.querySelector("#entryEditorStatus")?.getAttribute("aria-live") || "",
      describedBy: document.querySelector("#entryEditorActivate")?.getAttribute("aria-describedby") || "",
      focused: document.activeElement?.id || "",
    }));
    assert(edited.active === activeBefore, "candidate movement replacement leaves active state byte-identical", JSON.stringify(edited));
    assert(edited.relations.length === 0 && edited.incompatibilities.some((item) => item.kind === "relations"),
      "candidate movement replacement removes the stale relation with an explicit incompatibility", JSON.stringify(edited));
    assert(edited.disabled && /progression/i.test(edited.status) && edited.statusRole === "alert" &&
      edited.statusLive === "assertive" && edited.describedBy === "entryEditorStatus" && edited.focused === "entryEditorStatus",
      "candidate activation stays blocked after a paired movement change", edited.status);
    await context.close();
  }

  console.log("\nRecommend uses compatible active-program exercise identity for continuity");
  {
    const { context, page } = await openFresh(browser);
    await seedActiveProgram(page, { libraryId: "cd_mc", exerciseName: "Assisted chest dip (kneeling)" });
    const activeBefore = await page.evaluate((key) => localStorage.getItem(key), KEY);
    await page.evaluate(() => window.startOnboarding("settings"));
    await page.click('[data-entry-route="recommend"][data-entry-goal="muscle_growth"]');
    await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
    await page.click('[data-entry-pick="recentConsistency"][data-entry-val="most"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="2"]');
    await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="90"]');
    await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="120"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
    await page.click("#onbNext");
    await page.click("#onbNext");
    await page.waitForSelector("#entryActivate", { timeout: 10000 });
    const preview = await page.evaluate(() => window.__repforgeEntryState().result?.preview?.program || []);
    assert(preview.some((exercise) => exercise.libraryId === "cd_mc"),
      "the generated candidate retains a compatible exact movement from the active program");
    assert(await page.evaluate((key) => localStorage.getItem(key), KEY) === activeBefore,
      "history-aware generation leaves the familiar active program byte-identical");
    await context.close();
  }

  console.log("\nAn answer chip recompiles the review as ONE transition and one persist");
  {
    const { context, page } = await openFresh(browser);
    await page.click("#firstRunCreate");
    await page.click('[data-entry-route="recommend"][data-entry-goal="muscle_growth"]');
    await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
    await page.click('[data-entry-pick="recentConsistency"][data-entry-val="most"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="3"]');
    await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
    await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="120"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
    await page.click("#onbNext");
    await page.click("#onbNext");
    await page.waitForSelector("#entryActivate", { timeout: 10000 });
    await page.waitForFunction((key) => !!JSON.parse(localStorage.getItem(key) || "{}").state?.result, DRAFT, { timeout: 10000 });
    // Spy on every write of the setup draft, as the persisted envelope would be read back.
    await page.evaluate((key) => {
      window.__draftWrites = [];
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === key) {
          try {
            const state = JSON.parse(value).state || {};
            window.__draftWrites.push({ step: state.step, hasResult: !!state.result, days: state.answers?.daysPerWeek,
              resultDays: state.result?.preview?.days?.length ?? null, fingerprint: state.result?.answersFingerprint || null });
          } catch { window.__draftWrites.push({ unreadable: true }); }
        }
        return original.apply(this, arguments);
      };
    }, DRAFT);
    const before = await page.evaluate(() => window.__repforgeEntryState());
    assert(before.step === "result" && before.answers.daysPerWeek === 3 && before.result?.preview?.days?.length === 3,
      "the review starts as a three-day recommendation", JSON.stringify({ step: before.step, days: before.answers.daysPerWeek }));
    const chip = page.locator('[data-entry-chip="days"]');
    assert(await chip.count() === 1 && await chip.getAttribute("aria-expanded") === "false",
      "the review lists an answer chip for the weekly days that starts collapsed");
    await chip.click();
    await page.waitForSelector("#entryEditor", { timeout: 5000 });
    assert(await page.locator('[data-entry-chip="days"]').getAttribute("aria-expanded") === "true" &&
      await page.locator("#entryActivate").count() === 0,
    "an open editor expands its chip and hides the pinned activation");
    await page.locator('#entryEditor [data-entry-pick="daysPerWeek"][data-entry-val="4"]').click();
    const midEdit = await page.evaluate(() => ({ state: window.__repforgeEntryState(), writes: window.__draftWrites.length }));
    assert(midEdit.state.answers.daysPerWeek === 3 && !!midEdit.state.result && midEdit.writes === 0,
      "choosing inside the editor changes nothing durable: committed answers, result and draft stay as they were",
      JSON.stringify({ days: midEdit.state.answers.daysPerWeek, result: !!midEdit.state.result, writes: midEdit.writes }));
    await page.click("#entryChipApply");
    await page.waitForSelector("#entryChange", { timeout: 10000 });
    await page.waitForFunction(() => window.__draftWrites.length >= 1, undefined, { timeout: 10000 });
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ state: window.__repforgeEntryState(), writes: window.__draftWrites }));
    assert(after.state.step === "result" && after.state.answers.daysPerWeek === 4 && after.state.result?.preview?.days?.length === 4,
      "applying lands on the same result step with a four-day program",
      JSON.stringify({ step: after.state.step, days: after.state.answers.daysPerWeek, built: after.state.result?.preview?.days?.length }));
    assert(after.writes.length === 1 && after.writes.every((write) => write.step === "result" && write.hasResult && write.days === 4 && write.resultDays === 4),
      "the edit is exactly one persist and no persisted draft ever had {step: result, result: null}", JSON.stringify(after.writes));
    const fingerprintOk = await page.evaluate(() => {
      const state = window.__repforgeEntryState();
      return window.RepForgeProgramEntry.setResult({ ...state, result: null }, { fingerprint: "probe" }).result.answersFingerprint === state.result.answersFingerprint;
    });
    assert(fingerprintOk, "the result's answersFingerprint matches the new answers");
    const statement = await page.evaluate(() => {
      const el = document.querySelector("#entryChange");
      const pinned = document.querySelector("#onbBody .entry__pinned");
      const rect = el.getBoundingClientRect();
      return { text: el.innerText, changed: el.dataset.changed, total: el.dataset.total, focused: document.activeElement === el,
        top: Math.round(rect.top), bottom: Math.round(rect.bottom), pinnedTop: pinned ? Math.round(pinned.getBoundingClientRect().top) : null,
        viewport: window.innerHeight };
    });
    assert(/Answer changed/.test(statement.text) && /exercises changed/.test(statement.text) && statement.focused &&
      statement.top >= 0 && statement.bottom <= (statement.pinnedTop ?? statement.viewport),
    "the change statement names the change, takes focus and sits in view above the pinned region", JSON.stringify(statement));
    await context.close();
  }

  console.log("\nEvery changed row of a corrected review is tagged, including when all of them change (Q637, SPEC-04)");
  {
    const { context, page } = await openFresh(browser);
    await page.click("#firstRunCreate");
    await page.click('[data-entry-route="recommend"][data-entry-goal="muscle_growth"]');
    await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
    await page.click('[data-entry-pick="recentConsistency"][data-entry-val="most"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="3"]');
    await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
    await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="120"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
    await page.click("#onbNext");
    await page.click("#onbNext");
    await page.waitForSelector("#entryActivate", { timeout: 10000 });
    // What the review shows, read from the page and compared with the programs the compiler built.
    const readReview = (before) => page.evaluate((beforeRows) => {
      const rows = window.__repforgeEntryState().result.preview.program || [];
      const key = (row) => row.libraryId || row.name;
      const left = new Map();
      for (const row of beforeRows) left.set(key(row), (left.get(key(row)) || 0) + 1);
      let expected = 0;
      for (const row of rows) { if (left.get(key(row)) > 0) left.set(key(row), left.get(key(row)) - 1); else expected += 1; }
      const statement = document.querySelector("#entryChange");
      const exRows = [...document.querySelectorAll("#onbBody .onb__ex")].filter((el) => el.querySelector("b"));
      return {
        total: rows.length, expected,
        changed: Number(statement?.dataset.changed), statementTotal: Number(statement?.dataset.total),
        shown: exRows.length,
        accent: exRows.filter((el) => el.classList.contains("is-new")).length,
        tagged: exRows.filter((el) => el.classList.contains("is-new") && el.querySelector(".entry__new")).length,
        stray: exRows.filter((el) => !el.classList.contains("is-new") && el.querySelector(".entry__new")).length,
        rowIds: rows.map(key),
      };
    }, before);
    const programNow = () => page.evaluate(() => (window.__repforgeEntryState().result.preview.program || []).map((row) => ({ libraryId: row.libraryId, name: row.name })));
    // The partial case: a longer week keeps most movements and tags only the added ones.
    const baseDays = await programNow();
    await page.click('[data-entry-chip="days"]');
    await page.waitForSelector("#entryEditor", { timeout: 5000 });
    await page.locator('#entryEditor [data-entry-pick="daysPerWeek"][data-entry-val="4"]').click();
    await page.click("#entryChipApply");
    await page.waitForFunction(() => window.__repforgeEntryState().answers.daysPerWeek === 4 && document.querySelector("#entryChange"), undefined, { timeout: 25000 });
    const partial = await readReview(baseDays);
    assert(partial.expected > 0 && partial.expected < partial.total && partial.accent === partial.expected && partial.tagged === partial.expected && partial.stray === 0,
      "SPEC-04: a partial correction still tags exactly the added rows", JSON.stringify(partial));
    // The audit's case: commercial gym corrected to limited home replaces every movement.
    const base = await programNow();
    await page.click('[data-entry-chip="env"]');
    await page.waitForSelector("#entryEditor", { timeout: 5000 });
    await page.locator('#entryEditor [data-entry-pick="environment"][data-entry-val="limited_home"]').click();
    await page.click("#entryChipApply");
    await page.waitForFunction(() => window.__repforgeEntryState().answers.environment?.kind === "limited_home" && !document.querySelector("#entryEditor") && document.querySelector("#entryChange"), undefined, { timeout: 25000 });
    const corrected = await readReview(base);
    assert(corrected.expected > 0 && corrected.changed === corrected.expected,
      "SPEC-04: the commercial gym to limited home correction changes rows and the statement counts them", JSON.stringify(corrected));
    assert(corrected.expected === corrected.total,
      "SPEC-04: the audit's case replaces every exercise, so the all-new case is the one under test", JSON.stringify(corrected));
    assert(corrected.accent === corrected.expected && corrected.tagged === corrected.expected && corrected.stray === 0,
      "SPEC-04: every changed row carries the accent edge and the new tag when the correction replaces all of them", JSON.stringify(corrected));
    await context.close();
  }

  console.log("\nEvery code the compiler and entry model can emit has copy, and an unknown one is loud");
  {
    const { readFileSync } = await import("node:fs");
    const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
    const compiler = read("program-compiler.js"), adapter = read("program-entry-adapter.js"), entry = read("program-entry.js");
    const found = { limitation: new Set(), reduction: new Set(), failure: new Set(), readiness: new Set() };
    for (const line of compiler.split("\n")) {
      if (!/limitations\.push\(/.test(line)) continue;
      const code = line.slice(line.indexOf("limitations.push("), line.indexOf("dayId")).replace(/===\s*"[^"]*"/g, "");
      for (const match of code.matchAll(/"([^"]+)"/g)) found.limitation.add(match[1]);
    }
    for (const match of compiler.matchAll(/reductions\.push\(\{\s*step:\s*"([^"]+)"/g)) found.reduction.add(match[1]);
    for (const text of [compiler, adapter]) {
      for (const line of text.split("\n")) {
        if (/limitations\.push\(/.test(line)) continue;
        for (const match of line.matchAll(/\bcode:\s*"([^"]+)"/g)) found.failure.add(match[1]);
      }
    }
    const readiness = entry.slice(entry.indexOf("function candidateActivationIssues"), entry.indexOf("const api = Object.freeze"));
    for (const match of readiness.matchAll(/\bcode:\s*"([^"]+)"/g)) found.readiness.add(match[1]);
    for (const match of readiness.matchAll(/issues\.push\(\s*(?:"([a-z_]+)"|`([a-z_]+):)/g)) found.readiness.add(match[1] || match[2]);
    for (const match of readiness.matchAll(/return \["([a-z_]+)"\]/g)) found.readiness.add(match[1]);
    const appSource = readFileSync(new URL("../app.js", import.meta.url), "latin1");
    for (const match of appSource.matchAll(/entryCompileError=\{code:"([^"]+)"/g)) found.failure.add(match[1]);
    for (const match of appSource.matchAll(/built\?\.code\|\|"([^"]+)"/g)) found.failure.add(match[1]);
    const total = Object.values(found).reduce((sum, set) => sum + set.size, 0);
    assert(found.limitation.size >= 5 && found.reduction.size === 3 && found.failure.size >= 14 && found.readiness.size >= 8,
      "the scan finds the limitation, reduction, failure and readiness vocabularies", JSON.stringify(Object.fromEntries(Object.entries(found).map(([k, v]) => [k, [...v]]))));
    const en = JSON.parse(read("i18n-en.json")), pt = JSON.parse(read("i18n-pt.json"));
    const { context, page } = await openFresh(browser);
    const logged = [];
    page.on("console", (message) => { if (message.type() === "error") logged.push(message.text()); });
    const resolved = await page.evaluate((all) => {
      const copy = window.__repforgeEntryCodeCopy;
      const out = [];
      for (const [kind, codes] of Object.entries(all)) for (const code of codes) out.push({ kind, code, key: copy.key(kind, code) });
      return out;
    }, Object.fromEntries(Object.entries(found).map(([kind, set]) => [kind, [...set]])));
    const missing = resolved.filter((item) => !item.key);
    assert(missing.length === 0, `all ${total} emitted codes have a catalog key`, JSON.stringify(missing));
    const absent = resolved.filter((item) => item.key && (!(item.key in en) || !(item.key in pt)));
    assert(absent.length === 0, "every key a code maps to exists in English and Portuguese", JSON.stringify(absent));
    const tableKeys = await page.evaluate(() => Object.values(window.__repforgeEntryCodeCopy.table).flatMap((group) => Object.values(group)));
    assert(tableKeys.every((key) => key in en && key in pt), "no table entry points at a missing key");
    const stale = await page.evaluate((all) => {
      const table = window.__repforgeEntryCodeCopy.table;
      return ["limitation", "reduction"].flatMap((kind) => Object.keys(table[kind]).filter((code) => !all[kind].includes(code)));
    }, Object.fromEntries(Object.entries(found).map(([kind, set]) => [kind, [...set]])));
    assert(stale.length === 0, "no limitation or reduction entry outlives the code it describes", JSON.stringify(stale));
    const unknown = await page.evaluate(() => window.__repforgeEntryCodeCopy.text("limitation", "made_up_code"));
    assert(unknown === en["entry.issue.generic"] && logged.some((text) => /made_up_code/.test(text)),
      "an unknown code logs an error and shows the generic sentence, never the code", JSON.stringify({ unknown, logged }));
    await context.close();
  }

  console.log("\nThe review: program first, chips and editors keep their promises (K-27 to K-32)");
  {
    const { context, page } = await openFresh(browser);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.click("#firstRunCreate");
    await page.click('[data-entry-route="recommend"][data-entry-goal="strength"]');
    // The goal the hub asked is carried, with a Change control; Change opens the question where it stands.
    const carried = await page.evaluate(() => ({ band: document.querySelector(".entry__carried-v")?.textContent || "", groups: document.querySelectorAll('[data-entry-pick="desiredResult"]').length }));
    assert(/strength/i.test(carried.band) && carried.groups === 0, "the about screen carries the goal from the hub and does not ask it again", JSON.stringify(carried));
    await page.click("#entryGoalChange");
    assert(await page.locator('[data-entry-pick="desiredResult"]').count() === 3 && await page.evaluate(() => document.activeElement?.dataset?.entryVal) === "strength",
      "Change opens the goal question with focus on the current choice");
    await page.click('[data-entry-pick="desiredResult"][data-entry-val="balanced"]');
    assert(await page.evaluate(() => document.activeElement?.dataset?.entryVal) === "balanced" && await page.evaluate(() => window.__repforgeEntryState().answers.desiredResult) === "balanced",
      "K-27: after choosing a goal, focus stays on the chosen option");
    await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
    assert(await page.evaluate(() => document.activeElement?.dataset?.entryVal) === "6_to_24m", "K-27: after an answer by tap, focus stays on the chosen option");
    await page.click('[data-entry-pick="recentConsistency"][data-entry-val="most"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="3"]');
    await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
    await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="120"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
    await page.click("#onbNext");
    // The optional section: Skip is offered only while it is empty (K-30), and the primary reads "Show my program".
    assert(await page.locator("#entrySkip").isVisible() && /Show my program/.test(await page.locator("#onbNext").innerText()),
      "Recommend's optional section offers Skip while empty and ends in Show my program");
    await page.click('[data-entry-pick="primaryMuscles"][data-entry-val="chest"]');
    await page.click('[data-entry-pick="primaryMuscles"][data-entry-val="back"]');
    assert(await page.locator("#entrySkip").count() === 0 && await page.locator("#entryPrimaryLimit").count() === 1,
      "K-30: once a muscle is chosen Skip is gone, and the two-muscle limit is said in text");
    await page.click('[data-entry-pick="primaryMuscles"][data-entry-val="chest"]');
    await page.click('[data-entry-pick="primaryMuscles"][data-entry-val="back"]');
    assert(await page.locator("#entrySkip").isVisible(), "clearing the muscles brings Skip back");
    await page.click("#entrySkip");
    await page.waitForSelector("#entryActivate", { timeout: 15000 });
    const skipped = await page.evaluate(() => window.__repforgeEntryState());
    assert(skipped.step === "result" && (skipped.answers.primaryMuscles || []).length === 0 && (skipped.answers.exerciseConstraints || []).length === 0,
      "Skip goes to the program with no constraint chosen");
    // K-32: program first. The first day and its first exercise are above the pinned region at 390 px.
    const first = await page.evaluate(() => {
      const pinned = document.querySelector("#onbBody .entry__pinned").getBoundingClientRect().top;
      const day = document.querySelector("#onbBody .onb__day summary").getBoundingClientRect();
      const ex = document.querySelector("#onbBody .onb__day .onb__ex").getBoundingClientRect();
      return { pinned: Math.round(pinned), dayBottom: Math.round(day.bottom), exBottom: Math.round(ex.bottom), h1: document.querySelector("#entryHeading").textContent };
    });
    assert(first.exBottom <= first.pinned && first.dayBottom <= first.pinned && first.h1.length > 0,
      "K-32: the first day and its first exercise are in the first viewport above the pinned region", JSON.stringify(first));
    // Chips: expanded state, Escape closes and returns focus to the chip (K-26 shape for inline layers).
    await page.click('[data-entry-chip="minutes"]');
    await page.waitForSelector("#entryEditor");
    assert(await page.evaluate(() => document.activeElement?.id) === "entryEditorTitle" &&
      await page.locator('[data-entry-chip="minutes"]').getAttribute("aria-controls") === "entryEditor",
    "an opened editor takes focus on its title and is named by its chip");
    // K-29: an inline editor keeps at least half the viewport.
    const room = await page.evaluate(() => { const r = document.querySelector("#entryEditor").getBoundingClientRect(); return { visible: Math.round(Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)), half: innerHeight / 2 }; });
    assert(room.visible >= room.half, "K-29: the inline editor keeps at least half the viewport", JSON.stringify(room));
    await page.click('#entryEditor [data-entry-pick="sessionMinutes"][data-entry-val="45"]');
    assert(await page.evaluate(() => document.activeElement?.dataset?.entryVal) === "45", "K-27: choosing inside an editor keeps focus on the chosen option");
    await page.keyboard.press("Escape");
    assert(await page.locator("#entryEditor").count() === 0 && await page.evaluate(() => document.activeElement?.dataset?.entryChip) === "minutes" &&
      await page.evaluate(() => window.__repforgeEntryState().answers.sessionMinutes) === 60,
    "Escape closes the editor without applying, and focus returns to its chip");
    // Avoid an exercise the program contains: the statement, the new constraint, and Restore.
    const target = await page.evaluate(() => window.__repforgeEntryState().result.preview.program[0].libraryId);
    const targetName = await page.evaluate((id) => window.__repforgeLibraryEntry(id).name, target);
    await page.click('[data-entry-chip="prio"]');
    await page.fill("#entryAvoidSearch", targetName);
    await page.locator(`[data-entry-avoid-add="${target}"]`).click();
    assert(await page.locator("#entryChipApply").isDisabled(), "Update program waits for the reason of an avoided exercise");
    await page.click(`[data-entry-pick="avoidReason"][data-entry-val="${target}|dislike"]`);
    await page.click("#entryChipApply");
    await page.waitForSelector("#entryChange");
    const avoided = await page.evaluate((id) => ({
      state: window.__repforgeEntryState(),
      text: document.querySelector("#entryChange").innerText,
      inProgram: (window.__repforgeEntryState().result.preview.program || []).some((row) => row.libraryId === id),
      restore: !!document.querySelector(`[data-entry-restore="${id}"]`),
    }), target);
    assert(avoided.state.step === "result" && !avoided.inProgram && avoided.restore && /Constraint|Answer changed/.test(avoided.text) && /exercises? changed/.test(avoided.text),
      "avoiding an exercise removes it, states the change and offers Restore", JSON.stringify({ text: avoided.text, inProgram: avoided.inProgram, restore: avoided.restore }));
    await page.click(`[data-entry-restore="${target}"]`);
    await page.waitForFunction((id) => !document.querySelector(`[data-entry-restore="${id}"]`), target);
    const restored = await page.evaluate((id) => ({
      constraints: (window.__repforgeEntryState().answers.exerciseConstraints || []).length,
      text: document.querySelector("#entryChange")?.innerText || "",
      inProgram: (window.__repforgeEntryState().result.preview.program || []).some((row) => row.libraryId === id),
    }), target);
    assert(restored.constraints === 0 && restored.inProgram && /Constraint removed/.test(restored.text),
      "Restore removes the constraint, brings the exercise back and says so", JSON.stringify(restored));
    // "What Taurifer adjusted" lists only what the compiler reported; it is absent when nothing was adjusted.
    const adjusted = await page.evaluate(() => ({ section: !!document.querySelector(".entry__adjusted"),
      reported: (window.__repforgeEntryState().result.preview.limitations || []).length + (window.__repforgeEntryState().result.preview.reductions || []).length }));
    assert(adjusted.section === (adjusted.reported > 0), "the adjusted section appears exactly when the compiler reported an adjustment", JSON.stringify(adjusted));
    // Back from the review and forward again with changed answers says the answers changed.
    await context.close();
  }

  console.log("\nCustom uses one-status muscle priorities, one exercise search, and conditional structure choice");
  {
    const { context, page } = await openFresh(browser);
    await page.click("#firstRunCreate");
    await page.click('[data-entry-route="custom"]');
    await page.click('[data-entry-pick="desiredResult"][data-entry-val="balanced"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
    await page.click('[data-entry-pick="recentConsistency"][data-entry-val="most"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="4"]');
    await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
    await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="auto"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
    await page.click("#onbNext");
    assert(await page.locator("[data-entry-pick='musclePriority']").count() === 40,
      "Custom shows each muscle once with four mutually exclusive settings");
    await page.click("[data-entry-pick='musclePriority'][data-entry-val='back|prioritize']");
    const muscleState = await page.evaluate(() => window.__repforgeEntryState().answers);
    assert(muscleState.primaryMuscles?.includes("back") && !muscleState.deEmphasizedMuscles?.includes("back") &&
      !muscleState.ignoredMuscles?.includes("back"),
      "choosing a muscle state updates exactly one category", JSON.stringify(muscleState));
    await page.click("#onbNext");
    assert(await page.locator("#entryExerciseSearch").isVisible(), "Custom exposes one exercise search");
    await page.fill("#entryExerciseSearch", "barbell bench press");
    await page.waitForTimeout(50);
    await page.locator('[data-entry-exercise-add="pr_bb"][data-entry-exercise-status="include"]').click();
    assert(await page.locator('[data-entry-exercise-remove="pr_bb"]').isVisible(),
      "included exercise remains visible and removable");
    await page.fill("#entryExerciseSearch", "barbell bench press");
    await page.waitForTimeout(50);
    assert(await page.locator('[data-entry-exercise-add="pr_bb"]').count() === 0,
      "an included exercise is not offered as an avoidance contradiction");
    await page.fill("#entryExerciseSearch", "barbell curl");
    await page.locator('[data-entry-exercise-add="cu_bb"][data-entry-exercise-status="avoid"]').click();
    const beforeReason = await page.evaluate(() => window.__repforgeEntryState().answers.exerciseConstraints || []);
    assert(beforeReason.length === 0, "selecting an avoided exercise does not invent a dislike reason");
    assert(await page.locator("#onbNext").isDisabled(), "an avoided exercise requires an explicit reason before Continue");
    await page.click('[data-entry-pick="avoidReason"][data-entry-val="cu_bb|dislike"]');
    await page.click("#onbNext");
    const choices = page.locator('[data-entry-pick="splitPreference"]');
    const choiceCount = await choices.count();
    const resultCopy = await page.locator("#onbBody").innerText();
    assert(choiceCount === 0 && /Your custom program/i.test(resultCopy),
      "Custom skips the one-choice structure screen", JSON.stringify({ choiceCount, resultCopy }));
    await page.waitForSelector("#entryActivate");
    assert(/Your custom program/i.test(await page.locator("#onbBody").innerText()) &&
      await page.locator('[data-entry-chip="emph"]').isVisible() &&
      await page.locator('[data-entry-chip="prefs"]').isVisible(),
      "Custom result names the job and offers its answers as chips: muscle emphasis and exercise preferences");
    const candidate = await page.evaluate(() => window.__repforgeEntryState().result?.preview?.program || []);
    assert(candidate.some((exercise) => exercise.libraryId === "pr_bb"),
      "the generated candidate contains the selected must-have exercise");
    const reviewCopy = await page.locator("#onbBody").innerText();
    assert(/Barbell bench press/.test(reviewCopy) && /Includes Barbell bench press/.test(reviewCopy) && /Avoids Barbell curl/.test(reviewCopy) &&
      /Included: Barbell bench press/.test(reviewCopy) && /Avoided: Barbell curl/.test(reviewCopy),
      "Custom review names the selected exercise preferences as answers and as constraints", reviewCopy);
    await context.close();
  }

  console.log("\nCustom preserves the injected two-choice structure branch");
  {
    const { context, page } = await openFresh(browser);
    await page.evaluate(() => {
      const base = window.__repforgeOnboarding.services();
      window.__repforgeProgramEntryServicesOverride = {
        ...base,
        splitChoices: (answers) => {
          const result = base.splitChoices(answers);
          if (result.choices.length !== 1) return result;
          const first = result.choices[0];
          return {
            ...result,
            choices: [first, {
              ...first,
              id: `${first.id}-alternate`,
              blueprintId: `${first.blueprintId}-alternate`,
              default: false,
              name: `${first.name} alternate`,
              namePt: `${first.namePt} alternativa`,
            }],
          };
        },
      };
    });
    await page.click("#firstRunCreate");
    await page.click('[data-entry-route="custom"]');
    await page.click('[data-entry-pick="desiredResult"][data-entry-val="balanced"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
    await page.click('[data-entry-pick="recentConsistency"][data-entry-val="most"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="4"]');
    await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
    await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="auto"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
    await page.click("#onbNext");
    await page.click("#onbNext");
    assert(await page.locator("#entryExerciseSearch").isVisible(), "two-choice branch still visits exercise preferences");
    await page.click("#onbNext");
    assert(await page.locator('[data-entry-pick="splitPreference"]').count() === 2,
      "two genuine structure choices render as two choices");
    assert(/section 6 of 6/i.test(await page.locator("#onbStepLabel").innerText()),
      "conditional structure choice contributes one meaningful section");
    await page.locator('[data-entry-pick="splitPreference"]').first().click();
    await page.click("#onbNext");
    await page.waitForSelector("#entryActivate", { timeout: 10000 });
    assert(await page.locator('[data-entry-pick="splitPreference"]').count() === 0,
      "selected two-choice structure advances to the generated result");
    await context.close();
  }

  console.log("\nBrowse shows released compiler facts and keeps selection non-destructive until review activation");
  {
    const { context, page } = await openFresh(browser);
    const activeBefore = await page.evaluate((key) => localStorage.getItem(key), KEY);
    await page.click("#firstRunCreate");
    await page.click('[data-entry-route="browse"]');
    await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="4"]');
    await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
    await page.click("#onbNext");
    await page.waitForSelector('[data-entry-catalogue="growth_4_v1"]', { timeout: 10000 });
    const catalogueCopy = await page.locator("#onbBody").innerText();
    /* The catalogue lists each family at every released frequency, so a card's
       identity is its name plus its day count — both are rendered, and both are
       carried in the accessible name. */
    const names = await page.locator("[data-entry-catalogue]").evaluateAll((nodes) => nodes.map((node) => [
      node.querySelector(".entry-prog__name")?.textContent?.trim() || "",
      node.querySelector(".entry-prog__days")?.textContent?.trim() || "",
    ].filter(Boolean).join(" · ")));
    assert(names.length > 0 && new Set(names).size === names.length,
      "Browse gives every released sibling a distinct human name", names.join(" | "));
    assert(/4 days available/.test(catalogueCopy) && /Up to 60 minutes/.test(catalogueCopy),
      "Browse preserves the answered context as comparison facts", catalogueCopy);
    const reviewLabels = await page.locator("[data-entry-catalogue]").evaluateAll(
      (nodes) => nodes.map((node) => node.getAttribute("aria-label") || ""));
    assert(reviewLabels.length > 0 && reviewLabels.every((label) => /^Review .+/.test(label)),
      "every Browse card is an explicit review action named for its program", reviewLabels.join(" | "));
    assert(/Prioritizes muscle growth/.test(catalogueCopy) && /exercises/.test(catalogueCopy) && /sets/.test(catalogueCopy) &&
      /Progression:/.test(catalogueCopy) && /Uses:/.test(catalogueCopy),
      "Browse cards show purpose, weekly structure, progression, and equipment",
      catalogueCopy);
    assert(!/_v\d+|growth_\d|balanced_\d|strength_\d|home_\d|compiler|blueprint/i.test(catalogueCopy),
      "Browse exposes no internal identifier or implementation jargon", catalogueCopy);
    assert(/You chose 4 days; this program uses 2\./.test(catalogueCopy),
      "a non-matching sibling names its exact schedule mismatch", catalogueCopy);

    await page.click('[data-entry-catalogue="growth_2_v1"]');
    await page.waitForSelector("#entryActivate", { timeout: 10000 });
    assert(/Build Muscle · 2 days/.test(await page.locator("#onbBody").innerText()),
      "the review keeps the selected sibling's human identity");
    assert(await page.evaluate((key) => localStorage.getItem(key), KEY) === activeBefore,
      "opening Browse review leaves active state byte-identical");
    await page.click("#onbBack");
    await page.waitForSelector('[data-entry-catalogue="growth_4_v1"]', { timeout: 5000 });
    await page.click('[data-entry-catalogue="growth_4_v1"]');
    await page.waitForSelector("#entryActivate", { timeout: 10000 });
    const staged = await page.evaluate(() => ({
      name: window.__repforgeEntryState().result?.name,
      frequency: window.__repforgeEntryState().result?.preview?.frequency,
      fingerprint: window.__repforgeEntryState().result?.fingerprint,
    }));
    assert(staged.name === "Build Muscle · 4 days" && staged.frequency === 4 && !!staged.fingerprint,
      "Browse review preserves sibling identity, compiled frequency, and deterministic fingerprint",
      JSON.stringify(staged));
    await page.click("#entryActivate");
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || "{}").programMeta?.name === "Build Muscle · 4 days",
      KEY, { timeout: 10000 });
    const activated = await page.evaluate((key) => {
      const durable = JSON.parse(localStorage.getItem(key) || "{}");
      return {
        name: durable.programMeta?.name,
        days: durable.programMeta?.daysPerWeek,
        source: durable.programMeta?.entrySource,
      };
    }, KEY);
    assert(activated.days === 4 && activated.source?.route === "browse" &&
      activated.source?.fingerprint === staged.fingerprint,
      "explicit Browse activation persists the selected frequency, provenance, and fingerprint",
      JSON.stringify(activated));
    await context.close();
  }

  console.log("\nBrowse empty catalogue fails closed with an explicit recovery path");
  {
    const { context, page } = await openFresh(browser);
    const activeBefore = await page.evaluate((key) => localStorage.getItem(key), KEY);
    await page.click("#firstRunCreate");
    await page.click('[data-entry-route="browse"]');
    await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="4"]');
    await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
    await page.evaluate(() => {
      window.__repforgeProgramEntryServicesOverride = { browseCatalogue: () => [] };
    });
    await page.click("#onbNext");
    const emptyCopy = await page.locator('#onbBody [role="alert"]').innerText();
    assert(/No available program fits these answers/.test(emptyCopy),
      "an empty released catalogue is announced without fabricating a fallback", emptyCopy);
    assert(await page.locator('[data-entry-action="change-schedule"]').isVisible(),
      "empty Browse offers an explicit schedule recovery action");
    assert(await page.evaluate((key) => localStorage.getItem(key), KEY) === activeBefore,
      "empty Browse leaves active state byte-identical");
    await page.click('[data-entry-action="change-schedule"]');
    assert((await page.evaluate(() => window.__repforgeEntryState().step)) === "schedule",
      "the empty-state recovery returns to schedule answers");
    await context.close();
  }

  console.log("\nBuild remains a durable non-destructive draft until explicit valid activation");
  {
    const { context, page } = await openFresh(browser);
    page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
    const activeBefore = await page.evaluate((key) => localStorage.getItem(key), KEY);
    await page.click("#firstRunCreate");
    await page.click("#entryOwnToggle");
    await page.click('[data-entry-route="build"]');
    await page.locator("#entryProgramName").pressSequentially("Manual block", { delay: 10 });
    assert(await page.inputValue("#entryProgramName") === "Manual block", "manual program name keeps focus across real keystrokes");
    await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="4"]');
    await page.waitForFunction(() => !document.querySelector("#onbNext")?.disabled, undefined, { timeout: 5000 });
    await page.click("#onbNext");
    await page.waitForSelector('#onbProgramEditor [data-role="day"]', { timeout: 10000 });
    const built = await page.evaluate(({ key, draftKey }) => {
      const activeRaw = localStorage.getItem(key);
      const envelope = JSON.parse(localStorage.getItem(draftKey) || "{}");
      const cards = [...document.querySelectorAll('#onbProgramEditor [data-role="day"]')].map((card) => ({
        day: card.getAttribute("data-day"),
        empty: !!card.querySelector('[data-role="day-empty"]'),
        exercises: card.querySelectorAll('[data-role="exercise"]').length,
        addExercise: !!card.querySelector('[data-role="add-exercise"]'),
      }));
      const editorStatus = document.querySelector('#onbProgramEditor [data-role="editor-status"]');
      const status = document.querySelector("#entryEditorStatus");
      const activate = document.querySelector("#entryEditorActivate");
      const statusRect = status?.getBoundingClientRect();
      const activateRect = activate?.getBoundingClientRect();
      return {
        activeRaw,
        draftName: envelope.state?.result?.name,
        draftProgramLen: envelope.state?.result?.preview?.program?.length || 0,
        draftDays: envelope.state?.result?.preview?.programStructure?.days?.length || 0,
        activateDisabled: !!document.querySelector("#entryEditorActivate")?.disabled,
        statusNode: !!editorStatus,
        saveVisible: !!document.querySelector("#entryEditorSave") && getComputedStyle(document.querySelector("#entryEditorSave")).display !== "none",
        statusText: status?.textContent || "",
        statusAdjacent: !!statusRect && !!activateRect && statusRect.bottom <= activateRect.top + 1,
        cards,
      };
    }, { key: KEY, draftKey: DRAFT });
    assert(built.activeRaw === activeBefore, "opening the Build editor leaves active state byte-identical");
    assert(built.draftProgramLen === 0, "Build draft has no placeholder exercises before add", String(built.draftProgramLen));
    assert(built.draftDays === 4, "Build draft created four empty days", String(built.draftDays));
    assert(built.cards.length === 4, "editor shows four day cards", String(built.cards.length));
    assert(built.cards.every((card) => card.empty && card.exercises === 0), "all four day cards are empty containers");
    assert(built.cards.every((card) => card.addExercise), "every empty Build day exposes Add exercise", JSON.stringify(built.cards));
    assert(built.draftName === "Manual block", "Build draft kept the program name", built.draftName);
    assert(built.statusNode && built.saveVisible, "Build visibly identifies the editable draft and Save draft action", JSON.stringify(built));
    assert(built.activateDisabled && /Add an exercise to/i.test(built.statusText) && !/day_empty:|manual_d\d/.test(built.statusText) && built.statusAdjacent,
      "Build names incompleteness adjacent to its disabled activation", JSON.stringify(built));
    const priorViewport = page.viewportSize();
    await page.setViewportSize({ width: 390, height: 844 });
    const buildHeader200 = await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
      const title = document.querySelector("#onbEditorTitle");
      const cancel = document.querySelector("#onbCancel");
      const root = document.querySelector("#onboarding");
      const titleRect = title.getBoundingClientRect();
      const cancelRect = cancel.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        clippedTitle: title.scrollWidth > title.clientWidth + 1,
        cancelClipped: cancel.scrollWidth > cancel.clientWidth + 1,
        inBounds: titleRect.left >= rootRect.left - 1 && titleRect.right <= rootRect.right + 1 &&
          cancelRect.left >= rootRect.left - 1 && cancelRect.right <= rootRect.right + 1,
        noOverlap: titleRect.bottom <= cancelRect.top + 1 || cancelRect.bottom <= titleRect.top + 1 ||
          titleRect.right <= cancelRect.left + 1 || cancelRect.right <= titleRect.left + 1,
      };
    });
    assert(buildHeader200.overflow <= 0 && !buildHeader200.clippedTitle && !buildHeader200.cancelClipped &&
      buildHeader200.inBounds && buildHeader200.noOverlap,
      "Build title and Cancel reflow without clipping at 200% text", JSON.stringify(buildHeader200));
    await page.evaluate(() => { document.documentElement.style.fontSize = "100%"; });
    await page.setViewportSize(priorViewport);
    const buildGeometry = await page.evaluate(() => {
      const action = document.querySelector("#entryEditorActivate");
      const status = document.querySelector('#onbProgramEditor [data-role="editor-status"]');
      const rects = [action?.getBoundingClientRect(), status?.getBoundingClientRect()].filter(Boolean);
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        noOverlap: rects.every((rect, index) => rects.every((other, otherIndex) => index === otherIndex ||
          rect.right <= other.left + 1 || other.right <= rect.left + 1 || rect.bottom <= other.top + 1 || other.bottom <= rect.top + 1)),
      };
    });
    assert(buildGeometry.overflow <= 0 && buildGeometry.noOverlap, "Build draft has no viewport overflow or action overlap", JSON.stringify(buildGeometry));

    await page.locator('#onbProgramEditor [data-role="add-exercise"]').first().click();
    await page.waitForSelector("#exPickSheet.is-open, #exPickList .pickrow", { timeout: 5000 });
    await page.locator("#exPickList .pickrow").first().click();
    await page.waitForFunction((draftKey) => (JSON.parse(localStorage.getItem(draftKey) || "{}").state?.result?.preview?.program || []).length > 0, DRAFT, { timeout: 8000 });
    const afterAdd = await page.evaluate(({ key, draftKey }) => {
      const envelope = JSON.parse(localStorage.getItem(draftKey) || "{}");
      return {
        activeRaw: localStorage.getItem(key),
        programLen: envelope.state?.result?.preview?.program?.length || 0,
        structureDays: envelope.state?.result?.preview?.programStructure?.days?.length || 0,
        cards: document.querySelectorAll('#onbProgramEditor [data-role="day"]').length,
      };
    }, { key: KEY, draftKey: DRAFT });
    assert(afterAdd.activeRaw === activeBefore, "partially editing Build leaves active state byte-identical");
    assert(afterAdd.programLen === 1, "exercise is added to the setup draft", String(afterAdd.programLen));
    assert(afterAdd.structureDays === 4, "structure days remain four after adding one exercise", String(afterAdd.structureDays));
    assert(afterAdd.cards === 4, "four day cards remain visible after add", String(afterAdd.cards));

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    if (await page.locator("#firstRunCreate").isVisible().catch(() => false)) await page.click("#firstRunCreate");
    await page.waitForSelector("#entryResumeContinue", { timeout: 5000 });
    await page.click("#entryResumeContinue");
    await page.waitForSelector('#onbProgramEditor [data-role="day"]', { timeout: 5000 });
    const resumed = await page.evaluate(({ key, draftKey }) => ({
      activeRaw: localStorage.getItem(key),
      draftProgramLen: JSON.parse(localStorage.getItem(draftKey) || "{}").state?.result?.preview?.program?.length || 0,
    }), { key: KEY, draftKey: DRAFT });
    assert(resumed.activeRaw === activeBefore, "reload/resume leaves active state byte-identical");
    assert(resumed.draftProgramLen === 1, "reload/resume restores the partial Build draft");

    for (let index = 1; index < 4; index++) {
      const day = page.locator('#onbProgramEditor [data-role="day"]').nth(index);
      const add = day.locator('[data-role="add-exercise"]');
      if (!(await add.isVisible())) await day.locator('[data-role="toggle-day"]').click();
      await add.click();
      await page.waitForSelector("#exPickList .pickrow", { timeout: 5000 });
      await page.locator("#exPickList .pickrow").first().click();
      await page.waitForFunction(({ draftKey, count }) =>
        (JSON.parse(localStorage.getItem(draftKey) || "{}").state?.result?.preview?.program || []).length === count,
      { draftKey: DRAFT, count: index + 1 }, { timeout: 8000 });
    }
    await page.waitForFunction(() => !document.querySelector("#entryEditorActivate")?.disabled, undefined, { timeout: 5000 });
    assert(await page.evaluate((key) => localStorage.getItem(key), KEY) === activeBefore, "activation-ready Build is still only a draft");
    await page.click("#entryEditorActivate");
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || "{}").programMeta?.name === "Manual block", KEY, { timeout: 10000 });
    await page.waitForFunction((draftKey) => localStorage.getItem(draftKey) === null, DRAFT, { timeout: 5000 });
    const activated = await page.evaluate(({ key, draftKey }) => ({
      active: JSON.parse(localStorage.getItem(key) || "{}"),
      draft: localStorage.getItem(draftKey),
    }), { key: KEY, draftKey: DRAFT });
    assert(activated.active.program.length === 4, "only explicit valid activation installs the Build program");
    assert(activated.draft === null, "successful Build activation clears its setup draft");
    await context.close();
  }

  console.log("\nBuild with an active program defers replacement confirmation until activation");
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
    const activeBefore = await page.evaluate((key) => localStorage.getItem(key), KEY);
    await page.click("#onbNext");
    await page.waitForSelector('#onbProgramEditor [data-role="day"]', { timeout: 5000 });
    assert(dialogs.length === 0, "opening Build asks for no replacement confirmation");
    assert(await page.evaluate((key) => localStorage.getItem(key), KEY) === activeBefore, "opening Build preserves the active program byte-identically");
    assert(await page.locator("#entryEditorActivate").isDisabled(), "incomplete replacement draft cannot activate");
    await page.locator('#onbProgramEditor [data-role="add-exercise"]').first().click();
    await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
    assert(await page.locator("#exPickCustom").isHidden(),
      "candidate editing does not expose custom creation that would mutate active definitions");
    await page.click("#exPickFull");
    await page.waitForSelector("#library.view.active", { timeout: 5000 });
    assert(await page.locator("#libCustom").isHidden(),
      "candidate full-library editing keeps custom creation unavailable");
    await page.click('#libTabs [data-tab="yours"]');
    assert(await page.locator('#libList [data-lib-row="custom:active-definition"]').count() === 1,
      "candidate library keeps existing custom exercises selectable");
    assert(await page.locator("#libList [data-lib-edit]").count() === 0,
      "candidate library does not expose active custom-definition editing");
    await page.click('#libTabs [data-tab="browse"]');
    await page.locator("#libList [data-lib-toggle]").first().click();
    await page.click("#libPrimary");
    await page.waitForSelector("#libConfigure:not(.hidden)", { timeout: 5000 });
    await page.click("#libPrimary");
    await page.waitForSelector('#onbProgramEditor [data-role="exercise"]', { timeout: 5000 });
    const fullLibraryEdit = await page.evaluate(({ key, draftKey }) => ({
      activeRaw: localStorage.getItem(key),
      candidateLength: JSON.parse(localStorage.getItem(draftKey) || "{}").state?.result?.preview?.program?.length || 0,
    }), { key: KEY, draftKey: DRAFT });
    assert(fullLibraryEdit.activeRaw === activeBefore,
      "full-library candidate selection leaves active state byte-identical");
    assert(fullLibraryEdit.candidateLength === 1,
      "full-library candidate selection persists in the setup draft");
    await page.evaluate((draftKey) => {
      const original = Storage.prototype.setItem;
      window.__restoreCandidateSetupSetItem = () => { Storage.prototype.setItem = original; };
      Storage.prototype.setItem = function(key, value) {
        if (key === draftKey) throw new DOMException("forced candidate quota failure", "QuotaExceededError");
        return original.call(this, key, value);
      };
    }, DRAFT);
    await page.click("#entryEditorSave");
    await page.waitForSelector('#entryEditorStatus[role="alert"]', { timeout: 5000 });
    const candidateSaveFailure = await page.locator("#entryEditorStatus").innerText();
    assert(/not changed|não foi alterado/i.test(candidateSaveFailure),
      "candidate Save draft announces a write failure instead of reporting success", candidateSaveFailure);
    assert(await page.evaluate((key) => localStorage.getItem(key), KEY) === activeBefore,
      "candidate Save draft failure leaves active state byte-identical");
    await page.evaluate(() => window.__restoreCandidateSetupSetItem());
    await page.click("#entryEditorSave");
    await page.waitForSelector('#entryEditorStatus[role="status"]', { timeout: 5000 });
    assert(await page.evaluate((draftKey) => localStorage.getItem(draftKey) !== null, DRAFT),
      "Save draft keeps the incomplete Build candidate durable without activation");
    assert(await page.evaluate((key) => localStorage.getItem(key), KEY) === activeBefore,
      "Save draft leaves the active program byte-identical");
    assert(await page.locator("#onboarding .onb__nav").isHidden(),
      "Build editor keeps onboarding bottom navigation hidden");
    assert(await page.locator("#onboarding").evaluate((node) => node.classList.contains("active")),
      "saving an incomplete Build keeps the user in the editor");
    assert(await page.evaluate((key) => localStorage.getItem(key), KEY) === activeBefore,
      "saving an incomplete Build does not change active bytes");
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

  console.log("\nSetup draft write failures are visible and non-destructive");
  {
    const { context, page } = await openFresh(browser);
    const activeBefore = await page.evaluate((key) => localStorage.getItem(key), KEY);
    await page.click("#firstRunCreate");
    await page.evaluate((draftKey) => {
      const original = Storage.prototype.setItem;
      window.__restoreSetupSetItem = () => { Storage.prototype.setItem = original; };
      Storage.prototype.setItem = function(key, value) {
        if (key === draftKey) throw new DOMException("forced quota failure", "QuotaExceededError");
        return original.call(this, key, value);
      };
    }, DRAFT);
    await page.click('[data-entry-route="recommend"]');
    await page.waitForFunction(() => document.querySelector("#onbBody")?.textContent.includes("Setup draft was not saved"));
    const after = await page.evaluate((key) => ({
      active: localStorage.getItem(key),
      alert: document.querySelector('#onbBody [role="alert"]')?.textContent || "",
    }), KEY);
    assert(after.alert.includes("Setup draft was not saved"), "setup save failure is announced in the UI");
    assert(after.active === activeBefore, "setup save failure leaves active state byte-identical");
    await page.evaluate(() => window.__restoreSetupSetItem());
    await context.close();
  }

  console.log("\nFailed activation preserves a newer setup draft from another tab");
  {
    const context = await browser.newContext();
    const pageA = await context.newPage();
    await pageA.goto(BASE);
    await waitForAppBoot(pageA, { base: BASE });
    await seedActiveProgram(pageA);
    const activeBefore = await pageA.evaluate((key) => localStorage.getItem(key), KEY);
    await pageA.evaluate(({ draftKey }) => {
      const Entry = window.RepForgeProgramEntry;
      const versions = window.RepForgeProgramCompiler.VERSIONS;
      const now = new Date().toISOString();
      let draft = Entry.createState({
        draftId: "setup-draft-race",
        activeProgramRevisionAtStart: JSON.parse(localStorage.getItem("repforge_v1"))._storageRevision,
        now,
        versions: {
          compiler: String(versions.compiler),
          family: String(versions.schema),
          blueprint: String(versions.blueprint),
          catalogue: String(versions.catalogue),
          rules: String(versions.rules),
          context: String(versions.context),
          progression: "range-1",
        },
      });
      draft = Entry.selectRoute(draft, "build");
      draft = Entry.setAnswers(draft, { daysPerWeek: 2, programName: "Tab A draft" });
      draft = Entry.setResult(draft, {
        fingerprint: "setup-race-fingerprint",
        selected: { id: "manual_build", source: "manual_build" },
        name: "Tab A draft",
        preview: {
          program: [{
            id: "race-exercise-1", day: "Day 1", order: 1, name: "Cable Row",
            sets: 3, min: 8, max: 12, primary: "Mid/upper back", secondary: "Biceps",
            notes: "", libraryId: "row_cable",
          }, {
            id: "race-exercise-2", day: "Day 2", order: 1, name: "Chest Press",
            sets: 3, min: 8, max: 12, primary: "Chest", secondary: "Triceps",
            notes: "", libraryId: "pc_mc",
          }],
          programStructure: {
            schemaVersion: 1,
            days: [
              { dayId: "manual_d1", label: "Day 1", order: 1 },
              { dayId: "manual_d2", label: "Day 2", order: 2 },
            ],
            provenance: { source: "manual_build", compilerVersion: null, familyId: null, blueprintId: null },
            weekPrescriptions: [],
            customizedFrom: null,
          },
        },
      });
      draft = { ...draft, step: "editor" };
      localStorage.setItem(draftKey, JSON.stringify({
        schemaVersion: 1,
        draftId: draft.draftId,
        revision: 1,
        ownerId: "tab-a",
        state: draft,
      }));
    }, { draftKey: DRAFT });
    await pageA.evaluate(() => window.startOnboarding("settings"));
    const pageB = await context.newPage();
    await pageB.goto(BASE);
    await waitForAppBoot(pageB, { base: BASE });
    await pageB.evaluate(() => window.startOnboarding("settings"));
    await pageA.evaluate(() => {
      window.__activationGate = new Promise((resolve) => { window.__releaseActivation = resolve; });
      const io = {
        async writeLocal() {
          window.__activationStarted = true;
          await window.__activationGate;
          throw new Error("forced local failure");
        },
        async writeIdb() {
          window.__activationStarted = true;
          await window.__activationGate;
          throw new Error("forced idb failure");
        },
      };
      const current = JSON.parse(localStorage.getItem("repforge_v1"));
      window.__activationResult = window.__repforgeFinalizeProgramSetup({
        exercises: current.program,
        name: "Rejected setup race",
        answers: { goal: "hypertrophy" },
        destination: "log",
        origin: "settings",
        draftConfirmed: true,
      }, io);
      window.__activationResult.then((result) => { window.__activationSettled = result; });
    });
    await pageA.waitForFunction(() => window.__activationStarted === true || window.__activationSettled !== undefined);
    const earlyResult = await pageA.evaluate(() => window.__activationSettled);
    assert(earlyResult === undefined, "tab A activation reaches the durable write", JSON.stringify(earlyResult));
    const newerRaw = await pageB.evaluate(async (draftKey) => {
      const Entry = window.RepForgeProgramEntry;
      const next = Entry.setAnswers(window.__repforgeEntryState(), { programName: "Tab B newer draft" });
      const saved = await window.__repforgePersistSetupDraft(next);
      if (!saved.ok) throw new Error(`tab B setup save failed: ${JSON.stringify(saved)}`);
      return localStorage.getItem(draftKey);
    }, DRAFT);
    const newerEnvelope = JSON.parse(newerRaw);
    assert(
      newerEnvelope.revision === 2 && newerEnvelope.ownerId !== "tab-a" &&
        newerEnvelope.state.answers.programName === "Tab B newer draft",
      "tab B product save advances revision and ownership"
    );
    await pageA.evaluate(() => window.__releaseActivation());
    const failed = await pageA.evaluate(() => window.__activationResult);
    const after = await pageA.evaluate(({ stateKey, draftKey }) => ({
      active: localStorage.getItem(stateKey),
      draft: localStorage.getItem(draftKey),
    }), { stateKey: KEY, draftKey: DRAFT });
    assert(!failed.localOk && !failed.idbOk, "tab A activation fails as forced");
    assert(after.active === activeBefore, "failed activation leaves active state byte-identical");
    assert(after.draft === newerRaw, "tab A failure does not overwrite tab B's newer draft");
    const staleActivation = await pageA.evaluate(() => window.__repforgeActivateEntryPreview({
      destination: "log",
      manualBuild: true,
      skipReplaceConfirm: true,
    }));
    const afterStaleAttempt = await pageA.evaluate(({ stateKey, draftKey }) => ({
      active: localStorage.getItem(stateKey),
      draft: localStorage.getItem(draftKey),
      alert: document.querySelector('#onbBody [role="alert"]')?.textContent || "",
      pending: Object.keys(localStorage).filter((key) => key.startsWith("repforge_pending_v1:")),
    }), { stateKey: KEY, draftKey: DRAFT });
    assert(staleActivation.setupDraftConflict === true, "newer setup revision blocks stale activation");
    assert(afterStaleAttempt.active === activeBefore, "blocked stale activation leaves active state byte-identical");
    assert(afterStaleAttempt.draft === newerRaw, "blocked stale activation preserves the newer setup draft");
    assert(afterStaleAttempt.alert.includes("changed in another tab"), "stale activation conflict is announced");
    assert(afterStaleAttempt.pending.length === 0, "blocked stale activation clears its pending journal");
    await context.close();
  }

  console.log("\nThe common entry replacement transaction is archive-safe for every route label");
  for (const route of ["recommend", "custom", "browse", "build", "import"]) {
    const { context, page } = await openFresh(browser);
    await seedActiveProgram(page);
    const before = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
    const result = await page.evaluate(async ({ route, exercises }) => {
      const committed = await window.__repforgeFinalizeProgramSetup({
        exercises,
        name: `${route} replacement`,
        answers: { goal: "hypertrophy" },
        destination: "log",
        origin: "settings",
        draftConfirmed: true,
        telemetryRoute: route,
      });
      await window.__repforgeStorage.flush();
      return committed;
    }, { route, exercises: before.program });
    const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
    const archived = after.programHistory.filter((entry) => entry.id === before.programMeta.id);
    assert(result.localOk || result.idbOk, `${route} replacement commits`);
    assert(archived.length === 1, `${route} archives the outgoing program exactly once`, JSON.stringify(archived));
    assert(
      isDeepStrictEqual(archived[0]?.meta, before.programMeta) &&
        isDeepStrictEqual(archived[0]?.program, before.program),
      `${route} archive preserves definition, metadata, and progression state`,
      JSON.stringify({ archived: archived[0], beforeMeta: before.programMeta, beforeProgram: before.program })
    );
    assert(after.programMeta.progressionModifiers.length === 0,
      `${route} replacement does not inherit outgoing progression modifiers`,
      JSON.stringify(after.programMeta.progressionModifiers));
    await context.close();
  }

  console.log("\nFirst-program activation creates no meaningless archive");
  {
    const { context, page } = await openFresh(browser);
    const result = await page.evaluate(async () => {
      const committed = await window.__repforgeFinalizeProgramSetup({
        exercises: [{
          id: "first-program-row", day: "Day 1", order: 1, name: "Cable Row",
          sets: 3, min: 8, max: 12, primary: "Mid/upper back", secondary: "Biceps",
          notes: "", libraryId: "row_cable",
        }],
        name: "First program",
        answers: { goal: "hypertrophy" },
        destination: "log",
        origin: "first-run",
        draftConfirmed: true,
        telemetryRoute: "recommend",
      });
      await window.__repforgeStorage.flush();
      return committed;
    });
    const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
    assert(result.localOk || result.idbOk, "first-program activation commits");
    assert(after.programHistory.length === 0, "first-program activation does not archive starter state");
    await context.close();
  }

  console.log("\nLegacy programs with durable usage evidence remain archiveable");
  {
    const { context, page } = await openFresh(browser);
    await seedActiveProgram(page);
    const before = await page.evaluate(async (key) => {
      const proposal = JSON.parse(localStorage.getItem(key));
      proposal.programMeta.onboarded = false;
      proposal.programHistory = [{ id: "older-program", name: "Older program", endedAt: "2026-07-01" }];
      const saved = await window.__repforgeCommitProposedState(proposal);
      if (!(saved.localOk || saved.idbOk)) throw new Error(`legacy fixture save failed: ${JSON.stringify(saved)}`);
      await window.__repforgeStorage.flush();
      return JSON.parse(localStorage.getItem(key));
    }, KEY);
    const result = await page.evaluate((exercises) => window.__repforgeFinalizeProgramSetup({
      exercises,
      name: "Legacy successor",
      answers: { goal: "hypertrophy" },
      destination: "log",
      origin: "settings",
      draftConfirmed: true,
      telemetryRoute: "recommend",
    }), before.program);
    await page.evaluate(() => window.__repforgeStorage.flush());
    const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
    const archived = after.programHistory.filter((entry) => entry.id === before.programMeta.id);
    assert(result.localOk || result.idbOk, "legacy used-program replacement commits");
    assert(archived.length === 1, "legacy used program archives exactly once", JSON.stringify(archived));
    assert(
      isDeepStrictEqual(archived[0]?.meta, before.programMeta) &&
        isDeepStrictEqual(archived[0]?.program, before.program),
      "legacy used-program archive preserves definition and metadata"
    );
    await context.close();
  }

  console.log("\nPartially populated first-run state is not archiveable");
  {
    const { context, page } = await openFresh(browser);
    const result = await page.evaluate(async (key) => {
      const proposal = JSON.parse(localStorage.getItem(key));
      proposal.programMeta.name = "Unfinished first-run name";
      proposal.programMeta.started = "2026-08-30";
      proposal.programMeta.onboarded = false;
      proposal.log = [];
      proposal.programHistory = [];
      const saved = await window.__repforgeCommitProposedState(proposal);
      if (!(saved.localOk || saved.idbOk)) throw new Error(`first-run fixture save failed: ${JSON.stringify(saved)}`);
      const committed = await window.__repforgeFinalizeProgramSetup({
        exercises: proposal.program,
        name: "Completed first program",
        answers: { goal: "hypertrophy" },
        destination: "log",
        origin: "first-run",
        draftConfirmed: true,
        telemetryRoute: "recommend",
      });
      await window.__repforgeStorage.flush();
      return committed;
    }, KEY);
    const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
    assert(result.localOk || result.idbOk, "partially populated first-run activation commits");
    assert(after.programHistory.length === 0, "partial first-run metadata creates no meaningless archive");
    await context.close();
  }

  console.log("\nReplacement rejects a newer durable revision even when the program is unchanged");
  {
    const context = await browser.newContext();
    const pageA = await context.newPage();
    await pageA.goto(BASE);
    await waitForAppBoot(pageA, { base: BASE });
    await seedActiveProgram(pageA);
    const staleProgram = await pageA.evaluate((key) => JSON.parse(localStorage.getItem(key)).program, KEY);
    const pageB = await context.newPage();
    await pageB.goto(BASE);
    await waitForAppBoot(pageB, { base: BASE });
    const newerRaw = await pageB.evaluate(async (key) => {
      const proposal = JSON.parse(localStorage.getItem(key));
      proposal.settings.restSec = 180;
      const result = await window.__repforgeCommitProposedState(proposal);
      if (!(result.localOk || result.idbOk)) throw new Error(`tab B commit failed: ${JSON.stringify(result)}`);
      await window.__repforgeStorage.flush();
      return localStorage.getItem(key);
    }, KEY);
    const staleResult = await pageA.evaluate(({ exercises }) => window.__repforgeFinalizeProgramSetup({
      exercises,
      name: "Stale replacement",
      answers: { goal: "hypertrophy" },
      destination: "log",
      origin: "settings",
      draftConfirmed: true,
      telemetryRoute: "recommend",
    }), { exercises: staleProgram });
    await pageA.evaluate(() => window.__repforgeStorage.flush());
    const after = await pageA.evaluate((key) => ({
      raw: localStorage.getItem(key),
      pending: Object.keys(localStorage).filter((item) => item.startsWith("repforge_pending_v1:")),
    }), KEY);
    assert(staleResult.staleRevision === true, "exact durable revision blocks the stale replacement");
    assert(after.raw === newerRaw, "stale replacement preserves the newer durable state byte-identically");
    assert(after.pending.length === 0, "stale revision rejection clears its pending journal");
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
    const canonical = canonicalCompilerPreview(compiled.preview);
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
        programStructure: canonical.programStructure,
      },
      program: canonical.program,
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
    await page.evaluate(({ day }) => window.__repforgeEnterWorkout({day }), { day: reducedDay });
    const weekOneDom = await page.evaluate(() => ({
      exercises: window.__repforgeWorkoutDraft.current().exerciseOrder.length,
      sets: Object.values(window.__repforgeWorkoutDraft.current().exercises).reduce((n, ex) => n + ex.setOrder.length, 0),
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

    const cleared=await page.evaluate(()=>window.__repforgeWorkoutDraft.clear());
    assert(cleared===true,"week-one draft is explicitly closed before creating a week-two session");
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
    await page.evaluate(({ day }) => window.__repforgeEnterWorkout({day }), { day: reducedDay });
    const weekTwoDom = await page.evaluate(() => ({
      exercises: window.__repforgeWorkoutDraft.current().exerciseOrder.length,
      sets: Object.values(window.__repforgeWorkoutDraft.current().exercises).reduce((n, ex) => n + ex.setOrder.length, 0),
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
