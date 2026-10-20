/** Versioned, local guide preference rules. The mounted Settings guide view owns DOM and lifetime. */
/** @typedef {import('./contracts.d.ts').GuideDefinition & {coveredByOldTour?:boolean}} Guide */
/** @typedef {Record<string,unknown>} Prefs */
/** @typedef {{version?:unknown,status?:unknown,[key:string]:unknown}} StoredRecord */
/** @param {Prefs} prefs @returns {Record<string,StoredRecord>} */
function guideStateOf(prefs){return prefs.guideState&&typeof prefs.guideState==='object'?/** @type {Record<string,StoredRecord>} */(prefs.guideState):{}}
export const GUIDE_STATUSES = Object.freeze([
    "unseen", "shown", "dismissed", "completed", "deferred", "replay",
  ]);
export const PLAN_054_GUIDE_IDS = Object.freeze(["entry", "install", "privacy"]);
export const PLAN_056_GUIDE_IDS = Object.freeze(["progress", "block-transition"]);
export const GUIDE_DEFINITIONS = Object.freeze([
    // Anchored to the chooser's primary Recommend card, not the generic
    // landing: the "how to begin" explanation belongs where there is more
    // than one path in front of the lifter, not before the landing's own
    // two actions. version:2 so a device that already dismissed/completed
    // the old landing-anchored cue sees it once more at its new anchor.
    Object.freeze({ id: "entry", version: 2, anchorSelector: "[data-entry-hub=\"recommend\"]", coveredByOldTour: false, wired: true }),
    Object.freeze({ id: "first-set", version: 1, anchorSelector: ".saveset", coveredByOldTour: true, wired: true }),
    Object.freeze({ id: "focus-utilities", version: 1, anchorSelector: "#woOverflowBtn", coveredByOldTour: true, wired: true }),
    Object.freeze({ id: "progress", version: 2, anchorSelector: "#statsSeg [data-seg=\"overview\"]", coveredByOldTour: true, wired: true }),
    Object.freeze({ id: "block-transition", version: 2, anchorSelector: "#statsSeg [data-seg=\"review\"]", coveredByOldTour: true, wired: true }),
    Object.freeze({ id: "backup", version: 1, anchorSelector: "#exportJson", coveredByOldTour: true, wired: true }),
    Object.freeze({ id: "install", version: 1, anchorSelector: "#firstRunInstallAction, #installApp", coveredByOldTour: true, wired: true }),
    Object.freeze({ id: "privacy", version: 1, anchorSelector: "#firstRunPrivacy, #privacyDetails", coveredByOldTour: false, wired: true }),
  ]);

/** @param {Pick<Guide,"version">} guide @param {string} status @param {number|null} lastTransitionAt @param {Record<string,unknown>} extra */
  function guideRecord(guide, status = "unseen", lastTransitionAt = null, extra = {}) {
    return Object.freeze({ version: guide.version, status, lastTransitionAt, ...extra });
  }

/** @param {Prefs} uiPrefs @param {Guide} guide */
  function currentRecord(uiPrefs, guide) {
    const stored = guideStateOf(uiPrefs)[guide.id];
    if (!stored || typeof stored !== "object" || stored.version !== guide.version)
      return guideRecord(guide);
    return stored;
  }

/** @param {Guide} guide @param {{anchorPresent?:boolean,anchorVisible?:boolean,uiPrefs?:Prefs}} context */
export function evaluateGuide(guide, { anchorPresent = false, anchorVisible = false, uiPrefs = {} } = {}) {
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

/** @param {Prefs} uiPrefs @param {string} guideId @param {string} nextStatus @param {{nowMs?:number,version?:number}} options */
export function recordGuideTransition(uiPrefs, guideId, nextStatus, { nowMs = Date.now(), version = 1 } = {}) {
    if (!GUIDE_STATUSES.includes(nextStatus)) return uiPrefs;
    const base = uiPrefs && typeof uiPrefs === "object" ? { ...uiPrefs } : {};
    const guideState = {...guideStateOf(base)};
    guideState[guideId] = guideRecord({ version }, nextStatus, nowMs);
    base.guideState = guideState;
    return Object.freeze(base);
  }

/** @param {Prefs} uiPrefs @param {string} guideId @param {{nowMs?:number,version?:number}} options */
export function replayGuideState(uiPrefs, guideId, { nowMs = Date.now(), version = 1 } = {}) {
    const base = uiPrefs && typeof uiPrefs === "object" ? { ...uiPrefs } : {};
    const guideState = {...guideStateOf(base)};
    guideState[guideId] = guideRecord({ version }, "unseen", nowMs, { replayedAt: nowMs });
    base.guideState = guideState;
    return Object.freeze(base);
  }

/** @param {Prefs} uiPrefs @param {{definitions?:readonly Guide[],nowMs?:number}} options */
export function migrateLegacyTourDone(uiPrefs, { definitions = GUIDE_DEFINITIONS, nowMs = Date.now() } = {}) {
    const base = uiPrefs && typeof uiPrefs === "object" ? { ...uiPrefs } : {};
    const existing = guideStateOf(base);
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


export default Object.freeze({GUIDE_STATUSES,PLAN_054_GUIDE_IDS,PLAN_056_GUIDE_IDS,GUIDE_DEFINITIONS,evaluateGuide,recordGuideTransition,replayGuideState,migrateLegacyTourDone});
