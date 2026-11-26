/* Trainer loop documents (ADR 0026 "The two payloads", Plan 086 slices 2 and 4). No UI.
 *
 * Two versioned documents travel through the trainer relay:
 *  - a program handoff (trainer to client): kind `taurifer-program-handoff`;
 *  - a training update (client to trainer): kind `taurifer-training-update`.
 *
 * Both are new kinds. The locked shared-setup document and its link envelopes
 * are not changed; the handoff reuses shared-setup.js's validator for its
 * program, settings and language by building that document in memory.
 *
 * Every function here is pure except send/receive, which hand the encoded text
 * to the relay client. Validation is strict and fails closed: an unknown kind
 * or a newer version is refused whole, unknown fields are refused, and nothing
 * is partly applied. The training update is built from an allowlist of fields,
 * never by copying a log row, so body weight, earlier history, settings and
 * device preferences cannot enter it.
 */
(function trainerDocuments(root) {
  "use strict";

  const node = typeof module !== "undefined" && module.exports;
  const Setup = node ? require("./shared-setup.js") : root.RepForgeSharedSetup;
  const Relay = node ? require("./trainer-relay.js") : root.RepForgeTrainerRelay;

  const HANDOFF_KIND = "taurifer-program-handoff";
  const UPDATE_KIND = "taurifer-training-update";
  const HANDOFF_VERSION = 1;
  const UPDATE_VERSION = 1;

  const LIMITS = Object.freeze({
    messageChars: 1000,
    displayNameChars: 80,
    registrationChars: 80,
    startingLoadKgMax: 1000,
    sessions: 120,
    setsPerSession: 200,
    nameChars: 200,
    noteChars: 2000,
    idChars: 200,
    metricValuesPerSet: 8,
    // The UTF-8 size of an encoded document. The update's bound is proposed
    // from measured logs in the slice PR; the handoff's carries a complete
    // program, which the relay's compressed-ciphertext bound limits first.
    handoffBytes: 1_048_576,
    updateBytes: 1_048_576,
  });

  const HANDOFF_KEYS = ["kind", "version", "program", "settings", "language", "startingLoads", "message", "trainer"];
  const HANDOFF_REQUIRED = ["kind", "version", "program", "settings", "language", "startingLoads", "trainer"];
  const TRAINER_KEYS = ["displayName", "registration"];
  const STARTING_LOAD_KEYS = ["slotId", "openingKg"];
  const UPDATE_KEYS = ["kind", "version", "program", "sessions"];
  const SESSION_KEYS = ["id", "date", "day", "completedAt", "notes", "sets"];
  const SET_KEYS = ["exerciseId", "libraryId", "name", "performedName", "set", "load", "reps", "rir", "effortSource",
    "partialReps", "warmup", "ramp", "note", "metricValues"];
  const SET_REQUIRED = ["exerciseId", "name", "set", "load", "reps", "rir"];
  const METRIC_VALUE_KEYS = ["metricId", "value", "unit"];
  const EFFORT_SOURCES = Object.freeze(["rir", "effort", "reps_left", "reps_left_3plus", "reps_left_5plus", "unsure", "prefilled", "failure"]);
  // eslint-disable-next-line no-control-regex
  const CONTROL_RE = /[\u0000-\u0008\u000b-\u001f\u007f]/u;

  function own(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function fail(code, issues = []) {
    return { ok: false, code, issues };
  }

  function keysIssues(value, allowed, required, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(path + ": expected an object");
      return false;
    }
    for (const key of Object.keys(value)) if (!allowed.includes(key)) issues.push(path + "." + key + ": unsupported field");
    for (const key of required) if (!own(value, key)) issues.push(path + "." + key + ": required");
    return true;
  }

  function text(value, { max, min = 0, multiline = false } = {}) {
    if (typeof value !== "string" || value.length < min || value.length > max) return false;
    if (CONTROL_RE.test(value)) return false;
    return multiline || !/[\r\n]/u.test(value);
  }

  function finite(value, { min = -Infinity, max = Infinity } = {}) {
    return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
  }

  /** The kind and version gate shared by both documents: refuse other kinds and newer versions whole. */
  function header(value, kind, version) {
    if (!isPlainObject(value)) return fail("invalid-schema", ["$: expected an object"]);
    if (value.kind !== kind) return fail("unsupported-kind");
    if (!Number.isSafeInteger(value.version) || value.version < 1) return fail("invalid-schema", ["version: invalid"]);
    if (value.version !== version) return fail("unsupported-version");
    return null;
  }

  /** The program, settings and language through shared-setup.js's own validator. */
  function validateProgramPart(program, settings, language, setupOptions) {
    const checked = Setup.validate({ kind: Setup.KIND, version: Setup.VERSION, program, settings, language }, setupOptions);
    return checked.ok ? { ok: true, value: checked.value } : fail(checked.code || "invalid-program", checked.issues || []);
  }

  function trainingSlotIds(definition) {
    const ids = new Set();
    for (const day of definition.days || []) {
      if (day.kind !== "training") continue;
      for (const slot of day.slots || []) ids.add(slot.id);
    }
    return ids;
  }

  function customIds(program) {
    return new Set((program.customExercises || []).map((entry) => entry.id));
  }

  function knownExercise(id, setupOptions, customs) {
    if (typeof id !== "string") return false;
    if (id.startsWith("custom:")) return customs.has(id);
    const builtIns = setupOptions?.builtInIds;
    return builtIns instanceof Set ? builtIns.has(id) : Array.isArray(builtIns) ? builtIns.includes(id) : false;
  }

  function measured(value, maxBytes) {
    const encoded = JSON.stringify(value);
    return new TextEncoder().encode(encoded).length <= maxBytes ? encoded : null;
  }

  /* ---------------------------------------------------------------- handoff */

  /**
   * Validate a program handoff. `setupOptions` are shared-setup.js's options
   * (catalog snapshot, built-in ids, validateProgramDefinition). Resolves the
   * canonical document or a code; nothing is applied here.
   */
  function validateProgramHandoff(raw, setupOptions = {}) {
    let value;
    try { value = Setup.canonicalize(raw); } catch (error) { return fail("invalid-schema", [String(error?.message || error)]); }
    const refused = header(value, HANDOFF_KIND, HANDOFF_VERSION);
    if (refused) return refused;
    const issues = [];
    keysIssues(value, HANDOFF_KEYS, HANDOFF_REQUIRED, "$", issues);
    if (keysIssues(value.trainer, TRAINER_KEYS, ["displayName"], "trainer", issues)) {
      if (!text(value.trainer.displayName, { min: 1, max: LIMITS.displayNameChars }) || !value.trainer.displayName.trim()) issues.push("trainer.displayName: invalid");
      if (own(value.trainer, "registration") && !text(value.trainer.registration, { min: 1, max: LIMITS.registrationChars })) issues.push("trainer.registration: invalid");
    }
    if (own(value, "message") && (!text(value.message, { min: 1, max: LIMITS.messageChars, multiline: true }) || !value.message.trim())) issues.push("message: invalid");
    if (!Array.isArray(value.startingLoads)) issues.push("startingLoads: expected an array");
    if (issues.length) return fail("invalid-schema", issues);

    const program = validateProgramPart(value.program, value.settings, value.language, setupOptions);
    if (!program.ok) return program;
    const slots = trainingSlotIds(program.value.program.definition);
    const seen = new Set();
    value.startingLoads.forEach((entry, index) => {
      const path = "startingLoads[" + index + "]";
      if (!keysIssues(entry, STARTING_LOAD_KEYS, STARTING_LOAD_KEYS, path, issues)) return;
      if (!slots.has(entry.slotId)) issues.push(path + ".slotId: not a training slot of this program");
      else if (seen.has(entry.slotId)) issues.push(path + ".slotId: repeated");
      seen.add(entry.slotId);
      if (!finite(entry.openingKg, { min: 0, max: LIMITS.startingLoadKgMax }) || entry.openingKg <= 0) issues.push(path + ".openingKg: invalid");
    });
    if (issues.length) return fail("invalid-schema", issues);
    return { ok: true, value };
  }

  /**
   * Build and validate a handoff from the trainer's parts:
   * { program, settings, language, startingLoads, message?, trainer }.
   */
  function encodeProgramHandoff(input, setupOptions = {}) {
    if (!isPlainObject(input)) return fail("invalid-schema");
    const document = {
      kind: HANDOFF_KIND,
      version: HANDOFF_VERSION,
      program: input.program,
      settings: input.settings,
      language: input.language,
      startingLoads: input.startingLoads ?? [],
      trainer: input.trainer,
      ...(input.message == null || input.message === "" ? {} : { message: input.message }),
    };
    const checked = validateProgramHandoff(document, setupOptions);
    if (!checked.ok) return checked;
    const encoded = measured(checked.value, LIMITS.handoffBytes);
    return encoded ? { ok: true, text: encoded, value: checked.value } : fail("too-large");
  }

  function decodeProgramHandoff(textValue, setupOptions = {}) {
    if (typeof textValue !== "string" || new TextEncoder().encode(textValue).length > LIMITS.handoffBytes) return fail("too-large");
    let parsed;
    try { parsed = JSON.parse(textValue); } catch { return fail("invalid-json"); }
    return validateProgramHandoff(parsed, setupOptions);
  }

  /* ----------------------------------------------------------------- update */

  function validMetricValues(values, issues, path) {
    if (!Array.isArray(values) || values.length === 0 || values.length > LIMITS.metricValuesPerSet) {
      issues.push(path + ": invalid");
      return;
    }
    values.forEach((entry, index) => {
      const at = path + "[" + index + "]";
      if (!keysIssues(entry, METRIC_VALUE_KEYS, ["metricId", "value"], at, issues)) return;
      if (!text(entry.metricId, { min: 1, max: LIMITS.idChars })) issues.push(at + ".metricId: invalid");
      if (!(entry.value === null || finite(entry.value))) issues.push(at + ".value: invalid");
      if (own(entry, "unit") && !(entry.unit === null || text(entry.unit, { min: 1, max: 40 }))) issues.push(at + ".unit: invalid");
    });
  }

  function validateSet(set, path, issues, setupOptions, customs) {
    if (!keysIssues(set, SET_KEYS, SET_REQUIRED, path, issues)) return;
    if (!text(set.exerciseId, { min: 1, max: LIMITS.idChars })) issues.push(path + ".exerciseId: invalid");
    if (own(set, "libraryId") && !knownExercise(set.libraryId, setupOptions, customs)) issues.push(path + ".libraryId: unknown exercise identity");
    if (!text(set.name, { min: 1, max: LIMITS.nameChars })) issues.push(path + ".name: invalid");
    if (own(set, "performedName") && !text(set.performedName, { min: 1, max: LIMITS.nameChars })) issues.push(path + ".performedName: invalid");
    if (!Number.isSafeInteger(set.set) || set.set < 1 || set.set > 100) issues.push(path + ".set: invalid");
    if (!(set.load === null || finite(set.load, { min: -1000, max: 2000 }))) issues.push(path + ".load: invalid");
    if (!(set.reps === null || (Number.isSafeInteger(set.reps) && set.reps >= 0 && set.reps <= 1000))) issues.push(path + ".reps: invalid");
    if (!(set.rir === null || finite(set.rir, { min: 0, max: 100 }))) issues.push(path + ".rir: invalid");
    if (own(set, "effortSource") && !EFFORT_SOURCES.includes(set.effortSource)) issues.push(path + ".effortSource: invalid");
    if (own(set, "partialReps") && !(Number.isSafeInteger(set.partialReps) && set.partialReps > 0 && set.partialReps <= 100)) issues.push(path + ".partialReps: invalid");
    for (const flag of ["warmup", "ramp"]) if (own(set, flag) && set[flag] !== true) issues.push(path + "." + flag + ": invalid");
    if (own(set, "note") && !text(set.note, { min: 1, max: LIMITS.noteChars, multiline: true })) issues.push(path + ".note: invalid");
    if (own(set, "metricValues")) validMetricValues(set.metricValues, issues, path + ".metricValues");
  }

  /**
   * Validate a training update. `setupOptions` as for the handoff; the current
   * program is validated with the same rules, and every set's exercise must be
   * a catalog movement or a custom exercise the update carries.
   */
  function validateTrainingUpdate(raw, setupOptions = {}) {
    let value;
    try { value = Setup.canonicalize(raw); } catch (error) { return fail("invalid-schema", [String(error?.message || error)]); }
    const refused = header(value, UPDATE_KIND, UPDATE_VERSION);
    if (refused) return refused;
    const issues = [];
    keysIssues(value, UPDATE_KEYS, UPDATE_KEYS, "$", issues);
    if (!Array.isArray(value.sessions) || value.sessions.length > LIMITS.sessions) issues.push("sessions: expected at most " + LIMITS.sessions);
    if (issues.length) return fail("invalid-schema", issues);
    const program = Setup.validate({
      kind: Setup.KIND, version: Setup.VERSION, program: value.program,
      // The update carries no settings; a fixed placeholder satisfies the shared validator and is discarded.
      settings: { jumpPct: 0, minJump: 1, rirHigh: 0, hardRir: 0, restSec: 0, unit: "kg", lang: "en", rirMode: "numeric" },
      language: "en",
    }, setupOptions);
    if (!program.ok) return fail(program.code || "invalid-program", program.issues || []);
    const customs = customIds(value.program);
    const sessionIds = new Set();
    value.sessions.forEach((session, index) => {
      const path = "sessions[" + index + "]";
      if (!keysIssues(session, SESSION_KEYS, SESSION_KEYS, path, issues)) return;
      if (!text(session.id, { min: 1, max: LIMITS.idChars }) || sessionIds.has(session.id)) issues.push(path + ".id: invalid or repeated");
      sessionIds.add(session.id);
      if (!text(session.date, { min: 1, max: 40 })) issues.push(path + ".date: invalid");
      if (!(session.day === null || text(session.day, { min: 1, max: LIMITS.nameChars }))) issues.push(path + ".day: invalid");
      if (!text(session.completedAt, { min: 1, max: 100 })) issues.push(path + ".completedAt: invalid");
      if (!text(session.notes, { max: LIMITS.noteChars, multiline: true })) issues.push(path + ".notes: invalid");
      if (!Array.isArray(session.sets) || session.sets.length === 0 || session.sets.length > LIMITS.setsPerSession) {
        issues.push(path + ".sets: invalid");
        return;
      }
      session.sets.forEach((set, setIndex) => validateSet(set, path + ".sets[" + setIndex + "]", issues, setupOptions, customs));
    });
    if (issues.length) return fail("invalid-schema", issues);
    return { ok: true, value };
  }

  function optionalText(value, max) {
    return typeof value === "string" && value.trim() && value.length <= max ? value.trim() : null;
  }

  /** One set, built field by field from a saved log row. Nothing else of the row is read. */
  function setFromRow(row) {
    const set = {
      exerciseId: String(row.exerciseId),
      name: String(row.name),
      set: row.set,
      load: finite(row.load) ? row.load : null,
      reps: Number.isSafeInteger(row.reps) ? row.reps : null,
      rir: finite(row.rir) ? row.rir : null,
    };
    const libraryId = row.performedLibraryId ?? row.sourceLibraryId;
    if (typeof libraryId === "string" && libraryId) set.libraryId = libraryId;
    const performedName = optionalText(row.performedName, LIMITS.nameChars);
    if (performedName && performedName !== set.name) set.performedName = performedName;
    if (EFFORT_SOURCES.includes(row.effortSource)) set.effortSource = row.effortSource;
    if (Number.isSafeInteger(row.partialReps) && row.partialReps > 0) set.partialReps = row.partialReps;
    if (row.warmup === true) set.warmup = true;
    if (row.origin === "ramp") set.ramp = true;
    const note = optionalText(row.exNote, LIMITS.noteChars);
    if (note) set.note = note;
    if (Array.isArray(row.metricValues) && row.metricValues.length) {
      set.metricValues = row.metricValues.map((entry) => ({
        metricId: String(entry?.metricId),
        value: finite(entry?.value) ? entry.value : null,
        ...(typeof entry?.unit === "string" && entry.unit ? { unit: entry.unit } : {}),
      }));
    }
    return set;
  }

  /**
   * Select and project the sessions a training update carries, from the app's
   * durable state:
   *  - only rows of the current program (`row.blockId === state.programMeta.blockId`);
   *  - only sessions completed after `lastSentAt` (the last update the client
   *    sent; null for the first update);
   *  - no suggested warm-up rows.
   * Reads `state.program*`, `state.log` rows' allowlisted fields and nothing
   * else: settings, body weight, the profile and device preferences are never read.
   */
  function sessionsForUpdate(state, { lastSentAt = null } = {}) {
    const blockId = isPlainObject(state?.programMeta) && own(state.programMeta, "blockId") ? state.programMeta.blockId : null;
    if (blockId == null) return fail("no-current-program");
    const cutoff = lastSentAt == null ? null : Date.parse(lastSentAt);
    if (lastSentAt != null && !Number.isFinite(cutoff)) return fail("invalid-cutoff");
    const bySession = new Map();
    for (const row of Array.isArray(state.log) ? state.log : []) {
      if (!isPlainObject(row) || row.blockId !== blockId || row.origin === "suggested-warmup") continue;
      if (!Number.isSafeInteger(row.set) || row.set < 1 || typeof row.session !== "string") continue;
      const completed = Date.parse(row.created);
      if (!Number.isFinite(completed) || (cutoff != null && completed <= cutoff)) continue;
      if (!bySession.has(row.session)) {
        bySession.set(row.session, {
          id: row.session,
          date: String(row.date),
          day: optionalText(row.day, LIMITS.nameChars),
          completedAt: String(row.created),
          notes: typeof row.notes === "string" ? row.notes.trim() : "",
          sets: [],
        });
      }
      bySession.get(row.session).sets.push(setFromRow(row));
    }
    const sessions = [...bySession.values()].sort((left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt));
    return { ok: true, value: sessions };
  }

  /**
   * Build and validate a training update. `source` is
   * { program, programMeta: { blockId }, log }: the program part as the app
   * builds it for a setup link ({ name, definition, customExercises }), the
   * current block id and the saved log. Any other field of `source` (settings,
   * body weight, profile, device preferences) is ignored.
   */
  function encodeTrainingUpdate(source, setupOptions = {}, { lastSentAt = null } = {}) {
    if (!isPlainObject(source) || !isPlainObject(source.program)) return fail("invalid-schema");
    const sessions = sessionsForUpdate(source, { lastSentAt });
    if (!sessions.ok) return sessions;
    if (!sessions.value.length) return fail("nothing-to-send");
    if (sessions.value.length > LIMITS.sessions) return fail("too-many-sessions");
    const program = {
      name: source.program.name,
      definition: source.program.definition,
      ...(own(source.program, "customExercises") ? { customExercises: source.program.customExercises } : {}),
    };
    // A set performed as a movement this update cannot name (a custom exercise
    // outside the program) keeps its name and loses only the identity.
    const customs = customIds(program);
    for (const session of sessions.value) for (const set of session.sets) {
      if (own(set, "libraryId") && !knownExercise(set.libraryId, setupOptions, customs)) delete set.libraryId;
    }
    const document = { kind: UPDATE_KIND, version: UPDATE_VERSION, program, sessions: sessions.value };
    const checked = validateTrainingUpdate(document, setupOptions);
    if (!checked.ok) return checked;
    const encoded = measured(checked.value, LIMITS.updateBytes);
    return encoded ? { ok: true, text: encoded, value: checked.value } : fail("too-large");
  }

  function decodeTrainingUpdate(textValue, setupOptions = {}) {
    if (typeof textValue !== "string" || new TextEncoder().encode(textValue).length > LIMITS.updateBytes) return fail("too-large");
    let parsed;
    try { parsed = JSON.parse(textValue); } catch { return fail("invalid-json"); }
    return validateTrainingUpdate(parsed, setupOptions);
  }

  /* ------------------------------------------------------------------ relay */

  /** Upload an encoded document (from encodeProgramHandoff or encodeTrainingUpdate) through the relay. */
  async function send(encoded, relayOptions = {}) {
    if (!encoded?.ok || typeof encoded.text !== "string") return fail("invalid-document");
    return Relay.send(encoded.text, relayOptions);
  }

  /**
   * Read a relay link and decode it as `expectedKind`. Any relay, decrypt or
   * validation failure returns a code; nothing is applied.
   */
  async function receive(link, expectedKind, setupOptions = {}, relayOptions = {}) {
    if (expectedKind !== HANDOFF_KIND && expectedKind !== UPDATE_KIND) return fail("unsupported-kind");
    const received = await Relay.receive(link, relayOptions);
    if (!received.ok) return received;
    const decoded = expectedKind === HANDOFF_KIND
      ? decodeProgramHandoff(received.text, setupOptions)
      : decodeTrainingUpdate(received.text, setupOptions);
    return decoded.ok ? { ...decoded, expiresAt: received.expiresAt } : decoded;
  }

  const api = Object.freeze({
    HANDOFF_KIND,
    HANDOFF_VERSION,
    UPDATE_KIND,
    UPDATE_VERSION,
    LIMITS,
    SET_KEYS: Object.freeze([...SET_KEYS]),
    SESSION_KEYS: Object.freeze([...SESSION_KEYS]),
    validateProgramHandoff,
    encodeProgramHandoff,
    decodeProgramHandoff,
    sessionsForUpdate,
    validateTrainingUpdate,
    encodeTrainingUpdate,
    decodeTrainingUpdate,
    send,
    receive,
  });
  if (node) module.exports = api;
  else root.RepForgeTrainerDocuments = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
