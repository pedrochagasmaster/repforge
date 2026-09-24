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

  function dedupeKnown(sidecar, allowedCategories) {
    if (!Array.isArray(sidecar)) return [];
    const allowed = new Set(allowedCategories);
    const found = new Set();
    for (const item of sidecar) {
      if (typeof item === "string" && allowed.has(item)) found.add(item);
    }
    return [...found];
  }

  function normalize(sidecar) {
    const found = new Set(dedupeKnown(sidecar, CATEGORIES));
    return CATEGORIES.filter(category => found.has(category));
  }

  function normalizeForDisplay(sidecar, displayCategories) {
    return dedupeKnown(sidecar, displayCategories);
  }

  return Object.freeze({ CATEGORIES, normalize, normalizeForDisplay });
});
