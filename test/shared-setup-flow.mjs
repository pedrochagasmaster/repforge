#!/usr/bin/env node
/**
 * Browser behaviour for shared setup links (Task 9).
 *
 * Tests the frozen RepForgeSharedSetup API, documented DOM IDs, and the
 * narrow window.__repforgeSharedSetup hook. Implementation may still be
 * missing; failures should be missing public surface, not loosened checks.
 *
 * Run: node test/shared-setup-flow.mjs   (static server on REPFORGE_URL)
 */
import { pathToFileURL } from "url";
import { gzipSync } from "zlib";
import { launchChromium } from "./browser.mjs";
import {
  BUILT_IN_IDS,
  CURRENT_SETTINGS_DEFAULTS,
  INVALID_DECODE_INPUTS,
  INVALID_PAYLOADS,
  KIND,
  MAX_ENCODED_CHARS,
  MINIMAL_PAYLOAD,
  REPRESENTATIVE_PAYLOAD,
  REQUIRED_API,
  VERSION,
  cloneFixture,
} from "./fixtures/shared-setup.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
export const APP_INDEX = new URL("index.html", BASE).href;
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const HANDOFF_COOKIE = "repforge_setup_v1";

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
    lede: "Install the app, then start your program.",
    ledeInstalled: "Your program is ready.",
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
  },
  pt: {
    lede: "Instale o app e comece seu programa.",
    ledeInstalled: "Seu programa está pronto.",
    title: "Começar este programa",
    capOne: (name) => `${name} · 1 dia por semana`,
    capMany: (name, n) => `${name} · ${n} dias por semana`,
    invalid: "Este link de programa compartilhado é inválido ou está incompleto.",
    unsupported: "Este programa compartilhado foi criado por uma versão mais recente do Taurifer.",
    browserUnsupported: "Este navegador não pode abrir links de programas compartilhados.",
    existing: "Este link só pode ser iniciado durante a configuração inicial.",
    commitFailed: "Não foi possível iniciar o programa. Tente novamente.",
    shareUnsupported: "Este navegador não pode criar links de configuração.",
    saved: "Programa salvo.",
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
    if (detail != null) console.log(`    ${detail}`);
  }
}

export function wireFragment(value) {
  const bytes = typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(JSON.stringify(value), "utf8");
  const b64 = gzipSync(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `v1.${b64}`;
}

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
    encoded: field("encoded"),
    error: field("error"),
    summary: field("summary"),
    hasBuild: typeof hook.build === "function",
    hasCommit: typeof hook.commit === "function",
    hasProposal: typeof hook.proposal === "function" || typeof hook.proposalFromSharedSetup === "function",
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
    draft: localStorage.getItem("repforge_draft_v1"),
    cookie: cookie ? decodeURIComponent(cookie.slice("repforge_setup_v1=".length)) : null,
    hash: location.hash,
    search: location.search,
    pathname: location.pathname,
  };
}

function configuredState(overrides = {}) {
  return {
    settings: {
      ...CURRENT_SETTINGS_DEFAULTS,
      lang: "en",
      ...(overrides.settings || {}),
    },
    programMeta: {
      id: overrides.programId || "prog-existing",
      name: overrides.name || "Existing split",
      started: "2026-01-01",
      created: "2026-01-01T00:00:00.000Z",
      updated: "2026-01-01T00:00:00.000Z",
      onboarded: overrides.onboarded !== undefined ? overrides.onboarded : true,
      mesocycleStatus: "active",
      mesocycleLengthWeeks: 6,
      goal: "hypertrophy",
      experience: "intermediate",
      daysPerWeek: 3,
      splitType: "full_body",
      equipment: ["machines"],
      priorityMuscles: [],
      sessionLength: "normal",
      completedAt: null,
      ...(overrides.programMeta || {}),
    },
    program: overrides.program || [
      {
        id: "ex-existing",
        name: "Press",
        day: "Day 1",
        order: 1,
        sets: 3,
        min: 8,
        max: 12,
        primary: "Chest",
        secondary: "",
        libraryId: overrides.libraryId || "pr_mc",
      },
    ],
    log: overrides.log !== undefined ? overrides.log : [
      {
        session: "s1",
        date: "2026-01-02",
        day: "Day 1",
        name: "Press",
        exerciseId: "ex-existing",
        set: 1,
        load: 60,
        reps: 10,
        rir: 1,
        notes: "",
        created: "2026-01-02T00:00:00.000Z",
        primary: "Chest",
        secondary: "",
      },
    ],
    programHistory: overrides.programHistory || [],
    customExercises: overrides.customExercises || [],
    _storageRevision: overrides.revision || 4,
  };
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

async function clearSite(page) {
  await page.evaluate(
    async ({ k, d }) => {
      localStorage.removeItem(k);
      localStorage.removeItem(d);
      await new Promise((res) => {
        const req = indexedDB.deleteDatabase("repforge");
        req.onsuccess = req.onerror = req.onblocked = () => res();
      });
    },
    { k: KEY, d: DRAFT }
  );
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
} = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    userAgent: ua,
    locale,
    hasTouch: true,
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
  await page.addInitScript(INSTALL_EVENT);
  const url = `${APP_INDEX}${search}${hash}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.readyState === "complete", null, { timeout: 15000 }).catch(() => {});
  return { context, page, errors };
}

export async function encodeSharedPayload(page, payload) {
  return page.evaluate(async ({ payload, ids }) => {
    const api = window.RepForgeSharedSetup;
    if (!api || typeof api.encode !== "function") {
      return { ok: false, code: "missing-module", missing: true };
    }
    const result = await api.encode(payload, { builtInIds: new Set(ids) });
    return result && typeof result === "object" ? result : { ok: false, code: "invalid-result" };
  }, { payload, ids: [...BUILT_IN_IDS] });
}

export async function waitForFirstRun(page, timeout = 15000) {
  await page.waitForSelector("#firstRun:not(.hidden)", { timeout });
}

async function clickSharedStart(page) {
  const start = page.locator("#firstRunSharedStart");
  if (!(await start.count()) || !(await start.isVisible().catch(() => false))) {
    assert(false, "Start this program is visible before the action", "missing #firstRunSharedStart");
    return false;
  }
  await start.click({ timeout: 5000 });
  return true;
}

function sharedPayloadAbsent(state, payload) {
  if (!state) return { ok: false, reason: "no-state" };
  const name = payload.program.meta.name;
  const customIds = (payload.program.customExercises || []).map((row) => row.id);
  const settings = payload.settings || {};
  const hits = [];
  if (state.programMeta?.name === name) hits.push("programMeta.name");
  if (state.settings?.lang === settings.lang && settings.lang && state.programMeta?.onboarded) hits.push("settings.lang+onboarded");
  if (state.settings?.restSec === settings.restSec && settings.restSec !== CURRENT_SETTINGS_DEFAULTS.restSec) hits.push("settings.restSec");
  if (state.settings?.rirMode === "effort" && settings.rirMode === "effort" && state.programMeta?.onboarded) hits.push("settings.rirMode");
  const customs = state.customExercises || [];
  for (const id of customIds) {
    if (customs.some((row) => row.id === id)) hits.push(`custom:${id}`);
  }
  const program = state.program || [];
  if (payload.program.exercises.length === 1) {
    const only = payload.program.exercises[0];
    if (program.length === 1 && program[0]?.libraryId === only.libraryId && state.programMeta?.onboarded) {
      hits.push("single-shared-slot");
    }
  }
  return { ok: hits.length === 0, hits, onboarded: !!state.programMeta?.onboarded, lang: state.settings?.lang, name: state.programMeta?.name };
}

async function runCase(name, fn) {
  console.log(`\n${name}`);
  try {
    await fn();
  } catch (err) {
    assert(false, `${name} (uncaught)`, String(err && err.stack || err));
  }
}

async function dismissGates(page) {
  await page.evaluate(() => {
    window.closeFirstRun?.();
    const el = document.querySelector("#onboarding");
    if (el?.classList.contains("active") && typeof window.closeOnboarding === "function") window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function") window.closeTour();
  });
}

export async function runSharedSetupFlow(browser) {
  console.log("Shared setup flow");
  console.log(`Target: ${APP_INDEX}\n`);

  await runCase("Frozen module API is present", async () => {
    const { context, page } = await openAppPage(browser);
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    const api = await page.evaluate((required) => {
      const mod = window.RepForgeSharedSetup;
      if (!mod) return { present: false, keys: [] };
      return {
        present: true,
        keys: required.map((name) => [name, mod[name] == null ? "missing" : typeof mod[name]]),
        kind: mod.KIND,
        version: mod.VERSION,
        maxEncoded: mod.MAX_ENCODED_CHARS,
      };
    }, REQUIRED_API);
    assert(api.present, "window.RepForgeSharedSetup is loaded", JSON.stringify(api));
    if (api.present) {
      assert(api.kind === KIND && api.version === VERSION, "KIND/VERSION match the frozen contract", JSON.stringify(api));
      assert(api.maxEncoded === MAX_ENCODED_CHARS, "MAX_ENCODED_CHARS is 3072", String(api.maxEncoded));
      const missing = (api.keys || []).filter(([, kind]) => kind === "missing");
      assert(missing.length === 0, "every REQUIRED_API member exists", JSON.stringify(missing));
    }
    await context.close();
  });

  await runCase("Coach can build an English setup link", async () => {
    const { context, page } = await openAppPage(browser);
    await clearSite(page);
    await persistState(page, configuredState({
      name: "Coach program",
      libraryId: "pr_mc",
      settings: { ...CURRENT_SETTINGS_DEFAULTS, lang: "en", unit: "kg", rirMode: "numeric" },
    }));
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissGates(page);
    await page.click('nav button[data-view="program"]');
    await page.waitForSelector("#program.view.active");
    const built = await page.evaluate((ids) => {
      const hook = window.__repforgeSharedSetup;
      if (!hook || typeof hook.build !== "function") return { missing: true };
      try {
        return { payload: hook.build(), ids };
      } catch (err) {
        return { error: String(err) };
      }
    }, [...BUILT_IN_IDS]);
    assert(!built.missing, "window.__repforgeSharedSetup.build is the payload builder", JSON.stringify(built));
    const payload = built.payload;
    assert(payload?.kind === KIND && payload?.version === VERSION, "built payload is v1 taurifer-shared-setup", JSON.stringify(payload));
    assert(payload?.settings?.lang === "en" && payload?.settings?.unit === "kg", "English numeric kg settings survive", JSON.stringify(payload?.settings));
    assert(payload && !payload.log && !payload.programHistory, "builder omits log and history", JSON.stringify({ log: payload?.log, history: payload?.programHistory, payload: !!payload }));
    const encoded = await encodeSharedPayload(page, payload || MINIMAL_PAYLOAD);
    assert(encoded.ok === true && typeof encoded.value === "string" && encoded.value.startsWith("v1."), "encode returns an install-safe v1 fragment", JSON.stringify(encoded));
    if (encoded.ok) {
      assert(encoded.value.length <= MAX_ENCODED_CHARS, "encoded English link fits the 3072-character ceiling", String(encoded.value.length));
    }
    const row = await page.evaluate((sel) => !!document.querySelector(sel), SHARED_DOM.shareRow);
    assert(row, "#shareProgramSetup is rendered on Program when a day exists");
    await context.close();
  });

  await runCase("Coach can build a Portuguese non-default setup", async () => {
    const { context, page } = await openAppPage(browser, { locale: "pt-BR" });
    await clearSite(page);
    const representative = cloneFixture(REPRESENTATIVE_PAYLOAD);
    await persistState(page, configuredState({
      name: representative.program.meta.name,
      settings: { ...CURRENT_SETTINGS_DEFAULTS, ...representative.settings },
      program: representative.program.exercises.map((ex, index) => ({
        id: `ex-${index}`,
        name: ex.displayName || ex.libraryId,
        day: ex.day,
        order: ex.order,
        sets: ex.sets,
        min: ex.min,
        max: ex.max,
        libraryId: ex.libraryId,
        primary: "",
        secondary: "",
      })),
      customExercises: representative.program.customExercises,
      log: [],
    }));
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissGates(page);
    const built = await page.evaluate(() => {
      const hook = window.__repforgeSharedSetup;
      if (!hook?.build) return { missing: true };
      return { payload: hook.build() };
    });
    assert(!built.missing, "Portuguese builder hook exists", JSON.stringify(built));
    const settings = built.payload?.settings;
    assert(
      settings?.lang === "pt" && settings?.rirMode === "effort" && settings?.restSec === 165 && settings?.jumpPct === 3.5,
      "non-default PT settings are in the built payload",
      JSON.stringify(settings)
    );
    const encoded = built.payload ? await encodeSharedPayload(page, built.payload) : { ok: false };
    assert(encoded.ok === true, "Portuguese payload encodes", JSON.stringify(encoded));
    await context.close();
  });

  await runCase("Outbound legacy aliases become current library IDs", async () => {
    const { context, page } = await openAppPage(browser);
    await clearSite(page);
    await persistState(page, configuredState({
      libraryId: "dl_mc",
      program: [{
        id: "ex-legacy",
        name: "Seated leg curl",
        day: "Day 1",
        order: 1,
        sets: 3,
        min: 8,
        max: 12,
        primary: "Hamstrings",
        secondary: "",
        libraryId: "dl_mc",
      }],
      log: [],
    }));
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissGates(page);
    const built = await page.evaluate(() => window.__repforgeSharedSetup?.build?.() || null);
    const ids = (built?.program?.exercises || []).map((ex) => ex.libraryId);
    assert(built != null, "builder is available for a legacy-alias program");
    assert(ids.includes("lr_mc") && !ids.includes("dl_mc"), "generated payload emits lr_mc, not dl_mc", JSON.stringify(ids));
    await context.close();
  });

  await runCase("Fresh English link: shared gate, starter snapshot only", async () => {
    const { context, page } = await openAppPage(browser, { ua: IOS_UA });
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    const encoded = await encodeSharedPayload(page, cloneFixture(MINIMAL_PAYLOAD));
    assert(encoded.ok === true, "minimal English payload encodes before navigation", JSON.stringify(encoded));
    if (!encoded.ok) {
      await context.close();
      return;
    }
    await page.goto(`${APP_INDEX}#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    const gate = await page.evaluate(sharedGateSnapshot);
    assert(gate.gate && gate.hero, "first-run hero remains on a shared link", JSON.stringify(gate));
    assert(gate.install, "iOS Safari still offers the install card", JSON.stringify(gate));
    assert(gate.standardHidden || !gate.createVisible, "Create is hidden in shared mode", JSON.stringify(gate));
    assert(!gate.importVisible && !gate.createFocusable && !gate.importFocusable, "Create/Import are not exposed", JSON.stringify(gate));
    assert(gate.startVisible && !gate.sharedHidden, "Start this program is the only program action", JSON.stringify(gate));
    assert(gate.startTitle === SHARED_COPY.en.title, "shared row title is Start this program", gate.startTitle);
    assert(gate.startCap === SHARED_COPY.en.capOne("Coach program"), "caption uses cap_one", gate.startCap);
    assert(gate.lede === SHARED_COPY.en.lede, "shared install-available lede", gate.lede);
    assert(!gate.onboarding, "the generator is not opened", JSON.stringify(gate));
    const durable = await page.evaluate(readDurableState);
    const absence = sharedPayloadAbsent(durable.state, MINIMAL_PAYLOAD);
    assert(absence.ok, "durable state has no shared program/settings before acceptance", JSON.stringify(absence));
    assert(durable.state?.programMeta?.onboarded !== true, "starter snapshot is not onboarded", JSON.stringify(durable.state?.programMeta));
    assert(!/#setup=/.test(durable.hash), "valid fragment is removed after capture", durable.hash);
    const hook = await page.evaluate(readSharedHook);
    assert(hook.present && hook.status === "ready", "transient hook reports ready", JSON.stringify(hook));
    await context.close();
  });

  await runCase("Portuguese link switches gate language before acceptance", async () => {
    const { context, page } = await openAppPage(browser, { ua: IOS_UA, locale: "en-US" });
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    const encoded = await encodeSharedPayload(page, cloneFixture(REPRESENTATIVE_PAYLOAD));
    assert(encoded.ok === true, "representative PT payload encodes", JSON.stringify(encoded));
    if (!encoded.ok) {
      await context.close();
      return;
    }
    await page.goto(`${APP_INDEX}#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    const gate = await page.evaluate(sharedGateSnapshot);
    assert(gate.i18n === "pt" || /^pt/i.test(gate.langAttr || ""), "runtime language is Portuguese before accept", JSON.stringify(gate));
    assert(gate.lede === SHARED_COPY.pt.lede, "PT shared lede before accept", gate.lede);
    assert(gate.startTitle === SHARED_COPY.pt.title, "PT shared title before accept", gate.startTitle);
    assert(
      gate.startCap === SHARED_COPY.pt.capMany("Força compartilhada", 4),
      "PT caption uses cap_many",
      gate.startCap
    );
    const durable = await page.evaluate(readDurableState);
    assert(
      durable.state?.settings?.lang !== "pt" || durable.state?.programMeta?.onboarded !== true,
      "shared lang is not durable before acceptance",
      JSON.stringify({ lang: durable.state?.settings?.lang, onboarded: durable.state?.programMeta?.onboarded })
    );
    await context.close();
  });

  await runCase("Continue in Safari keeps the shared row", async () => {
    const { context, page } = await openAppPage(browser, { ua: IOS_UA });
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    const encoded = await encodeSharedPayload(page, cloneFixture(MINIMAL_PAYLOAD));
    if (!encoded.ok) {
      assert(false, "encode required for continue-in-Safari", JSON.stringify(encoded));
      await context.close();
      return;
    }
    await page.goto(`${APP_INDEX}#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    await page.click("#firstRunContinue");
    await page.waitForTimeout(200);
    const after = await page.evaluate(sharedGateSnapshot);
    assert(after.gate && after.startVisible, "Continue leaves the shared action standing", JSON.stringify(after));
    assert(!after.install && !after.continueShown, "Continue removes only the install offer", JSON.stringify(after));
    assert(!after.createVisible && !after.importVisible, "Create/Import stay hidden after Continue", JSON.stringify(after));
    const durable = await page.evaluate(readDurableState);
    assert(durable.cookie, "browser acceptance keeps the handoff cookie until expiry", durable.cookie);
    await context.close();
  });

  await runCase("Chrome install accepted/dismissed leaves the shared action", async () => {
    const { context, page } = await openAppPage(browser, { ua: ANDROID_UA });
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    const encoded = await encodeSharedPayload(page, cloneFixture(MINIMAL_PAYLOAD));
    if (!encoded.ok) {
      assert(false, "encode required for Chrome shared install", JSON.stringify(encoded));
      await context.close();
      return;
    }
    await page.goto(`${APP_INDEX}#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    await page.evaluate(() => window.__fireInstall());
    await page.waitForSelector("#firstRunInstallAction", { timeout: 8000 });
    await page.click("#firstRunInstallAction");
    await page.waitForTimeout(300);
    const accepted = await page.evaluate(sharedGateSnapshot);
    assert(accepted.gate && accepted.startVisible, "accepted Chrome install keeps the shared row", JSON.stringify(accepted));
    assert(!accepted.install, "accepted install removes the install section", JSON.stringify(accepted));
    assert(!accepted.createVisible, "Create stays hidden after Chrome accepted", JSON.stringify(accepted));
    await context.close();

    const dismissed = await openAppPage(browser, { ua: ANDROID_UA });
    await clearSite(dismissed.page);
    await dismissed.page.reload({ waitUntil: "domcontentloaded" });
    await waitForFirstRun(dismissed.page);
    const encoded2 = await encodeSharedPayload(dismissed.page, cloneFixture(MINIMAL_PAYLOAD));
    await dismissed.page.goto(`${APP_INDEX}#setup=${encoded2.value}`, { waitUntil: "domcontentloaded" });
    await waitForFirstRun(dismissed.page);
    await dismissed.page.evaluate(() => {
      window.__choice = "dismissed";
      window.__fireInstall();
    });
    await dismissed.page.waitForSelector("#firstRunInstallAction", { timeout: 8000 });
    await dismissed.page.click("#firstRunInstallAction");
    await dismissed.page.waitForTimeout(300);
    const afterDismiss = await dismissed.page.evaluate(sharedGateSnapshot);
    assert(afterDismiss.startVisible && afterDismiss.gate, "dismissed Chrome prompt keeps the shared row", JSON.stringify(afterDismiss));
    await dismissed.context.close();
  });

  await runCase("Cookie-only standalone reconstructs the shared gate", async () => {
    const { context, page } = await openAppPage(browser, { ua: ANDROID_UA });
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    const encoded = await encodeSharedPayload(page, cloneFixture(MINIMAL_PAYLOAD));
    if (!encoded.ok) {
      assert(false, "encode required for cookie handoff", JSON.stringify(encoded));
      await context.close();
      return;
    }
    const written = await page.evaluate(async (value) => {
      const api = window.RepForgeSharedSetup;
      if (!api?.writeHandoffCookie) {
        document.cookie = `repforge_setup_v1=${value}; path=${new URL("index.html", location.href).pathname}; max-age=604800; SameSite=Lax`;
        return { fallback: true };
      }
      api.writeHandoffCookie(value);
      return { fallback: false, read: api.readHandoffCookie?.() || null, path: api.handoffCookiePath?.() || null };
    }, encoded.value);
    await context.close();

    const standalone = await openAppPage(browser, { ua: ANDROID_UA, standalone: true });
    await clearSite(standalone.page);
    await standalone.page.evaluate((value) => {
      const api = window.RepForgeSharedSetup;
      if (api?.writeHandoffCookie) api.writeHandoffCookie(value);
      else {
        document.cookie = `repforge_setup_v1=${value}; path=${new URL("index.html", location.href).pathname}; max-age=604800; SameSite=Lax`;
      }
    }, encoded.value);
    await standalone.page.goto(APP_INDEX, { waitUntil: "domcontentloaded" });
    await waitForFirstRun(standalone.page);
    const gate = await standalone.page.evaluate(sharedGateSnapshot);
    const hook = await standalone.page.evaluate(readSharedHook);
    assert(gate.startVisible && gate.gate, "standalone cookie launch shows the shared gate", JSON.stringify({ gate, written, hook }));
    assert(!gate.install && !gate.continueShown, "standalone shared gate has no install section", JSON.stringify(gate));
    assert(gate.lede === SHARED_COPY.en.ledeInstalled, "standalone shared lede is installed copy", gate.lede);
    assert(hook.source === "cookie" || hook.status === "ready", "hook source is the handoff cookie", JSON.stringify(hook));
    await standalone.context.close();
  });

  await runCase("Start persists allowlisted fields, exclusions, and fresh identities", async () => {
    const { context, page } = await openAppPage(browser, { ua: ANDROID_UA, standalone: true });
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    const dirty = cloneFixture(REPRESENTATIVE_PAYLOAD);
    dirty.log = [{ session: "coach-log", date: "2020-01-01", load: 999 }];
    dirty.programHistory = [{ id: "coach-history", program: [] }];
    dirty.settings.notify = { enabled: true, timer: false, session: false, unfinished: false, missed: false };
    dirty.settings.voiceInputEnabled = true;
    dirty.settings.lastExport = "2020-01-01T00:00:00.000Z";
    dirty.program.meta.id = "coach-program-id";
    dirty.program.meta.started = "2020-01-01";
    dirty.program.meta.created = "2020-01-01T00:00:00.000Z";
    dirty.program.meta.onboarded = true;
    dirty.program.exercises[0].id = "coach-slot-id";
    dirty.program.exercises[0].movementId = "coach-movement";
    const encoded = await encodeSharedPayload(page, dirty);
    const fragment = encoded.ok ? encoded.value : wireFragment(dirty);
    await page.goto(`${APP_INDEX}#setup=${fragment}`, { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    const before = await page.evaluate(readDurableState);
    if (!(await clickSharedStart(page))) {
      await context.close();
      return;
    }
    await page.waitForFunction(() => document.querySelector("#firstRun")?.classList.contains("hidden"), null, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(400);
    const after = await page.evaluate(readDurableState);
    const gate = await page.evaluate(sharedGateSnapshot);
    const state = after.state || {};
    assert(state.programMeta?.onboarded === true, "acceptance onboards the recipient", JSON.stringify(state.programMeta));
    assert(state.programMeta?.name === "Força compartilhada", "program name persists", state.programMeta?.name);
    assert(state.programMeta?.daysPerWeek === 4 && state.programMeta?.mesocycleLengthWeeks === 8, "allowlisted metadata persists", JSON.stringify(state.programMeta));
    assert(
      state.settings?.lang === "pt" &&
        state.settings?.rirMode === "effort" &&
        state.settings?.restSec === 165 &&
        state.settings?.jumpPct === 3.5 &&
        state.settings?.minJump === 1.25 &&
        state.settings?.unit === "kg",
      "all eight allowlisted settings persist, including lang",
      JSON.stringify(state.settings)
    );
    assert((state.log || []).length === 0, "payload logs do not persist", JSON.stringify(state.log));
    assert((state.programHistory || []).length === 0, "payload history does not persist", JSON.stringify(state.programHistory));
    assert(state.settings?.notify?.enabled !== true, "notification permission stays device-owned", JSON.stringify(state.settings?.notify));
    assert(state.settings?.voiceInputEnabled !== true, "voice preference is not imported", String(state.settings?.voiceInputEnabled));
    assert(state.programMeta?.id !== "coach-program-id", "program id is minted locally", state.programMeta?.id);
    assert(state.programMeta?.started !== "2020-01-01", "started date is local", state.programMeta?.started);
    assert(!(state.program || []).some((ex) => ex.id === "coach-slot-id"), "exercise slot ids are minted locally", JSON.stringify((state.program || []).map((ex) => ex.id)));
    assert((state.customExercises || []).some((ex) => ex.id === "custom:coach-row"), "embedded custom definition is committed", JSON.stringify(state.customExercises));
    assert(gate.logActive && !gate.gate, "acceptance lands on Today", JSON.stringify(gate));
    const toast = await page.evaluate(() => {
      const el = document.querySelector("#toast");
      return el && !el.classList.contains("hidden") ? el.textContent : null;
    });
    assert(!toast || toast === SHARED_COPY.pt.saved || toast === SHARED_COPY.en.saved, "success uses the existing onboarding toast, not a second dialog", toast);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const reloaded = await page.evaluate(sharedGateSnapshot);
    assert(!reloaded.gate, "the gate stays closed after reload", JSON.stringify(reloaded));
    const cookieAfter = await page.evaluate(readDurableState);
    assert(!cookieAfter.cookie, "standalone acceptance clears the handoff cookie", cookieAfter.cookie);
    assert(before.state?.programMeta?.onboarded !== true, "pre-accept snapshot was not already onboarded", JSON.stringify(before.state?.programMeta));
    await context.close();
  });

  await runCase("Double click produces one transition", async () => {
    const { context, page } = await openAppPage(browser, { standalone: true });
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    const encoded = await encodeSharedPayload(page, cloneFixture(MINIMAL_PAYLOAD));
    if (!encoded.ok) {
      assert(false, "encode required for double-click", JSON.stringify(encoded));
      await context.close();
      return;
    }
    await page.goto(`${APP_INDEX}#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    const beforeRev = await page.evaluate(() => JSON.parse(localStorage.getItem("repforge_v1") || "{}")._storageRevision || 0);
    await page.evaluate(() => {
      const btn = document.querySelector("#firstRunSharedStart");
      btn?.click();
      btn?.click();
    });
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      return {
        onboarded: state.programMeta?.onboarded,
        ids: [state.programMeta?.id],
        revision: state._storageRevision,
        name: state.programMeta?.name,
      };
    });
    assert(after.onboarded === true && after.name === "Coach program", "one Start press commits the shared program", JSON.stringify(after));
    assert(after.revision === beforeRev + 1 || after.revision > beforeRev, "busy guard yields a single durable transition", JSON.stringify({ beforeRev, after }));
    await context.close();
  });

  await runCase("Injected replica success and total write failure", async () => {
    const { context, page } = await openAppPage(browser, { standalone: true });
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    const encoded = await encodeSharedPayload(page, cloneFixture(MINIMAL_PAYLOAD));
    if (!encoded.ok) {
      assert(false, "encode required for persistence adapters", JSON.stringify(encoded));
      await context.close();
      return;
    }
    await page.goto(`${APP_INDEX}#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);

    const localOnly = await page.evaluate(async (key) => {
      const hook = window.__repforgeSharedSetup;
      if (!hook?.commit) return { missing: true };
      const io = {
        writeLocal(snapshot) { localStorage.setItem(key, JSON.stringify(snapshot)); },
        async writeIdb() { throw new Error("idb fail"); },
      };
      const result = await hook.commit(io);
      const state = JSON.parse(localStorage.getItem(key) || "{}");
      return { result, name: state.programMeta?.name, onboarded: state.programMeta?.onboarded };
    }, KEY);
    assert(!localOnly.missing, "commit hook accepts an explicit adapter", JSON.stringify(localOnly));
    assert(
      localOnly.result?.localOk && !localOnly.result?.idbOk && localOnly.onboarded === true,
      "local-only success still commits, matching current replica semantics",
      JSON.stringify(localOnly)
    );
    await context.close();

    const idbPage = await openAppPage(browser, { standalone: true });
    await clearSite(idbPage.page);
    await idbPage.page.reload({ waitUntil: "domcontentloaded" });
    const encoded2 = await encodeSharedPayload(idbPage.page, cloneFixture(MINIMAL_PAYLOAD));
    await idbPage.page.goto(`${APP_INDEX}#setup=${encoded2.value}`, { waitUntil: "domcontentloaded" });
    await waitForFirstRun(idbPage.page);
    const idbOnly = await idbPage.page.evaluate(async (key) => {
      const hook = window.__repforgeSharedSetup;
      if (!hook?.commit) return { missing: true };
      const io = {
        writeLocal() { throw new Error("ls fail"); },
        async writeIdb(snapshot) {
          const db = await new Promise((res, rej) => {
            const r = indexedDB.open("repforge", 1);
            r.onupgradeneeded = () => r.result.createObjectStore("kv");
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
          });
          await new Promise((res, rej) => {
            const tx = db.transaction("kv", "readwrite");
            tx.objectStore("kv").put(structuredClone(snapshot), key);
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
          });
          db.close();
        },
      };
      const result = await hook.commit(io);
      return { result, hook: window.__repforgeSharedSetup?.status };
    }, KEY);
    assert(idbOnly.result?.idbOk && !idbOnly.result?.localOk, "IDB-only success follows existing transaction semantics", JSON.stringify(idbOnly));
    await idbPage.context.close();

    const failPage = await openAppPage(browser, { standalone: true });
    await clearSite(failPage.page);
    await failPage.page.reload({ waitUntil: "domcontentloaded" });
    const encoded3 = await encodeSharedPayload(failPage.page, cloneFixture(MINIMAL_PAYLOAD));
    await failPage.page.goto(`${APP_INDEX}#setup=${encoded3.value}`, { waitUntil: "domcontentloaded" });
    await waitForFirstRun(failPage.page);
    const failed = await failPage.page.evaluate(async () => {
      const hook = window.__repforgeSharedSetup;
      if (!hook?.commit) return { missing: true };
      const result = await hook.commit({
        writeLocal() { throw new Error("ls fail"); },
        async writeIdb() { throw new Error("idb fail"); },
      });
      const start = document.querySelector("#firstRunSharedStart");
      const toast = document.querySelector("#toast");
      return {
        result,
        gate: !document.querySelector("#firstRun")?.classList.contains("hidden"),
        enabled: start && !start.disabled,
        busy: start?.getAttribute("aria-busy") === "true",
        status: hook.status,
        toast: toast && !toast.classList.contains("hidden") ? toast.textContent : null,
      };
    });
    assert(failed.gate && failed.enabled && failed.status === "ready", "total write failure keeps the proposal and retry control", JSON.stringify(failed));
    assert(failed.toast === SHARED_COPY.en.commitFailed, "failure announces the localized retry copy", failed.toast);
    await failPage.context.close();
  });

  await runCase("In-progress draft requires destructive confirmation", async () => {
    const { context, page } = await openAppPage(browser, { standalone: true });
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    const encoded = await encodeSharedPayload(page, cloneFixture(MINIMAL_PAYLOAD));
    if (!encoded.ok) {
      assert(false, "encode required for draft confirmation", JSON.stringify(encoded));
      await context.close();
      return;
    }
    await page.goto(`${APP_INDEX}#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
    await page.evaluate((d) => {
      localStorage.setItem("repforge_draft_v1", JSON.stringify({
        __day: "Day 1",
        __touched: ["ex1_1"],
        ex1_1_load: "60",
        ex1_1_reps: "8",
        ex1_1_rir: "2",
      }));
    }, DRAFT);
    page.once("dialog", (dialog) => dialog.dismiss());
    if (!(await clickSharedStart(page))) {
      await context.close();
      return;
    }
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({
      draft: localStorage.getItem("repforge_draft_v1"),
      onboarded: JSON.parse(localStorage.getItem("repforge_v1") || "{}").programMeta?.onboarded,
      gate: !document.querySelector("#firstRun")?.classList.contains("hidden"),
      start: !!document.querySelector("#firstRunSharedStart") && !document.querySelector("#firstRunSharedStart").disabled,
    }));
    assert(after.gate && after.start, "cancelling the draft confirm leaves the shared gate", JSON.stringify(after));
    assert(after.onboarded !== true, "cancellation does not commit", JSON.stringify(after));
    assert(/ex1_1_load/.test(after.draft || ""), "the in-progress draft is preserved", after.draft);
    await context.close();
  });

  await runCase("Invalid, unsupported, and oversized sources fail closed", async () => {
    const cases = [
      ["unsupported-version", INVALID_DECODE_INPUTS["unsupported-version"], SHARED_COPY.en.unsupported],
      ["invalid-base64", INVALID_DECODE_INPUTS["invalid-base64"], SHARED_COPY.en.invalid],
      ["invalid-gzip", INVALID_DECODE_INPUTS["invalid-gzip"], SHARED_COPY.en.invalid],
      ["encoded-too-large", INVALID_DECODE_INPUTS["encoded-too-large"], SHARED_COPY.en.invalid],
      ["invalid-schema", wireFragment(INVALID_PAYLOADS["invalid-schema"]), SHARED_COPY.en.invalid],
      ["unknown-library-id", wireFragment({
        ...cloneFixture(MINIMAL_PAYLOAD),
        program: {
          ...MINIMAL_PAYLOAD.program,
          exercises: [{ ...MINIMAL_PAYLOAD.program.exercises[0], libraryId: "not_a_real_id" }],
        },
      }), SHARED_COPY.en.invalid],
      ["missing-custom", wireFragment({
        ...cloneFixture(MINIMAL_PAYLOAD),
        program: {
          ...MINIMAL_PAYLOAD.program,
          exercises: [{ ...MINIMAL_PAYLOAD.program.exercises[0], libraryId: "custom:missing" }],
          customExercises: [],
        },
      }), SHARED_COPY.en.invalid],
    ];
    for (const [label, fragment, message] of cases) {
      const { context, page } = await openAppPage(browser, { ua: IOS_UA });
      await clearSite(page);
      await page.evaluate((value) => {
        document.cookie = `repforge_setup_v1=${value}; path=${new URL("index.html", location.href).pathname}; max-age=604800; SameSite=Lax`;
      }, fragment);
      await page.goto(`${APP_INDEX}#setup=${fragment}`, { waitUntil: "domcontentloaded" });
      await waitForFirstRun(page).catch(() => {});
      const gate = await page.evaluate(sharedGateSnapshot);
      const durable = await page.evaluate(readDurableState);
      const absence = sharedPayloadAbsent(durable.state, MINIMAL_PAYLOAD);
      assert(gate.createVisible && gate.importVisible, `${label}: standard Create/Import are restored`, JSON.stringify(gate));
      assert(!gate.startVisible || gate.sharedHidden, `${label}: shared action is not offered`, JSON.stringify(gate));
      assert(gate.errorVisible && gate.errorRole === "status", `${label}: inline error uses role=status`, JSON.stringify(gate));
      assert(gate.errorText === message, `${label}: localized error copy`, gate.errorText);
      assert(absence.ok || durable.state?.programMeta?.onboarded !== true, `${label}: no shared application state is written`, JSON.stringify({ absence, lang: durable.state?.settings?.lang }));
      assert(!durable.cookie, `${label}: invalid staged handoff cookie is cleared`, durable.cookie);
      await context.close();
    }
  });

  await runCase("Missing Compression Streams keep ordinary exports working", async () => {
    const { context, page } = await openAppPage(browser, { noCompression: true });
    await clearSite(page);
    await persistState(page, configuredState({ log: [] }));
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissGates(page);
    const encodeResult = await encodeSharedPayload(page, cloneFixture(MINIMAL_PAYLOAD));
    assert(encodeResult.ok === false && encodeResult.code === "compression-unavailable", "encode reports compression-unavailable", JSON.stringify(encodeResult));
    await page.click('nav button[data-view="program"]');
    await page.waitForSelector("#program.view.active");
    await page.click(SHARED_DOM.shareRow).catch(() => {});
    await page.waitForTimeout(300);
    const shareUi = await page.evaluate((unsupported) => {
      const body = document.body.innerText;
      return {
        unsupported: body.includes(unsupported),
        shareDisabled: document.querySelector("#shareSetupShare")?.disabled !== false,
      };
    }, SHARED_COPY.en.shareUnsupported);
    assert(shareUi.unsupported, "share sheet shows program.share_setup_unsupported", JSON.stringify(shareUi));
    await page.click("#programEditToggle");
    const [programDownload] = await Promise.all([
      page.waitForEvent("download", { timeout: 8000 }).catch(() => null),
      page.click("#exportProgram"),
    ]);
    assert(!!programDownload, "program JSON export still works without CompressionStream");
    await page.click("#openSettings");
    await page.waitForSelector("#settings.view.active");
    const [backupDownload] = await Promise.all([
      page.waitForEvent("download", { timeout: 8000 }).catch(() => null),
      page.click("#exportJson"),
    ]);
    assert(!!backupDownload, "backup JSON export still works without CompressionStream");
    await context.close();

    const openPage = await openAppPage(browser, { noCompression: true, ua: IOS_UA });
    await clearSite(openPage.page);
    await openPage.page.goto(`${APP_INDEX}#setup=${wireFragment(MINIMAL_PAYLOAD)}`, { waitUntil: "domcontentloaded" });
    await waitForFirstRun(openPage.page).catch(() => {});
    const gate = await openPage.page.evaluate(sharedGateSnapshot);
    assert(gate.createVisible && gate.importVisible, "decompression-unavailable restores standard choices", JSON.stringify(gate));
    assert(gate.errorText === SHARED_COPY.en.browserUnsupported, "browser_unsupported copy is used", gate.errorText);
    await openPage.context.close();
  });

  await runCase("Configured state and archived history refuse replacement", async () => {
    for (const [label, seed] of [
      ["onboarded program", configuredState()],
      ["archived history", configuredState({
        onboarded: false,
        log: [],
        programHistory: [{ id: "old-prog", name: "Archived", program: [] }],
      })],
    ]) {
      const { context, page } = await openAppPage(browser, { locale: "en-US" });
      await clearSite(page);
      await persistState(page, seed);
      await page.reload({ waitUntil: "domcontentloaded" });
      await dismissGates(page);
      const encoded = await encodeSharedPayload(page, cloneFixture(REPRESENTATIVE_PAYLOAD));
      const fragment = encoded.ok ? encoded.value : wireFragment(REPRESENTATIVE_PAYLOAD);
      const before = await page.evaluate(readDurableState);
      await page.goto(`${APP_INDEX}#setup=${fragment}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(600);
      const after = await page.evaluate(readDurableState);
      const gate = await page.evaluate(sharedGateSnapshot);
      const toast = await page.evaluate(() => {
        const el = document.querySelector("#toast");
        return el && !el.classList.contains("hidden") ? el.textContent : null;
      });
      assert(!gate.gate, `${label}: first-run gate does not open`, JSON.stringify(gate));
      assert(after.state?.programMeta?.id === before.state?.programMeta?.id, `${label}: program identity is unchanged`, JSON.stringify(after.state?.programMeta));
      assert(after.state?.programMeta?.name !== "Força compartilhada", `${label}: shared name is not applied`, after.state?.programMeta?.name);
      assert(after.state?.settings?.lang !== "pt", `${label}: language is not switched`, after.state?.settings?.lang);
      assert(JSON.stringify(after.state?.programHistory || []) === JSON.stringify(before.state?.programHistory || []), `${label}: history is not cleared`);
      assert(toast === SHARED_COPY.en.existing, `${label}: existing-state notice`, toast);
      await context.close();
    }
  });

  await runCase("Custom-definition collisions remap or reuse, never overwrite", async () => {
    const { context, page } = await openAppPage(browser);
    await clearSite(page);
    await persistState(page, configuredState({ log: [], onboarded: false }));
    await page.reload({ waitUntil: "domcontentloaded" });
    const payload = cloneFixture(REPRESENTATIVE_PAYLOAD);
    const table = await page.evaluate(({ payload, current }) => {
      const hook = window.__repforgeSharedSetup;
      const proposalOf = hook?.proposal || hook?.proposalFromSharedSetup;
      if (typeof proposalOf !== "function") return { missing: true };
      const sharedCustom = payload.program.customExercises[0];
      const sameDef = { ...sharedCustom };
      const differentDef = { ...sharedCustom, name: "Local cable row", primary: "Lats" };
      const otherId = { ...sharedCustom, id: "custom:local-row" };
      const clash = proposalOf(payload, {
        settings: { ...current, lang: "en" },
        programMeta: { onboarded: false },
        program: [],
        log: [],
        programHistory: [],
        customExercises: [differentDef],
      });
      const reuse = proposalOf(payload, {
        settings: { ...current, lang: "en" },
        programMeta: { onboarded: false },
        program: [],
        log: [],
        programHistory: [],
        customExercises: [sameDef],
      });
      const twin = proposalOf(payload, {
        settings: { ...current, lang: "en" },
        programMeta: { onboarded: false },
        program: [],
        log: [],
        programHistory: [],
        customExercises: [otherId],
      });
      const slot = (proposal) => (proposal.program || []).find((ex) => String(ex.libraryId || "").startsWith("custom:"));
      const def = (proposal, id) => (proposal.customExercises || []).find((ex) => ex.id === id);
      return {
        clashKeptLocal: def(clash, "custom:coach-row")?.name === "Local cable row",
        clashRemapped: slot(clash)?.libraryId && slot(clash).libraryId !== "custom:coach-row",
        reuseSame: slot(reuse)?.libraryId === "custom:coach-row" && def(reuse, "custom:coach-row")?.name === sharedCustom.name,
        twinReusesLocal: slot(twin)?.libraryId === "custom:local-row",
      };
    }, { payload, current: CURRENT_SETTINGS_DEFAULTS });
    assert(!table.missing, "proposal hook inspects custom collisions", JSON.stringify(table));
    assert(table.clashKeptLocal && table.clashRemapped, "same ID, different definition: keep local, remap slots", JSON.stringify(table));
    assert(table.reuseSame, "same ID, same definition: reuse", JSON.stringify(table));
    assert(table.twinReusesLocal, "different ID, same definition: reuse recipient ID", JSON.stringify(table));
    await context.close();
  });

  await runCase("Long program names wrap without horizontal overflow", async () => {
    const { context, page } = await openAppPage(browser, { ua: IOS_UA, width: 320, height: 568 });
    await clearSite(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    const long = cloneFixture(MINIMAL_PAYLOAD);
    long.program.meta.name = "A".repeat(100);
    const encoded = await encodeSharedPayload(page, long);
    const fragment = encoded.ok ? encoded.value : wireFragment(long);
    await page.goto(`${APP_INDEX}#setup=${fragment}`, { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page).catch(() => {});
    const shape = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      cap: document.querySelector("#firstRunSharedStart .firstrun-row__cap")?.textContent || "",
      capHeight: document.querySelector("#firstRunSharedStart .firstrun-row__cap")?.getBoundingClientRect().height || 0,
    }));
    assert(!shape.overflow, "320px shared gate has no horizontal overflow", JSON.stringify(shape));
    assert(shape.cap.includes("A".repeat(20)), "the long name is shown, not truncated out of the row", shape.cap);
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
