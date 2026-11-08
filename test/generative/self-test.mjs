import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync } from "node:fs";
import fc from "fast-check";
import { createHarness, runDraftStoreJourney } from "./model/workout-draft-store.mjs";
import { fnv1a, parseArgs, parameters, PROFILES, SUITE_FILES } from "./run.mjs";

test("all property modules are scheduled, not silently orphaned", () => {
  const files = readdirSync(new URL("./properties/", import.meta.url)).filter((f) => f.endsWith(".mjs")).map((f) => f.slice(0, -4)).sort();
  assert.deepEqual([...SUITE_FILES].sort(), files);
});
test("seed zero, exact replay, and exact-SHA CI seeds are deterministic", () => {
  assert.equal(parseArgs([], { REPFORGE_GENERATIVE_SEED: "0" }).seed, 0);
  const sha = "a".repeat(40);
  assert.equal(parseArgs([], { CI_SOURCE_SHA: sha }).seed, fnv1a(sha));
  assert.equal(parseArgs([], { CI_SOURCE_SHA: sha }).seed, parseArgs([], { CI_SOURCE_SHA: sha }).seed);
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


const save = { type: "save" };
const remove = { type: "remove" };
const reboot = { type: "reboot" };

for (const [point, command] of [
  ["before-canonical-write", save], ["after-canonical-write", save],
  ["before-canonical-remove", remove], ["after-canonical-remove", remove],
]) {
  test(`draft store model reaches ${point} and reconciles`, async () => {
    const h = createHarness();
    try {
      await runDraftStoreJourney(h, [save, { type: "fault", point }, command, reboot,
        { type: "staleSave" }, save, remove, reboot]);
      assert.equal(h.outcomes[2].status, point.startsWith("before") ? "fault-before-canonical" : "fault-after-canonical");
      assert.equal(h.outcomes[3].status, "ok");
      assert.equal(h.faultPoint, null);
    } finally { h.dispose(); }
  });
}

for (const [name, keyPrefix, skipMatches, command, status] of [
  ["save pending checkpoint", "repforge_draft_v1:v2-checkpoint", 0, save, "checkpoint-failed"],
  ["save canonical", "repforge_draft_v1", 1, save, "write-failed"],
  ["save committed checkpoint", "repforge_draft_v1:v2-checkpoint", 1, save, "checkpoint-commit-failed"],
  ["removal pending checkpoint", "repforge_draft_v1:v2-checkpoint", 0, remove, "checkpoint-write"],
  ["removal tombstone", "repforge_draft_v1:v2-checkpoint", 1, remove, "checkpoint-commit-failed"],
]) {
  test(`draft store model reaches quota at ${name}`, async () => {
    const h = createHarness();
    try {
      await runDraftStoreJourney(h, [save, { type: "quota", keyPrefix, skipMatches }, command,
        reboot, save, remove, reboot]);
      assert.equal(h.outcomes[2].status, status);
      assert.equal(h.outcomes[3].status, "ok");
      assert.equal(h.failNext, null);
    } finally { h.dispose(); }
  });
}

test("failed boot repair retains uncertainty until the next successful repair", async () => {
  const h = createHarness();
  try {
    await runDraftStoreJourney(h, [
      { type: "quota", keyPrefix: "repforge_draft_v1", skipMatches: 1 }, save,
      { type: "quota", keyPrefix: "repforge_draft_v1" }, reboot, save, reboot,
    ]);
    assert.equal(h.outcomes[1].status, "write-failed");
    assert.equal(h.outcomes[3].status, "recovery-write-failed");
    assert.equal(h.outcomes[4].status, "checkpoint-conflict");
    assert.equal(h.outcomes[5].status, "ok");
  } finally { h.dispose(); }
});

test("model rejects acknowledged publication loss and stale writer acceptance", async () => {
  const h = createHarness();
  const store = h.DurableState.DraftStore;
  const original = store.compareAndSwapV2;
  try {
    store.compareAndSwapV2 = async () => ({ status: "applied" });
    await assert.rejects(runDraftStoreJourney(h, [save]), /applied save must publish its exact aggregate/);
    h.reset();
    store.compareAndSwapV2 = async options => {
      if (options.expectedRevision === -1) return { status: "applied" };
      return original.call(store, options);
    };
    await assert.rejects(runDraftStoreJourney(h, [save, { type: "staleSave" }]), /stale save returned applied/);
  } finally {
    store.compareAndSwapV2 = original;
    h.dispose();
  }
});

test("model rejects reboot loss and phantom drafts", async () => {
  for (const phantom of [false, true]) {
    const h = createHarness();
    const original = h.DurableState.reconcileV2Checkpoint;
    try {
      h.DurableState.reconcileV2Checkpoint = async () => {
        if (phantom) {
          const raw = h.DurableState.DraftStore.readCanonicalRaw();
          const draft = JSON.parse(raw);
          draft.draftId = "never-proposed";
          h.storage.set(h.DurableState.DRAFT, JSON.stringify(draft));
        } else h.storage.delete(h.DurableState.DRAFT);
        return { status: "ok" };
      };
      await assert.rejects(runDraftStoreJourney(h, [save, reboot]), /I3: reboot lost an acknowledged draft or invented one/);
    } finally {
      h.DurableState.reconcileV2Checkpoint = original;
      h.dispose();
    }
  }
});
