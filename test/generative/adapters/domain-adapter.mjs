/**
 * Domain adapter for current browser-free production modules. The compiler,
 * metric definitions and full source UUID snapshot remain the schema owners.
 * app.js is intentionally not imported or scraped here.
 */
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function requireRoot(file) {
  return createRequire(import.meta.url)(join(ROOT, file));
}

let cached;

export function loadDomain() {
  if (cached) return cached;
  const Setup = requireRoot("shared-setup.js");
  const Progression = requireRoot("progression-engine.js");
  const Compiler = requireRoot("program-compiler.js");
  const Metrics = requireRoot("exercise-metrics.js");
  const CATALOG_SNAPSHOT = JSON.parse(readFileSync(join(ROOT, "assets/exercise-catalog.json"), "utf8"));
  const EXERCISES_BY_ID = new Map(CATALOG_SNAPSHOT.exercises.map((entry) => [entry.id, entry]));
  const BUILT_IN_IDS = new Set(EXERCISES_BY_ID.keys());
  const RAW_EQUIPMENT_IDS = Object.entries(CATALOG_SNAPSHOT.uuidIndex)
    .filter(([, entry]) => entry?.type === "equipment")
    .map(([id]) => id)
    .sort();
  cached = {
    ROOT,
    Setup,
    Progression,
    Compiler,
    Metrics,
    CATALOG_SNAPSHOT,
    EXERCISES_BY_ID,
    BUILT_IN_IDS,
    BUILT_IN_ID_LIST: [...BUILT_IN_IDS].sort(),
    RAW_EQUIPMENT_IDS,
    METRIC_MOVEMENT_IDS: CATALOG_SNAPSHOT.exercises
      .filter((entry) => Array.isArray(entry.exerciseMetrics) && entry.exerciseMetrics.length > 0)
      .map((entry) => entry.id),
    /** The same full snapshot and compiler boundary the production share path uses. */
    opts() {
      return {
        builtInIds: this.BUILT_IN_IDS,
        catalogSnapshot: this.CATALOG_SNAPSHOT,
        validateProgramDefinition: this.Compiler.validateProgramDefinition,
      };
    },
  };
  return cached;
}
