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
  // `closeOnboarding` is a hoisted declaration, so it exists as soon as app.js
  // parses — long before boot has read storage and assigned state. Rendered day
  // tabs are the first thing that cannot appear until it has, which is what the
  // rest of this file then reaches into. Same gate as every other suite.
  await page.waitForSelector("#dayTabs button", { state: "attached", timeout: 15000 });
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
    const loadInput = page.locator("#workout .exercise.is-current .focus-well .curset__val[data-k$='_load']");
    if (!(await loadInput.count())) break;
    await loadInput.first().fill(String(load));
    const repsInput = page.locator("#workout .exercise.is-current .focus-well .curset__val[data-k$='_reps']");
    if (await repsInput.count()) await repsInput.first().fill(String(reps));
    await page.locator("#workout .exercise.is-current .focus-well .saveset").first().click();
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
    () => document.querySelector("#workout .exercise.is-current .ledger__lab")?.textContent?.trim() || ""
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
    () => !!document.querySelector('#workout .exercise.is-current .focus-well [data-k$="_rir"]')
  );
  assert(rirCell, "the well's third column is a numeric RIR field", String(rirCell));

  // ---- 03b — a logged set lands -----------------------------------------------
  phase("State 03b: a logged set lands with one pass of motion");
  const setLanded = await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    const rows = [...card.querySelectorAll(".ledger__row[data-editn]")];
    const fresh = card.querySelector(".ledger__row.is-fresh");
    const anim = (el) => (el ? getComputedStyle(el).animationName : "");
    return {
      freshRows: card.querySelectorAll(".ledger__row.is-fresh").length,
      newest: !!fresh && fresh === rows[rows.length - 1],
      rowAnim: anim(fresh),
      checkAnim: anim(fresh?.querySelector(".ledger__check")),
      cueAnim: anim(card.querySelector(".focus-well.is-fresh .focus-cue")),
      cursetAnim: anim(card.querySelector(".focus-well.is-fresh .curset")),
      counterAnim: anim(card.querySelector(".focus-ex__setof.is-fresh b")),
      // A peek is inert scenery: it must never replay the live card's beat.
      peekFresh: document.querySelectorAll("#focusDeck .is-peek .is-fresh").length,
    };
  });
  assert(setLanded.freshRows === 1 && setLanded.newest,
    "only the set that just landed is marked fresh", JSON.stringify(setLanded));
  assert(/setland-row/.test(setLanded.rowAnim) && /setland-check/.test(setLanded.checkAnim),
    "the new ledger row and its tick animate in", JSON.stringify(setLanded));
  assert(/setland-arm/.test(setLanded.cueAnim) && /setland-arm/.test(setLanded.cursetAnim),
    "the well re-arms for the next set", JSON.stringify(setLanded));
  assert(/setland-count/.test(setLanded.counterAnim),
    "the set counter ticks over", JSON.stringify(setLanded));
  assert(setLanded.peekFresh === 0, "the neighbouring peek cards stay still", JSON.stringify(setLanded));
  // The card is redrawn on every navigation and every draft change, so the beat
  // has to belong to the render that logged the set and to no other.
  await page.evaluate(() => window.__repforgeFocus.to(1));
  await page.evaluate(() => window.__repforgeFocus.to(0));
  const replayed = await page.evaluate(() => document.querySelectorAll("#workout .is-fresh").length);
  assert(replayed === 0, "a later render draws the same card at rest", String(replayed));
  st = await cardState(page);
  assert(st.ledgerRows === 2 && st.lastRowBottom <= st.ledgerBottom + 1,
    "the landing animation leaves the ledger where the layout puts it", JSON.stringify(st));

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
  await page.locator("#workout .exercise.is-current .focus-well .curset__val[data-k$='_reps']").first().fill("9");
  await page.locator("#workout .exercise.is-current .focus-well .saveset").click();
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
  await page.locator("#workout .exercise.is-current .focus-well .curset__val[data-k$='_reps']").first().fill("2");
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
    const sheet = box("#exNoteSheet"), head = box("#exNoteSheet .sheet__head");
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
  const noteSaved = await page.evaluate((d) => ({
    draft: JSON.parse(localStorage.getItem(d) || "{}").__exnotes || {},
    marked: !!document.querySelector("#workout .exercise.is-current .focus-tool.has-note"),
    closed: document.querySelector("#exNoteSheet").hidden,
  }), DRAFT);
  assert(Object.values(noteSaved.draft).includes("Seat 4, feet high.") && noteSaved.closed,
    "saving the sheet writes the note into the session draft", JSON.stringify(noteSaved));
  assert(noteSaved.marked, "the card's note tool shows the exercise now has one");
  assert(await page.evaluate(() => document.activeElement?.matches?.("[data-exnote-open]") && document.activeElement.isConnected),
    "saving the sheet returns focus to the newly rendered note tool");
  await page.locator("[data-exnote-open]").first().click();
  await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => {
    const s = document.querySelector("#exNoteSheet");
    return !s || s.hidden || s.classList.contains("hidden");
  }, { timeout: 2000 });
  assert(await page.evaluate(() => document.querySelector("#exNoteSheet").hidden),
    "Escape closes the note sheet");
  assert(await page.evaluate(() => document.activeElement?.matches?.("[data-exnote-open]")),
    "Escape returns focus to the note tool");

  // ---- 04 — effort mode -------------------------------------------------------
  phase("State 04: mid-exercise logging with Easy / Hard / Max");
  await boot(page, { rirMode: "effort" });
  await setSetCount(page, 0, 6);
  await enterFocus(page, 0);
  await logSets(page, 4, { load: 7.5, reps: 4 });
  st = await cardState(page);
  const effort = await page.evaluate(() => {
    const spin = document.querySelector("#workout .exercise.is-current .focus-well [data-effspin]");
    const head = [...document.querySelectorAll("#workout .exercise.is-current .ledger__head > span")].map((s) => s.textContent.trim());
    const row = document.querySelector(".ledger__row[data-editn]");
    return {
      role: spin?.getAttribute("role"),
      label: spin?.getAttribute("aria-label") || "",
      valueText: spin?.getAttribute("aria-valuetext") || "",
      valueNow: spin?.getAttribute("aria-valuenow") || "",
      hint: document.querySelector("#workout .exercise.is-current .focus-well .effortpop__hint")?.textContent?.trim() || "",
      head,
      rowEffort: row ? [...row.querySelectorAll("span")][3]?.textContent?.trim() : "",
      rirField: !!document.querySelector('#workout .exercise.is-current .focus-well [data-k$="_rir"]'),
    };
  });
  assert(effort.role === "spinbutton" && effort.label && effort.valueText && effort.valueNow,
    "the effort column is a named spinbutton", JSON.stringify(effort));
  assert(!effort.rirField && /effort/i.test(effort.head[3] || ""),
    "effort mode replaces the RIR column everywhere", JSON.stringify(effort));
  assert(/^(easy|hard|max)$/i.test(effort.rowEffort) && effort.hint,
    "a logged set reads back as the word that was tapped", JSON.stringify(effort));
  const wellAlign = await page.evaluate(() => {
    const cells = [...document.querySelectorAll("#workout .exercise.is-current .focus-well .curset__cell")];
    const band = (sel) => cells.map((c) => {
      const el = c.querySelector(sel);
      return el ? Math.round(el.getBoundingClientRect().top) : null;
    });
    const spread = (arr) => Math.max(...arr) - Math.min(...arr);
    const lines = band(".curset__underline");
    const steps = band(".curset__steps");
    return {
      n: cells.length,
      labs: spread(band(".curset__cell-lab")),
      vals: spread(band(".curset__val")),
      lines: spread(lines),
      steps: spread(steps),
      // The steppers hang off the hairline; a caption may not wedge in between.
      gap: Math.max(...steps.map((s, i) => s - lines[i])),
    };
  });
  assert(wellAlign.n === 3 && wellAlign.labs <= 1 && wellAlign.vals <= 1 &&
    wellAlign.lines <= 1 && wellAlign.steps <= 1 && wellAlign.gap <= 6,
    "effort, load and reps share one baseline in the well", JSON.stringify(wellAlign));
  assert(st.ledgerRows === 4 && !st.fold,
    "four logged sets still show in full", JSON.stringify(st));
  // The reps-left shorthand is a pill off the word, not a caption under the steppers.
  const popClosed = await page.evaluate(() => {
    const pop = document.querySelector(".focus-well .effortpop");
    const steps = document.querySelector(".focus-well .curset__cell.is-effort .curset__steps");
    const p = pop?.getBoundingClientRect(), s = steps?.getBoundingClientRect();
    return { present: !!pop, open: !!pop?.classList.contains("is-open"),
      inCell: !!pop?.closest(".curset__cell.is-effort"),
      // Nothing of it may sit under the ± buttons any more.
      belowSteps: !!(p && s) && p.top > s.bottom };
  });
  assert(popClosed.present && popClosed.inCell && !popClosed.open && !popClosed.belowSteps,
    "the effort shorthand starts closed and clear of the steppers", JSON.stringify(popClosed));
  await page.locator(".focus-well [data-effspin]").click();
  await page.waitForTimeout(420);
  const popOpen = await page.evaluate(() => {
    const pop = document.querySelector(".focus-well .effortpop");
    const spin = document.querySelector(".focus-well [data-effspin]");
    const pill = pop?.querySelector(".effortpop__hint");
    const c = pill.getBoundingClientRect(), s = spin.getBoundingClientRect();
    const well = document.querySelector(".focus-well").getBoundingClientRect();
    return {
      open: pop.classList.contains("is-open"),
      text: pill.textContent.trim(),
      above: Math.round(s.top - c.bottom),
      // Centred on the word it explains, and inside the well.
      offCentre: Math.round(Math.abs((c.left + c.right) / 2 - (s.left + s.right) / 2)),
      inside: c.left >= well.left - 1 && c.right <= well.right + 1,
      opacity: +getComputedStyle(pill).opacity,
    };
  });
  assert(popOpen.open && popOpen.text && popOpen.above >= 0 && popOpen.above <= 60 &&
    popOpen.offCentre <= 2 && popOpen.inside && popOpen.opacity > .9,
    "tapping the effort word pops its shorthand open just above it", JSON.stringify(popOpen));
  // Stepping the word under an open pill rewrites the pill rather than closing it.
  await page.locator(".exercise.is-current .focus-well [data-effstep]").last().click();
  await page.waitForTimeout(300);
  const popStepped = await page.evaluate(() => {
    const pop = document.querySelector(".focus-well .effortpop");
    return { open: pop.classList.contains("is-open"),
      text: pop.querySelector(".effortpop__hint")?.textContent?.trim() || "" };
  });
  assert(popStepped.open && popStepped.text && popStepped.text !== popOpen.text,
    "the open shorthand follows the effort word as it steps", JSON.stringify(popStepped));
  await page.locator(".exercise.is-current .focus-ex__muscle").click();
  await page.waitForTimeout(400);
  const popDismissed = await page.evaluate(() => {
    const pop = document.querySelector(".focus-well .effortpop");
    return { open: pop.classList.contains("is-open"), opacity: +getComputedStyle(pop).opacity };
  });
  assert(!popDismissed.open && popDismissed.opacity < .05,
    "a tap outside dismisses the explainer", JSON.stringify(popDismissed));
  // Keyboard operation of the spinner.
  await page.focus("#workout .exercise.is-current .focus-well [data-effspin]");
  const effBefore = await page.evaluate(() => document.querySelector("#workout .exercise.is-current .focus-well [data-effspin]").dataset.e);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(120);
  const effAfter = await page.evaluate(() => document.querySelector("#workout .exercise.is-current .focus-well [data-effspin]").dataset.e);
  assert(effBefore !== effAfter, "arrow keys move the effort spinner", `${effBefore} -> ${effAfter}`);
  // Editing a logged set in effort mode reopens the word it was logged with.
  await page.locator(".ledger__row[data-editn]").first().click();
  await page.waitForTimeout(200);
  const editEffort = await page.evaluate(() => ({
    spin: document.querySelector("#workout .exercise.is-current .focus-well [data-effspin]")?.dataset.e,
    row: [...document.querySelector(".ledger__row.is-editing").querySelectorAll("span")][3]?.textContent?.trim(),
    editing: document.querySelectorAll(".ledger__row.is-editing").length,
  }));
  assert(editEffort.editing === 1 && !!editEffort.spin &&
    editEffort.row?.toLowerCase().startsWith(editEffort.spin.slice(0, 3)),
    "editing an effort set reopens the word it was logged with", JSON.stringify(editEffort));
  await page.click("#workout .exercise.is-current .focus-well [data-effstep][data-dir='-1']");
  await page.locator("#workout .exercise.is-current .focus-well .saveset").click();
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
  await page.click("#workout .exercise.is-current .ledger__more");
  await page.waitForTimeout(220);
  const unfolded = await cardState(page);
  assert(unfolded.ledgerRows === 8 && unfolded.foldExpanded === "true",
    "expanding the disclosure reveals every set", JSON.stringify(unfolded));
  assert(unfolded.wellHeight === st.wellHeight,
    "unfolding does not move the well", `${st.wellHeight} -> ${unfolded.wellHeight}`);
  await page.click("#workout .exercise.is-current .ledger__more");
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
  // Whatever the peek shows mid-swipe is what the card must show once it lands:
  // a control that appears — or a box that changes height — on arrival is a card
  // rebuilding itself under the lifter's thumb.
  const shape = (root) => {
    const card = root.matches(".exercise--focus") ? root : root.querySelector(".exercise--focus");
    const box = (sel) => {
      const el = card.querySelector(sel);
      return el ? Math.round(el.getBoundingClientRect().height) : 0;
    };
    return {
      name: card.querySelector(".focus-ex__name")?.textContent?.trim() || "",
      tools: card.querySelectorAll(".focus-ex__tools .focus-tool").length,
      steppers: card.querySelectorAll(".curset__steps .stepbtn").length,
      cta: card.querySelector(".focus-well .btn--cta")?.textContent?.trim() || "",
      rows: card.querySelectorAll(".ledger__row").length,
      head: box(".fcard__head"),
      ledger: box(".fcard__ledger"),
      well: box(".focus-well"),
    };
  };
  const midSwipe = await page.evaluate(`(${shape})(document.querySelector(".deck__slot--next"))`);
  const midState = await page.evaluate(() => {
    const peek = document.querySelector(".deck__slot--next");
    const track = document.querySelector("#focusTrack");
    const card = document.querySelector("#workout .exercise.is-current");
    return {
      peekVisible: getComputedStyle(peek).visibility === "visible",
      peekHasWell: !!peek.querySelector(".focus-well"),
      // Composed, not wired: a peek carries no draft field and no hook that a
      // handler could fire on the neighbour's behalf.
      peekWired: !!peek.querySelector("[data-k], [data-save], [data-skip], [data-fold], [data-step]," +
        "[data-effstep], [data-effspin], [data-editn], [data-exopen], [data-exnote-open], [data-fnext], [data-ffinish]"),
      peekInert: !!peek.querySelector(".exercise--focus[inert]"),
      peekTabbable: [...peek.querySelectorAll("button, input, textarea")]
        .filter((el) => el.tabIndex >= 0).length,
      trackMoved: getComputedStyle(track).transform !== "none",
      cardUpright: getComputedStyle(card).transform === "none",
      stacked: document.querySelectorAll(".deck__layer").length,
      pageScrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  assert(midState.trackMoved && midState.peekVisible && midSwipe.name && midState.peekHasWell,
    "the neighbouring card rides in fully composed", JSON.stringify({ ...midState, ...midSwipe }));
  assert(midSwipe.tools >= 1 && midSwipe.steppers === 6 && !!midSwipe.cta,
    "the card riding in already carries its tools, steppers and action",
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
  const same = ["name", "tools", "steppers", "cta", "rows", "head", "ledger", "well"]
    .filter((k) => landed[k] !== midSwipe[k]);
  assert(same.length === 0,
    "the card that landed is the one that rode in — nothing pops in, nothing reflows",
    JSON.stringify({ peek: midSwipe, landed, differs: same }));
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
  assert(grip.card === "pan-y pinch-zoom" && grip.ledger === (grip.scrolls ? "pan-y pinch-zoom" : "pinch-zoom") &&
    grip.scrolls === grip.marked,
    "the ledger only takes vertical gestures when it has something to scroll, and pinch zoom stays available",
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
  phase("C1: disabled Focus navigation contrast");
  const navContrast = await rmPage.evaluate(() => {
    const lin = (c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const hexToRgb = (hex) => {
      const n = parseInt(String(hex).replace("#", ""), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const parseRgb = (c) => {
      const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m ? [+m[1], +m[2], +m[3]] : null;
    };
    const prev = document.querySelector("#woPrev");
    const color = getComputedStyle(prev).color;
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    const rgb = parseRgb(color);
    const [br, bgc, bb] = hexToRgb(bg);
    const L1 = lum(...rgb);
    const L2 = lum(br, bgc, bb);
    const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
    return { disabled: prev.disabled, color, contrast: (hi + 0.05) / (lo + 0.05) };
  });
  assert(navContrast.disabled === true, "previous chevron is disabled on the first exercise", JSON.stringify(navContrast));
  assert(navContrast.contrast >= 3, "disabled Focus navigation reaches the 3:1 usability target", JSON.stringify(navContrast));
  const motion = await rmPage.evaluate(() => {
    const track = document.querySelector("#focusTrack");
    return {
      track: getComputedStyle(track).transitionDuration,
      sheet: getComputedStyle(document.querySelector("#exNoteSheet")).transitionDuration,
    };
  });
  assert(/^0s/.test(motion.sheet), "reduced motion drops the sheet animation", JSON.stringify(motion));
  await logSets(rmPage, 1);
  const rmLanded = await rmPage.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    const fresh = card.querySelector(".ledger__row.is-fresh");
    const anim = (el) => (el ? getComputedStyle(el).animationName : "");
    return {
      marked: !!fresh,
      row: anim(fresh),
      check: anim(fresh?.querySelector(".ledger__check")),
      well: anim(card.querySelector(".focus-well.is-fresh .curset")),
    };
  });
  assert(rmLanded.marked && rmLanded.row === "none" && rmLanded.check === "none" && rmLanded.well === "none",
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
  const focusIds = await draftPage.evaluate(() => window.__repforgeFocus.list().map((e) => ({ id: e.id, name: e.name, day: e.day })));
  const skipEx = focusIds[1] || focusIds[0];
  const keepEx = focusIds[0];
  const alt = await draftPage.evaluate((id) => {
    const ex = (JSON.parse(localStorage.getItem("repforge_v1") || "{}").program || []).find((e) => e.id === id);
    return (ex?.alternates && ex.alternates[0]) || "Leg press";
  }, keepEx.id);
  const resumedSets = await draftPage.evaluate(({ keep, skip, alt, d }) => {
    const draft = { __done: [], __touched: [], __skipped: [skip.id], __substituted: { [keep.id]: alt } };
    const sets = (JSON.parse(localStorage.getItem("repforge_v1") || "{}").program || []).find((e) => e.id === keep.id)?.sets || 2;
    for (let n = 1; n <= sets; n++) {
      const key = `${keep.id}_${n}`;
      draft[`${key}_load`] = "70";
      draft[`${key}_reps`] = "8";
      draft[`${key}_rir`] = "1";
      draft.__done.push(key);
      draft.__touched.push(key);
    }
    localStorage.setItem(d, JSON.stringify(draft));
    return sets;
  }, { keep: keepEx, skip: skipEx, alt, d: DRAFT });
  await reload(draftPage);
  await enterFocus(draftPage, 0);
  const deck = await draftPage.evaluate(() => {
    const list = window.__repforgeFocus.list();
    const name = document.querySelector("#workout .exercise.is-current .focus-ex__name")?.textContent?.trim();
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
  const resumedSave = await draftPage.evaluate(async ({ k, d, exerciseId, performedName }) => {
    const result = await window.__repforgeSaveWorkout();
    await window.__repforgeStorage.flush();
    const log = JSON.parse(localStorage.getItem(k) || "{}").log || [];
    const matchingRows = log.filter((row) => row.exerciseId === exerciseId && row.performedName === performedName);
    return {
      href: location.href,
      result,
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

  phase("F1: mixed-load hold first-set Focus cue");
  {
    const f1Ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const f1Page = await f1Ctx.newPage();
    await boot(f1Page);
    await enterFocus(f1Page, 0);
    const seed = await f1Page.evaluate(() => {
      const ex = window.__repforgeFocus.list()[0];
      return { id: ex.id, day: ex.day, name: ex.name, primary: ex.primary, secondary: ex.secondary };
    });
    const rows = [52.5, 55].map((load, i) => ({
      session: `2025-05-15_${seed.day}_f1_hold`, date: "2025-05-15", day: seed.day,
      name: seed.name, exerciseId: seed.id, set: i + 1, load, reps: 7, rir: 1, notes: "",
      created: "2025-05-15T12:00:00.000Z", primary: seed.primary, secondary: seed.secondary,
    }));
    await persist(f1Page, `
      const exId = ${JSON.stringify(seed.id)};
      s.settings = { ...(s.settings || {}), minJump: 2.5, unit: "kg", lang: "en", rirMode: "numeric" };
      s.program = (s.program || []).map((e) => e.id === exId ? { ...e, sets: 2, min: 6, max: 8 } : e);
      s.log = ${JSON.stringify(rows)};
    `);
    await f1Page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reload(f1Page);
    await enterFocus(f1Page, 0);
    const rec = await f1Page.evaluate((id) => {
      const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      const ex = (raw.program || []).find((e) => e.id === id);
      const r = window.__repforgeRecommendation?.(ex);
      return r && { status: r.status, load: r.load, reenterReps: !!r.reenterReps };
    }, seed.id);
    const cue = await f1Page.locator(".exercise.is-current .focus-cue__text").textContent();
    const loadVal = await f1Page.locator(".exercise.is-current .curset__val[data-k$='_load']").inputValue();
    const repsVal = await f1Page.locator(".exercise.is-current .curset__val[data-k$='_reps']").inputValue();
    assert(rec?.status === "hold" && rec.load === 55 && rec.reenterReps && loadVal === "55" && !/53\.75/.test(cue || ""),
      "F1 mixed hold: Focus first-set load is on-grid 55 kg", `cue="${cue}" rec=${JSON.stringify(rec)}`);
    assert(repsVal === "6" && /aim for 6 reps/.test(cue || ""),
      "F1 mixed hold: Focus first-set reps re-enter at 6", `cue="${cue}" reps=${repsVal}`);
    await f1Ctx.close();
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
