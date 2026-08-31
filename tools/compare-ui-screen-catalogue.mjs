#!/usr/bin/env node
/**
 * Compare the Plan 048 program-entry screenshots with a committed baseline.
 *
 * Browser screenshot bytes are not stable across hosted runners: font
 * rasterisation and anti-aliasing can change without changing the rendered
 * layout or copy. This comparator therefore checks the PNG dimensions
 * exactly, then compares deterministic low-resolution colour, luminance-edge,
 * and histogram features. The thresholds are deliberately kept here and
 * covered by synthetic tests in test/ui-screen-catalogue.mjs.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { compareSemanticBuffers } from "./program-entry-semantic.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = join(ROOT, "docs", "ui-screens", "program-entry-manifest.json");
const CURRENT_ROOT = join(ROOT, "docs", "ui-screens", "program-entry");
const CURRENT_SEMANTIC_PATH = join(ROOT, "docs", "ui-screens", "program-entry-semantic.json");
const GRID_WIDTH = 96;
const GRID_HEIGHT = 128;
const SAMPLE_OFFSETS = [0.25, 0.75];

// A cell must change by at least this perceptual amount before it counts as
// changed. The aggregate limits allow small anti-aliasing differences around
// text while rejecting coordinated layout, colour, or copy changes.
export const DEFAULT_THRESHOLDS = Object.freeze({
  changedCellDelta: 0.08,
  maxChangedCellRatio: 0.045,
  maxMeanCellDelta: 0.018,
  maxMeanEdgeDelta: 0.025,
  maxChangedEdgeRatio: 0.08,
  maxHistogramDelta: 0.08,
  materialMeanCellDelta: 0.035,
  materialHistogramDelta: 0.16,
});

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function parsePng(buffer, label = "PNG") {
  if (!Buffer.isBuffer(buffer) || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${label}: invalid PNG signature`);
  }
  let offset = 8;
  let header = null;
  const idat = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > buffer.length) throw new Error(`${label}: truncated ${type} chunk`);
    const data = buffer.subarray(start, end);
    if (type === "IHDR") {
      if (length !== 13) throw new Error(`${label}: invalid IHDR`);
      header = {
        width: buffer.readUInt32BE(start),
        height: buffer.readUInt32BE(start + 4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset = end + 4;
  }
  if (!header) throw new Error(`${label}: missing IHDR`);
  if (!idat.length) throw new Error(`${label}: missing IDAT`);
  if (header.bitDepth !== 8 || header.compression !== 0 || header.filter !== 0 || header.interlace !== 0) {
    throw new Error(`${label}: unsupported PNG encoding (requires 8-bit, non-interlaced PNG)`);
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[header.colorType];
  if (!channels) throw new Error(`${label}: unsupported PNG colour type ${header.colorType}`);
  if (!header.width || !header.height) throw new Error(`${label}: invalid dimensions`);

  const rowBytes = header.width * channels;
  const inflated = inflateSync(Buffer.concat(idat));
  const expected = header.height * (rowBytes + 1);
  if (inflated.length < expected) throw new Error(`${label}: truncated scanline data`);
  const rgb = Buffer.alloc(header.width * header.height * 3);
  let sourceOffset = 0;
  let previous = Buffer.alloc(rowBytes);
  for (let y = 0; y < header.height; y++) {
    const filterType = inflated[sourceOffset++];
    const filtered = inflated.subarray(sourceOffset, sourceOffset + rowBytes);
    sourceOffset += rowBytes;
    const row = Buffer.alloc(rowBytes);
    for (let i = 0; i < rowBytes; i++) {
      const left = i >= channels ? row[i - channels] : 0;
      const above = previous[i] || 0;
      const upperLeft = i >= channels ? previous[i - channels] : 0;
      const value = filtered[i];
      if (filterType === 0) row[i] = value;
      else if (filterType === 1) row[i] = (value + left) & 0xff;
      else if (filterType === 2) row[i] = (value + above) & 0xff;
      else if (filterType === 3) row[i] = (value + Math.floor((left + above) / 2)) & 0xff;
      else if (filterType === 4) row[i] = (value + paeth(left, above, upperLeft)) & 0xff;
      else throw new Error(`${label}: unsupported PNG filter ${filterType}`);
    }
    for (let x = 0; x < header.width; x++) {
      const source = x * channels;
      const target = (y * header.width + x) * 3;
      let red = row[source];
      let green = channels >= 3 ? row[source + 1] : red;
      let blue = channels >= 3 ? row[source + 2] : red;
      if (channels === 2 || channels === 4) {
        const alpha = (channels === 2 ? row[source + 1] : row[source + 3]) / 255;
        if (channels === 2) green = blue = red;
        red = Math.round(red * alpha + 255 * (1 - alpha));
        green = Math.round(green * alpha + 255 * (1 - alpha));
        blue = Math.round(blue * alpha + 255 * (1 - alpha));
      }
      rgb[target] = red;
      rgb[target + 1] = green;
      rgb[target + 2] = blue;
    }
    previous = row;
  }
  return { width: header.width, height: header.height, rgb };
}

function luma(red, green, blue) {
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}

function sample(image) {
  const values = new Float32Array(GRID_WIDTH * GRID_HEIGHT * 4);
  const histogram = new Float32Array(16);
  for (let gy = 0; gy < GRID_HEIGHT; gy++) {
    const y0 = gy * image.height / GRID_HEIGHT;
    const y1 = (gy + 1) * image.height / GRID_HEIGHT;
    for (let gx = 0; gx < GRID_WIDTH; gx++) {
      const x0 = gx * image.width / GRID_WIDTH;
      const x1 = (gx + 1) * image.width / GRID_WIDTH;
      let red = 0;
      let green = 0;
      let blue = 0;
      let light = 0;
      for (const yRatio of SAMPLE_OFFSETS) {
        const y = Math.min(image.height - 1, Math.floor(y0 + (y1 - y0) * yRatio));
        for (const xRatio of SAMPLE_OFFSETS) {
          const x = Math.min(image.width - 1, Math.floor(x0 + (x1 - x0) * xRatio));
          const index = (y * image.width + x) * 3;
          const r = image.rgb[index] / 255;
          const g = image.rgb[index + 1] / 255;
          const b = image.rgb[index + 2] / 255;
          red += r; green += g; blue += b; light += luma(image.rgb[index], image.rgb[index + 1], image.rgb[index + 2]);
        }
      }
      const index = (gy * GRID_WIDTH + gx) * 4;
      values[index] = red / 4;
      values[index + 1] = green / 4;
      values[index + 2] = blue / 4;
      values[index + 3] = light / 4;
      histogram[Math.min(15, Math.floor((light / 4) * 16))]++;
    }
  }
  for (let i = 0; i < histogram.length; i++) histogram[i] /= GRID_WIDTH * GRID_HEIGHT;
  return { values, histogram };
}

function cellColourDelta(first, second, index) {
  const red = first.values[index] - second.values[index];
  const green = first.values[index + 1] - second.values[index + 1];
  const blue = first.values[index + 2] - second.values[index + 2];
  return Math.sqrt(0.299 * red * red + 0.587 * green * green + 0.114 * blue * blue);
}

function compareFeatures(first, second, thresholds = DEFAULT_THRESHOLDS) {
  const cells = GRID_WIDTH * GRID_HEIGHT;
  let changedCells = 0;
  let meanCellDelta = 0;
  for (let cell = 0; cell < cells; cell++) {
    const delta = cellColourDelta(first, second, cell * 4);
    meanCellDelta += delta;
    if (delta >= thresholds.changedCellDelta) changedCells++;
  }
  meanCellDelta /= cells;

  let edgeDelta = 0;
  let changedEdges = 0;
  let edgeCount = 0;
  const edge = (index, neighbour) => Math.abs(first.values[index + 3] - first.values[neighbour + 3]);
  const edgeOther = (index, neighbour) => Math.abs(second.values[index + 3] - second.values[neighbour + 3]);
  for (let gy = 0; gy < GRID_HEIGHT; gy++) {
    for (let gx = 0; gx < GRID_WIDTH; gx++) {
      const index = (gy * GRID_WIDTH + gx) * 4;
      if (gx + 1 < GRID_WIDTH) {
        const delta = Math.abs(edge(index, index + 4) - edgeOther(index, index + 4));
        edgeDelta += delta;
        if (delta >= thresholds.changedCellDelta) changedEdges++;
        edgeCount++;
      }
      if (gy + 1 < GRID_HEIGHT) {
        const delta = Math.abs(edge(index, index + GRID_WIDTH * 4) - edgeOther(index, index + GRID_WIDTH * 4));
        edgeDelta += delta;
        if (delta >= thresholds.changedCellDelta) changedEdges++;
        edgeCount++;
      }
    }
  }
  edgeDelta /= edgeCount;

  let histogramDelta = 0;
  for (let i = 0; i < first.histogram.length; i++) histogramDelta += Math.abs(first.histogram[i] - second.histogram[i]);
  histogramDelta /= 2;

  const changedCellRatio = changedCells / cells;
  const changedEdgeRatio = changedEdges / edgeCount;
  const reasons = [];
  if (meanCellDelta > thresholds.materialMeanCellDelta) reasons.push(`mean colour delta ${(meanCellDelta * 100).toFixed(2)}% exceeds ${(thresholds.materialMeanCellDelta * 100).toFixed(2)}%`);
  if (changedCellRatio > thresholds.maxChangedCellRatio) reasons.push(`changed-cell ratio ${(changedCellRatio * 100).toFixed(2)}% exceeds ${(thresholds.maxChangedCellRatio * 100).toFixed(2)}%`);
  if (meanCellDelta > thresholds.maxMeanCellDelta && changedCellRatio > 0.012) reasons.push("colour change is broad rather than isolated raster noise");
  if (edgeDelta > thresholds.maxMeanEdgeDelta && changedEdgeRatio > thresholds.maxChangedEdgeRatio) reasons.push("edge structure changed across the capture");
  if (histogramDelta > thresholds.materialHistogramDelta) reasons.push(`luminance histogram delta ${(histogramDelta * 100).toFixed(2)}% exceeds ${(thresholds.materialHistogramDelta * 100).toFixed(2)}%`);
  if (histogramDelta > thresholds.maxHistogramDelta && meanCellDelta > 0.008) reasons.push("colour distribution changed with visible cell deltas");
  return {
    ok: reasons.length === 0,
    meanCellDelta,
    changedCellRatio,
    meanEdgeDelta: edgeDelta,
    changedEdgeRatio,
    histogramDelta,
    reasons,
  };
}

export function comparePngBuffers(baselineBuffer, currentBuffer, thresholds = DEFAULT_THRESHOLDS) {
  let baseline;
  let current;
  try {
    baseline = parsePng(baselineBuffer, "baseline");
    current = parsePng(currentBuffer, "current");
  } catch (error) {
    return { ok: false, reasons: [error.message] };
  }
  if (baseline.width !== current.width || baseline.height !== current.height) {
    return {
      ok: false,
      width: current.width,
      height: current.height,
      baselineWidth: baseline.width,
      baselineHeight: baseline.height,
      reasons: [`dimensions changed from ${baseline.width}×${baseline.height} to ${current.width}×${current.height}`],
    };
  }
  const effectiveThresholds = { ...DEFAULT_THRESHOLDS, ...(thresholds || {}) };
  const features = compareFeatures(sample(baseline), sample(current), effectiveThresholds);
  return {
    width: current.width,
    height: current.height,
    ...features,
  };
}

export function comparePngFiles(baselinePath, currentPath, thresholds = DEFAULT_THRESHOLDS) {
  if (!existsSync(baselinePath)) return { ok: false, reasons: [`missing baseline ${baselinePath}`] };
  if (!existsSync(currentPath)) return { ok: false, reasons: [`missing regenerated capture ${currentPath}`] };
  return comparePngBuffers(readFileSync(baselinePath), readFileSync(currentPath), thresholds);
}

export function compareSemanticFiles(baselinePath, currentPath) {
  if (!existsSync(baselinePath)) return { ok: false, reasons: [`missing semantic baseline ${baselinePath}`] };
  if (!existsSync(currentPath)) return { ok: false, reasons: [`missing semantic evidence ${currentPath}`] };
  return compareSemanticBuffers(readFileSync(baselinePath), readFileSync(currentPath));
}

function readManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}

function relativePath(manifest, capture) {
  let value = manifest.artifactTemplate;
  for (const [key, replacement] of Object.entries(capture)) value = value.replaceAll(`{${key}}`, replacement);
  return value;
}

export function compareCatalogue({ baselineRoot, currentRoot = CURRENT_ROOT, baselineSemanticPath, currentSemanticPath = CURRENT_SEMANTIC_PATH, manifest = readManifest(), thresholds = DEFAULT_THRESHOLDS }) {
  const semantic = compareSemanticFiles(
    baselineSemanticPath || join(dirname(baselineRoot), "program-entry-semantic.json"),
    currentSemanticPath,
  );
  const failures = [];
  let compared = 0;
  for (const capture of manifest.captures) {
    const path = relativePath(manifest, capture);
    const baselinePath = join(baselineRoot, path);
    const currentPath = join(currentRoot, path);
    const result = comparePngFiles(baselinePath, currentPath, thresholds);
    const viewport = manifest.viewports[capture.viewport];
    const expectedWidth = viewport.width * manifest.deviceScaleFactor;
    const expectedHeight = viewport.height * manifest.deviceScaleFactor;
    if (result.ok && (result.width !== expectedWidth || result.height !== expectedHeight)) {
      result.ok = false;
      result.reasons = [`dimensions are ${result.width}×${result.height}, expected ${expectedWidth}×${expectedHeight}`];
    }
    if (!result.ok) failures.push({ path, reasons: result.reasons });
    else compared++;
  }
  return { ok: failures.length === 0 && semantic.ok, expected: manifest.captures.length, compared, failures, semantic };
}

function parseArgs(args) {
  const baselineIndex = args.indexOf("--baseline");
  if (baselineIndex < 0 || !args[baselineIndex + 1]) throw new Error("usage: node tools/compare-ui-screen-catalogue.mjs --baseline <immutable-baseline-root>");
  const semanticIndex = args.indexOf("--baseline-semantic");
  return {
    baselineRoot: resolve(args[baselineIndex + 1]),
    baselineSemanticPath: semanticIndex >= 0 && args[semanticIndex + 1] ? resolve(args[semanticIndex + 1]) : undefined,
    json: args.includes("--json"),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const report = compareCatalogue(args);
    if (args.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`Program-entry perceptual comparison: ${report.compared}/${report.expected} captures match the committed baseline`);
      for (const failure of report.failures.slice(0, 24)) console.log(`  - ${failure.path}: ${failure.reasons.join("; ")}`);
      if (report.failures.length > 24) console.log(`  ... ${report.failures.length - 24} more failure(s)`);
      console.log(`Program-entry semantic comparison: ${report.semantic.ok ? "exact match" : "failed"}`);
      for (const reason of report.semantic.reasons || []) console.log(`  - ${reason}`);
    }
    process.exitCode = report.ok ? 0 : 1;
  } catch (error) {
    console.error(`✗ ${error.message}`);
    process.exitCode = 1;
  }
}
