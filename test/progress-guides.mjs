#!/usr/bin/env node
// Plan 056 P8 — Progress contextual guides through the Plan 054 registry.
// Covers the anchored dialog, dismissal, targeted replay, deferred replay,
// keyboard focus restoration, and functional navigation without the registry.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { assertServingApp } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const base = process.env.REPFORGE_URL || "http://localhost:8000/";
await assertServingApp(base);
const browser = await chromium.launch();
const errors = [];

async function freshPage({ guides = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (!guides) {
    await context.route("**/guide-registry.js*", (route) => route.fulfill({
      contentType: "application/javascript",
      body: "window.RepForgeGuideRegistry=undefined;",
    }));
  }
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(base, { waitUntil: "domcontentloaded" });
  // The empty first boot persists its own first-run state; seeding before it
  // finishes lets that write land over the seeded program.
  await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 20000 });
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker?.getRegistrations?.() || [];
    for (const registration of registrations) await registration.unregister();
    const keys = await caches?.keys?.() || [];
    for (const key of keys) await caches.delete(key);
    localStorage.clear();
  });
  await installSeedProgram(page, {
    waitFor: (target) => target.waitForFunction(() => window.__repforgeBooted === true),
  });
  return { context, page };
}

async function openProgress(page) {
  await page.evaluate(() => document.querySelector('nav button[data-view="stats"]')?.click());
  await page.waitForSelector("#stats.view.active", { timeout: 5000 });
}

// The automatic Overview guide is the modal guide dialog, placed on its
// Overview anchor. "Got it" records only presentation state.
{
  const { context, page } = await freshPage();
  await openProgress(page);
  await page.waitForSelector('dialog#guideDialog[open][data-guide="progress"]', { timeout: 5000 });
  const anchor = await page.evaluate(() => {
    const dialog = document.querySelector("dialog#guideDialog");
    const target = document.querySelector('#statsSeg [data-seg="overview"]');
    return {
      modal: dialog?.matches(":modal"),
      targetVisible: Boolean(target?.getClientRects().length),
      labelled: Boolean(document.getElementById(dialog?.getAttribute("aria-labelledby") || "")),
    };
  });
  assert.equal(anchor.modal, true, "Progress guide is a modal dialog");
  assert.equal(anchor.targetVisible, true, "Progress guide opens where its concrete Overview anchor is on screen");
  assert.equal(anchor.labelled, true);
  await page.click("#guideDialogOk");
  await page.waitForFunction(() => !document.querySelector("dialog#guideDialog[open]"));
  assert.equal(await page.evaluate(() => window.__repforgeUi.guideState().progress.status), "dismissed");

  await page.click('#statsSeg [data-seg="review"]');
  await page.waitForSelector('dialog#guideDialog[open][data-guide="block-transition"]', { timeout: 5000 });
  await page.click("#guideDialogOk");
  assert.equal(await page.evaluate(() => window.__repforgeUi.guideState()["block-transition"].status), "dismissed");
  assert.equal(await page.locator("dialog#guideDialog[open]").count(), 0);
  await context.close();
}

// Replaying from Settings with no live anchor defers cleanly. Returning to the
// relevant route presents the guide; replay in place moves focus to the
// dialog's title and Escape restores the invoking control.
{
  const { context, page } = await freshPage();
  await page.evaluate(() => window.__repforgeShowSettings());
  // Settings presents its own guide on arrival; this journey replays another.
  await page.waitForSelector("dialog#guideDialog[open]", { timeout: 5000 });
  await page.click("#guideDialogOk");
  await page.click("#guideReplayToggle");
  const replay = page.locator('[data-guide-replay="block-transition"]');
  await replay.click();
  await page.waitForFunction(() => window.__repforgeUi.guideState()["block-transition"]?.status === "deferred");
  assert.equal(await page.locator("dialog#guideDialog[open]").count(), 0,
    "missing anchor never opens a guide");
  assert.equal(await replay.evaluate((button) => document.activeElement === button), true,
    "deferred replay leaves focus on the invoking button");

  await openProgress(page);
  await page.waitForSelector('dialog#guideDialog[open][data-guide="progress"]', { timeout: 5000 });
  await page.click("#guideDialogOk");
  await page.click('#statsSeg [data-seg="review"]');
  await page.waitForSelector('dialog#guideDialog[open][data-guide="block-transition"]', { timeout: 5000 });
  await page.click("#guideDialogOk");
  await page.focus('#statsSeg [data-seg="review"]');
  await page.evaluate(() => window.__repforgeUi.replayGuide("block-transition"));
  await page.waitForFunction(() => document.activeElement?.id === "guideDialogTitle");
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('#statsSeg [data-seg="review"]')), true,
    "Escape dismisses replay and restores focus to its invoker");
  assert.equal(await page.evaluate(() => window.__repforgeUi.guideState()["block-transition"].status), "dismissed");
  await context.close();
}

// The registry is optional presentation infrastructure. Progress navigation
// and Review remain available when its script is disabled.
{
  const { context, page } = await freshPage({ guides: false });
  await openProgress(page);
  await page.click('#statsSeg [data-seg="review"]');
  assert.equal(await page.locator("#segReview.active").count(), 1);
  assert.equal(await page.locator("#reviewPanel").count(), 1);
  assert.equal(await page.locator("dialog#guideDialog").count(), 0);
  await context.close();
}

assert.deepEqual(errors, [], "no page errors during Progress guide journeys");
await browser.close();
console.log("PASS: Progress contextual guides (dialog, dismiss, replay, defer, focus, disabled)");
