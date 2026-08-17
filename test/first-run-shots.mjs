#!/usr/bin/env node
/**
 * First-run layout proof at the review viewports.
 *
 * Writes the four PR screenshots and a compact geometry report. Run with the
 * repository served over HTTP and REPFORGE_URL pointing at that server.
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
    const poem = document.querySelector(".firstrun-hero__body");
    return {
      poemHeight: box(".firstrun-hero__body").height,
      poemSize: parseFloat(getComputedStyle(poem).fontSize),
      pictureWidth: box(".firstrun-hero__art").width,
      heroBottom: box(".firstrun-hero").bottom,
      introductionTop: box(".firstrun__lede").top,
      firstControlTop: box("#firstRunInstallAction").top,
    };
  });
  await page.screenshot({ path: join(OUT, `first-run-${width}x${height}.png`) });
  await context.close();
}

await browser.close();
writeFileSync(join(OUT, "measurements.json"), `${JSON.stringify(measurements, null, 2)}\n`);
console.log(JSON.stringify(measurements, null, 2));
