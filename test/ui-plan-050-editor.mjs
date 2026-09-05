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
      const geometry = await opened.page.evaluate(() => {
        const editor = document.querySelector("#programEditor");
        const range = editor?.querySelector("fieldset.program-editor__range");
        const parts = [...range?.querySelectorAll("legend, label") || []];
        const boxes = parts.map((element) => ({ text: element.textContent.trim() || element.getAttribute("aria-label") || element.tagName, box: element.getBoundingClientRect() }));
        const targets = [...editor?.querySelectorAll("button, input") || []].filter((element) => {
          const style = getComputedStyle(element), box = element.getBoundingClientRect();
          return style.display !== "none" && box.width > 0 && box.height > 0;
        });
        const firstInput = range?.querySelector("input");
        firstInput?.focus();
        const overlaps = (elements) => elements.some((element, index) => elements.some((other, otherIndex) => {
          if (index === otherIndex) return false;
          const a = element.getBoundingClientRect(), b = other.getBoundingClientRect();
          return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        }));
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          labels: [...range?.querySelectorAll("legend, label") || []].map((element) => element.textContent.trim()),
          overlap: boxes.some(({ box }, index) => boxes.some(({ box: other }, otherIndex) => index !== otherIndex &&
            box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)),
          smallestTarget: Math.min(...targets.map((element) => Math.min(element.getBoundingClientRect().width, element.getBoundingClientRect().height))),
          focusOutline: firstInput ? getComputedStyle(firstInput).outlineStyle : "none",
          headOverlap: [...editor.querySelectorAll(".program-editor__exercise-head")].some((head) =>
            overlaps([...head.children].filter((element) => getComputedStyle(element).display !== "none"))),
          actionOverlap: [...editor.querySelectorAll(".program-editor__exercise-actions")].some((actions) =>
            overlaps([...actions.querySelectorAll("button")])),
        };
      });
      assert.equal(geometry.overflow <= 0, true, `${locale}/${theme}/${text}: editor has no document overflow: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.overlap, false, `${locale}/${theme}/${text}: range legend, labels, and inputs do not collide: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.headOverlap, false, `${locale}/${theme}/${text}: exercise name and summary row do not collide: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.actionOverlap, false, `${locale}/${theme}/${text}: exercise actions reflow without overlap: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.labels.length >= 3 && geometry.labels.every(Boolean), `${locale}/${theme}/${text}: range retains persistent localized labels: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.smallestTarget >= 44, `${locale}/${theme}/${text}: editor controls retain 44px targets: ${JSON.stringify(geometry)}`);
      assert.notEqual(geometry.focusOutline, "none", `${locale}/${theme}/${text}: range input has visible focus treatment`);
      console.log(`program editor geometry ${locale}/${theme}/${text}: ${JSON.stringify(geometry)}`);
    } finally {
      await opened.context.close();
    }
  }
} finally {
  await browser.close();
}
