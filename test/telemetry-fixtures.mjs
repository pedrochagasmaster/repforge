import assert from "node:assert/strict";
import {
  ALPHA_EVENT_NAMES,
  FORBIDDEN_PROPERTY_NAMES,
  HOSTILE_SENTINELS,
  INVALID_EVENTS,
  VALID_ALPHA_EVENTS,
} from "./fixtures/telemetry.mjs";

assert.equal(new Set(ALPHA_EVENT_NAMES).size, ALPHA_EVENT_NAMES.length, "alpha event names are unique");
assert.deepEqual(
  VALID_ALPHA_EVENTS.map(([name]) => name).sort(),
  [...ALPHA_EVENT_NAMES].sort(),
  "every alpha event has one minimum valid fixture",
);
assert.ok(INVALID_EVENTS.some(([name]) => !ALPHA_EVENT_NAMES.includes(name)), "unknown events are represented");
assert.ok(INVALID_EVENTS.some(([, properties]) => Object.keys(properties).some((key) => key.startsWith("$"))), "PostHog properties are represented");
assert.ok(HOSTILE_SENTINELS.some((value) => value.includes("#setup=")), "setup fragments are represented");
assert.ok(HOSTILE_SENTINELS.some((value) => value.includes("%23")), "encoded navigation data is represented");
assert.ok(FORBIDDEN_PROPERTY_NAMES.includes("notes"), "free text fields are forbidden");
assert.ok(FORBIDDEN_PROPERTY_NAMES.includes("exercise_id"), "exercise identity is forbidden");
assert.ok(FORBIDDEN_PROPERTY_NAMES.includes("load"), "workout values are forbidden");

for (const value of HOSTILE_SENTINELS) {
  assert.equal(typeof value, "string");
  assert.ok(value.length >= 24, `hostile sentinel is conspicuous: ${value}`);
}

console.log(`telemetry fixtures: ${VALID_ALPHA_EVENTS.length} valid events, ${INVALID_EVENTS.length} invalid events, ${HOSTILE_SENTINELS.length} hostile sentinels`);
