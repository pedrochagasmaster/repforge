#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Entry = require("../program-entry.js");

const NOW = "2026-08-27T12:00:00.000Z";

function fresh() {
  return Entry.createState({
    draftId: "00000000-0000-4000-8000-000000000048",
    activeProgramRevisionAtStart: 12,
    now: NOW,
  });
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
    if (state.step === "result") state = Entry.setResult(state, { fingerprint: `${route}-fixture` });
    if (["preview", "editor"].includes(state.step)) return { state, visited };
    const transition = Entry.advance(state);
    assert.equal(transition.ok, true, `${route}:${state.step} should advance`);
    assert.notEqual(transition.state.step, state.step, `${route}:${state.step} should move`);
    state = transition.state;
    visited.push(state.step);
  }
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
