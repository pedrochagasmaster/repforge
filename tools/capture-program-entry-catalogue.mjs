#!/usr/bin/env node
/**
 * Capture the explicit Plan 048 program-entry evidence list with production UI.
 *
 * This script reads the reviewed manifest, drives the real entry controls, and
 * writes only the declared PNG paths. Service workers are blocked in each
 * isolated context so a previous shell cannot serve stale application code.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { launchChromium } from "../test/browser.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = JSON.parse(readFileSync(join(ROOT, "docs", "ui-screens", "program-entry-manifest.json"), "utf8"));
const ARTIFACT_ROOT = join(ROOT, MANIFEST.artifactRoot);
const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const CAPTURE_FILTER = process.env.CAPTURE_FILTER || "";
const KEY = "repforge_v1";
const DRAFT = "repforge_program_setup_draft_v1";
const waitForEntryApp = (page) => page.waitForFunction(
  () => typeof window.__repforgeStorage?.flush === "function" && typeof window.__repforgeUi?.setTheme === "function",
  undefined, { timeout: 20000 }
);

const emptyState = (lang = "en") => ({
  settings: { jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120, unit: "kg", lang, rirMode: "numeric", voiceInputEnabled: false,
    notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true } },
  programMeta: { id: "", name: "", started: null, created: null, updated: null, onboarded: false, mesocycleStatus: "active", mesocycleLengthWeeks: 6,
    goal: null, experience: null, daysPerWeek: null, splitType: null, equipment: [], priorityMuscles: [], sessionLength: null, completedAt: null,
    progressionRelations: [], progressionModifiers: [], progressionIncompatibilities: [], programStructure: null, entrySource: null },
  program: [], log: [], programHistory: [], customExercises: [], _storageRevision: 0,
});

const activeState = (lang = "en") => ({
  ...emptyState(lang),
  programMeta: { ...emptyState(lang).programMeta, id: "catalog-active", name: "Current program", started: "2026-08-01", created: "2026-08-01T00:00:00.000Z", updated: "2026-08-01T00:00:00.000Z", onboarded: true, daysPerWeek: 3, splitType: "full_body", equipment: ["machines"], goal: "hypertrophy", experience: "intermediate", sessionLength: "60" },
  program: [{ id: "catalog-active-1", day: "Day 1", order: 1, name: "Cable row", sets: 3, min: 8, max: 12, primary: "Back", secondary: "Biceps", notes: "", libraryId: "row_cable" }],
  _storageRevision: 3,
});

async function seed(page, state) {
  await page.evaluate(async ({ key, draft, state }) => {
    localStorage.removeItem(draft);
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase("repforge");
      request.onsuccess = resolve; request.onerror = resolve; request.onblocked = resolve;
    });
    localStorage.setItem(key, JSON.stringify(state));
    await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(state, key);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  }, { key: KEY, draft: DRAFT, state });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForEntryApp(page);
}

async function openPage(browser, capture, state) {
  const viewport = MANIFEST.viewports[capture.viewport];
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: MANIFEST.deviceScaleFactor,
    colorScheme: capture.theme === "dark" ? "dark" : "light",
    reducedMotion: capture.motion === "reduced" ? "reduce" : "no-preference",
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForEntryApp(page);
  await seed(page, state);
  await page.evaluate(({ theme, scale }) => {
    window.__repforgeUi.setTheme(theme);
    if (scale !== 1) document.documentElement.style.fontSize = `${scale * 100}%`;
  }, { theme: capture.theme, scale: MANIFEST.textScales[capture.text].rootFontScale });
  await page.waitForTimeout(180);
  return { context, page };
}

async function create(page, route, existing = false) {
  if (existing) await page.evaluate(() => window.startOnboarding("settings"));
  else { await page.evaluate(() => window.openFirstRun()); await page.click("#firstRunCreate"); }
  if (route === "build" || route === "import") await page.click("#entryOwnToggle");
  await page.click(`[data-entry-route="${route}"]`);
}
const pick = (page, key, value) => page.click(`[data-entry-pick="${key}"][data-entry-val="${value}"]`);
const next = (page) => page.click("#onbNext");

async function recommendTo(page, { result = false, existing = false, desired = "muscle_growth" } = {}) {
  await create(page, "recommend", existing);
  await pick(page, "desiredResult", desired); await next(page);
  await pick(page, "structuredExperience", "6_to_24m"); await pick(page, "recentConsistency", "most"); await next(page);
  await pick(page, "daysPerWeek", "3"); await pick(page, "sessionMinutes", "60"); await pick(page, "preferredRestSeconds", "120"); await next(page);
  await pick(page, "environment", "commercial_gym"); await next(page);
  if (result) { await next(page); await page.waitForSelector("[data-entry-select-candidate], #entryActivate", { timeout: 10000 }); }
}

async function customToSplit(page) {
  await create(page, "custom");
  await pick(page, "desiredResult", "balanced"); await next(page);
  await pick(page, "structuredExperience", "6_to_24m"); await pick(page, "recentConsistency", "most"); await next(page);
  await pick(page, "daysPerWeek", "4"); await pick(page, "sessionMinutes", "60"); await pick(page, "preferredRestSeconds", "auto"); await next(page);
  await pick(page, "environment", "commercial_gym"); await next(page); await next(page);
  await page.waitForSelector('[data-entry-pick="splitPreference"]');
}

async function browse(page) {
  await create(page, "browse");
  await pick(page, "daysPerWeek", "4"); await pick(page, "sessionMinutes", "60"); await next(page);
  await pick(page, "environment", "commercial_gym"); await next(page);
  await page.waitForSelector("[data-entry-catalogue]", { timeout: 10000 });
}

async function build(page, mode) {
  await create(page, "build");
  await page.fill("#entryProgramName", "Manual catalog program");
  await pick(page, "daysPerWeek", "3"); await next(page);
  await page.waitForSelector("#programEditor .pday", { timeout: 10000 });
  if (mode === "partial" || mode === "ready") {
    await page.locator('#programEditor [data-act="addEx"]').first().click();
    await page.waitForSelector("#exPickList .pickrow", { timeout: 5000 });
    await page.locator("#exPickList .pickrow").first().click();
    await page.waitForTimeout(220);
  }
  if (mode === "ready") {
    for (let i = 1; i < 3; i++) {
      await page.locator('#programEditor [data-act="addEx"]').nth(i).click();
      await page.waitForSelector("#exPickList .pickrow", { timeout: 5000 });
      await page.locator("#exPickList .pickrow").first().click();
      await page.waitForTimeout(220);
    }
    await page.waitForFunction(() => !document.querySelector("#entryEditorActivate")?.disabled, undefined, { timeout: 8000 });
  }
}

async function importSource(page, review = false) {
  await create(page, "import");
  if (!review) return;
  const portuguese = await page.evaluate(() => document.documentElement.lang === "pt-BR");
  await page.setInputFiles("#importProgram", { name: "catalog-program.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ meta: { name: portuguese ? "Programa de catálogo importado" : "Imported catalog program" }, exercises: [{ id: "bench", day: portuguese ? "Dia 1" : "Day 1", name: portuguese ? "Supino reto com barra" : "Barbell bench press", sets: 3, repLow: 6, repHigh: 10, muscles: [portuguese ? "Peito" : "Chest"] }] })) });
  await page.waitForSelector("#importReview.active", { timeout: 10000 });
  if (await page.locator("#importCommit").isDisabled()) {
    const raw = page.locator('[data-imp-act="raw"]').first();
    if (await raw.count()) await raw.click();
    else await page.locator('[data-imp-act="link"]').first().click();
  }
  await page.click("#importCommit");
  await page.waitForSelector("#onboarding.active #entryActivate", { timeout: 10000 });
}

async function rulesDrift(page) {
  await page.evaluate(({ key, draft }) => {
    const activeRevision = JSON.parse(localStorage.getItem(key))._storageRevision;
    const Entry = window.RepForgeProgramEntry;
    const versions = window.RepForgeProgramCompiler.VERSIONS;
    let state = Entry.createState({ draftId: "catalog-rules", activeProgramRevisionAtStart: activeRevision, now: new Date().toISOString(), versions: { compiler: String(versions.compiler), family: String(versions.schema), blueprint: String(versions.blueprint), catalogue: String(versions.catalogue), rules: "old-rules", context: String(versions.context), progression: "range-1" } });
    state = Entry.selectRoute(state, "recommend");
    state = Entry.setAnswers(state, { desiredResult: "muscle_growth" });
    localStorage.setItem(draft, JSON.stringify({ schemaVersion: 1, draftId: state.draftId, revision: 1, ownerId: "catalog-rules", state }));
  }, { key: KEY, draft: DRAFT });
  await page.reload({ waitUntil: "domcontentloaded" }); await waitForEntryApp(page);
  await page.evaluate(() => window.startOnboarding("settings"));
  await page.waitForSelector("#entryRebuildRules", { timeout: 5000 });
}

async function conflict(page) {
  await recommendTo(page, { result: true, existing: true });
  if (await page.locator("[data-entry-select-candidate]").count()) await page.locator("[data-entry-select-candidate]").first().click();
  await page.waitForSelector("#entryActivate", { timeout: 10000 });
  const newer = await page.evaluate((key) => { const state = JSON.parse(localStorage.getItem(key)); state._storageRevision += 1; state.programMeta.name = "Newer active program"; return state; }, KEY);
  const other = await page.context().newPage();
  await other.goto(BASE, { waitUntil: "domcontentloaded" }); await waitForEntryApp(other);
  await other.evaluate(({ key, state }) => new Promise((resolve, reject) => {
    localStorage.setItem(key, JSON.stringify(state));
    const request = indexedDB.open("repforge", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { const tx = request.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(state, key); tx.oncomplete = () => { request.result.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
  }), { key: KEY, state: newer });
  await other.close();
  await page.reload({ waitUntil: "domcontentloaded" }); await waitForEntryApp(page); await page.evaluate(() => window.startOnboarding("settings"));
  if (await page.locator("#entryResumeContinue").isVisible().catch(() => false)) await page.click("#entryResumeContinue");
  await page.waitForSelector("#entryActivate", { timeout: 10000 });
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.click("#entryActivate");
  await page.waitForSelector(".entry__notice[role=alert]", { timeout: 10000 });
  const step = await page.evaluate(() => window.__repforgeEntryState?.()?.step);
  if (step !== "activation_conflict") throw new Error(`activation conflict did not enter activation_conflict (step=${step || "unknown"})`);
}

async function captureState(page, state) {
  if (state === "hub") { await page.evaluate(() => window.openFirstRun()); return page.click("#firstRunCreate"); }
  if (state === "recommend-desired-result") return create(page, "recommend");
  if (state === "recommend-background") { await create(page, "recommend"); await pick(page, "desiredResult", "muscle_growth"); return next(page); }
  if (state === "recommend-schedule") { await create(page, "recommend"); await pick(page, "desiredResult", "muscle_growth"); await next(page); await pick(page, "structuredExperience", "6_to_24m"); await pick(page, "recentConsistency", "most"); return next(page); }
  if (state === "recommend-environment" || state === "recommend-environment-correction") { await create(page, "recommend"); await pick(page, "desiredResult", "muscle_growth"); await next(page); await pick(page, "structuredExperience", "6_to_24m"); await pick(page, "recentConsistency", "most"); await next(page); await pick(page, "daysPerWeek", "3"); await pick(page, "sessionMinutes", "60"); await pick(page, "preferredRestSeconds", "120"); await next(page); await pick(page, "environment", "commercial_gym"); if (state.endsWith("correction")) return page.locator(".entry__correct > summary").click(); return; }
  if (state === "recommend-priorities" || state === "recommend-avoidance-pain") { await recommendTo(page); if (state.endsWith("pain")) { const search = page.locator("#entryAvoidSearch"); await search.fill("bench"); await page.waitForTimeout(100); if (!(await page.locator("[data-entry-avoid-add]").count())) { await search.fill("supino"); await page.waitForTimeout(100); } await page.locator("[data-entry-avoid-add]").first().click(); await page.click('[data-entry-pick="avoidReason"][data-entry-val$="|pain"]'); } return; }
  if (state === "recommend-result" || state === "recommend-alternative") return recommendTo(page, { result: true, desired: "balanced" });
  if (state === "custom-split") return customToSplit(page);
  if (state === "browse-catalogue") return browse(page);
  if (state === "review-first-run") { await recommendTo(page, { result: true }); if (await page.locator("[data-entry-select-candidate]").count()) await page.locator("[data-entry-select-candidate]").first().click(); return page.waitForSelector("#entryActivate"); }
  if (state === "review-existing" || state === "replacement-confirm") { await recommendTo(page, { result: true, existing: true }); if (await page.locator("[data-entry-select-candidate]").count()) await page.locator("[data-entry-select-candidate]").first().click(); return page.waitForSelector("#entryActivate"); }
  if (state.startsWith("build-")) return build(page, state.slice(6));
  if (state === "import-source") return importSource(page);
  if (state === "import-review") return importSource(page, true);
  if (state === "resume") { await recommendTo(page); await page.reload({ waitUntil: "domcontentloaded" }); await waitForEntryApp(page); if (await page.locator("#firstRunCreate").isVisible().catch(() => false)) await page.click("#firstRunCreate"); else await page.evaluate(() => window.startOnboarding("settings")); return page.waitForSelector("#entryResumeContinue"); }
  if (state === "rules-drift") return rulesDrift(page);
  if (state === "activation-conflict") return conflict(page);
  if (state === "validation-failure") {
    await create(page, "recommend");
    await next(page);
    return page.waitForSelector("#entryValidation", { timeout: 5000 });
  }
  throw new Error(`no production capture scenario for ${state}`);
}

function pathFor(capture, artifactRoot = ARTIFACT_ROOT) {
  let path = MANIFEST.artifactTemplate;
  for (const [key, value] of Object.entries(capture)) path = path.replaceAll(`{${key}}`, value);
  return join(artifactRoot, path);
}

function replaceCatalogue(stagingRoot, targetRoot, operations = {}) {
  const exists = operations.exists || existsSync;
  const rename = operations.rename || renameSync;
  const remove = operations.remove || rmSync;
  const backupRoot = `${targetRoot}.backup-${basename(stagingRoot)}`;
  let movedExisting = false;
  let installed = false;
  try {
    if (exists(targetRoot)) {
      rename(targetRoot, backupRoot);
      movedExisting = true;
    }
    rename(stagingRoot, targetRoot);
    installed = true;
    if (movedExisting) remove(backupRoot, { recursive: true, force: true });
  } catch (error) {
    if (installed && exists(targetRoot)) remove(targetRoot, { recursive: true, force: true });
    if (movedExisting && exists(backupRoot)) rename(backupRoot, targetRoot);
    throw error;
  }
}

async function main() {
  const stagingRoot = mkdtempSync(join(tmpdir(), "repforge-program-entry-capture-"));
  const captures = MANIFEST.captures.filter((item) => !CAPTURE_FILTER || item.state === CAPTURE_FILTER);
  let browser;
  const failures = [];
  try {
    // A filtered rerun is merged into a private copy so the final directory is
    // still complete. An unfiltered run starts clean, but neither mode touches
    // committed evidence until every requested capture has succeeded.
    if (CAPTURE_FILTER && existsSync(ARTIFACT_ROOT)) cpSync(ARTIFACT_ROOT, stagingRoot, { recursive: true });
    browser = await launchChromium();
    for (const capture of captures) {
      const state = MANIFEST.states.find((item) => item.id === capture.state);
      const out = pathFor(capture, stagingRoot); mkdirSync(dirname(out), { recursive: true });
      let context;
      try {
        const opened = await openPage(browser, capture, capture.state.includes("review-existing") || capture.state === "replacement-confirm" || capture.state === "activation-conflict" || capture.state === "rules-drift" ? activeState(capture.locale === "pt-BR" ? "pt" : "en") : emptyState(capture.locale === "pt-BR" ? "pt" : "en"));
        context = opened.context;
        await captureState(opened.page, capture.state);
        await opened.page.evaluate((state) => {
          document.documentElement.scrollTop = 0; document.body.scrollTop = 0; window.scrollTo(0, 0);
          const target = state.includes("pain") ? document.querySelector(".entry__pain") :
            state === "build-ready" ? document.querySelector("#entryEditorActivate") :
            state === "activation-conflict" ? document.querySelector(".entry__notice") : null;
          target?.scrollIntoView({ block: "center", inline: "nearest" });
        }, capture.state);
        await opened.page.waitForTimeout(capture.state.startsWith("build-") ? 2200 : 220);
        await opened.page.screenshot({ path: out, fullPage: false });
        console.log(`✓ ${capture.state} ${capture.locale}/${capture.theme}/${capture.viewport}/${capture.text}/${capture.motion}`);
      } catch (error) {
        const contextText = process.env.CAPTURE_DEBUG && context ? await context.pages()[0]?.locator("body").innerText().catch(() => "") : "";
        failures.push({ state: capture.state, path: out, error: `${error.message.split("\n")[0]}${contextText ? ` [${contextText.slice(0, 160).replace(/\s+/g, " ")}]` : ""}` });
        console.warn(`✗ ${state.label}: ${error.message.split("\n")[0]}`);
      } finally { await context?.close(); }
    }
    const missing = MANIFEST.captures.filter((capture) => !existsSync(pathFor(capture, stagingRoot)));
    if (missing.length) failures.push(...missing.map((capture) => ({ state: capture.state, path: pathFor(capture, stagingRoot), error: "capture output missing" })));
    if (failures.length) {
      console.warn(`\n${failures.length} capture(s) failed; committed catalogue was left untouched:`);
      for (const failure of failures) console.warn(`  - ${failure.state}: ${failure.error}`);
      return 1;
    }
    replaceCatalogue(stagingRoot, ARTIFACT_ROOT);
    console.log(`Committed ${MANIFEST.captures.length} program-entry captures atomically.`);
    return 0;
  } finally {
    await browser?.close();
    if (existsSync(stagingRoot)) rmSync(stagingRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exitCode = await main();

export { replaceCatalogue };
