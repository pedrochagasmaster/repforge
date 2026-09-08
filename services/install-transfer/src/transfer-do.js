import { DurableObject } from "cloudflare:workers";
import {
  AEAD_NONCE_BYTES,
  AEAD_SALT_BYTES,
  RECORD_SCHEMA_VERSION,
  base64UrlDecode,
  base64UrlEncode,
  constantTimeEqual,
  decryptJson,
  encryptJson,
  recordAssociatedData,
} from "./crypto.js";
import {
  digestClaimId,
  digestIdempotencyKey,
  digestToken,
  mintToken,
  verifyToken,
} from "./routing.js";
import {
  canClaim,
  canCommit,
  expiryForCreate,
  isTerminal,
  LIVE_WINDOW_MS,
  nextAlarmAt,
  tombstoneUntil,
  TRANSFER_STATES,
  transitionForTime,
} from "./lifetime.js";

const TABLE = "transfer_record";
const ACTIVE_STATES = new Set([TRANSFER_STATES.AVAILABLE, TRANSFER_STATES.CLAIMING]);

class RecordIntegrityError extends Error {
  constructor() {
    super("transfer record integrity check failed");
    this.name = "RecordIntegrityError";
  }
}

const CREATE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    state TEXT NOT NULL,
    record_version INTEGER,
    transfer_id TEXT,
    idempotency_digest TEXT,
    token_digest TEXT NOT NULL,
    envelope_ciphertext TEXT,
    envelope_salt TEXT,
    envelope_nonce TEXT,
    envelope_aad TEXT,
    claim_digest TEXT,
    expires_at INTEGER NOT NULL,
    tombstone_until INTEGER NOT NULL,
    created_at INTEGER,
    claimed_at INTEGER
  )
`;

function keyFromEnv(env, name) {
  const value = env[name];
  if (value instanceof Uint8Array) return value;
  if (typeof value !== "string" || value.length === 0) throw new Error(`missing ${name}`);
  const decoded = base64UrlDecode(value);
  if (decoded.length < 32) throw new Error(`${name} must contain at least 256 bits`);
  return decoded;
}

function keyMapFromEnv(env) {
  const activeId = env.TRANSFER_TOKEN_MAC_KEY_ID;
  const activeKey = env.TRANSFER_TOKEN_MAC_KEY_B64;
  if (typeof activeId !== "string" || !activeId || typeof activeKey !== "string") throw new Error("missing active token MAC key");
  const result = new Map([[activeId, keyFromEnv(env, "TRANSFER_TOKEN_MAC_KEY_B64")]]);
  if (env.TRANSFER_TOKEN_MAC_PREVIOUS_KEY_ID && env.TRANSFER_TOKEN_MAC_PREVIOUS_KEY_B64) {
    result.set(env.TRANSFER_TOKEN_MAC_PREVIOUS_KEY_ID, keyFromEnv(env, "TRANSFER_TOKEN_MAC_PREVIOUS_KEY_B64"));
  }
  return result;
}

function requireNow(now) {
  if (!Number.isSafeInteger(now)) throw new TypeError("now must be a safe integer");
  return now;
}

function publicUnavailable() {
  return { kind: "unavailable" };
}

function lifetimeRecord(record) {
  return {
    state: record.state,
    expiresAt: record.expires_at,
    tombstoneUntil: record.tombstone_until,
  };
}

export class TransferDurableObject extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.transferId = ctx.id.toString();
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(CREATE_SCHEMA);
      const columns = new Set(ctx.storage.sql.exec(`PRAGMA table_info(${TABLE})`).toArray().map((column) => column.name));
      if (!columns.has("record_version")) ctx.storage.sql.exec(`ALTER TABLE ${TABLE} ADD COLUMN record_version INTEGER`);
      if (!columns.has("transfer_id")) ctx.storage.sql.exec(`ALTER TABLE ${TABLE} ADD COLUMN transfer_id TEXT`);
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

  _assertActiveRecord(record) {
    if (!ACTIVE_STATES.has(record.state) || record.record_version !== RECORD_SCHEMA_VERSION || record.transfer_id !== this.transferId) {
      throw new RecordIntegrityError();
    }
    if (typeof record.token_digest !== "string" || record.token_digest.length === 0) throw new RecordIntegrityError();
    if (typeof record.idempotency_digest !== "string" || record.idempotency_digest.length === 0) throw new RecordIntegrityError();
    if (!Number.isSafeInteger(record.created_at) || !Number.isSafeInteger(record.expires_at)) throw new RecordIntegrityError();
    if (record.expires_at < record.created_at || record.expires_at > record.created_at + LIVE_WINDOW_MS) throw new RecordIntegrityError();
    if (record.tombstone_until !== tombstoneUntil(record.expires_at)) throw new RecordIntegrityError();
    if (record.state === TRANSFER_STATES.AVAILABLE) {
      if (record.claim_digest !== null || record.claimed_at !== null) throw new RecordIntegrityError();
    } else if (typeof record.claim_digest !== "string" || record.claim_digest.length === 0 || !Number.isSafeInteger(record.claimed_at)) {
      throw new RecordIntegrityError();
    }
    let salt;
    let nonce;
    let ciphertext;
    let storedAad;
    try {
      salt = base64UrlDecode(record.envelope_salt);
      nonce = base64UrlDecode(record.envelope_nonce);
      ciphertext = base64UrlDecode(record.envelope_ciphertext);
      storedAad = base64UrlDecode(record.envelope_aad);
    } catch {
      throw new RecordIntegrityError();
    }
    if (salt.length !== AEAD_SALT_BYTES || nonce.length !== AEAD_NONCE_BYTES || ciphertext.length < 16) {
      throw new RecordIntegrityError();
    }
    const expectedAad = recordAssociatedData({
      schemaVersion: record.record_version,
      transferId: record.transfer_id,
      createdAt: record.created_at,
      expiresAt: record.expires_at,
    });
    if (!constantTimeEqual(storedAad, expectedAad) || record.envelope_aad !== base64UrlEncode(expectedAad)) {
      throw new RecordIntegrityError();
    }
  }

  _assertTerminalRecord(record) {
    if (!isTerminal(record.state) || typeof record.token_digest !== "string" || record.token_digest.length === 0) {
      throw new RecordIntegrityError();
    }
    if (!Number.isSafeInteger(record.expires_at) || record.tombstone_until !== tombstoneUntil(record.expires_at)) {
      throw new RecordIntegrityError();
    }
    for (const field of [
      "record_version",
      "transfer_id",
      "idempotency_digest",
      "envelope_ciphertext",
      "envelope_salt",
      "envelope_nonce",
      "envelope_aad",
      "claim_digest",
      "created_at",
      "claimed_at",
    ]) {
      if (record[field] !== null) throw new RecordIntegrityError();
    }
  }

  _assertRecord(record) {
    if (ACTIVE_STATES.has(record.state)) this._assertActiveRecord(record);
    else this._assertTerminalRecord(record);
  }

  _insert(record) {
    this.ctx.storage.sql.exec(
      `INSERT INTO ${TABLE} (
        singleton, state, record_version, transfer_id, idempotency_digest, token_digest,
        envelope_ciphertext, envelope_salt, envelope_nonce, envelope_aad,
        claim_digest, expires_at, tombstone_until, created_at, claimed_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.state,
      record.record_version,
      record.transfer_id,
      record.idempotency_digest,
      record.token_digest,
      record.envelope_ciphertext,
      record.envelope_salt,
      record.envelope_nonce,
      record.envelope_aad,
      record.claim_digest,
      record.expires_at,
      record.tombstone_until,
      record.created_at,
      record.claimed_at,
    );
  }

  _setClaim(record, claimDigest, now) {
    const changed = this._execWrite(
      `UPDATE ${TABLE} SET state = ?, claim_digest = ?, claimed_at = ?
       WHERE singleton = 1 AND state = ? AND token_digest = ? AND claim_digest IS NULL
         AND expires_at = ? AND ? < expires_at`,
      TRANSFER_STATES.CLAIMING,
      claimDigest,
      now,
      record.state,
      record.token_digest,
      record.expires_at,
      now,
    );
    if (changed !== 1) return null;
    return { ...record, state: TRANSFER_STATES.CLAIMING, claim_digest: claimDigest, claimed_at: now };
  }

  _setTerminal(record, state) {
    const changed = this._execWrite(
      `UPDATE ${TABLE}
       SET state = ?, envelope_ciphertext = NULL, envelope_salt = NULL,
           envelope_nonce = NULL, envelope_aad = NULL, claim_digest = NULL,
           idempotency_digest = NULL, created_at = NULL, claimed_at = NULL,
           record_version = NULL, transfer_id = NULL
       WHERE singleton = 1 AND state = ? AND token_digest = ?
         AND expires_at = ? AND tombstone_until = ?`,
      state,
      record.state,
      record.token_digest,
      record.expires_at,
      record.tombstone_until,
    );
    if (changed !== 1) return null;
    return {
      ...record,
      state,
      record_version: null,
      transfer_id: null,
      envelope_ciphertext: null,
      envelope_salt: null,
      envelope_nonce: null,
      envelope_aad: null,
      claim_digest: null,
      idempotency_digest: null,
      created_at: null,
      claimed_at: null,
    };
  }

  _deleteTombstone(record, now) {
    return this._execWrite(
      `DELETE FROM ${TABLE}
       WHERE singleton = 1 AND state = ? AND token_digest = ?
         AND expires_at = ? AND tombstone_until = ? AND tombstone_until <= ?`,
      record.state,
      record.token_digest,
      record.expires_at,
      record.tombstone_until,
      now,
    ) === 1;
  }

  async _schedule(record, now) {
    const alarmAt = nextAlarmAt(lifetimeRecord(record), now);
    if (alarmAt === null) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(new Date(alarmAt));
  }

  async _expireIfDue(now) {
    for (;;) {
      const record = this._read();
      if (!record) return null;
      this._assertRecord(record);
      if (isTerminal(record.state)) {
        if (now < record.tombstone_until) return record;
        if (this._deleteTombstone(record, now)) {
          await this.ctx.storage.deleteAlarm();
          return null;
        }
        // A concurrent transition or purge won the conditional delete. Read
        // the winner before exposing a stale terminal record.
        continue;
      }
      const nextState = transitionForTime(lifetimeRecord(record), now);
      if (nextState === null) return record;
      const transitioned = this._setTerminal(record, nextState);
      if (transitioned === null) continue;
      await this._schedule(transitioned, now);
      return transitioned;
    }
  }

  async createRecord({ idempotencyKey, envelopeJson, now = Date.now(), requestedExpiry }) {
    requireNow(now);
    if (typeof envelopeJson !== "string" || envelopeJson.length === 0) throw new TypeError("envelopeJson must be a non-empty JSON string");
    const digestKey = keyFromEnv(this.env, "TRANSFER_DIGEST_KEY_B64");
    const idempotencyDigest = await digestIdempotencyKey(idempotencyKey, digestKey);
    let existing;
    try {
      existing = await this._expireIfDue(now);
    } catch (error) {
      if (error instanceof RecordIntegrityError) return publicUnavailable();
      throw error;
    }
    if (existing) {
      if (existing.state === TRANSFER_STATES.AVAILABLE || existing.state === TRANSFER_STATES.CLAIMING) {
        if (existing.idempotency_digest !== idempotencyDigest) return { kind: "collision" };
        return { kind: "duplicate", expiresAt: existing.expires_at };
      }
      return { kind: "terminal", state: existing.state, expiresAt: existing.expires_at };
    }

    const expiresAt = expiryForCreate(now, requestedExpiry);
    const tokenMacKeyId = this.env.TRANSFER_TOKEN_MAC_KEY_ID;
    const tokenMacKey = keyFromEnv(this.env, "TRANSFER_TOKEN_MAC_KEY_B64");
    const routingKey = keyFromEnv(this.env, "TRANSFER_ROUTING_KEY_B64");
    const { token } = await mintToken({
      idempotencyKey,
      routingSecret: routingKey,
      tokenMacSecret: tokenMacKey,
      keyId: tokenMacKeyId,
    });
    const tokenDigest = await digestToken(token, digestKey);
    const associatedData = recordAssociatedData({
      transferId: this.transferId,
      createdAt: now,
      expiresAt,
    });
    const encrypted = await encryptJson({ token, value: envelopeJson, associatedData });

    // A same-key retry can race the first request while crypto is in flight.
    // Re-read before inserting so one route never creates competing records.
    try {
      existing = await this._expireIfDue(now);
    } catch (error) {
      if (error instanceof RecordIntegrityError) return publicUnavailable();
      throw error;
    }
    if (existing) {
      if (existing.state === TRANSFER_STATES.AVAILABLE || existing.state === TRANSFER_STATES.CLAIMING) {
        if (existing.idempotency_digest !== idempotencyDigest) return { kind: "collision" };
        return { kind: "duplicate", expiresAt: existing.expires_at };
      }
      return { kind: "terminal", state: existing.state, expiresAt: existing.expires_at };
    }

    const record = {
      state: TRANSFER_STATES.AVAILABLE,
      record_version: RECORD_SCHEMA_VERSION,
      transfer_id: this.transferId,
      idempotency_digest: idempotencyDigest,
      token_digest: tokenDigest,
      envelope_ciphertext: encrypted.ciphertext,
      envelope_salt: encrypted.salt,
      envelope_nonce: encrypted.nonce,
      envelope_aad: encrypted.associatedData,
      claim_digest: null,
      expires_at: expiresAt,
      tombstone_until: tombstoneUntil(expiresAt),
      created_at: now,
      claimed_at: null,
    };
    this._insert(record);
    try {
      await this._schedule(record, now);
    } catch (error) {
      this._execWrite(
        `DELETE FROM ${TABLE} WHERE singleton = 1 AND state = ? AND token_digest = ?`,
        TRANSFER_STATES.AVAILABLE,
        tokenDigest,
      );
      throw new Error("expiry alarm unavailable", { cause: error });
    }
    return { kind: "created", token, expiresAt };
  }

  async claimRecord({ token, claimId, now = Date.now() }) {
    requireNow(now);
    let parsed;
    try {
      parsed = await verifyToken(token, keyMapFromEnv(this.env));
    } catch {
      return publicUnavailable();
    }
    const digestKey = keyFromEnv(this.env, "TRANSFER_DIGEST_KEY_B64");
    const tokenDigest = await digestToken(token, digestKey);
    const claimDigest = await digestClaimId(claimId, digestKey);
    let record;
    try {
      record = await this._expireIfDue(now);
    } catch (error) {
      if (error instanceof RecordIntegrityError) return publicUnavailable();
      throw error;
    }
    if (!record || record.token_digest !== tokenDigest || parsed.route.length !== 32) return publicUnavailable();
    if (canClaim(lifetimeRecord(record), now)) {
      const claimed = this._setClaim(record, claimDigest, now);
      if (claimed !== null) {
        record = claimed;
      } else {
        try {
          record = await this._expireIfDue(now);
        } catch (error) {
          if (error instanceof RecordIntegrityError) return publicUnavailable();
          throw error;
        }
        if (!record || record.token_digest !== tokenDigest) return publicUnavailable();
      }
    } else if (!(record.state === TRANSFER_STATES.CLAIMING && record.claim_digest === claimDigest && canCommit(lifetimeRecord(record), now))) {
      return publicUnavailable();
    }
    if (!(record.state === TRANSFER_STATES.CLAIMING && record.claim_digest === claimDigest && canCommit(lifetimeRecord(record), now))) {
      return publicUnavailable();
    }
    try {
      this._assertActiveRecord(record);
      const envelopeJson = await decryptJson({
        token,
        record: {
          version: 1,
          salt: record.envelope_salt,
          nonce: record.envelope_nonce,
          associatedData: record.envelope_aad,
          ciphertext: record.envelope_ciphertext,
        },
      });
      return { kind: "claimed", envelopeJson, expiresAt: record.expires_at };
    } catch {
      return publicUnavailable();
    }
  }

  async commitRecord({ token, claimId, now = Date.now() }) {
    requireNow(now);
    try {
      await verifyToken(token, keyMapFromEnv(this.env));
    } catch {
      return publicUnavailable();
    }
    const digestKey = keyFromEnv(this.env, "TRANSFER_DIGEST_KEY_B64");
    const tokenDigest = await digestToken(token, digestKey);
    const claimDigest = await digestClaimId(claimId, digestKey);
    let record;
    try {
      record = await this._expireIfDue(now);
    } catch (error) {
      if (error instanceof RecordIntegrityError) return publicUnavailable();
      throw error;
    }
    if (!record || record.token_digest !== tokenDigest) return publicUnavailable();
    if (record.state === TRANSFER_STATES.DELETED) return { kind: "deleted", state: TRANSFER_STATES.DELETED, expiresAt: record.expires_at };
    if (!canCommit(lifetimeRecord(record), now) || record.claim_digest !== claimDigest) return publicUnavailable();
    const deleted = this._setTerminal(record, TRANSFER_STATES.DELETED);
    if (deleted === null) {
      try {
        record = await this._expireIfDue(now);
      } catch (error) {
        if (error instanceof RecordIntegrityError) return publicUnavailable();
        throw error;
      }
      if (record?.state === TRANSFER_STATES.DELETED && record.token_digest === tokenDigest) {
        return { kind: "deleted", state: TRANSFER_STATES.DELETED, expiresAt: record.expires_at };
      }
      return publicUnavailable();
    }
    await this._schedule(deleted, now);
    return { kind: "deleted", state: TRANSFER_STATES.DELETED, expiresAt: deleted.expires_at };
  }

  async statusRecord({ token, now = Date.now() }) {
    requireNow(now);
    try {
      await verifyToken(token, keyMapFromEnv(this.env));
    } catch {
      return publicUnavailable();
    }
    const digestKey = keyFromEnv(this.env, "TRANSFER_DIGEST_KEY_B64");
    const tokenDigest = await digestToken(token, digestKey);
    let record;
    try {
      record = await this._expireIfDue(now);
    } catch (error) {
      if (error instanceof RecordIntegrityError) return publicUnavailable();
      throw error;
    }
    if (!record || record.token_digest !== tokenDigest) return publicUnavailable();
    return { kind: "status", state: record.state, expiresAt: record.expires_at };
  }

  // The authenticated operations runbook invokes this RPC with a routed
  // object stub. It never enumerates objects or accepts a bearer in a URL.
  async purgeDue({ now = Date.now() } = {}) {
    requireNow(now);
    try {
      const record = await this._expireIfDue(now);
      if (!record) return { purged: true };
      return { purged: false, state: record.state };
    } catch (error) {
      if (error instanceof RecordIntegrityError) return { purged: false, state: "unavailable" };
      throw error;
    }
  }

  async alarm() {
    const now = Date.now();
    try {
      const record = await this._expireIfDue(now);
      if (record) await this._schedule(record, now);
    } catch (error) {
      if (!(error instanceof RecordIntegrityError)) throw error;
    }
  }
}
