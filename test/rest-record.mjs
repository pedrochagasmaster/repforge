#!/usr/bin/env node
import assert from "node:assert/strict";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { installSeedProgram, seedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const RECORD = "repforge_rest_v1";
const browser = await launchChromium();

async function openWorkout(context, { fresh = false } = {}) {
  const page = await context.newPage();
  page.on("pageerror", error => { throw error; });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page);
  if (fresh) await installSeedProgram(page, { waitFor: waitForAppBoot });
  await page.evaluate(day => window.__repforgeEnterWorkout({ day }), seedProgram()[0].day);
  await page.waitForSelector("#workout.is-focus .exercise.is-current .focus-shelf");
  await page.evaluate(() => window.__repforgeGuides?.dismissAll?.());
  return page;
}

async function startRest(page, seconds = 120) {
  await page.evaluate(seconds => window.startRest(seconds), seconds);
  await page.waitForSelector("#restTab");
}

async function endRest(page) {
  await page.locator("#restTab").click();
  await page.waitForSelector("#restSheet.is-open");
  await page.locator("#restStop").click();
  assert.equal(await page.evaluate(() => window.__repforgeRest.state().active), false);
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await openWorkout(context, { fresh: true });
    await startRest(page);
    await page.evaluate(key => {
      const remove = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (name) {
        if (this === localStorage && name === key) throw new DOMException("removal denied", "SecurityError");
        return remove.call(this, name);
      };
    }, RECORD);
    await endRest(page);
    await page.close();
    const reopened = await openWorkout(context);
    assert.equal(await reopened.evaluate(() => window.__repforgeRest.state().active), false,
      "#663: an ended rest stays ended after refused removal and app kill");
    console.log("PASS #663: ended rest survives app kill as ended");
  } finally { await context.close(); }

  for (const denyWrite of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    try {
      const first = await openWorkout(context, { fresh: true });
      await startRest(first);
      const second = await openWorkout(context);
      await first.evaluate(({ key, denyWrite }) => {
        const get = Storage.prototype.getItem, remove = Storage.prototype.removeItem, set = Storage.prototype.setItem;
        window.restoreRestStorage = () => {
          Storage.prototype.getItem = get;
          Storage.prototype.removeItem = remove;
          Storage.prototype.setItem = set;
        };
        Storage.prototype.getItem = function (name) {
          if (this === localStorage && name === key) throw new DOMException("read denied", "SecurityError");
          return get.call(this, name);
        };
        Storage.prototype.removeItem = function (name) {
          if (this === localStorage && name === key) throw new DOMException("removal denied", "SecurityError");
          return remove.call(this, name);
        };
        if (denyWrite) Storage.prototype.setItem = function (name, value) {
          if (this === localStorage && name === key) throw new DOMException("write denied", "SecurityError");
          return set.call(this, name, value);
        };
      }, { key: RECORD, denyWrite });
      await endRest(first);
      await startRest(second, 180);
      const newer = await second.evaluate(key => localStorage.getItem(key), RECORD);
      await first.evaluate(() => {
        window.restoreRestStorage();
        document.dispatchEvent(new Event("visibilitychange"));
      });
      assert.equal(await first.evaluate(key => localStorage.getItem(key), RECORD), newer,
        `#664: an ended-rest retry preserves the newer tab's exact record, writes denied=${denyWrite}`);
      await first.close();
      await second.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(second);
      const restored = await second.evaluate(() => window.__repforgeRest.state());
      assert.ok(restored.active && restored.lengthSec === 180,
        "#664: the newer rest restores after the older tab recovers storage");
      console.log(`PASS #664: newer rest preserved, writes denied=${denyWrite}`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
