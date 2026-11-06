#!/usr/bin/env node
/**
 * Plan 077 PR 4 in the browser: the calibration-evidence gauge and "Was the last rep slow?".
 *
 * - Progress › Overview shows the gauge with its six signals and the recent test sets; Today shows the small row,
 *   from the first logged workout and not before.
 * - The slow tap sits under an exercise's last logged set during its rest (owner: the last set only), never on the
 *   shelf: Next exercise stays live. An answer is stored on the set and reaches History; a second tap takes it back;
 *   the Settings switch turns the question off.
 * - isSafeLogRow accepts a boolean lastRepSlow and refuses anything else.
 *
 * Run: node test/calibration-gauge-browser.mjs   (REPFORGE_URL points at a static server)
 */
import { launchChromium } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";
import { finishEarly } from "./fixtures/focus-workout.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}`); if (detail !== undefined) console.log(`    ${typeof detail === "string" ? detail : JSON.stringify(detail)}`); }
}
const phase = (n) => console.log(`\n${n}`);
const program = seedProgram();
const lifts = program.slice(0, 3);
const today = new Date().toISOString().slice(0, 10);
const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const log = [];
for (let w = 0; w < 6; w++) for (const ex of lifts) for (const set of [1, 2, 3]) log.push({ session: `s${w}`, date: day(42 - w * 7), day: ex.day, name: ex.name,
  exerciseId: ex.id, sourceLibraryId: ex.libraryId, set, load: 60, reps: 9 - set, rir: 2, notes: "", created: `${day(42 - w * 7)}T10:00:00.000Z`, primary: "", secondary: "", effortSource: "rir" });
log.push({ session: "s5", date: day(7), day: lifts[1].day, name: lifts[1].name, exerciseId: lifts[1].id, sourceLibraryId: lifts[1].libraryId, set: 4, load: 60, reps: 12, rir: 0,
  notes: "", created: `${day(7)}T10:30:00.000Z`, primary: "", secondary: "", effortSource: "failure", calibration: { v: 1, predictedReps: 10, predictionEdited: false, prefillBasis: "reps_rir" } });

async function boot(page, { history = log, settings = {} } = {}) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
  await page.evaluate(async ({ program, meta, history, settings }) => {
    window.stopRest?.();
    for (const key of Object.keys(localStorage)) if (key.startsWith("repforge_draft")) localStorage.removeItem(key);
    const k = "repforge_v1", s = JSON.parse(localStorage.getItem(k) || "{}");
    s.settings = { ...(s.settings || {}), lang: "en", rirMode: "numeric", slowRepTaps: true, ...settings }; s.program = program; s.programMeta = meta; s.log = history;
    localStorage.setItem(k, JSON.stringify(s));
    const db = await new Promise((res, rej) => { const r = indexedDB.open("repforge", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise((res, rej) => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(s, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  }, { program, meta: seedProgramMeta(), history, settings });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
  await page.evaluate(() => window.closeFirstRun?.());
  await page.waitForTimeout(400);
}
/** Enter the first day, fill the first exercise's sets through the draft, and log `n` of them through Log set. */
async function logFirstExercise(page, n) {
  await page.evaluate((day) => window.__repforgeEnterWorkout({ day }), program[0].day);
  await page.waitForSelector("#workout .exercise.is-current .focus-shelf .saveset", { timeout: 20000 });
  await page.evaluate(async () => {
    const api = window.__repforgeWorkoutDraft, d = api.current(), exId = d.exerciseOrder[0];
    for (const setId of d.exercises[exId].setOrder) {
      const set = d.exercises[exId].sets[setId];
      if (Array.isArray(set.programmed.metrics) && set.programmed.metrics.length) {
        for (const m of set.programmed.metrics) await api.dispatch("editMetricValue", { exerciseInstanceId: exId, setId, metricId: m.id, value: /rep/i.test(m.semantic) ? "8" : "60" });
      } else {
        await api.dispatch("editSetField", { exerciseInstanceId: exId, setId, field: "load", value: "60" });
        await api.dispatch("editSetField", { exerciseInstanceId: exId, setId, field: "reps", value: "8" });
      }
      await api.dispatch("editSetField", { exerciseInstanceId: exId, setId, field: "rir", value: "1" });
    }
    await api.flush();
  });
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => document.querySelector("#workout .exercise.is-current .focus-shelf .saveset")?.click());
    await page.waitForTimeout(900);
  }
}
const slowLine = (page) => page.evaluate(() => {
  const line = document.querySelector("#workout .exercise.is-current .ledgerslow");
  return line ? { text: [...line.children].map((el) => el.textContent.trim()).join(" "), pills: line.querySelectorAll("[data-slow]").length,
    under: line.previousElementSibling?.dataset.editn ?? null, inShelf: !!line.closest(".focus-shelf") } : null;
});
const firstSets = (page) => page.evaluate(() => {
  const d = window.__repforgeWorkoutDraft.current(), ex = d.exercises[d.exerciseOrder[0]];
  return ex.setOrder.map((id) => ex.sets[id].completion === "pending" ? "pending" : ex.sets[id].completion.lastRepSlow ?? "unanswered");
});

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
try {
  phase("No gauge before the first workout");
  await boot(page, { history: [] });
  assert(await page.evaluate(() => document.querySelector("#todayCalibration").classList.contains("hidden")), "Today shows no gauge with no logged workout");

  phase("The gauge on Today and Progress › Overview");
  await boot(page);
  const todayRow = await page.evaluate(() => { const el = document.querySelector("#todayCalibration"); return { hidden: el.classList.contains("hidden"), text: el.innerText.replace(/\s+/g, " ").trim() }; });
  assert(!todayRow.hidden && /^Effort calibration \d+%$/.test(todayRow.text), "Today shows the small row from the first workout", todayRow);
  await page.evaluate(() => document.querySelector('nav [data-view="stats"]')?.click());
  await page.waitForSelector("#overviewCalibration:not(.hidden) .calcard", { timeout: 10000 });
  const card = await page.evaluate(() => {
    const el = document.querySelector("#overviewCalibration");
    return { big: el.querySelector(".calcard__big b")?.textContent, overall: el.querySelector(".calcard__big span")?.textContent,
      signals: [...el.querySelectorAll(".calsig")].map((s) => [...s.querySelectorAll(":scope > span")].map((x) => x.textContent)),
      checks: [...el.querySelectorAll(".calcheck")].map((c) => c.innerText.replace(/\s+/g, " ").trim()) };
  });
  const today = Number(/\d+/.exec(todayRow.text)?.[0]);
  assert(card.big === `${today}%` && card.overall === "1 test set · 1 lift", "Overview's number matches Today's, with its test sets and lifts", { card, today });
  assert(card.signals.map((s) => s[0]).join() === "Test sets,Sets that agree,Hitting the suggestion,Week to week,Slow last rep,History" &&
    card.signals[0][1] === "1 of 8" && /^\d+ of 20 pairs · \d+% agree$/.test(card.signals[1][1]) && card.signals[2][1] === "0 of 20 sets" &&
    /^\d+ of 24 sets per lift$/.test(card.signals[5][1]),
  "each signal reads its evidence against its target, with the share that agrees", card.signals);
  assert(card.checks.length === 1 && /Seated leg curl/.test(card.checks[0]) && /Guessed 10 → Did 12/.test(card.checks[0]),
    "the recent test sets list the guess and the result", card.checks);

  phase("Was the last rep slow? Only after an exercise's last set");
  await boot(page);
  await logFirstExercise(page, 1);
  assert(await slowLine(page) === null, "no question after a set that is not the exercise's last");
  await page.evaluate(() => document.querySelector("#workout .exercise.is-current .focus-shelf .saveset")?.click());
  await page.waitForTimeout(900);
  let line = await slowLine(page);
  assert(line?.pills === 2 && line.text === "Last rep slow? Yes No" && line.under === "2" && !line.inShelf,
    "after the last set, the question sits under that set's row, off the shelf", line);
  const next = await page.evaluate(() => { const b = document.querySelector("#workout .exercise.is-current [data-fnext]"); return !!b && !b.disabled; });
  assert(next, "Next exercise stays live under it");
  await page.locator("#workout .exercise.is-current .ledgerslow [data-v='0']").click();
  await page.waitForTimeout(400);
  line = await slowLine(page);
  assert(line?.pills === 0 && line.text === "Last rep slow? No" && JSON.stringify(await firstSets(page)) === JSON.stringify(["unanswered", false]),
    "an answer is stored on the last set and stays as a word", { line, sets: await firstSets(page) });
  await page.locator("#workout .exercise.is-current .ledgerslow [data-slowclear]").click();
  await page.waitForTimeout(400);
  assert(JSON.stringify(await firstSets(page)) === JSON.stringify(["unanswered", "unanswered"]) && (await slowLine(page))?.pills === 2,
    "a second tap takes the answer back and asks again");
  await page.locator("#workout .exercise.is-current .ledgerslow [data-v='1']").click();
  await page.waitForTimeout(300);
  await finishEarly(page);
  const saved = await page.evaluate((name) => JSON.parse(localStorage.getItem("repforge_v1")).log
    .filter((row) => !/^s\d$/.test(String(row.session)) && (row.name === name || row.performedName === name)).map((row) => row.lastRepSlow ?? null), program[0].name);
  assert(JSON.stringify(saved) === JSON.stringify([null, true]), "the answer reaches the last set's History row and no other", saved);

  phase("The switch turns the question off");
  await boot(page, { settings: { slowRepTaps: false } });
  await logFirstExercise(page, 2);
  assert(await slowLine(page) === null, "with the switch off there is no question");

  phase("The app validates the answer");
  const validity = await page.evaluate(() => {
    const base = JSON.parse(JSON.stringify(state));
    const shape = (value) => { const s = JSON.parse(JSON.stringify(base)); s.log[0] = { ...s.log[0], lastRepSlow: value }; return window.__repforgeValidateStateShape(s); };
    return { yes: shape(true), no: shape(false), text: shape("yes"), one: shape(1) };
  });
  assert(validity.yes && validity.no && !validity.text && !validity.one, "isSafeLogRow accepts a boolean lastRepSlow and refuses anything else", validity);
  assert(errors.length === 0, "no page errors", errors);
} finally {
  await browser.close();
}
console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
