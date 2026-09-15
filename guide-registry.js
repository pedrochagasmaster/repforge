(function guideRegistryModule(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeGuideRegistry = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function guideRegistryFactory() {
  "use strict";

  const GUIDE_STATUSES = Object.freeze([
    "unseen", "shown", "dismissed", "completed", "deferred", "replay",
  ]);
  const PLAN_054_GUIDE_IDS = Object.freeze(["entry", "install", "privacy"]);
  const GUIDE_DEFINITIONS = Object.freeze([
    // Anchored to the chooser's primary Recommend card, not the generic
    // landing: the "how to begin" explanation belongs where there is more
    // than one path in front of the lifter, not before the landing's own
    // two actions. version:2 so a device that already dismissed/completed
    // the old landing-anchored cue sees it once more at its new anchor.
    Object.freeze({ id: "entry", version: 2, anchorSelector: "[data-entry-route=\"recommend\"]", coveredByOldTour: false, wired: true }),
    Object.freeze({ id: "first-set", version: 1, anchorSelector: ".saveset", coveredByOldTour: true, wired: false }),
    Object.freeze({ id: "focus-utilities", version: 1, anchorSelector: "#woOverflowBtn", coveredByOldTour: true, wired: false }),
    Object.freeze({ id: "progress", version: 1, anchorSelector: "nav [data-view=\"stats\"]", coveredByOldTour: true, wired: false }),
    Object.freeze({ id: "block-transition", version: 1, anchorSelector: "#endBlock", coveredByOldTour: true, wired: false }),
    Object.freeze({ id: "backup", version: 1, anchorSelector: "#exportJson", coveredByOldTour: true, wired: false }),
    Object.freeze({ id: "install", version: 1, anchorSelector: "#firstRunInstallAction, #installApp", coveredByOldTour: true, wired: true }),
    Object.freeze({ id: "privacy", version: 1, anchorSelector: "#firstRunPrivacy, #privacyDetails", coveredByOldTour: false, wired: true }),
  ]);

  function guideRecord(guide, status = "unseen", lastTransitionAt = null, extra = {}) {
    return Object.freeze({ version: guide.version, status, lastTransitionAt, ...extra });
  }

  function currentRecord(uiPrefs, guide) {
    const stored = uiPrefs?.guideState?.[guide.id];
    if (!stored || typeof stored !== "object" || stored.version !== guide.version)
      return guideRecord(guide);
    return stored;
  }

  function evaluateGuide(guide, { anchorPresent = false, anchorVisible = false, uiPrefs = {} } = {}) {
    if (!guide || typeof guide.id !== "string" || !Number.isInteger(guide.version))
      return Object.freeze({ decision: "ineligible", eligible: false, reason: "invalid-guide" });
    const record = currentRecord(uiPrefs, guide);
    if (record.status === "completed")
      return Object.freeze({ decision: "completed", eligible: false, reason: "already-completed" });
    if (record.status === "dismissed")
      return Object.freeze({ decision: "dismissed", eligible: false, reason: "already-dismissed" });
    if (!anchorPresent || !anchorVisible)
      return Object.freeze({ decision: "deferred", eligible: false, anchorSelector: guide.anchorSelector, reason: "anchor-missing-or-hidden" });
    return Object.freeze({ decision: "shown", eligible: true, anchorSelector: guide.anchorSelector, reason: "anchor-available" });
  }

  function recordGuideTransition(uiPrefs, guideId, nextStatus, { nowMs = Date.now(), version = 1 } = {}) {
    if (!GUIDE_STATUSES.includes(nextStatus)) return uiPrefs;
    const base = uiPrefs && typeof uiPrefs === "object" ? { ...uiPrefs } : {};
    const guideState = base.guideState && typeof base.guideState === "object" ? { ...base.guideState } : {};
    guideState[guideId] = guideRecord({ version }, nextStatus, nowMs);
    base.guideState = guideState;
    return Object.freeze(base);
  }

  function replayGuideState(uiPrefs, guideId, { nowMs = Date.now(), version = 1 } = {}) {
    const base = uiPrefs && typeof uiPrefs === "object" ? { ...uiPrefs } : {};
    const guideState = base.guideState && typeof base.guideState === "object" ? { ...base.guideState } : {};
    guideState[guideId] = guideRecord({ version }, "unseen", nowMs, { replayedAt: nowMs });
    base.guideState = guideState;
    return Object.freeze(base);
  }

  function migrateLegacyTourDone(uiPrefs, { definitions = GUIDE_DEFINITIONS, nowMs = Date.now() } = {}) {
    const base = uiPrefs && typeof uiPrefs === "object" ? { ...uiPrefs } : {};
    const existing = base.guideState && typeof base.guideState === "object" ? base.guideState : {};
    const guideState = { ...existing };
    for (const guide of definitions) {
      if (guideState[guide.id]?.version === guide.version) continue;
      guideState[guide.id] = base.tourDone === true && guide.coveredByOldTour
        ? guideRecord(guide, "completed", nowMs, { migratedFromTourDone: true })
        : guideRecord(guide);
    }
    delete base.tourDone;
    base.guideState = guideState;
    return Object.freeze(base);
  }

  return Object.freeze({
    GUIDE_STATUSES,
    PLAN_054_GUIDE_IDS,
    GUIDE_DEFINITIONS,
    evaluateGuide,
    recordGuideTransition,
    replayGuideState,
    migrateLegacyTourDone,
  });
});
