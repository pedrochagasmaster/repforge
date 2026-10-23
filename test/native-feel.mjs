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
      { selector: "#themeSegments", roles: { boundary: "required" } },
      { selector: "#themeSegments [role=radio]", roles: { control: "selection" } },
      { selector: "#themeSegments .native-segments__thumb", roles: { boundary: "required", elevation: "selected" } },
    ], pixels: (await page.screenshot()).toString("base64") })).filter(item => item.selector.startsWith("#themeSegments") && item.kind === "boundary");
    const segmentEdges = await measureSegments();
    assert(segmentEdges.length >= 3 && segmentEdges.every(item => item.status === "pass"), `${theme}: group and actual selection thumb have required contrast`, JSON.stringify(segmentEdges));
    for (const [css, description] of [
      ["#themeSegments .native-segments__thumb{box-shadow:none!important}", "removing the thumb ring"],
      ["#themeSegments{border-color:transparent!important}", "removing the group border"],
      ["#themeSegments .native-segments__thumb{transform:translateX(80px)!important}", "moving the thumb off the checked option"],
      ["#themeSegments .native-segments__thumb{box-shadow:inset 0 0 0 2px var(--surface),inset 0 0 0 2px var(--ink)!important}", "covering the ring with a surface-colored inset shadow"],
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
    await page.locator('[data-step-input="restSec"][data-step-delta="1"]').click();
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
  await page.locator('#minJump').fill('12'); await page.locator('#minJump').dispatchEvent('change');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('repforge_v1')).settings.minJump === 12);
  await page.locator('[data-step-input="minJump"][data-step-delta="-1"]').click();
  assert(Number(await page.locator('#minJump').inputValue()) === 11.5, "a typed value above the stepped range decreases by one step without being clamped", await page.locator('#minJump').inputValue());
  await page.locator('#themeSegments [data-value="light"]').click();
  phase("Phase 4: Today offers the same actions visibly and through context gestures");
  await page.click('#settingsBack');
  const row = '#todayExList [data-context-row]';
  const hasRows = await page.locator(row).count();
  assert(hasRows > 0 && await page.locator('#todayExList [data-row-menu]').count() > 0, "Today rows have a visible actions button");
  if (hasRows) {
    const initialOpacity = await page.locator('#todayExList [data-row-menu]').first().evaluate(button => {
      button.focus(); button.click();
      return getComputedStyle(document.querySelector('.native-context__menu')).opacity;
    });
    assert(initialOpacity === '0', 'the context menu starts transparent before its first animation frame', initialOpacity);
    await page.waitForSelector('#nativeContextMenu:not([hidden])');
    await page.waitForFunction(() => {
      const panel = document.querySelector('.native-context__menu');
      return getComputedStyle(panel).opacity === '1' && panel.getAnimations().every(animation => animation.playState !== 'running');
    });
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
    assert(await page.locator('#nativeContextMenu [role="menuitem"]').count() >= 2, "right click and Shift+F10 expose row actions");
    await page.keyboard.press('Escape');
    await page.waitForSelector('#nativeContextMenu', { state: 'detached' });
    await page.locator(row).first().scrollIntoViewIfNeeded();
    const p = await center(page, row);
    await touch('touchStart', [{ x: p.x, y: p.y }]);
    await page.waitForSelector('#nativeContextMenu:not([hidden])');
    const item = await center(page, '#nativeContextMenu [data-menu-value="skip"]');
    await touch('touchMove', [{ x: item.x, y: item.y }]); await touch('touchEnd');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('repforge_draft_v1'))?.exerciseOrder?.some(id => JSON.parse(localStorage.getItem('repforge_draft_v1')).exercises[id].status === 'skipped'));
    assert(await onToday(page), "long press and slide-to-select skips only in today's draft, without starting Focus");
    const skippedText = await page.evaluate(() => window.RepForgeI18n.t('log.skipped'));
    assert(await page.locator('#todayExList .is-skipped .rxrow__sub').count() === 1 && await page.locator('#todayExList .is-skipped .rxrow__sub').textContent() === skippedText, 'the skipped Today row visibly acknowledges the draft command');
    await page.reload(); await waitForApp(page);
    if (await page.locator('#leaveWorkout').isVisible()) await page.click('#leaveWorkout');
    await page.waitForSelector('#todayDash:not(.hidden)');
    assert(await page.locator('#todayExList .is-skipped').count() === 1, 'the skipped Today state restores after reload');
    await page.locator('#todayExList [data-row-menu]').first().click();
    await page.locator('#nativeContextMenu [data-menu-value="restore"]').click();
    await page.waitForSelector('#nativeContextMenu', { state: 'detached' });
    assert(await page.locator('#todayExList .is-skipped').count() === 0, "Restore reverses the skip in today's draft");
    assert(await page.locator('#todayExList [data-row-menu]').first().evaluate(el => el === document.activeElement), 'a row action restores its visible opener after Today redraws');
    const programBefore = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('repforge_v1')).program));
    await page.locator('#todayExList [data-row-menu]').first().click();
    await page.locator('#nativeContextMenu [data-menu-value="swap"]').click();
    await page.waitForSelector('#exPickSheet.is-open');
    await page.fill('#exPickSearch', 'Leg press');
    const pick = page.locator('#exPickList [data-pick]').first();
    const replacementName = await pick.locator('.pickrow__name').textContent();
    await pick.click(); await page.waitForSelector('#exPickSheet', { state: 'hidden' });
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
  await page.click('#startWorkout');
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
    await editorMenu.click(); await editorPage.waitForSelector('#nativeContextMenu:not([hidden])');
    await editorPage.locator('#nativeContextMenu [data-menu-value="down"]').click();
    await editorPage.waitForFunction(id => document.querySelector('#programEditor [data-role="exercise-row"]').dataset.id !== id, first);
    assert(await rows.nth(1).getAttribute('data-id') === first, "Move down commits through the editor and preserves identity");
    await rows.nth(1).focus(); await editorPage.keyboard.press('Shift+F10');
    await editorPage.waitForSelector('#nativeContextMenu:not([hidden])'); await editorPage.keyboard.press('Escape');
    await editorPage.waitForSelector('#nativeContextMenu', { state: 'detached' });
    assert(await rows.nth(1).evaluate(el => el === document.activeElement), "keyboard context menu returns focus to its editor row");
    await editorPage.locator('#programEditor [data-row-menu]').nth(1).click(); await editorPage.waitForSelector('#nativeContextMenu:not([hidden])');
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
  await editorPage.waitForSelector('#reviewSheet.is-open [data-role="load-step"]');
  const loadStep = editorPage.locator('#reviewSheet [data-role="load-step"]');
  const beforeStep = Number((await loadStep.inputValue()).replace(',', '.'));
  const larger = editorPage.locator('#reviewSheet [data-step-input="load-step"][data-step-delta="1"]');
  assert(await larger.count() === 1, "smallest load change has a visible Larger step control");
  let committedStep = beforeStep + .5;
  if (await larger.count()) {
    await larger.click();
    await editorPage.waitForFunction(value => Number(document.querySelector('#reviewSheet [data-role="load-step"]').value.replace(',', '.')) === value, beforeStep + .5);
    assert(Number((await loadStep.inputValue()).replace(',', '.')) === beforeStep + .5, "Larger step changes the displayed value by 0.5 through the typed field");
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
    const { context, page, touch } = await todayPage(browser);
    await enterSeededFocus(page);
    const step = await loadStep(page);
    await pokeLoad(page, 1);
    const loadBefore = await fieldFace(page, WHEEL_LOAD_SEL);

    await page.locator(WHEEL_REPS_SEL).click();
    await page.locator(WHEEL_LOAD_SEL).click();
    await page.locator(WHEEL_LOAD_SEL).click();
    await page.waitForSelector("#wheelSheet.is-open");
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

    // A real touch drag on the wheel column. Momentum, not a fixed distance, decides
    // where it lands, so the proof is that whatever it settles on is exactly what gets
    // written — not a precomputed item count.
    const box = await page.locator("#wheelCol").boundingBox();
    const cx = Math.round(box.x + box.width / 2), cy = Math.round(box.y + box.height / 2);
    const startTop = await page.evaluate(() => document.querySelector("#wheelCol").scrollTop);
    // Touch moves land on the next animation frame, and a slow runner can lift before the column has followed: each
    // move waits until the column has scrolled with the finger (less the touch slop), so the lift ends a real two-row
    // drag rather than a nudge that snaps back to where it started.
    await touch("touchStart", [{ x: cx, y: cy }]);
    for (const [dy, followed] of [[44, 20], [88, 60]]) {
      await touch("touchMove", [{ x: cx, y: cy - dy }]);
      await page.waitForFunction(([top, min]) => document.querySelector("#wheelCol").scrollTop - top >= min, [startTop, followed], { timeout: 2000 });
    }
    await touch("touchEnd");
    // Momentum carries the scroll on after the touch lifts; wait for it (and the native
    // scroll-snap) to come to rest before the settle debounce reads a value off it.
    await page.waitForFunction(() => {
      const el = document.querySelector("#wheelCol");
      if (!el) return false;
      if (el.__lastTop === el.scrollTop && el.__stableSince && performance.now() - el.__stableSince > 200) return true;
      if (el.__lastTop !== el.scrollTop) el.__stableSince = performance.now();
      el.__lastTop = el.scrollTop;
      return false;
    }, undefined, { timeout: 3000, polling: 50 });
    // The settle (a debounce after the last scroll) is what reports the value: wait for it to name the row on the band.
    const expectScroll = await page.waitForFunction(() => {
      const col = document.querySelector("#wheelCol");
      const onBand = Number(col.querySelectorAll(".wheel__item")[Math.round(col.scrollTop / 44)]?.dataset.wheelV);
      return Number(col.getAttribute("aria-valuenow")) === onBand ? onBand : null;
    }, undefined, { timeout: 2000 }).then((h) => h.jsonValue(), () => NaN);
    assert(Number.isFinite(expectScroll) && expectScroll !== afterKeys.now, "the drag moved the wheel off its keyboard-set value",
      JSON.stringify({ expectScroll, afterKeys }));
    const scrollCommitted = await page.waitForFunction(([id, want]) => {
      const d = window.__repforgeWorkoutDraft.current();
      const exercise = d.exercises[d.session.selectedExerciseId];
      const set = exercise.sets[exercise.setOrder.find((s) => exercise.sets[s].ordinal === 1)];
      return Number(set.edited.metrics[id]) === want;
    }, [WHEEL_WEIGHT, expectScroll], { timeout: 2000 }).then(() => true, () => false);
    assert(scrollCommitted, "the scroll settles on a value and commits it the same way, through the field's own input",
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
    // The tilted rows still overflow a few pixels sideways (scrollWidth counts them); the axis lock is what keeps a
    // finger from reaching that overflow.
    assert(drift.overflowX === "hidden" && drift.touchAction === "pan-y" && drift.scrollLeft === 0,
      "the column pans only vertically, so a diagonal drag leaves it at x 0",
      JSON.stringify(drift));
    assert(drift.offCentre <= 1, "the value stays centred on the band", JSON.stringify(drift));

    // As iOS can leave it after momentum: still, between two values. Snap is lifted so the browser can't do it for us.
    await page.evaluate(() => {
      const col = document.querySelector("#wheelCol");
      col.style.scrollSnapType = "none";
      col.scrollTop = Math.round(col.scrollTop / 44) * 44 + 17;
    });
    const rested = await page.waitForFunction(() => {
      const col = document.querySelector("#wheelCol");
      return Math.abs(col.scrollTop / 44 - Math.round(col.scrollTop / 44)) < 0.02 ? col.scrollTop : null;
    }, undefined, { timeout: 3000 }).then((h) => h.jsonValue(), () => null);
    assert(rested != null, "once still, the column comes to rest exactly on a value");
    const now = await page.evaluate(() => Number(document.querySelector("#wheelCol").getAttribute("aria-valuenow")));
    const shown = await page.evaluate((top) => Number(document.querySelectorAll("#wheelCol .wheel__item")[Math.round(top / 44)].dataset.wheelV), rested ?? 0);
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
    assert(col.transforms.every((t) => !t), "no item carries a tilt transform under reduced motion", JSON.stringify(col));
    await page.keyboard.press("ArrowUp");
    const behavior = await page.evaluate(() => getComputedStyle(document.querySelector("#wheelCol")).scrollBehavior);
    assert(behavior === "auto", "programmatic positioning is instant, not smooth", behavior);
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
  const open = async () => {
    await page.evaluate(() => window.openLibrary());
    await page.waitForFunction(() => document.body.classList.contains("is-library") && !document.body.classList.contains("is-pushing"));
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
  const popped = await page.waitForFunction(() => !document.body.classList.contains("is-library"), undefined, { timeout: 3000 })
    .then(() => true, () => false);
  assert(popped, "released past halfway, the swipe pops the page");

  phase("a drag that starts on a text field is the field's");
  await open();
  const box = await page.locator("#libSearch").boundingBox();
  await touch("touchStart", [{ x: box.x + 30, y: box.y + box.height / 2 }]);
  for (const dx of [20, 60, 120]) await touch("touchMove", [{ x: box.x + 30 + dx, y: box.y + box.height / 2 }]);
  await touch("touchEnd");
  const still = await page.evaluate(() => document.body.classList.contains("is-library") && !document.querySelector("#library").style.transform);
  assert(still, "the library stays put");
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

const browser = await launchChromium();
try {
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
    const strayActive = rules.active.filter((sel) => !/(input|__input|drag-handle)[^ ]*:active/.test(sel));
    assert(strayActive.length === 0, "only form fields and the drag handle's cursor keep :active", strayActive.join("\n    "));
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
  await routeHistory(browser);
  await autoSwipe(browser);
  await standaloneSwipe(browser);
  await reducedMotionPush(browser);
  await editorSheetTab(browser);
  await navigationBars(browser);
} finally {
  await browser.close();
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
