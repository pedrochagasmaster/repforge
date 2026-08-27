(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) api.start(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SDK_VERSION = "1.400.0";

  function createAdapter(posthog) {
    return Object.freeze({
      capture(eventName, properties) {
        try { posthog.capture(eventName, properties); } catch {}
      },
      setEnabled(enabled) {
        try {
          if (enabled) {
            if (posthog.has_opted_out_capturing?.()) posthog.opt_in_capturing();
          }
          else {
            posthog.stopSessionRecording?.();
            posthog.opt_out_capturing();
            posthog._requestQueue?.clear?.();
          }
        } catch {}
      },
    });
  }

  function createConfig({ host, installationId, enabled, safeLocation, beforeSend }) {
    return {
      advanced_disable_flags: true,
      api_host: host,
      autocapture: false,
      before_send: beforeSend,
      bootstrap: { distinctID: installationId, isIdentifiedID: false },
      capture_dead_clicks: false,
      capture_exceptions: false,
      capture_heatmaps: false,
      capture_pageleave: false,
      capture_pageview: false,
      capture_performance: false,
      cross_subdomain_cookie: false,
      defaults: "2026-05-30",
      disable_capture_url_hashes: true,
      disable_session_recording: true,
      disable_surveys: true,
      get_current_url: () => `${safeLocation.origin}${safeLocation.pathname}`,
      loaded(posthog) {
        try {
          if (!enabled) posthog.opt_out_capturing();
        } catch {}
      },
      logs: { captureConsoleLogs: false },
      mask_all_element_attributes: true,
      mask_all_text: true,
      opt_out_capturing_by_default: !enabled,
      opt_out_capturing_persistence_type: "local_storage",
      person_profiles: "never",
      persistence: "memory",
      rageclick: false,
      rate_limiting: { events_per_second: 4, events_burst_limit: 12 },
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "*",
        recordCanvas: false,
        recordCrossOriginIframes: false,
        recordHeaders: false,
        recordBody: false,
        streamNetworkBody: false,
        maskCapturedNetworkRequestFn(request) {
          if (!request || typeof request !== "object") return null;
          return {
            ...request,
            name: `${safeLocation.origin}${safeLocation.pathname}`,
            requestBody: undefined,
            responseBody: undefined,
            requestHeaders: undefined,
            responseHeaders: undefined,
          };
        },
      },
      strict_script_versioning: true,
      tracing_headers: [],
      ui_host: "https://us.posthog.com",
    };
  }

  function start(browser) {
    const config = browser.__POSTHOG_CONFIG__;
    const telemetry = browser.RepForgeTelemetry;
    const token = config?.projectToken;
    const host = config?.host;
    if (!telemetry || !token || !host || config.sdkVersion !== SDK_VERSION) return false;
    const status = telemetry.boot({
      appVersion: config.appVersion,
      crypto: browser.crypto,
      location: browser.location,
      navigator: browser.navigator,
      releaseChannel: config.releaseChannel,
      storage: browser.localStorage,
    });
    if (!status.installationId) return false;
    const script = browser.document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `${host}/static/${SDK_VERSION}/array.js`;
    script.onload = function () {
      try {
        const posthog = browser.posthog;
        posthog.init(token, createConfig({ ...status, host }));
        telemetry.boot({ adapter: createAdapter(posthog) });
      } catch {}
    };
    browser.document.head.appendChild(script);
    return true;
  }

  return Object.freeze({ SDK_VERSION, createAdapter, createConfig, start });
});
