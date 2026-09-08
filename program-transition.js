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

  const RECONSTRUCTABLE_SOURCES = new Set([
    "Recommend",
    "Custom",
    "Browse",
    "recommend",
    "custom",
    "browse",
  ]);

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

  // Parameters the program compiler re-derives per blueprint when it fits a
  // valid authored sibling: RIR bounds, working-set and back-off-set counts, and
  // the rep-goal target. Two progressions that are equal once these are removed
  // share the same strategy identity, schema, modifiers, and structural params,
  // and differ only by that compiler-authored, target/set-dependent
  // re-derivation. Equal keys mean "this authored sibling is reconstructable" —
  // they do NOT assert the RIR or set counts are unchanged.
  const COMPILER_AUTHORED_TARGET_PARAMS = new Set([
    "workingSets", "targetRirMin", "targetRirMax", "repGoal", "backoffSets",
  ]);

  function progressionCompatibilityKey(progression) {
    if (!progression || typeof progression !== "object") return null;
    const { schemaVersion, modifiers, strategy } = progression;
    if (!strategy || typeof strategy !== "object") return null;
    const { id, version, params } = strategy;
    const structuralParams = {};
    if (params && typeof params === "object") {
      for (const [key, value] of Object.entries(params)) {
        if (COMPILER_AUTHORED_TARGET_PARAMS.has(key)) continue;
        structuralParams[key] = value;
      }
    }
    return { schemaVersion, modifiers, id, version, params: structuralParams };
  }

  function relationContract(predecessor, successor, mapping) {
    const predecessorSlots = new Map(flattenedSlots(predecessor)
      .map((record) => [record.slot.slotId, record.slot]));
    const successorSlots = new Map(flattenedSlots(successor)
      .map((record) => [record.slot.slotId, record.slot]));
    for (const pair of mapping.slots.filter((entry) => entry.predecessorSlot && entry.successorSlot)) {
      const before = predecessorSlots.get(pair.predecessorSlot);
      const after = successorSlots.get(pair.successorSlot);
      if (!sameCanonical(progressionCompatibilityKey(before.prescription.progression), progressionCompatibilityKey(after.prescription.progression))) {
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
      if (candidates.length > 1) return { ok: false, code: "progression_relation_ambiguous" };
      if (candidates.length === 0) {
        resetRelations.push(`${predecessorRelation.type}@${predecessorRelation.version}:${predecessorRelation.id}:no_successor_relation`);
        continue;
      }
      const successorRelation = candidates[0];
      const successorEndpoints = relationEndpointProgressions(successor, successorRelation);
      if (!sameCanonical(progressionCompatibilityKey(predecessorEndpoints.heavy), progressionCompatibilityKey(successorEndpoints.heavy)) ||
          !sameCanonical(progressionCompatibilityKey(predecessorEndpoints.volume), progressionCompatibilityKey(successorEndpoints.volume))) {
        return { ok: false, code: "progression_parameters_changed" };
      }
      usedSuccessors.add(successorRelation.id);
      const identity = `${predecessorRelation.type}@${predecessorRelation.version}:` +
        `${predecessorRelation.id}->${successorRelation.id}`;
      const endpointMappingExact =
        mappingByPredecessor.get(predecessorRelation.heavySlotId) === successorRelation.heavySlotId &&
        mappingByPredecessor.get(predecessorRelation.volumeSlotId) === successorRelation.volumeSlotId;
      // Preservation carries the relation and both endpoint progression objects
      // over byte-for-byte. A compatible-but-re-derived endpoint (changed RIR,
      // working sets, back-off sets, or rep goal) is an explicit reset with a
      // stable reason, never preserved. Rebound endpoints stay a separate reason.
      const endpointProgressionUnchanged =
        sameCanonical(predecessorEndpoints.heavy, successorEndpoints.heavy) &&
        sameCanonical(predecessorEndpoints.volume, successorEndpoints.volume);
      if (!endpointMappingExact) {
        resetRelations.push(`${identity}:endpoints_rebound`);
      } else if (!endpointProgressionUnchanged) {
        resetRelations.push(`${identity}:endpoint_progression_changed`);
      } else {
        preservedRelations.push(identity);
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

  function contextExceptDuration(context) {
    const value = clone(context);
    delete value.sessionMinutes;
    return value;
  }

  function sameCanonical(left, right) {
    return canonicalJson(left) === canonicalJson(right);
  }

  function siblingPresenceIssue(target) {
    if (!isObject(target)) return null;
    if (target.diff?.recoveryWeek !== undefined || (isObject(target.diff) && own(target.diff, "recoveryWeek")) ||
        target.recoveryWeek !== undefined || own(target, "recoveryWeek")) {
      return "forbidden_recovery_week";
    }
    if (target.confirmedAt !== undefined || own(target, "confirmedAt") ||
        target.archiveId !== undefined || own(target, "archiveId")) {
      return "forbidden_lifecycle_field";
    }
    return null;
  }

  function siblingContractIssue(proposal, predecessor, successor) {
    if (!isObject(proposal) || proposal.schemaVersion !== SCHEMA_VERSION ||
        (proposal.kind !== "lower_frequency_sibling" && proposal.kind !== "shorter_session_sibling") ||
        proposal.status !== "preview" ||
        typeof proposal.transitionId !== "string" || !proposal.transitionId ||
        typeof proposal.createdAt !== "string" || !proposal.createdAt) {
      return "invalid_proposal";
    }
    const presenceIssue = siblingPresenceIssue(proposal);
    if (presenceIssue) return presenceIssue;
    if (typeof proposal.predecessor?.programId !== "string" || !proposal.predecessor.programId ||
        !Number.isInteger(proposal.predecessor?.durableRevision) || proposal.predecessor.durableRevision < 0 ||
        typeof proposal.predecessor?.source !== "string" || !proposal.predecessor.source ||
        typeof proposal.successor?.programId !== "string" || !proposal.successor.programId ||
        typeof proposal.successor?.source !== "string" || !proposal.successor.source ||
        proposal.successor.programId === proposal.predecessor.programId) {
      return "successor_identity_invalid";
    }
    if (!RECONSTRUCTABLE_SOURCES.has(proposal.predecessor.source)) {
      return "unsupported_source";
    }
    if (proposal.successor.source !== proposal.predecessor.source) {
      return "source_provenance_mismatch";
    }
    if (proposal.kind === "lower_frequency_sibling") {
      if (!isObject(proposal.diagnosis) ||
          proposal.diagnosis.kind !== "fewer_days" ||
          proposal.diagnosis.answers?.availableDays !== successor.frequency ||
          !Array.isArray(proposal.diagnosis.eligibleEvidenceIds) ||
          !proposal.diagnosis.eligibleEvidenceIds.length ||
          !proposal.diagnosis.eligibleEvidenceIds.every((id) => typeof id === "string" && id.trim().length > 0) ||
          !Array.isArray(proposal.diagnosis.insufficientEvidenceReasons) ||
          proposal.diagnosis.insufficientEvidenceReasons.length > 0) {
        return "insufficient_transition_evidence";
      }
      if (proposal.derivation?.mode !== "recompilation" ||
          proposal.derivation?.request !== "lower-frequency-sibling" ||
          !isObject(proposal.derivation?.compilerContextVersions) ||
          !isObject(proposal.derivation?.policyVersions) ||
          Object.keys(proposal.derivation.policyVersions).length ||
          predecessor.familyId !== successor.familyId || successor.frequency >= predecessor.frequency) {
        return "invalid_sibling_derivation";
      }
    } else if (proposal.kind === "shorter_session_sibling") {
      if (!isObject(proposal.diagnosis) ||
          proposal.diagnosis.kind !== "sessions_too_long" ||
          !Number.isFinite(proposal.diagnosis.answers?.sessionMinutes) ||
          proposal.diagnosis.answers.sessionMinutes <= 0 ||
          !Array.isArray(proposal.diagnosis.eligibleEvidenceIds) ||
          !proposal.diagnosis.eligibleEvidenceIds.length ||
          !proposal.diagnosis.eligibleEvidenceIds.every((id) => typeof id === "string" && id.trim().length > 0) ||
          !Array.isArray(proposal.diagnosis.insufficientEvidenceReasons) ||
          proposal.diagnosis.insufficientEvidenceReasons.length > 0) {
        return "insufficient_transition_evidence";
      }
      if (proposal.derivation?.mode !== "recompilation" ||
          proposal.derivation?.request !== "shorter-session-sibling" ||
          !isObject(proposal.derivation?.compilerContextVersions) ||
          !isObject(proposal.derivation?.policyVersions) ||
          Object.keys(proposal.derivation.policyVersions).length ||
          predecessor.familyId !== successor.familyId || successor.frequency !== predecessor.frequency) {
        return "invalid_sibling_derivation";
      }
    }
    return null;
  }

  async function createSiblingProposal(input) {
    if (!isObject(input) ||
        (input.kind !== "lower_frequency_sibling" && input.kind !== "shorter_session_sibling") ||
        !isObject(input.predecessor) || !isObject(input.successor) ||
        !isObject(input.diagnosis) || !isObject(input.predecessorCompilerContext) ||
        !isObject(input.successorCompilerContext) || !isObject(input.supportedVersions)) {
      return { ok: false, code: "unsupported_transition_kind" };
    }
    const presenceIssue = siblingPresenceIssue(input);
    if (presenceIssue) return { ok: false, code: presenceIssue };
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
    if (!versionMatches(predecessor.provenance, input.supportedVersions) ||
        !versionMatches(successor.provenance, input.supportedVersions)) {
      return { ok: false, code: "unsupported_reconstruction" };
    }
    if (input.predecessorCompilerContext?.schemaVersion !== predecessor.provenance.contextVersion ||
        input.successorCompilerContext?.schemaVersion !== successor.provenance.contextVersion ||
        input.predecessorCompilerContext?.familyId !== predecessor.familyId ||
        input.successorCompilerContext?.familyId !== successor.familyId) {
      return { ok: false, code: "unsupported_reconstruction" };
    }

    if (input.kind === "lower_frequency_sibling") {
      if (input.diagnosis?.answers?.availableDays !== successor.frequency) {
        return { ok: false, code: "insufficient_transition_evidence" };
      }
      if (predecessor.familyId !== successor.familyId || successor.frequency >= predecessor.frequency ||
          input.successorCompilerContext?.frequency !== successor.frequency ||
          input.predecessorCompilerContext?.frequency !== predecessor.frequency ||
          input.successorCompilerContext?.sessionMinutes !== input.predecessorCompilerContext?.sessionMinutes ||
          !sameCanonical(contextExceptFrequency(input.predecessorCompilerContext),
            contextExceptFrequency(input.successorCompilerContext))) {
        return { ok: false, code: "unsupported_reconstruction" };
      }
    } else if (input.kind === "shorter_session_sibling") {
      if (input.diagnosis?.answers?.sessionMinutes !== input.successorCompilerContext.sessionMinutes) {
        return { ok: false, code: "insufficient_transition_evidence" };
      }
      if (predecessor.familyId !== successor.familyId || successor.frequency !== predecessor.frequency ||
          input.successorCompilerContext?.frequency !== predecessor.frequency ||
          input.predecessorCompilerContext?.frequency !== predecessor.frequency ||
          !Number.isFinite(input.successorCompilerContext?.sessionMinutes) ||
          !Number.isFinite(input.predecessorCompilerContext?.sessionMinutes) ||
          input.successorCompilerContext.sessionMinutes >= input.predecessorCompilerContext.sessionMinutes ||
          !sameCanonical(contextExceptDuration(input.predecessorCompilerContext),
            contextExceptDuration(input.successorCompilerContext))) {
        return { ok: false, code: "unsupported_reconstruction" };
      }
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
        request: input.request || (input.kind === "lower_frequency_sibling" ? "lower-frequency-sibling" : "shorter-session-sibling"),
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
    const contractIssue = siblingContractIssue(proposal, predecessor, successor);
    if (contractIssue) return { ok: false, code: contractIssue };
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
    if (diff.recoveryWeek !== undefined || own(diff, "recoveryWeek")) return "forbidden_recovery_week";
    const expected = buildExactDiff(predecessor, successor, mapping);
    const pairs = (entries) => entries.map(({ predecessorSlot, successorSlot }) => ({ predecessorSlot, successorSlot }));
    if (!sameCanonical(pairs(diff.exercises), pairs(expected.exercises))) return "diff_exercise_order";
    if (!sameCanonical(pairs(diff.prescriptions), pairs(expected.prescriptions))) return "diff_prescription_order";
    if (!sameCanonical(diff.days, expected.days)) return "diff_days_mismatch";
    if (!sameCanonical(diff.exercises, expected.exercises)) return "diff_exercises_mismatch";
    if (!sameCanonical(diff.prescriptions, expected.prescriptions)) return "diff_prescriptions_mismatch";
    return null;
  }

  async function proposeSibling(...args) {
    let input = {};
    let dependencies = {};
    if (args.length === 1 && isObject(args[0])) {
      input = args[0];
      dependencies = args[0].services || args[0].dependencies || args[0];
    } else if (typeof args[0] === "string") {
      const [kind, predecessor, compilerContext, targetConstraint, options = {}] = args;
      input = {
        kind,
        predecessor,
        compilerContext,
        targetConstraint,
        ...options,
      };
      dependencies = options.services || options.dependencies || options;
    } else if (isObject(args[0])) {
      input = args[0];
      dependencies = args[1] || {};
    }

    const Compiler = dependencies.Compiler || dependencies.compiler || input.Compiler || input.compiler;
    const catalogue = dependencies.catalogue || dependencies.library || input.catalogue || input.library;
    if (!Compiler || !catalogue) {
      return { ok: false, status: "unavailable", code: "missing_compiler_dependency", unavailable: true };
    }

    const kind = input.kind;
    if (kind !== "lower_frequency_sibling" && kind !== "shorter_session_sibling") {
      return { ok: false, status: "unavailable", code: "unsupported_transition_kind", unavailable: true };
    }

    const context = input.compilerContext || input.predecessorCompilerContext || input.predecessor?.compilerContext;
    if (!isObject(context)) {
      return { ok: false, status: "unavailable", code: "missing_compiler_context", unavailable: true };
    }

    const predecessor = input.predecessor;
    if (!isObject(predecessor)) {
      return { ok: false, status: "unavailable", code: "missing_predecessor", unavailable: true };
    }
    if (typeof predecessor.source !== "string" || !RECONSTRUCTABLE_SOURCES.has(predecessor.source)) {
      return { ok: false, status: "unavailable", code: "unsupported_source", unavailable: true };
    }

    const successorProgramId = input.successorProgramId || input.successor?.programId;
    if (typeof successorProgramId !== "string" || !successorProgramId.trim() || successorProgramId === predecessor.programId) {
      return { ok: false, status: "unavailable", code: "successor_identity_invalid", unavailable: true };
    }

    const transitionId = input.transitionId;
    const createdAt = input.createdAt;
    if (typeof transitionId !== "string" || !transitionId.trim() ||
        typeof createdAt !== "string" || !createdAt.trim()) {
      return { ok: false, status: "unavailable", code: "invalid_proposal", unavailable: true };
    }

    const diagnosis = input.diagnosis;
    if (!isObject(diagnosis)) {
      return { ok: false, status: "unavailable", code: "insufficient_transition_evidence", unavailable: true };
    }
    if (!Array.isArray(diagnosis.eligibleEvidenceIds) ||
        diagnosis.eligibleEvidenceIds.length === 0 ||
        !diagnosis.eligibleEvidenceIds.every((id) => typeof id === "string" && id.trim().length > 0) ||
        !Array.isArray(diagnosis.insufficientEvidenceReasons) ||
        diagnosis.insufficientEvidenceReasons.length > 0) {
      return { ok: false, status: "unavailable", code: "insufficient_transition_evidence", unavailable: true };
    }

    if (input.predecessorInstance?.customizedFrom || predecessor.customizedFrom) {
      return { ok: false, status: "unavailable", code: "customized_compiler_snapshot", unavailable: true };
    }

    const provenance = predecessor.compilerProvenance || input.predecessorInstance?.provenance;
    if (!provenance || !versionMatches(provenance, Compiler.VERSIONS)) {
      return { ok: false, status: "unavailable", code: "unsupported_version", unavailable: true };
    }

    const checkedContext = Compiler.validateContext ? Compiler.validateContext(context) : { ok: true, value: context };
    if (!checkedContext.ok) {
      return { ok: false, status: "unavailable", code: "invalid_compiler_context", unavailable: true };
    }
    const validatedContext = clone(context);
    if (validatedContext.schemaVersion !== Compiler.VERSIONS.context) {
      return { ok: false, status: "unavailable", code: "unsupported_version", unavailable: true };
    }

    // Reconstruct predecessor via real Compiler.compile to compare full snapshot before successor creation
    const reconstructed = Compiler.compile(validatedContext, catalogue);
    if (!reconstructed || reconstructed.kind !== "compiled") {
      return { ok: false, status: "unavailable", code: "unsupported_reconstruction", unavailable: true };
    }
    const reconstructedCheck = validateCompilerInstance(reconstructed);
    if (!reconstructedCheck.ok) {
      return { ok: false, status: "unavailable", code: reconstructedCheck.code, unavailable: true };
    }
    if (input.predecessorInstance) {
      if (!sameCanonical(reconstructed, input.predecessorInstance)) {
        return { ok: false, status: "unavailable", code: "unsupported_reconstruction", unavailable: true };
      }
    }
    if (!sameCanonical(provenance, reconstructed.provenance)) {
      return { ok: false, status: "unavailable", code: "provenance_mismatch", unavailable: true };
    }

    const predecessorInstance = reconstructed;
    const predecessorContext = validatedContext;

    let targetFrequency = predecessorInstance.frequency;
    let targetMinutes = predecessorContext.sessionMinutes;
    let successorContext;

    if (kind === "lower_frequency_sibling") {
      if (diagnosis.kind !== "fewer_days") {
        return { ok: false, status: "unavailable", code: "insufficient_transition_evidence", unavailable: true };
      }
      const diagnosisFreq = diagnosis.answers?.availableDays;
      if (!Number.isInteger(diagnosisFreq) || diagnosisFreq <= 0 || diagnosisFreq >= predecessorInstance.frequency) {
        return { ok: false, status: "unavailable", code: "insufficient_transition_evidence", unavailable: true };
      }
      if (input.targetConstraint !== undefined && input.targetConstraint !== null) {
        const rawConstraint = isObject(input.targetConstraint)
          ? (input.targetConstraint.frequency ?? input.targetConstraint.availableDays)
          : (typeof input.targetConstraint === "number" ? input.targetConstraint : null);
        if (rawConstraint === null || rawConstraint === undefined || Number(rawConstraint) !== diagnosisFreq) {
          return { ok: false, status: "unavailable", code: "insufficient_transition_evidence", unavailable: true };
        }
      }
      targetFrequency = diagnosisFreq;

      // Resolver must select authored BLUEPRINTS by family/frequency metadata, never string concatenation/name matching
      const siblingBlueprint = Array.isArray(Compiler.BLUEPRINTS)
        ? Compiler.BLUEPRINTS.find((bp) => bp.familyId === predecessorInstance.familyId && bp.frequency === targetFrequency)
        : null;
      if (!siblingBlueprint) {
        return { ok: false, status: "unavailable", code: "sibling_blueprint_not_found", unavailable: true };
      }

      successorContext = {
        ...clone(predecessorContext),
        frequency: targetFrequency,
      };
      delete successorContext.splitId;
    } else if (kind === "shorter_session_sibling") {
      if (diagnosis.kind !== "sessions_too_long") {
        return { ok: false, status: "unavailable", code: "insufficient_transition_evidence", unavailable: true };
      }
      const diagnosisMins = diagnosis.answers?.sessionMinutes;
      if (!Number.isFinite(diagnosisMins) || diagnosisMins <= 0 || diagnosisMins >= predecessorContext.sessionMinutes) {
        return { ok: false, status: "unavailable", code: "insufficient_transition_evidence", unavailable: true };
      }
      if (input.targetConstraint !== undefined && input.targetConstraint !== null) {
        const rawConstraint = isObject(input.targetConstraint)
          ? input.targetConstraint.sessionMinutes
          : (typeof input.targetConstraint === "number" ? input.targetConstraint : null);
        if (rawConstraint === null || rawConstraint === undefined || Number(rawConstraint) !== diagnosisMins) {
          return { ok: false, status: "unavailable", code: "insufficient_transition_evidence", unavailable: true };
        }
      }
      targetMinutes = diagnosisMins;

      // Sibling blueprint keeps family and frequency
      const siblingBlueprint = Array.isArray(Compiler.BLUEPRINTS)
        ? Compiler.BLUEPRINTS.find((bp) => bp.familyId === predecessorInstance.familyId && bp.frequency === targetFrequency)
        : null;
      if (!siblingBlueprint) {
        return { ok: false, status: "unavailable", code: "sibling_blueprint_not_found", unavailable: true };
      }

      successorContext = {
        ...clone(predecessorContext),
        frequency: targetFrequency,
        sessionMinutes: targetMinutes,
      };
    }

    const successorInstance = Compiler.compile(successorContext, catalogue);
    if (!successorInstance || successorInstance.kind !== "compiled") {
      return { ok: false, status: "unavailable", code: "sessions_too_long_unavailable", unavailable: true };
    }

    const successorCheck = validateCompilerInstance(successorInstance);
    if (!successorCheck.ok) {
      return { ok: false, status: "unavailable", code: successorCheck.code, unavailable: true };
    }

    if (kind === "shorter_session_sibling") {
      const ceilingSeconds = targetMinutes * 60;
      for (const day of successorInstance.days) {
        const daySeconds = Compiler.estimateDaySeconds(day, catalogue);
        if (daySeconds > ceilingSeconds) {
          return { ok: false, status: "unavailable", code: "sessions_too_long_unavailable", unavailable: true };
        }
      }
    }

    const mapping = buildSlotMapping(predecessorInstance, successorInstance);
    const progression = relationContract(predecessorInstance, successorInstance, mapping);
    if (!progression.ok) {
      return { ok: false, status: "unavailable", code: progression.code, unavailable: true };
    }

    const proposalInput = {
      transitionId,
      createdAt,
      kind,
      request: kind === "lower_frequency_sibling" ? "lower-frequency-sibling" : "shorter-session-sibling",
      predecessor: {
        programId: predecessor.programId,
        durableRevision: predecessor.durableRevision,
        source: predecessor.source,
        compilerProvenance: predecessorInstance.provenance,
      },
      successor: {
        programId: successorProgramId,
        source: predecessor.source,
        compilerProvenance: successorInstance.provenance,
      },
      predecessorInstance,
      successorInstance,
      predecessorCompilerContext: predecessorContext,
      successorCompilerContext: successorContext,
      supportedVersions: Compiler.VERSIONS,
      diagnosis: clone(diagnosis),
    };

    const proposalResult = await createSiblingProposal(proposalInput);
    if (!proposalResult.ok) {
      return { ok: false, status: "unavailable", code: proposalResult.code, unavailable: true };
    }

    return {
      ok: true,
      status: "preview",
      proposal: proposalResult.proposal,
      successorInstance,
      successorCompilerContext: successorContext,
      successor: {
        instance: successorInstance,
        compilerContext: successorContext,
      },
    };
  }

  async function validateProposal(proposal, current) {
    if (!isObject(current?.predecessor) || !isObject(current.predecessorInstance) ||
        !isObject(current.successorInstance) || !isObject(current.predecessorCompilerContext) ||
        !isObject(current.successorCompilerContext)) {
      return { ok: false, status: "invalid", code: "missing_validation_snapshot" };
    }
    const contractIssue = siblingContractIssue(
      proposal,
      current.predecessorInstance,
      current.successorInstance,
    );
    if (contractIssue) return { ok: false, status: "invalid", code: contractIssue };
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

    if (proposal.kind === "shorter_session_sibling") {
      if (current.successorCompilerContext?.sessionMinutes !== proposal.diagnosis?.answers?.sessionMinutes) {
        return { ok: false, status: "invalid", code: "insufficient_transition_evidence" };
      }
      if (current.successorCompilerContext?.sessionMinutes >= current.predecessorCompilerContext?.sessionMinutes ||
          current.successorInstance.frequency !== current.predecessorInstance.frequency) {
        return { ok: false, status: "invalid", code: "invalid_sibling_derivation" };
      }
    } else if (proposal.kind === "lower_frequency_sibling") {
      if (current.successorCompilerContext?.frequency !== proposal.diagnosis?.answers?.availableDays) {
        return { ok: false, status: "invalid", code: "insufficient_transition_evidence" };
      }
      if (current.successorInstance.frequency >= current.predecessorInstance.frequency) {
        return { ok: false, status: "invalid", code: "invalid_sibling_derivation" };
      }
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

  /* Pure sealing. The only inputs are a preview replacement proposal and two
     non-empty explicit strings supplied by the lock-held production path. There
     is deliberately no clock, no randomness, no proposal-derived archive id and
     no `arc_*` synthesis in this module: a missing or malformed value is a
     programming error at the call site, raised the same way the other structural
     guards in this file raise. */
  function commitRecord(proposal, options) {
    if (!isObject(proposal)) throw new TypeError("proposal: expected object");
    if (proposal.status !== "preview") throw new TypeError("proposal.status: expected preview replacement proposal");
    if (typeof proposal.proposalHash !== "string" || !proposal.proposalHash) {
      throw new TypeError("proposal.proposalHash: expected non-empty string");
    }
    if (!isObject(options)) throw new TypeError("options: expected { confirmedAt, archiveId }");
    const { confirmedAt, archiveId } = options;
    if (typeof confirmedAt !== "string" || !confirmedAt) {
      throw new TypeError("confirmedAt: expected non-empty string");
    }
    if (typeof archiveId !== "string" || !archiveId) {
      throw new TypeError("archiveId: expected non-empty string");
    }

    const record = clone(proposal);
    record.status = "committed";
    record.confirmedAt = confirmedAt;
    record.archiveId = archiveId;

    return deepFreeze(record);
  }


  function createGuidedManualRepair(options = {}) {
    const invalid = (code) =>
      Object.freeze({
        ok: false,
        status: "unavailable",
        unavailable: true,
        invalid: true,
        code,
      });

    if (!isObject(options)) return invalid("invalid_options");

    // 1. Typed sibling Unavailable check
    const unavailable = options.unavailable || (options.siblingResult?.ok === false ? options.siblingResult : null);
    if (!isObject(unavailable) || unavailable.ok !== false ||
        (unavailable.status !== "unavailable" && unavailable.unavailable !== true)) {
      return invalid("sibling_unavailable_required");
    }

    // 2. Valid diagnosis check: kind MUST be "fewer_days" or "sessions_too_long"
    const diagnosis = options.diagnosis;
    if (!isObject(diagnosis)) return invalid("diagnosis_required");
    const kind = diagnosis.kind;
    if (kind !== "fewer_days" && kind !== "sessions_too_long") {
      return invalid("unsupported_diagnosis_kind");
    }

    // Target constraint / integer target check
    let targetDays = null;
    let targetMinutes = null;
    if (kind === "fewer_days") {
      targetDays = diagnosis.answers?.availableDays ?? diagnosis.answers?.daysPerWeek ??
        diagnosis.targetConstraint?.frequency ?? diagnosis.daysPerWeek;
      if (!Number.isInteger(targetDays) || targetDays < 1 || targetDays > 7) {
        return invalid("invalid_diagnosis_target");
      }
    } else if (kind === "sessions_too_long") {
      targetMinutes = diagnosis.answers?.sessionMinutes ??
        diagnosis.targetConstraint?.sessionMinutes ?? diagnosis.sessionMinutes;
      if (!Number.isInteger(targetMinutes) || targetMinutes <= 0) {
        return invalid("invalid_diagnosis_target");
      }
    }

    // Optional evidence checks: if provided, must be valid
    if (diagnosis.eligibleEvidenceIds !== undefined) {
      if (!Array.isArray(diagnosis.eligibleEvidenceIds) ||
          diagnosis.eligibleEvidenceIds.length === 0 ||
          !diagnosis.eligibleEvidenceIds.every((id) => typeof id === "string" && id.trim().length > 0)) {
        return invalid("insufficient_transition_evidence");
      }
    }
    if (diagnosis.insufficientEvidenceReasons !== undefined) {
      if (!Array.isArray(diagnosis.insufficientEvidenceReasons) ||
          diagnosis.insufficientEvidenceReasons.length > 0) {
        return invalid("insufficient_transition_evidence");
      }
    }

    // 3. Active program snapshot check
    const activeProgram = options.activeProgram || options.snapshot;
    if (!isObject(activeProgram)) return invalid("missing_active_program");
    if (!Array.isArray(activeProgram.program) || activeProgram.program.length === 0) {
      return invalid("malformed_active_program");
    }
    for (const row of activeProgram.program) {
      if (!isObject(row) || (!row.id && !row.slotId) || (!row.day && !row.dayId) ||
          typeof row.name !== "string" || !row.name) {
        return invalid("malformed_active_program");
      }
    }

    // 4. Durable revision check
    const durableRevision = options.durableRevision !== undefined
      ? options.durableRevision
      : options.activeProgramRevision;
    if (!Number.isInteger(durableRevision) || durableRevision < 0) {
      return invalid("missing_active_revision");
    }
    const snapshotRevision = Number.isInteger(activeProgram._storageRevision)
      ? activeProgram._storageRevision
      : (Number.isInteger(activeProgram.revision)
        ? activeProgram.revision
        : (Number.isInteger(activeProgram._rev) ? activeProgram._rev : null));
    if (snapshotRevision !== null && snapshotRevision !== durableRevision) {
      return invalid("active_revision_mismatch");
    }

    // 5. Structure, progression, custom definitions
    const meta = activeProgram.programMeta || {};
    const programStructure = meta.programStructure || activeProgram.programStructure || null;
    const progressionRelations = meta.progressionRelations || activeProgram.progressionRelations || [];
    const progressionModifiers = meta.progressionModifiers || activeProgram.progressionModifiers || [];
    const progressionIncompatibilities = meta.progressionIncompatibilities || activeProgram.progressionIncompatibilities || [];

    // Referenced custom definitions
    const referencedCustomIds = new Set(
      activeProgram.program
        .map((r) => r.libraryId)
        .filter((id) => typeof id === "string" && (id.startsWith("custom:") || id.startsWith("custom_")))
    );
    const customPool = Array.isArray(activeProgram.customExercises)
      ? activeProgram.customExercises
      : (Array.isArray(options.customExercises) ? options.customExercises : []);
    const referencedCustomExercises = customPool
      .filter((def) => isObject(def) && (referencedCustomIds.has(def.id) || referencedCustomIds.has(def.libraryId)))
      .map(clone);

    // Every custom movement the copied program references must resolve to a
    // real definition. A missing one would stage a broken candidate, so fail
    // typed instead of silently dropping the reference.
    const resolvedCustomIds = new Set();
    for (const def of referencedCustomExercises) {
      if (typeof def.id === "string") resolvedCustomIds.add(def.id);
      if (typeof def.libraryId === "string") resolvedCustomIds.add(def.libraryId);
    }
    for (const referencedId of referencedCustomIds) {
      if (!resolvedCustomIds.has(referencedId)) {
        return invalid("missing_referenced_custom_definition");
      }
    }

    const candidate = {
      program: clone(activeProgram.program),
      programStructure: programStructure ? clone(programStructure) : null,
      progressionRelations: clone(progressionRelations),
      progressionModifiers: clone(progressionModifiers),
      progressionIncompatibilities: clone(progressionIncompatibilities),
      customExercises: referencedCustomExercises,
    };

    const result = {
      ok: true,
      kind: "guided_manual_repair",
      diagnosis: clone(diagnosis),
      candidate,
      program: candidate.program,
      programStructure: candidate.programStructure,
      progressionRelations: candidate.progressionRelations,
      progressionModifiers: candidate.progressionModifiers,
      progressionIncompatibilities: candidate.progressionIncompatibilities,
      customExercises: candidate.customExercises,
      durableRevision,
    };

    return deepFreeze(result);
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
    proposeSibling,
    validateProposal,
    commitRecord,
    createGuidedManualRepair,
    createGuidedManualRepairCandidate: createGuidedManualRepair,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeProgramTransition = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
