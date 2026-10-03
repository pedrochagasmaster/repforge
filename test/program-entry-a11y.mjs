#!/usr/bin/env node
/** Named Plan 048 entry accessibility regression: semantics, keyboard, focus, and compact geometry. */
import { pathToFileURL } from "url";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const checks = { passed: 0, failed: 0 };
function assert(ok, name, detail = "") {
  if (ok) { checks.passed++; console.log(`  ✓ ${name}`); }
  else { checks.failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function clean(page) {
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((resolve) => { const request = indexedDB.deleteDatabase("repforge"); request.onsuccess = resolve; request.onerror = resolve; request.onblocked = resolve; });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(() => { window.closeFirstRun?.(); window.closeOnboarding?.(); window.startOnboarding?.("settings", { resume: false }); });
}

async function reachPriorities(page) {
  await page.click('[data-entry-route="custom"]');
  await page.click('[data-entry-pick="desiredResult"][data-entry-val="muscle_growth"]');
  await page.click("#onbNext");
  await page.click('[data-entry-pick="structuredExperience"][data-entry-val="first"]');
  await page.click('[data-entry-pick="recentConsistency"][data-entry-val="most"]');
  await page.click("#onbNext");
  await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="3"]');
  await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
  await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="auto"]');
  await page.click("#onbNext");
  await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
  await page.click("#onbNext");
}

export async function runProgramEntryA11y(browser, check = assert) {
  const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
  try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await clean(page);

  check(await page.locator("#onbBack").evaluate((el) => getComputedStyle(el).minHeight === "44px"), "Back has a 44px minimum target");
  check((await page.locator("#onbBack").getAttribute("aria-label")) === "Back", "Back has an explicit accessible name");

  await page.locator('[data-entry-route="custom"]').focus();
  await page.keyboard.press("Enter");
  const transitionFocus = await page.locator("#entryHeading").evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      active: el === document.activeElement,
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth) || 0,
    };
  });
  check(transitionFocus.active, "screen transition moves semantic focus to the heading");
  check(transitionFocus.outlineStyle === "none" || transitionFocus.outlineWidth === 0,
    "screen-transition focus does not draw a ring", JSON.stringify(transitionFocus));
  await page.locator('[data-entry-pick="desiredResult"][data-entry-val="muscle_growth"]').focus();
  const controlFocus = await page.locator('[data-entry-pick="desiredResult"][data-entry-val="muscle_growth"]').evaluate((el) => {
    const style = getComputedStyle(el);
    return { outlineStyle: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth) || 0 };
  });
  check(controlFocus.outlineStyle !== "none" && controlFocus.outlineWidth > 0,
    "keyboard-focused controls retain a visible ring", JSON.stringify(controlFocus));
  check(await page.locator("#onbNext").isDisabled(), "Continue is disabled until the desired result is answered");

  // R7 J-16: the screen's title is exposed once. The legacy hidden #onbTitle must not repeat #entryHeading.
  const headingNames = await page.locator("#onboarding").getByRole("heading").allTextContents();
  const normalizedHeadings = headingNames.map((text) => text.replace(/\s+/g, " ").trim()).filter(Boolean);
  check(normalizedHeadings.length > 0 && new Set(normalizedHeadings).size === normalizedHeadings.length,
    "the entry screen exposes each heading once to assistive technology", JSON.stringify(normalizedHeadings));
  // R7 J-12: #onbStepLabel is aria-live. Answering a question must not rewrite it with the text it already has.
  await page.evaluate(() => {
    const label = document.querySelector("#onbStepLabel");
    window.__stepLabelWrites = 0;
    window.__stepLabelObserver?.disconnect();
    window.__stepLabelObserver = new MutationObserver((records) => { window.__stepLabelWrites += records.length; });
    window.__stepLabelObserver.observe(label, { childList: true, characterData: true, subtree: true });
  });
  await page.click('[data-entry-pick="desiredResult"][data-entry-val="muscle_growth"]');
  check(await page.evaluate(() => { window.__stepLabelObserver.takeRecords(); return window.__stepLabelWrites; }) === 0,
    "answering a question does not rewrite the live step label");
  check(!(await page.locator("#onbNext").isDisabled()), "answering the desired result enables Continue");
  check(await page.locator('[data-entry-pick="desiredResult"][data-entry-val="muscle_growth"]').evaluate((el) => el.getAttribute("aria-checked") === "true" && !el.hasAttribute("aria-pressed")), "radio exposes aria-checked, not aria-pressed");
  check(await page.getByRole("radio").count() === 3, "accessibility tree exposes the three desired-result radios");
  await page.keyboard.press("ArrowDown");
  check(await page.locator('[data-entry-pick="desiredResult"][data-entry-val="balanced"]').evaluate((el) => el.getAttribute("aria-checked") === "true" && el === document.activeElement), "radio arrows move selection and focus");

  await page.click("#onbNext");
  check(await page.locator("#onbNext").isDisabled(), "Continue is disabled when both background answers are missing");
  await page.click('[data-entry-pick="structuredExperience"][data-entry-val="first"]');
  check(await page.locator("#onbNext").isDisabled(), "Continue stays disabled when one background answer is missing");
  await page.click('[data-entry-pick="recentConsistency"][data-entry-val="most"]');
  check(!(await page.locator("#onbNext").isDisabled()), "answering both background questions enables Continue");

  await page.click("#onbNext");
  check(await page.locator("#onbNext").isDisabled(), "Continue is disabled when schedule answers are missing");
  await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="3"]');
  await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
  check(await page.locator("#onbNext").isDisabled(), "Continue stays disabled when the rest answer is missing");
  await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="auto"]');
  check(!(await page.locator("#onbNext").isDisabled()), "answering every schedule question enables Continue");

  await page.click("#onbNext");
  check(await page.locator("#onbNext").isDisabled(), "Continue is disabled until the environment is answered");
  await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
  check(!(await page.locator("#onbNext").isDisabled()), "answering the environment enables Continue");

  await clean(page);
  await reachPriorities(page);
  const checkboxInfo = await page.locator('#onbBody [role="checkbox"]').evaluateAll((els) => els.map((el) => ({ tabIndex: el.tabIndex, checked: el.getAttribute("aria-checked"), pressed: el.getAttribute("aria-pressed") })));
  check(checkboxInfo.length > 4 && checkboxInfo.every((item) => item.tabIndex >= 0 && item.pressed === null), "checkboxes remain independently tabbable with aria-checked");
  check(await page.getByRole("checkbox").count() === checkboxInfo.length, "accessibility tree exposes each checkbox control");

  const muscleControls = page.locator('[data-entry-pick="musclePriority"]');
  const muscleNames = await muscleControls.evaluateAll((els) => [...new Set(els.map((el) => el.dataset.entryVal.split("|")[0]))]);
  check((await muscleControls.count()) === 40 && muscleNames.length === 10,
    "Custom exposes one four-state radio group per muscle");
  await page.locator('[data-entry-pick="musclePriority"][data-entry-val="chest|prioritize"]').focus();
  const before = await page.evaluate(() => document.activeElement?.dataset.entryVal);
  await page.click('[data-entry-pick="musclePriority"][data-entry-val="chest|prioritize"]');
  const after = await page.evaluate(() => document.activeElement?.dataset.entryVal);
  const partition = await page.evaluate(() => window.__repforgeEntryState().answers);
  check(before === "chest|prioritize" && after === "chest|prioritize" && partition.primaryMuscles?.includes("chest") &&
    !partition.deEmphasizedMuscles?.includes("chest") && !partition.ignoredMuscles?.includes("chest"),
    "muscle-state selection rerender restores focus without contradictory categories");

  const geometry = await page.evaluate(() => {
    const root = document.querySelector("#onboarding");
    if (root) root.scrollTop = root.scrollHeight;
    const rect = document.querySelector(".onb__nav")?.getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, footerReachable: !!rect && rect.bottom <= window.innerHeight + 1 };
  });
  check(geometry.overflow <= 0 && geometry.footerReachable, "320px entry has no horizontal overflow and footer remains reachable", JSON.stringify(geometry));

  const large = await page.evaluate(() => {
    const fontSize = (selector) => {
      const element = document.querySelector(selector);
      return element ? Number.parseFloat(getComputedStyle(element).fontSize) : null;
    };
    const beforeText = {
      heading: fontSize("#entryHeading"),
      explain: fontSize("#onbBody .onb__explain"),
      option: fontSize("#onbBody .radio-card__title"),
      next: fontSize("#onbNext"),
    };
    document.documentElement.style.fontSize = "200%";
    const root = document.querySelector("#onboarding");
    if (root) root.scrollTop = root.scrollHeight;
    const rect = document.querySelector(".onb__nav")?.getBoundingClientRect();
    const afterText = {
      heading: fontSize("#entryHeading"),
      explain: fontSize("#onbBody .onb__explain"),
      option: fontSize("#onbBody .radio-card__title"),
      next: fontSize("#onbNext"),
    };
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      footerReachable: !!rect && rect.bottom <= window.innerHeight + 1,
      beforeText,
      afterText,
    };
  });
  check(large.overflow <= 0 && large.footerReachable, "320px entry remains usable with enlarged text", JSON.stringify(large));
  check(Object.keys(large.beforeText).every((key) => Number.isFinite(large.beforeText[key]) &&
    Number.isFinite(large.afterText[key]) && large.afterText[key] >= large.beforeText[key] * 1.99),
  "200% root text genuinely enlarges onboarding typography", JSON.stringify(large));

  await page.setViewportSize({ width: 1280, height: 800 });
  const desktopWidth = await page.locator("#onboarding .onb").evaluate((el) => el.getBoundingClientRect().width);
  check(desktopWidth > 700, "desktop entry uses a wider composition", `width=${desktopWidth}`);

  await clean(page);
  await page.click("#entryOwnToggle");
  await page.click('[data-entry-route="import"]');
  await page.setInputFiles("#importProgram", {
    name: "future-strategy-a11y.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      version: 3,
      meta: { name: "Future strategy" },
      exercises: [{
        day: "Day 1", order: 1, name: "Barbell bench press", sets: 3, min: 5, max: 8,
        progression: { schemaVersion: 1, strategy: { id: "future_strategy", version: 99, params: { authored: true } }, modifiers: [] },
      }],
    })),
  });
  await page.waitForSelector("#importReview.active", { timeout: 10000 });
  await page.click("#importCommit");
  await page.waitForSelector("#entryActivate", { timeout: 10000 });
  check(await page.locator("#entryActivationStatus").isVisible(), "future strategy preview exposes an activation alert");
  const activationFocus = await page.locator("#entryActivationStatus").evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      active: el === document.activeElement,
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth) || 0,
    };
  });
  check(activationFocus.active, "future strategy preview focuses the activation alert on initial render");
  check(activationFocus.outlineStyle === "none" || activationFocus.outlineWidth === 0,
    "focused activation alert does not draw a ring", JSON.stringify(activationFocus));
  check(await page.locator("#entryActivate").isDisabled() &&
    (await page.locator("#entryActivate").getAttribute("aria-describedby")) === "entryActivationStatus",
  "future strategy preview keeps activation disabled with describedby guidance");

  await clean(page);
  await page.click("#entryOwnToggle");
  await page.click('[data-entry-route="import"]');
  await page.setInputFiles("#importProgram", {
    name: "valid-preview-a11y.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      version: 3,
      meta: { name: "Valid program" },
      exercises: [{ day: "Day 1", order: 1, name: "Barbell bench press", sets: 3, min: 5, max: 8 }],
    })),
  });
  await page.waitForSelector("#importReview.active", { timeout: 10000 });
  await page.click("#importCommit");
  await page.waitForSelector("#entryActivate", { timeout: 10000 });
  check(await page.locator("#entryHeading").evaluate((el) => el === document.activeElement),
    "valid preview focuses the heading on initial render");
  check(await page.locator("#entryActivationStatus").count() === 0 && !(await page.locator("#entryActivate").isDisabled()),
    "valid preview has no activation alert and remains activatable");

  await clean(page);
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.evaluate(() => localStorage.setItem("repforge_ui_v1", JSON.stringify({ theme: "dark" })));
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(() => { window.closeFirstRun?.(); window.startOnboarding?.("settings", { resume: true }); });
  if (await page.locator("#entryResumeContinue").count()) await page.click("#entryResumeContinue");
  check(await page.locator("html").getAttribute("data-theme") === "dark", "dark theme remains tokenized in entry flow");
  check(await page.locator(".entry-card").first().evaluate((el) => getComputedStyle(el).transitionDuration === "0s"), "reduced motion removes entry transitions");

  await runEntryDialogFocus(page);
  } finally {
    await page.close();
  }
}

const ACTIVE_SEED = {
  settings: { unit: "kg", lang: "en", jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120 },
  programMeta: { id: "a11y-active", name: "Current block", started: "2026-08-01", created: "2026-08-01T00:00:00.000Z", updated: "2026-08-01T00:00:00.000Z", onboarded: true, mesocycleStatus: "active", mesocycleLengthWeeks: 6, daysPerWeek: 1, goal: "hypertrophy", equipment: ["barbell"] },
  program: [{ id: "active-row", day: "Day 1", order: 1, name: "Barbell row", sets: 2, min: 6, max: 10, primary: "Mid/upper back", secondary: "Biceps", notes: "", alternates: [], libraryId: "rw_bb" }],
  log: [{ session: "a11y-session", date: "2026-08-29", day: "Day 1", exerciseId: "active-row", set: 1, load: 50, reps: 8, rir: 2 }],
  programHistory: [], customExercises: [], _storageRevision: 7,
};

/** Import a one-exercise program and stop at the activation-ready review. */
async function reachImportReview(page) {
  await page.click("#entryOwnToggle");
  await page.click('[data-entry-route="import"]');
  await page.setInputFiles("#importProgram", {
    name: "dialog-a11y.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      version: 3, meta: { name: "Dialog program" },
      exercises: [{ day: "Day 1", order: 1, name: "Barbell bench press", sets: 3, min: 5, max: 8 }],
    })),
  });
  await page.waitForSelector("#importReview.active", { timeout: 10000 });
  await page.click("#importCommit");
  await page.waitForSelector("#entryActivate", { timeout: 10000 });
}

const dialogHasFocus = (page) => page.evaluate(() => {
  const dialog = document.getElementById("entryDialog");
  return !!dialog?.open && dialog.contains(document.activeElement);
});
const focusedId = (page) => page.evaluate(() => document.activeElement?.id || "");

/**
 * K-26: every entry dialog takes focus inside itself, keeps Tab inside, closes
 * on Escape and returns focus to the control that opened it.
 */
async function runEntryDialogFocus(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await clean(page);

  // Cancel, opened from the hub's own Cancel control.
  await page.click("#onbCancel");
  await page.waitForSelector("#entryCancelKeep");
  assert(await dialogHasFocus(page), "the cancel dialog takes focus inside itself");
  assert(await page.getByRole("dialog").count() === 1, "the cancel dialog is exposed as a dialog");
  for (let press = 0; press < 5; press++) await page.keyboard.press("Tab");
  assert(await dialogHasFocus(page), "Tab stays inside the cancel dialog");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.getElementById("entryDialog")?.open);
  assert(await focusedId(page) === "onbCancel", "Escape closes the cancel dialog and returns focus to Cancel", await focusedId(page));
  await page.click("#onbCancel");
  await page.click("#entryCancelContinue");
  assert(await focusedId(page) === "onbCancel", "Continue setup returns focus to Cancel", await focusedId(page));

  // Start over, opened from the review.
  await reachImportReview(page);
  await page.locator("#entryRestart").focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector("#entryRestartConfirm");
  assert(await dialogHasFocus(page), "the start-over dialog takes focus inside itself");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.getElementById("entryDialog")?.open);
  assert(await focusedId(page) === "entryRestart", "Escape closes the start-over dialog and returns focus to Start over", await focusedId(page));
  assert(await page.evaluate(() => window.__repforgeEntryState?.()?.step) === "preview", "dismissing start over keeps the review");
  await page.click("#entryRestart");
  await page.click("#entryRestartCancel");
  assert(await focusedId(page) === "entryRestart", "Back to the program returns focus to Start over", await focusedId(page));

  // Resume, discarding the saved setup.
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(() => { window.closeFirstRun?.(); window.startOnboarding?.("settings"); });
  await page.waitForSelector("#entryResumeContinue");
  await page.locator("#entryResumeRestart").focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector("#entryRestartConfirm");
  assert(await dialogHasFocus(page) && /saved setup/i.test(await page.locator("#entryRestartTitle").innerText()),
    "the resume card's Start over asks to discard the saved setup");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.getElementById("entryDialog")?.open);
  assert(await focusedId(page) === "entryResumeRestart", "Escape returns focus to the resume card's Start over", await focusedId(page));
  assert(await page.locator("#entryResumeContinue").isVisible(), "dismissing the discard keeps the resume card");

  // Replace, opened from the review when a program is already active.
  await clean(page);
  await page.evaluate(async (seed) => {
    localStorage.setItem("repforge_v1", JSON.stringify(seed));
    await window.__repforgeStorage.flush();
  }, ACTIVE_SEED);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(() => { window.closeFirstRun?.(); window.startOnboarding?.("settings", { resume: false }); });
  await reachImportReview(page);
  await page.locator("#entryActivate").focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector("#entryReplaceConfirm");
  assert(await dialogHasFocus(page), "the replace dialog takes focus inside itself");
  const replaceCopy = await page.locator("#entryDialog").innerText();
  assert(/Current block/.test(replaceCopy) && /Dialog program/.test(replaceCopy),
    "the replace dialog names the program it archives and the one it starts", replaceCopy);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.getElementById("entryDialog")?.open);
  assert(await focusedId(page) === "entryActivate", "Escape closes the replace dialog and returns focus to the activation", await focusedId(page));
  const untouched = await page.evaluate(() => JSON.parse(localStorage.getItem("repforge_v1")).programMeta.name);
  assert(untouched === "Current block", "dismissing the replace dialog leaves the active program as it was", untouched);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const browser = await launchChromium();
  try {
    await runProgramEntryA11y(browser);
  } finally {
    await browser.close();
  }
  if (checks.failed) process.exitCode = 1;
  console.log(`\n${checks.passed} passed, ${checks.failed} failed`);
}
