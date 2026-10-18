import {compareProjectedSessionOutcome as compareSessions,evidence as progressEvidence} from "../training/progress.js";
/** Scope/point selection belongs to training. This application projection joins
 * those points with logged conventions and the authoritative session outcome.
 * No storage, browser, clock or presentation formatting is reachable here. */
/** @param {import("./progress-contracts.js").ProgressFacts} facts */
export function buildStrengthEvidenceRecords({scope,meta,rows,program,recordKeys}){
  const Model=progressEvidence;
  const programKeys=new Set(program.map(ex=>ex.key));
  // Preserve the source producer's key selection until a deliberate evidence-policy correction.
  const keys=new Set([...programKeys,...recordKeys]);
  /** @type {Readonly<Record<string,string>>} */
  const outcomeByStatus={improved:"improved",flat:"maintained",regressed:"declined"};
  /** @type {import("./progress-contracts.js").EvidenceRecord[]} */const records=[];
  const hasEffort=/** @param {import("./progress-contracts.js").StrengthRow} row */ row=>row?.rir!=null&&Number.isFinite(Number(row.rir));
  for(const key of keys){
    const series=Model.buildStrengthEvidence(scope,key,rows,meta);
    if(!programKeys.has(key)&&series.evidenceCount===0)continue;
    // The model owns scope and chronological point selection. The producer
    // then asks the authoritative paired-exposure comparison for the final
    // outcome; a count alone can never produce a sufficient record.
    const convention=series.comparisonConvention??"load";
    const pointRows=new Map(series.points.map(point=>[point.sessionKey,
      rows.filter(row=>row.exerciseId===key&&row.sessionKey===point.sessionKey&&row.strengthComparable!==false&&
        (row.strengthConvention??"load")===(convention??"load"))]));
    const latestPoint=series.points.at(-1),previousPoint=series.points.at(-2);
    const latestRows=latestPoint?pointRows.get(latestPoint.sessionKey)||[]:[];
    const previousRows=previousPoint?pointRows.get(previousPoint.sessionKey)||[]:[];
    /** @type {"insufficient"|"sufficient"} */let evidenceState="insufficient";
    /** @type {string|null} */let reason=series.reason||"untested";
    let outcome;
    if(series.evidenceCount>=2){
      const comparableEffort=[...previousRows,...latestRows].every(hasEffort);
      if(!comparableEffort)reason="missing-effort";
      else{
        const delta=compareSessions(latestRows,previousRows,convention);
        outcome=outcomeByStatus[delta.status];
        if(outcome){evidenceState="sufficient";reason=null}
        else reason=delta.status==="changed_load"?"changed-load":"incompatible-exposure";
      }
    }else if(series.evidenceCount===1){
      reason=latestRows.some(row=>!hasEffort(row))?"missing-effort":"single-observation";
    }
    /** @type {import("./progress-contracts.js").EvidenceRecord} */const record={exerciseId:key,scope:series.scope,evidenceState,
      evidenceCount:series.evidenceCount,reason};
    if(outcome)record.outcome=outcome;
    records.push(record)}
  return Model.normalizeEvidenceRecords(records)}

/** @param {import("./progress-contracts.js").ProjectionFacts} facts */
export function buildStrengthProjection({scope,meta,records,rows,program,prEvents}){
  const Model=progressEvidence,keys=new Set(program.map(ex=>ex.key)),dashboard=[];
  for(const row of rows)keys.add(row.exerciseId);
  /** @type {Map<string,import("./progress-contracts.js").StrengthSeries>} */
  const series=new Map();
  for(const key of keys){
    const base=Model.buildStrengthEvidence(scope,key,rows,{...meta,evidenceRecords:records});
    if(!program.some(ex=>ex.key===key)&&base.evidenceCount===0)continue;
    const pointKeys=new Set(base.points.map(point=>point.sessionKey));
    const convention=base.comparisonConvention??"load";
    const liftRows=rows.filter(row=>row.exerciseId===key&&pointKeys.has(row.sessionKey)&&row.strengthComparable!==false&&
      (row.strengthConvention??"load")===(convention??"load"));
    const current={...base,perSideLoad:liftRows.length>0&&liftRows.every(row=>row.perSideLoad===true),
      perSideReps:liftRows.length>0&&liftRows.every(row=>row.perSideReps===true)};
    const liftSessions=current.points.map(point=>{
      const source=liftRows.filter(row=>row.sessionKey===point.sessionKey);
      const topRow=source.slice().sort((a,b)=>b.load-a.load||b.reps-a.reps)[0]||point;
      const top=Number(topRow.load),topReps=Number(topRow.reps),volume=source.reduce((n,row)=>n+(typeof row.tonnage==="number"&&Number.isFinite(row.tonnage)?row.tonnage:0),0);
      return{session:point.session,date:point.date,day:source[0]?.day||"",liftKey:key,
        name:source[0]?.name||program.find(ex=>ex.key===key)?.name||key,top,topReps,reps:source.reduce((n,row)=>n+row.reps,0),
        rir:average(source.map(row=>row.rir).filter(isFiniteNumber)),sets:source.length,volume,
        perSideReps:source.length>0&&source.every(row=>row.perSideReps===true),
        e1rm:Math.max(...source.map(row=>row.e1rm)),sessionKey:point.sessionKey};
    });
    const latest=liftSessions.at(-1);
    if(latest){
      const first=liftSessions[0],best=Math.max(...liftSessions.map(session=>session.e1rm));
      const scopedPrs=prEvents.filter(event=>event.liftKey===key&&
        pointKeys.has(strengthSessionKey(event)));
      const rec=program.find(ex=>ex.key===key)||{signal:"—"};
      // Dashboard facts stay numeric. Composition decorates the retained read-only hook.
      dashboard.push({key,exercise:latest.name,latestLoad:latest.top,latestReps:latest.topReps,
        best,blockDelta:latest.e1rm-first.e1rm,
        prs:scopedPrs.length,lastTrained:latest.date,signal:rec.signal});
    }
    series.set(key,current)}
  const sessions=[...series].flatMap(([key,current])=>{
    const pointKeys=new Set(current.points.map(point=>point.sessionKey));
    const convention=current.comparisonConvention??"load";
    const matching=rows.filter(row=>row.exerciseId===key&&pointKeys.has(row.sessionKey)&&row.strengthComparable!==false&&
      (row.strengthConvention??"load")===(convention??"load"));
    return current.points.map(point=>{
      const source=matching.filter(row=>row.sessionKey===point.sessionKey);
      const top=source.slice().sort((a,b)=>b.load-a.load||b.reps-a.reps)[0]||point;
      return{session:point.session,date:point.date,day:source[0]?.day||"",liftKey:key,
        name:source[0]?.name||program.find(ex=>ex.key===key)?.name||key,top:top.load,topReps:top.reps,
        reps:source.reduce((n,row)=>n+row.reps,0),rir:average(source.map(row=>row.rir).filter(isFiniteNumber)),sets:source.length,
        volume:source.reduce((n,row)=>n+(typeof row.tonnage==="number"&&Number.isFinite(row.tonnage)?row.tonnage:0),0),
        perSideLoad:source.length>0&&source.every(row=>row.perSideLoad===true),
        perSideReps:source.length>0&&source.every(row=>row.perSideReps===true),
        e1rm:Math.max(...source.map(row=>row.e1rm)),sessionKey:point.sessionKey};
    });
  });
  return{keys:new Set(series.keys()),dashboard,sessions,records,series}}
/** @param {{session?:string|number,date?:string,blockId?:string|null}} row */
export function strengthSessionKey(row){return`${String(row?.session??row?.date)}\u0000${String(row?.blockId??"")}`}
/** @param {number[]} values */
function average(values){return values.length?values.reduce((sum,value)=>sum+Number(value||0),0)/values.length:0}

/** @param {number|null} value @returns {value is number} */
function isFiniteNumber(value){return typeof value==="number"&&Number.isFinite(value)}

/** Copy is applied after the single pure outcome policy has finished.
 * @param {import('../training/progress/internal/session-outcome.js').SessionOutcome} outcome
 * @param {{t:(key:string)=>string}} copy
 */
export function presentSessionOutcome(outcome,copy){return{status:outcome.status,label:copy.t(`delta.${outcome.status}.label`),text:copy.t(`delta.${outcome.status}.text`),metrics:outcome.metrics}}

/** A Progress reader must identify exactly one point inside the requested
 * scope and logged convention. The previous point comes from the same native
 * evidence series; a supplied current session cannot choose its own baseline.
 * @param {import('./progress-contracts.js').ProgressComparisonFacts} facts
 * @param {{t:(key:string)=>string}} copy
 */
export function compareProgressStrengthSession({key,currentRows,reader,meta},copy){
 const absent=()=>presentSessionOutcome({status:'not_comparable',metrics:null},copy);
 const {scope,convention,session,rows}=reader||{};
 if(typeof scope!=='string'||!progressEvidence.EVIDENCE_SCOPES.includes(scope)||typeof convention!=='string'||!convention||!session||!Array.isArray(rows)||!Array.isArray(currentRows)||!currentRows.length)return absent();
 if(!currentRows.some(row=>row.key===key&&String(row.session??'')===String(session)))return absent();
 const series=progressEvidence.buildStrengthEvidence(scope,key,rows,meta);
 if(series.comparisonConvention!==convention)return absent();
 const matches=series.points.map((point,index)=>({point,index})).filter(({point})=>String(point.session)===String(session));
 if(matches.length!==1)return absent();
 const {point,index}=matches[0];
 if(index===0)return presentSessionOutcome({status:'new',metrics:null},copy);
 const previousPoint=series.points[index-1];
 /** @param {{sessionKey:string}} selected */
 const forPoint=selected=>rows.filter(row=>row.exerciseId===key&&row.sessionKey===selected.sessionKey&&row.strengthComparable!==false&&(row.strengthConvention||'load')===convention);
 return presentSessionOutcome(compareSessions(forPoint(point),forPoint(previousPoint),convention),copy);
}
