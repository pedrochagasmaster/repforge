import {escapeHtml as esc} from './format.js';
/** @typedef {import('../app/storage-recovery.js').Choice} Choice
 * @typedef {Extract<Choice,{kind:'unresolved'}>} Unresolved
 * @typedef {import('../app/storage-recovery.js').Replica} Replica
 * @typedef {import('../app/storage-recovery.js').Snapshot} Snapshot
 */
/** Recovery only presents copies and explicit actions. The application command
 * owns replica reads, choice validation, and destructive clearing.
 * @param {{window:Window & typeof globalThis,commands:ReturnType<typeof import('../app/storage-recovery.js').createStorageRecoveryCommands>,t:(key:string,values?:Record<string,unknown>)=>string,countText:(kind:string,n:number)=>string,i18n:{setLang:(lang:string)=>unknown,detectLang:()=>string}|null,files:{exportRaw:(raw:unknown,name:string)=>void},shell:{openModal:(element:HTMLDialogElement,options:{initialFocus:HTMLElement,returnFocus:Element|null,onEscape:null})=>unknown,closeModal:(element:HTMLElement|null)=>unknown},returnFocus:()=>Element|null}} options */
export function createStorageRecoveryView({window,commands,t,countText,i18n:I18N,files,shell,returnFocus}){
const document=window.document,confirm=window.confirm.bind(window);
/** @param {string} selector */
const $=selector=>/** @type {HTMLElement|null} */(document.querySelector(selector));
/** @param {string} selector */
function required(selector){const element=$(selector);if(!element)throw Error(`Missing recovery element ${selector}`);return element}
/** @param {string} side */
function recoveryCopyLabel(side){return t(side==="local"?"dialog.storage_recovery.copy_a":"dialog.storage_recovery.copy_b")}
/** @param {Snapshot} parsed */
function recoverySummaryText(parsed){
  const sum=commands.summary(parsed),name=sum.name||t("dialog.storage_recovery.unnamed");
  if(sum.lastDate)return t("dialog.storage_recovery.summary",{name,sessions:countText("sessions",sum.sessions),sets:countText("sets",sum.sets),date:sum.lastDate});
  return t("dialog.storage_recovery.summary_empty",{name,sessions:countText("sessions",sum.sessions),sets:countText("sets",sum.sets)})}
/** @param {Replica} read */
function recoveryStatusText(read){
  if(read.status==="valid")return recoverySummaryText(read.parsed);
  if(read.status==="invalid")return t("dialog.storage_recovery.invalid_copy");
  if(read.status==="failed")return t("dialog.storage_recovery.unread_copy");
  return t("dialog.storage_recovery.absent_copy")}
function closeStorageRecovery(){
  shell.closeModal($("#storageRecovery"))}
/** @param {HTMLDialogElement} d */
function bindStorageRecoveryGuard(d){
  if(!d||d.dataset.guarded)return;
  d.dataset.guarded="1";
  d.addEventListener("cancel",e=>e.preventDefault());
  d.addEventListener("click",e=>{if(e.target===d)e.stopPropagation()})}
/** @param {unknown} raw @param {string} name */
function exportRecoveryRaw(raw,name){files.exportRaw(raw,name)}
/** @param {Unresolved} decision @returns {Promise<Choice>} */
function presentStorageRecovery(decision){
  return new Promise(resolve=>{
    const d=/** @type {HTMLDialogElement|null} */(document.querySelector("#storageRecovery"));if(!d){resolve({kind:"first-run"});return}
    bindStorageRecoveryGuard(d);
    const langHint=commands.languageHint(decision);
    if(I18N)I18N.setLang(langHint||I18N.detectLang());
    let retryBusy=false;
    const bump=()=>{d.dataset.seq=String((Number(d.dataset.seq)||0)+1)};
    /** @param {Choice} choice */
    const finish=choice=>{d.dataset.resolved="1";d.dataset.busy="0";bump();closeStorageRecovery();resolve(choice)};
    const paint=()=>{
      const title=required("#storageRecoveryTitle"),lead=required("#storageRecoveryLead"),copies=required("#storageRecoveryCopies"),actions=required("#storageRecoveryActions");
      const reason=decision.reason;
      title.textContent=reason==="no-valid"?t("dialog.storage_recovery.title_blocked"):t("dialog.storage_recovery.title");
      lead.textContent=reason==="divergent"?t("dialog.storage_recovery.divergent"):
        reason==="valid-plus-failed"?t("dialog.storage_recovery.valid_failed"):
        reason==="valid-plus-invalid"?t("dialog.storage_recovery.valid_invalid"):
        t("dialog.storage_recovery.none_valid");
      copies.innerHTML=`<div class="storage-recovery__copy"><p class="storage-recovery__copy-label">${esc(recoveryCopyLabel("local"))}</p><p>${esc(recoveryStatusText(decision.local))}</p></div>`+
        `<div class="storage-recovery__copy"><p class="storage-recovery__copy-label">${esc(recoveryCopyLabel("idb"))}</p><p>${esc(recoveryStatusText(decision.idb))}</p></div>`;
      /** @type {string[]} */const btns=[];
      /** @param {string} id @param {string} cls @param {string} key */
      const add=(id,cls,key)=>btns.push(`<button type="button" class="btn ${cls}" id="${id}">${esc(t(key))}</button>`);
      add("storageExportA","btn--steel","dialog.storage_recovery.export_a");
      add("storageExportB","btn--steel","dialog.storage_recovery.export_b");
      add("storageRetry","btn--steel","dialog.storage_recovery.retry");
      if(reason==="divergent"){
        add("storageUseA","btn--cta","dialog.storage_recovery.use_a");
        add("storageUseB","btn--cta","dialog.storage_recovery.use_b")}
      else if(reason==="valid-plus-invalid"||reason==="valid-plus-failed"){
        add("storageOverwrite","btn--cta","dialog.storage_recovery.overwrite")}
      else{
        add("storageExportRaw","btn--steel","dialog.storage_recovery.export_raw");
        add("storageStartFresh","btn--danger","dialog.storage_recovery.start_fresh")}
      actions.innerHTML=btns.join("");
      required("#storageExportA").onclick=()=>exportRecoveryRaw(decision.local?.raw,"taurifer_copy_a.json");
      required("#storageExportB").onclick=()=>exportRecoveryRaw(decision.idb?.raw,"taurifer_copy_b.json");
      required("#storageRetry").onclick=async()=>{
        if(retryBusy)return;retryBusy=true;d.dataset.busy="1";
        try{const next=await commands.retry();
          if(next.kind!=="unresolved"){finish(next);return}
          decision=next;paint()}
        finally{retryBusy=false;d.dataset.busy="0"}};
      const useA=$("#storageUseA");if(useA)useA.onclick=()=>{const chosen=commands.choose(decision,"local");if(chosen)finish(chosen)};
      const useB=$("#storageUseB");if(useB)useB.onclick=()=>{const chosen=commands.choose(decision,"idb");if(chosen)finish(chosen)};
      const overwrite=$("#storageOverwrite");
      if(overwrite)overwrite.onclick=()=>{
        if(!confirm(t("dialog.storage_recovery.overwrite_confirm")))return;
        const source=decision.local.status==="valid"?"local":"idb";
        const chosen=commands.choose(decision,source);if(chosen)finish(chosen)};
      const exportRaw=$("#storageExportRaw");
      if(exportRaw)exportRaw.onclick=()=>{
        exportRecoveryRaw(decision.local?.raw,"taurifer_copy_a.json");
        exportRecoveryRaw(decision.idb?.raw,"taurifer_copy_b.json")};
      const fresh=$("#storageStartFresh");
      if(fresh)fresh.onclick=async()=>{
        if(retryBusy)return;
        if(!confirm(t("dialog.storage_recovery.start_fresh_confirm")))return;
        retryBusy=true;d.dataset.busy="1";
        const next=await commands.startFresh();
        if(next.kind==="first-run")finish(next);
        else{decision=next;retryBusy=false;delete d.dataset.busy;paint()}
      };
      if(!d.open)d.showModal();
      shell.openModal(d,{
        initialFocus:$("#storageExportA")||$("#storageRetry")||title,
        returnFocus:returnFocus(),
        onEscape:null
      });
      bump();
      const focusEl=$("#storageExportA")||$("#storageRetry")||title;
      if(focusEl)focusEl.focus()};
    paint()})}

return {present:presentStorageRecovery};
}
