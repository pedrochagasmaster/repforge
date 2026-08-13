#!/usr/bin/env node
/**
 * Focused accessibility smoke for the current shell.
 * Steps 6–8 extend this file with modal, disclosure, contrast, target-size,
 * zoom, and History-index assertions. This skeleton only checks invariants
 * that already hold so CI stays green until those steps land.
 */
import { launchChromium } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    console.log(`  ✗ ${name}`);
    if (detail != null) console.log(`    ${detail}`);
  }
}

const browser = await launchChromium();
const page = await browser.newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#dayTabs button, #onboarding", { timeout: 10000, state: "attached" });
await page.evaluate(() => {
  const el = document.querySelector("#onboarding");
  if (el?.classList.contains("active") && typeof window.closeOnboarding === "function") window.closeOnboarding();
  const tour = document.querySelector("#tour");
  if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function") window.closeTour();
});

console.log("\nAccessibility skeleton");

const nav = await page.evaluate(() => {
  const tabs = [...document.querySelectorAll("nav button[data-view]")].map((b) => ({
    view: b.getAttribute("data-view"),
    current: b.getAttribute("aria-current"),
  }));
  return {
    tabs,
    toast: !!document.querySelector("#toast"),
    logActive: !!document.querySelector("#log.view.active"),
    viewport: document.querySelector('meta[name="viewport"]')?.content || "",
  };
});

assert(nav.tabs.length >= 4, "Primary nav exposes the four tab destinations", JSON.stringify(nav.tabs));
assert(
  nav.tabs.some((t) => t.view === "log" && t.current === "page"),
  "Active Log tab exposes aria-current=page",
  JSON.stringify(nav.tabs)
);
assert(nav.logActive, "Log view is the default active view");
assert(nav.toast, "#toast status region exists");
assert(/\bwidth=device-width\b/.test(nav.viewport), "Viewport meta includes width=device-width", nav.viewport);

await browser.close();
console.log(`\naccessibility tests: ${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
