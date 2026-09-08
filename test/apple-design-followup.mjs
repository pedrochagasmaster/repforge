#!/usr/bin/env node
/* Source-level contracts for the Apple-design follow-up on PR #232.
 * Browser suites cover the resulting interaction; these checks keep the
 * architecture and explicit user-requested scope from drifting silently. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(join(ROOT, file), "utf8");
const layer = read("motion-layer.js");
const index = read("index.html");
const styles = read("styles.css");

let passed = 0, failed = 0;
function assert(condition, name, detail = "") {
  if (condition) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); if (detail) console.log(`    ${detail}`); }
}

console.log("Apple-design follow-up");

assert(layer.includes("const PROJECTION_DECELERATION = 0.998") &&
  /projectMomentum\(current, gesture\.velocity\)/.test(layer) &&
  /projectMomentum\(gesture\.dx, gesture\.velocity\)/.test(layer),
  "sheet and focus destinations are chosen from projected momentum");
assert(/function nearestSnap\(/.test(layer) &&
  (layer.match(/nearestSnap\(/g) || []).length >= 3,
  "projected endpoints resolve through one nearest-snap helper");

assert(/takeover\(\)[\s\S]{0,220}dispose\(\{ preserve: true \}\)/.test(layer) &&
  /const from = previous\?\.takeover\?\.\(\) \|\| 0/.test(layer) &&
  /trackSheetGesture\(gesture\.sheet, gesture\.scrim, \{ from \}\)/.test(layer),
  "a settling sheet is re-grabbed from its live presentation position");

assert(/freezeFocusPresentation\(run\.track\)/.test(layer) &&
  /global\.focusAnimateTo = fluidFocusAnimateTo/.test(layer) &&
  /run\.commitDir = dir;[\s\S]{0,120}retargetFocusSlide/.test(layer),
  "focus paging is retargetable instead of locking input for 210ms");
assert(!/focusFlinging/.test(layer),
  "the Motion controller does not reproduce the app's focus transition lock");

assert(layer.includes("@media (prefers-reduced-transparency: reduce)") &&
  /--dock-glass: var\(--dock-glass-opaque\)/.test(layer) &&
  /backdrop-filter: none !important/.test(layer),
  "reduced transparency swaps glass for the opaque dock material");
assert(layer.includes("@media (prefers-contrast: more)") &&
  /--rule: var\(--ink-faint\)/.test(layer) &&
  /--dock-edge: var\(--ink-soft\)/.test(layer),
  "increased contrast strengthens shared boundaries without changing theme");

assert(/normalizeInstallBannerSemantics\(\)/.test(layer) &&
  /banner\.setAttribute\("role", "region"\)/.test(layer),
  "the non-modal install banner is exposed as a region, not a dialog");

/* The user explicitly excluded the zoom recommendation from this change. Keep
 * its pre-existing policy byte-for-byte recognizable so this follow-up cannot
 * accidentally smuggle that audit item into PR #232. */
assert(/maximum-scale=1, minimum-scale=1, user-scalable=no/.test(index) &&
  /html\{-webkit-text-size-adjust:100%;text-size-adjust:100%;touch-action:pan-x pan-y\}/.test(styles),
  "the existing zoom policy is intentionally untouched");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
