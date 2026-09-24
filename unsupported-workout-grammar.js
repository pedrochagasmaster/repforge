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

  function normalize(sidecar) {
    if (!Array.isArray(sidecar)) return [];
    const found = new Set();
    for (const item of sidecar) {
      if (typeof item === "string" && CATEGORY_SET.has(item)) found.add(item);
    }
    return CATEGORIES.filter(category => found.has(category));
  }

  return Object.freeze({ CATEGORIES, normalize });
});
