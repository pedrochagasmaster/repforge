#!/usr/bin/env node
/**
 * The Focus screen's space and the session summary's action bar, on the owner's phone (2026-10-17), at 390×844 with
 * the shipped safe areas:
 *
 * 1. The shelf reaches the bottom edge, through the home-indicator inset, and pays only that inset plus its own
 *    spacing token under the action. With the keyboard up the band above the keyboard is the screen, and the inset
 *    the keyboard covers is not paid again.
 * 2. Nothing in the context region is left cut under the exercise progress segments after the card scrolls the set
 *    being worked on into view.
 * 3. The shelf's fields read in the order the set table's columns do (load, reps, effort) for every composition.
 * 4. A field label names its unit once.
 * 5. A short summary holds its action bar at the bottom of the screen; a long one keeps it pinned there.
 * 6. The RIR a metric-backed set shows when it is logged is the RIR the session saves.
 */
import { launchChromium } from "./browser.mjs";
import { SAFE_AREA, openCatalogState } from "./fixtures/catalog-state.mjs";
import { finishEarly } from "./fixtures/focus-workout.mjs";

const failures = [];
let passed = 0;
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 2500)}`);
}
const near = (a, b, tolerance = 1) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;

/** The live shelf's box, its action's and the spacing token it promises under the action. */
function shelfGeometry() {
  const art = document.querySelector("#workout .exercise--focus.is-current");
  const shelf = art?.querySelector(".focus-shelf"), cta = art?.querySelector(".focus-shelf .btn--cta");
  if (!shelf || !cta) return { error: "no live shelf" };
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;height:var(--space-16)";
  document.body.append(probe);
  const token = probe.getBoundingClientRect().height;
  probe.remove();
  const box = shelf.getBoundingClientRect(), action = cta.getBoundingClientRect();
  return { height: innerHeight, shelfBottom: box.bottom, under: box.bottom - action.bottom, token };
}

/** Leaf boxes of the context region that its top edge cuts through, and the segments' bottom. */
function contextCuts() {
  const context = document.querySelector("#workout .exercise--focus.is-current .fcard__context");
  const bar = document.querySelector("#woProgress");
  if (!context || !bar) return { error: "no context region or segment bar" };
  const top = context.getBoundingClientRect().top, cuts = [];
  for (const el of context.querySelectorAll("*")) {
    if (el.children.length) continue;
    const box = el.getBoundingClientRect();
    if (box.height < 1 || box.width < 1) continue;
    if (box.top < top - 0.5 && box.bottom > top + 0.5) cuts.push(`${el.className || el.tagName} "${el.textContent.trim().slice(0, 24)}"`);
  }
  return { top, barBottom: bar.getBoundingClientRect().bottom, scrollTop: context.scrollTop, cuts };
}

/** The shelf's fields in order, each with the table column its value fills. */
function shelfFields() {
  const art = document.querySelector("#workout .exercise--focus.is-current");
  return [...art.querySelectorAll(".focus-shelf .shelf__field")].map((field) => ({
    label: field.querySelector(".shelf__fieldbtn .shelf__lab")?.textContent.trim() || "",
    kind: field.dataset.field,
    metric: field.dataset.metric || null,
  }));
}

async function shelfColumns(page) {
  return page.evaluate(() => {
    const art = document.querySelector("#workout .exercise--focus.is-current");
    const key = art.dataset.ex;
    const definitions = window.__repforgeWorkoutDraft.current()?.exercises?.[key]?.sets;
    const set = definitions && Object.values(definitions).find((item) => item.completion === "pending");
    const semantics = Object.fromEntries((set?.programmed?.metrics || []).map((metric) => [metric.id, metric.semantic]));
    const column = (field) => {
      if (field.dataset.field !== "metric") return field.dataset.field;
      const semantic = semantics[field.dataset.metric] || "";
      return /load|assistance/i.test(semantic) ? "load" : /reps/i.test(semantic) ? "reps" : semantic;
    };
    return [...art.querySelectorAll(".focus-shelf .shelf__field")].map(column);
  });
}

const browser = await launchChromium();
try {
  console.log("\n1. The shelf reaches the bottom edge (390×844, safe area bottom 34)");
  for (const key of ["workout/focus", "workout/focus-per-side", "workout/rest-running"]) {
    const { context, page } = await openCatalogState(browser, key, 390, "en", "normal");
    try {
      const g = await page.evaluate(shelfGeometry);
      check(near(g.shelfBottom, g.height), `${key}: the shelf's bottom edge is the screen's`, g);
      check(near(g.under, SAFE_AREA.bottom + g.token), `${key}: under the action is the inset plus the spacing token, nothing more`, g);
      if (key === "workout/focus") {
        const up = await page.evaluate(() => {
          document.documentElement.style.setProperty("--vvh", "480px");
          document.documentElement.dataset.keyboard = "up";
          return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }).then(() => page.evaluate(shelfGeometry));
        check(near(up.shelfBottom, 480), "keyboard up: the shelf sits on the band the keyboard leaves", up);
        check(near(up.under, up.token), "keyboard up: the covered inset is not paid under the action", up);
      }
    } finally { await context.close(); }
  }

  console.log("\n2. Nothing is left cut under the segment bar after the card scrolls");
  {
    const { context, page } = await openCatalogState(browser, "workout/rest-running", 390, "en", "normal");
    try {
      const before = await page.evaluate(contextCuts);
      check(before.top >= before.barBottom - 0.5 && !before.cuts.length, "rest running: the context opens whole under the segments", before);
      await page.locator("#workout .exercise--focus.is-current .saveset").click();
      await page.locator("#workout .exercise.is-current [data-rest-act='skip']").click();
      await page.waitForFunction(() => {
        const row = document.querySelector("#workout .exercise--focus.is-current .ledgerline--open");
        return row && +row.dataset.lrow === 3 && document.querySelector("#workout .exercise.is-current .fx-slot")?.dataset.rest === "done";
      }, undefined, { timeout: 15000 });
      // The rest's slot trades its content and height after the render; the window settles once that is done.
      await page.waitForFunction(() => {
        const context = document.querySelector("#workout .exercise--focus.is-current .fcard__context");
        const top = context.getBoundingClientRect().top;
        return context.scrollTop > 0 && ![...context.querySelectorAll("*")].some((el) => {
          const box = el.getBoundingClientRect();
          return !el.children.length && box.height >= 1 && box.width >= 1 && box.top < top - 0.5 && box.bottom > top + 0.5;
        });
      }, undefined, { timeout: 5000 }).catch(() => {});
      const after = await page.evaluate(contextCuts);
      check(after.scrollTop > 0, "the third set's row needs the card to scroll (the case under test)", after);
      check(after.top >= after.barBottom - 0.5 && !after.cuts.length, "after scrolling to the third set nothing is cut under the segments", after);
    } finally { await context.close(); }
  }

  console.log("\n3–4. Shelf field order and labels");
  const expected = {
    en: { "workout/focus": ["Load, kg", "Reps", "RIR"], "workout/focus-per-side": ["Load per side, kg", "Reps per side", "RIR"] },
    pt: { "workout/focus": ["Carga, kg", "Reps", "RIR"], "workout/focus-per-side": ["Carga por lado, kg", "Reps por lado", "RIR"] },
  };
  for (const lang of ["en", "pt"]) for (const key of ["workout/focus", "workout/focus-per-side"]) {
    const { context, page } = await openCatalogState(browser, key, 390, lang, "normal");
    try {
      const fields = await page.evaluate(shelfFields);
      const columns = await shelfColumns(page);
      check(JSON.stringify(columns) === JSON.stringify(["load", "reps", "rir"]), `${lang} ${key}: the shelf reads load, reps, RIR like the table`, { columns, fields });
      const labels = fields.map((field) => field.label);
      check(JSON.stringify(labels) === JSON.stringify(expected[lang][key]), `${lang} ${key}: each label names its unit once`, labels);
    } finally { await context.close(); }
  }

  console.log("\n5–6. A metric-backed set's shown RIR is saved; a short summary keeps its bar at the bottom");
  {
    const { context, page } = await openCatalogState(browser, "workout/focus-per-side", 390, "en", "normal");
    try {
      const shown = await page.evaluate(() => document.querySelector("#workout .exercise--focus.is-current .focus-shelf .shelf__field[data-field='rir'] .shelf__val")?.textContent.trim());
      const exId = await page.evaluate(() => document.querySelector("#workout .exercise--focus.is-current").dataset.ex);
      await page.locator("#workout .exercise--focus.is-current .saveset").click();
      await page.waitForFunction((id) => document.querySelector("#workout .exercise--focus.is-current .ledgerline--open")?.dataset.lrow === "2"
        && document.querySelector("#workout .exercise--focus.is-current")?.dataset.ex === id, exId, { timeout: 15000 });
      const ledger = await page.evaluate(() => document.querySelector("#workout .exercise--focus.is-current [data-editn='1'] [data-lv='rir']")?.textContent.trim());
      check(shown && ledger === shown, "the logged row reads the RIR the shelf showed", { shown, ledger });
      await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
      await finishEarly(page);
      await page.waitForSelector("#sessionSummary:not(.hidden)", { timeout: 15000 });
      await page.evaluate(() => window.__repforgeStorage.flush());
      const saved = await page.evaluate((id) => JSON.parse(localStorage.getItem("repforge_v1")).log
        .filter((row) => row.exerciseId === id).map((row) => ({ session: row.session, set: row.set, rir: row.rir })), exId);
      const latest = saved.at(-1);
      check(latest && latest.rir === Number(shown), "the session saves the RIR the shelf showed", { shown, saved });
      const outcome = await page.evaluate(() => [...document.querySelectorAll("#sessionSummary .sum-grp .sum-grp__h")].map((h) => h.textContent.replace(/\s+/g, " ").trim()));
      check(outcome.length && outcome.every((line) => !/No RIR/.test(line)), "the summary does not report the logged set as missing its RIR", outcome);

      const bar = await page.evaluate(() => {
        const sheet = document.querySelector("#sessionSummary"), actions = sheet.querySelector(".sum-actions"), done = sheet.querySelector("#sumDone");
        return { height: innerHeight, short: sheet.scrollHeight <= sheet.clientHeight + 1, bar: actions.getBoundingClientRect().bottom,
          done: done.getBoundingClientRect().bottom, pad: parseFloat(getComputedStyle(actions).paddingBottom) };
      });
      check(bar.short, "one lift, one set: the summary is short enough to need no scroll (the case under test)", bar);
      check(near(bar.bar, bar.height) && near(bar.done, bar.height - bar.pad), "a short summary holds its action bar at the bottom of the screen", bar);
    } finally { await context.close(); }
  }
  {
    const { context, page } = await openCatalogState(browser, "session/summary", 390, "en", "normal");
    try {
      const bar = await page.evaluate(() => {
        const sheet = document.querySelector("#sessionSummary"), actions = sheet.querySelector(".sum-actions");
        return { height: innerHeight, long: sheet.scrollHeight > sheet.clientHeight + 1, bar: actions.getBoundingClientRect().bottom };
      });
      check(bar.long && near(bar.bar, bar.height), "a long summary keeps its action bar pinned to the bottom", bar);
      const end = await page.evaluate(() => {
        const sheet = document.querySelector("#sessionSummary");
        sheet.scrollTop = sheet.scrollHeight;
        return new Promise((resolve) => requestAnimationFrame(() => resolve({ height: innerHeight,
          bar: sheet.querySelector(".sum-actions").getBoundingClientRect().bottom })));
      });
      check(near(end.bar, end.height), "scrolled to its end, the long summary's bar still meets the bottom edge", end);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
