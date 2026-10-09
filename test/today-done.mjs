#!/usr/bin/env node
/**
 * Today's completed-session state: once a session is saved for the calendar day,
 * the Home tab recaps it instead of offering the same day again.
 * Run: node test/today-done.mjs   (requires the app served over HTTP)
 */
import { pathToFileURL } from "url";
import { launchChromium } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";
import { installGeneratedProgram, isWeightRepsSlot, definitionSlot, metricLogRow, withValues } from "./fixtures/history-metric-rows.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
/** Catalog metric ids of the seed program's Weight+Reps movements. */
const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";

const results = { passed: 0, failed: 0 };

function assert(cond, name, detail) {
  if (cond) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    console.log(`  ✗ ${name}`);
    if (detail != null) console.log(`    ${detail}`);
  }
}

async function waitForApp(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    window.closeFirstRun?.();
    if (el?.classList.contains("active") && typeof window.closeOnboarding === "function") window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function") window.closeTour();
  });
  await page.waitForFunction(
    () => typeof window.__repforgeStorage === "object" && typeof window.__repforgeEnterWorkout === "function",
    { timeout: 15000 }
  );
}

async function clearState(page) {
  await page.evaluate(
    async ({ k, d }) => {
      localStorage.removeItem(k);
      localStorage.removeItem(d);
      await new Promise((res) => {
        const req = indexedDB.deleteDatabase("repforge");
        req.onsuccess = () => res();
        req.onerror = () => res();
        req.onblocked = () => res();
      });
    },
    { k: KEY, d: DRAFT }
  );
}

async function persistState(page, state) {
  await page.evaluate(
    async ({ k, blob }) => {
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
    { k: KEY, blob: state }
  );
}

async function freshPage(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  // A cleared device has no program: install the one these cases log against.
  await installSeedProgram(page, { key: KEY, waitFor: waitForApp });
  return { context, page };
}

function ymd(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function readState(page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), KEY);
}

/** Log rows for one saved session of `day`, two sets per Weight+Reps exercise template,
 *  in the metric shape a finished DraftV2 workout commits. */
function sessionRows(state, day, date, load = 60) {
  const session = `${date}_${day}_seed`;
  const created = `${date}T12:00:00.000Z`;
  const rows = [];
  for (const ex of state.program.filter((e) => e.day === day)) {
    if (!isWeightRepsSlot(definitionSlot(state.programMeta, ex))) continue;
    for (let set = 1; set <= 2; set++) {
      rows.push(metricLogRow(state.programMeta, ex, { session, date, day, set, load, reps: ex.min || 8, rir: 1, created }));
    }
  }
  return rows;
}

async function todayView(page) {
  return page.evaluate(() => {
    const visible = (sel) => {
      const el = document.querySelector(sel);
      return !!el && !el.classList.contains("hidden");
    };
    const text = (sel) => document.querySelector(sel)?.textContent?.trim() || "";
    return {
      label: text("#todaySessionLabel"),
      session: text("#todaySession"),
      hasDoneCard: !!document.querySelector(".today-done"),
      prLine: text(".today-done__pr"),
      hasExercisePreview: !!document.querySelector("#todayExList"),
      startVisible: visible("#startWorkout"),
      viewExVisible: visible("#startWorkout"),
      reviewVisible: visible("#reviewTodaySession"),
      anotherVisible: visible("#logAnotherSession"),
      startText: text("#startWorkout"),
      upNext: text("#todayUpNext"),
      footer: text("#todayLast"),
      i18n: {
        doneLabel: window.RepForgeI18n.t("today.done_label"),
        sessionLabel: window.RepForgeI18n.t("today.session_label"),
        start: window.RepForgeI18n.t("today.start"),
        continue: window.RepForgeI18n.t("today.continue"),
      },
    };
  });
}

async function logAndSaveToday(page, day) {
  await page.evaluate((d) => window.__repforgeEnterWorkout({ day: d}), day);
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
  await page.evaluate(async ({ d, weight, reps }) => {
    const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const draft = window.__repforgeWorkoutDraft.current();
    for (const ex of (state.program || []).filter((e) => e.day === d)) {
      const exercise = draft?.exercises?.[ex.id];
      if (!exercise) continue;
      for (const setId of exercise.setOrder) {
        const metrics = { [weight]: "60", [reps]: String(ex.min || 8) };
        for (const metric of exercise.sets[setId].programmed.metrics || []) {
          if (metrics[metric.id] == null) continue;
          await window.__repforgeWorkoutDraft.dispatch("editMetricValue", {
            exerciseInstanceId: ex.id, setId, metricId: metric.id, value: metrics[metric.id],
          });
        }
        await window.__repforgeWorkoutDraft.dispatch("editSetField", {
          exerciseInstanceId: ex.id, setId, field: "rir", value: "1",
        });
        await window.__repforgeWorkoutDraft.dispatch("completeSet", {
          exerciseInstanceId: ex.id, setId, completedAt: new Date().toISOString(),
        });
      }
    }
    await window.__repforgeWorkoutDraft.flush();
  }, { d: day, weight: WEIGHT, reps: REPS });
  await page.evaluate(async () => {
    await window.__repforgeSaveWorkout();
    await window.__repforgeStorage?.flush?.();
  });
  await page.waitForFunction(
    () => (JSON.parse(localStorage.getItem("repforge_v1") || "{}").log || []).length > 0,
    { timeout: 8000 }
  );
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await page.waitForSelector("#todayDash:not(.hidden)", { timeout: 5000 });
}

const browser = await launchChromium();

console.log("\nToday — completed session state");

// ---------------------------------------------------------------------------
// 1. Saving a session through the UI flips Today out of its start state
// ---------------------------------------------------------------------------
{
  const { context, page } = await freshPage(browser);
  const before = await todayView(page);
  assert(
    before.startVisible && !before.reviewVisible && !before.hasDoneCard,
    "Untrained day: Today offers the start CTA",
    JSON.stringify({ start: before.startVisible, review: before.reviewVisible, card: before.hasDoneCard })
  );
  assert(before.startText === before.i18n.start, "Untrained day: CTA reads Start workout", before.startText);

  await logAndSaveToday(page, "Day 1");
  const after = await todayView(page);
  assert(after.hasDoneCard, "Saved session: Today renders the completed-session recap", after.session);
  assert(
    !after.startVisible && !after.viewExVisible,
    "Saved session: the start CTA and View exercises are gone",
    JSON.stringify({ start: after.startVisible, viewEx: after.viewExVisible })
  );
  assert(
    after.reviewVisible && after.anotherVisible,
    "Saved session: Today offers review and an explicit log-another action",
    JSON.stringify({ review: after.reviewVisible, another: after.anotherVisible })
  );
  assert(after.label === after.i18n.doneLabel, "Saved session: section label switches to the done label", after.label);
  assert(
    !after.hasExercisePreview,
    "Saved session: the completed day's exercise preview is not re-offered",
    after.session
  );
  assert(
    after.session.includes("Day 1") && /\d/.test(after.session),
    "Saved session: the recap names the day that was trained and what it held",
    after.session
  );
  assert(!after.upNext.includes("Day 1"), "Saved session: Up next moves past the day just trained", after.upNext);
  assert(after.upNext.includes("Day 2"), "Saved session: Up next points at the following program day", after.upNext);
  assert(after.prLine === "", "First session of a lift is not counted as a record", after.prLine);
  await context.close();
}

// ---------------------------------------------------------------------------
// 1b. Beating a previous best does show up in the recap
// ---------------------------------------------------------------------------
{
  const { context, page } = await freshPage(browser);
  const state = await readState(page);
  await persistState(page, {
    ...state,
    log: [...sessionRows(state, "Day 1", ymd(-7), 50), ...sessionRows(state, "Day 1", ymd(0), 60)],
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const view = await todayView(page);
  assert(/\d/.test(view.prLine), "Recap reports the records broken today", view.prLine);
  await context.close();
}

// ---------------------------------------------------------------------------
// 1c. The finished day as drawn (OG-6 round 1, `today/done`): totals, each lift's outcome and next target
// ---------------------------------------------------------------------------
{
  const { context, page } = await freshPage(browser);
  // A generated program: its prescriptions carry RIR targets, so every lift with
  // comparable history has an engine next target (the seed program is manual).
  const state = await installGeneratedProgram(page);
  const [dayA, dayB] = [...new Set(state.program.map((e) => e.day))];
  // Day A a week ago, Day A and then Day B today: the day holds two sessions.
  const past = sessionRows(state, dayA, ymd(-7), 50);
  const one = sessionRows(state, dayA, ymd(0), 60);
  const two = sessionRows(state, dayB, ymd(0), 40).map((row) => ({ ...row, session: `${ymd(0)}_${dayB}_seed2`, created: `${ymd(0)}T13:00:00.000Z` }));
  // The first lift of Day A again, later in the day and heavier: its word must read this latest session.
  const firstId = one[0].exerciseId;
  const three = one.filter((row) => row.exerciseId === firstId).map((row) => ({ ...withValues(row, { load: 70 }), session: `${ymd(0)}_${dayA}_seed3`, created: `${ymd(0)}T14:00:00.000Z` }));
  // The block began two weeks ago, so last week's session is part of it.
  await persistState(page, { ...state, programMeta: { ...state.programMeta, started: ymd(-14) }, log: [...past, ...one, ...two, ...three] });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const done = await page.evaluate(() => {
    const t = (key) => window.RepForgeI18n.t(key);
    const durable = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const today = document.querySelector(".today-done");
    const cells = [...document.querySelectorAll(".today-done .statrow__cell")].map((cell) => ({
      value: cell.querySelector(".statrow__val")?.textContent.trim(), caption: cell.querySelector(".statrow__cap")?.textContent.trim() }));
    const groups = [...document.querySelectorAll(".today-done__lifts .sum-grp")].map((group) => {
      const word = group.querySelector(".sum-outcome, .sum-word"), next = group.querySelector("[data-parity-target]");
      // A lift with a canonical outcome carries the parity markup; a first observation says so in words and carries none.
      const canonical = !!word?.hasAttribute("data-outcome");
      const id = (canonical ? word.getAttribute("data-parity-outcome") : next?.getAttribute("data-parity-target")) || null;
      const slot = id ? window.__repforgeProgression.programSlot(id) : null;
      const sessionId = word?.getAttribute("data-parity-session") || null;
      const compared = slot && canonical ? window.__repforgeCompareExercise(slot, (durable.log || []).filter((row) => row.exerciseId === id && row.session === sessionId)) : null;
      const wordKeys = { improved: "stats.outcome.improved", flat: "stats.outcome.maintained", regressed: "stats.outcome.declined" };
      const load = slot ? window.__repforgeProgression.recommendation(slot).load : null;
      const figure = next ? (next.textContent.match(/(\d+(?:[.,]\d+)?)\s*(kg|lbs?)/i) || [])[1] : null;
      const parsed = figure ? window.__repforgeParseLoad(figure) : null;
      return {
        id, sessionId, canonical, text: word?.textContent.trim() || "",
        expected: canonical ? (compared && wordKeys[compared.status] ? t(wordKeys[compared.status]) : compared?.label) : t("stats.outcome_short.single_observation"),
        glyphOnWord: !!word?.querySelector(".verdictmark__glyph") || word?.classList.contains("verdictmark"),
        glyphOnNext: !!next?.querySelector(".verdictmark"),
        targetMatches: parsed?.kind === "valid" && load != null && Math.abs(parsed.kg - load) < 0.06,
        hasSets: !!group.querySelector(".sum-grp__sets"), hasPr: !!group.querySelector(".sum-pr"),
      };
    });
    const check = document.querySelector(".today-done__check"), name = document.querySelector(".today-done__name");
    const review = document.querySelector("#reviewTodaySession"), another = document.querySelector("#logAnotherSession");
    const after = review && getComputedStyle(review, "::after");
    return {
      cells, groups,
      lastSessions: Object.fromEntries([...new Set((durable.log || []).map((row) => row.exerciseId))].map((id) => [id,
        (durable.log || []).filter((row) => row.exerciseId === id).sort((a, b) => (`${a.date}|${a.created}` < `${b.date}|${b.created}` ? -1 : 1)).at(-1)?.session])),
      weekStrip: !!document.querySelector("#todayWeek .week-letters"), weekLine: document.querySelector("#todayWeek .ov-week-line")?.textContent.trim() || "",
      checkInk: !!check && getComputedStyle(check).backgroundColor === getComputedStyle(name).color,
      muscles: !!today?.querySelector(".today-session__muscles"),
      reviewPrimary: review?.classList.contains("btn--cta") && !review.classList.contains("btn--steel"),
      reviewArrow: !!after && after.content !== "none" && after.display !== "none",
      reviewChevron: review ? getComputedStyle(review.querySelector(".chevron")).display : "",
      anotherBelowReview: !!review && !!another && another.getBoundingClientRect().top >= review.getBoundingClientRect().bottom - 1,
      anotherFull: !!review && !!another && Math.abs(another.getBoundingClientRect().width - review.getBoundingClientRect().width) < 2,
    };
  });
  const lifts = new Set([...one, ...two].map((row) => row.exerciseId)).size;
  const setsToday = one.length + two.length + three.length;
  assert(done.cells.length === 3 && done.cells[0].value === String(setsToday) && done.cells[2].value === String(lifts),
    "The recap totals the whole day: sets, kg moved and exercises across both sessions", JSON.stringify(done.cells));
  assert(done.groups.length === lifts, "One outcome and next target per lift trained today", `${done.groups.length} groups for ${lifts} lifts`);
  assert(done.groups.some((group) => group.canonical) && done.groups.some((group) => !group.canonical),
    "The day mixes lifts with an outcome and first observations", JSON.stringify(done.groups.map((g) => [g.id, g.canonical])));
  assert(done.groups.every((group) => group.id && group.text === group.expected),
    "Every outcome word equals what compareExerciseSession says for the session the lift was last logged in; a first observation says so",
    JSON.stringify(done.groups.map((g) => [g.id, g.text, g.expected])));
  assert(done.groups.filter((group) => group.canonical).every((group) => group.sessionId === done.lastSessions[group.id]) &&
    done.groups.find((group) => group.id === firstId)?.sessionId.endsWith("seed3"),
    "An outcome word is read at the session its lift was last logged in, even when the day held two", JSON.stringify(done.groups.map((g) => [g.id, g.sessionId])));
  assert(done.groups.every((group) => group.targetMatches),
    "Every next target shows recommendation().load", JSON.stringify(done.groups.map((g) => [g.id, g.targetMatches])));
  assert(done.groups.every((group) => !group.glyphOnWord && group.glyphOnNext && !group.hasSets && !group.hasPr),
    "The word stands alone; the verdict mark rides the next target; the sets and record lines stay on the summary",
    JSON.stringify(done.groups.map((g) => [g.glyphOnWord, g.glyphOnNext, g.hasSets, g.hasPr])));
  assert(!done.weekStrip && /\d/.test(done.weekLine), "The weekday strip gives way to the week line", JSON.stringify({ strip: done.weekStrip, line: done.weekLine }));
  assert(done.checkInk, "The day's check mark is ink, not orange");
  assert(done.reviewPrimary && done.reviewArrow && done.reviewChevron === "none",
    "View today's session is the primary control with the CTA arrow", JSON.stringify(done));
  assert(done.anotherBelowReview && done.anotherFull, "Log another session sits under it at the same width", JSON.stringify(done));
  await context.close();
}

// ---------------------------------------------------------------------------
// 2. A reload of a day already trained never returns to the start state
// ---------------------------------------------------------------------------
{
  const { context, page } = await freshPage(browser);
  const state = await readState(page);
  await persistState(page, { ...state, log: sessionRows(state, "Day 1", ymd(0)) });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const view = await todayView(page);
  assert(view.hasDoneCard && !view.startVisible, "Reload after training: Today stays in the done state", JSON.stringify(view));
  assert(view.footer === "", "Reload after training: the footer drops its redundant Trained today line", view.footer);

  const opened = await page.evaluate(() => {
    document.querySelector("#logAnotherSession").click();
  });
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
  const openedView = await page.evaluate(() => ({
    // The Focus head reads "<day> · exercise n of m"; the day is the first clause.
    day: (document.querySelector("#woDayTitle")?.textContent || "").split(" \u00b7 ")[0].trim(),
    shell: !document.querySelector("#workoutShell")?.classList.contains("hidden"),
  }));
  assert(
    openedView.shell && openedView.day === "Day 2",
    "Log another session opens the next program day, not the one already done",
    JSON.stringify(openedView)
  );
  await context.close();
}

// ---------------------------------------------------------------------------
// 3. The recap hands off to the saved session on History
// ---------------------------------------------------------------------------
{
  const { context, page } = await freshPage(browser);
  const state = await readState(page);
  const rows = sessionRows(state, "Day 1", ymd(0));
  await persistState(page, { ...state, log: rows });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);

  await page.click("#reviewTodaySession");
  await page.waitForSelector("#history.view.active", { timeout: 5000 });
  const opened = await page.evaluate((session) => {
    const reading = document.querySelector(".session--read");
    return { reading: reading?.dataset.reading || null, want: session };
  }, rows[0].session);
  assert(
    opened.reading === opened.want,
    "View today's session opens that session on History",
    JSON.stringify(opened)
  );
  await context.close();
}

// ---------------------------------------------------------------------------
// 4. Yesterday's session leaves today's suggestion alone
// ---------------------------------------------------------------------------
{
  const { context, page } = await freshPage(browser);
  const state = await readState(page);
  await persistState(page, { ...state, log: sessionRows(state, "Day 1", ymd(-1)) });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const view = await todayView(page);
  assert(
    view.startVisible && !view.hasDoneCard && view.hasExercisePreview,
    "Trained yesterday: Today still offers a session to start",
    JSON.stringify({ start: view.startVisible, card: view.hasDoneCard, preview: view.hasExercisePreview })
  );
  await context.close();
}

// ---------------------------------------------------------------------------
// 5. A second session already in progress outranks the recap
// ---------------------------------------------------------------------------
{
  const { context, page } = await freshPage(browser);
  await logAndSaveToday(page, "Day 1");
  assert((await todayView(page)).hasDoneCard, "Second session: starts from the done state");

  await page.evaluate(() => window.__repforgeEnterWorkout({ day: "Day 2"}));
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
  await page.evaluate(({ weight, reps }) => {
    const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const ex = (state.program || []).find((e) => e.day === "Day 2");
    for (const [suffix, val] of [[`metric_${weight}`, 40], [`metric_${reps}`, 8], ["rir", 1]]) {
      const el = document.querySelector(`[data-k="${ex.id}_1_${suffix}"]`);
      el.value = String(val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, { weight: WEIGHT, reps: REPS });
  await page.evaluate(async () => window.__repforgeStorage?.flush?.());
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await page.waitForSelector("#todayDash:not(.hidden)", { timeout: 5000 });

  const view = await todayView(page);
  assert(
    view.startVisible && !view.hasDoneCard && view.startText === view.i18n.continue,
    "Unsaved second session: Today reverts to Continue workout",
    JSON.stringify({ start: view.startVisible, card: view.hasDoneCard, cta: view.startText })
  );
  await context.close();
}

await browser.close();

console.log(`\nToday done-state: ${results.passed} passed, ${results.failed} failed`);
if (pathToFileURL(process.argv[1]).href === import.meta.url) process.exit(results.failed > 0 ? 1 : 0);
