#!/usr/bin/env node
/** Self-test for the explicit Plan 048 screenshot manifest and evidence gate. */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { replaceCatalogue, replaceEvidence } from "../tools/capture-program-entry-catalogue.mjs";
import { compareCatalogue, comparePngBuffers } from "../tools/compare-ui-screen-catalogue.mjs";
import { compareSemanticArtifacts, normalizeSemanticRecords, normalizeSemanticValue, validateSemanticArtifact } from "../tools/program-entry-semantic.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const manifest = JSON.parse(readFileSync(resolve(root, "docs/ui-screens/program-entry-manifest.json"), "utf8"));
const workflow = readFileSync(resolve(root, ".github/workflows/simulation.yml"), "utf8");
const toolsReadme = readFileSync(resolve(root, "tools/README.md"), "utf8");
const capture = readFileSync(resolve(root, "tools/capture-program-entry-catalogue.mjs"), "utf8");
const semanticTool = readFileSync(resolve(root, "tools/program-entry-semantic.mjs"), "utf8");
const stateIds = new Set(manifest.states.map((state) => state.id));
assert.equal(manifest.states.length, 23, "the required Plan 048 state list stays complete");
assert.equal(manifest.captures.length, 59, "the reviewed capture list stays deliberately non-Cartesian");
assert.equal(manifest.captures.length, manifest.states.length + 6 * 6, "each representative adds six distinct variants");
assert.equal((workflow.match(/node tools\/capture-program-entry-catalogue\.mjs/g) || []).length, 1,
  "CI uses one canonical program-entry capture invocation");
assert.match(workflow, /baseline="\$\(mktemp -d\)"/,
  "CI creates a private screenshot baseline before regeneration");
assert.match(workflow, /cp -a docs\/ui-screens\/program-entry "\$baseline\/"/,
  "CI copies committed program-entry evidence into the immutable baseline");
assert.match(workflow, /cp -a docs\/ui-screens\/program-entry-semantic\.json "\$baseline\/"/,
  "CI copies committed semantic evidence into the immutable baseline");
assert.match(workflow, /chmod -R a-w "\$baseline"/,
  "CI makes the copied baseline read-only before regeneration");
assert.match(workflow, /cleanup\(\)\s*\{[\s\S]*chmod -R u\+w -- "\$baseline"[\s\S]*rm -rf -- "\$baseline"[\s\S]*\}/,
  "CI restores baseline permissions before cleanup");
assert.match(workflow, /trap cleanup EXIT/,
  "CI uses the permission-safe baseline cleanup trap");
assert.match(toolsReadme, /baseline="\$\(mktemp -d\)"/,
  "the documented catalogue command creates a private screenshot baseline");
assert.match(toolsReadme, /cleanup\(\)\s*\{[\s\S]*chmod -R u\+w -- "\$baseline"[\s\S]*rm -rf -- "\$baseline"[\s\S]*\}/,
  "the documented catalogue command restores baseline permissions before cleanup");
assert.match(toolsReadme, /trap cleanup EXIT/,
  "the documented catalogue command cleans up its baseline on exit");
assert.doesNotMatch(toolsReadme, /\nrm -rf -- "\$baseline"\s*```/,
  "the documented catalogue command does not remove a read-only baseline outside its cleanup trap");
assert.match(workflow, /node tools\/compare-ui-screen-catalogue\.mjs --baseline "\$baseline\/program-entry"/,
  "CI compares every regenerated capture with the immutable baseline");
assert.match(workflow, /--baseline-semantic "\$baseline\/program-entry-semantic\.json"/,
  "CI compares regenerated semantic evidence with the immutable baseline");
assert.doesNotMatch(workflow, /git diff --exit-code -- docs\/ui-screens\/program-entry\//,
  "CI does not use byte equality for rasterised evidence");
assert.match(capture, /const CAPTURE_NOW = process\.env\.CAPTURE_NOW \|\| "2026-08-31T12:00:00\.000Z"/,
  "the production catalogue capture uses a stable fixture clock for date-bearing states");
assert.match(capture, /page\.addInitScript\(/,
  "the fixture clock is installed before the production page boots");
assert.match(capture, /locale: capture\.locale === "pt-BR" \? "pt-BR" : "en-US"/,
  "the production catalogue capture pins the browser locale");
assert.match(capture, /timezoneId: "UTC"/,
  "the production catalogue capture pins the browser timezone");
assert.match(capture, /localStorage\.getItem\("repforge_program_setup_draft_v1"\)/,
  "the Resume fixture waits for the final persisted setup step before reload");
assert.match(capture, /collectProgramEntrySemantics/,
  "the capture records semantics from the production page");
assert.match(capture, /normalizeSemanticRecords/,
  "the capture normalizes collected Program JSON through the shared Node seam");
assert.match(semanticTool, /element\.id === "programJson"/,
  "the page collector marks only the raw Program JSON field for normalization");
assert.match(capture, /replaceEvidence\(/,
  "PNG and semantic evidence install through one transaction");
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
assert.equal(report.expected, 59);
assert.equal(report.semantic.ok, true, "the catalogue report includes valid semantic evidence");

const semanticPath = resolve(root, "docs/ui-screens/program-entry-semantic.json");
assert.equal(existsSync(semanticPath), true, "the committed catalogue has semantic evidence");
const semanticArtifact = JSON.parse(readFileSync(semanticPath, "utf8"));
const semanticValidation = validateSemanticArtifact(semanticArtifact, manifest.captures);
assert.equal(semanticValidation.ok, true, `all 59 captures have semantic evidence: ${semanticValidation.reasons.join("; ")}`);
assert.equal(semanticArtifact.captures.length, 59, "the semantic baseline has one entry for each capture");
for (const [locale, expectedCopy] of [[
  "en", "The program or you set each exercise's target. Taurifer does not invent load or rep suggestions.",
], [
  "pt-BR", "O programa ou você define a meta de cada exercício. O Taurifer não inventa carga nem repetições.",
]]) {
  const importReview = semanticArtifact.captures.find((capture) => capture.state === "import-review" && capture.locale === locale && capture.theme === "light" && capture.viewport === "phone-390" && capture.text === "normal" && capture.motion === "normal");
  assert.ok(importReview, `${locale} import-review semantic evidence exists`);
  assert.ok(importReview.semantic.some((entry) => entry.tag === "p" && entry.text === expectedCopy),
    `${locale} import-review proves manual progression ownership copy`);
  assert.ok(importReview.semantic.some((entry) => entry.tag === "button" && entry.name === (locale === "en" ? "Use this program" : "Usar este programa") && !entry.disabled),
    `${locale} import-review proves activation is ready`);
}
assert.equal(semanticArtifact.captures.some((capture) => capture.semantic.some((entry) => entry.text === "Unavailable with your current choices")), false,
  "semantic evidence excludes visually hidden helper copy");
assert.equal(semanticArtifact.captures.some((capture) => capture.semantic.some((entry) => entry.tag === "li" && "value" in entry)), false,
  "semantic evidence excludes default technical values from non-form elements");

const generatedProgramA = '[{"id":"4c79f129-740b-4295-97d8-1c4112314ab2","name":"Assisted pull-up","libraryId":"pd_bw"}]';
const generatedProgramB = '[{"id":"7fbad21b-1cb9-4109-9157-c968dc67bf38","name":"Assisted pull-up","libraryId":"pd_bw"}]';
assert.equal(normalizeSemanticValue(generatedProgramA), normalizeSemanticValue(generatedProgramB),
  "semantic normalization ignores generated program row IDs between captures");
assert.notEqual(normalizeSemanticValue(generatedProgramA), normalizeSemanticValue(generatedProgramA.replace("Assisted pull-up", "Barbell row")),
  "semantic normalization keeps meaningful program content changes");
const rangeProgression = '[{"id":"4c79f129-740b-4295-97d8-1c4112314ab2","name":"Assisted pull-up","libraryId":"pd_bw","progression":{"schemaVersion":1,"strategy":{"id":"range","version":1,"params":{}},"modifiers":[]}}]';
const manualProgression = '[{"id":"7fbad21b-1cb9-4109-9157-c968dc67bf38","name":"Assisted pull-up","libraryId":"pd_bw","progression":{"schemaVersion":1,"strategy":{"id":"manual","version":1,"params":{}},"modifiers":[]}}]';
assert.notEqual(normalizeSemanticValue(rangeProgression), normalizeSemanticValue(manualProgression),
  "semantic normalization keeps meaningful progression strategy IDs");
const modifierA = '[{"id":"4c79f129-740b-4295-97d8-1c4112314ab2","name":"Assisted pull-up","libraryId":"pd_bw","progression":{"schemaVersion":1,"strategy":{"id":"range","version":1,"params":{}},"modifiers":[{"id":"modifier-a","version":1,"compatibleStrategies":["range@1"],"params":{}}]}}]';
const modifierB = '[{"id":"7fbad21b-1cb9-4109-9157-c968dc67bf38","name":"Assisted pull-up","libraryId":"pd_bw","progression":{"schemaVersion":1,"strategy":{"id":"range","version":1,"params":{}},"modifiers":[{"id":"modifier-b","version":1,"compatibleStrategies":["range@1"],"params":{}}]}}]';
assert.notEqual(normalizeSemanticValue(modifierA), normalizeSemanticValue(modifierB),
  "semantic normalization keeps meaningful progression modifier IDs");
const relationA = '{"program":[{"id":"row-id","name":"Assisted pull-up","libraryId":"pd_bw"}],"progressionRelations":[{"id":"relation-a","type":"paired_exposure"}]}';
const relationB = '{"program":[{"id":"row-id","name":"Assisted pull-up","libraryId":"pd_bw"}],"progressionRelations":[{"id":"relation-b","type":"paired_exposure"}]}';
assert.notEqual(normalizeSemanticValue(relationA), normalizeSemanticValue(relationB),
  "semantic normalization keeps relation IDs outside exercise rows");
const libraryA = '[{"id":"4c79f129-740b-4295-97d8-1c4112314ab2","name":"Assisted pull-up","libraryId":"pd_bw"}]';
const libraryB = '[{"id":"7fbad21b-1cb9-4109-9157-c968dc67bf38","name":"Assisted pull-up","libraryId":"row_cable"}]';
assert.notEqual(normalizeSemanticValue(libraryA), normalizeSemanticValue(libraryB),
  "semantic normalization keeps library provenance IDs");
const normalizedRecords = normalizeSemanticRecords([
  { tag: "textarea", value: rangeProgression, __programJson: true },
  { tag: "textarea", value: rangeProgression },
]);
assert.notEqual(normalizedRecords[0].value, rangeProgression,
  "the shared record normalizer handles the visible Program JSON textarea");
assert.equal(Object.hasOwn(normalizedRecords[0], "__programJson"), false,
  "the collector's internal Program JSON marker never enters semantic evidence");
assert.equal(normalizedRecords[1].value, rangeProgression,
  "the shared record normalizer leaves other textareas untouched");
for (const state of ["build-partial", "build-ready"]) {
  const capture = semanticArtifact.captures.find((item) => item.state === state && item.canonical);
  const programJson = capture?.semantic.find((entry) => entry.name === "Program JSON")?.value;
  assert.ok(programJson, `${state} captures the visible Program JSON value`);
  assert.doesNotMatch(programJson, /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    `${state} semantic evidence excludes generated row IDs`);
}

const semanticCopyDrift = JSON.parse(JSON.stringify(semanticArtifact));
const semanticTextEntry = semanticCopyDrift.captures[0].semantic.find((entry) => entry.text);
assert.ok(semanticTextEntry, "semantic baseline contains visible text");
semanticTextEntry.text = "Changed visible copy";
const semanticCopyComparison = compareSemanticArtifacts(semanticArtifact, semanticCopyDrift);
assert.equal(semanticCopyComparison.ok, false, "localized copy changes fail semantic evidence comparison");
assert.match(semanticCopyComparison.reasons.join("; "), /semantic text\/state changed/);
assert.match(semanticCopyComparison.reasons.join("; "), /semantic\[1\]\.text expected "Cancel" actual "Changed visible copy"/,
  "semantic comparison reports bounded expected/actual field evidence");
assert.ok(semanticCopyComparison.reasons.every((reason) => reason.length < 500),
  "semantic comparison details remain bounded");

const resumeDateDrift = JSON.parse(JSON.stringify(semanticArtifact));
const resumeSemantic = resumeDateDrift.captures.find((capture) => capture.state === "resume" && capture.canonical).semantic;
const resumeDetail = resumeSemantic.find((entry) => entry.text?.includes("Aug 31"));
assert.ok(resumeDetail, "Resume evidence includes its user-visible recency detail");
resumeDetail.text = resumeDetail.text.replace("Aug 31", "Sep 1");
const resumeComparison = compareSemanticArtifacts(semanticArtifact, resumeDateDrift);
assert.match(resumeComparison.reasons.join("; "), /resume\|en\|light\|phone-390\|normal\|normal.*semantic\[7\]\.text expected/,
  "Resume semantic drift reports the exact bounded field");
const resumeCanonical = semanticArtifact.captures.find((capture) => capture.state === "resume" && capture.canonical);
assert.deepEqual(resumeCanonical.semantic.find((entry) => entry.role === "status"), {
  tag: "div", role: "status",
  name: "Resume setup?You have an unfinished program setup on this device.Recommend · Priorities and constraints · Aug 31",
}, "Resume keeps the intended user-visible status text and role");

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

// A semantic swap failure must restore both the PNG directory and semantic file.
{
  const root = mkdtempSync(join(tmpdir(), "repforge-semantic-rollback-test-"));
  const target = join(root, "program-entry");
  const staging = join(root, "staging");
  const semanticTarget = join(root, "program-entry-semantic.json");
  const semanticStaging = join(root, "semantic-staging.json");
  mkdirSync(target); mkdirSync(staging);
  writeFileSync(join(target, "old.png"), "old");
  writeFileSync(join(staging, "new.png"), "new");
  writeFileSync(semanticTarget, "old-semantic");
  writeFileSync(semanticStaging, "new-semantic");
  assert.throws(() => replaceEvidence(staging, target, semanticStaging, semanticTarget, {
    rename(source, destination) {
      if (source === semanticStaging) throw new Error("injected semantic swap failure");
      renameSync(source, destination);
    },
  }), /injected semantic swap failure/);
  assert.equal(readFileSync(join(target, "old.png"), "utf8"), "old");
  assert.equal(existsSync(join(target, "new.png")), false);
  assert.equal(readFileSync(semanticTarget, "utf8"), "old-semantic");
  assert.equal(existsSync(semanticStaging), true);
  assert.equal(readFileSync(semanticStaging, "utf8"), "new-semantic");
  rmSync(root, { recursive: true, force: true });
}

// Cleanup failures after both evidence renames must not roll back asymmetrically.
// The new pair is already committed; the failed backup removal may be retried
// later, but it must not discard either newly installed artifact.
{
  const root = mkdtempSync(join(tmpdir(), "repforge-semantic-cleanup-test-"));
  const target = join(root, "program-entry");
  const staging = join(root, "staging");
  const semanticTarget = join(root, "program-entry-semantic.json");
  const semanticStaging = join(root, "semantic-staging.json");
  const backupSemantic = `${semanticTarget}.backup-${basename(staging)}`;
  mkdirSync(target); mkdirSync(staging);
  writeFileSync(join(target, "old.png"), "old");
  writeFileSync(join(staging, "new.png"), "new");
  writeFileSync(semanticTarget, "old-semantic");
  writeFileSync(semanticStaging, "new-semantic");
  assert.doesNotThrow(() => replaceEvidence(staging, target, semanticStaging, semanticTarget, {
    remove(path, options) {
      if (path === backupSemantic) throw new Error("injected semantic-backup cleanup failure");
      rmSync(path, options);
    },
  }));
  assert.equal(readFileSync(join(target, "new.png"), "utf8"), "new");
  assert.equal(readFileSync(semanticTarget, "utf8"), "new-semantic");
  assert.equal(readFileSync(backupSemantic, "utf8"), "old-semantic");
  rmSync(root, { recursive: true, force: true });
}
assert.equal(report.present, 59);
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
assert.equal(baselineComparison.expected, 59);
assert.equal(baselineComparison.compared, 59);
assert.equal(baselineComparison.failures.length, 0);
assert.equal(baselineComparison.semantic.ok, true);

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
function scenePixel(x, y, { noisy = false, material = false, layout = false } = {}) {
  let pixel = [255, 255, 255];
  if (y < 32) pixel = [25, 25, 25];
  const panelStart = layout ? 40 : 16;
  if (x >= panelStart && x < panelStart + 160 && y >= 64 && y < 176) pixel = material ? [191, 220, 248] : [245, 242, 238];
  const buttonStart = layout ? 64 : 32;
  if (x >= buttonStart && x < buttonStart + 128 && y >= 196 && y < 236) pixel = [231, 70, 20];
  if (x >= buttonStart + 12 && x < buttonStart + 100 && y >= 210 && y < 216) pixel = [255, 255, 255];
  if (noisy && (x * 17 + y * 23) % 11 === 0) {
    const delta = ((x + y) % 7) - 3;
    pixel = pixel.map((value) => Math.max(0, Math.min(255, value + delta)));
  }
  return pixel;
}
const LABEL_GLYPHS = [
  ["1111", "1001", "1111", "1001", "1001"],
  ["1110", "1001", "1110", "1001", "1110"],
  ["1111", "1000", "1000", "1000", "1111"],
  ["1110", "1001", "1001", "1001", "1110"],
  ["1111", "1000", "1110", "1000", "1111"],
  ["1000", "1000", "1110", "1000", "1111"],
  ["1111", "1000", "1011", "1001", "1111"],
  ["1001", "1001", "1111", "1001", "1001"],
];
function labelPixel(x, y, variant = false) {
  const labelX = 40;
  const labelY = 40;
  const glyphWidth = 4;
  const glyphGap = 1;
  const localX = x - labelX;
  const localY = y - labelY;
  if (localY < 0 || localY >= 5 || localX < 0 || localX >= LABEL_GLYPHS.length * (glyphWidth + glyphGap)) return null;
  const glyphIndex = Math.floor(localX / (glyphWidth + glyphGap));
  const glyphX = localX % (glyphWidth + glyphGap);
  if (glyphX >= glyphWidth) return null;
  const row = LABEL_GLYPHS[glyphIndex][localY];
  if (row[glyphX] !== "1") return null;
  if (!variant) return [25, 25, 25];
  const edge = glyphX === 0 || glyphX === glyphWidth - 1 || localY === 0 || localY === 4;
  if (variant === "antialias") return edge ? [130, 130, 130] : [25, 25, 25];
  return edge ? [72, 72, 72] : [25, 25, 25];
}
const syntheticBaseline = rgbPng(192, 256, (x, y) => scenePixel(x, y));
const syntheticNoise = rgbPng(192, 256, (x, y) => scenePixel(x, y, { noisy: true }));
const syntheticMaterialChange = rgbPng(192, 256, (x, y) => scenePixel(x, y, { material: true }));
const syntheticFontRasterVariation = rgbPng(192, 256, (x, y) => labelPixel(x, y, "antialias") || scenePixel(x, y));
const syntheticFontRasterBaseline = rgbPng(192, 256, (x, y) => labelPixel(x, y) || scenePixel(x, y));
const syntheticLayoutChange = rgbPng(192, 256, (x, y) => scenePixel(x, y, { layout: true }));
const noiseComparison = comparePngBuffers(syntheticBaseline, syntheticNoise);
assert.equal(noiseComparison.ok, true, `small raster noise should pass: ${noiseComparison.reasons?.join("; ")}`);
const materialComparison = comparePngBuffers(syntheticBaseline, syntheticMaterialChange);
assert.equal(materialComparison.ok, false, "a broad panel/content change must fail the evidence gate");
assert.ok(materialComparison.reasons.length > 0, "material changes report actionable comparator reasons");
const fontRasterComparison = comparePngBuffers(syntheticFontRasterBaseline, syntheticFontRasterVariation);
assert.equal(fontRasterComparison.ok, true,
  `ordinary font raster variation should pass the evidence gate: ${JSON.stringify(fontRasterComparison)}`);
const layoutComparison = comparePngBuffers(syntheticBaseline, syntheticLayoutChange);
assert.equal(layoutComparison.ok, false, `a layout shift must fail the PNG evidence gate: ${JSON.stringify(layoutComparison)}`);
assert.ok(layoutComparison.reasons.length > 0, "layout changes report actionable PNG comparator reasons");
const dimensionComparison = comparePngBuffers(syntheticBaseline, rgbPng(193, 256, (x, y) => scenePixel(x, y)));
assert.equal(dimensionComparison.ok, false, "dimension drift must fail the evidence gate");
assert.match(dimensionComparison.reasons[0], /dimensions changed/);

console.log("UI screen catalogue evidence gate: 23 states, 59 captures, structural and perceptual checks covered");
