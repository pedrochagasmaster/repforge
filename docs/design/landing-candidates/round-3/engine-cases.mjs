// The three verified cases candidate S shows: range@1, 3 working sets, one
// logged session as history, week 1 of 6. Each case asserts the result the
// brief verified, so a future engine change that moves any of these numbers
// fails loudly instead of drifting the page.
import { evaluate, rangePrescription, sets, embed } from "./engine-lib.mjs";

const CASES = [
  { id: "add", ex: "bench", repMin: 8, repMax: 10, logged: [[60, 10, 2], [60, 10, 2], [60, 10, 2]],
    expect: { status: "advance", reason: "range.performed_top", load: 62.5, reps: 8 } },
  { id: "hold", ex: "squat", repMin: 5, repMax: 8, logged: [[100, 8, 1], [100, 7, 0], [100, 6, 0]],
    expect: { status: "hold", reason: "range.room_in_range", load: 100, reps: 8 } },
  { id: "reduce", ex: "bench", repMin: 8, repMax: 10, logged: [[70, 7, 0], [70, 6, 0], [70, 6, 0]],
    expect: { status: "reduce", reason: "range.below_floor", load: 67.5, reps: 8 } },
];

const out = {};
for (const c of CASES) {
  const r = evaluate({
    prescription: rangePrescription(3, c.repMin, c.repMax),
    history: [{ sessionId: c.id, date: "2026-09-01", sets: sets(c.logged) }],
  });
  const got = { status: r.status, reason: r.reasonCodes[0], load: r.facts.targetLoad, reps: r.facts.targetReps };
  for (const k of Object.keys(c.expect)) {
    if (got[k] !== c.expect[k]) throw new Error(c.id + "." + k + ": expected " + c.expect[k] + ", engine gave " + got[k]);
  }
  out[c.id] = { ex: c.ex, sets: 3, repMin: c.repMin, repMax: c.repMax, logged: c.logged, status: r.status, reason: got.reason, load: got.load, reps: got.reps };
}
embed("CASES", out);
