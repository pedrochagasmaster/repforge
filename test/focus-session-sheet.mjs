#!/usr/bin/env node
/**
 * Plan 055 / 055-P3: Session sheet for workout metadata, map, and early finish.
 *
 * The Session sheet owns date, bodyweight, and session notes in a dedicated
 * Focus surface backed by DraftV2 commands.
 * Every field round-trips through reload, the session map reflects exercise
 * completion and allows direct jump, and Early finish requires an explicit
 * confirmation from a fresh draft revision, rejecting stale revisions.
 *
 * Run: node test/focus-session-sheet.mjs
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium, openShelfField } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";
import { SAFE_AREA, openCatalogState } from "./fixtures/catalog-state.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";

/** Tap a shelf field on the current card, then type into it, as a lifter does. */
async function fillShelf(page, field, value) {
  const shelf = "#workout .exercise.is-current:not(.is-peek) .focus-shelf";
  const metricId = field === "load" ? WEIGHT : field === "reps" ? REPS : null;
  const input = page.locator(metricId ? `${shelf} input[data-metric-id="${metricId}"]` : `${shelf} input[data-k$="_rir"]`);
  if (await input.getAttribute("aria-hidden") === "true") {
    await openShelfField(page, `${shelf} [data-shelf-field="${metricId ? `metric_${metricId}` : "rir"}"]`);
  }
  await input.fill(String(value));
}

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
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(`${d}:`)) localStorage.removeItem(key);
      }
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

async function freshPage(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await installSeedProgram(page, { key: KEY, waitFor: waitForApp });
  return { context, page, errors };
}

const flushDraft = (page) => page.evaluate(() => window.__repforgeWorkoutDraft.flush());


/**
 * R7 V-06: confirming an early finish at large text. The catalog's own early-finish state, at the smallest phone at the
 * usual size and at the smallest and canonical phones in both languages with double-size text: Confirm and Cancel are whole inside the viewport above the
 * safe area, and the sentence and the omitted sets above them keep a window of at least 120px (the prompt scrolls
 * inside the sheet while its actions stay pinned).
 */
async function earlyFinishFitsLargeText(browser) {
  phase("Early finish at double-size text: Confirm and Cancel stay reachable");
  const frames = [[320, "pt", "normal"], [320, "en", "normal"], ...[320, 390].flatMap((width) => ["pt", "en"].map((lang) => [width, lang, "text200"]))];
  for (const [width, lang, text] of frames) {
    const opened = await openCatalogState(browser, "workout/early-finish", width, lang, text);
    try {
      const m = await opened.page.evaluate((safeBottom) => {
        const box = (el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height }; };
        const prompt = document.querySelector("#sessionEarlyPrompt"), actions = document.querySelector(".session-early-actions");
        const confirm = box(document.querySelector("#sessionEarlyConfirm")), cancel = box(document.querySelector("#sessionEarlyCancel"));
        const inside = (b) => b.top >= 0 && b.bottom <= innerHeight - safeBottom + 0.5 && b.left >= 0 && b.right <= innerWidth;
        const tapped = (id) => { const b = box(document.querySelector(id)); const hit = document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2); return !!hit && !!hit.closest(id); };
        return { confirm, cancel, vh: innerHeight, confirmInside: inside(confirm), cancelInside: inside(cancel),
          confirmTapped: tapped("#sessionEarlyConfirm"), cancelTapped: tapped("#sessionEarlyCancel"),
          window: Math.min(actions.getBoundingClientRect().top, innerHeight - safeBottom) - Math.max(prompt.getBoundingClientRect().top, 0), promptShown: !prompt.classList.contains("hidden") };
      }, SAFE_AREA.bottom);
      const label = `${width}px ${lang} ${text === "text200" ? "200%" : "100%"}`;
      assert(m.promptShown, `${label}: the confirmation is open`);
      assert(m.confirmInside && m.cancelInside, `${label}: Confirm and Cancel are whole inside the viewport above the safe area`, JSON.stringify({ confirm: m.confirm, cancel: m.cancel, vh: m.vh }));
      assert(m.confirmTapped && m.cancelTapped, `${label}: a tap at the centre of each lands on it`);
      assert(m.window >= 120, `${label}: the sentence and omitted sets keep a window of at least 120px (${Math.round(m.window)}px)`);
    } finally {
      await opened.context.close();
    }
  }
}

/**
 * #522 (owner direction A, 2026-10-28): the sheet as a session hub. At 390 EN, 320 PT, 320 EN at double-size text and
 * 430 EN: the head says where the session stands; every row's state is a mark and (for the current and a skipped lift)
 * a word, not colour alone; rows are whole 44px+ jump targets inside the column; date, bodyweight and notes are value
 * rows inside the column; nothing is pinned under the body, the two endings close the scroll and, once scrolled to,
 * are whole and tappable; and End without saving is quiet text that never looks like Finish early.
 */
async function sessionHubChecks(browser) {
  phase("Session details as a hub (#522): head, marks, value rows, endings at the end of the scroll");
  for (const [width, lang, text] of [[390, "en", "normal"], [320, "pt", "normal"], [320, "en", "text200"], [320, "pt", "text200"], [430, "en", "normal"]]) {
    const opened = await openCatalogState(browser, "workout/session", width, lang, text, { height: width === 430 ? 932 : width === 320 ? 568 : 844 });
    const label = `${width}px ${lang} ${text === "text200" ? "200%" : "100%"}`;
    try {
      const page = opened.page;
      // A skipped lift, and a lift that counts bodyweight, so both say so.
      await page.evaluate(async () => {
        const draft = window.__repforgeWorkoutDraft.current(), skip = draft.exerciseOrder[2];
        await WorkoutSession.dispatch("skipExercise", { exerciseInstanceId: skip });
        window.sessionBodyweightLifts = () => ["Pull-up"];
        renderSessionSheet();
      });
      const m = await page.evaluate(() => {
        const sheet = document.querySelector("#sessionSheet"), body = document.querySelector("#sessionSheetBody"), col = body.getBoundingClientRect();
        const draft = window.__repforgeWorkoutDraft.current();
        const sets = draft.exerciseOrder.reduce((n, id) => n + draft.exercises[id].setOrder.filter((sid) => draft.exercises[id].sets[sid].completion !== "pending").length, 0);
        const total = draft.exerciseOrder.reduce((n, id) => n + draft.exercises[id].setOrder.length, 0);
        const rows = [...document.querySelectorAll("#sessionMap .session-map__row")].map((row) => {
          const jump = row.querySelector(".session-map__jump"), r = jump.getBoundingClientRect(), mark = row.querySelector(".session-map__mark");
          return { state: [...mark.classList].find((c) => c.startsWith("is-")), note: row.querySelector(".session-map__note")?.textContent || "",
            height: r.height, inside: r.left >= col.left - 0.5 && r.right <= col.right + 0.5,
            overflow: [...jump.children].some((c) => c.scrollWidth > c.clientWidth + 1) };
        });
        const fields = ["#sessionDate", "#sessionBodyweight", "#sessionNotes"].map((id) => { const r = document.querySelector(id).getBoundingClientRect(); return { id, inside: r.left >= col.left - 0.5 && r.right <= col.right + 0.5, height: r.height }; });
        return { summary: document.querySelector("#sessionSheetSub").textContent, sets, total, mono: getComputedStyle(document.querySelector(".session-sheet__sets")).fontFamily,
          rows, fields, kids: [...sheet.children].map((c) => c.id || c.className),
          endingsInBody: body.contains(document.querySelector("#sessionEarlyFinish")) && body.contains(document.querySelector("#sessionAbandon")),
          note: document.querySelector("#sessionBodyweightNote").classList.contains("hidden") ? "" : document.querySelector("#sessionBodyweightNote").textContent };
      });
      assert(m.summary.includes(`${m.sets}/${m.total}`) && /Mono/i.test(m.mono), `${label}: the head says the sets logged of the sets planned, in Mono`, JSON.stringify({ summary: m.summary, sets: m.sets, total: m.total }));
      const cur = m.rows.filter((r) => r.state === "is-current"), skipped = m.rows.filter((r) => r.state === "is-skipped");
      assert(cur.length === 1 && cur[0].note && skipped.length === 1 && skipped[0].note && m.rows.every((r) => r.state),
        `${label}: every row has a state mark, and the current and the skipped lift also say so in words`, JSON.stringify(m.rows.map((r) => [r.state, r.note])));
      assert(m.rows.every((r) => r.height >= 44 && r.inside && !r.overflow), `${label}: every row is a whole jump target of 44px or more inside the column`, JSON.stringify(m.rows));
      assert(m.fields.every((f) => f.inside && f.height >= 44), `${label}: date, bodyweight and notes sit inside the column at a 44px height or more`, JSON.stringify(m.fields));
      // Quiet value rows (owner review, 2026-10-28): at rest no field draws a fill or a border.
      const rest = await page.evaluate(() => ["#sessionDate", "#sessionBodyweight", "#sessionNotes"].map((id) => { const cs = getComputedStyle(document.querySelector(id));
        return { id, bg: cs.backgroundColor, border: parseFloat(cs.borderTopWidth) || 0, shadow: cs.boxShadow }; }));
      assert(rest.every((f) => f.bg === "rgba(0, 0, 0, 0)" && f.border === 0 && f.shadow === "none"), `${label}: at rest the details fields draw no fill, border or ring`, JSON.stringify(rest));
      // No name breaks inside a word: each line break in a row's name falls at a space or a hyphen.
      const broken = await page.evaluate(() => [...document.querySelectorAll("#sessionMap .session-map__name")].flatMap((el) => {
        const node = el.firstChild, text = node?.textContent || "", out = []; let top = null;
        for (let i = 0; i < text.length; i++) { const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 1); const b = r.getClientRects()[0]; if (!b) continue;
          if (top !== null && b.top > top + 2 && !/[\s\u00ad-]/.test(text[i - 1]) && !/\s/.test(text[i])) out.push(text.slice(Math.max(0, i - 4), i + 4)); top = b.top; }
        return out; }));
      assert(broken.length === 0, `${label}: exercise names wrap between words, not inside one`, JSON.stringify(broken));
      assert(m.kids.length === 2 && m.endingsInBody, `${label}: nothing is pinned under the body; both endings close its scroll`, JSON.stringify(m.kids));
      assert(/Pull-up/.test(m.note), `${label}: a lift that counts bodyweight is named beside the bodyweight field`, m.note);
      await page.locator("#sessionSheetBody").evaluate((b) => { b.scrollTop = b.scrollHeight; });
      await page.waitForTimeout(150);
      const end = await page.evaluate(() => {
        const col = document.querySelector("#sessionSheetBody").getBoundingClientRect();
        const look = (id) => { const el = document.querySelector(id), r = el.getBoundingClientRect(), cs = getComputedStyle(el);
          const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
          return { whole: r.top >= col.top - 0.5 && r.bottom <= col.bottom + 0.5, tapped: !!hit?.closest(id), border: parseFloat(cs.borderTopWidth) || 0,
            bg: cs.backgroundColor, color: cs.color, height: r.height }; };
        return { early: look("#sessionEarlyFinish"), abandon: look("#sessionAbandon"), scrolled: document.querySelector("#sessionSheet .sheetband").classList.contains("is-scrolled") };
      });
      assert(end.early.whole && end.abandon.whole && end.early.tapped && end.abandon.tapped && end.abandon.height >= 44,
        `${label}: scrolled to the end, Finish early and End without saving are whole and take their taps`, JSON.stringify(end));
      assert(end.early.border > 0 && end.abandon.border === 0 && end.abandon.bg === "rgba(0, 0, 0, 0)" && end.abandon.color !== end.early.color,
        `${label}: End without saving is quiet red text, never the bordered control Finish early is`, JSON.stringify(end));
      assert(end.scrolled, `${label}: the head takes its hairline once content is under it`);
      if (width === 390) {
        await page.locator("#sessionBodyweight").fill("82");
        const unit = await page.evaluate(async () => { await window.__repforgeWorkoutDraft.flush(); return { unit: document.querySelector("#sessionBodyweightUnit").textContent, value: window.__repforgeWorkoutDraft.current().session.bodyweight }; });
        assert(unit.unit === "kg" && unit.value != null, `${label}: a bodyweight typed in the row is stored, and the unit follows the value`, JSON.stringify(unit));
        await page.locator("#sessionNotes").fill("Belt on for the squats.");
        await page.locator("#sessionNotes").blur();
        const notes = await page.evaluate(() => { const label = document.querySelector(".sessrow--notes .sessrow__label").getBoundingClientRect(), area = document.querySelector("#sessionNotes").getBoundingClientRect();
          return { under: area.top >= label.bottom - 0.5, left: area.left, labelLeft: label.left, align: getComputedStyle(document.querySelector("#sessionNotes")).textAlign }; });
        assert(notes.under && notes.align === "left" && notes.left <= notes.labelLeft + 0.5, `${label}: once notes has text it reads under its label, left-aligned`, JSON.stringify(notes));
      }
      assert(opened.errors ? opened.errors.length === 0 : true, `${label}: no page errors`);
    } finally {
      await opened.context.close();
    }
  }
}

async function main() {
  const browser = await launchChromium();
  const { context, page, errors } = await freshPage(browser);
  try {
    /* ---- Enter workout in Focus mode ---- */
    phase("Session sheet: visible control in Focus header");
    await page.evaluate(async () => {
      await window.__repforgeEnterWorkout({});
    });
    await page.waitForSelector("#workout.is-focus .exercise.is-current", { state: "attached", timeout: 5000 });

    const sheetBtn = page.locator("#sessionSheetBtn");
    assert(await sheetBtn.count() === 1 && await sheetBtn.isVisible(),
      "the workout header provides a visible Session sheet button");

    await sheetBtn.click({ timeout: 5000 });
    await page.waitForSelector("#sessionSheet.is-open", { timeout: 5000 });
    assert(true, "clicking the session button opens the Session sheet");

    /* ---- Date, bodyweight, session notes field bindings ---- */
    phase("Session fields: date, bodyweight, notes dispatch DraftV2 commands");
    const dateInput = page.locator("#sessionDate");
    const bwInput = page.locator("#sessionBodyweight");
    const notesInput = page.locator("#sessionNotes");

    assert(await dateInput.count() === 1 && await bwInput.count() === 1 && await notesInput.count() === 1,
      "the session sheet exposes date, bodyweight, and notes fields");

    // Edit session date
    await dateInput.fill("2026-10-15");
    await page.evaluate(() => document.querySelector("#sessionDate").dispatchEvent(new Event("change")));
    await flushDraft(page);

    // Edit bodyweight
    await bwInput.fill("82.5");
    await page.evaluate(() => document.querySelector("#sessionBodyweight").dispatchEvent(new Event("input")));
    await flushDraft(page);

    // Edit notes
    await notesInput.fill("Feeling strong today. Bench setup feels rock solid.");
    await page.evaluate(() => document.querySelector("#sessionNotes").dispatchEvent(new Event("input")));
    await flushDraft(page);

    const draftValues = await page.evaluate(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      return {
        date: draft.program.scheduleDate,
        bodyweight: draft.session.bodyweight,
        notes: draft.session.notes,
      };
    });

    assert(draftValues.date === "2026-10-15",
      "session date updates draft scheduleDate via DraftV2 command", draftValues.date);
    assert(draftValues.bodyweight === "82.5",
      "session bodyweight updates draft bodyweight via DraftV2 command", draftValues.bodyweight);
    assert(draftValues.notes === "Feeling strong today. Bench setup feels rock solid.",
      "session notes update draft notes via DraftV2 command", draftValues.notes);

    /* ---- Reload survival ---- */
    phase("Reload survival: session fields survive reload byte-for-byte");
    await page.locator("#sessionSheetClose").click();
    await page.waitForSelector("#sessionSheet", { state: "hidden", timeout: 5000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.evaluate(async () => {
      await window.__repforgeEnterWorkout({});
    });
    await page.waitForSelector("#workout.is-focus .exercise.is-current", { state: "attached", timeout: 5000 });

    await page.locator("#sessionSheetBtn").click();
    await page.waitForSelector("#sessionSheet.is-open", { timeout: 5000 });

    const restoredFields = await page.evaluate(() => ({
      date: document.querySelector("#sessionDate")?.value,
      bodyweight: document.querySelector("#sessionBodyweight")?.value,
      notes: document.querySelector("#sessionNotes")?.value,
    }));

    assert(restoredFields.date === "2026-10-15" &&
           restoredFields.bodyweight === "82.5" &&
           restoredFields.notes === "Feeling strong today. Bench setup feels rock solid.",
      "session fields restore their exact values after page reload", JSON.stringify(restoredFields));

    /* ---- Session map navigation ---- */
    phase("Session map: exercises listed, direct jump to target exercise");
    const mapRows = await page.locator("#sessionMap [data-session-map-ex]");
    const rowCount = await mapRows.count();
    assert(rowCount >= 2, "the session map lists every programmed exercise", `found ${rowCount}`);

    // Jump to the second exercise via session map
    const secondExId = await mapRows.nth(1).getAttribute("data-session-map-ex");
    await mapRows.nth(1).click();
    await page.waitForSelector("#sessionSheet", { state: "hidden", timeout: 5000 });

    const currentExId = await page.evaluate(() =>
      document.querySelector("#workout .exercise.is-current:not(.is-peek)")?.dataset.ex);
    assert(currentExId === secondExId,
      "tapping an exercise row in the session map jumps directly to that exercise in Focus",
      `target: ${secondExId}, actual: ${currentExId}`);

    /* ---- Commit one set so we have work for early finish ---- */
    phase("Commit work and test Early finish");
    // Enter focus on first exercise and commit a set
    await page.evaluate(() => window.__repforgeFocus.to(0));
    await page.waitForTimeout(150);
    await fillShelf(page, "load", 60);
    await fillShelf(page, "reps", 10);
    await fillShelf(page, "rir", 2);
    await flushDraft(page);
    await page.locator("#workout .exercise.is-current:not(.is-peek) .focus-shelf .saveset").first().click();
    await flushDraft(page);

    /* ---- Early finish: stale revision rejection ---- */
    phase("Early finish: stale revision rejection and fresh confirmation");
    await page.locator("#sessionSheetBtn").click();
    await page.waitForSelector("#sessionSheet.is-open", { timeout: 5000 });

    const earlyBtn = page.locator("#sessionEarlyFinish");
    assert(await earlyBtn.count() === 1 && await earlyBtn.isVisible(),
      "early finish button is visible in the session sheet");

    await earlyBtn.click();
    await page.waitForSelector("#sessionEarlyPrompt:not(.hidden)", { timeout: 5000 });
    assert(await page.locator("#sessionEarlyConfirm").isVisible(),
      "tapping early finish reveals the confirmation prompt");
    // R7 J-04: the control that was pressed is hidden by the reveal, so focus moves into the prompt and
    // Cancel hands it back; neither step may leave it on <body>.
    assert(await page.evaluate(() => document.activeElement?.id === "sessionEarlyConfirm" &&
      !!document.activeElement.closest("#sessionEarlyPrompt")),
    "tapping early finish moves focus to the confirmation in #sessionEarlyPrompt",
    await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName));
    await page.locator("#sessionEarlyCancel").click();
    assert(await page.evaluate(() => document.activeElement?.id === "sessionEarlyFinish"),
      "Cancel returns focus to #sessionEarlyFinish",
      await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName));
    await earlyBtn.click();
    await page.waitForSelector("#sessionEarlyPrompt:not(.hidden)", { timeout: 5000 });

    const omitted=await page.locator("#sessionEarlyOmissions li").allTextContents();
    const names=await page.evaluate(()=>{const d=window.__repforgeWorkoutDraft.current();return d.exerciseOrder.map(id=>d.exercises[id].displayName)});
    assert(omitted.length===names.length && omitted[0]===`${names[0]}: sets 2` &&
      omitted.slice(1).every((text,index)=>text===`${names[index+1]}: sets 1, 2`),
      "early finish names every omitted exercise and ordinal, excluding the logged set", JSON.stringify(omitted));

    // Intentionally mutate the draft behind the prompt to make the captured revision stale!
    await page.evaluate(async () => {
      await window.__repforgeWorkoutDraft.dispatch("setSessionNotes", {
        value: "Mutated behind the prompt to bump revision",
      });
      await window.__repforgeWorkoutDraft.flush();
    });

    // Attempt to confirm on the stale revision
    await page.locator("#sessionEarlyConfirm").click();
    await page.waitForTimeout(200);

    // Assert that the early finish was REJECTED: summary did not open, draft still exists
    const staleCheck = await page.evaluate(() => {
      const summaryOpen = !document.querySelector("#sessionSummary")?.classList.contains("hidden");
      const draftActive = !!window.__repforgeWorkoutDraft.current();
      const hasError = !!document.querySelector("#sessionEarlyMsg.is-error, #toast");
      return { summaryOpen, draftActive, hasError };
    });

    assert(!staleCheck.summaryOpen && staleCheck.draftActive,
      "early finish on a stale revision is rejected without saving", JSON.stringify(staleCheck));

    // Fresh early finish: confirm with the refreshed revision
    await page.locator("#sessionEarlyConfirm").click();

    await page.waitForSelector("#sessionSummary:not(.hidden)", { timeout: 8000 });
    await page.evaluate(() => window.__repforgeStorage.flush());

    const savedState = await page.evaluate((key) => {
      const saved = JSON.parse(localStorage.getItem(key) || "{}");
      return {
        draft: localStorage.getItem("repforge_draft_v1"),
        historyCount: (saved.log || []).length,
        summaryVisible: !document.querySelector("#sessionSummary")?.classList.contains("hidden"),
      };
    }, KEY);

    assert(savedState.draft === null && savedState.historyCount > 0 && savedState.summaryVisible,
      "confirming early finish with a fresh revision saves history, clears draft, and opens summary",
      JSON.stringify(savedState));

    assert(errors.length === 0, "the session sheet journey emits no page or console errors", errors.join(" | "));

    await earlyFinishFitsLargeText(browser);
    await sessionHubChecks(browser);
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(`\n${results.passed} passed, ${results.failed} failed`);
  if (results.failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
