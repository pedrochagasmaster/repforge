#!/usr/bin/env node
/** Pure properties. Seeds and minimized paths are replayable; interruptions fail. */
import fc from "fast-check";
import { performance } from "node:perf_hooks";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PROFILES = {
  smoke: { numRuns: 100, budgetMs: 120000 },
  ci: { numRuns: 300, budgetMs: 120000 },
  deep: { numRuns: 1000, budgetMs: 600000 },
  campaign: { numRuns: 5000, budgetMs: 900000 },
};
export const SUITE_FILES = [
  "canonicalization", "setup-links", "schema-boundaries", "identity", "malformed-inputs",
  "progression-range", "progression-strategies", "program-entry", "program-compiler",
];

export function parseArgs(argv, env = process.env) {
  const args = { profile: env.REPFORGE_GENERATIVE_PROFILE || "smoke", seed: env.REPFORGE_GENERATIVE_SEED };
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    if (name === "--list") { args.list = true; continue; }
    if (!["--profile", "--seed", "--filter", "--property", "--path"].includes(name)) throw new Error(`Unknown argument: ${name}`);
    const value = argv[++i];
    if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for ${name}`);
    args[name.slice(2)] = value;
  }
  if (!Object.hasOwn(PROFILES, args.profile)) throw new Error(`Unknown profile: ${args.profile}`);
  if (args.seed !== undefined) {
    if (!/^-?\d+$/.test(String(args.seed)) || Number(args.seed) < -2147483648 || Number(args.seed) > 4294967295) throw new Error("Seed must be a 32-bit integer");
    args.seed = Number(args.seed) >>> 0;
  }
  if (args.filter !== undefined && args.property !== undefined) throw new Error("Use --filter or exact --property, not both");
  if (args.path !== undefined && (!args.property || args.seed === undefined || !/^\d+(?::\d+)*$/.test(args.path))) {
    throw new Error("--path requires an exact --property, a --seed, and a fast-check numeric path");
  }
  return args;
}

export function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return hash >>> 0;
}
export function parameters(profile, seed, path) {
  return {
    numRuns: profile.numRuns, seed, verbose: true,
    // No-path runs shrink by default. An exact path replays the minimized case.
    endOnFailure: path !== undefined,
    ...(path !== undefined ? { path } : {}),
    interruptAfterTimeLimit: profile.budgetMs,
    markInterruptAsFailure: true,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const profile = PROFILES[args.profile];
  const suites = [];
  for (const file of SUITE_FILES) {
    const module = await import(`./properties/${file}.mjs`);
    for (const suite of module.buildSuites()) suites.push({ ...suite, file });
  }
  if (new Set(suites.map((s) => s.name)).size !== suites.length) throw new Error("Property names must be unique for exact replay");
  if (args.list) { for (const s of suites) console.log(`${s.file}\t${s.name}`); console.log(`${suites.length} suites`); return; }
  const selected = suites.filter((s) => args.property !== undefined ? s.name === args.property : args.filter === undefined || s.name.includes(args.filter));
  if (!selected.length) throw new Error("No property matches the requested filter");
  const masterSeed = args.seed ?? (Date.now() ^ (fnv1a(String(process.pid)) << 8)) >>> 0;
  console.log(`Generative properties — profile=${args.profile} numRuns=${profile.numRuns} masterSeed=${masterSeed}`);
  const results = [];
  const started = performance.now();
  const save = () => {
    if (!process.env.REPFORGE_ARTIFACT_DIR) return;
    mkdirSync(process.env.REPFORGE_ARTIFACT_DIR, { recursive: true });
    writeFileSync(join(process.env.REPFORGE_ARTIFACT_DIR, "generative.json"), JSON.stringify({ profile: args.profile, masterSeed, results }, null, 2) + "\n");
  };
  for (const suite of selected) {
    const suiteSeed = (masterSeed ^ fnv1a(suite.name)) >>> 0;
    const t = performance.now();
    const result = await fc.check(suite.property, parameters(profile, suiteSeed, args.path));
    const failed = result.failed || result.interrupted;
    const row = {
      file: suite.file, name: suite.name, failed, interrupted: result.interrupted,
      durationMs: Math.round(performance.now() - t), seed: suiteSeed,
      numRuns: result.numRuns, numShrinks: result.numShrinks,
      path: result.counterexamplePath, counterexample: result.counterexample,
      error: result.errorInstance ? String(result.errorInstance.stack || result.errorInstance) : null,
    };
    results.push(row); save();
    console.log(`  ${failed ? "✗" : "✓"} [${suite.file}] ${suite.name} (${(row.durationMs / 1000).toFixed(1)}s)`);
    if (failed) {
      console.error(JSON.stringify(row, null, 2));
      const replay = `node test/generative/run.mjs --profile ${args.profile} --property ${JSON.stringify(suite.name)} --seed ${masterSeed}`;
      console.error(`REPLAY: ${replay}${result.counterexamplePath && !result.interrupted ? ` --path ${result.counterexamplePath}` : ""}`);
      if (result.interrupted) console.error(`Budget exhausted (${profile.budgetMs}ms); this is a failure, never a successful early stop.`);
    }
  }
  const failed = results.filter((r) => r.failed).length;
  console.log(`\n${results.length - failed}/${results.length} suites passed in ${((performance.now() - started) / 1000).toFixed(1)}s`);
  process.exitCode = failed ? 1 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
}
