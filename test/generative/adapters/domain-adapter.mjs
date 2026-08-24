/**
 * Domain adapter — the Node-reachable test surface Taurifer exposes today.
 *
 * Phase 1 of the generative architecture runs against pure, browser-free
 * modules only. Anything that still lives inside app.js (progression,
 * backup import/export, workout transitions) is listed in ../README.md as
 * pending seams and must not be scraped out of app.js internals here.
 */
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function requireRoot(file) {
  return createRequire(import.meta.url)(join(ROOT, file));
}

let cached;

export function loadDomain() {
  if (cached) return cached;
  const Setup = requireRoot("shared-setup.js");
  const { EXERCISE_LIBRARY, LEGACY_LIBRARY_IDS } = requireRoot("exercises.js");
  cached = {
    ROOT,
    Setup,
    EXERCISE_LIBRARY,
    LEGACY_LIBRARY_IDS,
    BUILT_IN_IDS: new Set(EXERCISE_LIBRARY.map((entry) => entry.id)),
    /** Options matching how app.js resolves received built-in ids. */
    opts() {
      return { builtInIds: this.BUILT_IN_IDS };
    },
  };
  return cached;
}
