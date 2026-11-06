#!/usr/bin/env node
/* Release revisions of Taurifer's query-versioned shell assets (owner bug, 2026-11-06).
 *
 * A browser (its HTTP cache, or an older service worker's cache) can answer an unchanged URL with the previous
 * release's bytes during an update. A script or stylesheet whose content changes must therefore change URL: its
 * `?v=` revision in index.html (and the exact precache URL in sw.js). This check compares the branch with its fork
 * point on main: every versioned asset whose bytes changed must carry a revision above the one it had there.
 *
 *   node tools/asset-revisions.mjs [base-ref]   exit 1 when a changed asset kept its revision
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Every local script and stylesheet index.html loads, with its `?v=` revision or null. */
export function shellAssets(index = readFileSync(join(ROOT, "index.html"), "utf8")) {
  const out = [];
  const tag = /<(script)\b[^>]*\bsrc="([^"]+)"[^>]*>|<(link)\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g;
  for (const match of index.matchAll(tag)) {
    const url = match[2] || match[4];
    if (/^(?:[a-z]+:)?\/\//i.test(url)) continue;
    const [file, query = ""] = url.split("?");
    const revision = /^v=(\d+)$/.exec(query)?.[1] ?? null;
    out.push({ file, url, revision: revision == null ? null : Number(revision), kind: match[1] ? "script" : "style" });
  }
  return out;
}

/** The versioned assets whose content changed since `base` without a revision above the one they had there.
 *  `read(ref, file)` returns a file's text at a ref (null when absent); `head` is the working copy. */
export function staleRevisions({ read, base }) {
  const now = shellAssets(read("head", "index.html"));
  const before = new Map(shellAssets(read(base, "index.html") || "").map((asset) => [asset.file, asset.revision]));
  const problems = [];
  for (const asset of now.filter((item) => item.revision != null)) {
    const previous = read(base, asset.file);
    if (previous == null || previous === read("head", asset.file)) continue;
    const had = before.get(asset.file);
    if (had != null && !(asset.revision > had)) {
      problems.push(`${asset.file} changed but is still ?v=${asset.revision} (it was ?v=${had} on main): take the next revision ` +
        `(node tools/next-revision.mjs) for its index.html URL and its sw.js precache URL`);
    }
  }
  return problems;
}

const git = (args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
/** The fork point with main, or null where there is no history to compare with. */
export function forkPoint(requested) {
  for (const ref of requested ? [requested] : ["origin/main", "main"]) {
    try { return git(["merge-base", "HEAD", ref]).trim(); } catch {}
  }
  return null;
}
export function gitReader(base) {
  return (ref, file) => {
    if (ref === "head") return readFileSync(join(ROOT, file), "utf8");
    try { return git(["show", `${base}:${file}`]); } catch { return null; }
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const base = forkPoint(process.argv[2]);
  if (!base) { console.error("asset revisions: no fork point with main to compare with"); process.exit(1); }
  const problems = staleRevisions({ read: gitReader(base), base });
  if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
  console.log(`asset revisions: every changed versioned asset moved its revision since ${base.slice(0, 8)}`);
}
