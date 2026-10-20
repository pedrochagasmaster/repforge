#!/usr/bin/env node
import {Transfer} from './interchange-runtime.mjs';
/**
 * Production install-transfer configuration drift guard (owner override,
 * 2026-10-14). The production Worker is routed at the app's own origin, so the
 * client's same-origin `/v1/` endpoints need no change. This pins the route,
 * origin, create switches, bindings, migrations, and the EU-only namespace path.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SERVICE = join(ROOT, "services/install-transfer");
const config = JSON.parse(readFileSync(join(SERVICE, "wrangler.jsonc"), "utf8"));
const production = config.env?.production;
assert.ok(production, "wrangler.jsonc declares env.production");

assert.equal(production.name, "taurifer-install-transfer");
assert.notEqual(production.name, "taurifer-install-transfer-staging", "production is a separate Worker from staging");
assert.notEqual(production.name, config.name, "production never deploys over the local top-level name");
// The client API lives under /v1/; the bearer-authenticated scheduled operations
// (health lease, purge, deletion ack) live under /_ops/. Without the second
// route the production host answers /_ops/* from Pages and the health lease can
// never be renewed, so creates stay at 503.
assert.deepEqual(production.routes, [
  { pattern: "taurifer.com/v1/*", zone_name: "taurifer.com" },
  { pattern: "taurifer.com/_ops/*", zone_name: "taurifer.com" },
]);
assert.equal(production.route, undefined);
assert.equal(production.workers_dev, false, "production has no workers.dev URL");
assert.equal(production.preview_urls, false, "production has no preview URLs");

assert.deepEqual(production.vars, {
  TRANSFER_ALLOWED_ORIGIN: "https://taurifer.com",
  TRANSFER_CREATES_ENABLED: "true",
  TRANSFER_KILL_SWITCH: "false",
  TRANSFER_TOKEN_MAC_KEY_ID: "k1",
  TRANSFER_ALARM_HEALTH: "healthy",
  TRANSFER_WATCHDOG_HEALTH: "healthy",
  TRANSFER_LOG_HEALTH: "healthy",
  TRANSFER_KEY_HEALTH: "healthy",
  TRANSFER_DELETION_HEALTH: "healthy",
}, "production vars are exact: no secret, no local EU test adapter, no extra switch");

const expectedBindings = [
  { name: "TRANSFER_OBJECTS", class_name: "TransferDurableObject" },
  { name: "RATE_LIMIT_BUCKETS", class_name: "RateLimitDurableObject" },
  { name: "TRANSFER_HEALTH", class_name: "TransferHealthDurableObject" },
  { name: "TRANSFER_REGISTRY", class_name: "TransferRouteRegistryDurableObject" },
];
assert.deepEqual(production.durable_objects?.bindings, expectedBindings, "production binds the four Durable Object classes");
assert.deepEqual(config.durable_objects?.bindings, expectedBindings, "the local configuration binds the same classes");
assert.deepEqual(production.migrations, [{
  tag: "v1",
  new_sqlite_classes: ["TransferDurableObject", "RateLimitDurableObject", "TransferHealthDurableObject", "TransferRouteRegistryDurableObject"],
}], "a fresh production Worker creates all four classes as SQLite Durable Objects");

// EU jurisdiction is chosen in code, not in Wrangler: every namespace access
// goes through namespaces.js, whose only fallback is the local workerd adapter
// enabled by TRANSFER_LOCAL_TEST_EU, which production never sets.
const bindingNames = expectedBindings.map(({ name }) => name).join("|");
const directAccess = new RegExp(`\\b(?:${bindingNames})\\s*\\.\\s*(?:get|getByName|idFromName|idFromString|newUniqueId|jurisdiction)\\b`, "u");
for (const file of readdirSync(join(SERVICE, "src")).filter((name) => name.endsWith(".js") && name !== "namespaces.js")) {
  const source = readFileSync(join(SERVICE, "src", file), "utf8");
  assert.doesNotMatch(source, directAccess, `${file} reaches a Durable Object namespace only through the EU helper`);
  for (const match of source.matchAll(/allowLocalFallback:\s*([^,})]+)/gu)) {
    assert.match(match[1].trim(), /^(?:this\.)?env\.TRANSFER_LOCAL_TEST_EU === "true"$/u, `${file} enables the local adapter only from TRANSFER_LOCAL_TEST_EU`);
  }
}
const namespaces = readFileSync(join(SERVICE, "src/namespaces.js"), "utf8");
assert.match(namespaces, /namespace\.jurisdiction\("eu"\)/u);
assert.match(namespaces, /allowLocalFallback = false/u, "the EU helper defaults to failing closed");

// The client posts to the same origin as the page, so the zone route covers every endpoint.
const require = createRequire(import.meta.url);
const endpoints = Object.values(Transfer.ENDPOINTS);
assert.equal(endpoints.length, 4);
const routePattern = production.routes[0].pattern;
for (const path of endpoints) {
  assert.ok(`taurifer.com${path}`.startsWith(routePattern.slice(0, -1)), `${path} is inside ${routePattern}`);
}
let transportRequest=null;
const {createInstallTransfer}=await import('../src/platform/install-transfer.js');
const client=createInstallTransfer({location:{href:'https://taurifer.com/index.html'},TextEncoder,TextDecoder,atob,btoa,
  fetch:async(url,options)=>{transportRequest={url,options};return new Response('{}',{status:200});}});
await client.createFetchTransport().request({path:endpoints[0],body:{}});
assert.equal(transportRequest.url,`https://taurifer.com${endpoints[0]}`,'default transport resolves against the actual page origin');
assert.equal(transportRequest.options.credentials,'omit');
assert.equal(transportRequest.options.cache,'no-store');

console.log("install-transfer production config: route, origin, switches, bindings, migrations, and EU path pinned");
