#!/usr/bin/env node
/**
 * Generative property runner (Phase 1 of the generative testing
 * architecture — pure Node properties, no browser, no server).
 *
 * Usage:
 *   node generative/run.mjs [--profile smoke|ci|deep|campaign]
 *                           [--seed N] [--filter substring] [--list]
 *
 * Environment:
 *   REPFORGE_GENERATIVE_PROFILE   default profile when --profile is absent
 *   REPFORGE_GENERATIVE_SEED      default seed when --seed is absent
 *
 * Failure output follows the reproducibility contract in README.md: the
 * profile, suite name, master seed and fast-check's own seed/path block
 * are printed so any failure can be replayed exactly.
 */
import fc from "fast-check";
import { performance } from "perf_hooks";

const PROFILES = {
  smoke: { numRuns: 100 },
  ci: { numRuns: 300 },
  deep: { numRuns: 1000 },
  campaign: { numRuns: 5000 },
};

const SUITE_FILES = [
  "canonicalization",
  "setup-links",
  "schema-boundaries",
  "identity",
  "malformed-inputs",
  "program-entry",
];

function parseArgs(argv) {
  const args = { profile: process.env.REPFORGE_GENERATIVE_PROFILE || "smoke" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--profile") args.profile = argv[++i];
    else if (argv[i] === "--seed") args.seed = Number(argv[++i]);
    else if (argv[i] === "--filter") args.filter = argv[++i];
    else if (argv[i] === "--list") args.list = true;
    else {
      console.error(`Unknown argument: ${argv[i]}`);
      process.exit(2);
    }
  }
  return args;
}

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const profile = PROFILES[args.profile];
  if (!profile) {
    console.error(`Unknown profile "${args.profile}". Known: ${Object.keys(PROFILES).join(", ")}`);
    process.exit(2);
  }

  const suites = [];
  for (const file of SUITE_FILES) {
    const module = await import(`./properties/${file}.mjs`);
    const built = module.buildSuites();
    for (const suite of built) suites.push({ ...suite, file });
  }

  if (args.list) {
    for (const suite of suites) console.log(`${suite.file}\t${suite.name}`);
    console.log(`\n${suites.length} suites`);
    return;
  }

  const filtered = args.filter ? suites.filter((suite) => suite.name.includes(args.filter)) : suites;
  if (!filtered.length) {
    console.error(`No suite matches filter "${args.filter}"`);
    process.exit(2);
  }

  const masterSeed =
    args.seed !== undefined && !Number.isNaN(args.seed)
      ? args.seed >>> 0
      : (Number(process.env.REPFORGE_GENERATIVE_SEED) || (Date.now() ^ (fnv1a(String(process.pid)) << 8))) >>> 0;

  console.log(`Generative properties — profile=${args.profile} numRuns=${profile.numRuns} masterSeed=${masterSeed}`);
  console.log("Re-run exactly with: REPFORGE_GENERATIVE_SEED=<masterSeed> node test/generative/run.mjs " +
    `--profile ${args.profile}${args.filter ? ` --filter "${args.filter}"` : ""}\n`);

  let passed = 0;
  const failures = [];
  const startedAll = performance.now();

  for (const suite of filtered) {
    const suiteSeed = (masterSeed ^ fnv1a(suite.name)) >>> 0;
    const params = {
      numRuns: profile.numRuns,
      seed: suiteSeed,
      verbose: true,
      endOnFailure: true,
    };
    const started = performance.now();
    try {
      await fc.assert(suite.property, params);
      passed++;
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      console.log(`  ✓ [${suite.file}] ${suite.name} (${seconds}s)`);
    } catch (error) {
      failures.push({ suite, error });
      console.log(`  ✗ [${suite.file}] ${suite.name}`);
    }
  }

  const totalSeconds = ((performance.now() - startedAll) / 1000).toFixed(1);

  if (failures.length) {
    console.log(`\n${failures.length} property suite(s) failed:\n`);
    for (const { suite, error } of failures) {
      console.log("──────────────────────────────────────────────────────");
      console.log(`PROPERTY:\n  ${suite.name}`);
      console.log(`PROFILE:\n  ${args.profile} (numRuns=${profile.numRuns})`);
      console.log(`MASTER SEED:\n  ${masterSeed}`);
      console.log(`SUITE SEED:\n  ${(masterSeed ^ fnv1a(suite.name)) >>> 0}`);
      console.log("COUNTEREXAMPLE / DETAILS:");
      console.log(
        String(error.message)
          .split("\n")
          .map((line) => `  ${line}`)
          .join("\n"),
      );
      console.log("REPLAY:");
      console.log(`  node test/generative/run.mjs --profile ${args.profile} --filter "${suite.name}" --seed ${masterSeed}`);
    }
    console.log("──────────────────────────────────────────────────────");
  }

  console.log(`\n${passed}/${filtered.length} suites passed in ${totalSeconds}s`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
