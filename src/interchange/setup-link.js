/** v4 setup-link codec. Training rules and browser codecs are supplied at composition. */
/** @typedef {Record<string,unknown>} JsonRecord
 * @typedef {{ok:false,code:string}|{ok:true,value:unknown}} Expanded
 * @typedef {{ids:string[],indexById:Map<string,number>,fingerprint:string}} IdentityContext
 * @typedef {{href?:string,hash?:string}} LocationLike
 * @typedef {{document?:{cookie:string}|null,location?:LocationLike|string|null}} CookieAdapters
 * @typedef {{TextEncoder:typeof globalThis.TextEncoder,TextDecoder:typeof globalThis.TextDecoder,CompressionStream?:typeof globalThis.CompressionStream,DecompressionStream?:typeof globalThis.DecompressionStream,Blob?:typeof globalThis.Blob,atob:typeof globalThis.atob,btoa:typeof globalThis.btoa,document?:{cookie:string},location?:LocationLike}} Capabilities
 * @typedef {{builtInIds?:unknown,catalogSnapshot?:unknown,validateProgramDefinition?:(definition:unknown,catalog:unknown,customs:unknown[])=>{ok:boolean,issues?:unknown[],code?:string},generateProgram?:(request:JsonRecord,catalog:unknown)=>{ok:false}|{ok:true,value:Definition},generateProgramAsync?:(request:JsonRecord,catalog:unknown,options:{signal?:AbortSignal})=>Promise<{ok:false}|{ok:true,value:Definition}>,generatorVersion?:string,signal?:AbortSignal}} Options
 * @typedef {JsonRecord & {generatorVersion?:string,provenance?:{source?:unknown},request?:JsonRecord,days?:{slots?:{exerciseId?:unknown,sourceExerciseIds?:unknown,metricIds?:unknown,metricDefinitions?:unknown,prescriptionsByCycle?:{sets?:{metricIds?:unknown,metricDefinitions?:unknown}[]}[]}[]}[]}} Definition
 * @typedef {{kind:string,version:number,program:{name:string,definition:Definition,customExercises?:unknown[]},settings:{jumpPct:number,minJump:number,rirHigh:number,hardRir:number,restSec:number,unit:string,rirMode:string,lang:string},language:string}} Payload
 */
/** @param {{metrics:typeof import('../training/metrics.js').default,identity:typeof import('../training/identity.js').default,capabilities:Capabilities}} bindings */
export function createSetupLinkCodec({metrics, identity, capabilities}) {
  const {TextEncoder,TextDecoder,CompressionStream,DecompressionStream,Blob,atob,btoa} = capabilities;

  const KIND = "taurifer-shared-setup";
  const VERSION = 2;
  const ENCODING_VERSION = 4;
  const MAX_ENCODED_CHARS = 3072;
  const MAX_COMPRESSED_BYTES = 2301;
  const MAX_DECOMPRESSED_BYTES = 524288;
  const COOKIE_NAME = "repforge_setup_v1";
  const COOKIE_MAX_AGE = 604800;
  const CUSTOM_ID_PREFIX = "custom:";
  const MAX_STRUCTURE_DEPTH = 100;
  const MAX_STRUCTURE_NODES = 50000;
  const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
  const FORBIDDEN_STATE_KEYS = new Set([
    "actual", "actuals", "performed", "performedAt", "performedSet", "performedSets",
    "completed", "completedAt", "completedSet", "completedSets", "history", "logs",
    "workoutLog", "programHistory", "draft",
  ]);
  const TOP_LEVEL_KEYS = new Set(["kind", "version", "program", "settings", "language"]);
  const PROGRAM_KEYS = new Set(["name", "definition", "customExercises"]);
  const SETTING_KEYS = Object.freeze([
    "jumpPct", "minJump", "rirHigh", "hardRir", "restSec", "unit", "lang", "rirMode",
  ]);
  const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
  const VERSION_PREFIX_RE = /^v([0-9]+)\./;
  const LANGUAGES = Object.freeze(["en", "pt"]);
  const UNITS = Object.freeze(["kg", "lb"]);
  const RIR_MODES = Object.freeze(["numeric", "effort"]);
  const COMPACT_KEYS = Object.freeze([
    "schemaVersion", "generatorVersion", "seed", "request", "days", "cycles", "deloadCycles", "provenance",
    "goal", "experience", "daysPerWeek", "timeCeilingMinutes", "gymProfile", "competencyAnswers",
    "movementConfirmations", "emphasisMuscleIds", "deprioritizedMuscleIds", "excludedExerciseIds",
    "excludedMuscleIds", "preferredExerciseIds", "split", "periodization", "executionContexts",
    "equipmentIds", "equipmentLoadsKg", "source", "policyVersion", "selection", "approximations",
    "estimatedSessionSeconds", "focusNotApplied", "muscleId", "reason", "id", "name", "kind", "order",
    "slots", "purposeId", "exerciseId", "role", "sourceExerciseIds", "musclePurposeIds",
    "movementPatternIds", "exerciseTypeId", "metricIds", "metricDefinitions", "metricOrigin",
    "loadingModel", "prescriptionsByCycle", "displayName", "setupNotes", "manualAttribution",
    "lateralityIds", "executionMode", "sourceName", "semantic", "unit", "bodyweightCoefficient",
    "assistanceDirection", "cycleIndex", "sets", "setIndex", "metricType", "targets", "rir",
    "restSeconds", "status", "deload", "approximation", "primary", "secondary", "namePt",
    "aliases", "equipment", "bodyweight", "resistance", "support", "reps", "loadKg",
    "assistanceKg", "durationSeconds", "distanceShortMeters", "distanceLongMeters", "loadPerSideKg",
    "repsPerSide", "durationPerSideSeconds", "persistentLoadPerSideKg", "distanceShortPerSideMeters",
  ]);
  const COMPACT_CODES = Object.freeze(Array.from({ length: 94 }, (_, index) => String.fromCharCode(index + 33))
    .filter((character) => character !== "\"" && character !== "\\" && character !== "~"));
  if (COMPACT_KEYS.length > COMPACT_CODES.length) throw new Error("shared setup compact key table is full");
  const COMPACT_KEY_BY_NAME = new Map(COMPACT_KEYS.map((key, index) => [key, COMPACT_CODES[index]]));
  const COMPACT_NAME_BY_KEY = new Map(COMPACT_KEYS.map((key, index) => [COMPACT_CODES[index], key]));
  const COMPACT_VALUES = Object.freeze([
    "manual_build", "manual@1", "manual", "source_catalog", "source_metrics@1", "ready", "training", "rest",
    "user_defined", "configuration_required", "bilateral", "unilateral", "hypertrophy", "strength", "hybrid",
    "beginner", "intermediate", "advanced", "numeric", "effort", "kg", "lb", "auto", "static", "linear",
    "undulating", "daily_undulating", "weekly_undulating", "double_progression", "rep_range", "range",
    "successive_overload", "fatigue_management", "volume_landmarks", "manual_configuration_required",
    "source_catalog@1", "program_compiler@1", "Reps", "reps",
  ]);
  const COMPACT_VALUE_CODES = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const COMPACT_VALUE_BY_NAME = new Map(COMPACT_VALUES.map((value, index) => [value, COMPACT_VALUE_CODES[index]]));
  const COMPACT_NAME_BY_VALUE = new Map(COMPACT_VALUES.map((value, index) => [COMPACT_VALUE_CODES[index], value]));

  /** @param {unknown} value @returns {value is JsonRecord} */
  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  /** @param {unknown} value @returns {value is number} */
  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  /** @param {unknown} value @returns {value is number} */
  function integer(value) { return typeof value === "number" && Number.isInteger(value); }

  /** @param {unknown} object @param {PropertyKey} key */
  function own(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  /** @param {string[]} issues @param {string} [code] @returns {{ok:false,code:string,issues:string[],blockers:never[]}} */
  function schemaFail(issues, code = "invalid-schema") {
    return { ok: false, code, issues: [...issues], blockers: [] };
  }

  /** @template T @param {T} value @returns {T} */
  function cloneCanonical(value) {
    let nodes = 0;
    const ancestors = new Set();

    /** @param {unknown} current @param {string} path @param {number} depth @returns {unknown} */

    function visit(current, path, depth) {
      nodes += 1;
      if (nodes > MAX_STRUCTURE_NODES) throw new TypeError(path + ": too many values");
      if (depth > MAX_STRUCTURE_DEPTH) throw new TypeError(path + ": too deeply nested");
      if (current === null || typeof current === "string" || typeof current === "boolean") return current;
      if (typeof current === "number") {
        if (!Number.isFinite(current)) throw new TypeError(path + ": non-finite number");
        return current;
      }
      if (typeof current !== "object") throw new TypeError(path + ": non-JSON value");
      if (ancestors.has(current)) throw new TypeError(path + ": circular value");
      ancestors.add(current);
      let result;
      if (Array.isArray(current)) {
        for (let index = 0; index < current.length; index += 1) {
          if (!own(current, index)) throw new TypeError(path + ": sparse array");
        }
        result = current.map((entry, index) => visit(entry, path + "[" + index + "]", depth + 1));
      } else {
        if (!isPlainObject(current)) throw new TypeError(path + ": expected a plain object");
        const ownKeys = Reflect.ownKeys(current);
        if (ownKeys.some((key) => typeof key === "symbol")) throw new TypeError(path + ": symbol key");
        result = {};
        for (const key of /** @type {string[]} */(ownKeys).sort()) {
          if (FORBIDDEN_KEYS.has(key)) throw new TypeError(path + "." + key + ": unsafe key");
          const descriptor = Object.getOwnPropertyDescriptor(current, key);
          if (!descriptor || !descriptor.enumerable || !own(descriptor, "value")) {
            throw new TypeError(path + "." + key + ": expected enumerable data");
          }
          Object.defineProperty(result, key, {
            value: visit(descriptor.value, path + "." + key, depth + 1),
            enumerable: true,
            configurable: true,
            writable: true,
          });
        }
      }
      ancestors.delete(current);
      return result;
    }

    return /** @type {T} */(visit(value, "$", 0));
  }

  /** @param {string} value */
  function compactString(value) {
    const code = COMPACT_VALUE_BY_NAME.get(value);
    if (code !== undefined) return "!" + code;
    return value.startsWith("!") ? "!!" + value.slice(1) : value;
  }

  /** @param {string} value @returns {Expanded} */
  function expandString(value) {
    if (!value.startsWith("!")) return { ok: true, value };
    if (value.startsWith("!!")) return { ok: true, value: "!" + value.slice(2) };
    const expanded = COMPACT_NAME_BY_VALUE.get(value.slice(1));
    return expanded === undefined ? { ok: false, code: "invalid-envelope" } : { ok: true, value: expanded };
  }

  /** @param {unknown} value @param {IdentityContext|null} [identityContext] @returns {unknown} */
  function compactTree(value, identityContext = null) {
    if (typeof value === "string") {
      const index = identityContext?.indexById.get(value);
      return index === undefined ? compactString(value) : ["u", index];
    }
    if (Array.isArray(value)) return ["a", ...value.map((item) => compactTree(item, identityContext))];
    if (!isPlainObject(value)) return value;
    const entries = [];
    for (const [key, child] of Object.entries(value)) {
      const knownToken = COMPACT_KEY_BY_NAME.get(key);
      const identity = identityContext?.indexById.get(key);
      const token = knownToken || (identity !== undefined
        ? "^" + identity
        : "~" + toBase64Url(new TextEncoder().encode(key)));
      entries.push(token, compactTree(child, identityContext));
    }
    return ["o", ...entries];
  }

  /** @param {unknown} value @param {string[]|null} [sourceIdentities] @returns {Expanded} */
  function expandTree(value, sourceIdentities = null) {
    if (value === null || typeof value === "boolean") return { ok: true, value };
    if (typeof value === "number") {
      return Number.isFinite(value)
        ? { ok: true, value }
        : { ok: false, code: "invalid-envelope" };
    }
    if (typeof value === "string") return expandString(value);
    if (!Array.isArray(value) || typeof value[0] !== "string") return { ok: false, code: "invalid-envelope" };
    if (value[0] === "u") {
      if (value.length !== 2 || !Number.isSafeInteger(value[1]) || value[1] < 0
        || !Array.isArray(sourceIdentities) || value[1] >= sourceIdentities.length) {
        return { ok: false, code: "invalid-envelope" };
      }
      return { ok: true, value: sourceIdentities[value[1]] };
    }
    if (value[0] === "a") {
      const expanded = [];
      for (const child of value.slice(1)) {
        const result = expandTree(child, sourceIdentities);
        if (!result.ok) return result;
        expanded.push(result.value);
      }
      return { ok: true, value: expanded };
    }
    if (value[0] !== "o" || value.length % 2 !== 1) return { ok: false, code: "invalid-envelope" };
    const expanded = {};
    for (let index = 1; index < value.length; index += 2) {
      const token = value[index];
      if (typeof token !== "string") return { ok: false, code: "invalid-envelope" };
      let key = COMPACT_NAME_BY_KEY.get(token);
      if (key === undefined && /^\^(0|[1-9][0-9]*)$/.test(token)) {
        const identityIndex = Number(token.slice(1));
        if (!Number.isSafeInteger(identityIndex) || !Array.isArray(sourceIdentities)
          || identityIndex >= sourceIdentities.length) return { ok: false, code: "invalid-envelope" };
        key = sourceIdentities[identityIndex];
      }
      if (key === undefined && token.startsWith("~")) {
        if (token.length === 1) key = "";
        else {
          const bytes = fromBase64Url(token.slice(1));
          if (!bytes) return { ok: false, code: "invalid-envelope" };
          try { key = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
          catch { return { ok: false, code: "invalid-envelope" }; }
        }
      }
      if (key === undefined || own(expanded, key)) return { ok: false, code: "invalid-envelope" };
      const result = expandTree(value[index + 1], sourceIdentities);
      if (!result.ok) return result;
      Object.defineProperty(expanded, key, {
        value: result.value, enumerable: true, configurable: true, writable: true,
      });
    }
    return { ok: true, value: expanded };
  }

  /** @param {unknown[]} metricIds */
  function metricDefinitionsForIds(metricIds) {
    const domain = metrics;
    const definitions = domain?.definitionsForIds?.(metricIds);
    return definitions?.ok === true ? cloneCanonical(definitions.value) : null;
  }

  /** @param {unknown} value @returns {string|undefined} */
  function stableStringify(value) {
    if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
    if (isPlainObject(value)) {
      return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stableStringify(value[key])).join(",") + "}";
    }
    return JSON.stringify(value);
  }

  /** @param {unknown} snapshot @returns {Promise<IdentityContext|null>} */
  async function sourceIdentityContext(snapshot) {
    if (!isPlainObject(snapshot) || !Array.isArray(snapshot.exercises) || !isPlainObject(snapshot.uuidIndex)) return null;
    const ids = Object.keys(snapshot.uuidIndex).filter((id) => /^[a-f0-9]{32}$/i.test(id)).sort();
    if (!ids.length) return null;
    let fingerprint;
    try {
      const catalogIdentity = identity;
      if (!catalogIdentity) return null;
      fingerprint = catalogIdentity.catalogIdentity(snapshot);
    } catch {
      return null;
    }
    return {
      ids,
      indexById: new Map(ids.map((id, index) => [id, index])),
      fingerprint,
    };
  }

  // An unedited generated program is reproduced exactly by its generator from
  // the canonical request, so the link carries only that request. The receiver
  // must run the same generator version and arrive at the identical definition.
  /** @param {Definition} definition @param {IdentityContext} identityContext @param {Options} options */
  function regenerableForm(definition, identityContext, options) {
    if (typeof options?.generateProgram !== "function" || definition?.provenance?.source === "manual"
      || !isPlainObject(definition?.request) || typeof definition.request.goal !== "string") return null;
    const request = cloneCanonical(definition.request);
    delete request.seed;
    let regenerated;
    try { regenerated = options.generateProgram(request, options.catalogSnapshot); }
    catch { return null; }
    if (!regenerated?.ok || stableStringify(regenerated.value) !== stableStringify(definition)) return null;
    return ["g", identityContext.fingerprint, definition.generatorVersion, compactTree(request, identityContext)];
  }

  /** @param {unknown[]} compact @param {IdentityContext|null} identityContext @param {Options} options @returns {Promise<Expanded>} */
  async function regenerate(compact, identityContext, options) {
    if (typeof compact[2] === "string" && compact[2] !== options?.generatorVersion) return { ok: false, code: "unsupported-version" };
    if (compact.length !== 4 || typeof compact[1] !== "string" || typeof compact[2] !== "string") return { ok: false, code: "invalid-envelope" };
    if (!identityContext) return { ok: false, code: "catalog-unavailable" };
    if (compact[1] !== identityContext.fingerprint) return { ok: false, code: "catalog-mismatch" };
    if (typeof options?.generateProgram !== "function" || compact[2] !== options.generatorVersion) {
      return { ok: false, code: "unsupported-version" };
    }
    const request = expandTree(compact[3], identityContext.ids);
    if (!request.ok || !isPlainObject(request.value)) return { ok: false, code: "invalid-envelope" };
    let generated;
    try {
      generated = typeof options.generateProgramAsync === "function"
        ? await options.generateProgramAsync(request.value, options.catalogSnapshot, { signal: options.signal })
        : options.generateProgram(request.value, options.catalogSnapshot);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      return { ok: false, code: "invalid-envelope" };
    }
    if (!generated?.ok || generated.value.generatorVersion !== compact[2]) return { ok: false, code: "invalid-envelope" };
    return { ok: true, value: generated.value };
  }

  /** @param {Definition} definition @param {IdentityContext} identityContext @param {Options} options */
  function compactProgramDefinition(definition, identityContext, options) {
    const regenerable = regenerableForm(definition, identityContext, options);
    if (regenerable) return regenerable;
    const compact = cloneCanonical(definition);
    for (const day of compact.days || []) {
      for (const slot of day?.slots || []) {
        if (Array.isArray(slot.sourceExerciseIds) && slot.sourceExerciseIds.length === 1
          && slot.sourceExerciseIds[0] === slot.exerciseId) {
          slot.sourceExerciseIds = null;
        }
        const canonicalMetrics = Array.isArray(slot.metricIds)
          ? metricDefinitionsForIds(slot.metricIds)
          : null;
        const canonicalSlotMetrics = canonicalMetrics
          && JSON.stringify(canonicalMetrics) === JSON.stringify(slot.metricDefinitions);
        if (canonicalSlotMetrics) slot.metricDefinitions = null;
        for (const cycle of slot.prescriptionsByCycle || []) {
          for (const set of cycle?.sets || []) {
            if (JSON.stringify(set.metricIds) === JSON.stringify(slot.metricIds)
              && (canonicalSlotMetrics
                ? JSON.stringify(set.metricDefinitions) === JSON.stringify(canonicalMetrics)
                : JSON.stringify(set.metricDefinitions) === JSON.stringify(slot.metricDefinitions))) {
              set.metricIds = null;
              set.metricDefinitions = null;
            }
          }
        }
      }
    }
    return ["c", identityContext.fingerprint, compactTree(compact, identityContext)];
  }

  /** @param {unknown} compact @param {IdentityContext|null} identityContext @param {Options} options @returns {Expanded|Promise<Expanded>} */
  function expandProgramDefinition(compact, identityContext, options) {
    if (Array.isArray(compact) && compact[0] === "g") return regenerate(compact, identityContext, options);
    let tree = compact;
    let sourceIdentities = null;
    if (Array.isArray(compact) && compact[0] === "c") {
      if (compact.length !== 3 || typeof compact[1] !== "string" || !/^[a-f0-9]{64}$/.test(compact[1])) {
        return { ok: false, code: "invalid-envelope" };
      }
      if (!identityContext) return { ok: false, code: "catalog-unavailable" };
      if (compact[1] !== identityContext.fingerprint) return { ok: false, code: "catalog-mismatch" };
      sourceIdentities = identityContext.ids;
      tree = compact[2];
    }
    const expanded = expandTree(tree, sourceIdentities);
    if (!expanded.ok || !isPlainObject(expanded.value)) return expanded;
    const definition = expanded.value;
    // Received bytes are untrusted until validated: walk only arrays, so a
    // malformed value reaches validation and is refused rather than thrown (#356).
    const list = (/** @type {unknown} */ value) => (Array.isArray(value) ? value : []);
    for (const day of list(definition.days)) {
      for (const slot of list(day?.slots)) {
        if (!isPlainObject(slot)) continue;
        if (slot.sourceExerciseIds === null && typeof slot.exerciseId === "string") {
          slot.sourceExerciseIds = [slot.exerciseId];
        }
        if (slot.metricDefinitions === null && Array.isArray(slot.metricIds)) {
          const definitions = metricDefinitionsForIds(slot.metricIds);
          if (!definitions) return { ok: false, code: "invalid-envelope" };
          slot.metricDefinitions = definitions;
        }
        for (const cycle of list(slot.prescriptionsByCycle)) {
          for (const set of list(cycle?.sets)) {
            if (!isPlainObject(set)) continue;
            if (set.metricIds === null && set.metricDefinitions === null
              && Array.isArray(slot.metricIds) && Array.isArray(slot.metricDefinitions)) {
              set.metricIds = cloneCanonical(slot.metricIds);
              set.metricDefinitions = cloneCanonical(slot.metricDefinitions);
            }
          }
        }
      }
    }
    return { ok: true, value: definition };
  }

  /** @param {unknown} value @param {string[]} issues @param {string} [path] @param {Set<object>} [seen] @param {number} [depth] */
  function scanStateFields(value, issues, path = "$", seen = new Set(), depth = 0) {
    if (value === null || typeof value !== "object") return;
    if (depth > MAX_STRUCTURE_DEPTH || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((entry, index) => scanStateFields(entry, issues, path + "[" + index + "]", seen, depth + 1));
      return;
    }
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_STATE_KEYS.has(key)) issues.push(path + "." + key + ": performed or durable state is not shareable");
      scanStateFields((/** @type {JsonRecord} */(value))[key], issues, path + "." + key, seen, depth + 1);
    }
  }

  /** @param {unknown} value @param {Set<string>} allowed @param {string} path @param {string[]} issues @param {readonly string[]} [required] */
  function rejectUnknownKeys(value, allowed, path, issues, required = []) {
    if (!isPlainObject(value)) {
      issues.push(path + ": expected an object");
      return;
    }
    for (const key of Object.keys(value)) {
      if (!allowed.has(key)) issues.push(path + "." + key + ": unsupported field");
    }
    for (const key of required) {
      if (!own(value, key)) issues.push(path + "." + key + ": required");
    }
  }

  /** @param {Options} options @param {string[]} issues */
  function builtInSet(options, issues) {
    const rawIds = options && options.builtInIds;
    let ids = null;
    if (rawIds instanceof Set) ids = new Set(rawIds);
    else if (Array.isArray(rawIds)) ids = new Set(rawIds);
    const snapshot = options && options.catalogSnapshot;
    if (snapshot !== undefined) {
      if (!isPlainObject(snapshot) || !Array.isArray(snapshot.exercises) || !isPlainObject(snapshot.uuidIndex)) {
        issues.push("options.catalogSnapshot: expected a raw exercise catalog snapshot");
        return new Set();
      }
      const snapshotIds = new Set();
      for (const [index, entry] of snapshot.exercises.entries()) {
        if (!isPlainObject(entry) || typeof entry.id !== "string" || !entry.id || snapshotIds.has(entry.id)) {
          issues.push("options.catalogSnapshot.exercises[" + index + "]: invalid or repeated source identity");
          continue;
        }
        snapshotIds.add(entry.id);
      }
      if (ids && (ids.size !== snapshotIds.size || [...ids].some((id) => !snapshotIds.has(id)))) {
        issues.push("options.builtInIds: differs from the raw catalog exercise identities");
      }
      ids = snapshotIds;
    }
    if (!ids) ids = new Set();
    for (const id of ids) {
      if (typeof id !== "string" || !id) issues.push("options.builtInIds: contains an invalid identity");
    }
    return ids;
  }

  /** @param {unknown} settings @param {unknown} language @param {string[]} issues */
  function validateSettings(settings, language, issues) {
    const values = /** @type {JsonRecord|null|undefined} */(settings);
    rejectUnknownKeys(settings, new Set(SETTING_KEYS), "settings", issues, SETTING_KEYS);
    if (!isFiniteNumber(values?.jumpPct) || values.jumpPct < 0 || values.jumpPct > 100) issues.push("settings.jumpPct: invalid");
    if (!isFiniteNumber(values?.minJump) || values.minJump < 0.01 || values.minJump > 1000) issues.push("settings.minJump: invalid");
    if (!isFiniteNumber(values?.rirHigh) || values.rirHigh < 0 || values.rirHigh > 100) issues.push("settings.rirHigh: invalid");
    if (!isFiniteNumber(values?.hardRir) || values.hardRir < 0 || values.hardRir > 100) issues.push("settings.hardRir: invalid");
    if (!integer(values?.restSec) || values.restSec < 0 || values.restSec > 86400) issues.push("settings.restSec: invalid");
    if (!UNITS.some(value=>value===values?.unit)) issues.push("settings.unit: invalid");
    if (!LANGUAGES.some(value=>value===values?.lang)) issues.push("settings.lang: invalid");
    if (!RIR_MODES.some(value=>value===values?.rirMode)) issues.push("settings.rirMode: invalid");
    if (!LANGUAGES.some(value=>value===language)) issues.push("language: invalid");
    if (LANGUAGES.some(value=>value===values?.lang) && values?.lang !== language) {
      issues.push("language: must equal settings.lang");
    }
  }

  /** @param {unknown} program @param {Set<unknown>} builtIns @param {string[]} issues */
  function validateProgramStructure(program, builtIns, issues) {
    if (!isPlainObject(program)) {
      issues.push("program: expected an object");
      return { customExercises: [], definition: null };
    }
    rejectUnknownKeys(program, PROGRAM_KEYS, "program", issues, ["name", "definition"]);
    if (typeof program.name !== "string" || !program.name.trim()) issues.push("program.name: expected a nonempty name");
    if (/** @type {number} */((/** @type {{length?:number}|null|undefined} */(program.name))?.length) > 200) issues.push("program.name: too long");
    const definition = program.definition;
    if (!isPlainObject(definition)) issues.push("program.definition: expected an object");

    const customSource = own(program, "customExercises") ? program.customExercises : [];
    if (!Array.isArray(customSource)) {
      issues.push("program.customExercises: expected an array");
    }
    const customExercises = Array.isArray(customSource) ? customSource : [];
    const customs = new Map();
    customExercises.forEach((entry, index) => {
      const path = "program.customExercises[" + index + "]";
      if (!isPlainObject(entry)) {
        issues.push(path + ": expected an object");
        return;
      }
      if (typeof entry.id !== "string" || !entry.id.startsWith(CUSTOM_ID_PREFIX) || entry.id.length <= CUSTOM_ID_PREFIX.length) {
        issues.push(path + ".id: expected an exact custom identity");
      } else if (customs.has(entry.id)) {
        issues.push(path + ".id: repeated custom identity");
      } else if (builtIns.has(entry.id)) {
        issues.push(path + ".id: shadows a built-in source identity");
      } else {
        customs.set(entry.id, entry);
      }
      if (typeof entry.name !== "string" || !entry.name.trim()) issues.push(path + ".name: expected a name");
    });

    if (isPlainObject(definition) && Array.isArray(definition.days)) {
      for (const [dayIndex, day] of definition.days.entries()) {
        if (!isPlainObject(day) || !Array.isArray(day.slots)) continue;
        for (const [slotIndex, slot] of day.slots.entries()) {
          if (!isPlainObject(slot) || typeof slot.exerciseId !== "string") continue;
          const id = slot.exerciseId;
          const path = "program.definition.days[" + dayIndex + "].slots[" + slotIndex + "].exerciseId";
          if (id.startsWith(CUSTOM_ID_PREFIX)) {
            if (!customs.has(id)) issues.push(path + ": custom identity has no exact definition");
          } else if (!builtIns.has(id)) {
            issues.push(path + ": unknown raw catalog identity");
          }
        }
      }
    }

    return { customExercises, definition };
  }

  /** @param {unknown} raw @param {Options} [options] @returns {{ok:true,value:Payload,issues:never[],blockers:never[]}|ReturnType<typeof schemaFail>} */
  function validate(raw, options = {}) {
    const initialIssues = [];
    if (!isPlainObject(raw)) return schemaFail(["$: expected an object"]);
    const canonical = (() => {
      try { return cloneCanonical(raw); }
      catch (error) {
        initialIssues.push(error instanceof Error ? error.message : "payload: unsafe value");
        return null;
      }
    })();
    if (!canonical || initialIssues.length) return schemaFail(initialIssues);
    rejectUnknownKeys(canonical, TOP_LEVEL_KEYS, "$", initialIssues, [...TOP_LEVEL_KEYS]);
    scanStateFields(canonical, initialIssues);
    if (canonical.kind !== KIND) initialIssues.push("kind: invalid");
    if (!Number.isInteger(canonical.version)) initialIssues.push("version: invalid");
    else if (canonical.version !== VERSION) return schemaFail([], "unsupported-version");
    validateSettings(canonical.settings, canonical.language, initialIssues);
    const builtIns = builtInSet(options, initialIssues);
    const { customExercises, definition } = validateProgramStructure(canonical.program, builtIns, initialIssues);
    if (!options || typeof options.validateProgramDefinition !== "function") {
      initialIssues.push("program.definition: canonical validator is unavailable");
    }
    if (initialIssues.length) return schemaFail(initialIssues);

    let checked;
    try {
      checked = /** @type {NonNullable<Options["validateProgramDefinition"]>} */(options.validateProgramDefinition)(definition, options.catalogSnapshot, customExercises);
    } catch (error) {
      return schemaFail(["program.definition: validation failed: " + (error instanceof Error ? error.message : "unknown error")], "invalid-program-definition");
    }
    if (!checked || checked.ok !== true) {
      const issues = Array.isArray(checked?.issues) ? checked.issues.map(String) : ["program.definition: invalid canonical definition"];
      return schemaFail(issues, checked?.code || "invalid-program-definition");
    }
    return { ok: true, value: /** @type {Payload} */(canonical), issues: [], blockers: [] };
  }

  /** @param {unknown} raw @param {Options} [options] */
  function buildProposal(raw, options = {}) {
    return validate(raw, options);
  }

  /** @param {Uint8Array} bytes */
  function toBase64Url(bytes) {
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + 0x8000));
      for (const byte of chunk) binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  /** @param {unknown} text */
  function fromBase64Url(text) {
    if (typeof text !== "string" || !text || !BASE64URL_RE.test(text) || text.length % 4 === 1) return null;
    try {
      const padded = text.replace(/-/g, "+").replace(/_/g, "/")
        + "=".repeat((4 - text.length % 4) % 4);
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return bytes;
    } catch {
      return null;
    }
  }

  /** @param {ReadableStream<Uint8Array>} stream @param {number} maximum @param {string} overflowCode @param {string} failureCode @returns {Promise<{ok:true,value:Uint8Array}|{ok:false,code:string}>} */
  async function readBoundedStream(stream, maximum, overflowCode, failureCode) {
    let reader;
    try { reader = stream.getReader(); }
    catch { return { ok: false, code: failureCode }; }
    const chunks = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maximum) {
          try { await reader.cancel(); } catch {}
          return { ok: false, code: overflowCode };
        }
        chunks.push(value);
      }
    } catch {
      return { ok: false, code: failureCode };
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, value: bytes };
  }

  /** @param {Uint8Array} bytes @returns {Promise<{ok:true,value:Uint8Array}|{ok:false,code:string}>} */
  async function gzipBytes(bytes) {
    if (typeof CompressionStream !== "function" || typeof Blob !== "function") {
      return { ok: false, code: "compression-unavailable" };
    }
    try {
      const stream = new Blob([/** @type {Uint8Array<ArrayBuffer>} */(bytes)]).stream().pipeThrough(new CompressionStream("gzip"));
      return await readBoundedStream(stream, MAX_COMPRESSED_BYTES, "encoded-too-large", "compression-failed");
    } catch {
      return { ok: false, code: "compression-failed" };
    }
  }

  /** @param {Uint8Array} bytes @returns {Promise<{ok:true,value:Uint8Array}|{ok:false,code:string}>} */
  async function gunzipBytes(bytes) {
    if (typeof DecompressionStream !== "function" || typeof Blob !== "function") {
      return { ok: false, code: "decompression-unavailable" };
    }
    try {
      const stream = new Blob([/** @type {Uint8Array<ArrayBuffer>} */(bytes)]).stream().pipeThrough(new DecompressionStream("gzip"));
      return await readBoundedStream(stream, MAX_DECOMPRESSED_BYTES, "decompressed-too-large", "invalid-gzip");
    } catch {
      return { ok: false, code: "invalid-gzip" };
    }
  }

  /** @param {Payload} payload @param {IdentityContext} identityContext @param {Options} options */
  function v4Tuple(payload, identityContext, options) {
    const settings = payload.settings;
    return [
      VERSION,
      payload.program.name,
      compactProgramDefinition(payload.program.definition, identityContext, options),
      own(payload.program, "customExercises") ? compactTree(payload.program.customExercises, identityContext) : null,
      [
        settings.jumpPct,
        settings.minJump,
        settings.rirHigh,
        settings.hardRir,
        settings.restSec,
        UNITS.indexOf(settings.unit),
        RIR_MODES.indexOf(settings.rirMode),
      ],
      LANGUAGES.indexOf(payload.language),
    ];
  }

  /** @param {unknown} value @param {IdentityContext|null} identityContext @param {Options} options @returns {Promise<Expanded>} */
  async function expandV4(value, identityContext, options) {
    if (!Array.isArray(value) || value.length !== 6 || value[0] !== VERSION) {
      return { ok: false, code: "invalid-envelope" };
    }
    const [version, name, compactDefinition, compactCustomExercises, settingTuple, languageCode] = value;
    if (typeof name !== "string" || !Array.isArray(compactDefinition)
      || (compactCustomExercises !== null && (!Array.isArray(compactCustomExercises) || compactCustomExercises[0] !== "a"))
      || !Array.isArray(settingTuple) || settingTuple.length !== 7
      || !Number.isInteger(settingTuple[5]) || !UNITS[settingTuple[5]]
      || !Number.isInteger(settingTuple[6]) || !RIR_MODES[settingTuple[6]]
      || !Number.isInteger(languageCode) || !LANGUAGES[languageCode]) {
      return { ok: false, code: "invalid-envelope" };
    }
    const expandedDefinition = await expandProgramDefinition(compactDefinition, identityContext, options);
    // Preserve the reason a current recipe cannot be regenerated.
    if (!expandedDefinition.ok && ["unsupported-version", "catalog-mismatch", "catalog-unavailable"].includes(expandedDefinition.code)) return expandedDefinition;
    const expandedCustomExercises = compactCustomExercises === null
      ? { ok: true, value: null }
      : expandTree(compactCustomExercises, identityContext?.ids || null);
    if (!expandedDefinition.ok || !expandedCustomExercises.ok || !isPlainObject(expandedDefinition.value)
      || (expandedCustomExercises.value !== null && !Array.isArray(expandedCustomExercises.value))) {
      return { ok: false, code: "invalid-envelope" };
    }
    const language = LANGUAGES[languageCode];
    const [jumpPct, minJump, rirHigh, hardRir, restSec, unitCode, rirModeCode] = settingTuple;
    /** @type {{name:string,definition:JsonRecord,customExercises?:unknown[]}} */
    const program = { name, definition: expandedDefinition.value };
    if (expandedCustomExercises.value !== null) program.customExercises = expandedCustomExercises.value;
    return {
      ok: true,
      value: {
        kind: KIND,
        version,
        program,
        settings: {
          jumpPct,
          minJump,
          rirHigh,
          hardRir,
          restSec,
          unit: UNITS[unitCode],
          lang: language,
          rirMode: RIR_MODES[rirModeCode],
        },
        language,
      },
    };
  }

  /** @param {unknown} raw @param {Options} [options] */
  async function encode(raw, options = {}) {
    const checked = buildProposal(raw, options);
    if (!checked.ok) return checked;
    const identityContext = await sourceIdentityContext(options?.catalogSnapshot);
    if (!identityContext) return { ok: false, code: "catalog-unavailable", issues: [], blockers: [] };
    let json, form;
    try {
      const tuple = v4Tuple(checked.value, identityContext, options);
      // "recipe": the generator request; "full": the whole definition.
      form = Array.isArray(tuple[2]) && tuple[2][0] === "g" ? "recipe" : "full";
      json = JSON.stringify(tuple);
    }
    catch { return { ok: false, code: "invalid-json", issues: [], blockers: [] }; }
    const bytes = new TextEncoder().encode(json);
    // A refusal still says which form was tried and how large the link would
    // have been, so callers can say how far over the limit a program is.
    if (bytes.byteLength > MAX_DECOMPRESSED_BYTES) {
      return { ok: false, code: "encoded-too-large", issues: [], blockers: [], form, decompressedBytes: bytes.byteLength };
    }
    const compressed = await gzipBytes(bytes);
    if (!compressed.ok) return { ...compressed, issues: [], blockers: [] };
    const encoded = "v4." + toBase64Url(compressed.value);
    if (encoded.length > MAX_ENCODED_CHARS) {
      return { ok: false, code: "encoded-too-large", issues: [], blockers: [], form,
        encodedChars: encoded.length, compressedBytes: compressed.value.byteLength, decompressedBytes: bytes.byteLength };
    }
    return {
      ok: true,
      value: encoded,
      form,
      encodedChars: encoded.length,
      compressedBytes: compressed.value.byteLength,
      decompressedBytes: bytes.byteLength,
    };
  }

  /** @param {string} encoded @param {RegExpMatchArray} match */
  function versionedUnsupported(encoded, match) {
    const parsed = Number(match[1]);
    return {
      ok: false,
      code: "unsupported-version",
      version: Number.isSafeInteger(parsed) ? parsed : match[1],
      encoded,
      issues: [],
      blockers: [],
    };
  }

  /** @param {unknown} encoded @param {Options} [options] */
  async function decode(encoded, options = {}) {
    if (typeof encoded !== "string" || encoded.length === 0) {
      return { ok: false, code: "missing", issues: [], blockers: [] };
    }
    const match = encoded.match(VERSION_PREFIX_RE);
    if (!match) return { ok: false, code: "invalid-base64", issues: [], blockers: [] };
    const wireVersion = Number(match[1]);
    if (wireVersion !== ENCODING_VERSION) return versionedUnsupported(encoded, match);
    if (encoded.length > MAX_ENCODED_CHARS) return { ok: false, code: "encoded-too-large", issues: [], blockers: [] };
    const compressed = fromBase64Url(encoded.slice(match[0].length));
    if (!compressed) return { ok: false, code: "invalid-base64", issues: [], blockers: [] };
    if (compressed.byteLength > MAX_COMPRESSED_BYTES) return { ok: false, code: "encoded-too-large", issues: [], blockers: [] };
    const decompressed = await gunzipBytes(compressed);
    if (!decompressed.ok) return { ...decompressed, issues: [], blockers: [] };
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(decompressed.value); }
    catch { return { ok: false, code: "invalid-utf8", issues: [], blockers: [] }; }
    let parsed;
    try { parsed = JSON.parse(text); }
    catch { return { ok: false, code: "invalid-json", issues: [], blockers: [] }; }
    const identityContext = await sourceIdentityContext(options?.catalogSnapshot);
    const expanded = await expandV4(parsed, identityContext, options);
    if (!expanded.ok) return { ...expanded, issues: [], blockers: [] };
    const checked = buildProposal(expanded.value, options);
    if (!checked.ok) return checked;
    return {
      ok: true,
      value: checked.value,
      compressedBytes: compressed.byteLength,
      decompressedBytes: decompressed.value.byteLength,
    };
  }

  /** @param {LocationLike|string|null} [locationLike] */
  function rawHref(locationLike) {
    if (typeof locationLike === "string") return locationLike;
    if (locationLike && typeof locationLike.href === "string") return locationLike.href;
    if (locationLike && typeof locationLike.hash === "string") return locationLike.hash;
    if (capabilities.location && typeof capabilities.location.href === "string") return capabilities.location.href;
    return "";
  }

  /** @param {string} href */
  function hashFromHref(href) {
    const index = href.indexOf("#");
    return index < 0 ? "" : href.slice(index + 1);
  }

  /** @param {string} rawKey */
  function isSetupKey(rawKey) {
    try { return decodeURIComponent(rawKey.replace(/\+/g, " ")) === "setup"; }
    catch { return rawKey === "setup"; }
  }

  /** @param {LocationLike|string|null} [locationLike] */
  function fragmentFromLocation(locationLike) {
    const hash = hashFromHref(rawHref(locationLike));
    if (!hash) return null;
    for (const part of hash.split("&")) {
      const separator = part.indexOf("=");
      const rawKey = separator < 0 ? part : part.slice(0, separator);
      if (!isSetupKey(rawKey)) continue;
      return separator < 0 ? "" : part.slice(separator + 1);
    }
    return null;
  }

  /** @param {LocationLike|string|null} [url] */
  function readSetupFragment(url) {
    return fragmentFromLocation(url);
  }

  /** @param {LocationLike|string|null} [url] */
  function removeSetupFragment(url) {
    const href = rawHref(url);
    const marker = href.indexOf("#");
    const beforeHash = marker < 0 ? href : href.slice(0, marker);
    const hash = marker < 0 ? "" : href.slice(marker + 1);
    let parsed;
    try { parsed = new URL(beforeHash || rawHref(), "https://taurifer.invalid/"); }
    catch { return ""; }
    const remaining = hash.split("&").filter((part) => {
      if (!part) return false;
      const separator = part.indexOf("=");
      const rawKey = separator < 0 ? part : part.slice(0, separator);
      return !isSetupKey(rawKey);
    });
    return parsed.pathname + parsed.search + (remaining.length ? "#" + remaining.join("&") : "");
  }

  /** @param {LocationLike|string|null} [locationLike] */
  function cookieBase(locationLike) {
    const href = typeof locationLike === "string" ? locationLike : rawHref(locationLike);
    try { return new URL(href || "https://taurifer.invalid/index.html"); }
    catch { return new URL("https://taurifer.invalid/index.html"); }
  }

  // The app scope (the directory the document lives in), not its document URL:
  // the host may serve the document at `/` or at `/index.html`, and the
  // installed app launches through `./index.html`, which a host can redirect.
  /** @param {LocationLike|string|null} [locationLike] */
  function handoffCookiePath(locationLike) {
    return new URL("./", cookieBase(locationLike)).pathname;
  }

  // Releases before the scope path wrote the cookie at the document URL.
  /** @param {LocationLike|string|null} [locationLike] */
  function legacyHandoffCookiePath(locationLike) {
    return new URL("index.html", cookieBase(locationLike)).pathname;
  }

  /** @param {LocationLike|string|null} [locationLike] */
  function hostnameOf(locationLike) {
    const href = typeof locationLike === "string" ? locationLike : rawHref(locationLike);
    try { return new URL(href || "https://taurifer.invalid/").hostname.toLowerCase(); }
    catch { return ""; }
  }

  /** @param {LocationLike|string|null} [locationLike] */
  function cookieSecureSuffix(locationLike) {
    const host = hostnameOf(locationLike);
    const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");
    return local ? "" : "; Secure";
  }

  /** @param {unknown} value @returns {value is string} */
  function isSafeHandoffEnvelope(value) {
    if (typeof value !== "string" || value.length > MAX_ENCODED_CHARS) return false;
    const match = value.match(/^v4\.(.*)$/);
    if (!match || !match[1] || !BASE64URL_RE.test(match[1]) || match[1].length % 4 === 1) return false;
    return true;
  }

  /** @param {CookieAdapters} [adapters] */
  function adapterDocument(adapters) {
    return adapters?.document || capabilities.document || null;
  }

  /** @param {CookieAdapters} [adapters] */
  function adapterLocation(adapters) {
    return adapters?.location || capabilities.location || null;
  }

  /** @param {unknown} value @param {CookieAdapters} [adapters] */
  function writeHandoffCookie(value, adapters) {
    const documentLike = adapterDocument(adapters);
    const locationLike = adapterLocation(adapters);
    if (!documentLike || !locationLike || !isSafeHandoffEnvelope(value)) return false;
    const path = handoffCookiePath(locationLike);
    documentLike.cookie = COOKIE_NAME + "=; Path=" + legacyHandoffCookiePath(locationLike) + "; Max-Age=0; SameSite=Lax"
      + cookieSecureSuffix(locationLike);
    documentLike.cookie = COOKIE_NAME + "=" + value + "; Path=" + path + "; Max-Age=" + COOKIE_MAX_AGE
      + "; SameSite=Lax" + cookieSecureSuffix(locationLike);
    return true;
  }

  /** @param {CookieAdapters} [adapters] */
  function readHandoffCookie(adapters) {
    const documentLike = adapterDocument(adapters);
    if (!documentLike || typeof documentLike.cookie !== "string") return null;
    for (const rawPart of documentLike.cookie.split(";")) {
      const part = rawPart.trim();
      const separator = part.indexOf("=");
      const name = separator < 0 ? part : part.slice(0, separator);
      if (name === COOKIE_NAME) return separator < 0 ? "" : part.slice(separator + 1);
    }
    return null;
  }

  /** @param {CookieAdapters} [adapters] */
  function clearHandoffCookie(adapters) {
    const documentLike = adapterDocument(adapters);
    const locationLike = adapterLocation(adapters);
    if (!documentLike || !locationLike) return false;
    documentLike.cookie = COOKIE_NAME + "=; Path=" + legacyHandoffCookiePath(locationLike) + "; Max-Age=0; SameSite=Lax"
      + cookieSecureSuffix(locationLike);
    documentLike.cookie = COOKIE_NAME + "=; Path=" + handoffCookiePath(locationLike) + "; Max-Age=0; SameSite=Lax"
      + cookieSecureSuffix(locationLike);
    return true;
  }

  const api = Object.freeze({
    KIND,
    VERSION,
    ENCODING_VERSION,
    MAX_ENCODED_CHARS,
    MAX_COMPRESSED_BYTES,
    MAX_DECOMPRESSED_BYTES,
    canonicalize: cloneCanonical,
    validate,
    buildProposal,
    encode,
    decode,
    fragmentFromLocation,
    readSetupFragment,
    removeSetupFragment,
    handoffCookiePath,
    readHandoffCookie,
    writeHandoffCookie,
    clearHandoffCookie,
    isSafeHandoffEnvelope,
  });
  return api;
}
