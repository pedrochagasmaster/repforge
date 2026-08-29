#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(root, "test/fixtures/progression-strategies-v1.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

const session = (id, sets) => [{ sessionId: id, date: "2026-01-01", sets }];
const expectedSets = (load, count = 2) => Array.from({ length: count }, () => ({
  role: "working",
  load,
  reps: 5,
}));

fixture.strategies["effort_target@1"] = {
  approval: "locked",
  source: [
    "docs/progression-effort-target-v1.md",
    "owner approval 2026-08-28: Plan 047 prerequisite",
  ],
  defaults: {
    prescription: {
      schemaVersion: 1,
      strategy: {
        id: "effort_target",
        version: 1,
        params: {
          workingSets: 2,
          targetReps: 5,
          targetRirMin: 2,
          targetRirMax: 3,
          minLoadIncrement: 2.5,
        },
      },
      modifiers: [],
    },
    settings: { minLoadIncrement: 2.5, jumpPercent: 2.5, hardRir: 4 },
    relation: null,
    modifiers: [],
    currentSession: [],
    context: { weekNumber: 1, blockLength: 6, blockStart: null },
  },
  cases: [
    {
      id: "effort-target-no-history",
      approval: "locked",
      note: "No history preserves the authored targets and invents no load.",
      history: [],
      expected: { kind: "recommendation", status: "new", reasonCodes: ["effort_target.no_history"], sets: expectedSets(null) },
    },
    {
      id: "effort-target-too-easy",
      approval: "locked",
      note: "Target reps above the RIR ceiling advance one grid step.",
      history: session("effort-easy", [{ load: 100, reps: 5, rir: 4 }, { load: 100, reps: 5, rir: 4 }]),
      expected: { kind: "recommendation", status: "advance", reasonCodes: ["effort_target.too_easy"], sets: expectedSets(102.5) },
    },
    {
      id: "effort-target-on-target",
      approval: "locked",
      note: "Target reps inside the RIR range hold the load.",
      history: session("effort-target", [{ load: 100, reps: 5, rir: 2 }, { load: 100, reps: 5, rir: 3 }]),
      expected: { kind: "recommendation", status: "hold", reasonCodes: ["effort_target.on_target"], sets: expectedSets(100) },
    },
    {
      id: "effort-target-too-hard",
      approval: "locked",
      note: "Target reps below the RIR floor reduce one grid step.",
      history: session("effort-hard", [{ load: 100, reps: 5, rir: 1 }, { load: 100, reps: 5, rir: 1 }]),
      expected: { kind: "recommendation", status: "reduce", reasonCodes: ["effort_target.too_hard"], sets: expectedSets(97.5) },
    },
    {
      id: "effort-target-rep-miss",
      approval: "locked",
      note: "A rep miss reduces even when the reported effort looks easy.",
      history: session("effort-miss", [{ load: 100, reps: 4, rir: 5 }, { load: 100, reps: 4, rir: 5 }]),
      expected: { kind: "recommendation", status: "reduce", reasonCodes: ["effort_target.rep_miss"], sets: expectedSets(97.5) },
    },
    {
      id: "effort-target-no-rir-evidence",
      approval: "locked",
      note: "Actionable load history with no finite RIR holds without fabricating effort.",
      history: session("effort-no-rir", [{ load: 100, reps: 5, rir: null }, { load: 100, reps: 5, rir: null }]),
      expected: { kind: "recommendation", status: "hold", reasonCodes: ["effort_target.no_rir_evidence"], sets: expectedSets(100) },
    },
    {
      id: "effort-target-off-grid",
      approval: "locked",
      note: "An off-grid hold snaps to the actionable grid without mutating evidence.",
      history: session("effort-grid", [{ load: 101, reps: 5, rir: 2 }, { load: 101, reps: 5, rir: 3 }]),
      expected: { kind: "recommendation", status: "hold", reasonCodes: ["effort_target.on_target", "effort_target.grid_rounded"], sets: expectedSets(100) },
    },
    {
      id: "effort-target-different-machine-excluded",
      approval: "locked",
      note: "The exact-identity adapter excludes another machine, leaving no comparable history.",
      history: [],
      expected: { kind: "recommendation", status: "new", reasonCodes: ["effort_target.no_history"], sets: expectedSets(null) },
    },
    {
      id: "effort-target-current-advance",
      approval: "locked",
      note: "A current set that is too easy advances only the next untouched set.",
      history: [],
      currentSession: [{ load: 100, reps: 5, rir: 4 }],
      expected: { kind: "recommendation", status: "advance", reasonCodes: ["effort_target.current_advance"], sets: expectedSets(102.5, 1) },
    },
    {
      id: "effort-target-current-hold",
      approval: "locked",
      note: "A current set on target holds the next untouched set.",
      history: [],
      currentSession: [{ load: 100, reps: 5, rir: 2 }],
      expected: { kind: "recommendation", status: "hold", reasonCodes: ["effort_target.current_hold"], sets: expectedSets(100, 1) },
    },
    {
      id: "effort-target-current-reduce",
      approval: "locked",
      note: "A current rep miss reduces only the next untouched set.",
      history: [],
      currentSession: [{ load: 100, reps: 4, rir: 4 }],
      expected: { kind: "recommendation", status: "reduce", reasonCodes: ["effort_target.current_reduce"], sets: expectedSets(97.5, 1) },
    },
    {
      id: "effort-target-current-complete",
      approval: "locked",
      note: "Completed authored sets return no future target and overwrite nothing.",
      history: [],
      currentSession: [{ load: 100, reps: 5, rir: 2 }, { load: 100, reps: 5, rir: 2 }],
      expected: { kind: "recommendation", status: "hold", reasonCodes: ["effort_target.current_hold"], sets: [] },
    },
    {
      id: "effort-target-invalid-parameters",
      approval: "locked",
      note: "An invalid authored rep target returns a typed invalid result.",
      overrides: { "prescription.strategy.params": { targetReps: 0 } },
      history: [],
      expected: { kind: "invalid", status: "manual", reasonCodes: ["engine.invalid_input"], sets: [] },
    },
    {
      id: "effort-target-bodyweight-incompatible",
      approval: "locked",
      note: "Bodyweight without an external loading mechanism is incompatible.",
      overrides: { "prescription.strategy.params": { loadMode: "bodyweight" } },
      history: [],
      expected: { kind: "incompatible", status: "manual", reasonCodes: ["effort_target.bodyweight_incompatible"], sets: [] },
    },
    {
      id: "effort-target-paired-incompatible",
      approval: "locked",
      note: "Graduating effort target does not expand the paired strategy matrix.",
      overrides: {
        relation: {
          schemaVersion: 1,
          id: "effort-pair",
          type: "paired_exposure",
          version: 1,
          movementId: "library:barbell-back-squat",
          members: [
            { exerciseId: "effort-heavy", role: "heavy" },
            { exerciseId: "effort-volume", role: "volume" },
          ],
          selfRole: "heavy",
          counterpart: {
            strategy: "rep_goal@1",
            sessionsInWindow: 1,
            mostRecentExpectedExposureCompleted: true,
            status: "hold",
          },
        },
      },
      history: [],
      expected: { kind: "incompatible", status: "manual", reasonCodes: ["paired_exposure.incompatible_strategy_pair"], sets: [] },
    },
  ],
};

fs.writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`);
