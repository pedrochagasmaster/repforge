#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { launchChromium, waitForAppBoot, waitForAsyncCondition } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
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

// Tab forward then wrap backwards past the first control: a dialog that contains
// focus never lets either direction escape into the inert page behind it.
async function focusStaysInside(page, selector) {
  const reach = async () => await page.evaluate((sel) => {
    const root = document.querySelector(sel);
    return !!(root && document.activeElement && root.contains(document.activeElement));
  }, selector);
  await page.keyboard.press("Tab");
  const forward = await reach();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  return forward && await reach();
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
    assert.equal(await page.evaluate(() => document.activeElement?.id), "installTransferStart", "opening the transfer dialog moves focus to its primary action");
    assert.equal(await focusStaysInside(page, "#iosInstallSheet"), true, "the transfer dialog contains keyboard focus in both directions");
    const disclosure = await page.locator("#installTransferDisclosure").innerText();
    assert.match(disclosure, /Cloudflare/i, "pre-action disclosure names Cloudflare");
    assert.match(disclosure, /EU/i, "pre-action disclosure names the EU boundary");
    assert.equal(requests.length, 0, "opening the explanation does not create a transfer");
    await page.click("#installTransferPrivacy");
    await page.waitForSelector("#privacySheet.is-open");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "privacyClose", "the cached Privacy dialog takes focus on open");
    assert.equal(await focusStaysInside(page, "#privacySheet"), true, "the cached Privacy dialog contains keyboard focus in both directions");
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
    checks += 14;
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

  if (CASE === "all" || CASE === "orphan-freeze") {
    // A tab that dies inside the transfer lock releases the Web Lock, but its
    // finally never runs, so the freeze signal survives. Boot must reclaim it as
    // the lock's next owner; a live owner must still block boot.
    const FREEZE_KEY = "repforge_install_transfer_freeze_v1";
    const holdFreeze = (page, raw) => page.evaluate((args) => {
      void navigator.locks.request("install-transfer", async () => {
        localStorage.setItem(args.key, args.raw);
        window.__freezeEntered = true;
        await new Promise((resolve) => { window.__releaseFreeze = resolve; });
      });
    }, { key: FREEZE_KEY, raw });
    const signal = JSON.stringify({ version: 1, owner: "crashed-owner", createdAt: "2026-10-21T00:00:00.000Z" });

    const crashed = await browser.newContext({ serviceWorkers: "block" });
    const owner = await crashed.newPage();
    await owner.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(owner, { base: BASE });
    const acknowledged = await owner.evaluate(async () => {
      const next = window.__repforgeWorkoutDraft.state();
      next.settings = { ...next.settings, restSec: 137 };
      const result = await window.__repforgeCommitProposedState(next);
      await window.__repforgeStorage.flush();
      return { committed: result?.committed, bytes: localStorage.getItem("repforge_v1") };
    });
    assert.equal(acknowledged.committed, true, "the device has acknowledged training data before the crash");
    await holdFreeze(owner, signal);
    await owner.waitForFunction(() => window.__freezeEntered === true);
    await owner.close();

    const reloader = await crashed.newPage();
    await reloader.goto(new URL("manifest.webmanifest", BASE).href);
    assert.equal(await reloader.evaluate(() => navigator.locks.request("install-transfer", { ifAvailable: true }, (lock) => !!lock)), true,
      "closing the owner released its Web Lock");
    assert.equal(await reloader.evaluate((key) => localStorage.getItem(key), FREEZE_KEY), signal, "the crash left an orphan freeze signal");
    await reloader.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(reloader, { base: BASE });
    assert.equal(await reloader.evaluate((key) => localStorage.getItem(key), FREEZE_KEY), null,
      "boot reclaims an orphan freeze as the transfer lock's owner");
    assert.equal(await reloader.evaluate(() => localStorage.getItem("repforge_v1")), acknowledged.bytes,
      "reclaiming the freeze leaves acknowledged training bytes unchanged");
    const written = await reloader.evaluate(async () => {
      const next = window.__repforgeWorkoutDraft.state();
      next.settings = { ...next.settings, restSec: 141 };
      const result = await window.__repforgeCommitProposedState(next);
      await window.__repforgeStorage.flush();
      return { committed: result?.committed, code: result?.code ?? null };
    });
    assert.deepEqual(written, { committed: true, code: null }, "saves work again after an orphan freeze is reclaimed");
    await reloader.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(reloader, { base: BASE });
    assert.equal(await reloader.evaluate(() => window.__repforgeWorkoutDraft.state().settings.restSec), 141,
      "the post-recovery save survives reload");
    checks += 6;
    await crashed.close();

    for (const raw of [signal, "{broken"]) {
      const context = await browser.newContext({ serviceWorkers: "block" });
      const writer = await context.newPage();
      await writer.goto(new URL("manifest.webmanifest", BASE).href);
      await holdFreeze(writer, raw);
      await writer.waitForFunction(() => window.__freezeEntered === true);
      const reader = await context.newPage();
      await reader.goto(BASE, { waitUntil: "domcontentloaded" });
      await waitForAsyncCondition(reader, async () => window.__repforgeBooted === true ||
        (await navigator.locks.query()).pending.some((lock) => lock.name === "install-transfer"));
      assert.equal(await reader.evaluate(() => window.__repforgeBooted === true), false, "a live transfer owner blocks boot");
      assert.equal(await reader.evaluate((key) => localStorage.getItem(key), FREEZE_KEY), raw, "a waiting boot never clears a live owner's signal");
      await writer.evaluate(() => window.__releaseFreeze());
      await waitForAppBoot(reader, { base: BASE });
      assert.equal(await reader.evaluate((key) => localStorage.getItem(key), FREEZE_KEY), null, "boot clears the signal once it owns the lock");
      checks += 3;
      await context.close();
    }
  }

  if (CASE === "all" || CASE === "slow-claim") {
    // A slow installed claim: the 12 s stall panel comes up while the claiming sheet is open
    // under it. The panel is the lifter's way out, so it keeps its pointer and keyboard behaviour,
    // and focus goes to the sheet once the panel lifts.
    const openStalledClaim = async () => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 }, userAgent: IOS_UA, locale: "en-US", hasTouch: true,
        reducedMotion: "reduce",
      });
      await context.addInitScript(standaloneInit);
      await context.addInitScript(() => localStorage.clear());
      // Same stall seam as test/boot-first-paint.mjs: the 12 s head timer runs at 300 ms once app.js is defined.
      await context.addInitScript(() => {
        const realSetTimeout = window.setTimeout.bind(window);
        window.setTimeout = (fn, ms, ...rest) => {
          if (ms !== 12000) return realSetTimeout(fn, ms, ...rest);
          const run = () => (typeof window.__repforgeShowBootFailure === "function" ? fn() : void realSetTimeout(run, 20));
          return realSetTimeout(run, 300);
        };
      });
      const held = [];
      let claimSeen;
      const claimRequested = new Promise((resolve) => { claimSeen = resolve; });
      await context.route("**/v1/transfers/claims", (route) => { held.push(route); claimSeen(); });
      const encoded = Buffer.from(JSON.stringify({ token: TOKEN, expiresAt: EXPIRES_AT })).toString("base64url");
      await context.addCookies([{
        name: "repforge_transfer_v1", value: `v1.${encoded}`, domain: new URL(BASE).hostname,
        path: "/index.html", sameSite: "Lax",
      }]);
      const page = await context.newPage();
      await page.goto(new URL("index.html", BASE).href, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.documentElement.classList.contains("is-boot-failed") &&
        document.getElementById("iosInstallSheet")?.dataset.transferState === "claiming", undefined, { timeout: 20000 });
      await claimRequested;
      return { context, page, held };
    };
    const focusedId = (page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName || null);

    {
      // Pointer: Reload is the control under the pointer, and a click reloads.
      const { context, page } = await openStalledClaim();
      const reload = await page.evaluate(() => {
        const box = document.getElementById("bootReload").getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return { reachable: !!hit?.closest("#bootReload"), hit: hit?.id || hit?.className || hit?.tagName || null };
      });
      assert.equal(reload.reachable, true, `a claiming sheet opened under the stall panel does not disable its Reload (hit: ${reload.hit})`);
      let reloaded = false;
      try {
        await Promise.all([
          page.waitForNavigation({ waitUntil: "commit", timeout: 8000 }),
          page.click("#bootReload", { timeout: 4000 }),
        ]);
        reloaded = true;
      } catch {}
      assert.equal(reloaded, true, "Reload from the stall panel reloads the page while the claiming sheet is open");
      checks += 2;
      await context.close();
    }

    {
      // Keyboard, from where focus actually is once the claiming sheet has opened under the panel
      // (its title): Tab reaches the panel's Reload, Shift+Tab stays on it, and Enter activates it.
      const { context, page } = await openStalledClaim();
      const start = await focusedId(page);
      await page.keyboard.press("Tab");
      const afterTab = await focusedId(page);
      assert.equal(afterTab, "bootReload", `Tab from the claiming sheet reaches the stall panel's Reload (focus was ${start}, now ${afterTab})`);
      await page.keyboard.press("Shift+Tab");
      const afterShiftTab = await focusedId(page);
      assert.equal(afterShiftTab, "bootReload", `Shift+Tab keeps focus on the stall panel's Reload (focus: ${afterShiftTab})`);
      let reloadedByKey = false;
      try {
        await Promise.all([
          page.waitForNavigation({ waitUntil: "commit", timeout: 8000 }),
          page.keyboard.press("Enter"),
        ]);
        reloadedByKey = true;
      } catch {}
      assert.equal(reloadedByKey, true, "Enter on the focused Reload reloads the page while the claiming sheet is open");
      checks += 3;
      await context.close();
    }

    {
      // Lift: focus is on the panel's Reload when the claim ends. The panel lifts, and focus is
      // in the claiming sheet rather than on body.
      const { context, page, held } = await openStalledClaim();
      await page.focus("#bootReload");
      await page.evaluate(() => {
        window.__liftFocus = null;
        new MutationObserver(() => {
          if (window.__liftFocus !== null || document.getElementById("bootSplash")) return;
          const active = document.activeElement;
          window.__liftFocus = { id: active?.id || active?.tagName || null, inSheet: !!active?.closest("#iosInstallSheet") };
        }).observe(document.body, { childList: true });
      });
      await held[0].abort("connectionfailed");
      await page.waitForFunction(() => window.__liftFocus !== null, undefined, { timeout: 15000 }).catch(() => {});
      const lift = await page.evaluate(() => ({
        sample: window.__liftFocus,
        sheetVisible: document.getElementById("iosInstallSheet")?.hidden === false,
        splash: !!document.getElementById("bootSplash"),
      }));
      assert.equal(lift.splash, false, `the claim's end lifts the stall panel (${JSON.stringify(lift)})`);
      assert.equal(lift.sample?.inSheet, true, `after the panel lifts, focus is in the claiming sheet, not on body (focus at removal: ${JSON.stringify(lift.sample)})`);
      assert.equal(lift.sheetVisible, true, "the sheet is the visible surface after the lift");
      checks += 3;
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log(`\nInstall-transfer production UI: ${checks} assertions passed.`);
