#!/usr/bin/env node
/**
 * Plan 077 PR 1, effort provenance, proved at the production boundary.
 *
 *   - A set whose effort the lifter never touched logs the value its field shows, and records that it was a prefill
 *     (effortSource "prefilled"); a label the lifter chose records "effort". Both reach History, in both replicas.
 *   - The live session reads the same value History saves (audit A5): the completed, untouched set feeds the engine's
 *     current-session anchor with its effort.
 *   - The app accepts a row's effortSource only from the enum, and never adds one to a row that has none.
 *   - hardRir is bounded to 1–10 (OD-23e).
 *
 * Run: node test/effort-provenance.mjs   (REPFORGE_URL points at a static server)
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
    s.settings = { ...(s.settings || {}), lang: "en", rirMode: "effort" };
    s.program = ${JSON.stringify(seedProgram())};
    s.programMeta = ${JSON.stringify(seedProgramMeta())};
    s.log = [];`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
  await page.evaluate(async () => { await window.__repforgeEnterWorkout({}); window.__repforgeFocus.to(0); });
  await page.waitForSelector(`${SHELF}`, { state: "attached", timeout: 5000 });

  phase("An untouched effort logs what its field shows, recorded as a prefill");
  await typeField(page, "load", 1, "50");
  await typeField(page, "reps", 1, "6");
  const exId = await page.evaluate(() => window.__repforgeWorkoutDraft.current().session.selectedExerciseId);
  const shown = await page.evaluate(() => document.querySelector('#workout .exercise.is-current .focus-shelf [data-shelf-field="effort"]')?.textContent || "");
  await page.locator(`${SHELF} .saveset`).click();
  await page.waitForFunction((id) => {
    const ex = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
    return ex && ex.sets[ex.setOrder[0]].completion !== "pending";
  }, exId, { timeout: 10000 });
  const first = await page.evaluate((id) => {
    const ex = window.__repforgeWorkoutDraft.current().exercises[id], set = ex.sets[ex.setOrder[0]];
    return { effort: set.edited.effort, source: set.completion.effortSource };
  }, exId);
  assert(first.source === "prefilled" && ["easy", "hard", "max"].includes(first.effort),
    "Log set on an untouched effort records effortSource prefilled and materialises the effort", { first, shown });

  phase("The live session reads the effort History will save (A5)");
  const live = await page.evaluate((id) => {
    const ex = window.__repforgeWorkoutDraft.current().exercises[id], set = ex.sets[ex.setOrder[0]];
    const metricIds = set.programmed.metrics.map((m) => m.id);
    const anchor = progressionCurrentSession({ slotId: id, exerciseId: ex.libraryId, metricIds });
    return { rows: anchor.length, rir: anchor[0]?.rir ?? null, mapped: { easy: 3, hard: 1, max: 0 }[set.edited.effort] };
  }, exId);
  assert(live.rows === 1 && live.rir === live.mapped, "the completed, untouched set feeds the current-session anchor with its effort", live);

  phase("A chosen label records effort");
  await typeField(page, "load", 2, "50");
  await typeField(page, "reps", 2, "6");
  await page.evaluate(async (id) => {
    const draft = window.__repforgeWorkoutDraft.current(), ex = draft.exercises[id];
    await window.__repforgeWorkoutDraft.dispatch("editSetField", { exerciseInstanceId: id, setId: ex.setOrder[1], field: "effort", value: "max" });
    await window.__repforgeWorkoutDraft.flush(); window.renderWorkout?.();
  }, exId);
  await page.locator(`${SHELF} .saveset`).click();
  await page.waitForFunction((id) => {
    const ex = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
    return ex && ex.sets[ex.setOrder[1]].completion !== "pending";
  }, exId, { timeout: 10000 });
  const second = await page.evaluate((id) => {
    const ex = window.__repforgeWorkoutDraft.current().exercises[id], set = ex.sets[ex.setOrder[1]];
    return { effort: set.edited.effort, source: set.completion.effortSource };
  }, exId);
  assert(second.source === "effort" && second.effort === "max", "a chosen label records effortSource effort", second);

  phase("An untouched numeric chip remains a prefill");
  await page.evaluate(() => window.__repforgeFocus.to(1));
  await page.locator(`${SHELF} [data-effmenu]`).click();
  await page.locator('#nativeContextMenu [data-menu-value="c"]').click();
  await page.waitForSelector("#nativeContextMenu", { state: "detached" });
  await page.evaluate(async () => { await window.__repforgeStorage.flush(); await window.__repforgeWorkoutDraft.flush(); });
  await page.evaluate(() => window.__repforgeFocus.to(0));
  const retainedWord = await page.locator('#workout .exercise.is-current [data-editn="1"] [data-lv="rir"]').textContent();
  assert(["Easy", "Hard", "Max"].includes(retainedWord.trim()),
    "a completed prefilled word keeps its vocabulary after a stage change", retainedWord);
  await page.evaluate(() => window.__repforgeFocus.to(1));
  await typeField(page, "load", 1, "50");
  await typeField(page, "reps", 1, "6");
  await page.locator(field("rir")).click();
  const numericShown = await page.locator(`${SHELF} .shelf__chip.is-offered`).textContent();
  await page.locator(`${SHELF} .saveset`).click();
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  const numeric = await page.evaluate(() => {
    const draft = window.__repforgeWorkoutDraft.current(), ex = draft.exercises[draft.exerciseOrder[1]], set = ex.sets[ex.setOrder[0]];
    return { rir: set.edited.rir, source: set.completion.effortSource };
  });
  assert(numeric.source === "prefilled" && Number(numeric.rir) === Number(numericShown.replace("+", "")),
    "an untouched numeric chip logs its displayed count with prefilled provenance", { numericShown, numeric });

  phase("History keeps the source, in both replicas");
  await finishEarly(page);
  const saved = await readReplicas(page);
  const rows = (replica) => replica.log.filter((row) => row.exerciseId === exId).sort((a, b) => a.set - b.set).map((row) => [row.set, row.rir, row.effortSource]);
  assert(JSON.stringify(rows(saved.local)) === JSON.stringify(rows(saved.idb)) &&
    rows(saved.local)[0]?.[2] === "prefilled" && rows(saved.local)[1]?.[2] === "effort" && rows(saved.local)[1]?.[1] === 0,
    "the saved rows say prefilled and effort beside their RIR, identically in localStorage and IndexedDB", rows(saved.local));

  phase("A History correction remains a measured RIR");
  await page.locator("#sumDone").click();
  await page.locator('nav [data-view="history"]').click();
  await page.locator('#sessions [data-edit]').first().click();
  await page.locator('[data-history-edit]').click();
  await page.locator('[data-ek="rir|0"]').fill("2");
  await page.locator('[data-edsave]').click();
  await page.waitForFunction(() => !document.querySelector(".session--edit"));
  const corrected = (await readReplicas(page)).local.log.find(row => row.exerciseId === exId && row.set === 1);
  assert(corrected.rir === 2 && corrected.effortSource === "rir" && corrected.rirMeasured === true,
    "History keeps corrections distinct from a reps-left report", corrected);

  phase("The app accepts the enum, refuses anything else, and never adds a source");
  const validity = await page.evaluate(() => {
    const base = JSON.parse(JSON.stringify(state));
    const row = base.log[0];
    const withSource = (value) => { const s = JSON.parse(JSON.stringify(base)); s.log[0] = { ...row, effortSource: value }; return window.__repforgeValidateStateShape(s); };
    const without = JSON.parse(JSON.stringify(base)); delete without.log[0].effortSource;
    return {
      accepted: ["rir", "effort", "reps_left", "reps_left_3plus", "reps_left_5plus", "unsure", "prefilled", "failure"].map(withSource),
      unknown: withSource("x"), number: withSource(1), absent: window.__repforgeValidateStateShape(without),
    };
  });
  assert(validity.accepted.every(Boolean) && !validity.unknown && !validity.number && validity.absent,
    "isSafeLogRow accepts each effortSource and a row without one, and refuses an unknown value", validity);
  await persist(page, `s.log = s.log.map((row) => { const copy = { ...row }; delete copy.effortSource; return copy; });`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
  const legacy = await readReplicas(page);
  assert(legacy.local.log.length > 0 && legacy.local.log.every((row) => !Object.hasOwn(row, "effortSource")),
    "a row without a source loads and stays without one: nothing is backfilled", legacy.local.log.map((row) => row.effortSource));

  phase("hardRir stays within 1–10 (OD-23e)");
  const bounds = await page.evaluate(() => [0, 1, 4, 10, 11, -2, "x"].map((v) => normalizeSettings({ hardRir: v }).hardRir));
  assert(JSON.stringify(bounds) === JSON.stringify([4, 1, 4, 10, 4, 4, 4]), "a hardRir outside 1–10 falls back to the default 4", bounds);
  assert(errors.length === 0, "no page errors", errors.join(" | "));
} finally {
  await browser.close();
}
console.log(`\nEffort provenance: ${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
