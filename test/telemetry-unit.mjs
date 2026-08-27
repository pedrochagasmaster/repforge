import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  DUPLICATE_POLICY_VOCABULARY,
  EVENT_DUPLICATE_POLICIES,
  HOSTILE_SENTINELS,
  INVALID_EVENTS,
  VALID_ALPHA_EVENTS,
} from "./fixtures/telemetry.mjs";

const require = createRequire(import.meta.url);
const Telemetry = require("../telemetry.js");
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
}

// Every event declares a duplicate expectation, drawn from the closed
// vocabulary, matching the fixture contract exactly. An event added without
// one cannot be defined at all: the module throws while building EVENTS.
assert.deepEqual([...Telemetry.DUPLICATE_POLICIES], [...DUPLICATE_POLICY_VOCABULARY]);
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

console.log("telemetry unit: schema, identity, opt-out, failure isolation, and buckets pass");
