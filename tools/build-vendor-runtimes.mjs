#!/usr/bin/env node
/* Regenerate the third-party runtimes the app ships from `vendor/`.
 *
 * Taurifer has no build step and no application dependencies. The handful of
 * third-party runtimes it does load are therefore treated the way `exercises.js`
 * and `i18n.js` are: bundled offline by a tool, committed, and gated for drift.
 * The browser never resolves a package or reaches a CDN — it loads files that
 * live in this repository and in the service worker's precache, so the app
 * behaves identically on a plane.
 *
 * Two modes:
 *
 *   node tools/build-vendor-runtimes.mjs [name…]
 *       Bundles each runtime's entry with the pinned esbuild and the pinned
 *       package from `tools/vendor-runtimes/node_modules` (run `npm ci` there
 *       first), writes the bundle and refreshes its pin file.
 *
 *   node tools/build-vendor-runtimes.mjs --check
 *       Offline. Re-hashes every committed bundle and compares it to its pin.
 *       This is what CI runs: it needs no network and no node_modules, and it
 *       fails the moment somebody hand-edits vendored third-party code.
 *
 * Upgrading a runtime means editing `tools/vendor-runtimes/package.json`,
 * running `npm install` there, re-running this tool, and re-reading the
 * interaction audit — a new runtime can change how a gesture feels even when
 * no application code moved.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUILD_DIR = join(ROOT, "tools", "vendor-runtimes");

/* Each runtime names the global the app reads. The globals are kept identical
   to each project's own published browser build, so a vendored bundle stays a
   drop-in for the upstream one. */
const RUNTIMES = [
  {
    name: "motion",
    pkg: "motion",
    globalName: "Motion",
    entry: "motion.entry.mjs",
    out: join("vendor", "motion", "motion.js"),
    credit: "https://www.npmjs.com/package/motion (MIT, Framer B.V.)",
  },
  {
    name: "dnd-kit",
    pkg: "@dnd-kit/dom",
    globalName: "DndKit",
    entry: "dnd-kit.entry.mjs",
    out: join("vendor", "dnd-kit", "dnd-kit.js"),
    credit: "https://www.npmjs.com/package/@dnd-kit/dom (MIT, Claudéric Demers)",
  },
];

const sha256 = text => createHash("sha256").update(text, "utf8").digest("hex");
const pinPath = runtime => join(ROOT, dirname(runtime.out), `${runtime.name}.pin.json`);

function pinnedVersions() {
  const manifest = JSON.parse(readFileSync(join(BUILD_DIR, "package.json"), "utf8"));
  for (const [name, version] of Object.entries(manifest.dependencies)) {
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      throw new Error(`every build dependency must be pinned to an exact version, got ${name}@${version}`);
    }
  }
  return manifest.dependencies;
}

function header(runtime, version, esbuild) {
  return `/* ${runtime.pkg} ${version} — vendored runtime for Taurifer. Generated file: do not edit.
   Source: ${runtime.credit}
   Regenerate with: node tools/build-vendor-runtimes.mjs ${runtime.name}
   Exports bundled: see tools/vendor-runtimes/${runtime.entry}
   Bundler: esbuild ${esbuild}, iife, target es2020, global "${runtime.globalName}" */
`;
}

function check() {
  const versions = pinnedVersions();
  const problems = [];
  for (const runtime of RUNTIMES) {
    const out = join(ROOT, runtime.out);
    if (!existsSync(out) || !existsSync(pinPath(runtime))) {
      problems.push(`${runtime.out} is missing — run node tools/build-vendor-runtimes.mjs`);
      continue;
    }
    const pin = JSON.parse(readFileSync(pinPath(runtime), "utf8"));
    const bundle = readFileSync(out, "utf8");
    const actual = sha256(bundle);
    if (actual !== pin.sha256) problems.push(`${runtime.out}: sha256 ${actual} does not match pin ${pin.sha256}`);
    if (pin.version !== versions[runtime.pkg]) problems.push(`${runtime.out}: pin records ${runtime.pkg}@${pin.version}, package.json pins ${versions[runtime.pkg]}`);
    if (pin.esbuild !== versions.esbuild) problems.push(`${runtime.out}: pin records esbuild@${pin.esbuild}, package.json pins ${versions.esbuild}`);
    if (pin.bytes !== Buffer.byteLength(bundle, "utf8")) problems.push(`${runtime.out}: pin records ${pin.bytes} bytes, file is ${Buffer.byteLength(bundle, "utf8")}`);
    if (!bundle.includes(`${runtime.pkg} ${versions[runtime.pkg]} —`)) problems.push(`${runtime.out}: header does not name the pinned version`);
  }
  if (problems.length) {
    for (const problem of problems) console.error(`  ✗ ${problem}`);
    console.error("vendored runtimes are out of date — run node tools/build-vendor-runtimes.mjs");
    process.exit(1);
  }
  console.log(`vendored runtimes match their pins (${RUNTIMES.map(r => `${r.pkg}@${versions[r.pkg]}`).join(", ")})`);
}

function build(only) {
  const versions = pinnedVersions();
  const esbuildBin = join(BUILD_DIR, "node_modules", ".bin", "esbuild");
  if (!existsSync(esbuildBin)) {
    console.error(`missing ${esbuildBin} — run: (cd tools/vendor-runtimes && npm ci)`);
    process.exit(1);
  }
  for (const runtime of RUNTIMES) {
    if (only.length && !only.includes(runtime.name)) continue;
    const installed = JSON.parse(
      readFileSync(join(BUILD_DIR, "node_modules", ...runtime.pkg.split("/"), "package.json"), "utf8")
    ).version;
    if (installed !== versions[runtime.pkg]) {
      console.error(`installed ${runtime.pkg}@${installed} does not match the pin ${versions[runtime.pkg]} — run npm ci`);
      process.exit(1);
    }
    const bundled = execFileSync(esbuildBin, [
      join(BUILD_DIR, runtime.entry),
      "--bundle",
      "--format=iife",
      `--global-name=${runtime.globalName}`,
      "--minify",
      "--target=es2020",
      "--legal-comments=none",
      "--platform=browser",
    ], { encoding: "utf8", cwd: BUILD_DIR, maxBuffer: 64 * 1024 * 1024 });

    const bundle = header(runtime, versions[runtime.pkg], versions.esbuild) + bundled.trimEnd() + "\n";
    writeFileSync(join(ROOT, runtime.out), bundle);
    writeFileSync(pinPath(runtime), JSON.stringify({
      package: runtime.pkg,
      version: versions[runtime.pkg],
      esbuild: versions.esbuild,
      globalName: runtime.globalName,
      entry: `tools/vendor-runtimes/${runtime.entry}`,
      bytes: Buffer.byteLength(bundle, "utf8"),
      sha256: sha256(bundle),
    }, null, 2) + "\n");
    console.log(`wrote ${runtime.out} (${runtime.pkg}@${versions[runtime.pkg]}, ${Buffer.byteLength(bundle, "utf8")} bytes)`);
  }
}

const args = process.argv.slice(2);
if (args.includes("--check")) check();
else build(args.filter(arg => !arg.startsWith("--")));
