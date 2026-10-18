import { compareChronology, OUTCOMES } from './evidence.js';
/** Read-only facts captured by the application projection. Strength and tonnage
 * use the History projection; muscle credit retains the saved scalar values.
 * These differ deliberately for per-side metric rows.
 * @typedef {import('./contracts.js').EvidenceRecord} EvidenceRecord
 * @typedef {{load:number,reps:number,rir:number,primary:string[],secondary:string[]}} MuscleFacts
 * @typedef {{liftKey:string,name:string,load:number,reps:number,e1rm:number,tonnage:number|null,warmup:boolean,strengthComparable:boolean,strengthConvention:string|null,set:number,date?:string,created?:string|null,session?:string|number,sessionKey?:string,id?:string,muscle:MuscleFacts}} SummaryRow
 * @typedef {{kind:'load'|'reps'|'e1rm',load:number,reps:number,delta:number}} LiftPR
 * @typedef {LiftPR & {name:string,liftKey:string}} SessionPR
 * @typedef {{exerciseId:string,name:string,next:{glyph:string,line:string}|null}} CurrentLift
 * @typedef {{evidence:EvidenceRecord[],lifts:Record<string,CurrentLift>}} OutcomeContext
 */
/** @param {number} a @param {number} b */
const sameLoad=(a,b)=>Math.abs(a-b)<=1e-6;
/** The first observation establishes a baseline, never a record over nothing.
 * @param {SummaryRow[]} mine @param {SummaryRow[]} past @returns {LiftPR|null} */
export function liftPR(mine,past){
  if(!mine.length||!past.length)return null;
  const bestLoad=Math.max(...past.map(x=>x.load));
  const bestReps=Math.max(0,...past.filter(x=>sameLoad(x.load,bestLoad)).map(x=>x.reps));
  const bestE=Math.max(...past.map(x=>x.e1rm));
  const top=Math.max(...mine.map(x=>x.load));
  if(top>bestLoad&&!sameLoad(top,bestLoad)){
    const row=mine.filter(x=>sameLoad(x.load,top)).sort((a,b)=>b.reps-a.reps)[0];
    return{kind:'load',load:top,reps:row.reps,delta:top-bestLoad}}
  if(sameLoad(top,bestLoad)){
    const reps=Math.max(...mine.filter(x=>sameLoad(x.load,top)).map(x=>x.reps));
    if(reps>bestReps)return{kind:'reps',load:top,reps,delta:reps-bestReps}}
  const best=mine.reduce((a,b)=>b.e1rm>a.e1rm?b:a);
  if(best.e1rm>bestE)return{kind:'e1rm',load:best.load,reps:best.reps,delta:best.e1rm-bestE};
  return null}
/** @param {SummaryRow[]} rows */
const workingRows=rows=>rows.filter(row=>!row.warmup&&row.load>0&&row.reps>0);
/** @param {SummaryRow[]} rows @param {SummaryRow[]} prevLog @returns {SessionPR[]} */
export function sessionPRs(rows,prevLog){
  /** @param {SummaryRow[]} log */
  const comparable=log=>workingRows(log).filter(row=>row.strengthComparable);
  /** @param {SummaryRow} row */
  const key=row=>`${row.liftKey}\u0000${row.strengthConvention||'load'}`;
  /** @type {Map<string,SummaryRow[]>} */
  const past=new Map(),mineBy=new Map();
  for(const x of comparable(prevLog)){const k=key(x),group=past.get(k)||[];past.set(k,group);group.push(x)}
  for(const r of comparable(rows)){const k=key(r),group=mineBy.get(k)||[];mineBy.set(k,group);group.push(r)}
  /** @type {SessionPR[]} */
  const out=[];
  for(const[k,mine]of mineBy){const pr=liftPR(mine,past.get(k)||[]);
    if(pr)out.push({...pr,name:mine[0].name,liftKey:mine[0].liftKey})}
  const rank={load:0,reps:1,e1rm:2};
  return out.sort((a,b)=>rank[a.kind]-rank[b.kind]||b.delta-a.delta||a.name.localeCompare(b.name))}
/** @param {SummaryRow[]} rows @param {number} hardRir */
export function sessionMuscleWork(rows,hardRir){
  /** @type {Map<string,{d:number,p:number}>} */
  const m=new Map();
  /** @param {string} key @param {number} direct @param {number} partial */
  const add=(key,direct,partial)=>{const v=m.get(key)||{d:0,p:0};m.set(key,v);v.d+=direct;v.p+=partial};
  for(const x of rows){const raw=x.muscle;
    if(x.warmup||!(raw.load>0&&raw.reps>0&&raw.rir<=hardRir))continue;
    for(const p of raw.primary)add(p,1,0);
    for(const s of raw.secondary)add(s,0,.5)}
  return[...m].map(([name,v])=>({name,sets:v.d+v.p,direct:v.d})).filter(x=>x.sets>0)
    .sort((a,b)=>b.sets-a.sets||b.direct-a.direct||a.name.localeCompare(b.name))}
/** Outcomes are authoritative evidence, never a second progression heuristic.
 * @param {SummaryRow[]} rows @param {OutcomeContext} context @param {SessionPR[]} [prs] */
export function sessionOutcomeGroups(rows,{evidence:records,lifts},prs=[]){
  const work=workingRows(rows),completedLiftIds=new Set(work.map(row=>row.liftKey));
  const namesByLift=new Map(work.map(row=>[row.liftKey,row.name]));
  const evidence=records.filter(record=>completedLiftIds.has(record.exerciseId)).map(record=>{
    const sufficient=record.evidenceState==='sufficient'&&!!record.outcome&&OUTCOMES.includes(record.outcome);
    const baseline=!sufficient&&record.evidenceState==='insufficient'&&record.evidenceCount===1&&record.reason==='single-observation';
    return{exerciseId:record.exerciseId,name:namesByLift.get(record.exerciseId)||lifts[record.exerciseId]?.name||record.exerciseId,
      kind:sufficient?'outcome':baseline?'baseline':'insufficient',evidenceState:record.evidenceState,
      evidenceCount:record.evidenceCount,reason:record.reason??null,...(sufficient?{outcome:record.outcome}:{})}});
  const showBaseline=evidence.length>0&&evidence.every(item=>item.kind==='baseline');
  /** @type {Map<string,{liftKey:string,name:string,rows:SummaryRow[]}>} */
  const byLift=new Map();
  for(const row of work){const key=row.liftKey,group=byLift.get(key)||{liftKey:key,name:row.name,rows:[]};byLift.set(key,group);group.rows.push(row)}
  const liftGroups=[...byLift.values()].map(group=>{
    const item=evidence.find(entry=>entry.exerciseId===group.liftKey),slot=lifts[group.liftKey];
    const latest=group.rows.reduce((a,b)=>compareChronology(a,b)<=0?b:a);
    return{liftKey:group.liftKey,exerciseId:slot?.exerciseId??null,name:group.name,session:latest.session??null,
      sets:[...group.rows].sort((a,b)=>a.set-b.set).map(row=>({load:row.load,reps:row.reps})),
      state:item?.kind==='outcome'?{kind:'outcome',outcome:item.outcome}:item?.kind==='baseline'?{kind:'baseline'}:{kind:'insufficient',reason:item?.reason??null},
      pr:prs.find(entry=>entry.liftKey===group.liftKey)||null,next:slot?.next||null}});
  return{evidence,showBaseline,liftGroups}}
/** @typedef {{session:string|number,date:string,day:string,startedAt:number|null,rows:SummaryRow[],previousRows:SummaryRow[]}} CompletionFacts */
/** @typedef {OutcomeContext & {now:number,hardRir:number,week:{completedDays:number,plannedDays:number},meso:{current:number,total:number,isComplete:boolean},next:{day:string,exercises:number}|null}} SummaryContext */
/** @param {CompletionFacts} completion @param {SummaryContext} context */
export function buildSessionSummary({rows,previousRows,session,date,day,startedAt},context){
  const prs=sessionPRs(rows,previousRows),{evidence,showBaseline,liftGroups}=sessionOutcomeGroups(rows,context,prs);
  const outcomes=evidence.filter(item=>item.kind==='outcome').map(({exerciseId,outcome,name})=>({exerciseId,outcome,name}));
  const mins=startedAt?Math.round((context.now-startedAt)/60000):0;
  return{session,date,day,sets:rows.length,volume:rows.filter(row=>!row.warmup&&Number.isFinite(row.tonnage)).reduce((sum,row)=>sum+Number(row.tonnage),0),
    lifts:new Set(workingRows(rows).map(row=>row.liftKey)).size,minutes:mins>=1&&mins<=480?mins:null,
    prs,liftGroups,outcomes,evidence,showBaseline,muscles:sessionMuscleWork(rows,context.hardRir),
    week:{done:context.week.completedDays,planned:context.week.plannedDays},meso:{...context.meso},next:context.next}}
