(function installTransferContract(root) {
  "use strict";

  const ENDPOINTS = Object.freeze({
    create: "/v1/transfers",
    claims: "/v1/transfers/claims",
    commit: "/v1/transfers/claims/commit",
    status: "/v1/transfers/status",
    envelope: "/envelope",
  });

  const LIMITS = deepFreeze({
    requestBodyCreateBytes: 2_000_000,
    requestBodySmallEndpointBytes: 4_096,
    envelopeBytes: 2_000_000,
    depth: 64,
    objectKeys: 256,
    arrayItems: 10_000,
    stringChars: 8_000,
    identifierChars: 256,
    logRows: 200_000,
    programRows: 2_000,
    programHistoryEntries: 2_000,
    customExercises: 1_000,
    serializedLogRowChars: 8_000,
    claimsPerToken: 1,
    claimIdMinChars: 22,
    claimIdMaxChars: 43,
    claimIdEntropyBitsMin: 128,
    claimIdEntropyBitsMax: 256,
    createRatePerIpPerMinute: 5,
    claimCommitStatusRatePerTokenPerMinute: 60,
  });

  const ERROR_CODES = Object.freeze({
    INVALID_INPUT: "invalid-input",
    INVALID_ENDPOINT: "invalid-endpoint",
    BODY_TOO_LARGE: "body-too-large",
    ENVELOPE_TOO_LARGE: "envelope-too-large",
    INVALID_UTF8: "invalid-utf8",
    INVALID_JSON: "invalid-json",
    INVALID_ENVELOPE: "invalid-envelope",
    INVALID_REQUEST: "invalid-request",
    INVALID_REQUEST_SHAPE: "invalid-request-shape",
    INVALID_SCHEMA_VERSION: "invalid-schema-version",
    UNSUPPORTED_SCHEMA_VERSION: "unsupported-schema-version",
    UNSUPPORTED_WORKOUT_DRAFT_VERSION: "unsupported-workout-draft-version",
    UNSUPPORTED_PROGRAM_ENTRY_DRAFT_VERSION: "unsupported-program-entry-draft-version",
    UNKNOWN_SECTION: "unknown-section",
    DEPTH_TOO_LARGE: "depth-too-large",
    OBJECT_TOO_WIDE: "object-too-wide",
    ARRAY_TOO_LARGE: "array-too-large",
    STRING_TOO_LONG: "string-too-long",
    IDENTIFIER_TOO_LONG: "identifier-too-long",
    INVALID_STRING: "invalid-string",
    DUPLICATE_KEY: "duplicate-key",
    DANGEROUS_KEY: "dangerous-key",
    FORBIDDEN_FIELD: "forbidden-field",
    PROGRAM_TOO_LARGE: "program-too-large",
    PROGRAM_HISTORY_TOO_LARGE: "program-history-too-large",
    CUSTOM_EXERCISES_TOO_LARGE: "custom-exercises-too-large",
    LOG_ROW_TOO_LARGE: "log-row-too-large",
    CLAIM_ID_INVALID: "claim-id-invalid",
    RATE_LIMITED: "rate-limited",
    CLAIM_UNAVAILABLE: "claim-unavailable",
    INTEGRITY_MISMATCH: "integrity-mismatch",
    CRYPTO_UNAVAILABLE: "crypto-unavailable",
    INVALID_DIAGNOSTIC: "invalid-diagnostic",
  });

  const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
  const VOLATILE_KEYS = new Set([
    "_storageRevision",
    "_storageFollowUp",
    "_storageDraftTransaction",
    "_storageSetupActivation",
    "cookies",
    "cookie",
    "locks",
    "pending",
    "closing",
    "tabId",
    "writerId",
    "operationId",
    "notificationPermission",
    "permission",
    "providerSessionId",
    "providerAnalyticsSessionId",
    "analyticsSessionId",
    "posthogSessionId",
    "posthog_session_id",
    "sessionId",
    "logicalStateDigest",
  ]);

  const TOP_LEVEL_KEYS = Object.freeze([
    "kind",
    "schemaVersion",
    "createdAt",
    "source",
    "sourceRevision",
    "durableState",
    "workoutDraft",
    "programEntryDraft",
    "uiPreferences",
    "analytics",
    "telemetryIdentity",
    "integrity",
  ]);
  const DRAFT_KEYS = Object.freeze([
    "schemaVersion",
    "draftId",
    "program",
    "session",
    "exerciseOrder",
    "exercises",
  ]);
  const SOURCE_KEYS = Object.freeze(["context", "logicalInstallationId"]);
  const UI_PREFERENCE_KEYS = Object.freeze(["theme"]);
  const ANALYTICS_KEYS = Object.freeze(["enabled"]);
  const TELEMETRY_KEYS = Object.freeze(["schemaVersion", "installationId", "createdAt"]);

  const DIAGNOSTIC_CHANNELS = Object.freeze({
    SERVICE: "service-structured-log",
    STATIC_HOST: "static-host-access-log",
    RESPONSE: "client-response-observable",
    TELEMETRY: "telemetry",
    ERROR: "error-tracking",
  });
  const STATUS_STATES = new Set(["available", "claiming", "deleted", "expired", "claimed-expired", "unavailable"]);
  const CLAIM_ID_RE = /^[A-Za-z0-9_-]+$/;

  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const child of Object.values(value)) deepFreeze(child);
    }
    return value;
  }

  function ok(value) {
    return { ok: true, value };
  }

  function fail(code) {
    return { ok: false, code };
  }

  function hasOwn(value, key) {
    return value !== null && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key);
  }

  function isPlainObject(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const tag = Object.prototype.toString.call(value);
    if (tag !== "[object Object]") return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype === null) return true;
    return Object.getPrototypeOf(prototype) === null;
  }

  function isDangerousKey(key) {
    return DANGEROUS_KEYS.has(key);
  }

  function isVolatileKey(key) {
    return VOLATILE_KEYS.has(key) || /^repforge_(?:pending|draft_v1:(?:pending|closing|recovery))/.test(key);
  }

  function isArrayIndexKey(key, length) {
    if (key === "") return false;
    const index = Number(key);
    return Number.isInteger(index) && index >= 0 && index < length && String(index) === key;
  }

  function hasOnlyJsonOwnProperties(value) {
    if (Object.getOwnPropertySymbols(value).length > 0) return false;
    const names = Object.getOwnPropertyNames(value);
    if (Array.isArray(value)) {
      return names.every(name => name === "length" || isArrayIndexKey(name, value.length));
    }
    return names.length === Object.keys(value).length;
  }

  function hasDenseArrayIndices(value) {
    const keys = Object.keys(value);
    return keys.length === value.length && keys.every(key => isArrayIndexKey(key, value.length));
  }

  function scalarCount(value) {
    let count = 0;
    for (let index = 0; index < value.length; index += 1) {
      const codeUnit = value.charCodeAt(index);
      if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
        const next = value.charCodeAt(index + 1);
        if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) throw new TypeError("invalid string");
        index += 1;
      } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
        throw new TypeError("invalid string");
      }
      count += 1;
    }
    return count;
  }

  function fromCodeUnits(units) {
    let output = "";
    const chunkSize = 8_192;
    for (let index = 0; index < units.length; index += chunkSize) {
      output += String.fromCharCode(...units.slice(index, index + chunkSize));
    }
    return output;
  }

  function measureChars(value) {
    if (typeof value !== "string") throw new TypeError("character measurement accepts only strings");
    return scalarCount(value);
  }

  function textEncoder() {
    const Constructor = root && root.TextEncoder;
    if (typeof Constructor !== "function") throw new TypeError("TextEncoder is unavailable");
    return new Constructor();
  }

  function byteTag(value) {
    return Object.prototype.toString.call(value);
  }

  function asBytes(value) {
    if (byteTag(value) === "[object Uint8Array]") return value;
    if (byteTag(value) === "[object ArrayBuffer]") return new Uint8Array(value);
    return null;
  }

  function measureUtf8Bytes(value) {
    if (typeof value === "string") return textEncoder().encode(value).byteLength;
    const bytes = asBytes(value);
    if (bytes) return bytes.byteLength;
    throw new TypeError("UTF-8 byte measurement accepts only string, Uint8Array, or ArrayBuffer");
  }

  class ContractFailure extends Error {
    constructor(code) {
      super();
      this.code = code;
    }
  }

  function throwFailure(code) {
    throw new ContractFailure(code);
  }

  function parserTextDecoder() {
    const Constructor = root && root.TextDecoder;
    if (typeof Constructor !== "function") throwFailure(ERROR_CODES.INVALID_UTF8);
    return new Constructor("utf-8", { fatal: true });
  }

  class BoundedJsonParser {
    constructor(source) {
      this.source = source;
      this.index = 0;
    }

    parse() {
      this.skipWhitespace();
      const value = this.parseValue(0);
      this.skipWhitespace();
      if (this.index !== this.source.length) throwFailure(ERROR_CODES.INVALID_JSON);
      return value;
    }

    current() {
      return this.source[this.index];
    }

    skipWhitespace() {
      while (this.index < this.source.length) {
        const code = this.source.charCodeAt(this.index);
        if (code !== 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) return;
        this.index += 1;
      }
    }

    parseValue(depth) {
      this.skipWhitespace();
      if (this.index >= this.source.length) throwFailure(ERROR_CODES.INVALID_JSON);
      const token = this.current();
      if (token === "{") return this.parseObject(depth);
      if (token === "[") return this.parseArray(depth);
      if (token === '"') return this.parseString();
      if (token === "t") return this.parseLiteral("true", true);
      if (token === "f") return this.parseLiteral("false", false);
      if (token === "n") return this.parseLiteral("null", null);
      if (token === "-" || (token >= "0" && token <= "9")) return this.parseNumber();
      throwFailure(ERROR_CODES.INVALID_JSON);
    }

    checkDepth(depth) {
      if (depth > LIMITS.depth) throwFailure(ERROR_CODES.DEPTH_TOO_LARGE);
    }

    parseObject(depth) {
      this.checkDepth(depth);
      this.index += 1;
      const output = {};
      const keys = new Set();
      this.skipWhitespace();
      if (this.current() === "}") {
        this.index += 1;
        return output;
      }
      while (this.index < this.source.length) {
        this.skipWhitespace();
        if (this.current() !== '"') throwFailure(ERROR_CODES.INVALID_JSON);
        const key = this.parseString();
        if (isDangerousKey(key)) throwFailure(ERROR_CODES.DANGEROUS_KEY);
        if (keys.has(key)) throwFailure(ERROR_CODES.DUPLICATE_KEY);
        if (scalarCount(key) > LIMITS.identifierChars) throwFailure(ERROR_CODES.IDENTIFIER_TOO_LONG);
        if (keys.size >= LIMITS.objectKeys) throwFailure(ERROR_CODES.OBJECT_TOO_WIDE);
        keys.add(key);
        this.skipWhitespace();
        if (this.current() !== ":") throwFailure(ERROR_CODES.INVALID_JSON);
        this.index += 1;
        const value = this.parseValue(depth + 1);
        Object.defineProperty(output, key, { value, enumerable: true, writable: true, configurable: true });
        this.skipWhitespace();
        if (this.current() === "}") {
          this.index += 1;
          return output;
        }
        if (this.current() !== ",") throwFailure(ERROR_CODES.INVALID_JSON);
        this.index += 1;
      }
      throwFailure(ERROR_CODES.INVALID_JSON);
    }

    parseArray(depth) {
      this.checkDepth(depth);
      this.index += 1;
      const output = [];
      this.skipWhitespace();
      if (this.current() === "]") {
        this.index += 1;
        return output;
      }
      while (this.index < this.source.length) {
        if (output.length >= LIMITS.arrayItems) throwFailure(ERROR_CODES.ARRAY_TOO_LARGE);
        output.push(this.parseValue(depth + 1));
        this.skipWhitespace();
        if (this.current() === "]") {
          this.index += 1;
          return output;
        }
        if (this.current() !== ",") throwFailure(ERROR_CODES.INVALID_JSON);
        this.index += 1;
        this.skipWhitespace();
      }
      throwFailure(ERROR_CODES.INVALID_JSON);
    }

    parseString() {
      if (this.current() !== '"') throwFailure(ERROR_CODES.INVALID_JSON);
      this.index += 1;
      const units = [];
      let pendingHigh = null;
      let scalarValues = 0;
      const pushUnit = (unit) => {
        if (pendingHigh !== null) {
          if (unit < 0xdc00 || unit > 0xdfff) throwFailure(ERROR_CODES.INVALID_STRING);
          units.push(pendingHigh, unit);
          pendingHigh = null;
          scalarValues += 1;
        } else if (unit >= 0xd800 && unit <= 0xdbff) {
          pendingHigh = unit;
        } else if (unit >= 0xdc00 && unit <= 0xdfff) {
          throwFailure(ERROR_CODES.INVALID_STRING);
        } else {
          units.push(unit);
          scalarValues += 1;
        }
        if (scalarValues > LIMITS.stringChars) throwFailure(ERROR_CODES.STRING_TOO_LONG);
      };
      while (this.index < this.source.length) {
        const character = this.current();
        this.index += 1;
        if (character === '"') {
          if (pendingHigh !== null) throwFailure(ERROR_CODES.INVALID_STRING);
          return fromCodeUnits(units);
        }
        if (character === "\\") {
          if (this.index >= this.source.length) throwFailure(ERROR_CODES.INVALID_JSON);
          const escape = this.source[this.index];
          this.index += 1;
          const escapes = { '"': 0x22, "\\": 0x5c, "/": 0x2f, b: 0x08, f: 0x0c, n: 0x0a, r: 0x0d, t: 0x09 };
          if (Object.prototype.hasOwnProperty.call(escapes, escape)) {
            pushUnit(escapes[escape]);
            continue;
          }
          if (escape !== "u" || this.index + 4 > this.source.length) throwFailure(ERROR_CODES.INVALID_JSON);
          const hex = this.source.slice(this.index, this.index + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) throwFailure(ERROR_CODES.INVALID_JSON);
          this.index += 4;
          pushUnit(Number.parseInt(hex, 16));
          continue;
        }
        if (character.charCodeAt(0) < 0x20) throwFailure(ERROR_CODES.INVALID_JSON);
        const first = character.charCodeAt(0);
        if (first >= 0xd800 && first <= 0xdbff && this.index < this.source.length) {
          const next = this.source.charCodeAt(this.index);
          if (next >= 0xdc00 && next <= 0xdfff) {
            this.index += 1;
            pushUnit(first);
            pushUnit(next);
            continue;
          }
        }
        pushUnit(first);
      }
      throwFailure(ERROR_CODES.INVALID_JSON);
    }

    parseLiteral(literal, value) {
      if (this.source.slice(this.index, this.index + literal.length) !== literal) {
        throwFailure(ERROR_CODES.INVALID_JSON);
      }
      this.index += literal.length;
      return value;
    }

    parseNumber() {
      const start = this.index;
      if (this.current() === "-") this.index += 1;
      if (this.current() === "0") {
        this.index += 1;
        if (this.current() >= "0" && this.current() <= "9") throwFailure(ERROR_CODES.INVALID_JSON);
      } else {
        if (!(this.current() >= "1" && this.current() <= "9")) throwFailure(ERROR_CODES.INVALID_JSON);
        while (this.current() >= "0" && this.current() <= "9") this.index += 1;
      }
      if (this.current() === ".") {
        this.index += 1;
        if (!(this.current() >= "0" && this.current() <= "9")) throwFailure(ERROR_CODES.INVALID_JSON);
        while (this.current() >= "0" && this.current() <= "9") this.index += 1;
      }
      if (this.current() === "e" || this.current() === "E") {
        this.index += 1;
        if (this.current() === "+" || this.current() === "-") this.index += 1;
        if (!(this.current() >= "0" && this.current() <= "9")) throwFailure(ERROR_CODES.INVALID_JSON);
        while (this.current() >= "0" && this.current() <= "9") this.index += 1;
      }
      const value = Number(this.source.slice(start, this.index));
      if (!Number.isFinite(value)) throwFailure(ERROR_CODES.INVALID_JSON);
      return value;
    }
  }

  function parseBoundedJson(rawBytes, endpoint) {
    if (!Object.values(ENDPOINTS).includes(endpoint)) return fail(ERROR_CODES.INVALID_ENDPOINT);
    const bytes = asBytes(rawBytes);
    if (!bytes) return fail(ERROR_CODES.INVALID_INPUT);
    const limit = endpoint === ENDPOINTS.envelope || endpoint === ENDPOINTS.create
      ? LIMITS.envelopeBytes
      : LIMITS.requestBodySmallEndpointBytes;
    if (bytes.byteLength > limit) {
      return fail(endpoint === ENDPOINTS.envelope ? ERROR_CODES.ENVELOPE_TOO_LARGE : ERROR_CODES.BODY_TOO_LARGE);
    }
    let source;
    try {
      source = parserTextDecoder().decode(bytes);
    } catch {
      return fail(ERROR_CODES.INVALID_UTF8);
    }
    try {
      return ok(new BoundedJsonParser(source).parse());
    } catch (error) {
      return fail(error instanceof ContractFailure ? error.code : ERROR_CODES.INVALID_JSON);
    }
  }

  function inspectJson(value, options = {}) {
    const bounded = options.bounded !== false;
    const active = new Set();
    function visit(node, depth) {
      if (node === null) return null;
      if (typeof node === "string") {
        try {
          const length = scalarCount(node);
          if (bounded && length > LIMITS.stringChars) return ERROR_CODES.STRING_TOO_LONG;
        } catch {
          return ERROR_CODES.INVALID_STRING;
        }
        return null;
      }
      if (typeof node === "boolean") return null;
      if (typeof node === "number") return Number.isFinite(node) ? null : ERROR_CODES.INVALID_INPUT;
      if (typeof node !== "object") return ERROR_CODES.INVALID_INPUT;
      if (active.has(node)) return ERROR_CODES.INVALID_INPUT;
      if (bounded && depth > LIMITS.depth) return ERROR_CODES.DEPTH_TOO_LARGE;
      active.add(node);
      let result = null;
      if (Array.isArray(node)) {
        if (bounded && node.length > LIMITS.arrayItems) result = ERROR_CODES.ARRAY_TOO_LARGE;
        if (!result && (!hasOnlyJsonOwnProperties(node) || !hasDenseArrayIndices(node))) result = ERROR_CODES.INVALID_INPUT;
        if (!result) {
          for (let index = 0; index < node.length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(node, String(index));
            if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
              result = ERROR_CODES.INVALID_INPUT;
              break;
            }
            result = visit(descriptor.value, depth + 1);
            if (result) break;
          }
        }
      } else if (!isPlainObject(node)) {
        result = ERROR_CODES.INVALID_INPUT;
      } else {
        if (!hasOnlyJsonOwnProperties(node)) result = ERROR_CODES.INVALID_INPUT;
        const keys = Object.keys(node);
        if (bounded && keys.length > LIMITS.objectKeys) result = ERROR_CODES.OBJECT_TOO_WIDE;
        for (const key of keys) {
          if (result) break;
          const descriptor = Object.getOwnPropertyDescriptor(node, key);
          if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
            result = ERROR_CODES.INVALID_INPUT;
            break;
          }
          if (isDangerousKey(key)) {
            result = ERROR_CODES.DANGEROUS_KEY;
            break;
          }
          if (isVolatileKey(key)) {
            result = ERROR_CODES.FORBIDDEN_FIELD;
            break;
          }
          try {
            if (bounded && scalarCount(key) > LIMITS.identifierChars) {
              result = ERROR_CODES.IDENTIFIER_TOO_LONG;
              break;
            }
          } catch {
            result = ERROR_CODES.INVALID_STRING;
            break;
          }
          result = visit(descriptor.value, depth + 1);
        }
      }
      active.delete(node);
      return result;
    }
    return visit(value, 0);
  }

  function cloneJson(value) {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(cloneJson);
    const output = {};
    for (const key of Object.keys(value)) {
      Object.defineProperty(output, key, {
        value: cloneJson(value[key]),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return output;
  }

  function canonicalJson(value) {
    const active = new Set();
    function serialize(node) {
      if (node === null) return "null";
      if (typeof node === "string") {
        try {
          scalarCount(node);
        } catch {
          throw new TypeError("canonical JSON rejects lone surrogates");
        }
        return JSON.stringify(node);
      }
      if (typeof node === "boolean") return node ? "true" : "false";
      if (typeof node === "number") {
        if (!Number.isFinite(node)) throw new TypeError("canonical JSON rejects non-finite numbers");
        return JSON.stringify(node);
      }
      if (typeof node !== "object" || active.has(node)) throw new TypeError("canonical JSON rejects non-JSON values");
      if (Array.isArray(node)) {
        if (!hasOnlyJsonOwnProperties(node)) throw new TypeError("canonical JSON rejects non-JSON arrays");
        if (!hasDenseArrayIndices(node)) throw new TypeError("canonical JSON rejects sparse arrays");
        active.add(node);
        const values = [];
        for (let index = 0; index < node.length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(node, String(index));
          if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
            throw new TypeError("canonical JSON rejects accessors");
          }
          values.push(serialize(descriptor.value));
        }
        const result = `[${values.join(",")}]`;
        active.delete(node);
        return result;
      }
      if (!isPlainObject(node)) throw new TypeError("canonical JSON rejects non-plain objects");
      if (!hasOnlyJsonOwnProperties(node)) throw new TypeError("canonical JSON rejects non-JSON objects");
      active.add(node);
      const keys = Object.keys(node).sort();
      const parts = [];
      for (const key of keys) {
        if (isDangerousKey(key)) throw new TypeError("canonical JSON rejects dangerous keys");
        try {
          scalarCount(key);
        } catch {
          throw new TypeError("canonical JSON rejects invalid keys");
        }
        const descriptor = Object.getOwnPropertyDescriptor(node, key);
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
          throw new TypeError("canonical JSON rejects accessors");
        }
        parts.push(`${JSON.stringify(key)}:${serialize(descriptor.value)}`);
      }
      active.delete(node);
      return `{${parts.join(",")}}`;
    }
    return serialize(value);
  }

  function exactKeys(value, expected) {
    const expectedSet = new Set(expected);
    const keys = Object.keys(value);
    if (keys.some(key => !expectedSet.has(key))) return ERROR_CODES.UNKNOWN_SECTION;
    if (keys.length !== expected.length || expected.some(key => !hasOwn(value, key))) return ERROR_CODES.INVALID_ENVELOPE;
    return null;
  }

  function validString(value, nonEmpty = false) {
    if (typeof value !== "string" || (nonEmpty && value.length === 0)) return false;
    try {
      return scalarCount(value) <= LIMITS.stringChars;
    } catch {
      return false;
    }
  }

  function validIdentifier(value, nonEmpty = false) {
    if (!validString(value, nonEmpty)) return false;
    try {
      return scalarCount(value) <= LIMITS.identifierChars;
    } catch {
      return false;
    }
  }

  function validateWorkoutDraft(value) {
    if (value === null) return null;
    if (!isPlainObject(value)) return ERROR_CODES.INVALID_ENVELOPE;
    if (value.schemaVersion !== 2) {
      return typeof value.schemaVersion === "number"
        ? ERROR_CODES.UNSUPPORTED_WORKOUT_DRAFT_VERSION
        : ERROR_CODES.INVALID_SCHEMA_VERSION;
    }
    if (hasOwn(value, "writer") || hasOwn(value, "revision")) return ERROR_CODES.FORBIDDEN_FIELD;
    const keys = exactKeys(value, DRAFT_KEYS);
    if (keys) return keys;
    if (!validIdentifier(value.draftId, true) || !isPlainObject(value.program) || !isPlainObject(value.session) ||
      !Array.isArray(value.exerciseOrder) || !isPlainObject(value.exercises)) return ERROR_CODES.INVALID_ENVELOPE;
    if (hasOwn(value.program, "durableRevision")) return ERROR_CODES.FORBIDDEN_FIELD;
    return null;
  }

  function validateProgramEntryDraft(value) {
    if (value === null) return null;
    if (!isPlainObject(value)) return ERROR_CODES.INVALID_ENVELOPE;
    if (value.schemaVersion !== 1) {
      return typeof value.schemaVersion === "number"
        ? ERROR_CODES.UNSUPPORTED_PROGRAM_ENTRY_DRAFT_VERSION
        : ERROR_CODES.INVALID_SCHEMA_VERSION;
    }
    if (hasOwn(value, "ownerId") || hasOwn(value, "revision") || hasOwn(value, "state")) return ERROR_CODES.FORBIDDEN_FIELD;
    return null;
  }

  function validateEnvelope(value) {
    const inspected = inspectJson(value);
    if (inspected) return fail(inspected);
    if (!isPlainObject(value)) return fail(ERROR_CODES.INVALID_ENVELOPE);
    let canonicalEnvelope;
    try {
      canonicalEnvelope = canonicalJson(value);
      if (measureUtf8Bytes(canonicalEnvelope) > LIMITS.envelopeBytes) return fail(ERROR_CODES.ENVELOPE_TOO_LARGE);
    } catch {
      return fail(ERROR_CODES.INVALID_INPUT);
    }
    const topKeys = exactKeys(value, TOP_LEVEL_KEYS);
    if (topKeys) return fail(topKeys);
    if (value.kind !== "taurifer-install-transfer") return fail(ERROR_CODES.INVALID_ENVELOPE);
    if (typeof value.schemaVersion !== "number" || !Number.isInteger(value.schemaVersion)) {
      return fail(ERROR_CODES.INVALID_SCHEMA_VERSION);
    }
    if (value.schemaVersion !== 1) return fail(ERROR_CODES.UNSUPPORTED_SCHEMA_VERSION);
    if (!validString(value.createdAt, true)) return fail(ERROR_CODES.INVALID_ENVELOPE);
    if (!isPlainObject(value.source) || exactKeys(value.source, SOURCE_KEYS) || value.source.context !== "browser" ||
      !validIdentifier(value.source.logicalInstallationId, true)) return fail(ERROR_CODES.INVALID_ENVELOPE);
    if (!Number.isSafeInteger(value.sourceRevision) || value.sourceRevision < 0) return fail(ERROR_CODES.INVALID_ENVELOPE);
    if (!isPlainObject(value.durableState)) return fail(ERROR_CODES.INVALID_ENVELOPE);
    let sectionError = validateWorkoutDraft(value.workoutDraft);
    if (sectionError) return fail(sectionError);
    sectionError = validateProgramEntryDraft(value.programEntryDraft);
    if (sectionError) return fail(sectionError);
    if (!isPlainObject(value.uiPreferences) || exactKeys(value.uiPreferences, UI_PREFERENCE_KEYS) ||
      !["system", "light", "dark"].includes(value.uiPreferences.theme)) return fail(ERROR_CODES.INVALID_ENVELOPE);
    if (!isPlainObject(value.analytics) || exactKeys(value.analytics, ANALYTICS_KEYS) ||
      typeof value.analytics.enabled !== "boolean") return fail(ERROR_CODES.INVALID_ENVELOPE);
    if (!isPlainObject(value.telemetryIdentity) || exactKeys(value.telemetryIdentity, TELEMETRY_KEYS) ||
      value.telemetryIdentity.schemaVersion !== 1 || !validIdentifier(value.telemetryIdentity.installationId, true) ||
      !validString(value.telemetryIdentity.createdAt, true)) return fail(ERROR_CODES.INVALID_ENVELOPE);
    if (!isPlainObject(value.integrity) || Object.keys(value.integrity).length !== 1 ||
      !validString(value.integrity.canonicalPayloadHash, true) ||
      !/^[0-9a-f]{64}$/.test(value.integrity.canonicalPayloadHash)) return fail(ERROR_CODES.INVALID_ENVELOPE);

    const durable = value.durableState;
    const collectionChecks = [
      ["log", LIMITS.logRows, ERROR_CODES.LOG_ROW_TOO_LARGE],
      ["program", LIMITS.programRows, ERROR_CODES.PROGRAM_TOO_LARGE],
      ["programHistory", LIMITS.programHistoryEntries, ERROR_CODES.PROGRAM_HISTORY_TOO_LARGE],
      ["customExercises", LIMITS.customExercises, ERROR_CODES.CUSTOM_EXERCISES_TOO_LARGE],
    ];
    for (const [field, limit, code] of collectionChecks) {
      if (hasOwn(durable, field)) {
        if (!Array.isArray(durable[field])) return fail(ERROR_CODES.INVALID_ENVELOPE);
        if (durable[field].length > limit) return fail(code);
      }
    }
    if (Array.isArray(durable.log)) {
      for (const row of durable.log) {
        let rowJson;
        try {
          rowJson = canonicalJson(row);
        } catch {
          return fail(ERROR_CODES.INVALID_ENVELOPE);
        }
        try {
          if (scalarCount(rowJson) > LIMITS.serializedLogRowChars) return fail(ERROR_CODES.LOG_ROW_TOO_LARGE);
        } catch {
          return fail(ERROR_CODES.INVALID_ENVELOPE);
        }
      }
    }
    return ok(cloneJson(value));
  }

  function validateClaimId(value) {
    if (typeof value !== "string") return fail(ERROR_CODES.CLAIM_ID_INVALID);
    let length;
    try {
      length = scalarCount(value);
    } catch {
      return fail(ERROR_CODES.CLAIM_ID_INVALID);
    }
    if (length < LIMITS.claimIdMinChars || length > LIMITS.claimIdMaxChars || !CLAIM_ID_RE.test(value)) {
      return fail(ERROR_CODES.CLAIM_ID_INVALID);
    }
    return ok(value);
  }

  function validateRequest(value, endpoint) {
    if (!Object.values(ENDPOINTS).includes(endpoint) || endpoint === ENDPOINTS.envelope) return fail(ERROR_CODES.INVALID_ENDPOINT);
    const inspected = inspectJson(value);
    if (inspected) return fail(inspected);
    if (!isPlainObject(value)) return fail(ERROR_CODES.INVALID_REQUEST);
    try {
      const requestLimit = endpoint === ENDPOINTS.create ? LIMITS.requestBodyCreateBytes : LIMITS.requestBodySmallEndpointBytes;
      if (measureUtf8Bytes(canonicalJson(value)) > requestLimit) return fail(ERROR_CODES.BODY_TOO_LARGE);
    } catch {
      return fail(ERROR_CODES.INVALID_REQUEST);
    }
    let expected;
    if (endpoint === ENDPOINTS.create) expected = ["envelope", "idempotencyKey"];
    else if (endpoint === ENDPOINTS.claims || endpoint === ENDPOINTS.commit) expected = ["token", "claimId"];
    else expected = ["token"];
    const shape = exactKeys(value, expected);
    if (shape) return fail(shape === ERROR_CODES.UNKNOWN_SECTION ? shape : ERROR_CODES.INVALID_REQUEST_SHAPE);
    if (endpoint === ENDPOINTS.create) {
      const envelope = validateEnvelope(value.envelope);
      if (!envelope.ok) return envelope;
      if (!validIdentifier(value.idempotencyKey, true)) return fail(ERROR_CODES.INVALID_REQUEST);
      return ok({ envelope: envelope.value, idempotencyKey: value.idempotencyKey });
    }
    if (!validString(value.token, true)) return fail(ERROR_CODES.INVALID_REQUEST);
    if (endpoint === ENDPOINTS.claims || endpoint === ENDPOINTS.commit) {
      const claimId = validateClaimId(value.claimId);
      if (!claimId.ok) return claimId;
      return ok({ token: value.token, claimId: claimId.value });
    }
    return ok({ token: value.token });
  }

  function redactDiagnostic(value, channel) {
    if (!isPlainObject(value) || !Object.values(DIAGNOSTIC_CHANNELS).includes(channel)) return fail(ERROR_CODES.INVALID_DIAGNOSTIC);
    if (channel === DIAGNOSTIC_CHANNELS.SERVICE) {
      if (value.operation === "create" && value.method === "POST" && value.path === ENDPOINTS.create) {
        return ok({ operation: "create", method: "POST", path: ENDPOINTS.create });
      }
      if (value.operation === "claim") return ok({ operation: "claim" });
      if (value.operation === "commit") return ok({ operation: "commit" });
      if (value.operation === "status") return ok({ operation: "status" });
      return fail(ERROR_CODES.INVALID_DIAGNOSTIC);
    }
    if (channel === DIAGNOSTIC_CHANNELS.STATIC_HOST) {
      return value.method === "GET" && value.path === "/index.html"
        ? ok({ method: "GET", path: "/index.html" })
        : fail(ERROR_CODES.INVALID_DIAGNOSTIC);
    }
    if (channel === DIAGNOSTIC_CHANNELS.RESPONSE) {
      if (!STATUS_STATES.has(value.state) || !validString(value.expiresAt, true)) return fail(ERROR_CODES.INVALID_DIAGNOSTIC);
      return ok({ state: value.state, expiresAt: value.expiresAt });
    }
    if (channel === DIAGNOSTIC_CHANNELS.TELEMETRY) {
      return value.event === "late_install_transfer" && value.source_context === "browser" && value.destination_context === "standalone"
        ? ok({ event: "late_install_transfer", source_context: "browser", destination_context: "standalone" })
        : fail(ERROR_CODES.INVALID_DIAGNOSTIC);
    }
    return ok({ message: "transfer failed" });
  }

  function bytesToHex(bytes) {
    let output = "";
    for (const byte of new Uint8Array(bytes)) output += byte.toString(16).padStart(2, "0");
    return output;
  }

  async function validateEnvelopeIntegrity(value, cryptoImplementation) {
    const structural = validateEnvelope(value);
    if (!structural.ok) return structural;
    const crypto = cryptoImplementation === undefined ? root && root.crypto : cryptoImplementation;
    if (!crypto || !crypto.subtle || typeof crypto.subtle.digest !== "function") return fail(ERROR_CODES.CRYPTO_UNAVAILABLE);
    const preimage = cloneJson(structural.value);
    delete preimage.integrity.canonicalPayloadHash;
    let encoded;
    try {
      encoded = textEncoder().encode(canonicalJson(preimage));
      const digest = await crypto.subtle.digest("SHA-256", encoded);
      const actual = bytesToHex(digest);
      return actual === structural.value.integrity.canonicalPayloadHash
        ? ok(structural.value)
        : fail(ERROR_CODES.INTEGRITY_MISMATCH);
    } catch {
      return fail(ERROR_CODES.CRYPTO_UNAVAILABLE);
    }
  }

  const api = Object.freeze({
    LIMITS,
    ERROR_CODES,
    ENDPOINTS,
    canonicalJson,
    measureUtf8Bytes,
    measureChars,
    parseBoundedJson,
    validateEnvelope,
    validateEnvelopeIntegrity,
    validateRequest,
    validateClaimId,
    redactDiagnostic,
  });

  if (typeof module === "object" && module && module.exports) module.exports = api;
  else root.RepForgeInstallTransferContract = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
