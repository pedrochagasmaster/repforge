#!/usr/bin/env node
/* Renders assets/brand/mark.png: the Taurifer yoke with no paper under it.

   Why this exists: `icons/icon.svg` paints its own warm ground (#EFE5DF) as a
   single full-bleed rect, which is right for an app icon and wrong inside the
   app — on the first-run gate's paper (#F4F2EF) that ground reads as a plate
   around the mark. The gate wants the mark on the page, so it needs the same
   art with the ground dropped. CSS cannot reach inside an <img>, and the
   exercise-detail trick (bleed the artwork's own paper colour and fade it out)
   only dissolves a square by drawing a much larger field of it — a 120px warm
   halo behind a 48px logo. So the ground comes off in the render instead.

   This is a derivation, not a new mark: it removes exactly one path (the
   full-bleed rect) and rasterises everything else at 4x the 48px the gate
   draws. icon.svg stays the source of truth; when a new mark lands, re-run
   this. Like every other brand file, the output is replaced wholesale and
   never hand-edited.

   Node ships no SVG rasteriser and Taurifer has no application dependencies,
   so this borrows the Chromium the browser suites already pin:

     (cd test && npm ci && npx playwright install chromium)
     node tools/build-brand-mark.mjs

   A maintenance script, not part of any build. */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "icons", "icon.svg");
const TARGET = join(ROOT, "assets", "brand", "mark.png");
const SIZE = 192; // 48 CSS px at 4x, the densest phone the gate meets
const GROUND = "#EFE5DF"; // the fill of the rect this drops

let chromium;
try {
  ({ chromium } = await import(pathToFileURL(join(ROOT, "test", "node_modules", "playwright", "index.mjs")).href));
} catch {
  console.error("Chromium is missing. Install the browser suites' dependencies first:");
  console.error("  (cd test && npm ci && npx playwright install chromium)");
  process.exit(2);
}

const svg = readFileSync(SOURCE, "utf8");
const grounds = svg.match(/fill="#EFE5DF"/gi) || [];
if (grounds.length !== 1) {
  console.error(`Expected exactly one ${GROUND} ground path in icons/icon.svg, found ${grounds.length}.`);
  console.error("The mark changed shape — check what the new art paints before trusting this script.");
  process.exit(1);
}

const browser = await chromium.launch({
  headless: true,
  ...(process.env.REPFORGE_CHROME && existsSync(process.env.REPFORGE_CHROME)
    ? { executablePath: process.env.REPFORGE_CHROME }
    : {}),
});
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
await page.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
await page.evaluate((size) => {
  const svgEl = document.querySelector("svg");
  svgEl.setAttribute("width", String(size));
  svgEl.setAttribute("height", String(size));
  svgEl.style.display = "block";
  // The ground is the first path: a full-bleed rect over the whole view box.
  svgEl.querySelector("path")?.remove();
}, SIZE);
const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: SIZE, height: SIZE } });
await browser.close();

writeFileSync(TARGET, png);
console.log(`assets/brand/mark.png — ${SIZE}x${SIZE}, ${(png.length / 1024).toFixed(1)} kB`);
