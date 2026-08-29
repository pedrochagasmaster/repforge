import assert from "node:assert/strict";

export const MODEL_STEPS = Object.freeze({
  recommend: Object.freeze(["desired_result", "background", "schedule", "environment", "priorities", "result", "preview"]),
  custom: Object.freeze(["desired_result", "background", "schedule", "environment", "priorities", "custom_shape", "result", "preview"]),
  browse: Object.freeze(["schedule", "environment", "catalogue", "preview"]),
  build: Object.freeze(["build_setup", "editor"]),
  import: Object.freeze(["import_source", "preview"]),
  shared: Object.freeze(["shared_review", "preview"]),
});

export const MODEL_VERSIONS = Object.freeze({
  compiler: "fixture-1",
  family: "fixture-1",
  blueprint: "fixture-1",
  catalogue: "fixture-1",
  rules: "fixture-1",
  context: "1",
  progression: "range-1",
});

const NOW = "2026-08-27T12:00:00.000Z";

function baseAnswers(route, services) {
  const answers = {
    desiredResult: "balanced",
    structuredExperience: "6_to_24m",
    recentConsistency: "most",
    daysPerWeek: 4,
    sessionMinutes: 60,
    preferredRestSeconds: 120,
    environment: { kind: "commercial_gym" },
    primaryMuscles: ["back"],
    priorityMovements: [],
    exerciseConstraints: [],
  };
  if (route === "custom") answers.splitPreference = services.splitChoices(answers).choices[0].id;
  if (route === "browse") {
    const entry = services.browseCatalogue(answers)[0];
    return {
      structuredExperience: answers.structuredExperience,
      daysPerWeek: answers.daysPerWeek,
      sessionMinutes: answers.sessionMinutes,
      environment: answers.environment,
      catalogueSelection: entry.id,
    };
  }
  if (route === "build") return { programName: "Generated test", daysPerWeek: 4 };
  if (route === "import") return { importReady: true };
  if (route === "shared") return { sharedReady: true };
  return answers;
}

function fixtureResult(route, state, services) {
  if (route === "recommend" || route === "custom") {
    return services.compile({ mode: route, answers: state.answers, versions: MODEL_VERSIONS });
  }
  if (route === "browse") {
    return { source: "fixture-catalogue", id: state.answers.catalogueSelection, fingerprint: "browse-fixture" };
  }
  return { source: `fixture-${route}`, fingerprint: `${route}-fixture` };
}

function assertInvariants(Entry, model) {
  const { state } = model;
  assert.equal(model.activeProgramBytes, model.originalActiveProgramBytes, "setup changed the active program");
  assert.ok(state.step === "entry" || state.step === "activation_conflict" || MODEL_STEPS[state.route]?.includes(state.step));
  assert.ok(!Array.isArray(state.answers.primaryMuscles) || state.answers.primaryMuscles.length <= 2);
  assert.equal(Object.hasOwn(state.answers, "volumeTolerance"), false);
  if (state.route === "custom" && state.answers.splitPreference) {
    assert.ok(model.services.splitChoices(state.answers).choices.some((choice) => choice.id === state.answers.splitPreference));
  }
  const checked = Entry.normalizeSetupDraft(state);
  assert.equal(checked.ok, true, checked.issues?.join(","));
  assert.deepEqual(checked.value, state);
}

export function runProgramEntryJourney(Entry, services, actions) {
  const originalActiveProgramBytes = JSON.stringify({ id: "active-1", revision: 7, exercises: ["unchanged"] });
  const model = {
    services,
    originalActiveProgramBytes,
    activeProgramBytes: originalActiveProgramBytes,
    liveRevision: 7,
    state: Entry.createState({
      draftId: "generative-draft",
      activeProgramRevisionAtStart: 7,
      now: NOW,
      versions: MODEL_VERSIONS,
    }),
  };

  for (const action of actions) {
    if (action.type === "select") {
      model.state = Entry.selectRoute(model.state, action.route);
    } else if (action.type === "fill" && model.state.route) {
      model.state = Entry.setAnswers(model.state, baseAnswers(model.state.route, services));
    } else if (action.type === "advance" && model.state.route && model.state.step !== "activation_conflict") {
      if (["result", "catalogue", "import_source", "shared_review"].includes(model.state.step)) {
        model.state = Entry.setResult(model.state, fixtureResult(model.state.route, model.state, services));
      }
      const transition = Entry.advance(model.state);
      if (transition.ok) model.state = transition.state;
    } else if (action.type === "back") {
      model.state = Entry.back(model.state);
    } else if (action.type === "reload") {
      const resumed = Entry.resumeSetupDraft(JSON.stringify(model.state), {
        currentVersions: MODEL_VERSIONS,
        liveActiveProgramRevision: model.liveRevision,
        pinnedVersionsExecutable: true,
      });
      assert.equal(resumed.ok, true);
      model.state = resumed.value.state;
    } else if (action.type === "restart") {
      model.state = Entry.startOver({
        draftId: "generative-restart",
        activeProgramRevisionAtStart: model.liveRevision,
        now: NOW,
        versions: MODEL_VERSIONS,
      }).state;
    } else if (action.type === "external_change") {
      model.liveRevision++;
      if (model.state.step === "preview") {
        const readiness = Entry.activationReadiness(model.state, {
          liveActiveProgramRevision: model.liveRevision,
          currentVersions: MODEL_VERSIONS,
        });
        assert.equal(readiness.ok, false);
        assert.equal(readiness.code, "active_program_changed");
        model.state = readiness.state;
      }
    } else if (action.type === "activate" && model.state.step === "preview") {
      const readiness = Entry.activationReadiness(model.state, {
        liveActiveProgramRevision: model.liveRevision,
        currentVersions: MODEL_VERSIONS,
      });
      if (model.liveRevision === model.state.activeProgramRevisionAtStart && model.state.result !== null) assert.equal(readiness.ok, true);
      else if (model.liveRevision === model.state.activeProgramRevisionAtStart) assert.equal(readiness.code, "preview_not_ready");
      else assert.equal(readiness.code, "active_program_changed");
    }
    assertInvariants(Entry, model);
  }
}
