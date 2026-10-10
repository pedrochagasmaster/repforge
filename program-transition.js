(function attachProgramTransition(root) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const KIND = "program_definition_replacement";
  const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
  const OBJECT_PROTO = Object.prototype;
  const ARRAY_PROTO = Array.prototype;
  const replacementCapabilities = new WeakSet();
  const committedCapabilities = new WeakSet();

  function plainRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === OBJECT_PROTO || proto === null;
  }

  function copyJson(value, path = "$", seen = new Set()) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new TypeError(`${path}: non-finite number`);
      return value;
    }
    if (typeof value !== "object" || seen.has(value)) throw new TypeError(`${path}: unsupported JSON value`);
    seen.add(value);
    let result;
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== ARRAY_PROTO || Object.getOwnPropertySymbols(value).length) {
        throw new TypeError(`${path}: unsupported array`);
      }
      const names = Object.getOwnPropertyNames(value);
      if (names.length !== value.length + 1 || !names.includes("length")) throw new TypeError(`${path}: sparse or extended array`);
      result = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
          throw new TypeError(`${path}[${index}]: expected own data`);
        }
        result.push(copyJson(descriptor.value, `${path}[${index}]`, seen));
      }
    } else {
      if (!plainRecord(value) || Object.getOwnPropertySymbols(value).length) throw new TypeError(`${path}: unsupported object`);
      result = {};
      for (const key of Object.getOwnPropertyNames(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (DANGEROUS_KEYS.has(key) || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
          throw new TypeError(`${path}.${key}: unsupported property`);
        }
        result[key] = copyJson(descriptor.value, `${path}.${key}`, seen);
      }
    }
    seen.delete(value);
    return result;
  }

  function canonicalJson(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }

  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  }

  function ownKeysAre(value, expected) {
    return plainRecord(value) && Object.keys(value).length === expected.length &&
      expected.every((key) => Object.hasOwn(value, key));
  }

  function validIdentity(value) {
    return typeof value === "string" && value.length > 0 && value.length <= 256 &&
      value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
  }

  function isCanonicalInstant(value) {
    if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) return false;
    const milliseconds = Date.parse(value);
    return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
  }

  function compilerApi() {
    if (root.RepForgeProgramCompiler) return root.RepForgeProgramCompiler;
    if (typeof require === "function") return require("./program-compiler.js");
    return null;
  }

  function exerciseMetricsApi() {
    if (root.RepForgeExerciseMetrics) return root.RepForgeExerciseMetrics;
    if (typeof require === "function") return require("./exercise-metrics.js");
    return null;
  }

  function catalogFrom(value) {
    if (value !== undefined) return value;
    try {
      return root.RepForgeExerciseCatalog?.snapshot?.() || null;
    } catch {
      return null;
    }
  }

  function validateCustomDefinitions(definitions, catalog) {
    if (!Array.isArray(definitions)) return { ok: false, code: "custom_definitions_invalid" };
    const compiler = compilerApi();
    if (!compiler || typeof compiler.validateProgramDefinition !== "function") {
      return { ok: false, code: "program_compiler_unavailable" };
    }
    // Compiler validation is the sole authority for the custom definition schema.
    // This preflight rejects malformed arrays before handing them to that boundary.
    const metricDomain = exerciseMetricsApi();
    if (!metricDomain) return { ok: false, code: "exercise_metrics_unavailable" };
    for (const [index, definition] of definitions.entries()) {
      if (!plainRecord(definition)) return { ok: false, code: `custom_definition_${index}_invalid` };
      try { copyJson(definition, `customExerciseDefinitions[${index}]`); }
      catch { return { ok: false, code: `custom_definition_${index}_invalid` }; }
    }
    return { ok: true };
  }

  function validateProgramDefinition(programDefinition, customDefinitions, catalog) {
    const compiler = compilerApi();
    if (!compiler || typeof compiler.validateProgramDefinition !== "function") {
      return { ok: false, code: "program_compiler_unavailable" };
    }
    if (!catalog || !Array.isArray(catalog.exercises) || !plainRecord(catalog.uuidIndex)) {
      return { ok: false, code: "catalog_unavailable" };
    }
    const customCheck = validateCustomDefinitions(customDefinitions, catalog);
    if (!customCheck.ok) return customCheck;
    let safeProgram;
    let safeDefinitions;
    try {
      safeProgram = copyJson(programDefinition, "programDefinition");
      safeDefinitions = copyJson(customDefinitions, "customExerciseDefinitions");
    } catch {
      return { ok: false, code: "program_definition_invalid" };
    }
    const checked = compiler.validateProgramDefinition(safeProgram, catalog, safeDefinitions);
    return checked.ok ? { ok: true, value: safeProgram } : { ok: false, code: "program_definition_invalid" };
  }

  async function sha256Hex(text) {
    const crypto = root.crypto;
    const Encoder = root.TextEncoder;
    if (!crypto?.subtle || typeof crypto.subtle.digest !== "function" || typeof Encoder !== "function") {
      throw Object.assign(new TypeError("SHA-256 is unavailable"), { code: "crypto_unavailable" });
    }
    const digest = await crypto.subtle.digest("SHA-256", new Encoder().encode(text));
    return Array.from(new root.Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function proposalPreimage(proposal) {
    const preimage = copyJson(proposal, "proposal");
    delete preimage.proposalHash;
    return preimage;
  }

  async function hashProposal(proposal) {
    return sha256Hex(canonicalJson(proposalPreimage(proposal)));
  }

  async function fingerprintProgramDefinition(programDefinition, customExerciseDefinitions = []) {
    const snapshot = copyJson({ programDefinition, customExerciseDefinitions }, "programSnapshot");
    return `program-definition-sha256:${await sha256Hex(canonicalJson(snapshot))}`;
  }

  function resultInvalid(code) {
    return { ok: false, status: "invalid", code };
  }

  function resultStale(code) {
    return { ok: false, status: "stale", code };
  }

  function canonicalInput(input, catalog) {
    if (!ownKeysAre(input, ["transitionId", "createdAt", "predecessor", "successor", "catalogSnapshot"]) ||
        !validIdentity(input.transitionId) || !isCanonicalInstant(input.createdAt) ||
        !plainRecord(input.predecessor) || !plainRecord(input.successor)) return { ok: false, code: "replacement_input_invalid" };
    const predecessorKeys = ["programId", "durableRevision", "programDefinition", "customExerciseDefinitions"];
    const successorKeys = ["programId", "programDefinition", "customExerciseDefinitions"];
    if (!ownKeysAre(input.predecessor, predecessorKeys) || !ownKeysAre(input.successor, successorKeys) ||
        !validIdentity(input.predecessor.programId) || !Number.isSafeInteger(input.predecessor.durableRevision) ||
        input.predecessor.durableRevision < 0 || !validIdentity(input.successor.programId) ||
        input.successor.programId === input.predecessor.programId) return { ok: false, code: "replacement_input_invalid" };
    const predecessor = validateProgramDefinition(input.predecessor.programDefinition,
      input.predecessor.customExerciseDefinitions, catalog);
    if (!predecessor.ok) return predecessor;
    const successor = validateProgramDefinition(input.successor.programDefinition,
      input.successor.customExerciseDefinitions, catalog);
    if (!successor.ok) return successor;
    return {
      ok: true,
      value: {
        transitionId: input.transitionId,
        createdAt: input.createdAt,
        predecessor: {
          programId: input.predecessor.programId,
          durableRevision: input.predecessor.durableRevision,
          programDefinition: predecessor.value,
          customExerciseDefinitions: input.predecessor.customExerciseDefinitions,
        },
        successor: {
          programId: input.successor.programId,
          programDefinition: successor.value,
          customExerciseDefinitions: input.successor.customExerciseDefinitions,
        },
      },
    };
  }

  // ---- Block-end Review changes -------------------------------------------
  // Each change derives a complete successor ProgramDefinition from the stored
  // one. Regeneration needs the generator request a Build program never had;
  // those programs go to guided editing instead.
  const CHANGE_KINDS = Object.freeze(["fewer_days", "shorter_sessions", "reduce_volume", "recovery_week"]);
  const PROTECTED_ROLE = /PrimaryCompound$|SecondaryCompound$/;

  function unavailable(code, extra = {}) {
    return { ok: false, status: "unavailable", code, ...extra };
  }

  function validChange(change) {
    if (!plainRecord(change) || !CHANGE_KINDS.includes(change.kind)) return false;
    if (change.kind === "fewer_days") return ownKeysAre(change, ["kind", "daysPerWeek"]) && Number.isSafeInteger(change.daysPerWeek);
    if (change.kind === "shorter_sessions") return ownKeysAre(change, ["kind", "sessionMinutes"]) && Number.isSafeInteger(change.sessionMinutes);
    return ownKeysAre(change, ["kind"]);
  }

  function regenerate(definition, overrides, catalog, compiler) {
    if (definition.provenance?.source === "manual" || !plainRecord(definition.request) || !definition.request.goal) {
      return unavailable("manual_program");
    }
    const current = new Set(definition.days.flatMap((day) => day.slots.map((slot) => slot.exerciseId)));
    const preferred = [...new Set([...(definition.request.preferredExerciseIds || []), ...current])].sort();
    const request = { ...copyJson(definition.request, "request"), ...overrides, preferredExerciseIds: preferred };
    delete request.seed;
    const generated = compiler.generateProgram(request, catalog, definition.seed);
    if (!generated.ok) return unavailable("generation_conflict", { conflicts: generated.conflicts || [] });
    return { ok: true, ...carryEdits(definition, generated.value, catalog, compiler) };
  }

  // ---- Carrying block edits across a regeneration -------------------------
  // An edit is wherever the stored definition differs from what its own
  // request and seed generate. Each one is reapplied, week by week and field
  // by field, to the successor slot holding the same movement, as long as no
  // week then runs longer than the ceiling allows or than the generator's own
  // successor already does. The report holds codes only.
  const CARRIED_FIELDS = Object.freeze(["targets", "rir", "restSeconds"]);

  function trainingSlots(definition) {
    return definition.days.filter((day) => day.kind === "training").flatMap((day) => day.slots);
  }

  function cycleOf(slot, cycleIndex) {
    return slot.prescriptionsByCycle.find((cycle) => cycle.cycleIndex === cycleIndex);
  }

  function generatorBaseline(definition, catalog, compiler) {
    const request = copyJson(definition.request, "request");
    delete request.seed;
    let generated;
    try { generated = compiler.generateProgram(request, catalog, definition.seed); } catch { return null; }
    if (!generated?.ok || generated.value.generatorVersion !== definition.generatorVersion) return null;
    return generated.value;
  }

  function slotEdits(slot, baselineSlot) {
    const edits = [];
    for (const cycle of slot.prescriptionsByCycle) {
      const freshSets = (baselineSlot && cycleOf(baselineSlot, cycle.cycleIndex)?.sets) || [];
      // A set beyond the generated count is authored whole and counts as "sets".
      const changed = cycle.sets.map((set, index) => index >= freshSets.length ? []
        : CARRIED_FIELDS.filter((field) => canonicalJson(set[field] ?? null) !== canonicalJson(freshSets[index][field] ?? null)));
      const fields = new Set(changed.flat());
      if (cycle.sets.length !== freshSets.length) fields.add("sets");
      if (fields.size) edits.push({ cycleIndex: cycle.cycleIndex, fields: [...fields].sort(), changed, generated: freshSets.length });
    }
    return edits;
  }

  function applyCycleEdit(slot, source, edit) {
    const cycle = cycleOf(slot, edit.cycleIndex);
    const sourceSets = cycleOf(source, edit.cycleIndex).sets;
    if (!cycle) return;
    const count = edit.fields.includes("sets") ? sourceSets.length : cycle.sets.length;
    const template = cycle.sets.at(-1) || sourceSets.at(-1);
    cycle.sets = Array.from({ length: count }, (_, index) => {
      // Ids stay deterministic: re-deriving at confirmation must reproduce them.
      const set = copyJson(cycle.sets[index] || { ...template, id: `set-${slot.id}-${edit.cycleIndex}-${index + 1}-carried`,
        cycleIndex: edit.cycleIndex, setIndex: index + 1 }, "set");
      const from = sourceSets[index];
      const fields = !from ? [] : index >= edit.generated ? CARRIED_FIELDS : edit.changed[index];
      if (!fields.length) return set;
      for (const field of fields) set[field] = copyJson(from[field] ?? null, field);
      set.status = from.status;
      set.provenance = copyJson(from.provenance, "provenance");
      return set;
    });
  }

  // Start each day from the generator's prescriptions, which fit, and add the
  // edits back compounds first and in slot order: an edit stays whole if the
  // day still fits, gives back extra sets if that is enough, or is dropped.
  function fitCarried(successor, generated, carried, compiler) {
    const ceiling = successor.request.timeCeilingMinutes * 60;
    const cycleIndexes = Array.from({ length: successor.cycles }, (_, index) => index + 1);
    for (const day of successor.days.filter((entry) => entry.kind === "training")) {
      const fresh = generated.days.find((entry) => entry.id === day.id);
      const over = () => cycleIndexes.filter((cycleIndex) => compiler.estimateDaySeconds(day, cycleIndex) >
        Math.max(ceiling, compiler.estimateDaySeconds(fresh, cycleIndex)));
      const order = day.slots.filter((slot) => carried.has(slot)).sort((left, right) =>
        Number(/Accessory$/.test(left.role)) - Number(/Accessory$/.test(right.role)) || left.order - right.order);
      const wanted = new Map(order.map((slot) => [slot, slot.prescriptionsByCycle]));
      for (const slot of order) slot.prescriptionsByCycle = copyJson(carried.get(slot).fresh.prescriptionsByCycle, "prescriptionsByCycle");
      for (const slot of order) {
        const entry = carried.get(slot);
        slot.prescriptionsByCycle = wanted.get(slot);
        for (const cycleIndex of over()) {
          const sets = cycleOf(slot, cycleIndex).sets;
          const generatedCount = cycleOf(entry.fresh, cycleIndex).sets.length;
          while (sets.length > generatedCount && over().includes(cycleIndex)) { sets.pop(); entry.outcome = "clamped"; }
        }
        if (!over().length) continue;
        slot.prescriptionsByCycle = copyJson(entry.fresh.prescriptionsByCycle, "prescriptionsByCycle");
        entry.outcome = "dropped";
        entry.reason = "over_session_limit";
      }
    }
  }

  function carryEdits(predecessor, successor, catalog, compiler) {
    const baseline = generatorBaseline(predecessor, catalog, compiler);
    if (!baseline) return { value: successor, carry: { identified: false, entries: [] } };
    const next = copyJson(successor, "programDefinition");
    const baselineSlots = new Map(trainingSlots(baseline).map((slot) => [slot.id, slot]));
    const freshSlots = new Map(trainingSlots(successor).map((slot) => [slot.id, slot]));
    const movement = (slot) => `${slot.exerciseId}|${canonicalJson(slot.metricIds)}`;
    const unclaimed = new Map();
    for (const slot of trainingSlots(next)) unclaimed.set(movement(slot), [...(unclaimed.get(movement(slot)) || []), slot]);
    const entries = [];
    const carried = new Map();
    for (const source of trainingSlots(predecessor)) {
      const edits = slotEdits(source, baselineSlots.get(source.id));
      const target = unclaimed.get(movement(source))?.shift() || null;
      if (!edits.length) continue;
      const entry = { source, target, edits, fresh: target && freshSlots.get(target.id),
        outcome: target ? "kept" : "dropped", reason: target ? null : "slot_removed" };
      entries.push(entry);
      if (!target) continue;
      for (const edit of edits) applyCycleEdit(target, source, edit);
      carried.set(target, entry);
    }
    fitCarried(next, successor, carried, compiler);
    return { value: next, carry: { identified: true, entries: entries.map((entry) => ({
      exerciseId: entry.source.exerciseId,
      predecessorSlotId: entry.source.id,
      successorSlotId: entry.target?.id || null,
      outcome: entry.outcome,
      reason: entry.reason,
      cycles: entry.edits.map((edit) => ({
        cycleIndex: edit.cycleIndex,
        fields: edit.fields,
        requestedSets: cycleOf(entry.source, edit.cycleIndex).sets.length,
        sets: entry.target ? cycleOf(entry.target, edit.cycleIndex)?.sets.length ?? null : null,
      })),
    })) } };
  }

  function reduceVolume(definition) {
    let changed = false;
    const next = copyJson(definition, "programDefinition");
    for (const day of next.days) for (const slot of day.slots) {
      if (PROTECTED_ROLE.test(slot.role)) continue;
      for (const cycle of slot.prescriptionsByCycle) {
        if (cycle.sets.length > 1) { cycle.sets.pop(); changed = true; }
      }
    }
    return changed ? { ok: true, value: next } : unavailable("volume_floor");
  }

  function insertRecoveryWeek(definition) {
    if (definition.cycles >= 12) return unavailable("cycles_limit");
    const next = copyJson(definition, "programDefinition");
    next.cycles = definition.cycles + 1;
    next.deloadCycles = [1, ...definition.deloadCycles.map((cycle) => cycle + 1)];
    if (plainRecord(next.request) && next.request.goal) {
      next.request.cycles = next.cycles;
      next.request.deloadCycles = [...next.deloadCycles];
    }
    for (const day of next.days) for (const slot of day.slots) {
      const first = slot.prescriptionsByCycle[0];
      const deload = {
        cycleIndex: 1,
        sets: first.sets.slice(0, Math.ceil(first.sets.length / 2)).map((set) => ({
          ...set,
          id: `${set.id}~recovery`,
          cycleIndex: 1,
          rir: set.rir == null ? null : Math.min(4, set.rir + 2),
          provenance: { ...set.provenance, deload: true },
        })),
      };
      const shifted = slot.prescriptionsByCycle.map((cycle) => ({
        cycleIndex: cycle.cycleIndex + 1,
        sets: cycle.sets.map((set) => ({ ...set, cycleIndex: cycle.cycleIndex + 1 })),
      }));
      slot.prescriptionsByCycle = [deload, ...shifted];
    }
    return { ok: true, value: next };
  }

  function deriveSuccessor(input) {
    let copied;
    try { copied = copyJson(input, "input"); } catch { return resultInvalid("derive_input_invalid"); }
    if (!plainRecord(copied) || !validChange(copied.change)) return unavailable("unsupported_change");
    const catalog = catalogFrom(copied.catalogSnapshot);
    const custom = copied.customExerciseDefinitions;
    const current = validateProgramDefinition(copied.programDefinition, custom, catalog);
    if (!current.ok) return resultInvalid(current.code);
    const definition = current.value;
    const compiler = compilerApi();
    const { change } = copied;
    let derived;
    if (change.kind === "fewer_days") {
      if (change.daysPerWeek < 2 || change.daysPerWeek > 6) return unavailable("days_unsupported");
      const trainingDays = definition.days.filter((day) => day.kind === "training").length;
      if (change.daysPerWeek >= trainingDays) return unavailable("not_fewer_days");
      derived = regenerate(definition, { daysPerWeek: change.daysPerWeek, split: "auto" }, catalog, compiler);
    } else if (change.kind === "shorter_sessions") {
      if (change.sessionMinutes < 15 || change.sessionMinutes > 240) return unavailable("minutes_unsupported");
      const ceilings = compiler.TIME_CEILINGS;
      const ceiling = [...ceilings].reverse().find((value) => value <= change.sessionMinutes) ?? ceilings[0];
      if (definition.request?.goal && ceiling >= definition.request.timeCeilingMinutes) return unavailable("not_shorter_sessions");
      derived = regenerate(definition, { timeCeilingMinutes: ceiling }, catalog, compiler);
    } else if (change.kind === "reduce_volume") {
      derived = reduceVolume(definition);
    } else {
      derived = insertRecoveryWeek(definition);
    }
    if (!derived.ok) return derived;
    const checked = validateProgramDefinition(derived.value, custom, catalog);
    if (!checked.ok) return resultInvalid("derived_definition_invalid");
    return { ok: true, value: { programDefinition: checked.value, customExerciseDefinitions: custom, change,
      ...(derived.carry ? { carry: derived.carry } : {}) } };
  }

  async function derivationMatches(change, predecessor, successor, catalog) {
    const derived = deriveSuccessor({
      change,
      programDefinition: predecessor.programDefinition,
      customExerciseDefinitions: predecessor.customExerciseDefinitions,
      catalogSnapshot: catalog,
    });
    if (!derived.ok) return false;
    return await fingerprintProgramDefinition(derived.value.programDefinition, derived.value.customExerciseDefinitions) ===
      await fingerprintProgramDefinition(successor.programDefinition, successor.customExerciseDefinitions);
  }

  async function createReplacementProposal(input) {
    try {
      const copied = copyJson(input, "input");
      const catalog = catalogFrom(copied.catalogSnapshot);
      const change = copied.change;
      delete copied.change;
      if (change !== undefined && !validChange(change)) return resultInvalid("unsupported_change");
      const normalized = canonicalInput(copied, catalog);
      if (!normalized.ok) return resultInvalid(normalized.code || "replacement_input_invalid");
      if (change !== undefined && !await derivationMatches(change, normalized.value.predecessor, normalized.value.successor, catalog)) {
        return resultInvalid("successor_derivation_mismatch");
      }
      const proposal = {
        schemaVersion: SCHEMA_VERSION,
        kind: KIND,
        status: "preview",
        transitionId: normalized.value.transitionId,
        createdAt: normalized.value.createdAt,
        predecessor: {
          programId: normalized.value.predecessor.programId,
          durableRevision: normalized.value.predecessor.durableRevision,
          definitionFingerprint: await fingerprintProgramDefinition(
            normalized.value.predecessor.programDefinition,
            normalized.value.predecessor.customExerciseDefinitions,
          ),
        },
        successor: {
          programId: normalized.value.successor.programId,
          definitionFingerprint: await fingerprintProgramDefinition(
            normalized.value.successor.programDefinition,
            normalized.value.successor.customExerciseDefinitions,
          ),
          programDefinition: normalized.value.successor.programDefinition,
          customExerciseDefinitions: normalized.value.successor.customExerciseDefinitions,
        },
      };
      if (change !== undefined) proposal.change = change;
      proposal.proposalHash = await hashProposal(proposal);
      deepFreeze(proposal);
      replacementCapabilities.add(proposal);
      return { ok: true, proposal };
    } catch (error) {
      return resultInvalid(error?.code || "replacement_input_invalid");
    }
  }

  function proposalShape(proposal) {
    const top = ["schemaVersion", "kind", "status", "transitionId", "createdAt", "predecessor", "successor", "proposalHash",
      ...(Object.hasOwn(proposal || {}, "change") ? ["change"] : [])];
    const predecessor = ["programId", "durableRevision", "definitionFingerprint"];
    const successor = ["programId", "definitionFingerprint", "programDefinition", "customExerciseDefinitions"];
    return ownKeysAre(proposal, top) && ownKeysAre(proposal.predecessor, predecessor) &&
      ownKeysAre(proposal.successor, successor) && proposal.schemaVersion === SCHEMA_VERSION &&
      proposal.kind === KIND && proposal.status === "preview" && validIdentity(proposal.transitionId) &&
      isCanonicalInstant(proposal.createdAt) && validIdentity(proposal.predecessor.programId) &&
      Number.isSafeInteger(proposal.predecessor.durableRevision) && proposal.predecessor.durableRevision >= 0 &&
      validIdentity(proposal.predecessor.definitionFingerprint) && validIdentity(proposal.successor.programId) &&
      proposal.successor.programId !== proposal.predecessor.programId &&
      validIdentity(proposal.successor.definitionFingerprint) && typeof proposal.proposalHash === "string" &&
      /^[0-9a-f]{64}$/.test(proposal.proposalHash) && (!Object.hasOwn(proposal, "change") || validChange(proposal.change));
  }

  async function validateProposal(proposal, current) {
    let safeProposal;
    let safeCurrent;
    try {
      safeProposal = copyJson(proposal, "proposal");
      safeCurrent = copyJson(current, "current");
    } catch {
      return resultInvalid("proposal_or_current_invalid");
    }
    if (!proposalShape(safeProposal)) return resultInvalid(safeProposal.kind === KIND
      ? "replacement_proposal_invalid" : "unsupported_transition_kind");
    if (!plainRecord(safeCurrent) || !plainRecord(safeCurrent.predecessor)) return resultInvalid("current_predecessor_invalid");
    const catalog = catalogFrom(safeCurrent.catalogSnapshot);
    if (!validIdentity(safeCurrent.predecessor.programId) ||
        !Number.isSafeInteger(safeCurrent.predecessor.durableRevision) || safeCurrent.predecessor.durableRevision < 0 ||
        !Array.isArray(safeCurrent.predecessor.customExerciseDefinitions)) return resultInvalid("current_predecessor_invalid");
    const currentDefinition = validateProgramDefinition(safeCurrent.predecessor.programDefinition,
      safeCurrent.predecessor.customExerciseDefinitions, catalog);
    if (!currentDefinition.ok) return resultInvalid(currentDefinition.code);
    const successorDefinition = validateProgramDefinition(safeProposal.successor.programDefinition,
      safeProposal.successor.customExerciseDefinitions, catalog);
    if (!successorDefinition.ok) return resultInvalid(successorDefinition.code);
    let expectedHash;
    let predecessorFingerprint;
    let successorFingerprint;
    try {
      expectedHash = await hashProposal(safeProposal);
      predecessorFingerprint = await fingerprintProgramDefinition(
        currentDefinition.value,
        safeCurrent.predecessor.customExerciseDefinitions,
      );
      successorFingerprint = await fingerprintProgramDefinition(
        successorDefinition.value,
        safeProposal.successor.customExerciseDefinitions,
      );
    } catch (error) {
      return resultInvalid(error?.code || "proposal_hash_unavailable");
    }
    if (expectedHash !== safeProposal.proposalHash) return resultInvalid("proposal_hash_mismatch");
    if (safeCurrent.predecessor.programId !== safeProposal.predecessor.programId) return resultStale("predecessor_changed");
    if (safeCurrent.predecessor.durableRevision !== safeProposal.predecessor.durableRevision) return resultStale("predecessor_revision_changed");
    if (predecessorFingerprint !== safeProposal.predecessor.definitionFingerprint) return resultStale("predecessor_definition_changed");
    if (successorFingerprint !== safeProposal.successor.definitionFingerprint) return resultInvalid("successor_definition_mismatch");
    if (Object.hasOwn(safeProposal, "change") && !await derivationMatches(safeProposal.change,
      { programDefinition: currentDefinition.value, customExerciseDefinitions: safeCurrent.predecessor.customExerciseDefinitions },
      safeProposal.successor, catalog)) return resultInvalid("successor_derivation_mismatch");
    deepFreeze(safeProposal);
    replacementCapabilities.add(safeProposal);
    return { ok: true, status: "preview", proposal: safeProposal };
  }

  function commitRecord(proposal, options) {
    if (!proposal || typeof proposal !== "object" || !replacementCapabilities.has(proposal)) {
      throw new TypeError("proposal: expected a canonical validated replacement proposal");
    }
    if (!plainRecord(options) || !isCanonicalInstant(options.confirmedAt) ||
        options.confirmedAt < proposal.createdAt || options.archiveId !== proposal.predecessor.programId) {
      throw new TypeError("options: expected canonical confirmation time and predecessor archive id");
    }
    const record = {
      schemaVersion: SCHEMA_VERSION,
      kind: KIND,
      status: "committed",
      transitionId: proposal.transitionId,
      proposalHash: proposal.proposalHash,
      confirmedAt: options.confirmedAt,
      archiveId: options.archiveId,
      predecessor: {
        programId: proposal.predecessor.programId,
        durableRevision: proposal.predecessor.durableRevision,
        definitionFingerprint: proposal.predecessor.definitionFingerprint,
      },
      successor: {
        programId: proposal.successor.programId,
        definitionFingerprint: proposal.successor.definitionFingerprint,
      },
    };
    deepFreeze(record);
    committedCapabilities.add(record);
    return record;
  }

  function createTransitionOut(record) {
    if (!record || typeof record !== "object" || !committedCapabilities.has(record)) {
      throw new TypeError("record: expected a committed replacement record");
    }
    return deepFreeze({
      schemaVersion: SCHEMA_VERSION,
      transitionId: record.transitionId,
      proposalHash: record.proposalHash,
      successorProgramId: record.successor.programId,
    });
  }

  const api = Object.freeze({
    SCHEMA_VERSION,
    KIND,
    canonicalProposalJson: (proposal) => canonicalJson(proposalPreimage(proposal)),
    hashProposal,
    fingerprintProgramDefinition,
    CHANGE_KINDS,
    deriveSuccessor,
    createReplacementProposal,
    validateProposal,
    commitRecord,
    createTransitionOut,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.RepForgeProgramTransition = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
