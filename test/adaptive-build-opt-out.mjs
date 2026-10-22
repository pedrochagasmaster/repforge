#!/usr/bin/env node
/**
 * P069-S4-OFF: an opted-in Build slot through the installed Program editor.
 *
 * Range and RIR edits keep the slot adaptive (D3). Turning Suggest loads off
 * and pressing Apply returns every set in every cycle to manual and keeps every
 * value the lifter typed; Focus, Today and Why then read the manual result
 * with the accepted S1 copy. Turning it back on is refused at Done while the
 * RIR is missing, with the error on that field, and confirmed once it is given.
 * Plan 074: the controls are the exercise's sheet and its Weeks table.
 *
 * Run: node tools/run-tests.mjs entry --suite-id test-adaptive-build-opt-out-mjs
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { buildProgram, durableSlot, openInstalledEditor } from "./adaptive-build-fixture.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const failures = [];
let passed = 0;
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${JSON.stringify(detail).slice(0, 3000)}`);
}

const settled = (page) => page.waitForSelector('#programEditor [data-role="editor"][data-layout="review"]:not([aria-busy="true"])', { timeout: 10000 });

/** Apply from the pinned bar; a refusal keeps the editor open. */
async function pressApply(page) {
  if (await page.locator("#reviewSheet.is-open").count()) {
    await page.locator('#reviewSheet [data-role="sheet-done"]').click();
    await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 5000 });
  }
  await page.locator("#programEditDone").click();
}

async function done(page) {
  await pressApply(page);
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"),
    undefined, { timeout: 10000 });
  await page.evaluate(() => window.__repforgeStorage.flush());
}

const optInRir = (page) => page.locator('#reviewSheet [data-role="suggest-loads-rir-step-value"]').textContent();

async function commitField(input, value) {
  await input.fill(String(value));
  await input.press("Tab");
}

const browser = await launchChromium();
let context;
try {
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", locale: "en-US", timezoneId: "UTC" });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error?.stack || error)));
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00.000Z"));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  const { row: programRow, slotId } = await buildProgram(page, { optInRir: 2 });
  const start = await durableSlot(page);
  check(start.statuses.join() === "ready" && start.policies.join() === "manual/manual-adaptive@1",
    "the Build fixture starts with the bench slot opted in", start);

  // D3: a range edit and an RIR edit keep the slot adaptive.
  let row = await openInstalledEditor(page);
  check(await row.locator('[data-role="suggest-loads"]').getAttribute("aria-checked") === "true",
    "the installed editor shows the opted-in slot's switch on");
  // Week 1's first set, in the Weeks table.
  await row.locator('[data-role="weeks-open"]').click();
  await page.locator('#reviewSheet [data-role="week-row"][data-cycle-index="1"]').click();
  await commitField(page.locator('#reviewSheet [data-role="metric-target"][data-cycle-index="1"][data-set-index="1"][data-semantic="reps"]'), "6–12");
  await settled(page);
  await commitField(page.locator('#reviewSheet [data-role="prescription-field"][data-cycle-index="1"][data-set-index="1"][data-field="rir"]'), 3);
  await settled(page);
  await page.locator('#reviewSheet [data-role="weeks-back"]').click();
  // A set added to an adaptive slot joins it with the slot's RIR.
  await page.locator('#reviewSheet [data-role="sets-step"][data-delta="1"]').click();
  await page.waitForFunction(() => /^4\b/.test(document.querySelector('#reviewSheet [data-role="sets-step-value"]')?.textContent?.trim() || ""),
    undefined, { timeout: 5000 });
  await settled(page);
  await done(page);
  const edited = await durableSlot(page);
  const cycleOne = edited.slot?.prescriptionsByCycle?.find((cycle) => cycle.cycleIndex === 1)?.sets || [];
  check(edited.statuses.join() === "ready" && edited.targets[0]?.max === 12 && edited.rirs[0] === 3
    && edited.rirs.slice(1).every((value) => value === 2) && cycleOne.length === 4,
  "range, RIR and set-count edits are saved and keep every set adaptive", edited);

  // Off: manual everywhere, typed values kept.
  row = await openInstalledEditor(page);
  await row.locator('[data-role="suggest-loads"]').click();
  await page.waitForFunction(() => document.querySelector('#reviewSheet [data-role="suggest-loads"][aria-checked="false"]'),
    undefined, { timeout: 5000 });
  await done(page);
  const off = await durableSlot(page);
  check(off.statuses.join() === "manual" && off.policies.join() === "manual/manual@1",
    "switching Suggest loads off returns every set in every cycle to manual", off);
  check(JSON.stringify(off.rirs) === JSON.stringify(edited.rirs) && JSON.stringify(off.targets) === JSON.stringify(edited.targets),
    "switching off keeps every RIR and rep target the lifter set", { off, edited });

  // Focus, Today and Why read the same manual engine result.
  await page.click('nav button[data-view="log"]');
  const today = await page.waitForFunction((id) => {
    const node = document.querySelector(`#todayDash .rxrow[data-exopen="${CSS.escape(id)}"]`);
    return node ? {
      target: node.querySelector(".rxrow__target")?.textContent?.replace(/\s+/g, " ").trim() || "",
      load: node.querySelector(".rxrow__load")?.textContent?.trim() || "",
    } : null;
  }, programRow.id, { timeout: 10000 }).then((handle) => handle.jsonValue()).catch(() => null);
  check(today?.target === "4 × 6–12" && today.load === "–",
    "Today shows the manual sets × range with no load", today);
  const truth = await page.evaluate((id) => {
    const rec = window.__repforgeProgression.recommendation(window.__repforgeProgression.programSlot(id));
    return { status: rec?.status, engineStatus: rec?.engineStatus, load: rec?.load ?? null };
  }, programRow.id);
  check(truth.status === "manual" && truth.engineStatus === "manual" && truth.load == null,
    "the engine reports the slot as manual with no load", truth);
  await page.evaluate((day) => window.__repforgeEnterWorkout({ day }), programRow.day);
  await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 10000 });
  const cue = await page.evaluate(() => ({
    line1: document.querySelector("#workout .exercise.is-current .fx-cue__l1")?.textContent?.trim() || "",
    line2: document.querySelector("#workout .exercise.is-current .fx-cue__l2")?.textContent?.trim() || "",
  }));
  check(cue.line1 === "Your targets" && cue.line2 === "6–12 reps", "Focus shows Your targets for the manual slot", cue);
  await page.locator("#workout .exercise.is-current [data-why]").first().click();
  await page.waitForSelector("#whySheet.is-open", { timeout: 5000 });
  const why = (await page.locator("#whyBody").innerText()).trim();
  check(why.includes("This exercise has a rep range, but Taurifer does not suggest a load."),
    "Why gives the accepted manual explanation", why);
  await page.locator("#whyClose").click();
  await page.waitForSelector("#whySheet", { state: "hidden", timeout: 5000 });

  // On again: the mixed RIRs leave the field empty, so Done refuses at it.
  await page.evaluate(() => window.__repforgeLeaveWorkout());
  await page.locator('nav button[data-view="program"]').waitFor({ state: "visible", timeout: 10000 });
  row = await openInstalledEditor(page);
  await row.locator('[data-role="suggest-loads"]').click();
  await page.locator('#reviewSheet [data-role="suggest-loads-rir-step-value"]').waitFor({ timeout: 5000 });
  await settled(page);
  check(await optInRir(page) === "–", "with mixed set RIRs the opt-in RIR starts empty", await optInRir(page));
  await pressApply(page);
  await page.waitForFunction(() =>
    document.querySelector('#reviewSheet [data-role="suggest-loads-rir-step"]')?.getAttribute("aria-invalid") === "true",
  undefined, { timeout: 5000 }).catch(() => {});
  const refused = await page.evaluate(() => {
    const input = document.querySelector('#reviewSheet [data-role="suggest-loads-rir-step"]');
    return {
      editorOpen: !document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"),
      invalid: input?.getAttribute("aria-invalid"),
      note: document.getElementById(input?.getAttribute("aria-describedby") || "")?.getAttribute("role") || null,
      focused: document.activeElement === input,
    };
  });
  const stillOff = await durableSlot(page);
  check(refused.editorOpen && refused.invalid === "true" && refused.note === "alert" && refused.focused
    && stillOff.statuses.join() === "manual",
  "Apply refuses an incomplete opt-in in the installed editor and commits nothing", { refused, stillOff });
  // From an empty RIR the stepper starts at 2: one step down gives 1.
  await page.locator('#reviewSheet [data-role="suggest-loads-rir-step"][data-delta="-1"]').click();
  await settled(page);
  await done(page);
  const on = await durableSlot(page);
  check(on.statuses.join() === "ready" && on.rirs.every((value) => value === 1) && on.policies.join() === "manual/manual-adaptive@1"
    && on.targets[0]?.max === 12,
  "Apply confirms the completed opt-in with the chosen RIR on every set, keeping the edited range", on);

  // Another tab replaces the movement while this tab holds a staged opt-in:
  // Done must surface the conflict, not opt the new movement in.
  row = await openInstalledEditor(page);
  await row.locator('[data-role="suggest-loads"]').click();
  await page.waitForFunction(() => document.querySelector('#reviewSheet [data-role="suggest-loads"][aria-checked="false"]'),
    undefined, { timeout: 5000 });
  await done(page);
  row = await openInstalledEditor(page);
  await row.locator('[data-role="suggest-loads"]').click();
  await settled(page);
  check(await optInRir(page) === "1",
    "the staged opt-in reuses the slot's shared RIR, so the switch is its only edit");
  const other = await context.newPage();
  await other.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(other, { base: BASE });
  const otherRow = await openInstalledEditor(other);
  await otherRow.locator('[data-role="swap-open"]').click();
  await other.locator('#reviewSheet [data-role="swap-search"]').click();
  await other.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
  await other.fill("#exPickSearch", "Barbell back squat");
  await other.locator('#exPickList [data-pick="1a25c6f170d8803d8231d083fdd65458"]').click();
  await other.waitForFunction(() => [...document.querySelectorAll('#programEditor [data-role="exercise-row"]')]
    .some((node) => node.textContent.includes("Barbell back squat")), undefined, { timeout: 10000 });
  await settled(other);
  await done(other);
  await other.close();
  await pressApply(page);
  await page.waitForFunction(() => /another tab/i.test(document.querySelector('#programEditor [data-role="editor-status"]')?.textContent || "")
    || document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), undefined, { timeout: 10000 }).catch(() => {});
  const raced = await page.evaluate(() => ({
    editorOpen: !document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"),
    status: document.querySelector('#programEditor [data-role="editor-status"]')?.textContent || "",
    alerts: [...document.querySelectorAll('#programEditor [role="alert"], dialog[open]')].map((node) => node.id || node.textContent.trim().slice(0, 80)),
    toast: document.querySelector("#toast")?.textContent || "",
  }));
  const squat = await durableSlot(page, "1a25c6f170d8803d8231d083fdd65458");
  check(raced.editorOpen && /another tab/i.test(raced.status) && squat.statuses.join() === "manual",
    "a staged opt-in replayed over another tab's movement change is a conflict; the new movement stays manual", { raced, squat: squat.statuses });
  check(pageErrors.length === 0, "the opt-out journey has no uncaught browser errors", pageErrors);
} catch (error) {
  failures.push(String(error?.stack || error));
  console.error(error?.stack || error);
} finally {
  await context?.close();
  await browser.close();
}

console.log(`\nP069-S4-OFF: ${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
