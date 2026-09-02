#!/usr/bin/env node
/**
 * Swipe down to dismiss a bottom sheet.
 *
 * The grab handle promises a sheet that can be pushed back down, so every sheet
 * has to answer a downward drag: follow the thumb, close past a real commitment,
 * spring back short of one, and leave gestures that belong to something else —
 * an upward drag, a scrolled panel — alone. A completed swipe runs the sheet's
 * own dismiss, so it discards a half-typed note exactly as Cancel does and
 * leaves a running rest running exactly as Close does.
 *
 * Run: node test/sheet-swipe-dismiss.mjs
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const DRAFT = "repforge_draft_v1";

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

/**
 * Probes the page keeps for this suite. evaluate callbacks are serialized into
 * the browser and cannot close over anything here, so the readings every phase
 * repeats are installed once, in the page.
 */
const PROBES = `
window.__sheet = (sel) => {
  const el = document.querySelector(sel);
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return {
    hidden: el.hidden === true,
    open: el.classList.contains("is-open"),
    dragging: el.classList.contains("is-dragging"),
    inline: el.style.transform,
    y: Math.round(m.m42),
    locked: document.body.classList.contains("is-sheet-open"),
  };
};
/* openModal marks body-level children inert, so probe the branch holding a view. */
window.__inert = (sel) => {
  const view = document.querySelector(sel);
  const root = [...document.body.children].find((c) => c.contains(view));
  return root?.inert === true;
};
window.__scrim = (sel) => {
  const el = document.querySelector(sel);
  return { opacity: Number(getComputedStyle(el).opacity), inline: el.style.opacity, hidden: el.classList.contains("hidden") };
};
`;

async function settle(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    window.closeFirstRun?.();
    if (el?.classList.contains("active")) window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && window.closeTour) window.closeTour();
  });
}

/** A point on the sheet's drag rail — the head, which every sheet has. */
async function grip(page, sheet) {
  const box = await page.locator(`${sheet} .sheet__head`).boundingBox();
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}

/**
 * Drive a real pointer drag. `pause` is the wait between samples: a short one
 * reads as a flick, a long final one leaves the release velocity at rest, which
 * is how a slow reconsidered drag is told from a throw.
 */
async function drag(page, from, steps, { pause = 16, settleAt = 0 } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (const [dx, dy] of steps) {
    await page.mouse.move(from.x + dx, from.y + dy);
    await page.waitForTimeout(pause);
  }
  if (settleAt) await page.waitForTimeout(settleAt);
  await page.mouse.up();
}

const down = (to, n = 6) => Array.from({ length: n }, (_, i) => [0, Math.round((to * (i + 1)) / n)]);

async function openProgramText(page) {
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#exportProgramText", { timeout: 10000 });
  await page.click("#exportProgramText");
  await page.waitForSelector("#programTextSheet.is-open", { timeout: 5000 });
  await page.waitForTimeout(320);
}

async function run() {
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.addInitScript(PROBES);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.evaluate((d) => {
    window.stopRest();
    localStorage.removeItem(d);
  }, DRAFT);
  // The sheets under test describe a program; a fresh device holds none.
  await installSeedProgram(page, { waitFor: settle });

  // ---- the program-text sheet: the whole grammar of the gesture ---------------
  phase("a long push down dismisses the sheet");
  await openProgramText(page);
  const rail = await grip(page, "#programTextSheet");
  const midDrag = [];
  await page.mouse.move(rail.x, rail.y);
  await page.mouse.down();
  for (const dy of [40, 110, 200]) {
    await page.mouse.move(rail.x, rail.y + dy);
    await page.waitForTimeout(16);
    midDrag.push(
      await page.evaluate(() => ({ ...window.__sheet("#programTextSheet"), scrim: window.__scrim("#programTextScrim").opacity }))
    );
  }
  assert(
    midDrag.every((s) => s.dragging) && midDrag[0].y > 0 && midDrag[1].y > midDrag[0].y && midDrag[2].y > midDrag[1].y,
    "the sheet tracks the thumb down as it drags",
    JSON.stringify(midDrag)
  );
  // The sheet picks the gesture up where it was recognised, not where the thumb
  // landed, so it never jumps the slop the lock costs.
  assert(midDrag[0].y < 40 && midDrag[2].y - midDrag[0].y === 160,
    "it moves exactly as far as the thumb travels after the lock",
    JSON.stringify(midDrag.map((s) => s.y)));
  assert(
    midDrag[2].scrim < midDrag[0].scrim,
    "the scrim thins as the sheet leaves",
    JSON.stringify(midDrag.map((s) => s.scrim))
  );
  await page.mouse.up();
  await page.waitForTimeout(520);
  const dismissed = await page.evaluate(() => ({
    ...window.__sheet("#programTextSheet"),
    inert: window.__inert("#program"),
    focus: document.activeElement?.id,
    scrim: window.__scrim("#programTextScrim"),
  }));
  assert(
    dismissed.hidden && !dismissed.locked && !dismissed.inert,
    "the swipe closes the sheet and releases the page",
    JSON.stringify(dismissed)
  );
  assert(dismissed.focus === "exportProgramText", "focus returns to the button that opened it", dismissed.focus);
  assert(
    !dismissed.dragging && !dismissed.inline && dismissed.scrim.hidden && !dismissed.scrim.inline,
    "the drag leaves no inline state behind",
    JSON.stringify(dismissed)
  );

  phase("a short push springs back");
  await openProgramText(page);
  await drag(page, rail, [[0, 20], [0, 44], [0, 46]], { pause: 40, settleAt: 180 });
  await page.waitForTimeout(420);
  const sprung = await page.evaluate(() => ({
    ...window.__sheet("#programTextSheet"),
    scrim: window.__scrim("#programTextScrim").opacity,
  }));
  assert(!sprung.hidden && sprung.open, "a drag short of the commitment leaves the sheet open", JSON.stringify(sprung));
  assert(
    Math.abs(sprung.y) < 1 && !sprung.dragging && !sprung.inline,
    "the sheet settles back to rest",
    JSON.stringify(sprung)
  );
  assert(sprung.scrim > 0.99, "the scrim comes back with it", String(sprung.scrim));

  phase("a fast flick counts as a full push");
  await drag(page, rail, down(72, 3), { pause: 8 });
  await page.waitForTimeout(520);
  assert(await page.evaluate(() => window.__sheet("#programTextSheet").hidden), "a short, fast throw dismisses");

  phase("gestures that belong to something else are left alone");
  await openProgramText(page);
  await drag(page, rail, [[0, -30], [0, -80], [0, -120]], { pause: 24 });
  await page.waitForTimeout(320);
  const up = await page.evaluate(() => window.__sheet("#programTextSheet"));
  assert(!up.hidden && up.open && !up.dragging && !up.inline && Math.abs(up.y) < 1,
    "an upward drag on the sheet does nothing", JSON.stringify(up));

  const pre = await page.evaluate(() => {
    const el = document.querySelector("#programTextOut");
    el.scrollTop = 60;
    const r = el.getBoundingClientRect();
    return { top: el.scrollTop, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + 40) };
  });
  assert(pre.top > 0, "the program preview scrolls", String(pre.top));
  await drag(page, { x: pre.x, y: pre.y }, down(200), { pause: 16 });
  await page.waitForTimeout(420);
  const held = await page.evaluate(() => window.__sheet("#programTextSheet"));
  assert(!held.hidden && held.open, "a drag inside a scrolled panel scrolls it instead of dismissing", JSON.stringify(held));
  // A sheet closed out from under a live drag must not keep the thumb's offset
  // and reopen part-way down.
  await page.mouse.move(rail.x, rail.y);
  await page.mouse.down();
  await page.mouse.move(rail.x, rail.y + 90);
  await page.waitForTimeout(16);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(420);
  await page.mouse.up();
  await openProgramText(page);
  const reopened = await page.evaluate(() => window.__sheet("#programTextSheet"));
  assert(
    reopened.open && !reopened.dragging && !reopened.inline && Math.abs(reopened.y) < 1,
    "a sheet closed mid-drag reopens at rest",
    JSON.stringify(reopened)
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(420);

  // ---- the note sheet: a swipe must not save what Cancel discards -------------
  phase("swiping the note sheet away discards, like Cancel");
  await page.click('nav button[data-view="log"]');
  await page.evaluate(() => window.__repforgeEnterWorkout({ focus: true }));
  await page.waitForSelector("#workout.is-focus .exercise.is-current", { state: "attached", timeout: 5000 });
  await page.locator("[data-exnote-open]").first().click();
  await page.waitForSelector("#exNoteSheet.is-open", { timeout: 5000 });
  await page.waitForTimeout(320);
  await page.fill("#exNoteText", "Seat 4, feet high.");
  const noteRail = await grip(page, "#exNoteSheet");
  await drag(page, noteRail, down(220), { pause: 16 });
  await page.waitForTimeout(520);
  const note = await page.evaluate(
    (d) => ({
      ...window.__sheet("#exNoteSheet"),
      draft: JSON.parse(localStorage.getItem(d) || "{}").__exnotes || {},
      kept: [...document.querySelectorAll("[data-exnote]")].map((t) => t.value).filter(Boolean),
      focus: document.activeElement?.matches?.("[data-exnote-open]") === true,
    }),
    DRAFT
  );
  assert(note.hidden && !note.locked, "the swipe closes the note sheet", JSON.stringify(note));
  assert(
    !Object.values(note.draft).some(Boolean) && !note.kept.length,
    "the typed note is discarded, not saved",
    JSON.stringify(note)
  );
  assert(note.focus, "focus returns to the note button on the card", String(note.focus));

  // The note's body is one big textarea, so a thumb that starts there is still
  // swiping the sheet — while a mouse there is selecting text and must be left
  // to it.
  phase("the note's own text area drags for a thumb, not for a mouse");
  await page.locator("[data-exnote-open]").first().click();
  await page.waitForSelector("#exNoteSheet.is-open", { timeout: 5000 });
  await page.waitForTimeout(320);
  const field = await page.evaluate(() => {
    const r = document.querySelector("#exNoteText").getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + 24) };
  });
  await drag(page, field, down(220), { pause: 16 });
  await page.waitForTimeout(420);
  const byMouse = await page.evaluate(() => window.__sheet("#exNoteSheet"));
  assert(!byMouse.hidden && byMouse.open && !byMouse.inline, "a mouse drag in the text area leaves the sheet alone", JSON.stringify(byMouse));

  const byThumb = await page.evaluate(async () => {
    const ta = document.querySelector("#exNoteText");
    const r = ta.getBoundingClientRect();
    const x = Math.round(r.x + r.width / 2);
    const y0 = Math.round(r.y + 24);
    const opts = (cy) => ({ pointerId: 7, pointerType: "touch", isPrimary: true, clientX: x, clientY: cy, bubbles: true });
    ta.dispatchEvent(new PointerEvent("pointerdown", opts(y0)));
    const seen = [];
    for (const dy of [20, 90, 160, 220]) {
      await new Promise((r2) => setTimeout(r2, 16));
      window.dispatchEvent(new PointerEvent("pointermove", opts(y0 + dy)));
      seen.push(window.__sheet("#exNoteSheet").y);
    }
    window.dispatchEvent(new PointerEvent("pointerup", opts(y0 + 220)));
    return seen;
  });
  assert(byThumb[3] > byThumb[0] && byThumb[0] > 0, "a touch drag in the text area carries the sheet", JSON.stringify(byThumb));
  await page.waitForTimeout(520);
  const thumbClosed = await page.evaluate(() => window.__sheet("#exNoteSheet"));
  assert(thumbClosed.hidden && !thumbClosed.locked, "and dismisses it", JSON.stringify(thumbClosed));

  // ---- the rest sheet: closing it was never ending the rest -------------------
  phase("swiping the rest timer away leaves the rest running");
  await page.click("#woRest");
  await page.waitForTimeout(200);
  await page.click("#woRest");
  await page.waitForSelector("#restSheet.is-open", { timeout: 5000 });
  await page.waitForTimeout(320);
  const restRail = await grip(page, "#restSheet");
  await drag(page, restRail, down(200), { pause: 16 });
  await page.waitForTimeout(520);
  const rest = await page.evaluate(() => ({
    ...window.__sheet("#restSheet"),
    running: document.querySelector("#woRest").classList.contains("is-running"),
    focus: document.activeElement?.id || "",
  }));
  assert(rest.hidden && !rest.locked, "the swipe closes the rest sheet", JSON.stringify(rest));
  assert(rest.running, "the rest keeps running, exactly as Close leaves it", JSON.stringify(rest));
  assert(rest.focus === "woRest", "focus returns to the chip that opened it", rest.focus);
  await page.evaluate(() => window.stopRest());

  assert(!errors.length, "no uncaught page errors", errors.slice(0, 3).join(" | "));

  await browser.close();
  console.log(`\nsheet swipe dismiss: ${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
