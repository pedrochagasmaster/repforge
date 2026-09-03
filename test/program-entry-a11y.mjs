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

  await page.click('[data-entry-route="custom"]');
  check(await page.locator("#onbNext").isDisabled(), "Continue is disabled until the desired result is answered");

  await page.click('[data-entry-pick="desiredResult"][data-entry-val="muscle_growth"]');
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
  check(await page.locator("#entryActivationStatus").evaluate((el) => el === document.activeElement),
    "future strategy preview focuses the activation alert on initial render");
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
  } finally {
    await page.close();
  }
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
