// Checks docs/ui-overhaul-disposition-register.md: every G-01–G-88 decision
// and every UI-01–UI-32 finding appears exactly once with a valid disposition,
// a contract owner, and named consumers on split rows. Usage:
//   node tools/check-ui-overhaul-disposition.mjs [--check]
// Without --check it prints the parsed inventory; with --check it exits
// non-zero on any violation.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REGISTER = join(ROOT, "docs", "ui-overhaul-disposition-register.md");

const DISPOSITIONS = new Set([
  "specified-here",
  "implemented",
  "split",
  "preserved-strength",
  "rejected-or-closed-by-audit",
  "owner-gated",
]);
const PLAN = /^(04[0-9]|05[0-9])$/;

const text = readFileSync(REGISTER, "utf8");
const lines = text.split("\n");

const gRows = [];
const uiRows = [];
const guardrails = [];
for (const line of lines) {
  let m = line.match(/^\|\s*(G-\d{2})\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/);
  if (m) {
    gRows.push({ id: m[1], disposition: m[2].trim(), owner: m[3].trim(), consumers: m[4].trim(), line });
    continue;
  }
  m = line.match(/^\|\s*(UI-\d{2})\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/);
  if (m) {
    uiRows.push({ id: m[1], disposition: m[2].trim(), owner: m[3].trim(), consumers: m[4].trim(), line });
    continue;
  }
  m = line.match(/^\|\s*(R-\d{2})\s*\|/);
  if (m) guardrails.push(m[1]);
}

const failures = [];
const check = (cond, message) => {
  if (!cond) failures.push(message);
};

const expectIds = (prefix, count) =>
  Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(2, "0")}`);

for (const id of expectIds("G", 88)) {
  const matches = gRows.filter((r) => r.id === id);
  check(matches.length === 1, `${id}: appears ${matches.length} times, expected exactly once`);
}
for (const id of expectIds("UI", 32)) {
  const matches = uiRows.filter((r) => r.id === id);
  check(matches.length === 1, `${id}: appears ${matches.length} times, expected exactly once`);
}
check(
  gRows.length === 88,
  `G table has ${gRows.length} rows, expected 88 (duplicates or strays present)`,
);
check(
  uiRows.length === 32,
  `UI table has ${uiRows.length} rows, expected 32 (duplicates or strays present)`,
);

for (const row of [...gRows, ...uiRows]) {
  check(
    DISPOSITIONS.has(row.disposition),
    `${row.id}: unknown disposition "${row.disposition}"`,
  );
  check(PLAN.test(row.owner), `${row.id}: owner "${row.owner}" is not a plan number`);
  if (row.disposition === "split") {
    check(
      row.consumers !== "—" && row.consumers.length > 0,
      `${row.id}: split row names no consumers`,
    );
  }
  if (row.disposition === "specified-here") {
    check(row.owner === "049", `${row.id}: specified-here must be owned by 049`);
  }
  if (row.disposition === "implemented") {
    check(
      row.consumers === "—",
      `${row.id}: implemented row must have no consumers (use split instead)`,
    );
  }
}

check(guardrails.length === 11, `guardrail table has ${guardrails.length} rows, expected 11`);

const counts = {};
for (const row of [...gRows, ...uiRows]) {
  counts[row.disposition] = (counts[row.disposition] || 0) + 1;
}

if (process.argv.includes("--check")) {
  if (failures.length > 0) {
    for (const f of failures) console.error(`FAIL: ${f}`);
    process.exit(1);
  }
  console.log(
    `pass: 88 G + 32 UI dispositions, 11 guardrails (${JSON.stringify(counts)})`,
  );
} else {
  console.log(`G rows: ${gRows.length}, UI rows: ${uiRows.length}, guardrails: ${guardrails.length}`);
  console.log(`dispositions: ${JSON.stringify(counts)}`);
  if (failures.length > 0) {
    for (const f of failures) console.error(`FAIL: ${f}`);
    process.exit(1);
  }
}
