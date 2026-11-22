/**
 * An earlier saved session with a suggested warm-up, built from the real draft commands and the app's own save projection and
 * committed to the page's state. Browser suites and catalog scenarios use it to give a lift the history that learning reads.
 * `steps` are the [load kg, reps] pairs the lifter logged; `skip` is a whole explicit skip.
 */
export async function savedWarmupSession(page, { exId, id, daysAgo, steps, skip = false }) {
  await page.evaluate(async ({ exId, id, daysAgo, steps, skip }) => {
    const W = window.RepForgeWorkoutDraft;
    let draft = window.__repforgeWorkoutDraft.current(), n = 0;
    const when = new Date(Date.now() - daysAgo * 86400000).toISOString();
    const run = (type, fields = {}) => {
      const operationId = `fake-${id}-${++n}`;
      const next = W.reduce(draft, { exerciseInstanceId: exId, ...fields, type, operationId, expectedRevision: draft.revision, updatedAt: when, writer: { ...draft.writer, operationId } });
      if (W.isDomainError(next)) throw new Error(`${type}: ${JSON.stringify(next)}`);
      draft = next;
    };
    const ex = sessionExercise(prog.find(exId));
    let live = warmupSuggest(ex);
    // A lift with no history yet offers no load; the session being built worked at 105 kg, so its plan was made for that.
    if (!(live.workLoadKg > 0)) live = { ...live, workLoadKg: 105, result: window.RepForgeWarmupSuggestions.suggestWarmups({ ...live.input, workLoadKg: 105 }) };
    const suggested = live.result.suggestions;
    run("initWarmupPrelude", { plan: warmupPlanOf(live), steps: (suggested.length ? suggested : [{ loadKg: 60, reps: 5 }]).map((item, index) => ({ stepId: `${id}-${index}`, loadKg: item.loadKg, reps: item.reps })) });
    const record = () => draft.exercises[exId].warmupPrelude;
    if (skip) run("skipWarmupSteps");
    else {
      const [loadMetric, repsMetric] = [record().composition.metrics.find((m) => m.semantic === "loadKg"), record().composition.metrics.find((m) => m.semantic === "reps")];
      for (let index = 0; index < steps.length; index++) {
        const step = record().steps[index];
        if (!step) run("addWarmupStep", { stepId: `${id}-m${index}`, values: { [loadMetric.id]: String(steps[index][0]), [repsMetric.id]: String(steps[index][1]) } });
        else { run("editWarmupStep", { stepId: step.stepId, metricId: loadMetric.id, value: String(steps[index][0]) }); run("editWarmupStep", { stepId: step.stepId, metricId: repsMetric.id, value: String(steps[index][1]) }); }
        run("completeWarmupStep", { stepId: record().steps[index].stepId, completedAt: when });
      }
      if (record().steps.some((step) => step.completion === "pending")) run("skipWarmupSteps");
    }
    // Every working set of the exercise is done, so a later session has a "last time" for each of them.
    for (const setId of draft.exercises[exId].setOrder) {
      for (const metric of draft.exercises[exId].sets[setId].programmed.metrics) run("editMetricValue", { setId, metricId: metric.id, value: metric.semantic === "reps" ? "6" : "105" });
      run("editSetField", { setId, field: "rir", value: "1" });
      run("completeSet", { setId, completedAt: when });
    }
    run("beginFinish");
    const rows = W.toHistoryRows(draft, when).map((row) => ({ ...row, session: id, date: when.slice(0, 10) }));
    const observations = warmupObservationsForSave({ ...draft, draftId: id }, rows, when);
    const proposal = window.__repforgeWorkoutDraft.state();
    proposal.log = [...proposal.log, ...rows];
    if (observations) proposal.warmupObservations = { ...(proposal.warmupObservations || {}), ...observations };
    const result = await window.__repforgeCommitProposedState(proposal);
    if (!result.committed) throw new Error("could not save " + id);
  }, { exId, id, daysAgo, steps, skip });
}

/**
 * Earlier sessions in which the lift was done after another lift for the same muscle: the other lift (`otherId`, swapped to
 * `replacementName`) was logged ten minutes before, and the lift (`exId`) was warmed up with the one feeler step `[load, reps]`.
 * Two of them make "already warm" the lifter's own pattern for the lift that follows that one.
 */
export async function savedAfterLeadSessions(page, { exId, otherId, replacementName, id, daysAgo, feeler }) {
  await page.evaluate(async ({ exId, otherId, replacementName, id, daysAgo, feeler }) => {
    const W = window.RepForgeWorkoutDraft;
    let draft = window.__repforgeWorkoutDraft.current(), n = 0;
    const whenMs = Date.now() - daysAgo * 86400000, when = new Date(whenMs).toISOString(), lead = new Date(whenMs - 10 * 60000).toISOString();
    const run = (type, fields = {}, at = when) => {
      const operationId = `after-${id}-${++n}`;
      const next = W.reduce(draft, { exerciseInstanceId: exId, ...fields, type, operationId, expectedRevision: draft.revision, updatedAt: at, writer: { ...draft.writer, operationId } });
      if (W.isDomainError(next)) throw new Error(`${type}: ${JSON.stringify(next)}`);
      draft = next;
    };
    const squat = draft.exercises[exId], replacement = window.RepForgeExerciseCatalog.snapshot().exercises.find((entry) => entry.name === replacementName);
    run("substituteExercise", { exerciseInstanceId: otherId, selectedAt: lead,
      replacement: { exerciseInstanceId: otherId, sourceExerciseId: draft.exercises[otherId].sourceExerciseId, displayName: replacement.name, libraryId: replacement.id, primary: squat.programmed.primary, secondary: "" } }, lead);
    const leadSet = draft.exercises[otherId].setOrder[0];
    for (const metric of draft.exercises[otherId].sets[leadSet].programmed.metrics) run("editMetricValue", { exerciseInstanceId: otherId, setId: leadSet, metricId: metric.id, value: metric.semantic === "reps" ? "10" : "120" }, lead);
    run("editSetField", { exerciseInstanceId: otherId, setId: leadSet, field: "rir", value: "1" }, lead);
    run("completeSet", { exerciseInstanceId: otherId, setId: leadSet, completedAt: lead }, lead);
    // The plan the lifter was shown: made with the lead lift already done.
    const ex = sessionExercise(prog.find(exId)), base = warmupSuggest(ex), leadLift = warmupLift(draft.exercises[otherId]), squatLift = warmupLift(squat);
    const input = { ...base.input, sessionId: id, now: whenMs, workLoadKg: 105, completedWorkingLifts: [{ liftKey: leadLift.key, movementId: leadLift.id, primaryMuscle: squatLift.muscle, sessionId: id, completedAt: whenMs - 10 * 60000 }] };
    const live = { ...base, workLoadKg: 105, input, result: window.RepForgeWarmupSuggestions.suggestWarmups(input) };
    run("initWarmupPrelude", { plan: warmupPlanOf(live), steps: [{ stepId: `${id}-feeler`, loadKg: feeler[0], reps: feeler[1] }] });
    run("completeWarmupStep", { stepId: `${id}-feeler`, completedAt: when });
    for (const setId of squat.setOrder) {
      for (const metric of draft.exercises[exId].sets[setId].programmed.metrics) run("editMetricValue", { setId, metricId: metric.id, value: metric.semantic === "reps" ? "6" : "105" });
      run("editSetField", { setId, field: "rir", value: "1" });
      run("completeSet", { setId, completedAt: when });
    }
    run("beginFinish");
    const rows = W.toHistoryRows(draft, when).map((row) => ({ ...row, session: id, date: when.slice(0, 10) }));
    const observations = warmupObservationsForSave({ ...draft, draftId: id }, rows, when);
    if (!observations) throw new Error("no observation for " + id + ": " + JSON.stringify(live.result.evidence.earlierLift));
    const proposal = window.__repforgeWorkoutDraft.state();
    proposal.log = [...proposal.log, ...rows];
    proposal.warmupObservations = { ...(proposal.warmupObservations || {}), ...observations };
    const result = await window.__repforgeCommitProposedState(proposal);
    if (!result.committed) throw new Error("could not save " + id);
  }, { exId, otherId, replacementName, id, daysAgo, feeler });
}
