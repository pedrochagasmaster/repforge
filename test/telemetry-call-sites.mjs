/**
 * Producer coverage for the closed telemetry vocabulary.
 *
 * `tools/check-production-syntax.mjs` proves every producer names a declared
 * event. This is the converse: every declared event has a producer, or an
 * explicit reserved reason. An event that is declared but never emitted looks
 * exactly like "nobody did it" in a funnel, so the alpha scorecard would read
 * a dead producer as user behaviour.
 *
 * Reserving an event is an owner-visible statement that the feature behind it
 * does not exist yet. When the feature ships, its change must drop the
 * RESERVED entry and add the producer; the stale-entry check below enforces it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = file => readFileSync(resolve(root, file), "utf8");
const Telemetry = createRequire(import.meta.url)("../telemetry.js");

const RESERVED = new Map([
  ["recommendation_overridden", "needs a product definition of a deliberate override"],
  ["session_abandoned", "needs an explicit abandon action with stage and reason UI"],
  ["substitution_used", "needs a substitution reason question; a reason is never fabricated"],
  ["equipment_context_selected", "equipment contexts are deferred (backlog section 5)"],
  ["one_off_started", "one-off sessions are deferred (backlog section 5)"],
  ["one_off_completed", "one-off sessions are deferred (backlog section 5)"],
  ["program_transition_selected", "next-program transition choice is not emitted yet"],
]);

// Every phase, not only "alpha": install_transfer events are declared in the
// same registry and must not be invisible to this guard.
const declared = [...Telemetry.getEventNames("all")];
assert.ok(declared.length > 0, "telemetry.js must declare events");

// Product producers go through captureEvent in the app shell and History UI.
// An event declared outside the alpha phase is emitted by telemetry.js itself
// (for example the late install transfer), so its own capture() call counts.
const products = `${read("app.js")}\n${read("history-ui.js")}`;
const produced = new Set([...products.matchAll(/captureEvent\("([^"]+)"/g)].map(match => match[1]));
const ownModule = read("telemetry.js");
for (const name of declared) {
  if (Telemetry.getEventNames().includes(name)) continue;
  if (new RegExp(`\\bcapture\\("${name}"`).test(ownModule)) produced.add(name);
}

const orphaned = declared.filter(name => !produced.has(name) && !RESERVED.has(name));
assert.deepEqual(orphaned, [], `declared events without a producer or a reserved reason: ${orphaned.join(", ")}`);

const unknownReserved = [...RESERVED.keys()].filter(name => !declared.includes(name));
assert.deepEqual(unknownReserved, [], `RESERVED names an undeclared event: ${unknownReserved.join(", ")}`);
const staleReserved = [...RESERVED.keys()].filter(name => produced.has(name));
assert.deepEqual(staleReserved, [], `an event is both produced and reserved; drop it from RESERVED: ${staleReserved.join(", ")}`);
for (const [name, reason] of RESERVED) assert.ok(reason.trim(), `${name} needs a reserved reason`);

console.log(`telemetry producers: ${declared.length - RESERVED.size} of ${declared.length} declared events produced, ${RESERVED.size} reserved`);
