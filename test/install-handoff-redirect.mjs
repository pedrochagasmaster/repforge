#!/usr/bin/env node
/**
 * Install handoff cookies across the production launch redirect.
 *
 * Safari hands the installed app two things through cookies: the install
 * transfer's claim token (`repforge_transfer_v1`, ADR 0013) and a received
 * setup link (`repforge_setup_v1`, ADR 0007). iOS copies Safari's cookies into
 * the Home Screen app when it is added. The installed app launches at the
 * manifest's `./index.html`, which the production host answers with
 * `308 Location: /`, so the app boots at `/`. A cookie scoped to
 * `/index.html` is not sent to `/` and is not in its `document.cookie`, so the
 * installed app found no claim and no shared program (owner report,
 * 2026-10-15: the installed app opened empty).
 *
 * Each case writes the cookie in a browser context through the app's own
 * module, copies that context's cookies into a fresh standalone context, and
 * launches the manifest URL through the redirect. The installed app must
 * start the claim or show the shared program, and the transfer service must
 * receive no cookie.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { startRedirectHost } from "./redirect-host.mjs";
import { buildSetupDocument, encodeSetupDocument, readSharedHook, sharedGateSnapshot, waitForFirstRun } from "./shared-setup-flow.mjs";

const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const tokenSegment = Buffer.alloc(32, 7).toString("base64url");
const TOKEN = `v1.k1.${tokenSegment}.${tokenSegment}.${tokenSegment}`;
const EXPIRES_AT = "2099-01-01T01:00:00.000Z";
const manifest = JSON.parse(readFileSync(new URL("../manifest.webmanifest", import.meta.url), "utf8"));

function standaloneInit() {
  const original = window.matchMedia.bind(window);
  window.matchMedia = (query) => query.includes("display-mode: standalone")
    ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
    : original(query);
  Object.defineProperty(navigator, "standalone", { configurable: true, get: () => true });
}

const host = await startRedirectHost();
const base = host.base;
const launch = new URL(manifest.start_url, new URL("manifest.webmanifest", base)).href;
const browser = await launchChromium();
let passed = 0;
const failures = [];
const check = (cond, name, detail) => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); return; }
  failures.push(name);
  console.log(`  ✗ ${name}${detail ? `\n    ${detail}` : ""}`);
};
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
  console.log("\nInstall handoff cookies across the /index.html → / launch redirect");

  {
    const safari = await openSafari();
    const wrote = await safari.page.evaluate(({ token, expiresAt }) => window.RepForgeInstallTransfer
      .writeTransferCookie({ token, expiresAt }, { document, location }), { token: TOKEN, expiresAt: EXPIRES_AT });
    check(wrote === true, "Safari writes the transfer cookie");
    // The cookie is now visible to Safari's own page; only the installed app claims it.
    await safari.page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(safari.page, { base });
    const safariAfter = await safari.page.evaluate(() => ({
      failure: window.__repforgeBootFailure?.code ?? null,
      sheet: document.querySelector("#iosInstallSheet")?.getAttribute("data-transfer-state") ?? null,
      cookie: !!window.RepForgeInstallTransfer.readTransferCookie(),
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
    const wrote = await safari.page.evaluate((value) => window.RepForgeSharedSetup.writeHandoffCookie(value)
      && window.RepForgeSharedSetup.readHandoffCookie() === value, encoded.value);
    check(wrote === true, "Safari writes the setup cookie and reads it back");
    const cookies = await safari.context.cookies();
    await safari.context.close();

    const installed = await launchInstalled(cookies);
    await waitForFirstRun(installed.page).catch(() => {});
    const gate = await installed.page.evaluate(sharedGateSnapshot);
    const hook = await installed.page.evaluate(readSharedHook);
    check(gate.gate && gate.startVisible && hook.source === "cookie" && hook.status === "ready",
      "the installed app shows the shared program from the setup cookie", JSON.stringify({ gate, hook }));
    await installed.context.close();
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  assert.deepEqual(failures, [], "install handoff cookies survive the launch redirect");
} finally {
  await browser.close();
  await host.close();
}
