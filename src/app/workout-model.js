import metrics,{estimateOneRepMax as e1rm} from '../training/metrics.js';
import {compiler} from '../training/generation.js';
import {progression,compareChronology} from '../training/progress.js';
import {isPlainStateObject} from '../training/model.js';
import {copySnapshot} from './session.js';
/** @typedef {ReturnType<typeof import('../training/model.js').createProgramModel>} Model
 * @typedef {NonNullable<ReturnType<Model['canonicalProgramDefinition']>>} ProgramDefinition
 * @typedef {ProgramDefinition['days'][number]['slots'][number]} Slot
 * @typedef {import('../training/metrics.js').MetricDefinition} MetricDefinition
 * @typedef {Extract<ReturnType<ReturnType<typeof import('../training/workout.js').createWorkoutRules>['parse']>,{kind:'valid'}>['draft']} Draft
 * @typedef {{metricId:string,value:number,unit:string}} MetricValue
 * @typedef {{executionMode?:string,externalLoadMultiplier?:number|null,bodyweightCoefficient?:number|null,bodyweightContributionEnabled?:boolean|null,loadingConvention?:string,bodyweightKg?:number|null}} LoadingContext
 * @typedef {Record<string,unknown> & {id?:string,name?:string,performedName?:string,performedLibraryId?:string,performedMovementId?:string,sourceLibraryId?:string,exerciseId?:string,slotId?:string,load?:number|string|null,reps?:number|string|null,rir?:number|string|null,warmup?:boolean,metricDefinitions?:MetricDefinition[],metricIds?:string[],metricValues?:MetricValue[],metricType?:string,setIndex?:number,set?:number,loadingContext?:LoadingContext,loadingConvention?:string,equipmentId?:string|null,date?:string,created?:string|null,session?:string|number,sessionKey?:string,bodyweight?:number|string|null}} LogRow
 * @typedef {{id:string,name:string,namePt?:string,archived?:boolean,primary?:string,secondary?:string,notes?:string,equipment?:string[],metricIds?:string[],metricDefinitions?:MetricDefinition[]}} LibraryEntry
 * @typedef {Pick<Exercise,"id"|"name"|"libraryId"|"movementId"|"displayName">} ExerciseIdentity
 * @typedef {{id:string,name:string,sets:number,min:number,max:number,day:string,libraryId?:string,movementId?:string,slotId?:string,displayName?:string|null,progression?:Record<string,unknown> & {strategy?:{id?:string}},progressionType?:string,progressionIncompatibility?:unknown}} Exercise
 * @typedef {{exercises:{id:string,name:string,bodyweight?:number,laterality?:string[]}[],uuidIndex:Record<string,{id:string,name:string,type:string}>}} Catalog
 * @typedef {{log:LogRow[],program:Exercise[],customExercises?:LibraryEntry[],programMeta?:{id?:string,started?:string,mesocycleLengthWeeks?:number,programDefinition?:ProgramDefinition,loadingConfiguration?:{byExerciseId?:Record<string,{loadStepKg?:number}>}},settings:{unit?:string,minJump?:number,weightMatch?:boolean,expandRepRange?:boolean}}} WorkoutSnapshot
 */
  /** @param {unknown} value */
export const movementToken=value=>String(value??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
  /** @param {unknown} id */
export const movementIdKey=id=>String(id||'').startsWith('library:')?String(id):`movement:${id}`;
  /** @param {LogRow} row */
export const loggedMovementName=row=>String(row?.performedName||row?.name||'');
  /** @param {LogRow} row */
export const liftKey=row=>row?.performedLibraryId?`library:${row.performedLibraryId}`:row?.performedMovementId?movementIdKey(row.performedMovementId):`name:${movementToken(loggedMovementName(row))}`;
  /** @param {ExerciseIdentity} ex */
export const exerciseLiftKey=ex=>ex?.libraryId?`library:${ex.libraryId}`:ex?.movementId?movementIdKey(ex.movementId):`name:${movementToken(ex?.name)}`;


/** One immutable operation/render capture. No storage, UI hydration or mutable
 * application reads. The canonical engine remains authoritative.
 * Immutable catalog/library indices have the same verified catalog lifetime.
 * @param {{catalog:Catalog,librarySource:{library:LibraryEntry[]},model:Model}} options */
export function createWorkoutReadModel({catalog,librarySource,model}){
  const byId=new Map(librarySource.library.map(entry=>[entry.id,entry]));
  const rawById=new Map(catalog.exercises.map(entry=>[entry.id,entry]));
  /** @param {unknown} id */
  const rawExercise=id=>rawById.get(String(id))||null;
  /** @param {string} id */
  const rawCatalogObject=id=>catalog.uuidIndex[id]||null;
  /** @param {{snapshot:WorkoutSnapshot,draft:Draft|null,currentCycle:number,profileWeightKg:number|null}} facts */
  function capture({snapshot,draft,currentCycle,profileWeightKg}){
  /** @param {unknown} id */
  const libraryEntry=id=>String(id||'').startsWith('custom:')?(snapshot.customExercises||[]).find(entry=>entry.id===id)||null:byId.get(String(id))||null;
  /** @param {LogRow} row */
  const isWork=row=>!row.warmup;

  /** @type {Readonly<Record<string,number>>} */
  const EFFORT_RIR={easy:3,hard:1,max:0};
  const PER_SIDE_LOAD_SEMANTICS=new Set(['loadPerSideKg','persistentLoadPerSideKg']);
  /** @param {number} kg */
  const toDisplay=kg=>snapshot.settings.unit==='lb'?(Number(kg)||0)*2.2046226218:Number(kg)||0;
  /** @type {Map<string,string|null>|null} */
  let substitutionNames=null;
  /** Legacy name-only swaps resolve only an unambiguous offered movement.
   * @param {string} name @param {string|null|undefined} libraryId */
  function substitutionEntry(name,libraryId){
    const direct=libraryId?libraryEntry(String(libraryId).trim()):null;
    if(direct)return direct;
    if(!substitutionNames){
      substitutionNames=new Map();
      const offered=[...(snapshot.customExercises||[]).filter(entry=>!entry.archived),...librarySource.library];
      for(const entry of offered)for(const label of [entry.name,entry.namePt]){
        const key=movementToken(label);if(!key)continue;
        if(!substitutionNames.has(key))substitutionNames.set(key,entry.id);
        else if(substitutionNames.get(key)!==entry.id)substitutionNames.set(key,null)}}
    const id=substitutionNames.get(movementToken(name));return id?libraryEntry(id):null}
  /** @param {Exercise} ex */
  function sessionExercise(ex){
    if(!ex)return ex;
    const replacement=draft?.exercises[ex.id]?.substitution?.replacement;
    const name=String(replacement?.displayName||'').trim().slice(0,80);
    if(!replacement||!name)return ex;
    const entry=substitutionEntry(name,replacement.libraryId);
    if(!entry)return {...ex,name,libraryId:undefined,movementId:`adhoc:${movementToken(name)}`};
    return {...ex,...model.exerciseFieldsFromLibrary(entry),name,libraryId:entry.id}}
/** @param {LogRow} row @param {string} semantic */
function metricValue(row,semantic){
  if(!Array.isArray(row?.metricDefinitions)||!Array.isArray(row?.metricIds)||!Array.isArray(row?.metricValues))return null;
  const {metricDefinitions,metricIds,metricValues}=row;
  const index=metricDefinitions.findIndex((metric,i)=>metric?.semantic===semantic&&metric.id===metricIds[i]&&
    metricValues[i]?.metricId===metric.id&&typeof metricValues[i]?.value==='number'&&Number.isFinite(metricValues[i].value));
  return index<0?null:metricValues[index].value}
/** @param {LogRow} row @param {string|null} [sideLoadSemantic] @param {number|null|undefined} [explicitMultiplier] @param {boolean} [totalLoadWithSideReps] */
function executionModeForLogRow(row,sideLoadSemantic=null,explicitMultiplier=null,totalLoadWithSideReps=false){
  // A non-persistent per-side load's captured multiplier is its execution
  // convention: one means one side at a time; two means both sides together.
  // Persistent loads still use m=2 in either mode, so their reps need the
  // catalog/slot mode below. Total Weight is already total, so m=1 does not
  // identify the execution mode for per-side reps.
  if(sideLoadSemantic==="loadPerSideKg"&&(explicitMultiplier===1||explicitMultiplier===2))
    return explicitMultiplier===1?"unilateral":"bilateral";
  const sourceId=String(row?.performedLibraryId||row?.sourceLibraryId||"");
  const laterality=(rawExercise(sourceId)?.laterality||[]).map(id=>rawCatalogObject(id)?.name).filter(Boolean);
  if(laterality.length===1&&laterality[0]==="Unilateral")return"unilateral";
  if(laterality.length===1&&laterality[0]==="Bilateral")return"bilateral";
  // An ambiguous movement's row may carry the mode the lifter chose when it
  // was logged (#382). Rows without it stay as they were saved.
  const captured=row?.loadingContext?.executionMode;
  if(captured==="bilateral"||captured==="unilateral")return captured;
  // Total-load m=1 is its load-composition multiplier, not a captured
  // execution convention. With ambiguous catalog laterality, don't substitute
  // the current slot's mode for the historical movement.
  if(totalLoadWithSideReps&&explicitMultiplier===1)return null;
  // For a persistent per-side load, m=2 records how much weight is held per
  // side, not whether both sides moved together. An ambiguous historical row
  // with that explicit value cannot borrow the current slot's execution mode.
  if(sideLoadSemantic==="persistentLoadPerSideKg"&&explicitMultiplier===2)return null;
  // Bodyweight-only side reps record m=0 because there is no external load.
  // That value likewise says nothing about whether the movement was performed
  // one side at a time; an ambiguous historical row cannot borrow today's mode.
  if(row?.loadingConvention==="bodyweight"&&explicitMultiplier===0&&
    row?.metricIds?.length===1&&row?.metricDefinitions?.some(metric=>metric?.semantic==="repsPerSide"))return null;
  // A movement swapped in mid-session (#410) is not the one the slot's mode
  // describes. The row records both names, so it never borrows that mode.
  if(row?.performedName!=null&&movementToken(row.performedName)!==movementToken(row.name))return null;
  const slotId=String(row?.slotId||row?.exerciseId||"");
  const slot=(snapshot.programMeta?.programDefinition?.days||[]).flatMap(day=>day?.slots||[]).find(item=>item?.id===slotId);
  // Nor does a movement the editor has since replaced in the slot (#413,
  // owner narrowing of D7): the slot's mode describes what it holds now.
  if(!slot||!rowPerformedSlotMovement(row,slot))return null;
  return slot.executionMode==="bilateral"||slot.executionMode==="unilateral"?slot.executionMode:null}
/** @param {LogRow} row @param {Slot} slot */
function rowPerformedSlotMovement(row,slot){
  if(row?.performedLibraryId)return String(row.performedLibraryId)===String(slot.exerciseId||"");
  const current=(snapshot.program||[]).find(ex=>(ex?.slotId||ex?.id)===slot.id);
  if(row?.performedMovementId)return!!current?.movementId&&movementIdKey(row.performedMovementId)===movementIdKey(current.movementId);
  return movementToken(loggedMovementName(row))===movementToken(current?.name)}
/** Read-time workout projection shared by History, Progress, exercise charts and CSV.
 *  It never mutates the saved row; null per-side context stays unknown instead
 *  of becoming an assumed multiplier. */
/** @param {LogRow|null|undefined} row */
function readLogRow(row){
  const source=row&&typeof row==="object"?row:{};
  const sideLoadMetric=source.metricDefinitions?.find(metric=>PER_SIDE_LOAD_SEMANTICS.has(metric?.semantic));
  const totalLoadMetric=source.metricDefinitions?.find(metric=>metric?.semantic==="loadKg");
  const repsSideMetric=source.metricDefinitions?.find(metric=>metric?.semantic==="repsPerSide");
  const repsMetric=source.metricDefinitions?.find(metric=>metric?.semantic==="reps");
  const metricLoad=sideLoadMetric?metricValue(source,sideLoadMetric.semantic):totalLoadMetric?metricValue(source,"loadKg"):null;
  const metricReps=repsSideMetric?metricValue(source,"repsPerSide"):repsMetric?metricValue(source,"reps"):null;
  /** @param {unknown} value */
  const numeric=value=>value!=null&&value!==""&&Number.isFinite(Number(value))?Number(value):null;
  const totalLoad=totalLoadMetric?metricLoad:sideLoadMetric?null:numeric(source.load);
  const totalReps=repsSideMetric?null:repsMetric?metricReps:numeric(source.reps);
  const sideLoad=sideLoadMetric?metricLoad:null,sideReps=repsSideMetric?metricReps:null;
  const load=sideLoadMetric?sideLoad:totalLoad,reps=repsSideMetric?sideReps:totalReps;
  const perSideLoad=!!sideLoadMetric&&sideLoad!=null,perSideReps=!!repsSideMetric&&sideReps!=null;
  const explicitMultiplier=source.loadingContext?.externalLoadMultiplier;
  const mode=perSideReps||sideLoadMetric
    ?executionModeForLogRow(source,sideLoadMetric?.semantic,explicitMultiplier,!!(totalLoadMetric&&perSideReps)):null;
  let multiplier=null;
  if(sideLoadMetric){
    if(explicitMultiplier===1||explicitMultiplier===2)multiplier=explicitMultiplier;
    else if(explicitMultiplier==null&&sideLoadMetric.semantic==="persistentLoadPerSideKg")multiplier=2;
    else if(explicitMultiplier==null&&mode==="bilateral")multiplier=2;
    else if(explicitMultiplier==null&&mode==="unilateral")multiplier=1;
  }else if(totalLoadMetric&&perSideReps)multiplier=1;
  else if(load!=null)multiplier=1;
  const repetitionsPerformed=perSideReps
    ?mode?Number(reps)*(mode==="unilateral"?2:1):null:reps;
  const convention=sideLoadMetric?multiplier==null?"per-side:unknown":`per-side:m${multiplier}`
    :perSideReps?`total-load:${mode||"unknown"}`:"load";
  const strengthComparable=Number(load)>0&&Number(reps)>0&&(!sideLoadMetric||multiplier!=null)&&(!perSideReps||mode!=null);
  const tonnage=Number(load)>0&&Number(repetitionsPerformed)>0&&(!sideLoadMetric||multiplier!=null)
    ?Number(load)*Number(sideLoadMetric?multiplier:1)*Number(repetitionsPerformed):null;
  return{...source,load,reps,totalLoad,totalReps,loadPerSide:sideLoad, repsPerSide:sideReps,
    perSideLoad,perSideReps,executionMode:mode,loadMultiplier:multiplier,repetitionsPerformed,tonnage,
    strengthComparable,strengthConvention:convention,e1rm:strengthComparable?e1rm(Number(load),Number(reps)):null}}

/** @param {MetricDefinition[]} metricDefinitions @param {{bodyweight?:number}|null|undefined} sourceExercise @param {{bodyweightCoefficient?:number|null,assistanceDirection?:string|null}|null} [loadingModel] */
function metricLoading(metricDefinitions,sourceExercise,loadingModel=null){
  loadingModel=loadingModel||{
    bodyweightCoefficient:typeof sourceExercise?.bodyweight==='number'&&Number.isFinite(sourceExercise.bodyweight)?sourceExercise.bodyweight:null,
    assistanceDirection:"subtract"};
  const semantics=new Set((metricDefinitions||[]).map(metric=>metric.semantic));
  const loadingConvention=semantics.has("assistanceKg")?"assistance":
    semantics.has("loadPerSideKg")||semantics.has("persistentLoadPerSideKg")?"per_side":
      metricDefinitions?.length===1&&(semantics.has("reps")||semantics.has("repsPerSide"))?"bodyweight":"external";
  const loadingContext={bodyweightContributionEnabled:null,
    externalLoadMultiplier:loadingConvention==="per_side"?null:loadingConvention==="bodyweight"?0:1,
    ...(Object.prototype.hasOwnProperty.call(loadingModel,"bodyweightCoefficient")
      ?{bodyweightCoefficient:loadingModel.bodyweightCoefficient}:{})};
  return{loadingModel,loadingConvention,loadingContext}}
/** @param {string|undefined} exerciseId */
function catalogExecutionMode(exerciseId){
  const source=rawExercise(exerciseId),laterality=(source?.laterality||[])
    .map(id=>rawCatalogObject(id)?.name).filter(name=>typeof name==="string");
  const unilateral=laterality.includes("Unilateral"),bilateral=laterality.includes("Bilateral");
  return unilateral!==bilateral?(unilateral?"unilateral":"bilateral"):null}
/** @param {Slot|null|undefined} slot */
function executionModeForSlot(slot){
  const catalogMode=catalogExecutionMode(slot?.exerciseId);
  if(catalogMode)return catalogMode;
  return slot?.executionMode==="bilateral"||slot?.executionMode==="unilateral"?slot.executionMode:null}

/** @param {Slot} slot */
function slotLoadingProjection(slot){
  const{loadingConvention}=metricLoading(slot?.metricDefinitions||[],rawExercise(slot?.exerciseId),slot?.loadingModel);
  const semantics=new Set((slot?.metricDefinitions||[]).map(metric=>metric.semantic));
  const executionMode=executionModeForSlot(slot);
  /** @type {number|null} */
  let externalLoadMultiplier=1;
  if(semantics.has("persistentLoadPerSideKg"))externalLoadMultiplier=2;
  else if(semantics.has("loadPerSideKg"))
    externalLoadMultiplier=executionMode==="bilateral"?2:executionMode==="unilateral"?1:null;
  else if(loadingConvention==="bodyweight")externalLoadMultiplier=0;
  return{loadingConvention,executionMode,externalLoadMultiplier}}

/** @param {ExerciseIdentity} ex */
function exerciseNameTokens(ex){
  const names=new Set([ex?.name,ex?.displayName].map(movementToken).filter(Boolean));
  const entry=ex?.libraryId?libraryEntry(ex.libraryId):null;
  for(const label of [entry?.name,entry?.namePt]){const key=movementToken(label);if(key)names.add(key)}
  return names}
/** @param {ExerciseIdentity} ex */
function matchLift(ex){const movementId=ex?.movementId?String(ex.movementId):"",
  key=exerciseLiftKey(ex),names=exerciseNameTokens(ex);
  /** @param {LogRow} row */
  return row=>{
    const rowLibraryId=row?.performedLibraryId?String(row.performedLibraryId):"";
    const rowMovementId=row?.performedMovementId?String(row.performedMovementId):"";
    if(rowLibraryId||rowMovementId)return liftKey(row)===key;
    if(movementId&&ex?.id&&row?.exerciseId===ex.id)return true;
    return names.has(movementToken(loggedMovementName(row)))}}
/** @param {Exercise} ex */
function last(ex){const match=matchLift(ex);
  const hits=snapshot.log.filter(x=>match(x)&&isWork(x));if(!hits.length)return[];
  const sid=[...hits].sort((a,b)=>compareChronology(b,a))[0].session;
  return hits.filter(x=>x.session===sid).sort((a,b)=>Number(a.set)-Number(b.set))}

/** @param {Exercise} ex @param {ProgramDefinition|null|undefined} [definition] */
function canonicalPrescriptionSlot(ex,definition=snapshot.programMeta?.programDefinition){
  if(!definition||!Array.isArray(definition.days))return null;
  const id=String(ex?.slotId||ex?.id||"");
  for(const day of definition.days)for(const slot of day.slots||[])if(slot.id===id)return{day,slot};
  return null}
/** @param {LogRow} row @param {string} exerciseId @param {string[]} metricIds */
function enginePerformedRow(row,exerciseId,metricIds){
  const performedId=String(row?.performedLibraryId||row?.performedMovementId||"");
  if(performedId!==exerciseId||row?.metricType!=="source_metrics@1"||
    !Array.isArray(row.metricIds)||JSON.stringify(row.metricIds)!==JSON.stringify(metricIds)||
    !Array.isArray(row.metricValues)||typeof row.setIndex!=='number'||!Number.isInteger(row.setIndex)||row.setIndex<0)return null;
  const values=metrics?.validateMetricValues?.(metricIds,row.metricValues);
  if(!values?.ok)return null;
  const rir=typeof row.rir==="number"&&Number.isFinite(row.rir)&&row.rir>=0?row.rir:null;
  return{exerciseId,completed:true,setIndex:row.setIndex,rir,equipmentId:row.equipmentId??null,
    loadingConvention:row.loadingConvention,metricIds:[...row.metricIds],metricValues:copySnapshot(row.metricValues),
    loadingContext:isPlainStateObject(row.loadingContext)?copySnapshot(row.loadingContext):null}}
/** @param {string} exerciseId @param {string[]} metricIds @param {ReturnType<typeof slotLoadingProjection>} slotProjection @param {MetricDefinition[]} metricDefinitions */
function progressionHistoryFor(exerciseId,metricIds,slotProjection,metricDefinitions){
  /** @type {Map<string,{sessionId:string,date?:string,created?:string|null,completed:boolean,sets:NonNullable<ReturnType<typeof enginePerformedRow>>[]}>} */
  const grouped=new Map();
  const requiresExecutionMode=(metricDefinitions||[]).some(metric=>
    ["repsPerSide","loadPerSideKg","persistentLoadPerSideKg"].includes(metric.semantic));
  for(const row of snapshot.log||[]){
    const performed=enginePerformedRow(row,exerciseId,metricIds);if(!performed)continue;
    if(requiresExecutionMode){
      const projection=readLogRow(row),mode=slotProjection?.executionMode;
      if(!mode||!projection.executionMode||projection.executionMode!==mode)continue}
    const sessionId=String(row.session||"");if(!sessionId)continue;
    if(!grouped.has(sessionId))grouped.set(sessionId,{sessionId,date:row.date,created:row.created,completed:true,sets:[]});
    grouped.get(sessionId)?.sets.push(performed)}
  return[...grouped.values()].sort(compareChronology).map(session=>({
    sessionId:session.sessionId,completed:true,sets:session.sets.sort((a,b)=>Number(a.setIndex)-Number(b.setIndex))}))}
/** @param {ReturnType<typeof compiler.prescriptionsForCycle>[number]} prescription */
function progressionCurrentSession(prescription){
  if(!draft?.exercises)return[];
  const exercise=draft.exercises[prescription.slotId]||
    Object.values(draft.exercises).find(item=>item.libraryId===prescription.exerciseId||item.sourceExerciseId===prescription.exerciseId);
  if(!exercise||exercise.status==="skipped")return[];
  const sets=[];
  for(const setId of exercise.setOrder||[]){
    const set=exercise.sets?.[setId];if(!set||set.completion==="pending"||set.role==="warmup")continue;
    const values=[];let valid=true;
    for(const metric of set.programmed?.metrics||[]){
      const parsed=metrics?.parseMetricValue?.(metric,set.edited?.metrics?.[metric.id]);
      if(!parsed?.ok){valid=false;break}
      values.push({metricId:metric.id,value:parsed.value,unit:metric.unit})}
    if(!valid||JSON.stringify(values.map(value=>value.metricId))!==JSON.stringify(prescription.metricIds))continue;
    const rawRir=set.edited?.rir??set.programmed?.targetRir;
    const rir=draft.program?.rirMode==="effort"?EFFORT_RIR[String(set.edited?.effort)]
      :rawRir==null?null:Number(rawRir);
    const loadingContext=copySnapshot(exercise.programmed?.loadingContext||{});
    loadingContext.loadingConvention=exercise.programmed?.loadingConvention||loadingContext.loadingConvention;
    loadingContext.bodyweightKg=draft.session?.bodyweight==null||draft.session.bodyweight===""?null:Number(draft.session.bodyweight);
    if(typeof loadingContext.bodyweightContributionEnabled!=="boolean")
      loadingContext.bodyweightContributionEnabled=(loadingContext.bodyweightCoefficient??0)>0&&Number(loadingContext.bodyweightKg)>0;
    sets.push({exerciseId:prescription.exerciseId,completed:true,setIndex:set.ordinal-1,
      rir:Number.isFinite(rir)&&Number(rir)>=0?rir:null,equipmentId:exercise.programmed?.equipmentId??null,
      loadingConvention:exercise.programmed?.loadingConvention,metricIds:[...prescription.metricIds],metricValues:values,
      loadingContext})}
  return sets}
/* The lifter's smallest load change for a movement owns its candidate loads:
   set per exercise in the program editor, else the global minimum jump. */
/** @param {string} exerciseId */
function loadStepKg(exerciseId){
  const own=Number(snapshot.programMeta?.loadingConfiguration?.byExerciseId?.[exerciseId]?.loadStepKg);
  if(Number.isFinite(own)&&own>0)return own;
  const global=+Number(snapshot.settings.minJump);return Number.isFinite(global)&&global>0?global:2.5}
/** @param {number} step */
function loadGridKg(step){
  const loads=[];
  for(let k=1;k<=2000&&k*step<=1000+1e-9;k++)loads.push(Math.round(k*step*1000)/1000);
  return loads}
function sessionBodyweightKg(){
  const live=draft?.session?.bodyweight;
  if(live!=null&&live!==""&&+live>0)return+live;
  const rows=(snapshot.log||[]).filter(row=>Number(row.bodyweight)>0);
  // Until a session logs one, the weight given in setup counts (Plan 072).
  const profileWeight=profileWeightKg;
  if(!rows.length)return Number(profileWeight)>0?profileWeight:null;
  return Number(rows.reduce((latest,row)=>compareChronology(latest,row)<0?row:latest).bodyweight)}
/* Keep the engine's current loading context on the program slot boundary.
   The numeric multiplier is also copied into each new log row by workoutProgramContext. */
/** @param {Slot} slot */
function slotLoadingContext(slot){
  const projection=slotLoadingProjection(slot),{loadingConvention,executionMode,externalLoadMultiplier}=projection;
  const coefficient=Number(slot.loadingModel?.bodyweightCoefficient)||0,bodyweight=sessionBodyweightKg();
  return{equipmentId:null,availableLoadsKg:loadGridKg(loadStepKg(slot.exerciseId)),loadingConvention,
    bodyweightContributionEnabled:coefficient>0&&Number(bodyweight)>0,bodyweightKg:bodyweight||null,
    executionMode,externalLoadMultiplier}}
/** @param {Exercise} ex */
function recommendation(ex){
  const engine=progression;
  const definition=snapshot.programMeta?.programDefinition,matched=canonicalPrescriptionSlot(ex,definition);
  if(!compiler?.prescriptionsForCycle||!engine?.recommendSets||!matched||!definition)
    return{status:"manual",engineStatus:"manual",reason:"canonical_program_definition_required",load:null,targetSets:[]};
  const cycleCount=Number.isInteger(definition.cycles)&&definition.cycles>0?definition.cycles:1;
  const elapsed=currentCycle||1,cycleNumber=Math.min(cycleCount,Math.max(1,elapsed));
  const prescriptions=compiler.prescriptionsForCycle(definition,cycleNumber).filter(item=>item.slotId===matched.slot.id);
  if(!prescriptions.length)return{status:"manual",engineStatus:"manual",reason:"cycle_prescription_unavailable",load:null,targetSets:[]};
  const first=prescriptions[0],slotProjection=slotLoadingProjection(matched.slot);
  const history=progressionHistoryFor(first.exerciseId,first.metricIds,slotProjection,matched.slot.metricDefinitions);
  const currentSession=progressionCurrentSession(first);
  const loadingContext={bySlotId:{[matched.slot.id]:slotLoadingContext(matched.slot)}};
  const results=engine.recommendSets(prescriptions,history,currentSession,loadingContext,{
    weightMatch:snapshot.settings.weightMatch===true,expandRepRange:snapshot.settings.expandRepRange!==false});
  const targetSets=prescriptions.map((prescription,index)=>{
    const result=results[index]||null;
    return{prescription,result,targets:result?.status==="recommended"?result.targets:prescription.targets,
      rir:prescription.rir,status:result?.status||"manual"}});
  const firstActual=targetSets.find(item=>item.prescription.setIndex===1)||targetSets[0];
  const result=firstActual?.result,definitions=matched.slot.metricDefinitions||[];
  const requiresExecutionMode=definitions.some(metric=>
    ["repsPerSide","loadPerSideKg","persistentLoadPerSideKg"].includes(metric.semantic));
  const missingExecutionMode=matched.slot.metricOrigin==="source_catalog"&&requiresExecutionMode&&
    !slotProjection.executionMode;
  const reasonCodes=result?.status==="configuration_required"&&missingExecutionMode&&
    result.reasonCodes?.includes("configuration_required")
    ?["execution_context_required",...(result.reasonCodes||[])]:result?.reasonCodes||[];
  const repMetric=definitions.find(metric=>metric.semantic==="reps"||metric.semantic==="repsPerSide");
  const loadMetric=definitions.find(metric=>["loadKg","assistanceKg","loadPerSideKg","persistentLoadPerSideKg"].includes(metric.semantic));
  const authored=firstActual?.prescription.targets||{};
  const repTarget=repMetric?authored[repMetric.semantic]:null,repValue=repMetric?firstActual?.targets?.[repMetric.semantic]:null;
  const manual=result?.status!=="recommended";
  const newLift=reasonCodes.includes("no_comparable_history")&&!reasonCodes.includes("configuration_required");
  const load=result?.status==="recommended"&&loadMetric?result.targets?.[loadMetric.semantic]??null:null;
  // The verdict is the engine's own move: the first set's load against the load
  // of the set it is anchored on. Every surface (cue, Why, Today, attention)
  // reads this one direction.
  const anchorLoad=result?.historyAnchor?.displayLoadKg;
  const direction=manual||load==null||!Number.isFinite(anchorLoad)?"hold"
    :load>Number(anchorLoad)+1e-9?"add":load<Number(anchorLoad)-1e-9?"reduce":"hold";
  const status=manual?(result?.status==="configuration_required"?"configuration_required":newLift?"new":"manual"):direction;
  return{status,engineStatus:result?.status||"manual",
    reason:reasonCodes[0]||"manual_prescription",reasonCodes,
    label:"",labelKey:manual?null:status==="add"?"rec.add.label":status==="reduce"?"rec.reduce.label":"rec.hold.label",text:"",load,
    lastLoad:Number.isFinite(anchorLoad)?anchorLoad:null,
    reps:typeof repValue==="number"?repValue:repValue?.min??(typeof repTarget==="number"?repTarget:repTarget?.min??null),
    targetSets,engineResults:results,metricDefinitions:definitions,slotId:matched.slot.id,
    stalled:false,block:{dir:null,sessions:0},blockNote:"",pushReps:false,
    prescription:copySnapshot(first),historyAnchor:result?.historyAnchor||null,fatigue:result?.fatigue||null,
    loadingAssumptions:result?.loadingAssumptions||null};
}

/** @param {Exercise} ex @param {number} n @param {ReturnType<typeof recommendation>} rec */
function engineSetSuggestion(ex,n,rec){
  const item=rec.targetSets.find(entry=>entry.prescription?.setIndex===n)||rec.targetSets[n-1];
  if(!item||item.status!=="recommended")return{load:null,reps:null,src:"manual"};
  const definitions=("metricDefinitions" in rec?rec.metricDefinitions:[])||[];
  const loadMetric=definitions.find(metric=>["loadKg","assistanceKg","loadPerSideKg","persistentLoadPerSideKg"].includes(metric.semantic));
  const repsMetric=definitions.find(metric=>["reps","repsPerSide"].includes(metric.semantic));
  const load=loadMetric?item.result?.targets?.[loadMetric.semantic]??null:null;
  const rawReps=repsMetric?item.result?.targets?.[repsMetric.semantic]:null;
  const reps=rawReps??null;
  const exercise=draft?.exercises[ex.id];
  let previous=null;
  for(let k=n-1;k>=1;k--){
    const set=exercise?.setOrder.map(id=>exercise.sets[id]).find(item=>item.ordinal===k);
    if(!set||set.completion==='pending')continue;
    const definitions=set.programmed.metrics||[];
    const metric=definitions.find(item=>['loadKg','assistanceKg','loadPerSideKg','persistentLoadPerSideKg'].includes(item.semantic));
    // Metric-backed slots never read a stale flat edited.load projection.
    const raw=definitions.length?(metric?set.edited.metrics?.[metric.id]:null):set.edited.load;
    previous=raw==null?null:Number(raw);
    break}
  if(!(Number(previous)>0)||load==null)return{load,reps,src:"base"};
  // Compare the same two-decimal display values in the captured unit.
  const shown=Math.round(toDisplay(load)*100)/100,before=Number(toDisplay(Number(previous)).toFixed(2));
  const src=shown>before?"session-up":shown<before?"session-down":"session-hold";
  return{load,reps,src,drop:false}}

/** @param {Exercise} ex */
function canonicalSlotFacts(ex){
  const definition=snapshot.programMeta?.programDefinition,matched=canonicalPrescriptionSlot(ex,definition);
  if(!matched||!definition)return null;
  const cycles=Number.isInteger(definition.cycles)&&definition.cycles>0?definition.cycles:1;
  const index=Math.min(cycles,Math.max(1,currentCycle||1));
  const cycle=matched.slot.prescriptionsByCycle?.find(item=>item.cycleIndex===index)||matched.slot.prescriptionsByCycle?.[0];
  const sets=cycle?.sets||[],rirs=sets.map(set=>set.rir).filter((/** @type {number|null} */ value)=>typeof value==='number'&&Number.isFinite(value));
  return{adaptive:sets.some(set=>set.status==='ready'),rirMin:rirs.length?Math.min(...rirs.map(Number)):null,rirMax:rirs.length?Math.max(...rirs.map(Number)):null}}
/** Values only; metric labels, units and pluralization belong to presentation.
 * @param {Exercise} ex @param {number} [cycleNumber] */
function prescriptionFacts(ex,cycleNumber=currentCycle){
  const slot=canonicalPrescriptionSlot(ex)?.slot;
  const cycle=slot?.prescriptionsByCycle?.find(item=>item.cycleIndex===cycleNumber)||slot?.prescriptionsByCycle?.[0];
  const set=cycle?.sets?.[0];
  return{sets:ex.sets,metrics:(slot?.metricDefinitions||[]).map(metric=>({metric,target:set?.targets?.[metric.semantic]}))}}
const LEGACY_PROGRESSION_ALIASES=Object.freeze({double_progression:'range'});
/** Compatibility projection only; recommendation always uses the canonical
 * ProgramDefinition. @param {Exercise} ex */
function progressionForExercise(ex){
  if(ex?.progressionIncompatibility)return{schemaVersion:1,modifiers:[],strategy:{id:'manual',version:1,params:{unsupportedImport:'incompatible_prescription'}}};
  if(ex?.progression)return copySnapshot(ex.progression);
  const legacy=typeof ex?.progressionType==='string'?ex.progressionType.trim():'';
  if(legacy&&!Object.prototype.hasOwnProperty.call(LEGACY_PROGRESSION_ALIASES,legacy))
    return{schemaVersion:1,modifiers:[],strategy:{id:'manual',version:1,params:{unsupportedImport:legacy}}};
  return{schemaVersion:1,modifiers:[],strategy:{id:'range',version:1,params:{workingSets:Number(ex?.sets)||1,repMin:Number(ex?.min),repMax:Number(ex?.max)}}}}
/** Every recommendation, including refusals, carries canonical targetSets.
 * Scalar capacity targets belonged to the retired engine and are not a second
 * recommendation path. @param {Exercise} ex @param {number} n @param {ReturnType<typeof recommendation>} rec */
function setSuggestion(ex,n,rec){
  if(rec.status==='manual')return{load:null,reps:null,src:'manual'};
  return engineSetSuggestion(ex,n,rec)}
return Object.freeze({sessionExercise,readLogRow,readLogRows:(rows=snapshot.log)=>rows.map(readLogRow),matchLift,last,recommendation,setSuggestion,progressionForExercise,canonicalSlotFacts,prescriptionFacts,currentCycle,canonicalPrescriptionSlot,slotLoadingProjection,progressionCurrentSession,progressionHistoryFor,slotLoadingContext,metricLoading,catalogExecutionMode,executionModeForSlot,liftKey,exerciseLiftKey,movementToken,loggedMovementName});
}
  return Object.freeze({capture});
}
/** @typedef {ReturnType<ReturnType<typeof createWorkoutReadModel>['capture']>} WorkoutCapture
 * @typedef {ReturnType<WorkoutCapture['recommendation']>} WorkoutRecommendation */
