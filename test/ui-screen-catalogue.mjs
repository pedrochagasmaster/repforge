#!/usr/bin/env node
/** Self-test for the explicit Plan 048 screenshot manifest and evidence gate. */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { replaceCatalogue } from "../tools/capture-program-entry-catalogue.mjs";
import { compareCatalogue, comparePngBuffers } from "../tools/compare-ui-screen-catalogue.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const manifest = JSON.parse(readFileSync(resolve(root, "docs/ui-screens/program-entry-manifest.json"), "utf8"));
const workflow = readFileSync(resolve(root, ".github/workflows/simulation.yml"), "utf8");
const stateIds = new Set(manifest.states.map((state) => state.id));
assert.equal(manifest.states.length, 24, "the required Plan 048 state list stays complete");
assert.equal(manifest.captures.length, 60, "the reviewed capture list stays deliberately non-Cartesian");
assert.equal(manifest.captures.length, manifest.states.length + 6 * 6, "each representative adds six distinct variants");
assert.equal((workflow.match(/node tools\/capture-program-entry-catalogue\.mjs/g) || []).length, 1,
  "CI uses one canonical program-entry capture invocation");
assert.match(workflow, /baseline="\$\(mktemp -d\)"/,
  "CI creates a private screenshot baseline before regeneration");
assert.match(workflow, /cp -a docs\/ui-screens\/program-entry "\$baseline\/"/,
  "CI copies committed program-entry evidence into the immutable baseline");
assert.match(workflow, /chmod -R a-w "\$baseline"/,
  "CI makes the copied baseline read-only before regeneration");
assert.match(workflow, /cleanup\(\)\s*\{[\s\S]*chmod -R u\+w -- "\$baseline"[\s\S]*rm -rf -- "\$baseline"[\s\S]*\}/,
  "CI restores baseline permissions before cleanup");
assert.match(workflow, /trap cleanup EXIT/,
  "CI uses the permission-safe baseline cleanup trap");
assert.match(workflow, /node tools\/compare-ui-screen-catalogue\.mjs --baseline "\$baseline\/program-entry"/,
  "CI compares every regenerated capture with the immutable baseline");
assert.doesNotMatch(workflow, /git diff --exit-code -- docs\/ui-screens\/program-entry\//,
  "CI does not use byte equality for rasterised evidence");
const baselineIndex = workflow.indexOf('cp -a docs/ui-screens/program-entry "$baseline/"');
const captureIndex = workflow.indexOf("node tools/capture-program-entry-catalogue.mjs");
const catalogueCheckIndex = workflow.indexOf("node tools/check-ui-screen-catalogue.mjs");
const evidenceCompareIndex = workflow.indexOf("node tools/compare-ui-screen-catalogue.mjs");
assert(baselineIndex < captureIndex && captureIndex < catalogueCheckIndex && catalogueCheckIndex < evidenceCompareIndex,
  "CI snapshots, captures, structurally checks, then perceptually compares program-entry evidence");

for (const state of manifest.states) {
  const canonical = manifest.captures.filter((capture) => capture.state === state.id && capture.canonical);
  assert.equal(canonical.length, 1, `${state.id} has one canonical capture`);
  assert.deepEqual(canonical[0], {
    state: state.id, locale: "en", theme: "light", viewport: "phone-390",
    text: "normal", motion: "normal", canonical: true,
  });
}

for (const [key, values] of Object.entries({
  locale: manifest.locales,
  theme: manifest.themes,
  viewport: Object.keys(manifest.viewports),
  text: Object.keys(manifest.textScales),
  motion: Object.keys(manifest.motion),
})) {
  for (const value of values) assert.ok(manifest.captures.some((capture) => capture[key] === value), `${key}=${value} has a representative`);
}
for (const capture of manifest.captures) assert.ok(stateIds.has(capture.state), `capture state ${capture.state} is declared`);

const result = spawnSync(process.execPath, ["tools/check-ui-screen-catalogue.mjs", "--report", "--json"], {
  cwd: root, encoding: "utf8",
});
assert.equal(result.status, 0, "report mode is non-blocking while captures are pending");
const report = JSON.parse(result.stdout);
assert.equal(report.expected, 60);

// A failed swap must roll back the old catalogue. This exercises the
// filesystem transaction without launching Chromium or touching the committed
// evidence tree.
{
  const root = mkdtempSync(join(tmpdir(), "repforge-catalogue-test-"));
  const target = join(root, "program-entry");
  const staging = join(root, "staging");
  mkdirSync(target); mkdirSync(staging);
  writeFileSync(join(target, "old.png"), "old");
  writeFileSync(join(staging, "new.png"), "new");
  assert.throws(() => replaceCatalogue(staging, target, {
    rename(source, destination) {
      if (source === staging && destination === target) throw new Error("injected swap failure");
      renameSync(source, destination);
    },
  }), /injected swap failure/);
  assert.equal(readFileSync(join(target, "old.png"), "utf8"), "old");
  assert.equal(existsSync(join(target, "new.png")), false);
  assert.equal(existsSync(join(staging, "new.png")), true);
  rmSync(root, { recursive: true, force: true });
}
assert.equal(report.present, 60);
assert.equal(report.missing.length, 0);
assert.equal(report.invalid.length, 0);
assert.equal(report.extra.length, 0);

// The CI baseline is intentionally read-only while captures run. Prove the
// exact shell cleanup still succeeds and removes that protected tree.
{
  const root = mkdtempSync(join(tmpdir(), "repforge-catalogue-cleanup-test-"));
  const baseline = join(root, "baseline");
  const cleanupProbe = spawnSync("/bin/bash", ["-euo", "pipefail", "-c", `
    baseline="$1"
    mkdir "$baseline"
    touch "$baseline/capture.png"
    chmod -R a-w "$baseline"
    cleanup() {
      chmod -R u+w -- "$baseline" 2>/dev/null || true
      rm -rf -- "$baseline"
    }
    trap cleanup EXIT
    test -f "$baseline/capture.png"
  `, "catalogue-cleanup", baseline], { encoding: "utf8" });
  assert.equal(cleanupProbe.status, 0, `read-only baseline cleanup succeeds: ${cleanupProbe.stderr}`);
  assert.equal(existsSync(baseline), false, "read-only baseline cleanup removes the protected tree");
  rmSync(root, { recursive: true, force: true });
}

// The committed catalogue is itself a valid baseline. This exercises the
// manifest walk and dimension checks without allowing a test to rewrite it.
const baselineComparison = compareCatalogue({
  baselineRoot: resolve(root, "docs/ui-screens/program-entry"),
  currentRoot: resolve(root, "docs/ui-screens/program-entry"),
});
assert.equal(baselineComparison.expected, 60);
assert.equal(baselineComparison.compared, 60);
assert.equal(baselineComparison.failures.length, 0);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}
function rgbPng(width, height, pixelAt) {
  const raw = Buffer.alloc(height * (width * 3 + 1));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0;
    for (let x = 0; x < width; x++) {
      const [red, green, blue] = pixelAt(x, y);
      raw[offset++] = red;
      raw[offset++] = green;
      raw[offset++] = blue;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 2;
  return Buffer.concat([PNG_SIGNATURE, pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
}
function scenePixel(x, y, { noisy = false, material = false } = {}) {
  let pixel = [255, 255, 255];
  if (y < 32) pixel = [25, 25, 25];
  if (x >= 16 && x < 176 && y >= 64 && y < 176) pixel = material ? [191, 220, 248] : [245, 242, 238];
  if (x >= 32 && x < 160 && y >= 196 && y < 236) pixel = [231, 70, 20];
  if (x >= 44 && x < 132 && y >= 210 && y < 216) pixel = [255, 255, 255];
  if (noisy && (x * 17 + y * 23) % 11 === 0) {
    const delta = ((x + y) % 7) - 3;
    pixel = pixel.map((value) => Math.max(0, Math.min(255, value + delta)));
  }
  return pixel;
}
const syntheticBaseline = rgbPng(192, 256, (x, y) => scenePixel(x, y));
const syntheticNoise = rgbPng(192, 256, (x, y) => scenePixel(x, y, { noisy: true }));
const syntheticMaterialChange = rgbPng(192, 256, (x, y) => scenePixel(x, y, { material: true }));
const syntheticLocalizedLabelDrift = rgbPng(192, 256, (x, y) => {
  if (x >= 40 && x < 60 && y >= 40 && y < 44) return [25, 25, 25];
  return scenePixel(x, y);
});
const noiseComparison = comparePngBuffers(syntheticBaseline, syntheticNoise);
assert.equal(noiseComparison.ok, true, `small raster noise should pass: ${noiseComparison.reasons?.join("; ")}`);
const materialComparison = comparePngBuffers(syntheticBaseline, syntheticMaterialChange);
assert.equal(materialComparison.ok, false, "a broad panel/content change must fail the evidence gate");
assert.ok(materialComparison.reasons.length > 0, "material changes report actionable comparator reasons");
const localizedLabelComparison = comparePngBuffers(syntheticBaseline, syntheticLocalizedLabelDrift);
assert.equal(localizedLabelComparison.ok, false, `a localized dark label drift must fail the evidence gate: ${JSON.stringify(localizedLabelComparison)}`);
assert.ok(localizedLabelComparison.reasons.length > 0, "localized label drift reports actionable comparator reasons");
const dimensionComparison = comparePngBuffers(syntheticBaseline, rgbPng(193, 256, (x, y) => scenePixel(x, y)));
assert.equal(dimensionComparison.ok, false, "dimension drift must fail the evidence gate");
assert.match(dimensionComparison.reasons[0], /dimensions changed/);

console.log("UI screen catalogue evidence gate: 24 states, 60 captures, structural and perceptual checks covered");
