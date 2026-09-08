#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Compiler = require("../program-compiler.js");
const Transition = require("../program-transition.js");
const { EXERCISE_LIBRARY } = require("../exercises.js");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const programFamiliesFixture = JSON.parse(
  readFileSync(join(ROOT, "test", "fixtures", "program-families-v1.json"), "utf8")
);

const clone = (v) => JSON.parse(JSON.stringify(v));

const gymContext = (familyId, frequency, extra = {}) => ({
  schemaVersion: 1,
  familyId,
  frequency,
  sessionMinutes: 90,
  equipment: ["barbell", "dumbbell", "machine", "cable", "smith"],
  environment: ["safe_pull", "training_support"],
  loadIncrements: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 5, smith: 2.5 },
  ...extra,
});

const homeContext = (frequency, extra = {}) => ({
  schemaVersion: 1,
  familyId: "home",
  frequency,
  sessionMinutes: 90,
  equipment: [],
  environment: [],
  loadIncrements: {},
  ...extra,
});

function validDiagnosis() {
  return {
    kind: "reduce_training_volume",
    eligibleEvidenceIds: ["systemic_fatigue_elevated", "recovery_score_depressed"],
    insufficientEvidenceReasons: [],
  };
}

function getAuthoredMinSets(classId) {
  const pc = programFamiliesFixture.rules?.prescriptionClasses?.[classId] ||
             Compiler.RULES.prescriptionClasses[classId];
  return pc.sets[0];
}

test("volume policy v1 on all 20 authored compilations: deterministic classification, optional removal, protected retention, reducible floor", async () => {
  for (const familyId of Compiler.FAMILY_IDS) {
    for (const frequency of Compiler.FREQUENCIES) {
      const ctx = familyId === "home" ? homeContext(frequency) : gymContext(familyId, frequency);
      const pred = Compiler.compile(ctx, EXERCISE_LIBRARY);
      assert.equal(pred.kind, "compiled");

      // Build independent oracle before executing proposal
      const predSlots = pred.days.flatMap((d) => d.slots);
      const authoredOptionalSlots = predSlots.filter((s) => s.status === "optional");
      const authoredProtectedSlots = predSlots.filter((s) => s.status === "protected");
      const authoredReducibleSlots = predSlots.filter(
        (s) => s.status !== "optional" && s.status !== "protected" && s.reducible === true
      );

      // Snapshot inputs to assert zero mutation
      const predJsonBefore = JSON.stringify(pred);
      const diagnosis = validDiagnosis();
      const diagnosisJsonBefore = JSON.stringify(diagnosis);

      const input = {
        predecessorInstance: pred,
        predecessor: {
          programId: `prog_${familyId}_${frequency}`,
          durableRevision: 3,
          source: "Recommend",
        },
        transitionId: `tr_vol_${familyId}_${frequency}`,
        successorProgramId: `prog_${familyId}_${frequency}_reduced`,
        createdAt: "2026-10-03T10:00:00.000Z",
        diagnosis,
        supportedVersions: Compiler.VERSIONS,
        policyVersion: 1,
      };

      const result = await Transition.proposeVolumeReduction(input);
      assert.equal(result.ok, true, `failed for ${familyId}_${frequency}: ${result.code}`);
      assert.equal(result.status, "preview");

      // Assert input nonmutation
      assert.equal(JSON.stringify(pred), predJsonBefore, "predecessorInstance was mutated");
      assert.equal(JSON.stringify(diagnosis), diagnosisJsonBefore, "diagnosis was mutated");

      const succ = result.successorInstance;
      const succSlots = succ.days.flatMap((d) => d.slots);

      // 1. All optional slots must be removed
      const succOptional = succSlots.filter((s) => s.status === "optional");
      assert.equal(succOptional.length, 0, `optional slots retained in ${familyId}_${frequency}`);
      assert.equal(
        succSlots.length,
        predSlots.length - authoredOptionalSlots.length,
        "unexpected successor slot count"
      );

      // 2. Protected slots are retained byte-equivalent
      for (const protSlot of authoredProtectedSlots) {
        const found = succSlots.find((s) => s.slotId === protSlot.slotId);
        assert(found, `protected slot ${protSlot.slotId} missing in successor`);
        assert.deepEqual(found, protSlot, `protected slot ${protSlot.slotId} not byte-equivalent`);
      }

      // 3. Safe reducible slots land exactly at minSets (never below)
      for (const redSlot of authoredReducibleSlots) {
        const found = succSlots.find((s) => s.slotId === redSlot.slotId);
        assert(found, `reducible slot ${redSlot.slotId} missing in successor`);
        const minSets = getAuthoredMinSets(redSlot.prescription.classId);
        assert.equal(
          found.prescription.sets,
          minSets,
          `reducible slot ${redSlot.slotId} sets != minSets`
        );
        assert(found.prescription.sets >= minSets, `reducible slot ${redSlot.slotId} fell below minSets floor`);

        // Progression strategies and modifiers remain intact
        assert.equal(
          found.prescription.progression.strategy.id,
          redSlot.prescription.progression.strategy.id
        );
        assert.equal(
          found.prescription.progression.strategy.version,
          redSlot.prescription.progression.strategy.version
        );
        assert.deepEqual(
          found.prescription.progression.modifiers,
          redSlot.prescription.progression.modifiers
        );
      }

      // 4. Exact diff exhaustively reflects each retained/removed slot
      const proposal = result.proposal;
      assert.equal(proposal.schemaVersion, 1);
      assert.equal(proposal.kind, "reduce_training_volume");
      assert.equal(proposal.diff.days.length, pred.days.length);

      for (const optSlot of authoredOptionalSlots) {
        const diffEx = proposal.diff.exercises.find((e) => e.predecessorSlot === optSlot.slotId);
        assert(diffEx, `diff missing removed optional slot ${optSlot.slotId}`);
        assert.equal(diffEx.successorSlot, null);
        assert.equal(diffEx.reason, "removed predecessor slot");
      }

      for (const protSlot of authoredProtectedSlots) {
        const diffEx = proposal.diff.exercises.find((e) => e.predecessorSlot === protSlot.slotId);
        assert(diffEx, `diff missing protected slot ${protSlot.slotId}`);
        assert.equal(diffEx.successorSlot, protSlot.slotId);
        assert.equal(diffEx.reason, "mapped same-template slot");
        assert.equal(diffEx.before.sets, diffEx.after.sets);
      }

      // 5. Progression contract: preservedRelations match relations whose endpoints exist
      assert.equal(proposal.progressionContract.incompatibilities.length, 0);
      assert.equal(proposal.progressionContract.resetRelations.length, 0);
      assert.equal(proposal.progressionContract.preservedRelations.length, pred.relations.length);

      // 6. Repeated determinism
      const result2 = await Transition.proposeVolumeReduction(input);
      assert.equal(proposal.proposalHash, result2.proposal.proposalHash);

      // 7. ValidateProposal accepts valid proposal
      const val = await Transition.validateProposal(proposal, {
        predecessor: input.predecessor,
        predecessorInstance: pred,
        successorInstance: succ,
        supportedVersions: Compiler.VERSIONS,
      });
      assert.equal(val.ok, true, `validateProposal failed: ${val.code}`);
      assert.equal(val.status, "preview");

      // 8. Commit record
      const committed = Transition.commitRecord(proposal, {
        confirmedAt: "2026-10-03T10:05:00.000Z",
        archiveId: `arc_${familyId}_${frequency}`,
      });
      assert.equal(committed.status, "committed");
      assert.equal(committed.confirmedAt, "2026-10-03T10:05:00.000Z");
      assert.equal(committed.archiveId, `arc_${familyId}_${frequency}`);
    }
  }
});

test("semantic rejection before hash rejection: below-floor mutation freshly rehashed", async () => {
  const pred = Compiler.compile(gymContext("growth", 3), EXERCISE_LIBRARY);
  const input = {
    predecessorInstance: pred,
    predecessor: { programId: "prog_g3", durableRevision: 1, source: "Recommend" },
    transitionId: "tr_below_floor",
    successorProgramId: "prog_g3_succ",
    createdAt: "2026-10-03T10:00:00.000Z",
    diagnosis: validDiagnosis(),
    supportedVersions: Compiler.VERSIONS,
    policyVersion: 1,
  };

  const result = await Transition.proposeVolumeReduction(input);
  assert.equal(result.ok, true);

  // Mutate diff exercise below minSets (minSets is 2, set to 0)
  const tamperedProposal = clone(result.proposal);
  const tamperedSucc = clone(result.successorInstance);

  const reducibleSlot = pred.days.flatMap((d) => d.slots).find(
    (s) => s.status !== "protected" && s.reducible === true
  );
  assert(reducibleSlot);

  const reducibleEx = tamperedProposal.diff.exercises.find(
    (e) => e.predecessorSlot === reducibleSlot.slotId
  );
  assert(reducibleEx);
  reducibleEx.after.sets = 0; // Crosses floor!

  for (const day of tamperedSucc.days) {
    for (const slot of day.slots) {
      if (slot.slotId === reducibleEx.predecessorSlot) {
        slot.prescription.sets = 0;
      }
    }
  }
  for (const row of tamperedSucc.program) {
    if (row.slotId === reducibleEx.predecessorSlot) {
      row.sets = 0;
    }
  }

  // Rehash to prove semantic check fires, NOT digest check
  tamperedProposal.proposalHash = await Transition.hashProposal(tamperedProposal);

  const val = await Transition.validateProposal(tamperedProposal, {
    predecessor: input.predecessor,
    predecessorInstance: pred,
    successorInstance: tamperedSucc,
    supportedVersions: Compiler.VERSIONS,
  });

  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "below_floor_cut");
});

test("semantic rejection before hash rejection: protected slot mutation freshly rehashed", async () => {
  const pred = Compiler.compile(gymContext("growth", 3), EXERCISE_LIBRARY);
  const input = {
    predecessorInstance: pred,
    predecessor: { programId: "prog_g3", durableRevision: 1, source: "Recommend" },
    transitionId: "tr_prot_mut",
    successorProgramId: "prog_g3_succ",
    createdAt: "2026-10-03T10:00:00.000Z",
    diagnosis: validDiagnosis(),
    supportedVersions: Compiler.VERSIONS,
    policyVersion: 1,
  };

  const result = await Transition.proposeVolumeReduction(input);
  assert.equal(result.ok, true);

  // Mutate protected slot in diff and successorInstance
  const tamperedProposal = clone(result.proposal);
  const tamperedSucc = clone(result.successorInstance);

  const protectedSlot = pred.days.flatMap((d) => d.slots).find((s) => s.status === "protected");
  assert(protectedSlot);

  const diffEx = tamperedProposal.diff.exercises.find((e) => e.predecessorSlot === protectedSlot.slotId);
  assert(diffEx);
  diffEx.after.sets = diffEx.after.sets - 1; // Mutated protected slot!

  for (const day of tamperedSucc.days) {
    for (const slot of day.slots) {
      if (slot.slotId === protectedSlot.slotId) {
        slot.prescription.sets = slot.prescription.sets - 1;
      }
    }
  }
  for (const row of tamperedSucc.program) {
    if (row.slotId === protectedSlot.slotId) {
      row.sets = row.sets - 1;
    }
  }

  // Rehash to prove semantic check fires, NOT digest check
  tamperedProposal.proposalHash = await Transition.hashProposal(tamperedProposal);

  const val = await Transition.validateProposal(tamperedProposal, {
    predecessor: input.predecessor,
    predecessorInstance: pred,
    successorInstance: tamperedSucc,
    supportedVersions: Compiler.VERSIONS,
  });

  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "protected_slot_mutated");
});

test("semantic rejection: optional slot retained alongside reducible cut", async () => {
  const pred = Compiler.compile(gymContext("growth", 3), EXERCISE_LIBRARY);
  const input = {
    predecessorInstance: pred,
    predecessor: { programId: "prog_g3", durableRevision: 1, source: "Recommend" },
    transitionId: "tr_opt_retained",
    successorProgramId: "prog_g3_succ",
    createdAt: "2026-10-03T10:00:00.000Z",
    diagnosis: validDiagnosis(),
    supportedVersions: Compiler.VERSIONS,
    policyVersion: 1,
  };

  const result = await Transition.proposeVolumeReduction(input);
  assert.equal(result.ok, true);

  const tamperedProposal = clone(result.proposal);
  const tamperedSucc = clone(result.successorInstance);

  // Re-insert an optional slot
  const optionalSlot = pred.days.flatMap((d) => d.slots).find((s) => s.status === "optional");
  assert(optionalSlot);

  tamperedSucc.days[0].slots.push(clone(optionalSlot));

  const diffEx = tamperedProposal.diff.exercises.find((e) => e.predecessorSlot === optionalSlot.slotId);
  if (diffEx) {
    diffEx.successorSlot = optionalSlot.slotId;
    diffEx.after = { sets: optionalSlot.prescription.sets };
  }

  tamperedProposal.proposalHash = await Transition.hashProposal(tamperedProposal);

  const val = await Transition.validateProposal(tamperedProposal, {
    predecessor: input.predecessor,
    predecessorInstance: pred,
    successorInstance: tamperedSucc,
    supportedVersions: Compiler.VERSIONS,
  });

  assert.equal(val.ok, false);
  assert.equal(val.status, "invalid");
  assert.equal(val.code, "optional_slot_retained");
});

test("typed Unavailable: unsupported policy version", async () => {
  const pred = Compiler.compile(gymContext("growth", 3), EXERCISE_LIBRARY);
  const input = {
    predecessorInstance: pred,
    predecessor: { programId: "prog_g3", durableRevision: 1, source: "Recommend" },
    transitionId: "tr_unsupp_policy",
    successorProgramId: "prog_g3_succ",
    createdAt: "2026-10-03T10:00:00.000Z",
    diagnosis: validDiagnosis(),
    supportedVersions: Compiler.VERSIONS,
    policyVersion: 2, // Unsupported!
  };

  const result = await Transition.proposeVolumeReduction(input);
  assert.equal(result.ok, false);
  assert.equal(result.status, "unavailable");
  assert.equal(result.unavailable, true);
  assert.equal(result.code, "unsupported_policy_version");
});

test("typed Unavailable: unsupported compiler version", async () => {
  const pred = Compiler.compile(gymContext("growth", 3), EXERCISE_LIBRARY);
  const input = {
    predecessorInstance: pred,
    predecessor: { programId: "prog_g3", durableRevision: 1, source: "Recommend" },
    transitionId: "tr_unsupp_compiler",
    successorProgramId: "prog_g3_succ",
    createdAt: "2026-10-03T10:00:00.000Z",
    diagnosis: validDiagnosis(),
    supportedVersions: { ...Compiler.VERSIONS, compiler: "0.0.0" }, // Mismatched!
    policyVersion: 1,
  };

  const result = await Transition.proposeVolumeReduction(input);
  assert.equal(result.ok, false);
  assert.equal(result.status, "unavailable");
  assert.equal(result.unavailable, true);
  assert.equal(result.code, "unsupported_compiler_version");
});

test("typed Unavailable: noncanonical re-entry week prescription", async () => {
  // Compile predecessor with re-entry active
  const interruptedPred = Compiler.compile(
    gymContext("growth", 3, { reentryEnabled: true, recentConsistency: "interrupted" }),
    EXERCISE_LIBRARY
  );
  assert.equal(interruptedPred.kind, "compiled");

  const input = {
    predecessorInstance: interruptedPred,
    predecessor: { programId: "prog_interrupted", durableRevision: 1, source: "Recommend" },
    transitionId: "tr_reentry",
    successorProgramId: "prog_interrupted_succ",
    createdAt: "2026-10-03T10:00:00.000Z",
    diagnosis: validDiagnosis(),
    supportedVersions: Compiler.VERSIONS,
    policyVersion: 1,
  };

  const result = await Transition.proposeVolumeReduction(input);
  assert.equal(result.ok, false);
  assert.equal(result.status, "unavailable");
  assert.equal(result.unavailable, true);
  assert.equal(result.code, "noncanonical_reentry_prescription");
});

test("typed Unavailable: no safe volume reduction available", async () => {
  const pred = Compiler.compile(gymContext("growth", 3), EXERCISE_LIBRARY);

  // Run proposeVolumeReduction to obtain an already-minimized compiler snapshot
  const initial = await Transition.proposeVolumeReduction({
    predecessorInstance: pred,
    predecessor: { programId: "prog_g3", durableRevision: 1, source: "Recommend" },
    transitionId: "tr_init",
    successorProgramId: "prog_g3_succ",
    createdAt: "2026-10-03T10:00:00.000Z",
    diagnosis: validDiagnosis(),
    supportedVersions: Compiler.VERSIONS,
    policyVersion: 1,
  });
  assert.equal(initial.ok, true);
  const minimized = initial.successorInstance;

  const input = {
    predecessorInstance: minimized,
    predecessor: { programId: "prog_minimized", durableRevision: 2, source: "Recommend" },
    transitionId: "tr_no_safe",
    successorProgramId: "prog_minimized_succ",
    createdAt: "2026-10-03T10:00:00.000Z",
    diagnosis: validDiagnosis(),
    supportedVersions: Compiler.VERSIONS,
    policyVersion: 1,
  };

  const result = await Transition.proposeVolumeReduction(input);
  assert.equal(result.ok, false);
  assert.equal(result.status, "unavailable");
  assert.equal(result.unavailable, true);
  assert.equal(result.code, "no_safe_volume_reduction");
});

test("typed Unavailable: customized or malformed predecessor snapshot", async () => {
  const pred = Compiler.compile(gymContext("growth", 3), EXERCISE_LIBRARY);
  const customized = clone(pred);
  customized.customizedFrom = { programId: "orig_prog" };

  const input = {
    predecessorInstance: customized,
    predecessor: { programId: "prog_cust", durableRevision: 1, source: "Recommend" },
    transitionId: "tr_cust",
    successorProgramId: "prog_cust_succ",
    createdAt: "2026-10-03T10:00:00.000Z",
    diagnosis: validDiagnosis(),
    supportedVersions: Compiler.VERSIONS,
    policyVersion: 1,
  };

  const result = await Transition.proposeVolumeReduction(input);
  assert.equal(result.ok, false);
  assert.equal(result.status, "unavailable");
  assert.equal(result.unavailable, true);
  assert.equal(result.code, "customized_compiler_snapshot");
});
