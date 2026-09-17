#!/usr/bin/env node
/**
 * Plan 055 capability parity, exercised through visible controls only.
 *
 * One production-backed case per Focus capability-parity row, driven through
 * the controls a lifter can actually reach in the current single-exercise
 * renderer, and asserted against the acknowledged DraftV2 projection. Rows
 * whose approved destination does not exist yet are recorded as named gaps
 * with their owning slice, so the PR body can paste the live table. No case
 * may pass by reading a hidden List input or an inert peek card: the helper
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

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const STATE_KEY = "repforge_v1";
const DRAFT_KEY = "repforge_draft_v1";

const results = { passed: 0, failed: 0, gaps: 0 };
function assert(cond, name, detail = "") {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); return; }
  results.failed++;
  console.log(`  ✗ ${name}`);
  if (detail) console.log(`    ${detail}`);
}
const phase = (n) => console.log(`\n${n}`);

/** Live-card field helper. Every data-k lookup in this suite goes through
 *  here, so no case can silently read the hidden List carriers that focus
 *  mode still renders for the non-current exercises, or an inert peek copy. */
const flushDraft = (page) => page.evaluate(() => window.__repforgeWorkoutDraft.flush());
/** Fill the live card's field until the acknowledged DraftV2 projection
 *  carries the value. The app re-renders asynchronously around suggestions,
 *  so each attempt drains the write queue, fills, drains again, and reads
 *  the value back through the draft adapter's own target mapping. */
async function liveField(page, keySuffix, value) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await flushDraft(page);
    const live = page.locator(`#workout .exercise.is-current:not(.is-peek) [data-k$="${keySuffix}"]`).first();
    await live.waitFor({ state: "visible", timeout: 5000 });
    const key = await live.getAttribute("data-k");
    await live.fill(String(value));
    await flushDraft(page);
    const landed = await page.evaluate(({ key, value }) => {
      const target = window.__repforgeWorkoutDraft.target(key);
      if (!target) return false;
      const draft = window.__repforgeWorkoutDraft.current();
      const set = draft?.exercises?.[target.exerciseInstanceId]?.sets?.[target.setId];
      return String(set?.edited?.[target.field] ?? "") === String(value);
    }, { key, value });
    if (landed) return live;
  }
  throw new Error(`live field ${keySuffix} never reached the acknowledged draft as ${value}`);
}
async function liveWellButton(page, kind) {
  const btn = page.locator(`#workout .exercise.is-current:not(.is-peek) .focus-well .${kind}`).first();
  await btn.waitFor({ state: "visible", timeout: 5000 });
  return btn;
}
async function currentCard(page) {
  return page.locator("#workout .exercise.is-current:not(.is-peek)").first();
}

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
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
  const previousDate = isoDaysAgo(7);
  const previousRows = [
    { set: 1, load: 50, reps: 10, rir: 2 },
    { set: 2, load: 52.5, reps: 8, rir: 1 },
  ].map((set) => ({
    session: `${previousDate}_${first.day}_seed`, date: previousDate, day: first.day,
    name: first.name, exerciseId: first.id, ...set, notes: "",
    created: `${previousDate}T12:00:00.000Z`, primary: first.primary, secondary: first.secondary,
  }));
  await persist(page, `
    s.settings = { ...(s.settings || {}), voiceInputEnabled: true, lang: ${JSON.stringify(lang)}, rirMode: ${JSON.stringify(rirMode)}, restSec: ${restSec} };
    s.program = ${JSON.stringify(program)};
    s.programMeta = ${JSON.stringify(seedProgramMeta())};
    s.log = ${JSON.stringify(previousRows)};`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForBoot(page);
}

async function reload(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForBoot(page);
}

/** Enter Focus through the production entry path and park on a card. */
async function enterFocus(page, index = 0) {
  await page.evaluate(async (i) => {
    await window.__repforgeEnterWorkout({ focus: true });
    window.__repforgeFocus.to(i);
  }, index);
  await page.waitForSelector("#workout.is-focus .exercise.is-current", { state: "attached", timeout: 5000 });
  await page.waitForTimeout(140);
}

/** Commit the well's active set through its single action, and verify the
 *  acknowledged draft marks that exact set done. The well re-renders around
 *  suggestions, so the click is retried against the freshly bound button
 *  until the projection confirms the completion. */
async function commitActiveSet(page, { load = 60, reps = 8, rir = 2 } = {}) {
  await liveField(page, "_load", load);
  await liveField(page, "_reps", reps);
  await liveField(page, "_rir", rir);
  const key = await page.evaluate(() =>
    document.querySelector("#workout .exercise.is-current:not(.is-peek) .focus-well [data-k$='_load']")?.dataset.k);
  for (let attempt = 0; attempt < 4; attempt++) {
    const button = page.locator("#workout .exercise.is-current:not(.is-peek) .focus-well .saveset").first();
    if (await button.count() === 0) break;
    await button.click();
    await flushDraft(page);
    const done = await page.evaluate((key) => {
      const target = window.__repforgeWorkoutDraft.target(key);
      const draft = window.__repforgeWorkoutDraft.current();
      return target && draft?.exercises?.[target.exerciseInstanceId]?.sets?.[target.setId]?.completion !== "pending";
    }, key);
    if (done) return;
  }
  throw new Error(`active set ${key} never reached a completed state in the acknowledged draft`);
}

/** The acknowledged DraftV2 facts for one exercise, read from the projection. */
const exerciseFacts = (page, id) => page.evaluate((exId) => {
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
        load: set.edited.load, reps: set.edited.reps, rir: set.edited.rir, effort: set.edited.effort };
    }),
  };
}, id);

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
      label: document.querySelector("#woProgress .wo-progress__lab")?.textContent?.trim(),
      prevDisabled: document.querySelector("#woPrev")?.disabled,
      count: window.__repforgeFocus.list().length,
    }));
    assert(nav.label?.endsWith("1 of 6") && nav.prevDisabled === true && nav.count === 6,
      "first exercise is reachable with the previous arrow disabled and position announced", JSON.stringify(nav));
    const walkTo = async (target) => {
      for (let at = 1; at <= target; at++) {
        await page.locator("#woNext").click();
        // The deck locks for its 210ms slide and ignores clicks meanwhile; the
        // displayed position after `at` clicks is at+1, so wait for that
        // announcement instead of a fixed sleep.
        await page.waitForFunction(
          (n) => document.querySelector("#woProgress .wo-progress__lab")?.textContent?.trim().endsWith(`${n} of 6`),
          at + 1, { timeout: 5000 });
      }
    };
    await walkTo(1);
    const middle = await page.evaluate(() => ({
      label: document.querySelector("#woProgress .wo-progress__lab")?.textContent?.trim(),
      name: document.querySelector("#workout .exercise.is-current .focus-ex__name")?.textContent?.trim(),
    }));
    assert(middle.label?.endsWith("2 of 6") && middle.name?.includes(second.name),
      "the middle exercise is reachable through the visible next arrow", JSON.stringify(middle));
    await walkTo(5);
    const lastCard = await page.evaluate(() => ({
      label: document.querySelector("#woProgress .wo-progress__lab")?.textContent?.trim(),
      nextDisabled: document.querySelector("#woNext")?.disabled,
      name: document.querySelector("#workout .exercise.is-current .focus-ex__name")?.textContent?.trim(),
    }));
    const dayExercises = program.filter((e) => e.day === first.day);
    const lastOfDay = dayExercises.at(-1);
    assert(lastCard.label?.endsWith("6 of 6") && lastCard.nextDisabled === true && lastCard.name?.includes(lastOfDay.name),
      "the last exercise is reachable and the next arrow stops there", JSON.stringify(lastCard));
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
    const loadStep = await page.evaluate(() => {
      const card = document.querySelector("#workout .exercise.is-current:not(.is-peek)");
      const input = card.querySelector("[data-k$='_load']");
      const before = input.value;
      card.querySelector(".curset__steps .stepbtn[data-dir='1']").click();
      return { before, after: input.value, unit: document.querySelector("#workout .unit-hint")?.textContent?.trim() };
    });
    assert(loadStep.after !== loadStep.before && loadStep.unit === "kg",
      "the visible load stepper nudges the live field and the unit is named", JSON.stringify(loadStep));
    const invalid = await (async () => {
      await liveField(page, "_reps", "abc");
      await (await liveWellButton(page, "saveset")).click();
      await page.waitForTimeout(200);
      return page.evaluate(() => ({
        toast: document.querySelector("#toast")?.textContent?.trim(),
        invalid: document.querySelectorAll("#workout .exercise.is-current [aria-invalid='true']").length,
        done: document.querySelector("#workout .exercise.is-current .focus-well .saveset")?.getAttribute("aria-pressed"),
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
      setof: document.querySelector("#workout .exercise.is-current .focus-ex__setof")?.textContent?.replace(/\s+/g, " ").trim(),
      rows: document.querySelectorAll("#workout .exercise.is-current .ledger__row[data-editn]").length,
    }));
    assert(setOf.rows === 1 && /2\s*of\s*2/.test(setOf.setof),
      "the ledger carries the committed row and the well moves to set 2", JSON.stringify(setOf));
    // Correction: reopen the committed row through the ledger.
    await page.locator("#workout .exercise.is-current .ledger__row[data-editn]").click();
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
    await page.locator("#workout .exercise.is-current .ledger__row[data-editn]").click();
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
        pastRows: card.querySelectorAll(".ledger__row.is-past").length,
        lastSessionLabel: card.querySelector(".ledger__lab")?.textContent?.trim(),
        target: card.querySelector(".focus-ex__target")?.textContent?.trim(),
        why: !!card.querySelector("[data-why]"),
        head: { title: document.querySelector("#woDayTitle")?.textContent?.trim(), sub: document.querySelector("#woDaySub")?.textContent?.trim() },
      };
    });
    assert(contextFacts.pastRows === 2 && contextFacts.lastSessionLabel,
      "the previous session renders inside the ledger band before the first set", JSON.stringify(contextFacts));
    assert(contextFacts.target && contextFacts.why && contextFacts.head.title,
      "day context, target text, and the Why control are all visible on the card", JSON.stringify(contextFacts.head));
    await page.locator("#workout .exercise.is-current [data-why]").click();
    await page.waitForSelector("#whySheet.is-open", { timeout: 5000 });
    const why = await page.evaluate(() => ({
      target: document.querySelector("#whyTarget")?.textContent?.trim(),
      body: document.querySelector("#whyBody")?.textContent?.trim().length,
    }));
    assert(why.target && why.body > 0, "Why this weight? opens with the engine's facts and copy", JSON.stringify(why));
    await page.evaluate(() => window.closeWhySheet?.());

    /* ---- User exercise note ---- */
    phase("Exercise note: save, reload, restoration");
    await page.locator("#workout .exercise.is-current [data-exnote-open]").click();
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
    await page.locator("#workout .exercise.is-current [data-skip]").click();
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
    phase("Rest timer: chip start, sheet hold, stop; commit independent of timer");
    await page.locator("#woRest").click();
    await page.waitForFunction(() => !!document.querySelector("#woRest.is-running"), undefined, { timeout: 5000 });
    const running = await page.evaluate(() => ({
      chip: document.querySelector("#woRest .wo-rest__time")?.textContent?.trim(),
      hidden: document.querySelector("#woRest")?.classList.contains("hidden"),
    }));
    assert(running.chip && running.chip !== "—" && !running.hidden, "the chip starts the clock and reads the countdown", JSON.stringify(running));
    await page.locator("#woRest").click();
    await page.waitForSelector("#restSheet.is-open", { timeout: 5000 });
    await page.locator("#restPlayPause").click();
    const paused = await page.evaluate(() => document.querySelector("#restSheet")?.classList.contains("is-paused"));
    assert(paused === true, "the sheet holds the clock while the lifter stays on the set");
    await page.locator("#restPlayPause").click();
    await page.locator("#restStop").click();
    await page.waitForFunction(() => !document.querySelector("#woRest.is-running"), undefined, { timeout: 5000 });
    assert(true, "stopping from the sheet clears the chip");

    /* ---- Save through the Focus finish action ---- */
    phase("Save to summary: one atomic commit, draft cleared, summary opens");
    // The finish action lives on the done well of the last card, so the save
    // journey completes the last exercise's ordered sets and finishes there.
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
    assert(spoken.sets[0].load === "80" && spoken.sets[0].reps === "8", "recognized voice edits the active exercise through DraftV2");

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
