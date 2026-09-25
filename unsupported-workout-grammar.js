(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RepForgeUnsupportedWorkoutGrammar = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CATEGORIES = Object.freeze([
    "supersets",
    "rest_times",
    "rir_rpe",
    "tempo",
    "warmups",
    "cardio",
    "progression_rules",
    "deload",
  ]);
  const CATEGORY_SET = new Set(CATEGORIES);

  function recognized(sidecar, allowedCategories) {
    if (!Array.isArray(sidecar)) return [];
    const allowed = new Set(allowedCategories);
    return sidecar.filter(item => typeof item === "string" && allowed.has(item));
  }

  function normalize(sidecar) {
    const found = new Set(recognized(sidecar, CATEGORIES));
    return CATEGORIES.filter(category => found.has(category));
  }

  function recognizedForDisplay(sidecar, displayCategories) {
    return recognized(sidecar, displayCategories);
  }

  return Object.freeze({ CATEGORIES, normalize, recognizedForDisplay });
});
