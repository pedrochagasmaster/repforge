#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Entry = require("../program-entry.js");

const NOW = "2026-08-27T12:00:00.000Z";
const VERSIONS = {
  compiler: "fixture-1",
  family: "fixture-1",
  blueprint: "fixture-1",
  catalogue: "fixture-1",
  rules: "fixture-1",
  context: "1",
  progression: "range-1",
};

function fresh() {
  return Entry.createState({
    draftId: "00000000-0000-4000-8000-000000000048",
    activeProgramRevisionAtStart: 12,
    now: NOW,
    versions: VERSIONS,
  });
}

function validContext() {
  return {
    schemaVersion: 1,
    desiredResult: "balanced",
    structuredExperience: "6_to_24m",
    recentConsistency: "most",
    availability: {
      daysPerWeek: 4,
      sessionMinutes: 60,
      preferredRestSeconds: 120,
    },
    environment: { kind: "commercial_gym", capabilities: ["safe_pull"], equipment: ["barbell", "cable"] },
    primaryMuscles: ["back"],
    deEmphasizedMuscles: [],
    ignoredMuscles: [],
    priorityMovements: ["bench_press"],
    exerciseConstraints: [{ exerciseId: "exercise-1", reason: "dislike" }],
    reviewedAt: NOW,
  };
}

function validAnswers(route) {
  const common = {
    desiredResult: "balanced",
    structuredExperience: "6_to_24m",
    recentConsistency: "most",
    daysPerWeek: 4,
    sessionMinutes: 60,
    preferredRestSeconds: 120,
    environment: { kind: "commercial_gym" },
    primaryMuscles: [],
  };
  if (route === "custom") common.splitPreference = "upper_lower";
  if (route === "browse") common.catalogueSelection = "balanced-4-v1";
  if (route === "build") return { programName: "My program", daysPerWeek: 4 };
  if (route === "import") return { importReady: true };
  if (route === "shared") return { sharedReady: true };
  return common;
}

function driveToTerminal(route) {
  let state = Entry.selectRoute(fresh(), route);
  state = Entry.setAnswers(state, validAnswers(route));
  const visited = [state.step];
  while (true) {
    if (state.step === "result") state = Entry.setResult(state, resultFixture(route));
    if (["catalogue", "import_source", "shared_review"].includes(state.step)) {
      state = Entry.setResult(state, resultFixture(route));
    }
    if (["preview", "editor"].includes(state.step)) return { state, visited };
    const transition = Entry.advance(state);
    assert.equal(transition.ok, true, `${route}:${state.step} should advance`);
    assert.notEqual(transition.state.step, state.step, `${route}:${state.step} should move`);
    state = transition.state;
    visited.push(state.step);
  }
}

function resultFixture(route) {
  return {
    fingerprint: `${route}-fixture`,
    preview: {
      program: [{ id: `${route}-row`, day: "Day 1", order: 1, name: "Row", sets: 3, min: 8, max: 12 }],
      programStructure: { schemaVersion: 1, days: [{ dayId: `${route}-d1`, label: "Day 1", order: 1 }] },
    },
  };
}

test("module imports in Node without browser globals", () => {
  assert.equal(typeof Entry.createState, "function");
  assert.deepEqual(Entry.ROUTES, ["recommend", "custom", "browse", "build", "import", "shared"]);
});

test("every route reaches its declared preview or editor", () => {
  for (const route of Entry.ROUTES) {
    const { state, visited } = driveToTerminal(route);
    assert.equal(state.step, route === "build" ? "editor" : "preview");
    assert.deepEqual(visited, Entry.ROUTE_STEPS[route]);
  }
});

test("every route step has a defined Back transition", () => {
  for (const route of Entry.ROUTES) {
    let state = Entry.selectRoute(fresh(), route);
    state = Entry.setAnswers(state, validAnswers(route));
    if (["recommend", "custom"].includes(route)) state = Entry.setResult(state, { fingerprint: route });
    for (let index = 0; index < Entry.ROUTE_STEPS[route].length; index++) {
      const atStep = { ...state, step: Entry.ROUTE_STEPS[route][index] };
      const previous = Entry.back(atStep);
      assert.equal(previous.step, index === 0 ? "entry" : Entry.ROUTE_STEPS[route][index - 1]);
    }
  }
});

test("required omissions block only their owning step", () => {
  let state = Entry.selectRoute(fresh(), "recommend");
  assert.deepEqual(Entry.advance(state).issues, ["desired_result_required"]);
  state = Entry.setAnswers(state, { desiredResult: "strength" });
  state = Entry.advance(state).state;
  assert.deepEqual(Entry.advance(state).issues, ["structured_experience_required", "recent_consistency_required"]);
  state = Entry.setAnswers(state, {
    structuredExperience: "over_24m",
    recentConsistency: "few",
  });
  assert.equal(Entry.advance(state).ok, true);
});

test("switching Recommend and Custom preserves shared facts but drops results", () => {
  const answers = {
    ...validAnswers("custom"),
    deEmphasizedMuscles: ["calves"],
  };
  let state = Entry.setAnswers(Entry.selectRoute(fresh(), "custom"), answers);
  state = Entry.setResult(state, { fingerprint: "old" });
  const recommend = Entry.selectRoute(state, "recommend");
  assert.equal(recommend.answers.desiredResult, answers.desiredResult);
  assert.equal(recommend.answers.splitPreference, undefined);
  assert.equal(recommend.result, null);
  const custom = Entry.selectRoute(recommend, "custom");
  assert.equal(custom.answers.daysPerWeek, answers.daysPerWeek);
});

test("Browse keeps compatibility context and manual routes inherit no prescription", () => {
  let state = Entry.setAnswers(Entry.selectRoute(fresh(), "custom"), validAnswers("custom"));
  const browse = Entry.selectRoute(state, "browse");
  assert.deepEqual(Object.keys(browse.answers).sort(), [
    "daysPerWeek",
    "environment",
    "sessionMinutes",
    "structuredExperience",
  ]);
  for (const route of ["build", "import", "shared"]) {
    assert.deepEqual(Entry.selectRoute(state, route).answers, {});
  }
});

test("transitions do not mutate their inputs", () => {
  const state = Entry.setAnswers(Entry.selectRoute(fresh(), "recommend"), validAnswers("recommend"));
  const before = structuredClone(state);
  const advanced = Entry.advance(state);
  assert.deepEqual(state, before);
  assert.notEqual(advanced.state, state);
  advanced.state.answers.environment.kind = "changed";
  assert.equal(state.answers.environment.kind, "commercial_gym");
});

test("programming context accepts only the versioned bounded shape", () => {
  const context = validContext();
  const normalized = Entry.normalizeProgrammingContext(context);
  assert.equal(normalized.ok, true);
  assert.deepEqual(normalized.value, context);
  assert.notEqual(normalized.value, context);
  assert.deepEqual(Entry.normalizeProgrammingContext(JSON.stringify(context)), normalized);

  for (const change of [
    { desiredResult: "build_consistency" },
    { structuredExperience: "advanced" },
    { volumeTolerance: "high" },
    { primaryMuscles: ["back", "chest", "quads"] },
  ]) {
    const rejected = Entry.normalizeProgrammingContext({ ...context, ...change });
    assert.equal(rejected.ok, false, JSON.stringify(change));
    assert.equal(rejected.code, "invalid-programming-context");
  }
});

test("setup draft round-trips partial progress without normalization drift", () => {
  const state = Entry.setAnswers(Entry.selectRoute(fresh(), "recommend"), {
    desiredResult: "muscle_growth",
  });
  const first = Entry.normalizeSetupDraft(state);
  assert.equal(first.ok, true, first.issues?.join(","));
  const second = Entry.normalizeSetupDraft(JSON.stringify(first.value));
  assert.deepEqual(second, first);
  assert.deepEqual(state.answers, { desiredResult: "muscle_growth" });
});

test("setup draft envelope migrates legacy bytes and advances ownership by revision", () => {
  const state = Entry.setAnswers(Entry.selectRoute(fresh(), "recommend"), {
    desiredResult: "muscle_growth",
  });
  const migrated = Entry.normalizeSetupDraftEnvelope(JSON.stringify(state));
  assert.equal(migrated.ok, true, migrated.issues?.join(","));
  assert.equal(migrated.value.migrated, true);
  assert.equal(migrated.value.envelope.revision, 0);
  assert.equal(migrated.value.envelope.ownerId, null);
  assert.deepEqual(migrated.value.envelope.state, state);

  const tabA = Entry.advanceSetupDraftEnvelope(migrated.value.envelope, state, "tab-a");
  assert.equal(tabA.revision, 1);
  assert.equal(tabA.ownerId, "tab-a");
  const changed = Entry.setAnswers(state, { daysPerWeek: 3 });
  const tabB = Entry.advanceSetupDraftEnvelope(tabA, changed, "tab-b");
  assert.equal(tabB.revision, 2);
  assert.equal(tabB.ownerId, "tab-b");
  assert.deepEqual(tabB.state.answers, { desiredResult: "muscle_growth", daysPerWeek: 3 });
  assert.equal(tabA.state.answers.daysPerWeek, undefined);

  const roundTrip = Entry.normalizeSetupDraftEnvelope(JSON.stringify(tabB));
  assert.equal(roundTrip.ok, true, roundTrip.issues?.join(","));
  assert.equal(roundTrip.value.migrated, false);
  assert.deepEqual(roundTrip.value.envelope, tabB);
});

test("setup draft envelope rejects unknown ownership and revision shapes", () => {
  const state = fresh();
  for (const envelope of [
    { schemaVersion: 1, draftId: state.draftId, revision: -1, ownerId: "tab-a", state },
    { schemaVersion: 1, draftId: state.draftId, revision: 1, ownerId: "", state },
    { schemaVersion: 1, draftId: "different", revision: 1, ownerId: "tab-a", state },
    { schemaVersion: 1, draftId: state.draftId, revision: 1, ownerId: "tab-a", state, extra: true },
  ]) {
    const result = Entry.normalizeSetupDraftEnvelope(envelope);
    assert.equal(result.ok, false, JSON.stringify(envelope));
    assert.equal(result.code, "invalid-setup-draft-envelope");
  }
});

test("draft schema rejects corrupt, oversized, deep, unknown, and polluted input", () => {
  const base = fresh();
  const deep = {};
  let cursor = deep;
  for (let index = 0; index < 20; index++) cursor = cursor.next = {};
  const polluted = JSON.parse('{"schemaVersion":1,"__proto__":{"polluted":true}}');
  const cases = [
    "{",
    `"${"x".repeat(Entry.MAX_DRAFT_BYTES)}"`,
    { ...base, legacyHints: deep },
    { ...base, volumeTolerance: "high" },
    polluted,
  ];
  for (const input of cases) {
    const result = Entry.normalizeSetupDraft(input);
    assert.equal(result.ok, false);
    assert.equal(result.code, "invalid-setup-draft");
  }
  assert.equal({}.polluted, undefined);
});

test("hostile answer patches fail without mutating state or prototypes", () => {
  const state = Entry.selectRoute(fresh(), "recommend");
  const polluted = JSON.parse('{"__proto__":{"polluted":true}}');
  assert.throws(() => Entry.setAnswers(state, polluted), /Invalid answer patch/);
  assert.throws(() => Entry.setAnswers(state, { volumeTolerance: "high" }), /unknown_key/);
  assert.deepEqual(state.answers, {});
  assert.equal({}.polluted, undefined);
});

test("legacy goal aliases prefill only reviewable desired results", () => {
  const cases = [
    ["hypertrophy", "muscle_growth"],
    ["strength_hypertrophy", "balanced"],
    ["strength", "balanced"],
    ["beginner_consistency", undefined],
  ];
  for (const [goal, expected] of cases) {
    const migrated = Entry.migrateLegacyAnswers({ goal });
    assert.equal(migrated.ok, true);
    assert.equal(migrated.value.answers.desiredResult, expected);
    assert.equal(migrated.value.legacyHints.goal, goal);
    assert.ok(migrated.value.reviewRequired.includes("desired_result"));
  }
});

test("legacy self-rating and vague duration remain hints, not factual answers", () => {
  const legacy = {
    experience: "advanced",
    sessionLength: "long",
    daysPerWeek: 5,
  };
  const migrated = Entry.migrateLegacyAnswers(legacy);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.value.answers.structuredExperience, undefined);
  assert.equal(migrated.value.answers.sessionMinutes, undefined);
  assert.equal(migrated.value.answers.daysPerWeek, 5);
  assert.deepEqual(migrated.value.legacyHints, legacy);
  assert.deepEqual(legacy, {
    experience: "advanced",
    sessionLength: "long",
    daysPerWeek: 5,
  });
});

test("legacy equipment maps only exact new semantics and always requires review", () => {
  const exact = Entry.migrateLegacyAnswers({ equipment: "limited_home" });
  assert.deepEqual(exact.value.answers.environment, { kind: "limited_home" });
  const oldArray = Entry.migrateLegacyAnswers({ equipment: ["dumbbells", "bodyweight"] });
  assert.equal(oldArray.value.answers.environment, undefined);
  assert.deepEqual(oldArray.value.legacyHints.equipment, ["dumbbells", "bodyweight"]);
  assert.ok(oldArray.value.reviewRequired.includes("environment"));
});

test("legacy split carries only into compatible Custom and priorities never truncate", () => {
  const legacy = {
    splitType: "upper_lower",
    priorityMuscles: ["back", "chest", "quads"],
  };
  const compatible = Entry.migrateLegacyAnswers(legacy, {
    route: "custom",
    compatibleSplits: ["full_body", "upper_lower"],
  });
  assert.equal(compatible.value.answers.splitPreference, "upper_lower");
  assert.equal(compatible.value.answers.primaryMuscles, undefined);
  assert.deepEqual(compatible.value.legacyHints.priorityMuscles, legacy.priorityMuscles);

  const recommend = Entry.migrateLegacyAnswers(legacy, {
    route: "recommend",
    compatibleSplits: ["upper_lower"],
  });
  assert.equal(recommend.value.answers.splitPreference, undefined);
});

test("legacy migration rejects hostile structures and ignores historical metadata", () => {
  const polluted = JSON.parse('{"__proto__":{"polluted":true}}');
  assert.equal(Entry.migrateLegacyAnswers(polluted).ok, false);
  const migrated = Entry.migrateLegacyAnswers({
    goal: "hypertrophy",
    programMeta: { source: "legacy" },
  });
  assert.equal(migrated.ok, true);
  assert.equal(migrated.value.legacyHints.programMeta, undefined);
  assert.equal({}.polluted, undefined);
});

test("Back and JSON resume preserve normalized answers", () => {
  let state = Entry.setAnswers(Entry.selectRoute(fresh(), "custom"), validAnswers("custom"));
  state = { ...state, step: "environment" };
  const before = structuredClone(state.answers);
  const previous = Entry.back(state);
  assert.equal(previous.step, "schedule");
  assert.deepEqual(previous.answers, before);
  const resumed = Entry.resumeSetupDraft(JSON.stringify(previous), {
    currentVersions: VERSIONS,
    liveActiveProgramRevision: 12,
  });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.value.status, "resumable");
  assert.deepEqual(resumed.value.state.answers, before);
});

test("resume reports rule changes without regenerating a saved preview", () => {
  const preview = driveToTerminal("recommend").state;
  const currentVersions = { ...VERSIONS, compiler: "fixture-2" };
  const changed = Entry.resumeSetupDraft(preview, {
    currentVersions,
    liveActiveProgramRevision: 12,
    pinnedVersionsExecutable: false,
  });
  assert.equal(changed.value.status, "rules_changed");
  assert.deepEqual(changed.value.versionChanges, ["compiler"]);
  assert.equal(changed.value.savedPreviewPreserved, true);
  assert.equal(changed.value.pinnedPreviewExecutable, false);
  assert.deepEqual(changed.value.state.result, preview.result);

  const executable = Entry.resumeSetupDraft(preview, {
    currentVersions,
    liveActiveProgramRevision: 12,
    pinnedVersionsExecutable: true,
  });
  assert.equal(executable.value.pinnedPreviewExecutable, true);
  assert.deepEqual(executable.value.state.result, preview.result);
});

test("activation refuses stale revisions and returns a reviewable conflict state", () => {
  const preview = driveToTerminal("recommend").state;
  const readiness = Entry.activationReadiness(preview, {
    liveActiveProgramRevision: 13,
    currentVersions: VERSIONS,
  });
  assert.equal(readiness.ok, false);
  assert.equal(readiness.code, "active_program_changed");
  assert.equal(readiness.state.step, "activation_conflict");
  assert.equal(Entry.back(readiness.state).step, "preview");
  assert.deepEqual(preview, driveToTerminal("recommend").state);

  const resumed = Entry.resumeSetupDraft(preview, {
    liveActiveProgramRevision: 13,
    currentVersions: { ...VERSIONS, compiler: "fixture-2" },
  });
  assert.equal(resumed.value.status, "activation_conflict");
});

test("activation allows unchanged or explicitly executable pinned rules only", () => {
  const preview = driveToTerminal("custom").state;
  assert.equal(Entry.activationReadiness(preview, {
    liveActiveProgramRevision: 12,
    currentVersions: VERSIONS,
  }).ok, true);

  const changed = { ...VERSIONS, blueprint: "fixture-2" };
  const blocked = Entry.activationReadiness(preview, {
    liveActiveProgramRevision: 12,
    currentVersions: changed,
  });
  assert.equal(blocked.code, "rules_changed_rebuild_required");
  const pinned = Entry.activationReadiness(preview, {
    liveActiveProgramRevision: 12,
    currentVersions: changed,
    pinnedVersionsExecutable: true,
  });
  assert.equal(pinned.ok, true);
  assert.equal(pinned.pinned, true);
});

test("Build activation names every incomplete day and requires executable exercises", () => {
  let draft = Entry.selectRoute(fresh(), "build");
  draft = Entry.setAnswers(draft, { programName: "Manual block", daysPerWeek: 2 });
  draft = Entry.setResult(draft, {
    fingerprint: "manual-empty",
    preview: {
      program: [],
      programStructure: {
        schemaVersion: 1,
        days: [
          { dayId: "manual_d1", label: "Day 1", order: 1 },
          { dayId: "manual_d2", label: "Day 2", order: 2 },
        ],
      },
    },
  });
  draft = Entry.advance(draft).state;
  const empty = Entry.activationReadiness(draft, {
    liveActiveProgramRevision: 12,
    currentVersions: VERSIONS,
  });
  assert.equal(empty.ok, false);
  assert.equal(empty.code, "candidate_incomplete");
  assert.deepEqual(empty.issues, ["program_exercises_required", "day_empty:manual_d1", "day_empty:manual_d2"]);

  const partial = Entry.setResult(draft, {
    ...draft.result,
    preview: {
      ...draft.result.preview,
      program: [{ id: "row-1", day: "Day 1", order: 1, name: "Row", sets: 3, min: 8, max: 12 }],
    },
  });
  assert.deepEqual(Entry.activationReadiness(partial, {
    liveActiveProgramRevision: 12,
    currentVersions: VERSIONS,
  }).issues, ["day_empty:manual_d2"]);

  const complete = Entry.setResult(partial, {
    ...partial.result,
    preview: {
      ...partial.result.preview,
      program: [
        ...partial.result.preview.program,
        { id: "row-2", day: "Day 2", order: 1, name: "Press", sets: 3, min: 6, max: 10 },
      ],
    },
  });
  assert.equal(Entry.activationReadiness(complete, {
    liveActiveProgramRevision: 12,
    currentVersions: VERSIONS,
  }).ok, true);

  const incompatible = Entry.setResult(complete, {
    ...complete.result,
    preview: {
      ...complete.result.preview,
      program: complete.result.preview.program.map((exercise, index) => index ? exercise : {
        ...exercise,
        progressionIncompatibility: { code: "unsupported_strategy" },
      }),
    },
  });
  assert.deepEqual(Entry.activationReadiness(incompatible, {
    liveActiveProgramRevision: 12,
    currentVersions: VERSIONS,
  }).issues, ["progression_incompatible:row-1"]);
});

test("start over requests deletion of only the setup draft", () => {
  const restarted = Entry.startOver({
    draftId: "new-draft",
    activeProgramRevisionAtStart: 21,
    now: "2026-08-27T13:00:00.000Z",
    versions: VERSIONS,
  });
  assert.deepEqual(restarted.effects, { deleteSetupDraft: true });
  assert.equal(restarted.state.step, "entry");
  assert.equal(restarted.state.activeProgramRevisionAtStart, 21);
  assert.deepEqual(restarted.state.answers, {});
});

test("timestamps advance deterministically and never move backwards", () => {
  const state = fresh();
  const later = Entry.updateTimestamp(state, "2026-08-27T12:01:00.000Z");
  assert.equal(later.updatedAt, "2026-08-27T12:01:00.000Z");
  assert.equal(state.updatedAt, NOW);
  assert.throws(() => Entry.updateTimestamp(later, NOW), /cannot move backwards/);
  assert.throws(() => Entry.updateTimestamp(state, "tomorrow"), /Invalid update timestamp/);
});

test("corrupt saved drafts return typed resume failure", () => {
  const resumed = Entry.resumeSetupDraft("{");
  assert.deepEqual(resumed, {
    ok: false,
    code: "invalid-setup-draft",
    issues: ["invalid_json"],
  });
});

test("muscle overlaps and control caps fail closed before compile", () => {
  const state = Entry.selectRoute(fresh(), "custom");
  assert.throws(
    () => Entry.setAnswers(state, {
      primaryMuscles: ["chest"],
      deEmphasizedMuscles: ["chest"],
    }),
    /primary_deemphasized_overlap/,
  );
  assert.throws(
    () => Entry.setAnswers(state, {
      primaryMuscles: ["chest", "back", "quads"],
    }),
    /invalid_list|too_many/,
  );
  const eleven = Array.from({ length: 11 }, (_, i) => `m${i}`);
  assert.throws(
    () => Entry.setAnswers(state, { deEmphasizedMuscles: eleven }),
    /invalid_list/,
  );
  assert.equal(Entry.MAX_MUSCLE_CONTROLS, 10);

  assert.throws(
    () => Entry.setAnswers(state, {
      mustHaveExercises: ["pr_bb"],
      exerciseConstraints: [{ exerciseId: "pr_bb", reason: "pain" }],
    }),
    /must_have_avoided/,
  );

  const ok = Entry.setAnswers(state, {
    primaryMuscles: ["chest"],
    deEmphasizedMuscles: ["back"],
    ignoredMuscles: ["calves"],
  });
  assert.deepEqual(Entry.validationIssues({ ...ok, step: "priorities" }), []);

  const hostile = Entry.normalizeProgrammingContext({
    ...validContext(),
    primaryMuscles: ["chest"],
    ignoredMuscles: ["chest"],
  });
  assert.equal(hostile.ok, false);
  assert.ok(hostile.issues.some((issue) => issue.includes("overlap")));
});

test("draft schema rejects nested prototype pollution in result and legacyHints", () => {
  const base = fresh();
  const pollutedResult = JSON.parse('{"fingerprint":"x","nested":{"__proto__":{"polluted":true}}}');
  const pollutedHints = JSON.parse('{"goal":"hypertrophy","meta":{"__proto__":{"polluted":true}}}');
  assert.equal(Entry.normalizeSetupDraft({ ...base, result: pollutedResult }).ok, false);
  assert.equal(Entry.normalizeSetupDraft({ ...base, legacyHints: pollutedHints }).ok, false);
  assert.throws(() => Entry.setResult(base, pollutedResult), /Invalid program-entry result/);
  assert.equal({}.polluted, undefined);
});
