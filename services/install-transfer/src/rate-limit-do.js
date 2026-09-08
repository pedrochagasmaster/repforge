import { DurableObject } from "cloudflare:workers";

const TABLE = "rate_bucket";
const WINDOW_MS = 60_000;
const RETENTION_MS = 120_000;
const DISPOSAL_RETRY_MS = 60_000;

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
    this.schemaReady = false;
    this.storageDisposed = false;
    this.cleanupFailed = false;
    this.disposalPromise = null;
  }

  _ensureSchema() {
    if (this.schemaReady) return;
    this.ctx.storage.sql.exec(CREATE_SCHEMA);
    this.schemaReady = true;
    this.storageDisposed = false;
  }

  async _disposeStorage() {
    if (this.storageDisposed) return;
    if (this.disposalPromise) return this.disposalPromise;
    this.disposalPromise = (async () => {
      let deleteAllStarted = false;
      try {
        await this.ctx.storage.deleteAlarm();
        deleteAllStarted = true;
        await this.ctx.storage.deleteAll();
        this.schemaReady = false;
        this.storageDisposed = true;
        this.cleanupFailed = false;
      } catch (error) {
        this.storageDisposed = false;
        // A rejected deleteAll may have completed before its acknowledgement
        // was lost. Rebuild lazily rather than querying a missing table.
        this.schemaReady = !deleteAllStarted;
        this.cleanupFailed = true;
        try {
          await this.ctx.storage.setAlarm(new Date(Date.now() + DISPOSAL_RETRY_MS));
        } catch {
          // The next consume attempt remains fail-closed and retries cleanup.
        }
        throw error;
      } finally {
        this.disposalPromise = null;
      }
    })();
    return this.disposalPromise;
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
    if (this.disposalPromise) {
      try { await this.disposalPromise; } catch { /* cleanupFailed below retries */ }
    }
    if (this.cleanupFailed) {
      try {
        await this._disposeStorage();
      } catch (error) {
        throw new Error("rate bucket cleanup unavailable", { cause: error });
      }
    }
    this._ensureSchema();
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
    if (this.storageDisposed) return { ok: true, code: "already-purged" };
    if (this.disposalPromise) {
      try { await this.disposalPromise; } catch { return { ok: false, code: "storage-disposal" }; }
    }
    this._ensureSchema();
    const now = Date.now();
    const row = this._read();
    if (!row || now >= row.window_started + RETENTION_MS) {
      try {
        await this._disposeStorage();
        return { ok: true, purged: true };
      } catch {
        return { ok: false, code: "storage-disposal" };
      }
    }
    await this.ctx.storage.setAlarm(new Date(row.window_started + RETENTION_MS));
    return { ok: true, purged: false };
  }
}
