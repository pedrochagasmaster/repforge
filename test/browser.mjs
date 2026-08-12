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
