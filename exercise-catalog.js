/* Runtime access to the full local raw exercise catalog. The search index is
   available synchronously from exercises.js; this module fetches full detail
   data once when a caller first needs it. */
(function attachExerciseCatalog(root) {
  "use strict";

  const ASSET_URL = "./assets/exercise-catalog.json?v=067";
  let loadPromise = null;
  let rawCatalog = null;
  let exerciseById = null;

  function library() {
    if (root.RepForgeExercises && Array.isArray(root.RepForgeExercises.library))
      return root.RepForgeExercises.library;
    if (typeof require === "function") {
      const imported = require("./exercises.js");
      return Array.isArray(imported.EXERCISE_LIBRARY) ? imported.EXERCISE_LIBRARY : [];
    }
    return [];
  }

  function requireSnapshot() {
    if (!rawCatalog) throw new Error("Await RepForgeExerciseCatalog.load() before reading catalog details");
    return rawCatalog;
  }

  function validCatalog(value) {
    return value && typeof value === "object" && !Array.isArray(value) &&
      Array.isArray(value.exercises) && value.uuidIndex && typeof value.uuidIndex === "object" && !Array.isArray(value.uuidIndex) &&
      typeof value.generatedAt === "string";
  }

  function expectedCatalogSha256() {
    const browserPin = root.RepForgeExercises?.catalogSha256;
    if (typeof browserPin === "string") return browserPin;
    if (typeof require === "function") {
      const imported = require("./exercises.js");
      return imported.EXERCISE_CATALOG_SHA256;
    }
    return null;
  }

  async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    if (root.crypto?.subtle?.digest) {
      const digest = await root.crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
    }
    if (typeof require === "function")
      return require("node:crypto").createHash("sha256").update(text, "utf8").digest("hex");
    throw new Error("SHA-256 is unavailable for local exercise catalog verification");
  }

  function load() {
    if (!loadPromise) {
      const attempt = Promise.resolve().then(() => {
        if (typeof fetch !== "function") throw new Error("Fetch is unavailable for the local exercise catalog");
        return fetch(ASSET_URL);
      }).then(response => {
        if (!response || response.ok !== true) throw new Error("The local exercise catalog could not be loaded");
        if (typeof response.text !== "function") throw new Error("The local exercise catalog response has no text body");
        return response.text();
      }).then(async sourceText => {
        if (typeof sourceText !== "string") throw new Error("The local exercise catalog has an invalid body");
        const expected = expectedCatalogSha256();
        if (!/^[0-9a-f]{64}$/.test(String(expected || "")))
          throw new Error("The local exercise catalog has no release integrity pin");
        if (await sha256(sourceText) !== expected)
          throw new Error("The local exercise catalog failed its release integrity check");
        let value;
        try { value = JSON.parse(sourceText); }
        catch { throw new Error("The local exercise catalog is not valid JSON"); }
        if (!validCatalog(value)) throw new Error("The local exercise catalog has an invalid shape");
        rawCatalog = value;
        exerciseById = new Map(value.exercises.map(exercise => [exercise.id, exercise]));
        return value;
      });
      const retryable = attempt.catch(error => {
        if (loadPromise === retryable) loadPromise = null;
        throw error;
      });
      loadPromise = retryable;
    }
    return loadPromise;
  }

  function snapshot() {
    return requireSnapshot();
  }

  function getExercise(id) {
    requireSnapshot();
    if (typeof id !== "string") return null;
    return exerciseById.get(id) || null;
  }

  function getObject(id) {
    const data = requireSnapshot();
    if (typeof id !== "string") return null;
    return Object.hasOwn(data.uuidIndex, id) ? data.uuidIndex[id] : null;
  }

  function listExercises() {
    return library();
  }

  function equipmentClosure(ids) {
    const data = requireSnapshot();
    const queue = typeof ids === "string" ? [ids] :
      ids && typeof ids[Symbol.iterator] === "function" ? [...ids] : [];
    const closed = new Set();

    for (const id of queue) {
      let current = id;
      const chain = new Set();
      while (typeof current === "string" && !chain.has(current)) {
        chain.add(current);
        const equipment = Object.hasOwn(data.uuidIndex, current) ? data.uuidIndex[current] : null;
        if (!equipment || equipment.type !== "equipment") break;
        closed.add(current);
        current = equipment.pluralOf;
      }
    }
    return closed;
  }

  function requirementSatisfied(requirementId, availableEquipment, index) {
    const requirement = Object.hasOwn(index, requirementId) ? index[requirementId] : null;
    if (!requirement) return false;
    if (requirement.type === "equipment") return availableEquipment.has(requirementId);
    if (requirement.type === "resistanceEquipmentGroup" || requirement.type === "supportEquipmentGroup") {
      return Array.isArray(requirement.equipment) && requirement.equipment.length > 0 &&
        requirement.equipment.every(id => availableEquipment.has(id));
    }
    return false;
  }

  function alternativesSatisfied(requirements, availableEquipment, index) {
    if (!Array.isArray(requirements)) return false;
    if (requirements.length === 0) return true;
    return requirements.some(id => requirementSatisfied(id, availableEquipment, index));
  }

  function isAvailable(exercise, ids) {
    const data = requireSnapshot();
    const record = typeof exercise === "string" ? getExercise(exercise) : exercise;
    if (!record || typeof record !== "object") return false;
    const availableEquipment = equipmentClosure(ids);
    return alternativesSatisfied(record.resistanceEquipmentGroupIds, availableEquipment, data.uuidIndex) &&
      alternativesSatisfied(record.supportEquipmentGroupIds, availableEquipment, data.uuidIndex);
  }

  function metricsFor(id) {
    const exercise = getExercise(id);
    if (!exercise) return null;
    if (!Array.isArray(exercise.exerciseMetrics)) return null;
    const data = requireSnapshot();
    const metrics = exercise.exerciseMetrics.map(metricId =>
      Object.hasOwn(data.uuidIndex, metricId) ? data.uuidIndex[metricId] : null);
    if (metrics.some(metric => !metric || metric.type !== "exerciseMetric")) return null;
    return metrics;
  }

  function normalizeName(value) {
    return typeof value === "string" ? value.normalize("NFKC").trim().toLocaleLowerCase("en") : "";
  }

  function resolveName(name) {
    const query = normalizeName(name);
    if (!query) return { kind: "not-found", by: null, exercises: [] };
    const entries = library();
    const canonical = entries.filter(exercise => normalizeName(exercise.name) === query);
    if (canonical.length === 1) return { kind: "matched", by: "canonical", exercise: canonical[0] };
    if (canonical.length > 1) return { kind: "ambiguous", by: "canonical", exercises: canonical };

    const aliases = entries.filter(exercise =>
      [exercise.namePt, ...(exercise.aliases || [])]
        .some(alias => normalizeName(alias) === query));
    if (aliases.length === 1) return { kind: "matched", by: "alias", exercise: aliases[0] };
    if (aliases.length > 1) return { kind: "ambiguous", by: "alias", exercises: aliases };
    return { kind: "not-found", by: null, exercises: [] };
  }

  function search(query) {
    const needle = normalizeName(query);
    if (!needle) return [];
    return library().filter(exercise =>
      [exercise.name, exercise.namePt, ...(exercise.aliases || [])]
        .some(term => normalizeName(term).includes(needle)));
  }

  const api = {
    load,
    snapshot,
    getExercise,
    getObject,
    listExercises,
    equipmentClosure,
    isAvailable,
    metricsFor,
    resolveName,
    search,
  };

  root.RepForgeExerciseCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis === "undefined" ? this : globalThis);
