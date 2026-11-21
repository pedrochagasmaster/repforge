#!/usr/bin/env node
/**
 * Plan 085 slice 3: the two durable warm-up maps through the production state owners. Observations name saved rows by natural
 * selectors and preferences hold one reset token per lift. Both must survive a rebased first write by another tab, vanish with
 * the rows or the log, import only for sessions an import adds, and protect a destination from an install transfer.
 */
import assert from "node:assert/strict";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { installSeedProgram, seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page);
  await installSeedProgram(page, { key: "repforge_v1", waitFor: waitForAppBoot });
  await page.locator("#startWorkout").click();
  await page.waitForSelector("#workoutShell:not(.hidden)");
  const outcome = await page.evaluate(async ({ program, meta }) => {
    const out = {};
    // Real rows, from the real draft commands and projection: a warm-up beside one working set.
    const W = window.RepForgeWorkoutDraft, exId = "seed-ex-2";
    const rows = (session) => {
      let draft = window.__repforgeWorkoutDraft.current(), n = 0;
      const when = "2026-08-01T10:00:00.000Z";
      const run = (type, fields = {}) => {
        const operationId = `rows-${session}-${++n}`;
        const next = W.reduce(draft, { exerciseInstanceId: exId, ...fields, type, operationId, expectedRevision: draft.revision, updatedAt: when, writer: { ...draft.writer, operationId } });
        if (W.isDomainError(next)) throw new Error(`${type}: ${JSON.stringify(next)}`);
        draft = next;
      };
      const ex = sessionExercise(prog.find(exId)), live = warmupSuggest(ex);
      if (draft.exercises[exId].warmupPrelude) throw new Error("fixture draft already has a Prelude");
      run("initWarmupPrelude", { plan: warmupPlanOf(live), steps: [{ stepId: "s1", loadKg: 50, reps: 5 }] });
      run("completeWarmupStep", { stepId: "s1", completedAt: when });
      const setId = draft.exercises[exId].setOrder[0];
      for (const metric of draft.exercises[exId].sets[setId].programmed.metrics) run("editMetricValue", { setId, metricId: metric.id, value: metric.semantic === "reps" ? "6" : "100" });
      run("editSetField", { setId, field: "rir", value: "1" });
      run("completeSet", { setId, completedAt: when });
      run("beginFinish");
      return W.toHistoryRows(draft, when).filter((row) => row.exerciseId === exId).map((row) => ({ ...row, session, date: "2026-08-01" }));
    };
    const work = (session) => rows(session).find((row) => !row.warmup);
    const PERFORMED = work("probe").performedLibraryId;
    const grid = [{ rungKg: 50, belowKg: 2.5, aboveKg: 2.5 }];
    const observation = (liftKey, generation = null) => ({ v: 1, liftKey, exerciseId: exId, performedKey: PERFORMED, workingOrdinal: 1, warmupOrdinals: [1],
      savedAt: 1_700_000_000_000, resetGeneration: generation, decision: "edited", workLoadKg: 100, barKg: null, earlierLift: null, stepGrid: grid });
    const entry = (...items) => ({ v: 1, observations: items });
    const reset = (token) => ({ v: 1, resetGeneration: token, resetAt: "2026-08-01T00:00:00.000Z" });
    const base = { settings: {}, program: [], log: [] };
    const rebase = (b, p, t) => window.__repforgeStorage.rebaseForTest(b, p, t);

    // Two tabs write their first observation for different sessions: both survive the rebase.
    const mine = { ...base, log: rows("a"), warmupObservations: { a: entry(observation("lift-a")) } };
    const theirs = { ...base, log: rows("b"), warmupObservations: { b: entry(observation("lift-a")) } };
    const merged = rebase(base, mine, theirs);
    out.bothSessions = Object.keys(merged.warmupObservations || {}).sort().join();
    // Two first resets for different lifts both survive; the same lift keeps the committed token.
    const resetMine = rebase(base, { ...base, warmupPreferences: { x: reset("g1"), z: reset("m") } }, { ...base, warmupPreferences: { y: reset("g2"), z: reset("t") } });
    out.resets = Object.keys(resetMine.warmupPreferences).sort().join();
    out.sameLift = resetMine.warmupPreferences.z.resetGeneration;
    // A delete of the history does not resurrect older evidence on a rebased retry.
    const withLog = { ...base, log: rows("a"), warmupObservations: { a: entry(observation("lift-a")) } };
    out.deleted = JSON.stringify(rebase(withLog, { ...withLog, log: [], warmupObservations: undefined }, withLog).warmupObservations ?? null);
    // Rows another tab removed take their observation with them (the join is reconciled against the merged head).
    out.orphan = JSON.stringify(rebase(withLog, { ...withLog, warmupPreferences: { q: reset("g") } }, { ...withLog, log: [] }).warmupObservations ?? null);

    // Load: a valid map survives, a stale reference is dropped, malformed data is refused.
    out.valid = isValidStateShape({ ...withLog });
    out.badMap = isValidStateShape({ ...withLog, warmupObservations: [] });
    out.badPrefs = isValidStateShape({ ...withLog, warmupPreferences: { x: { v: 2 } } });
    out.stale = JSON.stringify(Object.keys(normalizeLoaded({ ...withLog, log: [work("a")] }).warmupObservations ?? {}));
    out.emptyOmitted = Object.hasOwn(normalizeLoaded({ ...withLog, warmupPreferences: {} }), "warmupPreferences");

    // Import: only sessions the import adds, and only under the generation this device holds for the lift.
    const seeded = window.__repforgeWorkoutDraft.state();
    seeded.program = program; seeded.programMeta = meta;
    seeded.log = rows("have");
    seeded.warmupObservations = { have: entry(observation("lift-a")) };
    seeded.warmupPreferences = { "lift-b": reset("local") };
    let result = await window.__repforgeCommitProposedState(seeded);
    if (!result.committed) throw new Error("seed state did not commit");
    const incoming = { ...seeded, log: [...rows("have"), ...rows("new-a"), ...rows("new-b")],
      warmupObservations: { have: entry({ ...observation("lift-a"), decision: "completed" }), "new-a": entry(observation("lift-a")), "new-b": entry(observation("lift-b", "remote")) } };
    const imported = await mergeImportedLog(incoming);
    out.imported = imported.added;
    const after = window.__repforgeWorkoutDraft.state();
    out.importKeys = Object.keys(after.warmupObservations).sort().join();
    out.haveKept = after.warmupObservations.have.observations[0].decision;
    out.prefKept = after.warmupPreferences["lift-b"].resetGeneration;

    // Deleting the log clears both maps with it.
    await deleteTrainingLog();
    const cleared = window.__repforgeWorkoutDraft.state();
    out.cleared = [Object.hasOwn(cleared, "warmupObservations"), Object.hasOwn(cleared, "warmupPreferences"), cleared.log.length].join();
    return out;
  }, { program: seedProgram(), meta: seedProgramMeta() });
  // A device with nothing on it: the maps alone decide whether a transfer may replace it.
  const fresh = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await fresh.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(fresh);
  const eligibility = await fresh.evaluate(() => {
    const reset = { v: 1, resetGeneration: "g", resetAt: "2026-08-01T00:00:00.000Z" };
    const empty = normalizeLoaded(null);
    return [installTransferStateMeaningful(empty), installTransferStateMeaningful({ ...empty, warmupObservations: {}, warmupPreferences: {} }),
      installTransferStateMeaningful({ ...empty, warmupPreferences: { x: reset } }), installTransferStateMeaningful({ ...empty, warmupObservations: [] })];
  });
  await fresh.close();
  assert.equal(outcome.bothSessions, "a,b", "two first writes for different sessions both survive");
  assert.equal(outcome.resets, "x,y,z", "two first resets for different lifts both survive");
  assert.equal(outcome.sameLift, "t", "the same lift keeps the latest committed token");
  assert.equal(outcome.deleted, "null", "a deleted history is not resurrected");
  assert.equal(outcome.orphan, "null", "an observation never outlives its rows");
  assert.deepEqual([outcome.valid, outcome.badMap, outcome.badPrefs], [true, false, false], "shape validation");
  assert.equal(outcome.stale, "[]", "a stale reference is dropped on load");
  assert.equal(outcome.emptyOmitted, false, "an empty map is omitted");
  assert.deepEqual(eligibility, [false, false, true, true], "transfer eligibility: only a present nonempty or malformed record protects the destination");
  assert.equal(outcome.imported, 2, "an import adds the two new sessions");
  assert.equal(outcome.importKeys, "have,new-a", "imported learning is for added sessions under this device's generation");
  assert.equal(outcome.haveKept, "edited", "an existing session keeps its own observation");
  assert.equal(outcome.prefKept, "local", "local reset decisions are never overwritten");
  assert.equal(outcome.cleared, "false,false,0", "deleting the log clears both maps");
  console.log("PASS: Prelude durable maps merge, import, protect and clear");
} finally {
  await browser.close();
}
