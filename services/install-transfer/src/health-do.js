import { DurableObject } from "cloudflare:workers";

export const HEALTH_SIGNAL_MAX_AGE_MS = 5 * 60 * 1000;
export const BILLING_EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const CREATE_COST_THRESHOLD_CENTS = 1_000;
export const HEALTH_CLOCK_SKEW_MS = 60 * 1000;

const TABLE = "transfer_health";
const HEARTBEAT_COLUMNS = Object.freeze({
  alarm: "alarm_at",
  watchdog: "watchdog_at",
  log: "log_at",
  key: "key_at",
});

const CREATE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    alarm_at INTEGER,
    watchdog_at INTEGER,
    log_at INTEGER,
    key_at INTEGER,
    deletion_at INTEGER,
    deletion_healthy INTEGER NOT NULL,
    billing_at INTEGER,
    billing_monthly_cents INTEGER
  )
`;

function safeTime(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative safe integer`);
  return value;
}

function assertObservation(observedAt, now) {
  safeTime(observedAt, "observedAt");
  safeTime(now, "now");
  if (observedAt > now + HEALTH_CLOCK_SKEW_MS) throw new RangeError("observation is too far in the future");
}

function isFresh(value, now, maxAge) {
  return Number.isSafeInteger(value)
    && value >= 0
    && value <= now + HEALTH_CLOCK_SKEW_MS
    && now - value <= maxAge;
}

function rowHealth(row, now) {
  const leaseFresh = Object.values(HEARTBEAT_COLUMNS).every((column) => isFresh(row?.[column], now, HEALTH_SIGNAL_MAX_AGE_MS));
  const deletionHealthy = row?.deletion_healthy === 1 && isFresh(row?.deletion_at, now, HEALTH_SIGNAL_MAX_AGE_MS);
  const billingFresh = isFresh(row?.billing_at, now, BILLING_EVIDENCE_MAX_AGE_MS);
  const billingUnderThreshold = Number.isSafeInteger(row?.billing_monthly_cents)
    && row.billing_monthly_cents >= 0
    && row.billing_monthly_cents < CREATE_COST_THRESHOLD_CENTS;
  const billingHealthy = billingFresh && billingUnderThreshold;
  return {
    leaseFresh,
    deletionHealthy,
    billingHealthy,
    createsEnabled: leaseFresh && deletionHealthy && billingHealthy,
  };
}

export class TransferHealthDurableObject extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(CREATE_SCHEMA);
      ctx.storage.sql.exec(
        `INSERT OR IGNORE INTO ${TABLE} (singleton, deletion_healthy) VALUES (1, 0)`,
      );
    });
  }

  _read() {
    return this.ctx.storage.sql.exec(`SELECT * FROM ${TABLE} WHERE singleton = 1`).toArray()[0] ?? null;
  }

  _writeRows(cursor) {
    if (typeof cursor?.rowsWritten === "number") return cursor.rowsWritten;
    const row = this.ctx.storage.sql.exec("SELECT changes() AS rows_written").toArray()[0];
    return Number(row?.rows_written ?? 0);
  }

  _execWrite(sql, ...args) {
    return this._writeRows(this.ctx.storage.sql.exec(sql, ...args));
  }

  async snapshot({ now = Date.now() } = {}) {
    safeTime(now, "now");
    return rowHealth(this._read(), now);
  }

  async recordHeartbeat({ kind, observedAt = Date.now(), now = Date.now() }) {
    const column = HEARTBEAT_COLUMNS[kind];
    if (!column) throw new TypeError("unknown health signal");
    assertObservation(observedAt, now);
    this._execWrite(`UPDATE ${TABLE} SET ${column} = ? WHERE singleton = 1`, observedAt);
    return this.snapshot({ now });
  }

  async recordDeletionHealth({ healthy, observedAt = Date.now(), now = Date.now() }) {
    if (typeof healthy !== "boolean") throw new TypeError("healthy must be boolean");
    assertObservation(observedAt, now);
    this._execWrite(
      `UPDATE ${TABLE} SET deletion_at = ?, deletion_healthy = ? WHERE singleton = 1`,
      observedAt,
      healthy ? 1 : 0,
    );
    return this.snapshot({ now });
  }

  async markDeletionUnhealthy({ observedAt = Date.now(), now = Date.now() } = {}) {
    return this.recordDeletionHealth({ healthy: false, observedAt, now });
  }

  async recordBilling({ monthlyCostCents, observedAt = Date.now(), now = Date.now() }) {
    if (!Number.isSafeInteger(monthlyCostCents) || monthlyCostCents < 0) {
      throw new TypeError("monthlyCostCents must be a non-negative safe integer");
    }
    assertObservation(observedAt, now);
    this._execWrite(
      `UPDATE ${TABLE} SET billing_at = ?, billing_monthly_cents = ? WHERE singleton = 1`,
      observedAt,
      monthlyCostCents,
    );
    return this.snapshot({ now });
  }
}

