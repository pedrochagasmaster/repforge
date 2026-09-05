// Re-runnable negative controls for the compiler-grounded transition oracle.
// Each mutation is isolated, passed through the same validator used by the
// canonical contradiction gate, and required to fail for a semantic reason.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { proposalHashOf } from "./canonical-proposal-hash.mjs";
import {
  deriveDayDiff,
  deriveExerciseDiff,
  derivePrescriptionDiff,
  deriveSlotMapping,
  validateSlotMapping,
  validateTransitionProposal,
} from "./transition-mapping-oracle.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
const fixture = readJson("test/fixtures/transition-proposal-v1.json");
const compiler = readJson("test/fixtures/program-families-v1.json");
const base = fixture.proposal;
const compilationOf = (blueprintId) => compiler.reviewCompilations.find((entry) => entry.blueprintId === blueprintId);
const predecessorCompilation = compilationOf(base.predecessor.compilerProvenance.blueprintId);
const successorCompilation = compilationOf(base.successor.compilerProvenance.blueprintId);
const clone = (value) => JSON.parse(JSON.stringify(value));
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
const pairEnd = (proposal) => proposal.derivation.slotMapping.slots.findIndex((row) => !row.predecessorSlot && row.successorSlot);
const removalStart = (proposal) => proposal.derivation.slotMapping.slots.findIndex((row) => row.predecessorSlot && !row.successorSlot);

const baseErrors = validateTransitionProposal(base, predecessorCompilation, successorCompilation);
check(baseErrors.length === 0, `repaired fixture does not pass: ${baseErrors.join("; ")}`);

function mappingMutation(name, mutate, expectedMessage) {
  const proposal = clone(base);
  mutate(proposal);
  const errors = validateTransitionProposal(proposal, predecessorCompilation, successorCompilation);
  check(errors.some((error) => error.includes(expectedMessage)), `${name}: missing semantic failure "${expectedMessage}"; got ${errors.join("; ")}`);
  return errors;
}

mappingMutation("pair-after-addition", (proposal) => {
  const slots = proposal.derivation.slotMapping.slots;
  const addition = pairEnd(proposal);
  [slots[0], slots[addition]] = [slots[addition], slots[0]];
}, "pair-after-addition");

mappingMutation("reordered pairs", (proposal) => {
  const slots = proposal.derivation.slotMapping.slots;
  [slots[0], slots[1]] = [slots[1], slots[0]];
}, "reordered pairs");

mappingMutation("reordered additions", (proposal) => {
  const slots = proposal.derivation.slotMapping.slots;
  const start = pairEnd(proposal);
  [slots[start], slots[start + 1]] = [slots[start + 1], slots[start]];
}, "reordered additions");

mappingMutation("reordered removals", (proposal) => {
  const slots = proposal.derivation.slotMapping.slots;
  const start = removalStart(proposal);
  [slots[start], slots[start + 1]] = [slots[start + 1], slots[start]];
}, "reordered removals");

mappingMutation("addition-after-removal", (proposal) => {
  const slots = proposal.derivation.slotMapping.slots;
  const addition = pairEnd(proposal);
  const removal = removalStart(proposal);
  [slots[addition], slots[removal]] = [slots[removal], slots[addition]];
}, "addition-after-removal");

mappingMutation("wrong earliest same-template selection", (proposal) => {
  const slots = proposal.derivation.slotMapping.slots;
  const pair = slots.find((row) => row.predecessorSlot === "growth_4_d2_s2");
  const removal = slots.find((row) => row.predecessorSlot === "growth_4_d4_s1");
  check(pair && removal, "wrong-earliest setup rows are missing");
  pair.predecessorSlot = "growth_4_d4_s1";
  pair.predecessorMovement = "library:hg_mc";
  removal.predecessorSlot = "growth_4_d2_s2";
  removal.predecessorMovement = "library:hg_mc";
}, "wrong earliest same-template predecessor selection");

mappingMutation("duplicate successor", (proposal) => {
  const slots = proposal.derivation.slotMapping.slots;
  slots[1].successorSlot = slots[0].successorSlot;
  slots[1].successorMovement = slots[0].successorMovement;
}, "duplicate successor identity");

mappingMutation("missing removal", (proposal) => {
  proposal.derivation.slotMapping.slots.pop();
}, "missing removal identity");

mappingMutation("incompatible movement", (proposal) => {
  proposal.derivation.slotMapping.slots[0].successorMovement = "library:incompatible";
}, "movement mismatch on successor");

const contractMutation = clone(base);
contractMutation.derivation.slotMapping.contract = "wrong-contract";
const contractErrors = validateSlotMapping(contractMutation.derivation.slotMapping, predecessorCompilation, successorCompilation);
check(contractErrors.some((error) => error.includes("invalid contract")), `invalid contract was accepted: ${contractErrors.join("; ")}`);

const schemaMutation = clone(base);
schemaMutation.derivation.slotMapping.schemaVersion = 99;
const schemaErrors = validateSlotMapping(schemaMutation.derivation.slotMapping, predecessorCompilation, successorCompilation);
check(schemaErrors.some((error) => error.includes("invalid schemaVersion")), `invalid mapping schema was accepted: ${schemaErrors.join("; ")}`);

const enumMutation = clone(base);
enumMutation.kind = "invented_transition";
const enumErrors = validateTransitionProposal(enumMutation, predecessorCompilation, successorCompilation);
check(enumErrors.some((error) => error.includes("invalid kind")), `invalid transition kind was accepted: ${enumErrors.join("; ")}`);

const noDayDiff = clone(base);
delete noDayDiff.diff.days;
const noDayDiffErrors = validateTransitionProposal(noDayDiff, predecessorCompilation, successorCompilation);
check(noDayDiffErrors.some((error) => error.includes("diff.days: missing")), `deleted diff.days was accepted: ${noDayDiffErrors.join("; ")}`);

const noPrescriptionDiff = clone(base);
delete noPrescriptionDiff.diff.prescriptions;
const noPrescriptionDiffErrors = validateTransitionProposal(noPrescriptionDiff, predecessorCompilation, successorCompilation);
check(noPrescriptionDiffErrors.some((error) => error.includes("diff.prescriptions: missing")), `deleted diff.prescriptions was accepted: ${noPrescriptionDiffErrors.join("; ")}`);

const fabricatedReason = clone(base);
fabricatedReason.diff.exercises[0].reason = "fabricated reason";
const fabricatedReasonErrors = validateTransitionProposal(fabricatedReason, predecessorCompilation, successorCompilation);
check(fabricatedReasonErrors.some((error) => error.includes("invalid reason")), `fabricated exercise reason was accepted: ${fabricatedReasonErrors.join("; ")}`);

function independentDayRows(mapping, predecessor, successor) {
  const predecessorBySlot = new Map(predecessor.days.flatMap((day, dayIndex) =>
    day.slots.map((slot, slotIndex) => [slot.slotId, { day, dayIndex, slotIndex }])),
  );
  const successorBySlot = new Map(successor.days.flatMap((day, dayIndex) =>
    day.slots.map((slot, slotIndex) => [slot.slotId, { day, dayIndex, slotIndex }])),
  );
  const pairedSuccessorDays = new Map();
  const pairedPredecessorDays = new Set();
  for (const row of mapping.slots) {
    if (!row.predecessorSlot || !row.successorSlot) continue;
    const predecessorSlot = predecessorBySlot.get(row.predecessorSlot);
    const successorSlot = successorBySlot.get(row.successorSlot);
    if (!predecessorSlot || !successorSlot) continue;
    if (pairedSuccessorDays.has(successorSlot.day.dayId) || pairedPredecessorDays.has(predecessorSlot.day.dayId)) continue;
    pairedSuccessorDays.set(successorSlot.day.dayId, predecessorSlot.day.dayId);
    pairedPredecessorDays.add(predecessorSlot.day.dayId);
  }
  const rows = successor.days.map((day) => ({
    predecessorDay: pairedSuccessorDays.get(day.dayId) ?? null,
    successorDay: day.dayId,
  }));
  for (const day of [...predecessor.days].sort((a, b) => a.dayId.localeCompare(b.dayId))) {
    if (!pairedPredecessorDays.has(day.dayId)) rows.push({ predecessorDay: day.dayId, successorDay: null });
  }
  return rows;
}

function syntheticProposal(predecessor, successor) {
  const mapping = deriveSlotMapping(predecessor, successor);
  return {
    schemaVersion: 1,
    kind: "same_family_sibling",
    derivation: { slotMapping: mapping },
    diff: {
      days: deriveDayDiff(mapping, predecessor, successor),
      exercises: deriveExerciseDiff(mapping, predecessor, successor),
      prescriptions: derivePrescriptionDiff(mapping, predecessor, successor),
    },
  };
}

const matrix = compiler.reviewCompilations
  .map((entry) => entry.blueprintId)
  .map((blueprintId) => {
    const match = blueprintId.match(/^(.+?)_(\d+)_v\d+$/);
    return { blueprintId, family: match?.[1], frequency: Number(match?.[2]) };
  })
  .filter((entry) => entry.family && Number.isInteger(entry.frequency));
const matrixById = new Map(compiler.reviewCompilations.map((entry) => [entry.blueprintId, entry]));
let matrixCount = 0;
for (const predecessorInfo of matrix) {
  for (const successorInfo of matrix) {
    if (predecessorInfo.family !== successorInfo.family || predecessorInfo.frequency <= successorInfo.frequency) continue;
    const predecessor = matrixById.get(predecessorInfo.blueprintId);
    const successor = matrixById.get(successorInfo.blueprintId);
    const proposal = syntheticProposal(predecessor, successor);
    const errors = validateTransitionProposal(proposal, predecessor, successor);
    check(errors.length === 0, `${predecessorInfo.blueprintId} -> ${successorInfo.blueprintId} rejected: ${errors.join("; ")}`);
    check(
      JSON.stringify(proposal.derivation.slotMapping.days) === JSON.stringify(independentDayRows(proposal.derivation.slotMapping, predecessor, successor)),
      `${predecessorInfo.blueprintId} -> ${successorInfo.blueprintId} day mapping disagrees with independent compiler enumeration`,
    );
    matrixCount += 1;
  }
}
check(matrixCount === 40, `expected 40 same-family descending sibling combinations, checked ${matrixCount}`);

const successorOnlyDayCases = [
  ["growth_6_v1", "growth_2_v1", "growth_2_d2"],
  ["balanced_5_v1", "balanced_4_v1", "balanced_4_d4"],
  ["balanced_6_v1", "balanced_4_v1", "balanced_4_d4"],
  ["strength_6_v1", "strength_4_v1", "strength_4_d4"],
  ["strength_6_v1", "strength_5_v1", "strength_5_d4"],
];
for (const [predecessorId, successorId, successorDayId] of successorOnlyDayCases) {
  const predecessor = matrixById.get(predecessorId);
  const successor = matrixById.get(successorId);
  const proposal = syntheticProposal(predecessor, successor);
  check(
    proposal.derivation.slotMapping.days.some((row) => row.predecessorDay === null && row.successorDay === successorDayId),
    `${predecessorId} -> ${successorId} omitted successor-only day ${successorDayId}`,
  );
}

const growthPredecessor = matrixById.get("growth_6_v1");
const growthSuccessor = matrixById.get("growth_2_v1");
const growthSuccessorOnly = syntheticProposal(growthPredecessor, growthSuccessor);
growthSuccessorOnly.derivation.slotMapping.days = growthSuccessorOnly.derivation.slotMapping.days.filter(
  (row) => row.successorDay !== "growth_2_d2",
);
growthSuccessorOnly.diff.days = growthSuccessorOnly.diff.days.filter(
  (row) => row.successorDay !== "growth_2_d2",
);
const successorOnlyErrors = validateTransitionProposal(growthSuccessorOnly, growthPredecessor, growthSuccessor);
check(successorOnlyErrors.some((error) => error.includes("day mapping") || error.includes("diff.days")), `successor-only day omission was accepted: ${successorOnlyErrors.join("; ")}`);

const expectedHash = "c7a4c90322522d6d990fdd7e7e51c7da0de7b349f2d3e959619b9c1d9e9feadc";
check(proposalHashOf(base) === expectedHash, "base proposal hash no longer matches the repaired fixture");
const scalarMutation = clone(base);
scalarMutation.predecessor.programId = "prog_local_mutated";
check(proposalHashOf(scalarMutation) !== expectedHash, "scalar semantic mutation did not change proposal hash");
const orderedMutation = clone(base);
orderedMutation.diff.exercises.reverse();
check(proposalHashOf(orderedMutation) !== expectedHash, "ordered diff mutation did not change proposal hash");

const optionalFixture = readJson("test/fixtures/transition-optional-slots-v1.json");
const optionalPredecessor = compilationOf(optionalFixture.predecessorBlueprintId);
const optionalSuccessor = compilationOf(optionalFixture.successorBlueprintId);
const optionalErrors = validateSlotMapping(optionalFixture.mapping, optionalPredecessor, optionalSuccessor);
check(optionalErrors.length === 0, `optional-slot repaired fixture does not pass: ${optionalErrors.join("; ")}`);
const optionalSlots = optionalFixture.mapping.slots;
const optionalExpected = deriveSlotMapping(optionalPredecessor, optionalSuccessor);
check(
  optionalSlots.some((row) => row.predecessorSlot?.includes("_s6") && row.successorSlot?.includes("_s6")),
  "optional-slot fixture does not contain a same-template optional pair",
);
check(JSON.stringify(optionalSlots) === JSON.stringify(optionalExpected.slots), "optional-slot fixture is not the derived ordered mapping");

console.log(`pass: repaired mapping/diff accepted; ${[
  "pair-after-addition",
  "reordered pairs",
  "reordered additions",
  "reordered removals",
  "addition-after-removal",
  "wrong earliest same-template selection",
  "duplicate successor",
  "missing removal",
  "incompatible movement",
  "contract/schema/enum/hash",
  "deleted diff.days",
  "deleted diff.prescriptions",
  "fabricated exercise reason",
  "successor-only day omission",
].length} semantic negative controls rejected; optional sibling pair and ${matrixCount} sibling combinations covered`);
