import {cloneSnapshot} from '../../training/model.js';
/** @typedef {ReturnType<typeof import('../../training/model.js').createProgramModel>} Model
 * @typedef {ReturnType<typeof import('../../persistence/snapshot.js').createSnapshotPolicy>} Policy
 * @typedef {import('../../persistence/contracts.js').StoredSnapshot} Snapshot
 * @typedef {{name?:unknown,answers?:Record<string,unknown>,entrySource?:unknown}} MetadataInput
 * @typedef {{base:Snapshot,metadataSource?:Snapshot|null,expectedProgramId?:string,name?:unknown,answers?:Record<string,unknown>,entrySource?:unknown,programDefinition:unknown,
 * route:string,origin:string,destination:string,programStructure?:unknown,compilerContext?:unknown,expectedSetupDraftRaw?:string|null}} ActivationInput
 */
/** Pure construction of the installed successor. Identity is allocated exactly
 * at this explicit command, after candidate validation. Durable commit/capture
 * stays with Program replacement; rendering cannot reach this capability.
 * @param {{model:Model,policy:Pick<Policy,'normalizeSettings'|'normalizeLoadingConfiguration'|'normalizeProgramEntrySource'|'setupActivationMarker'>,
 * identity:{programId:()=>string,blockId:()=>string,now:()=>string,date:()=>string},defaultName:()=>string}} options */
export function createEntryActivation({model,policy,identity,defaultName}){
 /** @param {MetadataInput} input */
 function metadata({name,answers={},entrySource}={}){
  const at=identity.now(),programName=String(name??'').trim()||defaultName()||'Untitled program';
  return{id:identity.programId(),name:programName,started:identity.date(),created:at,updated:at,
   goal:answers.goal??null,experience:answers.experience??null,daysPerWeek:answers.daysPerWeek??null,splitType:answers.splitType??null,
   equipment:Array.isArray(answers.equipment)?cloneSnapshot(answers.equipment):[],priorityMuscles:Array.isArray(answers.priorityMuscles)?cloneSnapshot(answers.priorityMuscles):[],
   sessionLength:answers.sessionLength??null,mesocycleLengthWeeks:Number.isFinite(Number(answers.mesocycleLengthWeeks))&&Number(answers.mesocycleLengthWeeks)>0?Math.round(Number(answers.mesocycleLengthWeeks)):6,
   mesocycleStatus:'active',completedAt:null,onboarded:true,progressionRelations:[],progressionModifiers:[],progressionIncompatibilities:[],
   blockPromptDismissedId:null,entrySource:policy.normalizeProgramEntrySource(entrySource)};
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
 return Object.freeze({metadata,successor});
}
