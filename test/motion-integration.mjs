#!/usr/bin/env node
/**
 * Motion integration — the behaviour only a real browser can answer for.
 *
 * `test/vendor-runtimes.mjs` proves the runtimes are pinned, vendored,
 * precached and reached through one layer. This suite proves the runtime actually runs,
 * that what it drives is interruptible, and that the state of the interface is
 * never a function of whether an animation finished.
 *
 * The claims it exists to defend:
 *
 *   - Motion is on the page and animating, with no console error;
 *   - a spring carries the velocity a gesture handed it, which is the whole
 *     reason for adopting Motion over a fixed-duration transition;
 *   - open → immediately close, close → immediately reopen, and repeated
 *     toggling all end in the right state with no inline geometry stranded;
 *   - a gesture cancelled or torn down mid-flight leaves no surface stuck
 *     between two visual states;
 *   - under `prefers-reduced-motion` the same state changes happen with no
 *     intermediate movement at all;
 *   - the discipline pass from the motion-polish work is still in force —
 *     nothing here re-lengthened a frequent interaction.
 *
 * Run: node test/motion-integration.mjs
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}`); if (detail != null) console.log(`    ${detail}`); }
}
const phase = n => console.log(`\n${n}`);

/** Clear first-run chrome so a view is reachable. */
async function settle(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(() => {
    window.closeFirstRun?.();
    if (document.querySelector("#onboarding")?.classList.contains("active")) window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && window.closeTour) window.closeTour();
  });
}

async function openSettings(page) {
  await page.click("#openSettings");
  await page.waitForSelector("#restSecRow", { timeout: 10000 });
  await page.waitForTimeout(200);
}

/** Read a disclosure's whole visible state in one go. */
const DISCLOSURE = `
window.__disc = (rowSel, panelSel) => {
  const row = document.querySelector(rowSel), panel = document.querySelector(panelSel);
  const cs = getComputedStyle(panel);
  return {
    expanded: row.getAttribute("aria-expanded"),
    hidden: panel.getAttribute("aria-hidden"),
    open: panel.classList.contains("is-open"),
    display: cs.display,
    height: Math.round(panel.getBoundingClientRect().height),
    inlineHeight: panel.style.height,
    inlineOverflow: panel.style.overflow,
    willChange: panel.style.willChange,
  };
};
`;

async function scenario(browser, { reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e.message)));
  await page.addInitScript(DISCLOSURE);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await settle(page);
  return { context, page, errors };
}

/** Probe markup for the vocabulary helpers: a stage for the indicator and a slot for the height swap. */
const VOCAB_STAGE = `
window.__vocab = {
  stage() {
    document.querySelector("#vocabStage")?.remove();
    const stage = document.createElement("div");
    stage.id = "vocabStage";
    stage.style.cssText = "position:fixed;left:0;top:0;width:390px;height:300px;z-index:9999;background:#fff";
    stage.innerHTML = '<div id="vocabInd" style="position:absolute;top:40px;left:20px;width:60px;height:4px;background:#000"></div>' +
      '<div id="vocabSlot" style="position:absolute;top:100px;left:0;width:300px"><div id="vocabBody" style="height:40px">a</div></div>';
    document.body.append(stage);
    return stage;
  },
  rect(sel) { const r = document.querySelector(sel).getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; },
  frames(n = 2) { return new Promise((resolve) => { const step = (k) => (k ? requestAnimationFrame(() => step(k - 1)) : resolve()); step(n); }); },
};
`;

async function vocabularyHelpers(browser, { reducedMotion = "no-preference" } = {}) {
  const reduced = reducedMotion === "reduce";
  const tag = reduced ? " under reduced motion" : "";
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.addInitScript(VOCAB_STAGE);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.evaluate(() => window.__vocab.stage());

  phase(`animateIndicator travels one element and retargets from its live transform${tag}`);
  const travel = await page.evaluate(async () => {
    const el = document.querySelector("#vocabInd");
    const from = window.__vocab.rect("#vocabInd");
    el.style.left = "220px"; el.style.width = "120px";
    const done = window.RepForgeMotion.animateIndicator(el, from);
    const first = window.__vocab.rect("#vocabInd");
    const inline = el.style.transform;
    await new Promise((r) => setTimeout(r, 45));
    const mid = window.__vocab.rect("#vocabInd");
    // Interrupt: the next job moves it back to 40px. The caller measures where it is now.
    const live = window.__vocab.rect("#vocabInd");
    el.style.left = "40px"; el.style.width = "60px";
    const second = window.RepForgeMotion.animateIndicator(el, live);
    const restart = window.__vocab.rect("#vocabInd");
    const firstArrived = await done;
    await second;
    await window.__vocab.frames(2);
    return { from, first, inline, mid, live, restart, firstArrived, end: window.__vocab.rect("#vocabInd"),
      endInline: el.style.transform, hint: el.style.willChange, origin: el.style.transformOrigin };
  });
  if (reduced) {
    assert(travel.inline === "" && Math.abs(travel.first.left - 220) < 1 && Math.abs(travel.first.width - 120) < 1,
      "the indicator is at its end state on the very next frame", JSON.stringify(travel));
  } else {
    assert(Math.abs(travel.first.left - travel.from.left) < 1.5 && Math.abs(travel.first.width - travel.from.width) < 1.5,
      "it starts exactly where it was", JSON.stringify({ from: travel.from, first: travel.first }));
    assert(travel.mid.left > travel.from.left + 2 && travel.mid.left < 220 && travel.mid.width > 60 && travel.mid.width < 120,
      "and is between the two places part-way through", JSON.stringify(travel.mid));
    assert(Math.abs(travel.restart.left - travel.live.left) < 1.5 && Math.abs(travel.restart.width - travel.live.width) < 1.5,
      "an interruption restarts from the live position instead of jumping", JSON.stringify({ live: travel.live, restart: travel.restart }));
    assert(travel.firstArrived === false, "the interrupted run reports that it did not arrive");
  }
  assert(Math.abs(travel.end.left - 40) < 0.5 && Math.abs(travel.end.width - 60) < 0.5 && travel.endInline === "" && !travel.hint && !travel.origin,
    "it lands on its final box with no inline transform, origin or layer hint", JSON.stringify(travel));

  phase(`animateSlot swaps content in a measured slot and reverses from the live height${tag}`);
  const slot = await page.evaluate(async () => {
    const el = document.querySelector("#vocabSlot"), body = document.querySelector("#vocabBody");
    let calls = 0;
    const grown = window.RepForgeMotion.animateSlot(el, () => { calls++; body.style.height = "140px"; });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const mid = Math.round(el.getBoundingClientRect().height);
    const inlineMid = { overflow: el.style.overflow, hint: el.style.willChange };
    await new Promise((r) => setTimeout(r, 60));
    const live = Math.round(el.getBoundingClientRect().height);
    const back = window.RepForgeMotion.animateSlot(el, () => { calls++; body.style.height = "40px"; });
    // The run's first frame is painted by the next animation frame, not by the call.
    await new Promise((r) => requestAnimationFrame(r));
    const restart = Math.round(el.getBoundingClientRect().height);
    await grown; await back;
    await new Promise((r) => setTimeout(r, 40));
    return { mid, inlineMid, live, restart, calls, end: Math.round(el.getBoundingClientRect().height), inline: el.style.height,
      overflow: el.style.overflow, hint: el.style.willChange };
  });
  assert(slot.calls === 2, "each swap ran exactly once", JSON.stringify(slot));
  if (reduced) {
    assert(slot.mid === 140 && !slot.inlineMid.overflow, "the slot is at the new height on the next frame", JSON.stringify(slot));
  } else {
    assert(slot.mid >= 40 && slot.mid < 140 && slot.inlineMid.overflow === "hidden" && slot.inlineMid.hint === "height",
      "the slot grows through intermediate heights, clipped", JSON.stringify(slot));
    assert(Math.abs(slot.restart - slot.live) <= 30 && slot.restart > 40 && slot.restart < 140,
      "swapping back mid-run starts from the live height", JSON.stringify(slot));
  }
  assert(slot.end === 40 && !slot.inline && !slot.overflow && !slot.hint, "settled, the slot carries no inline geometry", JSON.stringify(slot));

  phase(`navPush is a critically damped spring that carries a seeded velocity${tag}`);
  const push = await page.evaluate(async () => {
    const { navPush } = window.RepForgeMotion.vocabulary;
    const run = (velocity, retargetAt) => new Promise((resolve) => {
      const v = window.Motion.motionValue(0);
      const start = performance.now();
      let peak = 0, at = null, resumed = null;
      v.on("change", (value) => { peak = Math.max(peak, value); if (at !== null && resumed === null) resumed = value; });
      const anim = window.Motion.animate(v, 390, { ...navPush, velocity });
      if (retargetAt) setTimeout(() => {
        at = v.get();
        v.stop();
        window.Motion.animate(v, 0, { ...navPush }).then(() => resolve({ at, resumed, end: v.get(), ms: Math.round(performance.now() - start) }));
      }, retargetAt);
      else anim.then(() => resolve({ peak: Math.round(peak * 10) / 10, end: v.get(), ms: Math.round(performance.now() - start) }));
    });
    return { rest: await run(0), seeded: await run(1500), retarget: await run(0, 70) };
  });
  assert(push.rest.end === 390 && push.seeded.end === 390, "it lands exactly on the target", JSON.stringify(push));
  assert(push.rest.peak <= 390.5, "released from rest it never overshoots", JSON.stringify(push.rest));
  assert(push.rest.ms >= 120 && push.rest.ms <= 420 && push.seeded.ms <= 420, "and comes to rest inside the time a push may take", JSON.stringify(push));
  assert(push.retarget.at > 20 && push.retarget.at < 380 && push.retarget.end === 0 && Math.abs(push.retarget.resumed - push.retarget.at) < 90,
    "retargeted mid-flight it continues from where it is, without a jump", JSON.stringify(push.retarget));

  phase(`the short fixed beats stay inside their budgets and have a reduced-motion path${tag}`);
  const beats = await page.evaluate(() => {
    const out = {};
    const probe = (name, className, { parent = "", style = "" } = {}) => {
      const host = document.createElement("div");
      if (parent) host.className = parent;
      const el = document.createElement("div");
      el.className = className;
      el.style.cssText = style;
      el.textContent = "x";
      host.append(el);
      document.getElementById("vocabStage").append(host);
      const cs = getComputedStyle(el);
      const animations = el.getAnimations().map((a) => ({
        frames: a.effect.getKeyframes().map((k) => ({ transform: k.transform, opacity: k.opacity, clipPath: k.clipPath })),
      }));
      out[name] = { animationName: cs.animationName, duration: cs.animationDuration, delay: cs.animationDelay, iteration: cs.animationIterationCount,
        transition: cs.transitionDuration, opacity: cs.opacity, transform: cs.transform, animations };
      host.remove();
    };
    probe("rise", "motion-rise");
    probe("up", "motion-value-up");
    probe("down", "motion-value-down");
    probe("fade", "motion-value-fade");
    probe("clip", "motion-clip-reveal");
    probe("build3", "motion-build-item", { parent: "motion-build", style: "--build-i:3" });
    probe("stepsPlain", "motion-step");
    probe("stepsReady", "motion-step", { parent: "motion-steps-ready" });
    const host = document.createElement("div");
    host.className = "motion-hairline is-pending";
    host.innerHTML = '<span class="motion-hairline__label">Saving</span>';
    document.getElementById("vocabStage").append(host);
    const after = getComputedStyle(host, "::after");
    out.hairline = { after: after.animationName, iteration: after.animationIterationCount, duration: after.animationDuration,
      label: getComputedStyle(host.querySelector(".motion-hairline__label")).display };
    host.remove();
    const idle = document.createElement("div");
    idle.className = "motion-hairline";
    document.getElementById("vocabStage").append(idle);
    out.hairlineIdleAfter = getComputedStyle(idle, "::after").animationName;
    idle.remove();
    return out;
  });
  const ms = (value) => parseFloat(value) * (/ms$/.test(value) ? 1 : 1000);
  if (reduced) {
    assert(["rise", "up", "down", "fade", "clip", "build3"].every((k) => beats[k].animationName === "none"),
      "under reduced motion every beat is switched off and the element sits at its end state", JSON.stringify(beats));
    assert(beats.stepsReady.opacity === "1" && ms(beats.stepsReady.transition) === 0, "steps are shown at once", JSON.stringify(beats.stepsReady));
    assert(beats.hairline.after === "none" && beats.hairline.label === "block" && beats.hairlineIdleAfter === "none",
      "the hairline sweep is replaced by its text label", JSON.stringify(beats.hairline));
  } else {
    const rise = (beat) => {
      const frame = beat.animations[0]?.frames[0]?.transform || "";
      const m = /translateY\((-?[\d.]+)px\)/.exec(frame);
      return m ? Number(m[1]) : NaN;
    };
    assert(beats.rise.animationName === "taurifer-rise" && ms(beats.rise.duration) <= 160 && Math.abs(rise(beats.rise)) <= 12 && Math.abs(rise(beats.rise)) > 0,
      "the rise is at most 12px inside 160ms", JSON.stringify(beats.rise));
    assert(ms(beats.up.duration) <= 120 && ms(beats.down.duration) <= 120 &&
      Math.abs(rise(beats.up)) <= 6 && rise(beats.up) === -rise(beats.down) && rise(beats.up) !== 0,
    "the directional value change is at most 6px inside 120ms, and the two directions are opposite", JSON.stringify([beats.up, beats.down]));
    assert(ms(beats.fade.duration) === 80 && beats.fade.animations[0].frames.every((f) => !f.transform || f.transform === "none"),
      "the crossfade fallback is 80ms and does not travel", JSON.stringify(beats.fade));
    assert(ms(beats.clip.duration) === 360 && beats.clip.animations[0].frames.some((f) => /inset\(0px 100% 0px 0px\)/.test(f.clipPath || "")),
      "the clip reveal is about 360ms", JSON.stringify(beats.clip));
    assert(beats.build3.animationName === "taurifer-build-in" && Math.round(ms(beats.build3.delay)) === 165,
      "the build staggers each item by 55ms", JSON.stringify(beats.build3));
    assert(beats.stepsPlain.opacity === "1" && beats.stepsReady.opacity === "0" && ms(beats.stepsReady.transition.split(",")[0]) === 200,
      "the step reveal is hidden only once a script has marked the group ready", JSON.stringify([beats.stepsPlain, beats.stepsReady]));
    assert(beats.hairline.after === "taurifer-hairline" && beats.hairline.iteration === "infinite" && beats.hairlineIdleAfter === "none" && beats.hairline.label === "none",
      "the hairline runs only while pending, and its label is hidden while it does", JSON.stringify([beats.hairline, beats.hairlineIdleAfter]));
  }
  assert(errors.length === 0, `no page errors in the vocabulary run${tag}`, errors.join(" | "));
  await context.close();
}

async function run() {
  const browser = await launchChromium();

  // ---- the runtime is live -----------------------------------------------------
  phase("the vendored runtime loads and animates");
  const { context, page, errors } = await scenario(browser);
  const boot = await page.evaluate(() => ({
    runtime: typeof window.Motion?.animate === "function" && typeof window.Motion?.motionValue === "function",
    layer: window.RepForgeMotion?.available() === true,
    reduced: window.RepForgeMotion?.reducedMotion(),
    vocabulary: Object.keys(window.RepForgeMotion?.vocabulary || {}),
  }));
  assert(boot.runtime, "the vendored Motion bundle exposes animate and motionValue");
  assert(boot.layer, "the integration layer reports the runtime available");
  assert(boot.reduced === false, "reduced motion is off in this context", String(boot.reduced));
  assert(boot.vocabulary.length === 6 && boot.vocabulary.includes("navPush"), "the motion vocabulary is published for inspection", boot.vocabulary.join(", "));

  // A spring that ignored the velocity handed to it would be a fixed-duration
  // transition wearing a spring's name — this is the property the whole
  // adoption rests on, so it is measured rather than assumed.
  const physics = await page.evaluate(async () => {
    // A sheet 60px down, released at rest and released still travelling
    // downwards. The thrown one has to keep going before it comes back; that
    // extra travel is the velocity transfer the whole adoption rests on.
    const sample = velocity => new Promise(resolve => {
      const v = window.Motion.motionValue(60);
      const start = performance.now();
      let peak = 60;
      v.on("change", value => { peak = Math.max(peak, value); });
      window.Motion.animate(v, 0, { ...window.RepForgeMotion.vocabulary.gestureSettle, velocity })
        .then(() => resolve({ peak: Math.round(peak), ms: Math.round(performance.now() - start), end: v.get() }));
    });
    return { still: await sample(0), thrown: await sample(900) };
  });
  // Frame sampling and integer rounding can report the same physical run as a
  // 5px or 6px separation. The contract is directional velocity transfer,
  // not a particular overshoot amplitude.
  assert(physics.thrown.peak >= physics.still.peak + 3,
    "a spring given velocity travels further than one released at rest",
    JSON.stringify(physics));
  assert(physics.still.end === 0 && physics.thrown.end === 0,
    "and both land exactly on the target however they got there",
    JSON.stringify(physics));
  assert(physics.still.ms < 420 && physics.thrown.ms < 480,
    "and both settle inside the time a lifter will wait for a gesture",
    JSON.stringify(physics));

  // ---- disclosures: interruption and final state -------------------------------
  phase("a settings disclosure survives being toggled faster than it animates");
  await openSettings(page);
  const closed = await page.evaluate(() => window.__disc("#restSecRow", "#restSecPanel"));
  assert(closed.expanded === "false" && closed.display === "none" && !closed.inlineHeight,
    "it starts closed with no inline geometry", JSON.stringify(closed));

  await page.click("#restSecRow");
  const opening = await page.evaluate(() => new Promise(resolve => {
    // One frame in: the height animation has started, so the panel is part-way
    // open rather than having appeared at full size.
    requestAnimationFrame(() => requestAnimationFrame(() =>
      resolve({ ...window.__disc("#restSecRow", "#restSecPanel"),
        full: (() => { const p = document.querySelector("#restSecPanel"); return p.scrollHeight; })() })));
  }));
  assert(opening.expanded === "true" && opening.hidden === "false",
    "the accessibility tree changes at the tap, not when the animation ends",
    JSON.stringify(opening));
  // The reveal curve is deliberately front-loaded. On a busy runner the
  // second animation frame can already be close to the target, but an inline
  // height below the measured target plus clipped overflow still proves that
  // the panel is animating rather than appearing at full height.
  assert(opening.inlineOverflow === "hidden" && opening.inlineHeight &&
    opening.height <= opening.full - 1,
    "the panel measures itself open rather than appearing at full height",
    JSON.stringify(opening));
  await page.waitForTimeout(350);
  const opened = await page.evaluate(() => window.__disc("#restSecRow", "#restSecPanel"));
  assert(opened.open && opened.height > 40 && !opened.inlineHeight && !opened.inlineOverflow && !opened.willChange,
    "settled open, it carries no inline height, overflow or layer hint",
    JSON.stringify(opened));

  // Open → immediately close. The close must reverse from the height the panel
  // has now, and the open animation's clean-up must not wipe it on the way out.
  await page.click("#restSecRow");
  await page.waitForTimeout(30);
  await page.click("#restSecRow");
  await page.waitForTimeout(400);
  const flapped = await page.evaluate(() => window.__disc("#restSecRow", "#restSecPanel"));
  assert(flapped.expanded === "true" && flapped.open && flapped.height > 40,
    "close-then-reopen inside one animation ends open",
    JSON.stringify(flapped));
  assert(!flapped.inlineHeight && !flapped.inlineOverflow,
    "and leaves no inline geometry behind", JSON.stringify(flapped));

  // Seven taps, each faster than the animation they interrupt. A disclosure is
  // a toggle, so the only correct answer is the one the taps add up to — an odd
  // count from open has to end shut, however many animations were cut short.
  const beforeTaps = await page.evaluate(() => window.__disc("#restSecRow", "#restSecPanel"));
  for (let i = 0; i < 7; i++) { await page.click("#restSecRow"); await page.waitForTimeout(25); }
  await page.waitForTimeout(450);
  const hammered = await page.evaluate(() => window.__disc("#restSecRow", "#restSecPanel"));
  assert(hammered.open === !beforeTaps.open && hammered.expanded === String(!beforeTaps.open) &&
    hammered.display === (beforeTaps.open ? "none" : "block"),
    "an odd number of taps faster than the animation still lands on the opposite state",
    JSON.stringify({ beforeTaps, hammered }));
  assert(!hammered.inlineHeight && !hammered.inlineOverflow,
    "the interface is never stranded between two visual states",
    JSON.stringify(hammered));

  // Two panels at once must not share state through the layer.
  await page.evaluate(() => {
    for (const [row, panel] of [["#restSecRow", "#restSecPanel"], ["#progressionRow", "#progressionDetails"]]) {
      if (document.querySelector(panel).classList.contains("is-open")) document.querySelector(row).click();
    }
  });
  await page.waitForTimeout(300);
  await page.click("#restSecRow");
  await page.click("#progressionRow");
  await page.waitForTimeout(400);
  const both = await page.evaluate(() => [
    window.__disc("#restSecRow", "#restSecPanel"),
    window.__disc("#progressionRow", "#progressionDetails"),
  ]);
  assert(both.every(p => p.open && p.height > 20 && !p.inlineHeight),
    "two disclosures opened together both settle correctly",
    JSON.stringify(both));

  // ---- sheets: a gesture torn down mid-flight ----------------------------------
  phase("a sheet closed out from under a live gesture does not stay half-open");
  await installSeedProgram(page, { waitFor: settle });
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#exportProgramText", { timeout: 10000 });
  await page.click("#exportProgramText");
  await page.waitForSelector("#programTextSheet.is-open", { timeout: 5000 });
  await page.waitForTimeout(320);
  const rail = await page.locator("#programTextSheet .sheet__head").boundingBox();
  const gx = Math.round(rail.x + rail.width / 2), gy = Math.round(rail.y + rail.height / 2);
  await page.mouse.move(gx, gy);
  await page.mouse.down();
  for (const dy of [30, 70, 110]) { await page.mouse.move(gx, gy + dy); await page.waitForTimeout(16); }
  // Escape while the thumb is still down: the sheet closes, and the animation
  // that was following the thumb has to be stopped rather than left running.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.mouse.up();
  await page.waitForTimeout(200);
  const torn = await page.evaluate(() => {
    const el = document.querySelector("#programTextSheet");
    return { hidden: el.hidden === true, inline: el.style.transform, willChange: el.style.willChange,
      locked: document.body.classList.contains("is-sheet-open") };
  });
  assert(torn.hidden && !torn.inline && !torn.willChange && !torn.locked,
    "the sheet is closed, untransformed and the page is released",
    JSON.stringify(torn));
  // Grabbing a sheet again while it is still springing back: the spring has to
  // let go of the transform, or the sheet fights the thumb and lands wherever
  // the loser finished.
  await page.click("#exportProgramText");
  await page.waitForSelector("#programTextSheet.is-open", { timeout: 5000 });
  await page.waitForTimeout(340);
  {
    const rail2 = await page.locator("#programTextSheet .sheet__head").boundingBox();
    const x2 = Math.round(rail2.x + rail2.width / 2), y2 = Math.round(rail2.y + rail2.height / 2);
    // A short push, released — the sheet starts springing home.
    await page.mouse.move(x2, y2);
    await page.mouse.down();
    for (const dy of [20, 44, 50]) { await page.mouse.move(x2, y2 + dy); await page.waitForTimeout(40); }
    await page.waitForTimeout(140);
    await page.mouse.up();
    // Re-grab 40ms in, while that spring is mid-flight, and push it out.
    await page.waitForTimeout(40);
    await page.mouse.move(x2, y2);
    await page.mouse.down();
    for (const dy of [30, 90, 170, 240]) { await page.mouse.move(x2, y2 + dy); await page.waitForTimeout(24); }
    await page.mouse.up();
    await page.waitForTimeout(700);
  }
  const regrabbed = await page.evaluate(() => {
    const el = document.querySelector("#programTextSheet");
    return { hidden: el.hidden === true, inline: el.style.transform };
  });
  assert(regrabbed.hidden && !regrabbed.inline,
    "a sheet re-grabbed mid-spring follows the second gesture, not the first",
    JSON.stringify(regrabbed));

  // …and reopening it starts from rest, not from where the thumb was.
  await page.click("#exportProgramText");
  await page.waitForSelector("#programTextSheet.is-open", { timeout: 5000 });
  await page.waitForTimeout(380);
  const reopened = await page.evaluate(() => {
    const el = document.querySelector("#programTextSheet");
    return { y: Math.round(new DOMMatrixReadOnly(getComputedStyle(el).transform).m42), inline: el.style.transform };
  });
  assert(Math.abs(reopened.y) < 2 && !reopened.inline,
    "it reopens fully up rather than part-way down", JSON.stringify(reopened));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(320);

  // ---- the gesture handoff ------------------------------------------------------
  // The layer takes the sheet and focus-deck gestures over from app.js at boot by
  // removing app.js's own pointer listeners by function reference. If that removal
  // ever silently fails — a rename, a capture flag, a load-order change — both
  // controllers drive the same surface at once and nothing else would notice,
  // because both move it the same way. Counting app.js's entry into the layer is
  // what makes that failure visible: after the handoff it must never be reached.
  phase("app.js's own gesture path is retired once the layer takes over");
  const handoff = await page.evaluate(() => ({
    installed: window.__tauriferFluidControllersInstalled === true,
    replaced: typeof window.focusAnimateTo === "function",
  }));
  assert(handoff.installed, "the fluid controllers report themselves installed", JSON.stringify(handoff));
  assert(handoff.replaced, "and focusAnimateTo is the layer's, so chevrons and keys share one path");

  await page.evaluate(() => {
    window.__appTrackCalls = 0;
    const real = window.RepForgeMotion.trackSheetGesture;
    // Only app.js reaches the gesture tracker through this property; the layer
    // holds its own closure reference, so a call here is app.js's alone.
    window.RepForgeMotion.trackSheetGesture = (...args) => {
      window.__appTrackCalls++;
      return real(...args);
    };
  });
  await page.click("#exportProgramText");
  await page.waitForSelector("#programTextSheet.is-open", { timeout: 5000 });
  await page.waitForTimeout(340);
  {
    const rail3 = await page.locator("#programTextSheet .sheet__head").boundingBox();
    const x3 = Math.round(rail3.x + rail3.width / 2), y3 = Math.round(rail3.y + rail3.height / 2);
    // A push, pulled back and held still before release: the last samples are a
    // zero and an upward delta, so the release velocity cannot read as a flick
    // whatever the machine did to the samples in between. The threshold itself
    // is sheet-swipe-dismiss.mjs's subject; this phase is about the handoff and
    // must not depend on timing to stay on one side of it.
    //
    // A slow drag this long is also what turned up the pointercancel bug the
    // layer now handles — the browser claims the gesture for a native pan and
    // the release path ran anyway, projecting a stale velocity into a dismissal
    // nobody asked for. Leaving the gesture at this length keeps that covered.
    await page.mouse.move(x3, y3);
    await page.mouse.down();
    for (const dy of [20, 40, 52, 40, 40, 40]) { await page.mouse.move(x3, y3 + dy); await page.waitForTimeout(40); }
    await page.mouse.up();
    await page.waitForTimeout(500);
  }
  const doubled = await page.evaluate(() => window.__appTrackCalls);
  assert(doubled === 0,
    "a sheet drag runs through one controller, not two",
    `app.js entered the tracker ${doubled} time(s)`);
  const stillOpen = await page.evaluate(() => {
    const el = document.querySelector("#programTextSheet");
    return { open: el.classList.contains("is-open"), hidden: el.hidden === true };
  });
  assert(stillOpen.open && !stillOpen.hidden,
    "and that short push left the sheet open", JSON.stringify(stillOpen));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(320);

  // A gesture the browser takes away is not a gesture the lifter finished. When
  // a native pan claims the pointer mid-swipe, `pointercancel` arrives instead
  // of `pointerup` — with whatever velocity the last sample happened to hold.
  // Projecting that is how a sheet dismisses itself out from under someone who
  // never let go, so the cancel path returns it to rest instead.
  phase("a cancelled pointer abandons the swipe rather than committing it");
  await page.click("#exportProgramText");
  await page.waitForSelector("#programTextSheet.is-open", { timeout: 5000 });
  await page.waitForTimeout(340);
  {
    const rail4 = await page.locator("#programTextSheet .sheet__head").boundingBox();
    const x4 = Math.round(rail4.x + rail4.width / 2), y4 = Math.round(rail4.y + rail4.height / 2);
    // The cancel has to carry the live gesture's own pointerId, the way the
    // browser's would, or the handler is right to ignore it.
    await page.evaluate(() => {
      window.__pid = null;
      window.addEventListener("pointermove", e => { window.__pid = e.pointerId; }, { capture: true, passive: true });
    });
    await page.mouse.move(x4, y4);
    await page.mouse.down();
    // Fast and far enough that a release here would unambiguously dismiss.
    for (const dy of [20, 70, 130]) { await page.mouse.move(x4, y4 + dy); await page.waitForTimeout(16); }
    await page.evaluate(() =>
      window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: window.__pid ?? 1, bubbles: true })));
    await page.waitForTimeout(500);
    await page.mouse.up();
  }
  const cancelled = await page.evaluate(() => {
    const el = document.querySelector("#programTextSheet");
    return { open: el.classList.contains("is-open"), hidden: el.hidden === true, inline: el.style.transform };
  });
  assert(cancelled.open && !cancelled.hidden,
    "a throw the browser cancels leaves the sheet open", JSON.stringify(cancelled));
  assert(!cancelled.inline,
    "and it comes back to rest rather than staying where the thumb was",
    JSON.stringify(cancelled));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(320);

  assert(errors.length === 0, "no page errors in the animated run", errors.join(" | "));
  await context.close();

  // ---- reduced motion ----------------------------------------------------------
  phase("under prefers-reduced-motion the state changes without the movement");
  const reduced = await scenario(browser, { reducedMotion: "reduce" });
  assert(await reduced.page.evaluate(() => window.RepForgeMotion.reducedMotion() === true),
    "the layer reports reduced motion from the media query");
  await openSettings(reduced.page);
  await reduced.page.click("#restSecRow");
  // No settle wait at all: the panel must already be at its final state.
  const instant = await reduced.page.evaluate(() => window.__disc("#restSecRow", "#restSecPanel"));
  assert(instant.expanded === "true" && instant.open && instant.height > 40,
    "the disclosure is fully open on the very next frame", JSON.stringify(instant));
  assert(!instant.inlineHeight && !instant.inlineOverflow && !instant.willChange,
    "with no height animation and no layer promotion at all", JSON.stringify(instant));
  await reduced.page.click("#restSecRow");
  const instantShut = await reduced.page.evaluate(() => window.__disc("#restSecRow", "#restSecPanel"));
  assert(instantShut.expanded === "false" && !instantShut.open && instantShut.display === "none",
    "and closes the same way — the information changes, the movement does not happen",
    JSON.stringify(instantShut));

  await installSeedProgram(reduced.page, { waitFor: settle });
  await reduced.page.click('nav button[data-view="program"]');
  await reduced.page.waitForSelector("#exportProgramText", { timeout: 10000 });
  await reduced.page.click("#exportProgramText");
  await reduced.page.waitForSelector("#programTextSheet.is-open", { timeout: 5000 });
  await reduced.page.waitForTimeout(120);
  const rrail = await reduced.page.locator("#programTextSheet .sheet__head").boundingBox();
  const rx = Math.round(rrail.x + rrail.width / 2), ry = Math.round(rrail.y + rrail.height / 2);
  await reduced.page.mouse.move(rx, ry);
  await reduced.page.mouse.down();
  for (const dy of [20, 40, 46]) { await reduced.page.mouse.move(rx, ry + dy); await reduced.page.waitForTimeout(40); }
  // A pause before lifting is what tells a reconsidered push from a throw.
  await reduced.page.waitForTimeout(180);
  await reduced.page.mouse.up();
  // A short push is still a change of mind, and the sheet is still open — it
  // just gets there without a spring.
  await reduced.page.waitForTimeout(60);
  const rSettled = await reduced.page.evaluate(() => {
    const el = document.querySelector("#programTextSheet");
    return { open: el.classList.contains("is-open"), hidden: el.hidden === true, inline: el.style.transform };
  });
  assert(rSettled.open && !rSettled.hidden && !rSettled.inline,
    "an abandoned swipe returns the sheet to rest immediately",
    JSON.stringify(rSettled));
  assert(reduced.errors.length === 0, "no page errors in the reduced-motion run", reduced.errors.join(" | "));
  await reduced.context.close();

  // ---- the discipline pass is still in force -----------------------------------
  phase("Motion did not re-lengthen anything the discipline pass shortened");
  const disc = await scenario(browser);
  const timings = await disc.page.evaluate(() => {
    const read = (el, prop) => getComputedStyle(el)[prop];
    const view = document.querySelector(".view");
    const probe = document.createElement("button");
    probe.className = "btn";
    document.body.appendChild(probe);
    const out = {
      view: read(view, "animationDuration"),
      button: read(probe, "transitionDuration"),
      sheet: read(document.querySelector(".sheet"), "transitionDuration"),
    };
    probe.remove();
    return out;
  });
  assert(timings.view === "0.14s", "view navigation is still the 140ms the discipline pass set", timings.view);
  assert(timings.button.startsWith("0.1s"), "button press feedback is still 100ms", timings.button);
  assert(timings.sheet === "0.26s", "the sheet's own open/close transition is untouched", timings.sheet);
  await disc.context.close();

  await vocabularyHelpers(browser);
  await vocabularyHelpers(browser, { reducedMotion: "reduce" });

  await browser.close();
  console.log(`\nmotion integration: ${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });
