import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { ROOT, captureKey, capturePath, expandCaptures, loadManifest, screenKey } from "./ui-screens/manifest.mjs";

// Each row has a distinct risk. This deliberately replaces the exhaustive
// locale/theme cross-product; omitted variants have no equivalence guarantee.
export const CRITICAL_UI = Object.freeze([
  ["today/no-program", "light", "en"],
  ["today/ready", "dark", "en"],
  ["workout/focus", "light", "en"],
  ["workout/focus-per-side", "dark", "en"],
  ["workout/rest-running", "dark", "en"],
  ["workout/why-manual", "light", "pt"],
  ["workout/early-finish", "dark", "en"],
  ["session/summary", "light", "pt"],
  ["history/edit-invalid", "dark", "en"],
  ["history/delete-confirm", "light", "pt"],
  ["progress/exercise-chart", "light", "pt", "text200"],
  ["progress/review", "dark", "en"],
  ["program/overview", "light", "en"],
  ["program/custom-exercise-recovery", "dark", "en"],
  ["onboarding-recommend/result", "light", "pt", "text200"],
  ["onboarding-import/review", "dark", "en"],
  ["onboarding-shared/gate", "light", "pt"],
  ["settings/privacy-disclosure", "dark", "en"],
  ["settings/guides-replay", "light", "en"],
  ["install/transfer-destination", "light", "pt"],
  ["catalog-recovery/unavailable", "dark", "en"],
]);

export function criticalCaptures(manifest = loadManifest()) {
  const available = expandCaptures(manifest);
  return CRITICAL_UI.map(([key, theme, locale, text = "normal"]) => {
    const capture = available.find(c => screenKey(c) === key && c.viewport === "phone-390"
      && c.theme === theme && c.locale === locale && c.text === text && c.motion === "normal");
    if (!capture) throw new Error(`Critical UI matrix has no registered capture: ${key}/${theme}/${locale}/${text}`);
    return capture;
  });
}

export function sourceHead() {
  return process.env.CI_SOURCE_SHA || process.env.GITHUB_SHA
    || execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
}

export function validateCriticalReport(report, { source = sourceHead(), keys = criticalCaptures().map(captureKey) } = {}) {
  const problems = [];
  if (!/^[a-f0-9]{40}$/.test(source || "") || !/^[a-f0-9]{40}$/.test(report?.source || "")) problems.push("invalid immutable source identity");
  if (report?.schemaVersion !== 1 || report?.kind !== "critical-ui") problems.push("unsupported critical UI report");
  if (report?.source !== source) problems.push("foreign source critical UI report");
  if (report?.status !== "passed") problems.push("critical UI initial execution failed");
  const rows = Array.isArray(report?.cells) ? report.cells : [];
  if (rows.length !== keys.length) problems.push(`expected ${keys.length} critical cells, got ${rows.length}`);
  const seen = new Set();
  for (const cell of rows) {
    if (!keys.includes(cell.key) || seen.has(cell.key)) problems.push(`unknown or duplicate critical cell: ${cell.key}`);
    seen.add(cell.key);
    if (cell.status !== "passed" || cell.pixelComparison !== true || cell.semanticComparison !== true
      || !/^[a-f0-9]{64}$/.test(cell.pixelDigest || "") || !Number.isInteger(cell.roleMeasurements) || cell.roleMeasurements < 1
      || !Array.isArray(cell.problems) || cell.problems.length) problems.push(`failed or incomplete critical cell: ${cell.key}`);
  }
  for (const key of keys) if (!seen.has(key)) problems.push(`missing critical cell: ${key}`);
  return problems;
}

export function mergeCriticalReports(root, options) {
  const reports = [];
  const paths = [];
  function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      // Paired benchmarks link each immutable phase's artifact directory into
      // its own union. Follow directory links just as the original gate does.
      if (entry.isDirectory() || (entry.isSymbolicLink() && statSync(path).isDirectory())) {
        if (!/replay|diagnostic/.test(entry.name)) visit(path);
      } else if (entry.name === "ui-critical-report.json") {
        paths.push(path);
        try { reports.push(JSON.parse(readFileSync(path, "utf8"))); }
        catch { reports.push(null); }
      }
    }
  }
  try { visit(root); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const problems = reports.length === 1 ? validateCriticalReport(reports[0], options)
    : [`expected one initial critical UI report, got ${reports.length}`];
  if (reports.length === 1 && !problems.length) {
    const report = reports[0], dir = dirname(paths[0]);
    try {
      const execution = JSON.parse(readFileSync(join(dir, "..", "evidence.json"), "utf8"));
      if (execution.kind !== "browser-contract-execution" || execution.result !== "passed"
        || execution.source?.head !== report.source || execution.source?.dirty !== false
        || JSON.stringify(execution.command) !== JSON.stringify(["node", "test/ui-system.mjs"]))
        problems.push("critical UI initial execution provenance failed");
    } catch { problems.push("missing critical UI initial execution provenance"); }
    const manifest = loadManifest();
    for (const capture of criticalCaptures(manifest)) {
      const cell = report.cells.find(c => c.key === captureKey(capture));
      try {
        const bytes = readFileSync(capturePath(manifest, capture, join(dir, "frames")));
        if (createHash("sha256").update(bytes).digest("hex") !== cell?.pixelDigest)
          problems.push(`critical frame digest mismatch: ${captureKey(capture)}`);
      } catch { problems.push(`missing critical frame bytes: ${captureKey(capture)}`); }
    }
  }
  return { problems, shards: reports.length, screens: reports[0]?.cells?.length || 0 };
}

/**
 * The critical matrix failed only because fresh frames or entry semantics differ from the committed
 * catalog: every failed cell's problems are its frame problems. Live role findings, scenario errors and
 * protocol assertions stay replayable.
 */
export function deterministicCriticalFailure(cells) {
  const failed = (cells || []).filter((cell) => cell.status !== "passed");
  if (!failed.length || !failed.every((cell) => cell.frameProblems > 0 && cell.frameProblems === cell.problems.length)) return null;
  return `${failed.length} critical frame(s) differ from the committed catalog`;
}
