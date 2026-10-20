export {createSheetGestures} from './shell/sheet-gestures.js';
export const NATIVE_FOCUS_SELECTOR="a[href],button,input,select,textarea,summary,[tabindex]";
/** Modal focus/inertness and route presentation lifetime.
 * Route actions and training state belong to controllers. Back uses the real
 * visible Back control so focused editor fields keep their existing commit policy.
 * Construct after the shell DOM exists; call mount once and dispose on teardown.
 */
/** @param {import('./shell-contracts.js').ShellOptions} options */
export function createShell({ window, motion = null, isBooted = () => true,
  isFocusActive = () => false, releaseSheetDrag = () => {}, releaseSwallowedClick = () => {} }) {
const document=window.document, Element=window.Element, MutationObserver=window.MutationObserver;
const performance=window.performance;
const getComputedStyle=window.getComputedStyle.bind(window);
const requestAnimationFrame=window.requestAnimationFrame.bind(window);
const cancelAnimationFrame=window.cancelAnimationFrame.bind(window);
const setTimeout=window.setTimeout.bind(window),clearTimeout=window.clearTimeout.bind(window);
/** @param {string} selector */
const $=selector=>/** @type {HTMLElement|null} */(document.querySelector(selector));
/** @type {MutationObserver[]} */
const observers=[];
let mounted=false;
/** @type {import('./shell-contracts.js').ModalRecord|null} */
let activeModal=null;
/** @type {(()=>void)[]} */
let modalSettleQueue=[];
/** Run `callback` once no modal is open: now, or as the open one finishes closing and has restored focus. */
/** @param {()=>void} callback */
function afterModalSettles(callback){
  if(!activeModal)callback();else modalSettleQueue.push(callback)}
/** @param {HTMLElement|null} root @returns {HTMLElement[]} */
function modalFocusables(root){
  if(!root)return[];
  const sel='a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  return [...root.querySelectorAll(sel)].map(el=>/** @type {HTMLElement} */(el)).filter(el=>{
    if(el.hasAttribute("hidden")||el.closest("[hidden]"))return false;
    const st=getComputedStyle(el);
    return st.display!=="none"&&st.visibility!=="hidden"&&el.getClientRects().length>0;
  })}
/** @returns {import('./shell-contracts.js').InertState[]} */
function snapshotBodyInert(){
  return [...document.body.children].map(el=>({el:/** @type {HTMLElement} */(el),inert:!!/** @type {HTMLElement} */(el).inert}))}
/** @param {(HTMLElement|null)[]} keep */
function applyModalInert(keep){
  const allow=new Set(keep.filter(Boolean));
  allow.add($("#announcementHost"));
  for(const value of document.body.children){
    const child=/** @type {HTMLElement} */(value);
    if(allow.has(child)){child.inert=false;continue}
    child.inert=true}}
/** @param {import('./shell-contracts.js').InertState[]|null|undefined} snap */
function restoreBodyInert(snap){
  if(!snap)return;
  for(const {el,inert} of snap){if(el.isConnected)el.inert=inert}}
/** @param {import('./shell-contracts.js').ModalRecord|null} rec */
function detachModalListeners(rec){
  if(!rec)return;
  if(rec.onKey)document.removeEventListener("keydown",rec.onKey,true);
  if(rec.onPointer)document.removeEventListener("pointerdown",rec.onPointer,true)}
/** @param {import('./shell-contracts.js').ModalRecord|null} rec */
function hideModalElement(rec){
  if(!rec?.el)return;
  // A sheet closed out from under a live drag (Escape, a save, a tour step) still
  // carries the thumb's inline transform — or a spring still settling it — and
  // would reopen part-way down.
  releaseSheetDrag(rec);
  const el=rec.el;
  if(el.tagName==="DIALOG"){const dialog=/** @type {HTMLDialogElement} */(el);if(typeof dialog.close==="function"&&dialog.open)dialog.close()}
  else{el.classList.add("hidden");el.hidden=true}
  rec.scrim?.classList.add("hidden");rec.scrim?.classList.remove("is-open");
  el.classList.remove("is-open");
  document.body.classList.remove("is-sheet-open")}
/** @param {unknown} el @returns {boolean} */
function canTakeFocus(el){
  if(!(el instanceof Element)||!el.isConnected)return false;
  if(el.hasAttribute("disabled")||el.closest("[disabled]"))return false;
  /** @type {Element|null} */
  let n=el;
  for(;n;n=n.parentElement){
    if(/** @type {HTMLElement} */(n).inert)return false;
    if(/** @type {HTMLElement} */(n).hidden===true)return false;
    const st=getComputedStyle(n);
    if(st.display==="none"||st.visibility==="hidden")return false}
  return true}
/** @param {import('./shell-contracts.js').FocusTarget} target @returns {Element|null} */
function resolveReturnFocus(target){
  // A callback lets a caller name its return target before the view that owns it
  // has rendered, which is how boot-time dialogs reach a Today control.
  if(typeof target==="function")target=target();
  if(typeof target==="string")target=$(target);
  if(!(target instanceof Element)||!target.isConnected)return null;
  if(canTakeFocus(target))return target;
  const lab=target.closest?.("label")||/** @type {HTMLInputElement} */(target).labels?.[0];
  if(lab&&canTakeFocus(lab))return lab;
  return null}
/* ---- Route hand-off glue (Plan 064 R5) ----
   A hand-off between surfaces ends with focus on the new surface: its heading, or
   the control it documents as its focus target (the control that opened the
   surface when the lifter backs out of it). A heading is not a control, so it
   takes a programmatic tabindex of -1: never a tab stop, and styles.css draws no
   ring on it. The route functions stay where they are; they call these. */

/** @param {string|Element|null} view */
function routeHeading(view){
  const root=typeof view==="string"?$(`#${view}`):view;
  if(!(root instanceof Element))return null;
  return[...root.querySelectorAll(".page-title,h1,h2")].find(canTakeFocus)||null}
/** @param {import('./shell-contracts.js').FocusTarget} target */
function focusRoute(target){
  const el=resolveReturnFocus(target);
  if(!el)return false;
  if(!el.matches(NATIVE_FOCUS_SELECTOR))el.setAttribute("tabindex","-1");
  try{/** @type {HTMLElement} */(el).focus({preventScroll:true})}catch{return false}
  return document.activeElement===el}
/* The control the lifter last pressed. Safari does not focus a button on click, so
   document.activeElement cannot say what opened a flow; the press itself can. */
/** @type {{el:Element,at:number}|null} */
let routeInvoker=null;
/** @param {Event} event */
function trackInvoker(event){
  const target=event.target instanceof Element?event.target.closest("button,a[href],summary,[role='button']"):null;
  routeInvoker=target?{el:target,at:performance.now()}:null}
function routeInvokerControl(){
  const pressed=routeInvoker&&performance.now()-routeInvoker.at<600?routeInvoker.el:null;
  const active=document.activeElement!==document.body?document.activeElement:null;
  return resolveReturnFocus(pressed)||resolveReturnFocus(active)||null}
/* ---- Page push (amendment N4 drill-downs, N5 Today to Focus) ----
   A drill-down is an interruptible push on the motion layer's `navPush` spring
   (`RepForgeMotion.animatePush`): the pushed page rides in from the right, and
   Back is the same push run the other way. Both pages are mounted for the run,
   the pushed one above (`is-push-over`) and the other held still beneath it
   (`is-push-under`); focus, route state, telemetry and scroll reset are the route
   function's own and have already happened when the run starts. Under reduced
   motion, before boot, with no runtime, or while Focus is the page underneath
   (its layout belongs to body classes the route has just changed), the route
   simply changes. The top-level dock fade stays as it is. */
/** @type {import('./shell-contracts.js').PushState|null} */
let routePushState=null;
/** @type {string|null} */
let routeUnderView=null;
let routeSwipeCommitting=false;
function routePushOn(){
  return isBooted()&&!!motion?.animatePush&&motion.available?.()===true&&!motion.reducedMotion?.()}
function routePushEnd(){
  const state=routePushState;if(!state)return;
  routePushState=null;
  state.animation?.cancel?.();
  state.mover.classList.remove("is-push-over");
  if(state.under?.classList.contains("is-push-under")){
    state.under.classList.remove("is-push-under");state.under.style.removeProperty("--push-top");
    state.under.inert=false;state.under.removeAttribute("aria-hidden")}
  if(state.ghost)state.ghost.remove();
  document.body.classList.remove("is-pushing")}
/** Begin a push around a route change that happens synchronously in the caller:
 *  call this first, make the change, then call the function it returns. `pushed`
 *  is the page that moves. For a push in, `under` is the page that stays beneath
 *  it; for a push out, `under` is the page being returned to. `ghost` is a still
 *  copy of the surface as it was, for a route that swaps content inside one view
 *  (History's list and session page): the copy is the page under a push in, and
 *  the page that moves on a push out. Null when the route should simply change. */
/** @param {import('./shell-contracts.js').Direction} direction @param {import('./shell-contracts.js').PushPages} pages */
function routePushBegin(direction,{pushed,under=null,ghost=null,offset=-Math.round(window.scrollY)}){
  if(direction==="in"&&under)routeUnderView=under.id;
  if(routeSwipeCommitting||!routePushOn()||!(pushed instanceof Element)||under===pushed)return null;
  if(direction==="in"&&!under&&!ghost)return null;
  if(isFocusActive()&&under?.id==="log")return null;
  return()=>{
    routePushEnd();
    const beneath=direction==="in"?(ghost||under):null;
    const mover=direction==="out"&&ghost?ghost:pushed;
    /** @type {import('./shell-contracts.js').PushState} */
    const state={mover,under:beneath,ghost};
    routePushState=state;
    if(ghost){ghost.inert=true;ghost.setAttribute("aria-hidden","true");pushed.after(ghost)}
    if(beneath){
      beneath.style.setProperty("--push-top",`${offset}px`);
      beneath.classList.add("is-push-under");beneath.inert=true;beneath.setAttribute("aria-hidden","true")}
    mover.classList.add("is-push-over");
    document.body.classList.add("is-pushing");
    /** routePushOn established the concrete immutable Motion capability. */
    state.animation=/** @type {Required<Pick<import('./shell-contracts.js').ShellMotion,'animatePush'>>} */(motion).animatePush(mover,{direction});
    state.animation.then(arrived=>{
      if(arrived&&routePushState===state)routePushEnd()})}}
/* ---- Edge swipe back on pushed pages (amendment: the third gesture owner) ----
   The pages a push can leave register with `RepForgeMotion.registerEdgeSwipeBack`
   while they are the page on screen, and nothing else does: Focus keeps its
   horizontal axis for the deck, and the layer itself only runs in standalone.
   Committing runs the visible back control's own handler, so the route, focus and
   telemetry are exactly the tap's; the page is already off screen by then, so the
   route does not push it a second time. While a pull is live the page it returns
   to is mounted beneath it (History has none to mount: its list is rendered
   over the session page, so the pull shows the paper beneath). */
/** @type {Record<string,string>} */
const EDGE_BACK={exercise:"#exBack",library:"#libBack",exercisePreview:"#previewBack",history:"[data-history-back]"};
/** @type {{page:HTMLElement,dispose:()=>void}|null} */
let routeEdge=null;
let routeEdgeFrame=0;
function edgeBackPage(){
  if(document.body.classList.contains("is-focus-wo"))return null;
  const view=$(".view.active");
  if(!view||!EDGE_BACK[view.id])return null;
  if(view.id==="history"&&!view.classList.contains("is-session-page"))return null;
  return view}
function syncEdgeSwipe(){
  routeEdgeFrame=0;
  const page=edgeBackPage();
  if(routeEdge?.page===page)return;
  routeEdge?.dispose();routeEdge=null;
  if(!page||!motion?.registerEdgeSwipeBack)return;
  const registration=motion.registerEdgeSwipeBack({page,onCommit:()=>{
    routeSwipeCommitting=true;
    // The page held beneath the pull is still inert and aria-hidden: it must be live before the Back handler hands it
    // focus, or the swipe lands focus on <body> where the tap would not (R7 J-22).
    unmount();
    try{releaseSwallowedClick();$(EDGE_BACK[page.id])?.click()}finally{routeSwipeCommitting=false}}});
  if(!registration)return;
  /** @type {HTMLElement|null} */
  let beneath=null;
  const unmount=()=>{
    if(!beneath)return;
    beneath.classList.remove("is-push-under");beneath.style.removeProperty("--push-top");
    beneath.inert=false;beneath.removeAttribute("aria-hidden");beneath=null};
  const watch=new MutationObserver(()=>{
    const pulling=page.classList.contains("is-edge-swiping");
    if(pulling&&!beneath){
      const under=page.id==="history"?null:routeViewEl(routeUnderView||"log");
      if(under&&under!==page&&!under.classList.contains("active")){
        beneath=under;under.style.setProperty("--push-top","0px");
        under.classList.add("is-push-under");under.inert=true;under.setAttribute("aria-hidden","true")}}
    else if(!pulling)unmount()});
  watch.observe(page,{attributes:true,attributeFilter:["class"]});
  routeEdge={page,dispose(){registration.dispose();watch.disconnect();unmount()}}}
function scheduleEdgeSwipeSync(){
  if(!routeEdgeFrame)routeEdgeFrame=requestAnimationFrame(syncEdgeSwipe)}
/* History swaps its list for a session page inside one view, so there is no second
   page to keep mounted. A still copy of the surface as it was, taken as the lifter
   presses the control that changes it, stands in: under the session page as it
   pushes in, and as the page that rides out on Back. */
/** @type {{copy:HTMLElement,at:number,scroll:number,session:boolean}|null} */
let historySnap=null;
let historySessionOpen=false;
/** @param {Event} event */
function captureHistory(event){
  const target=event.target instanceof Element?event.target:null;
  const view=$("#history");
  if(!target||!view?.classList.contains("active")||!target.closest("#history [data-edit],#history [data-history-back],#historyCalSheet button"))return;
  const copy=/** @type {HTMLElement} */(view.cloneNode(true));
  copy.querySelectorAll("[id]").forEach(node=>node.removeAttribute("id"));
  copy.classList.remove("is-push-over","is-push-under");
  historySnap={copy,at:performance.now(),scroll:window.scrollY,session:view.classList.contains("is-session-page")}}
function watchRouteSurfaces(){
  const main=$("main"),history=$("#history");
  if(main){const observer=new MutationObserver(scheduleEdgeSwipeSync);
    observer.observe(main,{attributes:true,attributeFilter:["class"],subtree:true});observers.push(observer)}
  if(history){
    historySessionOpen=history.classList.contains("is-session-page");
    const observer=new MutationObserver(()=>{
      const open=history.classList.contains("is-session-page");
      if(open===historySessionOpen)return;
      historySessionOpen=open;
      const snap=historySnap;historySnap=null;
      if(!snap||snap.session===open||performance.now()-snap.at>1500)return;
      routePushBegin(open?"in":"out",{pushed:history,ghost:snap.copy,offset:-Math.round(snap.scroll)})?.()
    });observer.observe(history,{attributes:true,attributeFilter:["class"]});observers.push(observer)}
  scheduleEdgeSwipeSync()}

/** A push around a route change given as a function. */
/** @param {import('./shell-contracts.js').Direction} direction @param {import('./shell-contracts.js').PushPages} pages @param {()=>void} change */
function pushRoute(direction,pages,change){
  const settle=routePushBegin(direction,pages);
  change();
  settle?.()}
/** @param {string} id */
function routeViewEl(id){return $(`#${id}`)}
/** @param {HTMLElement|null} el @param {import('./shell-contracts.js').ModalOptions} opts */
function openModal(el,opts={}){
  if(!el)return false;
  const extras=opts.extras||[];
  if(activeModal&&activeModal.el!==el){
    if(!opts.handoff)return false;
    const opener=opts.returnFocus||activeModal.returnFocus;
    const prevInert=activeModal.prevInert;
    const prev=activeModal;
    detachModalListeners(prev);
    hideModalElement(prev);
    activeModal=null;
    return openModal(el,{...opts,handoff:false,returnFocus:opener,prevInert})}
  if(activeModal&&activeModal.el===el)return true;
  /** @type {import('./shell-contracts.js').ModalRecord} */
  const rec={
    el,scrim:opts.scrim||null,returnFocus:opts.returnFocus||document.activeElement,
    onEscape:opts.onEscape,delayHide:opts.delayHide||0,prevInert:opts.prevInert||snapshotBodyInert(),closing:false
  };
  if(el.tagName==="DIALOG"){const dialog=/** @type {HTMLDialogElement} */(el);if(typeof dialog.showModal==="function"&&!dialog.open)dialog.showModal()}
  else{el.hidden=false;el.classList.remove("hidden")}
  rec.scrim?.classList.remove("hidden");
  applyModalInert([el,rec.scrim,...extras]);
  rec.onKey=e=>{
    if(!activeModal||activeModal.el!==el)return;
    if(e.key==="Escape"){
      e.preventDefault();e.stopPropagation();
      if(typeof rec.onEscape==="function")rec.onEscape();
      return}
    if(e.key!=="Tab")return;
    const stops=modalFocusables(el);
    if(!stops.length){e.preventDefault();return}
    const first=stops[0],last=stops[stops.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    else if(!el.contains(document.activeElement)){e.preventDefault();(e.shiftKey?last:first).focus()}};
  rec.onPointer=e=>{
    if(!activeModal||activeModal.el!==el)return;
    const t=e.target instanceof Element?e.target:null;
    if(t&&(el.contains(t)||rec.scrim?.contains(t)))return;
    e.preventDefault();e.stopPropagation()};
  document.addEventListener("keydown",rec.onKey,true);
  document.addEventListener("pointerdown",rec.onPointer,true);
  activeModal=rec;
  const focusEl=typeof opts.initialFocus==="function"?opts.initialFocus():opts.initialFocus;
  const toFocus=focusEl||modalFocusables(el)[0];
  // Modals are fixed overlays, so scrolling one into view only shifts the page
  // beneath them — on iOS that drags the visual viewport and takes the sheet
  // header with it.
  if(toFocus){try{toFocus.focus({preventScroll:true})}catch{try{toFocus.focus()}catch{}}}
  return true}
/** @param {HTMLElement|null} [el] @returns {Promise<boolean>} */
function closeModal(el){
  const rec=activeModal;
  if(!rec||(el&&rec.el!==el)||rec.closing)return Promise.resolve(false);
  rec.closing=true;
  return new Promise(resolve=>{
    /** @type {number|null} */
    let fallback=null;
    /** @type {((event:TransitionEvent)=>void)|null} */
    let onEnd=null;
    const finish=()=>{
      if(rec.done)return;rec.done=true;
      if(fallback)clearTimeout(fallback);
      if(onEnd)rec.el.removeEventListener("transitionend",onEnd);
      detachModalListeners(rec);
      hideModalElement(rec);
      restoreBodyInert(rec.prevInert);
      if(activeModal===rec)activeModal=null;
      const target=resolveReturnFocus(rec.returnFocus);
      if(target){
        try{/** @type {HTMLElement} */(target).focus({preventScroll:true})}catch{try{/** @type {HTMLElement} */(target).focus()}catch{}}}
      if(!activeModal&&modalSettleQueue.length){const queued=modalSettleQueue;modalSettleQueue=[];queued.forEach(callback=>callback())}
      resolve(true)};
    rec.finish=finish;
    if(rec.delayHide>0){
      rec.el.classList.remove("is-open");
      rec.scrim?.classList.remove("is-open");
      fallback=setTimeout(finish,rec.delayHide);
      onEnd=e=>{if(e.target===rec.el)finish()};
      rec.el.addEventListener("transitionend",onEnd)}
    else finish()})}

/** @param {HTMLElement|null} button @param {HTMLElement|null} panel @param {boolean} open */
function setDisclosure(button,panel,open){
  if(!button||!panel)return;
  const on=!!open;
  button.setAttribute("aria-expanded",on?"true":"false");
  if(panel.id)button.setAttribute("aria-controls",panel.id);
  panel.setAttribute("aria-hidden",on?"false":"true");
  const chev=button.querySelector(".chevron");if(chev)chev.classList.toggle("is-up",on);
  const show=()=>panel.classList.toggle("is-open",on);
  if(motion?.animateDisclosure)motion.animateDisclosure(panel,on,show);else show();
}

function mount(){
  if(mounted)return;
  mounted=true;
  document.addEventListener("click",trackInvoker,true);
  document.addEventListener("click",captureHistory,true);
  watchRouteSurfaces();
}
function dispose(){
  mounted=false;
  document.removeEventListener("click",trackInvoker,true);
  document.removeEventListener("click",captureHistory,true);
  for(const observer of observers)observer.disconnect();
  observers.length=0;
  if(routeEdgeFrame)cancelAnimationFrame(routeEdgeFrame);
  routeEdgeFrame=0;routeEdge?.dispose();routeEdge=null;
  routePushEnd();
  modalSettleQueue=[];
  const rec=activeModal;
  if(rec?.finish)rec.finish();
  else if(rec){detachModalListeners(rec);hideModalElement(rec);restoreBodyInert(rec.prevInert);activeModal=null}
  routeInvoker=null;historySnap=null;routeUnderView=null;
}
return Object.freeze({mount,dispose,openModal,closeModal,afterModalSettles,
  setDisclosure,modalFocusables,canTakeFocus,resolveReturnFocus,routeHeading,focusRoute,
  routeInvokerControl,routePushBegin,routePushEnd,pushRoute,routeViewEl,
  get activeModal(){return activeModal}});
}
