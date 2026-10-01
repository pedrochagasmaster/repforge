#!/usr/bin/env node
/**
 * First-run layout proof at the review viewports.
 *
 * Writes one screenshot of the hero per viewport and a compact geometry report of
 * the final page (Plan 064 R2): where the headline, the subtitle, both entry
 * actions and the start of the proof sit on the first screen. Run with the
 * repository served over HTTP and REPFORGE_URL pointing at that server. Canonical
 * evidence of every band is the catalog (tools/capture-ui-screens.mjs); this
 * is the manual tool for looking at a new viewport.
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { launchChromium } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "pr-proof");
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const VIEWPORTS = [
  [320, 844],
  [390, 844],
  [430, 932],
  [768, 1024],
];

mkdirSync(OUT, { recursive: true });
const browser = await launchChromium();
const measurements = {};

for (const [width, height] of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    userAgent: IOS_UA,
    locale: "en-US",
    hasTouch: true,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  // This first load is itself a first run: it renders the landing and then
  // records `entryLandingSeen`. Clearing before that write lands lets it
  // re-persist afterwards, and the reload boots past the gate into Today.
  // Wait for the write, the way the other fresh-device fixtures do.
  await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 15000 });
  await page.waitForFunction(
    () => (localStorage.getItem("repforge_ui_v1") || "").includes('"entryLandingSeen":true'),
    null,
    { timeout: 15000 }
  );
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase("repforge");
      request.onsuccess = request.onerror = request.onblocked = resolve;
    });
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);

  measurements[`${width}x${height}`] = await page.evaluate(() => {
    const box = (selector) => document.querySelector(selector).getBoundingClientRect();
    return {
      headlineHeight: box("#firstRunHeadline").height,
      headlineSize: parseFloat(getComputedStyle(document.querySelector("#firstRunHeadline")).fontSize),
      heroBottom: box('[data-landing-section="hero"]').bottom,
      introductionTop: box("#firstRunLede").top,
      firstControlTop: box("#firstRunCreate").top,
      trackBottom: box("#firstRunImport").bottom,
      proofTop: box('[data-landing-section="proof"]').top,
      pinned: window.__repforgeLandingProof?.().pinned ?? null,
    };
  });
  await page.screenshot({ path: join(OUT, `first-run-${width}x${height}.png`) });
  await context.close();
}

await browser.close();
writeFileSync(join(OUT, "measurements.json"), `${JSON.stringify(measurements, null, 2)}\n`);
console.log(JSON.stringify(measurements, null, 2));
