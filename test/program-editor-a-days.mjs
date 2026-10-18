#!/usr/bin/env node
/**
 * Plan 074 S2: training days reorder in the installed Program editor (ADR 0021
 * decision 6, the `day_move` intent).
 *
 * P074-S2-REORDER: Program → Edit → a day's ··· → Training days → move Day 3
 * to the top (arrows) → Done → Apply. The program structure and the canonical
 * definition both read Day 3, Day 1, Day 2, with every day's order renumbered;
 * the order survives a reload; and Today's day tabs, the order the next day is
 * chosen from, follow it. A handle drag in the same sheet moves a day too, and
 * Undo takes it back.
 * A second tab that reordered the days against the old order and applies
 * afterwards is refused as a conflict and writes nothing.
 *
 * Run: node tools/run-tests.mjs entry --suite program-editor-a-days
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";
import { EDITOR, SHEET, applyInstalledEditor, closeEditorSheet, editorSettled, openInstalledEditor } from "./fixtures/installed-editor.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";

const failures = [];
let passed = 0;
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 1500)}`);
}

async function waitForApp(page) {
  await waitForAppBoot(page);
  await page.evaluate(() => {
    window.closeFirstRun?.();
    if (document.querySelector("#onboarding")?.classList.contains("active")) window.closeOnboarding?.();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden")) window.closeTour?.();
  });
}

const stored = async (page) => {
  await page.evaluate(() => window.__repforgeStorage.flush());
  return page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key) || "{}");
    const definition = state.programMeta?.programDefinition;
    return {
      structure: (state.programMeta?.programStructure?.days || []).map((entry) => entry.label),
      training: (definition?.days || []).filter((day) => day.kind === "training").map((day) => day.name),
      orders: (definition?.days || []).map((day) => day.order),
      kinds: (definition?.days || []).map((day) => day.kind),
    };
  }, KEY);
};

async function openDays(page) {
  await page.locator(`${EDITOR} [data-role="day-menu"]`).click();
  await page.locator(`${SHEET} [data-role="day-action"][data-action="days"]`).click();
  await page.waitForSelector(`${SHEET}.is-open [data-pe-sheet="days"]`, { timeout: 5000 });
}
const listed = (page) => page.$$eval(`${SHEET} [data-role="days-row"]`, (rows) => rows.map((row) => row.dataset.day));
async function move(page, day, delta) {
  await page.locator(`${SHEET} [data-role="day-move"][data-day="${day}"][data-delta="${delta}"]`).click();
  await editorSettled(page);
}

async function reorderJourney(page) {
  console.log("P074-S2-REORDER");
  await openInstalledEditor(page);
  await openDays(page);
  check(JSON.stringify(await listed(page)) === JSON.stringify(["Day 1", "Day 2", "Day 3"]), "the Training days sheet lists the days in order", await listed(page));
  await move(page, "Day 3", -1);
  await move(page, "Day 3", -1);
  check(JSON.stringify(await listed(page)) === JSON.stringify(["Day 3", "Day 1", "Day 2"]), "Move up twice puts Day 3 first", await listed(page));
  await closeEditorSheet(page);
  const tabs = await page.$$eval(`${EDITOR} [data-role="day-tab"]`, (nodes) => nodes.map((node) => node.dataset.day));
  check(JSON.stringify(tabs) === JSON.stringify(["Day 3", "Day 1", "Day 2"]), "the editor's tabs follow the new order", tabs);
  const before = await stored(page);
  check(JSON.stringify(before.training) === JSON.stringify(["Day 1", "Day 2", "Day 3"]), "nothing is stored before Apply", before);
  await applyInstalledEditor(page);

  const verify = async (label) => {
    const after = await stored(page);
    check(JSON.stringify(after.structure) === JSON.stringify(["Day 3", "Day 1", "Day 2"]), `${label}: the program structure is reordered`, after);
    check(JSON.stringify(after.training) === JSON.stringify(["Day 3", "Day 1", "Day 2"]), `${label}: the definition's training days follow it`, after);
    check(after.orders.every((order, index) => order === index + 1) &&
      JSON.stringify(after.kinds) === JSON.stringify(before.kinds), `${label}: every day keeps its kind and is renumbered`, after);
  };
  await verify("after Apply");
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await verify("after a reload");
  await page.evaluate(() => document.querySelector('nav button[data-view="log"]')?.click());
  const today = await page.$$eval("#dayTabs button", (nodes) => nodes.map((node) => node.dataset.day));
  // Today's tabs are days(), the order the next day is chosen from.
  check(JSON.stringify(today) === JSON.stringify(["Day 3", "Day 1", "Day 2"]), "Today's day tabs follow the new order", today);
}

async function dragJourney(page) {
  console.log("P074-S2-DRAG");
  await installSeedProgram(page, { key: KEY, waitFor: waitForApp });
  await openInstalledEditor(page);
  await openDays(page);
  const handle = await page.locator(`${SHEET} [data-role="day-handle"][data-day="Day 1"]`).boundingBox();
  const last = await page.locator(`${SHEET} [data-role="days-row"][data-day="Day 3"]`).boundingBox();
  const x = handle.x + handle.width / 2, fromY = handle.y + handle.height / 2, toY = last.y + last.height / 2;
  await page.mouse.move(x, fromY);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x, fromY + (toY - fromY) * (i / 8));
  await page.mouse.up();
  await editorSettled(page);
  check(JSON.stringify(await listed(page)) === JSON.stringify(["Day 2", "Day 3", "Day 1"]), "dragging Day 1 by its handle to the end moves it there", await listed(page));
  check(await page.locator(`${SHEET}.is-open [data-pe-sheet="days"]`).count() === 1, "and the sheet stays open: the drag is not a swipe to dismiss it");
  await closeEditorSheet(page);
  await page.locator(`${EDITOR} [data-role="undo"]`).click();
  await editorSettled(page);
  const tabs = await page.$$eval(`${EDITOR} [data-role="day-tab"]`, (nodes) => nodes.map((node) => node.dataset.day));
  check(JSON.stringify(tabs) === JSON.stringify(["Day 1", "Day 2", "Day 3"]), "Undo puts the days back", tabs);
  await page.click("#programEditCancel");
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), undefined, { timeout: 5000 });
}

async function conflictJourney(browser) {
  console.log("P074-S2-CONFLICT");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const first = await context.newPage();
  await first.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(first);
  await installSeedProgram(first, { key: KEY, waitFor: waitForApp });
  const second = await context.newPage();
  await second.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(second);
  await openInstalledEditor(first);
  await openInstalledEditor(second);
  await openDays(first);
  await move(first, "Day 3", -1);
  await openDays(second);
  await move(second, "Day 1", 1);
  await applyInstalledEditor(first);
  const winner = await stored(first);
  await closeEditorSheet(second);
  await second.locator(`${EDITOR} [data-role="apply"]`).click();
  await second.waitForFunction(() => {
    const status = document.querySelector('#programEditor [data-role="editor-status"]');
    return document.querySelector("#programEditorWrap")?.classList.contains("is-hidden") || (!status?.hidden && !!status?.textContent.trim());
  }, undefined, { timeout: 10000 });
  const outcome = await second.evaluate(() => ({
    open: !document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"),
    status: document.querySelector('#programEditor [data-role="editor-status"]')?.textContent?.trim() || "",
  }));
  const after = await stored(second);
  check(outcome.open && /another tab/i.test(outcome.status), "a reorder made against the old order is refused as a conflict", outcome);
  check(JSON.stringify(after) === JSON.stringify(winner), "and it writes nothing over the first tab's order", { winner, after });
  await context.close();
}

async function main() {
  console.log("Plan 074 S2: training day reorder");
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await installSeedProgram(page, { key: KEY, waitFor: waitForApp });
    await reorderJourney(page);
    await dragJourney(page);
    await conflictJourney(browser);
    check(!errors.length, "no page errors", errors);
  } catch (error) {
    failures.push(String(error?.stack || error));
    console.error(error);
  } finally {
    await browser.close();
  }
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

main();
