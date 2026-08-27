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
const { EXERCISE_LIBRARY } = require(join(__dirname, "..", "exercises.js"));

const OPTS = { builtInIds: BUILT_IN_IDS };
const LIBRARY_OPTS = { builtInIds: new Set(EXERCISE_LIBRARY.map((entry) => entry.id)) };

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
  return encodeVersionedBytes(1, bytes);
}

async function encodeVersionedBytes(version, bytes) {
  return `v${version}.${toBase64Url(await gzipBytes(bytes))}`;
}

const SHARE_URL_PREFIX = "https://pedrochagasmaster.github.io/repforge/index.html#setup=";

const V1_MINIMAL_GOLDEN = "v1.H4sIAAAAAAAAA02RT2sbMRDFv4p5Z6VknaYHXdNAWhoIcaGHEIwsTXan1p_taLZkMf7uReuY-iRpRsyb93sH7DkHWKibhN9IrurghMJVJZ1GGIxSenEJ9gA_VS3p_p3Ec6UK-_JqQBfPA1xUkuz03A1uhsVXN686GETeiZP5W9MbZZs8DJJ7h-2ul8uGtMLeGiTOsF-W81RbG-SyTMVdySolRgor8p6yCrc5RQIJbNc25iKsTXjgfjh7oFq55J_zSLAIZdpF2l40YFAXqRsDddKTPrPcNzTdRWGjThT25vhqkEhdwxLcXJ9IfhHtl8_0Z-IxUVbYFyTnB85UsaAaSZiybxtwVpJEgZ0SDPriYlt4HklUyjjMjQ3V4mcf6QflXoemUBcu2SVaUDg_rM4J_Xf-OFUflwhwN1DVJl5PNk-TYJGLJBeb6zGyfmB5m2Lc7kqYcTwuPJRzX5vJwUl4ZoH9bPB7SuOTV9j1p1uD6HIPC2oEE-fvUxo_OkJVN-Rhu_W1gbA8tDhalsLyWEJTzFOiU4BTZoXFvsfR4C_JEortjv8AccHNsqICAAA";
const V1_REPRESENTATIVE_GOLDEN = "v1.H4sIAAAAAAAAA92Y227cNhCGX0WYazrtrg8odBk3RRvEgWsX6IVhLEbkWGKXpwwpO4Kxz9MHyYsVlJKsvdqbZINC1tVySYrkN0P-lP5HWGunoISELes74qPYIJM6ipTaAAIC-5rRQvkIso3J2zcfiaWOFKG8eQT60OpgySUob0BiZQhuBeg84tC9lB5lc8T-AQQ4tAQlnOeqou9dbBsuE5RwRRYVFsoXiUk7VJ5zs095PnhPbWI0RYNOGepXpy1yByVcaPVTGwJxUaFcg4BI0js1NL7WkkKEza0AerZ8NInYYT_6za0Ahbn7r9gVCxBgdMXI3R-ZBquVlSDA4kcoFz_3hWtKEcpTAVY7KM_636FuuV3zuXeJvTGkCpKSXGKdx_GsiKFc9AyedcoTN7puvsScYtTe_dWFHDHl28rQ6klDT5inOhaQkGtKV5rf5FQunlRcJ-QE5fFGfAurbFeq-sq63MP6y37WLdfyGZfzbNFMgez-O7O4JTv-AWQnP55MmVV1YM5Oppmzpj44Z6cTJUsH5-xsGrtxuUNm5HzVcsRKT1lfslqOyOqn98BLVssRWVgcnLSJyOUIjecil7tkQR2cs4nI5fEuGX_nQXsBcrmHdSZyOSJrV9XDLORyl4wPP3kTUcsR2cNKHnjFTUQt95DNRC1PdshimO_L5Yj1w8GfCBNRyz1kJsxCLXfJUjUXtRyR8VzUMpMpHYPB7v1gSu53Hp_bYiND85tTfIltpAJTEQjXhcyChDINcP-76t4KsJQwe7sKu3hJ_DfRun_6ma9rUTbaUQQxWLy5oFpbVWRMLlfIQ7H3VwOxJifzClHdo5OkQEDt0eRTn5hcnZpV0wXixD40XY4jRS87aehd35qXEfsYfnaMf_P86V8spLcBOWnToELYxumijdL0SYbzhmICAa8HF_jPFlW_rjhEaBg_fyZ5V-dwBaPT53j29vHK-Adi2Gz6UCbt6pjj0yCrKz3s339aGy5ljuCrUwEGXZ1f_vKkVru3rQ1QLl4tTwUwxXRNEsrFWf6n-fd8qeTty5ovvMqT0t2d5_xs63Q2wNc1bATcE_f5LBeb_wCSuST6ohcAAA";
const V1_REAL_PORTUGUESE_GOLDEN = "v1.H4sIAAAAAAAAE62WQY7TMBSGr1K9dQbRtDMaZc1IgKhUMUgsEKoc503iqWO7tsO0qrriBlyABUfhQhyBl7SF4FaVp3RVN5bf59__nxevYS5UARl41ljxgPbKVcxiceXQNwYSMFaXltWQrYE3zuv6bomWC4cOsk-fE8De3zUw6dEq5vezBVtR7VeCDYZUS4rcMrt60_LcYj6rOT2s2RKyW_oVCrJxAkp3q4GmtC3QQjZMgHZDz0ab5DkII3uE4csd4uYYIt0j0uchKj_L8zjE6EwV9ilaxfhMFZJHI67PRPBmVvw9qHSHuD2GuIlEpKEXZc-LiwQqJDjTF3GRQB0gFjNp4hCxgQoR0vZVXO8QLev8RIUMlvcT9YeRnozUM3V4O-MXjtTo0A1Xx7kRm6kQ8WD6Ki6SqQMVLvrdi81UiLDFUb__K1MhQ_J_-vlJHbFtKmRQm7p0psYBgj4ZsSpiMxUiTBHdz2MzFSIkxhseG6qQUci-GaebSGyoDtxYzvKnSB2xjSpkeBv_AvZSRTVr9Ky9eVFtN0X7EXHeScVFI0yNyhOaqvJKKKqTAGe5pEF3LTNoBSqOkKlGygRKzeR-XKPTfMUlvkNV-qqt67YBYTUtgKnVj-j1YPLzBw6UHtxXzODg1_dvX6G9EQpthV9NGsflXj1dAJ3Qaltvj3FGCv9hZXZ72Gw6cV6o0rWq6KJZvBdb8x6b2kw56Ulf0DFLpso2xx66s3pLk7sZi87fI2-PkTyywr4WZdXFmMYTXbS7V01N2tt0NkpQSZiXQOgvaNst0tLNbzh-42v2CgAA";

// Wire tuple for MINIMAL_PAYLOAD. Mask bits and 1-based nullable enums are the v2 contract.
const MINIMAL_V2_TUPLE = [
  ["Coach program", 6, 63, 1, 2, 1, [1], ["Chest"], 2],
  [2.5, 2.5, 2, 4, 120, 1, 1, 1],
  ["Day 1"],
  [[0, 1, "pr_mc", 3, 6, 10, 506, "Controlled eccentric", "double_progression", 3, 1, 2, 5, "high"]],
  [],
];

function completeRoundTripPayload() {
  return {
    kind: KIND,
    version: VERSION,
    program: {
      meta: {
        name: "Açaí 強 🏋️",
        goal: "hypertrophy",
        experience: null,
        daysPerWeek: 2,
        equipment: ["barbells", "machines"],
        priorityMuscles: ["Back", "Chest"],
        sessionLength: "short",
        mesocycleLengthWeeks: 4,
      },
      exercises: [
        {
          day: "Push",
          order: 1,
          libraryId: "pr_mc",
          sets: 3,
          min: 6,
          max: 10,
          displayName: "Chest press local",
          notes: "Pause 1s — 日本語",
          alternates: ["cv_mc"],
          progressionType: "double_progression",
          targetRirStart: 3,
          targetRirEnd: 1,
          minSets: 2,
          maxSets: 4,
          priority: "high",
        },
        {
          day: "Pull",
          order: 1,
          libraryId: "custom:row-1",
          sets: 4,
          min: 8,
          max: 12,
        },
        {
          day: "Pull",
          order: 2,
          libraryId: "custom:fly-2",
          sets: 3,
          min: 10,
          max: 15,
          notes: "",
          alternates: [],
        },
      ],
      customExercises: [
        {
          id: "custom:row-1",
          name: "Coach row",
          namePt: "Remada",
          equipment: ["cable", "band"],
          primary: "Back",
          secondary: "Biceps",
          notes: "Neutral",
        },
        {
          id: "custom:fly-2",
          name: "Pec fly",
          equipment: ["machine"],
        },
      ],
    },
    settings: {
      jumpPct: 3.5,
      minJump: 1.25,
      rirHigh: 3,
      hardRir: 5,
      restSec: 165,
      unit: "lb",
      lang: "pt",
      rirMode: "effort",
    },
  };
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

console.log("progression envelopes and program relations");
{
  const payload = completeRoundTripPayload();
  payload.program.exercises[0].id = "slot-heavy";
  payload.program.exercises[0].movementId = "movement:bench-press";
  payload.program.exercises[0].progression = {
    schemaVersion: 1,
    strategy: { id: "range", version: 1, params: { workingSets: 3, repMin: 6, repMax: 10 } },
    modifiers: [],
  };
  payload.program.exercises[1].id = "slot-volume";
  payload.program.exercises[1].movementId = "movement:bench-press";
  payload.program.exercises[1].progression = {
    schemaVersion: 1,
    strategy: { id: "manual", version: 1, params: { authored: { label: "as written" } } },
    modifiers: [],
  };
  payload.program.meta.progressionRelations = [{
    schemaVersion: 1,
    id: "relation-1",
    type: "paired_exposure",
    version: 1,
    movementId: "movement:bench-press",
    members: [
      { exerciseId: "slot-volume", role: "volume" },
      { exerciseId: "slot-heavy", role: "heavy" },
    ],
  }];
  payload.program.meta.progressionModifiers = [{
    id: "pending-modifier",
    version: 1,
    compatibleStrategies: ["range@1"],
    weekNumber: 1,
    target: "repMin",
    params: { pending: true },
  }];
  const checked = Setup.validate(payload, LIBRARY_OPTS);
  assert(checked.ok, "versioned progression payload validates", JSON.stringify(checked));
  assert(checked.ok && checked.value.program.exercises[0].progression?.strategy.id === "range", "exercise progression survives validation");
  assert(checked.ok && checked.value.program.exercises[0].movementId === "movement:bench-press", "movement identity survives validation");
  assert(checked.ok && checked.value.program.meta.progressionRelations?.[0].members.length === 2, "program relations survive validation");
  assert(checked.ok && checked.value.program.meta.progressionModifiers?.[0].id === "pending-modifier", "program modifiers survive validation");
  if (checked.ok) {
    const encoded = await Setup.encode(payload, LIBRARY_OPTS);
    assert(encoded.ok, "versioned progression payload encodes", JSON.stringify(encoded));
    if (encoded.ok) {
      const decoded = await Setup.decode(encoded.value, LIBRARY_OPTS);
      assert(decoded.ok, "versioned progression payload decodes", JSON.stringify(decoded));
      assert(decoded.ok && json(decoded.value) === json(checked.value), "versioned progression payload round-trips byte-equivalently");
    }
  }
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
  raw.program.exercises[1].id = "slot-2";
  raw.program.exercises[1].movementId = "movement-1";
  raw.program.meta.progressionRelations = [{
    schemaVersion: 1, id: "relation-1", type: "paired_exposure", version: 1,
    movementId: "movement-1",
    members: [{ exerciseId: "slot-1", role: "heavy" }, { exerciseId: "slot-2", role: "volume" }],
  }];
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
    assert(result.value.program.exercises[0].id === "slot-1", "exercise slot id is preserved for relation references");
    assert(result.value.program.exercises[0].movementId === "movement-1", "recognized movement identity is preserved");
    assert(!("archived" in result.value.program.customExercises[0]), "custom archived is absent");
    assert(!("created" in result.value.program.customExercises[0]), "custom created is absent");
    assert(!("patterns" in result.value.program.customExercises[0]), "custom patterns are absent");
    assert(!("beginnerFriendly" in result.value.program.customExercises[0]), "custom beginnerFriendly is absent");
    assert(!("custom" in result.value.program.customExercises[0]), "custom bookkeeping flag is absent");
    assert(!text.includes("src-id"), "source identity does not leak into JSON");
    assert(text.includes("slot-1"), "recognized slot id remains in the shared proposal");
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

console.log("schema: deeply nested untrusted values");
{
  const deepArray = cloneFixture();
  let arrayCursor = deepArray;
  for (let i = 0; i < 6000; i++) {
    const child = [];
    if (Array.isArray(arrayCursor)) arrayCursor.push(child);
    else arrayCursor.unknown = child;
    arrayCursor = child;
  }
  let arrayResult;
  try { arrayResult = Setup.validate(deepArray, OPTS); } catch (error) { arrayResult = { thrown: error }; }
  assert(
    arrayResult && !arrayResult.thrown && !arrayResult.ok && arrayResult.code === "invalid-schema",
    "validate returns invalid-schema for deeply nested arrays",
    String(arrayResult?.thrown || arrayResult?.code),
  );

  const deepObject = cloneFixture();
  let objectCursor = deepObject;
  for (let i = 0; i < 6000; i++) {
    objectCursor.unknown = {};
    objectCursor = objectCursor.unknown;
  }
  let objectResult;
  try { objectResult = Setup.validate(deepObject, OPTS); } catch (error) { objectResult = { thrown: error }; }
  assert(
    objectResult && !objectResult.thrown && !objectResult.ok && objectResult.code === "invalid-schema",
    "validate returns invalid-schema for deeply nested objects",
    String(objectResult?.thrown || objectResult?.code),
  );

  let encodedDeep;
  try { encodedDeep = await Setup.encode(deepArray, OPTS); } catch (error) { encodedDeep = { rejected: error }; }
  assert(
    encodedDeep && !encodedDeep.rejected && !encodedDeep.ok && encodedDeep.code === "invalid-schema",
    "encode resolves invalid-schema for deeply nested input",
    String(encodedDeep?.rejected || encodedDeep?.code),
  );

  const base = json(cloneFixture()).slice(0, -1);
  const deepArrayJson = `${base},"unknown":${"[".repeat(6000)}0${"]".repeat(6000)}}`;
  let decodedArray;
  try {
    decodedArray = await Setup.decode(await encodeRawBytes(new TextEncoder().encode(deepArrayJson)), OPTS);
  } catch (error) {
    decodedArray = { rejected: error };
  }
  assert(
    decodedArray && !decodedArray.rejected && !decodedArray.ok && decodedArray.code === "invalid-schema",
    "decode resolves invalid-schema for deeply nested arrays",
    String(decodedArray?.rejected || decodedArray?.code),
  );

  const deepObjectJson = `${base},"unknown":${'{"":'.repeat(4000)}0${"}".repeat(4000)}}`;
  let decodedObject;
  try {
    decodedObject = await Setup.decode(await encodeRawBytes(new TextEncoder().encode(deepObjectJson)), OPTS);
  } catch (error) {
    decodedObject = { rejected: error };
  }
  assert(
    decodedObject && !decodedObject.rejected && !decodedObject.ok && decodedObject.code === "invalid-schema",
    "decode resolves invalid-schema for deeply nested objects",
    String(decodedObject?.rejected || decodedObject?.code),
  );
}

console.log("encode/decode round trip");
{
  const en = await Setup.encode(cloneFixture(MINIMAL_PAYLOAD), OPTS);
  assert(en.ok && typeof en.value === "string" && /^v[12]\./.test(en.value), "encodes a valid English payload", en.code);
  assert(en.ok && /^v[12]\.[A-Za-z0-9_-]+$/.test(en.value), "encoded value is a supported unpadded base64url envelope");
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
  const malformedV2 = await Setup.decode("v2.e30", OPTS);
  assert(
    !malformedV2.ok && malformedV2.code === "invalid-gzip",
    "a v2. envelope is dispatched rather than rejected as unsupported-version",
    malformedV2.code,
  );

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
  assert(
    Setup.writeHandoffCookie(encoded, { document: prodDoc, location: prodLoc }) === true,
    "writeHandoffCookie accepts a syntactically safe v1 envelope",
  );
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

console.log("v1 golden compatibility");
{
  assert(V1_MINIMAL_GOLDEN.length === 574, "precondition: captured minimal v1 is 574 characters");
  const minGolden = await Setup.decode(V1_MINIMAL_GOLDEN, OPTS);
  const minValidated = Setup.validate(cloneFixture(MINIMAL_PAYLOAD), OPTS);
  assert(minGolden.ok, "decodes the frozen minimal v1 envelope", minGolden.code);
  assert(
    minGolden.ok && json(minGolden.value) === json(minValidated.value),
    "frozen minimal v1 matches the current canonical payload",
  );

  assert(V1_REPRESENTATIVE_GOLDEN.length === 1097, "precondition: captured representative v1 is 1097 characters");
  const repGolden = await Setup.decode(V1_REPRESENTATIVE_GOLDEN, OPTS);
  const repValidated = Setup.validate(cloneFixture(REPRESENTATIVE_PAYLOAD), OPTS);
  assert(repGolden.ok, "decodes the frozen representative v1 envelope", repGolden.code);
  assert(
    repGolden.ok && json(repGolden.value) === json(repValidated.value),
    "frozen representative v1 matches the current canonical payload",
  );
}

console.log("real Portuguese link compression");
{
  assert(V1_REAL_PORTUGUESE_GOLDEN.length === 811, "precondition: supplied v1 payload is 811 characters");
  const original = await Setup.decode(V1_REAL_PORTUGUESE_GOLDEN, LIBRARY_OPTS);
  assert(original.ok, "the supplied production-shaped v1 link still decodes", original.code);
  assert(original.ok && original.value.program.meta.name === "Projeto Mãe no Shape 💃", "the supplied program identity is preserved");
  assert(original.ok && original.value.program.exercises.length === 24, "the supplied program has all 24 exercises");
  const compact = original.ok ? await Setup.encode(original.value, LIBRARY_OPTS) : original;
  assert(compact.ok && compact.value.startsWith("v2."), "the supplied program selects the compact v2 envelope", compact.value?.slice(0, 3));
  assert(
    compact.ok && SHARE_URL_PREFIX.length + compact.value.length <= 520,
    "the supplied complete URL shrinks to at most 520 characters",
    String(compact.ok ? SHARE_URL_PREFIX.length + compact.value.length : compact.code),
  );
  const roundTrip = compact.ok ? await Setup.decode(compact.value, LIBRARY_OPTS) : compact;
  assert(
    original.ok && roundTrip.ok && json(roundTrip.value) === json(original.value),
    "the supplied program survives an exact v1 to v2 semantic round trip",
  );
}

console.log("v2 decode of a hand-built tuple");
{
  const encoded = await encodeVersionedBytes(2, new TextEncoder().encode(json(MINIMAL_V2_TUPLE)));
  assert(encoded.startsWith("v2."), "precondition: helper builds a v2 envelope");
  let decoded;
  try { decoded = await Setup.decode(encoded, OPTS); } catch (error) { decoded = { rejected: error }; }
  const validated = Setup.validate(cloneFixture(MINIMAL_PAYLOAD), OPTS);
  assert(decoded && !decoded.rejected && decoded.ok, "decodes a hand-built v2 tuple without throwing", String(decoded?.rejected || decoded?.code));
  assert(
    decoded.ok && json(decoded.value) === json(validated.value),
    "v2 tuple expands to the same canonical semantic payload as v1",
  );
}

console.log("encode selects the shorter envelope");
{
  const minValidated = Setup.validate(cloneFixture(MINIMAL_PAYLOAD), OPTS);
  const minV1 = await encodeVersionedBytes(1, new TextEncoder().encode(json(minValidated.value)));
  const minEncoded = await Setup.encode(cloneFixture(MINIMAL_PAYLOAD), OPTS);
  assert(minEncoded.ok, "encodes the minimal payload after v2 exists", minEncoded.code);
  assert(
    minEncoded.ok && typeof minEncoded.compressedBytes === "number" && typeof minEncoded.decompressedBytes === "number",
    "encode keeps the existing success shape",
  );
  if (minEncoded.ok && minEncoded.value.startsWith("v2.")) {
    assert(minEncoded.value.length < minV1.length, "v2 is chosen only when it is strictly shorter than v1", `${minEncoded.value.length} vs ${minV1.length}`);
  } else {
    assert(minEncoded.ok && minEncoded.value.startsWith("v1."), "tie or shorter v1 keeps the v1 envelope", minEncoded.value && minEncoded.value.slice(0, 4));
    assert(minEncoded.ok && minEncoded.value.length <= minV1.length, "selected v1 is not longer than the v1 candidate");
  }

  const repValidated = Setup.validate(cloneFixture(REPRESENTATIVE_PAYLOAD), OPTS);
  const repV1 = await encodeVersionedBytes(1, new TextEncoder().encode(json(repValidated.value)));
  const repEncoded = await Setup.encode(cloneFixture(REPRESENTATIVE_PAYLOAD), OPTS);
  assert(repEncoded.ok && repEncoded.value.startsWith("v2."), "representative encode selects the v2 envelope", repEncoded.value && repEncoded.value.slice(0, 8));
  assert(repEncoded.ok && repEncoded.value.length < repV1.length, "representative v2 is shorter than v1", `${repEncoded.value && repEncoded.value.length} vs ${repV1.length}`);
  assert(SHARE_URL_PREFIX.length === 62, "production share prefix is 62 characters");
  const completeUrl = `${SHARE_URL_PREFIX}${repEncoded.value}`;
  assert(
    repEncoded.ok && completeUrl.length <= 700,
    "representative complete URL is at most 700 characters",
    String(completeUrl.length),
  );

  const repDecoded = await Setup.decode(repEncoded.value, OPTS);
  assert(repDecoded.ok && json(repDecoded.value) === json(repValidated.value), "selected representative envelope round-trips exactly");
}

console.log("v2 exact semantic round trip");
{
  const raw = completeRoundTripPayload();
  const validated = Setup.validate(raw, OPTS);
  assert(validated.ok, "complete payload validates", validated.code);
  if (validated.ok) {
    assert(validated.value.program.meta.goal === "hypertrophy", "present enum survives validation");
    assert(validated.value.program.meta.experience === null, "null enum is preserved");
    assert(!("splitType" in validated.value.program.meta), "omitted enum stays omitted");
    assert(json(validated.value.program.meta.equipment) === json(["barbells", "machines"]), "equipment order is preserved");
    assert(validated.value.program.customExercises[1].namePt === "Pec fly", "omitted namePt reconstructs as name");
    assert(validated.value.program.exercises[1].notes === "", "omitted notes reconstruct as empty string");
    assert(json(validated.value.program.exercises[1].alternates) === "[]", "omitted alternates reconstruct as []");
  }
  const encoded = await Setup.encode(raw, OPTS);
  assert(encoded.ok, "encodes the complete payload", encoded.code);
  const decoded = await Setup.decode(encoded.value, OPTS);
  assert(decoded.ok, "decodes the complete payload", decoded.code);
  assert(decoded.ok && json(decoded.value) === json(validated.value), "complete v2 round trip is semantically exact");
  assert(decoded.ok && decoded.value.program.meta.name === "Açaí 強 🏋️", "unicode program name survives");
  assert(decoded.ok && decoded.value.program.exercises[0].notes.includes("日本語"), "unicode notes survive");
  assert(decoded.ok && decoded.value.program.exercises[1].libraryId === "custom:row-1", "first custom ref reconstructs from the C index");
  assert(decoded.ok && decoded.value.program.exercises[2].libraryId === "custom:fly-2", "second custom ref reconstructs from the C index");
  assert(decoded.ok && decoded.value.program.customExercises[0].namePt === "Remada", "namePt override survives");
  assert(decoded.ok && decoded.value.program.customExercises[1].namePt === "Pec fly", "same-as-name namePt is reconstructed");
  assert(decoded.ok && decoded.value.settings.unit === "lb", "required settings enums survive as values");
}

console.log("malformed v2 envelopes");
{
  async function decodeTuple(tuple) {
    try {
      return await Setup.decode(await encodeVersionedBytes(2, new TextEncoder().encode(json(tuple))), OPTS);
    } catch (error) {
      return { rejected: error };
    }
  }

  const cases = [
    ["non-array object", {}],
    ["wrong payload arity", [[], [], [], []]],
    ["trailing payload value", [...MINIMAL_V2_TUPLE, 0]],
    ["unknown meta mask bit", [
      ["Coach program", 6, 63 + 64, 1, 2, 1, [1], ["Chest"], 2, 0],
      MINIMAL_V2_TUPLE[1],
      MINIMAL_V2_TUPLE[2],
      MINIMAL_V2_TUPLE[3],
      [],
    ]],
    ["invalid nullable enum", [
      ["Coach program", 6, 63, 99, 2, 1, [1], ["Chest"], 2],
      MINIMAL_V2_TUPLE[1],
      MINIMAL_V2_TUPLE[2],
      MINIMAL_V2_TUPLE[3],
      [],
    ]],
    ["invalid equipment code", [
      ["Coach program", 6, 63, 1, 2, 1, [0], ["Chest"], 2],
      MINIMAL_V2_TUPLE[1],
      MINIMAL_V2_TUPLE[2],
      MINIMAL_V2_TUPLE[3],
      [],
    ]],
    ["wrong settings arity", [
      MINIMAL_V2_TUPLE[0],
      [2.5, 2.5, 2, 4, 120, 1, 1],
      MINIMAL_V2_TUPLE[2],
      MINIMAL_V2_TUPLE[3],
      [],
    ]],
    ["invalid required settings enum", [
      MINIMAL_V2_TUPLE[0],
      [2.5, 2.5, 2, 4, 120, 0, 1, 1],
      MINIMAL_V2_TUPLE[2],
      MINIMAL_V2_TUPLE[3],
      [],
    ]],
    ["duplicate day labels", [
      MINIMAL_V2_TUPLE[0],
      MINIMAL_V2_TUPLE[1],
      ["Day 1", "Day 1"],
      MINIMAL_V2_TUPLE[3],
      [],
    ]],
    ["out-of-range day index", [
      MINIMAL_V2_TUPLE[0],
      MINIMAL_V2_TUPLE[1],
      ["Day 1"],
      [[1, 1, "pr_mc", 3, 6, 10, 0]],
      [],
    ]],
    ["unreferenced day", [
      MINIMAL_V2_TUPLE[0],
      MINIMAL_V2_TUPLE[1],
      ["Day 1", "Day 2"],
      MINIMAL_V2_TUPLE[3],
      [],
    ]],
    ["string custom libraryRef", [
      MINIMAL_V2_TUPLE[0],
      MINIMAL_V2_TUPLE[1],
      MINIMAL_V2_TUPLE[2],
      [[0, 1, "custom:row-1", 3, 6, 10, 0]],
      [["custom:row-1", "Coach row", ["cable"], 0]],
    ]],
    ["custom index without C", [
      MINIMAL_V2_TUPLE[0],
      MINIMAL_V2_TUPLE[1],
      MINIMAL_V2_TUPLE[2],
      [[0, 1, 0, 3, 6, 10, 0]],
      [],
    ]],
    ["unreferenced custom", [
      MINIMAL_V2_TUPLE[0],
      MINIMAL_V2_TUPLE[1],
      MINIMAL_V2_TUPLE[2],
      MINIMAL_V2_TUPLE[3],
      [["custom:unused", "Unused", ["cable"], 0]],
    ]],
    ["duplicate custom id", [
      MINIMAL_V2_TUPLE[0],
      MINIMAL_V2_TUPLE[1],
      MINIMAL_V2_TUPLE[2],
      [[0, 1, 0, 3, 6, 10, 0], [0, 2, 1, 3, 6, 10, 0]],
      [["custom:row-1", "Coach row", ["cable"], 0], ["custom:row-1", "Other", ["cable"], 0]],
    ]],
    ["unknown exercise mask bit", [
      MINIMAL_V2_TUPLE[0],
      MINIMAL_V2_TUPLE[1],
      MINIMAL_V2_TUPLE[2],
      [[0, 1, "pr_mc", 3, 6, 10, 512]],
      [],
    ]],
    ["trailing exercise values", [
      MINIMAL_V2_TUPLE[0],
      MINIMAL_V2_TUPLE[1],
      MINIMAL_V2_TUPLE[2],
      [[0, 1, "pr_mc", 3, 6, 10, 0, "extra"]],
      [],
    ]],
    ["trailing custom values", [
      MINIMAL_V2_TUPLE[0],
      MINIMAL_V2_TUPLE[1],
      MINIMAL_V2_TUPLE[2],
      [[0, 1, 0, 3, 6, 10, 0]],
      [["custom:row-1", "Coach row", ["cable"], 0, "extra"]],
    ]],
  ];

  for (const [name, tuple] of cases) {
    const result = await decodeTuple(tuple);
    assert(
      result && !result.rejected && !result.ok && result.code === "invalid-schema",
      `malformed v2 ${name} is invalid-schema`,
      String(result?.rejected || result?.code),
    );
  }

  const future = await Setup.decode("v4.e30", OPTS);
  assert(!future.ok && future.code === "unsupported-version", "unknown envelope versions stay unsupported-version", future.code);

  let deep;
  try {
    deep = await Setup.decode(
      await encodeVersionedBytes(2, new TextEncoder().encode(`${"[".repeat(6000)}0${"]".repeat(6000)}`)),
      OPTS,
    );
  } catch (error) {
    deep = { rejected: error };
  }
  assert(
    deep && !deep.rejected && !deep.ok && deep.code === "invalid-schema",
    "deeply nested v2 JSON is invalid-schema rather than thrown",
    String(deep?.rejected || deep?.code),
  );

  const v2Bytes2302 = `v2.${toBase64Url(new Uint8Array(MAX_COMPRESSED_BYTES + 1))}`;
  const oversized = await Setup.decode(v2Bytes2302, OPTS);
  assert(!oversized.ok && oversized.code === "encoded-too-large", "v2 compressed ceiling matches v1", oversized.code);
}

console.log("cookie v2 and safety");
{
  const v2Doc = cookieJar();
  const v2Loc = loc("https://pedrochagasmaster.github.io/repforge/index.html");
  assert(
    Setup.writeHandoffCookie("v2.e30", { document: v2Doc, location: v2Loc }) === true,
    "writeHandoffCookie accepts a syntactically safe v2 envelope",
  );
  assert(Setup.readHandoffCookie({ document: v2Doc }) === "v2.e30", "reads back the written v2 handoff value");
  assert(v2Doc.lastWrite.includes("repforge_setup_v1="), "v2 still uses the historical repforge cookie name");

  const encoded = await Setup.encode(cloneFixture(MINIMAL_PAYLOAD), OPTS);
  if (encoded.ok) {
    const liveDoc = cookieJar();
    assert(
      Setup.writeHandoffCookie(encoded.value, { document: liveDoc, location: v2Loc }) === true,
      "writeHandoffCookie accepts a live encoded envelope",
    );
    assert(Setup.readHandoffCookie({ document: liveDoc }) === encoded.value, "live encoded cookie value is stored verbatim");
  }

  const unsafe = [
    ["attribute injection", "v1.abc; Path=/stolen"],
    ["unsupported version", "v3.abc"],
    ["unlabeled value", "not-a-setup"],
    ["padded base64", "v1.e30="],
    ["plus in payload", "v1.not+base64"],
    ["remainder 1", "v1.abcde"],
    ["oversize", `v1.${"a".repeat(MAX_ENCODED_CHARS)}`],
    ["empty envelope", "v1."],
    ["empty", ""],
    ["non-string", null],
  ];
  for (const [name, value] of unsafe) {
    const doc = cookieJar();
    const written = Setup.writeHandoffCookie(value, { document: doc, location: v2Loc });
    assert(written === false, `writeHandoffCookie rejects ${name}`);
    assert(doc.lastWrite === "", `unsafe ${name} does not write a cookie`, doc.lastWrite);
  }
}

console.log(`\nshared-setup unit tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
