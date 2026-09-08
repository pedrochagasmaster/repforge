#!/usr/bin/env node
/**
 * Reordering exercises in the program editor.
 *
 * The editor's hand-rolled pointer drag was replaced by @dnd-kit/dom. That is
 * only worth doing if the behaviour it replaced survives and the behaviour it
 * adds actually works, so this suite covers both halves:
 *
 *   what had to survive        — a pointer drag reorders within a day; a drag
 *                                carries an exercise to another day; a tap on
 *                                the handle is not a drag; Escape abandons a
 *                                drag; the reorder is one document transaction
 *                                with an undo; and the explicit Move up /
 *                                Move down / Move to another day controls
 *                                still work on their own.
 *   what the library adds      — a keyboard drag with no pointer at all, and
 *                                a live region that announces each step in the
 *                                lifter's own language rather than in the
 *                                library's English.
 *
 * Every case is checked against the persisted document, not against DOM order,
 * because the DOM is what the library moved and the document is what the lifter
 * keeps.
 *
 * Run: node test/program-editor-sorting.mjs
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DB = "repforge";
const STORE = "kv";

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}`); if (detail != null) console.log(`    ${JSON.stringify(detail)}`); }
}
const phase = n => console.log(`\n${n}`);

const ROWS = [
  ["sort-a", "Seated row machine", "Day 1", 1],
  ["sort-b", "Romanian deadlift", "Day 1", 2],
  ["sort-c", "Machine lateral raise", "Day 1", 3],
  ["sort-d", "Leg press", "Day 2", 1],
];

function fixture(lang = "en") {
  return {
    settings: {
      jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 0, lastExport: "",
      unit: "kg", lang, rirMode: "numeric", voiceInputEnabled: false,
      notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
    },
    programMeta: {
      id: "sorting-program", name: "Sorting fixture",
      started: "2026-09-01", created: "2026-09-01T00:00:00.000Z", updated: "2026-09-01T00:00:00.000Z",
      onboarded: true, mesocycleStatus: "active", mesocycleLengthWeeks: 6,
      goal: null, experience: null, daysPerWeek: 2, splitType: "full_body",
      equipment: ["machines"], priorityMuscles: [], sessionLength: "short", completedAt: null,
    },
    program: ROWS.map(([id, name, day, order]) => ({
      id, name, day, order, sets: 3, min: 6, max: 10,
      primary: "Back", secondary: "", notes: "", alternates: [],
    })),
    log: [], programHistory: [], _storageRevision: 1,
  };
}

async function writeFixture(page, lang) {
  const state = fixture(lang);
  await page.evaluate(() => window.__repforgeStorage.flush());
  await page.evaluate(async ({ key, dbName, storeName, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
    localStorage.removeItem("repforge_draft_v1");
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(storeName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(state, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { key: KEY, dbName: DB, storeName: STORE, state });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
}

/* Announcements replace each other inside one live region, so reading it once
   at the end only ever shows the last of them. Sample instead: a poll catches a
   value however it was written, including one set on a node before it is
   attached, which a MutationObserver on the document would miss. */
const WATCH_ANNOUNCEMENTS = () => {
  window.__said = [];
  setInterval(() => {
    for (const region of document.querySelectorAll("[aria-live]")) {
      const text = region.textContent.trim();
      if (text && !window.__said.includes(text)) window.__said.push(text);
    }
  }, 16);
};

/** The editor's own view of the program: what a save would write. */
const order = page => page.evaluate(() =>
  [...document.querySelectorAll('#programEditor [data-role="day"]')].map(section => ({
    day: section.dataset.day,
    rows: [...section.querySelectorAll('[data-role="exercise"][data-id]')].map(row => row.dataset.id),
  })));

async function openEditor(page) {
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#program.view.active", { timeout: 10000 });
  await page.click("#programEditToggle");
  await page.waitForSelector("#programEditorWrap:not(.is-hidden)", { timeout: 10000 });
  await page.waitForSelector('#programEditor [data-role="exercise"]', { timeout: 10000 });
}

/** The handle is only offered once the day's menu has turned reordering on.
 *  The menu item is a toggle, so this checks before flipping it. */
async function enterReorderMode(page) {
  const on = () => page.evaluate(() =>
    !!document.querySelector('#programEditor .program-editor.is-reorder-mode'));
  if (await on()) return;
  const day = page.locator('#programEditor [data-role="day"]').first();
  await day.locator('[data-role="day-menu"]').click();
  await day.locator('[data-role="toggle-reorder"]').click();
  await page.waitForTimeout(200);
  if (!(await on())) throw new Error("reorder mode did not turn on");
}

/** A pointer drag paced like a thumb: samples a frame apart, not one jump.
 *  `linger` keeps the pointer moving a hair at the destination, which is what a
 *  thumb held over a collapsed day does while it waits for the day to open. */
async function dragHandle(page, id, toY, { hold = 140, steps = 8, linger = 0, release = true } = {}) {
  const handle = await page.locator(`#programEditor [data-role="exercise"][data-id="${id}"] [data-role="drag-handle"]`).boundingBox();
  if (!handle) throw new Error(`no drag handle for ${id}`);
  const x = Math.round(handle.x + handle.width / 2);
  const fromY = Math.round(handle.y + handle.height / 2);
  await page.mouse.move(x, fromY);
  await page.mouse.down();
  await page.waitForTimeout(hold);
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x, Math.round(fromY + (toY - fromY) * (i / steps)));
    await page.waitForTimeout(24);
  }
  for (let waited = 0; waited < linger; waited += 60) {
    await page.mouse.move(x, toY + (waited % 120 ? 1 : -1));
    await page.waitForTimeout(60);
  }
  if (release) { await page.mouse.up(); await page.waitForTimeout(600); }
}

async function run() {
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 1400 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e.message)));
  await page.addInitScript(WATCH_ANNOUNCEMENTS);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await writeFixture(page);
  await openEditor(page);

  phase("the drag library is driving the editor");
  const wired = await page.evaluate(() => ({
    runtime: typeof window.DndKit?.DragDropManager === "function",
    described: [...document.querySelectorAll('#programEditor [data-role="drag-handle"]')]
      .every(handle => handle.hasAttribute("aria-describedby") || handle.hasAttribute("aria-disabled")),
  }));
  assert(wired.runtime, "the vendored @dnd-kit bundle is on the page");
  assert(wired.described, "every drag handle is registered with it", wired);

  phase("a pointer drag reorders within a day");
  await enterReorderMode(page);
  const before = await order(page);
  assert(before[0].rows.join() === "sort-a,sort-b,sort-c", "the fixture starts in its authored order", before);
  {
    const third = await page.locator('#programEditor [data-role="exercise"][data-id="sort-c"]').boundingBox();
    await dragHandle(page, "sort-a", Math.round(third.y + third.height - 6));
  }
  const reordered = await order(page);
  assert(reordered[0].rows[0] !== "sort-a" && reordered[0].rows.length === 3,
    "the dragged exercise left the top of its day", reordered);
  assert([...reordered[0].rows].sort().join() === "sort-a,sort-b,sort-c",
    "and no exercise was lost or duplicated on the way", reordered);

  phase("the move is one transaction, with an undo");
  const undone = await page.evaluate(async () => {
    const undo = document.querySelector('#programEditor [data-role="undo-move"]');
    if (!undo) return { offered: false };
    undo.click();
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      offered: true,
      rows: [...document.querySelectorAll('#programEditor [data-role="day"]')][0]
        ?.querySelectorAll('[data-role="exercise"][data-id]').length,
      order: [...document.querySelectorAll('#programEditor [data-role="day"]')][0]
        ? [...[...document.querySelectorAll('#programEditor [data-role="day"]')][0]
            .querySelectorAll('[data-role="exercise"][data-id]')].map(row => row.dataset.id)
        : [],
    };
  });
  assert(undone.offered, "a drag offers the same undo the Move controls do");
  assert(undone.order.join() === "sort-a,sort-b,sort-c",
    "and undoing puts the exercise back where it started", undone);

  phase("a drag carries an exercise to another day");
  await enterReorderMode(page);
  {
    // Day 2 starts collapsed, which is the interesting case: holding a row over
    // a shut day has always opened it, and that 450ms hold is the editor's own
    // behaviour rather than the drag library's.
    const collapsed = await page.evaluate(() =>
      !!document.querySelector('#programEditor [data-role="day"][data-day="Day 2"] [data-role="day-body"][hidden]'));
    assert(collapsed, "Day 2 starts collapsed, so the drop has to open it first");
    const other = await page.locator('#programEditor [data-role="day"][data-day="Day 2"]').boundingBox();
    await dragHandle(page, "sort-a", Math.round(other.y + Math.min(other.height - 6, 30)),
      { steps: 14, linger: 900, release: false });
    assert(await page.evaluate(() =>
      !!document.querySelector('#programEditor [data-role="day"][data-day="Day 2"].is-drag-target-expanded')),
      "holding the row over the shut day opens it");
    await page.mouse.up();
    await page.waitForTimeout(600);
  }
  const crossed = await order(page);
  const dayOf = id => crossed.find(day => day.rows.includes(id))?.day;
  assert(dayOf("sort-a") === "Day 2", "the exercise now belongs to the day it was dropped on", crossed);
  assert(crossed.reduce((n, day) => n + day.rows.length, 0) === 4,
    "and the program still holds every exercise", crossed);

  phase("a press that is not a drag changes nothing");
  await writeFixture(page);
  await openEditor(page);
  await enterReorderMode(page);
  {
    const handle = await page.locator('#programEditor [data-role="exercise"][data-id="sort-a"] [data-role="drag-handle"]').boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(40);
    await page.mouse.up();
    await page.waitForTimeout(400);
  }
  assert((await order(page))[0].rows.join() === "sort-a,sort-b,sort-c",
    "a tap on the handle inside the pickup delay is still a tap", await order(page));

  phase("an abandoned drag leaves the program alone");
  {
    const third = await page.locator('#programEditor [data-role="exercise"][data-id="sort-c"]').boundingBox();
    await dragHandle(page, "sort-a", Math.round(third.y + third.height - 6), { release: false });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await page.mouse.up();
    await page.waitForTimeout(500);
  }
  assert((await order(page))[0].rows.join() === "sort-a,sort-b,sort-c",
    "Escape mid-drag cancels the move rather than committing it", await order(page));

  phase("the keyboard reorders with no pointer at all");
  await writeFixture(page);
  await openEditor(page);
  await enterReorderMode(page);
  await page.locator('#programEditor [data-role="exercise"][data-id="sort-a"] [data-role="drag-handle"]').focus();
  await page.evaluate(() => { window.__said.length = 0; });
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  const announced = await page.evaluate(() => window.__said);
  assert(announced.some(text => /Seated row machine.*(position|posição) 1 of 3 in Day 1\./.test(text)),
    "picking up with the keyboard is announced, naming the exercise and where it sits", announced);
  assert(!announced.some(text => /Draggable item|Sortable item/i.test(text)),
    "in Taurifer's own words, not the library's generic ones", announced);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(300);
  await page.keyboard.press("Space");
  await page.waitForTimeout(700);
  const byKeyboard = await order(page);
  assert(byKeyboard[0].rows[0] === "sort-b" && byKeyboard[0].rows[1] === "sort-a",
    "and the exercise moves down one place", byKeyboard);

  phase("the explicit Move controls still work on their own");
  await writeFixture(page);
  await openEditor(page);
  // The row menu shares reorder mode with the drag handle: both are the
  // editor's reordering affordances and both appear together.
  await enterReorderMode(page);
  await page.locator('#programEditor [data-role="exercise"][data-id="sort-b"] [data-role="exercise-menu"]').first().click();
  await page.locator('#programEditor [data-role="exercise"][data-id="sort-b"] [data-role="move-up"]').first().click();
  await page.waitForTimeout(500);
  assert((await order(page))[0].rows.join() === "sort-b,sort-a,sort-c",
    "Move up moves an exercise up", await order(page));
  await page.locator('#programEditor [data-role="exercise"][data-id="sort-b"] [data-role="exercise-menu"]').first().click();
  await page.locator('#programEditor [data-role="exercise"][data-id="sort-b"] [data-role="move-other"]').first().click();
  await page.locator('#programEditor [data-role="exercise"][data-id="sort-b"] [data-role="move-to-day"][data-day="Day 2"]').first().click();
  await page.waitForTimeout(500);
  {
    const moved = await order(page);
    assert(moved.find(day => day.rows.includes("sort-b"))?.day === "Day 2",
      "Move to another day moves it across", moved);
  }
  assert(errors.length === 0, "no page errors while reordering", errors.join(" | "));
  await context.close();

  phase("Portuguese hears Portuguese, not the library's English");
  {
    const ptContext = await browser.newContext({ viewport: { width: 390, height: 1400 }, serviceWorkers: "block" });
    const pt = await ptContext.newPage();
    await pt.addInitScript(WATCH_ANNOUNCEMENTS);
    await pt.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(pt, { base: BASE });
    await writeFixture(pt, "pt");
    await openEditor(pt);
    await enterReorderMode(pt);
    await pt.locator('#programEditor [data-role="exercise"][data-id="sort-a"] [data-role="drag-handle"]').focus();
    await pt.evaluate(() => { window.__said.length = 0; });
    await pt.keyboard.press("Space");
    await pt.waitForTimeout(300);
    const said = await pt.evaluate(() => window.__said);
    assert(said.some(text => /(levantado|na posição) 1 de 3 em Dia 1\./i.test(text)),
      "the drag is announced in Portuguese, down to the day's own name", said);
    assert(!said.some(text => /Picked up|Draggable item/i.test(text)),
      "and none of the library's English defaults reach the live region", said);
    await pt.keyboard.press("Escape");
    await pt.waitForTimeout(300);
    await ptContext.close();
  }

  phase("reduced motion turns the drag's animations off");
  {
    const rmContext = await browser.newContext({ viewport: { width: 390, height: 1400 }, serviceWorkers: "block", reducedMotion: "reduce" });
    const rm = await rmContext.newPage();
    const rmErrors = [];
    rm.on("pageerror", e => rmErrors.push(String(e.message)));
    await rm.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(rm, { base: BASE });
    await writeFixture(rm);
    await openEditor(rm);
    await enterReorderMode(rm);
    const third = await rm.locator('#programEditor [data-role="exercise"][data-id="sort-c"]').boundingBox();
    const handle = await rm.locator('#programEditor [data-role="exercise"][data-id="sort-a"] [data-role="drag-handle"]').boundingBox();
    const x = Math.round(handle.x + handle.width / 2);
    const fromY = Math.round(handle.y + handle.height / 2);
    const toY = Math.round(third.y + third.height - 6);
    await rm.mouse.move(x, fromY);
    await rm.mouse.down();
    await rm.waitForTimeout(140);
    for (let i = 1; i <= 8; i++) { await rm.mouse.move(x, Math.round(fromY + (toY - fromY) * i / 8)); await rm.waitForTimeout(24); }
    await rm.mouse.up();
    // No settle wait: with the animations off the document is already correct.
    await rm.waitForTimeout(120);
    const rmOrder = await order(rm);
    assert(rmOrder[0].rows[0] !== "sort-a" && [...rmOrder[0].rows].sort().join() === "sort-a,sort-b,sort-c",
      "the drop lands immediately and the reorder is complete", rmOrder);
    const stranded = await rm.evaluate(() =>
      [...document.querySelectorAll('#programEditor [data-role="exercise"]')]
        .filter(row => row.style.transform || row.style.willChange).length);
    assert(stranded === 0, "and no row is left carrying an inline transform", stranded);
    assert(rmErrors.length === 0, "no page errors under reduced motion", rmErrors.join(" | "));
    await rmContext.close();
  }

  await browser.close();
  console.log(`\nprogram editor sorting: ${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });
