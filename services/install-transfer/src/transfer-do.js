import { DurableObject } from "cloudflare:workers";
import { base64UrlDecode, decryptJson, encryptJson } from "./crypto.js";
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
  nextAlarmAt,
  tombstoneUntil,
  TRANSFER_STATES,
  transitionForTime,
} from "./lifetime.js";

const TABLE = "transfer_record";

const CREATE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    state TEXT NOT NULL,
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
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(CREATE_SCHEMA);
    });
  }

  _read() {
    return this.ctx.storage.sql.exec(`SELECT * FROM ${TABLE} WHERE singleton = 1`).toArray()[0] ?? null;
  }

  _insert(record) {
    this.ctx.storage.sql.exec(
      `INSERT INTO ${TABLE} (
        singleton, state, idempotency_digest, token_digest,
        envelope_ciphertext, envelope_salt, envelope_nonce, envelope_aad,
        claim_digest, expires_at, tombstone_until, created_at, claimed_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.state,
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
    this.ctx.storage.sql.exec(
      `UPDATE ${TABLE} SET state = ?, claim_digest = ?, claimed_at = ? WHERE singleton = 1`,
      TRANSFER_STATES.CLAIMING,
      claimDigest,
      now,
    );
    return { ...record, state: TRANSFER_STATES.CLAIMING, claim_digest: claimDigest, claimed_at: now };
  }

  _setTerminal(record, state) {
    this.ctx.storage.sql.exec(
      `UPDATE ${TABLE}
       SET state = ?, envelope_ciphertext = NULL, envelope_salt = NULL,
           envelope_nonce = NULL, envelope_aad = NULL, claim_digest = NULL,
           idempotency_digest = NULL, created_at = NULL, claimed_at = NULL
       WHERE singleton = 1`,
      state,
    );
    return {
      ...record,
      state,
      envelope_ciphertext: null,
      envelope_salt: null,
      envelope_nonce: null,
      envelope_aad: null,
      claim_digest: null,
    };
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
    let record = this._read();
    if (!record) return null;
    if (isTerminal(record.state) && now >= record.tombstone_until) {
      this.ctx.storage.sql.exec(`DELETE FROM ${TABLE} WHERE singleton = 1`);
      await this.ctx.storage.deleteAlarm();
      return null;
    }
    const nextState = transitionForTime(lifetimeRecord(record), now);
    if (nextState !== null) {
      record = this._setTerminal(record, nextState);
      await this._schedule(record, now);
    }
    return record;
  }

  async createRecord({ idempotencyKey, envelopeJson, now = Date.now(), requestedExpiry }) {
    requireNow(now);
    if (typeof envelopeJson !== "string" || envelopeJson.length === 0) throw new TypeError("envelopeJson must be a non-empty JSON string");
    const digestKey = keyFromEnv(this.env, "TRANSFER_DIGEST_KEY_B64");
    const idempotencyDigest = await digestIdempotencyKey(idempotencyKey, digestKey);
    let existing = await this._expireIfDue(now);
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
    const encrypted = await encryptJson({ token, value: envelopeJson });

    // A same-key retry can race the first request while crypto is in flight.
    // Re-read before inserting so one route never creates competing records.
    existing = await this._expireIfDue(now);
    if (existing) {
      if (existing.state === TRANSFER_STATES.AVAILABLE || existing.state === TRANSFER_STATES.CLAIMING) {
        if (existing.idempotency_digest !== idempotencyDigest) return { kind: "collision" };
        return { kind: "duplicate", expiresAt: existing.expires_at };
      }
      return { kind: "terminal", state: existing.state, expiresAt: existing.expires_at };
    }

    const record = {
      state: TRANSFER_STATES.AVAILABLE,
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
      this.ctx.storage.sql.exec(`DELETE FROM ${TABLE} WHERE singleton = 1`);
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
    let record = await this._expireIfDue(now);
    if (!record || record.token_digest !== tokenDigest || parsed.route.length !== 32) return publicUnavailable();
    if (canClaim(lifetimeRecord(record), now)) {
      record = this._setClaim(record, claimDigest, now);
    } else if (!(record.state === TRANSFER_STATES.CLAIMING && record.claim_digest === claimDigest && canCommit(lifetimeRecord(record), now))) {
      return publicUnavailable();
    }
    try {
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
    const record = await this._expireIfDue(now);
    if (!record || record.token_digest !== tokenDigest) return publicUnavailable();
    if (record.state === TRANSFER_STATES.DELETED) return { kind: "deleted", state: TRANSFER_STATES.DELETED, expiresAt: record.expires_at };
    if (!canCommit(lifetimeRecord(record), now) || record.claim_digest !== claimDigest) return publicUnavailable();
    const deleted = this._setTerminal(record, TRANSFER_STATES.DELETED);
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
    const record = await this._expireIfDue(now);
    if (!record || record.token_digest !== tokenDigest) return publicUnavailable();
    return { kind: "status", state: record.state, expiresAt: record.expires_at };
  }

  async alarm() {
    const now = Date.now();
    const record = await this._expireIfDue(now);
    if (record) await this._schedule(record, now);
  }
}
