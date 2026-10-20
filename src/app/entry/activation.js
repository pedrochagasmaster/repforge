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

/** @typedef {import('../session.js').Snapshot & Snapshot} PublishedSnapshot
 * @typedef {import('../session.js').CommitResult} CommitResult
 * @typedef {import('../program.js').ReplacementCapture} ReplacementCapture
 * @typedef {import('../../persistence/setup-draft.js').Handle} SetupHandle
 * @typedef {ReturnType<typeof import('../../persistence/setup-draft.js').createSetupDraftStore>} SetupStore
 * @typedef {ReturnType<typeof createEntryActivation>} Activation
 * @typedef {ReturnType<typeof import('../program.js').createProgramReplacementPolicy>} ReplacementPolicy
 * @typedef {ReturnType<typeof import('../program.js').createProgramReplacementCommands>} Replacement
 * @typedef {{origin:string,destination:string,telemetryRoute:string,entryTelemetry?:unknown,reviewChanges?:unknown}} Presentation
 * @typedef {{name?:string,origin?:string,destination?:string,versions:Record<string,unknown>,pinnedVersionsExecutable?:boolean,blockIntent?:ReplacementCapture|null,reviewChanges?:unknown}} PreviewRequest
 * @typedef {{name?:unknown,answers?:Record<string,unknown>,destination?:string,origin?:string,baseProposal?:Snapshot|null,telemetryRoute?:string,entryTelemetry?:unknown,entrySource?:{route?:string}|null,programStructure?:unknown,programDefinition?:unknown,expectedSetupDraftRaw?:string|null,replace?:boolean,expectedFirstRunEmpty?:boolean,compilerContext?:unknown,reviewChanges?:unknown,blockIntent?:ReplacementCapture|null,discardDraftRaw?:string|null}} ProgramRequest
 * @typedef {{kind:'prepared'|'receipt',needsReplacementConfirmation:boolean,needsDraftConfirmation:boolean,presentation:Presentation}} Ticket
 * @typedef {{publishedHead:PublishedSnapshot,head:PublishedSnapshot,draft:Draft|null,handle:SetupHandle|null,proposal:PublishedSnapshot|null,capture:ReplacementCapture|null,raw:string|null,expectedSetupDraftRaw?:string|null,replace:boolean,expectedFirstRunEmpty:boolean,preview:boolean,result?:CommitResult,pending?:Promise<CommitResult>}} Transaction
 */
import {draftProgramFingerprint,readRevision,snapshotBlockId} from '../../persistence/snapshot.js';

/** Entry activation owns the captured candidate, consent pins, qualified commit
 * and exact setup receipt cleanup. The durable and setup stores retain locks,
 * CAS and journals; presentation receives facts and explicit outcomes only.
 * @param {{activation:Activation,entry:EntryRules,read:()=>PublishedSnapshot,readDraft:()=>Draft|null,store:SetupStore,
 * replacement:Replacement,replacementPolicy:ReplacementPolicy,policy:Pick<Policy,'isValidSetupActivationMarker'|'setupActivationMatches'>,
 * workout:{readRaw:()=>string|null,hasProgress:()=>boolean,clearEffect:(raw:string|null)=>import('../session.js').DraftEffect|null,blockStartGuard:(head:PublishedSnapshot)=>CommitResult|null},
 * settleReceipt:(raw:string)=>Promise<CommitResult>}} options */
export function createEntryActivationCommands({activation,entry,read,readDraft,store,replacement,replacementPolicy,policy,workout,settleReceipt}){
 /** @type {WeakMap<Ticket,Transaction>} */const transactions=new WeakMap();
 /** @param {Snapshot} head @param {string|null|undefined} raw */
 function receiptMatches(head,raw){
  const marker=head._storageSetupActivation;
  return typeof raw==='string'&&policy.isValidSetupActivationMarker(marker)&&
   marker.revision===readRevision(head)&&policy.setupActivationMatches(marker,raw,head.programMeta?.id);
 }
 /** @param {Transaction} transaction */
 function current(transaction){
  const head=read(),captured=transaction.head;
  return head===transaction.publishedHead&&(!transaction.preview||readDraft()===transaction.draft)&&
   readRevision(head)===readRevision(captured)&&head.programMeta?.id===captured.programMeta?.id&&
   snapshotBlockId(head)===snapshotBlockId(captured)&&draftProgramFingerprint(head)===draftProgramFingerprint(captured);
 }
 /** @param {Presentation} presentation @param {Transaction} transaction @param {'prepared'|'receipt'} [kind] */
 function ticket(presentation,transaction,kind='prepared'){
  /** @type {Ticket} */const value=Object.freeze({kind,presentation:Object.freeze(presentation),
   needsReplacementConfirmation:!!(transaction.head.programMeta?.onboarded&&replacementPolicy.hasContent(transaction.head)),
   needsDraftConfirmation:workout.hasProgress()});
  transactions.set(value,transaction);return value;
 }
 /** Capture before any dialog. No later live read can select the successor.
  * @param {ProgramRequest} input @param {{head?:PublishedSnapshot,draft?:Draft|null,handle?:SetupHandle|null,preview?:boolean}} [captured] */
 function prepareProgram(input,{head=read(),draft=null,handle=null,preview=false}={}){
  const {origin='first-run',destination='log',telemetryRoute='custom',blockIntent=null}=input;
  let capture;
  if(origin==='block'){
   const guard=workout.blockStartGuard(head);
   if(guard)return{...guard,kind:'failed',committed:false,settled:false};
   if(!blockIntent)return{kind:'failed',committed:false,settled:false};
   capture=replacementPolicy.materialize(blockIntent,head);
   if(!capture)return{kind:'stale',duplicate:true};
  }else capture=replacementPolicy.capture(head);
  const prepared=activation.successor({base:input.baseProposal||head,metadataSource:input.baseProposal,
   name:input.name,answers:input.answers||{},entrySource:input.entrySource,programDefinition:input.programDefinition,
   route:input.entrySource?.route||telemetryRoute,origin,destination,programStructure:input.programStructure,
   compilerContext:input.compilerContext,expectedSetupDraftRaw:input.expectedSetupDraftRaw,expectedProgramId:blockIntent?.oldProgramId});
  if(!prepared.ok)return{kind:'invalid',invalid:true,code:prepared.code,duplicate:prepared.code==='duplicate'};
  return ticket({origin,destination,telemetryRoute,entryTelemetry:input.entryTelemetry,reviewChanges:cloneSnapshot(input.reviewChanges)},
   {publishedHead:head,head:cloneSnapshot(head),draft,handle:cloneSnapshot(handle),proposal:/** @type {PublishedSnapshot} */(prepared.proposal),capture,
    raw:input.discardDraftRaw===undefined?workout.readRaw():input.discardDraftRaw,
    expectedSetupDraftRaw:input.expectedSetupDraftRaw,replace:input.replace===true,expectedFirstRunEmpty:input.expectedFirstRunEmpty===true,preview});
 }
 /** @param {PreviewRequest} request */
 async function prepare(request){
  const draft=readDraft(),head=read();
  if(!draft)return{kind:'not-ready',code:'preview_not_ready'};
  await store.flush();
  if(readDraft()!==draft||read()!==head)return{kind:'stale',conflict:true};
  const handle=store.handle(),raw=handle?.raw??null;
  if(handle&&handle.envelope?.draftId!==draft.draftId)return{kind:'stale',setupDraftConflict:true};
  const presentation={origin:request.origin||'first-run',destination:request.destination||'log',telemetryRoute:draft.route||'custom',reviewChanges:cloneSnapshot(request.reviewChanges)};
  if(receiptMatches(head,raw))return ticket(presentation,{publishedHead:head,head:cloneSnapshot(head),draft,handle,proposal:null,capture:null,raw:workout.readRaw(),expectedSetupDraftRaw:raw,replace:false,expectedFirstRunEmpty:false,preview:true},'receipt');
  if(store.readRaw()!==raw||store.failure()==='save_conflict')return{kind:'failed',setupDraftConflict:true};
  if(store.failure()==='save_failed')return{kind:'failed',writeFailed:true};
  const readiness=entry.activationReadiness(draft,{liveActiveProgramRevision:readRevision(head),currentVersions:request.versions,pinnedVersionsExecutable:request.pinnedVersionsExecutable});
  if(!readiness.ok)return{...readiness,kind:'not-ready'};
  const candidate=activation.candidate({draft,head,name:request.name||'',hasWorkoutDraft:!!workout.readRaw()});
  if(!candidate.ok)return{...candidate,kind:'invalid',invalid:true};
  return prepareProgram({...candidate.value,...request,expectedSetupDraftRaw:raw},{head,draft,handle,preview:true});
 }
 /** Exact cleanup is independently retryable. A newer draft remains owned by
  * its writer even if this activation has already been acknowledged.
  * @param {Ticket} prepared @param {Transaction} transaction @param {CommitResult} result */
 async function cleanup(prepared,transaction,result){
  const setupDraftCleanup=await store.transaction(()=>store.readRaw()===null
   ?{ok:true,absent:true}:store.removeObserved(transaction.handle));
  return {...result,kind:setupDraftCleanup.ok?'committed':'cleanup-pending',setupDraftCleanup,
   presentation:prepared.presentation,entryDraftChanged:transaction.preview&&readDraft()!==transaction.draft,clearEntryDraft:setupDraftCleanup.ok&&readDraft()===transaction.draft};
 }
 /** @param {Ticket} prepared */
 async function resume(prepared){
  const transaction=transactions.get(prepared);
  if(!transaction||!receiptMatches(read(),transaction.expectedSetupDraftRaw))return{kind:'stale',conflict:true};
  const settled=await settleReceipt(/** @type {string} */(transaction.expectedSetupDraftRaw));
  if(settled.committed!==true||settled.settled!==true)return{...settled,kind:'failed'};
  transaction.result={...settled,alreadyCommitted:true};
  return cleanup(prepared,transaction,transaction.result);
 }
 /** @param {Ticket} prepared @param {{confirmed?:boolean,draftConfirmed?:boolean,io?:unknown}} [consent] */
 async function commit(prepared,{confirmed=false,draftConfirmed=false,io}={}){
  const transaction=transactions.get(prepared);
  if(!transaction)return{kind:'stale',conflict:true};
  if(transaction.pending)return transaction.pending;
  if(prepared.kind==='receipt'||receiptMatches(read(),transaction.expectedSetupDraftRaw))return resume(prepared);
  if(transaction.result)return cleanup(prepared,transaction,transaction.result);
  if((prepared.needsReplacementConfirmation&&!confirmed)||(prepared.needsDraftConfirmation&&!draftConfirmed))return{kind:'cancelled',cancelled:true};
  if(!current(transaction))return{kind:'stale',conflict:true};
  if(transaction.expectedSetupDraftRaw!==undefined&&store.readRaw()!==transaction.expectedSetupDraftRaw)return{kind:'stale',setupDraftConflict:true};
  if(!transaction.proposal)return{kind:'failed'};
  const head=transaction.head;
  const operation=async()=>{
   const persisted=await replacement.commit(/** @type {PublishedSnapshot} */(transaction.proposal),{capture:transaction.capture,
    effect:workout.clearEffect(transaction.raw),expectedSetupDraftRaw:transaction.expectedSetupDraftRaw,
    replace:transaction.replace,expectedFirstRunEmpty:transaction.expectedFirstRunEmpty,
    expectedProgramId:head.programMeta?.id||null,expectedBlockId:/** @type {string|null} */(snapshotBlockId(head)),
    expectedProgramFingerprint:draftProgramFingerprint(head),expectedStorageRevision:readRevision(head),io});
   if(persisted.committed!==true||persisted.settled!==true)return{...persisted,kind:'failed'};
   transaction.result=persisted;
   return cleanup(prepared,transaction,persisted);
  };
  transaction.pending=operation();
  try{return await transaction.pending}finally{delete transaction.pending}
 }
 /** Boot recovery uses the exact acknowledged receipt and the setup store's
  * own lock. It never adopts or removes an unrelated record. */
 async function recover(){
  const head=read(),marker=head._storageSetupActivation;
  if(!policy.isValidSetupActivationMarker(marker)||!receiptMatches(head,marker.raw))return{ok:true,absent:true};
  const raw=store.readRaw();
  if(raw===null||raw!==marker.raw)return{ok:true,absent:raw===null,conflict:raw!==null};
  return store.remove({raw,envelope:null});
 }
 return Object.freeze({prepare,prepareProgram,commit,resume,recover});
}
