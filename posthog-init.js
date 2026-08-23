(function () {
  const config = window.__POSTHOG_CONFIG__;
  const token = config?.projectToken;
  const host = config?.host;

  if (!token || !host) {
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      const missingVariable = token ? "POSTHOG_HOST" : "POSTHOG_PROJECT_TOKEN";
      console.warn(`${missingVariable} variable required by PostHog is missing or un-configured, so analytics stays off. This warning stops appearing once ${missingVariable} is configured`);
    }
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js";
  script.onload = function () {
    window.posthog.init(token, {
      api_host: host,
      defaults: "2026-05-30",
      capture_exceptions: {
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
        capture_console_errors: false,
      },
    });
  };
  document.head.appendChild(script);
})();
