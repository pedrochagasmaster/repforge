/**
 * Load and validate docs/ui-screens/manifest.json, and expand its screen
 * registry into the concrete capture list.
 *
 * The manifest declares screens once and names a variant *policy* per screen
 * rather than listing every PNG by hand. The old Plan 048 manifest carried a
 * literal 59-row capture array, which is why adding a state meant editing two
 * places and why several routes were represented only by their first step.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const MANIFEST_PATH = join(ROOT, "docs", "ui-screens", "manifest.json");

function fail(message) {
  throw new Error(`ui-screens manifest: ${message}`);
}

export function loadManifest(path = MANIFEST_PATH) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`cannot read ${path}: ${error.message}`);
  }
  if (manifest.schemaVersion !== 2) fail("schemaVersion must be 2");
  for (const key of ["artifactRoot", "artifactTemplate"]) {
    if (typeof manifest[key] !== "string" || !manifest[key]) fail(`${key} must be a non-empty string`);
  }
  for (const key of ["viewports", "locales", "textScales", "motion", "variantSets"]) {
    if (!manifest[key] || !Object.keys(manifest[key]).length) fail(`${key} must be a non-empty object`);
  }
  if (!Array.isArray(manifest.themes) || !manifest.themes.length) fail("themes must be non-empty");
  if (!Array.isArray(manifest.flows) || !manifest.flows.length) fail("flows must be non-empty");
  if (!Array.isArray(manifest.screens) || !manifest.screens.length) fail("screens must be non-empty");

  // Desktop is deliberately out of scope: Taurifer is a mobile PWA and a
  // desktop frame was evidence nobody reviewed. Keep the gate honest about it.
  for (const [id, viewport] of Object.entries(manifest.viewports)) {
    if (!id.startsWith("phone-")) fail(`viewport ${id} is not a phone; the catalog is mobile-only`);
    if (!Number.isInteger(viewport.width) || !Number.isInteger(viewport.height)) {
      fail(`viewport ${id} needs integer width and height`);
    }
  }

  const flows = new Set(manifest.flows.map((flow) => flow.id));
  const seen = new Set();
  for (const screen of manifest.screens) {
    for (const key of ["id", "flow", "label", "scenario", "variants"]) {
      if (typeof screen[key] !== "string" || !screen[key]) fail(`screen ${screen.id || "?"} needs a ${key}`);
    }
    if (!flows.has(screen.flow)) fail(`screen ${screen.id} names unknown flow ${screen.flow}`);
    if (!manifest.variantSets[screen.variants]) fail(`screen ${screen.id} names unknown variant set ${screen.variants}`);
    const key = `${screen.flow}/${screen.id}`;
    if (seen.has(key)) fail(`duplicate screen ${key}`);
    seen.add(key);
  }
  return manifest;
}

/** `phone-390-light-en`, plus `-text200` / `-reduced` only when not default. */
export function variantSlug(variant) {
  const parts = [variant.viewport, variant.theme, variant.locale];
  if (variant.text !== "normal") parts.push(variant.text);
  if (variant.motion !== "normal") parts.push(variant.motion);
  return parts.join("-");
}

export function capturePath(manifest, capture, root = join(ROOT, manifest.artifactRoot)) {
  const rendered = manifest.artifactTemplate
    .replaceAll("{flow}", capture.flow)
    .replaceAll("{screen}", capture.screen)
    .replaceAll("{variant}", variantSlug(capture));
  return join(root, rendered);
}

/** Expand the screen registry into every PNG the catalog is required to hold. */
export function expandCaptures(manifest) {
  const captures = [];
  for (const screen of manifest.screens) {
    for (const variant of manifest.variantSets[screen.variants]) {
      captures.push({ flow: screen.flow, screen: screen.id, label: screen.label, ...variant });
    }
  }
  return captures;
}

export function screenKey(capture) {
  return `${capture.flow}/${capture.screen}`;
}

export function captureKey(capture) {
  return `${screenKey(capture)}__${variantSlug(capture)}`;
}
