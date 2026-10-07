#!/usr/bin/env node
/**
 * Browser behaviour for shared setup links (ADR 0007, Plan 067 format).
 *
 * A setup link is `index.html#setup=v4.…`: a compressed canonical document
 * `{kind, version: 2, program: {name, definition, customExercises?},
 * settings: <eight allowlisted keys>, language}`. This suite holds the
 * guarantees that outlive the payload format:
 *
 *   outbound      the share sheet is task-only; Web Share and Copy carry the
 *                 title and URL only; the link carries the program, the eight
 *                 settings and the language, never logs or history; a blank
 *                 name travels as the localized untitled name
 *   consent       nothing is written before the explicit activation action;
 *                 Start only stages the common editable preview
 *   eligibility   only a first-run device without archived history may start a
 *                 shared program; a concurrent change rejects without a partial write
 *   handoff       a valid fragment stages the exact bytes in the
 *                 `repforge_setup_v1` cookie (path, 7 days, SameSite=Lax), is
 *                 removed from the address, reconstructs the gate from the
 *                 cookie alone in standalone mode, and is cleared on activation
 *   refusal       legacy v1/v2/v3 links, malformed, oversized and
 *                 undecodable sources fail closed without a write and clear a
 *                 staged cookie
 *   language      a Portuguese link switches the gate before acceptance and
 *                 persists only on activation
 *
 * Exports keep the helpers other browser suites use to open a shared gate.
 *
 * Run: node test/shared-setup-flow.mjs [--only=<case substring>]
 */
import { pathToFileURL } from "url";
import { gzipSync } from "zlib";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { seedProgramMeta } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
export const APP_INDEX = new URL("index.html", BASE).href;
const ONLY = process.argv
  .filter((arg) => arg.startsWith("--only="))
  .map((arg) => arg.slice("--only=".length))
  .filter(Boolean);
const KEY = "repforge_v1";
const SETUP_DRAFT = "repforge_program_setup_draft_v1";
const HANDOFF_COOKIE = "repforge_setup_v1";
const MAX_ENCODED_CHARS = 3072;
const KIND = "taurifer-shared-setup";
const DOCUMENT_VERSION = 2;
const ENCODING_VERSION = 4;
const SETTING_KEYS = ["jumpPct", "minJump", "rirHigh", "hardRir", "restSec", "unit", "lang", "rirMode"];
const DEFAULT_SHARED_SETTINGS = Object.freeze({
  jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120, unit: "kg", lang: "en", rirMode: "numeric",
});
const PT_SHARED_SETTINGS = Object.freeze({
  jumpPct: 3.5, minJump: 1.25, rirHigh: 3, hardRir: 5, restSec: 165, unit: "kg", lang: "pt", rirMode: "effort",
});
const REQUIRED_API = [
  "KIND", "VERSION", "ENCODING_VERSION", "MAX_ENCODED_CHARS", "validate", "encode", "decode",
  "readSetupFragment", "removeSetupFragment", "handoffCookiePath", "readHandoffCookie",
  "writeHandoffCookie", "clearHandoffCookie", "isSafeHandoffEnvelope",
];

export const SHARED_DOM = Object.freeze({
  standard: "#firstRunStandardProgram",
  shared: "#firstRunSharedProgram",
  start: "#firstRunSharedStart",
  error: "#firstRunSharedError",
  shareRow: "#shareProgramSetup",
  shareShare: "#shareSetupShare",
  shareCopy: "#shareSetupCopy",
});

export const SHARED_COPY = Object.freeze({
  en: {
    lede: "Review the program that was sent to you, then start it on this device.",
    ledeInstalled: "Review the program that was sent to you, then start it on this device.",
    title: "Start this program",
    capOne: (name) => `${name} · 1 day per week`,
    capMany: (name, n) => `${name} · ${n} days per week`,
    invalid: "This shared program link is invalid or incomplete.",
    unsupported: "This shared program was created by a newer version of Taurifer.",
    browserUnsupported: "This browser cannot open shared program links.",
    tooLarge: "This program is too large to share as an install-safe link.",
    existing: "This setup link can only be started during initial setup.",
    commitFailed: "The program could not be started. Try again.",
    shareUnsupported: "This browser cannot create setup links.",
    saved: "Program saved.",
    shareTitle: "Share program setup",
    shareBody: "Create a setup link for this program. Copy the link or open the system Share sheet.",
  },
  pt: {
    lede: "Revise o treino que enviaram para você e depois comece neste dispositivo.",
    ledeInstalled: "Revise o treino que enviaram para você e depois comece neste dispositivo.",
    title: "Começar este treino",
    capOne: (name) => `${name} · 1 dia por semana`,
    capMany: (name, n) => `${name} · ${n} dias por semana`,
    invalid: "Este link de treino compartilhado é inválido ou está incompleto.",
    unsupported: "Este treino compartilhado foi criado por uma versão mais recente do Taurifer.",
    browserUnsupported: "Este navegador não pode abrir links de treinos compartilhados.",
    existing: "Este link só pode ser iniciado durante a configuração inicial.",
    commitFailed: "Não foi possível iniciar o treino. Tente novamente.",
    shareUnsupported: "Este navegador não pode criar links de configuração.",
    saved: "Treino salvo.",
  },
});

const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

const results = { passed: 0, failed: 0 };

export function assert(cond, name, detail) {
  if (cond) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    console.log(`  ✗ ${name}`);
    if (detail != null) console.log(`    ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
}

/** A gzip+base64url envelope with an arbitrary version prefix, built outside the app's codec. */
export function wireFragment(value, version = 1) {
  const bytes = typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(JSON.stringify(value), "utf8");
  const b64 = gzipSync(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `v${version}.${b64}`;
}

const setupUrl = (fragment, testCase) =>
  `${APP_INDEX}?shared-test=${encodeURIComponent(testCase)}#setup=${fragment}`;

export function sharedGateSnapshot() {
  const hidden = (node) =>
    !node || node.hidden === true || node.classList.contains("hidden") || !!node.closest(".hidden,[hidden]");
  const shown = (node) => {
    if (hidden(node)) return false;
    const st = getComputedStyle(node);
    return st.display !== "none" && st.visibility !== "hidden";
  };
  const start = document.querySelector("#firstRunSharedStart");
  const error = document.querySelector("#firstRunSharedError");
  const standard = document.querySelector("#firstRunStandardProgram");
  const shared = document.querySelector("#firstRunSharedProgram");
  const create = document.querySelector("#firstRunCreate");
  const imp = document.querySelector("#firstRunImport");
  const focusable = (node) => {
    if (!node || hidden(node)) return false;
    const st = getComputedStyle(node);
    if (st.display === "none" || st.visibility === "hidden") return false;
    if (node.disabled || node.getAttribute("aria-hidden") === "true") return false;
    if (node.tabIndex < 0 && !node.matches("button,a[href],input,select,textarea")) return false;
    return true;
  };
  return {
    gate: shown(document.querySelector("#firstRun")),
    hero: !!document.querySelector(".firstrun-hero"),
    install: shown(document.querySelector("#firstRunInstall")),
    continueShown: shown(document.querySelector("#firstRunContinue")),
    lede: document.querySelector("#firstRunLede")?.textContent || null,
    standardPresent: !!standard,
    standardHidden: hidden(standard),
    sharedPresent: !!shared,
    sharedHidden: hidden(shared),
    createVisible: shown(create),
    importVisible: shown(imp),
    createFocusable: focusable(create),
    importFocusable: focusable(imp),
    startVisible: shown(start),
    startFocusable: focusable(start),
    startDisabled: !!start?.disabled,
    startBusy: start?.getAttribute("aria-busy") === "true",
    startName: (start?.innerText || "").replace(/\s+/g, " ").trim(),
    startTitle: start?.querySelector(".firstrun-row__title")?.textContent || null,
    startCap: start?.querySelector(".firstrun-row__cap")?.textContent || null,
    errorVisible: shown(error),
    errorText: (error?.textContent || "").trim(),
    errorRole: error?.getAttribute("role") || null,
    langAttr: document.documentElement.lang || null,
    i18n: window.RepForgeI18n?.getLang?.() || null,
    logActive: document.querySelector("#log")?.classList.contains("active") || false,
    onboarding: document.querySelector("#onboarding")?.classList.contains("active") || false,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
}

export function readSharedHook() {
  const hook = window.__repforgeSharedSetup;
  if (!hook) return { present: false };
  const field = (name) => {
    const value = hook[name];
    return typeof value === "function" ? value.call(hook) : value;
  };
  return {
    present: true,
    status: field("status"),
    source: field("source"),
    error: field("error"),
    summary: field("summary"),
    hasBuild: typeof hook.build === "function",
    hasCommit: typeof hook.commit === "function",
  };
}

export function readDurableState() {
  let parsed = null;
  try {
    parsed = JSON.parse(localStorage.getItem("repforge_v1") || "null");
  } catch {
    parsed = null;
  }
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("repforge_setup_v1="));
  return {
    state: parsed,
    setupDraft: localStorage.getItem("repforge_program_setup_draft_v1"),
    cookie: cookie ? decodeURIComponent(cookie.slice("repforge_setup_v1=".length)) : null,
    hash: location.hash,
    search: location.search,
    pathname: location.pathname,
  };
}

function standaloneInit() {
  return `
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) => (q.includes("display-mode: standalone")
      ? { matches: true, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
      : mm(q));
  `;
}

const INSTALL_EVENT = `
  window.__promptCalls = 0;
  window.__choice = "accepted";
  window.__fireInstall = () => {
    const evt = new Event("beforeinstallprompt");
    evt.prompt = () => { window.__promptCalls++; };
    evt.userChoice = new Promise((res) => setTimeout(() => res({ outcome: window.__choice }), 10));
    window.dispatchEvent(evt);
  };
`;

export async function openAppPage(browser, {
  ua = ANDROID_UA,
  locale = "en-US",
  standalone = false,
  width = 390,
  height = 844,
  hash = "",
  search = "",
  noCompression = false,
  webShare = false,
  clipboard = false,
} = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    userAgent: ua,
    locale,
    hasTouch: true,
    serviceWorkers: "block",
    ...(clipboard ? { permissions: ["clipboard-read", "clipboard-write"] } : {}),
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  if (standalone) await page.addInitScript(standaloneInit());
  if (noCompression) {
    await page.addInitScript(() => {
      try { delete window.CompressionStream; } catch {}
      try { delete window.DecompressionStream; } catch {}
    });
  }
  if (webShare) {
    await page.addInitScript(() => {
      window.__repforgeShareCalls = [];
      const share = async (data) => {
        const payload = {};
        if (data && typeof data === "object") {
          for (const key of Object.keys(data)) payload[key] = data[key];
        }
        window.__repforgeShareCalls.push(payload);
      };
      Object.defineProperty(navigator, "share", { configurable: true, value: share });
    });
  }
  await page.addInitScript(INSTALL_EVENT);
  const url = `${APP_INDEX}${search}${hash}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { timeout: 15000, base: BASE });
  const booted = await page.evaluate(() => window.__repforgeBooted === true);
  if (!booted) throw new Error("openAppPage returned before the app boot contract was satisfied");
  return { context, page, errors };
}

/**
 * A current setup document, built in the page from the app's own catalog. One
 * training day uses the seed fixture's Build definition with its other training
 * days turned into rest days; two to six days use a real generated program,
 * which the codec carries as its generator request and seed.
 */
export async function buildSetupDocument(page, {
  name = "Coach program",
  settings = DEFAULT_SHARED_SETTINGS,
  trainingDays = 1,
  seed = "shared-setup-flow",
} = {}) {
  const shared = Object.fromEntries(SETTING_KEYS.map((key) => [key, settings[key] ?? DEFAULT_SHARED_SETTINGS[key]]));
  const seedDefinition = trainingDays === 1 ? seedProgramMeta().programDefinition : null;
  return page.evaluate(({ name, settings, trainingDays, seed, seedDefinition }) => {
    const api = window.RepForgeSharedSetup;
    let definition;
    if (seedDefinition) {
      let kept = 0;
      definition = {
        ...seedDefinition,
        days: seedDefinition.days.map((day, index) => {
          if (day.kind !== "training" || kept++ === 0) return day;
          return { ...day, kind: "rest", name: `Rest ${index + 1}`, slots: [] };
        }),
      };
    } else {
      const catalog = window.RepForgeExerciseCatalog.snapshot();
      const request = window.RepForgeProgramEntryAdapter.programRequestFromAnswers({
        desiredResult: "muscle_growth", structuredExperience: "6_to_24m",
        daysPerWeek: Math.min(6, Math.max(2, trainingDays)), sessionMinutes: 60,
        environment: { kind: "commercial_gym" },
      }, catalog).value;
      definition = window.RepForgeProgramCompiler.generateProgram(request, catalog, seed).value;
    }
    return { kind: api.KIND, version: api.VERSION, program: { name, definition }, settings, language: settings.lang };
  }, { name, settings: shared, trainingDays, seed, seedDefinition });
}

/** Encode a current setup document with the app's codec and its production options. */
export async function encodeSetupDocument(page, document) {
  return page.evaluate(async (document) => {
    const api = window.RepForgeSharedSetup;
    const compiler = window.RepForgeProgramCompiler;
    if (!api || typeof api.encode !== "function") return { ok: false, code: "missing-module", missing: true };
    const result = await api.encode(document, {
      catalogSnapshot: window.RepForgeExerciseCatalog.snapshot(),
      validateProgramDefinition: compiler.validateProgramDefinition,
      generateProgram: compiler.generateProgram,
      generatorVersion: compiler.GENERATOR_VERSION,
    });
    return result && typeof result === "object" ? result : { ok: false, code: "invalid-result" };
  }, document);
}

/** Decode a link fragment with the app's codec and its production options. */
async function decodeSetup(page, encoded) {
  return page.evaluate(async (encoded) => {
    const api = window.RepForgeSharedSetup;
    const compiler = window.RepForgeProgramCompiler;
    return api.decode(encoded, {
      catalogSnapshot: window.RepForgeExerciseCatalog.snapshot(),
      validateProgramDefinition: compiler.validateProgramDefinition,
      generateProgram: compiler.generateProgram,
      generatorVersion: compiler.GENERATOR_VERSION,
    });
  }, encoded);
}

/**
 * Encode a setup link for browser suites that only need a shared gate. A
 * current document (`program.definition`) is encoded as it is. A retired
 * flat-program fixture is translated: its name, eight settings, language and
 * training-day count become a current document; its exercise rows do not.
 */
export async function encodeSharedPayload(page, payload) {
  if (payload?.program?.definition) return encodeSetupDocument(page, payload);
  const exercises = Array.isArray(payload?.program?.exercises) ? payload.program.exercises : [];
  const document = await buildSetupDocument(page, {
    name: payload?.program?.meta?.name ?? payload?.program?.name ?? "Coach program",
    settings: { ...DEFAULT_SHARED_SETTINGS, ...(payload?.settings || {}) },
    trainingDays: Math.max(1, new Set(exercises.map((exercise) => exercise.day)).size),
  });
  return encodeSetupDocument(page, document);
}

async function waitForShareSetupLink(page) {
  await page.waitForFunction(() => {
    const copy = document.querySelector("#shareSetupCopy");
    const status = document.querySelector("#shareSetupStatus");
    return (copy && !copy.disabled) ||
      (status && !status.classList.contains("hidden") && !/preparing|preparando/i.test(status.textContent || ""));
  }, null, { timeout: 15000 });
}

async function readShareSetupLink(page) {
  return page.evaluate(() => {
    const link = document.querySelector("#shareSetupLink");
    return ((link && ("value" in link ? link.value : link.textContent)) || "").trim();
  });
}

export async function waitForFirstRun(page, timeout = 15000) {
  await page.waitForSelector("#firstRun:not(.hidden)", { timeout });
  const expectsSetup = await page.evaluate(() => {
    const status = window.__repforgeSharedSetup?.status;
    const value = typeof status === "function" ? status() : status;
    return new URLSearchParams(location.hash.slice(1)).has("setup") ||
      value === "loading" || value === "ready" || value === "invalid" || value === "unsupported";
  });
  if (expectsSetup) await page.waitForFunction(() => {
    const status = window.__repforgeSharedSetup?.status;
    const value = typeof status === "function" ? status() : status;
    return ["ready", "invalid", "unsupported", "existing"].includes(value);
  }, null, { timeout });
}

async function clickSharedStart(page, { activate = true } = {}) {
  const start = page.locator("#firstRunSharedStart");
  if (!(await start.count()) || !(await start.isVisible().catch(() => false))) {
    assert(false, "Start this program is visible before the action", "missing #firstRunSharedStart");
    return false;
  }
  await start.click({ timeout: 5000 });
  await page.waitForSelector("#entryActivate", { timeout: 10000 });
  if (activate) {
    await page.click("#entryActivate");
    await page.waitForFunction(() => !document.querySelector("#onboarding")?.classList.contains("active"), null, { timeout: 10000 });
    await page.evaluate(() => window.__repforgeStorage?.flush?.());
  }
  return true;
}

async function persistState(page, state) {
  await page.evaluate(
    async ({ k, blob }) => {
      localStorage.setItem(k, JSON.stringify(blob));
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("repforge", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(blob, k);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { k: KEY, blob: state }
  );
}

/** Wipe every store that affects boot, then boot again onto a fresh device. */
async function freshDevice(page) {
  await page.evaluate(
    async ({ k, setup }) => {
      localStorage.removeItem(k);
      localStorage.removeItem(setup);
      localStorage.removeItem("repforge_draft_v1");
      localStorage.removeItem("repforge_ui_v1");
      await new Promise((res) => {
        const req = indexedDB.deleteDatabase("repforge");
        req.onsuccess = req.onerror = req.onblocked = () => res();
      });
    },
    { k: KEY, setup: SETUP_DRAFT }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { timeout: 15000, base: BASE });
}

/** Activate a real generated program through the production finalize path. */
async function activateGeneratedProgram(page, { name = "Coach program", daysPerWeek = 3, seed = "sender" } = {}) {
  const ok = await page.evaluate(async ({ name, daysPerWeek, seed }) => {
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const request = window.RepForgeProgramEntryAdapter.programRequestFromAnswers({
      desiredResult: "muscle_growth", structuredExperience: "6_to_24m", daysPerWeek, sessionMinutes: 60,
      environment: { kind: "commercial_gym" },
    }, catalog).value;
    const definition = window.RepForgeProgramCompiler.generateProgram(request, catalog, seed).value;
    const result = await window.__repforgeFinalizeProgramSetup({
      programDefinition: definition, name, answers: {}, destination: "log", origin: "first-run",
      draftConfirmed: true, telemetryRoute: "recommend", entrySource: { route: "recommend", fingerprint: seed },
    });
    await window.__repforgeStorage.flush();
    return !!(result?.localOk || result?.idbOk);
  }, { name, daysPerWeek, seed });
  if (!ok) throw new Error("the generated program did not activate");
}

/** Rewrite part of the durable state on both replicas, then boot onto it. */
async function editDurableState(page, edit) {
  const state = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), KEY);
  edit(state);
  await persistState(page, state);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { timeout: 15000, base: BASE });
}

async function openShareSheet(page) {
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#program.view.active");
  await page.click(SHARED_DOM.shareRow);
  await page.waitForSelector("#shareSetupSheet:not(.hidden)", { timeout: 10000 });
  await waitForShareSetupLink(page);
}

async function readBothReplicas(page) {
  return page.evaluate(async ({ key }) => {
    let local = null;
    try {
      local = JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      local = null;
    }
    const db = await new Promise((res) => {
      const r = indexedDB.open("repforge", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    });
    let idb = null;
    if (db) {
      idb = await new Promise((res) => {
        const tx = db.transaction("kv", "readonly");
        const g = tx.objectStore("kv").get(key);
        g.onsuccess = () => res(g.result || null);
        g.onerror = () => res(null);
      });
      db.close();
    }
    return { local, idb };
  }, { key: KEY });
}

/** Write a newer durable head to BOTH replicas: the change another tab persists after this tab staged its proposal. */
async function commitConcurrentHead(page, spec) {
  return page.evaluate(
    async ({ key, spec }) => {
      const newer = JSON.parse(localStorage.getItem(key) || "{}");
      newer.programHistory = Array.isArray(newer.programHistory) ? newer.programHistory : [];
      if (Array.isArray(spec.addHistory)) newer.programHistory = newer.programHistory.concat(spec.addHistory);
      newer._storageRevision = (Number.isInteger(newer._storageRevision) ? newer._storageRevision : 0) + 1;
      if (newer.programMeta && spec.onboarded !== undefined) newer.programMeta.onboarded = spec.onboarded;
      localStorage.setItem(key, JSON.stringify(newer));
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("repforge", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(newer, key);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
      return newer;
    },
    { key: KEY, spec }
  );
}

function canonicalJson(value) {
  const walk = (node) => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      return Object.keys(node).sort().reduce((acc, key) => {
        acc[key] = walk(node[key]);
        return acc;
      }, {});
    }
    return node;
  };
  return JSON.stringify(walk(value));
}

/** The handoff cookie as the browser stores it, with its attributes. */
async function handoffCookie(context) {
  return (await context.cookies()).find((cookie) => cookie.name === HANDOFF_COOKIE) || null;
}

async function runCase(name, fn) {
  if (ONLY.length && !ONLY.some((needle) => name.toLowerCase().includes(needle.toLowerCase()))) return;
  console.log(`\n${name}`);
  try {
    await fn();
  } catch (err) {
    assert(false, `${name} (uncaught)`, String(err && err.stack || err));
  }
}

/** A flat-program payload in the retired v1/v2/v3 shape. */
const LEGACY_PAYLOAD = Object.freeze({
  kind: KIND,
  version: 1,
  program: {
    meta: { name: "Legacy coach program", daysPerWeek: 1 },
    exercises: [{ day: "Day 1", order: 1, libraryId: "pr_mc", sets: 3, min: 8, max: 12 }],
    customExercises: [],
  },
  settings: { ...PT_SHARED_SETTINGS },
});

/** Durable evidence that a refused link wrote nothing a shared program would. */
function noSharedWrite(before, after, name) {
  const hits = [];
  if (canonicalJson(after.state) !== canonicalJson(before.state)) hits.push("durable state changed");
  if (after.state?.programMeta?.name === name) hits.push("shared name");
  if (after.state?.programMeta?.programDefinition) hits.push("program definition");
  if (after.setupDraft !== null) hits.push("setup draft");
  return hits;
}

export async function runSharedSetupFlow(browser) {
  console.log("Shared setup flow");
  console.log(`Target: ${APP_INDEX}\n`);

  await runCase("Module API is present", async () => {
    const { context, page } = await openAppPage(browser);
    const api = await page.evaluate((required) => {
      const mod = window.RepForgeSharedSetup;
      if (!mod) return { present: false, keys: [] };
      return {
        present: true,
        missing: required.filter((name) => mod[name] == null),
        kind: mod.KIND,
        version: mod.VERSION,
        encoding: mod.ENCODING_VERSION,
        maxEncoded: mod.MAX_ENCODED_CHARS,
      };
    }, REQUIRED_API);
    assert(api.present, "window.RepForgeSharedSetup is loaded", api);
    assert(api.kind === KIND && api.version === DOCUMENT_VERSION && api.encoding === ENCODING_VERSION,
      "the codec carries taurifer-shared-setup document version 2 in v4 envelopes", api);
    assert(api.maxEncoded === MAX_ENCODED_CHARS, "MAX_ENCODED_CHARS is 3072", api.maxEncoded);
    assert(api.missing?.length === 0, "every public codec member exists", api.missing);
    await context.close();
  });

  await runCase("Outbound link carries the program, eight settings and language; the share is title and URL only", async () => {
    const { context, page } = await openAppPage(browser, { webShare: true, clipboard: true });
    await freshDevice(page);
    await activateGeneratedProgram(page, { name: "Coach program" });
    const sent = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).programMeta.programDefinition, KEY);
    await openShareSheet(page);
    const sheet = await page.evaluate(() => {
      const body = document.querySelector("#shareSetupBody");
      const share = document.querySelector("#shareSetupShare");
      const hidden = (node) =>
        !node || node.hidden === true || node.classList.contains("hidden") || !!node.closest(".hidden,[hidden]");
      return { body: (body?.textContent || "").trim(), bodyVisible: !hidden(body), shareHidden: hidden(share), shareDisabled: !!share?.disabled };
    });
    const link = await readShareSetupLink(page);
    const url = link ? new URL(link) : null;
    const fragment = url?.hash.startsWith("#setup=") ? url.hash.slice("#setup=".length) : "";
    assert(sheet.bodyVisible && sheet.body === SHARED_COPY.en.shareBody, "share sheet keeps only task guidance", sheet.body);
    assert(url?.pathname.endsWith("/index.html") && url.search === "" && fragment.startsWith("v4.") && fragment.length <= MAX_ENCODED_CHARS,
      "the link is index.html#setup=v4.… within the 3072-character limit", { link, length: fragment.length });
    const decoded = await decodeSetup(page, fragment);
    const value = decoded.value || {};
    assert(decoded.ok === true, "the app's own link decodes", decoded.code);
    assert(canonicalJson(Object.keys(value).sort()) === canonicalJson(["kind", "language", "program", "settings", "version"]),
      "the document holds only kind, version, program, settings and language: no logs or history", Object.keys(value));
    assert(canonicalJson(Object.keys(value.settings || {}).sort()) === canonicalJson([...SETTING_KEYS].sort()) &&
      value.settings?.lang === "en" && value.language === "en",
    "exactly the eight allowlisted settings travel, with the sender's language", value.settings);
    assert(value.program?.name === "Coach program" && canonicalJson(value.program?.definition) === canonicalJson(sent),
      "the link carries the sender's program name and identical definition", value.program?.name);
    assert(!sheet.shareHidden && !sheet.shareDisabled, "Share link is available when Web Share exists", sheet);
    await page.click(SHARED_DOM.shareShare);
    await page.waitForFunction(() => (window.__repforgeShareCalls || []).length > 0, null, { timeout: 5000 });
    const shared = await page.evaluate(() => window.__repforgeShareCalls || []);
    const payload = shared[0] || {};
    assert(shared.length === 1, "navigator.share is invoked once", shared);
    assert(payload.title === SHARED_COPY.en.shareTitle && payload.url === link, "Web Share carries the sheet title and the link", payload);
    assert(Object.keys(payload).sort().join(",") === "title,url", "Web Share payload is title and URL only", payload);
    await page.evaluate(() => {
      window.__copiedSetupLink = null;
      navigator.clipboard.writeText = async (text) => { window.__copiedSetupLink = text; };
    });
    await page.click(SHARED_DOM.shareCopy);
    await page.waitForFunction(() => window.__copiedSetupLink != null, null, { timeout: 5000 });
    assert(await page.evaluate(() => window.__copiedSetupLink) === link, "Copy copies only the URL");
    await context.close();
  });

  await runCase("A Portuguese sender's non-default settings and language travel in the link", async () => {
    const { context, page } = await openAppPage(browser, { locale: "pt-BR" });
    await freshDevice(page);
    await activateGeneratedProgram(page, { name: "Força compartilhada" });
    await editDurableState(page, (state) => {
      state.settings = { ...state.settings, ...PT_SHARED_SETTINGS, voiceInputEnabled: true };
    });
    await openShareSheet(page);
    const link = await readShareSetupLink(page);
    const decoded = await decodeSetup(page, new URL(link).hash.slice("#setup=".length));
    assert(decoded.ok === true && canonicalJson(decoded.value.settings) === canonicalJson(PT_SHARED_SETTINGS) && decoded.value.language === "pt",
      "the eight non-default Portuguese settings and the language are in the link, nothing device-owned", decoded.value?.settings || decoded.code);
    await context.close();
  });

  await runCase("Blank program names use the localized untitled name in setup links", async () => {
    for (const [lang, expected] of [["en", "Untitled program"], ["pt", "Treino sem título"]]) {
      const { context, page } = await openAppPage(browser, { locale: lang === "pt" ? "pt-BR" : "en-US" });
      await freshDevice(page);
      await activateGeneratedProgram(page, { name: "Named first" });
      await editDurableState(page, (state) => {
        state.programMeta.name = "";
        state.settings = { ...state.settings, lang };
      });
      await openShareSheet(page);
      const link = await readShareSetupLink(page);
      const status = await page.evaluate(() => document.querySelector("#shareSetupStatus")?.textContent || "");
      const decoded = link ? await decodeSetup(page, new URL(link).hash.slice("#setup=".length)) : null;
      assert(decoded?.ok === true && status === "", `${lang}: a blank-name program still produces a setup link`, { status, code: decoded?.code });
      assert(decoded?.value?.program?.name === expected, `${lang}: the link uses the localized untitled name`, decoded?.value?.program?.name);
      await context.close();
    }
  });

  await runCase("Fresh English link: shared gate, staged cookie, fragment removed, nothing written", async () => {
    const { context, page } = await openAppPage(browser, { ua: IOS_UA });
    await freshDevice(page);
    await waitForFirstRun(page);
    const before = await page.evaluate(readDurableState);
    const encoded = await encodeSetupDocument(page, await buildSetupDocument(page, { name: "Coach program" }));
    assert(encoded.ok === true, "a one-day document encodes", encoded.code);
    await page.goto(setupUrl(encoded.value, "fresh-en"), { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    const gate = await page.evaluate(sharedGateSnapshot);
    assert(gate.gate && gate.hero, "first-run hero remains on a shared link", gate);
    assert(gate.install, "iOS Safari still offers the install card", gate);
    assert(!gate.createVisible && !gate.importVisible && !gate.createFocusable && !gate.importFocusable,
      "Create and Import are not exposed in shared mode", gate);
    assert(gate.startVisible && !gate.sharedHidden && gate.startTitle === SHARED_COPY.en.title,
      "Start this program is the only program action", gate);
    assert(gate.startCap === SHARED_COPY.en.capOne("Coach program"), "the caption names the program and its one day", gate.startCap);
    assert(gate.lede === SHARED_COPY.en.lede, "shared install-available lede", gate.lede);
    assert(!gate.onboarding, "the generator is not opened", gate);
    const after = await page.evaluate(readDurableState);
    const hits = noSharedWrite(before, after, "Coach program");
    assert(hits.length === 0, "nothing is written before the explicit activation", hits);
    assert(!/setup=/.test(after.hash) && after.search === "?shared-test=fresh-en", "the setup fragment is removed after capture; the query stays", { hash: after.hash, search: after.search });
    const cookie = await handoffCookie(context);
    const sevenDays = Date.now() / 1000 + 604800;
    assert(cookie?.value === encoded.value, "the handoff cookie stages the exact link bytes", cookie?.value?.slice(0, 20));
    assert(cookie?.path === new URL(APP_INDEX).pathname && cookie?.sameSite === "Lax" && cookie.httpOnly === false &&
      Math.abs(cookie.expires - sevenDays) < 120,
    "the handoff cookie is scoped to index.html, SameSite=Lax, for seven days", cookie && { path: cookie.path, sameSite: cookie.sameSite, expires: cookie.expires });
    const hook = await page.evaluate(readSharedHook);
    assert(hook.status === "ready" && hook.source === "fragment" && hook.summary?.name === "Coach program" && hook.summary?.daysPerWeek === 1,
      "the hook reports a ready fragment proposal", hook);
    await context.close();
  });

  await runCase("Start stages an editable preview; activation commits the shared program and clears the cookie", async () => {
    const { context, page } = await openAppPage(browser, { ua: ANDROID_UA, standalone: true });
    await freshDevice(page);
    const document = await buildSetupDocument(page, { name: "Força compartilhada", settings: PT_SHARED_SETTINGS, trainingDays: 4 });
    const encoded = await encodeSetupDocument(page, document);
    await page.goto(setupUrl(encoded.value, "accept"), { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    const before = await page.evaluate(readDurableState);
    await clickSharedStart(page, { activate: false });
    const staged = await page.evaluate(() => ({
      onboarding: document.querySelector("#onboarding")?.classList.contains("active"),
      firstRun: !document.querySelector("#firstRun")?.classList.contains("hidden"),
      activate: !!document.querySelector("#entryActivate") && !document.querySelector("#entryActivate").disabled,
      edit: !!document.querySelector("#entryEdit") && !document.querySelector("#entryEdit").disabled,
    }));
    const stagedDurable = await page.evaluate(readDurableState);
    assert(canonicalJson(stagedDurable.state) === canonicalJson(before.state), "Start leaves the durable state byte-identical",
      { before: before.state?.programMeta, staged: stagedDurable.state?.programMeta });
    assert(staged.onboarding && !staged.firstRun && staged.activate && staged.edit,
      "Start opens the common preview with separate activation and edit actions", staged);
    assert(!!stagedDurable.cookie, "the handoff cookie survives until activation", stagedDurable.cookie);
    await page.click("#entryActivate");
    await page.waitForFunction(() => !document.querySelector("#onboarding")?.classList.contains("active"), null, { timeout: 10000 });
    await page.evaluate(() => window.__repforgeStorage?.flush?.());
    const after = await page.evaluate(readDurableState);
    const state = after.state || {};
    const gate = await page.evaluate(sharedGateSnapshot);
    assert(state.programMeta?.onboarded === true && state.programMeta?.name === "Força compartilhada",
      "activation onboards the recipient with the shared name", state.programMeta?.name);
    assert(canonicalJson(state.programMeta?.programDefinition) === canonicalJson(document.program.definition),
      "the recipient's program is the identical shared definition");
    assert(SETTING_KEYS.every((key) => state.settings?.[key] === PT_SHARED_SETTINGS[key]),
      "all eight allowlisted settings persist, including the language", state.settings);
    assert(state.settings?.voiceInputEnabled !== true && state.settings?.notify?.enabled !== true,
      "device-owned settings stay the recipient's", state.settings);
    assert((state.log || []).length === 0 && (state.programHistory || []).length === 0, "no logs or history arrive with a link");
    assert(!after.cookie && !(await handoffCookie(context)), "activation clears the handoff cookie", after.cookie);
    assert(gate.logActive && !gate.gate, "activation lands on Today", gate);
    const trainingDays = document.program.definition.days.filter((day) => day.kind === "training").length;
    assert(trainingDays === 4 && state.programMeta?.daysPerWeek === trainingDays,
      "programMeta.daysPerWeek is the shared definition's training-day count", { stored: state.programMeta?.daysPerWeek, trainingDays });
    const rawBefore = await page.evaluate((k) => localStorage.getItem(k), KEY);
    const replicasBefore = await readBothReplicas(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { timeout: 15000, base: BASE });
    await page.evaluate(() => window.__repforgeStorage?.flush?.());
    assert(!(await page.evaluate(sharedGateSnapshot)).gate, "the gate stays closed after reload");
    const rawAfter = await page.evaluate((k) => localStorage.getItem(k), KEY);
    const replicasAfter = await readBothReplicas(page);
    assert(rawAfter === rawBefore && canonicalJson(replicasAfter.idb) === canonicalJson(replicasBefore.idb),
      "the first reload after activation does not rewrite storage", { before: JSON.parse(rawBefore)?._storageRevision, after: JSON.parse(rawAfter)?._storageRevision });
    await context.close();
  });

  await runCase("Portuguese link switches gate language before acceptance", async () => {
    const { context, page } = await openAppPage(browser, { ua: IOS_UA, locale: "en-US" });
    await freshDevice(page);
    const encoded = await encodeSetupDocument(page,
      await buildSetupDocument(page, { name: "Força compartilhada", settings: PT_SHARED_SETTINGS, trainingDays: 4 }));
    await page.goto(setupUrl(encoded.value, "pt-gate"), { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    const gate = await page.evaluate(sharedGateSnapshot);
    assert(gate.i18n === "pt" && /^pt/i.test(gate.langAttr || ""), "runtime language is Portuguese before accept", gate);
    assert(gate.lede === SHARED_COPY.pt.lede && gate.startTitle === SHARED_COPY.pt.title, "Portuguese shared gate copy before accept", gate);
    assert(gate.startCap === SHARED_COPY.pt.capMany("Força compartilhada", 4), "Portuguese caption names four days", gate.startCap);
    const durable = await page.evaluate(readDurableState);
    assert(durable.state?.settings?.lang !== "pt", "the shared language is not durable before acceptance", durable.state?.settings?.lang);
    await context.close();
  });

  await runCase("Continue in Safari keeps the shared row and the cookie", async () => {
    const { context, page } = await openAppPage(browser, { ua: IOS_UA });
    await freshDevice(page);
    const encoded = await encodeSetupDocument(page, await buildSetupDocument(page));
    await page.goto(setupUrl(encoded.value, "continue"), { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    await page.click("#firstRunContinue");
    await page.waitForFunction(() => document.querySelector("#firstRunContinue")?.classList.contains("hidden") ||
      document.querySelector("#firstRunInstall")?.classList.contains("hidden"), null, { timeout: 5000 });
    const after = await page.evaluate(sharedGateSnapshot);
    assert(after.gate && after.startVisible, "Continue leaves the shared action standing", after);
    assert(!after.install && !after.continueShown, "Continue removes only the install offer", after);
    assert(!after.createVisible && !after.importVisible, "Create/Import stay hidden after Continue", after);
    assert((await page.evaluate(readDurableState)).cookie === encoded.value, "browser acceptance keeps the handoff cookie");
    await context.close();
  });

  await runCase("Cookie-only standalone launch reconstructs the shared gate", async () => {
    const { context, page } = await openAppPage(browser, { ua: ANDROID_UA, standalone: true });
    await freshDevice(page);
    const encoded = await encodeSetupDocument(page, await buildSetupDocument(page, { name: "Cookie program" }));
    const wrote = await page.evaluate((value) => window.RepForgeSharedSetup.writeHandoffCookie(value), encoded.value);
    assert(wrote === true, "the codec writes a current envelope to the handoff cookie");
    await page.goto(APP_INDEX, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { timeout: 15000, base: BASE });
    await waitForFirstRun(page);
    const gate = await page.evaluate(sharedGateSnapshot);
    const hook = await page.evaluate(readSharedHook);
    assert(gate.gate && gate.startVisible && gate.startCap === SHARED_COPY.en.capOne("Cookie program"),
      "a standalone launch with only the cookie shows the shared gate", { gate, hook });
    assert(!gate.install && !gate.continueShown && gate.lede === SHARED_COPY.en.ledeInstalled, "the installed gate has no install section", gate);
    assert(hook.source === "cookie" && hook.status === "ready", "the proposal came from the handoff cookie", hook);
    await context.close();
  });

  await runCase("Legacy v1, v2 and v3 links are refused without any write", async () => {
    for (const version of [1, 2, 3]) {
      const label = `v${version}`;
      const { context, page } = await openAppPage(browser, { ua: IOS_UA });
      await freshDevice(page);
      await waitForFirstRun(page);
      const fragment = wireFragment({ ...LEGACY_PAYLOAD, version }, version);
      const legacyCookieWritten = await page.evaluate((value) => window.RepForgeSharedSetup.writeHandoffCookie(value), fragment);
      assert(legacyCookieWritten === false, `${label}: the codec refuses to stage a legacy envelope in the cookie`);
      const before = await page.evaluate(readDurableState);
      await page.goto(setupUrl(fragment, `legacy-${label}`), { waitUntil: "domcontentloaded" });
      await waitForFirstRun(page);
      const gate = await page.evaluate(sharedGateSnapshot);
      const hook = await page.evaluate(readSharedHook);
      const after = await page.evaluate(readDurableState);
      assert(hook.status === "unsupported" && hook.error === "unsupported-version", `${label}: the link is unsupported`, hook);
      assert(!gate.startVisible && gate.createVisible && gate.importVisible, `${label}: no shared action; standard choices are restored`, gate);
      const outdated = await page.evaluate(() => window.RepForgeI18n.t("setup.shared.outdated"));
      assert(gate.errorVisible && gate.errorRole === "status" && outdated !== "setup.shared.outdated" && gate.errorText === outdated,
        `${label}: an inline status asks for the program to be shared again (setup.shared.outdated)`, gate.errorText);
      assert(gate.i18n === "en", `${label}: the legacy link's language is not applied`, gate.i18n);
      const hits = noSharedWrite(before, after, LEGACY_PAYLOAD.program.meta.name);
      assert(hits.length === 0, `${label}: nothing is written`, hits);
      assert(!after.cookie && !(await handoffCookie(context)), `${label}: no handoff cookie is staged`, after.cookie);
      await context.close();
    }

    // A legacy envelope left in the cookie by an older release is cleared, not applied.
    const { context, page } = await openAppPage(browser, { ua: ANDROID_UA, standalone: true });
    await freshDevice(page);
    const legacy = wireFragment(LEGACY_PAYLOAD, 1);
    await page.evaluate((value) => {
      document.cookie = `repforge_setup_v1=${value}; path=${new URL("index.html", location.href).pathname}; max-age=604800; SameSite=Lax`;
    }, legacy);
    const before = await page.evaluate(readDurableState);
    await page.goto(APP_INDEX, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { timeout: 15000, base: BASE });
    await waitForFirstRun(page);
    const hook = await page.evaluate(readSharedHook);
    const after = await page.evaluate(readDurableState);
    assert(hook.status === "unsupported" && hook.source === "cookie", "a legacy cookie is read as unsupported", hook);
    assert(!after.cookie && noSharedWrite({ ...before, cookie: null }, after, LEGACY_PAYLOAD.program.meta.name).length === 0,
      "the legacy cookie is cleared and nothing is written", after.cookie);
    await context.close();
  });

  await runCase("A link from a newer envelope version is refused as newer, without any write", async () => {
    const { context, page } = await openAppPage(browser, { ua: IOS_UA });
    await freshDevice(page);
    await waitForFirstRun(page);
    const fragment = wireFragment([2, "Future program"], ENCODING_VERSION + 1);
    const before = await page.evaluate(readDurableState);
    await page.goto(setupUrl(fragment, "newer-envelope"), { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    const gate = await page.evaluate(sharedGateSnapshot);
    const hook = await page.evaluate(readSharedHook);
    const after = await page.evaluate(readDurableState);
    const unsupported = await page.evaluate(() => window.RepForgeI18n.t("setup.shared.unsupported"));
    assert(hook.status === "unsupported" && hook.error === "unsupported-version", "a v5 link is unsupported", hook);
    assert(gate.errorVisible && gate.errorRole === "status" && unsupported !== "setup.shared.unsupported" && gate.errorText === unsupported,
      "a v5 link says it was made by a newer version (setup.shared.unsupported)", gate.errorText);
    assert(!gate.startVisible && gate.createVisible && gate.importVisible, "no shared action; standard choices are restored", gate);
    assert(noSharedWrite(before, after, "Future program").length === 0 && !after.cookie && !(await handoffCookie(context)),
      "nothing is written and no handoff cookie is staged", { cookie: after.cookie });
    await context.close();
  });

  await runCase("Invalid and oversized sources fail closed", async () => {
    const cases = [
      ["invalid-base64", "v4.not.base64", SHARED_COPY.en.invalid],
      ["invalid-gzip", "v4.e30", SHARED_COPY.en.invalid],
      ["encoded-too-large", `v4.${"a".repeat(MAX_ENCODED_CHARS)}`, SHARED_COPY.en.invalid],
      ["invalid-envelope", wireFragment([2, "Coach program"], 4), SHARED_COPY.en.invalid],
      ["invalid-json", wireFragment("{not json", 4), SHARED_COPY.en.invalid],
    ];
    for (const [label, fragment, message] of cases) {
      const { context, page } = await openAppPage(browser, { ua: IOS_UA });
      await freshDevice(page);
      await waitForFirstRun(page);
      await page.evaluate((value) => {
        document.cookie = `repforge_setup_v1=${value}; path=${new URL("index.html", location.href).pathname}; max-age=604800; SameSite=Lax`;
      }, fragment);
      const before = await page.evaluate(readDurableState);
      await page.goto(setupUrl(fragment, label), { waitUntil: "domcontentloaded" });
      await waitForFirstRun(page);
      const gate = await page.evaluate(sharedGateSnapshot);
      const after = await page.evaluate(readDurableState);
      const hook = await page.evaluate(readSharedHook);
      assert(hook.status === "invalid", `${label}: the proposal is invalid`, hook);
      assert(gate.createVisible && gate.importVisible && !gate.startVisible, `${label}: standard Create/Import are restored`, gate);
      assert(gate.errorVisible && gate.errorRole === "status" && gate.errorText === message, `${label}: localized inline error with role=status`, gate.errorText);
      const hits = noSharedWrite(before, after, "Coach program");
      assert(hits.length === 0, `${label}: nothing is written`, hits);
      assert(!after.cookie, `${label}: a staged handoff cookie is cleared`, after.cookie);
      await context.close();
    }
  });

  await runCase("Missing Compression Streams fail closed and keep ordinary exports working", async () => {
    const { context, page } = await openAppPage(browser, { noCompression: true });
    await freshDevice(page);
    await activateGeneratedProgram(page);
    await page.click('nav button[data-view="program"]');
    await page.waitForSelector("#program.view.active");
    await page.click(SHARED_DOM.shareRow);
    await page.waitForSelector("#shareSetupSheet:not(.hidden)", { timeout: 10000 });
    await waitForShareSetupLink(page);
    const shareUi = await page.evaluate(() => ({
      status: document.querySelector("#shareSetupStatus")?.textContent || "",
      copyDisabled: document.querySelector("#shareSetupCopy")?.disabled !== false,
      link: (document.querySelector("#shareSetupLink")?.value || "").trim(),
    }));
    assert(shareUi.status === SHARED_COPY.en.shareUnsupported && shareUi.copyDisabled && !shareUi.link,
      "the share sheet says this browser cannot create setup links and offers no link", shareUi);
    await page.click("#shareSetupClose");
    await page.locator("#shareSetupSheet").waitFor({ state: "hidden" });
    await page.click("#programEditToggle");
    await page.waitForSelector("#programEditorWrap:not(.is-hidden)", { timeout: 5000 });
    await page.locator("#programEditorWrap details.advanced > summary").click();
    const [programDownload] = await Promise.all([
      page.waitForEvent("download", { timeout: 8000 }).catch(() => null),
      page.locator("#exportProgram").click(),
    ]);
    assert(!!programDownload, "program file export still works without CompressionStream");
    const [backupDownload] = await Promise.all([
      page.waitForEvent("download", { timeout: 8000 }).catch(() => null),
      page.evaluate(() => document.querySelector("#exportJson")?.click()),
    ]);
    assert(!!backupDownload, "backup export still works without CompressionStream");
    await context.close();

    const sender = await openAppPage(browser, { ua: IOS_UA });
    await freshDevice(sender.page);
    const encoded = await encodeSetupDocument(sender.page, await buildSetupDocument(sender.page));
    await sender.context.close();
    const open = await openAppPage(browser, { noCompression: true, ua: IOS_UA });
    await freshDevice(open.page);
    const before = await open.page.evaluate(readDurableState);
    await open.page.goto(setupUrl(encoded.value, "no-decompression"), { waitUntil: "domcontentloaded" });
    await waitForFirstRun(open.page);
    const gate = await open.page.evaluate(sharedGateSnapshot);
    const after = await open.page.evaluate(readDurableState);
    assert(gate.createVisible && gate.importVisible && !gate.startVisible, "a browser without DecompressionStream restores standard choices", gate);
    assert(gate.errorText === SHARED_COPY.en.browserUnsupported, "browser_unsupported copy is used", gate.errorText);
    assert(noSharedWrite(before, after, "Coach program").length === 0 && !after.cookie, "nothing is written and no cookie is kept",
      { hits: noSharedWrite(before, after, "Coach program"), cookie: after.cookie });
    await open.context.close();
  });

  await runCase("Onboarded devices and archived history refuse a setup link", async () => {
    for (const label of ["onboarded program", "archived history"]) {
      const { context, page } = await openAppPage(browser, { locale: "en-US" });
      await freshDevice(page);
      await activateGeneratedProgram(page, { name: "Existing split", seed: "existing-a" });
      if (label === "onboarded program") {
        // Activation writes what boot would normalize, so the next boot rewrites nothing.
        const rawActivated = await page.evaluate((k) => localStorage.getItem(k), KEY);
        await page.reload({ waitUntil: "domcontentloaded" });
        await waitForAppBoot(page, { timeout: 15000, base: BASE });
        await page.evaluate(() => window.__repforgeStorage?.flush?.());
        const rawReloaded = await page.evaluate((k) => localStorage.getItem(k), KEY);
        const meta = JSON.parse(rawActivated)?.programMeta;
        const trainingDays = meta?.programDefinition?.days?.filter((day) => day.kind === "training").length;
        assert(trainingDays === 3 && meta?.daysPerWeek === trainingDays,
          `${label}: activation stores daysPerWeek as the training-day count`, { stored: meta?.daysPerWeek, trainingDays });
        assert(rawReloaded === rawActivated, `${label}: the first reload after activation does not rewrite storage`,
          { before: JSON.parse(rawActivated)?._storageRevision, after: JSON.parse(rawReloaded)?._storageRevision });
      }
      if (label === "archived history") {
        await activateGeneratedProgram(page, { name: "Existing split", seed: "existing-b" });
        await editDurableState(page, (state) => { state.programMeta.onboarded = false; });
      }
      const encoded = await encodeSetupDocument(page,
        await buildSetupDocument(page, { name: "Força compartilhada", settings: PT_SHARED_SETTINGS, trainingDays: 4 }));
      const before = await page.evaluate(readDurableState);
      assert(label !== "archived history" || ((before.state?.programHistory || []).length > 0 && before.state?.programMeta?.onboarded === false),
        `${label}: the device holds archived history and is not onboarded`, before.state?.programMeta);
      await page.goto(setupUrl(encoded.value, label.replace(/\s+/g, "-")), { waitUntil: "domcontentloaded" });
      await waitForAppBoot(page, { timeout: 15000, base: BASE });
      await page.waitForFunction(() => window.__repforgeSharedSetup?.status === "existing", null, { timeout: 15000 });
      await page.waitForFunction((expected) => document.querySelector("#toast")?.textContent === expected,
        SHARED_COPY.en.existing, { timeout: 10000 });
      const after = await page.evaluate(readDurableState);
      const gate = await page.evaluate(sharedGateSnapshot);
      assert(!gate.startVisible, `${label}: no shared Start is offered`, gate);
      assert(canonicalJson(after.state) === canonicalJson(before.state), `${label}: the durable state is unchanged`,
        { before: before.state?.programMeta?.name, after: after.state?.programMeta?.name });
      assert(after.state?.settings?.lang !== "pt" && gate.i18n !== "pt", `${label}: the link's language is not applied`, gate.i18n);
      assert(!after.cookie && !(await handoffCookie(context)), `${label}: the staged handoff cookie is cleared after the notice`, after.cookie);
      await context.close();
    }
  });

  await runCase("Double Start produces one preview and one durable transition", async () => {
    const { context, page } = await openAppPage(browser, { standalone: true });
    await freshDevice(page);
    const encoded = await encodeSetupDocument(page, await buildSetupDocument(page));
    await page.goto(setupUrl(encoded.value, "double"), { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    const beforeRev = await page.evaluate(() => JSON.parse(localStorage.getItem("repforge_v1") || "{}")._storageRevision || 0);
    await page.evaluate(() => {
      const btn = document.querySelector("#firstRunSharedStart");
      btn?.click();
      btn?.click();
    });
    await page.waitForSelector("#entryActivate", { timeout: 10000 });
    await page.click("#entryActivate");
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("repforge_v1") || "{}").programMeta?.onboarded === true, null, { timeout: 10000 });
    await page.evaluate(() => window.__repforgeStorage?.flush?.());
    const after = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      return { name: state.programMeta?.name, revision: state._storageRevision, history: (state.programHistory || []).length };
    });
    assert(after.name === "Coach program" && after.history === 0, "one activation of the shared program", after);
    assert(after.revision === beforeRev + 1, "the busy guard yields a single durable transition", { beforeRev, after });
    await context.close();
  });

  await runCase("Cancel on the shared preview asks keep or discard and never returns to the gate silently", async () => {
    const { context, page } = await openAppPage(browser, { standalone: true });
    await freshDevice(page);
    const encoded = await encodeSetupDocument(page, await buildSetupDocument(page));
    await page.goto(setupUrl(encoded.value, "cancel-dialog"), { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    if (!(await clickSharedStart(page, { activate: false }))) {
      await context.close();
      return;
    }
    const snapshot = () => page.evaluate(() => {
      const dialog = document.querySelector("#entryDialog");
      return {
        open: !!dialog?.open,
        actions: [...(dialog?.querySelectorAll(".entry-dialog__actions button") || [])].map((button) => button.id),
        gate: !!document.querySelector("#firstRun:not(.hidden)"),
        preview: !!document.querySelector("#onboarding.active #entryActivate"),
        onboarded: JSON.parse(localStorage.getItem("repforge_v1") || "{}").programMeta?.onboarded === true,
        setupDraft: localStorage.getItem("repforge_program_setup_draft_v1") !== null,
        focus: document.activeElement?.id || "",
      };
    });
    await page.click("#onbCancel");
    await page.waitForSelector("#entryDialog[open] #entryCancelKeep", { timeout: 5000 });
    const asking = await snapshot();
    assert(asking.open && JSON.stringify(asking.actions) === JSON.stringify(["entryCancelKeep", "entryCancelDiscard", "entryCancelContinue"]),
      "Cancel on the shared preview asks keep, discard or continue", asking);
    assert(!asking.gate && asking.preview && !asking.onboarded, "while it asks, the preview stays and the gate does not come back", asking);
    await page.click("#entryCancelContinue");
    await page.waitForFunction(() => !document.querySelector("#entryDialog")?.open, null, { timeout: 5000 });
    const continued = await snapshot();
    assert(!continued.open && continued.preview && !continued.gate && continued.setupDraft && continued.focus === "onbCancel",
      "continuing closes the dialog on the same preview and returns focus to Cancel", continued);
    await page.click("#onbCancel");
    await page.waitForSelector("#entryDialog[open] #entryCancelDiscard", { timeout: 5000 });
    await page.click("#entryCancelDiscard");
    await page.waitForFunction(() => !document.querySelector("#onboarding")?.classList.contains("active"), null, { timeout: 10000 });
    const discarded = await snapshot();
    assert(!discarded.setupDraft && !discarded.onboarded, "discarding drops the staged draft and activates nothing", discarded);
    await context.close();
  });

  await runCase("A concurrent onboarding or archived history rejects activation without a partial write", async () => {
    for (const label of ["concurrent onboarding", "concurrent program history"]) {
      const { context, page } = await openAppPage(browser, { standalone: true });
      await freshDevice(page);
      let spec = { onboarded: true };
      if (label === "concurrent program history") {
        // A real archive entry: what activating and then replacing a program leaves behind.
        await activateGeneratedProgram(page, { name: "Archived", seed: "archived-a" });
        await activateGeneratedProgram(page, { name: "Archived", seed: "archived-b" });
        spec = { addHistory: (await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).programHistory, KEY)).slice(0, 1) };
        await freshDevice(page);
      }
      const encoded = await encodeSetupDocument(page,
        await buildSetupDocument(page, { name: "Força compartilhada", settings: PT_SHARED_SETTINGS, trainingDays: 4 }));
      await page.goto(setupUrl(encoded.value, `reject-${label.replace(/\s+/g, "-")}`), { waitUntil: "domcontentloaded" });
      await waitForFirstRun(page);
      assert((await page.evaluate(readSharedHook)).status === "ready", `${label}: this tab holds a ready proposal`);
      if (!(await clickSharedStart(page, { activate: false }))) {
        await context.close();
        continue;
      }
      await commitConcurrentHead(page, spec);
      const before = await readBothReplicas(page);
      await page.click("#entryActivate");
      await page.locator("#entryDurableConflictReview, #entryConflictReview").first().waitFor({ state: "visible", timeout: 10000 });
      const after = await readBothReplicas(page);
      assert(after.local?.programMeta?.name !== "Força compartilhada" && after.idb?.programMeta?.name !== "Força compartilhada",
        `${label}: the shared program is not committed`, { local: after.local?.programMeta?.name, idb: after.idb?.programMeta?.name });
      assert(canonicalJson(after.local) === canonicalJson(before.local) && canonicalJson(after.idb) === canonicalJson(before.idb),
        `${label}: both replicas are byte-for-byte intact`);
      await context.close();
    }
  });

  await runCase("Unrelated hashchange is a no-op after a staged shared setup", async () => {
    const { context, page } = await openAppPage(browser, { ua: IOS_UA });
    await freshDevice(page);
    const encoded = await encodeSetupDocument(page, await buildSetupDocument(page));
    await page.goto(setupUrl(encoded.value, "hash-noop"), { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    const before = await page.evaluate(readSharedHook);
    assert(before.status === "ready" && (await page.evaluate(readDurableState)).cookie === encoded.value,
      "ready proposal and staged cookie before an unrelated hash", before);
    await page.evaluate(() => new Promise((resolve) => {
      window.addEventListener("hashchange", () => requestAnimationFrame(() => requestAnimationFrame(resolve)), { once: true });
      location.hash = "section";
    }));
    const afterGate = await page.evaluate(sharedGateSnapshot);
    const afterHook = await page.evaluate(readSharedHook);
    const afterDurable = await page.evaluate(readDurableState);
    assert(afterHook.status === "ready" && afterGate.startVisible && !afterGate.startDisabled,
      "an unrelated #section leaves the proposal and Start row live", { afterHook, afterGate });
    assert(afterDurable.cookie === encoded.value && afterDurable.hash === "#section", "the cookie and the unrelated hash are kept", afterDurable.hash);
    const second = await encodeSetupDocument(page, await buildSetupDocument(page, { name: "Second coach program" }));
    await page.evaluate((value) => { location.hash = `setup=${value}`; }, second.value);
    await page.waitForFunction(() => window.__repforgeSharedSetup?.summary?.name === "Second coach program", null, { timeout: 10000 });
    const secondGate = await page.evaluate(sharedGateSnapshot);
    assert(secondGate.startVisible && secondGate.startCap === SHARED_COPY.en.capOne("Second coach program"),
      "a later genuine setup fragment still loads", secondGate);
    await context.close();
  });

  await runCase("Long program names wrap without horizontal overflow", async () => {
    const { context, page } = await openAppPage(browser, { ua: IOS_UA, width: 320, height: 568 });
    await freshDevice(page);
    const encoded = await encodeSetupDocument(page, await buildSetupDocument(page, { name: "A".repeat(100) }));
    await page.goto(setupUrl(encoded.value, "long-name"), { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    const shape = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      cap: document.querySelector("#firstRunSharedStart .firstrun-row__cap")?.textContent || "",
    }));
    assert(!shape.overflow, "320px shared gate has no horizontal overflow", shape);
    assert(shape.cap.includes("A".repeat(100)), "the long name is shown whole", shape.cap.length);
    await context.close();
  });

  await runCase("Shared program names render as text, never HTML", async () => {
    const { context, page } = await openAppPage(browser, { width: 390 });
    await freshDevice(page);
    const name = '<img src=x onerror="window.__sharedXss=true">Coach';
    const encoded = await encodeSetupDocument(page, await buildSetupDocument(page, { name }));
    await page.goto(setupUrl(encoded.value, "text-only-name"), { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    const rendered = await page.evaluate(() => {
      const cap = document.querySelector("#firstRunSharedStart .firstrun-row__cap");
      return { text: cap?.textContent || "", images: cap?.querySelectorAll("img").length || 0, executed: window.__sharedXss === true };
    });
    assert(rendered.text.includes(name), "untrusted program name is displayed literally", rendered.text);
    assert(rendered.images === 0 && !rendered.executed, "untrusted program name creates no HTML or script execution", rendered);
    await context.close();
  });

  return results;
}

async function main() {
  const browser = await launchChromium();
  await runSharedSetupFlow(browser);
  await browser.close();
  console.log(`\nshared setup flow: ${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed > 0 ? 1 : 0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error("shared-setup-flow.mjs crashed:", err);
    process.exit(2);
  });
}
