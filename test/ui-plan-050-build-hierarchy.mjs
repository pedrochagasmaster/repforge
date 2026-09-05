#!/usr/bin/env node
import assert from "node:assert/strict";
import { launchChromium } from "./browser.mjs";
import { loadManifest } from "../tools/ui-screens/manifest.mjs";
import { ONBOARDING_SCENARIOS, onboardingState } from "../tools/ui-screens/screens-onboarding.mjs";
import { dismissChrome, openPage, settle } from "../tools/ui-screens/session.mjs";

const manifest = loadManifest();
const browser = await launchChromium();

try {
  for (const [screen, locale, theme] of [
    ["onboarding-build/editor-empty", "en", "light"],
    ["onboarding-build/editor-partial", "pt", "dark"],
    ["onboarding-build/editor-ready", "en", "light"],
  ]) {
    const capture = { flow: "onboarding-build", screen: screen.split("/")[1], viewport: "phone-390", locale, theme, text: "normal", motion: "normal" };
    const opened = await openPage(browser, manifest, capture, onboardingState(screen, manifest.locales[locale].lang));
    try {
      await dismissChrome(opened.page);
      await ONBOARDING_SCENARIOS[screen](opened.page);
      await settle(opened.page);
      const hierarchy = await opened.page.evaluate(() => {
        const tokenColor = (token) => {
          const probe = document.createElement("span");
          probe.style.color = `var(${token})`;
          document.body.append(probe);
          const color = getComputedStyle(probe).color;
          probe.remove();
          return color;
        };
        const action = document.querySelector("#entryEditorActivate");
        const status = document.querySelector("#entryEditorStatus");
        const actionStyle = getComputedStyle(action);
        return {
          disabled: action.disabled,
          describedBy: action.getAttribute("aria-describedby"),
          statusId: status?.id || "",
          statusText: status?.textContent.trim() || "",
          statusVisible: !!status && getComputedStyle(status).display !== "none" && status.getBoundingClientRect().height > 0,
          background: actionStyle.backgroundColor,
          foreground: actionStyle.color,
          arrow: getComputedStyle(action, "::after").color,
          rule: tokenColor("--rule"),
          soft: tokenColor("--ink-soft"),
          faint: tokenColor("--ink-faint"),
          cta: tokenColor("--cta"),
        };
      });
      const blocked = screen !== "onboarding-build/editor-ready";
      assert.equal(hierarchy.disabled, blocked, `${screen} ${locale}/${theme}: Build disabled state is truthful: ${JSON.stringify(hierarchy)}`);
      if (blocked) {
        assert.equal(hierarchy.describedBy, hierarchy.statusId, `${screen} ${locale}/${theme}: disabled Build references its persistent reason`);
        assert.ok(hierarchy.statusVisible && hierarchy.statusText, `${screen} ${locale}/${theme}: disabled Build keeps a visible localized reason`);
        assert.equal(hierarchy.background, hierarchy.rule, `${screen} ${locale}/${theme}: disabled Build has quiet rule fill`);
        assert.equal(hierarchy.foreground, hierarchy.soft, `${screen} ${locale}/${theme}: disabled Build has legible muted text`);
        assert.equal(hierarchy.arrow, hierarchy.faint, `${screen} ${locale}/${theme}: disabled Build arrow is muted with its label`);
      } else {
        assert.equal(hierarchy.background, hierarchy.cta, `${screen} ${locale}/${theme}: ready Build restores the affirmative CTA`);
      }
      console.log(`Build hierarchy ${screen} ${locale}/${theme}: ${JSON.stringify(hierarchy)}`);
    } finally {
      await opened.context.close();
    }
  }
  for (const screen of ["onboarding-build/editor-partial", "onboarding-build/editor-ready"]) {
    const capture = { flow: "onboarding-build", screen: screen.split("/")[1], viewport: "phone-320", locale: "en", theme: "light", text: "normal", motion: "normal" };
    const opened = await openPage(browser, manifest, capture, onboardingState(screen, manifest.locales.en.lang));
    try {
      await dismissChrome(opened.page);
      await ONBOARDING_SCENARIOS[screen](opened.page);
      await settle(opened.page);
      const geometry = await opened.page.evaluate(() => ({
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        clippedFields: [...document.querySelectorAll('[data-role="exercise-field"]')].filter((field) =>
          field.scrollWidth > field.clientWidth + 1).map((field) => ({
            field: field.dataset.field, client: field.clientWidth, scroll: field.scrollWidth,
          })),
      }));
      assert.ok(geometry.documentOverflow <= 0 && geometry.clippedFields.length === 0,
        `${screen} phone-320: Build editor fields reflow without page or component overflow: ${JSON.stringify(geometry)}`);
      console.log(`Build compact geometry ${screen}: ${JSON.stringify(geometry)}`);
    } finally {
      await opened.context.close();
    }
  }
} finally {
  await browser.close();
}
