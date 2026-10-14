#!/usr/bin/env node
/** Plan 072: production-backed Basics picker contract. */
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const failures = [];
let passed = 0;

function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 2000)}`);
}

const entry = (page) => page.evaluate(() => window.__repforgeEntryState?.());

async function fresh(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await page.locator('[data-entry-hub="recommend"]').click();
  await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "intro", undefined, { timeout: 10000 });
  await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "sex", undefined, { timeout: 10000 });
  await page.click("#onbSkip");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "birth_date", undefined, { timeout: 10000 });
  return { context, page, errors };
}

async function go(page, nextStep) {
  await page.click("#onbNext");
  await page.waitForFunction((step) => window.__repforgeEntryState?.()?.step === step, nextStep, { timeout: 10000 });
}

async function skip(page, nextStep) {
  await page.click("#onbSkip");
  await page.waitForFunction((step) => window.__repforgeEntryState?.()?.step === step, nextStep, { timeout: 10000 });
}

async function reloadResume(page, step) {
  // The step's setup-draft write queues behind the storage lock after the
  // in-memory step has moved. Reloading first resumes the previous step (#393).
  await page.evaluate(() => window.__repforgeStorage.flush());
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  if (!await page.locator("#onboarding.active").count()) await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryResumeContinue", { timeout: 10000 });
  await page.click("#entryResumeContinue");
  await page.waitForFunction((expected) => window.__repforgeEntryState?.()?.step === expected, step, { timeout: 10000 });
}

async function tapWheelCenter(page, selector) {
  const box = await page.locator(selector).boundingBox();
  await page.locator(selector).tap({ position: { x: Math.round(box.width / 2), y: Math.round(box.height / 2) } });
}

async function typeDialog(page, trigger, label, proofLabel) {
  await trigger();
  const dialogs = page.getByRole("dialog");
  const dialog = dialogs.last();
  const input = dialog.getByRole("textbox", { name: label });
  const open = await dialogs.count() === 1 && await input.count() === 1;
  check(open, proofLabel, { dialogCount: await dialogs.count(), inputCount: await input.count() });
  return open ? { dialog, input } : null;
}

async function confirmTyped(dialog) {
  await dialog.getByRole("button", { name: /done|concluir/i }).click();
}

async function untouchedContinue(browser) {
  console.log("\nPlan 072 §3.2: Continue stores displayed picker defaults; Skip leaves them unset");
  const run = await fresh(browser);
  const { page } = run;
  const shown = await page.evaluate(() => ({
    day: document.querySelector("#entryWheelDay")?.getAttribute("aria-valuetext"),
    month: document.querySelector("#entryWheelMonth")?.getAttribute("aria-valuetext"),
    year: document.querySelector("#entryWheelYear")?.getAttribute("aria-valuetext"),
  }));
  check(shown.day === "14" && shown.year === "1993" && /may/i.test(shown.month || ""),
    "the untouched birth wheel displays the neutral date", shown);
  await go(page, "height");
  let basics = (await entry(page)).answers.basics;
  check(basics?.birthDate === "1993-05-14",
    "Continue commits the displayed birth date without a wheel movement", basics);

  await reloadResume(page, "height");
  basics = (await entry(page)).answers.basics;
  check(basics?.birthDate === "1993-05-14", "the continued date survives reload", basics);
  await page.click("#onbBack");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "birth_date", undefined, { timeout: 10000 });
  check(await page.locator("#entryWheelYear").getAttribute("aria-valuetext") === "1993" &&
    await page.locator("#entryWheelDay").getAttribute("aria-valuetext") === "14",
  "Back restores the date Continue saved");

  await skip(page, "height");
  check(!Object.hasOwn((await entry(page)).answers.basics || {}, "birthDate"),
    "Skip leaves the birth date unset");
  await go(page, "weight");
  basics = (await entry(page)).answers.basics;
  check(basics?.heightCm === 174 && basics?.heightUnit === "cm",
    "Continue commits the displayed untouched height in centimeters", basics);
  await reloadResume(page, "weight");
  basics = (await entry(page)).answers.basics;
  check(basics?.heightCm === 174, "the continued height survives reload", basics);
  await go(page, "background");
  basics = (await entry(page)).answers.basics;
  check(basics?.weightKg === 80.5 && basics?.weightUnit === "kg",
    "Continue commits the displayed untouched weight in kilograms", basics);
  check(run.errors.length === 0, "no page errors in the untouched-picker journey", run.errors);
  await run.context.close();
}

async function typedFallback(browser) {
  console.log("\nPlan 072 §11.2: tap-to-type fallback for every Basics wheel and ruler value");
  const run = await fresh(browser);
  const { page } = run;
  let typed = await typeDialog(page, () => tapWheelCenter(page, "#entryWheelYear"), /year|ano/i,
    "tapping the displayed year opens a labeled typed-value field");
  if (!typed) { await run.context.close(); return; }
  await typed.input.fill("1800");
  await confirmTyped(typed.dialog);
  check(await typed.dialog.isVisible() && !(await entry(page)).answers.basics?.birthDate,
    "an out-of-range typed year cannot commit");
  check(await typed.input.getAttribute("aria-invalid") === "true" &&
    await typed.dialog.getByRole("status").isVisible(),
    "an invalid typed year stays focused and exposes its validation message");
  await typed.input.fill("1988");
  await confirmTyped(typed.dialog);
  await page.waitForFunction(() => !document.querySelector("dialog[open]"), undefined, { timeout: 5000 });

  for (const [selector, label, value] of [
    ["#entryWheelMonth", /month|mês/i, "2"],
    ["#entryWheelDay", /day|dia/i, "29"],
  ]) {
    typed = await typeDialog(page, () => tapWheelCenter(page, selector), label,
    `the ${String(label).toLowerCase()} wheel accepts typed values`);
    if (!typed) { await run.context.close(); return; }
    await typed.input.fill(value);
    await confirmTyped(typed.dialog);
    await page.waitForFunction(() => !document.querySelector("dialog[open]"), undefined, { timeout: 5000 });
  }
  await go(page, "height");
  await reloadResume(page, "height");
  check((await entry(page)).answers.basics?.birthDate === "1988-02-29",
    "typed date columns commit and reload a valid leap date", (await entry(page)).answers.basics);

  typed = await typeDialog(page, () => tapWheelCenter(page, "#entryWheelCm"), /centimeters|centímetros/i,
    "the centimeters wheel accepts typed values");
  if (!typed) { await run.context.close(); return; }
  await typed.input.fill("999");
  await confirmTyped(typed.dialog);
  check(await typed.dialog.isVisible() && !(await entry(page)).answers.basics?.heightCm,
    "an out-of-range typed height cannot commit");
  await typed.input.fill("172");
  await confirmTyped(typed.dialog);
  await page.waitForFunction(() => !document.querySelector("dialog[open]"), undefined, { timeout: 5000 });
  await go(page, "weight");
  let basics = (await entry(page)).answers.basics;
  check(basics?.heightCm === 172 && basics?.heightUnit === "cm",
    "typed centimeters commit in canonical centimeters", basics);
  await reloadResume(page, "weight");
  basics = (await entry(page)).answers.basics;
  check(basics?.heightCm === 172 && basics?.heightUnit === "cm",
    "typed centimeters survive reload", basics);

  await page.click("#onbBack");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "height", undefined, { timeout: 10000 });
  await page.getByRole("radio", { name: /feet and inches|pés e polegadas/i }).tap();
  for (const [selector, label, value] of [["#entryWheelFt", "Feet", "5"], ["#entryWheelIn", "Inches", "8"]]) {
    typed = await typeDialog(page, () => tapWheelCenter(page, selector), label,
      `${label.toLowerCase()} accepts typed values`);
    if (!typed) { await run.context.close(); return; }
    await typed.input.fill(value);
    await confirmTyped(typed.dialog);
    await page.waitForFunction(() => !document.querySelector("dialog[open]"), undefined, { timeout: 5000 });
  }
  await go(page, "weight");
  basics = (await entry(page)).answers.basics;
  check(basics?.heightCm === 173 && basics?.heightUnit === "ftin",
    "typed feet and inches convert into the canonical centimeter value", basics);
  await reloadResume(page, "weight");
  basics = (await entry(page)).answers.basics;
  check(basics?.heightCm === 173 && basics?.heightUnit === "ftin",
    "typed feet and inches survive reload in canonical centimeters", basics);

  const kgButton = page.getByRole("button", { name: /weight in kg|peso em kg/i });
  typed = await typeDialog(page, async () => {
    if (!await kgButton.count()) return;
    await kgButton.tap();
  }, /weight in kg|peso em kg/i, "tapping the weight readout opens a labeled typed-value field");
  if (!typed) { await run.context.close(); return; }
  await typed.input.fill("250");
  await confirmTyped(typed.dialog);
  check(await typed.dialog.isVisible() && !(await entry(page)).answers.basics?.weightKg,
    "an out-of-range typed weight cannot commit");
  await typed.input.fill("70,4");
  await confirmTyped(typed.dialog);
  await page.waitForFunction(() => !document.querySelector("dialog[open]"), undefined, { timeout: 5000 });
  await go(page, "background");
  basics = (await entry(page)).answers.basics;
  check(basics?.weightKg === 70.4, "typed localized kilograms commit accurately", basics);
  await reloadResume(page, "background");
  check((await entry(page)).answers.basics?.weightKg === 70.4,
    "typed kilograms survive reload", (await entry(page)).answers.basics);
  check(run.errors.length === 0, "no page errors in the typed kilogram/date/height journey", run.errors);
  await run.context.close();

  const pounds = await fresh(browser);
  await skip(pounds.page, "height");
  await skip(pounds.page, "weight");
  await pounds.page.getByRole("radio", { name: /pounds|libras/i }).tap();
  const lbButton = pounds.page.getByRole("button", { name: /weight in lb|peso em lb/i });
  typed = await typeDialog(pounds.page, async () => {
    if (!await lbButton.count()) return;
    await lbButton.tap();
  }, /weight in lb|peso em lb/i, "the pounds ruler accepts typed values");
  if (!typed) { await pounds.context.close(); return; }
  await typed.input.fill("65");
  await confirmTyped(typed.dialog);
  check(await typed.dialog.isVisible() && !(await entry(pounds.page)).answers.basics?.weightKg,
    "a pounds value below the ruler range cannot commit");
  await typed.input.fill("180.2");
  await confirmTyped(typed.dialog);
  await pounds.page.waitForFunction(() => !document.querySelector("dialog[open]"), undefined, { timeout: 5000 });
  await go(pounds.page, "background");
  basics = (await entry(pounds.page)).answers.basics;
  check(basics?.weightUnit === "lb" && Math.abs(basics.weightKg - 81.7) < 0.06,
    "typed pounds convert to canonical kilograms", basics);
  await reloadResume(pounds.page, "background");
  check(Math.abs((await entry(pounds.page)).answers.basics?.weightKg - 81.7) < 0.06,
    "typed pounds survive reload as the canonical kilogram value", (await entry(pounds.page)).answers.basics);
  check(pounds.errors.length === 0, "no page errors in the typed pounds journey", pounds.errors);
  await pounds.context.close();
}

async function main() {
  const browser = await launchChromium();
  try {
    await untouchedContinue(browser);
    await typedFallback(browser);
  } catch (error) {
    failures.push(String(error?.stack || error));
    console.error(error?.stack || error);
  } finally {
    await browser.close();
  }
  console.log(`\nPlan 072 picker contract: ${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exitCode = 1;
}

await main();
