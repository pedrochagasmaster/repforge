#!/usr/bin/env node
/**
 * Focus-mode state machine checks.
 *
 * One pass per state the Direction D drawings document, driven through the real
 * UI: new exercise, returning exercise, mid-exercise logging in both RIR and
 * effort modes, a long ledger, correcting a logged set, rest, the note sheet,
 * exercise completion, workout completion and swipe navigation — plus the
 * accessibility and viewport rules that hold across all of them. The shelf is a
 * presentation over the same DraftV2 commands the old input well used; the
 * checks here are about what it shows and how it behaves, not about storage.
 *
 * Run: node test/focus-mode.mjs
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium, openShelfField } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";
import { exerciseAction, finishEarly, openLoggedSets } from "./fixtures/focus-workout.mjs";
import { loadRoleInventory, requiredBoundaryExceptionRequests } from "../tools/ui-system-core.mjs";
import { measureRenderedRoles } from "../tools/ui-system-rendered.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";
/** The seed program's sets are metric-backed: weight and reps are metric fields on the shelf, RIR its own. */
const SHELF_ID = { load: `metric_${WEIGHT}`, reps: `metric_${REPS}`, rir: "rir" };
const REST_BAR_BOUNDARY = requiredBoundaryExceptionRequests(loadRoleInventory().exceptions, "workout/rest-running");

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    console.log(`  ✗ ${name}`);
    if (detail) console.log(`    ${detail}`);
  }
}
const phase = (n) => console.log(`\n${n}`);

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** The app restores from IndexedDB first, so both stores have to agree. */
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
  // `closeOnboarding` is a hoisted declaration, so it exists as soon as app.js
  // parses — long before boot has read storage and assigned state. Rendered day
  // tabs are the first thing that cannot appear until it has, which is what the
  // rest of this file then reaches into. Same gate as every other suite.
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    window.closeFirstRun?.();
    if (el?.classList.contains("active")) window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && window.closeTour) window.closeTour();
  });
}

async function boot(page, { lang = "en", rirMode = "numeric", size } = {}) {
  if (size) await page.setViewportSize(size);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.evaluate((d) => {
    if (window.stopRest) window.stopRest();
    for (const key of Object.keys(localStorage)) if (key === d || key.startsWith(`${d}:`)) localStorage.removeItem(key);
  }, DRAFT);
  // Focus mode is a view of a program, and a device that has not been through
  // onboarding holds none — so this walk installs one before it starts.
  await persist(page, `
    s.settings = { ...(s.settings || {}), lang: ${JSON.stringify(lang)}, rirMode: ${JSON.stringify(rirMode)} };
    s.program = ${JSON.stringify(seedProgram())};
    s.programMeta = ${JSON.stringify(seedProgramMeta())};
    s.log = [];`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
}

async function reload(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
}

/** Enter the program's first day: boot defaults to the day after the last one trained (#528), and a state here that
 *  seeds last session's sets means the same day again, not the next one. */
async function enterFocus(page, index = 0) {
  await page.evaluate(async (i) => {
    const day = JSON.parse(localStorage.getItem("repforge_v1") || "{}").program?.[0]?.day;
    await window.__repforgeEnterWorkout(day ? { day } : {});
    window.__repforgeFocus.to(i);
  }, index);
  await page.waitForSelector("#workout.is-focus .exercise.is-current", { state: "attached", timeout: 5000 });
  await page.waitForFunction((i) => document.querySelector("#workout .exercise.is-current")?.dataset.ex ===
    window.__repforgeFocus.list()[i]?.id, index, { timeout: 5000 });
}

/** Give one exercise `sets` sets: its canonical slot gets that many prescriptions in every cycle, and its row follows. */
async function setSetCount(page, i, sets) {
  await persist(page, `
    const ex = w.__repforgeFocus.list()[${i}];
    s.program = s.program.map((e) => (e.id === ex.id ? { ...e, sets: ${sets} } : e));
    const definition = s.programMeta.programDefinition;
    for (const day of definition.days) for (const slot of day.slots) {
      if (slot.id !== ex.id) continue;
      for (const cycle of slot.prescriptionsByCycle) {
        const last = cycle.sets[cycle.sets.length - 1];
        cycle.sets = Array.from({ length: ${sets} }, (_, n) => n < cycle.sets.length ? cycle.sets[n]
          : { ...structuredClone(last), id: last.id.replace(/-\\d+$/, "-" + (n + 1)), setIndex: n + 1 });
      }
    }
    const checked = w.RepForgeProgramCompiler.validateProgramDefinition(definition);
    if (!checked.ok) throw new Error("set count fixture made an invalid program: " + JSON.stringify(checked).slice(0, 400));`);
  await reload(page);
}

/**
 * Last week's session of one exercise, as the canonical metric-backed rows the
 * app itself saves for a Weight + Reps slot (the same shape a logged session
 * writes: metric ids, definitions, values and the loading context).
 */
async function seedPrev(page, i, sets) {
  await persist(page, `
    const ex = w.__repforgeFocus.list()[${i}];
    const slot = s.programMeta.programDefinition.days.flatMap((day) => day.slots).find((item) => item.id === ex.id);
    const date = ${JSON.stringify(isoDaysAgo(7))};
    const coefficient = slot.loadingModel?.bodyweightCoefficient ?? null;
    s.log = (s.log || []).concat(${JSON.stringify(sets)}.map((row, n) => ({
      session: date + "_" + ex.day + "_seed", date, day: ex.day, name: ex.name,
      exerciseId: ex.id, set: n + 1, setIndex: n, load: row.load, reps: row.reps, rir: row.rir,
      notes: "", created: date + "T12:00:00.000Z", primary: ex.primary, secondary: ex.secondary,
      performedName: ex.name, performedPrimary: ex.primary, performedSecondary: ex.secondary,
      metricIds: [...slot.metricIds], metricDefinitions: structuredClone(slot.metricDefinitions),
      metricOrigin: slot.metricOrigin, sourceLibraryId: slot.exerciseId,
      metricValues: slot.metricDefinitions.map((metric) => ({ metricId: metric.id,
        value: metric.semantic === "loadKg" ? row.load : row.reps, unit: metric.unit })),
      equipmentId: null, loadingConvention: "external", loadingModel: structuredClone(slot.loadingModel),
      loadingContext: { bodyweightContributionEnabled: false, externalLoadMultiplier: 1,
        bodyweightCoefficient: coefficient, loadingConvention: "external", bodyweightKg: null },
      metricType: "source_metrics@1", restSeconds: null, performedLibraryId: slot.exerciseId,
    })));`);
  // Previous-session facts are captured when DraftV2 is created. Each catalog
  // state represents a fresh workout, so retire the preceding state's draft
  // before creating this returning-exercise snapshot.
  await page.evaluate((draftKey) => {
    for (const key of Object.keys(localStorage)) {
      if (key === draftKey || key.startsWith(`${draftKey}:`)) localStorage.removeItem(key);
    }
  }, DRAFT);
  await reload(page);
}

/** Commit `n` sets on the focused exercise through the shelf, as a lifter would. */
const completedSets = (page) => page.evaluate(() => {
  const draft = window.__repforgeWorkoutDraft.current();
  return draft ? draft.exerciseOrder.reduce((count, exerciseId) => count + draft.exercises[exerciseId].setOrder
    .filter((setId) => draft.exercises[exerciseId].sets[setId].completion !== "pending").length, 0) : 0;
});
async function logSets(page, n, { load = 100, reps = 4 } = {}) {
  let done = 0;
  for (let i = 0; i < n; i++) {
    const loadInput = page.locator(`#workout .exercise.is-current .focus-shelf .shelf__input[data-metric-id="${WEIGHT}"]`);
    if (!(await loadInput.count())) break;
    await loadInput.first().fill(String(load));
    const repsInput = page.locator(`#workout .exercise.is-current .focus-shelf .shelf__input[data-metric-id="${REPS}"]`);
    if (await repsInput.count()) await repsInput.first().fill(String(reps));
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    const before = await completedSets(page);
    await page.locator("#workout .exercise.is-current .focus-shelf .saveset").first().click();
    await page.waitForFunction((count) => {
      const draft = window.__repforgeWorkoutDraft.current();
      return draft.exerciseOrder.reduce((total, exerciseId) => total + draft.exercises[exerciseId].setOrder
        .filter((setId) => draft.exercises[exerciseId].sets[setId].completion !== "pending").length, 0) > count;
    }, before, { timeout: 5000 });
    done++;
  }
  return done;
}

/** Where focus is, as the lifter's keyboard or screen reader finds it (R7 J-03). */
const focusAt = (page) => page.evaluate(() => {
  const el = document.activeElement;
  const card = document.querySelector("#workout .exercise.is-current");
  const live = !!el && el !== document.body && !el.closest("[aria-hidden='true']") && el.tabIndex >= 0;
  return {
    tag: el?.tagName, inCard: !!card && card.contains(el), live,
    field: el?.dataset?.shelfField || null, cta: !!el?.matches?.(".focus-shelf .saveset"),
    next: el?.matches?.("[data-fnext]") || false,
    row: el?.matches?.(".ledgerline[data-editn]") ? +el.dataset.editn : null,
    disclosure: !!el?.matches?.("[data-ledgermore]"),
  };
});

/** The cue slot and the pad row cross over for one 160ms beat; measure them once it has passed. */
const fadesDone = (page) => page.waitForFunction(() => !document.querySelector("#workout .motion-fade-out"), undefined, { timeout: 3000 });

/** A logged set arms a rest, and the rest takes the cue slot. Read the cue itself once the lifter has ended it. */
async function endRest(page) {
  await page.evaluate(() => window.stopRest());
  await page.waitForFunction(() => !document.querySelector("#restTab"));
}

const cardState = (page) =>
  page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    if (!card) return null;
    const context = card.querySelector(".fcard__context");
    const shelf = card.querySelector(".focus-shelf");
    const cta = shelf?.querySelector(".btn--cta");
    const cardBox = card.getBoundingClientRect();
    const text = (el) => el?.textContent?.replace(/\s+/g, " ").trim() || "";
    // #517: the table folds its oldest logged rows only when they do not fit; what it draws is what is not hidden.
    const rows = [...card.querySelectorAll("#ledger_" + CSS.escape(card.dataset.ex) + " .ledgerline:not([hidden])")];
    const logged = card.querySelectorAll(".ledgerline[data-editn]:not([hidden])");
    const more = card.querySelector("[data-ledgermore]:not([hidden])");
    const lastLogged = logged[logged.length - 1];
    return {
      cueL1: text(card.querySelector(".fx-cue__l1")),
      cueL2: text(card.querySelector(".fx-cue__l2")),
      cueKind: [...(card.querySelector(".fx-cue")?.classList || [])].find((c) => c.startsWith("is-")) || "",
      // The cue's inline mark is the shared verdict mark: its variant, whether the glyph is drawn, and whether
      // its colour is the ink token, so a test can tell the accent from ink.
      cueMark: (() => {
        const mark = card.querySelector(".fx-cue .verdictmark");
        const glyph = mark?.querySelector(".verdictmark__glyph");
        if (!glyph) return null;
        const ink = document.createElement("i");
        ink.style.color = "var(--color-ink)";
        document.body.append(ink);
        const inkColor = getComputedStyle(ink).color;
        ink.style.color = "var(--accent-deep)";
        const accentColor = getComputedStyle(ink).color;
        ink.remove();
        const style = getComputedStyle(glyph);
        return {
          variant: [...mark.classList].find((c) => c.startsWith("verdictmark--"))?.slice(13) || "",
          drawn: glyph.getBoundingClientRect().width > 0 && (style.webkitMaskImage || style.maskImage) !== "none",
          ink: style.backgroundColor === inkColor,
          accent: style.backgroundColor === accentColor,
          hidden: glyph.getAttribute("aria-hidden") === "true",
        };
      })(),
      meta: text(card.querySelector(".focus-ex__meta")),
      rows: rows.length,
      logged: logged.length,
      queued: rows.filter((r) => !r.matches(".ledgerline--open") && !r.matches("[data-editn]")).length,
      open: card.querySelectorAll(".ledgerline--open").length,
      editing: card.querySelectorAll(".ledgerline--open[aria-current]").length,
      prevLines: card.querySelectorAll(".ledgerline__prev").length,
      folded: card.querySelectorAll(".ledgerline[data-editn][hidden]").length,
      more: text(more),
      moreExpanded: more?.getAttribute("aria-expanded") ?? null,
      cancel: !!card.querySelector("[data-fcancel]"),
      ctaText: text(cta),
      ctaArrow: cta ? !cta.classList.contains("btn--noarrow") : null,
      ctaHeight: cta ? Math.round(cta.getBoundingClientRect().height) : 0,
      doneTitle: text(card.querySelector(".focus-done__title")),
      doneSub: text(card.querySelector(".focus-done__sub")),
      nextRow: text(card.querySelector(".fx-next")),
      shelfTop: shelf ? Math.round(shelf.getBoundingClientRect().top) : 0,
      shelfHeight: shelf ? Math.round(shelf.getBoundingClientRect().height) : 0,
      shelfBottom: shelf ? Math.round(shelf.getBoundingClientRect().bottom) : 0,
      spill: card.scrollHeight - card.clientHeight,
      contextScrolls: context ? context.scrollHeight > context.clientHeight + 1 : false,
      contextBottom: context ? Math.round(context.getBoundingClientRect().bottom) : 0,
      lastLoggedBottom: lastLogged ? Math.round(lastLogged.getBoundingClientRect().bottom) : 0,
      openBottom: (() => { const open = card.querySelector(".ledgerline--open"); return open ? Math.round(open.getBoundingClientRect().bottom) : 0; })(),
      cardBottom: Math.round(cardBox.bottom),
      pageScrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

/** The cue's inline mark is the shared verdict mark, drawn from the move its sentence names: "=" for hold, the arrow
 *  down or up. In the hero every mark takes the deep accent (owner, direction A of focus-hero.html, 2026-10-28).
 *  Returns the move so a state can pin which one it reads. */
function assertCueMark(st, where) {
  const move = /^go up/i.test(st.cueL1) ? "up" : /^drop/i.test(st.cueL1) ? "down" : /^hold/i.test(st.cueL1) ? "hold" : "";
  assert(move && st.cueMark && st.cueMark.variant === move && st.cueMark.drawn && st.cueMark.hidden,
    `${where}: the cue draws the shared verdict mark for the move its sentence names`, JSON.stringify({ move, cueL1: st.cueL1, mark: st.cueMark }));
  assert(st.cueMark && st.cueMark.accent && !st.cueMark.ink,
    `${where}: the hero's mark takes the deep accent for every move`, JSON.stringify(st.cueMark));
  return move;
}

async function main() {
  const browser = await launchChromium();
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  // ---- 01 — new exercise, no history ----------------------------------------
  phase("State 01: new exercise, no history");
  await boot(page);
  await setSetCount(page, 0, 5);
  await enterFocus(page, 0);
  let st = await cardState(page);
  // Layout D: the table draws the open set and the next one; with nothing logged there is no disclosure.
  assert(st.rows === 2 && st.logged === 0 && st.open === 1 && st.queued === 1 && st.prevLines === 0 && !st.more,
    "an exercise with no history shows the first set open and the next one, with no previous-session line", JSON.stringify(st));
  // This seed has a manual range: Taurifer does not suggest a load, and Focus labels the stored
  // range as the lifter's targets. The adaptive cue is proved below on a generated program.
  assert(st.cueKind === "is-manual" && st.cueL1 === "Your targets" && st.cueL2 === "4–8 reps" && st.cueMark === null,
    "a manual range cue names the targets and invents no load", JSON.stringify(st));
  assert(st.ctaText.toLowerCase() === "log set 1" && st.ctaArrow === false,
    "the commit action names the set and is arrowless", JSON.stringify(st));
  assert(/\d.*reps/.test(st.meta),
    "the exercise line carries the sets and the reps", JSON.stringify(st));
  assert(st.spill <= 1 && !st.pageScrollsX,
    "the card fits its own box and the page does not scroll sideways", JSON.stringify(st));

  // ---- 02 — returning exercise ----------------------------------------------
  phase("State 02: returning exercise with previous-session context");
  await setSetCount(page, 1, 4);
  await seedPrev(page, 1, [
    { load: 100, reps: 10, rir: 2 },
    { load: 100, reps: 10, rir: 2 },
    { load: 100, reps: 9, rir: 2 },
    { load: 100, reps: 9, rir: 2 },
  ]);
  await enterFocus(page, 1);
  st = await cardState(page);
  assert(st.rows === 2 && st.prevLines === 2 && st.logged === 0 && st.open === 1,
    "each drawn set carries last session's matching set under its own row", JSON.stringify(st));
  assert(st.cueKind === "is-manual" && !/\d/.test(st.cueL1) && st.cueMark === null,
    "history does not make a manual program's cue invent a load", JSON.stringify(st));
  const pastLayout = await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    const prev = [...card.querySelectorAll(".ledgerline__prev")].map((el) => el.textContent.replace(/\s+/g, " ").trim());
    const cardBox = card.getBoundingClientRect();
    const idx = card.querySelector(".ledgerline .ledgerline__idx").getBoundingClientRect();
    const heads = [...card.querySelectorAll(".ledgerline__head .fx-col")].map((s) => s.textContent.replace(/\s+/g, " ").trim());
    // The head's labels and every row's values share their right edges.
    const rightEdges = [...card.querySelectorAll(".ledgerline__head .fx-col, .ledgerline .ledgerline__vals > .fx-col")]
      .reduce((acc, el) => { (acc[[...el.parentElement.children].indexOf(el)] ||= []).push(Math.round(el.getBoundingClientRect().right)); return acc; }, {});
    return {
      prev,
      inset: Math.round(idx.left - cardBox.left),
      heads,
      aligned: Object.values(rightEdges).every((edges) => Math.max(...edges) - Math.min(...edges) <= 1),
      unitInValue: [...card.querySelectorAll(".ledgerline .ledgerline__vals > .fx-col")].some((el) => /kg|lb/i.test(el.textContent)),
    };
  });
  assert(pastLayout.prev.every((line) => /^last 100 × (10|9) · RIR 2$/.test(line)),
    "the previous session reads as a line of its own under the matching set", JSON.stringify(pastLayout));
  assert(pastLayout.inset >= 12,
    "the set number sits in from the card edge", JSON.stringify(pastLayout));
  assert(/kg|lb/i.test(pastLayout.heads[0] || ""),
    "the ledger load header carries the unit", JSON.stringify(pastLayout));
  assert(!pastLayout.unitInValue,
    "the load figures are numbers only", JSON.stringify(pastLayout));
  assert(pastLayout.aligned,
    "the head's labels and every row's values share their columns", JSON.stringify(pastLayout));

  // ---- 03 — mid-exercise with numeric RIR ------------------------------------
  phase("State 03: mid-exercise logging with numeric RIR");
  await boot(page);
  await setSetCount(page, 0, 5);
  await enterFocus(page, 0);
  // The baseline is the shelf at rest: entering Focus plays transforms, and a
  // bounding box read mid-transform is a fraction of a pixel short (218.7 vs 219).
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"), undefined, { timeout: 3000 });
  const shelfBefore = (await cardState(page)).shelfHeight;
  await logSets(page, 2);
  // The second set armed a rest. It rises as the tab over the shelf; the card keeps its cue (rest timer redesign).
  const restLine = await page.evaluate(() => ({ tab: !!document.querySelector("#restTab"),
    cue: document.querySelector("#workout .exercise.is-current .fx-cue__l1")?.textContent?.replace(/\s+/g, " ").trim() || "",
    inCard: document.querySelectorAll("#workout .restinline, #workout .restpad").length }));
  assert(restLine.tab && restLine.cue === "Your targets" && restLine.inCard === 0, "the rest rises as the tab and the card keeps its manual range cue", JSON.stringify(restLine));
  // R7 J-03: Log set rebuilds the shelf, so focus must land on the next set's field, never on <body>.
  const afterLog = await focusAt(page);
  assert(afterLog.inCard && afterLog.live && afterLog.field !== null,
    "after Log set, focus is on a field of the next set's shelf", JSON.stringify(afterLog));
  await endRest(page);
  st = await cardState(page);
  assert(st.logged === 2 && st.folded === 0 && st.rows === 4 && !st.more,
    "two logged sets stay in the table above the open set and the next one, because they fit, with no disclosure (#517)", JSON.stringify(st));
  // The landing beat of the render that logged the set.
  const setLanded = await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    const anim = (el) => (el ? getComputedStyle(el).animationName : "");
    return {
      freshRows: card.querySelectorAll(".ledgerline.is-fresh").length,
      freshMore: !!card.querySelector("[data-ledgermore].is-fresh"),
      rowAnim: anim(card.querySelector(".ledgerline.is-fresh")),
      // A peek is inert scenery: it must never replay the live card's beat.
      peekFresh: document.querySelectorAll("#focusDeck .is-peek .is-fresh").length,
    };
  });
  // The "Change since last session" line is retired (OG-6 round 2): no element, no text, however many sets are logged.
  const retiredDelta = await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    return {
      element: card.querySelectorAll(".delta-prev").length,
      text: /Change (from|since) last session|Mudan[çc]a desde a última sessão/i.test(card.textContent || ""),
    };
  });
  assert(retiredDelta.element === 0 && !retiredDelta.text,
    "the Focus card carries no change-since-last-session line once sets are logged", JSON.stringify(retiredDelta));
  assert(st.cueKind === "is-manual" && st.cueMark === null,
    "logged sets do not make a manual program's cue invent a load", JSON.stringify({ cueL1: st.cueL1, mark: st.cueMark }));
  assert(/3/.test(st.ctaText) && st.ctaText.toLowerCase() === "log set 3",
    "the action advances to set 3", st.ctaText);
  assert(st.shelfHeight === shelfBefore,
    "the shelf keeps its height as sets accumulate", `${shelfBefore} -> ${st.shelfHeight}`);
  assert(st.lastLoggedBottom <= st.contextBottom + 1,
    "the newest logged row is fully in view", JSON.stringify(st));
  const loggedInset = await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    const n = card.querySelector(".ledgerline[data-editn] .ledgerline__idx");
    if (!card || !n) return null;
    return Math.round(n.getBoundingClientRect().left - card.getBoundingClientRect().left);
  });
  assert(loggedInset != null && loggedInset >= 12,
    "logged set marks also sit in from the card edge", String(loggedInset));
  const rirCell = await page.evaluate(() => ({
    field: !!document.querySelector('#workout .exercise.is-current .focus-shelf [data-shelf-field="rir"]'),
    input: !!document.querySelector('#workout .exercise.is-current .focus-shelf [data-k$="_rir"]'),
  }));
  assert(rirCell.field && rirCell.input, "the shelf's third field is a numeric RIR field", JSON.stringify(rirCell));

  // ---- 03b — a logged set lands -----------------------------------------------
  phase("State 03b: a logged set lands with one pass of motion");
  assert(setLanded.freshRows === 1 && !setLanded.freshMore,
    "the set that just landed is acknowledged on its own row, which stays in the table, and nowhere else", JSON.stringify(setLanded));
  assert(/setland-row/.test(setLanded.rowAnim),
    "the row takes the new set with one pass of the landing motion", JSON.stringify(setLanded));
  assert(setLanded.peekFresh === 0, "the neighbouring peek cards stay still", JSON.stringify(setLanded));
  // The card is redrawn on every navigation and every draft change, so the beat
  // has to belong to the render that logged the set and to no other.
  await page.evaluate(() => window.__repforgeFocus.to(1));
  await page.evaluate(() => window.__repforgeFocus.to(0));
  const replayed = await page.evaluate(() => document.querySelectorAll("#workout .is-fresh").length);
  assert(replayed === 0, "a later render draws the same card at rest", String(replayed));
  st = await cardState(page);
  assert(st.logged === 2 && !st.more && st.rows === 4 && st.openBottom <= st.contextBottom + 1,
    "the landing animation leaves the table where the layout puts it, the logged sets still in place on return, the open set in view", JSON.stringify(st));

  // ---- 03c — the shelf --------------------------------------------------------
  phase("State 03c: the shelf's fields, pads and typed values");
  const shelfProbe = () => page.evaluate(({ weight, reps }) => {
    const shelf = document.querySelector("#workout .exercise.is-current .focus-shelf");
    const fields = [...shelf.querySelectorAll(".shelf__field")];
    const names = { [weight]: "load", [reps]: "reps" };
    return {
      fields: fields.map((f) => names[f.dataset.metric] || f.dataset.field),
      pressed: fields.map((f) => f.querySelector("[data-shelf-field]").getAttribute("aria-pressed")),
      editing: fields.filter((f) => f.classList.contains("is-editing")).map((f) => f.dataset.field),
      values: fields.map((f) => f.querySelector(".shelf__val")?.textContent?.trim()),
      soft: fields.map((f) => f.classList.contains("is-untouched")),
      pads: [...shelf.querySelectorAll(".shelf__pad")].map((b) => b.textContent.trim()),
      inputHidden: fields.map((f) => {
        const i = f.querySelector(".shelf__input");
        return i ? [getComputedStyle(i).opacity, i.getAttribute("aria-hidden"), i.tabIndex] : null;
      }),
      open: document.querySelector("#workout .exercise.is-current .ledgerline--open [data-lv='reps']")?.textContent?.trim(),
    };
  }, { weight: WEIGHT, reps: REPS });
  let sh = await shelfProbe();
  // A metric-backed set opens on its first metric: the load, which a manual program leaves to the lifter.
  assert(sh.fields.join() === "load,reps,rir" && sh.pressed.join() === "true,false,false",
    "the set's first metric, the load, is the selected field by default", JSON.stringify(sh));
  assert(sh.pads.join("|") === "− 2.5 kg|+ 2.5 kg", "the pads name the selected field's step", JSON.stringify(sh));
  assert(sh.inputHidden.every((i) => i && i[0] === "0" && i[1] === "true" && i[2] === -1) && sh.editing.length === 0,
    "the real inputs stay out of sight and out of the tab order until a field is opened", JSON.stringify(sh));
  assert(sh.soft.every(Boolean), "values the lifter has not confirmed read in soft ink", JSON.stringify(sh));
  await page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field='${SHELF_ID.reps}']`).click();
  sh = await shelfProbe();
  assert(sh.pressed.join() === "false,true,false" && sh.pads.join("|") === "− 1 rep|+ 1 rep" && sh.editing.length === 0,
    "a first tap on another field selects it and the pads follow it", JSON.stringify(sh));
  await page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field='${SHELF_ID.load}']`).click();
  sh = await shelfProbe();
  assert(sh.pressed.join() === "true,false,false" && /kg|lb/.test(sh.pads[0]) && sh.editing.length === 0,
    "a first tap selects a field and the pads follow it", JSON.stringify(sh));
  await page.locator("#workout .exercise.is-current .shelf__pad").nth(1).click();
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  const stepped = await page.evaluate((weight) => {
    const d = window.__repforgeWorkoutDraft.current();
    const exercise = d.exercises[d.session.selectedExerciseId];
    const set = exercise.sets[exercise.setOrder.find((id) => exercise.sets[id].completion === "pending")];
    return { load: set.edited.metrics[weight], touched: set.touched.metrics[weight] };
  }, WEIGHT);
  const loadShown = (await shelfProbe()).values[0];
  assert(stepped.touched === true && Number(stepped.load) === Number(loadShown.replace(",", ".")),
    "a pad steps the draft through the stepper handler and the field follows", JSON.stringify({ stepped, loadShown }));
  await openShelfField(page, `#workout .exercise.is-current .focus-shelf [data-shelf-field='${SHELF_ID.load}']`);
  sh = await shelfProbe();
  assert(sh.editing.join() === "metric", "a second tap on the selected field opens the wheel, and its keyboard button opens the real input", JSON.stringify(sh));
  const focusedKey = await page.evaluate(() => document.activeElement?.dataset?.k || "");
  assert(focusedKey.endsWith(`_metric_${WEIGHT}`), "the opened input takes focus under its draft key", focusedKey);
  // #300: the software keyboard shrinks the visual viewport but not dvh. Model it on the live visualViewport the app
  // already listens to (an Android keyboard of 336px; Chrome reports no offset until it pans) and let the app's own
  // resize path settle the shelf: the focused field has to sit wholly inside the band left on screen, for every field
  // it moves between, and closing the keyboard has to give Focus its full screen back with no stray scroll.
  const keyboard = async (height) => {
    await page.evaluate((h) => {
      const vv = window.visualViewport;
      if (h == null) { delete vv.height; delete vv.offsetTop; }
      else {
        Object.defineProperty(vv, "height", { configurable: true, get: () => h });
        Object.defineProperty(vv, "offsetTop", { configurable: true, get: () => 0 });
      }
      vv.dispatchEvent(new Event("resize"));
    }, height);
    await page.waitForTimeout(120);
    return page.evaluate(() => {
      const vv = window.visualViewport, el = document.activeElement;
      const r = el?.getBoundingClientRect?.();
      const shelf = document.querySelector("#workout .exercise.is-current .focus-shelf").getBoundingClientRect();
      return {
        key: el?.dataset?.k || "", flag: document.documentElement.dataset.keyboard || "",
        band: [vv.offsetTop, vv.offsetTop + vv.height],
        field: r ? [Math.round(r.top), Math.round(r.bottom)] : null,
        shelfBottom: Math.round(shelf.bottom), scroll: [window.scrollX, window.scrollY], inner: window.innerHeight,
      };
    });
  };
  const kbUp = await keyboard(852 - 336);
  assert(kbUp.flag === "up" && kbUp.field && kbUp.field[0] >= kbUp.band[0] && kbUp.field[1] <= kbUp.band[1] + 1,
    "with the keyboard up, the opened load field sits wholly above it before anything is typed (#300)", JSON.stringify(kbUp));
  const kbFields = [];
  for (const k of ["reps", "rir", "load"]) {
    const field = page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field='${SHELF_ID[k]}']`);
    if (!(await field.count())) continue;
    // Tapping a field button (not an input) closes the keyboard first, as it does on the phone.
    await page.evaluate(() => document.activeElement?.blur());
    await keyboard(null);
    await field.click();
    await openShelfField(page, field);
    await page.waitForTimeout(120);
    kbFields.push(await keyboard(852 - 336));
  }
  assert(kbFields.length >= 2 && kbFields.every((f) => f.flag === "up" && f.field && f.field[0] >= f.band[0] && f.field[1] <= f.band[1] + 1)
    && new Set(kbFields.map((f) => f.scroll.join())).size === 1,
    "moving between shelf fields keeps each one above the keyboard without the page drifting", JSON.stringify(kbFields));
  const kbLoad = await page.evaluate(() => document.activeElement?.dataset?.k || "");
  assert(kbLoad.endsWith(`_metric_${WEIGHT}`), "the load field is open again for typing", kbLoad);
  await page.evaluate(() => document.activeElement?.blur());
  const kbDown = await keyboard(null);
  assert(!kbDown.flag && kbDown.scroll.join() === "0,0" && Math.abs(kbDown.shelfBottom - kbDown.inner) <= 2,
    "closing the keyboard restores Focus's full screen with the shelf on the bottom edge and no residual scroll", JSON.stringify(kbDown));
  // The field is still open after the keyboard goes; tapping it again brings the caret back.
  await page.locator("#workout .exercise.is-current .focus-shelf .shelf__field.is-editing .shelf__input").click();
  await page.evaluate(() => document.activeElement?.select?.());
  await page.keyboard.type("111");
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  const typed = await page.evaluate((weight) => {
    const d = window.__repforgeWorkoutDraft.current();
    const exercise = d.exercises[d.session.selectedExerciseId];
    const set = exercise.sets[exercise.setOrder.find((id) => exercise.sets[id].completion === "pending")];
    return { draft: set.edited.metrics[weight], shown: document.querySelector("#workout .exercise.is-current .ledgerline--open [data-lv='load']")?.textContent?.trim() };
  }, WEIGHT);
  assert(typed.draft?.endsWith("111") && typed.shown?.endsWith("111"),
    "typing runs the draft handler and the open ledger row reads the same value", JSON.stringify(typed));
  await page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field='${SHELF_ID.reps}']`).click();
  sh = await shelfProbe();
  assert(sh.pressed.join() === "false,true,false" && sh.editing.length === 0,
    "choosing another field closes the input and returns to its button", JSON.stringify(sh));

  // ---- 07 — the rest rises as a tab over the shelf ------------------------
  // The rest timer redesign (owner-approved mock, 2026-10-23); test/rest-timer.mjs proves its controls, the continuous
  // depletion and the bell's one flick. Here: the Focus surface around it.
  phase("State 07: the rest rises as a tab over the shelf, and the sheet behind it holds every control");
  await page.evaluate(() => window.startRest());
  await page.waitForSelector("#restTab", { timeout: 5000 });
  await fadesDone(page);
  // The start is announced two frames after the rest begins.
  await page.waitForFunction(() => /^Rest started: /.test(document.querySelector("#restAnnounce")?.textContent || ""), undefined, { timeout: 3000 });
  const restSurface = await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current"), tab = document.querySelector("#restTab");
    const shelf = card.querySelector(".focus-shelf"), box = tab.getBoundingClientRect(), shelfBox = shelf.getBoundingClientRect();
    return {
      inShelf: shelf.contains(tab), rises: box.top < shelfBox.top, width: box.width, height: box.height,
      label: tab.querySelector(".resttab__label").textContent, time: tab.querySelector(".resttab__time").textContent,
      aria: tab.getAttribute("aria-label") || "", popup: tab.getAttribute("aria-haspopup"),
      edge: !!shelf.querySelector(".restlight .restlight__core"), cue: !!card.querySelector(".fx-slot .fx-cue"),
      fieldPads: card.querySelectorAll(".shelf__pads .shelf__pad").length, restPads: card.querySelectorAll(".restpad, [data-rest-act]").length,
      header: !!document.querySelector("#woRest"),
    };
  });
  assert(restSurface.inShelf && restSurface.rises && restSurface.edge, "the tab rises out of the shelf's top edge, and the light along the edge carries the rest", JSON.stringify(restSurface));
  assert(restSurface.width >= 44 && restSurface.height >= 44 && restSurface.popup === "dialog" && /^Rest \d:\d\d\. Tap to open the timer\.$/.test(restSurface.aria),
    "the tab is a full target, named with the time, and opens a dialog", JSON.stringify(restSurface));
  assert(restSurface.label === "Rest" && /^\d:\d\d$/.test(restSurface.time), "it reads Rest and the time", JSON.stringify(restSurface));
  assert(restSurface.cue && restSurface.fieldPads > 0 && restSurface.restPads === 0 && !restSurface.header,
    "the card keeps its cue and the field pads; no rest pads and no header chip", JSON.stringify(restSurface));
  await page.click("#restTab");
  await page.waitForSelector("#restSheet:not([hidden]).is-open");
  const restSheet = await page.evaluate(() => {
    const el = document.querySelector("#restSheet");
    return {
      open: !el.hidden && el.classList.contains("is-open"),
      presets: el.querySelectorAll("#restPresets [data-restpreset]").length,
      armed: el.querySelectorAll('#restPresets [aria-checked="true"]').length,
      controls: [...el.querySelectorAll("button[id]")].map((b) => b.id).filter((id) => id !== "restSheetClose").sort(),
      dial: !!el.querySelector("#restDial .restdial__arc"), focus: document.activeElement?.id || "",
    };
  });
  assert(restSheet.open && restSheet.dial && restSheet.focus === "restHold", "the tab opens the sheet on its dial, focus on the primary control", JSON.stringify(restSheet));
  assert(restSheet.presets >= 4 && restSheet.armed === 1 && restSheet.controls.join() === "restHold,restMinus,restPlus,restReset,restStop",
    "the sheet offers Pause or Resume, the nudges, Restart and End rest, and marks the armed length among the presets", JSON.stringify(restSheet));
  await page.click("#restSheetClose");
  await page.waitForFunction(() => document.querySelector("#restSheet")?.hidden === true);
  assert(await page.evaluate(() => document.activeElement?.id === "restTab"), "closing the sheet hands focus back to the tab");
  await endRest(page);

  // ---- 06 — editing a logged set --------------------------------------------
  phase("State 06: editing a previously logged set");
  await logSets(page, 1);
  const beforeEdit = await page.evaluate(() => {
    const draft = window.__repforgeWorkoutDraft.current();
    return draft.exerciseOrder.reduce((count, exerciseId) => count + draft.exercises[exerciseId].setOrder
      .filter((setId) => draft.exercises[exerciseId].sets[setId].completion !== "pending").length, 0);
  });
  await openLoggedSets(page);
  await page.locator(".ledgerline[data-editn]").nth(1).click();
  // editing() flips on the tap itself; wait for the reopened set to render and
  // take focus, which is what the assertions below read.
  await page.waitForFunction(() => window.__repforgeFocus.editing()?.n === 2 &&
    !!document.querySelector("#workout .exercise.is-current [data-fcancel]"), undefined, { timeout: 10000 });
  st = await cardState(page);
  assert(st.editing === 1 && st.open === 1, "the edited row stays in place and wears the open ring", JSON.stringify(st));
  assert(/set 2 of/i.test(st.cueL1),
    "the cue says which set is being edited", JSON.stringify(st));
  assert(st.cancel && st.ctaText.toLowerCase() === "save set 2" && st.ctaArrow === false,
    "editing is reversible and commits without an arrow", JSON.stringify(st));
  assert(st.logged + st.editing === 3, "no row disappears while it is being edited", JSON.stringify(st));
  const afterEditOpen = await focusAt(page);
  assert(afterEditOpen.inCard && afterEditOpen.live && afterEditOpen.cta,
    "Edit on a ledger row moves focus to the shelf's Save control (R7 J-03)", JSON.stringify(afterEditOpen));
  const editedReps = () => page.evaluate((reps) => {
    const draft = window.__repforgeWorkoutDraft.current();
    const exercise = draft.exercises[draft.session.selectedExerciseId];
    const set = exercise.sets[exercise.setOrder.find((id) => exercise.sets[id].ordinal === 2)];
    return { reps: set.edited.metrics[reps], completion: set.completion === "pending" ? "pending" : "done" };
  }, REPS);
  await page.locator(`#workout .exercise.is-current .focus-shelf .shelf__input[data-metric-id="${REPS}"]`).first().fill("9");
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.locator("#workout .exercise.is-current .focus-shelf .saveset").click();
  await page.waitForFunction(() => window.__repforgeFocus.editing() === null, undefined, { timeout: 5000 });
  assert(JSON.stringify(await editedReps()) === JSON.stringify({ reps: "9", completion: "done" }),
    "saving an edit stores the corrected reps on the set it came from", JSON.stringify(await editedReps()));
  // #521: the confirmation is said, not drawn across the shelf; any notice Focus does show rides clear of the shelf
  // and the rest tab over it, errors included.
  const notice = () => page.evaluate(() => {
    const live = document.querySelector("#toast"), shelf = document.querySelector("#workout .exercise.is-current .focus-shelf");
    const tab = document.querySelector("#restTab"), cta = shelf?.querySelector(".saveset, .btn--cta");
    const r = live.getBoundingClientRect(), boxes = [shelf, tab].filter((el) => el && el.getClientRects().length).map((el) => el.getBoundingClientRect());
    const hits = boxes.filter((b) => r.width > 1 && r.height > 1 && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top).length;
    const c = cta?.getBoundingClientRect(), atCta = c ? document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2) : null;
    return { text: live.textContent, role: live.getAttribute("role"), live: live.getAttribute("aria-live"), hidden: live.classList.contains("hidden"),
      drawn: r.width > 1 && r.height > 1, hits, tab: !!tab?.getClientRects().length, inView: r.top >= 0 && r.bottom <= innerHeight,
      ctaUsable: !!c && !!atCta && cta.contains(atCta) };
  });
  const updated = await notice();
  assert(updated.text === "Set updated." && updated.role === "status" && updated.live === "polite" && !updated.drawn && updated.ctaUsable,
    "Set updated is announced politely and draws nothing over the shelf (#521)", JSON.stringify(updated));
  await page.evaluate(() => toast("A routine notice."));
  await page.waitForTimeout(350);
  const routine = await notice();
  assert(routine.drawn && routine.inView && routine.hits === 0 && routine.ctaUsable && routine.role === "status",
    "a notice Focus shows clears the shelf and the rest tab, and the shelf's action stays usable (#521)", JSON.stringify(routine));
  await page.evaluate(() => announce("Couldn't save. Try again.", { assertive: true }));
  await page.waitForTimeout(350);
  const failure = await notice();
  assert(failure.drawn && failure.inView && failure.hits === 0 && failure.role === "alert" && failure.live === "assertive",
    "an error stays visible and assertive, clear of the shelf (#521)", JSON.stringify(failure));
  await page.evaluate(() => document.querySelector("#toast").classList.add("hidden"));
  // The saved correction closes the table again: focus returns to the corrected row where the table shows it, else
  // to the disclosure that folds it (#517).
  const afterSave = await focusAt(page);
  assert(afterSave.inCard && afterSave.live && (afterSave.row != null || afterSave.disclosure),
    "Save on an edited set returns focus to its row, or to the disclosure folding it (R7 J-03)", JSON.stringify(afterSave));
  await openLoggedSets(page);
  const afterEdit = await page.evaluate(() => {
    const draft = window.__repforgeWorkoutDraft.current();
    const rows = [...document.querySelectorAll(".ledgerline[data-editn]")].map((r) =>
      [...r.querySelectorAll(".ledgerline__vals > .fx-col")].map((s) => s.textContent.trim())
    );
    const done = draft.exerciseOrder.reduce((count, exerciseId) => count + draft.exercises[exerciseId].setOrder
      .filter((setId) => draft.exercises[exerciseId].sets[setId].completion !== "pending").length, 0);
    return { done, rows };
  });
  assert(afterEdit.done === beforeEdit,
    "saving an edit updates the record instead of adding one",
    `${beforeEdit} -> ${afterEdit.done}`);
  assert(afterEdit.rows[1] && afterEdit.rows[1][1] === "9",
    "the edited value lands on the row it came from", JSON.stringify(afterEdit.rows));
  // …and cancelling puts the set back exactly as it was.
  await page.locator(".ledgerline[data-editn]").nth(1).click();
  // editing() flips on the tap itself; wait for the reopened set to render and
  // take focus, which is what the assertions below read.
  await page.waitForFunction(() => window.__repforgeFocus.editing()?.n === 2 &&
    !!document.querySelector("#workout .exercise.is-current [data-fcancel]"), undefined, { timeout: 10000 });
  await page.locator(`#workout .exercise.is-current .focus-shelf .shelf__input[data-metric-id="${REPS}"]`).first().fill("2");
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.locator("[data-fcancel]").click();
  await page.waitForFunction(() => window.__repforgeFocus.editing() === null, undefined, { timeout: 5000 });
  assert(JSON.stringify(await editedReps()) === JSON.stringify({ reps: "9", completion: "done" }),
    "cancelling an edit puts the set's logged reps back in the draft, not the abandoned value", JSON.stringify(await editedReps()));
  const afterCancelFocus = await focusAt(page);
  assert(afterCancelFocus.inCard && afterCancelFocus.live && (afterCancelFocus.row != null || afterCancelFocus.disclosure),
    "Cancel on an edited set returns focus to its row, or to the disclosure folding it (R7 J-03)", JSON.stringify(afterCancelFocus));
  await openLoggedSets(page);
  const afterCancel = await page.evaluate(() =>
    [...document.querySelectorAll(".ledgerline[data-editn]")].map((r) =>
      [...r.querySelectorAll(".ledgerline__vals > .fx-col")].map((s) => s.textContent.trim())
    )
  );
  assert(afterCancel[1] && afterCancel[1][1] === "9",
    "cancelling an edit restores the set it opened with", JSON.stringify(afterCancel));

  // ---- 08 — the note sheet ---------------------------------------------------
  phase("State 08: exercise-note editor");
  await page.locator("#woOverflowBtn").click(); await page.locator('[data-workout-action="exercise"]').click();
  await page.waitForSelector("#exActionsSheet.is-open");
  await page.locator("#exActionNotesBtn").click();
  await page.waitForSelector("#exNoteSheet:not(.hidden)");
  await page.waitForTimeout(280);
  const sheet = await page.evaluate(() => {
    const s = document.querySelector("#exNoteSheet");
    const r = s.getBoundingClientRect();
    return {
      role: s.getAttribute("role"),
      modal: s.getAttribute("aria-modal"),
      named: !!document.getElementById(s.getAttribute("aria-labelledby") || ""),
      onScreen: r.top < window.innerHeight - 100 && Math.round(r.bottom) >= window.innerHeight - 1,
      focused: document.activeElement?.id === "exNoteText",
      scrim: !document.querySelector("#exNoteScrim").classList.contains("hidden"),
      forName: document.querySelector("#exNoteFor")?.textContent?.trim() || "",
    };
  });
  assert(sheet.role === "dialog" && sheet.modal === "true" && sheet.named,
    "the note sheet is a named modal dialog", JSON.stringify(sheet));
  assert(sheet.onScreen && sheet.scrim && sheet.focused && sheet.forName,
    "it rises from the bottom, dims the card and takes the caret", JSON.stringify(sheet));
  // The software keyboard shrinks the visual viewport but not dvh, and iOS also
  // scrolls the visual viewport down to reveal the field (offsetTop). Sizing the
  // sheet against 100dvh made it that much taller than the band left on screen,
  // so its header sat above the top edge until the lifter swiped back down.
  const withKeyboard = await page.evaluate(() => {
    const root = document.documentElement;
    // visualViewport: height 516, offsetTop 120 inside an 852-tall layout viewport.
    const vvh = 516, offsetTop = 120;
    const kb = Math.max(0, window.innerHeight - vvh - offsetTop);
    root.style.setProperty("--kb", `${kb}px`);
    root.style.setProperty("--vvh", `${vvh}px`);
    const box = (sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      // Client coords are layout-viewport relative; the band on screen is
      // [offsetTop, offsetTop + vvh].
      return { top: Math.round(r.top - offsetTop), bottom: Math.round(r.bottom - offsetTop) };
    };
    const sheet = box("#exNoteSheet"), head = box("#exNoteSheet .sheetband");
    root.style.removeProperty("--kb");
    root.style.removeProperty("--vvh");
    return { vvh, sheet, head };
  });
  assert(withKeyboard.sheet.top >= 0 && withKeyboard.head.bottom <= withKeyboard.vvh &&
    Math.abs(withKeyboard.sheet.bottom - withKeyboard.vvh) <= 1,
    "with the keyboard up the sheet sits in the visible band with its header on screen",
    JSON.stringify(withKeyboard));
  const sheetModal = await page.evaluate(() => ({
    main: !!document.querySelector("main")?.inert,
    nav: !!document.querySelector("nav")?.inert,
    sheet: !!document.querySelector("#exNoteSheet")?.inert,
    scrim: !!document.querySelector("#exNoteScrim")?.inert,
  }));
  assert(sheetModal.main && sheetModal.nav && !sheetModal.sheet && !sheetModal.scrim,
    "the note sheet leaves the card inert and keeps its own surface live", JSON.stringify(sheetModal));
  await page.keyboard.press("Tab");
  assert(await page.evaluate(() => document.activeElement?.id === "exNoteCancel"),
    "Tab from the note field wraps to Cancel");
  await page.keyboard.press("Shift+Tab");
  assert(await page.evaluate(() => document.activeElement?.id === "exNoteText"),
    "Shift+Tab from Cancel wraps back to the note field");
  await page.fill("#exNoteText", "Seat 4, feet high.");
  await page.click("#exNoteSave");
  await page.waitForFunction(() => {
    const s = document.querySelector("#exNoteSheet");
    return !s || s.hidden || s.classList.contains("hidden");
  }, { timeout: 2000 });
  const noteSaved = await page.evaluate(() => ({
    draft: Object.fromEntries(Object.entries(window.__repforgeWorkoutDraft.current()?.exercises || {})
      .map(([id, exercise]) => [id, exercise.setupNotes])),
    marked: /Seat 4, feet high\./.test(document.querySelector("#workout .exercise.is-current .fx-note")?.textContent || ""),
    closed: document.querySelector("#exNoteSheet").hidden,
  }));
  assert(Object.values(noteSaved.draft).includes("Seat 4, feet high.") && noteSaved.closed,
    "saving the sheet writes the note into the session draft", JSON.stringify(noteSaved));
  assert(noteSaved.marked, "the card's note line shows the exercise now has one");
  assert(await page.evaluate(() => document.activeElement?.id === "woOverflowBtn" && document.activeElement.isConnected),
    "saving the sheet returns focus to the header's actions button");
  await page.locator("#woOverflowBtn").click(); await page.locator('[data-workout-action="exercise"]').click();
  await page.waitForSelector("#exActionsSheet.is-open");
  await page.locator("#exActionNotesBtn").click();
  await page.waitForSelector("#exNoteSheet:not(.hidden)");
  await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => {
    const s = document.querySelector("#exNoteSheet");
    return !s || s.hidden || s.classList.contains("hidden");
  }, { timeout: 2000 });
  assert(await page.evaluate(() => document.querySelector("#exNoteSheet").hidden),
    "Escape closes the note sheet");
  assert(await page.evaluate(() => document.activeElement?.id === "woOverflowBtn"),
    "Escape returns focus to the header's actions button");

  // ---- 04 — effort mode -------------------------------------------------------
  phase("State 04: mid-exercise logging with Easy / Hard / Max");
  await boot(page, { rirMode: "effort" });
  await setSetCount(page, 0, 6);
  await enterFocus(page, 0);
  await logSets(page, 4, { load: 7.5, reps: 4 });
  st = await cardState(page);
  await openLoggedSets(page);
  const effort = await page.evaluate(() => {
    const spin = document.querySelector("#workout .exercise.is-current .focus-shelf [data-effspin]");
    const head = [...document.querySelectorAll("#workout .exercise.is-current .ledgerline__head .fx-col")].map((s) => s.textContent.trim());
    const row = document.querySelector(".ledgerline[data-editn]");
    return {
      tag: spin?.tagName,
      pressed: spin?.getAttribute("aria-pressed"),
      label: spin?.querySelector(".shelf__lab")?.textContent?.trim() || "",
      value: spin?.querySelector(".shelf__val")?.textContent?.trim() || "",
      valueNow: spin?.dataset.e || "",
      hint: document.querySelector("#workout .exercise.is-current .focus-shelf .effortpop__hint")?.textContent?.trim() || "",
      head,
      rowEffort: row ? [...row.querySelectorAll(".ledgerline__vals > .fx-col")][2]?.textContent?.trim() : "",
      rirField: !!document.querySelector('#workout .exercise.is-current .focus-shelf [data-k$="_rir"]'),
    };
  });
  assert(effort.tag === "BUTTON" && effort.pressed === "false" && /effort/i.test(effort.label) && /^(easy|hard|max)$/i.test(effort.value) && effort.valueNow,
    "the effort field shows its word under its own caption", JSON.stringify(effort));
  assert(!effort.rirField && /effort/i.test(effort.head[2] || ""),
    "effort mode replaces the RIR field and column everywhere", JSON.stringify(effort));
  assert(/^(easy|hard|max)$/i.test(effort.rowEffort) && effort.hint,
    "a logged set reads back as the word that was tapped", JSON.stringify(effort));
  await page.click('#workout .term[data-term="Effort"]');
  await page.waitForSelector("#glossary:not(.hidden)");
  const effortTerm = await page.locator("#glossary .glossary__body").textContent();
  assert(/RIR 0|≈ 0|reps in reserve/i.test(effortTerm || ""),
    "the Effort glossary term stays clickable in the ledger head", effortTerm || "empty glossary");
  await page.click("#glossary .glossary__close");
  await page.waitForFunction(() => document.querySelector("#glossary")?.classList.contains("hidden"));
  // R7 J-15: by keyboard the popover takes focus, is named and described by the definition it shows, and Escape
  // closes it and hands focus back to the term that opened it.
  await page.locator('#workout .term[data-term="Effort"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector("#glossary:not(.hidden)");
  const glossaryOpen = await page.evaluate(() => {
    const g = document.querySelector("#glossary"), a = document.activeElement;
    const termBtn = document.querySelector('#workout .term[data-term="Effort"]');
    const text = (attr) => document.getElementById(g.getAttribute(attr) || "")?.textContent?.trim() || "";
    return {
      inside: !!a && (a === g || g.contains(a)), expanded: termBtn?.getAttribute("aria-expanded"),
      name: text("aria-labelledby"), desc: text("aria-describedby"),
      term: g.querySelector(".glossary__term").textContent.trim(), body: g.querySelector(".glossary__body").textContent.trim(),
    };
  });
  assert(glossaryOpen.inside && glossaryOpen.expanded === "true" && glossaryOpen.name === glossaryOpen.term &&
    glossaryOpen.name.length > 0 && glossaryOpen.desc === glossaryOpen.body && glossaryOpen.desc.length > 0,
  "opening the glossary by keyboard moves focus into it, and it is named and described by its definition (R7 J-15)", JSON.stringify(glossaryOpen));
  await page.keyboard.press("Escape");
  const glossaryClosed = await page.evaluate(() => ({
    hidden: document.querySelector("#glossary").classList.contains("hidden"),
    onTerm: !!document.activeElement?.matches?.('#workout .term[data-term="Effort"]'),
    expanded: document.querySelector('#workout .term[data-term="Effort"]')?.getAttribute("aria-expanded"),
  }));
  assert(glossaryClosed.hidden && glossaryClosed.onTerm && glossaryClosed.expanded === "false",
    "Escape closes the glossary and returns focus to its term (R7 J-15)", JSON.stringify(glossaryClosed));
  const shelfAlign = await page.evaluate(() => {
    const fields = [...document.querySelectorAll("#workout .exercise.is-current .focus-shelf .shelf__field")];
    const band = (sel) => fields.map((c) => {
      const el = c.querySelector(sel);
      return el ? Number(el.getBoundingClientRect().top.toFixed(3)) : null;
    });
    const spread = (arr) => Math.max(...arr) - Math.min(...arr);
    return { n: fields.length, labs: spread(band(".shelf__lab")), vals: spread(band(".shelf__val")), tops: spread(band(".shelf__fieldbtn")) };
  });
  assert(shelfAlign.n === 3 && shelfAlign.labs <= 1 && shelfAlign.vals <= 1 && shelfAlign.tops <= 1,
    "effort, load and reps share one baseline in the shelf", JSON.stringify(shelfAlign));
  assert(st.logged + st.folded === 4 && (st.folded ? st.more === `${st.folded} earlier set${st.folded === 1 ? "" : "s"}` : !st.more),
    "four logged sets show where they fit, and the disclosure counts exactly the ones it folds", JSON.stringify(st));
  // The reps-left shorthand is a pill off the word, not a caption among the pads.
  const popClosed = await page.evaluate(() => {
    const pop = document.querySelector(".focus-shelf .effortpop");
    const pads = document.querySelector(".focus-shelf .shelf__pads");
    const p = pop?.getBoundingClientRect(), s = pads?.getBoundingClientRect();
    return { present: !!pop, open: !!pop?.classList.contains("is-open"),
      inField: !!pop?.closest(".shelf__field"),
      // Nothing of it may sit among the pads.
      belowFields: !!(p && s) && p.top > s.top };
  });
  assert(popClosed.present && popClosed.inField && !popClosed.open && !popClosed.belowFields,
    "the effort shorthand starts closed and clear of the pads", JSON.stringify(popClosed));
  // A first tap selects the field; a second asks what the word means.
  await page.locator(".focus-shelf [data-effspin]").click();
  await page.waitForTimeout(120);
  const selected = await page.evaluate(() => ({
    pressed: document.querySelector(".focus-shelf [data-effspin]").getAttribute("aria-pressed"),
    open: !!document.querySelector(".focus-shelf .effortpop.is-open"),
    pads: [...document.querySelectorAll("#workout .exercise.is-current .shelf__pad")].map((b) => b.textContent.trim()),
  }));
  assert(selected.pressed === "true" && !selected.open && selected.pads.length === 2 && selected.pads.every((t) => /easy|hard|max/i.test(t)),
    "a first tap selects the effort field and its pads name the words they step to", JSON.stringify(selected));
  await page.locator(".focus-shelf [data-effspin]").click();
  await page.waitForTimeout(420);
  const popOpen = await page.evaluate(() => {
    const pop = document.querySelector(".focus-shelf .effortpop");
    const spin = document.querySelector(".focus-shelf [data-effspin]");
    const pill = pop?.querySelector(".effortpop__hint");
    const c = pill.getBoundingClientRect(), s = spin.getBoundingClientRect();
    const shelf = document.querySelector(".focus-shelf").getBoundingClientRect();
    return {
      open: pop.classList.contains("is-open"),
      text: pill.textContent.trim(),
      above: Math.round(s.top - c.bottom),
      // Centred on the word it explains, and inside the shelf's width.
      offCentre: Math.round(Math.abs((c.left + c.right) / 2 - (s.left + s.right) / 2)),
      inside: c.left >= shelf.left - 1 && c.right <= shelf.right + 1,
      opacity: +getComputedStyle(pill).opacity,
    };
  });
  assert(popOpen.open && popOpen.text && popOpen.above >= 0 && popOpen.above <= 60 &&
    popOpen.offCentre <= 2 && popOpen.inside && popOpen.opacity > .9,
    "tapping the selected effort field pops its shorthand open just above it", JSON.stringify(popOpen));
  // Stepping the word under an open pill rewrites the pill rather than closing it.
  await page.locator(".exercise.is-current .focus-shelf [data-effstep]").last().click();
  await page.waitForTimeout(300);
  const popStepped = await page.evaluate(() => {
    const pop = document.querySelector(".focus-shelf .effortpop");
    return { open: pop.classList.contains("is-open"),
      text: pop.querySelector(".effortpop__hint")?.textContent?.trim() || "",
      pads: [...document.querySelectorAll("#workout .exercise.is-current .shelf__pad")].map((b) => `${b.textContent.trim()}${b.disabled ? " (off)" : ""}`),
      soft: document.querySelector(".focus-shelf [data-effspin]").closest(".shelf__field").classList.contains("is-untouched") };
  });
  assert(popStepped.open && popStepped.text && popStepped.text !== popOpen.text,
    "the open shorthand follows the effort word as it steps", JSON.stringify(popStepped));
  assert(popStepped.soft === false && /max.*\(off\)/i.test(popStepped.pads[1] || ""),
    "stepping confirms the word, and the pad that cannot go further says so", JSON.stringify(popStepped));
  const disabledPad = await page.evaluate(() => {
    const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const rgb = (c) => String(c).match(/\d+(?:\.\d+)?/g).slice(0, 3).map(Number);
    const pad = document.querySelector("#workout .exercise.is-current .shelf__pad:disabled");
    const style = getComputedStyle(pad);
    const [a, b] = [lum(...rgb(style.color)), lum(...rgb(style.backgroundColor))].sort((x, y) => y - x);
    return { color: style.color, background: style.backgroundColor, contrast: (a + 0.05) / (b + 0.05) };
  });
  assert(disabledPad.contrast >= 3, "a disabled pad stays readable (3:1 against its ground)", JSON.stringify(disabledPad));
  await page.locator(".exercise.is-current .focus-ex__meta").click();
  await page.waitForTimeout(400);
  const popDismissed = await page.evaluate(() => {
    const pop = document.querySelector(".focus-shelf .effortpop");
    return { open: pop.classList.contains("is-open"), opacity: +getComputedStyle(pop).opacity };
  });
  assert(!popDismissed.open && popDismissed.opacity < .05,
    "a tap outside dismisses the explainer", JSON.stringify(popDismissed));
  // Keyboard operation of the field.
  await page.focus("#workout .exercise.is-current .focus-shelf [data-effspin]");
  const effBefore = await page.evaluate(() => document.querySelector("#workout .exercise.is-current .focus-shelf [data-effspin]").dataset.e);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(120);
  const effAfter = await page.evaluate(() => document.querySelector("#workout .exercise.is-current .focus-shelf [data-effspin]").dataset.e);
  assert(effBefore !== effAfter, "arrow keys move the effort word", `${effBefore} -> ${effAfter}`);
  // Correcting a logged set in effort mode reopens the word it was logged with.
  await openLoggedSets(page);
  await page.locator(".ledgerline[data-editn]").first().click();
  await page.waitForTimeout(200);
  const editEffort = await page.evaluate(() => ({
    spin: document.querySelector("#workout .exercise.is-current .focus-shelf [data-effspin]")?.dataset.e,
    row: [...document.querySelector(".ledgerline--open").querySelectorAll(".ledgerline__vals > .fx-col")][2]?.textContent?.trim(),
    editing: document.querySelectorAll(".ledgerline--open[aria-current]").length,
  }));
  assert(editEffort.editing === 1 && !!editEffort.spin &&
    editEffort.row?.toLowerCase().startsWith(editEffort.spin.slice(0, 3)),
    "editing an effort set reopens the word it was logged with", JSON.stringify(editEffort));
  // Correcting a set starts on reps again; the effort field is one tap away.
  await page.click("#workout .exercise.is-current .focus-shelf [data-shelf-field='rir']");
  await page.click("#workout .exercise.is-current .focus-shelf [data-effstep][data-dir='-1']");
  await page.locator("#workout .exercise.is-current .focus-shelf .saveset").click();
  await page.waitForTimeout(250);
  await openLoggedSets(page);
  const savedEffort = await page.evaluate(() => {
    const draft = window.__repforgeWorkoutDraft.current();
    const exercise = draft.exercises[draft.session.selectedExerciseId];
    return { effort: exercise.sets[exercise.setOrder[0]].edited.effort,
      rows: document.querySelectorAll(".ledgerline[data-editn]").length };
  });
  assert(savedEffort.effort && savedEffort.rows === 4,
    "saving an effort edit updates the set in place", JSON.stringify(savedEffort));

  // ---- 05 — a long ledger -----------------------------------------------------
  phase("State 05: high-volume exercise with a long ledger");
  await boot(page, { rirMode: "effort" });
  await setSetCount(page, 4, 10);
  await enterFocus(page, 4);
  const longBefore = await cardState(page);
  await logSets(page, 8, { load: 70, reps: 8 });
  st = await cardState(page);
  assert(st.logged + st.folded === 8 && st.folded > 0 && st.open === 1 && st.more === `${st.folded} earlier set${st.folded === 1 ? "" : "s"}`,
    "a long ledger keeps the open set and folds the oldest logged sets that do not fit, counted on the disclosure", JSON.stringify(st));
  assert(st.shelfHeight === longBefore.shelfHeight && st.shelfHeight >= 150 && st.spill <= 1,
    "a long session never shrinks the shelf or spills the card", JSON.stringify({ longBefore, st }));
  const openInView = await page.evaluate(() => {
    const context = document.querySelector("#workout .exercise.is-current .fcard__context");
    const ctx = context.getBoundingClientRect();
    const row = document.querySelector("#workout .exercise.is-current .ledgerline--open").getBoundingClientRect();
    return { row: Math.round(row.bottom), ctx: Math.round(ctx.bottom), scrolls: context.scrollHeight > context.clientHeight + 1 };
  });
  assert(openInView.row <= openInView.ctx + 1, "the context scrolls so the open row stays in view", JSON.stringify(openInView));
  // Layout D (owner decision Q4(a)): the disclosure is the one fold, and opened it gives every set its row back.
  await openLoggedSets(page);
  st = await cardState(page);
  assert(st.logged === 8 && st.rows === 10 && st.open === 1 && !(await page.evaluate(() => document.querySelector("#workout .exercise.is-current [data-fold]"))),
    "opened, every set keeps its row: eight logged, one open, one queued", JSON.stringify(st));

  // ---- 09 — exercise complete --------------------------------------------------
  phase("State 09: exercise complete with another exercise remaining");
  await boot(page);
  await setSetCount(page, 0, 3);
  await enterFocus(page, 0);
  await logSets(page, 3);
  st = await cardState(page);
  assert(/complete/i.test(st.doneTitle) && /3/.test(st.doneSub),
    "the shelf reports the exercise finished", JSON.stringify(st));
  assert(/next exercise/i.test(st.ctaText) && st.ctaArrow === true,
    "the next action is a navigation, and may carry an arrow", JSON.stringify(st));
  const afterLastSet = await focusAt(page);
  assert(afterLastSet.inCard && afterLastSet.live && afterLastSet.next,
    "logging an exercise's last set moves focus to the shelf's next-exercise action (R7 J-03)", JSON.stringify(afterLastSet));
  const atBefore = await page.evaluate(() => window.__repforgeFocus.at());
  await page.click("[data-fnext]");
  // Tapping through runs the same transition a swipe does, rather than cutting.
  await page.waitForTimeout(60);
  const tapSlide = await page.evaluate(() => {
    const track = document.querySelector("#focusTrack");
    const peek = document.querySelector(".deck__slot--next");
    return {
      moving: getComputedStyle(track).transform !== "none",
      settling: track.classList.contains("is-settling"),
      swiping: document.querySelector("#focusDeck").classList.contains("is-swiping"),
      peekVisible: peek ? getComputedStyle(peek).visibility === "visible" : null,
      at: window.__repforgeFocus.at(),
    };
  });
  assert(tapSlide.moving && tapSlide.settling && tapSlide.swiping &&
    tapSlide.peekVisible === true && tapSlide.at === atBefore,
    "Next exercise slides the deck across instead of cutting to it",
    JSON.stringify(tapSlide));
  await page.waitForTimeout(400);
  assert((await page.evaluate(() => window.__repforgeFocus.at())) === atBefore + 1,
    "the next-exercise action advances the deck");

  // ---- 10 — workout complete ---------------------------------------------------
  phase("State 10: final exercise and workout completion");
  await boot(page);
  // Every set of the day is logged through the draft's own commands, then the session resumes from storage.
  await page.evaluate(async ({ weight, reps }) => {
    await window.__repforgeEnterWorkout({});
    const api = window.__repforgeWorkoutDraft, draft = api.current();
    for (const exerciseInstanceId of draft.exerciseOrder) {
      for (const setId of draft.exercises[exerciseInstanceId].setOrder) {
        const n = draft.exercises[exerciseInstanceId].sets[setId].ordinal;
        await api.dispatch("editMetricValue", { exerciseInstanceId, setId, metricId: weight, value: "70" });
        await api.dispatch("editMetricValue", { exerciseInstanceId, setId, metricId: reps, value: String(11 - n) });
        await api.dispatch("editSetField", { exerciseInstanceId, setId, field: "rir", value: String(Math.max(0, 3 - n)) });
        await api.dispatch("completeSet", { exerciseInstanceId, setId, completedAt: new Date().toISOString() });
      }
    }
    await api.flush();
  }, { weight: WEIGHT, reps: REPS });
  await reload(page);
  const lastIndex = await page.evaluate(() => window.__repforgeFocus.list().length - 1);
  await enterFocus(page, lastIndex);
  st = await cardState(page);
  assert(/workout complete/i.test(st.doneTitle) && /every set/i.test(st.doneSub),
    "the final card reports the workout finished", JSON.stringify(st));
  assert(/finish/i.test(st.ctaText) && st.ctaArrow === false,
    "finishing the workout is a commit, so no arrow", JSON.stringify(st));
  const noNext = await page.evaluate(
    () => !document.querySelector("#workout .exercise.is-current .fx-next, #workout .exercise.is-current [data-fnext]")
  );
  assert(noNext, "the last exercise offers no way further along");
  await page.click("[data-ffinish]");
  await page.waitForSelector("#sessionSummary:not(.hidden)", { timeout: 8000 });
  await page.evaluate(() => window.__repforgeStorage.flush());
  const saved = await page.evaluate((k) => (JSON.parse(localStorage.getItem(k) || "{}").log || []).length, KEY);
  assert(saved === 12, "Finish workout saves every logged set of the session", `rows=${saved}`);

  // ---- 11 — swipe navigation ---------------------------------------------------
  phase("State 11: horizontal swipe between exercise cards");
  await boot(page);
  await setSetCount(page, 0, 5);
  await enterFocus(page, 0);
  await logSets(page, 2);
  const box = await page.locator("#workout .exercise.is-current").boundingBox();
  const y = Math.round(box.y + 40);
  const x = Math.round(box.x + box.width - 24);
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (const step of [-40, -110, -190]) {
    await page.mouse.move(x + step, y);
    await page.waitForTimeout(20);
  }
  // Whatever the peek shows mid-swipe is what the card must show once it lands:
  // a control that appears — or a box that changes height — on arrival is a card
  // rebuilding itself under the lifter's thumb.
  const shape = (root) => {
    const card = root.matches(".exercise--focus") ? root : root.querySelector(".exercise--focus");
    const box = (sel) => {
      const el = card.querySelector(sel);
      return el ? Number(el.getBoundingClientRect().height.toFixed(3)) : 0;
    };
    return {
      name: card.querySelector(".fcard__context")?.getAttribute("aria-label")?.trim() || "",
      fields: card.querySelectorAll(".shelf__field").length,
      pads: card.querySelectorAll(".shelf__pads > button").length,
      restBlock: card.querySelectorAll(".fx-slot .restinline, .restpad").length,
      cta: card.querySelector(".focus-shelf .btn--cta")?.textContent?.trim() || "",
      rows: card.querySelectorAll(".ledgerline").length,
      next: card.querySelectorAll(".fx-next").length,
      head: box(".fx-head"),
      ledger: box(".fcard__ledger"),
      shelf: box(".focus-shelf"),
    };
  };
  const midSwipe = await page.evaluate(`(${shape})(document.querySelector(".deck__slot--next"))`);
  const midState = await page.evaluate(() => {
    const peek = document.querySelector(".deck__slot--next");
    const track = document.querySelector("#focusTrack");
    const card = document.querySelector("#workout .exercise.is-current");
    return {
      peekVisible: getComputedStyle(peek).visibility === "visible",
      peekHasShelf: !!peek.querySelector(".focus-shelf"),
      // Composed, not wired: a peek carries no draft field and no hook that a
      // handler could fire on the neighbour's behalf.
      peekWired: !!peek.querySelector("[data-k], [data-save], [data-shelf-field], [data-step], [data-why], [data-fcancel]," +
        "[data-effstep], [data-effspin], [data-editn], [data-exopen], [data-fnext], [data-fnextrow], [data-ffinish]"),
      peekInert: !!peek.querySelector(".exercise--focus[inert]"),
      peekTabbable: [...peek.querySelectorAll("button, input, textarea")]
        .filter((el) => el.tabIndex >= 0).length,
      trackMoved: getComputedStyle(track).transform !== "none",
      cardUpright: getComputedStyle(card).transform === "none",
      stacked: document.querySelectorAll(".deck__layer").length,
      pageScrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  assert(midState.trackMoved && midState.peekVisible && midSwipe.name && midState.peekHasShelf,
    "the neighbouring card rides in fully composed", JSON.stringify({ ...midState, ...midSwipe }));
  // The two sets just logged armed a rest, which lives in the tab over the current shelf (rest timer redesign): the card
  // riding in carries its own fields and pads, with no rest block in it.
  assert(midSwipe.fields === 3 && midSwipe.pads === 2 && midSwipe.restBlock === 0 && !!midSwipe.cta && midSwipe.next === 1,
    "the card riding in already carries its fields, pads, action and next row",
    JSON.stringify(midSwipe));
  assert(midState.cardUpright && midState.stacked === 0,
    "the cards travel flat and upright, with no stack behind them", JSON.stringify(midState));
  assert(!midState.peekWired && midState.peekInert && midState.peekTabbable === 0 &&
    !midState.pageScrollsX,
    "the peek holds no hooks or tab stops and the page never scrolls sideways",
    JSON.stringify(midState));
  await page.mouse.up();
  await page.waitForTimeout(450);
  assert((await page.evaluate(() => window.__repforgeFocus.at())) === 1,
    "a swipe past the threshold advances the deck");
  const landed = await page.evaluate(`(${shape})(document.querySelector("#workout .exercise.is-current"))`);
  const same = ["name", "fields", "pads", "cta", "rows", "next", "head", "ledger", "shelf"]
    .filter((k) => landed[k] !== midSwipe[k]);
  assert(same.length === 0,
    "the card that landed is the one that rode in — nothing pops in, nothing reflows",
    JSON.stringify({ peek: midSwipe, landed, differs: same }));
  // Control and neutral card surfaces handle horizontal drag; prose is selectable.
  // The scroll region keeps vertical gestures and browser pinch.
  const grip = await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    const context = card.querySelector(".fcard__context");
    return { card: getComputedStyle(card).touchAction, context: getComputedStyle(context).touchAction };
  });
  assert(grip.card === "pan-y pinch-zoom" && grip.context === "pan-y pinch-zoom",
    "the card and its scroll region keep vertical scroll and pinch, so a horizontal swipe is the deck's", JSON.stringify(grip));
  // Drag from three heights: header, middle of the ledger, and the shelf.
  for (const [where, frac] of [["header", 0.08], ["ledger", 0.45], ["shelf", 0.9]]) {
    const at = await page.evaluate(() => window.__repforgeFocus.at());
    const b = await page.locator("#workout .exercise.is-current").boundingBox();
    // The top of the card is its prose (layout D moved the name to the header), so the top drag starts on Why, the
    // first control there.
    const header = where === "header" ? await page.locator("#workout .exercise.is-current [data-why]").first().boundingBox() : null;
    const gy = Math.round(header ? header.y + header.height / 2 : b.y + b.height * frac);
    const gx = Math.round(header ? header.x + header.width / 2 : b.x + b.width - 24);
    await page.mouse.move(gx, gy);
    await page.mouse.down();
    for (const step of [-40, -110, -200, -250]) {
      await page.mouse.move(gx + step, gy);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(450);
    const moved = (await page.evaluate(() => window.__repforgeFocus.at())) === at + 1;
    assert(moved, `a swipe started over the ${where} advances the deck`, `at ${at} -> ${await page.evaluate(() => window.__repforgeFocus.at())}`);
    if (moved) {
      await page.click("#woProgress [data-focusgo='0']");
      await page.waitForTimeout(300);
    }
  }
  // Swiping is never the only way through, and every way runs the same slide.
  await page.click("#woProgress [data-focusgo='1']");
  await page.waitForTimeout(450);
  await page.click("#woProgress [data-focusgo='0']");
  await page.waitForTimeout(60);
  const chevSlide = await page.evaluate(() => ({
    settling: document.querySelector("#focusTrack").classList.contains("is-settling"),
    swiping: document.querySelector("#focusDeck").classList.contains("is-swiping"),
  }));
  assert(chevSlide.settling && chevSlide.swiping,
    "the exercise bar slides the deck too", JSON.stringify(chevSlide));
  await page.waitForTimeout(400);
  assert((await page.evaluate(() => window.__repforgeFocus.at())) === 0,
    "a segment of the exercise bar walks back to its exercise");
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(400);
  assert((await page.evaluate(() => window.__repforgeFocus.at())) === 1,
    "the arrow keys move between exercises");

  // ---- accessibility and geometry across states --------------------------------
  phase("Across states: accessible names, tap targets, progress semantics");
  await enterFocus(page, 1);
  const a11y = await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    const named = (el) =>
      !!(el.getAttribute("aria-label") || el.textContent.trim() ||
         document.getElementById(el.getAttribute("aria-labelledby") || ""));
    const controls = [
      ...card.querySelectorAll("button"),
      ...document.querySelectorAll("#woProgress button, #restTab, #leaveWorkout, #sessionSheetBtn, #woOverflowBtn"),
    ].filter((el) => el.offsetParent !== null && !el.disabled && !el.closest("[inert]"));
    const small = controls
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; })
      .map((el) => `${el.className}:${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
    const segs = [...document.querySelectorAll("#woProgress .segbar__seg")];
    const colour = (el) => getComputedStyle(el.querySelector(".segbar__bar")).backgroundColor;
    return {
      unnamed: controls.filter((el) => !named(el)).length,
      small,
      deckNamed: !!document.querySelector("#focusDeck")?.getAttribute("aria-label"),
      inputsLabelled: [...card.querySelectorAll(".focus-shelf input")].every((i) => !!i.getAttribute("aria-label")),
      segmentsNamed: segs.filter((el) => el.matches("button")).every((el) => !!el.getAttribute("aria-label")) && segs.filter((el) => el.matches(".is-current")).length === 1,
      pressed: [...card.querySelectorAll("[data-shelf-field]")].every((el) => ["true", "false"].includes(el.getAttribute("aria-pressed"))),
      carriersAbsent: card.querySelectorAll(".focus-inputs").length === 0,
      done: segs[0] ? colour(segs[0]) : "",
      current: segs[1] ? colour(segs[1]) : "",
      upcoming: segs[2] ? colour(segs[2]) : "",
    };
  });
  assert(a11y.unnamed === 0, "every visible control has an accessible name", JSON.stringify(a11y));
  assert(a11y.small.length === 0, "every control is at least 44×44", JSON.stringify(a11y.small));
  assert(a11y.deckNamed && a11y.inputsLabelled && a11y.carriersAbsent && a11y.segmentsNamed && a11y.pressed,
    "the deck is named, the fields are labelled and pressed-state, the segments are named and hidden carriers are absent",
    JSON.stringify(a11y));
  // R7 J-23: the exercise-name heading (the header's, layout D) is named by the exercise, not by the
  // "Open … stats and history" button inside it.
  const focusName = (await page.locator("#woDayTitle").textContent()).trim();
  const namedHeading = await page.locator("#workoutShell .wo-head").getByRole("heading", { name: focusName, exact: true }).count();
  const openAction = await page.locator("#workoutShell .wo-head").getByRole("button", { name: /^Open .* stats and history$/ }).count();
  assert(focusName.length > 0 && namedHeading === 1 && openAction === 1,
    "the Focus exercise-name heading is named by the exercise, and its button keeps the open-stats action",
    JSON.stringify({ focusName, namedHeading, openAction }));
  assert(a11y.done !== a11y.current && a11y.current !== a11y.upcoming &&
    /27, 26, 23|rgb\(27/.test(a11y.done) && /224, 78, 20/.test(a11y.current),
    "completed segments are near-black, the current one orange, the rest warm gray",
    JSON.stringify(a11y));

  // Reduced motion: no card transitions to sit through.
  await ctx.close();
  const rmCtx = await browser.newContext({
    viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true,
    reducedMotion: "reduce",
  });
  const rmPage = await rmCtx.newPage();
  await boot(rmPage);
  await enterFocus(rmPage, 0);
  phase("Reduced motion");
  const motion = await rmPage.evaluate(() => {
    const track = document.querySelector("#focusTrack");
    const sheet = getComputedStyle(document.querySelector("#exNoteSheet"));
    return {
      track: getComputedStyle(track).transitionDuration,
      sheetProperty: sheet.transitionProperty,
      sheetDuration: sheet.transitionDuration,
      sheetTransform: sheet.transform,
    };
  });
  // ADR 0023 choice 11 (the sheets phase): under reduced motion a sheet doesn't
  // travel, it cross-fades opacity in place over ~170ms.
  assert(motion.sheetProperty === "opacity" && /^0\.1[5-9]s$/.test(motion.sheetDuration) && motion.sheetTransform === "none",
    "reduced motion cross-fades the sheet instead of sliding it", JSON.stringify(motion));
  await logSets(rmPage, 1);
  const rmLanded = await rmPage.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    // The landing beat is the logged row's, in the table where it fits (#517).
    const fresh = card.querySelector(".ledgerline.is-fresh");
    const anim = (el) => (el ? getComputedStyle(el).animationName : "");
    return { marked: !!fresh, row: anim(fresh) };
  });
  assert(rmLanded.marked && rmLanded.row === "none",
    "reduced motion logs the set without playing it in", JSON.stringify(rmLanded));
  await rmCtx.close();

  // Compact and large viewports.
  for (const [name, size] of [["compact 320×568", { width: 320, height: 568 }], ["large 430×932", { width: 430, height: 932 }]]) {
    phase(`Viewport: ${name}`);
    const vpCtx = await browser.newContext({ viewport: size, isMobile: true, hasTouch: true });
    const vp = await vpCtx.newPage();
    await boot(vp, { size });
    await setSetCount(vp, 0, 5);
    await enterFocus(vp, 0);
    await logSets(vp, 2);
    const fit = await vp.evaluate(() => {
      const card = document.querySelector("#workout .exercise.is-current");
      const context = card.querySelector(".fcard__context");
      const cta = card.querySelector(".focus-shelf .btn--cta").getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();
      const clipped = [...card.querySelectorAll(".fx-cue__l1, .focus-ex__meta, .ledgerline__head > span")]
        .filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow !== "ellipsis").length;
      return {
        spill: card.scrollHeight - card.clientHeight,
        ledger: Math.round(context.clientHeight),
        ctaWhole: cta.bottom <= cardBox.bottom + 1 && cta.height >= 44,
        clipped,
        pageScrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        pageScrollsY: document.documentElement.scrollHeight > window.innerHeight + 2,
      };
    });
    assert(fit.spill <= 1 && fit.ctaWhole, `${name}: the card fits and keeps its action`, JSON.stringify(fit));
    assert(fit.ledger >= 44, `${name}: the scrolling ledger area still shows a row`, JSON.stringify(fit));
    assert(fit.clipped === 0 && !fit.pageScrollsX && !fit.pageScrollsY,
      `${name}: no clipped labels, no stray scrolling`, JSON.stringify(fit));
    await vpCtx.close();
  }

  // The presets sheet at 200% text (RT-04 follow-up): a long word such as Reiniciar clipped in its box. Every control's
  // label must sit inside its control, and the sheet inside the viewport, in both languages at the two narrowest widths.
  for (const [name, size] of [["320×568", { width: 320, height: 568 }], ["390×844", { width: 390, height: 844 }]]) {
    for (const lang of ["en", "pt"]) {
      phase(`Rest presets sheet at 200% text: ${name}, ${lang.toUpperCase()}`);
      const restCtx = await browser.newContext({ viewport: size, isMobile: true, hasTouch: true });
      const restPage = await restCtx.newPage();
      await boot(restPage, { size, lang });
      await enterFocus(restPage, 0);
      const probe = () => restPage.evaluate(() => {
        const sheet = document.querySelector("#restSheet");
        const box = sheet.getBoundingClientRect();
        const controls = [...sheet.querySelectorAll("button")].map((button) => {
          const rect = button.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(button);
          const lines = [...range.getClientRects()].filter((line) => line.width && line.height);
          const inside = lines.every((line) => line.left >= rect.left - 0.5 && line.right <= rect.right + 0.5 && line.top >= rect.top - 0.5 && line.bottom <= rect.bottom + 0.5);
          const label = button;
          return { id: button.id || button.dataset.restpreset, text: button.textContent.trim(), inside, scrolls: label.scrollWidth > label.clientWidth + 1,
            tall: rect.height >= 44 - 0.5, top: Math.round(rect.top), width: Math.round(rect.width) };
        });
        return { controls, withinViewport: box.left >= -0.5 && box.right <= innerWidth + 0.5 && box.bottom <= innerHeight + 0.5,
          pageScrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          ellipsis: [...sheet.querySelectorAll("*")].filter((el) => getComputedStyle(el).textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1).length };
      });
      await restPage.evaluate(() => { document.documentElement.style.fontSize = "200%"; window.startRest(); });
      await restPage.waitForSelector("#restTab");
      await restPage.click("#restTab");
      await restPage.waitForSelector("#restSheet:not([hidden]).is-open");
      await restPage.waitForTimeout(400);
      const big = await probe();
      const ids = big.controls.map((control) => control.id);
      assert(["restHold", "restMinus", "restPlus", "restReset", "restStop"].every((id) => ids.includes(id)),
        "the open sheet lists Pause or Resume, the nudges, restart and end", ids.join());
      assert(big.controls.every((control) => control.inside && !control.scrolls),
        "no control label overflows its control at 200% text", JSON.stringify(big.controls.filter((control) => !control.inside || control.scrolls)));
      assert(big.controls.every((control) => control.tall), "every control keeps a 44px target at 200% text", JSON.stringify(big.controls.map((control) => [control.id, control.tall])));
      assert(big.withinViewport && !big.pageScrollsX && big.ellipsis === 0,
        "the sheet stays inside the viewport with no sideways scroll and no ellipsis", JSON.stringify(big));
      await restPage.click("#restSheetClose");
      await restPage.waitForFunction(() => document.querySelector("#restSheet")?.hidden === true);
      // At the usual size the primary control sits between the nudges on one row.
      await restPage.evaluate(() => { document.documentElement.style.fontSize = ""; });
      await restPage.click("#restTab");
      await restPage.waitForSelector("#restSheet:not([hidden]).is-open");
      await restPage.waitForTimeout(400);
      const usual = await probe();
      const row = usual.controls.filter((control) => ["restMinus", "restHold", "restPlus"].includes(control.id));
      const centre = (control) => control.top;
      assert(row.length === 3 && row.every((control) => control.inside) && Math.abs(centre(row[0]) - centre(row[2])) <= 1,
        "at the usual size -30s and +30s sit level either side of the primary control", JSON.stringify(row));
      await restCtx.close();
    }
  }

  phase("Complete draft resume (UX-19)");
  const draftCtx = await browser.newContext({
    viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true,
    serviceWorkers: "block",
  });
  const draftPage = await draftCtx.newPage();
  draftPage.on("pageerror", (error) => errors.push(error.message));
  draftPage.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await draftPage.goto(BASE, { waitUntil: "domcontentloaded" });
  await settle(draftPage);
  // This context is its own device, and a device with no onboarded program has
  // no session to draft against.
  await persist(draftPage, `
    s.program = ${JSON.stringify(seedProgram())};
    s.programMeta = ${JSON.stringify(seedProgramMeta())};
    s.log = [];`);
  await reload(draftPage);
  const focusIds = await draftPage.evaluate(() => window.__repforgeFocus.list().map((e) => ({ id: e.id, name: e.name, day: e.day })));
  const skipEx = focusIds[1] || focusIds[0];
  const keepEx = focusIds[0];
  // The session is built through the product: a substitution picked in the visible picker, a skip, and the
  // kept exercise's sets logged through the draft's commands. A reload then resumes it from storage.
  const alt = "Pendulum squat";
  await enterFocus(draftPage, 0);
  await exerciseAction(draftPage, keepEx.id, "#exActionSubstBtn");
  await draftPage.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
  await draftPage.fill("#exPickSearch", alt);
  const altRow = draftPage.locator("#exPickList .pickrow").filter({ has: draftPage.locator(".pickrow__name", { hasText: new RegExp(`^${alt}$`) }) });
  await altRow.first().click();
  await draftPage.waitForSelector("#exPickSheet.is-reason-step", { timeout: 5000 });
  await draftPage.click("#exPickReasonSkip");
  await draftPage.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
  await exerciseAction(draftPage, skipEx.id, "#exActionSkipBtn");
  const resumedSets = await draftPage.evaluate(async ({ id, weight, reps }) => {
    const api = window.__repforgeWorkoutDraft, exercise = api.current().exercises[id];
    for (const setId of exercise.setOrder) {
      await api.dispatch("editMetricValue", { exerciseInstanceId: id, setId, metricId: weight, value: "70" });
      await api.dispatch("editMetricValue", { exerciseInstanceId: id, setId, metricId: reps, value: "8" });
      await api.dispatch("editSetField", { exerciseInstanceId: id, setId, field: "rir", value: "1" });
      await api.dispatch("completeSet", { exerciseInstanceId: id, setId, completedAt: new Date().toISOString() });
    }
    await api.flush();
    return exercise.setOrder.length;
  }, { id: keepEx.id, weight: WEIGHT, reps: REPS });
  await reload(draftPage);
  await enterFocus(draftPage, 0);
  const deck = await draftPage.evaluate(() => {
    const list = window.__repforgeFocus.list();
    const name = document.querySelector("#woDayTitle")?.textContent?.trim();
    return { count: list.length, name, ids: list.map((e) => e.id) };
  });
  assert(
    !deck.ids.includes(skipEx.id) && deck.count === focusIds.length - 1,
    "Focus reload drops a skipped exercise from the deck",
    JSON.stringify(deck),
  );
  assert(
    deck.name.includes(alt),
    "Focus reload shows the substitution name on the deck",
    JSON.stringify({ deck, alt }),
  );
  const beforeSave = await draftPage.evaluate((k) => ({
    href: location.href,
    logLength: (JSON.parse(localStorage.getItem(k) || "{}").log || []).length,
  }), KEY);
  let finishFrameNavigations = 0;
  let finishNavigationRequests = 0;
  const onFinishFrameNavigation = (frame) => {
    if (frame === draftPage.mainFrame()) finishFrameNavigations++;
  };
  const onFinishNavigationRequest = (request) => {
    if (request.isNavigationRequest() && request.frame() === draftPage.mainFrame()) finishNavigationRequests++;
  };
  draftPage.on("framenavigated", onFinishFrameNavigation);
  draftPage.on("request", onFinishNavigationRequest);
  // This resumed draft deliberately contains a skipped exercise, so its
  // completion must use the explicit early-finish confirmation UI.
  const result = await finishEarly(draftPage);
  const resumedSave = await draftPage.evaluate(async ({ k, d, exerciseId, performedName }) => {
    await window.__repforgeStorage.flush();
    const log = JSON.parse(localStorage.getItem(k) || "{}").log || [];
    const matchingRows = log.filter((row) => row.exerciseId === exerciseId && row.performedName === performedName);
    return {
      href: location.href,
      logLength: log.length,
      draftCleared: localStorage.getItem(d) === null,
      sessions: [...new Set(matchingRows.map((row) => row.session))],
      matchingRows: matchingRows.map((row) => ({
        exerciseId: row.exerciseId,
        performedName: row.performedName,
        session: row.session,
        set: row.set,
      })),
    };
  }, { k: KEY, d: DRAFT, exerciseId: keepEx.id, performedName: alt });
  resumedSave.result = result;
  draftPage.off("framenavigated", onFinishFrameNavigation);
  draftPage.off("request", onFinishNavigationRequest);
  const finishNavigation = {
    requests: finishNavigationRequests,
    frames: finishFrameNavigations,
    beforeUrl: beforeSave.href,
    afterUrl: draftPage.url(),
  };
  assert(
    finishNavigation.requests === 0 && finishNavigation.frames === 0 && finishNavigation.afterUrl === finishNavigation.beforeUrl,
    "Focus finish completes without navigation",
    JSON.stringify(finishNavigation),
  );
  assert(
    (resumedSave.result.localOk || resumedSave.result.idbOk) &&
      resumedSave.draftCleared &&
      resumedSave.logLength - beforeSave.logLength === resumedSets &&
      resumedSave.matchingRows.length === resumedSets &&
      resumedSave.sessions.length === 1 &&
      resumedSave.matchingRows.every((row, index) =>
        row.exerciseId === keepEx.id && row.performedName === alt && row.set === index + 1
      ),
    "Focus finish saves the resumed substitution exactly once",
    JSON.stringify({ resumedSets, beforeSave, saved: resumedSave }),
  );
  await draftCtx.close();

  // ---- Adaptive cue: a generated program's Focus cue is the engine's recommendation ----
  // The retired capacity engine's cases (mixed-load hold, re-entry reps) are gone with it. What
  // stays is the contract the cue always had: the load and reps it names are the ones the engine put
  // in the set, so the cue, the shelf and the draft never disagree, and the move it draws is the move
  // from the load the set is judged against.
  phase("Adaptive cue: a generated program's Focus cue is the engine's recommendation");
  {
    const adCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const ad = await adCtx.newPage();
    ad.on("pageerror", (e) => errors.push(e.message));
    await ad.clock.setFixedTime(new Date("2026-03-02T09:00:00.000Z"));
    await ad.goto(BASE, { waitUntil: "domcontentloaded" });
    await settle(ad);
    const target = await ad.evaluate(async ({ weight, reps }) => {
      const catalog = window.RepForgeExerciseCatalog.snapshot();
      const request = window.RepForgeProgramEntryAdapter.programRequestFromAnswers({ desiredResult: "muscle_growth",
        structuredExperience: "6_to_24m", daysPerWeek: 4, sessionMinutes: 60, environment: { kind: "commercial_gym" } }, catalog).value;
      const definition = window.RepForgeProgramCompiler.generateProgram(request, catalog).value;
      await window.__repforgeFinalizeProgramSetup({ programDefinition: definition, name: "Adaptive focus", answers: {},
        destination: "log", origin: "first-run", draftConfirmed: true, telemetryRoute: "recommend",
        entrySource: { route: "recommend", fingerprint: "focus-mode-adaptive" } });
      await window.__repforgeStorage.flush();
      const day = definition.days.find((item) => item.kind === "training" &&
        JSON.stringify(item.slots[0].metricIds) === JSON.stringify([weight, reps]));
      return day ? { day: day.name, slotId: day.slots[0].id, sets: day.slots[0].prescriptionsByCycle[0].sets.length,
        reps: day.slots[0].prescriptionsByCycle[0].sets[0].targets.reps } : null;
    }, { weight: WEIGHT, reps: REPS });
    assert(target && target.sets >= 2, "the generated program has a Weight + Reps first slot with at least two sets", JSON.stringify(target));
    const enter = async () => {
      await ad.evaluate((day) => window.__repforgeEnterWorkout({ day }), target.day);
      await ad.waitForSelector(`#workout.is-focus .exercise.is-current[data-ex="${target.slotId}"]`, { timeout: 5000 });
    };
    const draftSet = (ordinal) => ad.evaluate(({ id, ordinal, weight, reps }) => {
      const exercise = window.__repforgeWorkoutDraft.current().exercises[id];
      const set = exercise.sets[exercise.setOrder.find((setId) => exercise.sets[setId].ordinal === ordinal)];
      return { load: set.edited.metrics[weight], reps: set.edited.metrics[reps] };
    }, { id: target.slotId, ordinal, weight: WEIGHT, reps: REPS });
    const shelfLoad = () => ad.locator(`#workout .exercise.is-current .focus-shelf .shelf__field[data-metric="${WEIGHT}"] .shelf__val`).textContent();

    await enter();
    let cue = await cardState(ad);
    const range = `${target.reps.min}–${target.reps.max}`;
    assert(cue.cueKind === "is-start" && cue.cueL1 === `Pick a load for ${range} reps` && cue.cueMark === null &&
      (await draftSet(1)).load == null,
    "a lift with no history asks for a starting load and the draft holds none", JSON.stringify({ cue, set: await draftSet(1) }));
    for (let n = 1; n <= 2; n++) {
      await ad.locator(`#workout .exercise.is-current .focus-shelf .shelf__input[data-metric-id="${WEIGHT}"]`).fill("100");
      await ad.locator(`#workout .exercise.is-current .focus-shelf .shelf__input[data-metric-id="${REPS}"]`).fill("8");
      await ad.locator(`#workout .exercise.is-current .focus-shelf .shelf__input[data-k="${target.slotId}_${n}_rir"]`).fill("2");
      await ad.evaluate(() => window.__repforgeWorkoutDraft.flush());
      await ad.locator(`#workout .exercise.is-current [data-save="${target.slotId}_${n}"]`).click();
      await ad.waitForFunction(({ id, n }) => {
        const exercise = window.__repforgeWorkoutDraft.current().exercises[id];
        return exercise.sets[exercise.setOrder[n - 1]].completion !== "pending";
      }, { id: target.slotId, n });
    }
    await finishEarly(ad);
    await ad.evaluate(() => window.closeSessionSummary?.());

    await ad.clock.setFixedTime(new Date("2026-03-04T09:00:00.000Z"));
    await reload(ad);
    await enter();
    const first = await draftSet(1);
    cue = await cardState(ad);
    const cueLoad = await ad.locator("#workout .exercise.is-current .fx-cue__load").textContent().catch(() => null);
    assert(cue.cueKind === "is-now" && Number(first.load) > 0 && Number(cueLoad) === Number(first.load) &&
      cue.cueL2 === `aim for ${first.reps} reps`,
    "with history the cue names the load and reps the engine put in the first set", JSON.stringify({ cue, cueLoad, first }));
    assert(Number((await shelfLoad())?.replace(",", ".")) === Number(first.load),
      "the shelf shows the same recommended load the cue names", JSON.stringify({ shelf: await shelfLoad(), first }));
    const move = assertCueMark(cue, "Adaptive cue");
    const expectedMove = Number(first.load) === 100 ? "hold" : Number(first.load) > 100 ? "up" : "down";
    assert(move === expectedMove, "the cue's move is the recommendation against last session's 100 kg", JSON.stringify({ move, first }));

    // Log the first set as recommended; the next set's line and cue are the engine's second set.
    await ad.locator(`#workout .exercise.is-current [data-save="${target.slotId}_1"]`).click();
    await ad.waitForFunction((id) => {
      const exercise = window.__repforgeWorkoutDraft.current().exercises[id];
      return exercise.sets[exercise.setOrder[0]].completion !== "pending";
    }, target.slotId);
    const second = await draftSet(2);
    // The rest sheet's dial names the next set (rest timer redesign): the second set the engine recommended.
    await ad.locator("#restTab").click();
    await ad.waitForSelector("#restSheet:not([hidden]).is-open");
    const next = await ad.evaluate(() => ({ text: document.querySelector("#restDialNext")?.textContent?.replace(/\s+/g, " ").trim() || "" }));
    const nextMatch = /^Next: set 2 · ([\d.,]+) kg × (\d+)$/.exec(next.text);
    assert(nextMatch && Number(nextMatch[1].replace(",", ".")) === Number(second.load) && nextMatch[2] === String(second.reps),
    "the rest sheet's dial names the second set the engine recommended", JSON.stringify({ next, second }));
    await ad.locator("#restSheetClose").click();
    await ad.waitForFunction(() => document.querySelector("#restSheet")?.hidden === true);
    await endRest(ad);
    const secondCue = await ad.locator("#workout .exercise.is-current .fx-cue__load").textContent().catch(() => null);
    assert(Number(secondCue) === Number(second.load) && Number((await shelfLoad())?.replace(",", ".")) === Number(second.load),
      "after the rest the cue and the shelf name the engine's second set", JSON.stringify({ secondCue, shelf: await shelfLoad(), second }));
    await adCtx.close();
  }

  phase("Console");

  assert(errors.length === 0, "no page errors during the focus run", errors.join(" | "));

  await browser.close();
  console.log(`\n${results.passed} passed, ${results.failed} failed`);
  if (results.failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
