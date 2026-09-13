(function installPolicyModule(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeInstallPolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function installPolicyFactory() {
  "use strict";

  const INSTALL_PROMPT_STATES = Object.freeze([
    "unsupported",
    "already-installed",
    "ios-empty-handoff",
    "ios-transfer",
    "chromium-awaiting-value",
    "eligible-milestone",
    "cooldown",
    "manual-settings",
  ]);
  const MONTHLY_COOLDOWN_MS = 30 * 86400000;

  function result(state, eligible, milestone, reason) {
    return Object.freeze({ state, eligible, milestone, reason });
  }

  function finiteTime(value) {
    return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0;
  }

  function evaluateInstallPolicy(input) {
    if (!input || typeof input !== "object") return result("unsupported", false, null, "invalid-input");
    const platform = input.platform;
    const iosSafari = input.isIOSSafari == null ? platform === "ios" : input.isIOSSafari === true;
    const capability = input.hasInstallCapability === true || input.beforeInstallPrompt === true;
    const standalone = input.standalone === true || input.isStandalone === true;
    const meaningful = input.hasMeaningfulData === true;
    const workouts = Number.isInteger(input.savedWorkoutsCount) ? Math.max(0, input.savedWorkoutsCount) : 0;
    const prefs = input.uiPrefs && typeof input.uiPrefs === "object" ? input.uiPrefs : {};
    const now = Number.isFinite(input.nowMs) ? input.nowMs : Date.now();
    const manual = input.source === "manual-settings" || input.isManualSettings === true;

    if (standalone) return result("already-installed", false, null, "standalone");

    if (manual) {
      if (platform === "chromium") return capability
        ? result("manual-settings", true, null, "native-prompt")
        : result("unsupported", false, null, "native-prompt-unavailable");
      if (platform !== "ios" || !iosSafari) return result("unsupported", false, null, "unsupported-platform");
      if (meaningful && input.transferAvailable !== true)
        return result("unsupported", false, null, "transfer-unavailable");
      return result("manual-settings", true, null, meaningful ? "ios-transfer" : "ios-instructions");
    }

    if (platform === "ios") {
      if (!iosSafari) return result("unsupported", false, null, "ios-safari-required");
      if (!meaningful) return result("ios-empty-handoff", true, 0, "ios-empty");
      if (input.transferAvailable !== true) return result("unsupported", false, null, "transfer-unavailable");
      const offeredMilestone = Number.isInteger(prefs.installLastOfferedMilestone)
        ? prefs.installLastOfferedMilestone : null;
      const dismissedMilestone = Number.isInteger(prefs.installDismissedMilestone)
        ? prefs.installDismissedMilestone : null;
      const offeredAt = finiteTime(prefs.installLastOfferedAt);
      const dismissedAt = finiteTime(prefs.installDismissedAt);
      if (offeredAt && now < offeredAt || dismissedAt && now < dismissedAt)
        return result("cooldown", false, null, "clock-reversal");
      if (workouts < 3 &&
          (offeredMilestone !== null && offeredMilestone >= 0 ||
           dismissedMilestone !== null && dismissedMilestone >= 0))
        return result("cooldown", false, null, "awaiting-third-workout");
      if (workouts >= 3) {
        const interactions = [];
        if (offeredMilestone !== null && offeredMilestone >= 3 && offeredAt) interactions.push(offeredAt);
        if (dismissedMilestone !== null && dismissedMilestone >= 3 && dismissedAt) interactions.push(dismissedAt);
        if (interactions.length && now - Math.max(...interactions) < MONTHLY_COOLDOWN_MS)
          return result("cooldown", false, null, "monthly-cooldown");
      }
      return result("ios-transfer", true, workouts >= 3 ? 3 : 0, "ios-transfer");
    }

    if (platform !== "chromium" || !capability)
      return result("unsupported", false, null, "native-prompt-unavailable");
    if (workouts < 1) return result("chromium-awaiting-value", false, null, "awaiting-first-workout");

    const offeredMilestone = Number.isInteger(prefs.installLastOfferedMilestone)
      ? prefs.installLastOfferedMilestone : null;
    const dismissedMilestone = Number.isInteger(prefs.installDismissedMilestone)
      ? prefs.installDismissedMilestone : null;
    const offeredAt = finiteTime(prefs.installLastOfferedAt);
    const dismissedAt = finiteTime(prefs.installDismissedAt);
    if (offeredAt && now < offeredAt || dismissedAt && now < dismissedAt)
      return result("cooldown", false, null, "clock-reversal");

    if (workouts < 3) {
      if (dismissedMilestone !== null && dismissedMilestone >= 1)
        return result("cooldown", false, null, "awaiting-third-workout");
      if (offeredMilestone !== null && offeredMilestone >= 1)
        return result("cooldown", false, null, "first-offer-recorded");
      return result("eligible-milestone", true, 1, "first-workout");
    }

    const interactions = [];
    if (offeredMilestone !== null && offeredMilestone >= 3 && offeredAt) interactions.push(offeredAt);
    if (dismissedMilestone !== null && dismissedMilestone >= 3 && dismissedAt) interactions.push(dismissedAt);
    if (interactions.length && now - Math.max(...interactions) < MONTHLY_COOLDOWN_MS)
      return result("cooldown", false, null, "monthly-cooldown");
    return result("eligible-milestone", true, 3, interactions.length ? "monthly" : "third-workout");
  }

  function recordInstallOffer(uiPrefs, { milestone, nowMs }) {
    return Object.freeze({ ...(uiPrefs && typeof uiPrefs === "object" ? uiPrefs : {}),
      installLastOfferedMilestone: milestone, installLastOfferedAt: nowMs });
  }

  function recordInstallDismissal(uiPrefs, { milestone, nowMs }) {
    return Object.freeze({ ...(uiPrefs && typeof uiPrefs === "object" ? uiPrefs : {}),
      installDismissedMilestone: milestone, installDismissedAt: nowMs });
  }

  return Object.freeze({
    INSTALL_PROMPT_STATES,
    MONTHLY_COOLDOWN_MS,
    evaluateInstallPolicy,
    recordInstallOffer,
    recordInstallDismissal,
  });
});
