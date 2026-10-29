#!/usr/bin/env node
/**
 * Reordering exercises in the program editor.
 *
 * The editor's hand-rolled pointer drag was replaced by @dnd-kit/dom. That is
 * only worth doing if the behaviour it replaced survives and the behaviour it
 * adds actually works, so this suite covers both halves:
 *
 *   what had to survive        — a pointer drag reorders within a day; a tap
 *                                on the handle is not a drag; Escape abandons a
 *                                drag; the reorder is one document transaction
 *                                with an undo; and the explicit Move up /
 *                                Move down / Move to another day controls
 *                                still work on their own.
 *   what the library adds      — a keyboard drag with no pointer at all, and
 *                                a live region that announces each step in the
 *                                lifter's own language rather than in the
 *                                library's English.
 *
 * Every case is checked against the editor's staged document, not against DOM
 * order, because the DOM is what the library moved and the document is what the
 * lifter keeps.
 *
 * Plan 074: the installed editor reorders from the day menu's Reorder exercises
 * list (one day at a time); an exercise changes day from its sheet.
 *
 * Run: node test/program-editor-sorting.mjs
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";
import { openExerciseSheet, openInstalledEditor } from "./fixtures/installed-editor.mjs";

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

/* Day 1 holds three movements and Day 2 one, cut from the seed program's
   canonical ProgramDefinition so every reorder runs the real canonical commit. */
const ALIAS = {
  "seed-ex-1": "Seated row machine",
  "seed-ex-2": "Romanian deadlift",
  "seed-ex-3": "Machine lateral raise",
  "seed-ex-7": "Leg press",
};

function fixture(lang = "en") {
  const meta = seedProgramMeta();
  const definition = meta.programDefinition;
  for (const day of definition.days) {
    day.slots = day.slots.filter((slot) => ALIAS[slot.id]);
    day.slots.forEach((slot, index) => { slot.order = index + 1; slot.displayName = ALIAS[slot.id]; });
    if (!day.slots.length) day.kind = "rest";
  }
  const order = new Map();
  const program = seedProgram().filter((row) => ALIAS[row.id]).map((row) => {
    const position = (order.get(row.day) || 0) + 1;
    order.set(row.day, position);
    return { ...row, order: position, name: ALIAS[row.id], displayName: ALIAS[row.id], alternates: [] };
  });
  return {
    settings: {
      jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 0, lastExport: "",
      unit: "kg", lang, rirMode: "numeric", voiceInputEnabled: false,
      notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
    },
    programMeta: { ...meta, daysPerWeek: 2, programDefinition: definition },
    program, customExercises: [],
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

/** The editor's own view of the program: what an Apply would write, day by day. */
const order = page => page.evaluate(async () => {
  const debug = await window.__debugProgramEditor?.();
  const rows = debug?.session?.document?.program || window.__repforgeWorkoutDraft.state().program;
  const days = [...new Set(rows.map(row => row.day))];
  return days.map(day => ({ day, rows: rows.filter(row => row.day === day).sort((a, b) => a.order - b.order).map(row => row.id) }));
});

const settled = page => page.waitForSelector('#programEditor [data-role="editor"][data-layout="review"]:not([aria-busy="true"])', { timeout: 10000 });

async function openEditor(page) {
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await openInstalledEditor(page);
}

/** Plan 074: the day menu's Reorder exercises list carries the handles. */
async function enterReorderMode(page) {
  if (await page.locator('#programEditor [data-role="reorder-list"]').count()) return;
  await page.locator('#programEditor [data-role="day-menu"]').click();
  await page.locator('#reviewSheet [data-role="day-action"][data-action="reorder"]').click();
  await page.locator('#programEditor [data-role="reorder-list"]').waitFor({ timeout: 5000 });
  // @dnd-kit describes a handle when it registers that sortable (#354).
  await page.waitForFunction(() => [...document.querySelectorAll('#programEditor [data-role="drag-handle"]')]
    .every(handle => handle.hasAttribute("aria-describedby") || handle.hasAttribute("aria-disabled")), undefined, { timeout: 5000 })
    .catch(() => {});
}

const ROW = id => `#programEditor [data-role="reorder-row"][data-id="${id}"]`;

/** A pointer drag paced like a thumb: samples a frame apart, not one jump. */
async function dragHandle(page, id, toY, { hold = 140, steps = 8, release = true } = {}) {
  const handle = await page.locator(`${ROW(id)} [data-role="drag-handle"]`).boundingBox();
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
  if (release) { await page.mouse.up(); await page.waitForTimeout(600); await settled(page); }
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
  await enterReorderMode(page);
  const wired = await page.evaluate(() => ({
    runtime: typeof window.DndKit?.DragDropManager === "function",
    described: [...document.querySelectorAll('#programEditor [data-role="drag-handle"]')]
      .every(handle => handle.hasAttribute("aria-describedby") || handle.hasAttribute("aria-disabled")),
  }));
  assert(wired.runtime, "the vendored @dnd-kit bundle is on the page");
  assert(wired.described, "every drag handle is registered with it", wired);

  phase("a pointer drag reorders within a day");
  const before = await order(page);
  assert(before[0].rows.join() === "seed-ex-1,seed-ex-2,seed-ex-3", "the fixture starts in its authored order", before);
  {
    const third = await page.locator(ROW("seed-ex-3")).boundingBox();
    await dragHandle(page, "seed-ex-1", Math.round(third.y + third.height - 6));
  }
  const reordered = await order(page);
  assert(reordered[0].rows[0] !== "seed-ex-1" && reordered[0].rows.length === 3,
    "the dragged exercise left the top of its day", reordered);
  assert([...reordered[0].rows].sort().join() === "seed-ex-1,seed-ex-2,seed-ex-3",
    "and no exercise was lost or duplicated on the way", reordered);

  phase("the move is one transaction, with an undo");
  const undo = page.locator('#programEditor [data-role="undo"]');
  assert(await undo.count() === 1, "a drag offers the changes bar's Undo");
  await undo.click();
  await settled(page);
  assert((await order(page))[0].rows.join() === "seed-ex-1,seed-ex-2,seed-ex-3",
    "and undoing puts the exercise back where it started", await order(page));

  phase("the sheet's Move to another day carries an exercise to another day");
  await page.locator('#programEditor [data-role="reorder-done"]').click();
  await openExerciseSheet(page, "seed-ex-1");
  await page.locator('#reviewSheet [data-role="move-to-day"][data-day="Day 2"]').click();
  await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 5000 });
  await settled(page);
  const crossed = await order(page);
  const dayOf = id => crossed.find(day => day.rows.includes(id))?.day;
  assert(dayOf("seed-ex-1") === "Day 2", "the exercise now belongs to the day it was moved to", crossed);
  assert(crossed.reduce((n, day) => n + day.rows.length, 0) === 4,
    "and the program still holds every exercise", crossed);

  phase("a press that is not a drag changes nothing");
  await writeFixture(page);
  await openEditor(page);
  await enterReorderMode(page);
  {
    const handle = await page.locator(`${ROW("seed-ex-1")} [data-role="drag-handle"]`).boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(40);
    await page.mouse.up();
    await page.waitForTimeout(400);
  }
  assert((await order(page))[0].rows.join() === "seed-ex-1,seed-ex-2,seed-ex-3",
    "a tap on the handle inside the pickup delay is still a tap", await order(page));

  phase("an abandoned drag leaves the program alone");
  {
    const third = await page.locator(ROW("seed-ex-3")).boundingBox();
    await dragHandle(page, "seed-ex-1", Math.round(third.y + third.height - 6), { release: false });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await page.mouse.up();
    await page.waitForTimeout(500);
  }
  assert((await order(page))[0].rows.join() === "seed-ex-1,seed-ex-2,seed-ex-3",
    "Escape mid-drag cancels the move rather than committing it", await order(page));

  phase("the keyboard reorders with no pointer at all");
  await writeFixture(page);
  await openEditor(page);
  await enterReorderMode(page);
  await page.locator(`${ROW("seed-ex-1")} [data-role="drag-handle"]`).focus();
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
  await settled(page);
  const byKeyboard = await order(page);
  assert(byKeyboard[0].rows[0] === "seed-ex-2" && byKeyboard[0].rows[1] === "seed-ex-1",
    "and the exercise moves down one place", byKeyboard);

  phase("the explicit Move controls still work on their own");
  await writeFixture(page);
  await openEditor(page);
  await enterReorderMode(page);
  await page.locator('#programEditor [data-role="reorder-move"][data-id="seed-ex-2"][data-delta="-1"]').click();
  await settled(page);
  assert((await order(page))[0].rows.join() === "seed-ex-2,seed-ex-1,seed-ex-3",
    "Move up moves an exercise up", await order(page));
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
    await pt.locator(`${ROW("seed-ex-1")} [data-role="drag-handle"]`).focus();
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
    const third = await rm.locator(ROW("seed-ex-3")).boundingBox();
    const handle = await rm.locator(`${ROW("seed-ex-1")} [data-role="drag-handle"]`).boundingBox();
    const x = Math.round(handle.x + handle.width / 2);
    const fromY = Math.round(handle.y + handle.height / 2);
    const toY = Math.round(third.y + third.height - 6);
    await rm.mouse.move(x, fromY);
    await rm.mouse.down();
    await rm.waitForTimeout(140);
    for (let i = 1; i <= 8; i++) { await rm.mouse.move(x, Math.round(fromY + (toY - fromY) * i / 8)); await rm.waitForTimeout(24); }
    await rm.mouse.up();
    // No animation wait: with the animations off the drop commits at once.
    await rm.waitForTimeout(120);
    await settled(rm);
    const rmOrder = await order(rm);
    assert(rmOrder[0].rows[0] !== "seed-ex-1" && [...rmOrder[0].rows].sort().join() === "seed-ex-1,seed-ex-2,seed-ex-3",
      "the drop lands immediately and the reorder is complete", rmOrder);
    const stranded = await rm.evaluate(() =>
      [...document.querySelectorAll('#programEditor [data-role="reorder-row"]')]
        .filter(row => row.style.transform || row.style.willChange).length);
    assert(stranded === 0, "and no row is left carrying an inline transform", stranded);
    assert(rmErrors.length === 0, "no page errors under reduced motion", rmErrors.join(" | "));
    await rmContext.close();
  }

  phase("a reorder keeps the editor where it was (#516)");
  {
    // A short phone, so the editor's own scroller (#programEditorWrap) has somewhere to scroll.
    const shortContext = await browser.newContext({ viewport: { width: 390, height: 480 }, serviceWorkers: "block" });
    const sp = await shortContext.newPage();
    const spErrors = [];
    sp.on("pageerror", (error) => spErrors.push(String(error)));
    await sp.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(sp, { base: BASE });
    await writeFixture(sp);
    await openEditor(sp);
    await enterReorderMode(sp);
    const scrollToEnd = () => sp.evaluate(() => { const s = document.querySelector("#programEditorWrap"); s.scrollTop = s.scrollHeight; return s.scrollTop; });
    const where = (id) => sp.evaluate((sel) => {
      const s = document.querySelector("#programEditorWrap"), row = document.querySelector(sel), box = s.getBoundingClientRect(), r = row?.getBoundingClientRect();
      return { top: s.scrollTop, visible: !!r && r.top >= box.top - 1 && r.bottom <= box.bottom + 1 };
    }, ROW(id));
    const before = await scrollToEnd();
    assert(before > 40, "the reorder list scrolls on a short phone", String(before));
    await sp.locator('#programEditor [data-role="reorder-move"][data-id="seed-ex-3"][data-delta="-1"]').click();
    await settled(sp);
    await sp.waitForTimeout(250);
    const afterArrow = await where("seed-ex-3");
    assert(Math.abs(afterArrow.top - before) <= 2 && afterArrow.visible, "Move up keeps the scroll position, and the moved row stays in view",
      JSON.stringify({ before, after: afterArrow }));
    await sp.locator('#programEditor [data-role="reorder-move"][data-id="seed-ex-3"][data-delta="-1"]').click();
    await settled(sp);
    await sp.waitForTimeout(250);
    const again = await where("seed-ex-3");
    assert(Math.abs(again.top - before) <= 2, "a second move in a row keeps it too", JSON.stringify({ before, after: again }));
    const beforeDrag = await scrollToEnd();
    const target = await sp.locator(ROW("seed-ex-2")).boundingBox();
    await dragHandle(sp, "seed-ex-1", Math.round(target.y + target.height * 0.8));
    await sp.waitForTimeout(250);
    const afterDrag = await sp.evaluate(() => document.querySelector("#programEditorWrap").scrollTop);
    assert(Math.abs(afterDrag - beforeDrag) <= 2, "a drag-and-drop does not jump the editor back to its top", JSON.stringify({ beforeDrag, afterDrag }));
    assert(spErrors.length === 0, "no page errors while reordering on a short phone", spErrors.join(" | "));
    await shortContext.close();
  }

  await browser.close();
  console.log(`\nprogram editor sorting: ${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });
