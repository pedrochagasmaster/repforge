/** Focus-only fallback geometry; persisted selection crosses named commands. */
export function createFocusGestures({window,readModel,commands,motion=null}) {
  const document=window.document,Element=window.Element,performance=window.performance;
  const getComputedStyle=window.getComputedStyle.bind(window);
  const $=selector=>document.querySelector(selector);
  const reducedMotion=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const FOCUS_GAP=14,FOCUS_SLIDE_MS=210,DRAG_LOCK=10;
  let focusDrag=null,focusFlinging=false;
  const timers=new Set();
  function fallbackFocusLater(callback,delay) {
    const timer=window.setTimeout(()=>{timers.delete(timer);callback();},delay);
    timers.add(timer);return timer;
  }
  function focusCanGo(dir) {const model=readModel();return dir<0?model.canPrevious:model.canNext;}
function fallbackFocusAnimateTo(dir){
  if(focusFlinging||!focusCanGo(dir))return false;
  const track=focusTrack(),deck=$("#focusDeck");
  if(!track||reducedMotion())return commands.go(dir);
  focusFlinging=true;
  deck?.classList.add("is-swiping");
  track.classList.add("is-settling");
  focusSetTrack(track,-dir*focusStep());
  fallbackFocusLater(()=>{
    focusFlinging=false;
    track.classList.remove("is-settling");
    deck?.classList.remove("is-swiping");
    commands.go(dir)},FOCUS_SLIDE_MS);
  return true}

function focusSetTrack(track,dx){
  if(track)track.style.transform=`translate3d(${dx}px,0,0)`}

function focusDragStart(e){
  if(focusFlinging||!readModel().active)return;
  if(e.pointerType==="mouse"&&e.button!==0)return;
  const el=e.target instanceof Element?e.target:null;
  // Fields and copyable prose keep native selection. Control surfaces still
  // drag, with the click after a committed drag swallowed.
  if(el&&el.closest("input,select,textarea,[contenteditable]"))return;
  if(el&&e.pointerType==="mouse"&&isNativeTextSelectionTarget(el))return;
  const card=focusCard(),track=focusTrack();if(!card||!track)return;
  const ledger=card.querySelector(".fcard__ledger");
  focusDrag={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,axis:null,card,track,
    scrolls:[ledger,card.querySelector(".fcard__context")].some(el=>el&&el.scrollHeight>el.clientHeight+1),
    vx:0,lastX:e.clientX,lastT:e.timeStamp||performance.now()}}

function focusDragMove(e){
  if(!focusDrag||e.pointerId!==focusDrag.id)return;
  const mx=e.clientX-focusDrag.x,my=e.clientY-focusDrag.y;
  if(!focusDrag.axis){
    // A gesture is only surrendered to the scroller when there is something to
    // scroll, and only when it is emphatically vertical. Otherwise it keeps waiting
    // for the horizontal axis to win: a thumb swipe usually starts with a vertical
    // nudge, and the first touch sample of a fast one lands far from the start, so
    // judging on that first sample throws the whole gesture away.
    if(focusDrag.scrolls&&Math.abs(my)>=18&&Math.abs(my)>Math.abs(mx)*2){focusDrag=null;return}
    if(Math.abs(mx)<DRAG_LOCK||Math.abs(mx)<=Math.abs(my))return;
    focusDrag.axis="x";
    focusDrag.card.classList.add("is-dragging");
    $("#focusDeck")?.classList.add("is-swiping");
    // Anchor to where the axis locked so the card doesn't jump by the slop.
    focusDrag.x=e.clientX-Math.sign(mx)*DRAG_LOCK}
  const now=e.timeStamp||performance.now(),dt=now-focusDrag.lastT;
  if(dt>0){focusDrag.vx=(e.clientX-focusDrag.lastX)/dt;focusDrag.lastX=e.clientX;focusDrag.lastT=now}
  const dx=e.clientX-focusDrag.x;
  const blocked=(dx>0&&!focusCanGo(-1))||(dx<0&&!focusCanGo(1));
  focusDrag.dx=blocked?dx*.28:dx;
  // The whole track moves as one, the way a paged view does — card and the
  // stack it sits on together.
  focusSetTrack(focusDrag.track,focusDrag.dx)}

function focusSettle(track,card,deck,{from=0,velocity=0}={}){
  card?.classList.remove("is-dragging");
  const done=()=>{track?.classList.remove("is-settling");deck?.classList.remove("is-swiping")};
  // A swipe that stopped short is caught rather than switched off: the track
  // springs home from wherever the thumb left it, carrying its velocity, so a
  // half-hearted push and an abandoned flick read as different gestures.
  track?.classList.add("is-settling");
  const run=motion?.settleFocusDeck(track,{from,velocity});
  if(run){run.then(done);return}
  focusSetTrack(track,0);
  fallbackFocusLater(done,220)}

function focusDragEnd(e){
  if(!focusDrag||(e&&e.pointerId!=null&&e.pointerId!==focusDrag.id))return;
  const{card,track,dx,axis,vx}=focusDrag;focusDrag=null;
  const deck=$("#focusDeck");
  if(axis!=="x")return;
  if(Math.abs(dx)>8)commands.swallowNextClick();
  const dir=dx<0?1:-1,width=card.offsetWidth||320;
  // A short flick counts as much as a long drag, as long as it kept going the way
  // it was thrown (0.4px/ms is roughly a deliberate flick).
  const flick=Math.abs(vx)>=.4&&Math.sign(vx)===Math.sign(dx)&&Math.abs(dx)>=28;
  const past=Math.abs(dx)>=Math.min(110,Math.max(56,width*.2))||flick;
  if(e?.type==="pointercancel"||!past||!focusCanGo(dir)){focusSettle(track,card,deck,{from:dx,velocity:vx});return}
  card.classList.remove("is-dragging");
  commands.navigate(dir)}

function focusCard(){return $("#workout.is-focus .exercise.is-current")}

function focusTrack(){return $("#focusTrack")}
/** How far the track travels to bring a neighbour card into place. */

function focusStep(){const card=focusCard();return (card?.offsetWidth||320)+FOCUS_GAP}

function isNativeTextSelectionTarget(target){
  for(let el=target;el;el=el.parentElement){
    const policy=getComputedStyle(el).userSelect;
    if(policy==="none")return false;
    if(policy==="text")return true}
  return false}

function cancel() {
  for(const timer of timers)window.clearTimeout(timer);timers.clear();focusFlinging=false;
  const drag=focusDrag;focusDrag=null;drag?.card?.classList.remove("is-dragging");
  const track=drag?.track||focusTrack();focusSetTrack(track,0);track?.classList.remove("is-settling");
  $("#focusDeck")?.classList.remove("is-swiping");
}
return Object.freeze({navigate:fallbackFocusAnimateTo,dragStart:focusDragStart,dragMove:focusDragMove,dragEnd:focusDragEnd,
  card:focusCard,track:focusTrack,step:focusStep,setTrack:focusSetTrack,canGo:focusCanGo,cancel,dispose:cancel});
}
