#!/usr/bin/env node
/**
 * Plan 057-P5: the completion summary consumes canonical evidence and keeps
 * muscle work numeric. This is deliberately separate from the broad summary
 * interaction suite so the producer/rendering boundary stays explicit.
 */
import assert from "node:assert/strict";
import { assertServingApp, launchChromium } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";
import { metricLogRow } from "./fixtures/history-metric-rows.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const program = seedProgram();
const meta = seedProgramMeta({ id: "management-summary", started: "2026-09-14", blockId: "block-current" });
// Saved rows in the shape a finished DraftV2 workout commits: one Weight+Reps
// set per lift, so the outcome reads the canonical metric evidence.
const row = (session, date, id, load) => metricLogRow(meta, program.find((ex) => ex.id === id), {
  session, date, day: "Day 1", set: 1, load, reps: 8, rir: 2, created: `${date}T09:00:00.000Z`,
});
const previous = [row("sum-previous", "2026-09-16", "seed-ex-3", 55), row("sum-previous", "2026-09-16", "seed-ex-4", 50)];
const current = [row("sum-current", "2026-09-17", "seed-ex-3", 60), row("sum-current", "2026-09-17", "seed-ex-4", 50)];
const liftKeys = ["seed-ex-3", "seed-ex-4"].map((id) => `library:${program.find((ex) => ex.id === id).libraryId}`);

async function boot(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
}

async function seed(page) {
  await page.evaluate(async ({ key, program, meta, log }) => {
    const raw = JSON.parse(localStorage.getItem(key) || "{}");
    const next = { ...raw, program, programMeta: meta, log, programHistory: [], settings: { ...raw.settings, lang: "en", unit: "kg", rirMode: "numeric", hardRir: 4 } };
    localStorage.setItem(key, JSON.stringify(next));
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(next, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { key: KEY, program, meta, log: [...previous, ...current] });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
}

const browser = await launchChromium();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "UTC" });
  const page = await context.newPage();
  await boot(page);
  assert.equal(await page.locator("#todayExList [data-exopen]").count(),0,"fresh device has no fabricated prescription");
  await seed(page);
  // The extracted dashboard consumes engine-derived rows and keeps rendering readonly.
  const todayBefore = await page.evaluate(() => ({state:localStorage.getItem("repforge_v1"),draft:localStorage.getItem("repforge_draft_v1")}));
  await page.locator('nav button[data-view="stats"]').click();
  await page.locator('nav button[data-view="log"]').click();
  const todayView = await page.evaluate(() => ({
    rows:[...document.querySelectorAll("#todayExList [data-exopen]")].map(row=>({id:row.dataset.exopen,name:row.querySelector(".rxrow__name")?.textContent,load:row.querySelector(".rxrow__load")?.textContent,target:row.querySelector(".rxrow__target")?.textContent})),
    state:localStorage.getItem("repforge_v1"),draft:localStorage.getItem("repforge_draft_v1"),
    week:document.querySelectorAll("#todayWeek .week-letters__d").length,
  }));
  assert(todayView.rows.length>0 && todayView.rows.every(row=>program.some(ex=>ex.id===row.id)&&row.name&&row.load&&row.target),
    "Today preserves engine exercise identity and complete prescription rows");
  assert.equal(todayView.week,7,"Today retains seven weekday cells");
  assert.deepEqual({state:todayView.state,draft:todayView.draft},todayBefore,"dashboard navigation does not write training state or draft");
  const result = await page.evaluate(({ previousRows, currentRows, liftKeys }) => {
    const summary = window.__repforgeSessionSummary.build({
      rows: currentRows,
      prevLog: previousRows,
      session: "sum-current",
      date: "2026-09-17",
      day: "Day 1",
      startedAt: 0,
    });
    const keys = new Set(liftKeys);
    const allRecords = window.__repforgeProgressEvidence.records("current-block");
    const canonical = allRecords
      .filter(record => keys.has(record.exerciseId) && record.evidenceState === "sufficient" && record.outcome)
      .map(record => ({ exerciseId: record.exerciseId, outcome: record.outcome }));
    window.__repforgeSessionSummary.open(summary);
    return { summary, canonical };
  }, { previousRows: previous, currentRows: current, liftKeys });
  await page.waitForSelector("#sessionSummary:not(.hidden)");
  const rendered = await page.evaluate(() => ({
    outcomes: [...document.querySelectorAll("#sessionSummary .sum-outcome")].map(row => ({
      exerciseId: row.dataset.exerciseId,
      outcome: row.dataset.outcome,
      text: row.textContent.trim(),
      // The indicator is the shared verdict mark's variant (Direction D): up, none for maintained, down.
      glyph: ["up", "maintained", "down"].find((name) => row.classList.contains(`verdictmark--${name}`)) || "",
    })),
    muscleNumbers: [...document.querySelectorAll("#sessionSummary .sum-muscles .vrow__num")].map(row => row.textContent.trim()),
    relativeBars: document.querySelectorAll("#sessionSummary .sum-muscles .vrow__fill").length,
    inlineWidths: [...document.querySelectorAll("#sessionSummary .sum-muscles .vrow__fill")].map(row => row.getAttribute("style")),
  }));
  assert.deepEqual((result.summary.outcomes || []).map(({ exerciseId, outcome }) => ({ exerciseId, outcome })), result.canonical,
    "summary outcome rows equal sufficient canonical evidence for completed lifts");
  assert.equal(Object.prototype.hasOwnProperty.call(result.summary, "delta"), false,
    "summary does not expose a second local delta outcome model");
  assert.deepEqual(rendered.outcomes.map(({ exerciseId, outcome }) => ({ exerciseId, outcome })), result.canonical,
    "rendered outcome rows preserve canonical lift identity and role");
  assert.deepEqual(Object.fromEntries(rendered.outcomes.map(({ outcome, glyph }) => [outcome, glyph])), { improved: "up", maintained: "maintained" },
    "summary pairs each canonical outcome word with its semantic indicator glyph");
  assert.ok((result.summary.outcomes || []).every(row => ["improved", "maintained", "declined"].includes(row.outcome)),
    "summary exposes only canonical outcome roles");
  assert.ok(result.summary.muscles.length > 0 && result.summary.muscles.every(row => row.sets > 0),
    "summary muscle work omits zero rows and retains numeric weighted totals");
  assert.ok(rendered.muscleNumbers.length > 0 && rendered.muscleNumbers.every(text => /\d/.test(text)) && rendered.relativeBars === 0 && rendered.inlineWidths.length === 0,
    "summary renders numeric muscle totals without relative bars", JSON.stringify(rendered));

  const overview = await page.evaluate(() => [...document.querySelectorAll("#overviewStrength [data-parity-outcome]")]
    .map(node=>({id:node.dataset.parityOutcome,session:node.dataset.paritySession,text:node.textContent.trim()})));
  const expectedOverview=result.summary.liftGroups.filter(lift=>lift.state.kind==="outcome")
    .map(lift=>({id:lift.exerciseId,session:lift.session,text:rendered.outcomes.find(row=>row.exerciseId===lift.liftKey)?.text}));
  assert.deepEqual(overview.sort((a,b)=>a.id.localeCompare(b.id)),expectedOverview.sort((a,b)=>a.id.localeCompare(b.id)),
    "readonly Progress overview preserves the summary's canonical outcome words, session and exercise identities");

  // F057-02: deliberately fail the canonical post-commit derivation through
  // the real completion path. The durable result, not the presentation, is
  // the oracle for whether this workout finished.
  await page.locator("#sumDone").click();
  assert.equal(await page.locator("#sessionSummary:not(.hidden)").count(),0,"Done dispatches the completion exit command");
  const evidenceBefore=await page.evaluate(()=>({snapshot:window.__repforgeWorkoutDraft.state(),raw:localStorage.getItem("repforge_v1")}));
  await page.locator('nav button[data-view="stats"]').click();
  await page.locator('#statsSeg [data-seg="strength"]').click();
  const strengthRow=page.locator(`#strengthDash [data-evkey="${liftKeys[0]}"]`);
  await strengthRow.click();
  assert.equal(await strengthRow.getAttribute("aria-expanded"),"true","Strength evidence opens the original per-session detail table");
  assert.ok(await page.locator('#strengthDash .evrow__detail:not([hidden]) table').count(),"Strength detail contains session evidence");
  await page.locator('#strengthScopeSeg [data-scope="all-history"]').click();
  assert.equal(await page.locator('#strengthScopeSeg [data-scope="all-history"]').getAttribute("aria-pressed"),"true","Strength owns its selected scope");
  await page.locator('#statsSeg [data-seg="volume"]').click();
  const volumeRow=page.locator('#volumeDash [data-volume-muscle]').first();
  await volumeRow.click();
  assert.equal(await volumeRow.getAttribute("aria-expanded"),"true","Volume evidence opens muscle contribution details");
  await page.locator('#statsSeg [data-seg="prs"]').click();
  const prRow=page.locator('#prTimeline [data-prrow]').first();
  await prRow.click();
  assert.equal(await prRow.getAttribute("aria-expanded"),"true","PR timeline exposes the original record detail");
  await page.locator('#prFilterSeg [data-prf="load"]').click();
  assert.equal(await page.locator('#prFilterSeg [data-prf="load"]').getAttribute("aria-pressed"),"true","PR filter selection belongs to Progress");
  await page.locator('#statsSeg [data-seg="strength"]').click();
  assert.equal(await page.locator('#strengthScopeSeg [data-scope="all-history"]').getAttribute("aria-pressed"),"true","scope survives evidence tab navigation");
  assert.deepEqual(await page.evaluate(()=>({snapshot:window.__repforgeWorkoutDraft.state(),raw:localStorage.getItem("repforge_v1")})),evidenceBefore,"evidence scopes, disclosures and filters never write training state or saved bytes");
  await page.locator('nav button[data-view="log"]').click();
  await page.evaluate(() => window.__repforgeEnterWorkout({}));
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
  const finishResult = await page.evaluate(async () => {
    const draft = window.__repforgeWorkoutDraft.current();
    for (const exerciseId of draft.exerciseOrder) {
      const exercise = draft.exercises[exerciseId];
      for (const setId of exercise.setOrder) {
        for (const metric of exercise.sets[setId].programmed.metrics || []) {
          await window.__repforgeWorkoutDraft.dispatch("editMetricValue", {
            exerciseInstanceId: exerciseId, setId, metricId: metric.id, value: metric.semantic === "loadKg" ? "42.5" : "8",
          });
        }
        await window.__repforgeWorkoutDraft.dispatch("editSetField", {
          exerciseInstanceId: exerciseId, setId, field: "rir", value: "2",
        });
        await window.__repforgeWorkoutDraft.dispatch("completeSet", {
          exerciseInstanceId: exerciseId, setId, completedAt: new Date().toISOString(),
        });
      }
    }
    await window.__repforgeWorkoutDraft.flush();
    await window.__repforgeLeaveWorkout();
    const resume=document.querySelector("#todayResume .today-resume__where");
    if(!resume?.textContent.trim()||document.querySelector("#startWorkout span")?.textContent!=="Continue workout")
      throw new Error("Today must expose the unfinished workout location and Continue action");
    await window.__repforgeEnterWorkout({});
    window.__repforgeSummaryFault = "canonical";
    return window.__repforgeSaveWorkout();
  });
  await page.waitForFunction(() => {
    const toast = document.querySelector("#toast");
    return toast && !toast.classList.contains("hidden") && /saved/i.test(toast.textContent || "");
  }, undefined, { timeout: 8000 }).catch(async error=>{console.error("completion evidence",JSON.stringify({finishResult,ui:await page.evaluate(()=>({toast:document.querySelector("#toast")?.textContent,errors:document.querySelector("#workoutShell")?.textContent?.slice(-500)}))}));throw error});
  const faultEvidence = await page.evaluate(async (key) => {
    const local = JSON.parse(localStorage.getItem(key) || "{}");
    const idb = await new Promise((resolve) => {
      const request = indexedDB.open("repforge", 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("kv", "readonly");
        const get = tx.objectStore("kv").get(key);
        get.onsuccess = () => { db.close(); resolve(get.result || null); };
        get.onerror = () => { db.close(); resolve(null); };
      };
      request.onerror = () => resolve(null);
    });
    const seededSessions = new Set(["sum-previous", "sum-current"]);
    const newSessionCounts = new Map();
    for (const row of local.log || []) {
      if (!seededSessions.has(row.session)) newSessionCounts.set(row.session, (newSessionCounts.get(row.session) || 0) + 1);
    }
    return {
      local,
      idb,
      newSessions: [...newSessionCounts].map(([session, count]) => ({ session, count })),
      summaryOpen: !document.querySelector("#sessionSummary")?.classList.contains("hidden"),
      outcomeRows: document.querySelectorAll("#sessionSummary .sum-outcome").length,
      draftRaw: localStorage.getItem("repforge_draft_v1"),
      todayRecap: !!document.querySelector("#todaySession .today-done"),
      todayReviewVisible: !document.querySelector("#reviewTodaySession")?.classList.contains("hidden"),
      resumeCleared: !document.querySelector("#todayResume")?.textContent.trim(),
    };
  }, KEY);
  assert(finishResult?.committed === true && finishResult?.settled === true,
    "summary derivation fault occurs after a committed and settled finish", JSON.stringify(finishResult));
  assert(faultEvidence.local.log.length === faultEvidence.idb.log.length &&
    JSON.stringify(faultEvidence.local.log) === JSON.stringify(faultEvidence.idb.log) &&
    faultEvidence.local.log.length > previous.length + current.length,
    "summary derivation failure leaves one complete durable log in both replicas",
    JSON.stringify({ local: faultEvidence.local.log.length, idb: faultEvidence.idb.log.length }));
  assert(faultEvidence.newSessions.length === 1 && faultEvidence.newSessions[0].count > 0,
    "summary derivation failure creates exactly one new session identity",
    JSON.stringify(faultEvidence.newSessions));
  assert(faultEvidence.draftRaw === null && !faultEvidence.summaryOpen && faultEvidence.outcomeRows === 0,
    `summary fallback does not resurrect the draft or fabricate outcome rows: ${JSON.stringify(faultEvidence)}`);
  assert(faultEvidence.todayRecap&&faultEvidence.todayReviewVisible&&faultEvidence.resumeCleared,
    "saved session swaps Today from draft continuation to canonical recap and review");
  await page.locator('nav button[data-view="stats"]').click();
  await page.waitForSelector("#stats.view.active", { timeout: 5000 });
  assert(await page.locator("#stats.view.active").count() === 1,
    "the app remains operable after a summary derivation failure");
  await context.close();
} finally {
  await browser.close();
}
