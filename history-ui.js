(function historyUiModule(root){
  function createHistoryUi(deps){
    const {
      $, $$, t, esc, cloneSnapshot, currentMovementNames, mergeLogChronology,
      compareLogChronology, isWork, liftKey, buildSessionDelta, detectPRs,
      displayName, currentNameForRow, dayLabel, canTakeFocus, parseCalendarDate,
      parseLoadDisplay, parseRepsValue, parseRirValue, clearFieldInvalid,
      toast, formatLongDate, fmtLoad, sum, kfmt, toDisplay, unitLabel,
      weekdayLetters, table, fmt, today, uid, readRevision, commitProposedState,
      readDurableState, settleHistoryAlreadyCommitted, settlePendingJournal, getState,
      renderApp, captureEvent,
    } = deps;
    const state=new Proxy({}, {get(_target,key){return getState()?.[key]}});
    const render=()=>renderApp();
    const emptyHistorySelection=()=>({mode:"calendar",sessionId:null,originalFingerprint:"",
      desiredFingerprint:null,workingCopy:null,removedRowIndices:[],dirty:false,validation:null,
      operation:null,operationId:null});
    let historySelection=emptyHistorySelection();
    let histMonth=null,histQuery="";
    const historyOutcome=(action,status)=>{try{if(typeof captureEvent==="function")captureEvent("history_session_outcome",{action,status})}catch{}};
const historyDiagnostics={enabled:false,builds:0,sourceRowVisits:0,last:null,onBuilt:null,
  reset(){this.enabled=true;this.builds=0;this.sourceRowVisits=0;this.last=null;this.onBuilt=null},
  disable(){this.enabled=false;this.last=null;this.onBuilt=null}};
const historyIndexCache=new WeakMap();
function buildHistoryIndex(log){
  const source=log||[];
  // Read the program's current movement names once per build; this is the only
  // thing in the index that depends on the program, and it is why historyIndexFor
  // still invalidates its cache when the program identity changes.
  const currentNames=currentMovementNames();
  const rows=[];
  const n=source.length;
  for(let i=0;i<n;i++){const raw=source[i];rows.push(raw&&typeof raw==="object"?raw:{})}
  const sessionMap=new Map();
  for(const row of rows){
    const sid=row&&row.session!=null?String(row.session):"";
    if(!sessionMap.has(sid))sessionMap.set(sid,{session:row.session,date:row.date,day:row.day,created:row.created,rows:[]});
    const session=mergeLogChronology(sessionMap.get(sid),row);
    session.rows.push(row)}
  for(const sess of sessionMap.values()){
    sess.rows.sort((a,b)=>String(displayName(a)).localeCompare(String(displayName(b)))||a.set-b.set)}
  const sessions=[...sessionMap.values()].sort((a,b)=>compareLogChronology(b,a));
  const liftChrono=new Map();
  for(const row of rows){
    if(!isWork(row)||!(+row.load>0)||!(+row.reps>0))continue;
    const k=liftKey(row);
    if(!liftChrono.has(k))liftChrono.set(k,new Map());
    const sm=liftChrono.get(k);
    if(!sm.has(row.session))sm.set(row.session,{session:row.session,date:row.date,created:row.created,rows:[]});
    const session=mergeLogChronology(sm.get(row.session),row);
    session.rows.push(row)}
  const liftPred=new Map();
  for(const[k,sm]of liftChrono){
    const ordered=[...sm.values()].sort(compareLogChronology);
    for(let i=0;i<ordered.length;i++){
      const cur=ordered[i],pred=i>0?ordered[i-1].rows:[];
      liftPred.set(`${cur.session}|${k}`,pred)}}
  for(const sess of sessions){
    const byLift=new Map();
    for(const r of sess.rows){
      if(!isWork(r)||!(+r.load>0)||!(+r.reps>0))continue;
      const k=liftKey(r);if(!byLift.has(k))byLift.set(k,[]);byLift.get(k).push(r)}
    const counts={improved:0,flat:0,regressed:0,new:0};
    for(const[k,liftRows]of byLift){
      const pred=liftPred.get(`${sess.session}|${k}`)||[];
      if(!pred.length){counts.new++;continue}
      const d=buildSessionDelta(pred,liftRows);if(d.status in counts)counts[d.status]++}
    sess.delta=counts;
    const names=new Set(sess.rows.map(r=>String(displayName(r)||"")));
    // Aliases are additive: the performed label always stays searchable, and
    // the current program name only widens what finds the session.
    const aliases=new Set();
    for(const r of sess.rows){const alias=currentNameForRow(r,currentNames);if(alias&&!names.has(alias))aliases.add(alias)}
    sess.searchText=`${String(sess.day||"")} ${dayLabel(sess.day)} ${[...names,...aliases].join(" ")}`.toLowerCase()}
  const prEvents=detectPRs(rows);
  const prDates=new Set(prEvents.map(ev=>String(ev.date)));
  const months=new Map();
  for(const row of rows){
    const date=String(row.date||""),ym=date.slice(0,7);
    if(!/^\d{4}-\d{2}$/.test(ym))continue;
    if(!months.has(ym))months.set(ym,{sessions:new Set(),sets:0,byDay:new Map()});
    const bucket=months.get(ym);bucket.sessions.add(row.session);bucket.sets++;
    const dayNum=+date.slice(8,10);
    if(!bucket.byDay.has(dayNum))bucket.byDay.set(dayNum,{sets:0,pr:false});
    bucket.byDay.get(dayNum).sets++;
    if(prDates.has(date))bucket.byDay.get(dayNum).pr=true}
  const tableRows=[...rows].sort((a,b)=>compareLogChronology(b,a)||displayName(a).localeCompare(displayName(b))||a.set-b.set);
  const index={rows,sessions,months,prEvents,tableRows,liftPred};
  if(historyDiagnostics.enabled){
    historyDiagnostics.builds++;historyDiagnostics.sourceRowVisits+=rows.length;historyDiagnostics.last=index;
    if(typeof historyDiagnostics.onBuilt==="function")historyDiagnostics.onBuilt(index)}
  return index}
function historyIndexFor(log){
  const source=log||[];
  if(source&&typeof source==="object"){
    const cached=historyIndexCache.get(source);
    if(cached?.program===state.program)return cached.index;
    const index=buildHistoryIndex(source);
    historyIndexCache.set(source,{program:state.program,index});
    return index}
  return buildHistoryIndex(source)}
function searchHistoryIndex(index,query){
  const q=String(query||"").trim().toLowerCase(),sessions=index?.sessions||[];
  if(!q)return sessions.slice();
  return sessions.filter(s=>String(s.searchText||"").includes(q))}
function renderHistoryWithSource(source){renderHistory(source)}
function isHistorySearchOpen(){return!$("#historySearchWrap")?.classList.contains("hidden")}
function setHistorySearchOpen(open){
  if(!open&&histQuery.trim())return;
  $("#historySearchWrap")?.classList.toggle("hidden",!open);
  $("#historySearchBtn")?.setAttribute("aria-expanded",open?"true":"false");
  if(open)$("#historySearch")?.focus()}
function clearHistorySearch(){
  histQuery="";
  const inp=$("#historySearch");if(inp)inp.value="";
  renderHistory();
  setHistorySearchOpen(false)}
function syncHistorySearchChrome(){
  const open=isHistorySearchOpen()||!!histQuery.trim();
  if(histQuery.trim())$("#historySearchWrap")?.classList.remove("hidden");
  $("#historySearchBtn")?.setAttribute("aria-expanded",open?"true":"false");
  const inp=$("#historySearch");if(inp&&inp.value!==histQuery)inp.value=histQuery}
function historySessionRows(source,sid){
  return(source||[]).filter(row=>String(row?.session??"")===String(sid))
    .sort((a,b)=>String(displayName(a)).localeCompare(String(displayName(b)))||Number(a?.set||0)-Number(b?.set||0))}
function historySessionFingerprint(rows){
  // Canonicalize each complete row before sorting the encoded rows. Sorting the
  // row strings, rather than de-duplicating objects, keeps duplicate sets in
  // the identity and makes the fingerprint independent of display order.
  return JSON.stringify((Array.isArray(rows)?rows:[])
    .map(row=>JSON.stringify(canonicalize(row))).sort())}
function historySelectionFor(sid,mode="reading",source=state.log){
  const rows=historySessionRows(source,sid);if(!rows.length)return null;
  return{mode,sessionId:String(sid),originalFingerprint:historySessionFingerprint(rows),
    desiredFingerprint:null,workingCopy:mode==="editing"?cloneSnapshot(rows):null,
    removedRowIndices:[],dirty:false,validation:null,operation:null,operationId:null}}
function historySelectedRecord(source=state.log){
  const sid=historySelection.sessionId;if(!sid)return null;
  return historyIndexFor(source).sessions.find(item=>String(item.session)===String(sid))||null}
function historySetSelection(next){historySelection=next||emptyHistorySelection()}
function historyOperationCurrent(operationId,sid,operation){
  return typeof operationId==="string"&&operationId.length>0&&historySelection.operationId===operationId&&
    String(historySelection.sessionId)===String(sid)&&historySelection.operation===operation}
function historyFocus(node){
  if(!node||!canTakeFocus(node))return false;
  try{node.focus({preventScroll:true})}catch{try{node.focus()}catch{return false}}
  return true}
function historyEditAction(sid){
  return $$("#sessions [data-history-edit]").find(button=>String(button.dataset.historyEdit)===String(sid))||null}
function historyCalendarAction(sid){
  return $$("#sessions .session__open").find(button=>String(button.closest("[data-sess]")?.dataset.sess)===String(sid))||null}
function historyFocusRead(sid){
  const edit=historyEditAction(sid);
  if(historyFocus(edit))return true;
  const calendar=historyCalendarAction(sid);
  if(historyFocus(calendar))return true;
  return historyFocus($("#historyRecentLabel"))}
function historyFocusFailure(mode){
  return historyFocus($('[data-history-operation="'+CSS.escape(mode)+'"] h3'))}
function historyFocusEditing(){
  return historyFocus($("[data-history-editing-heading]"))}
function historyBackToCalendar(){
  const sid=historySelection.sessionId;
  if(historySelection.dirty&&!confirm(t("history.confirm.discard_changes")))return false;
  historySetSelection(emptyHistorySelection());
  renderHistory();
  historyFocus(historyCalendarAction(sid)||$("#historyRecentLabel"));historyOutcome("cancel","success");
  return true}
function historyStartReading(sid){
  const next=historySelectionFor(sid);if(!next)return false;
  histQuery="";historySetSelection(next);renderHistory();
  historyFocus($("[data-history-selection-heading]"));historyOutcome("read","success");return true}
function historyStartEditing(){
  const sid=historySelection.sessionId,rows=historySessionRows(state.log,sid);if(!rows.length)return false;
  historySetSelection({mode:"editing",sessionId:String(sid),originalFingerprint:historySelection.originalFingerprint,
    desiredFingerprint:null,workingCopy:cloneSnapshot(rows),removedRowIndices:[],dirty:false,validation:null,
    operation:null,operationId:null});
  renderHistory();historyFocusEditing();return true}
function historySessionFromWorkingCopy(card){
  const selection=historySelection,source=selection.workingCopy||historySessionRows(state.log,selection.sessionId),out=[];
  const dateEl=card?.querySelector('[data-ed="date"]'),dateP=parseCalendarDate(dateEl?.value);
  if(dateP.field)return{error:{field:dateEl,key:dateP.key},dateP};
  const removed=new Set((selection.removedRowIndices||[]).map(Number));
  for(const rowEl of card.querySelectorAll(".edrow[data-edidx]")){
    const i=Number(rowEl.dataset.edidx);if(removed.has(i))continue;
    const src=source[i];if(!src)continue;
    const loadEl=rowEl.querySelector('[data-ek^="load|"]'),repsEl=rowEl.querySelector('[data-ek^="reps|"]'),rirEl=rowEl.querySelector('[data-ek^="rir|"]');
    const loadP=parseLoadDisplay(loadEl?.value);if(loadP.field)return{error:{field:loadEl,key:loadP.key},dateP};
    const repsP=parseRepsValue(repsEl?.value);if(repsP.field)return{error:{field:repsEl,key:repsP.key},dateP};
    const rirP=parseRirValue(rirEl?.value);if(rirP.field)return{error:{field:rirEl,key:rirP.key},dateP};
    const next=cloneSnapshot(src);next.load=loadP.value;next.reps=repsP.value;next.rir=rirP.value;next.date=dateP.value;out.push(next)}
  return{rows:out,dateP}
}
function historyMarkValidation(card,error){
  clearFieldInvalid(card);if(error?.field){error.field.setAttribute("aria-invalid","true");try{error.field.focus()}catch{}}
  if(error?.key)toast(t(error.key));return false}
function historyApplyWorkingInput(event){
  const target=event.target,card=target.closest(".session--edit");if(!card||historySelection.mode!=="editing")return;
  const row=target.closest(".edrow[data-edidx]");if(row){const i=Number(row.dataset.edidx),key=String(target.dataset.ek||"").split("|")[0];
    const parsed=key==="load"?parseLoadDisplay(target.value):key==="reps"?parseRepsValue(target.value):key==="rir"?parseRirValue(target.value):null;
    if(historySelection.workingCopy?.[i]&&key&&parsed&&!parsed.field)historySelection.workingCopy[i][key]=parsed.value}
  if(target.matches('[data-ed="date"]')){
    const parsed=parseCalendarDate(target.value);
    if(!parsed.field)for(const row of historySelection.workingCopy||[])row.date=parsed.value}
  historySelection.dirty=true}
function historyResultMessage(result,successKey,operation,operationId){
  const action=operation==="edit"?"edit_save":"delete";
  if(result?.committed===true&&result?.settled===true){historyOutcome(action,"success");return"committed"}
  if(result?.conflict||result?.stale||result?.staleRevision||result?.duplicate){historySelection={...historySelection,mode:"conflict",operation,operationId};historyOutcome(action,"conflict");return"conflict"}
  historySelection={...historySelection,mode:"failure",operation,operationId};historyOutcome(action,"failure");return"failure"}
function adoptHistoryDurableHead(head){if(head)deps.adoptHistoryDurableHead(head)}
async function historyReloadLatest(){
  const sid=historySelection.sessionId,startedMode=historySelection.mode,
    startedOperation=historySelection.operation,startedOperationId=historySelection.operationId,
    refreshed=await readDurableState();
  if(String(historySelection.sessionId)!==String(sid)||historySelection.mode!==startedMode||
    historySelection.operation!==startedOperation||historySelection.operationId!==startedOperationId)return null;
  // The durable owner returns its last trusted head when replicas disagree or
  // a recovery journal is still pending. That head is not a reload result: do
  // not let a UI refresh turn an unresolved storage state into a silent stale
  // selection.
  if(refreshed?.ok!==true||refreshed.pendingJournal===true)return null;
  if(refreshed?.head)adoptHistoryDurableHead(refreshed.head);
  const next=historySelectionFor(sid);
  if(next)historySetSelection(next);else historySetSelection(emptyHistorySelection());
  render();
  if(next)historyFocusRead(sid);else historyFocus($("#historyRecentLabel"));
  return next}
async function historyFinishResult(result,successKey,operation,operationId){
  const sid=historySelection.sessionId;
  if(!historyOperationCurrent(operationId,sid,operation))return false;
  let settledResult=result;
  if(result?.alreadyCommitted){
    const desired=historySelection.desiredFingerprint;
    const settled=await settleHistoryAlreadyCommitted({
      pendingJournalId:result.pendingJournalId,
      verify:head=>{
        const rows=historySessionRows(head?.log,sid);
        const ok=operation==="delete"
          ? rows.length===0
          : typeof desired==="string"&&historySessionFingerprint(rows)===desired;
        return{ok,code:"history_settlement_mismatch"}}
    });
    settledResult=settled;
    if(!historyOperationCurrent(operationId,sid,operation))return false;
    if(settled?.committed===true&&settled?.settled===true&&settled.head)
      adoptHistoryDurableHead(settled.head);
  }
  const status=historyResultMessage(settledResult,successKey,operation,operationId);
  if(status==="committed"){
    const next=historySelectionFor(sid);
    historySetSelection(next||emptyHistorySelection());
    render();historyFocusRead(sid);toast(t(successKey));return true}
  render();historyFocusFailure(status);return false}
function historyEditCommit(sid,proposed,original){
  const desired=historySessionFingerprint(proposed),proposal=cloneSnapshot(deps.getState());
  proposal.log=proposal.log.filter(row=>String(row?.session??"")!==String(sid)).concat(cloneSnapshot(proposed));
  const preflight=({head})=>{
    const current=historySessionRows(head.log,sid),fingerprint=historySessionFingerprint(current);
    if(fingerprint===desired)return{reject:true,result:{ok:true,committed:true,alreadyCommitted:true,
      revision:readRevision(head),localOk:true,idbOk:true,kind:"committed"}};
    if(!current.length || fingerprint!==original)return{reject:true,result:{ok:false,committed:false,conflict:true,stale:true,
      code:"history_stale",revision:readRevision(head),localOk:false,idbOk:false}};
    const next=cloneSnapshot(head);
    next.log=next.log.filter(row=>String(row?.session??"")!==String(sid)).concat(cloneSnapshot(proposed));
    return{proposal:next}};
  return commitProposedState(proposal,{preflight})}
async function historyRetryEdit(){
  const sid=historySelection.sessionId,original=historySelection.originalFingerprint;
  const proposed=cloneSnapshot(historySelection.workingCopy||[]);
  const desired=historySelection.desiredFingerprint||historySessionFingerprint(proposed);
  if(!sid||!original||!proposed.length){historyOutcome("edit_save","failure");return false};
  const operationId=uid();
  historySelection={...historySelection,mode:"failure",operation:"edit",operationId,
    desiredFingerprint:desired,workingCopy:proposed,dirty:true};
  const refreshed=await readDurableState();
  if(!historyOperationCurrent(operationId,sid,"edit"))return false;
  if(refreshed?.ok!==true){
    historySelection={...historySelection,mode:"conflict",operation:"edit",operationId};
    render();historyFocusFailure("conflict");return false}
  if(refreshed?.head)adoptHistoryDurableHead(refreshed.head);
  const current=historySessionRows(state.log,sid),fingerprint=historySessionFingerprint(current);
  if(!current.length || (fingerprint!==original && fingerprint!==desired)){
    historySelection={...historySelection,mode:"conflict",desiredFingerprint:desired,
      workingCopy:proposed,dirty:true,operation:"edit",operationId};
    render();historyFocusFailure("conflict");return false}
  if(refreshed?.pendingJournal){
    const settled=await settlePendingJournal();
    if(!historyOperationCurrent(operationId,sid,"edit"))return false;
    if(!(settled?.committed===true&&settled?.settled===true)){
      return await historyFinishResult(settled,"toast.session_updated","edit",operationId)}
    const refreshedAfterSettlement=await readDurableState();
    if(!historyOperationCurrent(operationId,sid,"edit"))return false;
    if(refreshedAfterSettlement?.ok!==true){
      historySelection={...historySelection,mode:"conflict",operation:"edit",operationId};
      render();historyFocusFailure("conflict");return false}
    if(refreshedAfterSettlement?.head)adoptHistoryDurableHead(refreshedAfterSettlement.head);
    const settledRows=historySessionRows(state.log,sid);
    if(historySessionFingerprint(settledRows)===desired){
      return await historyFinishResult(settled,"toast.session_updated","edit",operationId)}
  }
  // Retry remains a durable-owner operation even when the visible replica
  // already contains the desired rows. The normalized owner result is the
  // only authority for whether the preserved WAL has actually settled.
  const result=await historyEditCommit(sid,proposed,original);
  await historyFinishResult(result,"toast.session_updated","edit",operationId);
  return result?.committed===true&&result?.settled===true}
function historyBeginDelete(sid){
  const rows=historySessionRows(state.log,sid);if(!rows.length)return false;
  if(historySelection.mode==="editing"&&historySelection.dirty&&!confirm(t("history.confirm.discard_changes")))return false;
  const selected=String(historySelection.sessionId)===String(sid)&&typeof historySelection.originalFingerprint==="string"&&historySelection.originalFingerprint;
  historySetSelection({mode:"deleting",sessionId:String(sid),originalFingerprint:selected||historySessionFingerprint(rows),
    desiredFingerprint:null,workingCopy:null,removedRowIndices:[],dirty:false,validation:null,
    operation:"delete",operationId:uid()});
  renderHistory();historyFocus($("[data-history-delete-status]"));return true}
async function deleteSession(sid,{originalFingerprint=null,operationId=null}={}){
  const original=typeof originalFingerprint==="string"?originalFingerprint:"";
  if(!original){
    const result={ok:false,committed:false,settled:true,failed:true,code:"history_missing_fingerprint",revision:readRevision(state),localOk:false,idbOk:false};
    await historyFinishResult(result,"toast.session_deleted","delete",operationId||historySelection.operationId);
    return result}
  const proposal=cloneSnapshot(getState());
  proposal.log=proposal.log.filter(row=>String(row?.session??"")!==String(sid));
  const preflight=({head})=>{
    const current=historySessionRows(head.log,sid),fingerprint=historySessionFingerprint(current);
    if(!current.length)return{reject:true,result:{ok:true,committed:true,alreadyCommitted:true,
      revision:readRevision(head),localOk:true,idbOk:true,kind:"committed"}};
    if(fingerprint!==original)return{reject:true,result:{ok:false,committed:false,conflict:true,stale:true,
      code:"history_stale",revision:readRevision(head),localOk:false,idbOk:false}};
    const next=cloneSnapshot(head);
    next.log=next.log.filter(row=>String(row?.session??"")!==String(sid));
    return{proposal:next};
  };
  const result=await commitProposedState(proposal,{preflight});
  await historyFinishResult(result,"toast.session_deleted","delete",operationId||historySelection.operationId);
  return result}
function historyReadingView(s,rows){
  const setRows=rows.map(row=>`<div class="history-read__row"><span class="history-read__name">${esc(displayName(row))}</span>`+
    `<span class="history-read__set">#${esc(row.set)}</span><span>${esc(fmtLoad(row.load))}</span>`+
    `<span>${esc(String(row.reps??"—"))}</span><span>${esc(fmt(row.rir))}</span></div>`).join("");
  const volume=sum(rows.filter(isWork).map(x=>(+x.load||0)*(+x.reps||0)));
  return`<article class="session session--read" data-reading="${esc(s.session)}" data-sess="${esc(s.session)}">`+
    `<div class="history-read__title"><div><div class="session__day">${esc(dayLabel(s.day))}</div>`+
    `<p class="session__sub">${esc(t("history.session_meta",{sets:rows.length,vol:kfmt(toDisplay(volume)),unit:unitLabel()}))}</p></div></div>`+
    `<div class="history-read__head"><span>${esc(t("history.exercise"))}</span><span>${esc(t("log.set"))}</span><span>${unitLabel()}</span><span>${esc(t("log.reps"))}</span><span>${esc(t("glossary.term.RIR"))}</span></div>`+
    `<div class="history-read__rows">${setRows}</div>`+
    `<div class="history-read__actions"><button type="button" class="btn btn--cta" data-history-edit="${esc(s.session)}">${esc(t("history.session.edit"))}</button>`+
    `<button type="button" class="session__del" data-del="${esc(s.session)}">${esc(t("history.session.delete"))}</button></div></article>`}
function historyDeleteView(s){
  return '<article class="session session--delete" data-deleting="'+esc(s.session)+'" role="alert">'+
    '<div class="history-delete__icon" aria-hidden="true">!</div><h3 data-history-delete-status tabindex="-1">'+esc(t("history.delete_title"))+'</h3>'+
    '<p>'+esc(t("confirm.delete_session"))+'</p><div class="edbtns">'+
    '<button type="button" class="btn btn--steel" data-history-delete-cancel>'+esc(t("history.edit.cancel"))+'</button>'+
    '<button type="button" class="btn btn--danger" data-history-delete-confirm="'+esc(s.session)+'">'+esc(t("history.session.delete"))+'</button></div></article>'}
function historyConflictView(s,mode,operation){
  const failure=mode==="failure",copy=failure?t("history.operation_failed"):t("history.operation_conflict");
  return`<article class="session history-operation" data-history-operation="${esc(mode)}" role="alert">`+
    `<h3 tabindex="-1">${esc(failure?t("history.failure_title"):t("history.conflict_title"))}</h3><p>${esc(copy)}</p>`+
    `<div class="edbtns"><button type="button" class="btn btn--steel" data-history-cancel>${esc(t("history.edit.cancel"))}</button>`+
    `<button type="button" class="btn btn--steel" data-history-reload>${esc(t("history.reload"))}</button>`+
    (operation==="edit"?`<button type="button" class="btn btn--cta" data-history-retry>${esc(t("history.retry"))}</button>`:"")+`</div></article>`}
function bindHistoryEditRows(){
  $$("[data-edrm]").forEach(b=>b.onclick=e=>{e.stopPropagation();
    const row=b.closest(".edrow"),card=b.closest(".session--edit");if(!row||!card)return;
    const index=Number(row.dataset.edidx),removed=new Set((historySelection.removedRowIndices||[]).map(Number));
    const removing=!row.classList.contains("is-removed");
    if(removing){
      const left=[...card.querySelectorAll(".edrow[data-edidx]:not(.is-removed)")];
      if(left.length<=1){toast(t("history.edit.keep_one"));return}
      removed.add(index);historySelection.removedRowIndices=[...removed].sort((a,c)=>a-c);
      row.classList.add("is-removed");setEdrowRmState(b,true);
      row.querySelectorAll(".edrow__in").forEach(inp=>{inp.disabled=true;inp.removeAttribute("aria-invalid")});
      historySelection.dirty=true}
    else{removed.delete(index);historySelection.removedRowIndices=[...removed].sort((a,c)=>a-c);
      row.classList.remove("is-removed");setEdrowRmState(b,false);
      row.querySelectorAll(".edrow__in").forEach(inp=>inp.disabled=false);historySelection.dirty=true}});
  $(".session--edit")?.addEventListener("input",historyApplyWorkingInput);
}
function historyCancelOperation(){
  const sid=historySelection.sessionId;
  if(historySelection.dirty&&!confirm(t("history.confirm.discard_changes")))return false;
  const next=historySelectionFor(historySelection.sessionId);
  historySetSelection(next||emptyHistorySelection());
  renderHistory();
  if(next)historyFocusRead(sid);else historyFocus($("#historyRecentLabel"));historyOutcome("cancel","success");
  return true}
function bindHistorySelection(){
  $("[data-history-back]")?.addEventListener("click",historyBackToCalendar);
  $("[data-history-edit]")?.addEventListener("click",historyStartEditing);
  $("[data-history-delete-cancel]")?.addEventListener("click",historyCancelOperation);
  $("[data-history-delete-confirm]")?.addEventListener("click",()=>deleteSession($("[data-history-delete-confirm]").dataset.historyDeleteConfirm,{originalFingerprint:historySelection.originalFingerprint,operationId:historySelection.operationId}));
  $$("[data-del]").forEach(b=>b.addEventListener("click",async e=>{
    e.stopPropagation();historyBeginDelete(b.dataset.del)}));
  $$("[data-edcancel]").forEach(b=>b.addEventListener("click",historyCancelOperation));
  $$("[data-edsave]").forEach(b=>b.addEventListener("click",()=>saveSessionEdit(b.dataset.edsave)));
  $$("[data-history-reload]").forEach(b=>b.onclick=()=>historyReloadLatest());
  $$("[data-history-cancel]").forEach(b=>b.addEventListener("click",historyCancelOperation));
  $$("[data-history-retry]").forEach(b=>b.addEventListener("click",historyRetryEdit));
  bindHistoryEditRows()}

function renderHistory(source=state.log){
  const selected=historySelection.mode!=="calendar";
  const selectionEl=$("#historySelection"),calendar=$("#historyCalendar"),recent=$("#historyRecentLabel"),tableDetails=$("#historyTable")?.closest("details");
  if(selected){
    const record=historySelectedRecord(source);
    if(!record){historySetSelection(emptyHistorySelection());return renderHistory(source)}
    calendar?.classList.add("hidden");recent?.classList.add("hidden");tableDetails?.classList.add("hidden");
    $("#historySearchWrap")?.classList.add("hidden");$("#historySearchBtn")?.classList.add("hidden");$("#historyExportBtn")?.classList.add("hidden");
    selectionEl?.classList.remove("hidden");
    const mode=historySelection.mode,copy=historySelection.workingCopy||record.rows;
    const longDate=formatLongDate(String(record.date||""));
    let body="";
    if(mode==="reading")body=historyReadingView(record,record.rows);
    else if(mode==="editing")body=sessionEditor(record,copy);
    else if(mode==="deleting")body=historyDeleteView(record);
    else body=historyConflictView(record,mode,historySelection.operation);
    selectionEl.innerHTML=`<div class="history-selection__head"><button type="button" class="back-link" data-history-back>‹ ${esc(t("history.back_calendar"))}</button>`+
      `<div class="history-selection__date"><span class="section-label">${esc(t("history.selected"))}</span><h3 data-history-selection-heading tabindex="-1">${esc(longDate)}</h3></div></div>`;
    $("#sessions").innerHTML=body;$("#historyTable").innerHTML="";
    bindHistorySelection();return}
  calendar?.classList.remove("hidden");recent?.classList.remove("hidden");tableDetails?.classList.remove("hidden");
  $("#historySearchBtn")?.classList.remove("hidden");$("#historyExportBtn")?.classList.remove("hidden");selectionEl?.classList.add("hidden");selectionEl&&(selectionEl.innerHTML="");
  if(!histMonth){const n=new Date();histMonth={y:n.getFullYear(),m:n.getMonth()}}
  const focusedToggle=document.activeElement?.matches?.("#sessions .session__open")?document.activeElement:null;
  const focusedSession=focusedToggle?.closest("[data-sess]")?.dataset.sess||null;
  const index=historyIndexFor(source);
  renderHistoryCalendar(index);
  const q=histQuery.trim();
  const sessions=searchHistoryIndex(index,q);
  syncHistorySearchChrome();
  let lastMonth="";
  $("#sessions").innerHTML=sessions.length?sessions.map(s=>{
    const sets=s.rows;
    const work=sets.filter(isWork),vol=sum(work.map(x=>(+x.load||0)*(+x.reps||0)));
    const delta=s.delta||{improved:0,flat:0,regressed:0,new:0},deltaLine=hasDeltaSummary(delta)?`<div class="session__delta">${esc(formatDeltaCounts(delta))}</div>`:"";
    const mus=[...new Set(work.map(r=>String(r.primary||"").split(",")[0].trim()).filter(Boolean))].slice(0,3);
    const d=new Date(`${s.date}T12:00:00`);
    const monthKey=`${d.getFullYear()}-${d.getMonth()}`;
    let monthHdr="";
    if(monthKey!==lastMonth){lastMonth=monthKey;monthHdr=`<p class="section-label">${esc(t("month."+d.getMonth()).toUpperCase())}</p>`}
    const eyebrow=esc(t("history.session_eyebrow",{weekday:t("weekday."+d.getDay()),day:d.getDate(),month:t("month_short."+d.getMonth())}));
    // The card is the way in. It used to be a disclosure whose panel held one
    // link to the session — a tap to reveal a tap — and the panel was drawn on
    // every row regardless, because `display:flex` outranks the `hidden` it
    // carried. Deleting a session already moved inside the session, so nothing
    // is left for a row to reveal and the whole card opens it.
    return monthHdr+`<article class="hist-row session" data-sess="${esc(s.session)}">`+
      `<button type="button" class="session__open" data-edit="${esc(s.session)}" aria-label="${esc(t("history.session_open_aria",{day:dayLabel(s.day)}))}">`+
      `<div class="session__info"><div class="hist-eyebrow">${eyebrow}</div><div class="session__day hist-row__title">${esc(dayLabel(s.day))}</div>`+
      (mus.length?`<div class="session__sub">${esc(mus.map(muscleLabel).join(" · "))}</div>`:"")+
      `<div class="session__sub">${esc(t("history.session_meta",{sets:sets.length,vol:kfmt(toDisplay(vol)),unit:unitLabel()}))}</div>${deltaLine}`+
      `</div><span class="chevron" aria-hidden="true"></span></button></article>`;
  }).join(""):`<div class="table"><div class="empty" data-hist-empty="${q?"nomatch":"none"}">${esc(t(q?"history.empty.no_match":"history.empty.sessions"))}</div></div>`;
  if(focusedSession){
    const next=$$("#sessions .session__open").find(btn=>btn.closest("[data-sess]")?.dataset.sess===focusedSession);
    if(next&&canTakeFocus(next)){try{next.focus({preventScroll:true})}catch{try{next.focus()}catch{}}}}
  $$("#sessions [data-edit]").forEach(b=>b.onclick=e=>{e.stopPropagation();historyStartReading(b.dataset.edit)});
  const rows=index.tableRows.map(x=>({[t("stats.table.date")]:x.date,[t("stats.table.day")]:dayLabel(x.day),[t("stats.table.exercise")]:displayName(x),[t("stats.table.set")]:x.warmup?"W"+x.set:x.set,[unitLabel()]:fmtLoad(x.load),[t("stats.table.reps")]:x.reps,[t("stats.table.rir")]:fmt(x.rir)}));
  $("#historyTable").innerHTML=table(rows);
}
function renderHistoryCalendar(index){const el=$("#historyCalendar");if(!el)return;
  const {y,m}=histMonth,first=new Date(y,m,1),startDow=(first.getDay()+6)%7;
  const daysInMonth=new Date(y,m+1,0).getDate(),prevDays=new Date(y,m,0).getDate();
  const ym=`${y}-${String(m+1).padStart(2,"0")}`;
  const month=index?.months?.get(ym)||{sessions:new Set(),sets:0,byDay:new Map()};
  const byDay=month.byDay;
  const sessCount=month.sessions.size,setCount=month.sets;
  const letters=weekdayLetters();
  // Monday-start letters already match weekdayLetters
  let cells=letters.map(l=>`<div class="cal-grid__dow">${esc(l)}</div>`).join("");
  for(let i=0;i<42;i++){let dayNum,out=false,iso;
    if(i<startDow){dayNum=prevDays-startDow+i+1;out=true;const pm=m===0?11:m-1,py=m===0?y-1:y;iso=`${py}-${String(pm+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`}
    else if(i-startDow>=daysInMonth){dayNum=i-startDow-daysInMonth+1;out=true;const nm=m===11?0:m+1,ny=m===11?y+1:y;iso=`${ny}-${String(nm+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`}
    else{dayNum=i-startDow+1;iso=`${y}-${String(m+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`}
    const info=!out&&byDay.get(dayNum),isToday=iso===today();
    let mark="";if(info?.pr)mark=`<span class="cal-grid__mark is-pr"></span>`;else if(info)mark=`<span class="cal-grid__mark is-check">✓</span>`;else if(isToday)mark=`<span class="cal-grid__mark is-today"></span>`;
    cells+=`<div class="cal-grid__day${out?" is-out":""}">${dayNum}${mark}</div>`;
    if(i===41)break;if(i>=startDow+daysInMonth-1&&(i+1)%7===0)break}
  el.innerHTML=`<div class="cal-head"><button type="button" class="icon-btn icon-btn--ghost" id="calPrev" aria-label="${esc(t("history.calendar_prev_aria"))}">‹</button>`+
    `<div class="cal-head__title">${esc(t("history.month_title",{month:(()=>{const s=t("month."+m);return s?s.charAt(0).toUpperCase()+s.slice(1):s})(),year:y}))}</div>`+
    `<button type="button" class="icon-btn icon-btn--ghost" id="calNext" aria-label="${esc(t("history.calendar_next_aria"))}">›</button></div>`+
    `<div class="cal-summary">${esc(t("history.month_summary",{sessions:sessCount,sets:setCount}))}</div>`+
    `<div class="cal-grid">${cells}</div>`;
  $("#calPrev").onclick=()=>{if(histMonth.m===0){histMonth={y:histMonth.y-1,m:11}}else histMonth={y:histMonth.y,m:histMonth.m-1};renderHistory()};
  $("#calNext").onclick=()=>{if(histMonth.m===11){histMonth={y:histMonth.y+1,m:0}}else histMonth={y:histMonth.y,m:histMonth.m+1};renderHistory()}}


const EDROW_RM_GLYPH={remove:"×",undo:"↺"};
// The per-row remove control is icon-only, so its state lives in the glyph plus
// the accessible name rather than visible copy.
function setEdrowRmState(btn,removed){
  const label=t(removed?"history.edit.undo_remove":"history.edit.remove_set");
  btn.setAttribute("aria-label",label);btn.title=label;btn.classList.toggle("is-undo",removed);
  const glyph=btn.querySelector(".edrow__rm-glyph")||btn;
  glyph.textContent=removed?EDROW_RM_GLYPH.undo:EDROW_RM_GLYPH.remove}

function sessionEditor(s,sets){
  const removed=new Set((historySelection.removedRowIndices||[]).map(Number));
  const rows=sets.map((r,i)=>{
    const isRemoved=removed.has(i),disabled=isRemoved?" disabled":"",label=t(isRemoved?"history.edit.undo_remove":"history.edit.remove_set");
    return `<div class="edrow${isRemoved?" is-removed":""}" data-edidx="${i}"><span class="edrow__name">${esc(displayName(r))} <small>#${r.set}</small></span>`+
      `<input class="edrow__in" data-ek="load|${i}" type="text" inputmode="decimal" enterkeyhint="next" value="${esc(fmtLoadPlain(r.load))}" aria-label="${esc(displayName(r))} ${esc(t("log.set").toLowerCase())} ${r.set} ${unitLabel()}"${disabled}>`+
      `<input class="edrow__in" data-ek="reps|${i}" type="text" inputmode="numeric" enterkeyhint="next" value="${esc(r.reps)}" aria-label="${esc(displayName(r))} ${esc(t("log.set").toLowerCase())} ${r.set} ${esc(t("log.reps"))}"${disabled}>`+
      `<input class="edrow__in" data-ek="rir|${i}" type="text" inputmode="decimal" enterkeyhint="done" value="${esc(fmt(r.rir))}" aria-label="${esc(displayName(r))} ${esc(t("log.set").toLowerCase())} ${r.set} ${esc(t("glossary.term.RIR"))}"${disabled}>`+
      `<button type="button" class="edrow__rm${isRemoved?" is-undo":""}" data-edrm="${i}" aria-label="${esc(label)}" title="${esc(label)}"><span class="edrow__rm-glyph" aria-hidden="true">${isRemoved?EDROW_RM_GLYPH.undo:EDROW_RM_GLYPH.remove}</span></button></div>`}).join("");
  return `<div class="session session--edit" data-editing="${esc(s.session)}" data-history-state="editing">`+
    `<h4 class="history-editing__heading" data-history-editing-heading tabindex="-1">${esc(t("history.editing_title"))}</h4>`+
    `<p class="history-editing__status" data-history-editing-status role="status" aria-live="polite">${esc(t("history.editing_status"))}</p>`+
    `<div class="edhead"><div class="session__day">${esc(dayLabel(s.day))}</div>`+
    `<label class="edate">${esc(t("stats.table.date"))}<input data-ed="date" type="date" value="${esc(sets[0]?.date||s.date)}"></label></div>`+
    `<div class="edrow edrow--head"><span>${esc(t("log.set"))}</span><span>${unitLabel()}</span><span>${esc(t("log.reps"))}</span><span>${esc(t("glossary.term.RIR"))}</span><span></span></div>`+rows+
    `<div class="edbtns"><button type="button" class="btn btn--steel" data-edcancel="1">${esc(t("history.edit.cancel"))}</button>`+
    `<button type="button" class="btn btn--cta" data-edsave="${esc(s.session)}">${esc(t("history.edit.save"))}</button></div>`+
    `<div class="edrisk"><button type="button" class="session__del" data-del="${esc(s.session)}">${esc(t("history.session.delete"))}</button></div></div>`;
}

// The editor is a volatile projection. Its commit path validates the exact
// session fingerprint again while holding the durable-state lock, so an edit
// can never merge over a changed or deleted session.
async function saveSessionEdit(sid){
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
    const result={ok:false,committed:false,settled:true,failed:true,code:"history_missing_fingerprint",revision:readRevision(state),localOk:false,idbOk:false};
    await historyFinishResult(result,"toast.session_updated","edit",operationId);
    return result}
  const result=await historyEditCommit(sid,proposed,original);
  await historyFinishResult(result,"toast.session_updated","edit",operationId);
  return result}

    return {
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
      setQuery(value){histQuery=String(value??"");renderHistory()},
      query:()=>histQuery,
    };
  }
  root.RepForgeHistoryUi={create:createHistoryUi};
})(typeof globalThis!=="undefined"?globalThis:this);
