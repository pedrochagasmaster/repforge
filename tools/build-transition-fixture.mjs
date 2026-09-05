// Rebuilds the transition fixture from the authoritative compiler fixture.
// The mapping and diff are generated together so a hand-edited identity or
// order cannot survive separately from the compiler-grounded oracle.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { proposalHashOf } from "./canonical-proposal-hash.mjs";
import {
  deriveDayDiff,
  deriveExerciseDiff,
  derivePrescriptionDiff,
  deriveSlotMapping,
} from "./transition-mapping-oracle.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
const compiler = readJson("test/fixtures/program-families-v1.json");
const fixturePath = join(ROOT, "test/fixtures/transition-proposal-v1.json");
const fixture = readJson("test/fixtures/transition-proposal-v1.json");
const proposal = fixture.proposal;
const compilationOf = (blueprintId) => compiler.reviewCompilations.find((entry) => entry.blueprintId === blueprintId);
const predecessorCompilation = compilationOf(proposal.predecessor.compilerProvenance.blueprintId);
const successorCompilation = compilationOf(proposal.successor.compilerProvenance.blueprintId);
if (!predecessorCompilation || !successorCompilation) throw new Error("transition fixture compiler provenance is not present in program-families-v1.json");

const previousMapping = proposal.derivation.slotMapping;
const mapping = deriveSlotMapping(predecessorCompilation, successorCompilation);
proposal.derivation.slotMapping = {
  ...previousMapping,
  ...mapping,
  source: previousMapping.source,
  rule: previousMapping.rule,
};
proposal.diff.exercises = deriveExerciseDiff(
  proposal.derivation.slotMapping,
  predecessorCompilation,
  successorCompilation,
  proposal.diff.exercises,
);
proposal.diff.days = deriveDayDiff(
  proposal.derivation.slotMapping,
  predecessorCompilation,
  successorCompilation,
  proposal.diff.days,
);
proposal.diff.prescriptions = derivePrescriptionDiff(
  proposal.derivation.slotMapping,
  predecessorCompilation,
  successorCompilation,
  proposal.diff.prescriptions,
);
proposal.proposalHash = undefined;
delete proposal.proposalHash;
writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`);

const proposalHash = proposalHashOf(proposal);
const optionalPredecessor = compilationOf("growth_3_v1");
const optionalSuccessor = compilationOf("growth_2_v1");
const optionalMapping = deriveSlotMapping(optionalPredecessor, optionalSuccessor);
const optionalFixture = {
  schemaVersion: 1,
  predecessorBlueprintId: "growth_3_v1",
  successorBlueprintId: "growth_2_v1",
  mapping: {
    ...optionalMapping,
    source: "test/fixtures/program-families-v1.json reviewCompilations (growth_3_v1 -> growth_2_v1, optional-arm sibling)",
    rule: previousMapping.rule,
  },
};
writeFileSync(join(ROOT, "test/fixtures/transition-optional-slots-v1.json"), `${JSON.stringify(optionalFixture, null, 2)}\n`);

const example = {
  ...proposal,
  status: "committed",
  confirmedAt: "2026-10-01T09:12:00.000Z",
  archiveId: "arc_01J9Z8X7C6V5B4N3M1",
  proposalHash,
};
const provenancePath = join(ROOT, "docs/block-transition-provenance.md");
const provenance = readFileSync(provenancePath, "utf8");
const jsonBlock = /```json\n[\s\S]*?\n```/;
if (!jsonBlock.test(provenance)) throw new Error("transition provenance example JSON block is missing");
writeFileSync(provenancePath, provenance.replace(jsonBlock, `\`\`\`json\n${JSON.stringify(example, null, 2)}\n\`\`\``));

console.log(`transition fixture rebuilt from compiler; exercises: ${proposal.diff.exercises.length}; proposal hash: ${proposalHash}`);
console.log(`optional sibling fixture: ${optionalFixture.mapping.slots.filter((row) => row.predecessorSlot && row.successorSlot).length} pairs including optional_arms`);
