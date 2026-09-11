#!/usr/bin/env node
/** Plan 053 old-worker/new-worker oracle for the real Safari handoff marker. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OLD_WORKER = readFileSync(join(ROOT, "test/fixtures/sw-v120.js"), "utf8");
const CURRENT_WORKER = readFileSync(join(ROOT, "sw.js"), "utf8");
const fixture = JSON.parse(readFileSync(join(ROOT, "test/fixtures/install-transfer-clone-v1.json"), "utf8"));
const cacheName = (worker) => worker.match(/const CACHE = ["']([^"']+)["']/)?.[1];
const oldCache = cacheName(OLD_WORKER);
const currentCache = cacheName(CURRENT_WORKER);
assert(oldCache && currentCache && oldCache !== currentCache, "upgrade generations are distinct");

const tokenSegment = Buffer.alloc(32, 9).toString("base64url");
const token = `v1.k1.${tokenSegment}.${tokenSegment}.${tokenSegment}`;
const expiresAt = "2099-01-01T01:00:00.000Z";
const mime = (suffix) => ({
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png",
  ".webp": "image/webp", ".woff2": "font/woff2",
}[suffix] || "application/octet-stream");
const statSafe = (file) => { try { return statSync(file); } catch { return null; } };
let workerGeneration = "old";
let remoteState = "available";
let createCount = 0;
let statusCount = 0;

const server = createServer((request, response) => {
  const pathname = decodeURIComponent((request.url || "/").split("?", 1)[0]);
  if (pathname === "/sw.js") {
    response.writeHead(200, { "content-type": "text/javascript", "cache-control": "no-store" });
    response.end(workerGeneration === "old" ? OLD_WORKER : CURRENT_WORKER);
    return;
  }
  if (request.method === "POST" && pathname === "/v1/transfers") {
    createCount += 1;
    response.writeHead(201, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ token, expiresAt }));
    return;
  }
  if (request.method === "POST" && pathname === "/v1/transfers/status") {
    statusCount += 1;
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ state: remoteState, expiresAt }));
    return;
  }
  const file = normalize(join(ROOT, pathname === "/" ? "index.html" : pathname.slice(1)));
  if (relative(ROOT, file).startsWith("..") || !statSafe(file)?.isFile()) {
    response.writeHead(404); response.end("Not found"); return;
  }
  response.writeHead(200, { "content-type": mime(extname(file)), "cache-control": "no-store" });
  createReadStream(file).pipe(response);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await launchChromium();
const context = await browser.newContext({
  serviceWorkers: "allow",
  viewport: { width: 390, height: 844 },
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  reducedMotion: "reduce",
});
const page = await context.newPage();
try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base });
  await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready; await registration.update(); });
  await page.waitForFunction((name) => caches.has(name), oldCache, { timeout: 10000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base });
  assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true, "released worker controls the source shell");

  await page.evaluate((durableState) => {
    localStorage.setItem("repforge_v1", JSON.stringify({ ...durableState, _storageRevision: 7 }));
    localStorage.setItem("repforge_ui_v1", JSON.stringify({ theme: "light", tourDone: true }));
    localStorage.setItem("repforge_telemetry_enabled_v1", "false");
  }, fixture.durableState);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base });
  const sourceBefore = await page.evaluate(() => localStorage.getItem("repforge_v1"));
  await page.evaluate(() => window.__repforgeUi.showInstallBanner(true));
  await page.click("#installBannerAction");
  await page.click("#installTransferStart");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("repforge_transfer_outbound_v1") || "null")?.phase === "awaiting-claim");
  assert.equal(createCount, 1, "the explicit production action creates the handoff under the released worker");

  workerGeneration = "current";
  await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready; await registration.update(); });
  await page.waitForFunction(async ({ oldName, currentName }) => {
    const names = await caches.keys();
    return names.includes(currentName) && !names.includes(oldName);
  }, { oldName: oldCache, currentName: currentCache }, { timeout: 20000 });
  remoteState = "claimed-expired";
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base });
  await page.waitForFunction(() => {
    const marker = JSON.parse(localStorage.getItem("repforge_transfer_outbound_v1") || "null");
    return marker?.phase === "unknown-outcome" && marker?.outcomeCode === "claimed-expired";
  });
  assert(statusCount >= 1, "the new shell resumes status recovery from the preserved handoff");
  assert.equal(await page.evaluate(() => localStorage.getItem("repforge_v1")), sourceBefore, "the worker upgrade does not mutate the retained Safari source");
  await page.click("#installBannerAction");
  assert.equal(await page.locator("#iosInstallSheet").getAttribute("data-transfer-state"), "claimed-expired", "the new shell renders the Plan 053 terminal recovery state");
  assert.equal(await page.locator("#installTransferContinue").isVisible(), true, "the new shell keeps explicit divergence recovery reachable");
  console.log(`install-transfer SW upgrade: ${oldCache} -> ${currentCache}; awaiting claim survived and resumed as claimed-expired recovery`);
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
