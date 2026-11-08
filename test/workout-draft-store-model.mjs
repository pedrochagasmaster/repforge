import assert from "node:assert/strict";
import test from "node:test";
import { createHarness, runDraftStoreJourney } from "./generative/model/workout-draft-store.mjs";

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
