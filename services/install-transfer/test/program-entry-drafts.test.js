import { describe, expect, it } from "vitest";
import contract from "../src/contract.js";
import programEntry from "../../../program-entry.js";
import historicalDrafts from "../../../test/fixtures/program-entry-draft-plan070.json" with { type: "json" };

// Plan 072: the service validates a transferred setup draft by requiring it to
// equal its own normalization through program-entry.js. Onboarding B adds
// answers and steps, so this release's service must take both an older
// client's draft exactly as that client wrote it and a B draft, and a durable
// state carrying the lifter's profile.

const versions = {
  compiler: "067.1", family: "retired", blueprint: "1", catalogue: "raw-uuid@1", rules: "source-metrics@1",
  context: "program-definition@1", progression: "067.1", recentConsistency: "retired", simpleStart: "retired",
};

function recommendDraft(answers) {
  const state = programEntry.selectRoute(programEntry.createState({
    draftId: "entry-b-transfer", activeProgramRevisionAtStart: 0, now: "2026-10-11T09:00:00.000Z", versions,
  }), "recommend");
  return programEntry.setAnswers(state, answers);
}

function envelope({ programEntryDraft = null, profile } = {}) {
  return {
    kind: "taurifer-install-transfer",
    schemaVersion: 1,
    createdAt: "2026-10-11T09:00:00.000Z",
    source: { context: "browser", logicalInstallationId: "li-entry-b" },
    sourceRevision: 1,
    durableState: {
      settings: { unit: "kg" },
      programMeta: { id: "program-entry-b" },
      program: [],
      log: [],
      programHistory: [],
      customExercises: [],
      ...(profile ? { profile } : {}),
    },
    workoutDraft: null,
    programEntryDraft,
    uiPreferences: {},
    analytics: { enabled: false },
    telemetryIdentity: { schemaVersion: 1, installationId: "telemetry-entry-b", createdAt: "2026-10-11T09:00:00.000Z" },
    integrity: { canonicalPayloadHash: "0".repeat(64) },
  };
}

describe("setup drafts across the onboarding B release", () => {
  it("accepts a Recommend draft an earlier release stored, exactly as stored", () => {
    // Fixed prior-release bytes, shared with the public Entry consumer proof.
    expect(historicalDrafts.cases.map(c => c.id)).toEqual(["commercial-empty", "commercial-authored", "other-empty"]);
    for (const sample of historicalDrafts.cases) {
      const older = structuredClone(sample.draft);
      const result = contract.validateEnvelope(envelope({ programEntryDraft: older }));
      expect(result.ok).toBe(true);
      expect(result.value.programEntryDraft).toEqual(sample.draft);
      expect(older).toEqual(sample.draft);
    }
  });

  it("accepts a B draft with the Basics, equipment changes, block and deload", () => {
    let draft = recommendDraft({
      basics: { sex: "female", birthDate: "1990-03-10", heightCm: 180, heightUnit: "cm", weightKg: 83, weightUnit: "kg", cardioExperience: "1_to_4y" },
      structuredExperience: "over_24m",
      environment: { kind: "limited_home", adjust: { add: ["bench"], remove: ["kettlebells"] } },
      desiredResult: "strength", daysPerWeek: 3, sessionMinutes: 90,
      primaryMuscles: ["glutes", "back", "chest", "lats", "quads"], deEmphasizedMuscles: ["calves"], deload: true,
    });
    draft = { ...draft, step: "muscle_priorities" };
    const result = contract.validateEnvelope(envelope({ programEntryDraft: draft }));
    expect(result).toMatchObject({ ok: true });
  });

  it("carries the lifter's profile in the durable state", () => {
    const result = contract.validateEnvelope(envelope({
      profile: { sex: "undisclosed", birthDate: "1977-04-13", heightCm: 187.5, heightUnit: "ftin", weightKg: 91.7, cardioExperience: "none" },
    }));
    expect(result).toMatchObject({ ok: true });
  });

  it("refuses a draft that differs from its own normalization", () => {
    const draft = recommendDraft({ desiredResult: "balanced" });
    const tampered = { ...draft, answers: { ...draft.answers, basics: { sex: "female", nickname: "x" } } };
    const result = contract.validateEnvelope(envelope({ programEntryDraft: tampered }));
    expect(result.ok).toBe(false);
  });
});
