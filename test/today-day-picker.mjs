#!/usr/bin/env node
/**
 * Today's day picker: the second control under the start CTA, which starts a day
 * of the program other than the one Today leads with.
 *
 * A split is rarely trained in order, so the picker has to offer every day of
 * the program, say which one Today is already on, start the one it is handed,
 * and answer the discard prompt the way the day tabs do — a declined discard
 * leaves both the draft and the picker exactly as they were.
 *
 * Run: node test/today-day-picker.mjs   (requires the app served over HTTP)
 */
import { pathToFileURL } from "url";
import { launchChromium } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const IOS_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";

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
const phase = (n) => console.log(`\n${n}`);

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

function ymd(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Log rows for one saved session of `day`, one set per exercise template. */
function sessionRows(program, day, date) {
  const session = `${date}_${day}_seed`;
  return program
    .filter((e) => e.day === day)
    .map((ex) => ({
      session, date, day, name: ex.name, exerciseId: ex.id, set: 1,
      load: 60, reps: ex.min || 8, rir: 1, notes: "", created: `${date}T12:00:00.000Z`,
      primary: ex.primary, secondary: ex.secondary,
    }));
}

async function readState(page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), KEY);
}

/** What Today and the picker currently say. */
async function view(page) {
  return page.evaluate(() => {
    const visible = (sel) => {
      const el = document.querySelector(sel);
      return !!el && !el.classList.contains("hidden");
    };
    const sheet = document.querySelector("#dayPickSheet");
    return {
      pickerBtnVisible: visible("#chooseAnotherDay"),
      pickerBtnText: document.querySelector("#chooseAnotherDay")?.textContent?.trim() || "",
      sheetOpen: !!sheet && !sheet.hidden && sheet.classList.contains("is-open"),
      scrimShown: !document.querySelector("#dayPickScrim")?.classList.contains("hidden"),
      locked: document.body.classList.contains("is-sheet-open"),
      rows: [...document.querySelectorAll("#dayPickList [data-daypick]")].map((b) => ({
        day: b.dataset.daypick,
        n: b.querySelector(".daypick__n")?.textContent?.trim() || "",
        title: b.querySelector(".daypick__title")?.textContent?.trim() || "",
        sub: b.querySelector(".daypick__sub")?.textContent?.trim() || "",
        chip: b.querySelector(".daypick__chip")?.textContent?.trim() || "",
        armed: b.classList.contains("is-selected"),
        pressed: b.getAttribute("aria-pressed") === "true",
        aria: b.getAttribute("aria-label") || "",
      })),
      confirmText: document.querySelector("#dayPickConfirm")?.textContent?.trim() || "",
      day: document.querySelector("#woDayTitle")?.textContent?.trim() || "",
      todayName: document.querySelector("#todaySession .today-session__name")?.textContent?.trim() || "",
      workoutOpen: !document.querySelector("#workoutShell")?.classList.contains("hidden"),
      activeTab: document.querySelector("#dayTabs button.active")?.dataset.day || "",
      focus: document.activeElement?.id || document.activeElement?.dataset?.daypick || "",
      i18n: {
        chooseDay: window.RepForgeI18n.t("today.choose_day"),
        current: window.RepForgeI18n.t("today.choose_day_current"),
        confirm: window.RepForgeI18n.t("today.choose_day_confirm"),
      },
    };
  });
}

async function openPicker(page) {
  await page.click("#chooseAnotherDay");
  await page.waitForSelector("#dayPickSheet.is-open", { timeout: 5000 });
  await page.waitForTimeout(320);
}

async function freshPage(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  // A cleared device has no program: install the one these cases pick days from.
  await installSeedProgram(page, { key: KEY, waitFor: waitForApp });
  return { context, page };
}

const browser = await launchChromium();
const errors = [];

// ---------------------------------------------------------------------------
// 1. The picker lists the whole split, arms a day, and starts it on confirm
// ---------------------------------------------------------------------------
phase("Today offers the picker, and a confirmed day starts");
{
  const { context, page } = await freshPage(browser);
  page.on("pageerror", (e) => errors.push(String(e.message)));
  const start = await view(page);
  assert(start.pickerBtnVisible, "Today shows the choose-another-day button under the start CTA");
  assert(start.pickerBtnText === start.i18n.chooseDay, "the button reads from the catalog", start.pickerBtnText);

  await openPicker(page);
  const opened = await view(page);
  const days = await page.evaluate((k) => [
    ...new Set(JSON.parse(localStorage.getItem(k) || "{}").program.map((e) => e.day)),
  ], KEY);
  assert(
    opened.sheetOpen && opened.scrimShown && opened.locked,
    "the button opens the day sheet over the page",
    JSON.stringify(opened)
  );
  assert(
    opened.rows.length === days.length && opened.rows.every((r, i) => r.day === days[i]),
    "the sheet lists every day of the program, in program order",
    JSON.stringify({ rows: opened.rows.map((r) => r.day), days })
  );
  assert(
    opened.rows.every((r, i) => r.n === String(i + 1)),
    "each row is numbered by its place in the split",
    JSON.stringify(opened.rows.map((r) => r.n))
  );
  assert(
    opened.rows.every((r) => r.title && !/^Day \d+$/.test(r.title)),
    "a default-named day leads with what it trains, not with the number its badge already carries",
    JSON.stringify(opened.rows.map((r) => r.title))
  );
  assert(/\d/.test(opened.rows[0].sub), "each row says how much the day holds", opened.rows[0].sub);
  assert(
    opened.rows.filter((r) => r.chip).length === 1 && opened.rows[0].chip === opened.i18n.current,
    "only the day Today leads with carries the Today chip",
    JSON.stringify(opened.rows.map((r) => r.chip))
  );
  assert(
    opened.rows.every((r) => r.aria.includes(r.day)),
    "the row names its day for anyone who cannot see the badge",
    JSON.stringify(opened.rows.map((r) => r.aria))
  );
  assert(
    opened.rows.filter((r) => r.armed).length === 1 && opened.rows[0].armed && opened.rows[0].pressed,
    "the picker opens armed on the day Today is already on",
    JSON.stringify(opened.rows)
  );
  assert(opened.confirmText === opened.i18n.confirm, "the CTA reads from the catalog", opened.confirmText);
  assert(opened.focus === days[0], "focus opens on the armed row", opened.focus);

  // Arming is not starting: the sheet stays up until the CTA commits the choice.
  await page.click(`[data-daypick="${days[2]}"]`);
  await page.waitForTimeout(120);
  const armed = await view(page);
  assert(
    armed.sheetOpen && !armed.workoutOpen && armed.day === days[0],
    "tapping a row arms it without starting anything",
    JSON.stringify({ open: armed.sheetOpen, workout: armed.workoutOpen, day: armed.day })
  );
  assert(
    armed.rows.filter((r) => r.armed).length === 1 && armed.rows[2].armed && armed.rows[2].pressed,
    "the armed row moves to the tapped day, and only that row",
    JSON.stringify(armed.rows.map((r) => ({ day: r.day, armed: r.armed })))
  );
  assert(
    armed.rows[0].chip === armed.i18n.current && !armed.rows[2].chip,
    "the Today chip stays on today's day while another is armed",
    JSON.stringify(armed.rows.map((r) => r.chip))
  );

  await page.click("#dayPickConfirm");
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
  await page.waitForTimeout(320);
  const started = await view(page);
  const toast = await page.evaluate(() => document.querySelector("#toast")?.textContent?.trim() || "");
  assert(!started.sheetOpen && !started.locked, "confirming closes the sheet and releases the page", JSON.stringify(started));
  assert(
    started.workoutOpen && started.day === days[2] && started.activeTab === days[2],
    "the workout opens on the confirmed day",
    JSON.stringify(started)
  );
  assert(toast.includes(days[2]), "the confirmed day is announced", toast);
  assert(
    await page.evaluate(() => document.body.classList.contains("is-focus-wo")),
    "it enters the same Focus layout the start CTA does"
  );

  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await page.waitForSelector("#todayDash:not(.hidden)", { timeout: 5000 });
  const back = await view(page);
  assert(
    back.todayName === days[2] && back.day === days[2],
    "leaving the workout leaves Today on the day that was confirmed",
    JSON.stringify(back)
  );

  await openPicker(page);
  const reopened = await view(page);
  assert(
    reopened.rows[2].chip === reopened.i18n.current && reopened.rows[2].armed && !reopened.rows[0].chip,
    "reopening the picker follows the day Today now leads with",
    JSON.stringify(reopened.rows.map((r) => ({ day: r.day, chip: r.chip, armed: r.armed })))
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(420);
  await context.close();
}

// ---------------------------------------------------------------------------
// 2. Escape and Cancel leave Today alone
// ---------------------------------------------------------------------------
phase("dismissing the picker changes nothing");
{
  const { context, page } = await freshPage(browser);
  page.on("pageerror", (e) => errors.push(String(e.message)));
  const before = await view(page);

  await openPicker(page);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(420);
  const escaped = await view(page);
  assert(!escaped.sheetOpen && !escaped.locked, "Escape closes the sheet", JSON.stringify(escaped));
  assert(
    !escaped.workoutOpen && escaped.day === before.day,
    "Escape starts nothing and leaves the day alone",
    JSON.stringify({ day: escaped.day, was: before.day })
  );
  assert(escaped.focus === "chooseAnotherDay", "focus returns to the button that opened it", escaped.focus);

  // A day armed and then abandoned is a choice never made.
  await openPicker(page);
  const days = await page.evaluate((k) => [
    ...new Set(JSON.parse(localStorage.getItem(k) || "{}").program.map((e) => e.day)),
  ], KEY);
  await page.click(`[data-daypick="${days[1]}"]`);
  await page.waitForTimeout(120);
  await page.click("#dayPickCancel");
  await page.waitForTimeout(420);
  const cancelled = await view(page);
  assert(
    !cancelled.sheetOpen && !cancelled.workoutOpen && cancelled.day === before.day,
    "Cancel drops an armed day instead of applying it",
    JSON.stringify(cancelled)
  );
  await openPicker(page);
  const rearmed = await view(page);
  assert(
    rearmed.rows[0].armed && !rearmed.rows[1].armed,
    "and the picker reopens armed on today's day, not on the abandoned one",
    JSON.stringify(rearmed.rows.map((r) => ({ day: r.day, armed: r.armed })))
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(420);

  // The sheet is a list of buttons, so a swipe that ends over one must dismiss
  // rather than arm the day the thumb happens to be resting on.
  await openPicker(page);
  const rail = await page.locator("#dayPickSheet .sheet__head").boundingBox();
  const from = { x: Math.round(rail.x + rail.width / 2), y: Math.round(rail.y + rail.height / 2) };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (const dy of [24, 90, 180, 260]) {
    await page.mouse.move(from.x, from.y + dy);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(520);
  const swiped = await view(page);
  assert(
    !swiped.sheetOpen && !swiped.locked && !swiped.workoutOpen && swiped.day === before.day,
    "a swipe down dismisses the sheet without arming the day under the thumb",
    JSON.stringify(swiped)
  );
  await openPicker(page);
  const afterSwipe = await view(page);
  assert(
    afterSwipe.rows[0].armed,
    "the swipe left the armed day where it was",
    JSON.stringify(afterSwipe.rows.map((r) => ({ day: r.day, armed: r.armed })))
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(420);
  await context.close();
}

// ---------------------------------------------------------------------------
// 3. A session in progress is not discarded behind the lifter's back
// ---------------------------------------------------------------------------
phase("an in-progress session is protected by the discard prompt");
{
  const { context, page } = await freshPage(browser);
  page.on("pageerror", (e) => errors.push(String(e.message)));
  let dialogs = 0;
  let answer = "dismiss";
  page.on("dialog", (d) => {
    dialogs++;
    if (answer === "accept") d.accept();
    else d.dismiss();
  });

  const days = await page.evaluate((k) => [
    ...new Set(JSON.parse(localStorage.getItem(k) || "{}").program.map((e) => e.day)),
  ], KEY);
  await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false }));
  await page.waitForSelector("#workoutShell:not(.hidden) #workout .setrow", { timeout: 5000 });
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const ex = (state.program || []).find((e) => e.day === state.program[0].day);
    for (const [suffix, val] of [["load", 42], ["reps", 8], ["rir", 1]]) {
      const el = document.querySelector(`[data-k="${ex.id}_1_${suffix}"]`);
      el.value = String(val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await page.waitForSelector("#todayDash:not(.hidden)", { timeout: 5000 });
  const draftBefore = await page.evaluate((d) => localStorage.getItem(d), DRAFT);

  await openPicker(page);
  await page.click(`[data-daypick="${days[1]}"]`);
  await page.waitForTimeout(120);
  const armedOnly = await view(page);
  assert(dialogs === 0, "arming a day asks nothing — it discards nothing", String(dialogs));
  assert(armedOnly.rows[1].armed, "the other day is armed", JSON.stringify(armedOnly.rows.map((r) => r.armed)));

  await page.click("#dayPickConfirm");
  await page.waitForTimeout(420);
  const declined = await view(page);
  const draftAfter = await page.evaluate((d) => localStorage.getItem(d), DRAFT);
  assert(dialogs === 1, "confirming another day with sets logged asks before discarding", String(dialogs));
  assert(declined.sheetOpen, "declining leaves the picker open", JSON.stringify(declined));
  assert(
    !declined.workoutOpen && declined.day === days[0],
    "declining starts nothing and keeps the day the draft belongs to",
    JSON.stringify(declined)
  );
  assert(
    declined.rows[1].armed,
    "declining leaves the choice armed, so the CTA can be answered again",
    JSON.stringify(declined.rows.map((r) => ({ day: r.day, armed: r.armed })))
  );
  assert(draftAfter === draftBefore, "declining keeps the draft byte for byte", `${draftBefore} → ${draftAfter}`);

  answer = "accept";
  await page.click("#dayPickConfirm");
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
  await page.waitForTimeout(320);
  const accepted = await view(page);
  const logged = await page.evaluate(() =>
    [...document.querySelectorAll("#workout input[data-k$='_load']")].map((el) => el.value).filter(Boolean)
  );
  assert(dialogs === 2, "accepting is the second answer to the same prompt", String(dialogs));
  assert(
    accepted.workoutOpen && accepted.day === days[1] && !accepted.sheetOpen,
    "accepting starts the picked day",
    JSON.stringify(accepted)
  );
  assert(!logged.includes("42"), "the discarded draft's sets do not follow into the new day", JSON.stringify(logged));
  await context.close();
}

// ---------------------------------------------------------------------------
// 4. Nothing to choose: a finished day and a one-day split
// ---------------------------------------------------------------------------
phase("the picker is only offered when there is another day to start");
{
  const { context, page } = await freshPage(browser);
  page.on("pageerror", (e) => errors.push(String(e.message)));
  const state = await readState(page);
  const firstDay = [...new Set(state.program.map((e) => e.day))][0];
  await persistState(page, { ...state, log: sessionRows(state.program, firstDay, ymd(0)) });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const done = await view(page);
  assert(
    !done.pickerBtnVisible,
    "a day already saved for today hides the picker with the rest of the start controls",
    JSON.stringify(done)
  );

  const single = await readState(page);
  await persistState(page, {
    ...single,
    log: [],
    programMeta: { ...single.programMeta, programStructure: null },
    program: single.program.filter((e) => e.day === firstDay),
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const oneDay = await view(page);
  assert(!oneDay.pickerBtnVisible, "a one-day program has nothing to pick, so the button stays away", JSON.stringify(oneDay));
  await context.close();
}

// ---------------------------------------------------------------------------
// 5. A day the lifter named leads with that name
// ---------------------------------------------------------------------------
phase("named days keep their names");
{
  const { context, page } = await freshPage(browser);
  page.on("pageerror", (e) => errors.push(String(e.message)));
  const state = await readState(page);
  const second = [...new Set(state.program.map((e) => e.day))][1];
  const NAME = "Back and biceps";
  await persistState(page, {
    ...state,
    program: state.program.map((e) => (e.day === second ? { ...e, day: NAME } : e)),
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);

  await openPicker(page);
  const rows = (await view(page)).rows;
  const named = rows.find((r) => r.day === NAME);
  assert(named?.title === NAME, "the row leads with the name the day was given", JSON.stringify(named));
  assert(
    named && /[A-Za-z]/.test(named.sub.replace(/\d/g, "")) && /\d/.test(named.sub),
    "the muscles it trains move to the line below, with the count",
    named?.sub
  );
  assert(
    rows.every((r, i) => r.n === String(i + 1)),
    "the badges still number the split in order",
    JSON.stringify(rows.map((r) => r.n))
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(420);
  await context.close();
}

// ---------------------------------------------------------------------------
// 6. Page furniture stays behind the sheet it would otherwise cover
// ---------------------------------------------------------------------------
phase("nothing floats over the open sheet");
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: IOS_SAFARI_UA });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  // A cleared device has no program: install the one these cases pick days from.
  await installSeedProgram(page, { key: KEY, waitFor: waitForApp });
  // The install banner is a fixed card above the nav, and iOS Safari is where it
  // is offered; it used to be drawn over the sheet, hiding the first day rows.
  await page.evaluate(() => window.__repforgeUi.showInstallBanner(true));
  await page.waitForSelector("#installBanner:not(.hidden)", { timeout: 5000 });
  await openPicker(page);

  const covered = await page.evaluate(() =>
    [...document.querySelectorAll("#dayPickList [data-daypick]")]
      .map((row) => {
        const r = row.getBoundingClientRect();
        const hit = document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2));
        if (hit && row.contains(hit)) return null;
        return { day: row.dataset.daypick, over: hit?.closest("[id]")?.id || hit?.tagName || "nothing" };
      })
      .filter(Boolean)
  );
  assert(!covered.length, "every day row is the topmost thing at its own centre", JSON.stringify(covered));

  const banner = await page.evaluate(() => {
    const el = document.querySelector("#installBanner");
    return { dismissed: el.classList.contains("hidden"), drawn: getComputedStyle(el).display !== "none" };
  });
  assert(!banner.drawn && !banner.dismissed, "the sheet hides the banner without dismissing it", JSON.stringify(banner));

  await page.keyboard.press("Escape");
  await page.waitForTimeout(420);
  const after = await page.evaluate(() => getComputedStyle(document.querySelector("#installBanner")).display !== "none");
  assert(after, "and it comes back with the page", String(after));
  await context.close();
}

assert(!errors.length, "no uncaught page errors", errors.slice(0, 3).join(" | "));

await browser.close();

console.log(`\nToday day picker: ${results.passed} passed, ${results.failed} failed`);
if (pathToFileURL(process.argv[1]).href === import.meta.url) process.exit(results.failed > 0 ? 1 : 0);
