// Canonical contradiction, path, and schema-consumer checks for the UI
// overhaul Phase 0 contract. Scans current-tense governing documents for
// stale live-policy phrases, verifies required canonical anchors, asserts
// downstream schema-consumer vocabularies, and resolves relative doc links.
// Frozen source-evidence reports (docs/ui-screen-audit-*, docs/ui-audit-opus-*,
// docs/taurifer-ui-audit-*, decision registers, old numbered plans outside
// 047–049) are intentionally out of scope: quoting history there is their job.
// Usage:
//   node tools/check-canonical-contradictions.mjs [--check]
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSlotMapping, validateTransitionProposal } from "./transition-mapping-oracle.mjs";

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

// Downstream schema-consumer vocabularies are DERIVED from the owning plans,
// not hard-coded here: if a downstream plan changes its vocabulary, this gate
// fails until the Phase 0 contract is updated to match.
const plan052 = read("plans/052-block-transition-provenance-foundation.md");
const plan053 = read("plans/053-ios-install-transfer-foundation.md");
const plan058 = read("plans/058-design-system-convergence.md");
const fencesOf = (text) =>
  [...text.matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1]);
const camelTokens = (text) =>
  new Set([...text.matchAll(/\b[a-z]+[A-Z][a-zA-Z0-9]*\b/g)].map((m) => m[0]));
const snakeTokens = (text) =>
  new Set([...text.matchAll(/`([a-z][a-z0-9_]+)`/g)].map((m) => m[1]));

{
  // Plan 052 transition record + overlay blocks.
  const recordBlock = fencesOf(plan052).find((b) => b.includes("transitionId") && b.includes("proposalHash"));
  check(!!recordBlock, "Plan 052: transition record block not found (extraction broken)");
  const overlayBlock = fencesOf(plan052).find((b) => b.includes("activePeriod"));
  check(!!overlayBlock, "Plan 052: recovery overlay block not found (extraction broken)");
  const kindsLine = plan052.split("\n").find((l) => l.includes("Transition kinds are closed:"));
  check(!!kindsLine, "Plan 052: closed-kinds line not found (extraction broken)");
  const doc = docs.get("docs/block-transition-provenance.md");
  const want = new Set([
    ...camelTokens(`${recordBlock || ""}\n${overlayBlock || ""}`),
    ...snakeTokens(`${kindsLine || ""}\n${overlayBlock || ""}`),
    "failed-before-commit",
  ]);
  check(want.size > 30, `Plan 052: extracted only ${want.size} vocabulary tokens (extraction broken)`);
  for (const token of [...want].sort()) {
    check(doc.includes(token), `transition contract missing Plan 052 vocabulary "${token}"`);
  }
}

{
  // Plan 053 clone block, server states, and endpoint paths.
  const cloneBlock = fencesOf(plan053).find((b) => b.includes("taurifer-install-transfer"));
  check(!!cloneBlock, "Plan 053: clone block not found (extraction broken)");
  const statesLine = plan053.split("\n").find((l) => l.includes("Server states:"));
  check(!!statesLine, "Plan 053: server-states line not found (extraction broken)");
  const adr = docs.get("docs/adr/0013-temporary-install-transfer.md");
  const want = new Set([...camelTokens(cloneBlock || ""), ...snakeTokens(`${cloneBlock || ""}\n${statesLine || ""}`)]);
  want.delete("taurifer");
  check(want.size > 10, `Plan 053: extracted only ${want.size} vocabulary tokens (extraction broken)`);
  for (const token of [...want].sort()) {
    check(adr.includes(token), `transfer contract missing Plan 053 vocabulary "${token}"`);
  }
  for (const path of ["/v1/transfers", "/v1/transfers/claims", "/v1/transfers/claims/commit", "/v1/transfers/status"]) {
    check(adr.includes(path), `transfer contract missing endpoint "${path}"`);
  }
}

{
  // Plan 058 type steps, radius, elevation, progress, and color names.
  const sizesLine = plan058.split("\n").find((l) => l.includes("sizes:"));
  const heightsLine = plan058.split("\n").find((l) => l.includes("line heights:"));
  const radiusSection = (plan058.split("#### Radius")[1] || "").split("####")[0];
  const elevationSection = (plan058.split("#### Elevation")[1] || "").split("####")[0];
  const progressSection = (plan058.split("#### Progress dimensions")[1] || "").split("####")[0];
  const colorLine = plan058.split("\n").find((l) => l.includes("role tokens for"));
  check(!!sizesLine && !!heightsLine && !!colorLine, "Plan 058: type/color contract lines not found (extraction broken)");
  const adr = docs.get("docs/adr/0012-ui-overhaul-canonical-reconciliation.md");
  const pairs = [...(sizesLine || "").matchAll(/([a-z][a-z-/]*)\s+(\d+(?:\.\d+)?rem)/g)]
    .flatMap((m) => m[1].split("/").map((name) => [name, m[2]]));
  check(pairs.length === 8, `Plan 058: extracted ${pairs.length} type steps, expected 8 (body/control counts twice)`);
  const typographySection = (adr.split("### Family: typography")[1] || "").split("### Family:")[0];
  for (const [name, value] of pairs) {
    check(typographySection.includes(name), `roles contract typography missing Plan 058 step "${name}"`);
    check(typographySection.includes(value), `roles contract typography missing value "${value}"`);
  }
  for (const [, name, value] of [...(heightsLine || "").matchAll(/([a-z]+)\s+(\d+\.\d+)/g)]) {
    check(adr.includes(name), `roles contract missing Plan 058 line height "${name}"`);
    check(adr.includes(value), `roles contract missing line-height value "${value}"`);
  }
  for (const name of [...radiusSection.matchAll(/- ([a-z]+) \d/g)].map((m) => m[1])) {
    check(adr.includes(name), `roles contract missing Plan 058 radius "${name}"`);
  }
  for (const name of [...elevationSection.matchAll(/- ([a-z-]+):/g)].map((m) => m[1])) {
    check(adr.includes(name), `roles contract missing Plan 058 elevation "${name}"`);
  }
  for (const name of [...progressSection.matchAll(/- `([a-z-]+)`/g)].map((m) => m[1])) {
    check(adr.includes(name), `roles contract missing Plan 058 progress dimension "${name}"`);
  }
  const colorList = ((colorLine || "").split("role tokens for")[1] || "").split(".")[0];
  for (const name of [...colorList.matchAll(/[a-z][a-z-]*/g)].map((m) => m[0])) {
    if (["and", "required", "control", "separator", "hierarchy"].includes(name)) continue;
    check(adr.includes(name), `roles contract missing Plan 058 color "${name}"`);
  }
}

// The brand guide and Plan 049 must use the canonical ADR/Plan 058 role name
// `flat`; `page` and `page/flat` were review-era prose and are not live roles.
const brandElevationLine = linesOf("docs/brand-guide.md").find((line) =>
  line.includes("Depth is allowlisted by semantic role only"),
);
const plan049ElevationLine = linesOf("plans/049-ui-overhaul-canonical-reconciliation.md").find((line) =>
  /^- elevation:/.test(line),
);
check(
  !!brandElevationLine && brandElevationLine.includes("`flat`, `selected`") && !/\bpage(?:[/-]flat)?\b/i.test(brandElevationLine),
  "brand guide: elevation role must use canonical flat",
);
check(
  plan049ElevationLine === "- elevation: flat, selected, floating, modal, and persistent-action;",
  "Plan 049: elevation role must use canonical flat",
);
check(plan058.includes("- flat:"), "Plan 058: canonical flat elevation role missing");
check(docs.get("docs/adr/0012-ui-overhaul-canonical-reconciliation.md").includes("| flat |"), "ADR 0012: canonical flat elevation role missing");

required("docs/recovery-week-policy.md", [
  "40–60%",
  "growth_2_v1",
  "growth_3_v1",
  "protected",
  "reducible",
  "pattern-rescue",
]);

// Protocol-semantics anchors: named contract points the vocabulary scan
// cannot see (lowercase identifiers, lifecycle rules, table rows).
{
  const adr = docs.get("docs/adr/0013-temporary-install-transfer.md");
  for (const anchor of [
    "repforge_transfer_inbound_v1",
    "repforge_transfer_outbound_v1",
    "sealedToken",
    "duplicate",
    "unknown-outcome",
    "T-01",
    "T-14",
    "programEntryDraft",
    "claimed-expired",
    "must NOT silently",
    "Safari never learns",
    "tombstone margin",
    "15-minute",
    "Poll exhaustion",
    "service outage or unavailable status response",
    "the tombstone has been purged",
  ]) {
    check(adr.includes(anchor), `ADR 0013: missing protocol anchor "${anchor}"`);
  }
  const plan053 = read("plans/053-ios-install-transfer-foundation.md");
  for (const anchor of ["duplicate", "status", "sealed", "claimed-expired", "never resumes silently", "tombstone margin", "before transfer creation", "unknown-outcome", "Safari outbound credential loss", "installed inbound credential loss"]) {
    check(plan053.includes(anchor), `Plan 053: missing aligned protocol anchor "${anchor}"`);
  }
  // Plan 053 must not carry the superseded unseal-only unknown-outcome rule.
  check(
    !/Only a genuine unseal failure enters unknown-outcome/i.test(plan053),
    "Plan 053: superseded unseal-only unknown-outcome rule present",
  );
  // Negative checks: the current exclusivity sentences must not reappear.
  for (const p of SCOPE) {
    if (p === "docs/ui-audit.md") continue;
    const text = docs.get(p);
    check(
      !/Only if unsealing genuinely fails does Safari enter unknown-outcome/i.test(text),
      `${p}: superseded unseal-only unknown-outcome rule present`,
    );
  }
  const overlaySection = (docs.get("docs/block-transition-provenance.md").split("## Recovery-week overlay")[1] || "").split(/^## /m)[0];
  for (const anchor of ['"slot"', '"movement"', "pattern-rescue"]) {
    check(overlaySection.includes(anchor), `transition overlay: missing "${anchor}"`);
  }
  // proposalHash must be an executable rule: preimage projection, canonical
  // JSON, set normalization, hex digest, and a verified fixture.
  const hashSection = (docs.get("docs/block-transition-provenance.md").split("Canonical array order and proposal hashing")[1] || "").split(/^## /m)[0];
  for (const anchor of [
    "SHA-256",
    "canonical preimage",
    "sorted object keys",
    "lowercase hex",
    "be72dc9b42ca73d12b8517b9dbe3d901cd9b592fc13591e52199ebcd20a4b204",
    "transition-proposal-v1.json",
  ]) {
    check(hashSection.includes(anchor), `transition hashing: missing "${anchor}"`);
  }
  // The ADR's client enum must literally contain unknown-outcome — parse the
  // "Client states:" block, not just any occurrence of the word.
  {
    const clientStates = (adr.split("Client states:")[1] || "").split(".").slice(0, 3).join(".");
    check(clientStates.includes("`unknown-outcome`"), "ADR 0013: client enum omits unknown-outcome");
  }
  // Plan 053's client enum must also contain it.
  {
    const planClientStates = (plan053.split("Client states:")[1] || "").split(".").slice(0, 3).join(".");
    check(planClientStates.includes("`unknown-outcome`"), "Plan 053: client enum omits unknown-outcome");
  }
  // Both hash contracts must execute cleanly (the run also validates the
  // embedded fixture digests, frozen-input/no-mutation, hostile keys).
  try {
    const { execFileSync } = await import("node:child_process");
    execFileSync(process.execPath, ["tools/canonical-proposal-hash.mjs", "--check"], { cwd: ROOT, stdio: "pipe" });
  } catch {
    failures.push("transition hashing: fixture digest does not verify with the documented rule");
  }
  try {
    const { execFileSync } = await import("node:child_process");
    execFileSync(process.execPath, ["tools/canonical-clone-hash.mjs", "--check"], { cwd: ROOT, stdio: "pipe" });
    execFileSync(process.execPath, ["tools/check-canonical-hash-semantics.mjs"], { cwd: ROOT, stdio: "pipe" });
    // The ADR's displayed example envelope must equal the fixture and hash
    // to the digest the ADR records.
    const { clonePayloadHashOf } = await import(join(ROOT, "tools", "canonical-clone-hash.mjs"));
    const adrExample = JSON.parse([...adr.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => m[1])[0]);
    const fixture = JSON.parse(readFileSync(join(ROOT, "test", "fixtures", "install-transfer-clone-v1.json"), "utf8"));
    check(
      JSON.stringify(adrExample) === JSON.stringify(fixture),
      "ADR 0013: displayed envelope differs from test/fixtures/install-transfer-clone-v1.json",
    );
    const computed = clonePayloadHashOf(adrExample);
    check(
      computed === adrExample.integrity.canonicalPayloadHash,
      `ADR 0013: envelope hashes to ${computed.slice(0, 12)}…, integrity claims ${String(adrExample.integrity.canonicalPayloadHash).slice(0, 12)}…`,
    );
  } catch {
    failures.push("clone hashing: fixture digest does not verify with the documented rule");
  }
}

// Deletion happens only on verified import-commit, never on claim binding.
// (Owner-approved ui-audit shorthand is reconciled openly in ADR 0013 and
// excluded here by its refinement marker. G-85 row text is checked against
// its reconciled phrasing rather than exempted: a re-drifted row fails.)
for (const p of SCOPE) {
  if (p === "docs/ui-audit.md") continue;
  linesOf(p).forEach((line, i) => {
    if (/refin|shorthand/.test(line)) return;
    check(
      !/deletes it on claim|delete on claim or expiry|after successful claim|deletion on claim|deletion occurs on claim|claim deletion|claim-or-60-minute/i.test(line),
      `${p}:${i + 1}: deletion-on-claim wording (deletion happens only on verified import)`,
    );
  });
}

// Closed claim lifecycle: claims end at deleted or claimed-expired, never a
// bare "deleted/expired" that would let an imported transfer silently expire.
for (const p of SCOPE) {
  linesOf(p).forEach((line, i) => {
    if (/refin|shorthand|G-71|G-85/.test(line)) return;
    check(
      !/claiming\s*(→|->)\s*deleted\s*\/\s*expired|deleted\/expired/i.test(line),
      `${p}:${i + 1}: stale claiming → deleted/expired transition (use deleted or claimed-expired)`,
    );
  });
}

// Closed recovery enum: the code-form identifier is recovery_week everywhere
// in scope; hyphenated code forms are a disagreement with Plan 052.
for (const p of SCOPE) {
  check(!/`recovery-week`/.test(docs.get(p)), `${p}: hyphenated recovery enum identifier (use recovery_week)`);
}

// Shipped setup formats: v1, v2, and v3 decode forever; v2 is skipped for
// progression-carrying payloads.
for (const p of ["AGENTS.md", "README.md", "docs/adr/0007-shared-setup-links.md"]) {
  check(docs.get(p).includes("v3."), `${p}: shipped v3 setup format not documented`);
}

// Backlog status honesty: no Next rows remain anywhere, and no stale
// Now-scoped claims survive the deferral.
{
  const backlog = docs.get("docs/backlog.md");
  check(!/^\| Next \|/m.test(backlog), "backlog: Next rows remain scheduled");
  check(!/already Now|under Now|Now-tier/.test(backlog), "backlog: stale Now-scoped claim");
}

// The slot mapping and exercise diff are exhaustive, deterministic, and
// compiler-grounded. The same oracle is imported by the durable negative
// harness, so the checker cannot pass on a hand-written partial model.
try {
  const mappingDoc = JSON.parse(readFileSync(join(ROOT, "test/fixtures/transition-proposal-v1.json"), "utf8"));
  const proposal = mappingDoc.proposal;
  const compiler = JSON.parse(readFileSync(join(ROOT, "test/fixtures/program-families-v1.json"), "utf8"));
  const compilationOf = (blueprintId) => compiler.reviewCompilations.find((entry) => entry.blueprintId === blueprintId);
  const predecessorCompilation = compilationOf(proposal.predecessor.compilerProvenance.blueprintId);
  const successorCompilation = compilationOf(proposal.successor.compilerProvenance.blueprintId);
  check(!!predecessorCompilation && !!successorCompilation, "slot mapping: compiler provenance points at a missing review compilation");
  if (predecessorCompilation && successorCompilation) {
    for (const error of validateTransitionProposal(proposal, predecessorCompilation, successorCompilation)) check(false, error);
    const { proposalHashOf } = await import("./canonical-proposal-hash.mjs");
    const provenance = read("docs/block-transition-provenance.md");
    const exampleMatch = provenance.match(/```json\n([\s\S]*?)\n```/);
    const example = exampleMatch ? JSON.parse(exampleMatch[1]) : null;
    check(example?.proposalHash === proposalHashOf(proposal), "transition proposal: embedded example hash does not match the canonical preimage");
    check(
      JSON.stringify(proposal.diff.exercises) === JSON.stringify(
        (await import("./transition-mapping-oracle.mjs")).deriveExerciseDiff(
          proposal.derivation.slotMapping,
          predecessorCompilation,
          successorCompilation,
          proposal.diff.exercises,
        ),
      ),
      "diff.exercises: fixture is not reconstructed from the canonical slot mapping and compiler snapshots",
    );
  }
  // A second committed fixture exercises optional_arms on both sides. The
  // governing first pass applies to every same-template slot; optional work
  // is not an invented exclusion.
  const optional = JSON.parse(readFileSync(join(ROOT, "test/fixtures/transition-optional-slots-v1.json"), "utf8"));
  const optionalPredecessor = compilationOf(optional.predecessorBlueprintId);
  const optionalSuccessor = compilationOf(optional.successorBlueprintId);
  const optionalErrors = validateSlotMapping(optional.mapping, optionalPredecessor, optionalSuccessor);
  check(optionalErrors.length === 0, optionalErrors.join("; "));
  check(
    optional.mapping.slots.some((row) => row.predecessorSlot && row.successorSlot &&
      row.predecessorSlot.includes("_s6") && row.successorSlot.includes("_s6")),
    "slot mapping: optional sibling fixture does not pair its same-template optional slot",
  );
  const provKeys = ["familyId", "blueprintId", "blueprintVersion", "compilerVersion", "catalogueVersion", "rulesVersion", "contextVersion", "profileId", "recentConsistencyVersion"];
  for (const side of ["predecessor", "successor"]) {
    const prov = proposal[side].compilerProvenance;
    for (const key of provKeys) check(prov && key in prov, `transition proposal: ${side}.compilerProvenance missing "${key}"`);
    check(!("familyVersion" in (prov || {})), `transition proposal: ${side}.compilerProvenance carries invented familyVersion`);
  }
} catch (err) {
  failures.push(`slot mapping gate: ${err.message}`);
}
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

// Relative markdown links inside scope docs — plus every plan file, since
// Plan 049 requires path checking across Plans 050–059 — must resolve.
{
  const linkScope = [...SCOPE];
  for (const entry of readdirSync(join(ROOT, "plans"))) {
    if (entry.endsWith(".md") && !linkScope.includes(`plans/${entry}`)) {
      linkScope.push(`plans/${entry}`);
    }
  }
  let linkCount = 0;
  for (const p of linkScope) {
    const dir = dirname(join(ROOT, p));
    const text = docs.has(p) ? docs.get(p) : read(p);
    for (const m of text.matchAll(/\]\(([^)#]+?\.md)(#[^)]*)?\)/g)) {
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
