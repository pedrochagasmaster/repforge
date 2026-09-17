#!/usr/bin/env node
/** Plan 056/P7: permanent volume reduction and closed recovery-policy UI seam. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { assertServingApp } from "./browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policyText = fs.readFileSync(path.join(root, "docs/recovery-week-policy.md"), "utf8");
const policyMatch = policyText.match(/```json\n([\s\S]*?)\n```/);
assert.ok(policyMatch, "the closed policy document carries its executable JSON object");
const documentedPolicy = JSON.parse(policyMatch[1]);
assert.equal(documentedPolicy.policyVersion, 2);

const base = process.env.REPFORGE_URL || "http://127.0.0.1:8000/";
await assertServingApp(base);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(String(error)));

async function bootFresh() {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 20000 });
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
    for (const reg of regs) await reg.unregister();
    for (const key of await caches?.keys?.() || []) await caches.delete(key);
    localStorage.clear();
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 20000 });
}

async function seedCompiledProgram() {
  const result = await page.evaluate(async () => {
    const services = window.__repforgeOnboarding.services();
    const compiled = services.compile({
      mode: "recommend",
      answers: {
        desiredResult: "balanced", structuredExperience: "6_to_24m", recentConsistency: "most",
        daysPerWeek: 4, sessionMinutes: 90, preferredRestSeconds: 90,
        environment: { kind: "commercial_gym" }, primaryMuscles: [], deEmphasizedMuscles: [],
        ignoredMuscles: [], priorityMovements: [], mustHaveExercises: [], exerciseConstraints: [],
      },
      versions: services.currentVersions(),
    });
    if (!compiled.ok) return compiled;
    const finalized = await window.__repforgeFinalizeProgramSetup({
      exercises: compiled.preview.program, name: "Progress transition oracle",
      answers: { goal: "balanced", daysPerWeek: 4 }, destination: "log", origin: "first-run",
      draftConfirmed: true, telemetryRoute: "recommend", entryTelemetry: compiled.telemetry,
      entrySource: { route: "recommend", fingerprint: compiled.fingerprint },
      programStructure: compiled.preview.programStructure, compilerContext: compiled.compilerContext,
    });
    await window.__repforgeStorage.flush();
    return { ok: !!(finalized?.localOk || finalized?.idbOk) };
  });
  assert.equal(result.ok, true, JSON.stringify(result));
}

const state = () => page.evaluate(() => window.__repforgeWorkoutDraft.state());
const adapterCall = (method, value) => page.evaluate(async ({ method, value }) =>
  window.__repforgeProgramTransition[method](value), { method, value });

await bootFresh();
await seedCompiledProgram();

const runtimePolicy = await page.evaluate(() => window.RepForgeProgramTransition.approvedRecoveryPolicy());
assert.deepEqual(runtimePolicy, documentedPolicy, "runtime recovery policy is exactly documented policy version 2");

const source = await state();
assert.ok(source.programMeta.blockId && source.programMeta.blockId !== source.programMeta.id,
  "the source is a modern identified block");

for (const [name, evidence, code] of [
  ["missing patterns", { outcomesByPattern: {}, checkpointAnswer: "Yes" }, "insufficient_qualifying_patterns"],
  ["improved evidence", { outcomesByPattern: { "knee-dominant": "improved", "horizontal press": "improved" }, checkpointAnswer: "Yes" }, "insufficient_qualifying_patterns"],
  ["No checkpoint", { outcomesByPattern: { "knee-dominant": "maintained", "horizontal press": "declined" }, checkpointAnswer: "No" }, "checkpoint_not_yes"],
  ["Not sure checkpoint", { outcomesByPattern: { "knee-dominant": "maintained", "horizontal press": "declined" }, checkpointAnswer: "Not sure" }, "checkpoint_not_yes"],
]) {
  const result = await adapterCall("proposeRecoveryWeek", { evidence, transitionId: `ineligible-${name}` });
  assert.equal(result.ok, false, `${name} cannot mint recovery`);
  assert.equal(result.code, code, `${name} returns the closed policy reason`);
}

const recoveryEvidence = {
  outcomesByPattern: { "knee-dominant": "maintained", "horizontal press": "declined", "hip/hinge": "improved" },
  checkpointAnswer: "Yes",
};
const recovery = await adapterCall("proposeRecoveryWeek", { evidence: recoveryEvidence, transitionId: "progress-recovery-v2" });
assert.equal(recovery.ok, true, recovery.code);
assert.equal(recovery.proposal.derivation.policyVersions.recoveryWeek, 2);
assert.deepEqual(recovery.proposal.diff.recoveryWeek.eligibilityEvidence.qualifyingPatterns,
  ["knee-dominant", "horizontal press"]);
assert.equal(recovery.proposal.diff.recoveryWeek.reassessmentOutcome, null);
assert.equal(await page.evaluate(p => window.RepForgeProgramTransition.hashProposal(p), recovery.proposal),
  recovery.proposal.proposalHash, "preview hash is the exact confirmation commitment");
for (const entry of recovery.proposal.diff.recoveryWeek.entries) {
  assert.ok(entry.effectiveWorkingSets >= 0 && entry.effectiveWorkingSets <= entry.baseWorkingSets);
  if (entry.reason === "optional-removed") assert.equal(entry.effectiveWorkingSets, 0);
  if (entry.reason === "protected-ceil") assert.equal(entry.effectiveWorkingSets, Math.ceil(entry.baseWorkingSets / 2));
  if (entry.reason === "reducible-floor") assert.equal(entry.effectiveWorkingSets, Math.floor(entry.baseWorkingSets / 2));
}

const confirmedAt = new Date().toISOString();
const recoveryCommit = await adapterCall("confirmTransition", {
  proposal: recovery.proposal, proposalHash: recovery.proposal.proposalHash,
  transitionId: recovery.proposal.transitionId, confirmedAt,
  reassessmentDueAt: new Date(Date.parse(confirmedAt) + 7 * 86400000).toISOString(),
  acknowledgedDraftRaw: null,
});
assert.equal(recoveryCommit.committed, true, JSON.stringify(recoveryCommit));
await page.evaluate(() => window.__repforgeStorage.flush());
const recoveryState = await state();
assert.equal(recoveryState.programMeta.started, confirmedAt.slice(0, 10), "recovery confirmation starts week one");
assert.equal(recoveryState.programMeta.mesocycleStatus, "active");
assert.equal(recoveryState.programMeta.id, source.programMeta.id, "recovery keeps program identity");
assert.equal((recoveryState.programHistory || []).length, (source.programHistory || []).length,
  "recovery creates no archive");
assert.equal(recoveryState.programMeta.blockId, recovery.proposal.diff.recoveryWeek.blockId);
assert.equal(recoveryState.recoveryTransitions.records.at(-1).proposalHash, recovery.proposal.proposalHash,
  "commit retains the preview hash");

await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 20000 });
const weekOne = await page.evaluate(() => ({
  active: window.__repforgeProgressReview.activeRecovery(),
  rows: window.__repforgeProgressReview.scheduledProgram(),
  canonical: window.__repforgeWorkoutDraft.state().program,
}));
assert.ok(weekOne.active, "week one restores the validated recovery marker after reload");
assert.ok(weekOne.rows.some((row, index) => row.sets !== weekOne.canonical[index]?.sets),
  "week one applies the approved recovery overlay");

await page.evaluate(async () => {
  const next = window.__repforgeWorkoutDraft.state();
  const d = new Date(`${next.programMeta.started}T12:00:00`);d.setDate(d.getDate() - 8);
  next.programMeta.started = d.toISOString().slice(0, 10);
  await window.__repforgeCommitProposedState(next);
  await window.__repforgeStorage.flush();
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 20000 });
const weekTwo = await page.evaluate(() => {
  const snapshot = window.__repforgeWorkoutDraft.state();
  const elapsed = 2;
  const canonical = window.RepForgeProgramCompiler.projectProgramForWeek(
    snapshot.program, snapshot.programMeta.programStructure, elapsed);
  return { scheduled: window.__repforgeProgressReview.scheduledProgram(), canonical,
    record: window.__repforgeProgressReview.activeRecovery(), revision: snapshot._storageRevision };
});
assert.deepEqual(weekTwo.scheduled, weekTwo.canonical, "week two restores the canonical prescription exactly");

const beforeReassessment = structuredClone(weekTwo.record);
const reassessed = await adapterCall("reassessRecovery", {
  expectedRevision: weekTwo.revision, blockId: weekTwo.record.diff.recoveryWeek.blockId,
  transitionId: weekTwo.record.transitionId, proposalHash: weekTwo.record.proposalHash,
  acknowledgedRecord: weekTwo.record, outcome: "About the same",
});
assert.equal(reassessed.committed, true, JSON.stringify(reassessed));
const afterReassessment = await page.evaluate(() => window.__repforgeWorkoutDraft.state().recoveryTransitions.records.at(-1));
const expectedReassessment = structuredClone(beforeReassessment);
expectedReassessment.diff.recoveryWeek.reassessmentOutcome = "About the same";
assert.deepEqual(afterReassessment, expectedReassessment, "reassessment changes only the closed outcome field");
assert.equal(afterReassessment.proposalHash, recovery.proposal.proposalHash, "reassessment preserves proposal hash");

await bootFresh();
await seedCompiledProgram();
const volumeBefore = await state();
const volume = await adapterCall("proposeVolumeReduction", {
  diagnosis: { kind: "reduce_training_volume", answers: { confirmed: true },
    eligibleEvidenceIds: ["explicit_volume_reduction"], insufficientEvidenceReasons: [] },
  transitionId: "progress-volume-reduction", successorProgramId: "progress-volume-successor",
});
assert.equal(volume.ok, true, volume.code);
assert.equal(volume.proposal.kind, "reduce_training_volume");
assert.equal(await page.evaluate(p => window.RepForgeProgramTransition.hashProposal(p), volume.proposal),
  volume.proposal.proposalHash);
for (const change of volume.proposal.diff.prescriptions) {
  if (!change.before || !change.after) continue;
  assert.ok(change.after.sets <= change.before.sets, "permanent reduction never raises sets");
}
for (const before of volumeBefore.program) {
  const after = volume.successorInstance.program.find(row => row.slotId === before.slotId);
  if (after) assert.ok(after.sets >= before.minSets,
    `${before.slotId} retains its compiler-authored minimum`);
}
const volumeCommit = await adapterCall("confirmTransition", {
  proposal: volume.proposal, proposalHash: volume.proposal.proposalHash,
  transitionId: volume.proposal.transitionId, successorProgramId: volume.proposal.successor.programId,
  confirmedAt: new Date().toISOString(), acknowledgedDraftRaw: null,
});
assert.equal(volumeCommit.committed, true, JSON.stringify(volumeCommit));
const volumeAfter = await state();
assert.equal(volumeAfter.programHistory.length, (volumeBefore.programHistory || []).length + 1,
  "permanent reduction archives the exact predecessor once");
assert.equal(volumeAfter.programHistory.at(-1).id, volumeBefore.programMeta.id);
assert.equal(volumeAfter.programMeta.transitionIn.proposalHash, volume.proposal.proposalHash,
  "activated program retains exact proposal provenance");
assert.equal(volumeAfter.programMeta.started, new Date().toISOString().slice(0, 10));
assert.equal(volumeAfter.programMeta.mesocycleStatus, "active");

assert.deepEqual(pageErrors, [], "no page errors during recovery and volume lifecycle proof");
await context.close();
await browser.close();
console.log("PASS: protected volume reduction and recovery policy v2 lifecycle");
