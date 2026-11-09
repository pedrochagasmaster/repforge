#!/usr/bin/env node
/**
 * Plan 077 PR 4: the calibration-evidence gauge (OD-20), pure.
 *
 * - W7 G1–G5 give the plan's percentages; without max sets the gauge cannot pass 45.
 * - The slow-tap weight is shared out when there are no recent taps (or the tap is off).
 * - With no new evidence the gauge never rises.
 * - The H replay is deterministic and bounded to the last 30 sets per key.
 *
 * Run: node test/calibration-gauge.mjs
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Gauge = require("../calibration-gauge.js");

let passed = 0, failed = 0;
function assert(cond, name, detail) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); if (detail !== undefined) console.log(`    ${typeof detail === "string" ? detail : JSON.stringify(detail)}`); }
}
const NOW = "2026-11-06";
const daysAgo = (n) => new Date(Date.parse(`${NOW}T00:00:00Z`) - n * 864e5).toISOString().slice(0, 10);

console.log("\nThe formula (W7)");
{
  const checks = (spec) => spec.flatMap(([key, ages]) => ages.map((age) => ({ key, date: daysAgo(age) })));
  const g1 = Gauge.combine({ T: 0, A: 0.8, H: 0.6, W: 0.25, S: 0, R: 0.7, taps: false });
  assert(g1 === 27, "G1: four weeks of logging, no max sets, no taps → 27 %", g1);
  const t2 = Gauge.maxSetComponent(checks([["a", [2, 9]], ["b", [5, 12]]]), { now: NOW, eligibleKeys: 4 });
  const g2 = Gauge.combine({ T: t2, A: 0.8, H: 0.6, W: 0.25, S: 0, R: 0.7, taps: false });
  assert(Math.abs(t2 - 0.474) < 0.001 && g2 === 53, "G2: G1 plus 4 max sets on 2 exercises → T 0.474, 53 %", { t2, g2 });
  const t3 = Gauge.maxSetComponent(checks([["a", [2, 14]], ["b", [6, 18]], ["c", [9, 20]], ["d", [12, 24]]]), { now: NOW, eligibleKeys: 4 });
  const g3 = Gauge.combine({ T: t3, A: 0.85, H: 0.7, W: 0.6, S: 0.8, R: 0.9, taps: true });
  assert(Math.abs(t3 - 0.906) < 0.003 && g3 === 84, "G3: 8 max sets across 4 exercises, taps in use → 84 %", { t3, g3 });
  const t3p = Gauge.maxSetComponent(checks([["a", [0, 0]], ["b", [0, 0]], ["c", [0, 0]], ["d", [0, 0]]]), { now: NOW, eligibleKeys: 4 });
  assert(t3p === 1 && Gauge.combine({ T: t3p, A: 1, H: 1, W: 1, S: 1, R: 1, taps: true }) === 100, "G3′: 8 checks today, every rate perfect → 100 %");
  const fade = 0.5 ** (60 / 90);
  const g4 = Gauge.combine({ T: 0.906 * fade, A: 0.85 * fade, H: 0.7 * fade, W: 0.6 * fade, S: 0.8 * fade, R: 0.9 * fade, taps: true });
  assert(g4 === 53, "G4: G3 after 60 days without training → 53 %", g4);
  const t5 = Gauge.maxSetComponent(checks([["a", [3, 15]], ["b", [8, 20]]]), { now: NOW, eligibleKeys: 2 });
  const g5 = Gauge.combine({ T: t5, A: 0.8, H: 0.65, W: 0.5, S: 0, R: 0.8, taps: false });
  assert(Math.abs(t5 - 0.917) < 0.002 && g5 === 81, "G5: 2 eligible exercises, two checks each → 81 %", { t5, g5 });
  const one = Gauge.maxSetComponent(checks([["a", [0, 0, 0, 0, 0, 0, 0, 0]]]), { now: NOW, eligibleKeys: 4 });
  assert(one === 0.25, "eight checks on one exercise count only two: T 0.25", one);
  assert(Gauge.combine({ T: 0, A: 1, H: 1, W: 1, S: 1, R: 1, taps: true }) === 45, "without a max set the gauge stops at 45 %");
  const shared = Gauge.combine({ T: 0, A: 1, H: 1, W: 1, S: 0, R: 1, taps: false });
  const unshared = Gauge.combine({ T: 0, A: 1, H: 1, W: 1, S: 0, R: 1, taps: true });
  assert(shared === 45 && unshared === 40, "with no taps the slow tap's 5 % is shared out, so skipping it costs nothing", { shared, unshared });
}

console.log("\nThe supporting components");
{
  const items = Array.from({ length: 20 }, (_, i) => ({ date: daysAgo(0), q: 1, agree: i < 16 }));
  assert(Math.abs(Gauge.supporting(items, 20, NOW) - 0.8) < 1e-9, "a component is its agreement rate once its target is met");
  assert(Math.abs(Gauge.supporting(items.slice(0, 10), 20, NOW) - 0.5) < 1e-9, "below its target it is scaled by how much evidence there is");
  const half = [{ date: daysAgo(90), q: 1, agree: true }, { date: daysAgo(0), q: 0.5, agree: true }];
  assert(Math.abs(Gauge.supporting(half, 2, NOW) - 0.5) < 1e-9, "a 90-day-old item and a coarse item each weigh a half");
  assert(Gauge.rowQuality({ effortSource: "rir" }) === 1 && Gauge.rowQuality({ effortSource: "reps_left" }) === 1 &&
    Gauge.rowQuality({ effortSource: "effort" }) === 0.5 && Gauge.rowQuality({ effortSource: "reps_left_3plus" }) === 0.5 && Gauge.rowQuality({ effortSource: "reps_left_5plus" }) === 0.5 &&
    Gauge.rowQuality({}) === 0.5 && Gauge.rowQuality({ effortSource: "prefilled" }) === 0 && Gauge.rowQuality({ effortSource: "unsure" }) === 0 &&
    Gauge.rowQuality({ effortSource: "failure" }) === 0 && Gauge.rowQuality({ effortSource: "rir", warmup: true }) === 0,
  "row quality: numbers 1, words and unknown ½, prefilled, Not sure, failure and warm-ups 0");
  const cap = (load, reps, rir) => load * (1 + (reps + Math.min(rir, 5)) / 30);
  const obs = [
    { key: "a", session: "s1", date: daysAgo(1), set: 1, load: 100, reps: 8, rir: 2, q: 1 },
    { key: "a", session: "s1", date: daysAgo(1), set: 2, load: 100, reps: 7, rir: 2, q: 1 },
    { key: "a", session: "s1", date: daysAgo(1), set: 3, load: 100, reps: 1, rir: 2, q: 1 },
    { key: "a", session: "s1", date: daysAgo(1), set: 4, load: 100, reps: 3, rir: null, q: 0 },
  ];
  const pairs = Gauge.pairsFrom(obs, cap);
  assert(pairs.length === 2 && pairs[0].agree === true && pairs[1].agree === false,
    "consecutive countable sets agree on a plausible fatigue drop and not on a collapse", pairs);
  const twins = Gauge.pairsFrom([
    { key: "a", session: "t", date: daysAgo(1), set: 1, load: 100, reps: 8, rir: 2, q: 1 },
    { key: "a", session: "t", date: daysAgo(1), set: 2, load: 100, reps: 8, rir: 2, q: 1 },
    { key: "a", session: "t", date: daysAgo(1), set: 3, load: 100, reps: 7, rir: 2, q: 1 },
  ], cap);
  assert(twins.length === 1, "identical consecutive sets (same load, reps and RIR) are no evidence: they form no pair", twins);
  const ev = Gauge.compute({ now: NOW, capacity: cap, programKeys: ["a"], eligibleKeys: 1,
    observations: Array.from({ length: 6 }, (_, i) => ({ key: "a", session: `e${i >> 1}`, date: daysAgo(0), set: (i % 2) + 1, load: 100, reps: 8 - (i % 2), rir: 2, q: 0.5 })) }).evidence;
  assert(ev.A.n === 1.5 && ev.A.target === 20 && ev.A.rate === 1 && ev.R.n === 3 && ev.R.target === 24 && ev.W.target === 8,
    "the breakdown reads each signal's weighted evidence against its target, with its agreement rate", ev);
  const weekly = [
    { key: "a", session: "w1", date: "2026-10-05", set: 1, load: 100, reps: 8, rir: 2, q: 1 },
    { key: "a", session: "w2", date: "2026-10-12", set: 1, load: 100, reps: 8, rir: 3, q: 1 },
    { key: "a", session: "w3", date: "2026-10-26", set: 1, load: 120, reps: 8, rir: 2, q: 1 },
    { key: "a", session: "w4", date: "2026-11-30", set: 1, load: 120, reps: 8, rir: 2, q: 1 },
  ];
  const weeks = Gauge.weeksFrom(weekly, cap);
  assert(weeks.length === 2 && weeks[0].agree === true && weeks[1].agree === false,
    "weekly estimates within 2 weeks agree within ±5 %; a gap over 2 weeks is no pair", weeks);
  const taps = Gauge.tapsFrom([{ date: daysAgo(1), rir: 1, q: 1, lastRepSlow: true }, { date: daysAgo(1), rir: 3, q: 1, lastRepSlow: true },
    { date: daysAgo(1), rir: 2, q: 1, lastRepSlow: false }, { date: daysAgo(1), rir: 2, q: 1 }]);
  assert(taps.map((tap) => tap.agree).join() === "true,false,true", "a slow last rep agrees with RIR ≤ 1, a quick one with RIR ≥ 2; no tap, no item", taps);
  const history = Gauge.historyComponent([{ key: "a", q: 1, date: daysAgo(0) }, { key: "a", q: 1, date: daysAgo(0) }], ["a", "b"], NOW);
  assert(Math.abs(history - (2 / 24) / 2) < 1e-9, "R is the mean of each program key's countable sets over 24", history);
}

console.log("\nFading, never rising");
{
  const input = {
    checks: [{ key: "a", date: daysAgo(3) }, { key: "b", date: daysAgo(10) }],
    observations: Array.from({ length: 12 }, (_, i) => ({ key: "a", session: `s${i >> 2}`, date: daysAgo(i), set: (i % 4) + 1, load: 100, reps: 8 - (i % 4), rir: 2, q: 1 })),
    hits: [{ date: daysAgo(4), q: 1, agree: true }], programKeys: ["a", "b"], eligibleKeys: 2,
  };
  const cap = (load, reps, rir) => load * (1 + (reps + Math.min(rir, 5)) / 30);
  let last = Infinity, rising = false;
  for (let d = 0; d <= 360; d += 15) {
    const now = new Date(Date.parse(`${NOW}T00:00:00Z`) + d * 864e5).toISOString().slice(0, 10);
    const g = Gauge.compute({ ...input, now, capacity: cap }).percent;
    if (g > last) rising = true;
    last = g;
  }
  assert(!rising && last < Gauge.compute({ ...input, now: NOW, capacity: cap }).percent, "with no new evidence the gauge only fades");
}

console.log("\nThe H replay");
{
  const sessions = Array.from({ length: 20 }, (_, i) => ({ date: daysAgo(40 - i), sets: [1, 2, 3].map((setIndex) => ({ setIndex, load: 100, reps: 8, rir: 2, q: 1 })) }));
  const seen = [];
  const suggest = (prior, session) => { seen.push(prior.length); return session.sets.map((set) => ({ setIndex: set.setIndex, load: 100, reps: 8, rir: set.setIndex === 3 ? 4 : 2 })); };
  const first = Gauge.hitsFrom({ a: sessions }, suggest);
  const again = Gauge.hitsFrom({ a: sessions }, suggest);
  assert(JSON.stringify(first) === JSON.stringify(again), "the replay is deterministic");
  assert(first.length === 30 && seen.slice(0, 10).join() === "10,11,12,13,14,15,16,17,18,19", "it replays only the sessions holding the last 30 sets, each on the history before it", { n: first.length, seen: seen.slice(0, 10) });
  assert(first.filter((hit) => hit.agree).length === 20, "a set agrees when its reps plus RIR land within one of the suggestion's");
  const offLoad = Gauge.hitsFrom({ a: sessions.slice(-1) }, () => [{ setIndex: 1, load: 102.5, reps: 8, rir: 2 }]);
  assert(offLoad.length === 0, "a set done at another load than suggested does not count");
}

console.log("\nMax sets at a full gauge (OD-12)");
{
  const Calibration = require("../effort-calibration.js");
  const history = [{ exerciseKey: "other", date: daysAgo(20) }];
  const open = Calibration.frequencyAllows({ history, today: NOW, exerciseKey: "lift" });
  const full = Calibration.frequencyAllows({ history, today: NOW, exerciseKey: "lift", gaugeFull: true });
  const later = Calibration.frequencyAllows({ history: [{ exerciseKey: "other", date: daysAgo(30) }], today: NOW, exerciseKey: "lift", gaugeFull: true });
  assert(open.ok && !full.ok && full.reason === "monthly" && later.ok,
    "at 100 % a check 20 days ago on another exercise holds the next one back; one 30 days ago does not", { open, full, later });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
