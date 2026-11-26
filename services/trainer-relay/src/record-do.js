import { DurableObject } from "cloudflare:workers";

// One object per relay record. It stores ciphertext, nonce, protocol version,
// creation time, expiry and size, and nothing else (ADR 0026). An alarm at the
// expiry deletes the object's storage; a read at or after the expiry fails
// even if the alarm has not run yet.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS record (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    version INTEGER NOT NULL,
    nonce BLOB NOT NULL,
    ciphertext BLOB NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    size INTEGER NOT NULL
  )
`;

export class RelayRecordDurableObject extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
  }

  _row() {
    this.ctx.storage.sql.exec(SCHEMA);
    return this.ctx.storage.sql.exec("SELECT version, nonce, ciphertext, created_at, expires_at, size FROM record WHERE singleton = 1").toArray()[0] ?? null;
  }

  async _purge() {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  async create({ version, nonce, ciphertext, now, lifetimeMs }) {
    if (!Number.isSafeInteger(now) || !Number.isSafeInteger(lifetimeMs) || lifetimeMs <= 0) throw new TypeError("invalid record request");
    const existing = this._row();
    if (existing) {
      if (now < existing.expires_at) return { kind: "exists" };
      await this._purge();
      this._row();
    }
    const nonceBytes = new Uint8Array(nonce);
    const cipherBytes = new Uint8Array(ciphertext);
    const expiresAt = now + lifetimeMs;
    this.ctx.storage.sql.exec(
      "INSERT INTO record (singleton, version, nonce, ciphertext, created_at, expires_at, size) VALUES (1, ?, ?, ?, ?, ?, ?)",
      version, nonceBytes, cipherBytes, now, expiresAt, cipherBytes.length,
    );
    await this.ctx.storage.setAlarm(expiresAt);
    return { kind: "created", expiresAt };
  }

  async read({ now }) {
    if (!Number.isSafeInteger(now)) throw new TypeError("invalid read request");
    const row = this._row();
    if (!row) {
      await this._purge();
      return { kind: "gone" };
    }
    if (now >= row.expires_at) {
      await this._purge();
      return { kind: "gone" };
    }
    return {
      kind: "record",
      version: row.version,
      nonce: new Uint8Array(row.nonce),
      ciphertext: new Uint8Array(row.ciphertext),
      expiresAt: row.expires_at,
    };
  }

  async alarm() {
    const row = this._row();
    if (!row || Date.now() >= row.expires_at) {
      await this._purge();
      return;
    }
    await this.ctx.storage.setAlarm(row.expires_at);
  }
}
