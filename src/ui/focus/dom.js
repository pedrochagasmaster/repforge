import {escapeHtml as esc,formatProgramContext,formatCycleLabel} from '../format.js';
/** @typedef {Parameters<ReturnType<typeof import('./presentation.js').createFocusPresentation>['capture']>[0]} Context
 * @typedef {{active:false}|{active:true,context:Context,hiddenCount:number,restEnabled:boolean,programName:unknown,cycle:import('../format.js').ProgramCycle,deload:boolean,dayLabel:string}} Frame
 */
/** Card rebuilds, ledger disclosure and shelf refresh share one DOM lifetime.
 * Rendering captures acknowledged facts once; it does not hydrate or publish a
 * draft. Controls and other page widgets receive explicit replacement events.
 * @param {{window:Window & typeof globalThis,focus:ReturnType<typeof import('./state.js').createFocusState>,presentation:ReturnType<typeof import('./presentation.js').createFocusPresentation>,controls:ReturnType<typeof import('./control-focus.js').createControlFocus>,geometry:ReturnType<typeof import('./geometry.js').createFocusGeometry>,effects:ReturnType<typeof import('./effects.js').createFocusEffects>,rest:ReturnType<typeof import('./rest-slot.js').createRestSlot>,motion:ReturnType<typeof import('../../platform/motion.js').createMotion>,readFrame:()=>Frame,copy:{t:(key:string,values?:Record<string,unknown>)=>string},guides:{refreshAnchor:()=>unknown},exercise:{open:(id:string,from:'log')=>unknown},onControlsReplaced:()=>void,onRendered:(event:{active:boolean})=>void}} options */
export function createFocusDom({window,focus,presentation,controls,geometry,effects,rest,motion,readFrame,copy:{t},guides,exercise,onControlsReplaced,onRendered}){
  const document=window.document;
  let disposed=false;
  const card=()=>document.querySelector(/** @type {'div'} */('#workout.is-focus .exercise.is-current'));
  function openRow(){
    const host=card(),ledger=host?.querySelector('.fcard__ledger'),open=ledger?.querySelector(/** @type {'div'} */('.ledgerline--open'));
    return host&&ledger&&open?{exId:host.dataset.ex,n:Number(open.dataset.lrow),rect:(ledger.querySelector('.ledgerline__ring')||open).getBoundingClientRect()}:null;
  }
  /** @param {Frame & {active:true}} frame @param {number} at */
  function header(frame,at){
    const title=document.querySelector(/** @type {'div'} */('#woDayTitle')),base=frame.context.list[at];
    const ex=base?frame.context.query.sessionExercise(base):null;
    if(title&&ex){
      const name=presentation.capture(frame.context).exerciseName(ex);
      title.setAttribute('aria-label',name);
      title.innerHTML=`<button type="button" class="wo-head__name" data-exopen="${esc(ex.id)}" aria-label="${esc(t('log.open_exercise_aria',{name}))}">${esc(name)}</button>`;
      const button=title.querySelector('button');if(button)button.onclick=()=>exercise.open(ex.id,'log');
    }else if(title){title.removeAttribute('aria-label');title.textContent=frame.dayLabel;}
    const sub=document.querySelector('#woDaySub');
    if(sub){sub.textContent=formatCycleLabel(frame.cycle,frame.deload,t);sub.classList.toggle('is-deload',frame.deload);}
    syncWorkoutMore(document);
  }
  function render(){
    if(disposed)return;
    const frame=readFrame();document.body.classList.toggle('is-focus-wo',frame.active);
    if(!frame.active){focus.finishFrame();onRendered({active:false});return;}
    const context=frame.context,at=focus.beginFrame(context.list),base=context.list[at];
    const current=base?context.query.sessionExercise(base):null;
    const logContext=document.querySelector('#logContext');
    if(logContext)logContext.textContent=frame.programName||frame.cycle.current!=null||frame.cycle.isComplete?formatProgramContext(frame.programName,frame.cycle,t):t('log.context.today');
    const host=document.querySelector(/** @type {'div'} */('#workout'));if(!host){focus.finishFrame();return;}
    host.classList.add('is-focus');
    const previousOpen=effects.enabled()?openRow():null,before=effects.enabled()?rest.capture():null;
    const oldCard=card(),held=oldCard?.contains(document.activeElement)?{exerciseId:oldCard.dataset.ex,key:controls.key(document.activeElement)}:null;
    const banner=frame.hiddenCount?`<div class="skipbar">${esc(t('log.skipbar',{n:frame.hiddenCount}))} <button type="button" class="skipbar__show">${esc(t('log.skipbar.show_all'))}</button></div>`:'';
    const selected=presentation.capture(context);
    host.innerHTML=banner+(current?selected.deck(current,context.query.recommendation(current),context.query.last(current),at):'');
    focus.finishFrame();onControlsReplaced();
    if(held&&card()?.dataset.ex===held.exerciseId)controls.restore(held.key);
    header(frame,at);onRendered({active:true});geometry.sizeDeck();effects.settleBeats(host);
    if(previousOpen){
      const next=card(),open=next?.querySelector(/** @type {'div'} */('.fcard__ledger .ledgerline--open'));
      if(next&&open&&next.dataset.ex===previousOpen.exId&&Number(open.dataset.lrow)!==previousOpen.n)effects.travelOutline(open,previousOpen.rect,'ledgerline');
    }
    rest.arrive(before);
  }
  /** @param {{focus?:string|null}} [options] */
  function refreshShelf({focus:target=null}={}){
    const host=card(),frame=readFrame();if(disposed||!host||!frame.active)return false;
    const context=frame.context,base=context.list.find(ex=>ex.id===host.dataset.ex);if(!base)return false;
    const ex=context.query.sessionExercise(base),at=Math.max(0,context.list.findIndex(item=>item.id===ex.id));
    const allDone=context.list.every(item=>{for(let n=1;n<=item.sets;n++)if(!context.committed.has(`${item.id}_${n}`))return false;return true;});
    const old=host.querySelector(/** @type {'div'} */('.focus-shelf'));if(!old)return false;
    const pads=old.querySelector(/** @type {'div'} */('.shelf__pads'));
    const before=pads?{mode:pads.dataset.pads,html:effects.liveHtml(pads),className:pads.className}:null;
    const selected=old.querySelector(/** @type {'div'} */('.shelf__field.is-sel')),ring=old.querySelector('.shelf__ring');
    /** @param {HTMLElement|null} element */const identity=element=>element?`${element.dataset.field}:${element.dataset.metric||''}`:undefined;
    const previousField=identity(selected),previousSet=selected?.dataset.set,from=(ring||selected)?.getBoundingClientRect();
    const held=!target&&old.contains(document.activeElement)?controls.key(document.activeElement):null;
    old.outerHTML=presentation.capture(context).shelfHtml(ex,context.query.recommendation(ex),context.query.last(ex),{allDone,hasNext:at<context.list.length-1});
    onControlsReplaced();
    for(const [key,pending]of focus.pending){
      if(key.endsWith('_effort')){const setKey=key.slice(0,-7);if(controls.effortField(setKey))presentation.effort.pick(setKey,pending.value);}
      else{
        const input=controls.input(key);if(!input)continue;
        const field=input.closest(/** @type {'div'} */('.shelf__field')),setKey=field?.dataset.set||'',split=setKey.lastIndexOf('_');
        presentation.shelf.syncInput(input,{definitions:presentation.values.definitions(context.draft,setKey.slice(0,split),Number(setKey.slice(split+1)))});
      }
    }
    const nextPads=host.querySelector(/** @type {'div'} */('.focus-shelf .shelf__pads'));
    if(before&&nextPads&&nextPads.dataset.pads!==before.mode)effects.crossfadeIn(nextPads,before.html,before.className);
    const next=host.querySelector(/** @type {'div'} */('.focus-shelf .shelf__field.is-sel'));
    if(from&&next&&next.dataset.set===previousSet&&(ring||identity(next)!==previousField))effects.travelOutline(next,from,'shelf');
    geometry.syncFloor();guides.refreshAnchor();
    if(target){
      const shelf=host.querySelector('.focus-shelf');
      const control=target.startsWith('pad:')?shelf?.querySelector(/** @type {'button'} */(`.shelf__pad[data-dir="${target.slice(4)}"]`)):
        shelf?.querySelector(/** @type {'input'} */(`.shelf__field.is-editing .shelf__input[data-k$="_${target}"]`))||shelf?.querySelector(/** @type {'button'} */(`[data-shelf-field="${target}"]`));
      if(control){try{control.focus({preventScroll:true});}catch{}if(control instanceof window.HTMLInputElement)control.select();}
    }else if(held)controls.restore(held);
    return true;
  }
  /** @param {HTMLElement} button */
  function toggleLedger(button){
    const host=button.closest(/** @type {'div'} */('.exercise--focus')),frame=readFrame();if(disposed||!host||!frame.active)return;
    const context=frame.context,base=context.list.find(ex=>ex.id===host.dataset.ex);if(!base)return;
    const ex=context.query.sessionExercise(base),rows=host.querySelector(/** @type {'div'} */(`#ledger_${window.CSS.escape(ex.id)}`));if(!rows)return;
    const open=button.getAttribute('aria-expanded')!=='true';
    const moved=motion.animateSlot(rows,()=>{
      focus.discloseLedger(ex.id,open);
      rows.innerHTML=presentation.capture(context).ledgerRows(ex,context.query.recommendation(ex),context.query.last(ex),{effortMode:context.effortMode,peek:false});
      button.setAttribute('aria-expanded',open?'true':'false');button.classList.remove('is-fresh');onControlsReplaced();
    });
    if(!open)rest.settle(moved);
  }
  function dispose(){disposed=true;}
  return {render,refreshShelf,toggleLedger,dispose};
}

/** The overflow button changes role when Voice adds a second action.
 * @param {Document} document */
export function syncWorkoutMore(document){
  const more=document.querySelector('#woOverflowBtn'),voice=document.querySelector('#voiceBtn');if(!more)return;
  const menu=!!voice&&!voice.classList.contains('hidden');
  more.setAttribute('aria-haspopup',menu?'true':'dialog');more.setAttribute('aria-controls',menu?'woOverflow':'exActionsSheet');
  if(menu){if(!more.hasAttribute('aria-expanded'))more.setAttribute('aria-expanded','false');}else more.removeAttribute('aria-expanded');
}
