#!/usr/bin/env node
/**
 * Focus hero, evidence line and visible logged sets (#523, #518, #517; owner direction A, 2026-10-28).
 *
 * On a generated adaptive program with no history:
 * - set 1 has no suggestion, and the evidence line says why (no logged effort yet) without a weight;
 * - after set 1 is logged, set 2's hero is the engine's target, and the evidence line names the set the engine anchored
 *   on (its load, reps and RIR as logged) and the reps and RIR the target aims at. The Why sheet opened from it names
 *   the same set, load and target. Hold, up and down each come from what was logged;
 * - the logged set shows in place on a tall phone, above the shelf and the rest tab;
 * - on a short phone the oldest logged rows fold when they do not fit, the disclosure counts exactly the rows it hides,
 *   opening it shows them and closing it folds them again; a few pixels of height change never refolds the table, and
 *   a keyboard-sized change does, without a render;
 * - the hero is the largest text on the card and never spills, at 200% text too;
 * - the line survives a reload, and reads in Portuguese from the Portuguese catalog.
 *
 * Every expected string comes from `window.RepForgeI18n.t(...)`; every number from the page or the engine hook.
 *
 * Run: REPFORGE_URL=http://localhost:8000/ node test/focus-hero.mjs
 */
import { readFileSync } from "node:fs";
import { launchChromium, openShelfField, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const DATA = new URL("../plans/067/data/", import.meta.url);
const gym = JSON.parse(readFileSync(new URL("gym.json", DATA), "utf8"));
const observations = JSON.parse(readFileSync(new URL("programs.json", DATA), "utf8"));
const catalog = JSON.parse(readFileSync(new URL("app_file.json", DATA), "utf8"));
const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";
const observedIds = [...new Set(Object.values(observations).flatMap((program) =>
  program.days.flatMap((day) => day.exercises.map((entry) => entry.exerciseId))))];
const REQUEST = {
  goal: "hypertrophy", experience: "intermediate", daysPerWeek: 4, timeCeilingMinutes: 90,
  gymProfile: { equipmentIds: gym.equipment.map((entry) => entry.equipmentId) },
  competencyAnswers: {
    pullups10: null, pullups5: null, pushups15: null, inclineBarbell10: null,
    overheadPress10: null, bodyweightDips10: null, benchPress10: null,
  },
  movementConfirmations: Object.fromEntries(observedIds.map((id) =>
    [id, [...catalog.exercises.find((entry) => entry.id === id).preconditions]])),
  emphasisMuscleIds: [], deprioritizedMuscleIds: [], excludedExerciseIds: [], excludedMuscleIds: [],
  preferredExerciseIds: [], split: "auto", periodization: "static", cycles: 7, deloadCycles: [],
};

let checks = 0;
function ok(condition, name, detail) {
  if (!condition) throw new Error(`✗ ${name}${detail === undefined ? "" : `\n    ${JSON.stringify(detail).slice(0, 2400)}`}`);
  checks++;
  console.log(`  ✓ ${name}`);
}

/** A generated program whose first weighted slot (load and reps, the most sets) is the one the suite trains. */
async function seed(page) {
  return page.evaluate(({ request, weight, reps }) => {
    const generated = window.RepForgeProgramCompiler.generateProgram(request, window.RepForgeExerciseCatalog.snapshot());
    const definition = generated.value;
    const target = definition.days.filter((day) => day.kind === "training").map((day) => ({ day, slot: day.slots[0] }))
      .filter(({ slot }) => JSON.stringify(slot.metricIds) === JSON.stringify([weight, reps]) &&
        slot.prescriptionsByCycle[0].sets.length >= 3)
      .sort((a, b) => b.slot.prescriptionsByCycle[0].sets.length - a.slot.prescriptionsByCycle[0].sets.length)[0];
    return window.__repforgeFinalizeProgramSetup({
      programDefinition: definition, name: "Focus hero proof", answers: {}, destination: "log", origin: "first-run",
      draftConfirmed: true, telemetryRoute: "recommend", entrySource: { route: "recommend", fingerprint: "focus-hero-523" },
    }).then(() => window.__repforgeStorage.flush()).then(() => {
      const program = JSON.parse(localStorage.getItem("repforge_v1") || "{}").program || [];
      const row = target && program.find((entry) => entry.slotId === target.slot.id);
      return row && { rowId: row.id, slotId: target.slot.id, sets: target.slot.prescriptionsByCycle[0].sets.length };
    });
  }, { request: REQUEST, weight: WEIGHT, reps: REPS });
}

async function open(browser, { width = 390, height = 844, lang = "en", text = "normal" } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale: lang === "pt" ? "pt-BR" : "en-US" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  await page.clock.setFixedTime(new Date("2026-03-02T09:00:00.000Z"));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  const target = await seed(page);
  if (!target) throw new Error("the generated program has no weighted first slot with three or more sets");
  if (text === "text200") await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await page.evaluate((id) => window.__repforgeGoToLogExercise(id), target.rowId);
  await page.waitForFunction((id) => document.querySelector("#workout.is-focus .exercise.is-current")?.dataset.ex === id,
    target.rowId, { timeout: 15000 });
  await settle(page);
  return { context, page, target, errors };
}

const settle = (page, ms = 300) => page.evaluate((n) => new Promise((done) => setTimeout(() => requestAnimationFrame(() => done()), n)), ms);

async function fillShelf(page, metricId, value) {
  const input = page.locator(`#workout .exercise.is-current .focus-shelf input[data-metric-id="${metricId}"]`);
  await input.waitFor({ state: "attached", timeout: 5000 });
  if (await input.getAttribute("aria-hidden") === "true")
    await openShelfField(page, `#workout .exercise.is-current .focus-shelf [data-shelf-field="metric_${metricId}"]`);
  await input.fill(String(value));
}

/** Log `ordinal` with these values; the rest it starts keeps running unless `stopRest`. */
async function logSet(page, slotId, ordinal, { load, reps, rir }, { stopRest = true } = {}) {
  await fillShelf(page, WEIGHT, load);
  await fillShelf(page, REPS, reps);
  const rirInput = page.locator(`#workout .exercise.is-current .focus-shelf input[data-k="${slotId}_${ordinal}_rir"]`);
  if (await rirInput.getAttribute("aria-hidden") === "true")
    await page.locator('#workout .exercise.is-current .focus-shelf [data-shelf-field="rir"]').click();
  await rirInput.fill(String(rir));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.locator(`#workout .exercise.is-current [data-save="${slotId}_${ordinal}"]`).click();
  await page.waitForFunction(({ slotId, ordinal }) => {
    const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[slotId];
    const setId = exercise?.setOrder?.find((id) => exercise.sets[id].ordinal === ordinal);
    return typeof exercise?.sets?.[setId]?.completion === "object";
  }, { slotId, ordinal }, { timeout: 15000 });
  if (stopRest) {
    const resting = await page.waitForFunction(() => restEnd > 0, undefined, { timeout: 3000 }).then(() => true, () => false);
    if (resting) {
      await page.evaluate(() => window.stopRest());
      await page.waitForFunction(() => !restEnd, undefined, { timeout: 10000 });
    }
  } else await page.waitForSelector("#restTab", { timeout: 10000 });
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))));
  await settle(page);
}

/** What the live card shows, measured in the page. */
function readCard() {
  const card = document.querySelector("#workout .exercise--focus.is-current");
  if (!card) return { error: "no live Focus card" };
  const context = card.querySelector(".fcard__context"), shelf = card.querySelector(".focus-shelf");
  const tab = card.querySelector(".resttab");
  const windowTop = context.getBoundingClientRect().top;
  const windowBottom = Math.min(context.getBoundingClientRect().bottom, shelf.getBoundingClientRect().top,
    tab && tab.getClientRects().length ? tab.getBoundingClientRect().top : Infinity);
  const box = (el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.height > 0 && r.top >= windowTop - 0.5 && r.bottom <= windowBottom + 0.5; };
  const l1 = card.querySelector(".fx-cue__l1"), evidence = card.querySelector(".fx-cue__evidence");
  const more = card.querySelector(".ledger__more");
  const done = [...card.querySelectorAll(".ledger__rows > [data-ldone]")];
  const open = card.querySelector(".ledgerline--open");
  const sizes = [...card.querySelectorAll(".fcard__context *")].filter((el) => el.childElementCount === 0 && el.textContent.trim() && el.getClientRects().length)
    .map((el) => parseFloat(getComputedStyle(el).fontSize));
  return {
    l1: l1?.textContent.replace(/\s+/g, " ").trim() || "",
    l1Size: l1 ? parseFloat(getComputedStyle(l1).fontSize) : 0,
    largest: Math.max(...sizes),
    marks: [...card.querySelectorAll(".fx-cue__l1 .fx-cue__mark .verdictmark")].map((el) => el.className.replace(/.*verdictmark--/, "")),
    markColumn: !!card.querySelector(".fx-cue > .fx-cue__mark"),
    evidence: evidence ? evidence.cloneNode(true) : null,
    evidenceText: (() => {
      if (!evidence) return "";
      const copy = evidence.cloneNode(true);
      copy.querySelector(".fx-cue__why")?.remove();
      return copy.textContent.replace(/\s+/g, " ").trim();
    })(),
    why: evidence?.querySelector("[data-why]")?.textContent.trim() || "",
    whyHeight: evidence?.querySelector("[data-why]")?.getBoundingClientRect().height || 0,
    spills: [l1, evidence, card.querySelector(".fx-cue__l2")].filter(Boolean).some((el) => el.scrollWidth > el.clientWidth + 1),
    done: done.map((row) => ({ hidden: row.hidden, inView: inView(row), text: row.textContent.replace(/\s+/g, " ").trim(), ...box(row) })),
    open: open && { inView: inView(open), ...box(open) },
    hero: l1 && { inView: inView(l1) },
    more: more && { hidden: more.hidden, expanded: more.getAttribute("aria-expanded"), text: more.textContent.replace(/\s+/g, " ").trim(),
      controls: more.getAttribute("aria-controls") },
    tab: !!(tab && tab.getClientRects().length),
  };
}
const card = async (page) => { const value = await page.evaluate(readCard); delete value.evidence; return value; };

/** The engine's own answer for set n, through the same hook the Why sheet's model reads. */
async function engineSet(page, rowId, n) {
  return page.evaluate(({ rowId, n }) => {
    const P = window.__repforgeProgression;
    const rec = P.recommendation(P.programSlot(rowId));
    const item = rec.targetSets.find((entry) => entry.prescription?.setIndex === n);
    const definitions = rec.metricDefinitions;
    const semantic = (field) => definitions.find((metric) => metric.id === field)?.semantic;
    const reps = item?.result?.targets?.[semantic("2555c6f170d88072bbf6d9ad3f16ea86")];
    return { status: rec.status, reasonCodes: rec.reasonCodes, itemStatus: item?.status, anchor: item?.result?.historyAnchor || null,
      load: item?.result?.targets?.[semantic("2555c6f170d8805cafa6d16d3fdddbaa")] ?? null,
      reps: typeof reps === "number" ? reps : reps?.min ?? null, rir: item?.prescription?.rir ?? null,
      projected: item?.result?.fatigue?.projectedCapacityKg ?? null };
  }, { rowId, n });
}

const t = (page, key, vars) => page.evaluate(({ key, vars }) => window.RepForgeI18n.t(key, vars), { key, vars });
const num = (v) => Number.isInteger(+v) ? String(+v) : String(+v);

/** The evidence line the facts call for, in the page's language, from the catalog strings. */
async function expectedEvidence(page, set, logged, engine) {
  const lang = await page.evaluate(() => window.RepForgeI18n.getLang());
  const local = (v) => lang === "pt" ? String(v).replace(".", ",") : String(v);
  const anchor = await t(page, "focus.evidence.session", { set, load: `${local(logged.load)} × ${logged.reps}`, rir: local(logged.rir) });
  const fatigued = set >= 1 && Number.isFinite(engine.projected) && Number.isFinite(engine.anchor?.capacityKg)
    && Math.abs(engine.projected - engine.anchor.capacityKg) > 0.25;
  const target = await t(page, fatigued ? "focus.evidence.target_fatigue" : "focus.evidence.target", { reps: engine.reps, rir: local(engine.rir) });
  return `${anchor} ${target}`;
}

const browser = await launchChromium();
try {
  console.log("Set 1 without history: no suggestion, and the line says why without a weight");
  const tall = await open(browser);
  {
    const { page, target } = tall;
    const engine = await engineSet(page, target.rowId, 1);
    ok(engine.status === "new" && engine.reasonCodes.includes("no_comparable_history") && engine.load == null,
      "the fixture's first set has no comparable history", engine);
    const now = await card(page);
    const expected = await t(page, "focus.evidence.none_new", { what: await t(page, "focus.evidence.what_rir") });
    ok(now.l1 === await t(page, "focus.cue.pick_load", { min: (await page.evaluate((id) => window.__repforgeProgression.programSlot(id).min, target.rowId)),
      max: (await page.evaluate((id) => window.__repforgeProgression.programSlot(id).max, target.rowId)) }), "the hero asks for a load", now.l1);
    ok(now.evidenceText === expected, "the evidence line gives the no-history reason from the catalog", now);
    ok(!/\d+(?:[.,]\d+)?\s*kg/.test(now.evidenceText), "the no-suggestion line names no weight", now.evidenceText);
    ok(!now.marks.length && !now.markColumn, "a cue without a verdict has no mark and no reserved column", now);
    ok(now.l1Size === 34 && now.largest === 34, "the hero is 34px and the largest text on the card", now);
  }

  console.log("Set 2 after set 1: the engine's target, and the evidence the Why sheet names");
  {
    const { page, target } = tall;
    const logged = { load: 60, reps: 8, rir: 1 };
    await logSet(page, target.slotId, 1, logged);
    const engine = await engineSet(page, target.rowId, 2);
    ok(engine.itemStatus === "recommended" && engine.anchor?.source === "current_session" && engine.anchor.setIndex === 0,
      "set 2 is anchored on set 1 of this session", engine);
    const now = await card(page);
    const expected = await expectedEvidence(page, 1, logged, engine);
    ok(now.evidenceText === expected, "the evidence line names set 1 as logged and the engine's set-2 target", { now: now.evidenceText, expected });
    ok(now.l1.includes(num(engine.load)), "the hero carries the engine's load", { l1: now.l1, engine });
    ok(now.why === await t(page, "focus.evidence.why") && now.whyHeight >= 44, "the line ends in a Why? action with a 44px target", now);
    ok(now.marks.length === 1, "a verdict draws one inline mark", now.marks);
    ok(now.done.length === 1 && !now.done[0].hidden && now.done[0].inView && now.open?.inView,
      "on a tall phone the logged set and the open set both show, above the shelf", now);
    ok(now.more?.hidden === true, "nothing is folded, so the disclosure is not drawn", now.more);

    await page.locator("#workout .exercise.is-current [data-why]").click();
    await page.waitForSelector("#whySheet.is-open");
    await settle(page, 200);
    const sheet = await page.evaluate(() => [...document.querySelectorAll("#whyBody .whysheet__block")]
      .map((el) => ({ lead: el.getAttribute("data-lead"), text: el.querySelector(".whysheet__text")?.textContent.trim() || "" })));
    const anchorBlock = sheet.find((block) => block.lead === "engine-anchor")?.text || "";
    const targetBlock = sheet.find((block) => block.lead === "engine-target")?.text || "";
    ok(anchorBlock.includes(await t(page, "why.engine.anchor_session", { set: 1, load: num(engine.anchor.displayLoadKg),
      cap: num(Math.round(engine.anchor.capacityKg * 2) / 2), unit: "kg" })), "the Why sheet anchors on the same set and load", sheet);
    ok(targetBlock === await t(page, "why.engine.target", { rir: num(engine.rir), reps: engine.reps, load: num(engine.load), unit: "kg" }),
      "the Why sheet's target is the same reps and RIR as the line, at the hero's load", { targetBlock, engine });
    await page.click("#whyClose");
    await page.waitForSelector("#whySheet", { state: "hidden" });

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await page.evaluate((id) => window.__repforgeGoToLogExercise(id), target.rowId);
    await page.waitForFunction((id) => document.querySelector("#workout.is-focus .exercise.is-current")?.dataset.ex === id, target.rowId, { timeout: 15000 });
    await settle(page);
    const again = await card(page);
    ok(again.evidenceText === expected && again.done.length === 1 && !again.done[0].hidden, "after a reload the same line and the logged set return", again);
  }

  console.log("Rest running: the logged set stays in view above the rest tab");
  {
    const { page, target } = tall;
    await logSet(page, target.slotId, 2, { load: 60, reps: 8, rir: 1 }, { stopRest: false });
    const now = await card(page);
    ok(now.tab && now.done.every((row) => !row.hidden && row.inView) && now.open?.inView, "with the rest running, both logged sets and the open set show above the tab", now);
    ok(now.evidenceText.startsWith(await t(page, "focus.evidence.session", { set: 2, load: "60 × 8", rir: "1" })),
      "the rest does not suppress the line for the target just created", now.evidenceText);
  }

  console.log("Fit: a shorter window folds the oldest rows, a few pixels do not, the disclosure counts them");
  {
    const { page } = tall;
    const roomy = await card(page);
    await page.setViewportSize({ width: 390, height: 600 });
    await page.waitForFunction(() => document.querySelector("#workout .exercise.is-current .ledger__more")?.hidden === false, undefined, { timeout: 5000 });
    await settle(page);
    const short = await card(page);
    const folded = short.done.filter((row) => row.hidden).length;
    ok(folded > 0 && short.done.slice(0, folded).every((row) => row.hidden) && short.open?.inView,
      "a keyboard-sized loss of height folds the oldest logged rows, without a render, and keeps the open set", short);
    ok(short.more.text === `${folded} ${await page.evaluate((n) => window.RepForgeI18n.tp(n, "earlier set"), folded)}` && short.more.expanded === "false",
      "the disclosure counts exactly the rows it folds", short.more);
    await page.setViewportSize({ width: 390, height: 608 });
    await settle(page, 400);
    ok((await card(page)).done.filter((row) => row.hidden).length === folded, "eight pixels back do not refold the table", await card(page));
    await page.locator("#workout .exercise.is-current [data-ledgermore]").click();
    await page.waitForFunction(() => document.querySelector("#workout .exercise.is-current [data-ledgermore]")?.getAttribute("aria-expanded") === "true");
    await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))));
    ok((await card(page)).done.every((row) => !row.hidden), "opening the disclosure shows every logged row", await card(page));
    await page.locator("#workout .exercise.is-current [data-ledgermore]").click();
    await page.waitForFunction(() => document.querySelector("#workout .exercise.is-current [data-ledgermore]")?.getAttribute("aria-expanded") === "false");
    await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))));
    await settle(page);
    ok((await card(page)).done.filter((row) => row.hidden).length === folded, "closing it folds the same rows again", await card(page));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector("#workout .exercise.is-current .ledger__more")?.hidden === true, undefined, { timeout: 5000 });
    const back = await card(page);
    ok(back.done.every((row) => !row.hidden && row.inView) && roomy.done.length === back.done.length, "the full height brings every logged row back", back);
    ok(!tall.errors.length, "no page errors on the tall phone", tall.errors);
  }
  await tall.context.close();

  console.log("Verdicts: hold, up and down each come from what was logged, and the line follows");
  {
    const seen = new Set();
    for (const logged of [{ load: 60, reps: 8, rir: 2 }, { load: 60, reps: 12, rir: 4 }, { load: 60, reps: 4, rir: 0 }]) {
      const run = await open(browser);
      await logSet(run.page, run.target.slotId, 1, logged);
      const engine = await engineSet(run.page, run.target.rowId, 2);
      const now = await card(run.page);
      const verdict = now.marks[0];
      seen.add(verdict);
      ok(now.evidenceText === await expectedEvidence(run.page, 1, logged, engine),
        `${logged.load} × ${logged.reps} at RIR ${logged.rir} draws ${verdict}, and its line names set 1 and the target`, { now: now.evidenceText, engine });
      ok(verdict === (engine.load > logged.load ? "up" : engine.load < logged.load ? "down" : "hold"), "the mark is the engine's move from set 1", { verdict, engine });
      await run.context.close();
    }
    ok(seen.has("hold") && seen.has("up") && seen.has("down"), "the three logged sets produce hold, up and down", [...seen]);
  }

  console.log("Short phone with many logged sets, 200% text, Portuguese");
  {
    const run = await open(browser, { width: 320, height: 568, lang: "pt", text: "text200" });
    const { page, target } = run;
    for (let n = 1; n < target.sets; n++) await logSet(page, target.slotId, n, { load: 60, reps: 8, rir: 1 });
    const engine = await engineSet(page, target.rowId, target.sets);
    const now = await card(page);
    const folded = now.done.filter((row) => row.hidden).length;
    ok(await page.evaluate(() => window.RepForgeI18n.getLang()) === "pt", "the run reads in Portuguese");
    ok(now.evidenceText === await expectedEvidence(page, target.sets - 1, { load: 60, reps: 8, rir: 1 }, engine), "the Portuguese line comes from the Portuguese catalog", now.evidenceText);
    ok(now.l1Size <= 35.2 && !now.spills, "the hero stays at the large-text cap and nothing spills sideways", now);
    ok(folded > 0 && now.open?.inView && now.more?.hidden === false, "the logged rows that do not fit fold, and the open set stays whole", now);
    ok(now.more.text === `${folded} ${await page.evaluate((n) => window.RepForgeI18n.tp(n, "earlier set"), folded)}`, "the Portuguese disclosure counts what it folds", now.more);
    ok(!run.errors.length, "no page errors on the short phone", run.errors);
    await run.context.close();
  }
} finally {
  await browser.close();
}
console.log(`focus hero: ${checks} checks pass`);
