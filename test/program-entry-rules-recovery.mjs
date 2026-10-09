#!/usr/bin/env node
/**
 * Route-owned recovery for setup drafts saved under older rules.
 *
 * Each draft is made through the production entry UI, then its recorded rules
 * version is aged, as if an older release had saved it. Reopening setup must
 * show the rules notice and recover by route:
 *   - Generate (recommend) and Custom regenerate from the saved answers with the
 *     current generator, replacing the preview only once a candidate exists; a
 *     failed regeneration keeps the old preview and stays recoverable.
 *   - Build keeps its editable candidate and hands over to the editor.
 *   - Import and shared links keep their validated snapshot after an explicit
 *     acceptance; there is no generator input to rebuild them from.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { installSeedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";
import { encodeSetupLink } from "./fixtures/setup-link-v4.mjs";

const require = createRequire(import.meta.url);
const Adapter = require("../program-entry-adapter.js");
const Compiler = require("../program-compiler.js");
const Catalog = require("../assets/exercise-catalog.json");

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const DRAFT = "repforge_program_setup_draft_v1";
const STALE_NAME = "Stale preview from older rules";

const browser = await launchChromium();
const errors = [];

const entry = (page) => page.evaluate(() => structuredClone(window.__repforgeEntryState?.()));
const atStep = (page, steps) => page.waitForFunction(
  (list) => list.includes(window.__repforgeEntryState?.()?.step), steps, { timeout: 15000 });

async function freshPage({ program = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error?.message || error)));
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  if (program) await installSeedProgram(page, { waitFor: (p) => waitForAppBoot(p, { base: BASE }) });
  return { context, page };
}

/** Open setup over an active program (Settings origin), on the hub. */
async function openHub(page) {
  await page.evaluate(() => window.startOnboarding("settings", { userInitiated: true }));
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 15000 });
}

async function walkGenerate(page, route) {
  if (route === "recommend") {
    await page.click('[data-entry-route="recommend"][data-entry-goal="muscle_growth"]');
  } else {
    await page.click('[data-entry-route="custom"]');
    await atStep(page, ["desired_result"]);
    await page.click('[data-entry-pick="desiredResult"][data-entry-val="muscle_growth"]');
    await page.click("#onbNext");
  }
  await atStep(page, ["background"]);
  await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
  await page.click("#onbNext");
  await atStep(page, ["schedule"]);
  await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="4"]');
  await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
  await page.click("#onbNext");
  await atStep(page, ["environment"]);
  await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
  await page.click("#onbNext");
  // The remaining optional steps (priorities, exercise preferences, the split,
  // which collapses to the generator's authored one) accept their defaults.
  for (let guard = 0; guard < 6 && (await entry(page)).step !== "result"; guard++) {
    const before = (await entry(page)).step;
    await page.click("#onbNext");
    await page.waitForFunction((step) => window.__repforgeEntryState?.()?.step !== step, before, { timeout: 15000 });
  }
  await atStep(page, ["result"]);
  await page.waitForSelector("#entryActivate", { timeout: 15000 });
}

async function walkBuild(page) {
  await page.click("#entryOwnToggle");
  await page.click('[data-entry-route="build"]');
  await page.locator("#entryProgramName").fill("Saved build");
  await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="2"]');
  await page.waitForFunction(() => !document.querySelector("#onbNext")?.disabled, undefined, { timeout: 5000 });
  await page.click("#onbNext");
  await page.waitForSelector('#onbProgramEditor [data-role="day"]', { timeout: 15000 });
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "editor" && !!window.__repforgeEntryState().result?.preview,
    undefined, { timeout: 15000 });
}

async function walkImport(page) {
  const definition = seedProgramMeta().programDefinition;
  const file = JSON.stringify({ kind: "taurifer-program", version: 4, name: "Imported block", definition, customExercises: [] });
  await page.click("#firstRunImport");
  await page.waitForSelector("#importProgram", { state: "attached" });
  await page.setInputFiles("#importProgram", { name: "program.json", mimeType: "application/json", buffer: Buffer.from(file) });
  await page.waitForSelector("#importReview.active", { timeout: 15000 });
  await page.click("#importCommit");
  await page.waitForSelector("#entryActivate", { timeout: 15000 });
}

async function walkShared(page) {
  const encoded = await encodeSetupLink(page, { name: "Shared block" });
  assert.ok(encoded?.ok, `the setup link encodes: ${JSON.stringify(encoded)}`);
  await page.goto(`${BASE}#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.waitForSelector("#firstRunSharedProgram:not(.hidden)", { timeout: 15000 });
  await page.click("#firstRunSharedStart");
  await page.waitForSelector("#entryActivate", { timeout: 15000 });
}

/**
 * Age the saved draft's rules version (and, for generated routes, mark its
 * preview so a replacement is observable), then reopen setup from a reload.
 */
async function ageDraftAndReopen(page, { origin, markPreview = false }) {
  await page.waitForFunction((key) => !!localStorage.getItem(key), DRAFT, { timeout: 10000 });
  const aged = await page.evaluate(({ key, markPreview, staleName }) => {
    const envelope = JSON.parse(localStorage.getItem(key));
    envelope.state.versions = { ...envelope.state.versions, rules: "old-rules" };
    if (markPreview) { envelope.state.result.name = staleName; envelope.state.result.namePt = staleName; }
    localStorage.setItem(key, JSON.stringify(envelope));
    return envelope.state;
  }, { key: DRAFT, markPreview, staleName: STALE_NAME });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate((origin) => { window.closeFirstRun?.(); window.startOnboarding(origin, { userInitiated: true }); }, origin);
  await page.waitForSelector("#onboarding.active", { timeout: 15000 });
  await page.waitForSelector("#entryRebuildRules, #entryKeepPinned", { timeout: 15000 });
  return aged;
}

async function assertPrimaryRebuildRole(page, route) {
  const colors = await page.evaluate(() => {
    const token = (property, name) => {
      const probe = document.createElement("span");
      probe.style.setProperty(property, `var(${name})`);
      document.body.append(probe);
      const value = getComputedStyle(probe).getPropertyValue(property);
      probe.remove();
      return value;
    };
    const button = getComputedStyle(document.querySelector("#entryRebuildRules"));
    return {
      actual: [button.backgroundColor, button.color, button.borderColor],
      expected: [
        token("background-color", "--control-primary-bg"),
        token("color", "--control-primary-ink"),
        token("border-color", "--control-primary-boundary"),
      ],
    };
  });
  assert.deepEqual(colors.actual, colors.expected, `${route} Rebuild rules uses primary control tokens`);
}

try {
  const current = Adapter.currentVersions(Compiler);

  // Generate and Custom regenerate with the current generator --------------
  for (const route of ["recommend", "custom"]) {
    const { context, page } = await freshPage({ program: true });
    await openHub(page);
    await walkGenerate(page, route);
    const aged = await ageDraftAndReopen(page, { origin: "settings", markPreview: true });
    await assertPrimaryRebuildRole(page, route);
    const shown = await entry(page);
    assert.equal(shown.result.name, STALE_NAME, `${route}: the stale preview is held until the rebuild`);
    await page.click("#entryRebuildRules");
    await page.waitForFunction(() => !document.querySelector("#entryRebuildRules"), undefined, { timeout: 15000 });
    const after = await entry(page);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).state, DRAFT);
    const request = Adapter.programRequestFromAnswers(aged.answers, Catalog);
    const expected = Compiler.generateProgram(request.value, Catalog, String(aged.draftId));
    assert.ok(expected.ok, `${route}: the saved answers still generate a program`);
    assert.notEqual(after.result.name, STALE_NAME, `${route}: the rebuild replaces the stale preview`);
    assert.deepEqual(after.result.preview.programDefinition, expected.value,
      `${route}: the replacement is the current generator's program for the saved answers and draft seed`);
    assert.equal(saved.versions.rules, current.rules, `${route}: the saved draft records the current rules`);
    assert.deepEqual(saved.result.preview.programDefinition, expected.value, `${route}: the replacement is what the draft saved`);
    await context.close();
  }

  // A failed regeneration keeps the old preview and stays recoverable --------
  {
    const { context, page } = await freshPage({ program: true });
    await openHub(page);
    await walkGenerate(page, "recommend");
    await ageDraftAndReopen(page, { origin: "settings", markPreview: true });
    await page.evaluate(() => {
      const base = window.RepForgeProgramEntryAdapter.createProductionServices({
        Compiler: window.RepForgeProgramCompiler, catalog: window.RepForgeExerciseCatalog.snapshot() });
      window.__repforgeProgramEntryServicesOverride = { ...base, generateProgram: () => ({ ok: false, conflicts: [] }) };
    });
    const before = await entry(page);
    const savedBefore = await page.evaluate((key) => localStorage.getItem(key), DRAFT);
    await page.click("#entryRebuildRules");
    await page.waitForSelector("#entryRebuildRules", { timeout: 15000 });
    assert.deepEqual((await entry(page)).result, before.result, "failed generator recovery preserves the old preview");
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), DRAFT), savedBefore, "failed generator recovery writes nothing");
    assert.equal(await page.locator("#entryRebuildRules").count(), 1, "failed generator recovery remains recoverable");
    await page.evaluate(() => { delete window.__repforgeProgramEntryServicesOverride; });
    await context.close();
  }

  // Build keeps its editable candidate and opens the editor -----------------
  {
    const { context, page } = await freshPage({ program: true });
    await openHub(page);
    await walkBuild(page);
    await ageDraftAndReopen(page, { origin: "settings" });
    await assertPrimaryRebuildRole(page, "build");
    const before = await entry(page);
    await page.click("#entryRebuildRules");
    await page.waitForFunction(() => document.body.classList.contains("is-entry-editor"), undefined, { timeout: 15000 });
    const after = await entry(page);
    assert.deepEqual(after.result, before.result, "Build preserves its editable candidate");
    assert.equal(after.versions.rules, current.rules, "Build records the current rules once it hands over to the editor");
    await context.close();
  }

  // Import and shared keep the validated snapshot after explicit acceptance --
  for (const [route, walk] of [["import", walkImport], ["shared", walkShared]]) {
    const { context, page } = await freshPage();
    await walk(page);
    await ageDraftAndReopen(page, { origin: "first-run" });
    assert.equal(await page.locator("#entryKeepPinned").count(), 1, `${route} exposes explicit pinned acceptance`);
    assert.equal(await page.locator("#entryRebuildRules").count(), 0, `${route} offers no rebuild it cannot perform`);
    const before = await entry(page);
    await page.click("#entryKeepPinned");
    await page.waitForFunction(() => !document.querySelector("#entryKeepPinned, #entryRebuildRules"), undefined, { timeout: 10000 });
    assert.deepEqual((await entry(page)).result, before.result, `${route} preserves the validated snapshot`);
    assert.ok(before.result.preview?.programDefinition, `${route} snapshot carries its ProgramDefinition`);
    await context.close();
  }

  assert.deepEqual(errors, [], "no uncaught page errors");
  console.log("program-entry route rules recovery: all assertions passed");
} finally {
  await browser.close();
}
