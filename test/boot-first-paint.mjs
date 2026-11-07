#!/usr/bin/env node
/**
 * First paint is always the right surface (owner, 2026-10-31).
 *
 * A first-time visitor used to see an empty Today (its headings, Start workout
 * and the dock, with no program in it) before the landing covered it, and an
 * installed app showed the same empty shell between the launch image and the
 * real Today. Now the launch splash (#bootSplash) covers the page from the first
 * frame until boot has drawn the surface the load lands on.
 *
 * Every frame is recorded from navigation start: an init script, which runs
 * before any of the page's own scripts, samples the page on every animation
 * frame (the step right before each paint) and records what a lifter would see:
 * the splash still covering, the landing, or the app view with or without its
 * content. A frame that shows Today's shell without content fails. Then the first
 * frame the splash no longer covers has to be the expected surface:
 *   (a) a first-time visitor: the landing;
 *   (b) an activated lifter, on a cold load and as the installed standalone app:
 *       Today with the program's session in it;
 *   (c) the same with every IndexedDB open held back 1.5s and the CPU slowed 4x;
 *   (d) offline, served by the service worker.
 * Plus the guards around it: a boot that throws becomes the error state rather
 * than an endless splash, and reduced motion removes the splash without a fade.
 *
 * With BOOT_FRAMES_DIR set, the painted frames are also written there as PNGs
 * from a CDP screencast, as review evidence.
 *
 * Run: node test/boot-first-paint.mjs   (requires the app served over HTTP)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const FRAMES_DIR = process.env.BOOT_FRAMES_DIR || "";
const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`); }
}

/** Runs in the page before its own scripts: one sample per animation frame. */
function recordFrames() {
  const frames = [];
  window.__bootFrames = frames;
  const start = performance.now();
  const shown = (el) => !!el && !el.classList.contains("hidden") && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden";
  function sample() {
    const d = document, root = d.documentElement;
    const splash = d.getElementById("bootSplash");
    const splashStyle = splash ? getComputedStyle(splash) : null;
    const covering = !!splash && splashStyle.display !== "none" && parseFloat(splashStyle.opacity) >= 0.99;
    const mark = splash?.querySelector(".bootsplash__mark");
    const markStyle = mark ? getComputedStyle(mark) : null;
    const firstRun = d.getElementById("firstRun");
    const log = d.getElementById("log");
    const session = d.getElementById("todaySession");
    const shell = d.getElementById("workoutShell");
    frames.push({
      t: Math.round(performance.now() - start),
      body: !!d.body,
      covering,
      splash: !!splash,
      splashOpacity: splashStyle ? +parseFloat(splashStyle.opacity).toFixed(3) : 0,
      markShown: !!markStyle && markStyle.display !== "none" && parseFloat(markStyle.opacity) > 0.01,
      landingOpacity: firstRun ? +parseFloat(getComputedStyle(firstRun).opacity).toFixed(3) : 0,
      failed: root.classList.contains("is-boot-failed"),
      landing: shown(d.getElementById("firstRun")),
      today: !!log && log.classList.contains("active") && shown(log) && !shown(shell),
      todayContent: !!session && session.children.length > 0 && (session.textContent || "").trim().length > 0,
      todayNoProgram: shown(d.getElementById("todayNoProgram")),
      workout: shown(shell),
      view: d.querySelector(".view.active")?.id || null,
      booted: window.__repforgeBooted === true,
      alert: !!d.querySelector('#bootSplash [role="alert"]'),
    });
    if (frames.length < 3000) requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
}

/**
 * Runs before the page's scripts. The head script's 12 s stall timer fires at 300 ms, and a probe
 * scheduled with it counts each deadline (window.__bootDeadlinePasses), so a test waits for "the
 * deadline has passed" as a state rather than sleeping. By default (gate) the stall callback waits
 * until app.js has defined its failure hook, so the deadline is a boot still running once app.js
 * has taken over; the head script's own fallback is covered by the app.js-missing guard, and by the
 * late-app.js case with gate off.
 */
function shortenBootStall(options = {}) {
  const gate = options.gate !== false;
  const realSetTimeout = window.setTimeout.bind(window);
  window.__bootDeadlinePasses = 0;
  window.setTimeout = (fn, ms, ...rest) => {
    if (ms !== 12000) return realSetTimeout(fn, ms, ...rest);
    realSetTimeout(() => { window.__bootDeadlinePasses += 1; }, 300);
    const run = () => {
      if (window.__holdBootDeadline === true || (gate && typeof window.__repforgeShowBootFailure !== "function")) return void realSetTimeout(run, 20);
      fn();
    };
    return realSetTimeout(run, 300);
  };
}

/** Settles with `promise`, or fails if it has not settled within the bound: a hold must be reached, never assumed. */
function reachedWithin(promise, label, ms = 15000) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`not reached: ${label}`)), ms); })])
    .finally(() => clearTimeout(timer));
}

/** Runs before the page's scripts: IndexedDB successes are held until the test releases them. */
function holdIndexedDbOpens() {
  window.__holdIdb = false;
  const held = [];
  window.__releaseIdb = () => {
    window.__holdIdb = false;
    for (const request of held.splice(0)) {
      const late = new Event("success");
      late.__late = true;
      request.dispatchEvent(late);
    }
  };
  const open = IDBFactory.prototype.open;
  IDBFactory.prototype.open = function (...args) {
    const request = open.apply(this, args);
    request.addEventListener("success", (event) => {
      if (event.__late || !window.__holdIdb) return;
      event.stopImmediatePropagation();
      held.push(request);
    }, { capture: true });
    return request;
  };
}

/** What a frame shows a lifter. Only "empty-today" and "app-blank" are wrong at any time. */
function classify(frame) {
  // Before the parser reaches <body>'s first child (the splash) nothing is drawn but the page's ground.
  if (!frame.body || (!frame.splash && !frame.view && !frame.landing)) return "blank";
  if (frame.failed) return "error";
  if (frame.covering) return "splash";
  if (frame.landing) return "landing";
  if (frame.workout) return "workout";
  if (frame.today) return frame.todayContent ? "today" : frame.todayNoProgram ? "today-no-program" : "empty-today";
  return frame.view ? `view:${frame.view}` : "app-blank";
}

async function openRecorded(browser, { context, url = BASE, standalone = false, slowStorage = false, cpu = 1, reducedMotion = "no-preference" } = {}) {
  const ctx = context || await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion });
  await ctx.addInitScript(recordFrames);
  if (standalone) {
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, "standalone", { configurable: true, get: () => true });
      const real = window.matchMedia.bind(window);
      window.matchMedia = (query) => /display-mode:\s*standalone/.test(query)
        ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }
        : real(query);
    });
  }
  if (slowStorage) {
    // Every IndexedDB open answers 1.5s late: the success event is held and re-sent.
    await ctx.addInitScript(() => {
      const open = IDBFactory.prototype.open;
      IDBFactory.prototype.open = function (...args) {
        const request = open.apply(this, args);
        request.addEventListener("success", (event) => {
          if (event.__late) return;
          event.stopImmediatePropagation();
          setTimeout(() => { const late = new Event("success"); late.__late = true; request.dispatchEvent(late); }, 1500);
        }, { capture: true });
        return request;
      };
    });
  }
  const page = await ctx.newPage();
  const shots = [];
  let cdp = null;
  if (cpu > 1 || FRAMES_DIR) cdp = await ctx.newCDPSession(page);
  if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  if (FRAMES_DIR) {
    cdp.on("Page.screencastFrame", ({ data, sessionId, metadata }) => {
      shots.push({ data, at: metadata?.timestamp });
      cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    });
    await cdp.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });
  }
  await page.goto(url, { waitUntil: "commit" });
  await waitForAppBoot(page, { base: BASE, timeout: 30000 });
  await page.waitForFunction(() => !document.getElementById("bootSplash"), undefined, { timeout: 10000 });
  await page.waitForTimeout(250);
  const frames = await page.evaluate(() => window.__bootFrames.slice());
  if (cdp && FRAMES_DIR) await cdp.send("Page.stopScreencast").catch(() => {});
  return { ctx, page, frames, shots };
}

function saveShots(label, shots) {
  if (!FRAMES_DIR) return;
  const dir = join(FRAMES_DIR, label);
  mkdirSync(dir, { recursive: true });
  shots.forEach((shot, index) => writeFileSync(join(dir, `${String(index).padStart(3, "0")}.png`), Buffer.from(shot.data, "base64")));
}

/** The frames as runs of one kind each, e.g. blank×3 → splash×41 → today×20. */
function runs(frames) {
  const out = [];
  for (const frame of frames) {
    const kind = classify(frame);
    if (out.length && out.at(-1).kind === kind) out.at(-1).n++;
    else out.push({ kind, n: 1, t: frame.t });
  }
  return out.map((run) => `${run.kind}×${run.n}@${run.t}ms`).join(" → ");
}

function checkSequence(label, frames, expected) {
  const kinds = frames.map(classify);
  const sequence = runs(frames);
  console.log(`    ${label}: ${sequence}`);
  assert(frames.length > 5, `${label}: frames were recorded from navigation start`, `${frames.length}`);
  assert(kinds.includes("splash"), `${label}: the launch splash covers the load`, sequence);
  assert(!kinds.includes("empty-today") && !kinds.includes("app-blank"), `${label}: no frame shows Today's shell without content`, sequence);
  const firstSurface = kinds.find((kind) => kind !== "blank" && kind !== "splash");
  assert(firstSurface === expected, `${label}: the first frame past the splash is ${expected}`, `${firstSurface} — ${sequence}`);
  const after = kinds.slice(kinds.indexOf(firstSurface));
  assert(after.every((kind) => kind === expected), `${label}: it stays ${expected} once shown`, sequence);
  assert(frames.every((frame) => !frame.alert), `${label}: the splash's error panel is never an alert on a boot that succeeds`, sequence);
  // The cover may only be translucent once its mark has gone: the mark is never seen over content.
  const ghosted = frames.filter((frame) => frame.splash && frame.splashOpacity < 0.99 && frame.markShown);
  assert(ghosted.length === 0, `${label}: no frame shows the splash mark over painted content`, JSON.stringify(ghosted.slice(0, 3)));
  if (expected === "landing") {
    const first = frames.find((frame) => classify(frame) === "landing");
    assert(!!first && !first.splash && first.landingOpacity === 1, `${label}: the first frame with content is the whole landing at full opacity, with no cover left`, JSON.stringify(first));
    assert(frames.every((frame) => !frame.splash || frame.splashOpacity >= 0.99), `${label}: a landing boot never fades a cover over the landing`, sequence);
    assert(frames.every((frame) => !frame.splash || !frame.markShown), `${label}: a landing boot never shows the launch mark`, sequence);
  }
}

async function activatedContext(browser, options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, ...options });
  const page = await context.newPage();
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  await installSeedProgram(page, { waitFor: (p) => waitForAppBoot(p, { base: BASE }) });
  await page.close();
  return context;
}

const browser = await launchChromium();
try {
  console.log("\n(a) A first-time visitor");
  {
    const run = await openRecorded(browser);
    checkSequence("first visit", run.frames, "landing");
    saveShots("a-first-visit", run.shots);
    await run.ctx.close();
  }

  console.log("\n(a) A visitor who has seen the landing and left a setup half done still gets the landing first");
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(BASE);
    await waitForAppBoot(page, { base: BASE });
    await page.close();
    const run = await openRecorded(browser, { context });
    checkSequence("return visit", run.frames, "landing");
    await context.close();
  }

  console.log("\n(b) An activated lifter, cold load");
  {
    const context = await activatedContext(browser);
    const run = await openRecorded(browser, { context });
    checkSequence("cold load", run.frames, "today");
    const pre = await run.page.evaluate(() => document.documentElement.dataset.boot);
    assert(pre === "app", "the pre-paint script marked the load as the app", pre);
    saveShots("b-cold-load", run.shots);
    await context.close();
  }

  console.log("\n(b) An activated lifter, the installed app (standalone)");
  {
    const context = await activatedContext(browser);
    const run = await openRecorded(browser, { context, standalone: true });
    checkSequence("standalone", run.frames, "today");
    saveShots("b-standalone", run.shots);
    await context.close();
  }

  console.log("\n(c) Slow storage: every IndexedDB open held 1.5s, CPU 4x slower");
  {
    const context = await activatedContext(browser);
    const run = await openRecorded(browser, { context, slowStorage: true, cpu: 4 });
    checkSequence("slow storage", run.frames, "today");
    const splashFrames = run.frames.filter((frame) => classify(frame) === "splash");
    assert(splashFrames.length > 10 && splashFrames.at(-1).t >= 1500, "the splash held through the slow storage read", JSON.stringify({ n: splashFrames.length, last: splashFrames.at(-1)?.t }));
    saveShots("c-slow-storage", run.shots);
    await context.close();
  }

  console.log("\n(d) Offline, from the service worker");
  {
    const context = await activatedContext(browser, { serviceWorkers: "allow" });
    const prime = await context.newPage();
    await prime.goto(BASE);
    await waitForAppBoot(prime, { base: BASE });
    await prime.evaluate(async () => { await navigator.serviceWorker.ready; });
    await prime.reload();
    await waitForAppBoot(prime, { base: BASE });
    const controlled = await prime.evaluate(() => !!navigator.serviceWorker.controller);
    assert(controlled, "the service worker controls the page before going offline");
    await prime.close();
    await context.setOffline(true);
    const run = await openRecorded(browser, { context });
    const fromCache = await run.page.evaluate(() => !!navigator.serviceWorker.controller);
    assert(fromCache, "the offline load is served by the service worker");
    checkSequence("offline", run.frames, "today");
    saveShots("d-offline", run.shots);
    await context.close();
  }

  console.log("\nGuards");
  {
    const run = await openRecorded(browser, { reducedMotion: "reduce" });
    const kinds = run.frames.map(classify);
    const fading = run.frames.filter((frame) => frame.splash && !frame.covering && frame.body);
    assert(fading.length === 0, "under reduced motion the splash is removed at once, with no fade frames", JSON.stringify(fading.slice(0, 3)));
    assert(!kinds.includes("empty-today"), "reduced motion: no frame shows Today's shell without content", runs(run.frames));
    await run.ctx.close();
  }
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    // The exercise catalog is the first thing boot loads. Its recovery dialog sits in the top layer, over the splash.
    await page.route(/assets\/exercise-catalog\.json/u, (route) => route.fulfill({ status: 503, body: "" }));
    await page.goto(BASE);
    await page.waitForSelector("#exerciseCatalogRecovery[open]", { timeout: 20000 });
    const held = await page.evaluate(() => {
      const dialog = document.getElementById("exerciseCatalogRecovery").getBoundingClientRect();
      const top = document.elementFromPoint(dialog.left + dialog.width / 2, dialog.top + dialog.height / 2);
      return { splash: !!document.getElementById("bootSplash"), dialogOnTop: !!top?.closest("#exerciseCatalogRecovery"),
        failed: document.documentElement.classList.contains("is-boot-failed") };
    });
    assert(held.splash && held.dialogOnTop && !held.failed, "an unavailable catalog shows its recovery dialog over the splash, not an empty Today", JSON.stringify(held));
    await context.close();
  }
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    // app.js never arrives: the head script's stall timer has to show the error state.
    await page.route(/app\.js(\?|$)/u, (route) => route.abort());
    await page.addInitScript(() => {
      const realSetTimeout = window.setTimeout;
      window.setTimeout = (fn, ms, ...rest) => realSetTimeout(fn, ms >= 12000 ? 300 : ms, ...rest);
    });
    await page.goto(BASE);
    await page.waitForFunction(() => document.documentElement.classList.contains("is-boot-failed"), undefined, { timeout: 10000 });
    const failure = await page.evaluate(() => {
      const panel = document.querySelector("#bootSplash .bootsplash__fail");
      const reload = document.getElementById("bootReload");
      return { shown: !!panel && getComputedStyle(panel).display !== "none", text: panel?.innerText || "", role: panel?.getAttribute("role") || null,
        reload: !!reload && reload.getBoundingClientRect().height >= 44 };
    });
    assert(failure.shown && failure.role === "alert" && /Reload|Recarregar/.test(failure.text) && failure.reload, "when boot never finishes, the splash becomes the error state with a Reload action", JSON.stringify(failure));
    const navigated = await Promise.all([
      page.waitForNavigation({ timeout: 5000 }).then(() => true, () => false),
      page.click("#bootReload"),
    ]).then(([reloaded]) => reloaded);
    assert(navigated, "with app.js missing, the error panel's Reload reloads the page", "no navigation after clicking Reload");
    await context.close();
  }

  console.log("\nLate app.js: the head script's fallback panel is lifted once app.js boots");
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(shortenBootStall, { gate: false });
    const page = await context.newPage();
    let releaseApp;
    const appHeld = new Promise((resolve) => { releaseApp = resolve; });
    let reachedApp;
    const appReached = new Promise((resolve) => { reachedApp = resolve; });
    await page.route(/app\.js(\?|$)/u, async (route) => { reachedApp(); await appHeld; await route.continue(); });
    // app.js is a blocking script at the end of the body, so DOMContentLoaded waits for it.
    await page.goto(BASE, { waitUntil: "commit" });
    await reachedWithin(appReached, "the held app.js request");
    await page.waitForFunction(() => document.documentElement.classList.contains("is-boot-failed"), undefined, { timeout: 10000 });
    const fallback = await page.evaluate(() => ({
      panel: !!document.querySelector("#bootSplash .bootsplash__fail"),
      hookDefined: typeof window.__repforgeShowBootFailure === "function",
    }));
    assert(fallback.panel && !fallback.hookDefined, "before app.js arrives, the head script shows the error panel itself", JSON.stringify(fallback));
    await page.keyboard.press("Tab");
    const fallbackTab = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName || null);
    const fallbackInert = await page.evaluate(() => document.querySelector("main")?.inert === true);
    assert(fallbackTab === "bootReload" && fallbackInert, `the head script's own panel contains Tab on its Reload and makes the page inert (focus: ${fallbackTab})`,
      JSON.stringify({ fallbackTab, fallbackInert }));
    releaseApp();
    await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
    const after = await page.evaluate(() => ({
      splash: !!document.getElementById("bootSplash"),
      failed: document.documentElement.classList.contains("is-boot-failed"),
    }));
    assert(!after.splash && !after.failed, "when app.js arrives and boots, the fallback panel is lifted and its failed state is cleared", JSON.stringify(after));
    const restored = await page.evaluate(() => document.querySelector("main")?.inert === false);
    assert(restored, "when the late boot succeeds, the page is no longer inert");
    await context.close();
  }

  console.log("\nSlow boot: the stall deadline passes while boot is still running");
  {
    // Service workers are blocked: a controlling worker would answer the catalog request and the held route would hold nothing.
    const context = await activatedContext(browser, { serviceWorkers: "block" });
    await context.addInitScript(shortenBootStall);
    const page = await context.newPage();
    let releaseCatalog;
    const catalogHeld = new Promise((resolve) => { releaseCatalog = resolve; });
    let reachedCatalog;
    const catalogReached = new Promise((resolve) => { reachedCatalog = resolve; });
    await page.route(/assets\/exercise-catalog\.json/u, async (route) => { reachedCatalog(); await catalogHeld; await route.continue(); });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await reachedWithin(catalogReached, "the held catalog request");
    await page.waitForFunction(() => document.documentElement.classList.contains("is-boot-failed"), undefined, { timeout: 10000 });
    const stalled = await page.evaluate(() => {
      window.__reloadRef = document.getElementById("bootReload");
      return {
        booted: window.__repforgeBooted === true,
        panel: !!document.querySelector("#bootSplash .bootsplash__fail"),
        alert: !!document.querySelector('#bootSplash [role="alert"]'),
        reloadFocused: document.activeElement === window.__reloadRef,
      };
    });
    assert(!stalled.booted && stalled.panel && stalled.alert, "a boot still running past the deadline shows the error panel", JSON.stringify(stalled));
    assert(stalled.reloadFocused, "the error panel takes keyboard focus on its Reload button", JSON.stringify(stalled));
    // The covered page is not reachable from the panel: Tab and Shift+Tab stay on its Reload.
    await page.keyboard.press("Tab");
    const tabFocus = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName || null);
    await page.keyboard.press("Shift+Tab");
    const shiftTabFocus = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName || null);
    const covered = await page.evaluate(() => ({ mainInert: document.querySelector("main")?.inert === true }));
    assert(tabFocus === "bootReload" && shiftTabFocus === "bootReload" && covered.mainInert,
      `while the error panel owns the screen, Tab and Shift+Tab stay on its Reload and the page is inert (focus: ${tabFocus}, ${shiftTabFocus})`,
      JSON.stringify({ tabFocus, shiftTabFocus, ...covered }));
    releaseCatalog();
    await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
    const after = await page.evaluate(() => {
      const box = document.getElementById("todaySession")?.getBoundingClientRect();
      const hit = box && box.width > 0 ? document.elementFromPoint(box.left + box.width / 2, box.top + Math.min(box.height / 2, 60)) : null;
      return {
        splash: !!document.getElementById("bootSplash"),
        failed: document.documentElement.classList.contains("is-boot-failed"),
        reachable: !document.getElementById("bootSplash") && !!hit?.closest("#todaySession"),
        focusOnRemovedReload: document.activeElement === window.__reloadRef,
      };
    });
    assert(!after.splash && !after.failed, "a boot that finishes after the deadline lifts the error panel", JSON.stringify(after));
    assert(after.reachable, "after the late boot the app is reachable under the pointer", JSON.stringify(after));
    assert(!after.focusOnRemovedReload, "focus is not left on the removed Reload button", JSON.stringify(after));
    await context.close();
  }

  console.log("\nCatalog retry: the stall deadline passes after the retry has closed its dialog");
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    // The deadline is held until the recovery dialog is up, so the first tick sees it open.
    await context.addInitScript(() => { window.__holdBootDeadline = true; });
    await context.addInitScript(shortenBootStall);
    await context.addInitScript(holdIndexedDbOpens);
    const page = await context.newPage();
    let catalogRequests = 0;
    await page.route(/assets\/exercise-catalog\.json/u, (route) => {
      catalogRequests += 1;
      return catalogRequests === 1 ? route.fulfill({ status: 503, body: "" }) : route.continue();
    });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#exerciseCatalogRecovery[open]", { timeout: 20000 });
    await page.evaluate(() => { window.__holdBootDeadline = false; window.__holdIdb = true; });
    await page.click("#retryExerciseCatalog");
    await page.waitForFunction(() => document.documentElement.classList.contains("is-boot-failed"), undefined, { timeout: 10000 });
    const retried = await page.evaluate(() => ({
      dialogOpen: document.getElementById("exerciseCatalogRecovery").open,
      booted: window.__repforgeBooted === true,
      splash: !!document.getElementById("bootSplash"),
    }));
    assert(!retried.dialogOpen && !retried.booted && retried.splash, "after a successful catalog retry, a boot still running past the deadline shows the error panel", JSON.stringify(retried));
    await page.evaluate(() => window.__releaseIdb());
    await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
    const after = await page.evaluate(() => ({
      splash: !!document.getElementById("bootSplash"),
      failed: document.documentElement.classList.contains("is-boot-failed"),
    }));
    assert(!after.splash && !after.failed, "the retried boot that finishes lifts the error panel", JSON.stringify(after));
    await context.close();
  }

  console.log("\nA catalog failure after the stall panel: its recovery dialog is usable, and Retry completes the boot");
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    await context.addInitScript(shortenBootStall);
    const page = await context.newPage();
    let catalogCalls = 0;
    let reachedCatalog;
    const catalogReached = new Promise((resolve) => { reachedCatalog = resolve; });
    let failCatalog;
    const catalogFails = new Promise((resolve) => { failCatalog = resolve; });
    await page.route(/assets\/exercise-catalog\.json/u, async (route) => {
      catalogCalls += 1;
      if (catalogCalls > 1) return route.continue();
      reachedCatalog();
      await catalogFails;
      return route.fulfill({ status: 503, body: "" });
    });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await reachedWithin(catalogReached, "the first catalog request");
    await page.waitForFunction(() => document.documentElement.classList.contains("is-boot-failed"), undefined, { timeout: 10000 });
    failCatalog();
    await page.waitForSelector("#exerciseCatalogRecovery[open]", { timeout: 15000 });
    const recovery = await page.evaluate(() => {
      const retry = document.getElementById("retryExerciseCatalog");
      const box = retry.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return { dialogInert: document.getElementById("exerciseCatalogRecovery").inert, hitRetry: !!hit?.closest("#retryExerciseCatalog") };
    });
    assert(!recovery.dialogInert && recovery.hitRetry, "a catalog failure after the stall panel leaves its Retry usable under the pointer", JSON.stringify(recovery));
    let clicked = false;
    try { await page.click("#retryExerciseCatalog", { timeout: 4000 }); clicked = true; } catch {}
    assert(clicked, "a real click on the catalog Retry reaches its handler");
    await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 }).catch(() => {});
    const after = await page.evaluate(() => ({
      booted: window.__repforgeBooted === true,
      dialogOpen: document.getElementById("exerciseCatalogRecovery").open,
      splash: !!document.getElementById("bootSplash"),
      failed: document.documentElement.classList.contains("is-boot-failed"),
      mainInert: document.querySelector("main")?.inert === true,
    }));
    assert(after.booted && !after.dialogOpen && !after.splash && !after.failed && !after.mainInert,
      "after Retry the boot completes, the panel is gone, and the page is interactive again", JSON.stringify(after));
    await context.close();
  }

  console.log("\nA storage recovery that opens after the stall panel: its Retry is usable, and boot completes");
  {
    const context = await activatedContext(browser, { serviceWorkers: "block" });
    const seed = await context.newPage();
    await seed.goto(BASE);
    await waitForAppBoot(seed, { base: BASE });
    const savedRaw = await seed.evaluate(() => localStorage.getItem("repforge_v1"));
    await seed.evaluate(() => localStorage.setItem("repforge_v1", "{not json"));
    await seed.close();
    // The first IndexedDB read is held, so the stall panel comes up before the replicas are judged.
    await context.addInitScript(shortenBootStall);
    await context.addInitScript(holdIndexedDbOpens);
    await context.addInitScript(() => { window.__holdIdb = true; });
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.classList.contains("is-boot-failed"), undefined, { timeout: 15000 });
    await page.evaluate(() => window.__releaseIdb());
    await page.waitForSelector("#storageRecovery[open]", { timeout: 20000 });
    const recovery = await page.evaluate(() => {
      const retry = document.getElementById("storageRetry");
      const box = retry.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return { dialogInert: document.getElementById("storageRecovery").inert, hitRetry: !!hit?.closest("#storageRetry") };
    });
    assert(!recovery.dialogInert && recovery.hitRetry, "a storage recovery that opens after the stall panel leaves its Retry usable under the pointer", JSON.stringify(recovery));
    await page.evaluate((raw) => localStorage.setItem("repforge_v1", raw), savedRaw);
    let clicked = false;
    try { await page.click("#storageRetry", { timeout: 4000 }); clicked = true; } catch {}
    assert(clicked, "a real click on the storage recovery Retry reaches its handler");
    await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 }).catch(() => {});
    const after = await page.evaluate(() => ({
      booted: window.__repforgeBooted === true,
      recoveryOpen: document.getElementById("storageRecovery")?.open === true,
      splash: !!document.getElementById("bootSplash"),
      failed: document.documentElement.classList.contains("is-boot-failed"),
      mainInert: document.querySelector("main")?.inert === true,
    }));
    assert(after.booted && !after.recoveryOpen && !after.splash && !after.failed && !after.mainInert,
      "after Retry the boot completes, the panel is gone, and the page is interactive again", JSON.stringify(after));
    await context.close();
  }

  console.log("\nA real boot error");
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(shortenBootStall);
    const page = await context.newPage();
    // Durable replica resolution throws inside boot (a fault at the module boundary, not a stall).
    await page.route(/durable-state\.js/u, async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      await route.fulfill({ response, contentType: "text/javascript",
        body: `${body}\n;window.RepForgeDurableState.resolveBootReplicas=async()=>{throw new Error("durable-state fault")};` });
    });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__repforgeBootFailureState === "boot-error", undefined, { timeout: 15000 });
    await page.waitForFunction(() => window.__bootDeadlinePasses >= 1, undefined, { timeout: 10000 });
    const failed = await page.evaluate(() => ({
      reason: window.__repforgeBootFailureState || null,
      failed: document.documentElement.classList.contains("is-boot-failed"),
      splash: !!document.getElementById("bootSplash"),
      panel: !!document.querySelector("#bootSplash .bootsplash__fail"),
      booted: window.__repforgeBooted === true,
    }));
    assert(failed.reason === "boot-error" && failed.failed && failed.splash && failed.panel && !failed.booted,
      "a boot that throws shows the error panel, and it is still there after the deadline", JSON.stringify(failed));
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exitCode = results.failed ? 1 : 0;
