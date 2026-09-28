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
let requiredCodeRequested = false;
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
  if (pathname === "/__sw-test__") {
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><title>Service worker contract test</title>");
    return;
  }
  if (mode === "required-html" && pathname === "/app.js") {
    requiredCodeRequested = true;
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><title>Fallback document</title>");
    return;
  }
  if (mode === "optional-html" && [
    "/vendor/motion/motion.js",
    "/vendor/dnd-kit/dnd-kit.js",
    "/vendor/dnd-kit/dnd-kit.runtime.js",
    "/posthog-config.js",
  ].includes(pathname)) {
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><title>Fallback document</title>");
    return;
  }
  const file = normalize(join(ROOT, pathname === "/" ? "index.html" : pathname.slice(1)));
  if (relative(ROOT, file).startsWith("..") || !statSafe(file)?.isFile()) {
    response.writeHead(404); response.end("Not found"); return;
  }
  response.writeHead(200, { "content-type": mimeType(extname(file)) });
  if (mode === "optional-html" && ["/", "/index.html"].includes(pathname)) {
    const html = readFileSync(file, "utf8").replace(
      '  <script src="posthog-init.js"></script>',
      '  <script src="posthog-config.js?v=sw-contract" data-optional-runtime="RepForgeTelemetry"></script>\n  <script src="posthog-init.js"></script>',
    );
    response.end(html);
    return;
  }
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

  const requiredContext = await browser.newContext();
  try {
    mode = "required-html";
    requiredCodeRequested = false;
    const requiredPage = await requiredContext.newPage();
    await requiredPage.goto(`${base}__sw-test__`);
    const requiredInstall = await requiredPage.evaluate(async () => {
      try {
        const registration = await navigator.serviceWorker.register("./sw.js");
        const worker = registration.installing;
        if (!worker) return { state: registration.active ? "active" : "no-installing-worker" };
        return await new Promise(resolve => {
          const finish = () => {
            if (worker.state === "redundant" || worker.state === "activated") resolve({ state: worker.state });
          };
          worker.addEventListener("statechange", finish);
          finish();
          setTimeout(() => resolve({ state: worker.state, timedOut: true }), 12000);
        });
      } catch (error) {
        return { state: "registration-rejected", message: String(error) };
      }
    });
    const requiredCachePresent = await requiredPage.evaluate(cache => caches.has(cache), currentCache);
    assert.equal(requiredCodeRequested, true, "required-code failure fixture was requested during install");
    assert.equal(requiredCachePresent, false, "required JavaScript served as HTML rejects install and removes its partial cache");
    assert.notEqual(requiredInstall.state, "activated", `required-code failure did not activate (${JSON.stringify(requiredInstall)})`);
  } finally {
    await requiredContext.close();
  }

  const optionalContext = await browser.newContext();
  try {
    mode = "optional-html";
    const optionalPage = await optionalContext.newPage();
    await optionalPage.goto(base, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(optionalPage, { base });
    await optionalPage.evaluate(() => navigator.serviceWorker.register("./sw.js"));
    await optionalPage.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 15000 });
    await optionalPage.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(optionalPage, { base });
    const optionalBoot = await optionalPage.evaluate(() => ({
      appBooted: window.__repforgeBooted === true,
      motionLayer: !!window.RepForgeMotion,
      dndRuntime: !!window.RepForgeDndRuntime,
      telemetryBoundary: !!window.RepForgeTelemetry?.boot,
    }));
    assert.equal(optionalBoot.appBooted, true, "app cold-boots with unavailable optional runtimes and analytics config");
    assert.equal(optionalBoot.motionLayer, true, "Motion's guarded integration layer remains available");
    assert.equal(optionalBoot.dndRuntime, false, "unavailable dnd runtime leaves the editor's local Move controls as fallback");
    assert.equal(optionalBoot.telemetryBoundary, true, "telemetry boundary remains available without generated config");
    const optionalResponses = await optionalPage.evaluate(async () => Promise.all([
      "/vendor/motion/motion.js",
      "/vendor/dnd-kit/dnd-kit.js",
      "/posthog-config.js?v=sw-contract",
    ].map(async path => {
      const response = await fetch(path);
      return { path, status: response.status, type: response.headers.get("content-type") || "" };
    })));
    assert(optionalResponses.every(item => item.status === 503 && !/^text\/html\b/i.test(item.type)),
      "unavailable optional JavaScript receives a non-HTML failure response through the worker", JSON.stringify(optionalResponses));
  } finally {
    await optionalContext.close();
  }
  console.log(`service-worker upgrade: ${oldCache} controls first, ${currentCache} activates, old cache is deleted, entry shell boots`);
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
