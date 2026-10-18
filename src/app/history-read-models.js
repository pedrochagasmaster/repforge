/** @typedef {import('./history-contracts.js').HistoryRow} HistoryRow
 * @typedef {import('./history-contracts.js').HistorySession} HistorySession
 * @typedef {Omit<HistorySession,"rows"> & {rows:HistoryRow[]}} MutableSession
 * @typedef {import('./history-contracts.js').HistoryRowFacts} HistoryRowFacts
 * @typedef {import('./history-contracts.js').HistoryGrouped} HistoryGrouped
 * @typedef {import('./history-contracts.js').HistoryIndex} HistoryIndex
 * @typedef {import('./history-contracts.js').HistoryBlock} HistoryBlock
 */
import {compareChronology as compareLogChronology} from "../training/progress.js";

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
