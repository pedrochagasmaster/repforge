#!/usr/bin/env node
/** Named Plan 048 entry accessibility regression: semantics, keyboard, focus, and compact geometry. */
import { pathToFileURL } from "url";
import { launchChromium, waitForAppBoot, answerRecommend } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";
import { metricLogRow } from "./fixtures/history-metric-rows.mjs";

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


export async function runProgramEntryA11y(browser, check = assert) {
  const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
  try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await clean(page);

  check(await page.locator("#onbBack").evaluate((el) => getComputedStyle(el).minHeight === "44px"), "Back has a 44px minimum target");
  check((await page.locator("#onbBack").getAttribute("aria-label")) === "Back", "Back has an explicit accessible name");

  await page.locator('[data-entry-hub="recommend"]').focus();
  await page.keyboard.press("Enter");
  await page.click("#onbNext");
  // During navPush the outgoing screen remains mounted but is inert and
  // aria-hidden. Check focus on the one heading exposed by the live page.
  const transitionFocus = await page.locator(
    '#onbBody > .entry-motion-page:not([aria-hidden="true"]) #entryHeading',
  ).evaluate((el) => {
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

  // R7 J-16: the screen's title is exposed once. The legacy hidden #onbTitle must not repeat #entryHeading.
  const headingNames = await page.locator("#onboarding").getByRole("heading").allTextContents();
  const normalizedHeadings = headingNames.map((text) => text.replace(/\s+/g, " ").trim()).filter(Boolean);
  check(normalizedHeadings.length > 0 && new Set(normalizedHeadings).size === normalizedHeadings.length,
    "the entry screen exposes each heading once to assistive technology", JSON.stringify(normalizedHeadings));

  // Walk Recommend's Basics screens (skipping each) to "background", the
  // first substantive radiogroup in B's order (intro, sex, birth_date,
  // height, weight, background, ...).
  await answerRecommend(page, { skipBasics: true, until: "background" });
  // The walk clicked; a key press makes the next focus a keyboard focus.
  await page.keyboard.press("Tab");
  await page.locator('[data-entry-pick="structuredExperience"][data-entry-val="first"]').focus();
  const controlFocus = await page.locator('[data-entry-pick="structuredExperience"][data-entry-val="first"]').evaluate((el) => {
    const style = getComputedStyle(el);
    return { outlineStyle: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth) || 0 };
  });
  check(controlFocus.outlineStyle !== "none" && controlFocus.outlineWidth > 0,
    "keyboard-focused controls retain a visible ring", JSON.stringify(controlFocus));
  check(await page.locator("#onbNext").isDisabled(), "Continue is disabled until the experience question is answered");
  // R7 J-12: #onbStepLabel is aria-live. Answering a question must not rewrite it with the text it already has.
  await page.evaluate(() => {
    const label = document.querySelector("#onbStepLabel");
    window.__stepLabelWrites = 0;
    window.__stepLabelObserver?.disconnect();
    window.__stepLabelObserver = new MutationObserver((records) => { window.__stepLabelWrites += records.length; });
    window.__stepLabelObserver.observe(label, { childList: true, characterData: true, subtree: true });
  });
  await page.click('[data-entry-pick="structuredExperience"][data-entry-val="first"]');
  check(await page.evaluate(() => { window.__stepLabelObserver.takeRecords(); return window.__stepLabelWrites; }) === 0,
    "answering a question does not rewrite the live step label");
  check(!(await page.locator("#onbNext").isDisabled()), "answering the experience question enables Continue");
  check(await page.locator('[data-entry-pick="structuredExperience"][data-entry-val="first"]').evaluate((el) => el.getAttribute("aria-checked") === "true" && !el.hasAttribute("aria-pressed")), "radio exposes aria-checked, not aria-pressed");
  check(await page.getByRole("radio").count() === 4, "accessibility tree exposes the four background-experience radios");
  await page.keyboard.press("ArrowDown");
  check(await page.locator('[data-entry-pick="structuredExperience"][data-entry-val="under_6m"]').evaluate((el) => el.getAttribute("aria-checked") === "true" && el === document.activeElement), "radio arrows move selection and focus");
  await page.click("#onbNext");

  // cardio_experience: pinned Skip, no new assertions here.
  await page.click("#onbSkip");

  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "environment");
  check(await page.locator("#onbNext").isDisabled(), "Continue is disabled until the environment is answered");
  await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
  check(!(await page.locator("#onbNext").isDisabled()), "answering the environment enables Continue");
  await page.click("#onbNext");

  // equipment: optional multi-select, just pass through.
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "equipment");
  await page.click("#onbNext");

  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "desired_result");
  check(await page.locator("#onbNext").isDisabled(), "Continue is disabled until the desired result is answered");
  await page.click('[data-entry-pick="desiredResult"][data-entry-val="muscle_growth"]');
  check(!(await page.locator("#onbNext").isDisabled()), "answering the desired result enables Continue");
  check(await page.getByRole("radio").count() === 3, "accessibility tree exposes the three desired-result radios");
  await page.click("#onbNext");

  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "days_per_week");
  check(await page.locator("#onbNext").isDisabled(), "Continue is disabled when the days-per-week answer is missing");
  await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="3"]');
  check(!(await page.locator("#onbNext").isDisabled()), "answering days per week enables Continue");
  await page.click("#onbNext");

  // session_length: pre-populated with a 60-minute default, so Continue is
  // not gated here; click the option defensively and move on.
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "session_length");
  await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
  // session_length still has radio-card markup (.radio-card__title), so the
  // geometry/zoom/desktop-width checks below run on this screen rather than
  // advancing to muscle_priorities, which uses a different control shape.

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

  // A movement the catalog does not know becomes a custom movement that records
  // nothing yet, so the reviewed program cannot start until it is configured.
  await clean(page);
  await page.click('[data-entry-hub="import"]');
  await page.click("#onbNext");
  await page.setInputFiles("#importProgram", {
    name: "unconfigured-a11y.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      version: 3,
      meta: { name: "Unconfigured movement" },
      exercises: [{ day: "Day 1", order: 1, name: "Zerbulator 9000", sets: 3, min: 5, max: 8 }],
    })),
  });
  await page.waitForSelector("#importReview.active", { timeout: 10000 });
  await page.click('#importRows .improw.is-open [data-imp-act="custom"]');
  await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
  await page.locator("#exCustomEquip .pchip").first().click();
  await page.locator("#exCustomPrimary .pchip").first().click();
  await page.click("#exCustomSave");
  await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
  await page.click("#importCommit");
  await page.waitForSelector("#entryActivate", { timeout: 10000 });
  check(await page.locator("#entryActivationStatus").isVisible(), "an unconfigured preview exposes an activation alert");
  const activationFocus = await page.locator("#entryActivationStatus").evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      active: el === document.activeElement,
      focused: document.activeElement?.id || document.activeElement?.tagName,
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth) || 0,
    };
  });
  check(activationFocus.active, "an unconfigured preview focuses the activation alert on initial render", JSON.stringify(activationFocus));
  check(activationFocus.outlineStyle === "none" || activationFocus.outlineWidth === 0,
    "focused activation alert does not draw a ring", JSON.stringify(activationFocus));
  check(await page.locator("#entryActivate").isDisabled() &&
    (await page.locator("#entryActivate").getAttribute("aria-describedby")) === "entryActivationStatus",
  "an unconfigured preview keeps activation disabled with describedby guidance");

  await clean(page);
  await page.click('[data-entry-hub="import"]');
  await page.click("#onbNext");
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
  check(await page.locator(".radio-card").first().evaluate((el) => getComputedStyle(el).transitionDuration === "0s"), "reduced motion removes entry transitions");

  await runEntryDialogFocus(page, check);
  await runBControlsA11y(browser, check);
  } finally {
    await page.close();
  }
}

/** An active program (the 18-slot seed definition) with one logged set. */
const ACTIVE_META = seedProgramMeta({ id: "a11y-active", name: "Current block", started: "2026-08-01" });
const ACTIVE_SEED = {
  settings: { unit: "kg", lang: "en", jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120 },
  programMeta: ACTIVE_META,
  program: seedProgram(),
  log: [metricLogRow(ACTIVE_META, seedProgram()[0], { session: "a11y-session", date: "2026-08-29", set: 1, load: 50, reps: 8, rir: 2 })],
  programHistory: [], customExercises: [], _storageRevision: 7,
};

/** Import a one-exercise program and stop at the activation-ready review. */

/* Onboarding B's own controls (Plan 072): each picker is reachable and
   operable without a pointer and names itself. */
async function runBControlsA11y(browser, check) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await clean(page);
    await answerRecommend(page, { skipBasics: true, until: "birth_date" });
    const wheels = await page.$$eval("[role='spinbutton']", (els) => els.map((el) => ({
      label: el.getAttribute("aria-label"), now: el.getAttribute("aria-valuenow"), text: el.getAttribute("aria-valuetext"), tab: el.tabIndex })));
    check(wheels.length === 3 && wheels.every((w) => w.label && w.text && w.now != null && w.tab === 0),
      "the birth date is three named, focusable spinbuttons with a spoken value", JSON.stringify(wheels));
    await page.focus("#entryWheelMonth");
    const before = await page.locator("#entryWheelMonth").getAttribute("aria-valuetext");
    await page.keyboard.press("ArrowDown");
    const after = await page.locator("#entryWheelMonth").getAttribute("aria-valuetext");
    check(before !== after, "an arrow key moves a wheel and its spoken value", `${before} -> ${after}`);
    await page.click("#onbSkip");
    await answerRecommend(page, { skipBasics: true, until: "weight" });
    const ruler = await page.locator("#entryWeightRuler").evaluate((el) => ({ role: el.getAttribute("role"),
      label: el.getAttribute("aria-label"), text: el.getAttribute("aria-valuetext"), min: el.getAttribute("aria-valuemin"), max: el.getAttribute("aria-valuemax") }));
    check(ruler.role === "slider" && ruler.label && ruler.text && ruler.min && ruler.max, "the weight ruler is a named slider with a spoken value", JSON.stringify(ruler));
    await page.focus("#entryWeightRuler");
    await page.keyboard.press("ArrowRight");
    check(await page.locator("#entryWeightRuler").getAttribute("aria-valuetext") !== ruler.text, "an arrow key moves the ruler");
    const unit = await page.$$eval("[data-entry-pick='basicsWeightUnit']", (els) => els.map((el) => el.getAttribute("role")));
    check(unit.length === 2 && unit.every((role) => role === "radio"), "the weight unit toggle is a radio pair");
    await page.click("#onbSkip");
    await answerRecommend(page, { skipBasics: true, until: "equipment", environment: "limited_home" });
    const equipment = await page.$$eval("[data-entry-pick='equipmentGroup']", (els) => els.map((el) => ({ role: el.getAttribute("role"), checked: el.getAttribute("aria-checked") })));
    check(equipment.length === 13 && equipment.every((item) => item.role === "checkbox" && ["true", "false"].includes(item.checked)),
      "the equipment groups are thirteen checkboxes with their state", JSON.stringify(equipment));
    await answerRecommend(page, { skipBasics: true, until: "muscle_priorities", environment: "limited_home" });
    const groups = await page.$$eval(".entry-b__priority [role='radiogroup']", (els) => els.map((group) => ({
      name: document.getElementById(group.getAttribute("aria-labelledby"))?.textContent || "",
      radios: group.querySelectorAll("[role='radio']").length,
      checked: group.querySelectorAll("[role='radio'][aria-checked='true']").length })));
    check(groups.length === 12 && groups.every((group) => group.name && group.radios === 3 && group.checked === 1),
      "each of the twelve muscles is a labelled radio group of Reduce, Normal and Prioritize with one choice", JSON.stringify(groups.slice(0, 2)));
    const first = page.locator(".entry-b__priority [role='radiogroup']").first().locator("[role='radio'][aria-checked='true']");
    await first.focus();
    await page.keyboard.press("ArrowRight");
    const moved = await page.evaluate(() => window.__repforgeEntryState?.()?.answers?.primaryMuscles || []);
    check(moved.length === 1, "an arrow key on a muscle's group changes its priority", JSON.stringify(moved));
    await answerRecommend(page, { skipBasics: true, until: "deload", environment: "limited_home" });
    const toggle = await page.locator("#entryDeloadSwitch").evaluate((el) => ({ role: el.getAttribute("role"), checked: el.getAttribute("aria-checked"),
      name: document.getElementById(el.getAttribute("aria-labelledby"))?.textContent || "" }));
    check(toggle.role === "switch" && toggle.checked === "true" && toggle.name, "deload is a named switch, on by default", JSON.stringify(toggle));
    await page.focus("#entryDeloadSwitch");
    await page.keyboard.press("Space");
    check(await page.locator("#entryDeloadSwitch").getAttribute("aria-checked") === "false", "Space turns the deload switch off");
  } finally {
    await page.close();
  }
}

async function reachImportReview(page) {
  await page.click('[data-entry-hub="import"]');
  await page.click("#onbNext");
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
async function runEntryDialogFocus(page, assert) {
  await page.setViewportSize({ width: 390, height: 844 });
  await clean(page);

  // Cancel, opened from the hub's own Cancel control.
  await page.click("#onbCancel");
  await page.waitForSelector("#entryCancelKeep");
  assert(await dialogHasFocus(page), "the cancel dialog takes focus inside itself");
  assert(await page.getByRole("dialog").count() === 1, "the cancel dialog is exposed as a dialog");
  const band = await page.evaluate(() => {
    const vv = visualViewport;
    for (const [key, value] of Object.entries({ height: 280, offsetTop: 65, scale: 1 }))
      Object.defineProperty(vv, key, { configurable: true, value });
    vv.dispatchEvent(new Event("resize"));
    const dialog = document.getElementById("entryDialog");
    dialog.scrollTop = dialog.scrollHeight;
    const r = dialog.getBoundingClientRect(), action = dialog.lastElementChild.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, actionBottom: action.bottom, contain: getComputedStyle(dialog).overscrollBehaviorY };
  });
  assert(band.top >= 65 && band.bottom <= 345.5 && band.actionBottom <= band.bottom && band.contain === "contain",
    "the native cancel dialog and its last action fit the offset visible band", JSON.stringify(band));
  await page.evaluate(() => {
    for (const key of ["height", "offsetTop", "scale"]) delete visualViewport[key];
    visualViewport.dispatchEvent(new Event("resize"));
    document.getElementById("entryDialog").scrollTop = 0;
  });
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
