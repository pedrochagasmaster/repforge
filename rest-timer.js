(function restTimerModule(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeRestTimer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function restTimerFactory() {
  "use strict";

  /** The longest rest a lifter can arm, and the longest a nudge can put on the clock, in seconds. */
  const MAX_SEC = 60 * 60;
  /** Past the bell the count-up reads up to this many seconds, and then nothing ticks. */
  const OVERTIME_MAX_SEC = 60 * 60;

  /** What a transition asks the host to do besides keeping the state. */
  const EFFECTS = Object.freeze({ BELL: "bell", REARMED: "rearmed", CLEARED: "cleared" });
  const PHASES = Object.freeze(["idle", "running", "overtime", "capped", "paused", "paused-overtime"]);
  const NO_EFFECTS = Object.freeze([]);

  // Stored states. A running clock keeps its deadline and nothing else time-dependent: overtime and the cap are read from
  // the deadline by view(), so no stored phase can go stale. `rang` is whether the bell has been settled for this deadline.
  //   { kind: "idle", lengthSec }
  //   { kind: "running", deadlineMs, lengthSec, exerciseId, rang }
  //   { kind: "paused", remainingMs, lengthSec, exerciseId, rang }   remainingMs <= 0 is paused overtime

  function freeze(state) {
    return Object.freeze(state);
  }

  function result(state, effects) {
    return Object.freeze({ state, effects });
  }

  function unchanged(state) {
    return result(state, NO_EFFECTS);
  }

  function createRestClock(lengthSec = 0) {
    return freeze({ kind: "idle", lengthSec });
  }

  /** What the clock reads at `now`. Idle has no time left: the caller reads the plan for it. */
  function view(state, now) {
    if (state.kind === "idle") {
      return freeze({ phase: "idle", active: false, held: false, rang: false, ticking: false, lengthSec: state.lengthSec,
        exerciseId: null, leftMs: null, leftSec: null, done: false, overSec: 0 });
    }
    const held = state.kind === "paused";
    const leftMs = held ? state.remainingMs : state.deadlineMs - now;
    const leftSec = Math.round(leftMs / 1000);
    const done = leftSec <= 0;
    const overSec = Math.max(0, -leftSec);
    let phase;
    if (held) phase = done ? "paused-overtime" : "paused";
    else if (!done) phase = "running";
    else phase = overSec >= OVERTIME_MAX_SEC ? "capped" : "overtime";
    return freeze({ phase, active: true, held, rang: state.rang, ticking: phase === "running" || phase === "overtime",
      lengthSec: state.lengthSec, exerciseId: state.exerciseId, leftMs, leftSec, done, overSec });
  }

  /** A new rest: the deadline is `sec` from now, and the bell is armed for that deadline. Nothing without a length. */
  function start(state, { sec, exerciseId = null, now }) {
    if (!(sec > 0)) return unchanged(state);
    return result(freeze({ kind: "running", deadlineMs: now + sec * 1000, lengthSec: sec, exerciseId, rang: false }),
      [EFFECTS.REARMED]);
  }

  /** Hold a running clock where it stands, or let a held one run again from its remainder. */
  function toggleHold(state, now) {
    if (state.kind === "running") {
      const remainingMs = state.deadlineMs - now;
      return result(freeze({ kind: "paused", remainingMs, lengthSec: state.lengthSec, exerciseId: state.exerciseId, rang: state.rang,
        expiresAt: now + remainingMs + OVERTIME_MAX_SEC * 1000 }), NO_EFFECTS);
    }
    if (state.kind === "paused") {
      return result(freeze({ kind: "running", deadlineMs: now + state.remainingMs, lengthSec: state.lengthSec,
        exerciseId: state.exerciseId, rang: state.rang }), NO_EFFECTS);
    }
    return unchanged(state);
  }

  /**
   * Put `ms` on the clock: a new deadline when running, the remainder when held. `held` may switch which it is. A time
   * above zero is a new bell to ring, so it re-arms the notices; a time at or below zero keeps the bell spent.
   */
  function setRemaining(state, { ms, now, lengthSec, held }) {
    if (state.kind === "idle") return unchanged(state);
    const length = lengthSec === undefined ? state.lengthSec : lengthSec;
    const nextHeld = held === undefined ? state.kind === "paused" : held;
    const rang = ms > 0 ? false : state.rang;
    // A held rest keeps the expiry it was first held with: moving its remainder while held does not renew it.
    const expires = state.kind === "paused" && state.expiresAt !== undefined ? state.expiresAt : now + ms + OVERTIME_MAX_SEC * 1000;
    const next = nextHeld
      ? { kind: "paused", remainingMs: ms, lengthSec: length, exerciseId: state.exerciseId, rang, expiresAt: expires }
      : { kind: "running", deadlineMs: now + ms, lengthSec: length, exerciseId: state.exerciseId, rang };
    return result(freeze(next), ms > 0 ? [EFFECTS.REARMED] : NO_EFFECTS);
  }

  /** A ±nudge on a rest that is armed. The ring's full turn grows only when the time left goes past it. */
  function nudge(state, { deltaSec, now }) {
    if (state.kind === "idle") return unchanged(state);
    const v = view(state, now);
    const ms = Math.min(MAX_SEC * 1000, Math.max(-OVERTIME_MAX_SEC * 1000, v.leftMs + deltaSec * 1000));
    const left = Math.ceil(ms / 1000);
    const lengthSec = left > v.lengthSec ? Math.min(MAX_SEC, left) : v.lengthSec;
    return setRemaining(state, { ms, now, lengthSec });
  }

  /** The length the next rest runs for (idle), or the ring's full turn (armed). The clock does not move. */
  function setLength(state, sec) {
    return result(freeze({ ...state, lengthSec: sec }), NO_EFFECTS);
  }

  /** The time-driven step: the bell, once for a deadline, as soon as it has passed. Called by every tick and catch-up. */
  function settle(state, now) {
    if (state.kind !== "running" || state.rang) return unchanged(state);
    if (!view(state, now).done) return unchanged(state);
    return result(freeze({ ...state, rang: true }), [EFFECTS.BELL]);
  }

  /** End the rest. The clock is idle again with no armed length. */
  function stop() {
    return result(createRestClock(0), [EFFECTS.CLEARED]);
  }

  /** The armed clock as plain data a reload can read back, or null when idle. The deadline or held remainder is all the time it keeps. */
  function snapshot(state, now) {
    if (state.kind === "idle") return null;
    const { lengthSec, exerciseId, rang } = state;
    const expires = expiresAt(state, now);
    return state.kind === "paused"
      ? { kind: "paused", remainingMs: state.remainingMs, lengthSec, exerciseId, rang, expiresAt: expires }
      : { kind: "running", deadlineMs: state.deadlineMs, lengthSec, exerciseId, rang, expiresAt: expires };
  }

  /**
   * The wall time after which a snapshot of this clock is no longer worth restoring: the moment its count-up reaches the
   * one-hour cap, measured on the clock's own timeline. A running rest runs out from its deadline. A held rest is measured
   * as if it had kept running from `now`, so holding it does not keep it alive for longer than the cap allows.
   */
  function expiresAt(state, now) {
    if (state.kind === "idle") return null;
    if (state.kind === "paused") return state.expiresAt ?? now + state.remainingMs + OVERTIME_MAX_SEC * 1000;
    return state.deadlineMs + OVERTIME_MAX_SEC * 1000;
  }

  /**
   * Whether a saved snapshot describes a clock this device could have written: well formed, its expiry agreeing with its
   * own deadline (a running rest) or with its remainder and the moment it was written (a held one), and its time left
   * within the rest maximum. Only a snapshot that passes is restored, adopted from another tab, or trusted for the cap.
   */
  function snapshotValid(saved, now) {
    if (saved === null || typeof saved !== "object" || !Number.isFinite(now)) return false;
    const { kind, lengthSec, rang, expiresAt: expires } = saved;
    const exerciseId = saved.exerciseId ?? null;
    if (!(Number.isFinite(lengthSec) && lengthSec >= 0 && lengthSec <= MAX_SEC)) return false;
    if (!((exerciseId === null || typeof exerciseId === "string") && typeof rang === "boolean" && Number.isFinite(expires))) return false;
    if (kind === "running") {
      return Number.isFinite(saved.deadlineMs) && expires === saved.deadlineMs + OVERTIME_MAX_SEC * 1000
        && saved.deadlineMs - now <= MAX_SEC * 1000;
    }
    if (kind === "paused") {
      const remaining = saved.remainingMs;
      const writtenAt = expires - remaining - OVERTIME_MAX_SEC * 1000;
      return Number.isFinite(remaining) && remaining <= MAX_SEC * 1000 && remaining >= -OVERTIME_MAX_SEC * 1000 && writtenAt <= now;
    }
    return false;
  }

  /** A valid running snapshot whose count-up has reached the one-hour cap by `now`: its rest ends, and the question may open. */
  function capReached(saved, now) {
    return saved?.kind === "running" && snapshotValid(saved, now) && now >= saved.expiresAt;
  }

  /** The live clock a valid snapshot describes, or null. Malformed, expired and capped snapshots describe no live clock. */
  function fromSnapshot(saved, now) {
    if (!snapshotValid(saved, now) || saved.expiresAt <= now) return null;
    const common = { lengthSec: saved.lengthSec, exerciseId: saved.exerciseId ?? null, rang: saved.rang };
    return freeze(saved.kind === "paused"
      ? { kind: "paused", remainingMs: saved.remainingMs, expiresAt: saved.expiresAt, ...common }
      : { kind: "running", deadlineMs: saved.deadlineMs, ...common });
  }

  /**
   * Put back a clock read from a snapshot after a reload: the same deadline or held remainder, and the same bell. Only an
   * idle clock takes one, and only a live, valid snapshot. No effect is named, because a restored clock is the same rest,
   * not a new one: its bell was settled before the reload, or is still due.
   */
  function restore(state, saved, now) {
    if (state.kind !== "idle") return unchanged(state);
    const clock = fromSnapshot(saved, now);
    return clock ? result(clock, NO_EFFECTS) : unchanged(state);
  }

  return Object.freeze({
    MAX_SEC,
    OVERTIME_MAX_SEC,
    EFFECTS,
    PHASES,
    createRestClock,
    view,
    start,
    toggleHold,
    setRemaining,
    nudge,
    setLength,
    settle,
    stop,
    snapshot,
    expiresAt,
    snapshotValid,
    capReached,
    fromSnapshot,
    restore,
  });
});
