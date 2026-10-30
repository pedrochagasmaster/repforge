(function (root) {
  "use strict";

  const KIND = "taurifer-shared-setup";
  const VERSION = 2;
  // The newest wire this app reads. Recipe and full links stay `v4.`; a recipe
  // plus edits travels as `v5.`, which an app that only reads v4 refuses as a
  // newer, unsupported link (#527).
  const ENCODING_VERSION = 5;
  const RECIPE_ENCODING_VERSION = 4;
  const PATCH_ENCODING_VERSION = 5;
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

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function own(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function schemaFail(issues, code = "invalid-schema") {
    return { ok: false, code, issues: [...issues], blockers: [] };
  }

  function cloneCanonical(value) {
    let nodes = 0;
    const ancestors = new Set();

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
        for (const key of ownKeys.sort()) {
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

    return visit(value, "$", 0);
  }

  function compactString(value) {
    const code = COMPACT_VALUE_BY_NAME.get(value);
    if (code !== undefined) return "!" + code;
    return value.startsWith("!") ? "!!" + value.slice(1) : value;
  }

  function expandString(value) {
    if (!value.startsWith("!")) return { ok: true, value };
    if (value.startsWith("!!")) return { ok: true, value: "!" + value.slice(2) };
    const expanded = COMPACT_NAME_BY_VALUE.get(value.slice(1));
    return expanded === undefined ? { ok: false, code: "invalid-envelope" } : { ok: true, value: expanded };
  }

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

  function metricDefinitionsForIds(metricIds) {
    const domain = root.RepForgeExerciseMetrics
      || (typeof require === "function" ? require("./exercise-metrics.js") : null);
    const definitions = domain?.definitionsForIds?.(metricIds);
    return definitions?.ok === true ? cloneCanonical(definitions.value) : null;
  }

  function stableStringify(value) {
    if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
    if (isPlainObject(value)) {
      return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stableStringify(value[key])).join(",") + "}";
    }
    return JSON.stringify(value);
  }

  async function sourceIdentityContext(snapshot) {
    if (!isPlainObject(snapshot) || !Array.isArray(snapshot.exercises) || !isPlainObject(snapshot.uuidIndex)) return null;
    const ids = Object.keys(snapshot.uuidIndex).filter((id) => /^[a-f0-9]{32}$/i.test(id)).sort();
    if (!ids.length) return null;
    let fingerprint;
    try {
      const identity = root.RepForgeGenerationIdentity || (typeof require === "function" ? require("./generation-identity.js") : null);
      if (!identity) return null;
      fingerprint = identity.catalogIdentity(snapshot);
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
      if (error?.name === "AbortError") throw error;
      return { ok: false, code: "invalid-envelope" };
    }
    if (!generated?.ok || generated.value.generatorVersion !== compact[2]) return { ok: false, code: "invalid-envelope" };
    return { ok: true, value: generated.value };
  }

  /* ---- Recipe plus edits (#527) ----
     An edited generated program travels as its generator request plus a patch
     against what that request regenerates. The patch is id-keyed: arrays of
     objects with an `id` (days, slots, sets) are matched by id, so a reorder is
     one order list and an inserted element is a diff from its nearest preceding
     original; other arrays are matched by index, and objects key by key, with
     explicit deletions. Sibling entries with the identical diff are stored once
     with every index they apply to, so "every set of this slot in every cycle"
     is one entry. Replaced values use the compact tree, so catalog identities
     travel as indices. A digest of the canonical edited definition travels with
     it, and anything that does not reproduce it exactly is refused.

     Node grammar:
       ["=", compactValue]                  replace
       ["-"]                                delete (an object member only)
       ["o", keyToken, node, ...]           object members
       ["x", [index|[indices], node], ...]  same-length array, by index
       ["i", order|null, entry, ...]        id-keyed array; order lists base
                                            indices and the new ids in place;
                                            entry is [index|[indices], node] or
                                            ["+", sourceIndex|null, node] */
  const isIdList = (list) => list.length > 0 && list.every((item) => isPlainObject(item) && typeof item.id === "string");

  function keyToken(key, identityContext) {
    const known = COMPACT_KEY_BY_NAME.get(key);
    if (known) return known;
    const identity = identityContext?.indexById.get(key);
    return identity !== undefined ? "^" + identity : "~" + toBase64Url(new TextEncoder().encode(key));
  }

  function keyFromToken(token, sourceIdentities) {
    if (typeof token !== "string") return undefined;
    let key = COMPACT_NAME_BY_KEY.get(token);
    if (key === undefined && /^\^(0|[1-9][0-9]*)$/.test(token)) {
      const index = Number(token.slice(1));
      key = Array.isArray(sourceIdentities) && index < sourceIdentities.length ? sourceIdentities[index] : undefined;
    }
    if (key === undefined && token.startsWith("~")) {
      if (token.length === 1) key = "";
      else {
        const bytes = fromBase64Url(token.slice(1));
        if (!bytes) return undefined;
        try { key = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
        catch { return undefined; }
      }
    }
    return key === undefined || FORBIDDEN_KEYS.has(key) ? undefined : key;
  }

  /** Entries with the identical node share one [indices, node] entry. */
  function groupEntries(entries) {
    const grouped = [];
    const bySignature = new Map();
    for (const [index, node] of entries) {
      const signature = JSON.stringify(node);
      const existing = bySignature.get(signature);
      if (existing) existing[0].push(index);
      else {
        const entry = [[index], node];
        bySignature.set(signature, entry);
        grouped.push(entry);
      }
    }
    return grouped.map(([indices, node]) => [indices.length === 1 ? indices[0] : indices, node]);
  }

  function definitionPatch(base, target, identityContext) {
    if (stableStringify(base) === stableStringify(target)) return undefined;
    const replace = () => ["=", compactTree(target, identityContext)];
    if (Array.isArray(base) && Array.isArray(target)) {
      if (isIdList(base) && isIdList(target) && new Set(target.map((item) => item.id)).size === target.length
        && new Set(base.map((item) => item.id)).size === base.length) {
        const position = new Map(base.map((item, index) => [item.id, index]));
        const order = target.map((item) => (position.has(item.id) ? position.get(item.id) : compactString(item.id)));
        const unchangedOrder = base.length === target.length && order.every((value, index) => value === index);
        const changed = [];
        const inserts = [];
        target.forEach((item, at) => {
          if (position.has(item.id)) {
            const node = definitionPatch(base[position.get(item.id)], item, identityContext);
            if (node !== undefined) changed.push([position.get(item.id), node]);
            return;
          }
          let source = null;
          for (let back = at - 1; back >= 0 && source === null; back--) {
            if (position.has(target[back].id)) source = position.get(target[back].id);
          }
          inserts.push(["+", source, source === null ? ["=", compactTree(item, identityContext)]
            : definitionPatch(base[source], item, identityContext)]);
        });
        return ["i", unchangedOrder ? null : order, ...groupEntries(changed), ...inserts];
      }
      if (base.length !== target.length) return replace();
      const changed = [];
      base.forEach((item, index) => {
        const node = definitionPatch(item, target[index], identityContext);
        if (node !== undefined) changed.push([index, node]);
      });
      return ["x", ...groupEntries(changed)];
    }
    if (isPlainObject(base) && isPlainObject(target)) {
      const node = ["o"];
      for (const key of new Set([...Object.keys(base), ...Object.keys(target)])) {
        if (!own(target, key)) node.push(keyToken(key, identityContext), ["-"]);
        else if (!own(base, key)) node.push(keyToken(key, identityContext), ["=", compactTree(target[key], identityContext)]);
        else {
          const child = definitionPatch(base[key], target[key], identityContext);
          if (child !== undefined) node.push(keyToken(key, identityContext), child);
        }
      }
      return node;
    }
    return replace();
  }

  /** Apply a received patch to the regenerated baseline. Untrusted: any malformed node refuses. */
  function applyDefinitionPatch(base, node, sourceIdentities, depth = 0) {
    const fail = { ok: false, code: "invalid-envelope" };
    if (depth > MAX_STRUCTURE_DEPTH || !Array.isArray(node) || typeof node[0] !== "string") return fail;
    if (node[0] === "=") return node.length === 2 ? expandTree(node[1], sourceIdentities) : fail;
    const indices = (spec, length) => {
      const list = Array.isArray(spec) ? spec : [spec];
      return list.length > 0 && list.every((index) => Number.isSafeInteger(index) && index >= 0 && index < length)
        && new Set(list).size === list.length ? list : null;
    };
    if (node[0] === "o") {
      if (!isPlainObject(base) || node.length % 2 !== 1) return fail;
      const result = cloneCanonical(base);
      const seen = new Set();
      for (let at = 1; at < node.length; at += 2) {
        const key = keyFromToken(node[at], sourceIdentities);
        if (key === undefined || seen.has(key)) return fail;
        seen.add(key);
        const child = node[at + 1];
        if (Array.isArray(child) && child.length === 1 && child[0] === "-") {
          if (!own(result, key)) return fail;
          delete result[key];
          continue;
        }
        const applied = own(result, key)
          ? applyDefinitionPatch(result[key], child, sourceIdentities, depth + 1)
          : (Array.isArray(child) && child[0] === "=" ? applyDefinitionPatch(undefined, child, sourceIdentities, depth + 1) : fail);
        if (!applied.ok) return applied;
        Object.defineProperty(result, key, { value: applied.value, enumerable: true, configurable: true, writable: true });
      }
      return { ok: true, value: result };
    }
    if (node[0] === "x") {
      if (!Array.isArray(base)) return fail;
      const result = cloneCanonical(base);
      const touched = new Set();
      for (const entry of node.slice(1)) {
        if (!Array.isArray(entry) || entry.length !== 2) return fail;
        const at = indices(entry[0], base.length);
        if (!at || at.some((index) => touched.has(index))) return fail;
        for (const index of at) {
          touched.add(index);
          const applied = applyDefinitionPatch(base[index], entry[1], sourceIdentities, depth + 1);
          if (!applied.ok) return applied;
          result[index] = applied.value;
        }
      }
      return { ok: true, value: result };
    }
    if (node[0] === "i") {
      if (!Array.isArray(base) || node.length < 2 || (node[1] !== null && !Array.isArray(node[1]))) return fail;
      const patched = base.map((item) => cloneCanonical(item));
      const touched = new Set();
      const inserted = [];
      for (const entry of node.slice(2)) {
        if (!Array.isArray(entry)) return fail;
        if (entry[0] === "+") {
          if (entry.length !== 3) return fail;
          const source = entry[1];
          if (source !== null && !(Number.isSafeInteger(source) && source >= 0 && source < base.length)) return fail;
          const applied = applyDefinitionPatch(source === null ? undefined : base[source], entry[2], sourceIdentities, depth + 1);
          if (!applied.ok || !isPlainObject(applied.value) || typeof applied.value.id !== "string") return fail;
          inserted.push(applied.value);
          continue;
        }
        if (entry.length !== 2) return fail;
        const at = indices(entry[0], base.length);
        if (!at || at.some((index) => touched.has(index))) return fail;
        for (const index of at) {
          touched.add(index);
          const applied = applyDefinitionPatch(base[index], entry[1], sourceIdentities, depth + 1);
          if (!applied.ok) return applied;
          patched[index] = applied.value;
        }
      }
      if (node[1] === null) return inserted.length ? fail : { ok: true, value: patched };
      const used = new Set();
      const result = [];
      let next = 0;
      for (const item of node[1]) {
        if (Number.isSafeInteger(item)) {
          if (item < 0 || item >= base.length || used.has(item)) return fail;
          used.add(item);
          result.push(patched[item]);
        } else if (typeof item === "string") {
          const id = expandString(item);
          if (!id.ok || next >= inserted.length || inserted[next].id !== id.value) return fail;
          result.push(inserted[next++]);
        } else return fail;
      }
      if (next !== inserted.length || [...touched].some((index) => !used.has(index))) return fail;
      return { ok: true, value: result };
    }
    return fail;
  }

  async function definitionDigest(definition) {
    const subtle = root.crypto?.subtle;
    if (!subtle) return null;
    const hash = await subtle.digest("SHA-256", new TextEncoder().encode(stableStringify(definition)));
    return Array.from(new Uint8Array(hash).slice(0, 6), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  // An edited generated program whose request still regenerates under this
  // generator: the request, the patch from that baseline, and the digest.
  async function patchForm(definition, identityContext, options) {
    if (typeof options?.generateProgram !== "function" || definition?.provenance?.source === "manual"
      || !isPlainObject(definition?.request) || typeof definition.request.goal !== "string") return null;
    const request = cloneCanonical(definition.request);
    delete request.seed;
    let regenerated;
    try { regenerated = options.generateProgram(request, options.catalogSnapshot); }
    catch { return null; }
    if (!regenerated?.ok || typeof regenerated.value?.generatorVersion !== "string") return null;
    const digest = await definitionDigest(definition);
    if (!digest) return null;
    const patch = definitionPatch(regenerated.value, definition, identityContext);
    if (patch === undefined) return null;
    return ["p", identityContext.fingerprint, regenerated.value.generatorVersion, compactTree(request, identityContext), patch, digest];
  }

  async function expandPatchForm(compact, identityContext, options) {
    if (compact.length !== 6 || typeof compact[1] !== "string" || typeof compact[2] !== "string"
      || !Array.isArray(compact[4]) || typeof compact[5] !== "string" || !/^[a-f0-9]{12}$/.test(compact[5])) {
      return { ok: false, code: "invalid-envelope" };
    }
    const baseline = await regenerate(["g", compact[1], compact[2], compact[3]], identityContext, options);
    if (!baseline.ok) return baseline;
    const applied = applyDefinitionPatch(baseline.value, compact[4], identityContext.ids);
    if (!applied.ok || !isPlainObject(applied.value)) return { ok: false, code: "invalid-envelope" };
    const digest = await definitionDigest(applied.value);
    if (digest !== compact[5]) return { ok: false, code: "invalid-envelope" };
    return applied;
  }

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

  function expandProgramDefinition(compact, identityContext, options, wireVersion = RECIPE_ENCODING_VERSION) {
    if (Array.isArray(compact) && compact[0] === "g") return regenerate(compact, identityContext, options);
    // The recipe-plus-edits form exists only on the v5 wire.
    if (Array.isArray(compact) && compact[0] === "p") {
      return wireVersion === PATCH_ENCODING_VERSION ? expandPatchForm(compact, identityContext, options) : { ok: false, code: "invalid-envelope" };
    }
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
    const list = (value) => (Array.isArray(value) ? value : []);
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
      scanStateFields(value[key], issues, path + "." + key, seen, depth + 1);
    }
  }

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

  function validateSettings(settings, language, issues) {
    rejectUnknownKeys(settings, new Set(SETTING_KEYS), "settings", issues, SETTING_KEYS);
    if (!isFiniteNumber(settings?.jumpPct) || settings.jumpPct < 0 || settings.jumpPct > 100) issues.push("settings.jumpPct: invalid");
    if (!isFiniteNumber(settings?.minJump) || settings.minJump < 0.01 || settings.minJump > 1000) issues.push("settings.minJump: invalid");
    if (!isFiniteNumber(settings?.rirHigh) || settings.rirHigh < 0 || settings.rirHigh > 100) issues.push("settings.rirHigh: invalid");
    if (!isFiniteNumber(settings?.hardRir) || settings.hardRir < 0 || settings.hardRir > 100) issues.push("settings.hardRir: invalid");
    if (!Number.isInteger(settings?.restSec) || settings.restSec < 0 || settings.restSec > 86400) issues.push("settings.restSec: invalid");
    if (!UNITS.includes(settings?.unit)) issues.push("settings.unit: invalid");
    if (!LANGUAGES.includes(settings?.lang)) issues.push("settings.lang: invalid");
    if (!RIR_MODES.includes(settings?.rirMode)) issues.push("settings.rirMode: invalid");
    if (!LANGUAGES.includes(language)) issues.push("language: invalid");
    if (LANGUAGES.includes(settings?.lang) && settings.lang !== language) {
      issues.push("language: must equal settings.lang");
    }
  }

  function validateProgramStructure(program, builtIns, issues) {
    if (!isPlainObject(program)) {
      issues.push("program: expected an object");
      return { customExercises: [], definition: null };
    }
    rejectUnknownKeys(program, PROGRAM_KEYS, "program", issues, ["name", "definition"]);
    if (typeof program.name !== "string" || !program.name.trim()) issues.push("program.name: expected a nonempty name");
    if (program.name?.length > 200) issues.push("program.name: too long");
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
    if (initialIssues.length) return schemaFail(initialIssues);
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
      checked = options.validateProgramDefinition(definition, options.catalogSnapshot, customExercises);
    } catch (error) {
      return schemaFail(["program.definition: validation failed: " + (error?.message || "unknown error")], "invalid-program-definition");
    }
    if (!checked || checked.ok !== true) {
      const issues = Array.isArray(checked?.issues) ? checked.issues.map(String) : ["program.definition: invalid canonical definition"];
      return schemaFail(issues, checked?.code || "invalid-program-definition");
    }
    return { ok: true, value: canonical, issues: [], blockers: [] };
  }

  function buildProposal(raw, options = {}) {
    return validate(raw, options);
  }

  function toBase64Url(bytes) {
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + 0x8000));
      for (const byte of chunk) binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

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

  async function gzipBytes(bytes) {
    if (typeof CompressionStream !== "function" || typeof Blob !== "function") {
      return { ok: false, code: "compression-unavailable" };
    }
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
      return await readBoundedStream(stream, MAX_COMPRESSED_BYTES, "encoded-too-large", "compression-failed");
    } catch {
      return { ok: false, code: "compression-failed" };
    }
  }

  async function gunzipBytes(bytes) {
    if (typeof DecompressionStream !== "function" || typeof Blob !== "function") {
      return { ok: false, code: "decompression-unavailable" };
    }
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      return await readBoundedStream(stream, MAX_DECOMPRESSED_BYTES, "decompressed-too-large", "invalid-gzip");
    } catch {
      return { ok: false, code: "invalid-gzip" };
    }
  }

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

  async function expandV4(value, identityContext, options, wireVersion = RECIPE_ENCODING_VERSION) {
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
    const expandedDefinition = await expandProgramDefinition(compactDefinition, identityContext, options, wireVersion);
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

  /** Serialize, gzip and bound one wire tuple; a refusal still says the form and how large it would have been. */
  async function packTuple(tuple, wireVersion, form) {
    let json;
    try { json = JSON.stringify(tuple); }
    catch { return { ok: false, code: "invalid-json", issues: [], blockers: [] }; }
    const bytes = new TextEncoder().encode(json);
    if (bytes.byteLength > MAX_DECOMPRESSED_BYTES) {
      return { ok: false, code: "encoded-too-large", issues: [], blockers: [], form, decompressedBytes: bytes.byteLength };
    }
    const compressed = await gzipBytes(bytes);
    if (!compressed.ok) return { ...compressed, issues: [], blockers: [], form };
    const encoded = "v" + wireVersion + "." + toBase64Url(compressed.value);
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

  // Forms, smallest first: "recipe" (v4 `g`, the generator request), "patch"
  // (v5 `p`, the request plus edits), "full" (v4 `c`, the whole definition).
  // A program none of them fits is refused, and the share sheet offers a file.
  async function encode(raw, options = {}) {
    const checked = buildProposal(raw, options);
    if (!checked.ok) return checked;
    const identityContext = await sourceIdentityContext(options?.catalogSnapshot);
    if (!identityContext) return { ok: false, code: "catalog-unavailable", issues: [], blockers: [] };
    let tuple;
    try { tuple = v4Tuple(checked.value, identityContext, options); }
    catch { return { ok: false, code: "invalid-json", issues: [], blockers: [] }; }
    if (Array.isArray(tuple[2]) && tuple[2][0] === "g") return packTuple(tuple, RECIPE_ENCODING_VERSION, "recipe");
    let patched = null;
    try { patched = await patchForm(checked.value.program.definition, identityContext, options); }
    catch { patched = null; }
    if (patched) {
      const attempt = await packTuple([...tuple.slice(0, 2), patched, ...tuple.slice(3)], PATCH_ENCODING_VERSION, "patch");
      if (attempt.ok || attempt.code !== "encoded-too-large") return attempt;
    }
    return packTuple(tuple, RECIPE_ENCODING_VERSION, "full");
  }

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

  async function decode(encoded, options = {}) {
    if (typeof encoded !== "string" || encoded.length === 0) {
      return { ok: false, code: "missing", issues: [], blockers: [] };
    }
    const match = encoded.match(VERSION_PREFIX_RE);
    if (!match) return { ok: false, code: "invalid-base64", issues: [], blockers: [] };
    const wireVersion = Number(match[1]);
    if (wireVersion !== RECIPE_ENCODING_VERSION && wireVersion !== PATCH_ENCODING_VERSION) return versionedUnsupported(encoded, match);
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
    const expanded = await expandV4(parsed, identityContext, options, wireVersion);
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

  function rawHref(locationLike) {
    if (typeof locationLike === "string") return locationLike;
    if (locationLike && typeof locationLike.href === "string") return locationLike.href;
    if (locationLike && typeof locationLike.hash === "string") return locationLike.hash;
    if (root.location && typeof root.location.href === "string") return root.location.href;
    return "";
  }

  function hashFromHref(href) {
    const index = href.indexOf("#");
    return index < 0 ? "" : href.slice(index + 1);
  }

  function isSetupKey(rawKey) {
    try { return decodeURIComponent(rawKey.replace(/\+/g, " ")) === "setup"; }
    catch { return rawKey === "setup"; }
  }

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

  function readSetupFragment(url) {
    return fragmentFromLocation(url);
  }

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

  function cookieBase(locationLike) {
    const href = typeof locationLike === "string" ? locationLike : rawHref(locationLike);
    try { return new URL(href || "https://taurifer.invalid/index.html"); }
    catch { return new URL("https://taurifer.invalid/index.html"); }
  }

  // The app scope (the directory the document lives in), not its document URL:
  // the host may serve the document at `/` or at `/index.html`, and the
  // installed app launches through `./index.html`, which a host can redirect.
  function handoffCookiePath(locationLike) {
    return new URL("./", cookieBase(locationLike)).pathname;
  }

  // Releases before the scope path wrote the cookie at the document URL.
  function legacyHandoffCookiePath(locationLike) {
    return new URL("index.html", cookieBase(locationLike)).pathname;
  }

  function hostnameOf(locationLike) {
    const href = typeof locationLike === "string" ? locationLike : rawHref(locationLike);
    try { return new URL(href || "https://taurifer.invalid/").hostname.toLowerCase(); }
    catch { return ""; }
  }

  function cookieSecureSuffix(locationLike) {
    const host = hostnameOf(locationLike);
    const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");
    return local ? "" : "; Secure";
  }

  function isSafeHandoffEnvelope(value) {
    if (typeof value !== "string" || value.length > MAX_ENCODED_CHARS) return false;
    const match = value.match(/^v[45]\.(.*)$/);
    if (!match || !match[1] || !BASE64URL_RE.test(match[1]) || match[1].length % 4 === 1) return false;
    return true;
  }

  function adapterDocument(adapters) {
    return adapters?.document || root.document || null;
  }

  function adapterLocation(adapters) {
    return adapters?.location || root.location || null;
  }

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
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeSharedSetup = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
