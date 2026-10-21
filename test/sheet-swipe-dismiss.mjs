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

/** A point on the sheet's drag rail — the head, which every sheet has: the legacy head or the shared band. */
async function grip(page, sheet) {
  const box = await page.locator(`${sheet} .sheet__head, ${sheet} .sheetband`).first().boundingBox();
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

/**
 * The edge-swipe owner: the third gesture owner in the motion layer, beside the
 * sheet and Focus owners. It is exercised with synthetic touch pointer events on
 * a probe page, because a pushed page has no consumer yet; what is proved is the
 * owner's lifecycle and guards, which every later consumer inherits.
 */
const EDGE_INIT = `
window.__standalone = false;
{
  const real = window.matchMedia.bind(window);
  window.matchMedia = (query) => /display-mode:\\s*standalone/.test(query)
    ? { matches: window.__standalone, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
    : real(query);
  // Record how the layer drives Motion, so "seeded with the release velocity" is
  // read from the real calls rather than inferred from where the page ended up.
  let runtime;
  window.__animateCalls = [];
  Object.defineProperty(window, "Motion", {
    configurable: true,
    get: () => runtime,
    set(value) {
      runtime = value && { ...value, animate: (...args) => {
        window.__animateCalls.push({ to: args[1], options: { ...(args[2] || {}) } });
        return value.animate(...args);
      } };
    },
  });
}
window.__edge = {
  commits: 0,
  mount() {
    const page = document.createElement("section");
    page.id = "edgeProbe";
    page.style.cssText = "position:fixed;inset:0;z-index:50;background:#fff";
    page.innerHTML = "<p>Pushed page</p>";
    document.body.append(page);
    this.page = page;
  },
  register() {
    this.registration = window.RepForgeMotion.registerEdgeSwipeBack({
      page: this.page,
      onCommit: () => { this.commits++; this.page.hidden = true; },
    });
    return !!this.registration;
  },
  state() {
    const m = new DOMMatrixReadOnly(getComputedStyle(this.page).transform);
    return { x: Math.round(m.m41), inline: this.page.style.transform, swiping: this.page.classList.contains("is-edge-swiping"),
      hint: this.page.style.willChange, hidden: this.page.hidden, commits: this.commits };
  },
  fire(type, clientX, clientY = 400, pointerId = 7) {
    this.page.dispatchEvent(new PointerEvent(type, { pointerId, pointerType: "touch", isPrimary: true, bubbles: true, cancelable: true, clientX, clientY }));
  },
  async drag(xs, { startX = 4, y = 400, wait = 16, end = "pointerup", hold = 0, ys = null } = {}) {
    this.fire("pointerdown", startX, y);
    const seen = [];
    for (let i = 0; i < xs.length; i++) {
      this.fire("pointermove", xs[i], ys ? ys[i] : y);
      await new Promise((r) => setTimeout(r, wait));
      seen.push(this.state());
    }
    if (hold) await new Promise((r) => setTimeout(r, hold));
    if (end) this.fire(end, xs[xs.length - 1], y);
    return seen;
  },
  reset() {
    this.commits = 0;
    this.page.hidden = false;
    this.page.style.transform = "";
    window.__animateCalls.length = 0;
  },
};
`;

async function edgeSwipe(browser, { reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.addInitScript(EDGE_INIT);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.evaluate(() => { window.__edge.mount(); });
  const edge = (fn, arg) => page.evaluate(fn, arg);
  const still = (ms) => page.waitForTimeout(ms);
  const reduced = reducedMotion === "reduce";
  const tag = reduced ? " under reduced motion" : "";

  phase(`the edge swipe is inert until a page opts in${tag}`);
  await edge(() => { window.__standalone = true; });
  const before = await edge(() => window.__edge.drag([30, 90, 160, 240], { wait: 16 }));
  await still(120);
  const beforeEnd = await edge(() => window.__edge.state());
  assert(before.every((s) => !s.inline && s.x === 0) && beforeEnd.commits === 0 && !beforeEnd.inline,
    "an unregistered page does not move", JSON.stringify({ before, beforeEnd }));
  assert(await edge(() => window.__edge.register()), "a page can register once the layer is available");

  phase(`it only runs where display-mode: standalone matches${tag}`);
  await edge(() => { window.__standalone = false; });
  const tab = await edge(() => window.__edge.drag([30, 90, 160, 240], { wait: 16 }));
  await still(120);
  assert(tab.every((s) => !s.inline && !s.swiping) && (await edge(() => window.__edge.state())).commits === 0,
    "in a browser tab the left edge is left to the browser", JSON.stringify(tab));
  await edge(() => { window.__standalone = true; });

  phase(`a registered page follows the thumb from the left edge${tag}`);
  const following = await edge(() => window.__edge.drag([6, 20, 60, 120], { wait: 24, hold: 160, end: null }));
  assert(following[0].x === 0 && !following[0].swiping, "a movement under the lock does not start the gesture", JSON.stringify(following.slice(0, 1)));
  assert(following[2].x > 0 && following[3].x > following[2].x && following.slice(1).every((s) => s.swiping),
    "once past the lock it tracks the thumb", JSON.stringify(following.map((s) => s.x)));
  assert(following[3].x - following[2].x === 60, "and moves exactly as far as the thumb does", JSON.stringify(following.map((s) => s.x)));
  await edge(() => window.__edge.fire("pointerup", 120));
  await still(reduced ? 80 : 520);
  const rested = await edge(() => window.__edge.state());
  assert(rested.x === 0 && !rested.inline && !rested.swiping && !rested.hint && rested.commits === 0,
    "a short, slow pull settles home and leaves no inline state", JSON.stringify(rested));

  phase(`a long pull commits through navPush, seeded with the release velocity${tag}`);
  await edge(() => window.__edge.reset());
  await edge(() => window.__edge.drag([40, 120, 220, 310], { wait: 16 }));
  await still(reduced ? 80 : 700);
  const committed = await edge(() => ({ ...window.__edge.state(), calls: window.__animateCalls }));
  assert(committed.commits === 1 && committed.hidden, "the page's own back path runs exactly once", JSON.stringify(committed));
  assert(!committed.inline && !committed.swiping && !committed.hint, "and the layer hands the page back with no inline state", JSON.stringify(committed));
  if (reduced) {
    assert(committed.calls.length === 0, "reduced motion commits with no spring at all", JSON.stringify(committed.calls));
  } else {
    const push = committed.calls.find((c) => c.options.stiffness === 700 && c.options.damping === 53);
    assert(push && push.to === 390 && push.options.velocity > 300,
      "the commit is the navPush spring to the screen edge, carrying the release velocity", JSON.stringify(committed.calls));
  }

  phase(`a flick commits on projected momentum even from a short pull${tag}`);
  await edge(() => window.__edge.reset());
  await edge(() => window.__edge.drag([30, 62, 100], { wait: 8 }));
  await still(reduced ? 80 : 700);
  const flicked = await edge(() => window.__edge.state());
  assert(flicked.commits === 1, "a fast short pull is a back swipe", JSON.stringify(flicked));

  phase(`pointercancel never commits${tag}`);
  await edge(() => window.__edge.reset());
  await edge(() => window.__edge.drag([40, 120, 220, 310], { wait: 16, end: "pointercancel" }));
  await still(reduced ? 80 : 700);
  const cancelled = await edge(() => ({ ...window.__edge.state(), calls: window.__animateCalls }));
  assert(cancelled.commits === 0 && !cancelled.hidden && cancelled.x === 0 && !cancelled.inline && !cancelled.swiping,
    "a pull the browser takes away returns home instead of committing", JSON.stringify(cancelled));
  if (!reduced) {
    assert(!cancelled.calls.some((c) => c.options.stiffness === 700) && cancelled.calls.every((c) => !c.options.velocity),
      "and it settles from rest, not from a stale velocity", JSON.stringify(cancelled.calls));
  }

  phase(`it never starts in Focus, outside the edge zone or on a vertical drag${tag}`);
  await edge(() => window.__edge.reset());
  await edge(() => {
    const workout = document.getElementById("workout");
    window.__focusWas = { cls: workout.classList.contains("is-focus"), body: document.body.classList.contains("is-focus-wo") };
    workout.classList.add("is-focus");
    document.body.classList.add("is-focus-wo");
  });
  const inFocus = await edge(() => window.__edge.drag([30, 90, 160, 240], { wait: 16 }));
  await still(120);
  assert(inFocus.every((s) => !s.inline && !s.swiping) && (await edge(() => window.__edge.state())).commits === 0,
    "Focus keeps its horizontal axis for the deck", JSON.stringify(inFocus));
  await edge(() => {
    document.getElementById("workout").classList.toggle("is-focus", window.__focusWas.cls);
    document.body.classList.toggle("is-focus-wo", window.__focusWas.body);
  });
  const inside = await edge(() => window.__edge.drag([80, 140, 220, 300], { startX: 60, wait: 16 }));
  assert(inside.every((s) => !s.inline && !s.swiping), "a touch that starts away from the edge is not a back swipe", JSON.stringify(inside));
  const vertical = await edge(() => window.__edge.drag([6, 8, 10, 12], { wait: 16, ys: [440, 500, 560, 620] }));
  assert(vertical.every((s) => !s.inline && !s.swiping), "a vertical drag from the edge is left to the page", JSON.stringify(vertical));
  await still(80);
  assert((await edge(() => window.__edge.state())).commits === 0, "none of them committed");

  if (!reduced) {
    phase("a pull can be re-grabbed while it settles");
    await edge(() => window.__edge.reset());
    await edge(() => window.__edge.drag([30, 80, 140], { wait: 30, hold: 200 }));
    await still(40);
    const midSettle = await edge(() => window.__edge.state());
    // Held still for 150ms before the lift, so the release carries no velocity.
    const regrab = await edge(() => window.__edge.drag([14, 26], { wait: 16, hold: 150 }));
    const regrabbed = regrab[regrab.length - 1];
    assert(midSettle.x > 0 && regrabbed.x >= midSettle.x - 20,
      "the second grab picks the page up where it is, not at rest", JSON.stringify({ midSettle, regrab }));
    await still(520);
    assert((await edge(() => window.__edge.state())).commits === 0, "and letting it go slowly still does not navigate");
  }

  phase(`disposal cancels a live pull, and mounting is idempotent${tag}`);
  await edge(() => window.__edge.reset());
  const handle = await edge(() => ({ same: window.RepForgeMotion.mountGestureController() === window.__repforgeGestureHandle }));
  assert(handle.same, "mounting twice returns the one controller");
  await edge(async () => {
    window.__edge.fire("pointerdown", 4);
    window.__edge.fire("pointermove", 30);
    window.__edge.fire("pointermove", 90);
    await new Promise((r) => setTimeout(r, 30));
  });
  const live = await edge(() => window.__edge.state());
  assert(live.swiping && live.x > 0, "a pull is live before the controller is disposed", JSON.stringify(live));
  await edge(() => window.__repforgeGestureHandle.dispose());
  const torn = await edge(() => window.__edge.state());
  assert(!torn.swiping && !torn.inline && !torn.hint && torn.x === 0, "disposal puts the page back and releases the layer hint", JSON.stringify(torn));
  await edge(() => { window.__edge.fire("pointermove", 300); window.__edge.fire("pointerup", 300); });
  await still(reduced ? 60 : 500);
  assert((await edge(() => window.__edge.state())).commits === 0, "a release after disposal commits nothing");
  const dead = await edge(() => window.__edge.drag([30, 90, 160, 240], { wait: 16 }));
  assert(dead.every((s) => !s.inline), "a disposed controller leaves the page inert", JSON.stringify(dead));
  await edge(() => { window.__repforgeGestureHandle = window.RepForgeMotion.mountGestureController(); window.__edge.reset(); });
  await edge(() => window.__edge.drag([40, 120, 220, 310], { wait: 16 }));
  await still(reduced ? 80 : 700);
  assert((await edge(() => window.__edge.state())).commits === 1, "a fresh mount brings the owner back");

  phase(`the registration can be withdrawn${tag}`);
  await edge(() => { window.__edge.reset(); window.__edge.registration.dispose(); });
  const withdrawn = await edge(() => window.__edge.drag([30, 90, 160, 240], { wait: 16 }));
  await still(100);
  assert(withdrawn.every((s) => !s.inline) && (await edge(() => window.__edge.state())).commits === 0, "a withdrawn page is inert again", JSON.stringify(withdrawn));
  assert(!(await edge(() => window.RepForgeMotion.registerEdgeSwipeBack({ page: null, onCommit() {} }))), "a registration without a page is refused");

  assert(!errors.length, `no uncaught page errors in the edge-swipe run${tag}`, errors.slice(0, 3).join(" | "));
  await context.close();
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
  await page.evaluate(() => window.__repforgeEnterWorkout({}));
  await page.waitForSelector("#workout.is-focus .exercise.is-current", { state: "attached", timeout: 5000 });
  await page.locator("#woOverflowBtn").click();
  await page.locator("#exActionNotesBtn").click();
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
      focus: document.activeElement?.id === "woOverflowBtn",
    }),
    DRAFT
  );
  assert(note.hidden && !note.locked, "the swipe closes the note sheet", JSON.stringify(note));
  assert(
    !Object.values(note.draft).some(Boolean) && !note.kept.length,
    "the typed note is discarded, not saved",
    JSON.stringify(note)
  );
  assert(note.focus, "focus returns to the three-dot button that opened the note", String(note.focus));

  // The note's body is one big textarea, so a thumb that starts there is still
  // swiping the sheet — while a mouse there is selecting text and must be left
  // to it.
  phase("the note's own text area drags for a thumb, not for a mouse");
  await page.locator("#woOverflowBtn").click();
  await page.locator("#exActionNotesBtn").click();
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

  await edgeSwipe(browser);
  await edgeSwipe(browser, { reducedMotion: "reduce" });

  await browser.close();
  console.log(`\nsheet swipe dismiss: ${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
