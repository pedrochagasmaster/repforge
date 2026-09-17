#!/usr/bin/env node
// Plan 056 P8 — Progress contextual guides through the Plan 054 registry.
// Covers anchored completion, dismissal, targeted replay, deferred replay,
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

// Automatic Overview guidance is in document flow and completing its anchor
// records only presentation state.
{
  const { context, page } = await freshPage();
  await openProgress(page);
  await page.waitForSelector('[data-guide-cue="progress"]', { timeout: 5000 });
  const anchor = await page.evaluate(() => {
    const cue = document.querySelector('[data-guide-cue="progress"]');
    const target = document.querySelector(cue?.dataset.anchorTarget || "[data-never]");
    return {
      cueParent: cue?.parentElement?.id,
      targetVisible: Boolean(target?.getClientRects().length),
      role: cue?.getAttribute("role"),
      labelled: Boolean(cue?.getAttribute("aria-labelledby")),
    };
  });
  assert.equal(anchor.cueParent, "stats", "Progress cue stays beside its concrete Overview anchor and outside the tablist");
  assert.equal(anchor.targetVisible, true);
  assert.equal(anchor.role, "status");
  assert.equal(anchor.labelled, true);
  await page.click('#statsSeg [data-seg="overview"]');
  await page.waitForFunction(() => !document.querySelector('[data-guide-cue="progress"]'));
  assert.equal(await page.evaluate(() => window.__repforgeUi.guideState().progress.status), "completed");

  await page.click('#statsSeg [data-seg="review"]');
  await page.waitForSelector('[data-guide-cue="block-transition"]', { timeout: 5000 });
  await page.click('[data-guide-cue="block-transition"] [data-guide-dismiss]');
  assert.equal(await page.evaluate(() => window.__repforgeUi.guideState()["block-transition"].status), "dismissed");
  assert.equal(await page.locator('[data-guide-cue="block-transition"]').count(), 0);
  await context.close();
}

// Replaying from Settings with no live anchor defers cleanly. Returning to the
// relevant route presents the cue; replay in place moves focus to Dismiss and
// Escape restores the invoking control.
{
  const { context, page } = await freshPage();
  await page.evaluate(() => window.__repforgeShowSettings());
  await page.click("#guideReplayToggle");
  const replay = page.locator('[data-guide-replay="block-transition"]');
  await replay.click();
  await page.waitForFunction(() => window.__repforgeUi.guideState()["block-transition"]?.status === "deferred");
  assert.equal(await page.locator('[data-guide-cue="block-transition"]').count(), 0,
    "missing anchor never leaves a floating cue");
  assert.equal(await replay.evaluate((button) => document.activeElement === button), true,
    "deferred replay leaves focus on the invoking button");

  await openProgress(page);
  await page.click('#statsSeg [data-seg="review"]');
  await page.waitForSelector('[data-guide-cue="block-transition"]', { timeout: 5000 });
  await page.focus('#statsSeg [data-seg="review"]');
  await page.evaluate(() => window.__repforgeUi.replayGuide("block-transition"));
  await page.waitForFunction(() => document.activeElement?.hasAttribute("data-guide-dismiss"));
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
  assert.equal(await page.locator("[data-guide-cue]").count(), 0);
  await context.close();
}

assert.deepEqual(errors, [], "no page errors during Progress guide journeys");
await browser.close();
console.log("PASS: Progress contextual guides (complete, dismiss, replay, defer, focus, disabled)");
