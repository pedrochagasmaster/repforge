import {createSession} from '../session.js';
import {cloneSnapshot} from '../../training/model.js';
/** @typedef {ReturnType<typeof import('../../training/authoring.js').createEntryRules>} Rules
 * @typedef {ReturnType<Rules['createState']>} Draft
 * @typedef {ReturnType<typeof import('../../persistence/setup-draft.js').createSetupDraftStore>} Store
 * @typedef {{writeSetupDraft?:(raw:string)=>void|Promise<void>}} WriteAdapter
 * @typedef {{operation:string,ok:boolean,code:string|null,issues:string[]}} Diagnostic
 */
/** @param {unknown} value @returns {value is Record<string,unknown>} */
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
/** JSON projection strips derivable receipt attribution from the persisted
 * candidate only. The editor keeps its richer acknowledged logical snapshot.
 * @param {Draft} value @returns {Draft} */
function persistenceProjection(value){
 const projected=cloneSnapshot(value);
 /** @param {unknown} structure */
 function project(structure){
  if(!object(structure)||!Array.isArray(structure.weekPrescriptions))return;
  /** @type {unknown[]} */const receipts=structure.weekPrescriptions;
  structure.weekPrescriptions=receipts.map(receipt=>{
   if(!object(receipt)||!Array.isArray(receipt.days))return receipt;
   /** @type {unknown[]} */const days=receipt.days;
   return {...receipt,days:days.map(day=>{
    if(!object(day)||!Array.isArray(day.slots))return day;
    /** @type {unknown[]} */const slots=day.slots;
    return {...day,slots:slots.map(slot=>object(slot)?{slotId:slot.slotId,sets:slot.sets}:slot)};
   })};
  });
 }
 project(projected.result?.preview?.programStructure);
 const alternative=projected.result?.alternative;
 if(object(alternative)&&object(alternative.preview))project(alternative.preview.programStructure);
 return projected;
}
/** Entry's live draft, resume decisions and save/rebase commands. Storage CAS
 * stays in its concrete store; presentation receives the exact frozen snapshot.
 * @param {{rules:Rules,store:Store,nextId:()=>string,now:()=>string,
 * context:()=>{versions:Record<string,unknown>,activeProgramRevision:number},
 * mutationFrozen:()=>boolean,onUpdate:(draft:Readonly<Draft>|null)=>void,
 * onFailure:(kind:'save_conflict')=>void,onDiagnostic:(value:Diagnostic)=>void}} options */
export function createEntrySetup({rules,store,nextId,now,context,mutationFrozen,onUpdate,onFailure,onDiagnostic}){
 /** @type {{initialSnapshot:Draft|null,onUpdate:(draft:Readonly<Draft|null>)=>void}} */
 const sessionOptions={initialSnapshot:null,onUpdate};
 const session=createSession(sessionOptions);
 /** @param {Partial<Parameters<Rules['createState']>[0]>} [extra] */
 function create(extra={}){const runtime=context();return rules.createState({draftId:nextId(),activeProgramRevisionAtStart:runtime.activeProgramRevision,now:now(),versions:runtime.versions,...extra})}
 /** @param {Draft|null} next */
 function publish(next){return session.publish(next)}
 /** Save stages synchronously, preserving the existing latest-command-wins
  * identity checks while a write waits for the cross-tab lock.
  * @param {Draft|null} next @param {{io?:WriteAdapter,production?:boolean}} [options] */
 function save(next,{io,production=true}={}){
  if(next?.route==='shared'){publish(next);return Promise.resolve({ok:true,transient:true})}
  if(production&&mutationFrozen())return Promise.resolve({ok:false,conflict:true,code:'install-transfer-frozen'});
  if(!next)return Promise.resolve({ok:false});
  if(store.isConflicted()){onFailure('save_conflict');return Promise.resolve({ok:false,conflict:true})}
  const stamped=rules.updateTimestamp(next,now()),normalized=rules.normalizeSetupDraft(persistenceProjection(stamped));
  if(!normalized.ok){
   onDiagnostic({operation:'normalize',ok:false,code:normalized.code||'setup-draft-invalid',issues:normalized.issues.slice(0,12).map(issue=>String(issue).slice(0,240))});
   return Promise.resolve({ok:false,invalid:true,code:normalized.code||'setup-draft-invalid',issues:normalized.issues.slice(0,12)});
  }
  onDiagnostic({operation:'normalize',ok:true,code:null,issues:[]});
  const rich={...normalized.value,result:stamped.result};publish(rich);
  return store.write(normalized.value,rich,io);
 }
 /** @param {Draft} next @param {Readonly<Draft>|null} [previous] */
 async function saveRules(next,previous=session.read()){
  const pending=save(next),attempted=session.read(),result=await pending;
  if(!result.ok){const accepted=store.baseline();if('conflict' in result&&result.conflict&&accepted)publish(accepted);else if(session.read()===attempted)publish(previous)}
  return result;
 }
 /** Resume observes and adopts one concrete storage record; no payload from a
  * shared link or a pasted source is included in this command.
  * @param {{forceFresh?:boolean,resume?:boolean}} [options] */
 function start({forceFresh=false,resume=true}={}){
  const record=store.readRecord(),handle=record.raw!==null?{raw:record.raw,envelope:record.envelope}:null;
  /** @type {'corrupt'|'conflict'|'rules_changed'|'resume'|null} */let notice=null;
  let next,cleared=false;
  if(forceFresh||resume===false){store.adopt(handle,session.read());store.clear();cleared=true;next=create()}
  else if(record.raw&&record.ok&&record.envelope){
   const runtime=context(),resumed=rules.resumeSetupDraft(record.envelope.state,{currentVersions:runtime.versions,liveActiveProgramRevision:runtime.activeProgramRevision,pinnedVersionsExecutable:false});
   if(!resumed.ok){store.adopt(handle,session.read());store.clear();cleared=true;notice='corrupt';next=create()}
   else{
    next=resumed.value.state;
    if(resumed.value.status==='activation_conflict')notice='conflict';
    else if(resumed.value.status==='rules_changed')notice='rules_changed';
    else if(next.route||Object.keys(next.answers).length)notice='resume';
    else next=create();
   }
  }else if(record.raw&&!record.ok){store.adopt(handle,session.read());store.clear();cleared=true;notice='corrupt';next=create()}
  else next=create();
  publish(next);store.adopt(handle,next);return{notice,cleared};
 }
 async function keep(){await store.flush();return store.failure()===null}
 async function discard(){await store.flush();return store.clear()}
 return Object.freeze({read:session.read,publish,create,save,saveRules,start,keep,discard});
}
