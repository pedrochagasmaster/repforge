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
 * 7. Layout D (owner decision of 2026-10-17), at 390×844 and on an SE-class 375×667, with no guide on screen:
 *    the exercise's name is the header and follows the lifter between exercises, the exercise row keeps only its
 *    meta line, the position still reaches assistive tech, the shelf is at 56 px fields, 48 px pads and a 52 px
 *    action, the context window is at least the proposal's D numbers, and set 1's open row is whole at 375×667.
 * 8. Layout D's set table (owner decision Q4(a), 2026-10-17): the open set and the one after it, under a disclosure
 *    that counts the logged sets. Expanded, every logged row corrects as before; the table collapses again after the
 *    correction and when the lifter moves to another exercise.
 * 9. While a rest runs, its clock line is never scrolled out of the context window, with the skip bar above the deck
 *    (owner screenshot of 2026-10-18) or without it, at 390×700 and on an SE-class 375×667.
 */
import { launchChromium } from "./browser.mjs";
import { SAFE_AREA, openCatalogState } from "./fixtures/catalog-state.mjs";

/** The phones layout D is measured on, and the context window the proposal's D mock reached on each (±4 px). */
const D_PHONES = {
  "390x844": { width: 390, height: 844, safe: SAFE_AREA },
  "375x667": { width: 375, height: 667, safe: { top: 20, bottom: 0 } },
};
const D_WINDOW = {
  "workout/rest-running": { "390x844": 462, "375x667": 343 },
  "workout/focus-per-side": { "390x844": 450, "375x667": 323 },
};
import { exerciseAction, finishEarly, selectExercise } from "./fixtures/focus-workout.mjs";

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
      // Layout D keeps the logged set behind its disclosure; opened, the row reads back.
      await page.locator("#workout .exercise--focus.is-current [data-ledgermore]").click();
      await page.waitForSelector("#workout .exercise--focus.is-current [data-editn='1']", { timeout: 15000 });
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

  console.log("\n7. Layout D: the exercise takes the header, the shelf at 56/48/52, the window the mock reached");
  /** Close any guide on screen: the tips become modals (owner decision), so layout is measured without one. */
  const noGuide = async (page) => {
    await page.evaluate(() => document.querySelectorAll("[data-guide-dismiss]").forEach((button) => button.click()));
    await page.waitForFunction(() => ![...document.querySelectorAll(".guide-cue")].some((el) => el.getClientRects().length), undefined, { timeout: 5000 });
    await page.evaluate(() => { window.dispatchEvent(new Event("resize")); return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  };
  const dLayout = () => {
    const art = document.querySelector("#workout .exercise--focus.is-current");
    const context = art.querySelector(".fcard__context"), box = context.getBoundingClientRect();
    const open = context.querySelector(".ledgerline--open")?.getBoundingClientRect();
    const h = (el) => (el ? Math.round(el.getBoundingClientRect().height * 10) / 10 : null);
    return {
      window: Math.round(box.height),
      openRow: open ? { top: open.top, bottom: open.bottom, boxTop: box.top, boxBottom: box.bottom } : null,
      title: document.querySelector("#woDayTitle")?.textContent.trim(),
      next: art.querySelector(".fx-next b")?.textContent.trim() || "",
      thumb: !!art.querySelector(".fx-head .exthumb, .fx-head .exthumb--empty, .fx-head [class*='thumb']"),
      rowName: !!art.querySelector(".fx-head .focus-ex__name"),
      meta: art.querySelector(".fx-head .focus-ex__meta")?.textContent.trim() || "",
      fields: [...art.querySelectorAll(".focus-shelf .shelf__fieldbtn")].map(h),
      pads: [...art.querySelectorAll(".focus-shelf .shelf__pads .shelf__pad, .focus-shelf .shelf__pads .restpad")].map(h),
      cta: h(art.querySelector(".focus-shelf .btn--cta.saveset")),
      values: [...art.querySelectorAll(".focus-shelf .shelf__val")].map((el) => {
        const s = getComputedStyle(el);
        return { text: el.textContent.trim(), lines: Math.round(el.getBoundingClientRect().height / parseFloat(s.lineHeight)) };
      }),
    };
  };
  const NAMES = { "workout/rest-running": "Barbell back squat", "workout/focus-per-side": "Dumbbell bench press" };
  for (const key of Object.keys(D_WINDOW)) for (const [phone, spec] of Object.entries(D_PHONES)) {
    const { context, page } = await openCatalogState(browser, key, spec.width, "en", "normal", { height: spec.height, safe: spec.safe });
    try {
      await noGuide(page);
      const d = await page.evaluate(dLayout);
      const label = `${key} ${phone}`;
      check(d.window >= D_WINDOW[key][phone] - 4, `${label}: the context window is at least the D mock's ${D_WINDOW[key][phone]} px`, d);
      check(d.title === NAMES[key], `${label}: the header names the exercise`, d.title);
      check(!d.thumb && !d.rowName && /reps/.test(d.meta), `${label}: the exercise row keeps only its meta line`, d);
      // A per-side label wraps to two lines, so its fields grow past 56 px together; the others are exactly 56 px.
      check(d.fields.length === 3 && (key === "workout/focus-per-side" ? d.fields.every((f) => f >= 55.5 && near(f, d.fields[0])) : d.fields.every((f) => near(f, 56))),
        `${label}: the shelf's fields are 56 px`, d.fields);
      check(d.pads.length >= 2 && d.pads.every((p) => near(p, 48)), `${label}: the shelf's pads are 48 px`, d.pads);
      check(near(d.cta, 52), `${label}: the shelf's action is 52 px`, d.cta);
      check(d.values.length === 3 && d.values.every((v) => v.lines === 1), `${label}: every field's value stays on one line`, d.values);
      if (key === "workout/focus-per-side") {
        check(d.openRow && d.openRow.top >= d.openRow.boxTop - 0.5 && d.openRow.bottom <= d.openRow.boxBottom + 0.5,
          `${label}: set 1's open row is whole in the window`, d.openRow);
      }
      if (key === "workout/rest-running" && phone === "390x844") {
        const position = await page.locator("#woProgress").ariaSnapshot();
        check(/Exercise 1 of \d+/.test(position), "the position is in the accessibility tree as \"Exercise N of M\"", position);
        check(await page.locator("#woProgress").getAttribute("aria-live") === "polite", "the position is announced when it changes", null);
        await page.locator("#workout .exercise--focus.is-current [data-fnextrow]").click();
        await page.waitForFunction((name) => document.querySelector("#woDayTitle")?.textContent.trim() === name, d.next, { timeout: 15000 }).catch(() => {});
        const after = await page.evaluate(() => ({ title: document.querySelector("#woDayTitle")?.textContent.trim(),
          position: document.querySelector("#woProgress .visually-hidden")?.textContent.trim() }));
        check(d.next && after.title === d.next, "advancing to the next exercise puts its name in the header", { next: d.next, ...after });
        check(/Exercise 2 of \d+/.test(after.position || ""), "and the announced position follows it", after);
        await page.locator("#woProgress button[data-focusgo='0']").click();
        await page.waitForFunction((name) => document.querySelector("#woDayTitle")?.textContent.trim() === name, NAMES[key], { timeout: 15000 }).catch(() => {});
        check(await page.evaluate(() => document.querySelector("#woDayTitle")?.textContent.trim()) === NAMES[key],
          "going back through the segment bar restores the first exercise's name", null);
        const route = await page.evaluate(() => document.querySelector("#woDayTitle button")?.getAttribute("aria-label") ?? null);
        check(route === `Open ${NAMES[key]} stats and history`, "the header's name keeps the route to the exercise's stats and history", route);
      }
    } finally { await context.close(); }
  }

  console.log("\n7b. A long name beside the overrun rest pill takes two lines at most (390×844)");
  for (const key of ["workout/rest-running", "workout/rest-done"]) {
    const { context, page } = await openCatalogState(browser, key, 390, "en", "normal");
    try {
      await noGuide(page);
      const before = await page.evaluate(() => document.querySelector("#workoutShell .wo-head").getBoundingClientRect().height);
      // The catalog's names are short; the longest real names (a unilateral, paused variation) are set into the live button.
      const LONG = "Single-arm dumbbell Romanian deadlift with a two-second pause at the knee";
      const m = await page.evaluate((long) => {
        const title = document.querySelector("#woDayTitle"), name = title.querySelector(".wo-head__name");
        const pill = document.querySelector("#woRest");
        name.textContent = long;
        const s = getComputedStyle(name);
        return { lines: Math.round((name.getBoundingClientRect().height - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom)) / parseFloat(s.lineHeight)),
          pill: pill && !pill.classList.contains("hidden") ? pill.textContent.trim() : null, pillWidth: pill?.getBoundingClientRect().width || 0,
          head: document.querySelector("#workoutShell .wo-head").getBoundingClientRect().height };
      }, LONG);
      check(m.pill && m.pillWidth > 60, `${key}: the rest pill is showing (the case under test)`, m);
      check(m.lines === 2, `${key}: the long name is clamped to two lines beside it`, m);
      check(m.head <= Math.max(before, 63) + 0.5, `${key}: the header row keeps its height`, { before, ...m });
    } finally { await context.close(); }
  }

  console.log("\n8. Layout D: the open set and the next, with the logged sets behind a disclosure");
  const table = () => {
    const art = document.querySelector("#workout .exercise--focus.is-current");
    const context = art.querySelector(".fcard__context"), box = context.getBoundingClientRect();
    const more = art.querySelector(".fcard__ledger [data-ledgermore]");
    const rows = [...art.querySelectorAll(".fcard__ledger .ledgerline:not(.ledgerline__head)")];
    const open = art.querySelector(".fcard__ledger .ledgerline--open")?.getBoundingClientRect();
    return {
      rows: rows.map((row) => row.dataset.lrow || `done ${row.dataset.editn}`),
      more: more && { text: more.textContent.trim(), expanded: more.getAttribute("aria-expanded"), controls: more.getAttribute("aria-controls"),
        controlsLedger: !!more.getAttribute("aria-controls") && !!document.getElementById(more.getAttribute("aria-controls"))?.closest(".fcard__ledger") },
      openWhole: !!open && open.top >= box.top - 0.5 && open.bottom <= box.bottom + 0.5,
      cta: art.querySelector(".focus-shelf .saveset")?.textContent.trim(),
    };
  };
  const tableSettles = (page, predicate, arg) => page.waitForFunction(predicate, arg, { timeout: 15000 }).catch(() => {});
  {
    const { context, page } = await openCatalogState(browser, "workout/rest-running", 390, "en", "normal");
    try {
      await noGuide(page);
      const exId = await page.evaluate(() => document.querySelector("#workout .exercise--focus.is-current").dataset.ex);
      const collapsed = await page.evaluate(table);
      check(JSON.stringify(collapsed.rows) === JSON.stringify(["2", "3"]), "set 2 of 3: the table shows the open set and the next one only", collapsed);
      check(collapsed.more?.text === "1 set logged" && collapsed.more.expanded === "false" && collapsed.more.controlsLedger,
        "a collapsed disclosure above them counts the logged set and controls the table", collapsed.more);
      const named = page.locator("#workout .exercise--focus.is-current").getByRole("button", { name: "1 set logged", exact: true });
      check(await named.count() === 1 && await named.getAttribute("aria-expanded") === "false", "assistive tech reads it as \"1 set logged\", collapsed", null);
      await named.click();
      await tableSettles(page, () => document.querySelectorAll("#workout .exercise--focus.is-current .fcard__ledger .ledgerline:not(.ledgerline__head)").length === 3);
      const expanded = await page.evaluate(table);
      check(JSON.stringify(expanded.rows) === JSON.stringify(["done 1", "2", "3"]) && expanded.more?.expanded === "true",
        "expanded, the table holds every set again, the logged one first", expanded);
      check(await page.evaluate(() => document.activeElement?.matches("[data-ledgermore]")), "the disclosure keeps focus when it opens", null);

      await page.locator("#workout .exercise--focus.is-current [data-editn='1']").click();
      await tableSettles(page, () => /Save set 1/.test(document.querySelector("#workout .exercise--focus.is-current .focus-shelf .saveset")?.textContent || ""));
      const editing = await page.evaluate(table);
      check(/Save set 1/.test(editing.cta || "") && editing.more?.expanded === "true" && editing.rows.includes("1"),
        "correcting set 1 keeps the table expanded with set 1 open in place", editing);
      // The correction nudges the selected field up one step with its pad.
      const field = await page.evaluate(() => {
        const sel = document.querySelector("#workout .exercise--focus.is-current .focus-shelf .shelf__field.is-sel");
        return sel?.dataset.field === "metric" ? `metric:${sel.dataset.metric}` : sel?.dataset.field;
      });
      const valueOf = ({ id, field }) => {
        const ex = window.__repforgeWorkoutDraft.current().exercises[id];
        const set = ex.sets[ex.setOrder.find((sid) => ex.sets[sid].ordinal === 1)];
        const value = field.startsWith("metric:") ? set.edited.metrics?.[field.slice(7)] : set.edited[field];
        return { value: Number(value), completion: set.completion };
      };
      const before = (await page.evaluate(valueOf, { id: exId, field })).value;
      await page.locator("#workout .exercise--focus.is-current .focus-shelf .shelf__pad[data-dir='1']").click();
      await page.locator("#workout .exercise--focus.is-current .focus-shelf .saveset").click();
      await tableSettles(page, () => document.querySelector("#workout .exercise--focus.is-current [data-ledgermore]")?.getAttribute("aria-expanded") === "false");
      await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
      const after = await page.evaluate(valueOf, { id: exId, field });
      check(Number.isFinite(before) && after.value > before && after.completion !== "pending", "the correction is saved on set 1", { field, before, after });
      const saved = await page.evaluate(table);
      check(saved.more?.expanded === "false" && JSON.stringify(saved.rows) === JSON.stringify(["2", "3"]), "after the correction the table collapses again", saved);

      await page.locator("#workout .exercise--focus.is-current [data-ledgermore]").click();
      await tableSettles(page, () => document.querySelector("#workout .exercise--focus.is-current [data-editn='1']"));
      await page.locator("#workout .exercise--focus.is-current [data-editn='1']").click();
      await tableSettles(page, () => document.querySelector("#workout .exercise--focus.is-current [data-fcancel]"));
      await page.locator("#workout .exercise--focus.is-current [data-fcancel]").click();
      await tableSettles(page, () => document.querySelector("#workout .exercise--focus.is-current [data-ledgermore]")?.getAttribute("aria-expanded") === "false");
      check((await page.evaluate(table)).more?.expanded === "false", "a cancelled correction collapses it again too", await page.evaluate(table));

      await page.locator("#workout .exercise--focus.is-current [data-ledgermore]").click();
      await page.locator("#workout .exercise--focus.is-current [data-fnextrow]").click();
      await tableSettles(page, (id) => document.querySelector("#workout .exercise--focus.is-current")?.dataset.ex !== id, exId);
      await page.locator("#woProgress button[data-focusgo='0']").click();
      await tableSettles(page, (id) => document.querySelector("#workout .exercise--focus.is-current")?.dataset.ex === id, exId);
      const back = await page.evaluate(table);
      check(back.more?.expanded === "false" && back.rows.length === 2, "moving to another exercise and back finds the table collapsed", back);

      await page.locator("#workout .exercise--focus.is-current .focus-shelf .saveset").click();
      await tableSettles(page, () => document.querySelector("#workout .exercise--focus.is-current .ledgerline--open")?.dataset.lrow === "3");
      const last = await page.evaluate(table);
      check(JSON.stringify(last.rows) === JSON.stringify(["3"]) && last.more?.text === "2 sets logged", "on the last set the table shows the open set alone", last);
    } finally { await context.close(); }
  }
  for (const [lang, phone, label] of [["pt", "390x844", "1 série registrada"], ["en", "375x667", "1 set logged"]]) {
    const spec = D_PHONES[phone];
    const { context, page } = await openCatalogState(browser, "workout/rest-running", spec.width, lang, "normal", { height: spec.height, safe: spec.safe });
    try {
      await noGuide(page);
      const t = await page.evaluate(table);
      check(t.more?.text === label, `${lang} ${phone}: the disclosure reads "${label}"`, t.more);
      if (phone === "375x667") check(t.openWhole, "375×667, collapsed: the open row is whole in the window", t);
    } finally { await context.close(); }
  }
  {
    const { context, page } = await openCatalogState(browser, "workout/focus-per-side", 390, "en", "normal");
    try {
      const first = await page.evaluate(table);
      check(!first.more && JSON.stringify(first.rows) === JSON.stringify(["1", "2"]), "before any set is logged there is no disclosure, only the open set and the next", first);
    } finally { await context.close(); }
  }

  console.log("\n9. A running rest's clock stays in the window, with or without the skip bar");
  for (const [phone, spec, skip] of [["390x700", { width: 390, height: 700, safe: SAFE_AREA }, true], ["390x700", { width: 390, height: 700, safe: SAFE_AREA }, false],
    ["375x667", D_PHONES["375x667"], true], ["375x667", D_PHONES["375x667"], false]]) {
    const { context, page } = await openCatalogState(browser, "workout/rest-running", spec.width, "en", "normal", { height: spec.height, safe: spec.safe });
    try {
      await noGuide(page);
      const first = await page.evaluate(() => document.querySelector("#workout .exercise--focus.is-current").dataset.ex);
      if (skip) {
        // Skip another exercise and come back: the skip bar takes its row above the deck.
        const other = await page.evaluate((id) => window.__repforgeFocus.list().find((e) => e.id !== id)?.id, first);
        await exerciseAction(page, other, "#exActionSkipBtn");
        await selectExercise(page, first);
        await page.waitForFunction((id) => document.querySelector("#workout .exercise--focus.is-current")?.dataset.ex === id
          && document.querySelector("#workout .skipbar"), first, { timeout: 15000 });
      }
      await page.waitForFunction(() => document.querySelector("#workout .exercise--focus.is-current .fx-slot")?.dataset.rest === "running"
        && !document.querySelector("#workout .motion-fade-out") && !document.querySelector("#workout .fx-slot").style.height, undefined, { timeout: 15000 });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const m = await page.evaluate(() => {
        const art = document.querySelector("#workout .exercise--focus.is-current");
        const context = art.querySelector(".fcard__context"), box = context.getBoundingClientRect();
        const clock = art.querySelector(".fx-slot .restinline__row") || art.querySelector(".fx-slot");
        const c = clock.getBoundingClientRect();
        return { skipbar: !!document.querySelector("#workout .skipbar"), top: box.top, bottom: box.bottom, scrollTop: context.scrollTop,
          clockTop: c.top, clockBottom: c.bottom, open: art.querySelector(".ledgerline--open")?.dataset.lrow };
      });
      check(m.skipbar === skip && m.open === "2", `${phone}${skip ? ", skip bar showing" : ""}: set 2 is open while the rest runs (the case under test)`, m);
      check(m.clockTop >= m.top - 0.5 && m.clockBottom <= m.bottom + 0.5, `${phone}${skip ? ", skip bar showing" : ""}: the rest's clock line is whole in the window`, m);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
