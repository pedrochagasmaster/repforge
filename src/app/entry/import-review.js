import {cloneSnapshot,foldExerciseName} from '../../training/model.js';
/** @typedef {ReturnType<typeof import('../../training/model.js').createProgramModel>} Model
 * @typedef {ReturnType<typeof import('../custom-import.js').createCustomDefinitionImport>} CustomImport
 * @typedef {import('../../interchange/program-file.js').ProgramSource} Source
 * @typedef {import('../../training/model.js').ExerciseInput} Exercise
 * @typedef {import('../../persistence/contracts.js').CustomExercise} Custom
 * @typedef {import('../../persistence/contracts.js').StoredSnapshot} Snapshot
 * @typedef {import('../../training/model.js').LibraryEntry & {aliases?:string[],rank?:number,archived?:boolean}} Candidate
 * @typedef {{key:string,raw:Exercise,status:string,match:Candidate|null,shortlist:Candidate[],decision:string,reviewed:boolean,expanded?:boolean,createdCustom?:Candidate,createdCustomId?:string}} Row
 * @typedef {{fileName:string,format:string,legacy:boolean,meta:unknown,customExercises:unknown[],rows:Row[],definition?:import('../../training/model.js').ProgramDefinition,sourceType?:string,notImported?:string[],originalText?:string,fromFirstRun?:boolean,onboarding?:boolean}} Review
 */
/** Program import review rules. Matching suggests identities; only explicit
 * decisions authorize candidate construction. No training snapshot is mutated.
 * @param {{model:Model,imports:CustomImport,library:Candidate[]}} bindings */
export function createProgramImport({model,imports,library}){
 const IMPORT_EXACT='exact',IMPORT_ALIAS='alias',IMPORT_PROBABLE='probable',IMPORT_UNMATCHED='unmatched';
/** @param {unknown} value @returns {value is Record<string,unknown>} */
const isRecord=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
/** @param {unknown} value @returns {Record<string,unknown>} */
const record=value=>isRecord(value)?value:{};
/* Words that survive the length filter but carry no movement signal. The
   Portuguese "com" is the expensive one: it made every barbell movement share a
   token with "Hip thrust com barra", so thirty-six entries tied at 0.50 and
   array order picked the winner. */
const MATCH_STOPWORDS=new Set([
  "com","sem","para","por","dos","das","nos","nas","que","seu","sua","pes",
  "the","and","for","with","your","from","into"]);
/* Equipment still informs a match; it must never decide one alone. Scored at a
   fraction of a movement token, then used to break ties, where it is the
   difference between "Hip thrust na maquina" reaching the machine or the bar. */
const MATCH_EQUIPMENT=new Set([
  "barra","halteres","haltere","maquina","polia","cabo","smith","banco",
  "cadeira","mesa","corda","anilha","barbell","dumbbell","machine","cable",
  "bar","bench","rope","plate"]);
/** @type {Record<string,string[]>} */
const MATCH_EQUIPMENT_TOKENS={
  barbell:["barra","barbell"],dumbbell:["halteres","haltere","dumbbell"],
  machine:["maquina","machine"],cable:["cabo","polia","cable"],
  smith:["smith"],bodyweight:["corpo","bodyweight"]};
const MATCH_EQUIPMENT_WEIGHT=0.25;
/** @param {unknown} s */
const matchTokens=s=>foldExerciseName(s).split(/[^a-z0-9]+/)
  .filter(w=>w.length>2&&!MATCH_STOPWORDS.has(w));
/** @param {string} w */
const matchWeight=w=>MATCH_EQUIPMENT.has(w)?MATCH_EQUIPMENT_WEIGHT:1;
/** @param {string[]} list */
const matchWeightSum=list=>list.reduce((sum,w)=>sum+matchWeight(w),0);

/* How close two movement names are, 0..1, on shared words. Deliberately dumb:
   it only has to be good enough to say "look at this one", never to decide.
   Movement words carry the weight; stopwords carry none and equipment a
   quarter, so "com barra" can no longer outvote "hip thrust". */
/** @param {unknown} a @param {unknown} b */
function nameAffinity(a,b){
  const wa=matchTokens(a);
  const wb=new Set(matchTokens(b));
  if(!wa.length||!wb.size)return 0;
  const hits=matchWeightSum(wa.filter(w=>wb.has(w)));
  const denom=Math.max(matchWeightSum(wa),matchWeightSum([...wb]));
  return denom?hits/denom:0}

/* A library name wholly present inside the lifter's line. "Leg press 45°, pés
   altos e afastados" is the library's "Leg press" plus the lifter's own setup
   notes, and diluting the score by those notes discarded an exact reading. */
/** @param {unknown} input @param {unknown} libraryName */
function nameContainment(input,libraryName){
  const wb=matchTokens(libraryName);
  if(!wb.length)return false;
  const wa=new Set(matchTokens(input));
  return wb.every(w=>wa.has(w))}

/* Whether the lifter's line names the equipment this entry uses. */
/** @param {unknown} input @param {Candidate} entry */
function matchEquipmentAgrees(input,entry){
  const list=Array.isArray(entry?.equipment)?entry.equipment:[];
  if(!list.length)return false;
  const wa=new Set(matchTokens(input));
  return list.some(kind=>(MATCH_EQUIPMENT_TOKENS[kind]||[kind]).some(tok=>wa.has(tok)))}

/* The floor is a display filter and never a trust gate: buildImportDraft gives
   probable and unmatched rows the same decision and the same unreviewed state,
   so lowering it cannot let anything through unseen. Below it a row proposes
   nothing rather than a guess it cannot stand behind. */
const IMPORT_PROBABLE_MIN=0.35;
const IMPORT_CANDIDATE_LIMIT=3;

/* Classifies one imported row against the library plus the definitions that
   travelled with the file. */
/** @param {Exercise} row @param {Candidate[]} candidates @param {Custom[]} [customs] */
function classifyImportRow(row,candidates,customs=[]){
  const name=String(row.name??"").trim();
  if(row.libraryId){
    const known=candidates.find(e=>e.id===row.libraryId)||model.snapshotLookup(customs)(row.libraryId);
    if(known)return{status:IMPORT_EXACT,match:known}}
  const folded=foldExerciseName(name);
  if(!folded)return{status:IMPORT_UNMATCHED,match:null};
  const exact=candidates.find(e=>foldExerciseName(e.name)===folded);
  if(exact)return{status:IMPORT_EXACT,match:exact};
  // The same movement written in the other language is a match, but one the
  // lifter should still see, since the name in their file will change.
  const alias=candidates.find(e=>foldExerciseName(e.namePt||"")===folded);
  if(alias)return{status:IMPORT_ALIAS,match:alias};
  // A curated alias went through the same editorial gate as the entry it points
  // at, so "RDL means Romanian deadlift" is settled rather than guessed, and the
  // row arrives confirmed like any other alias hit. Aliases add ways to reach a
  // movement; they never change which movement an id means.
  const curated=candidates.find(e=>(e.aliases||[]).some(a=>foldExerciseName(a)===folded));
  if(curated)return{status:IMPORT_ALIAS,match:curated};
  const ranked=rankImportCandidates(name,candidates);
  if(!ranked.length)return{status:IMPORT_UNMATCHED,match:null,candidates:[]};
  return{status:IMPORT_PROBABLE,match:ranked[0].entry,score:ranked[0].score,candidates:ranked}}

/* The ranked shortlist behind a review row. Scoring moves the right entry into
   this list; it does not reliably move it to the front, because a line like
   "Hack squat" never says whether the barbell or the machine is meant. So the
   row offers the list rather than a verdict.

   Order: a contained library name first, then weighted overlap, then the entry
   whose equipment the lifter actually named, then the library's own rank, and
   last the array position, so a tie never rests on position alone. */
/** @param {unknown} name @param {Candidate[]} candidates @param {number} [limit] */
function rankImportCandidates(name,candidates,limit=IMPORT_CANDIDATE_LIMIT){
  const scored=[];
  for(let i=0;i<candidates.length;i++){
    const e=candidates[i];
    const names=[e.name,e.namePt||"",...(e.aliases||[])];
    const score=names.reduce((best,n)=>Math.max(best,nameAffinity(name,n)),0);
    const contained=names.some(n=>nameContainment(name,n));
    if(!contained&&score<IMPORT_PROBABLE_MIN)continue;
    scored.push({entry:e,score,contained,equipment:matchEquipmentAgrees(name,e),
      rank:typeof e.rank==='number'&&Number.isFinite(e.rank)?e.rank:50,order:i})}
  scored.sort((a,b)=>
    (b.contained?1:0)-(a.contained?1:0)||
    b.score-a.score||
    (b.equipment?1:0)-(a.equipment?1:0)||
    a.rank-b.rank||
    a.order-b.order);
  return scored.slice(0,limit)}

/* Builds the review model. Exact and alias hits arrive decided; a probable one
   arrives undecided and blocks Import until it is looked at. */
/** @param {Source} source @param {string} fileName @param {Snapshot} head @returns {Review} */
function buildImportDraft(source,fileName,head){
  const mine=head.customExercises||[],pickable=[...mine.filter(entry=>!entry.archived),...library];
  const candidates=source.customExercises?.length
    ? [...model.normalizeCustomExercises(source.customExercises),...pickable]
    : pickable;
  const rows=source.exercises.map((raw,i)=>{
    const {status,match,candidates:ranked}=classifyImportRow(raw,candidates,mine);
    return{key:`imp${i}`,raw:cloneSnapshot(raw),status,match,
      shortlist:(ranked||[]).map(c=>c.entry),
      decision:status===IMPORT_EXACT||status===IMPORT_ALIAS?"link":"raw",
      reviewed:status===IMPORT_EXACT||status===IMPORT_ALIAS}});
  return{fileName:String(fileName||""),format:source.format||"json",
    legacy:source.legacy===true,
    meta:source.meta||null,customExercises:source.customExercises||[],rows,
    ...(source.definition?{definition:cloneSnapshot(source.definition)}:{})}}

/** @param {Review} draft */
const importCounts=draft=>{
  const linked=draft.rows.filter(r=>r.decision==="link").length;
  const review=draft.rows.filter(r=>!r.reviewed).length;
  const custom=draft.rows.filter(r=>r.decision==="custom").length;
  return{linked,review,custom,total:draft.rows.length}};

/* Turns reviewed rows into program templates. A linked row takes the
   definition's identity; a raw row keeps precisely what the file said. */
/** @param {Review} draft */
function importDraftExercises(draft){
  return draft.rows.map(r=>{
    const base=cloneSnapshot(r.raw);
    delete base.libraryId;delete base.displayName;
    if(r.decision==="link"&&r.match)
      return Object.assign(base,model.exerciseFieldsFromLibrary(r.match));
    if(r.decision==="custom"&&r.createdCustomId)
      return Object.assign(base,{libraryId:r.createdCustomId});
    return base})}

/* Definitions that have to exist before the templates can resolve: the ones
   that travelled in a v3 file, plus any created during review. */
/** @param {Review} draft */
function importDraftCustomDefinitions(draft){
  /** @type {Candidate[]} */const out=[];
  for(const e of model.normalizeCustomExercises(draft.customExercises))out.push(e);
  for(const r of draft.rows)if(r.createdCustom)out.push(r.createdCustom);
  return out}

/** @param {Review} draft @param {Snapshot} head */
function importCandidate(draft,head){
  const meta=record(draft.meta);
  const exercises=importDraftExercises(draft);
  const proposal=cloneSnapshot(head);
  const merged=imports.merge({incoming:importDraftCustomDefinitions(draft),exercises,existing:proposal.customExercises||[]});
  const program=model.makeProgram(exercises,model.snapshotLookup(merged.customExercises)).toJSON();
  const wantedCustomIds=new Set([...program.map(exercise=>exercise.libraryId),...model.definitionMovementIds(draft.definition).map(id=>merged.remap.get(id)||id)]
    .filter(model.isCustomLibraryId));
  const candidateCustomExercises=merged.customExercises
    .filter(entry=>wantedCustomIds.has(entry.id)).map(cloneSnapshot);
  const structure=meta.programStructure?cloneSnapshot(meta.programStructure):null;
  const structureRecord=record(structure);
  const structureDays=Array.isArray(structureRecord.days)?structureRecord.days.filter(isRecord):[];
  const labels=structureDays.length?structureDays.map(item=>typeof item.label==='string'?item.label:typeof item.dayId==='string'?item.dayId:''):
    [...new Set(program.map(exercise=>exercise.day))];
  const days=labels.filter(Boolean).map((label,index)=>({
    dayId:typeof structureDays[index]?.dayId==='string'?structureDays[index].dayId:label,label,
    exercises:program.filter(exercise=>exercise.day===label).map(cloneSnapshot),
  }));
  const progressionIncompatibilities=Array.isArray(meta.progressionIncompatibilities)?meta.progressionIncompatibilities:[];
  const progressionData=model.candidateProgressionData(meta?.progressionRelations,program,
    progressionIncompatibilities,"program-import");
  const progressionModifiers=model.normalizeProgressionModifiers(meta?.progressionModifiers,{
    preserveInvalid:true,incompatibilities:progressionData.incompatibilities,source:"program-json"});
  // An imported program becomes a Build definition over the matched catalog
  // movements and custom definitions; the preview rows are its projection.
  const kept=draft.definition&&draft.rows.every(row=>row.decision==="link"&&row.match?.id===row.raw.libraryId);
  const programDefinition=kept?imports.definition({definition:draft.definition,authored:importDraftCustomDefinitions(draft),existing:proposal.customExercises||[],merged:merged.customExercises,remap:merged.remap})
    :model.manualProgramDefinitionFromRows(program,labels,candidateCustomExercises);
  const projected=programDefinition?model.flatProgramFromDefinition(programDefinition,candidateCustomExercises,1):program;
  const projectedDays=programDefinition?programDefinition.days.filter(day=>day.kind==="training").map((day,index)=>({
    dayId:day.id,label:day.name,order:index+1,exercises:projected.filter(row=>row.dayId===day.id).map(cloneSnapshot)})):days;
  return{
    program:projected,
    days:projectedDays,
    ...(programDefinition?{programDefinition}:{}),
    programStructure:programDefinition?{schemaVersion:1,days:projectedDays.map(day=>({dayId:day.dayId,label:day.label,order:'order' in day?day.order:undefined})),
      provenance:{source:"import"}}:structure,
    progressionRelations:progressionData.relations,
    progressionModifiers,
    progressionIncompatibilities:progressionData.incompatibilities,
    customExercises:candidateCustomExercises,
    source:"import",
    format:draft.format,
  }}

 return Object.freeze({classify:classifyImportRow,rank:rankImportCandidates,create:buildImportDraft,counts:importCounts,candidate:importCandidate});
}
