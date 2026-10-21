import {escapeHtml as esc} from '../format.js';
/** Contextual guide presentation lifetime. Eligibility remains the unchanged
 * versioned registry; stored transitions use only the device preference owner.
 * A guide is a note about one control, shown once per version. It is the entry dialogs' native <dialog>, centred over
 * the whole scrim: the title, the body and one "Got it", with focus on the title and kept inside, the page inert
 * behind it, and focus back on the control it explains when it closes. "Got it", Escape and the platform's cancel all
 * record `dismissed`; Replay in Settings resets the record. It is built at body level on first use because
 * `shell.openModal` makes every other body child inert. When another modal is up a guide waits for its next moment
 * rather than taking that modal's place.
 * The first-set guide does not stand between the lifter and the set they came to log: arriving in Focus only arms
 * it, and the first tap on a shelf field or pad opens it before that tap does anything. "Got it" (or Escape) then
 * applies the held tap. Logging the set without touching the shelf completes it, as using its anchor always has.
 * One guide per Focus visit: once one has been dismissed in Focus, the next waits for the next arrival rather than
 * opening after the set the lifter has just logged. */
/** @param {import('./contracts.js').GuideOptions} options */
export function createGuidesView({window,registry:GuideRegistry,preferences,t,landingOpen,shell,focusKey,report}){
const document=window.document,HTMLElement=window.HTMLElement,Element=window.Element;
const getComputedStyle=window.getComputedStyle.bind(window);
/** @param {string} selector */
const $=selector=>/** @type {HTMLElement|null} */(document.querySelector(selector));
/** @type {string|null} */
let activeGuideId=null;
/** @type {(()=>void)|null} */
let activeGuideAfter=null;
let firstSetGuideArmed=false;
let focusGuideHeld=false;
/** @param {string|null|undefined} id */
function guideDefinition(id){return GuideRegistry?.GUIDE_DEFINITIONS?.find(guide=>guide.id===id)||null}
/** @param {import('./contracts.js').GuideDefinition|null} guide @returns {HTMLElement|null} */
function guideAnchor(guide){
  if(!guide?.anchorSelector)return null;
  return /** @type {HTMLElement|null} */([...document.querySelectorAll(guide.anchorSelector)].find(el=>{
    if(!(el instanceof HTMLElement)||el.hidden||el.classList.contains("hidden"))return false;
    const style=getComputedStyle(el),rect=el.getBoundingClientRect();
    return style.display!=="none"&&style.visibility!=="hidden"&&rect.width>0&&rect.height>0})||null)}
/** @param {string} id */
function guideStored(id){return /** @type {{version?:unknown,status?:unknown}|null} */(/** @type {Record<string,unknown>|null|undefined} */(preferences.read().guideState)?.[id]||null)}
/** @param {string} id @param {string} status */
function saveGuideTransition(id,status){
  const guide=guideDefinition(id);if(!guide||!GuideRegistry?.recordGuideTransition)return false;
  const live=GuideRegistry.migrateLegacyTourDone(preferences.reload());
  const next=GuideRegistry.recordGuideTransition(live,id,status,{version:guide.version,nowMs:Date.now()});
  return preferences.replace({...next})}
/** @returns {HTMLDialogElement} */
function guideDialogElement(){
  const existing=$("#guideDialog");
  if(existing)return /** @type {HTMLDialogElement} */(existing);
  const el=/** @type {HTMLDialogElement} */(document.createElement("dialog"));
  el.id="guideDialog";el.className="entry-dialog guide-dialog";el.setAttribute("aria-modal","true");
  el.setAttribute("aria-labelledby","guideDialogTitle");el.setAttribute("aria-describedby","guideDialogBody");
  el.innerHTML=`<h2 class="entry-dialog__title" id="guideDialogTitle" tabindex="-1"></h2><p class="entry-dialog__body" id="guideDialogBody"></p>`+
    `<div class="entry-dialog__actions"><button type="button" id="guideDialogOk" class="btn btn--cta btn--noarrow"></button></div>`;
  document.body.append(el);
  // Some engines close a modal <dialog> on Escape before a capture listener runs; cancel routes that to the same dismissal.
  el.addEventListener("cancel",event=>{event.preventDefault();dismissContextualGuide()});
  /** @type {HTMLButtonElement} */(el.querySelector("#guideDialogOk")).onclick=()=>dismissContextualGuide();
  return el}
function guideOpen(){const el=$("#guideDialog");return !!activeGuideId&&!!el&&/** @type {HTMLDialogElement} */(el).open}
function removeContextualGuide(){
  const el=$("#guideDialog");
  activeGuideId=null;activeGuideAfter=null;
  if(!el||!/** @type {HTMLDialogElement} */(el).open)return;
  shell.closeModal(el);
  if(/** @type {HTMLDialogElement} */(el).open)try{/** @type {HTMLDialogElement} */(el).close()}catch{}}
function dismissContextualGuide(){
  if(!activeGuideId)return false;
  const after=activeGuideAfter;
  saveGuideTransition(activeGuideId,"dismissed");
  if(document.body.classList.contains("is-workout"))focusGuideHeld=true;
  // Closing restores focus first, so the tap the guide held lands where the lifter aimed it.
  removeContextualGuide();
  after?.();
  return true}
/** @param {string} id @param {{returnFocus?:Element|(()=>Element|null)|null,persistDeferred?:boolean,after?:(()=>void)|null}} [options] */
function showContextualGuide(id,{returnFocus=null,persistDeferred=false,after=null}={}){
  const guide=guideDefinition(id);if(!guide?.wired)return false;
  const anchor=guideAnchor(guide);
  const decision=GuideRegistry.evaluateGuide(guide,{
    anchorPresent:!!anchor,anchorVisible:!!anchor,uiPrefs:preferences.read()});
  if(!decision.eligible){
    if(persistDeferred&&decision.decision==="deferred"&&guideStored(id)?.status!=="deferred")saveGuideTransition(id,"deferred");
    return false}
  const dialog=guideDialogElement();
  if(shell.activeModal&&shell.activeModal.el!==dialog)return false;
  removeContextualGuide();
  dialog.dataset.guide=id;
  /** @type {HTMLElement} */(dialog.querySelector(".entry-dialog__title")).textContent=t(`guide.${id}.title`);
  /** @type {HTMLElement} */(dialog.querySelector(".entry-dialog__body")).textContent=t(`guide.${id}.body`);
  /** @type {HTMLElement} */(dialog.querySelector("#guideDialogOk")).textContent=t("why.ok");
  const invoker=returnFocus instanceof Element||typeof returnFocus==="function"?returnFocus:null;
  // The anchor may be rebuilt while the guide is up (a running rest timer redraws the shelf), so it is found again on close.
  const back=()=>(typeof invoker==="function"?invoker():invoker?.isConnected?invoker:null)||guideAnchor(guide);
  if(!shell.openModal(dialog,{initialFocus:/** @type {HTMLElement} */(dialog.querySelector(".entry-dialog__title")),returnFocus:back,onEscape:()=>dismissContextualGuide()}))return false;
  if(id==="first-set")firstSetGuideArmed=false;
  activeGuideId=id;activeGuideAfter=typeof after==="function"?after:null;
  const stored=guideStored(id);
  if(stored?.version!==guide.version||stored?.status!=="shown")saveGuideTransition(id,"shown");
  return true}
function firstSetGuideEligible(){
  const guide=guideDefinition("first-set");
  return !!guide?.wired&&GuideRegistry.evaluateGuide(guide,{anchorPresent:true,anchorVisible:!!guideAnchor(guide),uiPrefs:preferences.read()}).eligible}
/** @param {readonly string[]} [ids] */
function maybeShowContextualGuides(ids=GuideRegistry?.PLAN_054_GUIDE_IDS||[]){
  // Never while the entry landing is up. It is a full-screen threshold whose
  // one job is the proposition, and every guide that can anchor to it explains
  // a control it has already named — the entry actions carry their labels,
  // the install card carries its title and body, Privacy is a standing link.
  // The app's ordinary render loop runs behind this gate, so the rule belongs
  // here rather than at a call site: otherwise any future render path
  // re-opens the same hole. The guides keep their state and their real
  // moments — "entry" at the chooser, "install" and "privacy" in Settings.
  if(landingOpen())return false;
  if(guideOpen())return true;
  if(firstSetGuideArmed&&!firstSetGuideEligible())firstSetGuideArmed=false;
  if(firstSetGuideArmed)return true;
  if(!document.body.classList.contains("is-workout"))focusGuideHeld=false;
  else if(focusGuideHeld)return false;
  for(const id of ids){
    if(id==="first-set"){if(firstSetGuideEligible()){firstSetGuideArmed=true;return true}continue}
    if(showContextualGuide(id))return true}
  return false}
/** @param {string} id */
function replayContextualGuide(id){
  const guide=guideDefinition(id);if(!guide||!GuideRegistry?.replayGuideState)return false;
  const live=preferences.reload();
  if(activeGuideId===id)removeContextualGuide();
  const next=GuideRegistry.replayGuideState(live,id,{version:guide.version,nowMs:Date.now()});
  if(!preferences.replace({...next}))return false;
  report("guide_replay",{guideId:id});
  const returnFocus=document.activeElement;
  queueMicrotask(()=>showContextualGuide(id,{returnFocus,persistDeferred:true}));return true}
function contextualGuideState(){return JSON.parse(JSON.stringify(preferences.read().guideState||{}))}
/** First-set's held tap: armed on Focus arrival, this intercepts the first tap on a shelf field or pad, opens the
 *  guide instead, and replays the held tap once "Got it" (or Escape) closes it. A direct Log set completes it. */
/** @param {Event} event */
function onContextualGuideAction(event){
  if(!firstSetGuideArmed)return;
  const target=event.target instanceof Element?event.target:null;
  if(target?.closest(".focus-shelf .saveset")&&firstSetGuideEligible()){
    firstSetGuideArmed=false;saveGuideTransition("first-set","completed");return}
  const control=/** @type {HTMLElement|null} */(target?.closest(".focus-shelf .shelf__fieldbtn[data-shelf-field],.focus-shelf .shelf__pad[data-dir]")||null);
  if(!control||/** @type {HTMLButtonElement} */(control).disabled)return;
  const key=focusKey(control);
  if(!key)return;
  const tapped=()=>$(key.sel);
  if(!showContextualGuide("first-set",{returnFocus:tapped,after:()=>tapped()?.click()}))return;
  event.preventDefault();event.stopImmediatePropagation()}

function renderGuideReplayList(){
  const list=$("#guideReplayList");
  if(!list||!GuideRegistry?.GUIDE_DEFINITIONS)return;
  list.innerHTML=GuideRegistry.GUIDE_DEFINITIONS.map(guide=>
    `<button type="button" class="btn btn--steel guide-replay__item" data-guide-replay="${esc(guide.id)}">`+
      `<span class="guide-replay__title">${esc(t(`guide.${guide.id}.title`))}</span>`+
      `<span class="guide-replay__body">${esc(t(`guide.${guide.id}.body`))}</span>`+
    `</button>`).join("");
  for(const button of [...list.querySelectorAll("[data-guide-replay]")].map(el=>/** @type {HTMLButtonElement} */(el)))
    button.onclick=()=>replayContextualGuide(button.dataset.guideReplay||"")}

return Object.freeze({show:showContextualGuide,maybeShow:maybeShowContextualGuides,
  dismiss:dismissContextualGuide,remove:removeContextualGuide,
  replay:replayContextualGuide,state:contextualGuideState,onAction:onContextualGuideAction,
  renderReplayList:renderGuideReplayList});
}
