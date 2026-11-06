#!/usr/bin/env node
/**
 * Release skew (owner bug, 2026-11-06): after a release, the iPhone ran the new history-ui.js and app.js (query-
 * versioned, so fetched fresh) against the previous release's i18n.js and styles.css (unversioned, so answered from a
 * cache), and History showed a raw key and a black square. An asset whose content can change between releases must
 * change URL when it does.
 *
 * - The strings and the stylesheets are query-versioned, and every versioned URL is precached exactly as index.html
 *   loads it; a first-party script or stylesheet may stay unversioned only by name below, with its reason.
 * - Against its fork point on main, every versioned asset whose content changed carries a revision above the one it
 *   had there (tools/asset-revisions.mjs). CI checks out the full history for this.
 *
 * Run: node test/asset-revisions.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, forkPoint, gitReader, shellAssets, staleRevisions } from "../tools/asset-revisions.mjs";

let passed = 0, failed = 0;
function assert(cond, name, detail) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); if (detail !== undefined) console.log(`    ${typeof detail === "string" ? detail : JSON.stringify(detail)}`); }
}

/* Still unversioned, each for a reason; a new first-party asset is versioned or named here. */
const UNVERSIONED = Object.freeze({
  "telemetry.js": "the closed event boundary; deployment injects posthog-config.js beside it",
  "posthog-init.js": "scripts/generate-posthog-config.mjs inserts the generated config before this exact tag",
  "unsupported-workout-grammar.js": "loaded before telemetry-dependent modules; a follow-up may version it",
  "schedule.js": "small stable helpers; a follow-up may version it",
  "notify.js": "small stable helpers; a follow-up may version it",
  "vendor/motion/motion.js": "vendored, pinned by content hash, precached immutable",
  "vendor/dnd-kit/dnd-kit.js": "vendored, pinned by content hash",
});

const index = readFileSync(join(ROOT, "index.html"), "utf8");
const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
const assets = shellAssets(index);

console.log("\nThe shell's strings and styles change URL with each release");
for (const file of ["i18n.js", "styles.css", "motion-polish.css"]) {
  const asset = assets.find((item) => item.file === file);
  assert(asset?.revision != null, `${file} is query-versioned in index.html`, asset);
}
const unversioned = assets.filter((asset) => asset.revision == null).map((asset) => asset.file);
assert(unversioned.every((file) => file in UNVERSIONED), "every other first-party script or stylesheet is versioned or named with its reason",
  unversioned.filter((file) => !(file in UNVERSIONED)));
const missing = assets.filter((asset) => asset.revision != null && !sw.includes(`"./${asset.url}"`)).map((asset) => asset.url);
assert(missing.length === 0, "each versioned URL is precached exactly as index.html loads it", missing);
const cache = Number(/const CACHE = "repforge-v(\d+)"/.exec(sw)?.[1]);
const stale = assets.filter((asset) => asset.revision > cache).map((asset) => asset.url);
assert(stale.length === 0, "no asset revision runs ahead of the cache revision", { cache, stale });

console.log("\nA content change without a new revision is caught");
const base = forkPoint();
if (base) {
  const problems = staleRevisions({ read: gitReader(base), base });
  assert(problems.length === 0, `every versioned asset this branch changed moved its revision since ${base.slice(0, 8)}`, problems);
} else if (process.env.CI) {
  assert(false, "CI has the history to compare with main");
} else console.log("  - no fork point with main here; the branch comparison runs in CI");
const files = (head, old) => (ref, file) => (ref === "head" ? head : old)[file] ?? null;
const page = (v) => `<link rel="stylesheet" href="styles.css?v=${v}"><script src="i18n.js?v=${v}"></script>`;
const kept = staleRevisions({ base: "main", read: files({ "index.html": page(10), "styles.css": "b", "i18n.js": "x" }, { "index.html": page(10), "styles.css": "a", "i18n.js": "x" }) });
assert(kept.length === 1 && /styles\.css changed but is still \?v=10/.test(kept[0]), "an edited stylesheet that kept its revision fails", kept);
const moved = staleRevisions({ base: "main", read: files({ "index.html": page(11), "styles.css": "b", "i18n.js": "y" }, { "index.html": page(10), "styles.css": "a", "i18n.js": "x" }) });
assert(moved.length === 0, "edited assets with a new revision pass", moved);
const strings = staleRevisions({ base: "main", read: files({ "index.html": page(10), "styles.css": "a", "i18n.js": "y" }, { "index.html": page(10), "styles.css": "a", "i18n.js": "x" }) });
assert(strings.length === 1 && /^i18n\.js/.test(strings[0]), "regenerated strings (i18n-*.json → i18n.js) that kept the revision fail", strings);
const fresh = staleRevisions({ base: "main", read: files({ "index.html": page(10), "styles.css": "b" }, { "index.html": "<p></p>", "styles.css": "a" }) });
assert(fresh.length === 0, "an asset that was unversioned on main needs no comparison", fresh);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
