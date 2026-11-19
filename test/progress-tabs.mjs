import { openProgressPage } from "./browser.mjs";
// Progress destinations remain discoverable at narrow widths and enlarged text.
import { launchChromium } from "./browser.mjs";
import { loadManifest } from "../tools/ui-screens/manifest.mjs";
import { APP_SCENARIOS, appState } from "../tools/ui-screens/screens-app.mjs";
import { dismissChrome, openPage, settle } from "../tools/ui-screens/session.mjs";

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`); }
}

const manifest = loadManifest();
const browser = await launchChromium();
try {
  for (const [viewport, locale, text] of [["phone-390", "en", "normal"], ["phone-430", "en", "normal"], ["phone-390", "pt", "normal"], ["phone-430", "pt", "normal"],
    ["phone-320", "en", "normal"], ["phone-320", "pt", "normal"], ["phone-390", "pt", "text200"], ["phone-320", "en", "text200"]]) {
    const tag = `${viewport} ${locale} ${text}`;
    console.log(`\n${tag}`);
    const capture = { flow: "progress", screen: "overview-action", viewport, theme: "light", locale, text, motion: "normal" };
    const opened = await openPage(browser, manifest, capture, appState("progress/overview-action", manifest.locales[locale].lang));
    const page = opened.page;
    try {
      await dismissChrome(page);
      await APP_SCENARIOS["progress/overview-action"](page);
      await settle(page);
      for (const destination of ["strength", "volume", "prs", "review", "profile"]) {
        const link = page.locator(`#segOverview [data-open-page="${destination}"]`).first();
        const box = await link.boundingBox();
        const width = await page.evaluate(() => document.documentElement.clientWidth);
        assert(box && box.x >= 0 && box.x + box.width <= width + 1,
          `${tag}: ${destination} link fits the viewport`, JSON.stringify(box));
        await openProgressPage(page, destination);
        assert(await page.locator("#statsBack").isVisible(), `${tag}: ${destination} has Back`);
        await page.locator("#statsBack").click();
        assert(await link.evaluate(el => el === document.activeElement), `${tag}: Back restores link focus`);
      }
    } finally {
      await opened.context.close();
    }
  }
} finally {
  await browser.close();
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exitCode = results.failed ? 1 : 0;
