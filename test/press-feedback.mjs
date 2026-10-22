#!/usr/bin/env node
/**
 * Press feedback (ADR 0023, audit F-3; Plan 075 phase 1).
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
 * Chromium touch emulation is not iPhone evidence; the feel is checked on a
 * device by the owner.
 *
 * Run: node test/press-feedback.mjs
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";
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

async function todayPage(browser, { reducedMotion = "no-preference", theme = "light" } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion });
  const page = await context.newPage();
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
  const b = await page.locator(sel).boundingBox();
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
} finally {
  await browser.close();
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
