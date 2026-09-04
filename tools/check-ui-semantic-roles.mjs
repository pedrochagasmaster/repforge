// Checks the semantic role inventory and release matrix in
// docs/adr/0012-ui-overhaul-canonical-reconciliation.md:
//   - all six role families present with at least the Plan 049 minimum counts
//   - role names globally unique, each with a meaning and a consuming plan
//   - every matrix surface names an existing flow/screen in
//     docs/ui-screens/manifest.json and only known variant sets
// Usage:
//   node tools/check-ui-semantic-roles.mjs [--check]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ADR = join(ROOT, "docs", "adr", "0012-ui-overhaul-canonical-reconciliation.md");
const MANIFEST = join(ROOT, "docs", "ui-screens", "manifest.json");

const FAMILIES = {
  elevation: 5,
  radius: 4,
  typography: 6,
  controls: 7,
  progress: 6,
  color: 8,
};
const KNOWN_VARIANTS = new Set([
  "standard",
  "localized",
  "accessibility",
  "customAccessibility",
  "pt-text200",
]);
const PLAN = /^(04[0-9]|05[0-9])$/;

const adr = readFileSync(ADR, "utf8");
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const screens = new Set(manifest.screens.map((s) => `${s.flow}/${s.id}`));

const failures = [];
const check = (cond, message) => {
  if (!cond) failures.push(message);
};

// Parse `### Family: <name>` sections with `| Role | Meaning | ... |` tables.
const roles = [];
const familySections = adr.split(/^### Family: /m).slice(1);
const seenFamilies = new Set();
for (const section of familySections) {
  const name = section.split("\n", 1)[0].trim();
  seenFamilies.add(name);
  for (const line of section.split("\n")) {
    if (/^#{1,4} /.test(line)) break; // next section (e.g. the release matrix)
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    if (cells[1] === "Role" || /^-+$/.test(cells[1])) continue;
    if (cells.length < 5) continue;
    roles.push({ family: name, role: cells[1], meaning: cells[2], consumer: cells[3] });
  }
}

for (const [family, minimum] of Object.entries(FAMILIES)) {
  check(seenFamilies.has(family), `role family "${family}" missing from ADR 0012`);
  const count = roles.filter((r) => r.family === family).length;
  check(count >= minimum, `family "${family}" has ${count} roles, need at least ${minimum}`);
}

const names = roles.map((r) => r.role);
check(
  new Set(names).size === names.length,
  `duplicate role names: ${names.filter((n, i) => names.indexOf(n) !== i).join(", ")}`,
);
for (const r of roles) {
  check(r.role.length > 0, `empty role name in family "${r.family}"`);
  check(r.meaning.length > 0, `role "${r.role}" has no meaning`);
  check(
    PLAN.test(r.consumer),
    `role "${r.role}" names consumer "${r.consumer}", expected a plan number`,
  );
}

// Parse the demanding-surfaces matrix: `| flow/screen | variants | rationale |`.
const matrixBlock = adr.split("### Demanding surfaces")[1] || "";
let matrixRows = 0;
for (const line of matrixBlock.split("\n")) {
  if (!line.startsWith("|")) continue;
  const cells = line.split("|").map((c) => c.trim());
  if (cells[1].startsWith("Flow") || /^-+$/.test(cells[1])) continue;
  matrixRows += 1;
  check(screens.has(cells[1]), `matrix surface "${cells[1]}" is not a manifest flow/screen`);
  for (const variant of cells[2].split(/\s+/).filter(Boolean)) {
    check(KNOWN_VARIANTS.has(variant), `matrix surface "${cells[1]}" names unknown variant set "${variant}"`);
  }
  check((cells[3] || "").length > 0, `matrix surface "${cells[1]}" has no rationale`);
}
check(matrixRows > 0, "demanding-surfaces matrix has no rows");

if (process.argv.includes("--check")) {
  if (failures.length > 0) {
    for (const f of failures) console.error(`FAIL: ${f}`);
    process.exit(1);
  }
  console.log(`pass: ${roles.length} roles in 6 families, ${matrixRows} matrix surfaces`);
} else {
  console.log(`roles: ${roles.length}, families: ${[...seenFamilies].join(", ")}, matrix rows: ${matrixRows}`);
  if (failures.length > 0) {
    for (const f of failures) console.error(`FAIL: ${f}`);
    process.exit(1);
  }
}
