#!/usr/bin/env node
/**
 * Place the catalog frames a CI run rendered differently onto this checkout:
 *
 *   node tools/fetch-ci-captures.mjs <run-id> [--dry-run] [--allow-source-mismatch]
 *
 * Downloads the run's `ci-captures-*` artifacts (published by the critical UI
 * matrix and the full-lane catalog verify when a frame differs), checks that
 * they were rendered from this checkout's HEAD and that every path is a
 * registered catalog frame, then writes them under docs/ui-screens/screens/.
 * Review the frames before committing them; verification stays strict, so the
 * committed frames must still match what CI renders on the next run.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, capturePath, expandCaptures, loadManifest } from "./ui-screens/manifest.mjs";
import { CI_CAPTURES_KIND } from "./ci-captures.mjs";

function changeManifests(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/^changes-[A-Za-z0-9._-]+\.json$/.test(entry)) found.push(path);
    }
  };
  if (existsSync(root)) walk(root);
  return found.sort();
}

/** Validate every published manifest and copy its frames onto `targetRoot`; throws before writing anything invalid. */
export function placeCiCaptures({ downloadRoot, targetRoot = ROOT, manifest = loadManifest(), expectedSource, allowSourceMismatch = false, dryRun = false }) {
  const registered = new Set(expandCaptures(manifest).map((capture) =>
    relative(ROOT, capturePath(manifest, capture)).replaceAll("\\", "/")));
  const planned = new Map();
  const states = new Set();
  const semantic = [];
  for (const path of changeManifests(downloadRoot)) {
    const changes = JSON.parse(readFileSync(path, "utf8"));
    if (changes?.schemaVersion !== 1 || changes.kind !== CI_CAPTURES_KIND || !Array.isArray(changes.frames)) {
      throw new Error(`${path}: not a ci-captures manifest`);
    }
    if (!allowSourceMismatch && changes.source !== expectedSource) {
      throw new Error(`${changes.producer}: frames were rendered from source ${changes.source}, not ${expectedSource}; check out that commit or pass --allow-source-mismatch`);
    }
    if (changes.semanticChanged) semantic.push(changes.producer);
    for (const frame of changes.frames) {
      if (!registered.has(frame.path)) throw new Error(`${changes.producer}: ${frame.path} is not a registered catalog frame`);
      const bytes = readFileSync(join(dirname(path), "frames", frame.path));
      const earlier = planned.get(frame.path);
      if (earlier && !earlier.equals(bytes)) throw new Error(`${frame.path}: two CI producers rendered different bytes`);
      planned.set(frame.path, bytes);
      states.add(frame.state);
    }
  }
  if (!dryRun) {
    for (const [path, bytes] of planned) {
      const target = join(targetRoot, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes);
    }
  }
  return { written: [...planned.keys()].sort(), states: [...states].sort(), semantic };
}

function main(argv) {
  const run = argv.find((arg) => !arg.startsWith("--"));
  if (!run || !/^\d+$/.test(run)) throw new Error("Usage: node tools/fetch-ci-captures.mjs <run-id> [--dry-run] [--allow-source-mismatch]");
  const unknown = argv.filter((arg) => arg.startsWith("--") && !["--dry-run", "--allow-source-mismatch"].includes(arg));
  if (unknown.length) throw new Error(`Unknown argument(s): ${unknown.join(" ")}`);
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  const download = mkdtempSync(join(tmpdir(), "taurifer-ci-captures-"));
  try {
    try {
      execFileSync("gh", ["run", "download", run, "--pattern", "ci-captures-*", "--dir", download], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      if (/no valid artifacts found/i.test(String(error.stderr))) { console.log(`Run ${run} published no changed frames.`); return; }
      throw error;
    }
    const placed = placeCiCaptures({ downloadRoot: download, expectedSource: head,
      allowSourceMismatch: argv.includes("--allow-source-mismatch"), dryRun: argv.includes("--dry-run") });
    console.log(`${argv.includes("--dry-run") ? "Would place" : "Placed"} ${placed.written.length} frame(s) for ${placed.states.length} state(s) from run ${run}:`);
    for (const state of placed.states) console.log(`  ${state}`);
    if (placed.semantic.length) console.log(`Entry semantics also changed (${placed.semantic.join(", ")}); recapture those onboarding states locally with --accept-visual-change to refresh docs/ui-screens/entry-semantics.json.`);
    if (placed.written.length && !argv.includes("--dry-run")) console.log("Review the frames (git diff --stat docs/ui-screens), then commit them.");
  } finally { rmSync(download, { recursive: true, force: true }); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
