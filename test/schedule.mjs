#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const S = require(join(__dirname, "..", "schedule.js"));

let passed = 0, failed = 0;
function assert(cond, name, detail = "") {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); if (detail) console.log(`    ${detail}`); }
}

function row(day, date, created = `${date}T06:00:00`) {
  return { session: `${date}_${day}_x`, date, day, name: "X", set: 1, load: 50, reps: 8, rir: 1, created };
}

assert(S.mostOverdueDay([], ["Day 1", "Day 2"], "2026-07-31") === null, "empty log → null");

{
  const log = [row("Day 1", "2026-07-28")];
  const r = S.mostOverdueDay(log, ["Day 1", "Day 2", "Day 3"], "2026-07-31");
  assert(r?.day === "Day 2", "never-logged wins by program order", JSON.stringify(r));
}

{
  const log = [
    row("Day 1", "2026-07-20"),
    row("Day 2", "2026-07-29"),
    row("Day 3", "2026-07-25"),
  ];
  const r = S.mostOverdueDay(log, ["Day 1", "Day 2", "Day 3"], "2026-07-31");
  assert(r?.day === "Day 1" && r.daysSince === 11, "most overdue by date gap", JSON.stringify(r));
}

{
  const log = [
    row("Day 1", "2026-07-30"),
    row("Day 2", "2026-07-28"),
    row("Day 3", "2026-07-10"),
  ];
  const r = S.mostOverdueDay(log, ["Day 1", "Day 2", "Day 3"], "2026-07-31");
  assert(r?.day === "Day 3", "not next-in-rotation; oldest completion wins", JSON.stringify(r));
}

assert(S.hasLoggedOn([row("Day 1", "2026-07-31")], "2026-07-31") === true, "hasLoggedOn true");
assert(S.hasLoggedOn([row("Day 1", "2026-07-30")], "2026-07-31") === false, "hasLoggedOn false");

{
  const log = [
    row("Day 1", "2026-07-20", "2026-07-20T06:00:00"),
    row("Day 2", "2026-07-21", "2026-07-21T06:00:00"),
    row("Day 1", "2026-07-22", "2026-07-22T18:00:00"),
  ];
  assert(S.usualHour(log) === 6, "usualHour median", String(S.usualHour(log)));
}
assert(S.usualHour([row("Day 1", "2026-07-20")]) === null, "usualHour needs ≥2 sessions");

console.log(`\nschedule tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
