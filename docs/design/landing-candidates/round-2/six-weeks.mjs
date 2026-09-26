// Candidate U ("Seis semanas"): one lift across a six-week block, one session
// a week. The logged sets are authored; every target is the engine's. Week 1
// starts at 60 kg, and each following week is performed at the load the
// engine set after the week before, with the full history so far.
//
// Deliberate choices, stated so nobody mistakes the example for a promise:
// - Week 2 lands inside the range (9, 8, 8), so the engine holds the load.
// - Week 4 is a deliberate miss: at the new 65 kg the lifter managed 8, 7 and
//   6 reps, so the engine backs off.
// - Every week the engine advances, all three sets reach 10, the range top,
//   so the page can quote rec.add.text ("every set hit the top") truthfully.
import { evaluate, rangePrescription, sets, embed } from "./engine-lib.mjs";

const PRESCRIPTION = rangePrescription(3, 8, 10);
const DATES = ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31", "2026-09-07"];
// [reps, rir] per set, per week. The load comes from the engine.
const PERFORMED = [
  [[10, 2], [10, 2], [10, 1]],
  [[9, 1], [8, 1], [8, 0]],
  [[10, 1], [10, 1], [10, 0]],
  [[8, 1], [7, 0], [6, 0]],
  [[10, 1], [10, 1], [10, 0]],
  [[10, 1], [10, 0], [10, 0]],
];
const MISSES = [3]; // zero-based: week 4
const REASON_RULE = { "range.performed_top": "rec.add.text", "range.room_in_range": "rec.hold_add_reps.text", "range.below_floor": "rec.reduce.text" };
const VERDICT = { advance: "add", hold: "hold", reduce: "reduce" };

const history = [];
const weeks = [];
let load = 60;
PERFORMED.forEach((performed, i) => {
  const logged = performed.map(([reps, rir]) => [load, reps, rir]);
  history.push({ sessionId: "w" + (i + 1), date: DATES[i], sets: sets(logged) });
  const r = evaluate({ prescription: PRESCRIPTION, history, weekNumber: Math.min(i + 2, 6), blockStart: DATES[0] });
  const reason = r.reasonCodes[0];
  if (!REASON_RULE[reason]) throw new Error("week " + (i + 1) + ": no page copy for " + reason);
  if (reason === "range.performed_top" && performed.some(([reps]) => reps < 10)) throw new Error("week " + (i + 1) + ": rec.add.text would overstate");
  weeks.push({ week: i + 1, load, logged: performed, status: r.status, verdict: VERDICT[r.status], reason, rule: REASON_RULE[reason],
    next: { load: r.facts.targetLoad, reps: r.facts.targetReps }, miss: MISSES.includes(i) });
  load = r.facts.targetLoad;
});

const verdicts = new Set(weeks.map((w) => w.verdict));
for (const need of ["add", "hold", "reduce"]) if (!verdicts.has(need)) throw new Error("sequence lacks a " + need + " week");
embed("WEEKS", { exercise: "bench", sets: 3, repMin: 8, repMax: 10, weeks });
