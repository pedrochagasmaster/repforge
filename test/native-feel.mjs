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
} finally {
  await browser.close();
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
