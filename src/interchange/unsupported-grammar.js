/** Recognized lossy freeform concepts; never infer unsupported training rules. */
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

  /** @param {unknown} sidecar @param {readonly string[]} allowedCategories @returns {string[]} */
  function recognized(sidecar, allowedCategories) {
    if (!Array.isArray(sidecar)) return [];
    const allowed = new Set(allowedCategories);
    return sidecar.filter(item => typeof item === "string" && allowed.has(item));
  }

  /** @param {unknown} sidecar @returns {string[]} */
  function normalize(sidecar) {
    const found = new Set(recognized(sidecar, CATEGORIES));
    return CATEGORIES.filter(category => found.has(category));
  }

  /** @param {unknown} sidecar @param {readonly string[]} displayCategories */
  function recognizedForDisplay(sidecar, displayCategories) {
    return recognized(sidecar, displayCategories);
  }

export {CATEGORIES,normalize,recognizedForDisplay};
