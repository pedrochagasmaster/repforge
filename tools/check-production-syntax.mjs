#!/usr/bin/env node
/**
 * Canonical syntax gate for the browser application's JavaScript modules.
 *
 * Keep the inventory derived from git so a newly added production module cannot
 * quietly fall outside CI. Test-only modules are intentionally .mjs and have
 * their own gate; the generated, ignored PostHog config is checked after its
 * build step by the config contract.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z", "--", "*.js"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((file) => !file.includes("/"));
const expected = [
  "app.js",
  "durable-state.js",
  "exercises.js",
  "guide-registry.js",
  "history-ui.js",
  "i18n.js",
  "install-policy.js",
  "install-transfer-contract.js",
  "install-transfer.js",
  "motion-layer.js",
  "notify.js",
  "posthog-init.js",
  "program-compiler.js",
  "program-editor.js",
  "program-entry-adapter.js",
  "program-entry.js",
  "program-transition.js",
  "progress-model.js",
  "progression-engine.js",
  "schedule.js",
  "shared-setup.js",
  "sw.js",
  "telemetry.js",
  "unsupported-workout-grammar.js",
  "workout-draft.js",
];
const missing = expected.filter((file) => !files.includes(file));
const unexpected = files.filter((file) => !expected.includes(file));
if (missing.length || unexpected.length) {
  console.error(JSON.stringify({ missing, unexpected, files }, null, 2));
  process.exit(1);
}
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`production syntax: ${files.length} modules pass`);

// Architecture/security guard: product code emits through the closed telemetry
// facade. This is a repository invariant, not a product-behavior unit test.
const require = createRequire(import.meta.url);
const Telemetry = require("../telemetry.js");
const allowedEvents = new Set(Telemetry.getEventNames("all"));
const producers = ["app.js", "history-ui.js"].map((file) => readFileSync(file, "utf8")).join("\n");
const captured = [...producers.matchAll(/captureEvent\("([^"]+)"/g)].map((match) => match[1]);
const unknownEvents = [...new Set(captured)].filter((name) => !allowedEvents.has(name));
if (unknownEvents.length) {
  console.error(`Unknown telemetry event producer(s): ${unknownEvents.join(", ")}`);
  process.exit(1);
}
const app = readFileSync("app.js", "utf8");
const telemetry = readFileSync("telemetry.js", "utf8");
const adapter = readFileSync("posthog-init.js", "utf8");
if (/(?:window|globalThis)\.posthog|\.capture\([^\n]*telemetry_schema_version/.test(app) ||
    /(?:window|globalThis)\.posthog/.test(telemetry) ||
    !/window\.RepForgeTelemetry\?\.capture/.test(app) ||
    !/browser\.posthog/.test(adapter)) {
  console.error("Telemetry producer bypasses the reviewed RepForgeTelemetry boundary.");
  process.exit(1);
}
console.log(`telemetry boundary: ${captured.length} reviewed producer call(s) use declared events`);

// The converse guard: every declared event has a producer or an explicit
// reserved reason. A declared event nobody emits reads as "nobody did it" in a
// funnel, so the alpha scorecard would mistake a dead producer for behaviour.
// Reserving an event says the feature behind it does not exist yet; when it
// ships, its change drops the entry and adds the producer.
const RESERVED = new Map([
  ["recommendation_overridden", "needs a product definition of a deliberate override"],
  ["session_abandoned", "needs an explicit abandon action with stage and reason UI"],
  ["substitution_used", "needs a substitution reason question; a reason is never fabricated"],
  ["equipment_context_selected", "equipment contexts are deferred (backlog section 5)"],
  ["one_off_started", "one-off sessions are deferred (backlog section 5)"],
  ["one_off_completed", "one-off sessions are deferred (backlog section 5)"],
  ["program_transition_selected", "next-program transition choice is not emitted yet"],
]);
const produced = new Set(captured);
// Events outside the product phases (the late install transfer) are emitted by
// telemetry.js itself, so its own capture() call counts as their producer.
const productEvents = new Set(Telemetry.getEventNames());
for (const name of allowedEvents) {
  if (!productEvents.has(name) && new RegExp(`\\bcapture\\("${name}"`).test(telemetry)) produced.add(name);
}
const orphaned = [...allowedEvents].filter((name) => !produced.has(name) && !RESERVED.has(name));
const unknownReserved = [...RESERVED.keys()].filter((name) => !allowedEvents.has(name));
const staleReserved = [...RESERVED.keys()].filter((name) => produced.has(name));
if (orphaned.length || unknownReserved.length || staleReserved.length) {
  if (orphaned.length) console.error(`Declared telemetry event(s) without a producer or a reserved reason: ${orphaned.join(", ")}`);
  if (unknownReserved.length) console.error(`RESERVED names undeclared event(s): ${unknownReserved.join(", ")}`);
  if (staleReserved.length) console.error(`Event(s) both produced and reserved; drop them from RESERVED: ${staleReserved.join(", ")}`);
  process.exit(1);
}
console.log(`telemetry producers: ${allowedEvents.size - RESERVED.size} of ${allowedEvents.size} declared events produced, ${RESERVED.size} reserved`);

