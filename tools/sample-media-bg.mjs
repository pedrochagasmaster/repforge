#!/usr/bin/env node
/* Samples the paper colour each licensed illustration is drawn on, and writes
   tools/exercise-media-bg.json for build-exercises.mjs to emit as `mediaBg`.

   Why this exists: the exercise detail page lays its illustration on a warm
   field that has to dissolve into the page background. The shipped artwork does
   not share one paper colour — across the 96 files it ranges from #E3D4BE to
   #F4EDE1 — so a single hard-coded field colour draws a visible square around
   most of the library. The field colour therefore travels with the movement.

   Why it is a separate script: the illustrations are lossy VP8, Node ships no
   image decoder, and Taurifer has no application dependencies. So this borrows
   the Chromium that the browser suites already pin, which means it needs the
   test dependencies installed:

     (cd test && npm ci && npx playwright install chromium)
     node tools/sample-media-bg.mjs

   The artwork set is closed and committed, so this is a maintenance script, not
   part of any build. Its output is reviewable and may be hand-corrected: the
   build reads the file, it never re-derives it.

   Usage:
     node tools/sample-media-bg.mjs            # rewrite the JSON
     node tools/sample-media-bg.mjs --check    # fail if the JSON has drifted */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const MEDIA_DIR = join(ROOT, "assets", "exercises");
const OUT = join(HERE, "exercise-media-bg.json");
const CHECK = process.argv.includes("--check");

/* A ring this wide is empty paper in every shipped illustration; the figure is
   always inset. Sampling a band rather than a corner keeps one stray dark pixel
   from deciding the colour, and the median then ignores the paper's grain. */
const RING = 6;
/* Above this many levels of spread the ring is not plain paper any more — the
   figure has reached the edge — and the median stops being meaningful. */
const RING_SPREAD_LIMIT = 24;

let launchChromium;
try {
  ({ launchChromium } = await import("../test/browser.mjs"));
} catch (err) {
  console.error("Cannot load Playwright. Install the test dependencies first:");
  console.error("  (cd test && npm ci && npx playwright install chromium)");
  console.error(String(err?.message || err));
  process.exit(2);
}

const files = readdirSync(MEDIA_DIR).filter(f => f.endsWith(".webp")).sort();
if (!files.length) {
  console.error(`no .webp files in ${MEDIA_DIR}`);
  process.exit(1);
}

const browser = await launchChromium();
const page = await browser.newPage();
const sampled = {};
const noisy = [];

for (const file of files) {
  const id = file.replace(/\.webp$/, "");
  const data = `data:image/webp;base64,${readFileSync(join(MEDIA_DIR, file)).toString("base64")}`;
  const result = await page.evaluate(
    ({ data, ring }) =>
      new Promise((res, rej) => {
        const img = new Image();
        img.onerror = () => rej(new Error("decode failed"));
        img.onload = () => {
          const w = img.naturalWidth, h = img.naturalHeight;
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);
          const px = [[], [], []];
          const take = (x, y) => {
            const d = ctx.getImageData(x, y, 1, 1).data;
            px[0].push(d[0]);
            px[1].push(d[1]);
            px[2].push(d[2]);
          };
          for (let x = 0; x < w; x += 2)
            for (let k = 0; k < ring; k++) { take(x, k); take(x, h - 1 - k); }
          for (let y = 0; y < h; y += 2)
            for (let k = 0; k < ring; k++) { take(k, y); take(w - 1 - k, y); }
          const at = (a, q) => a[Math.min(a.length - 1, Math.floor(a.length * q))];
          const chan = px.map(a => a.sort((m, n) => m - n));
          res({
            size: [w, h],
            median: chan.map(a => at(a, 0.5)),
            // The middle 90% ignores the odd antialiased pixel while still
            // catching a figure that genuinely runs into the edge.
            spread: Math.max(...chan.map(a => at(a, 0.95) - at(a, 0.05)))
          });
        };
        img.src = data;
      }),
    { data, ring: RING }
  );
  if (result.size[0] !== result.size[1])
    console.warn(`  ! ${id} is ${result.size.join("×")}, not square`);
  if (result.spread > RING_SPREAD_LIMIT) noisy.push(`${id} (spread ${result.spread})`);
  sampled[id] = "#" + result.median.map(v => v.toString(16).padStart(2, "0")).join("");
}

await browser.close();

const body = JSON.stringify(sampled, Object.keys(sampled).sort(), 2) + "\n";

if (CHECK) {
  const current = readFileSync(OUT, "utf8");
  if (current !== body) {
    console.error(`${OUT} has drifted from the artwork — run: node tools/sample-media-bg.mjs`);
    process.exit(1);
  }
  console.log(`exercise-media-bg.json matches the artwork (${files.length} illustrations)`);
  process.exit(0);
}

writeFileSync(OUT, body);
console.log(`exercise-media-bg.json — ${files.length} illustrations`);
if (noisy.length) {
  console.log(`\n${noisy.length} whose border ring is not plain paper — review these values by eye:`);
  for (const n of noisy) console.log("  " + n);
}
