/** @typedef {{sel:string,start?:number|null,end?:number|null}} ControlKey
 * @typedef {{canTakeFocus:(element:HTMLElement)=>boolean,resolveReturnFocus:(element:Element|null)=>HTMLElement|null,nativeFocusSelector:string}} FocusShell
 */
/** The DOM control lifetime of Focus: stable keys survive a shelf rebuild,
 * cursor positions follow the matching new input, and programmatic handoffs
 * preserve the lifter's most recent pointer/keyboard modality. No workout or
 * storage state enters this controller. Construction performs no IO.
 * @param {{window:Window & typeof globalThis,shell:FocusShell}} options */
export function createControlFocus({window,shell}) {
  const document=window.document;
  const focusCard=()=>document.querySelector("#workout .exercise.is-current");
  const live=(/** @type {string} */ selector)=>Array.from(document.querySelectorAll(/** @type {"input"} */(`#workout ${selector}`))).filter(element=>!element.closest(".is-peek"));
  /** @type {AbortController|null} */ let abort=null;
/** @param {Element|null} el @returns {ControlKey|null} */
function workoutFocusKey(el){
  if(!(el instanceof window.HTMLElement)||el.closest(".is-peek")||!el.closest("#workout"))return null;
  const q=(/** @type {string} */ value)=>window.CSS.escape(value);
  const d=el.dataset;
  if(el.matches(".shelf__input")&&d.k)return{sel:`.focus-shelf .shelf__input[data-k="${q(d.k)}"]`,start:(/** @type {HTMLInputElement} */(el)).selectionStart,end:(/** @type {HTMLInputElement} */(el)).selectionEnd};
  if(d.shelfField&&d.set)return{sel:`.focus-shelf [data-shelf-field="${q(d.shelfField)}"][data-set="${q(d.set)}"]`};
  if(el.matches(".shelf__pad")&&d.dir)return{sel:`.focus-shelf .shelf__pad[data-dir="${q(d.dir)}"]`};
  if(d.restAct)return{sel:`.focus-shelf [data-rest-act="${q(d.restAct)}"]`};
  if(el.matches(".saveset"))return{sel:".focus-shelf .saveset"};
  if(d.editex&&d.editn)return{sel:`.ledgerline[data-editex="${q(d.editex)}"][data-editn="${q(d.editn)}"]`};
  for(const name of["fcancel","fnext","ffinish","fnextrow","ledgermore"])if(name in d||el.hasAttribute(`data-${name}`))return{sel:`[data-${name}]`};
  return null}
/* A hand-off moves focus without the lifter having moved it: after a tap, the control it lands on must not light a
   focus ring the tap never asked for (and the orange budget has no place for one). Whoever last used a key still
   gets the ring. */
let workoutInputModality="pointer";
/** @param {Element|null} el */
function focusWorkoutControl(el){
  const control=/** @type {HTMLElement} */(el);
  try{control.focus({preventScroll:true})}catch{return false}
  if(workoutInputModality==="pointer"){
    control.setAttribute("data-quiet-focus","");
    control.addEventListener("blur",()=>control.removeAttribute("data-quiet-focus"),{once:true})}
  return document.activeElement===el}
/** @param {ControlKey|null} key */
function restoreWorkoutFocus(key){
  const card=focusCard();if(!key||!card)return false;
  const el=card.querySelector(key.sel);
  if(!(el instanceof window.HTMLElement)||!shell.canTakeFocus(el))return false;
  if(!focusWorkoutControl(el))return false;
  if(key.start!=null&&typeof (/** @type {HTMLInputElement} */(el)).setSelectionRange==="function"){try{(/** @type {HTMLInputElement} */(el)).setSelectionRange(key.start,key.end??key.start)}catch{}}
  return document.activeElement===el}
/** Name the control that follows an action whose own control is gone after the rebuild. `next`: the field the new
 *  active set opens on, or the shelf's action once the exercise is done; `cta`: the shelf's action; `row`: a logged
 *  row, falling back to the action. */
/** @param {string} kind @param {{exId?:string|null,n?:number}} [options] */
function focusWorkoutHandoff(kind,{exId=null,n=0}={}){
  const card=focusCard();if(!card)return false;
  const shelf=card.querySelector(".focus-shelf");
  const cta=shelf?.querySelector(".btn--cta")||null;
  let target=null;
  // A collapsed table no longer draws the corrected row; its disclosure stands for it.
  if(kind==="row")target=card.querySelector(`.ledgerline[data-editex="${window.CSS.escape(String(exId))}"][data-editn="${n}"]`)||card.querySelector("[data-ledgermore]");
  else if(kind==="next")target=shelf?.querySelector(".shelf__field.is-sel [data-shelf-field]")||shelf?.querySelector("[data-shelf-field]")||null;
  const next=shell.resolveReturnFocus(target)||cta;
  if(!next)return false;
  if(!next.matches(shell.nativeFocusSelector))next.setAttribute("tabindex","-1");
  return focusWorkoutControl(next)}

/** The control standing for a draft field in the live card now. A rebuild replaces the node an edit began on, so
 *  anything that outlives an await asks for the control again by its stable key instead of keeping the old node. */
/** @param {string} key */
function liveShelfInput(key){return live(".shelf__input").find(el=>el.dataset.k===key)||null}
/** @param {string} setKey */
function liveEffortField(setKey){return live("[data-effspin]").find(el=>el.dataset.effspin===setKey)?.closest(".shelf__field")||null}


  function mount(){
    if(abort)return;abort=new window.AbortController();
    document.addEventListener("pointerdown",()=>{workoutInputModality="pointer"},{capture:true,signal:abort.signal});
    document.addEventListener("keydown",()=>{workoutInputModality="keyboard";document.activeElement?.removeAttribute("data-quiet-focus");},{capture:true,signal:abort.signal});
  }
  function dispose(){
    abort?.abort();abort=null;workoutInputModality="pointer";
    document.querySelectorAll("#workout [data-quiet-focus]").forEach(element=>element.removeAttribute("data-quiet-focus"));
  }
  return Object.freeze({mount,dispose,key:workoutFocusKey,control:focusWorkoutControl,
    restore:restoreWorkoutFocus,handoff:focusWorkoutHandoff,input:liveShelfInput,effortField:liveEffortField});
}
