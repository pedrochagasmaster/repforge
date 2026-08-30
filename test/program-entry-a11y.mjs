#!/usr/bin/env node
/** Named Plan 048 entry accessibility regression: semantics, keyboard, focus, and compact geometry. */
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

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await clean(page);

  assert(await page.locator("#onbBack").evaluate((el) => getComputedStyle(el).minHeight === "44px"), "Back has a 44px minimum target");
  assert((await page.locator("#onbBack").getAttribute("aria-label")) === "Back", "Back has an explicit accessible name");

  await page.click('[data-entry-route="custom"]');
  assert(!(await page.locator("#onbNext").isDisabled()), "required-answer Continue remains operable for validation");
  await page.click("#onbNext");
  assert(await page.locator("#entryValidation").isVisible(), "missing required answer is announced in an alert");
  assert(await page.locator("#entryValidation").evaluate((el) => el === document.activeElement), "validation alert receives focus");

  await page.click('[data-entry-pick="desiredResult"][data-entry-val="muscle_growth"]');
  assert(await page.locator('[data-entry-pick="desiredResult"][data-entry-val="muscle_growth"]').evaluate((el) => el.getAttribute("aria-checked") === "true" && !el.hasAttribute("aria-pressed")), "radio exposes aria-checked, not aria-pressed");
  await page.keyboard.press("ArrowDown");
  assert(await page.locator('[data-entry-pick="desiredResult"][data-entry-val="balanced"]').evaluate((el) => el.getAttribute("aria-checked") === "true" && el === document.activeElement), "radio arrows move selection and focus");

  await clean(page);
  await reachPriorities(page);
  const checkboxInfo = await page.locator('#onbBody [role="checkbox"]').evaluateAll((els) => els.map((el) => ({ tabIndex: el.tabIndex, checked: el.getAttribute("aria-checked"), pressed: el.getAttribute("aria-pressed") })));
  assert(checkboxInfo.length > 4 && checkboxInfo.every((item) => item.tabIndex >= 0 && item.pressed === null), "checkboxes remain independently tabbable with aria-checked");

  await page.locator('[data-entry-pick="primaryMuscles"][data-entry-val="chest"]').focus();
  const before = await page.evaluate(() => document.activeElement?.dataset.entryVal);
  await page.click('[data-entry-pick="primaryMuscles"][data-entry-val="chest"]');
  const after = await page.evaluate(() => document.activeElement?.dataset.entryVal);
  assert(before === "chest" && after === "chest", "selection rerender restores focus to the changed control");

  const geometry = await page.evaluate(() => {
    const root = document.querySelector("#onboarding");
    if (root) root.scrollTop = root.scrollHeight;
    const rect = document.querySelector(".onb__nav")?.getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, footerReachable: !!rect && rect.bottom <= window.innerHeight + 1 };
  });
  assert(geometry.overflow <= 0 && geometry.footerReachable, "320px entry has no horizontal overflow and footer remains reachable", JSON.stringify(geometry));
} finally {
  await browser.close();
}
if (checks.failed) process.exitCode = 1;
console.log(`\n${checks.passed} passed, ${checks.failed} failed`);
