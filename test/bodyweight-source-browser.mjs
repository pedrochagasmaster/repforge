#!/usr/bin/env node
/**
 * Owner report C1 (2026-11-03), decision 2026-11-04: a bodyweight on file is "the lifter's last known weight".
 *
 * The lifter gave a weight in setup and left Session details' bodyweight empty. On the Standing EZ bar overhead triceps
 * extension (bodyweight coefficient 0.046), set 1 was logged at 55 × 8, RIR 0, and set 2 had no suggestion: the slot's
 * configuration counted the setup weight, while the logged set recorded none, so the engine called it a different
 * loading setup. A set that recorded no bodyweight is now "contribution unknown", valued with the resolved bodyweight:
 *
 * 1. Set 2 of the owner's path gets a real recommendation, and the cue gives a load, not a mismatch.
 * 2. The session saved that way (no bodyweight recorded) anchors the next session's first set.
 * 3. Its stored rows are unchanged in shape: loadingContext.bodyweightKg stays null, as the row's bodyweight is.
 *
 * Owner rule 2026-11-05: bodyweight counts only where it is a material share of the load (coefficient ≥ 0.30). The
 * extension (0.046) counts none: no contribution, no Why line about bodyweight, not in Session details' bodyweight
 * note, and Progress's strength, which never counted bodyweight, keeps its chart without a step.
 *
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { finishEarly } from "./fixtures/focus-workout.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const EZ = "1a15c6f170d88047b7a9c99076376323";
const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa", REPS = "2555c6f170d88072bbf6d9ad3f16ea86";
const results = { passed: 0, failed: 0 };
function check(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}${detail === undefined ? "" : `\n    ${JSON.stringify(detail).slice(0, 1500)}`}`); }
}

const browser = await launchChromium();
try {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  // A generated program that places the EZ-bar extension, the lifter's setup weight, and no session bodyweight.
  const target = await page.evaluate(async (EZ) => {
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const request = window.RepForgeProgramEntryAdapter.programRequestFromAnswers({ desiredResult: "muscle_growth",
      structuredExperience: "under_6m", daysPerWeek: 4, sessionMinutes: 90, environment: { kind: "commercial_gym" } }, catalog).value;
    const definition = window.RepForgeProgramCompiler.generateProgram(request, catalog).value;
    await window.__repforgeFinalizeProgramSetup({ programDefinition: definition, name: "Bodyweight source", answers: {}, destination: "log",
      origin: "first-run", draftConfirmed: true, telemetryRoute: "recommend", entrySource: { route: "recommend", fingerprint: "bodyweight-source" } });
    const proposal = structuredClone(state);
    proposal.profile = { ...(proposal.profile || {}), weightKg: 80 };
    await window.__repforgeCommitProposedState(proposal);
    await window.__repforgeStorage.flush();
    const day = state.programMeta.programDefinition.days.find((d) => d.slots.some((s) => s.exerciseId === EZ));
    return day ? { day: day.name, id: day.slots.find((s) => s.exerciseId === EZ).id, resolved: sessionBodyweightKg(), profile: state.profile?.weightKg } : null;
  }, EZ);
  check(!!target && target.resolved === 80, "the fixture: the EZ-bar extension is in the program, and the setup weight resolves", target);
  const logSet = (n, load, reps, rir) => page.evaluate(async ({ id, n, load, reps, rir, weight, repsId }) => {
    const api = window.__repforgeWorkoutDraft, d = api.current(), setId = d.exercises[id].setOrder[n - 1];
    await api.dispatch("editMetricValue", { exerciseInstanceId: id, setId, metricId: weight, value: String(load) });
    await api.dispatch("editMetricValue", { exerciseInstanceId: id, setId, metricId: repsId, value: String(reps) });
    await api.dispatch("editSetField", { exerciseInstanceId: id, setId, field: "rir", value: String(rir) });
    await api.dispatch("completeSet", { exerciseInstanceId: id, setId, completedAt: new Date().toISOString() });
    await api.flush();
  }, { id: target.id, n, load, reps, rir, weight: WEIGHT, repsId: REPS });
  const readSet = (n) => page.evaluate(({ id, n }) => {
    const ex = sessionExercise(prog.find(id)), r = recommendation(ex), item = r.targetSets.find((t) => t.prescription?.setIndex === n);
    const cue = focusCue(ex, n, r, hydrateWorkoutDraft(), last(ex), false);
    return { status: item?.status, codes: item?.result?.reasonCodes || [], cue: cue.kind, load: cue.loadText ?? null,
      sessionBodyweight: activeWorkoutDraft.session.bodyweight ?? null };
  }, { id: target.id, n });

  console.log("\n1. The owner's path: set 1 logged at RIR with no session bodyweight, set 2");
  await page.evaluate((day) => window.__repforgeEnterWorkout({ day }), target.day);
  await page.waitForFunction(() => !!window.__repforgeWorkoutDraft.current());
  await logSet(1, 55, 8, 0);
  const second = await readSet(2);
  check(second.sessionBodyweight == null || second.sessionBodyweight === "", "Session details' bodyweight is empty, as the owner's was", second);
  check(second.status === "recommended" && !second.codes.includes("loading_convention_mismatch"),
    "set 2 gets a real recommendation: an unrecorded bodyweight is not a different loading setup", second);
  check(second.cue === "now" && Number(second.load) > 0, "the cue gives set 2 a load", second);

  console.log("\n1b. Bodyweight is not a material share of this lift (owner rule, 2026-11-05)");
  const material = await page.evaluate((id) => {
    const ex = sessionExercise(prog.find(id)), rec = recommendation(ex);
    const rows = engineWhyRows(ex, rec, 2) || [];
    return {
      whyBodyweight: rows.filter((row) => row.kind === "bodyweight" || row.kind === "per_side_bodyweight").map((row) => row.text),
      whyText: rows.map((row) => row.text).join(" "),
      contribution: rec.targetSets.find((t) => t.prescription?.setIndex === 2)?.result?.loadingAssumptions?.bodyweightContributionKg ?? null,
      noteLifts: sessionBodyweightLifts(activeWorkoutDraft),
      name: exerciseDisplayName(ex),
      kept: typeof materialBodyweightCoefficient === "function"
        ? [materialBodyweightCoefficient(0.626, "external"), materialBodyweightCoefficient(1, "bodyweight"), materialBodyweightCoefficient(0.046, "external")] : null,
    };
  }, target.id);
  check(material.contribution === 0, "the engine counts none of the 80 kg on file toward the EZ-bar extension's load", material);
  check(!material.whyBodyweight.length && !/of your bodyweight/.test(material.whyText),
    "the Why sheet no longer says it counts kilograms of your bodyweight for it", material);
  check(!material.noteLifts.includes(material.name), "Session details does not list it among the lifts that count bodyweight", material);
  // The same lift at a material share (as a squat's 0.626) is listed: the note names the lifts that do count bodyweight.
  const listed = await page.evaluate((id) => {
    const slot = state.programMeta.programDefinition.days.flatMap((d) => d.slots).find((s) => s.id === id), was = slot.loadingModel.bodyweightCoefficient;
    slot.loadingModel.bodyweightCoefficient = 0.626;
    try { return sessionBodyweightLifts(activeWorkoutDraft); } finally { slot.loadingModel.bodyweightCoefficient = was; }
  }, target.id);
  check(listed.includes(material.name), "at a material share the same lift is listed, so the note prompts only where bodyweight counts", listed);
  check(JSON.stringify(material.kept) === JSON.stringify([0.626, 1, 0]), "a squat and a pull-up keep their share; the extension reads as none", material.kept);

  console.log("\n2. The session saved that way anchors the next one, and its rows keep their shape");
  await logSet(2, 55, 8, 0);
  await finishEarly(page);
  const rows = await page.evaluate((id) => state.log.filter((row) => row.exerciseId === id || row.performedLibraryId === "1a15c6f170d88047b7a9c99076376323")
    .map((row) => ({ bodyweight: row.bodyweight ?? null, contextBodyweight: row.loadingContext?.bodyweightKg ?? null, flag: row.loadingContext?.bodyweightContributionEnabled })), target.id);
  check(rows.length >= 2 && rows.every((row) => row.bodyweight === null && row.contextBodyweight === null && row.flag === false),
    "the stored rows record no bodyweight, exactly as before the change", rows);
  // Progress reads strength from the external load alone, so the rule moves no chart: no step between sessions.
  const strength = await page.evaluate((id) => readLogRows().filter((row) => row.performedLibraryId === "1a15c6f170d88047b7a9c99076376323" || row.exerciseId === id)
    .map((row) => ({ e1rm: Math.round(row.e1rm * 1000) / 1000, external: Math.round(row.load * (1 + row.reps / 30) * 1000) / 1000 })), target.id);
  check(strength.length >= 2 && strength.every((row) => row.e1rm === row.external),
    "Progress's e1RM for the lift is its external load alone, so its chart has no bodyweight step", strength);
  await page.evaluate((day) => window.__repforgeEnterWorkout({ day }), target.day);
  await page.waitForFunction(() => !!window.__repforgeWorkoutDraft.current());
  const next = await readSet(1);
  check(next.status === "recommended" && next.cue === "now" && Number(next.load) > 0,
    "the next session's first set is anchored on the session saved without a bodyweight", next);
  check(!errors.length, "no page errors", errors);
  await context.close();
} finally {
  await browser.close();
}
console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
