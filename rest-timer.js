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
      return result(freeze({ kind: "paused", remainingMs: state.deadlineMs - now, lengthSec: state.lengthSec,
        exerciseId: state.exerciseId, rang: state.rang }), NO_EFFECTS);
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
    const next = nextHeld
      ? { kind: "paused", remainingMs: ms, lengthSec: length, exerciseId: state.exerciseId, rang }
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
    return state.kind === "paused"
      ? now + state.remainingMs + OVERTIME_MAX_SEC * 1000
      : state.deadlineMs + OVERTIME_MAX_SEC * 1000;
  }

  /** The bell was rung by another tab that shares this rest: the clock keeps running with the bell marked rung, and no effect. */
  function consume(state) {
    if (state.kind === "idle") return unchanged(state);
    return result(freeze({ ...state, rang: true }), NO_EFFECTS);
  }

  /**
   * Put back a clock read from a snapshot after a reload: the same deadline or held remainder, and the same bell. Only an
   * idle clock takes one, and only a well-formed snapshot; anything else leaves the clock as it is. No effect is named,
   * because a restored clock is the same rest, not a new one: its bell was settled before the reload, or is still due.
   */
  function restore(state, saved, now) {
    if (state.kind !== "idle" || saved === null || typeof saved !== "object") return unchanged(state);
    const { kind, lengthSec, rang, expiresAt: expires } = saved;
    const exerciseId = saved.exerciseId ?? null;
    const timed = kind === "paused" ? "remainingMs" : kind === "running" ? "deadlineMs" : null;
    const valid = timed !== null && Number.isFinite(saved[timed]) && Number.isFinite(lengthSec) && lengthSec >= 0
      && (exerciseId === null || typeof exerciseId === "string") && typeof rang === "boolean"
      && Number.isFinite(expires) && Number.isFinite(now) && expires > now;
    if (!valid) return unchanged(state);
    const common = { lengthSec, exerciseId, rang };
    return result(freeze(kind === "paused"
      ? { kind, remainingMs: saved.remainingMs, ...common }
      : { kind, deadlineMs: saved.deadlineMs, ...common }), NO_EFFECTS);
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
    restore,
    consume,
  });
});
