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
      customExercises: [{
        id: "custom:active-definition", name: "Active custom movement", namePt: "Movimento personalizado ativo",
        equipment: ["machine"], primary: "Back", secondary: "", notes: "", created: now,
      }],
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
  console.log("\nBrowser Back and explicit setup cancellation preserve draft safety");
  {
    const { context, page } = await openFresh(browser);
    await seedActiveProgram(page);
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
    const draftEnvelope = JSON.parse(draftBefore);
    assert(
      draftEnvelope.schemaVersion === 1 && draftEnvelope.revision > 0 &&
        typeof draftEnvelope.ownerId === "string" && draftEnvelope.state?.route === "recommend",
      "setup draft persistence records ownership and revision"
    );
    await page.locator("[data-entry-select-candidate]").first().click();
    await page.waitForSelector("#entryActivate");
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
        draft: localStorage.getItem("repforge_program_setup_draft_v1"),
      };
    }, KEY);
    assert(after.onboarded === true, "activation onboarded the program");
    assert(after.programLen > 0, "activation wrote exercises", String(after.programLen));
    assert(after.hasContext === true, "reusable programmingContext saved with activation");
    assert(after.constraints.some((item) => item.reason === "pain"), "pain constraint persisted in programmingContext");
    assert(after.editedNote === "Draft-only setup note", "explicit activation installs the edited candidate");
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
      }));
      return {
        activeRaw,
        draftName: envelope.state?.result?.name,
        draftProgramLen: envelope.state?.result?.preview?.program?.length || 0,
        draftDays: envelope.state?.result?.preview?.programStructure?.days?.length || 0,
        activateDisabled: !!document.querySelector("#entryEditorActivate")?.disabled,
        cards,
      };
    }, { key: KEY, draftKey: DRAFT });
    assert(built.activeRaw === activeBefore, "opening the Build editor leaves active state byte-identical");
    assert(built.draftProgramLen === 0, "Build draft has no placeholder exercises before add", String(built.draftProgramLen));
    assert(built.draftDays === 4, "Build draft created four empty days", String(built.draftDays));
    assert(built.cards.length === 4, "editor shows four day cards", String(built.cards.length));
    assert(built.cards.every((card) => card.empty && card.exercises === 0), "all four day cards are empty containers");
    assert(built.draftName === "Manual block", "Build draft kept the program name", built.draftName);
    assert(built.activateDisabled, "empty Build cannot activate");

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
