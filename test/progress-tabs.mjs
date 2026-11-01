#!/usr/bin/env node
/**
 * Progress's five tabs stay discoverable (refine 2026-11, P2).
 *
 * The row of five (Overview, Strength, Volume, PRs, Review) used to be cut at the
 * content gutter: at 390 and 430 Review lost its last letters, at 320 it was not on
 * screen at all, and at 200% only one or two tabs showed, with nothing saying more
 * were there. Now:
 *   - at 390 and 430, in English and Portuguese, all five tabs are whole;
 *   - where five cannot fit (320, 200% text), the row reaches the screen edge, the
 *     first tab it hides shows itself past the 4px edge softening as the cue, the hidden side is
 *     marked for its fade (data-overflow), and the hairline keeps the gutter's width;
 *   - choosing a hidden tab brings it whole into view, and scrolled to the end the
 *     fade moves to the start.
 *
 * Run: node test/progress-tabs.mjs   (requires the app served over HTTP)
 */
import { launchChromium } from "./browser.mjs";
import { loadManifest } from "../tools/ui-screens/manifest.mjs";
import { APP_SCENARIOS, appState } from "../tools/ui-screens/screens-app.mjs";
import { dismissChrome, openPage, settle } from "../tools/ui-screens/session.mjs";

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`); }
}

function measure() {
  const vw = document.documentElement.clientWidth;
  const row = document.querySelector("#statsSeg"), wrap = row.parentElement;
  const rb = row.getBoundingClientRect(), hairline = getComputedStyle(wrap, "::after");
  const tabs = [...row.querySelectorAll('[role="tab"]')].map((tab) => {
    const b = tab.getBoundingClientRect();
    return { seg: tab.dataset.seg, l: b.left, r: b.right, shown: Math.max(0, Math.min(b.right, vw) - Math.max(b.left, 0)), w: b.width, whole: b.left >= -0.5 && b.right <= vw + 0.5 };
  });
  const style = getComputedStyle(row);
  return { vw, row: { l: rb.left, r: rb.right }, overflow: row.dataset.overflow || "", mask: style.maskImage !== "none" ? style.maskImage : style.webkitMaskImage,
    scrolls: row.scrollWidth > row.clientWidth + 1, tabs, hairline: { width: parseFloat(hairline.width), wrapLeft: wrap.getBoundingClientRect().left } };
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
      const m = await page.evaluate(measure);
      assert(Math.abs(m.row.l) < 0.5 && Math.abs(m.row.r - m.vw) < 0.5, `${tag}: the tab row reaches both screen edges`, JSON.stringify(m.row));
      assert(Math.abs(m.hairline.width - (m.vw - 2 * 16)) < 1, `${tag}: the hairline keeps the gutter's width`, JSON.stringify(m.hairline));
      const wide = (viewport === "phone-390" || viewport === "phone-430") && text === "normal";
      if (wide) {
        assert(!m.scrolls && m.tabs.every((tab) => tab.whole), `${tag}: all five tabs are whole`, JSON.stringify(m.tabs.map((t) => [t.seg, Math.round(t.l), Math.round(t.r)])));
        assert(m.overflow === "" && (m.mask || "none") === "none", `${tag}: a row that fits has no fade`, JSON.stringify({ overflow: m.overflow, mask: m.mask }));
      } else {
        const firstHidden = m.tabs.find((tab) => !tab.whole);
        assert(m.scrolls && !!firstHidden, `${tag}: five cannot fit here, so the row scrolls`, JSON.stringify(m.tabs.map((t) => [t.seg, Math.round(t.l), Math.round(t.r)])));
        // The cue is the hidden tab's first letters at the screen edge: at least 6px of it past the 4px softening.
        assert(firstHidden && firstHidden.shown >= 10, `${tag}: the first hidden tab shows at least 6px past the softening as the cue`, JSON.stringify(firstHidden));
        assert(m.overflow === "end" && /gradient/.test(m.mask || ""), `${tag}: the hidden side is marked for its fade`, JSON.stringify({ overflow: m.overflow, mask: (m.mask || "").slice(0, 30) }));
        await page.evaluate(() => window.__repforgeStatsNav.setStatsSeg("review"));
        await page.waitForTimeout(400);
        const chosen = await page.evaluate(measure);
        const review = chosen.tabs.find((tab) => tab.seg === "review");
        assert(review.whole, `${tag}: choosing Review brings it whole into view`, JSON.stringify(review));
        await page.evaluate(() => { const row = document.querySelector("#statsSeg"); row.scrollLeft = row.scrollWidth; });
        await page.waitForTimeout(200);
        const end = await page.evaluate(measure);
        assert(end.overflow === "start", `${tag}: scrolled to the end, the fade moves to the start`, end.overflow);
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
