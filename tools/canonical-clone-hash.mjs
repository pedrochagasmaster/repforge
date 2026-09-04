// Canonical payload-hash helper for docs/adr/0013-temporary-install-transfer.md.
// Pure, no mutation, frozen inputs accepted. The preimage is the clone
// envelope with integrity.canonicalPayloadHash removed (self-field
// exclusion); serialization is canonical JSON — recursively sorted object
// keys, UTF-8, no insignificant whitespace; the digest is lowercase hex
// SHA-256. Run directly to verify the embedded fixture:
//   node tools/canonical-clone-hash.mjs --check
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function deepClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(deepClone);
  const out = {};
  for (const k of Object.keys(value)) out[k] = deepClone(value[k]);
  return out;
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

// Returns the lowercase hex SHA-256 of the envelope's canonical preimage
// (the whole envelope minus integrity.canonicalPayloadHash). The input is
// never mutated; frozen objects are accepted.
export function clonePayloadHashOf(envelope) {
  const preimage = deepClone(envelope);
  if (preimage.integrity) delete preimage.integrity.canonicalPayloadHash;
  return createHash("sha256").update(canonicalJson(preimage), "utf8").digest("hex");
}

export { canonicalJson, deepClone };

const EXPECTED_FIXTURE_DIGEST = "7b37e28213618d66a426b7decfa5918b28a26ca54fabe0ead50d586260587147";

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  if (process.argv.includes("--check")) {
    const envelope = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "install-transfer-clone-v1.json"), "utf8"));
    const digest = clonePayloadHashOf(envelope);
    if (digest !== EXPECTED_FIXTURE_DIGEST) {
      console.error(`FAIL: fixture digest ${digest} != documented ${EXPECTED_FIXTURE_DIGEST}`);
      process.exit(1);
    }
    const frozen = deepClone(envelope);
    deepFreeze(frozen);
    const before = JSON.stringify(envelope);
    clonePayloadHashOf(frozen);
    if (JSON.stringify(envelope) !== before) {
      console.error("FAIL: helper mutated its input");
      process.exit(1);
    }
    console.log(`pass: clone fixture digest verified (${digest.slice(0, 12)}…); frozen input accepted without mutation`);
  } else {
    const envelope = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "install-transfer-clone-v1.json"), "utf8"));
    console.log(clonePayloadHashOf(envelope));
  }
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const k of Object.keys(value)) deepFreeze(value[k]);
    Object.freeze(value);
  }
  return value;
}
