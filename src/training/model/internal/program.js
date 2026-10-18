import { compiler as Compiler } from "../../generation.js";
import ExerciseMetrics from "../../metrics.js";
import { createEntryRules } from "../../authoring/internal/entry.js";
import { progression } from "../../progress.js";
import { cloneSnapshot,isPlainStateObject,isBoundedProgressionValue,canonicalize,PROGRESSION_VALUE_LIMITS } from "./values.js";
import { calendarDayDistance } from "../../progress.js";
/**
 * A command's explicit catalog, identity, clock and display inputs. State/custom
 * lists are operation arguments; no function consults the live app snapshot.
 * `now` is an ISO instant or explicit clock supplied by the caller.
 * `calendarDate` is the caller's local YYYY-MM-DD (value/getter), independent of
 * UTC timestamps. Language/default label may be getters for live display state.
 */
export function createProgramModel({catalog,librarySource={library:[],legacyIds:{}},nextId,now,calendarDate,language="en",defaultExerciseName="Exercise"}) {
const rawExerciseCatalog=catalog;
const LIBRARY_BY_ID=new Map((librarySource.library||[]).map(entry=>[entry.id,entry]));
const LEGACY_LIBRARY_IDS=librarySource.legacyIds||{};
const CUSTOM_ID_PREFIX="custom:";
const MuscleDomain=createEntryRules(catalog);
const rawExercise=id=>catalog?.exercises?.find(entry=>entry.id===String(id??""))||null;
const rawCatalogObject=id=>catalog?.uuidIndex?.[String(id??"")]||null;
const uid=()=>{if(typeof nextId!=="function")throw new TypeError("nextId required to create training identity");return nextId();};
const isPt=()=>(typeof language==="function"?language():language)==="pt";
const t=key=>{if(key!=="program.default.exercise")throw new TypeError("unknown model label");return typeof defaultExerciseName==="function"?defaultExerciseName():defaultExerciseName;};
const libraryName=entry=>!entry?"":(isPt()&&entry.namePt)||entry.name;
const isCustomLibraryId=id=>String(id||"").startsWith(CUSTOM_ID_PREFIX);
const libraryEntry=id=>LIBRARY_BY_ID.get(String(id??""))||null;
const muscles=value=>MuscleDomain.normalizeMuscleAttribution(value).tokens;
const volMapToObj=map=>Object.fromEntries([...map].map(([key,value])=>[key,{d:value.d,p:value.p}]));
const today=()=>{const date=typeof calendarDate==="function"?calendarDate():calendarDate;
  if(date===undefined)return requiredNow().slice(0,10);
  if(typeof date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new TypeError("calendarDate must be YYYY-MM-DD");
  return date;};
const PLANNED_VOLUME_HISTORY_KEYS=["schemaVersion","throughWeek","plannedSessions","plannedWorkingSets","muscles"];
const PLANNED_VOLUME_HISTORY_MUSCLE_KEYS=["direct","secondary"];
const requiredNow=()=>{const instant=typeof now==="function"?now():now;if(typeof instant!=="string")throw new TypeError("now required to create custom exercise timestamp");return instant;};
const SOURCE_FEATURE_TO_LEGACY_MUSCLE=Object.freeze({
  "chest":"Chest","lats":"Lats","upper back":"Mid/upper back","upper traps":"Traps",
  "front delts":"Front delts","side delts":"Side delts","rear delts":"Rear delts",
  "biceps":"Biceps","triceps":"Triceps","forearms":"Forearms","quads":"Quads",
  "hamstrings":"Hamstrings","glutes":"Glutes","adductors":"Adductors","abductors":"Abductors",
  "calves":"Calves","tibs":"Tibs","hip flexors":"Hip flexors","lower back":"Spinal erectors",
  "neck":"Neck","serratus":"Serratus","abs":"Abs","obliques":"Obliques",
});
function rawMetricDefinitions(id){
  const record=rawExercise(id);
  if(!record||!Array.isArray(record.exerciseMetrics))return record?[]:null;
  const compiler=Compiler;
  return record.exerciseMetrics.map(metricId=>{
    const source=rawCatalogObject(metricId),mapped=source&&compiler?.metricDefinitionForName?.(source.name);
    return source?.type==="exerciseMetric"&&mapped?{id:String(metricId),sourceName:source.name,
      semantic:mapped.semantic,unit:mapped.unit}:null}).filter(Boolean)}

function normalizeMuscleAttribution(value,field="muscle attribution"){
  const result=MuscleDomain?.normalizeMuscleAttribution?.(value);
  if(!result?.ok)throw new TypeError(`${result?.code||"invalid-muscle-domain"}: ${field}`);
  return result.value}

function sourceFeatureAttribution(ids){
  const tokens=[];
  for(const id of Array.isArray(ids)?ids:[]){
    const name=rawCatalogObject(id)?.name;
    const token=SOURCE_FEATURE_TO_LEGACY_MUSCLE[String(name||"").trim().toLowerCase()];
    if(token&&!tokens.includes(token))tokens.push(token)}
  return tokens.join(",")}

function libraryMuscleAttribution(entry,field){
  const record=entry?.id?rawExercise(entry.id):null;
  if(record){
    const sourceField=field==="primary"?record.primaryFeatureMuscle:record.secondaryFeatureMuscle;
    return sourceFeatureAttribution(sourceField)}
  return String(entry?.[field]||"")}

function exerciseFieldsFromLibrary(entry){
  return{name:libraryName(entry),primary:libraryMuscleAttribution(entry,"primary"),secondary:libraryMuscleAttribution(entry,"secondary"),
    notes:entry.notes||"",libraryId:entry.id,displayName:null}}

/* The compiler owns the custom-definition schema. Device state carries more
   (archive flag, patterns, timestamps), so project exactly its keys; a custom
   movement without a configured composition has an empty one. */

function compilerCustomDefinitions(list){
  return(Array.isArray(list)?list:[]).filter(isPlainStateObject).map(entry=>{
    const metrics=ExerciseMetrics?.validateDefinitions?.(entry.metricIds,entry.metricDefinitions,{allowEmpty:true});
    const out={id:String(entry.id||""),name:String(entry.name||"")};
    if(typeof entry.namePt==="string"&&entry.namePt.trim())out.namePt=entry.namePt;
    out.equipment=Array.isArray(entry.equipment)?entry.equipment.filter(item=>typeof item==="string"&&item.trim()):[];
    out.primary=typeof entry.primary==="string"?entry.primary:"";
    out.secondary=typeof entry.secondary==="string"?entry.secondary:"";
    out.notes=typeof entry.notes==="string"?entry.notes:"";
    out.metricIds=metrics?.ok?cloneSnapshot(entry.metricIds):[];
    out.metricDefinitions=metrics?.ok?cloneSnapshot(entry.metricDefinitions):[];
    return out})}

function canonicalProgramDefinition(value,customDefinitions=[]){
  const compiler=Compiler;
  if(!compiler?.validateProgramDefinition||!rawExerciseCatalog)return null;
  const checked=compiler.validateProgramDefinition(value,rawExerciseCatalog,compilerCustomDefinitions(customDefinitions));
  if(!checked?.ok)return null;
  // Accepts schema v1 (set-level metrics present, equal to the slot's) and v2
  // (absent); this is the one boundary every file/link/backup/transfer passes
  // through, so it always hands back the deduped v2 shape.
  return compiler.canonicalizeProgramDefinition?compiler.canonicalizeProgramDefinition(value):cloneSnapshot(value)}
/* Every movement a canonical definition names: each slot's own and its
   alternates. A custom movement that is only an alternate is still part of the
   program, so it travels, stays in use and is never deleted out from under it. */

function definitionMovementIds(definition){
  return(definition?.days||[]).flatMap(day=>(day?.slots||[]).flatMap(slot=>
    [slot?.exerciseId,...(Array.isArray(slot?.alternates)?slot.alternates:[])])).filter(id=>typeof id==="string"&&id)}
/* A movement outside the catalog carries the lifter's own muscle labels. An
   empty label is no attribution, not an invalid one. */

function manualAttributionFor(row){
  const primary=String(row?.primary||"").trim(),secondary=String(row?.secondary||"").trim();
  if(!primary&&!secondary)return{};
  return{manualAttribution:{...(primary?{primary}:{}),...(secondary?{secondary}:{})}}}

function manualProgramDefinitionFromRows(rows,dayNames=[],customDefinitions=[]){
  const compiler=Compiler;
  if(!compiler?.validateProgramDefinition||!rawExerciseCatalog)return null;
  const byDay=new Map();
  for(const row of Array.isArray(rows)?rows:[]){
    const label=String(row?.day||"Day 1");
    if(!byDay.has(label))byDay.set(label,[]);
    byDay.get(label).push(row)}
  const labels=[...new Set([...(Array.isArray(dayNames)?dayNames:[]).map(String),...byDay.keys()])].filter(Boolean);
  if(labels.length>7)return null;
  const orderedLabels=labels,days=[];
  for(let index=0;index<7;index++){
    const label=orderedLabels[index]||`${isPt()?"Descanso":"Rest"} ${index+1}`;
    const entries=(byDay.get(label)||[]).slice().sort((a,b)=>(+a.order||0)-(+b.order||0));
    const slots=entries.map((row,slotIndex)=>{
      const exerciseId=String(row.libraryId||row.exerciseId||"");
      const raw=rawExercise(exerciseId),custom=customDefinitions.find(item=>item.id===exerciseId)||null;
      const definitions=raw?rawMetricDefinitions(exerciseId)||[]:
        (Array.isArray(custom?.metricDefinitions)?custom.metricDefinitions.map(cloneSnapshot):[]);
      const metricIds=definitions.map(metric=>metric.id);
      const primary=Array.isArray(raw?.primaryFeatureMuscle)?raw.primaryFeatureMuscle:[];
      const secondary=Array.isArray(raw?.secondaryFeatureMuscle)?raw.secondaryFeatureMuscle:[];
      const patterns=Array.isArray(raw?.movementPattern)?raw.movementPattern:[];
      const typeId=raw?.exerciseType||custom?.exerciseTypeId||null;
      const count=Number(row.sets);
      if(!Number.isInteger(count)||count<1||count>100)return null;
      const repsSemantic=definitions.find(metric=>metric.semantic==="reps"||metric.semantic==="repsPerSide")?.semantic;
      const authoredMin=Object.prototype.hasOwnProperty.call(row,"min")?Number(row.min):6;
      const authoredMax=Object.prototype.hasOwnProperty.call(row,"max")?Number(row.max):10;
      if(repsSemantic&&(!Number.isSafeInteger(authoredMin)||authoredMin<1||!Number.isSafeInteger(authoredMax)||authoredMax<authoredMin))return null;
      const targets=repsSemantic?{[repsSemantic]:{min:authoredMin,max:authoredMax}}:{};
      const configurationRequired=definitions.length===0;
      const prescriptionsByCycle=Array.from({length:7},(_,cycleOffset)=>{
        const cycleIndex=cycleOffset+1;
        return{cycleIndex,sets:Array.from({length:count},(_,setIndex)=>({
          id:`manual-${String(row.slotId||row.id||index+1)}-${cycleIndex}-${setIndex+1}`,
          cycleIndex,setIndex:setIndex+1,metricType:"source_metrics@1",
          targets:cloneSnapshot(targets),
          rir:null,restSeconds:null,status:configurationRequired?"configuration_required":"manual",
          provenance:{source:"manual",policyVersion:"manual@1"}}))}});
      return{id:String(row.slotId||row.id||`manual-slot-${index+1}-${slotIndex+1}`),
        purposeId:"manual",exerciseId,sourceExerciseIds:[exerciseId],role:"manual",
        musclePurposeIds:[...new Set([...primary,...secondary])],movementPatternIds:[...new Set(patterns)],
        ...(typeId?{exerciseTypeId:typeId}:{}),order:slotIndex+1,metricOrigin:raw?"source_catalog":"user_defined",
        metricIds,metricDefinitions:definitions.map(cloneSnapshot),
        ...(row.displayName?{displayName:String(row.displayName)}:{}),
        setupNotes:String(row.notes||""),
        ...(!raw?manualAttributionFor(row):{}),
        loadingModel:{bodyweightCoefficient:Number.isFinite(raw?.bodyweight)?raw.bodyweight:null,
          assistanceDirection:"subtract"},
        prescriptionsByCycle};});
    if(slots.some(slot=>!slot))return null;
    days.push({id:`manual-day-${index+1}`,name:label,kind:entries.length?"training":"rest",order:index+1,slots})}
  const definition={schemaVersion:2,generatorVersion:"manual@1",request:{},days,
    cycles:7,deloadCycles:[],provenance:{source:"manual",policyVersion:"manual@1"}};
  return canonicalProgramDefinition(definition,customDefinitions)}
/* Durable program rows are stored exactly as an accepted snapshot normalizes
   them, so the lock-held program fingerprint of the stored head matches the
   in-memory state for the rest of the session. */

function durableProgramRows(definition,customDefinitions,meta){
  return makeProgram(flatProgramFromDefinition(definition,customDefinitions,1),null,meta).toJSON()}

function flatProgramFromDefinition(definition,customDefinitions=[],cycleNumber=1){
  if(!definition||!Array.isArray(definition.days))return[];
  const compiler=Compiler;
  const sourceSets=new Map((compiler?.prescriptionsForCycle?.(definition,cycleNumber)||[])
    .reduce((all,set)=>{if(!all.has(set.slotId))all.set(set.slotId,[]);all.get(set.slotId).push(set);return all},new Map()));
  const customById=new Map(customDefinitions.map(entry=>[entry.id,entry]));
  const rows=[];
  for(const day of definition.days){
    if(day.kind!=="training")continue;
    for(const slot of day.slots){
      const raw=rawExercise(slot.exerciseId),custom=customById.get(slot.exerciseId),index=LIBRARY_BY_ID.get(slot.exerciseId);
      const cycle=slot.prescriptionsByCycle?.find(entry=>entry.cycleIndex===cycleNumber);
      if(!cycle||!cycle.sets.length)continue;
      const sets=sourceSets.get(slot.id)||cycle.sets;
      const reps=sets.map(set=>set.targets?.reps??set.targets?.repsPerSide).find(value=>value!=null);
      const minimum=typeof reps==="number"?reps:Number.isFinite(reps?.min)?reps.min:1;
      const maximum=typeof reps==="number"?reps:Number.isFinite(reps?.max)?reps.max:minimum;
      const row={id:slot.id,slotId:slot.id,day:day.name,dayId:day.id,order:slot.order||rows.length+1,
        // The lifter's alias is the slot's name, as it is for a stored row.
        name:slot.displayName||index?.name||custom?.name||raw?.name||slot.exerciseId,libraryId:slot.exerciseId,
        sets:sets.length,hasRepTarget:reps!=null,
        displayName:slot.displayName||null,
        // A custom movement's muscles are its own definition's, as a stored row
        // resolves them; a catalog movement's come from the catalog; only an
        // unlinked slot falls back to its per-slot attribution.
        primary:custom?String(custom.primary||""):raw?sourceFeatureAttribution(raw.primaryFeatureMuscle||[]):String(slot.manualAttribution?.primary||""),
        secondary:custom?String(custom.secondary||""):raw?sourceFeatureAttribution(raw.secondaryFeatureMuscle||[]):String(slot.manualAttribution?.secondary||""),
        notes:String(slot.setupNotes||"")};
      if(reps!=null){row.min=minimum;row.max=maximum}
      rows.push(row)}}
  return rows}


function normalizeProgressionEnvelope(value){
  const validator=progression;
  const checked=validator?.validatePrescription?.(value);
  return checked?.ok?cloneSnapshot(checked.value):null}

function progressionIncompatibility(kind,value,checked,source){
  return{version:1,kind,source:source||"state-restore",reason:Array.isArray(checked?.issues)?checked.issues.join("; "):"incompatible",value:cloneSnapshot(value)}
}

function normalizeProgressionRelations(value,program=[],options={}){
  if(value!=null&&!Array.isArray(value))throw new TypeError("progressionRelations: expected array");
  if(value!=null&&!isBoundedProgressionValue(value))throw new TypeError("progressionRelations: structure exceeds safety bounds");
  // Empty released compatibility collections carry no executable intent.
  // They remain an empty projection after retiring the old validator instead
  // of being misclassified as an unsupported user-authored relation.
  if(value==null||value.length===0)return[];
  const validator=progression;
  const checked=validator?.validateRelations?.(value,{slots:program});
  if(!checked?.ok&&options.preserveInvalid&&value!=null&&Array.isArray(options.incompatibilities))
    options.incompatibilities.push(progressionIncompatibility("relations",value,checked,options.source));
  return checked?.ok?cloneSnapshot(checked.value):[]}

function candidateProgressionData(value,program,existing=[],source="candidate"){
  const incompatibilities=Array.isArray(existing)?cloneSnapshot(existing):[];
  const relations=normalizeProgressionRelations(value,program,{preserveInvalid:true,incompatibilities,source});
  return{relations,incompatibilities}}

function normalizeProgressionModifiers(value,options={}){
  if(value!=null&&!Array.isArray(value))throw new TypeError("progressionModifiers: expected array");
  if(value!=null&&!isBoundedProgressionValue(value))throw new TypeError("progressionModifiers: structure exceeds safety bounds");
  if(value==null||value.length===0)return[];
  const validator=progression;
  const checked=validator?.validateModifiers?.(value);
  if(!checked?.ok&&options.preserveInvalid&&value!=null&&Array.isArray(options.incompatibilities))
    options.incompatibilities.push(progressionIncompatibility("modifiers",value,checked,options.source));
  return checked?.ok?cloneSnapshot(checked.value):[]}

/* ============================================================
   Program model
   Exercise — one movement: day, sequence, rep range, muscles.
   Program — the whole split. Single source of truth for editing,
   ordering, day grouping, and the weekly volume audit. Persisted
   as plain objects (see toJSON) so backups stay forward-compatible.
   ============================================================ */

function snapshotLookup(customList){
  const own=new Map((Array.isArray(customList)?customList:[]).map(e=>[e.id,e]));
  return id=>{
    const key=String(id??"");
    if(isCustomLibraryId(key))return own.get(key)||null;
    return LIBRARY_BY_ID.get(key)||LIBRARY_BY_ID.get(LEGACY_LIBRARY_IDS[key])||null}}

function canonicalizeLinkedMuscleRows(list,customList){
  if(!Array.isArray(list))return list;
  const lookup=snapshotLookup(customList);
  return list.map(row=>{
    if(!isPlainStateObject(row)||row.libraryId==null)return row;
    const entry=lookup(row.libraryId);
    return entry?{...row,primary:libraryMuscleAttribution(entry,"primary"),
      secondary:libraryMuscleAttribution(entry,"secondary")}:row})}

function canonicalizeProgramStructureMuscles(structure,program,customList=[]){
  if(!isPlainStateObject(structure))return structure;
  const bySlot=new Map();
  for(const row of Array.isArray(program)?program:[]){
    for(const id of [row?.slotId,row?.id])
      if(id!=null&&!bySlot.has(String(id)))bySlot.set(String(id),row)}
  const out=cloneSnapshot(structure);
  for(const week of Array.isArray(out.weekPrescriptions)?out.weekPrescriptions:[])
    for(const day of Array.isArray(week?.days)?week.days:[])
      for(const slot of Array.isArray(day?.slots)?day.slots:[]){
        const row=bySlot.get(String(slot?.slotId));
        if(!row)continue;
        if(Object.prototype.hasOwnProperty.call(slot,"primary"))slot.primary=row.primary||"";
        if(Object.prototype.hasOwnProperty.call(slot,"secondary"))slot.secondary=row.secondary||""}
  for(const version of Array.isArray(out.programVersions)?out.programVersions:[])
    if(Array.isArray(version?.program))
      version.program=canonicalizeLinkedMuscleRows(version.program,customList);
  return out}

function canonicalizeDurableMuscleAttributions(proposal){
  if(!isPlainStateObject(proposal))return proposal;
  const out=cloneSnapshot(proposal),customList=out.customExercises;
  out.program=canonicalizeLinkedMuscleRows(out.program,customList);
  if(isPlainStateObject(out.programMeta)&&out.programMeta.programStructure)
    out.programMeta.programStructure=canonicalizeProgramStructureMuscles(
      out.programMeta.programStructure,out.program,customList);
  // programHistory is an immutable archive. Its rows and structure already
  // carry the attribution captured at archive creation; current custom
  // definitions may update active linked rows only.
  return out}

function normalizeCustomExercises(list){
  const out=[],seen=new Set();
  for(const entry of Array.isArray(list)?list:[]){
    if(!isPlainStateObject(entry))continue;
    const id=String(entry.id||"");
    if(!id.startsWith(CUSTOM_ID_PREFIX)||seen.has(id))continue;
    const name=String(entry.name??"").trim();
    if(!name)continue;
    seen.add(id);
    const equipment=(Array.isArray(entry.equipment)?entry.equipment:[])
      .map(x=>String(x).trim().toLowerCase()).filter(Boolean);
    const archived=entry.archived===true;
    const primary=normalizeMuscleAttribution(entry.primary??"",`${id}.primary`);
    const secondary=normalizeMuscleAttribution(entry.secondary??"",`${id}.secondary`);
    out.push({id,name,namePt:String(entry.namePt??name).trim()||name,archived,
      equipment:equipment.length?equipment:["machine"],
      primary,secondary,
      notes:String(entry.notes??"").trim(),
      patterns:[],beginnerFriendly:true,custom:true,
      created:typeof entry.created==="string"?entry.created:requiredNow(),
      // A custom movement's configured metric composition is its identity for
      // logging; keep it whenever it is a valid ordered definition list.
      ...(()=>{const checked=ExerciseMetrics?.validateDefinitions?.(entry.metricIds,entry.metricDefinitions,{allowEmpty:true});
        return checked?.ok&&Array.isArray(entry.metricIds)
          ?{metricIds:cloneSnapshot(entry.metricIds),metricDefinitions:cloneSnapshot(entry.metricDefinitions)}:{}})()})}
  return out}

function canonicalTransitionProgram(program, customExercises) {
  const rows = new Program(program, snapshotLookup(customExercises)).toJSON();
  return rows.map(row => {
    const canonical = cloneSnapshot(row);
    // Compiler pattern labels are derived display data. Linked durable rows
    // resolve those labels from the catalogue; identity and every authored
    // field (including notes, sets, progression, and slot placement) remain.
    delete canonical.primary;
    delete canonical.secondary;
    return canonical;
  });
}

function compilerProgramMatchesLive(liveProgram, compilerProgram, customExercises) {
  try {
    return JSON.stringify(canonicalize(canonicalTransitionProgram(liveProgram, customExercises))) ===
      JSON.stringify(canonicalize(canonicalTransitionProgram(compilerProgram, customExercises)));
  } catch {
    return false;
  }
}
// Exact, read-only classification of a stored transition-in against a proposal.
// "match" -> already committed (return success, no mutation); "conflict" -> the
// stored record is partial or disagrees (typed invalid, never success);
// "absent" -> no transition-in and no archive collision, proceed to the
// transaction.

function structureDayLabels(meta){
  // A canonical program orders its days as authored, not alphabetically.
  const canonical=meta?.programDefinition?.days;
  if(Array.isArray(canonical)){
    const labels=canonical.filter(day=>day?.kind==="training").map(day=>String(day.name||"").trim()).filter(Boolean);
    if(labels.length)return labels}
  const days=meta?.programStructure?.days;
  if(!Array.isArray(days)||!days.length)return null;
  const labels=days.map(d=>String(d.label||d.dayId||"").trim()).filter(Boolean);
  return labels.length?labels:null}

function makeProgram(list,lookup=null,meta=null){
  return new Program(list,lookup,structureDayLabels(meta),
    meta?.programStructure?.provenance?.source==="manual_build")}
// Progress needs the exact historical volume facts and a sparse schedule
// projection for any explicit future overrides. The aggregate below owns
// elapsed denominators; normal current/future weeks continue to come from the
// authored program, so a block's size no longer scales with rows × weeks.

function prescriptionProgramRows(program){
  return(Array.isArray(program)?program:[]).map((row,index)=>({
    id:String(row?.id||`legacy_${index+1}`),
    slotId:String(row?.slotId||row?.id||`legacy_${index+1}`),
    dayId:String(row?.dayId||row?.day||`day_${index+1}`),
    day:String(row?.day||""),
    order:Number.isFinite(+row?.order)?+row.order:index+1,
    sets:Number.isFinite(+row?.sets)?Math.max(0,+row.sets):0,
    primary:String(row?.primary||""),
    secondary:String(row?.secondary||"")
  })).filter(row=>row.id||row.slotId)}

function existingPrescriptionSlots(existing){
  const slots=new Map();
  for(const day of Array.isArray(existing?.days)?existing.days:[])
    for(const slot of Array.isArray(day?.slots)?day.slots:[])
      if(slot?.slotId!=null)slots.set(String(slot.slotId),slot);
  return slots}

function plannedPrescriptionForProgram(program,week,existing,{preserveSets=true}={}){
  const days=new Map(),existingSlots=existingPrescriptionSlots(existing);
  for(const row of prescriptionProgramRows(program).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id))){
    const dayId=row.dayId||row.day||`day_${days.size+1}`;
    if(!days.has(dayId))days.set(dayId,{dayId,slots:[]});
    const prior=existingSlots.get(row.slotId);
    const sets=preserveSets&&Number.isFinite(+prior?.sets)?Math.max(0,+prior.sets):row.sets;
    const primary=preserveSets&&typeof prior?.primary==="string"?prior.primary:row.primary;
    const secondary=preserveSets&&typeof prior?.secondary==="string"?prior.secondary:row.secondary;
    days.get(dayId).slots.push({slotId:row.slotId,sets,primary,secondary});
  }
  return{week,phase:typeof existing?.phase==="string"?existing.phase:"manual_edit",days:[...days.values()]}}

function preservePrescriptionReceipt(existing,program,week){
  if(!existing||!Array.isArray(existing.days))return null;
  const sourceSlots=new Map(prescriptionProgramRows(program).map(row=>[row.slotId,row]));
  const days=[];
  for(const day of existing.days){
    if(!day||typeof day.dayId!=="string"||!Array.isArray(day.slots))return null;
    const slots=[];
    for(const slot of day.slots){
      if(!slot||typeof slot.slotId!=="string"||!Number.isInteger(slot.sets)||slot.sets<0)return null;
      const source=sourceSlots.get(slot.slotId);
      slots.push({slotId:slot.slotId,sets:slot.sets,
        primary:typeof slot.primary==="string"?slot.primary:source?.primary||"",
        secondary:typeof slot.secondary==="string"?slot.secondary:source?.secondary||""});
    }
    days.push({dayId:day.dayId,slots});
  }
  return{week,phase:typeof existing.phase==="string"?existing.phase:"manual_edit",days}
}

function emptyPlannedVolumeHistory(){
  return{schemaVersion:1,throughWeek:0,plannedSessions:0,plannedWorkingSets:0,
    muscles:{direct:{},secondary:{}}}}

function addPlannedVolumeHistory(history,prescription){
  history.plannedSessions+=Number.isFinite(+prescription?.plannedSessions)?Math.max(0,+prescription.plannedSessions):0;
  history.plannedWorkingSets+=Number.isFinite(+prescription?.plannedWorkingSets)?Math.max(0,+prescription.plannedWorkingSets):0;
  for(const [name,value] of Object.entries(prescription?.musclesByName||{})){
    const direct=Number.isFinite(+value?.d)?Math.max(0,+value.d):0;
    const secondary=Number.isFinite(+value?.p)?Math.max(0,+value.p):0;
    if(direct)history.muscles.direct[name]=(history.muscles.direct[name]||0)+direct;
    if(secondary)history.muscles.secondary[name]=(history.muscles.secondary[name]||0)+secondary;
  }
}

function plannedVolumeHistoryTarget(meta,total){
  if(meta?.mesocycleStatus==="completed")return total;
  const elapsed=mesocycleLifecycle(meta).elapsedWeek;
  return Number.isInteger(elapsed)?Math.max(0,Math.min(total,elapsed-1)):0;
}

function prescriptionWeekNumber(entry,index){
  return Number.isInteger(entry?.week)&&entry.week>=1?entry.week:index+1}

function receiptHasMuscleAttribution(entry){
  return(Array.isArray(entry?.days)?entry.days:[]).some(day=>(Array.isArray(day?.slots)?day.slots:[])
    .some(slot=>typeof slot?.primary==="string"||typeof slot?.secondary==="string"))}

function isSparsePrescriptionOverride(entry){
  const phase=String(entry?.phase||"").trim();
  return!!phase&&!['normal','manual_edit'].includes(phase);
}

function historicalPrescriptionForWeek(existing,versions,program,week,recoveryRecord){
  const version=[...versions].reverse().find(entry=>entry.fromWeek<=week);
  const sourceProgram=Array.isArray(version?.program)?version.program:program;
  const receipt=preservePrescriptionReceipt(existing,sourceProgram,week)||
    plannedPrescriptionForProgram(sourceProgram,week,null);
  return week===1?recoveryReceiptForWeek(receipt,recoveryRecord):receipt;
}

function compactProgramPrescriptionState(structure,program,meta,{pastProgram=null,previousMeta=null,force=false,recoveryRecord=null,freezeHistory=false}={}){
  const source=structure&&typeof structure==="object"&&!Array.isArray(structure)
    ?cloneSnapshot(structure):{};
  const rawWeeks=Array.isArray(source.weekPrescriptions)?source.weekPrescriptions:[];
  const rawVersions=Array.isArray(source.programVersions)?source.programVersions:[];
  const configured=Math.max(1,Math.min(52,Math.round(Number(meta?.mesocycleLengthWeeks)||6)));
  const observedWeeks=rawWeeks.map((entry,index)=>prescriptionWeekNumber(entry,index))
    .concat(rawVersions.map(entry=>Number.isInteger(entry?.fromWeek)?entry.fromWeek:0));
  const total=Math.max(configured,...observedWeeks.filter(week=>week>=1&&week<=52),1);
  const existingWeeks=new Map(rawWeeks.map((entry,index)=>[prescriptionWeekNumber(entry,index),entry])
    .filter(([week])=>week>=1&&week<=total));
  const versions=rawVersions.filter(entry=>Number.isInteger(entry?.fromWeek)&&entry.fromWeek>=1&&
    entry.fromWeek<=total&&Array.isArray(entry.program)).sort((a,b)=>a.fromWeek-b.fromWeek);
  const existingHistory=isValidPlannedVolumeHistory(meta?.plannedVolumeHistory)
    ?cloneSnapshot(meta.plannedVolumeHistory):null;
  // An old archive may predate the compact aggregate. It is still a
  // historical snapshot, so keep its bounded legacy receipts intact rather
  // than projecting an unknown horizon from today's clock or silently
  // discarding versioned prescription facts.
  if(freezeHistory&&!existingHistory){
    source.weekPrescriptions=cloneSnapshot(rawWeeks);
    if(rawVersions.length)source.programVersions=cloneSnapshot(rawVersions);
    return{structure:source,history:null};
  }
  const shouldCompact=force||existingHistory!=null||versions.length>0||rawWeeks.some(receiptHasMuscleAttribution);
  if(!shouldCompact){
    source.weekPrescriptions=cloneSnapshot(rawWeeks);
    delete source.programVersions;
    return{structure:source,history:null};
  }
  const history=existingHistory||emptyPlannedVolumeHistory();
  const historicalProgram=Array.isArray(pastProgram)?pastProgram:program;
  const sourceMeta=previousMeta||meta;
  const target=freezeHistory
    ?history.throughWeek
    :Math.max(history.throughWeek,plannedVolumeHistoryTarget(sourceMeta,total));
  const appliedRecovery=recoveryRecord;
  for(let week=history.throughWeek+1;week<=target;week++){
    const receipt=historicalPrescriptionForWeek(existingWeeks.get(week),versions,historicalProgram,week,appliedRecovery);
    addPlannedVolumeHistory(history,prescriptionForReceipt(receipt,historicalProgram));
    history.throughWeek=week;
  }
  const retained=[];
  rawWeeks.forEach((entry,index)=>{
    const week=prescriptionWeekNumber(entry,index);
    if(week<=target||!isSparsePrescriptionOverride(entry))return;
    const normalized=preservePrescriptionReceipt(entry,program,week);
    if(normalized)retained.push(normalized);
  });
  retained.sort((a,b)=>a.week-b.week);
  source.weekPrescriptions=retained;
  const hasFutureLegacyVersion=rawVersions.some(entry=>Number.isInteger(entry?.fromWeek)&&entry.fromWeek>target);
  if(hasFutureLegacyVersion)source.programVersions=cloneSnapshot(rawVersions);
  else delete source.programVersions;
  return{structure:source,history:history.throughWeek>0||existingHistory?history:null};
}
/* A programStructure names its definition's training days, in order (#388).
   Entries that still match a training day keep their identity; any other day
   list is rebuilt from the definition, whose generated names localize. */

function programStructureForDefinition(structure,definition){
  if(!isPlainStateObject(structure)||!Array.isArray(structure.days)||!Array.isArray(definition?.days))return structure;
  const names=definition.days.filter(day=>day?.kind==="training").map(day=>({id:day.id,name:String(day.name||"")}));
  const labelOf=entry=>String(entry?.label||entry?.dayId||"");
  if(structure.days.length===names.length&&structure.days.every((entry,i)=>labelOf(entry)===names[i].name))return structure;
  const byLabel=new Map(structure.days.map(entry=>[labelOf(entry),entry]));
  return{...structure,days:names.map(({id,name},i)=>byLabel.has(name)
    ?{...cloneSnapshot(byLabel.get(name)),order:i+1}:{dayId:id,label:name,order:i+1})}}
/* A Review successor is a new block of a regenerated definition: it keeps the
   structure's provenance but none of the predecessor's days or receipts. */

function successorProgramStructure(structure,definition){
  if(!isPlainStateObject(structure))return structure??null;
  const{weekPrescriptions,programVersions,...rest}=cloneSnapshot(structure);
  return programStructureForDefinition({...rest,days:[]},definition)}

function isValidPlannedVolumeHistory(value){
  if(!isPlainStateObject(value)||!isBoundedProgressionValue(value)||
    Object.keys(value).length!==PLANNED_VOLUME_HISTORY_KEYS.length||
    !PLANNED_VOLUME_HISTORY_KEYS.every(key=>Object.prototype.hasOwnProperty.call(value,key))||
    value.schemaVersion!==1||!Number.isInteger(value.throughWeek)||value.throughWeek<0||value.throughWeek>52||
    !Number.isFinite(value.plannedSessions)||value.plannedSessions<0||
    !Number.isFinite(value.plannedWorkingSets)||value.plannedWorkingSets<0||
    !isPlainStateObject(value.muscles)||Object.keys(value.muscles).length!==PLANNED_VOLUME_HISTORY_MUSCLE_KEYS.length||
    !PLANNED_VOLUME_HISTORY_MUSCLE_KEYS.every(key=>Object.prototype.hasOwnProperty.call(value.muscles,key)))return false;
  return PLANNED_VOLUME_HISTORY_MUSCLE_KEYS.every(kind=>{
    const map=value.muscles[kind];
    if(!isPlainStateObject(map)||Object.keys(map).length>MuscleDomain.MUSCLE_TOKENS.length)return false;
    return Object.entries(map).every(([name,amount])=>name&&name.length<=PROGRESSION_VALUE_LIMITS.stringLength&&
      MuscleDomain?.isMuscleToken?.(name)&&Number.isFinite(amount)&&amount>=0);
  });
}

function mesocycleLifecycle(programMeta){
  const meta=programMeta||{},total=+meta.mesocycleLengthWeeks||6,s=meta.started;
  let elapsedWeek=null;
  if(s){const days=calendarDayDistance(s,today());
    elapsedWeek=days<0?1:Math.floor(days/7)+1}
  const current=elapsedWeek==null?null:Math.min(elapsedWeek,total);
  const overrunWeeks=elapsedWeek==null?0:Math.max(0,elapsedWeek-total);
  const isFinalWeek=elapsedWeek!=null&&elapsedWeek>=total;
  const isComplete=meta.mesocycleStatus==="completed";
  return{elapsedWeek,current,total,overrunWeeks,isFinalWeek,isComplete}}
/** Q617: extended past the planned length; complete in or after the final
 *  week; partial at least halfway; otherwise early. */

function prescriptionForReceipt(receipt,program=[]){
  const musclesByName=new Map(),days=Array.isArray(receipt?.days)?receipt.days:[];
  const bySlot=new Map(prescriptionProgramRows(program).map(row=>[row.slotId,row]));
  const add=(name,d,p)=>{for(const muscle of muscles(name)){const key=String(muscle||"").trim();if(!key)continue;
    const current=musclesByName.get(key)||{d:0,p:0};current.d+=d;current.p+=p;musclesByName.set(key,current)}};
  let plannedWorkingSets=0;
  for(const day of days)for(const slot of Array.isArray(day?.slots)?day.slots:[]){
    const sets=Number.isFinite(+slot?.sets)?Math.max(0,+slot.sets):0;
    const authored=bySlot.get(String(slot?.slotId));
    const primary=typeof slot?.primary==="string"?slot.primary:authored?.primary;
    const secondary=typeof slot?.secondary==="string"?slot.secondary:authored?.secondary;
    plannedWorkingSets+=sets;add(primary,sets,0);add(secondary,0,sets*.5)}
  return{plannedSessions:days.filter(day=>Array.isArray(day?.slots)&&day.slots.length).length,
    plannedWorkingSets,musclesByName:volMapToObj(musclesByName)}}

function recoveryReceiptForWeek(receipt,record){
  if(!record)return receipt;
  const bySlot=new Map((record.diff?.recoveryWeek?.entries||[])
    .map(entry=>[String(entry.slot),Number.isFinite(+entry.effectiveWorkingSets)?Math.max(0,+entry.effectiveWorkingSets):0]));
  if(!bySlot.size)return receipt;
  return{...receipt,phase:"recovery",days:(Array.isArray(receipt?.days)?receipt.days:[]).map(day=>({...day,
    slots:(Array.isArray(day?.slots)?day.slots:[]).map(slot=>bySlot.has(String(slot?.slotId))
      ?{...slot,sets:bySlot.get(String(slot.slotId))}:slot)}))}}

function addVol(m,k,d,p){if(!m.has(k))m.set(k,{d:0,p:0});m.get(k).d+=d;m.get(k).p+=p}

class Exercise{
  constructor(d={}){
    this.id=d.id||uid();
    if(d.slotId!=null&&String(d.slotId).trim())this.slotId=String(d.slotId).trim();
    if(d.dayId!=null&&String(d.dayId).trim())this.dayId=String(d.dayId).trim();
    this.day=String(d.day??"").trim()||"Day 1";
    this.order=Number.isFinite(+d.order)?+d.order:1;
    this.name=String(d.name??"").trim()||"Exercise";
    this.sets=Exercise.posInt(d.sets,2);
    this.hasRepTarget=d.hasRepTarget===false?false:
      d.hasRepTarget===true||Number.isFinite(Number(d.min))||Number.isFinite(Number(d.max));
    this.min=Exercise.posInt(d.min,4);
    this.max=Math.max(this.min,Exercise.posInt(d.max,8));
    this.primary=String(d.primary??"");
    this.secondary=String(d.secondary??"");
    this.notes=String(d.notes??"").trim();
    this.alternates=Array.isArray(d.alternates)?d.alternates.map(s=>String(s).trim()).filter(Boolean):
      typeof d.alternates==="string"?d.alternates.split(",").map(s=>s.trim()).filter(Boolean):[];
    if(d.libraryId!=null)this.libraryId=String(d.libraryId).trim();
    if(d.movementId!=null&&String(d.movementId).trim())this.movementId=String(d.movementId).trim();
    else if(d.libraryId==null)this.movementId=`slot:${this.id}`;
    // An alias names the machine in front of the lifter ("Hammer Strength row")
    // without claiming the slot is a different movement. Identity stays with
    // libraryId; only the label moves.
    if(d.displayName!=null&&String(d.displayName).trim())this.displayName=String(d.displayName).trim();
    if(d.progressionType!=null){
      const progressionType=String(d.progressionType).trim();
      if(Array.from(progressionType).length>80)throw new TypeError("progressionType: string too long");
      if(progressionType)this.progressionType=progressionType}
    if(d.targetRirStart!=null&&Number.isFinite(+d.targetRirStart))this.targetRirStart=+d.targetRirStart;
    if(d.targetRirEnd!=null&&Number.isFinite(+d.targetRirEnd))this.targetRirEnd=+d.targetRirEnd;
    if(d.minSets!=null&&Number.isFinite(+d.minSets)&&+d.minSets>0)this.minSets=Math.round(+d.minSets);
    if(d.maxSets!=null&&Number.isFinite(+d.maxSets)&&+d.maxSets>0)this.maxSets=Math.round(+d.maxSets);
    if(d.priority!=null)this.priority=String(d.priority).trim();
    if(["known_grid","bodyweight","ordinal","external_unknown"].includes(d.loadingMode))this.loadingMode=d.loadingMode;
    if(d.loadIncrement!=null&&Number.isFinite(+d.loadIncrement)&&+d.loadIncrement>0)this.loadIncrement=+d.loadIncrement;
    if(d.progression!=null){
      if(!isBoundedProgressionValue(d.progression))throw new TypeError("progression: structure exceeds safety bounds");
      const progression=normalizeProgressionEnvelope(d.progression);
      if(progression)this.progression=progression;
      else this.progressionIncompatibility=progressionIncompatibility("prescription",d.progression,null,"program-json");
    }
    if(d.progressionIncompatibility!=null&&!this.progression){
      if(!isBoundedProgressionValue(d.progressionIncompatibility))throw new TypeError("progressionIncompatibility: structure exceeds safety bounds");
      this.progressionIncompatibility=cloneSnapshot(d.progressionIncompatibility);
    }
  }
  static posInt(v,fallback){const n=Math.round(+v);return Number.isFinite(n)&&n>0?n:fallback}
  /* Resolves a linked slot's label and muscles from the library definition, so
     the stored template can never disagree with the id it carries. name and
     primary/secondary stay written out as plain strings — every reader (volume
     audit, CSV, text export, backups) keeps working unchanged — but for a
     linked slot they are derived, not authored. */
  resolveIdentity(entries,{preserveLinkedSnapshot=false}={}){
    if(this.libraryId===undefined||preserveLinkedSnapshot)return this;
    const entry=entries?entries(this.libraryId):libraryEntry(this.libraryId);
    if(!entry){
      // The definition is gone (an import or older install referencing an
      // unknown id). Keep the exact identity and copied facts so management
      // surfaces can fail closed and offer an explicit repair. Share owns the
      // diagnosis; no reader may silently turn this into a different movement.
      return this}
    // The stored name is the canonical one; display localizes it (RF-10), so
    // switching language never rewrites a program or its fingerprint.
    this.name=this.displayName||entry.name;
    this.primary=libraryMuscleAttribution(entry,"primary");
    this.secondary=libraryMuscleAttribution(entry,"secondary");
    return this}
  toJSON(){const o={id:this.id,day:this.day,order:this.order,name:this.name,sets:this.sets,primary:this.primary,secondary:this.secondary,notes:this.notes,alternates:this.alternates};
    if(!this.hasRepTarget)o.hasRepTarget=false;
    if(this.hasRepTarget){o.min=this.min;o.max=this.max}
    if(this.slotId!==undefined)o.slotId=this.slotId;
    if(this.dayId!==undefined)o.dayId=this.dayId;
    if(this.libraryId!==undefined)o.libraryId=this.libraryId;
    if(this.movementId!==undefined)o.movementId=this.movementId;
    if(this.displayName!==undefined)o.displayName=this.displayName;
    if(this.progressionType!==undefined)o.progressionType=this.progressionType;
    if(this.targetRirStart!==undefined)o.targetRirStart=this.targetRirStart;
    if(this.targetRirEnd!==undefined)o.targetRirEnd=this.targetRirEnd;
    if(this.minSets!==undefined)o.minSets=this.minSets;
    if(this.maxSets!==undefined)o.maxSets=this.maxSets;
    if(this.priority!==undefined)o.priority=this.priority;
    if(this.loadingMode!==undefined)o.loadingMode=this.loadingMode;
    if(this.loadIncrement!==undefined)o.loadIncrement=this.loadIncrement;
    if(this.progression!==undefined)o.progression=cloneSnapshot(this.progression);
    if(this.progressionIncompatibility!==undefined)o.progressionIncompatibility=cloneSnapshot(this.progressionIncompatibility);
    return o}
}

class Program{
  /* lookup lets a caller resolve against a snapshot's own custom definitions —
     import and normalizeLoaded work on state that is not live yet.
     structureDays (optional) keeps empty programStructure containers visible. */
  constructor(list=[],lookup=null,structureDays=null,emptyDayContainers=false,options={}){const ids=new Set();
    const preserveLinkedSnapshot=options?.preserveLinkedSnapshot===true;
    this._lookup=lookup;
    this.exercises=(Array.isArray(list)?list:[]).map(e=>{const ex=new Exercise(e);if(ids.has(ex.id))ex.id=uid();ids.add(ex.id);
      return ex.resolveIdentity(lookup,{preserveLinkedSnapshot})});
    this._structureDays=Array.isArray(structureDays)&&structureDays.length
      ?structureDays.map(d=>String(d)).filter(Boolean):null;
    this._emptyDayContainers=emptyDayContainers===true;
    this.renumber()}
  days(){
    const fromEx=[...new Set(this.exercises.map(e=>e.day))];
    if(!this._structureDays)return fromEx.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    const out=[],seen=new Set();
    for(const d of this._structureDays){if(!d||seen.has(d))continue;seen.add(d);out.push(d)}
    for(const d of fromEx.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))){
      if(seen.has(d))continue;seen.add(d);out.push(d)}
    return out}
  forDay(d){return this.exercises.filter(e=>e.day===d).sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name))}
  find(id){return this.exercises.find(e=>e.id===id)}
  renumber(){for(const d of this.days())this.forDay(d).forEach((e,i)=>e.order=i+1)}
  toJSON(){return this.exercises.map(e=>e.toJSON())}
  update(id,field,value){const e=this.find(id);if(!e)return;
    if(field==="sets")e.sets=Exercise.posInt(value,e.sets);
    else if(field==="min"){e.hasRepTarget=true;e.min=Exercise.posInt(value,e.min);if(e.max<e.min)e.max=e.min;}
    else if(field==="max"){e.hasRepTarget=true;e.max=Exercise.posInt(value,e.max);if(e.min>e.max)e.min=e.max;}
    else if(field==="alternates")e.alternates=String(value??"").split(",").map(s=>s.trim()).filter(Boolean);
    else if(field==="name"){
      const next=String(value??"").trim();
      // On a linked slot a rename is an alias, never a change of movement: the
      // canonical name comes back if the alias is cleared or matches it.
      if(e.libraryId!==undefined){
        const entry=this._lookup?this._lookup(e.libraryId):libraryEntry(e.libraryId);
        if(entry&&next&&next!==libraryName(entry))e.displayName=next;
        else delete e.displayName;
        e.resolveIdentity(this._lookup);
        return}
      e.name=next}
    else if(field==="primary"||field==="secondary"){
      // Muscles are the definition's, not the slot's. A linked slot ignores
      // the edit; the editor disables the field and offers Detach instead.
      if(e.libraryId!==undefined)return;
      e[field]=String(value??"").trim()}
    else if(field==="notes")e.notes=String(value??"").trim();}
  /* Breaks the library link, keeping the movement exactly as it reads today.
     The slot becomes plain editable text — which is what a lifter asking to
     change a canonical movement's muscles actually wants. */
  detachExercise(id){const e=this.find(id);if(!e||e.libraryId===undefined)return null;
    e.movementId=`library:${e.libraryId}`;delete e.libraryId;delete e.displayName;return e}
  addExercise(day,entry=null){const order=Math.max(0,...this.forDay(day).map(e=>e.order))+1;
    const e=new Exercise(Object.assign({day,order,name:t("program.default.exercise"),sets:3,min:6,max:10},
      entry?exerciseFieldsFromLibrary(entry):null));this.exercises.push(e);return e}
  /* Repoints a structural slot at another movement. The slot id stays stable so
     draft inputs and ordering survive; movement history is keyed independently. */
  replaceExercise(id,entry){const e=this.find(id);if(!e||!entry)return null;
    delete e.displayName;delete e.movementId;
    Object.assign(e,exerciseFieldsFromLibrary(entry));
    if(e.max<e.min)e.max=e.min;
    return e}
  removeExercise(id){this.exercises=this.exercises.filter(e=>e.id!==id);this.renumber()}
  move(id,dir){const e=this.find(id);if(!e)return;const list=this.forDay(e.day),i=list.indexOf(e),j=i+dir;
    if(j<0||j>=list.length)return;[list[i].order,list[j].order]=[list[j].order,list[i].order]}
  addDay({withPlaceholder}={}){const ds=this.days();let n=ds.length+1,name=`Day ${n}`;while(ds.includes(name))name=`Day ${++n}`;
    const placeholder=withPlaceholder!=null?!!withPlaceholder:!this._emptyDayContainers;
    if(placeholder)this.exercises.push(new Exercise({day:name,order:1,name:t("program.default.exercise"),sets:3,min:6,max:10}));
    if(this._structureDays)this._structureDays.push(name);
    return name}
  renameDay(oldName,newName){const nv=String(newName).trim();if(!nv||nv===oldName)return false;
    if(this.days().includes(nv))return false;
    for(const e of this.exercises)if(e.day===oldName)e.day=nv;
    if(this._structureDays){
      const idx=this._structureDays.indexOf(oldName);
      if(idx>=0)this._structureDays[idx]=nv}
    this.renumber();return true}
  removeDay(d){this.exercises=this.exercises.filter(e=>e.day!==d);
    if(this._structureDays)this._structureDays=this._structureDays.filter(x=>x!==d)}
  volume(){const m=new Map();for(const e of this.exercises){
    for(const x of muscles(e.primary))addVol(m,x,e.sets,0);
    for(const x of muscles(e.secondary))addVol(m,x,0,e.sets*.5)}return m}
}


function syncProgramStructureFromProgram(proposal,program,previousProgram=null,previousMeta=null,{recoveryRecord=null}={}){
  const struct=proposal.programMeta?.programStructure;
  if(!struct||!Array.isArray(struct.days))return;
  const labels=program._structureDays&&program._structureDays.length
    ?program._structureDays.slice():program.days();
  const byLabel=new Map(struct.days.map(d=>[d.label,d]));
  const byIndex=struct.days.slice();
  const synced={
    ...cloneSnapshot(struct),
    days:labels.map((label,i)=>{
      const prev=byLabel.get(label)||byIndex[i];
      const dayId=prev?.dayId||`manual_d${i+1}`;
      const displayNameKey=prev?.displayNameKey||Compiler?.dayDisplayNameKey?.(dayId);
      const previousLabel=String(prev?.label||"");
      const override=typeof prev?.nameOverride==="string"&&prev.nameOverride.trim()
        ?prev.nameOverride:"";
      // A rename changes the row grouping label, but not the generated day's
      // identity. Once a generated label diverges, remember the exact text so
      // a later language switch cannot replace it with the default translation.
      const nameOverride=displayNameKey&&previousLabel&&label!==previousLabel
        ?label:override;
      return{dayId,label,order:i+1,
        ...(displayNameKey?{displayNameKey}:{}),
        ...(nameOverride?{nameOverride}:{})}})};
  const sourceMeta=previousMeta||proposal.programMeta;
  const compacted=compactProgramPrescriptionState(synced,program.toJSON(),proposal.programMeta||sourceMeta,
    previousProgram?{pastProgram:previousProgram,previousMeta:sourceMeta,force:true,recoveryRecord}:{recoveryRecord});
  proposal.programMeta.programStructure=compacted.structure;
  if(compacted.history)proposal.programMeta.plannedVolumeHistory=compacted.history;
  else delete proposal.programMeta.plannedVolumeHistory;
}

return Object.freeze({syncProgramStructureFromProgram,rawMetricDefinitions,normalizeMuscleAttribution,sourceFeatureAttribution,libraryMuscleAttribution,exerciseFieldsFromLibrary,compilerCustomDefinitions,canonicalProgramDefinition,definitionMovementIds,manualAttributionFor,manualProgramDefinitionFromRows,durableProgramRows,flatProgramFromDefinition,normalizeProgressionEnvelope,progressionIncompatibility,normalizeProgressionRelations,candidateProgressionData,normalizeProgressionModifiers,snapshotLookup,canonicalizeLinkedMuscleRows,canonicalizeProgramStructureMuscles,canonicalizeDurableMuscleAttributions,normalizeCustomExercises,compilerProgramMatchesLive,structureDayLabels,makeProgram,prescriptionProgramRows,existingPrescriptionSlots,plannedPrescriptionForProgram,preservePrescriptionReceipt,emptyPlannedVolumeHistory,addPlannedVolumeHistory,plannedVolumeHistoryTarget,prescriptionWeekNumber,receiptHasMuscleAttribution,isSparsePrescriptionOverride,historicalPrescriptionForWeek,compactProgramPrescriptionState,programStructureForDefinition,successorProgramStructure,isValidPlannedVolumeHistory,mesocycleLifecycle,prescriptionForReceipt,recoveryReceiptForWeek,addVol,Program,Exercise,isCustomLibraryId});
}
