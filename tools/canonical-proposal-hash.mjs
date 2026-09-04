// Canonical proposal-hash helper for docs/block-transition-provenance.md.
// Pure: deep-clones its input (frozen proposals allowed), never mutates the
// caller's data, and produces the documented digest. Run directly to verify
// the embedded fixture digest:
//   node tools/canonical-proposal-hash.mjs --check
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

export { canonicalJson, deepClone };

const EXPECTED_FIXTURE_DIGEST = "d9dca768503f79ba01d914ff7cc2bb7914c32fffb607b6b83f4605f3b94c19c1";

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  if (process.argv.includes("--check")) {
    const fixture = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "transition-proposal-v1.json"), "utf8"));
    const proposal = fixture.proposal;
    const digest = proposalHashOf(proposal);
    if (digest !== EXPECTED_FIXTURE_DIGEST) {
      console.error(`FAIL: fixture digest ${digest} != documented ${EXPECTED_FIXTURE_DIGEST}`);
      process.exit(1);
    }
    const frozen = deepFreeze(deepClone(proposal));
    const before = JSON.stringify(proposal);
    proposalHashOf(frozen);
    if (JSON.stringify(proposal) !== before) {
      console.error("FAIL: helper mutated its input");
      process.exit(1);
    }
    console.log(`pass: fixture digest verified (${digest.slice(0, 12)}…); frozen input accepted without mutation`);
  } else {
    const fixture = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "transition-proposal-v1.json"), "utf8"));
    console.log(proposalHashOf(fixture.proposal));
  }
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const k of Object.keys(value)) deepFreeze(value[k]);
    Object.freeze(value);
  }
  return value;
}
