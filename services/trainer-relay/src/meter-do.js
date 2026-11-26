import { DurableObject } from "cloudflare:workers";
import contract from "../../../trainer-relay-contract.js";

// The relay's operating-cost gate (ADR 0026, "Limits and abuse"). One global
// object keeps this UTC month's counts and two cost figures:
//  - a metered estimate, charged per create, per stored byte and per read
//    at conservative list prices with no free allowance, and
//  - the latest owner-attested figure for the month (POST /_ops/billing), as
//    install transfer's operations contract does (ADR 0013).
// New creates are refused while the larger of the two is at or above the
// threshold. Reads are never refused here. The first refusal in a month
// raises one alert. It stores counts and amounts only.
//
// Unit: millionths of a US cent. Assumed list prices (Workers Paid):
// Worker request $0.30/M, Durable Object request $0.15/M, SQLite rows written
// $1.00/M, storage $0.20/GB-month, duration $12.50/M GB-s at 128 MB x 10 ms.
export const MICRO_CENTS_PER_CENT = 1_000_000;
export const COST = Object.freeze({
  // 1 Worker request + 3 Durable Object requests + 3 durations + 6 rows written.
  createFixed: 30 + 3 * 15 + 3 * 2 + 6 * 100,
  // Seven days of storage per ciphertext byte: $0.20 per 1e9 bytes per month x 0.25 month.
  createPerByte: 0.005,
  // 1 Worker request + 3 Durable Object requests + 3 durations + 1 row written.
  read: 30 + 3 * 15 + 3 * 2 + 100,
});

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS meter (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    month TEXT NOT NULL,
    creates INTEGER NOT NULL,
    refused INTEGER NOT NULL,
    reads INTEGER NOT NULL,
    stored_bytes INTEGER NOT NULL,
    metered_micro_cents INTEGER NOT NULL,
    attested_cents INTEGER,
    alerted INTEGER NOT NULL
  )
`;

export function monthOf(now) {
  return new Date(now).toISOString().slice(0, 7);
}

export class RelayMeterDurableObject extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
  }

  _current(now) {
    this.ctx.storage.sql.exec(SCHEMA);
    const month = monthOf(now);
    let row = this.ctx.storage.sql.exec("SELECT * FROM meter WHERE singleton = 1").toArray()[0] ?? null;
    if (!row || row.month !== month) {
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO meter (singleton, month, creates, refused, reads, stored_bytes, metered_micro_cents, attested_cents, alerted) VALUES (1, ?, 0, 0, 0, 0, 0, NULL, 0)",
        month,
      );
      row = this.ctx.storage.sql.exec("SELECT * FROM meter WHERE singleton = 1").toArray()[0];
    }
    return row;
  }

  _costCents(row) {
    const metered = Math.ceil(row.metered_micro_cents / MICRO_CENTS_PER_CENT);
    return Math.max(metered, row.attested_cents ?? 0);
  }

  _gateClosed(row) {
    return this._costCents(row) >= contract.LIMITS.costThresholdCents;
  }

  /** Raises the month's single alert the first time the gate is seen closed. */
  _alertOnce(row) {
    if (row.alerted) return false;
    this.ctx.storage.sql.exec("UPDATE meter SET alerted = 1 WHERE singleton = 1");
    return true;
  }

  async admitCreate({ now, bytes }) {
    if (!Number.isSafeInteger(now) || !Number.isSafeInteger(bytes) || bytes < 0) throw new TypeError("invalid meter request");
    const row = this._current(now);
    if (this._gateClosed(row)) {
      this.ctx.storage.sql.exec("UPDATE meter SET refused = refused + 1 WHERE singleton = 1");
      return { allowed: false, alert: this._alertOnce(row) };
    }
    const cost = COST.createFixed + Math.ceil(bytes * COST.createPerByte);
    this.ctx.storage.sql.exec(
      "UPDATE meter SET creates = creates + 1, stored_bytes = stored_bytes + ?, metered_micro_cents = metered_micro_cents + ? WHERE singleton = 1",
      bytes, cost,
    );
    return { allowed: true, alert: false };
  }

  async recordRead({ now }) {
    if (!Number.isSafeInteger(now)) throw new TypeError("invalid meter request");
    this._current(now);
    this.ctx.storage.sql.exec("UPDATE meter SET reads = reads + 1, metered_micro_cents = metered_micro_cents + ? WHERE singleton = 1", COST.read);
  }

  /** The owner's billing receipt for a month. Only the current month is accepted. */
  async attest({ now, month, monthlyCostCents }) {
    if (!Number.isSafeInteger(now) || !Number.isSafeInteger(monthlyCostCents) || monthlyCostCents < 0 || monthlyCostCents > 100_000_000) {
      throw new TypeError("invalid billing receipt");
    }
    if (month !== monthOf(now)) return { accepted: false };
    this._current(now);
    this.ctx.storage.sql.exec("UPDATE meter SET attested_cents = ? WHERE singleton = 1", monthlyCostCents);
    const row = this._current(now);
    return { accepted: true, alert: this._gateClosed(row) ? this._alertOnce(row) : false };
  }

  async snapshot({ now }) {
    const row = this._current(now);
    return {
      month: row.month,
      creates: row.creates,
      refusedCreates: row.refused,
      reads: row.reads,
      storedBytes: row.stored_bytes,
      meteredCents: Math.ceil(row.metered_micro_cents / MICRO_CENTS_PER_CENT),
      attestedCents: row.attested_cents,
      thresholdCents: contract.LIMITS.costThresholdCents,
      costThresholdReached: this._gateClosed(row),
      alerted: row.alerted === 1,
    };
  }
}
