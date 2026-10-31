#!/usr/bin/env node
/**
 * Public landing: the five shared/standard/install variants, characterized, plus
 * the failing contract for the final page's new sections (Plan 064 R2a-A).
 *
 * PART 1 - characterization (always on, green at base, must keep passing when the
 * page is rebuilt). It pins only what the lifter and the confirmation gate depend
 * on, through production IDs, and reads every expected string from the i18n
 * catalogs so a copy change cannot break it. No composition selector appears
 * here (no hero figure, no stage, no beat): the page layout is free to change.
 *
 *   V1  standard         generic landing: headline, lede, Build (#firstRunCreate),
 *                        Track (#firstRunImport), Privacy link and sheet, the
 *                        one-time seen-state, no install offer when none exists
 *   V2  install, iOS Safari      card + install action + instruction sheet + Continue
 *   V3  install, other iOS       explanatory card, no action it cannot honour
 *   V4  shared, valid link       the confirmation gate: one Start, no Build/Track,
 *                        zero storage change and no setup draft before Start
 *   V5  shared, invalid link     fail-closed landing with the specific reason
 *
 * Proof-first fault switch for the V4 no-persist oracle:
 *   REPFORGE_LANDING_VARIANTS_FAULT=persist-shared
 * writes a setup draft before the oracle runs; the suite must then FAIL, proving
 * the oracle bites (same idea as REPFORGE_ENTRY_LANDING_FAULT in entry-landing.mjs).
 *
 * Also always on, and Node-only: the engine-truth oracle. The proof's case is
 * evaluated here with the adaptive engine (progression-engine.js recommendSets)
 * and the app's default load step, and the load must move the way chapter 4 says.
 *
 * PART 2 - the final page (always on since the page packet landed). It asserts
 * that each section exists, that the proof has four chapters and shows the
 * oracle's numbers, that the feature tabs are five and name the library's real
 * size (test/landing-features.mjs owns their frames), that the FAQ has five
 * <details>, that the persistent Build dock exists on the standard landing but
 * never on the shared-link gate, and that the proof's player plays only while it
 * is on screen and the page is visible, jumps by chapter, shows stills under
 * reduced motion, fits a phone's viewport with its chapters, and mounts and
 * disposes with the gate (nothing it starts outlives the landing).
 *
 * Hooks PART 2 reads (all inside #firstRun):
 *   [data-landing-section="hero|proof|ways|features|data|faq|close|footer"]
 *   [data-landing-chapter]         x4 in the proof section, in order, each a
 *                                  [data-chapter] button and its caption; the last
 *                                  caption is the result
 *   [data-feature]                 x5 tabs in the features section
 *   details.faq                    x5 in the faq section
 *   #firstRunCreateDock            the persistent Build control; absent on the
 *                                  valid shared-link gate
 *   window.__repforgeLandingProof()  what the open landing's controller holds
 *   window.__repforgeLandingSeek(t)  holds the proof's timeline at t seconds (null runs it)
 *
 * Run: node test/landing-variants.mjs   (with a static server on REPFORGE_URL)
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { isDeepStrictEqual } from "node:util";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { encodeSetupLink } from "./fixtures/setup-link-v4.mjs";
import {
  APP_INDEX,
  openAppPage,
  sharedGateSnapshot,
  waitForFirstRun,
} from "./shared-setup-flow.mjs";
import { webpSize } from "../tools/capture-landing-proof.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const FAULT = process.env.REPFORGE_LANDING_VARIANTS_FAULT;
const require = createRequire(import.meta.url);

const KEY = "repforge_v1";
const SETUP_DRAFT = "repforge_program_setup_draft_v1";
const WORKOUT_DRAFT = "repforge_draft_v1";
const UIKEY = "repforge_ui_v1";
const COOKIE = "repforge_setup_v1";

const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IOS_CHROME_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const LOCALE = { en: "en-US", pt: "pt-BR" };

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    console.log(`  ✗ ${name}`);
    if (detail != null) console.log(`    ${detail}`);
  }
}
const phase = (title) => console.log(`\n${title}`);

// ---------------------------------------------------------------------------
// Catalog access: every expected string comes from the shipped catalogs.
// ---------------------------------------------------------------------------
const CATALOG = {
  en: JSON.parse(readFileSync(new URL("../i18n-en.json", import.meta.url), "utf8")),
  pt: JSON.parse(readFileSync(new URL("../i18n-pt.json", import.meta.url), "utf8")),
};
function tr(lang, key, vars = {}) {
  const value = CATALOG[lang][key];
  if (typeof value !== "string") throw new Error(`catalog ${lang} has no string for ${key}`);
  return value.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole));
}
const squash = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A catalog template as a regex: placeholders match any non-empty text. */
function templateRe(lang, key) {
  const source = CATALOG[lang][key].split(/\{\w+\}/).map(escapeRe).join(".+");
  return new RegExp(`^${source}$`);
}

// ---------------------------------------------------------------------------
// Engine-truth oracle (Node only). The proof's case goes through the adaptive
// engine (recommendSets) exactly as the landing states them: one logged
// session of external-load barbell sets, the app's default load step as the
// gym's plate grid, a 1-RIR target and the catalog movement's own metrics.
// The numbers are whatever the engine says.
// ---------------------------------------------------------------------------
const Engine = require("../progression-engine.js");
const Compiler = require("../program-compiler.js");
const Catalog = require("../assets/exercise-catalog.json");
const { EXERCISE_LIBRARY } = require("../exercises.js");
const LIBRARY_SIZE = EXERCISE_LIBRARY.length;
const APP_SOURCE = readFileSync(new URL("../app.js", import.meta.url), "latin1");
const APP_DEFAULTS = (() => {
  const match = /const DEFAULTS=(\{[^\n]*?\});\n/.exec(APP_SOURCE);
  if (!match) throw new Error("app.js DEFAULTS literal not found");
  return new Function(`"use strict";return (${match[1]});`)();
})();

/**
 * The input of the proof's case and the move chapter 4 claims: the load goes up.
 */
const BENCH = "19f5c6f170d8808bb424e98de4472a7e";
const LANDING_CASES = Object.freeze({
  add: { exercise: BENCH, repMin: 8, repMax: 10, logged: [[60, 10, 2], [60, 10, 2], [60, 10, 2]], move: "up" },
});
const SETS = 3;
const TARGET_RIR = 1;

function loadStep() {
  const raw = +APP_DEFAULTS.minJump;
  return Number.isFinite(raw) && raw > 0 ? raw : 2.5;
}
function metricDefinitions(exercise) {
  return exercise.exerciseMetrics.map((id) => {
    const source = Catalog.uuidIndex[id];
    const mapped = source?.type === "exerciseMetric" ? Compiler.metricDefinitionForName(source.name) : null;
    return mapped ? { id, sourceName: source.name, semantic: mapped.semantic, unit: mapped.unit } : null;
  }).filter(Boolean);
}
function runEngineCase(c) {
  const exercise = Catalog.exercises.find((entry) => entry.id === c.exercise);
  if (!exercise) throw new Error(`landing case movement ${c.exercise} is not in the catalog`);
  const definitions = metricDefinitions(exercise);
  const slotId = `landing:${c.exercise}`, equipmentId = "landing-demo-barbell";
  const loading = { loadingConvention: "external", bodyweightContributionEnabled: false, bodyweightKg: null, externalLoadMultiplier: 1 };
  const prescription = { id: `${slotId}:cycle-1:set-1`, slotId, exerciseId: c.exercise, setIndex: 1,
    metricType: "source_metrics@1", metricIds: [...exercise.exerciseMetrics], metricDefinitions: definitions,
    targets: { reps: { min: c.repMin, max: c.repMax } }, rir: TARGET_RIR, status: "ready", loadingModel: { bodyweightCoefficient: 0 } };
  const sets = c.logged.map(([load, reps, rir], setIndex) => ({ exerciseId: c.exercise, completed: true, setIndex, rir, equipmentId,
    loadingConvention: "external", metricIds: [...exercise.exerciseMetrics],
    metricValues: definitions.map((d) => ({ metricId: d.id, value: d.semantic === "loadKg" ? load : d.semantic === "reps" ? reps : null, unit: d.unit })),
    loadingContext: { ...loading, bodyweightCoefficient: 0 } }));
  const step = loadStep();
  const maxLoad = Math.max(...c.logged.map(([load]) => load)) + step * 12;
  const availableLoadsKg = Array.from({ length: Math.ceil(maxLoad / step) + 1 }, (_, index) => index * step);
  const [result] = Engine.recommendSets([prescription], [{ sessionId: `${slotId}:history`, completed: true, sets }], [],
    { bySlotId: { [slotId]: { equipmentId, availableLoadsKg, ...loading } } }, { weightMatch: false, expandRepRange: true });
  if (result?.status !== "recommended") throw new Error(`engine did not recommend: ${JSON.stringify(result)}`);
  const logged = c.logged[0][0];
  const move = result.targets.loadKg > logged ? "up" : result.targets.loadKg < logged ? "down" : "same";
  return { status: result.status, move, load: result.targets.loadKg, reps: result.targets.reps, name: exercise.name };
}
const ENGINE = Object.fromEntries(Object.entries(LANDING_CASES).map(([id, c]) => [id, runEngineCase(c)]));

// ---------------------------------------------------------------------------
// Number matching: a number is present as its own token in the lang's format.
// ---------------------------------------------------------------------------
function hasNumber(text, value, lang) {
  const shown = (lang === "pt" ? String(value).replace(".", ",") : String(value));
  const re = new RegExp(`(?<![\\d.,])${escapeRe(shown)}(?![\\d]|[.,]\\d)`);
  return re.test(squash(text));
}

// ---------------------------------------------------------------------------
// Browser helpers
// ---------------------------------------------------------------------------
async function clearSite(page) {
  await page.evaluate(async (cookieName) => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = `${cookieName}=; Max-Age=0; Path=/; SameSite=Lax`;
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = req.onerror = req.onblocked = () => res();
    });
  }, COOKIE);
}

/** A clean, empty device showing the generic landing (or the gate the UA implies). */
async function landingPage(browser, { ua = ANDROID_UA, lang = "en", standalone = false, width = 390, height = 844, reducedMotion = false, theme = null, colorScheme = null } = {}) {
  const { context, page, errors } = await openAppPage(browser, { ua, locale: LOCALE[lang], standalone, width, height });
  if (reducedMotion) await page.emulateMedia({ reducedMotion: "reduce" });
  if (colorScheme) await page.emulateMedia({ colorScheme });
  await clearSite(page);
  if (theme) await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify({ theme: value })), { key: UIKEY, value: theme });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await waitForFirstRun(page);
  return { context, page, errors };
}

/** Every storage surface the oracle compares, plus the cookie. */
async function storageSnapshot(page) {
  return page.evaluate(async ({ key, draft, workoutDraft, cookieName }) => {
    const local = {};
    for (const k of Object.keys(localStorage)) local[k] = localStorage.getItem(k);
    const session = {};
    for (const k of Object.keys(sessionStorage)) session[k] = sessionStorage.getItem(k);
    const idb = {};
    try {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("repforge", 1);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      if (db.objectStoreNames.contains("kv")) {
        const store = db.transaction("kv", "readonly").objectStore("kv");
        const keys = await new Promise((res, rej) => { const q = store.getAllKeys(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
        for (const k of keys) idb[String(k)] = await new Promise((res, rej) => { const q = store.get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
      }
      db.close();
    } catch {}
    let durable = null;
    try { durable = JSON.parse(localStorage.getItem(key) || "null"); } catch {}
    let ui = {};
    try { ui = JSON.parse(localStorage.getItem("repforge_ui_v1") || "{}"); } catch {}
    const cookie = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
    return {
      local, session, idb,
      setupDraft: localStorage.getItem(draft),
      workoutDraft: localStorage.getItem(workoutDraft),
      onboarded: durable?.programMeta?.onboarded === true,
      programRows: (durable?.program || []).length,
      logRows: (durable?.log || []).length,
      entryLandingSeen: ui.entryLandingSeen === true,
      cookie: cookie ? decodeURIComponent(cookie.slice(cookieName.length + 1)) : null,
    };
  }, { key: KEY, draft: SETUP_DRAFT, workoutDraft: WORKOUT_DRAFT, cookieName: COOKIE });
}

/** What the landing shows, read through production IDs only. */
const readLanding = () => {
  const hidden = (node) => !node || node.hidden === true || !!node.closest(".hidden,[hidden]");
  const shown = (selector) => {
    const node = document.querySelector(selector);
    if (hidden(node) || node.getClientRects().length === 0) return false;
    const style = getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden";
  };
  const text = (selector) => (document.querySelector(selector)?.textContent || "").replace(/\s+/g, " ").trim();
  return {
    route: document.querySelector("#firstRun")?.dataset.entryLanding || null,
    lang: document.documentElement.lang || null,
    headline: text("#firstRunHeadline"),
    lede: text("#firstRunLede"),
    create: { shown: shown("#firstRunCreate"), text: text("#firstRunCreate") },
    import: { shown: shown("#firstRunImport"), text: text("#firstRunImport") },
    createClose: shown("#firstRunCreateClose"),
    importClose: shown("#firstRunImportClose"),
    privacy: { shown: shown("#firstRunPrivacy"), text: text("#firstRunPrivacy") },
    installLink: shown("#firstRunInstallLink"),
    installLinkText: text("#firstRunInstallLink"),
    install: shown("#firstRunInstall"),
    installTitle: text(".installcard__title"),
    installBody: text(".installcard__body"),
    installAction: document.querySelector("#firstRunInstallAction") ? text("#firstRunInstallAction") : null,
    continueShown: shown("#firstRunContinue"),
    continueLabel: text("#firstRunContinueLabel"),
    error: { shown: shown("#firstRunSharedError"), text: text("#firstRunSharedError"), role: document.querySelector("#firstRunSharedError")?.getAttribute("role") || null },
    hasStart: !!document.querySelector("#firstRunSharedStart"),
  };
};

// ===========================================================================
// PART 1 - characterization
// ===========================================================================
async function characterize(browser) {
  // -------------------------------------------------------------------------
  phase("V1 Standard landing (generic): headline, both actions, Privacy, seen-state");
  for (const lang of ["en", "pt"]) {
    const { context, page, errors } = await landingPage(browser, { lang });
    const s = await page.evaluate(readLanding);
    const gate = await page.evaluate(sharedGateSnapshot);
    assert(s.route === "generic", `[${lang}] a first visit with no link is the generic landing`, s.route);
    assert(s.headline === tr(lang, "landing.headline"), `[${lang}] headline is landing.headline`, s.headline);
    assert(s.lede === tr(lang, "landing.hero.sub"), `[${lang}] lede is landing.hero.sub`, s.lede);
    assert(s.create.shown && s.create.text === tr(lang, "landing.build"), `[${lang}] Build action reads landing.build`, JSON.stringify(s.create));
    assert(s.import.shown && s.import.text === tr(lang, "landing.track"), `[${lang}] Track action reads landing.track`, JSON.stringify(s.import));
    assert(s.privacy.shown && s.privacy.text === tr(lang, "privacy.title"), `[${lang}] Privacy link reads privacy.title`, JSON.stringify(s.privacy));
    assert(!gate.startVisible && gate.sharedHidden, `[${lang}] the shared Start row is not offered`, JSON.stringify(gate));
    assert(!s.error.shown, `[${lang}] the shared error line is not shown`, JSON.stringify(s.error));
    assert(!s.install && !s.installLink && s.installAction === null, `[${lang}] nothing to install: no card, no header link, no action`, JSON.stringify(s));
    assert(errors.length === 0, `[${lang}] no uncaught page errors`, errors.slice(0, 2).join(" | "));
    await context.close();
  }

  {
    const { context, page } = await landingPage(browser, { lang: "en" });
    const before = await storageSnapshot(page);
    assert(!before.onboarded && before.programRows === 0 && before.logRows === 0, "the standing landing has saved no program and no log", JSON.stringify(before));

    // Privacy: the one sheet opener, with focus returned to it.
    await page.locator("#firstRunPrivacy").focus();
    await page.click("#firstRunPrivacy");
    await page.waitForSelector("#privacySheet.is-open:not([hidden])", { timeout: 8000 });
    const sheet = await page.evaluate(() => ({
      title: (document.querySelector("#privacyTitle")?.textContent || "").trim(),
      modal: document.querySelector("#privacySheet")?.getAttribute("aria-modal") || null,
    }));
    assert(sheet.title === tr("en", "privacy.title") && sheet.modal === "true", "Privacy opens the existing disclosure sheet as a modal", JSON.stringify(sheet));
    await page.click("#privacyClose");
    await page.waitForFunction(() => document.querySelector("#privacySheet")?.hidden === true, undefined, { timeout: 8000 });
    await page.waitForFunction(() => document.activeElement?.id === "firstRunPrivacy", undefined, { timeout: 5000 }).catch(() => {});
    const focus = await page.evaluate(() => document.activeElement?.id || null);
    assert(focus === "firstRunPrivacy", "closing the sheet returns focus to #firstRunPrivacy", `focus: ${focus}`);

    // Build: opens the hub without writing a program.
    await page.click("#firstRunCreate");
    await page.waitForSelector("#onboarding.active", { timeout: 10000 });
    await page.waitForSelector('[data-entry-hub="recommend"]', { timeout: 10000 });
    const afterBuild = await page.evaluate(() => ({
      gate: !document.querySelector("#firstRun")?.classList.contains("hidden"),
      route: window.__repforgeOnboarding?.entry?.()?.route ?? null,
    }));
    assert(!afterBuild.gate, "Build leaves the landing and opens the onboarding hub", JSON.stringify(afterBuild));
    const built = await storageSnapshot(page);
    assert(!built.onboarded && built.programRows === 0 && built.logRows === 0, "Build opens the hub without saving a program", JSON.stringify(built));

    await context.close();
  }

  {
    // Track: the import door, from the landing.
    const { context, page } = await landingPage(browser, { lang: "en" });
    await page.click("#firstRunImport");
    await page.waitForSelector("#entryImportPick, #entryFreeformIn", { timeout: 10000 });
    const entry = await page.evaluate(() => window.__repforgeOnboarding?.entry?.() ?? null);
    assert(entry?.route === "import" && entry?.step === "import_source", "Track opens the import door at import_source", JSON.stringify(entry));
    const after = await storageSnapshot(page);
    assert(!after.onboarded && after.programRows === 0 && after.logRows === 0, "neither action saves a program or a log", JSON.stringify(after));
    await context.close();
  }

  {
    // The one-time seen-state: written only after the generic landing is visible.
    const { context, page } = await openAppPage(browser);
    await clearSite(page);
    await page.addInitScript(({ uiKey }) => {
      const original = Storage.prototype.setItem;
      window.__seenWrites = [];
      Storage.prototype.setItem = function (key, value) {
        if (this === localStorage && key === uiKey) {
          let parsed = null;
          try { parsed = JSON.parse(value); } catch {}
          if (parsed?.entryLandingSeen === true) {
            const landing = document.querySelector("#firstRun");
            window.__seenWrites.push({ visible: !!landing && !landing.classList.contains("hidden"), route: landing?.dataset.entryLanding || null });
          }
        }
        return original.call(this, key, value);
      };
    }, { uiKey: UIKEY });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await waitForFirstRun(page);
    const seen = await storageSnapshot(page);
    const writes = await page.evaluate(() => window.__seenWrites || []);
    assert(seen.entryLandingSeen, "the generic landing records entryLandingSeen once it has rendered");
    assert(writes.length >= 1 && writes.every((w) => w.visible && w.route === "generic"), "every entryLandingSeen write happens after the generic landing is visible", JSON.stringify(writes));
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await page.waitForTimeout(300);
    // Owner decision on #295 (landing until onboarding), and 2026-10-31 (the
    // landing never changes): a second empty visit shows the same landing again,
    // with Today's no-program state behind it and no chooser opened by itself.
    const second = await page.evaluate(() => ({
      landing: !document.querySelector("#firstRun")?.classList.contains("hidden"),
      features: !document.querySelector('#firstRun [data-landing-section="features"]')?.closest(".hidden,[hidden]")
        && getComputedStyle(document.querySelector('#firstRun [data-landing-section="features"]')).display !== "none",
      noProgram: !document.querySelector("#todayNoProgram")?.classList.contains("hidden"),
      chooser: !!document.querySelector("#onboarding")?.classList.contains("active"),
    }));
    assert(second.landing && second.features && second.noProgram && !second.chooser,
      "a second empty visit shows the same full landing over Today's no-program state, not the chooser", JSON.stringify(second));
    await context.close();
  }

  // Standard landing with a browser that holds an install prompt, and with the installed app:
  // both offer no install section and no action (value is not shown yet / already installed).
  for (const [label, opts, fire] of [
    ["Chromium before first value", { ua: ANDROID_UA }, true],
    ["standalone (installed app)", { ua: ANDROID_UA, standalone: true }, true],
  ]) {
    const { context, page } = await landingPage(browser, opts);
    if (fire) await page.evaluate(() => window.__fireInstall?.());
    await page.waitForTimeout(250);
    const s = await page.evaluate(readLanding);
    assert(!s.install && !s.installLink && s.installAction === null && !s.continueShown, `${label}: no install section, header link, action or escape hatch`, JSON.stringify(s));
    assert(s.create.shown && s.import.shown, `${label}: Build and Track stay available`, JSON.stringify(s));
    await context.close();
  }

  // -------------------------------------------------------------------------
  phase("V2 Install, iOS Safari: card, action, instruction sheet, Continue");
  for (const lang of ["en", "pt"]) {
    const { context, page } = await landingPage(browser, { ua: IOS_UA, lang });
    const s = await page.evaluate(readLanding);
    assert(s.install, `[${lang}] the install section is offered`, JSON.stringify(s));
    assert(s.installTitle === tr(lang, "install.card.title"), `[${lang}] card title is install.card.title`, s.installTitle);
    assert(s.installBody === tr(lang, "install.card.ios_body"), `[${lang}] card body is install.card.ios_body`, s.installBody);
    assert(s.installAction === tr(lang, "install.card.ios_action"), `[${lang}] the action is install.card.ios_action`, String(s.installAction));
    assert(s.continueShown && s.continueLabel === tr(lang, "setup.continue_safari"), `[${lang}] the escape hatch is setup.continue_safari`, s.continueLabel);
    assert(s.installLink && s.installLinkText === tr(lang, "landing.install"), `[${lang}] the header offers landing.install`, s.installLinkText);
    assert(s.create.shown && s.import.shown, `[${lang}] Build and Track stay available beside the card`, JSON.stringify(s));
    if (lang === "en") {
      await page.click("#firstRunInstallAction");
      await page.waitForSelector("#iosInstallSheet.is-open", { timeout: 8000 });
      const sheet = await page.evaluate(() => ({
        steps: [...document.querySelectorAll(".installsteps__body")].length,
        host: document.querySelector("#iosInstallHost")?.textContent || null,
      }));
      assert(sheet.steps === 4 && sheet.host === new URL(BASE).hostname, "the action opens the four-step instruction sheet for this host", JSON.stringify(sheet));
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector("#iosInstallSheet")?.hidden === true, undefined, { timeout: 8000 });
      const standing = await page.evaluate(() => !document.querySelector("#firstRun").classList.contains("hidden"));
      assert(standing, "Escape closes the sheet and leaves the landing standing");
      await page.click("#firstRunContinue");
      await page.waitForSelector("#onboarding.active", { timeout: 10000 });
      const snap = await storageSnapshot(page);
      assert(!snap.onboarded && snap.programRows === 0, "Continue starts onboarding without saving a program", JSON.stringify(snap));
    }
    await context.close();
  }

  // -------------------------------------------------------------------------
  phase("V3 Install, another iOS browser: an explanation and no action it cannot honour");
  for (const lang of ["en", "pt"]) {
    const { context, page } = await landingPage(browser, { ua: IOS_CHROME_UA, lang });
    const s = await page.evaluate(readLanding);
    assert(s.install, `[${lang}] the section explains rather than disappears`, JSON.stringify(s));
    assert(s.installBody === tr(lang, "install.card.safari_only_body"), `[${lang}] it names Safari as the way in`, s.installBody);
    assert(s.installAction === null, `[${lang}] it offers no install action`, String(s.installAction));
    assert(s.continueShown && s.continueLabel === tr(lang, "setup.continue_browser"), `[${lang}] the escape hatch is setup.continue_browser`, s.continueLabel);
    assert(s.create.shown && s.import.shown, `[${lang}] Build and Track stay available`, JSON.stringify(s));
    await context.close();
  }

  // -------------------------------------------------------------------------
  phase("V4 Shared link (valid): the confirmation gate");
  for (const [lang, setup] of [["en", { name: "Coach program", language: "en" }], ["pt", { name: "Força compartilhada", language: "pt" }]]) {
    // The page language is payload data, so the locale is deliberately the other one.
    const { context, page, errors } = await openAppPage(browser, { ua: ANDROID_UA, locale: LOCALE[lang === "en" ? "pt" : "en"] });
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await waitForFirstRun(page);
    const encoded = await encodeSetupLink(page, setup);
    assert(encoded?.ok && typeof encoded.value === "string", `[${lang}] the link payload encodes`, JSON.stringify(encoded));

    const baseline = await storageSnapshot(page);
    await page.addInitScript(() => {
      const watched = (key) => /^repforge_(v1|draft_v1|program_setup_draft_v1|pending_v1:)/.test(String(key));
      window.__forbiddenWrites = [];
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (this === localStorage && watched(key)) window.__forbiddenWrites.push(`localStorage.set:${key}`);
        return set.call(this, key, value);
      };
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (value, key) {
        if (watched(key)) window.__forbiddenWrites.push(`indexedDB.put:${key}`);
        return put.apply(this, arguments);
      };
    });
    await page.goto(`${APP_INDEX}?landing-variants=${lang}#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    await page.waitForSelector("#firstRunSharedProgram:not(.hidden)", { timeout: 10000 });
    await page.waitForTimeout(400);

    const s = await page.evaluate(readLanding);
    const gate = await page.evaluate(sharedGateSnapshot);
    assert(s.route === "shared", `[${lang}] a valid link opens the shared landing`, s.route);
    assert(s.lang === (lang === "pt" ? "pt-BR" : "en") || gate.i18n === lang, `[${lang}] the language is the payload's, not the browser's`, JSON.stringify({ html: s.lang, i18n: gate.i18n }));
    // Plan 072 §7 (ADR 0020): the received-link gate is headed Começar este treino / Start this program,
    // and its one action is Ver o treino / See the program; the caption names the program on the card.
    assert(s.headline === tr(lang, "setup.shared.title"), `[${lang}] headline is setup.shared.title`, s.headline);
    assert(s.lede === tr(lang, "landing.shared.body"), `[${lang}] lede is landing.shared.body`, s.lede);
    assert(gate.startVisible && gate.startTitle === tr(lang, "setup.shared.view"), `[${lang}] the one action is setup.shared.view`, JSON.stringify(gate.startTitle));
    const capOk = templateRe(lang, "setup.shared.cap_one").test(squash(gate.startCap)) || templateRe(lang, "setup.shared.cap_many").test(squash(gate.startCap));
    assert(capOk && squash(gate.startCap).startsWith(setup.name), `[${lang}] the caption names the program and its days`, gate.startCap);
    assert(!s.create.shown && !s.import.shown && !s.createClose && !s.importClose, `[${lang}] no Build or Track is visible anywhere`, JSON.stringify(s));
    assert(gate.standardHidden && !gate.createFocusable && !gate.importFocusable && gate.startFocusable, `[${lang}] the hidden Build/Track group exposes no tab stop`, JSON.stringify(gate));
    assert(await page.evaluate(() => location.hash === ""), `[${lang}] the proposal is stripped from the address`);
    assert(s.error.shown === false, `[${lang}] no error line on a valid link`, JSON.stringify(s.error));

    // The confirmation gate: nothing durable until Start.
    if (FAULT === "persist-shared") {
      console.log("  [FAULT INJECTION] writing a setup draft before the oracle");
      await page.evaluate((draftKey) => {
        localStorage.setItem(draftKey, JSON.stringify({ schemaVersion: 1, draftId: "fault-draft-id", revision: 1, ownerId: "fault-owner", state: { route: "shared", result: { candidate: { settings: { restSec: 165 } } } } }));
      }, SETUP_DRAFT);
    }
    const atGate = await storageSnapshot(page);
    const writes = await page.evaluate(() => window.__forbiddenWrites || []);
    assert(atGate.setupDraft === null, `[${lang}] no setup draft exists before Start`, atGate.setupDraft);
    assert(atGate.workoutDraft === baseline.workoutDraft, `[${lang}] no workout draft appears before Start`);
    assert(isDeepStrictEqual(atGate.local, baseline.local), `[${lang}] localStorage is byte-identical to before the link`, JSON.stringify({ before: Object.keys(baseline.local), after: Object.keys(atGate.local) }));
    assert(isDeepStrictEqual(atGate.idb, baseline.idb), `[${lang}] IndexedDB is identical to before the link`);
    assert(isDeepStrictEqual(atGate.session, baseline.session), `[${lang}] sessionStorage is identical to before the link`);
    assert(!atGate.onboarded && atGate.programRows === 0 && atGate.logRows === 0, `[${lang}] nothing is onboarded, no program, no log`, JSON.stringify(atGate));
    assert(writes.length === 0, `[${lang}] no program or draft record is written while the gate stands`, JSON.stringify(writes));
    assert(atGate.cookie === encoded.value, `[${lang}] only the approved handoff cookie holds the proposal`);

    // Start stages the editable preview; it does not activate.
    await page.click("#firstRunSharedStart");
    await page.waitForSelector("#entryActivate", { timeout: 15000 });
    const staged = await page.evaluate(sharedGateSnapshot);
    const post = await storageSnapshot(page);
    assert(!staged.gate, `[${lang}] Start hides the landing`, JSON.stringify(staged));
    // Plan 072 §7 / ADR 0007: no payload field is durable before Use this program, so the
    // received program is reviewed in memory and the resumable setup draft stays empty.
    assert(post.setupDraft === null, `[${lang}] Start keeps the received program out of the setup draft until activation`);
    assert(!post.onboarded && post.programRows === 0 && post.logRows === 0, `[${lang}] staging is not activation: still no program on the device`, JSON.stringify(post));
    assert(errors.length === 0, `[${lang}] no uncaught page errors`, errors.slice(0, 2).join(" | "));
    await context.close();
  }

  // -------------------------------------------------------------------------
  phase("V5 Shared link (invalid): a complete fail-closed landing");
  for (const lang of ["en", "pt"]) {
    const { context, page } = await openAppPage(browser, { ua: ANDROID_UA, locale: LOCALE[lang] });
    await clearSite(page);
    await page.goto(`${APP_INDEX}?landing-variants=invalid-${lang}#setup=v1.not+base64`, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await waitForFirstRun(page);
    const s = await page.evaluate(readLanding);
    const post = await storageSnapshot(page);
    assert(s.route === "shared-invalid", `[${lang}] a bad link opens the shared-invalid landing`, s.route);
    assert(s.headline === tr(lang, "landing.shared.invalid_headline"), `[${lang}] headline is landing.shared.invalid_headline`, s.headline);
    assert(s.lede === tr(lang, "landing.shared.invalid_body"), `[${lang}] lede is landing.shared.invalid_body`, s.lede);
    const reasons = ["setup.shared.invalid", "setup.shared.unsupported", "setup.shared.outdated", "setup.shared.browser_unsupported"].map((key) => tr(lang, key));
    assert(s.error.shown && s.error.role === "status" && reasons.includes(s.error.text), `[${lang}] the specific reason is announced in the status line`, JSON.stringify(s.error));
    assert(s.create.shown && s.import.shown, `[${lang}] Build and Track stay available as the safe next step`, JSON.stringify(s));
    assert(post.setupDraft === null && !post.onboarded && post.programRows === 0, `[${lang}] nothing from the link was saved`, JSON.stringify(post));
    assert(!post.entryLandingSeen, `[${lang}] the one-time landing preference is not consumed`, JSON.stringify(post.entryLandingSeen));
    await context.close();
  }
}

// ===========================================================================
// PART 1b - the engine-truth oracle, Node only, always on
// ===========================================================================
function engineTruth() {
  phase("Engine truth: the landing's recommendation cases, with the app's default load step");
  assert(loadStep() === 2.5, "the plate grid steps by the app's default minimum jump (2.5 kg)", JSON.stringify(APP_DEFAULTS.minJump));
  for (const [id, c] of Object.entries(LANDING_CASES)) {
    const got = ENGINE[id];
    assert(got.status === "recommended" && Number.isFinite(got.load) && got.reps >= c.repMin && got.reps <= c.repMax,
      `${id}: the engine recommends a load and reps inside ${c.repMin}-${c.repMax}`, JSON.stringify(got));
    assert(got.move === c.move,
      `${id}: the engine's next load moves ${c.move} from the logged ${c.logged[0][0]} kg, as the card's verdict claims`, JSON.stringify(got));
  }
}

// ===========================================================================
// PART 1c - copy that must stay true to the code it describes, Node only
// ===========================================================================
const RETIRED_KEYS = [
  "landing.ethos", "landing.privacy", "landing.body", "landing.closing.body", "landing.preview.alt",
  "landing.program.title", "landing.system.title", "landing.shot.focus.alt", "landing.proof.example",
  // Focus has no "Now" label since R3c: the walkthrough points at the target on the card (owner decision, #295).
  "focus.cue.now",
  // The scroll walkthrough's steps and image descriptions, retired with it for the playing phone (2026-10-29).
  "landing.demo.sub", "landing.demo.s1.title", "landing.demo.s1.text", "landing.demo.s2.title", "landing.demo.s2.text",
  "landing.demo.s3.title", "landing.demo.s4.title", "landing.demo.s5.title", "landing.demo.s5.text", "landing.demo.s6.title",
  "landing.demo.s6.text", "landing.demo.s7.title", "landing.demo.s7.sets", "landing.demo.step_aria",
  "landing.demo.alt.focus", "landing.demo.alt.rest", "landing.demo.alt.actions", "landing.demo.alt.note",
  // The three outcomes and the strength-trend chart, retired for the feature tabs (owner, 2026-10-30).
  "landing.outcomes.title", "landing.outcomes.sub", "landing.outcomes.did_mixed", "landing.outcomes.tip",
  "landing.chart.alt", "landing.chart.caption",
];
/** What the captured import-review screen shows for the sample message: the counts differ by language. */
const PASTE_COUNTS = { en: { linked: 2, review: 2 }, pt: { linked: 0, review: 4 } };
const DEFAULT_WEEKS = (() => {
  const match = /mesocycleLengthWeeks:(\d+),mesocycleStatus:"active"/.exec(APP_SOURCE);
  return match ? Number(match[1]) : NaN;
})();

function copyPins() {
  phase("Copy pins: the page's claims against the code they describe");
  const transfer = readFileSync(new URL("../install-transfer.js", import.meta.url), "utf8");
  const maxAge = /const COOKIE_MAX_AGE = (\d+);/.exec(transfer);
  assert(maxAge && Number(maxAge[1]) === 3600, "the install-transfer cookie lives 3600 seconds: the hour the FAQ promises", maxAge?.[0]);
  assert(/within an hour/.test(CATALOG.en["landing.faq.store.transfer"]) && /uma hora/.test(CATALOG.pt["landing.faq.store.transfer"]),
    "both FAQ transfer answers say it expires within an hour");
  assert(DEFAULT_WEEKS === 6, "the ways' {weeks} is the default programMeta.mesocycleLengthWeeks", String(DEFAULT_WEEKS));
  for (const lang of ["en", "pt"]) {
    assert(CATALOG[lang]["landing.ways.written.body"].includes("{weeks}"), `[${lang}] the program length is a placeholder, never typed into the catalog`);
    for (const key of ["landing.demo.s7.text", "landing.outcomes.did_same", "landing.outcomes.target", "landing.features.library.title", "landing.features.library.text"]) {
      assert(!/\d/.test(CATALOG[lang][key].replace(/\{\w+\}/g, "").replace(/e1RM/g, "")), `[${lang}] ${key} carries no hard-coded number`, CATALOG[lang][key]);
    }
    for (const key of ["landing.demo.s7.text", "landing.anim.ch1.text"]) {
      assert(!CATALOG[lang][key].includes("{now}"), `[${lang}] ${key} names no "Now" line (Focus does not render one)`, CATALOG[lang][key]);
    }
    for (const key of RETIRED_KEYS) assert(!(key in CATALOG[lang]), `[${lang}] retired key ${key} is gone`);
  }
  // The import-review counts are measured from the live app by tools/capture-landing-proof.mjs
  // into assets/brand/landing-proof-spots.json; the page's own table must be those numbers, so
  // a recapture that moves a count fails here instead of shipping an alt that miscounts.
  const literal = (name) => {
    const match = new RegExp(`const ${name}=(\\{[\\s\\S]*?\\});\\n`).exec(APP_SOURCE);
    return match ? new Function(`"use strict";return (${match[1]});`)() : null;
  };
  const pagePaste = literal("LANDING_PASTE_SHOT");
  assert(!!pagePaste && !/const LANDING_SPOTS=/.test(APP_SOURCE), "app.js carries the import-review figures and no retired lens spots");
  let stored = null;
  try { stored = JSON.parse(readFileSync(new URL("../assets/brand/landing-proof-spots.json", import.meta.url), "utf8")); } catch {}
  if (stored && pagePaste) {
    assert(!("scenes" in stored), "the measured file keeps no retired lens spots", JSON.stringify(Object.keys(stored)));
    const counts = Object.fromEntries(Object.entries(stored.pasteReview).map(([lang, c]) => [lang, { linked: c.linked, review: c.review }]));
    assert(isDeepStrictEqual(counts, pagePaste.counts), "the import-review counts in app.js are each language's own measured counts", JSON.stringify({ stored: counts, page: pagePaste.counts }));
    assert(stored.frame.width === 390, "the import review was measured on the 390-wide frame its capture is", JSON.stringify(stored.frame));
  } else {
    console.log("  (assets/brand/landing-proof-spots.json is not written yet: the counts are not compared)");
  }
}

// ===========================================================================
// PART 2 - the final page
// ===========================================================================
const SECTIONS = ["hero", "proof", "ways", "features", "data", "faq", "close", "footer"];

const readFinal = (sectionNames) => {
  const root = document.querySelector("#firstRun");
  const text = (node) => (node?.textContent || "").replace(/\s+/g, " ").trim();
  const section = (name) => root?.querySelector(`[data-landing-section="${name}"]`) || null;
  const sections = Object.fromEntries(sectionNames.map((name) => [name, !!section(name)]));
  const steps = [...(section("proof")?.querySelectorAll("[data-landing-chapter]") || [])].map(text);
  const tabs = [...(section("features")?.querySelectorAll("[data-feature]") || [])];
  const features = { tabs: tabs.length, selected: tabs.filter((tab) => tab.getAttribute("aria-selected") === "true").length,
    library: text(tabs[2]?.querySelector(".firstrun-feat__title")), screens: section("features")?.querySelectorAll("[data-feature-screen] .firstrun-fx").length ?? 0 };
  const faq = [...(section("faq")?.querySelectorAll("details") || [])];
  const footerLink = section("footer")?.querySelector('a[href^="#"]') || null;
  const target = footerLink ? root.querySelector(footerLink.getAttribute("href")) : null;
  return {
    sections, steps, features,
    waysWritten: text(section("ways")?.querySelector('[data-landing-fill="ways.written"]')),
    faqCount: faq.length, faqQuestions: faq.map((d) => text(d.querySelector("summary"))), faqOpen: faq.filter((d) => d.open).length,
    rirAnswer: text(faq[2]?.querySelector(".firstrun-qa__a")),
    footerPrivacyTargetsData: !!target && target === section("data"),
  };
};

const dockState = () => {
  const dock = document.querySelector("#firstRunCreateDock");
  if (!dock) return { present: false, visible: false };
  const box = dock.getBoundingClientRect();
  const style = getComputedStyle(dock);
  const hiddenByAria = dock.getAttribute("aria-hidden") === "true" || !!dock.closest("[aria-hidden='true'],.hidden,[hidden]");
  const onScreen = box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight && style.visibility !== "hidden" && style.display !== "none";
  return { present: true, visible: !hiddenByAria && onScreen };
};

const proofState = () => window.__repforgeLandingProof?.() ?? null;
/** The proof's chapters and phone as the lifter sees them. */
const chapterState = () => {
  const root = document.querySelector("#firstRun");
  const items = [...root.querySelectorAll("[data-landing-chapter]")];
  const shown = (node) => {
    const box = node.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && Number.parseFloat(getComputedStyle(node).opacity) > 0 && getComputedStyle(node).visibility !== "hidden";
  };
  return {
    count: items.length,
    current: items.filter((item) => item.querySelector("[data-chapter]").getAttribute("aria-current") === "step").map((item) => items.indexOf(item)),
    captions: items.filter((item) => shown(item.querySelector(".firstrun-chapter__text"))).length,
    withText: items.filter((item) => item.textContent.trim().length > 0).length,
    devices: root.querySelectorAll(".firstrun-proof__device").length,
    screen: !!root.querySelector("#firstRunDemo .firstrun-demo .fx-cue"),
    tab: root.querySelector("#firstRunDemo .resttab__label")?.textContent || "",
    overflowX: document.documentElement.scrollWidth > innerWidth || root.scrollWidth > root.clientWidth,
  };
};

async function scrollLanding(page, selector, block = "start") {
  await page.evaluate(({ selector, block }) => {
    const node = document.querySelector(selector);
    if (node) node.scrollIntoView({ block, behavior: "instant" });
  }, { selector, block });
  await page.waitForTimeout(700);
}

/** Scroll the landing so the proof's phone sits near the top of the viewport. */
async function scrollToDevice(page, top = 16) {
  await page.evaluate((top) => {
    const root = document.querySelector("#firstRun"), device = document.querySelector(".firstrun-proof__device");
    root.scrollTo({ top: root.scrollTop + device.getBoundingClientRect().top - top, behavior: "instant" });
  }, top);
  await page.waitForTimeout(400);
}

async function finalPage(browser) {
  // Standard landing, both languages, both themes' captures.
  for (const lang of ["en", "pt"]) {
    phase(`Final page [${lang}]: sections and engine-true numbers`);
    const { context, page, errors } = await landingPage(browser, { lang });
    const f = await page.evaluate(readFinal, SECTIONS);

    for (const name of SECTIONS) assert(f.sections[name], `[${lang}] the ${name} section is present (data-landing-section="${name}")`);

    assert(f.steps.length === 4, `[${lang}] the proof has four chapters in the document`, `found ${f.steps.length}`);
    assert(f.steps.length > 0 && f.steps.every((step) => step.length > 0), `[${lang}] every chapter carries its title and caption`, JSON.stringify(f.steps.map((s) => s.length)));
    const add = LANDING_CASES.add;
    const last = f.steps.at(-1) || "";
    assert(
      hasNumber(last, ENGINE.add.load, lang) && hasNumber(last, ENGINE.add.reps, lang) && hasNumber(last, SETS, lang) &&
        hasNumber(last, add.logged[0][0], lang) && hasNumber(last, add.logged[0][1], lang) && hasNumber(last, add.repMin, lang) && hasNumber(last, add.repMax, lang),
      `[${lang}] chapter 4 shows the engine's next target ${ENGINE.add.load} x ${ENGINE.add.reps} and the sets it came from`, last
    );

    // The feature tabs: five, one selected, each with its screen, and the library's size as the copy states it.
    const count = Math.floor(LIBRARY_SIZE / 100) * 100, shownCount = count.toLocaleString(lang === "pt" ? "pt-BR" : "en-US");
    assert(f.features.tabs === 5 && f.features.selected === 1 && f.features.screens === 5, `[${lang}] five feature tabs, one selected, five screens`, JSON.stringify(f.features));
    assert(f.features.library === tr(lang, "landing.features.library.title", { count: shownCount }),
      `[${lang}] the library tab names exercises.js's ${LIBRARY_SIZE} as ${shownCount}+`, f.features.library);
    assert(f.waysWritten === tr(lang, "landing.ways.written.body", { weeks: DEFAULT_WEEKS }), `[${lang}] the ways' program length is the default ${DEFAULT_WEEKS} weeks`, f.waysWritten);


    assert(f.faqCount === 5, `[${lang}] the questions section has five <details>`, `found ${f.faqCount}`);
    assert(f.faqOpen === 0, `[${lang}] every question starts closed`);
    assert(f.rirAnswer === tr(lang, "glossary.RIR"), `[${lang}] the RIR answer is the app's own definition (glossary.RIR)`, f.rirAnswer);
    assert(f.footerPrivacyTargetsData, `[${lang}] the footer Privacy link goes to the data section, not the sheet`);
    const pasteAlt = await page.evaluate(() => document.querySelector('[data-shot="paste-review"]')?.getAttribute("alt") || "");
    const pasteTemplate = tr(lang, "landing.ways.paste.alt", { screen: tr(lang, "import.heading"), ...PASTE_COUNTS[lang], status: tr(lang, "import.status.probable") });
    const pasteRe = new RegExp(`^${escapeRe(pasteTemplate).replace(/\\\{\w+\\\}/g, ".+")}$`);
    assert(!/ as ,| como ,/.test(pasteAlt) && !/\{exercise\}/.test(pasteAlt), `[${lang}] the import-review alt names the suggested movement`, pasteAlt);
    assert(pasteRe.test(pasteAlt), `[${lang}] the import-review alt states this language's own counts (${PASTE_COUNTS[lang].linked} linked, ${PASTE_COUNTS[lang].review} to review)`, pasteAlt);
    const pasteSize = await page.evaluate(() => { const img = document.querySelector('[data-shot="paste-review"]'); return `${img.getAttribute("width")}x${img.getAttribute("height")}`; });
    // The reserved box is the committed capture's own size, read from the file, so a regenerated capture cannot drift from it.
    const pasteFile = webpSize(readFileSync(new URL(`../assets/brand/paste-review-${lang}-light.webp`, import.meta.url)));
    assert(pasteSize === `${pasteFile.width}x${pasteFile.height}`, `[${lang}] the import-review capture reserves its own ${lang} box (the committed file's ${pasteFile.width}x${pasteFile.height})`, pasteSize);

    // Every capture is referenced with its box so a missing file cannot shift the layout.
    const images = await page.evaluate(() => [...document.querySelectorAll("#firstRun img")].map((img) => ({
      src: img.getAttribute("src"), width: img.getAttribute("width"), height: img.getAttribute("height"), decoding: img.getAttribute("decoding"),
    })));
    assert(images.every((img) => img.width && img.height), `[${lang}] every landing image declares width and height`, JSON.stringify(images.filter((img) => !img.width || !img.height)));
    assert(!images.some((img) => /today-ready/.test(img.src || "")), `[${lang}] the retired today-ready hero images are not referenced`);
    const sources = await page.evaluate(() => [...document.querySelectorAll("#firstRun picture source")].length);
    assert(sources === 0, `[${lang}] no prefers-color-scheme <picture> source: themes swap by data-theme`, String(sources));

    // The persistent Build control: hidden at the top, present once the hero action is behind (past the stages, which
    // it steps aside for), gone at the close.
    const top = await page.evaluate(dockState);
    assert(!top.visible, `[${lang}] the dock is hidden while the hero action is on screen`, JSON.stringify(top));
    await scrollLanding(page, '#firstRun [data-landing-section="data"]');
    const past = await page.evaluate(dockState);
    assert(past.present && past.visible, `[${lang}] #firstRunCreateDock shows once the hero action has scrolled away`, JSON.stringify(past));
    await scrollLanding(page, '#firstRun [data-landing-section="close"]');
    const closing = await page.evaluate(dockState);
    assert(!closing.visible, `[${lang}] the dock steps aside at the closing action`, JSON.stringify(closing));
    assert(errors.length === 0, `[${lang}] no uncaught page errors while the captures are missing or present`, errors.slice(0, 2).join(" | "));
    await context.close();
  }

  // Appearance follows <html data-theme>; the proof's phone is the app's light theme whatever the page is (owner, iPhone,
  // 2026-10-30): its computed colours under a dark page, an explicit or a system one, are the light page's.
  phase("Final page: captures follow the chosen appearance; the proof's phone is always light");
  const phoneColours = () => {
    const screen = document.querySelector("#firstRunDemo");
    const read = (sel, props) => { const node = screen.querySelector(sel); return node ? props.map((prop) => getComputedStyle(node)[prop]).join(" ") : null; };
    return {
      ground: read(".firstrun-demo", ["backgroundColor", "color"]), cue: read(".firstrun-demo__l1", ["color"]), log: read(".firstrun-demo__log", ["backgroundColor", "color", "borderTopColor"]),
      pad: read(".shelf__pads .stepbtn", ["backgroundColor", "color", "borderTopColor"]), shelf: read(".firstrun-demo__shelf", ["backgroundColor"]),
      wheel: read(".firstrun-demo__wheel", ["backgroundColor"]), row: read(".firstrun-demo__wheel .wheel__item", ["color"]), sheet: read(".firstrun-demo__sheet", ["backgroundColor"]),
    };
  };
  const palettes = {};
  for (const [theme, colorScheme, shown] of [["light", null, "light"], ["dark", null, "dark"], ["system", "dark", "dark"]]) {
    const { context, page } = await landingPage(browser, { lang: "en", theme, colorScheme });
    const shots = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      sources: [...document.querySelectorAll("#firstRun [data-shot]")].map((img) => img.getAttribute("src")),
      light: document.querySelector("#firstRunDemo")?.classList.contains("theme-light"),
    }));
    palettes[theme] = await page.evaluate(phoneColours);
    assert(shots.theme === shown && shots.sources.length === 1 && shots.sources.every((src) => src.endsWith(`-en-${shown}.webp`)),
      `[${theme}] the paste review swaps to its ${shown} capture`, JSON.stringify(shots));
    assert(shots.light && palettes[theme].ground?.startsWith("rgb(244, 242, 239)"), `[${theme}] the proof's screen is on the app's light paper`, JSON.stringify({ shots, colours: palettes[theme] }));
    await context.close();
  }
  for (const theme of ["dark", "system"]) {
    assert(Object.values(palettes.light).every(Boolean) && isDeepStrictEqual(palettes[theme], palettes.light),
      `[${theme}] every colour the phone paints is the light page's`, JSON.stringify({ light: palettes.light, [theme]: palettes[theme] }));
  }

  // The proof's player: plays on screen, pauses off it and when hidden, jumps by chapter, and leaves nothing behind.
  phase("Proof player: plays only on screen and visible, jumps by chapter, and a clean exit");
  {
    const { context, page, errors } = await landingPage(browser, { lang: "en" });
    const open = await page.evaluate(proofState);
    // observers: the dock's three (the hero, the close and the stages' band), the status-bar band's one, the player's
    // resize and visibility watchers, and the feature tabs' two
    assert(open?.open && open.listeners > 0 && open.observers === 8 && !open.playing && !open.featurePlaying,
      "opening the landing mounts the controller; the proof below the fold is not playing", JSON.stringify(open));
    const at = await page.evaluate(chapterState);
    assert(at.devices === 1 && at.screen && at.count === 4 && at.current.length === 1 && at.current[0] === 0 && at.captions === 1,
      "one phone with Focus's screen, four chapters, the first current with its caption", JSON.stringify(at));
    await scrollToDevice(page);
    const t0 = (await page.evaluate(proofState)).time;
    await page.waitForTimeout(900);
    const playing = await page.evaluate(proofState);
    assert(playing.playing && playing.time > t0 + .5, "on screen the phone plays its timeline", JSON.stringify({ t0, playing }));
    // a chapter jumps the timeline to its start and becomes the one current chapter
    await page.click('[data-chapter="2"]');
    const jumped = await page.evaluate(() => ({ ...window.__repforgeLandingProof(), ...(() => {
      const items = [...document.querySelectorAll("[data-landing-chapter]")];
      return { current: items.map((item) => item.querySelector("[data-chapter]").getAttribute("aria-current") === "step") };
    })() }));
    assert(jumped.chapter === 2 && jumped.time >= 10 && jumped.time < 11 && jumped.current.filter(Boolean).length === 1 && jumped.current[2],
      "a chapter jumps the phone to its start and is the one current chapter", JSON.stringify(jumped));
    await page.evaluate(() => window.__repforgeLandingSeek(13));
    const rest = await page.evaluate(chapterState);
    assert(rest.tab === tr("en", "rest.inline.done"), "at 13 s the rest tab says the app's own Rest done", JSON.stringify(rest));
    await page.evaluate(() => window.__repforgeLandingSeek(null));
    // a hidden page stops the clock; visible again, it runs
    await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
    const hidden = await page.evaluate(proofState);
    await page.waitForTimeout(400);
    const stillHidden = await page.evaluate(proofState);
    assert(!hidden.playing && stillHidden.time === hidden.time && stillHidden.frames === 0, "a hidden page stops the clock and holds no frame", JSON.stringify({ hidden, stillHidden }));
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); });
    assert((await page.evaluate(proofState)).playing, "visible again, the phone plays on");
    // scrolled away, it pauses
    await scrollLanding(page, '#firstRun [data-landing-section="faq"]');
    const away = await page.evaluate(proofState);
    assert(!away.playing && away.frames === 0, "scrolled off screen, the phone pauses and holds no frame", JSON.stringify(away));

    // Leaving the landing disposes everything the controller started.
    await page.evaluate(() => window.closeFirstRun());
    const closed = await page.evaluate(() => ({ ...window.__repforgeLandingProof(), scaled: !!document.querySelector(".firstrun-proof__rig")?.style.transform }));
    assert(closed.open === false && closed.listeners === 0 && closed.observers === 0 && closed.frames === 0 && !closed.scaled,
      "closing the landing leaves no listener, observer, frame or scale behind", JSON.stringify(closed));
    // And scrolling a hidden landing starts nothing.
    await page.evaluate(() => { const r = document.querySelector("#firstRun"); r.scrollTop = 50; r.dispatchEvent(new Event("scroll")); window.dispatchEvent(new Event("resize")); });
    await page.waitForTimeout(150);
    const still = await page.evaluate(() => window.__repforgeLandingProof());
    assert(still.frames === 0 && still.listeners === 0, "scroll and resize on a closed landing start nothing", JSON.stringify(still));
    // Reopening on the same device mounts a fresh controller for the same full page.
    await page.evaluate(() => window.openFirstRun());
    await page.waitForTimeout(300);
    const again = await page.evaluate(proofState);
    assert(again?.open && again.listeners > 0, "reopening mounts a fresh controller", JSON.stringify(again));
    await page.evaluate(() => window.closeFirstRun());
    // A device that has not seen the landing gets the full first-visit page again.
    await page.evaluate((key) => localStorage.removeItem(key), UIKEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await waitForFirstRun(page);
    const fresh = await page.evaluate(proofState);
    assert(fresh?.open && fresh.chapter === 0, "a first visit mounts a fresh controller at chapter one", JSON.stringify(fresh));
    await page.evaluate(() => window.closeFirstRun());
    assert(errors.length === 0, "mounting and disposing raise no page errors", errors.slice(0, 2).join(" | "));
    await context.close();
  }

  // The timeline (owner, iPhone, 2026-10-30: "Rest NaN:NaN", a chip ahead of its frame, set 1 checked at the start):
  // every frame of the loop shows only finite values, and the chips, the frame and its state agree at every chapter's
  // edge, whether the clock reaches it, a chip is tapped or the loop wraps. On a dark page, as the owner's phone was.
  phase("Proof timeline: every frame is finite and in step with its chapter");
  {
    const { context, page, errors } = await landingPage(browser, { lang: "en", theme: "dark" });
    await scrollToDevice(page);
    const sweep = await page.evaluate(() => {
      const screen = document.querySelector("#firstRunDemo"), items = [...document.querySelectorAll("[data-landing-chapter]")];
      const bad = [];
      for (let i = 0; i <= 17 * 30; i++) {
        const time = i / 30;
        window.__repforgeLandingSeek(time);
        const said = [screen.textContent, ...[...screen.querySelectorAll("[style]"), ...items].map((node) => node.getAttribute("style") || "")].join(" ");
        const found = /NaN|undefined|Infinity/.exec(said);
        if (found) bad.push(`${time.toFixed(2)}s: ${said.slice(Math.max(0, found.index - 40), found.index + 20)}`);
      }
      return { bad: bad.slice(0, 5), count: bad.length, nonFinite: window.__repforgeLandingProof().nonFinite };
    });
    assert(sweep.count === 0 && sweep.nonFinite === 0, "no frame of the loop shows NaN, undefined or Infinity, nor computes a non-finite style", JSON.stringify(sweep));
    // What the screen and the chips show, read from the page.
    const read = () => {
      const q = (sel) => document.querySelector(`#firstRunDemo ${sel}`), op = (sel) => Number(getComputedStyle(q(sel)).opacity);
      const items = [...document.querySelectorAll("[data-landing-chapter]")];
      return {
        chapter: window.__repforgeLandingProof().chapter, time: window.__repforgeLandingProof().time,
        current: items.map((item, i) => item.querySelector("[data-chapter]").getAttribute("aria-current") === "step" ? i : -1).filter((i) => i >= 0),
        progress: items.map((item) => Number(item.style.getPropertyValue("--chapter-progress"))),
        checked: op(".firstrun-demo__done1"), turned: op(".firstrun-demo__v1"), finger: op(".landing-touch"),
        wheel: q(".firstrun-demo__wheel").getBoundingClientRect().top < q(".firstrun-demo").getBoundingClientRect().bottom - 2,
        next: q(".firstrun-demo__sheet").getBoundingClientRect().top < q(".firstrun-demo").getBoundingClientRect().bottom - 2,
        tab: q(".resttab__label").textContent, clock: q(".resttab__time").textContent,
      };
    };
    const starts = [0, 6, 10, 14], loop = 18;
    // The screen at each chapter's start: the state the chapter opens on, and nothing a later chapter left.
    const opens = [
      (s) => s.checked === 0 && s.turned === 0 && s.finger === 0 && !s.wheel && !s.next && s.tab === tr("en", "rest.inline.label"),
      (s) => s.checked === 0 && s.turned === 1 && s.finger === 0 && !s.wheel && !s.next,
      (s) => s.checked === 1 && s.turned === 0 && !s.wheel && !s.next && s.tab === tr("en", "rest.inline.label") && /^1:\d\d$/.test(s.clock),
      (s) => s.checked === 1 && !s.wheel && !s.next && s.tab === tr("en", "rest.inline.done"),
    ];
    const inStep = (s, i) => s.chapter === i && s.current.length === 1 && s.current[0] === i &&
      s.progress.every((p, k) => k < i ? p === 1 : k > i ? p === 0 : p >= 0 && p <= 1);
    for (const [i, start] of starts.entries()) {
      const before = (i + starts.length - 1) % starts.length;
      await page.evaluate((time) => window.__repforgeLandingSeek(time), (start - .02 + loop) % loop);
      const edge = await page.evaluate(read);
      await page.evaluate((time) => window.__repforgeLandingSeek(time), start + .02);
      const after = await page.evaluate(read);
      assert(inStep(edge, before) && inStep(after, i) && after.progress[i] < .05 && opens[i](after),
        `chapter ${i + 1}'s edge: the chip and the frame change together, and the frame opens on its own state`, JSON.stringify({ edge, after }));
      // A chip tapped from the end of the loop jumps the frame back to the same state.
      await page.evaluate(() => window.__repforgeLandingSeek(17));
      await page.click(`[data-chapter="${i}"]`);
      const tapped = await page.evaluate(read);
      assert(inStep(tapped, i) && opens[i](tapped), `tapping chapter ${i + 1} from the loop's end shows its opening state`, JSON.stringify(tapped));
    }
    // The clock itself wraps the loop into chapter 1 with set 1 open again.
    await page.evaluate(() => window.__repforgeLandingSeek(17.8));
    await page.evaluate(() => window.__repforgeLandingSeek(null));
    await page.waitForTimeout(700);
    const wrapped = await page.evaluate(read);
    assert(inStep(wrapped, 0) && wrapped.time < 1.5 && wrapped.checked === 0 && wrapped.turned === 0 && !wrapped.next,
      "the loop wraps into chapter 1 with set 1 unchecked and the chip back on chapter 1", JSON.stringify(wrapped));
    assert(errors.length === 0, "the timeline raises no page errors", errors.slice(0, 2).join(" | "));
    await context.close();
  }

  // The camera (the polish brief): at 390 every zoomed frame shows the screen's body text (14px and up in the app) at
  // 13px or more; only the opening shot and the wrap's pull-back show the whole phone. And the captions are whole:
  // each sits inside the stage, wraps inside its own box, and the row is as tall as the longest, in both languages at
  // 390 and 320.
  phase("Proof camera: legible zoomed text; whole captions");
  {
    const { context, page } = await landingPage(browser, { lang: "pt" });
    await scrollToDevice(page);
    const legible = await page.evaluate(() => {
      const screen = document.querySelector("#firstRunDemo"), rig = document.querySelector(".firstrun-proof__rig"), frame = document.querySelector(".firstrun-proof__device").getBoundingClientRect();
      const small = [];
      let zoomed = 0;
      for (let time = 1.05; time < 17.35; time += .25) {
        window.__repforgeLandingSeek(time);
        const k = rig.getBoundingClientRect().width / rig.offsetWidth;
        zoomed++;
        const walker = document.createTreeWalker(screen, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const el = node.parentElement, text = node.textContent.trim();
          if (!text || !el.getClientRects().length) continue;
          const style = getComputedStyle(el), size = parseFloat(style.fontSize);
          if (size < 14 || style.visibility === "hidden") continue;
          let shown = 1; for (let n = el; n && n !== screen; n = n.parentElement) shown *= +getComputedStyle(n).opacity;
          const r = el.getBoundingClientRect();
          if (shown < .5 || r.bottom <= frame.top || r.top >= frame.bottom || r.right <= frame.left || r.left >= frame.right) continue;
          if (size * k < 13 - .01) small.push(`${time.toFixed(2)}s ${text.slice(0, 16)} ${size}px x ${k.toFixed(3)}`);
        }
      }
      return { zoomed, small: small.slice(0, 5), count: small.length };
    });
    assert(legible.zoomed > 50 && legible.count === 0, "at 390 every zoomed frame shows the screen's body text at 13px or more", JSON.stringify(legible));
    await context.close();
  }
  // No shot cuts a part of the screen at its edges (polish review, 2026-10-31): at each settled zoomed moment the
  // shelf's fields, pads and Log set are wholly in the frame or 8 screen px or more outside it, and the header, the
  // cue's lines and the ledger's rows are wholly in or wholly out.
  for (const [width, height, lang] of [[390, 844, "en"], [390, 844, "pt"], [375, 667, "en"], [320, 568, "pt"]]) {
    const { context, page } = await landingPage(browser, { lang, width, height });
    await scrollToDevice(page);
    const cuts = await page.evaluate(() => {
      const frame = document.querySelector(".firstrun-proof__device").getBoundingClientRect(), rig = document.querySelector(".firstrun-proof__rig");
      const screen = document.querySelector("#firstRunDemo");
      const out = [];
      for (const time of [2, 3.6, 5, 9.2, 13.6, 16.6]) {
        window.__repforgeLandingSeek(time);
        const k = rig.getBoundingClientRect().width / rig.offsetWidth;
        const check = (selector, margin) => screen.querySelectorAll(selector).forEach((node) => {
          const r = node.getBoundingClientRect();
          const inside = r.top >= frame.top - k && r.bottom <= frame.bottom + k;
          const outside = r.bottom <= frame.top - margin * k + .5 || r.top >= frame.bottom + margin * k - .5;
          if (!inside && !outside) out.push(`${time}s ${node.className.split(" ")[0]} ${Math.round(r.top - frame.top)}..${Math.round(r.bottom - frame.top)} of ${Math.round(frame.height)}`);
        });
        check(".firstrun-demo__shelf .shelf__field, .firstrun-demo__shelf .stepbtn, .firstrun-demo__shelf .saveset", 8);
        check(".wo-head, .fx-cue__l1, .fx-cue__l2, .fx-cue__evidence, .firstrun-demo__card .fcard__ledger > .ledgerline__head, .firstrun-demo__row, .firstrun-demo__card .fcard__ledger > .ledgerline, .firstrun-demo__next", 0);
      }
      return out;
    });
    assert(cuts.length === 0, `[${lang} ${width}] no settled shot cuts the shelf's controls, the cue or the ledger at the frame's edges`, JSON.stringify(cuts.slice(0, 6)));
    await context.close();
  }
  for (const [width, height] of [[390, 844], [320, 568]]) for (const lang of ["en", "pt"]) {
    const { context, page } = await landingPage(browser, { lang, width, height });
    await scrollToDevice(page);
    const captions = await page.evaluate(() => {
      const stage = document.querySelector(".firstrun-proof__stage").getBoundingClientRect();
      const texts = [...document.querySelectorAll(".firstrun-chapter__text")];
      const row = Math.max(...texts.map((node) => node.getBoundingClientRect().height));
      return texts.map((node, i) => {
        const r = node.getBoundingClientRect();
        return { i, inside: r.top >= stage.top - .5 && r.bottom <= stage.bottom + .5, whole: node.scrollHeight <= node.clientHeight + 1, row: Math.abs(r.height - row) < 1 };
      }).filter((c) => !c.inside || !c.whole || !c.row);
    });
    assert(captions.length === 0, `[${lang} ${width}] every chapter caption is whole inside the stage, in a row as tall as the longest`, JSON.stringify(captions));
    await context.close();
  }

  // The Build control never covers a stage (the polish brief): scrolled through the page, wherever the control shows,
  // its box meets no `data-landing-stage`; and it is back once the stages are past.
  phase("The Build control steps aside for the stages");
  for (const [width, height] of [[390, 844], [375, 667], [320, 568]]) {
    const { context, page } = await landingPage(browser, { lang: "pt", width, height });
    const sweep = await page.evaluate(async () => {
      const root = document.querySelector("#firstRun"), dock = document.querySelector("#firstRunDock");
      const stages = [...root.querySelectorAll("[data-landing-stage]")];
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const hits = [], shown = [];
      for (let top = 0; top <= root.scrollHeight - root.clientHeight; top += Math.round(root.clientHeight / 5)) {
        root.scrollTo({ top, behavior: "instant" });
        await wait(320);
        if (!dock.classList.contains("is-on")) continue;
        const d = dock.getBoundingClientRect();
        shown.push(top);
        for (const stage of stages) {
          const r = stage.getBoundingClientRect();
          if (r.bottom > d.top && r.top < d.bottom && r.bottom > 0 && r.top < innerHeight) hits.push({ top, stage: stage.className, dock: Math.round(d.top), from: Math.round(r.top), to: Math.round(r.bottom) });
        }
      }
      return { stages: stages.length, hits: hits.slice(0, 4), shown: shown.length };
    });
    assert(sweep.stages === 2 && sweep.hits.length === 0, `[${width}×${height}] wherever the Build control shows, it covers no stage`, JSON.stringify(sweep));
    assert(sweep.shown > 0, `[${width}×${height}] the Build control still shows past the stages`, JSON.stringify(sweep));
    await context.close();
  }

  // Reduced motion: no clock, a still per chapter, and the chapters switch it.
  phase("Proof player: stills under reduced motion");
  {
    const { context, page } = await landingPage(browser, { lang: "pt", reducedMotion: true });
    await scrollToDevice(page);
    await page.waitForTimeout(500);
    const first = await page.evaluate(proofState);
    assert(first.open && !first.playing && first.frames === 0 && first.chapter === 0, "reduced motion: on screen, nothing plays", JSON.stringify(first));
    await page.click('[data-chapter="2"]');
    await page.waitForTimeout(300);
    const third = await page.evaluate(chapterState);
    const ctl = await page.evaluate(proofState);
    assert(ctl.chapter === 2 && !ctl.playing && third.current[0] === 2 && third.captions === 1 && third.tab === tr("pt", "rest.inline.done"),
      "reduced motion: a chapter switches the still (Rest at a glance shows the app's Descanso concluído)", JSON.stringify({ ctl, third }));
    assert(!third.overflowX, "reduced motion: no horizontal scroll", JSON.stringify(third));
    await context.close();
  }

  // Phones: the device and its chapters fit one viewport above the Build control.
  phase("Proof: the phone and its chapters fit the viewport");
  for (const [width, height, strict] of [[390, 844, true], [375, 667, true], [320, 568, false]]) {
    const { context, page } = await landingPage(browser, { lang: "en", width, height });
    await scrollToDevice(page);
    const fit = await page.evaluate(() => {
      const device = document.querySelector(".firstrun-proof__device").getBoundingClientRect();
      const chips = [...document.querySelectorAll("[data-chapter]")].map((button) => button.getBoundingClientRect());
      const dock = document.querySelector("#firstRunDock")?.getBoundingClientRect();
      return { deviceTop: Math.round(device.top), deviceBottom: Math.round(device.bottom), chipsBottom: Math.round(Math.max(...chips.map((b) => b.bottom))),
        chipMin: Math.round(Math.min(...chips.map((b) => Math.min(b.width, b.height)))), dockTop: dock && dock.height ? Math.round(dock.top) : innerHeight,
        overflowX: document.documentElement.scrollWidth > innerWidth };
    });
    const room = fit.dockTop - 4;
    if (strict) assert(fit.chipsBottom <= room, `${width} x ${height}: the phone and its chapter chips fit above the Build control without scrolling`, JSON.stringify(fit));
    else assert(fit.deviceBottom <= room, `${width} x ${height}: the phone fits above the Build control; its chips may sit just below`, JSON.stringify(fit));
    assert(fit.chipMin >= 44 && !fit.overflowX, `${width} x ${height}: every chapter chip is at least 44 px and nothing scrolls sideways`, JSON.stringify(fit));
    await context.close();
  }

  // Actions on the standard landing.
  phase("Final page: the dock, the footer link, the paste disclosure, the questions");
  {
    const { context, page } = await landingPage(browser, { lang: "en" });
    await scrollLanding(page, '#firstRun [data-landing-section="data"]');
    await page.click("#firstRunCreateDock");
    await page.waitForSelector("#onboarding.active", { timeout: 10000 });
    await page.waitForSelector('[data-entry-hub="recommend"]', { timeout: 10000 });
    const snap = await storageSnapshot(page);
    assert(!snap.onboarded && snap.programRows === 0 && snap.logRows === 0, "the dock opens the hub like Build, without saving a program", JSON.stringify(snap));
    await context.close();
  }
  {
    const { context, page } = await landingPage(browser, { lang: "en" });
    await scrollLanding(page, '#firstRun [data-landing-section="footer"]');
    await page.click("#firstRunFooterPrivacy");
    await page.waitForTimeout(900);
    const result = await page.evaluate(() => ({
      sheet: !document.querySelector("#privacySheet")?.hidden,
      focus: document.activeElement?.id || null,
      hash: location.hash,
      landing: !document.querySelector("#firstRun")?.classList.contains("hidden"),
    }));
    assert(!result.sheet && result.focus === "firstRunData" && result.hash === "" && result.landing,
      "the footer Privacy link moves to the data band and focuses it; it does not open the sheet or change the address", JSON.stringify(result));

    // The paste disclosure.
    await page.evaluate(() => document.querySelector("#firstRunHandBtn").scrollIntoView({ block: "center", behavior: "instant" }));
    const closed = await page.evaluate(() => ({ expanded: document.querySelector("#firstRunHandBtn").getAttribute("aria-expanded"), hidden: document.querySelector("#firstRunHand").hidden }));
    await page.click("#firstRunHandBtn");
    const opened = await page.evaluate(() => ({
      expanded: document.querySelector("#firstRunHandBtn").getAttribute("aria-expanded"), hidden: document.querySelector("#firstRunHand").hidden,
      alt: document.querySelector("#firstRunHand img")?.getAttribute("alt") || "",
      where: (document.querySelector('[data-landing-fill="ways.where"]')?.textContent || "").replace(/\s+/g, " ").trim(),
      message: document.querySelector("#firstRunHand pre")?.textContent || "",
    }));
    assert(closed.expanded === "false" && closed.hidden === true && opened.expanded === "true" && opened.hidden === false,
      "the paste disclosure toggles aria-expanded and the region", JSON.stringify({ closed, opened }));
    assert(opened.message === tr("en", "landing.ways.paste.message"), "the sample coach message is the catalog's", opened.message);
    assert(opened.alt.includes(tr("en", "import.heading")) && opened.alt.includes(tr("en", "import.status.probable")), "the paste screenshot has a descriptive alt", opened.alt);
    assert(opened.where === tr("en", "landing.ways.paste.where", { track: tr("en", "landing.track"), hub: tr("en", "entry.hub.title"), own: tr("en", "entry.hub.b.import.title"), paste: tr("en", "entry.import_source.to_freeform") }),
      "the where-to-paste line names the app's own controls", opened.where);

    // Questions are native <details>; Tab leaves a summary for the next stop, not for the top of the page.
    await page.evaluate(() => document.querySelector('[data-landing-section="faq"] details summary').scrollIntoView({ block: "center", behavior: "instant" }));
    await page.locator('[data-landing-section="faq"] details summary').first().focus();
    await page.keyboard.press("Tab");
    const next = await page.evaluate(() => ({ inFaq: !!document.activeElement?.closest('[data-landing-section="faq"]'), tag: document.activeElement?.tagName }));
    assert(next.inFaq && next.tag === "SUMMARY", "Tab moves from one question to the next, not back to the first tab stop", JSON.stringify(next));
    await page.keyboard.press("Enter");
    const toggled = await page.evaluate(() => document.querySelectorAll('[data-landing-section="faq"] details[open]').length);
    assert(toggled === 1, "Enter on a focused question opens it", String(toggled));
    await context.close();
  }

  // The invalid link keeps the safe actions, so the dock is allowed there.
  phase("Final page, invalid link: Build and Track stay, and so may the dock");
  {
    const { context, page } = await openAppPage(browser, { ua: ANDROID_UA, locale: LOCALE.en });
    await clearSite(page);
    await page.goto(`${APP_INDEX}?landing-variants=final-invalid#setup=v1.not+base64`, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await waitForFirstRun(page);
    await scrollLanding(page, '#firstRun [data-landing-section="data"]');
    const dock = await page.evaluate(dockState);
    assert(dock.present && dock.visible, "the dock shows on the invalid-link landing once the hero action is behind", JSON.stringify(dock));
    await context.close();
  }

  // The dock never appears on the confirmation gate.
  phase("Final page, shared link: no persistent Build control");
  {
    const { context, page } = await openAppPage(browser, { ua: ANDROID_UA, locale: LOCALE.en });
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await waitForFirstRun(page);
    const encoded = await encodeSetupLink(page, { name: "Coach program" });
    await page.goto(`${APP_INDEX}?landing-variants=final-shared#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    await page.waitForSelector("#firstRunSharedProgram:not(.hidden)", { timeout: 10000 });
    const f = await page.evaluate(readFinal, SECTIONS);
    assert(f.sections.hero, "the shared gate is the new page's hero (data-landing-section=\"hero\" present)");
    // Scroll through the whole page, then to the end: the dock must never appear and no Build/Track may surface.
    for (const selector of ['#firstRun [data-landing-section="proof"]', '#firstRun [data-landing-section="close"]', '#firstRun [data-landing-section="footer"]']) {
      await scrollLanding(page, selector);
      const dock = await page.evaluate(dockState);
      const gate = await page.evaluate(sharedGateSnapshot);
      assert(!dock.visible, `the dock is not shown on the shared gate (at ${selector.match(/"(\w+)"/)?.[1] ?? selector})`, JSON.stringify(dock));
      assert(!gate.createVisible && !gate.importVisible, "no Build or Track is visible on the shared gate", JSON.stringify(gate));
    }
    const ctl = await page.evaluate(proofState);
    assert(ctl?.open && ctl.observers === 5, "the shared gate watches no hero action: the dock logic is not mounted; the status-bar band, the proof's player and the feature tabs observe", JSON.stringify(ctl));
    const close = await page.evaluate(() => ({
      actions: getComputedStyle(document.querySelector(".firstrun-close__actions")).display,
      dockDisplay: getComputedStyle(document.querySelector("#firstRunDock")).display,
    }));
    assert(close.actions === "none" && close.dockDisplay === "none", "the closing actions and the dock are removed from the shared gate", JSON.stringify(close));
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// RF-7: the persistent Build control's focus ring against the band it floats over.
// A focus indicator needs 3:1 against what it sits next to (WCAG 1.4.11). The ring
// is drawn outside the control, so its neighbour is the band beneath the dock, not
// the control. The dock takes its ground from that band (`data-ground`), and the
// ring must follow the same ground in both themes.
// ---------------------------------------------------------------------------
const RING_MIN = 3;
const RING_BANDS = [
  ['[data-landing-section="proof"]', "proof band"],
  ['[data-landing-section="ways"] .firstrun-way--field', "ways: orange"],
  ['[data-landing-section="ways"] .firstrun-way--surface', "ways: surface"],
  ['[data-landing-section="ways"] .firstrun-way--ink', "ways: ink"],
  ['[data-landing-section="features"]', "features band"],
  ['[data-landing-section="data"]', "data band (ink)"],
  ['[data-landing-section="faq"]', "faq band"],
];

/** Runs in the page: scroll `selector` under the dock, focus the dock by keyboard, read the ring and what is behind it. */
const readDockRing = async (selector) => {
  const root = document.querySelector("#firstRun");
  const dock = document.querySelector("#firstRunDock");
  const cta = document.querySelector("#firstRunCreateDock");
  const band = document.querySelector(selector);
  if (!root || !dock || !cta || !band) return { skipped: "missing", selector };
  // Put the band's top 48px above the dock so the ring's whole neighbourhood is on this band.
  root.scrollTop += band.getBoundingClientRect().top - (dock.getBoundingClientRect().top - 48);
  await new Promise((resolve) => setTimeout(resolve, 600));
  const bandBox = band.getBoundingClientRect(), box = cta.getBoundingClientRect();
  if (!dock.classList.contains("is-on")) return { skipped: "dock hidden", selector };
  if (bandBox.top > box.top - 8 || bandBox.bottom < box.bottom + 8) return { skipped: "band does not cover the dock", selector };
  cta.focus({ focusVisible: true });
  const style = getComputedStyle(cta);
  if (!cta.matches(":focus-visible")) return { skipped: "not focus-visible", selector };
  // The first painted background beneath the ring, as the dock itself reads its ground.
  const x = box.left + box.width / 2, y = box.bottom + 4;
  let behind = null;
  for (const hit of document.elementsFromPoint(x, y)) {
    if (dock.contains(hit)) continue;
    for (let node = hit; node && node !== document.documentElement; node = node.parentElement) {
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(getComputedStyle(node).backgroundColor);
      if (m && (m[4] === undefined || +m[4] > 0.5)) { behind = [+m[1], +m[2], +m[3]]; break; }
    }
    if (behind) break;
  }
  const ring = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(style.outlineColor);
  return {
    selector, ground: dock.dataset.ground || null,
    ring: ring ? [+ring[1], +ring[2], +ring[3]] : null, behind,
    width: parseFloat(style.outlineWidth), style: style.outlineStyle,
  };
};
const relativeLuminance = ([r, g, b]) => {
  const lin = (value) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrastRatio = (a, b) => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

async function dockFocusRing(browser) {
  phase("Persistent Build control: the focus ring reads 3:1 against every band beneath it, in both themes");
  for (const theme of ["light", "dark"]) {
    const { context, page } = await landingPage(browser, { lang: "en", theme, reducedMotion: true });
    // The hero action must be behind the reader for the dock to show.
    await scrollLanding(page, '#firstRun [data-landing-section="proof"]');
    const measured = [];
    for (const [selector, label] of RING_BANDS) {
      const reading = await page.evaluate(readDockRing, selector);
      measured.push({ label, ...reading });
    }
    const read = measured.filter((entry) => !entry.skipped);
    for (const entry of read) {
      const ok = entry.ring && entry.behind && entry.style !== "none" && entry.width >= 2;
      const ratio = ok ? contrastRatio(entry.ring, entry.behind) : 0;
      assert(ok && ratio >= RING_MIN, `[${theme}] ring over ${entry.label} (${entry.ground} ground) is ${ratio.toFixed(2)}:1, needs ${RING_MIN}:1`, JSON.stringify(entry));
    }
    assert(read.some((entry) => entry.label.includes("ink")) && read.length >= 4,
      `[${theme}] the check read the ink band and at least four bands`, JSON.stringify(measured.map((entry) => [entry.label, entry.skipped || "read"])));
    await context.close();
  }
}

// ---------------------------------------------------------------------------
async function main() {
  console.log(`Landing variants\nTarget: ${BASE}${FAULT ? `\nFault: ${FAULT}` : ""}`);
  engineTruth();
  copyPins();
  const browser = await launchChromium();
  try {
    await characterize(browser);
    await finalPage(browser);
    await dockFocusRing(browser);
  } finally {
    await browser.close();
  }
  console.log(`\nlanding variants: ${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("landing-variants.mjs crashed:", err);
  process.exit(2);
});
