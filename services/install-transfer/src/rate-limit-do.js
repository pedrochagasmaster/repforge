import { DurableObject } from "cloudflare:workers";

const TABLE = "rate_bucket";
const WINDOW_MS = 60_000;
const RETENTION_MS = 120_000;

const CREATE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    window_started INTEGER NOT NULL,
    count INTEGER NOT NULL
  )
`;

export class RateLimitDurableObject extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(CREATE_SCHEMA);
    });
  }

  _read() {
    return this.ctx.storage.sql.exec(`SELECT window_started, count FROM ${TABLE} WHERE singleton = 1`).toArray()[0] ?? null;
  }

  _writeRows(cursor) {
    if (typeof cursor?.rowsWritten === "number") return cursor.rowsWritten;
    const row = this.ctx.storage.sql.exec("SELECT changes() AS rows_written").toArray()[0];
    return Number(row?.rows_written ?? 0);
  }

  _execWrite(sql, ...args) {
    return this._writeRows(this.ctx.storage.sql.exec(sql, ...args));
  }

  async consume({ now = Date.now(), limit }) {
    if (!Number.isSafeInteger(now) || !Number.isSafeInteger(limit) || limit < 1) throw new TypeError("invalid rate request");
    let row = this._read();
    if (!row || now >= row.window_started + WINDOW_MS) {
      this.ctx.storage.sql.exec(`DELETE FROM ${TABLE} WHERE singleton = 1`);
      this.ctx.storage.sql.exec(`INSERT INTO ${TABLE} (singleton, window_started, count) VALUES (1, ?, 1)`, now);
      await this.ctx.storage.setAlarm(new Date(now + RETENTION_MS));
      return { allowed: true, retryAt: now + WINDOW_MS };
    }
    if (row.count >= limit) return { allowed: false, retryAt: row.window_started + WINDOW_MS };
    const changed = this._execWrite(
      `UPDATE ${TABLE} SET count = count + 1 WHERE singleton = 1 AND window_started = ? AND count = ? AND count < ?`,
      row.window_started,
      row.count,
      limit,
    );
    if (changed !== 1) {
      row = this._read();
      if (!row || now >= row.window_started + WINDOW_MS) return this.consume({ now, limit });
      return { allowed: false, retryAt: row.window_started + WINDOW_MS };
    }
    return { allowed: true, retryAt: row.window_started + WINDOW_MS };
  }

  async alarm() {
    const now = Date.now();
    const row = this._read();
    if (!row || now >= row.window_started + RETENTION_MS) {
      this.ctx.storage.sql.exec(`DELETE FROM ${TABLE} WHERE singleton = 1`);
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(new Date(row.window_started + RETENTION_MS));
  }
}
