#!/usr/bin/env node
/**
 * Proof-first characterization and acceptance test for Plan 054 packet 054-P7:
 * Pure install policy state machine over context, capability, display mode,
 * local-value milestones, UI preferences cadence, and Plan 053 transfer.
 *
 * Spec references:
 * - plans/054-landing-and-program-entry.md (Install policy state machine & 054-P7)
 * - docs/adr/0013-temporary-install-transfer.md
 * - docs/adr/0005-install-promotion-by-capability.md
 *
 * Proves:
 * (1) Required pure states across the full capability/platform matrix:
 *     - unsupported
 *     - already-installed
 *     - ios-empty-handoff
 *     - ios-transfer
 *     - chromium-awaiting-value
 *     - eligible-milestone
 *     - cooldown
 *     - manual-settings
 * (2) iOS empty offer before program creation preserves setup proposal handoff;
 * (3) Meaningful-data iOS routes ONLY through Plan 053 transfer;
 * (4) Chromium automatic offer is gated until first saved workout/value milestone;
 * (5) After dismissal, next automatic offer waits until the third saved workout;
 * (6) Milestone-3 automatic offer or dismissal suppresses looping inside 30 days,
 *     then re-offers recurringly every 30 days (never-offer-again is rejected);
 * (7) Manual Settings source ignores automatic cooldown and remains available when meaningful/supported;
 * (8) Local time defense: clock reversal never triggers an early prompt or loop;
 * (9) An automatic offer is recorded once and does not loop on repeated launches;
 * (10) UI preferences cadence fields isolate install facts without leaking program or workout facts;
 * (11) Deliberate fault switch: REPFORGE_ENTRY_INSTALL_POLICY_FAULT:
 *      - "unsafe-ios-transfer": makes established-data iOS eligible without Plan 053 gate;
 *      - "loop-offer": ignores recorded offer state and re-offers every launch.
 * (12) Bounded browser projection against live application on REPFORGE_URL:
 *      - loads and consumes window.RepForgeInstallPolicy exposing current automatic decision;
 *      - verifies all four cadence keys with safe empty defaults on a clean device.
 *
 * Run:
 *   node test/entry-install-policy.mjs
 *   node tools/run-tests.mjs entry --suite entry-install-policy
 * Deliberate fault runs:
 *   REPFORGE_ENTRY_INSTALL_POLICY_FAULT=unsafe-ios-transfer node tools/run-tests.mjs entry --suite entry-install-policy
 *   REPFORGE_ENTRY_INSTALL_POLICY_FAULT=loop-offer node tools/run-tests.mjs entry --suite entry-install-policy
 */
import { createRequire } from "node:module";
import { isDeepStrictEqual } from "node:util";
import { launchChromium } from "./browser.mjs";
import { MINIMAL_PAYLOAD, cloneFixture } from "./fixtures/shared-setup.mjs";
import {
  APP_INDEX,
  encodeSharedPayload,
  openAppPage,
  waitForFirstRun,
} from "./shared-setup-flow.mjs";

const require = createRequire(import.meta.url);

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const FAULT = process.env.REPFORGE_ENTRY_INSTALL_POLICY_FAULT;

const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IOS_CHROME_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

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

// Required pure state vocabulary (Plan 054 domain/state model)
export const INSTALL_PROMPT_STATES = Object.freeze([
  "unsupported",
  "already-installed",
  "ios-empty-handoff",
  "ios-transfer",
  "chromium-awaiting-value",
  "eligible-milestone",
  "cooldown",
  "manual-settings",
]);

export const MONTHLY_COOLDOWN_MS = 30 * 86400000; // 30 days in milliseconds

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
 * Attempt to load the production install policy module.
 * Checks CommonJS module paths and browser global definitions.
 */
let productionInstallPolicy = null;
try {
  productionInstallPolicy = require("../install-policy.js");
} catch {
  try {
    productionInstallPolicy = require("../entry-install-policy.js");
  } catch {
    // Production module does not exist on this head; expected baseline for proof-first packet.
  }
}

/**
 * Canonical Reference Policy Oracle.
 * Hardcoded according to Plan 054 specification, completely independent of production code.
 */
export function referenceEvaluateInstallPolicy(input, { fault = FAULT } = {}) {
  if (!input || typeof input !== "object") {
    return {
      state: "unsupported",
      eligible: false,
      milestone: null,
      reason: "invalid-input",
    };
  }

  const platform = input.platform; // "ios" | "chromium" | "other"
  const isIOSSafari = input.isIOSSafari ?? (platform === "ios");
  const capability = Boolean(input.hasInstallCapability ?? input.beforeInstallPrompt);
  const standalone = Boolean(input.standalone ?? input.isStandalone);
  const meaningful = Boolean(input.hasMeaningfulData);
  const workoutsCount = Number.isInteger(input.savedWorkoutsCount)
    ? Math.max(0, input.savedWorkoutsCount)
    : 0;
  const prefs = input.uiPrefs && typeof input.uiPrefs === "object" ? input.uiPrefs : {};
  const nowMs = Number.isFinite(input.nowMs) ? input.nowMs : Date.now();
  const isManual = input.source === "manual-settings" || input.isManualSettings === true;
  const transferAvailable = Boolean(input.transferAvailable);

  // 1. Standalone / Already installed
  if (standalone) {
    return {
      state: "already-installed",
      eligible: false,
      milestone: null,
      reason: "App is running in standalone display mode",
    };
  }

  // 2. Manual Settings source
  // "Settings action is always available when installation is meaningful/supported and ignores automatic-prompt cooldown"
  if (isManual) {
    if (platform === "chromium") {
      if (capability) {
        return {
          state: "manual-settings",
          eligible: true,
          milestone: null,
          reason: "Chromium install prompt available from Settings",
        };
      }
      return {
        state: "unsupported",
        eligible: false,
        milestone: null,
        reason: "Chromium install prompt capability unavailable",
      };
    }
    if (platform === "ios") {
      if (!isIOSSafari) {
        return {
          state: "unsupported",
          eligible: false,
          milestone: null,
          reason: "iOS install instructions require Safari",
        };
      }
      if (meaningful) {
        const effectiveTransfer = fault === "unsafe-ios-transfer" ? true : transferAvailable;
        if (effectiveTransfer) {
          return {
            state: "manual-settings",
            eligible: true,
            milestone: null,
            reason: "iOS transfer available from Settings",
          };
        }
        return {
          state: "unsupported",
          eligible: false,
          milestone: null,
          reason: "iOS established data transfer unavailable",
        };
      }
      return {
        state: "manual-settings",
        eligible: true,
        milestone: null,
        reason: "iOS install instructions available from Settings",
      };
    }
    return {
      state: "unsupported",
      eligible: false,
      milestone: null,
      reason: "Platform does not support PWA installation",
    };
  }

  // 3. iOS automatic rules
  if (platform === "ios") {
    if (!isIOSSafari) {
      return {
        state: "unsupported",
        eligible: false,
        milestone: null,
        reason: "Automatic iOS install requires Safari",
      };
    }
    if (!meaningful) {
      // "iOS with no ordinary data: offer on the landing before program creation, preserving setup-proposal handoff"
      return {
        state: "ios-empty-handoff",
        eligible: true,
        milestone: 0,
        reason: "iOS empty offer before program creation preserving setup proposal",
      };
    }
    // "iOS with meaningful data: offer Plan 053's explicit install-and-transfer path"
    const effectiveTransfer = fault === "unsafe-ios-transfer" ? true : transferAvailable;
    if (effectiveTransfer) {
      const offeredMilestone = Number.isInteger(prefs.installLastOfferedMilestone)
        ? prefs.installLastOfferedMilestone : null;
      const dismissedMilestone = Number.isInteger(prefs.installDismissedMilestone)
        ? prefs.installDismissedMilestone : null;
      const offeredAt = Number(prefs.installLastOfferedAt) || 0;
      const dismissedAt = Number(prefs.installDismissedAt) || 0;
      if ((offeredAt > 0 && nowMs < offeredAt) || (dismissedAt > 0 && nowMs < dismissedAt)) {
        return { state: "cooldown", eligible: false, milestone: null, reason: "Clock reversal detected" };
      }
      if (workoutsCount < 3 &&
          (offeredMilestone !== null && offeredMilestone >= 0 ||
           dismissedMilestone !== null && dismissedMilestone >= 0)) {
        return { state: "cooldown", eligible: false, milestone: null, reason: "Awaiting third saved workout" };
      }
      if (workoutsCount >= 3) {
        const interactions = [];
        if (offeredMilestone !== null && offeredMilestone >= 3 && offeredAt > 0) interactions.push(offeredAt);
        if (dismissedMilestone !== null && dismissedMilestone >= 3 && dismissedAt > 0) interactions.push(dismissedAt);
        if (interactions.length && nowMs - Math.max(...interactions) < MONTHLY_COOLDOWN_MS) {
          return { state: "cooldown", eligible: false, milestone: null, reason: "Monthly cooldown active" };
        }
      }
      return {
        state: "ios-transfer",
        eligible: true,
        milestone: workoutsCount >= 3 ? 3 : 0,
        reason: "iOS meaningful data routes through Plan 053 transfer",
      };
    }
    return {
      state: "unsupported",
      eligible: false,
      milestone: null,
      reason: "Plan 053 transfer route unavailable for established data",
    };
  }

  // 4. Chromium automatic rules
  if (platform === "chromium") {
    if (!capability) {
      return {
        state: "unsupported",
        eligible: false,
        milestone: null,
        reason: "beforeinstallprompt capability not available",
      };
    }

    // "Chromium: first automatic offer only after the first saved workout/value milestone"
    if (workoutsCount < 1) {
      return {
        state: "chromium-awaiting-value",
        eligible: false,
        milestone: null,
        reason: "Awaiting first saved workout value milestone",
      };
    }

    const lastOfferedMilestone = prefs.installLastOfferedMilestone ?? null;
    const lastOfferedAt = Number(prefs.installLastOfferedAt) || 0;
    const dismissedMilestone = prefs.installDismissedMilestone ?? null;
    const dismissedAt = Number(prefs.installDismissedAt) || 0;

    // Clock reversal defense:
    // "use server-independent local time defensively against clock reversal"
    if ((lastOfferedAt > 0 && nowMs < lastOfferedAt) || (dismissedAt > 0 && nowMs < dismissedAt)) {
      return {
        state: "cooldown",
        eligible: false,
        milestone: null,
        reason: "Clock reversal detected; prompt suppressed defensively",
      };
    }

    // Cadence check: Milestone 1 (first saved workout)
    if (workoutsCount >= 1 && workoutsCount < 3) {
      if (fault !== "loop-offer") {
        if (dismissedMilestone !== null && dismissedMilestone >= 1) {
          return {
            state: "cooldown",
            eligible: false,
            milestone: null,
            reason: "Milestone 1 declined; awaiting third saved workout",
          };
        }
        if (lastOfferedMilestone !== null && lastOfferedMilestone >= 1) {
          return {
            state: "cooldown",
            eligible: false,
            milestone: null,
            reason: "Milestone 1 already offered; will not loop on launch",
          };
        }
      }
      return {
        state: "eligible-milestone",
        eligible: true,
        milestone: 1,
        reason: "First saved workout milestone reached",
      };
    }

    // Cadence check: Milestone 3 (third saved workout and recurring monthly)
    if (workoutsCount >= 3) {
      if (fault !== "loop-offer") {
        // Dismissal cooldown: inside 30 days of dismissal, suppress prompt
        if (dismissedMilestone !== null && dismissedMilestone >= 3) {
          const elapsedDismissal = nowMs - dismissedAt;
          if (elapsedDismissal < MONTHLY_COOLDOWN_MS) {
            return {
              state: "cooldown",
              eligible: false,
              milestone: null,
              reason: "Monthly cooldown active after milestone 3 dismissal",
            };
          }
        }

        // Offer cooldown: inside 30 days of an offer, suppress launch looping
        if (lastOfferedMilestone !== null && lastOfferedMilestone >= 3) {
          const elapsedOffer = nowMs - lastOfferedAt;
          if (elapsedOffer < MONTHLY_COOLDOWN_MS) {
            return {
              state: "cooldown",
              eligible: false,
              milestone: null,
              reason: "Monthly cooldown active after milestone 3 offer",
            };
          }
        }

        // Recurring offer after 30 days: if either milestone 3 offer or dismissal happened previously,
        // and >= 30 days have elapsed since each recorded event, re-offer.
        if (
          (dismissedMilestone !== null && dismissedMilestone >= 3) ||
          (lastOfferedMilestone !== null && lastOfferedMilestone >= 3)
        ) {
          return {
            state: "eligible-milestone",
            eligible: true,
            milestone: 3,
            reason: "Monthly recurring milestone reached",
          };
        }
      }
      return {
        state: "eligible-milestone",
        eligible: true,
        milestone: 3,
        reason: "Third saved workout milestone reached",
      };
    }
  }

  // 5. Other platforms
  return {
    state: "unsupported",
    eligible: false,
    milestone: null,
    reason: "Platform does not support PWA installation",
  };
}

/**
 * Pure helper to record an install offer into UI preferences.
 * Must NOT leak program or workout facts.
 */
export function referenceRecordInstallOffer(prefs, { milestone, nowMs }) {
  const base = prefs && typeof prefs === "object" ? { ...prefs } : {};
  base.installLastOfferedMilestone = milestone;
  base.installLastOfferedAt = nowMs;
  return Object.freeze(base);
}

/**
 * Pure helper to record an install dismissal into UI preferences.
 * Must NOT leak program or workout facts.
 */
export function referenceRecordInstallDismissal(prefs, { milestone, nowMs }) {
  const base = prefs && typeof prefs === "object" ? { ...prefs } : {};
  base.installDismissedMilestone = milestone;
  base.installDismissedAt = nowMs;
  return Object.freeze(base);
}

// -----------------------------------------------------------------------------
// Test Execution
// -----------------------------------------------------------------------------

async function run() {
  console.log("Packet 054-P7: Pure Install Policy Characterization & Acceptance Suite");
  console.log(`Base URL: ${BASE}`);
  console.log(`Active Fault Switch: ${FAULT || "none"}`);
  console.log(
    `Production Module Seam: ${productionInstallPolicy ? "detected" : "absent (expected baseline on current head)"}`
  );

  // ---------------------------------------------------------------------------
  // Phase 1: Verification of Intended Public API Seam
  // ---------------------------------------------------------------------------
  phase("Phase 1: Pure Module Seam & Intended Contract Export");
  {
    const seamPresent = productionInstallPolicy !== null;
    assert(
      seamPresent,
      "pure install policy module is exported (install-policy.js or entry-install-policy.js)",
      "Production seam is absent on current head before coordinator implementation",
      !seamPresent
    );

    if (seamPresent) {
      assert(
        typeof productionInstallPolicy.evaluateInstallPolicy === "function",
        "exports evaluateInstallPolicy(input)",
        typeof productionInstallPolicy.evaluateInstallPolicy
      );
      assert(
        typeof productionInstallPolicy.recordInstallOffer === "function",
        "exports recordInstallOffer(uiPrefs, options)",
        typeof productionInstallPolicy.recordInstallOffer
      );
      assert(
        typeof productionInstallPolicy.recordInstallDismissal === "function",
        "exports recordInstallDismissal(uiPrefs, options)",
        typeof productionInstallPolicy.recordInstallDismissal
      );
      assert(
        Array.isArray(productionInstallPolicy.INSTALL_PROMPT_STATES),
        "exports INSTALL_PROMPT_STATES array",
        JSON.stringify(productionInstallPolicy.INSTALL_PROMPT_STATES)
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 2: Pure State Machine & Value Milestones Matrix
  // ---------------------------------------------------------------------------
  phase("Phase 2: Pure State Machine & Value Milestones Matrix");

  const evaluate = (input) => {
    if (productionInstallPolicy?.evaluateInstallPolicy) {
      const actual = productionInstallPolicy.evaluateInstallPolicy(input);
      if (FAULT === "unsafe-ios-transfer" && input.platform === "ios" &&
          input.hasMeaningfulData === true && input.transferAvailable === false) {
        return { ...actual, state: "ios-transfer", eligible: true };
      }
      if (FAULT === "loop-offer" && input.source !== "manual-settings" &&
          actual.state === "cooldown") {
        return { ...actual, state: input.platform === "ios" ? "ios-transfer" : "eligible-milestone",
          eligible: true, milestone: input.savedWorkoutsCount >= 3 ? 3 : 1 };
      }
      return actual;
    }
    // Fall back to reference oracle to allow verification under deliberate faults
    // while recording expected baseline red for production implementation.
    return referenceEvaluateInstallPolicy(input);
  };

  // Case 1: Unsupported environments
  {
    const input = {
      platform: "other",
      hasInstallCapability: false,
      standalone: false,
      hasMeaningfulData: false,
      savedWorkoutsCount: 0,
    };
    const cloned = JSON.parse(JSON.stringify(input));
    const result = evaluate(input);
    assert(
      result.state === "unsupported" && result.eligible === false,
      "unsupported: other platform without capability evaluates to unsupported",
      JSON.stringify(result)
    );
    assert(isDeepStrictEqual(input, cloned), "input immutability: input is not mutated");
  }

  // Case 2: iOS non-Safari browser (e.g. Chrome on iOS)
  {
    const input = {
      platform: "ios",
      isIOSSafari: false,
      hasInstallCapability: false,
      standalone: false,
      hasMeaningfulData: false,
      savedWorkoutsCount: 0,
    };
    const result = evaluate(input);
    assert(
      result.state === "unsupported" && result.eligible === false,
      "unsupported: iOS non-Safari evaluates to unsupported rather than dead prompt",
      JSON.stringify(result)
    );
  }

  // Case 3: Standalone display mode (already installed)
  {
    const chromiumInstalled = evaluate({
      platform: "chromium",
      hasInstallCapability: true,
      standalone: true,
      hasMeaningfulData: true,
      savedWorkoutsCount: 10,
    });
    assert(
      chromiumInstalled.state === "already-installed" && chromiumInstalled.eligible === false,
      "already-installed: standalone display mode suppresses install on Chromium",
      JSON.stringify(chromiumInstalled)
    );

    const iosInstalled = evaluate({
      platform: "ios",
      isIOSSafari: true,
      standalone: true,
      hasMeaningfulData: false,
      savedWorkoutsCount: 0,
    });
    assert(
      iosInstalled.state === "already-installed" && iosInstalled.eligible === false,
      "already-installed: standalone display mode suppresses install on iOS",
      JSON.stringify(iosInstalled)
    );
  }

  // Case 4: iOS empty handoff (no ordinary data, landing before program creation)
  {
    const emptyIos = evaluate({
      platform: "ios",
      isIOSSafari: true,
      standalone: false,
      hasMeaningfulData: false,
      savedWorkoutsCount: 0,
      setupProposalPresent: true, // proposal preserved
    });
    assert(
      emptyIos.state === "ios-empty-handoff" && emptyIos.eligible === true,
      "ios-empty-handoff: iOS with no ordinary data offers install on landing before program creation",
      JSON.stringify(emptyIos)
    );
  }

  // Case 5: iOS meaningful data routes ONLY through Plan 053 transfer
  {
    const iosTransferAvailable = evaluate({
      platform: "ios",
      isIOSSafari: true,
      standalone: false,
      hasMeaningfulData: true,
      savedWorkoutsCount: 3,
      transferAvailable: true,
    });
    assert(
      iosTransferAvailable.state === "ios-transfer" && iosTransferAvailable.eligible === true,
      "ios-transfer: established-data iOS routes to Plan 053 temporary transfer when available",
      JSON.stringify(iosTransferAvailable)
    );

    // SAFETY CRITICAL INVARIANT:
    // Established-data iOS must NOT offer install transfer without Plan 053 gate
    const iosTransferUnavailable = evaluate({
      platform: "ios",
      isIOSSafari: true,
      standalone: false,
      hasMeaningfulData: true,
      savedWorkoutsCount: 3,
      transferAvailable: false,
    });
    assert(
      iosTransferUnavailable.state !== "ios-transfer" && iosTransferUnavailable.eligible === false,
      "safety invariant: established-data iOS must NOT offer install without Plan 053 transfer gate",
      JSON.stringify(iosTransferUnavailable)
    );
  }

  // Case 5b: iOS transfer promotion follows the same decline/third/monthly cadence
  {
    const base = {
      platform: "ios",
      isIOSSafari: true,
      standalone: false,
      hasMeaningfulData: true,
      transferAvailable: true,
    };
    const afterInitialDismissal = evaluate({
      ...base,
      savedWorkoutsCount: 2,
      uiPrefs: { installDismissedMilestone: 0, installDismissedAt: 1700000000000 },
      nowMs: 1700000100000,
    });
    assert(
      afterInitialDismissal.state === "cooldown" && afterInitialDismissal.eligible === false,
      "iOS cadence: declining the initial transfer offer waits for the third saved workout",
      JSON.stringify(afterInitialDismissal)
    );
    const thirdWorkout = evaluate({
      ...base,
      savedWorkoutsCount: 3,
      uiPrefs: { installDismissedMilestone: 0, installDismissedAt: 1700000000000 },
      nowMs: 1700000100000,
    });
    assert(
      thirdWorkout.state === "ios-transfer" && thirdWorkout.eligible === true && thirdWorkout.milestone === 3,
      "iOS cadence: Plan 053 transfer is offered again at the third saved workout",
      JSON.stringify(thirdWorkout)
    );
    const monthlyCooldown = evaluate({
      ...base,
      savedWorkoutsCount: 4,
      uiPrefs: { installLastOfferedMilestone: 3, installLastOfferedAt: 1700000000000 },
      nowMs: 1700000000000 + 15 * 86400000,
    });
    assert(
      monthlyCooldown.state === "cooldown" && monthlyCooldown.eligible === false,
      "iOS cadence: a milestone-3 transfer offer does not loop inside 30 days",
      JSON.stringify(monthlyCooldown)
    );
    const monthlyReturn = evaluate({
      ...base,
      savedWorkoutsCount: 4,
      uiPrefs: { installLastOfferedMilestone: 3, installLastOfferedAt: 1700000000000 },
      nowMs: 1700000000000 + 30 * 86400000,
    });
    assert(
      monthlyReturn.state === "ios-transfer" && monthlyReturn.eligible === true && monthlyReturn.milestone === 3,
      "iOS cadence: transfer promotion may return after 30 days",
      JSON.stringify(monthlyReturn)
    );
  }

  // Case 6: Chromium awaiting value (0 saved workouts)
  {
    const awaitingValue = evaluate({
      platform: "chromium",
      hasInstallCapability: true,
      standalone: false,
      hasMeaningfulData: false,
      savedWorkoutsCount: 0,
      uiPrefs: {},
    });
    assert(
      awaitingValue.state === "chromium-awaiting-value" && awaitingValue.eligible === false,
      "chromium-awaiting-value: Chromium with beforeinstallprompt suppresses prompt until first saved workout",
      JSON.stringify(awaitingValue)
    );
  }

  // Case 7: Chromium milestone 1 (first saved workout)
  {
    const milestone1 = evaluate({
      platform: "chromium",
      hasInstallCapability: true,
      standalone: false,
      hasMeaningfulData: true,
      savedWorkoutsCount: 1,
      uiPrefs: {},
    });
    assert(
      milestone1.state === "eligible-milestone" &&
        milestone1.eligible === true &&
        milestone1.milestone === 1,
      "eligible-milestone (1): Chromium becomes eligible after first saved workout",
      JSON.stringify(milestone1)
    );
  }

  // Case 8: Chromium anti-looping after offer without dismissal
  {
    const reLaunchMilestone1 = evaluate({
      platform: "chromium",
      hasInstallCapability: true,
      standalone: false,
      hasMeaningfulData: true,
      savedWorkoutsCount: 1,
      uiPrefs: {
        installLastOfferedMilestone: 1,
        installLastOfferedAt: 1700000000000,
      },
      nowMs: 1700000001000,
    });
    assert(
      reLaunchMilestone1.state === "cooldown" && reLaunchMilestone1.eligible === false,
      "anti-looping: automatic offer is recorded once and does not loop on every launch",
      JSON.stringify(reLaunchMilestone1)
    );
  }

  // Case 9: Cooldown between milestone 1 dismissal and milestone 3
  {
    const dismissedM1 = evaluate({
      platform: "chromium",
      hasInstallCapability: true,
      standalone: false,
      hasMeaningfulData: true,
      savedWorkoutsCount: 2, // 2 saved workouts: after 1st dismissal, before 3rd
      uiPrefs: {
        installDismissedMilestone: 1,
        installDismissedAt: 1700000000000,
      },
      nowMs: 1700000100000,
    });
    assert(
      dismissedM1.state === "cooldown" && dismissedM1.eligible === false,
      "cooldown: after milestone 1 dismissal, automatic prompt waits for milestone 3",
      JSON.stringify(dismissedM1)
    );
  }

  // Case 10: Milestone 3 reached after milestone 1 dismissal
  {
    const milestone3 = evaluate({
      platform: "chromium",
      hasInstallCapability: true,
      standalone: false,
      hasMeaningfulData: true,
      savedWorkoutsCount: 3,
      uiPrefs: {
        installDismissedMilestone: 1,
        installDismissedAt: 1700000000000,
      },
      nowMs: 1700000200000,
    });
    assert(
      milestone3.state === "eligible-milestone" &&
        milestone3.eligible === true &&
        milestone3.milestone === 3,
      "eligible-milestone (3): prompt re-offered after reaching third saved workout",
      JSON.stringify(milestone3)
    );
  }

  // Case 11: Cooldown after milestone 3 dismissal before 30 days
  {
    const dismissedM3Recent = evaluate({
      platform: "chromium",
      hasInstallCapability: true,
      standalone: false,
      hasMeaningfulData: true,
      savedWorkoutsCount: 4,
      uiPrefs: {
        installDismissedMilestone: 3,
        installDismissedAt: 1700000000000,
      },
      nowMs: 1700000000000 + 15 * 86400000, // 15 days later (< 30 days)
    });
    assert(
      dismissedM3Recent.state === "cooldown" && dismissedM3Recent.eligible === false,
      "cooldown: after milestone 3 dismissal, prompt is suppressed within 30-day window",
      JSON.stringify(dismissedM3Recent)
    );
  }

  // Case 12: Monthly cadence reached (>= 30 days after milestone 3 dismissal)
  {
    const monthlyEligibleDismissal = evaluate({
      platform: "chromium",
      hasInstallCapability: true,
      standalone: false,
      hasMeaningfulData: true,
      savedWorkoutsCount: 5,
      uiPrefs: {
        installDismissedMilestone: 3,
        installDismissedAt: 1700000000000,
      },
      nowMs: 1700000000000 + 30 * 86400000, // exactly 30 days later
    });
    assert(
      monthlyEligibleDismissal.state === "eligible-milestone" && monthlyEligibleDismissal.eligible === true,
      "eligible-milestone (monthly from dismissal): re-offered no more than monthly after milestone 3 dismissal",
      JSON.stringify(monthlyEligibleDismissal)
    );
  }

  // Case 13: Cooldown after milestone 3 offer without dismissal (< 30 days)
  {
    const offeredM3Recent = evaluate({
      platform: "chromium",
      hasInstallCapability: true,
      standalone: false,
      hasMeaningfulData: true,
      savedWorkoutsCount: 4,
      uiPrefs: {
        installLastOfferedMilestone: 3,
        installLastOfferedAt: 1700000000000,
      },
      nowMs: 1700000000000 + 15 * 86400000, // 15 days later (< 30 days)
    });
    assert(
      offeredM3Recent.state === "cooldown" && offeredM3Recent.eligible === false,
      "cooldown: after milestone 3 offer without dismissal, prompt is suppressed within 30-day window",
      JSON.stringify(offeredM3Recent)
    );
  }

  // Case 14: Monthly cadence reached (>= 30 days after milestone 3 offer without dismissal)
  {
    const monthlyEligibleOffer = evaluate({
      platform: "chromium",
      hasInstallCapability: true,
      standalone: false,
      hasMeaningfulData: true,
      savedWorkoutsCount: 5,
      uiPrefs: {
        installLastOfferedMilestone: 3,
        installLastOfferedAt: 1700000000000,
      },
      nowMs: 1700000000000 + 30 * 86400000, // exactly 30 days later
    });
    assert(
      monthlyEligibleOffer.state === "eligible-milestone" && monthlyEligibleOffer.eligible === true,
      "eligible-milestone (monthly from offer): re-offered after 30 days even if milestone 3 was not dismissed",
      JSON.stringify(monthlyEligibleOffer)
    );
  }

  // Case 15: Milestone 3 offer followed by dismissal: cooldown follows most recent interaction
  {
    const offerAndDismissRecent = evaluate({
      platform: "chromium",
      hasInstallCapability: true,
      standalone: false,
      hasMeaningfulData: true,
      savedWorkoutsCount: 4,
      uiPrefs: {
        installLastOfferedMilestone: 3,
        installLastOfferedAt: 1700000000000,
        installDismissedMilestone: 3,
        installDismissedAt: 1700000000000 + 5 * 86400000, // dismissed 5 days later
      },
      nowMs: 1700000000000 + 31 * 86400000, // 31 days after offer, but only 26 days after dismissal
    });
    assert(
      offerAndDismissRecent.state === "cooldown" && offerAndDismissRecent.eligible === false,
      "cooldown: when both offered and dismissed, cooldown respects latest interaction within 30 days",
      JSON.stringify(offerAndDismissRecent)
    );

    const offerAndDismissElapsed = evaluate({
      platform: "chromium",
      hasInstallCapability: true,
      standalone: false,
      hasMeaningfulData: true,
      savedWorkoutsCount: 4,
      uiPrefs: {
        installLastOfferedMilestone: 3,
        installLastOfferedAt: 1700000000000,
        installDismissedMilestone: 3,
        installDismissedAt: 1700000000000 + 5 * 86400000,
      },
      nowMs: 1700000000000 + 36 * 86400000, // 31 days after dismissal
    });
    assert(
      offerAndDismissElapsed.state === "eligible-milestone" && offerAndDismissElapsed.eligible === true,
      "eligible-milestone: becomes eligible once 30 days elapse after latest interaction",
      JSON.stringify(offerAndDismissElapsed)
    );
  }

  // Case 16: Local time defensive against clock reversal
  {
    const clockReversalDismissed = evaluate({
      platform: "chromium",
      hasInstallCapability: true,
      standalone: false,
      hasMeaningfulData: true,
      savedWorkoutsCount: 4,
      uiPrefs: {
        installDismissedMilestone: 3,
        installDismissedAt: 1700000000000,
      },
      nowMs: 1600000000000, // clock jumped backwards
    });
    assert(
      clockReversalDismissed.state === "cooldown" && clockReversalDismissed.eligible === false,
      "clock reversal defense: negative time delta relative to dismissal remains in cooldown",
      JSON.stringify(clockReversalDismissed)
    );

    const clockReversalOffered = evaluate({
      platform: "chromium",
      hasInstallCapability: true,
      standalone: false,
      hasMeaningfulData: true,
      savedWorkoutsCount: 1,
      uiPrefs: {
        installLastOfferedMilestone: 1,
        installLastOfferedAt: 1700000000000,
      },
      nowMs: 1600000000000, // clock jumped backwards
    });
    assert(
      clockReversalOffered.state === "cooldown" && clockReversalOffered.eligible === false,
      "clock reversal defense: negative time delta relative to offer remains in cooldown",
      JSON.stringify(clockReversalOffered)
    );
  }

  // Case 17: Manual Settings source ignores automatic cooldown
  {
    const settingsDuringCooldown = evaluate({
      platform: "chromium",
      hasInstallCapability: true,
      standalone: false,
      hasMeaningfulData: true,
      savedWorkoutsCount: 1,
      uiPrefs: {
        installDismissedMilestone: 1,
        installDismissedAt: 1700000000000,
      },
      source: "manual-settings",
    });
    assert(
      settingsDuringCooldown.state === "manual-settings" && settingsDuringCooldown.eligible === true,
      "manual-settings: Settings action is available during automatic cooldown",
      JSON.stringify(settingsDuringCooldown)
    );

    const settingsAwaitingValue = evaluate({
      platform: "chromium",
      hasInstallCapability: true,
      standalone: false,
      hasMeaningfulData: false,
      savedWorkoutsCount: 0,
      source: "manual-settings",
    });
    assert(
      settingsAwaitingValue.state === "manual-settings" && settingsAwaitingValue.eligible === true,
      "manual-settings: Settings action is available on Chromium even before milestone 1",
      JSON.stringify(settingsAwaitingValue)
    );

    const settingsInStandalone = evaluate({
      platform: "chromium",
      hasInstallCapability: true,
      standalone: true,
      source: "manual-settings",
    });
    assert(
      settingsInStandalone.state === "already-installed" && settingsInStandalone.eligible === false,
      "manual-settings: Settings action correctly yields to already-installed when in standalone",
      JSON.stringify(settingsInStandalone)
    );
  }

  // ---------------------------------------------------------------------------
  // Phase 3: UI Preference Cadence Transitions & Fact Isolation
  // ---------------------------------------------------------------------------
  phase("Phase 3: UI Preference Cadence Transitions & Fact Isolation");
  {
    const recordOffer =
      productionInstallPolicy?.recordInstallOffer || referenceRecordInstallOffer;
    const recordDismissal =
      productionInstallPolicy?.recordInstallDismissal || referenceRecordInstallDismissal;

    const initialPrefs = Object.freeze({ theme: "system", lang: "en" });
    const offeredPrefs = recordOffer(initialPrefs, { milestone: 1, nowMs: 1700000000000 });

    assert(
      offeredPrefs.installLastOfferedMilestone === 1 &&
        offeredPrefs.installLastOfferedAt === 1700000000000 &&
        offeredPrefs.theme === "system",
      "recordInstallOffer: updates milestone and timestamp fields while preserving existing prefs",
      JSON.stringify(offeredPrefs)
    );

    const dismissedPrefs = recordDismissal(offeredPrefs, { milestone: 1, nowMs: 1700000050000 });
    assert(
      dismissedPrefs.installDismissedMilestone === 1 &&
        dismissedPrefs.installDismissedAt === 1700000050000 &&
        dismissedPrefs.installLastOfferedMilestone === 1,
      "recordInstallDismissal: updates dismissed milestone and timestamp",
      JSON.stringify(dismissedPrefs)
    );

    // Invariant: Prefs must NEVER store program, exercise, or workout log facts
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
      "programHistory",
      "draft",
    ];
    const leakedKeys = Object.keys(dismissedPrefs).filter((k) => forbiddenDomainKeys.includes(k));
    assert(
      leakedKeys.length === 0,
      "fact isolation: UI prefs record install cadence without leaking program/workout domain data",
      JSON.stringify(leakedKeys)
    );
  }

  // ---------------------------------------------------------------------------
  // Phase 4: Bounded Browser Projections on REPFORGE_URL
  // ---------------------------------------------------------------------------
  phase("Phase 4: Bounded Browser Projection on Live App");
  const browser = await launchChromium();
  try {
    // Projection B1: Empty first run on Chromium with beforeinstallprompt
    // Plan 054 requirement: Chromium must await value milestone 1 (state: chromium-awaiting-value).
    // Production P7 seam requirement: app loads and consumes window.RepForgeInstallPolicy,
    // exposing current automatic decision for verification.
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: ANDROID_UA,
      });
      const page = await context.newPage();
      await page.addInitScript(INSTALL_EVENT);
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
      await page.evaluate(async () => {
        localStorage.clear();
        await new Promise((res) => {
          const req = indexedDB.deleteDatabase("repforge");
          req.onsuccess = req.onerror = req.onblocked = () => res();
        });
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 15000 });
      await page.evaluate(() => window.__fireInstall());

      // The domain module stays pure. The app exposes its current projection
      // through the existing test-only UI hook rather than adding mutable
      // runtime state to RepForgeInstallPolicy.
      const policyHook = await page.evaluate(() => {
        const policy = window.RepForgeInstallPolicy;
        const getDecision = window.__repforgeUi?.installPolicyDecision;
        if (!policy || typeof policy !== "object" || typeof getDecision !== "function") {
          return null;
        }
        const decision = getDecision();
        return {
          hasEvaluator: typeof policy.evaluateInstallPolicy === "function",
          hasHook: true,
          decision: decision ? {
            state: decision.state,
            eligible: decision.eligible,
            milestone: decision.milestone ?? null,
            reason: decision.reason,
          } : null,
        };
      });

      const hookValid =
        Boolean(policyHook) &&
        policyHook.hasEvaluator === true &&
        policyHook.hasHook === true &&
        policyHook.decision !== null &&
        policyHook.decision.state === "chromium-awaiting-value" &&
        policyHook.decision.eligible === false;

      assert(
        hookValid,
        "browser projection: app consumes the pure policy and exposes its current automatic decision (chromium-awaiting-value)",
        JSON.stringify(policyHook),
        true // Expected baseline RED on current head before P7 production changes
      );

      // Under the new policy, first run Chromium has 0 workouts saved and must NOT show automatic install card
      const installSectionVisible = await page.evaluate(() => {
        const el = document.querySelector("#firstRunInstall");
        return el ? !el.classList.contains("hidden") : false;
      });

      assert(
        !installSectionVisible,
        "browser projection: Chromium first-run with 0 saved workouts awaits value and does NOT offer automatic install",
        JSON.stringify({ installSectionVisible }),
        true // Expected baseline RED on current head before P7 production changes
      );

      await context.close();
    }

    // Projection B2: Empty first run on iOS Safari
    // Plan 054 requirement: iOS empty handoff offers install card before program creation
    // Current production: shows #firstRunInstall
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: IOS_UA,
      });
      const page = await context.newPage();
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
      await page.evaluate(async () => {
        localStorage.clear();
        await new Promise((res) => {
          const req = indexedDB.deleteDatabase("repforge");
          req.onsuccess = req.onerror = req.onblocked = () => res();
        });
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 15000 });

      const iosInstallVisible = await page.evaluate(() => {
        const el = document.querySelector("#firstRunInstall");
        return el ? !el.classList.contains("hidden") : false;
      });

      assert(
        iosInstallVisible,
        "browser projection: iOS Safari first-run offers empty-handoff install card before program creation",
        JSON.stringify({ iosInstallVisible })
      );

      await context.close();
    }

    // Projection B3: Setup proposal preservation during iOS install offer
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: IOS_UA,
      });
      const page = await context.newPage();
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
      await page.evaluate(async () => {
        localStorage.clear();
        await new Promise((res) => {
          const req = indexedDB.deleteDatabase("repforge");
          req.onsuccess = req.onerror = req.onblocked = () => res();
        });
      });
      const encoded = await encodeSharedPayload(page, cloneFixture(MINIMAL_PAYLOAD));
      if (encoded?.ok) {
        await page.goto(`${APP_INDEX}#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
        await waitForFirstRun(page);

        const proposalIntact = await page.evaluate(() => {
          const card = document.querySelector("#firstRunInstall");
          const sharedStart = document.querySelector("#firstRunSharedStart");
          const hasProposal = Boolean(window.__repforgeSharedSetup || document.querySelector("#firstRunSharedProgram"));
          return {
            installVisible: card ? !card.classList.contains("hidden") : false,
            startVisible: sharedStart ? !sharedStart.classList.contains("hidden") : false,
            hasProposal,
          };
        });

        assert(
          proposalIntact.installVisible && proposalIntact.startVisible,
          "browser projection: iOS empty install card preserves incoming setup proposal without consuming it",
          JSON.stringify(proposalIntact)
        );
      }
      await context.close();
    }

    // Projection B4: Standalone display mode suppresses install surfaces
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: ANDROID_UA,
      });
      const page = await context.newPage();
      await page.addInitScript(`
        const mm = window.matchMedia.bind(window);
        window.matchMedia = (q) => (q.includes("display-mode: standalone")
          ? { matches: true, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
          : mm(q));
      `);
      await page.addInitScript(INSTALL_EVENT);
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
      await page.evaluate(async () => {
        localStorage.clear();
        await new Promise((res) => {
          const req = indexedDB.deleteDatabase("repforge");
          req.onsuccess = req.onerror = req.onblocked = () => res();
        });
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 15000 });
      await page.evaluate(() => window.__fireInstall());

      const standaloneInstallHidden = await page.evaluate(() => {
        const card = document.querySelector("#firstRunInstall");
        const banner = document.querySelector("#installBanner");
        return (!card || card.classList.contains("hidden")) && (!banner || banner.classList.contains("hidden"));
      });

      assert(
        standaloneInstallHidden,
        "browser projection: standalone display mode cleanly suppresses both first-run install card and banner",
        JSON.stringify({ standaloneInstallHidden })
      );
      await context.close();
    }

    // Projection B5: Manual Settings action availability
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: ANDROID_UA,
      });
      const page = await context.newPage();
      await page.addInitScript(INSTALL_EVENT);
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });

      // Navigate to Settings view
      await page.evaluate(() => {
        window.__fireInstall();
        const settingsTab = document.querySelector("#openSettings");
        if (settingsTab) settingsTab.click();
      });

      const settingsInstallPresent = await page.evaluate(() => {
        const el = document.querySelector("#installApp");
        return el ? !el.classList.contains("hidden") : false;
      });

      assert(
        settingsInstallPresent,
        "browser projection: Settings install action is available when install capability is present",
        JSON.stringify({ settingsInstallPresent })
      );
      await context.close();
    }

    // Projection B6: Manual Settings attempts do not spend an automatic milestone.
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: ANDROID_UA,
      });
      const page = await context.newPage();
      await page.addInitScript(INSTALL_EVENT);
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
      await page.evaluate(async () => {
        const proposal = window.__repforgeWorkoutDraft.state();
        proposal.log.push({
          session: "settings-install-value", date: "2026-09-13", day: "Day 1",
          name: "Boundary set", exerciseId: "settings-install", set: 1,
          load: 20, reps: 8, rir: 2, notes: "", created: "2026-09-13T12:00:00.000Z",
        });
        await window.__repforgeCommitProposedState(proposal);
        window.__choice = "dismissed";
        window.__fireInstall();
        document.querySelector("#openSettings")?.click();
        document.querySelector("#installApp")?.click();
      });
      await page.waitForTimeout(50);
      const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem("repforge_ui_v1") || "{}"));
      assert(
        prefs.installDismissedMilestone === null && prefs.installDismissedAt === null,
        "browser projection: dismissing a manual Settings prompt does not spend an automatic milestone",
        JSON.stringify(prefs)
      );
      await context.close();
    }

    // Projection B7: The adapter fails closed if the iOS transfer becomes unavailable.
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: IOS_UA,
      });
      const page = await context.newPage();
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
      const result = await page.evaluate(async () => {
        const proposal = window.__repforgeWorkoutDraft.state();
        proposal.programMeta = { ...proposal.programMeta, onboarded: true, name: "Existing program" };
        proposal.program = [{
          id: "existing", day: "Day 1", order: 1, name: "Existing lift",
          sets: 3, min: 6, max: 10, primary: "Chest", secondary: "", notes: "", alternates: [],
        }];
        await window.__repforgeCommitProposedState(proposal);
        window.RepForgeInstallTransfer = null;
        document.querySelector("#openSettings")?.click();
        const action = document.querySelector("#installApp");
        action?.click();
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return {
          actionHidden: action?.classList.contains("hidden") === true,
          sheetOpen: document.querySelector("#iosInstallSheet")?.classList.contains("is-open") === true,
          decision: window.__repforgeUi.installPolicyDecision(),
        };
      });
      assert(
        result.actionHidden && !result.sheetOpen && result.decision.reason === "transfer-unavailable",
        "browser projection: established-data iOS cannot fall back to an untransferred manual install",
        JSON.stringify(result)
      );
      await context.close();
    }

    // Projection B8: Value milestone cadence tracking in UI prefs
    // Requirement: prove exact defaulted keys/values or an offer transition rather than merely Object.hasOwn.
    // Use the plan's defaulted migration contract and require all four cadence keys:
    // (installLastOfferedMilestone, installLastOfferedAt, installDismissedMilestone, installDismissedAt)
    // with safe empty defaults on a clean device.
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: ANDROID_UA,
      });
      const page = await context.newPage();
      await page.addInitScript(INSTALL_EVENT);
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
      await page.evaluate(async () => {
        localStorage.clear();
        await new Promise((res) => {
          const req = indexedDB.deleteDatabase("repforge");
          req.onsuccess = req.onerror = req.onblocked = () => res();
        });
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });

      const prefs = await page.evaluate(() => {
        try {
          return JSON.parse(localStorage.getItem("repforge_ui_v1") || "{}");
        } catch {
          return {};
        }
      });

      const hasAllFourCadenceKeys =
        Boolean(prefs) &&
        typeof prefs === "object" &&
        Object.hasOwn(prefs, "installLastOfferedMilestone") &&
        Object.hasOwn(prefs, "installLastOfferedAt") &&
        Object.hasOwn(prefs, "installDismissedMilestone") &&
        Object.hasOwn(prefs, "installDismissedAt");

      const hasSafeEmptyDefaults =
        hasAllFourCadenceKeys &&
        prefs.installLastOfferedMilestone === null &&
        prefs.installLastOfferedAt === null &&
        prefs.installDismissedMilestone === null &&
        prefs.installDismissedAt === null;

      const hasValidOfferTransition =
        hasAllFourCadenceKeys &&
        typeof prefs.installLastOfferedMilestone === "number" &&
        prefs.installLastOfferedMilestone >= 1 &&
        typeof prefs.installLastOfferedAt === "number" &&
        prefs.installLastOfferedAt > 0 &&
        prefs.installDismissedMilestone === null &&
        prefs.installDismissedAt === null;

      const cadenceValid = hasSafeEmptyDefaults || hasValidOfferTransition;

      assert(
        cadenceValid,
        "browser projection: UI preferences initialize all four cadence keys (installLastOfferedMilestone, installLastOfferedAt, installDismissedMilestone, installDismissedAt) with safe empty defaults",
        JSON.stringify({
          prefs,
          hasAllFourCadenceKeys,
          hasSafeEmptyDefaults,
          hasValidOfferTransition,
        }),
        true // Expected baseline RED on current head
      );
      await context.close();
    }
  } finally {
    await browser.close();
  }

  // ---------------------------------------------------------------------------
  // Summary & Failure Classification
  // ---------------------------------------------------------------------------
  console.log(`\nInstall policy characterization: ${results.passed} passed, ${results.failed} failed`);

  if (results.expectedBaselineGaps.length > 0) {
    console.log("\nExpected baseline RED gaps (absence of pure install-policy seam & value cadence on current head):");
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
