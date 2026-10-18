import {copySnapshot} from './session.js';
import {draftProgramFingerprint,readRevision,snapshotBlockId} from '../persistence/snapshot.js';

/** @typedef {import('../training/model.js').ModelSnapshot & {log:import('./session.js').HistoryRow[],program:import('../training/model.js').ExerciseInput[],programMeta:import('../training/model.js').ProgramMeta & {id?:string,name?:string,daysPerWeek?:number},customExercises:import('../training/model.js').LibraryEntry[],[key:string]:unknown}} Snapshot
 * @typedef {import('./session.js').CommitResult} CommitResult
 * @typedef {import('./session.js').CommitOptions} CommitOptions
 * @typedef {import('./session.js').DraftEffect} DraftEffect
 * @typedef {ReturnType<typeof import('../training/model.js').createProgramModel>} Model
 * @typedef {{readRaw:()=>string|null,hasProgress:()=>boolean,resetIdentity:()=>void,removedSetsHaveProgress:(id:string,next:number,previous:number,draft:Record<string,unknown>)=>boolean,preserve:(raw:string|null)=>DraftEffect,clear:(raw:string|null)=>DraftEffect,rename:(oldName:string,nextName:string,proposal:Snapshot)=>DraftEffect}} Drafts
 */

/** The retained text/row editor uses named commands too. The model owns row
 * normalization; the editor transaction owns private-vs-installed publication.
 * This module owns proposal construction and exact captured draft effects.
 * @param {{read:()=>Snapshot,model:Model,editor:{read:()=>Snapshot,isSetup:()=>boolean,commit:(proposal:Snapshot,options?:CommitOptions)=>Promise<CommitResult>},drafts:Drafts,policy:{migrateLogSnapshot:(snapshot:Snapshot)=>unknown},flush:()=>Promise<unknown>}} options */
export function createProgramFormCommands({read,model,editor,drafts,policy,flush}){
  function working(){const proposal=copySnapshot(editor.read());return{proposal,program:model.makeProgram(proposal.program,model.snapshotLookup(proposal.customExercises),proposal.programMeta)}}
  /** @param {Snapshot} proposal @param {ReturnType<Model['makeProgram']>} program @param {CommitOptions} [options] */
  function publish(proposal,program,options={}){proposal.program=program.toJSON();return editor.commit(proposal,options)}
  /** @param {{id:string,field:string,value:string}} request */
  async function editField({id,field,value}){
    const {proposal,program}=working(),current=program.find(id);if(!current)return{localOk:false,idbOk:false,missing:true};
    let effect=null;
    if(field==='sets'&&!editor.isSetup()){
      const next=model.Exercise.posInt(value,current.sets);
      if(next<current.sets){
        const raw=drafts.readRaw();
        /** @type {Record<string,unknown>} */
        let draft={};
        try{const parsed=JSON.parse(raw||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))draft=parsed}catch{}
        if(drafts.removedSetsHaveProgress(id,next,current.sets,draft))return lockedSets();
        effect=drafts.preserve(raw);if(!('status' in effect)||effect.status!=='valid')return lockedSets();
      }
    }
    program.update(id,field,value);return publish(proposal,program,{effect});
  }
  /** @param {{oldName:string,nextName:string}} request */
  async function renameDay({oldName,nextName}){
    const {proposal,program}=working();if(!program.renameDay(oldName,nextName))
      return{localOk:false,idbOk:false,invalid:true,code:program.days().includes(nextName)?'day-exists':'day-rename-failed'};
    proposal.program=program.toJSON();model.syncProgramStructureFromProgram(proposal,program);
    return editor.commit(proposal,{effect:drafts.rename(oldName,nextName,proposal),dayRenames:[{from:oldName,to:nextName}]});
  }
  /** @param {{day:string,entry:Parameters<ReturnType<Model['makeProgram']>['addExercise']>[1]}} request */
  async function addExercise({day,entry}){const {proposal,program}=working();program.addExercise(day,entry);return publish(proposal,program)}
  /** @param {{id:string,entry:Parameters<ReturnType<Model['makeProgram']>['replaceExercise']>[1]}} request */
  async function replaceExercise({id,entry}){const {proposal,program}=working();if(!program.replaceExercise(id,entry))return missing();return publish(proposal,program)}
  /** @param {{id:string}} request */
  async function detachExercise({id}){const {proposal,program}=working();if(!program.detachExercise(id))return missing();return publish(proposal,program)}
  /** Preserve the retained form's acknowledgement policy while putting the
   * session identity transition with its destructive command, never the view.
   * @param {CommitResult} result */
  function afterRemoval(result){if(!editor.isSetup()&&(result.localOk||result.idbOk)){drafts.resetIdentity();return{...result,resetDraftPresentation:true}}return result}
  /** @param {{id:string,discardDraftRaw:string|null}} request */
  async function removeExercise({id,discardDraftRaw}){const {proposal,program}=working();program.removeExercise(id);return afterRemoval(await publish(proposal,program,{effect:drafts.clear(discardDraftRaw)}))}
  /** @param {{id:string,direction:number}} request */
  async function moveExercise({id,direction}){const {proposal,program}=working();program.move(id,direction);return publish(proposal,program)}
  /** @param {{day:string,discardDraftRaw:string|null}} request */
  async function removeDay({day,discardDraftRaw}){const {proposal,program}=working();program.removeDay(day);proposal.program=program.toJSON();model.syncProgramStructureFromProgram(proposal,program);return afterRemoval(await editor.commit(proposal,{effect:drafts.clear(discardDraftRaw)}))}
  async function addDay(){const {proposal,program}=working(),day=program.addDay();proposal.program=program.toJSON();model.syncProgramStructureFromProgram(proposal,program);return{...await editor.commit(proposal),day}}
  /** @param {string} value */
  async function updateEditorName(value){const proposal=copySnapshot(editor.read());if(!proposal.programMeta)return missing();proposal.programMeta.name=value.trim()||proposal.programMeta.name;return editor.commit(proposal)}
  /** @param {{value:unknown,discardDraftRaw:string|null}} request */
  async function replaceDefinition({value,discardDraftRaw}){
    const proposal=copySnapshot(editor.read()),snapshot=read();
    const blockId=snapshotBlockId(snapshot);
    if(!editor.isSetup()&&blockId!==null&&typeof blockId!=='string')return{localOk:false,idbOk:false,invalid:true,code:'invalid-program-block-identity'};
    const transition=editor.isSetup()?{}:{expectedProgramId:snapshot.programMeta?.id||null,
      expectedProgramFingerprint:draftProgramFingerprint(snapshot),expectedBlockId:typeof blockId==='string'?blockId:null,expectedStorageRevision:readRevision(snapshot)};
    const definition=model.canonicalProgramDefinition(value,proposal.customExercises||[]);
    if(!definition)return{localOk:false,idbOk:false,invalid:true,code:'invalid-definition'};
    proposal.programMeta={...(proposal.programMeta||{}),programDefinition:definition,
      daysPerWeek:definition.days.filter(day=>day.kind==='training').length,mesocycleLengthWeeks:definition.cycles};
    proposal.program=model.durableProgramRows(definition,proposal.customExercises||[],proposal.programMeta);
    policy.migrateLogSnapshot(proposal);
    return afterRemoval(await editor.commit(proposal,{effect:drafts.clear(discardDraftRaw),...transition}));
  }
  /** @param {unknown} value */
  function validDefinition(value){return !!model.canonicalProgramDefinition(value,editor.read().customExercises||[])}
  function captureRemoval(){return{active:!editor.isSetup()&&drafts.hasProgress(),raw:editor.isSetup()?null:drafts.readRaw()}}
  return Object.freeze({captureRemoval,validDefinition,editField,renameDay,addExercise,replaceExercise,detachExercise,removeExercise,moveExercise,removeDay,addDay,updateEditorName,replaceDefinition,flush});
}
function missing(){return{localOk:false,idbOk:false,missing:true}}
function lockedSets(){return{localOk:false,idbOk:false,code:'set-count-locked'}}
