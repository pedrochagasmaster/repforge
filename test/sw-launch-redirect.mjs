#!/usr/bin/env node
import {browserLanguage} from './language-browser.mjs';
import {ensureBrowserInterchange} from './interchange-browser.mjs';
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
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { startRedirectHost } from "./redirect-host.mjs";
import { buildSetupDocument, encodeSetupDocument, readSharedHook, sharedGateSnapshot, waitForFirstRun } from "./shared-setup-flow.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const worker = readFileSync(join(ROOT, "sw.js"), "utf8");
const CACHE = worker.match(/const CACHE = ["']([^"']+)["']/)?.[1];
assert(CACHE, "sw.js declares a cache name");
const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.webmanifest"), "utf8"));

const host = await startRedirectHost();
const base = host.base;
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

const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const tokenSegment = Buffer.alloc(32, 7).toString("base64url");
const TOKEN = `v1.k1.${tokenSegment}.${tokenSegment}.${tokenSegment}`;
const EXPIRES_AT = "2099-01-01T01:00:00.000Z";
function standaloneInit() {
  const original = window.matchMedia.bind(window);
  window.matchMedia = (query) => query.includes("display-mode: standalone")
    ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
    : original(query);
  Object.defineProperty(navigator, "standalone", { configurable: true, get: () => true });
}

const contextOptions = { viewport: { width: 390, height: 844 }, userAgent: IOS_UA, locale: "en-US", hasTouch: true, reducedMotion: "reduce" };

/** Safari at the address the user types; the host serves the document at `/`. */
async function openSafari() {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base });
  return { context, page };
}

/** The Home Screen app: Safari's cookies, a standalone display, the manifest launch. */
async function launchInstalled(cookies) {
  const context = await browser.newContext(contextOptions);
  await context.addInitScript(standaloneInit);
  await context.addCookies(cookies);
  const page = await context.newPage();
  const response = await page.goto(launch, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base });
  return { context, page, response };
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
  {
    const safari = await openSafari();
    await ensureBrowserInterchange(safari.page);
    const wrote = await safari.page.evaluate(({ token, expiresAt }) => window.__repforgeInterchangeTest.transfer
      .writeTransferCookie({ token, expiresAt }, { document, location }), { token: TOKEN, expiresAt: EXPIRES_AT });
    check(wrote === true, "Safari writes the transfer cookie");
    // The cookie is now visible to Safari's own page; only the installed app claims it.
    await safari.page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(safari.page, { base });
    await ensureBrowserInterchange(safari.page);
    const safariAfter = await safari.page.evaluate(() => ({
      failure: window.__repforgeBootFailure?.code ?? null,
      sheet: document.querySelector("#iosInstallSheet")?.getAttribute("data-transfer-state") ?? null,
      cookie: !!window.__repforgeInterchangeTest.transfer.readTransferCookie(),
    }));
    check(host.serviceRequests.length === 0 && safariAfter.failure === null && safariAfter.cookie,
      "a Safari reload keeps its transfer cookie and does not claim it", JSON.stringify({ safariAfter, requests: host.serviceRequests }));
    const cookies = await safari.context.cookies();
    await safari.context.close();

    const installed = await launchInstalled(cookies);
    const landed = new URL(installed.page.url()).pathname;
    check(landed === "/", "the manifest launch lands on / through the host's redirect", landed);
    const claims = host.serviceRequests.filter((entry) => entry.pathname === "/v1/transfers/claims");
    check(claims.length > 0, "the installed app finds the transfer cookie and claims the transfer",
      JSON.stringify({ requests: host.serviceRequests, cookie: await installed.page.evaluate(() => document.cookie) }));
    check(host.serviceRequests.every((entry) => entry.cookie === null), "the transfer service receives no cookie", JSON.stringify(host.serviceRequests));
    await installed.context.close();
  }

  {
    const safari = await openSafari();
    const encoded = await encodeSetupDocument(safari.page, await buildSetupDocument(safari.page, { name: "Redirect program" }));
    check(encoded.ok === true, "the codec encodes a setup document", JSON.stringify(encoded));
    await ensureBrowserInterchange(safari.page);
    const wrote = await safari.page.evaluate((value) => window.__repforgeInterchangeTest.setup.writeHandoffCookie(value)
      && window.__repforgeInterchangeTest.setup.readHandoffCookie() === value, encoded.value);
    check(wrote === true, "Safari writes the setup cookie and reads it back");
    const cookies = await safari.context.cookies();
    await safari.context.close();

    const installed = await launchInstalled(cookies);
    await waitForFirstRun(installed.page).catch(() => {});
    const gate = await installed.page.evaluate(sharedGateSnapshot,await browserLanguage(installed.page));
    const hook = await installed.page.evaluate(readSharedHook);
    check(gate.gate && gate.startVisible && hook.source === "cookie" && hook.status === "ready",
      "the installed app shows the shared program from the setup cookie", JSON.stringify({ gate, hook }));
    await installed.context.close();
  }

  console.log(`\n${passed} passed, 0 failed`);
} finally {
  await browser.close();
  await host.close();
}
