/** DOM geometry is derived from the rendered Focus card, never durable state. */
/** @param {{window:Window & typeof globalThis}} options */
export function createFocusGeometry({window}) {
const document=window.document,ResizeObserver=window.ResizeObserver;
const getComputedStyle=window.getComputedStyle.bind(window);
/** @param {string} selector */
const $=selector=>document.querySelector(/** @type {string} */ (selector));
/** @param {string} selector */
const $$=selector=>[...document.querySelectorAll(/** @type {string} */ (selector))];
const focusCard=()=>/** @type {HTMLElement|null} */ ($("#workout.is-focus .exercise.is-current"));
/** @type {ResizeObserver|null} */ let focusFloorWatch=null;
/** @type {Element[]} */ let focusFloorWatched=[];
function sizeFocusDeck(){
  const cards=/** @type {HTMLElement[]} */ ($$("#focusDeck .exercise--focus"));
  if(cards.length)cards.forEach(sizeFocusCard);
  else sizeFocusCard(focusCard());
  syncFocusFloor()}
/** The shelf keeps its fields, pads and action whole at every text size, and its height depends on the text, so the
 *  layout cannot know it. This publishes the height the shell has to keep (the rigid chrome, the progress bar, the
 *  context region's floor and the shelf) as `--focus-floor` and `--focus-form-floor`; the stylesheet lets banners above
 *  the deck give way to it. Watching the header and the shelf republishes it when a timer widens a chip
 *  or an edit rebuilds the shelf. */

function syncFocusFloor(){
  const card=focusCard(),shell=/** @type {HTMLElement|null} */ ($("#workoutShell")),shelf=card?.querySelector(".focus-shelf"),head=shell?.querySelector(".wo-head");
  if(!card||!shell||!shelf||!head)return;
  /** @param {Element|null} el */
  const tall=el=>el&&el.getClientRects().length?el.getBoundingClientRect().height:0;
  const context=card.querySelector(".fcard__context");
  const least=context?getComputedStyle(context):null;
  // The card's own floor: the shelf whole, under the context region at its least. With the keyboard up the other
  // floors stand down, and this one makes what sits above the deck (the skip bar) give way instead of the shelf.
  const deck=tall(shelf)+(least?(parseFloat(least.paddingTop)||0)+(parseFloat(least.paddingBottom)||0):0);
  shell.style.setProperty("--focus-deck-floor",`${Math.ceil(deck)}px`);
  let form=tall($("#woProgress"))+tall(shelf)+(least?Math.max(parseFloat(least.minHeight)||0,parseFloat(least.paddingTop)+parseFloat(least.paddingBottom)):0);
  for(const el of $("#workout")?.children||[])if(!el.matches(".deck"))form+=tall(el);
  shell.style.setProperty("--focus-form-floor",`${Math.ceil(form)}px`);
  shell.style.setProperty("--focus-floor",`${Math.ceil(form+tall(head))}px`);
  if(typeof ResizeObserver!=="function")return;
  // Observing starts with a notification of its own, so the watch is only re-pointed when its elements changed.
  const watched=[head,shelf,$("#woProgress")].filter((el)=>el!==null);
  if(focusFloorWatched.length===watched.length&&watched.every((el,i)=>el===focusFloorWatched[i]))return;
  focusFloorWatch??=new ResizeObserver(()=>syncFocusFloor());
  focusFloorWatch.disconnect();
  const observer=focusFloorWatch;
  watched.forEach(el=>observer.observe(el));
  focusFloorWatched=watched}

/** @param {HTMLElement|null} card */
function sizeFocusCard(card){
  if(!card)return;
  const rootFontSize=parseFloat(getComputedStyle(document.documentElement).fontSize);
  card.classList.toggle("is-text-scaled",Number.isFinite(rootFontSize)&&rootFontSize>16.1);
  // The context region scrolls as one: keep the row being worked on in view. At the first set nothing has been
  // logged and the shelf already shows the set, so the card opens at its top with the exercise's prescription; later
  // the row scrolls into view, but never past a rest that is running or has just ended, which sits above it.
  const context=/** @type {HTMLElement|null} */ (card.querySelector(".fcard__context"));
  const open=/** @type {HTMLElement|null|undefined} */ (context?.querySelector(".ledgerline--open"));if(!context||!open)return;
  if(Number(open.dataset.lrow)<=1&&context.scrollTop===0)return;
  const box=context.getBoundingClientRect(),row=open.getBoundingClientRect();
  if(row.bottom>box.bottom){
    // A rest that is running or has just ended is never scrolled out: whatever else the window holds above the row
    // (a skip bar taking its height, the table's head and disclosure), the row comes no further than the rest's top.
    const slot=/** @type {HTMLElement|null} */ (context.querySelector(".fx-slot")),
      resting=!!slot&&!!slot.dataset.rest&&slot.dataset.rest!=="none";
    const keep=resting?slot.getBoundingClientRect().top:NaN;
    const room=Number.isFinite(keep)?Math.max(0,keep-box.top):Infinity;
    const need=row.bottom-box.bottom+8;
    // Held at the rest, the window keeps what is under the rest's top; otherwise it moves on past a line it would cut.
    context.scrollTop=wholeLineScroll(context,context.scrollTop+Math.min(need,room),room<need?-1:1,context.scrollTop+room)}
  else if(row.top<box.top)context.scrollTop=wholeLineScroll(context,Math.max(0,context.scrollTop-(box.top-row.top)-8),-1);
  else if(context.scrollTop>0){
    // The row is in view, but what sits above it may have changed height since (a rest's slot trading its content):
    // show a cut line whole if the row stays in view, else move on past it.
    const back=wholeLineScroll(context,context.scrollTop,-1);
    context.scrollTop=row.bottom+(context.scrollTop-back)<=box.bottom?back
      :wholeLineScroll(context,context.scrollTop,1,context.scrollTop+Math.max(0,row.top-box.top))}}
/** A scroll position for the context region that leaves no line cut at its top edge, under the segment bar: from
 *  `target`, `dir` 1 moves on past a cut line and -1 moves back to show it whole, never beyond `limit`. */

/** @param {HTMLElement} context @param {number} target @param {number} dir @param {number} [limit] */
function wholeLineScroll(context,target,dir,limit=Infinity){
  const origin=context.getBoundingClientRect().top-context.scrollTop;
  const lines=[...context.querySelectorAll("*")].filter(el=>!el.children.length&&el.getClientRects().length).map(el=>{
    const r=el.getBoundingClientRect();return{top:r.top-origin,bottom:r.bottom-origin}}).filter(r=>r.bottom-r.top>=1);
  const most=Math.min(limit,context.scrollHeight-context.clientHeight);
  let at=Math.max(0,Math.min(target,most));
  for(let i=0;i<8;i++){
    const cut=lines.filter(r=>r.top<at-0.5&&r.bottom>at+0.5);if(!cut.length)break;
    const next=dir>0?Math.max(...cut.map(r=>r.bottom)):Math.min(...cut.map(r=>r.top));
    if(next>most||next<0)break;
    at=next}
  return at}


return Object.freeze({sizeDeck:sizeFocusDeck,syncFloor:syncFocusFloor,sizeCard:sizeFocusCard,wholeLineScroll,
  dispose(){focusFloorWatch?.disconnect();focusFloorWatch=null;focusFloorWatched=[];}});
}
