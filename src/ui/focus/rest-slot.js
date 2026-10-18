/** @typedef {Parameters<ReturnType<typeof import('./presentation.js').createFocusPresentation>['capture']>[0]} Frame
 * @typedef {{exId:string|undefined,slot:{mode:string|undefined,html:string,height:number}|null,pads:{mode:string|undefined,html:string,cls:string}|null}} Before
 */
/** Rest-slot DOM lifetime over one captured acknowledged Workout projection.
 * The clock and its commands remain the existing owners. A replacement notifies
 * the enclosing view to bind its new field controls; it never publishes data.
 * @param {{window:Window & typeof globalThis,focus:ReturnType<typeof import('./state.js').createFocusState>,presentation:ReturnType<typeof import('./presentation.js').createFocusPresentation>,motion:ReturnType<typeof import('../../platform/motion.js').createMotion>,effects:ReturnType<typeof import('./effects.js').createFocusEffects>,geometry:ReturnType<typeof import('./geometry.js').createFocusGeometry>,readFrame:()=>Frame|null,actions:{rest:(action:string|undefined)=>void,why:(exerciseId:string|undefined,anchor:HTMLElement)=>void},onPadsReplaced:()=>void}} options */
export function createRestSlot({window,focus,presentation,motion,effects,geometry,readFrame,actions,onPadsReplaced}){
  const document=window.document,controller=new AbortController();
  /** @type {WeakSet<HTMLElement>} */const bound=new WeakSet();
  let disposed=false;
  const card=()=>document.querySelector(/** @type {'div'} */('#workout.is-focus .exercise.is-current'));
  /** @param {HTMLElement} root */
  function bindControls(root){
    for(const button of root.querySelectorAll(/** @type {'button'} */('[data-rest-act],[data-why]'))){
      if(bound.has(button))continue;bound.add(button);
      button.addEventListener('click',event=>{
        if(button.hasAttribute('data-rest-act'))actions.rest(button.dataset.restAct);
        else{event.stopPropagation();actions.why(button.dataset.why,button);}
      },{signal:controller.signal});
    }
  }
  /** @param {unknown} moved */
  function settle(moved){Promise.resolve(moved).then(()=>{if(!disposed)geometry.sizeCard(card());},()=>{});}
  /** @param {HTMLElement} slot @param {string} mode @param {string} next */
  function swapSlot(slot,mode,next){
    const old=effects.liveHtml(slot),animated=effects.enabled();
    settle(motion.animateSlot(slot,()=>{
      slot.innerHTML=next;slot.dataset.rest=mode;bindControls(slot);
      if(animated)effects.crossfadeIn(slot,old,'fx-slot__out');
    }));
  }
  /** @param {HTMLElement} host @param {HTMLElement} pads @param {string} markup */
  function swapPads(host,pads,markup){
    const held=pads.contains(document.activeElement),old=effects.liveHtml(pads),className=pads.className;
    const holder=document.createElement('div');holder.innerHTML=markup;
    const next=holder.firstElementChild;if(!(next instanceof window.HTMLElement))return;
    pads.replaceWith(next);onPadsReplaced();bindControls(next);effects.crossfadeIn(next,old,className);
    if(held)host.querySelector(/** @type {'button'} */('.focus-shelf .shelf__field.is-sel .shelf__fieldbtn'))?.focus({preventScroll:true});
  }
  function sync(){
    const host=card(),frame=readFrame();if(disposed||!host||!frame)return;
    const base=frame.list.find(ex=>ex.id===host.dataset.ex);if(!base)return;
    const ex=frame.query.sessionExercise(base),n=focus.selectExercise(ex,frame.committed).active;
    const editing=focus.edit?.exId===ex.id;
    if(!focus.restRenderPending&&n){
      const selected=presentation.capture(frame),recommendation=frame.query.recommendation(ex),previous=frame.query.last(ex);
      const slot=host.querySelector(/** @type {'div'} */('.fx-slot')),pads=host.querySelector(/** @type {'div'} */('.shelf__pads'));
      const mode=presentation.rest.slotMode(editing);
      if(slot&&slot.dataset.rest!==mode){
        const cue=selected.cue(ex,n,recommendation,editing);
        swapSlot(slot,mode,selected.slotInner(ex,n,recommendation,cue,mode,{peek:false,name:selected.exerciseName(ex)}));
      }
      if(pads&&pads.dataset.pads!==(presentation.rest.padsOn(editing)?'rest':'field'))
        swapPads(host,pads,selected.padsHtml(ex,n,recommendation,previous));
    }
    presentation.rest.syncNumbers(host);
  }
  /** @returns {Before|null} */
  function capture(){
    const host=card();if(!host)return null;
    const slot=host.querySelector(/** @type {'div'} */('.fx-slot')),pads=host.querySelector(/** @type {'div'} */('.shelf__pads'));
    return {exId:host.dataset.ex,
      slot:slot?{mode:slot.dataset.rest,html:effects.liveHtml(slot),height:slot.getBoundingClientRect().height}:null,
      pads:pads?{mode:pads.dataset.pads,html:effects.liveHtml(pads),cls:pads.className}:null};
  }
  /** @param {Before|null} before */
  function arrive(before){
    const host=card();if(disposed||!before||!host||host.dataset.ex!==before.exId||!effects.enabled())return;
    const slot=host.querySelector(/** @type {'div'} */('.fx-slot')),pads=host.querySelector(/** @type {'div'} */('.focus-shelf .shelf__pads'));
    if(slot&&before.slot&&slot.dataset.rest!==before.slot.mode){
      const previous=before.slot;slot.style.height=`${previous.height}px`;
      settle(motion.animateSlot(slot,()=>effects.crossfadeIn(slot,previous.html,'fx-slot__out')));
    }
    if(pads&&before.pads&&pads.dataset.pads!==before.pads.mode)effects.crossfadeIn(pads,before.pads.html,before.pads.cls);
  }
  function dispose(){disposed=true;controller.abort();}
  return {bindControls,sync,capture,arrive,settle,dispose};
}
