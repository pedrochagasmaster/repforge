#!/usr/bin/env node
/**
 * Compare the committed UI screen catalog with a freshly captured baseline.
 *
 * Browser screenshot bytes are not stable across hosted runners: font
 * rasterisation and anti-aliasing can change without changing the rendered
 * layout or copy. This comparator therefore checks the PNG dimensions
 * exactly, then compares deterministic low-resolution colour, luminance-edge,
 * and histogram features. The thresholds are deliberately kept here and
 * covered by synthetic tests in test/ui-screen-catalogue.mjs.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { compareSemanticBuffers } from "./ui-screens/semantics.mjs";
import { ROOT as REPO_ROOT, capturePath, expandCaptures, loadManifest } from "./ui-screens/manifest.mjs";

const MANIFEST = loadManifest();
const CURRENT_ROOT = join(REPO_ROOT, MANIFEST.artifactRoot);
const CURRENT_SEMANTIC_PATH = join(REPO_ROOT, "docs", "ui-screens", "entry-semantics.json");
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

/**
 * Where each grid cell takes its samples.
 *
 * The columns depend only on gx and the rows only on gy, so both collapse to
 * two small tables that are reused for every frame of a given size. The
 * decoder below walks rows once, in order, which is what lets it accumulate
 * each cell's four samples in exactly the order the original two nested
 * ratio loops produced them — the sums are floating point, so that order is
 * part of the result, not an implementation detail.
 */
function sampleGrid(width, height) {
  const columns = new Int32Array(GRID_WIDTH * SAMPLE_OFFSETS.length);
  for (let gx = 0; gx < GRID_WIDTH; gx++) {
    const x0 = gx * width / GRID_WIDTH;
    const x1 = (gx + 1) * width / GRID_WIDTH;
    for (let i = 0; i < SAMPLE_OFFSETS.length; i++) {
      columns[gx * SAMPLE_OFFSETS.length + i] = Math.min(width - 1, Math.floor(x0 + (x1 - x0) * SAMPLE_OFFSETS[i]));
    }
  }
  // rowPlan[y] lists the (gy, slot) pairs sampling that row, pushed gy-ascending
  // and slot-ascending so a cell whose two sampled rows collapse to one still
  // accumulates its slots in order.
  const rowPlan = new Map();
  let lastRow = 0;
  for (let gy = 0; gy < GRID_HEIGHT; gy++) {
    const y0 = gy * height / GRID_HEIGHT;
    const y1 = (gy + 1) * height / GRID_HEIGHT;
    for (let slot = 0; slot < SAMPLE_OFFSETS.length; slot++) {
      const y = Math.min(height - 1, Math.floor(y0 + (y1 - y0) * SAMPLE_OFFSETS[slot]));
      if (!rowPlan.has(y)) rowPlan.set(y, []);
      rowPlan.get(y).push(gy);
      if (y > lastRow) lastRow = y;
    }
  }
  return { columns, rowPlan, lastRow };
}

/** Composite one pixel over white, exactly as the full-image decoder did. */
function compositePixel(row, source, channels, out) {
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
  out[0] = red;
  out[1] = green;
  out[2] = blue;
}

/**
 * Everything that can be checked without inflating: the signature, a
 * well-formed IHDR, a supported encoding, and the presence of pixel data.
 * Split out so a comparison that never needs pixels can still reject a
 * malformed file, and so the dimensions are available for the price of a
 * chunk walk rather than a full decode.
 */
function readPngChunks(buffer, label = "PNG") {
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
  return { header, channels, idat };
}

function parsePng(buffer, label = "PNG") {
  const { header, channels, idat } = readPngChunks(buffer, label);
  const rowBytes = header.width * channels;
  const inflated = inflateSync(Buffer.concat(idat));
  const expected = header.height * (rowBytes + 1);
  if (inflated.length < expected) throw new Error(`${label}: truncated scanline data`);

  /*
   * Decode straight into the feature grid.
   *
   * The grid reads four pixels per cell — 96×128×4 — so materialising every
   * pixel of a 780×1688 frame first threw away about 96% of the work, and the
   * per-byte filter branch made the rest slower than it needed to be. Rows are
   * still unfiltered in order because each one is defined against the row above
   * it, but only the sampled columns of sampled rows are ever composited, and
   * the branch is hoisted into one specialised loop per filter type.
   */
  const { columns, rowPlan, lastRow } = sampleGrid(header.width, header.height);
  const cells = GRID_WIDTH * GRID_HEIGHT;
  const totals = new Float64Array(cells * 4);
  const pixel = [0, 0, 0];
  let current = new Uint8Array(rowBytes);
  let previous = new Uint8Array(rowBytes);
  let sourceOffset = 0;

  for (let y = 0; y <= lastRow; y++) {
    const filterType = inflated[sourceOffset++];
    const base = sourceOffset;
    sourceOffset += rowBytes;
    if (filterType === 0) {
      for (let i = 0; i < rowBytes; i++) current[i] = inflated[base + i];
    } else if (filterType === 1) {
      for (let i = 0; i < channels; i++) current[i] = inflated[base + i];
      for (let i = channels; i < rowBytes; i++) current[i] = (inflated[base + i] + current[i - channels]) & 0xff;
    } else if (filterType === 2) {
      for (let i = 0; i < rowBytes; i++) current[i] = (inflated[base + i] + previous[i]) & 0xff;
    } else if (filterType === 3) {
      for (let i = 0; i < channels; i++) current[i] = (inflated[base + i] + (previous[i] >> 1)) & 0xff;
      for (let i = channels; i < rowBytes; i++) {
        current[i] = (inflated[base + i] + ((current[i - channels] + previous[i]) >> 1)) & 0xff;
      }
    } else if (filterType === 4) {
      for (let i = 0; i < channels; i++) current[i] = (inflated[base + i] + previous[i]) & 0xff;
      for (let i = channels; i < rowBytes; i++) {
        current[i] = (inflated[base + i] + paeth(current[i - channels], previous[i], previous[i - channels])) & 0xff;
      }
    } else {
      throw new Error(`${label}: unsupported PNG filter ${filterType}`);
    }

    const sampling = rowPlan.get(y);
    if (sampling) {
      for (const gy of sampling) {
        for (let gx = 0; gx < GRID_WIDTH; gx++) {
          const target = (gy * GRID_WIDTH + gx) * 4;
          for (let i = 0; i < SAMPLE_OFFSETS.length; i++) {
            compositePixel(current, columns[gx * SAMPLE_OFFSETS.length + i] * channels, channels, pixel);
            totals[target] += pixel[0] / 255;
            totals[target + 1] += pixel[1] / 255;
            totals[target + 2] += pixel[2] / 255;
            totals[target + 3] += luma(pixel[0], pixel[1], pixel[2]);
          }
        }
      }
    }
    const swap = previous;
    previous = current;
    current = swap;
  }

  const samplesPerCell = SAMPLE_OFFSETS.length * SAMPLE_OFFSETS.length;
  const values = new Float32Array(cells * 4);
  const histogram = new Float32Array(16);
  for (let cell = 0; cell < cells; cell++) {
    const index = cell * 4;
    values[index] = totals[index] / samplesPerCell;
    values[index + 1] = totals[index + 1] / samplesPerCell;
    values[index + 2] = totals[index + 2] / samplesPerCell;
    const light = totals[index + 3] / samplesPerCell;
    values[index + 3] = light;
    histogram[Math.min(15, Math.floor(light * 16))]++;
  }
  for (let i = 0; i < histogram.length; i++) histogram[i] /= cells;

  return { width: header.width, height: header.height, features: { values, histogram } };
}

function luma(red, green, blue) {
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
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
  /*
   * Identical bytes cannot have drifted, so there is nothing to measure. This
   * is the ordinary case for a determinism run on one machine, where the whole
   * catalog short-circuits; a hosted runner re-rasterises text and falls
   * through to the perceptual comparison below, which is the case the
   * thresholds exist for. The header is still parsed so a malformed file is
   * reported rather than waved through on its own corruption.
   */
  if (Buffer.isBuffer(baselineBuffer) && Buffer.isBuffer(currentBuffer) && baselineBuffer.equals(currentBuffer)) {
    try {
      const { header } = readPngChunks(baselineBuffer, "baseline");
      return {
        width: header.width,
        height: header.height,
        ok: true,
        meanCellDelta: 0,
        changedCellRatio: 0,
        meanEdgeDelta: 0,
        changedEdgeRatio: 0,
        histogramDelta: 0,
        reasons: [],
      };
    } catch (error) {
      return { ok: false, reasons: [error.message] };
    }
  }
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
  const features = compareFeatures(baseline.features, current.features, effectiveThresholds);
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

/**
 * Compare every frame the manifest registers, not one favoured subtree. The
 * previous gate diffed only docs/ui-screens/program-entry, which is how the
 * numbered light/dark catalog drifted 131 commits behind the code while CI
 * stayed green.
 */
export function compareCatalog({
  baselineRoot,
  currentRoot = CURRENT_ROOT,
  baselineSemanticPath,
  currentSemanticPath = CURRENT_SEMANTIC_PATH,
  manifest = MANIFEST,
  thresholds = DEFAULT_THRESHOLDS,
} = {}) {
  const semantic = compareSemanticFiles(
    baselineSemanticPath || join(dirname(baselineRoot), "entry-semantics.json"),
    currentSemanticPath,
  );
  const captures = expandCaptures(manifest);
  const failures = [];
  let compared = 0;
  for (const capture of captures) {
    const baselinePath = capturePath(manifest, capture, baselineRoot);
    const currentPath = capturePath(manifest, capture, currentRoot);
    const label = relative(currentRoot, currentPath);
    const result = comparePngFiles(baselinePath, currentPath, thresholds);
    const viewport = manifest.viewports[capture.viewport];
    const expectedWidth = viewport.width * manifest.deviceScaleFactor;
    const expectedHeight = viewport.height * manifest.deviceScaleFactor;
    if (result.ok && (result.width !== expectedWidth || result.height !== expectedHeight)) {
      result.ok = false;
      result.reasons = [`dimensions are ${result.width}\u00d7${result.height}, expected ${expectedWidth}\u00d7${expectedHeight}`];
    }
    if (!result.ok) failures.push({ path: label, reasons: result.reasons });
    else compared++;
  }
  return { ok: failures.length === 0 && semantic.ok, expected: captures.length, compared, failures, semantic };
}

function parseArgs(args) {
  const baselineIndex = args.indexOf("--baseline");
  if (baselineIndex < 0 || !args[baselineIndex + 1]) {
    throw new Error("usage: node tools/compare-ui-screens.mjs --baseline <immutable-baseline-root> [--baseline-semantic <file>]");
  }
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
    const report = compareCatalog(args);
    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`Perceptual comparison: ${report.compared}/${report.expected} frames match the committed catalog`);
      for (const failure of report.failures.slice(0, 24)) console.log(`  - ${failure.path}: ${failure.reasons.join("; ")}`);
      if (report.failures.length > 24) console.log(`  ... ${report.failures.length - 24} more failure(s)`);
      console.log(`Semantic comparison: ${report.semantic.ok ? "exact match" : "failed"}`);
      for (const reason of (report.semantic.reasons || []).slice(0, 12)) console.log(`  - ${reason}`);
      if (!report.ok) {
        console.log("\nThe committed catalog no longer matches the app. Regenerate it:");
        console.log("  node tools/capture-ui-screens.mjs");
      }
    }
    process.exitCode = report.ok ? 0 : 1;
  } catch (error) {
    console.error(`\u2717 ${error.message}`);
    process.exitCode = 1;
  }
}
