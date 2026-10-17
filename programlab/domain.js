(function (root) {
  "use strict";
  const Identity = typeof module !== "undefined" && module.exports
    ? require("../generation-identity.js") : root.RepForgeGenerationIdentity;
  const LIMITS = Object.freeze({ pairs: 200, sweepValues: 20, cells: 1000,
    depth: 40, parts: 10, partBytes: 50 * 1024 * 1024, totalBytes: 500 * 1024 * 1024 });
  const METRICS_VERSION = "programlab-metrics@1";
  const unsafe = new Set(["__proto__", "prototype", "constructor"]);

  function guard(value, depth = 0, active = new Set()) {
    if (depth > LIMITS.depth) throw new TypeError("Lab data exceeds maximum depth");
    if (value === null || typeof value !== "object") return;
    if (active.has(value)) throw new TypeError("Lab data must be acyclic");
    active.add(value);
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (unsafe.has(key)) throw new TypeError("Unsafe lab data key");
      if (!Object.hasOwn(descriptor, "value")) throw new TypeError("Lab properties must be data, not accessors");
      guard(descriptor.value, depth + 1, active);
    }
    active.delete(value);
  }
  function canonicalJSON(value) { guard(value); return Identity.canonicalJSON(value); }
  function digest(value) { guard(value); return Identity.digestCanonical(value); }
  function freeze(value) {
    if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  function snapshot(value) { return freeze(JSON.parse(canonicalJSON(value))); }
  function fail(code, message) { const error = new TypeError(message); error.code = code; throw error; }
  function keys(value, required, optional = []) {
    if (!value || Array.isArray(value) || typeof value !== "object"
      || required.some(key => !Object.hasOwn(value, key))
      || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) {
      fail("invalid_schema", "Missing or unknown lab fields");
    }
  }
  function text(value, field) {
    if (typeof value !== "string" || !value || value.length > 4096) fail("invalid_schema", `Invalid ${field}`);
    return value;
  }
  const api = { LIMITS, METRICS_VERSION, canonicalJSON, digest, snapshot, keys, fail, text };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ProgramLabDomain = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
