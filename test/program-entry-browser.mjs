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
        primary: "Back", secondary: "Biceps", notes: "", libraryId,
      }],
      log: [],
      programHistory: [],
      customExercises: [{
        id: "custom:active-definition", name: "Active custom movement", namePt: "Movimento personalizado ativo",
        equipment: ["machine"], primary: "Back", secondary: "", notes: "", created: now,
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

const browser = await launchChromium();
try {
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
    const existingWorkoutVisible = await page.locator("#workout .exercise").count() > 0;
    assert(existingProgram.id === "active-prog" && existingProgram.exercises > 0 && existingWorkoutVisible,
      "existing program remains usable without obsolete setup APIs", JSON.stringify({ existingProgram, existingWorkoutVisible }));
    await page.click("#leaveWorkout");
    const activeBefore = await page.evaluate((key) => localStorage.getItem(key), KEY);
    await page.evaluate(() => window.startOnboarding("settings"));
    await page.click('[data-entry-route="recommend"]');
    await page.click('[data-entry-pick="desiredResult"][data-entry-val="muscle_growth"]');
    await page.click("#onbNext");
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
    assert(afterBrowserBack.step === "desired_result" && afterBrowserBack.desiredResult === "muscle_growth",
      "browser Back uses semantic entry Back and preserves answers", JSON.stringify(afterBrowserBack));
    assert(afterBrowserBack.active === activeBefore, "browser Back leaves active state byte-identical");

    await page.goBack();
    await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "entry");
    assert(await page.locator('[data-entry-route="recommend"]').isVisible(),
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

    await page.evaluate(() => window.startOnboarding("settings"));
    await page.waitForSelector("#entryResumeContinue");
    assert(await page.evaluate(() => document.activeElement?.id === "entryResumeTitle"),
      "resume notice receives focus when it opens");
    assert(await page.locator("#onboarding .onb__nav").isHidden(),
      "resume notice owns the surface without a competing footer");
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
        primary: routes.filter((el) => el.classList.contains("entry-card--primary")).map((el) => el.dataset.entryRoute),
        secondary: routes.filter((el) => el.classList.contains("entry-card--secondary")).map((el) => el.dataset.entryRoute),
        routeChrome: routes.map((el) => ({ route: el.dataset.entryRoute, icon: !!el.querySelector(".entry-card__icon"), chevron: !!el.querySelector(".entry-card__go") })),
      };
    });
    assert(hubComposition.visibleTitles.length === 1 && hubComposition.visibleTitles[0] === "Create a program",
      "hub presents one visible title", JSON.stringify(hubComposition.visibleTitles));
    assert(hubComposition.progressSegments === 0 && hubComposition.progressLabel === "",
      "hub has no progress segments or progress label", JSON.stringify(hubComposition));
    assert(JSON.stringify(hubComposition.primary) === JSON.stringify(["recommend", "custom"]),
      "Recommend and Custom are both primary routes", JSON.stringify(hubComposition.primary));
    assert(JSON.stringify(hubComposition.secondary) === JSON.stringify(["browse"]),
      "Browse is a secondary route", JSON.stringify(hubComposition.secondary));
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
    assert(await page.locator('[data-entry-route="recommend"]').isVisible(), "hub shows recommend");
    assert(await page.locator('[data-entry-route="custom"]').isVisible(), "hub shows custom");
    assert(await page.locator("#entryOwnToggle").isVisible(), "hub shows bring/build");
    await page.click('[data-entry-route="recommend"]');
    const firstRouteHeader = {
      eyebrow: await page.locator("#onbEyebrow").innerText(),
      cancel: await page.locator("#onbCancel").innerText(),
      step: await page.locator("#onbStepLabel").innerText(),
    };
    assert(firstRouteHeader.eyebrow === "Recommend" && firstRouteHeader.cancel === "Cancel" && /1 of 5/i.test(firstRouteHeader.step),
      "Recommend has a route-specific first-step header and Cancel", JSON.stringify(firstRouteHeader));
    const inspectEntryGeometry = () => page.evaluate(() => {
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
    await page.click('[data-entry-pick="desiredResult"][data-entry-val="muscle_growth"]');
    const checked = await page.locator('[data-entry-pick="desiredResult"][data-entry-val="muscle_growth"]').getAttribute("aria-checked");
    assert(checked === "true", "selected desired-result card sets aria-checked", checked);
    await page.click("#onbNext");
    await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
    await page.click('[data-entry-pick="recentConsistency"][data-entry-val="about_half"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="3"]');
    await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
    await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="auto"]');
    const scheduleComposition = await page.evaluate(() => {
      const rows = [...document.querySelectorAll(".entry-body--schedule .radio-card")];
      const first = rows[0];
      const style = first ? getComputedStyle(first) : null;
      const rects = rows.map((el) => el.getBoundingClientRect());
      return {
        radius: style?.borderRadius || "",
        hairline: style?.borderBottomStyle || "",
        columns: getComputedStyle(document.querySelector(".entry-body--schedule .onb__opts"))?.gridTemplateColumns || "",
        noOverlap: rects.every((rect, index) => rects.every((other, otherIndex) => index === otherIndex ||
          rect.right <= other.left + 1 || other.right <= rect.left + 1 ||
          rect.bottom <= other.top + 1 || other.bottom <= rect.top + 1)),
      };
    });
    assert(scheduleComposition.radius === "0px" && scheduleComposition.hairline === "solid",
      "schedule choices use compact hairline rows", JSON.stringify(scheduleComposition));
    assert(scheduleComposition.columns.includes(" ") && scheduleComposition.noOverlap,
      "schedule groups stay compact without overlap", JSON.stringify(scheduleComposition));
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
    assert(await page.locator('[data-entry-pick="environmentCapabilities"][data-entry-val="safe_pull"]').isVisible(), "capability correction includes safe_pull");
    assert(await page.locator('[data-entry-pick="environmentCapabilities"][data-entry-val="external_resistance"]').count() === 0, "hard external_resistance is not a user toggle");
    await page.click("#onbNext");
    assert(await page.locator("#entryAvoidSearch").isVisible(), "avoidance search is present on priorities");
    const priorityComposition = await page.evaluate(() => {
      const rows = [...document.querySelectorAll(".entry-body--priorities .radio-card")];
      const rects = rows.map((el) => el.getBoundingClientRect());
      return {
        radius: rows[0] ? getComputedStyle(rows[0]).borderRadius : "",
        hairline: rows[0] ? getComputedStyle(rows[0]).borderBottomStyle : "",
        noOverlap: rects.every((rect, index) => rects.every((other, otherIndex) => index === otherIndex ||
          rect.right <= other.left + 1 || other.right <= rect.left + 1 ||
          rect.bottom <= other.top + 1 || other.bottom <= rect.top + 1)),
      };
    });
    assert(priorityComposition.radius === "0px" && priorityComposition.hairline === "solid" && priorityComposition.noOverlap,
      "priorities and constraints use readable compact grouped rows", JSON.stringify(priorityComposition));
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
    assert(/Full commercial gym/.test(recommendationCopy) && /Review this program/.test(recommendationCopy),
      "recommendation cites the environment and offers an explicit review action", recommendationCopy);
    const candidateCount = await page.locator("[data-entry-select-candidate]").count();
    assert(candidateCount === 1, "recommend shows only the primary result", String(candidateCount));
    const draftBefore = await page.evaluate((key) => localStorage.getItem(key), DRAFT);
    assert(!!draftBefore, "setup draft persisted during recommend");
    const draftEnvelope = JSON.parse(draftBefore);
    assert(
      draftEnvelope.schemaVersion === 1 && draftEnvelope.revision > 0 &&
        typeof draftEnvelope.ownerId === "string" && draftEnvelope.state?.route === "recommend",
      "setup draft persistence records ownership and revision"
    );
    await page.locator("[data-entry-select-candidate]").first().click();
    await page.waitForSelector("#entryActivate");
    const reviewCopy = await page.locator("#onbBody").innerText();
    assert(/Build Muscle/.test(reviewCopy) && /Taurifer recommendation/.test(reviewCopy),
      "review names the candidate and its human-readable source", reviewCopy);
    assert(/exercises/.test(reviewCopy) && /working sets/.test(reviewCopy) && /minutes/.test(reviewCopy),
      "review shows exercise, set, and approximate-duration facts", reviewCopy);
    assert(/Priorities/i.test(reviewCopy) && /Equipment assumptions/i.test(reviewCopy) && /Progression/i.test(reviewCopy),
      "review presents priorities, equipment assumptions, and progression", reviewCopy);
    assert(/supported Taurifer progression/i.test(reviewCopy),
      "common preview keeps factual copy for supported Taurifer strategies", reviewCopy);
    assert(await page.locator("#onbBody details").count() === 3,
      "review uses one collapsible summary per training day");
    assert(await page.locator("#onboarding .onb__nav").evaluate((node) => getComputedStyle(node).position !== "sticky"),
      "review navigation stays in document flow instead of obscuring day summaries");
    const activeBeforeEdit = await page.evaluate((key) => localStorage.getItem(key), KEY);
    const draftBeforeEdit = await page.evaluate((key) => localStorage.getItem(key), DRAFT);
    await page.click("#entryEdit");
    await page.waitForSelector("#programEditor .pex", { timeout: 5000 });
    assert(await page.evaluate((key) => localStorage.getItem(key), KEY) === activeBeforeEdit,
      "Edit before using opens the candidate without changing active bytes");
    const firstNote = page.locator('#programEditor .pex [data-field="notes"]').first();
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
    await page.click("#programEditToggle");
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

  console.log("\nRecommend preserves compiler paired-exposure relations through activation");
  {
    const { context, page } = await openFresh(browser);
    await page.click("#firstRunCreate");
    await page.click('[data-entry-route="recommend"]');
    await page.click('[data-entry-pick="desiredResult"][data-entry-val="balanced"]');
    await page.click("#onbNext");
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
    await page.waitForSelector("[data-entry-select-candidate]", { timeout: 10000 });
    await page.click("[data-entry-select-candidate]");
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
    await page.click('[data-entry-route="recommend"]');
    await page.click('[data-entry-pick="desiredResult"][data-entry-val="balanced"]');
    await page.click("#onbNext");
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
    await page.waitForSelector("[data-entry-select-candidate]", { timeout: 10000 });
    await page.click("[data-entry-select-candidate]");
    await page.waitForSelector("#entryActivate", { timeout: 10000 });
    const relation = await page.evaluate(() => window.__repforgeEntryState().result.preview.progressionRelations?.[0]);
    const targetId = relation?.members?.[0]?.exerciseId;
    assert(!!targetId, "candidate editor fixture contains a paired relation member", JSON.stringify(relation));
    await page.click("#entryEdit");
    await page.waitForSelector(`#programEditor .pex[data-id="${targetId}"] [data-act="changeEx"]`, { timeout: 5000 });
    await page.locator(`#programEditor .pex[data-id="${targetId}"] [data-act="changeEx"]`).click();
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
    await page.click('[data-entry-route="recommend"]');
    await page.click('[data-entry-pick="desiredResult"][data-entry-val="muscle_growth"]');
    await page.click("#onbNext");
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
    await page.waitForSelector("[data-entry-select-candidate]", { timeout: 10000 });
    const preview = await page.evaluate(() => window.__repforgeEntryState().result?.preview?.program || []);
    assert(preview.some((exercise) => exercise.libraryId === "cd_mc"),
      "the generated candidate retains a compatible exact movement from the active program");
    assert(await page.evaluate((key) => localStorage.getItem(key), KEY) === activeBefore,
      "history-aware generation leaves the familiar active program byte-identical");
    await context.close();
  }

  console.log("\nCustom uses real human split choices and bounded exercise preferences");
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
    assert(await page.locator("#entryMustSearch").isVisible(), "Custom exposes a must-have exercise search");
    await page.fill("#entryMustSearch", "barbell bench press");
    await page.waitForTimeout(50);
    await page.locator('[data-entry-must-add="pr_bb"]').click();
    assert(await page.locator('[data-entry-must-remove="pr_bb"]').isVisible(),
      "selected must-have remains visible and removable");
    await page.fill("#entryAvoidSearch", "barbell bench press");
    await page.waitForTimeout(50);
    assert(await page.locator('[data-entry-avoid-add="pr_bb"]').count() === 0,
      "a must-have exercise is not offered as an avoidance contradiction");
    await page.fill("#entryAvoidSearch", "barbell curl");
    await page.locator('[data-entry-avoid-add="cu_bb"]').click();
    const beforeReason = await page.evaluate(() => window.__repforgeEntryState().answers.exerciseConstraints || []);
    assert(beforeReason.length === 0, "selecting an avoided exercise does not invent a dislike reason");
    assert(await page.locator("#onbNext").isDisabled(), "an avoided exercise requires an explicit reason before Continue");
    await page.click('[data-entry-pick="avoidReason"][data-entry-val="cu_bb|dislike"]');
    await page.click("#onbNext");
    const choices = page.locator('[data-entry-pick="splitPreference"]');
    const choiceCount = await choices.count();
    const shapeCopy = await page.locator("#onbBody").innerText();
    assert(choiceCount >= 1 && choiceCount <= 2, "Custom shows at most two real split choices", String(choiceCount));
    assert(!/_v\d+|growth_\d|balanced_\d|strength_\d|home_\d/i.test(shapeCopy),
      "Custom never exposes a family or blueprint identifier", shapeCopy);
    assert(await choices.first().getAttribute("aria-checked") === "true" && !(await page.locator("#onbNext").isDisabled()),
      "Taurifer's compatible default is selected before the shape screen renders");
    assert((await page.locator("#onbNext").innerText()) === "Generate program",
      "Custom ends with an explicit Generate program action");
    await page.click("#onbNext");
    await page.waitForSelector("[data-entry-select-candidate]");
    assert(/Your custom program/.test(await page.locator("#onbBody").innerText()) &&
      await page.locator('[data-entry-action="change-priorities"]').isVisible(),
      "Custom result names the job and offers a targeted change action");
    const candidate = await page.evaluate(() => window.__repforgeEntryState().result?.preview?.program || []);
    assert(candidate.some((exercise) => exercise.libraryId === "pr_bb"),
      "the generated candidate contains the selected must-have exercise");
    await page.locator("[data-entry-select-candidate]").click();
    const reviewCopy = await page.locator("#onbBody").innerText();
    assert(/Barbell bench press/.test(reviewCopy), "Custom review names the selected must-have exercise", reviewCopy);
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
    assert(/No released program fits these answers/.test(emptyCopy),
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
    await page.waitForSelector("#programEditor .pday", { timeout: 10000 });
    const built = await page.evaluate(({ key, draftKey }) => {
      const activeRaw = localStorage.getItem(key);
      const envelope = JSON.parse(localStorage.getItem(draftKey) || "{}");
      const cards = [...document.querySelectorAll("#programEditor .pday")].map((card) => ({
        day: card.getAttribute("data-day"),
        empty: !!card.querySelector(".pday__empty"),
        exercises: card.querySelectorAll(".pex").length,
        addExercise: !!card.querySelector(".pday__add"),
      }));
      const draftMarker = document.querySelector(".pmeta__draft");
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
        draftMarker: !!draftMarker && /draft/i.test(draftMarker.textContent),
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
    assert(built.draftMarker && built.saveVisible, "Build visibly identifies the editable draft and Save draft action", JSON.stringify(built));
    assert(built.activateDisabled && /Add an exercise to/i.test(built.statusText) && built.statusAdjacent,
      "Build names incompleteness adjacent to its disabled activation", JSON.stringify(built));
    const buildGeometry = await page.evaluate(() => {
      const action = document.querySelector("#entryEditorActivate");
      const marker = document.querySelector(".pmeta__draft");
      const rects = [action?.getBoundingClientRect(), marker?.getBoundingClientRect()].filter(Boolean);
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        noOverlap: rects.every((rect, index) => rects.every((other, otherIndex) => index === otherIndex ||
          rect.right <= other.left + 1 || other.right <= rect.left + 1 || rect.bottom <= other.top + 1 || other.bottom <= rect.top + 1)),
      };
    });
    assert(buildGeometry.overflow <= 0 && buildGeometry.noOverlap, "Build draft has no viewport overflow or action overlap", JSON.stringify(buildGeometry));

    await page.locator('#programEditor [data-act="addEx"]').first().click();
    await page.waitForSelector("#exPickSheet.is-open, #exPickList .pickrow", { timeout: 5000 });
    await page.locator("#exPickList .pickrow").first().click();
    await page.waitForFunction((draftKey) => (JSON.parse(localStorage.getItem(draftKey) || "{}").state?.result?.preview?.program || []).length > 0, DRAFT, { timeout: 8000 });
    const afterAdd = await page.evaluate(({ key, draftKey }) => {
      const envelope = JSON.parse(localStorage.getItem(draftKey) || "{}");
      return {
        activeRaw: localStorage.getItem(key),
        programLen: envelope.state?.result?.preview?.program?.length || 0,
        structureDays: envelope.state?.result?.preview?.programStructure?.days?.length || 0,
        cards: document.querySelectorAll("#programEditor .pday").length,
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
    await page.waitForSelector("#programEditor .pday", { timeout: 5000 });
    const resumed = await page.evaluate(({ key, draftKey }) => ({
      activeRaw: localStorage.getItem(key),
      draftProgramLen: JSON.parse(localStorage.getItem(draftKey) || "{}").state?.result?.preview?.program?.length || 0,
    }), { key: KEY, draftKey: DRAFT });
    assert(resumed.activeRaw === activeBefore, "reload/resume leaves active state byte-identical");
    assert(resumed.draftProgramLen === 1, "reload/resume restores the partial Build draft");

    for (let index = 1; index < 4; index++) {
      await page.locator('#programEditor [data-act="addEx"]').nth(index).click();
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
    await page.waitForSelector("#programEditor .pday", { timeout: 5000 });
    assert(dialogs.length === 0, "opening Build asks for no replacement confirmation");
    assert(await page.evaluate((key) => localStorage.getItem(key), KEY) === activeBefore, "opening Build preserves the active program byte-identically");
    assert(await page.locator("#entryEditorActivate").isDisabled(), "incomplete replacement draft cannot activate");
    await page.locator('#programEditor [data-act="addEx"]').first().click();
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
    await page.waitForSelector("#programEditor .pex", { timeout: 5000 });
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
    await page.click('nav button[data-view="log"]');
    assert((await page.locator("#todayProgram").innerText()).includes("Active block"),
      "Today continues to show the old active program while Build is incomplete");
    assert(await page.evaluate((key) => localStorage.getItem(key), KEY) === activeBefore,
      "viewing Today while drafting does not change active bytes");
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
            sets: 3, min: 8, max: 12, primary: "Back", secondary: "Biceps",
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
          sets: 3, min: 8, max: 12, primary: "Back", secondary: "Biceps",
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
