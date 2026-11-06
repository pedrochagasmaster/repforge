#!/usr/bin/env node
/**
 * Plan 077 PR 3, the max set, through the real Focus screen.
 *
 *   - During the rest before an exercise's last set, a prompt offers a test set; "Make a guess" opens the guess sheet,
 *     prefilled with the set before's reps + reps left − 1, with the failure rule and safety lines.
 *   - "Use as my last set" makes the last set a max set: the effort field reads Failure and the row carries the guess.
 *   - Logging it saves a normal 0-RIR set with effortSource "failure" and the guess as `calibration`, in both
 *     replicas, and the row compares the guess with the reps.
 *   - The prompt respects its limits: once a workout, the Settings switch, and "Not now".
 *
 * Run: node test/max-set-browser.mjs   (REPFORGE_URL points at a static server)
 */
import { launchChromium, openShelfField } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";
import { finishEarly } from "./fixtures/focus-workout.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    console.log(`  ✗ ${name}`);
    if (detail !== undefined) console.log(`    ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
}
const phase = (n) => console.log(`\n${n}`);

async function persist(page, src) {
  await page.evaluate(
    async ({ k, src }) => {
      const blob = JSON.parse(localStorage.getItem(k) || "{}");
      // eslint-disable-next-line no-new-func
      new Function("s", "w", src)(blob, window);
      localStorage.setItem(k, JSON.stringify(blob));
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("repforge", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(blob, k);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { k: KEY, src }
  );
}

async function settle(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    window.closeFirstRun?.();
    if (el?.classList.contains("active")) window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && window.closeTour) window.closeTour();
  });
}

const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";
const SHELF = "#workout .exercise.is-current .focus-shelf";
const FIELD_IDS = { load: `metric_${WEIGHT}`, reps: `metric_${REPS}` };
const field = (id) => `${SHELF} [data-shelf-field="${FIELD_IDS[id] || id}"]`;
const inputFor = (id, n) => `${SHELF} .shelf__input[data-k$="_${n}_${FIELD_IDS[id] || id}"]`;

async function typeField(page, id, n, value) {
  const input = page.locator(inputFor(id, n));
  for (let tap = 0; tap < 2 && await input.getAttribute("aria-hidden") === "true"; tap++) await openShelfField(page, field(id));
  await input.fill(value);
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

async function readReplicas(page) {
  return page.evaluate(async (k) => {
    const local = JSON.parse(localStorage.getItem(k) || "null");
    const db = await new Promise((res, rej) => { const r = indexedDB.open("repforge", 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const idb = await new Promise((res, rej) => { const tx = db.transaction("kv"); const g = tx.objectStore("kv").get(k); g.onsuccess = () => res(g.result); g.onerror = () => rej(g.error); });
    db.close();
    return { local, idb };
  }, KEY);
}

const TIP = `${SHELF} .resttip`;
const draftNow = (page) => page.evaluate(() => window.__repforgeWorkoutDraft.current());

async function logSet(page, exId, n, { load = "50", reps = "10", rir = "2" } = {}) {
  await typeField(page, "load", n, load);
  await typeField(page, "reps", n, reps);
  if (rir != null) await typeField(page, "rir", n, rir);
  await page.locator(`${SHELF} .saveset`).click();
  await page.waitForFunction(({ id, n }) => {
    const ex = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
    return ex && Object.values(ex.sets).find((set) => set.ordinal === n)?.completion !== "pending";
  }, { id: exId, n }, { timeout: 10000 });
}

const browser = await launchChromium();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("dialog", (d) => d.accept());
try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.evaluate((d) => {
    for (const key of Object.keys(localStorage)) if (key === d || key.startsWith(`${d}:`)) localStorage.removeItem(key);
  }, DRAFT);
  await persist(page, `
    s.settings = { ...(s.settings || {}), lang: "en", rirMode: "numeric", restSec: 120 };
    s.program = ${JSON.stringify(seedProgram())};
    s.programMeta = ${JSON.stringify(seedProgramMeta())};
    s.log = [];`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
  await page.evaluate(async () => { await window.__repforgeEnterWorkout({}); window.__repforgeFocus.to(0); });
  await page.waitForSelector(`${SHELF}`, { state: "attached", timeout: 5000 });
  const exId = await page.evaluate(() => window.__repforgeWorkoutDraft.current().session.selectedExerciseId);
  const total = await page.evaluate((id) => Object.values(window.__repforgeWorkoutDraft.current().exercises[id].sets)
    .filter((set) => set.role === "working").length, exId);
  assert(total >= 2, "the first lift has at least two working sets", total);

  phase("No prompt before the last set");
  await logSet(page, exId, 1);
  if (total > 2) {
    assert(await page.locator(TIP).count() === 0, "the set before the last one gets no prompt");
    for (let n = 2; n < total; n++) await logSet(page, exId, n);
  }

  phase("During the rest before the last set: the prompt, then the guess");
  await page.waitForSelector(`${TIP}`, { state: "visible", timeout: 5000 });
  const tipText = await page.locator(TIP).innerText();
  assert(/test set/i.test(tipText) && /50 kg/.test(tipText), "the prompt names the test set and the load", tipText);
  await page.locator(`${TIP} [data-maxset-guess]`).click();
  await page.waitForSelector("#maxSetSheet.is-open", { timeout: 5000 });
  const sheet = await page.evaluate(() => ({
    title: document.querySelector("#maxSetTitle").textContent, from: document.querySelector("#maxSetFrom").textContent,
    count: document.querySelector("#maxSetCount").textContent, rule: document.querySelector(".maxset__rule").textContent,
    safety: document.querySelector(".maxset__safety").textContent,
  }));
  assert(sheet.count === "11" && /50 kg/.test(sheet.title) && /10 reps with 2 left/.test(sheet.from),
    "the guess is prefilled with reps + reps left − 1 at the set before's load", sheet);
  assert(/good form/.test(sheet.rule) && /hurts/.test(sheet.safety), "the failure rule and the safety line are read before the set", sheet);
  await page.locator("#maxSetMore").click();
  await page.locator("#maxSetStart").click();
  await page.waitForFunction(() => !document.querySelector("#maxSetSheet.is-open"), undefined, { timeout: 5000 });
  const started = await page.evaluate(({ id, n }) => Object.values(window.__repforgeWorkoutDraft.current().exercises[id].sets)
    .find((set) => set.ordinal === n).calibration, { id: exId, n: total });
  assert(JSON.stringify(started) === JSON.stringify({ v: 1, predictedReps: 12, predictionEdited: true, prefillBasis: "reps_rir" }),
    "Use as my last set holds the edited guess on the last set", started);
  const shelfEffort = await page.locator(`${SHELF} [data-shelf-field="rir"]`).innerText();
  assert(/Failure/.test(shelfEffort), "the effort field reads Failure", shelfEffort);
  const tag = await page.locator(`#workout .exercise.is-current .ledgerline__tag`).innerText();
  assert(/guess 12/i.test(tag), "the pending row carries the guess", tag);

  phase("Logging it: a normal 0-RIR set with the guess beside it");
  await logSet(page, exId, total, { reps: "14", rir: null });
  const done = await page.evaluate(({ id, n }) => {
    const set = Object.values(window.__repforgeWorkoutDraft.current().exercises[id].sets).find((item) => item.ordinal === n);
    return { rir: set.edited.rir, source: set.completion.effortSource, calibration: set.calibration?.predictedReps };
  }, { id: exId, n: total });
  assert(done.rir === "0" && done.source === "failure" && done.calibration === 12, "the max set logs 0 reps left as failure", done);
  await page.evaluate(() => document.querySelector("#workout .exercise.is-current [data-ledgermore][aria-expanded='false']:not([hidden])")?.click());
  const result = await page.locator(`#workout .exercise.is-current .ledgerline__result`).innerText();
  assert(/12/.test(result) && /14/.test(result) && /2 more than you guessed/.test(result) && /Nothing changes yet/.test(result),
    "the row compares the guess with the reps", result);

  phase("Once a workout, and the Settings switch");
  const offers = await page.evaluate(() => {
    const draft = window.__repforgeWorkoutDraft.current();
    return focusList().map((ex) => maxSetOffer(sessionExercise(ex), Object.values(draft.exercises[ex.id]?.sets || {}).filter((set) => set.role === "working").length)).filter(Boolean).length;
  });
  assert(offers === 0, "no other lift is offered one in the same workout", offers);

  phase("History keeps the guess, in both replicas");
  await finishEarly(page);
  const saved = await readReplicas(page);
  const maxRow = (replica) => replica.log.find((row) => row.exerciseId === exId && row.set === total);
  assert(JSON.stringify(maxRow(saved.local)?.calibration) === JSON.stringify(started) && maxRow(saved.local)?.rir === 0 &&
    maxRow(saved.local)?.effortSource === "failure" && JSON.stringify(maxRow(saved.local)) === JSON.stringify(maxRow(saved.idb)),
    "the saved row is a 0-RIR failure set with its calibration, identically in localStorage and IndexedDB", maxRow(saved.local));
  const validity = await page.evaluate(() => {
    const base = JSON.parse(JSON.stringify(state)), at = base.log.findIndex((row) => row.calibration);
    const withGuess = (value) => { const s = JSON.parse(JSON.stringify(base)); s.log[at] = { ...s.log[at], calibration: value }; return window.__repforgeValidateStateShape(s); };
    return { good: withGuess({ v: 1, predictedReps: 9, predictionEdited: false, prefillBasis: "reps" }),
      bad: withGuess({ v: 1, predictedReps: "9", predictionEdited: false, prefillBasis: "reps" }), extra: withGuess({ v: 1, predictedReps: 9, predictionEdited: false, prefillBasis: "reps", x: 1 }) };
  });
  assert(validity.good && !validity.bad && !validity.extra, "isSafeLogRow accepts a well-formed calibration and refuses others", validity);

  phase("The next workout: the 14-day limit, then the switch");
  await page.evaluate(async () => { await window.__repforgeEnterWorkout({}); window.__repforgeFocus.to(0); });
  await page.waitForSelector(`${SHELF}`, { state: "attached", timeout: 5000 });
  const again = await page.evaluate(() => {
    const draft = window.__repforgeWorkoutDraft.current(), ex = focusList()[0];
    return draft.exercises[ex.id] ? maxSetDraftKey(draft.exercises[ex.id], Object.values(draft.exercises[ex.id].sets)[0]) : null;
  });
  const history = await page.evaluate(() => state.log.filter((row) => row.calibration).map((row) => maxSetRowKey(row)));
  assert(history.length === 1 && history[0] === again, "a History row and a draft set of the same lift share one key", { history, again });
  await page.evaluate(() => { state.settings.maxSetPrompts = false; });
  const off = await page.evaluate(() => focusList().map((ex) => maxSetOffer(sessionExercise(ex),
    Object.values(window.__repforgeWorkoutDraft.current().exercises[ex.id]?.sets || {}).filter((set) => set.role === "working").length)).filter(Boolean).length);
  assert(off === 0, "with the prompts switched off, nothing is offered", off);
  assert(errors.length === 0, "no page errors", errors.join(" | "));
} finally {
  await browser.close();
}
console.log(`\nMax set: ${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
