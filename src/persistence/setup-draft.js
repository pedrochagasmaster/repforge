/** Resumable Entry draft ownership. The queue and byte-level CAS belong to
 * this concrete record, separately from the installed training snapshot.
 * Shared-link proposals never reach write(); the application keeps them private.
 */
export const SETUP_DRAFT_KEY='repforge_program_setup_draft_v1';
/** @typedef {ReturnType<typeof import('../training/authoring.js').createEntryRules>} Rules
 * @typedef {ReturnType<Rules['createState']>} Draft
 * @typedef {Extract<ReturnType<Rules['normalizeSetupDraftEnvelope']>,{ok:true}>['value']['envelope']} Envelope
 * @typedef {{raw:string,envelope:Envelope|null}} Handle
 * @typedef {{ok?:never,conflict:boolean,transferFrozen:boolean,code:string|null,localOk:boolean,idbOk:boolean}} FrozenWrite
 * @typedef {{ok:true,absent?:boolean,envelope?:Envelope}|{ok:false,conflict?:boolean,writeFailed?:boolean,invalid?:boolean}} WriteResult
 */
/** @param {{rules:Rules,storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,lock:<T>(operation:()=>T|Promise<T>)=>Promise<T|FrozenWrite>,ownerId:string,onFailure:(kind:'save_failed'|'save_conflict',error?:unknown)=>void,onSaved:()=>void}} options */
export function createSetupDraftStore({rules,storage,lock,ownerId,onFailure,onSaved}){
 /** @type {Handle|null} */ let owned=null;
 /** @type {Draft|null} */ let accepted=null;
 let conflicted=false,failed=false;
 /** @type {Promise<unknown>} */ let tail=Promise.resolve();
 /** @template T @param {T} value @returns {T} */
 const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
 function readRaw(){try{return storage.getItem(SETUP_DRAFT_KEY)}catch{return null}}
 function readRecord(){
  const raw=readRaw();if(raw===null)return{raw:null,envelope:null,migrated:false,ok:true};
  const normalized=rules.normalizeSetupDraftEnvelope(raw);
  return normalized.ok?{raw,envelope:normalized.value.envelope,migrated:normalized.value.migrated,ok:true}:
   {raw,envelope:null,migrated:false,ok:false,issues:normalized.issues};
 }
 /** Adoption is only for a record read under its owning protocol. It does not
  * write storage or publish an application draft.
  * @param {Handle|null} handle @param {Draft|null} logical */
 function adopt(handle,logical){owned=clone(handle);accepted=clone(logical);conflicted=false;failed=false}
 /** @param {Draft} next @returns {Envelope} */
 function freshEnvelope(next){return{schemaVersion:rules.SCHEMA_VERSION,draftId:next.draftId,revision:0,ownerId:null,state:next}}
 /** A transferred candidate starts a fresh local ownership revision.
  * @param {Draft} next @returns {Envelope} */
 function importedEnvelope(next){return rules.advanceSetupDraftEnvelope(freshEnvelope(next),next,ownerId)}
 /** Transfer uses this same queue and production lock.
  * @template T @param {()=>T|Promise<T>} operation @returns {Promise<T>} */
 function enqueue(operation){const pending=tail.then(operation,operation);tail=pending.catch(()=>{});return pending}
 /** @template T @param {()=>T|Promise<T>} operation @returns {Promise<T|FrozenWrite>} */
 function transaction(operation){return enqueue(()=>lock(operation))}
 /** Must run under the production lock. Exact bytes protect a newer writer.
  * @param {Handle|null} handle @returns {WriteResult} */
 function removeObserved(handle){
  if(!handle)return{ok:true,absent:true};
  if(readRaw()!==handle.raw)return{ok:false,conflict:true};
  try{storage.removeItem(SETUP_DRAFT_KEY)}catch(error){failed=true;onFailure('save_failed',error);return{ok:false,writeFailed:true}}
  if(owned?.raw===handle.raw)adopt(null,null);
  return{ok:true};
 }
 /** @param {Handle|null} [handle] @returns {Promise<WriteResult|FrozenWrite>} */
 function remove(handle=clone(owned)){return !handle?Promise.resolve({ok:true,absent:true}):transaction(()=>removeObserved(handle))}
 // Resolve the handle when the queued operation runs: an earlier pending write
 // may advance it before clear obtains the lock.
 function clear(){return transaction(()=>removeObserved(owned))}
 /** The caller stages the rich logical draft synchronously before queuing.
  * Each successful write remembers this call's logical value, never a later
  * optimistic application draft. Only the write adapter is replaceable; the
  * lock is always the production capability supplied at composition.
  * @param {Draft} queued @param {Draft} logical @param {{writeSetupDraft?:(raw:string)=>void|Promise<void>}} [io]
  * @returns {Promise<WriteResult|FrozenWrite>} */
 function write(queued,logical,io={}){
  if(conflicted){onFailure('save_conflict');return Promise.resolve({ok:false,conflict:true})}
  const state=clone(queued),baseline=clone(logical);
  return transaction(async()=>{
   const handle=owned||{raw:null,envelope:freshEnvelope(state)};
   if(readRaw()!==handle.raw){conflicted=true;onFailure('save_conflict');return{ok:false,conflict:true}}
   let envelope;
   try{envelope=rules.advanceSetupDraftEnvelope(handle.envelope,state,ownerId)}
   catch(error){failed=true;onFailure('save_failed',error);return{ok:false,invalid:true}}
   const raw=JSON.stringify(envelope);
   try{if(typeof io.writeSetupDraft==='function')await io.writeSetupDraft(raw);else storage.setItem(SETUP_DRAFT_KEY,raw)}
   catch(error){failed=true;onFailure('save_failed',error);return{ok:false,writeFailed:true}}
   owned={raw,envelope};accepted=baseline;failed=false;onSaved();return{ok:true,envelope:clone(envelope)};
  });
 }
 return Object.freeze({readRaw,readRecord,importedEnvelope,transaction,removeObserved,remove,clear,write,adopt,
  handle:()=>clone(owned),baseline:()=>clone(accepted),isConflicted:()=>conflicted,failure:()=>conflicted?'save_conflict':failed?'save_failed':null,flush:()=>tail});
}
