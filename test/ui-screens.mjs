#!/usr/bin/env node
/**
 * Self-test for the UI screen catalog manifest, gates and comparators.
 *
 * Pure Node: no browser, no server, and it never rewrites committed evidence.
 * It proves the registry is complete and mobile-only, that CI actually diffs
 * the whole catalog, that the install transaction rolls back, and that the
 * perceptual comparator separates font-raster noise from real layout and
 * copy changes.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { replaceCatalog } from "../tools/capture-ui-screens.mjs";
import { compareCatalog, comparePngBuffers } from "../tools/compare-ui-screens.mjs";
import { checkCatalog } from "../tools/check-ui-screens.mjs";
import { expandCaptures, loadManifest, variantSlug } from "../tools/ui-screens/manifest.mjs";
import { APP_SCENARIOS } from "../tools/ui-screens/screens-app.mjs";
import { ONBOARDING_SCENARIOS } from "../tools/ui-screens/screens-onboarding.mjs";
import {
  compareSemanticArtifacts, normalizeSemanticRecords, normalizeSemanticValue, validateSemanticArtifact,
} from "../tools/ui-screens/semantics.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const manifest = loadManifest();
const captures = expandCaptures(manifest);
const workflow = readFileSync(resolve(root, ".github/workflows/simulation.yml"), "utf8");
const toolsReadme = readFileSync(resolve(root, "tools/README.md"), "utf8");
const capture = readFileSync(resolve(root, "tools/capture-ui-screens.mjs"), "utf8");
const session = readFileSync(resolve(root, "tools/ui-screens/session.mjs"), "utf8");
const scenarios = { ...APP_SCENARIOS, ...ONBOARDING_SCENARIOS };

// ---------------------------------------------------------------- registry

assert.ok(manifest.screens.length >= 60, "the catalog covers the whole app, not a favoured subset");
for (const screen of manifest.screens) {
  const key = `${screen.flow}/${screen.id}`;
  assert.ok(scenarios[key], `${key} has a capture scenario`);
  assert.doesNotMatch(screen.id, /^\d/, `${key} does not carry an ordinal prefix`);
}
for (const key of Object.keys(scenarios)) {
  assert.ok(manifest.screens.some((screen) => `${screen.flow}/${screen.id}` === key),
    `scenario ${key} is registered in the manifest`);
}

// Every onboarding route in ROUTE_STEPS must be represented by more than its
// entrance. A route covered only by its first step is how the catalog drifted.
const entrySource = readFileSync(resolve(root, "program-entry.js"), "utf8");
const routes = JSON.parse(
  entrySource.match(/const ROUTES = Object\.freeze\((\[[^\]]*\])\)/)[1].replace(/'/g, '"')
);
for (const route of routes) {
  if (route === "shared") continue; // shared enters straight at preview; both surfaces are covered below
  const flow = `onboarding-${route}`;
  const covered = manifest.screens.filter((screen) => screen.flow === flow);
  assert.ok(covered.length >= 2, `route ${route} is covered by more than one screen (${covered.length})`);
}
for (const key of ["onboarding-shared/gate", "onboarding-shared/preview"]) {
  assert.ok(scenarios[key], `${key} is covered`);
}

// ------------------------------------------------------------- mobile only

for (const [id, viewport] of Object.entries(manifest.viewports)) {
  assert.match(id, /^phone-/, `viewport ${id} is a phone`);
  assert.ok(viewport.width <= 480, `viewport ${id} is a phone width`);
}
assert.equal(JSON.stringify(manifest).includes("desktop"), false, "no desktop viewport survives in the manifest");

// ---------------------------------------------------------------- variants

assert.equal(variantSlug({ viewport: "phone-390", theme: "light", locale: "en", text: "normal", motion: "normal" }),
  "phone-390-light-en", "default variants stay short");
assert.equal(variantSlug({ viewport: "phone-390", theme: "light", locale: "en", text: "text200", motion: "reduced" }),
  "phone-390-light-en-text200-reduced", "non-default axes are named");
for (const set of Object.values(manifest.variantSets)) {
  assert.deepEqual(set[0], { viewport: "phone-390", theme: "light", locale: "en", text: "normal", motion: "normal" },
    "every variant set leads with the canonical frame");
}
for (const screen of manifest.screens) {
  const set = manifest.variantSets[screen.variants];
  assert.ok(set.some((v) => v.theme === "dark"), `${screen.flow}/${screen.id} has a dark frame`);
}
for (const screen of manifest.screens.filter((s) => s.flow.startsWith("onboarding"))) {
  const set = manifest.variantSets[screen.variants];
  assert.ok(set.some((v) => v.locale === "pt"), `${screen.flow}/${screen.id} has a Portuguese frame`);
}
for (const screen of manifest.screens.filter((s) => s.variants === "standard")) {
  const set = manifest.variantSets[screen.variants];
  assert.ok(set.some((v) => v.locale === "pt" && v.text === "normal"),
    `${screen.flow}/${screen.id} has PT-BR normal coverage`);
}
const demandingScreens = new Set([
  "onboarding-custom/schedule",
  "onboarding-custom/priorities",
  "onboarding-recommend/result",
  "onboarding-build/editor-empty",
  "onboarding-build/editor-partial",
  "onboarding-build/editor-ready",
  "onboarding-import/preview",
  "progress/review",
  "history/session",
  // The current app has no later Plan-057 Share-repair blocker. Cover both
  // nearest reachable share boundaries until that isolated module exists.
  "onboarding-shared/gate",
  "program/share-setup",
]);
for (const key of demandingScreens) {
  const screen = manifest.screens.find((item) => `${item.flow}/${item.id}` === key);
  assert.ok(screen, `${key} is a registered demanding screen`);
  assert.equal(screen.variants, "demandingText", `${key} uses the named demanding text matrix`);
}
const demandingSet = manifest.variantSets.demandingText;
for (const priorAxis of manifest.variantSets.accessibility) {
  assert.ok(demandingSet.some((variant) =>
    variant.viewport === priorAxis.viewport && variant.theme === priorAxis.theme &&
    variant.locale === priorAxis.locale && variant.text === priorAxis.text && variant.motion === priorAxis.motion),
  `demanding text matrix retains the existing accessibility axis ${variantSlug(priorAxis)}`);
}
assert.ok(demandingSet.some((v) => v.locale === "en" && v.text === "text200"),
  "demanding text matrix retains English 200% coverage");
assert.ok(demandingSet.some((v) => v.locale === "pt" && v.text === "text200"),
  "demanding text matrix adds PT-BR 200% coverage");
assert.doesNotMatch(capture, /CATALOG_CONTRACT/, "capture runs the catalog contract for every manifest variant without opt-in");

// --------------------------------------------------------------------- CI

assert.match(workflow, /baseline="\$\(mktemp -d\)"/, "CI snapshots a private baseline before regenerating");
assert.match(workflow, /cp -a docs\/ui-screens\/screens "\$baseline\/"/, "CI baselines the whole screen tree");
assert.match(workflow, /cp -a docs\/ui-screens\/entry-semantics\.json "\$baseline\/"/, "CI baselines semantic evidence");
assert.match(workflow, /chmod -R a-w "\$baseline"/, "CI makes the baseline read-only");
assert.match(workflow, /trap cleanup EXIT/, "CI cleans its baseline up on exit");
assert.match(workflow, /node tools\/check-ui-screens\.mjs/, "CI runs the registration gate");
assert.match(workflow, /node tools\/compare-ui-screens\.mjs --baseline "\$baseline\/screens"/,
  "CI compares every regenerated frame with the baseline");
assert.match(workflow, /--baseline-semantic "\$baseline\/entry-semantics\.json"/,
  "CI compares regenerated semantic evidence");
assert.doesNotMatch(workflow, /git diff --exit-code -- docs\/ui-screens/, "CI does not byte-compare rasterised evidence");
const order = ["cp -a docs/ui-screens/screens", "node tools/capture-ui-screens.mjs",
  "node tools/check-ui-screens.mjs", "node tools/compare-ui-screens.mjs"].map((needle) => workflow.indexOf(needle));
assert.ok(order.every((index, i) => index >= 0 && (i === 0 || index > order[i - 1])),
  "CI baselines, captures, checks, then compares");
assert.match(toolsReadme, /node tools\/capture-ui-screens\.mjs/, "the tools README documents the capture command");

// ------------------------------------------------------------ determinism

assert.match(session, /const CAPTURE_NOW = process\.env\.CAPTURE_NOW \|\| "2026-08-31T12:00:00\.000Z"/,
  "date-bearing surfaces use a stable fixture clock");
assert.match(session, /page\.addInitScript\(/, "the fixture clock is installed before the page boots");
assert.match(session, /timezoneId: "UTC"/, "the browser timezone is pinned");
assert.match(session, /locale: locale\.browserLocale/, "the browser locale is pinned");
assert.match(session, /serviceWorkers: "block"/, "a stale installed shell cannot serve the capture");
assert.match(capture, /collectProgramEntrySemantics/, "onboarding frames record semantics from the page");
assert.match(capture, /normalizeSemanticRecords/, "collected Program JSON goes through the shared Node seam");


// --------------------------------------------- committed evidence, if built

const screensRoot = resolve(root, manifest.artifactRoot);
const semanticPath = resolve(root, "docs/ui-screens/entry-semantics.json");
if (existsSync(screensRoot) && existsSync(semanticPath)) {
  const problems = checkCatalog(manifest, screensRoot);
  assert.deepEqual(problems, [], `the committed catalog is complete: ${problems.slice(0, 5).join("; ")}`);

  const semanticArtifact = JSON.parse(readFileSync(semanticPath, "utf8"));
  const semanticValidation = validateSemanticArtifact(semanticArtifact);
  assert.equal(semanticValidation.ok, true, `semantic evidence is valid: ${semanticValidation.reasons.join("; ")}`);
  const onboardingCaptures = captures.filter((item) => item.flow.startsWith("onboarding"));
  assert.equal(semanticArtifact.captures.length, onboardingCaptures.length,
    "every onboarding frame carries semantic evidence");

  // Visually hidden helper copy must never enter the evidence.
  assert.equal(
    semanticArtifact.captures.some((item) => item.semantic.some((entry) => entry.text === "Unavailable with your current choices")),
    false, "semantic evidence excludes visually hidden helper copy");

  // A copy change must fail the semantic gate.
  const drift = JSON.parse(JSON.stringify(semanticArtifact));
  const textEntry = drift.captures[0].semantic.find((entry) => entry.text);
  assert.ok(textEntry, "semantic baseline contains visible text");
  textEntry.text = "Changed visible copy";
  const driftComparison = compareSemanticArtifacts(semanticArtifact, drift);
  assert.equal(driftComparison.ok, false, "copy changes fail semantic comparison");
  assert.match(driftComparison.reasons.join("; "), /semantic text\/state changed/);
  assert.ok(driftComparison.reasons.every((reason) => reason.length < 500), "comparison details stay bounded");

  // The committed catalog is its own valid baseline: exercises the manifest
  // walk and the dimension checks without letting a test rewrite evidence.
  const selfComparison = compareCatalog({ baselineRoot: screensRoot, currentRoot: screensRoot });
  assert.equal(selfComparison.expected, captures.length);
  assert.equal(selfComparison.compared, captures.length);
  assert.equal(selfComparison.failures.length, 0);
  assert.equal(selfComparison.semantic.ok, true);
}

// ------------------------------------------------------------- transaction

// A failed swap must roll back the old catalog. This exercises the filesystem
// transaction without launching Chromium or touching committed evidence.
{
  const testRoot = mkdtempSync(join(tmpdir(), "repforge-catalog-test-"));
  const target = join(testRoot, "screens");
  const staging = join(testRoot, "staging");
  mkdirSync(target); mkdirSync(staging);
  writeFileSync(join(target, "old.png"), "old");
  writeFileSync(join(staging, "new.png"), "new");
  assert.throws(() => replaceCatalog(staging, target, {
    rename(source, destination) {
      if (source === staging && destination === target) throw new Error("injected swap failure");
      renameSync(source, destination);
    },
  }), /injected swap failure/);
  assert.equal(readFileSync(join(target, "old.png"), "utf8"), "old");
  assert.equal(existsSync(join(target, "new.png")), false);
  assert.equal(existsSync(join(staging, "new.png")), true);
  rmSync(testRoot, { recursive: true, force: true });
}

// A cleanup failure after the swap must not discard the newly installed tree.
{
  const testRoot = mkdtempSync(join(tmpdir(), "repforge-catalog-cleanup-"));
  const target = join(testRoot, "screens");
  const staging = join(testRoot, "staging");
  const backup = `${target}.backup-${basename(staging)}`;
  mkdirSync(target); mkdirSync(staging);
  writeFileSync(join(target, "old.png"), "old");
  writeFileSync(join(staging, "new.png"), "new");
  assert.doesNotThrow(() => replaceCatalog(staging, target, {
    remove(path, options) {
      if (path === backup) throw new Error("injected backup cleanup failure");
      rmSync(path, options);
    },
  }));
  assert.equal(readFileSync(join(target, "new.png"), "utf8"), "new");
  assert.equal(readFileSync(join(backup, "old.png"), "utf8"), "old");
  rmSync(testRoot, { recursive: true, force: true });
}

// The CI baseline is read-only while captures run. Prove the exact shell
// cleanup still succeeds and removes that protected tree.
{
  const testRoot = mkdtempSync(join(tmpdir(), "repforge-baseline-cleanup-"));
  const baseline = join(testRoot, "baseline");
  const probe = spawnSync("/bin/bash", ["-euo", "pipefail", "-c", `
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
  `, "baseline-cleanup", baseline], { encoding: "utf8" });
  assert.equal(probe.status, 0, `read-only baseline cleanup succeeds: ${probe.stderr}`);
  assert.equal(existsSync(baseline), false, "read-only baseline cleanup removes the protected tree");
  rmSync(testRoot, { recursive: true, force: true });
}

// ------------------------------------------------- semantic normalization

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

// ------------------------------------------------- perceptual comparator

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

console.log(
  `UI screen catalog gate: ${manifest.screens.length} screens, ${captures.length} frames, `
  + "registry, mobile-only, CI wiring, transaction and comparator checks covered"
);
