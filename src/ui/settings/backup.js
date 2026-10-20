/** Saved-backup selection/confirmation. The app owns parsing, restore/merge,
 * session identity and settlement; this view owns modal lifetime and feedback. */
/** @typedef {ReturnType<typeof import('../../app/interchange.js').createBackupCommands>} Commands
 * @typedef {import('../../app/interchange.js').RawSnapshot} Snapshot
 * @typedef {import('../../app/interchange.js').StorageIO} StorageIO
 * @typedef {ReturnType<Commands['describe']> & {s:Snapshot,io?:StorageIO|null,opener?:Element|null,bodyKey?:string,programOnly?:(()=>unknown)|null}} Choice
 */
/** @param {{window:Window & typeof globalThis,commands:Pick<Commands,'describe'|'readFile'|'isImportable'|'isLegacy'|'replace'|'merge'>,
 * copy:{t:(key:string,vars?:Record<string,unknown>)=>string,tOne:(key:string,n:number,vars?:Record<string,unknown>)=>string,tp:(n:number,word:string)=>string},
 * shell:{openModal:(el:HTMLElement,options:{initialFocus:HTMLElement|null,returnFocus:Element|null,onEscape:()=>unknown})=>unknown,closeModal:(el:HTMLElement)=>unknown,canTakeFocus:(el:Element|null)=>boolean},
 * toast:(message:string)=>unknown,onImported:(kind:'replace'|'merge')=>unknown}} options */
export function createBackupView({window,commands,copy,shell,toast,onImported}){
 const document=window.document,{t,tOne,tp}=copy;
 let selection=0,choice=0,observing=false;
 /** @type {(()=>unknown)|null} */let currentClose=null;
 /** @type {(()=>void)|null} */let cleanup=null;
 function observe(){if(!observing){observing=true;window.addEventListener('pagehide',dispose)}}
 function dispose(){selection++;if(currentClose)currentClose();else{choice++;cleanup?.();cleanup=null}
  if(observing){window.removeEventListener('pagehide',dispose);observing=false}}
 function dismiss(){currentClose?.()}
 /** @param {string} selector */
 const $=selector=>/** @type {HTMLElement} */(document.querySelector(selector));
 /** Presentation handoff from either the saved-backup or program-file door.
  * @param {Snapshot} s @param {Element|null} [opener] @param {StorageIO} [io] @returns {Choice} */
 function context(s,opener,io){return{s,io:io||null,opener,...commands.describe(s)}}
 /** @param {Choice} ctx */
 function open(ctx){
  observe();cleanup?.();cleanup=null;selection++;const turn=++choice;
  const dialog=$('#importChoice'),bodyKey=ctx.bodyKey||'dialog.import.body',mergeable=ctx.inSessions>0;
  $('#importChoiceBody').textContent=t(mergeable?bodyKey:`${bodyKey}_nolog`,{curSessions:ctx.curSessions,curSets:ctx.curSets,inSessions:ctx.inSessions,inSets:ctx.inSets,newSessions:ctx.newSessions});
  const active=document.activeElement;
  const opener=shell.canTakeFocus(active)?active:(ctx.opener?.closest('label')||$('#importJson')?.closest('label')||$('#dataImportRow'));
  const close=()=>{if(turn!==choice)return;selection++;choice++;cleanup?.();cleanup=null;currentClose=null;return shell.closeModal(dialog)},only=$('#importProgramOnly'),merge=$('#importMerge');
  if(only)only.classList.toggle('hidden',!ctx.programOnly);if(merge)merge.classList.toggle('hidden',!mergeable);
  currentClose=close;
  shell.openModal(dialog,{initialFocus:$('#importCancel'),returnFocus:opener,onEscape:dismiss});
  let busy=false;
  const cancel=$('#importCancel'),replace=$('#importReplace');
  const cancelAction=()=>{if(busy||turn!==choice)return;close();toast(t('toast.import_cancelled'))};
  cancel.onclick=cancelAction;
  const onlyAction=()=>{if(busy||turn!==choice||!ctx.programOnly)return;close();ctx.programOnly()};
  if(only)only.onclick=onlyAction;
  const replaceAction=async()=>{
   if(busy||turn!==choice)return;busy=true;
   try{const result=await commands.replace(ctx.s,{...(ctx.io?{io:ctx.io}:{})});
    if(result.localOk||result.idbOk){const current=turn===choice;if(current)close();onImported('replace');if(current)toast(tOne('toast.imported_sessions',ctx.inSessions,{sessions:ctx.inSessions}))}
   }finally{busy=false}
  };
  const mergeAction=async()=>{
   if(busy||turn!==choice)return;busy=true;
   try{const result=await commands.merge(ctx.s,{...(ctx.io?{io:ctx.io}:{})});
    if(result.added===0){if(turn===choice){close();toast(t('toast.nothing_to_merge'))}return}
    if(result.localOk||result.idbOk){const current=turn===choice;if(current)close();onImported('merge');const added=result.added||0;if(current)toast(t('toast.merged_sessions',{n:added,sessions:tp(added,'session')}))}
   }finally{busy=false}
  };
  replace.onclick=replaceAction;merge.onclick=mergeAction;
  const closed=()=>{if(turn!==choice)return;selection++;choice++;cleanup?.();cleanup=null;currentClose=null};
  dialog.addEventListener('close',closed);
  cleanup=()=>{
   if(cancel.onclick===cancelAction)cancel.onclick=null;
   if(only?.onclick===onlyAction)only.onclick=null;
   if(replace.onclick===replaceAction)replace.onclick=null;
   if(merge?.onclick===mergeAction)merge.onclick=null;
   dialog.removeEventListener('close',closed);
  };
 }
 /** @param {{target:HTMLInputElement}} event */
 async function importJson(event){
  const file=event.target.files?.[0];if(!file)return;observe();const request=++selection;
  try{
   const value=await commands.readFile(file);
   if(request!==selection)return;
   if(!value||!commands.isImportable(value))throw new TypeError('Invalid Taurifer backup');
   if(commands.isLegacy(value)){toast(t('toast.backup_legacy'));if(event.target.files?.[0]===file)event.target.value='';return}
   open(context(value,event.target));
  }catch{if(request===selection)toast(t('toast.import_invalid'))}
  if(event.target.files?.[0]===file)event.target.value='';
 }
 return Object.freeze({context,open,importJson,dispose});
}
