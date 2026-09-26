// Candidate T ("Sua vez"): the visitor logs the last set of a Barbell bench
// press session, 3 x 8-10 at 60 kg, and the page reveals the engine's next
// target. Every cell of the reps x RIR grid is computed here, not on the page.
//
// Why sets 1-2 are 60x10 @1 and 60x7 @0, not the brief's 60x10 @2 twice:
// range@1 reads a session through its median set. With two identical sets at
// 60x10 RIR 2 the third set can never be the median, so all 20 cells return
// the same answer (Add load, 62.5 x 8) and the demo cannot respond to the
// visitor. `--explain` prints that grid as evidence. With a strong first set
// and a hard-fought second one, the third set decides, and the grid holds all
// the range outcomes the app can show.
import { evaluate, rangePrescription, sets, embed } from "./engine-lib.mjs";

const PRESCRIPTION = rangePrescription(3, 8, 10);
const LOAD = 60;
const FIXED = [[LOAD, 10, 1], [LOAD, 7, 0]];
const REPS = [6, 7, 8, 9, 10];
const RIRS = [0, 1, 2, 3];

// The app's own reason-to-copy table (RANGE_REASON_UI in app.js) for the
// reasons this grid reaches. `rule` names the i18n key the page renders.
const COPY = {
  "range.capacity_top": { verdict: "add", rule: "why.rule.cap_top" },
  "range.performed_top": { verdict: "add", rule: "rec.add.text" },
  "range.room_in_range": { verdict: "hold", rule: "rec.hold_add_reps.text" },
  "range.capacity_room": { verdict: "push", rule: "rec.push_reps.text" },
  "range.below_floor": { verdict: "reduce", rule: "rec.reduce.text" },
};

function cell(fixed, reps, rir, strict = true) {
  const r = evaluate({
    prescription: PRESCRIPTION,
    history: [{ sessionId: "s", date: "2026-09-01", sets: sets([...fixed, [LOAD, reps, rir]]) }],
  });
  const reason = r.reasonCodes[0];
  if (!COPY[reason]) throw new Error("reps " + reps + " rir " + rir + ": no one-line copy for " + reason);
  // rec.add.text says every set hit the top. Only use it when that is literally
  // true of the logged session; otherwise fall back to the capacity sentence.
  if (strict && reason === "range.performed_top" && [...fixed, [LOAD, reps, rir]].some((s) => s[1] < 10)) {
    throw new Error("performed_top reached without every set at the top; pick the capacity sentence");
  }
  return { status: r.status, reason, verdict: COPY[reason].verdict, rule: COPY[reason].rule,
    load: r.facts.targetLoad, reps: r.facts.targetReps, capacityReps: r.facts.capacityReps };
}

if (process.argv[2] === "--explain") {
  const brief = [[LOAD, 10, 2], [LOAD, 10, 2]];
  const seen = new Set();
  for (const reps of REPS) for (const rir of RIRS) {
    const c = cell(brief, reps, rir, false);
    seen.add(c.status + " " + c.load + "x" + c.reps);
  }
  console.log("Brief's sets 1-2 (60x10 @2, 60x10 @2): " + REPS.length * RIRS.length + " cells, distinct results: " + [...seen].join(", "));
  process.exit(0);
}

const grid = {};
for (const reps of REPS) for (const rir of RIRS) grid[reps + "/" + rir] = cell(FIXED, reps, rir);
embed("GRID", { load: LOAD, repMin: 8, repMax: 10, fixed: FIXED, reps: REPS, rirs: RIRS, hardRir: 4, cells: grid });
