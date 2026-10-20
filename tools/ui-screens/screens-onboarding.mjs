import {installBrowserTraining, installBrowserTrainingBeforeNavigation} from "../../test/training-browser.mjs";
import {browserLanguage} from "../../test/language-browser.mjs";
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
import assert from "node:assert/strict";
import { encodeSetupLink } from "../../test/fixtures/setup-link-v4.mjs";
import { answerRecommend } from "../../test/browser.mjs";
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

/* Onboarding B's hub (Plan 072): a card is chosen, then Continue enters it. */
async function route(page, name, { existing = false } = {}) {
  await openHub(page, { existing });
  await page.click(`[data-entry-hub="${name}"]`);
  await next(page);
  if (name === "recommend") await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "intro", undefined, { timeout: 20000 });
}

async function routeWithFixedDraftId(page, draftId) {
  await page.evaluate((fixedId) => {
    let sequence = 0;
    Object.defineProperty(window.crypto, "randomUUID", {
      configurable: true,
      value: () => {
        sequence += 1;
        // The first UUID belongs to the first-run surface; the next is the
        // production createEntryState() draft identity.
        if (sequence === 2) return fixedId;
        return `10000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
      },
    });
  }, draftId);
  await openHub(page);
  await page.click('[data-entry-hub="recommend"]');
  await next(page);
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "intro", undefined, { timeout: 20000 });
  const actual = await page.evaluate(() => window.__repforgeEntryState?.()?.draftId || null);
  if (actual !== draftId) throw new Error(`recommend route did not retain its fixed draft identity (${actual || "missing"})`);
}

async function recommendToReviewWithFixedDraftId(page, draftId, answers = {}) {
  await installOfferVerificationObserver(page);
  await routeWithFixedDraftId(page, draftId);
  await answerRecommend(page, { skipBasics: true, ...answers });
  await page.waitForSelector("#entryReview [data-review-slot]", { timeout: 25000 });
  await waitForOfferVerification(page);
}

/** B's Recommend screens, answered as a lifter would, stopping on `until`. */
async function recommendStep(page, until, answers = {}) {
  await route(page, "recommend");
  if (until === "intro") return;
  await answerRecommend(page, { skipBasics: true, days: 3, environment: "commercial_gym", ...answers, until });
}

export function installOfferVerificationObserverInBrowser() {
  if (window.__catalogEntryOfferObserver) return;
  const digest = value => {
    const text = JSON.stringify(value) ?? String(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  };
  const observer = {
    engines: 0,
    jobs: [],
    order: 0,
    digest,
    diagnostic() {
      const current = window.__repforgeEntryState?.();
      return {
        context: {
          locale: document.documentElement.lang,
          theme: document.documentElement.dataset.theme || "light",
          viewportWidth: window.innerWidth,
        },
        current: {
          step: current?.step || null,
          route: current?.route || null,
          draftDigest: digest(current?.draftId || ""),
          resultFingerprintDigest: current?.result?.fingerprint ? digest(current.result.fingerprint) : null,
        },
        engineCount: this.engines,
        jobs: this.jobs.map(job => ({
          engineId: job.engineId,
          jobId: job.jobId,
          foreground: job.foreground,
          step: job.step,
          draftDigest: job.draftDigest,
          requestDigest: job.requestDigest,
          confirmationCount: job.confirmationCount,
          status: job.status,
          outcome: job.outcome || null,
          resultDigest: job.resultDigest || null,
          mode: job.mode || null,
          startedOrder: job.startedOrder,
          settledOrder: job.settledOrder || null,
        })),
      };
    },
    snapshot() {
      const current = window.__repforgeEntryState?.();
      const draftDigest = digest(current?.draftId || "");
      const primaryEngineId = this.jobs.reduce((first, job) => first === null ? job.engineId : Math.min(first, job.engineId), null);
      const foregroundJobs = this.jobs.filter(job => job.engineId === primaryEngineId && job.draftDigest === draftDigest)
        .sort((left, right) => left.startedOrder - right.startedOrder);
      const baseline = foregroundJobs.at(-1) || null;
      if (!baseline || current?.step !== "result" || current.route !== "recommend") {
        return { ready: false, readiness: "waiting for the current foreground result", ...this.diagnostic() };
      }
      if (baseline.status === "pending") {
        return { ready: false, readiness: "foreground result is still pending", ...this.diagnostic() };
      }
      if (baseline.status !== "settled" || baseline.result?.ok !== true) {
        return { ready: false, readiness: "foreground result did not succeed", ...this.diagnostic() };
      }
      // Bind the successful foreground transport to the displayed definition
      // before any review edits. Later eligibility is checked against live slots.
      if (!baseline.boundFingerprint) {
        const identity = window.__repforgeTrainingTest.identity;
        if (!current.result?.fingerprint || identity.digestCanonical(baseline.result.value)
          !== identity.digestCanonical(current.result?.preview?.programDefinition)) {
          return { ready: false, readiness: "foreground response does not match the current preview", ...this.diagnostic() };
        }
        baseline.boundFingerprint = current.result.fingerprint;
      }
      const candidates = Array.isArray(baseline.result.confirmationOffers) ? baseline.result.confirmationOffers : [];
      const baseConfirmations = baseline.request?.movementConfirmations || {};
      const used = new Set();
      const verification = candidates.map(offer => {
        const confirmations = { ...baseConfirmations, [offer.offeredExerciseId]: [...(offer.prerequisiteIds || [])] };
        const requestDigest = window.__repforgeTrainingTest.identity.digestCanonical({ ...baseline.request, movementConfirmations: confirmations });
        const job = this.jobs.find(candidate => candidate.engineId !== primaryEngineId
          && candidate.draftDigest === draftDigest && candidate.requestDigest === requestDigest
          && candidate.startedOrder > baseline.startedOrder && !used.has(candidate.jobId));
        if (job) used.add(job.jobId);
        // A rejected transport can trigger fallback; it is not a verified refusal.
        if (!job || job.status !== "settled") return { ready: false, requestDigest, job: job || null };
        const dayIndex = baseline.result.value.days.findIndex(day => day.slots.some(slot => slot.id === offer.slotId));
        const slotIndex = dayIndex < 0 ? -1 : baseline.result.value.days[dayIndex].slots.findIndex(slot => slot.id === offer.slotId);
        const slot = job.result?.ok ? job.result.value?.days?.[dayIndex]?.slots?.[slotIndex] : null;
        return { ready: true, accepted: slot?.exerciseId === offer.offeredExerciseId, requestDigest, job };
      });
      const allSettled = verification.every(item => item.ready);
      const rendered = [...document.querySelectorAll("#entryReview [data-review-confirm-offer]")]
        .map(row => ({ slotId: row.dataset.reviewConfirmOffer, exerciseId: row.dataset.reviewOfferExerciseId }));
      const visibleSlotIds = new Set([...document.querySelectorAll("#entryReview [data-review-slot]")]
        .map(row => row.dataset.reviewSlot));
      const reviewTabsMounted = !!document.querySelector("#entryReview .review__tabs");
      const confirmedExerciseIds = new Set(Object.entries(current.answers?.movementConfirmations || {})
        .filter(([, prerequisites]) => Array.isArray(prerequisites) && prerequisites.length > 0)
        .map(([exerciseId]) => exerciseId));
      const baselineSlots = baseline.result.value?.days?.flatMap(day => day.slots || []) || [];
      const currentSlots = current.result?.preview?.programDefinition?.days?.flatMap(day => day.slots || []) || [];
      const verifiedPairs = allSettled ? candidates.map((offer, index) => verification[index].accepted
        ? { offer, slotId: offer.slotId, exerciseId: offer.offeredExerciseId } : null).filter(Boolean) : [];
      const liveEligibility = verifiedPairs.map(({ offer, slotId, exerciseId }) => {
        const source = baselineSlots.find(slot => slot.id === offer.slotId);
        const live = currentSlots.find(slot => slot.id === offer.slotId);
        const checks = {
          sourceExists: !!source,
          liveExists: !!live,
          sameCurrentExercise: !!source && !!live && live.exerciseId === source.exerciseId,
          declaredCurrentMatches: !offer.currentExerciseId || (!!source && offer.currentExerciseId === source.exerciseId),
          offeredNotCurrent: !!live && live.exerciseId !== offer.offeredExerciseId,
          offeredNotDuplicated: !currentSlots.some(slot => slot.id !== offer.slotId && slot.exerciseId === offer.offeredExerciseId),
          slotVisibleInReview: visibleSlotIds.has(offer.slotId),
          slotNotAlreadyConfirmed: !!live && !confirmedExerciseIds.has(live.exerciseId),
        };
        return { offer, slotId, exerciseId, checks,
          eligible: Object.values(checks).every(Boolean) };
      });
      const eligiblePairs = liveEligibility.filter(item => item.eligible);
      const sortedPairs = pairs => pairs.map(({ slotId, exerciseId }) => ({ slotId, exerciseId }))
        .sort((left, right) => left.slotId.localeCompare(right.slotId) || left.exerciseId.localeCompare(right.exerciseId));
      const verifiedBaselinePairs = sortedPairs(verifiedPairs);
      const expectedPairs = sortedPairs(eligiblePairs);
      rendered.sort((left, right) => left.slotId.localeCompare(right.slotId) || left.exerciseId.localeCompare(right.exerciseId));
      const renderedDigest = digest(rendered);
      const expectedDigest = digest(expectedPairs);
      const reviewReady = reviewTabsMounted && visibleSlotIds.size > 0
        && [...visibleSlotIds].every(slotId => currentSlots.some(slot => slot.id === slotId));
      const matching = allSettled && reviewReady && renderedDigest === expectedDigest;
      return {
        ready: matching,
        context: {
          locale: document.documentElement.lang,
          theme: document.documentElement.dataset.theme || "light",
          viewportWidth: window.innerWidth,
        },
        draftDigest,
        resultFingerprintDigest: current.result?.fingerprint ? digest(current.result.fingerprint) : null,
        foreground: {
          engineId: baseline.engineId,
          jobId: baseline.jobId,
          requestDigest: baseline.requestDigest,
          resultDigest: baseline.resultDigest,
          mode: baseline.mode,
          startedOrder: baseline.startedOrder,
          settledOrder: baseline.settledOrder,
        },
        candidateCount: candidates.length,
        matchedVerifierCount: verification.filter(item => item.job).length,
        settledVerifierCount: verification.filter(item => item.ready).length,
        verifierJobs: verification.filter(item => item.job).map(item => ({
          engineId: item.job.engineId,
          jobId: item.job.jobId,
          requestDigest: item.job.requestDigest,
          resultDigest: item.job.resultDigest || null,
          mode: item.job.mode || null,
          outcome: item.job.outcome || null,
          startedOrder: item.job.startedOrder,
          settledOrder: item.job.settledOrder || null,
        })),
        verifiedBaselineCount: allSettled ? verifiedBaselinePairs.length : null,
        eligibleCount: allSettled ? expectedPairs.length : null,
        excludedAfterReviewEditCount: allSettled ? verifiedBaselinePairs.length - expectedPairs.length : null,
        confirmedReviewRowCount: [...document.querySelectorAll("#entryReview [data-review-confirmed]")].length,
        liveEligibility: liveEligibility.map(item => ({ ...item.checks, eligible: item.eligible })),
        visibleCount: rendered.length,
        renderedReviewSlotCount: visibleSlotIds.size,
        reviewReady,
        verifiedBaselineOffersDigest: allSettled ? digest(verifiedBaselinePairs) : null,
        expectedOffersDigest: allSettled ? digest(expectedPairs) : null,
        renderedOffersDigest: renderedDigest,
        totalJobs: this.jobs.length,
        readiness: matching ? "all candidate checks settled and rendered offers match"
          : !allSettled ? "waiting for matching verifier replies"
            : !reviewReady ? "Review has not mounted its current visible rows"
              : "settled verifier output does not match rendered offers",
      };
    },
  };
  // Observe only the actual release-relative module worker. Keep the executor's
  // onmessage handler untouched and never manufacture fallback results.
  const NativeWorker = window.Worker;
  if (typeof NativeWorker !== "function") throw new Error("Offer proof requires native Worker transport");
  window.Worker = class extends NativeWorker {
    constructor(url, ...args) {
      super(url, ...args);
      const graph = window.__repforgeTrainingTest?.graphBase;
      const expected = graph && new URL("src/platform/program-worker.js", graph).href;
      this.catalogEngineId = new URL(String(url), document.baseURI).href === expected ? ++observer.engines : null;
      if (!this.catalogEngineId) return;
      this.addEventListener("message", event => {
        const message = event.data;
        const job = observer.jobs.find(item => item.engineId === this.catalogEngineId && item.transportId === message?.id);
        if (!job || job.status !== "pending") return;
        job.status = message.ok === true ? "settled" : "rejected";
        job.result = message.ok === true ? message.value : null;
        job.outcome = job.result?.ok === true ? "success" : "failure";
        job.resultDigest = digest(job.result);
        job.settledOrder = ++observer.order;
      });
      for (const type of ["error", "messageerror"]) this.addEventListener(type, () => {
        for (const job of observer.jobs.filter(item => item.engineId === this.catalogEngineId && item.status === "pending")) {
          job.status = "rejected";
          job.outcome = type;
          job.settledOrder = ++observer.order;
        }
      });
    }
    postMessage(message, ...args) {
      if (this.catalogEngineId && message?.type === "generate") {
        const state = window.__repforgeEntryState?.();
        const request = structuredClone(message.request);
        observer.jobs.push({
          engineId: this.catalogEngineId, transportId: message.id,
          jobId: `${this.catalogEngineId}:${message.id}`,
          foreground: this.catalogEngineId === 1,
          draftDigest: digest(state?.draftId || ""), step: state?.step || null,
          requestDigest: window.__repforgeTrainingTest.identity.digestCanonical(request),
          confirmationCount: Object.keys(request?.movementConfirmations || {}).length,
          request, status: "pending", mode: "worker", startedOrder: ++observer.order,
        });
      }
      return super.postMessage(message, ...args);
    }
  };
  window.__catalogEntryOfferObserver = observer;
}

async function installOfferVerificationObserver(page) {
  await installBrowserTraining(page);
  await installBrowserTrainingBeforeNavigation(page);
  await page.addInitScript(installOfferVerificationObserverInBrowser);
  await page.evaluate(installOfferVerificationObserverInBrowser);
}

async function waitForOfferVerification(page) {
  try {
    await page.waitForFunction(() => window.__catalogEntryOfferObserver?.snapshot?.().ready === true, undefined, { timeout: 40000 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      snapshot: window.__catalogEntryOfferObserver?.snapshot?.() || null,
      jobs: window.__catalogEntryOfferObserver?.diagnostic?.() || null,
    }));
    throw new Error(`offer verification did not settle: ${JSON.stringify(diagnostic)} (${error.message.split("\n")[0]})`);
  }
  const proof = await page.evaluate(() => window.__catalogEntryOfferObserver.snapshot());
  console.log(`catalog offer settlement ${JSON.stringify(proof)}`);
  return proof;
}

async function holdProgramWorker(page) {
  await page.evaluate(() => {
    const NativeWorker = window.Worker;
    window.__catalogHeldGenerations = [];
    window.Worker = class extends NativeWorker {
      postMessage(message, ...args) {
        if (message?.type === "generate") {
          window.__catalogHeldGenerations.push(() => super.postMessage(message, ...args));
          return;
        }
        return super.postMessage(message, ...args);
      }
    };
  });
}

async function buildingStep(page, { pending = false } = {}) {
  await recommendStep(page, "abilities");
  await holdProgramWorker(page);
  if (pending) await page.emulateMedia({ reducedMotion: "reduce" });
  if (!pending) {
    await page.evaluate(() => {
      const native = window.setTimeout;
      let heldId = -1;
      window.__catalogNativeTimeout = native;
      // S3 advances one line every 260ms. Hold the third line's completion
      // and the checklist finish so this mid-step stays stable during settle().
      window.setTimeout = function (callback, delay, ...args) {
        if (delay === 780 || delay === 1040) return heldId--;
        return native.call(this, callback, delay, ...args);
      };
    });
  }
  await page.click("#onbNext");
  await page.waitForSelector("#entryBuilding", { timeout: 20000 });
  await page.waitForFunction(() => window.__catalogHeldGenerations?.length > 0, undefined, { timeout: 20000 });
  if (pending) {
    await page.waitForFunction(() => {
      const root = document.querySelector("#entryBuilding");
      const wait = document.querySelector("#entryBuildingWait");
      return root?.classList.contains("is-done") && wait?.classList.contains("is-pending") && !wait.hidden;
    }, undefined, { timeout: 20000 });
  } else {
    await page.waitForSelector("#entryBuilding .entry-building__steps li:nth-child(3).is-now", { timeout: 20000 });
    await page.evaluate(() => {
      window.setTimeout = window.__catalogNativeTimeout;
      delete window.__catalogNativeTimeout;
    });
  }
}

async function equipmentConflict(page) {
  await recommendStep(page, "abilities", { environment: "limited_home", equipment: ["pullup_bar", "bands"] });
  await page.click("#onbNext");
  await page.waitForSelector("#onbBody .entry__notice[role=alert] [data-entry-action='conflict-back']", { timeout: 20000 });
}

async function recommendTo(page, { result = false, existing = false, desired = "muscle_growth" } = {}) {
  if (result) await installOfferVerificationObserver(page);
  await route(page, "recommend", { existing });
  await answerRecommend(page, { skipBasics: true, days: 3, goal: desired, until: result ? null : "abilities" });
  if (result) {
    await page.waitForSelector("[data-entry-select-candidate], #entryActivate", { timeout: 25000 });
    await waitForOfferVerification(page);
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

/* Plan 070: the review editor. Each adjustment waits for the review to settle
   (it is aria-busy while an edit is being saved). */
async function reviewSettled(page) {
  await page.waitForFunction(() => !document.querySelector("#entryReview[aria-busy]"), undefined, { timeout: 20000 });
  // The change is also announced through the app's toast; a frame waits for it to go.
  await page.waitForFunction(() => document.querySelector("#toast")?.classList.contains("hidden") !== false, undefined, { timeout: 10000 });
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
async function findAmbiguousPerSideMovement(page) {
  await installBrowserTraining(page);
  return page.evaluate(() => {
    const catalog = window.__repforgeTrainingTest.catalog;
    const metrics = window.__repforgeTrainingTest.metrics;
    const current = window.__repforgeEntryState().result.preview.programDefinition;
    const used = new Set(current.days.flatMap((day) => day.slots || []).map((slot) => slot.exerciseId));
    const supportedPerSide = [["repsPerSide", "loadPerSideKg"], ["persistentLoadPerSideKg", "repsPerSide"]];
    return catalog.exercises.find((exercise) => {
      if (used.has(exercise.id) || !Number.isFinite(exercise.bodyweight)) return false;
      const definitions = metrics.definitionsForIds(exercise.exerciseMetrics || []);
      if (!definitions.ok || !supportedPerSide.some((semantics) =>
        JSON.stringify(definitions.value.map((metric) => metric.semantic)) === JSON.stringify(semantics))) return false;
      const sides = (exercise.laterality || []).map((id) => catalog.uuidIndex[id]?.name);
      return sides.includes("Unilateral") === sides.includes("Bilateral");
    }) || null;
  });
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
  await waitForOfferVerification(page);
}

/** A generated review with the answer chip for `chip` open on its editor. */
async function reviewWithEditor(page, chip) {
  await recommendTo(page, { result: true, desired: "balanced" });
  await selectCandidate(page);
  await page.click(`[data-entry-chip="${chip}"]`);
  await page.waitForSelector("#entryEditor", { timeout: 20000 });
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
  // B's hub opens Import on its file door; the paste door is one switch away.
  await route(page, "import");
  await page.waitForSelector("#entryFreeformSwitch", { timeout: 20000 });
  await page.click("#entryFreeformSwitch");
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
    try { return JSON.parse(localStorage.getItem(draftKey) || "{}").state?.step === "abilities"; }
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
  await installBrowserTraining(page);
  await page.evaluate(({ key, draft }) => {
    const activeRevision = JSON.parse(localStorage.getItem(key))._storageRevision;
    const Entry = window.__repforgeTrainingTest.entry;
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
  // Reload restores the candidate before its generated comparison is ready.
  // Wait for the production review to mount over the conflict state.
  await page.waitForFunction(() => {
    const current = window.__repforgeEntryState?.();
    const selected = document.querySelector('#entryReview [data-review-tab][aria-selected="true"]');
    const day = current?.result?.preview?.programDefinition?.days?.[Number(selected?.dataset.reviewTab)];
    const rows = [...document.querySelectorAll('#entryReview [data-review-slot]')];
    return current?.step === "activation_conflict" && Boolean(selected) && day?.slots?.length > 0
      && rows.length === day.slots.length && rows.every((row, index) => row.dataset.reviewSlot === day.slots[index].id)
      && Boolean(document.querySelector('.entry__notice[role="alert"]'));
  }, undefined, { timeout: 40000 });
  await reviewSettled(page);
}

/** Bring the frame's subject into view for surfaces taller than the viewport. */
const FOCUS_SELECTOR = {
  // The landing is one scrolling page inside #firstRun; each scrolled state brings its band to the middle of the frame.
  "onboarding-start/first-run-ways": ".firstrun-way--surface",
  "onboarding-start/first-run-track": '[data-landing-outcome="hold"]',
  "onboarding-start/first-run-data": ".firstrun-rows",
  "onboarding-start/first-run-faq-open": ".firstrun-qa[open]",
  "onboarding-start/first-run-close": ".firstrun-close__actions",
  "onboarding-recommend/chip-editor-open": ".entry-chips",
  "onboarding-recommend/result-avoided": ".entry__constraints",
  "onboarding-recommend/activation-conflict": '#onbBody .entry__notice[role="alert"]',
  "onboarding-build/editor-ready": "#entryEditorActivate",
  "onboarding-recommend/result-changed": ".review__row.is-changed",
  "onboarding-recommend/review-reorder": "[data-review-reorder]",
  "onboarding-recommend/review-empty-day": ".review__empty",
  "onboarding-recommend/review-sheet-execution-mode": "#reviewSheet [data-review-execution-question]",
  "onboarding-recommend/muscle-priorities-limit": '[data-entry-pick="musclePriorityB"][aria-checked="true"][data-entry-val$="|prioritize"]',
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
      try { return JSON.parse(localStorage.getItem(draftKey) || "{}").state?.step === "abilities"; }
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
  "onboarding-start/hub-existing": (page) => openHub(page, { existing: true }),
  "onboarding-start/hub-chosen": async (page) => {
    await openHub(page);
    await page.click('[data-entry-hub="recommend"]');
  },

  // Onboarding B (Plan 072): one question per screen.
  "onboarding-recommend/intro": (page) => recommendStep(page, "intro"),
  "onboarding-recommend/sex": (page) => recommendStep(page, "sex"),
  "onboarding-recommend/birth-date": (page) => recommendStep(page, "birth_date"),
  "onboarding-recommend/birth-date-typed": async (page) => {
    await recommendStep(page, "birth_date");
    await page.locator("#entryWheelYear .entry-wheel__item.is-current").click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
  },
  "onboarding-recommend/birth-date-typed-invalid": async (page) => {
    await recommendStep(page, "birth_date");
    await page.locator("#entryWheelYear .entry-wheel__item.is-current").click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible", timeout: 5000 });
    await dialog.getByRole("textbox", { name: /year|ano/i }).fill("1800");
    await dialog.getByRole("button", { name: /done|concluir/i }).click();
    await dialog.locator("#entryPickerInput[aria-invalid='true']").waitFor({ state: "visible", timeout: 5000 });
  },
  "onboarding-recommend/height": (page) => recommendStep(page, "height"),
  "onboarding-recommend/height-ftin": async (page) => {
    await recommendStep(page, "height");
    await pick(page, "basicsHeightUnit", "ftin");
  },
  "onboarding-recommend/weight": (page) => recommendStep(page, "weight"),
  "onboarding-recommend/weight-lb": async (page) => {
    await recommendStep(page, "weight");
    await pick(page, "basicsWeightUnit", "lb");
  },
  "onboarding-recommend/background": (page) => recommendStep(page, "background"),
  "onboarding-recommend/cardio-experience": (page) => recommendStep(page, "cardio_experience"),
  "onboarding-recommend/environment": async (page) => {
    await recommendStep(page, "environment");
    await pick(page, "environment", "limited_home");
  },
  "onboarding-recommend/equipment": (page) => recommendStep(page, "equipment", { environment: "limited_home" }),
  "onboarding-recommend/equipment-adjusted": async (page) => {
    await recommendStep(page, "equipment", { environment: "limited_home" });
    await pick(page, "equipmentGroup", "bench");
    await pick(page, "equipmentGroup", "bands");
  },
  "onboarding-recommend/desired-result": (page) => recommendStep(page, "desired_result"),
  "onboarding-recommend/days-per-week": async (page) => {
    await recommendStep(page, "days_per_week");
    await pick(page, "daysPerWeek", "4");
  },
  "onboarding-recommend/session-length": (page) => recommendStep(page, "session_length"),
  "onboarding-recommend/muscle-priorities": async (page) => {
    await recommendStep(page, "muscle_priorities");
    await pick(page, "musclePriorityB", "glutes|prioritize");
    await pick(page, "musclePriorityB", "calves|reduce");
  },
  "onboarding-recommend/muscle-priorities-limit": async (page) => {
    await recommendStep(page, "muscle_priorities");
    await installBrowserTraining(page);
    const muscles = await page.evaluate(() => [...window.__repforgeTrainingTest.entry.ENTRY_MUSCLES]);
    assert.equal(muscles.length, 22);
    for (const muscle of muscles) await pick(page, "musclePriorityB", `${muscle}|prioritize`);
    const selected = await page.evaluate(() => ({
      muscles: window.__repforgeEntryState().answers.primaryMuscles,
      radios: document.querySelectorAll('[data-entry-pick="musclePriorityB"][aria-checked="true"][data-entry-val$="|prioritize"]').length,
    }));
    assert.deepEqual([...selected.muscles].sort(), [...muscles].sort());
    assert.equal(selected.radios, 22);
  },
  "onboarding-recommend/deload": (page) => recommendStep(page, "deload"),
  "onboarding-recommend/abilities": (page) => recommendStep(page, "abilities"),
  "onboarding-recommend/building": (page) => buildingStep(page),
  "onboarding-recommend/building-pending": (page) => buildingStep(page, { pending: true }),
  "onboarding-recommend/result-equipment-conflict": equipmentConflict,
  "onboarding-recommend/result": (page) => recommendTo(page, { result: true, desired: "balanced" }),
  "onboarding-recommend/result-confirm-offer": async (page) => {
    await recommendToReviewWithFixedDraftId(page, "00000000-0000-4000-8000-000000000720");
    const action = page.locator("#entryReview [data-review-confirm-offer-action]").first();
    await action.waitFor({ state: "visible", timeout: 30000 });
    const target = await action.evaluate((button) => {
      const row = button.closest("[data-review-confirm-offer]");
      return { slotId: button.dataset.reviewConfirmOfferAction, exerciseId: row?.dataset.reviewOfferExerciseId };
    });
    const belongsToResult = await page.evaluate(({ slotId, exerciseId }) => {
      const entry = window.__repforgeEntryState();
      const slot = entry?.result?.preview?.programDefinition?.days.flatMap((day) => day.slots || [])
        .find((item) => item.id === slotId);
      // This row is rendered only from app.js's post-result verifier report.
      // Keep the proof on the actual consumer: no injected service and a live
      // current slot are required for the Worker-backed production journey.
      return entry?.step === "result" && entry.route === "recommend" && !window.__repforgeProgramEntryServicesOverride
        && typeof Worker === "function" && Boolean(slot) && Boolean(exerciseId);
    }, target);
    if (!target.slotId || !target.exerciseId || !belongsToResult) throw new Error("result-confirm-offer: visible verified offer is not attached to the live production result");
  },
  "onboarding-recommend/result-confirmed": async (page) => {
    await recommendToReviewWithFixedDraftId(page, "00000000-0000-4000-8000-000000000721");
    const action = page.locator("#entryReview [data-review-confirm-offer-action]").first();
    await action.waitFor({ state: "visible", timeout: 30000 });
    const target = await action.evaluate((button) => {
      const row = button.closest("[data-review-confirm-offer]");
      return { slotId: button.dataset.reviewConfirmOfferAction, exerciseId: row?.dataset.reviewOfferExerciseId };
    });
    await action.click();
    await page.waitForSelector(`#entryReview [data-review-confirmed="${target.exerciseId}"]`, { timeout: 30000 });
    await waitForOfferVerification(page);
    const current = await page.evaluate((exerciseId) => ({
      confirmation: window.__repforgeEntryState()?.answers?.movementConfirmations?.[exerciseId] || null,
      offer: document.querySelector(`[data-review-confirm-offer][data-review-offer-exercise-id="${CSS.escape(exerciseId)}"]`) !== null,
      undo: document.querySelector(`[data-review-confirmation-undo="${CSS.escape(exerciseId)}"]`)?.textContent.trim() || null,
    }), target.exerciseId);
    const expectedUndo = await (await browserLanguage(page)).evaluate(async (language)=>language.t("entry.review.undo"));
    if (!Array.isArray(current.confirmation) || !current.confirmation.length || current.offer || current.undo !== expectedUndo) {
      throw new Error(`result-confirmed: production confirmation state is incomplete: ${JSON.stringify(current)}`);
    }
  },
  "onboarding-recommend/result-block-sheet": async page => {
    await recommendTo(page, { result: true, desired: "balanced" });
    await page.click("#entryReview [data-review-block-edit]");
    await page.waitForSelector("#reviewSheet.is-open [data-review-block-weeks]", { timeout: 10000 });
    assert.equal(await page.locator('#reviewSheet [data-review-block-step]').count(), 0);
    assert.equal(await page.locator('#reviewSheet [data-review-block-deload]').getAttribute("aria-checked"), "true");
    await page.click('#reviewSheet [data-review-block-pattern="undulating"]');
    await page.click('#reviewSheet [data-review-block-deload]');
    const visible = await page.evaluate(() => ({
      weeks: document.querySelector("[data-review-block-weeks]")?.textContent.trim(),
      pattern: document.querySelector("[data-review-block-pattern][aria-checked='true']")?.dataset.reviewBlockPattern,
      deload: document.querySelector("[data-review-block-deload]")?.getAttribute("aria-checked"),
    }));
    const expected = await (await browserLanguage(page)).evaluate(async (language)=>language.t("entry.review.block.regular_weeks", { n: 7 }));
    if (visible.weeks !== expected || visible.pattern !== "undulating" || visible.deload !== "false")
      throw new Error(`The result block sheet did not keep seven regular weeks with the edited pattern and recovery choice: ${JSON.stringify(visible)}`);
  },
  "onboarding-recommend/result-existing": (page) => recommendTo(page, { result: true, existing: true }),
  "onboarding-recommend/chip-editor-open": (page) => reviewWithEditor(page, "days"),
  "onboarding-recommend/result-corrected": async (page) => {
    await reviewWithEditor(page, "days");
    await pick(page, "daysPerWeek", "4");
    await page.click("#entryChipApply");
    await page.waitForSelector("#entryChange", { timeout: 25000 });
    await waitForOfferVerification(page);
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
    await waitForOfferVerification(page);
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
  "onboarding-recommend/review-sheet-execution-mode": async (page) => {
    await recommendToReviewWithFixedDraftId(page, "00000000-0000-4000-8000-000000000722", { goal: "balanced", days: 3 });
    const slotId = (await reviewSlots(page))[0];
    const exercise = await findAmbiguousPerSideMovement(page);
    if (!exercise) throw new Error("review-execution-mode: production catalog has no unused supported ambiguous per-side movement");
    await openReviewSlot(page, slotId);
    await page.locator("#reviewSheet [data-review-search]").click();
    await page.waitForSelector("#exPickSheet.is-open", { timeout: 10000 });
    await page.fill("#exPickSearch", exercise.name);
    await page.waitForSelector(`[data-pick="${exercise.id}"]`, { timeout: 10000 });
    await page.locator(`[data-pick="${exercise.id}"]`).click();
    await page.waitForFunction(({ slotId, exerciseId }) => {
      const slot = window.__repforgeEntryState()?.result?.preview?.programDefinition?.days
        .flatMap((day) => day.slots).find((item) => item.id === slotId);
      return slot?.exerciseId === exerciseId && !document.querySelector("#exPickSheet.is-open");
    }, { slotId, exerciseId: exercise.id }, { timeout: 15000 });
    await openReviewSlot(page, slotId);
    await page.waitForSelector("#reviewSheet [data-review-execution-question]", { timeout: 10000 });
    const visible = await page.evaluate((slotId) => ({
      question: document.querySelector("#reviewSheet [data-review-execution-question]")?.textContent.trim(),
      groupName: document.querySelector("#reviewSheet [role='group']")?.getAttribute("aria-labelledby"),
      choices: [...document.querySelectorAll("#reviewSheet [data-review-execution-mode]")].map((button) => button.textContent.trim()),
      cue: document.querySelector(`#entryReview [data-review-slot="${CSS.escape(slotId)}"] [data-review-execution-cue]`)?.textContent.trim(),
    }), slotId);
    const expectedQuestion = await (await browserLanguage(page)).evaluate(async (language)=>language.t("entry.review.execution_mode.question"));
    const expectedChoices = await (await browserLanguage(page)).evaluate(async (language)=>[
      language.t("entry.review.execution_mode.bilateral"),
      language.t("entry.review.execution_mode.unilateral"),
    ]);
    const expectedCue = await (await browserLanguage(page)).evaluate(async (language)=>language.t("entry.review.execution_mode.cue"));
    if (visible.question !== expectedQuestion || visible.groupName !== "reviewExecutionModeQuestion"
      || JSON.stringify(visible.choices) !== JSON.stringify(expectedChoices) || visible.cue !== expectedCue) {
      throw new Error(`review-execution-mode: production question/choices/cue were not exposed: ${JSON.stringify(visible)}`);
    }
  },
  "onboarding-recommend/review-day-name-refused": async (page) => {
    await recommendToReviewWithFixedDraftId(page, "00000000-0000-4000-8000-000000000360", { goal: "balanced", days: 3 });
    const days = await page.evaluate(() => window.__repforgeEntryState().result.preview.programDefinition.days
      .map((day, index) => ({ index, kind: day.kind, stored: day.name,
        shown: document.querySelector(`#entryReview [data-review-tab="${index}"]`)?.textContent.trim() || null }))
      .filter((day) => day.kind === "training"));
    if (days.length < 2) throw new Error("review-day-name-refused: the production result has fewer than two training days");
    const target = days[0], duplicate = days[1].stored || days[1].shown;
    const expected = await (await browserLanguage(page)).evaluate(async (language)=>language.t("toast.day_name_exists"));
    await page.locator(`#entryReview [data-review-tab="${target.index}"]`).click();
    await page.locator("#entryReview [data-review-day-menu]").click();
    await page.locator('#reviewSheet [data-review-day-action="rename"]').click();
    await page.locator("#reviewSheet #reviewRenameInput").fill(duplicate);
    await page.locator("#reviewSheet [data-review-rename-save]").click();
    await page.locator('#reviewSheet #reviewRenameInput[aria-invalid="true"]').waitFor({ state: "visible", timeout: 10000 });
    const refusal = await page.evaluate(() => {
      const input = document.querySelector("#reviewSheet #reviewRenameInput");
      const error = input?.getAttribute("aria-describedby") && document.getElementById(input.getAttribute("aria-describedby"));
      return { value: input?.value, describedBy: input?.getAttribute("aria-describedby"), role: error?.getAttribute("role"), message: error?.textContent.trim() };
    });
    if (refusal.value !== duplicate || refusal.describedBy !== "reviewRenameError" || refusal.role !== "alert" || refusal.message !== expected) {
      throw new Error(`review-day-name-refused: production field refusal was incomplete: ${JSON.stringify(refusal)}`);
    }
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
    // Cancel is offered from every screen; the days screen shows the dialog
    // over a screen with answers in progress.
    await recommendStep(page, "days_per_week");
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
  if (key === "onboarding-recommend/activation-conflict") {
    await page.evaluate(() => {
      const host = document.querySelector("#onboarding");
      const notice = document.querySelector('#onbBody .entry__notice[role="alert"]');
      if (host && notice) host.scrollTop += notice.getBoundingClientRect().top - host.getBoundingClientRect().top - 16;
    });
    await page.waitForFunction(() => {
      const notice = document.querySelector('#onbBody .entry__notice[role="alert"]');
      const bounds = notice?.getBoundingClientRect();
      return bounds?.width > 0 && bounds.top >= 0 && bounds.bottom <= window.innerHeight
        && Boolean(document.querySelector('#entryReview [data-review-slot]'));
    }, undefined, { timeout: 5000 });
    console.log("catalog activation conflict viewport " + JSON.stringify(await page.evaluate(() => {
      const bounds = document.querySelector('#onbBody .entry__notice[role="alert"]').getBoundingClientRect();
      return { top: bounds.top, bottom: bounds.bottom, viewport: window.innerHeight,
        reviewRows: document.querySelectorAll('#entryReview [data-review-slot]').length };
    })));
  }
  if (key === "onboarding-recommend/result-block-sheet") {
    await page.waitForFunction(() => {
      const sheet = document.querySelector("#reviewSheet.is-open");
      const body = document.querySelector("#reviewSheetBody");
      return !!sheet && !!body && body.clientHeight > 0 && body.scrollHeight > 0;
    }, undefined, { timeout: 10000 });
    await page.evaluate(() => {
      const body = document.querySelector("#reviewSheetBody");
      body?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      if (body) body.scrollTop = 0;
    });
    await page.waitForFunction(() => {
      const body = document.querySelector("#reviewSheetBody");
      return !!body && body.scrollTop === 0;
    }, undefined, { timeout: 10000 });
  }
}
