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

  async function createReplacementProposal(input) {
    try {
      const copied = copyJson(input, "input");
      const catalog = catalogFrom(copied.catalogSnapshot);
      const normalized = canonicalInput(copied, catalog);
      if (!normalized.ok) return resultInvalid(normalized.code || "replacement_input_invalid");
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
      proposal.proposalHash = await hashProposal(proposal);
      deepFreeze(proposal);
      replacementCapabilities.add(proposal);
      return { ok: true, proposal };
    } catch (error) {
      return resultInvalid(error?.code || "replacement_input_invalid");
    }
  }

  function proposalShape(proposal) {
    const top = ["schemaVersion", "kind", "status", "transitionId", "createdAt", "predecessor", "successor", "proposalHash"];
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
      /^[0-9a-f]{64}$/.test(proposal.proposalHash);
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
    createReplacementProposal,
    validateProposal,
    commitRecord,
    createTransitionOut,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.RepForgeProgramTransition = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
