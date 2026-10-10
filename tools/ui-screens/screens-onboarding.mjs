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
import { encodeSetupLink } from "../../test/fixtures/setup-link-v4.mjs";
import { activeEntryState, emptyEntryState } from "./fixtures.mjs";
import { BASE, SETUP_DRAFT, KEY, sleep, waitForApp } from "./session.mjs";

/** Screens that must be seeded with an already-active program. */
const NEEDS_ACTIVE_PROGRAM = new Set([
  "onboarding-start/hub-existing",
  "onboarding-recommend/result-existing",
  "onboarding-recommend/replacement-confirm",
  "onboarding-recommend/activation-conflict",
  "onboarding-recovery/rules-drift",
]);

export function onboardingState(key, lang) {
  return NEEDS_ACTIVE_PROGRAM.has(key) ? activeEntryState(lang) : emptyEntryState(lang);
}

// Canonical catalog ids (exercises.js), standing in for the retired short
// library ids "pr_bb"/"cu_bb" that no longer exist.
const BENCH_PRESS_ID = "19f5c6f170d8808bb424e98de4472a7e"; // Barbell bench press
const BARBELL_CURL_ID = "1a15c6f170d880ee83eccf109356e208"; // Barbell biceps curl

const pick = (page, key, value) =>
  page.click(`[data-entry-pick="${key}"][data-entry-val="${value}"]`);
const next = (page) => page.click("#onbNext");

/**
 * Open the entry hub.
 *
 * The `existing` path has to leave the first-run gate before it asks. Seeding
 * an already-onboarded program and calling `startOnboarding` immediately can
 * beat the gate's own dismissal, and `body.is-firstrun main{visibility:hidden}`
 * (styles.css) then hides the hub that did open — present in the DOM, correctly
 * sized, invisible. Waiting for the gate to actually be gone is the difference
 * between a real surface and a blank frame.
 */
/** Name the step that timed out; "waitForSelector timed out" names nothing. */
async function step(label, action) {
  try {
    return await action();
  } catch (error) {
    throw new Error(`${label}: ${error.message.split("\n")[0]}`);
  }
}

async function openHub(page, { existing = false } = {}) {
  if (existing) {
    await page.evaluate(() => window.closeFirstRun?.());
    await step("first-run gate did not clear", () => page.waitForFunction(
      () => !document.body.classList.contains("is-firstrun"),
      undefined,
      { timeout: 20000 }
    ));
    await page.evaluate(() => window.startOnboarding("settings"));
    await step("hub did not open from Settings", () =>
      page.waitForSelector("#onboarding.active .entry__hub", { timeout: 20000 }));
    // The notice is the whole point of this variant: a hub captured without it
    // is the wrong screen, not an early one. With the seed verified it is
    // simply always there, so this is a correctness assertion, not a retry.
    await step("active-program notice never rendered", () =>
      page.waitForSelector(".entry__active", { timeout: 20000 }));
    return;
  }
  await page.evaluate(() => window.openFirstRun());
  await page.click("#firstRunCreate");
  await step("hub did not open from first run", () =>
    page.waitForSelector("#onboarding.active .entry__hub", { timeout: 20000 }));
}

async function route(page, name, { existing = false, goal = "muscle_growth" } = {}) {
  await openHub(page, { existing });
  if (name === "build" || name === "import") await page.click("#entryOwnToggle");
  // Recommend's first question is the hub's featured block: one tap chooses
  // the route and answers the goal, so the next screen is the background step.
  if (name === "recommend") {
    await page.click(`[data-entry-route="recommend"][data-entry-goal="${goal}"]`);
    return;
  }
  await page.click(`[data-entry-route="${name}"]`);
}

/** The helper's last step: "No, I need one" then "Let Taurifer decide" reaches
 * Recommend without answering the goal, so the goal screen itself is shown. */
async function recommendViaHelp(page) {
  await openHub(page);
  await page.click("#entryHelpToggle");
  await page.click('[data-entry-help="q1"][data-entry-help-val="no"]');
  await page.click('[data-entry-help="q2"][data-entry-help-val="recommend"]');
  await page.click("#entryHelpGo");
}

/** The generator questions shared by Recommend and Custom. Recommend's goal is
 * answered on the hub, so it starts at the background step; Custom asks it.
 * The background step asks only experience (no recent-consistency question);
 * the schedule step asks days and the session-ceiling buckets (no rest question). */
async function answerGenerator(page, { days = "3", desired = "muscle_growth", goalAsked = false } = {}) {
  if (goalAsked) { await pick(page, "desiredResult", desired); await next(page); }
  await pick(page, "structuredExperience", "6_to_24m"); await next(page);
  await pick(page, "daysPerWeek", days);
  await pick(page, "sessionMinutes", "60"); await next(page);
  await pick(page, "environment", "commercial_gym"); await next(page);
  await next(page); // movement abilities are optional; the default (unsure) needs no answer
}

async function recommendTo(page, { result = false, existing = false, desired = "muscle_growth" } = {}) {
  await route(page, "recommend", { existing, goal: desired });
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
  // Activation appears once the candidate is compiled and its preview built,
  // which is the slowest step in the generator routes.
  await page.waitForSelector("#entryActivate", { timeout: 40000 });
}

/**
 * Custom asks the same five generator questions as Recommend, then adds its
 * muscle and exercise preference sections under its own header and step count.
 */
async function customTo(page, step) {
  await route(page, "custom");
  if (step === "shape") {
    // A split with two compatible structures is rare in the released rules, so the
    // catalog offers a second, real split id (its name comes from the catalog's own
    // split.<id> key — splitDisplayName in app.js — not a field on the choice object).
    await page.evaluate(() => {
      const base = window.__repforgeOnboarding.services();
      window.__repforgeProgramEntryServicesOverride = {
        ...base,
        splitChoices: (answers) => {
          const result = base.splitChoices(answers);
          if (result.choices.length !== 1) return result;
          const first = result.choices[0];
          const alternateId = first.id === "full_body" ? "upper_lower" : "full_body";
          return { ...result, choices: [first, { ...first, id: alternateId, default: false }] };
        },
      };
    });
  }
  if (step === "desired-result") return;
  await pick(page, "desiredResult", "balanced"); await next(page);
  if (step === "background") return;
  await pick(page, "structuredExperience", "6_to_24m"); await next(page);
  if (step === "schedule") return;
  await pick(page, "daysPerWeek", "4");
  await pick(page, "sessionMinutes", "60"); await next(page);
  if (step === "environment") return;
  await pick(page, "environment", "commercial_gym"); await next(page);
  if (step === "abilities") return;
  await next(page); // movement abilities are optional; the default (unsure) needs no answer
  if (step === "priorities") return;
  await next(page);
  await page.waitForSelector("#entryExerciseSearch", { timeout: 25000 });
  if (["exercise-preferences", "result"].includes(step)) {
    await setCustomExercisePreferences(page);
    if (step === "exercise-preferences") return;
  }
  await next(page);
  if (step === "shape") {
    await page.waitForSelector('[data-entry-pick="splitPreference"]', { timeout: 20000 });
    return;
  }
  await page.waitForSelector("[data-entry-select-candidate], #entryActivate", { timeout: 20000 });
  if (step === "result") return;
}

/* Plan 070: the review editor. Each adjustment waits for the review to settle
   (it is aria-busy while an edit is being saved). */
async function reviewSettled(page) {
  await page.waitForFunction(() => !document.querySelector("#entryReview[aria-busy]"), undefined, { timeout: 20000 });
}
async function reviewTo(page) {
  await recommendTo(page, { result: true, desired: "balanced" });
  await page.waitForSelector("#entryReview [data-review-slot]", { timeout: 25000 });
}
const reviewSlots = (page) => page.$$eval("#entryReview [data-review-slot]", (rows) => rows.map((row) => row.dataset.reviewSlot));
async function openReviewSlot(page, slotId) {
  await page.click(`#entryReview [data-review-slot="${slotId}"]`);
  await page.waitForSelector("#reviewSheet.is-open [data-review-sets]", { timeout: 10000 });
}
async function closeReviewSheet(page) {
  await page.click("#reviewSheet [data-review-done]");
  await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 10000 });
}
/** Three marked rows: a set added, an engine swap and a movement added from the catalog. */
async function reviewChanged(page) {
  await reviewTo(page);
  const [first, second] = await reviewSlots(page);
  await openReviewSlot(page, first);
  await page.click('#reviewSheet [data-review-sets="1"]');
  await reviewSettled(page);
  await closeReviewSheet(page);
  await openReviewSlot(page, second);
  await page.locator("#reviewSheet [data-review-swap]").first().click();
  await reviewSettled(page);
  await closeReviewSheet(page);
  await page.click("#entryReview [data-review-add]");
  await page.waitForSelector("#exPickSheet.is-open", { timeout: 10000 });
  await page.fill("#exPickSearch", "curl");
  await page.locator("#exPickList .pickrow").first().click();
  await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 10000 });
  await reviewSettled(page);
  await page.waitForSelector(".review-toast", { state: "detached", timeout: 10000 });
}

/** A generated review with the answer chip for `chip` open on its editor. */
async function reviewWithEditor(page, chip) {
  await recommendTo(page, { result: true, desired: "balanced" });
  await selectCandidate(page);
  await page.click(`[data-entry-chip="${chip}"]`);
  await page.waitForSelector("#entryEditor", { timeout: 20000 });
}

/** Keep the preference screens representative: the empty state is useful for
 * validation, but the catalogue should also show the two persisted outcomes. */
async function setCustomExercisePreferences(page) {
  const search = page.locator("#entryExerciseSearch");
  const portuguese = await page.evaluate(() => document.documentElement.lang === "pt-BR");
  await search.fill(portuguese ? "supino reto com barra" : "barbell bench press");
  await page.waitForTimeout(120);
  await page.locator(`[data-entry-exercise-add="${BENCH_PRESS_ID}"][data-entry-exercise-status="include"]`).click();
  await search.fill(portuguese ? "rosca com barra" : "barbell biceps curl");
  await page.waitForTimeout(120);
  await page.locator(`[data-entry-exercise-add="${BARBELL_CURL_ID}"][data-entry-exercise-status="avoid"]`).click();
  await page.click(`[data-entry-pick="avoidReason"][data-entry-val="${BARBELL_CURL_ID}|dislike"]`);
}

async function buildTo(page, step) {
  await route(page, "build");
  await page.waitForSelector("#entryProgramName", { timeout: 20000 });
  if (step === "setup") return;
  await page.fill("#entryProgramName", "Manual catalog program");
  await pick(page, "daysPerWeek", "3"); await next(page);
  await page.waitForSelector("#onbProgramEditor .pday", { timeout: 25000 });
  if (step === "editor-empty") return;
  const addExercise = async (index) => {
    const day = page.locator('#onbProgramEditor [data-role="day"]').nth(index);
    const body = day.locator('[data-role="day-body"]');
    if (!(await body.isVisible())) await day.locator('[data-role="toggle-day"]').click();
    const add = body.locator('[data-role="add-exercise"]');
    await add.scrollIntoViewIfNeeded();
    await add.click();
    await page.waitForSelector("#exPickList .pickrow", { timeout: 20000 });
    await page.locator("#exPickList .pickrow").first().click();
    await page.waitForTimeout(220);
  };
  // Each pick is announced ("Exercise added.", R7 J-08). The frame is the editor at rest, so the
  // announcement's ordinary lifetime ends before capture rather than racing the settle pass.
  const settleAnnouncement = () => page.waitForFunction(
    () => document.querySelector("#toast")?.classList.contains("hidden") !== false,
    undefined,
    { timeout: 15000 }
  );
  await addExercise(0);
  if (step === "editor-partial") return settleAnnouncement();
  for (let day = 1; day < 3; day++) await addExercise(day);
  await settleAnnouncement();
  await page.waitForFunction(
    () => !document.querySelector("#entryEditorActivate")?.disabled,
    undefined,
    { timeout: 20000 }
  );
}

/**
 * Settle an import row that the matcher could not confidently link: open the
 * library picker ("choose") and take its first result, the same path a
 * lifter takes when none of the ranked candidates is right. There is no more
 * "keep as typed" escape — every slot now names a real catalog movement.
 */
async function settleUnmatchedImportRow(page) {
  await page.locator('[data-imp-act="choose"]').first().click();
  await page.waitForSelector("#exPickSheet.is-open #exPickList .pickrow", { timeout: 20000 });
  await page.locator("#exPickList .pickrow").first().click();
  await page.waitForFunction(() => !document.querySelector("#exPickSheet")?.classList.contains("is-open"), undefined, { timeout: 20000 });
}

async function importTo(page, step) {
  await route(page, "import");
  // The file input itself is visually hidden and lives in the Settings shell;
  // wait on the entry route's own control instead, then drive the input.
  await page.waitForSelector("#entryImportPick", { timeout: 20000 });
  if (step === "source") return;
  const portuguese = await page.evaluate(() => document.documentElement.lang === "pt-BR");
  if (step === "review") {
    const program = {
      meta: { name: portuguese ? "Treino de catálogo importado" : "Imported catalog program" },
      exercises: [
        {
          id: "bench1", day: portuguese ? "Dia 1" : "Day 1",
          name: portuguese ? "Supino reto com barra" : "Flat barbell bench press",
          sets: 3, repLow: 6, repHigh: 10, muscles: [portuguese ? "Peito" : "Chest"],
          progression: { schemaVersion: 1, strategy: { id: "manual", version: 1, params: { authored: true } }, modifiers: [] },
        },
        {
          id: "bench2", day: portuguese ? "Dia 1" : "Day 1",
          name: portuguese ? "Supino reto com barra" : "Flat barbell bench press",
          sets: 3, repLow: 6, repHigh: 10, muscles: [portuguese ? "Peito" : "Chest"],
          progression: { schemaVersion: 1, strategy: { id: "manual", version: 1, params: { authored: true } }, modifiers: [] },
        },
        {
          id: "zerb", day: portuguese ? "Dia 2" : "Day 2",
          name: "Zerbulator 9000",
          sets: 3, repLow: 10, repHigh: 15, muscles: [portuguese ? "Outro" : "Other"],
          progression: { schemaVersion: 1, strategy: { id: "manual", version: 1, params: { authored: true } }, modifiers: [] },
        },
      ],
    };
    await page.setInputFiles("#importProgram", {
      name: "catalog-program.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(program)),
    });
    await page.waitForSelector("#importReview.active", { timeout: 25000 });
    // The review in progress: the exact bench rows settle themselves and fold,
    // while the unknown row stays open with its choices (choose or create).
    await page.waitForSelector("#importRows .improw.is-folded .improw__btn--change", { timeout: 20000 });
    await page.waitForSelector("#importRows .improw.is-open .improw__btn:not(.improw__btn--change)", { timeout: 20000 });
    const more = page.locator("#importRows .improw.is-open details.improw__more summary").first();
    if (await more.count()) await more.click();
    return;
  }
  const program = {
    meta: { name: portuguese ? "Treino de catálogo importado" : "Imported catalog program" },
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
  // A row that needs a decision leads with its ranked candidates and keeps the
  // escape hatches (choose from the library, or create a custom movement)
  // behind a disclosure, so take a candidate when one is offered and open the
  // disclosure when none is. Every slot names a movement now; there is no
  // unlinked "keep as typed" escape.
  while (await page.locator("#importCommit").isDisabled()) {
    const pick = page.locator('[data-imp-act="pick"]').first();
    if (await pick.count()) { await pick.click(); continue; }
    const link = page.locator('[data-imp-act="link"]').first();
    if (await link.count()) { await link.click(); continue; }
    const more = page.locator(".improw.is-open .improw__more summary").first();
    if (await more.count()) await more.click();
    await settleUnmatchedImportRow(page);
  }
  await page.click("#importCommit");
  await page.waitForSelector("#onboarding.active #entryActivate", { timeout: 25000 });
}

/* The paste door of the import route. Covers stage 1 empty and filled,
   stage 2 assistant choice, stage 3 reply paste, gap resolution (clean and invalid),
   and unreadable reply recovery. */
async function freeformTo(page, step) {
  await openHub(page);
  await page.click("#entryOwnToggle");
  await page.waitForSelector("#entryFreeformStart", { timeout: 20000 });
  await page.click("#entryFreeformStart");
  await page.waitForSelector("#entryFreeformIn", { timeout: 20000 });
  if (step === "paste") return;
  const portuguese = await page.evaluate(() => document.documentElement.lang === "pt-BR");
  await page.fill("#entryFreeformIn", portuguese
    ? "Empurrar A\nSupino reto 4x6-8\nDesenvolvimento militar 3x8-10\n\nPuxar A\nRemada curvada 4x6-10"
    : "Push A\nBench press 4x6-8\nOverhead press 3x8-10\n\nPull A\nBarbell row 4x6-10");
  await page.waitForFunction(
    () => document.querySelector("#entryFreeformNeeds")?.hidden === true,
    undefined,
    { timeout: 20000 }
  );
  if (step === "filled") return;
  await page.click("#entryFreeformContinue");
  await page.waitForSelector("#entryFreeformCopy", { timeout: 20000 });
  if (step === "stage2") return;
  await page.click("#entryFreeformCopy");
  await page.waitForSelector("#entryFreeformOut", { timeout: 20000 });
  await page.waitForFunction(
    () => document.querySelector("#toast")?.classList.contains("hidden") === false,
    undefined,
    { timeout: 5000 }
  );
  if (step === "stage3") {
    // Stage 3 is photographed with its "Prompt copied" confirmation. The toast
    // hides itself 2.4 s after it appears, so whether a frame caught it raced
    // the settle step (and the machine's speed). Holding it open makes the
    // frame deterministic; nothing else in the state changes.
    const held = await page.evaluate(() => {
      if (typeof window.announce !== "function") return false;
      clearTimeout(window.announce._t);
      return !document.querySelector("#toast")?.classList.contains("hidden");
    });
    if (!held) throw new Error("freeform stage 3: the copy confirmation toast could not be held open");
    return;
  }
  await page.waitForFunction(
    () => document.querySelector("#toast")?.classList.contains("hidden") === true,
    undefined,
    { timeout: 5000 }
  );
  if (step === "unreadable") {
    await page.fill("#entryFreeformOut", portuguese
      ? "Desculpe, não consegui entender este formato de treino."
      : "Sorry, I could not parse this workout format.");
    await page.click("#entryFreeformReview");
    await page.waitForSelector("#entryFreeformCopyRepair", { timeout: 20000 });
    await page.waitForFunction(
      () => document.querySelector("#toast")?.classList.contains("hidden") === false,
      undefined,
      { timeout: 5000 }
    );
    await page.waitForFunction(
      () => document.querySelector("#toast")?.classList.contains("hidden") === true,
      undefined,
      { timeout: 5000 }
    );
    return;
  }
  const gapReply = JSON.stringify({
    version: 3,
    meta: { name: "Push Pull Split" },
    exercises: [
      { day: "Push", order: 1, name: "Bench press", sets: 4, min: 6, max: 8 },
      { day: "Push", order: 2, name: "Cable flyes", sets: 3 },
      { day: "Pull", order: 1, name: "Lat pulldown", min: 10, max: 12 }
    ],
    missing: [
      { day: "Push", order: 2, field: "reps" },
      { day: "Pull", order: 1, field: "sets" }
    ],
    notImported: ["rest_times", "rir_rpe"]
  });
  await page.fill("#entryFreeformOut", gapReply);
  await page.click("#entryFreeformReview");
  await page.waitForSelector("#entryFreeformSubmitGaps", { timeout: 20000 });
  if (step === "gaps") return;
  if (step === "gaps-invalid") {
    await page.click("#entryFreeformSubmitGaps");
    await page.waitForSelector(".entry__field-input.is-invalid", { timeout: 20000 });
    return;
  }
}

/**
 * A setup link carries the app language (ADR 0007), and the shared gate
 * deliberately follows the *payload's* language rather than the device's — so
 * a payload is not locale-neutral capture input the way a seeded state is.
 * Feeding the English fixture to the `pt` variant produced a frame filed as
 * PT-BR that could only ever render English, which reads as a localization
 * bug in the app and is not one. Match the payload to the frame instead.
 */
function sharedLinkOptionsFor(portuguese) {
  return portuguese ? { name: "Treino do treinador", language: "pt" } : { name: "Coach block", language: "en" };
}

/** Land on the setup-link gate, which is the shared route's real entrance. */
async function sharedTo(page, step) {
  const portuguese = await page.evaluate(() => document.documentElement.lang === "pt-BR");
  const encoded = await encodeSetupLink(page, sharedLinkOptionsFor(portuguese));
  if (!encoded?.ok) throw new Error(`encode failed: ${encoded?.code || "unknown"}`);
  await page.goto(`${BASE.replace(/\/?$/, "/")}index.html#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.waitForSelector("#firstRunSharedStart", { timeout: 25000 });
  if (step === "gate") return;
  await page.click("#firstRunSharedStart");
  await page.waitForSelector("#onboarding.active #entryActivate", { timeout: 25000 });
}

async function sharedInvalidTo(page) {
  await page.goto(`${BASE.replace(/\/?$/, "/")}index.html#setup=v1.not+base64`, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.waitForSelector('#firstRun[data-entry-landing="shared-invalid"]:not(.hidden)', { timeout: 25000 });
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
    // A real current-versions snapshot with one pin rolled back to a stale value:
    // any single mismatch is enough to trigger the rebuild-required notice on
    // the recommend route (program-entry.js changedVersions/entryRebuildRules).
    const versions = { ...window.__repforgeOnboarding.services().currentVersions(), rules: "old-rules" };
    let state = Entry.createState({
      draftId: "catalog-rules",
      activeProgramRevisionAtStart: activeRevision,
      now: new Date().toISOString(),
      versions,
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
  // Readiness is checked before the replace dialog, so a stale setup meets the
  // conflict notice first and never asks to replace anything.
  await page.click("#entryActivate");
  await page.waitForSelector(".entry__notice[role=alert]", { timeout: 25000 });
  const step = await page.evaluate(() => window.__repforgeEntryState?.()?.step);
  if (step !== "activation_conflict") {
    throw new Error(`activation conflict did not enter activation_conflict (step=${step || "unknown"})`);
  }
}

/** Bring the frame's subject into view for surfaces taller than the viewport. */
const FOCUS_SELECTOR = {
  // The landing is one scrolling page inside #firstRun; each scrolled state brings its band to the middle of the frame.
  "onboarding-start/first-run-ways": ".firstrun-way--surface",
  "onboarding-start/first-run-track": '[data-landing-outcome="hold"]',
  "onboarding-start/first-run-data": ".firstrun-rows",
  "onboarding-start/first-run-faq-open": ".firstrun-qa[open]",
  "onboarding-start/first-run-close": ".firstrun-close__actions",
  "onboarding-start/hub-own-open": "#entryOwnToggle",
  "onboarding-recommend/avoidance-pain": ".entry__pain",
  "onboarding-recommend/chip-editor-open": ".entry-chips",
  "onboarding-recommend/result-avoided": ".entry__constraints",
  "onboarding-custom/exercise-preferences": ".entry__exercise-selected-group",
  "onboarding-recommend/activation-conflict": ".entry__notice",
  "onboarding-build/editor-ready": "#entryEditorActivate",
  "onboarding-recommend/result-changed": ".review__row.is-changed",
  "onboarding-recommend/review-reorder": "[data-review-reorder]",
  "onboarding-recommend/review-empty-day": ".review__empty",
};

/**
 * The landing's proof is pinned: one phone, one lens, seven steps. Its frame is the
 * middle of step 4 (the rest timer), where the lens, the rail and the persistent Build
 * control are all in view. The scroll is the track's own geometry, not a pixel offset.
 */
const FOCUS_PROOF_STEP = { "onboarding-start/first-run-proof": 3 };

/**
 * The landing in its first-visit form. A seeded empty device boots straight into
 * it, and that boot is what marks the device as having seen it: opening it a
 * second time would draw the returning form. So the boot's own landing is the
 * frame, and one is opened only if the boot did not.
 */
async function openLanding(page) {
  const first = '#firstRun:not(.hidden)[data-entry-visit="first"]';
  if (!(await page.locator(first).count())) await page.evaluate(() => window.openFirstRun());
  await step("first-visit landing did not open", () => page.waitForSelector(first, { timeout: 20000 }));
}

/**
 * A return to the same empty device. The first visit has marked the landing
 * seen, so the next boot opens the returning landing; with `draft`, a setup the
 * lifter left half done (Recommend, answered to its last step) is named on it.
 */
async function returnToLanding(page, { draft = false } = {}) {
  if (draft) {
    await recommendTo(page);
    await step("setup draft was not saved", () => page.waitForFunction((draftKey) => {
      try { return JSON.parse(localStorage.getItem(draftKey) || "{}").state?.step === "priorities"; }
      catch { return false; }
    }, SETUP_DRAFT, { timeout: 25000 }));
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const mark = draft ? '[data-entry-draft="recommend"]' : ":not([data-entry-draft])";
  await step("returning landing did not open", () => page.waitForSelector(
    `#firstRun:not(.hidden)[data-entry-visit="returning"]${mark}`, { timeout: 20000 }));
}

async function openLandingQuestion(page) {
  await openLanding(page);
  await page.click('[data-landing-section="faq"] details:nth-of-type(3) summary');
  await page.waitForSelector(".firstrun-qa[open]", { timeout: 10000 });
}

export const ONBOARDING_SCENARIOS = {
  "onboarding-start/first-run": openLanding,
  "onboarding-start/first-run-proof": openLanding,
  "onboarding-start/first-run-ways": openLanding,
  "onboarding-start/first-run-track": openLanding,
  "onboarding-start/first-run-data": openLanding,
  "onboarding-start/first-run-faq-open": openLandingQuestion,
  "onboarding-start/first-run-close": openLanding,
  "onboarding-start/first-run-returning": (page) => returnToLanding(page),
  "onboarding-start/first-run-returning-resume": (page) => returnToLanding(page, { draft: true }),
  "onboarding-start/hub": (page) => openHub(page),
  "onboarding-start/hub-own-open": async (page) => {
    await openHub(page);
    await page.click("#entryOwnToggle");
    await page.waitForSelector('.entry__own [data-entry-route="build"]', { timeout: 20000 });
  },
  "onboarding-start/hub-existing": (page) => openHub(page, { existing: true }),
  "onboarding-start/hub-help": async (page) => {
    await openHub(page);
    await page.click("#entryHelpToggle");
    await page.click('[data-entry-help="q1"][data-entry-help-val="no"]');
    await page.click('[data-entry-help="q2"][data-entry-help-val="recommend"]');
    await page.waitForSelector("#entryHelpGo", { timeout: 20000 });
  },

  "onboarding-recommend/desired-result": recommendViaHelp,
  "onboarding-recommend/background": (page) => route(page, "recommend"),
  "onboarding-recommend/schedule": async (page) => {
    await route(page, "recommend");
    await pick(page, "structuredExperience", "6_to_24m"); await next(page);
  },
  "onboarding-recommend/environment": async (page) => {
    await route(page, "recommend");
    await pick(page, "structuredExperience", "6_to_24m"); await next(page);
    await pick(page, "daysPerWeek", "3");
    await pick(page, "sessionMinutes", "60"); await next(page);
  },
  "onboarding-recommend/abilities": async (page) => {
    await route(page, "recommend");
    await pick(page, "structuredExperience", "6_to_24m"); await next(page);
    await pick(page, "daysPerWeek", "3");
    await pick(page, "sessionMinutes", "60"); await next(page);
    await pick(page, "environment", "commercial_gym"); await next(page);
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
  "onboarding-recommend/result": (page) => recommendTo(page, { result: true, desired: "balanced" }),
  "onboarding-recommend/result-existing": (page) => recommendTo(page, { result: true, existing: true }),
  "onboarding-recommend/chip-editor-open": (page) => reviewWithEditor(page, "days"),
  "onboarding-recommend/result-corrected": async (page) => {
    await reviewWithEditor(page, "days");
    await pick(page, "daysPerWeek", "4");
    await page.click("#entryChipApply");
    await page.waitForSelector("#entryChange", { timeout: 25000 });
  },
  "onboarding-recommend/result-avoided": async (page) => {
    await reviewWithEditor(page, "prio");
    const search = page.locator("#entryAvoidSearch");
    // Avoid an exercise the program contains, so the statement is about a real change.
    const first = await page.evaluate(() => (window.__repforgeEntryState().result.preview.program[0] || {}).libraryId);
    // The search matches the localized library name, so search with the name the lifter sees.
    const name = await page.evaluate((id) => {
      const entry = window.__repforgeLibraryEntry?.(id);
      if (!entry) return "";
      // app.js's libraryName(): the PT name when the page is PT, else the English one.
      return (document.documentElement.lang === "pt-BR" && entry.namePt) || entry.name;
    }, first);
    if (!name) throw new Error("result-avoided: the program's first exercise has no library name");
    await search.fill(name);
    await page.waitForTimeout(150);
    await page.locator(`[data-entry-avoid-add="${first}"]`).click();
    await page.click(`[data-entry-pick="avoidReason"][data-entry-val="${first}|dislike"]`);
    await page.click("#entryChipApply");
    await page.waitForSelector("#entryChange", { timeout: 25000 });
  },
  "onboarding-recommend/replacement-confirm": async (page) => {
    await recommendTo(page, { result: true, existing: true });
    await selectCandidate(page);
    await page.click("#entryActivate");
    await page.waitForSelector("#entryReplaceConfirm", { timeout: 20000 });
  },
  "onboarding-recommend/activation-conflict": activationConflict,
  "onboarding-recommend/result-changed": reviewChanged,
  "onboarding-recommend/review-sheet": async (page) => {
    await reviewTo(page);
    await openReviewSlot(page, (await reviewSlots(page))[0]);
  },
  "onboarding-recommend/review-sheet-swap": async (page) => {
    await reviewTo(page);
    await openReviewSlot(page, (await reviewSlots(page))[0]);
    await page.locator("#reviewSheet [data-review-alt-add]").first().click();
    await reviewSettled(page);
    await page.evaluate(() => {
      const body = document.querySelector("#reviewSheetBody");
      const swap = body?.querySelectorAll(".review-sheet__sec")[1];
      if (body && swap) body.scrollTop = swap.offsetTop - body.offsetTop;
    });
  },
  "onboarding-recommend/review-day-menu": async (page) => {
    await reviewTo(page);
    await page.click("#entryReview [data-review-day-menu]");
    await page.waitForSelector('#reviewSheet.is-open [data-review-day-action="reorder"]', { timeout: 10000 });
  },
  "onboarding-recommend/review-reorder": async (page) => {
    await reviewTo(page);
    await page.click("#entryReview [data-review-day-menu]");
    await page.click('#reviewSheet [data-review-day-action="reorder"]');
    await page.waitForSelector("#entryReview [data-review-reorder]", { timeout: 10000 });
    await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 10000 });
  },
  "onboarding-recommend/review-empty-day": async (page) => {
    await reviewTo(page);
    for (const slotId of await reviewSlots(page)) {
      await openReviewSlot(page, slotId);
      await page.click("#reviewSheet [data-review-remove]");
      await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 10000 });
      await reviewSettled(page);
    }
    await page.waitForSelector(".review-toast", { state: "detached", timeout: 10000 });
  },
  "onboarding-recommend/review-rebuild-confirm": async (page) => {
    await reviewTo(page);
    await openReviewSlot(page, (await reviewSlots(page))[0]);
    await page.click('#reviewSheet [data-review-sets="1"]');
    await reviewSettled(page);
    await closeReviewSheet(page);
    await page.click('[data-entry-chip="days"]');
    await page.waitForSelector("#entryEditor", { timeout: 20000 });
    await pick(page, "daysPerWeek", "4");
    await page.click("#entryChipApply");
    await page.waitForSelector("#reviewConfirmGo", { timeout: 20000 });
  },

  "onboarding-custom/desired-result": (page) => customTo(page, "desired-result"),
  "onboarding-custom/background": (page) => customTo(page, "background"),
  "onboarding-custom/schedule": (page) => customTo(page, "schedule"),
  "onboarding-custom/environment": (page) => customTo(page, "environment"),
  "onboarding-custom/abilities": (page) => customTo(page, "abilities"),
  "onboarding-custom/priorities": (page) => customTo(page, "priorities"),
  "onboarding-custom/exercise-preferences": (page) => customTo(page, "exercise-preferences"),
  "onboarding-custom/shape": (page) => customTo(page, "shape"),
  "onboarding-custom/result": (page) => customTo(page, "result"),

  "onboarding-build/setup": (page) => buildTo(page, "setup"),
  "onboarding-build/editor-empty": (page) => buildTo(page, "editor-empty"),
  "onboarding-build/editor-partial": (page) => buildTo(page, "editor-partial"),
  "onboarding-build/editor-ready": (page) => buildTo(page, "editor-ready"),

  "onboarding-import/source": (page) => importTo(page, "source"),
  "onboarding-import/review": (page) => importTo(page, "review"),
  "onboarding-import/freeform-empty": (page) => freeformTo(page, "paste"),
  "onboarding-import/freeform-filled": (page) => freeformTo(page, "filled"),
  "onboarding-import/freeform-stage2": (page) => freeformTo(page, "stage2"),
  "onboarding-import/freeform-stage3": (page) => freeformTo(page, "stage3"),
  "onboarding-import/freeform-gaps": (page) => freeformTo(page, "gaps"),
  "onboarding-import/freeform-gaps-invalid": (page) => freeformTo(page, "gaps-invalid"),
  "onboarding-import/freeform-unreadable": (page) => freeformTo(page, "unreadable"),
  "onboarding-import/preview": (page) => importTo(page, "preview"),

  "onboarding-shared/gate": (page) => sharedTo(page, "gate"),
  "onboarding-shared/invalid": sharedInvalidTo,
  "onboarding-shared/preview": (page) => sharedTo(page, "preview"),

  "onboarding-recovery/resume": resume,
  "onboarding-recovery/rules-drift": rulesDrift,
  "onboarding-recovery/cancel-confirm": async (page) => {
    // Cancel is offered from every screen; the schedule step shows the dialog
    // over a screen with answers in progress.
    await ONBOARDING_SCENARIOS["onboarding-recommend/schedule"](page);
    await pick(page, "daysPerWeek", "3");
    await page.click("#onbCancel");
    await page.waitForSelector("#entryCancelKeep", { timeout: 20000 });
  },
  "onboarding-recovery/restart-confirm": async (page) => {
    await recommendTo(page, { result: true });
    await selectCandidate(page);
    await page.click("#entryRestart");
    await page.waitForSelector("#entryRestartConfirm", { timeout: 20000 });
  },
};

export async function focusOnboardingSubject(page, key) {
  await page.evaluate((sel) => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
    const onboarding = document.querySelector("#onboarding");
    if (onboarding) {
      onboarding.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
      onboarding.scrollTop = 0;
      onboarding.scrollLeft = 0;
    }
    const firstRun = document.querySelector("#firstRun");
    if (firstRun) {
      firstRun.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
      firstRun.scrollTop = 0;
      firstRun.scrollLeft = 0;
    }
    if (sel) document.querySelector(sel)?.scrollIntoView({ block: "center", inline: "nearest" });
  }, FOCUS_SELECTOR[key] || null);
  if (FOCUS_PROOF_STEP[key] !== undefined) {
    await page.evaluate((index) => {
      const root = document.querySelector("#firstRun");
      const track = document.querySelector("#firstRunProofTrack");
      const stage = document.querySelector("#firstRunProofStage");
      if (!root || !track || !stage) return;
      const span = track.offsetHeight - stage.offsetHeight;
      root.scrollTo({ top: track.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop + span * (index + 0.5) / 7, behavior: "auto" });
    }, FOCUS_PROOF_STEP[key]);
    await sleep(page, 400);
  }
  await sleep(page, 200);
}
