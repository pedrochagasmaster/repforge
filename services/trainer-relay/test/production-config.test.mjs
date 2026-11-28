// Production relay configuration drift guard (ADR 0026, second amendment).
// The relay runs on its own host, relay.taurifer.com, so it never shares a route
// with install transfer (taurifer.com/v1/*, taurifer.com/_ops/*) and never
// receives taurifer.com's host-only cookies.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SERVICE = join(dirname(fileURLToPath(import.meta.url)), "..");
// wrangler.jsonc has whole-line // comments only.
const config = JSON.parse(readFileSync(join(SERVICE, "wrangler.jsonc"), "utf8").replace(/^\s*\/\/.*$/gmu, ""));
const production = config.env?.production;

test("production is its own Worker on relay.taurifer.com", () => {
  assert.ok(production, "wrangler.jsonc declares env.production");
  assert.equal(production.name, "taurifer-trainer-relay");
  assert.notEqual(production.name, config.name);
  assert.notEqual(production.name, config.env.staging.name);
  assert.deepEqual(production.routes, [{ pattern: "relay.taurifer.com", custom_domain: true }]);
  assert.equal(production.route, undefined);
  assert.equal(production.workers_dev, false);
  assert.equal(production.preview_urls, false);
  for (const { pattern } of production.routes) assert.doesNotMatch(pattern, /^taurifer\.com\//u, "no route on install transfer's host");
});

test("production vars are exact, with creates on for slice 2", () => {
  assert.deepEqual(production.vars, {
    RELAY_ALLOWED_ORIGINS: "https://taurifer.com,https://studio.taurifer.com",
    RELAY_CREATES_ENABLED: "true",
    RELAY_KILL_SWITCH: "false",
  }, "no secret, no local EU adapter, no shortened lifetime");
});

test("production binds the same classes, logs no invocations, and reaches them only through the EU helper", () => {
  assert.deepEqual(production.durable_objects.bindings, config.durable_objects.bindings);
  assert.deepEqual(production.migrations, config.migrations);
  assert.deepEqual(production.observability, { enabled: true, logs: { enabled: true, invocation_logs: false } });
  const names = config.durable_objects.bindings.map(({ name }) => name).join("|");
  const direct = new RegExp(`\\b(?:${names})\\s*\\.\\s*(?:get|getByName|idFromName|idFromString|newUniqueId|jurisdiction)\\b`, "u");
  for (const file of readdirSync(join(SERVICE, "src")).filter((name) => name.endsWith(".js") && name !== "namespaces.js")) {
    assert.doesNotMatch(readFileSync(join(SERVICE, "src", file), "utf8"), direct, `${file} uses euStub`);
  }
  assert.match(readFileSync(join(SERVICE, "src/namespaces.js"), "utf8"), /namespace\.jurisdiction\("eu"\)/u);
});
