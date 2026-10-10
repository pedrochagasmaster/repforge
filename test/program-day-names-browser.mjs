#!/usr/bin/env node
/**
 * Day names on a generated program: every surface shows the generator's
 * authored day names in authored order and in the app language (#316), while
 * storage keeps the language-independent authored names. A rename in the
 * editor stays staged until Done, and the lifter's exact name survives a
 * language switch and a reload. The program is the app's own generated
 * four-day ProgramDefinition, generated on a Portuguese device.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { definitionSlot, installGeneratedProgram, isWeightRepsSlot, metricLogRow } from "./fixtures/history-metric-rows.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const EN = JSON.parse(readFileSync(new URL("../i18n-en.json", import.meta.url), "utf8"));
const PT = JSON.parse(readFileSync(new URL("../i18n-pt.json", import.meta.url), "utf8"));
const ptName = (name) => PT[Object.keys(EN).find((key) => key.startsWith("program.split_day.") && EN[key] === name)];

const stored = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
const trainingDayNames = (state) =>
  state.programMeta.programDefinition.days.filter((day) => day.kind === "training").map((day) => day.name);
const texts = (page, selector) =>
  page.evaluate((sel) => [...document.querySelectorAll(sel)].map((node) => node.textContent.trim()), selector);
const dayTabs = (page) => texts(page, "#dayTabs button");
const editorNames = (page) =>
  page.evaluate(() => [...document.querySelectorAll("#programEditor .pday__name")].map((input) => input.value));
const view = async (page, name) => {
  await page.click(`nav button[data-view="${name}"]`);
  await page.waitForSelector(`#${name}.view.active`);
};

async function persistState(page, state) {
  await page.evaluate(async ({ key, blob }) => {
    localStorage.setItem(key, JSON.stringify(blob));
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { key: KEY, blob: state });
}

const browser = await launchChromium();
try {
  const context = await browser.newContext({ locale: "pt-BR" });
  const page = await context.newPage();
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  assert.match(await page.evaluate(() => document.documentElement.lang), /^pt/, "a Portuguese device runs the app in Portuguese");
  await page.evaluate(() => localStorage.setItem("repforge_ui_v1", JSON.stringify({ tourDone: true })));
  const generated = await installGeneratedProgram(page, { name: "Generated browser fixture", seed: "day-names" });

  const authored = trainingDayNames(generated);
  assert.deepEqual(authored, ["Upper A", "Lower A", "Upper B", "Lower B"], "the generator authors the four-day split");
  assert.deepEqual([...new Set(generated.program.map((row) => row.day))], authored,
    "generating in Portuguese stores the language-independent authored day names");
  const portugueseAuthored = authored.map(ptName);
  assert.ok(portugueseAuthored.every((name, index) => name && name !== authored[index]), "every authored day has its own Portuguese name");

  // One finished session on the first day, so History has a day name to show.
  const firstRow = generated.program.find((row) =>
    row.day === authored[0] && isWeightRepsSlot(definitionSlot(generated.programMeta, row)));
  const log = [metricLogRow(generated.programMeta, firstRow, { session: "day-names-a", date: "2026-03-03", set: 1, load: 60, reps: 8 })];
  await persistState(page, { ...generated, log });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });

  assert.deepEqual(await dayTabs(page), portugueseAuthored, "Today's day tabs show the Portuguese day names in authored order");

  await view(page, "history");
  await page.waitForSelector("#history .hist-sess__m b");
  assert.deepEqual(await texts(page, "#history .hist-sess__m b"), [portugueseAuthored[0]], "History names the session's day in Portuguese");

  await view(page, "program");
  assert.deepEqual(await texts(page, "#programOverview .prog-day__title"), portugueseAuthored,
    "the program overview shows the Portuguese day names in authored order");
  await page.click("#programEditToggle");
  assert.deepEqual(await editorNames(page), portugueseAuthored, "the editor shows the Portuguese day names in authored order");

  // Renaming a day to the name another day already shows would leave two days reading alike.
  // The editor refuses it the same way it refuses a stored duplicate: nothing is staged.
  const stagedDays = () => page.evaluate(async (key) => {
    const rows = (await window.__debugProgramEditor?.())?.session?.document?.program || JSON.parse(localStorage.getItem(key)).program;
    return [...new Set(rows.map((row) => row.day))];
  }, KEY);
  const secondDay = page.locator("#programEditor .pday__name").nth(1);
  await secondDay.fill(portugueseAuthored[0]);
  await secondDay.press("Enter");
  assert.deepEqual(await stagedDays(), authored, "a rename to the name another day shows is refused");

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
  assert.deepEqual(await dayTabs(page), ["My upper day", ...portugueseAuthored.slice(1)],
    "the renamed day shows the lifter's text while the other days stay Portuguese");

  await page.evaluate(() => window.__repforgeShowSettings());
  await page.selectOption("#lang", "en");
  await page.waitForFunction(() => /^en/.test(document.documentElement.lang));
  const english = await dayTabs(page);
  assert.deepEqual(english, ["My upper day", ...authored.slice(1)],
    "in English the generated days read in English and the lifter's own name is never translated");
  assert.deepEqual(trainingDayNames(await stored(page)), ["My upper day", ...authored.slice(1)],
    "switching language rewrites no stored day name");

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  assert.deepEqual(await dayTabs(page), english, "language and custom day name survive reload");
  await context.close();
  console.log("PASS browser day names: generated days follow the app language; a custom rename survives language switch and reload");
} finally {
  await browser.close();
}
