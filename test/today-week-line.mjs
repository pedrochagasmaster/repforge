#!/usr/bin/env node
/** Plan 057-P6: Today keeps block position and one calendar-week line distinct. */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { assertServingApp } from "./browser.mjs";
import { installSeedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";

function ymd(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function persist(page, state) {
  await page.evaluate(async ({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(state, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { key: KEY, state });
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "UTC" });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
  await installSeedProgram(page, { key: KEY, waitFor: async current => current.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 }) });
  const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || "{}"), KEY);
  const today = ymd();
  await persist(page, {
    ...state,
    programMeta: seedProgramMeta({ id: "today-week-line", started: ymd(-10), blockId: "today-block" }),
    log: [{ session: "today-week", date: today, day: "Day 1", exerciseId: "seed-ex-1", name: "Hack squat", load: 60, reps: 8, rir: 2, set: 1, work: true, created: `${today}T12:00:00.000Z`, primary: "Quads", secondary: "Glutes" }],
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
  const observed = await page.evaluate(() => {
    const weekly = window.__repforgeWeeklySnapshot();
    const block = window.__repforgeMesocycleWeek();
    const expectedWeekly = window.RepForgeI18n.t("today.sessions_done", { done: weekly.completedDays, planned: weekly.plannedDays });
    const expectedBlock = block.current == null ? "" : window.RepForgeI18n.t("today.week_of", { n: block.current, total: block.total });
    const visible = node => node && !node.hidden && !node.closest("[hidden],.hidden");
    const weeklyNodes = [...document.querySelectorAll("#todayDash *")].filter(node => visible(node) && node.children.length === 0 && node.textContent.trim() === expectedWeekly);
    return {
      weekly,
      block,
      expectedWeekly,
      expectedBlock,
      weeklyNodes: weeklyNodes.map(node => ({ id: node.id, className: node.className, text: node.textContent.trim() })),
      programDoneVisible: visible(document.querySelector(".today-prog__done")),
      programDoneText: document.querySelector(".today-prog__done")?.textContent.trim() || "",
      blockText: document.querySelector("#todayProgram .today-prog__week")?.textContent.trim() || "",
      calendarLine: document.querySelector("#todayWeek .ov-week-line")?.textContent.trim() || "",
    };
  });
  assert.equal(observed.weeklyNodes.length, 1, "Today exposes exactly one accessible calendar-week completion line");
  assert.equal(observed.weeklyNodes[0]?.id, "", "the completion line belongs to the calendar-week surface, not the block strip");
  assert.equal(!!observed.programDoneVisible, false, "the block strip has no duplicate calendar-week sentence");
  assert.equal(observed.calendarLine, observed.expectedWeekly, "the surviving line uses weeklySnapshot calendar values");
  assert.equal(observed.blockText, observed.expectedBlock, "block position remains mesocycle-owned");
  assert.notEqual(observed.expectedBlock, observed.expectedWeekly, "the two week ranges stay distinguishable");
  await context.close();
} finally {
  await browser.close();
}
