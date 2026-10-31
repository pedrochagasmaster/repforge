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
    const log = d.getElementById("log");
    const session = d.getElementById("todaySession");
    const shell = d.getElementById("workoutShell");
    frames.push({
      t: Math.round(performance.now() - start),
      body: !!d.body,
      covering,
      splash: !!splash,
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
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exitCode = results.failed ? 1 : 0;
