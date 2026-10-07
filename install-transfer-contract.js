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
    // A claim response carries one complete logical envelope plus the small
    // response wrapper. The logical envelope limit remains 2,000,000 bytes.
    claimResponseBytes: 2_004_096,
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
    RESPONSE_TOO_LARGE: "response-too-large",
    INVALID_UTF8: "invalid-utf8",
    INVALID_JSON: "invalid-json",
    INVALID_ENVELOPE: "invalid-envelope",
    INVALID_REQUEST: "invalid-request",
    INVALID_REQUEST_SHAPE: "invalid-request-shape",
    INVALID_SCHEMA_VERSION: "invalid-schema-version",
    UNSUPPORTED_SCHEMA_VERSION: "unsupported-schema-version",
    UNSUPPORTED_PROGRAM_DEFINITION_VERSION: "unsupported-program-definition-version",
    UNSUPPORTED_LOG_SCHEMA_VERSION: "unsupported-log-schema-version",
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
    CATALOG_UNAVAILABLE: "catalog-unavailable",
    INVALID_DIAGNOSTIC: "invalid-diagnostic",
  });

  const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
  const VOLATILE_KEYS = new Set([
    "cookies",
    "cookie",
    "locks",
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

  function isVolatileKey(key, path) {
    if (VOLATILE_KEYS.has(key)) return true;
    if (key === "logicalStateDigest") return path.length === 1 ||
      (path.length === 2 && path[0] === "integrity");
    if (key === "_storageRevision" || key === "_storageFollowUp" ||
      key === "_storageDraftTransaction" || key === "_storageSetupActivation") {
      return path.length === 2 && path[0] === "durableState";
    }
    if (/^repforge_(?:pending|draft_v1:(?:pending|closing|recovery))/.test(key)) {
      return path.length === 2 && path[0] === "durableState";
    }
    return false;
  }

  function isIdentifierPath(path) {
    const key = path[path.length - 1];
    if (typeof key === "number") {
      const parent = path[path.length - 2];
      return parent === "exerciseOrder" || parent === "setOrder" || parent === "ids";
    }
    if (typeof key !== "string") return false;
    return key === "id" || key === "draftId" || key === "programId" || key === "dayId" ||
      key === "exerciseInstanceId" || key === "sourceExerciseId" || key === "setId" ||
      key === "libraryId" || key === "movementId" || key === "slotId" ||
      key === "logicalInstallationId" || key === "installationId" || key === "programFingerprint" ||
      key === "fingerprint" || key === "answersFingerprint" || key === "sessionId" ||
      key === "logicalSessionId" || key.endsWith("Id") || key.endsWith("ID") || key.endsWith("Fingerprint");
  }

  const UTC_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  function isUtcIsoTimestamp(value) {
    if (typeof value !== "string" || !UTC_ISO_RE.test(value)) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
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
    const tag = byteTag(value);
    if (tag === "[object Uint8Array]") {
      try {
        const Constructor = root && root.Uint8Array;
        const getter = Constructor && Object.getOwnPropertyDescriptor(Constructor.prototype, "byteLength")?.get;
        if (typeof getter === "function") getter.call(value);
        else if (typeof ArrayBuffer === "function" && !ArrayBuffer.isView(value)) return null;
        return value;
      } catch {
        return null;
      }
    }
    if (tag === "[object ArrayBuffer]") {
      try {
        const Constructor = root && root.ArrayBuffer;
        const getter = Constructor && Object.getOwnPropertyDescriptor(Constructor.prototype, "byteLength")?.get;
        if (typeof getter !== "function") return null;
        getter.call(value);
        return new Uint8Array(value);
      } catch {
        return null;
      }
    }
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

  function parseBoundedJson(rawBytes, endpoint, mode = "request") {
    if (!Object.values(ENDPOINTS).includes(endpoint)) return fail(ERROR_CODES.INVALID_ENDPOINT);
    const bytes = asBytes(rawBytes);
    if (!bytes) return fail(ERROR_CODES.INVALID_INPUT);
    const claimResponse = endpoint === ENDPOINTS.envelope && mode === "claim-response";
    let limit = LIMITS.requestBodySmallEndpointBytes;
    if (claimResponse) limit = LIMITS.claimResponseBytes;
    else if (endpoint === ENDPOINTS.envelope || endpoint === ENDPOINTS.create) limit = LIMITS.envelopeBytes;
    if (bytes.byteLength > limit) {
      return fail(claimResponse
        ? ERROR_CODES.RESPONSE_TOO_LARGE
        : endpoint === ENDPOINTS.envelope ? ERROR_CODES.ENVELOPE_TOO_LARGE : ERROR_CODES.BODY_TOO_LARGE);
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
    function visit(node, depth, path) {
      if (node === null) return null;
      if (typeof node === "string") {
        try {
          const length = scalarCount(node);
          if (bounded && isIdentifierPath(path) && length > LIMITS.identifierChars) {
            return ERROR_CODES.IDENTIFIER_TOO_LONG;
          }
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
            result = visit(descriptor.value, depth + 1, path.concat(index));
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
          const childPath = path.concat(key);
          const descriptor = Object.getOwnPropertyDescriptor(node, key);
          if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
            result = ERROR_CODES.INVALID_INPUT;
            break;
          }
          if (isDangerousKey(key)) {
            result = ERROR_CODES.DANGEROUS_KEY;
            break;
          }
          if (isVolatileKey(key, childPath)) {
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
          result = visit(descriptor.value, depth + 1, childPath);
        }
      }
      active.delete(node);
      return result;
    }
    return visit(value, 0, []);
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

  function requiredObject(value, fields) {
    return isPlainObject(value) && fields.every(field => hasOwn(value, field));
  }

  function schemaVersionErrorAt(value, path) {
    let node = value;
    for (const key of path) {
      if (!isPlainObject(node) || !hasOwn(node, key)) return null;
      node = node[key];
    }
    return node === 1 ? null : ERROR_CODES.UNSUPPORTED_SCHEMA_VERSION;
  }

  function validateDraftSet(value, setId) {
    if (!isPlainObject(value) || value.setId !== setId || !validIdentifier(setId, true) ||
      !Number.isSafeInteger(value.ordinal) || value.ordinal < 1 || !["working", "warmup"].includes(value.role) ||
      !isPlainObject(value.programmed) || !isPlainObject(value.edited) || !isPlainObject(value.touched)) return false;
    for (const field of ["load", "reps", "rir", "effort"]) {
      if (hasOwn(value.edited, field) && value.edited[field] !== null && !validString(value.edited[field])) return false;
    }
    for (const field of ["load", "reps", "effort"]) if (typeof value.touched[field] !== "boolean") return false;
    if (hasOwn(value.touched, "rir") && typeof value.touched.rir !== "boolean") return false;
    if (value.completion !== "pending" &&
      (!isPlainObject(value.completion) || !validString(value.completion.completedAt, true))) return false;
    return true;
  }

  function validateDraftExercise(value, exerciseId) {
    if (!isPlainObject(value) || value.exerciseInstanceId !== exerciseId || !validIdentifier(value.exerciseInstanceId, true) ||
      !validIdentifier(value.sourceExerciseId, true) || ![null, undefined].includes(value.libraryId) && !validIdentifier(value.libraryId, true) ||
      !validString(value.displayName, true) || !isPlainObject(value.programmed) ||
      ![null, undefined].includes(value.substitution) && !isPlainObject(value.substitution) ||
      !["active", "skipped"].includes(value.status) || !validString(value.setupNotes) ||
      !Array.isArray(value.setOrder) || !isPlainObject(value.sets)) return false;
    const programmed = value.programmed;
    // A metric composition without repetitions carries no flat rep range, as
    // the draft module allows; every other exercise needs a complete one.
    const repless = programmed.metricOrigin != null && programmed.minReps == null && programmed.maxReps == null;
    for (const field of repless ? ["order", "sets"] : ["order", "sets", "minReps", "maxReps"]) {
      if (!Number.isSafeInteger(programmed[field]) || programmed[field] < (field === "order" ? 0 : 1)) return false;
    }
    if (!repless && programmed.minReps > programmed.maxReps || !validString(programmed.notes) ||
      !validString(programmed.primary) || !validString(programmed.secondary) ||
      !validIdentifier(programmed.sourceFingerprint, true) || programmed.sets !== value.setOrder.length) return false;
    const ids = value.setOrder;
    const unique = new Set(ids);
    if (unique.size !== ids.length || ids.some(id => !validIdentifier(id, true))) return false;
    const setKeys = Object.keys(value.sets);
    if (setKeys.length !== ids.length || setKeys.some(id => !unique.has(id))) return false;
    return ids.every(id => validateDraftSet(value.sets[id], id));
  }

  function validateCanonicalWorkoutDraft(value) {
    const workoutDraft = runtimeWorkoutDraft();
    const metrics = runtimeExerciseMetrics();
    const catalog = runtimeCatalog();
    if (!workoutDraft || typeof workoutDraft.validate !== "function" ||
        !metrics || typeof metrics.validateRawIds !== "function" ||
        !isPlainObject(catalog?.uuidIndex)) return ERROR_CODES.CATALOG_UNAVAILABLE;

    // The install-transfer section is the logical projection of DraftV2. Restore
    // only the volatile fields that logicalCloneSection deliberately removes so
    // the producer remains the authority for its durable schema.
    const candidate = cloneJson(value);
    candidate.revision = 0;
    candidate.writer = {
      installationId: "install-transfer-validator",
      tabId: "install-transfer-validator",
      operationId: "install-transfer-validator",
    };
    candidate.program.durableRevision = 0;
    const checked = workoutDraft.validate(candidate);
    if (!checked.ok) return ERROR_CODES.INVALID_ENVELOPE;

    for (const exerciseId of candidate.exerciseOrder) {
      const exercise = candidate.exercises[exerciseId];
      const origin = exercise.programmed.metricOrigin;
      const libraryId = exercise.libraryId ?? exercise.programmed.libraryId ?? null;
      const sourceExercise = catalog.exercises.find((entry) => entry.id === libraryId) || null;
      const modelCoefficient = exercise.programmed.loadingModel?.bodyweightCoefficient ?? null;
      const contextCoefficient = exercise.programmed.loadingContext?.bodyweightCoefficient ?? null;
      if (modelCoefficient !== contextCoefficient) return ERROR_CODES.INVALID_ENVELOPE;
      const setCompositions = [];
      for (const setId of exercise.setOrder) {
        const programmed = exercise.sets[setId].programmed;
        const metricIds = programmed.metricType === "source_metrics@1" ? programmed.metricIds : [];
        const metricDefinitions = Array.isArray(programmed.metrics) ? programmed.metrics : [];
        const binding = metrics.validateExerciseSourceBinding({
          metricOrigin: origin,
          metricIds,
          metricDefinitions,
          sourceId: libraryId,
          sourceExercise,
          bodyweightCoefficient: exercise.programmed.loadingModel?.bodyweightCoefficient,
        });
        if (!binding.ok) return ERROR_CODES.INVALID_ENVELOPE;
        setCompositions.push(JSON.stringify([metricIds, metricDefinitions]));
      }
      if (setCompositions.some((composition) => composition !== setCompositions[0])) {
        return ERROR_CODES.INVALID_ENVELOPE;
      }
    }
    return null;
  }

  function validateWorkoutDraft(value) {
    if (value === null) return null;
    if (!isPlainObject(value)) return ERROR_CODES.INVALID_ENVELOPE;
    if (value.schemaVersion !== 2) {
      return typeof value.schemaVersion === "number"
        ? ERROR_CODES.UNSUPPORTED_WORKOUT_DRAFT_VERSION
        : ERROR_CODES.INVALID_SCHEMA_VERSION;
    }
    const programVersionError = schemaVersionErrorAt(value, ["program", "schemaVersion"]);
    if (programVersionError) return programVersionError;
    if (hasOwn(value, "writer") || hasOwn(value, "revision")) return ERROR_CODES.FORBIDDEN_FIELD;
    const keys = exactKeys(value, DRAFT_KEYS);
    if (keys) return keys;
    if (!validIdentifier(value.draftId, true) || !isPlainObject(value.program) || !isPlainObject(value.session) ||
      !Array.isArray(value.exerciseOrder) || !isPlainObject(value.exercises)) return ERROR_CODES.INVALID_ENVELOPE;
    if (hasOwn(value.program, "durableRevision")) return ERROR_CODES.FORBIDDEN_FIELD;
    for (const field of ["programId", "programFingerprint", "dayId"]) {
      if (!validIdentifier(value.program[field], true)) return ERROR_CODES.INVALID_ENVELOPE;
    }
    if (!validString(value.program.dayLabel, true) || !validString(value.program.scheduleDate) ||
      !["kg", "lb"].includes(value.program.unit) || !["numeric", "effort"].includes(value.program.rirMode)) {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    if (!validString(value.session.startedAt, true) || !validString(value.session.updatedAt, true) ||
      (value.session.bodyweight !== null && !validString(value.session.bodyweight)) || !validString(value.session.notes) ||
      (value.session.selectedExerciseId !== null && !validIdentifier(value.session.selectedExerciseId, true)) ||
      !["active", "finishing"].includes(value.session.status) || !requiredObject(value.session.contextTouched, ["day", "date", "sessionNotes", "bodyweight"])) {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    if (Object.keys(value.session.contextTouched).some(key => !["day", "date", "sessionNotes", "bodyweight"].includes(key)) ||
      Object.values(value.session.contextTouched).some(item => typeof item !== "boolean")) return ERROR_CODES.INVALID_ENVELOPE;
    const ids = value.exerciseOrder;
    const unique = new Set(ids);
    if (unique.size !== ids.length || ids.some(id => !validIdentifier(id, true))) return ERROR_CODES.INVALID_ENVELOPE;
    const exerciseKeys = Object.keys(value.exercises);
    if (exerciseKeys.length !== ids.length || exerciseKeys.some(id => !unique.has(id))) return ERROR_CODES.INVALID_ENVELOPE;
    if (value.session.selectedExerciseId !== null && !unique.has(value.session.selectedExerciseId)) return ERROR_CODES.INVALID_ENVELOPE;
    if (!ids.every(id => validateDraftExercise(value.exercises[id], id))) return ERROR_CODES.INVALID_ENVELOPE;
    return validateCanonicalWorkoutDraft(value);
  }

  function validateProgramEntryDraft(value) {
    if (value === null) return null;
    if (!isPlainObject(value)) return ERROR_CODES.INVALID_ENVELOPE;
    if (value.schemaVersion !== 1) {
      return typeof value.schemaVersion === "number"
        ? ERROR_CODES.UNSUPPORTED_PROGRAM_ENTRY_DRAFT_VERSION
        : ERROR_CODES.INVALID_SCHEMA_VERSION;
    }
    // The wire carries the logical draft, never the local storage wrapper.
    if (hasOwn(value, "ownerId") || hasOwn(value, "revision") || hasOwn(value, "state")) return ERROR_CODES.FORBIDDEN_FIELD;
    // A staged candidate from a later program schema is unsupported, not malformed.
    for (const preview of [value.result?.preview, value.result?.alternative?.preview]) {
      const version = isPlainObject(preview?.programDefinition) ? preview.programDefinition.schemaVersion : 1;
      if (version !== 1) return ERROR_CODES.UNSUPPORTED_PROGRAM_DEFINITION_VERSION;
    }
    const programEntry = runtimeProgramEntry();
    if (!programEntry || typeof programEntry.normalizeSetupDraftEnvelope !== "function") {
      return ERROR_CODES.CATALOG_UNAVAILABLE;
    }
    let normalized;
    try {
      normalized = programEntry.normalizeSetupDraftEnvelope(value);
    } catch {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    const logicalState = normalized?.value?.envelope?.state;
    if (!normalized?.ok || !isPlainObject(logicalState)) return ERROR_CODES.INVALID_ENVELOPE;
    try {
      if (canonicalJson(logicalState) !== canonicalJson(value)) return ERROR_CODES.INVALID_ENVELOPE;
    } catch {
      return ERROR_CODES.INVALID_ENVELOPE;
    }

    const result = logicalState.result;
    const previews = [];
    if (isPlainObject(result?.preview)) previews.push(result.preview);
    if (isPlainObject(result?.alternative?.preview)) previews.push(result.alternative.preview);
    const catalog = runtimeCatalog();
    const compiler = runtimeProgramCompiler();
    for (const preview of previews) {
      const customExercises = preview.customExercises ?? [];
      const customDefinitions = canonicalCustomExerciseDefinitions(customExercises);
      if (!customDefinitions.ok) return ERROR_CODES.INVALID_ENVELOPE;
      const carriesDefinition = hasOwn(preview, "programDefinition");
      if (carriesDefinition && preview.programDefinition == null) return ERROR_CODES.INVALID_ENVELOPE;
      if (carriesDefinition || customDefinitions.value.length > 0) {
        if (!catalog || !compiler) return ERROR_CODES.CATALOG_UNAVAILABLE;
        if (typeof compiler.validateCustomExerciseDefinitions !== "function" ||
            !compiler.validateCustomExerciseDefinitions(customDefinitions.value, catalog).ok) {
          return ERROR_CODES.INVALID_ENVELOPE;
        }
      }
      if (carriesDefinition) {
        const definitionError = validateCanonicalProgramDefinition(preview.programDefinition, customDefinitions.value, catalog);
        if (definitionError) return definitionError;
      }
    }
    return null;
  }

  function runtimeProgramCompiler() {
    if (root?.RepForgeProgramCompiler) return root.RepForgeProgramCompiler;
    if (typeof require === "function") return require("./program-compiler.js");
    return null;
  }

  function runtimeProgramEntry() {
    if (root?.RepForgeProgramEntry) return root.RepForgeProgramEntry;
    if (typeof require === "function") return require("./program-entry.js");
    return null;
  }

  function runtimeExerciseMetrics() {
    if (root?.RepForgeExerciseMetrics) return root.RepForgeExerciseMetrics;
    if (typeof require === "function") return require("./exercise-metrics.js");
    return null;
  }

  function runtimeWorkoutDraft() {
    if (root?.RepForgeWorkoutDraft) return root.RepForgeWorkoutDraft;
    if (typeof require === "function") return require("./workout-draft.js");
    return null;
  }

  function runtimeCatalog() {
    try {
      const snapshot = root?.RepForgeExerciseCatalog?.snapshot?.();
      if (snapshot) return snapshot;
    } catch {}
    if (typeof require === "function") {
      try { return require("./assets/exercise-catalog.json"); } catch {}
    }
    return null;
  }

  function canonicalCustomExerciseDefinitions(customExercises) {
    if (!Array.isArray(customExercises)) return { ok: false };
    const definitions = [];
    for (const exercise of customExercises) {
      if (!isPlainObject(exercise) || typeof exercise.id !== "string" || !exercise.id.startsWith("custom:") ||
          !validString(exercise.name, true) ||
          (hasOwn(exercise, "namePt") && !validString(exercise.namePt, true)) ||
          !Array.isArray(exercise.equipment) || exercise.equipment.some((entry) => !validString(entry, true)) ||
          (hasOwn(exercise, "primary") && !validString(exercise.primary)) ||
          (hasOwn(exercise, "secondary") && !validString(exercise.secondary)) ||
          (hasOwn(exercise, "notes") && !validString(exercise.notes))) return { ok: false };
      const hasIds = hasOwn(exercise, "metricIds");
      const hasDefinitions = hasOwn(exercise, "metricDefinitions");
      if (hasIds !== hasDefinitions ||
          (hasIds && (!Array.isArray(exercise.metricIds) || !Array.isArray(exercise.metricDefinitions)))) return { ok: false };
      definitions.push({
        id: exercise.id,
        name: exercise.name,
        namePt: exercise.namePt ?? exercise.name,
        equipment: exercise.equipment,
        primary: exercise.primary ?? "",
        secondary: exercise.secondary ?? "",
        notes: exercise.notes ?? "",
        metricIds: hasIds ? exercise.metricIds : [],
        metricDefinitions: hasDefinitions ? exercise.metricDefinitions : [],
      });
    }
    return { ok: true, value: definitions };
  }

  function validateCanonicalProgramDefinition(definition, customDefinitions, catalog) {
    const compiler = runtimeProgramCompiler();
    if (!compiler || typeof compiler.validateProgramDefinition !== "function" || !catalog) {
      return ERROR_CODES.CATALOG_UNAVAILABLE;
    }
    if (!isPlainObject(definition) || !Number.isInteger(definition.schemaVersion)) {
      return ERROR_CODES.UNSUPPORTED_PROGRAM_DEFINITION_VERSION;
    }
    if (definition.schemaVersion !== 1) return ERROR_CODES.UNSUPPORTED_PROGRAM_DEFINITION_VERSION;
    try {
      return compiler.validateProgramDefinition(definition, catalog, customDefinitions).ok
        ? null : ERROR_CODES.INVALID_ENVELOPE;
    } catch {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
  }

  function validateCanonicalLogRow(row, catalog) {
    const metricFields = ["metricType", "metricIds", "metricDefinitions", "metricValues", "equipmentId", "loadingConvention", "loadingContext", "restSeconds"];
    const hasMetricFields = metricFields.some((field) => hasOwn(row, field));
    const isWorkSet = hasOwn(row, "exerciseId") || hasOwn(row, "set") || hasOwn(row, "setIndex");
    if (!hasMetricFields) return isWorkSet ? ERROR_CODES.UNSUPPORTED_LOG_SCHEMA_VERSION : null;
    const metrics = runtimeExerciseMetrics();
    const workoutDraft = runtimeWorkoutDraft();
    if (!metrics || typeof metrics.validateDefinitions !== "function" || typeof metrics.validateMetricValues !== "function" ||
        typeof metrics.validateRawIds !== "function" || typeof metrics.validateExerciseSourceBinding !== "function" ||
        !workoutDraft || typeof workoutDraft.validateLoadingContext !== "function") {
      return ERROR_CODES.CATALOG_UNAVAILABLE;
    }
    if (row.metricType !== "source_metrics@1" || !Array.isArray(row.metricIds) || row.metricIds.length === 0 ||
        !Array.isArray(row.metricDefinitions) || !Array.isArray(row.metricValues) ||
        !Number.isSafeInteger(row.setIndex) || row.setIndex < 0 ||
        !["external", "assistance", "per_side", "bodyweight"].includes(row.loadingConvention) ||
        !(row.equipmentId === null || typeof row.equipmentId === "string") ||
        (row.restSeconds !== null && row.restSeconds !== undefined && (!Number.isSafeInteger(row.restSeconds) || row.restSeconds < 0))) {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    if (!metrics.validateDefinitions(row.metricIds, row.metricDefinitions).ok ||
        !metrics.validateRawIds(row.metricIds, catalog?.uuidIndex).ok ||
        !metrics.validateMetricValues(row.metricIds, row.metricValues).ok ||
        row.metricValues.some((entry) => !isPlainObject(entry) || typeof entry.value !== "number" || !Number.isFinite(entry.value))) {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    const sourceId = row.sourceLibraryId;
    const sourceExercise = catalog?.exercises?.find((entry) => entry.id === sourceId) || null;
    const sourceBinding = metrics.validateExerciseSourceBinding({
      metricOrigin: row.metricOrigin,
      metricIds: row.metricIds,
      metricDefinitions: row.metricDefinitions,
      sourceId,
      sourceExercise,
      bodyweightCoefficient: row.loadingModel?.bodyweightCoefficient,
    });
    if (!sourceBinding.ok) {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    const loading = workoutDraft.validateLoadingContext(row.loadingContext);
    if (!loading.ok || !hasOwn(row.loadingContext, "bodyweightKg") ||
        !hasOwn(row.loadingContext, "bodyweightContributionEnabled") ||
        !hasOwn(row.loadingContext, "externalLoadMultiplier") ||
        !hasOwn(row.loadingContext, "bodyweightCoefficient")) return ERROR_CODES.INVALID_ENVELOPE;
    if (row.loadingContext.loadingConvention !== row.loadingConvention) {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    const definitions = row.metricDefinitions;
    const semantics = new Set(definitions.map((definition) => definition.semantic));
    const expectedConvention = semantics.has("assistanceKg") ? "assistance"
      : semantics.has("loadPerSideKg") || semantics.has("persistentLoadPerSideKg") ? "per_side"
        : row.metricIds.length === 1 && (semantics.has("reps") || semantics.has("repsPerSide")) ? "bodyweight" : "external";
    if (row.loadingConvention !== expectedConvention ||
        (row.loadingConvention === "bodyweight" && row.loadingContext.externalLoadMultiplier !== 0) ||
        (row.loadingConvention !== "bodyweight" && row.loadingConvention !== "per_side" &&
          row.loadingContext.externalLoadMultiplier !== 1) ||
        row.loadingContext.bodyweightKg !== (row.bodyweight ?? null)) return ERROR_CODES.INVALID_ENVELOPE;
    if (row.loadingModel != null && (!isPlainObject(row.loadingModel) ||
        Object.keys(row.loadingModel).some((key) => !["bodyweightCoefficient", "assistanceDirection"].includes(key)) ||
        (row.loadingModel.bodyweightCoefficient !== null &&
          (typeof row.loadingModel.bodyweightCoefficient !== "number" || !Number.isFinite(row.loadingModel.bodyweightCoefficient) ||
            row.loadingModel.bodyweightCoefficient < 0 || row.loadingModel.bodyweightCoefficient > 1)) ||
        (row.loadingModel.assistanceDirection != null && row.loadingModel.assistanceDirection !== "subtract"))) {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    if (row.loadingContext.bodyweightCoefficient !== (row.loadingModel?.bodyweightCoefficient ?? null)) return ERROR_CODES.INVALID_ENVELOPE;
    if (row.rir !== null && row.rir !== undefined && (typeof row.rir !== "number" || !Number.isFinite(row.rir) || row.rir < 0)) {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    const load = definitions.find((definition) => definition.semantic === "loadKg");
    const reps = definitions.find((definition) => definition.semantic === "reps");
    const loadValue = load ? row.metricValues.find((entry) => entry.metricId === load.id)?.value : null;
    const repsValue = reps ? row.metricValues.find((entry) => entry.metricId === reps.id)?.value : null;
    if (row.load !== loadValue || row.reps !== repsValue) return ERROR_CODES.INVALID_ENVELOPE;
    if (row.equipmentId != null && catalog?.uuidIndex?.[row.equipmentId]?.type !== "equipment") return ERROR_CODES.INVALID_ENVELOPE;
    return null;
  }

  function validateProgrammingContext(value) {
    if (!isPlainObject(value)) return ERROR_CODES.INVALID_ENVELOPE;
    const keys = exactKeys(value, [
      "schemaVersion", "desiredResult", "structuredExperience", "recentConsistency", "availability",
      "environment", "primaryMuscles", "deEmphasizedMuscles", "ignoredMuscles", "priorityMovements",
      "exerciseConstraints", "reviewedAt",
    ]);
    if (keys) return keys === ERROR_CODES.UNKNOWN_SECTION ? keys : ERROR_CODES.INVALID_ENVELOPE;
    if (value.schemaVersion !== 1) return ERROR_CODES.UNSUPPORTED_SCHEMA_VERSION;
    if (!validString(value.desiredResult, true) || !validString(value.structuredExperience, true) ||
      !validString(value.recentConsistency, true) || !isUtcIsoTimestamp(value.reviewedAt)) {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    if (!isPlainObject(value.availability) || exactKeys(value.availability, ["daysPerWeek", "sessionMinutes", "preferredRestSeconds"]) ||
      !Number.isInteger(value.availability.daysPerWeek) || value.availability.daysPerWeek < 2 ||
      !Number.isInteger(value.availability.sessionMinutes) || value.availability.sessionMinutes < 1 ||
      (value.availability.preferredRestSeconds !== null &&
        (!Number.isInteger(value.availability.preferredRestSeconds) || value.availability.preferredRestSeconds < 0))) {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    if (!isPlainObject(value.environment) || Object.keys(value.environment).some(key => !["kind", "capabilities", "equipment"].includes(key)) ||
      !validString(value.environment.kind, true)) return ERROR_CODES.INVALID_ENVELOPE;
    for (const field of ["capabilities", "equipment"]) {
      if (hasOwn(value.environment, field) && (!Array.isArray(value.environment[field]) ||
        value.environment[field].some(item => !validIdentifier(item, true)))) return ERROR_CODES.INVALID_ENVELOPE;
    }
    for (const field of ["primaryMuscles", "deEmphasizedMuscles", "ignoredMuscles", "priorityMovements"]) {
      if (!Array.isArray(value[field]) || value[field].some(item => !validIdentifier(item, true))) return ERROR_CODES.INVALID_ENVELOPE;
    }
    if (!Array.isArray(value.exerciseConstraints) || value.exerciseConstraints.some(item =>
      !isPlainObject(item) || exactKeys(item, ["exerciseId", "reason"]) ||
      !validIdentifier(item.exerciseId, true) || !validString(item.reason, true))) {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    return null;
  }

  function validateDurableState(value) {
    if (!isPlainObject(value) || !requiredObject(value, ["settings", "programMeta", "program", "log", "programHistory", "customExercises"])) {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    if (!isPlainObject(value.settings) || !isPlainObject(value.programMeta)) return ERROR_CODES.INVALID_ENVELOPE;
    if (hasOwn(value, "programmingContext")) {
      const contextError = validateProgrammingContext(value.programmingContext);
      if (contextError) return contextError;
    }
    const collectionChecks = [
      ["log", LIMITS.logRows, ERROR_CODES.LOG_ROW_TOO_LARGE],
      ["program", LIMITS.programRows, ERROR_CODES.PROGRAM_TOO_LARGE],
      ["programHistory", LIMITS.programHistoryEntries, ERROR_CODES.PROGRAM_HISTORY_TOO_LARGE],
      ["customExercises", LIMITS.customExercises, ERROR_CODES.CUSTOM_EXERCISES_TOO_LARGE],
    ];
    for (const [field, limit, code] of collectionChecks) {
      const collection = value[field];
      if (!Array.isArray(collection)) return ERROR_CODES.INVALID_ENVELOPE;
      if (collection.length > limit) return code;
      if (collection.some(row => !isPlainObject(row))) return ERROR_CODES.INVALID_ENVELOPE;
    }
    const definition = value.programMeta.programDefinition;
    if (value.program.length > 0 && definition == null) return ERROR_CODES.UNSUPPORTED_PROGRAM_DEFINITION_VERSION;
    const customDefinitions = canonicalCustomExerciseDefinitions(value.customExercises);
    if (!customDefinitions.ok) return ERROR_CODES.INVALID_ENVELOPE;
    const catalog = runtimeCatalog();
    const compiler = runtimeProgramCompiler();
    if ((value.customExercises.length > 0 || definition != null) && (!catalog || !compiler)) {
      return ERROR_CODES.CATALOG_UNAVAILABLE;
    }
    if (compiler && catalog && typeof compiler.validateCustomExerciseDefinitions === "function" &&
        !compiler.validateCustomExerciseDefinitions(customDefinitions.value, catalog).ok) {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    if (definition != null) {
      const definitionError = validateCanonicalProgramDefinition(definition, customDefinitions.value, catalog);
      if (definitionError) return definitionError;
    }
    for (const row of value.log) {
      let rowJson;
      try {
        rowJson = canonicalJson(row);
      } catch {
        return ERROR_CODES.INVALID_ENVELOPE;
      }
      try {
        if (scalarCount(rowJson) > LIMITS.serializedLogRowChars) return ERROR_CODES.LOG_ROW_TOO_LARGE;
      } catch {
        return ERROR_CODES.INVALID_ENVELOPE;
      }
      const rowError = validateCanonicalLogRow(row, catalog);
      if (rowError) return rowError;
    }
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
    if (!isUtcIsoTimestamp(value.createdAt)) return fail(ERROR_CODES.INVALID_ENVELOPE);
    if (!isPlainObject(value.source) || exactKeys(value.source, SOURCE_KEYS) || value.source.context !== "browser" ||
      !validIdentifier(value.source.logicalInstallationId, true)) return fail(ERROR_CODES.INVALID_ENVELOPE);
    if (!Number.isSafeInteger(value.sourceRevision) || value.sourceRevision < 0) return fail(ERROR_CODES.INVALID_ENVELOPE);
    const durableError = validateDurableState(value.durableState);
    if (durableError) return fail(durableError);
    let sectionError = validateWorkoutDraft(value.workoutDraft);
    if (sectionError) return fail(sectionError);
    sectionError = validateProgramEntryDraft(value.programEntryDraft);
    if (sectionError) return fail(sectionError);
    if (!isPlainObject(value.uiPreferences) ||
      (hasOwn(value.uiPreferences, "theme") && !["system", "light", "dark"].includes(value.uiPreferences.theme))) {
      return fail(ERROR_CODES.INVALID_ENVELOPE);
    }
    if (!isPlainObject(value.analytics) || exactKeys(value.analytics, ANALYTICS_KEYS) ||
      typeof value.analytics.enabled !== "boolean") return fail(ERROR_CODES.INVALID_ENVELOPE);
    if (!isPlainObject(value.telemetryIdentity) || exactKeys(value.telemetryIdentity, TELEMETRY_KEYS) ||
      value.telemetryIdentity.schemaVersion !== 1 || !validIdentifier(value.telemetryIdentity.installationId, true) ||
      typeof value.telemetryIdentity.createdAt !== "string" || !Number.isFinite(Date.parse(value.telemetryIdentity.createdAt))) {
      return fail(ERROR_CODES.INVALID_ENVELOPE);
    }
    if (!isPlainObject(value.integrity) || Object.keys(value.integrity).length !== 1 ||
      !validString(value.integrity.canonicalPayloadHash, true) ||
      !/^[0-9a-f]{64}$/.test(value.integrity.canonicalPayloadHash)) return fail(ERROR_CODES.INVALID_ENVELOPE);

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

  function readDiagnosticData(value) {
    try {
      if (!isPlainObject(value)) return null;
      const output = {};
      for (const key of Object.getOwnPropertyNames(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) return null;
        Object.defineProperty(output, key, {
          value: descriptor.value,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      return output;
    } catch {
      return null;
    }
  }

  function redactDiagnostic(value, channel) {
    const input = readDiagnosticData(value);
    if (!input || !Object.values(DIAGNOSTIC_CHANNELS).includes(channel)) return fail(ERROR_CODES.INVALID_DIAGNOSTIC);
    if (channel === DIAGNOSTIC_CHANNELS.SERVICE) {
      if (input.operation === "create" && input.method === "POST" && input.path === ENDPOINTS.create) {
        return ok({ operation: "create", method: "POST", path: ENDPOINTS.create });
      }
      if (input.operation === "claim") return ok({ operation: "claim" });
      if (input.operation === "commit") return ok({ operation: "commit" });
      if (input.operation === "status") return ok({ operation: "status" });
      return fail(ERROR_CODES.INVALID_DIAGNOSTIC);
    }
    if (channel === DIAGNOSTIC_CHANNELS.STATIC_HOST) {
      return input.method === "GET" && input.path === "/index.html"
        ? ok({ method: "GET", path: "/index.html" })
        : fail(ERROR_CODES.INVALID_DIAGNOSTIC);
    }
    if (channel === DIAGNOSTIC_CHANNELS.RESPONSE) {
      if (!STATUS_STATES.has(input.state)) return fail(ERROR_CODES.INVALID_DIAGNOSTIC);
      if (input.state === "unavailable") {
        if (hasOwn(input, "expiresAt") && !isUtcIsoTimestamp(input.expiresAt)) return fail(ERROR_CODES.INVALID_DIAGNOSTIC);
        return ok({ state: "unavailable" });
      }
      if (!isUtcIsoTimestamp(input.expiresAt)) return fail(ERROR_CODES.INVALID_DIAGNOSTIC);
      return ok({ state: input.state, expiresAt: input.expiresAt });
    }
    if (channel === DIAGNOSTIC_CHANNELS.TELEMETRY) {
      return input.event === "late_install_transfer" && input.source_context === "browser" && input.destination_context === "standalone"
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
