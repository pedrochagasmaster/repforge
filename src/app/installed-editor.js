import {copySnapshot} from './session.js';
import {createProgramCommands} from './program.js';
import {createInstalledEditorRules} from '../training/authoring.js';
import {draftProgramFingerprint,readRevision,snapshotBlockId} from '../persistence/snapshot.js';
/** @typedef {import('../training/authoring/internal/editor-contracts.js').EditorDocument} Document
 * @typedef {import('../training/authoring/internal/editor-contracts.js').InstalledIntent} Intent
 * @typedef {import('../training/authoring/internal/editor-contracts.js').EditorDraft} RawDraft
 * @typedef {import('./session.js').Snapshot & import('../training/authoring/internal/editor-contracts.js').EditorSnapshot} Snapshot
 * @typedef {import('./program.js').EditorToken} Token
 * @typedef {import('./session.js').DraftEffect} Effect
 * @typedef {ReturnType<typeof createInstalledEditorRules>} Rules
 * @typedef {{readRaw:()=>string|null,hasProgress:()=>boolean,parse:(raw:string|null)=>{kind:string},clear:(raw:string|null)=>Effect|null,rename:(before:string,after:string,proposal:Document)=>Effect|null,removedSetsHaveProgress:(id:string,next:number,previous:number,draft:RawDraft)=>boolean}} Drafts
 */
/** The installed editor owns a speculative document/intents until qualified
 * Apply. Canonical edits/rebase belong to training; this owner captures draft
 * effects and coordinates the real existing lock-held durable command.
 * @param {{read:()=>Snapshot,refreshHead:()=>Promise<{conflict?:boolean,head?:Snapshot}>,commit:import('./session.js').Commit,model:ReturnType<typeof import('../training/model.js').createProgramModel>,catalog:import('../training/generation/internal/compiler-contracts.js').SourceCatalog,nextId:()=>string,defaultMeta:(log:unknown[])=>import('../training/authoring/internal/editor-contracts.js').EditorMeta,now:()=>string,readRecovery:()=>import('../training/model/internal/contracts.js').RecoveryRecord|null,drafts:Drafts,readActiveDraft:()=>import('../training/workout-contracts.js').Draft|null,onSettled:(result:import('./session.js').CommitResult,context:{draftBefore:import('../training/workout-contracts.js').Draft|null})=>void}} options */
export function createInstalledEditor({read,refreshHead,commit,model,catalog,nextId,defaultMeta,now,readRecovery,drafts,readActiveDraft,onSettled}){
  const rules=createInstalledEditorRules({model,catalog,nextId,defaultProgramMeta:defaultMeta});
  /** @type {{document:Document,token:Token|undefined,edits:Intent[]}|null} */ let session=null;
  /** Durable heads are normalized by the snapshot owner before they enter this
   * application boundary. The shared durable type preserves unknown historical
   * fields; authoring consumes the narrower normalized projection only.
   * @param {import('./session.js').Snapshot} snapshot */
  const authoringSnapshot=snapshot=>/** @type {Snapshot} */(snapshot);
  /** @param {import('./session.js').Snapshot} snapshot */
  function token(snapshot){return{revision:readRevision(snapshot),programId:snapshot.programMeta?.id||null,blockId:typeof snapshotBlockId(snapshot)==='string'?String(snapshotBlockId(snapshot)):null,fingerprint:draftProgramFingerprint(snapshot)}}
  /** @param {import('./program.js').EditorDocument} document */
  const authoringDocument=document=>/** @type {Document} */(document);
  /** @param {Document} document @param {Snapshot} base @param {Intent[]} edits */
  function impact(document,base,edits){
    const current=rules.editorDocumentFromSnapshot(base),next=rules.editorDocumentFromSnapshot(document);
    const active=drafts.hasProgress(),raw=drafts.readRaw();
    if(!active)return{active:false,incompatible:false,harmless:true,effect:drafts.parse(raw).kind==='valid'?drafts.clear(raw):null};
    /** @type {RawDraft & {program?:{dayLabel?:string},__day?:string}} */ let draft={};
    try{const parsed=JSON.parse(raw||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))draft=parsed}catch{}
    const referenced=rules.editorDraftExerciseIds(draft),day=draft.schemaVersion===2?draft.program?.dayLabel:draft.__day;
    const byId=new Map(current.program.map(row=>[row.id,row]));
    let incompatible=false;
    /** @type {Effect|null} */ let effect=null;
    for(const edit of edits){
      if(['exercise_remove','exercise_replace','exercise_move'].includes(edit.kind)){
        if(referenced.has(String(edit.targetId)))incompatible=true;
      }else if(edit.kind==='day_remove'){if(day===edit.targetDay)incompatible=true;
      }else if(edit.kind==='prescription'&&edit.field==='sets'&&edit.after<edit.before&&referenced.has(String(edit.targetId))){
        const before=byId.get(edit.targetId);if(before&&drafts.removedSetsHaveProgress(String(edit.targetId),edit.after,Number(before.sets),draft))incompatible=true;
      }else if(edit.kind==='day_name'&&day===edit.before&&rules.editorDocumentDays(next).includes(edit.after)){
        effect=drafts.rename(edit.before,edit.after,next);if(!effect||!('status' in effect)||effect.status!=='valid')incompatible=true;
      }
    }
    if(!edits.length){
      for(const id of referenced){
        const before=byId.get(id),after=next.program.find(row=>row.id===id);
        if(!after||before?.day!==after.day||before?.libraryId!==after.libraryId||before?.movementId!==after.movementId){incompatible=true;break}
        if(before&&Number(after.sets)<Number(before.sets)&&drafts.removedSetsHaveProgress(id,Number(after.sets),Number(before.sets),draft)){incompatible=true;break}
      }
      if(day&&!rules.editorDocumentDays(next).includes(day))incompatible=true;
    }
    return{active:true,incompatible,harmless:!incompatible,effect:incompatible?null:effect};
  }
  const commands=createProgramCommands({read,refreshHead,commit,defaultMeta,now,
    authoring:{token,tokenEqual:(a,b)=>rules.editorTokenEqual(a,b),
      rebaseDocument:(captured,head)=>{const result=rules.editorRebaseDocument({edits:/** @type {Intent[]} */(captured.edits)},authoringSnapshot(head));
        return result.conflict||!result.document?{conflict:true,code:result.code}:{conflict:false,document:result.document}},
      confirmOptIn:document=>{const result=rules.suggestion.confirm(authoringDocument(document),rules.editorSuggestLoadsPolicy);
        return result.ok&&result.document?{ok:true,document:result.document}:{ok:false,issues:result.issues||[]}},
      impact:(document,head,edits)=>impact(authoringDocument(document),authoringSnapshot(head),/** @type {Intent[]} */(edits)),
      snapshotFromDocument:(document,head)=>{
        const recovery=readRecovery();
        const currentRules=recovery?createInstalledEditorRules({model,catalog,nextId,defaultProgramMeta:defaultMeta,recoveryRecord:recovery}):rules;
        return /** @type {Snapshot} */(currentRules.editorSnapshotFromDocument(authoringDocument(document),authoringSnapshot(head)));
      }},
    drafts:{readRaw:drafts.readRaw,clearEffect:drafts.clear,dayReplacementEffect:(before,after,proposal)=>drafts.rename(before,after,rules.editorDocumentFromSnapshot(authoringSnapshot(proposal)))}});
  function readDocument(){return{document:rules.editorDocumentFromSnapshot(read()),token:token(read())}}
  /** @param {{expectedToken?:Token,nextDocument:Document,intent:Intent|{kind:'apply',edits?:Intent[]}|{kind:'apply_discard_workout',edits?:Intent[]}}} request */
  async function commitDocument({expectedToken,nextDocument,intent}){
    if(intent.kind!=='apply'&&intent.kind!=='apply_discard_workout'){
      const baseline=session?.document||readDocument().document,staged=copySnapshot(nextDocument);
      if(!rules.syncEditorCanonicalIntent(staged,baseline,intent,{cycleIndex:Number(intent.cycleIndex)||model.mesocycleLifecycle(read().programMeta).current||1}))
        return{ok:false,invalid:true,code:'invalid_canonical_editor_intent'};
      if(!session)session={document:copySnapshot(baseline),token:copySnapshot(expectedToken),edits:[]};
      session.document=staged;session.edits.push(copySnapshot(intent));
      return{ok:true,staged:true,document:copySnapshot(staged),token:copySnapshot(expectedToken)};
    }
    const edits=session?.edits||intent.edits||[];
    const capturedSession=session,draftBefore=readActiveDraft();
    /** @type {import('./session.js').CommitResult} */
    const result=await commands.applyEdits({expectedToken,nextDocument,edits,discardWorkout:intent.kind==='apply_discard_workout'});
    if(result.committed===true&&result.settled===true){if(session===capturedSession)session=null;onSettled(result,{draftBefore});return{...result,ok:true,token:token(read())}}
    return{...result,ok:false,conflict:!!(result.conflict||result.staleRevision)};
  }
  return Object.freeze({read:readDocument,commit:commitDocument,reset:()=>{session=null},readSession:()=>copySnapshot(session),commands,rules});
}
