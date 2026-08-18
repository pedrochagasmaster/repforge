(function (root) {
  const KIND = "taurifer-shared-setup";
  const VERSION = 1;
  const MAX_ENCODED_CHARS = 3072;
  const MAX_COMPRESSED_BYTES = 2301;
  const MAX_DECOMPRESSED_BYTES = 65536;
  const COOKIE_NAME = "repforge_setup_v1";
  const COOKIE_MAX_AGE = 604800;
  const CUSTOM_ID_PREFIX = "custom:";
  const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
  const GOALS = new Set(["hypertrophy", "strength_hypertrophy", "beginner_consistency"]);
  const EXPERIENCES = new Set(["beginner", "intermediate", "advanced"]);
  const SPLITS = new Set(["full_body", "machine_only", "ppl", "upper_lower", "bro"]);
  const SESSION_LENGTHS = new Set(["short", "normal", "long"]);
  const EQUIPMENT = new Set(["machines", "cables", "dumbbells", "barbells", "bodyweight"]);
  const UNITS = new Set(["kg", "lb"]);
  const LANGS = new Set(["en", "pt"]);
  const RIR_MODES = new Set(["numeric", "effort"]);
  const BASE64URL_RE = /^[A-Za-z0-9_-]*$/;
  const VERSION_PREFIX_RE = /^v(\d+)\.(.*)$/;

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function setOwn(target, key, value) {
    Object.defineProperty(target, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }

  function codePointCount(value) {
    return [...value].length;
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function isIntInRange(value, min, max) {
    return isFiniteNumber(value) && Number.isInteger(value) && value >= min && value <= max;
  }

  function isNumberInRange(value, min, max) {
    return isFiniteNumber(value) && value >= min && value <= max;
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function schemaFail(issues) {
    return { ok: false, code: "invalid-schema", issues: issues.slice() };
  }

  function resolveHref(url) {
    if (typeof url === "string" && url) return url;
    if (typeof location !== "undefined" && location && location.href) return location.href;
    return "";
  }

  function adapterDocument(adapters) {
    if (adapters && adapters.document) return adapters.document;
    if (typeof document !== "undefined") return document;
    return null;
  }

  function adapterLocation(adapters) {
    if (adapters && adapters.location) return adapters.location;
    if (typeof location !== "undefined") return location;
    return null;
  }

  function hostnameOf(locationLike) {
    if (locationLike && typeof locationLike.hostname === "string" && locationLike.hostname) {
      return locationLike.hostname;
    }
    try {
      const href = typeof locationLike === "string" ? locationLike : locationLike && locationLike.href;
      return href ? new URL(href).hostname : "";
    } catch {
      return "";
    }
  }

  function isLocalhostHost(host) {
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  }

  function collectForbiddenKeys(value, issues, path) {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) collectForbiddenKeys(value[i], issues, `${path}[${i}]`);
      return;
    }
    if (!isPlainObject(value)) return;
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key)) issues.push(`${path}: forbidden key ${key}`);
      else collectForbiddenKeys(value[key], issues, `${path}.${key}`);
    }
  }

  function canonicalize(value) {
    if (value === null) return null;
    const type = typeof value;
    if (type === "string" || type === "boolean") return value;
    if (type === "number") {
      if (!Number.isFinite(value)) throw new TypeError("unsupported type");
      return value;
    }
    if (Array.isArray(value)) return value.map(canonicalize);
    if (type === "object") {
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) throw new TypeError("unsupported type");
      const out = {};
      for (const key of Object.keys(value).sort()) {
        const child = value[key];
        if (child === undefined) throw new TypeError("unsupported type");
        setOwn(out, key, canonicalize(child));
      }
      return out;
    }
    throw new TypeError("unsupported type");
  }

  function requireString(raw, key, issues, path, { max, min = 0, trim = false, required = true } = {}) {
    if (!hasOwn(raw, key) || raw[key] == null) {
      if (required) issues.push(`${path}.${key}: required`);
      return undefined;
    }
    if (typeof raw[key] !== "string") {
      issues.push(`${path}.${key}: expected string`);
      return undefined;
    }
    const value = trim ? raw[key].trim() : raw[key];
    if (value.length < min || (trim && min > 0 && !value)) {
      issues.push(`${path}.${key}: empty`);
      return undefined;
    }
    if (codePointCount(value) > max) {
      issues.push(`${path}.${key}: too long`);
      return undefined;
    }
    return value;
  }

  function optionalEnum(raw, key, allowed, issues, path) {
    if (!hasOwn(raw, key) || raw[key] === undefined) return undefined;
    if (raw[key] === null) return null;
    if (typeof raw[key] !== "string" || !allowed.has(raw[key])) {
      issues.push(`${path}.${key}: invalid`);
      return undefined;
    }
    return raw[key];
  }

  function uniqueTrimmedStrings(raw, key, issues, path, { maxItems, maxItem, required = false, minItems = 0, allowlist = null }) {
    if (!hasOwn(raw, key) || raw[key] == null) {
      if (required) issues.push(`${path}.${key}: required`);
      return undefined;
    }
    if (!Array.isArray(raw[key])) {
      issues.push(`${path}.${key}: expected array`);
      return undefined;
    }
    if (raw[key].length > maxItems) {
      issues.push(`${path}.${key}: too many`);
      return undefined;
    }
    const out = [];
    const seen = new Set();
    for (let i = 0; i < raw[key].length; i++) {
      const item = raw[key][i];
      if (typeof item !== "string") {
        issues.push(`${path}.${key}[${i}]: expected string`);
        continue;
      }
      const value = item.trim();
      if (!value) {
        issues.push(`${path}.${key}[${i}]: empty`);
        continue;
      }
      if (codePointCount(value) > maxItem) {
        issues.push(`${path}.${key}[${i}]: too long`);
        continue;
      }
      if (allowlist && !allowlist.has(value)) {
        issues.push(`${path}.${key}[${i}]: invalid`);
        continue;
      }
      if (seen.has(value)) {
        issues.push(`${path}.${key}[${i}]: duplicate`);
        continue;
      }
      seen.add(value);
      out.push(value);
    }
    if (out.length < minItems) issues.push(`${path}.${key}: too few`);
    return out;
  }

  function pickMeta(raw, issues) {
    if (!isPlainObject(raw)) {
      issues.push("program.meta: expected object");
      return null;
    }
    const meta = {};
    const name = requireString(raw, "name", issues, "program.meta", { max: 100, min: 1, trim: true });
    if (name !== undefined) meta.name = name;
    const goal = optionalEnum(raw, "goal", GOALS, issues, "program.meta");
    if (goal !== undefined) meta.goal = goal;
    const experience = optionalEnum(raw, "experience", EXPERIENCES, issues, "program.meta");
    if (experience !== undefined) meta.experience = experience;
    if (!isIntInRange(raw.daysPerWeek, 1, 7)) issues.push("program.meta.daysPerWeek: invalid");
    else meta.daysPerWeek = raw.daysPerWeek;
    const splitType = optionalEnum(raw, "splitType", SPLITS, issues, "program.meta");
    if (splitType !== undefined) meta.splitType = splitType;
    const equipment = uniqueTrimmedStrings(raw, "equipment", issues, "program.meta", {
      maxItems: 5,
      maxItem: 80,
      allowlist: EQUIPMENT,
    });
    if (equipment) meta.equipment = equipment;
    const priorityMuscles = uniqueTrimmedStrings(raw, "priorityMuscles", issues, "program.meta", {
      maxItems: 32,
      maxItem: 80,
    });
    if (priorityMuscles) meta.priorityMuscles = priorityMuscles;
    const sessionLength = optionalEnum(raw, "sessionLength", SESSION_LENGTHS, issues, "program.meta");
    if (sessionLength !== undefined) meta.sessionLength = sessionLength;
    if (!isIntInRange(raw.mesocycleLengthWeeks, 1, 52)) issues.push("program.meta.mesocycleLengthWeeks: invalid");
    else meta.mesocycleLengthWeeks = raw.mesocycleLengthWeeks;
    return meta;
  }

  function pickOptionalNumber(raw, key, issues, path, min, max) {
    if (!hasOwn(raw, key) || raw[key] === undefined) return undefined;
    if (!isNumberInRange(raw[key], min, max)) {
      issues.push(`${path}.${key}: invalid`);
      return undefined;
    }
    return raw[key];
  }

  function pickOptionalInt(raw, key, issues, path, min, max) {
    if (!hasOwn(raw, key) || raw[key] === undefined) return undefined;
    if (!isIntInRange(raw[key], min, max)) {
      issues.push(`${path}.${key}: invalid`);
      return undefined;
    }
    return raw[key];
  }

  function pickExercise(raw, index, issues) {
    const path = `program.exercises[${index}]`;
    if (!isPlainObject(raw)) {
      issues.push(`${path}: expected object`);
      return null;
    }
    const exercise = {};
    const day = requireString(raw, "day", issues, path, { max: 80, min: 1, trim: true });
    if (day !== undefined) exercise.day = day;
    if (!isIntInRange(raw.order, 1, 1000)) issues.push(`${path}.order: invalid`);
    else exercise.order = raw.order;
    const libraryId = requireString(raw, "libraryId", issues, path, { max: 200, min: 1 });
    if (libraryId !== undefined) exercise.libraryId = libraryId;
    if (!isIntInRange(raw.sets, 1, 100)) issues.push(`${path}.sets: invalid`);
    else exercise.sets = raw.sets;
    if (!isIntInRange(raw.min, 1, 1000)) issues.push(`${path}.min: invalid`);
    else exercise.min = raw.min;
    if (!isIntInRange(raw.max, 1, 1000)) issues.push(`${path}.max: invalid`);
    else exercise.max = raw.max;
    if (isIntInRange(raw.min, 1, 1000) && isIntInRange(raw.max, 1, 1000) && raw.max < raw.min) {
      issues.push(`${path}.max: less than min`);
    }
    const displayName = requireString(raw, "displayName", issues, path, { max: 200, trim: true, required: false });
    if (displayName) exercise.displayName = displayName;
    if (!hasOwn(raw, "notes") || raw.notes == null) exercise.notes = "";
    else if (typeof raw.notes !== "string" || codePointCount(raw.notes) > 2000) issues.push(`${path}.notes: invalid`);
    else exercise.notes = raw.notes;
    if (!hasOwn(raw, "alternates") || raw.alternates == null) exercise.alternates = [];
    else {
      const alternates = uniqueTrimmedStrings(raw, "alternates", issues, path, {
        maxItems: 20,
        maxItem: 200,
        minItems: 0,
      });
      if (alternates) exercise.alternates = alternates;
    }
    const progressionType = requireString(raw, "progressionType", issues, path, { max: 80, trim: true, required: false });
    if (progressionType) exercise.progressionType = progressionType;
    const targetRirStart = pickOptionalNumber(raw, "targetRirStart", issues, path, 0, 100);
    if (targetRirStart !== undefined) exercise.targetRirStart = targetRirStart;
    const targetRirEnd = pickOptionalNumber(raw, "targetRirEnd", issues, path, 0, 100);
    if (targetRirEnd !== undefined) exercise.targetRirEnd = targetRirEnd;
    const minSets = pickOptionalInt(raw, "minSets", issues, path, 1, 100);
    if (minSets !== undefined) exercise.minSets = minSets;
    const maxSets = pickOptionalInt(raw, "maxSets", issues, path, 1, 100);
    if (maxSets !== undefined) exercise.maxSets = maxSets;
    if (minSets !== undefined && maxSets !== undefined && maxSets < minSets) {
      issues.push(`${path}.maxSets: less than minSets`);
    }
    const priority = requireString(raw, "priority", issues, path, { max: 80, trim: true, required: false });
    if (priority) exercise.priority = priority;
    return exercise;
  }

  function pickCustom(raw, index, issues) {
    const path = `program.customExercises[${index}]`;
    if (!isPlainObject(raw)) {
      issues.push(`${path}: expected object`);
      return null;
    }
    const custom = {};
    const id = requireString(raw, "id", issues, path, { max: 200, min: 1 });
    if (id !== undefined) {
      if (!id.startsWith(CUSTOM_ID_PREFIX) || id.length <= CUSTOM_ID_PREFIX.length) {
        issues.push(`${path}.id: invalid`);
      } else custom.id = id;
    }
    const name = requireString(raw, "name", issues, path, { max: 200, min: 1, trim: true });
    if (name !== undefined) custom.name = name;
    const namePt = requireString(raw, "namePt", issues, path, { max: 200, trim: true, required: false });
    custom.namePt = namePt || name || "";
    const equipment = uniqueTrimmedStrings(raw, "equipment", issues, path, {
      maxItems: 10,
      maxItem: 80,
      required: true,
      minItems: 1,
    });
    if (equipment) custom.equipment = equipment;
    const primary = requireString(raw, "primary", issues, path, { max: 500, required: false });
    if (primary !== undefined) custom.primary = primary;
    const secondary = requireString(raw, "secondary", issues, path, { max: 500, required: false });
    if (secondary !== undefined) custom.secondary = secondary;
    const notes = requireString(raw, "notes", issues, path, { max: 2000, required: false });
    if (notes !== undefined) custom.notes = notes;
    return custom;
  }

  function pickSettings(raw, issues) {
    if (!isPlainObject(raw)) {
      issues.push("settings: expected object");
      return null;
    }
    const settings = {};
    if (!isNumberInRange(raw.jumpPct, 0, 100)) issues.push("settings.jumpPct: invalid");
    else settings.jumpPct = raw.jumpPct;
    if (!isNumberInRange(raw.minJump, 0.01, 1000)) issues.push("settings.minJump: invalid");
    else settings.minJump = raw.minJump;
    if (!isNumberInRange(raw.rirHigh, 0, 100)) issues.push("settings.rirHigh: invalid");
    else settings.rirHigh = raw.rirHigh;
    if (!isNumberInRange(raw.hardRir, 0, 100)) issues.push("settings.hardRir: invalid");
    else settings.hardRir = raw.hardRir;
    if (!isIntInRange(raw.restSec, 0, 86400)) issues.push("settings.restSec: invalid");
    else settings.restSec = raw.restSec;
    if (!UNITS.has(raw.unit)) issues.push("settings.unit: invalid");
    else settings.unit = raw.unit;
    if (!LANGS.has(raw.lang)) issues.push("settings.lang: invalid");
    else settings.lang = raw.lang;
    if (!RIR_MODES.has(raw.rirMode)) issues.push("settings.rirMode: invalid");
    else settings.rirMode = raw.rirMode;
    return settings;
  }

  function builtInSet(options) {
    const ids = options && options.builtInIds;
    if (ids instanceof Set) return ids;
    if (Array.isArray(ids)) return new Set(ids);
    return new Set();
  }

  function validate(raw, options) {
    const issues = [];
    if (!isPlainObject(raw)) return schemaFail(["$: expected object"]);
    collectForbiddenKeys(raw, issues, "$");
    if (issues.length) return schemaFail(issues);
    if (raw.kind !== KIND) issues.push("kind: invalid");
    if (!hasOwn(raw, "version")) issues.push("version: required");
    else if (!isIntInRange(raw.version, 1, Number.MAX_SAFE_INTEGER) || raw.version !== VERSION) {
      if (isIntInRange(raw.version, 0, Number.MAX_SAFE_INTEGER) && raw.version !== VERSION) {
        return { ok: false, code: "unsupported-version" };
      }
      issues.push("version: invalid");
    }
    if (!isPlainObject(raw.program)) issues.push("program: expected object");
    if (!isPlainObject(raw.settings)) issues.push("settings: expected object");
    if (issues.length) return schemaFail(issues);

    const meta = pickMeta(raw.program.meta, issues);
    if (!Array.isArray(raw.program.exercises) || raw.program.exercises.length < 1) {
      issues.push("program.exercises: required");
    } else if (raw.program.exercises.length > 100) {
      issues.push("program.exercises: too many");
    }
    const exercises = Array.isArray(raw.program.exercises)
      ? raw.program.exercises.map((entry, index) => pickExercise(entry, index, issues)).filter(Boolean)
      : [];
    if (hasOwn(raw.program, "customExercises") && raw.program.customExercises != null && !Array.isArray(raw.program.customExercises)) {
      issues.push("program.customExercises: expected array");
    }
    const customSource = Array.isArray(raw.program.customExercises) ? raw.program.customExercises : [];
    if (customSource.length > 50) issues.push("program.customExercises: too many");
    const customs = customSource.map((entry, index) => pickCustom(entry, index, issues)).filter(Boolean);
    const settings = pickSettings(raw.settings, issues);
    if (issues.length) return schemaFail(issues);

    const positions = new Set();
    const days = new Set();
    for (const exercise of exercises) {
      days.add(exercise.day);
      const pos = `${exercise.day}\0${exercise.order}`;
      if (positions.has(pos)) issues.push(`program.exercises: duplicate ${exercise.day}#${exercise.order}`);
      positions.add(pos);
    }
    if (days.size > 7) issues.push("program.exercises: too many days");
    if (meta && meta.daysPerWeek !== days.size) issues.push("program.meta.daysPerWeek: day count mismatch");

    const builtInIds = builtInSet(options);
    const customById = new Map();
    for (const custom of customs) {
      if (customById.has(custom.id)) issues.push(`program.customExercises: duplicate ${custom.id}`);
      if (builtInIds.has(custom.id)) issues.push(`program.customExercises: shadows built-in ${custom.id}`);
      customById.set(custom.id, custom);
    }
    const referencedCustom = new Set();
    for (const exercise of exercises) {
      const id = exercise.libraryId;
      if (typeof id !== "string") continue;
      if (id.startsWith(CUSTOM_ID_PREFIX)) {
        if (!customById.has(id)) issues.push(`program.exercises: missing custom ${id}`);
        else referencedCustom.add(id);
      } else if (!builtInIds.has(id)) {
        issues.push(`program.exercises: unknown libraryId ${id}`);
      }
    }
    if (issues.length) return schemaFail(issues);

    const payload = {
      kind: KIND,
      version: VERSION,
      program: {
        meta,
        exercises,
        customExercises: customs.filter((entry) => referencedCustom.has(entry.id)),
      },
      settings,
    };
    return { ok: true, value: canonicalize(payload) };
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunk = 256;
    for (let i = 0; i < bytes.length; i += chunk) {
      const end = Math.min(i + chunk, bytes.length);
      for (let j = i; j < end; j++) binary += String.fromCharCode(bytes[j]);
    }
    return btoa(binary);
  }

  function base64ToBytes(b64) {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

  function toBase64Url(bytes) {
    return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function fromBase64Url(text) {
    if (typeof text !== "string" || !BASE64URL_RE.test(text) || text.length % 4 === 1) return null;
    const padded = text + "=".repeat((4 - (text.length % 4)) % 4);
    const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
    try {
      return base64ToBytes(b64);
    } catch {
      return null;
    }
  }

  function concatChunks(chunks, total) {
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  }

  async function readBoundedStream(stream, max, tooLargeCode, failCode) {
    const reader = stream.getReader();
    const chunks = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || !value.byteLength) continue;
        total += value.byteLength;
        if (total > max) {
          try { await reader.cancel(); } catch {}
          return { ok: false, code: tooLargeCode };
        }
        chunks.push(new Uint8Array(value));
      }
    } catch {
      return { ok: false, code: failCode };
    }
    return { ok: true, value: concatChunks(chunks, total) };
  }

  async function gzipBytes(bytes) {
    if (typeof CompressionStream !== "function") return { ok: false, code: "compression-unavailable" };
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
      return await readBoundedStream(stream, MAX_COMPRESSED_BYTES, "encoded-too-large", "compression-unavailable");
    } catch {
      return { ok: false, code: "compression-unavailable" };
    }
  }

  async function gunzipBytes(bytes) {
    if (typeof DecompressionStream !== "function") return { ok: false, code: "decompression-unavailable" };
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      return await readBoundedStream(stream, MAX_DECOMPRESSED_BYTES, "decompressed-too-large", "invalid-gzip");
    } catch {
      return { ok: false, code: "invalid-gzip" };
    }
  }

  function decodeUtf8(bytes) {
    try {
      return { ok: true, value: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
    } catch (err) {
      if (err && err.name === "TypeError" && /option|fatal/i.test(String(err.message || err))) {
        try {
          return { ok: true, value: new TextDecoder("utf-8").decode(bytes) };
        } catch {
          return { ok: false, code: "invalid-utf8" };
        }
      }
      return { ok: false, code: "invalid-utf8" };
    }
  }

  async function encode(raw, options) {
    const checked = validate(raw, options);
    if (!checked.ok) return checked;
    let jsonText;
    try {
      jsonText = JSON.stringify(checked.value);
    } catch {
      return schemaFail(["$: not serializable"]);
    }
    const decompressed = new TextEncoder().encode(jsonText);
    if (decompressed.byteLength > MAX_DECOMPRESSED_BYTES) {
      return { ok: false, code: "decompressed-too-large" };
    }
    const compressed = await gzipBytes(decompressed);
    if (!compressed.ok) return compressed;
    if (compressed.value.byteLength > MAX_COMPRESSED_BYTES) {
      return { ok: false, code: "encoded-too-large" };
    }
    const encoded = `v1.${toBase64Url(compressed.value)}`;
    if (encoded.length > MAX_ENCODED_CHARS) return { ok: false, code: "encoded-too-large" };
    return {
      ok: true,
      value: encoded,
      compressedBytes: compressed.value.byteLength,
      decompressedBytes: decompressed.byteLength,
    };
  }

  async function decode(encoded, options) {
    if (encoded == null || encoded === "") return { ok: false, code: "missing" };
    if (typeof encoded !== "string") return { ok: false, code: "missing" };
    if (encoded.length > MAX_ENCODED_CHARS) return { ok: false, code: "encoded-too-large" };
    const match = encoded.match(VERSION_PREFIX_RE);
    if (!match) return { ok: false, code: "unsupported-version" };
    if (Number(match[1]) !== VERSION) return { ok: false, code: "unsupported-version" };
    const payload = match[2];
    const compressed = fromBase64Url(payload);
    if (!compressed) return { ok: false, code: "invalid-base64" };
    if (compressed.byteLength > MAX_COMPRESSED_BYTES) return { ok: false, code: "encoded-too-large" };
    const decompressed = await gunzipBytes(compressed);
    if (!decompressed.ok) return decompressed;
    const text = decodeUtf8(decompressed.value);
    if (!text.ok) return text;
    let parsed;
    try {
      parsed = JSON.parse(text.value);
    } catch {
      return { ok: false, code: "invalid-json" };
    }
    const checked = validate(parsed, options);
    if (!checked.ok) return checked;
    return {
      ok: true,
      value: checked.value,
      compressedBytes: compressed.byteLength,
      decompressedBytes: decompressed.value.byteLength,
    };
  }

  function readSetupFragment(url) {
    const href = resolveHref(url);
    let parsed;
    try { parsed = new URL(href); } catch { return null; }
    if (!parsed.hash) return null;
    const params = new URLSearchParams(parsed.hash.slice(1));
    if (!params.has("setup")) return null;
    return params.get("setup");
  }

  function removeSetupFragment(url) {
    const href = resolveHref(url);
    const parsed = new URL(href);
    const params = new URLSearchParams(parsed.hash ? parsed.hash.slice(1) : "");
    params.delete("setup");
    const nextHash = params.toString();
    return `${parsed.pathname}${parsed.search}${nextHash ? `#${nextHash}` : ""}`;
  }

  function handoffCookiePath(locationLike) {
    const href = typeof locationLike === "string"
      ? locationLike
      : (locationLike && locationLike.href) || resolveHref();
    return new URL("index.html", href).pathname;
  }

  function cookieSecureSuffix(locationLike) {
    return isLocalhostHost(hostnameOf(locationLike)) ? "" : "; Secure";
  }

  function writeHandoffCookie(value, adapters) {
    const doc = adapterDocument(adapters);
    const loc = adapterLocation(adapters);
    if (!doc || !loc) return false;
    const path = handoffCookiePath(loc);
    doc.cookie = `${COOKIE_NAME}=${value}; Path=${path}; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${cookieSecureSuffix(loc)}`;
    return true;
  }

  function readHandoffCookie(adapters) {
    const doc = adapterDocument(adapters);
    if (!doc || typeof doc.cookie !== "string") return null;
    const parts = doc.cookie.split(";");
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const eq = trimmed.indexOf("=");
      const name = eq === -1 ? trimmed : trimmed.slice(0, eq);
      if (name !== COOKIE_NAME) continue;
      return eq === -1 ? "" : trimmed.slice(eq + 1);
    }
    return null;
  }

  function clearHandoffCookie(adapters) {
    const doc = adapterDocument(adapters);
    const loc = adapterLocation(adapters);
    if (!doc || !loc) return false;
    const path = handoffCookiePath(loc);
    doc.cookie = `${COOKIE_NAME}=; Path=${path}; Max-Age=0; SameSite=Lax${cookieSecureSuffix(loc)}`;
    return true;
  }

  const api = {
    KIND,
    VERSION,
    MAX_ENCODED_CHARS,
    MAX_COMPRESSED_BYTES,
    MAX_DECOMPRESSED_BYTES,
    canonicalize,
    validate,
    encode,
    decode,
    readSetupFragment,
    removeSetupFragment,
    handoffCookiePath,
    readHandoffCookie,
    writeHandoffCookie,
    clearHandoffCookie,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeSharedSetup = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
