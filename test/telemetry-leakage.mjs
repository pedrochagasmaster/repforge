#!/usr/bin/env node
/**
 * Browser privacy boundary and failure-mode gate.
 *
 * A minimal deterministic PostHog double exercises the real loader, adapter,
 * Telemetry.beforeSend boundary, opt-out, and network paths without sending
 * anything to PostHog. Product behavior is served from the real app.
 *
 * Run with a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import assert from "node:assert/strict";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { HOSTILE_SENTINELS } from "./fixtures/telemetry.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const SDK_PATH = "/static/1.400.0/array.js";
const TOKEN = "phc_browser_privacy_fixture";

const FAKE_SDK = `(() => {
  const queue = [];
  const posthog = window.posthog = {
    _requestQueue: { clear() { queue.length = 0; } },
    capture(name, properties) {
      if (this.__out) return;
      const envelope = this.__config.before_send({
        event: name,
        properties: {
          ...properties,
          distinct_id: this.__config.bootstrap.distinctID,
          $session_id: "session_browser_1234",
          $window_id: "window_browser_1234",
          $current_url: location.href,
        },
      });
      if (!envelope) return;
      queue.push(envelope);
      fetch("/e/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(envelope) }).catch(() => {});
    },
    has_opted_out_capturing() { return !!this.__out; },
    opt_in_capturing() { this.__out = false; },
    opt_out_capturing() { this.__out = true; },
    startSessionRecording() { this.__recording = true; },
    stopSessionRecording() { this.__recording = false; },
    init(token, config) {
      this.__token = token;
      this.__config = config;
      this.__out = false;
      this.__recording = !config.disable_session_recording;
      config.loaded?.(this);
      window.__fakePosthogReady = true;
    },
  };
})();`;

function requestText(request) {
  return JSON.stringify({
    url: request.url(),
    headers: request.headers(),
    body: request.postData() || "",
  });
}

const browser = await launchChromium();
let checks = 0;
const ok = (condition, message) => {
  assert.ok(condition, message);
  checks++;
  console.log(`  ✓ ${message}`);
};

try {
  console.log("Hostile values do not cross telemetry or replay requests");
  {
    const context = await browser.newContext();
    const requests = [];
    await context.route(`**${SDK_PATH}`, route => route.fulfill({ status: 200, contentType: "application/javascript", body: FAKE_SDK }));
    await context.route("**/e/", route => { requests.push(route.request()); return route.fulfill({ status: 200, body: "{}" }); });
    await context.route("**/s/**", route => { requests.push(route.request()); return route.fulfill({ status: 200, body: "{}" }); });
    await context.addInitScript(({ token }) => {
      window.__POSTHOG_CONFIG__ = {
        appVersion: "browser-privacy",
        host: location.origin,
        projectToken: token,
        releaseChannel: "preview",
        sdkVersion: "1.400.0",
      };
    }, { token: TOKEN });
    const page = await context.newPage();
    await page.goto(`${BASE}index.html?TAURIFER_SENTINEL_QUERY_7ab0#TAURIFER_SENTINEL_FRAGMENT_7ab0`);
    await waitForAppBoot(page, { base: BASE });
    await page.waitForFunction(() => window.__fakePosthogReady === true, undefined, { timeout: 10000 });

    await page.evaluate(() => window.RepForgeTelemetry.capture("program_path_selected", { route: "import" }));
    await page.evaluate(() => {
      const config = window.posthog.__config;
      const common = {
        distinct_id: config.bootstrap.distinctID,
        $session_id: "session_browser_1234",
        $window_id: "window_browser_1234",
      };
      const auto = config.before_send({
        event: "$autocapture",
        properties: {
          ...common,
          $event_type: "click",
          $elements: [{
            tag_name: "button",
            text: "TAURIFER_SENTINEL_FREE_TEXT_7ab0",
            attributes: {
              "data-telemetry-action": "nav_history",
              "aria-label": "https://taurifer.example/?TAURIFER_SENTINEL_QUERY_7ab0#setup=v2.secret",
              value: "100.25kgx7@RIR2_TAURIFER_SENTINEL_WORKOUT_7ab0",
            },
          }],
          $current_url: location.href,
          $referrer: "v2.TAURIFER_SENTINEL_SETUP_7ab0",
        },
      });
      if (auto) fetch("/e/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(auto) });

      const safeReplay = config.before_send({
        event: "$snapshot",
        properties: {
          ...common,
          $snapshot_data: { type: 2, data: { tagName: "div", text: "***", value: "•••", attributes: { role: "button" } } },
          $current_url: location.href,
        },
      });
      if (safeReplay) fetch("/s/replay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(safeReplay) });

      window.__hostileReplayResults = [
        "TAURIFER_SENTINEL_FREE_TEXT_7ab0",
        "https://taurifer.example/?TAURIFER_SENTINEL_QUERY_7ab0#setup=v2.secret",
        "v2.TAURIFER_SENTINEL_SETUP_7ab0",
        "Squat TAURIFER_SENTINEL_EXERCISE_7ab0",
        "100.25kgx7@RIR2_TAURIFER_SENTINEL_WORKOUT_7ab0",
        "Error: TAURIFER_SENTINEL_STACK_7ab0",
        "%23setup%3Dv2.TAURIFER_SENTINEL_ENCODED_7ab0",
      ].map(text => config.before_send({
        event: "$snapshot",
        properties: { ...common, $snapshot_data: { data: { text } } },
      }));
    });
    await page.waitForTimeout(250);

    ok((await page.evaluate(() => window.__hostileReplayResults.every(value => value === null))) === true,
      "every hostile replay payload is rejected before a request");
    ok(requests.length >= 3 && requests.length <= 4,
      `only the three required requests and an async app_boot may leave the SDK double (saw ${requests.length})`);
    const rendered = requests.map(requestText).join("\n");
    for (const sentinel of HOSTILE_SENTINELS) {
      ok(!rendered.includes(sentinel), `raw sentinel is absent: ${sentinel.slice(0, 36)}`);
      ok(!rendered.includes(encodeURIComponent(sentinel)), `encoded sentinel is absent: ${sentinel.slice(0, 36)}`);
    }
    const envelopes = requests.map(request => JSON.parse(request.postData() || "{}"));
    const allowedRequestEvents = new Set(["app_boot", "program_path_selected", "$autocapture", "$snapshot"]);
    ok(envelopes.every(envelope => allowedRequestEvents.has(envelope.event)),
      "every request is one of the four explicitly reviewed event shapes");
    ok(envelopes.some(envelope => envelope.event === "program_path_selected"),
      "the approved product event reaches the request boundary");
    const auto = envelopes.find(envelope => envelope.event === "$autocapture");
    ok(auto?.properties?.telemetry_action === "nav_history", "autocapture retains only the reviewed action token");
    ok(!("$elements" in auto.properties) && !("$current_url" in auto.properties), "autocapture strips DOM chains and URLs");
    const replay = envelopes.find(envelope => envelope.event === "$snapshot");
    const servedIndex = new URL("index.html", BASE);
    ok(replay?.properties?.$current_url === servedIndex.origin + servedIndex.pathname,
      "replay URL is reduced to the safe origin and pathname");

    const beforeOptOut = requests.length;
    await page.evaluate(() => window.RepForgeTelemetry.setEnabled(false));
    await page.evaluate(() => window.RepForgeTelemetry.capture("first_set_logged", {}));
    await page.waitForTimeout(100);
    ok(requests.length === beforeOptOut, "opt-out stops future requests immediately");
    ok((await page.evaluate(() => window.posthog.__recording)) === false, "opt-out stops the active recording");
    await context.close();
  }

  console.log("SDK and network failures do not block app behavior");
  {
    const context = await browser.newContext();
    await context.route(`**${SDK_PATH}`, route => route.abort("failed"));
    await context.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
      "repforge_v1",
      JSON.stringify({
        settings: { lang: "en", unit: "kg" },
        programMeta: { onboarded: true, name: "Failure fixture", daysPerWeek: 1 },
        program: [{ id: "failure-exercise", day: "Day 1", order: 1, name: "Squat", sets: 1, min: 5, max: 8, primary: "Quads", secondary: "Glutes" }],
        log: [], programHistory: [], customExercises: [],
      }),
    ]);
    await context.addInitScript(() => {
      window.__POSTHOG_CONFIG__ = {
        appVersion: "browser-failure",
        host: location.origin,
        projectToken: "phc_browser_failure_fixture",
        releaseChannel: "preview",
        sdkVersion: "1.400.0",
      };
    });
    const page = await context.newPage();
    await page.goto(BASE);
    await waitForAppBoot(page, { base: BASE });
    ok(await page.locator("#dayTabs button").count() > 0, "the app boots when the SDK fails to load");
    await page.evaluate(() => window.__repforgeShowSettings());
    ok(await page.locator("#telemetryToggle").isVisible(), "the privacy control remains usable after SDK failure");
    await context.setOffline(true);
    ok((await page.evaluate(() => window.RepForgeTelemetry.capture("first_set_logged", {}))) === false,
      "offline capture fails closed without throwing");
    ok(await page.locator("#settings").isVisible(), "offline telemetry failure leaves the product view unchanged");
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`telemetry leakage: ${checks} browser checks pass`);
