/** Reviewed mapping from source ownership to screen-catalog flows. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const VISUAL_DOMAINS = new Set(["history", "install", "library", "entry", "program", "progress", "session", "settings", "today", "workout", "global"]);
// `// @ci-domain a,b` in app.js and `/* @ci-domain a,b */` in styles.css own every
// following line until the next marker. Only reviewed regions carry a domain;
// everything before the first marker, and any `global` region, widens.
const ANNOTATIONS = {
  js: /^\s*\/\/ @ci-domain (\S+)\s*$/,
  css: /^\s*\/\* @ci-domain (\S+) \*\/\s*$/,
};
const MAPPING = [
  [/^program-editor\.js$/, ["program", "entry"]],
  [/^program-entry(?:-adapter)?\.js$/, ["entry"]],
  [/^progress-model\.js$/, ["progress", "history"]],
  [/^progression-engine\.js$/, ["progress", "workout", "today"]],
  [/^history-ui\.js$/, ["history", "progress"]],
  [/^guide-registry\.js$/, ["entry", "settings", "progress", "workout", "today"]],
  [/^install-(?:policy|transfer)\.js$/, ["install", "entry", "settings"]],
  [/^notify\.js$/, ["today", "settings"]],
];
const ANNOTATED = { "app.js": "js", "styles.css": "css" };

function annotationDomains(value) {
  const domains = value.split(",");
  if (!domains.every((domain) => VISUAL_DOMAINS.has(domain)) || new Set(domains).size !== domains.length
    || (domains.includes("global") && domains.length > 1)) return null;
  return domains;
}

export function validateAnnotations(source, { kind = "js", file = kind === "css" ? "styles.css" : "app.js" } = {}) {
  const errors = [];
  source.split("\n").forEach((line, i) => {
    if (!line.includes("@ci-domain")) return;
    const match = line.match(ANNOTATIONS[kind]);
    if (!match || !annotationDomains(match[1])) errors.push(`${file}:${i + 1}: invalid @ci-domain annotation`);
  });
  return errors;
}

/** Assign each changed line to its nearest preceding annotation; unowned lines widen. */
export function domainsForAnnotatedDiff(source, diff, { kind = "js" } = {}) {
  const errors = validateAnnotations(source, { kind });
  if (errors.length) throw new Error(errors.join("\n"));
  if (!diff || !diff.includes("@@")) return new Set(["global"]);
  if (diff.split("\n").some((line) => /^[+-]/.test(line) && !/^(?:\+\+\+|---) /.test(line) && line.includes("@ci-domain"))) return new Set(["global"]);
  const owners = [];
  let owner = ["global"];
  source.split("\n").forEach((line, i) => {
    const match = line.match(ANNOTATIONS[kind]);
    if (match) owner = annotationDomains(match[1]);
    owners[i + 1] = owner;
  });
  const domains = new Set();
  const add = (values) => (values || ["global"]).forEach((domain) => domains.add(domain));
  let line = 0, hunk = false;
  for (const part of diff.split("\n")) {
    const header = part.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (header) { line = Number(header[1]); hunk = true; continue; }
    if (!hunk) continue;
    if (part.startsWith("+")) { add(owners[line]); line++; }
    else if (part.startsWith("-")) add(owners[line] || owners[line - 1]);
    else if (part.startsWith(" ")) line++;
  }
  return domains.size ? domains : new Set(["global"]);
}

export function domainsForAppDiff(source, diff) {
  return domainsForAnnotatedDiff(source, diff, { kind: "js" });
}

export function visualDomains(file, { cwd, base, source, diff } = {}) {
  if (ANNOTATED[file]) {
    const current = source ?? readFileSync(join(cwd, file), "utf8");
    let patch = diff;
    if (patch === undefined && base) {
      try { patch = execFileSync("git", ["diff", "--no-ext-diff", "--unified=0", base, "--", file], { cwd, encoding: "utf8" }); }
      catch { patch = null; }
    }
    return [...domainsForAnnotatedDiff(current, patch, { kind: ANNOTATED[file] })];
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
