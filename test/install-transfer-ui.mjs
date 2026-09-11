#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:8136/";
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const fixture = JSON.parse(readFileSync(new URL("./fixtures/install-transfer-clone-v1.json", import.meta.url), "utf8"));
const tokenSegment = Buffer.alloc(32, 7).toString("base64url");
const TOKEN = `v1.k1.${tokenSegment}.${tokenSegment}.${tokenSegment}`;
const EXPIRES_AT = "2099-01-01T01:00:00.000Z";
const CASE = process.argv.includes("--case") ? process.argv[process.argv.indexOf("--case") + 1] : "all";

function standaloneInit() {
  const original = window.matchMedia.bind(window);
  window.matchMedia = (query) => query.includes("display-mode: standalone")
    ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
    : original(query);
}

async function seedEstablishedState(page) {
  await page.addInitScript((durableState) => {
    localStorage.setItem("repforge_v1", JSON.stringify({ ...durableState, _storageRevision: 4 }));
    localStorage.setItem("repforge_ui_v1", JSON.stringify({ theme: "light", tourDone: true }));
    localStorage.setItem("repforge_telemetry_enabled_v1", "false");
    localStorage.setItem("repforge_telemetry_identity_v1", JSON.stringify({
      schemaVersion: 1,
      installationId: "11111111-1111-4111-8111-111111111111",
      createdAt: "2026-08-01T10:00:00.000Z",
    }));
  }, fixture.durableState);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
}

const browser = await launchChromium();
let checks = 0;
try {
  if (CASE === "all" || CASE === "create") {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: IOS_UA,
      locale: "en-US",
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const requests = [];
    await context.route("**/v1/transfers", async (route) => {
      requests.push(JSON.parse(route.request().postData() || "{}"));
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        headers: { "cache-control": "no-store" },
        body: JSON.stringify({ token: TOKEN, expiresAt: EXPIRES_AT }),
      });
    });
    const page = await context.newPage();
    await seedEstablishedState(page);
    await page.evaluate(() => window.__repforgeUi.showInstallBanner(true));
    await page.click("#installBannerAction");
    await page.waitForSelector("#iosInstallSheet.is-open", { timeout: 3000 });
    assert.equal(await page.locator("#iosInstallSheet").getAttribute("aria-labelledby"), "iosInstallTitle", "transfer dialog has a stable accessible name");
    const disclosure = await page.locator("#installTransferDisclosure").innerText();
    assert.match(disclosure, /Cloudflare/i, "pre-action disclosure names Cloudflare");
    assert.match(disclosure, /EU/i, "pre-action disclosure names the EU boundary");
    assert.equal(requests.length, 0, "opening the explanation does not create a transfer");
    await page.click("#installTransferPrivacy");
    await page.waitForSelector("#privacySheet.is-open");
    const privacy = await page.locator("#privacySheet").innerText();
    assert.match(privacy, /derives .* encryption from the .* token/i, "cached Privacy explains token-derived encryption");
    assert.match(privacy, /30 days/i, "cached Privacy qualifies provider restore retention");
    await page.keyboard.press("Escape");
    await page.waitForSelector("#privacySheet", { state: "hidden" });
    assert.equal(await page.evaluate(() => document.activeElement?.id), "installTransferPrivacy", "Privacy returns focus to its transfer-sheet opener");
    await page.click("#installTransferStart");
    try {
      await page.waitForFunction(() => document.querySelector("#iosInstallSheet")?.dataset.transferState === "ready", undefined, { timeout: 5000 });
    } catch (error) {
      console.error(await page.evaluate(() => ({
        state: document.querySelector("#iosInstallSheet")?.dataset.transferState,
        status: document.querySelector("#installTransferStatus")?.textContent,
        marker: localStorage.getItem("repforge_transfer_outbound_v1"),
        failure: window.__repforgeBootFailure || null,
      })));
      throw error;
    }
    assert.equal(requests.length, 1, "the explicit production action creates one transfer");
    assert.equal(requests[0].envelope?.kind, "taurifer-install-transfer", "the production action sends the logical clone envelope");
    assert.equal(await page.locator("#installTransferStatus").getAttribute("aria-live"), "polite", "transfer progress uses a polite live region");
    checks += 10;
    await context.close();
  }

  if (CASE === "all" || CASE === "polling") {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: IOS_UA,
      locale: "en-US",
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const statusTimes = [];
    await context.route("**/v1/transfers", (route) => route.fulfill({
      status: 201,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify({ token: TOKEN, expiresAt: EXPIRES_AT }),
    }));
    await context.route("**/v1/transfers/status", (route) => {
      statusTimes.push(Date.now());
      const state = statusTimes.length === 1 ? "available" : "claimed-expired";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "cache-control": "no-store" },
        body: JSON.stringify({ state, expiresAt: EXPIRES_AT }),
      });
    });
    const page = await context.newPage();
    await seedEstablishedState(page);
    await page.evaluate(() => window.__repforgeUi.showInstallBanner(true));
    await page.click("#installBannerAction");
    await page.click("#installTransferStart");
    await page.waitForFunction(() => {
      try {
        const marker = JSON.parse(localStorage.getItem("repforge_transfer_outbound_v1") || "null");
        return marker?.phase === "unknown-outcome" && marker?.outcomeCode === "claimed-expired";
      } catch { return false; }
    }, undefined, { timeout: 20000 });
    assert.equal(statusTimes.length, 2, "Safari recovery polls until a terminal response");
    assert(statusTimes[1] - statusTimes[0] >= 9000, "Safari status polling backs off between requests");
    assert.equal(await page.locator("#iosInstallSheet").getAttribute("data-transfer-state"), "claimed-expired", "claimed-expired replaces ordinary in-progress UI");
    assert.equal(await page.locator("#iosInstallSheet").isVisible(), true, "claimed-expired recovery remains visible until an explicit choice");
    assert.equal(await page.locator("#iosInstallClose").isVisible(), false, "indeterminate recovery cannot be dismissed as complete");
    if (!await page.locator("#installTransferContinue").isVisible()) {
      console.error(await page.evaluate(() => ["installTransferActions", "installTransferContinue", "iosInstallInstructions"].map((id) => {
        const element = document.getElementById(id);
        return { id, className: element?.className, hidden: element?.hidden, display: element ? getComputedStyle(element).display : null };
      })));
    }
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#iosInstallSheet").getAttribute("data-transfer-state"), "claimed-expired", "Escape cannot bypass indeterminate recovery");
    await page.locator("#installTransferContinue").scrollIntoViewIfNeeded();
    await page.click("#installTransferContinue");
    await page.waitForSelector("#installTransferDivergenceModal.is-open");
    await page.keyboard.press("Escape");
    await page.waitForSelector("#installTransferDivergenceModal", { state: "hidden" });
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("repforge_transfer_outbound_v1") || "null")?.phase), "unknown-outcome", "cancelling divergence preserves the frozen recovery marker");
    await page.click("#installBannerAction");
    assert.equal(await page.locator("#iosInstallSheet").getAttribute("data-transfer-state"), "claimed-expired", "reopening recovery preserves the terminal state");
    checks += 7;
    await context.close();
  }

  if (CASE === "all" || CASE === "installed-failure") {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: IOS_UA,
      locale: "en-US",
      hasTouch: true,
      reducedMotion: "reduce",
    });
    await context.addInitScript(standaloneInit);
    await context.addInitScript(() => localStorage.clear());
    await context.route("**/v1/transfers/claims", (route) => route.fulfill({
      status: 404,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify({ state: "unavailable" }),
    }));
    const encoded = Buffer.from(JSON.stringify({ token: TOKEN, expiresAt: EXPIRES_AT })).toString("base64url");
    await context.addCookies([{
      name: "repforge_transfer_v1",
      value: `v1.${encoded}`,
      domain: new URL(BASE).hostname,
      path: "/index.html",
      sameSite: "Lax",
    }]);
    const page = await context.newPage();
    await page.goto(new URL("index.html", BASE).href, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    assert.equal(await page.locator("#iosInstallSheet").getAttribute("data-transfer-state"), "terminal", "a terminal installed claim failure renders in the product");
    assert.equal(await page.locator("#installTransferContinue").isVisible(), true, "terminal installed failure offers a concrete continuation action");
    assert.equal(await page.evaluate(() => window.__repforgeBootFailure?.code), "service-unavailable", "the rendered outcome retains the transfer failure code");
    checks += 3;
    await context.close();
  }

  if (CASE === "all" || CASE === "installed-retry") {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, userAgent: IOS_UA, locale: "en-US", hasTouch: true,
      reducedMotion: "reduce",
    });
    await context.addInitScript(standaloneInit);
    await context.addInitScript(() => localStorage.clear());
    await context.route("**/v1/transfers/claims", (route) => route.abort("connectionfailed"));
    const encoded = Buffer.from(JSON.stringify({ token: TOKEN, expiresAt: EXPIRES_AT })).toString("base64url");
    await context.addCookies([{
      name: "repforge_transfer_v1", value: `v1.${encoded}`, domain: new URL(BASE).hostname,
      path: "/index.html", sameSite: "Lax",
    }]);
    const page = await context.newPage();
    await page.goto(new URL("index.html", BASE).href, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    assert.equal(await page.locator("#iosInstallSheet").getAttribute("data-transfer-state"), "interrupted", "an indeterminate installed claim failure renders recovery UI");
    assert.equal(await page.locator("#installTransferRetry").isVisible(), true, "an interrupted installed claim offers retry");
    assert.equal(await page.locator("#iosInstallClose").isVisible(), false, "installed recovery cannot be dismissed without resolving it");
    assert.equal(await page.locator("#installTransferStatus").getAttribute("aria-live"), "polite", "installed failure is announced in the live region");
    checks += 4;
    await context.close();
  }

  if (CASE === "all" || CASE === "offline-privacy") {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, locale: "en-US", serviceWorkers: "allow", reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await seedEstablishedState(page);
    await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready; await registration.update(); });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await page.click("#openSettings");
    await page.click("#privacyDetails");
    await page.waitForSelector("#privacySheet.is-open");
    assert.match(await page.locator("#privacySheet").innerText(), /Temporary install transfer/, "the full transfer disclosure remains available offline");
    assert.equal(await page.locator("#privacySheet").getAttribute("aria-labelledby"), "privacyTitle", "cached Privacy has a stable accessible name");
    checks += 2;
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\nInstall-transfer production UI: ${checks} assertions passed.`);
