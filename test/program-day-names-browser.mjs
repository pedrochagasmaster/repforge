#!/usr/bin/env node
/**
 * Day names on a generated program: every surface shows the generator's
 * authored day names in authored order, a rename in the editor stays staged
 * until Done, and the lifter's exact name survives a language switch and a
 * reload. The program is the app's own generated four-day ProgramDefinition.
 */
import assert from "node:assert/strict";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";

const stored = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
const trainingDayNames = (state) =>
  state.programMeta.programDefinition.days.filter((day) => day.kind === "training").map((day) => day.name);
const dayTabs = (page) =>
  page.evaluate(() => [...document.querySelectorAll("#dayTabs button")].map((button) => button.textContent.trim()));

const browser = await launchChromium();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(() => localStorage.setItem("repforge_ui_v1", JSON.stringify({ tourDone: true })));
  const finalized = await page.evaluate(async () => {
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const request = window.RepForgeProgramEntryAdapter.programRequestFromAnswers({
      desiredResult: "muscle_growth", structuredExperience: "6_to_24m", daysPerWeek: 4,
      sessionMinutes: 60, environment: { kind: "commercial_gym" },
    }, catalog).value;
    const definition = window.RepForgeProgramCompiler.generateProgram(request, catalog, "day-names").value;
    const result = await window.__repforgeFinalizeProgramSetup({
      programDefinition: definition, name: "Generated browser fixture", answers: {}, destination: "log",
      origin: "first-run", draftConfirmed: true, telemetryRoute: "recommend",
      entrySource: { route: "recommend", fingerprint: "day-names" },
    });
    return { ok: result?.ok !== false };
  });
  assert.ok(finalized.ok, "the generated program activates");
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });

  const authored = trainingDayNames(await stored(page));
  assert.deepEqual(authored, ["Upper A", "Lower A", "Upper B", "Lower B"], "the generator authors the four-day split");
  assert.deepEqual(await dayTabs(page), authored, "the day tabs follow the authored day order");

  await page.click('nav button[data-view="program"]');
  assert.deepEqual(
    await page.evaluate(() => [...document.querySelectorAll("#programOverview .prog-day__title")].map((node) => node.textContent.trim())),
    authored,
    "the program overview follows the authored day order",
  );
  await page.click("#programEditToggle");
  assert.deepEqual(
    await page.evaluate(() => [...document.querySelectorAll("#programEditor .pday__name")].map((input) => input.value)),
    authored,
    "the editor follows the authored day order",
  );

  const firstDay = page.locator("#programEditor .pday__name").first();
  await firstDay.fill("My upper day");
  await firstDay.press("Enter");
  await page.waitForFunction(async () => {
    const debug = await window.__debugProgramEditor?.();
    return (debug?.session?.document?.program || []).some((row) => row.day === "My upper day");
  }, undefined, { timeout: 5000 });
  assert.deepEqual(trainingDayNames(await stored(page)), authored, "installed edits stay staged until Done");

  await page.click("#programEditToggle");
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"));
  const renamed = await stored(page);
  assert.deepEqual(trainingDayNames(renamed), ["My upper day", ...authored.slice(1)],
    "Done renames exactly that day in the canonical program");
  assert.ok(renamed.program.filter((row) => row.day === "My upper day").length > 0 &&
    !renamed.program.some((row) => row.day === authored[0]), "every row of the renamed day follows it");

  await page.evaluate(() => window.__repforgeShowSettings());
  await page.selectOption("#lang", "pt");
  await page.waitForFunction(() => /^pt/.test(document.documentElement.lang));
  const portuguese = await dayTabs(page);
  assert.equal(portuguese[0], "My upper day", "the lifter's own day name is never translated");
  assert.deepEqual(trainingDayNames(await stored(page)), ["My upper day", ...authored.slice(1)],
    "switching language rewrites no stored day name");

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  assert.deepEqual(await dayTabs(page), portuguese, "language and custom day name survive reload");
  await context.close();
  console.log("PASS browser day names: authored order and exact custom rename survive language switch and reload");
} finally {
  await browser.close();
}
