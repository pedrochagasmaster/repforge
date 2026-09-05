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

// Reasons are contract data, not free-form display copy. The legacy review
// fixture carries two intentionally specific explanations; they remain in the
// closed vocabulary while compiler-derived rows use the neutral forms below.
const DIFF_REASON_VOCABULARY = Object.freeze({
  days: Object.freeze(new Set([
    "mapped day",
    "mapped day order differs",
    "added successor day",
    "removed predecessor day",
    "fewer_days: 4-day blueprint has no 3-day successor day; coverage preserved by mapped days",
    "day removed; hinge coverage preserved by growth_3_d2_s1",
  ])),
  exercises: Object.freeze(new Set([
    "mapped same-template slot",
    "mapped same-template slot with movement change",
    "mapped same-template slot changed day or order",
    "retained; day order differs between siblings",
    "added successor slot",
    "removed predecessor slot",
    "day removed; hinge coverage preserved by growth_3_d2_s1",
  ])),
  prescriptions: Object.freeze(new Set([
    "prescription unchanged",
    "prescription changed",
    "added successor prescription",
    "removed predecessor prescription",
    "protected-prescription parity on the mapped lateral-delt slot",
  ])),
});

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

function dayEntries(compilation) {
  return (compilation?.days || []).map((day, dayIndex) => ({ day, dayId: day.dayId, dayIndex }));
}

function daySnapshot(entry) {
  if (!entry) return null;
  return {
    label: entry.day.label,
    index: entry.dayIndex,
    slots: entry.day.slots.length,
  };
}

function prescriptionSnapshot(entry) {
  if (!entry) return null;
  return {
    sets: entry.slot.sets,
    reps: entry.slot.reps,
    rir: entry.slot.rir,
    restSeconds: entry.slot.restSeconds,
    strategy: entry.slot.strategy,
    prescriptionClass: entry.slot.prescriptionClass,
    index: entry.slotIndex,
  };
}

// Day identity is derived independently from slot order: pair the first slot
// evidence that gives both sides an unused day, then emit every successor day
// not paired (including a day whose slots are all additions), and finally emit
// removed days in ascending blueprint-qualified day-ID order.
export function deriveDayMapping(predecessorCompilation, successorCompilation, slots) {
  const predecessors = dayEntries(predecessorCompilation);
  const successors = dayEntries(successorCompilation);
  const predecessorBySlot = new Map(flattenCompilation(predecessorCompilation).map((entry) => [entry.slotId, entry]));
  const successorBySlot = new Map(flattenCompilation(successorCompilation).map((entry) => [entry.slotId, entry]));
  const pairedSuccessorDays = new Map();
  const pairedPredecessorDays = new Set();
  for (const row of slots) {
    if (!row.predecessorSlot || !row.successorSlot) continue;
    const predecessor = predecessorBySlot.get(row.predecessorSlot);
    const successor = successorBySlot.get(row.successorSlot);
    if (!predecessor || !successor) continue;
    if (pairedSuccessorDays.has(successor.dayId) || pairedPredecessorDays.has(predecessor.dayId)) continue;
    pairedSuccessorDays.set(successor.dayId, predecessor.dayId);
    pairedPredecessorDays.add(predecessor.dayId);
  }
  const days = successors.map((successor) => ({
    predecessorDay: pairedSuccessorDays.get(successor.dayId) ?? null,
    successorDay: successor.dayId,
  }));
  for (const predecessor of [...predecessors].sort((a, b) => a.dayId.localeCompare(b.dayId))) {
    if (!pairedPredecessorDays.has(predecessor.dayId)) {
      days.push({ predecessorDay: predecessor.dayId, successorDay: null });
    }
  }
  return days;
}

export function deriveSlotMapping(predecessorCompilation, successorCompilation) {
  const predecessors = flattenCompilation(predecessorCompilation).sort(slotOrder);
  const successors = flattenCompilation(successorCompilation).sort(slotOrder);
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

  return {
    contract: MAPPING_CONTRACT,
    schemaVersion: MAPPING_SCHEMA_VERSION,
    days: deriveDayMapping(predecessorCompilation, successorCompilation, slots),
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

function dayRowKey(row) {
  return `${row.predecessorDay ?? "∅"}->${row.successorDay ?? "∅"}`;
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

function dayDiffReason(row, predecessor, successor) {
  if (!predecessor) return "added successor day";
  if (!successor) return "removed predecessor day";
  if (predecessor.dayIndex !== successor.dayIndex) return "mapped day order differs";
  return "mapped day";
}

function prescriptionDiffReason(row, predecessor, successor) {
  if (!predecessor) return "added successor prescription";
  if (!successor) return "removed predecessor prescription";
  if (JSON.stringify(prescriptionSnapshot(predecessor)) !== JSON.stringify(prescriptionSnapshot(successor))) {
    return "prescription changed";
  }
  return "prescription unchanged";
}

export function deriveDayDiff(mapping, predecessorCompilation, successorCompilation, priorDiff = []) {
  const predecessors = new Map(dayEntries(predecessorCompilation).map((entry) => [entry.dayId, entry]));
  const successors = new Map(dayEntries(successorCompilation).map((entry) => [entry.dayId, entry]));
  const priorReasons = new Map((priorDiff || []).map((row) => [dayRowKey(row), row.reason]));
  return (mapping.days || []).map((row) => {
    const predecessor = row.predecessorDay ? predecessors.get(row.predecessorDay) : null;
    const successor = row.successorDay ? successors.get(row.successorDay) : null;
    return {
      predecessorDay: row.predecessorDay,
      successorDay: row.successorDay,
      before: daySnapshot(predecessor),
      after: daySnapshot(successor),
      reason: priorReasons.get(dayRowKey(row)) || dayDiffReason(row, predecessor, successor),
    };
  });
}

export function deriveExerciseDiff(mapping, predecessorCompilation, successorCompilation, priorDiff = []) {
  const predecessors = entryMap(flattenCompilation(predecessorCompilation));
  const successors = entryMap(flattenCompilation(successorCompilation));
  const priorReasons = new Map((priorDiff || []).map((row) => [rowKey(row), row.reason]));
  return (mapping.slots || []).map((row) => {
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

export function derivePrescriptionDiff(mapping, predecessorCompilation, successorCompilation, priorDiff = []) {
  const predecessors = entryMap(flattenCompilation(predecessorCompilation));
  const successors = entryMap(flattenCompilation(successorCompilation));
  const priorReasons = new Map((priorDiff || []).map((row) => [rowKey(row), row.reason]));
  return (mapping.slots || []).map((row) => {
    const predecessor = row.predecessorSlot ? predecessors.get(row.predecessorSlot) : null;
    const successor = row.successorSlot ? successors.get(row.successorSlot) : null;
    return {
      predecessorSlot: row.predecessorSlot,
      successorSlot: row.successorSlot,
      movement: row.successorMovement,
      before: prescriptionSnapshot(predecessor),
      after: prescriptionSnapshot(successor),
      reason: priorReasons.get(rowKey(row)) || prescriptionDiffReason(row, predecessor, successor),
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

function validateDiffRows(label, actual, expected, reasonVocabulary, keyOf, fields) {
  const errors = [];
  if (!Array.isArray(actual)) return [`diff.${label}: missing ${label} array or slot mapping`];
  if (actual.length !== expected.length) errors.push(`diff.${label}: expected ${expected.length} rows derived from slotMapping, received ${actual.length}`);
  const length = Math.max(actual.length, expected.length);
  for (let index = 0; index < length; index += 1) {
    const row = actual[index];
    const want = expected[index];
    if (!row) {
      errors.push(`diff.${label}: missing row at index ${index}`);
      continue;
    }
    if (!want) continue;
    if (keyOf(row) !== keyOf(want)) errors.push(`diff.${label}: order/identity mismatch at index ${index}`);
    for (const field of fields) {
      if (JSON.stringify(row[field]) !== JSON.stringify(want[field])) {
        errors.push(`diff.${label}: ${field} mismatch at index ${index}`);
      }
    }
    if (!reasonVocabulary.has(row.reason)) {
      errors.push(`diff.${label}: invalid reason "${String(row.reason)}" at index ${index}`);
    }
  }
  return [...new Set(errors)];
}

export function validateDayDiff(proposal, predecessorCompilation, successorCompilation) {
  const mapping = proposal?.derivation?.slotMapping;
  if (!mapping || !Array.isArray(mapping.days)) return ["diff.days: missing days array or slot mapping"];
  const actual = proposal?.diff?.days;
  const expected = deriveDayDiff(mapping, predecessorCompilation, successorCompilation, actual);
  return validateDiffRows("days", actual, expected, DIFF_REASON_VOCABULARY.days, dayRowKey, ["before", "after"]);
}

export function validateExerciseDiff(proposal, predecessorCompilation, successorCompilation) {
  const mapping = proposal?.derivation?.slotMapping;
  if (!mapping || !Array.isArray(mapping.slots)) return ["diff.exercises: missing exercises array or slot mapping"];
  const actual = proposal?.diff?.exercises;
  const expected = deriveExerciseDiff(mapping, predecessorCompilation, successorCompilation, actual);
  return validateDiffRows("exercises", actual, expected, DIFF_REASON_VOCABULARY.exercises, rowKey, ["movement", "before", "after"]);
}

export function validatePrescriptionDiff(proposal, predecessorCompilation, successorCompilation) {
  const mapping = proposal?.derivation?.slotMapping;
  if (!mapping || !Array.isArray(mapping.slots)) return ["diff.prescriptions: missing prescriptions array or slot mapping"];
  const actual = proposal?.diff?.prescriptions;
  const expected = derivePrescriptionDiff(mapping, predecessorCompilation, successorCompilation, actual);
  return validateDiffRows("prescriptions", actual, expected, DIFF_REASON_VOCABULARY.prescriptions, rowKey, ["movement", "before", "after"]);
}

export function validateTransitionProposal(proposal, predecessorCompilation, successorCompilation, { checkHash = false } = {}) {
  const errors = [];
  if (!proposal || typeof proposal !== "object") return ["transition proposal: missing proposal object"];
  if (proposal.schemaVersion !== 1) errors.push(`transition proposal: invalid schemaVersion ${String(proposal.schemaVersion)}`);
  if (!TRANSITION_KINDS.has(proposal.kind)) errors.push(`transition proposal: invalid kind "${String(proposal.kind)}"`);
  errors.push(...validateSlotMapping(proposal.derivation?.slotMapping, predecessorCompilation, successorCompilation));
  errors.push(...validateDayDiff(proposal, predecessorCompilation, successorCompilation));
  errors.push(...validateExerciseDiff(proposal, predecessorCompilation, successorCompilation));
  errors.push(...validatePrescriptionDiff(proposal, predecessorCompilation, successorCompilation));
  if (checkHash) {
    errors.push("transition proposal: hash validation is delegated to canonical-proposal-hash.mjs");
  }
  return [...new Set(errors)];
}

export {
  DIFF_REASON_VOCABULARY,
  MAPPING_CONTRACT,
  MAPPING_SCHEMA_VERSION,
  TRANSITION_KINDS,
};
