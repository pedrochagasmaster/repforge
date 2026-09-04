// Canonical clone-hash helper for docs/adr/0013-temporary-install-transfer.md.
// Pure, prototype-safe, no mutation, frozen inputs accepted. The preimage is
// the envelope with integrity.canonicalPayloadHash removed; serialization is
// canonical JSON; the digest is lowercase hex SHA-256.
// Run directly to verify the embedded fixture:
//   node tools/canonical-clone-hash.mjs --check
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deepClone, canonicalJson } from "./canonical-hash-core.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Returns the lowercase hex SHA-256 of the envelope's canonical preimage
// (the whole envelope minus integrity.canonicalPayloadHash). The input is
// never mutated; frozen objects are accepted.
export function clonePayloadHashOf(envelope) {
  const preimage = deepClone(envelope);
  if (preimage.integrity) delete preimage.integrity.canonicalPayloadHash;
  return createHash("sha256").update(canonicalJson(preimage), "utf8").digest("hex");
}

const thisFile = import.meta.url;
const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invoked && thisFile === invoked) {
  const envelope = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "install-transfer-clone-v1.json"), "utf8"));
  const EXPECTED_FIXTURE_DIGEST = "72464d2b29018617533c3d364a7476db75f47b163d40d1ba4710084349b36a70";
  if (process.argv.includes("--check")) {
    const digest = clonePayloadHashOf(envelope);
    if (digest !== EXPECTED_FIXTURE_DIGEST) {
      console.error(`FAIL: fixture digest ${digest} != documented ${EXPECTED_FIXTURE_DIGEST}`);
      process.exit(1);
    }
    // Zero-mutation proof: snapshot BEFORE hashing.
    const snapshotBefore = JSON.stringify(envelope);
    const frozen = deepClone(envelope);
    (function deepFreeze(v) {
      if (v !== null && typeof v === "object") {
        for (const k of Object.keys(v)) deepFreeze(v[k]);
        Object.freeze(v);
      }
      return v;
    })(frozen);
    clonePayloadHashOf(frozen);
    if (JSON.stringify(envelope) !== snapshotBefore) {
      console.error("FAIL: helper mutated its input");
      process.exit(1);
    }
    // Hostile-key regression.
    const safe = { kind: "taurifer-install-transfer", schemaVersion: 1 };
    const safeDigest = clonePayloadHashOf(safe);
    const hostile = JSON.parse('{"kind":"taurifer-install-transfer","schemaVersion":1,"__proto__":{"polluted":1}}');
    let rejected = false;
    try {
      clonePayloadHashOf(hostile);
    } catch (err) {
      rejected = err instanceof TypeError;
    }
    const polluted = (() => { const o = {}; return o.polluted !== undefined; })();
    if (!rejected || polluted || clonePayloadHashOf(safe) !== safeDigest) {
      console.error("FAIL: hostile-key handling");
      process.exit(1);
    }
    console.log(`pass: clone fixture digest verified (${digest.slice(0, 12)}…); frozen input accepted without mutation; hostile keys rejected`);
  } else {
    console.log(clonePayloadHashOf(envelope));
  }
}
