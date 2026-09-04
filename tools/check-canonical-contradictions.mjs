// Canonical contradiction, path, and schema-consumer checks for the UI
// overhaul Phase 0 contract. Scans current-tense governing documents for
// stale live-policy phrases, verifies required canonical anchors, asserts
// downstream schema-consumer vocabularies, and resolves relative doc links.
// Frozen source-evidence reports (docs/ui-screen-audit-*, docs/ui-audit-opus-*,
// docs/taurifer-ui-audit-*, decision registers, old numbered plans outside
// 047–049) are intentionally out of scope: quoting history there is their job.
// Usage:
//   node tools/check-canonical-contradictions.mjs [--check]
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const SCOPE = [
  "AGENTS.md",
  "README.md",
  "docs/backlog.md",
  "docs/brand-guide.md",
  "docs/adr/0005-install-promotion-by-capability.md",
  "docs/adr/0006-first-run-ethos-hero.md",
  "docs/adr/0007-shared-setup-links.md",
  "docs/adr/0009-appearance-setting-dark-theme.md",
  "docs/adr/0010-product-business-thesis-and-validation-sequencing.md",
  "docs/adr/0012-ui-overhaul-canonical-reconciliation.md",
  "docs/adr/0013-temporary-install-transfer.md",
  "docs/program-entry-flow.md",
  "docs/progression-strategy-contract.md",
  "docs/ui-audit.md",
  "docs/ui-overhaul-implementation-sequence.md",
  "plans/README.md",
  "plans/049-ui-overhaul-canonical-reconciliation.md",
  "plans/047-taurifer-program-families-compiler.md",
  "plans/048-program-entry-onboarding-redesign.md",
  "docs/ui-overhaul-disposition-register.md",
  "docs/recovery-week-policy.md",
  "docs/block-transition-provenance.md",
  "docs/ui-screens/README.md",
  "tools/README.md",
];

const REGISTER_HOME = new Set([
  "docs/ui-overhaul-disposition-register.md",
  "docs/ui-overhaul-implementation-sequence.md",
  "docs/ui-audit.md",
]);

const failures = [];
const check = (cond, message) => {
  if (!cond) failures.push(message);
};

const docs = new Map(SCOPE.map((p) => [p, read(p)]));
const linesOf = (p) => docs.get(p).split("\n");

// --- Forbidden live-policy phrases (zero hits allowed in scope) ---
for (const p of SCOPE) {
  const text = docs.get(p);
  check(!text.includes("no cards, no borders-as-boxes"), `${p}: stale live no-card policy phrase`);
  check(!/\bv172\b/.test(text), `${p}: stale pinned cache-version example`);
  check(
    !/READY FOR IMPLEMENTATION|READY — [34] OF 4/.test(text),
    `${p}: stale READY state for an implemented plan`,
  );
}

// Unqualified "never uploads": every live claim needs transfer/telemetry
// qualification within a 3-line window. Two carve-outs: the standing
// prohibition on raw-storage wholesale upload (the semantic clone exception
// is disclosed separately), and quoted mentions that describe an old
// wording being superseded rather than asserting it.
for (const p of SCOPE) {
  const lines = linesOf(p);
  lines.forEach((line, i) => {
    if (!/never uploads?/i.test(line)) return;
    if (/wholesale/i.test(line)) return;
    if (/["“”]never uploads?["“”]/i.test(line)) return;
    const window = lines.slice(Math.max(0, i - 1), i + 2).join("\n");
    check(
      /transfer|telemetry|exception|opted-in/i.test(window),
      `${p}:${i + 1}: unqualified never-uploads claim`,
    );
  });
}

// Rejected-claim normative cores may live only in the register, the sequence
// document, or the authoritative audit — never as live policy elsewhere.
const R_CORES = [
  "merge Recommend and Custom into one route",
  "preserve List merely",
  "darken licensed",
  "creator avatars",
  "separate landing motif",
  "ban middle dots",
  "old flatness",
  "dock-occlusion bug",
  "scripted heading focus",
  "globally replace orange",
  "every English exercise",
];
for (const p of SCOPE) {
  if (REGISTER_HOME.has(p)) continue;
  for (const core of R_CORES) {
    check(!docs.get(p).includes(core), `${p}: rejected claim reintroduced ("${core}")`);
  }
}

// Five-tab live policy may be described only by the audit's finding.
for (const p of SCOPE) {
  if (p === "docs/ui-audit.md") continue;
  check(
    !/five (equal |primary )?tabs|five-tab (layout|navigation|bar)/i.test(docs.get(p)),
    `${p}: stale five-tab policy`,
  );
}

// --- Required canonical anchors ---
const required = (file, substrings) => {
  for (const s of substrings) check(docs.get(file).includes(s), `${file}: missing anchor "${s}"`);
};
required("plans/README.md", ["049", "OWNER REVIEW", "IMPLEMENTED"]);
check(!/PLANNED — START FIRST/.test(docs.get("plans/README.md")), "plans/README.md: stale 049 planned-first state");
required("docs/backlog.md", ["Plans 049–059", "ui-overhaul-disposition-register"]);
required("AGENTS.md", ["adr/0013-temporary-install-transfer", "task-only"]);
required("README.md", ["repforge_transfer_v1", "Privacy page"]);
required("docs/brand-guide.md", ["adr/0012-ui-overhaul-canonical-reconciliation", "task-only"]);
required("docs/adr/0009-appearance-setting-dark-theme.md", ["0013-temporary-install-transfer"]);

// Downstream schema-consumer vocabularies must match their owning plans.
required("docs/block-transition-provenance.md", [
  "durableRevision",
  "compilerProvenance",
  "eligibleEvidenceIds",
  "insufficientEvidenceReasons",
  "compilerContextVersions",
  "policyVersions",
  "preservedRelations",
  "resetRelations",
  "incompatibilities",
  "same_family_sibling",
  "lower_frequency_sibling",
  "shorter_session_sibling",
  "guided_manual_repair",
  "reduce_training_volume",
  "recovery_week",
  "failed-before-commit",
  '"before"',
  '"after"',
  '"reason"',
  '"slot"',
  '"movement"',
  "Field presence",
  "nextBlockWeek1",
]);
required("docs/adr/0013-temporary-install-transfer.md", [
  "durableState",
  "workoutDraft",
  "programEntryDraft",
  "uiPreferences",
  "telemetryIdentity",
  "canonicalPayloadHash",
  "logicalInstallationId",
  "repforge_transfer_v1",
  "repforge_install_import_v1",
  "repforge_transfer_outbound_v1",
  "idempotencyKey",
  "duplicate",
  "/v1/transfers/status",
  "claimIdDigest",
  "expectedLocalRevision",
  "source_context",
  "destination_context",
]);
required("docs/adr/0012-ui-overhaul-canonical-reconciliation.md", [
  "flat",
  "prominent",
  "disclosure",
  "icon-only",
  "exercise-set",
  "improved",
  "declined",
  "maintained",
  "| ink |",
  "action-text",
  "0.6875rem",
  "2.5rem",
  "1.55",
]);
required("docs/recovery-week-policy.md", [
  "40–60%",
  "growth_2_v1",
  "growth_3_v1",
  "protected",
  "reducible",
  "pattern-rescue",
]);

// Every child plan keeps its dependency, atomic, STOP, and gate sections.
for (const n of ["050", "051", "052", "053", "054", "055", "056", "057", "058", "059"]) {
  const file = `plans/${n}-${{ "050": "ui-correctness-and-catalog-leverage", "051": "workout-draft-state-foundation", "052": "block-transition-provenance-foundation", "053": "ios-install-transfer-foundation", "054": "landing-and-program-entry", "055": "focus-only-workout", "056": "progress-and-block-lifecycle", "057": "management-surfaces", "058": "design-system-convergence", "059": "public-launch-ui-validation" }[n]}.md`;
  const text = read(file);
  check(text.includes("049"), `${file}: missing Plan 049 dependency reference`);
  for (const h of ["## Atomic commit", "## STOP", "## Completion gate"]) {
    check(text.includes(h), `${file}: missing ${h} section`);
  }
}

// ADR 0013 endpoints must not carry the bearer token in a URL.
{
  const adr = docs.get("docs/adr/0013-temporary-install-transfer.md");
  const paths = [...adr.matchAll(/`(POST|GET|DELETE) ([^`]+)`/g)].map((m) => m[2]);
  check(paths.length > 0, "ADR 0013: no endpoint definitions found");
  for (const path of paths) {
    check(!path.includes("{token}") && !path.includes("?"), `ADR 0013: bearer token in URL "${path}"`);
  }
}

// Relative markdown links inside scope docs must resolve to files.
{
  let linkCount = 0;
  for (const p of SCOPE) {
    const dir = dirname(join(ROOT, p));
    for (const m of docs.get(p).matchAll(/\]\(([^)#]+?\.md)(#[^)]*)?\)/g)) {
      const target = m[1];
      if (/^https?:/.test(target)) continue;
      linkCount += 1;
      check(existsSync(resolve(dir, target)), `${p}: broken doc link "${target}"`);
    }
  }
  check(linkCount > 20, `expected dozens of doc links, found ${linkCount}`);
}

if (process.argv.includes("--check")) {
  if (failures.length > 0) {
    for (const f of failures) console.error(`FAIL: ${f}`);
    process.exit(1);
  }
  console.log(`pass: no stale live-policy phrases; anchors, vocabularies, child-plan sections, and doc links verified across ${SCOPE.length} docs`);
} else {
  console.log(`checked ${SCOPE.length} docs`);
  if (failures.length > 0) {
    for (const f of failures) console.error(`FAIL: ${f}`);
    process.exit(1);
  }
}
