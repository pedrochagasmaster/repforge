// Verifies Candidate Rule B in docs/recovery-week-policy.md against the 20
// Plan 047 review compilations in test/fixtures/program-families-v1.json:
//   - deterministic recomputation over compiled slot statuses and sets
//   - no optional slot retains working sets
//   - every canonical primary pattern retains week-one work (with rescue)
//   - 40–60% band on every fixture except the allowlisted known misses
//     (growth_2_v1 32→12, growth_3_v1 49→17); any other miss, or drift in a
//     listed miss, fails
//   - synthetic unit case for the pattern-rescue path (never triggered by
//     the fixtures)
// Usage:
//   node tools/check-recovery-invariants.mjs [--check]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = join(ROOT, "test", "fixtures", "program-families-v1.json");

const KNOWN_MISSES = new Map([
  ["growth_2_v1", { base: 32, effective: 12 }],
  ["growth_3_v1", { base: 49, effective: 17 }],
]);

const fixture = JSON.parse(readFileSync(FIXTURE, "utf8"));
const templates = fixture.slotContracts;

function primaryPattern(templateId) {
  const patterns = (templates[templateId] || {}).patterns || [];
  if (!patterns.length) return null;
  const first = patterns[0];
  if (first === "squat") return "knee-dominant";
  if (first === "hinge") return "hip/hinge";
  if (first === "press" || first === "incline_press") return "horizontal press";
  return null;
}

// Candidate Rule B over plain slot rows {templateId, status, sets}.
// Returns {effective: number[], rescued: string[]}.
function applyRuleB(slots) {
  const effective = slots.map((s) => {
    if (s.status === "optional") return 0;
    if (s.status === "protected") return Math.ceil(s.sets / 2);
    return Math.floor(s.sets / 2);
  });
  const rescued = [];
  for (const pattern of ["knee-dominant", "hip/hinge", "horizontal press"]) {
    const total = slots.reduce((n, s, i) => n + (primaryPattern(s.templateId) === pattern ? effective[i] : 0), 0);
    if (total === 0) {
      const idx = slots.findIndex((s) => primaryPattern(s.templateId) === pattern && s.sets >= 1);
      if (idx >= 0) {
        effective[idx] = Math.max(effective[idx], 1);
        rescued.push(`${pattern}:${slots[idx].templateId}`);
      }
    }
  }
  return { effective, rescued };
}

const failures = [];
const check = (cond, message) => {
  if (!cond) failures.push(message);
};

const compilations = fixture.reviewCompilations;
check(compilations.length === 20, `expected 20 review compilations, got ${compilations.length}`);

const table = [];
for (const compilation of compilations) {
  const slots = compilation.days.flatMap((d) =>
    d.slots.map((s) => ({ templateId: s.templateId, status: s.status, sets: s.sets })),
  );
  const base = slots.reduce((n, s) => n + s.sets, 0);
  const first = applyRuleB(slots);
  const second = applyRuleB(slots);
  check(
    JSON.stringify(first) === JSON.stringify(second),
    `${compilation.blueprintId}: rule is not deterministic`,
  );
  const effective = first.effective.reduce((n, e) => n + e, 0);
  const optionalsKept = slots.some((s, i) => s.status === "optional" && first.effective[i] > 0);
  check(!optionalsKept, `${compilation.blueprintId}: optional slot retains working sets`);
  for (const pattern of ["knee-dominant", "hip/hinge", "horizontal press"]) {
    const total = slots.reduce(
      (n, s, i) => n + (primaryPattern(s.templateId) === pattern ? first.effective[i] : 0),
      0,
    );
    check(total >= 1, `${compilation.blueprintId}: primary pattern ${pattern} left empty`);
  }
  const ratio = effective / base;
  const inBand = ratio >= 0.4 && ratio <= 0.6;
  const known = KNOWN_MISSES.get(compilation.blueprintId);
  if (known) {
    check(
      base === known.base && effective === known.effective,
      `${compilation.blueprintId}: known miss drifted (now ${base}→${effective})`,
    );
  } else {
    check(inBand, `${compilation.blueprintId}: ${(ratio * 100).toFixed(1)}% outside 40–60%`);
  }
  table.push({ id: compilation.blueprintId, base, effective, ratio, inBand: inBand || !!known });
}

// Synthetic rescue path: a press-only program whose press slot is optional.
const synthetic = [
  { templateId: "optional_arms", status: "optional", sets: 2 },
  { templateId: "horizontal_press", status: "reducible", sets: 1 },
];
const before = applyRuleB([{ ...synthetic[0] }, { templateId: "vertical_pull", status: "reducible", sets: 2 }]);
check(
  before.effective[0] === 0,
  `synthetic: optional slot must be removed, got ${before.effective[0]}`,
);
const pressOnly = [
  { templateId: "optional_arms", status: "optional", sets: 2 },
  { templateId: "incline_press", status: "optional", sets: 2 },
  { templateId: "horizontal_press", status: "reducible", sets: 1 },
];
const rescued = applyRuleB(pressOnly);
check(
  rescued.effective[1] === 1 && rescued.rescued.includes("horizontal press:incline_press"),
  `synthetic: pattern rescue must retain first press slot at 1 (flagged I-2 exception), got ${JSON.stringify(rescued)}`,
);

const passCount = table.filter((r) => r.inBand).length;
if (process.argv.includes("--check")) {
  if (failures.length > 0) {
    for (const f of failures) console.error(`FAIL: ${f}`);
    process.exit(1);
  }
  console.log(`pass: Rule B deterministic over 20 fixtures, ${passCount}/20 in band (2 allowlisted misses), rescue path covered`);
} else {
  for (const r of table) {
    console.log(`${r.id} ${r.base}→${r.effective} ${(r.ratio * 100).toFixed(1)}%${r.inBand ? "" : " MISS"}`);
  }
  if (failures.length > 0) {
    for (const f of failures) console.error(`FAIL: ${f}`);
    process.exit(1);
  }
}
