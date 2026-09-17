#!/usr/bin/env node
// Plan 056 P5 — unified Review lifecycle.
// Active-block checkpoint is read-only with no structural confirms; a
// completed block enables only evidence-valid actions; insufficient final
// evidence offers only non-evidence routes; the old competing dialogs are gone.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { default: model } = await import(`${pathToFileURL(path.join(root, "progress-model.js")).href}?p=${fs.statSync(path.join(root, "progress-model.js")).mtimeMs}`);

const program = [
  { id: "e1", day: "Day 1", sets: 2, primary: "Chest" },
  { id: "e2", day: "Day 2", sets: 2, primary: "Hamstrings" },
];
const started = "2026-08-03"; // Monday; 4-week block ends 2026-08-30.
const meta = { started, mesocycleLengthWeeks: 4 };
const now = "2026-08-31T12:00:00";

// Active block: no structural actions, ever.
{
  const active = model.buildReviewCheckpoint(program, meta, [], "2026-08-17T12:00:00");
  assert.equal(active.lifecycle, "active-block");
  assert.deepEqual(active.structuralActions, [], "active checkpoint exposes no structural confirms");
  assert.equal(active.observedOutcomes.length, 0);
}

// Completed block with sufficient evidence: evidence-valid actions only.
{
  const facts = [
    { exerciseId: "e1", evidenceState: "sufficient", outcome: "maintained" },
    { exerciseId: "e2", evidenceState: "sufficient", outcome: "declined" },
  ];
  const done = model.buildReviewCheckpoint(program, { ...meta, mesocycleStatus: "completed", observedOutcomes: facts }, [], now);
  assert.equal(done.lifecycle, "block-complete");
  for (const kind of ["repeat", "review", "schedule-repair", "reduce-volume", "guided-edit"]) {
    assert.ok(done.structuralActions.includes(kind), `completed block enables ${kind}`);
  }
  assert.ok(!done.structuralActions.includes("progress"), "no improved outcome means no progress action");
}

// Improved evidence unlocks progress; recovery only with the approved policy flag.
{
  const facts = [
    { exerciseId: "e1", evidenceState: "sufficient", outcome: "improved" },
    { exerciseId: "e2", evidenceState: "sufficient", outcome: "improved" },
  ];
  const done = model.buildReviewCheckpoint(program, { ...meta, mesocycleStatus: "completed", observedOutcomes: facts }, [], now);
  assert.ok(done.structuralActions.includes("progress"));
  assert.ok(!done.structuralActions.includes("recovery-week"), "recovery needs the policy gate, not just evidence");
  const recov = model.buildReviewCheckpoint(program,
    { ...meta, mesocycleStatus: "completed", observedOutcomes: facts, recoveryEligible: true }, [], now);
  assert.ok(recov.structuralActions.includes("recovery-week"));
}

// Insufficient final evidence: only non-evidence structural/manual routes.
{
  const insufficient = [
    { exerciseId: "e1", evidenceState: "insufficient", outcome: undefined },
  ];
  const done = model.buildReviewCheckpoint(program,
    { ...meta, mesocycleStatus: "completed", observedOutcomes: insufficient }, [], now);
  assert.equal(done.lifecycle, "block-complete");
  assert.deepEqual(done.structuralActions, ["repeat", "schedule-repair", "reduce-volume", "guided-edit"],
    "insufficient final evidence offers repeat plus non-evidence routes, no performance-derived change");
  assert.equal(done.hasSufficientEvidence, false);
  assert.ok(!done.structuralActions.includes("progress"), "no performance-derived transition from insufficient evidence");
}

// The old competing dialogs are gone from the shell.
{
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(!index.includes('id="blockReview"'), "the separate block-review dialog is removed");
  assert.ok(!index.includes('id="endBlockConfirm"'), "the separate end-block confirm dialog is removed");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  assert.ok(!app.includes("successorProgramList"), "successorProgramList is removed as a transition source");
  assert.ok(!app.includes("increase_volume"), "the increase-volume strategy is gone");
  assert.ok(!app.includes("repeat_swaps"), "the swaps strategy is gone");
}

console.log("PASS: progress lifecycle (active read-only, evidence-valid actions, dialogs removed)");
