/** @typedef {import('./contracts.js').HistoryRow} HistoryRow
 * @typedef {import('./contracts.js').HistorySession} HistorySession
 * @typedef {import('./contracts.js').HistoryIndex} HistoryIndex
 * @typedef {import('./contracts.js').HistorySelection} HistorySelection
 * @typedef {import('./contracts.js').HistoryResult} HistoryResult
 * @typedef {import('./contracts.js').MetricRecord} MetricRecord
 * @typedef {import('../../training/metrics.js').MetricDefinition} MetricDefinition
 * @typedef {string|number|null|undefined} SessionId
 * @typedef {{field:HTMLElement|null,key?:string}} ValidationError
 */
import {createHistoryMarkup} from "./view.js";
import {isSourceMetricRow,historyMetricRecords,historyMetricProjection,historyHasLoadAndReps} from "./fields.js";
import {cloneSnapshot} from "../../training/model.js";
import {escapeHtml as esc} from "../format.js";
import {compareChronology as compareLogChronology} from "../../training/progress.js";
import {historyFrequency,historyWeekGroups,isoDayNumber} from "../../app/history-read-models.js";

/** History owns search/calendar/selection and volatile edits. Read models contain
 * acknowledged facts; only the named application commands can change saved data.
 * No browser work occurs until render or an explicit user operation.
 */
/** @param {import("./contracts.js").HistoryOptions} options */
export function createHistoryController({window,queries,commands,copy,format,inputs,shell,onChanged,onNotice,onOutcome}){
const document=window.document,Element=window.Element,CSS=window.CSS;
let disposed=false,discardFrame=0,calendarFrame=0;
/** @type {AbortController|null} */let retryController=null;
/** @typedef {{element:EventTarget,type:string,handler:EventListener}} ListenerRecord */
/** @type {ListenerRecord[]} */
const listeners=[];
/** @type {ListenerRecord[]} */const calendarListeners=[];
/** @type {ListenerRecord[]} */const discardListeners=[];
/** @param {EventTarget|null} element @param {string} type @param {EventListener} handler @param {ListenerRecord[]} [group] */
function listen(element,type,handler,group=listeners){if(!element)return;element.addEventListener(type,handler);group.push({element,type,handler})}
/** @param {ListenerRecord[]} [group] */
function clearListeners(group=listeners){for(const {element,type,handler}of group)element.removeEventListener(type,handler);group.length=0}
const requestAnimationFrame=window.requestAnimationFrame.bind(window);
/** @param {string} selector */
const $=selector=>/** @type {HTMLElement|null} */(document.querySelector(selector));
/** Shell IDs required by the release's History markup. @param {string} selector */
const required=selector=>/** @type {HTMLElement} */($(selector));
/** @param {string} selector */
const $$=selector=>/** @type {HTMLElement[]} */([.../** @type {NodeListOf<HTMLElement>} */(document.querySelectorAll(selector))]);
const {t}=copy;
const markup=createHistoryMarkup({copy,format:{...format,locale:()=>queries.context().locale}});
const canTakeFocus=shell.canTakeFocus;
const {date:formatLongDate,load:fmtLoad,loadPlain:fmtLoadPlain,compact:kfmt,number:fmt,displayLoad:toDisplay,unit:unitLabel,muscle:muscleLabel,
  metricLabel:metricLabelDep,metricText:metricDisplayValue,metricUnit:metricDisplayUnit}=format;
const {date:parseCalendarDate,load:parseLoadDisplay,reps:parseRepsValue,rir:parseRirValue,metric:parseHistoryMetricInput}=inputs;
/** @param {HistoryRow} row */
const isWork=row=>!row.warmup;
/** @param {HistoryRow} row */
const readLogRow=row=>queries.row(row).reading;
/** @param {HistoryRow} row */
const displayName=row=>queries.row(row).storedName,shownName=/** @param {HistoryRow} row */ row=>queries.row(row).name,liftKey=/** @param {HistoryRow} row */ row=>queries.row(row).liftKey;
/** @param {string|null|undefined} day */
const dayLabel=day=>queries.context().dayLabels[String(day)]||String(day??"");
const weekdayLetters=()=>queries.context().weekdayLetters,today=()=>queries.context().today;
const uid=()=>window.crypto?.randomUUID?.()||`id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
/** @param {(number|null|undefined)[]} values */
const sum=values=>values.reduce(/** @param {number} total @param {number|null|undefined} value */ (total,value)=>total+Number(value||0),0);
/** @param {string} message */
const toast=message=>onNotice(message);
/** @param {string} _event @param {{action:string,status:string}} payload */
const captureEvent=(_event,payload)=>onOutcome(payload);
/** @param {HTMLElement|null} root */
function clearFieldInvalid(root){/** @type {NodeListOf<HTMLElement>} */(root?.querySelectorAll('[aria-invalid="true"]')).forEach(node=>node.removeAttribute("aria-invalid"))}
/** @param {Record<string,unknown>[]} rows */
function table(rows){if(!rows.length)return`<div class="empty">${esc(t("stats.table.no_data"))}</div>`;const headings=Object.keys(rows[0]);
  return`<table><thead><tr>${headings.map(key=>`<th>${esc(key)}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${headings.map(key=>`<td>${esc(row[key])}</td>`).join("")}</tr>`).join("")}</tbody></table>`}
    /** @param {MetricDefinition|undefined|null} metric */
    const historyMetricErrorKey=metric=>["reps","repsPerSide"].includes(String(metric?.semantic))?"validation.reps"
      :["loadKg","assistanceKg","loadPerSideKg","persistentLoadPerSideKg"].includes(String(metric?.semantic))?"validation.load":"validation.metric";
    const parseHistoryMetric=typeof parseHistoryMetricInput==="function"
      ?/** @param {MetricDefinition} metric @param {unknown} raw */ (metric,raw)=>parseHistoryMetricInput(metric,raw)
      :/** @param {MetricDefinition} metric @returns {import("./contracts.js").FieldParse<number>} */ (metric)=>({field:"metric",key:historyMetricErrorKey(metric)});
    const render=()=>onChanged();
    /** @returns {HistorySelection} */
    const emptyHistorySelection=()=>({mode:"calendar",sessionId:null,originalFingerprint:"",
      desiredFingerprint:null,workingCopy:null,removedRowIndices:[],dirty:false,validation:null,
      baselineRows:null,operation:null,operationId:null});
    let historySelection=emptyHistorySelection();
    /** @type {{y:number,m:number}|null} */let histMonth=null;
    let histQuery="";
    /** @param {string} action @param {string} status */
    const historyOutcome=(action,status)=>{try{if(typeof captureEvent==="function")captureEvent("history_session_outcome",{action,status})}catch{}};
const historyDiagnostics=queries.diagnostics;
/** @param {readonly HistoryRow[]} source */
const buildHistoryIndex=source=>queries.buildIndex(source);
/** @param {readonly HistoryRow[]} source */
const historyIndexFor=source=>queries.index(source);
/** @param {Readonly<HistoryIndex>} index @param {string} query */
const searchHistoryIndex=(index,query)=>queries.search(index,query);
/** @param {readonly HistoryRow[]} source */
function renderHistoryWithSource(source){renderHistory(source)}
function isHistorySearchOpen(){return!$("#historySearchWrap")?.classList.contains("hidden")}
/** @param {boolean} open */
function setHistorySearchOpen(open){
  if(disposed)return;
  if(!open&&histQuery.trim())return;
  $("#historySearchWrap")?.classList.toggle("hidden",!open);
  $("#historySearchBtn")?.setAttribute("aria-expanded",open?"true":"false");
  if(open)$("#historySearch")?.focus()}
function clearHistorySearch(){
  if(disposed)return;
  histQuery="";
  const inp=/** @type {HTMLInputElement|null} */($("#historySearch"));if(inp)inp.value="";
  renderHistory();
  setHistorySearchOpen(false)}
function syncHistorySearchChrome(){
  const open=isHistorySearchOpen()||!!histQuery.trim();
  if(histQuery.trim())$("#historySearchWrap")?.classList.remove("hidden");
  $("#historySearchBtn")?.setAttribute("aria-expanded",open?"true":"false");
  const inp=/** @type {HTMLInputElement|null} */($("#historySearch"));if(inp&&inp.value!==histQuery)inp.value=histQuery}
/** @param {readonly HistoryRow[]} source @param {SessionId} sid */
function historySessionRows(source,sid){
  return(source||[]).filter(row=>String(row?.session??"")===String(sid))
    .sort((a,b)=>String(displayName(a)).localeCompare(String(displayName(b)))||Number(a?.set||0)-Number(b?.set||0))}
/** @param {readonly HistoryRow[]} rows */
function historySessionFingerprint(rows){return commands.fingerprint(rows)}
/** @param {SessionId} sid @param {string} [mode] @param {readonly HistoryRow[]} [source] @returns {HistorySelection|null} */
function historySelectionFor(sid,mode="reading",source=queries.rows()){
  const rows=historySessionRows(source,sid);if(!rows.length)return null;
  return{mode,sessionId:String(sid),originalFingerprint:historySessionFingerprint(rows),
    desiredFingerprint:null,workingCopy:mode==="editing"?cloneSnapshot(rows):null,
    baselineRows:mode==="editing"?cloneSnapshot(rows):null,
    removedRowIndices:[],dirty:false,validation:null,operation:null,operationId:null}}
/** @param {HistorySelection} selection @param {HTMLElement|null} input */
function historyInputEdit(selection,input){
  const key=String(input?.dataset?.ek||""),edits=selection?.inputEdits;
  return edits&&Object.hasOwn(edits,key)?edits[key]:null}
function historySelectedRecord(source=queries.rows()){
  const sid=historySelection.sessionId;if(!sid)return null;
  return historyIndexFor(source).sessions.find(item=>String(item.session)===String(sid))||null}
/** @param {HistorySelection|null} next */
function historySetSelection(next){retryController?.abort();retryController=null;historySelection=next||emptyHistorySelection()}
/** @param {unknown} operationId @param {SessionId} sid @param {"edit"|"delete"} operation */
function historyOperationCurrent(operationId,sid,operation){
  return !disposed&&typeof operationId==="string"&&operationId.length>0&&historySelection.operationId===operationId&&
    String(historySelection.sessionId)===String(sid)&&historySelection.operation===operation}
/** @param {HTMLElement|null} node */
function historyFocus(node){
  if(!node||!canTakeFocus(node))return false;
  try{node.focus({preventScroll:true})}catch{try{node.focus()}catch{return false}}
  return true}
/** @param {SessionId} sid */
function historyEditAction(sid){
  return $$("#sessions [data-history-edit]").find(button=>String(button.dataset.historyEdit)===String(sid))||null}
/** @param {SessionId} sid */
function historyCalendarAction(sid){
  return $$("#sessions .session__open").find(button=>String(/** @type {HTMLElement|null} */(button.closest("[data-sess]"))?.dataset.sess)===String(sid))||null}
/** @param {SessionId} sid */
function historyFocusRead(sid){
  const edit=historyEditAction(sid);
  if(historyFocus(edit))return true;
  const calendar=historyCalendarAction(sid);
  if(historyFocus(calendar))return true;
  return historyFocus($("#historyRecentLabel"))}
/** @param {string} mode */
function historyFocusFailure(mode){
  return historyFocus($('[data-history-operation="'+CSS.escape(mode)+'"] h3'))}
function historyFocusEditing(){
  return historyFocus($("[data-history-editing-heading]"))}
// ---- The discard question (Plan 064 R3j2) ----
// Leaving an edit with unsaved changes asks in a sheet, not the native confirm:
// "Keep editing" is the first and default choice, and Escape, the scrim and a
// downward swipe all mean it. The page behind the sheet is inert while it is open.
/** @type {Promise<boolean>|null} */let historyDiscardAsk=null;
/** @type {(()=>Promise<void>)|null} */let cancelDiscard=null;
function historyDiscardParts(){
  let sheet=$("#historyDiscardSheet"),scrim=$("#historyDiscardScrim");
  if(sheet&&scrim)return{sheet,scrim};
  scrim=document.createElement("div");scrim.id="historyDiscardScrim";scrim.className="sheet-scrim hidden";
  sheet=document.createElement("div");sheet.id="historyDiscardSheet";sheet.className="sheet sheet--discard hidden";
  sheet.setAttribute("role","dialog");sheet.setAttribute("aria-modal","true");sheet.setAttribute("aria-labelledby","historyDiscardTitle");sheet.hidden=true;
  sheet.innerHTML='<div class="sheetband"><span class="sheetband__handle" aria-hidden="true"></span><h2 class="sheetband__title" id="historyDiscardTitle"></h2></div>'+
    '<div class="sheetfoot"><button type="button" id="historyDiscardKeep"></button><button type="button" id="historyDiscardDrop"></button></div>';
  document.body.append(scrim,sheet);
  return{sheet,scrim}}
/** Resolves true to discard, false to keep editing. One question at a time. */
function historyConfirmDiscard(){
  if(historyDiscardAsk)return historyDiscardAsk;
  if(typeof shell.openModal!=="function"||typeof shell.closeModal!=="function")return Promise.resolve(false);
  const {sheet,scrim}=historyDiscardParts();
  required("#historyDiscardTitle").textContent=t("history.confirm.discard_changes");
  const keep=required("#historyDiscardKeep"),drop=required("#historyDiscardDrop");
  keep.textContent=t("history.edit.keep_editing");drop.textContent=t("history.edit.discard_changes");
  historyDiscardAsk=new Promise(resolve=>{
    let settled=false;
    /** @param {boolean} discard */
    const finish=async discard=>{
      if(settled)return;settled=true;
      await shell.closeModal(sheet);
      clearListeners(discardListeners);
      historyDiscardAsk=null;cancelDiscard=null;resolve(discard)};
    cancelDiscard=()=>finish(false);
    listen(keep,"click",()=>finish(false),discardListeners);listen(drop,"click",()=>finish(true),discardListeners);listen(scrim,"click",()=>finish(false),discardListeners);
    const reduced=typeof shell.reducedMotion==="function"&&shell.reducedMotion();
    document.body.classList.add("is-sheet-open");
    const opened=shell.openModal(sheet,{onEscape:()=>finish(false),scrim,returnFocus:document.activeElement,initialFocus:keep,delayHide:reduced?0:280});
    if(opened===false){clearListeners(discardListeners);cancelDiscard=null;document.body.classList.remove("is-sheet-open");settled=true;historyDiscardAsk=null;resolve(false);return}
    discardFrame=requestAnimationFrame(()=>{discardFrame=0;if(disposed)return;sheet.classList.add("is-open");scrim.classList.add("is-open")})});
  return historyDiscardAsk}
/** True when the lifter agreed to drop the unsaved changes of this session. */
/** @param {SessionId} sid */
async function historyDiscardAgreed(sid){
  const agreed=await historyConfirmDiscard();
  return agreed&&String(historySelection.sessionId)===String(sid)}
async function historyBackToCalendar(){
  if(disposed)return false;
  const sid=historySelection.sessionId;
  if(historySelection.dirty&&!await historyDiscardAgreed(sid))return false;
  historySetSelection(emptyHistorySelection());
  renderHistory();
  historyFocus(historyCalendarAction(sid)||$("#historyRecentLabel"));historyOutcome("cancel","success");
  return true}
/** @param {SessionId} sid */
function historyStartReading(sid){
  if(disposed)return false;
  const next=historySelectionFor(sid);if(!next)return false;
  histQuery="";historySetSelection(next);renderHistory();
  historyFocus($("[data-history-selection-heading]"));historyOutcome("read","success");return true}
function historyStartEditing(){
  if(disposed)return false;
  const sid=historySelection.sessionId,rows=historySessionRows(queries.rows(),sid);if(!rows.length)return false;
  historySetSelection({mode:"editing",sessionId:String(sid),originalFingerprint:historySelection.originalFingerprint,
    desiredFingerprint:null,workingCopy:cloneSnapshot(rows),baselineRows:cloneSnapshot(rows),inputEdits:{},removedRowIndices:[],dirty:false,validation:null,
    operation:null,operationId:null});
  renderHistory();
  // The editor is a new page: it opens at its top, whatever the read page was scrolled to, so the heading focus lands in view (R7 J-06).
  try{window.scrollTo?.(0,0)}catch{}
  historyFocusEditing();return true}
/** @param {HTMLElement} card @returns {{rows:HistoryRow[],error?:never,dateP:import("./contracts.js").FieldParse<string>}|{error:ValidationError,rows?:never,dateP:import("./contracts.js").FieldParse<string>}} */
function historySessionFromWorkingCopy(card){
  const selection=historySelection,source=selection.workingCopy||historySessionRows(queries.rows(),selection.sessionId),out=[];
  const dateEl=/** @type {HTMLInputElement|null} */(card?.querySelector('[data-ed="date"]')),dateP=parseCalendarDate(dateEl?.value);
  if(dateP.field)return{error:{field:dateEl,key:dateP.key},dateP};
  const removed=new Set((selection.removedRowIndices||[]).map(Number));
  for(const rowEl of /** @type {NodeListOf<HTMLElement>} */(card.querySelectorAll(".edrow[data-edidx]"))){
    const i=Number(rowEl.dataset.edidx);if(removed.has(i))continue;
    const src=source[i],baseline=selection.baselineRows?.[i]||src;if(!src||!baseline)continue;
    const next=cloneSnapshot(baseline),rirEl=/** @type {HTMLInputElement|null} */(rowEl.querySelector('[data-ek^="rir|"]'));
    if(isSourceMetricRow(baseline)){
      const records=historyMetricRecords(baseline)||[],inputs=[.../** @type {NodeListOf<HTMLInputElement>} */(rowEl.querySelectorAll('[data-ek^="metric|"]'))];
      if(!records.length)return{error:{field:rowEl,key:"validation.metric"},dateP};
      if(inputs.length!==records.length)return{error:{field:inputs[0]||rowEl,key:"validation.metric"},dateP};
      for(let metricIndex=0;metricIndex<records.length;metricIndex++){
        const record=records[metricIndex],input=inputs[metricIndex],parts=String(input.dataset.ek||"").split("|");
        if(parts[0]!=="metric"||parts[2]!==record.definition.id)return{error:{field:input,key:"validation.metric"},dateP};
        const edit=historyInputEdit(selection,input);
        if(!edit)continue;
        if(edit.valid!==true||typeof edit.value!=="number"||!Number.isFinite(edit.value))return{error:{field:input,key:edit.key||historyMetricErrorKey(record.definition)},dateP};
        const valueRecord=next.metricValues?.[metricIndex];
        if(!valueRecord||valueRecord.metricId!==record.definition.id)return{error:{field:input,key:"validation.metric"},dateP};
        valueRecord.value=edit.value;historyMetricProjection(next,record.definition.id,edit.value)}
      if(rirEl){
        const edit=historyInputEdit(selection,rirEl);
        if(edit){
          if(edit.valid!==true)return{error:{field:rirEl,key:edit.key||"validation.rir"},dateP};
          next.rir=edit.value;
          if(edit.value==null)delete next.rirMeasured;else next.rirMeasured=true}}
    }else{
      const loadEl=/** @type {HTMLInputElement|null} */(rowEl.querySelector('[data-ek^="load|"]')),repsEl=/** @type {HTMLInputElement|null} */(rowEl.querySelector('[data-ek^="reps|"]'));
      const loadEdit=historyInputEdit(selection,loadEl),repsEdit=historyInputEdit(selection,repsEl),rirEdit=historyInputEdit(selection,rirEl);
      if(loadEdit){if(loadEdit.valid!==true)return{error:{field:loadEl,key:loadEdit.key||"validation.load"},dateP};next.load=loadEdit.value}
      if(repsEdit){if(repsEdit.valid!==true)return{error:{field:repsEl,key:repsEdit.key||"validation.reps"},dateP};next.reps=repsEdit.value}
      if(rirEdit){if(rirEdit.valid!==true)return{error:{field:rirEl,key:rirEdit.key||"validation.rir"},dateP};next.rir=rirEdit.value;next.rirMeasured=true}}
    next.date=dateP.value;out.push(next)}
  return{rows:out,dateP}
}
// An invalid value keeps its reason on the page (Plan 064 R3j2): the field takes the
// error boundary and the reason sits under its row until the value is fixed or the row
// is removed. It is announced once as an alert; a toast would fade before it was read.
const HISTORY_ERROR_ID="histedit-error";
/** @param {HTMLElement} card */
function historyClearErrors(card){
  clearFieldInvalid(card);
  /** @type {NodeListOf<HTMLElement>} */(card.querySelectorAll("[data-histedit-error]")).forEach(note=>note.remove());
  /** @type {NodeListOf<HTMLElement>} */(card.querySelectorAll('[aria-describedby="'+HISTORY_ERROR_ID+'"]')).forEach(el=>el.removeAttribute("aria-describedby"))}
/** @param {HTMLElement} card @param {ValidationError} error */
function historyMarkValidation(card,error){
  historyClearErrors(card);
  const field=error?.field;
  if(field){
    field.setAttribute("aria-invalid","true");
    if(error.key){
      const host=/** @type {HTMLElement|null} */(field.closest(".edrow"))||/** @type {HTMLElement|null} */(field.closest(".histedit__date"))||field,
        note=document.createElement("p");
      note.className="histedit__error";note.id=HISTORY_ERROR_ID;note.setAttribute("role","alert");
      note.setAttribute("data-histedit-error","");note.textContent=t(error.key);
      host.after(note);field.setAttribute("aria-describedby",HISTORY_ERROR_ID)}
    try{field.focus()}catch{}}
  return false}
/** @param {Event} event */
function historyApplyWorkingInput(event){
  const target=/** @type {HTMLInputElement} */(event.target),card=/** @type {HTMLElement|null} */(target.closest(".session--edit"));if(!card||historySelection.mode!=="editing")return;
  // The reason under a field goes when that field holds a usable value again.
  const fixed=()=>{if(target.getAttribute("aria-invalid")==="true")historyClearErrors(card)};
  const row=/** @type {HTMLElement|null} */(target.closest(".edrow[data-edidx]"));if(row){const i=Number(row.dataset.edidx),key=String(target.dataset.ek||"").split("|")[0];
    const parts=String(target.dataset.ek||"").split("|"),src=historySelection.workingCopy?.[i];
    const metric=key==="metric"?historyMetricRecords(src)?.find(record=>record.definition.id===parts[2]):null;
    /** @type {import("./contracts.js").FieldParse<number|null>|null} */
    const parsed=key==="load"?parseLoadDisplay(target.value):key==="reps"?parseRepsValue(target.value)
      :key==="rir"?(isSourceMetricRow(src)&&String(target.value??"").trim()===""?{value:null}:parseRirValue(target.value))
      :metric?parseHistoryMetric(metric.definition,target.value):null;
    if(key&&parsed){
      const editKey=String(target.dataset.ek||"");
      historySelection.inputEdits||={};
      historySelection.inputEdits[editKey]=parsed.field
        ?{valid:false,key:parsed.key}
        :{valid:true,value:parsed.value};
    }
    if(parsed&&!parsed.field)fixed();
    if(historySelection.workingCopy?.[i]&&key&&parsed&&!parsed.field){
      if(key==="metric"&&metric){
        const valueRecord=historySelection.workingCopy[i].metricValues?.find(value=>value.metricId===parts[2]);
        if(valueRecord&&typeof parsed.value==="number"&&Number.isFinite(parsed.value)){
          valueRecord.value=parsed.value;historyMetricProjection(historySelection.workingCopy[i],parts[2],parsed.value)}}
      else if(key==="rir"){
        historySelection.workingCopy[i].rir=parsed.value;
        if(parsed.value==null)delete historySelection.workingCopy[i].rirMeasured;else historySelection.workingCopy[i].rirMeasured=true}
      else historySelection.workingCopy[i][key]=parsed.value;
      // A valid RIR entry is the user's explicit correction, so it is measured evidence.
    }}
  if(target.matches('[data-ed="date"]')){
    const parsed=parseCalendarDate(target.value);
    if(!parsed.field){fixed();for(const row of historySelection.workingCopy||[])row.date=parsed.value}}
  historySelection.dirty=true}
/** @param {import("../../app/session.js").CommitResult|null|undefined} result @param {string} successKey @param {"edit"|"delete"} operation @param {string|null} operationId */
function historyResultMessage(result,successKey,operation,operationId){
  const action=operation==="edit"?"edit_save":"delete";
  if(result?.committed===true&&result?.settled===true){historyOutcome(action,"success");return"committed"}
  if(result?.conflict||result?.stale||result?.staleRevision||result?.duplicate){historySelection={...historySelection,mode:"conflict",operation,operationId};historyOutcome(action,"conflict");return"conflict"}
  historySelection={...historySelection,mode:"failure",operation,operationId};historyOutcome(action,"failure");return"failure"}
async function historyReloadLatest(){
  if(disposed)return null;
  const sid=historySelection.sessionId,startedMode=historySelection.mode,
    startedOperation=historySelection.operation,startedOperationId=historySelection.operationId,
    refreshed=await commands.readLatest();
  if(disposed||String(historySelection.sessionId)!==String(sid)||historySelection.mode!==startedMode||
    historySelection.operation!==startedOperation||historySelection.operationId!==startedOperationId)return null;
  // The durable owner returns its last trusted head when replicas disagree or
  // a recovery journal is still pending. That head is not a reload result: do
  // not let a UI refresh turn an unresolved storage state into a silent stale
  // selection.
  if(refreshed?.ok!==true||refreshed.pendingJournal===true)return null;
  const next=historySelectionFor(sid);
  if(next)historySetSelection(next);else historySetSelection(emptyHistorySelection());
  render();
  if(next)historyFocusRead(sid);else historyFocus($("#historyRecentLabel"));
  return next}
/** @param {import("../../app/session.js").CommitResult|null|undefined} result @param {string} successKey @param {"edit"|"delete"} operation @param {string|null} operationId */
async function historyFinishResult(result,successKey,operation,operationId){
  const sid=historySelection.sessionId;
  if(!historyOperationCurrent(operationId,sid,operation))return false;
  const settledResult=result;
  const status=historyResultMessage(settledResult,successKey,operation,operationId);
  if(status==="committed"){
    const next=historySelectionFor(sid);
    historySetSelection(next||emptyHistorySelection());
    render();historyFocusRead(sid);toast(t(successKey));return true}
  render();historyFocusFailure(status);return false}
/** @param {SessionId} sid @param {HistoryRow[]} proposed @param {string} original */
function historyEditCommit(sid,proposed,original){
  return commands.correct({sessionId:String(sid),rows:proposed,originalFingerprint:original})}
async function historyRetryEdit(){
  if(disposed)return false;
  const sid=historySelection.sessionId,original=historySelection.originalFingerprint;
  const proposed=cloneSnapshot(historySelection.workingCopy||[]);
  if(!sid||!original||!proposed.length){historyOutcome("edit_save","failure");return false}
  const operationId=uid();
  historySelection={...historySelection,mode:"failure",operation:"edit",operationId,
    desiredFingerprint:historySelection.desiredFingerprint||historySessionFingerprint(proposed),workingCopy:proposed,dirty:true};
  retryController?.abort();
  const controller=new window.AbortController();retryController=controller;
  const result=await commands.retryCorrection({sessionId:String(sid),rows:proposed,originalFingerprint:original,signal:controller.signal});
  if(retryController===controller)retryController=null;
  if(!historyOperationCurrent(operationId,sid,"edit"))return false;
  await historyFinishResult(result,"toast.session_updated","edit",operationId);
  return result?.committed===true&&result?.settled===true;
}
/** @param {SessionId} sid */
async function historyBeginDelete(sid){
  if(disposed)return false;
  const rows=historySessionRows(queries.rows(),sid);if(!rows.length)return false;
  if(historySelection.mode==="editing"&&historySelection.dirty){
    const editing=historySelection.sessionId;
    if(!await historyDiscardAgreed(editing))return false}
  const selected=String(historySelection.sessionId)===String(sid)&&typeof historySelection.originalFingerprint==="string"&&historySelection.originalFingerprint;
  historySetSelection({mode:"deleting",sessionId:String(sid),originalFingerprint:selected||historySessionFingerprint(rows),
    desiredFingerprint:null,workingCopy:null,removedRowIndices:[],dirty:false,validation:null,
    operation:"delete",operationId:uid()});
  renderHistory();historyFocus($("[data-history-delete-status]"));return true}
/** @param {SessionId} sid @param {{originalFingerprint?:string|null,operationId?:string|null}} [options] */
async function deleteSession(sid,{originalFingerprint=null,operationId=null}={}){
  if(disposed)return{ok:false,committed:false,settled:true,cancelled:true,code:"history_cancelled",localOk:false,idbOk:false};
  const original=typeof originalFingerprint==="string"?originalFingerprint:"";
  if(!original){
    const result={ok:false,committed:false,settled:true,failed:true,code:"history_missing_fingerprint",revision:queries.context().revision,localOk:false,idbOk:false};
    await historyFinishResult(result,"toast.session_deleted","delete",operationId||historySelection.operationId);
    return result}
  const result=await commands.remove({sessionId:String(sid),originalFingerprint:original});
  await historyFinishResult(result,"toast.session_deleted","delete",operationId||historySelection.operationId);
  return result}
// ---- The session as a page (Plan 064 R3j) ----
// Read mode: totals, then one group per lift with its outcome, the previous
// exposure and the numbered sets. Outcomes come from the same comparison the
// summary and Progress read; nothing here derives a second one.
/** @param {unknown} date */
function historyWeekOf(date){
  const d=isoDayNumber(date);if(d==null)return null;
  for(const block of historyBlocks(historyContext())){
    const start=/** @type {number} */(isoDayNumber(block.start)),end=block.end?isoDayNumber(block.end):null;
    if(d>=start&&(end==null||d<=end))return Math.floor((d-start)/7)+1}
  return null}
/** "100 × 8, 8, 8" when one load, otherwise one "load × reps" per set. */
/** @param {HistorySession} record @param {readonly HistoryRow[]} rows */
function historyReadingView(record,rows){
  const sid=String(record.session),index=historyIndexFor(queries.rows());
  const volumeRows=rows.map(row=>({row,reading:readLogRow(row)})).filter(entry=>isWork(entry.row)&&Number.isFinite(entry.reading.tonnage));
  const prLifts=historyPrLifts(index).get(sid)||new Set();
  /** @type {{key:string,rows:HistoryRow[]}[]} */const groups=[];
  /** @type {Map<string,{key:string,rows:HistoryRow[]}>} */const byLift=new Map();
  for(const row of rows){const key=liftKey(row);if(!byLift.has(key)){const group={key,rows:[]};byLift.set(key,group);groups.push(group)}/** @type {{rows:HistoryRow[]}} */(byLift.get(key)).rows.push(row)}
  return markup.readSession({record:{...record,dayLabel:dayLabel(record.day)},setCount:rows.length,
    volumeDisplay:toDisplay(sum(volumeRows.map(entry=>entry.reading.tonnage))),hasStrengthProjection:volumeRows.length>0,prCount:prLifts.size,
    groups:groups.map(group=>({...group,name:shownName(group.rows[0]),outcome:queries.outcome(group.rows),record:prLifts.has(group.key),
      previous:index.liftPred.get(`${sid}|${group.key}`)||[]}))});
}
/** Back, the day's name as the page title, and the date with its block week. */
/** @param {HistorySession} record */
function historySessionHead(record){
  const longDate=formatLongDate(String(record.date||"")),week=historyWeekOf(record.date);
  return`<div class="histpage__head"><button type="button" class="back-link" data-history-back><span class="chevron" aria-hidden="true"></span>${esc(t("history.title"))}</button>`+
    `<h2 class="page-title histpage__title" data-history-selection-heading tabindex="-1">${esc(dayLabel(record.day))}</h2>`+
    `<p class="histpage__lede">${esc(week!=null?t("history.saved_week",{date:longDate,n:week}):longDate)}</p></div>`}
/** @param {HistorySession} s */
function historyDeleteView(s){
  return '<article class="session session--delete" data-deleting="'+esc(s.session)+'" role="alert">'+
    '<div class="history-delete__icon" aria-hidden="true">!</div><h3 data-history-delete-status tabindex="-1">'+esc(t("history.delete_title"))+'</h3>'+
    '<p>'+esc(t("confirm.delete_session"))+'</p><div class="edbtns">'+
    '<button type="button" class="btn btn--steel" data-history-delete-cancel>'+esc(t("history.edit.cancel"))+'</button>'+
    '<button type="button" class="btn btn--danger" data-history-delete-confirm="'+esc(s.session)+'">'+esc(t("history.session.delete"))+'</button></div></article>'}
/** @param {HistorySession} s @param {string} mode @param {"edit"|"delete"|null} operation */
function historyConflictView(s,mode,operation){
  const failure=mode==="failure",copy=failure?t("history.operation_failed"):t("history.operation_conflict");
  return`<article class="session history-operation" data-history-operation="${esc(mode)}" role="alert">`+
    `<h3 tabindex="-1">${esc(failure?t("history.failure_title"):t("history.conflict_title"))}</h3><p>${esc(copy)}</p>`+
    `<div class="edbtns"><button type="button" class="btn btn--steel" data-history-cancel>${esc(t("history.edit.cancel"))}</button>`+
    `<button type="button" class="btn btn--steel" data-history-reload>${esc(t("history.reload"))}</button>`+
    (operation==="edit"?`<button type="button" class="btn btn--cta" data-history-retry>${esc(t("history.retry"))}</button>`:"")+`</div></article>`}
function bindHistoryEditRows(){
  $$("[data-edrm]").forEach(b=>listen(b,"click",e=>{e.stopPropagation();
    const row=/** @type {HTMLElement|null} */(b.closest(".edrow")),card=/** @type {HTMLElement|null} */(b.closest(".session--edit"));if(!row||!card)return;
    const index=Number(row.dataset.edidx),removed=new Set((historySelection.removedRowIndices||[]).map(Number));
    const removing=!row.classList.contains("is-removed");
    if(removing){
      const left=[.../** @type {NodeListOf<HTMLElement>} */(card.querySelectorAll(".edrow[data-edidx]:not(.is-removed)"))];
      if(left.length<=1){toast(t("history.edit.keep_one"));return}
      removed.add(index);historySelection.removedRowIndices=[...removed].sort((a,c)=>a-c);
      row.classList.add("is-removed");setEdrowRmState(b,true);
      // A removed row is not saved, so a reason about its values goes with them.
      if(/** @type {HTMLInputElement|null} */(row.querySelector('.edrow__in[aria-invalid="true"]')))historyClearErrors(card);
      /** @type {NodeListOf<HTMLInputElement>} */(row.querySelectorAll(".edrow__in")).forEach(inp=>{inp.disabled=true;inp.removeAttribute("aria-invalid")});
      historySelection.dirty=true}
    else{removed.delete(index);historySelection.removedRowIndices=[...removed].sort((a,c)=>a-c);
      row.classList.remove("is-removed");setEdrowRmState(b,false);
      /** @type {NodeListOf<HTMLInputElement>} */(row.querySelectorAll(".edrow__in")).forEach(inp=>inp.disabled=false);historySelection.dirty=true}}));
  listen($(".session--edit"),"input",historyApplyWorkingInput);
}
async function historyCancelOperation(){
  if(disposed)return false;
  const sid=historySelection.sessionId;
  if(historySelection.dirty&&!await historyDiscardAgreed(sid))return false;
  const next=historySelectionFor(historySelection.sessionId);
  historySetSelection(next||emptyHistorySelection());
  renderHistory();
  if(next)historyFocusRead(sid);else historyFocus($("#historyRecentLabel"));historyOutcome("cancel","success");
  return true}
function bindHistorySelection(){
  listen($("[data-history-back]"),"click",historyBackToCalendar);
  listen($("[data-history-edit]"),"click",historyStartEditing);
  listen($("[data-history-delete-cancel]"),"click",historyCancelOperation);
  listen($("[data-history-delete-confirm]"),"click",()=>deleteSession(required("[data-history-delete-confirm]").dataset.historyDeleteConfirm,{originalFingerprint:historySelection.originalFingerprint,operationId:historySelection.operationId}));
  $$("[data-del]").forEach(b=>listen(b,"click",async e=>{
    e.stopPropagation();historyBeginDelete(b.dataset.del)}));
  $$("[data-edcancel]").forEach(b=>listen(b,"click",historyCancelOperation));
  $$("[data-edsave]").forEach(b=>listen(b,"click",()=>saveSessionEdit(b.dataset.edsave)));
  $$("[data-history-reload]").forEach(b=>listen(b,"click",()=>historyReloadLatest()));
  $$("[data-history-cancel]").forEach(b=>listen(b,"click",historyCancelOperation));
  $$("[data-history-retry]").forEach(b=>listen(b,"click",historyRetryEdit));
  bindHistoryEditRows()}

// ---- The list: blocks, weeks and sessions (Plan 064 R3j) ----
// Everything shown here derives from the saved log and the block bounds. The
// counts, the week tallies and the PR marks are read, never stored.
/** @type {WeakMap<Readonly<HistoryIndex>,Map<string,Set<string>>>} */
const historyPrCache=new WeakMap();
/** Session id -> the lifts that broke a record in it. Only an event that beat an
 *  earlier best carries a delta, so a lift's first appearance is not a record. */
/** @param {Readonly<HistoryIndex>} index @returns {Map<string,Set<string>>} */
function historyPrLifts(index){
  let found=historyPrCache.get(index);if(found)return found;
  found=new Map();
  for(const ev of index.prEvents||[]){
    if(ev.deltaLoad==null&&ev.deltaReps==null&&ev.deltaE1rm==null)continue;
    const sid=String(ev.session);if(!found.has(sid))found.set(sid,new Set());
    /** @type {Set<string>} */(found.get(sid)).add(ev.liftKey)}
  historyPrCache.set(index,found);return found}
const historyContext=()=>queries.context().block;
/** The current block first, then archived ones, newest first. */
/** @param {import("../../app/history-contracts.js").HistoryBlockContext} ctx @returns {import("../../app/history-contracts.js").HistoryBlock[]} */
function historyBlocks(ctx){
  const out=[];
  if(ctx.started&&+ctx.planned>0)out.push({key:"current",kind:"current",name:ctx.name||"",start:ctx.started,end:null,planned:+ctx.planned});
  const archived=(ctx.archived||[]).filter(b=>b&&b.start&&+b.planned>0)
    .sort((a,b)=>String(b.start).localeCompare(String(a.start)));
  archived.forEach((b,i)=>out.push({key:`archive:${i}`,kind:"archived",name:b.name||"",start:b.start,end:b.end||null,planned:+b.planned}));
  return out}
const historyLocale=()=>queries.context().locale;
/** @param {number} value */
function historyInt(value){
  const n=Math.round(Number(value)||0);
  try{return n.toLocaleString(historyLocale())}catch{return String(n)}}
/** @param {string|null} iso */
function historyShortDate(iso){
  const d=new Date(`${iso}T12:00:00`);
  return Number.isNaN(+d)?String(iso||""):`${d.getDate()} ${t("month_short."+d.getMonth())}`}
/** @param {number} m */
function historyMonthName(m){const s=t("month."+m);return s?s.charAt(0).toUpperCase()+s.slice(1):s}
/** Names as a spoken list. The separators are decoration, so they stay out of
 *  the accessibility tree and every name keeps its own element. */
/** @param {string[]} items */
function historyNameList(items){
  if(!items.length)return"";
  let parts=null;
  try{parts=new Intl.ListFormat(historyLocale(),{style:"long",type:"conjunction"}).formatToParts(items)}catch{}
  if(!parts)parts=items.flatMap((value,i)=>i?[{type:"literal",value:" · "},{type:"element",value}]:[{type:"element",value}]);
  return parts.map(p=>p.type==="element"?`<span>${esc(p.value)}</span>`:`<span aria-hidden="true">${esc(p.value)}</span>`).join("")}
/** @param {number} n */
const historySetsText=n=>n===1?t("history.sets.one",{n}):t("entry.catalogue.sets_exact",{n});
/** "1 session" / "2 sessions": the count catalog keeps a `_one` form for exactly 1 (R7 V-14). */
/** @param {string} kind @param {number} n */
const historyCountText=(kind,n)=>t(n===1?`count.${kind}_one`:`count.${kind}`,{n});
/** @param {number} n */
const historyPrText=n=>n===1?t("history.prs",{n}):t("history.prs_many",{n});

/** @param {Readonly<HistoryIndex>} index @param {string|undefined} date */
function historyMonthHeading(index,date){
  const ym=String(date||"").slice(0,7),bucket=index.months?.get(ym);
  if(!bucket)return"";
  const d=new Date(`${date}T12:00:00`);
  return`<h3 class="hist-month"><b>${esc(t("history.month_title",{month:historyMonthName(d.getMonth()),year:d.getFullYear()}))}</b>`+
    `<span>${esc(t("history.month_summary",{sessions:historyCountText("sessions",bucket.sessions.size),sets:historyCountText("sets",bucket.sets)}))}</span></h3>`}

/** @param {HistorySession} s @param {Map<string,Set<string>>} prLifts */
function historyRowHtml(s,prLifts){
  const sets=s.rows,work=sets.filter(isWork),volumeRows=work.filter(row=>!isSourceMetricRow(row)||historyHasLoadAndReps(row)),
    vol=sum(volumeRows.map(x=>(Number(x.load)||0)*(Number(x.reps)||0)));
  const d=new Date(`${s.date}T12:00:00`),valid=!Number.isNaN(+d);
  const muscles=[...new Set(work.map(r=>String(r.primary||"").split(",")[0].trim()).filter(Boolean))].slice(0,3).map(muscleLabel);
  const prs=prLifts.get(String(s.session))?.size||0;
  // The card is the way in: one control per row, and it opens the session.
  return`<article class="hist-row session" data-sess="${esc(s.session)}">`+
    `<button type="button" class="session__open" data-edit="${esc(s.session)}" aria-label="${esc(t("history.session_open_aria",{day:dayLabel(s.day)}))}">`+
    `<span class="hist-sess__d">${valid?`<small>${esc(t("weekday."+d.getDay()))}</small><b>${d.getDate()}</b>`:""}</span>`+
    `<span class="hist-sess__m"><b>${esc(dayLabel(s.day))}</b>${muscles.length?`<small>${historyNameList(muscles)}</small>`:""}</span>`+
    `<span class="hist-sess__n"><span>${esc(historySetsText(sets.length))}</span>`+
    (volumeRows.length?`<span><b>${esc(historyInt(toDisplay(vol)))}</b> ${esc(unitLabel())}</span>`:"")+
    (prs?`<span class="hist-sess__pr">${esc(historyPrText(prs))}</span>`:"")+`</span></button></article>`}

/** @param {Readonly<HistoryIndex>} index @param {readonly HistorySession[]} shown */
function historyListHtml(index,shown){
  const groups=historyWeekGroups({sessions:index.sessions,shown,blocks:historyBlocks(historyContext())});
  const prLifts=historyPrLifts(index);
  let out="",lastMonth="";
  /** @param {string|undefined} date */
  const month=date=>{const key=String(date||"").slice(0,7);if(key===lastMonth)return"";lastMonth=key;return historyMonthHeading(index,date)};
  for(const group of groups){
    if(group.kind==="archived"){out+=`<h3 class="hist-block">${esc(group.name||t("untitled_program"))}</h3>`;lastMonth=""}
    for(const week of group.weeks){
      out+=month(week.sessions[0].date);
      out+=`<h3 class="hist-week">${esc(week.week!=null
        ?t("history.week",{n:week.week,done:week.done,planned:week.planned})
        :t("history.week_of",{date:historyShortDate(week.monday)}))}</h3>`;
      for(const s of week.sessions)out+=month(s.date)+historyRowHtml(s,prLifts)}}
  return out}

// ---- Frequency counts: two small tallies above the list ----
/** @param {{count:number|null,share:number,label:string,now?:boolean,show?:boolean}} input */
function historyFreqBar({count,share,label,now=false,show=true}){
  return`<span class="freqcount__bar${now?" freqcount__bar--now":""}"><span class="freqcount__n">${show&&count!=null?count:""}</span>`+
    `<span class="freqcount__track"><span class="freqcount__fill" style="--freq-share:${share}"></span></span>`+
    `<span class="freqcount__label">${esc(label)}</span></span>`}
/** @param {Readonly<HistoryIndex>} index */
function renderHistoryFrequency(index){
  const el=$("#historyFreq");if(!el)return;
  const ctx=historyContext();
  const freq=historyFrequency({sessions:index.sessions,started:ctx.started,weeks:ctx.weeks,planned:ctx.planned,today:ctx.today});
  if(!freq){el.classList.add("hidden");el.innerHTML="";return}
  el.classList.remove("hidden");
  // Many weeks leave no room for every label, so a long block names every fourth.
  const thin=freq.total>16;
  const weekBars=freq.weeks.map(w=>historyFreqBar({
    count:w.reached?w.count:null,share:w.reached?Math.min(1,w.count/freq.weekScale):0,now:w.current,
    label:!thin||w.week%4===1?t("history.freq.wk",{n:w.week}):" "})).join("");
  const letters=weekdayLetters();
  const dayBars=freq.weekdays.map(d=>historyFreqBar({
    count:d.count||null,share:Math.min(1,d.count/freq.weekdayScale),label:letters[d.index]})).join("");
  const plan=Math.min(1,freq.planned/freq.weekScale);
  el.innerHTML=`<h3 class="histfreq__title" id="historyFreqTitle">${esc(t("history.freq.title"))}</h3>`+
    `<div class="histfreq__plots${freq.total>6?" histfreq__plots--stack":""}" role="img" `+
    `aria-label="${esc(t("history.freq.total",{done:freq.done,planned:freq.plannedTotal,n:freq.now,total:freq.total}))}">`+
    `<div class="histfreq__col" aria-hidden="true"><p class="histfreq__cap">${esc(t("history.freq.per_week"))}</p>`+
    `<div class="freqcount freqcount--planned" style="--freq-plan:${plan}">${weekBars}</div></div>`+
    `<div class="histfreq__col" aria-hidden="true"><p class="histfreq__cap">${esc(t("history.freq.per_weekday"))}</p>`+
    `<div class="freqcount">${dayBars}</div></div></div>`}

// ---- The calendar sheet ----
function historyCalendarOpen(){const sheet=$("#historyCalSheet");return!!sheet&&!sheet.hidden}
function openHistoryCalendar(){
  if(disposed)return false;
  const sheet=$("#historyCalSheet"),scrim=$("#historyCalScrim");
  if(!sheet||historyCalendarOpen()||typeof shell.openModal!=="function")return false;
  if(!histMonth){const n=new Date();histMonth={y:n.getFullYear(),m:n.getMonth()}}
  renderHistoryCalendar(historyIndexFor(queries.rows()));
  document.body.classList.add("is-sheet-open");
  const reduced=typeof shell.reducedMotion==="function"&&shell.reducedMotion();
  shell.openModal(sheet,{onEscape:closeHistoryCalendar,scrim,returnFocus:$("#historyCalBtn"),delayHide:reduced?0:280});
  calendarFrame=requestAnimationFrame(()=>{calendarFrame=0;if(disposed)return;sheet.classList.add("is-open");scrim?.classList.add("is-open")});
  $("#historyCalBtn")?.setAttribute("aria-expanded","true");
  return true}
function closeHistoryCalendar(){
  if(calendarFrame)window.cancelAnimationFrame(calendarFrame);calendarFrame=0;
  const sheet=$("#historyCalSheet");
  $("#historyCalBtn")?.setAttribute("aria-expanded","false");
  if(!sheet||sheet.hidden||typeof shell.closeModal!=="function")return Promise.resolve(false);
  return shell.closeModal(sheet)}
/** The chrome that outlives a render: the calendar button, the sheet's close and
 *  scrim, Search and a tap on a trained day. The current render owns every binding. */
function bindHistoryChrome(){
  listen($("#historySearchBtn"),"click",()=>setHistorySearchOpen(!isHistorySearchOpen()));
  const search=/** @type {HTMLInputElement|null} */($("#historySearch"));
  listen(search,"input",()=>{if(disposed||!search)return;histQuery=search.value;renderHistory()});
  listen($("#historySearchClear"),"click",clearHistorySearch);
  const open=$("#historyCalBtn");if(open)listen(open,"click",openHistoryCalendar);
  const close=$("#historyCalClose");if(close)listen(close,"click",closeHistoryCalendar);
  const scrim=$("#historyCalScrim");if(scrim)listen(scrim,"click",closeHistoryCalendar);
  const cal=$("#historyCalendar");
  if(cal)listen(cal,"click",event=>{
    const day=event.target instanceof Element?/** @type {HTMLElement|null} */(event.target.closest("[data-cal-session]")):null;
    if(!day)return;
    const sid=day.dataset.calSession;
    // Wait for the sheet to hand the page back, or the heading cannot take focus.
    closeHistoryCalendar().then(()=>historyStartReading(sid))})}

/** @param {Readonly<HistoryIndex>} index */
function renderHistoryCalendar(index){if(disposed)return;clearListeners(calendarListeners);const el=$("#historyCalendar");if(!el)return;
  if(!histMonth){const n=new Date();histMonth={y:n.getFullYear(),m:n.getMonth()}}
  const {y,m}=histMonth,first=new Date(y,m,1),startDow=(first.getDay()+6)%7;
  const daysInMonth=new Date(y,m+1,0).getDate(),prevDays=new Date(y,m,0).getDate();
  const ym=`${y}-${String(m+1).padStart(2,"0")}`;
  const month=index?.months?.get(ym)||{sessions:new Set(),sets:0,byDay:new Map()};
  const sessCount=month.sessions.size,setCount=month.sets;
  // The newest session of each trained day is the one a tap opens.
  const opens=new Map();
  for(const s of index?.sessions||[]){
    if(String(s.date||"").slice(0,7)!==ym)continue;
    const dayNum=+String(s.date).slice(8,10);if(!opens.has(dayNum))opens.set(dayNum,s)}
  const letters=weekdayLetters();
  // Monday-start letters already match weekdayLetters
  let cells=letters.map(l=>`<div class="cal-grid__dow">${esc(l)}</div>`).join("");
  for(let i=0;i<42;i++){let dayNum,out=false,iso;
    if(i<startDow){dayNum=prevDays-startDow+i+1;out=true;const pm=m===0?11:m-1,py=m===0?y-1:y;iso=`${py}-${String(pm+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`}
    else if(i-startDow>=daysInMonth){dayNum=i-startDow-daysInMonth+1;out=true;const nm=m===11?0:m+1,ny=m===11?y+1:y;iso=`${ny}-${String(nm+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`}
    else{dayNum=i-startDow+1;iso=`${y}-${String(m+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`}
    const trained=!out&&opens.get(dayNum),isToday=iso===today();
    const cls=`cal-grid__day${out?" is-out":""}${trained?" is-on":""}${isToday&&!out?" is-today":""}`;
    cells+=trained
      ?`<button type="button" class="${cls}" data-cal-session="${esc(trained.session)}" aria-label="${esc(t("history.session_open_aria",{day:dayLabel(trained.day)}))}">${dayNum}</button>`
      :`<div class="${cls}">${dayNum}</div>`;
    if(i===41)break;if(i>=startDow+daysInMonth-1&&(i+1)%7===0)break}
  const title=$("#historyCalTitle"),sub=$("#historyCalSub");
  if(title)title.textContent=t("history.month_title",{month:historyMonthName(m),year:y});
  if(sub)sub.textContent=t("history.month_summary",{sessions:historyCountText("sessions",sessCount),sets:historyCountText("sets",setCount)});
  el.innerHTML=`<div class="cal-head"><button type="button" class="icon-btn icon-btn--ghost" id="calPrev" aria-label="${esc(t("history.calendar_prev_aria"))}"><span class="chevron cal-head__prev" aria-hidden="true"></span></button>`+
    `<button type="button" class="icon-btn icon-btn--ghost" id="calNext" aria-label="${esc(t("history.calendar_next_aria"))}"><span class="chevron" aria-hidden="true"></span></button></div>`+
    `<div class="cal-grid">${cells}</div>`;
  listen(required("#calPrev"),"click",()=>{const month=/** @type {{y:number,m:number}} */(histMonth);if(month.m===0){histMonth={y:month.y-1,m:11}}else histMonth={y:month.y,m:month.m-1};renderHistoryCalendar(index)},calendarListeners);
  listen(required("#calNext"),"click",()=>{const month=/** @type {{y:number,m:number}} */(histMonth);if(month.m===11){histMonth={y:month.y+1,m:0}}else histMonth={y:month.y,m:month.m+1};renderHistoryCalendar(index)},calendarListeners)}

/** @param {readonly HistoryRow[]} [source] @returns {void} */
function renderHistory(source=queries.rows()){
  if(disposed)return;
  clearListeners();
  const selected=historySelection.mode!=="calendar";
  const selectionEl=$("#historySelection"),freqEl=$("#historyFreq"),recent=$("#historyRecentLabel"),tableDetails=/** @type {HTMLElement|null} */($("#historyTable")?.closest("details"));
  const listControls=[$("#historySearchBtn"),$("#historyCalBtn"),$("#historyExportBtn")];
  bindHistoryChrome();
  if(selected){
    const record=historySelectedRecord(source);
    if(!record){historySetSelection(emptyHistorySelection());return renderHistory(source)}
    // A session page never sits under the calendar sheet.
    closeHistoryCalendar();
    freqEl?.classList.add("hidden");recent?.classList.add("hidden");tableDetails?.classList.add("hidden");
    $("#historySearchWrap")?.classList.add("hidden");listControls.forEach(b=>b?.classList.add("hidden"));
    selectionEl?.classList.remove("hidden");
    const mode=historySelection.mode,copy=historySelection.workingCopy||record.rows;
    const longDate=formatLongDate(String(record.date||""));
    let body="";
    if(mode==="reading")body=historyReadingView(record,record.rows);
    else if(mode==="editing")body=sessionEditor(record,copy);
    else if(mode==="deleting")body=historyDeleteView(record);
    else body=historyConflictView(record,mode,historySelection.operation);
    // The session page owns the whole top of the view; the edit, delete and
    // conflict states keep the head they have always had.
    $("#history")?.classList.toggle("is-session-page",mode==="reading");
    $("#history")?.classList.toggle("is-session-edit",mode==="editing");
    /** @type {HTMLElement} */(selectionEl).innerHTML=mode==="reading"?historySessionHead(record):mode==="editing"?historyEditHead()
      :`<div class="history-selection__head"><button type="button" class="back-link" data-history-back><span class="chevron" aria-hidden="true"></span>${esc(t("history.title"))}</button>`+
      `<div class="history-selection__date"><span class="section-label">${esc(t("history.selected"))}</span><h3 data-history-selection-heading tabindex="-1">${esc(longDate)}</h3></div></div>`;
    required("#sessions").innerHTML=body;required("#historyTable").innerHTML="";
    bindHistorySelection();return}
  $("#history")?.classList.remove("is-session-page","is-session-edit");
  recent?.classList.remove("hidden");tableDetails?.classList.remove("hidden");
  listControls.forEach(b=>b?.classList.remove("hidden"));selectionEl?.classList.add("hidden");selectionEl&&(selectionEl.innerHTML="");
  if(!histMonth){const n=new Date();histMonth={y:n.getFullYear(),m:n.getMonth()}}
  const focusedToggle=document.activeElement?.matches?.("#sessions .session__open")?document.activeElement:null;
  const focusedSession=/** @type {HTMLElement|null} */(focusedToggle?.closest("[data-sess]"))?.dataset.sess||null;
  const index=historyIndexFor(source);
  renderHistoryFrequency(index);
  renderHistoryCalendar(index);
  const q=histQuery.trim();
  const sessions=searchHistoryIndex(index,q);
  syncHistorySearchChrome();
  required("#sessions").innerHTML=sessions.length?historyListHtml(index,sessions)
    :`<div class="table"><div class="empty" data-hist-empty="${q?"nomatch":"none"}">${esc(t(q?"history.empty.no_match":"history.empty.sessions"))}</div></div>`;
  if(focusedSession){
    const next=$$("#sessions .session__open").find(btn=>/** @type {HTMLElement|null} */(btn.closest("[data-sess]"))?.dataset.sess===focusedSession);
    if(next&&canTakeFocus(next)){try{next.focus({preventScroll:true})}catch{try{next.focus()}catch{}}}}
  $$("#sessions [data-edit]").forEach(b=>listen(b,"click",e=>{e.stopPropagation();historyStartReading(b.dataset.edit)}));
  const hasSourceMetrics=index.tableRows.some(isSourceMetricRow);
  const rows=index.tableRows.map(x=>hasSourceMetrics
    ?{[t("stats.table.date")]:x.date,[t("stats.table.day")]:dayLabel(x.day),[t("stats.table.exercise")]:shownName(x),
      [t("stats.table.set")]:x.warmup?"W"+x.set:x.set,
      [t("history.metrics")]:isSourceMetricRow(x)?markup.metricSummary(x)
        :`${fmtLoad(x.load)} ${unitLabel()} × ${x.reps}`,
      [t("stats.table.rir")]:x.rir==null?"":fmt(x.rir)}
    :{[t("stats.table.date")]:x.date,[t("stats.table.day")]:dayLabel(x.day),[t("stats.table.exercise")]:shownName(x),[t("stats.table.set")]:x.warmup?"W"+x.set:x.set,[unitLabel()]:fmtLoad(x.load),[t("stats.table.reps")]:x.reps,[t("stats.table.rir")]:fmt(x.rir)});
  required("#historyTable").innerHTML=table(rows);
}


const EDROW_RM_GLYPH={remove:"×",undo:"↺"};
// The per-row remove control is icon-only, so its state lives in the glyph plus
// the accessible name rather than visible copy.
/** @param {HTMLElement} btn @param {boolean} removed */
function setEdrowRmState(btn,removed){
  const label=t(removed?"history.edit.undo_remove":"history.edit.remove_set");
  btn.setAttribute("aria-label",label);btn.title=label;btn.classList.toggle("is-undo",removed);
  const glyph=/** @type {HTMLElement|null} */(btn.querySelector(".edrow__rm-glyph"))||btn;
  glyph.textContent=removed?EDROW_RM_GLYPH.undo:EDROW_RM_GLYPH.remove}

// The editor is the session page turned into a form (Plan 064 R3j2): the lift's name once
// per group, one ledger row per set with load, reps and RIR inputs and a quiet remove, the
// date as a field, and Cancel and Save pinned on a shelf with the dock hidden. A removed
// row stays on the page, struck through, until Undo or Save.
function historyEditHead(){
  return`<div class="histpage__head"><button type="button" class="back-link" data-history-back><span class="chevron" aria-hidden="true"></span>${esc(t("history.title"))}</button></div>`}
/** @param {HistorySession} record @param {readonly HistoryRow[]} sets */
function sessionEditor(record,sets){
  /** @type {{key:string,rows:{r:HistoryRow,i:number}[]}[]} */
  const groups=[];
  sets.forEach((row,index)=>{const key=liftKey(row),last=groups.at(-1);if(last&&last.key===key)last.rows.push({r:row,i:index});else groups.push({key,rows:[{r:row,i:index}]})});
  return markup.editSession({record:{...record,dayLabel:dayLabel(record.day)},sets,selection:historySelection,
    groups:groups.map(group=>({...group,name:shownName(group.rows[0].r)}))});
}

// The editor is a volatile projection. Its commit path validates the exact
// session fingerprint again while holding the durable-state lock, so an edit
// can never merge over a changed or deleted session.
/** @param {SessionId} sid */
async function saveSessionEdit(sid){
  if(disposed)return{ok:false,committed:false,settled:true,cancelled:true,code:"history_cancelled",localOk:false,idbOk:false};
  const card=$(".session--edit[data-editing=\""+String(sid).replaceAll("\"","\\\"")+"\"]");if(!card)return;
  const parsed=historySessionFromWorkingCopy(card);
  if(parsed.error){historyMarkValidation(card,parsed.error);historyOutcome("edit_save","failure");return}
  if(!parsed.rows.length){toast(t("history.edit.keep_one"));historyOutcome("edit_save","failure");return}
  const proposed=parsed.rows,original=String(historySelection.sessionId)===String(sid)?historySelection.originalFingerprint:"";
  const desired=historySessionFingerprint(proposed);
  const operationId=uid();
  historySelection.workingCopy=cloneSnapshot(proposed);
  historySelection.desiredFingerprint=desired;
  historySelection.removedRowIndices=[];historySelection.dirty=true;historySelection.operation="edit";historySelection.operationId=operationId;
  if(!original){
    historySelection.mode="failure";
    const result={ok:false,committed:false,settled:true,failed:true,code:"history_missing_fingerprint",revision:queries.context().revision,localOk:false,idbOk:false};
    await historyFinishResult(result,"toast.session_updated","edit",operationId);
    return result}
  const result=await historyEditCommit(sid,proposed,original);
  await historyFinishResult(result,"toast.session_updated","edit",operationId);
  return result}

    return {
      dispose(){disposed=true;if(discardFrame)window.cancelAnimationFrame(discardFrame);discardFrame=0;retryController?.abort();clearListeners();clearListeners(calendarListeners);clearListeners(discardListeners);cancelDiscard?.();closeHistoryCalendar();historySetSelection(emptyHistorySelection())},
      buildIndex:buildHistoryIndex,
      indexFor:historyIndexFor,
      searchIndex:searchHistoryIndex,
      fingerprint:historySessionFingerprint,
      selection:()=>cloneSnapshot(historySelection),
      renderWithSource:renderHistory,
      diagnostics:historyDiagnostics,
      render:renderHistory,
      startReading:historyStartReading,
      focusRead:historyFocusRead,
      startEditing:historyStartEditing,
      beginDelete:historyBeginDelete,
      cancelOperation:historyCancelOperation,
      reloadLatest:historyReloadLatest,
      retryEdit:historyRetryEdit,
      saveSessionEdit,
      deleteSession,
      isSearchOpen:isHistorySearchOpen,
      setSearchOpen:setHistorySearchOpen,
      clearSearch:clearHistorySearch,
      /** @param {unknown} value */
      setQuery(value){if(disposed)return;histQuery=String(value??"");renderHistory()},
      query:()=>histQuery,
    };
}
