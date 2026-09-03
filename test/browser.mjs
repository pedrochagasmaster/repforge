/**
 * One place that opens Chromium for the test scripts.
 *
 * CI runs `npx playwright install chromium`, so the bundled download is there
 * and this resolves to it. Sandboxes that ship a pre-installed browser under
 * PLAYWRIGHT_BROWSERS_PATH can point REPFORGE_CHROME at it instead of
 * re-downloading one.
 */
import { chromium } from "playwright";
import { existsSync } from "fs";

export function launchChromium(opts = {}) {
  const exe = process.env.REPFORGE_CHROME;
  return chromium.launch({
    headless: true,
    ...(exe && existsSync(exe) ? { executablePath: exe } : {}),
    ...opts,
  });
}

const servedAppCache = new Map();

/**
 * Fail in seconds — with the likely fix in the message — when REPFORGE_URL
 * is not serving this repository's app, instead of burning a browser-gate
 * timeout on an opaque waitForFunction. The classic failure is a stale
 * `python3 -m http.server` from another directory still holding the port
 * and answering every request with a 404 page.
 */
export async function assertServingApp(base = process.env.REPFORGE_URL || "http://localhost:8000/") {
  if (servedAppCache.has(base)) return servedAppCache.get(base);
  let result;
  try {
    const response = await fetch(base);
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

/**
 * Wait for the app to reach its interactive boot state, with a diagnosis on
 * failure. The storage test export is assigned while app.js is still
 * parsing; `__repforgeBooted` is set at the end of init(), after async replica
 * recovery, any first-run persistence and the first render, so it means the
 * whole pipeline finished. Day tabs used to stand in for it, which a device
 * with no onboarded program never grows.
 */
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
          url: location.href,
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
