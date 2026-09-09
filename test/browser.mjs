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
          dayTabButtons: document.querySelectorAll("#dayTabs button").length,
        }))
      );
    } catch {
      // keep the fallback text
    }
    throw new Error(`app did not finish booting within ${timeout}ms; observed ${observed}`);
  }
}
