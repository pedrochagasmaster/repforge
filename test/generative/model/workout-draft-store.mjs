import assert from "node:assert/strict";
import DurableState from "../../../durable-state.js";
import Draft from "../../../workout-draft.js";

const timestamp = "2026-09-12T10:00:00.000Z";
const writer = { installationId: "store-install", tabId: "store-tab" };
const context = {
  programId: "store-program", programFingerprint: "store-context", durableRevision: 4,
  dayId: "store-day", dayLabel: "Day 1", scheduleDate: "2026-09-12", unit: "kg", rirMode: "numeric",
  exercises: [{
    exerciseInstanceId: "store-slot", sourceExerciseId: "store-source", displayName: "Store proof",
    sets: 1, setIds: ["store-set"], minReps: 6, maxReps: 10, targetRir: 2,
    notes: "", primary: "Quads", secondary: "", movementPattern: "squat",
    progressionStrategy: "double_progression", sourceFingerprint: "store-source-fingerprint",
    programmedSets: [{ suggestedLoad: 20, suggestedReps: 8, targetRir: 2 }],
  }],
};

export function createHarness() {
  const descriptors = new Map(["localStorage", "navigator", "workoutDraftFault"].map(key =>
    [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const storage = new Map();
  const h = {
    DurableState, Draft, storage, faultPoint: null, failNext: null, recovery: [], outcomes: [],
    reset() {
      storage.clear();
      h.faultPoint = null;
      h.failNext = null;
      h.recovery.length = 0;
      h.outcomes.length = 0;
    },
    dispose() {
      for (const [key, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    },
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    get length() { return storage.size; },
    key(index) { return [...storage.keys()][index] ?? null; },
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) {
      if (h.failNext && key.startsWith(h.failNext.keyPrefix)) {
        if (h.failNext.skipMatches > 0) h.failNext.skipMatches--;
        else {
          h.failNext = null;
          throw new DOMException("Injected storage quota", "QuotaExceededError");
        }
      }
      storage.set(key, String(value));
    },
    removeItem(key) { storage.delete(key); },
  } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
    locks: { request: async (_name, callback) => callback() },
  } });
  Object.defineProperty(globalThis, "workoutDraftFault", { configurable: true, value: point => {
    if (h.faultPoint !== point) return false;
    h.faultPoint = null;
    return true;
  } });
  DurableState.configureHost({
    workoutDraft: Draft,
    getLiveState: () => ({ program: [], log: [] }),
    workoutParseContext: () => context,
    storeDraftRecovery: (raw, reason) => h.recovery.push({ raw, reason }),
  });
  return h;
}

export function nextDraftRaw(raw, operationId) {
  const parsed = Draft.parse(raw);
  const draft = parsed.kind === "valid" ? Draft.reduce(parsed.draft, {
    type: "editSetField", operationId, expectedRevision: parsed.draft.revision,
    updatedAt: timestamp, writer, exerciseInstanceId: "store-slot", setId: "store-set",
    field: "load", value: String(20 + parsed.draft.revision),
  }) : Draft.create(context, {
    draftId: `draft-${operationId}`, writer: { ...writer, operationId },
    startedAt: timestamp, updatedAt: timestamp, scheduleDate: context.scheduleDate,
    selectedExerciseId: "store-slot", bodyweight: "", notes: "",
  }, {});
  assert.equal(Draft.isDomainError(draft), false, JSON.stringify(draft));
  const nextRaw = JSON.stringify(Draft.serialize(draft));
  assert.equal(Draft.parse(nextRaw).kind, "valid", "fixture must be a valid production draft");
  return nextRaw;
}

export async function runDraftStoreJourney(h, actions) {
  const store = h.DurableState.DraftStore;
  const model = { ack: null, candidates: new Set() };
  for (const [index, action] of actions.entries()) {
    const before = store.readCanonicalStatus();
    assert.equal(before.status, "ok");
    const live = Draft.parse(before.raw);
    const operationId = `operation-${index}`;
    let outcome;
    switch (action.type) {
      case "save": {
        const nextRaw = nextDraftRaw(before.raw, operationId);
        outcome = await store.compareAndSwapV2({
          ...(live.kind === "valid" ? {
            expectedDraftId: live.draft.draftId, expectedRevision: live.draft.revision,
          } : { expectedRaw: null }), nextRaw, operationId,
        });
        if (outcome.status === "applied") {
          model.ack = nextRaw;
          model.candidates.clear();
          assert.equal(store.readCanonicalRaw(), nextRaw, "applied save must publish its exact aggregate");
        } else {
          assert.ok(["checkpoint-failed", "checkpoint-conflict", "checkpoint-commit-failed",
            "write-failed", "fault-before-canonical", "fault-after-canonical"].includes(outcome.status),
          `unexpected save status ${outcome.status}`);
          model.candidates.add(nextRaw);
        }
        break;
      }
      case "staleSave":
        outcome = await store.compareAndSwapV2({
          expectedDraftId: live.draft?.draftId ?? "missing-draft",
          expectedRevision: (live.draft?.revision ?? 0) - 1,
          nextRaw: nextDraftRaw(before.raw, operationId), operationId,
        });
        assert.ok(["stale", "missing"].includes(outcome.status), `stale save returned ${outcome.status}`);
        assert.equal(store.readCanonicalRaw(), before.raw, "I4: stale save changed canonical bytes");
        break;
      case "remove":
        outcome = await store.removeV2({
          expectedDraftId: live.draft?.draftId ?? "missing-draft",
          expectedRevision: live.draft?.revision ?? 0, operationId,
        });
        if (outcome.status === "applied") {
          model.ack = null;
          model.candidates.clear();
          assert.equal(store.readCanonicalRaw(), null, "applied removal must clear canonical bytes");
        } else {
          assert.ok(["missing", "checkpoint-conflict", "checkpoint-write", "checkpoint-commit-failed",
            "write-failed", "fault-before-canonical", "fault-after-canonical"].includes(outcome.status),
          `unexpected removal status ${outcome.status}`);
          if (live.kind === "valid") model.candidates.add(null);
        }
        break;
      case "fault": h.faultPoint = action.point; break;
      case "quota": h.failNext = { keyPrefix: action.keyPrefix, skipMatches: action.skipMatches ?? 0 }; break;
      case "reboot": {
        const allowed = new Set([model.ack, ...model.candidates]);
        outcome = await h.DurableState.reconcileV2Checkpoint(before, "store search");
        const recovered = store.readCanonicalRaw();
        assert.ok(allowed.has(recovered), `I3: reboot lost an acknowledged draft or invented one at action ${index}`);
        // Failed boot repair leaves its proposal pending for a later boot.
        if (outcome.status === "ok") {
          model.ack = recovered;
          model.candidates.clear();
        }
        break;
      }
      default: assert.fail(`Unknown action ${action.type}`);
    }
    h.outcomes.push({ action, status: outcome?.status });
    const after = store.readCanonicalStatus();
    assert.equal(after.status, "ok");
    assert.ok(after.raw === null || Draft.parse(after.raw).kind === "valid", "I1: invalid canonical draft");
    assert.ok(["absent", "valid"].includes(store.readV2Checkpoint().status), "I2: invalid checkpoint");
  }
  return model;
}
