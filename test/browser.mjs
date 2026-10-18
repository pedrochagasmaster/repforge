/** Shared Chromium launcher. Normal runs do not record traces. */
import { chromium } from "playwright";
import { existsSync } from "fs";
import { instrumentBrowser } from "./browser-artifacts.mjs";

export async function launchChromium(opts = {}) {
  const exe = process.env.REPFORGE_CHROME;
  const browser = await chromium.launch({
    headless: true,
    ...(exe && existsSync(exe) ? { executablePath: exe } : {}),
    ...opts,
  });
  if (process.env.REPFORGE_TRACE === "1" && process.env.REPFORGE_ARTIFACT_DIR) {
    instrumentBrowser(browser, process.env.REPFORGE_ARTIFACT_DIR);
  }
  return browser;
}

const servedAppCache = new Map();

/** Fail quickly when the URL is unreachable or a stale server serves another app. */
export async function assertServingApp(base = process.env.REPFORGE_URL || "http://localhost:8000/") {
  if (servedAppCache.has(base)) {
    const cached = servedAppCache.get(base);
    if (cached instanceof Error) throw cached;
    return;
  }
  let result;
  try {
    const response = await fetch(base, { signal: AbortSignal.timeout(5000) });
    const html = await response.text();
    if (!response.ok) {
      result = new Error(
        `REPFORGE_URL (${base}) answered HTTP ${response.status}. Browser gates need a static server rooted at this repo. ` +
          `Check for a stale server holding the port (kill it), then run: python3 -m http.server 8000`
      );
    } else if (!html.includes('id="dayTabs"')) {
      result = new Error(
        `REPFORGE_URL (${base}) served HTML without the app shell (#dayTabs missing). ` +
          `Something other than this repository is answering on that port. ` +
          `Kill the stale server, then run: python3 -m http.server 8000`
      );
    }
  } catch (error) {
    result = new Error(
      `REPFORGE_URL (${base}) is not reachable (${error.message}). Start a static server in the repo root: python3 -m http.server 8000`
    );
  }
  servedAppCache.set(base, result);
  if (result instanceof Error) throw result;
}

/** Wait for interactive boot, not day tabs (an un-onboarded device has none). */
export async function waitForAppBoot(page, { timeout = 15000, base } = {}) {
  await assertServingApp(base);
  try {
    await page.waitForFunction(
      () =>
        document.readyState === "complete" &&
        typeof window.__repforgeStorage?.flush === "function" &&
        window.__repforgeBooted === true,
      undefined,
      { timeout }
    );
  } catch (error) {
    let observed = "page unreachable";
    try {
      observed = JSON.stringify(
        await page.evaluate(() => ({
          url: location.origin + location.pathname,
          readyState: document.readyState,
          storageHook: typeof window.__repforgeStorage?.flush === "function",
          booted: window.__repforgeBooted === true,
          releaseState: ["started", "update-required", "missing-release-identity", "load-failed"].includes(window.__repforgeReleaseState)
            ? window.__repforgeReleaseState : null,
          releaseRecoveryVisible: !!document.querySelector("#releaseRecovery"),
          catalogUnavailable: typeof window.__repforgeCatalogUnavailable === "string",
          bootFailureCode: /^[a-z][a-z0-9-]{0,79}$/.test(window.__repforgeBootFailure?.code || "")
            ? window.__repforgeBootFailure.code : null,
          dayTabButtons: document.querySelectorAll("#dayTabs button").length,
        }))
      );
    } catch {
      // keep the fallback text
    }
    throw new Error(`app did not finish booting within ${timeout}ms; observed ${observed}`);
  }
}

/**
 * Poll an in-page condition that needs `await` (Cache Storage, Web Locks,
 * IndexedDB, a service-worker registration). page.waitForFunction cannot wait
 * on these: it takes the promise an async predicate returns as a truthy result
 * and resolves on the first poll (#361). Every evaluation is bounded by the
 * same deadline, and a navigation between polls is waited out.
 */
export async function waitForAsyncCondition(target, predicate, arg, { timeout = 30000, interval = 50 } = {}) {
  const deadline = Date.now() + timeout;
  const fail = () => new Error(`async condition not met within ${timeout}ms: ${String(predicate).slice(0, 160)}`);
  for (;;) {
    let timer;
    const bound = new Promise((_, reject) => { timer = setTimeout(() => reject(fail()), Math.max(0, deadline - Date.now())); });
    try {
      const result = await Promise.race([target.evaluate(predicate, arg), bound]);
      if (result) return result;
    } catch (error) {
      if (!/Execution context was destroyed|navigat/i.test(error.message)) throw error;
    } finally {
      clearTimeout(timer);
    }
    if (Date.now() >= deadline) throw fail();
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/**
 * A worker has taken over once it is the activated registration controlling the
 * page, no successor is installing or waiting, and `cache` exists while the
 * cache it replaced (when named) is gone.
 */
export function waitForWorkerTakeover(page, { cache, replaced = null, timeout = 30000 }) {
  return waitForAsyncCondition(page, async ({ cache, replaced }) => {
    const registration = await navigator.serviceWorker.getRegistration();
    const names = await caches.keys();
    return registration?.active?.state === "activated" && !registration.installing && !registration.waiting &&
      navigator.serviceWorker.controller === registration.active &&
      names.includes(cache) && !names.includes(replaced);
  }, { cache, replaced }, { timeout });
}

/** Onboarding B's Recommend route (Plan 072), from the open entry hub to the
 *  generated review. Every answer is optional except where the flow requires
 *  one; `skipBasics` skips every Basics screen that offers Skip. Callers that
 *  need a specific screen state stop with `until`. */
export async function answerRecommend(page, {
  sex = "female", birth = null, heightCm = null, weightSteps = 0, lifting = "6_to_24m", cardio = null,
  environment = "commercial_gym", equipment = [], goal = "muscle_growth", days = 4, minutes = 60,
  priorities = {}, deload = true, abilities = null, skipBasics = false, until = null,
} = {}) {
  const step = () => page.evaluate(() => window.__repforgeEntryState?.()?.step);
  // A B page push keeps the outgoing screen in the DOM, inert and hidden from
  // accessibility. Scope actions to the live page so a snapshot cannot make a
  // route look selectable or receive a click during the push.
  const livePage = () => page.locator("#onbBody > .entry-motion-page:not([aria-hidden='true'])");
  const pick = (key, value) => livePage().locator(`[data-entry-pick="${key}"][data-entry-val="${value}"]`).first().click();
  const settle = () => page.waitForFunction(() => !document.querySelector(
    "#onbBody .entry-motion-page.is-push-over, #onbBody .entry-motion-page.is-push-under, #onbBody .entry-motion-page.is-edge-swiping"));
  const next = async () => {
    await settle();
    const before = await step();
    await page.click("#onbNext");
    await page.waitForFunction((prev) => window.__repforgeEntryState?.()?.step !== prev, before, { timeout: 15000 });
  };
  const skip = async () => {
    await settle();
    const before = await step();
    await page.click("#onbSkip");
    await page.waitForFunction((prev) => window.__repforgeEntryState?.()?.step !== prev, before, { timeout: 15000 });
  };
  const recommendChoice = livePage().locator('[data-entry-hub="recommend"]');
  if (await recommendChoice.count()) {
    await recommendChoice.click();
    await next();
  }
  for (let guard = 0; guard < 24; guard++) {
    const current = await step();
    if (current === until || current === "result") return current;
    if (current === "intro") await next();
    else if (current === "sex") { if (skipBasics || !sex) await skip(); else { await pick("basicsSex", sex); await next(); } }
    else if (current === "birth_date") {
      if (skipBasics || !birth) await skip();
      else {
        for (const [id, index] of [["#entryWheelYear", birth.yearIndex], ["#entryWheelMonth", birth.monthIndex], ["#entryWheelDay", birth.dayIndex]]) {
          if (index == null) continue;
          await page.focus(id);
          await page.keyboard.press("Home");
          for (let i = 0; i < index; i++) await page.keyboard.press("ArrowDown");
        }
        await next();
      }
    } else if (current === "height") {
      if (skipBasics || heightCm == null) await skip();
      else { await page.focus("#entryWheelCm"); await page.keyboard.press("Home"); for (let i = 120; i < heightCm; i++) await page.keyboard.press("ArrowDown"); await next(); }
    } else if (current === "weight") {
      if (skipBasics || !weightSteps) await skip();
      else { await page.focus("#entryWeightRuler"); for (let i = 0; i < Math.abs(weightSteps); i++) await page.keyboard.press(weightSteps > 0 ? "ArrowRight" : "ArrowLeft"); await next(); }
    } else if (current === "background") { await pick("structuredExperience", lifting); await next(); }
    else if (current === "cardio_experience") { if (skipBasics || !cardio) await skip(); else { await pick("basicsCardio", cardio); await next(); } }
    else if (current === "environment") { await pick("environment", environment); await next(); }
    else if (current === "equipment") { for (const group of equipment) await pick("equipmentGroup", group); await next(); }
    else if (current === "desired_result") { await pick("desiredResult", goal); await next(); }
    else if (current === "days_per_week") { await pick("daysPerWeek", days); await next(); }
    else if (current === "session_length") { if (minutes !== 60) await pick("sessionMinutes", minutes); await next(); }
    else if (current === "muscle_priorities") {
      for (const [muscle, status] of Object.entries(priorities)) await pick("musclePriorityB", `${muscle}|${status}`);
      await next();
    } else if (current === "deload") {
      if (!deload) await page.click("#entryDeloadSwitch");
      await next();
    } else if (current === "abilities") {
      if (abilities === "skip") await skip();
      else {
        for (const [key, choice] of Object.entries(abilities || {})) await pick("competencyAnswer", `${key}|${choice}`);
        await next();
      }
    } else if (current === "building") {
      await page.waitForFunction(() => window.__repforgeEntryState?.()?.step !== "building", undefined, { timeout: 20000 });
    } else throw new Error(`answerRecommend: unexpected step ${current}`);
  }
  throw new Error("answerRecommend did not reach the result");
}
