import {escapeHtml as esc} from "../format.js";
/** Owns only Review's volatile diagnosis/preview flow. Models are readonly;
 * named application commands own proposals, staging and durable confirmation.
 */
/** @param {import("./contracts.js").ReviewOptions} options */
export function createReviewController({document,copy,queries,commands,onChange,onNotice}){
const {t}=copy;
/** @param {string} selector @param {ParentNode} [root] */
const $=(selector,root=document)=>/** @type {HTMLElement|null} */(root.querySelector(selector));
/** @param {string} selector @param {ParentNode} [root] */
const $$=(selector,root=document)=>/** @type {HTMLElement[]} */([...root.querySelectorAll(selector)]);
let disposed=false;
const requestRender=()=>{if(!disposed)onChange()};
/** @type {Readonly<import("./contracts.js").ReviewPreview>|null} */
let previewModel=null;
/** @type {Readonly<Record<string,string>>} */
const EVIDENCE_OUTCOME_KEYS={improved:"stats.outcome.improved",maintained:"stats.outcome.maintained",declined:"stats.outcome.declined"};
/** @type {Readonly<Record<string,string>>} */
const REVIEW_ACTION_LABELS={repeat:"review.action.repeat","schedule-repair":"review.action.schedule_repair",
  "reduce-volume":"review.action.reduce_volume","recovery-week":"review.action.recovery_week","guided-edit":"review.action.guided_edit"};
/** @param {Extract<import("./contracts.js").ReviewModel,{started:true}>["checkpoint"]} checkpoint */
function renderReviewActions(checkpoint){
  const kinds=checkpoint.structuralActions.filter(k=>REVIEW_ACTION_LABELS[k]);
  if(!kinds.length)return "";
  return `<p class="section-label">${esc(t("review.actions.label"))}</p><div class="review__actions">`+
    kinds.map(k=>`<button type="button" class="btn btn--steel" data-review-action="${k}">${esc(t(REVIEW_ACTION_LABELS[k]))}</button>`).join("")+`</div>`}
function bindReviewActions(){
  /** @type {NodeListOf<HTMLElement>} */(document.querySelectorAll("[data-review-action]")).forEach(button=>button.onclick=()=>{if(disposed)return;
    const kind=button.dataset.reviewAction;
    if(kind==="repeat")commands.repeat();
    else if(kind==="schedule-repair")startScheduleRepair();
    else if(kind==="reduce-volume")startVolumeReduction();
    else if(kind==="recovery-week")startRecoveryWeek();
    else if(kind==="guided-edit")startGuidedEdit();
  });
}
/** @type {import("./contracts.js").ReviewFlow|null} */
let reviewFlow=null;
function startScheduleRepair(){if(disposed)return;reviewFlow={stage:"diagnosis",action:"schedule-repair",kind:"fewer_days",target:""};requestRender()}
function startGuidedEdit(){if(disposed)return;reviewFlow={stage:"diagnosis",action:"guided-edit",kind:"fewer_days",target:""};requestRender()}
function startVolumeReduction(){if(disposed)return;reviewFlow={stage:"volume-question",action:"reduce-volume"};requestRender()}
function startRecoveryWeek(){if(disposed)return;reviewFlow={stage:"recovery-question",action:"recovery-week",answer:null};requestRender()}
async function closeReviewFlow(){if(disposed)return;
  const flow=reviewFlow;
  if(reviewFlow?.stage==="staged"){
    const cleared=await commands.discardStaging();
    if(disposed||reviewFlow!==flow)return;
    if(!cleared?.ok){reviewFlow={stage:"error",code:cleared?.conflict?"save_conflict":"save_failed"};requestRender();return}}
  reviewFlow=null;requestRender()}
/** @param {HTMLElement} el */
function renderReviewFlow(el){
  const flow=/** @type {import("./contracts.js").ReviewFlow} */(reviewFlow);
  if(flow.stage==="preview")return renderSiblingPreview(el,flow);
  if(flow.stage==="volume-question"){
    el.innerHTML=`<p class="section-label">${esc(t("review.volume.title"))}</p><p>${esc(t("review.volume.question"))}</p>`+
      `<p class="lede">${esc(t("review.volume.body"))}</p><div class="btnrow">`+
      `<button type="button" class="btn btn--cta" data-volume-confirm>${esc(t("review.volume.continue"))}</button>`+
      `<button type="button" class="btn btn--steel" data-flow-cancel>${esc(t("review.diagnosis.cancel"))}</button></div>`;
    const confirm=$("[data-volume-confirm]",el);if(confirm)confirm.onclick=proposeVolumeReductionFlow;
    bindFlowCancel(el);return}
  if(flow.stage==="recovery-question"){
    el.innerHTML=`<p class="section-label">${esc(t("review.recovery.title"))}</p>`+
      `<p>${esc(t("review.recovery.question"))}</p>`+
      `<div class="review__actions" role="group" aria-label="${esc(t("review.recovery.question"))}">`+
      ["Yes","No","Not sure"].map(answer=>`<button type="button" class="btn btn--steel" data-recovery-answer="${esc(answer)}">${esc(t(`review.recovery.answer.${answer}`))}</button>`).join("")+`</div>`+
      (flow.message?`<p class="review__readonly" role="status">${esc(t(flow.message))}</p>`:"")+
      `<div class="btnrow"><button type="button" class="btn btn--steel" data-flow-cancel>${esc(t("review.diagnosis.cancel"))}</button></div>`;
    $$('[data-recovery-answer]',el).forEach(button=>button.onclick=()=>answerRecoveryQuestion(button.dataset.recoveryAnswer||""));
    bindFlowCancel(el);return}
  if(flow.stage==="staged"){
    el.innerHTML=`<p class="review__staged" role="status">${esc(t("review.staged.done"))}</p>`+
      `<div class="btnrow"><button type="button" class="btn btn--cta" data-flow-editor>${esc(t("review.staged.open"))}</button>`+
      `<button type="button" class="btn btn--steel" data-flow-cancel>${esc(t("review.diagnosis.cancel"))}</button></div>`;
    const open=$("[data-flow-editor]",el);if(open)open.onclick=()=>{if(disposed)return;
      reviewFlow=null;commands.openStagedEditor()};
    bindFlowCancel(el);return}
  if(flow.stage==="error"){
    const stale=flow.stale===true||String(flow.code||"").includes("stale")||String(flow.code||"").includes("mismatch");
    el.innerHTML=`<p class="review__error" role="alert">${esc(t(stale?"review.error.stale":"review.error.failed"))}</p>`+
      `<div class="btnrow"><button type="button" class="btn btn--steel" data-flow-restart>${esc(t("review.error.retry"))}</button>`+
      `<button type="button" class="btn btn--steel" data-flow-cancel>${esc(t("review.diagnosis.cancel"))}</button></div>`;
    const restart=$("[data-flow-restart]",el);if(restart)restart.onclick=flow.action==="reduce-volume"
      ?startVolumeReduction:flow.action==="recovery-week"?startRecoveryWeek:startScheduleRepair;
    bindFlowCancel(el);return}
  if(flow.stage==="done"){
    el.innerHTML=`<p class="review__staged" role="status">${esc(t(flow.doneKey||"review.done.committed"))}</p>`+
      `<div class="btnrow"><button type="button" class="btn btn--steel" data-flow-cancel>${esc(t("review.diagnosis.close"))}</button></div>`;
    bindFlowCancel(el);return}
  // diagnosis
  const isDays=flow.kind!=="sessions_too_long";
  const targetLabel=isDays?t("review.diagnosis.days_question"):t("review.diagnosis.minutes_question");
  el.innerHTML=`<p class="section-label">${esc(t("review.diagnosis.title"))}</p>`+
    `<div class="review__diag">`+
    `<button type="button" class="radio-card${flow.kind==="fewer_days"?" is-selected":""}" data-diag="fewer_days"><span class="radio-card__body"><span class="radio-card__title">${esc(t("review.diagnosis.fewer_days"))}</span></span><span class="radio-card__mark"></span></button>`+
    `<button type="button" class="radio-card${flow.kind==="sessions_too_long"?" is-selected":""}" data-diag="sessions_too_long"><span class="radio-card__body"><span class="radio-card__title">${esc(t("review.diagnosis.sessions_too_long"))}</span></span><span class="radio-card__mark"></span></button>`+
    `</div><label class="field"><span>${esc(targetLabel)}</span>`+
    `<input type="number" inputmode="numeric" min="${isDays?1:15}" max="${isDays?7:240}" step="1" value="${esc(flow.target)}" data-diag-target></label>`+
    (flow.error?`<p class="review__error" role="alert">${esc(t(flow.error))}</p>`:"")+
    `<div class="btnrow"><button type="button" class="btn btn--cta" data-diag-continue>${esc(t(flow.action==="guided-edit"?"review.diagnosis.edit":"review.diagnosis.continue"))}</button>`+
    `<button type="button" class="btn btn--steel" data-flow-cancel>${esc(t("review.diagnosis.cancel"))}</button></div>`;
  $$("[data-diag]",el).forEach(b=>b.onclick=()=>{if(disposed)return;flow.kind=/** @type {"fewer_days"|"sessions_too_long"} */(b.dataset.diag);flow.error=null;requestRender()});
  const input=/** @type {HTMLInputElement|null} */($("[data-diag-target]",el));
  if(input)input.oninput=()=>{if(disposed)return;flow.target=input.value;flow.error=null};
  const cont=$("[data-diag-continue]",el);if(cont)cont.onclick=continueScheduleDiagnosis;
  bindFlowCancel(el)}
/** @param {HTMLElement} el */
function bindFlowCancel(el){const c=$("[data-flow-cancel]",el);if(c)c.onclick=()=>void closeReviewFlow()}
async function continueScheduleDiagnosis(){if(disposed)return;
  const flow=reviewFlow;if(!flow||flow.stage!=="diagnosis")return;
  const n=Number(flow.target);
  const valid=flow.kind==="fewer_days"?Number.isInteger(n)&&n>=1&&n<=7:Number.isInteger(n)&&n>=15&&n<=240;
  if(!valid){flow.error=flow.kind==="fewer_days"?"review.diagnosis.days_invalid":"review.diagnosis.minutes_invalid";requestRender();return}
  const answers=flow.kind==="fewer_days"?{availableDays:n}:{sessionMinutes:n};
  const diagnosis={kind:flow.kind,answers};
  if(flow.action==="guided-edit")return stageGuidedRepairFlow(diagnosis);
  /** @type {import("../../app/review-contracts.js").Change} */
  const change=flow.kind==="fewer_days"?{kind:"fewer_days",daysPerWeek:n}:{kind:"shorter_sessions",sessionMinutes:n};
  const res=await commands.propose(change);
  if(disposed||reviewFlow!==flow)return;
  // A change the generator cannot make (a Build program, or a request with
  // no eligible fit) becomes guided editing of the live program.
  if(res?.ok){reviewFlow={stage:"preview",action:"schedule-repair",proposal:res.proposal,carry:res.carry||null};requestRender()}
  else await stageGuidedRepairFlow(diagnosis)}
/** @param {import("../../app/review-contracts.js").Diagnosis} diagnosis */
async function stageGuidedRepairFlow(diagnosis){if(disposed)return;
  const flow=reviewFlow;
  const staged=await commands.stage(diagnosis);
  if(disposed||reviewFlow!==flow)return;
  if(staged?.ok){reviewFlow={stage:"staged"};requestRender()}
  else{reviewFlow={stage:"error",action:"guided-edit",code:staged?.code||"guided_staging_failed"};requestRender()}}
async function proposeVolumeReductionFlow(){if(disposed)return;
  const flow=reviewFlow;
  const result=await commands.propose({kind:"reduce_volume"});
  if(disposed||reviewFlow!==flow)return;
  reviewFlow=result?.ok?{stage:"preview",action:"reduce-volume",proposal:result.proposal}
    :{stage:"error",action:"reduce-volume",code:result?.code||"volume_reduction_unavailable"};
  requestRender()}
/* A recovery week is the lifter's call: a Yes schedules it, nothing infers it. */
/** @param {string} answer */
async function answerRecoveryQuestion(answer){if(disposed)return;
  const flow=reviewFlow;
  if(answer!=="Yes"){
    reviewFlow={stage:"recovery-question",action:"recovery-week",answer,
      message:answer==="No"?"review.recovery.answer_no":"review.recovery.answer_unsure"};requestRender();return}
  const result=await commands.propose({kind:"recovery_week"});
  if(disposed||reviewFlow!==flow)return;
  reviewFlow=result?.ok?{stage:"preview",action:"recovery-week",proposal:result.proposal}
    :{stage:"error",action:"recovery-week",code:result?.code||"recovery_unavailable"};
  requestRender()}
/** @param {{exerciseId?:string,displayName?:string}|undefined} slot */
function definitionMovementLabel(slot){
  return slot?.displayName||previewModel?.movementLabels[String(slot?.exerciseId)]||slot?.exerciseId||"—"}
/* What the lifter sees before confirming: the first cycle of each program,
   compared slot by slot, then movement by movement. */
/** @param {import("./contracts.js").ProgramDefinition|undefined} before @param {import("./contracts.js").ProgramDefinition|undefined} after */
function definitionPreviewLines(before,after){
  /** @param {import("./contracts.js").ProgramDefinition|undefined} definition */
  const training=definition=>(definition?.days||[]).filter(day=>day.kind==="training");
  /** @param {import("./contracts.js").ProgramSlot} slot */
  const setsOf=slot=>slot.prescriptionsByCycle?.[0]?.sets.length??0;
  const lines=[],beforeDays=training(before),afterDays=training(after);
  /** @param {import("./contracts.js").ProgramDefinition["days"][number]} day @param {import("./contracts.js").ProgramDefinition|undefined} definition */
  const shown=(day,definition)=>`${((definition===before?previewModel?.beforeDayLabels:previewModel?.afterDayLabels)||{})[day.name]||day.name} · ${day.slots.length}`;
  for(let index=0;index<Math.max(beforeDays.length,afterDays.length);index++){
    const was=beforeDays[index],now=afterDays[index];
    if(was&&now&&was.name===now.name&&was.slots.length===now.slots.length)continue;
    lines.push(t("review.preview.day_change",{before:was?shown(was,before):"—",after:now?shown(now,after):"—"}))}
  /** @param {import("./contracts.js").ProgramDefinition|undefined} definition */
  const slots=definition=>training(definition).flatMap(day=>day.slots);
  const remaining=slots(after).slice();
  for(const slot of slots(before)){
    const index=remaining.findIndex(candidate=>candidate.id===slot.id||candidate.exerciseId===slot.exerciseId);
    if(index<0){lines.push(t("review.preview.exercise_removed",{movement:definitionMovementLabel(slot),sets:setsOf(slot)}));continue}
    const [match]=remaining.splice(index,1);
    if(setsOf(match)!==setsOf(slot))lines.push(t("review.preview.sets_change",{movement:definitionMovementLabel(slot),before:setsOf(slot),after:setsOf(match)}))}
  for(const slot of remaining)lines.push(t("review.preview.exercise_added",{movement:definitionMovementLabel(slot),sets:setsOf(slot)}));
  return lines}
/* What a regeneration did with the lifter's block edits, movement by movement
   and week by week, read from the successor the proposal commits. */
/** @param {import("./contracts.js").CarryReport|null|undefined} carry @param {import("./contracts.js").ProgramDefinition|undefined} before @param {import("./contracts.js").ProgramDefinition|undefined} after */
function carryPreviewLines(carry,before,after){
  if(!carry)return[];
  if(!carry.identified)return[t("review.preview.carry.unidentified")];
  /** @param {import("./contracts.js").ProgramDefinition|undefined} definition */
  const slots=definition=>new Map((definition?.days||[]).flatMap(day=>day.slots).map(slot=>[slot.id,slot]));
  const was=slots(before),now=slots(after);
  return carry.entries.map(entry=>{
    const movement=definitionMovementLabel(was.get(entry.predecessorSlotId)||{exerciseId:entry.exerciseId});
    const carried=entry.outcome!=="dropped";
    /** @type {{first:number,last:number,changes:string}[]} */
    const weeks=[];
    for(const cycle of entry.cycles){
      const changes=cycle.fields.map(field=>{
        if(field==="targets")return t("review.preview.carry.targets");
        if(field==="rir")return t("review.preview.carry.rir");
        if(field==="restSeconds")return t("review.preview.carry.rest");
        const sets=carried?cycleSets(now.get(String(entry.successorSlotId)),cycle.cycleIndex):cycle.requestedSets;
        return sets<cycle.requestedSets?t("review.preview.carry.sets_clamped",{sets,requested:cycle.requestedSets})
          :t("review.preview.carry.sets",{sets})}).join(", ");
      const last=weeks.at(-1);
      if(last&&last.changes===changes&&last.last+1===cycle.cycleIndex)last.last=cycle.cycleIndex;
      else weeks.push({first:cycle.cycleIndex,last:cycle.cycleIndex,changes})}
    const details=weeks.map(({first,last,changes})=>first===last?t("review.preview.carry.week",{week:first,changes})
      :t("review.preview.carry.weeks",{first,last,changes})).join("; ");
    if(entry.outcome==="kept")return t("review.preview.carry.kept",{movement,details});
    if(entry.outcome==="clamped")return t("review.preview.carry.clamped",{movement,details});
    return entry.reason==="slot_removed"?t("review.preview.carry.removed",{movement,details})
      :t("review.preview.carry.over_limit",{movement,details})})}
/** @param {import("./contracts.js").ProgramSlot|null|undefined} slot @param {number} cycleIndex */
function cycleSets(slot,cycleIndex){
  return slot?.prescriptionsByCycle?.find(cycle=>cycle.cycleIndex===cycleIndex)?.sets.length??0}
/** @param {HTMLElement} el @param {import("./contracts.js").PreviewFlow} flow */
function renderSiblingPreview(el,flow){
  const p=flow.proposal,change=/** @type {Partial<import("../../app/review-contracts.js").Change>} */(p.change||{});
  previewModel=queries.preview(flow);
  const {before,after}=previewModel;
  /** @param {import("./contracts.js").ProgramDefinition|undefined} definition */
  const trainingDays=definition=>(definition?.days||[]).filter(day=>day.kind==="training").length;
  const recovery=change.kind==="recovery_week";
  const lines=recovery?[]:definitionPreviewLines(before,after);
  const carryLines=carryPreviewLines(flow.carry,before,after);
  const summary=recovery
    ?`<p>${esc(t("review.recovery.preview_body"))}</p><p><b>${esc(t("review.recovery.preview_weeks",{before:before?.cycles,after:after?.cycles}))}</b></p>`
    :(change.kind==="fewer_days"?`<p><b>${esc(t("review.preview.frequency",{before:trainingDays(before),after:trainingDays(after)}))}</b></p>`:"")+
      (change.kind==="shorter_sessions"?`<p><b>${esc(t("review.preview.duration",{before:/** @type {{timeCeilingMinutes?:unknown}|undefined} */(before?.request)?.timeCeilingMinutes,after:/** @type {{timeCeilingMinutes?:unknown}|undefined} */(after?.request)?.timeCeilingMinutes}))}</b></p>`:"")+
      (change.kind==="fewer_days"||change.kind==="shorter_sessions"?`<p class="lede">${esc(t("review.preview.provenance"))}</p>`:"")+
      (carryLines.length?`<ul class="review__diff">${carryLines.map(line=>`<li>${esc(line)}</li>`).join("")}</ul>`:"")+
      (lines.length?`<ul class="review__diff">${lines.map(line=>`<li>${esc(line)}</li>`).join("")}</ul>`:`<p class="lede">${esc(t("review.preview.exercises_unchanged"))}</p>`);
  el.innerHTML=`<p class="section-label">${esc(t(recovery?"review.recovery.preview_title":"review.preview.title"))}</p>`+summary+
    `<p class="lede"><code class="review__hash">${esc(String(p.proposalHash||""))}</code></p>`+
    `<p class="lede">${esc(t("review.preview.hash_note"))}</p>`+
    `<div class="btnrow review__preview-actions"><button type="button" class="btn btn--cta" data-preview-confirm>${esc(t(recovery?"review.recovery.confirm":"review.preview.confirm"))}</button>`+
    `<button type="button" class="btn btn--steel" data-flow-cancel>${esc(t("review.preview.cancel"))}</button></div>`;
  const confirm=$("[data-preview-confirm]",el);
  if(confirm)confirm.onclick=async()=>{
    if(disposed)return;
    /** @type {HTMLButtonElement} */(confirm).disabled=true;
    const persisted=await commands.confirm(flow);
    if(disposed||reviewFlow!==flow)return;
    if(persisted?.committed){
      const doneKey=persisted.doneKey;
      reviewFlow={stage:"done",doneKey};onNotice(t(/** @type {string} */(doneKey)));requestRender();
    }else{
      reviewFlow={stage:"error",action:flow.action,code:persisted?.code,stale:persisted?.duplicate===true||!!persisted?.stale||!!persisted?.staleRevision};
      requestRender();
    }}
  bindFlowCancel(el)}
/** @param {Readonly<import("./contracts.js").ReviewModel>} model */
function render(model){
  if(disposed)return;
  const host=$("#reviewPanel");if(!host)return;
  if(!model.started){host.innerHTML=`<p class="lede">${esc(t("review.no_start"))}</p>`;return}
  if(reviewFlow){renderReviewFlow(host);return}
  const {checkpoint,life,volume}=model;
  const weekLine=life.isComplete?t("meso.complete"):life.isFinalWeek&&life.current!=null?t("meso.week_ready",{n:life.current,total:life.total}):t("review.week_of",{n:life.current??"—",total:life.total});
  const outcomeLine=model.outcomes.length?model.outcomes.map(outcome=>`${esc(outcome.name)} · ${esc(t(EVIDENCE_OUTCOME_KEYS[outcome.outcome]||""))}`).join("<br>"):
    `<span class="visually-hidden">${esc(t("review.outcomes.none_aria"))}</span>${esc(t("review.outcomes.none"))}`;
  const actions=checkpoint.lifecycle==="block-complete"?renderReviewActions(checkpoint):"";
  const readOnly=checkpoint.lifecycle==="active-block"?`<p class="review__readonly" role="note">${esc(t("review.active_readonly"))}</p>`:"";
  const evidence=checkpoint.lifecycle==="block-complete"&&!checkpoint.hasSufficientEvidence?`<p class="review__summary">${esc(t("review.insufficient.note"))}</p>`:"";
  const percentage=volume.plannedWorkingSets?Math.min(100,Math.round(volume.completedWorkingSets/volume.plannedWorkingSets*100)):0;
  host.innerHTML=`<div class="blockprogress" data-progress-dimension="block" data-progress-scope="block-review-evidence"><h4 class="blockprogress__title">${esc(t("review.progress_title"))}</h4>`+
    `<p><b>${esc(weekLine)}</b></p><p><b>${esc(t("review.sessions"))}</b> ${esc(t("review.sessions_completed",{done:volume.completedSessions,planned:volume.period.plannedSessions||volume.plannedSessions}))}</p>`+
    `<p><b>${esc(t("review.volume"))}</b> ${esc(t("review.volume_planned",{pct:percentage}))}</p>`+
    `<p class="lede">${esc(t("stats.volume.period_text",{start:model.periodStart,end:model.periodEnd}))}</p></div>`+
    `<p class="section-label">${esc(t("review.outcomes.label"))}</p><div class="review__outcomes">${outcomeLine}</div>`+evidence+readOnly+actions;
  bindReviewActions();
}
return Object.freeze({render,startScheduleRepair,startGuidedEdit,startVolumeReduction,startRecoveryWeek,
  close:closeReviewFlow,flow:()=>reviewFlow,dispose(){disposed=true;reviewFlow=null;previewModel=null;
  $$("#reviewPanel button").forEach(button=>button.onclick=null);
  const input=$("#reviewPanel [data-diag-target]");if(input)input.oninput=null}});
}
