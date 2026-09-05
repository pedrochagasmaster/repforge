// Compiler-grounded transition mapping and diff oracle used by the Phase 0
// checker and its isolated negative-control harness. This is documentation
// evidence, not a runtime transition implementation.

const MOVEMENT_PREFIX = "library:";
const MAPPING_CONTRACT = "taurifer-transition-slot-mapping";
const MAPPING_SCHEMA_VERSION = 1;
const TRANSITION_KINDS = new Set([
  "same_family_sibling",
  "lower_frequency_sibling",
  "shorter_session_sibling",
  "guided_manual_repair",
  "reduce_training_volume",
  "recovery_week",
  "repeat",
  "continue",
]);

export function movementOf(slot) {
  if (!slot || typeof slot.libraryId !== "string") return null;
  return `${MOVEMENT_PREFIX}${slot.libraryId}`;
}

export function flattenCompilation(compilation) {
  const entries = [];
  for (const [dayIndex, day] of (compilation?.days || []).entries()) {
    for (const [slotIndex, slot] of (day.slots || []).entries()) {
      entries.push({
        slot,
        slotId: slot.slotId,
        dayId: day.dayId,
        dayIndex,
        slotIndex,
      });
    }
  }
  return entries;
}

const slotOrder = (a, b) => a.dayIndex - b.dayIndex || a.slotIndex - b.slotIndex;

function entryMap(entries) {
  return new Map(entries.map((entry) => [entry.slotId, entry]));
}

function mappingRow(predecessor, successor) {
  return {
    predecessorSlot: predecessor?.slotId ?? null,
    successorSlot: successor?.slotId ?? null,
    predecessorMovement: predecessor ? movementOf(predecessor.slot) : null,
    successorMovement: successor ? movementOf(successor.slot) : null,
  };
}

export function deriveSlotMapping(predecessorCompilation, successorCompilation) {
  const predecessors = flattenCompilation(predecessorCompilation).sort(slotOrder);
  const successors = flattenCompilation(successorCompilation).sort(slotOrder);
  const predecessorById = entryMap(predecessors);
  const successorById = entryMap(successors);
  const used = new Set();
  const slots = [];

  // Every same-template successor is eligible for the first pass, including
  // optional work. The governing rule does not invent an optional exclusion.
  for (const successor of successors) {
    const candidate = predecessors.find((predecessor) =>
      !used.has(predecessor.slotId) &&
      predecessor.slot.templateId === successor.slot.templateId &&
      predecessor.dayIndex <= successor.dayIndex,
    );
    if (!candidate) continue;
    used.add(candidate.slotId);
    slots.push(mappingRow(candidate, successor));
  }

  for (const successor of successors) {
    if (!slots.some((row) => row.successorSlot === successor.slotId)) {
      slots.push(mappingRow(null, successor));
    }
  }
  for (const predecessor of predecessors) {
    if (!used.has(predecessor.slotId)) slots.push(mappingRow(predecessor, null));
  }

  const days = [];
  const seenPredecessorDays = new Set();
  for (const row of slots) {
    if (!row.predecessorSlot || !row.successorSlot) continue;
    const predecessor = predecessorById.get(row.predecessorSlot);
    const successor = successorById.get(row.successorSlot);
    if (seenPredecessorDays.has(predecessor.dayId)) continue;
    seenPredecessorDays.add(predecessor.dayId);
    days.push({ predecessorDay: predecessor.dayId, successorDay: successor.dayId });
  }
  for (const predecessor of predecessors) {
    if (!seenPredecessorDays.has(predecessor.dayId)) {
      seenPredecessorDays.add(predecessor.dayId);
      days.push({ predecessorDay: predecessor.dayId, successorDay: null });
    }
  }

  return {
    contract: MAPPING_CONTRACT,
    schemaVersion: MAPPING_SCHEMA_VERSION,
    days,
    slots,
  };
}

export function slotSnapshot(entry) {
  if (!entry) return null;
  return {
    movement: movementOf(entry.slot),
    index: entry.slotIndex,
    sets: entry.slot.sets,
  };
}

function rowKey(row) {
  return `${row.predecessorSlot ?? "∅"}->${row.successorSlot ?? "∅"}`;
}

function diffReason(row, predecessor, successor) {
  if (!predecessor) return "added successor slot";
  if (!successor) return "removed predecessor slot";
  if (row.predecessorMovement !== row.successorMovement) return "mapped same-template slot with movement change";
  if (predecessor.dayId !== successor.dayId || predecessor.slotIndex !== successor.slotIndex) {
    return "mapped same-template slot changed day or order";
  }
  return "mapped same-template slot";
}

export function deriveExerciseDiff(mapping, predecessorCompilation, successorCompilation, priorDiff = []) {
  const predecessors = entryMap(flattenCompilation(predecessorCompilation));
  const successors = entryMap(flattenCompilation(successorCompilation));
  const priorReasons = new Map((priorDiff || []).map((row) => [rowKey(row), row.reason]));
  return mapping.slots.map((row) => {
    const predecessor = row.predecessorSlot ? predecessors.get(row.predecessorSlot) : null;
    const successor = row.successorSlot ? successors.get(row.successorSlot) : null;
    return {
      predecessorSlot: row.predecessorSlot,
      successorSlot: row.successorSlot,
      movement: row.successorMovement,
      before: slotSnapshot(predecessor),
      after: slotSnapshot(successor),
      reason: priorReasons.get(rowKey(row)) || diffReason(row, predecessor, successor),
    };
  });
}

const phaseOf = (row) => row.predecessorSlot && row.successorSlot ? 0 : row.successorSlot ? 1 : 2;
const phaseName = (phase) => ["pairs", "additions", "removals"][phase];
const sameIds = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
const sameMultiset = (a, b) => a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index]);

function mappingShapeErrors(mapping) {
  const errors = [];
  if (!mapping || typeof mapping !== "object") return ["slot mapping: missing mapping object"];
  if (mapping.contract !== MAPPING_CONTRACT) errors.push(`slot mapping: invalid contract "${String(mapping.contract)}"`);
  if (mapping.schemaVersion !== MAPPING_SCHEMA_VERSION) errors.push(`slot mapping: invalid schemaVersion ${String(mapping.schemaVersion)}`);
  if (!Array.isArray(mapping.days)) errors.push("slot mapping: days must be an array");
  if (!Array.isArray(mapping.slots)) errors.push("slot mapping: slots must be an array");
  return errors;
}

export function validateSlotMapping(mapping, predecessorCompilation, successorCompilation) {
  const errors = mappingShapeErrors(mapping);
  if (errors.length || !Array.isArray(mapping.slots)) return errors;
  const expected = deriveSlotMapping(predecessorCompilation, successorCompilation);
  const predecessors = new Map(flattenCompilation(predecessorCompilation).map((entry) => [entry.slotId, entry]));
  const successors = new Map(flattenCompilation(successorCompilation).map((entry) => [entry.slotId, entry]));
  const rows = mapping.slots;
  const expectedRows = expected.slots;
  const predecessorIds = rows.map((row) => row.predecessorSlot).filter(Boolean);
  const successorIds = rows.map((row) => row.successorSlot).filter(Boolean);
  if (new Set(predecessorIds).size !== predecessorIds.length) errors.push("slot mapping: duplicate predecessor identity");
  if (new Set(successorIds).size !== successorIds.length) errors.push("slot mapping: duplicate successor identity");

  for (const row of rows) {
    const predecessor = row.predecessorSlot ? predecessors.get(row.predecessorSlot) : null;
    const successor = row.successorSlot ? successors.get(row.successorSlot) : null;
    if (row.predecessorSlot && !predecessor) errors.push(`slot mapping: unknown predecessor slot "${row.predecessorSlot}"`);
    if (row.successorSlot && !successor) errors.push(`slot mapping: unknown successor slot "${row.successorSlot}"`);
    if (predecessor && row.predecessorMovement !== movementOf(predecessor.slot)) {
      errors.push(`slot mapping: movement mismatch on predecessor "${row.predecessorSlot}"`);
    }
    if (successor && row.successorMovement !== movementOf(successor.slot)) {
      errors.push(`slot mapping: movement mismatch on successor "${row.successorSlot}"`);
    }
    if (!row.predecessorSlot && !row.successorSlot) errors.push("slot mapping: row is neither pair, addition, nor removal");
    if (predecessor && successor && predecessor.slot.templateId !== successor.slot.templateId) {
      errors.push(`slot mapping: incompatible template pair (${row.predecessorSlot} -> ${row.successorSlot})`);
    }
  }

  const expectedPredecessorIds = expectedRows.map((row) => row.predecessorSlot).filter(Boolean);
  const expectedSuccessorIds = expectedRows.map((row) => row.successorSlot).filter(Boolean);
  for (const id of expectedPredecessorIds) {
    if (!predecessorIds.includes(id)) {
      const expectedRow = expectedRows.find((row) => row.predecessorSlot === id);
      errors.push(expectedRow?.successorSlot ? `slot mapping: missing predecessor identity "${id}"` : `slot mapping: missing removal identity "${id}"`);
    }
  }
  for (const id of expectedSuccessorIds) {
    if (!successorIds.includes(id)) {
      const expectedRow = expectedRows.find((row) => row.successorSlot === id);
      errors.push(expectedRow?.predecessorSlot ? `slot mapping: missing successor identity "${id}"` : `slot mapping: missing addition identity "${id}"`);
    }
  }

  const actualPairRows = rows.filter((row) => row.predecessorSlot && row.successorSlot);
  const expectedPairRows = expectedRows.filter((row) => row.predecessorSlot && row.successorSlot);
  const actualPairKeys = actualPairRows.map(rowKey);
  const expectedPairKeys = expectedPairRows.map(rowKey);
  const actualAdditionKeys = rows.filter((row) => !row.predecessorSlot && row.successorSlot).map(rowKey);
  const expectedAdditionKeys = expectedRows.filter((row) => !row.predecessorSlot && row.successorSlot).map(rowKey);
  const actualRemovalKeys = rows.filter((row) => row.predecessorSlot && !row.successorSlot).map(rowKey);
  const expectedRemovalKeys = expectedRows.filter((row) => row.predecessorSlot && !row.successorSlot).map(rowKey);
  const phases = rows.map(phaseOf);
  for (let i = 1; i < phases.length; i += 1) {
    if (phases[i] >= phases[i - 1]) continue;
    if (phases[i] === 0 && phases[i - 1] === 1) errors.push("slot mapping: pair-after-addition");
    else if (phases[i] === 1 && phases[i - 1] === 2) errors.push("slot mapping: addition-after-removal");
    else errors.push(`slot mapping: reordered ${phaseName(phases[i])}`);
    break;
  }
  if (sameMultiset(actualPairKeys, expectedPairKeys) && !sameIds(actualPairKeys, expectedPairKeys)) errors.push("slot mapping: reordered pairs");
  if (sameMultiset(actualAdditionKeys, expectedAdditionKeys) && !sameIds(actualAdditionKeys, expectedAdditionKeys)) errors.push("slot mapping: reordered additions");
  if (sameMultiset(actualRemovalKeys, expectedRemovalKeys) && !sameIds(actualRemovalKeys, expectedRemovalKeys)) errors.push("slot mapping: reordered removals");
  if (sameMultiset(predecessorIds, expectedPredecessorIds) && sameMultiset(successorIds, expectedSuccessorIds) &&
      !sameMultiset(actualPairKeys, expectedPairKeys)) {
    errors.push("slot mapping: wrong earliest same-template predecessor selection");
  }
  if (rows.length === expectedRows.length && !rows.every((row, index) => rowKey(row) === rowKey(expectedRows[index]))) {
    errors.push("slot mapping: full ordered mapping does not match the documented rule applied to compiler output");
  }
  if (Array.isArray(mapping.days) && JSON.stringify(mapping.days) !== JSON.stringify(expected.days)) {
    errors.push("slot mapping: day mapping does not match earliest-paired derivation");
  }
  return [...new Set(errors)];
}

export function validateExerciseDiff(proposal, predecessorCompilation, successorCompilation) {
  const mapping = proposal?.derivation?.slotMapping;
  if (!mapping || !Array.isArray(proposal?.diff?.exercises)) return ["diff.exercises: missing exercises array or slot mapping"];
  const expected = deriveExerciseDiff(mapping, predecessorCompilation, successorCompilation, proposal.diff.exercises);
  const actual = proposal.diff.exercises;
  const errors = [];
  if (actual.length !== expected.length) errors.push(`diff.exercises: expected ${expected.length} rows derived from slotMapping, received ${actual.length}`);
  const length = Math.max(actual.length, expected.length);
  for (let index = 0; index < length; index += 1) {
    const row = actual[index];
    const want = expected[index];
    if (!row || !want) continue;
    if (rowKey(row) !== rowKey(want)) errors.push(`diff.exercises: order/identity mismatch at index ${index}`);
    if (row.movement !== want.movement) errors.push(`diff.exercises: movement identity mismatch at index ${index}`);
    for (const side of ["before", "after"]) {
      const got = row[side];
      const expectedSnapshot = want[side];
      if (JSON.stringify(got) !== JSON.stringify(expectedSnapshot)) {
        errors.push(`diff.exercises: ${side} snapshot mismatch at index ${index}`);
      }
    }
  }
  return [...new Set(errors)];
}

export function validateTransitionProposal(proposal, predecessorCompilation, successorCompilation, { checkHash = false } = {}) {
  const errors = [];
  if (!proposal || typeof proposal !== "object") return ["transition proposal: missing proposal object"];
  if (proposal.schemaVersion !== 1) errors.push(`transition proposal: invalid schemaVersion ${String(proposal.schemaVersion)}`);
  if (!TRANSITION_KINDS.has(proposal.kind)) errors.push(`transition proposal: invalid kind "${String(proposal.kind)}"`);
  errors.push(...validateSlotMapping(proposal.derivation?.slotMapping, predecessorCompilation, successorCompilation));
  errors.push(...validateExerciseDiff(proposal, predecessorCompilation, successorCompilation));
  if (checkHash) {
    errors.push("transition proposal: hash validation is delegated to canonical-proposal-hash.mjs");
  }
  return [...new Set(errors)];
}

export { MAPPING_CONTRACT, MAPPING_SCHEMA_VERSION, TRANSITION_KINDS };
