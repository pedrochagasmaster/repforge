import {evidence as progressEvidence} from "../training/progress.js";
/** Read models take snapshots and already-derived training facts. They never read
 * a store, schedule work, allocate identity or decide a recommendation/outcome.
 * Names are localized by the catalog/presentation boundary before projection.
 */
/** @typedef {Record<string,unknown>} JsonRecord
 * @typedef {{date?:unknown,session?:unknown,day?:unknown,[key:string]:unknown}} LogProjection
 * @typedef {{index:number,total:number}} ResumePosition
 * @typedef {{label:string,position:ResumePosition|null}} ResumeLocation
 * @typedef {{exerciseId:string,name:string,glyph:string,sub:string,load:number|null,target:string,verdictLabel:string,sets:number|string,[key:string]:unknown}} PrescriptionRow
 * @typedef {{liftGroups:{liftKey:string,name:string,[key:string]:unknown}[],muscles:{name:string,[key:string]:unknown}[],next?:{day:string,[key:string]:unknown}|null,[key:string]:unknown}} SummaryFacts
 * @typedef {{dateLabel:string,hasProgram:false}|{date:string,dateLabel:string,hasProgram:true,program:{name?:string,visible:boolean,total:number|null,current:number|null,weekCopy:string,deload:boolean},day:string,dayLabel:string,prescriptionRows?:PrescriptionRow[],canPickDay?:boolean,recap?:JsonRecord|null,inProgress?:boolean,workoutActive?:boolean,resume?:ResumeLocation|null,week:{completedDays:number,plannedDays:number},weekStart:string,weekdayLetters:string[],log?:LogProjection[],next?:{day:string,label:string,exercises:number}|null,logContext?:string}} TodayInput
 */
/** @template {LogProjection} R @param {R[]} log @param {string} date */
export function sessionsOnDate(log, date) {
  /** @type {Map<string,{session:string,day:unknown,rows:R[]}>} */
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

/** @param {string[]} days @param {string} from */
export function nextProgramDay(days, from) {
  if (!days.length) return null;
  const index = days.indexOf(from);
  if (index < 0) return days[0];
  return days.length > 1 ? days[(index + 1) % days.length] : null;
}

/** Selection position is over unskipped exercises; no draft bytes are rewritten.
 * labels/exerciseIdsByDay are snapshots, including legacy draft day support.
 */
/** @param {{draft:unknown,day:string,days:string[],labels:Record<string,string>,exerciseIdsByDay:Record<string,string[]>}} input @returns {ResumeLocation} */
export function draftResumeLocation({ draft:rawDraft, day, days, labels, exerciseIdsByDay }) {
  const draft = /** @type {JsonRecord|null|undefined} */(rawDraft);
  if (!draft || typeof draft !== "object") return { label: labels[day] || day, position: null };
  if (draft.schemaVersion === 2 && Array.isArray(draft.exerciseOrder)) {
    const live = draft.exerciseOrder.filter(id => (/** @type {Record<string,{status?:unknown}>|null|undefined} */(draft.exercises))?.[/** @type {string} */(id)] && (/** @type {Record<string,{status?:unknown}>} */(draft.exercises))[/** @type {string} */(id)].status !== "skipped");
    const named = /** @type {string} */((/** @type {JsonRecord|null|undefined} */(draft.program))?.dayLabel || day);
    return { label: labels[named] || named, position: live.length
      ? { index: Math.max(0, live.indexOf((/** @type {JsonRecord|null|undefined} */(draft.session))?.selectedExerciseId)) + 1, total: live.length } : null };
  }
  const named = typeof draft.__day === "string" && days.includes(draft.__day) ? draft.__day : day;
  const skipped = new Set(Array.isArray(draft.__skipped) ? draft.__skipped : []);
  const live = (exerciseIdsByDay[named] || []).filter(id => !skipped.has(id));
  return { label: labels[named] || named, position: live.length
    ? { index: Math.max(0, live.indexOf(/** @type {string} */(draft.__selectedExerciseId))) + 1, total: live.length } : null };
}

/** Engine rows: {exerciseId,name,glyph,sub,load,target,verdictLabel,sets}.
 * Recap carries canonical summary liftGroups, never a second outcome calculation.
 * UI controllers treat all returned values as readonly.
 */
/** @param {TodayInput} input */
export function buildTodayReadModel(input) {
  if (!input.hasProgram) return Object.freeze({dateLabel:input.dateLabel,hasProgram:false});
  const { date, dateLabel, hasProgram, program, day, dayLabel,
  prescriptionRows = [], canPickDay = false, recap = null, inProgress = false, workoutActive = false, resume = null,
  week, weekStart, weekdayLetters, log = [], next = null, logContext = "" } = input;
  const trained = new Set(log.filter(row => String(row.date) >= weekStart && String(row.date) <= date).map(row => String(row.date)));
  const cells = weekdayLetters.map((label, index) => {
    const at = new Date(`${weekStart}T12:00:00`);
    at.setDate(at.getDate() + index);
    const iso = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
    return Object.freeze({ label, today: iso === date, done: trained.has(iso) });
  });
  const dates = log.map(row => String(row.date)).filter(Boolean).sort();
  const last = dates.at(-1);
  const lastTrainingDays = last ? Math.max(0, Math.round((new Date(`${date}T12:00:00`).getTime() - new Date(`${last}T12:00:00`).getTime()) / 86400000)) : null;
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
/** @template {SummaryFacts} T @param {{summary:T,dayLabel:string,volumeDisplay:number,nextLabel:string|null,liftNames:Record<string,string>,muscleNames:Record<string,string>}} input */
export function buildSummaryReadModel({ summary, dayLabel, volumeDisplay, nextLabel, liftNames, muscleNames }) {
  return Object.freeze({ ...summary, dayLabel, volumeDisplay,
    liftGroups: summary.liftGroups.map(lift => Object.freeze({ ...lift, displayName: liftNames[lift.liftKey] ?? lift.name })),
    muscles: summary.muscles.map(muscle => Object.freeze({ ...muscle, label: muscleNames[muscle.name] ?? muscle.name })),
    next: summary.next ? Object.freeze({ ...summary.next, label: nextLabel }) : null });
}

/** Exercise detail groups acknowledged rows without normalizing saved identity.
 * Row projection supplies canonical e1RM and attribution; this builder owns only
 * grouping, maxima and display ordering, never training recommendations.
 * @param {import('./exercise-contracts.js').ExerciseFacts} facts
 */
export function buildExerciseReadModel({rows,prs,summaries,comparisons}){
  const sessions=groupExerciseSessions(rows);
  const work=rows.filter(row=>!row.warmup),events=[...prs].reverse();
  return Object.freeze({sessions:Object.freeze(sessions.map(session=>Object.freeze({...session,rows:Object.freeze(session.rows.map(row=>Object.freeze({...row})))}))),
    topLoad:Math.max(0,...work.map(row=>Number(row.load)||0)),bestE:work.length?Math.max(...work.map(row=>row.e1rm)):0,
    prCount:prs.length,loadPr:events.find(event=>event.kind==='load'),e1Pr:events.find(event=>event.kind==='e1rm'),summaries:Object.freeze([...summaries]),
    recent:Object.freeze([...sessions].reverse().slice(0,8).map(session=>Object.freeze({...session,rows:Object.freeze(session.rows.map(row=>Object.freeze({...row}))),
      best:[...session.rows].filter(row=>!row.warmup).sort((a,b)=>Number(b.load)-Number(a.load)||Number(b.reps)-Number(a.reps))[0],
      comparison:comparisons.get(session.session)||null})))});
}

/** @param {readonly import("./exercise-contracts.js").ExerciseRow[]} rows */
export function groupExerciseSessions(rows){
  /** @type {Map<string|number|undefined,import('./exercise-contracts.js').ExerciseSession>} */
  const groups=new Map();
  for(const row of rows){
    let session=groups.get(row.session);
    if(!session){session={session:row.session,date:row.date,day:row.day,created:row.created,rows:[],note:''};groups.set(row.session,session)}
    if(!session.date&&row.date)session.date=row.date;
    if(!session.created&&row.created)session.created=row.created;
    session.rows.push(row);
    if(!session.note&&String(row.exNote||'').trim())session.note=String(row.exNote).trim();
  }
  return [...groups.values()].sort(progressEvidence.compareChronology);
}
