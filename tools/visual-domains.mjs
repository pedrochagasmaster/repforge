/** Reviewed mapping from source ownership to screen-catalog flows. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const VISUAL_DOMAINS = new Set(["history", "install", "library", "entry", "program", "progress", "session", "settings", "today", "workout", "global"]);
const ANNOTATION = /^\s*\/\/ @ci-domain (\S+)\s*$/;
const MAPPING = [
  [/^program-editor\.js$/, ["program", "entry"]],
  [/^program-entry(?:-adapter)?\.js$/, ["entry"]],
  [/^progress-model\.js$/, ["progress", "history"]],
  [/^progression-engine\.js$/, ["progress", "workout", "today"]],
  [/^guide-registry\.js$/, ["entry", "settings", "progress"]],
  [/^install-(?:policy|transfer)\.js$/, ["install", "entry", "settings"]],
  [/^notify\.js$/, ["today", "settings"]],
];

export function validateAnnotations(source) {
  const errors = [];
  source.split("\n").forEach((line, i) => {
    if (!line.includes("@ci-domain")) return;
    const match = line.match(ANNOTATION);
    if (!match || !VISUAL_DOMAINS.has(match[1])) errors.push(`app.js:${i + 1}: invalid @ci-domain annotation`);
  });
  return errors;
}

/** Assign each changed line to its nearest preceding annotation; unowned lines widen. */
export function domainsForAppDiff(source, diff) {
  const errors = validateAnnotations(source);
  if (errors.length) throw new Error(errors.join("\n"));
  if (!diff || !diff.includes("@@")) return new Set(["global"]);
  const owners = [];
  let owner = "global";
  source.split("\n").forEach((line, i) => {
    const match = line.match(ANNOTATION);
    if (match) owner = match[1];
    owners[i + 1] = owner;
  });
  const domains = new Set();
  let line = 0, hunk = false;
  for (const part of diff.split("\n")) {
    const header = part.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (header) { line = Number(header[1]); hunk = true; continue; }
    if (!hunk) continue;
    if (part.startsWith("+")) { domains.add(owners[line] || "global"); line++; }
    else if (part.startsWith("-")) domains.add(owners[line] || owners[line - 1] || "global");
    else if (part.startsWith(" ")) line++;
  }
  return domains.size ? domains : new Set(["global"]);
}

export function visualDomains(file, { cwd, base, source, diff } = {}) {
  if (file === "app.js") {
    const current = source ?? readFileSync(join(cwd, file), "utf8");
    let patch = diff;
    if (patch === undefined && base) {
      try { patch = execFileSync("git", ["diff", "--no-ext-diff", "--unified=0", base, "--", file], { cwd, encoding: "utf8" }); }
      catch { patch = null; }
    }
    return [...domainsForAppDiff(current, patch)];
  }
  const mapping = MAPPING.find(([pattern]) => pattern.test(file));
  return mapping ? mapping[1] : null;
}

export function screensForDomains(domains, manifest) {
  if (domains.has("global")) return null;
  return manifest.screens.filter((screen) => {
    const flow = screen.flow.startsWith("onboarding-") ? "entry" : screen.flow;
    return domains.has(flow);
  }).map((screen) => `${screen.flow}/${screen.id}`);
}
