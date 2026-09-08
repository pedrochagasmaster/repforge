#!/usr/bin/env node
/** Runtime payload/boot-path contract for PR #232.
 *
 * Motion stays launch-ready because it owns sheet/focus interruption as soon as
 * app boot completes. The larger dnd-kit runtime is progressive enhancement for
 * the program editor: index.html executes only a tiny local bootstrap; the
 * heavy, pinned bundle is loaded after DOMContentLoaded and remains precached
 * for offline use.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(join(ROOT, file), "utf8");
const bytes = text => Buffer.byteLength(text, "utf8");
const gzipBytes = text => gzipSync(Buffer.from(text, "utf8"), { level: 9 }).length;
const KiB = 1024;

const motion = read("vendor/motion/motion.js");
const dndBootstrap = read("vendor/dnd-kit/dnd-kit.js");
const dndRuntime = read("vendor/dnd-kit/dnd-kit.runtime.js");
const dndRuntimePin = JSON.parse(read("vendor/dnd-kit/dnd-kit.runtime.pin.json"));
const index = read("index.html");
const sw = read("sw.js");
const builder = read("tools/build-vendor-runtimes.mjs");

let passed = 0, failed = 0;
function assert(condition, name, detail = "") {
  if (condition) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); if (detail) console.log(`    ${detail}`); }
}

const motionGzip = gzipBytes(motion);
const bootstrapGzip = gzipBytes(dndBootstrap);
const dndGzip = gzipBytes(dndRuntime);
const criticalGzip = motionGzip + bootstrapGzip;
const allRuntimeGzip = criticalGzip + dndGzip;

console.log("interaction runtime payload");
console.log(`  launch path: ${(criticalGzip / KiB).toFixed(1)} KiB gzip (Motion + dnd bootstrap)`);
console.log(`  deferred dnd-kit: ${(dndGzip / KiB).toFixed(1)} KiB gzip`);
console.log(`  total vendored runtime: ${(allRuntimeGzip / KiB).toFixed(1)} KiB gzip`);

assert(bytes(dndBootstrap) <= 2 * KiB,
  "the dnd-kit launch-time bootstrap stays below 2 KiB raw", `${bytes(dndBootstrap)} bytes`);
assert(criticalGzip <= 30 * KiB,
  "launch-time interaction runtime stays below 30 KiB gzip", `${criticalGzip} bytes`);
assert(dndGzip <= 45 * KiB,
  "the deferred dnd-kit runtime stays below 45 KiB gzip", `${dndGzip} bytes`);
assert(allRuntimeGzip <= 70 * KiB,
  "all vendored interaction runtime stays below 70 KiB gzip", `${allRuntimeGzip} bytes`);

assert(index.includes('src="vendor/motion/motion.js"') && index.includes('src="vendor/dnd-kit/dnd-kit.js"'),
  "index loads Motion and only the dnd bootstrap on the initial script path");
assert(!index.includes('src="vendor/dnd-kit/dnd-kit.runtime.js"'),
  "the heavy dnd-kit bundle is not an initial document script");
assert(dndBootstrap.includes('script.src = "vendor/dnd-kit/dnd-kit.runtime.js"') &&
       dndBootstrap.includes('document.addEventListener("DOMContentLoaded"') &&
       dndBootstrap.includes("setTimeout(prime, 0)"),
  "dnd-kit is loaded locally only after the document bootstrap path completes");
assert(!/https?:\/\//.test(dndBootstrap.replace(/^\/\*[\s\S]*?\*\//, "")),
  "the dnd bootstrap cannot reach a third-party origin");

assert(sw.includes('"./vendor/dnd-kit/dnd-kit.runtime.js"') &&
       sw.includes('"/vendor/dnd-kit/dnd-kit.runtime.js"'),
  "the deferred runtime remains in the atomic offline shell");
assert(/IMMUTABLE_RUNTIMES = new Set\([^\n]+dnd-kit\/dnd-kit\.runtime\.js/.test(sw) &&
       /if \(IMMUTABLE_RUNTIMES\.has\(path\)\)[\s\S]{0,240}caches\.match\(event\.request\)/.test(sw),
  "pinned runtime requests prefer the precache instead of re-downloading online");

assert(builder.includes('out: join("vendor", "dnd-kit", "dnd-kit.runtime.js")') &&
       builder.includes('bootstrapOut: join("vendor", "dnd-kit", "dnd-kit.js")'),
  "the generator owns both the heavy runtime and its tiny bootstrap");
assert(dndRuntimePin.bytes === bytes(dndRuntime),
  "the deferred runtime pin records the shipped heavy bundle size",
  `${dndRuntimePin.bytes} != ${bytes(dndRuntime)}`);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
