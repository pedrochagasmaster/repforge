import {escapeHtml as esc} from '../format.js';
/** @typedef {NonNullable<Awaited<ReturnType<ReturnType<typeof import('./inputs.js').createFocusInputs>['toggleSet']>>>} SetOutcome */
/** Live Focus commands and transient browser listeners have one abortable owner.
 * Durable commands settle after disposal; a stale lifetime cannot rerender or
 * move keyboard focus. Peek cards never receive interactive bindings.
 * @param {{window:Window & typeof globalThis,focus:ReturnType<typeof import('./state.js').createFocusState>,clock:ReturnType<typeof import('./rest.js').createRestClock>,presentation:ReturnType<typeof import('./presentation.js').createFocusPresentation>,inputs:ReturnType<typeof import('./inputs.js').createFocusInputs>,controls:ReturnType<typeof import('./control-focus.js').createControlFocus>,geometry:ReturnType<typeof import('./geometry.js').createFocusGeometry>,dom:ReturnType<typeof import('./dom.js').createFocusDom>,rest:ReturnType<typeof import('./rest-slot.js').createRestSlot>,motion:ReturnType<typeof import('../../platform/motion.js').createMotion>,navigation:ReturnType<typeof import('./navigation.js').createFocusNavigation>,commands:Pick<ReturnType<typeof import('../../app/workout.js').createFocusWorkoutCommands>,'restoreExercises'>,readFrame:()=>import('./dom.js').Frame,copy:{t:(key:string,values?:Record<string,unknown>)=>string},help:{term:(name:string|undefined,anchor:HTMLElement)=>void},feedback:{suggestionFailure:(id:string,result:SetOutcome['result'])=>unknown,draftIssues:(issues:unknown)=>unknown},exerciseActions:{open:(id:string)=>unknown},onSetApplied:()=>void}} options */
export function createFocusBindings({window,focus,clock,presentation,inputs,controls,geometry,dom,rest,motion,navigation,commands,readFrame,copy:{t},help,feedback,exerciseActions,onSetApplied}){
  const document=window.document;
  /** @type {AbortController|null} */let mountAbort=null;
  /** @type {AbortController|null} */let bindingsAbort=null;
  let lifetime=0,resize=0;
  const card=()=>document.querySelector(/** @type {'div'} */('#workout.is-focus .exercise.is-current'));
  /** @param {string} selector */
  const live=selector=>[...document.querySelectorAll(/** @type {'button'} */(`#workout ${selector}`))].filter(element=>!element.closest('.is-peek'));
  function openMore(){
    const voice=document.querySelector('#voiceBtn'),menu=document.querySelector('#woOverflow');
    if(voice&&!voice.classList.contains('hidden')){
      if(menu&&!document.querySelector('#woExActions')){
        const item=document.createElement('button');item.type='button';item.id='woExActions';item.className='wo-overflow__item';item.textContent=t('ex.actions.title');
        item.onclick=()=>{setWorkoutOverflow(document,false);const id=card()?.dataset.ex;if(id)exerciseActions.open(id);};menu.prepend(item);
      }
      setWorkoutOverflow(document,!!menu?.classList.contains('hidden'));return;
    }
    const id=card()?.dataset.ex;if(id)exerciseActions.open(id);
  }
  /** @param {Event} event */
  function dismissMore(event){
    const menu=document.querySelector('#woOverflow');if(!menu||menu.classList.contains('hidden'))return;
    const target=event.target instanceof window.Element?event.target:null;
    if(target&&(menu.contains(target)||target.closest('#woOverflowBtn')))return;
    setWorkoutOverflow(document,false);
  }
  function mount(){
    if(mountAbort)return;mountAbort=new window.AbortController();const signal=mountAbort.signal;
    controls.mount();
    document.querySelector('#woOverflowBtn')?.addEventListener('click',event=>{event.stopPropagation();openMore();},{signal});
    document.addEventListener('click',dismissMore,{signal});document.addEventListener('touchstart',dismissMore,{passive:true,signal});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'){setWorkoutOverflow(document,false);presentation.effort.close();}},{signal});
    document.addEventListener('pointerdown',event=>{
      const target=event.target instanceof window.Element?event.target:null;
      if(!target?.closest('.effortpop, [data-effspin], [data-effstep]'))presentation.effort.close();
    },{capture:true,signal});
    window.addEventListener('resize',()=>{window.clearTimeout(resize);resize=window.setTimeout(()=>geometry.sizeDeck(),120);},{signal});
    document.addEventListener('keydown',event=>{
      if(!readFrame().active||event.metaKey||event.ctrlKey||event.altKey)return;
      const target=event.target instanceof window.Element?event.target:null;
      if(target?.closest('button,a,input,select,textarea,[contenteditable],[role=spinbutton]'))return;
      if(event.key==='ArrowRight')motion.navigate(1);else if(event.key==='ArrowLeft')motion.navigate(-1);
    },{signal});
  }
  /** @param {HTMLElement} button */
  function selectField(button){
    const key=button.dataset.set,id=button.dataset.shelfField,frame=readFrame();if(!key||!id||!frame.active)return;
    const split=key.lastIndexOf('_'),definitions=presentation.values.definitions(frame.context.draft,key.slice(0,split),Number(key.slice(split+1)));
    const ui=focus.shelfFor(key,definitions[0]?'metric_'+definitions[0].id:'reps');
    const effort=id==='rir'&&frame.context.effortMode,fromRest=presentation.rest.padsOn(false);
    if(fromRest)clock.revealFieldPads();
    if(ui.field===id&&effort){presentation.effort.toggle(key);if(fromRest)rest.sync();return;}
    if(ui.field===id&&!ui.editing){focus.shelfSelect(key,id,true);dom.refreshShelf({focus:id});return;}
    presentation.effort.close();focus.shelfSelect(key,id,false);dom.refreshShelf({focus:id});
  }
  function bind(){
    mount();bindingsAbort?.abort();bindingsAbort=new window.AbortController();const signal=bindingsAbort.signal,version=lifetime;
    inputs.bind();
    const host=document.querySelector(/** @type {'div'} */('#workout'));if(host)rest.bindControls(host);
    for(const button of live('.term'))button.addEventListener('click',event=>{event.stopPropagation();help.term(button.dataset.term,button);},{signal});
    for(const button of live('.saveset'))button.addEventListener('click',async()=>{
      try{
        const outcome=await inputs.toggleSet(button.dataset.save);if(!outcome||version!==lifetime)return;
        const {result,target,editing}=outcome;
        if(result.status==='refresh-failed'){feedback.suggestionFailure(target.exerciseInstanceId,result);return;}
        if(result.status==='domain-error'&&(!('phase' in result)||result.phase!=='suggestion-refresh')){
          const error=result.error,issues=error!==null&&typeof error==='object'&&'issues' in error&&Array.isArray(error.issues)?error.issues:undefined;
          feedback.draftIssues(issues);return;}
        if(result.status!=='applied')return;
        dom.render();onSetApplied();if(result.nowDone)controls.handoff(editing?'row':'next',{exId:target.exerciseInstanceId,n:target.ordinal});
      }finally{focus.finishRestRender();}
    },{signal});
    for(const button of live('[data-warm]'))button.addEventListener('click',async()=>{const result=await inputs.toggleWarmup(button.dataset.warm);if(version===lifetime&&result?.status==='applied')dom.render();},{signal});
    for(const button of live('[data-shelf-field]'))button.addEventListener('click',()=>selectField(button),{signal});
    document.querySelector('#workout .skipbar__show')?.addEventListener('click',async()=>{if(await commands.restoreExercises()&&version===lifetime)dom.render();},{signal});
    const frame=readFrame(),list=frame.active?frame.context.list:[],at=list.length?Math.min(focus.index,list.length-1):0;
    const progress=document.querySelector('#woProgress');
    if(progress){
      progress.classList.remove('hidden');
      progress.innerHTML=`<span class="visually-hidden">${esc(t('today.exercise_of',{n:list.length?at+1:0,m:list.length}))}</span>`+
        `<div class="segbar segbar--ex" data-progress-dimension="exercise-set" data-progress-scope="workout-exercise-order">`+
        list.map((_,index)=>index===at?`<span class="segbar__seg is-current" data-focusgo="${index}" aria-hidden="true"><span class="segbar__bar"></span></span>`:
          `<button type="button" class="segbar__seg${index<at?' is-done':''}" data-focusgo="${index}" aria-label="${esc(t('today.exercise_of',{n:index+1,m:list.length}))}"><span class="segbar__bar" aria-hidden="true"></span></button>`).join('')+'</div>';
      for(const button of progress.querySelectorAll(/** @type {'button'} */('button[data-focusgo]')))button.addEventListener('click',()=>navigation.jump(Number(button.dataset.focusgo)),{signal});
    }
    live('[data-ffinish]')[0]?.addEventListener('click',()=>document.querySelector(/** @type {'form'} */('#logForm'))?.requestSubmit(),{signal});
    for(const button of live('[data-fnext],[data-fnextrow]'))button.addEventListener('click',()=>motion.navigate(1),{signal});
    for(const button of live('[data-ledgermore]'))button.addEventListener('click',()=>dom.toggleLedger(button),{signal});
    for(const button of live('[data-editn]'))button.addEventListener('click',async()=>{
      const result=await inputs.reopenSet(button.dataset.editex,Number(button.dataset.editn));if(version!==lifetime||result?.status!=='applied')return;
      dom.render();controls.handoff('cta');
    },{signal});
    for(const button of live('[data-fcancel]'))button.addEventListener('click',async()=>{
      const outcome=await inputs.cancelEdit();if(version!==lifetime||outcome?.result.status!=='applied')return;
      dom.render();controls.handoff('row',{exId:outcome.exId,n:outcome.n});
    },{signal});
    document.body.classList.toggle('is-focus-wo',frame.active);presentation.rest.chrome(frame.active,frame.active&&frame.restEnabled);
  }
  function dispose(){
    lifetime++;mountAbort?.abort();bindingsAbort?.abort();mountAbort=null;bindingsAbort=null;window.clearTimeout(resize);
    setWorkoutOverflow(document,false);inputs.dispose();controls.dispose();
  }
  return {mount,bind,dispose,openMore};
}
/** Overflow remains callable before workout owners exist (route/Voice exits).
 * @param {Document} document @param {boolean} open */
export function setWorkoutOverflow(document,open){
  const menu=document.querySelector('#woOverflow');if(!menu)return;
  menu.classList.toggle('hidden',!open);document.querySelector('#woOverflowBtn')?.setAttribute('aria-expanded',open?'true':'false');
}
