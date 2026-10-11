import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  BASICS_PROPERTY_PATTERN,
  DUPLICATE_POLICY_VOCABULARY,
  EVENT_DUPLICATE_POLICIES,
  HOSTILE_SENTINELS,
  INVALID_EVENTS,
  VALID_ALPHA_EVENTS,
} from "./fixtures/telemetry.mjs";

const require = createRequire(import.meta.url);
const Telemetry = require("../telemetry.js");
const ProgramEntry = require("../program-entry.js");
const ProgramReview = require("../program-review.js");
const FIXED_UUID = "123e4567-e89b-42d3-a456-426614174000";
const FIXED_DATE = new Date("2026-08-27T00:00:00.000Z");

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    snapshot: () => Object.fromEntries(values),
  };
}

function boot({ storage = memoryStorage(), adapter, onReject, crypto } = {}) {
  const sent = [];
  const activeAdapter = adapter || {
    capture: (name, properties) => sent.push([name, properties]),
    setEnabled() {},
  };
  const status = Telemetry.boot({
    adapter: activeAdapter,
    appVersion: "112.98d5335",
    crypto: crypto || { randomUUID: () => FIXED_UUID },
    location: { origin: "https://taurifer.example", pathname: "/index.html", search: "?secret", hash: "#setup=v2.secret" },
    now: () => FIXED_DATE,
    onReject,
    releaseChannel: "preview",
    storage,
  });
  return { activeAdapter, sent, status, storage };
}

{
  const { sent, status, storage } = boot();
  assert.equal(status.installationId, FIXED_UUID);
  assert.deepEqual(status.safeLocation, { origin: "https://taurifer.example", pathname: "/index.html" });
  assert.ok(!JSON.stringify(status).includes("secret"));
  assert.deepEqual(JSON.parse(storage.snapshot().repforge_telemetry_identity_v1), {
    schemaVersion: 1,
    installationId: FIXED_UUID,
    createdAt: FIXED_DATE.toISOString(),
  });
  assert.equal(sent.length, 0);
}

{
  const storage = memoryStorage({
    repforge_telemetry_identity_v1: JSON.stringify({ schemaVersion: 1, installationId: FIXED_UUID, createdAt: FIXED_DATE.toISOString() }),
  });
  const { status } = boot({ storage, crypto: { randomUUID: () => { throw new Error("must reuse identity"); } } });
  assert.equal(status.installationId, FIXED_UUID);
}

{
  const storage = memoryStorage({ repforge_telemetry_identity_v1: "{corrupt" });
  const replacement = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const { status } = boot({ storage, crypto: { randomUUID: () => replacement } });
  assert.equal(status.installationId, replacement);
}

{
  const { sent } = boot();
  for (const [name, properties] of VALID_ALPHA_EVENTS) assert.equal(Telemetry.capture(name, properties), true, name);
  assert.equal(sent.length, VALID_ALPHA_EVENTS.length);
  for (const [name, properties] of sent) {
    assert.equal(properties.telemetry_schema_version, 1, name);
    assert.equal(properties.app_version, "112.98d5335", name);
    assert.equal(properties.release_channel, "preview", name);
  }
}

{
  const { sent } = boot();
  for (const category of ["supersets", "rest_times", "rir_rpe", "tempo", "warmups", "cardio", "progression_rules", "deload"])
    assert.equal(Telemetry.capture("program_import_unsupported_concept", { category }), true, category);
  assert.equal(Telemetry.capture("program_import_unsupported_concept", { category: "Bench press from my private program" }), false);
  assert.equal(sent.length, 8);
  assert.doesNotMatch(JSON.stringify(sent), /Bench press|private program/);
}

{
  const rejected = [];
  const { sent } = boot({ onReject: value => rejected.push(value) });
  for (const [name, properties] of INVALID_EVENTS) assert.equal(Telemetry.capture(name, properties), false, name);
  for (const sentinel of HOSTILE_SENTINELS) {
    assert.equal(Telemetry.capture("first_set_logged", { notes: sentinel }), false);
  }
  assert.equal(sent.length, 0);
  assert.equal(rejected.length, INVALID_EVENTS.length + HOSTILE_SENTINELS.length);
}

{
  const storage = memoryStorage();
  const { sent } = boot({ storage });
  Telemetry.setEnabled(false);
  assert.equal(Telemetry.capture("first_set_logged", {}), false);
  assert.equal(Telemetry.capture("program_import_unsupported_concept", { category: "tempo" }), false);
  assert.equal(sent.length, 0);
  assert.equal(storage.snapshot().repforge_telemetry_enabled_v1, "false");
  const next = boot({ storage });
  assert.equal(next.status.enabled, false);
  Telemetry.setEnabled(true);
  assert.equal(Telemetry.capture("first_set_logged", {}), true);
  assert.equal(next.sent.length, 1);
}

{
  boot({ adapter: { capture() { throw new Error("blocked"); }, setEnabled() { throw new Error("blocked"); } } });
  assert.doesNotThrow(() => Telemetry.capture("first_set_logged", {}));
  assert.doesNotThrow(() => Telemetry.setEnabled(false));
}

{
  const properties = { route: "import" };
  const { sent } = boot();
  Telemetry.capture("program_path_selected", properties);
  assert.deepEqual(properties, { route: "import" });
  assert.ok(Object.isFrozen(sent[0][1]));
}

{
  const { status } = boot();
  const accepted = status.beforeSend({
    event: "program_path_selected",
    properties: {
      route: "import",
      telemetry_schema_version: 1,
      app_version: "112.98d5335",
      release_channel: "preview",
      distinct_id: FIXED_UUID,
      $session_id: "session_12345678",
      $current_url: "https://example.test/?secret#setup=v2.secret",
      $lib: "web",
    },
  });
  assert.deepEqual(accepted.properties, {
    route: "import",
    telemetry_schema_version: 1,
    app_version: "112.98d5335",
    release_channel: "preview",
    distinct_id: FIXED_UUID,
    $session_id: "session_12345678",
  });
  assert.equal(status.beforeSend({ event: "$pageview", properties: {} }), null);
  assert.equal(status.beforeSend({ event: "first_set_logged", properties: { telemetry_schema_version: 1 } }), null);

  const auto = status.beforeSend({
    event: "$autocapture",
    properties: {
      $event_type: "click",
      $elements: [{ tag_name: "button", text: HOSTILE_SENTINELS[0], attributes: { "data-telemetry-action": "nav_history", "aria-label": HOSTILE_SENTINELS[1] } }],
      $current_url: HOSTILE_SENTINELS[1],
      distinct_id: FIXED_UUID,
      $session_id: "session_12345678",
    },
  });
  assert.deepEqual(auto.properties, {
    telemetry_action: "nav_history",
    $event_type: "click",
    telemetry_schema_version: 1,
    app_version: "112.98d5335",
    release_channel: "preview",
    distinct_id: FIXED_UUID,
    $session_id: "session_12345678",
  });
  assert.equal(JSON.stringify(auto).includes("TAURIFER_SENTINEL"), false);
  assert.equal(status.beforeSend({ event: "$autocapture", properties: { telemetry_action: "workout_value", distinct_id: FIXED_UUID } }), null);

  const replay = status.beforeSend({
    event: "$snapshot",
    properties: {
      $snapshot_data: { type: 2, data: { tagName: "div", text: "***", value: "•••", attributes: { role: "button" } } },
      $current_url: HOSTILE_SENTINELS[1],
      distinct_id: FIXED_UUID,
      $window_id: "window_12345678",
    },
  });
  assert.equal(replay.properties.$current_url, "https://taurifer.example/index.html");
  assert.equal(replay.properties.$window_id, "window_12345678");
  for (const sentinel of HOSTILE_SENTINELS) {
    assert.equal(status.beforeSend({ event: "$snapshot", properties: { $snapshot_data: { data: { text: sentinel } }, distinct_id: FIXED_UUID } }), null);
  }
}

// Every event declares a duplicate expectation, drawn from the closed
// vocabulary, matching the fixture contract exactly. An event added without
// one cannot be defined at all: the module throws while building EVENTS.
assert.deepEqual([...Telemetry.DUPLICATE_POLICIES], [...DUPLICATE_POLICY_VOCABULARY]);
assert.deepEqual(
  VALID_ALPHA_EVENTS.map(([name]) => name).sort(),
  [...Telemetry.getEventNames()].sort(),
  "every production alpha event has one minimum valid schema fixture",
);
assert.deepEqual([...Telemetry.getEventNames()].sort(), Object.keys(EVENT_DUPLICATE_POLICIES).sort());
for (const [name, expected] of Object.entries(EVENT_DUPLICATE_POLICIES)) {
  assert.equal(Telemetry.getEventPolicy(name), expected, `${name} duplicate policy`);
}
assert.equal(Telemetry.getEventPolicy("unknown_event"), null);

assert.equal(Telemetry.getSchemaVersion(), 1);
assert.equal(Telemetry.bucketCount(0, "sets"), "0");
assert.equal(Telemetry.bucketCount(6, "sets"), "6_10");
assert.equal(Telemetry.bucketCount(7, "exercises"), "7_plus");
assert.equal(Telemetry.bucketCount(1.5, "sets"), null);
assert.equal(Telemetry.bucketDuration(15), "0_15");
assert.equal(Telemetry.bucketDuration(90.1), "90_plus");
assert.equal(Telemetry.bucketDuration(-1), null);

assert.equal(Telemetry.bucketStepTime(9999), "under_10s");
assert.equal(Telemetry.bucketStepTime(10000), "10_30s");
assert.equal(Telemetry.bucketStepTime(179999), "1_3m");
assert.equal(Telemetry.bucketStepTime(600000), "over_10m");
assert.equal(Telemetry.bucketStepTime(-1), null);
assert.equal(Telemetry.bucketGeneration(999), "under_1s");
assert.equal(Telemetry.bucketGeneration(3000), "3_10s");
assert.equal(Telemetry.bucketGeneration(Number.NaN), null);
assert.equal(Telemetry.bucketChanges(0), "0");
assert.equal(Telemetry.bucketChanges(2), "1_2");
assert.equal(Telemetry.bucketChanges(11), "11_plus");
assert.equal(Telemetry.bucketChanges(1.5), null);

// The funnel keys on ProgramEntry's own vocabulary (Plan 071 §4). A route or
// step added to program entry without its telemetry value would be refused
// at capture and vanish from the funnel, so the two lists move together.
{
  const vocabulary = Telemetry.getEntryVocabulary();
  assert.deepEqual([...vocabulary.routes], [...ProgramEntry.ROUTES], "telemetry routes are ProgramEntry.ROUTES");
  const steps = new Set(vocabulary.steps);
  for (const [route, list] of Object.entries(ProgramEntry.ROUTE_STEPS)) {
    for (const step of list) assert.ok(steps.has(step), `ROUTE_STEPS.${route} step ${step} has a telemetry step value`);
  }
  assert.ok(steps.has("entry") && steps.has("activation_conflict"));
  assert.deepEqual([...vocabulary.reviewEditKinds], [...ProgramReview.EDIT_KINDS], "review edit kinds are program-review.js EDIT_KINDS");
}

// B's Basics never reach telemetry, whatever the event (Plan 071 §7).
for (const name of Telemetry.getEventNames("all")) {
  for (const property of Telemetry.getEventProperties(name)) {
    assert.doesNotMatch(property, BASICS_PROPERTY_PATTERN, `${name}.${property} names a Basics answer`);
  }
}

// The funnel projection reads only route, step and time from what it is given.
{
  const steps = ProgramEntry.ROUTE_STEPS;
  const at = (seconds) => seconds * 1000;
  const funnel = (from, to) => Telemetry.entryFunnelEvents(from, to, steps);
  assert.deepEqual(funnel(null, { route: null, step: "entry", at: 0 }),
    [["onboarding_step_viewed", { route: "none", step: "entry" }]], "the hub opens as a view only");
  assert.deepEqual(funnel({ route: null, step: "entry", at: 0 }, { route: "recommend", step: "background", at: at(4) }), [
    ["onboarding_step_completed", { route: "none", step: "entry", time_on_step: "under_10s" }],
    ["onboarding_step_viewed", { route: "recommend", step: "background" }],
  ], "leaving the hub for a route completes the hub, whichever step the route opens on");
  assert.deepEqual(funnel({ route: "recommend", step: "schedule", at: at(10) }, { route: "recommend", step: "environment", at: at(55) }), [
    ["onboarding_step_completed", { route: "recommend", step: "schedule", time_on_step: "30_60s" }],
    ["onboarding_step_viewed", { route: "recommend", step: "environment" }],
  ]);
  assert.deepEqual(funnel({ route: "custom", step: "custom_shape", at: 0 }, { route: "custom", step: "priorities", at: 1 }), [
    ["onboarding_step_back", { route: "custom", step: "custom_shape" }],
    ["onboarding_step_viewed", { route: "custom", step: "priorities" }],
  ]);
  assert.deepEqual(funnel({ route: "build", step: "build_setup", at: 0 }, { route: null, step: "entry", at: 1 }), [
    ["onboarding_step_back", { route: "build", step: "build_setup" }],
    ["onboarding_step_viewed", { route: "none", step: "entry" }],
  ]);
  assert.deepEqual(funnel({ route: "recommend", step: "result", at: 0 }, { route: "recommend", step: "result", at: 9 }), [],
    "a re-render of the same step is not a new view");
  assert.deepEqual(funnel({ route: "recommend", step: "result", at: 0 }, { route: "recommend", step: "activation_conflict", at: 9 }),
    [["onboarding_step_viewed", { route: "recommend", step: "activation_conflict" }]], "a conflict the app raised is not the lifter moving");
  assert.deepEqual(funnel(null, { route: "recommend", step: "step_7", at: 0 }), [], "an unknown step is never invented into the funnel");

  // B's Basics ride along on the state the app hands over; none of it leaves.
  const basics = {
    sex: "TAURIFER_SENTINEL_SEX_7ab0", birthDate: "1977-04-13", ageYears: 47, heightCm: 187.3,
    bodyweightKg: 91.7, cardioExperience: "TAURIFER_SENTINEL_CARDIO_7ab0",
    structuredExperience: "6_to_24m", programName: "TAURIFER_SENTINEL_FREE_TEXT_7ab0",
  };
  const events = funnel(
    { route: "recommend", step: "desired_result", at: 0, answers: basics, ...basics },
    { route: "recommend", step: "background", at: at(20), answers: basics, ...basics },
  );
  assert.equal(events.length, 2);
  const { sent } = boot();
  for (const [name, properties] of events) assert.equal(Telemetry.capture(name, properties), true, name);
  const rendered = JSON.stringify(sent);
  for (const value of ["SENTINEL", "1977", "47", "187.3", "91.7", "6_to_24m"]) {
    assert.ok(!rendered.includes(value), `Basics value ${value} stays out of the funnel payload`);
  }
}

console.log("telemetry unit: schema, identity, opt-out, failure isolation, and buckets pass");
