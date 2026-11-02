#!/usr/bin/env node
/**
 * The native feel (ADR 0023, Plan 075): the pull-request proofs of each phase.
 * The exhaustive gesture permutations stay in their owning full-lane suites.
 *
 * Phase 1, press feedback (audit F-3).
 *
 * A press is shown under the thumb on touch-down and taken back when the
 * finger leaves the control, as iOS does. Driven with real touch through CDP
 * at 390×844, and with the mouse and the keyboard:
 *
 *   - a primary action is pressed on touch-down with no transition on the way
 *     in: the pressed tone one step off its fill and a 0.97 scale; it returns
 *     on the pressRelease curve;
 *   - a touch that slides off becomes a pan: the press clears and the control
 *     doesn't activate;
 *   - where nothing can pan (a sheet's band) and with the mouse, sliding off
 *     clears the press, sliding back restores it, and lifting outside doesn't
 *     activate;
 *   - a control in a scroller waits before it shows the press, so a scroll that
 *     starts on it never flashes it, and a tap still presses and activates it;
 *   - Space shows the same pressed state;
 *   - under reduced motion the tone stays and the scale goes; dark has its tone;
 *   - every stylesheet press rule is `.is-pressed` (form fields keep `:active`),
 *     and every control a press rule names takes the press.
 *
 * Phase 2, sheets: a long read-only sheet opens at the medium detent, drags to
 * large, rubber-bands past it, returns to medium and dismisses on a flick; a
 * short sheet keeps one rest; under reduced motion a sheet cross-fades in place.
 *
 * Phase 2W, the wheel picker (owner amendment to choice 8): a second tap on the
 * selected Load or Reps shelf field opens a wheel in a fit sheet (RIR still
 * types); a keyboard step and a scroll each settle on a value that writes
 * through the field's own input, the way typing would, and the keyboard button
 * hands off to that same typed path.
 *
 * Phase 3, navigation (audit F-9, F-11): each root page's scroll-edge bar is
 * silent until its large title has scrolled under it, at which point the
 * material and the mirrored inline title appear together; dark and reduced
 * transparency take their own material, and the title caps at 21px under
 * large text. Tapping the dock's current tab scrolls that page to the top
 * (instant under reduced motion), or returns a History session page to the
 * list exactly as its own Back does.
 * Phase 5, large text (audit F-1, F-5). At 200% text in both languages, at
 * 390×844 and 375×667, Focus stacks the rest line under a capped clock, caps
 * the bar title, prints no rest or ledger text over another or past the edge,
 * keeps its pads on one row (the rest controls included, scrolling sideways)
 * and keeps the open set whole above the shelf. The
 * dock keeps one row and its height with labels capped at 1.3×; touching and
 * holding a tab shows the large-content viewer, sliding moves it and lifting
 * switches to the tab under the finger.
 *
 * Phase 5 addendum, the concentric shelf: a 28px sheet with 16px insets, every
 * field, pad and Log set at 12px (the sheet minus the inset), 8px between
 * siblings and 12px between rows, no field label wrapping, and a per-side
 * exercise's Load and Reps in one tile under exactly one "Per side" caption,
 * each field's name still saying per side.
 *
 * Chromium touch emulation is not iPhone evidence; the feel is checked on a
 * device by the owner.
 *
 * Run: node test/native-feel.mjs
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";
import { collectCatalogEvidence, validateCatalogEvidence } from "../tools/ui-screens/catalog-contract.mjs";
import { measureRenderedRoles } from "../tools/ui-system-rendered.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";
import { openCatalogState } from "./fixtures/catalog-state.mjs";
import { metricLogRow } from "./fixtures/history-metric-rows.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";

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
    window.closeFirstRun?.();
    const el = document.querySelector("#onboarding");
    if (el?.classList.contains("active") && typeof window.closeOnboarding === "function") window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function") window.closeTour();
  });
}

async function todayPage(browser, { reducedMotion = "no-preference", theme = "light", layer = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion });
  const page = await context.newPage();
  if (!layer) await page.route("**/motion-layer.js*", route => route.abort());
  page.on("dialog", (d) => d.accept());
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await installSeedProgram(page, { waitFor: waitForApp });
  if (theme !== "light") await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
  await page.waitForSelector("#startWorkout:not(.hidden)", { timeout: 5000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const cdp = await context.newCDPSession(page);
  const touch = (type, points = []) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  return { context, page, touch };
}

const center = async (page, sel) => {
  const b = await page.locator(sel).first().boundingBox();
  return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2), box: b };
};

/** The control's press state and the computed values a press changes. */
const pressState = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  const style = getComputedStyle(el);
  const m = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
  return {
    pressed: el.classList.contains("is-pressed"), pending: el.classList.contains("is-press-pending"),
    bg: style.backgroundColor, scale: Math.round(m.a * 1000) / 1000, transition: style.transitionDuration.split(",")[0].trim(),
    ease: style.transitionTimingFunction.split(/,(?![^(]*\))/)[0].trim(),
  };
}, sel);

/** The pressed tone token, resolved. Read before a gesture: it adds an element to the page. */
const pressedTone = (page) => page.evaluate(() => {
  const probe = document.createElement("div");
  probe.style.background = "var(--control-primary-pressed-bg)";
  document.body.append(probe);
  const tone = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return tone;
});

/**
 * Whether the control reaches the given press state. Chromium aligns touch and
 * mouse moves to the next frame, so the dispatch returns before the pointer
 * event runs; wait for the state rather than reading straight after the move.
 */
const reaches = (page, sel, pressed) => page.waitForFunction(([s, want]) =>
  document.querySelector(s).classList.contains("is-pressed") === want, [sel, pressed], { timeout: 2000 })
  .then(() => true, () => false);

const onToday = (page) => page.evaluate(() => document.querySelector("#log")?.classList.contains("active") &&
  !document.querySelector("#workout")?.classList.contains("is-focus"));

/* ---- Sheets (Plan 075 phase 2) ---- */

const SHEET_PROBE = `
window.__sheet = (sel) => {
  const el = document.querySelector(sel);
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return { hidden: el.hidden === true, open: el.classList.contains("is-open"), dragging: el.classList.contains("is-dragging"),
    inline: el.style.transform, y: Math.round(m.m42) };
};`;

/** A seeded app at 390×844 with a mouse, as the sheet suite drives it. */
async function sheetPage(browser, { reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion });
  const page = await context.newPage();
  await page.addInitScript(SHEET_PROBE);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await installSeedProgram(page, { waitFor: waitForApp });
  return { context, page };
}

/** A point on the sheet's drag rail: its head or its band. */
async function grip(page, sheet) {
  const box = await page.locator(`${sheet} .sheet__head, ${sheet} .sheetband`).first().boundingBox();
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}

/** A real pointer drag; `pause` between samples sets the release velocity. */
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

/**
 * A surface that has finished opening: nothing in it is running or about to run, it is fully opaque, and it is
 * drawn where and at the size it is laid out (an identity transform). Waiting only for "no running animation" let a
 * proof read a menu or sheet before its open animation had started, mid-scale (4 native-feel flakes, 2026-10-23).
 */
const surfaceAtRest = (page, sel, { timeout = 5000 } = {}) => page.waitForFunction((s) => {
  const el = document.querySelector(s);
  if (!el || el.getAnimations({ subtree: true }).some((run) => run.pending || run.playState === "running")) return false;
  const style = getComputedStyle(el), m = style.transform === "none" ? null : new DOMMatrixReadOnly(style.transform);
  const r = el.getBoundingClientRect();
  return Number(style.opacity) === 1 && (!m || m.isIdentity) && Math.abs(r.width - el.offsetWidth) < 0.5 && Math.abs(r.height - el.offsetHeight) < 0.5;
}, sel, { timeout });

const down = (to, n = 6) => Array.from({ length: n }, (_, i) => [0, Math.round((to * (i + 1)) / n)]);

/** The sheet is at rest: no transition or inline placement left. */
const sheetAtRest = (page, sel) => page.waitForFunction((s) => {
  const el = document.querySelector(s);
  return el.classList.contains("is-open") && !el.style.transform && !el.classList.contains("is-dragging")
    && el.getAnimations().length === 0;
}, sel, { timeout: 5000 });

/**
 * Detents (Plan 075 phase 2, ADR 0023). A long read-only sheet opens at the
 * medium detent, about half the screen; a drag up takes it to large, past which
 * it rubber-bands; a drag down from large returns it to medium; a fast flick
 * down from medium dismisses it. A sheet whose content fits under medium keeps
 * one rest. Driven on Privacy, whose text is longer than half a phone, and Why.
 */
async function detents(browser) {
  const { context, page } = await sheetPage(browser);
  const SHEET = "#privacySheet";
  const place = () => page.evaluate((s) => {
    const el = document.querySelector(s);
    const vvh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--vvh")) || innerHeight;
    return { ...window.__sheet(s), detent: el.dataset.detent || "", height: el.offsetHeight, medium: Math.round(el.offsetHeight - vvh * 0.52), vvh };
  }, SHEET);

  phase("a long read-only sheet opens at the medium detent");
  const before = await page.evaluate(() => ({ open: [...document.querySelectorAll(".sheet.is-open,dialog[open]")].map((el) => el.id),
    focus: document.querySelector("#workout")?.classList.contains("is-focus"), view: document.querySelector(".view.active")?.id }));
  await page.evaluate(() => window.openPrivacySheet());
  const opens = await page.waitForSelector(`${SHEET}.is-open`, { timeout: 3000 }).then(() => true, () => false);
  assert(opens, "Privacy opens", JSON.stringify(before));
  if (!opens) { await context.close(); return; }
  await sheetAtRest(page, SHEET);
  const opened = await place();
  assert(opened.medium > 60 && Math.abs(opened.y - opened.medium) <= 2,
    "Privacy opens with about half the screen showing", JSON.stringify(opened));

  phase("a drag up takes it to the large detent");
  const rail = await grip(page, SHEET);
  await drag(page, rail, [[0, -40], [0, -120], [0, -220], [0, -240], [0, -242]], { pause: 40, settleAt: 160 });
  await sheetAtRest(page, SHEET);
  const large = await place();
  assert(Math.abs(large.y) <= 1 && large.detent === "large", "released past halfway, it rests at large", JSON.stringify(large));

  phase("past the large detent it rubber-bands");
  const top = await grip(page, SHEET);
  await page.mouse.move(top.x, top.y);
  await page.mouse.down();
  for (const dy of [-30, -90, -150]) { await page.mouse.move(top.x, top.y + dy); await page.waitForTimeout(16); }
  const pulled = await place();
  await page.mouse.up();
  await sheetAtRest(page, SHEET);
  const back = await place();
  assert(pulled.y < -2 && pulled.y > -70, "it follows a pull upward, resisted to well under the thumb's 140px", JSON.stringify(pulled));
  assert(Math.abs(back.y) <= 1 && back.detent === "large", "and returns to large on release", JSON.stringify(back));

  phase("a drag down from large returns to medium, and a flick from medium dismisses");
  // Each slow drag ends on a near-still step, so its release carries no throw.
  await drag(page, await grip(page, SHEET), [...down(200, 8), [0, 202]], { pause: 40, settleAt: 160 });
  await sheetAtRest(page, SHEET);
  const medium = await place();
  assert(Math.abs(medium.y - medium.medium) <= 2 && medium.detent !== "large", "a slow drag down settles at medium", JSON.stringify(medium));
  await drag(page, await grip(page, SHEET), [[0, 20], [0, 60], [0, 62]], { pause: 40, settleAt: 160 });
  await sheetAtRest(page, SHEET);
  const kept = await place();
  assert(!kept.hidden && Math.abs(kept.y - kept.medium) <= 2, "a short push from medium springs back to medium", JSON.stringify(kept));
  await drag(page, await grip(page, SHEET), down(90, 3), { pause: 8 });
  await page.waitForSelector(SHEET, { state: "hidden", timeout: 5000 });
  assert(await page.evaluate((s) => document.querySelector(s).hidden, SHEET), "a fast flick down from medium dismisses");

  phase("a sheet whose content fits under medium has one rest");
  // The rest phase above leaves the workout open; start one only if it isn't.
  if (!(await page.evaluate(() => document.querySelector("#workout")?.classList.contains("is-focus")))) {
    await page.click('nav button[data-view="log"]');
    await page.click("#startWorkout");
    await page.waitForFunction(() => document.querySelector("#workout")?.classList.contains("is-focus"));
  }
  await page.evaluate(() => document.querySelector("dialog[open] .btn")?.click());
  await page.locator("#workout .exercise.is-current [data-why]").first().click();
  await sheetAtRest(page, "#whySheet");
  const why = await page.evaluate(() => ({ ...window.__sheet("#whySheet"), h: document.querySelector("#whySheet").offsetHeight }));
  assert(why.h < 844 * 0.52 && Math.abs(why.y) <= 1, "the short Why sheet rests at its content height", JSON.stringify(why));
  await drag(page, await grip(page, "#whySheet"), [[0, -40], [0, -120], [0, -160]], { pause: 40, settleAt: 160 });
  await sheetAtRest(page, "#whySheet");
  const whyUp = await page.evaluate(() => window.__sheet("#whySheet"));
  assert(Math.abs(whyUp.y) <= 1, "a drag up only rubber-bands and comes back", JSON.stringify(whyUp));
  await page.click("#whyClose");
  await page.waitForSelector("#whySheet", { state: "hidden" });
  await context.close();
}

/**
 * Under reduced motion a sheet doesn't travel: it cross-fades in place over
 * 160–180ms, opening and closing (audit F-18, ADR 0023 choice 11).
 */
async function reducedMotionSheets(browser) {
  const { context, page } = await sheetPage(browser, { reducedMotion: "reduce" });
  phase("under reduced motion a sheet cross-fades in place");
  const sample = (open) => page.evaluate((o) => new Promise((resolve) => {
    const el = document.querySelector("#programTextSheet");
    const frames = [];
    const t0 = performance.now();
    if (o) document.querySelector("#exportProgramText").click();
    else document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const tick = () => {
      const style = getComputedStyle(el);
      frames.push({ t: Math.round(performance.now() - t0), y: Math.round(new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform).m42),
        opacity: Number(style.opacity), hidden: el.hidden });
      if (performance.now() - t0 < 420) requestAnimationFrame(tick); else resolve(frames);
    };
    requestAnimationFrame(tick);
  }), open);
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#exportProgramText", { timeout: 10000 });
  const opening = await sample(true);
  const shown = opening.filter((f) => !f.hidden);
  const fading = shown.filter((f) => f.opacity > 0.02 && f.opacity < 0.98);
  assert(shown.length > 0 && shown.every((f) => Math.abs(f.y) <= 1), "it opens where it rests, with no travel", JSON.stringify(shown.slice(0, 6)));
  assert(fading.length >= 2 && shown.at(-1)?.opacity === 1, "it fades in over several frames", JSON.stringify(shown.slice(0, 8)));
  const fadeIn = (shown.find((f) => f.opacity === 1)?.t ?? 0) - (shown[0]?.t ?? 0);
  assert(fadeIn >= 120 && fadeIn <= 260, "the fade takes about 160–180ms", String(fadeIn));
  const closing = await sample(false);
  const leaving = closing.filter((f) => !f.hidden);
  assert(leaving.some((f) => f.opacity > 0.02 && f.opacity < 0.98) && leaving.every((f) => Math.abs(f.y) <= 1),
    "it fades out in place before it hides", JSON.stringify(leaving.slice(0, 8)));
  assert(closing.at(-1)?.hidden === true, "and then it is hidden", JSON.stringify(closing.at(-1)));
  await context.close();
}

/**
 * The day picker commits on tap (ADR 0023 choice 3): Today takes the day
 * without starting a workout, and Undo puts the old day back without asking,
 * because nothing was logged.
 */
async function dayPickerCommits(browser) {
  phase("the day picker commits on tap, and Undo restores the day");
  const { context, page } = await sheetPage(browser);
  const title = () => page.evaluate(() => document.querySelector("#woDayTitle")?.textContent?.trim() || "");
  const before = await title();
  await page.click("#chooseAnotherDay");
  await page.waitForSelector("#dayPickSheet.is-open");
  const exits = await page.evaluate(() => ({ confirm: !!document.querySelector("#dayPickConfirm"), cancel: !!document.querySelector("#dayPickCancel"),
    close: !!document.querySelector("#dayPickSheet [data-daypick-close]") }));
  assert(!exits.confirm && !exits.cancel && exits.close, "the picker's one exit is its ×", JSON.stringify(exits));
  await surfaceAtRest(page, "#dayPickSheet");
  const dayLook = await page.evaluate(() => [...document.querySelectorAll("#dayPickList .daypick__row")].map(row => ({ selected: row.classList.contains("is-selected"),
    check: Number(getComputedStyle(row.querySelector(".daypick__check")).opacity), rail: parseFloat(getComputedStyle(row).borderLeftWidth), fill: getComputedStyle(row).backgroundColor })));
  assert(dayLook.filter(row => row.selected).length === 1 && dayLook.every(row => row.check === (row.selected ? 1 : 0) && row.rail === 0)
    && new Set(dayLook.map(row => row.fill)).size === 1, "as in the prototype, the current day takes a trailing check, with no rail or well", JSON.stringify(dayLook));
  const measureDays = async () => (await page.evaluate(measureRenderedRoles, { components: [{ selector: "#dayPickList .daypick__row", roles: { control: "selection", boundary: "state-cues" } }],
    pixels: (await page.screenshot()).toString("base64") })).filter(item => item.kind === "state-cues");
  const dayCues = await measureDays();
  assert(dayCues.length === 1 && dayCues[0].status === "pass", "the checked day passes the checker on two cues, its check and its full-ink number", JSON.stringify(dayCues));
  const noCheck = await page.addStyleTag({ content: ".daypick__check{display:none!important}" });
  assert((await measureDays()).some(item => item.status === "fail"), "without its check the day is marked by colour alone, which the checker rejects");
  await noCheck.evaluate(el => el.remove());
  const target = await page.locator("#dayPickList [data-daypick]").nth(1).getAttribute("data-daypick");
  await page.locator("#dayPickList [data-daypick]").nth(1).click();
  await page.waitForSelector("#dayPickSheet", { state: "hidden" });
  const after = { title: await title(), focus: await page.evaluate(() => document.querySelector("#workout")?.classList.contains("is-focus") || false),
    toast: await page.locator(".daychange-toast").count() };
  assert(after.title === target && !after.focus && after.toast === 1, "a tap commits the day on Today, with an Undo toast and no workout", JSON.stringify({ before, target, after }));
  await page.click(".daychange-toast .review-toast__undo");
  const restored = await page.waitForFunction((d) => document.querySelector("#woDayTitle")?.textContent?.trim() === d, before, { timeout: 5000 })
    .then(() => true, () => false);
  const asked = await page.evaluate(() => document.querySelector("#draftDiscardSheet")?.classList.contains("is-open") || false);
  assert(restored && !asked, "Undo restores the previous day without a discard question", JSON.stringify({ restored, asked }));
  await context.close();
}

/** A page pushed from the Program editor's page sheet (the full library) is on top of it, not under it. */
async function libraryOverEditorSheet(browser) {
  phase("the library opened from the editor sheet is on top of it");
  const { context, page } = await sheetPage(browser);
  await page.click('nav button[data-view="program"]');
  await page.click("#programEditToggle");
  await page.waitForSelector("#program.sheet.is-open");
  await page.locator('#programEditor [data-role="add-exercise"]').first().click();
  await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
  await page.click("#exPickFull");
  await page.waitForSelector("#library.active", { timeout: 5000 });
  await page.waitForFunction(() => !document.body.classList.contains("is-pushing"));
  const top = await page.evaluate(() => {
    const back = document.querySelector("#libBack").getBoundingClientRect();
    const hit = document.elementFromPoint(back.left + back.width / 2, back.top + back.height / 2);
    return { back: !!hit?.closest("#libBack"), hit: hit?.id || hit?.className || hit?.tagName };
  });
  assert(top.back, "the library's Back is the control under the thumb", JSON.stringify(top));
  await page.click("#libBack");
  const returned = await page.waitForFunction(() => document.querySelector("#program")?.classList.contains("sheet")
    && document.querySelector("#program")?.classList.contains("active"), undefined, { timeout: 5000 }).then(() => true, () => false);
  assert(returned, "Back returns to the editor sheet");
  await context.close();
}

/* Phase 4 controls: real settings commits, draft commands and editor intents. */
async function nativeControls(browser) {
  const { context, page, touch } = await todayPage(browser);
  phase("Phase 4: the off switch has a light track and a required ring");
  await page.click('#openSettings');
  const track = await page.locator("#voiceToggle").evaluate(el => {
    const style = getComputedStyle(el, "::before");
    return { background: style.backgroundColor, ring: style.boxShadow,
      required: getComputedStyle(document.documentElement).getPropertyValue("--boundary-required").trim() };
  });
  assert(track.background !== "rgb(106, 102, 95)" && /1.5px/.test(track.ring), "off is a light track with a 1.5px boundary ring", JSON.stringify(track));
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    await page.locator("#voiceToggle").scrollIntoViewIfNeeded();
    await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
    const measureSwitch = async () => page.evaluate(measureRenderedRoles, { components: [{ selector: "#voiceToggle", roles: { control: "selection" } }], pixels: (await page.screenshot()).toString("base64") });
    const good = (await measureSwitch()).filter(item => item.selector.startsWith("#voiceToggle") && ["boundary", "state-mark"].includes(item.kind));
    assert(good.length > 0 && good.every(item => item.status === "pass"), `${theme}: the rendered-role checker accepts the off ring`, JSON.stringify(good));
    const broken = await page.addStyleTag({ content: "#voiceToggle::before{box-shadow:none!important}" });
    const noRing = (await measureSwitch()).filter(item => item.selector.startsWith("#voiceToggle") && item.kind === "boundary");
    assert(noRing.some(item => item.status === "fail"), `${theme}: removing the ring fails the actual rendered-role checker`, JSON.stringify(noRing));
    await broken.evaluate(el => el.remove());
    await page.locator("#themeSegments").scrollIntoViewIfNeeded();
    const measureSegments = async () => (await page.evaluate(measureRenderedRoles, { components: [
      { selector: "#themeSegments [role=radio]", roles: { control: "selection", boundary: "state-cues" } },
    ], pixels: (await page.screenshot()).toString("base64") })).filter(item => item.selector.startsWith("#themeSegments") && ["state-cues", "boundary"].includes(item.kind));
    const segmentCues = await measureSegments();
    assert(segmentCues.length === 1 && segmentCues[0].status === "pass" && segmentCues[0].cues.includes("fill") && segmentCues[0].cues.includes("weight"),
      `${theme}: the checked segment carries two state cues, the raised thumb and the heavier label`, JSON.stringify(segmentCues));
    for (const [css, description] of [
      ["#themeSegments .native-segments__thumb{display:none!important}", "removing the thumb leaves the weight alone, which"],
      ["#themeSegments [role=radio]{font-weight:var(--weight-regular)!important}", "dropping the heavier label leaves the thumb alone, which"],
      ["#themeSegments .native-segments__thumb{transform:translateX(80px)!important}", "moving the thumb off the checked option"],
    ]) {
      const damage = await page.addStyleTag({ content: css });
      const measured = await measureSegments();
      assert(measured.some(item => ["fail", "unsupported", "missing"].includes(item.status)), `${theme}: ${description} fails the real checker`, JSON.stringify(measured));
      await damage.evaluate(el => el.remove());
    }
    const checkedValue = await page.locator('#themeSegments [aria-checked="true"]').getAttribute("data-value");
    await page.locator('#themeSegments [role=radio]').evaluateAll(nodes => nodes.forEach(node => node.setAttribute("aria-checked", "false")));
    const unchecked = await measureSegments();
    assert(unchecked.some(item => item.status === "fail"), `${theme}: an unselected group fails the actual checker`, JSON.stringify(unchecked));
    await page.locator(`#themeSegments [data-value="${checkedValue}"]`).evaluate(node => node.setAttribute("aria-checked", "true"));
  }
  await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
  const segmented = page.locator('#themeSegments[role="radiogroup"]');
  const hasSegments = await segmented.count();
  assert(hasSegments === 1, "Appearance is a radiogroup");
  if (hasSegments) {
    await segmented.locator('[data-value="light"]').click();
    assert(await page.evaluate(() => JSON.parse(localStorage.getItem('repforge_ui_v1') || '{}').theme) === 'light', 'explicitly choosing the selected default records the device preference');
    await segmented.locator('[data-value="dark"]').click();
    assert(await page.locator('html').getAttribute('data-theme') === 'dark', "a tap applies Appearance immediately");
    await segmented.locator('[data-value="dark"]').focus();
    await page.keyboard.press('ArrowLeft');
    assert(await page.locator('html').getAttribute('data-theme') === 'light', "arrow keys select and apply Appearance");
    const start = await center(page, '#themeSegments [data-value="light"]');
    const end = await center(page, '#themeSegments [data-value="dark"]');
    await touch('touchStart', [{ x: start.x, y: start.y }]);
    await touch('touchMove', [{ x: end.x, y: end.y }]);
    await touch('touchEnd');
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    assert(await segmented.locator('[aria-checked="true"]').getAttribute('data-value') === 'dark', "dragging the thumb commits the segment under the finger");
    await page.locator('#unitSegments [data-value="lb"]').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('repforge_v1')).settings.unit === 'lb');
    await page.reload(); await waitForApp(page);
    await page.click('#openSettings');
    assert(await page.locator('#unitSegments [data-value="lb"]').getAttribute('aria-checked') === 'true', "Units persists and restores its selected segment");
    assert(await page.locator('#themeSegments [data-value="dark"]').getAttribute('aria-checked') === 'true', "Appearance restores from device UI preferences");
  }
  phase("Taste round 2: the segmented thumb is a raised paper thumb on a soft track");
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    const look = await page.locator('#themeSegments').evaluate(group => {
      const thumb = group.querySelector('.native-segments__thumb'), shadow = getComputedStyle(thumb).boxShadow;
      const insets = shadow.split(/,(?![^()]*\))/).filter(part => /inset/.test(part)).map(part => Math.max(...(part.match(/[\d.]+px/g) || ['0px']).map(parseFloat)));
      const surface = getComputedStyle(document.body).backgroundColor, track = getComputedStyle(group).backgroundColor;
      return { insets, drop: shadow.split(/,(?![^()]*\))/).some(part => !/inset/.test(part) && /px/.test(part)), track, surface,
        thumbFill: getComputedStyle(thumb).backgroundColor, groupEdge: getComputedStyle(group).borderTopColor, trackAlpha: Number((track.match(/rgba\([^)]*,\s*([\d.]+)\)/) || [0, 1])[1]) };
    });
    assert(look.insets.length === 0 && look.drop && look.groupEdge === 'rgba(0, 0, 0, 0)', `${theme}: as in the prototype, a shadow-only thumb on a borderless track`, JSON.stringify(look));
    assert(look.trackAlpha > 0 && look.trackAlpha < 0.15 && look.thumbFill !== look.track, `${theme}: the track is a soft ink tint under an opaque thumb`, JSON.stringify(look));
  }
  await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
  phase("Taste round 2: Rest timer reads as a row with its formatted value and a compact stepper");
  await page.locator('#restSecRow').scrollIntoViewIfNeeded();
  const restRow = await page.evaluate(() => {
    const value = document.querySelector('#restSecRow'), buttons = document.querySelectorAll('[data-step-input="restSec"]');
    const row = value.closest('.settings-row'), panel = document.querySelector('#restSecPanel');
    const top = el => Math.round(el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2);
    return { sameRow: !!row && [...buttons].every(button => row.contains(button) && Math.abs(top(button) - top(value)) <= 4),
      collapsed: !panel.classList.contains('is-open'), display: document.querySelector('#restSecDisplay').textContent.trim(),
      heights: [...buttons].map(button => Math.round(button.getBoundingClientRect().height)),
      reach: [...buttons].every(button => { const r = button.getBoundingClientRect(), x = r.left + r.width / 2;
        return document.elementFromPoint(x, r.top - 3) === button && document.elementFromPoint(x, r.bottom + 3) === button; }),
      visible: [...buttons].every(button => button.getBoundingClientRect().height > 0) };
  });
  assert(restRow.sameRow && restRow.collapsed && restRow.visible && restRow.display === '2:00' && restRow.heights.every(h => h === 36) && restRow.reach,
    'Rest timer shows 2:00 and its 36px − + capsule in one row, each button answering a 44px touch, with the typed field folded away', JSON.stringify(restRow));
  // A single activation (no pointer held, see the hold proof below for that path).
  await page.locator('[data-step-input="restSec"][data-step-delta="-1"]').evaluate((button) => button.click());
  const stepped = await page.waitForFunction(() => JSON.parse(localStorage.getItem('repforge_v1')).settings.restSec === 105 && document.querySelector('#restSecDisplay').textContent.trim() === '1:45', undefined, { timeout: 4000 }).then(() => true, () => false);
  assert(stepped, 'a step from the row commits and shows the formatted value', await page.locator('#restSecDisplay').textContent());
  phase("Phase 4: a stepper repeats while held and stops at its limit");
  await page.click('#restSecRow');
  await page.waitForFunction(() => {
    const panel = document.querySelector('#restSecPanel');
    return panel.classList.contains('is-open') && panel.style.height === '' && panel.style.overflow === '';
  });
  const shorter = page.locator('[data-step-input="restSec"][data-step-delta="-1"]');
  const hasStepper = await shorter.count();
  assert(hasStepper === 1, "Rest timer has a shorter button");
  if (hasStepper) {
    await page.locator('#restSec').fill('30'); await page.locator('#restSec').blur();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('repforge_v1')).settings.restSec === 30
      && document.querySelector('#restSec').value === '30'
      && !document.querySelector('[data-step-input="restSec"][data-step-delta="-1"]').disabled);
    await shorter.hover();
    await page.mouse.down();
    await page.waitForFunction(() => document.querySelector('#restSec').value === '0');
    await page.mouse.up();
    assert(await shorter.isDisabled(), "a hold repeats down to zero, then disables Shorter", await page.locator("#restSec").inputValue());
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('repforge_v1')).settings.restSec === 0);
    // One activation with no pointer held: a real pointer click on a loaded machine can last past the hold delay
    // and repeat, which is the hold working, not what this checks (that nothing kept repeating after release).
    await page.locator('[data-step-input="restSec"][data-step-delta="1"]').evaluate((button) => button.click());
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('repforge_v1')).settings.restSec === 15);
    assert(await page.locator('#restSec').inputValue() === '15', "a click after release makes exactly one step");
    await page.locator('#restSec').fill('30'); await page.locator('#restSec').blur();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('repforge_v1')).settings.restSec === 30
      && document.querySelector('#restSec').value === '30'
      && !document.querySelector('[data-step-input="restSec"][data-step-delta="-1"]').disabled);
    await shorter.focus();
    const keyboardStart = await shorter.evaluate(button => ({ disabled: button.disabled, focused: button === document.activeElement,
      value: document.querySelector('#restSec').value, stored: JSON.parse(localStorage.getItem('repforge_v1')).settings.restSec }));
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('repforge_v1')).settings.restSec === 15).catch(async error => {
      console.error('Rest keyboard boundary:', { before: keyboardStart, after: await shorter.evaluate(button => ({ disabled: button.disabled,
        focused: button === document.activeElement, value: document.querySelector('#restSec').value, stored: JSON.parse(localStorage.getItem('repforge_v1')).settings.restSec })) });
      throw error;
    });
    assert(await page.locator('#restSec').inputValue() === '15', 'the keyboard can still step after a held repeat');
  }
  await page.click('#progressionRow');
  const loadRow = await page.evaluate(() => {
    const value = document.querySelector('#minJumpRow'), row = value?.closest('.settings-row');
    const buttons = [...document.querySelectorAll('[data-step-input="minJump"]')];
    return { row: !!row, label: row?.querySelector('.settings-row__label')?.textContent.trim(), name: window.RepForgeI18n.t('program.editor.load_step'),
      display: document.querySelector('#minJumpRow')?.textContent.replace(/\s+/g, ' ').trim(), buttonsInRow: buttons.length === 2 && buttons.every(button => row?.contains(button) && button.getBoundingClientRect().height === 36),
      folded: !document.querySelector('#minJumpPanel')?.classList.contains('is-open') };
  });
  assert(loadRow.row && loadRow.label === loadRow.name && loadRow.display === '2.5 kg' && loadRow.buttonsInRow && loadRow.folded,
    'Smallest load change reads as one row: its label, "2.5 kg" and the − + capsule, with the typed field folded away', JSON.stringify(loadRow));
  await page.click('#minJumpRow');
  await page.waitForFunction(() => document.querySelector('#minJumpPanel').classList.contains('is-open') && document.querySelector('#minJumpRow').getAttribute('aria-expanded') === 'true');
  await page.locator('#minJump').fill('12'); await page.locator('#minJump').dispatchEvent('change');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('repforge_v1')).settings.minJump === 12);
  await page.locator('[data-step-input="minJump"][data-step-delta="-1"]').evaluate((button) => button.click());
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('repforge_v1')).settings.minJump !== 12, undefined, { timeout: 4000 }).catch(() => {});
  assert(Number(await page.locator('#minJump').inputValue()) === 11.5, "a typed value above the stepped range decreases by one step without being clamped", await page.locator('#minJump').inputValue());
  await page.locator('#themeSegments [data-value="light"]').click();
  phase("Phase 4: Today offers the same actions visibly and through context gestures");
  await page.click('#settingsBack');
  await page.waitForFunction(() => !document.body.classList.contains('is-pushing') && document.querySelector('nav .dock-lens'));
  const measureDock = async () => (await page.evaluate(measureRenderedRoles, { components: [{ selector: "nav button[data-view]", roles: { control: "quiet-navigation", boundary: "state-cues" } }],
    pixels: (await page.screenshot()).toString("base64") })).filter(item => item.kind === "state-cues");
  const dockLook = await page.evaluate(() => { const active = document.querySelector('nav button.active');
    return { edge: getComputedStyle(active).borderTopColor, ring: getComputedStyle(document.querySelector('nav .dock-lens'), '::after').display }; });
  const dockCues = await measureDock();
  assert(dockLook.edge === 'rgba(0, 0, 0, 0)' && dockLook.ring === 'none' && dockCues.length === 1 && dockCues[0].status === 'pass',
    "the dock's selected tab is the prototype's filled lens with no ring, and passes on the lens and its orange icon and label", JSON.stringify({ dockLook, dockCues }));
  const noLens = await page.addStyleTag({ content: "nav .dock-lens{background:transparent!important}" });
  assert((await measureDock()).some(item => item.status === 'fail'), "without the lens the tab is marked by colour alone, which the checker rejects");
  await noLens.evaluate(el => el.remove());
  const row = '#todayExList [data-context-row]';
  const hasRows = await page.locator(row).count();
  assert(hasRows > 0 && await page.locator('#todayExList [data-row-menu]').count() > 0, "Today rows keep an actions button for keyboard and assistive technology");
  const quiet = await page.evaluate(() => {
    const button = document.querySelector('#todayExList [data-row-menu]'), open = button.closest('[data-context-row]').querySelector('[data-exopen]');
    const grid = document.querySelector('#todayExList .today-rx__grid').getBoundingClientRect();
    return { width: Math.round(button.getBoundingClientRect().width), tabbable: button.tabIndex === 0 && !button.closest('[aria-hidden="true"],[inert]'),
      rowReach: Math.round(grid.right - open.getBoundingClientRect().right) };
  });
  assert(quiet.width <= 1 && quiet.tabbable && quiet.rowReach <= 1, 'the ⋯ column is gone from sight: the row runs to the edge, and the button stays in the tab order', JSON.stringify(quiet));
  await page.locator('#todayExList [data-exopen]').first().focus(); await page.keyboard.press('Tab');
  const revealed = await page.evaluate(() => { const el = document.activeElement; return { menu: el?.matches('[data-row-menu]'), width: Math.round(el?.getBoundingClientRect().width || 0) }; });
  assert(revealed.menu && revealed.width >= 44, 'Tab from a row reaches its ⋯, which shows itself while focused', JSON.stringify(revealed));
  if (hasRows) {
    const initialOpacity = await page.locator('#todayExList [data-row-menu]').first().evaluate(button => {
      button.focus(); button.click();
      return getComputedStyle(document.querySelector('.native-context__menu')).opacity;
    });
    assert(initialOpacity === '0', 'the context menu starts transparent before its first animation frame', initialOpacity);
    await page.waitForSelector('#nativeContextMenu:not([hidden])');
    phase("Fidelity: the Today menu matches the prototype's material, icons and wording");
    await surfaceAtRest(page, ".native-context__menu");
    const menuLook = await page.evaluate(() => {
      const panel = document.querySelector('.native-context__menu'), style = getComputedStyle(panel), dialog = document.querySelector('#nativeContextMenu');
      const items = [...panel.querySelectorAll('[role="menuitem"]')].map(item => ({ value: item.dataset.menuValue, label: item.textContent.trim(),
        icon: [...(item.querySelector('.icon-mask')?.classList || [])].find(name => name.startsWith('icon-mask--')) || null, target: item.getBoundingClientRect().height, height: Math.round(item.getBoundingClientRect().height - parseFloat(getComputedStyle(item).borderTopWidth)) }));
      const backdrop = getComputedStyle(dialog, '::backdrop').backgroundColor, alpha = Number((backdrop.match(/rgba\([^)]*,\s*([\d.]+)\)/) || [0, 1])[1]);
      return { border: ['Top', 'Right', 'Bottom', 'Left'].map(side => parseFloat(style[`border${side}Width`])), items, backdrop, alpha,
        swap: window.RepForgeI18n.t('picker.title_substitute') };
    });
    assert(menuLook.border.every(width => width === 0), 'the menu has no hard border; its edge is a soft hairline shadow', JSON.stringify(menuLook.border));
    assert(JSON.stringify(menuLook.items.map(item => [item.value, item.icon])) === JSON.stringify([["why", "icon-mask--target"], ["swap", "icon-mask--reset"], ["details", "icon-mask--dumbbell"], ["skip", "icon-mask--close"]]),
      "each Today action carries the prototype's trailing icon", JSON.stringify(menuLook.items));
    assert(menuLook.items[1].label === menuLook.swap && menuLook.items.every(item => item.target >= 44 && item.height >= 40 && item.height <= 48), 'Swap exercise uses the prototype wording, in 44px rows', JSON.stringify(menuLook.items));
    assert(menuLook.alpha > 0 && menuLook.alpha <= 0.3, 'the page behind stays light: a 25% paper wash under the blur, not a dark scrim', menuLook.backdrop);
    await surfaceAtRest(page, ".native-context__menu");
    await page.evaluate(() => {
      const probe = document.createElement('h2'); probe.id = 'nativeContextClipProbe'; probe.textContent = 'Menu probe';
      probe.style.cssText = 'position:fixed;left:20px;top:20px;width:1px;white-space:nowrap;overflow:hidden';
      document.body.append(probe);
    });
    const probeErrors = async () => validateCatalogEvidence(await page.evaluate(collectCatalogEvidence), {}).filter(error => error.includes('#nativeContextClipProbe'));
    assert((await probeErrors()).length === 0, 'catalog geometry excludes content made inert by the native modal');
    await page.evaluate(() => document.querySelector('#nativeContextMenu').append(document.querySelector('#nativeContextClipProbe')));
    assert((await probeErrors()).some(error => error.includes('clipped')), 'the same clipped heading inside the live menu fails the actual catalog validator');
    await page.evaluate(() => { document.querySelector('#nativeContextClipProbe').style.width = '240px'; document.querySelector('#nativeContextClipProbe').style.overflow = 'visible'; });
    assert((await probeErrors()).length === 0, 'repairing the live heading passes its catalog geometry proof');
    await page.evaluate(() => document.querySelector('#nativeContextClipProbe').remove());
    const menuInk = (await page.evaluate(measureRenderedRoles, {
      components: [], pixels: (await page.screenshot()).toString('base64')
    })).filter(item => item.kind === 'text');
    assert(menuInk.length > 0 && menuInk.every(item => ['pass', 'exempt'].includes(item.status)), 'context menu text meets contrast on its rendered glass background', JSON.stringify(menuInk.filter(item => item.status !== 'pass')));
    await page.locator('#nativeContextMenu [data-menu-value="skip"]').evaluate(el => { el.style.color = 'rgb(232,229,223)'; });
    const faintMenuInk = (await page.evaluate(measureRenderedRoles, { components: [], pixels: (await page.screenshot()).toString('base64') })).filter(item => item.kind === 'text');
    assert(faintMenuInk.some(item => item.status === 'fail' && item.ratio < 4.5), 'the same rendered-role checker rejects low-contrast text inside the glass menu');
    await page.locator('#nativeContextMenu [data-menu-value="skip"]').evaluate(el => el.style.removeProperty('color'));

    await page.keyboard.press('Escape');
    await page.waitForSelector("#nativeContextMenu", { state: "detached" });
    assert(await page.locator('#todayExList [data-row-menu]').first().evaluate(el => el === document.activeElement), "Escape restores the visible opener");
    await page.locator(row).first().click({ button: 'right' });
    await page.waitForSelector('#nativeContextMenu:not([hidden])');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#nativeContextMenu', { state: 'detached' });
    await page.locator(row).first().focus(); await page.keyboard.press('Shift+F10');
    await page.waitForSelector('#nativeContextMenu:not([hidden])');
    const keyRing = await page.evaluate(() => { const el = document.activeElement, style = getComputedStyle(el);
      return { item: el.matches('[role="menuitem"]'), outline: style.outlineStyle, width: style.outlineWidth, quiet: el.hasAttribute('data-quiet-focus') }; });
    assert(keyRing.item && keyRing.outline !== 'none' && keyRing.width !== '0px' && !keyRing.quiet, 'opened from the keyboard, the first item shows the focus ring', JSON.stringify(keyRing));
    assert(await page.locator('#nativeContextMenu [role="menuitem"]').count() >= 2, "right click and Shift+F10 expose row actions");
    await page.keyboard.press('Escape');
    await page.waitForSelector('#nativeContextMenu', { state: 'detached' });
    phase("Focus rings follow the keyboard: a touch never leaves one on the row, the ⋯ or the first item");
    const ringOf = () => page.evaluate(() => { const el = document.activeElement, style = getComputedStyle(el);
      return { tag: el.tagName, item: el.matches('[role="menuitem"]'), inRow: !!el.closest('[data-context-row]'), ring: style.outlineStyle !== 'none' && style.outlineWidth !== '0px', quiet: el.hasAttribute('data-quiet-focus'),
        revealed: el.matches('[data-row-menu]') && el.getBoundingClientRect().width > 1 }; });
    await page.locator(row).first().scrollIntoViewIfNeeded();
    const held = await center(page, row);
    await touch('touchStart', [{ x: held.x, y: held.y }]);
    await page.waitForSelector('#nativeContextMenu:not([hidden])');
    await touch('touchEnd');
    const touchOpen = await ringOf();
    // Chromium already hides a ring on script focus after touch; iOS Safari does not, so the quiet mark is what keeps it off there.
    assert(touchOpen.item && !touchOpen.ring && touchOpen.quiet, 'after a touch-and-hold the first item takes focus for assistive technology without a ring', JSON.stringify(touchOpen));
    await page.mouse.click(4, 4);
    await page.waitForSelector('#nativeContextMenu', { state: 'detached' });
    const touchClose = await ringOf();
    assert(touchClose.inRow && !touchClose.ring && touchClose.quiet && !touchClose.revealed, 'closing it by touch returns focus to the row with no ring and no revealed ⋯', JSON.stringify(touchClose));
    await page.locator(row).first().scrollIntoViewIfNeeded();
    const p = await center(page, row);
    await touch('touchStart', [{ x: p.x, y: p.y }]);
    await page.waitForSelector('#nativeContextMenu:not([hidden])');
    const item = await center(page, '#nativeContextMenu [data-menu-value="skip"]');
    await touch('touchMove', [{ x: item.x, y: item.y }]); await touch('touchEnd');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('repforge_draft_v1'))?.exerciseOrder?.some(id => JSON.parse(localStorage.getItem('repforge_draft_v1')).exercises[id].status === 'skipped'));
    assert(await onToday(page), "long press and slide-to-select skips only in today's draft, without starting Focus");
    // The skip opens today's session, so Today reads it through the live card's rows (option A): "Skipped today".
    const skippedText = await page.evaluate(() => window.RepForgeI18n.t('today.live.skipped'));
    assert(await page.locator('#todayExList .is-skipped .rxrow__sub').count() === 1 && await page.locator('#todayExList .is-skipped .rxrow__sub').textContent() === skippedText, 'the skipped Today row visibly acknowledges the draft command');
    await page.reload(); await waitForApp(page);
    if (await page.locator('#leaveWorkout').isVisible()) await page.click('#leaveWorkout');
    await page.waitForSelector('#todayDash:not(.hidden)');
    assert(await page.locator('#todayExList .is-skipped').count() === 1, 'the skipped Today state restores after reload');
    await keyboardMenu(page.locator('#todayExList [data-row-menu]').first());
    await page.locator('#nativeContextMenu [data-menu-value="restore"]').click();
    await page.waitForSelector('#nativeContextMenu', { state: 'detached' });
    const restored = await page.waitForFunction(() => {
      const draft = JSON.parse(localStorage.getItem('repforge_draft_v1'));
      return draft && draft.exerciseOrder.every(id => draft.exercises[id].status !== 'skipped') && !document.querySelector('#todayExList .is-skipped');
    }, undefined, { timeout: 4000 }).then(() => true, () => false);
    assert(restored, "Restore reverses the skip in today's draft");
    assert(await page.locator('#todayExList [data-row-menu]').first().evaluate(el => el === document.activeElement), 'a row action restores its visible opener after Today redraws');
    const programBefore = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('repforge_v1')).program));
    await keyboardMenu(page.locator('#todayExList [data-row-menu]').first());
    await page.locator('#nativeContextMenu [data-menu-value="swap"]').click();
    await page.waitForSelector('#exPickSheet.is-open');
    await page.fill('#exPickSearch', 'Leg press');
    const pick = page.locator('#exPickList [data-pick]').first();
    const replacementName = await pick.locator('.pickrow__name').textContent();
    await pick.click();
    await page.waitForSelector('#exPickSheet.is-reason-step');
    await page.click('#exPickReasonSkip');
    await page.waitForSelector('#exPickSheet', { state: 'hidden' });
    assert((await page.locator('#todayExList .rxrow__name').first().textContent()).includes(replacementName), 'Today shows the replacement chosen through its context menu');
    assert(await page.locator('#todayExList [data-row-menu]').first().evaluate(el => el === document.activeElement), 'the swap picker returns focus to the rebuilt Today row');
    assert(await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('repforge_v1')).program)) === programBefore, 'Today actions preserve the durable program');
    const primary = await page.locator('#todayExList [data-context-row]').first().evaluate(row => {
      const open = row.querySelector('[data-exopen]'), name = open.querySelector('.rxrow__name').firstChild.textContent;
      return { first: row.firstElementChild === open, tag: open.tagName, id: open.dataset.exopen, named: open.getAttribute('aria-label') === window.RepForgeI18n.t('log.open_exercise_aria', { name }),
        menuNext: open.nextElementSibling?.matches('[data-row-menu]') && open.nextElementSibling === row.lastElementChild };
    });
    assert(primary.first && primary.tag === 'BUTTON' && primary.named && primary.menuNext, "the row's primary target is still the named exercise button, before its actions button in focus order", JSON.stringify(primary));
    await page.locator('#todayExList [data-exopen]').first().click();
    await page.waitForSelector('#exercise.view.active');
    assert(await page.evaluate(() => document.body.classList.contains('is-exercise')), 'tapping the Today row still opens its exercise');
    await page.click('#exBack'); await page.waitForSelector('#todayDash:not(.hidden)');


  }
  phase("Phase 4: Focus more opens an action sheet with Cancel and guarded End");
  // The skip above opened today's draft, so Today may be resuming it from the live card rather than offering Start.
  await page.locator('#todayLiveResume, #startWorkout:not(.hidden)').first().click();
  await page.waitForFunction(() => document.querySelector('#workout').classList.contains('is-focus'));
  await page.click('#woOverflowBtn');
  const hasAction = await page.locator('#workoutActionSheet:not([hidden])').count();
  assert(hasAction === 1, "Focus more opens the action sheet");
  if (hasAction) {
    await page.click('#workoutActionCancel');
    await page.waitForSelector('#workoutActionSheet', { state: 'hidden' });
    assert(await page.evaluate(() => !!localStorage.getItem('repforge_draft_v1')), "Cancel keeps the draft");
    await page.click('#woOverflowBtn');
    const reopened = await page.waitForFunction(() => {
      const sheet = document.querySelector('#workoutActionSheet'), button = sheet.querySelector('[data-workout-action="abandon"]');
      const r = button.getBoundingClientRect();
      return sheet.classList.contains('is-open') && r.top >= 0 && r.bottom <= innerHeight;
    }, undefined, { timeout: 4000 }).then(() => true, () => false);
    assert(reopened, 'the Focus action sheet reopens with its actions inside the viewport', await page.locator('#workoutActionSheet').evaluate(sheet => JSON.stringify({
      style: sheet.getAttribute('style'), computed: getComputedStyle(sheet).transform, rect: sheet.getBoundingClientRect().toJSON(),
      animations: sheet.getAnimations().map(run => ({ playState: run.playState, currentTime: run.currentTime, frames: run.effect.getKeyframes() }))
    })));
    await page.click('[data-workout-action="abandon"]');
    await page.waitForSelector('#sessionAbandonPrompt:not(.hidden)');
    assert(await page.evaluate(() => !!localStorage.getItem('repforge_draft_v1')), "End without saving first asks for confirmation");
    await page.click('#sessionAbandonCancel');
    assert(await page.evaluate(() => !!localStorage.getItem('repforge_draft_v1')), "Keep training keeps the draft");
    await page.waitForSelector('#sessionSheet', { state: 'hidden' });
    assert(await page.locator('#workoutShell').isVisible(), 'Keep training returns directly to Focus');
    await page.click('#woOverflowBtn'); await page.click('[data-workout-action="abandon"]');
    await page.waitForSelector('#sessionAbandonPrompt:not(.hidden)');
    await page.keyboard.press('Escape'); await page.waitForSelector('#sessionSheet', { state: 'hidden' });
    await page.click('#sessionSheetBtn'); await page.waitForSelector('#sessionSheet.is-open');
    await page.click('#sessionAbandon'); await page.click('#sessionAbandonCancel');
    assert(await page.locator('#sessionSheet').isVisible() && await page.locator('#sessionAbandon').evaluate(el => el === document.activeElement),
      "an action-sheet End dismissed another way leaves the session sheet's own Cancel in the sheet");
    phase("Session details: the date fits the sheet and shows its value, a tap leaves no ring, and reorder is borderless");
    for (const width of [375, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const fit = await page.locator('#sessionDate').evaluate(input => {
        // Session details as a hub (#522): the date is a value row in the sheet's body.
        const body = input.closest('.session-sheet__body'), box = body.getBoundingClientRect(), style = getComputedStyle(body);
        return { right: input.getBoundingClientRect().right, limit: box.right - parseFloat(style.paddingRight), value: input.value };
      });
      assert(fit.right <= fit.limit + 0.5 && fit.value !== '', `at ${width}px the date field ends inside the sheet's content and holds the session's date`, JSON.stringify(fit));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#sessionDate').scrollIntoViewIfNeeded();
    await page.locator('#sessionDate').click({ position: { x: 8, y: 8 } });
    const ringOf = () => page.locator('#sessionDate').evaluate(input => { const style = getComputedStyle(input);
      return { focused: input === document.activeElement, outline: style.outlineStyle !== 'none' && style.outlineWidth !== '0px', halo: style.boxShadow !== 'none', quiet: input.hasAttribute('data-quiet-focus') }; });
    const tapped = await ringOf();
    assert(tapped.focused && !tapped.outline && !tapped.halo && tapped.quiet, 'a tap on the date field focuses it with no ring', JSON.stringify(tapped));
    await page.keyboard.press('ArrowUp');
    const keyed = await ringOf();
    assert(keyed.focused && keyed.outline && !keyed.quiet, 'the first key press gives it the keyboard ring', JSON.stringify(keyed));
    const reorder = await page.locator('#sessionSheet .session-map__grip').first().evaluate(button => { const style = getComputedStyle(button), r = button.getBoundingClientRect();
      return { border: parseFloat(style.borderTopWidth) === 0 || style.borderTopColor === 'rgba(0, 0, 0, 0)', fill: style.backgroundColor, grip: !!button.querySelector('.icon-mask--grip'), w: r.width, h: r.height,
        upDown: document.querySelectorAll('#sessionSheet [data-session-reorder-up], #sessionSheet [data-session-reorder-down]').length }; });
    assert(reorder.border && reorder.fill === 'rgba(0, 0, 0, 0)' && reorder.grip && reorder.w >= 44 && reorder.h >= 44 && reorder.upDown === 0,
      'the session map reorders with a borderless 44px grip, as the editor and the kit do, and no up/down buttons', JSON.stringify(reorder));
    await page.click('#sessionSheetClose'); await page.waitForSelector('#sessionSheet', { state: 'hidden' });
    phase("Session details sits on the bottom edge after a typed entry, even when the viewport still reports the keyboard");
    // iOS can report the shrunken visual viewport for a while after the keyboard goes; no field is being edited.
    await page.evaluate(() => { document.activeElement?.blur?.();
      Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => innerHeight - 300 });
      visualViewport.dispatchEvent(new Event('resize')); });
    await page.click('#sessionSheetBtn'); await page.waitForSelector('#sessionSheet.is-open');
    await surfaceAtRest(page, "#sessionSheet");
    const seat = await page.evaluate(() => ({ bottom: Math.round(document.querySelector('#sessionSheet').getBoundingClientRect().bottom), viewport: innerHeight,
      kb: getComputedStyle(document.documentElement).getPropertyValue('--kb').trim() }));
    await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
    assert(seat.bottom === seat.viewport, "the sheet's bottom is the viewport's bottom: a stale keyboard band moves no sheet while nothing is being typed", JSON.stringify(seat));
    await page.click('#sessionSheetClose'); await page.waitForSelector('#sessionSheet', { state: 'hidden' });
    await page.click('#woOverflowBtn'); await page.click('[data-workout-action="abandon"]');
    await page.click('#sessionAbandonConfirm');
    await page.waitForFunction(() => !localStorage.getItem('repforge_draft_v1'));
    await page.waitForSelector("#todayDash:not(.hidden)");
    assert(await page.locator("#todayDash").isVisible() && await page.locator("#workoutShell").isHidden(), "confirmed End clears the draft and returns to Today");
    await page.click('#startWorkout');
    await page.waitForFunction(() => document.querySelector('#workout').classList.contains('is-focus'));
    await page.evaluate(() => { document.querySelector('#toast').textContent = ''; });
    await page.click('#woOverflowBtn'); await page.click('[data-workout-action="finish"]');
    const refusals = await page.evaluate(() => ['toast.enter_weight_before_save', 'toast.finish_incomplete'].map(key => window.RepForgeI18n.t(key)));
    const refused = await page.waitForFunction(texts => texts.includes(document.querySelector('#toast').textContent.trim()), refusals, { timeout: 4000 }).then(() => true, () => false);
    assert(refused && await page.evaluate(() => !!window.__repforgeWorkoutDraft.current()), 'Finish runs the save path itself: an untouched session gets its refusal and keeps the draft',
      await page.locator('#toast').textContent());
  }
  await context.close();
}

/** The row's ⋯ is shown only to keyboard focus, so tests reach it the way a keyboard does. */
async function keyboardMenu(button) { await button.focus(); await button.press('Enter'); }

async function nativeEditorControls(browser) {
  const { context: editorContext, page: editorPage } = await todayPage(browser);
  phase("Phase 4: editor rows expose context actions without long press");
  await editorPage.click('nav button[data-view="program"]'); await editorPage.click('#programEditToggle');
  await editorPage.waitForSelector('#programEditor [data-role="exercise-row"]');
  const editorMenu = editorPage.locator('#programEditor [data-row-menu]').first();
  assert(await editorMenu.count() === 1, "editor exercise has a visible actions button");
  if (await editorMenu.count()) {
    const rows = editorPage.locator('#programEditor [data-role="exercise-row"]');
    const first = await rows.first().getAttribute('data-id');
    await keyboardMenu(editorMenu); await editorPage.waitForSelector('#nativeContextMenu:not([hidden])');
    await editorPage.locator('#nativeContextMenu [data-menu-value="down"]').click();
    await editorPage.waitForFunction(id => document.querySelector('#programEditor [data-role="exercise-row"]').dataset.id !== id, first);
    assert(await rows.nth(1).getAttribute('data-id') === first, "Move down commits through the editor and preserves identity");
    await rows.nth(1).focus(); await editorPage.keyboard.press('Shift+F10');
    await editorPage.waitForSelector('#nativeContextMenu:not([hidden])'); await editorPage.keyboard.press('Escape');
    await editorPage.waitForSelector('#nativeContextMenu', { state: 'detached' });
    assert(await rows.nth(1).evaluate(el => el === document.activeElement), "keyboard context menu returns focus to its editor row");
    await keyboardMenu(editorPage.locator('#programEditor [data-row-menu]').nth(1)); await editorPage.waitForSelector('#nativeContextMenu:not([hidden])');
    const editorItems = await editorPage.locator('#nativeContextMenu [role="menuitem"]').evaluateAll(items => items.map(item => item.dataset.menuValue));
    assert(JSON.stringify(editorItems) === JSON.stringify(["up", "down", "day", "remove"]), "the editor menu holds the prototype's Move up, Move down, Move to another day and Remove", JSON.stringify(editorItems));
    await editorPage.locator('#nativeContextMenu [data-menu-value="day"]').click();
    await editorPage.waitForSelector('#reviewSheet.is-open');
    const onDays = await editorPage.waitForFunction(id => document.activeElement?.matches(`#reviewSheet [data-role="move-to-day"][data-id="${CSS.escape(id)}"]`), first, { timeout: 4000 }).then(() => true, () => false);
    assert(onDays, "Move to another day opens that exercise's page on its day choices");
    await editorPage.locator('#reviewSheet [data-role="sheet-done"]').click();
    await editorPage.waitForSelector('#reviewSheet', { state: 'hidden' });
  }
  phase("Phase 4: smallest load change and alternate context actions keep the editor's commit boundary");
  await editorPage.locator('#programEditor [data-role="exercise-row"]').first().click();
  await editorPage.waitForSelector('#reviewSheet.is-open [data-role="load-step-open"]');
  const stepRow = await editorPage.evaluate(() => {
    const open = document.querySelector('#reviewSheet [data-role="load-step-open"]'), row = open.closest('.program-editor__stepper-row');
    const field = document.querySelector('#reviewSheet [data-role="load-step"]');
    return { value: open.textContent.replace(/\s+/g, ' ').trim(), folded: open.getAttribute('aria-expanded') === 'false' && !field.checkVisibility(),
      buttons: [...row.querySelectorAll('[data-step-delta]')].map(button => Math.round(button.getBoundingClientRect().height)) };
  });
  assert(/^2[.,]5 kg$/.test(stepRow.value) && stepRow.folded && stepRow.buttons.join() === '36,36',
    "the editor's Smallest load change reads as the prototype's row: 2.5 kg and the − + capsule, with the typed field folded", JSON.stringify(stepRow));
  await editorPage.locator('#reviewSheet [data-role="load-step-open"]').click();
  const typed = await editorPage.waitForFunction(() => document.activeElement?.matches('#reviewSheet [data-role="load-step"]')
    && document.querySelector('#reviewSheet [data-role="load-step-open"]').getAttribute('aria-expanded') === 'true', undefined, { timeout: 4000 }).then(() => true, () => false);
  assert(typed, 'tapping the value opens the typed field, focused for typing');
  const loadStep = editorPage.locator('#reviewSheet [data-role="load-step"]');
  const beforeStep = Number((await loadStep.inputValue()).replace(',', '.'));
  const larger = editorPage.locator('#reviewSheet [data-step-input="load-step"][data-step-delta="1"]');
  assert(await larger.count() === 1, "smallest load change has a visible Larger step control");
  let committedStep = beforeStep + .5;
  if (await larger.count()) {
    await larger.click();
    await editorPage.waitForFunction(value => Number(document.querySelector('#reviewSheet [data-role="load-step"]').value.replace(',', '.')) === value, beforeStep + .5);
    assert(Number((await loadStep.inputValue()).replace(',', '.')) === beforeStep + .5, "Larger step changes the displayed value by 0.5 through the typed field");
    assert(Number((await editorPage.locator('#reviewSheet [data-role="load-step-value"]').textContent()).replace(',', '.')) === beforeStep + .5, 'the row shows the stepped value at once');
    await larger.hover(); await editorPage.mouse.down();
    const repeated = await editorPage.waitForFunction(value => Number(document.querySelector('#reviewSheet [data-role="load-step"]').value.replace(',', '.')) >= value,
      beforeStep + 2, { timeout: 3500 }).then(() => true, () => false);
    await editorPage.mouse.up();
    assert(repeated, "the editor stepper keeps repeating through recorded edits");
    const releasedValue = await loadStep.inputValue();
    const stableAfterRelease = await loadStep.evaluate(input => new Promise(resolve => {
      const value = input.value, start = performance.now();
      const frame = () => input.value !== value ? resolve(false) : performance.now() - start >= 250 ? resolve(true) : requestAnimationFrame(frame);
      requestAnimationFrame(frame);
    }));
    assert(stableAfterRelease, "releasing the editor stepper stops its repeat");
    const smaller = editorPage.locator('#reviewSheet [data-step-input="load-step"][data-step-delta="-1"]');
    await smaller.focus(); await editorPage.keyboard.press('Enter');
    await editorPage.waitForFunction(value => Number(document.querySelector('#reviewSheet [data-role="load-step"]').value.replace(',', '.')) === value, Number(releasedValue.replace(',', '.')) - .5);
    assert(await smaller.evaluate(button => button === document.activeElement), "a recorded editor increment retains keyboard button focus");
    await editorPage.keyboard.press('Enter');
    committedStep = Number(releasedValue.replace(',', '.')) - 1;
    const successive = await editorPage.waitForFunction(value => Number(document.querySelector('#reviewSheet [data-role="load-step"]').value.replace(',', '.')) === value,
      committedStep, { timeout: 1500 }).then(() => true, () => false);
    assert(successive, "the editor accepts successive keyboard increments without refocusing");
  }
  await editorPage.locator('#reviewSheet [data-role="add-alternate"]').click();
  await editorPage.waitForSelector('#exPickSheet.is-open');
  await editorPage.fill('#exPickSearch', 'Leg press');
  await editorPage.locator('#exPickList [data-pick]').first().click();
  await editorPage.waitForSelector('#reviewSheet.is-open [data-role="alternate"]');
  const alternate = editorPage.locator('#reviewSheet [data-role="alternate"]').first();
  assert(await alternate.locator('[data-row-menu]').count() === 1 && await alternate.locator('[data-role="alternate-remove"]').count() === 0,
    "the alternate replaces its action trio with one visible menu");
  const glyph = await alternate.locator('[data-row-menu]').evaluate(button => ({ text: button.textContent.trim(), icon: !!button.querySelector('.icon-mask--overflow') }));
  assert(glyph.text === '' && glyph.icon, "an alternate's ⋯ is the overflow icon, not a spaced text glyph", JSON.stringify(glyph));
  const close = await editorPage.locator('#reviewSheet [data-review-sheet-close]').evaluate(button => { const disc = getComputedStyle(button, '::before');
    return { width: disc.width, radius: disc.borderRadius, fill: disc.backgroundColor }; });
  assert(close.width === '30px' && close.radius === '50%' && close.fill !== 'rgba(0, 0, 0, 0)', "a sheet's × sits in the prototype's filled 30px disc", JSON.stringify(close));
  if (await alternate.locator('[data-row-menu]').count()) {
    await alternate.locator('[data-row-menu]').click();
    await editorPage.locator('#nativeContextMenu [data-menu-value="remove"]').click();
    await editorPage.waitForSelector('#reviewSheet [data-role="alternate"]', { state: 'hidden' });
    assert(await editorPage.locator('#reviewSheet.is-open').count() === 1, "removing an alternate leaves its editor sheet open");
    await editorPage.locator('#reviewSheet [data-role="sheet-done"]').click();
    await editorPage.waitForSelector('#reviewSheet', { state: 'hidden' });
    await editorPage.click('#programEditDone');
    await editorPage.waitForSelector('#program.sheet', { state: 'hidden' });
    const storedStep = () => editorPage.evaluate(() => Object.values(JSON.parse(localStorage.getItem('repforge_v1')).programMeta.loadingConfiguration?.byExerciseId || {}).map(item => item.loadStepKg));
    assert((await storedStep()).includes(committedStep), "Done commits the canonical smallest load change");
    await editorPage.reload(); await waitForApp(editorPage);
    assert((await storedStep()).includes(committedStep), "the load change survives the production reload path");
  }
  await editorContext.close();
}

async function controlsWithoutMotionLayer(browser) {
  phase("Phase 4: a missing motion layer retains native Settings fields");
  const { context, page } = await todayPage(browser, { layer: false });
  await page.click('#openSettings');
  // isVisible() reads the page as it is, without waiting: read it once Settings has opened and settled.
  await page.waitForSelector('#settings.view.active');
  await surfaceAtRest(page, '#settings');
  const nativeTheme = page.locator('#theme');
  const visible = await nativeTheme.isVisible();
  assert(visible, "Appearance retains a native select if its enhanced control cannot mount");
  if (visible) {
    await nativeTheme.selectOption('dark');
    assert(await page.locator('html').getAttribute('data-theme') === 'dark', "the fallback select applies the device preference");
  }
  await page.click('#restSecRow');
  await page.locator('#restSec').fill('45'); await page.locator('#restSec').dispatchEvent('change');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('repforge_v1')).settings.restSec === 45);
  assert(await page.locator('[data-step-input="restSec"][data-step-delta="1"]').isHidden(), "the typed timer remains usable without inert enhanced buttons");
  await context.close();
}

/* ---- Wheel picker for Load and Reps (Plan 075 phase 2W, ADR 0023 choice 8) ---- */

// The seed program's sets are metric-backed (test/fixtures/seed-program-v067.json): weight and reps are
// metric fields on the shelf, the same ids test/focus-mode.mjs addresses.
const WHEEL_WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const WHEEL_REPS = "2555c6f170d88072bbf6d9ad3f16ea86";
const CURRENT = "#workout .exercise.is-current";
const WHEEL_LOAD_SEL = `${CURRENT} .focus-shelf [data-shelf-field="metric_${WHEEL_WEIGHT}"]`;
const WHEEL_REPS_SEL = `${CURRENT} .focus-shelf [data-shelf-field="metric_${WHEEL_REPS}"]`;
const WHEEL_RIR_SEL = `${CURRENT} .focus-shelf [data-shelf-field="rir"]`;

async function enterSeededFocus(page) {
  await page.evaluate(async () => {
    await window.__repforgeEnterWorkout({});
    window.__repforgeFocus.to(0);
  });
  await page.waitForSelector("#workout.is-focus .exercise.is-current", { state: "attached", timeout: 5000 });
}

const wheelState = (page) => page.evaluate(() => {
  const el = document.querySelector("#wheelCol");
  if (!el) return null;
  const items = [...el.querySelectorAll(".wheel__item")];
  return {
    role: el.getAttribute("role"), now: Number(el.getAttribute("aria-valuenow")),
    min: Number(el.getAttribute("aria-valuemin")), max: Number(el.getAttribute("aria-valuemax")),
    text: el.getAttribute("aria-valuetext"), title: document.querySelector("#wheelSheetTitle")?.textContent || "",
    values: items.map((it) => Number(it.dataset.wheelV)),
    center: items.findIndex((it) => it.classList.contains("is-center")),
    target: items.map((it) => it.classList.contains("is-target")),
    transforms: items.map((it) => it.style.transform),
  };
});
const fieldFace = (page, sel) => page.evaluate((s) => {
  const field = document.querySelector(s).closest(".shelf__field");
  return { value: field.querySelector(".shelf__val")?.textContent?.trim(), label: field.querySelector(".shelf__lab")?.textContent?.trim(),
    editing: field.classList.contains("is-editing"), aria: document.querySelector(s).getAttribute("aria-label") };
}, sel);
const draftMetric = (page, metricId) => page.evaluate((id) => {
  const d = window.__repforgeWorkoutDraft.current();
  const exercise = d.exercises[d.session.selectedExerciseId];
  const set = exercise.sets[exercise.setOrder.find((s) => exercise.sets[s].ordinal === 1)];
  return set.edited.metrics[id];
}, metricId);
/** The load pad's own step, read while Load (the exercise's first metric) is
 *  already the default-selected field. */
const loadStep = async (page) => {
  const pads = await page.evaluate(() => [...document.querySelectorAll(`${"#workout .exercise.is-current"} .shelf__pad`)].map((b) => b.textContent.trim()));
  return Number((pads[1].match(/[\d.,]+/) || ["0"])[0].replace(",", "."));
};
/** A fresh exercise suggests nothing yet, so Load reads "—"; a pad tap gives it
 *  a known value (n steps) to open the wheel on, as a lifter who has stepped it
 *  once would see. */
async function pokeLoad(page, times = 1) {
  for (let i = 0; i < times; i++) await page.locator(`${CURRENT} .shelf__pad`).nth(1).click();
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

async function wheelPicker(browser) {
  phase("A second tap on Load opens the wheel; RIR's second tap still types");
  {
    const { context, page } = await todayPage(browser);
    await enterSeededFocus(page);
    const step = await loadStep(page);
    await pokeLoad(page, 1);
    const loadBefore = await fieldFace(page, WHEEL_LOAD_SEL);

    // Reps first (a first tap, away from the default-selected Load), then Load
    // twice: a first tap re-selects it, and the second is the one that opens.
    await page.locator(WHEEL_REPS_SEL).click();
    await page.locator(WHEEL_LOAD_SEL).click();
    await page.locator(WHEEL_LOAD_SEL).click();
    const opened = await page.waitForSelector("#wheelSheet.is-open", { timeout: 2000 }).then(() => true, () => false);
    assert(opened, "a second tap on the selected Load field opens the wheel sheet");
    const col = await wheelState(page);
    assert(col.role === "spinbutton", "the wheel column is a spinbutton", JSON.stringify(col));
    assert(col.now === Number(loadBefore.value), "its value starts at the field's current load", JSON.stringify({ col, loadBefore }));
    assert(col.title === loadBefore.label, "its title is the field's own label", JSON.stringify({ col, loadBefore }));
    assert(Math.abs((col.values[1] - col.values[0]) - step) < 1e-6, "the rail steps by the load pad's own step", JSON.stringify({ col, step }));
    assert(col.values[0] === 0, "the rail starts at zero", JSON.stringify(col));

    await page.keyboard.press("Escape");
    await page.waitForSelector("#wheelSheet", { state: "hidden" });
    await page.locator(WHEEL_RIR_SEL).click();
    await page.locator(WHEEL_RIR_SEL).click();
    const rirOpened = await page.waitForSelector("#wheelSheet.is-open", { timeout: 300 }).then(() => true, () => false);
    assert(!rirOpened, "RIR's second tap does not open the wheel");
    const rirFace = await fieldFace(page, WHEEL_RIR_SEL);
    assert(rirFace.editing, "RIR's second tap still opens the typed input, as before", JSON.stringify(rirFace));
    await context.close();
  }

  phase("Choosing a value on the wheel writes it through the field's own input, survives a reload and logs it");
  {
    const { context, page } = await todayPage(browser);
    await enterSeededFocus(page);
    const step = await loadStep(page);
    await pokeLoad(page, 1);
    const loadBefore = await fieldFace(page, WHEEL_LOAD_SEL);

    await page.locator(WHEEL_REPS_SEL).click();
    await page.locator(WHEEL_LOAD_SEL).click();
    await page.locator(WHEEL_LOAD_SEL).click();
    await page.waitForSelector("#wheelSheet.is-open");
    // The sheet slides up after .is-open lands; until it is at rest the column sits 160-230px below its place, and a
    // wheel aimed at a box read then lands under the column and never scrolls it (the CI flake, 2026-10-24).
    await surfaceAtRest(page, "#wheelSheet");
    await page.focus("#wheelCol");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    const afterKeys = await wheelState(page);
    const expectKeys = Number(loadBefore.value) + 2 * step;
    assert(Math.abs(afterKeys.now - expectKeys) < 1e-6, "ArrowUp twice steps the value up by two steps and commits at once",
      JSON.stringify({ afterKeys, expectKeys }));
    await page.waitForFunction(([id, want]) => {
      const d = window.__repforgeWorkoutDraft.current();
      const exercise = d.exercises[d.session.selectedExerciseId];
      const set = exercise.sets[exercise.setOrder.find((s) => exercise.sets[s].ordinal === 1)];
      return Number(set.edited.metrics[id]) === want;
    }, [WHEEL_WEIGHT, expectKeys], { timeout: 2000 });
    const liveAfterKeys = await fieldFace(page, WHEEL_LOAD_SEL);
    // The shelf underneath is untouched while the sheet is open; it reads the committed value once the sheet closes.

    // A real touch drag of the wheel column: touch pointer events, one per frame, three rows up and then still before
    // the finger lifts, so it carries no momentum. The engine owns the column (no native scroll), so where it lands
    // is exactly three steps on (#488's mouse-wheel gesture was the interim while CDP touch scroll was flaky).
    await page.waitForFunction(() => !window.__repforgeWheel?.state().moving, undefined, { timeout: 5000 }).catch(() => {});
    const dragH = (await drumState(page))?.itemH ?? 44;
    await wheelGesture(page, { path: Array.from({ length: 33 }, (_, i) => -Math.round(((i + 1) * 3 * dragH) / 33)), hold: 140 });
    const expectScroll = Math.round((afterKeys.now + 3 * step) * 100) / 100;
    const settledOn = await page.waitForFunction(() => {
      const s = window.__repforgeWheel?.state();
      return s && !s.moving ? Number(document.querySelector("#wheelCol").getAttribute("aria-valuenow")) : null;
    }, undefined, { timeout: 5000 }).then((h) => h.jsonValue(), () => NaN);
    assert(settledOn === expectScroll, "the drag moved the wheel exactly three values off its keyboard-set value",
      JSON.stringify({ settledOn, expectScroll, afterKeys }));
    const scrollCommitted = await page.waitForFunction(([id, want]) => {
      const d = window.__repforgeWorkoutDraft.current();
      const exercise = d.exercises[d.session.selectedExerciseId];
      const set = exercise.sets[exercise.setOrder.find((s) => exercise.sets[s].ordinal === 1)];
      return Number(set.edited.metrics[id]) === want;
    }, [WHEEL_WEIGHT, expectScroll], { timeout: 2000 }).then(() => true, () => false);
    assert(scrollCommitted, "the drag settles on a value and commits it the same way, through the field's own input",
      JSON.stringify({ expectScroll }));

    await page.click("#wheelDone");
    await page.waitForSelector("#wheelSheet", { state: "hidden" });
    const shelfAfter = await fieldFace(page, WHEEL_LOAD_SEL);
    assert(Number(shelfAfter.value) === expectScroll, "the shelf reads the wheel's committed value once Done closes it",
      JSON.stringify({ shelfAfter, expectScroll }));

    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await enterSeededFocus(page);
    const afterReload = await fieldFace(page, WHEEL_LOAD_SEL);
    assert(Number(afterReload.value) === expectScroll, "the value survives a reload", JSON.stringify({ afterReload, expectScroll }));

    const repsInput = page.locator(`${CURRENT} .focus-shelf input[data-metric-id="${WHEEL_REPS}"]`);
    await repsInput.first().fill("8");
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    await page.locator(`${CURRENT} .focus-shelf .saveset`).first().click();
    await page.waitForFunction((id) => {
      const d = window.__repforgeWorkoutDraft.current();
      const exercise = d.exercises[d.session.selectedExerciseId];
      const set = exercise.sets[exercise.setOrder.find((s) => exercise.sets[s].ordinal === 1)];
      return set.completion !== "pending" && Number(set.edited.metrics[id]) > 0;
    }, WHEEL_WEIGHT, { timeout: 5000 });
    const logged = await draftMetric(page, WHEEL_WEIGHT);
    assert(Number(logged) === expectScroll, "logging the set keeps the wheel-picked load", JSON.stringify({ logged, expectScroll }));
    await context.close();
  }

  phase("The keyboard button opens typed entry on the same field");
  {
    const { context, page } = await todayPage(browser);
    await enterSeededFocus(page);
    await page.locator(WHEEL_REPS_SEL).click();
    await page.locator(WHEEL_LOAD_SEL).click();
    await page.locator(WHEEL_LOAD_SEL).click();
    await page.waitForSelector("#wheelSheet.is-open");
    const headTop = await page.evaluate(() => document.querySelector("#workoutShell .wo-head").getBoundingClientRect().top);
    // iOS raises the keyboard only for a focus made inside the tap: read where focus is as the same click event
    // finishes, after the button's own handler has run (owner, iPhone, 2026-10-23).
    await page.evaluate(() => document.addEventListener("click", (event) => {
      if (event.target.closest?.("#wheelKeyboard")) window.__kbFocusInTap = document.activeElement?.dataset?.k || document.activeElement?.tagName || "";
    }, { once: true }));
    await page.click("#wheelKeyboard");
    const inTap = await page.evaluate(() => window.__kbFocusInTap);
    assert(String(inTap).endsWith(`_metric_${WHEEL_WEIGHT}`), "the keyboard button focuses the field's input inside the tap itself", String(inTap));
    await page.waitForSelector("#wheelSheet", { state: "hidden" });
    const face = await fieldFace(page, WHEEL_LOAD_SEL);
    assert(face.editing, "the keyboard button closes the sheet and opens the field's typed entry", JSON.stringify(face));
    const focusedKey = await page.evaluate(() => document.activeElement?.dataset?.k || "");
    assert(focusedKey.endsWith(`_metric_${WHEEL_WEIGHT}`), "the typed input keeps focus once the sheet has gone", focusedKey);
    const after = await page.evaluate(() => ({ scrollY: window.scrollY, scrollTop: document.scrollingElement.scrollTop,
      headTop: document.querySelector("#workoutShell .wo-head").getBoundingClientRect().top }));
    assert(after.scrollY === 0 && after.scrollTop === 0 && Math.abs(after.headTop - headTop) <= 0.5,
      "nothing scrolls, and the Focus header keeps its place", JSON.stringify({ after, headTop }));
    await context.close();
  }

  phase("No focus ring stays on a shelf field after touch use; a keyboard Tab still shows one (owner, Android, 2026-10-24)");
  {
    const { context, page } = await todayPage(browser);
    await enterSeededFocus(page);
    const ringOf = () => page.evaluate(() => {
      const el = document.activeElement, style = getComputedStyle(el);
      return { field: el.dataset?.shelfField || null, tag: el.tagName, ring: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0,
        visible: el.matches(":focus-visible"), quiet: el.hasAttribute("data-quiet-focus") };
    });
    // Touch: a second tap on Load opens the wheel, Done closes it, and focus comes back to Load.
    await page.tap(WHEEL_REPS_SEL); await page.tap(WHEEL_LOAD_SEL); await page.tap(WHEEL_LOAD_SEL);
    await page.waitForSelector("#wheelSheet.is-open");
    await page.tap("#wheelDone");
    await page.waitForSelector("#wheelSheet", { state: "hidden" });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const wheelClosed = await ringOf();
    // Chromium hides a ring on script focus after touch by itself; iOS Safari does not, so the quiet mark is what keeps it off there.
    assert(wheelClosed.field === `metric_${WHEEL_WEIGHT}` && !wheelClosed.ring && wheelClosed.quiet,
      "after a touch on the wheel focus returns to Load with no ring", JSON.stringify(wheelClosed));
    // A typed edit: RIR's second tap types. Whatever path then moves focus back onto a field by script (a rebuild's
    // restore, a sheet's return), the keys typed into the field are not keyboard navigation, so no ring is drawn.
    await page.tap(WHEEL_RIR_SEL); await page.tap(WHEEL_RIR_SEL);
    await page.waitForSelector(`${CURRENT} .focus-shelf .shelf__field.is-editing .shelf__input`);
    await page.keyboard.press("Backspace"); await page.keyboard.type("2"); await page.keyboard.press("Enter");
    // Enter submits the log form, which is inert while its save runs.
    await page.waitForFunction(() => !document.querySelector("#logForm").inert && !document.querySelector("#logForm").hasAttribute("aria-busy"));
    await page.evaluate((sel) => document.querySelector(sel).focus({ preventScroll: true }), WHEEL_LOAD_SEL);
    const typed = await ringOf();
    assert(typed.field === `metric_${WHEEL_WEIGHT}` && !typed.ring, "after a typed edit a field focused by script draws no ring", JSON.stringify(typed));
    // The keyboard: Tab moves focus within the shelf and draws the ring.
    await page.keyboard.press("Shift+Tab");
    const tabbed = await ringOf();
    assert(tabbed.tag === "BUTTON" && tabbed.visible && tabbed.ring && !tabbed.quiet, "a keyboard Tab shows the focus ring", JSON.stringify(tabbed));
    await context.close();
  }

  phase("The reps wheel runs 1–30 and marks the prescription's target range");
  {
    const { context, page } = await todayPage(browser);
    await enterSeededFocus(page);
    // A fresh set with no suggestion shows the target range ("4–8"), not a number; a
    // pad tap gives Reps a concrete current value to open the wheel on, as Load's own
    // proof does. Load is the default-selected field, so a first tap on it would
    // already be a second tap; move through Reps, then Load, then Reps twice to open.
    await page.locator(WHEEL_REPS_SEL).click();
    await page.locator(`${CURRENT} .shelf__pad`).nth(1).click();
    await page.locator(`${CURRENT} .shelf__pad`).nth(1).click();
    await page.locator(`${CURRENT} .shelf__pad`).nth(1).click();
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    const repsBefore = await fieldFace(page, WHEEL_REPS_SEL);
    await page.locator(WHEEL_LOAD_SEL).click();
    await page.locator(WHEEL_REPS_SEL).click();
    await page.locator(WHEEL_REPS_SEL).click();
    await page.waitForSelector("#wheelSheet.is-open");
    const col = await wheelState(page);
    assert(col.min === 1 && col.max === 30, "the reps rail runs 1 to 30", JSON.stringify(col));
    assert(col.now === Number(repsBefore.value), "it opens on the field's current reps", JSON.stringify({ col, repsBefore }));
    assert(col.target.some(Boolean), "the prescription's target range is marked on the rail", JSON.stringify(col));
    await context.close();
  }

  phase("An emptied Load on a manual lift reopens the wheel on its last logged load, not at 0");
  {
    // The catalog's wheel state: a manual lift, logged last time. The lifter clears the set's load, then reopens the wheel.
    const { context, page } = await openCatalogState(browser, "workout/wheel-load", 390, "en", "normal");
    await page.click("#wheelKeyboard");
    await page.waitForSelector("#wheelSheet", { state: "hidden" });
    const typed = page.locator(`${CURRENT} .focus-shelf .shelf__field.is-editing .shelf__input`);
    await typed.fill("");
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    // A field typed into stays open; move through Reps, then a first and second tap on Load opens the wheel.
    await page.locator(WHEEL_REPS_SEL).click();
    await page.locator(WHEEL_LOAD_SEL).click();
    await page.locator(WHEEL_LOAD_SEL).click();
    await page.waitForSelector("#wheelSheet.is-open");
    const seen = await page.evaluate(() => {
      const card = document.querySelector("#workout .exercise.is-current");
      const lastLine = [...card.querySelectorAll("*")].map((el) => el.childElementCount ? "" : el.textContent).find((text) => /^last\s/.test(text.trim())) || "";
      const input = card.querySelector(".focus-shelf .shelf__field .shelf__input");
      return { lastLine, input: input?.value ?? null, now: Number(document.querySelector("#wheelCol").getAttribute("aria-valuenow")) };
    });
    const last = Number((seen.lastLine.match(/last\s+([\d.,]+)/) || [])[1]?.replace(",", "."));
    assert(seen.input === "" && last > 0, "the set's load is empty, and the lift has a last logged load", JSON.stringify(seen));
    assert(seen.now === last, "the wheel opens on the last logged load", JSON.stringify({ ...seen, last }));
    await context.close();
  }

  phase("The wheel scrolls on one axis and always rests on a value");
  {
    // Owner, iPhone (2026-10-23): a drag carried the column sideways off the band, and it came to rest between values.
    const { context, page } = await openCatalogState(browser, "workout/wheel-load", 390, "en", "normal");
    const cdp = await context.newCDPSession(page);
    const touch = (type, points = []) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
    const axis = () => page.evaluate(() => {
      const col = document.querySelector("#wheelCol"), band = document.querySelector(".wheel__band").getBoundingClientRect();
      const mid = col.getBoundingClientRect().top + col.clientHeight / 2;
      const items = [...col.querySelectorAll(".wheel__item")];
      const centre = items.reduce((a, b) => Math.abs(b.getBoundingClientRect().top + b.offsetHeight / 2 - mid) < Math.abs(a.getBoundingClientRect().top + a.offsetHeight / 2 - mid) ? b : a);
      const r = centre.getBoundingClientRect();
      const style = getComputedStyle(col);
      return { scrollLeft: col.scrollLeft, overflowX: style.overflowX, touchAction: style.touchAction,
        offCentre: Math.abs((r.left + r.width / 2) - (band.left + band.width / 2)) };
    });
    await surfaceAtRest(page, "#wheelSheet");
    const box = await page.locator("#wheelCol").boundingBox();
    const x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2);
    // A diagonal drag, mostly sideways: each move waits for its frame before the next.
    await touch("touchStart", [{ x, y }]);
    for (let i = 1; i <= 6; i++) {
      await touch("touchMove", [{ x: x - 30 * i, y: y - 6 * i }]);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
    }
    await touch("touchEnd");
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const drift = await axis();
    // The browser pans nothing on the column (touch-action none): the engine moves it, on y alone.
    assert(drift.overflowX === "hidden" && drift.touchAction === "none" && drift.scrollLeft === 0,
      "the column moves only vertically (the engine reads only the finger's y), so a diagonal drag leaves it at x 0",
      JSON.stringify(drift));
    assert(drift.offCentre <= 1, "the value stays centred on the band", JSON.stringify(drift));

    // Released still, part way between two values (17px past one): it comes to rest exactly on a value.
    await page.waitForFunction(() => !window.__repforgeWheel?.state().moving, undefined, { timeout: 5000 }).catch(() => {});
    await wheelGesture(page, { path: [-6, -12, -17], hold: 140 });
    const rested = await page.waitForFunction(() => {
      const s = window.__repforgeWheel?.state();
      return s && !s.moving ? s.pos : null;
    }, undefined, { timeout: 3000 }).then((h) => h.jsonValue(), () => null);
    const restH = (await drumState(page))?.itemH ?? 44;
    assert(rested != null && Math.abs(rested / restH - Math.round(rested / restH)) < 1e-6, "once still, the column comes to rest exactly on a value", String(rested));
    const now = await page.evaluate(() => Number(document.querySelector("#wheelCol").getAttribute("aria-valuenow")));
    const shown = await page.evaluate(({ top, h }) => Number(document.querySelectorAll("#wheelCol .wheel__item")[Math.round(top / h)].dataset.wheelV), { top: rested ?? 0, h: restH });
    assert(now === shown, "and the value it reports is the one on the band", JSON.stringify({ now, shown, rested }));
    await context.close();
  }

  phase("Under reduced motion the wheel has no tilt, and positioning is instant");
  {
    const { context, page } = await todayPage(browser, { reducedMotion: "reduce" });
    await enterSeededFocus(page);
    await page.locator(WHEEL_REPS_SEL).click();
    await page.locator(WHEEL_LOAD_SEL).click();
    await page.locator(WHEEL_LOAD_SEL).click();
    await page.waitForSelector("#wheelSheet.is-open");
    const col = await wheelState(page);
    assert(col.transforms.every((t) => !/rotate/.test(t)), "no item carries a tilt under reduced motion", JSON.stringify(col));
    await page.keyboard.press("ArrowUp");
    const stepped = await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => {
      const s = window.__repforgeWheel?.state();
      resolve(s ? { pos: s.pos, index: s.index, itemH: s.itemH, moving: s.moving } : null);
    })));
    assert(stepped && !stepped.moving && stepped.index === col.center + 1 && Math.abs(stepped.pos - stepped.index * stepped.itemH) < 0.01,
      "a key step positions the wheel at once, not over frames", JSON.stringify({ stepped, from: col.center }));
    await context.close();
  }
}

/* ---- The wheel as a physical object (owner, 2026-10-23) ----
 * The column is driven by Pointer Events, not native scroll: one position, every row's transform recomputed from it
 * per frame, a release projected with Apple's decay and snapped where it is going, notches, rubber-banding at the
 * ends, and a touch that takes a moving wheel where it is. Each gesture is dispatched as touch pointer events
 * (pointerType "touch"), one per animation frame, so nothing depends on the browser's touch-to-scroll mapping
 * (#488's interim wheel-gesture proof). Feel on a phone is the owner's to judge on the device.
 */
const WHEEL_PROJECTION = 0.998;

/** The wheel engine's own reading: its position (px; row i is centred at i × itemH), the centred row, whether it is
 *  moving, the last release it projected, and the rows it drew with the transform and opacity it gave each. */
const drumState = (page) => page.evaluate(() => window.__repforgeWheel?.state() ?? null);

/** A finger on the wheel column: down at the column's centre (offset by `startY`), then one move per animation
 *  frame through `path` (y offsets from where it went down), then still for `hold` ms of frames, then up unless
 *  `lift` is false. Returns the engine's position after each event. */
const wheelGesture = (page, { path = [], hold = 0, lift = true, startY = 0, pointerId = 41 } = {}) => page.evaluate(async ({ path, hold, lift, startY, pointerId }) => {
  const col = document.querySelector("#wheelCol"), r = col.getBoundingClientRect();
  const x = r.left + r.width / 2, y0 = r.top + r.height / 2 + startY;
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const fire = (type, y) => col.dispatchEvent(new PointerEvent(type, { pointerId, pointerType: "touch", isPrimary: true,
    clientX: x, clientY: y, button: 0, buttons: type === "pointerup" ? 0 : 1, bubbles: true, cancelable: true }));
  const log = [];
  const sample = (type) => { const s = window.__repforgeWheel?.state() ?? {}; log.push({ type, pos: s.pos, index: s.index, now: s.now, moving: s.moving, scrollTop: col.scrollTop }); };
  fire("pointerdown", y0); sample("down");
  for (const dy of path) { await frame(); fire("pointermove", y0 + dy); sample("move"); }
  const last = y0 + (path.at(-1) ?? 0);
  if (hold) { const t = performance.now(); while (performance.now() - t < hold) { await frame(); fire("pointermove", last); sample("hold"); } }
  if (lift) { fire("pointerup", last); sample("up"); }
  return log;
}, { path, hold, lift, startY, pointerId });

/** Every frame until the wheel is still: its position, the column's scrollTop and the rows as drawn. */
const wheelFrames = (page, { max = 900 } = {}) => page.evaluate(async (max) => {
  const col = document.querySelector("#wheelCol");
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const frames = [];
  for (let i = 0; i < max; i++) {
    await frame();
    const s = window.__repforgeWheel?.state() ?? { drawn: [] };
    frames.push({ pos: s.pos, index: s.index, moving: s.moving, scrollTop: col.scrollTop, drawn: s.drawn, now: s.now });
    if (!s.moving) break;
  }
  return frames;
}, max);

/** Each drawn row's transform is a function of the position alone: row i sits at i × itemH − pos, tilts by its
 *  distance from the band, and shrinks and fades the further it is. Returns the first frame that breaks it. */
function frameOffPosition(frame, itemH, { tilt = true } = {}) {
  const rows = frame.drawn.map((row) => {
    const ty = Number((row.transform.match(/translateY\((-?[\d.e-]+)px\)/) || [])[1]);
    const rx = Number((row.transform.match(/rotateX\((-?[\d.e-]+)deg\)/) || [])[1] ?? 0);
    const sc = Number((row.transform.match(/scale\(([\d.e-]+)\)/) || [])[1] ?? 1);
    return { i: row.i, ty, rx, sc, op: Number(row.opacity), d: row.i - frame.pos / itemH, hasTilt: /rotateX/.test(row.transform) };
  });
  for (const row of rows) {
    if (!(Math.abs(row.ty - (row.i * itemH - frame.pos)) < 0.05)) return { why: "translateY", row, pos: frame.pos };
    if (tilt !== row.hasTilt) return { why: "tilt presence", row };
    if (tilt && !(Math.abs(row.rx + 18 * row.d) < 0.05)) return { why: "rotateX", row, pos: frame.pos };
  }
  const byDistance = [...rows].sort((a, b) => Math.abs(a.d) - Math.abs(b.d));
  for (let k = 1; k < byDistance.length; k++) {
    if (byDistance[k].sc > byDistance[k - 1].sc + 1e-6 || byDistance[k].op > byDistance[k - 1].op + 1e-6) return { why: "scale/opacity grows with distance", rows: byDistance };
  }
  if (!rows.some((row) => Math.abs(row.d) < 0.5 + 1e-6)) return { why: "no row drawn on the band", rows };
  return null;
}

/** The set's weight in the draft, as the field's own input wrote it. */
const draftLoad = (page) => page.evaluate((id) => {
  const d = window.__repforgeWorkoutDraft.current();
  const exercise = d.exercises[d.session.selectedExerciseId];
  const set = exercise.sets[exercise.setOrder.find((s) => exercise.sets[s].ordinal === 1)];
  return Number(set.edited.metrics[id]);
}, WHEEL_WEIGHT);

async function openWheelState(browser, { reducedMotion = false } = {}) {
  const opened = await openCatalogState(browser, "workout/wheel-load", 390, "en", "normal");
  if (reducedMotion) await opened.page.emulateMedia({ reducedMotion: "reduce" });
  await surfaceAtRest(opened.page, "#wheelSheet");
  return opened;
}

async function wheelPhysics(browser) {
  phase("The wheel draws the owner's pick: 28px semibold numbers in 45px rows, five rows shown (2026-10-24)");
  {
    const { context, page } = await openWheelState(browser);
    const size = await page.evaluate(() => {
      const col = document.querySelector("#wheelCol"), band = document.querySelector(".wheel__band");
      const centre = col.querySelector(".wheel__item.is-center"), style = getComputedStyle(centre);
      return { fontSize: parseFloat(style.fontSize), weight: Number(style.fontWeight), row: centre.getBoundingClientRect().height,
        height: col.getBoundingClientRect().height, band: band.getBoundingClientRect().height,
        bandTop: band.getBoundingClientRect().top - col.getBoundingClientRect().top, pitch: window.__repforgeWheel?.state().itemH };
    });
    assert(size.fontSize === 28 && size.weight === 600 && size.row === 45 && size.band === 45 && size.pitch === 45,
      "numbers are 28px at weight 600 in 45px rows, and the band and the engine's pitch match the row", JSON.stringify(size));
    assert(size.height === 225 && size.bandTop === 90, "the wheel shows five rows (225px) with the band on the middle one", JSON.stringify(size));
    await context.close();
  }

  phase("Wheel physics: a slow drag across three values steps exactly three, ticking through each");
  {
    const { context, page } = await openWheelState(browser);
    const start = await drumState(page);
    assert(start && !start.moving && Math.abs(start.pos - start.index * start.itemH) < 0.01, "the wheel engine reports an open wheel at rest on a row", JSON.stringify(start && { ...start, drawn: undefined }));
    if (start) {
      const H = start.itemH;
      // Up three rows at about 0.25 px/ms, then the finger rests before it lifts: no momentum is left.
      const path = Array.from({ length: 33 }, (_, i) => -Math.round(((i + 1) * 3 * H) / 33));
      const log = await wheelGesture(page, { path, hold: 140 });
      const ticks = log.map((e) => e.index).filter((v, i, a) => i === 0 || v !== a[i - 1]);
      assert(JSON.stringify(ticks) === JSON.stringify([start.index, start.index + 1, start.index + 2, start.index + 3]),
        "the centred value ticks one row at a time as the drag crosses each notch", JSON.stringify(ticks));
      const held = log.filter((e) => e.type === "hold").at(-1);
      assert(held && Math.abs(held.pos - (start.pos + 3 * H)) < 0.01, "three rows of finger travel are exactly three rows of wheel (1:1 at the notches)", JSON.stringify({ held, start: start.pos }));
      const frames = await wheelFrames(page);
      const rest = await drumState(page);
      assert(!rest.moving && rest.index === start.index + 3 && Math.abs(rest.pos - rest.index * H) < 0.01, "it rests exactly three values on", JSON.stringify({ rest: { ...rest, drawn: undefined }, start: start.index, frames: frames.length }));
      const now = await page.evaluate(() => Number(document.querySelector("#wheelCol").getAttribute("aria-valuenow")));
      assert(now === rest.values[rest.index], "the value it reports is the one centred on the band", JSON.stringify({ now, centred: rest.values[rest.index] }));
      const committed = await page.waitForFunction(([id, want]) => {
        const d = window.__repforgeWorkoutDraft.current();
        const exercise = d.exercises[d.session.selectedExerciseId];
        const set = exercise.sets[exercise.setOrder.find((s) => exercise.sets[s].ordinal === 1)];
        return Number(set.edited.metrics[id]) === want;
      }, [WHEEL_WEIGHT, rest.values[rest.index]], { timeout: 2000 }).then(() => true, () => false);
      assert(committed, "once still, the centred value is committed through the field's own input", JSON.stringify({ want: rest.values[rest.index], have: await draftLoad(page) }));
    }
    await context.close();
  }

  phase("Wheel physics: a fast flick lands where its release velocity projects it, not on the row nearest the release");
  {
    const { context, page } = await openWheelState(browser);
    const start = await drumState(page);
    if (!start) { assert(false, "the wheel engine reports its state"); await context.close(); }
    else {
      const H = start.itemH;
      const log = await wheelGesture(page, { path: [-30, -70, -120, -175, -235] });
      const frames = await wheelFrames(page);
      const rest = await drumState(page);
      const release = rest.release;
      const max = (rest.count - 1) * H;
      const projected = release ? release.pos + release.velocity * WHEEL_PROJECTION / (1 - WHEEL_PROJECTION) : NaN;
      const expected = Math.max(0, Math.min(rest.count - 1, Math.round(Math.max(0, Math.min(max, projected)) / H)));
      assert(release && release.velocity > 0.5, "the release carried the finger's velocity", JSON.stringify(release));
      assert(release && Math.abs(release.projected - projected) < 1e-6 && release.target === expected,
        "the target is the row nearest Apple's projection of the recorded release velocity", JSON.stringify({ release, projected, expected }));
      assert(release && expected - Math.round(release.pos / H) >= 3, "and well past the row nearest the release", JSON.stringify({ release, nearest: Math.round(release?.pos / H) }));
      assert(!rest.moving && rest.index === expected && Math.abs(rest.pos - expected * H) < 0.01, "the wheel comes to rest exactly on the projected row", JSON.stringify({ pos: rest.pos, index: rest.index, expected }));
      const firstFrame = frames[0], lastMove = log.at(-1);
      assert(firstFrame && firstFrame.pos > lastMove.pos, "the motion carries on from the release with no seam (it keeps going the finger's way)", JSON.stringify({ firstFrame: firstFrame && { pos: firstFrame.pos }, lastMove }));
      const broken = frames.map((f) => frameOffPosition(f, H)).find(Boolean);
      assert(frames.length > 5 && !broken, "every frame's row transforms derive from the position alone", JSON.stringify({ frames: frames.length, broken }));
      const tops = new Set([...log, ...frames].map((f) => f.scrollTop));
      assert(tops.size === 1 && tops.has(0), "the column never scrolls (scrollTop stays 0)", JSON.stringify([...tops]));
      const now = await page.evaluate(() => Number(document.querySelector("#wheelCol").getAttribute("aria-valuenow")));
      const committed = await page.waitForFunction(([id, want]) => {
        const d = window.__repforgeWorkoutDraft.current();
        const exercise = d.exercises[d.session.selectedExerciseId];
        const set = exercise.sets[exercise.setOrder.find((s) => exercise.sets[s].ordinal === 1)];
        return Number(set.edited.metrics[id]) === want;
      }, [WHEEL_WEIGHT, rest.values[expected]], { timeout: 2000 }).then(() => true, () => false);
      assert(now === rest.values[expected] && committed, "the committed value is the centred one", JSON.stringify({ now, want: rest.values[expected], have: await draftLoad(page) }));
      await context.close();
    }
  }

  phase("Wheel physics: a touch on a moving wheel stops it under the finger within a frame, and drags on from there");
  {
    const { context, page } = await openWheelState(browser);
    const start = await drumState(page);
    if (!start) { assert(false, "the wheel engine reports its state"); await context.close(); }
    else {
      const H = start.itemH;
      await wheelGesture(page, { path: [-30, -70, -120, -175, -235] });
      // Let it run a few frames so the wheel is moving under its own momentum when the finger lands.
      const running = await page.evaluate(async () => {
        const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
        const seen = [];
        for (let i = 0; i < 4; i++) { await frame(); seen.push(window.__repforgeWheel.state().pos); }
        return { seen, moving: window.__repforgeWheel.state().moving };
      });
      assert(running.moving && running.seen.at(-1) > running.seen[0], "the wheel is moving on its own", JSON.stringify(running));
      const caught = await page.evaluate(async () => {
        const col = document.querySelector("#wheelCol"), r = col.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
        const shown = window.__repforgeWheel.state().pos;
        col.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 42, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, button: 0, buttons: 1, bubbles: true, cancelable: true }));
        const atDown = window.__repforgeWheel.state();
        await frame();
        const next = window.__repforgeWheel.state();
        await frame();
        const after = window.__repforgeWheel.state();
        col.dispatchEvent(new PointerEvent("pointermove", { pointerId: 42, pointerType: "touch", isPrimary: true, clientX: x, clientY: y - 10, button: 0, buttons: 1, bubbles: true, cancelable: true }));
        const dragged = window.__repforgeWheel.state();
        col.dispatchEvent(new PointerEvent("pointerup", { pointerId: 42, pointerType: "touch", isPrimary: true, clientX: x, clientY: y - 10, button: 0, buttons: 0, bubbles: true, cancelable: true }));
        return { shown, atDown: atDown.pos, downMoving: atDown.moving, next: next.pos, after: after.pos, dragged: dragged.pos };
      });
      assert(!caught.downMoving && caught.atDown === caught.shown, "the touch stops the wheel at the position it was showing", JSON.stringify(caught));
      assert(caught.next === caught.atDown && caught.after === caught.atDown, "and it stays there under the still finger on the next frames", JSON.stringify(caught));
      // The ratchet bends 10px of finger into 8.5–11.5px of wheel, depending on where between two notches it was caught.
      assert(Math.abs(caught.dragged - (caught.atDown + 10)) < 2, "a drag from there moves it from where it was caught, with no jump", JSON.stringify(caught));
      await context.close();
    }
  }

  phase("Wheel physics: past either end it rubber-bands, then springs back to the end value");
  {
    const { context, page } = await openWheelState(browser);
    const start = await drumState(page);
    if (!start) { assert(false, "the wheel engine reports its state"); await context.close(); }
    else {
      const H = start.itemH;
      await page.focus("#wheelCol");
      await page.keyboard.press("Home");
      await wheelFrames(page);
      const atMin = await drumState(page);
      assert(atMin.index === 0 && Math.abs(atMin.pos) < 0.01, "Home takes the wheel to its first value", JSON.stringify({ pos: atMin.pos, index: atMin.index }));
      const down = Array.from({ length: 20 }, (_, i) => (i + 1) * 10);
      const pulled = await wheelGesture(page, { path: down, hold: 140 });
      const deepest = pulled.filter((e) => e.type === "move").at(-1).pos;
      assert(deepest < -10 && deepest > -200 * 0.55, "a 200px pull past the first value moves it less and less (rubber band)", JSON.stringify({ deepest }));
      const steps = pulled.filter((e) => e.type === "move" && e.pos < 0).map((e, i, a) => (i ? a[i - 1].pos - e.pos : null)).filter((v) => v != null);
      assert(steps.length > 3 && steps.at(-1) < steps[0], "each further pixel of pull moves it less", JSON.stringify(steps));
      await wheelFrames(page);
      const back = await drumState(page);
      assert(!back.moving && back.index === 0 && Math.abs(back.pos) < 0.01, "released, it springs back to the first value", JSON.stringify({ pos: back.pos, index: back.index }));

      await page.keyboard.press("End");
      await wheelFrames(page);
      const atMax = await drumState(page);
      const max = (atMax.count - 1) * H;
      const upPath = Array.from({ length: 20 }, (_, i) => -(i + 1) * 10);
      const over = await wheelGesture(page, { path: upPath, hold: 140 });
      const highest = over.filter((e) => e.type === "move").at(-1).pos;
      assert(highest > max + 10 && highest < max + 200 * 0.55, "a 200px push past the last value rubber-bands too", JSON.stringify({ highest, max }));
      await wheelFrames(page);
      const home = await drumState(page);
      assert(!home.moving && home.index === atMax.count - 1 && Math.abs(home.pos - max) < 0.01, "released, it springs back to the last value", JSON.stringify({ pos: home.pos, max }));
      await context.close();
    }
  }

  phase("Wheel physics: under reduced motion a release steps straight to the nearest value, with no momentum and no tilt");
  {
    const { context, page } = await openWheelState(browser, { reducedMotion: true });
    const start = await drumState(page);
    if (!start) { assert(false, "the wheel engine reports its state"); await context.close(); }
    else {
      const H = start.itemH;
      await wheelGesture(page, { path: [-30, -70, -120] });
      const rest = await drumState(page);
      assert(!rest.moving && rest.release && rest.release.target === Math.round(rest.release.pos / H) && Math.abs(rest.pos - rest.release.target * H) < 0.01,
        "the release lands at once on the value nearest where the finger let go", JSON.stringify({ release: rest.release, pos: rest.pos }));
      const broken = frameOffPosition(rest, H, { tilt: false });
      assert(!broken, "rows keep their scale and fade by distance, without a tilt", JSON.stringify(broken));
      await context.close();
    }
  }

  phase("Wheel physics: without the motion layer the rows are still drawn, and the keys still set the value");
  {
    const { context, page } = await todayPage(browser, { layer: false });
    await enterSeededFocus(page);
    const step = await loadStep(page);
    await pokeLoad(page, 1);
    const loadBefore = await fieldFace(page, WHEEL_LOAD_SEL);
    await page.locator(WHEEL_REPS_SEL).click();
    await page.locator(WHEEL_LOAD_SEL).click();
    await page.locator(WHEEL_LOAD_SEL).click();
    await page.waitForSelector("#wheelSheet.is-open");
    const centre = await page.evaluate(() => {
      const el = document.querySelector("#wheelCol .wheel__item.is-center"), band = document.querySelector(".wheel__band").getBoundingClientRect();
      const r = el?.getBoundingClientRect();
      return el ? { visible: getComputedStyle(el).visibility === "visible", offBand: Math.abs((r.top + r.height / 2) - (band.top + band.height / 2)), value: Number(el.dataset.wheelV) } : null;
    });
    assert(centre && centre.visible && centre.offBand < 1 && centre.value === Number(loadBefore.value),
      "the current value is drawn on the band", JSON.stringify({ centre, loadBefore }));
    await page.focus("#wheelCol");
    await page.keyboard.press("ArrowUp");
    const want = Math.round((Number(loadBefore.value) + step) * 100) / 100;
    const committed = await page.waitForFunction(([id, v]) => {
      const d = window.__repforgeWorkoutDraft.current();
      const exercise = d.exercises[d.session.selectedExerciseId];
      const set = exercise.sets[exercise.setOrder.find((s) => exercise.sets[s].ordinal === 1)];
      return Number(set.edited.metrics[id]) === v;
    }, [WHEEL_WEIGHT, want], { timeout: 2000 }).then(() => true, () => false);
    const moved = await page.evaluate(() => {
      const el = document.querySelector("#wheelCol .wheel__item.is-center"), band = document.querySelector(".wheel__band").getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { value: Number(el.dataset.wheelV), offBand: Math.abs((r.top + r.height / 2) - (band.top + band.height / 2)) };
    });
    assert(committed && moved.value === want && moved.offBand < 1, "ArrowUp steps one value, draws it on the band and commits it", JSON.stringify({ moved, want }));
    await context.close();
  }
}

/* ---- Navigation (Plan 075 phase 3) ---- */

/** Where the route is: the library on screen, and this tab's history entry. */
const routeState = (page) => page.evaluate(() => ({
  library: document.body.classList.contains("is-library") && document.querySelector("#library")?.classList.contains("active"),
  route: history.state?.tauriferRoute?.view || "",
  length: history.length,
}));

/**
 * Pushed pages and the browser's history (ADR 0023 choice 2). Each pushed page
 * holds one history entry, so Safari's back button and edge swipe pop it as its
 * Back does; an in-app Back gives the entry back. Right after a touch at the
 * left edge a browser pop is Safari's own swipe, already animated, so the page
 * leaves without a second push.
 */
async function routeHistory(browser) {
  phase("a pushed page holds one history entry, and the browser's back pops it");
  const { context, page } = await sheetPage(browser);
  const before = await routeState(page);
  await page.evaluate(() => window.openLibrary());
  await page.waitForFunction(() => history.state?.tauriferRoute?.view === "library", undefined, { timeout: 3000 }).catch(() => {});
  const opened = await routeState(page);
  assert(opened.library && opened.route === "library" && opened.length === before.length + 1,
    "opening the library adds one history entry for it", JSON.stringify({ before, opened }));
  await page.goBack({ waitUntil: "commit" }).catch(() => {});
  const popped = await page.waitForFunction(() => window.__repforgeBooted === true && !document.body.classList.contains("is-library"),
    undefined, { timeout: 3000 }).then(() => true, () => false);
  assert(popped, "the browser's back closes the library as its Back does, and stays in the app");
  if (!popped) { await context.close(); return; }

  phase("an in-app Back gives the entry back");
  await page.evaluate(() => window.openLibrary());
  await page.waitForFunction(() => history.state?.tauriferRoute?.view === "library", undefined, { timeout: 3000 }).catch(() => {});
  await page.click("#libBack");
  const returned = await page.waitForFunction(() => !document.body.classList.contains("is-library") && !history.state?.tauriferRoute,
    undefined, { timeout: 3000 }).then(() => true, () => false);
  assert(returned, "after Back the history is where it was before the push", JSON.stringify(await routeState(page)));

  phase("a pop right after an edge touch is Safari's swipe: no second push");
  await page.evaluate(() => window.openLibrary());
  // The opening push itself has to have landed before pushes are counted.
  await page.waitForFunction(() => history.state?.tauriferRoute?.view === "library" && !document.body.classList.contains("is-pushing"),
    undefined, { timeout: 3000 }).catch(() => {});
  await page.evaluate(() => {
    window.__pushes = [];
    new MutationObserver(() => { if (document.querySelector(".is-push-over")) window.__pushes.push(Date.now()); })
      .observe(document.body, { attributes: true, subtree: true, attributeFilter: ["class"] });
    document.dispatchEvent(new TouchEvent("touchstart", { touches: [new Touch({ identifier: 1, target: document.body, clientX: 6, clientY: 400 })], bubbles: true }));
  });
  await page.goBack({ waitUntil: "commit" }).catch(() => {});
  await page.waitForFunction(() => !document.body.classList.contains("is-library"), undefined, { timeout: 3000 }).catch(() => {});
  assert((await page.evaluate(() => window.__pushes.length)) === 0, "the library leaves without the app animating it again");
  await context.close();
}

/**
 * The back swipe in Auto mode (choice 2): in a Safari tab it starts anywhere on
 * a pushed page, right of the browser's own edge zone; a drag that starts on a
 * text field is the field's. Underneath, the page returned to sits 30% to the
 * left and dimmed, and moves with the swipe.
 */
async function autoSwipe(browser) {
  phase("in a Safari tab the back swipe starts anywhere on a pushed page");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await installSeedProgram(page, { waitFor: waitForApp });
  const cdp = await context.newCDPSession(page);
  const touch = (type, points = []) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  // A named deadline: the library's push settles within 5 s, or the phase fails saying where it stood (a bare wait
  // once ran this file into its 600 s cap on CI).
  const open = async () => {
    await page.evaluate(() => window.openLibrary());
    await page.waitForFunction(() => document.body.classList.contains("is-library") && !document.body.classList.contains("is-pushing"), undefined, { timeout: 5000 })
      .catch(async () => {
        const where = await page.evaluate(() => ({ body: document.body.className, view: document.querySelector(".view.active")?.id || "", visibility: document.visibilityState }));
        throw new Error(`autoSwipe: the library's push did not settle within 5 s (${JSON.stringify(where)})`);
      });
  };
  await open();
  const y = 520;
  await touch("touchStart", [{ x: 120, y }]);
  for (const x of [140, 170, 210, 250]) await touch("touchMove", [{ x, y }]);
  const mid = await page.waitForFunction(() => {
    const lib = document.querySelector("#library"), under = document.querySelector(".is-push-under");
    const x = new DOMMatrixReadOnly(getComputedStyle(lib).transform === "none" ? undefined : getComputedStyle(lib).transform).m41;
    if (!(x > 60)) return null;
    const u = under ? new DOMMatrixReadOnly(getComputedStyle(under).transform === "none" ? undefined : getComputedStyle(under).transform).m41 : null;
    return { x, under: u, cover: Number((under ? getComputedStyle(under).getPropertyValue("--push-cover") : "") || 0) };
  }, undefined, { timeout: 2000 }).then((h) => h.jsonValue(), () => null);
  assert(mid && mid.x > 60, "a drag from mid-page carries the page with the thumb", JSON.stringify(mid));
  assert(mid && mid.under < 0 && mid.under > -390 * 0.3 && mid.cover > 0 && mid.cover < 1,
    "the page underneath sits to the left, part of the way back, and dimmed", JSON.stringify(mid));
  for (const x of [300, 340, 370]) await touch("touchMove", [{ x, y }]);
  await touch("touchEnd");
  // The pop has settled only once the push machinery has finished too: a push started during the settle is dropped.
  const popped = await page.waitForFunction(() => !document.body.classList.contains("is-library") && !document.body.classList.contains("is-pushing"),
    undefined, { timeout: 3000 }).then(() => true, () => false);
  assert(popped, "released past halfway, the swipe pops the page");

  phase("a drag that starts on a text field is the field's");
  await open();
  const box = await page.locator("#libSearch").boundingBox();
  await touch("touchStart", [{ x: box.x + 30, y: box.y + box.height / 2 }]);
  for (const dx of [20, 60, 120]) await touch("touchMove", [{ x: box.x + 30 + dx, y: box.y + box.height / 2 }]);
  await touch("touchEnd");
  const still = await page.evaluate(() => document.body.classList.contains("is-library") && !document.querySelector("#library").style.transform);
  assert(still, "the library stays put");

  phase("a push whose animation never reports arriving still ends");
  const stalled = await page.evaluate(async () => {
    window.closeLibrary?.();
    await new Promise((r) => setTimeout(r, 600));
    const motion = window.RepForgeMotion, real = motion.animatePush;
    motion.animatePush = () => new Promise(() => {});
    try {
      window.openLibrary();
      const t0 = performance.now();
      while (document.body.classList.contains("is-pushing") && performance.now() - t0 < 3000) await new Promise((r) => setTimeout(r, 50));
      return { pushing: document.body.classList.contains("is-pushing"), library: document.body.classList.contains("is-library"),
        underInert: !!document.querySelector(".is-push-under"), ms: Math.round(performance.now() - t0) };
    } finally { motion.animatePush = real; }
  });
  assert(!stalled.pushing && stalled.library && !stalled.underInert && stalled.ms <= 2000,
    "a stalled push animation is ended by the route's deadline: the page arrives and nothing beneath stays inert", JSON.stringify(stalled));
  await context.close();
}

/**
 * The back swipe in the Home Screen app (owner, iPhone, 2026-10-23): it starts within 32px of the edge, one page
 * shows beneath it, the moving page keeps its top, and a release goes through as iOS's does: past 35% of the width,
 * at 0.3px/ms or faster, or coasting past halfway; only a slow, short drag goes home.
 */
async function standaloneSwipe(browser) {
  const open = async () => {
    const { context, page, touch } = await todayPage(browser);
    await page.evaluate(() => {
      const native = window.matchMedia.bind(window);
      window.matchMedia = (query) => /display-mode:\s*standalone/.test(query)
        ? { matches: true, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
        : native(query);
    });
    await page.evaluate(() => openExerciseView(state.program[0].id));
    await page.waitForFunction(() => document.body.classList.contains("is-exercise") && !document.body.classList.contains("is-pushing"));
    return { context, page, touch };
  };
  const frame = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
  const pageX = (page) => page.evaluate(() => {
    const t = getComputedStyle(document.querySelector("#exercise")).transform;
    return t === "none" ? 0 : new DOMMatrixReadOnly(t).m41;
  });
  /** Drag from `from` through `xs`, a frame apart; `hold` ms still before lifting. Returns whether the page popped. */
  const swipe = async (page, touch, from, xs, { hold = 0 } = {}) => {
    const y = 520;
    await touch("touchStart", [{ x: from, y }]);
    for (const x of xs) { await touch("touchMove", [{ x, y }]); await frame(page); }
    if (hold) await page.evaluate((ms) => new Promise((resolve) => setTimeout(resolve, ms)), hold);
    await touch("touchEnd");
    return page.waitForFunction(() => !document.body.classList.contains("is-exercise"), undefined, { timeout: 1500 }).then(() => true, () => false);
  };
  const steps = (from, to, n) => Array.from({ length: n }, (_, i) => Math.round(from + ((to - from) * (i + 1)) / n));

  phase("In the Home Screen app a swipe that starts 28px in from the edge is the back swipe");
  {
    const { context, page, touch } = await open();
    const headTop = await page.evaluate(() => document.querySelector("#exercise").firstElementChild.getBoundingClientRect().top);
    await touch("touchStart", [{ x: 28, y: 520 }]);
    for (const x of [44, 70, 110, 150]) { await touch("touchMove", [{ x, y: 520 }]); await frame(page); }
    const mid = await page.evaluate(() => {
      const ex = document.querySelector("#exercise");
      const visible = [...document.querySelectorAll(".view")].filter((v) => v !== ex && getComputedStyle(v).display !== "none");
      return { swiping: ex.classList.contains("is-edge-swiping"), underlays: visible.map((v) => v.id || v.className),
        boxTop: ex.getBoundingClientRect().top, headTop: ex.firstElementChild.getBoundingClientRect().top };
    });
    const moved = await pageX(page);
    assert(mid.swiping && moved > 60, "a start 28px in from the edge is captured and carries the page", JSON.stringify({ mid, moved }));
    assert(mid.underlays.length === 1, "exactly one page shows beneath the swipe", JSON.stringify(mid));
    assert(mid.boxTop <= 0.5 && Math.abs(mid.headTop - headTop) <= 0.5,
      "the moving page keeps its top: its box reaches the top of the screen and its content does not move", JSON.stringify({ mid, headTop }));
    await touch("touchEnd");
    await context.close();
  }

  phase("A release at 45% that has slowed to a stop goes through");
  {
    const { context, page, touch } = await open();
    const popped = await swipe(page, touch, 10, steps(10, 176, 10), { hold: 160 });
    assert(popped, "45% of the width is past the commit share");
    await context.close();
  }

  phase("A quick release at 25% goes through");
  {
    const { context, page, touch } = await open();
    // About 8px a frame: roughly 0.5px/ms at release.
    const popped = await swipe(page, touch, 10, steps(10, 98, 11));
    assert(popped, "a release at 0.3px/ms or faster goes through short of the commit share");
    await context.close();
  }

  phase("A slow, short drag goes home");
  {
    const { context, page, touch } = await open();
    const popped = await swipe(page, touch, 10, steps(10, 88, 10), { hold: 160 });
    assert(!popped, "a still release at 20% goes home");
    const home = await page.waitForFunction(() => {
      const t = getComputedStyle(document.querySelector("#exercise")).transform;
      return t === "none" || new DOMMatrixReadOnly(t).m41 === 0;
    }, undefined, { timeout: 2000 }).then(() => true, () => false);
    assert(home, "and the page settles back in place");
    await context.close();
  }
}

/** Under reduced motion a push cross-fades the arriving page over about 170ms, with no travel (choice 11). */
async function reducedMotionPush(browser) {
  phase("under reduced motion a push cross-fades in place");
  const { context, page } = await sheetPage(browser, { reducedMotion: "reduce" });
  const frames = await page.evaluate(() => new Promise((resolve) => {
    const lib = document.querySelector("#library"), out = [], t0 = performance.now();
    window.openLibrary();
    const fade = lib.getAnimations().map((a) => a.effect.getTiming().duration);
    const tick = () => {
      const s = getComputedStyle(lib);
      out.push({ fade, t: Math.round(performance.now() - t0), opacity: Number(s.opacity),
        x: Math.round(new DOMMatrixReadOnly(s.transform === "none" ? undefined : s.transform).m41) });
      if (performance.now() - t0 < 400) requestAnimationFrame(tick); else resolve(out);
    };
    requestAnimationFrame(tick);
  }));
  assert(frames.every((f) => f.x === 0), "the page never travels", JSON.stringify(frames.slice(0, 5)));
  assert(frames.some((f) => f.opacity > 0.02 && f.opacity < 0.98) && frames.at(-1).opacity === 1, "it fades in", JSON.stringify(frames.slice(0, 8)));
  // The fade's own timing, read as it starts: a frame-sampled duration is too noisy on a busy machine.
  assert(frames[0]?.fade?.some((d) => d >= 160 && d <= 180), "over 160–180ms", JSON.stringify(frames[0]?.fade));
  await context.close();
}

/** The Program editor's page sheet keeps keyboard Tab inside it, as the other modals do (#480). */
async function editorSheetTab(browser) {
  phase("Tab stays inside the Program editor's page sheet");
  const { context, page } = await sheetPage(browser);
  await page.click('nav button[data-view="program"]');
  await page.click("#programEditToggle");
  await page.waitForSelector("#program.sheet.is-open");
  const real = [];
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    real.push(await page.evaluate(() => !!document.activeElement?.closest("#program.sheet")));
  }
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Shift+Tab");
    real.push(await page.evaluate(() => !!document.activeElement?.closest("#program.sheet")));
  }
  assert(real.every(Boolean), "60 Tabs and 10 Shift+Tabs never leave the sheet", real.map(Number).join(""));
  await context.close();
}

/* ---- Navigation bars (Plan 075 phase 3, ADR 0023) ---- */

const BAR_KEY = "repforge_v1";

/** Writes `log` into both replicas over whatever the page currently holds. */
async function persistLog(page, log) {
  await page.evaluate(async ({ k, log }) => {
    const state = JSON.parse(localStorage.getItem(k) || "{}");
    state.log = log;
    localStorage.setItem(k, JSON.stringify(state));
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("repforge", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(state, k);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { k: BAR_KEY, log });
}

/** The bar's own material, read from computed style; `glass` is `--bar-glass`
 * resolved through a probe element, so `background` compares like for like. */
const barMaterial = (page, barSel) => page.evaluate((sel) => {
  const bar = document.querySelector(sel);
  const bg = bar.querySelector(".topbar__bg"), title = bar.querySelector(".topbar__title");
  const bgStyle = getComputedStyle(bg), titleStyle = getComputedStyle(title);
  const probe = document.createElement("div");
  probe.style.background = "var(--bar-glass)";
  document.body.append(probe);
  const glass = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return {
    scrolled: bar.classList.contains("is-scrolled"),
    backdropFilter: bgStyle.backdropFilter,
    background: bgStyle.backgroundColor, glass,
    titleOpacity: Number(titleStyle.opacity),
    titleFontSize: Math.round(parseFloat(titleStyle.fontSize) * 100) / 100,
  };
}, barSel);

const scrollToEnd = (page) => page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
const waitScrolled = (page, barSel, want = true) => page.waitForFunction(
  ([s, w]) => document.querySelector(s)?.classList.contains("is-scrolled") === w, [barSel, want], { timeout: 3000 }
).then(() => true, () => false);
/** The title's own opacity transition (160ms) runs after the class flips, so
 * a read taken straight after `waitScrolled` can still catch its start value;
 * wait for the transition's end state instead of reading right after the class change. */
const waitTitleOpacity = (page, barSel, want) => page.waitForFunction(
  ([s, w]) => Number(getComputedStyle(document.querySelector(`${s} .topbar__title`)).opacity) === w, [barSel, want], { timeout: 2000 }
).then(() => true, () => false);

/**
 * The scroll-edge bar over Today's large title (ADR 0023, audit F-9, F-11):
 * silent until the title has scrolled under it, then the material and the
 * mirrored inline title appear together, in both themes, opaque under
 * reduced transparency, and capped at 21px under large text.
 */
/**
 * Owner, iPhone (2026-10-23): the Program editor's page sheet keeps the page's gutters, the Program page under it
 * stays laid out as it is while the sheet is dragged, and a root page's trailing action is a button in its bar.
 */
/**
 * A per-side value never widens a page (owner, iPhone, 2026-10-23): with a per-side lift logged in the block, no page
 * has a sideways scroll range at 375 or 390px, in English or Portuguese, at 100% or 200% text; a per-side figure stays
 * inside its row and says "per side" on its own quiet line, which is part of the row's accessible name.
 */
async function perSideOverflow(browser) {
  phase("A per-side value never widens the page");
  const PRESS = "library:1a05c6f170d8803ba48ec1443eab5978";
  for (const width of [375, 390]) for (const lang of ["en", "pt"]) for (const text of ["normal", "text200"]) {
    const label = `${width} ${lang} ${text}`;
    const { context, page } = await openCatalogState(browser, "progress/strength-comparison", width, lang, text, { height: width === 375 ? 812 : undefined });
    const wide = () => page.evaluate(() => { const s = document.scrollingElement; return s.scrollWidth > s.clientWidth ? `${s.scrollWidth}>${s.clientWidth}` : ""; });
    const overflowing = [];
    const visit = async (name, go) => { await go(); await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))); const w = await wide(); if (w) overflowing.push(`${name} ${w}`); };
    for (const seg of ["overview", "strength", "volume", "prs", "review"])
      await visit(`progress/${seg}`, () => page.evaluate((s) => window.__repforgeStatsNav.setStatsSeg(s), seg));
    // The per-side figures: inside their rows, and named with their qualifier.
    await page.evaluate(() => window.__repforgeStatsNav.setStatsSeg("overview"));
    const rows = await page.evaluate(() => [...document.querySelectorAll("#overviewStrength .strrow"), ...document.querySelectorAll("#strengthDash .evrow--d")]
      .map((row) => { const fig = row.querySelector(".strrow__fig, .evrow__val"), r = row.getBoundingClientRect(), f = fig?.getBoundingClientRect();
        return { text: row.textContent.replace(/\s+/g, " ").trim().slice(0, 60), inside: !f || f.right <= r.right + 0.5, perSide: !!row.querySelector(".per-side") }; }));
    const qualified = await page.getByRole("button", { name: lang === "pt" ? /por lado/i : /per side/i }).count();
    await visit("exercise view", async () => { await page.evaluate((key) => window.openExerciseView(key, "stats"), PRESS); await page.waitForSelector("#exercise.view.active"); });
    await visit("history list", async () => { await page.click("#exBack"); await page.waitForFunction(() => !document.body.classList.contains("is-exercise")); await page.evaluate(() => document.querySelector('nav button[data-view="history"]').click()); await page.waitForSelector("#history.view.active"); });
    await visit("history session", async () => { await page.locator('#sessions .hist-row[data-sess="per-side-history-latest"] .session__open').click(); await page.waitForSelector("#history.is-session-page"); });
    await visit("today", async () => { await page.evaluate(() => document.querySelector('nav button[data-view="log"]').click()); await page.waitForSelector("#log.view.active"); });
    await visit("program", async () => { await page.evaluate(() => document.querySelector('nav button[data-view="program"]').click()); await page.waitForSelector("#program.view.active"); });
    assert(!overflowing.length, `${label}: no page scrolls sideways`, overflowing.join("; "));
    assert(rows.length && rows.every((row) => row.inside), `${label}: every strength figure stays inside its row`, JSON.stringify(rows.filter((row) => !row.inside)));
    assert(rows.some((row) => row.perSide) && qualified > 0, `${label}: a per-side figure carries its qualifier, in the row's accessible name`, JSON.stringify({ qualified, rows: rows.filter((row) => row.perSide) }));
    await context.close();
  }
}

async function editorSheetAndBar(browser) {
  phase("The editor sheet's content keeps the page gutters");
  {
    const { context, page } = await sheetPage(browser);
    await page.click('nav button[data-view="program"]');
    // The settled Program page: the size of each line of text in it, before the sheet takes it.
    const leaves = (root) => [...root.querySelectorAll("*")].filter((el) => !el.children.length && el.textContent.trim())
      .slice(0, 24).map((el) => [el.textContent.trim().slice(0, 24), el.offsetWidth, el.offsetHeight]);
    const settled = await page.evaluate((fn) => new Function("root", `return (${fn})(root)`)(document.querySelector("#program")), leaves.toString());
    await page.click("#programEditToggle");
    await page.waitForSelector("#program.sheet.is-open");
    await sheetAtRest(page, "#program.sheet");
    const insets = await page.evaluate(() => {
      const hint = document.querySelector("#program.sheet .program-editor-a__hint").getBoundingClientRect();
      const tabs = document.querySelector("#program.sheet .review__tabs"), first = tabs.querySelector(".review__tab").getBoundingClientRect();
      return { left: hint.left, right: window.innerWidth - hint.right, firstTab: first.left - tabs.getBoundingClientRect().left + tabs.scrollLeft,
        tabsLeft: tabs.getBoundingClientRect().left, tabsRight: window.innerWidth - tabs.getBoundingClientRect().right };
    });
    assert(insets.left === 16 && insets.right === 16, "the sheet's content sits inside the page's 16px gutters", JSON.stringify(insets));
    assert(insets.tabsLeft === 0 && insets.tabsRight === 0 && insets.firstTab === 16,
      "the day tabs run edge to edge and scroll, with the first tab inset to the gutter", JSON.stringify(insets));

    phase("While the sheet is dragged down, the Program page beneath keeps its layout");
    // The editor sheet's drag rail is its head (data-sheet-rail), clear of Cancel and Done.
    const rail = await page.locator("#program.sheet > .pagehead .pagehead__titles").boundingBox();
    const from = { x: Math.round(rail.x + rail.width / 2), y: Math.round(rail.y + rail.height / 2) };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (const dy of [30, 80, 140, 200]) {
      await page.mouse.move(from.x, from.y + dy);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
    }
    const mid = await page.evaluate((fn) => new Function("root", `return (${fn})(root)`)(document.querySelector(".is-editor-pushed-back")), leaves.toString());
    await page.mouse.up();
    assert(JSON.stringify(mid) === JSON.stringify(settled), "mid-drag, every line of the page beneath has the settled page's size (no word broken per letter)",
      JSON.stringify({ settled: settled.slice(0, 6), mid: mid.slice(0, 6) }));
    await context.close();
  }

  phase("Edit is a button in the Program page's bar, at the top and scrolled");
  {
    const { context, page } = await sheetPage(browser);
    await page.click('nav button[data-view="program"]');
    const read = () => page.evaluate(() => {
      const edit = document.querySelector("#programEditToggle"), r = edit.getBoundingClientRect(), style = getComputedStyle(edit);
      const probe = document.createElement("span"); probe.style.color = "var(--accent-deep)"; document.body.append(probe);
      const accent = getComputedStyle(probe).color; probe.remove();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { top: r.top, bottom: r.bottom, right: window.innerWidth - r.right, height: r.height, decoration: style.textDecorationLine,
        accent: style.color === accent, hit: hit === edit || edit.contains(hit) };
    });
    const top = await read();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(() => document.querySelector("#programTopbar").classList.contains("is-scrolled"));
    const scrolled = await read();
    for (const [label, at] of [["at the top", top], ["scrolled", scrolled]]) {
      assert(at.top >= 0 && at.bottom <= 44 && at.height === 44 && at.hit, `${label}: Edit is a 44pt button in the bar's row, nothing over it`, JSON.stringify(at));
      assert(at.decoration === "none" && at.accent, `${label}: plain accent text, no underline`, JSON.stringify(at));
    }
    assert(top.top === scrolled.top && top.right === scrolled.right, "it keeps the same place in both states", JSON.stringify({ top, scrolled }));
    await context.close();
  }
}

async function navigationBars(browser) {
  phase("No material at the top; scrolling the title under the bar reveals it");
  {
    const { context, page } = await todayPage(browser);
    const atTop = await barMaterial(page, "#logTopbar");
    assert(!atTop.scrolled && atTop.backdropFilter === "none" && atTop.titleOpacity === 0,
      "no material at the top", JSON.stringify(atTop));
    await scrollToEnd(page);
    const reachedScrolled = await waitScrolled(page, "#logTopbar", true);
    assert(reachedScrolled, "the bar reaches its scrolled state");
    await waitTitleOpacity(page, "#logTopbar", 1);
    const scrolled = await barMaterial(page, "#logTopbar");
    assert(scrolled.titleOpacity === 1 && scrolled.backdropFilter !== "none" && scrolled.background === scrolled.glass,
      "the inline title and the bar's material appear together", JSON.stringify(scrolled));
    assert(scrolled.backdropFilter === "blur(20px) saturate(1.8)", "the material is the kit's frosted glass: blur(20px) saturate(180%)", JSON.stringify(scrolled));
    await page.evaluate(() => window.scrollTo(0, 0));
    const reachedTop = await waitScrolled(page, "#logTopbar", false);
    assert(reachedTop, "scrolling back up clears both again");
    await context.close();
  }

  phase("The bar's blur reaches the page beneath it in the catalog's settled Today");
  {
    // The catalog settles every animation with finish() before it shoots. A view entry animation held by its fill
    // made the view a backdrop root, and the rows read crisply through 72% paper (owner review of #484's side-by-side).
    const { context, page } = await openCatalogState(browser, "today/ready", 390, "en", "normal");
    // The fidelity shot's offset: the prescription rows sit under the bar.
    await page.evaluate(() => window.scrollTo(0, 420));
    await waitScrolled(page, "#logTopbar", true);
    await waitTitleOpacity(page, "#logTopbar", 1);
    const box = await page.locator("#logTopbar .topbar__bg").boundingBox();
    const shot = await page.screenshot({ clip: box });
    // The sharpest step between neighbouring pixels in the bar's left part, clear of its own title: a row's text
    // read through the paper is a step of about 50 levels; through the blur it is a smooth wash of 1 or 2.
    const edge = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const w = Math.round(img.width * 0.35), h = Math.round(img.height * 0.9), d = ctx.getImageData(0, 0, w, h).data;
      let max = 0;
      for (let y = 0; y < h; y++) for (let x = 1; x < w; x++) {
        const q = (y * w + x) * 4, r = q - 4;
        max = Math.max(max, Math.abs((d[q] + d[q + 1] + d[q + 2]) / 3 - (d[r] + d[r + 1] + d[r + 2]) / 3));
      }
      return max;
    }, shot.toString("base64"));
    assert(edge < 12, "nothing under the bar stays legible: its blur reaches the rows beneath it", String(edge));
    await context.close();
  }

  phase("Dark theme takes its own bar material");
  {
    const { context, page } = await todayPage(browser, { theme: "dark" });
    await scrollToEnd(page);
    await waitScrolled(page, "#logTopbar", true);
    const dark = await barMaterial(page, "#logTopbar");
    assert(dark.background === dark.glass, "dark reads its own --bar-glass", JSON.stringify(dark));
    await context.close();
  }

  phase("Reduced transparency makes the material opaque");
  {
    const { context, page } = await todayPage(browser);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
    await scrollToEnd(page);
    await waitScrolled(page, "#logTopbar", true);
    const opaque = await barMaterial(page, "#logTopbar");
    const alpha = Number((opaque.background.match(/^rgba\(([^)]+)\)$/)?.[1] ?? "").split(",")[3]);
    assert(opaque.backdropFilter === "none" && (Number.isNaN(alpha) || alpha === 1),
      "reduced transparency drops the blur and reads opaque", JSON.stringify({ opaque, alpha }));
    await context.close();
  }

  phase("The bar title caps at 21px under large text");
  {
    const { context, page } = await todayPage(browser);
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await scrollToEnd(page);
    await waitScrolled(page, "#logTopbar", true);
    const big = await barMaterial(page, "#logTopbar");
    assert(big.titleFontSize <= 21, "the inline title caps at 21px", String(big.titleFontSize));
    await context.close();
  }

  phase("Re-tap on the current tab scrolls to the top");
  {
    const { context, page } = await todayPage(browser);
    await scrollToEnd(page);
    const before = await page.evaluate(() => window.scrollY);
    assert(before > 0, "the page is scrolled before the re-tap", String(before));
    await page.click('nav button[data-view="log"]');
    const reachedTop = await page.waitForFunction(() => window.scrollY === 0, undefined, { timeout: 3000 }).then(() => true, () => false);
    assert(reachedTop, "re-tapping the current tab scrolls it to the top");
    await context.close();
  }
  {
    const { context, page } = await todayPage(browser, { reducedMotion: "reduce" });
    await scrollToEnd(page);
    const before = await page.evaluate(() => window.scrollY);
    assert(before > 0, "(reduced motion) the page is scrolled before the re-tap", String(before));
    await page.click('nav button[data-view="log"]');
    const after = await page.evaluate(() => window.scrollY);
    assert(after === 0, "under reduced motion the re-tap lands at the top on the same tick, with nothing to await", String(after));
    await context.close();
  }

  phase("Re-tap on a History session page returns to the list");
  {
    const { context, page } = await todayPage(browser);
    const state = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), BAR_KEY);
    const day1 = state.program[0];
    const log = [metricLogRow(state.programMeta, day1, { session: "nf-bar", date: "2026-03-03", set: 1, load: 80, reps: 8, rir: 1 })];
    await persistLog(page, log);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.click('nav button[data-view="history"]');
    await page.waitForSelector("#sessions [data-sess] .session__open");
    await page.click("#sessions [data-sess] .session__open");
    // Re-tap while the session page is still pushing in: its moving copy of the list must not count as a second page.
    const opened = await page.waitForFunction(() => document.querySelector("#history")?.classList.contains("is-session-page")
      && document.body.classList.contains("is-pushing"), undefined, { timeout: 3000 })
      .then(() => true, () => false);
    assert(opened, "a session row opens the session page");
    await page.evaluate(() => document.querySelector('nav button[data-view="history"]').click());
    const back = await page.waitForFunction(() => !document.querySelector("#history")?.classList.contains("is-session-page"), undefined, { timeout: 3000 })
      .then(() => true, () => false);
    assert(back, "re-tapping History from its session page returns to the list");
    await context.close();
  }

  phase("A back swipe on a History session page shows the list beneath it");
  {
    const { context, page, touch } = await todayPage(browser);
    const state = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), BAR_KEY);
    const log = [metricLogRow(state.programMeta, state.program[0], { session: "nf-swipe", date: "2026-03-03", set: 1, load: 80, reps: 8, rir: 1 })];
    await persistLog(page, log);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.click('nav button[data-view="history"]');
    await page.waitForSelector("#sessions [data-sess] .session__open");
    await page.click("#sessions [data-sess] .session__open");
    await page.waitForFunction(() => document.querySelector("#history")?.classList.contains("is-session-page") && !document.body.classList.contains("is-pushing"));
    // One logged set makes a short session page: start the drag on it, not below it.
    const y = await page.evaluate(() => { const r = document.querySelector("#history").getBoundingClientRect(); return Math.round(Math.min(r.bottom - 40, 400)); });
    await touch("touchStart", [{ x: 120, y }]);
    for (const x of [140, 170, 210, 250]) await touch("touchMove", [{ x, y }]);
    const mid = await page.waitForFunction(() => {
      // The copy keeps the root id its #history styles need, as the push ghost does; the live page comes first.
      const under = document.querySelector(".is-push-under");
      if (!under) return null;
      // The page beneath is inert and ignores pointers; let hit-testing see it for one read of which paints on top.
      const inert = under.inert;
      under.inert = false; under.style.pointerEvents = "auto";
      const top = document.elementFromPoint(250, 200);
      under.inert = inert; under.style.removeProperty("pointer-events");
      return {
        list: !!under.querySelector(".session__open"), live: under === document.getElementById("history"), active: under.classList.contains("active"),
        hidden: under.inert && under.getAttribute("aria-hidden") === "true", pageOnTop: !!top && !under.contains(top) && document.getElementById("history").contains(top),
      };
    }, undefined, { timeout: 2000 }).then((h) => h.jsonValue(), () => null);
    assert(mid && mid.list && !mid.live && !mid.active && mid.hidden, "the History list is beneath the session page, inert", JSON.stringify(mid));
    assert(mid && mid.pageOnTop, "the session page being swiped paints above the list beneath it", JSON.stringify(mid));
    await touch("touchEnd");
    const gone = await page.waitForFunction(() => !document.querySelector(".is-push-under"), undefined, { timeout: 3000 }).then(() => true, () => false);
    assert(gone, "the list copy leaves with the swipe");
    await context.close();
  }
}

/** Focus at 200%, measured in the page: the rest block, the ledger's text, the open set against the shelf, the pads. */
function measureLargeFocus() {
  const art = document.querySelector("#workout .exercise--focus.is-current");
  if (!art) return { error: "no live Focus card" };
  const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
  const textBoxes = (root) => {
    const out = [];
    if (!root) return out;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim() || !node.parentElement.getClientRects().length) continue;
      if (node.parentElement.closest(".visually-hidden,[hidden]")) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) if (r.width > 1 && r.height > 1) out.push({ text: node.textContent.trim().slice(0, 14), left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    }
    return out;
  };
  const overprints = (boxes) => {
    const hits = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const across = Math.min(a.right, b.right) - Math.max(a.left, b.left), down = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (across > 1 && down > 0.35 * Math.min(a.bottom - a.top, b.bottom - b.top)) hits.push(`${a.text} / ${b.text}`);
    }
    return hits;
  };
  const q = (s) => art.querySelector(s);
  // The rest timer redesign: the rest is the tab that rises out of the shelf's top edge.
  const rest = document.querySelector("#restTab");
  const context = q(".fcard__context"), shelf = q(".focus-shelf"), open = q(".ledgerline--open");
  const title = document.querySelector("#woDayTitle .wo-head__name") || document.querySelector("#woDayTitle");
  const pads = [...art.querySelectorAll(".shelf__pads > button")];
  const padRow = q(".shelf__pads");
  const restText = textBoxes(rest), ledgerText = textBoxes(q(".fcard__ledger"));
  return {
    width: innerWidth,
    titleSize: parseFloat(getComputedStyle(title).fontSize),
    rest: rest && {
      tab: box(rest),
      outside: restText.filter((r) => r.left < -0.5 || r.right > innerWidth + 0.5).map((r) => r.text),
      overprinted: overprints(restText),
      clipped: [...rest.querySelectorAll("span")].filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== "none").length,
    },
    ledgerOverprinted: overprints(ledgerText),
    ledgerOutside: ledgerText.filter((r) => r.left < -0.5 || r.right > innerWidth + 0.5).map((r) => r.text),
    open: open && box(open), context: context && box(context), shelf: shelf && box(shelf),
    pads: pads.map((b) => ({ text: b.textContent.trim(), top: Math.round(b.getBoundingClientRect().top), clipped: b.scrollWidth > b.clientWidth + 1 })),
    padsScroll: padRow && { overflows: padRow.scrollWidth > padRow.clientWidth + 1, scrolls: ["auto", "scroll"].includes(getComputedStyle(padRow).overflowX) },
  };
}

/** Until the open set, its context, the shelf and the banner hold the same boxes for ten frames running: the open
 *  set scrolls into place after the session opens, so a fixed wait can measure it mid-scroll. */
async function focusSettled(page) {
  await page.evaluate(() => new Promise((resolve, reject) => {
    const sel = [".ledgerline--open", ".fcard__context", ".focus-shelf"].map((s) => `#workout .exercise--focus.is-current ${s}`).concat("#fatigue");
    let last = "", same = 0, frames = 0;
    const tick = () => {
      const now = JSON.stringify(sel.map((s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return [r.top, r.bottom, r.height]; }))
        + document.scrollingElement.scrollTop + [...document.querySelectorAll("#workout *")].filter((el) => el.scrollTop).map((el) => el.scrollTop).join();
      same = now === last ? same + 1 : 0; last = now;
      if (same >= 10) return resolve();
      if (++frames > 600) return reject(new Error("Focus never settled"));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
}

/** Phase 5 (F-1): Focus at 200% text, in both languages, on the canonical phone and an SE-class one. */
async function largeTextFocus(browser) {
  phase("Focus holds together at 200% text");
  const phones = [{ width: 390, height: 844, safe: { top: 44, bottom: 34 } }, { width: 375, height: 667, safe: { top: 20, bottom: 0 } }];
  for (const key of ["workout/rest-running", "workout/focus", "workout/focus-per-side"]) for (const lang of ["pt", "en"]) for (const phone of phones) {
    const label = `${key} ${lang} ${phone.width}×${phone.height}`;
    const opened = await openCatalogState(browser, key, phone.width, lang, "text200", { height: phone.height, safe: phone.safe });
    try {
      const m = await opened.page.evaluate(measureLargeFocus);
      if (m.error) { assert(false, label, m.error); continue; }
      if (key === "workout/rest-running") {
        assert(!!m.rest && !m.rest.outside.length && !m.rest.overprinted.length && !m.rest.clipped, `${label}: the rest tab's text is whole, on screen and not overprinted`,
          JSON.stringify(m.rest));
        assert(!!m.rest && m.rest.tab.left >= -0.5 && m.rest.tab.right <= m.width + 0.5 && m.rest.tab.bottom - m.rest.tab.top >= 44,
          `${label}: the tab is a full target inside the screen`, JSON.stringify(m.rest));
      }
      assert(m.titleSize <= 21, `${label}: the bar title is capped at 21px`, String(m.titleSize));
      assert(!m.ledgerOverprinted.length && !m.ledgerOutside.length, `${label}: no ledger text overprints or leaves the screen`,
        JSON.stringify({ overprinted: m.ledgerOverprinted, outside: m.ledgerOutside }));
      assert(!!m.open && m.open.top >= m.context.top - 0.5 && m.open.bottom <= m.shelf.top + 0.5,
        `${label}: the open set is whole above the shelf`, JSON.stringify({ open: m.open, context: m.context, shelf: m.shelf }));
      assert(m.pads.length > 0 && m.pads.every((p) => p.top === m.pads[0].top) && m.pads.every((p) => !p.clipped)
        && (!m.padsScroll.overflows || m.padsScroll.scrolls), `${label}: the pads keep one row, whole, scrolling sideways if they must`,
        JSON.stringify({ pads: m.pads, row: m.padsScroll }));
    } finally {
      await opened.context.close();
    }
  }
  // #541: a banner-bearing session (Day 2 raises "Possible fatigue") at 200% on the SE-class and canonical phones, in
  // both languages. The banner gives way, scrolling inside itself, and the open set stays whole between it and the shelf.
  phase("Focus at 200% text with a fatigue banner: the open set stays whole");
  for (const lang of ["pt", "en"]) for (const phone of phones) {
    const label = `fatigue banner ${lang} ${phone.width}×${phone.height}`;
    const opened = await openCatalogState(browser, "today/ready", phone.width, lang, "text200", { height: phone.height, safe: phone.safe });
    try {
      await opened.page.evaluate(() => window.__repforgeEnterWorkout({ day: "Day 2" }));
      await opened.page.waitForSelector("#workout .exercise.is-current .focus-shelf", { timeout: 15000 });
      await focusSettled(opened.page);
      const m = await opened.page.evaluate(measureLargeFocus);
      const banner = await opened.page.evaluate(() => { const el = document.querySelector("#fatigue:not(.hidden)"); return el ? { height: el.getBoundingClientRect().height, scrolls: getComputedStyle(el).overflowY } : null; });
      if (m.error) { assert(false, label, m.error); continue; }
      assert(!!banner, `${label}: the session shows its fatigue banner`, JSON.stringify(banner));
      assert(!!m.open && m.open.top >= m.context.top - 0.5 && m.open.bottom <= m.shelf.top + 0.5,
        `${label}: the open set is whole between the banner and the shelf`, JSON.stringify({ open: m.open, context: m.context, shelf: m.shelf, banner }));
    } finally {
      await opened.context.close();
    }
  }
}

/** The dock as measured: its rows, height, label size and fit, and how opaque its material is. */
function measureDock() {
  const nav = document.querySelector("nav");
  const buttons = [...nav.querySelectorAll(":scope > button")];
  const alpha = (color) => { const m = color.match(/rgba?\(([^)]+)\)/); const parts = m ? m[1].split(/[ ,/]+/).filter(Boolean) : []; return parts.length > 3 ? parseFloat(parts[3]) : 1; };
  return {
    height: nav.getBoundingClientRect().height,
    rows: new Set(buttons.map((b) => Math.round(b.getBoundingClientRect().top))).size,
    labels: buttons.map((b) => {
      const label = b.querySelector("[data-i18n]");
      return { text: label.textContent.trim(), size: parseFloat(getComputedStyle(label).fontSize), fits: label.scrollWidth <= label.clientWidth + 1,
        name: b.getAttribute("aria-label") || b.textContent.trim() };
    }),
    alpha: alpha(getComputedStyle(nav).backgroundColor),
  };
}

/** Phase 5 (F-5): one row and one height at 200%, capped labels, and the large-content viewer on touch and hold. */
async function largeTextDock(browser) {
  phase("The dock keeps one row at 200% text, and touch and hold shows the large-content viewer");
  const normal = await (async () => {
    const opened = await openCatalogState(browser, "today/ready", 390, "en", "normal");
    try { return await opened.page.evaluate(measureDock); } finally { await opened.context.close(); }
  })();
  for (const lang of ["en", "pt"]) {
    const opened = await openCatalogState(browser, "today/ready", 390, lang, "text200");
    try {
      const m = await opened.page.evaluate(measureDock);
      assert(m.rows === 1 && Math.abs(m.height - normal.height) < 0.5, `${lang}: one row at the usual height`, JSON.stringify({ rows: m.rows, height: m.height, normal: normal.height }));
      assert(m.labels.every((l) => l.size <= 14.3 && l.fits && l.name === l.text), `${lang}: every label is capped at 1.3×, whole, and names its tab`, JSON.stringify(m.labels));
      assert(m.alpha >= 0.95, `${lang}: the capped dock is on its opaque material`, String(m.alpha));
    } finally {
      await opened.context.close();
    }
  }

  const { context, page, touch } = await todayPage(browser);
  const centre = async (view) => { const { x, y } = await center(page, `nav button[data-view="${view}"]`); return { x, y }; };
  const viewer = () => page.evaluate(() => {
    const el = document.querySelector(".dock-viewer");
    if (!el || !el.getClientRects().length) return null;
    const label = el.querySelector(".dock-viewer__label");
    return { text: label?.textContent.trim(), size: label && parseFloat(getComputedStyle(label).fontSize), icon: !!el.querySelector(".nav__icon"),
      hidden: el.getAttribute("aria-hidden") };
  });
  const active = () => page.evaluate(() => ({ tab: document.querySelector('nav button[aria-current="page"]')?.dataset.view, view: document.querySelector(".view.active")?.id }));
  const shows = (text) => page.waitForFunction((t) => document.querySelector(".dock-viewer .dock-viewer__label")?.textContent.trim() === t, text, { timeout: 3000 }).then(() => true, () => false);

  // At the usual size the labels are whole, so a hold shows nothing and a tap switches as always.
  const p0 = await centre("stats");
  await touch("touchStart", [p0]);
  // A hold is a duration: well past the viewer's delay, with nothing to wait for if it is right.
  await page.waitForTimeout(700);
  const none = await viewer();
  await touch("touchEnd");
  assert(none === null, "at the usual size a hold shows no viewer", JSON.stringify(none));
  assert((await active()).tab === "stats", "and lifting is a tap on the tab", JSON.stringify(await active()));
  await page.click('nav button[data-view="log"]');

  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const p1 = await centre("stats");
  await touch("touchStart", [p1]);
  const shown = await shows("Progress");
  const first = await viewer();
  assert(shown && first.icon && first.size >= 28 && first.hidden === "true", "a hold on Progress shows its name and icon large, hidden from assistive tech (the tab keeps its name)", JSON.stringify(first));
  assert((await active()).tab === "log", "the hold alone does not switch", JSON.stringify(await active()));
  const p2 = await centre("history");
  await touch("touchMove", [{ x: (p1.x + p2.x) / 2, y: p2.y }]);
  await touch("touchMove", [p2]);
  const slid = await shows("History");
  await touch("touchEnd");
  const landed = await page.waitForFunction(() => document.querySelector('nav button[aria-current="page"]')?.dataset.view === "history"
    && !document.querySelector(".dock-viewer"), undefined, { timeout: 3000 }).then(() => true, () => false);
  assert(slid && landed, "sliding moves the viewer to History, and lifting switches to History and closes the viewer", JSON.stringify({ slid, ...(await active()) }));
  assert((await active()).view === "history", "the History view is the one shown", JSON.stringify(await active()));

  const p3 = await centre("program");
  await touch("touchStart", [p3]);
  await shows("Program");
  await touch("touchCancel");
  const cancelled = await page.waitForFunction(() => !document.querySelector(".dock-viewer"), undefined, { timeout: 3000 }).then(() => true, () => false);
  assert(cancelled && (await active()).tab === "history", "a cancelled hold closes the viewer and switches nothing", JSON.stringify(await active()));

  const p4 = await centre("log");
  await touch("touchStart", [p4]);
  await touch("touchEnd");
  const tapped = await page.waitForFunction(() => document.querySelector('nav button[aria-current="page"]')?.dataset.view === "log", undefined, { timeout: 3000 }).then(() => true, () => false);
  assert(tapped && !(await viewer()), "a quick tap at 200% still switches, with no viewer", JSON.stringify(await active()));
  await context.close();
}

/** The addendum's shelf, measured: radii, insets, gaps, the per-side caption and names, and label wraps. */
function measureShelf() {
  const shelf = document.querySelector("#workout .exercise--focus.is-current .focus-shelf");
  if (!shelf) return { error: "no Focus shelf" };
  const css = (el) => getComputedStyle(el);
  const px = (v) => parseFloat(v) || 0;
  const radius = (el) => px(css(el).borderTopLeftRadius);
  const tiles = [...shelf.querySelectorAll(".shelf__fields > .shelf__field .shelf__fieldbtn, .shelf__group")];
  const pads = [...shelf.querySelectorAll(".shelf__pads > button")];
  const action = shelf.querySelector("[data-save]");
  const fields = shelf.querySelector(".shelf__fields"), padRow = shelf.querySelector(".shelf__pads");
  const caps = [...shelf.querySelectorAll(".shelf__cap")].filter((el) => el.getClientRects().length);
  const perSide = window.RepForgeI18n.t("focus.per_side");
  const groupButtons = [...shelf.querySelectorAll(".shelf__group .shelf__fieldbtn")];
  const name = (b) => (b.getAttribute("aria-label") || b.textContent).replace(/\s+/g, " ").trim();
  const labels = [...shelf.querySelectorAll(".shelf__fieldbtn > .shelf__lab")].map((el) => {
    // The visible label only: a visually hidden rest of the name is read, not drawn.
    const rects = [...el.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).flatMap((node) => {
      const range = document.createRange(); range.selectNodeContents(node); return [...range.getClientRects()];
    });
    const lines = new Set(rects.filter((r) => r.width > 1 && r.height > 1).map((r) => Math.round(r.top))).size;
    return { text: el.textContent.trim(), lines };
  });
  const s = css(shelf);
  const bg = css(document.documentElement).getPropertyValue("--bg").trim();
  const probe = document.createElement("i"); probe.style.color = bg; document.body.append(probe);
  const bgColor = css(probe).color; probe.remove();
  const outlined = [...tiles, ...pads].filter((el) => ["Top", "Right", "Bottom", "Left"].some((side) =>
    px(css(el)[`border${side}Width`]) > 0 && !/rgba\(.*,\s*0\)$|transparent/.test(css(el)[`border${side}Color`])));
  const selected = shelf.querySelector('.shelf__fieldbtn[aria-pressed="true"]');
  return {
    outlined: outlined.map((el) => el.className), fills: [...tiles.filter((el) => !el.closest(".shelf__group") || el.matches(".shelf__group")), ...pads]
      .map((el) => css(el).backgroundColor), bgColor, ring: selected ? css(selected).boxShadow : "none",
    sheet: radius(shelf), inset: { top: px(s.paddingTop), left: px(s.paddingLeft), right: px(s.paddingRight) }, rowGap: px(s.rowGap),
    radii: [...tiles, ...pads, action].map(radius),
    gaps: { fields: px(css(fields).columnGap), pads: px(css(padRow).columnGap) },
    caps: caps.map((el) => ({ text: el.textContent.trim(), upper: css(el).textTransform })), perSide,
    groupNames: groupButtons.map(name), labels,
  };
}

/** Phase 5 addendum: the concentric shelf and its grouped "Per side". */
async function concentricShelf(browser) {
  phase("The Focus shelf is concentric, and says Per side once");
  const phones = [{ width: 390, height: 844, safe: { top: 44, bottom: 34 } }, { width: 375, height: 667, safe: { top: 20, bottom: 0 } }];
  for (const key of ["workout/focus", "workout/focus-per-side"]) for (const lang of ["en", "pt"]) for (const phone of phones) for (const theme of ["light", "dark"]) {
    if (theme === "dark" && (lang === "pt" || phone.width !== 390)) continue;
    const label = `${key} ${lang} ${phone.width} ${theme}`;
    const opened = await openCatalogState(browser, key, phone.width, lang, "normal", { height: phone.height, safe: phone.safe, theme });
    try {
      const m = await opened.page.evaluate(measureShelf);
      if (m.error) { assert(false, label, m.error); continue; }
      const inner = m.sheet - m.inset.left;
      assert(m.sheet === 28 && m.inset.top === 16 && m.inset.left === 16 && m.inset.right === 16,
        `${label}: a 28px sheet with 16px insets`, JSON.stringify({ sheet: m.sheet, inset: m.inset }));
      assert(inner === 12 && m.radii.every((r) => r === inner), `${label}: every field, pad and Log set is 12px, the sheet minus its inset`, JSON.stringify(m.radii));
      assert(m.gaps.fields === 8 && m.gaps.pads === 8 && m.rowGap === 12, `${label}: 8px between siblings and 12px between rows`, JSON.stringify({ gaps: m.gaps, rowGap: m.rowGap }));
      assert(m.labels.every((l) => l.lines === 1), `${label}: no field label wraps`, JSON.stringify(m.labels));
      assert(!m.outlined.length && m.fills.every((f) => f === m.bgColor) && m.ring !== "none",
        `${label}: quiet tiles on --bg with no outline, and the selected field keeps its ring`, JSON.stringify({ outlined: m.outlined, fills: m.fills, bg: m.bgColor, ring: m.ring }));
      if (key === "workout/focus-per-side") {
        assert(m.caps.length === 1 && m.caps[0].text === m.perSide && m.caps[0].upper === "uppercase", `${label}: exactly one "Per side" caption`, JSON.stringify(m.caps));
        assert(m.groupNames.length >= 1 && m.groupNames.every((n) => n.includes(m.perSide)), `${label}: each grouped field's name says per side`, JSON.stringify(m.groupNames));
      } else {
        assert(m.caps.length === 0, `${label}: an ordinary exercise has no caption`, JSON.stringify(m.caps));
      }
    } finally {
      await opened.context.close();
    }
  }
}

// NATIVE_FEEL_ONLY=large runs just phase 5, =shelf just its addendum, =wheel just the wheel picker and =swipe just the
// history and back-swipe phases, for a local red/green; CI runs everything.
const ONLY = process.env.NATIVE_FEEL_ONLY || "";
const browser = await launchChromium();
try {
 if (!ONLY) {
  phase("A primary action is pressed on touch-down");
  {
    const { context, page, touch } = await todayPage(browser);
    const p = await center(page, "#startWorkout");
    const rest = await pressState(page, "#startWorkout");
    const tone = await pressedTone(page);
    await touch("touchStart", [{ x: p.x, y: p.y }]);
    const down = await pressState(page, "#startWorkout");
    assert(down.pressed && !down.pending, "Start workout is pressed at touch-down, with no wait", JSON.stringify(down));
    assert(down.transition === "0s", "the press comes in with no transition", JSON.stringify(down));
    assert(down.bg === tone && down.bg !== rest.bg, "the fill takes the pressed tone one step off the primary fill",
      JSON.stringify({ rest: rest.bg, down: down.bg, tone }));
    assert(down.scale === 0.97, "the primary action scales to 0.97", JSON.stringify(down));
    await touch("touchMove", [{ x: p.x + 40, y: p.y }]);
    await touch("touchMove", [{ x: p.x + 40, y: p.y - 70 }]);
    const cleared = await reaches(page, "#startWorkout", false);
    const off = await pressState(page, "#startWorkout");
    assert(cleared, "a touch that slides off is a pan, and the press clears", JSON.stringify(off));
    assert(/^linear\(/.test(off.ease) && off.transition !== "0s", "the release returns on the pressRelease spring curve", JSON.stringify(off));
    await touch("touchEnd");
    assert(await onToday(page), "lifting after the slide doesn't start the workout");
    await context.close();
  }

  phase("Sliding off and back, where nothing pans and with the mouse");
  {
    const { context, page, touch } = await todayPage(browser);
    await page.locator("#chooseAnotherDay").click();
    await page.waitForFunction(() => document.querySelector("#dayPickSheet")?.classList.contains("is-open"));
    const sel = "#dayPickSheet .sheetband__close";
    await page.waitForFunction((s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; }, sel);
    // The sheet is at rest: no transition left, and its translation is zero.
    await page.waitForFunction(() => {
      const sheet = document.querySelector("#dayPickSheet");
      const t = getComputedStyle(sheet).transform;
      return sheet.getAnimations({ subtree: true }).length === 0 && !sheet.style.transform
        && (t === "none" || new DOMMatrixReadOnly(t).m42 === 0);
    });
    const p = await center(page, sel);
    await touch("touchStart", [{ x: p.x, y: p.y }]);
    const down = await pressState(page, sel);
    await touch("touchMove", [{ x: p.x - 70, y: p.y }]);
    const off = { pressed: !(await reaches(page, sel, false)) };
    await touch("touchMove", [{ x: p.x, y: p.y }]);
    const back = { pressed: await reaches(page, sel, true) };
    await touch("touchMove", [{ x: p.x - 70, y: p.y }]);
    await reaches(page, sel, false);
    await touch("touchEnd");
    const open = await page.evaluate(() => document.querySelector("#dayPickSheet").classList.contains("is-open"));
    assert(down.pressed && !off.pressed && back.pressed, "on the sheet's band, × is pressed, cleared by sliding off and restored by sliding back",
      JSON.stringify({ down: down.pressed, off: off.pressed, back: back.pressed }));
    assert(open, "lifting off × leaves the sheet open");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector("#dayPickSheet").hidden && document.querySelector("#dayPickScrim").classList.contains("hidden"));
    await page.waitForFunction(() => {
      const r = document.querySelector("#startWorkout").getBoundingClientRect();
      return !document.body.classList.contains("is-sheet-open")
        && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest("#startWorkout");
    });

    const s = await center(page, "#startWorkout");
    await page.mouse.move(s.x, s.y);
    await page.mouse.down();
    const mDown = await pressState(page, "#startWorkout");
    await page.mouse.move(s.x, s.box.y - 40);
    const mOff = { pressed: !(await reaches(page, "#startWorkout", false)) };
    await page.mouse.move(s.x, s.y);
    const mBack = { pressed: await reaches(page, "#startWorkout", true) };
    await page.mouse.move(s.x, s.box.y - 40);
    await reaches(page, "#startWorkout", false);
    await page.mouse.up();
    assert(mDown.pressed && !mOff.pressed && mBack.pressed, "with the mouse, the press clears off the control and returns on it",
      JSON.stringify({ down: mDown.pressed, off: mOff.pressed, back: mBack.pressed }));
    assert(await onToday(page), "releasing the mouse off the control doesn't start the workout");
    await context.close();
  }

  phase("A control in a scroller waits before it shows the press");
  {
    const { context, page, touch } = await todayPage(browser);
    await page.locator("#chooseAnotherDay").scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const el = document.querySelector("#chooseAnotherDay");
      window.__pressSeen = [];
      new MutationObserver(() => window.__pressSeen.push(el.classList.contains("is-pressed"))).observe(el, { attributes: true, attributeFilter: ["class"] });
    });
    let p = await center(page, "#chooseAnotherDay");
    await touch("touchStart", [{ x: p.x, y: p.y }]);
    await touch("touchMove", [{ x: p.x, y: p.y - 40 }]);
    await touch("touchMove", [{ x: p.x, y: p.y - 120 }]);
    await touch("touchEnd");
    const flashed = await page.evaluate(() => window.__pressSeen.some(Boolean));
    assert(!flashed, "a scroll that starts on the control never shows its press");

    await page.locator("#chooseAnotherDay").scrollIntoViewIfNeeded();
    p = await center(page, "#chooseAnotherDay");
    await touch("touchStart", [{ x: p.x, y: p.y }]);
    const early = await pressState(page, "#chooseAnotherDay");
    assert(early.pending && !early.pressed, "at touch-down the press is pending", JSON.stringify(early));
    const held = await page.waitForFunction(() => document.querySelector("#chooseAnotherDay").classList.contains("is-pressed"), undefined, { timeout: 2000 })
      .then(() => true, () => false);
    assert(held, "a held touch shows the press once the wait is over");
    await touch("touchEnd");
    await page.waitForFunction(() => document.querySelector("#dayPickSheet")?.classList.contains("is-open"), undefined, { timeout: 5000 });
    assert(!(await pressState(page, "#chooseAnotherDay")).pressed, "the tap activates the control and the press is released");
    await context.close();
  }

  phase("The keyboard shows the same press");
  {
    const { context, page } = await todayPage(browser);
    await page.focus("#chooseAnotherDay");
    await page.keyboard.down(" ");
    const down = await pressState(page, "#chooseAnotherDay");
    await page.keyboard.up(" ");
    const up = await pressState(page, "#chooseAnotherDay");
    assert(down.pressed && !up.pressed, "Space presses the focused control and releasing it lets go", JSON.stringify({ down, up }));
    await context.close();
  }

  phase("Reduced motion and dark");
  {
    const { context, page, touch } = await todayPage(browser, { reducedMotion: "reduce" });
    const p = await center(page, "#startWorkout");
    const tone = await pressedTone(page);
    await touch("touchStart", [{ x: p.x, y: p.y }]);
    const down = await pressState(page, "#startWorkout");
    await touch("touchEnd");
    assert(down.pressed && down.bg === tone && down.scale === 1, "under reduced motion the tone stays and the scale goes", JSON.stringify(down));
    await context.close();
  }
  {
    const { context, page, touch } = await todayPage(browser, { theme: "dark" });
    const p = await center(page, "#startWorkout");
    await touch("touchStart", [{ x: p.x, y: p.y }]);
    const down = await pressState(page, "#startWorkout");
    await touch("touchEnd");
    assert(down.pressed && down.bg === "rgb(201, 193, 180)" && down.scale === 0.97, "dark takes its own pressed tone", JSON.stringify(down));
    await context.close();
  }

  phase("The stylesheets press through .is-pressed");
  {
    const { context, page } = await todayPage(browser);
    const rules = await page.evaluate(() => {
      const out = { active: [], pressed: [] };
      const walk = (list) => {
        for (const rule of list) {
          if (rule.cssRules) walk(rule.cssRules);
          if (!rule.selectorText) continue;
          for (const sel of rule.selectorText.split(/,(?![^(]*\))/).map((x) => x.trim())) {
            if (/:active\b/.test(sel)) out.active.push(sel);
            if (/\.is-pressed\b/.test(sel)) out.pressed.push(sel);
          }
        }
      };
      for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch {} }
      return out;
    });
    const strayActive = rules.active.filter((sel) => !/(input|__input|drag-handle|session-map__grip)[^ ]*:active/.test(sel));
    assert(strayActive.length === 0, "only form fields and the drag handles' cursor (the editor's and the session map's grip) keep :active", strayActive.join("\n    "));
    assert(rules.pressed.length > 150, "the app's press rules are .is-pressed rules", String(rules.pressed.length));

    const missed = await page.evaluate((selectors) => {
      const out = new Set();
      for (const sel of selectors) {
        if (/(^|[\s>+~(,])\.is-pressed/.test(sel)) continue; // a rule for any pressed control, not a named one
        const subject = sel.replace(/\.is-pressed/g, "").replace(/::?(after|before)$/, "");
        let found = [];
        try { found = [...document.querySelectorAll(subject)]; } catch { continue; }
        for (const el of found) {
          if (el.matches(":disabled") || el.getAttribute("aria-disabled") === "true") continue;
          el.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 91, pointerType: "mouse", button: 0, isPrimary: true, bubbles: true, cancelable: true }));
          const took = el.classList.contains("is-pressed");
          window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 91, pointerType: "mouse", isPrimary: true, bubbles: true }));
          if (!took) out.add(`${subject} → ${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${[...el.classList].join(".")}`);
        }
      }
      return [...out];
    }, rules.pressed);
    assert(missed.length === 0, "every control a press rule names takes the press", missed.slice(0, 20).join("\n    "));
    await context.close();
  }

  await controlsWithoutMotionLayer(browser);
  await nativeEditorControls(browser);
  await nativeControls(browser);
  await detents(browser);
  await reducedMotionSheets(browser);
  await dayPickerCommits(browser);
  await libraryOverEditorSheet(browser);
  await wheelPicker(browser);
  await wheelPhysics(browser);
  await routeHistory(browser);
  await autoSwipe(browser);
  await standaloneSwipe(browser);
  await reducedMotionPush(browser);
  await editorSheetTab(browser);
  await navigationBars(browser);
  await editorSheetAndBar(browser);
  await perSideOverflow(browser);
 }
  if (ONLY === "wheel") {
    await wheelPicker(browser);
    await wheelPhysics(browser);
  }
  if (!ONLY || ONLY === "large") {
    await largeTextFocus(browser);
    await largeTextDock(browser);
  }
  if (ONLY === "swipe") {
    await routeHistory(browser);
    await autoSwipe(browser);
    await standaloneSwipe(browser);
  }
  if (!["wheel", "swipe"].includes(ONLY)) await concentricShelf(browser);
} finally {
  await browser.close();
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
