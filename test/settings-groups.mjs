#!/usr/bin/env node
/** Plan 057-P8: Settings task groups and replayable contextual help. */
import assert from "node:assert/strict";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const UI_KEY = "repforge_ui_v1";
const DATA_KEY = "repforge_v1";
const failures = [];
let passed = 0;

function check(condition, message, detail) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
    return;
  }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${JSON.stringify(detail)}`);
}

async function ready(page) {
  await waitForAppBoot(page);
  await page.evaluate(() => {
    window.closeFirstRun?.();
    window.closeOnboarding?.();
    window.__repforgeShowSettings?.();
  });
  await page.waitForSelector("#settings.view.active", { timeout: 10000 });
  await page.waitForSelector("#theme");
}

async function cleanSettings(page) {
  await page.evaluate((uiKey) => {
    const current = JSON.parse(localStorage.getItem(uiKey) || "{}");
    const definitions = window.RepForgeGuideRegistry.GUIDE_DEFINITIONS;
    current.guideState = Object.fromEntries(definitions.map((guide) => [guide.id, {
      version: guide.version,
      status: "dismissed",
      lastTransitionAt: 1,
    }]));
    localStorage.setItem(uiKey, JSON.stringify(current));
  }, UI_KEY);
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
}

const required = Object.freeze({
  training: [
    "#unit", 'input[name="rirMode"]', "#jumpPct", "#minJump", "#rirHigh", "#hardRir",
    "#saveSettings", "#createProgram", "#progressionRow",
  ],
  app: ["#theme", "#lang", "#restSec", "#voiceToggle", "#notifyToggle", "#notifyConfigRow", "#installApp"],
  data: ["#exportJson", "#exportCsv", "#importJson", "#telemetryToggle", "#privacyDetails", "#reset"],
  help: ["#guideReplayToggle", "#guideReplayList", "#settingsAbout", "#settingsSupport"],
});

const browser = await launchChromium();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  serviceWorkers: "block",
  timezoneId: "UTC",
});
const page = await context.newPage();

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await ready(page);

  console.log("Settings task groups");
  const groups = await page.evaluate(() => [...document.querySelectorAll("#settings > .settings-group")]
    .map((group) => ({
      id: group.dataset.settingsGroup || "",
      visible: !group.hidden && !group.classList.contains("hidden") && getComputedStyle(group).display !== "none",
      summary: group.querySelector(".settings-group__summary")?.textContent.trim() || "",
    })));
  check(JSON.stringify(groups.map((group) => group.id)) === JSON.stringify(["training", "app", "data", "help"]),
    "Settings renders the four required task groups in order", groups);
  check(groups.length === 4 && groups.every((group) => group.visible && group.summary.length > 0),
    "every task group is visible and has a short summary", groups);

  for (const selector of ["#progressionRow", "#restSecRow", "#notifyConfigRow", "#dataBackupRow", "#dataImportRow", "#guideReplayToggle"]) {
    await page.click(selector);
    const panel = await page.locator(selector).getAttribute("aria-controls");
    if (panel) await page.waitForFunction((id) => document.querySelector(`#${id}`)?.classList.contains("is-open"), panel);
  }

  for (const [groupId, selectors] of Object.entries(required)) {
    const result = await page.evaluate(({ groupId, selectors }) => {
      const group = document.querySelector(`#settings > .settings-group[data-settings-group="${groupId}"]`);
      return Object.fromEntries(selectors.map((selector) => {
        const node = document.querySelector(selector);
        const owned = !!node && !!group?.contains(node);
        const visible = !!node && !node.hidden && !node.classList.contains("hidden") && getComputedStyle(node).display !== "none";
        return [selector, { owned, visible }];
      }));
    }, { groupId, selectors });
    for (const selector of selectors) {
      const item = result[selector];
      const isPolicyEligibleInstall = selector === "#installApp";
      const hiddenNativeFileInput = selector === "#importJson" && item?.owned;
      check(item?.owned && (item.visible || isPolicyEligibleInstall || hiddenNativeFileInput),
        `${selector} remains reachable in the ${groupId} group`, item);
    }
  }

  const registry = await page.evaluate(() => {
    const definitions = window.RepForgeGuideRegistry.GUIDE_DEFINITIONS;
    return {
      ids: definitions.map((guide) => guide.id),
      wired: definitions.map((guide) => ({ id: guide.id, wired: guide.wired })),
      buttons: [...document.querySelectorAll("#guideReplayList [data-guide-replay]")].map((button) => button.dataset.guideReplay),
      copy: definitions.map((guide) => ({
        id: guide.id,
        title: window.RepForgeI18n.t(`guide.${guide.id}.title`),
        body: window.RepForgeI18n.t(`guide.${guide.id}.body`),
      })),
    };
  });
  check(JSON.stringify(registry.buttons) === JSON.stringify(registry.ids),
    "guide replay list follows every registry definition in registry order", registry);
  check(registry.wired.every((guide) => guide.wired === true),
    "every registry guide is wired to a real anchor", registry.wired);
  check(registry.copy.every((guide) => guide.title && guide.body && guide.title !== `guide.${guide.id}.title` && guide.body !== `guide.${guide.id}.body`),
    "every registry guide has reviewed title and body copy", registry.copy);

  console.log("\nReplay isolation and deferral");
  await page.evaluate((dataKey) => {
    const state = JSON.parse(localStorage.getItem(dataKey) || "{}");
    window.__settingsGroupsDataBefore = JSON.stringify(state);
  }, DATA_KEY);
  const selected = page.locator('[data-guide-replay="first-set"]');
  if (await selected.count()) {
    const before = await page.evaluate((uiKey) => JSON.parse(localStorage.getItem(uiKey) || "{}"), UI_KEY);
    await selected.click({ timeout: 5000 });
    await page.waitForTimeout(500);
    const after = await page.evaluate((uiKey) => JSON.parse(localStorage.getItem(uiKey) || "{}"), UI_KEY);
    const unrelatedIds = Object.keys(before.guideState || {}).filter((id) => id !== "first-set");
    check(unrelatedIds.every((id) => JSON.stringify(after.guideState?.[id]) === JSON.stringify(before.guideState?.[id])),
      "replay changes only the selected guide record", { before, after });
    check(await page.locator("#settings.view.active").count() === 1 &&
      await page.locator('[data-guide-cue="first-set"]').count() === 0 &&
      after.guideState["first-set"].status === "deferred",
    "a hidden owning anchor defers replay without navigation or a floating cue", {
      view: await page.locator("#settings.view.active").count(),
      cue: await page.locator('[data-guide-cue="first-set"]').count(),
      status: after.guideState["first-set"].status,
    });
  } else {
    check(false, "first-set guide replay is reachable", registry.buttons);
    check(false, "a hidden owning anchor defers replay without navigation or a floating cue");
  }

  console.log("\nAppearance boundary");
  const stateBefore = await page.evaluate((dataKey) => localStorage.getItem(dataKey), DATA_KEY);
  await page.selectOption("#theme", "dark");
  await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  const boundary = await page.evaluate(({ uiKey, dataKey }) => ({
    theme: JSON.parse(localStorage.getItem(uiKey) || "{}").theme,
    stateUnchanged: localStorage.getItem(dataKey),
    stateTheme: JSON.parse(localStorage.getItem(dataKey) || "{}").settings?.theme,
  }), { uiKey: UI_KEY, dataKey: DATA_KEY });
  check(boundary.theme === "dark" && boundary.stateUnchanged === stateBefore && boundary.stateTheme === undefined,
    "appearance remains in device-only UI preferences", boundary);
} finally {
  await context.close();
  await browser.close();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) assert.fail(failures.join("; "));
