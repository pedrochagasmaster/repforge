#!/usr/bin/env node
/** Installed-worker upgrade proof: an old cache is removed while the current
 * shell remains launchable, including the entry modules added after the old
 * release. */
import assert from "node:assert/strict";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const browser = await launchChromium();
const context = await browser.newContext();
const page = await context.newPage();
try {
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const old = await caches.open("repforge-v147");
    await old.put(new Request("/index.html"), new Response("old shell"));
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.unregister();
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  const result = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const keys = await caches.keys();
    const current = await caches.open("repforge-v148");
    return {
      keys,
      index: !!(await current.match("./index.html")),
      entry: !!(await current.match("./program-entry.js")),
      adapter: !!(await current.match("./program-entry-adapter.js")),
      active: document.querySelector("#dayTabs button") !== null,
    };
  });
  assert.equal(result.keys.includes("repforge-v147"), false, "upgrade removes the previous release cache");
  assert.equal(result.index && result.entry && result.adapter && result.active, true, "upgraded worker serves the current shell and entry modules");
  console.log("service-worker upgrade: previous cache removed and current entry shell is launchable");
} finally { await context.close(); await browser.close(); }
