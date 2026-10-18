import {cloneSnapshot} from '../../training/model.js';
/** @typedef {ReturnType<typeof import('../../training/generation.js').createGenerationRules>['compiler']} Compiler
 * @typedef {ReturnType<typeof import('../../training/authoring.js').createEntryAdapter>} Adapter
 * @typedef {ReturnType<typeof import('../../training/model.js').createProgramModel>} Model
 * @typedef {ReturnType<ReturnType<typeof import('../../training/authoring.js').createEntryRules>['createState']>} EntryDraft
 * @typedef {NonNullable<Parameters<Model['flatProgramFromDefinition']>[0]>} Definition
 * @typedef {Extract<ReturnType<Compiler['canonicalizeRequest']>,{ok:true}>['value']} Request
 * @typedef {Extract<ReturnType<Compiler['generateProgram']>,{ok:true}>['confirmationOffers']} Offers
 * @typedef {{ok:true,value:Definition,confirmationOffers?:Offers}|{ok:false,conflicts?:unknown[]}} Generated
 * @typedef {{ok:false,failure:{code:string,conflicts?:unknown[]}}} GenerationFailure
 */
/** Canonical Entry generation and its bounded app-lifetime recommendation cache.
 * The executor owns worker/main-thread selection. This owner maps answers,
 * identifies candidates and projects the exact definition used by Build/review.
 * Cache reads have no verifier, UI or storage effects.
 * @param {{compiler:Pick<Compiler,'canonicalizeRequest'|'generationIdentity'>,adapter:Pick<Adapter,'programRequestFromAnswers'>,
 * catalog:Parameters<Compiler['generationIdentity']>[1] & NonNullable<Parameters<Adapter['programRequestFromAnswers']>[1]>,model:Pick<Model,'flatProgramFromDefinition'>,
 * execute:(request:Request,options:{signal?:AbortSignal})=>Promise<{generated:Generated,cache:boolean}>,
 * candidateName:(days:number)=>string,onFailure:(error:unknown)=>void}} bindings */
export function createEntryGeneration({compiler,adapter,catalog,model,execute,candidateName,onFailure}){
 /** @type {Map<string,Extract<Generated,{ok:true}>>} */ const generatedCache=new Map();
 /** @param {Definition} definition @param {string|null} route */
 function preview(definition,route){
  const program=model.flatProgramFromDefinition(definition,[],1);
  const days=definition.days.filter(day=>day.kind==='training').map((day,index)=>({dayId:day.id,label:day.name,order:index+1,
   exercises:program.filter(row=>row.dayId===day.id).map(cloneSnapshot)}));
  return{source:route,frequency:days.length,program,programDefinition:definition,
   programStructure:{schemaVersion:1,days:days.map(({dayId,label,order})=>({dayId,label,order})),provenance:{source:'generated'}},
   days,customExercises:[],primaryMuscles:[]};
 }
 /** @param {EntryDraft} from @returns {{ok:true,request:Request}|GenerationFailure} */
 function request(from){
  const answers=from.answers||{},mapped=answers.programRequest?{ok:/** @type {true} */(true),value:cloneSnapshot(answers.programRequest)}:adapter.programRequestFromAnswers(answers,catalog);
  if(!mapped.ok)return{ok:false,failure:{code:'rules_changed',conflicts:mapped.conflicts}};
  const checked=compiler.canonicalizeRequest(mapped.value,catalog);
  return checked.ok?{ok:true,request:checked.value}:{ok:false,failure:{code:'rules_changed',conflicts:checked.issues}};
 }
 /** @param {EntryDraft} from @param {Request} request @param {Definition} definition */
 function candidate(from,request,definition){
  const answers=from.answers||{},projected=preview(definition,from.route),days=projected.days;
  return{fingerprint:compiler.generationIdentity(request,catalog),name:candidateName(days.length),
   selected:{id:'generated',source:'generator',daysPerWeek:days.length},candidates:[],alternative:null,preview:projected,
   telemetry:{goal:answers.desiredResult,frequency:String(days.length),family:'generated'},
   explanation:Object.fromEntries(Object.entries({desiredResult:answers.desiredResult,structuredExperience:answers.structuredExperience,
    daysPerWeek:days.length,sessionMinutes:answers.sessionMinutes,mainConstraint:answers.environment?.kind}).filter(([,value])=>value!==undefined))};
 }
 /** @param {EntryDraft} from @param {{signal?:AbortSignal}} [options]
  * @returns {Promise<GenerationFailure|{ok:true,result:ReturnType<typeof candidate>,confirmationOffers:Offers,request:Request,definition:Definition}>} */
 async function generate(from,{signal}={}){
  const mapped=request(from);if(!mapped.ok)return mapped;
  let execution;
  try{execution=await execute(mapped.request,{signal})}catch(error){
   if(error&&typeof error==='object'&&'name' in error&&error.name==='AbortError')throw error;
   onFailure(error);return{ok:false,failure:{code:'rebuild_failed'}};
  }
  const {generated,cache}=execution;
  if(signal?.aborted)throw new DOMException('The generation request was superseded','AbortError');
  if(!generated.ok)return{ok:false,failure:{code:'generation_conflict',conflicts:generated.conflicts||[]}};
  if(cache){const key=compiler.generationIdentity(mapped.request,catalog);generatedCache.delete(key);generatedCache.set(key,cloneSnapshot(generated));
   while(generatedCache.size>4){const oldest=generatedCache.keys().next().value;if(oldest===undefined)break;generatedCache.delete(oldest)}}
  const definition=cloneSnapshot(generated.value);
  return{ok:true,result:candidate(from,mapped.request,definition),confirmationOffers:cloneSnapshot(generated.confirmationOffers||[]),request:cloneSnapshot(mapped.request),definition};
 }
 /** @param {EntryDraft} from */
 function peek(from){
  const mapped=request(from);if(!mapped.ok)return null;
  const generated=generatedCache.get(compiler.generationIdentity(mapped.request,catalog));if(!generated)return null;
  const result=candidate(from,mapped.request,cloneSnapshot(generated.value));
  return{result,confirmationOffers:cloneSnapshot(generated.confirmationOffers||[]),request:mapped.request,definition:result.preview.programDefinition};
 }
 return Object.freeze({preview,request,generate,peek});
}
