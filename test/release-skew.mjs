#!/usr/bin/env node
/**
 * Release skew, reproduced (owner bug, 2026-11-06). After a release the iPhone fetched the new query-versioned
 * scripts but was answered from a cache for the unversioned i18n.js and styles.css, so new code ran against the
 * previous release's strings and styles: History showed the raw key "history.session.share" and a black square for
 * the share icon.
 *
 * Here every request for an unversioned i18n.js, styles.css or motion-polish.css is answered with the previous
 * release's bytes (the current files less the strings and the icon rule that release added), the way a stale HTTP or
 * worker cache answers it. A shell that loads those assets by an unchanged URL pairs new code with old strings and
 * styles; one whose URLs move with each release never does.
 *
 * Run: node test/release-skew.mjs   (REPFORGE_URL points at a static server)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium } from "./browser.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
let passed = 0, failed = 0;
function assert(cond, name, detail) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); if (detail !== undefined) console.log(`    ${typeof detail === "string" ? detail : JSON.stringify(detail)}`); }
}

// The previous release, as a stale cache would hold it: without the History share strings and the share icon.
const oldStrings = readFileSync(join(ROOT, "i18n.js"), "utf8").replace(/\s*"history\.session\.share(?:_[a-z_]+)?":\s*"[^"]*",?/g, "");
const oldStyles = readFileSync(join(ROOT, "styles.css"), "utf8").replace(/\.icon-mask--share\{[^}]*\}/g, "");
const oldPolish = readFileSync(join(ROOT, "motion-polish.css"), "utf8");
const STALE = { "/i18n.js": ["text/javascript", oldStrings], "/styles.css": ["text/css", oldStyles], "/motion-polish.css": ["text/css", oldPolish] };

const browser = await launchChromium();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
const served = [];
await context.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  const stale = !url.search && STALE[url.pathname];
  if (stale) { served.push(url.pathname); return route.fulfill({ status: 200, contentType: stale[0], body: stale[1] }); }
  return route.continue();
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
try {
  console.log("\nAn update answered from a stale cache for every unchanged URL");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
  const seen = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.className = "icon-mask icon-mask--share";
    document.body.append(probe);
    const style = getComputedStyle(probe);
    const mask = style.maskImage || style.webkitMaskImage || "none";
    probe.remove();
    return { share: t("history.session.share"), mask: mask !== "none" && /url\(/.test(mask) };
  });
  assert(served.length === 0, "the shell asks for no unversioned string or style URL a stale cache could answer", served);
  assert(seen.share !== "history.session.share", "new code reads its own release's strings, never a raw key", seen);
  assert(seen.mask, "new markup gets its own release's icon rule, never a black square", seen);
  assert(errors.length === 0, "no page errors", errors);
} finally {
  await browser.close();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
