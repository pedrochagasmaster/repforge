(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RepForgeTelemetry = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_VERSION = 1;
  const IDENTITY_KEY = "repforge_telemetry_identity_v1";
  const PREFERENCE_KEY = "repforge_telemetry_enabled_v1";
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const VERSION_PATTERN = /^[a-zA-Z0-9._-]{1,32}$/;
  const CHANNELS = Object.freeze(["production", "preview"]);
  const AUTOCAPTURE_ACTIONS = Object.freeze([
    "nav_today",
    "nav_progress",
    "nav_history",
    "nav_program",
    "settings_open",
  ]);

  const values = (...allowed) => Object.freeze({ kind: "enum", allowed: Object.freeze(allowed) });
  const boolean = Object.freeze({ kind: "boolean" });
  const optional = validator => Object.freeze({ ...validator, optional: true });

  /* How often analysis may legitimately see one event for one subject.
     Undeclared, a double-fire regression and a real change in behavior are
     the same shape in the data, and every funnel built on the event inherits
     that ambiguity. This is a declaration dashboards and tests assert
     against, not runtime suppression: silently dropping a second event would
     hide the regression instead of surfacing it.

     once_per_boot        one app start
     once_per_setup_flow  one program-entry attempt, from first answer to
                          activation; restarting inside the same flow does
                          not begin a new one
     once_per_session     one training session
     milestone            expected once for the install; recurs only if the
                          user erases the history that defined it
     repeatable           many per subject by design */
  const DUPLICATE_POLICIES = Object.freeze([
    "once_per_boot",
    "once_per_setup_flow",
    "once_per_session",
    "milestone",
    "repeatable",
  ]);
  const event = (properties, metric, duplicates) => {
    if (!DUPLICATE_POLICIES.includes(duplicates)) {
      throw new TypeError(`Telemetry event needs a duplicate-expectation policy, received ${String(duplicates)}`);
    }
    return Object.freeze({
      phase: "alpha",
      properties: Object.freeze(properties),
      metric,
      duplicates,
    });
  };

  const EVENTS = Object.freeze({
    app_boot: event({ first_run: boolean, language: values("en", "pt"), platform_class: values("ios", "android", "desktop", "other") }, "Successful app boot", "once_per_boot"),
    program_path_selected: event({ route: values("recommend", "custom", "browse", "build", "import", "shared") }, "Program entry route chosen", "once_per_setup_flow"),
    generator_started: event({ mode: values("baseline") }, "Working baseline generator started", "once_per_setup_flow"),
    generator_completed: event({ goal: values("muscle_growth", "balanced", "strength"), frequency: values("2", "3", "4", "5", "6"), family: values("legacy", "growth", "balanced", "strength", "home", "foundation") }, "Generator produced a reviewable program", "once_per_setup_flow"),
    template_selected: event({ family: values("growth_v1", "balanced_v1", "strength_v1", "home_v1") }, "Executable Taurifer template selected", "once_per_setup_flow"),
    program_activated: event({ route: values("recommend", "custom", "browse", "build", "import", "shared"), version_category: values("legacy_v1", "taurifer_v1", "manual_v1", "import_v1", "shared_v1") }, "Program activation committed", "once_per_setup_flow"),
    first_set_logged: event({}, "First working set committed", "milestone"),
    set_saved: event({ vs_suggestion: values("matched", "raised", "lowered", "no_suggestion") }, "Working set committed relative to its suggestion", "repeatable"),
    recommendation_explained: event({ surface: values("workout", "focus", "exercise") }, "Recommendation explanation opened", "repeatable"),
    recommendation_overridden: event({ reason: optional(values("adjustment", "preference", "equipment", "pain", "other")) }, "Recommendation deliberately overridden", "repeatable"),
    exercise_skipped: event({ context: values("planned_session", "one_off") }, "Exercise explicitly skipped", "repeatable"),
    substitution_used: event({ reason: values("equipment", "preference", "pain", "crowded", "other") }, "Exercise substitution committed", "repeatable"),
    equipment_context_selected: event({ context_count: values("1", "2", "3_plus") }, "Equipment context chosen", "repeatable"),
    one_off_started: event({ kind: values("manual", "classic", "recommended"), time: values("30", "45", "60", "75", "90_plus"), equipment: values("full", "limited", "bodyweight", "other") }, "One-off session started", "once_per_session"),
    one_off_completed: event({ kind: values("manual", "classic", "recommended"), duration: values("0_15", "16_30", "31_60", "61_90", "90_plus") }, "One-off session completed", "once_per_session"),
    session_completed: event({ set_count: values("0", "1_5", "6_10", "11_20", "21_plus"), exercise_count: values("0", "1_3", "4_6", "7_plus"), duration: values("0_15", "16_30", "31_60", "61_90", "90_plus") }, "Planned session completed", "once_per_session"),
    session_abandoned: event({ stage: values("before_set", "working", "review"), reason: values("time", "recovery", "pain", "equipment", "schedule", "other") }, "Session explicitly abandoned", "once_per_session"),
    session_summary_viewed: event({}, "Completed-session summary opened", "once_per_session"),
    block_review_viewed: event({ completion: values("early", "partial", "complete", "extended") }, "Block review opened", "repeatable"),
    program_transition_selected: event({ transition: values("resume", "repair", "rebase", "switch") }, "Program transition selected", "once_per_setup_flow"),
  });

  let runtime = emptyRuntime();

  function emptyRuntime() {
    return {
      adapter: null,
      appVersion: "dev",
      crypto: null,
      enabled: true,
      identity: null,
      location: null,
      navigator: null,
      now: () => new Date(),
      onReject: null,
      releaseChannel: "preview",
      storage: null,
    };
  }

  function reject(reason, detail) {
    try {
      if (typeof runtime.onReject === "function") runtime.onReject(Object.freeze({ reason, detail }));
    } catch {}
    return false;
  }

  function storageGet(key) {
    try { return runtime.storage && runtime.storage.getItem(key); } catch { return null; }
  }

  function storageSet(key, value) {
    try {
      if (runtime.storage) runtime.storage.setItem(key, value);
      return true;
    } catch { return false; }
  }

  function randomUuid() {
    const source = runtime.crypto;
    try {
      if (source && typeof source.randomUUID === "function") {
        const id = source.randomUUID();
        if (UUID_PATTERN.test(id)) return id;
      }
      if (source && typeof source.getRandomValues === "function") {
        const bytes = new Uint8Array(16);
        source.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 15) | 64;
        bytes[8] = (bytes[8] & 63) | 128;
        const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0"));
        return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
      }
    } catch {}
    return null;
  }

  function validIdentity(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    if (Object.keys(value).sort().join(",") !== "createdAt,installationId,schemaVersion") return false;
    return value.schemaVersion === 1 && UUID_PATTERN.test(value.installationId) &&
      typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt));
  }

  function installationIdentity() {
    if (runtime.identity) return runtime.identity;
    let stored = null;
    try { stored = JSON.parse(storageGet(IDENTITY_KEY)); } catch {}
    if (validIdentity(stored)) {
      runtime.identity = Object.freeze({ ...stored });
      return runtime.identity;
    }
    const installationId = randomUuid();
    if (!installationId) return null;
    let createdAt;
    try { createdAt = runtime.now().toISOString(); } catch { createdAt = new Date(0).toISOString(); }
    runtime.identity = Object.freeze({ schemaVersion: 1, installationId, createdAt });
    storageSet(IDENTITY_KEY, JSON.stringify(runtime.identity));
    return runtime.identity;
  }

  function safeLocation(locationValue) {
    const origin = typeof locationValue?.origin === "string" ? locationValue.origin : "";
    const pathname = typeof locationValue?.pathname === "string" ? locationValue.pathname : "/";
    if (!/^https?:\/\/[^/?#]+$/i.test(origin) || /[?#]/.test(pathname)) return Object.freeze({ origin: "", pathname: "/" });
    return Object.freeze({ origin, pathname: pathname.startsWith("/") ? pathname : `/${pathname}` });
  }

  function readEnabled() {
    const stored = storageGet(PREFERENCE_KEY);
    return stored !== "false";
  }

  function boot(options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) options = {};
    if (Object.prototype.hasOwnProperty.call(options, "adapter")) runtime.adapter = options.adapter || null;
    if (Object.prototype.hasOwnProperty.call(options, "storage") && runtime.storage !== options.storage) {
      runtime.storage = options.storage || null;
      runtime.identity = null;
    }
    if (Object.prototype.hasOwnProperty.call(options, "location")) runtime.location = options.location || null;
    if (Object.prototype.hasOwnProperty.call(options, "navigator")) runtime.navigator = options.navigator || null;
    if (Object.prototype.hasOwnProperty.call(options, "crypto")) runtime.crypto = options.crypto || null;
    if (typeof options.now === "function") runtime.now = options.now;
    if (typeof options.onReject === "function") runtime.onReject = options.onReject;
    if (VERSION_PATTERN.test(options.appVersion || "")) runtime.appVersion = options.appVersion;
    if (CHANNELS.includes(options.releaseChannel)) runtime.releaseChannel = options.releaseChannel;
    runtime.enabled = readEnabled();
    const identity = installationIdentity();
    try {
      if (runtime.adapter && typeof runtime.adapter.setEnabled === "function") runtime.adapter.setEnabled(runtime.enabled);
    } catch {}
    return Object.freeze({
      beforeSend: filterOutbound,
      enabled: runtime.enabled,
      installationId: identity?.installationId || null,
      safeLocation: safeLocation(runtime.location),
    });
  }

  function validProperty(value, validator) {
    if (value === undefined) return !!validator.optional;
    if (validator.kind === "boolean") return typeof value === "boolean";
    return validator.kind === "enum" && typeof value === "string" && validator.allowed.includes(value);
  }

  function capture(eventName, properties = {}) {
    if (!runtime.enabled) return false;
    const definition = EVENTS[eventName];
    if (!definition || definition.phase !== "alpha") return reject("unknown_event", eventName);
    if (!properties || typeof properties !== "object" || Array.isArray(properties)) return reject("invalid_properties", eventName);
    const keys = Object.keys(properties);
    if (keys.some(key => key.startsWith("$") || !Object.prototype.hasOwnProperty.call(definition.properties, key))) return reject("unknown_property", eventName);
    for (const [key, validator] of Object.entries(definition.properties)) {
      if (!validProperty(properties[key], validator)) return reject("invalid_property", `${eventName}.${key}`);
    }
    const payload = {
      ...properties,
      telemetry_schema_version: SCHEMA_VERSION,
      app_version: runtime.appVersion,
      release_channel: runtime.releaseChannel,
    };
    try {
      if (!runtime.adapter || typeof runtime.adapter.capture !== "function") return false;
      runtime.adapter.capture(eventName, Object.freeze(payload));
      return true;
    } catch { return false; }
  }

  function filterOutbound(envelope) {
    if (!runtime.enabled || !envelope || typeof envelope !== "object" || Array.isArray(envelope)) return null;
    if (envelope.event === "$autocapture") return filterAutocapture(envelope);
    if (envelope.event === "$snapshot") return filterReplay(envelope);
    const definition = EVENTS[envelope.event];
    const properties = envelope.properties;
    if (!definition || definition.phase !== "alpha" || !properties || typeof properties !== "object" || Array.isArray(properties)) return null;
    const clean = {};
    for (const [key, validator] of Object.entries(definition.properties)) {
      if (!validProperty(properties[key], validator)) return null;
      if (properties[key] !== undefined) clean[key] = properties[key];
    }
    if (properties.telemetry_schema_version !== SCHEMA_VERSION ||
      properties.app_version !== runtime.appVersion ||
      properties.release_channel !== runtime.releaseChannel) return null;
    clean.telemetry_schema_version = SCHEMA_VERSION;
    clean.app_version = runtime.appVersion;
    clean.release_channel = runtime.releaseChannel;
    const identity = installationIdentity();
    if (!identity || properties.distinct_id !== identity.installationId) return null;
    clean.distinct_id = identity.installationId;
    for (const key of ["$session_id", "$window_id"]) {
      if (properties[key] === undefined) continue;
      if (typeof properties[key] !== "string" || properties[key].length < 8 || properties[key].length > 64 || !/^[a-zA-Z0-9_-]+$/.test(properties[key])) return null;
      clean[key] = properties[key];
    }
    return Object.freeze({ event: envelope.event, properties: Object.freeze(clean) });
  }

  function transportIdentity(properties) {
    const identity = installationIdentity();
    if (!identity || properties?.distinct_id !== identity.installationId) return null;
    const clean = { distinct_id: identity.installationId };
    for (const key of ["$session_id", "$window_id"]) {
      if (properties[key] === undefined) continue;
      if (typeof properties[key] !== "string" || properties[key].length < 8 || properties[key].length > 64 || !/^[a-zA-Z0-9_-]+$/.test(properties[key])) return null;
      clean[key] = properties[key];
    }
    return clean;
  }

  function autocaptureAction(properties) {
    if (AUTOCAPTURE_ACTIONS.includes(properties?.telemetry_action)) return properties.telemetry_action;
    if (!Array.isArray(properties?.$elements)) return null;
    for (const element of properties.$elements) {
      const action = element?.attributes?.["data-telemetry-action"] || element?.["attr__data-telemetry-action"];
      if (AUTOCAPTURE_ACTIONS.includes(action)) return action;
    }
    return null;
  }

  function filterAutocapture(envelope) {
    const properties = envelope.properties;
    if (!properties || typeof properties !== "object" || Array.isArray(properties)) return null;
    if (properties.$event_type !== undefined && properties.$event_type !== "click") return null;
    const telemetry_action = autocaptureAction(properties);
    const transport = transportIdentity(properties);
    if (!telemetry_action || !transport) return null;
    return Object.freeze({
      event: "$autocapture",
      properties: Object.freeze({
        telemetry_action,
        $event_type: "click",
        telemetry_schema_version: SCHEMA_VERSION,
        app_version: runtime.appVersion,
        release_channel: runtime.releaseChannel,
        ...transport,
      }),
    });
  }

  function replayValueIsMasked(value, key = "", depth = 0, seen = new Set()) {
    if (depth > 32) return false;
    if (value == null || typeof value === "boolean" || typeof value === "number") return true;
    if (typeof value === "string") {
      if (/[?#]setup=|(?:^|[^a-z0-9_])v[12]\.[a-z0-9_-]{4,}/i.test(value)) return false;
      if (/^(?:https?:)?\/\//i.test(value) && /[?#]/.test(value)) return false;
      if (/^(?:text|textContent|value|placeholder|title|aria-label|name)$/i.test(key)) return /^(?:\s|\*|•|x)*$/i.test(value);
      return true;
    }
    if (typeof value !== "object" || seen.has(value)) return false;
    seen.add(value);
    const entries = Array.isArray(value) ? value.map((entry, index) => [String(index), entry]) : Object.entries(value);
    for (const [childKey, child] of entries) {
      if (!replayValueIsMasked(child, childKey, depth + 1, seen)) return false;
    }
    seen.delete(value);
    return true;
  }

  function filterReplay(envelope) {
    const properties = envelope.properties;
    if (!properties || typeof properties !== "object" || Array.isArray(properties)) return null;
    const transport = transportIdentity(properties);
    if (!transport || !properties.$snapshot_data || !replayValueIsMasked(properties.$snapshot_data)) return null;
    return Object.freeze({
      event: "$snapshot",
      properties: Object.freeze({
        $snapshot_data: properties.$snapshot_data,
        $current_url: `${safeLocation(runtime.location).origin}${safeLocation(runtime.location).pathname}`,
        ...transport,
      }),
    });
  }

  function setEnabled(enabled) {
    runtime.enabled = enabled === true;
    storageSet(PREFERENCE_KEY, String(runtime.enabled));
    try {
      if (runtime.adapter && typeof runtime.adapter.setEnabled === "function") runtime.adapter.setEnabled(runtime.enabled);
    } catch {}
    return runtime.enabled;
  }

  function bucketCount(value, kind) {
    if (!Number.isSafeInteger(value) || value < 0) return null;
    if (kind === "sets") return value === 0 ? "0" : value <= 5 ? "1_5" : value <= 10 ? "6_10" : value <= 20 ? "11_20" : "21_plus";
    if (kind === "exercises") return value === 0 ? "0" : value <= 3 ? "1_3" : value <= 6 ? "4_6" : "7_plus";
    return null;
  }

  function bucketDuration(minutes) {
    if (!Number.isFinite(minutes) || minutes < 0) return null;
    return minutes <= 15 ? "0_15" : minutes <= 30 ? "16_30" : minutes <= 60 ? "31_60" : minutes <= 90 ? "61_90" : "90_plus";
  }

  return Object.freeze({
    DUPLICATE_POLICIES,
    boot,
    bucketCount,
    bucketDuration,
    capture,
    getEventNames: () => Object.freeze(Object.keys(EVENTS)),
    getEventPolicy: name => EVENTS[name]?.duplicates || null,
    getAutocaptureActions: () => AUTOCAPTURE_ACTIONS,
    getSchemaVersion: () => SCHEMA_VERSION,
    isEnabled: () => runtime.enabled,
    setEnabled,
  });
});
