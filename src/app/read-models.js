/** Read models take snapshots and already-derived training facts. They never read
 * a store, schedule work, allocate identity or decide a recommendation/outcome.
 * Names are localized by the catalog/presentation boundary before projection.
 */
export function sessionsOnDate(log, date) {
  const bySession = new Map();
  for (const row of log) {
    if (String(row.date) !== date) continue;
    const session = String(row.session || date);
    let group = bySession.get(session);
    if (!group) {
      group = { session, day: row.day, rows: [] };
      bySession.set(session, group);
    }
    group.rows.push(row);
  }
  return [...bySession.values()];
}

export function nextProgramDay(days, from) {
  if (!days.length) return null;
  const index = days.indexOf(from);
  if (index < 0) return days[0];
  return days.length > 1 ? days[(index + 1) % days.length] : null;
}

/** Selection position is over unskipped exercises; no draft bytes are rewritten.
 * labels/exerciseIdsByDay are snapshots, including legacy draft day support.
 */
export function draftResumeLocation({ draft, day, days, labels, exerciseIdsByDay }) {
  if (!draft || typeof draft !== "object") return { label: labels[day] || day, position: null };
  if (draft.schemaVersion === 2 && Array.isArray(draft.exerciseOrder)) {
    const live = draft.exerciseOrder.filter(id => draft.exercises?.[id] && draft.exercises[id].status !== "skipped");
    const named = draft.program?.dayLabel || day;
    return { label: labels[named] || named, position: live.length
      ? { index: Math.max(0, live.indexOf(draft.session?.selectedExerciseId)) + 1, total: live.length } : null };
  }
  const named = typeof draft.__day === "string" && days.includes(draft.__day) ? draft.__day : day;
  const skipped = new Set(Array.isArray(draft.__skipped) ? draft.__skipped : []);
  const live = (exerciseIdsByDay[named] || []).filter(id => !skipped.has(id));
  return { label: labels[named] || named, position: live.length
    ? { index: Math.max(0, live.indexOf(draft.__selectedExerciseId)) + 1, total: live.length } : null };
}

/** Engine rows: {exerciseId,name,glyph,sub,load,target,verdictLabel,sets}.
 * Recap carries canonical summary liftGroups, never a second outcome calculation.
 * UI controllers treat all returned values as readonly.
 */
export function buildTodayReadModel({ date, dateLabel, hasProgram, program, day, dayLabel,
  prescriptionRows = [], canPickDay = false, recap = null, inProgress = false, workoutActive = false, resume = null,
  week, weekStart, weekdayLetters, log = [], next = null, logContext = "" }) {
  if (!hasProgram) return Object.freeze({dateLabel, hasProgram: false});
  const trained = new Set(log.filter(row => String(row.date) >= weekStart && String(row.date) <= date).map(row => String(row.date)));
  const cells = weekdayLetters.map((label, index) => {
    const at = new Date(`${weekStart}T12:00:00`);
    at.setDate(at.getDate() + index);
    const iso = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
    return Object.freeze({ label, today: iso === date, done: trained.has(iso) });
  });
  const dates = log.map(row => String(row.date)).filter(Boolean).sort();
  const last = dates.at(-1);
  const lastTrainingDays = last ? Math.max(0, Math.round((new Date(`${date}T12:00:00`) - new Date(`${last}T12:00:00`)) / 86400000)) : null;
  return Object.freeze({ dateLabel, hasProgram, program, day, dayLabel,
    prescriptionRows: prescriptionRows.map(row => Object.freeze({ ...row })),
    plannedSets: prescriptionRows.reduce((total, row) => total + (+row.sets || 0), 0),
    canPickDay, recap: inProgress ? null : recap, inProgress, workoutActive,
    resume: inProgress && !workoutActive ? resume : null,
    week: Object.freeze({ completedDays: week.completedDays, plannedDays: week.plannedDays, cells }),
    next, lastTrainingDays, logContext });
}

/** Adds presentation labels to canonical completion facts without changing session,
 * exercise, outcome or target identity. The producer owns load-unit conversion.
 */
export function buildSummaryReadModel({ summary, dayLabel, volumeDisplay, nextLabel, liftNames, muscleNames }) {
  return Object.freeze({ ...summary, dayLabel, volumeDisplay,
    liftGroups: summary.liftGroups.map(lift => Object.freeze({ ...lift, displayName: liftNames[lift.liftKey] ?? lift.name })),
    muscles: summary.muscles.map(muscle => Object.freeze({ ...muscle, label: muscleNames[muscle.name] ?? muscle.name })),
    next: summary.next ? Object.freeze({ ...summary.next, label: nextLabel }) : null });
}
