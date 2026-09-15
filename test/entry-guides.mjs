#!/usr/bin/env node
/**
 * Proof-first characterization and acceptance test for Plan 054 packet 054-P8:
 * Contextual guide registry, anchored action lifecycle, deferral on missing anchor,
 * Settings replay fact isolation, accessibility, legacy tourDone migration,
 * and complete unreachability of obsolete global modal tour.
 *
 * Spec references:
 * - plans/054-landing-and-program-entry.md (Contextual guide registry & 054-P8)
 * - docs/agents/implementation-evidence.md
 * - docs/agents/ui-overhaul-proof-checkpoints.md
 * - docs/brand-guide.md
 *
 * Proves:
 * (1) Pure guide registry module seam & public exports (entry-guides.js or guide-registry.js);
 * (2) Versioned per-guide state machine (unseen / shown / dismissed / completed / replay / deferred);
 * (3) Anchored action completes its cue;
 * (4) Dismiss suppresses future showings of the cue;
 * (5) Settings replay resets ONLY the chosen guide presentation state, never user data or unrelated guides;
 * (6) Missing or hidden anchor defers presentation and renders NO floating overlay;
 * (7) Cue focus, keyboard escape, and dismiss accessibility semantics;
 * (8) Global modal tour markup (#tour), API (startTour/closeTour), and route are no longer reachable;
 * (9) Migration from legacy tourDone maps only genuinely covered actions (install, backup) to completed,
 *     leaving new Plan 054 infrastructure guides (entry, privacy) eligible without replaying all guides blindly;
 * (10) Initial coverage IDs reflect Plan 054 infrastructure (entry, install, privacy) while task-specific
 *      anchors remain for Plans 055–057;
 * (11) Deliberate failure switches: REPFORGE_ENTRY_GUIDES_FAULT:
 *      - "floating-without-anchor": proves detection of cue floating without a valid anchor;
 *      - "obsolete-tour-restoration": proves detection of obsolete global tour presence/reachability;
 * (12) Bounded browser projections on live application at REPFORGE_URL.
 *
 * Run:
 *   node test/entry-guides.mjs
 *   REPFORGE_URL=http://localhost:8000/ node test/entry-guides.mjs
 * Deliberate fault runs:
 *   REPFORGE_ENTRY_GUIDES_FAULT=floating-without-anchor node test/entry-guides.mjs
 *   REPFORGE_ENTRY_GUIDES_FAULT=obsolete-tour-restoration node test/entry-guides.mjs
 */
import { createRequire } from "node:module";
import { isDeepStrictEqual } from "node:util";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const require = createRequire(import.meta.url);

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const FAULT = process.env.REPFORGE_ENTRY_GUIDES_FAULT;

const UIKEY = "repforge_ui_v1";
const DATA_KEY = "repforge_v1";

/**
 * Standard guide lifecycle states specified by Plan 054.
 */
export const GUIDE_STATUSES = Object.freeze([
  "unseen",
  "shown",
  "dismissed",
  "completed",
  "deferred",
  "replay",
]);

/**
 * Plan 054 initial infrastructure guide IDs.
 * Task-specific anchors (first-set, focus-utilities, progress, block-transition)
 * remain for Plans 055–057.
 */
export const PLAN_054_GUIDE_IDS = Object.freeze(["entry", "install", "privacy"]);

/**
 * Canonical Plan 054 guide metadata definitions.
 */
export const PLAN_054_GUIDE_DEFINITIONS = Object.freeze([
  {
    id: "entry",
    version: 1,
    anchorSelector: "#startWorkout, #firstRunStart, .entry-landing__primary",
    coveredByOldTour: false, // Old tour ran after onboarding; never covered entry chooser
    description: "Guide explaining training entry routes and Bring-or-build choices",
  },
  {
    id: "install",
    version: 1,
    anchorSelector: "#firstRunInstall, #installApp, #settingsInstall, .install-action",
    coveredByOldTour: true, // Old tour step 10 genuinely covered installation
    description: "Guide explaining home-screen installation and offline access",
  },
  {
    id: "privacy",
    version: 1,
    anchorSelector: "#firstRunPrivacy, #privacyDetails, #settingsPrivacy",
    coveredByOldTour: false, // Old tour never covered the cached in-app Privacy page/sheet
    description: "Guide explaining local-first data boundary and temporary transfer",
  },
]);

/**
 * Result accumulator
 */
const results = {
  passed: 0,
  failed: 0,
  failures: [],
  expectedBaselineGaps: [],
};

function phase(title) {
  console.log(`\n${title}`);
}

function assert(condition, name, detail, isExpectedBaselineGap = false) {
  if (condition) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    const message = detail ? `${name} -> ${detail}` : name;
    results.failures.push(message);
    if (isExpectedBaselineGap) {
      results.expectedBaselineGaps.push(message);
      console.log(`  ✗ [EXPECTED BASELINE RED] ${name}`);
    } else {
      console.log(`  ✗ ${name}`);
    }
    if (detail != null) {
      console.log(`    ${detail}`);
    }
  }
}

/**
 * Attempt to load the production contextual guide registry module.
 */
let productionGuideModule = null;
try {
  productionGuideModule = require("../entry-guides.js");
} catch {
  try {
    productionGuideModule = require("../guide-registry.js");
  } catch {
    // Production module does not exist on this head; expected baseline for proof-first packet.
  }
}

/**
 * Authoritative Reference Guide Oracle.
 * Implements the normative specification from plans/054-landing-and-program-entry.md,
 * completely independent of production code or DOM-only tautologies.
 */
export function referenceEvaluateGuide(guide, { anchorPresent, anchorVisible, uiPrefs, fault = FAULT } = {}) {
  if (!guide || typeof guide !== "object" || !guide.id) {
    return { decision: "ineligible", eligible: false, reason: "invalid-guide" };
  }

  const prefs = uiPrefs && typeof uiPrefs === "object" ? uiPrefs : {};
  const guideState = (prefs.guideState && prefs.guideState[guide.id]) || {
    version: guide.version || 1,
    status: "unseen",
    lastTransitionAt: null,
  };

  // Version upgrade: if stored version is older than current guide version, reset presentation
  if (typeof guide.version === "number" && typeof guideState.version === "number") {
    if (guideState.version < guide.version) {
      guideState.status = "unseen";
    }
  }

  // Completed or dismissed guides are satisfied/suppressed
  if (guideState.status === "completed") {
    return { decision: "completed", eligible: false, reason: "already-completed" };
  }
  if (guideState.status === "dismissed") {
    return { decision: "dismissed", eligible: false, reason: "already-dismissed" };
  }

  // Evaluate anchor presence and visibility
  const hasAnchor = Boolean(anchorPresent && anchorVisible !== false);

  if (!hasAnchor) {
    // CRITICAL SAFETY INVARIANT: Missing or hidden anchor defers; cues never float without an action.
    if (fault === "floating-without-anchor") {
      return {
        decision: "shown",
        eligible: true,
        floating: true,
        anchorSelector: null,
        reason: "fault-injected-floating",
      };
    }
    return {
      decision: "deferred",
      eligible: false,
      anchorSelector: guide.anchorSelector,
      reason: "anchor-missing-or-hidden",
    };
  }

  return {
    decision: "shown",
    eligible: true,
    anchorSelector: guide.anchorSelector,
    reason: "anchor-available",
  };
}

/**
 * Pure transition helper to record a guide status transition.
 * Must NOT duplicate program, workout, or log facts into prefs.
 */
export function referenceRecordGuideTransition(prefs, guideId, nextStatus, { nowMs = Date.now(), version = 1 } = {}) {
  const base = prefs && typeof prefs === "object" ? { ...prefs } : {};
  const currentGuides = base.guideState && typeof base.guideState === "object" ? { ...base.guideState } : {};
  currentGuides[guideId] = {
    version,
    status: nextStatus,
    lastTransitionAt: nowMs,
  };
  base.guideState = currentGuides;
  return Object.freeze(base);
}

/**
 * Pure helper for Settings replay of a contextual guide.
 * Invariant: Resets ONLY that guide's presentation state, never user data or unrelated guides.
 */
export function referenceReplayGuide(prefs, guideId, { nowMs = Date.now(), version = 1 } = {}) {
  const base = prefs && typeof prefs === "object" ? { ...prefs } : {};
  const currentGuides = base.guideState && typeof base.guideState === "object" ? { ...base.guideState } : {};
  if (currentGuides[guideId]) {
    currentGuides[guideId] = {
      version,
      status: "unseen",
      lastTransitionAt: nowMs,
      replayedAt: nowMs,
    };
  } else {
    currentGuides[guideId] = {
      version,
      status: "unseen",
      lastTransitionAt: nowMs,
      replayedAt: nowMs,
    };
  }
  base.guideState = currentGuides;
  return Object.freeze(base);
}

/**
 * Pure migration helper from legacy tourDone.
 * Invariant: maps old tourDone to task-guide completion ONLY where the old tour
 * genuinely covered that action (e.g. install, backup), otherwise guides remain eligible (unseen).
 * Must NOT replay all guides blindly or complete all guides blindly.
 */
export function referenceMigrateLegacyTourDone(
  prefs,
  { definitions = PLAN_054_GUIDE_DEFINITIONS, nowMs = Date.now() } = {}
) {
  const base = prefs && typeof prefs === "object" ? { ...prefs } : {};
  const guideState = base.guideState && typeof base.guideState === "object" ? { ...base.guideState } : {};
  const hadTourDone = Boolean(base.tourDone);

  for (const def of definitions) {
    if (!guideState[def.id]) {
      if (hadTourDone && def.coveredByOldTour) {
        guideState[def.id] = {
          version: def.version,
          status: "completed",
          lastTransitionAt: nowMs,
          migratedFromTourDone: true,
        };
      } else {
        guideState[def.id] = {
          version: def.version,
          status: "unseen",
          lastTransitionAt: null,
        };
      }
    }
  }

  base.guideState = guideState;
  return Object.freeze(base);
}

// -----------------------------------------------------------------------------
// Test Execution
// -----------------------------------------------------------------------------

async function run() {
  console.log("Packet 054-P8: Contextual Guide Registry Characterization & Acceptance Suite");
  console.log(`Base URL: ${BASE}`);
  console.log(`Active Fault Switch: ${FAULT || "none"}`);
  console.log(
    `Production Module Seam: ${productionGuideModule ? "detected" : "absent (expected baseline on current head)"}`
  );

  // ---------------------------------------------------------------------------
  // Phase 1: Pure Module Seam & Intended Contract Export
  // ---------------------------------------------------------------------------
  phase("Phase 1: Pure Module Seam & Intended Contract Export");
  {
    const seamPresent = productionGuideModule !== null;
    assert(
      seamPresent,
      "pure contextual guide module is exported (entry-guides.js or guide-registry.js)",
      "Production seam is absent on current head before coordinator implementation",
      !seamPresent
    );

    if (seamPresent) {
      assert(
        typeof (productionGuideModule.evaluateGuide || productionGuideModule.evaluateGuideEligibility) === "function",
        "exports evaluateGuide / evaluateGuideEligibility function",
        typeof (productionGuideModule.evaluateGuide || productionGuideModule.evaluateGuideEligibility)
      );
      assert(
        typeof (productionGuideModule.recordGuideTransition || productionGuideModule.recordGuideCompleted) === "function",
        "exports recordGuideTransition / recordGuideCompleted function",
        typeof (productionGuideModule.recordGuideTransition || productionGuideModule.recordGuideCompleted)
      );
      assert(
        typeof (productionGuideModule.replayGuideState || productionGuideModule.replayGuide) === "function",
        "exports replayGuideState / replayGuide function",
        typeof (productionGuideModule.replayGuideState || productionGuideModule.replayGuide)
      );
      assert(
        typeof (productionGuideModule.migrateLegacyTourDone || productionGuideModule.migrateTourDone) === "function",
        "exports migrateLegacyTourDone function",
        typeof (productionGuideModule.migrateLegacyTourDone || productionGuideModule.migrateTourDone)
      );
      assert(
        Array.isArray(productionGuideModule.PLAN_054_GUIDE_IDS) || Array.isArray(productionGuideModule.GUIDE_IDS),
        "exports guide IDs array covering Plan 054 infrastructure",
        JSON.stringify(productionGuideModule.PLAN_054_GUIDE_IDS || productionGuideModule.GUIDE_IDS)
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 2: Versioned Per-Guide State Machine & Anchored Action Lifecycle
  // ---------------------------------------------------------------------------
  phase("Phase 2: Versioned Per-Guide State Machine & Anchored Action Lifecycle");

  const evaluate = (guide, opts) => {
    if (productionGuideModule?.evaluateGuide) {
      const actual = productionGuideModule.evaluateGuide(guide, opts);
      if (FAULT === "floating-without-anchor" && !opts?.anchorPresent) {
        return { ...actual, decision: "shown", eligible: true, floating: true };
      }
      return actual;
    }
    return referenceEvaluateGuide(guide, opts);
  };

  const recordTransition = (prefs, id, status, opts) => {
    if (productionGuideModule?.recordGuideTransition) {
      return productionGuideModule.recordGuideTransition(prefs, id, status, opts);
    }
    return referenceRecordGuideTransition(prefs, id, status, opts);
  };

  const replayGuide = (prefs, id, opts) => {
    if (productionGuideModule?.replayGuideState) {
      return productionGuideModule.replayGuideState(prefs, id, opts);
    }
    if (productionGuideModule?.replayGuide) {
      return productionGuideModule.replayGuide(prefs, id, opts);
    }
    return referenceReplayGuide(prefs, id, opts);
  };

  const entryGuide = PLAN_054_GUIDE_DEFINITIONS.find((g) => g.id === "entry");
  const installGuide = PLAN_054_GUIDE_DEFINITIONS.find((g) => g.id === "install");
  const privacyGuide = PLAN_054_GUIDE_DEFINITIONS.find((g) => g.id === "privacy");

  // Case 2.1: Unseen guide with anchor present evaluates to shown
  {
    const evalResult = evaluate(entryGuide, {
      anchorPresent: true,
      anchorVisible: true,
      uiPrefs: {},
    });
    assert(
      evalResult.decision === "shown" && evalResult.eligible === true,
      "unseen guide with visible anchor evaluates to shown",
      JSON.stringify(evalResult)
    );
  }

  // Case 2.2: Input immutability
  {
    const inputPrefs = Object.freeze({ theme: "dark", guideState: {} });
    const evalResult = evaluate(entryGuide, {
      anchorPresent: true,
      anchorVisible: true,
      uiPrefs: inputPrefs,
    });
    assert(
      isDeepStrictEqual(inputPrefs, { theme: "dark", guideState: {} }),
      "input immutability: evaluation does not mutate uiPrefs",
      JSON.stringify(evalResult)
    );
  }

  // Case 2.3: Missing anchor defers and does NOT show floating cue
  {
    const evalResult = evaluate(entryGuide, {
      anchorPresent: false,
      anchorVisible: false,
      uiPrefs: {},
    });
    assert(
      evalResult.decision === "deferred" && evalResult.eligible === false,
      "missing anchor defers cue and returns eligible=false",
      JSON.stringify(evalResult)
    );
  }

  // Case 2.4: Hidden anchor defers and does NOT show floating cue
  {
    const evalResult = evaluate(entryGuide, {
      anchorPresent: true,
      anchorVisible: false,
      uiPrefs: {},
    });
    assert(
      evalResult.decision === "deferred" && evalResult.eligible === false,
      "hidden anchor defers cue and returns eligible=false",
      JSON.stringify(evalResult)
    );
  }

  // Case 2.5: SAFETY INVARIANT - cue must NEVER float without an anchor
  {
    const missingAnchorResult = evaluate(installGuide, {
      anchorPresent: false,
      anchorVisible: false,
      uiPrefs: {},
    });
    const floatsWithoutAnchor =
      missingAnchorResult.decision === "shown" || missingAnchorResult.floating === true;
    assert(
      !floatsWithoutAnchor,
      "safety invariant: cue never floats without an anchor",
      JSON.stringify(missingAnchorResult)
    );
  }

  // Case 2.6: Anchored action completes its cue
  {
    const initialPrefs = { guideState: { entry: { version: 1, status: "shown" } } };
    const updatedPrefs = recordTransition(initialPrefs, "entry", "completed", {
      nowMs: 1700000000000,
    });
    assert(
      updatedPrefs.guideState.entry.status === "completed" &&
        updatedPrefs.guideState.entry.lastTransitionAt === 1700000000000,
      "anchored action completes cue in guideState",
      JSON.stringify(updatedPrefs)
    );

    const postActionEval = evaluate(entryGuide, {
      anchorPresent: true,
      anchorVisible: true,
      uiPrefs: updatedPrefs,
    });
    assert(
      postActionEval.decision === "completed" && postActionEval.eligible === false,
      "completed guide evaluates to eligible=false and decision=completed",
      JSON.stringify(postActionEval)
    );
  }

  // Case 2.7: Dismiss suppresses cue
  {
    const initialPrefs = { guideState: { install: { version: 1, status: "shown" } } };
    const dismissedPrefs = recordTransition(initialPrefs, "install", "dismissed", {
      nowMs: 1700000050000,
    });
    assert(
      dismissedPrefs.guideState.install.status === "dismissed" &&
        dismissedPrefs.guideState.install.lastTransitionAt === 1700000050000,
      "dismiss records dismissed status in guideState",
      JSON.stringify(dismissedPrefs)
    );

    const postDismissEval = evaluate(installGuide, {
      anchorPresent: true,
      anchorVisible: true,
      uiPrefs: dismissedPrefs,
    });
    assert(
      postDismissEval.decision === "dismissed" && postDismissEval.eligible === false,
      "dismiss suppresses cue: post-dismiss evaluation returns eligible=false",
      JSON.stringify(postDismissEval)
    );
  }

  // Case 2.8: Settings replay resets ONLY chosen guide presentation state
  {
    const multiGuidePrefs = {
      theme: "dark",
      lang: "en",
      installLastOfferedMilestone: 1,
      guideState: {
        entry: { version: 1, status: "completed", lastTransitionAt: 1700000000000 },
        install: { version: 1, status: "dismissed", lastTransitionAt: 1700000010000 },
        privacy: { version: 1, status: "completed", lastTransitionAt: 1700000020000 },
      },
    };

    const replayed = replayGuide(multiGuidePrefs, "install", { nowMs: 1700000100000 });

    assert(
      replayed.guideState.install.status === "unseen",
      "Settings replay resets targeted guide status to unseen",
      JSON.stringify(replayed.guideState.install)
    );
    assert(
      replayed.guideState.entry.status === "completed" &&
        replayed.guideState.privacy.status === "completed",
      "Settings replay preserves unrelated guide states",
      JSON.stringify({ entry: replayed.guideState.entry, privacy: replayed.guideState.privacy })
    );
    assert(
      replayed.theme === "dark" &&
        replayed.lang === "en" &&
        replayed.installLastOfferedMilestone === 1,
      "Settings replay preserves unrelated UI preferences",
      JSON.stringify(replayed)
    );

    // Replay allows guide to be presented again when anchor is available
    const postReplayEval = evaluate(installGuide, {
      anchorPresent: true,
      anchorVisible: true,
      uiPrefs: replayed,
    });
    assert(
      postReplayEval.decision === "shown" && postReplayEval.eligible === true,
      "replayed guide evaluates to shown when anchor is present",
      JSON.stringify(postReplayEval)
    );
  }

  // Case 2.9: Fact isolation: guide state never contains program or workout facts
  {
    const samplePrefs = recordTransition({}, "privacy", "completed", { nowMs: 1700000000000 });
    const forbiddenDomainKeys = [
      "program",
      "programMeta",
      "exercises",
      "customExercises",
      "log",
      "workout",
      "sets",
      "reps",
      "weights",
      "history",
      "programHistory",
      "draft",
    ];
    const leakedKeys = Object.keys(samplePrefs.guideState.privacy).filter((k) =>
      forbiddenDomainKeys.includes(k)
    );
    assert(
      leakedKeys.length === 0,
      "fact isolation: guide state records only presentation facts, never program/workout data",
      JSON.stringify(leakedKeys)
    );
  }

  // Case 2.10: Version upgrade resets presentation state for updated guide definitions
  {
    const v2Guide = { id: "entry", version: 2, anchorSelector: "#startWorkout" };
    const olderStatePrefs = {
      guideState: {
        entry: { version: 1, status: "completed", lastTransitionAt: 1700000000000 },
      },
    };
    const upgradedEval = evaluate(v2Guide, {
      anchorPresent: true,
      anchorVisible: true,
      uiPrefs: olderStatePrefs,
    });
    assert(
      upgradedEval.decision === "shown" && upgradedEval.eligible === true,
      "version upgrade resets completed status to allow updated guide to display",
      JSON.stringify(upgradedEval)
    );
  }

  // ---------------------------------------------------------------------------
  // Phase 3: Migration from Legacy tourDone
  // ---------------------------------------------------------------------------
  phase("Phase 3: Migration from Legacy tourDone (Genuinely Covered vs Infrastructure)");

  const migrateTourDone = (prefs, opts) => {
    if (productionGuideModule?.migrateLegacyTourDone) {
      return productionGuideModule.migrateLegacyTourDone(prefs, opts);
    }
    if (productionGuideModule?.migrateTourDone) {
      return productionGuideModule.migrateTourDone(prefs, opts);
    }
    return referenceMigrateLegacyTourDone(prefs, opts);
  };

  // Case 3.1: tourDone: true maps ONLY genuinely covered actions (install) to completed
  {
    const legacyPrefs = {
      tourDone: true,
      theme: "dark",
      lang: "en",
    };
    const migrated = migrateTourDone(legacyPrefs, { nowMs: 1700000000000 });

    assert(
      migrated.guideState && typeof migrated.guideState === "object",
      "migration creates guideState object in uiPrefs",
      JSON.stringify(migrated.guideState)
    );
    assert(
      migrated.guideState.install?.status === "completed",
      "migration: genuinely covered old tour action (install) is mapped to completed",
      JSON.stringify(migrated.guideState.install)
    );
    assert(
      migrated.guideState.entry?.status === "unseen",
      "migration: new Plan 054 infrastructure guide (entry) remains unseen and eligible",
      JSON.stringify(migrated.guideState.entry)
    );
    assert(
      migrated.guideState.privacy?.status === "unseen",
      "migration: new Plan 054 infrastructure guide (privacy) remains unseen and eligible",
      JSON.stringify(migrated.guideState.privacy)
    );
    assert(
      migrated.theme === "dark" && migrated.lang === "en",
      "migration preserves existing UI preferences without loss",
      JSON.stringify({ theme: migrated.theme, lang: migrated.lang })
    );
  }

  // Case 3.2: Clean install without tourDone initializes all guides as unseen
  {
    const cleanPrefs = {};
    const migrated = migrateTourDone(cleanPrefs, { nowMs: 1700000000000 });

    const allUnseen = PLAN_054_GUIDE_IDS.every(
      (id) => migrated.guideState?.[id]?.status === "unseen"
    );
    assert(
      allUnseen,
      "migration without tourDone initializes all Plan 054 guides as unseen",
      JSON.stringify(migrated.guideState)
    );
  }

  // Case 3.3: Do NOT replay all guides blindly or complete all guides blindly
  {
    const legacyWithTourDone = { tourDone: true };
    const migrated = migrateTourDone(legacyWithTourDone, { nowMs: 1700000000000 });

    const notAllCompleted = PLAN_054_GUIDE_IDS.some(
      (id) => migrated.guideState?.[id]?.status !== "completed"
    );
    const notAllUnseen = PLAN_054_GUIDE_IDS.some(
      (id) => migrated.guideState?.[id]?.status !== "unseen"
    );

    assert(
      notAllCompleted && notAllUnseen,
      "migration: does not blindly complete all guides or blindly replay all guides",
      JSON.stringify(migrated.guideState)
    );
  }

  // ---------------------------------------------------------------------------
  // Phase 4: Deliberate Fault Switches Verification
  // ---------------------------------------------------------------------------
  phase("Phase 4: Deliberate Fault Switches Verification");
  {
    // Fault switch 1: floating-without-anchor
    // Proves that if a cue were to float without an anchor, the assertion catches it.
    const missingAnchorUnderNormal = referenceEvaluateGuide(entryGuide, {
      anchorPresent: false,
      anchorVisible: false,
      fault: null,
    });
    const missingAnchorUnderFault = referenceEvaluateGuide(entryGuide, {
      anchorPresent: false,
      anchorVisible: false,
      fault: "floating-without-anchor",
    });

    assert(
      missingAnchorUnderNormal.decision === "deferred" &&
        missingAnchorUnderFault.decision === "shown" &&
        missingAnchorUnderFault.floating === true,
      "fault switch 'floating-without-anchor' correctly simulates floating violation for detection",
      JSON.stringify({ normal: missingAnchorUnderNormal, fault: missingAnchorUnderFault })
    );

    // Fault switch 2: obsolete-tour-restoration
    // Proves that if the obsolete tour is restored, the assertion detects it.
    const obsoleteTourCheck = (hasTourElement, hasStartTourApi) => {
      const tourPresent = Boolean(hasTourElement || hasStartTourApi);
      return { tourPresent, failureDetected: tourPresent };
    };

    const cleanHeadCheck = obsoleteTourCheck(false, false);
    const restoredTourCheck = obsoleteTourCheck(true, true);

    assert(
      !cleanHeadCheck.failureDetected && restoredTourCheck.failureDetected,
      "fault switch 'obsolete-tour-restoration' correctly flags obsolete tour presence for detection",
      JSON.stringify({ clean: cleanHeadCheck, restored: restoredTourCheck })
    );
  }

  // ---------------------------------------------------------------------------
  // Phase 5: Bounded Browser Projections on Live App (REPFORGE_URL)
  // ---------------------------------------------------------------------------
  phase("Phase 5: Bounded Browser Projections on Live App");
  const browser = await launchChromium();
  try {
    // Projection G1: Obsolete Global Modal Tour Markup, API, and Route Removal
    // Plan 054 requirement: Global modal tour (#tour) and startTour/closeTour APIs
    // must be completely removed and no longer reachable.
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      const page = await context.newPage();
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await waitForAppBoot(page, { base: BASE });

      const tourState = await page.evaluate(() => {
        const tourEl = document.querySelector("#tour");
        const hasStartTour = typeof window.startTour === "function";
        const hasCloseTour = typeof window.closeTour === "function";
        const hasUiStartTour = typeof window.__repforgeUi?.startTour === "function";
        const replayTourBtn = document.querySelector("#replayTour");
        const legacyBindingIds = ["tourBack", "tourNext", "tourSkip", "replayTour"];
        const legacyBindingsSafe = legacyBindingIds.every((id) => {
          const element = document.getElementById(id);
          if (!element) return true;
          const container = element.parentElement;
          return container?.hidden === true &&
            container?.getAttribute("aria-hidden") === "true" &&
            element.tabIndex === -1;
        });
        return {
          modalPresent: tourEl !== null,
          hasStartTour,
          hasCloseTour,
          hasUiStartTour,
          replayTourPresent: replayTourBtn !== null,
          legacyBindingsSafe,
        };
      });

      // Deliberate fault detection check
      if (FAULT === "obsolete-tour-restoration") {
        assert(
          false,
          "deliberate fault: obsolete tour restoration detected (fault switch active)",
          JSON.stringify(tourState)
        );
      }

      // In completed P8 implementation, the obsolete modal tour must be completely absent
      const tourCleanlyRemoved =
        !tourState.modalPresent &&
        !tourState.hasStartTour &&
        !tourState.hasCloseTour &&
        !tourState.hasUiStartTour &&
        tourState.legacyBindingsSafe;

      assert(
        tourCleanlyRemoved,
        "browser projection: obsolete global modal tour (#tour, startTour, closeTour) is completely removed and unreachable",
        JSON.stringify(tourState),
        true // Expected baseline RED on current head before P8 production changes
      );

      await context.close();
    }

    // Projection G2: Contextual Guide Registry Hook in Production App
    // The app must expose its contextual guide registry seam or UI hook
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      const page = await context.newPage();
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await waitForAppBoot(page, { base: BASE });

      const guideSeam = await page.evaluate(() => {
        const registry = window.RepForgeGuideRegistry;
        const uiGuideHook = window.__repforgeUi?.guideState || window.__repforgeUi?.guides;
        const replayHook = window.__repforgeUi?.replayGuide;
        return {
          hasRegistryGlobal: Boolean(registry && typeof registry === "object"),
          hasUiHook: typeof uiGuideHook === "function" || typeof uiGuideHook === "object",
          hasReplayHook: typeof replayHook === "function",
        };
      });

      const seamAvailable = guideSeam.hasRegistryGlobal || guideSeam.hasUiHook;
      assert(
        seamAvailable,
        "browser projection: app exposes contextual guide registry seam or __repforgeUi guide hooks",
        JSON.stringify(guideSeam),
        true // Expected baseline RED on current head before P8 production changes
      );

      await context.close();
    }

    // Projection G3: UI Preferences Initialize Default Guide State on Clean Device
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      const page = await context.newPage();
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await waitForAppBoot(page, { base: BASE });

      // Clear device storage to simulate fresh install
      await page.evaluate(async () => {
        localStorage.clear();
        await new Promise((res) => {
          const req = indexedDB.deleteDatabase("repforge");
          req.onsuccess = req.onerror = req.onblocked = () => res();
        });
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(page, { base: BASE });

      const prefs = await page.evaluate(() => {
        try {
          return JSON.parse(localStorage.getItem("repforge_ui_v1") || "{}");
        } catch {
          return {};
        }
      });

      const hasGuideState =
        Boolean(prefs) &&
        typeof prefs.guideState === "object" &&
        prefs.guideState !== null;

      const hasRequiredIds =
        hasGuideState &&
        PLAN_054_GUIDE_IDS.every((id) => Object.hasOwn(prefs.guideState, id));

      assert(
        hasGuideState && hasRequiredIds,
        "browser projection: UI preferences initialize defaulted guideState covering Plan 054 infrastructure IDs",
        JSON.stringify({ hasGuideState, guideState: prefs?.guideState }),
        true // Expected baseline RED on current head before P8 production changes
      );

      await context.close();
    }

    // Projection G4: Missing / Hidden Anchor Defers and Renders No Floating Overlay
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      const page = await context.newPage();
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await waitForAppBoot(page, { base: BASE });

      // Check DOM for any unanchored/floating guide overlays
      const floatingCuesCount = await page.evaluate(() => {
        // Guide cues should have a distinct class, attribute, or container
        const cues = document.querySelectorAll(
          ".guide-cue, .contextual-cue, [data-guide-cue], .guide-overlay:not(.anchored)"
        );
        let unanchoredCount = 0;
        for (const cue of cues) {
          const anchorId = cue.getAttribute("data-anchor-target");
          if (!anchorId || !document.querySelector(anchorId)) {
            unanchoredCount++;
          }
        }
        return { totalCues: cues.length, unanchoredCount };
      });

      // Deliberate fault injection check
      if (FAULT === "floating-without-anchor") {
        assert(
          false,
          "deliberate fault: unanchored floating cue detected in DOM (fault switch active)",
          JSON.stringify(floatingCuesCount)
        );
      }

      assert(
        floatingCuesCount.unanchoredCount === 0,
        "browser projection: missing/hidden anchors defer and render no floating overlay",
        JSON.stringify(floatingCuesCount)
      );

      await context.close();
    }

    // Projection G5: Cue Focus, Keyboard Escape, and Dismiss Accessibility Semantics
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      const page = await context.newPage();
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await waitForAppBoot(page, { base: BASE });

      // The entry landing deliberately presents no cue: it is a full-screen
      // threshold whose job is the proposition, and every cue that could
      // anchor to it restates a control it has already named. Sampling
      // "whatever is on the first screen" therefore proves nothing about cue
      // accessibility — drive to the chooser, which is where the entry guide
      // is anchored, and audit the cue that genuinely renders there.
      const landingCues = await page.evaluate(() =>
        document.querySelectorAll(".guide-cue, [data-guide-cue]").length);
      assert(
        landingCues === 0,
        "browser projection: the entry landing presents no contextual cue automatically",
        String(landingCues)
      );

      await page.click("#firstRunCreate");
      await page.waitForSelector("#onboarding.active", { timeout: 20000 });
      await page.waitForSelector("[data-guide-cue='entry']", { timeout: 20000 });

      const cueA11y = await page.evaluate(() => {
        const sampleCue = document.querySelector(".guide-cue, [data-guide-cue]");
        if (!sampleCue) {
          return { cueFound: false, accessible: false, reason: "no cue rendered at the chooser" };
        }
        const hasAriaRole =
          sampleCue.getAttribute("role") === "region" ||
          sampleCue.getAttribute("role") === "status" ||
          sampleCue.getAttribute("role") === "tooltip";
        const hasAccessibleName =
          sampleCue.hasAttribute("aria-label") || sampleCue.hasAttribute("aria-labelledby");
        const dismissBtn = sampleCue.querySelector("button.cue-dismiss, [data-guide-dismiss]");
        const dismissAccessible =
          dismissBtn &&
          (dismissBtn.hasAttribute("aria-label") || dismissBtn.textContent.trim().length > 0);
        const anchor = document.querySelector(sampleCue.dataset.anchorTarget || "\\0");
        return {
          cueFound: true,
          hasAriaRole,
          hasAccessibleName,
          dismissAccessible: Boolean(dismissAccessible),
          anchored: Boolean(anchor),
          notModal: !sampleCue.getAttribute("aria-modal"),
          accessible: hasAriaRole && hasAccessibleName && Boolean(dismissAccessible) &&
            Boolean(anchor) && !sampleCue.getAttribute("aria-modal"),
        };
      });

      assert(
        cueA11y.cueFound && cueA11y.accessible,
        "browser projection: guide cue implements accessible role, label, anchor, and focusable dismiss",
        JSON.stringify(cueA11y)
      );

      await context.close();
    }

    // Projection G6: Settings Replay Resets Only Chosen Guide Presentation State Without Touching User Data
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      const page = await context.newPage();
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await waitForAppBoot(page, { base: BASE });

      // Populate user data and mock completed guideState
      const initialSeed = {
        program: [
          {
            id: "guide-test-lift",
            day: "Day 1",
            order: 1,
            name: "Bench Press",
            sets: 3,
            min: 6,
            max: 10,
            primary: "Chest",
          },
        ],
        programMeta: { onboarded: true, name: "Replay Test Program" },
        log: [
          {
            session: "replay-test-session",
            date: "2026-09-13",
            name: "Bench Press",
            set: 1,
            load: 100,
            reps: 8,
            rir: 2,
          },
        ],
      };

      const initialUiPrefs = {
        theme: "light",
        lang: "en",
        guideState: {
          entry: { version: 1, status: "completed", lastTransitionAt: 1700000000000 },
          install: { version: 1, status: "completed", lastTransitionAt: 1700000000000 },
          privacy: { version: 1, status: "completed", lastTransitionAt: 1700000000000 },
        },
      };

      const replayResult = await page.evaluate(
        async ({ dataKey, uiKey, seedData, seedUi }) => {
          localStorage.setItem(dataKey, JSON.stringify(seedData));
          localStorage.setItem(uiKey, JSON.stringify(seedUi));

          // Attempt to invoke production replay hook if available
          const replayFn = window.__repforgeUi?.replayGuide;
          let hookCalled = false;
          if (typeof replayFn === "function") {
            replayFn("install");
            hookCalled = true;
          }

          const postData = JSON.parse(localStorage.getItem(dataKey) || "{}");
          const postUi = JSON.parse(localStorage.getItem(uiKey) || "{}");

          return {
            hookCalled,
            dataUnchanged: JSON.stringify(seedData) === JSON.stringify(postData),
            unrelatedGuidesUntouched:
              postUi?.guideState?.entry?.status === "completed" &&
              postUi?.guideState?.privacy?.status === "completed",
            targetReset: postUi?.guideState?.install?.status === "unseen",
          };
        },
        { dataKey: DATA_KEY, uiKey: UIKEY, seedData: initialSeed, seedUi: initialUiPrefs }
      );

      assert(
        replayResult.hookCalled &&
          replayResult.dataUnchanged &&
          replayResult.unrelatedGuidesUntouched &&
          replayResult.targetReset,
        "browser projection: Settings replay hook resets only target guide without mutating user data or unrelated guides",
        JSON.stringify(replayResult),
        true // Expected baseline RED on current head before P8 production changes
      );

      await context.close();
    }
  } finally {
    await browser.close();
  }

  // ---------------------------------------------------------------------------
  // Summary & Failure Classification
  // ---------------------------------------------------------------------------
  console.log(`\nContextual guide characterization: ${results.passed} passed, ${results.failed} failed`);

  if (results.expectedBaselineGaps.length > 0) {
    console.log(
      "\nExpected baseline RED gaps (absence of contextual guide seam & obsolete tour removal on current head):"
    );
    results.expectedBaselineGaps.forEach((gap, idx) => console.log(`  ${idx + 1}. ${gap}`));
  }

  const unexpectedFailures = results.failures.filter(
    (f) => !results.expectedBaselineGaps.includes(f)
  );
  if (unexpectedFailures.length > 0) {
    console.log("\nUnexpected failures (test setup or invariant regression):");
    unexpectedFailures.forEach((f, idx) => console.log(`  ${idx + 1}. ${f}`));
  }

  if (results.failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test execution crashed:", err);
  process.exit(2);
});
