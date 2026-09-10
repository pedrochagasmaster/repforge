(function (root) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const SLOT_MAPPING_SCHEMA_VERSION = 1;
  const VOLUME_REDUCTION_POLICY_VERSION = 1;
  const RECOVERY_POLICY_VERSION = 2;
  const RECOVERY_CHECKPOINT_QUESTION =
    "During this block, did recovery feel worse than usual often enough to affect your training?";
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
  const exactKeys = (value, keys) => isObject(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => own(value, key));
  const exactOrderedArray = (value, expected) => Array.isArray(value) &&
    value.length === expected.length &&
    expected.every((entry, index) => value[index] === entry);
  const noUnsafeKeys = (value) => isObject(value) &&
    Object.keys(value).every((key) => !DANGEROUS_KEYS.has(key));

  // --- Recovery-boundary own-data discipline --------------------------------
  // The recovery-week preview consumes a policy, evidence, proposal,
  // predecessor, overlay, entries, and ordered enums that must each be an
  // own-data JSON shape: a required field or an allowlist key can never be
  // satisfied through the prototype chain, and a sparse or prototype-backed
  // array can never line up against an ordered enum. A consumed record must
  // use Object.prototype or null and carry only enumerable own string-keyed
  // data properties — accessors, symbols, non-enumerable application fields,
  // and dangerous keys reject structurally, without ever invoking a getter —
  // and every nested value obeys the same rule. A consumed array must be a
  // dense normal Array holding only its intrinsic length plus enumerable own
  // data index properties. These helpers are used only by the recovery
  // boundary; other transition kinds keep their existing validation unchanged.
  const OBJECT_PROTO = Object.prototype;
  const ARRAY_PROTO = Array.prototype;

  function isOwnDataProperty(value, key) {
    const desc = Object.getOwnPropertyDescriptor(value, key);
    if (!desc || desc.enumerable !== true) return false;
    return !("get" in desc || "set" in desc);
  }

  function isOwnRecord(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    if (proto !== OBJECT_PROTO && proto !== null) return false;
    if (Object.getOwnPropertySymbols(value).length !== 0) return false;
    const names = Object.getOwnPropertyNames(value);
    for (const key of names) {
      if (DANGEROUS_KEYS.has(key)) return false;
      if (!isOwnDataProperty(value, key)) return false;
    }
    return true;
  }

  function isOwnArray(value) {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== ARRAY_PROTO) return false;
    if (Object.getOwnPropertySymbols(value).length !== 0) return false;
    const length = value.length;
    if (!Number.isSafeInteger(length) || length < 0) return false;
    let indexCount = 0;
    for (const key of Object.getOwnPropertyNames(value)) {
      if (key === "length") {
        const desc = Object.getOwnPropertyDescriptor(value, key);
        if (!desc || "get" in desc || "set" in desc) return false;
        continue;
      }
      if (!/^(0|[1-9][0-9]*)$/.test(key)) return false;
      if (Number(key) >= length) return false;
      if (!isOwnDataProperty(value, key)) return false;
      indexCount += 1;
    }
    return indexCount === length;
  }

  function isOwnJsonTree(value) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (Array.isArray(value)) return isOwnArray(value) && value.every(isOwnJsonTree);
    if (!isOwnRecord(value)) return false;
    return Object.keys(value).every((key) => isOwnJsonTree(value[key]));
  }

  // Canonical ISO-8601 UTC instant with milliseconds, e.g. 2026-10-01T09:00:00.000Z.
  // Rejects placeholders, partial dates, offsets, and noncanonical normalized
  // spellings. Reads no clock.
  const CANONICAL_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  function isCanonicalInstant(value) {
    if (typeof value !== "string" || !CANONICAL_INSTANT_RE.test(value)) return false;
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return false;
    return new Date(parsed).toISOString() === value;
  }

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

  // --- Validated recovery-lifecycle capability -----------------------------
  // A raw, mutable, cloned, or hand-built recovery proposal/record is a
  // distinct runtime state from a value this module produced or accepted. Only
  // the latter may seal, reassess, or drive an active projection. The proof is
  // this module-private WeakSet: it holds only deep-frozen objects that
  // `proposeRecoveryWeek` created, `commitRecord` sealed, `reassessRecoveryRecord`
  // reassessed, or a validator accepted as a deep-frozen clone. It is never
  // serialized, never a caller-visible flag or token, reads no clock and no
  // randomness, and cannot be forged from outside this closure. A reload
  // revalidates the parsed record and uses the validator-returned frozen clone.
  const recoveryCapabilities = new WeakSet();
  const isRecoveryCapability = (value) =>
    value !== null && typeof value === "object" && recoveryCapabilities.has(value);
  function acceptRecoveryCapability(value) {
    deepFreeze(value);
    recoveryCapabilities.add(value);
    return value;
  }

  // Runtime consumers cannot read the Markdown policy document. Keep this
  // literal in the transition boundary, where the executable policy checks
  // already live, and return a fresh frozen value so callers cannot mutate the
  // approved contract they pass back into a validator.
  function approvedRecoveryPolicy() {
    return deepFreeze({
      kind: "taurifer-recovery-policy",
      policyVersion: RECOVERY_POLICY_VERSION,
      status: "Approved",
      primaryPatterns: ["knee-dominant", "horizontal press", "hip/hinge"],
      patternMapping: {
        squat: "knee-dominant",
        press: "horizontal press",
        incline_press: "horizontal press",
        hinge: "hip/hinge",
      },
      eligibility: {
        qualifyingOutcomes: ["maintained", "declined"],
        minimumPatterns: 2,
        checkpointAnswers: ["Yes", "No", "Not sure"],
        qualifyingCheckpointAnswer: "Yes",
      },
      ruleB: {
        optional: { effectiveWorkingSets: 0, reason: "optional-removed" },
        protected: { rounding: "ceil", divisor: 2, reason: "protected-ceil" },
        reducible: { rounding: "floor", divisor: 2, reason: "reducible-floor" },
        coverageRescue: {
          minimumWorkingSets: 1,
          selection: "first-eligible-stable-order",
          reason: "pattern-rescue",
        },
      },
      acceptanceBand: { minimum: 0.4, maximum: 0.6 },
      allowlistedMisses: {
        growth_2_v1: { base: 32, effective: 12 },
        growth_3_v1: { base: 49, effective: 17 },
      },
      reassessment: {
        outcomes: ["Better", "About the same", "Worse"],
        unset: null,
        ordinaryReviewOutcomes: ["About the same", "Worse"],
        sameBlockRepeat: false,
        weekTwoCanonical: true,
      },
    });
  }

  // Shared prior-record scan for the same-target-block repeat rule. Every
  // prior must be a closed committed recovery record — own-data JSON tree with
  // `kind:"recovery_week"`, `status:"committed"`, `archiveId:null`, no
  // successor, a non-empty top-level `transitionId` and `proposalHash`, the
  // own-data nested overlay (`diff.recoveryWeek`), a nested `transitionId`
  // exactly equal to the top-level one, and a non-empty nested `blockId` —
  // before it counts as repeat history. Any other shape is rejected
  // structurally *before* a single nested property is read, so a hostile
  // accessor carrier executes zero getters and malformed, preview,
  // other-kind, or nested-identity-mismatch priors never produce
  // `recovery_same_block_repeat`. Only `prior.diff.recoveryWeek.blockId` and
  // `prior.transitionId`/`prior.proposalHash` are read — there is no
  // unsupported top-level `prior.blockId` fallback. `selfIdentity`, when
  // given, exempts only the exact `{transitionId, proposalHash}` pair so a
  // record already stored under its own id and hash re-validates idempotently;
  // the same id with a different hash is a structural collision.
  function sameBlockRepeatScan(list, targetBlockId, selfIdentity) {
    if (list === undefined) return { ok: true };
    if (!isOwnArray(list)) return { ok: false, reason: "invalid_options" };
    for (const prior of list) {
      if (!isOwnRecord(prior) ||
          !isOwnJsonTree(prior) ||
          prior.kind !== "recovery_week" ||
          prior.status !== "committed" ||
          prior.archiveId !== null ||
          prior.successor !== undefined ||
          typeof prior.transitionId !== "string" || !prior.transitionId.trim() ||
          typeof prior.proposalHash !== "string" || !prior.proposalHash.trim() ||
          !isOwnRecord(prior.diff) ||
          !isOwnRecord(prior.diff.recoveryWeek) ||
          prior.diff.recoveryWeek.transitionId !== prior.transitionId ||
          typeof prior.diff.recoveryWeek.blockId !== "string" || !prior.diff.recoveryWeek.blockId.trim()) {
        return { ok: false, reason: "invalid_options" };
      }
      if (selfIdentity !== undefined) {
        if (prior.transitionId === selfIdentity.transitionId) {
          if (prior.proposalHash !== selfIdentity.proposalHash) {
            return { ok: false, reason: "invalid_options" };
          }
          continue;
        }
      }
      if (prior.diff.recoveryWeek.blockId === targetBlockId) {
        return { ok: false, reason: "recovery_same_block_repeat" };
      }
    }
    return { ok: true };
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

  // Recovery proposals pin the exact consumed compiler context: every supported
  // key must be an own property and every value must match without string
  // coercion, so an inferred or loosened version table cannot mint a proposal.
  function exactVersionMatches(provenance, supportedVersions) {
    const pairs = [
      ["blueprintVersion", "blueprint"],
      ["compilerVersion", "compiler"],
      ["catalogueVersion", "catalogue"],
      ["rulesVersion", "rules"],
      ["contextVersion", "context"],
      ["recentConsistencyVersion", "recentConsistency"],
    ];
    if (!isObject(supportedVersions) || !isObject(provenance)) return false;
    return pairs.every(([field, supported]) =>
      own(supportedVersions, supported) && provenance[field] === supportedVersions[supported]);
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


  // Volume reduction consumes the compiler's own pinned projection metadata; it
  // never re-derives prescription-class floors. Every resolved predecessor slot
  // must have a matching projected `program` row (by stable slotId) whose
  // integer `minSets` is a sane floor (>= 1 and <= the canonical working-set
  // count) and whose identity fields agree with the slot. Anything missing,
  // non-integer, out of range, or mismatched is typed `volume_metadata_invalid`
  // rather than a guessed fallback.
  function resolveVolumeMetadata(instance) {
    const program = instance && instance.program;
    if (!Array.isArray(program)) return { ok: false, code: "volume_metadata_invalid" };
    const rowsBySlotId = new Map();
    for (const row of program) {
      if (!isObject(row) || typeof row.slotId !== "string" || !row.slotId ||
          rowsBySlotId.has(row.slotId)) {
        return { ok: false, code: "volume_metadata_invalid" };
      }
      rowsBySlotId.set(row.slotId, row);
    }
    const floors = new Map();
    for (const { slot, day } of flattenedSlots(instance)) {
      const row = rowsBySlotId.get(slot.slotId);
      if (!row) return { ok: false, code: "volume_metadata_invalid" };
      const canonicalSets = slot.prescription?.sets;
      if (!Number.isInteger(canonicalSets) || canonicalSets < 1) {
        return { ok: false, code: "volume_metadata_invalid" };
      }
      if (!Number.isInteger(row.minSets) || row.minSets < 1 || row.minSets > canonicalSets) {
        return { ok: false, code: "volume_metadata_invalid" };
      }
      if (row.dayId !== day.dayId || row.libraryId !== slot.exercise?.id ||
          row.movementId !== movementId(slot) || row.priority !== slot.status) {
        return { ok: false, code: "volume_metadata_invalid" };
      }
      floors.set(slot.slotId, row.minSets);
    }
    return { ok: true, floors, rowsBySlotId };
  }

  // Shipped compiler exposure semantics (program-compiler.js `exposureFor`):
  // every resolved slot adds its canonical working-set count to each of its
  // primary muscles (direct) and secondary muscles (indirect). Recomputed from
  // the successor's own slots so a reduction never republishes predecessor
  // totals.
  function exposureFromSlots(days) {
    const direct = {};
    const indirect = {};
    for (const dayRecord of days) {
      for (const resolved of dayRecord.slots) {
        const sets = resolved.prescription.sets;
        for (const muscle of resolved.exercise.primaryMuscles || []) {
          direct[muscle] = (direct[muscle] || 0) + sets;
        }
        for (const muscle of resolved.exercise.secondaryMuscles || []) {
          indirect[muscle] = (indirect[muscle] || 0) + sets;
        }
      }
    }
    return { direct, indirect };
  }

  function updateProgressionShape(resolved) {
    const prescription = resolved?.prescription;
    const strategy = prescription?.progression?.strategy;
    if (!strategy) return;
    if (strategy.id === "range") {
      strategy.params.workingSets = prescription.sets;
      strategy.params.targetRirMin = prescription.targetRirMin;
      strategy.params.targetRirMax = prescription.targetRirMax;
    }
    if (strategy.id === "rep_goal") {
      strategy.params.workingSets = prescription.sets;
      strategy.params.repGoal = prescription.sets * Math.round((prescription.repMin + prescription.repMax) / 2);
      strategy.params.targetRirMin = prescription.targetRirMin;
      strategy.params.targetRirMax = prescription.targetRirMax;
    }
    if (strategy.id === "effort_target") strategy.params.workingSets = prescription.sets;
    if (strategy.id === "anchor_backoff") strategy.params.backoffSets = Math.max(1, prescription.sets - 1);
  }

  // Projection by preservation: each retained successor slot keeps its exact
  // predecessor `program` row and only its placement (`order`, `dayId`, `day`)
  // and set-dependent fields (`sets`, `progression`) are updated from the
  // transformed resolved slot. minSets/maxSets, notes, alternates, loading/RIR,
  // and any unknown forward-compatible fields are carried through untouched.
  // Optional rows are simply absent because their slots are gone.
  function projectByPreservation(instance, rowsBySlotId) {
    const exercises = [];
    for (const dayRecord of instance.days) {
      dayRecord.slots.forEach((resolved, index) => {
        const base = clone(rowsBySlotId.get(resolved.slotId));
        const progression = clone(resolved.prescription.progression);
        const strategy = progression?.strategy?.id;
        base.order = index + 1;
        base.dayId = dayRecord.dayId;
        base.day = dayRecord.label;
        base.sets = strategy === "anchor_backoff"
          ? 1 + progression.strategy.params.backoffSets
          : resolved.prescription.sets;
        base.progression = progression;
        exercises.push(base);
      });
    }
    return exercises;
  }

  function deriveVolumeReduction(predecessorInstance, policyVersion) {
    if (policyVersion !== 1 || !Number.isInteger(policyVersion)) {
      return { ok: false, code: "unsupported_policy_version" };
    }
    const predCheck = validateCompilerInstance(predecessorInstance);
    if (!predCheck.ok) return predCheck;

    const metadata = resolveVolumeMetadata(predecessorInstance);
    if (!metadata.ok) return metadata;
    const { floors, rowsBySlotId } = metadata;

    let optionalCount = 0;
    let reducibleAboveFloorCount = 0;
    const changedSlotIds = new Set();
    const canonicalSetsById = new Map();

    for (const { slot } of flattenedSlots(predecessorInstance)) {
      canonicalSetsById.set(slot.slotId, slot.prescription.sets);
      if (slot.status === "optional") {
        optionalCount++;
        changedSlotIds.add(slot.slotId);
      } else if (slot.status === "protected") {
        // Retained byte-equivalent
      } else if (slot.reducible === true) {
        if (slot.prescription.sets > floors.get(slot.slotId)) {
          reducibleAboveFloorCount++;
          changedSlotIds.add(slot.slotId);
        }
      }
    }

    // Every slot that will change must appear exactly once in every predecessor
    // week, carrying its canonical predecessor set count. Missing, duplicated,
    // or non-canonical coverage is a typed Unavailable, never a guessed rewrite.
    if (!Array.isArray(predecessorInstance.weeks)) {
      return { ok: false, code: "volume_metadata_invalid" };
    }
    for (const week of predecessorInstance.weeks) {
      if (!isObject(week) || !Array.isArray(week.days)) {
        return { ok: false, code: "volume_metadata_invalid" };
      }
      for (const changedId of changedSlotIds) {
        let seen = 0;
        let weekSets = null;
        for (const weekDay of week.days) {
          if (!isObject(weekDay) || !Array.isArray(weekDay.slots)) {
            return { ok: false, code: "volume_metadata_invalid" };
          }
          for (const weekSlot of weekDay.slots) {
            if (weekSlot && weekSlot.slotId === changedId) {
              seen += 1;
              weekSets = weekSlot.sets;
            }
          }
        }
        if (seen !== 1 || weekSets !== canonicalSetsById.get(changedId)) {
          return { ok: false, code: "noncanonical_reentry_prescription" };
        }
      }
    }

    if (optionalCount === 0 && reducibleAboveFloorCount === 0) {
      return { ok: false, code: "no_safe_volume_reduction" };
    }

    const successor = clone(predecessorInstance);

    for (const day of successor.days) {
      const newSlots = [];
      for (const slot of day.slots) {
        if (slot.status === "optional") {
          continue;
        }
        if (slot.status === "protected") {
          newSlots.push(slot);
          continue;
        }
        if (slot.reducible === true) {
          const minSets = floors.get(slot.slotId);
          if (slot.prescription.sets > minSets) {
            slot.prescription.sets = minSets;
            updateProgressionShape(slot);
          }
          newSlots.push(slot);
          continue;
        }
        newSlots.push(slot);
      }
      day.slots = newSlots;
    }

    const remainingSlotIds = new Set(flattenedSlots(successor).map((e) => e.slot.slotId));
    const successorSlotsById = new Map(flattenedSlots(successor).map((e) => [e.slot.slotId, e.slot]));

    // Remove optional entries and set retained reduced entries consistently in
    // every week; unrelated slots keep their canonical count.
    for (const week of successor.weeks) {
      for (const day of week.days) {
        day.slots = day.slots.filter((s) => remainingSlotIds.has(s.slotId));
        for (const weekSlot of day.slots) {
          const succSlot = successorSlotsById.get(weekSlot.slotId);
          if (succSlot) {
            weekSlot.sets = succSlot.prescription.sets;
          }
        }
      }
    }

    successor.relations = successor.relations.filter(
      (rel) => remainingSlotIds.has(rel.heavySlotId) && remainingSlotIds.has(rel.volumeSlotId)
    );

    // Projection by preservation, exposure recomputed from successor slots.
    successor.program = projectByPreservation(successor, rowsBySlotId);
    successor.directIndirectExposure = exposureFromSlots(successor.days);

    // Clone the predecessor structure; only provenance and week prescriptions
    // move. schemaVersion, day metadata, customizedFrom, and any unrelated safe
    // fields are retained.
    successor.programStructure = clone(predecessorInstance.programStructure);
    successor.programStructure.provenance = clone(successor.provenance);
    successor.programStructure.weekPrescriptions = clone(successor.weeks);

    const succCheck = validateCompilerInstance(successor);
    if (!succCheck.ok) return succCheck;

    const mapping = buildSlotMapping(predecessorInstance, successor);
    const progression = relationContract(predecessorInstance, successor, mapping);
    if (!progression.ok) return progression;
    const diff = buildExactDiff(predecessorInstance, successor, mapping);

    return {
      ok: true,
      successorInstance: successor,
      mapping,
      diff,
      progression,
    };
  }

  function volumeContractIssue(proposal, predecessor, successor) {
    if (!isObject(proposal) || proposal.schemaVersion !== SCHEMA_VERSION ||
        proposal.kind !== "reduce_training_volume" ||
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
    if (!isObject(proposal.diagnosis) ||
        proposal.diagnosis.kind !== "reduce_training_volume" ||
        !isObject(proposal.diagnosis.answers) ||
        !Array.isArray(proposal.diagnosis.eligibleEvidenceIds) ||
        !proposal.diagnosis.eligibleEvidenceIds.length ||
        !proposal.diagnosis.eligibleEvidenceIds.every((id) => typeof id === "string" && id.trim().length > 0) ||
        !Array.isArray(proposal.diagnosis.insufficientEvidenceReasons) ||
        proposal.diagnosis.insufficientEvidenceReasons.length > 0) {
      return "insufficient_transition_evidence";
    }
    if (proposal.derivation?.mode !== "reduction" ||
        proposal.derivation?.request !== "reduce-training-volume" ||
        !isObject(proposal.derivation?.compilerContextVersions) ||
        !isObject(proposal.derivation?.policyVersions) ||
        Object.keys(proposal.derivation.policyVersions).length !== 1 ||
        proposal.derivation.policyVersions.volumeReduction !== 1) {
      return "unsupported_policy_version";
    }
    if (!isObject(predecessor) || !isObject(predecessor.provenance) ||
        !sameCanonical(proposal.derivation.compilerContextVersions, predecessor.provenance)) {
      return "compiler_context_versions_mismatch";
    }
    return null;
  }

  async function proposeVolumeReduction(input) {
    const invalid = (code) =>
      Object.freeze({
        ok: false,
        status: "unavailable",
        unavailable: true,
        code,
      });

    if (!isObject(input)) return invalid("invalid_proposal");

    if (!Number.isInteger(input.policyVersion) || input.policyVersion !== 1) {
      return invalid("unsupported_policy_version");
    }
    const policyVersion = input.policyVersion;

    const predecessorInstance = input.predecessorInstance ||
      (input.predecessor?.kind === "compiled" ? input.predecessor : input.predecessor?.instance);
    if (!isObject(predecessorInstance)) {
      return invalid("missing_predecessor");
    }
    const predCheck = validateCompilerInstance(predecessorInstance);
    if (!predCheck.ok) {
      return invalid(predCheck.code === "customized_compiler_snapshot" ? "customized_compiler_snapshot" : predCheck.code);
    }

    const predecessor = isObject(input.predecessor) && input.predecessor.kind !== "compiled"
      ? input.predecessor
      : {
          programId: input.predecessorProgramId || input.programId,
          durableRevision: input.durableRevision,
          source: input.source,
        };

    if (typeof predecessor.programId !== "string" || !predecessor.programId.trim() ||
        !Number.isInteger(predecessor.durableRevision) || predecessor.durableRevision < 0 ||
        typeof predecessor.source !== "string" || !RECONSTRUCTABLE_SOURCES.has(predecessor.source)) {
      return invalid("unsupported_source");
    }

    const successorProgramId = input.successorProgramId || input.successor?.programId;
    if (typeof successorProgramId !== "string" || !successorProgramId.trim() || successorProgramId === predecessor.programId) {
      return invalid("successor_identity_invalid");
    }

    const transitionId = input.transitionId;
    const createdAt = input.createdAt;
    if (typeof transitionId !== "string" || !transitionId.trim() ||
        typeof createdAt !== "string" || !createdAt.trim()) {
      return invalid("invalid_proposal");
    }

    const diagnosis = input.diagnosis;
    if (!isObject(diagnosis)) {
      return invalid("insufficient_transition_evidence");
    }
    if (diagnosis.kind !== "reduce_training_volume") {
      return invalid("unsupported_diagnosis_kind");
    }
    if (!isObject(diagnosis.answers)) {
      return invalid("insufficient_transition_evidence");
    }
    if (!Array.isArray(diagnosis.eligibleEvidenceIds) ||
        diagnosis.eligibleEvidenceIds.length === 0 ||
        !diagnosis.eligibleEvidenceIds.every((id) => typeof id === "string" && id.trim().length > 0) ||
        !Array.isArray(diagnosis.insufficientEvidenceReasons) ||
        diagnosis.insufficientEvidenceReasons.length > 0) {
      return invalid("insufficient_transition_evidence");
    }

    const supportedVersions = input.supportedVersions || input.Compiler?.VERSIONS || input.compiler?.VERSIONS;
    if (!supportedVersions || !versionMatches(predecessorInstance.provenance, supportedVersions)) {
      return invalid("unsupported_compiler_version");
    }

    const derivation = deriveVolumeReduction(predecessorInstance, policyVersion);
    if (!derivation.ok) {
      return invalid(derivation.code);
    }

    const successorInstance = derivation.successorInstance;
    const mapping = derivation.mapping;
    const diff = derivation.diff;
    const progression = derivation.progression;

    const predecessorFingerprint = await fingerprintCompilerInstance(predecessorInstance);
    const successorFingerprint = await fingerprintCompilerInstance(successorInstance);

    const proposal = {
      schemaVersion: SCHEMA_VERSION,
      transitionId,
      kind: "reduce_training_volume",
      createdAt,
      predecessor: {
        programId: predecessor.programId,
        fingerprint: predecessorFingerprint,
        durableRevision: predecessor.durableRevision,
        source: predecessor.source,
        compilerProvenance: clone(predecessorInstance.provenance),
      },
      diagnosis: clone(diagnosis),
      derivation: {
        mode: "reduction",
        request: "reduce-training-volume",
        compilerContextVersions: {
          ...clone(successorInstance.provenance),
        },
        policyVersions: {
          volumeReduction: 1,
        },
        slotMapping: mapping,
      },
      successor: {
        programId: successorProgramId,
        source: predecessor.source,
        compilerProvenance: clone(successorInstance.provenance),
        fingerprint: successorFingerprint,
      },
      diff,
      progressionContract: progression.value,
      status: "preview",
    };

    const contractIssue = volumeContractIssue(proposal, predecessorInstance, successorInstance);
    if (contractIssue) return invalid(contractIssue);

    proposal.proposalHash = await hashProposal(proposal);

    return Object.freeze({
      ok: true,
      status: "preview",
      proposal: deepFreeze(proposal),
      successorInstance: deepFreeze(successorInstance),
    });
  }

  async function validateVolumeProposal(proposal, current) {
    if (!isObject(current?.predecessor) || !isObject(current.predecessorInstance)) {
      return { ok: false, status: "invalid", code: "missing_validation_snapshot" };
    }
    const contractIssue = volumeContractIssue(
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

    const volumeMetadata = resolveVolumeMetadata(current.predecessorInstance);
    if (!volumeMetadata.ok) return { ok: false, status: "invalid", code: volumeMetadata.code };
    const floorFor = (slotId) => volumeMetadata.floors.get(slotId);

    if (!sameCanonical(proposal.predecessor?.compilerProvenance, current.predecessorInstance.provenance)) {
      return { ok: false, status: "invalid", code: "predecessor_provenance_mismatch" };
    }

    if (current.supportedVersions && !versionMatches(current.predecessorInstance.provenance, current.supportedVersions)) {
      return { ok: false, status: "invalid", code: "unsupported_compiler_version" };
    }

    // 1. Semantic checks on proposal.diff
    if (proposal.diff?.exercises) {
      const predSlotsMap = new Map(flattenedSlots(current.predecessorInstance).map((r) => [r.slot.slotId, r.slot]));
      for (const ex of proposal.diff.exercises) {
        const predSlot = predSlotsMap.get(ex.predecessorSlot);
        if (predSlot && predSlot.status === "protected") {
          if (ex.reason !== "mapped same-template slot" || !ex.after || ex.before?.sets !== ex.after?.sets) {
            return { ok: false, status: "invalid", code: "protected_slot_mutated" };
          }
        }
        if (ex.after && predSlot) {
          const minSets = floorFor(predSlot.slotId);
          if (Number.isInteger(minSets) && ex.after.sets < minSets) {
            return { ok: false, status: "invalid", code: "below_floor_cut" };
          }
        }
      }

      const anyCutInDiff = proposal.diff.exercises.some((e) => e.before && e.after && e.after.sets < e.before.sets);
      if (anyCutInDiff) {
        for (const ex of proposal.diff.exercises) {
          const predSlot = predSlotsMap.get(ex.predecessorSlot);
          if (predSlot && predSlot.status === "optional" && ex.after !== null) {
            return { ok: false, status: "invalid", code: "optional_slot_retained" };
          }
        }
      }
    }

    // 2. Semantic checks on current.successorInstance if provided
    if (current.successorInstance) {
      const succSlotsMap = new Map(flattenedSlots(current.successorInstance).map((r) => [r.slot.slotId, r.slot]));
      for (const { slot: predSlot } of flattenedSlots(current.predecessorInstance)) {
        if (predSlot.status === "protected") {
          const succSlot = succSlotsMap.get(predSlot.slotId);
          if (!succSlot || succSlot.prescription?.sets !== predSlot.prescription?.sets || !sameCanonical(succSlot, predSlot)) {
            return { ok: false, status: "invalid", code: "protected_slot_mutated" };
          }
        }
      }

      for (const { slot: succSlot } of flattenedSlots(current.successorInstance)) {
        const minSets = floorFor(succSlot.slotId);
        if (Number.isInteger(minSets) && succSlot.prescription?.sets < minSets) {
          return { ok: false, status: "invalid", code: "below_floor_cut" };
        }
      }

      let anyReducibleCut = false;
      for (const { slot: predSlot } of flattenedSlots(current.predecessorInstance)) {
        if (predSlot.reducible) {
          const succSlot = succSlotsMap.get(predSlot.slotId);
          if (succSlot && succSlot.prescription?.sets < predSlot.prescription?.sets) {
            anyReducibleCut = true;
            break;
          }
        }
      }
      if (anyReducibleCut) {
        for (const { slot: succSlot } of flattenedSlots(current.successorInstance)) {
          if (succSlot.status === "optional") {
            return { ok: false, status: "invalid", code: "optional_slot_retained" };
          }
        }
      }

      const succCheck = validateCompilerInstance(current.successorInstance);
      if (!succCheck.ok) return { ok: false, status: "invalid", code: succCheck.code };

      // Recompute the successor's direct/indirect exposure from its own slots and
      // reject a stale or tampered exposure object before any hash comparison.
      const expectedExposure = exposureFromSlots(current.successorInstance.days);
      if (!sameCanonical(current.successorInstance.directIndirectExposure, expectedExposure)) {
        return { ok: false, status: "invalid", code: "volume_exposure_stale" };
      }
    }

    const derivation = deriveVolumeReduction(current.predecessorInstance, 1);
    if (!derivation.ok) {
      return { ok: false, status: "invalid", code: derivation.code };
    }
    const expectedSuccessor = derivation.successorInstance;
    const expectedMapping = derivation.mapping;
    const expectedProgression = derivation.progression;

    if (current.successorInstance && !sameCanonical(current.successorInstance, expectedSuccessor)) {
      return { ok: false, status: "invalid", code: "successor_identity_mismatch" };
    }

    const exactDiffIssue = diffIssue(
      proposal.diff,
      current.predecessorInstance,
      expectedSuccessor,
      expectedMapping,
    );
    if (exactDiffIssue) return { ok: false, status: "invalid", code: exactDiffIssue };

    const mappingIssue = mappingCoverageIssue(
      proposal.derivation?.slotMapping,
      current.predecessorInstance,
      expectedSuccessor,
    );
    if (mappingIssue) return { ok: false, status: "invalid", code: mappingIssue };

    if (!sameCanonical(proposal.progressionContract, expectedProgression.value)) {
      return { ok: false, status: "invalid", code: "progression_contract_mismatch" };
    }

    if (!sameCanonical(proposal.successor?.compilerProvenance, expectedSuccessor.provenance) ||
        proposal.successor?.fingerprint !== await fingerprintCompilerInstance(expectedSuccessor)) {
      return { ok: false, status: "invalid", code: "successor_identity_mismatch" };
    }

    if (proposal.proposalHash !== await hashProposal(proposal)) {
      return { ok: false, status: "invalid", code: "proposal_hash_mismatch" };
    }

    return { ok: true, status: "preview" };
  }
  async function validateProposal(proposal, current) {
    if (!isObject(proposal)) {
      return { ok: false, status: "invalid", code: "invalid_proposal" };
    }
    if (proposal.kind === "recovery_week") {
      if (proposal.status === "committed") {
        return validateRecoveryRecord(proposal, current);
      }
      return validateRecoveryProposal(proposal, current);
    }
    if (proposal.kind === "reduce_training_volume") {
      return validateVolumeProposal(proposal, current);
    }
    if (proposal.kind !== "lower_frequency_sibling" && proposal.kind !== "shorter_session_sibling") {
      return { ok: false, status: "invalid", code: "unsupported_transition_kind" };
    }

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
    if (proposal.status !== "preview") throw new TypeError("proposal.status: expected preview proposal");
    if (typeof proposal.proposalHash !== "string" || !proposal.proposalHash) {
      throw new TypeError("proposal.proposalHash: expected non-empty string");
    }
    if (!isObject(options)) throw new TypeError("options: expected object");

    if (proposal.kind === "recovery_week") {
      // Recovery sealing is gated on the validated-proposal capability: a raw,
      // cloned, stripped, or semantically forged preview is not in the set and
      // throws here, so no committed record is produced from it.
      if (!isRecoveryCapability(proposal)) {
        throw new TypeError("proposal: expected a validated recovery-week proposal capability");
      }
      if (proposal.successor !== undefined) {
        throw new TypeError("proposal.successor: forbidden for recovery_week");
      }
      if (!isObject(proposal.diff) || !isObject(proposal.diff.recoveryWeek) ||
          !Array.isArray(proposal.diff.recoveryWeek.entries) || proposal.diff.recoveryWeek.entries.length === 0) {
        throw new TypeError("proposal.diff.recoveryWeek: expected a complete recovery overlay");
      }
      const { confirmedAt, reassessmentDueAt, archiveId } = options;
      if (archiveId !== null) {
        throw new TypeError("archiveId: expected null for recovery_week");
      }
      if (!isCanonicalInstant(confirmedAt)) {
        throw new TypeError("confirmedAt: expected canonical ISO-8601 UTC millisecond instant");
      }
      if (!isCanonicalInstant(reassessmentDueAt)) {
        throw new TypeError("reassessmentDueAt: expected canonical ISO-8601 UTC millisecond instant");
      }
      if (!isCanonicalInstant(proposal.createdAt) || Date.parse(confirmedAt) < Date.parse(proposal.createdAt)) {
        throw new TypeError("confirmedAt: expected an instant at or after proposal.createdAt");
      }
      if (Date.parse(reassessmentDueAt) <= Date.parse(confirmedAt)) {
        throw new TypeError("reassessmentDueAt: expected timestamp strictly after confirmedAt");
      }

      const record = clone(proposal);
      record.status = "committed";
      record.confirmedAt = confirmedAt;
      record.archiveId = null;
      record.diff.recoveryWeek.confirmedAt = confirmedAt;
      record.diff.recoveryWeek.reassessmentDueAt = reassessmentDueAt;
      record.diff.recoveryWeek.reassessmentOutcome = null;

      return acceptRecoveryCapability(record);
    }

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

  /* Pure recovery week eligibility preflight for future proposeRecoveryWeek.
     Validates the passed approved policy object against the closed version 2
     contract in docs/recovery-week-policy.md, evaluates the evidence, and
     returns either an immutable eligible result with normalized evidence or a
     typed ineligible result. Never emits a proposal, hash, overlay, or allocation. */
  // Consumed policy-v2 validator: the whole policy must be an own-data JSON tree
  // and every set P5b reads is closed to its documented own-key set and exact
  // value or ordered array, including the top-level key set. Extra top-level,
  // mapping, or allowlist entries would reinterpret the fixed policy and are
  // rejected as policy_invalid.
  function isApprovedRecoveryPolicy(policy) {
    if (!isObject(policy)) return false;
    // The whole consumed policy must be own-data: no leaf, ordered enum, or
    // nested record may resolve through a prototype carrier, and the top-level
    // key set is closed to exactly the executable Policy v2 shape.
    if (!isOwnJsonTree(policy)) return false;
    if (!exactKeys(policy, [
      "kind",
      "policyVersion",
      "status",
      "primaryPatterns",
      "patternMapping",
      "eligibility",
      "ruleB",
      "acceptanceBand",
      "allowlistedMisses",
      "reassessment",
    ])) return false;
    if (policy.kind !== "taurifer-recovery-policy") return false;
    if (policy.policyVersion !== RECOVERY_POLICY_VERSION) return false;
    if (policy.status !== "Approved") return false;
    if (!noUnsafeKeys(policy)) return false;
    if (!exactOrderedArray(policy.primaryPatterns, ["knee-dominant", "horizontal press", "hip/hinge"])) return false;
    if (!exactKeys(policy.patternMapping, ["squat", "press", "incline_press", "hinge"]) ||
        policy.patternMapping.squat !== "knee-dominant" ||
        policy.patternMapping.press !== "horizontal press" ||
        policy.patternMapping.incline_press !== "horizontal press" ||
        policy.patternMapping.hinge !== "hip/hinge") return false;
    if (!isObject(policy.eligibility)) return false;
    const eligibilityKeys = ["qualifyingOutcomes", "minimumPatterns", "checkpointAnswers", "qualifyingCheckpointAnswer"];
    if (!exactKeys(policy.eligibility, eligibilityKeys)) {
      if (!exactKeys(policy.eligibility, [...eligibilityKeys, "question"]) ||
          policy.eligibility.question !== RECOVERY_CHECKPOINT_QUESTION) return false;
    }
    if (!exactOrderedArray(policy.eligibility.qualifyingOutcomes, ["maintained", "declined"])) return false;
    if (policy.eligibility.minimumPatterns !== 2) return false;
    if (!exactOrderedArray(policy.eligibility.checkpointAnswers, ["Yes", "No", "Not sure"])) return false;
    if (policy.eligibility.qualifyingCheckpointAnswer !== "Yes") return false;
    if (!isObject(policy.ruleB) ||
        !exactKeys(policy.ruleB, ["optional", "protected", "reducible", "coverageRescue"])) return false;
    if (!exactKeys(policy.ruleB.optional, ["effectiveWorkingSets", "reason"]) ||
        policy.ruleB.optional.effectiveWorkingSets !== 0 ||
        policy.ruleB.optional.reason !== "optional-removed") return false;
    if (!exactKeys(policy.ruleB.protected, ["rounding", "divisor", "reason"]) ||
        policy.ruleB.protected.rounding !== "ceil" ||
        policy.ruleB.protected.divisor !== 2 ||
        policy.ruleB.protected.reason !== "protected-ceil") return false;
    if (!exactKeys(policy.ruleB.reducible, ["rounding", "divisor", "reason"]) ||
        policy.ruleB.reducible.rounding !== "floor" ||
        policy.ruleB.reducible.divisor !== 2 ||
        policy.ruleB.reducible.reason !== "reducible-floor") return false;
    if (!exactKeys(policy.ruleB.coverageRescue, ["minimumWorkingSets", "selection", "reason"]) ||
        policy.ruleB.coverageRescue.minimumWorkingSets !== 1 ||
        policy.ruleB.coverageRescue.selection !== "first-eligible-stable-order" ||
        policy.ruleB.coverageRescue.reason !== "pattern-rescue") return false;
    if (!exactKeys(policy.acceptanceBand, ["minimum", "maximum"]) ||
        policy.acceptanceBand.minimum !== 0.4 ||
        policy.acceptanceBand.maximum !== 0.6) return false;
    if (!exactKeys(policy.allowlistedMisses, ["growth_2_v1", "growth_3_v1"])) return false;
    if (!exactKeys(policy.allowlistedMisses.growth_2_v1, ["base", "effective"]) ||
        policy.allowlistedMisses.growth_2_v1.base !== 32 ||
        policy.allowlistedMisses.growth_2_v1.effective !== 12) return false;
    if (!exactKeys(policy.allowlistedMisses.growth_3_v1, ["base", "effective"]) ||
        policy.allowlistedMisses.growth_3_v1.base !== 49 ||
        policy.allowlistedMisses.growth_3_v1.effective !== 17) return false;
    if (!exactKeys(policy.reassessment, ["outcomes", "unset", "ordinaryReviewOutcomes", "sameBlockRepeat", "weekTwoCanonical"])) return false;
    if (!exactOrderedArray(policy.reassessment.outcomes, ["Better", "About the same", "Worse"])) return false;
    if (policy.reassessment.unset !== null) return false;
    if (!exactOrderedArray(policy.reassessment.ordinaryReviewOutcomes, ["About the same", "Worse"])) return false;
    if (policy.reassessment.sameBlockRepeat !== false) return false;
    if (policy.reassessment.weekTwoCanonical !== true) return false;
    return true;
  }

  function evaluateRecoveryEligibility(evidence, approvedPolicy) {
    if (!isApprovedRecoveryPolicy(approvedPolicy)) {
      return Object.freeze({
        ok: false,
        status: "ineligible",
        ineligible: true,
        code: "policy_invalid",
      });
    }

    // Raw evidence is JSON data, so the whole tree must be own-data before any
    // evidence field is read: prototype carriers, accessors, symbol keys,
    // non-enumerable fields, and malformed nested records or arrays reject
    // structurally, without invoking any getter.
    if (!isOwnJsonTree(evidence)) {
      return Object.freeze({
        ok: false,
        status: "ineligible",
        ineligible: true,
        code: "invalid_evidence",
      });
    }

    if (!isObject(evidence) || !own(evidence, "outcomesByPattern") || !isObject(evidence.outcomesByPattern)) {
      return Object.freeze({
        ok: false,
        status: "ineligible",
        ineligible: true,
        code: "invalid_evidence",
      });
    }

    // The evidence object is presence-governed: outcomesByPattern plus the
    // closed checkpoint answer, with the optional canonical question text and
    // the stored qualifyingPatterns list (always recomputed here, never
    // trusted). Free text, diagnosis, or any other key never satisfies
    // eligibility.
    const evidenceKeys = Object.keys(evidence);
    const knownEvidenceKeys = evidenceKeys.every((key) =>
      key === "outcomesByPattern" || key === "checkpointAnswer" ||
      key === "qualifyingPatterns" || key === "question" || key === "sourceBlockId");
    const questionOk = !evidenceKeys.includes("question") ||
      evidence.question === RECOVERY_CHECKPOINT_QUESTION;
    if (!knownEvidenceKeys || !questionOk || evidenceKeys.length > 5) {
      return Object.freeze({
        ok: false,
        status: "ineligible",
        ineligible: true,
        code: "invalid_evidence",
      });
    }

    if (own(evidence, "sourceBlockId") &&
        (typeof evidence.sourceBlockId !== "string" || !evidence.sourceBlockId.trim())) {
      return Object.freeze({
        ok: false,
        status: "ineligible",
        ineligible: true,
        code: "invalid_evidence",
      });
    }

    const keys = Object.keys(evidence.outcomesByPattern);
    for (const key of keys) {
      if (DANGEROUS_KEYS.has(key) || !approvedPolicy.primaryPatterns.includes(key)) {
        return Object.freeze({
          ok: false,
          status: "ineligible",
          ineligible: true,
          code: "invalid_evidence",
        });
      }
      const val = evidence.outcomesByPattern[key];
      if (typeof val !== "string") {
        return Object.freeze({
          ok: false,
          status: "ineligible",
          ineligible: true,
          code: "invalid_evidence",
        });
      }
    }

    // The closed checkpoint answer must be an own property; an answer reached
    // only through the evidence prototype never passes the "Yes" gate.
    const checkpointAnswer = own(evidence, "checkpointAnswer") ? evidence.checkpointAnswer : undefined;
    if (checkpointAnswer !== "Yes") {
      return Object.freeze({
        ok: false,
        status: "ineligible",
        ineligible: true,
        code: "checkpoint_not_yes",
      });
    }

    const qualifyingPatterns = [];
    const normalizedOutcomes = {};

    for (const pattern of approvedPolicy.primaryPatterns) {
      if (own(evidence.outcomesByPattern, pattern)) {
        const outcome = evidence.outcomesByPattern[pattern];
        if (approvedPolicy.eligibility.qualifyingOutcomes.includes(outcome)) {
          // The evidence snapshot names only the qualifying patterns and the
          // maintained/declined observation supporting each one, in fixed policy
          // order (docs/recovery-week-policy.md). A non-qualifying third
          // known-pattern outcome (improved/insufficient/untested) is evaluated
          // for the gate but is never persisted as eligibility evidence.
          normalizedOutcomes[pattern] = outcome;
          qualifyingPatterns.push(pattern);
        }
      }
    }

    if (qualifyingPatterns.length < approvedPolicy.eligibility.minimumPatterns) {
      return Object.freeze({
        ok: false,
        status: "ineligible",
        ineligible: true,
        code: "insufficient_qualifying_patterns",
      });
    }

    return deepFreeze({
      ok: true,
      status: "eligible",
      eligible: true,
      policyVersion: approvedPolicy.policyVersion,
      eligibilityEvidence: {
        outcomesByPattern: normalizedOutcomes,
        qualifyingPatterns,
        checkpointAnswer: "Yes",
        ...(own(evidence, "sourceBlockId") ? { sourceBlockId: evidence.sourceBlockId } : {}),
      },
    });
  }

  function deriveRecoveryWeek(predecessorInstance, approvedPolicy) {
    const slots = flattenedSlots(predecessorInstance).map((r) => r.slot);
    const entries = slots.map((slot) => {
      const rawPattern = slot.contract?.patterns?.[0];
      const movementPattern = approvedPolicy.patternMapping[rawPattern] || null;
      const baseWorkingSets = slot.prescription?.sets;
      if (slot.status !== "optional" && slot.status !== "protected" && slot.status !== "reducible") {
        return { ok: false, code: "recovery_slot_status_invalid" };
      }
      if (!Number.isInteger(baseWorkingSets) || baseWorkingSets < 1) {
        return { ok: false, code: "recovery_base_sets_invalid" };
      }
      const movement = movementId(slot);
      if (movement === null) {
        return { ok: false, code: "recovery_movement_missing" };
      }
      let effectiveWorkingSets = 0;
      let reason = "";
      const isOptional = slot.status === "optional";
      if (isOptional) {
        effectiveWorkingSets = 0;
        reason = approvedPolicy.ruleB.optional.reason;
      } else if (slot.status === "protected") {
        effectiveWorkingSets = Math.ceil(baseWorkingSets / approvedPolicy.ruleB.protected.divisor);
        reason = approvedPolicy.ruleB.protected.reason;
      } else if (slot.status === "reducible") {
        effectiveWorkingSets = Math.floor(baseWorkingSets / approvedPolicy.ruleB.reducible.divisor);
        reason = approvedPolicy.ruleB.reducible.reason;
      }
      return {
        slot: slot.slotId,
        movement,
        movementPattern,
        baseWorkingSets,
        effectiveWorkingSets,
        removedOptionalFirst: isOptional,
        reason,
      };
    });
    const failedEntry = entries.find((entry) => entry.ok === false);
    if (failedEntry) return failedEntry;

    for (const pattern of approvedPolicy.primaryPatterns) {
      let patternTotal = 0;
      for (const entry of entries) {
        if (entry.movementPattern === pattern) {
          patternTotal += entry.effectiveWorkingSets;
        }
      }
      if (patternTotal === 0) {
        const target = entries.find((e) => e.movementPattern === pattern && e.baseWorkingSets >= 1);
        if (!target) {
          return { ok: false, code: "recovery_pattern_uncovered" };
        }
        target.effectiveWorkingSets = approvedPolicy.ruleB.coverageRescue.minimumWorkingSets;
        target.reason = approvedPolicy.ruleB.coverageRescue.reason;
      }
    }

    let baseTotal = 0;
    let effectiveTotal = 0;
    for (const entry of entries) {
      baseTotal += entry.baseWorkingSets;
      effectiveTotal += entry.effectiveWorkingSets;
    }
    const ratio = baseTotal > 0 ? effectiveTotal / baseTotal : 0;
    const inBand = ratio >= approvedPolicy.acceptanceBand.minimum && ratio <= approvedPolicy.acceptanceBand.maximum;
    if (!inBand) {
      const bpId = predecessorInstance.blueprintId || predecessorInstance.provenance?.blueprintId;
      // The fixed allowlist is indexed only after proving the blueprint ID is an
      // own approved key; a prototype-carried entry never authorizes an
      // out-of-band version.
      const misses = approvedPolicy.allowlistedMisses;
      const allowlisted = (isOwnRecord(misses) && typeof bpId === "string" &&
        !DANGEROUS_KEYS.has(bpId) && own(misses, bpId)) ? misses[bpId] : null;
      if (!isOwnRecord(allowlisted) || allowlisted.base !== baseTotal || allowlisted.effective !== effectiveTotal) {
        return {
          ok: false,
          status: "ineligible",
          ineligible: true,
          code: "recovery_volume_out_of_band",
        };
      }
    }

    return {
      ok: true,
      entries,
      baseTotal,
      effectiveTotal,
      ratio,
    };
  }

  async function proposeRecoveryWeek(input) {
    const invalid = (code) =>
      Object.freeze({
        ok: false,
        status: "unavailable",
        unavailable: true,
        code,
      });

    if (!isObject(input)) return invalid("invalid_proposal");

    const approvedPolicy = input.approvedPolicy;
    if (!isApprovedRecoveryPolicy(approvedPolicy)) {
      return Object.freeze({
        ok: false,
        status: "ineligible",
        ineligible: true,
        code: "policy_invalid",
      });
    }

    const predecessorInstance = input.predecessorInstance ||
      (input.predecessor?.kind === "compiled" ? input.predecessor : input.predecessor?.instance);
    if (!isObject(predecessorInstance)) {
      return invalid("missing_predecessor");
    }
    const predCheck = validateCompilerInstance(predecessorInstance);
    if (!predCheck.ok) {
      return invalid(predCheck.code === "customized_compiler_snapshot" ? "customized_compiler_snapshot" : predCheck.code);
    }

    const predecessor = isObject(input.predecessor) && input.predecessor.kind !== "compiled"
      ? input.predecessor
      : {
          programId: input.predecessorProgramId || input.programId,
          durableRevision: input.durableRevision,
          source: input.source,
        };

    if (typeof predecessor.blockId !== "string" || !predecessor.blockId.trim()) {
      return invalid("legacy_block_ineligible");
    }
    if (predecessor.blockId.length > 240 || predecessor.blockId === predecessor.programId) {
      return invalid("invalid_block_identity");
    }

    const evidence = input.evidence;
    if (!isObject(evidence) || evidence.sourceBlockId !== predecessor.blockId) {
      return invalid("source_block_mismatch");
    }

    if (typeof predecessor.programId !== "string" || !predecessor.programId.trim() ||
        !Number.isInteger(predecessor.durableRevision) || predecessor.durableRevision < 0 ||
        typeof predecessor.source !== "string" || !RECONSTRUCTABLE_SOURCES.has(predecessor.source)) {
      return invalid("unsupported_source");
    }

    const transitionId = input.transitionId;
    const blockId = input.blockId;
    const createdAt = input.createdAt;
    if (typeof transitionId !== "string" || !transitionId.trim() ||
        typeof blockId !== "string" || !blockId.trim() || blockId.length > 240 ||
        blockId === predecessor.blockId ||
        !isCanonicalInstant(createdAt)) {
      return invalid(blockId === predecessor.blockId ? "recovery_target_equals_source" : "invalid_proposal");
    }

    {
      const repeat = sameBlockRepeatScan(input.existingRecoveryRecords, blockId);
      if (!repeat.ok) {
        if (repeat.reason === "recovery_same_block_repeat") {
          return Object.freeze({
            ok: false,
            status: "ineligible",
            ineligible: true,
            code: "recovery_same_block_repeat",
          });
        }
        return invalid("invalid_proposal");
      }
    }

    // Creation requires the caller to pin the compiler context explicitly and
    // exactly; an inferred or coerced version table never mints a proposal.
    const supportedVersions = input.supportedVersions;
    if (!exactVersionMatches(predecessorInstance.provenance, supportedVersions)) {
      return invalid("unsupported_compiler_version");
    }

    const eligibilityResult = evaluateRecoveryEligibility(evidence, approvedPolicy);
    if (!eligibilityResult.ok) {
      return eligibilityResult;
    }

    const derivation = deriveRecoveryWeek(predecessorInstance, approvedPolicy);
    if (!derivation.ok) {
      return Object.freeze({
        ok: false,
        status: "ineligible",
        ineligible: true,
        code: derivation.code,
      });
    }

    const predecessorFingerprint = await fingerprintCompilerInstance(predecessorInstance);
    const slotMapping = buildSlotMapping(predecessorInstance, predecessorInstance);
    const progression = relationContract(predecessorInstance, predecessorInstance, slotMapping);
    if (!progression.ok) {
      return invalid(progression.code);
    }

    const overlay = {
      schemaVersion: 1,
      policyVersion: approvedPolicy.policyVersion,
      transitionId,
      blockId,
      activePeriod: "nextBlockWeek1",
      eligibilityEvidence: clone(eligibilityResult.eligibilityEvidence),
      baseProgramFingerprint: predecessorFingerprint,
      entries: clone(derivation.entries),
      createdAt,
      reassessmentOutcome: null,
    };

    const diff = {
      days: [],
      exercises: [],
      prescriptions: [],
      recoveryWeek: overlay,
    };

    const proposal = {
      schemaVersion: SCHEMA_VERSION,
      transitionId,
      kind: "recovery_week",
      createdAt,
      status: "preview",
      predecessor: {
        programId: predecessor.programId,
        fingerprint: predecessorFingerprint,
        durableRevision: predecessor.durableRevision,
        source: predecessor.source,
        blockId: predecessor.blockId,
        compilerProvenance: clone(predecessorInstance.provenance),
      },
      diagnosis: {
        kind: "recovery_week",
        answers: { checkpointAnswer: "Yes" },
        eligibleEvidenceIds: clone(eligibilityResult.eligibilityEvidence.qualifyingPatterns),
        insufficientEvidenceReasons: [],
      },
      derivation: {
        mode: "overlay",
        request: "recovery-week",
        compilerContextVersions: clone(predecessorInstance.provenance),
        policyVersions: {
          recoveryWeek: approvedPolicy.policyVersion,
        },
        slotMapping,
      },
      diff,
      progressionContract: progression.value,
    };

    proposal.proposalHash = await hashProposal(proposal);
    acceptRecoveryCapability(proposal);

    return deepFreeze({
      ok: true,
      status: "preview",
      proposal,
      overlay,
    });
  }

  async function validateRecoveryProposal(proposal, current) {
    if (!isObject(proposal)) {
      return { ok: false, status: "invalid", code: "invalid_proposal" };
    }
    if (proposal.kind !== "recovery_week") {
      return { ok: false, status: "invalid", code: "unsupported_transition_kind" };
    }
    if (proposal.status !== "preview") {
      return { ok: false, status: "invalid", code: "invalid_proposal_status" };
    }
    // Every recovery-preview record consumed here must be an own-data JSON tree:
    // no required field, ordered enum, or nested record may resolve through a
    // prototype, and no array may be sparse or prototype-backed.
    if (!isOwnJsonTree(proposal)) {
      return { ok: false, status: "invalid", code: "invalid_proposal" };
    }
    if (proposal.schemaVersion !== SCHEMA_VERSION ||
        typeof proposal.transitionId !== "string" || !proposal.transitionId.trim() ||
        !isCanonicalInstant(proposal.createdAt)) {
      return { ok: false, status: "invalid", code: "invalid_proposal" };
    }
    if (proposal.successor !== undefined) {
      return { ok: false, status: "invalid", code: "forbidden_successor" };
    }
    if (proposal.confirmedAt !== undefined || proposal.archiveId !== undefined) {
      return { ok: false, status: "invalid", code: "forbidden_lifecycle_field" };
    }
    // The preview proposal and its predecessor are key-closed to exactly their
    // documented fields. An undocumented key (a freshly rehashed `note`, or a
    // `predecessor.confirmedAt` / `predecessor.archiveId` lifecycle field that
    // only exists after commit) fails here, before the terminal proposal-hash
    // comparison; a missing documented section still routes to its specific
    // downstream code.
    const PROPOSAL_KEYS = [
      "schemaVersion",
      "transitionId",
      "kind",
      "createdAt",
      "status",
      "predecessor",
      "diagnosis",
      "derivation",
      "diff",
      "progressionContract",
      "proposalHash",
    ];
    if (Object.keys(proposal).some((key) => !PROPOSAL_KEYS.includes(key))) {
      return { ok: false, status: "invalid", code: "invalid_proposal" };
    }
    const PREDECESSOR_KEYS = ["programId", "fingerprint", "durableRevision", "source", "blockId", "compilerProvenance"];
    if (!isOwnRecord(proposal.predecessor) ||
        Object.keys(proposal.predecessor).some((key) => !PREDECESSOR_KEYS.includes(key))) {
      return { ok: false, status: "invalid", code: "invalid_proposal" };
    }
    if (!isObject(proposal.diff) || !isObject(proposal.diff.recoveryWeek)) {
      return { ok: false, status: "invalid", code: "missing_recovery_overlay" };
    }
    if (!exactKeys(proposal.diff, ["days", "exercises", "prescriptions", "recoveryWeek"])) {
      return { ok: false, status: "invalid", code: "invalid_recovery_diff" };
    }
    if (!Array.isArray(proposal.diff.days) || proposal.diff.days.length !== 0 ||
        !Array.isArray(proposal.diff.exercises) || proposal.diff.exercises.length !== 0 ||
        !Array.isArray(proposal.diff.prescriptions) || proposal.diff.prescriptions.length !== 0) {
      return { ok: false, status: "invalid", code: "invalid_recovery_diff" };
    }

    const overlay = proposal.diff.recoveryWeek;
    if (overlay.confirmedAt !== undefined || overlay.reassessmentDueAt !== undefined) {
      return { ok: false, status: "invalid", code: "forbidden_lifecycle_field" };
    }

    {
      const repeat = sameBlockRepeatScan(current?.existingRecoveryRecords, overlay.blockId);
      if (!repeat.ok) {
        if (repeat.reason === "recovery_same_block_repeat") {
          return Object.freeze({
            ok: false,
            status: "ineligible",
            ineligible: true,
            code: "recovery_same_block_repeat",
          });
        }
        return { ok: false, status: "invalid", code: "invalid_options" };
      }
    }
    if (overlay.policyVersion !== RECOVERY_POLICY_VERSION) {
      return { ok: false, status: "invalid", code: "unsupported_policy_version" };
    }
    if (overlay.schemaVersion !== 1 ||
        !exactKeys(overlay, [
          "schemaVersion",
          "policyVersion",
          "transitionId",
          "blockId",
          "activePeriod",
          "eligibilityEvidence",
          "baseProgramFingerprint",
          "entries",
          "createdAt",
          "reassessmentOutcome",
        ]) ||
        overlay.activePeriod !== "nextBlockWeek1" ||
        overlay.transitionId !== proposal.transitionId ||
        typeof overlay.blockId !== "string" || !overlay.blockId.trim() || overlay.blockId.length > 240 ||
        !isCanonicalInstant(overlay.createdAt) ||
        overlay.createdAt !== proposal.createdAt ||
        overlay.reassessmentOutcome !== null) {
      return { ok: false, status: "invalid", code: "invalid_recovery_overlay" };
    }

    if (!isObject(current?.predecessor) || !isObject(current.predecessorInstance)) {
      return { ok: false, status: "invalid", code: "missing_validation_snapshot" };
    }

    for (const field of ["programId", "durableRevision", "source", "blockId"]) {
      if (proposal.predecessor?.[field] !== current.predecessor[field]) {
        return { ok: false, status: "stale", code: "predecessor_changed" };
      }
    }
    if (typeof proposal.predecessor.blockId !== "string" || !proposal.predecessor.blockId.trim() ||
        proposal.predecessor.blockId === proposal.predecessor.programId) {
      return { ok: false, status: "invalid", code: "legacy_block_ineligible" };
    }
    if (proposal.diff.recoveryWeek.blockId === proposal.predecessor.blockId) {
      return { ok: false, status: "invalid", code: "recovery_target_equals_source" };
    }
    const liveFingerprint = await fingerprintCompilerInstance(current.predecessorInstance);
    if (proposal.predecessor?.fingerprint !== liveFingerprint) {
      return { ok: false, status: "stale", code: "predecessor_changed" };
    }

    const predecessorCheck = validateCompilerInstance(current.predecessorInstance);
    if (!predecessorCheck.ok) {
      return { ok: false, status: "invalid", code: predecessorCheck.code };
    }
    if (typeof proposal.predecessor.programId !== "string" || !proposal.predecessor.programId.trim() ||
        !Number.isInteger(proposal.predecessor.durableRevision) || proposal.predecessor.durableRevision < 0 ||
        typeof proposal.predecessor.source !== "string" || !RECONSTRUCTABLE_SOURCES.has(proposal.predecessor.source)) {
      return { ok: false, status: "invalid", code: "unsupported_source" };
    }
    if (!sameCanonical(proposal.predecessor?.compilerProvenance, current.predecessorInstance.provenance)) {
      return { ok: false, status: "invalid", code: "predecessor_provenance_mismatch" };
    }

    if (!exactVersionMatches(current.predecessorInstance.provenance, current.supportedVersions)) {
      return { ok: false, status: "invalid", code: "unsupported_compiler_version" };
    }

    if (overlay.baseProgramFingerprint !== liveFingerprint) {
      return { ok: false, status: "invalid", code: "base_fingerprint_mismatch" };
    }

    const approvedPolicy = current.approvedPolicy;
    if (!isApprovedRecoveryPolicy(approvedPolicy)) {
      return { ok: false, status: "invalid", code: "policy_invalid" };
    }

    const eligibility = evaluateRecoveryEligibility(overlay.eligibilityEvidence, approvedPolicy);
    if (!eligibility.ok) {
      return { ok: false, status: "invalid", code: "ineligible_recovery_evidence" };
    }
    if (!sameCanonical(overlay.eligibilityEvidence, eligibility.eligibilityEvidence)) {
      return { ok: false, status: "invalid", code: "recovery_evidence_mismatch" };
    }
    if (overlay.eligibilityEvidence.sourceBlockId !== proposal.predecessor.blockId) {
      return { ok: false, status: "invalid", code: "source_block_mismatch" };
    }

    const expectedDiagnosis = {
      kind: "recovery_week",
      answers: {
        checkpointAnswer: eligibility.eligibilityEvidence.checkpointAnswer,
      },
      eligibleEvidenceIds: eligibility.eligibilityEvidence.qualifyingPatterns,
      insufficientEvidenceReasons: [],
    };
    if (!sameCanonical(proposal.diagnosis, expectedDiagnosis)) {
      return { ok: false, status: "invalid", code: "recovery_diagnosis_mismatch" };
    }

    if (!isObject(proposal.derivation) ||
        !exactKeys(proposal.derivation, ["mode", "request", "compilerContextVersions", "policyVersions", "slotMapping"]) ||
        proposal.derivation.mode !== "overlay" ||
        proposal.derivation.request !== "recovery-week" ||
        !exactKeys(proposal.derivation.policyVersions, ["recoveryWeek"]) ||
        proposal.derivation.policyVersions.recoveryWeek !== RECOVERY_POLICY_VERSION ||
        !sameCanonical(proposal.derivation.compilerContextVersions, current.predecessorInstance.provenance)) {
      return { ok: false, status: "invalid", code: "recovery_derivation_mismatch" };
    }

    const expectedSlotMapping = buildSlotMapping(current.predecessorInstance, current.predecessorInstance);
    if (!sameCanonical(proposal.derivation.slotMapping, expectedSlotMapping)) {
      return { ok: false, status: "invalid", code: "invalid_slot_mapping" };
    }

    const expectedProgression = relationContract(current.predecessorInstance, current.predecessorInstance, expectedSlotMapping);
    if (!sameCanonical(proposal.progressionContract, expectedProgression.value)) {
      return { ok: false, status: "invalid", code: "progression_contract_mismatch" };
    }

    const expected = deriveRecoveryWeek(current.predecessorInstance, approvedPolicy);
    if (!expected.ok) {
      return { ok: false, status: "invalid", code: expected.code };
    }

    if (!Array.isArray(overlay.entries)) {
      return { ok: false, status: "invalid", code: "invalid_recovery_entries" };
    }
    if (overlay.entries.length < expected.entries.length) {
      return { ok: false, status: "invalid", code: "missing_recovery_slot" };
    }
    if (overlay.entries.length > expected.entries.length) {
      return { ok: false, status: "invalid", code: "extra_recovery_slot" };
    }

    const seenSlots = new Set();
    for (const entry of overlay.entries) {
      if (!isObject(entry) ||
          !exactKeys(entry, ["slot", "movement", "movementPattern", "baseWorkingSets", "effectiveWorkingSets", "removedOptionalFirst", "reason"])) {
        return { ok: false, status: "invalid", code: "invalid_recovery_entries" };
      }
      if (seenSlots.has(entry.slot)) {
        return { ok: false, status: "invalid", code: "duplicate_recovery_slot" };
      }
      seenSlots.add(entry.slot);
    }

    const expectedSlotIds = expected.entries.map((e) => e.slot);
    for (let i = 0; i < expected.entries.length; i++) {
      const actual = overlay.entries[i];
      const exp = expected.entries[i];
      if (actual.slot !== exp.slot) {
        if (expectedSlotIds.includes(actual.slot)) {
          return { ok: false, status: "invalid", code: "recovery_slot_order" };
        }
        return { ok: false, status: "invalid", code: "recovery_slot_mismatch" };
      }
      if (actual.movement !== exp.movement) {
        return { ok: false, status: "invalid", code: "recovery_movement_mismatch" };
      }
      if (actual.movementPattern !== exp.movementPattern) {
        return { ok: false, status: "invalid", code: "recovery_pattern_mismatch" };
      }
      if (actual.baseWorkingSets !== exp.baseWorkingSets) {
        return { ok: false, status: "invalid", code: "recovery_base_sets_mismatch" };
      }
      if (actual.effectiveWorkingSets !== exp.effectiveWorkingSets) {
        return { ok: false, status: "invalid", code: "recovery_effective_sets_mismatch" };
      }
      if (actual.removedOptionalFirst !== exp.removedOptionalFirst) {
        return { ok: false, status: "invalid", code: "recovery_optional_flag_mismatch" };
      }
      if (actual.reason !== exp.reason) {
        return { ok: false, status: "invalid", code: "recovery_reason_mismatch" };
      }
    }

    const expectedHash = await hashProposal(proposal);
    if (proposal.proposalHash !== expectedHash) {
      return { ok: false, status: "invalid", code: "proposal_hash_mismatch" };
    }

    // Success returns the accepted proposal as a deep-frozen clone: reload and
    // lock-held consumers seal from this value, never from a mutable caller
    // object.
    return { ok: true, status: "preview", proposal: acceptRecoveryCapability(clone(proposal)) };
  }



  async function validateRecoveryRecord(record, current) {
    if (!isObject(record)) {
      return { ok: false, status: "invalid", code: "invalid_record" };
    }
    if (!isOwnJsonTree(record)) {
      return { ok: false, status: "invalid", code: "invalid_record" };
    }

    if (record.kind !== "recovery_week") {
      return { ok: false, status: "invalid", code: "unsupported_transition_kind" };
    }
    if (record.status !== "committed") {
      return { ok: false, status: "invalid", code: "invalid_record_status" };
    }
    if (record.archiveId !== null) {
      return { ok: false, status: "invalid", code: "invalid_archive_id" };
    }
    if (record.successor !== undefined) {
      return { ok: false, status: "invalid", code: "forbidden_successor" };
    }
    if (record.schemaVersion !== SCHEMA_VERSION ||
        typeof record.transitionId !== "string" || !record.transitionId.trim() ||
        !isCanonicalInstant(record.createdAt)) {
      return { ok: false, status: "invalid", code: "invalid_record" };
    }
    if (!isCanonicalInstant(record.confirmedAt)) {
      return { ok: false, status: "invalid", code: "invalid_lifecycle_timestamp" };
    }
    if (Date.parse(record.confirmedAt) < Date.parse(record.createdAt)) {
      return { ok: false, status: "invalid", code: "lifecycle_timestamp_order" };
    }

    const COMMITTED_RECORD_KEYS = [
      "schemaVersion",
      "transitionId",
      "kind",
      "createdAt",
      "status",
      "predecessor",
      "diagnosis",
      "derivation",
      "diff",
      "progressionContract",
      "archiveId",
      "confirmedAt",
      "proposalHash",
    ];
    if (Object.keys(record).some((key) => !COMMITTED_RECORD_KEYS.includes(key))) {
      return { ok: false, status: "invalid", code: "invalid_record" };
    }

    if (!isObject(record.diff) || !isObject(record.diff.recoveryWeek)) {
      return { ok: false, status: "invalid", code: "missing_recovery_overlay" };
    }
    if (!exactKeys(record.diff, ["days", "exercises", "prescriptions", "recoveryWeek"])) {
      return { ok: false, status: "invalid", code: "invalid_recovery_diff" };
    }

    const overlay = record.diff.recoveryWeek;
    if (overlay.policyVersion !== RECOVERY_POLICY_VERSION) {
      return { ok: false, status: "invalid", code: "unsupported_policy_version" };
    }
    const COMMITTED_OVERLAY_KEYS = [
      "schemaVersion",
      "policyVersion",
      "transitionId",
      "blockId",
      "activePeriod",
      "eligibilityEvidence",
      "baseProgramFingerprint",
      "entries",
      "createdAt",
      "confirmedAt",
      "reassessmentDueAt",
      "reassessmentOutcome",
    ];
    if (overlay.schemaVersion !== 1 ||
        !exactKeys(overlay, COMMITTED_OVERLAY_KEYS) ||
        overlay.activePeriod !== "nextBlockWeek1" ||
        overlay.transitionId !== record.transitionId ||
        typeof overlay.blockId !== "string" || !overlay.blockId.trim() ||
        overlay.createdAt !== record.createdAt) {
      return { ok: false, status: "invalid", code: "invalid_recovery_overlay" };
    }

    if (overlay.confirmedAt !== record.confirmedAt) {
      return { ok: false, status: "invalid", code: "lifecycle_timestamp_mismatch" };
    }
    if (!isCanonicalInstant(overlay.reassessmentDueAt)) {
      return { ok: false, status: "invalid", code: "invalid_lifecycle_timestamp" };
    }
    if (Date.parse(overlay.reassessmentDueAt) <= Date.parse(overlay.confirmedAt)) {
      return { ok: false, status: "invalid", code: "lifecycle_timestamp_order" };
    }

    const VALID_OUTCOMES = [null, "Better", "About the same", "Worse"];
    if (!VALID_OUTCOMES.includes(overlay.reassessmentOutcome)) {
      return { ok: false, status: "invalid", code: "recovery_reassessment_invalid" };
    }

    {
      // This record's own stored copy is exempt only on the exact
      // `{transitionId, proposalHash}` identity pair so a reload / lock-held
      // re-read validates idempotently; the same id with a different hash is a
      // structural collision, and a different committed transition in the
      // same target block still refuses.
      const repeat = sameBlockRepeatScan(
        current?.existingRecoveryRecords,
        overlay.blockId,
        { transitionId: record.transitionId, proposalHash: record.proposalHash },
      );
      if (!repeat.ok) {
        if (repeat.reason === "recovery_same_block_repeat") {
          return Object.freeze({
            ok: false,
            status: "ineligible",
            ineligible: true,
            code: "recovery_same_block_repeat",
          });
        }
        return { ok: false, status: "invalid", code: "invalid_options" };
      }
    }

    const preview = clone(record);
    preview.status = "preview";
    delete preview.confirmedAt;
    delete preview.archiveId;
    delete preview.diff.recoveryWeek.confirmedAt;
    delete preview.diff.recoveryWeek.reassessmentDueAt;
    preview.diff.recoveryWeek.reassessmentOutcome = null;

    // The reconstructed preview owns the semantic/hash/stale boundary. The
    // same-block repeat rule was already resolved above with this record's
    // own-id exemption, so the delegated call must not re-run it against this
    // record's own stored copy.
    let innerCurrent = current;
    if (isObject(current)) {
      innerCurrent = { ...current };
      delete innerCurrent.existingRecoveryRecords;
    }

    const proposalVal = await validateRecoveryProposal(preview, innerCurrent);
    if (!proposalVal.ok) {
      return proposalVal;
    }

    // Success returns the accepted committed record as a deep-frozen clone;
    // reload consumers project from this value only.
    return Object.freeze({ ok: true, status: "committed", record: acceptRecoveryCapability(clone(record)) });
  }

  // One signature only: (record, outcome, context). `record` is a validated
  // committed-record capability; `outcome` is one of the three closed strings;
  // `context` is an exact own-data `{ blockId, elapsedWeek }`. There is no
  // options-object form and no opt-in guard: a missing/wrong block is
  // `recovery_reassessment_invalid`, a missing/non-integer/week-one
  // `elapsedWeek` is `recovery_reassessment_not_due`, a second write is
  // `recovery_reassessment_closed`. Success changes only `reassessmentOutcome`,
  // preserves `proposalHash`, and returns a new validated deep-frozen record;
  // week two stays canonical.
  function reassessRecoveryRecord(record, outcome, context) {
    const bad = (code) => Object.freeze({ ok: false, status: "invalid", code });
    const VALID_OUTCOMES = ["Better", "About the same", "Worse"];

    if (!isRecoveryCapability(record) ||
        record.kind !== "recovery_week" || record.status !== "committed" ||
        !isObject(record.diff) || !isObject(record.diff.recoveryWeek)) {
      return bad("recovery_reassessment_invalid");
    }
    const overlay = record.diff.recoveryWeek;

    if (typeof outcome !== "string" || !VALID_OUTCOMES.includes(outcome)) {
      return bad("recovery_reassessment_invalid");
    }
    if (overlay.reassessmentOutcome !== null) {
      return bad("recovery_reassessment_closed");
    }

    if (!isOwnRecord(context)) return bad("recovery_reassessment_invalid");
    if (Object.keys(context).some((key) => key !== "blockId" && key !== "elapsedWeek")) {
      return bad("recovery_reassessment_invalid");
    }
    if (typeof context.blockId !== "string" || context.blockId !== overlay.blockId) {
      return bad("recovery_reassessment_invalid");
    }
    if (!Number.isInteger(context.elapsedWeek) || context.elapsedWeek < 2) {
      return bad("recovery_reassessment_not_due");
    }

    const updated = clone(record);
    updated.diff.recoveryWeek.reassessmentOutcome = outcome;
    acceptRecoveryCapability(updated);

    return Object.freeze({ ok: true, status: "committed", record: updated });
  }

  // Synchronous, one return shape only: a plain, deeply frozen
  // `{ ok, status, active, code, rows }`, where `rows` is an ordinary
  // enumerable deeply frozen JSON array with no metadata properties, cycle,
  // alias, or self-reference. `validatedRecord` must be a validated
  // recovery-lifecycle capability (or null); a raw, cloned, tampered, or
  // hand-built record fails closed to a canonical-rows clone. Context is exact
  // and mandatory. Rule B applies only when the record's target block matches,
  // it is not yet reassessed, and `elapsedWeek === 1`; every other case
  // returns a canonical-rows clone.
  function projectRecoveryProgram(canonicalProgramRows, validatedRecord, context) {
    const canonicalRows = Array.isArray(canonicalProgramRows) ? canonicalProgramRows : null;
    const canonicalClone = () => deepFreeze(clone(canonicalRows || []));
    const result = (ok, status, active, code, rows) =>
      deepFreeze({ ok, status, active, code: code || null, rows });
    const closed = (ok, status, code) => result(ok, status, false, code, canonicalClone());

    if (!canonicalRows) return result(false, "invalid", false, "invalid_program_rows", deepFreeze([]));

    // Context is exact and mandatory.
    if (!isOwnRecord(context) ||
        !exactKeys(context, ["blockId", "elapsedWeek", "baseProgramFingerprint"]) ||
        typeof context.blockId !== "string" || !context.blockId.trim() ||
        typeof context.baseProgramFingerprint !== "string" || !context.baseProgramFingerprint.trim() ||
        !Number.isInteger(context.elapsedWeek) || context.elapsedWeek < 1) {
      return closed(false, "invalid", "invalid_context");
    }

    if (validatedRecord === null || validatedRecord === undefined) {
      return closed(true, "inactive", null);
    }
    // Only a validator/seal/reassess capability may reduce volume.
    if (!isRecoveryCapability(validatedRecord) ||
        validatedRecord.kind !== "recovery_week" ||
        validatedRecord.status !== "committed" ||
        validatedRecord.archiveId !== null ||
        validatedRecord.successor !== undefined ||
        !isObject(validatedRecord.diff) ||
        !isObject(validatedRecord.diff.recoveryWeek)) {
      return closed(false, "invalid", "recovery_record_invalid");
    }

    const overlay = validatedRecord.diff.recoveryWeek;
    if (overlay.schemaVersion !== 1 ||
        overlay.policyVersion !== RECOVERY_POLICY_VERSION ||
        overlay.activePeriod !== "nextBlockWeek1" ||
        !Array.isArray(overlay.entries) || overlay.entries.length === 0) {
      return closed(false, "invalid", "recovery_record_invalid");
    }

    if (overlay.baseProgramFingerprint !== context.baseProgramFingerprint) {
      return closed(false, "invalid", "base_fingerprint_mismatch");
    }
    if (overlay.blockId !== context.blockId) return closed(true, "inactive", null);
    if (overlay.reassessmentOutcome !== null) return closed(true, "inactive", null);
    if (context.elapsedWeek >= 2) return closed(true, "inactive", null);

    // elapsedWeek === 1, matching block, not yet reassessed: apply Rule B.
    const canonicalBySlot = new Map();
    for (const row of canonicalRows) {
      if (!isObject(row)) return closed(false, "invalid", "invalid_program_rows");
      const slotId = typeof row.slotId === "string" && row.slotId
        ? row.slotId
        : (typeof row.id === "string" && row.id ? row.id : null);
      if (!slotId || canonicalBySlot.has(slotId)) return closed(false, "invalid", "invalid_program_rows");
      canonicalBySlot.set(slotId, row);
    }

    const entryBySlot = new Map();
    for (const entry of overlay.entries) {
      if (!isObject(entry) ||
          typeof entry.slot !== "string" || !entry.slot ||
          entryBySlot.has(entry.slot) ||
          typeof entry.movement !== "string" || !entry.movement ||
          !Number.isInteger(entry.baseWorkingSets) || entry.baseWorkingSets < 1 ||
          !Number.isInteger(entry.effectiveWorkingSets) || entry.effectiveWorkingSets < 0 ||
          entry.effectiveWorkingSets > entry.baseWorkingSets) {
        return closed(false, "invalid", "invalid_recovery_entries");
      }
      entryBySlot.set(entry.slot, entry);
    }

    // Exact one-to-one slot coverage of the canonical rows, with matching base
    // sets and movement identity; no unmatched slot on either side.
    if (entryBySlot.size !== canonicalBySlot.size) {
      return closed(false, "invalid", "recovery_slot_coverage");
    }
    for (const [slot, entry] of entryBySlot) {
      const row = canonicalBySlot.get(slot);
      if (!row) return closed(false, "invalid", "recovery_slot_coverage");
      if ((typeof row.movementId === "string" ? row.movementId : null) !== entry.movement) {
        return closed(false, "invalid", "recovery_movement_mismatch");
      }
      if (!Number.isInteger(row.sets) || row.sets !== entry.baseWorkingSets) {
        return closed(false, "invalid", "recovery_base_sets_mismatch");
      }
    }

    const projected = [];
    for (const row of canonicalRows) {
      const slotId = typeof row.slotId === "string" && row.slotId ? row.slotId : row.id;
      const entry = entryBySlot.get(slotId);
      if (!entry) { projected.push(clone(row)); continue; }
      if (entry.effectiveWorkingSets === 0) continue;            // zero sets -> remove the slot
      projected.push({ ...clone(row), sets: entry.effectiveWorkingSets }); // positive -> change only `sets`
    }

    return result(true, "active", true, null, deepFreeze(projected));
  }

  const api = Object.freeze({
    SCHEMA_VERSION,
    SLOT_MAPPING_SCHEMA_VERSION,
    VOLUME_REDUCTION_POLICY_VERSION,
    RECOVERY_POLICY_VERSION,
    canonicalProposalJson,
    hashProposal,
    fingerprintCompilerInstance,
    fingerprintCompilerContext,
    buildSlotMapping,
    buildExactDiff,
    createSiblingProposal,
    proposeSibling,
    proposeVolumeReduction,
    createVolumeReductionProposal: proposeVolumeReduction,
    validateProposal,
    validateRecoveryProposal,
    validateRecoveryRecord,
    commitRecord,
    reassessRecoveryRecord,
    projectRecoveryProgram,
    approvedRecoveryPolicy,
    createGuidedManualRepair,
    createGuidedManualRepairCandidate: createGuidedManualRepair,
    evaluateRecoveryEligibility,
    proposeRecoveryWeek,
    createRecoveryWeekProposal: proposeRecoveryWeek,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeProgramTransition = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
