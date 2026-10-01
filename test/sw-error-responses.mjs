#!/usr/bin/env node
/**
 * Protocol fault injection for the service worker's runtime cache writes.
 * A switchable loopback server answers chosen paths with 404/503 (or HTML
 * served as code) after the current worker has installed its release cache.
 * Whatever the worker does next, an error response must never replace a good
 * cached copy, must never be stored when nothing was cached, and the page must
 * keep receiving the good copy. A later healthy response is still stored.
 * The failure space (network-side faults interleaved with the worker's own
 * fetch/cache sequence) is not reachable from the ordinary app journeys, which
 * always see a healthy origin.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, statSync, createReadStream } from "node:fs";
import { dirname, extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium } from "./browser.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const currentWorker = readFileSync(join(ROOT, "sw.js"), "utf8");
const CACHE = currentWorker.match(/const CACHE = ["']([^"']+)["']/)?.[1];
assert(CACHE, "sw.js declares a cache name");
const indexHtml = readFileSync(join(ROOT, "index.html"), "utf8");
const protectedApp = indexHtml.match(/<script src="(app\.js\?v=\d+)"/)?.[1];
assert(protectedApp, "index.html loads the protected app.js?v=N URL");

// pathname -> { status, type } while a fault is armed; empty means a healthy origin.
const faults = new Map();
const statSafe = (file) => { try { return statSync(file); } catch { return null; } };
const mimeType = (extension) => ({
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
  ".woff2": "font/woff2",
}[extension] || "application/octet-stream");
const server = createServer((request, response) => {
  const pathname = decodeURIComponent((request.url || "/").split("?", 1)[0]);
  // no-store keeps the browser HTTP cache from masking what the worker does.
  const headers = (type) => ({ "content-type": type, "cache-control": "no-store" });
  if (pathname === "/sw.js") {
    response.writeHead(200, headers("text/javascript"));
    response.end(currentWorker);
    return;
  }
  const fault = faults.get(pathname);
  if (fault) {
    response.writeHead(fault.status, headers(fault.type || "text/plain"));
    response.end(fault.type === "text/html" ? "<!doctype html><title>Fallback document</title>" : "fail");
    return;
  }
  if (pathname === "/__synthetic__/healthy.png") {
    response.writeHead(200, headers("image/png"));
    response.end("png-bytes");
    return;
  }
  const file = normalize(join(ROOT, pathname === "/" ? "index.html" : pathname.slice(1)));
  if (relative(ROOT, file).startsWith("..") || !statSafe(file)?.isFile()) {
    response.writeHead(404, headers("text/plain")); response.end("Not found"); return;
  }
  response.writeHead(200, headers(mimeType(extname(file))));
  createReadStream(file).pipe(response);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await launchChromium();
const context = await browser.newContext();
const page = await context.newPage();

/** What the controlled page receives for a fetch, plus what the cache then holds. */
const probe = (url) => page.evaluate(async ({ url, cacheName }) => {
  const response = await fetch(url);
  const text = await response.text();
  const cache = await caches.open(cacheName);
  const cached = await cache.match(new URL(url, location.href).href);
  return {
    status: response.status,
    type: (response.headers.get("content-type") || "").split(";", 1)[0],
    text,
    cached: cached ? { status: cached.status, type: (cached.headers.get("content-type") || "").split(";", 1)[0], text: await cached.text() } : null,
  };
}, { url, cacheName: CACHE });

/** Cache-only read: no network fetch, so a healthy response cannot repair what a fault damaged. */
const cachedEntry = (url) => page.evaluate(async ({ url, cacheName }) => {
  const cached = await (await caches.open(cacheName)).match(new URL(url, location.href).href);
  return cached ? { status: cached.status, type: (cached.headers.get("content-type") || "").split(";", 1)[0], text: await cached.text() } : null;
}, { url, cacheName: CACHE });

try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  // Activation (skipWaiting after the atomic precache, then claim) makes the
  // page controlled without a reload.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { timeout: 15000 });
  assert.equal(await page.evaluate((name) => caches.has(name), CACHE), true, `current cache ${CACHE} is installed`);

  // 1. Precached code assets (required, network-first): stylesheet and the
  //    protected app.js?v=N URL. Errors, and HTML served as code, leave the good
  //    copy in the cache and in the page's hands.
  const faultsToTry = [
    { label: "404", fault: { status: 404 } },
    { label: "503", fault: { status: 503 } },
    { label: "200 text/html", fault: { status: 200, type: "text/html" } },
  ];
  for (const asset of ["styles.css", protectedApp]) {
    const pathname = `/${asset.split("?", 1)[0]}`;
    const good = await probe(asset);
    assert.equal(good.status, 200, `${asset} healthy baseline is 200`);
    assert(good.cached && good.cached.status === 200 && good.cached.text.length > 100, `${asset} is precached`);
    for (const { label, fault } of faultsToTry) {
      faults.set(pathname, fault);
      const result = await probe(asset);
      faults.delete(pathname);
      assert.equal(result.status, 200, `${asset} network ${label} still serves the good cached copy to the page`);
      assert.equal(result.text, good.cached.text, `${asset} network ${label} serves the original bytes`);
      assert(result.cached && result.cached.status === 200 && result.cached.text === good.cached.text,
        `${asset} network ${label} leaves the cache entry untouched`);
    }
  }

  // 2. Shell branch: a non-code shell file (manifest) and the navigation document.
  const manifestGood = await cachedEntry("manifest.webmanifest");
  assert(manifestGood && manifestGood.status === 200, "manifest is precached");
  for (const status of [404, 503]) {
    faults.set("/manifest.webmanifest", { status });
    const result = await probe("manifest.webmanifest");
    faults.delete("/manifest.webmanifest");
    assert.equal(result.status, 200, `manifest network ${status} still serves the good cached copy`);
    assert.equal(result.text, manifestGood.text, `manifest network ${status} serves the original bytes`);
    assert(result.cached && result.cached.status === 200 && result.cached.text === manifestGood.text,
      `manifest network ${status} leaves the cache entry untouched`);
  }
  const documentGood = await cachedEntry(base);
  assert(documentGood && documentGood.status === 200 && documentGood.text.includes('id="dayTabs"'), "the entry document is precached");
  for (const status of [404, 503]) {
    faults.set("/", { status });
    const navigation = await page.goto(base, { waitUntil: "domcontentloaded" });
    faults.delete("/");
    assert.equal(navigation?.status(), 200, `navigation with network ${status} is answered with the cached document`);
    assert.equal(navigation?.fromServiceWorker(), true, `navigation with network ${status} is answered by the worker`);
    assert.equal(await page.locator("#dayTabs").count(), 1, `navigation with network ${status} renders the app shell`);
    const after = await cachedEntry(base);
    assert(after && after.status === 200 && after.text === documentGood.text, `navigation network ${status} leaves the cached document untouched`);
  }

  // 3. Catch-all (cache-first): an uncached asset that fails is not stored; a
  //    healthy one is, which proves the probe can see a store.
  for (const status of [404, 503]) {
    const path = `__synthetic__/missing-${status}.png`;
    faults.set(`/${path}`, { status });
    const result = await probe(path);
    faults.delete(`/${path}`);
    assert.equal(result.status, status, `uncached asset network ${status} reaches the page unchanged`);
    assert.equal(result.cached, null, `uncached asset network ${status} is not stored`);
  }
  assert.equal((await probe("does-not-exist.png")).cached, null, "a plain missing file is not stored");
  const healthy = await probe("__synthetic__/healthy.png");
  assert.equal(healthy.status, 200, "healthy uncached asset is served");
  assert.equal(healthy.cached?.status, 200, "healthy uncached asset is stored");

  // 4. Optional runtimes removed from the cache: immutable (cache-first) and
  //    plain optional. Failures are not stored and the page gets a 503 worker
  //    response, never the failure body as code; recovery stores the file again.
  for (const runtime of ["vendor/dnd-kit/dnd-kit.runtime.js", "vendor/dnd-kit/dnd-kit.js"]) {
    const pathname = `/${runtime}`;
    const href = new URL(runtime, base).href;
    const good = await cachedEntry(runtime);
    assert(good && good.status === 200, `${runtime} is precached`);
    const removed = await page.evaluate(async ({ cacheName, href }) => (await caches.open(cacheName)).delete(href), { cacheName: CACHE, href });
    assert.equal(removed, true, `${runtime} removed from the cache to simulate a missing entry`);
    for (const { label, fault } of faultsToTry) {
      faults.set(pathname, fault);
      const result = await probe(runtime);
      faults.delete(pathname);
      assert.equal(result.status, 503, `${runtime} network ${label} reaches the page as a worker 503`);
      assert(!/^text\/html\b/i.test(result.type), `${runtime} network ${label} is not handed to the page as a document`);
      assert.equal(result.cached, null, `${runtime} network ${label} is not stored`);
    }
    const recovered = await probe(runtime);
    assert.equal(recovered.status, 200, `${runtime} is served once the network recovers`);
    assert.equal(recovered.cached?.status, 200, `${runtime} is stored once the network recovers`);
    assert.equal(recovered.cached?.text, good.text, `${runtime} recovery stores the original bytes`);
  }

  console.log("sw error responses: code, shell and navigation keep their good copy; catch-all and optional runtimes never store non-ok");
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
