import { DurableObject } from "cloudflare:workers";
import { euStub } from "./namespaces.js";
import { LIVE_WINDOW_MS, TOMBSTONE_MARGIN_MS, tombstoneUntil, TRANSFER_STATES } from "./lifetime.js";

export const REGISTRY_BATCH_LIMIT = 100;
export const REGISTRY_RETRY_MS = 60_000;
export const REGISTRY_RESERVATION_MS = LIVE_WINDOW_MS + TOMBSTONE_MARGIN_MS;

const TABLE = "transfer_route_registry";
const ROUTE_RE = /^transfer-v1-[A-Za-z0-9_-]{43}$/u;
const PURGE_STATES = new Set(["reserved", "live", "terminal", "deadline-failed"]);

const CREATE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    route_name TEXT PRIMARY KEY,
    reserved_at INTEGER NOT NULL,
    reservation_expires_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    tombstone_until INTEGER NOT NULL,
    next_due_at INTEGER,
    purge_state TEXT NOT NULL
  )
`;

function safeTime(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative safe integer`);
  return value;
}

function routeName(value) {
  if (typeof value !== "string" || !ROUTE_RE.test(value)) throw new TypeError("invalid transfer route");
  return value;
}

function batchLimit(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > REGISTRY_BATCH_LIMIT) {
    throw new RangeError("invalid registry batch limit");
  }
  return value;
}

function purgeState(value) {
  if (typeof value !== "string" || !PURGE_STATES.has(value)) throw new TypeError("invalid registry purge state");
  return value;
}

function minDeadline(now, deadline) {
  return Math.min(now + REGISTRY_RETRY_MS, deadline);
}

export class TransferRouteRegistryDurableObject extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(CREATE_SCHEMA);
      const columns = new Set(ctx.storage.sql.exec(`PRAGMA table_info(${TABLE})`).toArray().map((column) => column.name));
      if (!columns.has("reservation_expires_at")) {
        // Older development rows used expires_at as the reservation deadline.
        // Convert them to a fixed 60-minute live ceiling and 75-minute purge deadline.
        ctx.storage.sql.exec(`ALTER TABLE ${TABLE} ADD COLUMN reservation_expires_at INTEGER NOT NULL DEFAULT 0`);
        ctx.storage.sql.exec(`UPDATE ${TABLE} SET reservation_expires_at = expires_at - ${TOMBSTONE_MARGIN_MS}, expires_at = expires_at - ${TOMBSTONE_MARGIN_MS}, tombstone_until = expires_at + ${TOMBSTONE_MARGIN_MS}`);
      }
      if (!columns.has("purge_state")) {
        ctx.storage.sql.exec(`ALTER TABLE ${TABLE} ADD COLUMN purge_state TEXT NOT NULL DEFAULT 'reserved'`);
      }
    });
  }

  _read(route) {
    return this.ctx.storage.sql.exec(`SELECT * FROM ${TABLE} WHERE route_name = ?`, route).toArray()[0] ?? null;
  }

  _writeRows(cursor) {
    if (typeof cursor?.rowsWritten === "number") return cursor.rowsWritten;
    const row = this.ctx.storage.sql.exec("SELECT changes() AS rows_written").toArray()[0];
    return Number(row?.rows_written ?? 0);
  }

  _execWrite(sql, ...args) {
    return this._writeRows(this.ctx.storage.sql.exec(sql, ...args));
  }

  _listDue(now, limit) {
    return this.ctx.storage.sql.exec(
      `SELECT route_name, reserved_at, reservation_expires_at, expires_at, tombstone_until, next_due_at, purge_state
       FROM ${TABLE} WHERE next_due_at IS NOT NULL AND next_due_at <= ?
       ORDER BY next_due_at, route_name LIMIT ?`,
      now,
      limit,
    ).toArray();
  }

  async _scheduleNext() {
    const row = this.ctx.storage.sql.exec(`SELECT MIN(next_due_at) AS next_due_at FROM ${TABLE} WHERE next_due_at IS NOT NULL`).toArray()[0];
    if (!Number.isSafeInteger(row?.next_due_at)) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(new Date(row.next_due_at));
  }

  async _markPurgeUnhealthy() {
    try {
      const health = this.env.TRANSFER_HEALTH
        ? euStub(this.env.TRANSFER_HEALTH, "global", { allowLocalFallback: this.env.TRANSFER_LOCAL_TEST_EU === "true" })
        : null;
      if (health?.markDeletionUnhealthy) await health.markDeletionUnhealthy();
    } catch {
      // Create admission is already fail-closed if health reporting is unavailable.
    }
  }

  async reserveRoute({ routeName: value, now = Date.now() }) {
    const route = routeName(value);
    safeTime(now, "now");
    const existing = this._read(route);
    if (existing) {
      if (!PURGE_STATES.has(existing.purge_state)) throw new Error("registry metadata is corrupt");
      if (existing.purge_state === "deadline-failed" || now >= existing.tombstone_until) {
        throw new Error("transfer route missed its purge deadline");
      }
      if (existing.purge_state === "reserved" && now >= existing.reservation_expires_at) {
        throw new Error("transfer route reservation expired");
      }
      await this._scheduleNext();
      return {
        ok: true,
        reservationExpiresAt: existing.reservation_expires_at,
        maxTransferExpiresAt: existing.reservation_expires_at,
        existing: true,
      };
    }

    const reservationExpiresAt = now + LIVE_WINDOW_MS;
    const tombstone = reservationExpiresAt + TOMBSTONE_MARGIN_MS;
    this._execWrite(
      `INSERT INTO ${TABLE} (route_name, reserved_at, reservation_expires_at, expires_at, tombstone_until, next_due_at, purge_state)
       VALUES (?, ?, ?, ?, ?, ?, 'reserved')`,
      route,
      now,
      reservationExpiresAt,
      reservationExpiresAt,
      tombstone,
      reservationExpiresAt,
    );
    await this._scheduleNext();
    return { ok: true, reservationExpiresAt, maxTransferExpiresAt: reservationExpiresAt, existing: false };
  }

  async setLifetime({ routeName: value, expiresAt, state = TRANSFER_STATES.AVAILABLE, now = Date.now() }) {
    const route = routeName(value);
    safeTime(expiresAt, "expiresAt");
    safeTime(now, "now");
    purgeState(state === TRANSFER_STATES.AVAILABLE || state === TRANSFER_STATES.CLAIMING ? "live" : "terminal");
    const existing = this._read(route);
    if (!existing) throw new Error("transfer route reservation missing");
    if (existing.purge_state === "deadline-failed" || now >= existing.tombstone_until) {
      throw new Error("transfer route missed its purge deadline");
    }
    const nextTombstone = tombstoneUntil(expiresAt);
    if (expiresAt > existing.reservation_expires_at || nextTombstone > existing.tombstone_until) {
      throw new Error("transfer lifetime exceeds its fixed reservation");
    }
    const changed = this._execWrite(
      `UPDATE ${TABLE}
       SET expires_at = ?, tombstone_until = ?, next_due_at = ?, purge_state = ?
       WHERE route_name = ? AND purge_state != 'deadline-failed'`,
      expiresAt,
      nextTombstone,
      expiresAt,
      state === TRANSFER_STATES.AVAILABLE || state === TRANSFER_STATES.CLAIMING ? "live" : "terminal",
      route,
    );
    if (changed !== 1) throw new Error("transfer route reservation missing");
    await this._scheduleNext();
    return { ok: true };
  }

  async _removeRoute(route) {
    this._execWrite(`DELETE FROM ${TABLE} WHERE route_name = ?`, route);
  }

  async _advanceRoute(route, nextDueAt) {
    if (nextDueAt !== null) safeTime(nextDueAt, "nextDueAt");
    this._execWrite(`UPDATE ${TABLE} SET next_due_at = ? WHERE route_name = ?`, nextDueAt, route);
  }

  async _markDeadlineFailure(route) {
    this._execWrite(
      `UPDATE ${TABLE} SET purge_state = 'deadline-failed', next_due_at = NULL WHERE route_name = ?`,
      route,
    );
    await this._markPurgeUnhealthy();
  }

  async purgeDue({ now = Date.now(), limit = REGISTRY_BATCH_LIMIT } = {}) {
    safeTime(now, "now");
    const batch = batchLimit(limit);
    const due = this._listDue(now, batch);
    let purged = 0;
    let failed = 0;
    for (const entry of due) {
      let result;
      try {
        const transfer = this.env.TRANSFER_OBJECTS
          ? euStub(this.env.TRANSFER_OBJECTS, entry.route_name, { allowLocalFallback: this.env.TRANSFER_LOCAL_TEST_EU === "true" })
          : null;
        if (!transfer) throw new Error("transfer binding unavailable");
        result = await transfer.purgeDue({ now });
      } catch {
        failed += 1;
        if (now >= entry.tombstone_until) {
          await this._markDeadlineFailure(entry.route_name);
        } else {
          try { await this._advanceRoute(entry.route_name, minDeadline(now, entry.tombstone_until)); } catch { /* health remains latched */ }
        }
        continue;
      }
      if (result?.purged === true) {
        await this._removeRoute(entry.route_name);
        purged += 1;
        continue;
      }
      if (now >= entry.tombstone_until) {
        failed += 1;
        await this._markDeadlineFailure(entry.route_name);
        continue;
      }
      let nextDueAt = minDeadline(now, entry.tombstone_until);
      if (Number.isSafeInteger(result?.expiresAt)) {
        const providerDeadline = result.state === TRANSFER_STATES.AVAILABLE || result.state === TRANSFER_STATES.CLAIMING
          ? result.expiresAt
          : (Number.isSafeInteger(result.tombstoneUntil) ? result.tombstoneUntil : tombstoneUntil(result.expiresAt));
        nextDueAt = Math.min(providerDeadline, entry.tombstone_until);
        if (nextDueAt <= now) nextDueAt = minDeadline(now, entry.tombstone_until);
      }
      await this._advanceRoute(entry.route_name, nextDueAt);
    }
    if (failed > 0) await this._markPurgeUnhealthy();
    await this._scheduleNext();
    const remainingRow = this.ctx.storage.sql.exec(
      `SELECT COUNT(*) AS count FROM ${TABLE} WHERE next_due_at IS NOT NULL AND next_due_at <= ?`,
      now,
    ).toArray()[0];
    return {
      examined: due.length,
      purged,
      failed,
      remainingDue: Number(remainingRow?.count ?? 0),
    };
  }

  async alarm() {
    try {
      await this.purgeDue({ now: Date.now(), limit: REGISTRY_BATCH_LIMIT });
    } catch {
      await this._markPurgeUnhealthy();
      // Per-route retries are bounded by the 75-minute row deadline. A
      // registry-wide storage failure has no trustworthy route deadline, so
      // it is left to the authenticated purge runbook rather than retried
      // forever by an alarm.
      try { await this.ctx.storage.deleteAlarm(); } catch { /* health remains latched */ }
    }
  }
}
