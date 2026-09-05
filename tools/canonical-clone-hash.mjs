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
  const EXPECTED_FIXTURE_DIGEST = "a2989b2293c1c700a8dd9087b1ae856d5ed80c7eda8e2eefd048584c51812915";
  if (process.argv.includes("--check")) {
    // Zero-mutation proof: snapshot BEFORE any hashing occurs.
    const snapshotBefore = JSON.stringify(envelope);
    const digest = clonePayloadHashOf(envelope);
    if (digest !== EXPECTED_FIXTURE_DIGEST) {
      console.error(`FAIL: fixture digest ${digest} != documented ${EXPECTED_FIXTURE_DIGEST}`);
      process.exit(1);
    }
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
    const hostileKeys = ["__proto__", "constructor", "prototype"];
    let rejected = 0;
    for (const key of hostileKeys) {
      const raw = JSON.stringify(envelope).replace(/\}\s*$/, `,"${key}":1}`);
      try {
        clonePayloadHashOf(JSON.parse(raw));
      } catch (err) {
        if (err instanceof TypeError) rejected += 1;
      } finally {
        const probe = {};
        if (probe.polluted !== undefined || probe.prototype !== undefined) rejected = -1;
      }
    }
    if (rejected !== 3 || clonePayloadHashOf(safe) !== safeDigest) {
      console.error("FAIL: hostile-key handling");
      process.exit(1);
    }
    console.log(`pass: clone fixture digest verified (${digest.slice(0, 12)}…); frozen input accepted without mutation; hostile keys rejected`);
  } else {
    console.log(clonePayloadHashOf(envelope));
  }
}
