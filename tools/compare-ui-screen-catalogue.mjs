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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = join(ROOT, "docs", "ui-screens", "program-entry-manifest.json");
const CURRENT_ROOT = join(ROOT, "docs", "ui-screens", "program-entry");
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
  localizedRegionBlockSize: 8,
  localizedRegionWindowWidth: 32,
  localizedRegionWindowHeight: 16,
  localizedRegionThreshold: 0.12,
  localizedRegionBlockThreshold: 0.18,
  localizedRegionMinBlocks: 2,
  localizedRegionMinRatio: 0.25,
  localizedStructureBlockSize: 4,
  localizedStructureMismatch: 0.22,
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

function pooledLuminance(image, blockSize) {
  const width = Math.ceil(image.width / blockSize);
  const height = Math.ceil(image.height / blockSize);
  const values = new Float32Array(width * height);
  for (let by = 0; by < height; by++) {
    const y0 = by * blockSize;
    const y1 = Math.min(image.height, y0 + blockSize);
    for (let bx = 0; bx < width; bx++) {
      const x0 = bx * blockSize;
      const x1 = Math.min(image.width, x0 + blockSize);
      let total = 0;
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const pixel = (y * image.width + x) * 3;
          total += luma(image.rgb[pixel], image.rgb[pixel + 1], image.rgb[pixel + 2]);
          count++;
        }
      }
      values[by * width + bx] = total / count;
    }
  }
  return { width, height, values };
}

function edgeTopology(pooled) {
  const values = new Float32Array(pooled.width * pooled.height);
  for (let y = 0; y < pooled.height; y++) {
    for (let x = 0; x < pooled.width; x++) {
      const center = pooled.values[y * pooled.width + x];
      const left = pooled.values[y * pooled.width + Math.max(0, x - 1)];
      const right = pooled.values[y * pooled.width + Math.min(pooled.width - 1, x + 1)];
      const above = pooled.values[Math.max(0, y - 1) * pooled.width + x];
      const below = pooled.values[Math.min(pooled.height - 1, y + 1) * pooled.width + x];
      values[y * pooled.width + x] = (Math.abs(center - left) + Math.abs(center - right) +
        Math.abs(center - above) + Math.abs(center - below)) / 4;
    }
  }
  return values;
}

function structuralRegionEquivalent(x, y, width, height, thresholds, structure) {
  const { blockSize, firstPooled, secondPooled, firstEdges, secondEdges } = structure;
  const x0 = Math.max(0, Math.floor(x / blockSize));
  const y0 = Math.max(0, Math.floor(y / blockSize));
  const x1 = Math.min(firstPooled.width, Math.ceil((x + width) / blockSize));
  const y1 = Math.min(firstPooled.height, Math.ceil((y + height) / blockSize));
  const regionWidth = x1 - x0;
  const regionHeight = y1 - y0;
  if (regionWidth < 2 || regionHeight < 2) return false;

  let firstPeak = 0;
  let secondPeak = 0;
  for (let row = y0; row < y1; row++) {
    for (let column = x0; column < x1; column++) {
      firstPeak = Math.max(firstPeak, firstEdges[row * firstPooled.width + column]);
      secondPeak = Math.max(secondPeak, secondEdges[row * secondPooled.width + column]);
    }
  }
  if (firstPeak < 0.01 || secondPeak < 0.01) return false;

  const normalised = (value, peak) => Math.min(1, value / peak);
  let bestMismatch = Infinity;
  for (let offsetY = -1; offsetY <= 1; offsetY++) {
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      let mismatch = 0;
      let cells = 0;
      for (let row = 0; row < regionHeight; row++) {
        for (let column = 0; column < regionWidth; column++) {
          const firstValue = normalised(firstEdges[(y0 + row) * firstPooled.width + x0 + column], firstPeak);
          const secondX = x0 + column + offsetX;
          const secondY = y0 + row + offsetY;
          const secondValue = secondX < 0 || secondX >= secondPooled.width || secondY < 0 || secondY >= secondPooled.height
            ? 0 : normalised(secondEdges[secondY * secondPooled.width + secondX], secondPeak);
          mismatch += Math.abs(firstValue - secondValue);
          cells++;
        }
      }
      bestMismatch = Math.min(bestMismatch, mismatch / cells);
    }
  }
  return bestMismatch < thresholds.localizedStructureMismatch;
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

// A short, dense text change can occupy too little of the low-resolution grid
// to move the global colour/edge thresholds. Compare pooled luminance blocks
// in a small sliding region as well. Pooling over several native pixels makes
// the signal insensitive to font anti-aliasing and one-pixel glyph movement.
// When that absolute signal is high, normalized low-resolution edge topology
// distinguishes raster variation from a coherent label/content change while
// the block support requirement still catches a label-sized material change.
function localizedRegionSignal(first, second, thresholds = DEFAULT_THRESHOLDS) {
  const blockSize = Math.max(1, Math.round(thresholds.localizedRegionBlockSize));
  const blockWidth = Math.ceil(first.width / blockSize);
  const blockHeight = Math.ceil(first.height / blockSize);
  const firstBlocks = new Float32Array(blockWidth * blockHeight);
  const secondBlocks = new Float32Array(blockWidth * blockHeight);
  const structureBlockSize = Math.max(1, Math.round(thresholds.localizedStructureBlockSize));
  const structure = {
    blockSize: structureBlockSize,
    firstPooled: pooledLuminance(first, structureBlockSize),
    secondPooled: pooledLuminance(second, structureBlockSize),
  };
  structure.firstEdges = edgeTopology(structure.firstPooled);
  structure.secondEdges = edgeTopology(structure.secondPooled);
  for (let by = 0; by < blockHeight; by++) {
    const y0 = by * blockSize;
    const y1 = Math.min(first.height, y0 + blockSize);
    for (let bx = 0; bx < blockWidth; bx++) {
      const x0 = bx * blockSize;
      const x1 = Math.min(first.width, x0 + blockSize);
      let firstTotal = 0;
      let secondTotal = 0;
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const pixel = (y * first.width + x) * 3;
          firstTotal += luma(first.rgb[pixel], first.rgb[pixel + 1], first.rgb[pixel + 2]);
          secondTotal += luma(second.rgb[pixel], second.rgb[pixel + 1], second.rgb[pixel + 2]);
          count++;
        }
      }
      const index = by * blockWidth + bx;
      firstBlocks[index] = firstTotal / count;
      secondBlocks[index] = secondTotal / count;
    }
  }

  const windowWidth = Math.max(1, Math.min(blockWidth,
    Math.ceil(Math.max(1, Math.round(thresholds.localizedRegionWindowWidth)) / blockSize)));
  const windowHeight = Math.max(1, Math.min(blockHeight,
    Math.ceil(Math.max(1, Math.round(thresholds.localizedRegionWindowHeight)) / blockSize)));
  const blockThreshold = Number.isFinite(thresholds.localizedRegionBlockThreshold)
    ? thresholds.localizedRegionBlockThreshold : DEFAULT_THRESHOLDS.localizedRegionBlockThreshold;
  let maxMeanDelta = 0;
  let maxChangedBlocks = 0;
  let maxChangedRatio = 0;
  let structuralRasterWindows = 0;
  let meaningfulWindows = 0;
  for (let by = 0; by <= blockHeight - windowHeight; by++) {
    for (let bx = 0; bx <= blockWidth - windowWidth; bx++) {
      let totalDelta = 0;
      let changedBlocks = 0;
      for (let y = by; y < by + windowHeight; y++) {
        for (let x = bx; x < bx + windowWidth; x++) {
          const delta = Math.abs(firstBlocks[y * blockWidth + x] - secondBlocks[y * blockWidth + x]);
          totalDelta += delta;
          if (delta >= blockThreshold) changedBlocks++;
        }
      }
      const area = windowWidth * windowHeight;
      const meanDelta = totalDelta / area;
      const changedRatio = changedBlocks / area;
      const meaningfulWindow = meanDelta >= thresholds.localizedRegionThreshold &&
        changedBlocks >= Math.max(1, Math.round(thresholds.localizedRegionMinBlocks)) &&
        changedRatio >= thresholds.localizedRegionMinRatio;
      if (meaningfulWindow) {
        meaningfulWindows++;
        if (structuralRegionEquivalent(bx * blockSize, by * blockSize, windowWidth * blockSize,
          windowHeight * blockSize, thresholds, structure)) structuralRasterWindows++;
      }
      if (meanDelta > maxMeanDelta) maxMeanDelta = meanDelta;
      if (changedBlocks > maxChangedBlocks) maxChangedBlocks = changedBlocks;
      if (changedRatio > maxChangedRatio) maxChangedRatio = changedRatio;
    }
  }
  const meaningful = maxMeanDelta >= thresholds.localizedRegionThreshold &&
    maxChangedBlocks >= Math.max(1, Math.round(thresholds.localizedRegionMinBlocks)) &&
    maxChangedRatio >= thresholds.localizedRegionMinRatio &&
    structuralRasterWindows < meaningfulWindows;
  return {
    ok: !meaningful,
    maxMeanDelta,
    maxChangedBlocks,
    maxChangedRatio,
    structuralRasterWindows,
    meaningfulWindows,
    reason: meaningful
      ? `localized region luminance changed ${(maxMeanDelta * 100).toFixed(2)}% across ${maxChangedBlocks} of ${windowWidth * windowHeight} pooled blocks`
      : null,
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
  const region = localizedRegionSignal(baseline, current, effectiveThresholds);
  if (!region.ok) {
    features.ok = false;
    features.reasons.push(region.reason);
  }
  return {
    width: current.width,
    height: current.height,
    ...features,
    localizedRegionMeanDelta: region.maxMeanDelta,
    localizedRegionBlocks: region.maxChangedBlocks,
    localizedRegionRatio: region.maxChangedRatio,
  };
}

export function comparePngFiles(baselinePath, currentPath, thresholds = DEFAULT_THRESHOLDS) {
  if (!existsSync(baselinePath)) return { ok: false, reasons: [`missing baseline ${baselinePath}`] };
  if (!existsSync(currentPath)) return { ok: false, reasons: [`missing regenerated capture ${currentPath}`] };
  return comparePngBuffers(readFileSync(baselinePath), readFileSync(currentPath), thresholds);
}

function readManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}

function relativePath(manifest, capture) {
  let value = manifest.artifactTemplate;
  for (const [key, replacement] of Object.entries(capture)) value = value.replaceAll(`{${key}}`, replacement);
  return value;
}

export function compareCatalogue({ baselineRoot, currentRoot = CURRENT_ROOT, manifest = readManifest(), thresholds = DEFAULT_THRESHOLDS }) {
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
  return { ok: failures.length === 0, expected: manifest.captures.length, compared, failures };
}

function parseArgs(args) {
  const baselineIndex = args.indexOf("--baseline");
  if (baselineIndex < 0 || !args[baselineIndex + 1]) throw new Error("usage: node tools/compare-ui-screen-catalogue.mjs --baseline <immutable-baseline-root>");
  return { baselineRoot: resolve(args[baselineIndex + 1]), json: args.includes("--json") };
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
    }
    process.exitCode = report.ok ? 0 : 1;
  } catch (error) {
    console.error(`✗ ${error.message}`);
    process.exitCode = 1;
  }
}
