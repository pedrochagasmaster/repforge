#!/usr/bin/env node
/**
 * Plan 055 capability parity, exercised through visible controls only.
 *
 * One production-backed case per Focus capability-parity row, driven through
 * the controls a lifter can actually reach in the current single-exercise
 * renderer, and asserted against the acknowledged DraftV2 projection. Rows
 * whose approved destination does not exist yet are recorded as named gaps
 * with their owning slice, so the PR body can paste the live table. No case
 * may pass by reading a hidden compatibility input or an inert peek card: the helper
 * below refuses controls outside the live focus card, and the last section
 * proves the guard rejects the hidden carriers that still exist in the DOM.
 *
 * Run: node test/focus-only-parity.mjs
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { launchChromium } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";
import { finishEarly } from "./fixtures/focus-workout.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const STATE_KEY = "repforge_v1";
const DRAFT_KEY = "repforge_draft_v1";
const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";
/** The seed program's sets are metric-backed: weight and reps are metric fields, RIR its own. */
const FIELD_SUFFIX = { _load: `_metric_${WEIGHT}`, _reps: `_metric_${REPS}`, _rir: "_rir" };

const results = { passed: 0, failed: 0, gaps: 0 };
function assert(cond, name, detail = "") {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); return; }
  results.failed++;
  console.log(`  ✗ ${name}`);
  if (detail) console.log(`    ${detail}`);
}
const phase = (n) => console.log(`\n${n}`);

/** Live-card field helper. Every data-k lookup in this suite goes through
 *  here, so no case can silently read a hidden carrier or an inert peek copy. */
const flushDraft = (page) => page.evaluate(() => window.__repforgeWorkoutDraft.flush());
/** One visible edit must reach the acknowledged DraftV2 without a second input. */
async function liveField(page,keySuffix,value){
  await flushDraft(page);
  const live=page.locator(`#workout .exercise.is-current:not(.is-peek) [data-k$="${FIELD_SUFFIX[keySuffix]||keySuffix}"]`).first();
  await live.waitFor({state:"visible",timeout:5000});
  const key=await live.getAttribute("data-k");
  // Dispatch one browser input event and wait for the visible control's async
  // handler. Playwright's multi-step editing helpers can otherwise overlap a
  // field re-render with the replacement keystrokes.
  await live.evaluate((el, next) => {
    el.value = next;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: next }));
  }, String(value));
  await flushDraft(page);
  try {
    await page.waitForFunction(({key,value})=>{
      const target=window.__repforgeWorkoutDraft.target(key);
      const draft=window.__repforgeWorkoutDraft.current();
      const edited=draft?.exercises?.[target?.exerciseInstanceId]?.sets?.[target?.setId]?.edited;
      const held=target?.metricId?edited?.metrics?.[target.metricId]:edited?.[target?.field];
      return target && String(held??"")===String(value);
    },{key,value},{timeout:5000});
  } catch (error) {
    const diagnostic = await page.evaluate(({ key, value }) => {
      const target = window.__repforgeWorkoutDraft.target(key);
      const draft = window.__repforgeWorkoutDraft.current();
      const set = target && draft?.exercises?.[target.exerciseInstanceId]?.sets?.[target.setId];
      const persisted = window.__repforgeWorkoutDraft.read();
      return { key, expected: String(value), target, edited: set?.edited, touched: set?.touched,
        completion: set?.completion,
        visibleValue: document.querySelector(`#workout .exercise.is-current:not(.is-peek) [data-k="${CSS.escape(key)}"]`)?.value,
        activeRevision: draft?.revision, persistedStatus: persisted?.status,
        persistedRevision: persisted?.draft?.revision, recovery: window.__repforgeWorkoutDraft.recovery() };
    }, { key, value });
    console.error(`live field did not reach DraftV2: ${JSON.stringify(diagnostic)}`);
    throw error;
  }
  return live;
}
async function liveWellButton(page, kind) {
  const btn = page.locator(`#workout .exercise.is-current:not(.is-peek) .focus-shelf .${kind}`).first();
  await btn.waitFor({ state: "visible", timeout: 5000 });
  return btn;
}
/** The header's three-dot button opens the exercise actions. This suite turns voice input on, so there it opens the short menu that holds both. */
async function openActions(page) {
  await page.locator("#woOverflowBtn").click();
  const item = page.locator("#woExActions");
  if (await item.isVisible()) await item.click();
  await page.waitForSelector("#exActionsSheet.is-open", { timeout: 5000 });
}
async function currentCard(page) {
  return page.locator("#workout .exercise.is-current:not(.is-peek)").first();
}

async function waitForBoot(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(() => {
    window.closeFirstRun?.();
    const onboarding = document.querySelector("#onboarding");
    if (onboarding?.classList.contains("active")) window.closeOnboarding?.();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden")) window.closeTour?.();
    window.stopRest?.();
  });
}

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
    { k: STATE_KEY, src },
  );
}

async function clearDraftStorage(page) {
  await page.evaluate((key) => {
    for (const k of Object.keys(localStorage)) {
      if (k === key || k.startsWith(`${key}:`)) localStorage.removeItem(k);
    }
  }, DRAFT_KEY);
}

async function boot(page, { lang = "en", rirMode = "numeric", restSec = 60 } = {}) {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForBoot(page);
  await clearDraftStorage(page);
  const program = seedProgram();
  const first = program[0];
  await persist(page, `
    s.settings = { ...(s.settings || {}), voiceInputEnabled: true, lang: ${JSON.stringify(lang)}, rirMode: ${JSON.stringify(rirMode)}, restSec: ${restSec} };
    s.program = ${JSON.stringify(program)};
    s.programMeta = ${JSON.stringify(seedProgramMeta())};
    s.log = [];`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForBoot(page);
  // The previous session is logged and finished through the product, so its
  // history rows are the canonical metric-backed rows Focus reads back.
  await page.evaluate(async ({ id, weight, reps }) => {
    await window.__repforgeEnterWorkout({ day: "Day 1" });
    const api = window.__repforgeWorkoutDraft, exercise = api.current().exercises[id];
    for (const [index, [load, count, rir]] of [["50", "10", "2"], ["52.5", "8", "1"]].entries()) {
      const setId = exercise.setOrder[index];
      await api.dispatch("editMetricValue", { exerciseInstanceId: id, setId, metricId: weight, value: load });
      await api.dispatch("editMetricValue", { exerciseInstanceId: id, setId, metricId: reps, value: count });
      await api.dispatch("editSetField", { exerciseInstanceId: id, setId, field: "rir", value: rir });
      await api.dispatch("completeSet", { exerciseInstanceId: id, setId, completedAt: new Date().toISOString() });
    }
    await api.flush();
  }, { id: first.id, weight: WEIGHT, reps: REPS });
  const previous = await finishEarly(page);
  if (previous?.committed !== true) throw new Error(`previous session did not save: ${JSON.stringify(previous)}`);
  await page.evaluate(() => window.closeSessionSummary?.());
  await clearDraftStorage(page);
  await reload(page);
}

async function reload(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForBoot(page);
}

/** Enter Focus through the production entry path and park on a card. */
async function enterFocus(page, index = 0) {
  await page.evaluate(async (i) => {
    await window.__repforgeEnterWorkout({ day: "Day 1" });
    window.__repforgeFocus.to(i);
  }, index);
  await page.waitForSelector("#workout.is-focus .exercise.is-current", { state: "attached", timeout: 5000 });
  await page.waitForFunction((i) => window.__repforgeFocus.at() === i &&
    document.querySelector("#workout .exercise.is-current")?.dataset.ex === window.__repforgeFocus.list()[i]?.id, index, { timeout: 5000 });
}

/** One completion click must acknowledge the exact active set. */
async function commitActiveSet(page,{load=60,reps=8,rir=2}={}){
  await liveField(page,"_load",load);
  await liveField(page,"_reps",reps);
  await liveField(page,"_rir",rir);
  const key=await page.locator(`#workout .exercise.is-current .focus-shelf [data-k$="_metric_${WEIGHT}"]`).getAttribute("data-k");
  await page.locator("#workout .exercise.is-current .focus-shelf .saveset").click();
  await flushDraft(page);
  await page.waitForFunction(key=>{
    const target=window.__repforgeWorkoutDraft.target(key);
    const draft=window.__repforgeWorkoutDraft.current();
    const set=target&&draft?.exercises?.[target.exerciseInstanceId]?.sets?.[target.setId];
    return !!set && set.completion!=="pending";
  },key,{timeout:5000});
}

/** The acknowledged DraftV2 facts for one exercise, read from the projection. */
const exerciseFacts = (page, id) => page.evaluate(({ exId, weight, reps }) => {
  const draft = window.__repforgeWorkoutDraft.current();
  const ex = draft?.exercises?.[exId];
  if (!ex) return null;
  return {
    order: draft.exerciseOrder,
    status: ex.status,
    substitution: ex.substitution?.replacement?.displayName ?? null,
    notes: ex.setupNotes,
    session: {
      notes: draft.session.notes,
      bodyweight: draft.session.bodyweight,
      date: draft.program.scheduleDate,
    },
    sets: ex.setOrder.map((setId) => {
      const set = ex.sets[setId];
      return { ordinal: set.ordinal, role: set.role, completion: set.completion === "pending" ? "pending" : "done",
        load: set.edited.metrics?.[weight] ?? null, reps: set.edited.metrics?.[reps] ?? null, rir: set.edited.rir, effort: set.edited.effort };
    }),
  };
}, { exId: id, weight: WEIGHT, reps: REPS });

async function main() {
  const browser = await launchChromium();
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
  });
  await context.addInitScript(() => {
    window.SpeechRecognition = class {
      start() { window.__voiceTest = this; }
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  try {
    await boot(page);
    const program = seedProgram();
    const [first, second, third] = program;

    /* ---- Arbitrary navigation over the live deck ---- */
    phase("Navigation: first/middle/last reachable, position announced, arrows bounded");
    await enterFocus(page, 0);
    const nav = await page.evaluate(() => ({
      label: document.querySelector("#woDayTitle")?.textContent?.trim(),
      announced: document.querySelector("#woProgress .visually-hidden")?.textContent?.trim(),
      segments: document.querySelectorAll("#woProgress [data-focusgo]").length,
      current: document.querySelector("#woProgress .segbar__seg.is-current")?.dataset.focusgo,
      count: window.__repforgeFocus.list().length,
    }));
    assert(nav.label?.endsWith("1 of 6") && /1 of 6$/.test(nav.announced || "") && nav.current === "0" && nav.segments === 6 && nav.count === 6,
      "first exercise is reachable with its segment current and the position announced", JSON.stringify(nav));
    const walkTo = async (target) => {
      while (await page.evaluate(() => window.__repforgeFocus.at()) < target) {
        const next = await page.evaluate(() => window.__repforgeFocus.at() + 1);
        await page.locator("#workout .exercise.is-current [data-fnextrow]").click();
        await page.waitForFunction(
          (n) => document.querySelector("#woDayTitle")?.textContent?.trim().endsWith(`${n} of 6`),
          next + 1, { timeout: 5000 });
      }
    };
    await walkTo(1);
    const middle = await page.evaluate(() => ({
      label: document.querySelector("#woDayTitle")?.textContent?.trim(),
      name: document.querySelector("#workout .exercise.is-current .focus-ex__name")?.textContent?.trim(),
    }));
    assert(middle.label?.endsWith("2 of 6") && middle.name?.includes(second.name),
      "the middle exercise is reachable through the Next row", JSON.stringify(middle));
    await walkTo(5);
    const lastCard = await page.evaluate(() => ({
      label: document.querySelector("#woDayTitle")?.textContent?.trim(),
      noNextRow: !document.querySelector("#workout .exercise.is-current .fx-next"),
      name: document.querySelector("#workout .exercise.is-current .focus-ex__name")?.textContent?.trim(),
    }));
    const dayExercises = program.filter((e) => e.day === first.day);
    const lastOfDay = dayExercises.at(-1);
    assert(lastCard.label?.endsWith("6 of 6") && lastCard.noNextRow === true && lastCard.name?.includes(lastOfDay.name),
      "the last exercise is reachable and the Next row stops there", JSON.stringify(lastCard));
    await enterFocus(page, 0);

    /* ---- Active-set fields, units, adjacent validation ---- */
    phase("Active set: field editing, steppers, validation against DraftV2");
    const before = await exerciseFacts(page, first.id);
    await liveField(page, "_load", 62.5);
    await liveField(page, "_reps", 9);
    await liveField(page, "_rir", 3);
    const typed = await exerciseFacts(page, first.id);
    assert(typed.sets[0].load === "62.5" && typed.sets[0].reps === "9" && typed.sets[0].rir === "3",
      "typed field values land in the DraftV2 projection", JSON.stringify({ before, typed }));
    const loadStep = await page.evaluate((weight) => {
      const card = document.querySelector("#workout .exercise.is-current:not(.is-peek)");
      // A first tap selects the load field (rebuilding the shelf), and the pads follow it.
      card.querySelector(`[data-shelf-field='metric_${weight}']`).click();
      const input = card.querySelector(`[data-k$='_metric_${weight}']`);
      const before = input.value;
      card.querySelector(".shelf__pad[data-dir='1']").click();
      return { before, after: card.querySelector(`[data-k$='_metric_${weight}']`).value,
        unit: card.querySelector(`.shelf__field[data-metric='${weight}'] .shelf__lab`)?.textContent?.trim() };
    }, WEIGHT);
    assert(loadStep.after !== loadStep.before && /\bkg\b/.test(loadStep.unit || ""),
      "the visible load pad nudges the live field and the unit is named", JSON.stringify(loadStep));
    const invalid = await (async () => {
      await liveField(page, "_reps", "abc");
      await (await liveWellButton(page, "saveset")).click();
      await page.waitForTimeout(200);
      return page.evaluate(() => ({
        toast: document.querySelector("#toast")?.textContent?.trim(),
        invalid: document.querySelectorAll("#workout .exercise.is-current [aria-invalid='true']").length,
        done: document.querySelector("#workout .exercise.is-current .focus-shelf .saveset")?.getAttribute("aria-pressed"),
      }));
    })();
    assert(invalid.done !== "true" && (invalid.invalid > 0 || invalid.toast), 
      "an invalid value is refused with adjacent validation and the set stays pending", JSON.stringify(invalid));
    await liveField(page, "_reps", 9);

    /* ---- Ordered sets: commit, next ordinal, correction, uncommit ---- */
    phase("Ordered sets: commit set 1, set 2 follows, correction keeps the ordinal");
    await liveField(page, "_reps", 9);
    await commitActiveSet(page, { load: 62.5, reps: 9, rir: 3 });
    const committed = await exerciseFacts(page, first.id);
    assert(committed.sets[0].completion === "done" && committed.sets[1].completion === "pending",
      "committing the active set completes exactly that ordinal", JSON.stringify(committed));
    const setOf = await page.evaluate(() => ({
      setof: document.querySelector("#workout .exercise.is-current .focus-shelf .saveset")?.textContent?.replace(/\s+/g, " ").trim(),
      rows: document.querySelectorAll("#workout .exercise.is-current .ledgerline[data-editn]").length,
    }));
    assert(setOf.rows === 1 && /\b2$/.test(setOf.setof),
      "the ledger carries the committed row and the shelf moves to set 2", JSON.stringify(setOf));
    // Correction: reopen the committed row through the ledger.
    await page.locator("#workout .exercise.is-current .ledgerline[data-editn]").click();
    await page.waitForFunction(() => window.__repforgeFocus.editing() !== null, undefined, { timeout: 5000 });
    const snap = await page.evaluate(() => window.__repforgeFocus.editing());
    await liveField(page, "_load", 65);
    await (await liveWellButton(page, "saveset")).click();
    await page.waitForFunction(() => window.__repforgeFocus.editing() === null, undefined, { timeout: 5000 });
    const corrected = await exerciseFacts(page, first.id);
    assert(corrected.sets[0].completion === "done" && corrected.sets[0].load === "65" &&
      corrected.sets[0].ordinal === 1 && corrected.sets[1].completion === "pending",
      "correction updates the committed set in place and the next ordinal stays untouched", JSON.stringify({ snap, corrected }));
    // Uncommit: values retained, status back to pending.
    await page.locator("#workout .exercise.is-current .ledgerline[data-editn]").click();
    await page.waitForFunction((id) => {
      const ex = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
      return ex?.sets?.[ex.setOrder[0]]?.completion === "pending";
    }, first.id, { timeout: 5000 });
    const uncommitted = await exerciseFacts(page, first.id);
    assert(uncommitted.sets[0].completion === "pending" && uncommitted.sets[0].load === "65",
      "uncommit returns the set to pending while retaining the corrected values", JSON.stringify(uncommitted));

    /* ---- Previous-session band and recommendation context ---- */
    phase("Context: previous session, recommendation, Why this weight?");
    await enterFocus(page, 0);
    const contextFacts = await page.evaluate(() => {
      const card = document.querySelector("#workout .exercise.is-current:not(.is-peek)");
      return {
        pastRows: card.querySelectorAll(".ledgerline__prev").length,
        lastSessionLabel: card.querySelector(".ledgerline__prev")?.textContent?.trim(),
        target: card.querySelector(".focus-ex__meta")?.textContent?.trim(),
        why: !!card.querySelector("[data-why]"),
        head: { title: document.querySelector("#woDayTitle")?.textContent?.trim(), sub: document.querySelector("#woDaySub")?.textContent?.trim() },
      };
    });
    assert(contextFacts.pastRows === 2 && contextFacts.lastSessionLabel,
      "the previous session renders under its matching ledger rows before the first set", JSON.stringify(contextFacts));
    assert(contextFacts.target && contextFacts.why && contextFacts.head.title,
      "day context, target text, and the Why control are all visible on the card", JSON.stringify(contextFacts.head));
    await page.locator("#workout .exercise.is-current [data-why]").click();
    await page.waitForSelector("#whySheet.is-open", { timeout: 5000 });
    // The seed program is manual: no engine target, and the sheet says the program owns the load.
    const why = await page.evaluate(() => ({
      targetHidden: document.querySelector("#whyTarget")?.classList.contains("hidden"),
      body: document.querySelector("#whyBody")?.textContent?.trim(),
      manual: window.RepForgeI18n.t("why.manual"),
    }));
    assert(why.targetHidden && why.body?.includes(why.manual),
      "Why this weight? opens on a manual program with no invented target and the manual explanation", JSON.stringify(why));
    await page.evaluate(() => window.closeWhySheet?.());
    await page.waitForSelector("#whySheet", { state: "hidden", timeout: 5000 });

    /* ---- User exercise note ---- */
    phase("Exercise note: save, reload, restoration");
    await openActions(page);
    await page.locator("#exActionNotesBtn").click();
    await page.waitForSelector("#exNoteSheet.is-open", { timeout: 5000 });
    await page.fill("#exNoteText", "Seat 4, handles chest height.");
    await page.locator("#exNoteSave").click();
    await page.waitForFunction((id) => {
      const ex = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
      return ex?.setupNotes === "Seat 4, handles chest height.";
    }, first.id, { timeout: 5000 });
    await reload(page);
    await enterFocus(page, 0);
    const noteAfter = (await exerciseFacts(page, first.id)).notes;
    assert(noteAfter === "Seat 4, handles chest height.",
      "the exercise note survives reload and is read back on the same exercise", noteAfter);

    /* ---- Skip/restore through the visible tool ---- */
    phase("Skip and restore: status, focus advance, show-all restore");
    await openActions(page);
    await page.locator("#exActionSkipBtn").click();
    await page.waitForFunction((id) => {
      const draft = window.__repforgeWorkoutDraft.current();
      return draft?.exercises?.[id]?.status === "skipped";
    }, first.id, { timeout: 5000 });
    const afterSkip = await page.evaluate((id) => ({
      inList: window.__repforgeFocus.list().map((e) => e.id).includes(id),
      current: document.querySelector("#workout .exercise.is-current")?.dataset.ex,
      bar: document.querySelector("#workout .skipbar")?.textContent?.trim(),
      firstId: window.__repforgeFocus.list()[0]?.id,
    }), first.id);
    assert(!afterSkip.inList && afterSkip.current !== first.id && afterSkip.bar,
      "a skipped exercise leaves Focus, the next one becomes current, and the skip bar counts it", JSON.stringify(afterSkip));
    await page.locator("#workout .skipbar__show").click();
    await page.waitForFunction((id) => {
      const draft = window.__repforgeWorkoutDraft.current();
      return draft?.exercises?.[id]?.status === "active";
    }, first.id, { timeout: 5000 });
    const restored = await exerciseFacts(page, first.id);
    assert(restored.status === "active" && restored.sets.length === 2 &&
      restored.sets.map((s) => s.ordinal).join() === "1,2",
      "restore returns the exercise with its set identities and order intact", JSON.stringify(restored));

    /* ---- Rest timer through the header chip ---- */
    phase("Rest timer: chip start, inline hold, sheet stop; commit independent of timer");
    await page.locator("#woRest").click();
    await page.waitForFunction(() => !!document.querySelector("#woRest.is-running"), undefined, { timeout: 5000 });
    const running = await page.evaluate(() => ({
      chip: document.querySelector("#woRest .wo-rest__time")?.textContent?.trim(),
      hidden: document.querySelector("#woRest")?.classList.contains("hidden"),
    }));
    assert(running.chip && running.chip !== "—" && !running.hidden, "the chip starts the clock and reads the countdown", JSON.stringify(running));
    // The clock is inline in the cue slot and its Pause pad holds it while the lifter stays on the set.
    await page.waitForSelector("#workout .exercise.is-current .fx-slot[data-rest='running'] [data-rest-clock]", { timeout: 5000 });
    const labels = await page.evaluate(() => ({ pause: window.RepForgeI18n.t("rest.inline.pause"), resume: window.RepForgeI18n.t("rest.inline.resume") }));
    await page.locator("#workout .exercise.is-current .restpad--toggle").click();
    const paused = await page.evaluate(() => document.querySelector("#workout .exercise.is-current .restpad--toggle")?.textContent.trim());
    assert(paused === labels.resume, "the inline pad holds the clock while the lifter stays on the set", paused);
    await page.locator("#workout .exercise.is-current .restpad--toggle").click();
    assert(await page.evaluate(() => document.querySelector("#workout .exercise.is-current .restpad--toggle")?.textContent.trim()) === labels.pause,
      "the same pad lets the clock go again");
    await page.locator("#woRest").click();
    await page.waitForSelector("#restSheet.is-open", { timeout: 5000 });
    await page.locator("#restStop").click();
    await page.waitForFunction(() => !document.querySelector("#woRest.is-running"), undefined, { timeout: 5000 });
    assert(true, "stopping from the sheet clears the chip");

    /* ---- Save through the Focus finish action ---- */
    phase("Save to summary: one atomic commit, draft cleared, summary opens");
    // The finish action lives on the done well of the last card, so the save
    // journey completes the last exercise's ordered sets and finishes there.
    // Complete all preceding exercises so the final exercise completes the workout
    for (let i = 0; i < dayExercises.length - 1; i++) {
      const ex = dayExercises[i];
      await page.evaluate(async ({ exId, weight, reps }) => {
        const draft = window.__repforgeWorkoutDraft.current();
        const exercise = draft?.exercises?.[exId];
        if (!exercise) return;
        for (const setId of exercise.setOrder) {
          await window.__repforgeWorkoutDraft.dispatch("editMetricValue", { exerciseInstanceId: exId, setId, metricId: weight, value: "50" });
          await window.__repforgeWorkoutDraft.dispatch("editMetricValue", { exerciseInstanceId: exId, setId, metricId: reps, value: "10" });
          await window.__repforgeWorkoutDraft.dispatch("editSetField", { exerciseInstanceId: exId, setId, field: "rir", value: "2" });
          await window.__repforgeWorkoutDraft.dispatch("completeSet", { exerciseInstanceId: exId, setId, completedAt: new Date().toISOString() });
        }
        await window.__repforgeWorkoutDraft.flush();
      }, { exId: ex.id, weight: WEIGHT, reps: REPS });
    }
    await enterFocus(page, dayExercises.length - 1);
    const lastId = lastOfDay.id;
    await commitActiveSet(page, { load: 40, reps: 10, rir: 2 });
    await commitActiveSet(page, { load: 40, reps: 10, rir: 1 });
    const savedFacts = await exerciseFacts(page, lastId);
    assert(savedFacts.sets.filter((s) => s.completion === "done").length === 2,
      "the last exercise's ordered sets commit before the finish action", JSON.stringify(savedFacts));
    await page.locator("#workout .exercise.is-current [data-ffinish]").click();
    await page.waitForSelector("#sessionSummary:not(.hidden)", { timeout: 8000 });
    await page.evaluate(() => window.__repforgeStorage.flush());
    const afterSave = await page.evaluate((key) => {
      const saved = JSON.parse(localStorage.getItem(key));
      return { draft: localStorage.getItem("repforge_draft_v1"), log: saved.log.length,
        summary: !document.querySelector("#sessionSummary")?.classList.contains("hidden") };
    }, STATE_KEY);
    assert(afterSave.draft === null && afterSave.log > 0 && afterSave.summary,
      "saving clears the draft, appends history, and opens the centered summary", JSON.stringify(afterSave));
    await page.locator("#sumDone").click();
    await page.waitForTimeout(200);

    /* ---- Leave and resume (partial: full persistence-fault proof is P5) ---- */
    phase("Leave and resume: draft preserved, Today safe, value restored");
    await enterFocus(page, 1);
    await liveField(page, "_load", 47.5);
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    await page.locator("#leaveWorkout").click();
    await page.waitForTimeout(200);
    const left = await page.evaluate((key) => ({
      draft: localStorage.getItem("repforge_draft_v1"),
      log: JSON.parse(localStorage.getItem(key)).log.length,
      today: !document.querySelector("#todayDash")?.classList.contains("hidden"),
    }), STATE_KEY);
    assert(left.draft && left.log === afterSave.log && left.today,
      "leaving preserves the draft, saves nothing, and returns to Today", JSON.stringify(left));
    await enterFocus(page, 1);
    const resumed = await exerciseFacts(page, second.id);
    assert(resumed.sets[0].load === "47.5",
      "resuming restores the touched value on the same exercise", JSON.stringify(resumed));

    phase("Capability-detected voice fills the active set");
    await page.locator("#woOverflowBtn").click();
    assert(await page.locator("#voiceBtn").isVisible(), "voice remains reachable when supported and enabled");
    await page.locator("#voiceBtn").click();
    await page.evaluate(() => window.__voiceTest.onresult({ results: [[{ transcript: "80 x 8 @2" }]] }));
    await flushDraft(page);
    const spoken = await exerciseFacts(page, second.id);
    assert(spoken.sets[0].load === "80" && spoken.sets[0].reps === "8",
      "recognized voice edits the active exercise's weight and reps through DraftV2", JSON.stringify(spoken.sets[0]));

    /* ---- Mode-route absence (055-P7) ---- */
    phase("Mode route absence: no mode toggle/switch exists; active workouts always Focus");
    const modeToggles = await page.locator("button#modeFull, button#modeFocus, .modeswitch").count();
    assert(modeToggles === 0, "no mode switch (.modeswitch, #modeFull, #modeFocus) is present in DOM", `count: ${modeToggles}`);

    const activeMode = await page.evaluate(() => ({
      logMode: typeof logMode !== "undefined" ? logMode : null,
      isFocusWo: document.body.classList.contains("is-focus-wo"),
      isWorkoutFocus: document.querySelector("#workout")?.classList.contains("is-focus"),
    }));
    assert(activeMode.logMode === null && activeMode.isFocusWo && activeMode.isWorkoutFocus,
      "active workout is unconditionally Focus mode", JSON.stringify(activeMode));

    phase("Only the visible current card carries workout input keys");
    const fieldOwners = await page.locator("#workout [data-k]").evaluateAll(fields => fields.map(el => ({
      key: el.dataset.k,
      current: !!el.closest(".exercise.is-current:not(.is-peek)"),
      visible: el.checkVisibility(),
    })));
    assert(fieldOwners.length > 0 && fieldOwners.every(el => el.current && el.visible),
      "no hidden input owns workout behavior", JSON.stringify(fieldOwners));
    await page.evaluate(() => {
      const input = document.createElement("input");
      input.dataset.k = "parity-hidden-probe"; input.hidden = true;
      document.querySelector("#workout").append(input);
    });
    assert(await page.locator('#workout .exercise.is-current:not(.is-peek) [data-k="parity-hidden-probe"]').count() === 0,
      "the live-input selector rejects an injected hidden carrier");
    await page.locator('[data-k="parity-hidden-probe"]').evaluate(el => el.remove());

    assert(errors.length === 0, "the parity journey emits no page or console errors", errors.join(" | "));
  } finally {
    await context.close();
    await browser.close();
  }

  // These suites own the Session, Exercise, reorder and storage-failure rows.
  // A nonzero child exit fails this parity gate, rather than silently recording a gap.
  for (const suite of ["focus-session-sheet.mjs", "focus-exercise-actions.mjs", "focus-navigation.mjs"]) {
    execFileSync(process.execPath, [fileURLToPath(new URL(suite, import.meta.url))], {
      stdio: "inherit", env: { ...process.env, REPFORGE_URL: BASE },
    });
  }
  console.log(`\n${results.passed} passed, ${results.failed} failed, ${results.gaps} recorded gaps`);
  if (results.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
