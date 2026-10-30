import { DurableObject } from "cloudflare:workers";

export const HEALTH_SIGNAL_MAX_AGE_MS = 5 * 60 * 1000;
export const BILLING_EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const CREATE_COST_THRESHOLD_CENTS = 1_000;
export const HEALTH_CLOCK_SKEW_MS = 60 * 1000;
export const EVIDENCE_BODY_MAX_LENGTH = 128;

const TABLE = "transfer_health";
const EVIDENCE_TABLE = "transfer_health_evidence";
const OPS_RATE_TABLE = "transfer_ops_rate";
const HEARTBEAT_COLUMNS = Object.freeze({
  alarm: "alarm_at",
  watchdog: "watchdog_at",
  log: "log_at",
  key: "key_at",
});
const EVIDENCE_KINDS = new Set(["alarm", "watchdog", "log", "key", "deletion", "billing", "purge"]);
/* The last deletion check, kept so an incident can be read without logs: where
   it failed and the class of error only, never a token, cursor or identifier. */
export const DELETION_FAILURE_PATHS = Object.freeze(["registry-purge", "provider-list", "provider-purge", "internal"]);
export const DELETION_ERROR_CLASSES = Object.freeze([
  "request-failed", "rejected", "invalid-response", "incomplete", "due-rows",
  "record-integrity", "storage-disposal", "registry-binding", "registry-reservation", "transfer-binding", "registry-lifetime",
  "unknown",
]);
// A provider step that could not be completed for one of these reasons is a
// strike: it latches only when the next pass fails the same way. Anything that
// proves data was not deleted (incomplete purges, due rows) latches at once.
const TRANSIENT_PROVIDER_ERRORS = new Set(["request-failed", "rejected", "invalid-response"]);
const DEBOUNCED_PATHS = new Set(["provider-list", "provider-purge"]);
const OPERATION_ID_RE = /^[A-Za-z0-9_-]{16,96}$/u;
const ACTOR_RE = /^[A-Za-z0-9_-]{1,32}$/u;
const VERSION_RE = /^[A-Za-z0-9._-]{1,32}$/u;
const RESULT_RE = /^[A-Za-z0-9._-]{1,32}$/u;
const EVIDENCE_REF_RE = /^[A-Za-z0-9_-]{1,128}$/u;

const CREATE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    alarm_at INTEGER,
    watchdog_at INTEGER,
    log_at INTEGER,
    key_at INTEGER,
    deletion_at INTEGER,
    deletion_healthy INTEGER NOT NULL,
    incident_generation INTEGER NOT NULL,
    ack_generation INTEGER NOT NULL,
    billing_at INTEGER,
    billing_monthly_cents INTEGER
  )
`;

const EVIDENCE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ${EVIDENCE_TABLE} (
    kind TEXT PRIMARY KEY CHECK (kind IN ('alarm', 'watchdog', 'log', 'key', 'deletion', 'billing', 'purge')),
    actor TEXT NOT NULL,
    operation_id TEXT NOT NULL,
    check_version TEXT NOT NULL,
    result TEXT NOT NULL,
    observed_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    evidence_ref TEXT NOT NULL
  )
`;

const OPS_RATE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ${OPS_RATE_TABLE} (
    role TEXT PRIMARY KEY,
    window_started INTEGER NOT NULL,
    request_count INTEGER NOT NULL
  )
`;

function safeTime(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative safe integer`);
  return value;
}

function assertObservedAt(observedAt, now, maxAge) {
  safeTime(observedAt, "observedAt");
  safeTime(now, "now");
  if (!Number.isSafeInteger(maxAge) || maxAge < 1) throw new TypeError("maxAge must be a positive safe integer");
  if (observedAt > now + HEALTH_CLOCK_SKEW_MS) throw new RangeError("observation is too far in the future");
  if (observedAt < now - maxAge - HEALTH_CLOCK_SKEW_MS) throw new RangeError("observation is stale");
}

function evidenceExpiry(observedAt, now, maxAge) {
  const observedExpiry = observedAt > Number.MAX_SAFE_INTEGER - maxAge
    ? Number.MAX_SAFE_INTEGER
    : observedAt + maxAge;
  const receiptExpiry = now > Number.MAX_SAFE_INTEGER - maxAge
    ? Number.MAX_SAFE_INTEGER
    : now + maxAge;
  return Math.min(observedExpiry, receiptExpiry);
}

function isFresh(value, now, maxAge) {
  return Number.isSafeInteger(value)
    && value >= 0
    && value <= now + HEALTH_CLOCK_SKEW_MS
    && now - value <= maxAge;
}

function validEvidence(evidence, now, maxAge, expectedResult) {
  return Boolean(evidence)
    && EVIDENCE_KINDS.has(evidence.kind)
    && ACTOR_RE.test(evidence.actor)
    && OPERATION_ID_RE.test(evidence.operation_id)
    && VERSION_RE.test(evidence.check_version)
    && RESULT_RE.test(evidence.result)
    && EVIDENCE_REF_RE.test(evidence.evidence_ref)
    && isFresh(evidence.observed_at, now, maxAge)
    && Number.isSafeInteger(evidence.expires_at)
    && evidence.expires_at >= now
    && evidence.result === expectedResult;
}

function rowHealth(row, evidence, now) {
  const leaseFresh = Object.entries(HEARTBEAT_COLUMNS).every(([kind, column]) => {
    const signal = evidence.get(kind);
    return Number.isSafeInteger(row?.[column])
      && signal?.observed_at === row[column]
      && validEvidence(signal, now, HEALTH_SIGNAL_MAX_AGE_MS, "pass");
  });
  const deletionEvidence = evidence.get("deletion");
  const deletionHealthy = row?.deletion_healthy === 1
    && row?.ack_generation === row?.incident_generation
    && Number.isSafeInteger(row?.deletion_at)
    && deletionEvidence?.observed_at === row.deletion_at
    && validEvidence(deletionEvidence, now, HEALTH_SIGNAL_MAX_AGE_MS, "pass");
  const billingEvidence = evidence.get("billing");
  const billingFresh = Number.isSafeInteger(row?.billing_at)
    && billingEvidence?.observed_at === row.billing_at
    && validEvidence(billingEvidence, now, BILLING_EVIDENCE_MAX_AGE_MS, "observed");
  const billingUnderThreshold = Number.isSafeInteger(row?.billing_monthly_cents)
    && row.billing_monthly_cents >= 0
    && row.billing_monthly_cents < CREATE_COST_THRESHOLD_CENTS;
  const billingHealthy = billingFresh && billingUnderThreshold;
  return {
    leaseFresh,
    deletionHealthy,
    billingHealthy,
    createsEnabled: leaseFresh && deletionHealthy && billingHealthy,
    incidentGeneration: Number.isSafeInteger(row?.incident_generation) ? row.incident_generation : 1,
    ackGeneration: Number.isSafeInteger(row?.ack_generation) ? row.ack_generation : 0,
    lastDeletionCheck: Number.isSafeInteger(row?.last_check_at) ? {
      checkVersion: row.last_check_version,
      observedAt: row.last_check_at,
      result: row.last_check_result,
      path: row.last_check_path ?? null,
      errorClass: row.last_check_error ?? null,
      consecutiveFailures: Number.isSafeInteger(row.deletion_strikes) ? row.deletion_strikes : 0,
    } : null,
  };
}

function defaultEvidence(kind, observedAt) {
  return {
    actor: "system",
    operationId: `system-${kind}-${observedAt}`,
    checkVersion: "internal-v1",
    result: kind === "billing" ? "observed" : "pass",
    evidenceRef: "internal",
  };
}

function assertEvidenceInput({ kind, actor, operationId, checkVersion, result, evidenceRef }) {
  if (!EVIDENCE_KINDS.has(kind)) throw new TypeError("unknown evidence kind");
  if (typeof actor !== "string" || !ACTOR_RE.test(actor)) throw new TypeError("actor is invalid");
  if (typeof operationId !== "string" || !OPERATION_ID_RE.test(operationId)) throw new TypeError("operationId is invalid");
  if (typeof checkVersion !== "string" || !VERSION_RE.test(checkVersion)) throw new TypeError("checkVersion is invalid");
  if (typeof result !== "string" || !RESULT_RE.test(result)) throw new TypeError("result is invalid");
  if (typeof evidenceRef !== "string" || !EVIDENCE_REF_RE.test(evidenceRef)) throw new TypeError("evidenceRef is invalid");
}

export class TransferHealthDurableObject extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(CREATE_SCHEMA);
      const columns = new Set(ctx.storage.sql.exec(`PRAGMA table_info(${TABLE})`).toArray().map((column) => column.name));
      if (!columns.has("incident_generation")) {
        ctx.storage.sql.exec(`ALTER TABLE ${TABLE} ADD COLUMN incident_generation INTEGER NOT NULL DEFAULT 1`);
      }
      if (!columns.has("ack_generation")) {
        ctx.storage.sql.exec(`ALTER TABLE ${TABLE} ADD COLUMN ack_generation INTEGER NOT NULL DEFAULT 0`);
      }
      for (const [column, type] of [["deletion_strikes", "INTEGER NOT NULL DEFAULT 0"], ["last_check_operation", "TEXT"],
        ["last_check_version", "TEXT"], ["last_check_at", "INTEGER"], ["last_check_result", "TEXT"],
        ["last_check_path", "TEXT"], ["last_check_error", "TEXT"]]) {
        if (!columns.has(column)) ctx.storage.sql.exec(`ALTER TABLE ${TABLE} ADD COLUMN ${column} ${type}`);
      }
      ctx.storage.sql.exec(EVIDENCE_SCHEMA);
      ctx.storage.sql.exec(OPS_RATE_SCHEMA);
      ctx.storage.sql.exec(
        `INSERT OR IGNORE INTO ${TABLE} (singleton, deletion_healthy, incident_generation, ack_generation) VALUES (1, 0, 1, 0)`,
      );
    });
  }

  _read() {
    return this.ctx.storage.sql.exec(`SELECT * FROM ${TABLE} WHERE singleton = 1`).toArray()[0] ?? null;
  }

  _readEvidence(kind) {
    return this.ctx.storage.sql.exec(`SELECT * FROM ${EVIDENCE_TABLE} WHERE kind = ?`, kind).toArray()[0] ?? null;
  }

  _readEvidenceMap() {
    return new Map(this.ctx.storage.sql.exec(`SELECT * FROM ${EVIDENCE_TABLE}`).toArray().map((row) => [row.kind, row]));
  }

  _writeRows(cursor) {
    if (typeof cursor?.rowsWritten === "number") return cursor.rowsWritten;
    const row = this.ctx.storage.sql.exec("SELECT changes() AS rows_written").toArray()[0];
    return Number(row?.rows_written ?? 0);
  }

  _execWrite(sql, ...args) {
    return this._writeRows(this.ctx.storage.sql.exec(sql, ...args));
  }

  _insertEvidence({ kind, actor, operationId, checkVersion, result, evidenceRef, observedAt, now, maxAge }) {
    const expiresAt = evidenceExpiry(observedAt, now, maxAge);
    return this._execWrite(
      `INSERT INTO ${EVIDENCE_TABLE} (kind, actor, operation_id, check_version, result, observed_at, expires_at, evidence_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(kind) DO UPDATE SET
         actor = excluded.actor,
         operation_id = excluded.operation_id,
         check_version = excluded.check_version,
         result = excluded.result,
         observed_at = excluded.observed_at,
         expires_at = excluded.expires_at,
         evidence_ref = excluded.evidence_ref`,
      kind,
      actor,
      operationId,
      checkVersion,
      result,
      observedAt,
      expiresAt,
      evidenceRef,
    );
  }

  _writeEvidence({ kind, actor, operationId, checkVersion, result, evidenceRef, observedAt, now, maxAge }) {
    assertEvidenceInput({ kind, actor, operationId, checkVersion, result, evidenceRef });
    assertObservedAt(observedAt, now, maxAge);
    const existing = this._readEvidence(kind);
    if (existing?.operation_id === operationId) {
      if (existing.actor !== actor || existing.check_version !== checkVersion || existing.result !== result
        || existing.evidence_ref !== evidenceRef || existing.observed_at !== observedAt) {
        throw new Error("operation ID replay does not match prior evidence");
      }
      return { replayed: true, existing };
    }
    if (Number.isSafeInteger(existing?.observed_at) && observedAt < existing.observed_at) {
      throw new RangeError("observation is older than the latest evidence");
    }
    this._insertEvidence({ kind, actor, operationId, checkVersion, result, evidenceRef, observedAt, now, maxAge });
    return { replayed: false, existing: null };
  }

  async snapshot({ now = Date.now() } = {}) {
    safeTime(now, "now");
    return rowHealth(this._read(), this._readEvidenceMap(), now);
  }

  async consumeOperatorRate({ role, now = Date.now(), limit = 10 }) {
    if (typeof role !== "string" || !/^[A-Za-z0-9_-]{1,32}$/u.test(role)) throw new TypeError("role is invalid");
    safeTime(now, "now");
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 60) throw new RangeError("operator rate limit is invalid");
    const existing = this.ctx.storage.sql.exec(`SELECT window_started, request_count FROM ${OPS_RATE_TABLE} WHERE role = ?`, role).toArray()[0];
    if (!existing || now - existing.window_started >= 60_000) {
      this._execWrite(
        `INSERT INTO ${OPS_RATE_TABLE} (role, window_started, request_count) VALUES (?, ?, 1)
         ON CONFLICT(role) DO UPDATE SET window_started = excluded.window_started, request_count = excluded.request_count`,
        role,
        now,
      );
      return { allowed: true };
    }
    if (existing.request_count >= limit) return { allowed: false };
    this._execWrite(`UPDATE ${OPS_RATE_TABLE} SET request_count = request_count + 1 WHERE role = ?`, role);
    return { allowed: true };
  }

  async recordHeartbeat({
    kind,
    observedAt = Date.now(),
    now = Date.now(),
    actor,
    operationId,
    checkVersion,
    result = "pass",
    evidenceRef,
  }) {
    const column = HEARTBEAT_COLUMNS[kind];
    if (!column) throw new TypeError("unknown health signal");
    const defaults = defaultEvidence(kind, observedAt);
    const evidence = {
      actor: actor ?? defaults.actor,
      operationId: operationId ?? defaults.operationId,
      checkVersion: checkVersion ?? defaults.checkVersion,
      result,
      evidenceRef: evidenceRef ?? defaults.evidenceRef,
    };
    const write = this._writeEvidence({ kind, ...evidence, observedAt, now, maxAge: HEALTH_SIGNAL_MAX_AGE_MS });
    if (!write.replayed) this._execWrite(`UPDATE ${TABLE} SET ${column} = ? WHERE singleton = 1`, observedAt);
    return this.snapshot({ now });
  }

  _noteCheck({ operationId, checkVersion, observedAt, result, path = null, errorClass = null, strikes }) {
    this._execWrite(
      `UPDATE ${TABLE} SET last_check_operation = ?, last_check_version = ?, last_check_at = ?, last_check_result = ?,
         last_check_path = ?, last_check_error = ?, deletion_strikes = ? WHERE singleton = 1`,
      operationId, checkVersion, observedAt, result, path, errorClass, strikes,
    );
  }

  async recordDeletionHealth({
    healthy,
    observedAt = Date.now(),
    now = Date.now(),
    actor,
    operationId,
    checkVersion,
    result = "pass",
    evidenceRef,
    failurePath,
    errorClass,
  }) {
    if (typeof healthy !== "boolean") throw new TypeError("healthy must be boolean");
    safeTime(observedAt, "observedAt");
    safeTime(now, "now");
    if (healthy) {
      this.ctx.storage.transactionSync(() => {
        const row = this._read();
        const defaults = defaultEvidence("deletion", observedAt);
        // A passing check ends any run of provider strikes, latched or not.
        this._noteCheck({ operationId: operationId ?? defaults.operationId, checkVersion: checkVersion ?? defaults.checkVersion,
          observedAt, result: "pass", strikes: 0 });
        // A positive check cannot clear an incident. It refreshes only an
        // already acknowledged generation, using the actual check time.
        if (row?.deletion_healthy !== 1 || row.ack_generation !== row.incident_generation) return;
        const write = this._writeEvidence({
          kind: "deletion",
          actor: actor ?? "watchdog",
          operationId: operationId ?? defaults.operationId,
          checkVersion: checkVersion ?? defaults.checkVersion,
          result,
          evidenceRef: evidenceRef ?? defaults.evidenceRef,
          observedAt,
          now,
          maxAge: HEALTH_SIGNAL_MAX_AGE_MS,
        });
        if (!write.replayed) {
          const changed = this._execWrite(`UPDATE ${TABLE} SET deletion_at = ? WHERE singleton = 1`, observedAt);
          if (changed !== 1) throw new Error("deletion health row update failed");
        }
      });
      return this.snapshot({ now });
    }
    assertObservedAt(observedAt, now, HEALTH_SIGNAL_MAX_AGE_MS);
    const defaults = defaultEvidence("deletion", observedAt);
    const path = DELETION_FAILURE_PATHS.includes(failurePath) ? failurePath : "internal";
    const failureClass = DELETION_ERROR_CLASSES.includes(errorClass) ? errorClass : "unknown";
    const resolvedOperation = operationId ?? defaults.operationId;
    const resolvedVersion = checkVersion ?? defaults.checkVersion;
    let struck = false;
    this.ctx.storage.transactionSync(() => {
      const row = this._read();
      if (row?.last_check_operation === resolvedOperation && row.last_check_result === "strike") { struck = true; return; }
      // The first transient provider failure on a healthy, acknowledged service
      // is a strike: recorded, but the service stays as it was. A second one in a
      // row, or any other failure, latches below.
      if (DEBOUNCED_PATHS.has(path) && TRANSIENT_PROVIDER_ERRORS.has(failureClass)
        && row?.deletion_healthy === 1 && row.ack_generation === row.incident_generation
        && !(Number.isSafeInteger(row.deletion_strikes) && row.deletion_strikes > 0)) {
        this._noteCheck({ operationId: resolvedOperation, checkVersion: resolvedVersion, observedAt, result: "strike",
          path, errorClass: failureClass, strikes: 1 });
        struck = true;
      }
    });
    if (struck) return this.snapshot({ now });
    this.ctx.storage.transactionSync(() => {
      const before = this._read();
      const write = this._writeEvidence({
        kind: "deletion",
        actor: actor ?? defaults.actor,
        operationId: operationId ?? defaults.operationId,
        checkVersion: checkVersion ?? defaults.checkVersion,
        result: "fail",
        evidenceRef: evidenceRef ?? defaults.evidenceRef,
        observedAt,
        now,
        maxAge: HEALTH_SIGNAL_MAX_AGE_MS,
      });
      if (write.replayed) return;
      const changed = this._execWrite(
        `UPDATE ${TABLE}
         SET deletion_at = ?, deletion_healthy = 0,
             incident_generation = incident_generation + 1
         WHERE singleton = 1`,
        observedAt,
      );
      if (changed !== 1) throw new Error("deletion health row update failed");
      const strikes = Number.isSafeInteger(before?.deletion_strikes) ? before.deletion_strikes : 0;
      this._noteCheck({ operationId: resolvedOperation, checkVersion: resolvedVersion, observedAt, result: "fail",
        path, errorClass: failureClass, strikes: strikes + 1 });
    });
    return this.snapshot({ now });
  }

  async markDeletionUnhealthy({ observedAt = Date.now(), now = Date.now(), code } = {}) {
    return this.recordDeletionHealth({ healthy: false, observedAt, now, failurePath: "internal",
      errorClass: DELETION_ERROR_CLASSES.includes(code) ? code : "unknown" });
  }

  async acknowledgeDeletion({
    generation,
    proofNonce,
    operationId,
    checkVersion = "manual-ack-v1",
    evidenceRef = "runbook",
    observedAt = Date.now(),
    now = Date.now(),
  }) {
    if (!Number.isSafeInteger(generation) || generation < 1) throw new TypeError("generation must be a positive safe integer");
    if (typeof proofNonce !== "string" || !/^[A-Za-z0-9_-]{32,128}$/u.test(proofNonce)) {
      throw new TypeError("proofNonce is invalid");
    }
    const resolvedOperationId = operationId ?? `ack-${generation}-${observedAt}`;
    assertEvidenceInput({
      kind: "deletion",
      actor: "operator",
      operationId: resolvedOperationId,
      checkVersion,
      result: "pass",
      evidenceRef,
    });
    assertObservedAt(observedAt, now, HEALTH_SIGNAL_MAX_AGE_MS);
    this.ctx.storage.transactionSync(() => {
      const existing = this._readEvidence("deletion");
      const row = this._read();
      if (existing?.operation_id === resolvedOperationId) {
        if (existing.actor !== "operator" || existing.check_version !== checkVersion
          || existing.result !== "pass" || existing.evidence_ref !== evidenceRef
          || existing.observed_at !== observedAt) {
          throw new Error("operation ID replay does not match prior acknowledgement");
        }
        if (row?.deletion_healthy === 1 && row.ack_generation === generation) {
          return;
        }
        throw new Error("deletion acknowledgement is stale or incomplete");
      }
      const changed = this._execWrite(
        `UPDATE ${TABLE}
         SET deletion_at = ?, deletion_healthy = 1, ack_generation = ?, deletion_strikes = 0
         WHERE singleton = 1 AND incident_generation = ?
           AND ack_generation < ? AND deletion_healthy = 0`,
        observedAt,
        generation,
        generation,
        generation,
      );
      if (changed !== 1) throw new Error("deletion acknowledgement is stale or already used");
      this._insertEvidence({
        kind: "deletion",
        actor: "operator",
        operationId: resolvedOperationId,
        checkVersion,
        result: "pass",
        evidenceRef,
        observedAt,
        now,
        maxAge: HEALTH_SIGNAL_MAX_AGE_MS,
      });
    });
    return this.snapshot({ now });
  }

  async recordBilling({
    monthlyCostCents,
    observedAt = Date.now(),
    now = Date.now(),
    actor,
    operationId,
    checkVersion,
    result = "observed",
    evidenceRef,
  }) {
    if (!Number.isSafeInteger(monthlyCostCents) || monthlyCostCents < 0) {
      throw new TypeError("monthlyCostCents must be a non-negative safe integer");
    }
    const defaults = defaultEvidence("billing", observedAt);
    const evidence = {
      actor: actor ?? defaults.actor,
      operationId: operationId ?? defaults.operationId,
      checkVersion: checkVersion ?? defaults.checkVersion,
      result,
      evidenceRef: evidenceRef ?? defaults.evidenceRef,
    };
    const existing = this._readEvidence("billing");
    if (existing?.operation_id === evidence.operationId) {
      const row = this._read();
      if (row?.billing_monthly_cents !== monthlyCostCents) throw new Error("operation ID replay does not match billing value");
    }
    const write = this._writeEvidence({ kind: "billing", ...evidence, observedAt, now, maxAge: BILLING_EVIDENCE_MAX_AGE_MS });
    if (!write.replayed) {
      this._execWrite(
        `UPDATE ${TABLE} SET billing_at = ?, billing_monthly_cents = ? WHERE singleton = 1`,
        observedAt,
        monthlyCostCents,
      );
    }
    return this.snapshot({ now });
  }

  async recordControlEvidence({
    kind = "purge",
    actor = "purge",
    operationId,
    checkVersion = "purge-v1",
    result = "accepted",
    evidenceRef = "registry",
    observedAt = Date.now(),
    now = Date.now(),
  }) {
    if (kind !== "purge") throw new TypeError("unknown control evidence kind");
    const existing = this._readEvidence(kind);
    if (existing?.operation_id === operationId) {
      if (existing.actor !== actor || existing.check_version !== checkVersion
        || existing.evidence_ref !== evidenceRef || existing.result !== result) {
        throw new Error("operation ID replay does not match prior evidence");
      }
      // Purge observes the registry at the service boundary.  A retried
      // operation has a new receipt time, but the operation ID still makes
      // the control action idempotent.
      return this.snapshot({ now });
    }
    this._writeEvidence({
      kind,
      actor,
      operationId,
      checkVersion,
      result,
      evidenceRef,
      observedAt,
      now,
      maxAge: HEALTH_SIGNAL_MAX_AGE_MS,
    });
    return this.snapshot({ now });
  }
}
