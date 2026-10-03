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
 * Also always on, and Node-only: the engine-truth oracle. The three recommendation
 * cases the final page shows are evaluated here with progression-engine.js and
 * the app's own default settings, and the chart figures (92.5 -> 100 kg over 4
 * sessions, owner decision L-2) are derived with progress-model.js from the exact
 * history the chart image was captured from (tools/landing-prototype/fixture.mjs).
 *
 * PART 2 - the final page (always on since the page packet landed). It asserts
 * that each section exists, that the proof has seven steps, that the three
 * outcome cases and the chart show the oracle's numbers, that the FAQ has five
 * <details>, that the persistent Build dock exists on the standard landing but
 * never on the shared-link gate, and that the proof controller mounts and
 * disposes with the gate (nothing it starts outlives the landing) and degrades
 * to static cards under reduced motion, enlarged text and short screens.
 *
 * Hooks PART 2 reads (all inside #firstRun):
 *   [data-landing-section="hero|proof|ways|track|data|faq|close|footer"]
 *   [data-landing-step]            x7 in the proof section, in order; the last is
 *                                  the result step
 *   [data-landing-outcome="add|hold|reduce"]  x3 in the track section, each with a
 *                                  [data-landing-next] element holding the next target
 *   [data-landing-chart]           the chart figure (an <img alt> and a <figcaption>)
 *   details.faq                    x5 in the faq section
 *   #firstRunCreateDock            the persistent Build control; absent on the
 *                                  valid shared-link gate
 *   window.__repforgeLandingProof()  what the open landing's proof controller holds
 *
 * Run: node test/landing-variants.mjs   (with a static server on REPFORGE_URL)
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { isDeepStrictEqual } from "node:util";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { MINIMAL_PAYLOAD, REPRESENTATIVE_PAYLOAD, cloneFixture } from "./fixtures/shared-setup.mjs";
import {
  APP_INDEX,
  encodeSharedPayload,
  openAppPage,
  sharedGateSnapshot,
  waitForFirstRun,
} from "./shared-setup-flow.mjs";
import { realisticState } from "../tools/landing-prototype/fixture.mjs";
import { CHART_FRAME, CHART_MIN_SCALE, webpSize } from "../tools/capture-landing-proof.mjs";

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
// Engine-truth oracle (Node only). Mirrors app.js progressionInput() with the
// settings the app ships (DEFAULTS in app.js), range@1 prescriptions, one
// logged session as history. The numbers are whatever the engine says.
// ---------------------------------------------------------------------------
const Engine = require("../progression-engine.js");
const ProgressModel = require("../progress-model.js");
const APP_SOURCE = readFileSync(new URL("../app.js", import.meta.url), "latin1");
const APP_DEFAULTS = (() => {
  const match = /const DEFAULTS=(\{[^\n]*?\});\n/.exec(APP_SOURCE);
  if (!match) throw new Error("app.js DEFAULTS literal not found");
  return new Function(`"use strict";return (${match[1]});`)();
})();

/** The inputs of the three outcome cases the final page shows. */
const LANDING_CASES = Object.freeze({
  add: { exercise: "bench", repMin: 8, repMax: 10, logged: [[60, 10, 2], [60, 10, 2], [60, 10, 2]], status: "advance", reason: "range.performed_top" },
  hold: { exercise: "squat", repMin: 5, repMax: 8, logged: [[100, 8, 1], [100, 7, 0], [100, 6, 0]], status: "hold", reason: "range.room_in_range" },
  reduce: { exercise: "bench", repMin: 8, repMax: 10, logged: [[70, 7, 0], [70, 6, 0], [70, 6, 0]], status: "reduce", reason: "range.below_floor" },
});
const SETS = 3;

function engineSettings() {
  const raw = +APP_DEFAULTS.minJump;
  return {
    minLoadIncrement: Number.isFinite(raw) && raw > 0 ? raw : 2.5,
    jumpPercent: +APP_DEFAULTS.jumpPct || 0,
    hardRir: +APP_DEFAULTS.hardRir || 4,
  };
}
function runEngineCase(c) {
  const result = Engine.evaluateProgression({
    engineVersion: 1,
    prescription: { schemaVersion: 1, strategy: { id: "range", version: 1, params: { workingSets: SETS, repMin: c.repMin, repMax: c.repMax } }, modifiers: [] },
    relation: null,
    modifiers: [],
    settings: engineSettings(),
    history: [{ sessionId: "landing-case", date: "2026-09-01", sets: c.logged.map(([load, reps, rir]) => ({ load, reps, rir })) }],
    currentSession: [],
    context: { weekNumber: 1, blockLength: 6, blockStart: null },
  });
  if (result.kind !== "recommendation") throw new Error(`engine did not recommend: ${JSON.stringify(result)}`);
  return { status: result.status, reason: result.reasonCodes[0], load: result.facts.targetLoad, reps: result.facts.targetReps };
}
const ENGINE = Object.fromEntries(Object.entries(LANDING_CASES).map(([id, c]) => [id, runEngineCase(c)]));

/** The chart figures, derived with the app's Progress model from the history the chart image is captured from. */
const CHART_COPY = Object.freeze({ from: 92.5, to: 100, sessions: 4 });
function deriveChart(lang) {
  const state = realisticState(lang);
  const series = ProgressModel.buildStrengthEvidence("all-history", "ex-squat", state.log, { started: state.programMeta.started });
  const values = series.points.map((point) => point.value);
  return { from: values[0], to: values.at(-1), sessions: series.evidenceCount, values, presentation: series.presentation };
}

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
async function landingPage(browser, { ua = ANDROID_UA, lang = "en", standalone = false, width = 390, height = 844, reducedMotion = false, theme = null } = {}) {
  const { context, page, errors } = await openAppPage(browser, { ua, locale: LOCALE[lang], standalone, width, height });
  if (reducedMotion) await page.emulateMedia({ reducedMotion: "reduce" });
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
    await page.waitForSelector('[data-entry-route="recommend"]', { timeout: 10000 });
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
    // Owner decision on #295 (landing until onboarding): a second empty visit
    // shows the landing again, in its returning form, with Today's no-program
    // state behind it and no chooser opened by itself.
    const second = await page.evaluate(() => ({
      landing: !document.querySelector("#firstRun")?.classList.contains("hidden"),
      visit: document.querySelector("#firstRun")?.dataset.entryVisit || null,
      noProgram: !document.querySelector("#todayNoProgram")?.classList.contains("hidden"),
      chooser: !!document.querySelector("#onboarding")?.classList.contains("active"),
    }));
    assert(second.landing && second.visit === "returning" && second.noProgram && !second.chooser,
      "a second empty visit shows the returning landing over Today's no-program state, not the chooser", JSON.stringify(second));
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
  for (const [lang, payload] of [["en", MINIMAL_PAYLOAD], ["pt", REPRESENTATIVE_PAYLOAD]]) {
    // The page language is payload data, so the locale is deliberately the other one.
    const { context, page, errors } = await openAppPage(browser, { ua: ANDROID_UA, locale: LOCALE[lang === "en" ? "pt" : "en"] });
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await waitForFirstRun(page);
    const encoded = await encodeSharedPayload(page, cloneFixture(payload));
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
    assert(s.headline === tr(lang, "landing.shared.headline"), `[${lang}] headline is landing.shared.headline`, s.headline);
    assert(s.lede === tr(lang, "landing.shared.body"), `[${lang}] lede is landing.shared.body`, s.lede);
    assert(gate.startVisible && gate.startTitle === tr(lang, "setup.shared.title"), `[${lang}] the one action is setup.shared.title`, JSON.stringify(gate.startTitle));
    const capOk = templateRe(lang, "setup.shared.cap_one").test(squash(gate.startCap)) || templateRe(lang, "setup.shared.cap_many").test(squash(gate.startCap));
    assert(capOk && squash(gate.startCap).startsWith(payload.program.meta.name), `[${lang}] the caption names the program and its days`, gate.startCap);
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
    assert(post.setupDraft !== null, `[${lang}] Start stages the reviewed program in the setup draft`);
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
    const reasons = ["setup.shared.invalid", "setup.shared.unsupported", "setup.shared.browser_unsupported"].map((key) => tr(lang, key));
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
  phase("Engine truth: the landing's recommendation cases, with the app's default settings");
  assert(
    isDeepStrictEqual(engineSettings(), { minLoadIncrement: 2.5, jumpPercent: 2.5, hardRir: 4 }),
    "the settings used are the app defaults (2.5 kg step, 2.5% jump, hard RIR 4)",
    JSON.stringify({ defaults: APP_DEFAULTS, settings: engineSettings() })
  );
  for (const [id, c] of Object.entries(LANDING_CASES)) {
    const got = ENGINE[id];
    assert(got.status === c.status && got.reason === c.reason, `${id}: the engine answers ${c.status} / ${c.reason}`, JSON.stringify(got));
  }
  assert(ENGINE.add.load === 62.5 && ENGINE.add.reps === 8, "add: next target is 62.5 x 8 (3 x 60 x 10 at RIR 2, range 8-10)", JSON.stringify(ENGINE.add));
  assert(ENGINE.hold.load === 100 && ENGINE.hold.reps === 8, "hold: next target is 100 x 8 (100 x 8/7/6, range 5-8)", JSON.stringify(ENGINE.hold));
  assert(ENGINE.reduce.load === 67.5 && ENGINE.reduce.reps === 8, "reduce: next target is 67.5 x 8 (70 x 7/6/6, range 8-10)", JSON.stringify(ENGINE.reduce));

  phase("Chart truth: 92.5 -> 100 kg over 4 sessions, from the Progress model over the chart's own history");
  for (const lang of ["en", "pt"]) {
    const chart = deriveChart(lang);
    assert(chart.presentation === "trend", `[${lang}] the squat history is a trend (>=3 sessions)`, JSON.stringify(chart));
    assert(chart.from === CHART_COPY.from && chart.to === CHART_COPY.to && chart.sessions === CHART_COPY.sessions,
      `[${lang}] top load ${CHART_COPY.from} -> ${CHART_COPY.to} kg over ${CHART_COPY.sessions} sessions`, JSON.stringify(chart));
  }
  // An independent recomputation, so a Progress-model quirk cannot hide a fixture change.
  const log = realisticState("en").log.filter((row) => row.exerciseId === "ex-squat");
  const bySession = new Map();
  for (const row of log) bySession.set(row.session, Math.max(bySession.get(row.session) ?? 0, row.load));
  const tops = [...bySession.values()];
  assert(tops.length === CHART_COPY.sessions && tops[0] === CHART_COPY.from && tops.at(-1) === CHART_COPY.to,
    "recomputed from the raw rows: the same first and last top loads and session count", JSON.stringify(tops));
}

// ===========================================================================
// PART 1c - copy that must stay true to the code it describes, Node only
// ===========================================================================
const RETIRED_KEYS = [
  "landing.ethos", "landing.privacy", "landing.body", "landing.closing.body", "landing.preview.alt",
  "landing.program.title", "landing.system.title", "landing.shot.focus.alt", "landing.proof.example",
  // Focus has no "Now" label since R3c: the walkthrough points at the target on the card (owner decision, #295).
  "focus.cue.now",
];
/** What the captured import-review screen shows for the sample message: the counts differ by language. */
const PASTE_COUNTS = { en: { linked: 1, review: 3 }, pt: { linked: 0, review: 4 } };
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
    for (const key of ["landing.demo.s7.text", "landing.outcomes.did_same", "landing.outcomes.did_mixed", "landing.outcomes.target", "landing.chart.caption", "landing.chart.alt"]) {
      assert(!/\d/.test(CATALOG[lang][key].replace(/\{\w+\}/g, "").replace(/e1RM/g, "")), `[${lang}] ${key} carries no hard-coded number`, CATALOG[lang][key]);
    }
    for (const key of ["landing.demo.s2.text", "landing.demo.s7.text", "landing.demo.alt.focus"]) {
      assert(!CATALOG[lang][key].includes("{now}"), `[${lang}] ${key} names no "Now" line (Focus does not render one)`, CATALOG[lang][key]);
    }
    for (const key of RETIRED_KEYS) assert(!(key in CATALOG[lang]), `[${lang}] retired key ${key} is gone`);
  }
  // The lens spots and the import-review counts are measured from the live app by
  // tools/capture-landing-proof.mjs into assets/brand/landing-proof-spots.json; the
  // page's own tables must be those numbers, so a recapture that moves a spot or a
  // count fails here instead of shipping a lens over the wrong pixels.
  const literal = (name) => {
    const match = new RegExp(`const ${name}=(\\{[\\s\\S]*?\\});\\n`).exec(APP_SOURCE);
    return match ? new Function(`"use strict";return (${match[1]});`)() : null;
  };
  const pageSpots = literal("LANDING_SPOTS"), pagePaste = literal("LANDING_PASTE_SHOT");
  assert(!!pageSpots && !!pagePaste, "app.js carries the proof's lens spots and the import-review figures");
  let stored = null;
  try { stored = JSON.parse(readFileSync(new URL("../assets/brand/landing-proof-spots.json", import.meta.url), "utf8")); } catch {}
  if (stored && pageSpots && pagePaste) {
    assert(isDeepStrictEqual(stored.scenes, pageSpots), "the lens spots in app.js equal the measured assets/brand/landing-proof-spots.json", JSON.stringify({ stored: stored.scenes, page: pageSpots }));
    const counts = Object.fromEntries(Object.entries(stored.pasteReview).map(([lang, c]) => [lang, { linked: c.linked, review: c.review }]));
    assert(isDeepStrictEqual(counts, pagePaste.counts), "the import-review counts in app.js are each language's own measured counts", JSON.stringify({ stored: counts, page: pagePaste.counts }));
    assert(stored.frame.width === 390 && stored.frame.height === 844, "the spots were measured on the 390 x 844 frame the static crops assume", JSON.stringify(stored.frame));
  } else {
    console.log("  (assets/brand/landing-proof-spots.json is not written yet: the spot table is not compared)");
  }
}

// ===========================================================================
// PART 2 - the final page
// ===========================================================================
const SECTIONS = ["hero", "proof", "ways", "track", "data", "faq", "close", "footer"];

const readFinal = (sectionNames) => {
  const root = document.querySelector("#firstRun");
  const text = (node) => (node?.textContent || "").replace(/\s+/g, " ").trim();
  const section = (name) => root?.querySelector(`[data-landing-section="${name}"]`) || null;
  const sections = Object.fromEntries(sectionNames.map((name) => [name, !!section(name)]));
  const steps = [...(section("proof")?.querySelectorAll("[data-landing-step]") || [])].map(text);
  const outcomes = {};
  for (const id of ["add", "hold", "reduce"]) {
    const node = section("track")?.querySelector(`[data-landing-outcome="${id}"]`);
    outcomes[id] = node ? { text: text(node), next: text(node.querySelector("[data-landing-next]")), explain: text(node.querySelector("[data-landing-explain]")) } : null;
  }
  const outcomeCount = section("track")?.querySelectorAll("[data-landing-outcome]").length ?? 0;
  const chartNode = section("track")?.querySelector("[data-landing-chart]") || null;
  const chart = chartNode ? {
    alt: chartNode.querySelector("img")?.getAttribute("alt") || "",
    src: chartNode.querySelector("img")?.getAttribute("src") || "",
    width: chartNode.querySelector("img")?.getAttribute("width") || "",
    height: chartNode.querySelector("img")?.getAttribute("height") || "",
    caption: text(chartNode.querySelector("figcaption")),
  } : null;
  const faq = [...(section("faq")?.querySelectorAll("details") || [])];
  const footerLink = section("footer")?.querySelector('a[href^="#"]') || null;
  const target = footerLink ? root.querySelector(footerLink.getAttribute("href")) : null;
  return {
    sections, steps, outcomes, outcomeCount, chart,
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
const stepState = () => {
  const root = document.querySelector("#firstRun");
  const steps = [...root.querySelectorAll("[data-landing-step]")];
  const shown = (node) => {
    const box = node.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && Number.parseFloat(getComputedStyle(node).opacity) > 0;
  };
  return {
    count: steps.length,
    current: steps.filter((step) => step.getAttribute("aria-current") === "step").length,
    visible: steps.filter(shown).length,
    withText: steps.filter((step) => step.textContent.trim().length > 0).length,
    pinnedClass: !!root.querySelector(".firstrun-proof__track.is-pinned"),
    phones: root.querySelectorAll(".firstrun-proof__phone").length,
    rail: root.querySelectorAll(".firstrun-proof__rail button").length,
    crops: [...root.querySelectorAll(".firstrun-step__crop")].filter(shown).length,
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

/** Scroll the landing so the pinned proof sits at the middle of step `index`. */
async function scrollToStep(page, index) {
  await page.evaluate((i) => {
    const root = document.querySelector("#firstRun");
    const track = document.querySelector("#firstRunProofTrack"), stage = document.querySelector("#firstRunProofStage");
    const span = track.offsetHeight - stage.offsetHeight;
    root.scrollTo({ top: track.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop + span * (i + 0.5) / 7, behavior: "instant" });
  }, index);
  await page.waitForTimeout(500);
}

async function finalPage(browser) {
  // Standard landing, both languages, both themes' captures.
  for (const lang of ["en", "pt"]) {
    phase(`Final page [${lang}]: sections and engine-true numbers`);
    const { context, page, errors } = await landingPage(browser, { lang });
    const f = await page.evaluate(readFinal, SECTIONS);

    for (const name of SECTIONS) assert(f.sections[name], `[${lang}] the ${name} section is present (data-landing-section="${name}")`);

    assert(f.steps.length === 7, `[${lang}] the proof has seven steps in the document`, `found ${f.steps.length}`);
    assert(f.steps.length > 0 && f.steps.every((step) => step.length > 0), `[${lang}] every proof step carries its text without the pinned stage`, JSON.stringify(f.steps.map((s) => s.length)));
    const add = LANDING_CASES.add;
    const last = f.steps.at(-1) || "";
    assert(
      hasNumber(last, ENGINE.add.load, lang) && hasNumber(last, ENGINE.add.reps, lang) && hasNumber(last, SETS, lang) &&
        hasNumber(last, add.logged[0][0], lang) && hasNumber(last, add.logged[0][1], lang) && hasNumber(last, add.repMin, lang) && hasNumber(last, add.repMax, lang),
      `[${lang}] step 7 shows the engine's next target ${ENGINE.add.load} x ${ENGINE.add.reps} and the sets it came from`, last
    );

    assert(f.outcomeCount === 3, `[${lang}] the track section shows exactly three outcomes`, `found ${f.outcomeCount}`);
    for (const id of ["add", "hold", "reduce"]) {
      const c = LANDING_CASES[id], want = ENGINE[id];
      const out = f.outcomes[id] ?? { text: "", next: "", explain: "" };
      assert(!!f.outcomes[id], `[${lang}] the ${id} outcome is present`);
      assert(hasNumber(out.next, want.load, lang) && hasNumber(out.next, want.reps, lang),
        `[${lang}] ${id}: next target equals the engine's ${want.load} x ${want.reps}`, out.next);
      const shownLoad = lang === "pt" ? String(want.load).replace(".", ",") : String(want.load);
      assert(out.next === tr(lang, "landing.outcomes.target", { load: `${shownLoad} kg`, reps: want.reps }),
        `[${lang}] ${id}: the next target is the catalog template filled with the engine's numbers`, out.next);
      assert(hasNumber(out.text, c.logged[0][0], lang) && hasNumber(out.text, c.repMin, lang) && hasNumber(out.text, c.repMax, lang),
        `[${lang}] ${id}: the card shows the logged load ${c.logged[0][0]} and the target range ${c.repMin}-${c.repMax}`, out.text);
    }
    // {list}: the language chooses the conjunction.
    const listed = lang === "pt" ? "8, 7 e 6" : "8, 7 and 6";
    assert(f.outcomes.hold?.explain.startsWith(tr(lang, "landing.outcomes.did_mixed", { list: listed, load: "100 kg", min: 5, max: 8 })),
      `[${lang}] hold: the mixed reps read "${listed}"`, f.outcomes.hold?.explain);
    assert(f.outcomes.add?.explain.startsWith(tr(lang, "landing.outcomes.did_same", { reps: 10, load: "60 kg", sets: 3, min: 8, max: 10 })),
      `[${lang}] add: identical reps use the same-reps sentence`, f.outcomes.add?.explain);
    const labels = { add: "rec.add.label", hold: "rec.hold_add_reps.label", reduce: "rec.reduce.label" };
    for (const id of Object.keys(labels)) {
      assert(!!f.outcomes[id] && f.outcomes[id].text.includes(tr(lang, labels[id])), `[${lang}] ${id}: the verdict uses the app's own label (${labels[id]})`, f.outcomes[id]?.text);
    }
    assert(f.waysWritten === tr(lang, "landing.ways.written.body", { weeks: DEFAULT_WEEKS }), `[${lang}] the ways' program length is the default ${DEFAULT_WEEKS} weeks`, f.waysWritten);

    const chart = deriveChart(lang);
    assert(!!f.chart, `[${lang}] the strength-trend figure is present (data-landing-chart)`);
    const shownChart = f.chart ?? { alt: "", caption: "", src: "", width: "", height: "" };
    assert(hasNumber(shownChart.caption, chart.from, lang) && hasNumber(shownChart.caption, chart.to, lang) && hasNumber(shownChart.caption, chart.sessions, lang),
      `[${lang}] chart caption states ${chart.from} -> ${chart.to} kg over ${chart.sessions} sessions (Progress model)`, shownChart.caption);
    // R7 V-04 (owner decision #295 comment 5965828337): the image is the Best e1RM chart region with the newest top set read
    // out under the plot, so the alt names that metric and those two numbers and never calls the picture a "top load" view.
    assert(hasNumber(shownChart.alt, chart.to, lang) && hasNumber(shownChart.alt, chart.sessions, lang) && shownChart.alt.includes(tr(lang, "stats.metric.best_e1rm")),
      `[${lang}] chart alt names ${tr(lang, "stats.metric.best_e1rm")}, the newest top set ${chart.to} kg and ${chart.sessions} sessions`, shownChart.alt);
    assert(!new RegExp(escapeRe(tr(lang, "stats.metric.top_load")), "i").test(shownChart.alt), `[${lang}] chart alt does not describe a top-load chart`, shownChart.alt);
    assert(shownChart.src.includes(`exercise-chart-${lang}-`), `[${lang}] the chart image is the ${lang} capture`, shownChart.src);
    const chartFile = webpSize(readFileSync(new URL(`../assets/brand/exercise-chart-${lang}-light.webp`, import.meta.url)));
    assert(shownChart.width === String(chartFile.width) && shownChart.height === String(chartFile.height),
      `[${lang}] the chart image reserves its box, the committed capture's ${chartFile.width}x${chartFile.height}`, `${shownChart.width}x${shownChart.height}`);

    assert(f.faqCount === 5, `[${lang}] the questions section has five <details>`, `found ${f.faqCount}`);
    assert(f.faqOpen === 0, `[${lang}] every question starts closed`);
    assert(f.rirAnswer === tr(lang, "glossary.RIR"), `[${lang}] the RIR answer is the app's own definition (glossary.RIR)`, f.rirAnswer);
    assert(f.footerPrivacyTargetsData, `[${lang}] the footer Privacy link goes to the data section, not the sheet`);
    const pasteAlt = await page.evaluate(() => document.querySelector('[data-shot="paste-review"]')?.getAttribute("alt") || "");
    const pasteTemplate = tr(lang, "landing.ways.paste.alt", { screen: tr(lang, "import.heading"), ...PASTE_COUNTS[lang], status: tr(lang, "import.status.probable") });
    const pasteRe = new RegExp(`^${escapeRe(pasteTemplate).replace(/\\\{\w+\\\}/g, ".+")}$`);
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

    // The persistent Build control: hidden at the top, present once the hero action is behind, gone at the close.
    const top = await page.evaluate(dockState);
    assert(!top.visible, `[${lang}] the dock is hidden while the hero action is on screen`, JSON.stringify(top));
    await scrollLanding(page, '#firstRun [data-landing-section="proof"]');
    const past = await page.evaluate(dockState);
    assert(past.present && past.visible, `[${lang}] #firstRunCreateDock shows once the hero action has scrolled away`, JSON.stringify(past));
    await scrollLanding(page, '#firstRun [data-landing-section="close"]');
    const closing = await page.evaluate(dockState);
    assert(!closing.visible, `[${lang}] the dock steps aside at the closing action`, JSON.stringify(closing));
    assert(errors.length === 0, `[${lang}] no uncaught page errors while the captures are missing or present`, errors.slice(0, 2).join(" | "));
    await context.close();
  }

  // Appearance follows <html data-theme>.
  phase("Final page: captures follow the chosen appearance");
  for (const theme of ["light", "dark"]) {
    const { context, page } = await landingPage(browser, { lang: "en", theme });
    const shots = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      sources: [...document.querySelectorAll("#firstRun [data-shot]")].map((img) => img.getAttribute("src")),
      proof: [...document.querySelectorAll("#firstRun [data-landing-crop]")].map((img) => img.getAttribute("src")),
    }));
    assert(shots.theme === theme && shots.sources.length === 2 && shots.sources.every((src) => src.endsWith(`-en-${theme}.webp`)),
      `[${theme}] the paste review and the chart swap to their ${theme} captures`, JSON.stringify(shots));
    assert(shots.proof.length === 7 && shots.proof.every((src) => /wt-(focus|rest|actions|note)-en-dark\.webp$/.test(src)),
      `[${theme}] the proof screens are the dark captures in either theme`, JSON.stringify(shots.proof));
    await context.close();
  }

  // The proof controller: mounts with the gate, disposes with it.
  phase("Proof controller: the pinned stage, its rail, and a clean exit");
  {
    const { context, page, errors } = await landingPage(browser, { lang: "en" });
    const open = await page.evaluate(proofState);
    assert(open?.open && open.pinned && open.listeners > 0 && open.observers === 2, "opening the landing mounts the controller with its pinned stage", JSON.stringify(open));
    await page.waitForTimeout(400);
    const before = await page.evaluate(stepState);
    assert(before.pinnedClass && before.phones === 1 && before.rail === 7 && before.count === 7 && before.current === 1,
      "the pinned stage has one phone, a seven-step rail and exactly one current step", JSON.stringify(before));
    assert(before.visible === 1, "only the current step is painted while pinned", JSON.stringify(before));
    assert(!before.overflowX, "no horizontal scroll while pinned", JSON.stringify(before));
    await scrollLanding(page, '#firstRun [data-landing-section="proof"]');
    await scrollToStep(page, 3);
    const mid = await page.evaluate(() => ({ ...window.__repforgeLandingProof(), current: document.querySelector("[data-landing-step][aria-current='step']")?.dataset.scene }));
    assert(mid.step === 3 && mid.current === "rest", "scrolling the track moves the proof to step 4 (the rest screen)", JSON.stringify(mid));
    await scrollToStep(page, 6);
    const lens = await page.evaluate(() => ({ step: window.__repforgeLandingProof().step, read: document.querySelector(".firstrun-proof__lens")?.dataset.read || null }));
    assert(lens.step === 6 && !!lens.read, "the last step puts the lens on an element", JSON.stringify(lens));
    // A rail detent scrolls to its step and marks the button current.
    await page.click('.firstrun-proof__rail button[data-go="1"]');
    await page.waitForFunction(() => window.__repforgeLandingProof().step === 1, undefined, { timeout: 4000 }).catch(() => {});
    const railed = await page.evaluate(() => ({ step: window.__repforgeLandingProof().step, current: [...document.querySelectorAll(".firstrun-proof__rail button")].map((b) => b.getAttribute("aria-current") === "step") }));
    assert(railed.step === 1 && railed.current.filter(Boolean).length === 1 && railed.current[1] === true, "a rail button scrolls to its step and is the one current button", JSON.stringify(railed));

    // Leaving the landing disposes everything the controller started.
    await page.evaluate(() => window.closeFirstRun());
    const closed = await page.evaluate(() => ({ ...window.__repforgeLandingProof(), phones: document.querySelectorAll(".firstrun-proof__phone").length, pinned: !!document.querySelector(".is-pinned") }));
    assert(closed.open === false && closed.listeners === 0 && closed.observers === 0 && closed.timers === 0 && closed.frames === 0 && closed.phones === 0 && !closed.pinned,
      "closing the landing leaves no listener, observer, timer, frame or injected node", JSON.stringify(closed));
    // And scrolling a hidden landing starts nothing.
    await page.evaluate(() => { const r = document.querySelector("#firstRun"); r.scrollTop = 50; r.dispatchEvent(new Event("scroll")); window.dispatchEvent(new Event("resize")); });
    await page.waitForTimeout(150);
    const still = await page.evaluate(() => window.__repforgeLandingProof());
    assert(still.frames === 0 && still.timers === 0 && still.listeners === 0, "scroll and resize on a closed landing start nothing", JSON.stringify(still));
    // Reopening on the same device is a return: a fresh controller mounts, and
    // the condensed returning landing leaves the proof out, so nothing pins.
    await page.evaluate(() => window.openFirstRun());
    const again = await page.evaluate(proofState);
    assert(again?.open && again.listeners > 0 && !again.pinned && again.step === null, "reopening mounts a fresh controller; the returning landing does not pin the proof", JSON.stringify(again));
    await page.evaluate(() => window.closeFirstRun());
    // A device that has not seen the landing gets the full first-visit page again.
    await page.evaluate((key) => localStorage.removeItem(key), UIKEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await waitForFirstRun(page);
    const fresh = await page.evaluate(proofState);
    assert(fresh?.open && fresh.pinned && fresh.step === 0, "a first visit mounts a fresh controller at step one", JSON.stringify(fresh));
    await page.evaluate(() => window.closeFirstRun());
    assert(errors.length === 0, "mounting and disposing raise no page errors", errors.slice(0, 2).join(" | "));
    await context.close();
  }

  // Degradation: reduced motion, enlarged text and short screens get the seven static cards.
  phase("Proof controller: static cards when the stage cannot or should not pin");
  for (const [label, opts, prepare] of [
    ["reduced motion", { reducedMotion: true }, null],
    ["a short screen (320 x 560)", { width: 320, height: 560 }, null],
    ["enlarged text (200%)", {}, async (page) => {
      await page.evaluate(() => { document.documentElement.style.fontSize = "32px"; window.dispatchEvent(new Event("resize")); });
      await page.waitForTimeout(300);
    }],
  ]) {
    const { context, page } = await landingPage(browser, { lang: "pt", ...opts });
    if (prepare) await prepare(page);
    const ctl = await page.evaluate(proofState);
    // The static cards arrive as they scroll in (Plan 064 O1); scrolled through, all seven are painted.
    for (let i = 0; i < 7; i++) {
      await page.evaluate((index) => document.querySelectorAll("[data-landing-step]")[index].scrollIntoView({ block: "center" }), i);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(400);
    const st = await page.evaluate(stepState);
    assert(ctl?.open && ctl.pinned === false, `${label}: the stage is not pinned`, JSON.stringify(ctl));
    assert(st.phones === 0 && st.rail === 0 && !st.pinnedClass, `${label}: no phone, lens or rail is built`, JSON.stringify(st));
    assert(st.count === 7 && st.visible === 7 && st.withText === 7, `${label}: all seven steps are painted with their text`, JSON.stringify(st));
    assert(st.crops === 7, `${label}: each step carries its own screen crop`, JSON.stringify(st));
    assert(!st.overflowX, `${label}: no horizontal scroll`, JSON.stringify(st));
    if (label === "enlarged text (200%)") {
      await page.evaluate(() => { document.documentElement.style.fontSize = ""; window.dispatchEvent(new Event("resize")); });
      await page.waitForTimeout(300);
      const back = await page.evaluate(proofState);
      assert(back?.pinned === true, "restoring the text size pins the stage again", JSON.stringify(back));
    }
    await context.close();
  }

  // Actions on the standard landing.
  phase("Final page: the dock, the footer link, the paste disclosure, the questions");
  {
    const { context, page } = await landingPage(browser, { lang: "en" });
    await scrollLanding(page, '#firstRun [data-landing-section="proof"]');
    await page.click("#firstRunCreateDock");
    await page.waitForSelector("#onboarding.active", { timeout: 10000 });
    await page.waitForSelector('[data-entry-route="recommend"]', { timeout: 10000 });
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
    assert(opened.where === tr("en", "landing.ways.paste.where", { track: tr("en", "landing.track"), hub: tr("en", "entry.hub.title"), own: tr("en", "entry.hub.own.title"), paste: tr("en", "entry.hub.freeform.title") }),
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
    await scrollLanding(page, '#firstRun [data-landing-section="proof"]');
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
    const encoded = await encodeSharedPayload(page, cloneFixture(MINIMAL_PAYLOAD));
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
    assert(ctl?.open && ctl.observers === 0, "the shared gate watches no hero action: the dock logic is not mounted", JSON.stringify(ctl));
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
  ['[data-landing-section="track"]', "track band"],
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

/**
 * R7 V-04 and V-08 (owner decision #295 comment 5965828337 for the chart). The chart image must be drawn at or above
 * CHART_MIN_SCALE of the CSS size it was captured at (rendered width / natural CSS width, natural = pixels / capture
 * scale), and every proof-rail button is a full 44 x 44 target at the narrowest supported widths.
 */
async function chartScaleAndRailTargets(browser) {
  phase("Final page: the chart image is legible at 360 and 390, and the proof rail buttons are 44 x 44 at 360 and 320");
  for (const lang of ["en", "pt"]) {
    for (const width of [320, 360, 390]) {
      const { context, page } = await landingPage(browser, { lang, width });
      await page.evaluate(() => document.querySelector("[data-landing-chart] img").scrollIntoView({ block: "center", behavior: "instant" }));
      await page.waitForFunction(() => { const img = document.querySelector("[data-landing-chart] img"); return img.complete && img.naturalWidth > 0; }, undefined, { timeout: 10000 });
      const read = await page.evaluate(() => {
        const img = document.querySelector("[data-landing-chart] img");
        return { rendered: img.getBoundingClientRect().width, natural: img.naturalWidth, overflowX: document.documentElement.scrollWidth > innerWidth };
      });
      const scale = read.rendered / (read.natural / CHART_FRAME.scale);
      if (width >= 360) {
        assert(scale >= CHART_MIN_SCALE, `[${lang} ${width}] the chart image draws at ${scale.toFixed(2)} of its captured size, needs ${CHART_MIN_SCALE}`, JSON.stringify(read));
      }
      assert(!read.overflowX, `[${lang} ${width}] the chart does not overflow the page`, JSON.stringify(read));
      if (width <= 360) {
        const rail = await page.evaluate(() => {
          const root = document.querySelector("#firstRun");
          root.scrollTo({ top: document.querySelector("#firstRunProofTrack").getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop, behavior: "instant" });
          return [...document.querySelectorAll(".firstrun-proof__rail button")].map((button) => {
            const box = button.getBoundingClientRect();
            return { width: Math.round(box.width * 10) / 10, height: Math.round(box.height * 10) / 10, left: Math.round(box.left), right: Math.round(box.right) };
          });
        });
        assert(rail.length === 7, `[${lang} ${width}] the pinned proof builds its seven rail buttons`, JSON.stringify(rail));
        assert(rail.every((box) => box.width >= 44 && box.height >= 44 && box.left >= 0 && box.right <= width),
          `[${lang} ${width}] every rail button is at least 44 x 44 and on screen`, JSON.stringify(rail));
      }
      await context.close();
    }
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
    await chartScaleAndRailTargets(browser);
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
