/** Install-transfer wire validation; independent of transport, browser storage and live globals. */
/** @typedef {Record<string,unknown>} JsonRecord
 * @typedef {{exercises:JsonRecord[],uuidIndex:Record<string,JsonRecord>}} CatalogData
 * @typedef {{metricOrigin?:unknown,libraryId?:unknown,metricType?:unknown,metricIds?:unknown[],metrics?:unknown[],loadingModel?:{bodyweightCoefficient?:unknown},loadingContext?:{bodyweightCoefficient?:unknown}}} DraftProgramProjection
 * @typedef {{program:JsonRecord,exerciseOrder:string[],exercises:Record<string,{programmed:DraftProgramProjection,libraryId?:unknown,setOrder:string[],sets:Record<string,{programmed:DraftProgramProjection}>}>}} DraftProjection
 * @typedef {{program:JsonRecord[],customExercises:JsonRecord[],log:JsonRecord[],programHistory:JsonRecord[],programMeta:JsonRecord,settings:JsonRecord}} DurableProjection
 * @typedef {{kind:string,schemaVersion:number,createdAt:string,source:{context:string,logicalInstallationId:string},sourceRevision:number,durableState:JsonRecord,workoutDraft:JsonRecord|null,programEntryDraft:JsonRecord|null,uiPreferences:JsonRecord,analytics:JsonRecord,telemetryIdentity:JsonRecord,integrity:{canonicalPayloadHash:string}}} Envelope
 */
/** @template T
 * @typedef {{ok:true,value:T}|{ok:false,code:string}} Checked */
/** @param {{compiler?:typeof import('../training/generation.js').compiler,entry?:ReturnType<typeof import('../training/authoring.js').createEntryRules>,metrics?:typeof import('../training/metrics.js').default,workout?:ReturnType<typeof import('../training/workout.js').createWorkoutRules>,catalog?:CatalogData,crypto?:Crypto,TextEncoder?:typeof globalThis.TextEncoder,TextDecoder?:typeof globalThis.TextDecoder}} bindings */
export function createTransferContract({compiler, entry, metrics, workout, catalog, crypto, TextEncoder, TextDecoder}) {

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

  /** @template T @param {T} value @returns {Readonly<T>} */
  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const child of Object.values(value)) deepFreeze(child);
    }
    return value;
  }

  /** @template T @param {T} value @returns {{ok:true,value:T}} */
  function ok(value) {
    return { ok: true, value };
  }

  /** @param {string} code @returns {{ok:false,code:string}} */
  function fail(code) {
    return { ok: false, code };
  }

  /** @param {unknown} value @param {PropertyKey} key */
  function hasOwn(value, key) {
    return value !== null && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key);
  }

  /** @template {string|number|null|undefined} T @param {readonly T[]} allowed @param {unknown} value @returns {value is T} */
  function oneOf(allowed,value){return allowed.some(item=>item===value);}
  /** @param {unknown} value @returns {value is number} */
  function safeInteger(value){return typeof value==='number'&&Number.isSafeInteger(value);}
  /** @param {unknown} value @returns {value is number} */
  function integer(value){return typeof value==='number'&&Number.isInteger(value);}

  /** @param {unknown} value @returns {value is JsonRecord} */
  function isPlainObject(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const tag = Object.prototype.toString.call(value);
    if (tag !== "[object Object]") return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype === null) return true;
    return Object.getPrototypeOf(prototype) === null;
  }

  /** @param {string} key */
  function isDangerousKey(key) {
    return DANGEROUS_KEYS.has(key);
  }

  /** @param {string} key @param {Array<string|number>} path */
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

  /** @param {Array<string|number>} path */
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

  /** @param {unknown} value @returns {value is string} */
  function isUtcIsoTimestamp(value) {
    if (typeof value !== "string" || !UTC_ISO_RE.test(value)) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
  }

  /** @param {string} key @param {number} length */
  function isArrayIndexKey(key, length) {
    if (key === "") return false;
    const index = Number(key);
    return integer(index) && index >= 0 && index < length && String(index) === key;
  }

  /** @param {object} value */
  function hasOnlyJsonOwnProperties(value) {
    if (Object.getOwnPropertySymbols(value).length > 0) return false;
    const names = Object.getOwnPropertyNames(value);
    if (Array.isArray(value)) {
      return names.every(name => name === "length" || isArrayIndexKey(name, value.length));
    }
    return names.length === Object.keys(value).length;
  }

  /** @param {unknown[]} value */
  function hasDenseArrayIndices(value) {
    const keys = Object.keys(value);
    return keys.length === value.length && keys.every(key => isArrayIndexKey(key, value.length));
  }

  /** @param {string} value */
  function scalarCount(value) {
    let count = 0;
    for (let index = 0; index < value.length; index += 1) {
      const codeUnit = value.charCodeAt(index);
      if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
        const next = value.charCodeAt(index + 1);
        if (!integer(next) || next < 0xdc00 || next > 0xdfff) throw new TypeError("invalid string");
        index += 1;
      } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
        throw new TypeError("invalid string");
      }
      count += 1;
    }
    return count;
  }

  /** @param {number[]} units */
  function fromCodeUnits(units) {
    let output = "";
    const chunkSize = 8_192;
    for (let index = 0; index < units.length; index += chunkSize) {
      output += String.fromCharCode(...units.slice(index, index + chunkSize));
    }
    return output;
  }

  /** @param {unknown} value */
  function measureChars(value) {
    if (typeof value !== "string") throw new TypeError("character measurement accepts only strings");
    return scalarCount(value);
  }

  function textEncoder() {
    const Constructor = TextEncoder;
    if (typeof Constructor !== "function") throw new TypeError("TextEncoder is unavailable");
    return new Constructor();
  }

  /** @param {unknown} value */
  function byteTag(value) {
    return Object.prototype.toString.call(value);
  }

  /** @param {unknown} value @returns {Uint8Array|ArrayBuffer|null} */
  function asBytes(value) {
    const tag = byteTag(value);
    if (tag === "[object Uint8Array]") {
      try {
        const Constructor = Uint8Array;
        const getter = Constructor && Object.getOwnPropertyDescriptor(Constructor.prototype, "byteLength")?.get;
        if (typeof getter === "function") getter.call(value);
        else if (typeof ArrayBuffer === "function" && !ArrayBuffer.isView(value)) return null;
        return /** @type {Uint8Array} */(value);
      } catch {
        return null;
      }
    }
    if (tag === "[object ArrayBuffer]") {
      try {
        const Constructor = ArrayBuffer;
        const getter = Constructor && Object.getOwnPropertyDescriptor(Constructor.prototype, "byteLength")?.get;
        if (typeof getter !== "function") return null;
        getter.call(value);
        return new Uint8Array(/** @type {ArrayBuffer} */(value));
      } catch {
        return null;
      }
    }
    return null;
  }

  /** @param {unknown} value */
  function measureUtf8Bytes(value) {
    if (typeof value === "string") return textEncoder().encode(value).byteLength;
    const bytes = asBytes(value);
    if (bytes) return bytes.byteLength;
    throw new TypeError("UTF-8 byte measurement accepts only string, Uint8Array, or ArrayBuffer");
  }

  class ContractFailure extends Error {
    /** @param {string} code */
    constructor(code) {
      super();
      this.code = code;
    }
  }

  /** @param {string} code @returns {never} */
  function throwFailure(code) {
    throw new ContractFailure(code);
  }

  function parserTextDecoder() {
    const Constructor = TextDecoder;
    if (typeof Constructor !== "function") throwFailure(ERROR_CODES.INVALID_UTF8);
    return new Constructor("utf-8", { fatal: true });
  }

  class BoundedJsonParser {
    /** @param {string} source */
    constructor(source) {
      this.source = source;
      this.index = 0;
    }

    /** @returns {unknown} */
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

    /** @param {number} depth @returns {unknown} */
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

    /** @param {number} depth */
    checkDepth(depth) {
      if (depth > LIMITS.depth) throwFailure(ERROR_CODES.DEPTH_TOO_LARGE);
    }

    /** @param {number} depth @returns {JsonRecord} */
    parseObject(depth) {
      this.checkDepth(depth);
      this.index += 1;
      /** @type {JsonRecord} */ const output = {};
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

    /** @param {number} depth @returns {unknown[]} */
    parseArray(depth) {
      this.checkDepth(depth);
      this.index += 1;
      /** @type {unknown[]} */ const output = [];
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

    /** @returns {string} */
    parseString() {
      if (this.current() !== '"') throwFailure(ERROR_CODES.INVALID_JSON);
      this.index += 1;
      /** @type {number[]} */ const units = [];
      /** @type {number|null} */ let pendingHigh = null;
      let scalarValues = 0;
      /** @param {number} unit */
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
          /** @type {Record<string,number>} */
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

    /** @param {string} literal @param {unknown} value @returns {unknown} */
    parseLiteral(literal, value) {
      if (this.source.slice(this.index, this.index + literal.length) !== literal) {
        throwFailure(ERROR_CODES.INVALID_JSON);
      }
      this.index += literal.length;
      return value;
    }

    /** @returns {number} */
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

  /** @param {unknown} rawBytes @param {string} [endpoint] @param {string} [mode] */
  function parseBoundedJson(rawBytes, endpoint, mode = "request") {
    if (!Object.values(ENDPOINTS).some(value=>value===endpoint)) return fail(ERROR_CODES.INVALID_ENDPOINT);
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

  /** @param {unknown} value @param {{bounded?:boolean}} [options] @returns {string|null} */
  function inspectJson(value, options = {}) {
    const bounded = options.bounded !== false;
    const active = new Set();
    /** @param {unknown} node @param {number} depth @param {Array<string|number>} path @returns {string|null} */
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
      /** @type {string|null} */ let result = null;
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

  /** @template T @param {T} value @returns {T} */
  function cloneJson(value) {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return /** @type {T} */(value.map(cloneJson));
    /** @type {JsonRecord} */ const output = {};
    const record=/** @type {JsonRecord} */(value);
    for (const key of Object.keys(value)) {
      Object.defineProperty(output, key, {
        value: cloneJson(record[key]),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return /** @type {T} */(output);
  }

  /** @param {unknown} value @returns {string} */
  function canonicalJson(value) {
    const active = new Set();
    /** @param {unknown} node @returns {string} */
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

  /** @param {object} value @param {readonly string[]} expected */
  function exactKeys(value, expected) {
    const expectedSet = new Set(expected);
    const keys = Object.keys(value);
    if (keys.some(key => !expectedSet.has(key))) return ERROR_CODES.UNKNOWN_SECTION;
    if (keys.length !== expected.length || expected.some(key => !hasOwn(value, key))) return ERROR_CODES.INVALID_ENVELOPE;
    return null;
  }

  /** @param {unknown} value @param {boolean} [nonEmpty] @returns {value is string} */
  function validString(value, nonEmpty = false) {
    if (typeof value !== "string" || (nonEmpty && value.length === 0)) return false;
    try {
      return scalarCount(value) <= LIMITS.stringChars;
    } catch {
      return false;
    }
  }

  /** @param {unknown} value @param {boolean} [nonEmpty] @returns {value is string} */
  function validIdentifier(value, nonEmpty = false) {
    if (!validString(value, nonEmpty)) return false;
    try {
      return scalarCount(value) <= LIMITS.identifierChars;
    } catch {
      return false;
    }
  }

  /** @param {unknown} value @param {readonly string[]} fields @returns {value is JsonRecord} */
  function requiredObject(value, fields) {
    return isPlainObject(value) && fields.every(field => hasOwn(value, field));
  }

  /** @param {unknown} value @param {readonly string[]} path */
  function schemaVersionErrorAt(value, path) {
    let node = value;
    for (const key of path) {
      if (!isPlainObject(node) || !hasOwn(node, key)) return null;
      node = node[key];
    }
    return node === 1 ? null : ERROR_CODES.UNSUPPORTED_SCHEMA_VERSION;
  }

  /** @param {unknown} value @param {unknown} setId */
  function validateDraftSet(value, setId) {
    if (!isPlainObject(value) || value.setId !== setId || !validIdentifier(setId, true) ||
      !safeInteger(value.ordinal) || value.ordinal < 1 || !oneOf(["working", "warmup"],value.role) ||
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

  /** @param {unknown} value @param {unknown} exerciseId */
  function validateDraftExercise(value, exerciseId) {
    if (!isPlainObject(value) || value.exerciseInstanceId !== exerciseId || !validIdentifier(value.exerciseInstanceId, true) ||
      !validIdentifier(value.sourceExerciseId, true) || !oneOf([null, undefined],value.libraryId) && !validIdentifier(value.libraryId, true) ||
      !validString(value.displayName, true) || !isPlainObject(value.programmed) ||
      !oneOf([null, undefined],value.substitution) && !isPlainObject(value.substitution) ||
      !oneOf(["active", "skipped"],value.status) || !validString(value.setupNotes) ||
      !Array.isArray(value.setOrder) || !isPlainObject(value.sets)) return false;
    const programmed = value.programmed;
    // A metric composition without repetitions carries no flat rep range, as
    // the draft module allows; every other exercise needs a complete one.
    const repless = programmed.metricOrigin != null && programmed.minReps == null && programmed.maxReps == null;
    for (const field of repless ? ["order", "sets"] : ["order", "sets", "minReps", "maxReps"]) {
      if (!safeInteger(programmed[field]) || /** @type {number} */(programmed[field]) < (field === "order" ? 0 : 1)) return false;
    }
    if (!repless && /** @type {number} */(programmed.minReps) > /** @type {number} */(programmed.maxReps) || !validString(programmed.notes) ||
      !validString(programmed.primary) || !validString(programmed.secondary) ||
      !validIdentifier(programmed.sourceFingerprint, true) || programmed.sets !== value.setOrder.length) return false;
    const ids = value.setOrder;
    const unique = new Set(ids);
    if (unique.size !== ids.length || ids.some(id => !validIdentifier(id, true))) return false;
    const setKeys = Object.keys(value.sets);
    if (setKeys.length !== ids.length || setKeys.some(id => !unique.has(id))) return false;
    const sets=value.sets;
    return ids.every(id => validateDraftSet(sets[id], id));
  }

  /** @param {JsonRecord & {program:JsonRecord}} value */
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

    // The real DraftV2 producer validated the full aggregate above. This local
    // projection names only fields this wire consumer reads; it is no schema.
    const validated=/** @type {DraftProjection} */(candidate);
    for (const exerciseId of validated.exerciseOrder) {
      const exercise = validated.exercises[exerciseId];
      const origin = exercise.programmed.metricOrigin;
      const libraryId = exercise.libraryId ?? exercise.programmed.libraryId ?? null;
      const sourceExercise = catalog.exercises.find((entry) => entry.id === libraryId) || null;
      const modelCoefficient = exercise.programmed.loadingModel?.bodyweightCoefficient ?? null;
      const contextCoefficient = exercise.programmed.loadingContext?.bodyweightCoefficient ?? null;
      if (modelCoefficient !== contextCoefficient) return ERROR_CODES.INVALID_ENVELOPE;
      /** @type {string[]} */ const setCompositions = [];
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

  /** @param {unknown} value */
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
      !oneOf(["kg", "lb"],value.program.unit) || !oneOf(["numeric", "effort"],value.program.rirMode)) {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    if (!validString(value.session.startedAt, true) || !validString(value.session.updatedAt, true) ||
      (value.session.bodyweight !== null && !validString(value.session.bodyweight)) || !validString(value.session.notes) ||
      (value.session.selectedExerciseId !== null && !validIdentifier(value.session.selectedExerciseId, true)) ||
      !oneOf(["active", "finishing"],value.session.status) || !requiredObject(value.session.contextTouched, ["day", "date", "sessionNotes", "bodyweight"])) {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    if (Object.keys(value.session.contextTouched).some(key => !oneOf(["day", "date", "sessionNotes", "bodyweight"],key)) ||
      Object.values(value.session.contextTouched).some(item => typeof item !== "boolean")) return ERROR_CODES.INVALID_ENVELOPE;
    const ids = value.exerciseOrder;
    const unique = new Set(ids);
    if (unique.size !== ids.length || ids.some(id => !validIdentifier(id, true))) return ERROR_CODES.INVALID_ENVELOPE;
    const exerciseKeys = Object.keys(value.exercises);
    if (exerciseKeys.length !== ids.length || exerciseKeys.some(id => !unique.has(id))) return ERROR_CODES.INVALID_ENVELOPE;
    if (value.session.selectedExerciseId !== null && !unique.has(value.session.selectedExerciseId)) return ERROR_CODES.INVALID_ENVELOPE;
    const exercises = value.exercises;
    if (!ids.every(id => validateDraftExercise(exercises[id], id))) return ERROR_CODES.INVALID_ENVELOPE;
    return validateCanonicalWorkoutDraft(/** @type {JsonRecord & {program:JsonRecord}} */(value));
  }

  /** @param {unknown} value */
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
    // Schema v1 (set-level metrics present, equal to the slot's) and v2
    // (absent, derived from the slot) both clone through a real transfer.
    const candidateResult = /** @type {{preview?:{programDefinition?:unknown},alternative?:{preview?:{programDefinition?:unknown}}}|undefined} */(value.result);
    for (const preview of [candidateResult?.preview, candidateResult?.alternative?.preview]) {
      const version = isPlainObject(preview?.programDefinition) ? preview.programDefinition.schemaVersion : 1;
      if (version !== 1 && version !== 2) return ERROR_CODES.UNSUPPORTED_PROGRAM_DEFINITION_VERSION;
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

    const result = /** @type {{preview?:unknown,alternative?:{preview?:unknown}}|undefined} */(logicalState.result);
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

  function runtimeProgramCompiler() { return compiler; }
  function runtimeProgramEntry() { return entry; }
  function runtimeExerciseMetrics() { return metrics; }
  function runtimeWorkoutDraft() { return workout; }
  function runtimeCatalog() { return catalog; }

  /** @param {unknown} customExercises @returns {{ok:false}|{ok:true,value:JsonRecord[]}} */
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

  /** @param {unknown} definition @param {unknown[]} customDefinitions @param {CatalogData|undefined} catalog */
  function validateCanonicalProgramDefinition(definition, customDefinitions, catalog) {
    const compiler = runtimeProgramCompiler();
    if (!compiler || typeof compiler.validateProgramDefinition !== "function" || !catalog) {
      return ERROR_CODES.CATALOG_UNAVAILABLE;
    }
    if (!isPlainObject(definition) || !integer(definition.schemaVersion)) {
      return ERROR_CODES.UNSUPPORTED_PROGRAM_DEFINITION_VERSION;
    }
    // Schema v1 (set-level metrics present, equal to the slot's) and v2
    // (absent, derived from the slot) both clone through a real transfer;
    // compiler.validateProgramDefinition below accepts either shape.
    if (definition.schemaVersion !== 1 && definition.schemaVersion !== 2) return ERROR_CODES.UNSUPPORTED_PROGRAM_DEFINITION_VERSION;
    try {
      return compiler.validateProgramDefinition(definition, catalog, customDefinitions).ok
        ? null : ERROR_CODES.INVALID_ENVELOPE;
    } catch {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
  }

  /** @param {JsonRecord} row @param {CatalogData|undefined} catalog */
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
        !safeInteger(row.setIndex) || row.setIndex < 0 ||
        !oneOf(["external", "assistance", "per_side", "bodyweight"],row.loadingConvention) ||
        !(row.equipmentId === null || typeof row.equipmentId === "string") ||
        (row.restSeconds !== null && row.restSeconds !== undefined && (!safeInteger(row.restSeconds) || row.restSeconds < 0))) {
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
      bodyweightCoefficient: /** @type {{bodyweightCoefficient?:unknown}|null|undefined} */(row.loadingModel)?.bodyweightCoefficient,
    });
    if (!sourceBinding.ok) {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    const loading = workoutDraft.validateLoadingContext(row.loadingContext);
    if (!loading.ok || !hasOwn(row.loadingContext, "bodyweightKg") ||
        !hasOwn(row.loadingContext, "bodyweightContributionEnabled") ||
        !hasOwn(row.loadingContext, "externalLoadMultiplier") ||
        !hasOwn(row.loadingContext, "bodyweightCoefficient")) return ERROR_CODES.INVALID_ENVELOPE;
    const loadingContext = /** @type {JsonRecord} */(row.loadingContext);
    if (loadingContext.loadingConvention !== row.loadingConvention) {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    const definitions = row.metricDefinitions;
    const semantics = new Set(definitions.map((definition) => definition.semantic));
    const expectedConvention = semantics.has("assistanceKg") ? "assistance"
      : semantics.has("loadPerSideKg") || semantics.has("persistentLoadPerSideKg") ? "per_side"
        : row.metricIds.length === 1 && (semantics.has("reps") || semantics.has("repsPerSide")) ? "bodyweight" : "external";
    if (row.loadingConvention !== expectedConvention ||
        (row.loadingConvention === "bodyweight" && loadingContext.externalLoadMultiplier !== 0) ||
        (row.loadingConvention !== "bodyweight" && row.loadingConvention !== "per_side" &&
          loadingContext.externalLoadMultiplier !== 1) ||
        loadingContext.bodyweightKg !== (row.bodyweight ?? null)) return ERROR_CODES.INVALID_ENVELOPE;
    if (row.loadingModel != null && (!isPlainObject(row.loadingModel) ||
        Object.keys(row.loadingModel).some((key) => !oneOf(["bodyweightCoefficient", "assistanceDirection"],key)) ||
        (row.loadingModel.bodyweightCoefficient !== null &&
          (typeof row.loadingModel.bodyweightCoefficient !== "number" || !Number.isFinite(row.loadingModel.bodyweightCoefficient) ||
            row.loadingModel.bodyweightCoefficient < 0 || row.loadingModel.bodyweightCoefficient > 1)) ||
        (row.loadingModel.assistanceDirection != null && row.loadingModel.assistanceDirection !== "subtract"))) {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    if (loadingContext.bodyweightCoefficient !== (row.loadingModel?.bodyweightCoefficient ?? null)) return ERROR_CODES.INVALID_ENVELOPE;
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

  /** @param {unknown} value */
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
      !integer(value.availability.daysPerWeek) || value.availability.daysPerWeek < 2 ||
      !integer(value.availability.sessionMinutes) || value.availability.sessionMinutes < 1 ||
      (value.availability.preferredRestSeconds !== null &&
        (!integer(value.availability.preferredRestSeconds) || value.availability.preferredRestSeconds < 0))) {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    if (!isPlainObject(value.environment) || Object.keys(value.environment).some(key => !oneOf(["kind", "capabilities", "equipment"],key)) ||
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

  /** @param {unknown} value */
  function validateDurableState(value) {
    if (!isPlainObject(value) || !requiredObject(value, ["settings", "programMeta", "program", "log", "programHistory", "customExercises"])) {
      return ERROR_CODES.INVALID_ENVELOPE;
    }
    if (!isPlainObject(value.settings) || !isPlainObject(value.programMeta)) return ERROR_CODES.INVALID_ENVELOPE;
    if (hasOwn(value, "programmingContext")) {
      const contextError = validateProgrammingContext(value.programmingContext);
      if (contextError) return contextError;
    }
    /** @type {Array<[string,number,string]>} */
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
    const durable=/** @type {DurableProjection} */(value);
    const definition = durable.programMeta.programDefinition;
    if (durable.program.length > 0 && definition == null) return ERROR_CODES.UNSUPPORTED_PROGRAM_DEFINITION_VERSION;
    const customDefinitions = canonicalCustomExerciseDefinitions(durable.customExercises);
    if (!customDefinitions.ok) return ERROR_CODES.INVALID_ENVELOPE;
    const catalog = runtimeCatalog();
    const compiler = runtimeProgramCompiler();
    if ((durable.customExercises.length > 0 || definition != null) && (!catalog || !compiler)) {
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
    for (const row of durable.log) {
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

  /** @param {unknown} value @returns {Checked<Envelope>} */
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
    if (typeof value.schemaVersion !== "number" || !integer(value.schemaVersion)) {
      return fail(ERROR_CODES.INVALID_SCHEMA_VERSION);
    }
    if (value.schemaVersion !== 1) return fail(ERROR_CODES.UNSUPPORTED_SCHEMA_VERSION);
    if (!isUtcIsoTimestamp(value.createdAt)) return fail(ERROR_CODES.INVALID_ENVELOPE);
    if (!isPlainObject(value.source) || exactKeys(value.source, SOURCE_KEYS) || value.source.context !== "browser" ||
      !validIdentifier(value.source.logicalInstallationId, true)) return fail(ERROR_CODES.INVALID_ENVELOPE);
    if (!safeInteger(value.sourceRevision) || value.sourceRevision < 0) return fail(ERROR_CODES.INVALID_ENVELOPE);
    const durableError = validateDurableState(value.durableState);
    if (durableError) return fail(durableError);
    /** @type {string|null} */
    let sectionError = validateWorkoutDraft(value.workoutDraft);
    if (sectionError) return fail(sectionError);
    sectionError = validateProgramEntryDraft(value.programEntryDraft);
    if (sectionError) return fail(sectionError);
    if (!isPlainObject(value.uiPreferences) ||
      (hasOwn(value.uiPreferences, "theme") && !oneOf(["system", "light", "dark"],value.uiPreferences.theme))) {
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

    return ok(/** @type {Envelope} */(cloneJson(value)));
  }

  /** @param {unknown} value */
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

  /** @param {unknown} value @param {string} endpoint */
  function validateRequest(value, endpoint) {
    if (!Object.values(ENDPOINTS).some(value=>value===endpoint) || endpoint === ENDPOINTS.envelope) return fail(ERROR_CODES.INVALID_ENDPOINT);
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

  /** @param {unknown} value @returns {JsonRecord|null} */
  function readDiagnosticData(value) {
    try {
      if (!isPlainObject(value)) return null;
      /** @type {JsonRecord} */ const output = {};
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

  /** @param {unknown} value @param {string} channel */
  function redactDiagnostic(value, channel) {
    const input = readDiagnosticData(value);
    if (!input || !oneOf(Object.values(DIAGNOSTIC_CHANNELS),channel)) return fail(ERROR_CODES.INVALID_DIAGNOSTIC);
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
      if (typeof input.state !== "string" || !STATUS_STATES.has(input.state)) return fail(ERROR_CODES.INVALID_DIAGNOSTIC);
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

  /** @param {ArrayBuffer} bytes */
  function bytesToHex(bytes) {
    let output = "";
    for (const byte of new Uint8Array(bytes)) output += byte.toString(16).padStart(2, "0");
    return output;
  }

  /** @param {unknown} value @param {Crypto} [cryptoImplementation] */
  async function validateEnvelopeIntegrity(value, cryptoImplementation) {
    const structural = validateEnvelope(value);
    if (!structural.ok) return structural;
    const cryptoApi = cryptoImplementation === undefined ? crypto : cryptoImplementation;
    if (!cryptoApi || !cryptoApi.subtle || typeof cryptoApi.subtle.digest !== "function") return fail(ERROR_CODES.CRYPTO_UNAVAILABLE);
    const preimage = cloneJson(structural.value);
    delete (/** @type {{canonicalPayloadHash?:string}} */(preimage.integrity)).canonicalPayloadHash;
    let encoded;
    try {
      encoded = textEncoder().encode(canonicalJson(preimage));
      const digest = await cryptoApi.subtle.digest("SHA-256", encoded);
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

  return api;
}
