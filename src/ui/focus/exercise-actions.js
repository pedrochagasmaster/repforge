import {escapeHtml as esc,sameLoad} from '../format.js';
/** @typedef {import('../../app/workout-model.js').LogRow} LogRow
 * @typedef {import('../../app/workout-model.js').Exercise & {primary?:string,notes?:string}} ProgramExercise */
/** Exercise actions own their sheet and transient selected exercise. Repeating,
 * role changes, restoration and skip are real named application commands.
 * @param {{window:Window & typeof globalThis,shell:Pick<ReturnType<typeof import('../shell.js').createShell>,'openModal'|'closeModal'|'activeModal'>,motion:Pick<ReturnType<typeof import('../../platform/motion.js').createMotion>,'reducedMotion'>,read:()=>{draft:import('../../training/workout-contracts.js').Draft|null,query:import('../../app/workout-model.js').WorkoutCapture,program:readonly ProgramExercise[]},commands:ReturnType<typeof import('../../app/workout.js').createWorkoutExerciseCommands>,labels:{exercise:ReturnType<typeof import('../exercise-labels.js').createExerciseLabels>['exercise'],muscles:(value:string)=>string},format:{load:(value:unknown)=>string},copy:{t:(key:string,values?:Record<string,unknown>)=>string,plural:(count:number,word:string)=>string},navigate:{substitute:(id:string)=>unknown,notes:(id:string)=>unknown},onChanged:()=>void,toast:(message:string)=>void}} options */
export function createExerciseActions({window,shell,motion,read,commands,labels,format,copy:{t,plural},navigate,onChanged,toast}){
  const document=window.document;
  /** @type {string|null} */let activeId=null;
  /** @type {AbortController|null} */let mounted=null;
  /** @type {AbortController|null} */let rendered=null;
  let disposed=false,openingFrame=0;
  /** @param {string} selector */const $=selector=>document.querySelector(/** @type {'div'} */(selector));
  /** @param {LogRow[]} sets */
  function previousLine(sets){
    const rows=sets.filter(item=>Number(item.reps)>0);if(!rows.length)return '';
    if(rows.every(item=>item.load==null))return rows.map(item=>item.reps).join(', ');
    return rows.every(item=>sameLoad(Number(item.load),Number(rows[0].load)))?`${format.load(rows[0].load)} × ${rows.map(item=>item.reps).join(', ')}`:
      rows.map(item=>`${format.load(item.load)} × ${item.reps}`).join(', ');
  }
  /** @param {string} id */
  function render(id){
    const host=$('#exActionsSheet'),{draft,program,query}=read();if(disposed||!host||!draft)return;
    activeId=id;const stored=draft.exercises[id],base=program.find(ex=>ex.id===id);if(!stored)return;
    rendered?.abort();rendered=new window.AbortController();const signal=rendered.signal;
    const shown=stored.substitution?.replacement?labels.exercise(stored.substitution.replacement):stored.displayName?labels.exercise(stored):base?labels.exercise(query.sessionExercise(base)):id;
    const name=$('#exActionsName');if(name)name.textContent=shown;
    const sub=$('#exActionsSub');if(sub){
      const primary=stored.programmed.primary||base?.primary||'',total=stored.setOrder.length,lines=[];
      const original=stored.substitution?.original?labels.exercise(stored.substitution.original):'';
      if(original)lines.push(t('log.substitute_for',{name:original}));
      lines.push((primary?labels.muscles(primary)+' · ':'')+`${total} ${plural(total,'set')}`);
      sub.replaceChildren(...lines.map(line=>{const element=document.createElement('span');element.className='exactions__sub-line';element.textContent=line;return element;}));
    }
    const setup=$('#exActionsSetupText');if(setup)setup.textContent=stored.programmed.notes||base?.notes||t('ex.actions.no_setup_notes');
    const previous=base?query.last(query.sessionExercise(base)):[],repeat=document.querySelector(/** @type {'button'} */('#exActionRepeatBtn')),hint=$('#exActionRepeatHint');
    if(repeat){repeat.disabled=!previous.length;if(hint)hint.textContent=previous.length?t('today.sub.before',{sets:previousLine(previous)}):t('ex.actions.no_history');}
    const substituted=!!stored.substitution,substitute=$('#exActionSubstBtn')?.querySelector('.exactions__act-text > span');
    if(substitute)substitute.textContent=t(substituted?'ex.actions.change_substitution':'ex.actions.substitute');
    $('#exActionRestoreOrigBtn')?.classList.toggle('hidden',!substituted);
    const warmups=$('#exActionsWarmupList');
    if(warmups){
      warmups.innerHTML=stored.setOrder.map((setId,index)=>{
        const set=stored.sets[setId];if(!set)return '';const warmup=set.role==='warmup';
        return `<div class="exactions__warmup-row"><div class="exactions__warmup-info"><span class="exactions__warmup-num">${esc(t('log.set'))} ${index+1}</span>`+
          `<span class="exactions__warmup-role ${warmup?'is-warmup':''}">${esc(t(warmup?'ex.actions.role_warmup':'ex.actions.role_working'))}</span></div>`+
          `<button type="button" class="btn btn--steel exactions__warmup-btn" data-warm-toggle-set="${esc(setId)}">${esc(t(warmup?'ex.actions.mark_working':'ex.actions.mark_warmup'))}</button></div>`;
      }).filter(Boolean).join('');
      for(const button of warmups.querySelectorAll(/** @type {'button'} */('[data-warm-toggle-set]')))button.addEventListener('click',async()=>{
        const setId=button.dataset.warmToggleSet;if(!setId)return;
        const result=await commands.toggleWarmup(id,setId);if(disposed||result.status!=='applied')return;
        const held=document.activeElement===button&&host.classList.contains('is-open');onChanged();render(id);
        if(held&&host.classList.contains('is-open'))warmups.querySelector(/** @type {'button'} */(`[data-warm-toggle-set="${window.CSS.escape(setId)}"]`))?.focus({preventScroll:true});
      },{signal});
    }
    const skipped=stored.status==='skipped',skipLabel=$('#exActionSkipLabel');if(skipLabel)skipLabel.textContent=t(skipped?'ex.actions.restore':'ex.actions.skip');
    $('#exActionsStatus')?.classList.toggle('hidden',!skipped);
  }
  function close(){
    if(openingFrame)window.cancelAnimationFrame(openingFrame);openingFrame=0;
    const host=$('#exActionsSheet');if(!host||host.hidden&&shell.activeModal?.el!==host)return Promise.resolve(false);
    return shell.closeModal(host);
  }
  function mount(){
    if(mounted||disposed)return;mounted=new window.AbortController();const signal=mounted.signal;
    /** @param {string} selector @param {()=>unknown} command */
    const click=(selector,command)=>$(selector)?.addEventListener('click',()=>command(),{signal});
    click('#exActionsClose',close);click('#exActionsScrim',close);
    click('#exActionRepeatBtn',async()=>{const id=activeId;if(!id)return;const result=await commands.repeatPrevious(id);if(disposed||result.status!=='applied')return;onChanged();toast(t('toast.filled_from_last'));void close();});
    click('#exActionRestoreOrigBtn',async()=>{const id=activeId;if(!id)return;const result=await commands.restoreOriginal(id);if(disposed||result.status!=='applied')return;onChanged();void close();});
    click('#exActionSkipBtn',async()=>{const id=activeId;if(!id)return;const result=await commands.toggleSkipped(id);if(disposed||result.status!=='applied')return;onChanged();void close();});
    click('#exActionSubstBtn',()=>{const id=activeId;void close().then(()=>{if(!disposed&&id)navigate.substitute(id);});});
    click('#exActionNotesBtn',()=>{const id=activeId;void close().then(()=>{if(!disposed&&id)navigate.notes(id);});});
  }
  /** @param {string} id */
  function open(id){
    if(disposed||!read().draft)return;mount();render(id);const host=$('#exActionsSheet'),scrim=$('#exActionsScrim');if(!host)return;
    document.body.classList.add('is-sheet-open');shell.openModal(host,{initialFocus:$('#exActionsClose'),onEscape:close,scrim,delayHide:motion.reducedMotion()?0:280});
    if(openingFrame)window.cancelAnimationFrame(openingFrame);openingFrame=window.requestAnimationFrame(()=>{openingFrame=0;if(disposed)return;host.classList.add('is-open');scrim?.classList.add('is-open');});
  }
  function dispose(){disposed=true;mounted?.abort();rendered?.abort();mounted=null;rendered=null;void close();}
  return {mount,open,close,render,dispose};
}
