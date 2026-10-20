import {compareChronology} from './evidence.js';
import {estimateOneRepMax} from '../../metrics.js';
/** Historical scalar statistics. Callers select movement identity before
 * supplying rows; metric-aware outcome comparison remains session-outcome.js.
 * @typedef {import('./contracts.js').HistoryRow} HistoryRow
 * @typedef {{session?:string|number,date?:string,created?:string|null,loads:number[],reps:number[],rirs:number[]}} SessionGroup */
/** @param {number[]} values */
function median(values){if(!values.length)return 0;const sorted=[...values].sort((a,b)=>a-b),middle=sorted.length>>1;return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2}
/** Retain the first supplied chronology; fill only missing date/created.
 * @template {{date?:string,created?:string|null}} T @param {T} target @param {HistoryRow} row */
export function mergeLogChronology(target,row){if(!target.date&&row.date)target.date=row.date;if(!target.created&&row.created)target.created=row.created;return target}
/** @param {HistoryRow[]} rows */
export function scalarSessions(rows){
 /** @type {Map<string|number|undefined,SessionGroup>} */const groups=new Map();
 for(const row of rows){if(!(Number(row.load)>0)||row.warmup)continue;
  let group=groups.get(row.session);if(!group){group={session:row.session,date:row.date,created:row.created,loads:[],reps:[],rirs:[]};groups.set(row.session,group)}
  mergeLogChronology(group,row);group.loads.push(Number(row.load));group.reps.push(Number(row.reps));group.rirs.push(Number(row.rir))}
 return [...groups.values()].map(group=>({session:group.session,date:group.date,created:group.created,reps:group.reps,
  med:median(group.loads),top:Math.max(...group.loads),minReps:Math.min(...group.reps),maxReps:Math.max(...group.reps),medReps:median(group.reps),
  avgRir:group.rirs.reduce((total,value)=>total+Number(value||0),0)/group.rirs.length,
  bestE1rm:Math.max(...group.loads.map((load,index)=>estimateOneRepMax(load,group.reps[index])))})).sort(compareChronology)}
/** Missing current movement rows still use the complete log's chronology.
 * @template {HistoryRow} T @param {T[]} rows @param {string|number|undefined} beforeSessionId @param {HistoryRow[]} [allRows] @returns {T[]} */
export function previousScalarSessionRows(rows,beforeSessionId,allRows=rows){
 /** @type {Map<string|number|undefined,{session?:string|number,date?:string,created?:string|null,rows:T[]}>} */const groups=new Map();
 for(const row of rows){if(!(Number(row.load)>0&&Number(row.reps)>0)||row.warmup)continue;
  let group=groups.get(row.session);if(!group){group={session:row.session,date:row.date,created:row.created,rows:[]};groups.set(row.session,group)}
  mergeLogChronology(group,row).rows.push(row)}
 const ordered=[...groups.values()].sort(compareChronology),index=ordered.findIndex(group=>group.session===beforeSessionId);
 if(index<0){const current=allRows.find(row=>row.session===beforeSessionId);if(!current)return ordered.at(-1)?.rows||[];
  return ordered.filter(group=>compareChronology(group,current)<0).at(-1)?.rows||[]}
 return index>0?ordered[index-1].rows:[]}
/** @param {{med:number,maxReps:number}[]} sessions */
export function isStalled(sessions){if(sessions.length<3)return false;const recent=sessions.slice(-3),load=recent[0].med,reps=recent[0].maxReps;return recent.every(session=>Math.abs(session.med-load)<0.01)&&recent.every(session=>session.maxReps<=reps)}
/** @param {{overrunWeeks:number,isComplete:boolean,current:number|null,total:number}} life */
export function blockCompletionBucket(life){if(life.overrunWeeks>0)return 'extended';if(life.isComplete||(life.current!=null&&life.current>=life.total))return 'complete';return life.current!=null&&life.current>=Math.ceil(life.total/2)?'partial':'early'}
/** @param {{hasHistory:boolean,status:string}[]} exercises */
export function programProgressionHealth(exercises){const withHistory=exercises.filter(ex=>ex.hasHistory);if(!withHistory.length)return null;const hot=withHistory.filter(ex=>ex.status==='add'||ex.status==='add2').length;return{hot,total:withHistory.length,ratio:hot/withHistory.length}}
/** @param {Iterable<{d:number,p:number}>} planned @param {Iterable<{d:number,p:number}>} completed */
export function programVolumeCompliance(planned,completed){let plannedTotal=0,completedTotal=0;for(const value of planned)plannedTotal+=value.d+value.p;if(!plannedTotal)return null;for(const value of completed)completedTotal+=value.d+value.p;return{planned:plannedTotal,completed:completedTotal,ratio:Math.min(completedTotal/plannedTotal,1)}}
/** @param {boolean} hasLog @param {number} adherence @param {number|null|undefined} health */
export function programStatusKey(hasLog,adherence,health){if(!hasLog)return 'status.getting_started';if(adherence>=1&&(health??0)>=.4)return 'status.on_track';return adherence>=.5?'status.partial_week':'status.rebuilding'}
/** @param {{adherenceRatio:number,stalledLifts:number,flatLifts:number,regressedLifts:number,improvedLifts:number,volumeCompliance:number}} facts */
export function blockReviewRecommendation({adherenceRatio,stalledLifts,flatLifts,regressedLifts,improvedLifts,volumeCompliance}){
 const improvedHigh=improvedLifts>=3||(improvedLifts>0&&improvedLifts>=flatLifts+regressedLifts),fatigueHigh=regressedLifts+flatLifts>=4||regressedLifts>=2;
 if(adherenceRatio<.5)return 'repeat_with_simpler_schedule';
 if(stalledLifts>=3&&fatigueHigh)return 'reduce_volume_or_deload';
 if(improvedHigh&&adherenceRatio>=.8)return 'repeat_or_progress';
 return volumeCompliance<.6?'keep_program_improve_completion':'repeat_with_small_swaps'}
