/**
 * Drive every onboarding surface through the production entry UI.
 *
 * Coverage is derived from ROUTE_STEPS in program-entry.js — recommend,
 * custom, browse, build, import and shared — plus the decision states that
 * are not steps (resume, rule drift, replacement, activation conflict,
 * validation). Nothing here fabricates DOM: each scenario clicks the same
 * controls a person would.
 *
 * `shared_review` is intentionally absent. app.js enters the shared route
 * straight at `step:"preview"` (see the setup-link commit path), so that step
 * has no production surface to photograph.
 */
import { MINIMAL_PAYLOAD, BUILT_IN_IDS } from "../../test/fixtures/shared-setup.mjs";
import { activeEntryState, emptyEntryState } from "./fixtures.mjs";
import { BASE, SETUP_DRAFT, KEY, sleep, waitForApp } from "./session.mjs";

/** Screens that must be seeded with an already-active program. */
const NEEDS_ACTIVE_PROGRAM = new Set([
  "onboarding-start/hub-existing",
  "onboarding-recommend/preview-existing",
  "onboarding-recommend/replacement-confirm",
  "onboarding-recommend/activation-conflict",
  "onboarding-recovery/rules-drift",
]);

export function onboardingState(key, lang) {
  return NEEDS_ACTIVE_PROGRAM.has(key) ? activeEntryState(lang) : emptyEntryState(lang);
}

const pick = (page, key, value) =>
  page.click(`[data-entry-pick="${key}"][data-entry-val="${value}"]`);
const next = (page) => page.click("#onbNext");

async function openHub(page, { existing = false } = {}) {
  if (existing) {
    await page.evaluate(() => window.startOnboarding("settings"));
  } else {
    await page.evaluate(() => window.openFirstRun());
    await page.click("#firstRunCreate");
  }
  await page.waitForSelector("#onboarding.active .entry__hub", { timeout: 20000 });
}

async function route(page, name, { existing = false } = {}) {
  await openHub(page, { existing });
  if (name === "build" || name === "import") await page.click("#entryOwnToggle");
  await page.click(`[data-entry-route="${name}"]`);
}

/** The five generator questions shared by recommend and custom. */
async function answerGenerator(page, { days = "3", desired = "muscle_growth", rest = "120" } = {}) {
  await pick(page, "desiredResult", desired); await next(page);
  await pick(page, "structuredExperience", "6_to_24m");
  await pick(page, "recentConsistency", "most"); await next(page);
  await pick(page, "daysPerWeek", days);
  await pick(page, "sessionMinutes", "60");
  await pick(page, "preferredRestSeconds", rest); await next(page);
  await pick(page, "environment", "commercial_gym"); await next(page);
}

async function recommendTo(page, { result = false, existing = false, desired = "muscle_growth" } = {}) {
  await route(page, "recommend", { existing });
  await answerGenerator(page, { desired });
  if (result) {
    await next(page);
    await page.waitForSelector("[data-entry-select-candidate], #entryActivate", { timeout: 25000 });
  }
}

async function selectCandidate(page) {
  if (await page.locator("[data-entry-select-candidate]").count()) {
    await page.locator("[data-entry-select-candidate]").first().click();
  }
  await page.waitForSelector("#entryActivate", { timeout: 25000 });
}

/**
 * Custom asks the same five generator questions as Recommend but under its own
 * header and step count, so its questionnaire is registered separately rather
 * than assumed identical.
 */
async function customTo(page, step) {
  await route(page, "custom");
  if (step === "desired-result") return;
  await pick(page, "desiredResult", "balanced"); await next(page);
  if (step === "background") return;
  await pick(page, "structuredExperience", "6_to_24m");
  await pick(page, "recentConsistency", "most"); await next(page);
  if (step === "schedule") return;
  await pick(page, "daysPerWeek", "4");
  await pick(page, "sessionMinutes", "60");
  await pick(page, "preferredRestSeconds", "auto"); await next(page);
  if (step === "environment") return;
  await pick(page, "environment", "commercial_gym"); await next(page);
  if (step === "priorities") return;
  await next(page);
  await page.waitForSelector('[data-entry-pick="splitPreference"]', { timeout: 25000 });
  if (step === "shape") return;
  await next(page);
  await page.waitForSelector("[data-entry-select-candidate], #entryActivate", { timeout: 20000 });
  if (step === "result") return;
  await selectCandidate(page);
}

async function browseTo(page, step) {
  await route(page, "browse");
  await page.waitForSelector('[data-entry-pick="daysPerWeek"]', { timeout: 20000 });
  if (step === "schedule") return;
  await pick(page, "daysPerWeek", "4");
  await pick(page, "sessionMinutes", "60");
  await next(page);
  await page.waitForSelector('[data-entry-pick="environment"]', { timeout: 20000 });
  if (step === "environment") return;
  await pick(page, "environment", "commercial_gym"); await next(page);
  await page.waitForSelector("[data-entry-catalogue]", { timeout: 25000 });
  if (step === "catalogue") return;
  // Browse rows are the catalogue buttons themselves; there is no separate
  // select-candidate control on this step the way the generator routes have.
  const choice = page.locator("[data-entry-catalogue]").first();
  await choice.scrollIntoViewIfNeeded();
  await choice.click();
  await page.waitForSelector("#entryActivate", { timeout: 25000 });
}

async function buildTo(page, step) {
  await route(page, "build");
  await page.waitForSelector("#entryProgramName", { timeout: 20000 });
  if (step === "setup") return;
  await page.fill("#entryProgramName", "Manual catalog program");
  await pick(page, "daysPerWeek", "3"); await next(page);
  await page.waitForSelector("#programEditor .pday", { timeout: 25000 });
  if (step === "editor-empty") return;
  const addExercise = async (index) => {
    await page.locator('#programEditor [data-act="addEx"]').nth(index).click();
    await page.waitForSelector("#exPickList .pickrow", { timeout: 20000 });
    await page.locator("#exPickList .pickrow").first().click();
    await page.waitForTimeout(220);
  };
  await addExercise(0);
  if (step === "editor-partial") return;
  for (let day = 1; day < 3; day++) await addExercise(day);
  await page.waitForFunction(
    () => !document.querySelector("#entryEditorActivate")?.disabled,
    undefined,
    { timeout: 20000 }
  );
}

async function importTo(page, step) {
  await route(page, "import");
  // The file input itself is visually hidden and lives in the Settings shell;
  // wait on the entry route's own control instead, then drive the input.
  await page.waitForSelector("#entryImportPick", { timeout: 20000 });
  if (step === "source") return;
  const portuguese = await page.evaluate(() => document.documentElement.lang === "pt-BR");
  const program = {
    meta: { name: portuguese ? "Programa de catálogo importado" : "Imported catalog program" },
    exercises: [{
      id: "bench", day: portuguese ? "Dia 1" : "Day 1",
      name: portuguese ? "Supino reto com barra" : "Barbell bench press",
      sets: 3, repLow: 6, repHigh: 10, muscles: [portuguese ? "Peito" : "Chest"],
      progression: { schemaVersion: 1, strategy: { id: "manual", version: 1, params: { authored: true } }, modifiers: [] },
    }],
  };
  await page.setInputFiles("#importProgram", {
    name: "catalog-program.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(program)),
  });
  await page.waitForSelector("#importReview.active", { timeout: 25000 });
  if (await page.locator("#importCommit").isDisabled()) {
    const raw = page.locator('[data-imp-act="raw"]').first();
    if (await raw.count()) await raw.click();
    else await page.locator('[data-imp-act="link"]').first().click();
  }
  await page.click("#importCommit");
  await page.waitForSelector("#onboarding.active #entryActivate", { timeout: 25000 });
}

/** Land on the setup-link gate, which is the shared route's real entrance. */
async function sharedTo(page, step) {
  const fragment = await page.evaluate(async ({ payload, ids }) => {
    const encoded = await window.RepForgeSharedSetup.encode(payload, { builtInIds: ids });
    if (!encoded?.ok) throw new Error(`encode failed: ${encoded?.code || "unknown"}`);
    return encoded.value;
  }, { payload: MINIMAL_PAYLOAD, ids: [...BUILT_IN_IDS] });
  await page.goto(`${BASE.replace(/\/?$/, "/")}index.html#setup=${fragment}`, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.waitForSelector("#firstRunSharedStart", { timeout: 25000 });
  if (step === "gate") return;
  await page.click("#firstRunSharedStart");
  await page.waitForSelector("#onboarding.active #entryActivate", { timeout: 25000 });
}

async function resume(page) {
  await recommendTo(page);
  // The final answer persists asynchronously. Do not reload until the draft
  // record itself carries the terminal step, or a slow runner captures the
  // previous question as Resume.
  await page.waitForFunction((draftKey) => {
    try { return JSON.parse(localStorage.getItem(draftKey) || "{}").state?.step === "priorities"; }
    catch { return false; }
  }, SETUP_DRAFT, { timeout: 25000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  if (await page.locator("#firstRunCreate").isVisible().catch(() => false)) {
    await page.click("#firstRunCreate");
  } else {
    await page.evaluate(() => window.startOnboarding("settings"));
  }
  await page.waitForSelector("#entryResumeContinue", { timeout: 20000 });
}

async function rulesDrift(page) {
  await page.evaluate(({ key, draft }) => {
    const activeRevision = JSON.parse(localStorage.getItem(key))._storageRevision;
    const Entry = window.RepForgeProgramEntry;
    const versions = window.RepForgeProgramCompiler.VERSIONS;
    let state = Entry.createState({
      draftId: "catalog-rules",
      activeProgramRevisionAtStart: activeRevision,
      now: new Date().toISOString(),
      versions: {
        compiler: String(versions.compiler), family: String(versions.schema),
        blueprint: String(versions.blueprint), catalogue: String(versions.catalogue),
        rules: "old-rules", context: String(versions.context), progression: "range-1",
      },
    });
    state = Entry.selectRoute(state, "recommend");
    state = Entry.setAnswers(state, { desiredResult: "muscle_growth" });
    localStorage.setItem(draft, JSON.stringify({
      schemaVersion: 1, draftId: state.draftId, revision: 1, ownerId: "catalog-rules", state,
    }));
  }, { key: KEY, draft: SETUP_DRAFT });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.evaluate(() => window.startOnboarding("settings"));
  await page.waitForSelector("#entryRebuildRules", { timeout: 20000 });
}

async function activationConflict(page) {
  await recommendTo(page, { result: true, existing: true });
  await selectCandidate(page);
  const newer = await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key));
    state._storageRevision += 1;
    state.programMeta.name = "Newer active program";
    return state;
  }, KEY);
  const other = await page.context().newPage();
  await other.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(other);
  await other.evaluate(({ key, state }) => new Promise((done, reject) => {
    localStorage.setItem(key, JSON.stringify(state));
    const request = indexedDB.open("repforge", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const tx = request.result.transaction("kv", "readwrite");
      tx.objectStore("kv").put(state, key);
      tx.oncomplete = () => { request.result.close(); done(); };
      tx.onerror = () => reject(tx.error);
    };
  }), { key: KEY, state: newer });
  await other.close();
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.evaluate(() => window.startOnboarding("settings"));
  if (await page.locator("#entryResumeContinue").isVisible().catch(() => false)) {
    await page.click("#entryResumeContinue");
  }
  await page.waitForSelector("#entryActivate", { timeout: 25000 });
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.click("#entryActivate");
  await page.waitForSelector(".entry__notice[role=alert]", { timeout: 25000 });
  const step = await page.evaluate(() => window.__repforgeEntryState?.()?.step);
  if (step !== "activation_conflict") {
    throw new Error(`activation conflict did not enter activation_conflict (step=${step || "unknown"})`);
  }
}

/** Bring the frame's subject into view for surfaces taller than the viewport. */
const FOCUS_SELECTOR = {
  "onboarding-recommend/avoidance-pain": ".entry__pain",
  "onboarding-recommend/activation-conflict": ".entry__notice",
  "onboarding-recommend/validation-error": "#entryValidation",
  "onboarding-build/editor-ready": "#entryEditorActivate",
};

export const ONBOARDING_SCENARIOS = {
  "onboarding-start/first-run": (page) => page.evaluate(() => window.openFirstRun()),
  "onboarding-start/hub": (page) => openHub(page),
  "onboarding-start/hub-own-open": async (page) => {
    await openHub(page);
    await page.click("#entryOwnToggle");
    await page.waitForSelector('.entry__own [data-entry-route="build"]', { timeout: 20000 });
  },
  "onboarding-start/hub-existing": (page) => openHub(page, { existing: true }),

  "onboarding-recommend/desired-result": (page) => route(page, "recommend"),
  "onboarding-recommend/background": async (page) => {
    await route(page, "recommend");
    await pick(page, "desiredResult", "muscle_growth");
    await next(page);
  },
  "onboarding-recommend/schedule": async (page) => {
    await route(page, "recommend");
    await pick(page, "desiredResult", "muscle_growth"); await next(page);
    await pick(page, "structuredExperience", "6_to_24m");
    await pick(page, "recentConsistency", "most"); await next(page);
  },
  "onboarding-recommend/environment": async (page) => {
    await route(page, "recommend");
    await pick(page, "desiredResult", "muscle_growth"); await next(page);
    await pick(page, "structuredExperience", "6_to_24m");
    await pick(page, "recentConsistency", "most"); await next(page);
    await pick(page, "daysPerWeek", "3");
    await pick(page, "sessionMinutes", "60");
    await pick(page, "preferredRestSeconds", "120"); await next(page);
  },
  "onboarding-recommend/environment-correction": async (page) => {
    await ONBOARDING_SCENARIOS["onboarding-recommend/environment"](page);
    await pick(page, "environment", "commercial_gym");
    await page.locator(".entry__correct > summary").click();
  },
  "onboarding-recommend/priorities": (page) => recommendTo(page),
  "onboarding-recommend/avoidance-pain": async (page) => {
    await recommendTo(page);
    const search = page.locator("#entryAvoidSearch");
    await search.fill("bench");
    await page.waitForTimeout(120);
    if (!(await page.locator("[data-entry-avoid-add]").count())) {
      await search.fill("supino");
      await page.waitForTimeout(120);
    }
    await page.locator("[data-entry-avoid-add]").first().click();
    await page.click('[data-entry-pick="avoidReason"][data-entry-val$="|pain"]');
  },
  "onboarding-recommend/validation-error": async (page) => {
    await route(page, "recommend");
    await next(page);
    await page.waitForSelector("#entryValidation", { timeout: 20000 });
  },
  "onboarding-recommend/result": (page) => recommendTo(page, { result: true, desired: "balanced" }),
  "onboarding-recommend/preview-first-run": async (page) => {
    await recommendTo(page, { result: true });
    await selectCandidate(page);
  },
  "onboarding-recommend/preview-existing": async (page) => {
    await recommendTo(page, { result: true, existing: true });
    await selectCandidate(page);
  },
  "onboarding-recommend/replacement-confirm": async (page) => {
    await recommendTo(page, { result: true, existing: true });
    await selectCandidate(page);
  },
  "onboarding-recommend/activation-conflict": activationConflict,

  "onboarding-custom/desired-result": (page) => customTo(page, "desired-result"),
  "onboarding-custom/background": (page) => customTo(page, "background"),
  "onboarding-custom/schedule": (page) => customTo(page, "schedule"),
  "onboarding-custom/environment": (page) => customTo(page, "environment"),
  "onboarding-custom/priorities": (page) => customTo(page, "priorities"),
  "onboarding-custom/shape": (page) => customTo(page, "shape"),
  "onboarding-custom/result": (page) => customTo(page, "result"),
  "onboarding-custom/preview": (page) => customTo(page, "preview"),

  "onboarding-browse/schedule": (page) => browseTo(page, "schedule"),
  "onboarding-browse/environment": (page) => browseTo(page, "environment"),
  "onboarding-browse/catalogue": (page) => browseTo(page, "catalogue"),
  "onboarding-browse/preview": (page) => browseTo(page, "preview"),

  "onboarding-build/setup": (page) => buildTo(page, "setup"),
  "onboarding-build/editor-empty": (page) => buildTo(page, "editor-empty"),
  "onboarding-build/editor-partial": (page) => buildTo(page, "editor-partial"),
  "onboarding-build/editor-ready": (page) => buildTo(page, "editor-ready"),

  "onboarding-import/source": (page) => importTo(page, "source"),
  "onboarding-import/preview": (page) => importTo(page, "preview"),

  "onboarding-shared/gate": (page) => sharedTo(page, "gate"),
  "onboarding-shared/preview": (page) => sharedTo(page, "preview"),

  "onboarding-recovery/resume": resume,
  "onboarding-recovery/rules-drift": rulesDrift,
};

export async function focusOnboardingSubject(page, key) {
  await page.evaluate((sel) => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
    if (sel) document.querySelector(sel)?.scrollIntoView({ block: "center", inline: "nearest" });
  }, FOCUS_SELECTOR[key] || null);
  await sleep(page, 200);
}
