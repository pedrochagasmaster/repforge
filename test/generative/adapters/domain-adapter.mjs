import {Setup,setupIdentity} from '../../interchange-runtime.mjs';
/**
 * Domain adapter for current browser-free production modules. The compiler,
 * metric definitions and full source UUID snapshot remain the schema owners.
 * app.js is intentionally not imported or scraped here.
 */
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import {Compiler,Metrics,Progression,Catalog as CATALOG_SNAPSHOT} from '../../fixtures/training-runtime.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

let cached;

export function loadDomain() {
  if (cached) return cached;

  setupIdentity.prepareCatalog(CATALOG_SNAPSHOT);
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
