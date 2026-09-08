#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const motion = readFileSync(resolve(root, "motion-polish.css"), "utf8");
const base = readFileSync(resolve(root, "styles.css"), "utf8");
const index = readFileSync(resolve(root, "index.html"), "utf8");
const sw = readFileSync(resolve(root, "sw.js"), "utf8");

let passed = 0;
let failed = 0;
function assert(condition, name, detail = "") {
  if (condition) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); if (detail) console.log(`    ${detail}`); }
}

console.log("motion polish");

assert(index.includes('<link rel="stylesheet" href="styles.css">') &&
       index.includes('<link rel="stylesheet" href="motion-polish.css">'),
  "motion layer loads after the canonical production stylesheet");
assert(base.includes(".ledger__row.is-fresh") && base.includes(".sumsheet.is-played"),
  "canonical stylesheet still owns the underlying production surfaces");
assert(sw.includes('"./motion-polish.css"'),
  "motion stylesheet is precached for offline launch");

assert(/\.view\{[\s\S]*?animation-duration:\.14s/.test(motion),
  "high-frequency view navigation settles in 140ms");
assert(/\.btn:active\{transform:translateY\(1px\) scale\(\.975\)\}/.test(motion) &&
       /nav button:active\{transform:scale\(\.975\)\}/.test(motion),
  "button and dock press feedback converge on the same tactile scale");

assert(/\.ledger__row\.is-fresh\{[\s\S]*?taurifer-setland-row \.16s/.test(motion) &&
       !/\.ledger__row\.is-fresh\{[^}]*setland-wash/.test(motion),
  "ordinary set completion is one short acknowledgement without the long wash");
const tinyEntryScales = [...motion.matchAll(/@keyframes taurifer-(?:setland|effort|exercise|sum)[^{]*\{[\s\S]*?\}/g)]
  .flatMap(match => [...match[0].matchAll(/scale\((0?\.\d+)\)/g)].map(scale => Number(scale[1])))
  .filter(scale => scale < 0.9);
assert(tinyEntryScales.length === 0,
  "new motion never grows UI from a scale below 0.9",
  tinyEntryScales.join(", "));

assert(/\.effortpop\.is-open\{[\s\S]*?taurifer-effort-in \.18s/.test(motion) &&
       /translateY\(6px\) scale\(\.96\)/.test(motion),
  "effort explanation keeps trigger origin while using a restrained entry scale");
assert(/\.toast\{[\s\S]*?animation:none;[\s\S]*?transition:opacity \.16s/.test(motion) &&
       /\.toast\.hidden\{[\s\S]*?display:block!important;[\s\S]*?visibility:hidden/.test(motion),
  "toast uses interruptible enter and exit transitions rather than a one-way keyframe");
assert(/\.tour__card\{animation:none\}/.test(motion) &&
       /\.installbanner\{[\s\S]*?animation:none/.test(motion),
  "tour and install transient UI use state transitions too");

assert(/\.toggle::after\{[\s\S]*?width:27px;[\s\S]*?transition:transform \.24s/.test(motion) &&
       !/\.toggle::after\{[\s\S]*?transition:[^}]*width/.test(motion),
  "toggle tactile feedback animates transform only");
assert(/@keyframes taurifer-sum-strike\{[\s\S]*?scale\(\.92\)[\s\S]*?scale\(1\.035\)/.test(motion) &&
       base.includes("animation-delay:calc(var(--i,0) * 55ms)"),
  "session completion keeps the 55ms reading stagger with a softened crest");

assert(/@media \(hover:none\), \(pointer:coarse\)/.test(motion) &&
       /\.entry-card:not\(\.entry-card--primary\):hover/.test(motion) &&
       /\.program-editor__stepper button:hover/.test(motion),
  "desktop hover embellishments are neutralized on touch/coarse pointers");
assert(/@media \(prefers-reduced-motion:reduce\)/.test(motion) &&
       /\.toast,\.tour,\.installbanner,\.toggle::after\{transition:none\}/.test(motion),
  "the motion layer preserves a true reduced-motion alternate state");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
