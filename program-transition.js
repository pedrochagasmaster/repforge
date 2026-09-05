(function (root) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const SLOT_MAPPING_SCHEMA_VERSION = 1;
  const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
  const SET_LIKE_PATHS = [
    ["diagnosis", "eligibleEvidenceIds"],
    ["diagnosis", "insufficientEvidenceReasons"],
    ["progressionContract", "preservedRelations"],
    ["progressionContract", "resetRelations"],
    ["progressionContract", "incompatibilities"],
  ];

  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

  function assertSafeJson(value, path = "$") {
    if (value === null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new TypeError(`${path}: non-finite number`);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => assertSafeJson(entry, `${path}[${index}]`));
      return;
    }
    if (!isObject(value)) throw new TypeError(`${path}: unsupported value`);
    for (const key of Object.keys(value)) {
      if (DANGEROUS_KEYS.has(key)) throw new TypeError(`${path}.${key}: unsafe key`);
      assertSafeJson(value[key], `${path}.${key}`);
    }
  }

  function clone(value) {
    assertSafeJson(value);
    return JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  }

  function canonicalJson(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }

  function proposalPreimage(proposal) {
    const preimage = clone(proposal);
    delete preimage.proposalHash;
    delete preimage.status;
    delete preimage.confirmedAt;
    delete preimage.archiveId;
    for (const [section, field] of SET_LIKE_PATHS) {
      const values = preimage[section]?.[field];
      if (Array.isArray(values)) preimage[section][field] = [...new Set(values)].sort();
    }
    if (preimage.derivation?.slotMapping) {
      delete preimage.derivation.slotMapping.source;
      delete preimage.derivation.slotMapping.rule;
    }
    return preimage;
  }

  function canonicalProposalJson(proposal) {
    return canonicalJson(proposalPreimage(proposal));
  }

  async function sha256Hex(text) {
    if (!root.crypto?.subtle || typeof root.TextEncoder !== "function") {
      throw new TypeError("SHA-256 unavailable");
    }
    const bytes = new root.TextEncoder().encode(text);
    const digest = await root.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function hashProposal(proposal) {
    return sha256Hex(canonicalProposalJson(proposal));
  }

  function fingerprintCompilerInstance(instance) {
    return sha256Hex(canonicalJson(clone(instance)))
      .then((digest) => `program-sha256:${digest}`);
  }

  function fingerprintCompilerContext(context) {
    return sha256Hex(canonicalJson(clone(context)))
      .then((digest) => `context-sha256:${digest}`);
  }

  function flattenedSlots(instance) {
    return instance.days.flatMap((day, dayIndex) => day.slots.map((slot, slotIndex) => ({
      day,
      dayIndex,
      slot,
      slotIndex,
    })));
  }

  function movementId(slot) {
    const id = slot?.exercise?.id;
    if (typeof id !== "string" || !id) return null;
    return id.startsWith("custom:") || id.startsWith("library:") ? id : `library:${id}`;
  }

  function validateCompilerInstance(instance) {
    if (!isObject(instance) || instance.kind !== "compiled" || !Array.isArray(instance.days) ||
        !Array.isArray(instance.program) || !isObject(instance.programStructure) ||
        !Array.isArray(instance.programStructure.days) || !Array.isArray(instance.programStructure.weekPrescriptions) ||
        !isObject(instance.provenance) || !Array.isArray(instance.relations)) {
      return { ok: false, code: "invalid_compiler_snapshot" };
    }
    if (instance.customizedFrom !== null) return { ok: false, code: "customized_compiler_snapshot" };
    const slots = flattenedSlots(instance);
    const slotIds = slots.map(({ slot }) => slot.slotId);
    const dayIds = instance.days.map((day) => day.dayId);
    if (slotIds.some((id) => typeof id !== "string" || !id) || new Set(slotIds).size !== slotIds.length) {
      return { ok: false, code: "duplicate_compiler_slot" };
    }
    if (dayIds.some((id) => typeof id !== "string" || !id) || new Set(dayIds).size !== dayIds.length) {
      return { ok: false, code: "duplicate_compiler_day" };
    }
    if (instance.program.length !== slots.length) return { ok: false, code: "program_slot_coverage" };
    const programBySlot = new Map(instance.program.map((exercise) => [exercise.slotId, exercise]));
    if (programBySlot.size !== instance.program.length) return { ok: false, code: "duplicate_program_slot" };
    for (const { day, slot, slotIndex } of slots) {
      const exercise = programBySlot.get(slot.slotId);
      if (!exercise || exercise.id !== slot.slotId || exercise.dayId !== day.dayId ||
          exercise.day !== day.label || exercise.order !== slotIndex + 1 ||
          exercise.libraryId !== slot.exercise?.id || exercise.movementId !== movementId(slot) ||
          exercise.name !== slot.exercise?.name ||
          exercise.primary !== slot.exercise?.primaryMuscles?.join(",") ||
          exercise.secondary !== slot.exercise?.secondaryMuscles?.join(",") ||
          exercise.targetRirStart !== slot.prescription?.targetRirMax ||
          exercise.targetRirEnd !== slot.prescription?.targetRirMin ||
          exercise.priority !== slot.status || exercise.loadingMode !== slot.exercise?.loading ||
          exercise.loadIncrement !== slot.exercise?.loadIncrement ||
          exercise.sets !== (slot.prescription?.progression?.strategy?.id === "anchor_backoff"
            ? 1 + slot.prescription.progression.strategy.params.backoffSets
            : slot.prescription?.sets) || exercise.min !== slot.prescription?.repMin ||
          exercise.max !== slot.prescription?.repMax ||
          !sameCanonical(exercise.progression, slot.prescription?.progression)) {
        return { ok: false, code: "program_compiler_mismatch" };
      }
    }
    if (instance.programStructure.schemaVersion !== 1 || instance.frequency !== instance.days.length ||
        instance.familyId !== instance.provenance.familyId ||
        instance.blueprintId !== instance.provenance.blueprintId ||
        instance.programStructure.days.length !== instance.days.length ||
        !sameCanonical(instance.programStructure.weekPrescriptions, instance.weeks) ||
        !sameCanonical(instance.programStructure.provenance, instance.provenance)) {
      return { ok: false, code: "structure_compiler_mismatch" };
    }
    for (let index = 0; index < instance.days.length; index++) {
      const day = instance.days[index];
      const structureDay = instance.programStructure.days[index];
      if (structureDay?.dayId !== day.dayId || structureDay.label !== day.label || structureDay.order !== index + 1) {
        return { ok: false, code: "structure_day_mismatch" };
      }
    }
    return { ok: true };
  }

  function buildSlotMapping(predecessor, successor) {
    const predecessorSlots = flattenedSlots(predecessor);
    const successorSlots = flattenedSlots(successor);
    const usedPredecessors = new Set();
    const usedSuccessors = new Set();
    const slots = [];

    for (const target of successorSlots) {
      const source = predecessorSlots.find((candidate) =>
        !usedPredecessors.has(candidate.slot.slotId) &&
        candidate.slot.templateId === target.slot.templateId &&
        candidate.dayIndex <= target.dayIndex);
      if (!source) continue;
      usedPredecessors.add(source.slot.slotId);
      usedSuccessors.add(target.slot.slotId);
      slots.push({
        predecessorSlot: source.slot.slotId,
        successorSlot: target.slot.slotId,
        predecessorMovement: movementId(source.slot),
        successorMovement: movementId(target.slot),
      });
    }
    for (const target of successorSlots) {
      if (usedSuccessors.has(target.slot.slotId)) continue;
      slots.push({
        predecessorSlot: null,
        successorSlot: target.slot.slotId,
        predecessorMovement: null,
        successorMovement: movementId(target.slot),
      });
    }
    for (const source of predecessorSlots.slice().sort((left, right) =>
      left.slot.slotId.localeCompare(right.slot.slotId))) {
      if (usedPredecessors.has(source.slot.slotId)) continue;
      slots.push({
        predecessorSlot: source.slot.slotId,
        successorSlot: null,
        predecessorMovement: movementId(source.slot),
        successorMovement: null,
      });
    }

    const predecessorDayBySlot = new Map(predecessorSlots
      .map((record) => [record.slot.slotId, record.day.dayId]));
    const successorDayBySlot = new Map(successorSlots
      .map((record) => [record.slot.slotId, record.day.dayId]));
    const predecessorDayOrder = new Map(predecessor.days
      .map((dayRecord, index) => [dayRecord.dayId, index]));
    const usedPredecessorDays = new Set();
    const days = successor.days.map((successorDay) => {
      const candidates = slots
        .filter((entry) => entry.predecessorSlot && entry.successorSlot &&
          successorDayBySlot.get(entry.successorSlot) === successorDay.dayId)
        .map((entry) => predecessorDayBySlot.get(entry.predecessorSlot))
        .filter((dayId) => !usedPredecessorDays.has(dayId))
        .sort((left, right) => predecessorDayOrder.get(left) - predecessorDayOrder.get(right));
      const predecessorDay = candidates[0] || null;
      if (predecessorDay) usedPredecessorDays.add(predecessorDay);
      return { predecessorDay, successorDay: successorDay.dayId };
    });
    predecessor.days.map((day) => day.dayId).filter((dayId) => !usedPredecessorDays.has(dayId)).sort()
      .forEach((dayId) => days.push({ predecessorDay: dayId, successorDay: null }));

    return {
      contract: "taurifer-transition-slot-mapping",
      schemaVersion: SLOT_MAPPING_SCHEMA_VERSION,
      source: "program-compiler.js compiled sibling snapshots",
      rule: "Three-pass same-template pairing, then additions, then removals.",
      days,
      slots,
    };
  }

  function daySnapshot(day, index) {
    return day ? { label: day.label, index, slots: day.slots.length } : null;
  }

  function exerciseSnapshot(record) {
    if (!record) return null;
    return {
      movement: movementId(record.slot),
      index: record.slotIndex,
      sets: record.slot.prescription.sets,
    };
  }

  function prescriptionSnapshot(record) {
    if (!record) return null;
    const prescription = record.slot.prescription;
    const strategy = prescription.progression?.strategy;
    return {
      sets: prescription.sets,
      reps: [prescription.repMin, prescription.repMax],
      rir: [prescription.targetRirMin, prescription.targetRirMax],
      restSeconds: prescription.restSeconds,
      strategy: `${strategy.id}@${strategy.version}`,
      prescriptionClass: prescription.classId,
      index: record.slotIndex,
    };
  }

  function buildExactDiff(predecessor, successor, mapping) {
    const predecessorSlots = new Map(flattenedSlots(predecessor).map((record) => [record.slot.slotId, record]));
    const successorSlots = new Map(flattenedSlots(successor).map((record) => [record.slot.slotId, record]));
    const predecessorDays = new Map(predecessor.days.map((day, index) => [day.dayId, { day, index }]));
    const successorDays = new Map(successor.days.map((day, index) => [day.dayId, { day, index }]));
    const days = mapping.days.map(({ predecessorDay, successorDay }) => {
      const before = predecessorDays.get(predecessorDay);
      const after = successorDays.get(successorDay);
      return {
        predecessorDay,
        successorDay,
        before: before ? daySnapshot(before.day, before.index) : null,
        after: after ? daySnapshot(after.day, after.index) : null,
        reason: before && after ? "mapped day" : after ? "added successor day" : "removed predecessor day",
      };
    });
    const exercises = mapping.slots.map(({ predecessorSlot, successorSlot }) => {
      const before = predecessorSlots.get(predecessorSlot);
      const after = successorSlots.get(successorSlot);
      return {
        predecessorSlot,
        successorSlot,
        movement: after ? movementId(after.slot) : null,
        before: exerciseSnapshot(before),
        after: exerciseSnapshot(after),
        reason: before && after ? "mapped same-template slot" : after ? "added successor slot" : "removed predecessor slot",
      };
    });
    const prescriptions = mapping.slots.map(({ predecessorSlot, successorSlot }) => {
      const before = predecessorSlots.get(predecessorSlot);
      const after = successorSlots.get(successorSlot);
      const beforeSnapshot = prescriptionSnapshot(before);
      const afterSnapshot = prescriptionSnapshot(after);
      return {
        predecessorSlot,
        successorSlot,
        movement: after ? movementId(after.slot) : null,
        before: beforeSnapshot,
        after: afterSnapshot,
        reason: !before ? "added successor prescription" : !after ? "removed predecessor prescription" :
          JSON.stringify(beforeSnapshot) === JSON.stringify(afterSnapshot) ? "prescription unchanged" : "prescription changed",
      };
    });
    return { days, exercises, prescriptions };
  }

  function relationEndpointProgressions(instance, relation) {
    const slots = new Map(flattenedSlots(instance).map((record) => [record.slot.slotId, record.slot]));
    const heavy = slots.get(relation.heavySlotId);
    const volume = slots.get(relation.volumeSlotId);
    if (!heavy || !volume) return null;
    return {
      heavy: heavy.prescription.progression,
      volume: volume.prescription.progression,
      heavyTemplate: heavy.templateId,
      volumeTemplate: volume.templateId,
    };
  }

  function relationContract(predecessor, successor, mapping) {
    const predecessorSlots = new Map(flattenedSlots(predecessor)
      .map((record) => [record.slot.slotId, record.slot]));
    const successorSlots = new Map(flattenedSlots(successor)
      .map((record) => [record.slot.slotId, record.slot]));
    for (const pair of mapping.slots.filter((entry) => entry.predecessorSlot && entry.successorSlot)) {
      const before = predecessorSlots.get(pair.predecessorSlot);
      const after = successorSlots.get(pair.successorSlot);
      if (!sameCanonical(before.prescription.progression, after.prescription.progression)) {
        return { ok: false, code: "progression_parameters_changed" };
      }
    }
    const predecessorRelations = predecessor.relations.filter((relation) => relation.state === "attached");
    const successorRelations = successor.relations.filter((relation) => relation.state === "attached");
    const mappingByPredecessor = new Map(mapping.slots
      .filter((entry) => entry.predecessorSlot && entry.successorSlot)
      .map((entry) => [entry.predecessorSlot, entry.successorSlot]));
    const usedSuccessors = new Set();
    const preservedRelations = [];
    const resetRelations = [];

    for (const predecessorRelation of predecessorRelations) {
      const predecessorEndpoints = relationEndpointProgressions(predecessor, predecessorRelation);
      const candidates = successorRelations.filter((successorRelation) => {
        if (usedSuccessors.has(successorRelation.id) || successorRelation.type !== predecessorRelation.type ||
            successorRelation.version !== predecessorRelation.version ||
            successorRelation.movementId !== predecessorRelation.movementId) return false;
        const successorEndpoints = relationEndpointProgressions(successor, successorRelation);
        return successorEndpoints && predecessorEndpoints &&
          successorEndpoints.heavyTemplate === predecessorEndpoints.heavyTemplate &&
          successorEndpoints.volumeTemplate === predecessorEndpoints.volumeTemplate;
      });
      if (candidates.length !== 1) return { ok: false, code: "progression_relation_ambiguous" };
      const successorRelation = candidates[0];
      const successorEndpoints = relationEndpointProgressions(successor, successorRelation);
      if (!sameCanonical(predecessorEndpoints.heavy, successorEndpoints.heavy) ||
          !sameCanonical(predecessorEndpoints.volume, successorEndpoints.volume)) {
        return { ok: false, code: "progression_parameters_changed" };
      }
      usedSuccessors.add(successorRelation.id);
      const identity = `${predecessorRelation.type}@${predecessorRelation.version}:` +
        `${predecessorRelation.id}->${successorRelation.id}`;
      if (mappingByPredecessor.get(predecessorRelation.heavySlotId) === successorRelation.heavySlotId &&
          mappingByPredecessor.get(predecessorRelation.volumeSlotId) === successorRelation.volumeSlotId) {
        preservedRelations.push(identity);
      } else {
        resetRelations.push(`${identity}:endpoints_rebound`);
      }
    }
    if (usedSuccessors.size !== successorRelations.length) {
      return { ok: false, code: "successor_relation_unaccounted" };
    }
    return {
      ok: true,
      value: {
        preservedRelations: preservedRelations.sort(),
        resetRelations: resetRelations.sort(),
        incompatibilities: [],
      },
    };
  }

  function versionMatches(provenance, supportedVersions) {
    const pairs = [
      ["blueprintVersion", "blueprint"],
      ["compilerVersion", "compiler"],
      ["catalogueVersion", "catalogue"],
      ["rulesVersion", "rules"],
      ["contextVersion", "context"],
      ["recentConsistencyVersion", "recentConsistency"],
    ];
    return pairs.every(([field, supported]) =>
      String(provenance?.[field]) === String(supportedVersions?.[supported]));
  }

  function contextExceptFrequency(context) {
    const value = clone(context);
    delete value.frequency;
    delete value.splitId;
    return value;
  }

  function sameCanonical(left, right) {
    return canonicalJson(left) === canonicalJson(right);
  }

  async function createSiblingProposal(input) {
    if (!isObject(input) || input.kind !== "lower_frequency_sibling") {
      return { ok: false, code: "unsupported_transition_kind" };
    }
    const predecessorCheck = validateCompilerInstance(input.predecessorInstance);
    if (!predecessorCheck.ok) return predecessorCheck.code === "customized_compiler_snapshot"
      ? { ok: false, code: "unsupported_reconstruction" }
      : predecessorCheck;
    const successorCheck = validateCompilerInstance(input.successorInstance);
    if (!successorCheck.ok) return successorCheck.code === "customized_compiler_snapshot"
      ? { ok: false, code: "unsupported_reconstruction" }
      : successorCheck;
    const predecessor = input.predecessorInstance;
    const successor = input.successorInstance;
    if (typeof input.transitionId !== "string" || !input.transitionId ||
        typeof input.createdAt !== "string" || !input.createdAt ||
        typeof input.predecessor?.programId !== "string" || !input.predecessor.programId ||
        !Number.isInteger(input.predecessor?.durableRevision) || input.predecessor.durableRevision < 0 ||
        typeof input.successor?.programId !== "string" || !input.successor.programId ||
        input.successor.programId === input.predecessor.programId ||
        input.diagnosis?.kind !== "fewer_days" ||
        input.diagnosis?.answers?.availableDays !== successor.frequency ||
        !Array.isArray(input.diagnosis?.eligibleEvidenceIds) || !input.diagnosis.eligibleEvidenceIds.length ||
        !Array.isArray(input.diagnosis?.insufficientEvidenceReasons) ||
        input.diagnosis.insufficientEvidenceReasons.length) {
      return { ok: false, code: "insufficient_transition_evidence" };
    }
    if (!versionMatches(predecessor.provenance, input.supportedVersions) ||
        !versionMatches(successor.provenance, input.supportedVersions)) {
      return { ok: false, code: "unsupported_reconstruction" };
    }
    if (predecessor.familyId !== successor.familyId || successor.frequency >= predecessor.frequency ||
        input.predecessorCompilerContext?.schemaVersion !== predecessor.provenance.contextVersion ||
        input.successorCompilerContext?.schemaVersion !== successor.provenance.contextVersion ||
        input.predecessorCompilerContext?.familyId !== predecessor.familyId ||
        input.successorCompilerContext?.familyId !== successor.familyId ||
        input.successorCompilerContext?.frequency !== successor.frequency ||
        input.predecessorCompilerContext?.frequency !== predecessor.frequency ||
        !sameCanonical(contextExceptFrequency(input.predecessorCompilerContext),
          contextExceptFrequency(input.successorCompilerContext))) {
      return { ok: false, code: "unsupported_reconstruction" };
    }
    if (!sameCanonical(input.predecessor?.compilerProvenance, predecessor.provenance) ||
        !sameCanonical(input.successor?.compilerProvenance, successor.provenance)) {
      return { ok: false, code: "provenance_mismatch" };
    }
    const mapping = buildSlotMapping(predecessor, successor);
    const progression = relationContract(predecessor, successor, mapping);
    if (!progression.ok) return progression;
    const predecessorFingerprint = await fingerprintCompilerInstance(predecessor);
    const successorFingerprint = await fingerprintCompilerInstance(successor);
    const predecessorContextHash = await fingerprintCompilerContext(input.predecessorCompilerContext);
    const successorContextHash = await fingerprintCompilerContext(input.successorCompilerContext);
    const proposal = {
      schemaVersion: SCHEMA_VERSION,
      transitionId: input.transitionId,
      kind: input.kind,
      createdAt: input.createdAt,
      predecessor: {
        ...clone(input.predecessor),
        fingerprint: predecessorFingerprint,
      },
      diagnosis: clone(input.diagnosis),
      derivation: {
        mode: "recompilation",
        request: "lower-frequency-sibling",
        compilerContextVersions: {
          ...clone(successor.provenance),
          predecessorContextHash,
          successorContextHash,
        },
        policyVersions: {},
        slotMapping: mapping,
      },
      successor: {
        ...clone(input.successor),
        fingerprint: successorFingerprint,
      },
      diff: buildExactDiff(predecessor, successor, mapping),
      progressionContract: progression.value,
      status: "preview",
    };
    proposal.proposalHash = await hashProposal(proposal);
    return { ok: true, proposal: deepFreeze(proposal) };
  }

  function mappingCoverageIssue(mapping, predecessor, successor) {
    if (!isObject(mapping) || mapping.contract !== "taurifer-transition-slot-mapping" ||
        mapping.schemaVersion !== SLOT_MAPPING_SCHEMA_VERSION || !Array.isArray(mapping.days) ||
        !Array.isArray(mapping.slots)) return "invalid_slot_mapping";
    const predecessorIds = flattenedSlots(predecessor).map(({ slot }) => slot.slotId);
    const successorIds = flattenedSlots(successor).map(({ slot }) => slot.slotId);
    const mappedPredecessors = mapping.slots.map((entry) => entry.predecessorSlot).filter(Boolean);
    const mappedSuccessors = mapping.slots.map((entry) => entry.successorSlot).filter(Boolean);
    if (new Set(mappedPredecessors).size !== mappedPredecessors.length) return "duplicate_predecessor_slot";
    if (new Set(mappedSuccessors).size !== mappedSuccessors.length) return "duplicate_successor_slot";
    if (mappedPredecessors.length !== predecessorIds.length ||
        !predecessorIds.every((id) => mappedPredecessors.includes(id))) return "missing_predecessor_slot";
    if (mappedSuccessors.length !== successorIds.length ||
        !successorIds.every((id) => mappedSuccessors.includes(id))) return "missing_successor_slot";
    const expected = buildSlotMapping(predecessor, successor);
    const stable = (value) => ({ days: value.days, slots: value.slots, contract: value.contract, schemaVersion: value.schemaVersion });
    if (!sameCanonical(stable(mapping), stable(expected))) return "slot_mapping_order";
    return null;
  }

  function diffIssue(diff, predecessor, successor, mapping) {
    if (!isObject(diff) || !Array.isArray(diff.days) || !Array.isArray(diff.exercises) ||
        !Array.isArray(diff.prescriptions)) return "invalid_diff";
    const expected = buildExactDiff(predecessor, successor, mapping);
    const pairs = (entries) => entries.map(({ predecessorSlot, successorSlot }) => ({ predecessorSlot, successorSlot }));
    if (!sameCanonical(pairs(diff.exercises), pairs(expected.exercises))) return "diff_exercise_order";
    if (!sameCanonical(pairs(diff.prescriptions), pairs(expected.prescriptions))) return "diff_prescription_order";
    if (!sameCanonical(diff.days, expected.days)) return "diff_days_mismatch";
    if (!sameCanonical(diff.exercises, expected.exercises)) return "diff_exercises_mismatch";
    if (!sameCanonical(diff.prescriptions, expected.prescriptions)) return "diff_prescriptions_mismatch";
    return null;
  }

  async function validateProposal(proposal, current) {
    if (!isObject(proposal) || proposal.schemaVersion !== SCHEMA_VERSION ||
        proposal.kind !== "lower_frequency_sibling" || proposal.status !== "preview") {
      return { ok: false, status: "invalid", code: "invalid_proposal" };
    }
    if (!isObject(current?.predecessor) || !isObject(current.predecessorInstance) ||
        !isObject(current.successorInstance) || !isObject(current.predecessorCompilerContext) ||
        !isObject(current.successorCompilerContext)) {
      return { ok: false, status: "invalid", code: "missing_validation_snapshot" };
    }
    for (const field of ["programId", "durableRevision", "source"]) {
      if (proposal.predecessor?.[field] !== current.predecessor[field]) {
        return { ok: false, status: "stale", code: "predecessor_changed" };
      }
    }
    const liveFingerprint = await fingerprintCompilerInstance(current.predecessorInstance);
    if (proposal.predecessor?.fingerprint !== liveFingerprint) {
      return { ok: false, status: "stale", code: "predecessor_changed" };
    }
    const predecessorCheck = validateCompilerInstance(current.predecessorInstance);
    if (!predecessorCheck.ok) return { ok: false, status: "invalid", code: predecessorCheck.code };
    const successorCheck = validateCompilerInstance(current.successorInstance);
    if (!successorCheck.ok) return { ok: false, status: "invalid", code: successorCheck.code };
    if (!sameCanonical(proposal.predecessor.compilerProvenance, current.predecessorInstance.provenance)) {
      return { ok: false, status: "invalid", code: "predecessor_provenance_mismatch" };
    }
    if (!sameCanonical(proposal.successor?.compilerProvenance, current.successorInstance.provenance) ||
        proposal.successor?.fingerprint !== await fingerprintCompilerInstance(current.successorInstance)) {
      return { ok: false, status: "invalid", code: "successor_identity_mismatch" };
    }
    const expectedCompilerContextVersions = {
      ...clone(current.successorInstance.provenance),
      predecessorContextHash: await fingerprintCompilerContext(current.predecessorCompilerContext),
      successorContextHash: await fingerprintCompilerContext(current.successorCompilerContext),
    };
    if (!sameCanonical(proposal.derivation?.compilerContextVersions, expectedCompilerContextVersions)) {
      return { ok: false, status: "stale", code: "compiler_context_changed" };
    }
    const mappingIssue = mappingCoverageIssue(
      proposal.derivation?.slotMapping,
      current.predecessorInstance,
      current.successorInstance,
    );
    if (mappingIssue) return { ok: false, status: "invalid", code: mappingIssue };
    const exactDiffIssue = diffIssue(
      proposal.diff,
      current.predecessorInstance,
      current.successorInstance,
      proposal.derivation.slotMapping,
    );
    if (exactDiffIssue) return { ok: false, status: "invalid", code: exactDiffIssue };
    const progression = relationContract(
      current.predecessorInstance,
      current.successorInstance,
      proposal.derivation.slotMapping,
    );
    if (!progression.ok || !sameCanonical(proposal.progressionContract, progression.value)) {
      return { ok: false, status: "invalid", code: progression.code || "progression_contract_mismatch" };
    }
    if (proposal.proposalHash !== await hashProposal(proposal)) {
      return { ok: false, status: "invalid", code: "proposal_hash_mismatch" };
    }
    return { ok: true, status: "preview" };
  }

  const api = Object.freeze({
    SCHEMA_VERSION,
    SLOT_MAPPING_SCHEMA_VERSION,
    canonicalProposalJson,
    hashProposal,
    fingerprintCompilerInstance,
    fingerprintCompilerContext,
    buildSlotMapping,
    buildExactDiff,
    createSiblingProposal,
    validateProposal,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeProgramTransition = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
