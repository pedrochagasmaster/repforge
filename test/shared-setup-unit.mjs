#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  KIND,
  VERSION,
  MAX_ENCODED_CHARS,
  MAX_COMPRESSED_BYTES,
  MAX_DECOMPRESSED_BYTES,
  REQUIRED_API,
  BUILT_IN_IDS,
  MINIMAL_PAYLOAD,
  REPRESENTATIVE_PAYLOAD,
  INVALID_DECODE_INPUTS,
  INVALID_PAYLOADS,
  cloneFixture,
} from "./fixtures/shared-setup.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const Setup = require(join(__dirname, "..", "shared-setup.js"));

const OPTS = { builtInIds: BUILT_IN_IDS };

let passed = 0, failed = 0;
function assert(cond, name, detail = "") {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); if (detail) console.log(`    ${detail}`); }
}

function json(value) {
  return JSON.stringify(value);
}

async function gzipBytes(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function encodeRawBytes(bytes) {
  return `v1.${toBase64Url(await gzipBytes(bytes))}`;
}

function cookieJar() {
  const store = new Map();
  let lastWrite = "";
  return {
    get lastWrite() { return lastWrite; },
    get cookie() {
      return [...store].map(([name, value]) => `${name}=${value}`).join("; ");
    },
    set cookie(raw) {
      lastWrite = String(raw);
      const parts = lastWrite.split(";").map((part) => part.trim()).filter(Boolean);
      const nv = parts[0] || "";
      const eq = nv.indexOf("=");
      const name = eq === -1 ? nv : nv.slice(0, eq);
      const value = eq === -1 ? "" : nv.slice(eq + 1);
      const attrs = {};
      for (const part of parts.slice(1)) {
        const split = part.indexOf("=");
        if (split === -1) attrs[part.toLowerCase()] = true;
        else attrs[part.slice(0, split).toLowerCase()] = part.slice(split + 1);
      }
      if (String(attrs["max-age"]) === "0") store.delete(name);
      else store.set(name, value);
    },
  };
}

function loc(href) {
  const url = new URL(href);
  return { href: url.href, hostname: url.hostname, protocol: url.protocol };
}

console.log("public interface");
{
  for (const key of REQUIRED_API) {
    assert(Object.prototype.hasOwnProperty.call(Setup, key), `exports ${key}`);
  }
  assert(Setup.KIND === KIND, "KIND matches fixture");
  assert(Setup.VERSION === VERSION, "VERSION matches fixture");
  assert(Setup.MAX_ENCODED_CHARS === MAX_ENCODED_CHARS, "MAX_ENCODED_CHARS matches fixture");
  assert(Setup.MAX_COMPRESSED_BYTES === MAX_COMPRESSED_BYTES, "MAX_COMPRESSED_BYTES matches fixture");
  assert(Setup.MAX_DECOMPRESSED_BYTES === MAX_DECOMPRESSED_BYTES, "MAX_DECOMPRESSED_BYTES matches fixture");
}

console.log("canonicalization");
{
  const raw = { z: 1, a: { c: 3, b: 2 }, list: [{ b: 1, a: 2 }, { z: 9, a: 8 }] };
  const out = Setup.canonicalize(raw);
  assert(
    json(out) === '{"a":{"b":2,"c":3},"list":[{"a":2,"b":1},{"a":8,"z":9}],"z":1}',
    "recursively sorts object keys and preserves array order",
    json(out),
  );
  assert(json(raw) !== json(out) || raw.a !== out.a, "returns a deep clone rather than mutating input");
  raw.a.b = 99;
  assert(out.a.b === 2, "clone is detached from the input object");

  let threw = false;
  try { Setup.canonicalize(undefined); } catch { threw = true; }
  assert(threw, "throws for undefined");
  threw = false;
  try { Setup.canonicalize(() => {}); } catch { threw = true; }
  assert(threw, "throws for functions");
  threw = false;
  try { Setup.canonicalize(new Date()); } catch { threw = true; }
  assert(threw, "throws for Date");
}

console.log("schema: language and settings");
{
  const missingLang = cloneFixture();
  delete missingLang.settings.lang;
  const missing = Setup.validate(missingLang, OPTS);
  assert(!missing.ok && missing.code === "invalid-schema", "settings.lang is required", missing.code);

  for (const lang of ["fr", "EN", "pt-BR", "", null, 1]) {
    const raw = cloneFixture();
    raw.settings.lang = lang;
    const result = Setup.validate(raw, OPTS);
    assert(!result.ok && result.code === "invalid-schema", `settings.lang rejects ${json(lang)}`, result.code);
  }

  for (const lang of ["en", "pt"]) {
    const raw = cloneFixture();
    raw.settings.lang = lang;
    const result = Setup.validate(raw, OPTS);
    assert(result.ok && result.value.settings.lang === lang, `settings.lang accepts ${lang}`);
  }

  const allowed = Setup.validate(cloneFixture(REPRESENTATIVE_PAYLOAD), OPTS);
  assert(allowed.ok, "representative payload validates", allowed.code);
  if (allowed.ok) {
    const settings = allowed.value.settings;
    assert(settings.jumpPct === 3.5, "jumpPct survives");
    assert(settings.minJump === 1.25, "minJump survives");
    assert(settings.rirHigh === 3, "rirHigh survives");
    assert(settings.hardRir === 5, "hardRir survives");
    assert(settings.restSec === 165, "restSec survives");
    assert(settings.unit === "kg", "unit survives");
    assert(settings.lang === "pt", "lang survives");
    assert(settings.rirMode === "effort", "rirMode survives");
  }

  const coerced = cloneFixture();
  coerced.settings.restSec = "120";
  coerced.program.meta.daysPerWeek = "1";
  coerced.program.exercises[0].sets = "3";
  const coercedResult = Setup.validate(coerced, OPTS);
  assert(!coercedResult.ok && coercedResult.code === "invalid-schema", "numeric strings fail at the schema boundary", coercedResult.code);
}

console.log("schema: excluded keys cannot reach the proposal");
{
  const raw = cloneFixture(REPRESENTATIVE_PAYLOAD);
  raw.log = [{ session: "s1", load: 100 }];
  raw.programHistory = [{ id: "old-program" }];
  raw._storageRevision = 9;
  raw._storageFollowUp = { kind: "x" };
  raw._storageDraftTransaction = { id: "txn" };
  raw.ui = { theme: "dark" };
  raw.settings.lastExport = "2026-01-01";
  raw.settings.voiceInputEnabled = true;
  raw.settings.notify = { enabled: true, timer: true, session: true, unfinished: true, missed: true };
  raw.program.meta.id = "src-id";
  raw.program.meta.started = "2020-01-01";
  raw.program.meta.created = "2020-01-01T00:00:00.000Z";
  raw.program.meta.updated = "2020-01-01T00:00:00.000Z";
  raw.program.meta.mesocycleStatus = "active";
  raw.program.meta.completedAt = "2020-02-01";
  raw.program.meta.onboarded = true;
  raw.program.meta.blockPromptDismissedId = "block";
  raw.program.exercises[0].id = "slot-1";
  raw.program.exercises[0].movementId = "movement-1";
  raw.program.customExercises[0].archived = true;
  raw.program.customExercises[0].created = "2020-01-01T00:00:00.000Z";
  raw.program.customExercises[0].patterns = ["row"];
  raw.program.customExercises[0].beginnerFriendly = false;
  raw.program.customExercises[0].custom = true;
  const snapshot = json(raw);
  const result = Setup.validate(raw, OPTS);
  assert(result.ok, "payload with excluded keys still validates after picking", result.code);
  assert(json(raw) === snapshot, "validate does not mutate the input");
  if (result.ok) {
    const text = json(result.value);
    assert(!("log" in result.value), "log is absent from the proposal");
    assert(!("programHistory" in result.value), "programHistory is absent from the proposal");
    assert(!("_storageRevision" in result.value), "_storageRevision is absent");
    assert(!("_storageFollowUp" in result.value), "_storageFollowUp is absent");
    assert(!("_storageDraftTransaction" in result.value), "_storageDraftTransaction is absent");
    assert(!("ui" in result.value), "UI preferences are absent");
    assert(!("lastExport" in result.value.settings), "lastExport is absent from settings");
    assert(!("voiceInputEnabled" in result.value.settings), "voiceInputEnabled is absent from settings");
    assert(!("notify" in result.value.settings), "notify is absent from settings");
    assert(!("id" in result.value.program.meta), "program meta id is absent");
    assert(!("started" in result.value.program.meta), "program meta started is absent");
    assert(!("created" in result.value.program.meta), "program meta created is absent");
    assert(!("updated" in result.value.program.meta), "program meta updated is absent");
    assert(!("mesocycleStatus" in result.value.program.meta), "mesocycleStatus is absent");
    assert(!("completedAt" in result.value.program.meta), "completedAt is absent");
    assert(!("onboarded" in result.value.program.meta), "onboarded is absent");
    assert(!("blockPromptDismissedId" in result.value.program.meta), "blockPromptDismissedId is absent");
    assert(!("id" in result.value.program.exercises[0]), "exercise slot id is absent");
    assert(!("movementId" in result.value.program.exercises[0]), "exercise movementId is absent");
    assert(!("archived" in result.value.program.customExercises[0]), "custom archived is absent");
    assert(!("created" in result.value.program.customExercises[0]), "custom created is absent");
    assert(!("patterns" in result.value.program.customExercises[0]), "custom patterns are absent");
    assert(!("beginnerFriendly" in result.value.program.customExercises[0]), "custom beginnerFriendly is absent");
    assert(!("custom" in result.value.program.customExercises[0]), "custom bookkeeping flag is absent");
    assert(!text.includes("src-id"), "source identity does not leak into JSON");
    assert(!text.includes("slot-1"), "slot id does not leak into JSON");
  }
}

console.log("schema: kind, version, slots, ids");
{
  const wrongKind = cloneFixture();
  wrongKind.kind = "taurifer-backup";
  const kindResult = Setup.validate(wrongKind, OPTS);
  assert(!kindResult.ok && kindResult.code === "invalid-schema", "wrong kind is invalid-schema", kindResult.code);

  const versionBody = cloneFixture();
  versionBody.version = 2;
  const versionResult = Setup.validate(versionBody, OPTS);
  assert(!versionResult.ok && versionResult.code === "unsupported-version", "payload version 2 is unsupported-version", versionResult.code);

  const dup = cloneFixture();
  dup.program.exercises.push({ ...dup.program.exercises[0] });
  const dupResult = Setup.validate(dup, OPTS);
  assert(!dupResult.ok && dupResult.code === "invalid-schema", "duplicate (day, order) fails", dupResult.code);

  const unknown = cloneFixture();
  unknown.program.exercises[0].libraryId = "no_such_id";
  const unknownResult = Setup.validate(unknown, OPTS);
  assert(!unknownResult.ok && unknownResult.code === "invalid-schema", "unknown built-in id fails through supplied resolver", unknownResult.code);

  const emptyResolver = Setup.validate(cloneFixture(), { builtInIds: new Set() });
  assert(!emptyResolver.ok && emptyResolver.code === "invalid-schema", "resolver with no ids rejects a current built-in");

  const legacy = cloneFixture();
  legacy.program.exercises[0].libraryId = "dl_mc";
  const legacyResult = Setup.validate(legacy, OPTS);
  assert(!legacyResult.ok && legacyResult.code === "invalid-schema", "received legacy alias is rejected by the strict v1 validator", legacyResult.code);

  const missingCustom = cloneFixture();
  missingCustom.program.exercises[0].libraryId = "custom:missing";
  missingCustom.program.customExercises = [];
  const missingCustomResult = Setup.validate(missingCustom, OPTS);
  assert(!missingCustomResult.ok && missingCustomResult.code === "invalid-schema", "custom references require definitions", missingCustomResult.code);

  const unused = cloneFixture(REPRESENTATIVE_PAYLOAD);
  unused.program.customExercises.push({
    id: "custom:unused",
    name: "Unused fly",
    equipment: ["cable"],
  });
  const unusedResult = Setup.validate(unused, OPTS);
  assert(unusedResult.ok, "unreferenced custom definitions do not invalidate", unusedResult.code);
  assert(
    unusedResult.ok && unusedResult.value.program.customExercises.every((entry) => entry.id !== "custom:unused"),
    "unreferenced custom definitions are removed before the canonical payload is returned",
  );

  const mismatchDays = cloneFixture();
  mismatchDays.program.meta.daysPerWeek = 4;
  const mismatchResult = Setup.validate(mismatchDays, OPTS);
  assert(!mismatchResult.ok && mismatchResult.code === "invalid-schema", "daysPerWeek must equal distinct day count", mismatchResult.code);
}

console.log("schema: prototype-pollution keys");
{
  const withProto = JSON.parse(json(cloneFixture()));
  withProto.hack = JSON.parse('{"__proto__":{"polluted":true}}');
  const protoResult = Setup.validate(withProto, OPTS);
  assert(!protoResult.ok && protoResult.code === "invalid-schema", "own __proto__ key fails", protoResult.code);
  assert(withProto.hack["__proto__"].polluted === true, "rejected payload keeps the own __proto__ key instead of assigning the prototype");

  const withCtor = JSON.parse(json(cloneFixture()));
  withCtor.settings.hack = JSON.parse('{"constructor":{"prototype":{"x":1}}}');
  const ctorResult = Setup.validate(withCtor, OPTS);
  assert(!ctorResult.ok && ctorResult.code === "invalid-schema", "constructor key fails", ctorResult.code);

  const withPrototype = JSON.parse(json(cloneFixture()));
  withPrototype.program.exercises[0].hack = JSON.parse('{"prototype":{"x":1}}');
  const prototypeResult = Setup.validate(withPrototype, OPTS);
  assert(!prototypeResult.ok && prototypeResult.code === "invalid-schema", "prototype key fails", prototypeResult.code);
}

console.log("encode/decode round trip");
{
  const en = await Setup.encode(cloneFixture(MINIMAL_PAYLOAD), OPTS);
  assert(en.ok && typeof en.value === "string" && en.value.startsWith("v1."), "encodes a valid English payload", en.code);
  assert(en.ok && /^v1\.[A-Za-z0-9_-]+$/.test(en.value), "encoded value is v1. plus unpadded base64url");
  assert(en.ok && en.value.length <= MAX_ENCODED_CHARS, "encoded English payload fits the character ceiling", String(en.value && en.value.length));
  assert(en.ok && en.compressedBytes <= MAX_COMPRESSED_BYTES, "compressed English payload fits the byte ceiling");
  assert(en.ok && en.decompressedBytes <= MAX_DECOMPRESSED_BYTES, "uncompressed English payload fits the output ceiling");

  const enDecoded = await Setup.decode(en.value, OPTS);
  const enValidated = Setup.validate(cloneFixture(MINIMAL_PAYLOAD), OPTS);
  assert(enDecoded.ok, "decodes the English payload", enDecoded.code);
  assert(enDecoded.ok && json(enDecoded.value) === json(enValidated.value), "English round trip preserves the picked canonical payload");
  assert(enDecoded.ok && enDecoded.value.program.meta.name === "Coach program", "English program name survives UTF-8 round trip");

  const pt = await Setup.encode(cloneFixture(REPRESENTATIVE_PAYLOAD), OPTS);
  assert(pt.ok, "encodes a valid Portuguese payload", pt.code);
  const ptDecoded = await Setup.decode(pt.value, OPTS);
  assert(ptDecoded.ok, "decodes the Portuguese payload", ptDecoded.code);
  assert(ptDecoded.ok && ptDecoded.value.settings.lang === "pt", "Portuguese language survives");
  assert(ptDecoded.ok && ptDecoded.value.program.meta.name === "Força compartilhada", "Portuguese program name survives UTF-8 round trip");
  assert(ptDecoded.ok && ptDecoded.value.program.customExercises[0].namePt === "Remada do treinador", "Portuguese custom name survives UTF-8 round trip");
}

console.log("decode error taxonomy");
{
  for (const [code, input] of Object.entries(INVALID_DECODE_INPUTS)) {
    const result = await Setup.decode(input, OPTS);
    assert(!result.ok && result.code === code, `decode fixture ${code}`, result && result.code);
  }

  const badJson = await Setup.decode(
    await encodeRawBytes(new TextEncoder().encode(INVALID_PAYLOADS["invalid-json"])),
    OPTS,
  );
  assert(!badJson.ok && badJson.code === "invalid-json", "malformed JSON fails safely", badJson.code);

  const badUtf8 = await Setup.decode(await encodeRawBytes(INVALID_PAYLOADS["invalid-utf8"]), OPTS);
  assert(!badUtf8.ok && badUtf8.code === "invalid-utf8", "malformed UTF-8 fails safely", badUtf8.code);

  const schemaEncoded = await encodeRawBytes(new TextEncoder().encode(json(INVALID_PAYLOADS["invalid-schema"])));
  const badSchema = await Setup.decode(schemaEncoded, OPTS);
  assert(!badSchema.ok && badSchema.code === "invalid-schema", "unsupported language inside a gzip payload is invalid-schema", badSchema.code);

  const padded = "v1.e30=";
  const paddedResult = await Setup.decode(padded, OPTS);
  assert(!paddedResult.ok && paddedResult.code === "invalid-base64", "padded base64 is rejected", paddedResult.code);

  const rem1 = "v1.abcde";
  assert(rem1.slice(3).length % 4 === 1, "precondition: remainder 1 payload");
  const rem1Result = await Setup.decode(rem1, OPTS);
  assert(!rem1Result.ok && rem1Result.code === "invalid-base64", "base64url length remainder 1 is rejected", rem1Result.code);

  const unlabeled = await Setup.decode("not-a-setup-link", OPTS);
  assert(!unlabeled.ok && unlabeled.code === "invalid-base64", "a value without a vN. prefix is malformed, not a future version", unlabeled.code);
}

console.log("compression stream availability");
{
  const CompressionStreamOrig = globalThis.CompressionStream;
  const DecompressionStreamOrig = globalThis.DecompressionStream;
  try {
    globalThis.CompressionStream = undefined;
    const missingCompression = await Setup.encode(cloneFixture(), OPTS);
    assert(
      !missingCompression.ok && missingCompression.code === "compression-unavailable",
      "encode reports compression-unavailable when CompressionStream is missing",
      missingCompression.code,
    );

    globalThis.CompressionStream = CompressionStreamOrig;
    const encoded = await Setup.encode(cloneFixture(), OPTS);
    globalThis.DecompressionStream = undefined;
    const missingDecompression = await Setup.decode(encoded.value, OPTS);
    assert(
      !missingDecompression.ok && missingDecompression.code === "decompression-unavailable",
      "decode reports decompression-unavailable when DecompressionStream is missing",
      missingDecompression.code,
    );
  } finally {
    globalThis.CompressionStream = CompressionStreamOrig;
    globalThis.DecompressionStream = DecompressionStreamOrig;
  }
  assert(typeof globalThis.CompressionStream === "function", "CompressionStream was restored");
  assert(typeof globalThis.DecompressionStream === "function", "DecompressionStream was restored");
}

console.log("size boundaries");
{
  const bytes2301 = new Uint8Array(MAX_COMPRESSED_BYTES);
  const enc2301 = `v1.${toBase64Url(bytes2301)}`;
  assert(enc2301.length === 3071, "2301 compressed bytes encode to 3071 characters", String(enc2301.length));
  const result2301 = await Setup.decode(enc2301, OPTS);
  assert(!result2301.ok && result2301.code === "invalid-gzip", "2301 compressed bytes pass encoded/compressed size checks", result2301.code);

  const bytes2302 = new Uint8Array(MAX_COMPRESSED_BYTES + 1);
  const enc2302 = `v1.${toBase64Url(bytes2302)}`;
  assert(enc2302.length === 3073, "2302 compressed bytes encode to 3073 characters", String(enc2302.length));
  const result2302 = await Setup.decode(enc2302, OPTS);
  assert(!result2302.ok && result2302.code === "encoded-too-large", "2302 compressed bytes are rejected", result2302.code);

  const maxChars = `v1.${"a".repeat(MAX_ENCODED_CHARS - 3)}`;
  assert(maxChars.length === MAX_ENCODED_CHARS, "precondition: encoded value is exactly the character ceiling");
  const atCeiling = await Setup.decode(maxChars, OPTS);
  assert(atCeiling.code !== "encoded-too-large", "exactly 3072 encoded characters is not encoded-too-large", atCeiling.code);

  const bomb = await Setup.decode(
    await encodeRawBytes(new TextEncoder().encode(INVALID_PAYLOADS["decompressed-too-large"])),
    OPTS,
  );
  assert(!bomb.ok && bomb.code === "decompressed-too-large", "decompression stops above the output ceiling", bomb.code);

  const atOutputCeiling = await Setup.decode(
    await encodeRawBytes(new TextEncoder().encode("x".repeat(MAX_DECOMPRESSED_BYTES))),
    OPTS,
  );
  assert(
    !atOutputCeiling.ok && atOutputCeiling.code === "invalid-json",
    "exactly 65536 decompressed bytes pass the output ceiling and then fail JSON",
    atOutputCeiling.code,
  );

  const oversized = cloneFixture();
  oversized.program.exercises = [];
  for (let i = 1; i <= 40; i++) {
    oversized.program.exercises.push({
      ...cloneFixture().program.exercises[0],
      order: i,
      notes: "x".repeat(2000),
    });
  }
  const oversizedResult = await Setup.encode(oversized, OPTS);
  assert(
    !oversizedResult.ok && (oversizedResult.code === "encoded-too-large" || oversizedResult.code === "decompressed-too-large"),
    "an install-unsafe program fails with a typed size error rather than a thrown exception",
    oversizedResult.code,
  );
}

console.log("fragments");
{
  const prod = "https://pedrochagasmaster.github.io/repforge/index.html?goto=today#setup=v1.abc&theme=dark";
  assert(Setup.readSetupFragment(prod) === "v1.abc", "reads the setup fragment without decoding");
  assert(
    Setup.removeSetupFragment(prod) === "/repforge/index.html?goto=today#theme=dark",
    "removes only setup and preserves query plus unrelated fragment parameters",
    Setup.removeSetupFragment(prod),
  );

  const local = "http://localhost:8000/index.html#foo=1&setup=v1.abc&bar=2";
  assert(
    Setup.removeSetupFragment(local) === "/index.html#foo=1&bar=2",
    "preserves unrelated fragment parameters and their order",
    Setup.removeSetupFragment(local),
  );

  const onlySetup = "https://pedrochagasmaster.github.io/repforge/index.html#setup=v1.abc";
  assert(Setup.removeSetupFragment(onlySetup) === "/repforge/index.html", "drops the hash when setup was the only fragment parameter", Setup.removeSetupFragment(onlySetup));
  assert(Setup.readSetupFragment("https://example.test/index.html") === null, "missing fragment returns null");
  assert(Setup.readSetupFragment("https://example.test/index.html?setup=v1.abc") === null, "query setup is ignored");
}

console.log("cookies");
{
  assert(
    Setup.handoffCookiePath(loc("https://pedrochagasmaster.github.io/repforge/")) === "/repforge/index.html",
    "production directory path scopes the cookie to index.html",
  );
  assert(
    Setup.handoffCookiePath(loc("https://pedrochagasmaster.github.io/repforge/index.html")) === "/repforge/index.html",
    "production index.html path stays /repforge/index.html",
  );
  assert(
    Setup.handoffCookiePath(loc("http://localhost:8000/")) === "/index.html",
    "local directory path scopes the cookie to /index.html",
  );
  assert(
    Setup.handoffCookiePath(loc("http://localhost:8000/index.html")) === "/index.html",
    "local index.html path stays /index.html",
  );

  const encoded = "v1.abc";
  const prodDoc = cookieJar();
  const prodLoc = loc("https://pedrochagasmaster.github.io/repforge/index.html");
  Setup.writeHandoffCookie(encoded, { document: prodDoc, location: prodLoc });
  assert(Setup.readHandoffCookie({ document: prodDoc }) === encoded, "reads back the written handoff value");
  assert(prodDoc.lastWrite.includes("repforge_setup_v1="), "cookie name is the historical repforge handoff key");
  assert(prodDoc.lastWrite.includes("Path=/repforge/index.html"), "production cookie uses the index.html path", prodDoc.lastWrite);
  assert(prodDoc.lastWrite.includes("Max-Age=604800"), "cookie lives seven days");
  assert(/SameSite=Lax/i.test(prodDoc.lastWrite), "cookie is SameSite=Lax");
  assert(/\bSecure\b/.test(prodDoc.lastWrite), "Secure is set outside localhost", prodDoc.lastWrite);

  const localDoc = cookieJar();
  const localLoc = loc("http://localhost:8000/index.html");
  Setup.writeHandoffCookie(encoded, { document: localDoc, location: localLoc });
  assert(localDoc.lastWrite.includes("Path=/index.html"), "localhost cookie uses /index.html", localDoc.lastWrite);
  assert(!/;\s*Secure(?:;|$)/i.test(localDoc.lastWrite), "Secure is omitted on localhost", localDoc.lastWrite);

  Setup.clearHandoffCookie({ document: prodDoc, location: prodLoc });
  assert(Setup.readHandoffCookie({ document: prodDoc }) == null, "clearing removes the handoff cookie");
  assert(String(prodDoc.lastWrite).includes("Max-Age=0"), "clearing sets Max-Age=0", prodDoc.lastWrite);
}

console.log(`\nshared-setup unit tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
