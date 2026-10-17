#!/usr/bin/env node
/**
 * Route-owned recovery for setup drafts saved under older rules.
 *
 * Each draft is made through the production entry UI, then its recorded rules
 * version is aged, as if an older release had saved it. Reopening setup must
 * show the rules notice and recover by route:
 *   - Generate (recommend) regenerates from saved answers with the current
 *     generator, replacing the preview only once a candidate exists; a failed
 *     regeneration keeps the old preview and stays recoverable.
 *   - A saved Custom route remains resumable through its one-release window
 *     even though the current hub no longer offers a Custom door.
 *   - Build keeps its editable candidate and hands over to the editor.
 *   - Import and shared links keep their validated snapshot after an explicit
 *     acceptance; there is no generator input to rebuild them from.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { launchChromium, waitForAppBoot, answerRecommend } from "./browser.mjs";
import { installSeedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";
import { decodeSetupLink, encodeSetupLink } from "./fixtures/setup-link-v4.mjs";

const require = createRequire(import.meta.url);
const Adapter = require("../program-entry-adapter.js");
const Compiler = require("../program-compiler.js");
const Catalog = require("../assets/exercise-catalog.json");

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const APP_INDEX = new URL("index.html", BASE).href;
const DRAFT = "repforge_program_setup_draft_v1";
const STATE = "repforge_v1";
const STALE_NAME = "Stale preview from older rules";

const browser = await launchChromium();
const errors = [];

const entry = (page) => page.evaluate(() => structuredClone(window.__repforgeEntryState?.()));
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonical(value[key])]),
  );
  return value;
}
const sameValue = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
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

async function walkGenerate(page) {
  await answerRecommend(page, {
    goal: "muscle_growth", lifting: "6_to_24m", days: 4, minutes: 60, environment: "commercial_gym", skipBasics: true,
  });
  await atStep(page, ["result"]);
  await page.waitForSelector("#entryActivate", { timeout: 15000 });
}

async function walkBuild(page) {
  await page.click('[data-entry-hub="build"]');
  await page.click("#onbNext");
  await page.locator("#entryProgramName").fill("Saved build");
  await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="2"]');
  await page.waitForFunction(() => !document.querySelector("#onbNext")?.disabled, undefined, { timeout: 5000 });
  await page.click("#onbNext");
  await page.waitForSelector('#onbProgramEditor [data-role="day"]', { timeout: 15000 });
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "editor" && !!window.__repforgeEntryState().result?.preview,
    undefined, { timeout: 15000 });
}

async function seedLegacyCustomDraft(page, versions) {
  return page.evaluate(async (versions) => {
    window.startOnboarding("first-run", { userInitiated: true, forceFresh: true });
    const Entry = window.RepForgeProgramEntry;
    const original = window.__repforgeEntryState();
    let saved = Entry.createState({
      draftId: "legacy-custom-route-draft",
      activeProgramRevisionAtStart: original.activeProgramRevisionAtStart,
      now: new Date().toISOString(),
      versions,
    });
    saved = Entry.selectRoute(saved, "custom");
    saved = Entry.setAnswers(saved, {
      desiredResult: "muscle_growth",
      structuredExperience: "6_to_24m",
      recentConsistency: "most",
      daysPerWeek: 4,
      sessionMinutes: 60,
      preferredRestSeconds: 120,
      environment: { kind: "commercial_gym" },
      primaryMuscles: [],
      deEmphasizedMuscles: [],
      ignoredMuscles: [],
      mustHaveExercises: [],
      exerciseConstraints: [],
    });
    saved = { ...saved, step: "exercise_preferences" };
    const persisted = await window.__repforgePersistSetupDraft(saved);
    await window.__repforgeOnboarding.flushDraft();
    return { persisted, route: saved.route, step: saved.step };
  }, versions);
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

async function walkSharedAfterHandoffReload(page, context) {
  const encoded = await encodeSetupLink(page, { name: "Shared block" });
  assert.ok(encoded?.ok && typeof encoded.value === "string", "the setup link encodes");
  const decoded = await decodeSetupLink(page, encoded.value);
  assert.ok(decoded?.ok && decoded.value?.program?.definition, "the production codec decodes the received definition");
  await page.goto(`${APP_INDEX}#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.waitForSelector("#firstRunSharedProgram:not(.hidden)", { timeout: 15000 });
  const cookie = await context.cookies();
  const staged = cookie.find((item) => item.name === "repforge_setup_v1")?.value;
  assert.ok(staged === encoded.value, "the approved encoded handoff cookie carries the exact proposal");
  const beforeReload = await sharedDurableSnapshot(page);
  assert.equal(beforeReload.setupDraft, null, "the received proposal has no durable setup draft before View program");

  // The fragment is consumed into the authorized setup cookie. A reload must
  // reconstruct the same gate from that handoff without persisting the payload.
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.waitForSelector("#firstRunSharedProgram:not(.hidden)", { timeout: 15000 });
  const restored = await sharedDurableSnapshot(page);
  const restoredCookie = (await context.cookies()).find((item) => item.name === "repforge_setup_v1")?.value;
  assert.ok(restoredCookie === encoded.value, "the encoded handoff survives reload until explicit activation");
  assert.equal(restored.setupDraft, null, "reload recovers the proposal without a durable received payload");
  assert.ok(sameValue(restored.local, beforeReload.local), "reload leaves local durable state unchanged at the shared gate");
  assert.ok(sameValue(restored.idb, beforeReload.idb), "reload leaves IndexedDB durable state unchanged at the shared gate");
  assert.equal(await page.evaluate(() => location.hash), "", "the received fragment stays consumed after reload");

  // The gate's approved action is the path to viewing the received program in
  // B Review; activation remains a separate, explicit action.
  await page.click("#firstRunSharedStart");
  await page.locator('#entryReview [data-review-slot]').first().waitFor({ state: "visible", timeout: 15000 });
  await page.waitForSelector("#entryActivate", { timeout: 15000 });
  const shown = await entry(page);
  assert.equal(shown.route, "shared", "View program opens the shared B editor route");
  assert.ok(sameValue(shown.result.preview.programDefinition, decoded.value.program.definition),
    "the B editor receives the exact definition from the encoded handoff");
  const beforeActivation = await sharedDurableSnapshot(page);
  assert.equal(beforeActivation.setupDraft, null, "the viewed received definition is still not a durable draft");
  assert.ok(sameValue(beforeActivation.local, beforeReload.local), "viewing the received definition does not write local durable state");
  assert.ok(sameValue(beforeActivation.idb, beforeReload.idb), "viewing the received definition does not write IndexedDB durable state");
  await page.click("#entryActivate");
  await page.waitForFunction(() => !document.querySelector("#onboarding")?.classList.contains("active"), undefined, { timeout: 15000 });
  await page.evaluate(() => window.__repforgeStorage?.flush?.());
  const activated = await sharedDurableSnapshot(page);
  assert.equal(activated.setupDraft, null, "activation consumes the transient setup proposal");
  assert.equal(activated.local?.programMeta?.onboarded, true, "explicit activation onboards the received program");
  assert.ok(sameValue(activated.local?.programMeta?.programDefinition, decoded.value.program.definition),
    "activation commits the exact received definition");
  assert.ok(sameValue(activated.idb?.programMeta?.programDefinition, decoded.value.program.definition),
    "the committed received definition is mirrored to IndexedDB");
  assert.equal((await context.cookies()).some((item) => item.name === "repforge_setup_v1"), false,
    "activation clears the temporary encoded handoff cookie");
}

async function sharedDurableSnapshot(page) {
  return page.evaluate(async ({ stateKey, draftKey }) => {
    const local = JSON.parse(localStorage.getItem(stateKey) || "null");
    const setupDraft = localStorage.getItem(draftKey);
    const db = await new Promise((resolve) => {
      const request = indexedDB.open("repforge", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
    let idb = null;
    if (db) {
      idb = await new Promise((resolve) => {
        const tx = db.transaction("kv", "readonly");
        const request = tx.objectStore("kv").get(stateKey);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
      db.close();
    }
    return { local, idb, setupDraft };
  }, { stateKey: STATE, draftKey: DRAFT });
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

  // Generate regenerates with the current generator -------------------------
  // (Custom made the same proof until Plan 072 removed its hub door.)
  for (const route of ["recommend"]) {
    const { context, page } = await freshPage({ program: true });
    await openHub(page);
    await walkGenerate(page);
    const aged = await ageDraftAndReopen(page, { origin: "settings", markPreview: true });
    await assertPrimaryRebuildRole(page, route);
    const shown = await entry(page);
    assert.equal(shown.result.name, STALE_NAME, `${route}: the stale preview is held until the rebuild`);
    await page.click("#entryRebuildRules");
    await page.waitForFunction(() => !document.querySelector("#entryRebuildRules"), undefined, { timeout: 15000 });
    const after = await entry(page);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).state, DRAFT);
    const request = Adapter.programRequestFromAnswers(aged.answers, Catalog);
    const expected = Compiler.generateProgram(request.value, Catalog);
    assert.ok(expected.ok, `${route}: the saved answers still generate a program`);
    assert.notEqual(after.result.name, STALE_NAME, `${route}: the rebuild replaces the stale preview`);
    assert.deepEqual(after.result.preview.programDefinition, expected.value,
      `${route}: the replacement is the current generator's program for the saved canonical answers`);
    assert.equal(saved.versions.rules, current.rules, `${route}: the saved draft records the current rules`);
    assert.deepEqual(saved.result.preview.programDefinition, expected.value, `${route}: the replacement is what the draft saved`);
    await context.close();
  }

  // A failed regeneration keeps the old preview and stays recoverable --------
  {
    const { context, page } = await freshPage({ program: true });
    await openHub(page);
    await walkGenerate(page);
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

  // The removed hub door does not retire a saved Custom draft during its
  // approved one-release resume window. Reopen its persisted route and finish
  // through the real production compiler and activation path.
  {
    const { context, page } = await freshPage();
    const seeded = await seedLegacyCustomDraft(page, current);
    assert.equal(seeded.persisted?.ok, true, "the legacy Custom draft is saved through the production draft writer");
    assert.equal(seeded.route, "custom");
    assert.equal(seeded.step, "exercise_preferences");
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await page.waitForSelector("#firstRun:not(.hidden) #firstRunCreate[data-entry-resume='custom']", { timeout: 15000 });
    await page.click("#firstRunCreate");
    await page.waitForSelector("#onboarding.active #entryResumeContinue", { timeout: 15000 });
    assert.equal(await page.locator('[data-entry-hub="custom"]').count(), 0,
      "the saved Custom route resumes without restoring a Custom hub door");
    await page.click("#entryResumeContinue");
    await page.waitForFunction(() => window.__repforgeEntryState?.()?.route === "custom" &&
      window.__repforgeEntryState()?.step === "exercise_preferences", undefined, { timeout: 10000 });
    const resumed = await entry(page);
    assert.equal(resumed.route, "custom", "the resume card keeps the saved Custom route");
    assert.equal(resumed.step, "exercise_preferences", "the resume card returns to the saved Custom question");
    await page.click("#onbNext");
    await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "custom_shape", undefined, { timeout: 10000 });
    assert.equal(await page.locator('#onbBody [data-entry-pick="splitPreference"]:not([aria-hidden="true"] *)[aria-checked="true"]').getAttribute("data-entry-val"),
      "upper_lower_upper_lower", "the resumed four-day route offers split choice with the canonical default selected");
    await page.click("#onbNext");
    await page.waitForFunction(() => window.__repforgeEntryState?.()?.route === "custom" &&
      window.__repforgeEntryState()?.step === "result" && !!window.__repforgeEntryState()?.result?.preview?.programDefinition,
    undefined, { timeout: 20000 });
    const ready = await entry(page);
    await page.waitForSelector("#entryActivate:not([disabled])", { timeout: 15000 });
    await page.click("#entryActivate");
    await page.waitForFunction(() => !document.querySelector("#onboarding")?.classList.contains("active"), undefined, { timeout: 15000 });
    await page.evaluate(() => window.__repforgeStorage?.flush?.());
    const activated = await sharedDurableSnapshot(page);
    assert.equal(activated.local?.programMeta?.onboarded, true, "the resumed Custom route finishes onboarding");
    assert.ok(activated.local?.program?.length > 0, "the resumed Custom result activates a program");
    assert.ok(sameValue(activated.local?.programMeta?.programDefinition, ready.result.preview.programDefinition),
      "activation preserves the generated Custom definition");
    assert.ok(sameValue(activated.idb?.programMeta?.programDefinition, ready.result.preview.programDefinition),
      "the resumed Custom definition is mirrored to IndexedDB");
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

  // Import keeps its validated snapshot after explicit acceptance. It is
  // durable by design and must remain recoverable across a reload.
  {
    const route = "import";
    const walk = walkImport;
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

  // Shared setup is the explicitly encoded handoff, not a durable route draft.
  // Recover it after reload from the authorized cookie, then View and activate.
  {
    const { context, page } = await freshPage();
    await walkSharedAfterHandoffReload(page, context);
    await context.close();
  }

  assert.deepEqual(errors, [], "no uncaught page errors");
  console.log("program-entry route rules recovery: all assertions passed");
} finally {
  await browser.close();
}
