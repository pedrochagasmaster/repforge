import {cloneSnapshot,exportableState,stripStorageMeta,draftProgramFingerprint,snapshotBlockId,readRevision} from '../persistence/snapshot.js';
import {backupFile,parseBackupFile,isLegacyBackup,BACKUP_MAX_BYTES} from '../interchange/backup.js';
import {csvFile} from '../interchange/csv.js';
/** Export acknowledges lastExport before producing bytes. Existing policy
 * accepts either durable replica, independently of workout settlement policy.
 * onExported owns rendering; user-initiated IO stays with the file capability. */
/** @template {{settings:Record<string,unknown>}} T
 * @template {{localOk?:boolean,idbOk?:boolean}} R
 * @param {{read:()=>T,commit:(value:T)=>Promise<R>,now:()=>string,date:()=>string,shareOrDownload:(text:string,name:string,type:string)=>unknown,onExported:()=>unknown}} commands */
export async function exportBackup({read,commit,now,date,shareOrDownload,onExported}){
  const proposal=cloneSnapshot(read());
  proposal.settings.lastExport=now();
  const result=await commit(proposal);
  if(!(result.localOk||result.idbOk))return result;
  const file=backupFile(exportableState(read()),date());
  shareOrDownload(file.text,file.name,'application/json');
  onExported();
  return result;
}

/** @typedef {import('../persistence/snapshot.js').RawSnapshot} RawSnapshot
 * @typedef {import('../persistence/snapshot.js').NormalizedSnapshot} Snapshot
 * @typedef {import('../persistence/contracts.js').StorageIO} StorageIO
 * @typedef {import('../persistence/contracts.js').CommitOptions} CommitOptions
 * @typedef {import('../persistence/contracts.js').OutcomeInput & {added?:number}} CommitResult
 * @typedef {ReturnType<typeof import('../persistence/snapshot.js').createSnapshotPolicy>} Policy
 * @typedef {ReturnType<typeof import('../training/model.js').createProgramModel>} Model
 */
/** Saved backups contain durable training/profile/history only. The concrete
 * commit owner retains journal, lock, rebase and destructive-draft settlement.
 * File formats remain pure; views receive the summary and named commands.
 * @param {{read:()=>Snapshot,
 * policy:Pick<Policy,'isValidStateShape'|'normalizeLoaded'|'migrateLogSnapshot'>,
 * model:Pick<Model,'normalizeCustomExercises'|'canonicalProgramDefinition'|'compilerCustomDefinitions'>,
 * drafts:{readRaw:()=>string|null,clearEffect:(raw:string|null)=>import('../persistence/contracts.js').EffectInput},
 * commit:(proposal:RawSnapshot,options:CommitOptions,io?:StorageIO)=>Promise<CommitResult>,
 * files:Pick<ReturnType<typeof import('../platform/files.js').createFiles>,'shareOrDownload'|'download'|'readText'>,
 * csv?:Omit<Parameters<typeof csvFile>[0],'state'|'date'>,
 * now:()=>string,date:()=>string,onExported:()=>unknown}} options */
export function createBackupCommands({read,policy,model,drafts,commit,files,csv,now,date,onExported}){
  /** @param {unknown} value */
  function isImportable(value){return policy.isValidStateShape(value)}
  /** @param {unknown} text @returns {RawSnapshot|null} */
  function parse(text){return /** @type {RawSnapshot|null} */(parseBackupFile(text,isImportable))}
  /** @param {RawSnapshot|null} value */
  function isLegacy(value){return isLegacyBackup(value,model)}
  /** @param {unknown} incoming */
  function proposal(incoming){
    if(!isImportable(incoming))throw new TypeError('Invalid Taurifer backup');
    return policy.normalizeLoaded(stripStorageMeta(incoming),{preserveInvalidProgression:true,source:'backup-restore'});
  }
  /** Capture the current transition and exact discard bytes synchronously.
   * The existing durable owner rechecks these under its actual lock.
   * @param {unknown} incoming @param {{discardDraftRaw?:string|null,io?:StorageIO}} [options] */
  async function replace(incoming,{discardDraftRaw=drafts.readRaw(),io}={}){
    const current=read();
    const transition={expectedProgramId:current.programMeta?.id||null,
      expectedProgramFingerprint:draftProgramFingerprint(current),expectedBlockId:/** @type {string|null} */(snapshotBlockId(current)),
      expectedStorageRevision:readRevision(current)};
    const next=proposal(incoming);delete next._storageFollowUp;policy.migrateLogSnapshot(next);
    return commit(next,{replace:true,effect:drafts.clearEffect(discardDraftRaw),...transition},io);
  }
  /** Merge whole unseen sessions; historical row identity and attribution stay
   * immutable. This operation does not import the file's active program/settings.
   * @param {unknown} incoming @param {{io?:StorageIO}} [options] @returns {Promise<CommitResult>} */
  async function merge(incoming,{io}={}){
    if(!isImportable(incoming))throw new TypeError('Invalid Taurifer backup');
    const current=read(),rows=(incoming.log||[]).filter(row=>row&&row.session);
    const have=new Set(current.log.map(row=>row.session)),add=rows.filter(row=>!have.has(row.session));
    const added=new Set(add.map(row=>row.session)).size;
    if(!added)return{revision:readRevision(current),localOk:true,idbOk:true,added:0};
    const next=cloneSnapshot(current);next.log=next.log.concat(cloneSnapshot(add));policy.migrateLogSnapshot(next);
    const result=await commit(next,{},io);result.added=added;return result;
  }
  /** @param {RawSnapshot} value */
  function describe(value){
    const current=read(),have=new Set(current.log.map(row=>row.session));
    return{inSessions:new Set(value.log.map(row=>row.session)).size,inSets:value.log.length,
      curSessions:have.size,curSets:current.log.length,
      newSessions:new Set(value.log.filter(row=>!have.has(row.session)).map(row=>row.session)).size};
  }
  /** @param {Pick<File,'size'|'text'>} file */
  async function readFile(file){
    if(Number.isFinite(file.size)&&file.size>BACKUP_MAX_BYTES)throw new TypeError('Invalid Taurifer backup');
    return parse(await files.readText(file));
  }
  function exportJson(){return exportBackup({read,commit:next=>commit(next,{}),now,date,
    shareOrDownload:files.shareOrDownload,onExported})}
  function exportCsv(){
    if(!csv)throw new TypeError('CSV readers unavailable');
    const file=csvFile({...csv,state:read(),date:date()});files.download(file.text,file.name,'text/csv');
  }
  return Object.freeze({isImportable,parse,isLegacy,describe,readFile,replace,merge,exportJson,exportCsv});
}
