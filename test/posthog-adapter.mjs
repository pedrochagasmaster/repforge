import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { SDK_VERSION, createAdapter, createConfig, start } = require("../posthog-init.js");
const safeLocation = { origin: "https://taurifer.example", pathname: "/index.html" };

assert.equal(SDK_VERSION, "1.400.0");

{
  const beforeSend = value => value;
  const config = createConfig({
    beforeSend,
    enabled: true,
    host: "https://e.taurifer.com",
    installationId: "123e4567-e89b-42d3-a456-426614174000",
    safeLocation,
  });
  assert.deepEqual(config.autocapture, {
    dom_event_allowlist: ["click"],
    element_allowlist: ["button"],
    css_selector_allowlist: ["[data-telemetry-action]"],
  });
  assert.equal(config.disable_session_recording, false);
  assert.equal(config.capture_pageview, false);
  assert.equal(config.capture_pageleave, false);
  assert.equal(config.capture_exceptions, false);
  assert.equal(config.capture_performance, false);
  assert.equal(config.capture_heatmaps, false);
  assert.equal(config.capture_dead_clicks, false);
  assert.equal(config.disable_surveys, true);
  assert.equal(config.advanced_disable_flags, true);
  assert.equal(config.person_profiles, "never");
  assert.equal(config.persistence, "memory");
  assert.equal(config.opt_out_capturing_persistence_type, "local_storage");
  assert.deepEqual(config.tracing_headers, []);
  assert.equal(config.logs.captureConsoleLogs, false);
  assert.equal(config.mask_all_text, true);
  assert.equal(config.mask_all_element_attributes, true);
  assert.equal(config.session_recording.maskAllInputs, true);
  assert.equal(config.session_recording.maskTextSelector, "*");
  assert.equal(config.session_recording.blockSelector, ".ph-no-capture");
  assert.equal(config.session_recording.recordHeaders, false);
  assert.equal(config.session_recording.recordBody, false);
  assert.equal(config.get_current_url(), "https://taurifer.example/index.html");
  assert.notEqual(config.before_send, beforeSend);
  const retained = config.before_send({
    event: "first_set_logged",
    properties: { token: "phc_publictoken", distinct_id: "id" },
  });
  assert.equal(retained.properties.token, undefined,
    "the config wrapper does not invent a token when none was configured");
}

{
  const beforeSend = (event) => ({
    ...event,
    properties: { ...event.properties, token: undefined },
  });
  const config = createConfig({
    beforeSend,
    enabled: true,
    host: "https://e.taurifer.com",
    installationId: "123e4567-e89b-42d3-a456-426614174000",
    safeLocation,
    token: "phc_faithful",
  });
  const accepted = config.before_send({
    event: "first_set_logged",
    properties: { token: "phc_faithful", distinct_id: "id" },
  });
  assert.equal(accepted.properties.token, "phc_faithful",
    "PostHog's required project token survives a privacy hook");
  assert.equal(accepted.properties.distinct_id, "id",
    "the wrapper preserves the boundary-filtered event");
}

{
  const calls = [];
  const adapter = createAdapter({
    capture: (...args) => calls.push(["capture", ...args]),
    opt_in_capturing: () => calls.push(["in"]),
    has_opted_out_capturing: () => true,
    opt_out_capturing: () => calls.push(["out"]),
    stopSessionRecording: () => calls.push(["stop"]),
    startSessionRecording: () => calls.push(["start"]),
    _requestQueue: { clear: () => calls.push(["clear"]) },
  });
  adapter.capture("first_set_logged", { telemetry_schema_version: 1 });
  adapter.setEnabled(false);
  adapter.setEnabled(true);
  assert.deepEqual(calls.map(call => call[0]), ["capture", "stop", "out", "clear", "in", "start"]);
}

{
  const appended = [];
  const status = {
    beforeSend: value => value,
    enabled: true,
    installationId: "123e4567-e89b-42d3-a456-426614174000",
    safeLocation,
  };
  const browser = {
    __POSTHOG_CONFIG__: {
      appVersion: "abc123",
      host: "https://e.taurifer.com",
      projectToken: "phc_public",
      releaseChannel: "preview",
      sdkVersion: SDK_VERSION,
    },
    RepForgeTelemetry: { boot: () => status },
    crypto: {},
    document: {
      createElement: () => ({}),
      head: { appendChild: node => appended.push(node) },
    },
    localStorage: {},
    location: {},
    navigator: {},
  };
  assert.equal(start(browser), true);
  assert.equal(appended[0].src, `https://e.taurifer.com/static/${SDK_VERSION}/array.js`);
  assert.equal(appended[0].async, true);
  assert.equal(appended[0].crossOrigin, "anonymous");
}

assert.equal(start({ __POSTHOG_CONFIG__: {}, document: {} }), false);
console.log("posthog adapter: exact SDK pin, controlled autocapture, masked replay, opt-out, and loader pass");
