import {cloneSnapshot} from '../../training/model.js';
import {createInstalledEditorRules} from '../../training/authoring.js';
/** @typedef {ReturnType<typeof import('../../training/model.js').createProgramModel>} Model
 * @typedef {ReturnType<typeof import('../../persistence/snapshot.js').createSnapshotPolicy>} Policy
 * @typedef {ReturnType<typeof import('../../training/authoring.js').createEntryRules>} Entry
 * @typedef {ReturnType<typeof import('./setup.js').createEntrySetup>} Setup
 * @typedef {ReturnType<typeof import('../../persistence/setup-draft.js').createSetupDraftStore>} Store
 * @typedef {import('../../training/authoring.js').EditorDocument} Document
 * @typedef {import('../../training/authoring.js').InstalledIntent} Intent
 * @typedef {import('../../persistence/contracts.js').StoredSnapshot & Document} Snapshot
 * @typedef {{ok?:boolean,conflict?:boolean,writeFailed?:boolean,invalid?:boolean,code?:string,issues?:unknown[],envelope?:{revision:number}}} SaveResult
 */
/** Entry editor commands stage a private candidate. Installed Apply remains a
 * separate owner; this boundary never writes an installed training snapshot.
 * @param {{setup:Setup,store:Store,entry:Entry,model:Model,imports:ReturnType<typeof import('../custom-import.js').createCustomDefinitionImport>,policy:Policy,catalog:import('../../training/generation.js').SourceCatalog,nextId:()=>string,read:()=>Snapshot,language:()=>string,services:()=>{fingerprint?:(value:unknown)=>string}|null,time?:{workingSetSeconds:number,bufferMinimumSeconds:number,bufferPercent:number}}} options */
export function createEntryEditor({setup,store,entry,model,imports,policy,catalog,nextId,read,language,services,time}){
 const {defaultProgramMeta:defaultMeta,normalizeLoadingConfiguration,isSafeCustomExercise,isValidMuscleDomainTree}=policy;
 const {canonicalProgramDefinition,flatProgramFromDefinition,makeProgram,snapshotLookup,candidateProgressionData,definitionMovementIds,isCustomLibraryId}=model;
 /** @param {unknown[]} log */
 const defaultProgramMeta=log=>/** @type {Document['programMeta']} */(defaultMeta(/** @type {Record<string,unknown>[]} */(log)));
 const build=createInstalledEditorRules({model,catalog,nextId,defaultProgramMeta,allowCreateDefinition:true});
 const installed=createInstalledEditorRules({model,catalog,nextId,defaultProgramMeta});
 /** @param {ReturnType<Entry['createState']>['result']|undefined} result */
 function resultName(result){return result?String(language()==='pt'?(result.namePt||result.name||''):(result.name||result.namePt||'')).trim():''}
 /** @param {string|null} route @param {unknown} name @param {unknown} preview */
 function fingerprint(route,name,preview){
  const semanticPreview=cloneSnapshot(/** @type {Record<string,unknown>} */(preview||{}));
  if(Array.isArray(semanticPreview.customExercises))semanticPreview.customExercises=semanticPreview.customExercises.map(value=>{const normalized={...value};delete normalized.created;return normalized});
  return services()?.fingerprint?.({route:route||null,name:name||'',preview:semanticPreview})||'candidate';
 }
/** @param {import('../../training/model.js').ExerciseInput[]} exercises @param {unknown} settings */
function sharedPreviewDayMinutes(exercises,settings){
  const rows=Array.isArray(exercises)?exercises:[],timeRules=time;
  const rest=Number(/** @type {{restSec?:unknown}|null} */(settings)?.restSec),working=Number(timeRules?.workingSetSeconds),minimum=Number(timeRules?.bufferMinimumSeconds),percent=Number(timeRules?.bufferPercent);
  if(!rows.length||!Number.isFinite(rest)||rest<0||![working,minimum,percent].every(Number.isFinite))return null;
  let subtotal=0;
  for(const exercise of rows){
    const sets=Number(exercise?.sets);
    if(!Number.isInteger(sets)||sets<1)return null;
    subtotal+=sets*working+Math.max(0,sets-1)*rest;
  }
  return Math.ceil((subtotal+Math.max(minimum,Math.ceil(subtotal*percent/100)))/60);
}
/** @param {import('../../training/model.js').ExerciseInput[]} program @param {import('../../training/model.js').ProgramMeta['programStructure']} structure @param {unknown} settings */
function sharedPreviewDays(program,structure,settings){
  const rows=Array.isArray(program)?program:[];
  /** @type {Array<{dayId?:string,label?:string,displayNameKey?:string,nameOverride?:string}>} */const sourceDays=Array.isArray(structure?.days)&&structure.days.length
    ?structure.days.map(item=>({dayId:item.dayId,label:item.label||item.dayId,
      ...(item.displayNameKey?{displayNameKey:item.displayNameKey}:{}),
      ...(item.nameOverride?{nameOverride:item.nameOverride}:{})}))
    :[...new Set(rows.map(exercise=>exercise?.day).filter(Boolean))].map(label=>({dayId:label,label}));
  return sourceDays.filter(day=>day.dayId||day.label).map(day=>{
    const exercises=rows.filter(exercise=>exercise?.dayId?exercise.dayId===day.dayId:exercise.day===day.label).map(cloneSnapshot);
    const estimateMinutes=sharedPreviewDayMinutes(exercises,settings);
    /** @type {{dayId?:string,label?:string,displayNameKey?:string,nameOverride?:string,exercises:import('../../training/model.js').ExerciseInput[],estimateMinutes?:number}} */const out={dayId:day.dayId||day.label,label:day.label||day.dayId,
      ...(day.displayNameKey?{displayNameKey:day.displayNameKey}:{}),
      ...(day.nameOverride?{nameOverride:day.nameOverride}:{}),exercises};
    if(estimateMinutes!==null)out.estimateMinutes=estimateMinutes;
    return out;
  });
}
function snapshot(){
  const entryState=setup.read(),preview=entryState?.result?.preview||{},snapshot=cloneSnapshot(read());
  const candidateProgram=cloneSnapshot(preview.program||[]);
  const merged=imports.merge({incoming:preview.customExercises||[],exercises:candidateProgram,existing:snapshot.customExercises||[]});
  snapshot.customExercises=merged.customExercises;
  snapshot.program=candidateProgram;
  const loadingConfiguration=entryState?.route==="build"
    ?normalizeLoadingConfiguration(preview.loadingConfiguration):null;
  const suggestLoadsPending=entryState?.route==="build"&&Array.isArray(preview.suggestLoadsPending)&&preview.suggestLoadsPending.length
    ?cloneSnapshot(preview.suggestLoadsPending):null;
  snapshot.programMeta={...defaultProgramMeta([]),name:resultName(entryState?.result)||entryState?.answers?.programName||"",
    daysPerWeek:entryState?.answers?.daysPerWeek||preview.frequency||null,onboarded:false,
    ...(preview.programDefinition?{programDefinition:cloneSnapshot(preview.programDefinition)}:{}),
    ...(loadingConfiguration?{loadingConfiguration}:{}),
    ...(suggestLoadsPending?{suggestLoadsPending}:{}),
    programStructure:cloneSnapshot(preview.programStructure||null),
    progressionRelations:cloneSnapshot(preview.progressionRelations||[]),
    progressionModifiers:cloneSnapshot(preview.progressionModifiers||[]),
    progressionIncompatibilities:cloneSnapshot(preview.progressionIncompatibilities||[])};
  return snapshot}

/** @param {Snapshot} proposal @param {Parameters<Setup['save']>[1]} [options] */
async function commitForm(proposal,options={}){
 /** @type {import('./setup.js').Diagnostic|null} */let diagnostic=null;
 let resetEditor=false,focusStatus=false;
 /** @template T @param {T} value */
 const outcome=value=>({...value,editorEffects:{draftId:entryState?.draftId,diagnostic,resetEditor,focusStatus}});
  const entryState=setup.read();
  if(!entryState?.result?.preview){
    diagnostic={operation:"editor-commit",ok:false,code:"editor-preview-missing",issues:[]};
    return outcome({localOk:false,idbOk:false,setupDraftInvalid:true,code:"editor-preview-missing"})}
  const definition=canonicalProgramDefinition(proposal.programMeta?.programDefinition,
    proposal.customExercises||[]);
  if(!definition){
    diagnostic={operation:"editor-commit",ok:false,code:"program_definition_required",issues:[]};
    return outcome({localOk:false,idbOk:false,setupDraftInvalid:true,code:"program_definition_required"})}
  proposal.programMeta={...(proposal.programMeta||{}),programDefinition:definition};
  // ProgramDefinition owns slot identity and prescriptions. The legacy Program
  // model remains useful here for validating linked muscle attribution, but it
  // is not a publication format: serializing it would drop slot/day identity
  // and leak legacy-only fields back into the setup candidate.
  const program=flatProgramFromDefinition(definition,proposal.customExercises||[],1);
  const model=makeProgram(program,snapshotLookup(proposal.customExercises),proposal.programMeta);
  // Compiler previews intentionally use the compiler's internal lowercase
  // muscle ids while they are staged outside durable state. Resolve linked
  // built-ins/customs here before validating the editor result, so the setup
  // draft may retain its preview representation but every edited candidate
  // crossing toward activation already has the durable canonical domain.
  const canonicalProgram=model.toJSON();
  if(!Array.isArray(proposal.customExercises)||
    !proposal.customExercises.every(isSafeCustomExercise)||
    !isValidMuscleDomainTree({program:canonicalProgram,customExercises:proposal.customExercises})){
    diagnostic={operation:"editor-commit",ok:false,code:"invalid-muscle-domain",issues:[]};
    return outcome({ok:false,committed:false,invalid:true,code:"invalid-muscle-domain",localOk:false,idbOk:false})}
  const structure=proposal.programMeta?.programStructure?cloneSnapshot(proposal.programMeta.programStructure):null;
  const structureDays=structure?.days||[];
  /** @param {string|undefined} label */
  const rowsForDay=label=>program.filter(exercise=>exercise.day===label).map(cloneSnapshot);
  const previewDays=entryState.route==="shared"
    ?sharedPreviewDays(program,structure,entryState.result.preview.sharedSettings)
    :(structureDays.length?structureDays.map(item=>({dayId:item.dayId,label:item.label,
      ...(item.displayNameKey?{displayNameKey:item.displayNameKey}:{}),
      ...(item.nameOverride?{nameOverride:item.nameOverride}:{}),
      exercises:rowsForDay(item.label||item.dayId)})):
      [...new Set(program.map(exercise=>exercise.day))].map(label=>({dayId:label,label,exercises:rowsForDay(label)})));
  const progressionData=candidateProgressionData(proposal.programMeta?.progressionRelations,program,
    /** @type {Parameters<Model['candidateProgressionData']>[2]} */(proposal.programMeta?.progressionIncompatibilities),"candidate-editor");
  const loadingConfiguration=entryState.route==="build"
    ?normalizeLoadingConfiguration(proposal.programMeta?.loadingConfiguration):null;
  const referencedCustomIds=new Set([...program.map(exercise=>exercise.libraryId),
    ...definitionMovementIds(definition)].filter(isCustomLibraryId));
  const preview={...cloneSnapshot(entryState.result.preview),program,
    ...(proposal.programMeta?.programDefinition?{programDefinition:cloneSnapshot(proposal.programMeta.programDefinition)}:{}),
    programStructure:structure,
    progressionRelations:progressionData.relations,
    progressionIncompatibilities:progressionData.incompatibilities,
    ...(entryState.route==="build"?{loadingConfiguration}:{}),
    ...(entryState.route==="build"?{suggestLoadsPending:Array.isArray(proposal.programMeta?.suggestLoadsPending)
      ?cloneSnapshot(proposal.programMeta.suggestLoadsPending):[]}:{}),
    days:previewDays,
    customExercises:(entryState.result.preview?.customExercises||[])
      .filter(entry=>referencedCustomIds.has(entry.id)).map(cloneSnapshot)};
  if(!preview.suggestLoadsPending?.length)delete preview.suggestLoadsPending;
  const previousEntryState=entryState;
  /** @type {NonNullable<ReturnType<Entry['createState']>['result']>} */const result={...cloneSnapshot(entryState.result),preview:/** @type {NonNullable<ReturnType<Entry['createState']>['result']>['preview']} */(preview)};
  const nextName=proposal.programMeta?.name||entryState.result.name;
  if(nextName){result.name=nextName;delete result.namePt}else delete result.name;
  result.fingerprint=fingerprint(entryState.route,result.name,preview);
  setup.publish(entry.setResult(entryState,result));
  const persisted=setup.save(setup.read(),options);
  const attemptedEntryState=setup.read();
  const saved=/** @type {SaveResult} */(await persisted);
  diagnostic={operation:"editor-commit",ok:!!saved?.ok,
    code:saved?.code||(saved?.conflict?"setup-draft-conflict":saved?.writeFailed?"setup-draft-write-failed":saved?.invalid?"setup-draft-invalid":null),
    issues:(saved?.issues||[]).slice(0,12).map(issue=>String(issue).slice(0,240))};
  if(!saved?.ok){
    // Only this same Entry flow can be rebased. A replacement flow is not an
    // earlier command's rollback target.
    if(setup.read()?.draftId===attemptedEntryState?.draftId){
      if(saved?.conflict&&store.baseline()){
        setup.publish(store.baseline());resetEditor=true;
      }else if(setup.read()===attemptedEntryState)setup.publish(previousEntryState);
    }
  }
  focusStatus=!!saved?.ok&&progressionData.incompatibilities.length>0;
  return outcome(saved?.ok?{revision:saved.envelope?.revision||0,localOk:true,idbOk:true,setupDraft:true}:
    {revision:0,localOk:false,idbOk:false,setupDraft:true,setupDraftConflict:!!saved?.conflict,
      code:saved?.code||null,issues:Array.isArray(saved?.issues)?saved.issues.slice(0,12):[]})}

 function editorRead(){return{document:build.editorDocumentFromSnapshot(snapshot()),token:{draftRevision:Number(/** @type {ReturnType<Entry['createState']> & {revision?:number}|null} */(setup.read())?.revision)||0}}}
 /** @param {{nextDocument:Document,intent:Intent}} request */
 async function commit({nextDocument,intent}){
  const baseline=build.editorDocumentFromSnapshot(snapshot()),document=cloneSnapshot(nextDocument);
  if(!(setup.read()?.route==='build'?build:installed).syncEditorCanonicalIntent(document,baseline,intent,{cycleIndex:Number(intent?.cycleIndex)||1}))
   return{ok:false,invalid:true,code:'invalid_canonical_editor_intent'};
  const proposal=snapshot();proposal.program=cloneSnapshot(document.program||[]);
  proposal.programMeta=cloneSnapshot(document.programMeta||proposal.programMeta);
  proposal.customExercises=cloneSnapshot(document.customExercises||proposal.customExercises||[]);
  model.syncProgramStructureFromProgram(proposal,model.makeProgram(proposal.program,model.snapshotLookup(proposal.customExercises),proposal.programMeta));
  const result=await commitForm(proposal);
  return{...result,ok:!!(result.localOk||result.idbOk),setupDraft:true,staged:true,...editorRead()};
 }
 return Object.freeze({snapshot,read:editorRead,commit,commitForm,fingerprint,previewDays:sharedPreviewDays});
}
