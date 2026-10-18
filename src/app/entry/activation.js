import {cloneSnapshot} from '../../training/model.js';
/** @typedef {ReturnType<typeof import('../../training/model.js').createProgramModel>} Model
 * @typedef {ReturnType<typeof import('../../persistence/snapshot.js').createSnapshotPolicy>} Policy
 * @typedef {ReturnType<typeof import('../../training/authoring.js').createEntryRules>} EntryRules
 * @typedef {ReturnType<EntryRules['createState']>} Draft
 * @typedef {ReturnType<typeof import('../custom-import.js').createCustomDefinitionImport>} CustomImport
 * @typedef {Pick<ReturnType<typeof import('../../training/authoring.js').createInstalledEditorRules>,'suggestion'|'editorSuggestLoadsPolicy'>} BuildRules
 * @typedef {import('../../persistence/contracts.js').StoredSnapshot} Snapshot
 * @typedef {{name?:unknown,answers?:Record<string,unknown>,entrySource?:unknown}} MetadataInput
 * @typedef {{base:Snapshot,metadataSource?:Snapshot|null,expectedProgramId?:string,name?:unknown,answers?:Record<string,unknown>,entrySource?:unknown,programDefinition:unknown,
 * route:string,origin:string,destination:string,programStructure?:unknown,compilerContext?:unknown,expectedSetupDraftRaw?:string|null}} ActivationInput
 */
/** Pure construction of the installed successor. Identity is allocated exactly
 * at this explicit command, after candidate validation. Durable commit/capture
 * stays with Program replacement; rendering cannot reach this capability.
 * @param {{model:Model,entry:EntryRules,imports:CustomImport,build:BuildRules,policy:Pick<Policy,'normalizeSettings'|'normalizeLoadingConfiguration'|'normalizeProgramEntrySource'|'setupActivationMarker'|'defaultProgramMeta'>,
 * identity:{programId:()=>string,blockId:()=>string,now:()=>string,date:()=>string},defaultName:()=>string}} options */
export function createEntryActivation({model,entry,imports,build,policy,identity,defaultName}){
 const defaultCycles=6;
 /** @param {MetadataInput} input */
 function metadata({name,answers={},entrySource}={}){
  const at=identity.now(),programName=String(name??'').trim()||defaultName()||'Untitled program';
  return{id:identity.programId(),name:programName,started:identity.date(),created:at,updated:at,
   goal:answers.goal??null,experience:answers.experience??null,daysPerWeek:answers.daysPerWeek??null,splitType:answers.splitType??null,
   equipment:Array.isArray(answers.equipment)?cloneSnapshot(answers.equipment):[],priorityMuscles:Array.isArray(answers.priorityMuscles)?cloneSnapshot(answers.priorityMuscles):[],
   sessionLength:answers.sessionLength??null,mesocycleLengthWeeks:Number.isFinite(Number(answers.mesocycleLengthWeeks))&&Number(answers.mesocycleLengthWeeks)>0?Math.round(Number(answers.mesocycleLengthWeeks)):defaultCycles,
   mesocycleStatus:'active',completedAt:null,onboarded:true,progressionRelations:[],progressionModifiers:[],progressionIncompatibilities:[],
   blockPromptDismissedId:null,entrySource:policy.normalizeProgramEntrySource(entrySource)};
 }
 /** @param {unknown} value @returns {Record<string,unknown>} */
 function record(value){return value&&typeof value==='object'&&!Array.isArray(value)?/** @type {Record<string,unknown>} */(value):{}}
 /** Profile answers remain on this device. Skipped fields and unrecognized
  * stored fields follow the existing bounded profile validator unchanged.
  * @param {Snapshot} proposal @param {unknown} basics @param {boolean} hasWorkoutDraft */
 function applyBasics(proposal,basics,hasWorkoutDraft){
  if(!basics||typeof basics!=='object')return;
  /** @type {Record<string,unknown>} */const fields=Object.fromEntries(Object.entries(basics));
  const {weightUnit,...answered}=fields;
  if(Object.keys(answered).length){const merged=entry.normalizeProfile(Object.assign({},proposal.profile,answered));if(merged.ok)proposal.profile=merged.value}
  if((weightUnit==='kg'||weightUnit==='lb')&&weightUnit!==record(proposal.settings).unit&&!hasWorkoutDraft)
   proposal.settings={...policy.normalizeSettings(proposal.settings),unit:weightUnit};
 }
 /** @param {Draft['answers']} answers */
 function programmingContext(answers){
  if(!answers.desiredResult||!answers.structuredExperience||!answers.recentConsistency||!answers.daysPerWeek||!answers.sessionMinutes||!answers.environment||!Object.prototype.hasOwnProperty.call(answers,'preferredRestSeconds'))return null;
  return entry.normalizeProgrammingContext({schemaVersion:1,desiredResult:answers.desiredResult,structuredExperience:answers.structuredExperience,recentConsistency:answers.recentConsistency,
   availability:{daysPerWeek:answers.daysPerWeek,sessionMinutes:answers.sessionMinutes,preferredRestSeconds:answers.preferredRestSeconds},environment:answers.environment,
   primaryMuscles:answers.primaryMuscles||[],deEmphasizedMuscles:answers.deEmphasizedMuscles||[],ignoredMuscles:answers.ignoredMuscles||[],priorityMovements:answers.priorityMovements||[],exerciseConstraints:answers.exerciseConstraints||[],reviewedAt:identity.now()});
 }
 /** Reviewed candidate -> activation input, using the actual custom merge,
  * canonical model and Build authoring policy. Nothing writes a training store.
  * @param {{draft:Draft,head:Snapshot,name:string,hasWorkoutDraft:boolean}} input */
 function candidate({draft,head,name,hasWorkoutDraft}){
  const preview=draft.result?.preview;if(!preview)return{ok:/** @type {false} */(false),code:'program-definition-required'};
  const route=draft.route||'custom',baseProposal=cloneSnapshot(head),programStructure=preview.programStructure||null;
  let exercises=cloneSnapshot(preview.program||[]);
  /** @type {Record<string,unknown>} */const answers={goal:draft.answers.desiredResult==='muscle_growth'?'hypertrophy':['strength','balanced'].includes(draft.answers.desiredResult||'')?'strength_hypertrophy':null,
   experience:null,daysPerWeek:route==='browse'?(preview.frequency||null):(draft.answers.daysPerWeek||preview.frequency||null),splitType:null,equipment:[],priorityMuscles:draft.answers.primaryMuscles||[],sessionLength:null};
  if(route==='shared'){
   const shared=record(preview.sharedMeta);
   Object.assign(answers,{goal:shared.goal??answers.goal,experience:shared.experience??answers.experience,daysPerWeek:shared.daysPerWeek??answers.daysPerWeek,
    splitType:shared.splitType??null,equipment:Array.isArray(shared.equipment)?shared.equipment.slice():answers.equipment,priorityMuscles:Array.isArray(shared.priorityMuscles)?shared.priorityMuscles.slice():answers.priorityMuscles,
    sessionLength:shared.sessionLength??null,mesocycleLengthWeeks:shared.mesocycleLengthWeeks??null});
   if(preview.sharedSettings){
    const settings=policy.normalizeSettings(preview.sharedSettings),allowlist=['jumpPct','minJump','rirHigh','hardRir','restSec','unit','lang','rirMode'];
    baseProposal.settings={...policy.normalizeSettings(baseProposal.settings),...Object.fromEntries(allowlist.map(key=>[key,settings[key]]))};
   }
   if(preview.sharedImport)baseProposal._sharedSetupImport=cloneSnapshot(preview.sharedImport);
  }
  const existingCustoms=baseProposal.customExercises||[];
  /** @type {Map<string,string>} */let remap=new Map();
  if(preview.customExercises?.length){
   const merged=imports.merge({incoming:preview.customExercises,exercises,existing:existingCustoms});
   baseProposal.customExercises=merged.customExercises;remap=merged.remap;
  }
  let definition=preview.programDefinition||preview.definition||(route==='shared'?baseProposal.programMeta?.programDefinition:null);
  const providedDefinition=!!definition;
  if(!definition&&route==='build'){
   const dayFacts=Array.isArray(programStructure?.days)?programStructure.days:Array.isArray(preview.days)?preview.days:[];
   const names=dayFacts.map(day=>{const value=record(day);return value.label||value.name}).filter((value)=>typeof value==='string');
   definition=model.manualProgramDefinitionFromRows(exercises,names,baseProposal.customExercises||[]);
  }
  let canonical=providedDefinition&&remap.size
   ?imports.definition({definition,authored:preview.customExercises,existing:existingCustoms,merged:baseProposal.customExercises||[],remap})
   :model.canonicalProgramDefinition(definition,baseProposal.customExercises||[]);
  if(!canonical)return{ok:/** @type {false} */(false),code:'program-definition-required'};
  if(route==='build'){
   const pending=Array.isArray(preview.suggestLoadsPending)?preview.suggestLoadsPending.filter((id)=>typeof id==='string'):[];
   const confirmed=build.suggestion.confirm({program:[],programMeta:{programDefinition:canonical,suggestLoadsPending:pending}},build.editorSuggestLoadsPolicy);
   const checked=confirmed.ok&&confirmed.document?model.canonicalProgramDefinition(confirmed.document.programMeta.programDefinition,baseProposal.customExercises||[]):null;
   if(!checked)return{ok:/** @type {false} */(false),code:'suggest-loads-incomplete'};
   canonical=checked;
  }
  exercises=model.flatProgramFromDefinition(canonical,baseProposal.customExercises||[]);
  const request=record(canonical.request);
  Object.assign(answers,{daysPerWeek:canonical.days.filter(day=>day.kind==='training').length,goal:request.goal||answers.goal,experience:request.experience||answers.experience,splitType:request.split||answers.splitType,mesocycleLengthWeeks:canonical.cycles});
  const context=programmingContext(draft.answers);if(context?.ok)baseProposal.programmingContext=context.value;
  if(route==='recommend')applyBasics(baseProposal,draft.answers.basics,hasWorkoutDraft);
  baseProposal.programMeta=baseProposal.programMeta||policy.defaultProgramMeta(baseProposal.log);
  Object.assign(baseProposal.programMeta,{progressionRelations:cloneSnapshot(preview.progressionRelations||[]),progressionModifiers:cloneSnapshot(preview.progressionModifiers||[]),progressionIncompatibilities:cloneSnapshot(preview.progressionIncompatibilities||[]),programStructure:cloneSnapshot(programStructure)});
  if(route==='build'){
   const loading=policy.normalizeLoadingConfiguration(preview.loadingConfiguration);
   if(loading)baseProposal.programMeta.loadingConfiguration=loading;else delete baseProposal.programMeta.loadingConfiguration;
  }
  const compilerContext=['recommend','custom','browse'].includes(route)?(draft.result?.compilerContext||null):null;
  if(compilerContext)baseProposal.programMeta.compilerContext=cloneSnapshot(compilerContext);
  return{ok:/** @type {true} */(true),value:{exercises,name,answers,baseProposal,telemetryRoute:route,entryTelemetry:draft.result?.telemetry||null,entrySource:{route,fingerprint:draft.result?.fingerprint},programStructure,programDefinition:canonical,compilerContext,replace:route==='shared',expectedFirstRunEmpty:route==='shared'}};
 }
 /** @param {ActivationInput} input */
 function successor({base,metadataSource=null,expectedProgramId,name,answers,entrySource,programDefinition,route,origin,destination,programStructure,compilerContext,expectedSetupDraftRaw}){
  const proposal=cloneSnapshot(base),customs=proposal.customExercises||[];
  const definition=model.canonicalProgramDefinition(programDefinition,customs);
  if(!definition)return{ok:/** @type {false} */(false),code:'program-definition-required'};
  if(origin==='block'&&proposal.programMeta?.id!==expectedProgramId)return{ok:/** @type {false} */(false),code:'duplicate'};
  const meta={...metadata({name,answers,entrySource}),blockId:identity.blockId(),programDefinition:definition,
   mesocycleLengthWeeks:definition.cycles,daysPerWeek:definition.days.filter(day=>day.kind==='training').length};
  proposal.settings=policy.normalizeSettings(proposal.settings);
  proposal.program=model.durableProgramRows(definition,customs,meta);
  const previous=metadataSource?.programMeta;
  Object.assign(meta,{
   progressionRelations:model.normalizeProgressionRelations(previous?.progressionRelations,proposal.program),
   progressionModifiers:model.normalizeProgressionModifiers(previous?.progressionModifiers),
   progressionIncompatibilities:Array.isArray(previous?.progressionIncompatibilities)?cloneSnapshot(previous.progressionIncompatibilities):[],
   programStructure:programStructure?cloneSnapshot(programStructure):(previous?.programStructure?cloneSnapshot(previous.programStructure):null)});
  if(route==='build'){
   const loading=policy.normalizeLoadingConfiguration(previous?.loadingConfiguration);
   if(loading)Object.assign(meta,{loadingConfiguration:loading});
  }
  if(route==='recommend'||route==='custom'||route==='browse'){
   const context=compilerContext||previous?.compilerContext;
   if(context&&typeof context==='object')Object.assign(meta,{compilerContext:cloneSnapshot(context)});
  }
  proposal.programMeta=meta;
  delete proposal._storageSetupActivation;
  const receipt=policy.setupActivationMarker(expectedSetupDraftRaw,meta.id);
  if(receipt)proposal._storageSetupActivation=receipt;
  if(destination==='program-edit')proposal._storageFollowUp={kind:'onboarding-edit',origin};
  else delete proposal._storageFollowUp;
  return{ok:/** @type {true} */(true),proposal};
 }
 return Object.freeze({metadata,candidate,successor,defaultCycles});
}
