#!/usr/bin/env node
/**
 * Plan 053 Wave A / P1b independent install-transfer boundary oracle.
 *
 * The boundary/threat/redaction fixtures remain the independent oracle. This
 * test also exercises the dependency-free contract through CommonJS and an
 * isolated classic-browser VM. The service consumer is not present here, so
 * no service parity claim is made.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const textEncoder = new TextEncoder();
const require = createRequire(import.meta.url);
const contract = require(join(ROOT, "install-transfer-contract.js"));
const WorkoutDraft = require(join(ROOT, "workout-draft.js"));
const ProgramEntry = require(join(ROOT, "program-entry.js"));

const browserContext = vm.createContext({
  TextEncoder,
  TextDecoder,
  crypto: webcrypto,
});
vm.runInContext(readFileSync(join(ROOT, "install-transfer-contract.js"), "utf8"), browserContext, {
  filename: "install-transfer-contract.js",
});
const browserContract = browserContext.RepForgeInstallTransferContract;

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(ROOT, relativePath), "utf8"));
}

function browserValue(jsonText) {
  return vm.runInContext(`JSON.parse(${JSON.stringify(jsonText)})`, browserContext);
}

function jsonResult(value) {
  return JSON.stringify(value);
}

function assertResultShape(result, expectedOk, label) {
  assert.equal(result.ok, expectedOk, `${label} result status`);
  assert.deepEqual(Object.keys(result).sort(), expectedOk ? ["ok", "value"] : ["code", "ok"], `${label} result keys`);
  if (!expectedOk) {
    for (const forbidden of ["path", "payload", "input", "message", "details"]) {
      assert.equal(Object.hasOwn(result, forbidden), false, `${label} failure omits ${forbidden}`);
    }
  }
}

function assertParserParity(raw, endpoint, expectedCode = null, label = "parser case") {
  const bytes = raw instanceof Uint8Array ? raw : textEncoder.encode(raw);
  const nodeResult = contract.parseBoundedJson(bytes, endpoint);
  const browserResult = browserContract.parseBoundedJson(bytes, endpoint);
  assert.equal(jsonResult(browserResult), jsonResult(nodeResult), `${label} Node/browser result parity`);
  if (expectedCode === null) {
    assertResultShape(nodeResult, true, label);
    assert.equal(contract.canonicalJson(nodeResult.value), contract.canonicalJson(browserResult.value), `${label} canonical value parity`);
  } else {
    assertResultShape(nodeResult, false, label);
    assert.equal(nodeResult.code, expectedCode, `${label} error code`);
  }
  return nodeResult;
}

function assertValidatorParity(nodeValue, browserValueInput, name) {
  const nodeResult = nodeValue();
  const browserResult = browserValueInput();
  assert.equal(jsonResult(browserResult), jsonResult(nodeResult), `${name} Node/browser result parity`);
  assertResultShape(nodeResult, nodeResult.ok, name);
  return nodeResult;
}

function utf8Bytes(value) {
  if (typeof value === "string") return textEncoder.encode(value).byteLength;
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) return value.byteLength;
  throw new TypeError("utf8 byte measurement accepts only string, Uint8Array, or ArrayBuffer");
}

function chars(value) {
  if (typeof value !== "string") throw new TypeError("character measurement accepts only strings");
  let count = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) throw new RangeError("unpaired high surrogate");
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new RangeError("unpaired low surrogate");
    }
    count += 1;
  }
  return count;
}

function hasOwnKey(value, key) {
  if (value === null || typeof value !== "object") return false;
  if (Object.hasOwn(value, key)) return true;
  if (Array.isArray(value)) return value.some(child => hasOwnKey(child, key));
  return Object.values(value).some(child => hasOwnKey(child, key));
}

function sortedKeys(value) {
  return Object.keys(value).sort();
}

function walk(value, path = "$", depth = 0, result = {
  maxDepth: 0,
  maxArrayItems: 0,
  maxObjectKeys: 0,
  maxStringChars: 0,
  dangerousPaths: [],
  volatilePaths: [],
}) {
  if (value === null || typeof value !== "object") {
    if (typeof value === "string") result.maxStringChars = Math.max(result.maxStringChars, chars(value));
    return result;
  }

  result.maxDepth = Math.max(result.maxDepth, depth);
  if (Array.isArray(value)) {
    result.maxArrayItems = Math.max(result.maxArrayItems, value.length);
    value.forEach((child, index) => walk(child, `${path}[${index}]`, depth + 1, result));
    return result;
  }

  const dangerous = new Set(["__proto__", "constructor", "prototype"]);
  const volatile = new Set([
    "cookies",
    "cookie",
    "locks",
    "tabId",
    "writerId",
    "operationId",
    "notificationPermission",
    "permission",
    "providerSessionId",
  ]);
  const keys = Object.keys(value);
  result.maxObjectKeys = Math.max(result.maxObjectKeys, keys.length);
  for (const key of keys) {
    const childPath = `${path}.${key}`;
    if (dangerous.has(key)) result.dangerousPaths.push(childPath);
    const durableSidecar = path === "$.durableState" &&
      (key === "_storageRevision" || key === "_storageFollowUp" || key === "_storageDraftTransaction" ||
        key === "_storageSetupActivation" || /^repforge_(?:pending|draft_v1:(?:pending|closing|recovery))/.test(key));
    if (volatile.has(key) || durableSidecar || (key === "logicalStateDigest" && path === "$")) {
      result.volatilePaths.push(childPath);
    }
    walk(value[key], childPath, depth + 1, result);
  }
  return result;
}

function nestedContainers(count) {
  const root = {};
  let cursor = root;
  for (let index = 0; index < count; index += 1) {
    cursor.next = {};
    cursor = cursor.next;
  }
  cursor.leaf = true;
  return root;
}

function asciiJsonAtBytes(target) {
  const prefix = '{"value":"';
  const suffix = '"}';
  const fillerLength = target - utf8Bytes(prefix) - utf8Bytes(suffix);
  assert.ok(fillerLength >= 0, "ASCII body target can hold its JSON wrapper");
  return `${prefix}${"A".repeat(fillerLength)}${suffix}`;
}

function serializedLogRowAtChars(target) {
  const row = {
    session: "session",
    date: "2026-09-08",
    day: "Day 1",
    name: "Leg press",
    exerciseId: "exercise-1",
    set: 1,
    load: 120,
    reps: 10,
    rir: 2,
    notes: "",
    created: "2026-09-08T18:00:00.000Z",
    performedName: "Leg press",
    performedLibraryId: "sq_lp",
  };
  const fixedChars = chars(JSON.stringify(row));
  assert.ok(target >= fixedChars, "log-row target can hold its fixed JSON fields");
  row.notes = "A".repeat(target - fixedChars);
  return JSON.stringify(row);
}

function maxContainerDepth(value, depth = 0) {
  if (value === null || typeof value !== "object") return depth - 1;
  if (Array.isArray(value)) return Math.max(depth, ...value.map(child => maxContainerDepth(child, depth + 1)));
  const children = Object.values(value);
  return children.length ? Math.max(depth, ...children.map(child => maxContainerDepth(child, depth + 1))) : depth;
}

function producerDraft() {
  const timestamp = "2026-09-08T18:00:00.000Z";
  const programContext = {
    programId: "program-1",
    programFingerprint: "program-fingerprint-1",
    durableRevision: 7,
    dayId: "day-1",
    dayLabel: "Day 1",
    scheduleDate: "2026-09-08",
    unit: "kg",
    rirMode: "numeric",
    exercises: [{
      exerciseInstanceId: "exercise-1",
      sourceExerciseId: "library:leg_press",
      sets: 1,
      setIds: ["set-1"],
      programmedSets: [{ suggestedLoad: 100, minReps: 8, maxReps: 12, targetRir: 2 }],
      minReps: 8,
      maxReps: 12,
      targetRir: 2,
      notes: "",
      progressionStrategy: null,
      movementPattern: null,
      sourceFingerprint: "source-fingerprint-1",
      primary: "Quads",
      secondary: "Glutes",
      displayName: "Leg press",
      libraryId: "sq_lp",
      setupNotes: "",
    }],
  };
  const sessionSelection = {
    draftId: "draft-1",
    startedAt: timestamp,
    updatedAt: timestamp,
    bodyweight: null,
    notes: "",
    selectedExerciseId: "exercise-1",
    scheduleDate: "2026-09-08",
    contextTouched: { day: false, date: false, sessionNotes: false, bodyweight: false },
    writer: { installationId: "installation-1", tabId: "tab-1", operationId: "operation-1" },
  };
  const created = WorkoutDraft.create(programContext, sessionSelection);
  assert.equal(created.kind, undefined, "WorkoutDraft.create returns a producer draft");
  const logical = WorkoutDraft.logicalCloneSection(created);
  assert.equal(logical.kind, undefined, "WorkoutDraft.logicalCloneSection returns the logical section");
  return logical;
}

function producerEntryDraft() {
  const timestamp = "2026-09-08T18:00:00.000Z";
  const versions = {
    compiler: "compiler-1",
    family: "family-1",
    blueprint: "blueprint-1",
    catalogue: "catalogue-1",
    rules: "rules-1",
    context: "context-1",
    progression: "progression-1",
    recentConsistency: "consistency-1",
    simpleStart: "simple-start-1",
  };
  const initial = ProgramEntry.createState({ draftId: "entry-1", now: timestamp, versions });
  const routed = ProgramEntry.selectRoute(initial, "build");
  const withResult = ProgramEntry.setResult(routed, {
    fingerprint: "candidate-fingerprint",
    preview: {},
    selected: { id: "candidate-1" },
  });
  const normalized = ProgramEntry.normalizeSetupDraft(withResult);
  assert.equal(normalized.ok, true, "ProgramEntry normalizes the producer candidate");
  return normalized.value;
}

function producerProgrammingContext() {
  const normalized = ProgramEntry.normalizeProgrammingContext({
    schemaVersion: 1,
    desiredResult: "muscle_growth",
    structuredExperience: "6_to_24m",
    recentConsistency: "most",
    availability: { daysPerWeek: 3, sessionMinutes: 60, preferredRestSeconds: 120 },
    environment: { kind: "commercial_gym", equipment: ["barbell"] },
    primaryMuscles: ["chest"],
    deEmphasizedMuscles: [],
    ignoredMuscles: [],
    priorityMovements: ["press"],
    exerciseConstraints: [],
    reviewedAt: "2026-09-08T18:00:00.000Z",
  });
  assert.equal(normalized.ok, true, "ProgramEntry normalizes the producer programming context");
  return normalized.value;
}

async function withCanonicalPayloadHash(envelope) {
  const preimage = structuredClone(envelope);
  delete preimage.integrity.canonicalPayloadHash;
  const digest = await webcrypto.subtle.digest("SHA-256", textEncoder.encode(contract.canonicalJson(preimage)));
  let hash = "";
  for (const byte of new Uint8Array(digest)) hash += byte.toString(16).padStart(2, "0");
  const output = structuredClone(envelope);
  output.integrity.canonicalPayloadHash = hash;
  return output;
}

const matrix = readJson("test/fixtures/install-transfer-threats/boundary-matrix.json");
const hostile = readJson("test/fixtures/install-transfer-threats/hostile-inputs.json");
const redaction = readJson("test/fixtures/install-transfer-threats/redaction-cases.json");
const producerCases = readJson("test/fixtures/install-transfer-threats/producer-boundary-cases.json");
const existingClone = readJson("test/fixtures/install-transfer-clone-v1.json");
const existingKeys = [
  "analytics",
  "createdAt",
  "durableState",
  "integrity",
  "kind",
  "programEntryDraft",
  "schemaVersion",
  "source",
  "sourceRevision",
  "telemetryIdentity",
  "uiPreferences",
  "workoutDraft",
];

console.log("Plan 053 install-transfer limits/threat fixtures");

assert.equal(matrix.contract, "taurifer-install-transfer");
assert.equal(matrix.schemaVersion, 1);
assert.equal(matrix.matrixVersion, 1);
assert.equal(matrix.status, "independent-wave-a-design");

console.log("  boundary matrix covers every ADR 0013 row");
const expectedRows = new Map([
  ["request-body-create-bytes", ["Request body (create)", "utf8-bytes", 2000000]],
  ["request-body-small-endpoint-bytes", ["Request body (claim/commit/status)", "utf8-bytes", 4096]],
  ["envelope-total-json-bytes", ["Envelope total JSON size", "utf8-bytes", 2000000]],
  ["nesting-depth", ["Nesting depth", "container-levels", 64]],
  ["object-keys-per-object", ["Object keys per object", "own-key-count", 256]],
  ["array-items-per-array", ["Array items per array", "item-count", 10000]],
  ["string-value-length", ["String value length", "unicode-scalar-values", 8000]],
  ["identifier-key-length", ["Identifier/key length", "unicode-scalar-values", 256]],
  ["durable-state-log-rows", ["durableState.log rows", "row-count", 200000]],
  ["durable-state-program-rows", ["durableState.program rows", "row-count", 2000]],
  ["durable-state-program-history-entries", ["durableState.programHistory entries", "entry-count", 2000]],
  ["durable-state-custom-exercises", ["durableState.customExercises", "entry-count", 1000]],
  ["serialized-log-row-size", ["Serialized log row size", "unicode-scalar-values", 8000]],
  ["claims-per-token", ["Claims per token", "claim-count", 1]],
  ["claim-id-length", ["Claim ID length", "base64url-chars-and-entropy-bits", 43]],
  ["create-rate-per-ip", ["Create rate", "requests-per-minute", 5]],
  ["claim-commit-status-rate-per-token", ["Claim/commit/status rate", "requests-per-minute", 60]],
]);
assert.equal(matrix.limits.length, expectedRows.size, "ADR row count is exact");
assert.equal(new Set(matrix.limits.map(row => row.id)).size, matrix.limits.length, "boundary IDs are unique");
for (const [id, [adrBoundary, measurement, max]] of expectedRows) {
  const row = matrix.limits.find(candidate => candidate.id === id);
  assert.ok(row, `matrix contains ${id}`);
  assert.equal(row.adrBoundary, adrBoundary, `${id} keeps ADR boundary wording`);
  assert.equal(row.measurement, measurement, `${id} has an explicit measurement`);
  assert.equal(row.max, max, `${id} keeps the ADR maximum`);
  assert.equal(row.inclusive, true, `${id} is inclusive at its exact limit`);
  assert.equal(typeof row.failureClass, "string");
}
const claimIdLimit = matrix.limits.find(row => row.id === "claim-id-length");
assert.equal(claimIdLimit.min, 22, "claim ID lower bound is 22 unpadded base64url characters");
assert.equal(claimIdLimit.entropyBitsMin, 128, "claim ID lower entropy bound is 128 bits");
assert.equal(claimIdLimit.entropyBitsMax, 256, "claim ID upper entropy bound is 256 bits");

assert.deepEqual(matrix.measurement.utf8Bytes, {
  unit: "utf8-bytes",
  algorithm: "TextEncoder().encode(raw).byteLength",
  scope: "Raw request bytes, before JSON parsing or allocation. Count every byte, including JSON whitespace and delimiters.",
  normalization: "none",
  rejectBeforeParse: true,
}, "request/envelope measurement is raw UTF-8 bytes");
assert.deepEqual(matrix.measurement.chars, {
  unit: "unicode-scalar-values",
  algorithm: "Count Unicode scalar values after rejecting every lone UTF-16 surrogate",
  scope: "String values, identifier/key values, and serialized log-row JSON.",
  normalization: "none",
  notUtf8Bytes: true,
  notUtf16CodeUnits: true,
  rejectUnpairedSurrogates: true,
}, "character measurement is explicit and Unicode-safe");
assert.equal(matrix.measurement.depth.rootDepth, 0);
assert.equal(matrix.measurement.depth.rejectDuringParse, true);
assert.deepEqual(matrix.inputContracts, {
  measureUtf8Bytes: { acceptedTypes: ["string", "Uint8Array", "ArrayBuffer"], coercion: "none" },
  measureChars: { acceptedTypes: ["string"], coercion: "none" },
  parseBoundedJson: {
    acceptedTypes: ["Uint8Array", "ArrayBuffer"],
    coercion: "none",
    order: ["byte-length", "fatal-utf8-decode", "bounded-json-parse"],
  },
}, "byte/parser input types and parse order are pinned");
assert.deepEqual(matrix.resultContract, {
  success: { allowedKeys: ["ok", "value"] },
  failure: { allowedKeys: ["ok", "code"] },
  failureCode: "fixed-code-enum",
  forbiddenFailureKeys: ["value", "path", "payload", "input", "message", "details"],
}, "validator result shape is fixed and redaction-safe");

console.log("  UTF-8 byte and Unicode-scalar cases distinguish units");
assert.equal(utf8Bytes("😀"), 4, "astral sample uses four UTF-8 bytes");
assert.equal(utf8Bytes(Uint8Array.of(0x7b, 0x7d)), 2, "Uint8Array.of(0x7b, 0x7d) is 2 bytes, never 7 from String()");
assert.equal(utf8Bytes(Uint8Array.of(0x7b, 0x7d).buffer), 2, "ArrayBuffer input counts its byteLength");
assert.throws(() => utf8Bytes(42), TypeError, "byte measurement rejects implicit coercion");
assert.equal(chars("😀"), 1, "astral sample counts as one character");
assert.equal("😀".length, 2, "test demonstrates why UTF-16 length is not the contract");
const eightThousandAstrals = "😀".repeat(8000);
assert.equal(chars(eightThousandAstrals), 8000, "8,000 astral characters are at the string limit");
assert.equal(utf8Bytes(eightThousandAstrals), 32000, "character-limit sample remains byte-distinct");
assert.equal(chars(`${eightThousandAstrals}a`), 8001, "one Unicode scalar over the string limit is visible");
assert.equal(chars("e\u0301"), 2, "combining marks are counted without normalization");
assert.throws(() => chars(42), TypeError, "character measurement rejects implicit coercion");
assert.throws(() => chars("\ud800"), RangeError, "lone high surrogates are rejected");
assert.throws(() => chars("\udfff"), RangeError, "lone low surrogates are rejected");

console.log("  implemented measurement and canonical serializer are strict and shared");
assert.equal(contract.measureUtf8Bytes(Uint8Array.of(0x7b, 0x7d)), 2, "module byte measurement keeps raw bytes");
assert.equal(contract.measureUtf8Bytes(Uint8Array.of(0x7b, 0x7d).buffer), 2, "module ArrayBuffer measurement keeps raw bytes");
assert.equal(contract.measureUtf8Bytes("😀"), 4, "module string measurement uses UTF-8 bytes");
assert.throws(() => contract.measureUtf8Bytes(42), TypeError, "module byte measurement rejects coercion");
assert.throws(() => contract.measureUtf8Bytes({ [Symbol.toStringTag]: "Uint8Array", byteLength: 2 }), TypeError, "module byte measurement rejects spoofed typed arrays");
assert.equal(contract.measureChars("😀"), 1, "module character measurement counts Unicode scalars");
assert.throws(() => contract.measureChars(42), TypeError, "module character measurement rejects coercion");
assert.throws(() => contract.measureChars("\ud800"), TypeError, "module character measurement rejects lone surrogates");
assert.equal(browserContract.measureUtf8Bytes(Uint8Array.of(0x7b, 0x7d)), 2, "browser byte measurement keeps raw bytes");
assert.equal(browserContract.measureChars("😀"), 1, "browser character measurement counts Unicode scalars");
assert.equal(
  contract.canonicalJson({ "2": "two", "10": "ten", a: "a" }),
  '{"10":"ten","2":"two","a":"a"}',
  "canonical JSON sorts numeric-looking keys lexicographically rather than through JSON.stringify object ordering",
);
assert.equal(
  browserContract.canonicalJson(browserValue('{"2":"two","10":"ten","a":"a"}')),
  contract.canonicalJson({ "2": "two", "10": "ten", a: "a" }),
  "browser canonical JSON follows the Node serializer",
);
assert.throws(() => contract.canonicalJson({ value: Infinity }), TypeError, "canonical JSON rejects non-finite numbers");
assert.throws(() => contract.canonicalJson({ value: "\ud800" }), TypeError, "canonical JSON rejects lone surrogates");
assert.equal(contract.canonicalJson({ a: 1, b: [true, null, "x"] }), '{"a":1,"b":[true,null,"x"]}');

console.log("  parser depth and generic shape probes are independently constructible");
assert.equal(maxContainerDepth(nestedContainers(64)), 64, "depth-at-limit fixture follows root-depth-zero convention");
assert.equal(maxContainerDepth(nestedContainers(65)), 65, "depth-over-limit fixture is one level deeper");
const keysAtLimit = Object.fromEntries(Array.from({ length: 256 }, (_, index) => [`k${index}`, index]));
const keysOverLimit = Object.fromEntries(Array.from({ length: 257 }, (_, index) => [`k${index}`, index]));
assert.equal(Object.keys(keysAtLimit).length, 256);
assert.equal(Object.keys(keysOverLimit).length, 257);
assert.equal(Array.from({ length: 10000 }).length, 10000);
assert.equal(Array.from({ length: 10001 }).length, 10001);
assert.equal(utf8Bytes(asciiJsonAtBytes(2000000)), 2000000, "create body can be constructed at exactly 2,000,000 UTF-8 bytes");
assert.equal(utf8Bytes(asciiJsonAtBytes(4096)), 4096, "small endpoint body can be constructed at exactly 4,096 UTF-8 bytes");
assert.equal(chars(serializedLogRowAtChars(8000)), 8000, "serialized log row can be constructed at exactly 8,000 characters");
assert.equal(chars(serializedLogRowAtChars(8001)), 8001, "serialized log row can be constructed one character over the limit");
assert.equal(chars("A".repeat(22)), 22, "claim IDs include the 22-character lower edge");
assert.equal(chars("A".repeat(43)), 43, "claim IDs include the 43-character upper edge");

console.log("  bounded parser enforces raw-byte order and every generic limit");
const createAtBodyLimit = assertParserParity(asciiJsonAtBytes(2_000_000), contract.ENDPOINTS.create, contract.ERROR_CODES.STRING_TOO_LONG, "create body at byte limit");
assert.notEqual(createAtBodyLimit.code, contract.ERROR_CODES.BODY_TOO_LARGE, "create body at limit passes the byte gate even when synthetic content hits a nested bound");
assertParserParity(asciiJsonAtBytes(2_000_001), contract.ENDPOINTS.create, contract.ERROR_CODES.BODY_TOO_LARGE, "create body over byte limit");
assertParserParity(asciiJsonAtBytes(4_096), contract.ENDPOINTS.status, null, "small endpoint body at byte limit");
assertParserParity(asciiJsonAtBytes(4_097), contract.ENDPOINTS.status, contract.ERROR_CODES.BODY_TOO_LARGE, "small endpoint body over byte limit");
const envelopeAtBodyLimit = assertParserParity(asciiJsonAtBytes(2_000_000), contract.ENDPOINTS.envelope, contract.ERROR_CODES.STRING_TOO_LONG, "envelope at byte limit");
assert.notEqual(envelopeAtBodyLimit.code, contract.ERROR_CODES.ENVELOPE_TOO_LARGE, "envelope at limit passes the byte gate");
assertParserParity(asciiJsonAtBytes(2_000_001), contract.ENDPOINTS.envelope, contract.ERROR_CODES.ENVELOPE_TOO_LARGE, "envelope over byte limit");
assert.equal(
  contract.LIMITS.claimResponseBytes,
  contract.LIMITS.envelopeBytes + contract.LIMITS.requestBodySmallEndpointBytes,
  "claim response bound is the logical envelope plus the approved small wrapper headroom",
);
assert.equal(
  contract.parseBoundedJson(
    new Uint8Array(contract.LIMITS.claimResponseBytes + 1),
    contract.ENDPOINTS.envelope,
    "claim-response",
  ).code,
  contract.ERROR_CODES.RESPONSE_TOO_LARGE,
  "claim response rejects one byte over its bounded wrapper",
);
assertParserParity(JSON.stringify(nestedContainers(64)), contract.ENDPOINTS.envelope, null, "depth at 64");
assertParserParity(JSON.stringify(nestedContainers(65)), contract.ENDPOINTS.envelope, contract.ERROR_CODES.DEPTH_TOO_LARGE, "depth at 65");
assertParserParity(JSON.stringify(keysAtLimit), contract.ENDPOINTS.envelope, null, "object keys at 256");
assertParserParity(JSON.stringify(keysOverLimit), contract.ENDPOINTS.envelope, contract.ERROR_CODES.OBJECT_TOO_WIDE, "object keys at 257");
assertParserParity(JSON.stringify(Array.from({ length: 10_000 }, () => 0)), contract.ENDPOINTS.envelope, null, "array items at 10,000");
assertParserParity(JSON.stringify(Array.from({ length: 10_001 }, () => 0)), contract.ENDPOINTS.envelope, contract.ERROR_CODES.ARRAY_TOO_LARGE, "array items at 10,001");
assertParserParity(JSON.stringify({ value: "A".repeat(8_000) }), contract.ENDPOINTS.envelope, null, "string scalars at 8,000");
assertParserParity(JSON.stringify({ value: "A".repeat(8_001) }), contract.ENDPOINTS.envelope, contract.ERROR_CODES.STRING_TOO_LONG, "string scalars at 8,001");
assertParserParity(JSON.stringify({ ["A".repeat(256)]: 1 }), contract.ENDPOINTS.envelope, null, "identifier key at 256");
assertParserParity(JSON.stringify({ ["A".repeat(257)]: 1 }), contract.ENDPOINTS.envelope, contract.ERROR_CODES.IDENTIFIER_TOO_LONG, "identifier key at 257");
assertParserParity(JSON.stringify({ durableState: { log: Array.from({ length: 10_000 }, () => null) } }), contract.ENDPOINTS.envelope, null, "generic log array at 10,000");
assertParserParity(JSON.stringify({ durableState: { log: Array.from({ length: 10_001 }, () => null) } }), contract.ENDPOINTS.envelope, contract.ERROR_CODES.ARRAY_TOO_LARGE, "generic log array at 10,001");
assertParserParity('{"a":1,"\\u0061":2}', contract.ENDPOINTS.envelope, contract.ERROR_CODES.DUPLICATE_KEY, "escaped duplicate key");
assertParserParity('{"\\u005f\\u005fproto__":1}', contract.ENDPOINTS.envelope, contract.ERROR_CODES.DANGEROUS_KEY, "escaped dangerous key");
assertParserParity("{}{}", contract.ENDPOINTS.envelope, contract.ERROR_CODES.INVALID_JSON, "trailing JSON data");
assertParserParity("[1,]", contract.ENDPOINTS.envelope, contract.ERROR_CODES.INVALID_JSON, "trailing comma");
assertParserParity("1e400", contract.ENDPOINTS.envelope, contract.ERROR_CODES.INVALID_JSON, "non-finite JSON number");
assertParserParity(JSON.stringify({ value: "\ud800" }), contract.ENDPOINTS.envelope, contract.ERROR_CODES.INVALID_STRING, "escaped unpaired surrogate");
const invalidUtf8Bytes = Uint8Array.from([0x7b, 0x22, 0x6b, 0x22, 0x3a, 0xc2, 0x7d]);
assertParserParity(invalidUtf8Bytes, contract.ENDPOINTS.envelope, contract.ERROR_CODES.INVALID_UTF8, "raw invalid UTF-8");
const rawByteObject = Uint8Array.of(0x7b, 0x7d);
assertParserParity(rawByteObject, contract.ENDPOINTS.envelope, null, "raw byte empty object");
for (const endpoint of Object.values(contract.ENDPOINTS)) {
  assert.equal(contract.parseBoundedJson("{}", endpoint).ok, false, `${endpoint} rejects non-byte input without coercion`);
  assert.equal(contract.parseBoundedJson("{}", endpoint).code, contract.ERROR_CODES.INVALID_INPUT);
}
assert.equal(contract.parseBoundedJson(new Uint8Array(), "/unknown").code, contract.ERROR_CODES.INVALID_ENDPOINT);

console.log("  every boundary has an exact/over-limit probe");
const probesByLimit = new Map();
for (const probe of hostile.boundaryProbes) {
  assert.equal(typeof probe.id, "string");
  assert.ok(expectedRows.has(probe.limitId), `${probe.id} references an ADR row`);
  assert.equal(typeof probe.target, "number", `${probe.id} records an exact target`);
  assert.ok([
    "accept",
    "accept-if-random",
    "parse-gate-accepted",
    "protocol-gate-accepted",
    "size-gate-accepted",
    "reject-array-too-large",
  ].includes(probe.expectedAtTarget), `${probe.id} records an exact-target outcome`);
  assert.equal(typeof probe.expectedAtTargetPlusOne, "string", `${probe.id} records a +1 outcome`);
  assert.equal(typeof probe.expectedCode, "string", `${probe.id} records a expected stable error code`);
  if (!probesByLimit.has(probe.limitId)) probesByLimit.set(probe.limitId, []);
  probesByLimit.get(probe.limitId).push(probe);
}
for (const id of expectedRows.keys()) assert.ok(probesByLimit.has(id), `boundary ${id} has a probe`);
assert.equal(hostile.boundaryProbes.find(probe => probe.id === "log-rows-at-generic-array-limit").expectedAtTargetPlusOne, "reject-array-too-large");
assert.equal(hostile.boundaryProbes.find(probe => probe.id === "log-rows-at-specialized-limit").expectedAtTarget, "reject-array-too-large");
assert.equal(hostile.boundaryProbes.find(probe => probe.id === "log-rows-at-specialized-limit").expectedAtTargetPlusOne, "reject-array-too-large");

console.log("  hostile parser/version/key cases are explicit");
assert.ok(hostile.cases.length >= 10);
const hostileIds = hostile.cases.map(testCase => testCase.id);
assert.equal(new Set(hostileIds).size, hostileIds.length, "hostile case IDs are unique");
for (const testCase of hostile.cases) {
  assert.equal(typeof testCase.id, "string");
  assert.equal(typeof testCase.kind, "string");
  assert.equal(typeof testCase.expected, "string");
  assert.equal(typeof testCase.expectedCode, "string");
}
const dangerousCases = hostile.cases.filter(testCase => testCase.dangerousKey);
assert.deepEqual(new Set(dangerousCases.map(testCase => testCase.dangerousKey)), new Set(["__proto__", "constructor", "prototype"]));
for (const testCase of dangerousCases) {
  const parsed = JSON.parse(testCase.raw);
  assert.ok(hasOwnKey(parsed, testCase.dangerousKey), `${testCase.id} preserves its own dangerous key for the validator to reject`);
  assert.equal({}.polluted, undefined, `${testCase.id} does not pollute Object.prototype during fixture parsing`);
}
const malformed = hostile.cases.find(testCase => testCase.id === "malformed-json");
assert.throws(() => JSON.parse(malformed.raw), SyntaxError, "malformed JSON is rejected before validation");
const invalidUtf8 = hostile.cases.find(testCase => testCase.id === "invalid-utf8-bytes");
assert.deepEqual(invalidUtf8.parseOrder, ["byte-length", "fatal-utf8-decode", "bounded-json-parse"], "raw-byte parsing checks size before fatal UTF-8 decoding and bounded parsing");
assert.throws(() => new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(invalidUtf8.bytes)), TypeError, "invalid UTF-8 is rejected before JSON parsing");
const rawByteEmptyObject = hostile.cases.find(testCase => testCase.id === "raw-byte-empty-object");
assert.equal(utf8Bytes(Uint8Array.from(rawByteEmptyObject.bytes)), rawByteEmptyObject.byteLength, "raw-byte fixture keeps Uint8Array byte length exact");
const escapedSurrogate = hostile.cases.find(testCase => testCase.id === "escaped-unpaired-high-surrogate");
const escapedValue = JSON.parse(escapedSurrogate.raw).value;
assert.equal(escapedValue.length, 1, "escaped lone surrogate remains a single UTF-16 code unit after JSON parsing");
assert.throws(() => chars(escapedValue), RangeError, "escaped lone surrogate fails Unicode-scalar measurement");
for (const id of ["unknown-top-level-schema-version", "unknown-top-level-schema-version-zero", "unknown-workout-draft-version", "unknown-required-section-version", "unknown-programming-context-version", "unknown-draft-nested-version", "unknown-entry-preview-version"]) {
  const testCase = hostile.cases.find(candidate => candidate.id === id);
  assert.equal(testCase.expected, "reject-without-local-mutation", `${id} fails closed without local mutation`);
}
assert.equal(hostile.cases.find(testCase => testCase.id === "unknown-optional-section").expected, "reject-without-local-mutation");
assert.equal(hostile.cases.find(testCase => testCase.id === "unknown-optional-section").expectedCode, "unknown-section");
const duplicateKey = hostile.cases.find(testCase => testCase.id === "duplicate-key");
assert.equal(duplicateKey.expected, "reject-without-local-mutation");
assert.equal(duplicateKey.expectedCode, "duplicate-key");
assert.equal([...duplicateKey.raw.matchAll(/"kind"/g)].length, 2, "duplicate-key fixture contains both repeated names");

console.log("  implemented parser and envelope validator reject hostile fixture cases without leaking input");
const parsedMalformed = contract.parseBoundedJson(textEncoder.encode(malformed.raw), contract.ENDPOINTS.envelope);
assertResultShape(parsedMalformed, false, "malformed JSON");
assert.equal(parsedMalformed.code, contract.ERROR_CODES.INVALID_JSON);
const parsedScalar = contract.parseBoundedJson(textEncoder.encode("null"), contract.ENDPOINTS.envelope);
assertResultShape(parsedScalar, true, "scalar JSON parse");
assert.equal(contract.validateEnvelope(parsedScalar.value).code, contract.ERROR_CODES.INVALID_ENVELOPE, "scalar root fails envelope shape");
for (const [schemaValue, expectedCode, label] of [
  [2, contract.ERROR_CODES.UNSUPPORTED_SCHEMA_VERSION, "unknown top-level schema version"],
  [0, contract.ERROR_CODES.UNSUPPORTED_SCHEMA_VERSION, "zero top-level schema version"],
  ["1", contract.ERROR_CODES.INVALID_SCHEMA_VERSION, "string top-level schema version"],
]) {
  const candidate = structuredClone(existingClone);
  candidate.schemaVersion = schemaValue;
  const result = contract.validateEnvelope(candidate);
  assertResultShape(result, false, label);
  assert.equal(result.code, expectedCode, `${label} stable code`);
}
const unknownWorkout = structuredClone(existingClone);
unknownWorkout.workoutDraft = { schemaVersion: 3 };
assert.equal(contract.validateEnvelope(unknownWorkout).code, contract.ERROR_CODES.UNSUPPORTED_WORKOUT_DRAFT_VERSION);
const unknownEntry = structuredClone(existingClone);
unknownEntry.programEntryDraft = { schemaVersion: 2 };
assert.equal(contract.validateEnvelope(unknownEntry).code, contract.ERROR_CODES.UNSUPPORTED_PROGRAM_ENTRY_DRAFT_VERSION);
const unknownSection = structuredClone(existingClone);
unknownSection.futureSection = { schemaVersion: 1 };
assert.equal(contract.validateEnvelope(unknownSection).code, contract.ERROR_CODES.UNKNOWN_SECTION);
const digestOnWire = structuredClone(existingClone);
digestOnWire.logicalStateDigest = "source-local-only";
assert.equal(contract.validateEnvelope(digestOnWire).code, contract.ERROR_CODES.FORBIDDEN_FIELD);
const digestInIntegrity = structuredClone(existingClone);
digestInIntegrity.integrity.logicalStateDigest = "source-local-only";
assert.equal(contract.validateEnvelope(digestInIntegrity).code, contract.ERROR_CODES.FORBIDDEN_FIELD);
for (const volatileKey of [
  "_storageRevision",
  "_storageFollowUp",
  "_storageDraftTransaction",
  "_storageSetupActivation",
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
  "repforge_pending_v1:fixture",
  "repforge_draft_v1:pending:fixture",
]) {
  const candidate = structuredClone(existingClone);
  candidate.durableState[volatileKey] = true;
  assert.equal(contract.validateEnvelope(candidate).code, contract.ERROR_CODES.FORBIDDEN_FIELD, `${volatileKey} is excluded from the wire clone`);
}
for (const logicalKey of ["pending", "closing", "sessionId", "logicalStateDigest"]) {
  const candidate = structuredClone(existingClone);
  candidate.durableState[logicalKey] = logicalKey === "logicalStateDigest" ? "source-local-logical-field" : "logical-value";
  assertResultShape(contract.validateEnvelope(candidate), true, `${logicalKey} remains available to logical state`);
}
for (const sidecarKey of ["repforge_pending_v1:fixture", "_storageDraftTransaction"]) {
  const candidate = structuredClone(existingClone);
  candidate.durableState[sidecarKey] = true;
  assert.equal(contract.validateEnvelope(candidate).code, contract.ERROR_CODES.FORBIDDEN_FIELD, `${sidecarKey} sidecar is excluded from the wire clone`);
}
const writerInDraft = structuredClone(existingClone);
writerInDraft.workoutDraft = { schemaVersion: 2, draftId: "d", program: {}, session: {}, exerciseOrder: [], exercises: {}, writer: {} };
assert.equal(contract.validateEnvelope(writerInDraft).code, contract.ERROR_CODES.FORBIDDEN_FIELD);
const revisionInDraft = structuredClone(existingClone);
revisionInDraft.workoutDraft = { schemaVersion: 2, draftId: "d", program: { durableRevision: 1 }, session: {}, exerciseOrder: [], exercises: {} };
assert.equal(contract.validateEnvelope(revisionInDraft).code, contract.ERROR_CODES.FORBIDDEN_FIELD);
const wrapperEntry = structuredClone(existingClone);
wrapperEntry.programEntryDraft = { schemaVersion: 1, ownerId: null, state: {} };
assert.equal(contract.validateEnvelope(wrapperEntry).code, contract.ERROR_CODES.FORBIDDEN_FIELD);
for (const testCase of dangerousCases) {
  const result = contract.parseBoundedJson(textEncoder.encode(testCase.raw), contract.ENDPOINTS.envelope);
  assertResultShape(result, false, testCase.id);
  assert.equal(result.code, contract.ERROR_CODES.DANGEROUS_KEY, `${testCase.id} stable code`);
}
assert.equal(contract.parseBoundedJson(textEncoder.encode(duplicateKey.raw), contract.ENDPOINTS.envelope).code, contract.ERROR_CODES.DUPLICATE_KEY);
assert.equal(contract.parseBoundedJson(textEncoder.encode(escapedSurrogate.raw), contract.ENDPOINTS.envelope).code, contract.ERROR_CODES.INVALID_STRING);
assert.equal(contract.parseBoundedJson(Uint8Array.from(invalidUtf8.bytes), contract.ENDPOINTS.envelope).code, contract.ERROR_CODES.INVALID_UTF8);
const validEnvelope = contract.validateEnvelope(existingClone);
assertResultShape(validEnvelope, true, "existing envelope");
assert.deepEqual(sortedKeys(validEnvelope.value), existingKeys, "valid envelope output preserves all twelve top-level fields");
assert.notStrictEqual(validEnvelope.value, existingClone, "valid envelope output is a separate value");
const integrityResult = await contract.validateEnvelopeIntegrity(existingClone, webcrypto);
assertResultShape(integrityResult, true, "existing envelope integrity");
const browserEnvelope = browserValue(JSON.stringify(existingClone));
const browserEnvelopeResult = browserContract.validateEnvelope(browserEnvelope);
assert.equal(jsonResult(browserEnvelopeResult), jsonResult(validEnvelope), "browser and Node envelope validation agree");
const browserIntegrityResult = await browserContract.validateEnvelopeIntegrity(browserEnvelope, webcrypto);
assert.equal(jsonResult(browserIntegrityResult), jsonResult(integrityResult), "browser and Node integrity validation agree");
const tamperedEnvelope = structuredClone(existingClone);
tamperedEnvelope.durableState.settings.lang = "pt";
const tamperedIntegrity = await contract.validateEnvelopeIntegrity(tamperedEnvelope, webcrypto);
assertResultShape(tamperedIntegrity, false, "tampered envelope integrity");
assert.equal(tamperedIntegrity.code, contract.ERROR_CODES.INTEGRITY_MISMATCH);

console.log("  actual P1a-shaped envelope and producer modules prove both consumers");
assert.equal(producerCases.status, "independent-wave-a-design");
assert.equal(producerCases.producerSources.workoutDraft.includes("logicalCloneSection"), true);
assert.equal(producerCases.producerSources.programEntryDraft.includes("normalizeSetupDraft"), true);
assert.equal(new Set(producerCases.negativeCases.map(testCase => testCase.id)).size, producerCases.negativeCases.length, "producer boundary case IDs are unique");
for (const testCase of producerCases.negativeCases) {
  assert.equal(typeof testCase.path, "string", `${testCase.id} records a concrete path`);
  assert.equal(typeof testCase.expected, "string", `${testCase.id} records an expected outcome`);
}
const producerDraftValue = producerDraft();
const producerCandidateValue = producerEntryDraft();
const producerContextValue = producerProgrammingContext();
const producerEnvelopeBase = structuredClone(existingClone);
producerEnvelopeBase.workoutDraft = producerDraftValue;
producerEnvelopeBase.programEntryDraft = producerCandidateValue;
producerEnvelopeBase.uiPreferences = {
  importSourceMode: "freeform",
  installBannerDismissedAt: "2026-09-08T18:00:00.000Z",
};
producerEnvelopeBase.durableState.programmingContext = producerContextValue;
const producerEnvelope = await withCanonicalPayloadHash(producerEnvelopeBase);
const producerValidation = contract.validateEnvelope(producerEnvelope);
assertResultShape(producerValidation, true, "producer-shaped envelope");
const producerIntegrity = await contract.validateEnvelopeIntegrity(producerEnvelope, webcrypto);
assertResultShape(producerIntegrity, true, "producer-shaped envelope integrity");
const browserProducerEnvelope = browserValue(JSON.stringify(producerEnvelope));
const browserProducerValidation = browserContract.validateEnvelope(browserProducerEnvelope);
assert.equal(jsonResult(browserProducerValidation), jsonResult(producerValidation), "producer envelope Node/browser parity");
const browserProducerIntegrity = await browserContract.validateEnvelopeIntegrity(browserProducerEnvelope, webcrypto);
assert.equal(jsonResult(browserProducerIntegrity), jsonResult(producerIntegrity), "producer integrity Node/browser parity");
const legacyLogicalDatesBase = structuredClone(producerEnvelope);
legacyLogicalDatesBase.durableState.programMeta.created = "2026-09-07";
legacyLogicalDatesBase.durableState.customExercises[0].created = "2026-09-10";
legacyLogicalDatesBase.workoutDraft.session.startedAt = "2026-09-08";
legacyLogicalDatesBase.workoutDraft.session.updatedAt = "2026-09-08";
const legacyLogicalDates = await withCanonicalPayloadHash(legacyLogicalDatesBase);
const legacyLogicalDatesValidation = contract.validateEnvelope(legacyLogicalDates);
assertResultShape(legacyLogicalDatesValidation, true, "producer legacy logical date strings");
const legacyLogicalDatesIntegrity = await contract.validateEnvelopeIntegrity(legacyLogicalDates, webcrypto);
assertResultShape(legacyLogicalDatesIntegrity, true, "producer legacy logical date integrity");
const browserLegacyLogicalDates = browserValue(JSON.stringify(legacyLogicalDates));
assert.equal(jsonResult(browserContract.validateEnvelope(browserLegacyLogicalDates)), jsonResult(legacyLogicalDatesValidation), "legacy logical date Node/browser parity");
assert.equal(jsonResult(await browserContract.validateEnvelopeIntegrity(browserLegacyLogicalDates, webcrypto)), jsonResult(legacyLogicalDatesIntegrity), "legacy logical date integrity Node/browser parity");
const additiveSettingsVersion = structuredClone(producerEnvelope);
additiveSettingsVersion.durableState.settings.schemaVersion = 99;
assertResultShape(contract.validateEnvelope(additiveSettingsVersion), true, "additive logical settings schemaVersion");
const opaqueCandidateVersion = structuredClone(producerEnvelope);
opaqueCandidateVersion.programEntryDraft.versions.context = "999";
assertResultShape(contract.validateEnvelope(opaqueCandidateVersion), true, "opaque candidate context version pin");
for (const preferenceCase of producerCases.uiPreferences) {
  const candidate = structuredClone(producerEnvelope);
  candidate.uiPreferences = preferenceCase.value;
  const result = contract.validateEnvelope(candidate);
  if (preferenceCase.expected === "accept") assertResultShape(result, true, preferenceCase.id);
  else assertResultShape(result, false, preferenceCase.id);
}
for (const [name, preference] of [
  ["arbitrary-pref-date", { installBannerDismissedAt: "2026-09-08" }],
  ["arbitrary-pref-string", { coachLabel: "not-a-date" }],
  ["arbitrary-pref-number", { reminderMinutes: 30 }],
]) {
  const preferenceEnvelope = structuredClone(producerEnvelope);
  preferenceEnvelope.uiPreferences = preference;
  const recomputedPreferenceEnvelope = await withCanonicalPayloadHash(preferenceEnvelope);
  const preferenceValidation = contract.validateEnvelope(recomputedPreferenceEnvelope);
  assertResultShape(preferenceValidation, true, `${name} recomputed hash validation`);
  const preferenceIntegrity = await contract.validateEnvelopeIntegrity(recomputedPreferenceEnvelope, webcrypto);
  assertResultShape(preferenceIntegrity, true, `${name} recomputed hash integrity`);
  assert.deepEqual(preferenceValidation.value.uiPreferences, preference, `${name} preserves preference value`);
  assert.deepEqual(preferenceIntegrity.value.uiPreferences, preference, `${name} integrity preserves preference value`);
}
for (const createdAt of ["2026-08-01", "2026-08-01T10:00:00-05:00"]) {
  const identityEnvelope = structuredClone(producerEnvelope);
  identityEnvelope.telemetryIdentity.createdAt = createdAt;
  const recomputedIdentityEnvelope = await withCanonicalPayloadHash(identityEnvelope);
  const identityValidation = contract.validateEnvelope(recomputedIdentityEnvelope);
  assertResultShape(identityValidation, true, `telemetry identity ${createdAt} recomputed hash validation`);
  const identityIntegrity = await contract.validateEnvelopeIntegrity(recomputedIdentityEnvelope, webcrypto);
  assertResultShape(identityIntegrity, true, `telemetry identity ${createdAt} recomputed hash integrity`);
  assert.equal(identityValidation.value.telemetryIdentity.createdAt, createdAt, `telemetry identity ${createdAt} preserves source value`);
  assert.equal(identityIntegrity.value.telemetryIdentity.createdAt, createdAt, `telemetry identity ${createdAt} integrity preserves source value`);
}
const invalidIdentityEnvelopeBase = structuredClone(producerEnvelope);
invalidIdentityEnvelopeBase.telemetryIdentity.createdAt = "not-a-date";
const invalidIdentityEnvelope = await withCanonicalPayloadHash(invalidIdentityEnvelopeBase);
const invalidIdentityValidation = contract.validateEnvelope(invalidIdentityEnvelope);
assertResultShape(invalidIdentityValidation, false, "invalid telemetry identity recomputed hash validation");
assert.equal(invalidIdentityValidation.code, contract.ERROR_CODES.INVALID_ENVELOPE);
const invalidIdentityIntegrity = await contract.validateEnvelopeIntegrity(invalidIdentityEnvelope, webcrypto);
assertResultShape(invalidIdentityIntegrity, false, "invalid telemetry identity recomputed hash integrity");
assert.equal(invalidIdentityIntegrity.code, contract.ERROR_CODES.INVALID_ENVELOPE);
const emptyEntryState = ProgramEntry.createState({
  draftId: "entry-empty-1",
  now: "2026-09-08T18:00:00.000Z",
  versions: {
    compiler: "compiler-1", family: "family-1", blueprint: "blueprint-1", catalogue: "catalogue-1",
    rules: "rules-1", context: "context-1", progression: "progression-1", recentConsistency: "consistency-1", simpleStart: "simple-start-1",
  },
});
const emptyEntry = ProgramEntry.normalizeSetupDraft(emptyEntryState);
assert.equal(emptyEntry.ok, true, "real producer candidate with null result normalizes");
const nullResultEnvelope = structuredClone(producerEnvelope);
nullResultEnvelope.programEntryDraft = emptyEntry.value;
assertResultShape(contract.validateEnvelope(nullResultEnvelope), true, "candidate null result is an explicit valid state");

const nullLogRow = structuredClone(producerEnvelope);
nullLogRow.durableState.log[0] = null;
assertResultShape(contract.validateEnvelope(nullLogRow), false, "null durable log row");
const nullDraftExercise = structuredClone(producerEnvelope);
nullDraftExercise.workoutDraft.exercises["exercise-1"] = null;
assertResultShape(contract.validateEnvelope(nullDraftExercise), false, "null DraftV2 exercise row");
const unsupportedContext = structuredClone(producerEnvelope);
unsupportedContext.durableState.programmingContext.schemaVersion = 2;
assert.equal(contract.validateEnvelope(unsupportedContext).code, contract.ERROR_CODES.UNSUPPORTED_SCHEMA_VERSION);
const unsupportedDraftNested = structuredClone(producerEnvelope);
unsupportedDraftNested.workoutDraft.program.schemaVersion = 99;
assert.equal(contract.validateEnvelope(unsupportedDraftNested).code, contract.ERROR_CODES.UNSUPPORTED_SCHEMA_VERSION);
const unsupportedCandidateNested = structuredClone(producerEnvelope);
unsupportedCandidateNested.programEntryDraft.result.preview.programStructure = { schemaVersion: 2 };
assert.equal(contract.validateEnvelope(unsupportedCandidateNested).code, contract.ERROR_CODES.UNSUPPORTED_SCHEMA_VERSION);
const unsupportedDurableStructure = structuredClone(producerEnvelope);
unsupportedDurableStructure.durableState.programMeta.programStructure.schemaVersion = 99;
assert.equal(contract.validateEnvelope(unsupportedDurableStructure).code, contract.ERROR_CODES.UNSUPPORTED_SCHEMA_VERSION);
const longDraftIdentity = structuredClone(producerEnvelope);
longDraftIdentity.workoutDraft.exerciseOrder[0] = "x".repeat(257);
assert.equal(contract.validateEnvelope(longDraftIdentity).code, contract.ERROR_CODES.IDENTIFIER_TOO_LONG);
const longFreeText = structuredClone(producerEnvelope);
longFreeText.durableState.programMeta.name = "A".repeat(257);
assertResultShape(contract.validateEnvelope(longFreeText), true, "free text is not capped by identifier limit");
const logicalSession = structuredClone(producerEnvelope);
logicalSession.durableState.log[0].sessionId = "logical-session-1";
assertResultShape(contract.validateEnvelope(logicalSession), true, "logical session identity is retained");
const providerSession = structuredClone(producerEnvelope);
providerSession.durableState.log[0].posthogSessionId = "provider-session-canary";
assert.equal(contract.validateEnvelope(providerSession).code, contract.ERROR_CODES.FORBIDDEN_FIELD);
const timestampCanary = structuredClone(producerEnvelope);
timestampCanary.createdAt = "2026-09-08 18:00:00Z";
assertResultShape(contract.validateEnvelope(timestampCanary), false, "strict UTC envelope timestamp");
for (const [path, mutate] of [
  ["durableState.programmingContext.reviewedAt", value => { value.durableState.programmingContext.reviewedAt = "2026-09-08"; }],
  ["programEntryDraft.createdAt", value => { value.programEntryDraft.createdAt = "2026-09-08"; }],
]) {
  const candidate = structuredClone(producerEnvelope);
  mutate(candidate);
  assertResultShape(contract.validateEnvelope(candidate), false, `strict UTC protocol timestamp ${path}`);
}

console.log("  redaction cases cover service, static-host, response, telemetry, and errors");
const requiredForbiddenFields = new Set(["token", "claimId", "ciphertext", "envelope", "body", "payload", "fullUrl", "cookie"]);
for (const field of requiredForbiddenFields) assert.ok(redaction.forbiddenFieldNames.includes(field), `redaction matrix names ${field}`);
assert.equal(new Set(redaction.cases.map(testCase => testCase.id)).size, redaction.cases.length, "redaction case IDs are unique");
for (const testCase of redaction.cases) {
  assert.equal(typeof testCase.channel, "string");
  assert.ok(Array.isArray(testCase.mustOmitPaths) && testCase.mustOmitPaths.length > 0, `${testCase.id} has omitted paths`);
  assert.ok(Array.isArray(testCase.mustNotContain) && testCase.mustNotContain.length > 0, `${testCase.id} has inert canaries`);
  const inputText = JSON.stringify(testCase.input);
  for (const canary of testCase.mustNotContain) assert.ok(inputText.includes(canary), `${testCase.id} places each canary at the source boundary`);
  const allowedText = JSON.stringify(testCase.allowedShape);
  for (const canary of testCase.mustNotContain) assert.ok(!allowedText.includes(canary), `${testCase.id} keeps canaries out of the allowed shape`);
}
assert.ok(redaction.cases.some(testCase => testCase.channel === "service-structured-log"));
assert.ok(redaction.cases.some(testCase => testCase.channel === "static-host-access-log"));
assert.ok(redaction.cases.some(testCase => testCase.channel === "client-response-observable"));
assert.ok(redaction.cases.some(testCase => testCase.channel === "telemetry"));
assert.ok(redaction.cases.some(testCase => testCase.channel === "error-tracking"));

console.log("  existing clone fixture remains independently characterized before validator parity checks");
assert.deepEqual(sortedKeys(existingClone), existingKeys, "existing clone fixture has the complete V1 top-level shape");
assert.equal(existingClone.kind, "taurifer-install-transfer");
assert.equal(existingClone.schemaVersion, 1);
assert.equal(existingClone.workoutDraft, null, "existing fixture records confirmed draft absence explicitly");
assert.equal(existingClone.programEntryDraft, null, "existing fixture records confirmed entry-draft absence explicitly");
assert.ok(utf8Bytes(JSON.stringify(existingClone)) <= 2000000, "existing fixture is below envelope byte limit");
const existingWalk = walk(existingClone);
assert.equal(existingWalk.dangerousPaths.length, 0, "existing fixture has no dangerous object keys");
assert.equal(existingWalk.volatilePaths.length, 0, "existing fixture has no excluded volatile fields");
assert.ok(existingWalk.maxDepth <= 64, "existing fixture is below parse depth limit");
assert.ok(existingWalk.maxArrayItems <= 10000, "existing fixture arrays are below generic array limit");
assert.ok(existingWalk.maxObjectKeys <= 256, "existing fixture objects are below key fan-out limit");
assert.ok(existingWalk.maxStringChars <= 8000, "existing fixture strings are below string limit");
assert.ok(existingClone.durableState.log.length <= 200000);
assert.ok(existingClone.durableState.program.length <= 2000);
assert.ok(existingClone.durableState.programHistory.length <= 2000);
assert.ok(existingClone.durableState.customExercises.length <= 1000);
assert.equal(chars(existingClone.integrity.canonicalPayloadHash), 64, "existing fixture carries a lowercase SHA-256-sized hash");
assert.match(existingClone.integrity.canonicalPayloadHash, /^[0-9a-f]{64}$/, "existing fixture hash shape is safe");

console.log("  in-memory envelope bounds, endpoint requests, and diagnostic redaction use the same fixed contract");
for (const [field, limit, code] of [
  ["program", 2_000, contract.ERROR_CODES.PROGRAM_TOO_LARGE],
  ["programHistory", 2_000, contract.ERROR_CODES.PROGRAM_HISTORY_TOO_LARGE],
  ["customExercises", 1_000, contract.ERROR_CODES.CUSTOM_EXERCISES_TOO_LARGE],
]) {
  const atLimit = structuredClone(existingClone);
  atLimit.durableState[field] = Array.from({ length: limit }, () => ({}));
  assertResultShape(contract.validateEnvelope(atLimit), true, `${field} at named limit`);
  const candidate = structuredClone(existingClone);
  candidate.durableState[field] = Array.from({ length: limit + 1 }, () => ({}));
  const result = contract.validateEnvelope(candidate);
  assertResultShape(result, false, `${field} over named limit`);
  assert.equal(result.code, code, `${field} uses its named limit code`);
}
const overGenericLog = structuredClone(existingClone);
const atGenericLog = structuredClone(existingClone);
atGenericLog.durableState.log = Array.from({ length: 10_000 }, () => ({}));
assertResultShape(contract.validateEnvelope(atGenericLog), true, "generic 10,000 log bound");
overGenericLog.durableState.log = Array.from({ length: 10_001 }, () => ({}));
assert.equal(contract.validateEnvelope(overGenericLog).code, contract.ERROR_CODES.ARRAY_TOO_LARGE, "generic 10,001 log bound wins over named 200,000 bound");
const exactSerializedLogRow = structuredClone(existingClone);
exactSerializedLogRow.durableState.log = [JSON.parse(serializedLogRowAtChars(8_000))];
assertResultShape(contract.validateEnvelope(exactSerializedLogRow), true, "serialized log row at 8,000 characters");
const overSerializedLogRow = structuredClone(existingClone);
overSerializedLogRow.durableState.log = [{ notes: "A".repeat(8_000) }];
assert.equal(contract.validateEnvelope(overSerializedLogRow).code, contract.ERROR_CODES.LOG_ROW_TOO_LARGE, "serialized log row bound applies after generic value checks");
assertParserParity(JSON.stringify({ durableState: { log: Array.from({ length: 200_000 }, () => null) } }), contract.ENDPOINTS.envelope, contract.ERROR_CODES.ARRAY_TOO_LARGE, "specialized 200,000 log probe remains conjunctive");

const createRequest = contract.validateRequest({ envelope: existingClone, idempotencyKey: "idempotency-key" }, contract.ENDPOINTS.create);
assertResultShape(createRequest, true, "create request");
assert.deepEqual(sortedKeys(createRequest.value), ["envelope", "idempotencyKey"]);
const claimIdAtMin = "A".repeat(22);
const claimIdAtMax = "A".repeat(43);
assertResultShape(contract.validateClaimId(claimIdAtMin), true, "claim ID at minimum");
assertResultShape(contract.validateClaimId(claimIdAtMax), true, "claim ID at maximum");
for (const invalidClaimId of ["A".repeat(21), "A".repeat(44), "not valid+", "\ud800"]) {
  const result = contract.validateClaimId(invalidClaimId);
  assertResultShape(result, false, "invalid claim ID");
  assert.equal(result.code, contract.ERROR_CODES.CLAIM_ID_INVALID);
}
for (const endpoint of [contract.ENDPOINTS.claims, contract.ENDPOINTS.commit]) {
  const result = contract.validateRequest({ token: "opaque-token", claimId: claimIdAtMin }, endpoint);
  assertResultShape(result, true, `${endpoint} request`);
}
assertResultShape(contract.validateRequest({ token: "opaque-token" }, contract.ENDPOINTS.status), true, "status request");
assert.equal(contract.validateRequest({ token: "opaque-token" }, "/unknown").code, contract.ERROR_CODES.INVALID_ENDPOINT);
assert.equal(contract.validateRequest({ token: "opaque-token", extra: true }, contract.ENDPOINTS.status).code, contract.ERROR_CODES.UNKNOWN_SECTION);
const browserRequest = browserContract.validateRequest(browserValue(JSON.stringify({ envelope: existingClone, idempotencyKey: "idempotency-key" })), contract.ENDPOINTS.create);
assert.equal(jsonResult(browserRequest), jsonResult(createRequest), "browser and Node request validation agree");

for (const testCase of redaction.cases) {
  const result = contract.redactDiagnostic(testCase.input, testCase.channel);
  assertResultShape(result, true, `${testCase.id} redaction`);
  assert.deepEqual(result.value, testCase.allowedShape, `${testCase.id} emits only its allowlisted shape`);
  const serialized = JSON.stringify(result.value);
  for (const canary of testCase.mustNotContain) assert.equal(serialized.includes(canary), false, `${testCase.id} output omits its canaries`);
  const browserResult = browserContract.redactDiagnostic(browserValue(JSON.stringify(testCase.input)), testCase.channel);
  assert.equal(jsonResult(browserResult), jsonResult(result), `${testCase.id} browser/Node redaction parity`);
}
const invalidDiagnostic = contract.redactDiagnostic({ message: "fixture canary" }, "unknown-channel");
assertResultShape(invalidDiagnostic, false, "unknown diagnostic channel");
assert.equal(invalidDiagnostic.code, contract.ERROR_CODES.INVALID_DIAGNOSTIC);
const getterDiagnostic = {};
Object.defineProperty(getterDiagnostic, "operation", {
  enumerable: true,
  get() { throw new Error("diagnostic getter must not run"); },
});
const getterResult = contract.redactDiagnostic(getterDiagnostic, "service-structured-log");
assertResultShape(getterResult, false, producerCases.diagnostics.getter);
assert.equal(getterResult.code, contract.ERROR_CODES.INVALID_DIAGNOSTIC);
const unavailableDiagnostic = contract.redactDiagnostic({ state: "unavailable" }, "client-response-observable");
assertResultShape(unavailableDiagnostic, true, "unavailable response redaction");
assert.deepEqual(unavailableDiagnostic.value, producerCases.diagnostics.unavailable, "unavailable response omits expiry");
const invalidExpiryDiagnostic = contract.redactDiagnostic({ state: "deleted", expiresAt: "expiry-canary" }, "client-response-observable");
assertResultShape(invalidExpiryDiagnostic, false, producerCases.diagnostics.invalidExpiry);
const unavailableExpiryCanary = contract.redactDiagnostic({ state: "unavailable", expiresAt: "expiry-canary" }, "client-response-observable");
assertResultShape(unavailableExpiryCanary, false, "unavailable response rejects arbitrary expiry canary");

console.log("  service parity remains pending until the real service consumer exists");
console.log("pass: independent boundary matrix, hostile cases, redaction fixtures, Node/browser contract parity, and existing-clone characterization");
