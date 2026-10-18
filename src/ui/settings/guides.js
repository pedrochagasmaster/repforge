import {escapeHtml as esc} from '../format.js';
/** Contextual guide presentation lifetime. Eligibility remains the unchanged
 * versioned registry; stored transitions use only the device preference owner.
 * The active #435 native-dialog implementation reconciles at this owner, rather
 * than adding a second guide host to the composition root. */
/** @param {import('./contracts.js').GuideOptions} options */
export function createGuidesView({window,registry:GuideRegistry,preferences,t,landingOpen,onGeometryChanged,report}){
const document=window.document,HTMLElement=window.HTMLElement,Element=window.Element;
const getComputedStyle=window.getComputedStyle.bind(window);
/** @param {string} selector */
const $=selector=>/** @type {HTMLElement|null} */(document.querySelector(selector));
/** @param {string} selector */
const $$=selector=>[...document.querySelectorAll(selector)].map(el=>/** @type {HTMLButtonElement} */(el));
/** @type {string|null} */
let activeGuideId=null;
/** @type {HTMLElement|null} */
let activeGuideAnchor=null;
/** @type {HTMLElement|null} */
let activeGuideCue=null;
/** @type {HTMLElement|null} */
let activeGuideReturnFocus=null;
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
function removeContextualGuide(){
  const hadCue=!!activeGuideCue;
  activeGuideCue?.remove();activeGuideId=null;activeGuideAnchor=null;activeGuideCue=null;activeGuideReturnFocus=null;
  if(hadCue)onGeometryChanged()}
function dismissContextualGuide({restoreFocus=false}={}){
  if(!activeGuideId)return false;
  const target=activeGuideReturnFocus||activeGuideAnchor;
  saveGuideTransition(activeGuideId,"dismissed");removeContextualGuide();
  if(restoreFocus&&target instanceof HTMLElement&&target.isConnected)target.focus({preventScroll:true});
  return true}
/** @param {string} id @param {{focus?:boolean,returnFocus?:Element|null,persistDeferred?:boolean}} options */
function showContextualGuide(id,{focus=false,returnFocus=null,persistDeferred=false}={}){
  const guide=guideDefinition(id);if(!guide?.wired)return false;
  const anchor=guideAnchor(guide);
  const decision=GuideRegistry.evaluateGuide(guide,{
    anchorPresent:!!anchor,anchorVisible:!!anchor,uiPrefs:preferences.read()});
  if(!decision.eligible||!anchor){
    if(persistDeferred&&decision.decision==="deferred"&&guideStored(id)?.status!=="deferred")saveGuideTransition(id,"deferred");
    return false}
  removeContextualGuide();
  const cue=document.createElement("aside"),titleId=`guideCueTitle-${id}`;
  cue.className="guide-cue";cue.dataset.guideCue=id;cue.dataset.anchorTarget=guide.anchorSelector;
  cue.setAttribute("role","status");cue.setAttribute("aria-labelledby",titleId);
  cue.innerHTML=`<div class="guide-cue__copy"><p class="guide-cue__title" id="${titleId}">${esc(t(`guide.${id}.title`))}</p>`+
    `<p class="guide-cue__body">${esc(t(`guide.${id}.body`))}</p></div>`+
    `<button type="button" class="guide-cue__dismiss" data-guide-dismiss aria-label="${esc(t("guide.dismiss"))}">×</button>`;
  const dismiss=/** @type {HTMLButtonElement} */(cue.querySelector("[data-guide-dismiss]"));
  dismiss.onclick=event=>{if(activeGuideCue!==cue)return;event.stopPropagation();dismissContextualGuide({restoreFocus:focus})};
  cue.addEventListener("keydown",event=>{
    if(activeGuideCue!==cue||event.key!=="Escape")return;
    event.preventDefault();event.stopPropagation();dismissContextualGuide({restoreFocus:true})});
  // #firstRunPrivacy lives in the narrow header utility row: inserted there,
  // the cue is a flex sibling with no room and collapses into a vertical
  // sliver of one word per line. Focus's own controls likewise need the whole
  // owning surface as their insertion point so a cue never joins a fixed row.
  const shelf=anchor.closest(".focus-shelf");
  const placement=shelf||anchor.closest(".wo-head")||
    anchor.closest(".firstrun__actions")||anchor.closest(".firstrun__header")||anchor.closest(".entry__hub")||anchor.closest(".entry-feature")||
    anchor.closest("#statsSeg")||anchor;
  placement.insertAdjacentElement(shelf?"beforebegin":"afterend",cue);
  onGeometryChanged();
  activeGuideId=id;activeGuideAnchor=anchor;activeGuideCue=cue;
  activeGuideReturnFocus=returnFocus instanceof HTMLElement?returnFocus:null;
  const stored=guideStored(id);
  if(stored?.version!==guide.version||stored?.status!=="shown")saveGuideTransition(id,"shown");
  if(focus)queueMicrotask(()=>dismiss?.focus({preventScroll:true}));
  return true}
/** @param {readonly string[]} ids */
function maybeShowContextualGuides(ids=GuideRegistry?.PLAN_054_GUIDE_IDS||[]){
  // Never while the entry landing is up. It is a full-screen threshold whose
  // one job is the proposition, and every cue that can anchor to it explains
  // a control it has already named — the entry actions carry their labels,
  // the install card carries its title and body, Privacy is a standing link.
  // The app's ordinary render loop runs behind this gate, so the rule belongs
  // here rather than at a call site: otherwise any future render path
  // re-opens the same hole. The guides keep their state and their real
  // moments — "entry" at the chooser, "install" and "privacy" in Settings.
  if(landingOpen())return false;
  if(activeGuideCue?.isConnected&&activeGuideAnchor&&guideAnchor(guideDefinition(activeGuideId))===activeGuideAnchor)return true;
  removeContextualGuide();
  for(const id of ids){
    if(showContextualGuide(id))return true}
  return false}
function completeContextualGuide(){
  if(!activeGuideId)return false;
  saveGuideTransition(activeGuideId,"completed");removeContextualGuide();return true}
/** @param {string} id */
function replayContextualGuide(id){
  const guide=guideDefinition(id);if(!guide||!GuideRegistry?.replayGuideState)return false;
  const live=preferences.reload();
  if(activeGuideId===id)removeContextualGuide();
  const next=GuideRegistry.replayGuideState(live,id,{version:guide.version,nowMs:Date.now()});
  if(!preferences.replace({...next}))return false;
  report("guide_replay",{guideId:id});
  const returnFocus=document.activeElement;
  queueMicrotask(()=>showContextualGuide(id,{focus:true,returnFocus,persistDeferred:true}));return true}
function contextualGuideState(){return JSON.parse(JSON.stringify(preferences.read().guideState||{}))}
/** @param {Event} event */
function onContextualGuideAction(event){
  const target=event.target instanceof Element?event.target:null;
  if(activeGuideAnchor&&target&&activeGuideAnchor.contains(target))completeContextualGuide()}

function renderGuideReplayList(){
  const list=$("#guideReplayList");
  if(!list||!GuideRegistry?.GUIDE_DEFINITIONS)return;
  list.innerHTML=GuideRegistry.GUIDE_DEFINITIONS.map(guide=>
    `<button type="button" class="btn btn--steel guide-replay__item" data-guide-replay="${esc(guide.id)}">`+
      `<span class="guide-replay__title">${esc(t(`guide.${guide.id}.title`))}</span>`+
      `<span class="guide-replay__body">${esc(t(`guide.${guide.id}.body`))}</span>`+
    `</button>`).join("");
  $$("#guideReplayList [data-guide-replay]").forEach(button=>{
    button.onclick=()=>replayContextualGuide(button.dataset.guideReplay||"")
  })}

function refreshAnchor(){
  if(activeGuideId&&activeGuideAnchor&&!activeGuideAnchor.isConnected){
    const anchor=guideAnchor(guideDefinition(activeGuideId));if(anchor)activeGuideAnchor=anchor}}
return Object.freeze({show:showContextualGuide,maybeShow:maybeShowContextualGuides,
  dismiss:dismissContextualGuide,remove:removeContextualGuide,complete:completeContextualGuide,
  replay:replayContextualGuide,state:contextualGuideState,onAction:onContextualGuideAction,
  renderReplayList:renderGuideReplayList,refreshAnchor});
}
