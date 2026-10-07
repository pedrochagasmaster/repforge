#!/usr/bin/env node
/* Generate the synchronous exercise search index and the lazy raw catalog
   asset from Plan 067's committed corpus. This script has no dependencies. */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const SOURCE_PATH = join(ROOT, "plans/067/data/app_file.json");
const CURATION_PATH = join(HERE, "exercise-catalog-curation.json");
const MEDIA_BG_PATH = join(HERE, "exercise-media-bg.json");
const INDEX_PATH = join(ROOT, "exercises.js");
const ASSET_PATH = join(ROOT, "assets/exercise-catalog.json");
const args = new Set(process.argv.slice(2));

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function normalize(value) {
  return String(value || "").normalize("NFKC").trim().toLocaleLowerCase("en");
}

function uniqueStrings(values) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const text = String(value || "").trim();
    const key = normalize(text);
    if (!text || seen.has(key)) continue;
    seen.add(key);
    output.push(text);
  }
  return output;
}

function main() {
  const source = readJson(SOURCE_PATH);
  const curation = readJson(CURATION_PATH);
  const mediaBg = readJson(MEDIA_BG_PATH);
  const problems = [];

  if (curation.schemaVersion !== 1) problems.push("curation schemaVersion must be 1");
  if (curation.source !== "plans/067/data/app_file.json") problems.push("curation source must name the Plan 067 raw corpus");
  if (!Array.isArray(source.exercises) || source.exercises.length !== 1345) problems.push("source must contain exactly 1,345 exercises");
  if (!source.uuidIndex || Object.keys(source.uuidIndex).length !== 5301) problems.push("source must contain exactly 5,301 UUID objects");

  const exercisesById = new Map((source.exercises || []).map(exercise => [exercise.id, exercise]));
  const mediaIds = new Set();
  const curatedIds = new Set();
  const roleFields = [
    "strengthPrimaryCompoundRecommendationLevel",
    "strengthSecondaryCompoundRecommendationLevel",
    "strengthAccessoryRecommendationLevel",
    "hypertrophyPrimaryCompoundRecommendationLevel",
    "hypertrophySecondaryCompoundRecommendationLevel",
    "hypertrophyAccessoryRecommendationLevel",
  ];

  for (const [id, entry] of Object.entries(curation.entries || {})) {
    const exercise = exercisesById.get(id);
    if (!exercise) {
      problems.push(`${id}: curation entry does not refer to a current raw exercise UUID`);
      continue;
    }
    curatedIds.add(id);
    if (entry.sourceName !== exercise.name) problems.push(`${id}: canonical source name changed; review this mapping before regeneration`);
    if (typeof entry.namePt !== "string" || !entry.namePt.trim()) problems.push(`${id}: namePt must be a reviewed non-empty display name`);
    if (!Array.isArray(entry.aliases)) problems.push(`${id}: aliases must be an array`);
    const seenAliases = new Set();
    for (const alias of entry.aliases || []) {
      if (typeof alias !== "string" || !alias.trim()) {
        problems.push(`${id}: aliases must contain non-empty strings`);
        continue;
      }
      const key = normalize(alias);
      if (seenAliases.has(key)) problems.push(`${id}: duplicate alias ${JSON.stringify(alias)}`);
      seenAliases.add(key);
    }

    if (entry.mediaId !== undefined) {
      if (mediaIds.has(entry.mediaId)) problems.push(`${id}: media ${entry.mediaId} is mapped more than once`);
      mediaIds.add(entry.mediaId);
      const mediaPath = join(ROOT, "assets/exercises", `${entry.mediaId}.webp`);
      if (!existsSync(mediaPath)) problems.push(`${id}: mapped media file is missing (${mediaPath})`);
      if (!/^#[0-9a-f]{6}$/.test(String(mediaBg[entry.mediaId] || "")))
        problems.push(`${id}: mapped media has no reviewed sampled background`);
    }
  }

  if (mediaIds.size !== 20) problems.push(`expected 20 reviewed exact-movement media mappings, found ${mediaIds.size}`);
  for (const id of Object.keys(mediaBg))
    if (!mediaIds.has(id) && !existsSync(join(ROOT, "assets/exercises", `${id}.webp`)))
      problems.push(`${id}: sampled media background points at a missing asset`);

  for (const exercise of source.exercises || []) {
    if (source.uuidIndex[exercise.id]?.type !== "exercise") problems.push(`${exercise.id}: UUID index must retain its exercise object`);
    for (const alternativeId of exercise.alternativeName || [])
      if (source.uuidIndex[alternativeId]?.type !== "alternativeName") problems.push(`${exercise.id}: alternative name ${alternativeId} has the wrong reference type`);
    for (const field of ["exerciseType", "rom", "stability", "regionTrained"])
      if (exercise[field] != null && !source.uuidIndex[exercise[field]]) problems.push(`${exercise.id}: ${field} points at missing UUID ${exercise[field]}`);
    for (const field of [
      "exerciseMetrics", "primaryJointAction", "secondaryJointAction", "primaryFeatureMuscle",
      "secondaryFeatureMuscle", "primaryMuscle", "secondaryMuscle", "emphasizedAgonist",
      "deemphasizedAgonist", "preconditions", "stretchedMuscle", "laterality", "movementPattern",
      "exerciseGroup", "exclusionGroupings", "resistanceEquipmentGroupIds", "supportEquipmentGroupIds",
      "exerciseClassificationStrength", "exerciseClassificationHypertrophy", "exerciseNote",
    ]) {
      for (const id of exercise[field] || []) {
        if (!source.uuidIndex[id]) problems.push(`${exercise.id}: ${field} points at missing UUID ${id}`);
      }
    }
    for (const field of roleFields)
      if (exercise[field] !== null && typeof exercise[field] !== "number") problems.push(`${exercise.id}: ${field} must remain a number or null`);
  }

  if (problems.length) {
    console.error(`${problems.length} catalog problems — nothing written:`);
    for (const problem of problems) console.error(`  ${problem}`);
    process.exitCode = 1;
    return;
  }

  const rows = source.exercises.map(exercise => {
    const reviewed = curation.entries[exercise.id] || null;
    const sourceAliases = uniqueStrings((exercise.alternativeName || [])
      .map(id => source.uuidIndex[id]?.name)
      .filter(Boolean));
    const namePt = reviewed?.namePt || exercise.name;
    const aliases = uniqueStrings([...(reviewed?.aliases || []), ...sourceAliases]);
    const row = {
      id: exercise.id,
      name: exercise.name,
      namePt,
      aliases,
      searchBoostValue: exercise.searchBoostValue,
    };
    if (reviewed?.mediaId) {
      row.media = `assets/exercises/${reviewed.mediaId}.webp`;
      row.mediaBg = mediaBg[reviewed.mediaId];
    } else {
      row.media = null;
      row.mediaBg = null;
    }
    return row;
  });

  rows.sort((a, b) => {
    const left = normalize(a.name);
    const right = normalize(b.name);
    return left < right ? -1 : left > right ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const asset = `${JSON.stringify(source)}\n`;
  const catalogSha256 = createHash("sha256").update(asset, "utf8").digest("hex");
  const index = `/* Taurifer exercise search index — GENERATED by tools/build-exercises.mjs.
   Edit tools/exercise-catalog-curation.json, then regenerate. Full source
   details load on demand from assets/exercise-catalog.json. Its exact source
   bytes are pinned here so a catalog from another release cannot boot. */
(function(){
"use strict";
const EXERCISE_CATALOG_SHA256 = ${JSON.stringify(catalogSha256)};
const EXERCISE_LIBRARY = [
${rows.map(row => `  ${JSON.stringify(row)}`).join(",\n")}
];
const LEGACY_LIBRARY_IDS = {};
if (typeof window !== "undefined") window.RepForgeExercises = {library: EXERCISE_LIBRARY, legacyIds: LEGACY_LIBRARY_IDS, catalogSha256: EXERCISE_CATALOG_SHA256};
if (typeof module !== "undefined" && module.exports) module.exports = {EXERCISE_LIBRARY, LEGACY_LIBRARY_IDS, EXERCISE_CATALOG_SHA256};
})();
`;
  const outputs = [[INDEX_PATH, index], [ASSET_PATH, asset]];

  if (args.has("--report")) {
    console.log(`${rows.length} exercise records, ${mediaIds.size} reviewed media mappings, ${curatedIds.size} Portuguese display records`);
    console.log(`raw details: ${Buffer.byteLength(asset)} bytes; search index: ${Buffer.byteLength(index)} bytes`);
    return;
  }

  if (args.has("--check")) {
    const stale = outputs.filter(([path, expected]) => !existsSync(path) || readFileSync(path, "utf8") !== expected);
    if (stale.length) {
      console.error(`generated catalog files are stale: ${stale.map(([path]) => path).join(", ")}`);
      process.exitCode = 1;
      return;
    }
    console.log(`catalog generated files match ${source.exercises.length} exercises and ${mediaIds.size} reviewed media mappings`);
    return;
  }

  for (const [path, contents] of outputs) writeFileSync(path, contents);
  console.log(`exercises.js — ${rows.length} UUID records; assets/exercise-catalog.json — ${mediaIds.size} reviewed media mappings`);
}

main();
