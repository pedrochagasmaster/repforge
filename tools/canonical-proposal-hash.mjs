// Computes the canonical proposalHash fixture embedded in
// docs/block-transition-provenance.md, proving the documented preimage rule
// is executable: project out lifecycle fields, sort set-like arrays, emit
// canonical JSON (sorted keys, UTF-8, no whitespace), SHA-256, lowercase hex.
import { createHash } from "node:crypto";

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

export function proposalHashOf(proposal) {
  const preimage = { ...proposal };
  delete preimage.proposalHash;
  delete preimage.status;
  delete preimage.confirmedAt;
  delete preimage.archiveId;
  for (const path of [
    ["diagnosis", "eligibleEvidenceIds"],
    ["diagnosis", "insufficientEvidenceReasons"],
    ["progressionContract", "preservedRelations"],
    ["progressionContract", "resetRelations"],
    ["progressionContract", "incompatibilities"],
  ]) {
    const v = preimage[path[0]]?.[path[1]];
    if (Array.isArray(v)) preimage[path[0]][path[1]] = [...new Set(v)].sort();
  }
  return createHash("sha256").update(canonicalJson(preimage), "utf8").digest("hex");
}

export { canonicalJson };

if (import.meta.url === `file://${process.argv[1]}`) {
  const fixture = JSON.parse(readFileSync(new URL("../test/fixtures/transition-proposal-v1.json", import.meta.url)));
  console.log(proposalHashOf(fixture.proposal));
}
