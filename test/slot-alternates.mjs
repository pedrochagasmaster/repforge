#!/usr/bin/env node
/**
 * #317: a slot's alternates are authored in the program editor, stored on the
 * canonical slot, and offered first when the lifter swaps that slot mid-workout.
 *
 * The journey runs on the production program: add, reorder and remove
 * alternates in the installed editor, apply, reload, start a workout, open the
 * swap picker and find the alternates as its first group in their authored
 * order. Swapping while a pending set holds typed values is refused and the
 * values stay; after that set is logged the swap applies and History credits
 * the movement that was performed.
 *
 * Run: node tools/run-tests.mjs workout --suite slot-alternates
 */
import { launchChromium } from "./browser.mjs";
import { exerciseAction, finishEarly } from "./fixtures/focus-workout.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const SLOT = "seed-ex-1";
// Leg press is already in the program, so it would otherwise list under
// "You've trained these"; the lat pulldown is not.
const LEG_PRESS = { id: "1a25c6f170d88079a926dde776766181", name: "45° leg press" };
const LAT = { id: "1a15c6f170d8800d8fc9d2c235673bf6", name: "Overhand grip cable lat pulldown" };
const FLY = { id: "1a05c6f170d880df946bdd6f42f0901c", name: "Horizontal cable fly" };
const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";

const failures = [];
let passed = 0;
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 1500)}`);
}

async function waitForApp(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(() => {
    window.closeFirstRun?.();
    if (document.querySelector("#onboarding")?.classList.contains("active")) window.closeOnboarding?.();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden")) window.closeTour?.();
  });
}

const durable = async (page) => {
  await page.evaluate(() => window.__repforgeStorage.flush());
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), KEY);
};
const storedAlternates = async (page) => (await durable(page)).programMeta?.programDefinition?.days
  ?.flatMap((day) => day.slots).find((slot) => slot.id === SLOT)?.alternates;
const editorAlternates = (page) => page.$$eval(
  `#programEditor [data-role="alternates"][data-id="${SLOT}"] [data-role="alternate"]`,
  (items) => items.map((item) => item.dataset.exerciseId));

async function pickExact(page, name) {
  await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
  await page.fill("#exPickSearch", name);
  const row = page.locator("#exPickList .pickrow").filter({ has: page.locator(".pickrow__name", { hasText: new RegExp(`^${name}$`, "i") }) });
  await row.first().waitFor({ timeout: 5000 });
  await row.first().click();
  await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
}

async function addAlternate(page, entry) {
  const before = (await editorAlternates(page)).length;
  await page.locator(`#programEditor [data-role="add-alternate"][data-id="${SLOT}"]`).click();
  await pickExact(page, entry.name);
  await page.waitForFunction(({ slot, count }) => document.querySelectorAll(
    `#programEditor [data-role="alternates"][data-id="${slot}"] [data-role="alternate"]`).length === count,
  { slot: SLOT, count: before + 1 }, { timeout: 5000 });
}

async function alternateControl(page, role, id) {
  const before = await editorAlternates(page);
  await page.locator(`#programEditor [data-role="alternates"][data-id="${SLOT}"] [data-role="${role}"][data-exercise-id="${id}"]`).click();
  await page.waitForFunction(({ slot, before }) => JSON.stringify([...document.querySelectorAll(
    `#programEditor [data-role="alternates"][data-id="${slot}"] [data-role="alternate"]`)].map((item) => item.dataset.exerciseId)) !== before,
  { slot: SLOT, before: JSON.stringify(before) }, { timeout: 5000 });
}

async function shelfFill(page, metricId, field, value) {
  const input = page.locator(`#workout .exercise.is-current .focus-shelf input[data-metric-id="${metricId}"]`);
  await input.waitFor({ state: "attached", timeout: 5000 });
  if (await input.getAttribute("aria-hidden") === "true")
    await page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field="${field}"]`).click();
  await input.waitFor({ state: "visible", timeout: 5000 });
  await input.fill(String(value));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

const pendingSet = (page) => page.evaluate((id) => {
  const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
  const set = exercise?.sets?.[exercise.setOrder[0]];
  return { completion: set?.completion, touched: set?.touched?.metrics, metrics: set?.edited?.metrics ?? null,
    substitution: exercise?.substitution?.replacement?.libraryId ?? null };
}, SLOT);

async function main() {
  console.log("#317 slot alternates: editor → reload → swap picker → History");
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  page.on("dialog", (dialog) => dialog.accept());
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await installSeedProgram(page, { key: KEY, waitFor: waitForApp });

    // 1. Author alternates in the installed editor ----------------------------
    await page.click('nav button[data-view="program"]');
    await page.waitForSelector("#program.view.active");
    await page.click("#programEditToggle");
    await page.waitForSelector("#programEditorWrap:not(.is-hidden)");
    const toggle = page.locator(`#programEditor [data-role="toggle-exercise"][data-id="${SLOT}"]`);
    if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
    await page.waitForSelector(`#programEditor [data-role="alternates"][data-id="${SLOT}"]`, { timeout: 5000 });
    check(await page.locator(`#programEditor [data-role="add-alternate"][data-id="${SLOT}"]`).isVisible(),
      "an expanded exercise offers Add alternate");
    await addAlternate(page, LAT);
    await addAlternate(page, LEG_PRESS);
    await addAlternate(page, FLY);
    check(JSON.stringify(await editorAlternates(page)) === JSON.stringify([LAT.id, LEG_PRESS.id, FLY.id]),
      "added alternates list in the order they were chosen", await editorAlternates(page));
    const names = await page.$$eval(`#programEditor [data-role="alternates"][data-id="${SLOT}"] [data-role="alternate"]`,
      (items) => items.map((item) => item.querySelector("[data-role=alternate-name]")?.textContent?.trim()));
    check(names[0] === LAT.name && names[1] === LEG_PRESS.name, "each alternate is named by its movement", names);
    await alternateControl(page, "alternate-up", LEG_PRESS.id);
    check(JSON.stringify(await editorAlternates(page)) === JSON.stringify([LEG_PRESS.id, LAT.id, FLY.id]),
      "Move up reorders an alternate", await editorAlternates(page));
    await alternateControl(page, "alternate-remove", FLY.id);
    check(JSON.stringify(await editorAlternates(page)) === JSON.stringify([LEG_PRESS.id, LAT.id]),
      "Remove drops an alternate", await editorAlternates(page));
    check(await storedAlternates(page) === undefined, "alternates stay staged until the editor is applied");
    await page.click("#programEditToggle");
    await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), undefined, { timeout: 10000 });
    check(JSON.stringify(await storedAlternates(page)) === JSON.stringify([LEG_PRESS.id, LAT.id]),
      "Done stores the alternates on the canonical slot", await storedAlternates(page));

    // 2. They survive a reload ------------------------------------------------
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    check(JSON.stringify(await storedAlternates(page)) === JSON.stringify([LEG_PRESS.id, LAT.id]),
      "the alternates survive a reload", await storedAlternates(page));

    // 3. The swap picker lists them first --------------------------------------
    await page.evaluate(() => document.querySelector('nav button[data-view="log"]')?.click());
    await page.evaluate(() => window.__repforgeEnterWorkout?.({}));
    await page.waitForSelector("#workout .exercise", { timeout: 5000 });
    await shelfFill(page, WEIGHT, `metric_${WEIGHT}`, 140);
    await shelfFill(page, REPS, `metric_${REPS}`, 8);
    const typed = await pendingSet(page);
    check(typed.completion === "pending" && typed.touched?.[WEIGHT] === true && Number(typed.metrics?.[WEIGHT]) === 140,
      "the first set holds typed values and is still pending", typed);
    await exerciseAction(page, SLOT, "#exActionSubstBtn");
    await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
    const picker = await page.evaluate(() => {
      const list = document.querySelector("#exPickList");
      const first = list.querySelector(".pick__section");
      const rows = [];
      for (let node = first?.nextElementSibling; node && !node.classList.contains("pick__section"); node = node.nextElementSibling)
        if (node.classList.contains("pickrow")) rows.push(node.dataset.pick);
      return { heading: first?.textContent?.trim(), rows,
        repeated: [...list.querySelectorAll(".pickrow")].map((row) => row.dataset.pick) };
    });
    check(picker.heading === "Alternates", "the swap picker's first group is Alternates", picker);
    check(JSON.stringify(picker.rows) === JSON.stringify([LEG_PRESS.id, LAT.id]),
      "the group lists the slot's alternates in their authored order", picker);
    check(picker.repeated.filter((id) => id === LEG_PRESS.id).length === 1,
      "an alternate is not listed a second time in a later group", picker.repeated);

    // 4. Typed values are protected -------------------------------------------
    await page.locator(`#exPickList .pickrow[data-pick="${LAT.id}"]`).click();
    await page.waitForFunction(() => /Clear the values you.ve entered/.test(document.querySelector("#toast")?.textContent || ""), undefined, { timeout: 10000 });
    await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
    const afterRefusal = await pendingSet(page);
    check(afterRefusal.substitution === null && afterRefusal.completion === "pending" &&
      JSON.stringify(afterRefusal.metrics) === JSON.stringify(typed.metrics) && afterRefusal.touched?.[WEIGHT] === true,
      "swapping over typed values is refused and the values stay", { typed, afterRefusal });

    // 5. Log the set, then swap to the alternate --------------------------------
    await shelfFill(page, WEIGHT, `metric_${WEIGHT}`, 140);
    await page.locator(`#workout .exercise.is-current [data-save="${SLOT}_1"]`).click();
    await page.waitForFunction((id) => {
      const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
      const completion = exercise?.sets?.[exercise.setOrder[0]]?.completion;
      return !!completion && completion !== "pending";
    }, SLOT, { timeout: 15000 });
    await exerciseAction(page, SLOT, "#exActionSubstBtn");
    await page.waitForSelector(`#exPickList .pickrow[data-pick="${LAT.id}"]`, { timeout: 5000 });
    await page.locator(`#exPickList .pickrow[data-pick="${LAT.id}"]`).click();
    await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
    await page.waitForFunction(({ id, lat }) => window.__repforgeWorkoutDraft.current()?.exercises?.[id]
      ?.substitution?.replacement?.libraryId === lat, { id: SLOT, lat: LAT.id }, { timeout: 10000 });
    check((await page.locator(`#workout .exercise[data-ex="${SLOT}"] .focus-ex__name`).textContent()).includes(LAT.name),
      "picking an alternate swaps the slot to it");
    await shelfFill(page, WEIGHT, `metric_${WEIGHT}`, 55);
    await shelfFill(page, REPS, `metric_${REPS}`, 10);
    await page.locator(`#workout .exercise.is-current [data-save="${SLOT}_2"]`).click();
    await page.waitForFunction((id) => {
      const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
      const completion = exercise?.sets?.[exercise.setOrder[1]]?.completion;
      return !!completion && completion !== "pending";
    }, SLOT, { timeout: 15000 });
    await finishEarly(page);
    await page.waitForSelector("#sessionSummary:not(.hidden)");
    await page.evaluate(() => window.__repforgeSessionSummary.close());

    // 6. History credits what was performed --------------------------------------
    const log = (await durable(page)).log.filter((row) => row.exerciseId === SLOT);
    const first = log.find((row) => +row.set === 1), second = log.find((row) => +row.set === 2);
    check(first && first.performedLibraryId !== LAT.id && +first.load === 140,
      "the set logged before the swap keeps the slot's own movement", first);
    check(second?.performedLibraryId === LAT.id && second?.performedName === LAT.name && +second.load === 55,
      "the set logged after the swap records the alternate as performed", second);
    await page.click('nav button[data-view="history"]');
    await page.waitForSelector("#history.view.active");
    await page.locator("#sessions [data-sess] .session__open").first().click();
    await page.waitForSelector(".session--read", { timeout: 5000 });
    const reading = await page.locator(".session--read").innerText();
    check(reading.includes(LAT.name), "the History session names the alternate that was performed", reading.slice(0, 600));

    // 7. A custom movement that is only an alternate is still in use --------------
    //    Deleting it would strand the slot's alternate; it is archived instead.
    const custom = await page.evaluate(async () => (await window.__repforgeSaveCustomExercise({
      name: "Coach landmine press", equipment: [], primary: "", secondary: "", notes: "" })).entry);
    check(custom?.id?.startsWith("custom:"), "a custom movement is saved", custom);
    await page.click('nav button[data-view="program"]');
    await page.waitForSelector("#program.view.active");
    await page.click("#programEditToggle");
    await page.waitForSelector("#programEditorWrap:not(.is-hidden)");
    if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
    await addAlternate(page, { name: custom.name });
    await page.click("#programEditToggle");
    await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), undefined, { timeout: 10000 });
    check(JSON.stringify(await storedAlternates(page)) === JSON.stringify([LEG_PRESS.id, LAT.id, custom.id]),
      "a custom movement can be an alternate", await storedAlternates(page));
    await page.evaluate((id) => window.__repforgeEditCustom(id), custom.id);
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
    check(/Archive/.test(await page.locator("#exCustomDelete").textContent()),
      "a custom movement used only as an alternate offers Archive, not Delete", await page.locator("#exCustomDelete").textContent());
    await page.locator("#exCustomDelete").click();
    await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 10000 });
    const afterArchive = await durable(page);
    check(afterArchive.customExercises.find((entry) => entry.id === custom.id)?.archived === true &&
      JSON.stringify(await storedAlternates(page)) === JSON.stringify([LEG_PRESS.id, LAT.id, custom.id]),
      "archiving keeps the definition the alternate names", afterArchive.customExercises);
    check(errors.length === 0, "no page errors", errors);
  } finally {
    await context.close();
    await browser.close();
  }
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => { console.error(error); process.exit(1); });
