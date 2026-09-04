// Canonical proposal-hash helper for docs/block-transition-provenance.md.
// Pure, prototype-safe, no mutation, frozen inputs accepted. The preimage is
// the proposal with proposalHash/status/confirmedAt/archiveId removed;
// serialization is canonical JSON; the digest is lowercase hex SHA-256.
// Run directly to verify the embedded fixture digest:
//   node tools/canonical-proposal-hash.mjs --check
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deepClone, canonicalJson } from "./canonical-hash-core.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const SET_LIKE_PATHS = [
  ["diagnosis", "eligibleEvidenceIds"],
  ["diagnosis", "insufficientEvidenceReasons"],
  ["progressionContract", "preservedRelations"],
  ["progressionContract", "resetRelations"],
  ["progressionContract", "incompatibilities"],
];

// Returns the lowercase hex SHA-256 of the proposal's canonical preimage.
// The input is never mutated; frozen objects are accepted.
export function proposalHashOf(proposal) {
  const preimage = deepClone(proposal);
  delete preimage.proposalHash;
  delete preimage.status;
  delete preimage.confirmedAt;
  delete preimage.archiveId;
  for (const [section, field] of SET_LIKE_PATHS) {
    const v = preimage[section]?.[field];
    if (Array.isArray(v)) preimage[section][field] = [...new Set(v)].sort();
  }
  return createHash("sha256").update(canonicalJson(preimage), "utf8").digest("hex");
}

const thisFile = import.meta.url;
const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invoked && thisFile === invoked) {
  const fixture = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "transition-proposal-v1.json"), "utf8")).proposal;
  const EXPECTED_FIXTURE_DIGEST = "2b7cd59234ebed5426d369a188361288c97380ec7b649f8c38d73d62b199f50c";
  if (process.argv.includes("--check")) {
    const digest = proposalHashOf(fixture);
    if (digest !== EXPECTED_FIXTURE_DIGEST) {
      console.error(`FAIL: fixture digest ${digest} != documented ${EXPECTED_FIXTURE_DIGEST}`);
      process.exit(1);
    }
    // Zero-mutation proof: snapshot BEFORE hashing (not after), then compare.
    const snapshotBefore = JSON.stringify(fixture);
    const frozen = deepClone(fixture);
    (function deepFreeze(v) {
      if (v !== null && typeof v === "object") {
        for (const k of Object.keys(v)) deepFreeze(v[k]);
        Object.freeze(v);
      }
      return v;
    })(frozen);
    proposalHashOf(frozen);
    if (JSON.stringify(fixture) !== snapshotBefore) {
      console.error("FAIL: helper mutated its input");
      process.exit(1);
    }
    // Hostile-key regression: "__proto__"/"constructor" must not change a
    // digest or pollute the clone; JSON.parse of a raw "__proto__" key
    // produces an own property, which the helper rejects outright.
    const safe = { kind: "guided_manual_repair" };
    const safeDigest = proposalHashOf(safe);
    const hostile = JSON.parse('{"kind":"guided_manual_repair","__proto__":{"polluted":1}}');
    let rejected = false;
    try {
      proposalHashOf(hostile);
    } catch (err) {
      rejected = err instanceof TypeError;
    }
    const polluted = (() => { const o = {}; return o.polluted !== undefined; })();
    if (!rejected || polluted || proposalHashOf(safe) !== safeDigest) {
      console.error("FAIL: hostile-key handling");
      process.exit(1);
    }
    console.log(`pass: fixture digest verified (${digest.slice(0, 12)}…); frozen input accepted without mutation; hostile keys rejected`);
  } else {
    console.log(proposalHashOf(fixture));
  }
}
