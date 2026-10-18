/** @typedef {import('./history-contracts.js').HistoryRow} HistoryRow
 * @typedef {import('./history-contracts.js').HistorySession} HistorySession
 * @typedef {Omit<HistorySession,"rows"> & {rows:HistoryRow[]}} MutableSession
 * @typedef {import('./history-contracts.js').HistoryRowFacts} HistoryRowFacts
 * @typedef {import('./history-contracts.js').HistoryGrouped} HistoryGrouped
 * @typedef {import('./history-contracts.js').HistoryIndex} HistoryIndex
 * @typedef {import('./history-contracts.js').HistoryBlock} HistoryBlock
 */
import {compareChronology as compareLogChronology,derivePersonalRecords,buildSessionDelta,previousScalarSessionRows,
  compareProjectedSessionOutcome,noComparableSessionOutcome} from "../training/progress.js";
import {exerciseLiftKey,liftKey,loggedMovementName} from './workout-model.js';
import {readRevision} from '../persistence/snapshot.js';
import {presentSessionOutcome} from './progress-read-models.js';

  const DAY_MS=86400000;
  // Whole days since 1970-01-01 for an ISO date, or null. UTC arithmetic keeps
  // a daylight-saving change from moving a session into the neighbouring week.
  /** @param {unknown} iso */
  export function isoDayNumber(iso){
    const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso??""));
    return m?Math.floor(Date.UTC(+m[1],+m[2]-1,+m[3])/DAY_MS):null}
  /** @param {number} n */
  const isoFromDayNumber=n=>new Date(n*DAY_MS).toISOString().slice(0,10);
  // 1970-01-01 was a Thursday, so day number 0 is index 3 of a Monday-first week.
  /** @param {number} n */
  const mondayIndex=n=>(((n+3)%7)+7)%7;

  /** Sessions saved per week of the block and per weekday, for the History counts.
   *  One session counts once; weeks not yet reached carry no count; no intensity,
   *  streak or missed-day field exists. Returns null when no block is running. */
  /** @param {{sessions?:readonly HistorySession[],started?:string|null,weeks?:number,planned?:number,today?:string|null}} [options] */
  export function historyFrequency({sessions=[],started=null,weeks=0,planned=0,today=null}={}){
    const start=isoDayNumber(started),now0=isoDayNumber(today),total=Math.floor(+weeks);
    if(start==null||now0==null||!(total>0)||!(+planned>0))return null;
    // A block that has not started yet reads as week 1, as the lifecycle does.
    const elapsed=Math.max(1,Math.floor((now0-start)/7)+1),now=Math.min(elapsed,total);
    const perWeek=Array.from({length:total},(_,i)=>({week:i+1,count:0,reached:i+1<=now,current:i+1===now}));
    const perDay=Array.from({length:7},(_,i)=>({index:i,count:0}));
    const seen=new Set();
    let done=0;
    for(const s of sessions||[]){
      const d=isoDayNumber(s?.date);if(d==null)continue;
      if(s.session!=null){const id=String(s.session);if(seen.has(id))continue;seen.add(id)}
      const week=Math.floor((d-start)/7)+1;
      if(week<1||week>now)continue;
      perWeek[week-1].count++;perDay[mondayIndex(d)].count++;done++}
    const planNum=+planned;
    return{weeks:perWeek,weekdays:perDay,done,planned:planNum,plannedTotal:planNum*total,now,total,
      weekScale:Math.max(planNum,1,...perWeek.map(w=>w.count)),
      weekdayScale:Math.max(now,1,...perDay.map(d=>d.count))}}

  /** The list's structure: sessions grouped by block, then by week. `blocks` lists
   *  the current block first, then archived ones, each with an ISO start and an
   *  optional end. A session inside a block lands in that block's numbered week;
   *  anything else falls into calendar weeks (Monday first). `done` counts every
   *  session saved that week, so a search narrows the rows but not the tally. */
  /** @param {{sessions?:readonly HistorySession[],shown?:readonly HistorySession[]|null,blocks?:readonly HistoryBlock[]}} [options] */
  export function historyWeekGroups({sessions=[],shown=null,blocks=[]}={}){
    const usable=(blocks||[]).filter(b=>b&&isoDayNumber(b.start)!=null&&+b.planned>0);
    /** @param {unknown} date */
    const place=date=>{
      const d=isoDayNumber(date);if(d==null)return{block:null,key:"w:?",week:null,monday:null};
      for(const block of usable){
        const start=/** @type {number} */(isoDayNumber(block.start)),end=block.end?isoDayNumber(block.end):null;
        if(d>=start&&(end==null||d<=end)){
          const week=Math.floor((d-start)/7)+1;
          return{block,key:`b:${block.key}:${week}`,week,monday:null}}}
      const monday=isoFromDayNumber(d-mondayIndex(d));
      return{block:null,key:`o:${monday}`,week:null,monday}};
    const done=new Map();
    for(const s of sessions||[]){const p=place(s?.date);done.set(p.key,(done.get(p.key)||0)+1)}
    /** @type {{key:string,kind:string,name:string,weeks:{key:string,week:number|null,monday:string|null,done:number,planned:number,sessions:HistorySession[]}[]}[]} */
    const groups=[];
    /** @type {(typeof groups)[number]|null} */let blockGroup=null;
    /** @type {(typeof groups)[number]["weeks"][number]|null} */let weekGroup=null;
    for(const s of shown||sessions||[]){
      const p=place(s?.date),blockKey=p.block?p.block.key:"open";
      if(!blockGroup||blockGroup.key!==blockKey){
        blockGroup={key:blockKey,kind:p.block?p.block.kind:"open",name:p.block?String(p.block.name||""):"",weeks:[]};
        groups.push(blockGroup);weekGroup=null}
      if(!weekGroup||weekGroup.key!==p.key){
        weekGroup={key:p.key,week:p.week,monday:p.monday,done:done.get(p.key)||0,
          planned:p.block?+p.block.planned:0,sessions:[]};
        blockGroup.weeks.push(weekGroup)}
      weekGroup.sessions.push(s)}
    return groups}

/** @param {{rows:readonly HistoryRow[],rowFacts:ReadonlyMap<HistoryRow,HistoryRowFacts>}} input @returns {HistoryGrouped} */
export function groupHistoryRows({rows:source,rowFacts}){
  /** @type {HistoryRow[]} */
  const rows=[];
  const n=source.length;
  for(let i=0;i<n;i++){const raw=source[i];rows.push(raw&&typeof raw==="object"?raw:{})}
  /** @type {Map<string,MutableSession>} */
  const sessionMap=new Map();
  for(const row of rows){
    const sid=row&&row.session!=null?String(row.session):"";
    if(!sessionMap.has(sid))sessionMap.set(sid,{session:row.session,date:row.date,day:row.day,created:row.created,rows:[]});
    const session=mergeLogChronology(/** @type {MutableSession} */(sessionMap.get(sid)),row);
    session.rows.push(row)}
  for(const sess of sessionMap.values()){
    sess.rows.sort((a,b)=>String(/** @type {HistoryRowFacts} */(rowFacts.get(a)).storedName).localeCompare(String(/** @type {HistoryRowFacts} */(rowFacts.get(b)).storedName))||Number(a.set)-Number(b.set))}
  const sessions=[...sessionMap.values()].sort((a,b)=>compareLogChronology(b,a));
  /** @type {Map<string,Map<string|number|undefined,MutableSession>>} */
  const liftChrono=new Map();
  for(const row of rows){
    const reading=/** @type {HistoryRowFacts} */(rowFacts.get(row)).reading;
    if(!!row.warmup||!(Number(reading.load)>0)||!(Number(reading.reps)>0)||reading.strengthComparable===false)continue;
    const k=/** @type {HistoryRowFacts} */(rowFacts.get(row)).liftKey;
    if(!liftChrono.has(k))liftChrono.set(k,new Map());
    const sm=/** @type {Map<string|number|undefined,MutableSession>} */(liftChrono.get(k));
    if(!sm.has(row.session))sm.set(row.session,{session:row.session,date:row.date,created:row.created,rows:[]});
    const session=mergeLogChronology(/** @type {MutableSession} */(sm.get(row.session)),row);
    session.rows.push(row)}
  /** @type {Map<string,HistoryRow[]>} */
  const liftPred=new Map();
  for(const[k,sm]of liftChrono){
    const ordered=[...sm.values()].sort(compareLogChronology);
    for(let i=0;i<ordered.length;i++){
      const cur=ordered[i],pred=i>0?ordered[i-1].rows:[];
      liftPred.set(`${cur.session}|${k}`,pred)}}
  /** @type {import("./history-contracts.js").SessionPair[]} */
  const pairs=[];
  for(const sess of sessions){
    /** @type {Map<string,HistoryRow[]>} */
    const byLift=new Map();
    for(const r of sess.rows){
      const reading=/** @type {HistoryRowFacts} */(rowFacts.get(r)).reading;
      if(!!r.warmup||!(Number(reading.load)>0)||!(Number(reading.reps)>0)||reading.strengthComparable===false)continue;
      const k=/** @type {HistoryRowFacts} */(rowFacts.get(r)).liftKey;if(!byLift.has(k))byLift.set(k,[]);/** @type {HistoryRow[]} */(byLift.get(k)).push(r)}
    for(const[k,liftRows]of byLift){
      const pred=liftPred.get(`${sess.session}|${k}`)||[];
      if(!pred.length){pairs.push({session:sess.session,liftKey:k,first:true});continue}
    const previous=pred.map(row=>/** @type {HistoryRowFacts} */(rowFacts.get(row)).reading);
    const current=liftRows.map(row=>/** @type {HistoryRowFacts} */(rowFacts.get(row)).reading);
    /** @param {import("./history-contracts.js").HistoryReading} reading */
    const convention=reading=>reading.strengthConvention??"load";
    const comparable=[...previous,...current].every(row=>row.strengthComparable!==false&&convention(row)===convention(current[0]||previous[0]));
    if(!comparable)continue;
    pairs.push({session:sess.session,liftKey:k,previous,current});}
  }

  return {rows,sessions,liftPred,pairs};
}

/** Completes a history index from canonical comparison/record facts. No training
 * math, localization callbacks, live stores or IO are reachable here. */
/** @param {HistoryGrouped} grouped @param {{rowFacts:ReadonlyMap<HistoryRow,HistoryRowFacts>,comparisons:ReadonlyMap<string,{status:string}>,prEvents:import("./history-contracts.js").PrEvent[],dayLabels:Readonly<Record<string,string>>}} facts @returns {HistoryIndex} */
export function completeHistoryIndex(grouped,{rowFacts,comparisons,prEvents,dayLabels}){
  const {rows,sessions,liftPred}=grouped;
  const countsBySession=new Map(sessions.map(session=>[session.session,{improved:0,flat:0,regressed:0,new:0}]));
  for(const pair of grouped.pairs){
    const counts=/** @type {import("./history-contracts.js").SessionCounts} */(countsBySession.get(pair.session));
    if(pair.first){counts.new++;continue}
    const status=comparisons.get(`${pair.session}|${pair.liftKey}`)?.status;
    if(/** @type {string} */(status) in counts)counts[/** @type {keyof import("./history-contracts.js").SessionCounts} */(status)]++;
  }
  for(const sess of sessions){
    sess.delta=countsBySession.get(sess.session);
    const names=new Set(sess.rows.map(row=>String(/** @type {HistoryRowFacts} */(rowFacts.get(row)).storedName||"")));
    const aliases=new Set();
    for(const row of sess.rows){const alias=/** @type {HistoryRowFacts} */(rowFacts.get(row)).currentName;if(alias&&!names.has(alias))aliases.add(alias)}
    sess.searchText=`${String(sess.day||"")} ${dayLabels[String(sess.day)]||sess.day} ${[...names,...aliases].join(" ")}`.toLowerCase();
  }
  const prDates=new Set(prEvents.map(ev=>String(ev.date)));
  /** @type {Map<string,import("./history-contracts.js").HistoryMonth>} */
  const months=new Map();
  for(const row of rows){
    const date=String(row.date||""),ym=date.slice(0,7);
    if(!/^\d{4}-\d{2}$/.test(ym))continue;
    if(!months.has(ym))months.set(ym,{sessions:new Set(),sets:0,byDay:new Map()});
    const bucket=/** @type {import("./history-contracts.js").HistoryMonth} */(months.get(ym));bucket.sessions.add(row.session);bucket.sets++;
    const dayNum=+date.slice(8,10);
    if(!bucket.byDay.has(dayNum))bucket.byDay.set(dayNum,{sets:0,pr:false});
    /** @type {{sets:number,pr:boolean}} */(bucket.byDay.get(dayNum)).sets++;
    if(prDates.has(date))/** @type {{sets:number,pr:boolean}} */(bucket.byDay.get(dayNum)).pr=true}
  const tableRows=[...rows].sort((a,b)=>compareLogChronology(b,a)||/** @type {HistoryRowFacts} */(rowFacts.get(a)).storedName.localeCompare(/** @type {HistoryRowFacts} */(rowFacts.get(b)).storedName)||Number(a.set)-Number(b.set));
  return {rows,sessions,months,prEvents,tableRows,liftPred,rowFacts};
}

/** @template {{date?:string,created?:string|null}} T @param {T} target @param {HistoryRow} row @returns {T} */
function mergeLogChronology(target,row){
  if(!target.date&&row?.date)target.date=row.date;
  if(!target.created&&row?.created)target.created=row.created;
  return target;
}
/** @param {import("./history-contracts.js").HistoryIndexView} index @param {unknown} query */
export function searchHistoryIndex(index,query){
  const q=String(query||"").trim().toLowerCase(),sessions=index?.sessions||[];
  if(!q)return sessions.slice();
  return sessions.filter(session=>String(session.searchText||"").includes(q)||
    (session.rows||[]).some(row=>String(/** @type {HistoryRowFacts} */(index.rowFacts.get(row)).name||"").toLowerCase().includes(q)));
}

/** Owns History's immutable capture, canonical workout readings and derived
 * indices. Only the single published snapshot can invalidate these caches;
 * rendering never reads a draft, store or mutable screen context.
 * @param {import('./history-contracts.js').HistoryReadOptions} options
 * @returns {import('./history-contracts.js').HistoryQueries & {diagnostics:import('./history-contracts.js').HistoryReadDiagnostics}} */
export function createHistoryReadModels({read,model,workout,labels,copy}){
  /** @typedef {import('./history-contracts.js').HistoryReadFacts} Facts */
  /** @typedef {ReturnType<ReturnType<typeof import('./workout-model.js').createWorkoutReadModel>['capture']>} WorkoutQueries */
  /** @type {WeakMap<readonly HistoryRow[],{context:Readonly<import('./history-contracts.js').HistoryContext>,index:HistoryIndex}>} */
  const indices=new WeakMap();
  /** @type {WeakMap<HistoryRow,{context:Readonly<import('./history-contracts.js').HistoryContext>,value:HistoryRowFacts}>} */
  const rowFacts=new WeakMap();
  /** @type {{facts:Facts,context:Readonly<import('./history-contracts.js').HistoryContext>,workout:WorkoutQueries,names:ReturnType<import('./history-contracts.js').HistoryReadOptions['labels']['capture']>}|null} */
  let captured=null;
  const diagnostics={enabled:false,builds:0,sourceRowVisits:0,
    /** @type {import('./history-contracts.js').HistoryIndexView|null} */last:null,
    /** @type {((index:import('./history-contracts.js').HistoryIndexView)=>void)|null} */onBuilt:null,
    reset(){this.enabled=true;this.builds=0;this.sourceRowVisits=0;this.last=null;this.onBuilt=null},
    disable(){this.enabled=false;this.last=null;this.onBuilt=null}};
  function capture(){
    const facts=read();
    if(captured&&captured.facts.snapshot===facts.snapshot&&captured.facts.locale===facts.locale&&
      captured.facts.today===facts.today&&captured.facts.language===facts.language&&captured.facts.dayMeta===facts.dayMeta)return captured;
    const snapshot=facts.snapshot,meta=snapshot.programMeta||{};
    const current=model.makeProgram(snapshot.program,model.snapshotLookup(snapshot.customExercises||[]),meta);
    const block=Object.freeze({started:meta.started||null,weeks:Number(meta.mesocycleLengthWeeks)||6,planned:current.days().length,
      today:facts.today,name:meta.name||'',archived:Object.freeze((snapshot.programHistory||[]).map(entry=>Object.freeze({
        name:entry.meta?.name||'',start:entry.meta?.started||null,end:entry.completedAt?String(entry.completedAt).slice(0,10):null,
        planned:new Set((entry.program||[]).map(row=>row.day).filter(Boolean)).size}))) });
    const days=new Set([...snapshot.program.map(row=>row.day),...snapshot.log.map(row=>row.day)]);
    const context=Object.freeze({block,locale:facts.locale,today:facts.today,
      weekdayLetters:Object.freeze([...facts.weekdayLetters]),
      dayLabels:Object.freeze(Object.fromEntries([...days].map(day=>[String(day),copy.dayLabel(day,facts.dayMeta)]))),
      revision:readRevision(snapshot)});
    captured={facts,context,workout:workout.capture({snapshot,draft:null,currentCycle:1,profileWeightKg:null}),
      names:labels.capture({customExercises:snapshot.customExercises||[],language:facts.language})};
    return captured;
  }
  /** @param {HistoryRow} record @param {NonNullable<typeof captured>} frame */
  function rowInFrame(record,frame){
    const cached=rowFacts.get(record);if(cached?.context===frame.context)return cached.value;
    const value=Object.freeze({reading:Object.freeze(frame.workout.readLogRow(record)),name:frame.names.exercise(record),
      storedName:loggedMovementName(record),liftKey:liftKey(record)});
    rowFacts.set(record,{context:frame.context,value});return value;
  }
  /** @param {HistoryRow} record */
  const row=record=>rowInFrame(record,capture());
  /** @param {readonly HistoryRow[]} log @param {NonNullable<typeof captured>} frame */
  function buildCapturedIndex(log,frame){
    const source=(log||[]).map(raw=>raw&&typeof raw==='object'?raw:{});
    const currentNames=new Map();
    for(const exercise of frame.facts.snapshot.program){const key=exerciseLiftKey(exercise),name=String(exercise.name||'').trim();
      if(key&&!key.startsWith('name:')&&name&&!currentNames.has(key))currentNames.set(key,name)}
    const facts=new Map(source.map(record=>[record,{...rowInFrame(record,frame),currentName:record.performedLibraryId||record.performedMovementId?currentNames.get(liftKey(record))||'':''}]));
    const grouped=groupHistoryRows({rows:source,rowFacts:facts});
    const comparisons=new Map(grouped.pairs.filter(pair=>!pair.first).map(pair=>[`${pair.session}|${pair.liftKey}`,buildSessionDelta(pair.previous,pair.current)]));
    const dayLabels=Object.fromEntries([...new Set(source.map(record=>record.day))].map(day=>[String(day),copy.dayLabel(day,frame.facts.dayMeta)]));
    const records=derivePersonalRecords(source.map(record=>{const reading=rowInFrame(record,frame).reading;return{
      liftKey:liftKey(record),date:record.date,created:record.created,session:record.session,blockId:record.blockId??null,
      load:reading.load,reps:reading.reps,rir:record.rir,warmup:record.warmup,strengthComparable:reading.strengthComparable,
      strengthConvention:reading.strengthConvention,exerciseName:loggedMovementName(record),exerciseId:record.exerciseId,
      loadMultiplier:reading.loadMultiplier,perSideLoad:reading.perSideLoad};}));
    const index=completeHistoryIndex(grouped,{rowFacts:facts,comparisons,prEvents:records,dayLabels});
    if(diagnostics.enabled){diagnostics.builds++;diagnostics.sourceRowVisits+=source.length;diagnostics.last=index;diagnostics.onBuilt?.(index)}
    return index;
  }
  /** @param {readonly HistoryRow[]} log */
  const buildIndex=log=>buildCapturedIndex(log,capture());
  /** @param {readonly HistoryRow[]} [source] */
  function index(source){
    const frame=capture(),rows=source||frame.facts.snapshot.log,cached=indices.get(rows);
    if(cached?.context===frame.context)return cached.index;
    const value=buildCapturedIndex(rows,frame);indices.set(rows,{context:frame.context,index:value});return value;
  }
  /** @param {readonly HistoryRow[]} rows */
  function outcome(rows){
    const frame=capture(),source=Array.isArray(rows)?rows:[],first=source[0],key=liftKey(first);
    const exercise=frame.facts.snapshot.program.find(exercise=>exerciseLiftKey(exercise)===key)||{
      libraryId:first?.performedLibraryId,movementId:first?.performedMovementId,name:loggedMovementName(first),id:first?.exerciseId,day:first?.day};
    const current=source.map(record=>rowInFrame(record,frame).reading).filter(record=>!record.warmup&&Number(record.load)>0&&Number(record.reps)>0);
    const absent=()=>presentSessionOutcome(noComparableSessionOutcome(),copy);
    if(!current.length||current.some(record=>record.strengthComparable===false))return absent();
    const conventions=new Set(current.map(record=>record.strengthConvention||'load'));if(conventions.size!==1)return absent();
    const convention=conventions.values().next().value,session=String(current[0].session??'');
    if(current.some(record=>String(record.session??'')!==session))return absent();
    const log=frame.facts.snapshot.log.map(record=>rowInFrame(record,frame).reading).filter(record=>record.strengthComparable!==false&&(record.strengthConvention||'load')===convention);
    const previous=previousScalarSessionRows(log.filter(frame.workout.matchLift(exercise)),session,log);
    return presentSessionOutcome(compareProjectedSessionOutcome(current,previous,convention),copy);
  }
  return Object.freeze({rows:()=>capture().facts.snapshot.log,row,index,buildIndex,search:searchHistoryIndex,
    context:()=>capture().context,outcome,diagnostics});
}
