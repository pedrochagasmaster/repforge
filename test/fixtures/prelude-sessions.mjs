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
    const setId = draft.exercises[exId].setOrder[0];
    for (const metric of draft.exercises[exId].sets[setId].programmed.metrics) run("editMetricValue", { setId, metricId: metric.id, value: metric.semantic === "reps" ? "6" : "105" });
    run("editSetField", { setId, field: "rir", value: "1" });
    run("completeSet", { setId, completedAt: when });
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
