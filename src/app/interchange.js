import {cloneSnapshot,exportableState} from '../persistence/snapshot.js';
import {backupFile} from '../interchange/backup.js';
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
