#!/usr/bin/env node
/* Regenerate `vendor/motion/motion.js` — the pinned Motion runtime the app ships.
 *
 * Taurifer has no build step and no application dependencies. Motion is the one
 * third-party runtime the app loads, so it is treated the way `exercises.js` and
 * `i18n.js` are: generated offline by a tool, committed, and gated for drift.
 * The browser never resolves a package or reaches a CDN — it loads a file that
 * lives in this repository and in the service worker's precache.
 *
 * Two modes:
 *
 *   node tools/build-motion-runtime.mjs
 *       Bundles `tools/motion-runtime/entry.mjs` with the pinned esbuild and
 *       Motion from `tools/motion-runtime/node_modules` (run `npm ci` there
 *       first), writes the bundle and refreshes the pin file.
 *
 *   node tools/build-motion-runtime.mjs --check
 *       Offline. Re-hashes the committed bundle and compares it to the pin.
 *       This is what CI runs: it needs no network and no node_modules, and it
 *       fails the moment somebody hand-edits vendored third-party code.
 *
 * Upgrading Motion means editing `tools/motion-runtime/package.json`, running
 * `npm install` there, re-running this tool, and re-reading the interaction
 * audit — a new runtime can change gesture feel even when no app code moved.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUILD_DIR = join(ROOT, "tools", "motion-runtime");
const ENTRY = join(BUILD_DIR, "entry.mjs");
const OUT = join(ROOT, "vendor", "motion", "motion.js");
const PIN = join(ROOT, "vendor", "motion", "motion.pin.json");

const sha256 = text => createHash("sha256").update(text, "utf8").digest("hex");

/* The global the app reads. Kept identical to Motion's own UMD build so the
   vendored bundle stays a drop-in for the published one. */
const GLOBAL_NAME = "Motion";

function pinnedVersions() {
  const manifest = JSON.parse(readFileSync(join(BUILD_DIR, "package.json"), "utf8"));
  const { motion, esbuild } = manifest.dependencies;
  if (!/^\d+\.\d+\.\d+$/.test(motion) || !/^\d+\.\d+\.\d+$/.test(esbuild)) {
    throw new Error(`motion and esbuild must be pinned to exact versions, got motion@${motion} esbuild@${esbuild}`);
  }
  return { motion, esbuild };
}

function header({ motion, esbuild }) {
  return `/* Motion ${motion} — vendored runtime for Taurifer. Generated file: do not edit.
   Source: https://www.npmjs.com/package/motion (MIT, Framer B.V.)
   Regenerate with: node tools/build-motion-runtime.mjs
   Exports bundled: see tools/motion-runtime/entry.mjs
   Bundler: esbuild ${esbuild}, iife, target es2020, global "${GLOBAL_NAME}" */
`;
}

function check() {
  if (!existsSync(OUT) || !existsSync(PIN)) {
    console.error("vendor/motion is missing — run node tools/build-motion-runtime.mjs");
    process.exit(1);
  }
  const pin = JSON.parse(readFileSync(PIN, "utf8"));
  const bundle = readFileSync(OUT, "utf8");
  const actual = sha256(bundle);
  const versions = pinnedVersions();

  const problems = [];
  if (actual !== pin.sha256) problems.push(`bundle sha256 ${actual} does not match pin ${pin.sha256}`);
  if (pin.motion !== versions.motion) problems.push(`pin records motion@${pin.motion}, package.json pins ${versions.motion}`);
  if (pin.esbuild !== versions.esbuild) problems.push(`pin records esbuild@${pin.esbuild}, package.json pins ${versions.esbuild}`);
  if (pin.bytes !== Buffer.byteLength(bundle, "utf8")) problems.push(`pin records ${pin.bytes} bytes, file is ${Buffer.byteLength(bundle, "utf8")}`);
  if (!bundle.includes(`Motion ${versions.motion} —`)) problems.push("bundle header does not name the pinned Motion version");

  if (problems.length) {
    for (const problem of problems) console.error(`  ✗ ${problem}`);
    console.error("vendored Motion runtime is out of date — run node tools/build-motion-runtime.mjs");
    process.exit(1);
  }
  console.log(`vendored Motion runtime matches its pin (motion@${pin.motion}, ${pin.bytes} bytes, sha256 ${pin.sha256.slice(0, 12)}…)`);
}

function build() {
  const versions = pinnedVersions();
  const esbuildBin = join(BUILD_DIR, "node_modules", ".bin", "esbuild");
  if (!existsSync(esbuildBin)) {
    console.error(`missing ${esbuildBin} — run: (cd tools/motion-runtime && npm ci)`);
    process.exit(1);
  }
  const installed = JSON.parse(
    readFileSync(join(BUILD_DIR, "node_modules", "motion", "package.json"), "utf8")
  ).version;
  if (installed !== versions.motion) {
    console.error(`installed motion@${installed} does not match the pin motion@${versions.motion} — run npm ci`);
    process.exit(1);
  }

  const bundled = execFileSync(esbuildBin, [
    ENTRY,
    "--bundle",
    "--format=iife",
    `--global-name=${GLOBAL_NAME}`,
    "--minify",
    "--target=es2020",
    "--legal-comments=none",
    "--platform=browser",
  ], { encoding: "utf8", cwd: BUILD_DIR, maxBuffer: 32 * 1024 * 1024 });

  const bundle = header(versions) + bundled.trimEnd() + "\n";
  writeFileSync(OUT, bundle);
  writeFileSync(PIN, JSON.stringify({
    motion: versions.motion,
    esbuild: versions.esbuild,
    globalName: GLOBAL_NAME,
    entry: "tools/motion-runtime/entry.mjs",
    bytes: Buffer.byteLength(bundle, "utf8"),
    sha256: sha256(bundle),
  }, null, 2) + "\n");
  console.log(`wrote vendor/motion/motion.js (motion@${versions.motion}, ${Buffer.byteLength(bundle, "utf8")} bytes)`);
}

if (process.argv.includes("--check")) check();
else build();
