#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sources = [
  { pr: 215, path: "docs/ui-screen-audit-opus-taste.md" },
  { pr: 216, path: "docs/taurifer-ui-audit-sol-design.md" },
  { pr: 217, path: "docs/ui-screen-audit-sol-taste.md" },
  { pr: 219, path: "docs/ui-audit-opus-design.md" },
];
const definitivePath = join(root, "docs/ui-audit.md");
const expectedFindingIds = Array.from(
  { length: 32 },
  (_, index) => `UI-${String(index + 1).padStart(2, "0")}`,
);
const expectedDecisionIds = Array.from(
  { length: 88 },
  (_, index) => `G-${String(index + 1).padStart(2, "0")}`,
);

function walkPngs(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory()
      ? walkPngs(path)
      : path.endsWith(".png")
        ? [path]
        : [];
  });
}

function candidates(markdown) {
  const headings = [...markdown.matchAll(/^###\s+(.+)$/gm)].map((match) => match[1].trim());
  const tableRows = [...markdown.matchAll(/^\|\s*([^|\n]+?)\s*\|/gm)]
    .map((match) => match[1].replace(/\*\*/g, "").trim())
    .filter((cell) =>
      cell &&
      !/^[-: ]+$/.test(cell) &&
      !["Screen", "Screens", "Area", "Claimed", "Token", "Pair", "Scope"].includes(cell),
    );
  return { headings, tableRows: [...new Set(tableRows)] };
}

function check() {
  const failures = [];
  for (const source of sources) {
    const sourcePath = join(root, source.path);
    if (!existsSync(sourcePath)) failures.push(`missing PR #${source.pr} source: ${source.path}`);
  }
  if (!existsSync(definitivePath)) failures.push("missing definitive report: docs/ui-audit.md");

  if (existsSync(definitivePath)) {
    const report = readFileSync(definitivePath, "utf8");
    for (const source of sources) {
      if (!report.includes(`PR #${source.pr}`)) failures.push(`definitive report does not cite PR #${source.pr}`);
      if (!report.includes(source.path)) failures.push(`definitive report does not cite ${source.path}`);
    }
    for (const id of expectedFindingIds) {
      if (!new RegExp(`^### ${id}\\b`, "m").test(report)) failures.push(`missing consolidated finding ${id}`);
    }
    const foundIds = [...report.matchAll(/^### (UI-\d{2})\b/gm)].map((match) => match[1]);
    if (new Set(foundIds).size !== foundIds.length) failures.push("duplicate consolidated finding ID");
    for (const id of expectedDecisionIds) {
      if (!new RegExp(`^\\| ${id},`, "m").test(report)) failures.push(`missing grilling decision ${id}`);
    }
    const foundDecisionIds = [...report.matchAll(/^\| (G-\d{2}),/gm)].map((match) => match[1]);
    if (new Set(foundDecisionIds).size !== foundDecisionIds.length) failures.push("duplicate grilling decision ID");
    if (!report.includes("**Status:** final and owner-approved")) failures.push("definitive report is not marked final and owner-approved");
  }

  if (failures.length) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exitCode = 1;
    return;
  }

  const manifest = JSON.parse(readFileSync(join(root, "docs/ui-screens/manifest.json"), "utf8"));
  const frames = walkPngs(join(root, "docs/ui-screens/screens")).length;
  console.log(`UI audit consolidation OK: ${manifest.screens.length} screens, ${frames} frames, ${sources.length} source PRs, ${expectedFindingIds.length} findings, ${expectedDecisionIds.length} decisions.`);
}

function printInventory() {
  const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const manifest = JSON.parse(readFileSync(join(root, "docs/ui-screens/manifest.json"), "utf8"));
  const frames = walkPngs(join(root, "docs/ui-screens/screens")).length;

  console.log(`# UI audit source inventory\n`);
  console.log(`Current baseline: ${commit}, ${manifest.screens.length} manifest screens, ${frames} catalog frames.\n`);
  for (const source of sources) {
    const markdown = readFileSync(join(root, source.path), "utf8");
    const { headings, tableRows } = candidates(markdown);
    console.log(`## PR #${source.pr}\n`);
    console.log(`Source: \`${source.path}\`\n`);
    console.log("Headings:");
    for (const heading of headings) console.log(`- ${heading}`);
    if (tableRows.length) {
      console.log("\nFirst-column table labels:");
      for (const row of tableRows) console.log(`- ${row}`);
    }
    console.log();
  }
}

if (process.argv.includes("--check")) check();
else printInventory();
