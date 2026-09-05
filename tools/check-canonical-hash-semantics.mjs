// Independent semantic oracle for both Phase 0 hash contracts. The expected
// serializer lives here on purpose. The production helpers must agree with
// it while retaining their own prototype-safe implementation.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { clonePayloadHashOf } from "./canonical-clone-hash.mjs";
import { proposalHashOf } from "./canonical-proposal-hash.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
const proposal = readJson("test/fixtures/transition-proposal-v1.json").proposal;
const clone = readJson("test/fixtures/install-transfer-clone-v1.json");
const cloneValue = (value) => JSON.parse(JSON.stringify(value));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

// This serializer is deliberately separate from canonical-hash-core.mjs.
function oracleCanonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(oracleCanonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${oracleCanonicalJson(value[key])}`).join(",")}}`;
}

function digest(value) {
  return createHash("sha256").update(oracleCanonicalJson(value), "utf8").digest("hex");
}

function proposalPreimage(value) {
  const copy = cloneValue(value);
  delete copy.proposalHash;
  delete copy.status;
  delete copy.confirmedAt;
  delete copy.archiveId;
  for (const [section, field] of [
    ["diagnosis", "eligibleEvidenceIds"],
    ["diagnosis", "insufficientEvidenceReasons"],
    ["progressionContract", "preservedRelations"],
    ["progressionContract", "resetRelations"],
    ["progressionContract", "incompatibilities"],
  ]) {
    const values = copy[section]?.[field];
    if (Array.isArray(values)) copy[section][field] = [...new Set(values)].sort();
  }
  if (copy.derivation?.slotMapping) {
    delete copy.derivation.slotMapping.source;
    delete copy.derivation.slotMapping.rule;
  }
  return copy;
}

function clonePreimage(value) {
  const copy = cloneValue(value);
  if (copy.integrity) delete copy.integrity.canonicalPayloadHash;
  return copy;
}

const expectedProposalHash = "be72dc9b42ca73d12b8517b9dbe3d901cd9b592fc13591e52199ebcd20a4b204";
const expectedCloneHash = "a2989b2293c1c700a8dd9087b1ae856d5ed80c7eda8e2eefd048584c51812915";
const proposalOracleHash = digest(proposalPreimage(proposal));
const cloneOracleHash = digest(clonePreimage(clone));
assert(proposalOracleHash === expectedProposalHash, `independent proposal oracle drifted: ${proposalOracleHash}`);
assert(cloneOracleHash === expectedCloneHash, `independent clone oracle drifted: ${cloneOracleHash}`);
assert(proposalHashOf(proposal) === proposalOracleHash, "proposal helper disagrees with independent oracle");
assert(clonePayloadHashOf(clone) === cloneOracleHash, "clone helper disagrees with independent oracle");

const proposalScalar = cloneValue(proposal);
proposalScalar.predecessor.programId = "prog_local_scalar_mutation";
assert(proposalHashOf(proposalScalar) !== expectedProposalHash, "proposal scalar mutation did not change the digest");
const proposalOrdered = cloneValue(proposal);
proposalOrdered.diff.exercises.reverse();
assert(proposalHashOf(proposalOrdered) !== expectedProposalHash, "proposal ordered-array mutation did not change the digest");
const proposalSetPermutation = cloneValue(proposal);
proposalSetPermutation.diagnosis.eligibleEvidenceIds = ["sessions-14d-3-of-6", "sessions-14d-6-of-3", "sessions-14d-3-of-6"];
assert(proposalHashOf(proposalSetPermutation) === expectedProposalHash, "proposal set-like permutation or duplicate normalization changed the digest");
const proposalLifecycle = cloneValue(proposal);
proposalLifecycle.status = "committed";
proposalLifecycle.confirmedAt = "2026-10-01T09:12:00.000Z";
proposalLifecycle.archiveId = "arc_lifecycle_only";
assert(proposalHashOf(proposalLifecycle) === expectedProposalHash, "proposal lifecycle fields changed the digest");

const cloneScalar = cloneValue(clone);
cloneScalar.sourceRevision += 1;
assert(clonePayloadHashOf(cloneScalar) !== expectedCloneHash, "clone scalar mutation did not change the digest");
const cloneOrdered = cloneValue(clone);
cloneOrdered.durableState.program.reverse();
assert(clonePayloadHashOf(cloneOrdered) !== expectedCloneHash, "clone ordered-array mutation did not change the digest");
const cloneSelfField = cloneValue(clone);
cloneSelfField.integrity.canonicalPayloadHash = "0".repeat(64);
assert(clonePayloadHashOf(cloneSelfField) === expectedCloneHash, "clone self-field changed the digest");

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
const proposalSnapshot = JSON.stringify(proposal);
const cloneSnapshot = JSON.stringify(clone);
proposalHashOf(deepFreeze(cloneValue(proposal)));
clonePayloadHashOf(deepFreeze(cloneValue(clone)));
assert(JSON.stringify(proposal) === proposalSnapshot, "proposal helper mutated its input");
assert(JSON.stringify(clone) === cloneSnapshot, "clone helper mutated its input");

function hostileCopy(value, key) {
  const raw = JSON.stringify(value).replace(/}\s*$/, `,"${key}":1}`);
  return JSON.parse(raw);
}
for (const key of ["__proto__", "constructor", "prototype"]) {
  for (const [label, helper, value] of [
    ["proposal", proposalHashOf, proposal],
    ["clone", clonePayloadHashOf, clone],
  ]) {
    let rejected = false;
    try { helper(hostileCopy(value, key)); } catch (error) { rejected = error instanceof TypeError; }
    assert(rejected, `${label} helper accepted hostile key ${key}`);
    const probe = {};
    assert(probe.polluted === undefined && probe.prototype === undefined, `${label} hostile key polluted the global prototype`);
  }
}

console.log(`pass: independent oracle agrees for proposal ${expectedProposalHash.slice(0, 12)}… and clone ${expectedCloneHash.slice(0, 12)}…; scalar/order/set/lifecycle/frozen/hostile proofs passed`);
