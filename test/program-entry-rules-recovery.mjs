#!/usr/bin/env node
/** Route-owned recovery proof for stale setup drafts. */
import assert from "node:assert/strict";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_program_setup_draft_v1";
const ACTIVE = {
  settings: { unit: "kg", lang: "en", jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120 },
  programMeta: { id: "rules-active", name: "Current block", started: "2026-08-01", onboarded: true, daysPerWeek: 2, mesocycleLengthWeeks: 6, mesocycleStatus: "active" },
  program: [{ id: "active-row", day: "Day 1", order: 1, name: "Active row", sets: 2, min: 8, max: 12, libraryId: "rw_bb" }],
  log: [], programHistory: [], customExercises: [], _storageRevision: 2,
};

function resultFixture(route, selectedId = `${route}-old`) {
  const first = { id: `${route}-row-1`, day: "Day 1", order: 1, name: "Saved row", sets: 3, min: 8, max: 12 };
  const second = { id: `${route}-row-2`, day: "Day 2", order: 1, name: "Saved press", sets: 3, min: 6, max: 10 };
  const days = route === "build"
    ? [{ dayId: "manual_d1", label: "Day 1", exercises: [first] }, { dayId: "manual_d2", label: "Day 2", exercises: [second] }]
    : [{ dayId: `${route}-d1`, label: "Day 1", exercises: [first] }];
  const preview = {
    source: route === "shared" ? "shared" : route === "import" ? "import" : "compiler",
    familyId: route === "build" ? null : "balanced", frequency: route === "build" ? 2 : 3,
    program: route === "build" ? [first, second] : [first],
    programStructure: { schemaVersion: 1, days: days.map((day, index) => ({ dayId: day.dayId, label: day.label, order: index + 1 })) },
    days: days.map((day) => ({ ...day, exercises: day.exercises.map((exercise) => ({ ...exercise })) })),
  };
  if (route === "shared") preview.sharedMeta = { name: "Shared old", daysPerWeek: 3 };
  const selected = { id: selectedId, source: route };
  const result = {
    fingerprint: `${route}-old-fingerprint`, name: `${route} old`, namePt: `${route} old`,
    selected, preview,
  };
  if (route === "recommend" || route === "custom") {
    result.candidates = [{ ...selected }];
    result.alternative = null;
    result.explanation = { familyId: "balanced" };
    result.telemetry = { family: `${route}_v1` };
  } else if (route === "browse" || route === "shared") {
    result.telemetry = { family: `${route}_v1` };
  }
  return result;
}

const browser = await launchChromium();
const context = await browser.newContext();
const page = await context.newPage();
page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
try {
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });

  async function stage(route, result = resultFixture(route)) {
    await page.evaluate(({ key, state }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(state));
    }, { key: KEY, state: ACTIVE });
    await page.evaluate(({ key }) => localStorage.removeItem(key), DRAFT);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await page.evaluate(({ key, route, result }) => {
      const Entry = window.RepForgeProgramEntry;
      const versions = window.RepForgeProgramCompiler.VERSIONS;
      let state = Entry.createState({
        draftId: `${route}-rules-draft`,
        activeProgramRevisionAtStart: Number(JSON.parse(localStorage.getItem("repforge_v1") || "{}")._storageRevision || 0),
        now: "2026-08-30T12:00:00.000Z",
        versions: {
          compiler: String(versions.compiler), family: String(versions.schema),
          blueprint: String(versions.blueprint), catalogue: String(versions.catalogue),
          rules: "old-rules", context: String(versions.context),
          progression: "range-1", recentConsistency: "1", simpleStart: "1",
        },
      });
      state = Entry.selectRoute(state, route);
      const answers = route === "build"
        ? { programName: "Saved build", daysPerWeek: 2 }
        : route === "import"
          ? { importReady: true }
          : route === "shared"
            ? { sharedReady: true }
            : route === "browse"
              ? { structuredExperience: "6_to_24m", daysPerWeek: 3, sessionMinutes: 60, environment: { kind: "commercial_gym" }, catalogueSelection: "browse-card" }
              : { desiredResult: "balanced", structuredExperience: "6_to_24m", recentConsistency: "most", daysPerWeek: 3, sessionMinutes: 60, preferredRestSeconds: 120, environment: { kind: "commercial_gym" }, primaryMuscles: [], ...(route === "custom" ? { splitPreference: "upper_lower" } : {}) };
      state = Entry.setAnswers(state, answers);
      state = Entry.setResult(state, result);
      state = { ...state, step: route === "build" ? "editor" : "preview" };
      localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, draftId: state.draftId, revision: 1, ownerId: "rules-test", state }));
    }, { key: DRAFT, route, result });
    await page.evaluate((currentResult) => {
      window.__rulesRecoveryCurrentResult = currentResult;
      window.__rulesRecoveryCalls = [];
      window.__rulesRecoveryBrowseCards = [];
      window.__repforgeProgramEntryServicesOverride = {
        currentVersions: () => window.RepForgeProgramEntryAdapter.currentVersions(window.RepForgeProgramCompiler),
        compile: ({ mode }) => {
          window.__rulesRecoveryCalls.push(`compile:${mode}`);
          const replacement = structuredClone(window.__rulesRecoveryCurrentResult);
          replacement.fingerprint = `current-${mode}`;
          replacement.name = `Current ${mode}`;
          return { ok: true, ...replacement };
        },
        browseCatalogue: () => window.__rulesRecoveryBrowseCards,
      };
    }, resultFixture(route));
    await page.evaluate(() => window.startOnboarding("settings"));
    await page.waitForSelector("#onbBody");
  }

  for (const route of ["recommend", "custom"]) {
    await stage(route);
    const before = await page.evaluate(() => structuredClone(window.__repforgeEntryState().result));
    await page.click("#entryRebuildRules");
    await page.waitForFunction(() => window.__repforgeEntryState().result?.fingerprint?.startsWith("current-"), undefined, { timeout: 5000 });
    const after = await page.evaluate(() => ({ result: structuredClone(window.__repforgeEntryState().result), calls: window.__rulesRecoveryCalls, body: document.querySelector("#onbBody")?.innerText || "" }));
    assert.equal(after.calls.filter((call) => call === `compile:${route}`).length, 1, `${route} recovery calls its generator`);
    assert.notEqual(after.result.fingerprint, before.fingerprint, `${route} replaces only after a candidate exists`);
  }

  await stage("recommend");
  await page.evaluate(() => {
    window.__repforgeProgramEntryServicesOverride.compile = () => ({ ok: false, code: "rebuild_failed" });
  });
  const failedBefore = await page.evaluate(() => structuredClone(window.__repforgeEntryState().result));
  await page.click("#entryRebuildRules");
  await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(() => window.__repforgeEntryState().result), failedBefore, "failed generator recovery preserves the old preview");
  assert.equal(await page.locator("#entryRebuildRules").count(), 1, "failed generator recovery remains recoverable");

  await stage("browse");
  await page.click("#entryRebuildRules");
  await page.waitForTimeout(100);
  const missing = await page.evaluate(() => ({ step: window.__repforgeEntryState().step, result: structuredClone(window.__repforgeEntryState().result), calls: window.__rulesRecoveryCalls }));
  assert.equal(missing.step, "catalogue", "Browse returns to the current catalogue when its card is gone");
  assert.ok(missing.result?.preview?.program?.length, "Browse preserves the old preview while returning to the catalogue");
  assert.equal(missing.calls.some((call) => call.startsWith("compile:")), false, "Browse recovery never invokes the generator");

  await stage("build");
  const buildBefore = await page.evaluate(() => structuredClone(window.__repforgeEntryState().result));
  await page.click("#entryRebuildRules");
  await page.waitForTimeout(100);
  const buildAfter = await page.evaluate(() => ({ result: structuredClone(window.__repforgeEntryState().result), editor: document.body.classList.contains("is-entry-editor") }));
  assert.deepEqual(buildAfter.result, buildBefore, "Build preserves its editable candidate");
  assert.equal(buildAfter.editor, true, "Build recovery opens the editor");

  for (const route of ["import", "shared"]) {
    await stage(route);
    assert.equal(await page.locator("#entryKeepPinned").count(), 1, `${route} exposes explicit pinned acceptance`);
    const before = await page.evaluate(() => structuredClone(window.__repforgeEntryState().result));
    await page.click("#entryKeepPinned");
    await page.waitForTimeout(100);
    const after = await page.evaluate(() => ({ result: structuredClone(window.__repforgeEntryState().result), notice: !!document.querySelector("#entryKeepPinned, #entryRebuildRules") }));
    assert.deepEqual(after.result, before, `${route} preserves the validated snapshot`);
    assert.equal(after.notice, false, `${route} removes the rules notice only after acceptance`);
  }

  console.log("program-entry route rules recovery: all assertions passed");
} finally {
  await context.close();
  await browser.close();
}
