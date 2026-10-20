/** @typedef {ReturnType<ReturnType<typeof import('../../platform/motion.js').createMotion>['trackSheetGesture']>} SheetRun
 * @typedef {import('../shell-contracts.js').ModalRecord & {motion?:SheetRun|null}} SheetRecord
 * @typedef {{id:number,x:number,y:number,dy:number,live:boolean,rec:SheetRecord,vy:number,lastY:number,lastT:number,motion?:SheetRun|null}} SheetDrag
 */
/** Bottom-sheet drag state belongs to this presentation instance. The shell's
 * own Escape action remains the only dismissal command. Construction has no IO.
 * @param {{window:Window & typeof globalThis,readModal:()=>SheetRecord|null,readMotion:()=>{trackSheetGesture:(sheet:HTMLElement,scrim:HTMLElement|null)=>SheetRun}|null,swallowNextClick:()=>void}} options
 */
export function createSheetGestures({window,readModal,readMotion,swallowNextClick}){
const {Element,performance}=window;
const getComputedStyle=window.getComputedStyle.bind(window);
let disposed=false;
/** @type {SheetDrag|null} */
let sheetDrag=null;
const SHEET_DRAG_LOCK=8;
/** True when the gesture belongs to a scroller inside the sheet: something the
 *  lifter has already scrolled down keeps the drag, and scrolls back up. */
/** @param {Element} target @param {HTMLElement} sheet */
function sheetScrollHeld(target,sheet){
  for(let n=/** @type {Element|null} */(target);n instanceof Element&&n!==sheet;n=n.parentElement){
    if(n.scrollHeight>n.clientHeight+1&&n.scrollTop>0)return true}
  return false}
/* user-select is inherited by WebKit/Chromium, but other engines can report
 * auto on a child of selectable prose. Stop at a control's explicit none. */
/** @param {Element|null} target */
function isNativeTextSelectionTarget(target){
  for(let el=target;el;el=el.parentElement){
    const policy=getComputedStyle(el).userSelect;
    if(policy==="none")return false;
    if(policy==="text")return true}
  return false}
/** @param {PointerEvent} e */
function sheetDragStart(e){
  if(disposed||sheetDrag)return;
  if(e.pointerType==="mouse"&&e.button!==0)return;
  const rec=readModal();
  if(!rec||rec.closing||typeof rec.onEscape!=="function")return;
  if(!rec.el?.classList.contains("sheet"))return;
  const target=e.target instanceof Element?e.target:null;
  if(!target||!rec.el.contains(target))return;
  // A mouse inside a text field is selecting, not swiping. A thumb in one has no
  // other use for a downward drag once the field is already at its top.
  if(e.pointerType==="mouse"&&(target.closest("input,select,textarea,[contenteditable]")||isNativeTextSelectionTarget(target)))return;
  if(sheetScrollHeld(target,rec.el))return;
  sheetDrag={id:e.pointerId,x:e.clientX,y:e.clientY,dy:0,live:false,rec,
    vy:0,lastY:e.clientY,lastT:e.timeStamp||performance.now()}}
/** @param {PointerEvent} e */
function sheetDragMove(e){
  if(!sheetDrag||e.pointerId!==sheetDrag.id)return;
  const rec=sheetDrag.rec;
  if(readModal()!==rec||rec.closing){sheetDragEnd();return}
  const dy=e.clientY-sheetDrag.y,dx=e.clientX-sheetDrag.x;
  if(!sheetDrag.live){
    // Upwards or sideways is somebody else's gesture; only a downward push takes
    // the sheet, and only once it has cleared the slop a resting thumb wanders.
    if(dy<=-SHEET_DRAG_LOCK||(Math.abs(dx)>=SHEET_DRAG_LOCK&&Math.abs(dx)>Math.abs(dy))){sheetDrag=null;return}
    if(dy<SHEET_DRAG_LOCK)return;
    sheetDrag.live=true;
    rec.el.classList.add("is-dragging");
    rec.scrim?.classList.add("is-dragging");
    // A sheet grabbed again while it is still springing back has a spring
    // painting its transform. Stop that one first: two writers on the same
    // property means whichever finishes last wins, and the loser is the thumb.
    if(rec.motion){rec.motion.cancel();rec.motion=null}
    sheetDrag.motion=readMotion()?.trackSheetGesture(rec.el,rec.scrim)||null;
    // The sheet can also be torn down mid-gesture — Escape, a save, a tour step
    // — and whatever cleans it up has to be able to stop the animation too.
    rec.motion=sheetDrag.motion;
    // Anchor where the drag was recognised, so the sheet doesn't jump by the slop.
    sheetDrag.y=e.clientY-SHEET_DRAG_LOCK}
  const now=e.timeStamp||performance.now(),dt=now-sheetDrag.lastT;
  if(dt>0){sheetDrag.vy=(e.clientY-sheetDrag.lastY)/dt;sheetDrag.lastY=e.clientY;sheetDrag.lastT=now}
  sheetDrag.dy=Math.max(0,e.clientY-sheetDrag.y);
  // Motion holds the sheet's position in a value it can spring from later, so
  // the release carries the thumb's velocity. Without the runtime the sheet is
  // placed the same way it always was and the stylesheet finishes the gesture.
  if(sheetDrag.motion)sheetDrag.motion.follow(sheetDrag.dy);
  else{
    rec.el.style.transform=`translate3d(0,${sheetDrag.dy}px,0)`;
    // The scrim thins as the sheet leaves, so the page behind is already coming back.
    if(rec.scrim)rec.scrim.style.opacity=String(Math.max(0,1-sheetDrag.dy/(rec.el.offsetHeight||1)))}}
/** Hand the sheet back to the stylesheet. Dropping the inline transform in the
 *  same tick as the class restores the transition from wherever the thumb left
 *  it, so the sheet either springs back or carries on down — never cuts. */
/** @param {SheetRecord} rec */
function sheetDragRelease(rec){
  rec.el.classList.remove("is-dragging");
  if(rec.motion){rec.motion.cancel();rec.motion=null}
  rec.el.style.transform="";
  rec.scrim?.classList.remove("is-dragging");
  if(rec.scrim)rec.scrim.style.opacity=""}
/** @param {{pointerId?:number,type?:string}|undefined} [e] */
function sheetDragEnd(e){
  if(!sheetDrag||(e&&e.pointerId!=null&&e.pointerId!==sheetDrag.id))return;
  const{rec,dy,vy,live,motion}=sheetDrag;sheetDrag=null;
  if(!live)return;
  if(e?.type==="pointercancel"){sheetDragRelease(rec);return}
  // The drag ends over whatever the thumb started on, so a button under it must
  // not also fire.
  if(dy>SHEET_DRAG_LOCK)swallowNextClick();
  // A deliberate throw counts as much as a long push (0.5px/ms is a flick), and
  // anything short of either is the lifter changing their mind.
  const flick=vy>=.5&&dy>=32;
  const dismiss=flick||dy>=Math.min(160,Math.max(64,(rec.el.offsetHeight||0)*.32));
  const gone=readModal()!==rec||rec.closing;
  if(!motion){
    // No runtime: the stylesheet finishes the gesture exactly as it did before.
    sheetDragRelease(rec);
    if(!gone&&dismiss)rec.onEscape?.();
    return}
  rec.el.classList.remove("is-dragging");
  rec.scrim?.classList.remove("is-dragging");
  if(gone){sheetDragRelease(rec);return}
  // The sheet keeps the speed it was let go at: a flick carries it the rest of
  // the way out, a change of mind is caught and put back. Either way `onEscape`
  // is the sheet's own dismiss, so a swipe can never close something a tap
  // could not.
  if(dismiss){motion.dismiss({velocity:vy});rec.onEscape?.()}
  else motion.settle({velocity:vy}).finally(()=>{if(rec.motion===motion)rec.motion=null})}

/** @param {SheetRecord} rec */
function release(rec){const owned=sheetDrag?.rec===rec;if(owned)sheetDrag=null;if(owned||rec.motion)sheetDragRelease(rec)}
function cancel(){if(sheetDrag){const rec=sheetDrag.rec;sheetDrag=null;sheetDragRelease(rec)}}
return Object.freeze({dragStart:sheetDragStart,dragMove:sheetDragMove,dragEnd:sheetDragEnd,
 isNativeTextSelectionTarget,release,cancel,dispose(){cancel();disposed=true}});
}
