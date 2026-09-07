#!/usr/bin/env node
/* Regenerate the third-party runtimes the app ships from `vendor/`.
 *
 * Taurifer has no build step and no application dependencies. The handful of
 * third-party runtimes it does load are bundled offline, committed, and pinned.
 * `--check` is intentionally network-free so CI can detect hand-edited runtime
 * code without installing node_modules.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUILD_DIR = join(ROOT, "tools", "vendor-runtimes");

const RUNTIMES = [
  {
    name: "motion",
    pkg: "motion",
    globalName: "Motion",
    entry: "motion.entry.mjs",
    out: join("vendor", "motion", "motion.js"),
    pin: join("vendor", "motion", "motion.pin.json"),
    credit: "https://www.npmjs.com/package/motion (MIT, Framer B.V.)",
  },
  {
    name: "dnd-kit",
    pkg: "@dnd-kit/dom",
    globalName: "DndKit",
    entry: "dnd-kit.entry.mjs",
    out: join("vendor", "dnd-kit", "dnd-kit.runtime.js"),
    pin: join("vendor", "dnd-kit", "dnd-kit.runtime.pin.json"),
    bootstrapOut: join("vendor", "dnd-kit", "dnd-kit.js"),
    bootstrapPin: join("vendor", "dnd-kit", "dnd-kit.pin.json"),
    credit: "https://www.npmjs.com/package/@dnd-kit/dom (MIT, Claudéric Demers)",
  },
];

const sha256 = text => createHash("sha256").update(text, "utf8").digest("hex");
const abs = file => join(ROOT, file);

function pinnedVersions() {
  const manifest = JSON.parse(readFileSync(join(BUILD_DIR, "package.json"), "utf8"));
  for (const [name, version] of Object.entries(manifest.dependencies)) {
    if (!/^\d+\.\d+\.\d+$/.test(version))
      throw new Error(`every build dependency must be pinned to an exact version, got ${name}@${version}`);
  }
  return manifest.dependencies;
}

function header(runtime, version, esbuild) {
  return `/* ${runtime.pkg} ${version} — vendored runtime for Taurifer. Generated file: do not edit.\n   Source: ${runtime.credit}\n   Regenerate with: node tools/build-vendor-runtimes.mjs ${runtime.name}\n   Exports bundled: see tools/vendor-runtimes/${runtime.entry}\n   Bundler: esbuild ${esbuild}, iife, target es2020, global "${runtime.globalName}" */\n`;
}

function dndBootstrap(runtime, versions) {
  return `/* ${runtime.pkg} ${versions[runtime.pkg]} — lazy runtime bootstrap for Taurifer. Generated file: do not edit.\n   Heavy runtime: vendor/dnd-kit/dnd-kit.runtime.js\n   Regenerate with: node tools/build-vendor-runtimes.mjs dnd-kit */\n(function (global) {\n  "use strict";\n  let pending = null;\n  const ready = () => !!global.DndKit?.DragDropManager;\n  function load() {\n    if (ready()) return Promise.resolve(global.DndKit);\n    if (pending) return pending;\n    pending = new Promise((resolve, reject) => {\n      const script = document.createElement("script");\n      script.src = "vendor/dnd-kit/dnd-kit.runtime.js";\n      script.async = true;\n      script.dataset.tauriferRuntime = "dnd-kit";\n      script.onload = () => ready()\n        ? resolve(global.DndKit)\n        : reject(new Error("@dnd-kit runtime loaded without DndKit global"));\n      script.onerror = () => reject(new Error("Unable to load vendored @dnd-kit runtime"));\n      document.head.append(script);\n    });\n    return pending;\n  }\n  global.RepForgeDndRuntime = { available: ready, load };\n  const prime = () => load().catch(() => {});\n  if (document.readyState === "loading")\n    document.addEventListener("DOMContentLoaded", () => setTimeout(prime, 0), { once: true });\n  else setTimeout(prime, 0);\n})(typeof window !== "undefined" ? window : this);\n`;
}

function readPin(file) {
  return JSON.parse(readFileSync(abs(file), "utf8"));
}

function validatePinnedFile({ file, pinFile, pkg, version, esbuild, headerNeedle, problems }) {
  if (!existsSync(abs(file)) || !existsSync(abs(pinFile))) {
    problems.push(`${file} is missing — run node tools/build-vendor-runtimes.mjs`);
    return;
  }
  const pin = readPin(pinFile);
  const text = readFileSync(abs(file), "utf8");
  const actual = sha256(text);
  if (actual !== pin.sha256) problems.push(`${file}: sha256 ${actual} does not match pin ${pin.sha256}`);
  if (pin.version !== version) problems.push(`${file}: pin records ${pkg}@${pin.version}, package.json pins ${version}`);
  if (pin.esbuild !== esbuild) problems.push(`${file}: pin records esbuild@${pin.esbuild}, package.json pins ${esbuild}`);
  if (pin.bytes !== Buffer.byteLength(text, "utf8")) problems.push(`${file}: pin records ${pin.bytes} bytes, file is ${Buffer.byteLength(text, "utf8")}`);
  if (!text.includes(headerNeedle)) problems.push(`${file}: header does not name the pinned version`);
}

function check() {
  const versions = pinnedVersions();
  const problems = [];
  for (const runtime of RUNTIMES) {
    validatePinnedFile({
      file: runtime.out,
      pinFile: runtime.pin,
      pkg: runtime.pkg,
      version: versions[runtime.pkg],
      esbuild: versions.esbuild,
      headerNeedle: `${runtime.pkg} ${versions[runtime.pkg]} —`,
      problems,
    });
    if (runtime.bootstrapOut) {
      validatePinnedFile({
        file: runtime.bootstrapOut,
        pinFile: runtime.bootstrapPin,
        pkg: runtime.pkg,
        version: versions[runtime.pkg],
        esbuild: versions.esbuild,
        headerNeedle: `${runtime.pkg} ${versions[runtime.pkg]} — lazy runtime bootstrap`,
        problems,
      });
      if (existsSync(abs(runtime.bootstrapOut))) {
        const actual = readFileSync(abs(runtime.bootstrapOut), "utf8");
        const expected = dndBootstrap(runtime, versions);
        if (actual !== expected) problems.push(`${runtime.bootstrapOut}: bootstrap differs from generator output`);
      }
    }
  }
  if (problems.length) {
    for (const problem of problems) console.error(`  ✗ ${problem}`);
    console.error("vendored runtimes are out of date — run node tools/build-vendor-runtimes.mjs");
    process.exit(1);
  }
  console.log(`vendored runtimes match their pins (${RUNTIMES.map(r => `${r.pkg}@${versions[r.pkg]}`).join(", ")})`);
}

function writePin(file, runtime, versions, text, extra = {}) {
  writeFileSync(abs(file), JSON.stringify({
    package: runtime.pkg,
    version: versions[runtime.pkg],
    esbuild: versions.esbuild,
    globalName: runtime.globalName,
    entry: `tools/vendor-runtimes/${runtime.entry}`,
    bytes: Buffer.byteLength(text, "utf8"),
    sha256: sha256(text),
    ...extra,
  }, null, 2) + "\n");
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
    const installed = JSON.parse(readFileSync(join(BUILD_DIR, "node_modules", ...runtime.pkg.split("/"), "package.json"), "utf8")).version;
    if (installed !== versions[runtime.pkg]) {
      console.error(`installed ${runtime.pkg}@${installed} does not match the pin ${versions[runtime.pkg]} — run npm ci`);
      process.exit(1);
    }
    const bundled = execFileSync(esbuildBin, [
      join(BUILD_DIR, runtime.entry),
      "--bundle", "--format=iife", `--global-name=${runtime.globalName}`,
      "--minify", "--target=es2020", "--legal-comments=none", "--platform=browser",
    ], { encoding: "utf8", cwd: BUILD_DIR, maxBuffer: 64 * 1024 * 1024 });
    const bundle = header(runtime, versions[runtime.pkg], versions.esbuild) + bundled.trimEnd() + "\n";
    writeFileSync(abs(runtime.out), bundle);
    writePin(runtime.pin, runtime, versions, bundle, { kind: "runtime" });
    console.log(`wrote ${runtime.out} (${runtime.pkg}@${versions[runtime.pkg]}, ${Buffer.byteLength(bundle, "utf8")} bytes)`);

    if (runtime.bootstrapOut) {
      const bootstrap = dndBootstrap(runtime, versions);
      writeFileSync(abs(runtime.bootstrapOut), bootstrap);
      writePin(runtime.bootstrapPin, runtime, versions, bootstrap, { kind: "bootstrap", runtime: runtime.out });
      console.log(`wrote ${runtime.bootstrapOut} (${Buffer.byteLength(bootstrap, "utf8")} bytes bootstrap)`);
    }
  }
}

const args = process.argv.slice(2);
if (args.includes("--check")) check();
else build(args.filter(arg => !arg.startsWith("--")));
