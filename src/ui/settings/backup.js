/** Saved-backup selection/confirmation. The app owns parsing, restore/merge,
 * session identity and settlement; this view owns modal lifetime and feedback. */
/** @typedef {ReturnType<typeof import('../../app/interchange.js').createBackupCommands>} Commands
 * @typedef {import('../../persistence/snapshot.js').RawSnapshot} Snapshot
 * @typedef {import('../../persistence/contracts.js').StorageIO} StorageIO
 * @typedef {ReturnType<Commands['describe']> & {s:Snapshot,io?:StorageIO|null,opener?:Element|null,bodyKey?:string,programOnly?:(()=>unknown)|null}} Choice
 */
/** @param {{window:Window & typeof globalThis,commands:Pick<Commands,'describe'|'readFile'|'isImportable'|'isLegacy'|'replace'|'merge'>,
 * copy:{t:(key:string,vars?:Record<string,unknown>)=>string,tOne:(key:string,n:number,vars?:Record<string,unknown>)=>string,tp:(n:number,word:string)=>string},
 * shell:{openModal:(el:HTMLElement,options:{initialFocus:HTMLElement|null,returnFocus:Element|null,onEscape:()=>unknown})=>unknown,closeModal:(el:HTMLElement)=>unknown,canTakeFocus:(el:Element|null)=>boolean},
 * toast:(message:string)=>unknown,onImported:(kind:'replace'|'merge')=>unknown}} options */
export function createBackupView({window,commands,copy,shell,toast,onImported}){
 const document=window.document,{t,tOne,tp}=copy;
 /** @param {string} selector */
 const $=selector=>/** @type {HTMLElement} */(document.querySelector(selector));
 /** Presentation handoff from either the saved-backup or program-file door.
  * @param {Snapshot} s @param {Element|null} [opener] @param {StorageIO} [io] @returns {Choice} */
 function context(s,opener,io){return{s,io:io||null,opener,...commands.describe(s)}}
 /** @param {Choice} ctx */
 function open(ctx){
  const dialog=$('#importChoice'),bodyKey=ctx.bodyKey||'dialog.import.body',mergeable=ctx.inSessions>0;
  $('#importChoiceBody').textContent=t(mergeable?bodyKey:`${bodyKey}_nolog`,{curSessions:ctx.curSessions,curSets:ctx.curSets,inSessions:ctx.inSessions,inSets:ctx.inSets,newSessions:ctx.newSessions});
  const active=document.activeElement;
  const opener=shell.canTakeFocus(active)?active:(ctx.opener?.closest('label')||$('#importJson')?.closest('label')||$('#dataImportRow'));
  const close=()=>shell.closeModal(dialog),only=$('#importProgramOnly'),merge=$('#importMerge');
  if(only)only.classList.toggle('hidden',!ctx.programOnly);if(merge)merge.classList.toggle('hidden',!mergeable);
  shell.openModal(dialog,{initialFocus:$('#importCancel'),returnFocus:opener,onEscape:close});
  let busy=false;
  $('#importCancel').onclick=()=>{if(busy)return;close();toast(t('toast.import_cancelled'))};
  if(only)only.onclick=()=>{if(busy||!ctx.programOnly)return;close();ctx.programOnly()};
  $('#importReplace').onclick=async()=>{
   if(busy)return;busy=true;
   try{const result=await commands.replace(ctx.s,{...(ctx.io?{io:ctx.io}:{})});
    if(result.localOk||result.idbOk){close();onImported('replace');toast(tOne('toast.imported_sessions',ctx.inSessions,{sessions:ctx.inSessions}))}
   }finally{busy=false}
  };
  $('#importMerge').onclick=async()=>{
   if(busy)return;busy=true;
   try{const result=await commands.merge(ctx.s,{...(ctx.io?{io:ctx.io}:{})});
    if(result.added===0){close();toast(t('toast.nothing_to_merge'));return}
    if(result.localOk||result.idbOk){close();onImported('merge');const added=result.added||0;toast(t('toast.merged_sessions',{n:added,sessions:tp(added,'session')}))}
   }finally{busy=false}
  };
 }
 /** @param {{target:HTMLInputElement}} event */
 async function importJson(event){
  const file=event.target.files?.[0];if(!file)return;
  try{
   const value=await commands.readFile(file);
   if(!value||!commands.isImportable(value))throw new TypeError('Invalid Taurifer backup');
   if(commands.isLegacy(value)){toast(t('toast.backup_legacy'));event.target.value='';return}
   open(context(value,event.target));
  }catch{toast(t('toast.import_invalid'))}
  event.target.value='';
 }
 return Object.freeze({context,open,importJson});
}
