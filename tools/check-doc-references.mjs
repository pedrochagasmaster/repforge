#!/usr/bin/env node
// Verify that document removals leave no working-tree references behind.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

export function removedReferences(file, text, removed) {
  const problems = [];
  for (const [index, line] of text.split("\n").entries()) {
    const paths = line.match(/(?:\.\.\/|\.\/)?[\w.-]+(?:\/[\w.-]+)*\.(?:md|mjs|html|json|py|txt|csv|png|jpg|webp|patch)/g) || [];
    for (const path of new Set(paths)) {
      const relative = posix.normalize(posix.join(posix.dirname(file), path));
      const target = removed.has(path) ? path : removed.has(relative) ? relative : null;
      if (target) problems.push(`${file}:${index + 1}: reference to removed ${target}`);
    }
  }
  return problems;
}

export function checkRemovedReferences(root, base) {
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  const removed = new Set(git("diff", "--no-renames", "--name-only", "--diff-filter=D", "-z", base, "--").split("\0").filter(Boolean));
  const files = new Set(git("ls-files", "--cached", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean));
  const problems = [];
  for (const file of files) {
    if (removed.has(file) || !/\.(?:md|mjs|js|html|json|ya?ml|py|sh|txt|csv|tsv)$/.test(file)) continue;
    const path = join(root, file);
    if (!existsSync(path)) continue;
    problems.push(...removedReferences(file, readFileSync(path, "utf8"), removed));
  }
  return { removed: removed.size, problems };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const base = process.argv[process.argv.indexOf("--base") + 1];
  if (!process.argv.includes("--base") || !base) throw new Error("Usage: node tools/check-doc-references.mjs --base <commit>");
  const result = checkRemovedReferences(root, base);
  for (const problem of result.problems) console.error(problem);
  console.log(`Checked references to ${result.removed} removed files`);
  process.exitCode = result.problems.length ? 1 : 0;
}
