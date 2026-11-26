import { DurableObject } from "cloudflare:workers";

// A fixed-window counter per (scope, keyed hash of the address). It keeps no
// address, only the hashed bucket name, and deletes itself after the window.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS bucket (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    window_started INTEGER NOT NULL,
    count INTEGER NOT NULL
  )
`;

export class RelayRateDurableObject extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
  }

  async consume({ now, limit, windowMs }) {
    if (![now, limit, windowMs].every(Number.isSafeInteger) || limit < 1 || windowMs < 1) throw new TypeError("invalid rate request");
    this.ctx.storage.sql.exec(SCHEMA);
    const row = this.ctx.storage.sql.exec("SELECT window_started, count FROM bucket WHERE singleton = 1").toArray()[0] ?? null;
    if (!row || now >= row.window_started + windowMs) {
      this.ctx.storage.sql.exec("INSERT OR REPLACE INTO bucket (singleton, window_started, count) VALUES (1, ?, 1)", now);
      await this.ctx.storage.setAlarm(now + windowMs);
      return { allowed: true };
    }
    if (row.count >= limit) return { allowed: false };
    this.ctx.storage.sql.exec("UPDATE bucket SET count = count + 1 WHERE singleton = 1");
    return { allowed: true };
  }

  async alarm() {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }
}
