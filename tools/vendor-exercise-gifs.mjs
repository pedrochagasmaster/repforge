#!/usr/bin/env node
/* Vendor the Gym visual exercise animations that match a catalog movement.

   The animations come from a local clone of hasaneyldrm/exercises-dataset at the
   commit pinned below. A movement matches only when its canonical catalog name
   equals exactly one dataset name after case and punctuation are folded; there
   is no fuzzy matching and no alias matching. The result is the committed
   manifest tools/exercise-gifs.json plus one file per match under
   assets/exercise-gifs/. Lists show a still instead of a moving picture, so
   each animation also gets its first frame, lossless and at the same 180×180,
   under assets/exercise-stills/ (needs ffmpeg). Usage and licence terms:
   NOTICE.md.

     node tools/vendor-exercise-gifs.mjs <path-to-dataset-clone>   # regenerate
     node tools/vendor-exercise-gifs.mjs --stills                  # re-derive the stills only
     node tools/vendor-exercise-gifs.mjs --check                   # offline verify */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const SOURCE_PATH = join(ROOT, "plans/067/data/app_file.json");
const MANIFEST_PATH = join(HERE, "exercise-gifs.json");
const GIF_DIR = join(ROOT, "assets/exercise-gifs");
const STILL_DIR = join(ROOT, "assets/exercise-stills");

export const DATASET_REPOSITORY = "https://github.com/hasaneyldrm/exercises-dataset";
export const DATASET_COMMIT = "7455efae41b330c265e7cd4b78dfa848e7ce5ebd";
export const ATTRIBUTION = "© Gym visual — https://gymvisual.com/";
export const GIF_SIZE = 180;
/** What a still is drawn on: every source frame has a pure white ground. */
export const STILL_BG = "#ffffff";
export const stillPath = entry => `assets/exercise-stills/${entry.datasetId}.webp`;
export const gifPath = entry => `assets/exercise-gifs/${entry.file}`;

/** The committed manifest, or one with no entries when it is absent. */
export function readGifManifest() {
  return existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) : { entries: {} };
}

/** Case and punctuation folded; nothing else. "Push-up" and "push up" are one name. */
export function foldName(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Width and height from a GIF's logical screen descriptor, or null when the bytes are not a GIF. */
export function gifSize(bytes) {
  if (bytes.length < 10 || !/^GIF8[79]a$/.test(bytes.subarray(0, 6).toString("latin1"))) return null;
  return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
}

export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

/** Every problem with the committed manifest and files; empty when they agree. */
export function checkVendoredGifs() {
  const problems = [];
  if (!existsSync(MANIFEST_PATH)) return ["tools/exercise-gifs.json is missing"];
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const source = JSON.parse(readFileSync(SOURCE_PATH, "utf8"));
  const names = new Map(source.exercises.map(exercise => [exercise.id, exercise.name]));
  if (manifest.schemaVersion !== 2) problems.push("manifest schemaVersion must be 2");
  if (manifest.repository !== DATASET_REPOSITORY || manifest.commit !== DATASET_COMMIT) problems.push("manifest must name the pinned dataset commit");
  if (manifest.attribution !== ATTRIBUTION) problems.push("manifest must carry the Gym visual attribution verbatim");
  const files = new Set();
  const stills = new Set();
  for (const [id, entry] of Object.entries(manifest.entries || {})) {
    if (names.get(id) !== entry.sourceName) problems.push(`${id}: catalog name changed; re-run the vendoring tool`);
    if (foldName(entry.sourceName) !== foldName(entry.datasetName)) problems.push(`${id}: dataset name is not an exact match`);
    if (!/^\d{4}$/.test(String(entry.datasetId)) || entry.file !== `${entry.datasetId}.gif`) problems.push(`${id}: file must be named after its dataset id`);
    if (files.has(entry.file)) problems.push(`${id}: ${entry.file} is mapped more than once`);
    files.add(entry.file);
    const path = join(GIF_DIR, String(entry.file));
    if (!existsSync(path)) { problems.push(`${id}: ${entry.file} is missing`); continue; }
    const bytes = readFileSync(path);
    const size = gifSize(bytes);
    if (!size || size.width !== GIF_SIZE || size.height !== GIF_SIZE) problems.push(`${id}: ${entry.file} must be a ${GIF_SIZE}×${GIF_SIZE} GIF`);
    if (sha256(bytes) !== entry.sha256) problems.push(`${id}: ${entry.file} does not match its recorded hash`);
    const still = join(STILL_DIR, `${entry.datasetId}.webp`);
    stills.add(`${entry.datasetId}.webp`);
    if (!existsSync(still)) problems.push(`${id}: still ${entry.datasetId}.webp is missing`);
    else if (sha256(readFileSync(still)) !== entry.stillSha256) problems.push(`${id}: still ${entry.datasetId}.webp does not match its recorded hash`);
  }
  for (const file of existsSync(STILL_DIR) ? readdirSync(STILL_DIR) : [])
    if (!stills.has(file)) problems.push(`assets/exercise-stills/${file} has no manifest entry`);
  const onDisk = existsSync(GIF_DIR) ? readdirSync(GIF_DIR) : [];
  for (const file of onDisk) if (!files.has(file)) problems.push(`assets/exercise-gifs/${file} has no manifest entry`);
  return problems;
}

/** Frame 0 of every vendored animation, lossless, and its hash into the manifest. */
function writeStills(entries) {
  rmSync(STILL_DIR, { recursive: true, force: true });
  mkdirSync(STILL_DIR, { recursive: true });
  for (const entry of Object.values(entries)) {
    const out = join(STILL_DIR, `${entry.datasetId}.webp`);
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", join(GIF_DIR, entry.file), "-frames:v", "1",
      "-c:v", "libwebp", "-lossless", "1", "-compression_level", "6", out]);
    entry.stillSha256 = sha256(readFileSync(out));
  }
}

function writeManifest(entries) {
  const manifest = { schemaVersion: 2, repository: DATASET_REPOSITORY, commit: DATASET_COMMIT, attribution: ATTRIBUTION, entries };
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}

function vendor(clone) {
  const head = execFileSync("git", ["-C", clone, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (head !== DATASET_COMMIT) throw new Error(`dataset clone is at ${head}; expected the pinned ${DATASET_COMMIT}`);
  const dataset = JSON.parse(readFileSync(join(clone, "data/exercises.json"), "utf8"));
  const source = JSON.parse(readFileSync(SOURCE_PATH, "utf8"));
  const byName = new Map();
  for (const record of dataset) {
    const key = foldName(record.name);
    byName.set(key, [...(byName.get(key) || []), record]);
  }
  const entries = {};
  const ambiguous = [];
  rmSync(GIF_DIR, { recursive: true, force: true });
  mkdirSync(GIF_DIR, { recursive: true });
  for (const exercise of [...source.exercises].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const hits = byName.get(foldName(exercise.name)) || [];
    if (hits.length > 1) ambiguous.push(exercise.name);
    if (hits.length !== 1) continue;
    const [record] = hits;
    if (record.attribution !== ATTRIBUTION) throw new Error(`${record.id}: unexpected attribution ${JSON.stringify(record.attribution)}`);
    const candidates = readdirSync(join(clone, "videos")).filter(file => file.startsWith(`${record.id}-`) && file.endsWith(".gif"));
    if (candidates.length !== 1) throw new Error(`${record.id}: expected exactly one source GIF, found ${candidates.length}`);
    const bytes = readFileSync(join(clone, "videos", candidates[0]));
    const size = gifSize(bytes);
    if (!size || size.width !== GIF_SIZE || size.height !== GIF_SIZE) throw new Error(`${record.id}: source is not a ${GIF_SIZE}×${GIF_SIZE} GIF`);
    const file = `${record.id}.gif`;
    writeFileSync(join(GIF_DIR, file), bytes);
    entries[exercise.id] = { sourceName: exercise.name, datasetId: record.id, datasetName: record.name, file, sha256: sha256(bytes) };
  }
  writeStills(entries);
  writeManifest(entries);
  console.log(`${Object.keys(entries).length} animations vendored; ${ambiguous.length} names skipped as ambiguous${ambiguous.length ? `: ${ambiguous.join(", ")}` : ""}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: node tools/vendor-exercise-gifs.mjs <path-to-dataset-clone> | --stills | --check");
    process.exitCode = 1;
  } else if (arg === "--check") {
    const problems = checkVendoredGifs();
    if (problems.length) {
      console.error(`${problems.length} vendored animation problems:`);
      for (const problem of problems) console.error(`  ${problem}`);
      process.exitCode = 1;
    } else console.log("vendored exercise animations match their manifest");
  } else if (arg === "--stills") {
    const { entries } = readGifManifest();
    writeStills(entries);
    writeManifest(entries);
    console.log(`${Object.keys(entries).length} stills derived`);
  } else vendor(resolve(arg));
}
