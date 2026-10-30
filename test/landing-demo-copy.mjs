#!/usr/bin/env node
/**
 * The landing proof's phone shows the app's own strings (the cue, the evidence, the ledger, the shelf and the rest tab),
 * listed in app.js as LANDING_DEMO_KEYS. This guard keeps that list honest and the phone in step with Focus:
 *
 * 1. every listed key exists, non-empty, in both catalogs;
 * 2. every key the phone's code says is on the list (the list is complete);
 * 3. every non-landing key on the list is still said by app.js outside the landing's own code, so when Focus stops
 *    showing a string the landing cannot go on showing it unnoticed.
 *
 * Node only: reads app.js and the two catalogs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const catalogs = Object.fromEntries(["en", "pt"].map((lang) =>
  [lang, JSON.parse(readFileSync(new URL(`../i18n-${lang}.json`, import.meta.url), "utf8"))]));
let failed = 0;
function check(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); } catch (error) { failed++; console.error(`  ✗ ${name}\n    ${error.message}`); }
}

const listed = /const LANDING_DEMO_KEYS=(\[[\s\S]*?\]);/.exec(app);
const keys = listed ? JSON.parse(listed[1]) : [];
/** The phone's own code: the markup builder with its layout, and the frame painter (not the chapter captions). */
const between = (from, to) => {
  const start = app.indexOf(from), end = app.indexOf(to, start);
  return start >= 0 && end > start ? app.slice(start, end) : "";
};
const block = between("function landingDemoHtml(", "function renderLandingProof(") +
  between("function paintLandingDemo(", "function renderLandingWays(");
const said = [...block.matchAll(/\bt\("([\w.]+)"/g)].map((match) => match[1]);
const outside = app.slice(0, app.indexOf("/* ---- The proof: the workout screen, playing itself")) +
  app.slice(app.indexOf("/** Everything on the landing that is a number"));

console.log("Landing proof copy");
check("app.js lists the phone's strings and holds its builder", () => {
  assert(keys.length > 10, `LANDING_DEMO_KEYS has ${keys.length} keys`);
  assert(block.includes("function paintLandingDemo(") && block.includes("function landingDemoHtml("), "the builder and the painter are found");
});
check("every listed key exists, non-empty, in English and Portuguese", () => {
  const missing = ["en", "pt"].flatMap((lang) => keys.filter((key) => typeof catalogs[lang][key] !== "string" || !catalogs[lang][key].trim())
    .map((key) => `${lang}:${key}`));
  assert.deepEqual(missing, []);
});
check("every key the phone's code says is on the list", () => {
  assert(said.length > 0, "the phone's code says catalog strings");
  assert.deepEqual([...new Set(said.filter((key) => !keys.includes(key)))], []);
});
check("every Focus key the phone shows is still said by the app outside the landing", () => {
  // Focus says some keys through a template: `focus.cue.${move}`, `focus.evidence.target${fatigued}`.
  const sayer = (key) => [`"${key}"`, `\`${key}\``, `\`${key}\${`, `\`${key.slice(0, key.lastIndexOf(".") + 1)}\${`];
  const stale = keys.filter((key) => !key.startsWith("landing.") && !sayer(key).some((form) => outside.includes(form)));
  assert.deepEqual(stale, []);
});
check("the cue, the evidence and the rest tab are among them", () => {
  for (const key of ["focus.cue.up", "focus.cue.reps", "focus.evidence.history", "focus.evidence.target", "rest.inline.label", "rest.inline.done"]) {
    assert(keys.includes(key), key);
  }
});

console.log(`\nlanding proof copy: ${failed ? `${failed} failed` : "all passed"}`);
if (failed) process.exit(1);
