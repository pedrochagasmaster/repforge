#!/usr/bin/env node
/**
 * Plan 081 profile and Plan 077 slow-rep answers and "Was the last rep slow?".
 *
 * - Progress and exercise profiles show standing and counts. Today has no gauge.
 * - The slow tap sits under an exercise's last logged set during its rest (owner: the last set only), never on the
 *   shelf: Next exercise stays live. An answer is stored on the set and reaches History; a second tap takes it back;
 *   the Settings switch turns the question off.
 * - isSafeLogRow accepts a boolean lastRepSlow and refuses anything else.
 *
 * Run: node test/profile-browser.mjs   (REPFORGE_URL points at a static server)
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
    await page.waitForFunction(n => { const d=window.__repforgeWorkoutDraft.current(), ex=d.exercises[d.exerciseOrder[0]]; return ex.setOrder.filter(id=>ex.sets[id].completion!=="pending").length===n; }, i+1);
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
  phase("The profile replaces the gauge, including on a first session");
  await boot(page, { history: [] });
  assert(await page.locator("#todayCalRing, #todayCalRingBar").count() === 0,
    "Today has no calibration ring before history exists");
  await page.click('[data-view="stats"]');
  await page.waitForSelector("#overviewProfile .profile-lift");
  assert(await page.locator("#overviewProfile .profile-lift").count() === program.length,
    "the profile includes every active program slot before history exists");
  assert((await page.locator("#overviewProfile").innerText()).includes("0 of 0"), "empty evidence is a count, not a target");

  await boot(page);
  assert(await page.locator("#todayCalRing, #todayCalRingBar").count() === 0, "Today has no ring after history either");
  await page.evaluate(() => window.scrollTo(0, 400));
  assert(await page.locator("#todayDash .calring").count() === 0, "the collapsed Today bar has no ring");
  await page.click('[data-view="stats"]');
  await page.waitForSelector("#overviewProfile .profile-lift");
  const profile = await page.locator("#overviewProfile").innerText();
  const names = await page.locator("#overviewProfile .profile-lift__name").allTextContents();
  assert(JSON.stringify(names) === JSON.stringify(program.map(ex => ex.name)), "profile rows follow training-day order", names);
  assert(await page.locator("#overviewProfile .profile-lift__standing").count() === program.length,
    "every program lift has its standing or an explicit unavailable reason");
  assert(!/%/.test(profile) && await page.locator("#overviewProfile [role=progressbar], #overviewProfile .calbar").count() === 0,
    "the profile has no percentage or bar", profile);
  assert(profile.includes("36 of 36 pairs") && profile.includes("15 of 15 week pairs") && profile.includes("0 of 0 sets"),
    "agreement, weeks and suggestion hits show agreed and counted, without target denominators", profile);
  const checks = await page.locator("#overviewProfile .calcheck").allTextContents();
  assert(checks.length === 1 && /Seated leg curl/.test(checks[0]) && /Guessed 10 → Did 12/.test(checks[0]),
    "recent test sets retain the guess and result", checks);
  assert(profile.includes("2 more test sets"), "per-lift test sets say what is still needed", profile);
  assert(profile.includes("Reps left") && profile.includes("54 of 54"), "effort stage and recent chosen effort counts are shown", profile);
  await page.click('[data-view="log"]');
  await page.locator('#todayExList [data-exopen]').first().click();
  await page.waitForSelector("#exDetail .exercise-profile");
  assert(await page.locator("#exDetail .exercise-profile .profile-lift").count() === 1,
    "the exercise page shows only its lift's profile below its recommendation");
  const overlaps = async () => page.evaluate(() => [...document.querySelectorAll("#overviewProfile .profile-signal")].flatMap(row => {
    const [label, value] = row.children, range = document.createRange();
    const boxes = el => { range.selectNodeContents(el); return [...range.getClientRects()]; };
    const hit = boxes(label).some(a => boxes(value).some(b => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5));
    return hit || row.scrollWidth > row.clientWidth + 1 ? [label.textContent] : [];
  }));
  await page.click("#exBack");
  await page.click('[data-view="stats"]');
  const sizes = [];
  for (const [lang, width] of [["pt", 390], ["en", 390], ["pt", 320], ["en", 320]]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(lang => { I18N.setLang(lang); document.documentElement.style.fontSize = "200%"; render(); }, lang);
    sizes.push([`${lang} ${width}`, await overlaps()]);
  }
  assert(sizes.every(([, rows]) => rows.length === 0), "counts wrap without overlap at 200% in PT/EN at 390/320", sizes);
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; I18N.setLang("en"); render(); });
  await page.setViewportSize({ width: 390, height: 844 });

  phase("Was the last rep slow? Only after an exercise's last set");
  await boot(page);
  await logFirstExercise(page, 1);
  assert(await slowLine(page) === null, "no question after a set that is not the exercise's last");
  await page.evaluate(() => document.querySelector("#workout .exercise.is-current .focus-shelf .saveset")?.click());
  await page.waitForSelector("#workout .exercise.is-current .ledgerslow");
  let line = await slowLine(page);
  assert(line?.pills === 2 && line.text === "Last rep slow? Yes No" && line.under === "2" && !line.inShelf,
    "after the last set, the question sits under that set's row, off the shelf", line);
  const next = await page.evaluate(() => { const b = document.querySelector("#workout .exercise.is-current [data-fnext]"); return !!b && !b.disabled; });
  assert(next, "Next exercise stays live under it");
  await page.locator("#workout .exercise.is-current .ledgerslow [data-v='0']").click();
  await page.waitForSelector("#workout .exercise.is-current [data-slowclear]");
  line = await slowLine(page);
  assert(line?.pills === 0 && line.text === "Last rep slow? No" && JSON.stringify(await firstSets(page)) === JSON.stringify(["unanswered", false]),
    "an answer is stored on the last set and stays as a word", { line, sets: await firstSets(page) });
  await page.locator("#workout .exercise.is-current .ledgerslow [data-slowclear]").click();
  await page.waitForSelector("#workout .exercise.is-current [data-slow]");
  assert(JSON.stringify(await firstSets(page)) === JSON.stringify(["unanswered", "unanswered"]) && (await slowLine(page))?.pills === 2,
    "a second tap takes the answer back and asks again");
  await page.locator("#workout .exercise.is-current .ledgerslow [data-v='1']").click();
  await page.waitForSelector("#workout .exercise.is-current [data-slowclear]");
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
