#!/usr/bin/env node
/**
 * Public landing: the five shared/standard/install variants, characterized
 * (Plan 064 R2a-A, step 1).
 *
 * The suite pins only what the lifter and the confirmation gate depend on,
 * through production IDs, and reads every expected string from the i18n
 * catalogs so a copy change cannot break it. No composition selector appears
 * here (no hero figure, no stage, no beat): the page layout is free to change,
 * and this suite must keep passing when it does.
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
 * Run: node test/landing-variants.mjs   (with a static server on REPFORGE_URL)
 */
import { readFileSync } from "node:fs";
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

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const FAULT = process.env.REPFORGE_LANDING_VARIANTS_FAULT;

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
async function landingPage(browser, { ua = ANDROID_UA, lang = "en", standalone = false, width = 390, height = 844 } = {}) {
  const { context, page, errors } = await openAppPage(browser, { ua, locale: LOCALE[lang], standalone, width, height });
  await clearSite(page);
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
// Characterization
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
    assert(s.lede === tr(lang, "landing.body"), `[${lang}] lede is landing.body`, s.lede);
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
    const second = await page.evaluate(() => ({
      landing: !document.querySelector("#firstRun")?.classList.contains("hidden"),
      noProgram: !document.querySelector("#todayNoProgram")?.classList.contains("hidden"),
    }));
    assert(!second.landing && second.noProgram, "a second empty visit boots Today's no-program state, not the landing", JSON.stringify(second));
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

// ---------------------------------------------------------------------------
async function main() {
  console.log(`Landing variants\nTarget: ${BASE}${FAULT ? `\nFault: ${FAULT}` : ""}`);
  const browser = await launchChromium();
  try {
    await characterize(browser);
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
