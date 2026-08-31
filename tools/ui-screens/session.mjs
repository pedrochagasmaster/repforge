/**
 * Browser session helpers shared by every capture scenario.
 *
 * Each capture gets its own isolated context with service workers blocked, so
 * a previously installed shell can never serve stale application code into
 * the evidence. Date is pinned because several surfaces render "3 days ago".
 */
import { launchChromium } from "../../test/browser.mjs";

export const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
export const KEY = "repforge_v1";
export const UI_KEY = "repforge_ui_v1";
export const LOG_DRAFT = "repforge_draft_v1";
export const SETUP_DRAFT = "repforge_program_setup_draft_v1";
// Resume renders a draft's updatedAt as a calendar date, and Today derives the
// scheduled day from the clock. Pin both so the catalog is reproducible.
export const CAPTURE_NOW = process.env.CAPTURE_NOW || "2026-08-31T12:00:00.000Z";

export { launchChromium };

export const sleep = (page, ms = 300) => page.waitForTimeout(ms);

export function waitForApp(page) {
  return page.waitForFunction(
    () => typeof window.__repforgeStorage?.flush === "function"
      && typeof window.__repforgeUi?.setTheme === "function",
    undefined,
    { timeout: 20000 }
  );
}

export async function seed(page, state) {
  await page.evaluate(async ({ key, logDraft, setupDraft, uiKey, blob }) => {
    localStorage.removeItem(logDraft);
    localStorage.removeItem(setupDraft);
    localStorage.removeItem(uiKey);
    await new Promise((done) => {
      const request = indexedDB.deleteDatabase("repforge");
      request.onsuccess = done;
      request.onerror = done;
      request.onblocked = done;
    });
    localStorage.setItem(key, JSON.stringify(blob));
    await new Promise((done, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(blob, key);
        tx.oncomplete = () => { db.close(); done(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  }, { key: KEY, logDraft: LOG_DRAFT, setupDraft: SETUP_DRAFT, uiKey: UI_KEY, blob: state });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
}

export async function openPage(browser, manifest, capture, state, options = {}) {
  const viewport = manifest.viewports[capture.viewport];
  const locale = manifest.locales[capture.locale];
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: manifest.deviceScaleFactor,
    locale: locale.browserLocale,
    timezoneId: "UTC",
    colorScheme: capture.theme === "dark" ? "dark" : "light",
    reducedMotion: manifest.motion[capture.motion].prefersReducedMotion ? "reduce" : "no-preference",
    serviceWorkers: "block",
    ...(options.userAgent ? { userAgent: options.userAgent } : {}),
  });
  // A full run opens a couple of hundred contexts back to back. Playwright's
  // 30s default is comfortable for one capture and marginal for the last of
  // 200, so give every action real headroom rather than reading contention as
  // a broken scenario.
  context.setDefaultTimeout(45000);
  const page = await context.newPage();
  await page.addInitScript((fixedNow) => {
    const RealDate = Date;
    const fixedTime = RealDate.parse(fixedNow);
    class CaptureDate extends RealDate {
      constructor(...args) { super(...(args.length ? args : [fixedTime])); }
      static now() { return fixedTime; }
    }
    globalThis.Date = CaptureDate;
  }, CAPTURE_NOW);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await seed(page, state);
  await page.evaluate(({ theme, scale, uiKey }) => {
    localStorage.setItem(uiKey, JSON.stringify({ theme }));
    window.__repforgeUi.setTheme(theme);
    if (scale !== 1) document.documentElement.style.fontSize = `${scale * 100}%`;
  }, {
    theme: capture.theme,
    scale: manifest.textScales[capture.text].rootFontScale,
    uiKey: UI_KEY,
  });
  await sleep(page, 180);
  return { context, page };
}

/**
 * A catalog frame has to show a surface at rest. Entrances that are still
 * running paint half-opacity controls over the copy behind them, which a
 * designer reads as a colour decision rather than a frame taken early.
 * Looping animations (the rest bar's breathing ring) never finish and are
 * left alone. This deliberately does not reset scroll: several scenarios
 * (the Settings anchors, the Progress chart) scroll to their subject on
 * purpose, and resetting here would photograph the wrong part of the screen.
 */
export async function settle(page) {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (animation.effect?.getComputedTiming().iterations === Infinity) continue;
      try { animation.finish(); } catch {}
    }
  });
}

export async function dismissChrome(page) {
  await page.evaluate(() => {
    window.closeFirstRun?.();
    const onboarding = document.querySelector("#onboarding");
    if (onboarding?.classList.contains("active")) window.closeOnboarding?.();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden")) window.closeTour?.();
    document.querySelector(".installbanner")?.classList.add("hidden");
  });
}
