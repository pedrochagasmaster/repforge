import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const rawSource = JSON.parse(await readFile(join(ROOT, "plans/067/data/app_file.json"), "utf8"));

test("a malformed but valid JSON detail asset is rejected before a snapshot is published", async () => {
  const modulePath = require.resolve("../exercise-catalog.js");
  delete require.cache[modulePath];
  delete globalThis.RepForgeExerciseCatalog;
  const catalog = require(modulePath);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => `${JSON.stringify({ exercises: [], uuidIndex: {}, generatedAt: "x" })}\n`,
  });
  try {
    await assert.rejects(catalog.load(), /integrity check/);
    assert.throws(() => catalog.snapshot(), /Await RepForgeExerciseCatalog\.load\(\)/,
      "a rejected asset is never published as the current source snapshot");
  } finally {
    globalThis.fetch = originalFetch;
    delete require.cache[modulePath];
    delete globalThis.RepForgeExerciseCatalog;
  }
});

test("catalog loads complete source values and exposes exact references", async () => {
  const catalog = require("../exercise-catalog.js");
  const generatedAssetText = await readFile(join(ROOT, "assets/exercise-catalog.json"), "utf8");
  const generatedAsset = JSON.parse(generatedAssetText);
  assert.deepEqual(generatedAsset, rawSource, "the generated compact asset preserves every source value");
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(String(url));
    if (calls.length === 1) return { ok: false };
    return { ok: true, text: async () => generatedAssetText };
  };

  try {
    const failed = catalog.load();
    const failedAgain = catalog.load();
    assert.equal(failed, failedAgain, "concurrent callers share a rejected load attempt");
    await assert.rejects(failed, /could not be loaded/);
    assert.equal(calls.length, 1, "a failed attempt is made once for all current callers");

    const first = catalog.load();
    const second = catalog.load();
    assert.equal(first, second, "all callers share the same load promise");
    await first;
    assert.equal(calls.length, 2, "a later caller retries a rejected fetch and then caches the success");
    assert.equal(calls[0], "./assets/exercise-catalog.json?v=067", "the catalog reads only its versioned local detail asset");
    assert.deepEqual(catalog.snapshot(), rawSource, "snapshot preserves the complete source object");

    const { exercises, uuidIndex } = catalog.snapshot();
    assert.equal(exercises.length, 1345);
    assert.equal(Object.keys(uuidIndex).length, 5301);
    assert.equal(new Set(Object.values(uuidIndex).map(value => value.type)).size, 22);

    const roleFields = [
      "strengthPrimaryCompoundRecommendationLevel",
      "strengthSecondaryCompoundRecommendationLevel",
      "strengthAccessoryRecommendationLevel",
      "hypertrophyPrimaryCompoundRecommendationLevel",
      "hypertrophySecondaryCompoundRecommendationLevel",
      "hypertrophyAccessoryRecommendationLevel",
    ];
    assert.equal(roleFields.reduce((sum, field) =>
      sum + exercises.filter(exercise => exercise[field] !== null).length, 0), 3057);
    assert.equal(new Set(exercises.flatMap(exercise => exercise.exerciseMetrics)).size, 11);

    for (const exercise of exercises) {
      assert.equal(catalog.getExercise(exercise.id), exercise);
      for (const value of Object.values(exercise)) {
        const ids = Array.isArray(value) ? value : [value];
        for (const id of ids) {
          if (typeof id === "string" && /^[0-9a-f]{32}$/.test(id))
            assert.ok(uuidIndex[id], `${exercise.name} references known UUID ${id}`);
        }
      }
    }
    assert.equal(catalog.getExercise("missing"), null);
    assert.equal(catalog.getObject("missing"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("metric and nullable source values retain their distinct meanings", async () => {
  const catalog = require("../exercise-catalog.js");
  await catalog.load();
  const metricless = [
    "3d65c6f170d8805fa510daa728d2044b",
    "3b15c6f170d880da9174c20b185cef90",
    "3b15c6f170d88023bf36c987ba0a7ad7",
  ];
  for (const id of metricless) assert.deepEqual(catalog.metricsFor(id), []);
  assert.equal(catalog.metricsFor("unknown-exercise"), null);

  const zeroBodyweight = rawSource.exercises.find(exercise => exercise.bodyweight === 0);
  assert.ok(zeroBodyweight, "the source contains explicit zero bodyweight contributions");
  assert.equal(catalog.getExercise(zeroBodyweight.id).bodyweight, 0);

  const nullableTier = rawSource.exercises.find(exercise =>
    exercise.strengthPrimaryCompoundRecommendationLevel === null);
  assert.equal(catalog.getExercise(nullableTier.id).strengthPrimaryCompoundRecommendationLevel, null);

  const weightMetricId = "2555c6f170d8805cafa6d16d3fdddbaa";
  const weightedExercise = rawSource.exercises.find(exercise => exercise.exerciseMetrics.includes(weightMetricId));
  const weightMetric = catalog.metricsFor(weightedExercise.id).find(metric => metric.name === "Weight");
  assert.ok(weightMetric, "metricsFor resolves the source UUID to its raw metric object");
});

test("unknown and prototype property names never resolve as UUID objects", async () => {
  const catalog = require("../exercise-catalog.js");
  await catalog.load();
  for (const id of ["unknown-uuid", "__proto__", "constructor", "toString"]) {
    assert.equal(catalog.getObject(id), null, `${id} is not an inherited uuidIndex object`);
    assert.equal(catalog.getExercise(id), null, `${id} is not an exercise UUID`);
    assert.equal(catalog.metricsFor(id), null, `${id} has no exercise metrics`);
  }
});

test("equipment alternatives use OR, groups use AND, support remains required, and plural links close transitively", async () => {
  const catalog = require("../exercise-catalog.js");
  await catalog.load();
  const exercise = catalog.getExercise("1a05c6f170d880ccbf5aeb7f1b3fcee5");
  const [smithGroupId, trainerId] = exercise.resistanceEquipmentGroupIds;
  const [benchId] = exercise.supportEquipmentGroupIds;
  const smithGroup = catalog.getObject(smithGroupId);

  assert.equal(smithGroup.type, "resistanceEquipmentGroup");
  assert.equal(smithGroup.equipment.length, 2);
  assert.equal(catalog.isAvailable(exercise, [...smithGroup.equipment, benchId]), true,
    "one satisfied resistance alternative plus support makes the movement available");
  assert.equal(catalog.isAvailable(exercise, [trainerId, benchId]), true,
    "the direct alternative works without the other alternative");
  assert.equal(catalog.isAvailable(exercise, [smithGroup.equipment[0], benchId]), false,
    "a referenced equipment group requires every member");
  assert.equal(catalog.isAvailable(exercise, [...smithGroup.equipment]), false,
    "resistance equipment cannot bypass the support requirement");
  assert.equal(catalog.isAvailable(exercise, [trainerId]), false,
    "a resistance alternative cannot bypass the support requirement");
  assert.equal(catalog.isAvailable(exercise, []), false,
    "preferred status cannot bypass both equipment conditions");

  const pluralId = "19e5c6f170d8808593d8ecf408c4f749";
  const singularId = "25a5c6f170d880589ffdf4f627a75b44";
  const nextSingularId = "25a5c6f170d880c1a55ac08cf52671ab";
  const snapshot = catalog.snapshot();
  const nextSingular = catalog.getObject(singularId);
  const originalPluralOf = nextSingular.pluralOf;
  try {
    nextSingular.pluralOf = nextSingularId;
    const closure = catalog.equipmentClosure([pluralId]);
    assert.ok(closure.has(pluralId));
    assert.ok(closure.has(singularId));
    assert.ok(closure.has(nextSingularId), "pluralOf links are followed transitively");
    assert.ok(catalog.equipmentClosure(new Set([pluralId])).has(singularId),
      "equipment profiles can pass their IDs as a Set");
  } finally {
    nextSingular.pluralOf = originalPluralOf;
  }
});

test("the synchronous library index keeps canonical UUID identity and resolves canonical names before aliases", async () => {
  const { EXERCISE_LIBRARY, LEGACY_LIBRARY_IDS } = require("../exercises.js");
  const catalog = require("../exercise-catalog.js");
  await catalog.load();
  assert.equal(EXERCISE_LIBRARY.length, 1345);
  assert.deepEqual(LEGACY_LIBRARY_IDS, {}, "retired IDs are not repointed at new catalog entries");
  assert.equal(EXERCISE_LIBRARY[0].id.length, 32);
  assert.ok(EXERCISE_LIBRARY.every(exercise => [
    "aliases", "id", "media", "mediaBg", "name", "namePt",
  ].every(key => Object.hasOwn(exercise, key))));
  assert.equal(catalog.getExercise("sq_bb"), null, "a retired short ID does not resolve to a new movement");

  const canonical = EXERCISE_LIBRARY.find(exercise => exercise.id === "19f5c6f170d8808bb424e98de4472a7e");
  const second = EXERCISE_LIBRARY.find(exercise => exercise.id === "1a05c6f170d8803ba48ec1443eab5978");
  assert.deepEqual(catalog.resolveName(canonical.name), {
    kind: "matched", by: "canonical", exercise: canonical,
  });
  const supino = catalog.resolveName("Supino");
  assert.equal(supino.kind, "ambiguous",
    "a Portuguese alias shared by distinct movements requires disambiguation");
  assert.ok(["19f5c6f170d8808bb424e98de4472a7e", "1a05c6f170d8803ba48ec1443eab5978",
    "1a05c6f170d88058a3a0c07e098a9605"].every(id => supino.exercises.some(exercise => exercise.id === id)));
  assert.equal(catalog.resolveName("RDL").kind, "ambiguous",
    "the same abbreviation across equipment variants remains ambiguous");
  assert.ok(catalog.search("supino").length >= 3, "search derives terms from canonical names and aliases");

  const priorAliases = second.aliases;
  second.aliases = [...priorAliases, canonical.name];
  try {
    const collision = catalog.resolveName(canonical.name);
    assert.equal(collision.kind, "matched");
    assert.equal(collision.by, "canonical");
    assert.equal(collision.exercise.id, canonical.id,
      "a canonical identity wins when another movement claims its name as an alias");
  } finally {
    second.aliases = priorAliases;
  }
});
