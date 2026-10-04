#!/usr/bin/env node
/**
 * The installed launch URL on a host that redirects `/index.html` (#304).
 *
 * The production custom domain answers `/index.html` with `308 Location: /`
 * (the static host's pretty-URL rule). The manifest's `start_url`, the
 * worker's precache and older notification links all named `./index.html`, so
 * an installed Android app launched through the worker onto that redirect. A
 * navigation's redirect mode is `manual`: the worker's network fetch came back
 * as an opaque redirect, which it took for a failure, and it answered from the
 * precache, whose `./index.html` entry had been stored after following the
 * redirect. Chrome refuses a redirected response for a navigation, so the
 * launch was a bare ERR_FAILED page.
 *
 * A loopback server reproduces the host rule, and the real worker and app run
 * against it. A worker-controlled navigation to the launch URL must boot the
 * app online and offline, so must the scope root, and no precached shell entry
 * may be a redirected response.
 *
 * The fault (a host-side redirect interleaved with the worker's navigation
 * fallback) is not reachable from the ordinary preview, which serves
 * `index.html` directly.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, statSync, createReadStream } from "node:fs";
import { dirname, extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium } from "./browser.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const worker = readFileSync(join(ROOT, "sw.js"), "utf8");
const CACHE = worker.match(/const CACHE = ["']([^"']+)["']/)?.[1];
assert(CACHE, "sw.js declares a cache name");
const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.webmanifest"), "utf8"));

const statSafe = (file) => { try { return statSync(file); } catch { return null; } };
const mimeType = (extension) => ({
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
  ".woff2": "font/woff2",
}[extension] || "application/octet-stream");
const server = createServer((request, response) => {
  const [pathname, search = ""] = decodeURIComponent(request.url || "/").split("?");
  const headers = (type) => ({ "content-type": type, "cache-control": "no-store" });
  // The production host's rule: the document lives at the directory URL.
  if (pathname === "/index.html") {
    response.writeHead(308, { location: `/${search ? `?${search}` : ""}`, "cache-control": "no-store" });
    response.end();
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
const launch = new URL(manifest.start_url, new URL("manifest.webmanifest", base)).href;
const browser = await launchChromium();
const context = await browser.newContext();
const page = await context.newPage();
let passed = 0;
const check = (cond, name, detail) => { assert(cond, `${name}${detail ? `: ${detail}` : ""}`); passed++; console.log(`  ✓ ${name}`); };

const booted = () => page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 })
  .then(() => true, () => false);

/** A worker-controlled navigation, as the installed app's launch is. */
async function open(url) {
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    return { status: response?.status() ?? 0, url: page.url(), booted: await booted(), controlled: await page.evaluate(() => !!navigator.serviceWorker.controller) };
  } catch (error) {
    return { error: String(error.message || error).split("\n", 1)[0] };
  }
}

try {
  console.log("\nLaunch URL on a host that redirects /index.html");
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { timeout: 15000 });
  check(await page.evaluate((name) => caches.has(name), CACHE), `the release cache ${CACHE} installs against the redirecting host`);

  const redirected = await page.evaluate(async (name) => {
    const cache = await caches.open(name);
    const out = [];
    for (const request of await cache.keys()) {
      const response = await cache.match(request);
      if (response.redirected || response.type === "opaqueredirect") out.push(request.url);
    }
    return out;
  }, CACHE);
  check(redirected.length === 0, "no precached entry is a redirected response a navigation would refuse", JSON.stringify(redirected));

  for (const [label, url] of [["the manifest launch URL", launch], ["the legacy ./index.html launch URL", new URL("index.html", base).href],
    ["a legacy notification link with a goto", new URL("index.html?goto=log", base).href], ["the scope root", base]]) {
    const online = await open(url);
    check(!online.error && online.booted && online.controlled, `online, ${label} boots the app through the worker`, JSON.stringify({ url, ...online }));
  }

  await context.setOffline(true);
  for (const [label, url] of [["the manifest launch URL", launch], ["the legacy ./index.html launch URL", new URL("index.html", base).href], ["the scope root", base]]) {
    const offline = await open(url);
    check(!offline.error && offline.booted, `offline, ${label} boots the cached shell`, JSON.stringify({ url, ...offline }));
  }
  await context.setOffline(false);

  check(launch.startsWith(new URL(manifest.scope, new URL("manifest.webmanifest", base)).href),
    "the manifest launch URL stays inside the manifest scope, so the redirect the host adds keeps the app in scope", launch);
  check(!Object.hasOwn(manifest, "id"), "the manifest keeps id omitted (ADR 0008)");
  console.log(`\n${passed} passed, 0 failed`);
} finally {
  await browser.close();
  server.close();
}
