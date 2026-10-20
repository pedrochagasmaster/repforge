import {escapeHtml as esc} from '../format.js';

/** @typedef {import('../../training/workout-contracts.js').Draft} Draft
 * @typedef {{status:string}} CommandResult
 * @typedef {{draft:Draft|null,today:string,bodyweight:string,unit:string,exerciseNames:Readonly<Record<string,string>>,earlyRows:readonly {exerciseId?:unknown,set?:unknown}[]|null}} SheetModel
 * @typedef {{initialFocus?:HTMLElement|null,onEscape?:()=>unknown,scrim?:HTMLElement|null,delayHide?:number}} ModalOptions
 * @typedef {{openModal:(element:HTMLElement,options:ModalOptions)=>unknown,closeModal:(element:HTMLElement)=>Promise<unknown>,readonly activeModal:{el:HTMLElement}|null}} ModalOwner
 * @typedef {{flush:()=>Promise<void>,date:(value:string)=>Promise<unknown>,bodyweight:(value:string)=>Promise<unknown>,notes:(value:string)=>Promise<unknown>,reorder:(order:string[])=>Promise<CommandResult>,jump:(id:string)=>unknown,finishEarly:(expected:{draftId:string,revision:number})=>Promise<unknown>,abandon:(reason:string|null)=>Promise<unknown>}} Commands
 */
/** Session sheet owns DOM listeners, reorder focus, the early-confirm token and
 * abandon choices. Readonly facts come from the acknowledged workout owner;
 * each user action has a named application command. Construction performs no IO.
 * @param {{window:Window & typeof globalThis,shell:ModalOwner,read:()=>SheetModel,commands:Commands,copy:{t:(key:string,values?:Record<string,unknown>)=>string},motion:{reducedMotion:()=>boolean},announce:(message:string,options:{placement:string})=>void,toast:(message:string)=>void}} options */
export function createSessionSheet({window,shell,read,commands,copy,motion,announce,toast}) {
  const document=window.document,t=copy.t;
  const $=(/** @type {string} */ selector)=>/** @type {HTMLElement|null} */(document.querySelector(selector));
  const input=(/** @type {string} */ selector)=>/** @type {HTMLInputElement|HTMLTextAreaElement|null} */(document.querySelector(selector));
  const $$=(/** @type {string} */ selector)=>Array.from(document.querySelectorAll(/** @type {string} */(selector))).map(element=>/** @type {HTMLElement} */(element));
  /** @type {{draftId:string,revision:number}|null} */ let early=null;
  /** @type {AbortController|null} */ let abort=null;
  let mounted=false,openingFrame=0;
  function focus(/** @type {string} */ selector){$(selector)?.focus({preventScroll:true});}
function render(){
  const sheet = $("#sessionSheet");
  if (!sheet) return;
  const model = read();
  const draft = model.draft;
  const dateInput = input("#sessionDate");
  if (dateInput) dateInput.value = draft?.program?.scheduleDate ?? model.today;
  const bwInput = input("#sessionBodyweight");
  if (bwInput) {
    bwInput.value = model.bodyweight;
    bwInput.placeholder = model.unit;
  }
  const notesInput = input("#sessionNotes");
  if (notesInput) notesInput.value = draft?.session?.notes || "";

  // Render Session map
  const mapEl = $("#sessionMap");
  if (mapEl && draft) {
    const order = draft.exerciseOrder || [];
    // The lift Focus is on wears the ink rule, so the map reads against the page behind the sheet.
    const currentId = draft.session?.selectedExerciseId || "";
    const rows = order.map((exId, idx) => {
      const ex = draft.exercises[exId];
      if (!ex) return "";
      const doneCount = ex.setOrder.filter(sid => ex.sets[sid]?.completion !== "pending").length;
      const totalCount = ex.setOrder.length;
      const isSkipped = ex.status === "skipped";
      const isComplete = doneCount === totalCount && totalCount > 0 && !isSkipped;
      const isCurrent = exId === currentId;
      const statusText = isSkipped ? t("log.skipped") : `${doneCount}/${totalCount}`;
      return `<div class="session-map__row${isCurrent ? " is-current" : ""}" data-session-map-ex="${esc(exId)}"${isCurrent ? ' aria-current="true"' : ""}>` +
        `<button type="button" class="session-map__jump" data-session-map-jump="${esc(exId)}">` +
        `<span class="session-map__name">${esc(model.exerciseNames[exId])}</span>` +
        `<span class="session-map__status ${isComplete ? "is-complete" : isSkipped ? "is-skipped" : ""}">${esc(statusText)}</span>` +
        `</button>` +
        `<div class="session-map__reorder">` +
        `<button type="button" class="session-map__reorder-btn" data-session-reorder-up="${esc(exId)}" aria-label="${esc(t("session.sheet.reorder_up_aria", { name: model.exerciseNames[exId] }))}"${idx === 0 ? " disabled" : ""}>` +
        `<span class="icon-mask icon-mask--chev-up" aria-hidden="true"></span></button>` +
        `<button type="button" class="session-map__reorder-btn" data-session-reorder-down="${esc(exId)}" aria-label="${esc(t("session.sheet.reorder_down_aria", { name: model.exerciseNames[exId] }))}"${idx === order.length - 1 ? " disabled" : ""}>` +
        `<span class="icon-mask icon-mask--chev-down" aria-hidden="true"></span></button>` +
        `</div></div>`;
    }).filter(Boolean);
    mapEl.innerHTML = rows.join("");
    $$("#sessionMap [data-session-map-ex]").forEach(b => b.onclick = (e) => {
      if (e.target instanceof window.Element && e.target.closest("[data-session-reorder-up], [data-session-reorder-down]")) return;
      const exId = /** @type {string} */(b.dataset.sessionMapEx);
      close().then(() => commands.jump(exId));
    });
    const restoreReorderFocus = (/** @type {string} */ exerciseId, /** @type {string} */ direction) => {
      const key = direction === "up" ? "sessionReorderUp" : "sessionReorderDown";
      const control = [...mapEl.querySelectorAll(/** @type {"button"} */("[data-session-reorder-up], [data-session-reorder-down]"))]
        .find(button => button.dataset[key] === exerciseId && !button.disabled) ||
        [...mapEl.querySelectorAll(/** @type {"button"} */("[data-session-reorder-up], [data-session-reorder-down]"))]
          .find(button => button.dataset[direction === "up" ? "sessionReorderDown" : "sessionReorderUp"] === exerciseId && !button.disabled) ||
        mapEl.querySelector(`[data-session-map-ex="${window.CSS.escape(exerciseId)}"]`);
      if (control) (/** @type {HTMLElement} */(control)).focus({ preventScroll: true });
    };
    const announceReorder = (/** @type {string} */ exerciseId, /** @type {string} */ direction) => {
      const current = read();
      const order = current.draft?.exerciseOrder || [];
      const index = order.indexOf(exerciseId);
      const exercise = current.draft?.exercises?.[exerciseId];
      restoreReorderFocus(exerciseId, direction);
      if (index >= 0 && exercise) announce(t("session.sheet.reorder_announcement", {
        name: current.exerciseNames[exerciseId],
        index: index + 1,
        count: order.length,
      }), { placement: "top" });
    };
    $$("#sessionMap [data-session-reorder-up]").forEach(b => b.onclick = async (e) => {
      e.stopPropagation();
      const exId = /** @type {string} */(b.dataset.sessionReorderUp);
      const currentOrder = (read().draft?.exerciseOrder || []).slice();
      const idx = currentOrder.indexOf(exId);
      if (idx > 0) {
        [currentOrder[idx - 1], currentOrder[idx]] = [currentOrder[idx], currentOrder[idx - 1]];
        const res = await commands.reorder(currentOrder);
        if (res.status === "applied") {
          render();
          announceReorder(exId, "up");
        }
      }
    });
    $$("#sessionMap [data-session-reorder-down]").forEach(b => b.onclick = async (e) => {
      e.stopPropagation();
      const exId = /** @type {string} */(b.dataset.sessionReorderDown);
      const currentOrder = (read().draft?.exerciseOrder || []).slice();
      const idx = currentOrder.indexOf(exId);
      if (idx >= 0 && idx < currentOrder.length - 1) {
        [currentOrder[idx], currentOrder[idx + 1]] = [currentOrder[idx + 1], currentOrder[idx]];
        const res = await commands.reorder(currentOrder);
        if (res.status === "applied") {
          render();
          announceReorder(exId, "down");
        }
      }
    });
  }

  // Reset early finish prompt
  early = null;
  const earlyPrompt = $("#sessionEarlyPrompt");
  if (earlyPrompt) earlyPrompt.classList.add("hidden");
  const earlyBtn = $("#sessionEarlyFinish");
  if (earlyBtn) earlyBtn.classList.remove("hidden");
  const earlyMsg = $("#sessionEarlyMsg");
  if (earlyMsg) {
    earlyMsg.classList.remove("is-error");
    earlyMsg.textContent = t("session.sheet.early_prompt");
  }
  closeAbandonPrompt();
}

const ABANDON_REASONS=Object.freeze(["time","recovery","pain","equipment","schedule","other"]);
/** @type {Readonly<Record<string,string>>} */
const ABANDON_REASON_LABELS=Object.freeze({time:"session.abandon.reason.time",recovery:"session.abandon.reason.recovery",
  pain:"session.abandon.reason.pain",equipment:"session.abandon.reason.equipment",schedule:"session.abandon.reason.schedule",
  other:"session.abandon.reason.other"});
/** @type {string|null} */ let abandonReason=null;
function renderAbandonReasons(){
  const host=$("#sessionAbandonReasons");if(!host)return;
  host.innerHTML=ABANDON_REASONS.map(reason=>{const on=abandonReason===reason;
    return `<button type="button" class="pchip${on?" is-active":""}" data-abandon-reason="${reason}" aria-pressed="${on}">${esc(t(ABANDON_REASON_LABELS[reason]))}</button>`}).join("");
  host.querySelectorAll(/** @type {"button"} */("[data-abandon-reason]")).forEach(button=>button.onclick=()=>{
    const reason=/** @type {string} */(button.dataset.abandonReason);
    abandonReason=abandonReason===reason?null:reason;
    renderAbandonReasons();
    (/** @type {HTMLElement|null} */(host.querySelector(`[data-abandon-reason="${reason}"]`)))?.focus()})}
function closeAbandonPrompt(){
  abandonReason=null;
  $("#sessionAbandonPrompt")?.classList.add("hidden");
  $("#sessionAbandon")?.classList.remove("hidden")}
function openAbandonPrompt(){
  if(!read().draft)return;
  abandonReason=null;renderAbandonReasons();
  $("#sessionEarlyFinish")?.classList.add("hidden");
  $("#sessionEarlyPrompt")?.classList.add("hidden");
  $("#sessionAbandon")?.classList.add("hidden");
  $("#sessionAbandonPrompt")?.classList.remove("hidden");
  focus("#sessionAbandonConfirm")}
function cancelAbandonPrompt(){
  closeAbandonPrompt();
  $("#sessionEarlyFinish")?.classList.remove("hidden");
  focus("#sessionAbandon")}
function renderEarlyPreview(){
  const model=read(),draft=model.draft,rows=model.earlyRows;
  const host=$("#sessionEarlyOmissions");
  if(!host)return;
  if(!draft||!Array.isArray(rows)){host.textContent=t("session.sheet.early_invalid");return}
  const included=new Set(rows.map(row=>`${row.exerciseId}_${row.set}`));
  // The set numbers ride in the sentence as a token so they can be set in Mono.
  host.innerHTML=draft.exerciseOrder.map(id=>{
    const exercise=draft.exercises[id];
    const omitted=exercise.setOrder.filter(setId=>!included.has(`${id}_${exercise.sets[setId].ordinal}`));
    if(!omitted.length)return"";
    const sets=omitted.map(setId=>exercise.sets[setId].ordinal).join(", ");
    return `<li>${esc(t("session.sheet.omitted",{name:model.exerciseNames[id],sets:"\u0000"})).replace("\u0000",`<span class="session-early-sets">${esc(sets)}</span>`)}</li>`;
  }).join("");
}

  function open(){
    if(!read().draft)return;
    render();
    const sheet=$("#sessionSheet"),scrim=$("#sessionSheetScrim");if(!sheet)return;
    document.body.classList.add("is-sheet-open");
    shell.openModal(sheet,{initialFocus:$("#sessionSheetClose")||input("#sessionDate"),onEscape:close,scrim,
      delayHide:motion.reducedMotion()?0:280});
    openingFrame=window.requestAnimationFrame(()=>{openingFrame=0;sheet.classList.add("is-open");scrim?.classList.add("is-open");});
  }
  function close(){
    if(openingFrame)window.cancelAnimationFrame(openingFrame);openingFrame=0;
    const sheet=$("#sessionSheet");if(!sheet)return Promise.resolve(false);
    if(sheet.hidden&&shell.activeModal?.el!==sheet)return Promise.resolve(false);
    return shell.closeModal(sheet);
  }
  async function beginEarly(){
    await commands.flush();const draft=read().draft;if(!draft)return;
    renderEarlyPreview();early={draftId:draft.draftId,revision:draft.revision};
    const message=$("#sessionEarlyMsg");if(message){message.classList.remove("is-error");message.textContent=t("session.sheet.early_prompt");}
    $("#sessionEarlyPrompt")?.classList.remove("hidden");$("#sessionEarlyFinish")?.classList.add("hidden");
    $("#sessionAbandon")?.classList.add("hidden");focus("#sessionEarlyConfirm");
  }
  function cancelEarly(){
    early=null;$("#sessionEarlyPrompt")?.classList.add("hidden");$("#sessionEarlyFinish")?.classList.remove("hidden");
    $("#sessionAbandon")?.classList.remove("hidden");focus("#sessionEarlyFinish");
  }
  async function confirmEarly(){
    const draft=read().draft;if(!draft)return;
    if(!early||draft.revision!==early.revision||draft.draftId!==early.draftId){
      const message=$("#sessionEarlyMsg");if(message){message.classList.add("is-error");message.textContent=t("session.sheet.stale_error");}
      toast(t("session.sheet.stale_error"));early={draftId:draft.draftId,revision:draft.revision};renderEarlyPreview();return;
    }
    const expected={draftId:draft.draftId,revision:early.revision};await close();await commands.finishEarly(expected);
  }
  /** @param {string} selector @param {string} event @param {(event:Event)=>unknown} handler */
  function listen(selector,event,handler){$(selector)?.addEventListener(event,handler,{signal:abort?.signal});}
  function mount(){
    if(mounted)return;mounted=true;abort=new window.AbortController();
    listen("#sessionSheetBtn","click",open);listen("#sessionSheetClose","click",close);listen("#sessionSheetScrim","click",close);
    listen("#sessionDate","change",()=>commands.date(input("#sessionDate")?.value||""));
    listen("#sessionBodyweight","input",()=>commands.bodyweight(input("#sessionBodyweight")?.value||""));
    listen("#sessionNotes","input",()=>commands.notes(input("#sessionNotes")?.value||""));
    listen("#sessionEarlyFinish","click",beginEarly);listen("#sessionEarlyCancel","click",cancelEarly);listen("#sessionEarlyConfirm","click",confirmEarly);
    listen("#sessionAbandon","click",async()=>{await commands.flush();openAbandonPrompt();});
    listen("#sessionAbandonCancel","click",cancelAbandonPrompt);
    listen("#sessionAbandonConfirm","click",async()=>{
      const button=/** @type {HTMLButtonElement} */($("#sessionAbandonConfirm"));button.disabled=true;
      try{await commands.abandon(abandonReason);}finally{button.disabled=false;}
    });
  }
  function dispose(){
    if(!mounted)return;mounted=false;abort?.abort();abort=null;
    $$("#sessionMap [data-session-map-ex], #sessionMap [data-session-reorder-up], #sessionMap [data-session-reorder-down], #sessionAbandonReasons [data-abandon-reason]")
      .forEach(element=>{element.onclick=null;});
    if(openingFrame)window.cancelAnimationFrame(openingFrame);openingFrame=0;early=null;abandonReason=null;
    close();
  }
  return Object.freeze({mount,dispose,open,close,render,renderEarlyPreview});
}
