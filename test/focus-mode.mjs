#!/usr/bin/env node
/**
 * Focus-mode state machine checks.
 *
 * One pass per state the definitive mockups document, driven through the real
 * UI: new exercise, returning exercise, mid-exercise logging in both RIR and
 * effort modes, folded history, editing a logged set, rest, the note sheet,
 * exercise completion, workout completion and swipe navigation — plus the
 * accessibility and viewport rules that hold across all of them.
 *
 * Run: node test/focus-mode.mjs
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";

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
  await page.waitForFunction(() => typeof window.closeOnboarding === "function", { timeout: 10000 });
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
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
    localStorage.removeItem(d);
  }, DRAFT);
  await persist(page, `s.settings = { ...(s.settings || {}), lang: ${JSON.stringify(lang)}, rirMode: ${JSON.stringify(rirMode)} };`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
}

async function reload(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
}

async function enterFocus(page, index = 0) {
  await page.evaluate((i) => {
    window.__repforgeEnterWorkout({ focus: true });
    window.__repforgeFocus.to(i);
  }, index);
  await page.waitForSelector("#workout.is-focus .exercise.is-current", { state: "attached", timeout: 5000 });
  await page.waitForTimeout(120);
}

async function setSetCount(page, i, sets) {
  await persist(page, `
    const ex = w.__repforgeFocus.list()[${i}];
    s.program = s.program.map((e) => (e.id === ex.id ? { ...e, sets: ${sets} } : e));`);
  await reload(page);
}

async function seedPrev(page, i, sets) {
  await persist(page, `
    const ex = w.__repforgeFocus.list()[${i}];
    const date = ${JSON.stringify(isoDaysAgo(7))};
    s.log = (s.log || []).concat(${JSON.stringify(sets)}.map((row, n) => ({
      session: date + "_" + ex.day + "_seed", date, day: ex.day, name: ex.name,
      exerciseId: ex.id, set: n + 1, load: row.load, reps: row.reps, rir: row.rir,
      notes: "", created: date + "T12:00:00.000Z", primary: ex.primary, secondary: ex.secondary,
    })));`);
  await reload(page);
}

/** Commit `n` sets on the focused exercise through the well, as a lifter would. */
async function logSets(page, n, { load = 100, reps = 4 } = {}) {
  let done = 0;
  for (let i = 0; i < n; i++) {
    const loadInput = page.locator(".focus-well .curset__val[data-k$='_load']");
    if (!(await loadInput.count())) break;
    await loadInput.first().fill(String(load));
    const repsInput = page.locator(".focus-well .curset__val[data-k$='_reps']");
    if (await repsInput.count()) await repsInput.first().fill(String(reps));
    await page.locator(".focus-well .saveset").first().click();
    await page.waitForTimeout(140);
    done++;
  }
  return done;
}

const cardState = (page) =>
  page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    if (!card) return null;
    const ledger = card.querySelector(".fcard__ledger");
    const well = card.querySelector(".focus-well");
    const cta = well?.querySelector(".btn--cta");
    const cardBox = card.getBoundingClientRect();
    return {
      setOf: card.querySelector(".focus-ex__setof")?.textContent?.trim() || "",
      cueLabel: card.querySelector(".focus-cue__lab")?.textContent?.trim() || "",
      cueText: card.querySelector(".focus-cue__text")?.textContent?.trim() || "",
      ledgerRows: card.querySelectorAll(".ledger__row[data-editn]").length,
      pastRows: card.querySelectorAll(".ledger__row.is-past").length,
      emptyRow: !!card.querySelector(".ledger__row.is-empty"),
      fold: card.querySelector(".ledger__more")?.textContent?.trim() || "",
      foldExpanded: card.querySelector(".ledger__more")?.getAttribute("aria-expanded") || "",
      count: card.querySelector(".ledger__count")?.textContent?.trim() || "",
      editing: card.querySelectorAll(".ledger__row.is-editing").length,
      cancel: !!card.querySelector("[data-fcancel]"),
      ctaText: cta?.textContent?.trim() || "",
      ctaArrow: cta ? !cta.classList.contains("btn--noarrow") : null,
      ctaHeight: cta ? Math.round(cta.getBoundingClientRect().height) : 0,
      doneTitle: card.querySelector(".focus-done__title")?.textContent?.trim() || "",
      doneSub: card.querySelector(".focus-done__sub")?.textContent?.trim() || "",
      wellTop: well ? Math.round(well.getBoundingClientRect().top) : 0,
      wellHeight: well ? well.offsetHeight : 0,
      spill: card.scrollHeight - card.clientHeight,
      ledgerScrolls: ledger ? ledger.scrollHeight > ledger.clientHeight + 1 : false,
      ledgerBottom: ledger ? Math.round(ledger.getBoundingClientRect().bottom) : 0,
      lastRowBottom: (() => {
        const rows = card.querySelectorAll(".ledger__row[data-editn]");
        const last = rows[rows.length - 1];
        return last ? Math.round(last.getBoundingClientRect().bottom) : 0;
      })(),
      cardBottom: Math.round(cardBox.bottom),
      pageScrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

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
  await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false }));
  await page.waitForSelector("#workout .exercise .ex__tag", { timeout: 5000 });
  const listGap = await page.evaluate(() => {
    const tag = document.querySelector("#workout .exercise .ex__tag");
    const target = tag?.nextElementSibling;
    if (!tag || !target) return null;
    return Math.round(target.getBoundingClientRect().left - tag.getBoundingClientRect().right);
  });
  assert(listGap != null && listGap >= 8,
    "list mode leaves space between the muscle group and the set target", String(listGap));
  await enterFocus(page, 0);
  let st = await cardState(page);
  assert(st.emptyRow && st.ledgerRows === 0 && st.pastRows === 0,
    "an exercise with no history shows an empty ledger row", JSON.stringify(st));
  assert(/start/i.test(st.cueLabel) && /load/i.test(st.cueText),
    "the cue asks for a load to start with", JSON.stringify(st));
  assert(st.ctaText.toLowerCase() === "log set" && st.ctaArrow === false,
    "the commit action is arrowless", JSON.stringify(st));
  assert(st.spill <= 1 && !st.pageScrollsX,
    "the card fits its own box and the page does not scroll sideways", JSON.stringify(st));

  // ---- 02 — returning exercise ----------------------------------------------
  phase("State 02: returning exercise with previous-session context");
  await seedPrev(page, 1, [
    { load: 100, reps: 10, rir: 2 },
    { load: 100, reps: 10, rir: 2 },
    { load: 100, reps: 9, rir: 2 },
    { load: 100, reps: 9, rir: 2 },
  ]);
  await enterFocus(page, 1);
  st = await cardState(page);
  assert(st.pastRows === 4 && st.ledgerRows === 0,
    "last session's four sets lead the ledger", JSON.stringify(st));
  assert(/now/i.test(st.cueLabel) && /\d/.test(st.cueText),
    "the cue names the load to work at", JSON.stringify(st));
  const ledgerTopLabel = await page.evaluate(
    () => document.querySelector(".ledger__lab")?.textContent?.trim() || ""
  );
  assert(/last session/i.test(ledgerTopLabel),
    "the previous session is labelled as such", ledgerTopLabel);
  const pastLayout = await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    const n = card.querySelector(".ledger__row.is-past .ledger__n");
    const load = card.querySelector(".ledger__row.is-past .ledger__load");
    const lab = card.querySelector(".curset__cell.is-load .curset__cell-lab");
    const cardBox = card.getBoundingClientRect();
    const nBox = n.getBoundingClientRect();
    const loadBox = load.getBoundingClientRect();
    const cols = getComputedStyle(card.querySelector(".ledger__row.is-past")).gridTemplateColumns.split(" ").filter(Boolean);
    return {
      inset: Math.round(nBox.left - cardBox.left),
      loadLab: lab?.textContent?.replace(/\s+/g, " ").trim() || "",
      unitInValue: !!card.querySelector(".curset__unit"),
      pastLoad: load?.textContent?.trim() || "",
      headLoad: [...card.querySelectorAll(".ledger__head > span")].map((s) => s.textContent.replace(/\s+/g, " ").trim())[1] || "",
      pastCols: cols.length,
      loadFits: load ? load.scrollWidth <= load.clientWidth + 1 : false,
      loadWide: loadBox.width,
    };
  });
  assert(pastLayout.inset >= 18,
    "the set number sits in from the card edge", JSON.stringify(pastLayout));
  assert(/load/i.test(pastLayout.loadLab) && /kg|lb/i.test(pastLayout.loadLab),
    "the unit sits on the Load label", pastLayout.loadLab);
  assert(!pastLayout.unitInValue,
    "the load figure is not followed by a unit", JSON.stringify(pastLayout));
  assert(!/kg|lb/i.test(pastLayout.pastLoad),
    "previous-session load cells are the number only", pastLayout.pastLoad);
  assert(/load/i.test(pastLayout.headLoad) && /kg|lb/i.test(pastLayout.headLoad),
    "the ledger load header carries the unit", pastLayout.headLoad);
  assert(pastLayout.pastCols === 4 && pastLayout.loadFits,
    "previous-session columns use the card width without cropping load", JSON.stringify(pastLayout));

  // ---- 03 — mid-exercise with numeric RIR ------------------------------------
  phase("State 03: mid-exercise logging with numeric RIR");
  await boot(page);
  await setSetCount(page, 0, 5);
  await enterFocus(page, 0);
  const wellBefore = (await cardState(page)).wellHeight;
  await logSets(page, 2);
  st = await cardState(page);
  assert(st.ledgerRows === 2, "two logged sets show in the ledger", JSON.stringify(st));
  assert(/3/.test(st.setOf), "the set counter advances to set 3", st.setOf);
  assert(st.wellHeight === wellBefore,
    "the well keeps its height as sets accumulate", `${wellBefore} -> ${st.wellHeight}`);
  assert(st.lastRowBottom <= st.ledgerBottom + 1,
    "the newest row is fully in view", JSON.stringify(st));
  const loggedInset = await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    const n = card.querySelector(".ledger__row[data-editn] .ledger__n");
    if (!card || !n) return null;
    return Math.round(n.getBoundingClientRect().left - card.getBoundingClientRect().left);
  });
  assert(loggedInset != null && loggedInset >= 18,
    "logged set numbers also sit in from the card edge", String(loggedInset));
  const rirCell = await page.evaluate(
    () => !!document.querySelector('.focus-well [data-k$="_rir"]')
  );
  assert(rirCell, "the well's third column is a numeric RIR field", String(rirCell));

  // ---- 07 — rest lives in the workout chrome ---------------------------------
  phase("State 07: active rest timer in the workout chrome");
  // Logging a set arms rest on its own; the header chip is where it reads.
  const rest = await page.evaluate(() => {
    const chip = document.querySelector("#woRest");
    const card = document.querySelector("#workout .exercise.is-current");
    const cta = card.querySelector(".focus-well .btn--cta").getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();
    return {
      running: chip.classList.contains("is-running"),
      time: chip.querySelector(".wo-rest__time")?.textContent?.trim() || "",
      label: chip.getAttribute("aria-label") || "",
      coversCta: chipBox.bottom > cta.top && chipBox.top < cta.bottom,
      inCard: card.querySelectorAll("[data-rest]").length,
      floating: getComputedStyle(document.querySelector("#restBar")).display,
      tap: Math.round(Math.min(chipBox.width, chipBox.height)),
    };
  });
  assert(rest.running && /^\d+:\d\d$/.test(rest.time), "the chip counts down", JSON.stringify(rest));
  assert(!rest.coversCta && rest.inCard === 0 && rest.floating === "none",
    "rest never covers the card's controls and leaves the card alone", JSON.stringify(rest));
  assert(/\d+:\d\d/.test(rest.label) && rest.tap >= 44,
    "the chip is named and at least 44px", JSON.stringify(rest));
  await page.click("#woRest");
  await page.waitForTimeout(150);
  assert(await page.evaluate(() => !document.querySelector("#woRest").classList.contains("is-running")),
    "tapping the running chip stops rest");
  await page.click("#woRest");
  await page.waitForTimeout(200);
  assert(await page.evaluate(() => document.querySelector("#woRest").classList.contains("is-running")),
    "tapping the idle chip starts rest again");
  await page.click("#woRest");
  await page.waitForTimeout(150);

  // ---- 06 — editing a logged set --------------------------------------------
  phase("State 06: editing a previously logged set");
  await logSets(page, 1);
  const beforeEdit = await page.evaluate((d) => JSON.parse(localStorage.getItem(d) || "{}").__done.length, DRAFT);
  await page.locator(".ledger__row[data-editn]").nth(1).click();
  await page.waitForTimeout(200);
  st = await cardState(page);
  assert(st.editing === 1, "the edited row stays in place and is marked", JSON.stringify(st));
  assert(/editing/i.test(st.cueLabel) && /2/.test(st.cueText),
    "the well says which set is being edited", JSON.stringify(st));
  assert(st.cancel && /save changes/i.test(st.ctaText) && st.ctaArrow === false,
    "editing is reversible and commits without an arrow", JSON.stringify(st));
  assert(st.ledgerRows === 3, "no row disappears while it is being edited", JSON.stringify(st));
  await page.locator(".focus-well .curset__val[data-k$='_reps']").first().fill("9");
  await page.locator(".focus-well .saveset").click();
  await page.waitForTimeout(250);
  const afterEdit = await page.evaluate((d) => {
    const draft = JSON.parse(localStorage.getItem(d) || "{}");
    const rows = [...document.querySelectorAll(".ledger__row[data-editn]")].map((r) =>
      [...r.querySelectorAll("span")].map((s) => s.textContent.trim())
    );
    return { done: draft.__done.length, rows };
  }, DRAFT);
  assert(afterEdit.done === beforeEdit,
    "saving an edit updates the record instead of adding one",
    `${beforeEdit} -> ${afterEdit.done}`);
  assert(afterEdit.rows[1] && afterEdit.rows[1][2] === "9",
    "the edited value lands on the row it came from", JSON.stringify(afterEdit.rows));
  // …and cancelling puts the set back exactly as it was.
  await page.locator(".ledger__row[data-editn]").nth(1).click();
  await page.waitForTimeout(180);
  await page.locator(".focus-well .curset__val[data-k$='_reps']").first().fill("2");
  await page.locator("[data-fcancel]").click();
  await page.waitForTimeout(250);
  const afterCancel = await page.evaluate(() =>
    [...document.querySelectorAll(".ledger__row[data-editn]")].map((r) =>
      [...r.querySelectorAll("span")].map((s) => s.textContent.trim())
    )
  );
  assert(afterCancel[1] && afterCancel[1][2] === "9",
    "cancelling an edit restores the set it opened with", JSON.stringify(afterCancel));

  // ---- 08 — the note sheet ---------------------------------------------------
  phase("State 08: exercise-note editor");
  await page.locator("[data-exnote-open]").first().click();
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
  await page.fill("#exNoteText", "Seat 4, feet high.");
  await page.click("#exNoteSave");
  await page.waitForTimeout(250);
  const noteSaved = await page.evaluate((d) => ({
    draft: JSON.parse(localStorage.getItem(d) || "{}").__exnotes || {},
    marked: !!document.querySelector(".focus-tool.has-note"),
    closed: document.querySelector("#exNoteSheet").hidden,
  }), DRAFT);
  assert(Object.values(noteSaved.draft).includes("Seat 4, feet high.") && noteSaved.closed,
    "saving the sheet writes the note into the session draft", JSON.stringify(noteSaved));
  assert(noteSaved.marked, "the card's note tool shows the exercise now has one");
  await page.locator("[data-exnote-open]").first().click();
  await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  assert(await page.evaluate(() => document.querySelector("#exNoteSheet").hidden),
    "Escape closes the note sheet");

  // ---- 04 — effort mode -------------------------------------------------------
  phase("State 04: mid-exercise logging with Easy / Hard / Max");
  await boot(page, { rirMode: "effort" });
  await setSetCount(page, 0, 6);
  await enterFocus(page, 0);
  await logSets(page, 4, { load: 7.5, reps: 4 });
  st = await cardState(page);
  const effort = await page.evaluate(() => {
    const spin = document.querySelector(".focus-well [data-effspin]");
    const head = [...document.querySelectorAll("#workout .exercise.is-current .ledger__head > span")].map((s) => s.textContent.trim());
    const row = document.querySelector(".ledger__row[data-editn]");
    return {
      role: spin?.getAttribute("role"),
      label: spin?.getAttribute("aria-label") || "",
      valueText: spin?.getAttribute("aria-valuetext") || "",
      valueNow: spin?.getAttribute("aria-valuenow") || "",
      hint: document.querySelector(".focus-well .curset__hint")?.textContent?.trim() || "",
      head,
      rowEffort: row ? [...row.querySelectorAll("span")][3]?.textContent?.trim() : "",
      rirField: !!document.querySelector('.focus-well [data-k$="_rir"]'),
    };
  });
  assert(effort.role === "spinbutton" && effort.label && effort.valueText && effort.valueNow,
    "the effort column is a named spinbutton", JSON.stringify(effort));
  assert(!effort.rirField && /effort/i.test(effort.head[3] || ""),
    "effort mode replaces the RIR column everywhere", JSON.stringify(effort));
  assert(/^(easy|hard|max)$/i.test(effort.rowEffort) && effort.hint,
    "a logged set reads back as the word that was tapped", JSON.stringify(effort));
  const wellAlign = await page.evaluate(() => {
    const cells = [...document.querySelectorAll(".focus-well .curset__cell")];
    const band = (sel) => cells.map((c) => {
      const el = c.querySelector(sel);
      return el ? Math.round(el.getBoundingClientRect().top) : null;
    });
    const spread = (arr) => Math.max(...arr) - Math.min(...arr);
    return {
      n: cells.length,
      labs: spread(band(".curset__cell-lab")),
      vals: spread(band(".curset__val")),
      lines: spread(band(".curset__underline")),
      steps: spread(band(".curset__steps")),
    };
  });
  assert(wellAlign.n === 3 && wellAlign.labs <= 1 && wellAlign.vals <= 1 &&
    wellAlign.lines <= 1 && wellAlign.steps <= 1,
    "effort, load and reps share one baseline in the well", JSON.stringify(wellAlign));
  assert(st.ledgerRows === 4 && !st.fold,
    "four logged sets still show in full", JSON.stringify(st));
  // Keyboard operation of the spinner.
  await page.focus(".focus-well [data-effspin]");
  const effBefore = await page.evaluate(() => document.querySelector(".focus-well [data-effspin]").dataset.e);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(120);
  const effAfter = await page.evaluate(() => document.querySelector(".focus-well [data-effspin]").dataset.e);
  assert(effBefore !== effAfter, "arrow keys move the effort spinner", `${effBefore} -> ${effAfter}`);
  // Editing a logged set in effort mode reopens the word it was logged with.
  await page.locator(".ledger__row[data-editn]").first().click();
  await page.waitForTimeout(200);
  const editEffort = await page.evaluate(() => ({
    spin: document.querySelector(".focus-well [data-effspin]")?.dataset.e,
    row: [...document.querySelector(".ledger__row.is-editing").querySelectorAll("span")][3]?.textContent?.trim(),
    editing: document.querySelectorAll(".ledger__row.is-editing").length,
  }));
  assert(editEffort.editing === 1 && !!editEffort.spin &&
    editEffort.row?.toLowerCase().startsWith(editEffort.spin.slice(0, 3)),
    "editing an effort set reopens the word it was logged with", JSON.stringify(editEffort));
  await page.click(".focus-well [data-effstep][data-dir='-1']");
  await page.locator(".focus-well .saveset").click();
  await page.waitForTimeout(250);
  const savedEffort = await page.evaluate((d) => {
    const draft = JSON.parse(localStorage.getItem(d) || "{}");
    const key = Object.keys(draft).find((k) => k.endsWith("_1_effort"));
    return { effort: draft[key], rows: document.querySelectorAll(".ledger__row[data-editn]").length };
  }, DRAFT);
  assert(savedEffort.effort && savedEffort.rows === 4,
    "saving an effort edit updates the set in place", JSON.stringify(savedEffort));

  // ---- 05 — folded history ----------------------------------------------------
  phase("State 05: high-volume exercise with folded set history");
  await boot(page, { rirMode: "effort" });
  await setSetCount(page, 4, 10);
  await enterFocus(page, 4);
  await logSets(page, 8, { load: 70, reps: 8 });
  st = await cardState(page);
  assert(st.ledgerRows === 2 && /1.*6/.test(st.fold) && st.foldExpanded === "false",
    "older sets fold behind one disclosure row", JSON.stringify(st));
  assert(/8/.test(st.count), "the fold summary counts every logged set", st.count);
  assert(!/recolhido/i.test(await page.evaluate(() => document.querySelector("#workout").textContent)),
    "the fold carries no explanatory blurb");
  assert(st.wellHeight >= 150 && st.spill <= 1,
    "a long session never shrinks the well or spills the card", JSON.stringify(st));
  await page.click(".ledger__more");
  await page.waitForTimeout(220);
  const unfolded = await cardState(page);
  assert(unfolded.ledgerRows === 8 && unfolded.foldExpanded === "true",
    "expanding the disclosure reveals every set", JSON.stringify(unfolded));
  assert(unfolded.wellHeight === st.wellHeight,
    "unfolding does not move the well", `${st.wellHeight} -> ${unfolded.wellHeight}`);
  await page.click(".ledger__more");
  await page.waitForTimeout(220);
  assert((await cardState(page)).ledgerRows === 2, "the disclosure folds back");

  // ---- 09 — exercise complete --------------------------------------------------
  phase("State 09: exercise complete with another exercise remaining");
  await boot(page);
  await setSetCount(page, 0, 3);
  await enterFocus(page, 0);
  await logSets(page, 3);
  st = await cardState(page);
  assert(/complete/i.test(st.doneTitle) && /3/.test(st.doneSub),
    "the well reports the exercise finished", JSON.stringify(st));
  assert(/next exercise/i.test(st.ctaText) && st.ctaArrow === true,
    "the next action is a navigation, and may carry an arrow", JSON.stringify(st));
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
  await page.evaluate((d) => {
    const exs = window.__repforgeFocus.list();
    const draft = { __done: [], __touched: [] };
    for (const ex of exs) {
      for (let n = 1; n <= ex.sets; n++) {
        const key = `${ex.id}_${n}`;
        draft[`${key}_load`] = "70";
        draft[`${key}_reps`] = String(11 - n);
        draft[`${key}_rir`] = String(Math.max(0, 3 - n));
        draft.__done.push(key);
        draft.__touched.push(key);
      }
    }
    localStorage.setItem(d, JSON.stringify(draft));
  }, DRAFT);
  await reload(page);
  const lastIndex = await page.evaluate(() => window.__repforgeFocus.list().length - 1);
  await enterFocus(page, lastIndex);
  st = await cardState(page);
  assert(/workout complete/i.test(st.doneTitle) && /every set/i.test(st.doneSub),
    "the final card reports the workout finished", JSON.stringify(st));
  assert(/finish/i.test(st.ctaText) && st.ctaArrow === false,
    "finishing the workout is a commit, so no arrow", JSON.stringify(st));
  const noSkip = await page.evaluate(
    () => !document.querySelector("#workout .exercise.is-current [data-skip]")
  );
  assert(noSkip, "the last exercise offers no skip");
  await page.click("[data-ffinish]");
  await page.waitForTimeout(400);
  const saved = await page.evaluate((k) => (JSON.parse(localStorage.getItem(k) || "{}").log || []).length, KEY);
  assert(saved > 0, "Finish workout saves the session", `rows=${saved}`);

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
  const midSwipe = await page.evaluate(() => {
    const peek = document.querySelector(".deck__slot--next");
    const track = document.querySelector("#focusTrack");
    const card = document.querySelector("#workout .exercise.is-current");
    return {
      peekVisible: getComputedStyle(peek).visibility === "visible",
      peekName: peek.querySelector(".focus-ex__name")?.textContent?.trim() || "",
      peekHasWell: !!peek.querySelector(".focus-well"),
      peekInert: !peek.querySelector("input, button"),
      trackMoved: getComputedStyle(track).transform !== "none",
      cardUpright: getComputedStyle(card).transform === "none",
      stacked: document.querySelectorAll(".deck__layer").length,
      pageScrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  assert(midSwipe.trackMoved && midSwipe.peekVisible && midSwipe.peekName && midSwipe.peekHasWell,
    "the neighbouring card rides in fully composed", JSON.stringify(midSwipe));
  assert(midSwipe.cardUpright && midSwipe.stacked === 0,
    "the cards travel flat and upright, with no stack behind them", JSON.stringify(midSwipe));
  assert(midSwipe.peekInert && !midSwipe.pageScrollsX,
    "the peek holds no controls and the page never scrolls sideways", JSON.stringify(midSwipe));
  await page.mouse.up();
  await page.waitForTimeout(450);
  assert((await page.evaluate(() => window.__repforgeFocus.at())) === 1,
    "a swipe past the threshold advances the deck");
  // The whole card is a handle, not just its header. A scroll container that
  // has nothing to scroll must not claim the touch and cancel the gesture.
  const grip = await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    const ledger = card.querySelector(".fcard__ledger");
    return {
      card: getComputedStyle(card).touchAction,
      ledger: getComputedStyle(ledger).touchAction,
      scrolls: ledger.scrollHeight > ledger.clientHeight + 1,
      marked: ledger.classList.contains("is-scrollable"),
    };
  });
  assert(grip.card === "pan-y" && grip.ledger === (grip.scrolls ? "pan-y" : "none") &&
    grip.scrolls === grip.marked,
    "the ledger only takes vertical gestures when it has something to scroll",
    JSON.stringify(grip));
  // Drag from three heights: header, middle of the ledger, and the well.
  for (const [where, frac] of [["header", 0.08], ["ledger", 0.45], ["well", 0.86]]) {
    const at = await page.evaluate(() => window.__repforgeFocus.at());
    const b = await page.locator("#workout .exercise.is-current").boundingBox();
    const gy = Math.round(b.y + b.height * frac);
    const gx = Math.round(b.x + b.width - 24);
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
      await page.click("#woPrev");
      await page.waitForTimeout(300);
    }
  }
  // Swiping is never the only way through, and every way runs the same slide.
  await page.click("#woPrev");
  await page.waitForTimeout(60);
  const chevSlide = await page.evaluate(() => ({
    settling: document.querySelector("#focusTrack").classList.contains("is-settling"),
    swiping: document.querySelector("#focusDeck").classList.contains("is-swiping"),
  }));
  assert(chevSlide.settling && chevSlide.swiping,
    "the header chevron slides the deck too", JSON.stringify(chevSlide));
  await page.waitForTimeout(400);
  assert((await page.evaluate(() => window.__repforgeFocus.at())) === 0,
    "the header chevron walks back");
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
      ...document.querySelectorAll("#woPrev, #woNext, #woRest"),
    ].filter((el) => el.offsetParent !== null && !el.disabled && !el.closest("[inert]"));
    const small = controls
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; })
      .map((el) => `${el.className}:${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
    const segs = [...document.querySelectorAll("#woProgress .segbar__seg")];
    const colour = (el) => getComputedStyle(el).backgroundColor;
    return {
      unnamed: controls.filter((el) => !named(el)).length,
      small,
      deckNamed: !!document.querySelector("#focusDeck")?.getAttribute("aria-label"),
      inputsLabelled: [...card.querySelectorAll(".focus-well input")].every((i) => !!i.getAttribute("aria-label")),
      carriersInert: [...card.querySelectorAll(".focus-inputs")].every((c) => c.hasAttribute("inert")),
      done: segs[0] ? colour(segs[0]) : "",
      current: segs[1] ? colour(segs[1]) : "",
      upcoming: segs[2] ? colour(segs[2]) : "",
    };
  });
  assert(a11y.unnamed === 0, "every visible control has an accessible name", JSON.stringify(a11y));
  assert(a11y.small.length === 0, "every control is at least 44×44", JSON.stringify(a11y.small));
  assert(a11y.deckNamed && a11y.inputsLabelled && a11y.carriersInert,
    "the deck is named, the fields are labelled and the hidden carriers are inert",
    JSON.stringify(a11y));
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
  const motion = await rmPage.evaluate(() => {
    const track = document.querySelector("#focusTrack");
    return {
      track: getComputedStyle(track).transitionDuration,
      sheet: getComputedStyle(document.querySelector("#exNoteSheet")).transitionDuration,
    };
  });
  assert(/^0s/.test(motion.sheet), "reduced motion drops the sheet animation", JSON.stringify(motion));
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
      const ledger = card.querySelector(".fcard__ledger");
      const cta = card.querySelector(".focus-well .btn--cta").getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();
      const clipped = [...card.querySelectorAll(".focus-cue__text, .focus-ex__target, .ledger__head > span")]
        .filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow !== "ellipsis").length;
      return {
        spill: card.scrollHeight - card.clientHeight,
        ledger: Math.round(ledger.clientHeight),
        ctaWhole: cta.bottom <= cardBox.bottom + 1 && cta.height >= 44,
        clipped,
        pageScrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        pageScrollsY: document.documentElement.scrollHeight > window.innerHeight + 2,
      };
    });
    assert(fit.spill <= 1 && fit.ctaWhole, `${name}: the card fits and keeps its action`, JSON.stringify(fit));
    assert(fit.ledger >= 44, `${name}: the ledger still shows a row`, JSON.stringify(fit));
    assert(fit.clipped === 0 && !fit.pageScrollsX && !fit.pageScrollsY,
      `${name}: no clipped labels, no stray scrolling`, JSON.stringify(fit));
    await vpCtx.close();
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
