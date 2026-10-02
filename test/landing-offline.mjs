#!/usr/bin/env node
/**
 * STD-2: the landing is the boot surface until onboarding, so every image it
 * can show must be in the installed shell. Its proof scenes and its two
 * real-app shots load lazily and follow the language (and, for the shots, the
 * theme), so a first launch that goes offline before scrolling would otherwise
 * find them missing. This installs the real worker, goes offline without
 * visiting the lower bands, and fetches every image the landing's own markup
 * can ask for, in both languages and both themes.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, statSync, createReadStream } from "node:fs";
import { dirname, extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const currentCache = readFileSync(join(ROOT, "sw.js"), "utf8").match(/const CACHE = ["']([^"']+)["']/)?.[1];
assert(currentCache, "the worker names its cache");

const statSafe = (file) => { try { return statSync(file); } catch { return null; } };
const mimeType = (extension) => ({
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
}[extension] || "application/octet-stream");
const server = createServer((request, response) => {
  const pathname = decodeURIComponent((request.url || "/").split("?", 1)[0]);
  const file = normalize(join(ROOT, pathname === "/" ? "index.html" : pathname.slice(1)));
  if (relative(ROOT, file).startsWith("..") || !statSafe(file)?.isFile()) {
    response.writeHead(404); response.end("Not found"); return;
  }
  response.writeHead(200, { "content-type": mimeType(extname(file)), "cache-control": "no-store" });
  createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await launchChromium();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
let failures = 0;
try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base });
  await page.waitForFunction((cache) => caches.has(cache), currentCache, { timeout: 20000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 10000 });
  await waitForAppBoot(page, { base });
  assert.equal(await page.evaluate(() => !document.querySelector("#firstRun")?.classList.contains("hidden")), true,
    "a fresh device boots into the landing");

  // Every image the landing's markup can request, read from that markup.
  const wanted = await page.evaluate(() => {
    const out = new Set(["assets/brand/mark.png"]);
    const scenes = new Set([...document.querySelectorAll("#firstRun [data-landing-step][data-scene]")].map((el) => el.dataset.scene));
    const shots = new Set([...document.querySelectorAll("#firstRun [data-shot]")].map((el) => el.dataset.shot));
    for (const lang of ["en", "pt"]) {
      for (const scene of scenes) out.add(`assets/brand/wt-${scene}-${lang}-dark.webp`);
      for (const shot of shots) for (const theme of ["light", "dark"]) out.add(`assets/brand/${shot}-${lang}-${theme}.webp`);
    }
    return { urls: [...out], scenes: [...scenes], shots: [...shots] };
  });
  assert(wanted.scenes.length >= 4 && wanted.shots.length >= 2, `the landing names its scenes and shots: ${JSON.stringify(wanted)}`);

  await context.setOffline(true);
  const results = await page.evaluate(async (urls) => {
    const out = [];
    for (const url of urls) {
      try {
        const response = await fetch(url);
        const blob = response.ok ? await response.blob() : null;
        out.push({ url, ok: response.ok, type: blob?.type || "", size: blob?.size || 0 });
      } catch (error) {
        out.push({ url, ok: false, error: String(error) });
      }
    }
    return out;
  }, wanted.urls);
  for (const result of results) {
    const good = result.ok && result.size > 0 && /^image\//.test(result.type);
    if (!good) failures += 1;
    console.log(`  ${good ? "✓" : "✗"} STD-2: ${result.url} is served offline by the installed worker${good ? "" : ` (${JSON.stringify(result)})`}`);
  }
} finally {
  await context.close();
  await browser.close();
  server.close();
}
console.log(`Landing offline images: ${failures === 0 ? "all" : `${failures} missing of the`} landing images served offline`);
if (failures) process.exit(1);
