#!/usr/bin/env node
/* Vendor the Gym visual exercise animations that show a catalog movement.

   The animations come from a local clone of hasaneyldrm/exercises-dataset at the
   commit pinned below. Which animation shows which movement is a reviewed
   decision, recorded per catalog UUID in tools/exercise-gif-matches.json with
   its tier (`exact` or `variant`) and a one-line reason; the rule the reviewers
   applied is in tools/README.md. Several movements may share one animation.

   The result is the committed manifest tools/exercise-gifs.json, one file per
   animation used under assets/exercise-gifs/, and, because lists show a still
   rather than a moving picture, each animation's first frame (lossless, the same
   180×180) under assets/exercise-stills/ (needs ffmpeg). Licence terms:
   NOTICE.md.

     node tools/vendor-exercise-gifs.mjs <path-to-dataset-clone>   # regenerate
     node tools/vendor-exercise-gifs.mjs --check                   # offline verify */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const SOURCE_PATH = join(ROOT, "plans/067/data/app_file.json");
const MATCHES_PATH = join(HERE, "exercise-gif-matches.json");
const MANIFEST_PATH = join(HERE, "exercise-gifs.json");
const GIF_DIR = join(ROOT, "assets/exercise-gifs");
const STILL_DIR = join(ROOT, "assets/exercise-stills");

export const DATASET_REPOSITORY = "https://github.com/hasaneyldrm/exercises-dataset";
export const DATASET_COMMIT = "7455efae41b330c265e7cd4b78dfa848e7ce5ebd";
export const ATTRIBUTION = "© Gym visual — https://gymvisual.com/";
export const GIF_SIZE = 180;
export const TIERS = ["exact", "variant", "similar"];
/** What a `similar` animation shows differently, one or two per match. The app
   prints them under the animation (`media.shown.*` strings), so the set is
   closed: a new code needs its strings first. */
export const DIFFERENCES = ["both_arms", "one_arm", "both_legs", "one_leg", "seated", "standing", "kneeling", "lying",
  "incline_bench", "flat_bench", "decline_bench", "barbell", "ez_bar", "dumbbells", "kettlebell", "cable", "machine",
  "band", "smith_machine", "bodyweight", "grip", "handle"];
/** What a still is drawn on: every source frame has a pure white ground. */
export const STILL_BG = "#ffffff";
export const stillPath = entry => `assets/exercise-stills/${entry.datasetId}.webp`;
export const gifPath = entry => `assets/exercise-gifs/${entry.datasetId}.gif`;

/** Width and height from a GIF's logical screen descriptor, or null when the bytes are not a GIF. */
export function gifSize(bytes) {
  if (bytes.length < 10 || !/^GIF8[79]a$/.test(bytes.subarray(0, 6).toString("latin1"))) return null;
  return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
}

export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const readJson = path => JSON.parse(readFileSync(path, "utf8"));

/** The committed manifest, or one with nothing in it when it is absent. */
export function readGifManifest() {
  return existsSync(MANIFEST_PATH) ? readJson(MANIFEST_PATH) : { files: {}, entries: {} };
}

/** The reviewed matches, or none when the file is absent. */
export function readGifMatches() {
  return existsSync(MATCHES_PATH) ? readJson(MATCHES_PATH) : { entries: {} };
}

/** Every problem with the reviewed matches on their own; empty when they are well formed. */
export function checkGifMatches(matches = readGifMatches()) {
  const problems = [];
  const names = new Map(readJson(SOURCE_PATH).exercises.map(exercise => [exercise.id, exercise.name]));
  if (matches.schemaVersion !== 1) problems.push("matches schemaVersion must be 1");
  for (const [id, match] of Object.entries(matches.entries || {})) {
    if (!names.has(id)) { problems.push(`${id}: not a catalog movement`); continue; }
    if (names.get(id) !== match.sourceName) problems.push(`${id}: catalog name changed from "${match.sourceName}"; review the match again`);
    if (!/^\d{4}$/.test(String(match.datasetId))) problems.push(`${id}: datasetId must be four digits`);
    if (typeof match.datasetName !== "string" || !match.datasetName) problems.push(`${id}: datasetName is missing`);
    if (!TIERS.includes(match.tier)) problems.push(`${id}: tier must be one of ${TIERS.join(", ")}`);
    if (typeof match.why !== "string" || !match.why.trim()) problems.push(`${id}: every match records why`);
    const differences = match.differences || [];
    if (match.tier === "similar" ? differences.length < 1 || differences.length > 2 : differences.length)
      problems.push(`${id}: a similar match names one or two differences; an exact or variant match names none`);
    if (new Set(differences).size !== differences.length || differences.some(code => !DIFFERENCES.includes(code)))
      problems.push(`${id}: differences must be distinct codes from DIFFERENCES`);
  }
  return problems;
}

/** Every problem with the committed manifest and files; empty when they agree with the matches. */
export function checkVendoredGifs() {
  if (!existsSync(MANIFEST_PATH)) return ["tools/exercise-gifs.json is missing"];
  const manifest = readJson(MANIFEST_PATH);
  const matches = readGifMatches();
  const problems = checkGifMatches(matches);
  if (manifest.schemaVersion !== 3) problems.push("manifest schemaVersion must be 3");
  if (manifest.repository !== DATASET_REPOSITORY || manifest.commit !== DATASET_COMMIT) problems.push("manifest must name the pinned dataset commit");
  if (manifest.attribution !== ATTRIBUTION) problems.push("manifest must carry the Gym visual attribution verbatim");
  const files = manifest.files || {};
  const entries = manifest.entries || {};
  for (const [id, match] of Object.entries(matches.entries || {})) {
    const entry = entries[id];
    if (!entry || entry.datasetId !== match.datasetId || entry.sourceName !== match.sourceName || entry.tier !== match.tier ||
        JSON.stringify(entry.differences || []) !== JSON.stringify(match.differences || []))
      problems.push(`${id}: manifest does not match the reviewed match; re-run the vendoring tool`);
  }
  for (const id of Object.keys(entries)) if (!matches.entries?.[id]) problems.push(`${id}: manifest entry has no reviewed match`);
  const used = new Set(Object.values(entries).map(entry => entry.datasetId));
  for (const datasetId of used) if (!files[datasetId]) problems.push(`${datasetId}: used by a movement but not vendored`);
  for (const [datasetId, file] of Object.entries(files)) {
    if (!used.has(datasetId)) problems.push(`${datasetId}: vendored but no movement uses it`);
    const gif = join(GIF_DIR, `${datasetId}.gif`);
    if (!existsSync(gif)) { problems.push(`${datasetId}.gif is missing`); continue; }
    const bytes = readFileSync(gif);
    const size = gifSize(bytes);
    if (!size || size.width !== GIF_SIZE || size.height !== GIF_SIZE) problems.push(`${datasetId}.gif must be a ${GIF_SIZE}×${GIF_SIZE} GIF`);
    if (sha256(bytes) !== file.sha256) problems.push(`${datasetId}.gif does not match its recorded hash`);
    const still = join(STILL_DIR, `${datasetId}.webp`);
    if (!existsSync(still)) problems.push(`${datasetId}.webp still is missing`);
    else if (sha256(readFileSync(still)) !== file.stillSha256) problems.push(`${datasetId}.webp still does not match its recorded hash`);
  }
  for (const [dir, ext] of [[GIF_DIR, ".gif"], [STILL_DIR, ".webp"]])
    for (const name of existsSync(dir) ? readdirSync(dir) : [])
      if (!name.endsWith(ext) || !files[name.slice(0, -ext.length)]) problems.push(`${dir.slice(ROOT.length + 1)}/${name} has no manifest entry`);
  return problems;
}

function vendor(clone) {
  const head = execFileSync("git", ["-C", clone, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (head !== DATASET_COMMIT) throw new Error(`dataset clone is at ${head}; expected the pinned ${DATASET_COMMIT}`);
  const matches = readGifMatches();
  const problems = checkGifMatches(matches);
  if (problems.length) throw new Error(`reviewed matches are not well formed:\n  ${problems.join("\n  ")}`);
  const dataset = new Map(readJson(join(clone, "data/exercises.json")).map(record => [record.id, record]));
  const videos = readdirSync(join(clone, "videos"));
  rmSync(GIF_DIR, { recursive: true, force: true });
  rmSync(STILL_DIR, { recursive: true, force: true });
  mkdirSync(GIF_DIR, { recursive: true });
  mkdirSync(STILL_DIR, { recursive: true });
  const files = {};
  const entries = {};
  for (const id of Object.keys(matches.entries).sort()) {
    const match = matches.entries[id];
    const record = dataset.get(match.datasetId);
    if (!record) throw new Error(`${id}: dataset has no record ${match.datasetId}`);
    if (record.name !== match.datasetName) throw new Error(`${id}: dataset ${match.datasetId} is "${record.name}", not "${match.datasetName}"`);
    if (record.attribution !== ATTRIBUTION) throw new Error(`${record.id}: unexpected attribution ${JSON.stringify(record.attribution)}`);
    if (!files[record.id]) {
      const candidates = videos.filter(file => file.startsWith(`${record.id}-`) && file.endsWith(".gif"));
      if (candidates.length !== 1) throw new Error(`${record.id}: expected exactly one source GIF, found ${candidates.length}`);
      const bytes = readFileSync(join(clone, "videos", candidates[0]));
      const size = gifSize(bytes);
      if (!size || size.width !== GIF_SIZE || size.height !== GIF_SIZE) throw new Error(`${record.id}: source is not a ${GIF_SIZE}×${GIF_SIZE} GIF`);
      const gif = join(GIF_DIR, `${record.id}.gif`);
      writeFileSync(gif, bytes);
      const still = join(STILL_DIR, `${record.id}.webp`);
      execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", gif, "-frames:v", "1",
        "-c:v", "libwebp", "-lossless", "1", "-compression_level", "6", still]);
      files[record.id] = { datasetName: record.name, sha256: sha256(bytes), stillSha256: sha256(readFileSync(still)) };
    }
    entries[id] = { sourceName: match.sourceName, datasetId: record.id, tier: match.tier,
      ...(match.differences?.length ? { differences: match.differences } : {}) };
  }
  const sortedFiles = Object.fromEntries(Object.keys(files).sort().map(key => [key, files[key]]));
  const manifest = { schemaVersion: 3, repository: DATASET_REPOSITORY, commit: DATASET_COMMIT, attribution: ATTRIBUTION, files: sortedFiles, entries };
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  const tiers = Object.values(entries).reduce((n, entry) => ({ ...n, [entry.tier]: (n[entry.tier] || 0) + 1 }), {});
  console.log(`${Object.keys(entries).length} movements (${TIERS.map(tier => `${tiers[tier] || 0} ${tier}`).join(", ")}) share ${Object.keys(files).length} animations`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: node tools/vendor-exercise-gifs.mjs <path-to-dataset-clone> | --check");
    process.exitCode = 1;
  } else if (arg === "--check") {
    const problems = checkVendoredGifs();
    if (problems.length) {
      console.error(`${problems.length} vendored animation problems:`);
      for (const problem of problems.slice(0, 40)) console.error(`  ${problem}`);
      process.exitCode = 1;
    } else console.log("vendored exercise animations match their reviewed matches");
  } else vendor(resolve(arg));
}
