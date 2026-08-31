#!/usr/bin/env node
/**
 * Check the Plan 048 program-entry screenshot matrix.
 *
 * The checker validates the manifest, then checks every required PNG path,
 * locale/theme pair, and device-scale dimensions. It reports all gaps at once
 * so visual work can be captured in batches:
 *
 *   node tools/check-ui-screen-catalogue.mjs --report
 *   node tools/check-ui-screen-catalogue.mjs
 *
 * `--report` keeps the process successful while the matrix is being captured.
 * The default is the release gate and exits non-zero for any gap or extra file.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = join(ROOT, "docs", "ui-screens", "program-entry-manifest.json");
const REPORT_ONLY = process.argv.includes("--report");
const JSON_OUTPUT = process.argv.includes("--json");

function fail(message) {
  throw new Error(message);
}

function loadManifest() {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch (error) {
    fail(`cannot read ${relative(ROOT, MANIFEST_PATH)}: ${error.message}`);
  }
  if (manifest.schemaVersion !== 1) fail("manifest schemaVersion must be 1");
  if (!Array.isArray(manifest.locales) || !manifest.locales.length) fail("manifest locales must be non-empty");
  if (!Array.isArray(manifest.themes) || !manifest.themes.length) fail("manifest themes must be non-empty");
  if (!manifest.viewports || !Object.keys(manifest.viewports).length) fail("manifest viewports must be non-empty");
  if (!manifest.textScales || !Object.keys(manifest.textScales).length) fail("manifest textScales must be non-empty");
  if (!manifest.motion || !Object.keys(manifest.motion).length) fail("manifest motion must be non-empty");
  if (!Array.isArray(manifest.states) || !manifest.states.length) fail("manifest states must be non-empty");
  const ids = new Set();
  for (const state of manifest.states) {
    if (!state || typeof state !== "object" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(state.id || "")) {
      fail("every state needs a kebab-case id");
    }
    if (ids.has(state.id)) fail(`duplicate state id: ${state.id}`);
    ids.add(state.id);
    if (!state.label || !state.scenario) fail(`state ${state.id} needs label and scenario`);
    if (!Array.isArray(state.findings) || !state.findings.length) fail(`state ${state.id} needs review finding ids`);
  }
  const dimensions = [manifest.locales, manifest.themes, Object.keys(manifest.viewports), Object.keys(manifest.textScales), Object.keys(manifest.motion)];
  for (const values of dimensions) {
    if (new Set(values).size !== values.length) fail("manifest matrix dimensions must not contain duplicates");
  }
  if (manifest.deviceScaleFactor !== 2) fail("manifest deviceScaleFactor must be 2");
  if (!manifest.artifactRoot || !manifest.artifactTemplate) fail("manifest needs artifactRoot and artifactTemplate");
  return manifest;
}

function renderPath(manifest, values) {
  let rendered = manifest.artifactTemplate;
  for (const [key, value] of Object.entries(values)) rendered = rendered.replaceAll(`{${key}}`, value);
  if (/\{[^}]+\}/.test(rendered)) fail(`artifact template has an unknown placeholder: ${rendered}`);
  return join(ROOT, manifest.artifactRoot, rendered);
}

function pngDimensions(path) {
  const data = readFileSync(path);
  if (data.length < 24 || data.readUInt32BE(0) !== 0x89504e47 || data.toString("ascii", 1, 4) !== "PNG") return null;
  if (data.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function allFiles(root) {
  if (!existsSync(root)) return [];
  const result = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) result.push(...allFiles(path));
    else result.push(path);
  }
  return result;
}

function check(manifest) {
  const missing = [];
  const invalid = [];
  const expected = new Set();
  const viewportEntries = Object.entries(manifest.viewports);
  const textEntries = Object.entries(manifest.textScales);
  const motionEntries = Object.entries(manifest.motion);
  for (const state of manifest.states) {
    for (const locale of manifest.locales) {
      for (const theme of manifest.themes) {
        for (const [viewport, dimensions] of viewportEntries) {
          for (const [text] of textEntries) {
            for (const [motion] of motionEntries) {
              const path = renderPath(manifest, { state: state.id, locale, theme, viewport, text, motion });
              expected.add(path);
              if (!existsSync(path)) {
                missing.push(relative(ROOT, path));
                continue;
              }
              const actual = pngDimensions(path);
              const wanted = { width: dimensions.width * manifest.deviceScaleFactor, height: dimensions.height * manifest.deviceScaleFactor };
              if (!actual) invalid.push(`${relative(ROOT, path)} (not a PNG)`);
              else if (actual.width !== wanted.width || actual.height !== wanted.height) {
                invalid.push(`${relative(ROOT, path)} (${actual.width}×${actual.height}, expected ${wanted.width}×${wanted.height})`);
              }
            }
          }
        }
      }
    }
  }
  const root = join(ROOT, manifest.artifactRoot);
  const extra = allFiles(root).filter((path) => path.endsWith(".png") && !expected.has(path)).map((path) => relative(ROOT, path));
  return { expected: expected.size, present: expected.size - missing.length, missing, invalid, extra };
}

let manifest;
let report;
try {
  manifest = loadManifest();
  report = check(manifest);
} catch (error) {
  if (JSON_OUTPUT) console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
  else console.error(`✗ ${error.message}`);
  process.exitCode = 1;
}

if (report) {
  const ok = report.missing.length === 0 && report.invalid.length === 0 && report.extra.length === 0;
  if (JSON_OUTPUT) {
    console.log(JSON.stringify({ ok, ...report }, null, 2));
  } else {
    console.log(`Program-entry catalogue: ${report.present}/${report.expected} required PNGs present`);
    for (const [heading, values] of [["Missing", report.missing], ["Invalid", report.invalid], ["Unexpected", report.extra]]) {
      if (values.length) {
        console.log(`\n${heading} (${values.length})`);
        for (const value of values) console.log(`  - ${value}`);
      }
    }
  }
  if (!ok && !REPORT_ONLY) process.exitCode = 1;
}
