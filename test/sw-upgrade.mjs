#!/usr/bin/env node
/**
 * Install the released worker first, then serve the current worker from the
 * same URL and prove that the real update lifecycle removes the old cache.
 * The switchable server keeps this regression independent of an installed
 * worker in the developer's profile.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFileSync, statSync, createReadStream } from "node:fs";
import { dirname, extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Exact bytes from released starting-main e7b6d162 (the v120 worker). Keeping
// this fixture immutable makes the regression independent of shallow checkouts
// and mutable remote refs.
const oldWorker = readFileSync(join(ROOT, "test/fixtures/sw-v120.js"), "utf8");
assert.equal(createHash("sha256").update(oldWorker).digest("hex"), "02639be4f2c4ae0a25cc969eb2986c5fcf85d7f64f3018404737bf502b769a81", "v120 fixture provenance hash");
const currentWorker = readFileSync(join(ROOT, "sw.js"), "utf8");
const cacheName = (worker) => worker.match(/const CACHE = ["']([^"']+)["']/)?.[1];
const oldCache = cacheName(oldWorker);
const currentCache = cacheName(currentWorker);
assert(oldCache && currentCache && oldCache !== currentCache, `worker cache versions differ (${oldCache}, ${currentCache})`);

let mode = "old";
const statSafe = (file) => { try { return statSync(file); } catch { return null; } };
const mimeType = (extension) => ({
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
  ".woff2": "font/woff2",
}[extension] || "application/octet-stream");
const server = createServer((request, response) => {
  const pathname = decodeURIComponent((request.url || "/").split("?", 1)[0]);
  if (pathname === "/sw.js") {
    response.writeHead(200, { "content-type": "text/javascript", "cache-control": "no-store" });
    response.end(mode === "old" ? oldWorker : currentWorker);
    return;
  }
  const file = normalize(join(ROOT, pathname === "/" ? "index.html" : pathname.slice(1)));
  if (relative(ROOT, file).startsWith("..") || !statSafe(file)?.isFile()) {
    response.writeHead(404); response.end("Not found"); return;
  }
  response.writeHead(200, { "content-type": mimeType(extname(file)) });
  createReadStream(file).pipe(response);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const base = `http://127.0.0.1:${address.port}/`;
const browser = await launchChromium();
const context = await browser.newContext();
const page = await context.newPage();
try {
  await page.goto(base);
  await waitForAppBoot(page, { base });
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await page.waitForFunction((cache) => caches.has(cache), oldCache, { timeout: 10000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 10000 });
  assert.equal(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL.endsWith("/sw.js")), true, "released worker controls the first launch");
  assert.equal(await page.evaluate((cache) => caches.has(cache), oldCache), true, `released cache ${oldCache} is installed`);

  mode = "current";
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await page.waitForFunction((cache) => caches.has(cache), currentCache, { timeout: 20000 });
  await page.waitForFunction(async ({ oldCache, currentCache }) => {
    const names = await caches.keys();
    return names.includes(currentCache) && !names.includes(oldCache);
  }, { oldCache, currentCache }, { timeout: 20000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base });
  assert.equal(await page.locator("#dayTabs").count(), 1, "updated worker boots the entry shell");
  assert.equal(await page.evaluate(() => !!window.RepForgeProgramEntry), true, "updated shell includes program entry code");
  console.log(`service-worker upgrade: ${oldCache} controls first, ${currentCache} activates, old cache is deleted, entry shell boots`);
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
