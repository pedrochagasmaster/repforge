import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync } from "node:fs";
import fc from "fast-check";
import { parseArgs, parameters, PROFILES, SUITE_FILES } from "./run.mjs";

test("all property modules are scheduled, not silently orphaned", () => {
  const files = readdirSync(new URL("./properties/", import.meta.url)).filter((f) => f.endsWith(".mjs")).map((f) => f.slice(0, -4)).sort();
  assert.deepEqual([...SUITE_FILES].sort(), files);
});
test("seed zero and exact replay are validated", () => {
  assert.equal(parseArgs([], { REPFORGE_GENERATIVE_SEED: "0" }).seed, 0);
  assert.equal(parseArgs(["--seed", "0"], {}).seed, 0);
  assert.equal(parseArgs(["--property", "example", "--seed", "42", "--path", "0:1"], {}).path, "0:1");
  for (const args of [["--seed"], ["--seed", "no"], ["--seed", "1.5"], ["--profile", "unknown"], ["--path", "0"], ["--filter", "x", "--property", "x"]]) {
    assert.throws(() => parseArgs(args, {}));
  }
});
test("a failure shrinks and the recorded path replays the minimized counterexample", async () => {
  const property = fc.property(fc.integer({ min: 0, max: 10000 }), (n) => n < 10);
  const result = await fc.check(property, parameters(PROFILES.smoke, 42));
  assert.equal(result.failed, true);
  assert.deepEqual(result.counterexample, [10]);
  assert.ok(result.numShrinks > 0);
  const replay = await fc.check(property, parameters(PROFILES.smoke, result.seed, result.counterexamplePath));
  assert.equal(replay.failed, true);
  assert.deepEqual(replay.counterexample, result.counterexample);
  assert.equal(replay.numShrinks, 0);
});
test("bounded interruptions are failures, not silently successful sampling", async () => {
  const params = parameters({ numRuns: 100, budgetMs: 5 }, 42);
  assert.equal(params.endOnFailure, false);
  assert.equal(params.markInterruptAsFailure, true);
  const result = await fc.check(fc.asyncProperty(fc.integer(), async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
    return true;
  }), params);
  assert.ok(result.failed || result.interrupted);
});
