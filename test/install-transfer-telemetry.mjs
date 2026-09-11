#!/usr/bin/env node
/**
 * Plan 053-P6: Install Transfer Telemetry Specification and Verification Suite
 *
 * Requirements to prove:
 * 1. No PostHog initialization or identity mutation before transfer settlement.
 * 2. Transferred installation identity is preserved.
 * 3. Transferred consent is restored before the event decision.
 * 4. Consent disabled => zero late_install_transfer events emitted.
 * 5. Consent enabled + verified local import => exactly one late_install_transfer event.
 * 6. Retries / reloads / local-committed recovery cannot emit the event twice (strictly exactly-once).
 * 7. Claim alone, validation alone, partial import, rollback, and remote-delete ambiguity cannot emit success.
 * 8. source_context "browser" / destination_context "standalone" are correct.
 * 9. Token, claim ID, payload size/content, program identity, and precise service-correlating timestamps never enter telemetry.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const require = createRequire(import.meta.url);
const Telemetry = require("../telemetry.js");
const Contract = require("../install-transfer-contract.js");
const PostHogInit = require("../posthog-init.js");

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:8056/";
const POSTHOG_SDK_PATH = "/static/1.400.0/array.js";
const IDENTITY_KEY = "repforge_telemetry_identity_v1";
const CONSENT_KEY = "repforge_telemetry_enabled_v1";
const INSTALL_MARKER_KEY = "repforge_install_import_v1";
const TRANSFER_EMITTED_KEY = "repforge_telemetry_install_transfer_emitted_v1";

const REDACTION_CASES = JSON.parse(
  readFileSync(new URL("./fixtures/install-transfer-threats/redaction-cases.json", import.meta.url), "utf8")
);

const POSTHOG_SDK_DOUBLE = `(() => {
  window.__testPosthogInitCalls = 0;
  window.__testCapturedEnvelopes = [];
  window.posthog = {
    init(token, config) {
      window.__testPosthogInitCalls += 1;
      this.__token = token;
      this.__config = config;
      this.__out = false;
      this.__recording = false;
      config?.loaded?.(this);
    },
    capture(name, properties) {
      if (this.__out) return;
      const envelope = this.__config?.before_send ? this.__config.before_send({
        event: name,
        properties: {
          ...properties,
          distinct_id: this.__config?.bootstrap?.distinctID,
          $session_id: "session_telemetry_1234",
          $window_id: "window_telemetry_1234",
          $current_url: location.href,
        },
      }) : { event: name, properties };
      if (!envelope) return;
      window.__testCapturedEnvelopes.push(envelope);
    },
    has_opted_out_capturing() { return !!this.__out; },
    opt_in_capturing() { this.__out = false; },
    opt_out_capturing() { this.__out = true; },
    startSessionRecording() { this.__recording = true; },
    stopSessionRecording() { this.__recording = false; },
  };
})();`;

let checks = 0;
const ok = (condition, message) => {
  assert.ok(condition, message);
  checks++;
  console.log(`  ✓ ${message}`);
};

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    clear: () => { map.clear(); },
    get map() { return map; },
  };
}

function createFakeAdapter() {
  const sent = [];
  return {
    sent,
    capture: (name, properties) => { sent.push([name, properties]); },
    setEnabled: (enabled) => {},
  };
}

console.log("\n=== Section 1: Pure Telemetry Unit & Schema Foundation ===");
{
  // Milestone duplicate policy and event definition
  ok(Telemetry.getEventPolicy("late_install_transfer") === "milestone",
    "late_install_transfer duplicate policy is milestone (once per installation)");
  ok(Telemetry.getEventPolicy("unknown_event") === null,
    "unknown event has null duplicate policy");

  // Requirement 8: Context verification
  const validContexts = { source_context: "browser", destination_context: "standalone", outcome: "success" };
  const payload = Telemetry.buildLateInstallTransferPayload({ platform_class: "ios" });
  ok(payload.source_context === "browser", "source_context is browser");
  ok(payload.destination_context === "standalone", "destination_context is standalone");
  ok(payload.outcome === "success", "outcome is success");
  ok(payload.platform_class === "ios", "platform_class is preserved if valid");

  // Rejection of invalid contexts
  const storage = createMemoryStorage({
    [CONSENT_KEY]: "true",
    [IDENTITY_KEY]: JSON.stringify({
      schemaVersion: 1,
      installationId: "11111111-1111-4111-8111-111111111111",
      createdAt: "2026-10-10T10:00:00.000Z",
    }),
  });
  const adapter = createFakeAdapter();
  Telemetry.boot({ storage, adapter, appVersion: "1.0.0", releaseChannel: "preview" });

  ok(!Telemetry.capture("late_install_transfer", { source_context: "standalone", destination_context: "standalone" }),
    "rejects invalid source_context (standalone)");
  ok(!Telemetry.capture("late_install_transfer", { source_context: "browser", destination_context: "browser" }),
    "rejects invalid destination_context (browser)");
  ok(!Telemetry.capture("late_install_transfer", { source_context: "unknown", destination_context: "standalone" }),
    "rejects unknown source_context");
  ok(!Telemetry.capture("late_install_transfer", {}),
    "rejects missing context properties");

  // Acceptance of reviewed shape
  adapter.sent.length = 0;
  ok(Telemetry.capture("late_install_transfer", validContexts),
    "accepts reviewed late_install_transfer context shape");
  ok(adapter.sent.length === 1, "adapter received exactly one event");
  ok(adapter.sent[0][1].telemetry_schema_version === 1, "schema version 1 attached");
}

console.log("\n=== Section 2: Redaction and Threat Fixture Boundary (Requirement 9) ===");
{
  const telemetryCase = REDACTION_CASES.cases.find((c) => c.id === "telemetry-event");
  assert.ok(telemetryCase, "telemetry-event case found in redaction-cases.json");

  // 1. Contract redaction check
  const redacted = Contract.redactDiagnostic(telemetryCase.input, telemetryCase.channel);
  ok(redacted.ok === true, "Contract.redactDiagnostic accepts telemetry event");
  ok(redacted.value.event === "late_install_transfer", "redacted event name is late_install_transfer");
  ok(redacted.value.source_context === "browser", "redacted source_context is browser");
  ok(redacted.value.destination_context === "standalone", "redacted destination_context is standalone");
  for (const omitted of telemetryCase.mustOmitPaths) {
    ok(!(omitted in redacted.value), `sensitive field '${omitted}' omitted from redacted diagnostic`);
  }
  const renderedDiagnostic = JSON.stringify(redacted.value);
  for (const canary of telemetryCase.mustNotContain) {
    ok(!renderedDiagnostic.includes(canary), `canary '${canary}' absent from redacted diagnostic`);
  }

  // 2. Direct capture boundary rejects prohibited properties
  const rejected = Telemetry.capture("late_install_transfer", telemetryCase.input);
  ok(rejected === false, "Telemetry.capture rejects hostile input with unallowed keys (token, claimId, payload_size, program)");

  // 3. PostHog before_send outbound boundary sanitizes envelope
  const bootResult = Telemetry.boot({
    storage: createMemoryStorage({
      [CONSENT_KEY]: "true",
      [IDENTITY_KEY]: JSON.stringify({
        schemaVersion: 1,
        installationId: "11111111-1111-4111-8111-111111111111",
        createdAt: "2026-10-10T10:00:00.000Z",
      }),
    }),
    appVersion: "1.0.0",
    releaseChannel: "preview",
  });

  const outbound = bootResult.beforeSend({
    event: "late_install_transfer",
    properties: {
      source_context: "browser",
      destination_context: "standalone",
      outcome: "success",
      token: "FIXTURE_ONLY_TOKEN_CANARY",
      claimId: "FIXTURE_ONLY_CLAIM_ID_CANARY",
      payload_size: 12345,
      program: "FIXTURE_ONLY_PROGRAM_CANARY",
      telemetry_schema_version: 1,
      app_version: "1.0.0",
      release_channel: "preview",
      distinct_id: "11111111-1111-4111-8111-111111111111",
    },
  });
  ok(outbound !== null, "outbound envelope produced for valid core fields");
  ok(!("claimId" in outbound.properties), "claimId stripped from outbound properties");
  ok(!("payload_size" in outbound.properties), "payload_size stripped from outbound properties");
  ok(!("program" in outbound.properties), "program stripped from outbound properties");
  const renderedOutbound = JSON.stringify(outbound);
  for (const canary of telemetryCase.mustNotContain) {
    ok(!renderedOutbound.includes(canary), `canary '${canary}' absent from outbound envelope`);
  }
}

console.log("\n=== Section 3: Settlement Qualification and Failure Isolation (Requirement 7) ===");
{
  // Requirement 7: Claim alone, validation alone, partial import, rollback, and remote-delete ambiguity cannot emit success
  ok(!Telemetry.canEmitLateInstallTransfer({ claimOnly: true }),
    "claim alone cannot emit late_install_transfer");
  ok(!Telemetry.canEmitLateInstallTransfer({ validationOnly: true }),
    "validation alone cannot emit late_install_transfer");
  ok(!Telemetry.canEmitLateInstallTransfer({ partialImport: true, state: "importing" }),
    "partial import cannot emit late_install_transfer");
  ok(!Telemetry.canEmitLateInstallTransfer({ rollback: true, state: "rolledBack" }),
    "rollback cannot emit late_install_transfer");
  ok(!Telemetry.canEmitLateInstallTransfer({ state: "rolledBack" }),
    "rolledBack state cannot emit late_install_transfer");
  ok(!Telemetry.canEmitLateInstallTransfer({ remoteDeleteAmbiguous: true }),
    "remote-delete ambiguity cannot emit late_install_transfer");
  ok(!Telemetry.canEmitLateInstallTransfer({ cleanupRetry: true }),
    "cleanupRetry (remote delete ambiguous) cannot emit late_install_transfer");

  const storage = createMemoryStorage({ [CONSENT_KEY]: "true" });
  const adapter = createFakeAdapter();
  Telemetry.boot({ storage, adapter });

  ok(!Telemetry.recordLateInstallTransfer({ storage, claimOnly: true }),
    "recordLateInstallTransfer returns false on claim only");
  ok(!Telemetry.recordLateInstallTransfer({ storage, validationOnly: true }),
    "recordLateInstallTransfer returns false on validation only");
  ok(!Telemetry.recordLateInstallTransfer({ storage, partialImport: true }),
    "recordLateInstallTransfer returns false on partial import");
  ok(!Telemetry.recordLateInstallTransfer({ storage, rollback: true, state: "rolledBack" }),
    "recordLateInstallTransfer returns false on rollback");
  ok(!Telemetry.recordLateInstallTransfer({ storage, cleanupRetry: true, state: "localCommitted" }),
    "recordLateInstallTransfer returns false on remote-delete ambiguity");
  ok(adapter.sent.length === 0, "adapter received zero events during all non-success conditions");
}

console.log("\n=== Section 4: Preserved Identity & Restored Consent (Requirements 2, 3, 4, 5) ===");
{
  const transferredIdentity = {
    schemaVersion: 1,
    installationId: "22222222-2222-4222-8222-222222222222",
    createdAt: "2026-10-10T08:00:00.000Z",
  };

  // Requirement 4: Consent disabled => zero late_install_transfer events emitted
  {
    const storageDisabled = createMemoryStorage({
      [CONSENT_KEY]: "false", // restored disabled consent
      [IDENTITY_KEY]: JSON.stringify(transferredIdentity),
    });
    const adapter = createFakeAdapter();
    const bootStatus = Telemetry.boot({ storage: storageDisabled, adapter });

    ok(bootStatus.enabled === false, "telemetry booted disabled as dictated by restored consent");
    ok(bootStatus.installationId === transferredIdentity.installationId,
      "transferred installationId preserved when disabled");
    ok(!Telemetry.canEmitLateInstallTransfer({ enabled: false, localImportVerified: true }),
      "canEmitLateInstallTransfer returns false when consent is disabled");
    ok(!Telemetry.recordLateInstallTransfer({ storage: storageDisabled, localImportVerified: true }),
      "recordLateInstallTransfer returns false when consent is disabled");
    ok(!Telemetry.capture("late_install_transfer", { source_context: "browser", destination_context: "standalone" }),
      "capture returns false when disabled");
    ok(adapter.sent.length === 0, "zero late_install_transfer events emitted when consent is disabled");
  }

  // Requirement 5: Consent enabled + verified local import => exactly one late_install_transfer event
  {
    const storageEnabled = createMemoryStorage({
      [CONSENT_KEY]: "true", // restored enabled consent
      [IDENTITY_KEY]: JSON.stringify(transferredIdentity),
    });
    const adapter = createFakeAdapter();
    const bootStatus = Telemetry.boot({ storage: storageEnabled, adapter });

    ok(bootStatus.enabled === true, "telemetry booted enabled with restored consent");
    ok(bootStatus.installationId === transferredIdentity.installationId,
      "transferred installationId preserved when enabled");
    ok(Telemetry.canEmitLateInstallTransfer({ enabled: true, localImportVerified: true }),
      "canEmitLateInstallTransfer returns true with enabled consent and verified import");

    const emitted = Telemetry.recordLateInstallTransfer({ storage: storageEnabled, localImportVerified: true });
    ok(emitted === true, "recordLateInstallTransfer succeeded for verified import");
    ok(adapter.sent.length === 1, "exactly one event reached the adapter");
    const [eventName, eventProps] = adapter.sent[0];
    ok(eventName === "late_install_transfer", "event name is late_install_transfer");
    ok(eventProps.source_context === "browser", "source_context is browser");
    ok(eventProps.destination_context === "standalone", "destination_context is standalone");
    ok(eventProps.outcome === "success", "outcome is success");
  }
}

console.log("\n=== Section 5: Strictly Exactly-Once Across Retries / Reloads / Recovery (Requirement 6) ===");
{
  const transferredIdentity = {
    schemaVersion: 1,
    installationId: "33333333-3333-4333-8333-333333333333",
    createdAt: "2026-10-10T09:00:00.000Z",
  };
  const persistentStorage = createMemoryStorage({
    [CONSENT_KEY]: "true",
    [IDENTITY_KEY]: JSON.stringify(transferredIdentity),
  });
  const adapter = createFakeAdapter();

  // First boot and emission
  Telemetry.boot({ storage: persistentStorage, adapter });
  const first = Telemetry.recordLateInstallTransfer({ storage: persistentStorage, localImportVerified: true });
  ok(first === true, "first emission succeeded");
  ok(adapter.sent.length === 1, "adapter has 1 event");
  ok(Telemetry.hasEmittedLateInstallTransfer(persistentStorage) === true,
    "emission marker recorded in durable storage");

  // Immediate retry in same process
  const retryImmediate = Telemetry.recordLateInstallTransfer({ storage: persistentStorage, localImportVerified: true });
  ok(retryImmediate === false, "immediate retry refused");
  ok(adapter.sent.length === 1, "event not duplicated on immediate retry");

  // Simulating reload / new boot
  Telemetry.boot({ storage: persistentStorage, adapter });
  ok(Telemetry.canEmitLateInstallTransfer({
    storage: persistentStorage,
    localImportVerified: true,
    alreadyEmitted: Telemetry.hasEmittedLateInstallTransfer(persistentStorage),
  }) === false, "canEmitLateInstallTransfer returns false after reload");
  const retryAfterReload = Telemetry.recordLateInstallTransfer({ storage: persistentStorage, localImportVerified: true });
  ok(retryAfterReload === false, "retry after reload refused");
  ok(adapter.sent.length === 1, "event not duplicated after reload");

  // Simulating local-committed recovery
  const retryRecovery = Telemetry.recordLateInstallTransfer({
    storage: persistentStorage,
    state: "localCommitted",
    localOk: true,
  });
  ok(retryRecovery === false, "retry during local-committed recovery refused");
  ok(adapter.sent.length === 1, "strictly exactly one event emitted across entire lifecycle");
}

console.log("\n=== Section 6: Browser Runtime & Passive PostHog Settlement Verification ===");
const browser = await launchChromium();
try {
  // Requirement 1: Passive PostHog boundary rule in runtime
  console.log("  [Browser] Pre-settlement failure halts before PostHog init or identity mutation");
  {
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.route(`**${POSTHOG_SDK_PATH}`, (route) =>
      route.fulfill({ status: 200, contentType: "application/javascript", body: POSTHOG_SDK_DOUBLE })
    );
    await context.addInitScript(({ markerKey, identityKey, consentKey }) => {
      localStorage.setItem(markerKey, "{malformed-marker");
      localStorage.removeItem(identityKey);
      localStorage.removeItem(consentKey);
      window.__POSTHOG_CONFIG__ = {
        appVersion: "test-passive",
        host: location.origin,
        projectToken: "phc_test_token",
        releaseChannel: "preview",
        sdkVersion: "1.400.0",
      };
    }, { markerKey: INSTALL_MARKER_KEY, identityKey: IDENTITY_KEY, consentKey: CONSENT_KEY });

    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    try {
      await page.waitForFunction(() => !!window.__repforgeBootFailure, undefined, { timeout: 10000 });
    } catch {}

    const observed = await page.evaluate(({ identityKey, consentKey }) => ({
      posthogInitCalls: window.__testPosthogInitCalls || 0,
      identityRaw: localStorage.getItem(identityKey),
      consentRaw: localStorage.getItem(consentKey),
      hasBootFailure: !!window.__repforgeBootFailure,
    }), { identityKey: IDENTITY_KEY, consentKey: CONSENT_KEY });

    ok(observed.posthogInitCalls === 0,
      "PostHog SDK init was NEVER called when transfer failed before settlement");
    ok(observed.identityRaw === null,
      "No identity was minted in localStorage before transfer settlement");
    ok(observed.consentRaw === null,
      "No consent was written before transfer settlement");
    ok(observed.hasBootFailure === true,
      "Pre-settlement failure trapped correctly");

    await context.close();
  }

  // Requirement 2, 3, 4: Preserved identity and disabled consent silence in runtime
  console.log("  [Browser] Standalone transfer with disabled consent preserves identity and emits zero events");
  {
    const transferredUuid = "44444444-4444-4444-8444-444444444444";
    const transferredCreatedAt = "2026-10-10T12:00:00.000Z";
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.route(`**${POSTHOG_SDK_PATH}`, (route) =>
      route.fulfill({ status: 200, contentType: "application/javascript", body: POSTHOG_SDK_DOUBLE })
    );

    await context.addInitScript(({ idKey, consentKey, uuid, createdAt }) => {
      // Simulate restored state right after import settlement
      localStorage.setItem(idKey, JSON.stringify({ schemaVersion: 1, installationId: uuid, createdAt }));
      localStorage.setItem(consentKey, "false"); // disabled consent transferred
      window.__POSTHOG_CONFIG__ = {
        appVersion: "test-disabled-consent",
        host: location.origin,
        projectToken: "phc_test_token",
        releaseChannel: "preview",
        sdkVersion: "1.400.0",
      };
    }, { idKey: IDENTITY_KEY, consentKey: CONSENT_KEY, uuid: transferredUuid, createdAt: transferredCreatedAt });

    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });

    const runtimeCheck = await page.evaluate(({ idKey, consentKey }) => {
      const storedIdentity = JSON.parse(localStorage.getItem(idKey) || "{}");
      const consent = localStorage.getItem(consentKey);
      const isEnabled = window.RepForgeTelemetry?.isEnabled?.();
      // Try to emit late_install_transfer
      const recordResult = window.RepForgeTelemetry?.recordLateInstallTransfer?.({ localImportVerified: true });
      const captureResult = window.RepForgeTelemetry?.capture?.("late_install_transfer", {
        source_context: "browser",
        destination_context: "standalone",
      });
      const captured = window.__testCapturedEnvelopes || [];
      return { storedIdentity, consent, isEnabled, recordResult, captureResult, capturedCount: captured.length };
    }, { idKey: IDENTITY_KEY, consentKey: CONSENT_KEY });

    ok(runtimeCheck.storedIdentity.installationId === transferredUuid,
      "Transferred installationId preserved in browser runtime");
    ok(runtimeCheck.storedIdentity.createdAt === transferredCreatedAt,
      "Transferred createdAt preserved in browser runtime");
    ok(runtimeCheck.consent === "false",
      "Transferred disabled consent restored in storage");
    ok(runtimeCheck.isEnabled === false,
      "RepForgeTelemetry is disabled");
    ok(runtimeCheck.recordResult === false,
      "recordLateInstallTransfer refused when consent is disabled");
    ok(runtimeCheck.captureResult === false,
      "capture refused when consent is disabled");
    ok(runtimeCheck.capturedCount === 0,
      "Zero telemetry events captured when consent is disabled");

    await context.close();
  }

  // Requirement 2, 3, 5, 6, 8, 9: Preserved identity, enabled consent, exactly-once, correct contexts, and redaction
  console.log("  [Browser] Standalone transfer with enabled consent emits exactly once, preserves identity, and redacts canaries");
  {
    const transferredUuid = "55555555-5555-4555-8555-555555555555";
    const transferredCreatedAt = "2026-10-10T14:00:00.000Z";
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.route(`**${POSTHOG_SDK_PATH}`, (route) =>
      route.fulfill({ status: 200, contentType: "application/javascript", body: POSTHOG_SDK_DOUBLE })
    );

    await context.addInitScript(({ idKey, consentKey, uuid, createdAt }) => {
      localStorage.setItem(idKey, JSON.stringify({ schemaVersion: 1, installationId: uuid, createdAt }));
      localStorage.setItem(consentKey, "true"); // enabled consent transferred
      window.__POSTHOG_CONFIG__ = {
        appVersion: "test-enabled-consent",
        host: location.origin,
        projectToken: "phc_test_token",
        releaseChannel: "preview",
        sdkVersion: "1.400.0",
      };
    }, { idKey: IDENTITY_KEY, consentKey: CONSENT_KEY, uuid: transferredUuid, createdAt: transferredCreatedAt });

    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await page.waitForFunction(() => !!window.posthog && window.__testPosthogInitCalls > 0);

    // Emit event and attempt duplicate emission
    const emissionCheck = await page.evaluate(({ uuid }) => {
      const isEnabled = window.RepForgeTelemetry?.isEnabled?.();
      const firstEmit = window.RepForgeTelemetry?.recordLateInstallTransfer?.({
        localImportVerified: true,
        platform_class: "ios",
      });
      const secondEmit = window.RepForgeTelemetry?.recordLateInstallTransfer?.({
        localImportVerified: true,
      });
      const captured = window.__testCapturedEnvelopes || [];
      const transferEvents = captured.filter((e) => e.event === "late_install_transfer");
      return { isEnabled, firstEmit, secondEmit, transferEvents };
    }, { uuid: transferredUuid });

    ok(emissionCheck.isEnabled === true, "RepForgeTelemetry is enabled with transferred consent");
    ok(emissionCheck.firstEmit === true, "First emission succeeded");
    ok(emissionCheck.secondEmit === false, "Second emission in same session was rejected (strictly exactly-once)");
    ok(emissionCheck.transferEvents.length === 1, "Exactly one late_install_transfer event was emitted");

    const emittedEnvelope = emissionCheck.transferEvents[0];
    ok(emittedEnvelope.event === "late_install_transfer", "Emitted event name is late_install_transfer");
    ok(emittedEnvelope.properties.source_context === "browser", "Emitted source_context is browser");
    ok(emittedEnvelope.properties.destination_context === "standalone", "Emitted destination_context is standalone");
    ok(emittedEnvelope.properties.outcome === "success", "Emitted outcome is success");
    ok(emittedEnvelope.properties.telemetry_schema_version === 1, "Emitted schema version is 1");
    ok(emittedEnvelope.properties.distinct_id === transferredUuid, "Emitted distinct_id matches preserved identity");

    // Reload test: Verify that reload still does not emit a second event
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await page.waitForFunction(() => !!window.posthog && window.__testPosthogInitCalls > 0);

    const reloadCheck = await page.evaluate(() => {
      const reloadEmit = window.RepForgeTelemetry?.recordLateInstallTransfer?.({ localImportVerified: true });
      const captured = window.__testCapturedEnvelopes || [];
      const transferEvents = captured.filter((e) => e.event === "late_install_transfer");
      return { reloadEmit, transferEventsCount: transferEvents.length };
    });

    ok(reloadCheck.reloadEmit === false, "Emission after reload was rejected");
    ok(reloadCheck.transferEventsCount === 0, "No duplicate late_install_transfer event was emitted after reload");

    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\n========================================`);
console.log(`install-transfer-telemetry: ${checks} checks passed`);
console.log(`All 9 Plan 053 Row 6 telemetry requirements verified.`);
