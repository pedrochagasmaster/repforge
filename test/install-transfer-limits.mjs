#!/usr/bin/env node
/**
 * Plan 053 Wave A / P1b independent install-transfer boundary oracle.
 *
 * This slice intentionally does not import install-transfer-contract.js: the
 * browser/service loading interface and validators are not pinned yet. It
 * validates the independent boundary/threat/redaction fixtures and safely
 * characterizes the existing logical-clone fixture. Validator parity is
 * reported as planned until real producers and consumers exist.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const textEncoder = new TextEncoder();

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(ROOT, relativePath), "utf8"));
}

function utf8Bytes(value) {
  return textEncoder.encode(String(value)).byteLength;
}

function chars(value) {
  return Array.from(String(value)).length;
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
  ]);
  const keys = Object.keys(value);
  result.maxObjectKeys = Math.max(result.maxObjectKeys, keys.length);
  for (const key of keys) {
    const childPath = `${path}.${key}`;
    if (dangerous.has(key)) result.dangerousPaths.push(childPath);
    if (volatile.has(key) || /^repforge_(?:pending|draft_v1:(?:pending|closing|recovery))/.test(key)) {
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

const matrix = readJson("test/fixtures/install-transfer-threats/boundary-matrix.json");
const hostile = readJson("test/fixtures/install-transfer-threats/hostile-inputs.json");
const redaction = readJson("test/fixtures/install-transfer-threats/redaction-cases.json");
const existingClone = readJson("test/fixtures/install-transfer-clone-v1.json");

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
  algorithm: "Array.from(value).length",
  scope: "String values, identifier/key values, and serialized log-row JSON.",
  normalization: "none",
  notUtf8Bytes: true,
  notUtf16CodeUnits: true,
}, "character measurement is explicit and Unicode-safe");
assert.equal(matrix.measurement.depth.rootDepth, 0);
assert.equal(matrix.measurement.depth.rejectDuringParse, true);

console.log("  UTF-8 byte and Unicode-scalar cases distinguish units");
assert.equal(utf8Bytes("😀"), 4, "astral sample uses four UTF-8 bytes");
assert.equal(chars("😀"), 1, "astral sample counts as one character");
assert.equal("😀".length, 2, "test demonstrates why UTF-16 length is not the contract");
const eightThousandAstrals = "😀".repeat(8000);
assert.equal(chars(eightThousandAstrals), 8000, "8,000 astral characters are at the string limit");
assert.equal(utf8Bytes(eightThousandAstrals), 32000, "character-limit sample remains byte-distinct");
assert.equal(chars(`${eightThousandAstrals}a`), 8001, "one Unicode scalar over the string limit is visible");
assert.equal(chars("e\u0301"), 2, "combining marks are counted without normalization");

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

console.log("  every boundary has an exact/over-limit probe");
const probesByLimit = new Map();
for (const probe of hostile.boundaryProbes) {
  assert.equal(typeof probe.id, "string");
  assert.ok(expectedRows.has(probe.limitId), `${probe.id} references an ADR row`);
  assert.equal(typeof probe.target, "number", `${probe.id} records an exact target`);
  assert.ok(["accept", "accept-if-random", "accept-under-both-bounds", "unresolved-generic-array-interaction"].includes(probe.expectedAtTarget), `${probe.id} records an exact-target outcome`);
  assert.equal(typeof probe.expectedAtTargetPlusOne, "string", `${probe.id} records a +1 outcome`);
  assert.equal(typeof probe.proposedCode, "string", `${probe.id} records a future stable-code proposal`);
  if (!probesByLimit.has(probe.limitId)) probesByLimit.set(probe.limitId, []);
  probesByLimit.get(probe.limitId).push(probe);
}
for (const id of expectedRows.keys()) assert.ok(probesByLimit.has(id), `boundary ${id} has a probe`);
assert.ok(
  hostile.boundaryProbes.some(probe => probe.id === "log-rows-at-specialized-limit" && probe.expectedAtTarget === "unresolved-generic-array-interaction"),
  "the 200,000-row log conflict stays unresolved instead of silently weakening the generic array limit",
);

console.log("  hostile parser/version/key cases are explicit");
assert.ok(hostile.cases.length >= 10);
const hostileIds = hostile.cases.map(testCase => testCase.id);
assert.equal(new Set(hostileIds).size, hostileIds.length, "hostile case IDs are unique");
for (const testCase of hostile.cases) {
  assert.equal(typeof testCase.id, "string");
  assert.equal(typeof testCase.kind, "string");
  assert.equal(typeof testCase.expected, "string");
  assert.equal(typeof testCase.proposedCode, "string");
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
assert.throws(() => new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(invalidUtf8.bytes)), TypeError, "invalid UTF-8 is rejected before JSON parsing");
for (const id of ["unknown-top-level-schema-version", "unknown-top-level-schema-version-zero", "unknown-workout-draft-version", "unknown-required-section-version"]) {
  const testCase = hostile.cases.find(candidate => candidate.id === id);
  assert.equal(testCase.expected, "reject-without-local-mutation", `${id} fails closed without local mutation`);
}
assert.equal(hostile.cases.find(testCase => testCase.id === "unknown-optional-section").expected, "contract-pin-required");
assert.equal(hostile.cases.find(testCase => testCase.id === "duplicate-key").expected, "contract-pin-required");

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

console.log("  existing clone fixture is characterized without calling a future validator");
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

const contractModule = join(ROOT, "install-transfer-contract.js");
console.log(`  planned (not run): browser/service parity against ${contractModule} (${existsSync(contractModule) ? "module present but interface is not pinned; no import performed" : "production module not present yet"})`);
console.log("  planned (not run): real log/trace adapter redaction and parser allocation-failure assertions");
console.log("pass: independent boundary matrix, hostile cases, redaction fixtures, and existing-clone characterization");
