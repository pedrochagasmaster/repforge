#!/usr/bin/env node
import assert from "node:assert/strict";
import { launchChromium } from "./browser.mjs";
import { loadManifest } from "../tools/ui-screens/manifest.mjs";
import { APP_SCENARIOS, appState } from "../tools/ui-screens/screens-app.mjs";
import { dismissChrome, openPage, settle } from "../tools/ui-screens/session.mjs";

const manifest = loadManifest();
const browser = await launchChromium();

try {
  for (const [locale, theme, text] of [["en", "light", "normal"], ["pt", "dark", "normal"], ["pt", "light", "text200"]]) {
    const capture = { flow: "program", screen: "progression-editor", viewport: "phone-390", locale, theme, text, motion: "normal" };
    const opened = await openPage(browser, manifest, capture, appState("program/progression-editor", manifest.locales[locale].lang));
    try {
      await dismissChrome(opened.page);
      await APP_SCENARIOS["program/progression-editor"](opened.page);
      await settle(opened.page);
      // Plan 074: per-week targets live in the exercise's Weeks sheet, one week
      // opened as a per-set table. That table (its column labels and cells) is
      // the current analog of the old metric-cycle disclosure under test.
      await opened.page.locator('#programEditor [data-role="exercise-row"]').first().click();
      await opened.page.waitForSelector('#reviewSheet.is-open [data-pe-sheet="exercise"]', { timeout: 20000 });
      await opened.page.locator('#reviewSheet [data-role="weeks-open"]').click();
      await opened.page.locator('#reviewSheet [data-role="week-row"]').first().click();
      await opened.page.waitForSelector('#reviewSheet [data-role="week-body"]', { timeout: 20000 });
      await settle(opened.page);
      const geometry = await opened.page.evaluate(() => {
        const sheet = document.querySelector('#reviewSheet [data-pe-sheet="weeks"]');
        const table = sheet?.querySelector('[data-role="week-body"]');
        const labels = [...table?.querySelectorAll(".program-editor-a__th") || []];
        const cells = [...table?.querySelectorAll("input") || []];
        const visible = (element) => {
          const style = getComputedStyle(element), box = element.getBoundingClientRect();
          return style.display !== "none" && box.width > 0 && box.height > 0;
        };
        const targets = [...sheet?.querySelectorAll("button, input") || []].filter(visible);
        const overlaps = (elements) => elements.some((element, index) => elements.some((other, otherIndex) => {
          if (index === otherIndex) return false;
          const a = element.getBoundingClientRect(), b = other.getBoundingClientRect();
          return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        }));
        const firstInput = cells[0];
        firstInput?.focus();
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          tableOverflow: table ? table.scrollWidth - table.clientWidth : null,
          labels: labels.map((element) => element.textContent.trim()),
          overlap: overlaps([...labels, ...cells]),
          smallestTarget: Math.min(...targets.map((element) => Math.min(element.getBoundingClientRect().width, element.getBoundingClientRect().height))),
          focusOutline: firstInput ? getComputedStyle(firstInput).outlineStyle : "none",
          rowOverlap: overlaps([...document.querySelectorAll('#programEditor [data-role="exercise-row"]')]),
        };
      });
      assert.equal(geometry.overflow <= 0, true, `${locale}/${theme}/${text}: editor has no document overflow: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.tableOverflow <= 0, true, `${locale}/${theme}/${text}: the week table fits the sheet: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.overlap, false, `${locale}/${theme}/${text}: week-table labels and cells do not collide: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.rowOverlap, false, `${locale}/${theme}/${text}: exercise rows do not collide: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.labels.length >= 3 && geometry.labels.every(Boolean), `${locale}/${theme}/${text}: the week table retains persistent localized labels: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.smallestTarget >= 44, `${locale}/${theme}/${text}: Weeks sheet controls retain 44px targets: ${JSON.stringify(geometry)}`);
      assert.notEqual(geometry.focusOutline, "none", `${locale}/${theme}/${text}: a week-table input has visible focus treatment`);
      console.log(`program editor geometry ${locale}/${theme}/${text}: ${JSON.stringify(geometry)}`);
    } finally {
      await opened.context.close();
    }
  }
} finally {
  await browser.close();
}
