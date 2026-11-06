#!/usr/bin/env node
/** Print the next free CACHE/script revision above main and every open PR's claim. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CACHE_DECLARATION = /\bconst CACHE = "repforge-v([1-9]\d*)";/;
const QUERY_REVISION = /\?v=(\d+)\b/g;

/** The highest revision a tree ships: its sw.js CACHE or any `?v=` in index.html. */
export function revisionOf({ sw = "", index = "" } = {}) {
  const values = [];
  const cache = sw.match(CACHE_DECLARATION);
  if (cache) values.push(Number(cache[1]));
  for (const match of index.matchAll(QUERY_REVISION)) values.push(Number(match[1]));
  return values.length ? Math.max(...values) : null;
}

/**
 * main: { sw, index }; prs: [{ number, branch, sw, index }]; self: the PR asking.
 * A PR claims a revision only when it is above main's. `self` keeps its claim
 * when no other PR holds the same number; otherwise it takes the next free one.
 */
export function planRevision({ main, prs = [], self = null }) {
  const base = revisionOf(main);
  if (base === null) throw new Error("main has no CACHE revision");
  const claims = prs
    .map((pr) => ({ number: pr.number, branch: pr.branch ?? null, revision: revisionOf(pr) }))
    .filter((claim) => claim.revision !== null && claim.revision > base)
    .sort((a, b) => a.revision - b.revision || a.number - b.number);
  const holders = new Map();
  for (const claim of claims) holders.set(claim.revision, [...(holders.get(claim.revision) || []), claim.number]);
  const collisions = [...holders].filter(([, numbers]) => numbers.length > 1)
    .map(([revision, numbers]) => ({ revision, prs: numbers }));
  const others = claims.filter((claim) => claim.number !== self);
  const own = claims.find((claim) => claim.number === self) || null;
  const keep = own && !others.some((claim) => claim.revision === own.revision);
  const next = keep ? own.revision : Math.max(base, ...others.map((claim) => claim.revision)) + 1;
  return { main: base, claims, collisions, self, keep: Boolean(keep), next };
}

export function formatPlan(plan) {
  const lines = [`main: v${plan.main}`];
  for (const claim of plan.claims) {
    const mark = claim.number === plan.self ? " (this PR)" : "";
    lines.push(`#${claim.number}${claim.branch ? ` ${claim.branch}` : ""}: v${claim.revision}${mark}`);
  }
  for (const collision of plan.collisions) {
    lines.push(`collision: v${collision.revision} is claimed by ${collision.prs.map((n) => `#${n}`).join(", ")}`);
  }
  lines.push(plan.keep ? `next: v${plan.next} (keep this PR's claim)` : `next: v${plan.next}`);
  return lines.join("\n");
}

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
}

function raw(repo, path, ref) {
  try {
    return gh(["api", "-H", "Accept: application/vnd.github.raw", `repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`]);
  } catch { return ""; }
}

function live(repo) {
  const tree = (ref) => ({ sw: raw(repo, "sw.js", ref), index: raw(repo, "index.html", ref) });
  const open = JSON.parse(gh(["pr", "list", "-R", repo, "--state", "open", "--limit", "100", "--json", "number,headRefName,headRefOid"]));
  return {
    main: tree("main"),
    prs: open.map((pr) => ({ number: pr.number, branch: pr.headRefName, ...tree(pr.headRefOid) })),
  };
}

function usage() {
  return "usage: node tools/next-revision.mjs [--repo owner/name] [--pr N] [--json] [--input state.json]";
}

export function parseArgs(argv) {
  const options = { repo: null, self: null, json: false, input: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") options.json = true;
    else if (arg === "--repo") options.repo = argv[++i];
    else if (arg === "--pr") options.self = Number(argv[++i]);
    else if (arg === "--input") options.input = argv[++i];
    else throw new Error(`unknown argument ${arg}\n${usage()}`);
  }
  if (options.self !== null && !Number.isInteger(options.self)) throw new Error(`--pr needs a PR number\n${usage()}`);
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const state = options.input
      ? JSON.parse(readFileSync(options.input, "utf8"))
      : live(options.repo || JSON.parse(gh(["repo", "view", "--json", "nameWithOwner"])).nameWithOwner);
    const plan = planRevision({ ...state, self: options.self });
    console.log(options.json ? JSON.stringify(plan, null, 2) : formatPlan(plan));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
