import {scalarSessions,previousScalarSessionRows,isStalled,buildSessionDelta,workingRows,derivePersonalRecords,blockReviewRecommendation} from '../training/progress.js';
import {hardMuscleWork} from './progress-read-models.js';
/** @typedef {ReturnType<typeof import('../training/model.js').createProgramModel>} Model
 * @typedef {import('./workout-model.js').WorkoutSnapshot} Snapshot
 * @typedef {ReturnType<typeof import('./workout-model.js').createWorkoutReadModel>} Queries
 */
/** The saved block review joins actual program/History projection authorities.
 * It captures no live state and allocates no identities.
 * @param {{model:Model,queries:Queries}} options */
export function createBlockReview({model,queries}){
 /** @param {Snapshot} snapshot @param {{today:string,now:string,hardRir:number}} operation */
 function build(snapshot,{today,now,hardRir}){
  const meta=snapshot.programMeta||{},program=new model.Program(snapshot.program),days=program.days();
  const total=Number(meta.mesocycleLengthWeeks)||6,started=typeof meta.started==='string'?meta.started:null;
  const query=queries.capture({snapshot,draft:null,currentCycle:1,profileWeightKg:null});
  const log=snapshot.log,plannedSessions=total&&days.length?total*days.length:0;
  const blockRows=log.filter(row=>!started||row.date&&row.date>=started&&row.date<=today);
  const completedSessions=new Set(blockRows.map(row=>row.session)).size,adherenceRatio=plannedSessions?Math.min(completedSessions/plannedSessions,1):0;
  let improvedLifts=0,flatLifts=0,regressedLifts=0,stalledLifts=0;
  for(const ex of program.exercises){const rows=log.filter(query.matchLift(ex)),sessions=scalarSessions(rows),block=started?sessions.filter(session=>String(session.date)>=started&&String(session.date)<=today):sessions;
   const latest=block.at(-1);if(!latest)continue;
   const delta=buildSessionDelta(previousScalarSessionRows(rows,latest.session,log),workingRows(rows.filter(row=>row.session===latest.session)));
   if(delta.status==='improved')improvedLifts++;else if(delta.status==='flat')flatLifts++;else if(delta.status==='regressed')regressedLifts++;
   if(isStalled(sessions))stalledLifts++}
  const prRows=log.map(row=>{const reading=query.readLogRow(row);return {...row,liftKey:query.liftKey(row),load:reading.load,reps:reading.reps,strengthComparable:reading.strengthComparable,strengthConvention:reading.strengthConvention,exerciseName:row.name||''}});
  const prs=derivePersonalRecords(prRows).filter(event=>!started||event.date&&event.date>=started&&event.date<=today).length;
  const planned=program.volume(),completed=hardMuscleWork(log,snapshot.program,{start:started,end:today,hardRir},model);
  let totalPlanned=0,totalCompleted=0;for(const value of planned.values())totalPlanned+=(value.d+value.p)*total;for(const value of completed.values())totalCompleted+=value.d+value.p;
  const volumeCompliance=totalPlanned?Math.min(totalCompleted/totalPlanned,1):0;
  return{programId:meta.id||null,started,ended:today,plannedSessions,completedSessions,adherenceRatio,
   improvedLifts,flatLifts,regressedLifts,stalledLifts,prs,completedHardSetsByMuscle:Object.fromEntries(completed),plannedHardSetsByMuscle:Object.fromEntries(planned),volumeCompliance,
   recommendation:blockReviewRecommendation({adherenceRatio,stalledLifts,flatLifts,regressedLifts,improvedLifts,volumeCompliance}),created:now}}
 return Object.freeze({build})}
