import {createProgressOverview} from "./overview.js";
import {createEvidenceViews} from "./evidence.js";

/** Progress owns its selected tab/scopes/filter. Queries return readonly facts;
 * Review separately owns its diagnosis/preview flow. No application state or
 * storage is retained here. Explicit mount/dispose own keyboard/tab handlers.
 */
/** @param {import("./contracts.js").ControllerOptions} options */
export function createProgressController({document,copy,format,motion,queries,review,onOpenExercise,onGoToday,onReviewViewed,onSelected}){
/** @param {string} selector */
const $=selector=>/** @type {HTMLElement|null} */(document.querySelector(selector));
/** @param {string} selector */
const $$=selector=>/** @type {HTMLElement[]} */([...document.querySelectorAll(selector)]);
/** @type {Readonly<Record<string,string>>} */
const STATS_SEG={overview:"segOverview",review:"segReview"};
/** @type {Readonly<Record<string,string>>} */
const EVIDENCE_SEG={strength:"segStrength",volume:"segVolume",prs:"segPRs"};
/** @type {string|null} */let evidenceView=null;
let statsSeg="overview",strengthScope="current-block",volumeScope="this-week",prFilter="all",mounted=false,disposed=false;
const presentation=createProgressOverview({document,copy,format,onOpenExercise,onGoToday});
const evidence=createEvidenceViews({document,copy,format,presentation,
  onStrengthScope:scope=>{strengthScope=scope;renderStrength()},
  onVolumeScope:scope=>{volumeScope=scope;renderVolume()},
  onPrFilter:filter=>{prFilter=filter;renderPrs()}});
function renderStrength(){if(!disposed)evidence.renderStrength(queries.strength(strengthScope))}
function renderVolume(){if(!disposed)evidence.renderVolume(queries.volume(volumeScope))}
function renderPrs(){if(!disposed)evidence.renderPrs(queries.prs(prFilter))}
function renderEvidenceView(){
  if(disposed)return;
  if(evidenceView==="strength")renderStrength();
  else if(evidenceView==="volume")renderVolume();
  else if(evidenceView==="prs")renderPrs();
}
function paintStatsTabs(){
  const on=evidenceView||statsSeg,row=$("#statsSeg");
  // N3: where the 2px indicator is drawn now (or, if one is still travelling, where it is on screen).
  const was=row?.querySelector('.tabrow__tab[aria-selected="true"]'),liveRing=row?.querySelector(".tabrow__ring");
  const fromRect=tabIndicatorRect(liveRing||was,!!liveRing),scrolled=row?row.scrollLeft:0;
  $$("#statsSeg button").forEach(b=>{const sel=b.dataset.seg===on;
    b.classList.toggle("active",sel);b.setAttribute("aria-selected",sel?"true":"false");
    b.tabIndex=sel?0:-1;
    // A row that scrolls keeps its selected tab in view.
    if(sel&&b.parentElement&&b.parentElement.scrollWidth>b.parentElement.clientWidth){
      const row=b.parentElement,left=b.offsetLeft-row.offsetLeft;
      if(left<row.scrollLeft||left+b.offsetWidth>row.scrollLeft+row.clientWidth)row.scrollLeft=Math.max(0,left-16)}});
  const now=row?.querySelector('.tabrow__tab[aria-selected="true"]');
  if(fromRect&&was&&now&&now!==was){fromRect.left-=/** @type {HTMLElement} */(row).scrollLeft-scrolled;travelTabIndicator(/** @type {HTMLElement} */(now),fromRect)}}
/** The rect of a tab's indicator: the 2px border along its foot, or a travelling indicator as drawn. */
/** @param {Element|null|undefined} el @param {boolean} isRing */
function tabIndicatorRect(el,isRing){
  if(!el)return null;
  const r=el.getBoundingClientRect();
  if(!r.width)return null;
  return isRing?{left:r.left,top:r.top,width:r.width,height:r.height}:{left:r.left,top:r.bottom-2,width:r.width,height:2}}
/** N3: the indicator travels from the tab it left to the one that now carries it. The tab keeps its own
 *  2px border for the rest state and sets it aside while this one is in the air, so there is one
 *  indicator on screen. Selecting, the panel switch, focus and ARIA are already done and wait on nothing. */
/** @param {HTMLElement} tab @param {{left:number,top:number,width:number,height:number}} fromRect */
function travelTabIndicator(tab,fromRect){
  const m=(motion&&motion.available()&&!motion.reducedMotion()?motion:null),row=tab.parentElement;
  if(!m||!row)return false;
  row.querySelectorAll(".tabrow__ring").forEach(r=>r.remove());
  row.querySelectorAll(".is-ring-travel").forEach(x=>x.classList.remove("is-ring-travel"));
  const ring=document.createElement("span");
  ring.className="tabrow__ring";ring.setAttribute("aria-hidden","true");
  tab.classList.add("is-ring-travel");tab.append(ring);
  const done=()=>{ring.remove();if(!row.querySelector(".tabrow__ring"))tab.classList.remove("is-ring-travel")};
  m.animateIndicator(ring,fromRect).then(done,done);
  return true}
/** @param {string|null|undefined} view */
function setEvidenceView(view){
  if(disposed)return;
  if(!EVIDENCE_SEG[String(view)]){evidenceView=null;
    paintStatsTabs();
    for(const id of Object.values(EVIDENCE_SEG)){const el=$("#"+id);if(el)el.classList.remove("active")}
    return}
  evidenceView=/** @type {string} */(view);
  paintStatsTabs();
  for(const [k,id] of Object.entries(STATS_SEG)){const el=$("#"+id);if(el)el.classList.remove("active")}
  for(const [k,id] of Object.entries(EVIDENCE_SEG)){const el=$("#"+id);if(el)el.classList.toggle("active",k===view)}
  renderEvidenceView()}
/* The WAI tabs pattern on the Progress row (R7 J-20): each tab names the panel it controls and each panel
   is labelled by its tab; the selected tab is the only tab stop; Left/Right (wrapping), Home and End move
   focus and select, as a tap does. The window, filter and day segments are toggle groups, not tabs: they
   change one region and have no panel of their own. */
function wireStatsTabs(){
  const row=$("#statsSeg");if(!row)return;
  const tabs=$$("#statsSeg button");
  tabs.forEach(b=>{
    b.id=`statsTab-${b.dataset.seg}`;
    const panel=$("#"+(b.getAttribute("aria-controls")||""));
    if(panel)panel.setAttribute("aria-labelledby",b.id);
    b.onclick=()=>setStatsSeg(b.dataset.seg)});
  row.onkeydown=e=>{
    if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
    const at=tabs.indexOf(/** @type {HTMLElement} */(document.activeElement));if(at<0)return;
    const to=e.key==="ArrowRight"?(at+1)%tabs.length:e.key==="ArrowLeft"?(at+tabs.length-1)%tabs.length:
      e.key==="Home"?0:e.key==="End"?tabs.length-1:-1;
    if(to<0)return;
    e.preventDefault();
    setStatsSeg(tabs[to].dataset.seg);tabs[to].focus()}}
/** @param {string|undefined} seg */
function setStatsSeg(seg){
  if(disposed)return;
  // Legacy one-level values route to their Evidence view (Plan 056 migration).
  if(EVIDENCE_SEG[String(seg)])return setEvidenceView(seg);
  if(!STATS_SEG[String(seg)])seg="overview";
  // Opening the review is the move onto it, not re-selecting it while it is showing.
  const opensReview=seg==="review"&&!(statsSeg==="review"&&!evidenceView&&$("#stats")?.classList.contains("active"));
  statsSeg=/** @type {string} */(seg);evidenceView=null;
  paintStatsTabs();
  for(const [k,id] of Object.entries(STATS_SEG)){const el=$("#"+id);if(el)el.classList.toggle("active",k===seg)}
  for(const [k,id] of Object.entries(EVIDENCE_SEG)){const el=$("#"+id);if(el)el.classList.remove("active")}
  if(seg==="review")review.render(queries.review());
  if(opensReview)onReviewViewed();
  onSelected(/** @type {string} */(seg))}

function render(){
  if(disposed)return;
  const model=queries.overview();
  presentation.renderIntro(model.hasLog);presentation.renderWeek(model.week);presentation.renderAttention(model.attention);presentation.renderStrength(model.strength);
  review.render(queries.review());renderEvidenceView();
  if($("#stats")?.classList.contains("active")&&!evidenceView)onSelected(statsSeg);
}
function mount(){if(mounted||disposed)return;mounted=true;wireStatsTabs()}
function dispose(){
  disposed=true;mounted=false;
  const row=$("#statsSeg");if(row){row.onkeydown=null;row.querySelectorAll("button").forEach(button=>button.onclick=null)}
  row?.querySelectorAll(".tabrow__ring").forEach(ring=>ring.remove());
  row?.querySelectorAll(".is-ring-travel").forEach(tab=>tab.classList.remove("is-ring-travel"));
  presentation.dispose();evidence.dispose();review.dispose();
}
return Object.freeze({mount,dispose,render,
  selectSegment:setStatsSeg,selectEvidence:setEvidenceView,
  state:()=>Object.freeze({segment:statsSeg,evidence:evidenceView,strengthScope,volumeScope,prFilter})});
}

export {createExerciseController} from "./exercise.js";
