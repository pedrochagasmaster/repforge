/** Optional pinned transport. Construction is passive; start follows verified
 * install-transfer import and never reads an operational global module. */
export const SDK_VERSION = "1.400.0";


/** @param {import('./posthog-contracts.js').PostHogSdk} posthog */
export function createAdapter(posthog) {
    return Object.freeze({
      /** @param {string} eventName @param {Readonly<Record<string,unknown>>} properties */
      capture(eventName, properties) {
        try { posthog.capture(eventName, properties); } catch {}
      },
      /** @param {boolean} enabled */
      setEnabled(enabled) {
        try {
          if (enabled) {
            if (posthog.has_opted_out_capturing?.()) posthog.opt_in_capturing();
            posthog.startSessionRecording?.();
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

/** @param {import('./posthog-contracts.js').ConfigInput} options */
export function createConfig({ host, installationId, enabled, safeLocation, beforeSend, token }) {
    /** @param {unknown} envelope */
    const guardedBeforeSend = (envelope) => {
      const filtered = beforeSend(envelope);
      if (!filtered || !filtered.properties || typeof filtered.properties !== "object") return filtered;
      // `token` is a reserved PostHog transport property. The pinned SDK
      // requires it after before_send; re-assert the configured value while
      // retaining the boundary's decision to drop or redact everything else.
      return {
        ...filtered,
        properties: {
          ...filtered.properties,
          token,
        },
      };
    };
    return {
      advanced_disable_flags: true,
      api_host: host,
      autocapture: {
        dom_event_allowlist: ["click"],
        element_allowlist: ["button"],
        css_selector_allowlist: ["[data-telemetry-action]"],
      },
      before_send: guardedBeforeSend,
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
      disable_session_recording: false,
      disable_surveys: true,
      get_current_url: () => `${safeLocation.origin}${safeLocation.pathname}`,
      /** @param {import('./posthog-contracts.js').PostHogSdk} posthog */
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
        blockSelector: ".ph-no-capture",
        maskAllInputs: true,
        maskTextSelector: "*",
        recordCanvas: false,
        recordCrossOriginIframes: false,
        recordHeaders: false,
        recordBody: false,
        streamNetworkBody: false,
        /** @param {Record<string,unknown>|null} request */
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

/** @param {{browser:import('./posthog-contracts.js').AdapterBrowser,telemetry:Pick<import('./posthog-contracts.js').Telemetry,'boot'>,config?:import('./posthog-contracts.js').DeploymentConfig}} options */
export function createPostHog({browser,telemetry,config={}}) {
  let state="idle";
  function start() {
    if (!telemetry || typeof telemetry.boot !== "function") return false;
    const token = config?.projectToken;
    const host = config?.host;
    let status;
    try {
      status = telemetry.boot({
      appVersion: config.appVersion || "dev",
      crypto: browser.crypto,
      location: browser.location,
      navigator: browser.navigator,
      ...(typeof token === "string" ? { projectToken: token } : {}),
      releaseChannel: config.releaseChannel || "preview",
      storage: browser.localStorage,
      });
    } catch { return false; }
    if (!status?.installationId) return false;
    // The core identity exists even in an unconfigured development build. SDK
    // validation and loading are optional after that durable boot succeeds.
    if (!token || !host || config.sdkVersion !== SDK_VERSION) return true;

    if (state === "loading") return true;
    if (state === "loaded") {
      try {
        if (browser.posthog) telemetry.boot({ adapter: createAdapter(browser.posthog) });
      } catch {}
      return true;
    }
    const document = browser.document;
    if (!document?.createElement || !document.head?.appendChild) return true;
    let script;
    try {
      script = document.createElement("script");
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `${host}/static/${SDK_VERSION}/array.js`;
      state = "loading";
      script.onload = function () {
        try {
          const posthog = browser.posthog;
          if (!posthog?.init) throw new Error("posthog-sdk-unavailable");
          posthog.init(token, createConfig({ ...status, host, token }));
          telemetry.boot({ adapter: createAdapter(posthog) });
          state = "loaded";
        } catch {
          state = "failed";
        }
      };
      script.onerror = function () { state = "failed"; };
      document.head.appendChild(script);
    } catch {
      state = "failed";
    }
    return true;
  }


  return Object.freeze({start});
}
