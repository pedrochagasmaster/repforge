#!/usr/bin/env node
/**
 * Plan 077 PR 2: the three effort stages on the real Focus screen.
 *
 * - Stage A sets its word with one tap on a chip; stage B offers 0 · 1 · 2 · 3+.
 * - The effort field's arrow opens the menu: the three stages, the app's checked, and "Not sure" for this set (OD-2).
 * - A switch applies app-wide from the next set on (OD-5): sets already logged keep what was entered and how, the
 *   live draft takes the new mode in the same commit, and the stage is a device-local `effortScale` beside `rirMode`.
 * - The stage tip (OD-6) shows in a rest only, after 6 qualifying workouts, never once the next set is being entered;
 *   a dismissal keeps it quiet for 4 weeks and a second ends it.
 *
 * Run: node test/effort-stages.mjs   (REPFORGE_URL points at a static server)
 */
import { launchChromium } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";
import { finishEarly } from "./fixtures/focus-workout.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const SHELF = "#workout .exercise.is-current .focus-shelf";

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else {
    results.failed++; console.log(`  ✗ ${name}`);
    if (detail !== undefined) console.log(`    ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
}
const phase = (n) => console.log(`\n${n}`);

/** Six earlier workouts whose working sets the lifter gave a word: enough for the A→B tip. */
const qualifyingLog = (source = "effort") => Array.from({ length: 6 }, (_, i) => [1, 2, 3].map((set) => {
  const date = `2026-10-${String(10 + i).padStart(2, "0")}`;
  return { session: `earlier-${i}`, date, day: "Day 1", name: "Earlier lift", exerciseId: "earlier", set, load: 50, reps: 8, rir: 1,
    notes: "", created: `${date}T10:00:00.000Z`, primary: "Chest", secondary: "", effortSource: source };
})).flat();

async function boot(page, { settings = {}, log = [], uiPrefs = null } = {}) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
  await page.evaluate(async ({ k, settings, program, meta, log, uiPrefs }) => {
    window.stopRest?.();
    for (const key of Object.keys(localStorage)) if (key.startsWith("repforge_draft")) localStorage.removeItem(key);
    const s = JSON.parse(localStorage.getItem(k) || "{}");
    s.settings = { ...(s.settings || {}), lang: "en", rirMode: "numeric", effortScale: "feel", ...settings };
    s.program = program; s.programMeta = meta; s.log = log;
    localStorage.setItem(k, JSON.stringify(s));
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("repforge", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(s, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
    window.__repforgeUi?.setPref?.("stageTip", uiPrefs?.stageTip ?? {});
  }, { k: KEY, settings, program: seedProgram(), meta: seedProgramMeta(), log, uiPrefs });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
  await page.evaluate(() => window.closeFirstRun?.());
  const day = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).program[0].day, KEY);
  await page.evaluate((day) => window.__repforgeEnterWorkout({ day }), day);
  await page.waitForSelector(`${SHELF} .saveset`, { timeout: 20000 });
  // Load and reps for the first set only: the next set stays untouched, the way a lifter meets it in the rest.
  await page.evaluate(async () => {
    const api = window.__repforgeWorkoutDraft, d = api.current();
    const exId = d.exerciseOrder[0], setId = d.exercises[exId].setOrder[0], set = d.exercises[exId].sets[setId];
    if (Array.isArray(set.programmed.metrics) && set.programmed.metrics.length) {
      for (const m of set.programmed.metrics) await api.dispatch("editMetricValue", { exerciseInstanceId: exId, setId, metricId: m.id, value: /rep/i.test(m.semantic) ? "8" : "60" });
    } else {
      await api.dispatch("editSetField", { exerciseInstanceId: exId, setId, field: "load", value: "60" });
      await api.dispatch("editSetField", { exerciseInstanceId: exId, setId, field: "reps", value: "8" });
    }
    await api.flush();
    window.__repforgeFocus?.to?.(0);
  });
  await page.waitForTimeout(400);
}

const shelfState = (page) => page.evaluate((shelf) => ({
  label: document.querySelector(`${shelf} [data-field="rir"] .shelf__lab`)?.textContent?.trim(),
  value: document.querySelector(`${shelf} [data-field="rir"] .shelf__val`)?.textContent?.trim(),
  chips: [...document.querySelectorAll(`${shelf} .shelf__chip`)].map((b) => b.textContent.trim()),
  pressed: [...document.querySelectorAll(`${shelf} .shelf__chip[aria-pressed="true"]`)].map((b) => b.textContent.trim()),
  head: [...document.querySelectorAll("#workout .exercise.is-current .ledgerline__head .fx-col")].map((s) => s.textContent.trim()).at(-1),
  open: document.querySelector(`${shelf} .saveset`)?.dataset.save,
}), SHELF);
const firstSets = (page) => page.evaluate(() => {
  const d = window.__repforgeWorkoutDraft.current(), ex = d.exercises[d.exerciseOrder[0]];
  return { mode: d.program.rirMode, sets: ex.setOrder.map((id) => {
    const set = ex.sets[id];
    return { effort: set.edited.effort ?? null, rir: set.edited.rir ?? null, source: set.completion === "pending" ? null : set.completion.effortSource };
  }) };
});
const settings = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).settings, KEY);
async function chooseInMenu(page, value) {
  await page.locator(`${SHELF} [data-effmenu]`).click();
  await page.waitForSelector("#nativeContextMenu[open]");
  const menu = await page.evaluate(() => ({
    title: document.querySelector("#nativeContextMenu .native-context__title")?.textContent?.trim(),
    items: [...document.querySelectorAll("#nativeContextMenu [data-menu-value]")].map((b) => ({
      value: b.dataset.menuValue, checked: b.getAttribute("aria-checked"), group: b.classList.contains("is-group") })),
  }));
  await page.locator(`#nativeContextMenu [data-menu-value="${value}"]`).click();
  await page.waitForSelector("#nativeContextMenu", { state: "detached" });
  await page.evaluate(async () => { await window.__repforgeWorkoutDraft.flush(); await window.__repforgeStorage?.flush?.(); });
  await page.waitForTimeout(300);
  return menu;
}
const logOpenSet = async (page) => {
  await page.locator(`${SHELF} .saveset`).click();
  await page.evaluate(async () => { await window.__repforgeWorkoutDraft.flush(); });
  await page.waitForTimeout(500);
};
const tip = (page) => page.evaluate(() => {
  const el = document.querySelector(".resttip");
  return el ? { id: el.dataset.tip, to: el.dataset.to, text: el.textContent.trim() } : null;
});
const tipPrefs = (page) => page.evaluate(() => window.__repforgeUi?.loadUiPrefs?.()?.stageTip ?? null);

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

try {
  phase("Stage A: one tap on the word");
  await boot(page, { settings: { rirMode: "effort" } });
  await page.locator(`${SHELF} [data-shelf-field="rir"]`).click();
  let st = await shelfState(page);
  assert(st.label === "Effort" && st.chips.join() === "Easy,Hard,Max" && st.pressed.length === 0 && st.head === "Effort",
    "stage A offers Easy, Hard and Max as chips, none pressed before the lifter chooses", st);
  await page.locator(`${SHELF} .shelf__chip[data-e="max"]`).click();
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  st = await shelfState(page);
  let draft = await firstSets(page);
  assert(st.value === "Max" && st.pressed.join() === "Max" && draft.sets[0].effort === "max",
    "a chip sets the word in the field, the chips and the draft", { st, draft });

  phase("The arrow menu switches to stage B from the next set");
  let menu = await chooseInMenu(page, "b");
  assert(menu.title === "How you log effort" && menu.items.map((i) => i.value).join() === "a,b,c,unsure" &&
    menu.items[0].checked === "true" && menu.items[3].group && menu.items[3].checked === null,
    "the menu lists the three stages, the current one checked, and Not sure under them", menu);
  draft = await firstSets(page);
  let s = await settings(page);
  assert(s.rirMode === "effort" && s.effortScale === "reps" && draft.mode === "effort",
    "stage B is rirMode effort with effortScale reps, and the live draft agrees", { s, mode: draft.mode });
  st = await shelfState(page);
  assert(st.value === "Max" && st.chips.join() === "Easy,Hard,Max",
    "the set the lifter already entered keeps its word", st);
  await logOpenSet(page);
  draft = await firstSets(page);
  st = await shelfState(page);
  assert(draft.sets[0].effort === "max" && draft.sets[0].source === "effort",
    "set 1 logs the word it was entered with", draft.sets[0]);
  await page.locator(`${SHELF} [data-shelf-field="rir"]`).click();
  st = await shelfState(page);
  assert(st.label === "Reps left" && st.chips.join() === "0,1,2,3+" && st.head === "Left",
    "the next set asks for reps left: 0 · 1 · 2 · 3+, and the column is named Left", st);
  await page.locator(`${SHELF} .shelf__chip[data-e="r3p"]`).click();
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await logOpenSet(page);
  draft = await firstSets(page);
  assert(draft.sets[1].effort === "r3p" && draft.sets[1].source === "reps_left_3plus",
    "3+ logs as reps_left_3plus", draft.sets[1]);
  const rows = await page.evaluate(() => [...document.querySelectorAll("#workout .exercise.is-current .ledgerline[data-editn]")]
    .map((row) => [...row.querySelectorAll(".ledgerline__vals > .fx-col")].at(-1)?.textContent?.trim()));
  assert(rows.join() === "Max,3+", "each logged row reads back in its own vocabulary", rows);

  phase("Not sure for this set, then numeric RIR");
  await boot(page, { settings: { rirMode: "effort", effortScale: "reps" } });
  await chooseInMenu(page, "unsure");
  st = await shelfState(page);
  draft = await firstSets(page);
  assert(st.value === "Not sure" && draft.sets[0].effort === "unsure" && draft.mode === "effort",
    "Not sure is this set's value and leaves the stage as it was", { st, draft });
  await logOpenSet(page);
  draft = await firstSets(page);
  assert(draft.sets[0].source === "unsure", "a Not sure set logs as unsure", draft.sets[0]);
  menu = await chooseInMenu(page, "c");
  draft = await firstSets(page);
  s = await settings(page);
  st = await shelfState(page);
  assert(s.rirMode === "numeric" && s.effortScale === "reps" && draft.mode === "numeric" && st.label === "RIR" && st.head === "RIR",
    "stage C switches the setting and the draft to numeric and keeps the scale for a return to words", { s, mode: draft.mode, st });
  await page.locator(`${SHELF} [data-shelf-field="rir"]`).click();
  await page.locator(`${SHELF} .shelf__pad[data-dir="1"]`).click();
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await logOpenSet(page);
  await finishEarly(page);
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).log.filter((row) => row.session)
    .slice(0, 2).map((row) => ({ rir: row.rir, source: row.effortSource })), KEY);
  assert(saved[0]?.rir === null && saved[0]?.source === "unsure" && Number.isFinite(saved[1]?.rir) && saved[1]?.source === "rir",
    "History keeps Not sure as unknown effort and the next set as RIR", saved);

  phase("Settings keeps the stage on this device");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
  s = await settings(page);
  const shared = await page.evaluate(() => window.__repforgeUi?.sharedSettings?.() ?? null);
  assert(s.effortScale === "reps" && shared && !("effortScale" in shared) && shared.rirMode === s.rirMode,
    "effortScale survives a reload and stays out of the shared settings", { s, shared });

  phase("The stage tip, between sets only");
  await boot(page, { settings: { rirMode: "effort" }, log: qualifyingLog("prefilled") });
  await logOpenSet(page);
  assert(await tip(page) === null, "no tip when the earlier words were only accepted, not chosen");
  await boot(page, { settings: { rirMode: "effort" }, log: qualifyingLog() });
  assert(await tip(page) === null, "no tip before a set is logged: there is no rest");
  await logOpenSet(page);
  let shown = await tip(page);
  assert(shown?.id === "stage-tip" && shown.to === "b" && /reps left/i.test(shown.text),
    "after 6 qualifying workouts the tip suggests reps left during the rest", shown);
  const cta = await page.evaluate((shelf) => {
    const button = document.querySelector(`${shelf} .saveset`), r = button.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const t = document.querySelector(".resttip").getBoundingClientRect(), fields = document.querySelector(`${shelf} .shelf__fields`).getBoundingClientRect();
    return { live: !button.disabled && button.contains(at), clear: t.bottom <= fields.top };
  }, SHELF);
  assert(cta.live && cta.clear, "the tip leaves the shelf clear and Log set live under it", cta);
  await page.locator(`${SHELF} [data-shelf-field="rir"]`).click();
  await page.waitForTimeout(200);
  assert(await tip(page) === null, "entering the next set puts the tip away");

  await boot(page, { settings: { rirMode: "effort" }, log: qualifyingLog() });
  await logOpenSet(page);
  await page.locator(".resttip .resttip__no").click();
  let pref = await tipPrefs(page);
  const days = pref?.b?.until ? (Date.parse(pref.b.until) - Date.now()) / 864e5 : 0;
  assert(await tip(page) === null && pref?.b?.n === 1 && days > 27.9 && days <= 28,
    "Not now hides it and keeps it quiet for 4 weeks", pref);
  await boot(page, { settings: { rirMode: "effort" }, log: qualifyingLog(), uiPrefs: { stageTip: pref } });
  await logOpenSet(page);
  assert(await tip(page) === null, "inside the 4 weeks it stays quiet");
  await boot(page, { settings: { rirMode: "effort" }, log: qualifyingLog(), uiPrefs: { stageTip: { b: { n: 1, until: "2020-01-01T00:00:00.000Z" } } } });
  await logOpenSet(page);
  shown = await tip(page);
  assert(shown?.to === "b", "after the 4 weeks it comes back", shown);
  await page.locator(".resttip .resttip__x").click();
  pref = await tipPrefs(page);
  await boot(page, { settings: { rirMode: "effort" }, log: qualifyingLog(), uiPrefs: { stageTip: pref } });
  await logOpenSet(page);
  assert(pref?.b?.n === 2 && await tip(page) === null, "a second dismissal ends it", pref);

  await boot(page, { settings: { rirMode: "effort" }, log: qualifyingLog() });
  await logOpenSet(page);
  await page.locator(".resttip .resttip__yes").click();
  await page.waitForTimeout(500);
  s = await settings(page);
  st = await shelfState(page);
  assert(s.effortScale === "reps" && await tip(page) === null && st.label === "Reps left",
    "Try it switches to reps left from the next set", { s, st });
  await boot(page, { settings: { rirMode: "effort", effortScale: "reps" }, log: qualifyingLog("reps_left") });
  await logOpenSet(page);
  shown = await tip(page);
  assert(shown?.to === "c", "after 6 steady reps-left workouts it suggests RIR as a number", shown);
  await boot(page, { settings: { rirMode: "numeric" }, log: qualifyingLog("rir") });
  await logOpenSet(page);
  assert(await tip(page) === null, "it never suggests a stage down");
  assert(errors.length === 0, "no page errors", errors);
} finally {
  await browser.close();
}
console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
