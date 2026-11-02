#!/usr/bin/env node
/**
 * An edited generated program shares as a link, through the path a lifter takes (owner, 2026-11-02).
 *
 * Generate a program through onboarding, activate it, make one trivial edit in the installed
 * Program editor (a set count, a rest, an exercise swap, a day name), then Program → Share
 * setup link. For each edit, at 3 training days with a deload and at 5 without:
 *   - the sheet offers a v5 link (the recipe plus the edit, #527/#579) within the link limit,
 *     not the program file;
 *   - the link decodes, on the app's own receiving path, to the identical definition.
 * Programs generated before the 073.5 bump share as a file until their next block (Plan 076,
 * decision A); share-program-browser covers that.
 *
 * Run: node test/share-edited-programs.mjs   (requires the app served over HTTP)
 */
import { launchChromium, waitForAppBoot, answerRecommend } from "./browser.mjs";
import { openInstalledEditor, openExerciseSheet, setSheetSetCount, applyInstalledEditor, sheetTap, editorSettled } from "./fixtures/installed-editor.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`); }
}

const EDITS = {
  "set count": async (page, id) => {
    await openExerciseSheet(page, id);
    const shown = Number((await page.locator('#reviewSheet [data-role="sets-step-value"]').textContent()).match(/\d+/)?.[0]);
    await setSheetSetCount(page, shown + 1);
  },
  rest: async (page, id) => {
    await openExerciseSheet(page, id);
    const presets = await page.$$eval('#reviewSheet [data-role="rest-preset"]', (items) => items.map((item) => ({ s: item.dataset.seconds, on: item.getAttribute("aria-checked") === "true" || item.classList.contains("is-on") })));
    const target = presets.find((preset) => !preset.on) || presets[0];
    await sheetTap(page, `[data-role="rest-preset"][data-seconds="${target.s}"]`);
  },
  swap: async (page, id) => {
    await openExerciseSheet(page, id);
    await page.locator('#reviewSheet [data-role="swap-open"]').click();
    await page.waitForSelector('#reviewSheet.is-open [data-pe-sheet="swap"]', { timeout: 5000 });
    await page.locator('#reviewSheet [data-role="swap-choice"]').first().click();
    await editorSettled(page);
  },
  "day name": async (page) => {
    await page.locator('#programEditor [data-role="day-menu"]').click();
    await page.locator('#reviewSheet [data-role="day-action"][data-action="rename"]').click();
    const input = page.locator('#reviewSheet.is-open [data-role="rename-input"]');
    await input.waitFor({ timeout: 5000 });
    await input.fill("Push day");
    await page.locator('#reviewSheet [data-role="rename-save"]').click();
    await editorSettled(page);
  },
};

async function generateAndActivate(page, { days, deload }) {
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await answerRecommend(page, { days, minutes: 60, deload, skipBasics: true });
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "result", undefined, { timeout: 30000 });
  await page.click("#entryActivate");
  await page.waitForFunction(() => !document.querySelector("#onboarding.active"), undefined, { timeout: 20000 });
  await waitForAppBoot(page, { base: BASE });
}

async function shareLink(page) {
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#program.view.active");
  await page.click("#shareProgramSetup");
  await page.waitForSelector("#shareSetupSheet:not(.hidden)", { timeout: 10000 });
  await page.waitForFunction(() => {
    const link = document.querySelector("#shareSetupLink")?.textContent?.trim();
    const file = document.querySelector("#shareSetupFile:not(.hidden)");
    const status = document.querySelector("#shareSetupStatus:not(.hidden)")?.textContent?.trim();
    return !!link || !!file || (!!status && !/…|\.\.\./.test(status));
  }, undefined, { timeout: 20000 });
  return page.evaluate(async () => {
    const link = document.querySelector("#shareSetupLink")?.textContent?.trim() || "";
    const file = !!document.querySelector("#shareSetupFile:not(.hidden)");
    const status = document.querySelector("#shareSetupStatus")?.textContent?.trim() || "";
    const fragment = link.includes("#setup=") ? link.slice(link.indexOf("#setup=") + "#setup=".length) : "";
    let roundTrip = null;
    if (fragment) {
      const decoded = await SharedSetup.decode(fragment, sharedSetupDecodeCodecOptions());
      const sent = state.programMeta.programDefinition;
      roundTrip = decoded.ok ? JSON.stringify(canonicalize(decoded.value.program.definition)) === JSON.stringify(canonicalize(sent)) : decoded.code;
    }
    return { link: !!link, wire: fragment.split(".")[0], chars: fragment.length, limit: SharedSetup.MAX_ENCODED_CHARS, file, status, roundTrip };
  });
}

const browser = await launchChromium();
try {
  for (const shape of [{ days: 3, deload: true }, { days: 5, deload: false }]) {
    for (const [name, edit] of Object.entries(EDITS)) {
      const tag = `${shape.days} days${shape.deload ? ", deload" : ""}, ${name}`;
      console.log(`\n${tag}`);
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      try {
        await generateAndActivate(page, shape);
        const before = await page.evaluate(() => JSON.stringify(state.programMeta.programDefinition));
        await page.click('nav [data-view="program"]');
        await openInstalledEditor(page);
        const id = await page.locator('#programEditor [data-role="exercise-row"]').first().getAttribute("data-id");
        await edit(page, id);
        await applyInstalledEditor(page);
        const after = await page.evaluate(() => JSON.stringify(state.programMeta.programDefinition));
        assert(after !== before, `${tag}: the edit changed the program`);
        const shared = await shareLink(page);
        assert(shared.link && !shared.file && shared.wire === "v5" && shared.chars <= shared.limit,
          `${tag}: Share offers a v5 link within the limit, not the file`, JSON.stringify(shared));
        assert(shared.roundTrip === true, `${tag}: the link decodes to the identical program`, JSON.stringify(shared.roundTrip));
      } catch (error) {
        assert(false, `${tag}: the path completes`, String(error?.message || error).slice(0, 300));
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exitCode = results.failed ? 1 : 0;
