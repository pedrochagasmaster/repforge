import ExerciseMetrics from "../../metrics.js";
/** @typedef {import("./editor-contracts.js").ProgramDefinition} ProgramDefinition */
/** @typedef {import("./editor-contracts.js").ProgramSlot} ProgramSlot */
/** @typedef {import("./editor-contracts.js").ProgramSet} ProgramSet */
/** @typedef {import("./editor-contracts.js").EditorRow} EditorRow */
/** @typedef {import("./editor-contracts.js").EditorMeta} EditorMeta */
/** @typedef {import("./editor-contracts.js").EditorDocument} EditorDocument */
/** @typedef {import("./editor-contracts.js").EditorSnapshot} EditorSnapshot */
/** @typedef {import("./editor-contracts.js").InstalledIntent} InstalledIntent */
/** @typedef {import("./editor-contracts.js").EditorToken} EditorToken */
/** @typedef {import("./editor-contracts.js").EditorDraft} EditorDraft */
/** @typedef {import("./editor-contracts.js").EditorDraftSet} EditorDraftSet */
/** @typedef {import("./editor-contracts.js").MetricDefinition} MetricDefinition */
import { cloneSnapshot,canonicalize,isPlainStateObject } from "../../model/internal/values.js";
import { progression } from "../../progress.js";
import suggestion from "./suggestion.js";
import {createEditorDocumentRules} from "./editor-document.js";
/** Pure document edits/rebase; host captures the identity and metadata policy.
 * @param {{model:ReturnType<typeof import('../../model.js').createProgramModel>,catalog:import('../../generation/internal/compiler-contracts.js').SourceCatalog,nextId:()=>string,defaultProgramMeta:(log:unknown[])=>EditorMeta,allowCreateDefinition?:boolean,recoveryRecord?:import('../../model/internal/contracts.js').RecoveryRecord|null}} options */
export function createInstalledEditorRules({model,catalog,nextId,defaultProgramMeta,allowCreateDefinition=false,recoveryRecord=null}) {
const {makeProgram,snapshotLookup,rawMetricDefinitions,manualAttributionFor,manualProgramDefinitionFromRows,canonicalProgramDefinition,isCustomLibraryId}=model;
/** @param {EditorDocument} proposal @param {InstanceType<ReturnType<typeof import("../../model.js").createProgramModel>["Program"]>} program @param {EditorRow[]|null} [previousProgram] @param {EditorMeta|null} [previousMeta] */
const syncProgramStructureFromProgram=(proposal,program,previousProgram=null,previousMeta=null)=>model.syncProgramStructureFromProgram(proposal,program,previousProgram,previousMeta,{recoveryRecord});
/** @param {unknown} id */
const rawExercise=id=>catalog?.exercises?.find(item=>item.id===String(id??""))||null;
/** @param {unknown} id */
const rawCatalogObject=id=>catalog?.uuidIndex?.[String(id??"")]||null;
const documentRules=createEditorDocumentRules({nextId});
const uid=()=>{if(typeof nextId!=="function")throw new TypeError("nextId required to author prescription identity");return nextId();};
const editorSuggestLoadsPolicy=Object.freeze({
  /** @param {ProgramSlot|null|undefined} slot */
  eligibility(slot){
    if(!slot||slot.metricOrigin!=="source_catalog"||isCustomLibraryId(slot.exerciseId)||!rawExercise(slot.exerciseId))return"custom";
    const semantics=JSON.stringify((slot.metricDefinitions||[]).map(metric=>metric.semantic));
    const supported=Object.values(progression.SUPPORTED_SEMANTICS||{})
      .some(candidate=>JSON.stringify(candidate)===semantics);
    return supported?"eligible":"unsupported"},
  /** @param {ProgramSlot|null|undefined} slot */
  executionModeQuestion(slot){
    return(slot?.metricDefinitions||[]).some(metric=>["repsPerSide","loadPerSideKg","persistentLoadPerSideKg"].includes(metric.semantic))&&
      !catalogExecutionMode(slot?.exerciseId)}});
/** @param {EditorSnapshot|null|undefined} snapshot @returns {EditorDocument} */
function editorDocumentFromSnapshot(snapshot){
  return{program:cloneSnapshot(snapshot?.program||[]),programMeta:cloneSnapshot(snapshot?.programMeta||{}),
    customExercises:cloneSnapshot(snapshot?.customExercises||[])}
}
/** @param {EditorDocument} document @param {EditorSnapshot} base */
function editorSnapshotFromDocument(document,base){
  const proposal={...cloneSnapshot(base),
    program:cloneSnapshot(document?.program||[]),
    programMeta:{...(cloneSnapshot(base?.programMeta||defaultProgramMeta(base?.log||[]))),...(cloneSnapshot(document?.programMeta||{}))},
    customExercises:cloneSnapshot(document?.customExercises||base?.customExercises||[])};
  const model=makeProgram(proposal.program,snapshotLookup(proposal.customExercises),proposal.programMeta);
  // The ProgramDefinition owns prescriptions; the editor's per-row copy is
  // working state. Persist the row shape boot reads back, or the durable
  // program fingerprint never matches the live one again (#344).
  proposal.program=model.toJSON();
  syncProgramStructureFromProgram(proposal,model,base?.program,base?.programMeta);
  return proposal}
/** @param {EditorToken|null|undefined} a @param {EditorToken|null|undefined} b */
function editorTokenEqual(a,b){return Number(a?.revision)===Number(b?.revision)&&a?.programId===b?.programId&&
  a?.blockId===b?.blockId&&a?.fingerprint===b?.fingerprint}
/** @param {Partial<EditorDocument>|null|undefined} document */
function editorDocumentDays(document){
  /** @type {string[]} */
  const labels=[];
  for(const entry of document?.programMeta?.programStructure?.days||[]){
    const label=String(entry?.label||entry?.dayId||"");if(label&&!labels.includes(label))labels.push(label)}
  for(const exercise of document?.program||[]){const label=String(exercise?.day||"");if(label&&!labels.includes(label))labels.push(label)}
  return labels}
/** @param {Partial<EditorDocument>|null|undefined} document @param {string} day */
function editorDocumentExercises(document,day){
  return(document?.program||[]).filter(exercise=>exercise?.day===day)
    .sort((a,b)=>(Number(a?.order)||0)-(Number(b?.order)||0)||String(a?.id||"").localeCompare(String(b?.id||"")))}
/** @param {EditorDraft|null|undefined} draft */
function editorDraftExerciseIds(draft){
  if(draft?.schemaVersion===2)return new Set((draft.exerciseOrder||[]).filter(id=>{
    const exercise=draft.exercises?.[id];
    return exercise&&(exercise.status==="skipped"||exercise.substitution||exercise.setOrder.some(setId=>{
      const set=exercise.sets[setId];
      return set&&(set.completion!=="pending"||set.role==="warmup"||draftSetTouched(set))}) )}));
  const ids=new Set(/** @type {string[]} */([])),addKey=(/** @type {unknown} */ key)=>{
    const id=setKeyExerciseId(key);if(id&&id!==String(key))ids.add(id)};
  for(const key of ["__done","__touched","__warm"]){if(Array.isArray(draft?.[key]))draft[key].forEach(addKey)}
  for(const key of Object.keys(draft||{}))if(/_load$/.test(key))addKey(key.slice(0,-5));
  for(const id of [...(draft?.__skipped||[]),...Object.keys(draft?.__substituted||{})])if(id)ids.add(String(id));
  return ids}
/** @param {EditorRow|undefined} exercise @param {keyof import("../../model/internal/contracts.js").ExerciseInput} field */
function editorIntentValue(exercise,field){
  return exercise?.[field]}
/** @param {EditorDocument} document @param {InstalledIntent} edit @param {{check?:boolean}} [options] */
function applyInstalledEditorIntent(document,edit,{check=true}={}){
  const kind=edit?.kind;
  if(kind==="program_name"){
    const current=document.programMeta?.name||"";
    if(check&&edit.before!==undefined&&current!==edit.before&&current!==edit.after)return{conflict:true};
    document.programMeta={...(document.programMeta||{}),name:String(edit.after??"")};return{ok:true}}
  if(kind==="day_name"){
    const old=String(edit.before||edit.targetDay||""),next=String(edit.after||"");
    const model=makeProgram(document.program,snapshotLookup(document.customExercises),document.programMeta);
    const current=!!model.days().includes(old);
    if(check&&!current)return{conflict:true};
    if(!model.renameDay(old,next))return{conflict:true};
    document.program=model.toJSON();syncProgramStructureFromProgram(document,model);
    return syncEditorCanonicalIntent(document,document,edit)?{ok:true}:{conflict:true}}
  if(kind==="day_add"){
    const day=String(edit.after||edit.targetDay||"").trim();
    if(!day)return{conflict:true};
    if(check&&editorDocumentDays(document).includes(day))return{conflict:true};
    const structure=(document.programMeta?.programStructure?.days||[]).slice();
    structure.push({dayId:`manual_d${structure.length+1}`,label:day,order:structure.length+1});
    document.programMeta={...(document.programMeta||{}),programStructure:{...(document.programMeta?.programStructure||{}),days:structure}};
    return syncEditorCanonicalIntent(document,document,edit)?{ok:true}:{conflict:true};
  }
  if(kind==="slot_alternates")
    return syncEditorCanonicalIntent(document,document,edit)?{ok:true}:{conflict:true,code:"invalid_canonical_alternates"};
  if(kind==="metric_target"||kind==="metric_composition"||kind==="prescription_field"||
    kind==="prescription"&&edit.field==="sets"){
    return syncEditorCanonicalIntent(document,document,edit,{cycleIndex:Number(edit.cycleIndex)||1})
      ?{ok:true}:{conflict:true,code:"invalid_canonical_prescription"}}
  if(kind==="exercise_field"||kind==="prescription"){
    const exercise=document.program?.find(item=>item.id===edit.targetId);
    if(!exercise)return{conflict:true};
    const current=editorIntentValue(exercise,edit.field);
    if(check&&edit.before!==undefined&&!changeValueEqualForEditor(current,edit.before)&&!changeValueEqualForEditor(current,edit.after))return{conflict:true};
    /** @type {Record<string,unknown>} */(exercise)[edit.field]=cloneSnapshot(edit.after);
    if(edit.field==="name"&&exercise.libraryId){
      if(String(edit.after||"").trim())exercise.displayName=String(edit.after).trim();
      else delete exercise.displayName;
    }
    if(edit.field==="min"&&Number(exercise.max)<Number(exercise.min))exercise.max=exercise.min;
    if(edit.field==="max"&&Number(exercise.min)>Number(exercise.max))exercise.min=exercise.max;
    if(document.programMeta?.programDefinition&&!syncEditorCanonicalIntent(document,document,edit))
      return{conflict:true,code:"invalid_canonical_exercise_field"};
    return{ok:true}}
  if(kind==="exercise_move"){
    const exercise=document.program?.find(item=>item.id===edit.targetId);if(!exercise)return{conflict:true};
    if(check&&exercise.day!==edit.sourceDay)return{conflict:true};
    if(edit.targetDay&&!editorDocumentDays(document).includes(edit.targetDay))return{conflict:true};
    const source=editorDocumentExercises(document,edit.sourceDay),sourceIndex=source.findIndex(item=>item.id===edit.targetId);
    if(sourceIndex<0)return{conflict:true};
    // The intent carries the source position as a precondition. Checking it
    // catches a second tab moving the same exercise within the same day; a day
    // check alone would silently reorder over that concurrent edit.
    if(check&&edit.sourceIndex!==undefined&&sourceIndex!==Number(edit.sourceIndex))return{conflict:true};
    const targetDay=String(edit.targetDay||edit.sourceDay),target=editorDocumentExercises(document,targetDay)
      .filter(item=>item.id!==edit.targetId);
    const requested=Number.isFinite(Number(edit.targetIndex))?Number(edit.targetIndex):target.length;
    const at=Math.max(0,Math.min(requested,target.length));
    const moved=document.program.find(item=>item.id===edit.targetId);
    if(!moved)return{conflict:true};
    if(targetDay===edit.sourceDay){
      source.splice(sourceIndex,1);source.splice(at,0,moved);
      source.forEach((item,index)=>{item.day=targetDay;item.order=index+1});
    }else{
      source.splice(sourceIndex,1);target.splice(at,0,moved);
      source.forEach((item,index)=>{item.order=index+1});
      target.forEach((item,index)=>{item.day=targetDay;item.order=index+1});
    }
    return syncEditorCanonicalIntent(document,document,edit)?{ok:true}:{conflict:true,code:"invalid_canonical_move"}}
  if(kind==="exercise_add"){
    if(check&&document.program?.some(item=>item.id===edit.targetId))return{conflict:true};
    if(edit.targetDay&&!editorDocumentDays(document).includes(edit.targetDay))return{conflict:true};
    if(edit.exercise){
      if(!editorHasCustomDefinition(document,edit.exercise.libraryId))
        return{conflict:true,code:"missing_custom_definition"};
      document.program=(document.program||[]).concat(cloneSnapshot(edit.exercise));
      syncProgramStructureFromProgram(document,makeProgram(document.program,snapshotLookup(document.customExercises),document.programMeta));
      if(!syncEditorCanonicalIntent(document,document,edit))return{conflict:true,code:"invalid_canonical_exercise"};
    }
    return{ok:true};
  }
  if(kind==="exercise_replace"){
    const existing=document.program?.find(item=>item.id===edit.targetId);
    if(!existing)return{conflict:true};
    if(check&&edit.beforeLibraryId!==undefined&&existing.libraryId!==edit.beforeLibraryId)return{conflict:true};
    if(edit.customExercise){
      if(!isCustomLibraryId(edit.customExercise.id)||edit.exercise?.libraryId!==edit.customExercise.id)
        return{conflict:true,code:"invalid_staged_custom_definition"};
      const customExercises=Array.isArray(document.customExercises)?document.customExercises:[];
      const current=customExercises.find(item=>item?.id===edit.customExercise?.id);
      if(current&&!changeValueEqualForEditor(current,edit.customExercise))return{conflict:true};
      if(!current)document.customExercises=customExercises.concat(cloneSnapshot(edit.customExercise));
    }
    if(edit.exercise){
      if(!editorHasCustomDefinition(document,edit.exercise.libraryId))
        return{conflict:true,code:"missing_custom_definition"};
      Object.assign(existing,cloneSnapshot(edit.exercise));
      if(!syncEditorCanonicalIntent(document,document,edit))return{conflict:true,code:"invalid_canonical_exercise"}}
    return{ok:true};
  }
  if(kind==="exercise_remove"){
    const existing=document.program?.find(item=>item.id===edit.targetId);
    if(check&&!existing)return{conflict:true};
    document.program=(document.program||[]).filter(item=>item.id!==edit.targetId);
    return syncEditorCanonicalIntent(document,document,edit)?{ok:true}:{conflict:true,code:"invalid_canonical_exercise"};
  }
  if(kind==="suggest_loads"||kind==="suggest_loads_rir"||kind==="execution_mode")
    return syncEditorCanonicalIntent(document,document,edit)?{ok:true}:{conflict:true,code:"invalid_canonical_prescription"};
  if(kind==="load_step")return documentRules.applyLoadStep(document,edit)?{ok:true}:{conflict:true};
  if(kind==="day_remove"){
    const day=String(edit.targetDay||"");
    if(check&&!editorDocumentDays(document).includes(day))return{conflict:true};
    document.program=(document.program||[]).filter(item=>item.day!==day);
    const structure=document.programMeta?.programStructure;
    if(structure?.days)document.programMeta.programStructure={...structure,days:structure.days.filter(item=>String(item?.label||item?.dayId||"")!==day)};
    return syncEditorCanonicalIntent(document,document,edit)?{ok:true}:{conflict:true,code:"invalid_canonical_exercise"};
  }
  return{ok:true};
}
/** @param {unknown} a @param {unknown} b */
function changeValueEqualForEditor(a,b){return JSON.stringify(canonicalize(a))===JSON.stringify(canonicalize(b))}
// Legacy snapshots remain readable, so custom-link integrity is enforced at
// the editor mutation boundary that creates or changes a program reference.
/** @param {Partial<EditorDocument>|null|undefined} document @param {unknown} id */
function editorHasCustomDefinition(document,id){
  return !isCustomLibraryId(id)||(document?.customExercises||[]).some(entry=>entry?.id===id)}
/** @param {{edits?:InstalledIntent[]}|null|undefined} session @param {EditorSnapshot} head */
function editorRebaseDocument(session,head){
  const rebased=editorDocumentFromSnapshot(head),edits=session?.edits||[];
  for(const edit of edits){const result=applyInstalledEditorIntent(rebased,edit);
    if(result?.conflict)return{conflict:true,code:result.code||"editor_intent_conflict"};}
  return{document:rebased,conflict:false}}
/** @param {Partial<EditorDocument>|null|undefined} document @param {string} slotId */
function editorDefinitionAndSlot(document,slotId){
  const definition=document?.programMeta?.programDefinition;
  for(const day of definition?.days||[]){
    const slot=(day.slots||[]).find(candidate=>candidate?.id===slotId);
    if(slot)return{definition,day,slot}}
  return{definition,day:null,slot:null}}
/** @param {ProgramDefinition|null|undefined} definition @param {string} slotId @param {number} cycleIndex @param {number} setIndex */
function editorSetByCoordinates(definition,slotId,cycleIndex,setIndex){
  for(const day of definition?.days||[]){
    const slot=(day.slots||[]).find(candidate=>candidate?.id===slotId);
    const cycle=slot?.prescriptionsByCycle?.find(candidate=>candidate?.cycleIndex===cycleIndex);
    const set=cycle?.sets?.find(candidate=>candidate?.setIndex===setIndex);
    if(set)return{slot,cycle,set}}
  return{slot:null,cycle:null,set:null}}
/** @param {ProgramSlot|null|undefined} slot @param {number} cycleIndex */
function editorCycleSetCount(slot,cycleIndex){
  return slot?.prescriptionsByCycle?.find(cycle=>cycle.cycleIndex===cycleIndex)?.sets?.length||0}
// Schema v2: a set derives its metric composition from its slot rather than
// storing it again, so this builds no metricIds/metricDefinitions of its own.
/** @param {string} slotId @param {number} cycleIndex @param {number} setIndex @param {string[]} metricIds @param {MetricDefinition[]} metricDefinitions @param {ProgramSet["targets"]} [targets] @param {string} [status] @returns {ProgramSet} */
function editorNewPrescription(slotId,cycleIndex,setIndex,metricIds,metricDefinitions,targets={},status){
  return{id:`manual-${uid()}`,cycleIndex,setIndex,metricType:"source_metrics@1",
    targets:cloneSnapshot(targets),rir:null,restSeconds:null,
    status:status||(metricIds.length?"manual":"configuration_required"),
    provenance:{source:"manual",policyVersion:"manual@1"}}}
/** @param {EditorRow} row @param {EditorDocument} document @param {string} slotId @param {number} order @param {ProgramSlot|null} [existing] @returns {ProgramSlot|null} */
function editorSlotForRow(row,document,slotId,order,existing=null){
  const exerciseId=String(row?.libraryId||row?.exerciseId||"");
  if(!exerciseId)return null;
  const raw=rawExercise(exerciseId),custom=(document?.customExercises||[]).find(entry=>entry.id===exerciseId)||null;
  const definitions=raw?rawMetricDefinitions(exerciseId)||[]:
    Array.isArray(custom?.metricDefinitions)?custom.metricDefinitions.map(cloneSnapshot):[];
  const metricIds=definitions.map(definition=>definition.id);
  const origin=raw?"source_catalog":"user_defined";
  const sourceSetsByCycle=new Map((existing?.prescriptionsByCycle||[]).map(cycle=>[cycle.cycleIndex,cycle]));
  const definitionCycles=document?.programMeta?.programDefinition?.cycles;
  const cycles=typeof definitionCycles==="number"&&Number.isInteger(definitionCycles)?definitionCycles:1;
  const reps=definitions.find(definition=>definition.semantic==="reps"||definition.semantic==="repsPerSide");
  /** @type {ProgramSet["targets"]} */
  const targets={};
  // A movement that counts repetitions always gets a range: the row's, or
  // Build's default when the slot it replaces had none (a rep-less movement).
  if(reps)targets[reps.semantic]=typeof row.min==="number"&&typeof row.max==="number"&&Number.isSafeInteger(row.min)&&row.min>=1&&Number.isSafeInteger(row.max)&&row.max>=row.min
    ?{min:row.min,max:row.max}:{min:6,max:10};
  const setCount=Math.max(1,Math.min(100,typeof row.sets==="number"&&Number.isInteger(row.sets)?row.sets:3));
  const prescriptionsByCycle=[];
  for(let cycleIndex=1;cycleIndex<=cycles;cycleIndex++){
    const previous=sourceSetsByCycle.get(cycleIndex)?.sets||[];
    const sets=[];
    for(let setIndex=1;setIndex<=setCount;setIndex++){
      const old=previous[setIndex-1];
      const retainedTargets=existing&&old?cloneSnapshot(old.targets||{}):cloneSnapshot(targets);
      const filteredTargets=Object.fromEntries(Object.entries(retainedTargets).filter(([semantic])=>
        definitions.some(definition=>definition.semantic===semantic)));
      if(reps&&filteredTargets[reps.semantic]==null&&targets[reps.semantic])
        filteredTargets[reps.semantic]=cloneSnapshot(targets[reps.semantic]);
      const built=editorNewPrescription(slotId,cycleIndex,setIndex,metricIds,definitions,filteredTargets,
        definitions.length?"manual":"configuration_required");
      // Plan 069 D3: a new movement is not what the lifter opted in for, so
      // a replaced slot keeps its values but returns to manual.
      if(existing&&old){built.id=old.id;built.rir=old.rir??null;built.restSeconds=old.restSeconds??null;
        built.provenance={...cloneSnapshot(old.provenance||{}),source:"manual",policyVersion:"manual@1"}}
      sets.push(built)}
    prescriptionsByCycle.push({cycleIndex,sets})}
  const primaryIds=Array.isArray(raw?.primaryFeatureMuscle)?raw.primaryFeatureMuscle:[];
  const secondaryIds=Array.isArray(raw?.secondaryFeatureMuscle)?raw.secondaryFeatureMuscle:[];
  const patternIds=Array.isArray(raw?.movementPattern)?raw.movementPattern:[];
  const sourceType=raw?.exerciseType||null;
  const prior=existing||{};
  return{...prior,id:slotId,purposeId:"manual",exerciseId,sourceExerciseIds:[exerciseId],role:"manual",
    musclePurposeIds:[...new Set([...primaryIds,...secondaryIds])],movementPatternIds:[...new Set(patternIds)],
    ...(sourceType?{exerciseTypeId:sourceType}:{}),order,metricOrigin:origin,metricIds,metricDefinitions:definitions,
    ...(row.displayName?{displayName:String(row.displayName)}:{}),setupNotes:String(row.notes||""),
    ...(!raw?manualAttributionFor(row):{}),
    loadingModel:{bodyweightCoefficient:typeof raw?.bodyweight==="number"&&Number.isFinite(raw.bodyweight)?raw.bodyweight:null,assistanceDirection:"subtract"},
    prescriptionsByCycle}}
/** @param {EditorDocument} document @param {ProgramSlot|null|undefined} slot @param {number} [cycleIndex] */
function syncEditorRowFromCanonical(document,slot,cycleIndex=1){
  const row=(document?.program||[]).find(candidate=>(candidate.slotId||candidate.id)===slot?.id);
  if(!row||!slot)return;
  const cycle=slot.prescriptionsByCycle?.find(candidate=>candidate.cycleIndex===cycleIndex)||slot.prescriptionsByCycle?.[0];
  const rep=slot.metricDefinitions?.find(definition=>definition.semantic==="reps"||definition.semantic==="repsPerSide");
  const repTarget=cycle?.sets?.map(set=>set.targets?.[rep?.semantic||""]).find(value=>value!=null);
  row.sets=cycle?.sets?.length||row.sets;
  row.hasRepTarget=!!rep;
  if(rep){
    row.min=typeof repTarget==="number"?repTarget:repTarget&&typeof repTarget==="object"&&Number.isFinite(repTarget.min)?repTarget.min:row.min;
    row.max=typeof repTarget==="number"?repTarget:repTarget&&typeof repTarget==="object"&&Number.isFinite(repTarget.max)?repTarget.max:row.max;
  }else{delete row.min;delete row.max}}
/** @param {unknown} target */
function editorRepRangeValid(target){
  return !!suggestion.repRange(target)}
/* A pending "Suggest loads" opt-in belongs to the movement it was turned on for. */
/** @param {EditorDocument} document @param {string} slotId */
function dropPendingSuggestLoads(document,slotId){
  const meta=document?.programMeta,list=Array.isArray(meta?.suggestLoadsPending)?meta.suggestLoadsPending:null;
  if(!list)return;
  const next=list.filter(id=>id!==slotId);
  if(next.length)meta.suggestLoadsPending=next;else delete meta.suggestLoadsPending}
/** @param {EditorDocument} document @param {Partial<EditorDocument>} baseDocument @param {InstalledIntent} edit @param {{cycleIndex?:number}} [options] */
function syncEditorCanonicalIntent(document,baseDocument,edit,{cycleIndex=1}={}){
  const meta=document.programMeta||(document.programMeta={});
  let definition=meta.programDefinition||null;
  const baseDefinition=baseDocument?.programMeta?.programDefinition;
  if(!definition){
    if(!allowCreateDefinition||edit?.kind!=="exercise_add")return false;
    const dayNames=(meta.programStructure?.days||[]).map(item=>item?.label||item?.dayId).filter(Boolean);
    definition=cloneSnapshot(baseDefinition||manualProgramDefinitionFromRows(
      baseDocument?.program||[],dayNames,document.customExercises||[]));
    if(!definition)return false;
    meta.programDefinition=definition}
  /** @param {string} slotId */
  const find=slotId=>editorDefinitionAndSlot(document,slotId);
  const slotId=String(edit?.slotId||edit?.targetId||"");
  const beforeRef=editorDefinitionAndSlot({programMeta:{programDefinition:baseDefinition}},slotId);
  if(edit?.kind==="metric_target"){
    const {slot}=find(slotId),{set}=editorSetByCoordinates(definition,slotId,Number(edit.cycleIndex),Number(edit.setIndex));
    const metric=slot?.metricDefinitions?.find(item=>item.id===edit.metricId);
    if(!slot||!set||!metric||metric.semantic!==edit.semantic||
      !changeValueEqualForEditor(slot.metricIds,edit.metricIds)||!changeValueEqualForEditor(slot.metricDefinitions,edit.metricDefinitions))return false;
    const current=Object.prototype.hasOwnProperty.call(set.targets||{},edit.semantic)
      ?{present:true,value:set.targets[edit.semantic]}:{present:false,value:null};
    if(!changeValueEqualForEditor(current,edit.after)&&!changeValueEqualForEditor(current,edit.before))return false;
    if(!documentRules.replaceMetricTarget(document,slotId,Number(edit.cycleIndex),Number(edit.setIndex),edit.semantic,edit.after,{preserveProvenance:false,projectRow:false}))return false;
    syncEditorRowFromCanonical(document,slot,Number(edit.cycleIndex));
  }else if(edit?.kind==="metric_composition"){
    const {slot}=find(slotId);
    if(!slot||(slot.metricOrigin!=="user_defined"&&slot.metricIds?.length))return false;
    const alreadyApplied=changeValueEqualForEditor(slot.metricIds,edit.metricIds)&&
      changeValueEqualForEditor(slot.metricDefinitions,edit.metricDefinitions);
    const matchesBefore=changeValueEqualForEditor(slot.metricIds,edit.beforeMetricIds)&&
      changeValueEqualForEditor(slot.metricDefinitions,edit.beforeMetricDefinitions);
    if(!alreadyApplied&&!matchesBefore)return false;
    const checkedMetrics=ExerciseMetrics?.validateDefinitions?.(edit.metricIds,edit.metricDefinitions,{allowEmpty:true});
    const supported=ExerciseMetrics?.SOURCE_COMPOSITIONS?.some(composition=>
      changeValueEqualForEditor(composition,edit.metricIds));
    if(!checkedMetrics?.ok||!supported)return false;
    const compositionRow=(document.program||[]).find(item=>(item.slotId||item.id)===slotId)||{id:slotId};
    if(!documentRules.replaceMetricComposition(document,compositionRow,edit.metricIds,edit.metricDefinitions,
      {preserveProvenance:false,filterTargets:!alreadyApplied,projectRow:false}))return false;
    // A composition that counts repetitions needs a rep range to log against;
    // a newly configured one starts from the row's range or Build's default.
    const repSemantic=edit.metricDefinitions.find(metric=>metric.semantic==="reps"||metric.semantic==="repsPerSide")?.semantic;
    const row=(document.program||[]).find(item=>String(item.slotId||item.id)===String(slotId));
    const rowMin=Number(row?.min),rowMax=Number(row?.max);
    const defaultRange=Number.isSafeInteger(rowMin)&&rowMin>0&&Number.isSafeInteger(rowMax)&&rowMax>=rowMin
      ?{min:rowMin,max:rowMax}:{min:6,max:10};
    for(const cycle of slot.prescriptionsByCycle||[])for(const set of cycle.sets||[]){
      if(repSemantic&&set.targets?.[repSemantic]==null)set.targets={...(set.targets||{}),[repSemantic]:cloneSnapshot(defaultRange)}}
    dropPendingSuggestLoads(document,slotId);
    syncEditorRowFromCanonical(document,slot,cycleIndex);
  }else if(edit?.kind==="exercise_field"){
    const row=(document.program||[]).find(item=>item.id===edit.targetId);
    if(!row)return false;
    const {slot}=find(String(row.slotId||row.id));
    if(!slot)return !definition;
    if(edit.field==="notes")slot.setupNotes=String(row.notes||"");
    else if(edit.field==="name"){
      const alias=String(row.displayName||"").trim();
      if(alias)slot.displayName=alias;else delete slot.displayName;
    }else if((edit.field==="primary"||edit.field==="secondary")&&slot.metricOrigin==="user_defined"){
      const attribution=manualAttributionFor({...(slot.manualAttribution||{}),[edit.field]:row[edit.field]}).manualAttribution;
      if(attribution)slot.manualAttribution=attribution;else delete slot.manualAttribution;
    }
  }else if(edit?.kind==="prescription_field"){
    if(!documentRules.applyPrescriptionField(document,edit))return false;
    const {slot}=find(slotId);syncEditorRowFromCanonical(document,slot,Number(edit.cycleIndex));
  }else if(edit?.kind==="suggest_loads"){
    const {slot}=find(slotId);
    if(!slot||typeof edit.on!=="boolean")return false;
    // A replay applies only to the movement and opt-in state it was made on.
    const sets=(slot.prescriptionsByCycle||[]).flatMap(cycle=>cycle.sets||[]);
    const adaptive=sets.length>0&&sets.every(set=>set.status==="ready");
    const current=adaptive?"ready":(document.programMeta?.suggestLoadsPending||[]).includes(slotId)?"pending":"off";
    const after=edit.on?(adaptive?"ready":"pending"):"off";
    if(slot.exerciseId!==edit.before?.exerciseId||(current!==edit.before?.state&&current!==after))return false;
    if(edit.on&&editorSuggestLoadsPolicy.eligibility(slot)!=="eligible")return false;
    if(!suggestion.set(document,slotId,edit.on))return false;
  }else if(edit?.kind==="suggest_loads_rir"){
    const {slot}=find(slotId);
    if(!slot||!Array.isArray(edit.before))return false;
    const after=edit.after;
    if(after!==null&&!(typeof after==="number"&&Number.isFinite(after)&&after>=0&&after<=4))return false;
    const sets=(slot.prescriptionsByCycle||[]).flatMap(cycle=>cycle.sets||[]);
    const current=sets.map(set=>set.rir??null);
    if(!changeValueEqualForEditor(current,edit.before)&&!current.every(value=>value===after))return false;
    if(!suggestion.setRir(document,slotId,after))return false;
    syncEditorRowFromCanonical(document,slot,cycleIndex);
  }else if(edit?.kind==="execution_mode"){
    const {slot}=find(slotId);
    if(!slot||!editorSuggestLoadsPolicy.executionModeQuestion(slot))return false;
    if(!documentRules.applyExecutionMode(document,edit))return false;
  }else if(edit?.kind==="prescription"&&edit.field==="sets"){
    const {slot}=find(slotId);
    const effectiveCycleIndex=Number(edit.cycleIndex||cycleIndex),cycle=slot?.prescriptionsByCycle?.find(item=>item.cycleIndex===effectiveCycleIndex);
    if(!slot||!cycle)return false;
    const desired=Number(edit.after),before=Number(edit.before);
    if(!Number.isInteger(desired)||desired<1||desired>100)return false;
    const beforeIds=edit.beforeSetIds,currentIds=cycle.sets.map(item=>item.id);
    if(!Array.isArray(beforeIds)||beforeIds.length!==before||beforeIds.some(id=>typeof id!=="string")||
      new Set(beforeIds).size!==before)return false;
    const added=edit.addedSets||[],addedIds=added.map(item=>item?.id);
    if(desired>before&&(added.length!==desired-before||addedIds.some(id=>typeof id!=="string")||new Set(addedIds).size!==addedIds.length))return false;
    if(desired<=before&&added.length)return false;
    const expectedRemoved=beforeIds.slice(desired);
    if(!changeValueEqualForEditor(expectedRemoved,edit.removedSetIds||[]))return false;
    const expectedIds=desired>before?[...beforeIds,...addedIds]:beforeIds.slice(0,desired);
    if(cycle.sets.length===before&&changeValueEqualForEditor(currentIds,beforeIds)){
      while(cycle.sets.length<desired){
        const added=edit.addedSets?.find(item=>item.setIndex===cycle.sets.length+1);
        // Schema v2: an added set carries no metric composition of its own
        // (the slot above owns it), so there is nothing per-set left to verify here.
        if(!added||added.cycleIndex!==effectiveCycleIndex)return false;
        cycle.sets.push(cloneSnapshot(added))}
      if(cycle.sets.length>desired){
        const removed=cycle.sets.slice(desired).map(item=>item.id);
        if(!changeValueEqualForEditor(removed,expectedRemoved))return false;
        cycle.sets=cycle.sets.slice(0,desired)}
      cycle.sets.forEach((item,index)=>{item.setIndex=index+1})
    }else if(!changeValueEqualForEditor(currentIds,expectedIds))return false;
    if(!changeValueEqualForEditor(cycle.sets.map(item=>item.id),expectedIds))return false;
    const row=(document.program||[]).find(item=>(item.slotId||item.id)===slotId);
    if(row)row.sets=desired;
    syncEditorRowFromCanonical(document,slot,effectiveCycleIndex);
  }else if(edit?.kind==="exercise_add"||edit?.kind==="exercise_replace"){
    const row=(document.program||[]).find(item=>item.id===edit.targetId);
    if(!row)return false;
    if(edit.kind==="exercise_add"&&find(slotId).slot)return false;
    const targetDay=String(row.day||edit.targetDay||"");
    let day=(definition.days||[]).find(item=>item.name===targetDay&&item.kind==="training");
    if(!day){
      day=(definition.days||[]).find(item=>item.name===targetDay&&item.kind==="rest"&&!item.slots?.length)||
        (definition.days||[]).find(item=>item.kind==="rest"&&!item.slots?.length);
      if(!day)return false;
      day.name=targetDay;day.kind="training"}
    const oldSlot=edit.kind==="exercise_replace"?beforeRef.slot:null;
    const newSlot=editorSlotForRow(row,document,slotId,Number(row.order)||day.slots.length+1,oldSlot);
    if(!newSlot)return false;
    // The slot keeps its alternates through a replacement, less the movement it now is.
    if(Array.isArray(newSlot.alternates)){
      newSlot.alternates=newSlot.alternates.filter(id=>id!==newSlot.exerciseId);
      if(!newSlot.alternates.length)delete newSlot.alternates}
    if(edit.kind==="exercise_replace"){
      for(const container of definition.days||[])container.slots=container.slots.filter(slot=>slot.id!==slotId)}
    if(edit.kind==="exercise_replace")dropPendingSuggestLoads(document,slotId);
    const current=day.slots.findIndex(item=>item.id===slotId);
    if(current>=0)day.slots[current]=newSlot;else day.slots.push(newSlot);
    day.slots.sort((a,b)=>a.order-b.order);
    day.slots.forEach((item,index)=>{item.order=index+1});
    syncEditorRowFromCanonical(document,newSlot,cycleIndex);
  }else if(edit?.kind==="slot_alternates"){
    if(!documentRules.applyAlternates(document,edit))return false;
  }else if(edit?.kind==="exercise_remove"){
    if(!beforeRef.slot)return false;
    // The slots after it close the gap: validateProgramDefinition wants a day's orders contiguous.
    for(const day of definition.days||[]){
      day.slots=day.slots.filter(slot=>slot.id!==slotId);
      day.slots.forEach((item,index)=>{item.order=index+1})}
    dropPendingSuggestLoads(document,slotId);
  }else if(edit?.kind==="exercise_move"){
    const {slot}=find(slotId);if(!slot)return false;
    const row=(document.program||[]).find(item=>item.id===edit.targetId);
    if(!row)return false;
    for(const day of definition.days||[])day.slots=day.slots.filter(item=>item.id!==slotId);
    const day=(definition.days||[]).find(item=>item.name===row.day);if(!day)return false;
    day.slots.splice(Math.max(0,Math.min(day.slots.length,Number(row.order)-1)),0,slot);
    // The day it left closes its gap too (#434): validateProgramDefinition wants every day's orders contiguous.
    for(const container of definition.days||[])container.slots.forEach((item,index)=>{item.order=index+1});
  }else if(edit?.kind==="day_name"){
    const target=(definition.days||[]).find(item=>item.name===edit.before);
    if(!target)return false;
    target.name=String(edit.after||"");
  }else if(edit?.kind==="day_add"){
    const nextName=String(edit.after||edit.targetDay||"").trim();
    if(!nextName)return false;
    if((definition.days||[]).some(day=>day.name===nextName&&day.kind==="training"))return false;
    const target=(definition.days||[]).find(day=>day.kind==="rest"&&!day.slots?.length);
    if(!target)return false;
    target.name=nextName;target.kind="training";
  }else if(edit?.kind==="day_remove"){
    const target=(definition.days||[]).find(item=>item.name===edit.targetDay);
    if(!target)return false;
    for(const slot of target.slots||[])dropPendingSuggestLoads(document,slot.id);
    target.kind="rest";target.slots=[];
  }
  const checked=canonicalProgramDefinition(definition,document.customExercises||[]);
  if(!checked)return false;
  meta.programDefinition=checked;
  return true}
/** @param {unknown} exerciseId */
function catalogExecutionMode(exerciseId){
  const source=rawExercise(exerciseId),laterality=(source?.laterality||[])
    .map(id=>rawCatalogObject(id)?.name).filter(name=>typeof name==="string");
  const unilateral=laterality.includes("Unilateral"),bilateral=laterality.includes("Bilateral");
  return unilateral!==bilateral?(unilateral?"unilateral":"bilateral"):null}
/** @param {EditorDraftSet|null|undefined} set */
function draftSetTouched(set){
  return !!(set?.touched?.load||set?.touched?.reps||set?.touched?.effort||
    Object.values(set?.touched?.metrics||{}).some(Boolean))}
/** @param {unknown} k */
function setKeyExerciseId(k){return String(k).replace(/_\d+$/,"")}

return Object.freeze({editorDocumentFromSnapshot,editorSnapshotFromDocument,editorTokenEqual,editorDocumentDays,editorDocumentExercises,editorDraftExerciseIds,editorIntentValue,applyInstalledEditorIntent,changeValueEqualForEditor,editorHasCustomDefinition,editorRebaseDocument,editorDefinitionAndSlot,editorSetByCoordinates,editorCycleSetCount,editorNewPrescription,editorSlotForRow,syncEditorRowFromCanonical,editorRepRangeValid,dropPendingSuggestLoads,syncEditorCanonicalIntent,catalogExecutionMode,editorSuggestLoadsPolicy,suggestion});
}
