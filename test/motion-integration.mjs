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
import { installSeedProgram, seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

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

/* ---- Focus: the owner-approved picks T1, L2, L4 and M1 (Plan 064 R3e) ------------------
   These run against the real Motion runtime in the real Focus workout. Each pick
   is a travelling outline or a short beat, and none of them may delay or disable
   the shelf's action: the proofs log a set while an outline is still in flight. */
const FOCUS_KEY = "repforge_v1";
const FOCUS_DRAFT = "repforge_draft_v1";

async function persistFocusState(page, mutate) {
  await page.evaluate(async ({ k, src }) => {
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
  }, { k: FOCUS_KEY, src: mutate });
}

/** A fresh Focus workout on the seed program, with the first exercise at `sets` sets. */
async function focusPage(browser, { reducedMotion = "no-preference", sets = 4 } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.evaluate((d) => {
    for (const key of Object.keys(localStorage)) if (key === d || key.startsWith(`${d}:`)) localStorage.removeItem(key);
  }, FOCUS_DRAFT);
  await persistFocusState(page, `
    s.settings = { ...(s.settings || {}), lang: "en", rirMode: "numeric" };
    s.program = ${JSON.stringify(seedProgram().map((e, i) => (i === 0 ? { ...e, sets } : e)))};
    s.programMeta = ${JSON.stringify(seedProgramMeta())};
    s.log = [];`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
  await page.evaluate(async () => {
    await window.__repforgeEnterWorkout({});
    window.__repforgeFocus.to(0);
  });
  await page.waitForSelector("#workout.is-focus .exercise.is-current .focus-shelf", { state: "attached", timeout: 5000 });
  await page.waitForTimeout(160);
  await page.evaluate(SAMPLER);
  return { context, page, errors };
}

/** Per-frame samples of one selector, taken in the page so they share the animation's clock. */
const SAMPLER = `
window.__fm = {
  rect(el) { if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; },
  sample(sel, ms, after) {
    return new Promise((resolve) => {
      const out = [], t0 = performance.now();
      const frame = () => {
        const el = document.querySelector(sel);
        out.push({ t: performance.now() - t0, rect: window.__fm.rect(el) });
        if (performance.now() - t0 < ms) requestAnimationFrame(frame); else resolve(out);
      };
      if (after) after();
      frame();
    });
  },
};
`;

const CARD = "#workout .exercise.is-current";

async function focusMotion(browser, { reducedMotion = "no-preference" } = {}) {
  const reduced = reducedMotion === "reduce";
  const tag = reduced ? " under reduced motion" : "";
  const { context, page, errors } = await focusPage(browser, { reducedMotion, sets: 4 });

  // ---- T1: the shelf's field outline travels ---------------------------------
  phase(`T1: one outline travels between Carga, Reps and RIR${tag}`);
  const fieldRects = await page.evaluate((card) => {
    const r = (id) => window.__fm.rect(document.querySelector(`${card} .shelf__field[data-field="${id}"]`));
    return { load: r("load"), reps: r("reps"), rir: r("rir") };
  }, CARD);
  const t1 = await page.evaluate(async (card) => {
    const select = (id) => document.querySelector(`${card} [data-shelf-field="${id}"]`).click();
    const before = document.querySelector(`${card} .shelf__field.is-sel`)?.dataset.field;
    const samples = await window.__fm.sample(`${card} .shelf__ring`, 420, () => select("load"));
    const first = samples.find((s) => s.rect);
    const dest = document.querySelector(`${card} .shelf__field.is-sel`);
    return { before, samples, first, selected: dest?.dataset.field, pressed: dest?.querySelector("[data-shelf-field]")?.getAttribute("aria-pressed"),
      afterRing: document.querySelectorAll(`${card} .shelf__ring`).length, afterTravel: document.querySelectorAll(`${card} .is-ring-travel`).length,
      shadow: getComputedStyle(dest.querySelector("[data-shelf-field]")).boxShadow };
  }, CARD);
  assert(t1.before === "reps" && t1.selected === "load" && t1.pressed === "true",
    "selecting Carga moves the selection to it", JSON.stringify({ before: t1.before, selected: t1.selected, pressed: t1.pressed }));
  if (reduced) {
    assert(!t1.first && t1.afterRing === 0 && /inset/.test(t1.shadow),
      "the outline is at the selected field on the first frame and nothing travels", JSON.stringify({ first: t1.first, ring: t1.afterRing, shadow: t1.shadow }));
  } else {
    const lefts = t1.samples.filter((s) => s.rect).map((s) => s.rect.left);
    assert(t1.first && Math.abs(t1.first.rect.left - fieldRects.reps.left) < 12 && lefts.some((l) => l > fieldRects.load.left + 4 && l < fieldRects.reps.left - 4),
      "the outline starts on the field it left and passes between the two fields", JSON.stringify({ lefts: lefts.slice(0, 8), reps: fieldRects.reps.left, load: fieldRects.load.left }));
    assert(lefts.length > 0 && Math.abs(lefts.at(-1) - fieldRects.load.left) < 24,
      "it arrives on the selected field", JSON.stringify({ last: lefts.at(-1), load: fieldRects.load.left }));
    assert(t1.afterRing === 0 && t1.afterTravel === 0 && /inset/.test(t1.shadow),
      "afterwards the travelling element is gone and the field wears its own outline again", JSON.stringify({ ring: t1.afterRing, travel: t1.afterTravel, shadow: t1.shadow }));
    const seen = t1.samples.filter((s) => s.rect);
    const travelMs = seen.length ? seen.at(-1).t : 0;
    assert(travelMs > 40 && travelMs < 400, "the travel is a short spring, not a slow glide", String(travelMs));

    const mid = await page.evaluate(async (card) => {
      const select = (id) => document.querySelector(`${card} [data-shelf-field="${id}"]`).click();
      select("reps");
      await new Promise((r) => setTimeout(r, 450));
      select("rir");
      await new Promise((r) => setTimeout(r, 45));
      const live = window.__fm.rect(document.querySelector(`${card} .shelf__ring`));
      select("load");
      const restart = window.__fm.rect(document.querySelector(`${card} .shelf__ring`));
      const action = document.querySelector(`${card} .saveset`);
      const c = action.getBoundingClientRect();
      const hit = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
      const state = { live, restart, actionDisabled: action.disabled, actionHit: action.contains(hit) };
      await new Promise((r) => setTimeout(r, 450));
      return state;
    }, CARD);
    assert(mid.live && mid.restart && Math.abs(mid.restart.left - mid.live.left) < 3,
      "retargeting mid-flight starts the next travel from where the outline is on screen", JSON.stringify(mid));
    assert(!mid.actionDisabled && mid.actionHit, "the shelf action stays enabled and reachable while the outline travels", JSON.stringify(mid));
  }

  // ---- L2: the open-row outline travels on advance and on correction ------------
  phase(`L2: the ledger's open-row outline travels on advance and on correction${tag}`);
  const logOne = async ({ load = "100" } = {}) => {
    const loadInput = page.locator(`${CARD} .focus-shelf .shelf__input[data-k$='_load']`).first();
    if (await loadInput.count()) await loadInput.fill(load);
    return page.evaluate(async (card) => {
      const openBefore = document.querySelector(`${card} .ledgerline--open`)?.getBoundingClientRect().top ?? null;
      const committedBefore = document.querySelectorAll(`${card} [data-editn]`).length;
      const samples = await window.__fm.sample(`${card} .ledgerline__ring`, 520, () => document.querySelector(`${card} .saveset`).click());
      const openAfter = document.querySelector(`${card} .ledgerline--open`);
      return { openBefore, committedBefore, committedAfter: document.querySelectorAll(`${card} [data-editn]`).length,
        samples, openAfterTop: openAfter?.getBoundingClientRect().top ?? null,
        ringAfter: document.querySelectorAll(`${card} .ledgerline__ring`).length, travelAfter: document.querySelectorAll(`${card} .is-ring-travel`).length,
        border: openAfter ? getComputedStyle(openAfter).borderTopColor : "", borderWidth: openAfter ? getComputedStyle(openAfter).borderTopWidth : "" };
    }, CARD);
  };
  // The first set of an install brings up its own guide and re-flows the card, which would move
  // the rows under the measurement; log it first so the travels below are the only thing moving.
  await logOne();
  await page.waitForTimeout(700);
  const adv = await logOne();
  assert(adv.committedAfter === adv.committedBefore + 1, "logging a set commits it", JSON.stringify({ before: adv.committedBefore, after: adv.committedAfter }));
  if (reduced) {
    assert(!adv.samples.some((s) => s.rect) && adv.ringAfter === 0, "no outline travels: the open row simply wears its ring", JSON.stringify(adv.samples.filter((s) => s.rect).slice(0, 3)));
  } else {
    const tops = adv.samples.filter((s) => s.rect).map((s) => s.rect.top);
    assert(tops.length > 1 && Math.abs(tops[0] - adv.openBefore) < 14 && tops.some((v) => v > adv.openBefore + 3 && v < adv.openAfterTop - 3),
      "on advance the outline leaves the row just logged and passes between the rows", JSON.stringify({ tops: tops.slice(0, 10), from: adv.openBefore, to: adv.openAfterTop }));
    assert(adv.ringAfter === 0 && adv.travelAfter === 0 && adv.borderWidth === "2px" && adv.border !== "rgba(0, 0, 0, 0)",
      "afterwards the open row wears its own 2px ring and nothing is left over", JSON.stringify({ ring: adv.ringAfter, travel: adv.travelAfter, border: adv.border, width: adv.borderWidth }));
  }

  // Logging does not wait for the outline: the next set goes in while the last one is still moving.
  const queued = await page.evaluate(async (card) => {
    const count = () => document.querySelectorAll(`${card} [data-editn]`).length;
    const start = count();
    const t0 = performance.now();
    document.querySelector(`${card} .saveset`).click();
    let landed = null;
    while (performance.now() - t0 < 700) {
      await new Promise((r) => requestAnimationFrame(r));
      if (count() === start + 1) { landed = performance.now() - t0; break; }
    }
    await new Promise((r) => setTimeout(r, 520));
    return { start, now: count(), landed, ringLeft: document.querySelectorAll(`${card} .ledgerline__ring`).length };
  }, CARD);
  assert(queued.now === queued.start + 1 && queued.landed != null && queued.landed < 500,
    "a set logged straight after another commits at once: nothing queues behind the outline", JSON.stringify(queued));
  assert(queued.ringLeft === 0, "and no outline is left behind", JSON.stringify(queued));

  // Correction: tap a logged row; the outline goes to it, and back when the edit is cancelled.
  const corr = await page.evaluate(async (card) => {
    const row1 = document.querySelector(`${card} [data-editn="1"]`);
    const openBefore = document.querySelector(`${card} .ledgerline--open`)?.getBoundingClientRect().top ?? null;
    const row1Top = row1.getBoundingClientRect().top;
    const samples = await window.__fm.sample(`${card} .ledgerline__ring`, 520, () => row1.click());
    const open = document.querySelector(`${card} .ledgerline--open`);
    return { openBefore, row1Top, samples, openN: open?.dataset.lrow, current: open?.getAttribute("aria-current"),
      ringAfter: document.querySelectorAll(`${card} .ledgerline__ring`).length };
  }, CARD);
  assert(corr.openN === "1" && corr.current === "true", "tapping a logged row reopens it as the open row", JSON.stringify({ openN: corr.openN, current: corr.current }));
  if (!reduced) {
    const tops = corr.samples.filter((s) => s.rect).map((s) => s.rect.top);
    assert(tops.length > 1 && Math.abs(tops[0] - corr.openBefore) < 14 && tops.some((v) => v < corr.openBefore - 3 && v > corr.row1Top + 3) && corr.ringAfter === 0,
      "on correction the outline travels from the open row to the corrected one", JSON.stringify({ tops: tops.slice(0, 10), from: corr.openBefore, to: corr.row1Top }));
  } else {
    assert(!corr.samples.some((s) => s.rect) && corr.ringAfter === 0, "under reduced motion the correction row is open with no travel", JSON.stringify(corr.samples.filter((s) => s.rect).slice(0, 2)));
  }
  await page.evaluate(() => document.querySelector("#workout .exercise.is-current [data-fcancel]")?.click());
  await page.waitForTimeout(600);

  // ---- M1: the shelf value on a pad tap ------------------------------------------
  phase(`M1: the shelf value moves with the pad tap${tag}`);
  await page.evaluate(() => window.__repforgeFocus.to(1));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__repforgeFocus.to(0));
  await page.waitForTimeout(300);
  // The sets logged above armed a rest, which holds the shelf's pad row; M1 is the field pads' beat, so end the rest first.
  await page.evaluate(() => window.stopRest());
  await page.waitForFunction((card) => document.querySelector(`${card} .shelf__pads`)?.dataset.pads === "field" &&
    !document.querySelector(`${card} .motion-fade-out`), CARD, { timeout: 3000 });
  const pad = async (dir) => page.evaluate(async ({ card, dir }) => {
    const val0 = document.querySelector(`${card} .shelf__field.is-sel .shelf__val`);
    const before = val0.textContent;
    document.querySelector(`${card} .shelf__pad[data-dir="${dir}"]`).click();
    const frames = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 260) {
      await new Promise((r) => requestAnimationFrame(r));
      const v = document.querySelector(`${card} .shelf__field.is-sel .shelf__val`);
      const cs = getComputedStyle(v);
      frames.push({ t: performance.now() - t0, text: v.textContent, cls: [...v.classList].filter((c) => c.startsWith("motion-")), name: cs.animationName, dur: cs.animationDuration, matrix: cs.transform });
    }
    return { before, frames, end: document.querySelector(`${card} .shelf__field.is-sel .shelf__val`).className };
  }, { card: CARD, dir });
  const up = await pad(1);
  assert(up.frames.some((f) => f.text !== up.before), "a pad tap changes the value at once", JSON.stringify({ before: up.before, last: up.frames.at(-1) }));
  const down = await pad(-1);
  if (reduced) {
    assert([...up.frames, ...down.frames].every((f) => f.cls.length === 0 || f.name === "none"),
      "under reduced motion the value changes with no animation", JSON.stringify([up.frames[0], down.frames[0]]));
  } else {
    const dy = (m) => (m && m !== "none" ? Number(m.replace(/^matrix\((.*)\)$/, "$1").split(",")[5]) : 0);
    const upBeat = up.frames.find((f) => f.cls.includes("motion-value-up"));
    const downBeat = down.frames.find((f) => f.cls.includes("motion-value-down"));
    assert(upBeat && downBeat && upBeat.name === "taurifer-value-up" && downBeat.name === "taurifer-value-down",
      "+ arrives from below and - from above", JSON.stringify({ up: upBeat, down: downBeat }));
    assert(upBeat && downBeat && upBeat.dur === "0.12s" && Math.abs(dy(upBeat.matrix)) <= 6 && Math.abs(dy(downBeat.matrix)) <= 6,
      "the beat is at most 6px over 120ms", JSON.stringify({ up: upBeat, down: downBeat }));
    assert(!/motion-value/.test(up.end), "the beat leaves no class behind", up.end);
    // The one switch: the 80ms crossfade replaces the travel.
    await page.evaluate(() => window.__repforgeShelfValueBeat?.("fade"));
    const fade = await pad(1);
    const fadeBeat = fade.frames.find((f) => f.cls.includes("motion-value-fade"));
    assert(fadeBeat && fadeBeat.name === "taurifer-value-fade" && fadeBeat.dur === "0.08s" && !fade.frames.some((f) => f.cls.includes("motion-value-up")),
      "the switch selects the 80ms crossfade instead", JSON.stringify(fadeBeat));
    await page.evaluate(() => window.__repforgeShelfValueBeat?.("directional"));
  }
  const chain = await page.evaluate(async (card) => {
    // Thirty taps in a row: every one lands, none is lost behind a beat.
    const val = () => document.querySelector(`${card} .shelf__field.is-sel .shelf__val`);
    const start = Number(val().textContent) || 0;
    for (let i = 0; i < 30; i++) {
      document.querySelector(`${card} .shelf__pad[data-dir="1"]`).click();
      await new Promise((r) => setTimeout(r, 16));
    }
    await new Promise((r) => setTimeout(r, 300));
    return { start, end: Number(val().textContent) };
  }, CARD);
  assert(chain.end === chain.start + 30, "thirty quick taps land thirty steps", JSON.stringify(chain));

  assert(errors.length === 0, `no page errors in the Focus run${tag}`, errors.join(" | "));
  await context.close();

  // ---- L4: exercise complete: the completion actions rise ---------------------------
  phase(`L4: the completion actions rise while fading in${tag}`);
  const done = await focusPage(browser, { reducedMotion, sets: 2 });
  await done.page.locator(`${CARD} .focus-shelf .shelf__input[data-k$='_load']`).first().fill("100");
  await done.page.locator(`${CARD} .focus-shelf .saveset`).first().click();
  await done.page.waitForTimeout(260);
  await done.page.locator(`${CARD} .focus-shelf .shelf__input[data-k$='_load']`).first().fill("100");
  const fin = await done.page.evaluate(async (card) => {
    document.querySelector(`${card} .saveset`).click();
    const t0 = performance.now();
    while (performance.now() - t0 < 900) {
      await new Promise((r) => requestAnimationFrame(r));
      if (document.querySelector(`${card} .focus-shelf.is-done`)) break;
    }
    const shelf = document.querySelector(`${card} .focus-shelf.is-done`);
    const out = { landed: !!shelf };
    if (!shelf) return out;
    const rise = [...shelf.querySelectorAll(".motion-rise")];
    const cta = shelf.querySelector("[data-fnext]");
    const c = cta.getBoundingClientRect();
    const hit = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
    Object.assign(out, { rise: rise.length, names: rise.map((el) => getComputedStyle(el).animationName), dur: rise.map((el) => getComputedStyle(el).animationDuration),
      ctaDisabled: cta.disabled, ctaHit: cta.contains(hit), ctaPointer: getComputedStyle(cta).pointerEvents });
    cta.click();
    await new Promise((r) => setTimeout(r, 700));
    out.moved = document.querySelector("#workout .exercise.is-current")?.dataset.ex;
    return out;
  }, CARD);
  assert(fin.landed && !fin.ctaDisabled && fin.ctaHit && fin.ctaPointer !== "none",
    "the completion action is enabled and takes a tap from the first frame", JSON.stringify(fin));
  if (reduced) {
    assert((fin.names || []).every((n) => n === "none"), "under reduced motion the completion actions are simply there", JSON.stringify(fin));
  } else {
    assert(fin.rise >= 1 && fin.names.every((n) => n === "taurifer-rise") && fin.dur.every((d) => d === "0.16s"),
      "the completion actions rise 12px or less over 160ms", JSON.stringify(fin));
  }
  assert(fin.moved && fin.moved !== "seed-ex-1", "a tap during the rise goes to the next exercise", JSON.stringify(fin));
  await done.page.evaluate(() => window.__repforgeFocus.to(0));
  await done.page.waitForTimeout(200);
  const rest = await done.page.evaluate((card) => document.querySelectorAll(`${card} .focus-shelf.is-done .motion-rise`).length, CARD);
  assert(rest === 0, "a later render draws the finished exercise at rest", String(rest));
  assert(done.errors.length === 0, `no page errors in the exercise-complete run${tag}`, done.errors.join(" | "));
  await done.context.close();
}

/**
 * L3, the inline rest: the cue slot trades the cue for the clock (and the clock for the done line) in a measured height
 * push with a crossfade, and the drain bar is a transform. The shelf's action stays enabled throughout and a set logged
 * during the push commits at once. Under reduced motion the end state is drawn on the first frame.
 */
async function restMotion(browser, { reducedMotion = "no-preference" } = {}) {
  const reduced = reducedMotion === "reduce";
  const tag = reduced ? " under reduced motion" : "";
  const { context, page, errors } = await focusPage(browser, { reducedMotion, sets: 4 });

  phase(`L3: the cue slot trades the cue for the rest in a measured height push with a crossfade${tag}`);
  await page.locator(`${CARD} .focus-shelf .shelf__input[data-k$='_load']`).first().fill("100");
  // Sample the slot, the ledger under it and the shelf's action every frame across each action that changes the slot.
  const sampled = (action, ms = 700) => page.evaluate(async ({ card, action, ms }) => {
    const q = (s) => document.querySelector(`${card} ${s}`);
    const out = [];
    const t0 = performance.now();
    const read = () => {
      const slot = q(".fx-slot"), cta = q(".saveset") || q(".focus-shelf .btn--cta");
      const fade = q(".motion-fade-out");
      out.push({
        t: Math.round(performance.now() - t0), mode: slot?.dataset.rest, h: slot ? slot.getBoundingClientRect().height : null,
        inlineH: slot?.style.height || "",
        // Measured from the exercise head, so a guide that opens above the card or the card's own scroll cannot read as the slot moving the ledger.
        ledgerTop: (q(".fcard__ledger")?.getBoundingClientRect().top ?? 0) - (q(".fx-head")?.getBoundingClientRect().top ?? 0),
        fade: document.querySelectorAll(`${card} .motion-fade-out`).length, fadeDur: fade ? getComputedStyle(fade).animationDuration : "",
        ctaDisabled: cta ? cta.disabled : null,
      });
    };
    read();
    // Read after the frame's own callbacks have run (the runtime writes its first height there), as the frame is painted.
    const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    if (action === "log") q(".saveset").click();
    else if (action === "bell") { window.__repforgeRest.expire(15); document.dispatchEvent(new Event("visibilitychange")); }
    else if (action === "skip") q(".restpad--skip").click();
    else if (action === "end") window.stopRest();
    while (performance.now() - t0 < ms) { await frame(); read(); }
    return out;
  }, { card: CARD, action, ms });
  const reversals = (values) => {
    const moves = values.slice(1).map((v, i) => v - values[i]).filter((d) => Math.abs(d) > 0.4);
    return moves.slice(1).filter((d, i) => Math.sign(d) !== Math.sign(moves[i])).length;
  };

  const start = await sampled("log");
  const first = start[0], last = start.at(-1);
  assert(last.mode === "running", "logging a set puts the rest in the cue slot", JSON.stringify(last));
  assert(start.every((s) => s.ctaDisabled === false || s.ctaDisabled === null), "the shelf action is enabled in every frame of the swap", JSON.stringify(start.filter((s) => s.ctaDisabled)));
  const startMoves = start.filter((s) => s.mode === "running");
  if (reduced) {
    assert(startMoves.length > 0 && startMoves.every((s) => s.fade === 0 && s.inlineH === "" && Math.abs(s.h - last.h) < 0.5),
      "the slot is at its end height on the first frame it shows the rest, with no crossfade layer", JSON.stringify(startMoves.slice(0, 4)));
  } else if (Math.abs(last.h - first.h) >= 8) {
    const between = startMoves.filter((s) => s.h > Math.min(first.h, last.h) + 1 && s.h < Math.max(first.h, last.h) - 1);
    assert(between.length > 0 && start.some((s) => s.inlineH !== ""), "the slot height is pushed through measured values between the cue's and the clock's", JSON.stringify({ first: first.h, last: last.h, between: between.length }));
    assert(reversals(start.map((s) => s.ledgerTop).filter((v) => v != null)) === 0, "the ledger under the slot moves once, in one direction", JSON.stringify(start.map((s) => Math.round(s.ledgerTop))));
  } else {
    assert(last.inlineH === "", "a slot whose height does not change leaves no inline height behind", JSON.stringify({ first: first.h, last: last.h, inline: last.inlineH }));
  }
  assert(last.inlineH === "" && last.fade === 0, "afterwards no inline height and no crossfade layer are left", JSON.stringify(last));

  // The bell: the clock collapses to the done line above the returned cue, which is always a growth the push has to carry.
  await page.waitForTimeout(260);
  const bell = await sampled("bell");
  const b0 = bell[0], b1 = bell.at(-1);
  assert(b1.mode === "done" && b1.h - b0.h >= 10, "when the bell goes the slot grows to hold the done line and the returned cue", JSON.stringify({ from: b0.h, to: b1.h, mode: b1.mode }));
  if (reduced) {
    const doneFrames = bell.filter((s) => s.mode === "done");
    assert(doneFrames.length > 0 && doneFrames.every((s) => s.fade === 0 && s.inlineH === "" && Math.abs(s.h - b1.h) < 0.5),
      "under reduced motion the done line and the cue are at their end height on the first frame", JSON.stringify(doneFrames.slice(0, 3)));
  } else {
    const between = bell.filter((s) => s.mode === "done" && s.h > b0.h + 1 && s.h < b1.h - 1);
    assert(between.length > 0, "the push carries the slot through the heights between", JSON.stringify(bell.map((s) => Math.round(s.h))));
    const fades = bell.filter((s) => s.fade > 0);
    assert(fades.length > 0 && fades.every((s) => s.fadeDur === "0.16s"), "the outgoing content crosses over the incoming for 160ms", JSON.stringify(fades.slice(0, 3)));
    const gone = bell.findIndex((s, i) => i > 0 && s.fade === 0 && bell[i - 1].fade > 0);
    assert(gone > 0 && bell[gone].t < 420, "the crossfade layer is gone well inside half a second", JSON.stringify(bell.map((s) => [s.t, s.fade])));
    assert(reversals(bell.map((s) => s.ledgerTop).filter((v) => v != null)) === 0, "the ledger moves once for the bell too", JSON.stringify(bell.map((s) => Math.round(s.ledgerTop))));
  }
  assert(bell.every((s) => s.ctaDisabled === false || s.ctaDisabled === null), "the shelf action is enabled throughout the bell's swap");

  // Logging during the push commits at once: nothing waits on the height run, and the render it causes starts the next rest.
  if (!reduced) {
    // A new rest, so the bell has a clock to run out.
    await page.evaluate(() => window.startRest());
    await page.waitForFunction((card) => document.querySelector(`${card} .fx-slot`)?.dataset.rest === "running" &&
      !document.querySelector(`${card} .motion-fade-out`) && document.querySelector(`${card} .fx-slot`).style.height === "", CARD, { timeout: 3000 });
    await page.locator(`${CARD} .focus-shelf .shelf__input[data-k$='_load']`).first().fill("100");
    const during = await page.evaluate(async (card) => {
      const q = (s) => document.querySelector(`${card} ${s}`);
      const slot = q(".fx-slot");
      window.__repforgeRest.expire(15);
      document.dispatchEvent(new Event("visibilitychange"));
      // The slot has just been handed to the running push: it already holds an inline height.
      await new Promise((r) => requestAnimationFrame(r));
      const midPush = slot.style.height !== "" || document.querySelectorAll(`${card} .motion-fade-out`).length > 0;
      const rowsBefore = document.querySelectorAll(`${card} .ledgerline[data-editn]`).length;
      const t0 = performance.now();
      q(".saveset").click();
      let committedAt = null;
      while (performance.now() - t0 < 600) {
        await new Promise((r) => requestAnimationFrame(r));
        if (document.querySelectorAll(`${card} .ledgerline[data-editn]`).length > rowsBefore) { committedAt = Math.round(performance.now() - t0); break; }
      }
      return { midPush, rowsBefore, committedAt, rowsAfter: document.querySelectorAll(`${card} .ledgerline[data-editn]`).length,
        mode: q(".fx-slot")?.dataset.rest, disabled: q(".saveset")?.disabled };
    }, CARD);
    assert(during.midPush, "the second set is logged while the slot is still mid-push", JSON.stringify(during));
    assert(during.committedAt != null && during.committedAt < 250 && during.rowsAfter === during.rowsBefore + 1,
      "a set logged during the push commits at once, not after it", JSON.stringify(during));
    await page.waitForFunction((card) => document.querySelector(`${card} .fx-slot`)?.dataset.rest === "running", CARD, { timeout: 3000 });
    const restarted = await page.evaluate((card) => ({ pads: document.querySelector(`${card} .shelf__pads`).dataset.pads, fade: document.querySelectorAll(`${card} .motion-fade-out`).length }), CARD);
    assert(restarted.pads === "rest", "and its render carries the next rest in from where the slot stood", JSON.stringify(restarted));
    await page.waitForTimeout(400);
  }

  // The drain bar is a transform on a full-width track; reduced motion takes the transition off.
  phase(`L3: the drain bar is a scaleX transform${tag}`);
  await page.evaluate(() => window.startRest());
  await page.waitForFunction((card) => document.querySelector(`${card} .fx-slot`)?.dataset.rest === "running" && !document.querySelector(`${card} .motion-fade-out`), CARD);
  const bar = await page.evaluate(async (card) => {
    const q = (s) => document.querySelector(`${card} ${s}`);
    const fill = q(".restinline__fill"), track = q(".restinline__bar");
    const scale = () => new DOMMatrix(getComputedStyle(fill).transform).a;
    const before = { scale: scale(), width: fill.offsetWidth, track: track.clientWidth };
    q(".restpad--adjust").click();
    await new Promise((r) => setTimeout(r, 420));
    const cs = getComputedStyle(fill);
    return { before, after: { scale: scale(), width: fill.offsetWidth }, prop: cs.transitionProperty, dur: cs.transitionDuration, widthAnimates: /width/.test(cs.transitionProperty) };
  }, CARD);
  assert(bar.before.width === bar.before.track && bar.after.width === bar.before.track && bar.after.scale < bar.before.scale && bar.after.scale > 0.5,
    "the bar keeps its full width and drains by its scale", JSON.stringify(bar));
  if (reduced) assert(bar.dur === "0s", "under reduced motion the bar has no transition", JSON.stringify(bar));
  else assert(bar.prop === "transform" && bar.dur === "0.25s" && !bar.widthAnimates, "the bar's only transition is a 250ms transform", JSON.stringify(bar));
  assert(errors.length === 0, `no page errors in the inline rest run${tag}`, errors.join(" | "));
  await context.close();
}

/* ---- System and first-run motion: S1, O1, O3 (Plan 064 R3, packet R3s) -------------------
   S1 is the one continuous loop outside the rest timer, so its proofs are about the loop
   stopping: the hairline exists only while a retry's durable write is in flight and is gone
   the moment that write is applied, fails or is refused. The write is held in flight with
   the storage lock the app itself takes, so the in-flight window is real and not a timer. */
const STATE_LOCK = "repforge:state-write";

/** The banner's whole motion state in one read. */
const BANNER_STATE = `
window.__banner = () => {
  const root = document.querySelector("#draftRecovery");
  const after = getComputedStyle(root, "::after");
  const label = root.querySelector(".motion-hairline__label");
  const loops = document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations === Infinity);
  return {
    hidden: root.classList.contains("hidden"),
    pending: root.classList.contains("is-pending"), hairline: root.classList.contains("motion-hairline"),
    animation: after.animationName, iterations: after.animationIterationCount, height: after.height,
    label: label ? { text: label.textContent, display: getComputedStyle(label).display } : null,
    loops: loops.length,
    loopProps: [...new Set(loops.flatMap((a) => a.effect.getKeyframes().flatMap((k) => Object.keys(k).filter((p) => !["offset", "easing", "composite", "computedOffset"].includes(p)))))],
    buttons: [...root.querySelectorAll("button:not(.hidden)")].map((b) => ({ id: b.id, disabled: b.disabled })),
  };
};
`;

async function retryBannerMotion(browser, { reducedMotion = "no-preference" } = {}) {
  const reduced = reducedMotion === "reduce";
  const tag = reduced ? " under reduced motion" : "";
  const bannerPage = async () => {
    const run = await focusPage(browser, { reducedMotion, sets: 4 });
    await run.page.evaluate(BANNER_STATE);
    await run.page.evaluate(() => { window.__repforgeDraftFault = "persist-failure"; });
    await run.page.locator(`${CARD} .focus-shelf .shelf__input[data-k$='_load']`).first().fill("100");
    await run.page.waitForSelector("#draftRecovery:not(.hidden)", { timeout: 5000 });
    return run;
  };
  /** Hold the lock every durable write takes, so the retry stays in flight until released. */
  const holdWrites = (page) => page.evaluate(async (name) => {
    await new Promise((resolve) => { navigator.locks.request(name, () => new Promise((release) => { window.__releaseWrites = release; resolve(); })); });
    window.__repforgeDraftFault = null;
  }, STATE_LOCK);

  phase(`S1: the persist-retry banner sweeps a hairline only while its retry is in flight${tag}`);
  const { context, page, errors } = await bannerPage();
  const rest = await page.evaluate(() => window.__banner());
  assert(!rest.pending && !rest.hairline && rest.animation === "none" && rest.loops === 0 && rest.label === null,
    "the banner at rest has no hairline, no label and no loop", JSON.stringify(rest));

  await holdWrites(page);
  await page.click("#draftRecoveryRetry");
  await page.waitForSelector("#draftRecovery.is-pending", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(250);
  const flight = await page.evaluate(() => window.__banner());
  assert(flight.pending && flight.hairline && !flight.hidden, "a retry in flight marks the banner pending", JSON.stringify(flight));
  assert(flight.buttons.length > 0 && flight.buttons.every((b) => !b.disabled), "no control on the banner is disabled while it is pending", JSON.stringify(flight.buttons));
  if (reduced) {
    assert(flight.animation === "none" && flight.loops === 0, "under reduced motion nothing sweeps", JSON.stringify(flight));
    assert(flight.label?.display === "block" && flight.label.text === "Saving…", "the text label says the write is in flight instead", JSON.stringify(flight.label));
  } else {
    assert(flight.animation === "taurifer-hairline" && flight.iterations === "infinite" && flight.height === "1px" && flight.loops === 1,
      "the sweep is the one 1px hairline loop", JSON.stringify(flight));
    assert(flight.loopProps.length === 1 && flight.loopProps[0] === "transform", "and it animates a transform and nothing else", JSON.stringify(flight.loopProps));
    assert(flight.label?.display === "none", "the text label is not shown beside the sweep", JSON.stringify(flight.label));
  }
  await page.evaluate(() => window.__releaseWrites());
  await page.waitForSelector("#draftRecovery", { state: "hidden", timeout: 5000 });
  const applied = await page.evaluate(() => window.__banner());
  assert(!applied.pending && !applied.hairline && applied.loops === 0 && applied.label === null,
    "when the write is applied the class, the label and the loop are gone", JSON.stringify(applied));
  assert((await page.evaluate(() => window.__repforgeWorkoutDraft.recovery())) === null, "and the retry cleared the recovery as it always did");
  assert(errors.length === 0, `no page errors in the applied retry${tag}`, errors.join(" | "));
  await context.close();

  // A retry that is refused: the draft moved on while the write waited, so the banner stays and reads "stale".
  const failed = await bannerPage();
  await holdWrites(failed.page);
  await failed.page.click("#draftRecoveryRetry");
  await failed.page.waitForSelector("#draftRecovery.is-pending", { timeout: 3000 }).catch(() => {});
  await failed.page.evaluate(() => {
    const key = "repforge_draft_v1", draft = JSON.parse(localStorage.getItem(key));
    draft.revision += 1;
    localStorage.setItem(key, JSON.stringify(draft));
    window.__releaseWrites();
  });
  await failed.page.waitForFunction(() => window.__repforgeWorkoutDraft.recovery()?.status === "stale", undefined, { timeout: 5000 });
  const refused = await failed.page.evaluate(() => window.__banner());
  assert(!refused.hidden && !refused.pending && !refused.hairline && refused.loops === 0 && refused.label === null,
    "when the write is refused the banner stays and the hairline stops", JSON.stringify(refused));
  assert(refused.buttons.every((b) => !b.disabled), "and its controls are enabled", JSON.stringify(refused.buttons));
  assert(failed.errors.length === 0, `no page errors in the refused retry${tag}`, failed.errors.join(" | "));
  await failed.context.close();
}

/**
 * O1, the landing proof's stepped reveal. The proof is the static cards when the stage cannot or should not pin (a short
 * screen, enlarged text), so those are the cards that arrive as they scroll into view; the pinned stage and reduced
 * motion never carry it, and closing the landing leaves nothing behind.
 */
async function landingProofMotion(browser, { reducedMotion = "no-preference" } = {}) {
  const reduced = reducedMotion === "reduce";
  const tag = reduced ? " under reduced motion" : "";
  const open = async (height) => {
    const context = await browser.newContext({ viewport: { width: 390, height }, reducedMotion });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message)));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
    await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 8000 });
    await page.waitForTimeout(300);
    return { context, page, errors };
  };
  const steps = () => {
    const list = document.querySelector("#firstRunProofSteps");
    return {
      ready: list.classList.contains("motion-steps-ready"),
      steps: [...document.querySelectorAll("[data-landing-step]")].map((el) => ({ step: el.classList.contains("motion-step"), in: el.classList.contains("is-in"),
        opacity: Number(getComputedStyle(el).opacity), transform: getComputedStyle(el).transform, text: el.textContent.trim().length })),
      transition: getComputedStyle(document.querySelector("[data-landing-step]")).transitionDuration,
      observers: window.__repforgeLandingProof().observers,
    };
  };

  phase(`O1: the landing proof's cards arrive as they scroll in${tag}`);
  const short = await open(560);
  const top = await short.page.evaluate(steps);
  if (reduced) {
    assert(!top.ready && top.steps.every((s) => !s.step && s.opacity === 1), "under reduced motion no step is hidden and none is marked", JSON.stringify(top));
  } else {
    assert(top.ready && top.steps.length === 7 && top.steps.every((s) => s.step && !s.in && s.opacity === 0),
      "on a screen too short to pin, the cards below the fold wait for their turn", JSON.stringify(top));
    assert(top.steps.every((s) => s.text > 0), "every card still carries its text", JSON.stringify(top.steps.map((s) => s.text)));
    await short.page.evaluate(() => { const root = document.querySelector("#firstRun"); root.scrollTop = document.querySelector("#firstRunProofSteps").offsetTop + 80; });
    await short.page.waitForFunction(() => document.querySelector("[data-landing-step].is-in"), undefined, { timeout: 3000 }).catch(() => {});
    await short.page.waitForTimeout(400);
    const first = await short.page.evaluate(steps);
    assert(first.steps[0].in && first.steps[0].opacity === 1 && first.steps[0].transform === "none", "a card that scrolls in rises to rest", JSON.stringify(first.steps[0]));
    assert(first.transition.split(",")[0].trim() === "0.2s", "over 200ms", first.transition);
    assert(first.steps.slice(-1)[0].opacity === 0, "while one still below the fold has not", JSON.stringify(first.steps.slice(-1)));
    for (let i = 0; i < 7; i++) {
      await short.page.evaluate((index) => document.querySelectorAll("[data-landing-step]")[index].scrollIntoView({ block: "center" }), i);
      await short.page.waitForTimeout(120);
    }
    await short.page.waitForTimeout(400);
    const all = await short.page.evaluate(steps);
    assert(all.steps.every((s) => s.in && s.opacity === 1 && s.transform === "none"), "scrolled through, every card is at rest", JSON.stringify(all.steps));
    await short.page.setViewportSize({ width: 390, height: 844 });
    await short.page.waitForFunction(() => window.__repforgeLandingProof().pinned, undefined, { timeout: 3000 });
    const pinned = await short.page.evaluate(steps);
    assert(!pinned.ready && pinned.steps.every((s) => !s.step && !s.in), "when the stage pins the reveal comes off and leaves the steps to the stage", JSON.stringify(pinned));
    await short.page.setViewportSize({ width: 390, height: 560 });
    await short.page.waitForFunction(() => !window.__repforgeLandingProof().pinned, undefined, { timeout: 3000 });
    await short.page.waitForTimeout(300);
    assert((await short.page.evaluate(steps)).ready, "and comes back when it unpins");
  }
  await short.page.evaluate(() => window.closeFirstRun());
  const gone = await short.page.evaluate(steps);
  assert(!gone.ready && gone.steps.every((s) => !s.step && !s.in) && gone.observers === 0, "closing the landing takes the reveal and its observer away", JSON.stringify(gone));
  assert(short.errors.length === 0, `no page errors in the short landing${tag}`, short.errors.join(" | "));
  await short.context.close();

  const tall = await open(844);
  const pin = { ...(await tall.page.evaluate(steps)), proof: await tall.page.evaluate(() => window.__repforgeLandingProof()) };
  assert(pin.proof.pinned === !reduced && !pin.ready && pin.steps.every((s) => !s.step),
    reduced ? "reduced motion does not pin and does not reveal either" : "the pinned stage keeps its own crossfade and gets no reveal", JSON.stringify(pin));
  await tall.context.close();
}

/**
 * O3, the generated program appears. A fresh generation draws the program in reading order, 55ms apart, once; a
 * program that is only being shown again (back and forward, or the saved draft reopened after a reload) is drawn
 * at rest, and nothing the lifter can press is held back.
 */
async function generatedProgramMotion(browser, { reducedMotion = "no-preference" } = {}) {
  const reduced = reducedMotion === "reduce";
  const tag = reduced ? " under reduced motion" : "";
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await settle(page);
  const walk = async () => {
    await page.evaluate(() => window.startOnboarding("settings"));
    await page.click('[data-entry-route="recommend"][data-entry-goal="muscle_growth"]');
    await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
    await page.click('[data-entry-pick="recentConsistency"][data-entry-val="most"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="4"]');
    await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
    await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="120"]');
    await page.click("#onbNext");
    await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
    await page.click("#onbNext");
  };
  phase(`O3: a freshly generated program is drawn in reading order${tag}`);
  await walk();
  const built = await page.evaluate(async () => {
    const out = { frames: [] };
    const t0 = performance.now();
    document.querySelector("#onbNext").click();
    let busy = true;
    while (performance.now() - t0 < 1800) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const review = document.querySelector("#entryCandidateReview");
      if (!review) continue;
      const items = [...document.querySelectorAll("#onbBody .motion-build-item")];
      if (busy && items.length) {
        busy = false;
        out.first = {
          names: items.map((el) => el.className.split(" ").filter((c) => !c.startsWith("motion-")).join(" ") + "|" + el.tagName),
          animation: items.map((el) => getComputedStyle(el).animationName), duration: items.map((el) => getComputedStyle(el).animationDuration),
          delay: items.map((el) => parseFloat(getComputedStyle(el).animationDelay) * 1000), index: items.map((el) => el.style.getPropertyValue("--build-i")),
          order: items.every((el, i, all) => i === 0 || (all[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0),
          activateInside: !!document.querySelector("#entryActivate")?.closest(".motion-build-item"),
          controlsInside: items.some((el) => el.matches("button,input,select,a") || el.querySelector(":scope button:not(summary),:scope input")),
        };
        // A day in the build opens at once when pressed: nothing waits on the build.
        const summary = document.querySelectorAll("#entryCandidateReview details.onb__day")[1]?.querySelector("summary");
        const before = summary?.parentElement.open;
        summary?.click();
        out.toggled = summary ? summary.parentElement.open !== before : null;
        summary?.click();
        out.activateDisabled = document.querySelector("#entryActivate")?.disabled;
        out.activatePointer = getComputedStyle(document.querySelector("#entryActivate")).pointerEvents;
      }
      out.frames.push({ t: Math.round(performance.now() - t0), hosts: document.querySelectorAll("#onbBody .motion-build").length, items: items.length });
    }
    out.opacity = [...document.querySelectorAll("#entryCandidateReview details.onb__day, #entryCandidateReview .entry__progname")].map((el) => Number(getComputedStyle(el).opacity));
    return out;
  });
  if (reduced) {
    assert(!built.first && built.frames.length > 0 && built.frames.every((f) => f.items === 0 && f.hosts === 0), "under reduced motion the whole program is drawn at once with no build", JSON.stringify(built.frames.slice(0, 3)));
  } else {
    const first = built.first;
    assert(first && first.animation.every((n) => n === "taurifer-build-in") && first.duration.every((d) => d === "0.2s"),
      "each block rises into place over 200ms", JSON.stringify(first));
    assert(first?.index.every((v, i) => v === String(i)) && first?.delay.every((d, i) => Math.round(d) === i * 55),
      "each block is 55ms after the one before it, counted in reading order", JSON.stringify(first));
    assert(first?.order && first.names.length >= 5, "in document order, from the name through every day", JSON.stringify(first?.names));
    assert(first && !first.activateInside && !first.controlsInside, "no button or field is part of the build", JSON.stringify(first));
    assert(built.toggled === true && built.activateDisabled === false && built.activatePointer !== "none",
      "a day opens on the first press and the activate action is enabled while the build runs", JSON.stringify(built));
    assert(built.frames.at(-1).items === 0 && built.frames.at(-1).hosts === 0, "the build takes its classes off when the last block lands", JSON.stringify(built.frames.at(-1)));
    assert(built.opacity.every((o) => o === 1), "and every block is at rest", JSON.stringify(built.opacity));
  }

  phase(`O3: showing the same program again does not build it again${tag}`);
  await page.click("#onbBack");
  await page.waitForFunction(() => !document.querySelector("#entryCandidateReview") && !!document.querySelector("#onbNext"), undefined, { timeout: 5000 });
  const again = await page.evaluate(async () => {
    document.querySelector("#onbNext").click();
    let max = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 700) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      max = Math.max(max, document.querySelectorAll("#onbBody .motion-build-item").length);
    }
    return { max, review: !!document.querySelector("#entryCandidateReview") };
  });
  assert(again.review && again.max === 0, "going back and forward draws the program at rest", JSON.stringify(again));
  // An answer chip re-renders the review, and applying a changed answer rebuilds the program in place: neither plays the build.
  const edited = await page.evaluate(async () => {
    let max = 0;
    const watch = async (ms) => {
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        max = Math.max(max, document.querySelectorAll("#onbBody .motion-build-item").length);
      }
    };
    document.querySelector('[data-entry-chip="days"]').click();
    await watch(300);
    const opened = !!document.querySelector("#entryEditor");
    document.querySelector('#entryEditor [data-entry-pick="daysPerWeek"][data-entry-val="3"]').click();
    await watch(150);
    document.querySelector("#entryChipApply").click();
    await watch(900);
    const days = document.querySelectorAll("#entryCandidateReview details.onb__day").length;
    return { max, opened, days, editorClosed: !document.querySelector("#entryEditor") };
  });
  assert(edited.opened && edited.editorClosed && edited.days === 3 && edited.max === 0,
    "opening an answer chip and applying a changed answer draw the program at rest", JSON.stringify(edited));

  // The saved draft, reopened after a reload, is a saved preview.
  await page.waitForFunction(() => !!localStorage.getItem("repforge_program_setup_draft_v1"), undefined, { timeout: 5000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(() => { window.closeFirstRun?.(); window.startOnboarding("settings"); });
  await page.waitForSelector("#entryResumeContinue", { timeout: 8000 });
  const reopened = await page.evaluate(async () => {
    document.querySelector("#entryResumeContinue").click();
    let max = 0, seen = false;
    const t0 = performance.now();
    while (performance.now() - t0 < 900) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      max = Math.max(max, document.querySelectorAll("#onbBody .motion-build-item").length);
      seen = seen || !!document.querySelector("#entryCandidateReview");
    }
    return { max, seen };
  });
  assert(reopened.seen && reopened.max === 0, "reopening the saved preview draws it at rest", JSON.stringify(reopened));
  assert(errors.length === 0, `no page errors in the generated program run${tag}`, errors.join(" | "));
  await context.close();
}

/**
 * Progress motion (Plan 064 R3, owner picks C1, C2 and D4), against the real Motion runtime in the real
 * Progress tab and exercise chart. The table, the readout and the figures are the accessible alternative
 * and must be written at once; the plot is what moves. Reduced motion draws every end state on the first frame.
 */
const PROGRESS_KEY = "repforge_v1";
const progressRows = (() => {
  const mk = (session, date, load) => ({ session, date, day: "Day 1", exerciseId: "pev-1", name: "Incline chest press", load, reps: 8, rir: 2, set: 1, work: true });
  return [mk("h0", "2026-09-05", 50), mk("h1", "2026-09-07", 52.5), mk("b1", "2026-09-14", 55), mk("b2", "2026-09-15", 57.5), mk("b3", "2026-09-16", 60)];
})();

async function progressPage(browser, { reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "UTC", reducedMotion });
  await context.addInitScript(() => {
    globalThis.__repforgeTestNow = "2026-09-17T12:00:00.000Z";
    const Native = Date;
    class Fixed extends Native {
      constructor(...args) { super(...(args.length ? args : [globalThis.__repforgeTestNow])); }
      static now() { return new Native(globalThis.__repforgeTestNow).getTime(); }
    }
    globalThis.Date = Fixed;
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await settle(page);
  const program = [{ id: "pev-1", day: "Day 1", order: 1, name: "Incline chest press", sets: 2, min: 4, max: 8, primary: "Chest", secondary: "Triceps" }];
  await persistFocusState(page, `
    s.settings = { ...(s.settings || {}), lang: "en", unit: "kg" };
    s.program = ${JSON.stringify(program)};
    s.programMeta = ${JSON.stringify(seedProgramMeta({ id: "progress-motion", started: "2026-09-14" }))};
    s.programHistory = [];
    s.log = ${JSON.stringify(progressRows)};`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
  await page.evaluate(() => document.querySelector('nav button[data-view="stats"]')?.click());
  await page.waitForSelector("#stats.view.active", { timeout: 5000 });
  await page.waitForTimeout(250);
  return { context, page, errors };
}

/** Open the lift's chart the way Progress does, and let the opening wipe finish. */
async function openProgressChart(page, { wait = true } = {}) {
  await page.evaluate(() => openExerciseView(window.__repforgeProgressEvidence.keyForExerciseId("pev-1"), "stats"));
  await page.waitForSelector("#exercise.view.active .exchart__plot", { timeout: 5000 });
  if (wait) await page.waitForTimeout(550);
}

/** In-page per-frame samples of whatever `read()` returns, starting from the frame `after` runs in. */
const PROGRESS_SAMPLER = `
window.__pm = {
  rect(el) { if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; },
  frames(read, ms, after) {
    return new Promise((resolve) => {
      const out = [], t0 = performance.now();
      const frame = () => {
        out.push({ t: performance.now() - t0, v: read() });
        if (performance.now() - t0 < ms) requestAnimationFrame(frame); else resolve(out);
      };
      if (after) after();
      frame();
    });
  },
};
`;

async function progressMotion(browser, { reducedMotion = "no-preference" } = {}) {
  const reduced = reducedMotion === "reduce";
  const tag = reduced ? " under reduced motion" : "";
  const { context, page, errors } = await progressPage(browser, { reducedMotion });
  await page.evaluate(PROGRESS_SAMPLER);

  // ---- C1: the line wipes in on open, and only the new stretch on extension -------
  phase(`C1: the chart line wipes in on open${tag}`);
  const c1 = await page.evaluate(async () => {
    const lineClip = () => { const g = document.querySelector(".exchart__svg .ch-trace"); return g ? { cls: g.getAttribute("class"), clip: getComputedStyle(g).clipPath } : null; };
    window.openExerciseView(window.__repforgeProgressEvidence.keyForExerciseId("pev-1"), "stats");
    const first = lineClip();
    const frames = await window.__pm.frames(lineClip, 520);
    const svg = document.querySelector(".exchart__svg");
    return { first, frames, rows: document.querySelectorAll(".exrow").length, readout: !!document.querySelector(".exchart__readout").textContent,
      axesClipped: !!svg.querySelector(".ch-axes")?.getAttribute("class")?.includes("clip"), cursorClipped: getComputedStyle(svg.querySelector(".ex-cursor")).clipPath };
  });
  assert(c1.rows === 3 && c1.readout, "the table and the readout are written at once, whatever the line is doing", JSON.stringify({ rows: c1.rows }));
  if (reduced) {
    assert(c1.first && !/motion-clip-reveal/.test(c1.first.cls) && c1.first.clip === "none" && c1.frames.every((f) => f.v && f.v.clip === "none"),
      "the line is fully drawn on the first frame and nothing wipes", JSON.stringify(c1.first));
  } else {
    const right = (clip) => parseFloat((/inset\([^)]*?\s([\d.]+)%/.exec(clip) || [])[1]);
    const clips = c1.frames.filter((f) => f.v && /motion-clip-reveal/.test(f.v.cls)).map((f) => right(f.v.clip));
    assert(c1.first && /motion-clip-reveal/.test(c1.first.cls) && right(c1.first.clip) > 90,
      "on open the line starts fully clipped from the right", JSON.stringify(c1.first));
    assert(clips.length > 4 && clips.every((v, i) => i === 0 || v <= clips[i - 1] + 0.01) && clips.at(-1) < 5,
      "the clip opens left to right and nothing else moves", JSON.stringify(clips.filter((_, i) => i % 3 === 0)));
    const last = c1.frames.at(-1).v || { cls: "", clip: "(no trace)" };
    assert(!/motion-clip-reveal/.test(last.cls) && last.clip === "none", "afterwards the line is at rest with the beat's class gone", JSON.stringify(last));
    assert(c1.cursorClipped === "none" && !c1.axesClipped, "the axes and the cursor are never covered by the wipe", JSON.stringify({ cursor: c1.cursorClipped }));
  }
  const again = await page.evaluate(async () => {
    window.render();
    await new Promise((r) => setTimeout(r, 40));
    return { reveal: document.querySelectorAll(".motion-clip-reveal").length, ghost: document.querySelectorAll(".exchart__ghost").length };
  });
  assert(again.reveal === 0 && again.ghost === 0, "a re-render of the unchanged chart plays nothing", JSON.stringify(again));
  const pick = await page.evaluate(async () => {
    document.querySelector('.exrow[data-pt="0"]').click();
    await new Promise((r) => setTimeout(r, 30));
    return document.querySelectorAll(".motion-clip-reveal").length;
  });
  assert(pick === 0, "choosing a session does not replay the line", String(pick));
  await page.evaluate(() => document.querySelector('.exrow[data-pt="2"]').click());

  phase(`C1: a session added while the chart is open wipes in only its own stretch${tag}`);
  const ext = await page.evaluate(async () => {
    const before = document.querySelectorAll(".exchart__svg .ex-pt").length;
    const probe = () => [...document.querySelectorAll(".exchart__svg .ch-trace")].map((g) => ({ reveal: g.classList.contains("motion-clip-reveal"), pts: g.querySelectorAll(".ex-pt").length,
      clip: g.classList.contains("motion-clip-reveal") ? getComputedStyle(g).clipPath : "none" }));
    state.log.push({ ...state.log.find((r) => r.session === "b3"), session: "b4", date: "2026-09-17", load: 62.5 });
    window.render();
    const first = probe();
    const frames = await window.__pm.frames(probe, 520);
    return { before, first, frames, rows: document.querySelectorAll(".exrow").length, after: document.querySelectorAll(".exchart__svg .ex-pt").length };
  });
  assert(ext.rows === 4 && ext.after === ext.before + 1, "the new session is in the table and on the plot at once", JSON.stringify({ rows: ext.rows, before: ext.before, after: ext.after }));
  if (reduced) {
    assert(ext.first.length === 1 && !ext.first[0].reveal, "under reduced motion the extended line is drawn whole on the first frame", JSON.stringify(ext.first));
  } else {
    assert(ext.first.length === 2 && !ext.first[0].reveal && ext.first[1].reveal && ext.first[0].pts === ext.before && ext.first[1].pts === 1,
      "the line up to the last session is at rest and only the new stretch and its point wipe", JSON.stringify(ext.first));
    const clips = ext.frames.map((f) => f.v.find((g) => g.reveal)?.clip).filter(Boolean);
    assert(clips.length > 3 && /inset\([^)]*100%/.test(clips[0]), "the new stretch opens from the left", JSON.stringify(clips.filter((_, i) => i % 3 === 0)));
    assert(ext.frames.at(-1).v.every((g) => !g.reveal), "and is at rest afterwards", JSON.stringify(ext.frames.at(-1).v));
  }
  // A comparison control: the same repaint with nothing added plays nothing.
  const quiet = await page.evaluate(async () => { window.render(); await new Promise((r) => setTimeout(r, 40)); return document.querySelectorAll(".motion-clip-reveal").length; });
  assert(quiet === 0, "a repaint after the extension plays nothing", String(quiet));

  // ---- C2: a scope change carries the shared sessions; a metric change crossfades --
  phase(`C2: a scope change carries the sessions both scopes have${tag}`);
  const geometry = await page.evaluate(() => {
    const out = {};
    // The plot's own list of where each session rests, written with the render.
    for (const scope of ["all-history", "current-block"]) {
      document.querySelector(`#exDetail [data-scope="${scope}"]`).click();
      out[scope] = document.querySelector(".exchart__plot").dataset.xs.split(",").map(Number);
    }
    return out;
  });
  await page.waitForTimeout(500);
  const shared = geometry["current-block"].length;
  const offset = geometry["all-history"].length - shared;
  const toAll = await page.evaluate(async () => {
    const read = () => ({
      pts: [...document.querySelectorAll(".exchart__svg .ex-pt")].map((c) => ({ i: c.dataset.i, x: +c.getAttribute("cx"), y: +c.getAttribute("cy"), op: c.getAttribute("opacity") })),
      lines: [...document.querySelectorAll(".exchart__svg .ch-line")].map((p) => p.getAttribute("d")),
      ghost: document.querySelectorAll(".exchart__ghost").length,
    });
    const tableNow = () => ({ rows: document.querySelectorAll(".exrow").length, fig: document.querySelector(".exchart__figs div:last-child b").textContent, scope: document.querySelector('#exDetail [data-scope="all-history"]').getAttribute("aria-pressed") });
    let table = null;
    const frames = await window.__pm.frames(read, 520, () => { document.querySelector('#exDetail [data-scope="all-history"]').click(); table = tableNow(); });
    return { frames, table, blockRule: !!document.querySelector(".exchart__svg .ch-block"), sel: document.querySelectorAll(".exchart__svg .ex-pt--sel").length };
  });
  assert(toAll.table.rows === offset + shared && toAll.table.scope === "true", "the table and the figures change at once", JSON.stringify(toAll.table));
  if (reduced) {
    const f0 = toAll.frames[0].v;
    assert(f0.pts.length === offset + shared && f0.pts.every((p) => !p.op) && f0.ghost === 0 && f0.pts.every((p, i) => Math.abs(p.x - geometry["all-history"][i]) < 0.06),
      "every session is at its new place on the first frame, nothing fades and nothing is left behind", JSON.stringify(f0.pts));
  } else {
    const at = (f, i) => f.v.pts.find((p) => +p.i === i);
    const track = toAll.frames.map((f) => at(f, offset)?.x).filter((v) => v != null);
    assert(Math.abs(track[0] - geometry["current-block"][0]) < 12 && Math.abs(track.at(-1) - geometry["all-history"][offset]) < 0.06 && track.some((x) => x > track[0] + 20 && x < track.at(-1) - 20),
      "a session in both scopes travels from where it was to where it now sits", JSON.stringify(track.filter((_, i) => i % 4 === 0)));
    const ys = toAll.frames.map((f) => at(f, offset)?.y).filter((v) => v != null);
    assert(track.length > 3 && ys.every((y) => y <= Math.max(ys[0], ys.at(-1)) + 0.5 && y >= Math.min(ys[0], ys.at(-1)) - 0.5) && track.every((x) => x >= track[0] - 0.5 && x <= track.at(-1) + 0.5),
      "it moves straight between the two places and does not overshoot", JSON.stringify({ x: track.slice(-5), y: ys.slice(-5) }));
    const fadeIn = toAll.frames.map((f) => at(f, 0)?.op).filter((v) => v != null).map(Number);
    assert(fadeIn.length > 3 && fadeIn[0] < 0.2 && fadeIn.every((v, i) => i === 0 || v >= fadeIn[i - 1] - 0.001) && toAll.frames.at(-1).v.pts.every((p) => !p.op),
      "a session only the new scope has fades in and is at full strength afterwards", JSON.stringify(fadeIn.filter((_, i) => i % 3 === 0)));
    assert(toAll.frames.every((f) => f.v.lines.every((d) => /^[MHV0-9. -]+$/.test(d))),
      "the line is rebuilt as a step on every frame, never a slanted run between the sessions", JSON.stringify(toAll.frames[4].v.lines));
    const end = toAll.frames.at(-1).v;
    assert(end.lines.length === 1 && end.ghost === 0 && toAll.sel === 1 && toAll.blockRule,
      "afterwards one line, no copy of the old axes, one selected point and the block rule", JSON.stringify({ lines: end.lines.length, ghost: end.ghost, sel: toAll.sel }));
    const cross = toAll.frames.some((f) => f.v.ghost === 1);
    assert(cross, "the axes crossfade while the sessions travel");

    phase("C2: sessions only the old scope has fade out as the rest travel back");
    const toBlock = await page.evaluate(async () => {
      const read = () => ({
        pts: [...document.querySelectorAll(".exchart__svg .ex-pt")].map((c) => ({ i: c.dataset.i ?? null, x: +c.getAttribute("cx"), op: c.getAttribute("opacity") })),
        lines: document.querySelectorAll(".exchart__svg .ch-line").length,
      });
      const frames = await window.__pm.frames(read, 520, () => document.querySelector('#exDetail [data-scope="current-block"]').click());
      return { frames, end: read() };
    });
    const leaving = toBlock.frames.map((f) => f.v.pts.filter((p) => p.i == null).map((p) => (p.op == null ? 1 : Number(p.op)))).filter((o) => o.length);
    assert(leaving.length > 3 && leaving[0].every((v) => v > 0.8) && leaving.at(-1).every((v) => v < 0.2),
      "the sessions that leave fade out in place", JSON.stringify(leaving.filter((_, i) => i % 4 === 0)));
    assert(toBlock.end.pts.length === shared && toBlock.end.pts.every((p) => p.i != null && !p.op) && toBlock.end.lines === 1,
      "and only the block's sessions are left, drawn at rest", JSON.stringify(toBlock.end));
    const mid = await page.evaluate(async () => {
      const x = () => +document.querySelector('.exchart__svg .ex-pt[data-i="0"]')?.getAttribute("cx");
      document.querySelector('#exDetail [data-scope="all-history"]').click();
      await new Promise((r) => setTimeout(r, 60));
      document.querySelector('#exDetail [data-scope="current-block"]').click();
      // The block's first session is drawn where it was in the air, not snapped to where it will rest.
      const restart = x();
      await new Promise((r) => setTimeout(r, 560));
      return { restart, end: x() };
    });
    assert(mid.restart > geometry["current-block"][0] + 5 && Math.abs(mid.end - geometry["current-block"][0]) < 0.06,
      "a second change mid-flight carries on from where the sessions are drawn and ends at rest", JSON.stringify(mid));
  }

  phase(`C2: a metric change crossfades and never travels${tag}`);
  await page.evaluate(() => document.querySelector('#exDetail [data-scope="current-block"]').click());
  await page.waitForTimeout(560);
  const metric = await page.evaluate(async () => {
    const read = () => {
      const svg = document.querySelector(".exchart__svg"), ghost = document.querySelector(".exchart__ghost");
      const sel = svg.querySelector(".ex-pt--sel");
      return { ghost: !!ghost, ghostOp: ghost ? +getComputedStyle(ghost).opacity : null, newOp: +getComputedStyle(svg).opacity, y: +sel.getAttribute("cy"), x: +sel.getAttribute("cx"),
        n: svg.querySelectorAll(".ex-pt").length };
    };
    const before = { ...read(), fig: document.querySelector(".exchart__figs div b").textContent };
    let table = null;
    const frames = await window.__pm.frames(read, 400, () => { document.querySelector('#exDetail [data-metric="e1rm"]').click(); table = document.querySelector(".exchart__figs div b").textContent; });
    return { before, frames, table, liveGhosts: document.querySelectorAll(".exchart__ghost").length, ticksInGhost: document.querySelectorAll(".exchart__svg .ex-tick").length };
  });
  assert(metric.table && metric.table !== metric.before.fig, "the figures change at once", JSON.stringify({ now: metric.table, before: metric.before.fig }));
  const ys = metric.frames.map((f) => f.v.y);
  assert(ys.every((y) => Math.abs(y - ys[0]) < 0.06) && metric.frames.every((f) => Math.abs(f.v.x - metric.before.x) < 0.06),
    "no point travels: the new metric is drawn where it belongs from the first frame", JSON.stringify(ys.filter((_, i) => i % 5 === 0)));
  if (reduced) {
    assert(metric.frames.every((f) => !f.v.ghost && f.v.newOp === 1), "under reduced motion the new metric replaces the old on the first frame");
  } else {
    const both = metric.frames.filter((f) => f.v.ghost);
    assert(both.length > 3 && both[0].v.newOp < 0.5 && both[0].v.ghostOp > 0.5 && both.at(-1).v.newOp > 0.5 && both.at(-1).v.ghostOp < 0.5,
      "the old drawing fades out as the new one fades in", JSON.stringify(both.filter((_, i) => i % 3 === 0).map((f) => [f.v.newOp, f.v.ghostOp])));
    const last = metric.frames.at(-1).v;
    assert(!last.ghost && last.newOp === 1 && metric.liveGhosts === 0, "afterwards only the new drawing is left, at full strength", JSON.stringify(last));
  }

  // ---- D4: the marker snaps to the nearest session and travels --------------------
  phase(`D4: the chart marker snaps to a session and travels there${tag}`);
  await page.evaluate(() => document.querySelector('#exDetail [data-metric="top"]').click());
  await page.waitForTimeout(560);
  const d4 = await page.evaluate(async () => {
    const selRect = () => window.__pm.rect(document.querySelector(".exchart__svg .ex-pt--sel"));
    const start = selRect();
    let now = null;
    const frames = await window.__pm.frames(() => ({ dot: window.__pm.rect(document.querySelector(".exchart__marker")), line: window.__pm.rect(document.querySelector(".exchart__scrub")) }), 480, () => {
      document.querySelector('.exrow[data-pt="0"]').click();
      now = { readout: document.querySelector(".exchart__readout").textContent, pressed: document.querySelector('.exrow[data-pt="0"]').getAttribute("aria-pressed"),
        sel: document.querySelector(".exchart__svg .ex-pt--sel")?.dataset.i, cursor: document.querySelector(".exchart__svg .ex-cursor")?.getAttribute("x1"),
        pt0: document.querySelector('.exchart__svg .ex-pt[data-i="0"]')?.getAttribute("cx"), r: document.querySelector(".exchart__svg .ex-pt--sel").getAttribute("r"),
        hidden: getComputedStyle(document.querySelector(".exchart__svg .ex-pt--sel")).visibility };
    });
    return { start, now, frames, dest: selRect(), left: document.querySelectorAll(".exchart__marker,.exchart__scrub").length,
      visible: getComputedStyle(document.querySelector(".exchart__svg .ex-pt--sel")).visibility, plotCls: document.querySelector(".exchart__plot").className };
  });
  assert(/Sep 14/.test(d4.now.readout) && d4.now.pressed === "true" && d4.now.sel === "0" && d4.now.cursor === d4.now.pt0 && d4.now.r === "5",
    "the readout, the table row, the selected point and the cursor are the new session's in the same tick", JSON.stringify(d4.now));
  if (reduced) {
    assert(d4.frames.every((f) => !f.v.dot && !f.v.line) && d4.now.hidden === "visible",
      "under reduced motion the marker is on the new session on the first frame and nothing travels", JSON.stringify(d4.now));
  } else {
    const seen = d4.frames.filter((f) => f.v.dot);
    const lefts = seen.map((f) => f.v.dot.left);
    assert(d4.now.hidden === "hidden" && seen.length > 3 && Math.abs(lefts[0] - d4.start.left) < 14,
      "the marker starts on the session it left, with the destination's own point set aside", JSON.stringify({ first: lefts[0], start: d4.start.left, hidden: d4.now.hidden }));
    assert(lefts.some((l) => l < d4.start.left - 40 && l > d4.dest.left + 40) && Math.abs(lefts.at(-1) - d4.dest.left) < 12,
      "it passes between the two sessions and arrives on the chosen one", JSON.stringify(lefts.filter((_, i) => i % 3 === 0)));
    assert(lefts.length > 3 && lefts.every((l, i) => i === 0 || l <= lefts[i - 1] + 0.01) && lefts.every((l) => l >= d4.dest.left - 1.5),
      "it only ever moves toward the session: no overshoot and no inertia carrying it past", JSON.stringify(lefts.slice(-6)));
    const dur = seen.at(-1)?.t ?? 0;
    assert(dur > 40 && dur < 420, "the travel is a short spring", String(dur));
    assert(seen.length > 3 && seen.every((f) => f.v.line && Math.abs(f.v.line.left + 0.5 - (f.v.dot.left + f.v.dot.width / 2)) < 1.6),
      "the cursor line travels with the marker", JSON.stringify(seen.slice(0, 3)));
    assert(d4.left === 0 && d4.visible === "visible" && !/is-marker-travel/.test(d4.plotCls),
      "afterwards the travelling marker is gone and the selected point is drawn by the plot", JSON.stringify({ left: d4.left, visible: d4.visible, cls: d4.plotCls }));

    const scrub = await page.evaluate(async () => {
      const read = (el) => (el ? +el.getBoundingClientRect().left.toFixed(1) : null);
      document.querySelector('.exrow[data-pt="2"]').click();
      await new Promise((r) => setTimeout(r, 50));
      const live = read(document.querySelector(".exchart__marker"));
      document.querySelector('.exrow[data-pt="1"]').click();
      const restart = read(document.querySelector(".exchart__marker"));
      const one = document.querySelectorAll(".exchart__marker").length;
      await new Promise((r) => setTimeout(r, 520));
      return { live, restart, one, left: document.querySelectorAll(".exchart__marker").length, sel: document.querySelector(".exchart__svg .ex-pt--sel").dataset.i };
    });
    assert(scrub.live != null && Math.abs(scrub.restart - scrub.live) < 3 && scrub.one === 1 && scrub.left === 0 && scrub.sel === "1",
      "a second snap mid-flight carries on from where the marker is drawn", JSON.stringify(scrub));

    const drag = await page.evaluate(() => { const p = document.querySelector(".exchart__plot").getBoundingClientRect(); return { l: p.left, t: p.top, w: p.width, h: p.height }; });
    await page.mouse.move(drag.l + 20, drag.t + drag.h / 2);
    await page.mouse.down();
    const picked = new Set();
    for (let x = 20; x < drag.w - 10; x += 14) {
      await page.mouse.move(drag.l + x, drag.t + drag.h / 2);
      picked.add(await page.evaluate(() => document.querySelector(".exchart__svg .ex-pt--sel").dataset.i));
      await page.waitForTimeout(14);
    }
    const during = await page.evaluate(() => ({ marker: document.querySelectorAll(".exchart__marker").length, readout: document.querySelector(".exchart__readout").textContent,
      sel: document.querySelector(".exchart__svg .ex-pt--sel").dataset.i, row: document.querySelector('.exrow[aria-pressed="true"]').dataset.pt }));
    await page.mouse.up();
    await page.waitForTimeout(520);
    assert(picked.size >= 3 && during.sel === during.row, "dragging across the plot snaps to each session in turn, the table agreeing at every step", JSON.stringify({ picked: [...picked], during }));
    assert((await page.evaluate(() => document.querySelectorAll(".exchart__marker,.exchart__scrub").length)) === 0, "and leaves no marker behind");
  }
  assert(errors.length === 0, `no page errors in the Progress run${tag}`, errors.join(" | "));
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

  await focusMotion(browser);
  await focusMotion(browser, { reducedMotion: "reduce" });
  await restMotion(browser);
  await restMotion(browser, { reducedMotion: "reduce" });
  await progressMotion(browser);
  await progressMotion(browser, { reducedMotion: "reduce" });

  await retryBannerMotion(browser);
  await retryBannerMotion(browser, { reducedMotion: "reduce" });
  await landingProofMotion(browser);
  await landingProofMotion(browser, { reducedMotion: "reduce" });
  await generatedProgramMotion(browser);
  await generatedProgramMotion(browser, { reducedMotion: "reduce" });

  await browser.close();
  console.log(`\nmotion integration: ${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });
