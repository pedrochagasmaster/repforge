#!/usr/bin/env node
/**
 * Registration gate for the UI screen catalog.
 *
 * Fails when a registered frame is missing, when an unregistered PNG is
 * sitting in the tree, when a screen has no capture scenario, or when a frame
 * was captured at the wrong pixel size. This is the check that would have
 * caught a catalog going stale by omission — the previous gate only looked at
 * one subtree and let the rest drift silently.
 *
 *   node tools/check-ui-screens.mjs           # release gate
 *   node tools/check-ui-screens.mjs --report  # list gaps, exit 0
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, capturePath, expandCaptures, loadManifest } from "./ui-screens/manifest.mjs";
import { APP_SCENARIOS } from "./ui-screens/screens-app.mjs";
import { ONBOARDING_SCENARIOS } from "./ui-screens/screens-onboarding.mjs";

const REPORT_ONLY = process.argv.includes("--report");

/** Width and height from a PNG's IHDR, without decoding the image. */
function pngSize(path) {
  const buffer = readFileSync(path);
  if (buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else found.push(full);
  }
  return found;
}

export function checkCatalog(manifest, root) {
  const problems = [];
  const scenarios = { ...APP_SCENARIOS, ...ONBOARDING_SCENARIOS };
  const captures = expandCaptures(manifest);

  for (const screen of manifest.screens) {
    const key = `${screen.flow}/${screen.id}`;
    if (!scenarios[key]) problems.push(`screen ${key} has no capture scenario registered`);
  }
  for (const key of Object.keys(scenarios)) {
    if (!manifest.screens.some((screen) => `${screen.flow}/${screen.id}` === key)) {
      problems.push(`scenario ${key} is not registered in the manifest`);
    }
  }

  const expected = new Set();
  for (const capture of captures) {
    const path = capturePath(manifest, capture, root);
    expected.add(resolve(path));
    if (!existsSync(path)) {
      problems.push(`missing ${relative(ROOT, path)}`);
      continue;
    }
    const size = pngSize(path);
    const viewport = manifest.viewports[capture.viewport];
    const scale = manifest.deviceScaleFactor;
    if (!size) {
      problems.push(`${relative(ROOT, path)} is not a PNG`);
    } else if (size.width !== viewport.width * scale || size.height !== viewport.height * scale) {
      problems.push(
        `${relative(ROOT, path)} is ${size.width}x${size.height}, expected `
        + `${viewport.width * scale}x${viewport.height * scale}`
      );
    }
  }

  for (const path of walk(root)) {
    if (!expected.has(resolve(path))) problems.push(`unregistered file ${relative(ROOT, path)}`);
  }
  return problems;
}

function main() {
  const manifest = loadManifest();
  const root = join(ROOT, manifest.artifactRoot);
  const captures = expandCaptures(manifest);
  const problems = checkCatalog(manifest, root);

  if (!problems.length) {
    console.log(`UI screen catalog complete: ${manifest.screens.length} screens, ${captures.length} frames.`);
    return 0;
  }
  console[REPORT_ONLY ? "log" : "error"](`${problems.length} catalog problem(s):`);
  for (const problem of problems) console[REPORT_ONLY ? "log" : "error"](`  - ${problem}`);
  if (REPORT_ONLY) {
    console.log("\nRegenerate with: node tools/capture-ui-screens.mjs");
    return 0;
  }
  console.error("\nRegenerate with: node tools/capture-ui-screens.mjs");
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = main();
}

export { pngSize, walk };
