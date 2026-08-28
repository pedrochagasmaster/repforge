#!/usr/bin/env node
import assert from "node:assert/strict";
import test from "node:test";
import { createFixtureServices } from "./fixtures/program-entry-services.mjs";

const services = createFixtureServices();
const versions = {
  compiler: "fixture-1",
  family: "fixture-1",
  blueprint: "fixture-1",
  catalogue: "fixture-1",
  rules: "fixture-1",
  context: "1",
  progression: "range-1",
};

function answers(overrides = {}) {
  return {
    desiredResult: "balanced",
    structuredExperience: "over_24m",
    recentConsistency: "none",
    daysPerWeek: 4,
    sessionMinutes: 60,
    preferredRestSeconds: 120,
    environment: { kind: "commercial_gym" },
    primaryMuscles: ["back"],
    splitPreference: "upper_lower",
    ...overrides,
  };
}

test("fixture compiler is deterministic for the same answers and versions", () => {
  const input = { mode: "recommend", answers: answers(), versions };
  const first = services.compile(input);
  const second = services.compile(structuredClone(input));
  assert.deepEqual(second, first);
  assert.equal(second.fingerprint, first.fingerprint);
});

test("fixture compiler changes only after a named input or version changes", () => {
  const base = services.compile({ mode: "recommend", answers: answers(), versions });
  const changedInput = services.compile({
    mode: "recommend",
    answers: answers({ sessionMinutes: 75 }),
    versions,
  });
  const changedVersion = services.compile({
    mode: "recommend",
    answers: answers(),
    versions: { ...versions, compiler: "fixture-2" },
  });
  assert.notEqual(changedInput.fingerprint, base.fingerprint);
  assert.notEqual(changedVersion.fingerprint, base.fingerprint);
});

test("Recommend covers 2-6 days with one result and at most one alternative", () => {
  for (let daysPerWeek = 2; daysPerWeek <= 6; daysPerWeek++) {
    const result = services.compile({
      mode: "recommend",
      answers: answers({ daysPerWeek }),
      versions,
    });
    assert.ok(result.candidates.length >= 1 && result.candidates.length <= 2);
    assert.equal(result.preview.days.length, daysPerWeek);
  }
});

test("Custom returns at most two compatible splits and rejects a known mismatch", () => {
  for (let daysPerWeek = 2; daysPerWeek <= 6; daysPerWeek++) {
    const splitResult = services.splitChoices({ daysPerWeek });
    assert.ok(splitResult.choices.length <= 2);
    assert.equal(splitResult.choices.filter((choice) => choice.default).length, 1);
    const splitPreference = splitResult.choices[0].id;
    assert.doesNotThrow(() => services.compile({
      mode: "custom",
      answers: answers({ daysPerWeek, splitPreference }),
      versions,
    }));
  }
  assert.throws(() => services.compile({
    mode: "custom",
    answers: answers({ daysPerWeek: 2, splitPreference: "push_pull_legs" }),
    versions,
  }), /compatible split required/);
});

test("experienced returners keep standard complexity with temporary re-entry", () => {
  const result = services.compile({ mode: "recommend", answers: answers(), versions });
  assert.equal(result.candidates[0].complexity, "standard");
  assert.equal(result.candidates[0].reentry, "weeks_1_2");
});

test("diagnostics are the explanation facts and volume tolerance is rejected", () => {
  const result = services.compile({ mode: "recommend", answers: answers(), versions });
  assert.deepEqual(result.diagnostics, {
    desiredResult: "balanced",
    structuredExperience: "over_24m",
    recentConsistency: "none",
    daysPerWeek: 4,
    mainConstraint: "commercial_gym",
  });
  assert.throws(() => services.compile({
    mode: "recommend",
    answers: answers({ volumeTolerance: "high" }),
    versions,
  }), /volume tolerance/);
});

test("fixture catalogue exposes only browseable complete executable tested versions", () => {
  const entries = services.browseCatalogue({ daysPerWeek: 3 });
  assert.ok(entries.length > 0);
  assert.ok(entries.every((entry) => entry.browse && entry.complete && entry.executable && entry.tested));
  assert.equal(entries.some((entry) => entry.id === "future-disabled-v2"), false);
});
