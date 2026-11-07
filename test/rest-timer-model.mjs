#!/usr/bin/env node
/**
 * Pure rest-clock model (rest-timer.js), with no timers, DOM or storage.
 *
 * Isolation is justified here because the failure modes are transition-order bugs that the browser suite
 * (test/rest-timer.mjs) reaches only slowly and through the real timers:
 *   - a start or a restart must move the deadline and reset the bell for that deadline;
 *   - the bell (announcement and notice) fires once per deadline, however many ticks or catch-ups see it;
 *   - a nudge back above zero re-arms the bell, and a nudge that stays at or below zero does not;
 *   - paused overtime is a real state: it holds the overrun, resumes into overtime, and never rings while held;
 *   - the count-up stops ticking at its cap, and a catch-up after a long hidden stretch rings once and caps;
 *   - stopping returns to idle with the armed length cleared;
 *   - a snapshot read back after a reload restores the same clock, and restoring never rings or re-arms the bell.
 * The browser suite keeps the end-to-end guards; this file owns the transitions.
 */
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const clock = require("../rest-timer.js");

const { createRestClock, view, start, toggleHold, setRemaining, nudge, setLength, settle, stop, snapshot, restore, consume, expiresAt, EFFECTS, OVERTIME_MAX_SEC } = clock;
const T0 = 1_000_000;
const SEC = 1000;
let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${String(error?.message || error).split("\n").slice(0, 6).join("\n    ")}`);
  }
}

function running(sec, now = T0, extra = {}) {
  return start(createRestClock(), { sec, exerciseId: "ex-1", now, ...extra }).state;
}

console.log("Rest clock model");

check("the module exports one clock with the named effects and the one-hour cap", () => {
  assert.equal(typeof createRestClock, "function");
  assert.equal(EFFECTS.BELL, "bell");
  assert.equal(EFFECTS.REARMED, "rearmed");
  assert.equal(EFFECTS.CLEARED, "cleared");
  assert.equal(OVERTIME_MAX_SEC, 3600);
});

check("an idle clock is idle, ticks nothing, and keeps only the armed length", () => {
  const state = createRestClock(90);
  const v = view(state, T0);
  assert.equal(v.phase, "idle");
  assert.equal(v.active, false);
  assert.equal(v.ticking, false);
  assert.equal(v.lengthSec, 90);
});

check("start sets the deadline from now, arms the bell for it, and re-arms the notices", () => {
  const { state, effects } = start(createRestClock(), { sec: 60, exerciseId: "ex-1", now: T0 });
  const v = view(state, T0);
  assert.equal(v.phase, "running");
  assert.equal(v.leftMs, 60 * SEC);
  assert.equal(v.lengthSec, 60);
  assert.equal(v.exerciseId, "ex-1");
  assert.equal(v.rang, false);
  assert.equal(v.ticking, true);
  assert.deepEqual(effects, [EFFECTS.REARMED]);
});

check("start with no length does nothing: no deadline, no effects", () => {
  const idle = createRestClock(60);
  const { state, effects } = start(idle, { sec: 0, exerciseId: "ex-1", now: T0 });
  assert.equal(view(state, T0).active, false);
  assert.equal(state.lengthSec, 60);
  assert.deepEqual(effects, []);
});

check("start while running moves the deadline to the new length (a restart), not to the old one", () => {
  const first = running(120);
  const { state } = start(first, { sec: 30, exerciseId: "ex-1", now: T0 + 40 * SEC });
  const v = view(state, T0 + 40 * SEC);
  assert.equal(v.leftMs, 30 * SEC);
  assert.equal(v.lengthSec, 30);
});

check("start while held runs the clock again from the new length", () => {
  const held = toggleHold(running(120), T0 + 10 * SEC).state;
  const { state } = start(held, { sec: 45, exerciseId: "ex-1", now: T0 + 50 * SEC });
  const v = view(state, T0 + 50 * SEC);
  assert.equal(v.held, false);
  assert.equal(v.leftMs, 45 * SEC);
});

check("the bell comes when the deadline passes, once, and the overrun then counts up in overtime", () => {
  const state = running(60);
  assert.deepEqual(settle(state, T0 + 59 * SEC).effects, []);
  const rung = settle(state, T0 + 60 * SEC);
  assert.deepEqual(rung.effects, [EFFECTS.BELL]);
  assert.equal(view(rung.state, T0 + 60 * SEC).phase, "overtime");
  assert.equal(view(rung.state, T0 + 60 * SEC).rang, true);
  const later = settle(rung.state, T0 + 63 * SEC);
  assert.deepEqual(later.effects, [], "a later tick in overtime does not ring again");
  assert.equal(view(later.state, T0 + 63 * SEC).overSec, 3);
});

check("a catch-up after a long hidden stretch rings once and lands in the cap", () => {
  const caught = settle(running(60), T0 + (60 + 3700) * SEC);
  assert.deepEqual(caught.effects, [EFFECTS.BELL]);
  const v = view(caught.state, T0 + (60 + 3700) * SEC);
  assert.equal(v.phase, "capped");
  assert.equal(v.ticking, false);
  assert.equal(v.overSec, 3700);
});

check("the count-up stops ticking at its cap, and a settle past the cap changes nothing", () => {
  const rung = settle(running(60), T0 + 60 * SEC).state;
  const atCap = T0 + (60 + OVERTIME_MAX_SEC) * SEC;
  assert.equal(view(rung, atCap).phase, "capped");
  assert.equal(view(rung, atCap).ticking, false);
  assert.deepEqual(settle(rung, atCap + 60 * SEC).effects, []);
});

check("a nudge back above zero re-arms the bell: the next deadline rings again", () => {
  const rung = settle(running(60), T0 + 62 * SEC).state;
  const nudged = nudge(rung, { deltaSec: 30, now: T0 + 62 * SEC });
  assert.equal(view(nudged.state, T0 + 62 * SEC).rang, false);
  assert.ok(nudged.effects.includes(EFFECTS.REARMED));
  assert.equal(view(nudged.state, T0 + 62 * SEC).leftMs, 28 * SEC);
  assert.deepEqual(settle(nudged.state, T0 + 90 * SEC).effects, [EFFECTS.BELL]);
});

check("a nudge that stays at or below zero keeps the bell spent: no second ring for the same deadline", () => {
  const rung = settle(running(60), T0 + 62 * SEC).state;
  const nudged = nudge(rung, { deltaSec: -10, now: T0 + 62 * SEC });
  assert.equal(view(nudged.state, T0 + 62 * SEC).rang, true);
  assert.equal(nudged.effects.includes(EFFECTS.REARMED), false);
  assert.deepEqual(settle(nudged.state, T0 + 62 * SEC).effects, []);
});

check("a nudge that takes the time past the armed length grows the length; below it, the length holds", () => {
  const below = nudge(running(60), { deltaSec: -15, now: T0 });
  assert.equal(below.state.lengthSec, 60);
  const past = nudge(running(60), { deltaSec: 45, now: T0 });
  assert.equal(past.state.lengthSec, 105);
});

check("a nudge is clamped to the one-hour cap on each side", () => {
  const far = nudge(running(60), { deltaSec: -100000, now: T0 + 60 * SEC });
  assert.equal(view(far.state, T0 + 60 * SEC).leftMs, -OVERTIME_MAX_SEC * SEC);
  const up = nudge(running(60), { deltaSec: 100000, now: T0 });
  assert.equal(view(up.state, T0).leftMs, 3600 * SEC);
});

check("a nudge with no rest running changes nothing", () => {
  const idle = createRestClock(60);
  const { state, effects } = nudge(idle, { deltaSec: 30, now: T0 });
  assert.equal(view(state, T0).active, false);
  assert.deepEqual(effects, []);
});

check("holding a running clock freezes its time left, however long it is held", () => {
  const held = toggleHold(running(60), T0 + 58 * SEC).state;
  assert.equal(view(held, T0 + 58 * SEC).phase, "paused");
  assert.equal(view(held, T0 + 58 * SEC).leftMs, 2 * SEC);
  assert.equal(view(held, T0 + 500 * SEC).leftMs, 2 * SEC);
  assert.equal(view(held, T0 + 500 * SEC).ticking, false);
});

check("resuming counts the held time from the moment it resumes", () => {
  const held = toggleHold(running(60), T0 + 58 * SEC).state;
  const resumed = toggleHold(held, T0 + 500 * SEC).state;
  const v = view(resumed, T0 + 500 * SEC);
  assert.equal(v.held, false);
  assert.equal(v.leftMs, 2 * SEC);
  assert.equal(v.ticking, true);
});

check("paused overtime is a real state: it holds the overrun, is not ticking, and resumes into overtime", () => {
  const rung = settle(running(60), T0 + 65 * SEC).state;
  const held = toggleHold(rung, T0 + 65 * SEC).state;
  const h = view(held, T0 + 80 * SEC);
  assert.equal(h.phase, "paused-overtime");
  assert.equal(h.done, true);
  assert.equal(h.leftMs, -5 * SEC);
  assert.equal(h.ticking, false);
  assert.deepEqual(settle(held, T0 + 80 * SEC).effects, [], "a held overrun never rings");
  const resumed = toggleHold(held, T0 + 80 * SEC).state;
  assert.equal(view(resumed, T0 + 81 * SEC).phase, "overtime");
  assert.equal(view(resumed, T0 + 81 * SEC).overSec, 6);
  assert.equal(view(resumed, T0 + 81 * SEC).ticking, true);
});

check("a clock held before its bell rings once when it runs out after resume", () => {
  const held = toggleHold(running(60), T0 + 60 * SEC - 100).state;
  assert.deepEqual(settle(held, T0 + 90 * SEC).effects, []);
  const resumed = toggleHold(held, T0 + 90 * SEC).state;
  assert.deepEqual(settle(resumed, T0 + 90 * SEC).effects, [EFFECTS.BELL]);
});

check("paused past the cap resumes capped, with no ticking", () => {
  const rung = settle(running(60), T0 + 60 * SEC).state;
  const held = toggleHold(rung, T0 + (60 + 3700) * SEC).state;
  assert.equal(view(held, T0 + (60 + 3700) * SEC).phase, "paused-overtime");
  const resumed = toggleHold(held, T0 + 9000 * SEC).state;
  assert.equal(view(resumed, T0 + 9000 * SEC).phase, "capped");
  assert.equal(view(resumed, T0 + 9000 * SEC).ticking, false);
});

check("setRemaining moves a held clock's remainder, and moves a running deadline", () => {
  const held = toggleHold(running(60), T0 + 10 * SEC).state;
  const moved = setRemaining(held, { ms: 300 * SEC, now: T0 + 20 * SEC }).state;
  assert.equal(view(moved, T0 + 90 * SEC).leftMs, 300 * SEC);
  const runningAgain = setRemaining(held, { ms: 20 * SEC, held: false, now: T0 + 30 * SEC }).state;
  assert.equal(view(runningAgain, T0 + 30 * SEC).held, false);
  assert.equal(view(runningAgain, T0 + 30 * SEC).leftMs, 20 * SEC);
});

check("setRemaining can hold a running clock at an explicit remainder", () => {
  const holding = setRemaining(running(60), { ms: 298 * SEC, held: true, now: T0 }).state;
  assert.equal(view(holding, T0 + 999 * SEC).phase, "paused");
  assert.equal(view(holding, T0 + 999 * SEC).leftMs, 298 * SEC);
});

check("setRemaining keeps the armed length unless one is given", () => {
  const kept = setRemaining(running(60), { ms: 10 * SEC, now: T0 }).state;
  assert.equal(kept.lengthSec, 60);
  const given = setRemaining(running(60), { ms: 10 * SEC, lengthSec: 300, now: T0 }).state;
  assert.equal(given.lengthSec, 300);
});

check("setLength changes the armed length without moving the clock or re-arming the bell", () => {
  const rung = settle(running(60), T0 + 61 * SEC).state;
  const { state, effects } = setLength(rung, 90);
  assert.equal(state.lengthSec, 90);
  assert.equal(view(state, T0 + 61 * SEC).leftMs, -1 * SEC);
  assert.equal(view(state, T0 + 61 * SEC).rang, true);
  assert.deepEqual(effects, []);
});

check("setLength on an idle clock is the length the next rest runs for", () => {
  const { state } = setLength(createRestClock(0), 150);
  assert.equal(view(state, T0).active, false);
  assert.equal(state.lengthSec, 150);
});

check("stop returns to idle, clears the armed length, and says so to the notices", () => {
  const { state, effects } = stop(running(60));
  assert.equal(view(state, T0).active, false);
  assert.equal(state.lengthSec, 0);
  assert.deepEqual(effects, [EFFECTS.CLEARED]);
});

check("only overtime and running tick; capped, held and idle never do", () => {
  const ticking = (state, now) => view(state, now).ticking;
  assert.equal(ticking(running(60), T0), true);
  assert.equal(ticking(settle(running(60), T0 + 61 * SEC).state, T0 + 61 * SEC), true);
  assert.equal(ticking(toggleHold(running(60), T0).state, T0), false);
  assert.equal(ticking(createRestClock(60), T0), false);
  assert.equal(ticking(settle(running(60), T0 + (60 + 3600) * SEC).state, T0 + (60 + 3600) * SEC), false);
});

check("an idle clock has no snapshot, and a running, held or overrun clock snapshots its deadline or remainder", () => {
  assert.equal(snapshot(createRestClock(90), T0), null);
  assert.equal(snapshot(running(60), T0).deadlineMs, T0 + 60 * SEC);
  assert.equal(snapshot(toggleHold(running(60), T0 + 10 * SEC).state, T0 + 10 * SEC).remainingMs, 50 * SEC);
  assert.equal(snapshot(settle(running(60), T0 + 63 * SEC).state, T0 + 63 * SEC).rang, true);
});

check("a snapshot read back restores the same clock at any later time: deadline, held remainder, overrun and bell", () => {
  const WRITTEN = T0 + 63 * SEC;
  const cases = [
    { name: "running", state: running(60) },
    { name: "held", state: toggleHold(running(120), T0 + 10 * SEC).state },
    { name: "overrun", state: settle(running(60), T0 + 63 * SEC).state },
    { name: "held overrun", state: toggleHold(settle(running(60), T0 + 63 * SEC).state, T0 + 63 * SEC).state },
  ];
  for (const { name, state } of cases) {
    const saved = JSON.parse(JSON.stringify(snapshot(state, WRITTEN)));
    const { state: restored, effects } = restore(createRestClock(0), saved, WRITTEN);
    assert.deepEqual(effects, [], `${name}: restoring makes no sound and no notice`);
    for (const later of [T0 + 61 * SEC, T0 + 200 * SEC]) {
      assert.deepEqual(view(restored, later), view(state, later), `${name} at +${(later - T0) / SEC}s reads the same`);
    }
  }
});

check("a restored overrun whose bell already rang does not ring again", () => {
  const saved = JSON.parse(JSON.stringify(snapshot(settle(running(60), T0 + 61 * SEC).state, T0 + 61 * SEC)));
  const { state } = restore(createRestClock(0), saved, T0 + 61 * SEC);
  assert.deepEqual(settle(state, T0 + 400 * SEC).effects, []);
  assert.equal(view(state, T0 + 400 * SEC).rang, true);
});

check("a restored running rest whose deadline passed while the page was gone rings once, as it was due", () => {
  const { state } = restore(createRestClock(0), JSON.parse(JSON.stringify(snapshot(running(60), T0))), T0);
  assert.deepEqual(settle(state, T0 + 30 * SEC).effects, []);
  const rung = settle(state, T0 + 61 * SEC);
  assert.deepEqual(rung.effects, [EFFECTS.BELL]);
  assert.deepEqual(settle(rung.state, T0 + 90 * SEC).effects, []);
});

check("restore takes only a well-formed snapshot into an idle clock, and anything else leaves the clock as it is", () => {
  const idle = createRestClock(90);
  for (const bad of [null, undefined, "running", 7, {}, { kind: "idle" }, { kind: "running", lengthSec: 60, rang: false },
    { kind: "running", deadlineMs: Number.NaN, lengthSec: 60, rang: false }, { kind: "paused", lengthSec: 60, rang: false },
    { kind: "paused", remainingMs: 1000, lengthSec: -5, rang: false }, { kind: "running", deadlineMs: T0, lengthSec: 60, rang: "yes" }]) {
    const result = restore(idle, bad, T0);
    assert.equal(result.state, idle, `refused: ${JSON.stringify(bad)}`);
    assert.deepEqual(result.effects, []);
  }
  const armed = running(60);
  assert.equal(restore(armed, snapshot(running(90, T0 + 5 * SEC), T0 + 5 * SEC), T0 + 5 * SEC).state, armed, "a clock already armed keeps its own deadline");
});

check("a snapshot carries the wall time its count-up would reach the one-hour cap, and nothing is carried for idle", () => {
  assert.equal(expiresAt(createRestClock(90), T0), null);
  assert.equal(snapshot(running(60), T0).expiresAt, T0 + 60 * SEC + OVERTIME_MAX_SEC * SEC);
  assert.equal(snapshot(settle(running(60), T0 + 63 * SEC).state, T0 + 63 * SEC).expiresAt, T0 + 60 * SEC + OVERTIME_MAX_SEC * SEC,
    "an overrun is measured from its deadline, not from when it was written");
  const held = toggleHold(running(120), T0 + 10 * SEC).state;
  assert.equal(snapshot(held, T0 + 10 * SEC).expiresAt, T0 + 10 * SEC + 110 * SEC + OVERTIME_MAX_SEC * SEC,
    "a held rest is measured as if it had kept running from the moment it was written");
});

check("a snapshot past its expiry is refused, and one just before it is restored", () => {
  const saved = JSON.parse(JSON.stringify(snapshot(running(60), T0)));
  const before = restore(createRestClock(0), saved, saved.expiresAt - 1);
  assert.equal(view(before.state, saved.expiresAt - 1).active, true, "one millisecond before the expiry it restores");
  const after = restore(createRestClock(0), saved, saved.expiresAt);
  assert.equal(after.state.kind, "idle", "at the expiry it is gone");
  assert.deepEqual(after.effects, []);
});

check("a snapshot with no expiry is not restored", () => {
  const { expiresAt: _dropped, ...noExpiry } = snapshot(running(60), T0);
  assert.equal(restore(createRestClock(0), noExpiry, T0).state.kind, "idle");
});

check("consume marks a running bell as rung without any effect, so no tab rings it again", () => {
  const due = settle(running(60), T0 + 61 * SEC).state;
  const pending = running(60);
  const consumed = consume(pending);
  assert.deepEqual(consumed.effects, []);
  assert.equal(consumed.state.rang, true);
  assert.equal(view(consumed.state, T0 + 61 * SEC).phase, "overtime");
  assert.deepEqual(settle(consumed.state, T0 + 90 * SEC).effects, [], "a later settle does not ring it");
  assert.equal(due.rang, true);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
