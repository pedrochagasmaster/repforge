import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { VALID_ALPHA_EVENTS } from "./fixtures/telemetry.mjs";

const root = resolve(import.meta.dirname, "..");
const app = readFileSync(resolve(root, "app.js"), "utf8");
const telemetry = readFileSync(resolve(root, "telemetry.js"), "utf8");
const adapter = readFileSync(resolve(root, "posthog-init.js"), "utf8");
const allowed = new Set(VALID_ALPHA_EVENTS.map(([eventName]) => eventName));
const callPattern = /captureEvent\("([^"]+)"/g;
const captured = [...app.matchAll(callPattern)].map(match => match[1]);

assert.ok(captured.length > 0, "app.js must retain reviewed product-event call sites");
assert.deepEqual([...new Set(captured)].filter(eventName => !allowed.has(eventName)), []);
for (const retired of [
  "backup_exported",
  "custom_exercise_created",
  "onboarding_completed",
  "program_imported",
  "workout_completed",
  "workout_session_deleted",
  "workout_started",
]) {
  assert.doesNotMatch(app, new RegExp(`captureEvent\\(\\"${retired}\\"`));
}

assert.doesNotMatch(app, /(?:window|globalThis)\.posthog|\.capture\([^\n]*telemetry_schema_version/);
assert.match(app, /window\.RepForgeTelemetry\?\.capture/);
assert.match(adapter, /browser\.posthog/);
assert.doesNotMatch(telemetry, /(?:window|globalThis)\.posthog/);

console.log(`telemetry call sites: ${captured.length} reviewed calls use the closed boundary`);
