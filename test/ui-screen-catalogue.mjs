#!/usr/bin/env node
/** Self-test for the explicit Plan 048 screenshot manifest and checker. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const manifest = JSON.parse(readFileSync(resolve(root, "docs/ui-screens/program-entry-manifest.json"), "utf8"));
const stateIds = new Set(manifest.states.map((state) => state.id));
assert.equal(manifest.states.length, 24, "the required Plan 048 state list stays complete");
assert.equal(manifest.captures.length, 60, "the reviewed capture list stays deliberately non-Cartesian");
assert.equal(manifest.captures.length, manifest.states.length + 6 * 6, "each representative adds six distinct variants");

for (const state of manifest.states) {
  const canonical = manifest.captures.filter((capture) => capture.state === state.id && capture.canonical);
  assert.equal(canonical.length, 1, `${state.id} has one canonical capture`);
  assert.deepEqual(canonical[0], {
    state: state.id, locale: "en", theme: "light", viewport: "phone-390",
    text: "normal", motion: "normal", canonical: true,
  });
}

for (const [key, values] of Object.entries({
  locale: manifest.locales,
  theme: manifest.themes,
  viewport: Object.keys(manifest.viewports),
  text: Object.keys(manifest.textScales),
  motion: Object.keys(manifest.motion),
})) {
  for (const value of values) assert.ok(manifest.captures.some((capture) => capture[key] === value), `${key}=${value} has a representative`);
}
for (const capture of manifest.captures) assert.ok(stateIds.has(capture.state), `capture state ${capture.state} is declared`);

const result = spawnSync(process.execPath, ["tools/check-ui-screen-catalogue.mjs", "--report", "--json"], {
  cwd: root, encoding: "utf8",
});
assert.equal(result.status, 0, "report mode is non-blocking while captures are pending");
const report = JSON.parse(result.stdout);
assert.equal(report.expected, 60);
assert.equal(report.present, 0);
assert.equal(report.missing.length, 60);
assert.equal(report.invalid.length, 0);
assert.equal(report.extra.length, 0);
console.log("UI screen catalogue manifest: 24 states, 60 explicit captures, all matrix dimensions covered");
