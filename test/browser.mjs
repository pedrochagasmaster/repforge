/** Shared Chromium launcher. Normal runs do not record traces. */
import { chromium } from "playwright";
import { existsSync } from "fs";
import { instrumentBrowser } from "./browser-artifacts.mjs";

/**
 * A contextual guide is a modal dialog that holds the page inert until "Got it". Most suites are not about guides,
 * so by default every context starts as a device whose lifter has already read them: when the app brings its guide
 * records up to date, a guide it has never shown (a pristine `unseen` record) becomes `dismissed`. A guide a suite has moved
 * on purpose (shown, deferred, replayed, completed) is left alone, and Settings → Replay still shows any guide.
 *
 * Suites that prove guide behaviour, or that need a device as the app leaves it (a fresh install-transfer destination,
 * where a dismissed guide is the lifter's own state), keep the guides live: `launchChromium({ guides: "live" })` for
 * every context, or `browser.newContext({ guides: "live" })` for one (and `guides: "read"` the other way round).
 */
function readGuidesByDefault(browser, liveByDefault) {
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async ({ guides, ...options } = {}) => {
    const context = await newContext(options);
    if ((guides ?? (liveByDefault ? "live" : "read")) !== "live") {
      // Applied where the app brings its guide records up to date (at boot and on every transition), so the device's
      // storage is untouched until the app writes it, and a suite that writes its own preferences still meets read guides.
      await context.addInitScript(() => {
        let registry;
        Object.defineProperty(globalThis, "RepForgeGuideRegistry", {
          configurable: true,
          get: () => registry,
          set(value) {
            if (typeof value?.migrateLegacyTourDone !== "function") { registry = value; return; }
            const migrate = value.migrateLegacyTourDone;
            registry = Object.freeze({ ...value, migrateLegacyTourDone(prefs, options) {
              const next = migrate(prefs, options);
              const state = { ...next.guideState };
              let changed = false;
              for (const { id, version } of value.GUIDE_DEFINITIONS) {
                const record = state[id];
                if (record?.version !== version || record.status !== "unseen" || record.lastTransitionAt != null || record.replayedAt != null) continue;
                state[id] = { version, status: "dismissed", lastTransitionAt: null };
                changed = true;
              }
              return changed ? Object.freeze({ ...next, guideState: state }) : next;
            } });
          },
        });
      });
    }
    return context;
  };
  // Playwright's convenience newPage makes its own context; route it through the one above.
  browser.newPage = async (options = {}) => {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    page.on("close", () => context.close().catch(() => {}));
    return page;
  };
}

export async function launchChromium({ guides, ...opts } = {}) {
  const exe = process.env.REPFORGE_CHROME;
  const browser = await chromium.launch({
    headless: true,
    ...(exe && existsSync(exe) ? { executablePath: exe } : {}),
    ...opts,
  });
  readGuidesByDefault(browser, guides === "live");
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
  priorities = {}, deload = true, abilities = null, skipBasics = false, until = null, split = null,
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
    // The split step (only when the day count offers a choice): the recommended one stays unless one is named.
    else if (current === "split") { if (split) await pick("splitPreference", split); await next(); }
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

/**
 * A contextual guide is a modal dialog: until the lifter taps "Got it", the page under it is inert. A suite that is
 * not about guides drives the app as a lifter who has read the tip, so the guide is dismissed the moment it stands in
 * the way of the suite's next action. Guide behaviour itself is proved in test/guide-modal.mjs.
 */
export async function dismissGuidesInTheWay(page) {
  await page.addLocatorHandler(page.locator("dialog#guideDialog[open]"), () => page.locator("#guideDialogOk").click());
}

/**
 * A click on a Focus shelf field, aimed at whatever the field does next. Load and
 * Reps are often already the shelf's default-selected field (Plan 075 phase 2W,
 * ADR 0023 choice 8), so a single tap on one of them can already be the second
 * tap that opens the wheel, not a typed input. `openModal` unhides `#wheelSheet`
 * synchronously inside the click handler, so the check right after the click
 * needs no wait: if the wheel opened, its keyboard button hands off to the same
 * typed entry a direct second tap gives RIR, and the caller sees that input the
 * same way either way. A field that only selects (pads next, not typing) or RIR
 * itself never opens the wheel, so this is a no-op click for them. During a rest
 * the shelf shows the rest pads, and a tap on the selected Load or Reps only brings
 * the field back; a field that was already selected and opened nothing takes the
 * second tap, as the lifter would.
 */
export async function openShelfField(page, locatorOrSelector) {
  const locator = typeof locatorOrSelector === "string" ? page.locator(locatorOrSelector) : locatorOrSelector;
  const wheelOpen = () => page.evaluate(() => {
    const sheet = document.querySelector("#wheelSheet");
    return !!sheet && !sheet.hidden;
  });
  const selected = (el) => el.matches("[aria-pressed='true']") || !!el.closest(".shelf__field")?.classList.contains("is-sel");
  const wasSelected = await locator.evaluate(selected);
  await locator.click();
  // During a rest the first tap on the selected Load or Reps only brings the field back; the next opens the wheel.
  const restored = wasSelected && await locator.evaluate((el) => {
    const id = el.closest("[data-shelf-field]")?.dataset.shelfField || "";
    return (id === "load" || id === "reps" || id.startsWith("metric_")) && !el.closest(".shelf__field")?.classList.contains("is-editing")
      && !document.activeElement?.matches?.(".shelf__input");
  });
  if (restored && !(await wheelOpen())) await locator.click();
  if (!(await wheelOpen())) return;
  await page.click("#wheelKeyboard");
  await page.waitForSelector("#wheelSheet", { state: "hidden" });
}
